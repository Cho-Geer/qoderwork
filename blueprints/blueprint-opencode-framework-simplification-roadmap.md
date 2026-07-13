# Blueprint: OpenCode 框架 Official Native Agent + Skill/Hook 重构路线图

> **版本**: v1.14.5
> **日期**: 2026-07-13 (v1.14.5 更新：收口 L3-012 core live E2E，校准 safe_shell VerifiedCommandPlan / execFile / spawn 状态与剩余 live allow-path 边界)
> **状态**: 实施中（Phase 0-1 完成；Phase 2-4 主体完成但仍有精确矩阵尾巴；Phase 5 完成）
> **适用项目**: `/home/zhaoge/workspace/opencode/work-one`
> **依据**: `documents/review/opencode-framework-architecture-assessment.md` 审核结论 + 当前 work-one 代码与配置核验

---

## 0.0 Live 实施状态（2026-07-13 交叉审核）

| 范围 | 当前状态 | 证据等级 | 证据 | 仍需跟进 |
|---|---|---|---|---|
| 基线事实 | ✅ 已更新 | static/code | CodeGraph 429 files / 387 TS / 30 JS / 12 YAML；DB schema v37 / 49 business / 50 total | `work-one/.opencode/docs/state-tiering.md` 已重写为 v37 7-tier（2026-07-11）；文件数随 Phase 6/7 新增模块漂移 |
| Agent 边界 | ✅ 已落地 | static/code | active agent = Orchestrator/build/general/plan/explore；active prompt 仅 `Orchestrator.md`；legacy profile 9 个 | 无 active `scout`；Scout 只能写成 Scout-like research |
| Handler 链 | ✅ 已收敛 | static/code | before 11 / after 7 / system 2；dispatcher map 与 order 对齐；`path-validate`、`tool-governance` 均在 active before 链 | 注释中仍有个别旧数字但不影响 runtime |
| Skill-first | ✅ 完成 | **live LLM E2E** | `skill-summary` active 且 2026-07-11 真实 serve 24/24 session 命中注入；`preflight-lite` 14 步 + framework maintenance flow；watcher 契约与脚本存在；`e2e/skill-summary-keyword-regression.md` 已升级为**中英文双语 + live LLM E2E**（SID 见明细） | 双语不一致（4/12 行 CN≠EN，F1-F4）+ live 捕获漂移（F6）+ `dispatch/investigation/裸API` 未触发 keyword（待修） |
| Native Task / DAG | 🟡 主体完成 | runtime smoke | runtime smoke T2/T3/T4 记录 no-DAG、lineage、explore 调研 | `dispatch_subagent` 仍作为兼容 wrapper 存在 |
| Enforcement | 🟡 主体完成 | runtime smoke + component + direct tool smoke | question recovery smoke；framework maintenance tests 13/13 PASS；rule-disposition active；相关治理/path/codegraph/safe_shell 套件 104/104 PASS；`safe_shell` 已通过 `VerifiedCommandPlan` + `execFile`/`spawn`（`shell:false`）执行 direct `pwd` smoke | `isWriteAllowed` / `getAgentShellAllowlist` 等 per-agent caller 仍需收口；safe_shell live allow-path、资源上限、中断、进程树终止 E2E 待补 |
| Tool Governance MVC | 🟡 core 收缩已闭合，矩阵未完成 | component + static/code + unit + import smoke + live LLM E2E | `service/tool-governance/**` 接入 `tool-governance` before handler；`codegraph.ts` 已移除 repo-op/GitHub write 主裁决（仅留证据适配器）；before-dispatcher import smoke PASS；L3-012 session `ses_0a66bc378ffelPj4R46sNeG0zR` 见证 `safe_shell gh issue create --repo ...` 被 `[REPO-OP] ... layer=repo-policy outcome=deny` 阻断，且无 `WORKTREE_BOUNDARY` / `CODEGRAPH-ENFORCE` | L3-012 证据包为最小包；`gh api -X POST/PATCH/DELETE`、`gh issue comment`、`gh pr create`、release/workflow/secret 等 remote_write 变体仍需 companion cases；Orchestrator -> build allow-path live E2E 未补 |
| Minimal State | 🟡 主体完成 | runtime smoke + component | JSONL writer + emitters；只读 hot-path 零 DB 写；deprecated 表停写 | `/children` HTML/non-JSON 故障注入未见独立证据 |
| Legacy 退役 | ✅ 完成（归档闭环） | **live LLM E2E** + static/code + component | `skill-summary.ts` 已删除 9 个 inactive blueprint agent 映射；V5.1-V5.9 全量矩阵已归档（`plans/06` §7）；23 弱模型回归 23/23 PASS（2026-07-11 live GOV/GUARD 探针将 #5/#16/#21/#23 升级至 live LLM E2E，`e2e/weak-model-23-regression.md`）；`dispatch_subagent` 决策已固化（`temporary-audits/dispatch_subagent-decision.md`）；A2 核查 N/A（active 链角色无关） |

---

## 0.1 历史 Live 实施状态（2026-07-07 代码/E2E 复核）

以下 0.1-0.6 均为 2026-07-06/07 历史快照，已被 2026-07-11 与 2026-07-13 交叉审核 supersede；保留作演进记录：

1. **Orchestrator 唯一实质自定义 agent 的收敛已落地**：
   - `.opencode/agents/` 当前有 `Orchestrator.md` 与 3 行 `build.md` stub；只有 Orchestrator 承载实质自定义 prompt
   - 其余 9 个旧角色已移入 `.opencode/legacy/agent-profiles/`
2. **active handler 链已收敛并接线**：
   - before: 8（`task` handler 已重新进入 active order，仅处理 `Task`/`task` 的 dispatch marker）
   - after: 6
   - system: 2
   - `behavioral-path-guard` 与 `skill-summary` 都在 active order 中
3. **`skill-summary` 已从设计进入 live 代码，并在 v2.3 具备运行级证据**：
   - 真实存在 agent base skill bundle、关键词匹配、中文触发词、freshness/Scout/TodoWrite 决策
   - v2.1 的 `extractRecentMessage()` 字段猜测被官方 SDK 签名否定，v2.2 改为 `chat.message` → `system.transform` 会话级桥接，输入路径符合官方 SDK 类型契约
   - v2.3 增加 `coldStartDbFallback(sessionID)`，解决 Orchestrator 首轮 bridge 为空问题；2026-07-06 日志已出现 `keywordGroups=source-edit,architecture,database` 与 `scout_escalation_suggested`
4. **dispatch prompt 已去掉 active preamble**：
   - `prompt-builder.ts` 明确移除了 `PREAMBLE_FILE`
   - active prompt 改成 `preflight-lite` + native `Task` first
5. **native `Task` 对缺失 `DISPATCH_TOKEN` 的兼容已进入运行级矩阵验证**：
   - `marker-consume.ts` 对 native path 已是 audit-first 语义
   - 2026-07-07 smoke G2 已验证 build/plan/general/explore、无 DISPATCH_TOKEN、多 child 并发 6/6 PASS
6. **Minimal State 双写基础已落地**：
   - `session-map.ts` dual-write `session_registry`
   - `router.ts` dual-write `session_events`
7. **`checklist_policy.mode=optional` 已落在配置中**，普通任务不落 checklist 的运行证据已由 G1-004/005 补实（普通 safe_edit / TodoWrite 均不写 checklist DB，0 行；runtime smoke）
8. **`preflight-lite/FULL.md` 已完成轻量化**：
   - v3.0.0 明确为 reference document，active entry point 是 `SKILL.md`
   - 已删除旧版 DAG/compliance gate/MCP 全成功硬门禁叙事
9. **dispatch marker canonical path 已完成主链路 E2E**：
   - `dispatch-subagent.ts` 输出 `QUEUE_ID`，`router.ts` 追加 `//QUEUE_ID:<id>`，`before/task.ts` 提取后交给 `marker-consume.ts`
   - `marker-consume.ts` 优先从 `dispatch_prompt_refs` 读取磁盘 canonical prompt 做 `DISPATCH_TOKEN` 校验，避免依赖 LLM 字节级转交长 prompt
   - `dispatch_queue` 已按 queue id 精确 lease，不再按 `agent_type` 误租旧 pending 队列
10. **framework maintenance grant 主链路 live LLM E2E 已通过**：
   - E2E v5 证实 `dispatch_queue` / `dispatch:child:<dag_task_id>` synthetic `session_map` / `session_events` 使用同一 canonical UUID
   - `dispatch_privilege_grants` 生命周期已验证 `pending -> bound -> consumed`
   - `safe_framework_edit` 在 grant + CodeGraph + allowed path 下成功写入 `.opencode/_test_framework/probe-v5.txt`

### 当前明确遗留

1. ~~`skill-summary` recent-message 捕获和 Orchestrator 首轮冷启动问题~~ **已修复并有运行级证据 (2026-07-06)**：v2.2 桥接 + v2.3 DB fallback 后，S1-001/S1-002/S5-002/S5-004/S5-005 已从失败/部分通过提升为运行级 PASS。
2. native `Task` 无 DAG / 无 token 路径已有 G2 6/6 smoke 证据；剩余是 Scout 真实子 agent、wrapper 退场、跨 agent Skill 可见性、权限继承、lineage 和结果回传的深度回归。
3. `dispatch_subagent` 仍承担 queue/token/prompt-ref/lineage 的 legacy wrapper 责任，尚未完全退役。
4. `service/dispatch/dispatch-validate.ts` 等 legacy validator 仍在代码库内，需要继续隔离或收敛。
5. `preflight-lite/FULL.md` 已修正，但 `.opencode/docs/final-validation-report.md`、历史规则/测试和部分 legacy 文档仍需继续清理旧硬门禁叙事。
6. QoderWork ACP/SSE 主动观察与干预仍需区分通道：`prompt_async + agent` guidance、`/question/{QID}/reply` 和 abort 是当前正确路径；`/session/{SID}/guide|reply|interrupt` REST 端点不存在。
7. ~~框架维护写入仍缺任务级临时授权 live 闭环~~ **主链路已通过 live LLM E2E (2026-07-07)**：剩余不再是 bind/consume 主链路，而是 path 越界、TTL、并发 child 复用、DB fallback 故障注入、native Task metadata 替代 `dispatch_subagent` 的后续矩阵。

### 0.2 E2E 结果复核（2026-07-06）

已复核 `e2e/opencode-framework-simplification-e2e-results.md` 与当前 `work-one` 代码/日志。结论如下：

1. **总体方向属实**：S2-S5 对应的 native Task 兼容、behavioral path guard、CodeGraph hard block、v33 minimal-state 双写、legacy role mapping 等代码结构大多已经存在。
2. **`skill-summary` 旧 P0 已关闭**：E2E 文件前半段 v2.3 addendum 与当前代码/日志一致；`recentMessageBridge` + `coldStartDbFallback` 已让 S1-001/S1-002/S5-002/S5-004/S5-005 具备运行级 PASS 证据。
3. **证据级别仍需区分**：模型 provider 已可用；S2 已有一条 Orchestrator -> build runtime smoke，但 native Task 全矩阵与 S3 enforcement block 仍不能写成完整运行级全通过。
4. **live metric 与 E2E 快照有漂移**：2026-07-06 复核 active `rg --files .opencode -g '*.ts'` 口径为 318 个 TS 文件、67,925 行；2026-07-07 本轮重采样为 320 个 TS 文件、68,809 行；CodeGraph 口径为 363 files / 323 TS / 30 JS / 10 YAML。2026-07-06 主 DB 为 44 表/schema v33；2026-07-07 v5 E2E 后为 45 张业务表 / 46 张含 `sqlite_sequence` / schema v34。E2E 快照中的 325/68,337/45 应视为测试时点数据。
5. **`preflight-lite/FULL.md` 旧问题已修复**：当前 FULL.md 为 v3.0.0 reference document，明确不再要求 DAG/compliance gate/MCP 全成功；剩余问题是历史文档/测试是否仍引用旧门禁。
6. **serve-api session-tree 主路径已完成验收**：`logs/2026-07-06-serve-api-e2e-validation.md` 记录 v1.3.0 六场景 6/6 PASS：session 树、全树监控、身份保留 guidance、QID-SID 路由校验、mid-turn 排队模型、abort 止损均通过。代码侧已实现 `/children` 失败时 framework DB fallback 和 root 不可达 exit=2；本次 E2E 验证的是 `/children` JSON 主路径，未单独做 fallback 故障注入。

