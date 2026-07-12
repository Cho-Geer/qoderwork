# Dispatch Privilege Grant Binding Gap — P0-P1 Implementation

**为什么**: E2E 测试确认 dispatch privilege grant 创建后未绑定 child session。根因是 task handler 未接入 active before chain，导致 dispatch_queue 永远停在 pending、marker-consume 路径不执行。同时 notifications 表 schema 与 mcp-notify.ts 代码漂移、Orchestrator 无 child result gate。

**改了什么**:
- `.opencode/plugins/before-dispatcher.ts` — 导入 task handler，加入 HANDLER_MAP/TOOL_FILTER/DEFAULT_ORDER（从 7→8 handlers）
- `.opencode/project.config.json` — plugin_execution_order.before 加入 "task"
- `.opencode/plugin-handlers/before/task.ts` — 移除 LEGACY 注释，添加 TASK-HANDLER-ENTRY/RESULT 结构化日志（DISPATCH_TOKEN/NATIVE_EXECUTOR/promptHash）
- `.opencode/lib/db-manager.ts` — v34 migration: notifications 表添加 parent_id + resolved 列
- `.opencode/service/notification/mcp-notify.ts` — INSERT/SELECT 的 task_id → dag_task_id 修正
- `.opencode/service/dispatch/privilege.ts` — bindGrant() 增加 GRANT-BIND-QUERY/GRANT-BOUND 结构化日志（privilege/agentType/dagTaskId）
- `.opencode/plugins/session.ts` — onSessionCreated grant binding 增加 LOOKUP-START/QUEUE-HIT/QUEUE-MISS/NO-MATCH 结构化日志
- `.opencode/agents/Orchestrator.md` — 新增 Rule 8（Task result gate）+ acp_notify→question fallback 规则

**决策**: 
- Schema drift 修复选择添加 migration（保留 parent_id/resolved 列）而非缩减代码，因为这些字段有实际用途
- task handler 放在 DEFAULT_ORDER 第二位（guidance-bridge 之后），因为它只匹配 task/Task 工具不影响其他 handler，且需要在 scope/codegraph 之前消费 marker
- 被否决方案：直接修改 notifications 表 CREATE TABLE 语句（不可行，表已存在于生产 DB 中）

**剩余项**: P2 child result monitoring（session.idle/after-dispatch 层面）需要 E2E 验证后再决定实现方式

## E2E 验证结果（2026-07-07 live LLM）

**E2E v1**（修复前 marker-consume bindGrant 使用 parent sessionID）:
- task handler 成功触发（TASK-HANDLER-ENTRY 日志确认）
- dispatch_queue 从 pending 进入 running（lease_owner 设置成功）
- grant 被绑定——但绑定到了 PARENT session 而非 child（根因：marker-consume.ts 中 bindGrant 使用 input.sessionID = parent）
- child session 创建成功（SDK DB 确认 build subagent），但 safe_framework_edit 失败（grant 不在 child session）
- DISPATCH_TOKEN 观察：V1 中有一次 Task() prompt 与 dispatch_subagent 输出完全一致（hash 通过），另一次 prompt 被改短（hash mismatch）。说明 prompt handoff 在 LLM 转交过程中不稳定，但不是每次都会失败

**E2E v2**（修复 marker-consume 移除 bindGrant 后）:
- task handler 触发，但 Task() 调用被 DISPATCH_TOKEN hash mismatch 阻止（prompt 比 dispatch_subagent 输出少 4 字符，主要是两个空行被删除——格式/空白差异，非语义篡改）
- child session 未创建，因此 session.created 绑定路径**未被 E2E 验证**
- `marker-consume.ts:70` 当前做严格 prompt hash 校验，任何换行、尾随空白、复制重排都会失败。问题本质是 dispatch prompt handoff 契约过脆：依赖模型手工转交长 prompt，字节级一致性不可靠

**追加修复**:
- `.opencode/service/dispatch/marker-consume.ts` — 两处 bindGrant 调用替换为 GRANT-BIND-DEFERRED 日志，binding 延迟到 session.created hook（child session 创建后才有正确 session ID）

**结论**: P0-1（task handler 接入）验证通过。P0-3（结构化日志）验证通过——日志清晰展示了 binding 流程。grant 绑定到错误 session 的根因已定位并修复。完整 E2E 验证（child 获得 grant + safe_framework_edit 成功）需要先解决 dispatch prompt handoff 脆弱性问题。

**DISPATCH_TOKEN 改进方向**: 不应把 dispatch-marker-consume 改成 warn-only（会削弱完整性保护）。正确方向是让 Task() 通过 `dispatch_ref_id` / `queue_id` / `outputFilePath` 引用 canonical prompt，由框架读取原始 prompt 并验证 hash，而不是让模型复制整段 prompt。这样既保留 integrity gate，也避免空白差异导致误杀。
