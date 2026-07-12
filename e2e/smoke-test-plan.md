# Real Session Smoke Test Plan

> **版本**: v1.0.0
> **日期**: 2026-07-07
> **状态**: 已执行并按 `smoke-test-results-20260707.md` 修正预期
> **依赖**: serve-api v1.3+, tree-watcher.ts, dispatch_privilege 组件级实现；G4-005 live E2E 仍需 Orchestrator dispatch 触发

## 0.1 执行结果复核（2026-07-07）

实际执行结果为 **35/39 PASS, 0 FAIL, 4 BLOCKED**。所有可执行 smoke test 均通过，但测试计划需修正三点：

1. `dispatch_privilege` 不能写成 P0-P2 全 DONE：grant lifecycle、path/TTL、no-grant block、P4 exemption 已有组件级/局部运行证据；完整 `grant + CodeGraph + safe_framework_edit` live E2E 仍受 serve API agent 参数限制和 WAL 隔离影响，必须走 Orchestrator dispatch 流程验证。
2. serve API 没有 `POST /session/{SID}/guide`、`POST /session/{SID}/reply`、`POST /session/{SID}/interrupt` 端点。当前可用指导路径是 `prompt_async` 带 agent 字段；问题回复路径是 `POST /question/{QID}/reply`。
3. G1-006 的 backup 预期需拆分：首次创建文件不触发 `backup_log` 是合理结果；二次编辑才应验证 backup。

---

## 0. 测试总览

| 组 | 覆盖 Phase | 测试数 | 预计耗时 | 优先级 |
|:---:|-----------|:---:|:---:|:---:|
| G1: DB Runtime | Phase 4 | 8 | 15 min | P0 |
| G2: Native Task Matrix | Phase 2, 5 | 6 | 20 min | P0 |
| G3: Safety Hard Block | Phase 3, 5 | 5 | 10 min | P0 |
| G4: Dispatch Privilege E2E | Phase 0, 4 | 6 | 15 min | P1 |
| G5: Skill/TodoWrite Regression | Phase 1, 5 | 7 | 20 min | P1 |
| G6: QoderWork Bridge | Phase 5 | 4 | 15 min | P1 |
| G7: Context7/Scout Quality Floor | Phase 5 | 3 | 10 min | P2 |
| **Total** | | **39** | **~105 min** | |

---

## 1. G1: DB Runtime Verification (Phase 4)

> **目标**: 证明运行时 DB 读写路径正确，hot-path 不触发非必要 DB 写

### G1-001: session_registry 写入验证

**前置**: Orchestrator session 活跃
**操作**:
1. 启动 Orchestrator session（简单任务："列出当前目录文件"）
2. 等 session idle
3. 查询 session_registry:
```sql
SELECT session_id, parent_session_id, agent, status, created_at
FROM session_registry WHERE session_id = '<ORCH_SID>'
```
**验证**:
- [ ] session_registry 有该 session 记录
- [ ] agent 字段非空
- [ ] status = 'active'

### G1-002: session_registry dual-write 一致性

**前置**: G1-001 session 存在
**操作**:
```sql
SELECT session_id, agent, parent_id FROM session_map WHERE session_id = '<ORCH_SID>';
SELECT session_id, agent, parent_session_id FROM session_registry WHERE session_id = '<ORCH_SID>';
```
**验证**:
- [ ] 两表 agent 值一致
- [ ] 两表 parent 值一致

### G1-003: session_events dispatch 写入

**前置**: Orchestrator dispatch 一个子任务到 build
**操作**:
1. Orchestrator 任务："用 Task 工具派遣一个 build 子任务，内容为 echo hello"
2. 等 child session idle
3. 查询:
```sql
SELECT session_id, event_type, agent_type, dag_task_id, created_at
FROM session_events WHERE event_type = 'dispatched' ORDER BY created_at DESC LIMIT 5;
```
**验证**:
- [ ] session_events 有 'dispatched' 记录
- [ ] agent_type 与 dispatch 目标匹配