### 0.3 Smoke Test 复核（2026-07-07）

`e2e/smoke-test-results-20260707.md` 记录真实 serve API smoke：**35/39 PASS, 0 FAIL, 4 BLOCKED**。对本 roadmap 的调整如下：

| 领域 | 结果 | 状态调整 |
|------|------|----------|
| DB Runtime | G1 PASS；首次创建文件不触发 `backup_log` 属补测项 | Phase 4 DB hot-path 可标 runtime smoke PASS，二次编辑 backup 另测 |
| Native Task | G2 6/6 PASS | Phase 2 四类 native agent 矩阵从“待补”提升为 smoke PASS；Scout 子 agent仍待补 |
| Safety Hard Block | G3 5/5 PASS | Phase 3 安全底线从 static/code 提升为 smoke PASS |
| Dispatch Privilege | G4 smoke + E2E v4/v5 | grant 组件级 PASS 已升级为 live LLM 主链路 PASS；剩余是 edge-case matrix 与 native metadata 退场 |

### 0.4 Dispatch Privilege E2E 复核（2026-07-07）

已复核 `logs/2026-07-07-canonical-prompt-reference.md`、`logs/2026-07-07-dag-task-id-consistency.md`、当前 `work-one` 代码和 live SQLite 状态。结论如下：

1. **v4 结论边界**：canonical prompt reference 解决了 prompt handoff 脆弱性，`safe_framework_edit` 写入成功，grant `pending -> bound -> consumed`；但当时 queue lease 仍按 `agent_type` 租旧队列，不能称完整闭环。
2. **v5 主链路闭环**：`dispatch-subagent.ts` 用 canonical `dagTaskId` 入队，`router.ts` 写 `session_map`/`session_events` 时 fallback 到 `effectiveDagTaskId`，`marker-consume.ts` 按 `queueId` 精确 lease；E2E v5 记录 queue 37 `running`、probe-v5 写入 `full-chain-ok`、compliance gate `passed=true` 且返回 `session_id`。
3. **DB 证据边界**：当前 DB 中 queue 37、`dispatch_privilege_grants`、`session_events`、synthetic `dispatch:child:<dag_task_id>` 行一致；真实 native child session 行仍可能 `dag_task_id=NULL`，因为 session hook 不携带 canonical DAG ID。gate 的权威匹配当前依赖 synthetic dispatch row，而不是所有 child session row 都携带 DAG。
4. **仍需保留的遗留项**：`dispatch_subagent` 已由 `temporary-audits/dispatch_subagent-decision.md` 决策固化（仅 framework maintenance trusted compat path，普通派遣改用原生 Task）；path 越界/TTL/并发复用/DB fallback 边界矩阵已归档于 `plans/06` §7.2（V5.9）。剩余：ACP watcher 自动监督为后续项。

### 0.5 Smoke Test 其他结果复核（2026-07-07）

| 领域 | 结果 | 状态调整 |
|------|------|----------|
| Skill/TodoWrite | G5 7/7 PASS | TodoWrite 外置工作记忆回归可标 smoke PASS |
| QoderWork Bridge | G6 question/abort PASS，`/session/{SID}/guide|reply` BLOCKED | 文档需统一到 `prompt_async + agent` 与 `/question/{QID}/reply` |
| Context7/Scout | G7 3/3 PASS | freshness/复杂调研质量底线可标 smoke PASS，不等于 Scout child 矩阵通过 |

### 0.6 Question Enforcement 与 Debt 交叉复核（2026-07-07）

已交叉验证 `logs/2026-07-07-question-enforcement-smoke.md`、`debt/2026-07-07-dispatch-privilege-grant-binding-gap.md` 和当前代码，当前任务进度表**方向大体属实，但存在优先级和措辞修正**：

1. **Question enforcement 不是“只能 static PASS”**：代码层 `question` 已在 guidance gate、phase0 allowed tools、enforcement passthrough 中放行；smoke 已有 question tool call/reply 的 runtime 证据。准确状态是 **static PASS + partial runtime PASS**，未闭合的是 STOP 注入、Phase 1/2 guidance-delivered 和 Phase-0 controlled failure 的 full-runtime。
2. **Phase-0 绕过是 question enforcement full-runtime 的关键前置，但不是全框架主链路 blocker**：dispatch privilege 主链路 v5 已通过。该任务应标为 question blueprint 的 P0，不能写成所有后续工作都被阻塞。
3. **SSEWatcherFd WSL2 问题仍在通用测试 harness**：`scripts/lib/sse-watcher.ts` 默认小文件走 `SSEWatcherFd + fstatSync(fd)`；question E2E 当前用 `new SSEWatcher(SSE_FILE, 0)` 强制 tail 绕过。它是可重复 E2E 的 P0/P1，不是 work-one runtime 逻辑 blocker。
4. **per-agent 检查层不是“12 处均待删”的同一状态**：`readDispatchAllowedTools` 已不存在；`isWriteAllowed` 仍有 `file-guard/audit.ts` 运行时 caller；`getAgentPermission/getAgentShellAllowlist` 仍影响 `safe_shell` allowlist；`PermissionIsolation` 已 deprecated 但仍有 test/export 链。应按 caller 替换，不应盲删。
5. **legacy dispatch validator 已隔离但未归档**：`dispatch-validate.ts` 与 `before/dispatch.ts` 不在 active before order，但仍 export/callable；移入 legacy 是 P1 quick win，不是主链路阻塞。
6. **Scout 只具备路由名基础，不具备 live runtime 完成证据**：`agent-target.ts` 包含 `scout`，但当前 `opencode.json.agent` 没有 `scout`，`.opencode/agents/` 也没有 dedicated `scout.md`；Scout 子 agent live runtime 仍是 P1。
7. **DB 表合并不应抢在 hot-path 统计前**：当前主 DB 45 张业务表 / 46 张含 `sqlite_sequence`，schema v34；表合并是 P1/P2 收尾，优先确认普通任务 DB touch 和 fallback 故障注入。
8. **MCP role filter 未接线属实**：`mcp-role-filter.ts` 没有被 `tool-def-trimmer.ts` 或其他 hook 调用；应 P1 决策“接入或显式废弃”。
9. **TodoWrite reconciliation hook 应显式不做**：`preflight-lite/FULL.md` 明确 `Do NOT sync TodoWrite to DB checklists or DAGs`；新增 reconciliation hook 会违背轻量化设计。

修正后的执行顺序：

| 优先级 | 工作项 | 修正后判断 |
|--------|--------|------------|
| P0 | SSEWatcherFd / tail fallback 稳定化 | 为可重复 runtime E2E 铺路；tail 绕过可用，但通用 watcher 默认仍有 WSL2 风险 |
| P0 | Question enforcement full-runtime closure | 目标是把 partial runtime 升级为 full runtime；需 controlled Phase-0 failure 或配置化 bypass |
| P0/P1 | per-agent runtime caller 替换 | 先替换 `isWriteAllowed`、`getAgentShellAllowlist` 活跃调用，再清 deprecated/test/export |
| P1 | legacy dispatch-validate 归档 | active order 不调用，属于低风险清债 |
| P1 | MCP role filter 接线/废弃 | 当前未生效，不能继续写成已落地能力 |
| P1/P2 | DB hot-path 统计后再合并表 | 不以“表数下降”为首要目标 |
| P1 | Scout live runtime | 需要真实 `Task` 派遣和 evidence bundle 回传 |
| P2 | weak-model 23 场景 runtime 回归 | 当前已有 G2/G5/G7 smoke，不急于高成本全矩阵 |
| P3/弃用 | TodoWrite DB/DAG reconciliation hook | 明确为 non-goal |

## 一、执行摘要

当前 work-one 框架不是“没有价值的形式主义”，也不是凭空过度设计。它是在弱遵从模型实际使用中逐步演化出来的防护系统：模型可能不读 Skill、不按要求执行、写错文件、写错代码、绕过重要步骤或编造状态，因此才需要 hard plugin hook、DB 审计和安全工具链来兜底。多 Agent、DB-canonical、硬约束、DAG/dispatch 路由都解决了真实问题：审计、追踪、权限边界、恢复、可观测性和弱模型纠偏。

问题不在于“有硬约束”，而在于这些能力被过度泛化到默认热路径后，带来了高耦合、低复用、调试困难、死锁风险和维护成本。重构目标应是重新分配职责，而不是回退到只靠 prompt/Skill 的脆弱路径。

本路线图不建议推翻重写，但建议明确转向：**不再把 10 个自定义 Agent 作为长期执行核心**。官方原生 Agent 由 OpenCode 官方反复验证并持续优化，长期稳定性、上下文组织和工具调用行为都更值得依赖。弱模型“不听话”的问题和使用自定义 Agent 还是官方 Agent 关系不大，真正需要治理的是工具写入边界、关键步骤证据和输出质量反馈。

推荐方向是将当前框架从“10 个自定义 Agent + 多层硬约束 + DB/DAG 默认热路径”重构为“官方原生 Agent 执行器 + Skill 能力层 + 少量 Plugin Hook 治理层 + QoderWork 指导控制面”的主流 Agent 框架形态：

1. **Official native-agent first**: 官方原生 Agent 作为标准执行器；现有 10 个自定义 Agent 名称只保留为短期兼容 alias，不再长期承载大量人设、流程和项目规则。
2. **Skill as capability**: 领域知识、流程模板、输出质量标准沉淀为细粒度 Skill，通过权限和触发条件组合给不同 Agent。
3. **Plugin Hook as thin governance**: Hook 只做机器可验证的横切治理：权限、安全、审计、关键 Skill 调用策略、质量信号和 QoderWork guidance 注入。
4. **QoderWork guidance bridge**: 保留 `question`/ACP/SSE/serve API 等桥接，让 QoderWork 能同步或异步指导弱模型纠偏。
5. **Single policy, typed outcomes**: 不再保留 `advisory/strict/locked` 全局模式；每条规则固定为 hard block、warn and continue、audit only 或 ask QoderWork。
6. **DAG optional**: `Task.DAG.json` 保留为大型任务规划/追踪资产，不作为普通 dispatch 的默认硬前置。
7. **Minimal state, not no state**: DB 不再作为流程控制中心，但保留 QoderWork bridge、resume、audit index、long task trace 等最小状态；普通审计优先 JSONL。
8. **Active clarification layer**: 更激进地组合 `brainstorming` Skill 与 QoderWork ACP，让弱模型在动手前暴露假设、开放问题和决策点，QoderWork 可主动追问和纠偏。

非目标：不把框架退化成“官方原生 Agent + 提示词自觉遵守”。对于 DeepSeek v4 flash 这类低成本/弱遵从模型，关键步骤仍必须有机器可验证的硬兜底。

