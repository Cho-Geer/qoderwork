# Dispatch Privilege E2E Grant Binding And Reporting Gap

**日期**: 2026-07-07

**来源**: E2E framework privilege probe (`@build` subagent) 审计结论 + 汇报/监控链路复审

## 结论

本次 E2E 结果的现象判断基本属实，但根因归因过窄。问题不只是 `bindGrant()` 未绑定，还包括 Task marker consume 未进入 active hook chain、Orchestrator 未解析 child 失败结果、以及 `acp_notify` 通知服务与 DB schema 漂移。

已确认：

- child session、parent session、agent/model/title 均能在 SDK DB 中对应上。
- `safe_framework_edit` 确实被 `[FW-ENFORCE][PRIVILEGE] No active framework_maintenance grant for this session + path` 拦截。
- `dispatch_privilege_grants` 中确有 grant `392c72a7...`，`dispatch_key=faa38468...`，但 `child_session_id=null`、`status=pending`、`bound_at=null`。
- `dispatch_queue` 中同一个 `dispatch_key` 也存在，但仍是 `status=pending`、`lease_owner=null`。
- child 最后一条 summary 与事实一致：探针文件未写入，只写了 `.task_temp/...` 交接/日志文件。
- 父 Orchestrator 的 `Task()` output 已经包含 child 的失败摘要，但最终仍只回复 `privilege-dispatched`。
- child 唯一的外部汇报尝试是 `notify-server_acp_notify`，结果为 `session_id="(unresolved)"`。

需要修正：

- 工具统计不是 `15 次 / 成功 11 / 失败 3`，而是 child session 中实际 `17` 个 tool parts：`14 completed + 3 error`。
- `todowrite` 是 `5` 次，不是 `4` 次。
- “CodeGraph 双门第一关通过”可以成立，但 `safe_framework_edit` 没进入成功写入路径，所以不能表述为完整双门链路验证通过。
- “bindGrant gap 是唯一剩余 gap”不严谨。当前证据显示至少有两个问题同时存在：`dispatch_queue` 未被 lease/consume，以及 `session.created` 绑定路径未生效。
- “question tool 不在 build 可用工具集中”不准确。当前 `build` 权限中 `question` 与 `acp_notify` 都是 allow，真实问题是 prompt/策略没有要求 `acp_notify` 失败后 fallback 到 `question`。
- “HANDOVER.md 无消费者”过绝对。框架存在 round-summary 扫描 HANDOVER 的消费者，但没有用于父 agent 成功/失败判定和对外汇报的消费者。

## 准确根因表述

这次 E2E 真实复现的是“dispatch grant 已创建但未绑定 child session”的失败。

DB 证据显示 queue/grant 在 child session 创建前约 30 秒已存在。理论上 `.opencode/plugins/session.ts` 的 `onSessionCreated -> bindGrant()` 应该能绑定；同时 `.opencode/service/dispatch/marker-consume.ts` 的 queue consume 路径也没有发生。

更硬的代码证据是：`.opencode/plugin-handlers/before/task.ts` 中已有 Task marker consume 逻辑，但当前 active `.opencode/plugins/before-dispatcher.ts` 的 handler map / execution order 没有接入 `task` handler。因此 `dispatch_queue` lease、`dbDequeueWithHash` / `dbDequeueWithLease`、以及 marker-consume 侧的 `bindGrant()` 路径不会在 active chain 中执行。

因此，下一步不应只归因于 `session.created hook race`，还需要确认并修复：

- running `opencode serve` 是否加载了最新 `session.ts` hook 代码。
- active before chain 是否接入 Task marker consume handler。
- native Task / marker consume 为什么没有 dequeue 这条 `dispatch_queue`；当前证据倾向于 handler 未接入 active chain。
- `bindGrant()` 是未触发、触发但未命中 queue，还是触发后失败但未记录。
- `notify-server_acp_notify` 为什么 unresolved；当前代码还存在 `mcp-notify.ts` 写入字段与 `notifications` 表 schema 不一致的问题。
- Orchestrator 为什么在 `Task()` output 已含失败摘要时仍返回 `privilege-dispatched`。

## 汇报与监控链路缺口

本次执行中的汇报链路表现：

- Orchestrator 未调用 `question`，也未调用 `acp_notify`。
- build child 未调用 `question`。
- build child 在 `safe_framework_edit` 失败后调用过一次 `notify-server_acp_notify`，但返回 `session_id="(unresolved)"`。
- Orchestrator 的 `Task()` 工具结果已经包含 child 的完整失败摘要，包括探针未写入和缺少 `framework_maintenance` grant。
- Orchestrator 最终仍返回 `privilege-dispatched`，导致外层 E2E 脚本容易把 dispatch 成功误判为任务成功。