### G1-004: 普通 safe_edit 不触发 checklist DB

**前置**: Orchestrator session 活跃
**操作**:
1. 任务："创建一个临时文件 .task_temp/smoke-test-g1.txt，内容 hello"
2. 等完成
3. 查询:
```sql
SELECT COUNT(*) as cnt FROM execution_checklist_runs WHERE session_id = '<SID>';
SELECT COUNT(*) as cnt FROM execution_checklist_items WHERE session_id = '<SID>';
```
**验证**:
- [ ] checklist_runs count = 0
- [ ] checklist_items count = 0

### G1-005: TodoWrite 不写入 DB checklist

**前置**: Orchestrator session 活跃
**操作**:
1. 任务："创建一个 todo list 包含 3 项：读文件、分析代码、写报告，然后完成第一项"
2. 等 idle
3. 查询同 G1-004
**验证**:
- [ ] checklist_runs count = 0
- [ ] checklist_items count = 0
- [ ] TodoWrite 操作仅存在于 session/tool 状态和 JSONL

### G1-006: safe_edit hot-path DB touch 统计

**前置**: Orchestrator session 活跃
**操作**:
1. 记录当前 DB 表 write count baseline:
```sql
-- 需要 SQLite 的 changes() 或 PRAGMA 统计
```
2. 执行一次 safe_edit（写 .task_temp/smoke-g1-006.txt）
3. 记录 touch 了哪些表
**验证**:
- [ ] 触发 backup_log 写入（文件备份）
- [ ] 触发 file_baselines 更新（TOCTOU 基线）
- [ ] 不触发 dispatch_queue
- [ ] 不触发 execution_checklist_*
- [ ] 不触发 dispatch_privilege_grants
- [ ] JSONL 写入: quality.jsonl, audit.jsonl 等

### G1-007: DB authority 唯一性

**操作**:
```bash
find .opencode/state -maxdepth 1 -name "*.db" -not -name "*-wal" -not -name "*-shm" | sort
```
**验证**:
- [ ] 只输出 `framework-state.db`
- [ ] 无其他运行时 DB 文件

### G1-008: .trash-db 不被运行时读取

**操作**:
```bash
grep -rn "trash-db\|\.trash_db\|empty-opencode\|framework_state-0byte\|substate_kv-0byte" .opencode/lib/ .opencode/service/ .opencode/plugin-handlers/ .opencode/tools/ .opencode/plugins/ 2>/dev/null
```
**验证**:
- [ ] 零匹配（无运行时代码引用 .trash-db 文件）

---

## 2. G2: Native Task Matrix (Phase 2, 5)

> **目标**: 证明 Orchestrator 能通过原生 Task 派遣所有 native agent 类型

### G2-001: Orchestrator → build (native Task)

**操作**:
1. Orchestrator 任务："用 Task 工具创建一个 build 子任务：在当前目录创建 .task_temp/g2-build-test.txt，内容 'build agent works'"
2. 等 child session idle
3. 验证文件创建成功
**验证**:
- [ ] build child session 创建成功
- [ ] 文件 .task_temp/g2-build-test.txt 存在且内容正确
- [ ] session_map 有 parent-child 记录
- [ ] session_registry 有 child 记录且 parent_session_id 正确

### G2-002: Orchestrator → plan (native Task)

**操作**:
1. Orchestrator 任务："用 Task 工具创建一个 plan 子任务：分析 .opencode/service/dispatch/router.ts 的主要函数列表"
2. 等 child session idle
**验证**:
- [ ] plan child session 创建成功
- [ ] 输出包含函数列表
- [ ] 不触发 auto_plan 或 DAG 创建

### G2-003: Orchestrator → general (native Task)