核心取舍：**减少自定义 Agent 和流程状态机，保留少量 hard hook；减少默认关卡，增强 Skill 复用和可组合性；减少 DB 控制流，保留审计、恢复和 QoderWork 桥接状态。**

目标不是“少代码”本身，而是让框架在轻量、复用、高效、稳定、可靠、维护性、健壮性七个维度达到可持续状态。

---

## 二、事实校准

### 2.1 当前属实事实

| 项 | 当前事实 | 影响 |
|----|----------|------|
| 代码规模 | active `rg --files` 口径为 372 个 `.opencode` TS 文件、75,563 行；CodeGraph 口径为 419 files / 377 TS / 30 JS / 12 YAML | 框架维护成本已经接近独立产品，且指标必须同时记录采样命令 |
| Agent | `opencode.json.agent` 为 Orchestrator/build/general/plan/explore；实质自定义 prompt 只保留 Orchestrator；active `.opencode/agents/` 只有 `Orchestrator.md`，9 个旧角色在 legacy profile | 角色边界已物理收敛，长期不应继续作为执行核心 |
| Skill | 当前 `.opencode/skills/**/SKILL.md` 为 18 个，Agent 已有 `skills:` 且 `permission.skill=allow` | “完全不用 Skill”已过时，但 Skill 化仍不充分 |
| Plugin | 5 个 plugin 入口，active order 为 11 before + 7 after + 2 system；`task` handler 仅处理 Task marker/canonical prompt；`path-validate`、`tool-governance` 已进入 before 链；`plugin-handlers/` 下仍有 legacy/available TS 文件 | active 热路径已收敛，但目录文件数、配置 order 与按工具过滤后的实际执行数不能混用 |
| MCP | `opencode.json` 配置 12 个 enabled MCP server，其中约 6 个框架/本地自定义 | “6 个活跃 MCP”只能指自定义类，不能指全部 |
| DB | schema v37，当前主 DB 49 张业务表 / 50 张含 `sqlite_sequence` | DB-canonical 成立，表数会随迁移漂移，当前权威源仍是 `.opencode/state/framework-state.db` |
| DAG | `Task.DAG.json` 约 156 KB | 是规划资产，但当前 `require_dag_entry=false`，已不是默认硬强制 |
| Guidance | `question` 已被加入 passthrough，且 question/reply/recovery/guidance 已有 runtime smoke | “question 被 Phase-0 阻断”是历史问题；Phase 5 已归档 full-runtime 证据，剩余是文档口径与长期维护问题 |
| Brainstorming | `brainstorming` Skill 已存在，FULL 文档要求先收集上下文、提出最少澄清问题、输出假设/开放问题/决策点 | 适合作为弱模型主动澄清能力的轻量底座 |

### 2.2 需要纠正的历史叙述

1. 不再说“框架完全不用 Skill”。当前准确说法是：**已经开始注册 Skill，但大量规则仍常驻在 Agent prompt 和 TS handler 中，Skill-first 迁移未完成**。
2. 不再说“DAG 每次 dispatch 强制前置”。当前准确说法是：**DAG 体系仍存在，auto_plan 仍存在，但默认策略已切到 `require_dag_entry=false` 的 native-compatible 观察状态**。
3. 不再说“Guidance Gate 当前不可恢复死锁”。当前准确说法是：**历史死锁已通过 question passthrough 缓解，但多层硬约束仍有层间冲突风险**。
4. 不再把源码中的 `CREATE TABLE` 数量当作运行时表数量。运行时以实际 SQLite schema 为准。
5. 不再把“自定义 Agent 更多、更细”视为可靠性来源。当前准确说法是：**弱模型质量问题主要来自模型遵从性和证据缺失，不会因为自定义 Agent 名称更多而根治**。
6. 不再说“当前有 19 个 Skill”。当前可见事实是：**`.opencode/skills/**/SKILL.md` 为 18 个**。
7. 不再把 `experimental.chat.system.transform` 视为稳定核心 Hook。当前 work-one 确实使用它做 system prompt 注入，但它应作为增强通道；稳定基础仍是 `tool.execute.*`、`permission.*`、`session.*`、`message.*` 和 Skill 本身。

### 2.3 设计动因校准：弱模型不遵从

当前框架复杂度有明确来源：

1. 弱模型经常不执行明确要求。
2. 弱模型经常不主动读取或遵守 Skill。
3. 弱模型可能写错文件、改错位置、误判权限边界。
4. 弱模型可能生成看似合理但实际错误的代码。
5. 弱模型可能声称已完成某步骤，但没有可验证证据。
6. 弱模型在被拒绝后可能继续尝试绕过，而不是按恢复路径执行。

因此，重构不能把所有约束降级为“提醒”。正确方向是：

| 风险 | 不能只靠 | 必须保留 |
|------|----------|----------|
| 写错文件 | Skill 文档 | path scope hard block, safe tool |
| 跳过 CodeGraph | prompt 要求 | source edit before-hook hard block |
| 不读关键 Skill | 自觉遵守 | risk-based `skill_read_attest` |
| 编造完成状态 | final answer | audit event, deliverable contract |
| 绕过 guidance | 口头说明 | question-first gate, allowed tool list |
| 反复低质量输出 | 模型自省 | warning threshold + QoderWork review |

这意味着“轻量化”不是取消硬约束，而是把硬约束收敛到机器可验证、风险高、后果不可逆的节点。

### 2.4 设计转向：Orchestrator + 原生 Agent + Skill + 行为型 Hook

本轮调查和讨论后的核心转向：

1. **Orchestrator 是唯一需要自定义身份的 agent**：它需要 dispatch 权限、session 管理、QoderWork bridge、compliance gate 等框架级能力。其他所有角色都是"原生执行引擎 + Skill 注入行为"。
2. **官方原生 Agent 是默认执行器**：Plan/Build/General/Explore/Scout 负责实际执行，不再继续强化自定义 Agent prompt。"你是谁、做什么"内聚到 Skill 中，不由自定义 agent 定义。
3. **Skill 是主要复用单元**：领域知识、角色行为、流程规范、输出标准全部沉淀为 Skill，通过权限和触发条件组合给不同原生 agent。新增能力优先新增 Skill。
4. **行为型 Enforcement**：Hook 不再问"agent X 被允许用 tool Y 吗"，而是问"tool Y 在 path Z 上安全吗"。安全约束（备份、路径保护、CodeGraph）是全局的，跟谁在执行无关。per-agent 检查层（tool 白名单、permission reader、config attestation）按 current caller 替换后删除，不能盲删活跃调用链。
5. **DB 是审计和恢复底座**，不是所有流程的实时控制中心。
6. **QoderWork 是弱模型纠偏和复杂决策通道**，不是默认任务执行依赖。
7. **框架维护权限是行为型治理的受控例外**：普通写入继续按工具+路径+操作判断；`.opencode/**` 等框架维护写入必须由 Orchestrator 在一次 dispatch 中创建短 TTL `dispatch_privilege`，并绑定到具体 child session、allowed paths 和 allowed tools。该 grant 只解决临时写权限，不得绕过 CodeGraph impact。

设计判断：弱模型的问题不能靠“更多自定义 Agent”解决。更可持续的组合是官方原生 Agent 的稳定执行能力，加上短小 Skill 的结构化指导，再加少量 Hook 的强制边界。

### 2.4a Skill 注入边界

弱模型不主动调用 Skill 是真实风险，但不应因此把匹配到的 Skill 全文无条件注入 system prompt。

目标策略：

1. 默认注入短摘要、步骤卡片或关键禁令，不注入全文。
2. 高风险任务才要求 `skill_read_attest` 或等价证据。
3. Skill 全文读取仍优先通过原生 `skill` 工具完成。
4. `experimental.chat.system.transform` 可用于注入 guidance 或 Skill 摘要，但不是唯一依赖。
5. 关键词匹配必须可观测，记录命中的 Skill、原因和 token 估算。
6. 匹配不确定时宁可注入“建议读取某 Skill”的短提示，不直接塞入长文。
7. 被频繁误匹配的 Skill 应拆小或调整触发规则，而不是增加更多 Hook 分支。

### 2.4b 主动澄清层：Brainstorming + QoderWork ACP

弱模型经常不会主动提问，也不知道该问什么。单靠“必要时问用户”这类提示不够稳定，应把澄清能力做成可触发、可观察、可预算的轻量层。

设计目标：

1. 普通任务使用微型 `brainstorming` 卡片，不进入长流程。
2. 复杂任务使用完整 `brainstorming` Skill。
3. QoderWork ACP 观察 Agent 是否跳过澄清、是否把假设当事实、是否目标未清就开始写代码。
4. ACP 可主动注入追问或纠偏 guidance，而不是等待弱模型自己发现问题。
5. 澄清层只提高质量下限，不成为每个任务的新 gate。

微型 `brainstorming` 卡片建议控制在 100-300 token：

```text
Before acting, answer internally:
1. Goal clear?
2. Scope/files clear?
3. Success criteria clear?
4. Risk level: low / normal / high?
5. Need to ask QoderWork?
If not asking, state assumptions briefly.
```

完整 `brainstorming` 触发条件：

1. 用户需求含糊或目标不完整。
2. 架构、重构、方案设计、迁移、权限、DB、框架核心修改。
3. 多文件、多模块、多 Agent 或跨 session 长任务。
4. 模型连续失败、重复低质量修复、测试/证据缺失。
5. QoderWork ACP 观察到模型跳过关键澄清。

提问预算：

| 任务类型 | 默认行为 | 提问预算 |
|----------|----------|----------|
| 小修复/明确问题 | 微型卡片，直接执行 | 0-1 个问题 |
| 中等复杂任务 | 列 assumptions/open questions | 1-3 个问题 |
| 高风险任务 | 完整 brainstorming + QoderWork 确认或显式假设 | 直到关键决策清楚 |
| 用户要求速度 | 不阻塞，写明假设继续 | 0-1 个问题 |

边界：

1. 不把完整 `brainstorming/FULL.md` 常驻注入。
2. 不要求每个任务必须问问题；允许“不问但列假设”。
3. 不让 ACP 变成逐步审批，只用于主动纠偏和关键决策。
4. 不用 brainstorming 替代 CodeGraph、scope、backup 等硬边界。

### 2.5 原生 Agent 与 alias_of 调查结论（2026-07-05 源码验证）

基于 OpenCode 官方源码（`packages/opencode/src/agent/agent.ts`）、官方 JSON Schema（`https://opencode.ai/config.json`）和 work-one 实际运行验证，确认以下事实：

**原生 Agent 体系**：OpenCode 内置 7 个原生 agent，全部标记 `native: true`：

| Agent | Mode | 权限特征 |
|-------|------|----------|
| build | primary | 全工具开放，默认主代理 |
| plan | primary | edit 全局 deny，仅允许 plan 文件 |
| general | subagent | 全工具开放（todowrite 除外），可修改文件 |
| explore | subagent | 仅 grep/glob/bash/read/web，其余 deny |
| compaction | primary (hidden) | 全工具 deny，专用压缩 |
| title | primary (hidden) | 全工具 deny，生成标题 |
| summary | primary (hidden) | 全工具 deny，生成摘要 |

注意：`scout` 在部分文档中提及但当前源码未实现为内置 agent。

**`alias_of` 字段不存在**：OpenCode 官方 JSON Schema 和源码均不支持 `alias_of`、`aliasOf`、`extends`、`inherits` 等继承/别名字段。当前 work-one Agent .md 文件中写的 `alias_of` 是框架自定义 metadata，OpenCode runtime 完全不读取它。ConfigAgentV1.Info 的 normalize 函数会将未知字段（如 `alias_of`）归入 `options` dict，不会丢弃但也不会消费。

