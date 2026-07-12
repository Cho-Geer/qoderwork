# MCP Session Propagation: 3 blueprint defects fixed

**为什么**: Code review found 3 deviations from the MCP session propagation blueprint: (1) mcp-confirm.ts had fallback-to-latest violating "exact match / fail closed", (2) inline SQL in controller violating MVC layering, (3) args_hash passed as empty string breaking concurrent-safe binding.

**改了什么**:
- `.opencode/service/gate/mcp-confirm.ts` — Removed fallback block (lines 100-122), replaced inline SQL UPDATE with `completeGateCallContextBySession()` call, added `rawArgs` parameter
- `.opencode/service/gate/session-context-service.ts` — Added `completeGateCallContextBySession()` function, added `call_id` support to `resolveGateCallContextStrict()`
- `.opencode/service/gate/mcp-deliverables.ts` — Added `rawArgs` parameter to `submitDeliverablesWithCrossCheck()` and `approveDeliverablesWithAudit()`, compute correct `args_hash` from raw MCP args
- `.opencode/service/gate/mcp-complete.ts` — Added `rawArgs` parameter to `completeGateWithRetry()`, compute correct `args_hash`
- `.opencode/scripts/mcp-tools/compliance-gate.ts` — Pass full `args` object to all 5 service function calls
- `plans/mcp-session-propagation/blueprint-mcp-session-propagation.md` — Created blueprint document
- `plans/mcp-session-propagation/runtime-verification-report.md` — Created verification report

**决策**: rawArgs approach chosen over alternatives (passing args_hash from handler, or removing args_hash filter) because it ensures the service computes the same hash as the before-hook from the identical args object. Backward-compatible: when rawArgs is omitted, falls back to empty hash (no filtering).