框架层面缺口：

- Orchestrator prompt 没有硬性要求解析 `Task()` 返回值并判定 child 成功/失败。
- active after/dispatch 只有 dispatch/Task 配对诊断，没有 child result gate、HANDOVER 失败检测、或自动对外汇报。
- `question` 已对 build 开放，但没有 `acp_notify -> question` fallback 策略。
- HANDOVER 当前可被 round-summary 扫描，但不是父 agent 成功/失败判定源。
- `notifications` 表 schema 为 `seq/session_id/agent/dag_task_id/event_type/data/created_at`，而 `mcp-notify.ts` 当前尝试写 `task_id/parent_id/resolved`，通知服务存在 schema 漂移。

## 改进建议（截至 2026-07-07 实施后状态）

| # | 优先级 | 建议 | 状态 | 实施记录 |
|---|--------|------|------|----------|
| 1 | P0 | Task marker consume 接回 active before chain | ✅ 已完成 | `logs/2026-07-07-dispatch-binding-gap-implementation.md` |
| 2 | P0 | mcp-notify.ts 与 notifications schema 漂移修复（v34 migration） | ✅ 已完成 | `logs/2026-07-07-dispatch-binding-gap-implementation.md` |
| 3 | P0 | session.created bindGrant 结构化日志 | ✅ 已完成（含 chat.message fallback） | `logs/2026-07-07-dispatch-binding-gap-implementation.md` + `logs/2026-07-07-canonical-prompt-reference.md` |
| 4 | P1 | Orchestrator Task result gate + acp_notify→question fallback | ✅ 已完成 | `logs/2026-07-07-dispatch-binding-gap-implementation.md`（Orchestrator.md Rule 8） |
| 5 | P1 | Task before / marker consume 结构化日志（DISPATCH_TOKEN/NATIVE_EXECUTOR/promptHash） | ✅ 已完成 | `logs/2026-07-07-dispatch-binding-gap-implementation.md` |
| 6 | P1 | 重跑 E2E 验证 queue pending→leased→bound→consumed 完整链路 | ✅ 已完成（v5 full-chain pass） | `logs/2026-07-07-dag-task-id-consistency.md` |
| 7 | — | DISPATCH_TOKEN handoff 脆弱性（根因修复） | ✅ 已完成（QUEUE_ID canonical prompt reference） | `logs/2026-07-07-canonical-prompt-reference.md` |
| 8 | — | 三表 dag_task_id 一致性（dispatch_queue/session_map/session_events） | ✅ 已完成 | `logs/2026-07-07-dag-task-id-consistency.md` |
| 9 | — | dispatch_queue 精确 lease（按 queueId 而非 agentType） | ✅ 已完成 | `logs/2026-07-07-dag-task-id-consistency.md` |
| 10 | P2 | session.idle / after-dispatch child 结果监控（结合 Task output + grant 状态 + queue 状态 + HANDOVER） | ⏸ 暂缓 | E2E v5 已通过，暂不需额外监控层；待后续出现回归再评估 |
| 11 | 长期 | Task() 原生支持 `dispatch_ref_id` 引用，消除 LLM prompt 复制 | ⏸ 暂缓 | QUEUE_ID 已作为工程折中解决当前问题，原生支持需 OpenCode 平台侧配合 |

## 当前技术债（E2E v5 后修订）

已解除：

- ~~Dispatch privilege 的 grant 创建链路已存在，但 child session 绑定闭环尚未被 live E2E 证明通过。~~ → **已解除**：E2E v5 中 grant 完整经历 pending → bound（chat.message fallback）→ consumed。
- ~~`dispatch_queue` 与 `dispatch_privilege_grants` 的生命周期存在断点：queue 未 lease，grant 未 bind。~~ → **已解除**：dispatch_queue.id=37 status=running（精确 lease by queueId），grant pending→bound→consumed。
- ~~Compliance gate 报 `task_id is not registered in any dispatch session` 与 queue 未 consume 现象一致，应作为同一链路问题联合排查。~~ → **已解除**：compliance_gate_check passed=true，三表 dag_task_id 一致，dispatch-integrity.ts 增加 session_events/dispatch_queue fallback 兜底。
- ~~Task marker consume 逻辑存在但未接入 active before dispatcher。~~ → **已解除**：task handler 已接入 HANDLER_MAP/TOOL_FILTER/DEFAULT_ORDER。
- ~~`acp_notify` 通知服务存在 schema 漂移。~~ → **已解除**：v34 migration 补 parent_id/resolved 列，mcp-notify.ts INSERT/SELECT 改用 dag_task_id。