**`native` 字段是只写不读**：`native: true` 在 `agent.ts` 中被设置在所有内置 agent 上，自定义 agent 被设为 `native: false`。但全代码库搜索确认：没有任何代码路径读取 `native` 字段来改变行为。它是一个纯标记字段，不影响权限、工具访问、派遣或 session 创建。

**Config hook 不可靠**：`config` hook 在 plugin/index.ts 中存在（`hook.config?.(cfg)`），但官方文档未列出。其返回值被 `Effect.ignore` 丢弃，只能通过 mutate cfg 对象生效。cfg 来自 `config.get()`，在 Effect.js 架构下无法确认返回的是共享引用还是防御性拷贝。Config hook 在 Plugin Service init 时触发，与 Agent Service 无直接 Layer 依赖关系，时序不确定。

**框架 enforcement 对原生 agent 的阻断链**：当 Orchestrator 通过 Task 派遣 `agent="general"` 的子 session 时，框架 enforcement 层三层阻断：

1. `readDispatchAllowedTools("general")` 在 `project.config.json` 的 `agent_dispatch_allowed_tools` 中找不到 "general" → 走 FALLBACK 列表（不含 write/safe_edit/bash）
2. `isWriteAllowed("general", path)` → `getAgentPermission("general")` 在 opencode.json 中找不到 "general" → 返回 null → strict 模式 deny-all
3. `config-read-attest` 门禁 → "general" 没有 .opencode/agents/General.md 可读 → 阻断

结论：**`alias_of` 作为桥接机制不可行**。框架 enforcement 层必须从"身份绑定型"转为"行为型"，不再依赖 agent 身份做权限判断。

### 2.6 单一执行策略：取消 advisory/strict/locked 模式

后续框架不应再存在 `advisory`、`strict`、`locked` 这类全局运行模式。模式矩阵会带来三类问题：

1. Agent 和 Hook 需要判断当前处于什么模式，增加分支和 bug 面。
2. 同一规则在不同模式下行为不同，调试时难以复现。
3. 弱模型容易被“模式说明”干扰，反而更难稳定遵从。

目标策略：

| 规则处置 | 行为 | 适用场景 |
|----------|------|----------|
| `hard_block` | 阻断并给出唯一下一步 | 安全、权限、不可逆写入、备份、CodeGraph |
| `warn_and_continue` | 记录警告，允许继续 | 测试缺失、输出格式轻微不完整、推荐 Skill 未读 |
| `audit_only` | 只记录，不打断 | route suggestion、统计、低风险质量信号 |
| `ask_qoderwork` | 要求或建议调用 `question` | 连续失败、业务决策、不确定是否越权 |

是否阻断由“规则类型”决定，不由“当前模式”决定。任何规则如果需要不同强度，应拆成不同规则，而不是依赖全局模式切换。

---

## 三、目标架构

### 3.1 分层目标

```
User / QoderWork
  |
  v
Orchestrator (唯一自定义 agent, primary): dispatch / QoderWork bridge / compliance gate
  |
  +-- Task --> general  + Coder-Skill / Architect-Skill / Arbiter-Skill
  +-- Task --> explore  + Review-Skill / Knowledge-Skill
  +-- Task --> build    + Build-Skill / CI-CD-Skill
  +-- Task --> plan     + Planning-Skill
  +-- Task --> scout    + Research-Skill
  |
  v
Active Clarification Layer: micro brainstorming card / full brainstorming / ACP intervention
  |
  v
Skill Layer: domain workflow, coding standards, review checklists, ops SOP (角色行为内聚于此)
  |
  v
Plugin Hook Governance (行为型, 不依赖 agent 身份): safety, backup, path protection, CodeGraph, audit
  |
  v
Execution Layer: official task / safe tools
  |
  v
Minimal canonical state: audit, session trace, backups, long-running dispatch
```

关键变化：Legacy Compatibility Aliases 层不再独立存在。旧 10 个自定义 agent 的角色行为全部内聚到 Skill 中。Orchestrator 作为唯一自定义 agent 负责编排和桥接，通过原生 Task 派遣不同原生 agent + Skill 组合。

### 3.2 七维度目标

| 维度 | 当前问题 | 目标 |
|------|----------|------|
| 轻量 | 所有任务进入多层 handler + DB + checklist | 普通任务默认只过安全核心链 |
| 复用 | 领域知识绑定 Agent prompt 和 project.config | 领域知识 Skill 化，可跨 Agent 组合 |
| 高效 | tool hot path DB 读写多、handler 多 | 写工具只做必要安全检查和审计 |
| 稳定 | 多层解析、fallback、豁免交互复杂 | 单一路径优先，fallback 必须可观测 |
| 可靠 | DB-canonical 覆盖过宽，迁移多 | DB 保留关键状态，不承担所有临时流程 |
| 维护性 | 自定义 Agent prompt、配置、handler 重复表达规则 | 规则进入 Skill 或单源 Hook，Agent 尽量原生 |
| 健壮性 | 约束互相阻断、需要额外豁免 | fail-closed 只用于安全，流程问题 fail-open with audit |

### 3.3 主流范式目标

| 层 | 目标职责 | 不该承担 |
|----|----------|----------|
| 官方原生 Agent | 标准化执行、探索、规划、调研、编码 | 项目专属长提示词、硬编码业务规则 |
| Orchestrator (唯一自定义) | 编排、dispatch、QoderWork bridge、compliance gate | 领域知识、角色行为、编码规范 |
| Skill | 可复用工作流、领域知识、输出模板、弱模型步骤脚手架 | 运行时权限判断、文件系统安全拦截 |
| Plugin Hook (行为型) | 安全边界、备份检查、路径保护、CodeGraph、审计、质量信号 — 不依赖 agent 身份 | 大段业务流程、人设、per-agent 权限矩阵、Agent 路由迷宫 |
| DB | 审计、恢复、长任务追踪、桥接状态 | 所有临时流程状态、每次工具调用的非必要判断 |
| QoderWork ACP Bridge | 人类/强模型指导、弱模型纠偏、主动追问、跨会话监督 | 替代 Agent 自主执行、承担所有正常控制流、逐步审批 |
| Brainstorming | 需求澄清、假设暴露、开放问题、方案比较 | 每个任务强制长流程、替代硬安全边界 |

### 3.4 弱模型质量保障策略

弱模型质量不能靠堆硬约束解决，应采用“结构化 Skill + 可观测 Hook + QoderWork 纠偏”的组合：

1. **Skill 提供步骤脚手架**：每个复杂任务 Skill 必须包含输入检查、执行步骤、输出格式、常见失败和自检清单。
2. **Hook 提供机器可验证信号**：检测是否读了必要 Skill、是否越权、是否跳过关键证据、是否输出了必需 artifact。
3. **QoderWork 提供指导闭环**：当 Hook 发现重复失败、低质量输出或不确定决策时，通过 `question` 或 ACP bridge 请求指导。
4. **硬约束只兜底**：只有安全、权限、不可逆写入、桥接死锁风险 hard block；其他质量问题进入 warn/audit 或 QoderWork review。
5. **输出模板强制结构，不强制路径**：弱模型必须按模板交付，但允许选择实现路径，避免为了满足流程而空转。

补充原则：弱模型“不听话”的问题不能只用更多自然语言解决。凡是能被机器验证的关键步骤，应优先进入 Hook 或 safe tool；凡是只能由人判断的质量问题，才进入 QoderWork guidance；凡是纯经验性流程，才放进 Skill。

### 3.5 默认执行路径

普通任务的默认路径应尽量短：

```
User / QoderWork request
  -> official native Agent
  -> micro brainstorming card
  -> select relevant Skill when needed
  -> thin before-hook safety checks
  -> safe tool execution
  -> thin after-hook audit / quality signal
  -> final answer with evidence
```

不应默认进入：

1. DAG 创建和校验。
2. checklist 状态机。
3. 多轮 route validator。
4. 全局 initial read gate。
5. 多表 DB 状态同步。
6. 自定义 Agent prompt 长流程解释。

只有大型任务、高风险写入、框架核心修改、跨 session 长任务、弱模型连续失败时，才启用完整 brainstorming、额外 trace、规划 artifact 或 QoderWork guidance；这不是全局模式切换，而是任务局部能力。

---

## 四、重构原则

### 4.1 保留原则

保留以下能力，因为它们有明确工程价值：

1. `safe_edit` / `safe_delete` / `safe_restore` / `safe_shell` 的安全包装。
2. 关键文件写入作用域检查。
3. CodeGraph 对源码修改前的影响分析要求。
4. 备份与 `backup_log`。
5. 基础审计日志和 session trace。
6. `question` 作为同步 QoderWork 指导通道。
7. ACP/SSE/serve API 作为 QoderWork 异步观察、恢复和跨会话指导桥接。
8. `dispatch_queue` 对长任务、恢复和 ACP 桥接的追踪能力。
9. `skill_read_attest` 作为高风险任务的 Skill 读取认证，而非所有任务的固定阻断。

### 4.1a QoderWork 桥接保留边界

QoderWork 桥接是本次重构的保留核心，不应被“去复杂化”误删。桥接职责如下：

| 桥接能力 | 保留原因 | 目标形态 |
|----------|----------|----------|
| `question` | 同步阻塞、LLM 遵从性最高、适合弱模型求助 | 所有 Agent 在 guidance 状态下必须可用 |
| ACP stream | QoderWork 观察 Agent 推理/输出、支持多轮指导 | 作为实时监督、主动追问和调试通道 |
| serve API / prompt_async | 必要时向指定 session 注入恢复指令 | 作为 break-glass 级纠偏通道 |
| DB guidance state | 保存 guidance_text、failure state、恢复状态 | 只保留 guidance 必需字段，避免泛化成全流程 DB 控制 |
| brainstorming signal | 暴露假设、开放问题、关键决策 | QoderWork 可据此判断是否需要追问 |

### 4.2 非阻断原则

以下规则默认应从 hard block 改为 `warn_and_continue` 或 `audit_only`：

1. TDD 顺序强制。
2. checklist 阶段推进。
3. dispatch 路由建议。
4. deliverable 完整性非关键项。
5. JSON 格式校验中非破坏性修改。
6. DB health 和 compaction 告警。

改为非阻断后仍记录审计事件，但不阻断 Agent 继续工作。这里不是运行模式变化，而是规则处置固定变化。

### 4.3 移除原则

满足以下条件才移除模块或表：

1. 当前无运行时调用方。
2. 已有等价数据源。
3. 回滚路径明确。
4. 至少一轮 shadow logging 证明无实际依赖。

禁止第一阶段一次性删除 DB-canonical、DAG、Agent 兼容名称或所有 hard enforcement。长期可以删除复杂自定义 Agent 行为，但必须先完成 alias、Skill、权限和审计兼容。

### 4.4 硬约束分级

| 等级 | 类型 | 行为 | 示例 |
|------|------|------|------|
| L0 | 不可逆安全风险 | hard block | 原生 bash/edit、越权写入、危险 shell、无备份写入 |
| L1 | 桥接和恢复生命线 | hard allow / hard block | guidance 中必须允许 question；禁止其他工具绕过 gate |
| L2 | 高风险质量门 | conditional block | 修改框架核心、迁移 DB、删除文件、改权限配置 |
| L3 | 普通质量流程 | warn/audit | TDD 顺序、checklist phase、route mismatch、deliverable 格式 |
| L4 | 学习与提示 | Skill guidance | 输出模板、自检清单、最佳实践、弱模型步骤 |

### 4.5 约束保留红线

以下约束不应在本轮重构中删除，只能简化实现或改善错误提示：

