# Dag Task ID 一致性修复 + 精确 Queue Lease + E2E V5

**为什么**: dispatch 链路中 `dag_task_id` 在三个核心表（dispatch_queue, session_map, session_events）中不一致。根因是 CLI 入队传了 `taskId`（= sessionNamespace/taskDescription）而非 `dagTaskId`（canonical UUID），router 写 session_map 时未 fallback 到 `effectiveDagTaskId`。导致 compliance_gate_check 因查 session_map 找不到 task_id 而失败。

**改了什么**:
- `scripts/command-tools/dispatch-subagent.ts:122` — `dbEnqueueDispatch(agentType, dagTaskId || taskId || "(no-task-id)", ...)` 用 canonical UUID 入队
- `service/dispatch/router.ts:346` — 父 session_map 写入改为 `dagTaskId || effectiveDagTaskId`
- `service/dispatch/router.ts:355-364` — `dispatch:child:*` 合成 session_map 始终用 `effectiveDagTaskId`，不再受 `if (dagTaskId)` 限制
- `service/gate/dispatch-integrity.ts` — 增加 session_events + dispatch_queue fallback 查询（兼容兜底，主路径已修复）
- `service/dispatch/marker-consume.ts` — 精确 lease: `UPDATE dispatch_queue WHERE id = ? AND status = 'pending'` 替代 `dbDequeueWithLease(agentType)`

**E2E V5 验证结果**:
- dispatch_queue.dag_task_id = `b84b134f-...` (UUID) ✅
- session_map (dispatch:child:).dag_task_id = `b84b134f-...` (UUID) ✅
- session_events.dag_task_id = `b84b134f-...` (UUID) ✅
- dispatch_queue.id=37 status=running（精确 lease，非误租旧队列）✅
- Grant: pending→bound→consumed ✅
- compliance_gate_check: passed=true, session_id=cg_ses_... ✅
- Probe file: `.opencode/_test_framework/probe-v5.txt` = `full-chain-ok` ✅
- HANDOVER.md + TASK_LOG.md 写入 `.task_temp/b84b134f-.../` ✅

**已知非框架问题**: compliance_gate_confirm 有 deliverables JSON 格式错误（LLM 输出格式不符合 gate 要求的 `{name, description}` 结构），这是 LLM 行为问题而非框架链路缺陷。