**操作**:
1. Orchestrator 任务："用 Task 工具创建一个 general 子任务：总结 AGENTS.md 的主要内容（3 句话）"
2. 等 child session idle
**验证**:
- [ ] general child session 创建成功
- [ ] 输出包含合理总结

### G2-004: Orchestrator → explore (native Task)

**操作**:
1. Orchestrator 任务："用 Task 工具创建一个 explore 子任务：找到 .opencode/tools/ 下所有工具文件的数量"
2. 等 child session idle
**验证**:
- [ ] explore child session 创建成功
- [ ] 输出文件数量正确（应为 22 个，含新增 safe_framework_edit.ts）

### G2-005: Native Task 无 DISPATCH_TOKEN

**前置**: G2-001 的 child session 存在
**操作**:
1. 读取 dispatch prompt 文件或查询 dispatch_queue
2. 检查 native Task 路径是否包含 DISPATCH_TOKEN
**验证**:
- [ ] native Task 路径不需要 DISPATCH_TOKEN
- [ ] marker-consume.ts 审计日志记录 `NATIVE-TASK-DISPATCH` 事件
- [ ] 不触发 DISPATCH-INTEGRITY-BLOCK

### G2-006: 多 child session 并发

**操作**:
1. Orchestrator 任务："同时用 Task 创建 2 个子任务：一个 build 写文件，一个 explore 搜索文件"
2. 等两个 child session idle
**验证**:
- [ ] 两个 child session 各自创建成功
- [ ] session_map/session_registry 有两条 child 记录
- [ ] 无队列碰撞或 lease 冲突

---

## 3. G3: Safety Hard Block (Phase 3, 5)

> **目标**: 证明轻量化后仍保留安全下限

### G3-001: 原生 edit/bash 禁用

**操作**:
1. Orchestrator 任务："用内置 edit 工具修改 .task_temp/test.txt"
2. 观察是否被阻断
**验证**:
- [ ] edit 工具在 opencode.json 中为 "deny"
- [ ] 模型不使用 edit/write 内置工具

### G3-002: 越权路径写入被 scope block

**操作**:
1. Orchestrator 任务（无 framework_maintenance grant）："用 safe_edit 修改 .opencode/project.config.json"
2. 观察是否被阻断
**验证**:
- [ ] safe_edit 的 opencode.json permission 对 Orchestrator deny `.opencode/**`
- [ ] 写入被拒绝

### G3-003: 源码修改前未 CodeGraph 被 block

**操作**:
1. build 子任务："直接用 safe_edit 修改 .opencode/service/dispatch/router.ts 添加一行注释"（不调用 codegraph_explore）
2. 观察是否被阻断
**验证**:
- [ ] codegraph before-handler 阻断
- [ ] 错误信息包含 `[CODEGRAPH-ENFORCE]`
- [ ] 日志记录 `CODEGRAPH-ENFORCE-BLOCK`

### G3-004: Super-Admin 不再 CodeGraph 豁免

**操作**:
1. 验证 `isCodeGraphExemptAgent("super-admin")` 返回 false
```bash
# 通过 grep 或运行时测试确认
grep '"exempt_agents"' .opencode/project.config.json
```
**验证**:
- [ ] exempt_agents = []
- [ ] Super-Admin 修改源码文件需要 CodeGraph impact

### G3-005: safe_framework_edit 无 grant 被拒绝

**操作**:
1. build 子任务（无 framework_maintenance grant）："用 safe_framework_edit 修改 .opencode/lib/test.ts"
2. 观察是否被阻断
**验证**:
- [ ] 工具报 `[FW-ENFORCE][PRIVILEGE] No active framework_maintenance grant`
- [ ] 不执行写入

---

## 4. G4: Dispatch Privilege E2E (Phase 0, 4)

> **目标**: 端到端验证 grant 完整生命周期

### G4-001: Grant 创建 → 绑定 → 消费