1. 所有文件写入必须走 safe tool。
2. 源码修改前必须有 CodeGraph 影响分析。
3. 写入范围必须由工具或 Hook 强制验证。
4. 高风险 Skill 必须有读取认证或等价证据。
5. backup/restore 链路不能改为非阻断警告。
6. guidance active 时 `question` 必须可用，其他工具是否可用由 gate 决定。
7. Agent final claim 必须能被 audit、artifact 或测试证据支撑。

可以降级的是“流程顺序”和“推荐做法”，不能降级的是“安全边界”和“可验证事实”。

---

## 五、分阶段方案

## Phase 0: 基线冻结与事实修正

**目标**: 先防止后续重构建立在过时叙述上。

**改动范围**:
- `documents/review/opencode-framework-architecture-assessment.md`
- `documents/opencode-framework/*.md`
- `blueprints/*.md`

**任务**:
1. 更新评估文档中的当前事实：
   - plugin handler: active order 为 `10 before + 7 after + 2 system`，其中 `task` 只处理 Task marker，`tool-governance` 已接入 before 链；legacy handler 文件不等于热路径
   - MCP: `12 enabled, 约 6 个框架/本地自定义`
   - DB: live 主 DB为 `49 business tables / 50 including sqlite_sequence, schema v37`
   - Skill: Agent 已注册 skills，不再为空
   - DAG: `require_dag_entry=false`
   - question: 已在 guidance/phase0/checklist 路径放行
2. 建立 `framework-metrics.md`，固定每次重构前后的指标：
   - TS 文件数和行数
   - handler 数量
   - DB 表数
   - Agent prompt 行数
   - Skill 数量和平均行数
   - 一次 `safe_edit` 实际经过的 handler 数
3. 将 CodeGraph 作为重构前置检查写入每个后续任务。

**验收标准**:
- 文档不再引用 “skills 全空” 等历史事实。
- 后续 blueprint 均以同一组指标为基线。

---

## Phase 1: Skill-First 能力层重构

**目标**: 把常驻自定义 Agent prompt 中的重复流程知识迁移到 Skill，形成可组合、可复用、可审计的能力层，同时给弱模型提供明确步骤脚手架。官方原生 Agent 负责执行，Skill 负责项目能力。

**当前问题**:
- Agent 已有 `skills:`，但 Agent `.md` 仍包含大量流程规范、配置读取规则、dispatch protocol、合规规则。
- 同一规则在多个 Agent prompt、`project.config.json`、plugin handler 中重复出现。

**任务**:
1. 建立 Skill 分类和命名规范：
   - `workflow-*`: 多步骤流程，如 dispatch、review、release、debug
   - `domain-*`: 领域知识，如 backend、frontend、ci、knowledge
   - `quality-*`: 输出质量和验收标准，如 tests、handover、evidence
   - `safety-*`: 高风险操作 SOP，如 db-migration、permission-change
2. 新增或重构 Skill：
   - `framework-execution-preflight`
   - `framework-dispatch-protocol`
   - `framework-codegraph-first`
   - `framework-deliverable-contract`
   - `framework-review-and-arbitration`
   - `backend-implementation`
   - `frontend-implementation`
   - `cicd-operations`
3. 每个 Skill 必须包含弱模型友好的固定结构：
   - When to use
   - Inputs required
   - Step-by-step procedure
   - Forbidden shortcuts
   - Output contract
   - Self-check before final
   - When to ask QoderWork via `question`
   - Assumptions / open questions if proceeding without asking
4. Agent prompt 退役：
   - Orchestrator / Coder-BE / Coder-FE / Guardian / Arbiter 等自定义 Agent 文件逐步变为 alias manifest。
   - 旧 Agent 只保留兼容名称、默认 Skill bundle、权限摘要和 QoderWork bridge 触发条件。
   - 具体执行流程、编码规范、审查清单、交付模板迁移到 Skill。
   - 不再新增长篇自定义 Agent prompt 来解决弱模型问题。
5. Plugin Hook 增加 Skill governance：
   - `tool.execute.before` 对高风险 Skill 做白名单和 Agent 级权限检查。
   - `tool.execute.after` 记录 Skill 调用审计。
   - `session.*` 或 message hook 记录每个会话实际加载了哪些 Skill。
   - 可选 system transform 只注入 Skill 摘要或步骤卡，不默认注入全文。
6. `required_skill_reads` 从“全局固定 2 个”改为按任务/Agent/风险等级计算。
7. 保留 `skill_read_attest`，但只认证真正需要的 Skill，不把所有任务都拉入同一套 initial_read。
8. 将 QoderWork guidance 写进 Skill 输出契约：
   - 遇到三次同类失败必须 `question`。
   - 不确定是否越权必须 `question`。
   - 需要业务决策必须 `question`。
   - 不能用猜测替代用户/QoderWork 决策。
9. 将 `brainstorming` 拆成两级使用：
   - 微型卡片：默认摘要注入，普通任务只做内部自检。
   - 完整 Skill：复杂/高风险任务读取全文，输出假设、开放问题、候选方案和推荐路径。
10. ACP 侧记录 clarification signals：
   - 是否有 assumptions。
   - 是否有 open questions。
   - 是否明确 success criteria。
   - 是否在目标不清时直接动手。

**验收指标**:
- 每个 Agent `.md` 正文目标小于 180 行；Orchestrator 小于 250 行。
- 70% 以上重复流程规则迁移至 Skill。
- Agent `skills:` 仍显式注册，但不再把 Skill 内容复制进 Agent prompt。
- 新增能力不再新增自定义 Agent，默认新增 Skill。
- initial_read 阶段必读内容减少 40% 以上。
- 每个高风险 Skill 均有 Output contract 和 Self-check。
- Skill 调用审计能回答：哪个 Agent、哪个 session、何时加载了哪个 Skill。
- Skill 自动匹配能回答：为什么命中、注入了摘要还是全文、估算消耗多少 token。
- brainstorming 能回答：模型是否识别了目标、范围、成功标准、假设和需要 QoderWork 的问题。

**风险与回滚**:
- 风险：Agent 忘记调用 Skill。
- 缓解：保留 `<available_skills>` 可见性 + `skill_read_attest` 只对高风险任务强制。
- 回滚：恢复原 Agent prompt，不影响工具层。

---

## Phase 2: Official Native Agent 替换与 Dispatch/DAG 解耦

**目标**: 让官方原生 Agent 成为默认执行器，Orchestrator 作为唯一自定义 agent 负责编排和桥接，DAG 成为可选规划资产。旧 9 个自定义 Agent 的角色行为全部迁移到 Skill。

**调查结论（2026-07-05 源码验证）**:
- OpenCode 内置 7 个原生 agent（build/plan/general/explore/compaction/title/summary），全部 `native: true`。
- `alias_of` 字段在 OpenCode 官方 schema 和源码中**不存在**。当前 Agent .md 中的 `alias_of` 是框架自定义 metadata，OpenCode runtime 不读取。
- `native` 字段是**只写不读**的标记字段，全代码库无任何逻辑消费它。
- Config hook 返回值被 `Effect.ignore` 丢弃，时序不确定，不适合做 agent 桥接。
- 框架 enforcement 层因不认识 "general" 等原生 agent 身份，三层阻断所有写操作。
- `dispatch_policy.require_dag_entry=false` 已经是当前配置。
- `router.ts` 仍保留 Layer 2 DAG 检查，当策略重新打开时会硬阻断。
- L0-L4 route validator 仍可能在 dispatch before-hook 中执行。

**任务**:
1. 明确 official native replacement mapping：

| 当前自定义身份 | 目标官方原生执行器 | 保留内容 | 迁移内容 |
|----------------|----------------------|----------|----------|
| Orchestrator | Plan / task coordinator 等价原生能力 | alias, dispatch metadata | coordination Skill |
| Meta-Planner | Plan 等价原生能力 | alias | planning Skill |
| Architect | General / Plan 等价原生能力 | alias | architecture Skill |
| Coder-BE | Build / General 等价原生能力 | alias, backend scope | backend Skill |
| Coder-FE | Build / General 等价原生能力 | alias, frontend scope | frontend Skill |
| Guardian | Review / Explore / readonly 等价原生能力 | alias, readonly scope | review Skill |
| Arbiter | Review / Plan 等价原生能力 | alias, waiver permission | arbitration Skill |
| CI-CD-Agent | Build / General 等价原生能力 | alias, ops scope | cicd Skill |
| Knowledge-Curator | Explore / Scout 等价原生能力 | alias, read/source policy | knowledge Skill |
| Super-Admin | Framework-maintenance Build 等价原生能力 | legacy alias, dispatch_privilege metadata | framework-repair Skill |

说明：表中的 Plan/Build/General/Explore/Scout 表示官方原生 Agent 能力类别或当前 OpenCode 版本中的等价能力。实际落地以当前官方 OpenCode 支持的原生 Agent/Task 能力为准，不再为项目自建等价执行器。

2. dispatch 保持单一路径，附加能力按输入启用：

| 输入/条件 | 附加能力 | 行为 |
|----------|----------|------|
| 无 `dag_task_id` | 无额外规划要求 | 直接 dispatch，不要求 DAG |
| 提供 `dag_task_id` | trace/resume | 写 session trace 和 dispatch_queue |
| 未提供 `dag_task_id` 但走 framework dispatch | canonical tracking UUID | `router.ts` 生成 `effectiveDagTaskId`，并写入 queue/events/synthetic session_map |
| 用户明确要求大型规划 | planning artifact | 生成或校验 DAG artifact |
| 框架核心高风险任务 | risk evidence | 记录更多审计和 Skill 认证 |

3. 旧 Agent route validator 从 hard block 改为 native executor suggestion：
   - 写 `ROUTE-SUGGESTION` 日志。
   - 只有安全越权时阻断。
   - 原生执行器选择与建议不一致时要求解释，不直接中断。
4. `auto_plan` 默认关闭，仅用户明确要求规划、任务规模较大或 Plan 类原生执行器明确请求时启用。
5. `Task.DAG.json` 从全局状态文件转为规划 artifact：
   - 大型任务使用。
   - 小型修复不要求。
   - 不再作为所有 Agent 派发的合法性来源。
6. `dispatch_queue` 只用于：
   - resume
   - ACP bridge
   - 长任务追踪
   - 子会话 payload integrity
   - framework maintenance grant 的 canonical prompt / queue lease / child binding
7. 为 QoderWork 保留可观测 dispatch metadata：
   - parent session
   - child session
   - selected official native executor
   - legacy alias if any
   - loaded Skill list
   - route suggestion
   - guidance status

**验收指标**:
- 无 `dag_task_id` 的简单 dispatch 在默认策略下可运行。
- framework maintenance compat path 使用 canonical `dag_task_id`，`dispatch_queue`、synthetic `session_map`、`session_events` 三表一致。
- L0-L4 route mismatch 默认不 hard block。
- `auto_plan` 不再对普通 bugfix 造成最长 120s 等待。
- `Task.DAG.json` 体积增长停止，新增任务必须有明确大型规划理由。
- 10 个兼容 Agent 名称均能映射到官方原生执行器 + Skill 组合。
- 普通任务可以完全绕过自定义 Agent prompt。
- QoderWork 能从 bridge metadata 看出任务由哪个官方原生执行器执行。

**风险与回滚**:
- 风险：原生执行器选择不符合旧角色预期。
- 缓解：保留权限矩阵和 safe_edit scope；真正越权仍阻断。
- 回滚：临时恢复旧 alias prompt 或将 route suggestion 切回 block。

---

## Phase 3: Enforcement 热路径瘦身

