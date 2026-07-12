# MCP Session Propagation 运行时验证

**为什么**: v37 实现后需要端到端验证 DB-backed context bridge 在真实 serve API 环境下正确工作

**改了什么**:
- `.opencode/plugin-handlers/before/gate-call-context.ts` — TOOL_FILTER/GATE_TOOLS 加 MCP 前缀 `compliance-gate_`；args 从 `output.args` 读取（参照 gate-validate.ts）；参数名 `_output` → `output`；`getDb` 移到 service 层
- `.opencode/plugins/before-dispatcher.ts` — TOOL_FILTER 加 MCP 前缀
- `.opencode/plugins/after-dispatcher.ts` — TOOL_FILTER 加 MCP 前缀
- `.opencode/service/gate/mcp-confirm.ts` — auto-lookup 后使用 `resolvedContext` 而非 `callContext`；添加 gate_session_id fallback lookup；saveGateStore 后标记 context completed
- `.opencode/service/gate/session-context-service.ts` — 新增 `getParentSessionId`、`resolveGateCallContextBySession` 函数
- `.opencode/lib/db-state-manager.ts` — dbSaveGateStore UPSERT 添加 7 个 v37 列

**决策**:
- after-hook (`tool.execute.after`) 框架层不触发，改用 MCP service 内部直接 UPDATE 标记 completed
- auto-lookup 添加 fallback：strict 匹配失败时按 `gate_session_id` 模糊匹配（args_hash 因 plugin hook 和 MCP service 使用不同 args 无法一致）
- 新增 `scripts/db-query.ts` 和 `scripts/db-schema.ts` 工具脚本，注册到 package.json