**操作**:
1. Orchestrator 任务："创建 dispatch_privilege grant 给 build agent，allowed_paths=.opencode/service/dispatch/**，然后派遣 build 子任务用 safe_framework_edit 修改 .opencode/service/dispatch/test-grant.txt"
2. 监控 grant 状态变化
**验证**:
- [ ] dispatch_privilege_grants 有 `pending` 记录
- [ ] child session 启动后 grant 变为 `bound`
- [ ] safe_framework_edit 成功后 grant 变为 `consumed`
- [ ] 查询:
```sql
SELECT id, dispatch_key, status, child_session_id, bound_at, consumed_at
FROM dispatch_privilege_grants ORDER BY created_at DESC LIMIT 5;
```

### G4-002: Grant 路径不匹配被拒绝

**前置**: 创建 grant with allowed_paths=[".opencode/lib/**"]
**操作**:
1. build 子任务用 safe_framework_edit 修改 .opencode/service/dispatch/router.ts
**验证**:
- [ ] 工具报路径不匹配
- [ ] grant 不被消费（状态仍为 bound）

### G4-003: Grant TTL 过期

**操作**:
1. 创建 grant with ttl_ms=5000（5 秒）
2. 等待 6 秒
3. 尝试 bind
**验证**:
- [ ] bindGrant 返回 null
- [ ] hasGrant 返回 null

### G4-004: 非 Orchestrator 不能创建 grant

**操作**:
1. build agent 尝试通过 router.ts 创建 dispatch_privilege
**验证**:
- [ ] router.ts 报 `[FW-ENFORCE][PRIVILEGE] Only Orchestrator can create privilege grants`
- [ ] grant 未创建

### G4-005: Grant + CodeGraph 双满足写入