**目标**: 把硬约束从“全流程治理”收缩为“安全核心”，让 Plugin Hook 成为轻量治理层，而不是流程状态机；同时用质量信号 Hook 和 QoderWork guidance 提升弱模型质量。

### 3.1 从身份绑定型到行为型 Enforcement

**核心转变**：enforcement 从"agent X 被允许用 tool Y 吗"转为"tool Y 在 path Z 上安全吗"。安全约束是全局的，跟谁在执行无关。

**per-agent 检查层替换/删除状态**：

| 检查 | 当前状态 | 替代 |
|------|----------|------|
| `readDispatchAllowedTools(agent)` | symbol 已无 | 保持删除，清 stale 引用 |
| `isWriteAllowed(agent, path)` | 仍有 write audit runtime caller | 全局工具+路径+操作检查 |
| `isPathAllowedForAgent()` / `getAgentPermission()` | 仍被 permission reader 内部使用 | 迁移到非旧角色身份语义 |
| `getAgentShellAllowlist()` | 仍影响 `safe_shell` allowlist | 全局 shell policy / opencode permission |
| `config-read-attest` per-agent 叙事 | 文档/测试仍需清理 | 风险触发 attestation |
| `permission/isolation.ts` per-agent profiles | deprecated/test/export 链仍在 | 通过完整 test suite 后删除或移 legacy |

**保留的行为型 hard block（不依赖 agent 身份）**：

1. 原生 `edit/bash` 禁用（所有 session 一致）。
2. `safe_shell` 危险命令和写入绕过（所有 session 一致）。
3. 路径保护：`.git/**`、`node_modules/**`、`.opencode/state/*.db` 全局禁止写入。
4. 框架关键配置文件修改需 explicit approval（不区分谁在改）。
5. 源码修改前未完成 CodeGraph 影响分析（所有 session 一致）。
6. 备份/恢复链路异常导致不可逆写入风险（所有 session 一致）。
7. Guidance 中 `question` / `clear_guidance` 以外工具在 gate active 时的阻断。

**保留的 audit_only / warn_continue（不依赖 agent 身份）**：

1. route mismatch -> audit only（不区分谁在写）。
2. checklist/TDD 顺序 -> warn continue。
3. TodoWrite 状态 -> warn continue。
4. 推荐 Skill 未加载 -> warn continue + QoderWork 可观察。

**enforcement 热路径变化**：`scope-validate.ts` 已转向行为型路径/操作判断，但 per-agent 清理尚未完全结束。当前 `readDispatchAllowedTools` 已不存在；`isWriteAllowed` 仍通过 write audit 有运行时 caller；`getAgentPermission/getAgentShellAllowlist` 仍影响 shell allowlist；`config-read-attest` 相关 per-agent 叙事仍需继续收口。后续必须按 caller 替换，而不是假设所有检查层已经物理删除。

1. 原生 `edit/bash` 禁用。
2. `safe_shell` 危险命令和写入绕过。
3. 写入路径越权。
4. 框架关键配置被非授权 Agent 修改。
5. 源码修改前未完成 CodeGraph 影响分析。
6. 备份/恢复链路异常导致不可逆写入风险。
7. Guidance 中 `question` / `clear_guidance` 以外工具在 gate active 时的阻断。

### 3.2 非阻断质量信号

以下规则固定为 `warn_and_continue` 或 `audit_only`：

1. checklist phase 未完成。
2. TDD 顺序不满足。
3. route suggestion 与实际执行器不一致。
4. deliverable 格式不完整。
5. JSON 非关键文件格式风险。
6. DB health warning。
7. 未加载推荐 Skill。
8. 输出缺少 evidence / handover / test report。
9. 弱模型重复使用低质量修复套路。

非阻断信号不应静默。每条信号必须写入结构化日志，并在必要时触发 QoderWork guidance：

| 信号类型 | 默认行为 | 升级条件 |
|---------------|----------|----------|
| missing recommended skill | 提醒 + 记录 | 同类任务 2 次未加载则 `question` |
| incomplete output contract | 要求自修正 | 自修正失败则 `question` |
| route mismatch | 记录建议 | 涉及越权路径则 hard block |
| test missing | 记录风险 | 修改核心业务且无测试则 QoderWork review |

### 3.3 Handler 收敛

目标执行链：

| 当前 | 目标 |
|------|------|
| 14 before handler | 6-8 before handler |
| 13 after handler | 5-7 after handler |
| 多处白名单 | `enforcement_exemptions` 单源 |
| 4 计数器 + token gate | question-first guidance + 简化 failure state |

建议目标 before chain：

1. `guidance-bridge`：保证 question/clear_guidance 永远可用。
2. `permission-safety`：原生 edit/bash 禁用、safe tool 权限、dangerous shell。
3. `scope`：文件作用域和备份链路。
4. `codegraph`：源码修改前影响分析。
5. `skill-policy`：高风险 Skill 白名单和必读认证。
6. `dispatch-signal`：route/DAG 建议，不默认阻断。

建议目标 after chain：

1. `audit`
2. `skill-audit`
3. `quality-contract` warn/audit
4. `dispatch-trace`
5. `db-health` sampled
6. `guidance-recovery`

### 3.3a Hook 防膨胀规则

新增或保留 Hook 必须满足至少一个条件：

1. 能阻止不可逆风险，例如越权写入、危险 shell、无备份删除。
2. 能验证客观事实，例如是否执行 CodeGraph、是否使用 safe tool、是否存在 artifact。
3. 能保留审计证据，例如谁在何时用哪个 Skill 修改了哪个路径。
4. 能触发 QoderWork guidance，例如连续失败、无法自修正、需要人类决策。

以下内容不应进入 Hook：

1. 大段业务流程。
2. Agent 人设和角色说明。
3. 可由 Skill 描述的操作步骤。
4. 需要主观判断的代码质量评价。
5. 普通任务的 checklist 状态推进。

Hook 的固定处置：安全问题 fail closed，质量问题 warn and continue，流程建议 audit only。不得再通过全局模式切换改变同一规则的处置。

### 3.4 Failure State 简化

当前 `consecutive_failures / total_failures / compliance_blocks / soft_rejections` 可收敛为：

| 状态 | 用途 |
|------|------|
| `failure_count` | 当前 session 连续失败 |
| `last_failure` | 最近失败摘要 |
| `guidance_required` | 是否必须 question |
| `tool_rejections` | per-tool soft rejection，可保留独立表或 JSON |

`total_failures` 如只用于统计，应移到 audit aggregation，不参与运行时阻断。

### 3.5 QoderWork Guidance Bridge

目标是保留 QoderWork 的指导能力，但不让它成为正常路径的阻塞依赖。

```
Agent failure / uncertainty
  -> Hook records structured signal
  -> optional system transform injects concise guidance instruction
  -> Agent calls question
  -> QoderWork answers synchronously
  -> after-hook records recovery
  -> Agent resumes with Skill self-check
```

设计要求：

1. `question` 在 guidance、initial_read、checklist、route mismatch 状态下都必须可用。
2. QoderWork guidance 文本必须进入 session 可见上下文，同时写入 DB 供恢复。
3. ACP/SSE 只做增强通道，不能替代 `question` 作为最低可用控制面。
4. 如果 ACP/SSE 不可用，Agent 仍能通过 `question` 得到指导。
5. 任何 hard block 消息都必须包含“是否允许 question”。
6. `experimental.chat.system.transform` 只作为 prompt 注入增强通道，不能成为唯一恢复路径。
7. 如果 system transform 不可用，应退化为 hard block 文案 + `question` + JSONL/DB guidance trace。

### 3.6 ACP 主动监督规则

ACP 不应只是被动接收 `question`。弱模型不会主动问时，QoderWork 应能基于流式输出主动判断是否需要介入。

建议 ACP 观察以下信号：

| 信号 | 处置 |
|------|------|
| 目标/范围未清但开始写文件 | 注入 guidance：先列 assumptions/open questions |
| 高风险任务无 brainstorming summary | 注入 guidance：读取/执行完整 brainstorming |
| 输出没有 success criteria | 要求补充验收标准 |
| 直接实现但未说明假设 | 要求列出假设后继续 |
| 多次 tool failure | 要求调用 `question` 或等待 QoderWork 指导 |
| 需求含糊却没有问题 | QoderWork 主动发一个澄清问题 |

处置边界：

1. ACP guidance 默认不 hard block。
2. 只有安全/权限/不可逆风险仍由 Hook hard block。
3. ACP 追问应短、具体、一次聚焦一个决策。
4. QoderWork 可以要求 Agent 继续执行并记录假设，不必每次等待用户确认。

**验收指标**:
- 配置 before handler 保持在 6-8 个；普通写工具按 TOOL_FILTER 统计实际执行数，`task` handler 不应进入 `safe_edit` 热路径。
- `question` 在任何 enforcement 状态下可用。
- 强制层无互相阻断路径。
- hard block 错误消息必须包含：原因、可执行下一步、允许工具。
- 非阻断质量信号能触发 QoderWork review，但不默认阻断普通开发。
- ACP 能在模型不主动提问时检测澄清缺口，并注入短 guidance。

---

## Phase 4: Minimal State 与 DB Hot-Path Slimming

**目标**: DB 继续作为审计、恢复、桥接和长任务追踪的可靠底座，但不再充当所有流程状态的“大脑”。默认控制流应由官方原生 Agent、Skill 契约和 Plugin Hook 完成，DB 只保存必要事实。普通审计优先 JSONL；需要查询、恢复、跨 session 关联或 QoderWork bridge 的状态才进入 DB。

### 4.1 状态分级

| 级别 | 表/模块 | 策略 |
|------|---------|------|
| Critical | backup_log, audit_log, session trace, dispatch_queue, guidance state | 保留，必须可恢复 |
| Observable | skill usage events, quality signal events, route suggestions, hook decisions | append-only 或采样写入，不阻断普通执行 |
| Optional | checklist runs, DAG payload integrity, read attestation detail | 仅在高风险任务、大型任务或明确开启时写入 |
| Cold | snapshots, history, compactor, knowledge materialization jobs | 后台维护，不进入工具热路径 |
| Deprecated candidates | 未被 runtime 读取的 legacy 表/JSON bridge | shadow log 后删除 |

### 4.2 Skill/Hook 状态契约

Plugin Hook 写 DB 的目标是“留下证据”，不是“复制业务流程”。

| 事件 | 最小字段 | 行为 |
|------|----------|------|
| `skill_usage` | session_id, agent_alias, native_executor, skill_name, risk_level, result | after-hook 记录，可批量 |
| `skill_attestation` | session_id, required_skill, read_hash, attest_result | 只对高风险 Skill 强制 |
| `quality_signal` | session_id, signal_type, severity, suggested_action | 默认不阻断，达到阈值触发 QoderWork |
| `guidance_state` | session_id, guidance_required, guidance_text_hash, source, recovery_count | guidance bridge 必需状态 |
| `dispatch_trace` | parent_session, child_session, alias, native_executor, loaded_skills | 支撑 QoderWork 观察和恢复 |

普通审计事件优先写 JSONL：

| 事件 | 推荐存储 | 原因 |
|------|----------|------|
| tool audit | JSONL | 追加写简单，失败不影响主流程 |
| quality signal | JSONL + sampled DB index | 普通质量信号不需要事务 |
| skill usage | JSONL，必要时 DB index | 大多数只需追溯，不需实时查询 |
| guidance state | DB + JSONL mirror | 需要恢复和跨 session 查询 |
| dispatch trace | DB + JSONL mirror | 需要 resume、ACP/QoderWork 观察 |

### 4.3 DB 访问原则