仍存续：

- `safe_framework_edit` 的失败证明 privilege enforcement 生效，但不能证明 dispatch privilege 成功授予 → **仍成立**，但 E2E v5 中 safe_framework_edit 成功写入探针，证明 grant 已正确授予。
- Orchestrator 没有 child result gate → **部分解除**：Rule 8 已加入 Orchestrator.md，但实际 LLM 遵循度依赖后续 E2E 观察。
- `question` fallback 策略缺失 → **部分解除**：Orchestrator.md 已加规则，但 child agent 侧未显式加 fallback 链路。
- HANDOVER 当前可被 round-summary 扫描，但不是父 agent 成功/失败判定源 → **未解决**，但 HANDOVER.md + TASK_LOG.md 已能正常写入 `.task_temp/<dagTaskId>/`，具备下游消费条件。

新增观察：

- `compliance_gate_confirm` 的 deliverables JSON 格式校验对 LLM 输出不够宽容（E2E v5 中 LLM 未按 gate 要求的 `{name, description}` 结构返回），属于 LLM 行为问题而非框架链路缺陷，但影响最终”任务完成”信号传播。建议后续放宽 gate 的 deliverables 解析，或在 Orchestrator prompt 中显式给出 JSON 模板。
- `session.created` plugin hook 在 OpenCode 平台侧不触发（SSE 事件正常但 plugin hook 不触发），已用 chat.message fallback 替代。属于平台行为差异，需要在框架文档中记录此约束。

## 验收标准（E2E v5 达成情况）

| 验收项 | 状态 | 证据 |
|--------|------|------|
| Orchestrator 创建 dispatch privilege grant | ✅ | dispatch_privilege_grants 表有记录 |
| child session 创建后 grant 被绑定到正确 child_session_id | ✅ | grant status=bound, child_session_id 非空（via chat.message fallback） |
| dispatch_queue 状态进入 leased/running/consumed | ✅ | queueId=37 status=running，精确 lease by queueId |
| build child 先完成 CodeGraph 查询再调用 safe_framework_edit | ✅ | SSE 事件流确认 |
| safe_framework_edit 成功写入 .opencode/_test_framework/ 探针 | ✅ | probe-v5.txt = `full-chain-ok` |
| DB grant pending → bound → consumed，记录 bound_at/consumed_at | ✅ | 三态完整流转 |
| child summary 返回成功信号 | ✅ | Task() 返回包含写入成功信息 |
| Orchestrator 解析 Task() 返回值判定 child 成功/失败 | ⚠️ 规则已加，遵循度待持续观察 | Orchestrator.md Rule 8 |
| acp_notify 成功写入 notifications 表或 fallback 到 question | ✅ | v34 migration + dag_task_id 字段统一 |
| child HANDOVER 失败能被父 result gate 传播 | ⚠️ 未触发此路径（v5 child 成功） | 需在失败场景 E2E 中验证 |

## 实施进度（2026-07-07 最终状态）

**总体结论**：Dispatch privilege grant binding 主链路已通过 E2E v5 live LLM 完整验证。从 grant 创建 → queue 精确 lease → canonical prompt 校验 → grant binding（chat.message fallback）→ safe_framework_edit 成功写入 → grant consumed，全链路无断点。

**核心实施分三阶段**：

1. **P0-P1 链路修复**（`logs/2026-07-07-dispatch-binding-gap-implementation.md`）：task handler 接入 active chain、notifications schema 漂移修复、bindGrant 结构化日志、Orchestrator Rule 8。E2E v1/v2 暴露 prompt handoff 脆弱性和 binding 时机问题。
2. **Canonical prompt reference**（`logs/2026-07-07-canonical-prompt-reference.md`）：QUEUE_ID 短标识 + 磁盘原始 prompt 校验，彻底绕过 LLM 复制导致的字节差异。E2E v4 主权限写入链路通过，但发现 dispatch_queue lease 不精确。
3. **Dag task id 一致性 + 精确 lease**（`logs/2026-07-07-dag-task-id-consistency.md`）：三表 dag_task_id 统一为 canonical UUID，dispatch_queue 改为按 queueId 精确 lease，dispatch-integrity.ts 增加 fallback 查询兜底。E2E v5 full-chain pass。

**遗留项**：
- compliance_gate_confirm deliverables JSON 宽容度（LLM 行为问题）
- session.created plugin hook 平台不触发（已用 chat.message 替代，需文档化）
- HANDOVER 作为父 agent 失败判定源（未实现，P2）
- Task() 原生 dispatch_ref_id 支持（长期，需平台侧配合）