**操作**:
1. Orchestrator 创建 grant（allowed_paths=.opencode/service/**）
2. build 子任务先调用 codegraph_explore
3. 然后调用 safe_framework_edit 写入 .opencode/service/dispatch/grant-test.txt
**验证**:
- [ ] codegraph.ts 不得因 grant bypass 跳过 `impact_called`
- [ ] safe_framework_edit 工具层 grant check 通过
- [ ] 写入成功，文件存在
- [ ] grant 被消费
**当前状态**: PARTIAL / BLOCKED for live E2E。组件级 grant 创建、绑定、has/consume 均通过；serve API 直接创建 build session 不能代表真实 build runtime，完整验证必须通过 Orchestrator dispatch 创建 child session。

### G4-006: DB failure 不静默降级

**操作**:
1. 模拟 DB 不可用（只读模式或锁文件）
2. 尝试 createGrant
**验证**:
- [ ] createGrant 抛异常或返回 null
- [ ] 不降级为"继续写"
- [ ] 日志记录 DB failure

---

## 5. G5: Skill/TodoWrite Regression (Phase 1, 5)

> **目标**: 验证 Skill 注入和 TodoWrite 行为正确

### G5-001: preflight-lite 默认加载

**操作**:
1. Orchestrator 任务："分析 .opencode/tools/safe_edit.ts 的代码结构"
2. 检查 session prompt 或 skill-audit JSONL
**验证**:
- [ ] skill-audit.jsonl 记录 `preflight-lite` 被加载
- [ ] 或 session 输出包含 preflight 分类

### G5-002: skill-summary 关键词匹配

**操作**:
1. Orchestrator 任务："修改 .opencode/service/dispatch/router.ts 添加日志"
2. 检查 skill-summary 注入
**验证**:
- [ ] skill-summary 注入 `codegraph-first` 推荐
- [ ] 日志包含 `keywordGroups` 含 `source-edit` 或 `architecture`

### G5-003: TodoWrite standard 任务创建

**操作**:
1. Orchestrator 任务（standard 复杂度）："分析 .opencode/service/dispatch/ 目录所有文件的职责"
2. 观察 TodoWrite 创建
**验证**:
- [ ] TodoWrite 创建 3-5 个行动型 todo
- [ ] 每个 todo 是具体步骤，不是泛泛描述
- [ ] quality.jsonl 记录 `todo_write_observed`

### G5-004: TodoWrite trivial 任务不创建

**操作**:
1. Orchestrator 任务："读取 .opencode/project.config.json 的 enforcement_mode 值"
2. 观察是否创建 TodoWrite
**验证**:
- [ ] 不创建 TodoWrite（trivial 任务）
- [ ] quality.jsonl 无 `todo_missing_for_nontrivial` 警告（因为任务是 trivial）

### G5-005: TodoWrite 工具失败后更新

**操作**:
1. build 子任务："修改一个不存在的文件 .task_temp/nonexistent-source.txt"
2. 观察 TodoWrite 更新
**验证**:
- [ ] TodoWrite 更新当前 todo 的 failure reason
- [ ] 或创建新的恢复动作 todo
- [ ] quality.jsonl 记录 `todo_failure_without_recovery` 如果未更新

### G5-006: TodoWrite 写操作与 in_progress 关联

**操作**:
1. Orchestrator 任务（含多步骤 + 写文件）
2. 在写文件前检查当前 in_progress todo
**验证**:
- [ ] 写文件时的 in_progress todo 与写操作目标相关
- [ ] 如不相关，quality.jsonl 记录 `todo_write_mismatch`

### G5-007: skill-policy warn 未加载 Skill

**操作**:
1. 构建一个场景让 build agent 不调用任何 Skill 就写文件
2. 检查 skill-policy 日志
**验证**:
- [ ] skill-policy before-hook 记录 warn 日志
- [ ] 日志包含 `SKILL-POLICY-WARN` 或类似事件

---

## 6. G6: QoderWork Bridge (Phase 5)

> **目标**: 验证弱模型卡住时能被 QoderWork 干预

### G6-001: Question 工具可用

**操作**:
1. Orchestrator 任务："对以下需求提出澄清问题：'优化系统性能'"
2. 观察是否使用 question 工具
**验证**:
- [ ] question 工具被调用
- [ ] SSE 事件包含 `question.asked`
- [ ] serve API `/questions` 能查到该问题

### G6-002: serve API guide 保留身份

**前置**: 活跃 child session
**操作**:
```bash
bun run scripts/guide.ts <CHILD_SID> --text="请先读取 router.ts 再修改"
```
**验证**:
- [ ] guidance 被写入
- [ ] session 恢复后模型能看到 guidance
- [ ] guidance 不改变 agent 身份
**端点说明**: 不存在 `POST /session/{SID}/guide`。`guide.ts` 实际使用 `POST /session/{SID}/prompt_async` 并显式携带 `agent` 字段来保持身份。

### G6-003: serve API reply-qid 精确回复

**前置**: G6-001 的 question 存在
**操作**:
```bash
bun run scripts/intervene.ts <SID> --mode=reply-qid --qid=<QUESTION_ID> --text="请聚焦数据库查询性能"
```
**验证**:
- [ ] question 被回复
- [ ] session 继续执行
- [ ] SSE 事件包含 `question.replied`
**端点说明**: 不存在 `POST /session/{SID}/reply`。正确路径是 `GET /question` 查 QID 与 `sessionID`，再 `POST /question/{QID}/reply`。

### G6-004: serve API abort 止损

**前置**: 活跃 session 正在执行长任务
**操作**:
```bash
bun run scripts/intervene.ts <SID> --mode=abort
```
**验证**:
- [ ] session 在 10s 内停止
- [ ] 状态变为 idle 或 error
- [ ] 不产生半写状态文件

---

## 7. G7: Context7/Scout Quality Floor (Phase 5)

> **目标**: 验证外部知识判断和调研能力

### G7-001: 外部框架知识触发 freshness

**操作**:
1. Orchestrator 任务："使用 React 19 的新 use() hook 重构组件"
2. 检查 preflight-lite 输出
**验证**:
- [ ] preflight-lite 产出 `knowledge freshness needed` 决策
- [ ] 推荐 `context7-first` skill
- [ ] 或日志包含 `knowledge_freshness_decision`

### G7-002: 纯本地任务不触发 Context7

**操作**:
1. Orchestrator 任务："读取 .opencode/project.config.json 的 enforcement_mode"
2. 检查是否触发 Context7
**验证**:
- [ ] 不触发 context7-first
- [ ] 不派 Scout
- [ ] skill-summary 不注入 context7/brainstorming

### G7-003: 复杂调研建议 Scout

**操作**:
1. Orchestrator 任务："对比 Bun 和 Deno 在 SQLite 并发写入场景下的性能差异，给出推荐"
2. 检查 preflight-lite 输出
**验证**:
- [ ] preflight-lite 建议 brainstorming 或 Scout
- [ ] 或 skill-summary 注入 `brainstorming`
- [ ] 不直接写代码

---

## 8. 执行指南

### 8.1 测试环境

```
work-one: /home/zhaoge/workspace/opencode/work-one
serve API: http://localhost:4096
QoderWork: /home/zhaoge/workspace/qoderwork
```

### 8.2 测试工具

| 工具 | 用途 |
|------|------|
| `bun run scripts/session-tree.ts <ROOT_SID>` | 查看 session 树 |
| `bun run scripts/monitor-tree.ts <ROOT_SID>` | 监控 session 状态 |
| `bun run scripts/tree-watcher.ts <ROOT_SID> --capsule` | evidence capsule |
| `bun run scripts/guide.ts <SID> --text="..."` | 通过 `prompt_async` 发送 identity-preserving guidance |
| `bun run scripts/intervene.ts <SID> --mode=...` | 干预 |
| `curl http://localhost:4096/session` | 查看活跃 session |
| `sqlite3 .opencode/state/framework-state.db` | DB 查询 |

### 8.3 执行顺序

1. **G1 → G3 → G4** (P0): 先验证 DB 基础 + 安全底线 + 权限系统
2. **G2 → G5** (P1): 再验证 Native Task 矩阵 + Skill/TodoWrite
3. **G6 → G7** (P2): 最后验证 QoderWork bridge + 知识质量

### 8.4 结果记录格式

每项测试结果记录为:

```markdown
### [TEST_ID]: [名称]
**日期**: YYYY-MM-DD
**Session**: [root session ID]
**结果**: PASS / FAIL / BLOCKED
**证据**:
- [命令输出/日志片段/DB 查询结果]
**备注**: [如有偏差或环境问题]
```

### 8.5 判定规则

| 组 | PASS 条件 |
|----|----------|
| G1 | 8/8 项 PASS |
| G2 | 5/6 项 PASS（允许 1 项 native agent 不可用） |
| G3 | 5/5 项 PASS（安全底线不可妥协） |
| G4 | 5/6 项 PASS（G4-006 DB failure 可标记为 BLOCKED） |
| G5 | 6/7 项 PASS |
| G6 | `question` + abort 必须 PASS；`guide/reply` 若按不存在的 `/session/{SID}/guide|reply` 端点测试应标 BLOCKED，脚本路径需另行验证 |
| G7 | 2/3 项 PASS |
| **整体** | **所有组 PASS** |

---

## 9. 风险与注意事项

1. **serve API 必须运行**: 测试前确认 `curl localhost:4096/session` 返回 200
2. **CodeGraph daemon**: G3-003 需要 codegraph serve 运行中
3. **DB 锁**: G4-006 的 DB failure 模拟需要谨慎，避免破坏运行态
4. **Session 清理**: 每组测试后清理 .task_temp/ 临时文件
5. **弱模型不确定性**: G5/G7 依赖模型行为，同一输入可能产出不同结果，建议跑 2-3 次取多数结果