1. 普通 read-only 工具不写 DB。
2. 普通 write 工具最多一个 hot-path DB transaction，优先写 backup/audit。
3. before-hook 默认只读内存配置缓存；只有安全、权限、guidance 状态需要 DB。
4. after-hook 审计允许批量、采样和异步 flush，不应成为任务成功的前置条件。
5. Skill 认证只在 high-risk task 启用，不作为所有任务 Phase 0。
6. JSON export 只作为恢复/调试输出，不作为默认运行依赖。
7. `dbRegenerateGateFiles()` 作为维护命令，不进入常规任务链路。
8. 不追求“无 DB”；追求 DB 不参与普通任务实时流程控制。

### 4.4 合并候选

| 当前结构 | 建议 |
|----------|------|
| `session_map` + `session_log` | 长期合并为 `session_registry` + append-only `session_events` |
| `execution_checklist_*` | 变为可选 task checklist，不默认创建 |
| `tool_enforcement` + `soft_rejections` | 收敛为 `tool_guidance_state` + audit events |
| Skill read detail | 高风险任务保留明细，普通任务仅记录 `skill_usage` |
| snapshot tables | 只在配置变更时写，不在会话启动热路径写 |

**验收指标**:
- 普通 read-only 工具不写 DB。
- 普通 write 工具只写 backup/audit/guidance 必要状态。
- Skill 调用和质量信号有事件可查，但不复制完整流程状态机。
- DB 表数不是第一目标；热路径 DB touch count 减少 50% 是第一目标。
- framework doctor 不再需要大量“自证可靠性”检查才能安全运行普通任务。

---

## Phase 5: Legacy Agent 行为退役

**目标**: 在不破坏现有角色兼容、QoderWork 桥接和历史审计的前提下，逐步退役 10 个自定义 Agent 的行为实现。目标态是“官方原生执行器 + Skill bundle + Hook policy + permission scope”，旧 Agent 名称只作为兼容 alias。

### 5.1 兼容层

短期保留 10 个 Agent 名称，避免破坏：

- `Task.DAG.json`
- `agent_tool_scopes`
- `session_map` / `dispatch_trace`
- 历史日志和审计查询
- QoderWork 对特定 Agent 名称的指导习惯
- docs/review 中已有角色引用

保留名称不等于保留复杂 prompt。Agent 文件应逐步变为 alias manifest，并最终可以由配置生成。

### 5.2 官方原生执行模板

| 官方原生能力类别 | 当前 Agent alias | 主要 Skill bundle | Hook policy |
|------------------|------------------|-------------------|-------------|
| Plan / coordinator | Orchestrator, Meta-Planner | planning, dispatch, decomposition, merge | route signal, DAG optional |
| Build / implementation | Coder-BE, Coder-FE, Super-Admin | implementation, codegraph-first, safe-write, framework-maintenance grant | scope, backup, codegraph hard, dispatch_privilege hard |
| General / integration | Architect, CI-CD-Agent | architecture, ops, integration | risk-based skill attest |
| Review / explore | Guardian, Arbiter | review, arbitration, evidence collection | mostly readonly, quality signal |
| Research / scout | Knowledge-Curator | documentation, external knowledge, knowledge capture | read audit, source attribution |

### 5.3 Agent 配置目标结构

每个 Agent `.md` 最终应尽量只保留以下信息：

注意：`alias_of` 字段不再是有效配置——OpenCode runtime 不读取它。
2. `default_skills`: 默认加载的 Skill bundle。
3. `risk_profile`: low / normal / high / break-glass。
4. `write_scope`: 文件作用域和工具权限摘要。
5. `qoderwork_bridge`: 何时必须调用 `question`。
6. 最小角色边界：不超过 20-40 行的身份说明和禁令。

完整流程细节必须迁移到 Skill，不再写进 Agent prompt。

### 5.4 合并路径

1. 先统一 Agent frontmatter 和 prompt skeleton。
2. 把角色差异移入 Skill bundle。
3. 在 dispatch metadata 中同时记录 alias 和 native executor。
4. 让 QoderWork 既能按旧 Agent 名称指导，也能看到真实原生执行器。
5. 在 shadow 期比较旧自定义 Agent prompt 和官方原生 Agent + Skill 的任务成功率。
6. 成功后默认禁用旧自定义 Agent prompt，只保留 alias manifest。
7. 最后评估是否删除或生成 Agent 文件。

不建议第一步就删除 Coder-BE/Coder-FE 或 Guardian/Arbiter 的名称。更稳妥的是先让它们共享官方原生执行器，再通过 Skill、permission 和 Hook policy 区分。行为迁移完成后，旧 prompt 应进入只读归档，不再作为默认运行上下文。

**验收指标**:
- 10 个 Agent 文件共享统一 frontmatter 结构，且正文趋近 alias manifest。
- 每个 alias 都能解析到一个 native executor。
- Coder-BE/Coder-FE 正文差异小于 30%，差异主要来自 Skill bundle。
- Guardian/Arbiter 审查流程由 Skill 决定。
- QoderWork 能按旧 Agent 名称和 native executor 双维度追踪任务。
- 新增领域能力只新增 Skill，不新增 Agent。
- 普通任务默认不加载旧自定义 Agent 长 prompt。

---

## Phase 6: Validation 与 Rollout

### 6.1 必跑验证

每阶段至少跑以下定向验证：

1. CodeGraph impact/sync。
2. official native executor smoke test：普通任务能由官方原生 Agent 完成，不依赖旧自定义 Agent 长 prompt。
3. native executor alias smoke test：旧 Agent 名称能解析到正确原生执行器。
4. dispatch_subagent smoke test：parent/child session、loaded skills、route suggestion 可追踪。
5. safe_edit scope violation test：越权写入仍 hard block。
6. question guidance recovery test：任意 gate active 时 `question` 可用。
7. Skill policy test：推荐 Skill 缺失给 warn/audit，高风险 Skill 缺失才阻断。
8. Hook quality signal test：质量问题能写事件并触发 QoderWork review，而不是默认中断。
9. CodeGraph enforcement test：源码修改前 impact 仍是硬约束。
10. ACP/SSE bridge smoke test：QoderWork 能观察 native executor、Agent alias、Skill 和 guidance 状态。
11. brainstorming micro-card test：普通任务能生成目标/范围/成功标准/假设自检，不阻塞执行。
12. full brainstorming trigger test：复杂/高风险任务能读取完整 `brainstorming` 并输出 assumptions/open questions。
13. ACP active intervention test：模型跳过澄清直接动手时，QoderWork 能注入短 guidance。
14. framework doctor/self-test 中相关子集。

不建议把根目录全量 `tsc` 作为唯一 gate；当前历史上根 TS baseline 噪声较大，应按变更范围跑定向测试。

### 6.2 弱模型回归集

为了保证“能力弱的 LLM 也有较高输出质量”，每阶段需要维护一个小型弱模型回归集：

| 场景 | 期望行为 |
|------|----------|
| 不知道该读哪个文件 | Skill preflight 指导其先收集证据 |
| 目标不清直接写代码 | micro brainstorming 或 ACP guidance 要求先列假设 |
| 不知道该问什么 | brainstorming 输出 open questions / decision points |
| 修改源码前忘记 CodeGraph | Hook hard block 并给出下一步 |
| 输出缺少测试说明 | quality signal 要求自修正 |
| 连续两次绕过推荐 Skill | 触发 QoderWork guidance |
| 不确定是否越权 | Agent 按 Skill contract 调用 `question` |
| route mismatch | 记录 route suggestion，不中断普通任务 |
| 普通小问题触发过多关卡 | 不进入 DAG/checklist/auto_plan，直接执行 |
| 旧自定义 Agent prompt 未加载 | 官方原生 Agent + Skill 仍能完成任务 |
| 高风险任务无澄清 | 触发完整 brainstorming 或 QoderWork 追问 |

### 6.3 Rollout 策略

| 阶段 | 默认状态 | 回滚方式 |
|------|----------|----------|
| Phase 0 | 文档修正 | git revert |
| Phase 1 | 双轨 prompt + Skill | 恢复 Agent prompt |
| Phase 2 | official native executor shadow rollout | dispatch 回旧 Agent 逻辑 |
| Phase 3 | handler feature flag + quality-signal shadow log | `plugin_execution_order` 回滚 |
| Phase 4 | DB shadow logging | 保留旧表和旧读路径 |
| Phase 5 | alias manifest，默认禁用旧长 prompt | 保留旧 Agent 名称和旧 prompt 作为回滚 |

### 6.4 停止条件

出现以下情况应停止重构并回滚最近阶段：

1. Agent 无法完成普通 safe_edit。
2. `question` 在任意阻断状态下不可用。
3. QoderWork 无法观察或注入 guidance。
4. backup 失效或无法 restore。
5. dispatch_subagent 无法创建子 session。
6. alias 不能解析到 native executor。
7. 官方原生 Agent + Skill 无法完成旧 Agent 能完成的普通任务。
8. 高风险 Skill 认证误阻断普通任务。
9. CodeGraph 强制无法放行已完成 impact 的源码修改。
10. DB migration 导致 schema_version 下降或核心表丢失。

---

## 六、优先级矩阵

| 优先级 | 工作项 | 理由 |
|--------|--------|------|
| P0 | 修复/规避 `SSEWatcherFd` WSL2 监控缺陷 | 可重复 runtime E2E 依赖稳定事件采集；tail 模式可用但默认 watcher 仍有 fd/fstat 风险 |
| P0 | Question enforcement full-runtime closure | ✅ runtime smoke 已闭环（T5 Question full-runtime 5 段：STOP/question 注入 + guidance 恢复）；STOP 注入与 guidance-delivered 由 T5 + D3（GOVERNANCE-BLOCK 后恢复）实证 |
| P0/P1 | per-agent runtime caller 替换 | `readDispatchAllowedTools` 已无；但 `isWriteAllowed`、`getAgentShellAllowlist` 等仍有活跃 caller，需行为型替代后再删 |
| P1 | legacy dispatch-validate 归档 | 不在 active order，但仍 export/callable，低成本降低误启用风险 |
| P1 | MCP role filter 接线或废弃 | 当前未被 `tool-def-trimmer`/hook 调用，不能继续当作已落地能力 |
| ~~P0~~ ✅ | Dispatch exact binding 与框架维护 grant 主链路 | E2E v5 已验证 canonical `dag_task_id`、QUEUE_ID 精确 lease、grant bind/consume、`safe_framework_edit` 成功；后续转为 edge-case regression |
| P1 | 框架维护 grant edge-case regression | 主链路已通过；仍需 path 越界、TTL、并发 child 复用、DB fallback 故障注入和 native Task metadata 替代 |
| P1 | Scout live runtime | 当前只有路由名基础，缺 active `scout` agent 配置与真实 evidence bundle 回传 |
| P1/P2 | DB hot-path 统计后再做表合并 | 表数不是第一指标，先实测普通任务 DB touch 和 fallback |
| P2 | weak-model 23 场景 runtime 回归 | 当前 G2/G5/G7 smoke 已覆盖核心方向；完整矩阵成本高，按真实回归需求推进 |
| P2 | 中文关键词误匹配调优 | **B1 已产出样例**（#1/#4/#7/#8 CN≠EN；F1-F4：英文子串误命中 + "库" 碰撞 + 意图缺口）→ 现在高 ROI，建议排入后续修复 |
| P3 | mode 残留文档/测试清理 | active runtime 已是 rule-disposition + compat shim，剩余主要是历史叙事 |
| P3/弃用 | TodoWrite DB/DAG reconciliation hook | 与 `preflight-lite` 设计冲突；保持 soft-governance/audit，不同步到 checklist/DAG |

