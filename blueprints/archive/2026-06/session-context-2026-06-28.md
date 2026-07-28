# Session Context Summary — 2026-06-28

本文档汇总本次 session 的所有分析成果和待办任务，供新 session 在 qoderwork workspace 中继续使用。

---

## 一、本次 Session 已完成的工作

### 1. CodeGraph 强制策略补齐（codegraph-enforce.ts）

**问题**：codegraph-enforce.ts 只拦截 safe_edit，未拦截 safe_delete/safe_restore/safe_shell，Agent 可通过这三个工具绕过影响分析直接修改代码。

**变更**：
- `.opencode/plugins/codegraph-enforce.ts` — INTERCEPTED_TOOLS 从 {safe_edit} 扩展到 4 个工具，新增 extractFilePath() 按工具类型提取目标路径，safe_shell 用正则匹配 cp/mv/sed/node 模式
- `.opencode/skills/codegraph-first/SKILL.md` — v1.1.0，触发条件覆盖全部文件修改工具
- `.opencode/agents/*.md`（10 个）— skills: 字段新增 codegraph-first

**决策**：safe_shell 的目标提取用正则匹配而非直接取 file_path（因为参数是 command 字符串）。考虑过"所有 safe_shell 一律阻断"但太粗暴，改为尝试提取目标路径，提取不到则用完整命令作 fallback（不会被豁免路径匹配，等于保守阻断）。

### 2. Skill 注册约定确认

新 Skill 必须在 agent .md 的 `skills:` 字段显式列出，不在 opencode.json 中注册（opencode.json 只管 permission 级 `skill: allow`）。codegraph-first 之前漏了这一步，已补齐到全部 10 个 Agent。

### 3. CodeGraph CLI 可用性确认

QoderWork 可通过 WSL bash 直接调用 codegraph CLI，功能等同 MCP 工具（query=search, impact=impact, callers/callees/explore/node/files/status）。无需额外 MCP 集成。

### 4. QoderWork 专属工作目录建立

创建 `/home/zhaoge/workspace/qoderwork/`，含 AGENTS.md（174 行，8 段：项目概况/WSL 约定/CodeGraph 规则/Memory 规则/配置权威源/Session 管理/更新日志规范/协作日志摘要）和 logs/ 目录。

---

## 二、本次 Session 发现的安全漏洞

### 漏洞 1：safe_shell 不创建备份

**现状**：safe_edit 在执行前调用 backup-manager 创建原子备份（带时间戳、agent 名、task ID），可通过 safe_restore 恢复。safe_shell 只做 allowlist + dangerous pattern 检查，然后直接 execSync 执行，**不创建任何备份**。

**影响**：Agent 通过 safe_shell 执行 `cp new.ts .opencode/lib/xxx.ts` 或 `node fix-script.ts`（脚本内 writeFileSync 修改文件），文件被直接覆写，无法恢复。

**DANGEROUS_PATTERNS 的部分保护**：阻止了 cp/mv/sed/tee 到 `.opencode/hooks|state|agents|rules` 和 `docs/official_docs/`，但业务代码文件不受保护。`touch *`、`mkdir -p *` 可任意创建。

### 漏洞 2：备份位置不一致

**现状**：backup-manager.ts 的 BACKUP_REPO 是 `.task_temp/.backups/`（集中式，DB 记录）。但 safe_edit 的 backupPath() 函数用 `path.join(path.dirname(filePath), ".opencode_backups")` 在文件同级创建额外备份。

**实际结果**：备份散落在项目各处——`docs/review/state-management/.opencode_backups/`、`docs/review/framework-refactor/.opencode_backups/` 等至少十几个目录。用户要求所有备份集中在 `.task_temp/.opencode_backups/`。

**两套备份并行**：safe_edit 同时写入 `.opencode_backups/`（文件级）和 `.task_temp/.backups/`（DB 级），造成冗余和混乱。

---

## 三、File Guard 统一 API 设计方向

### 核心思路

把安全策略从"工具层"下沉到"文件系统层"——不关心是哪个工具发起的操作，只关心"这个操作要对哪个文件做什么"。所有文件修改操作经过统一入口，入口自动调用已有的基础设施。

### 现有基础设施（不需要重建，需要收拢）

| DB 表 | 已有能力 | 当前问题 |
|-------|---------|---------|
| `backup_log` | 集中备份到 `.task_temp/.backups/`，记录 uuid/agent/session_id/dag_task_id/original_path/backup_path/file_hash/status | 只有 backup-manager 调用方使用，safe_shell 不调用 |
| `file_baseline_kv` | 跨进程 TOCTOU 检测（inode/size/mtime/ctime/process_id） | 只有部分工具查询 |
| `tsc_gate_locks` | 文件级锁（file_path → session_id） | 只服务 TSC 场景 |
| `audit_log` | 审计记录（session_id/agent/event_type/detail） | safe_shell 有自己的 logAction，但与 audit_log 不统一 |
| `session_map` | session → agent/dag_task_id/domain_id 映射 | 上下文传递依赖各工具自行获取 |
| `substate_kv` | 16 个子状态（write_audit_state 等） | 各 substate 独立更新，无统一触发 |