---

## 七、最终验收指标

目标不是一次性达成，建议作为 4-6 周路线图：

| 指标 | 当前 | 目标 |
|------|------|------|
| before handler | 10 configured (`task` only for Task marker path；`tool-governance` 已接入) | 6-8，按工具过滤统计实际执行数 |
| after handler | 7 configured | 5-7，且显式记录 delegate 副作用 |
| Agent 正文总行数 | 高 | 减少 40%+ |
| Agent 行为实现 | 自定义 prompt 为主 | 官方原生 Agent + Skill bundle |
| 旧 Agent 长 prompt | 默认加载 | 普通任务默认不加载，仅回滚/兼容 |
| 必读 Skill/Rule token | 高 | 减少 40%+ |
| Skill 自动注入 | 未明确边界 | 摘要/步骤卡优先，全文按需读取 |
| Brainstorming 使用 | 依赖模型主动调用 | 微型卡片默认，复杂任务完整 Skill |
| 高风险 Skill 认证 | 初始读认证偏全局 | 按风险启用 |
| 普通 dispatch 是否必须 DAG | 否，Phase 2 runtime smoke 已通过；`dispatch_subagent` 仍兼容存在 | 否，代码/文档/测试一致，wrapper 退场完成 |
| 普通小任务默认关卡 | 多层 gate/checklist/DB | safety hook + audit，其他 warn/audit |
| route mismatch | 可 hard block | 固定为 audit only，越权例外 hard block |
| 普通 safe_edit DB touch | 多处 | 减少 50% |
| 普通审计存储 | DB/JSON 混杂 | JSONL 优先，DB 只做索引/恢复/桥接 |
| 新领域能力扩展方式 | Agent prompt + config + handler | Skill first |
| Plugin Hook 职责 | 流程治理 + 安全混合 | 安全、审计、Skill policy、质量信号 |
| Guidance 恢复 | question hybrid | question stable path + ACP/SSE observation |
| QoderWork 可观测性 | 依赖日志和 session 状态 | alias/native executor/Skill/guidance/clarification 元数据齐全 |
| 弱模型输出质量 | 主要靠硬约束阻断 | brainstorming + Skill contract + quality signal + QoderWork 纠偏 |

---

## 八、推荐落地顺序

1. **先做 Phase 0**：修正文档和指标，避免误判。
2. **同时固化 QoderWork bridge + ACP 主动监督契约**：先保证 `question`、ACP/SSE、dispatch trace、clarification signal 不会在瘦身中被误删。
3. **再做 Phase 1**：Skill-first prompt diet + brainstorming 分层，风险最低、收益明显。
4. **同步做 Phase 2**：把当前 `require_dag_entry=false` 正式产品化，并建立官方原生 Agent 默认执行路径。
5. **保留 Dispatch 权限回归矩阵**：`dispatch_queue` exact binding、`dispatch_privilege_grants` 和 `safe_framework_edit` 主链路已通过 live E2E；后续重点是 path 越界、TTL、并发 child 复用、DB fallback 故障注入和 native Task metadata 替代 `dispatch_subagent`。
6. **再做 Phase 3**：Enforcement 分层，减少死锁，把质量问题改为 warn/audit + QoderWork review；框架维护写入作为 task-level grant 例外保留。
7. **最后做 Phase 4/5**：DB 热路径瘦身和 legacy Agent 行为退役，风险最高，需要前面阶段提供稳定基线。

一句话方案：**Orchestrator 作为唯一自定义 agent 负责编排和桥接，官方原生 Agent 负责执行，brainstorming 负责澄清质量下限，Skill 负责角色行为和能力复用，行为型 Plugin Hook 负责不依赖身份的可验证硬边界，dispatch-level privilege 负责框架维护的短期最小授权，QoderWork ACP 负责主动追问和纠偏；旧 9 个自定义 Agent 角色行为全部迁移到 Skill，per-agent enforcement 检查层按 caller 替换后删除，安全硬约束保留，流程硬约束降级。**

---

## 蓝图修订日志

### 2026-07-06 v2.2 skill-summary 会话桥接修复

**问题**：`skill-summary.ts` v2.1 的 `extractRecentMessage()` 猜测了 `input.lastUserMessage` / `input.message` / `input.parts` / `input.conversation.messages` 四个字段，但 OpenCode 官方 SDK 类型（`@opencode-ai/plugin/dist/index.d.ts:265-270`）严格限定 `experimental.chat.system.transform` 的 input 为 `{ sessionID?, model }`。因此关键词匹配在结构上不可能生效，所有历史日志中 `keywordGroups: "none"` 与该根因一致。

**修复**：在 `skill-summary.ts` 引入模块级 `recentMessageBridge: Map<sessionID, {text, capturedAt}>`（256 条 LRU，30 分钟 TTL），由 `plugins/session.ts` 的 `chatMessageHook` 从 `output.parts[]` 提取文本（4KB 上限）写入，由 `skill-summary.ts` 的 system.transform handler 读取。

**影响**：
- 退场一个 P0 at-risk 项（§0.1 遗留 #1）
- 解除 §0.2 E2E 复核 #3 的代码级风险
- S1-001/S1-002 代码级根因已修复；v2.3 后运行级复核进一步确认 S5-002/S5-004/S5-005 可提升为 PASS

**下一步**：该项不再是 P0；后续只需要保留小型回归集，防止 bridge/fallback 再次漂移。

### 2026-07-06 v2.3 冷启动 DB fallback 补丁

**问题**：v2.2 桥接验证时发现 Orchestrator 首轮 LLM 请求冷启动盲区 — `session.ts` 的 `chatMessageHook` 在 `!sid || !agent` 时 early return，而 SDK 对 Orchestrator 首次调用尚未完成身份解析（input.agent=""），导致桥接 Map 在首轮 system.transform 时为空。Build sub-agent 不受影响（身份已解析，匹配正常）。

**修复**：`skill-summary.ts` v2.3 新增 `coldStartDbFallback(sessionID)` 函数，当桥接为空时从 SDK `opencode.db` 的 `part` 表读取当前 session 最新 `type='text'` 行的 `data.text`，结果缓存 60 秒避免热路径重复 SQLite 查询。`extractRecentMessage()` 改为桥接优先、fallback 兜底。

**验证结果**（2026-07-06 08:01 UTC）：
- 新 session `ses_0c98da9a7ffew0FYEEtAGiD6Cm` 首轮 architecture 类 prompt：
  - `keywordGroups: source-edit,architecture,database`
  - `keywordSkills: codegraph-first,brainstorming,cicd-database-seeding,sqlite-bloat-investigation`
  - `risk: high-risk`（"迁移"关键词正确识别）
  - `scout_escalation_suggested: true`（architecture 触发）
- 对比 v2.2 同场景：`keywordGroups: none, risk: standard, scout: false`
- 软治理决策首次基于真实用户原文做出判断，不再全部落在默认值

**剩余改进**：
- 改进建议 #2（session idle 后再发下一轮）属于测试编排层，无需代码改动
- 改进建议 #3（冷启动文档化）已通过 v2.3 注释和本次修订日志完成

### 2026-07-06 v1.7.0 文档/E2E 对齐复核

**复核范围**：`qoderwork/scripts/*`、work-one `skill-summary.ts`/`session.ts`/`project.config.json`/DB 指标、`e2e/opencode-framework-simplification-e2e-results.md`。

**修正**：
- E2E 结果文件前半段 v2.3 addendum 属实，后半段 final table/critical findings 已是 stale，需要同步为 S1/S5 动态注入 PASS。
- 当时 live metric 为 318 个 `.opencode` TS 文件、67,890 行、主 DB 44 表/schema v33；后续 v1.8.0 已重新采样。
- 当时判断 serve-api session-tree 脚本尚未实施；后续 v1.8.0 复核已确认脚本存在，v1.9.0 进一步确认 Section C 6 场景已 PASS。
- `/children` endpoint 不能作为唯一可靠前提；当前代码已实现 framework DB fallback，v1.9.0 E2E 已验证 JSON 主路径。

### 2026-07-06 v1.8.0 框架更新后 live 复核

**复核范围**：当前 work-one working tree、`opencode.json`、`.opencode/project.config.json`、active dispatcher、`preflight-lite`、主 SQLite DB、`qoderwork/scripts/*`。

**修正**：
- live metric 更新为 325 个 `.opencode` TS 文件、68,458 行；CodeGraph 为 364 files / 324 TS / 30 JS / 10 YAML。
- active order 仍是 7 before + 6 after + 2 system；after delegate 和 unused registry/import drift 仍需显式记录。
- `.opencode/state/` 已只剩 `framework-state.db` 作为运行时主 DB，`framework-state.db-wal/shm` 是 SQLite 附件；历史/0-byte DB 已移入 `.opencode/.trash-db/`。
- `preflight-lite/FULL.md` 已是 v3.0.0 lightweight reference，不再是旧 DAG/gate/MCP 硬门禁。
- serve-api session-tree 4 个脚本已创建；当时 Section C 未复核，后续 v1.9.0 已确认 6/6 PASS。保留边界：DB fallback 未做故障注入。

### 2026-07-06 v1.9.0 serve-api v1.3.0 E2E 复核

**复核范围**：`logs/2026-07-06-serve-api-e2e-validation.md`、`qoderwork/scripts/session-tree.ts`、`monitor-tree.ts`、`guide.ts`、`intervene.ts`、`.qoder/skills/serve-api/SKILL.md` 与 `reference.md` Section C。

**修正**：
- serve-api v1.3.0 Session 树监控与主动干预 E2E 已 6/6 PASS，不能继续写成“Section C 未验收”。
- `session-tree.ts` 与 `monitor-tree.ts` 已实现 `/session/{sid}/children` 失败时 framework DB fallback；`session-tree.ts` 对 root 不可达返回 exit=2。
- E2E 报告验证了 `/children` JSON 主路径、QID-SID 错配 exit=3、identity-preserving guidance、mid-turn prompt_async 排队、question/reply 即时恢复和 abort 立即止损。
- 仍需保留边界：DB fallback 未在本次 E2E 中做故障注入；serve-api 直连干预 PASS 不等于 ACP watcher 主动监督矩阵已完成。

### 2026-07-07 v1.12.0 canonical prompt + DAG ID consistency E2E 复核

**复核范围**：`logs/2026-07-07-canonical-prompt-reference.md`、`logs/2026-07-07-dag-task-id-consistency.md`、`dispatch-subagent.ts`、`router.ts`、`before/task.ts`、`marker-consume.ts`、`dispatch-integrity.ts`、`session.ts` 和 live `framework-state.db`。

**修正**：
- `task` before handler 已重新进入 active before order，用于 Task marker/canonical prompt 消费；不能继续写成 legacy/not-active。
- `QUEUE_ID` canonical path 已解决 LLM prompt handoff 脆弱性，并且 v5 已补上 queue id 精确 lease。
- `dag_task_id` 已在 `dispatch_queue`、synthetic `dispatch:child:<dag_task_id>` session_map 和 `session_events` 中使用同一 canonical UUID；真实 native child session row 仍可能不带 DAG ID，不能把它写成所有 session_map 行都对齐。
- framework maintenance grant 主链路已从 smoke/component 提升为 live LLM E2E PASS：grant `pending -> bound -> consumed`，`safe_framework_edit` 写 probe-v5 成功，compliance gate 返回非空 session_id。
- 剩余任务改为 edge-case regression、fallback 故障注入、ACP/SSE watcher 主动监督和 `dispatch_subagent` 退场，而不是继续补 bindGrant 主链路。