### 设计要点

1. **统一入口**：所有 safe_* 工具的文件操作通过 File Guard API，不再各自实现备份/审计/锁
2. **全链路**：锁（tsc_gate_locks）→ 基线记录（file_baseline_kv）→ 备份（backup_log）→ 执行 → 审计（audit_log）→ substate 更新（write_audit_state）
3. **Session 上下文**：从 session_map 自动获取 agent + dag_task_id + domain_id，工具不需要手动传递
4. **并发协调**：多 agent 同时操作时的文件锁、session 锁、task 锁
5. **备份统一**：废弃 `.opencode_backups/` 文件级备份，只用 `.task_temp/.backups/` DB 级备份
6. **safe_shell 纳入**：safe_shell 的文件修改操作也必须经过 File Guard

### 实现选择

**选定方案**：统一 API（TypeScript 模块）+ fs.watch 兜底观测
- 第一阶段：统一 API，覆盖所有 safe_* 工具
- 第二阶段：fs.watch 兜底，发现绕过 API 的操作并告警
- 不采用 OS 级 fanotify（开发周期长、复杂度高、场景不需要全进程拦截）

### 复杂度来源

- 16 个 substate_kv 的联动更新
- session/task/agent 三级并发
- DB-only 架构下备份操作本身也要 DB-canonical
- gate_sessions 的状态机与文件操作的交互
- dispatch_queue 的并发调度与文件锁的协调

---

## 四、待办任务

### 高优先级

1. **File Guard 统一 API 设计**：基于上述分析，输出正式的设计方案文档。需要深入分析：
   - 每个 safe_* 工具的当前文件操作路径
   - substate_kv 中 write_audit_state 的更新逻辑
   - 并发场景下的锁策略
   - 与 gate_sessions 状态机的交互
   - 迁移计划（从分散机制到统一入口的过渡）

2. **备份位置修复**：将 backupPath() 改为统一输出到 `.task_temp/.backups/`，清理散落在项目各处的 `.opencode_backups/` 目录

### 中优先级

3. **认知地图**（之前讨论的 4 层计划）：
   - Layer 1：系统全景（10 Agent + 25 Plugin + 12 Tool 关系图）
   - Layer 2：Agent 职责边界
   - Layer 3：关键执行流函数级拆解
   - Layer 4：排错手册

4. **CodeGraph sync**：运行 `codegraph sync` 更新索引（当前有 1 个 pending change）

---

## 五、关键文件路径速查

| 文件 | 路径 | 说明 |
|------|------|------|
| 框架 DB | `.opencode/state/framework-state.db` | 主状态 DB（WAL 模式） |
| substate DB | `.opencode/state/substate_kv.db` | 子状态 KV |
| backup-manager | `.opencode/lib/backup-manager.ts` | 集中备份管理 |
| safe-edit-core | `.opencode/lib/safe-edit-core.ts` | safe_edit 核心逻辑 |
| safe-bash-core | `.opencode/lib/safe-bash-core.ts` | safe_shell 核心逻辑 |
| codegraph-enforce | `.opencode/plugins/codegraph-enforce.ts` | CodeGraph 硬约束插件 |
| codegraph-first | `.opencode/skills/codegraph-first/SKILL.md` | CodeGraph 使用 Skill |
| QoderWork AGENTS.md | `/home/zhaoge/workspace/qoderwork/AGENTS.md` | QoderWork 专属协作指南 |
| QoderWork logs | `/home/zhaoge/workspace/qoderwork/logs/` | 变更日志目录 |
| work-one AGENTS.md | `/home/zhaoge/workspace/opencode/work-one/AGENTS.md` | OpenCode Agent 全局规范（21KB） |

---

## 六、DB 表结构参考

关键表（File Guard 设计相关）：

- **session_map**: session_id → agent, dag_task_id, domain_id
- **backup_log**: uuid, agent, session_id, dag_task_id, original_file_path, backup_file_path, file_hash, status
- **file_baseline_kv**: path_hash → inode, size, mtime, ctime, dev, process_id
- **tsc_gate_locks**: file_path → session_id, locked_at, lock_type
- **audit_log**: session_id, agent, event_type, detail, timestamp
- **substate_kv**: key → json（16 个子状态，其中 write_audit_state 256KB）
- **gate_sessions**: 复杂状态机（checked→armed→completed→drained）
- **dispatch_queue**: 任务调度（status, agent_type, dag_task_id, session_id, lease）
