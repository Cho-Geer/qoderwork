# mcp-confirm fallback 修复审计报告 (2026-07-10)

> 触发: /pre-flight-enforcement + /debug-investigation-coach — 修复 blueprint 第21行缺口
> 缺口: `mcp-confirm.ts` 仍保留按 `gate_session_id` + `created_at DESC LIMIT 1` 的 fallback 查询，不是 blueprint 要求的 exact match / fail closed
> 结论: ✅ 修复完成，运行时 + 静态双重验证通过

## 根因（来自 debug-investigation-coach 证据链）

- before-hook `gate-call-context.ts` 采集了 `call_id = input.callID` 并写入 `gate_call_context`，但仅挂在 `input._gateCallContextId`（仅 after-hook 可见）。
- MCP tool handler 只接收 zod 解析后的 `args`，**拿不到 `call_id`** → `compliance-gate.ts` 调 `confirmGateSession(..., undefined, args)` 第6参数 `callContext` 为 `undefined`。
- `confirmGateSession` 走自动查找分支 → `resolveGateCallContextStrict({tool_name, gate_session_id, args_hash})`，底层 `ORDER BY created_at DESC LIMIT 1` 取"最近一条" → 非精确匹配，且在拿不准时继续放行（非 fail closed）。

## 修复设计（Fix A + Fix B，源码确认后确定）

**Fix A — 透传 call_id（机制经 @opencode-ai/plugin v1.17.18 类型定义 + 官方文档确认）**
- `tool.execute.before` 的 `output.args` 是工具**实际收到的参数**且可变；MCP 工具被"like any other tool"管理，hooks 同样触发 → 正确做法是 before-hook 把 `call_id` 注入 `output.args`。
- 无需进程内 map，无需把 MCP 工具迁移为 plugin custom tool。

**Fix B — exact match / fail closed**
- `resolveGateCallContextStrict` 改为：多条件 WHERE + `.all()`，命中 **≠ 1 行**（0 或 >1）一律 `return null`（fail closed），**删除 `ORDER BY created_at DESC LIMIT 1`**。
- 删除 `resolveGateCallContextBySession`（`tool_name + opencode_session_id` 松兜底）。

## 改动文件

| 文件 | 改动 |
|------|------|
| `.opencode/plugin-handlers/before/gate-call-context.ts` | before-hook 末尾注入 `output.args.call_id = callId`（Fix A） |
| `.opencode/scripts/mcp-tools/compliance-gate.ts` | `compliance_gate_check` / `compliance_gate_confirm` 的 zod schema 加 `call_id: z.string().optional()`；两处 handler 第6参数由 `undefined` 改为 `{ call_id: args.call_id }` |
| `.opencode/service/gate/mcp-confirm.ts` | 移除 `resolveGateCallContextBySession` 引用；放宽 `callContext` 接口含 `call_id?`；解析分支优先 `resolveGateCallContextStrict({ call_id })` |
| `.opencode/service/gate/session-context-service.ts` | `resolveGateCallContextStrict` 改精确匹配 + fail closed（删 LIMIT 1）；删除 `resolveGateCallContextBySession` |

## 验证结果

### 静态
- `bun --check` 4 个改动文件 → 全部 OK（无语法错误）
- `rg -n "ORDER BY updated_at DESC LIMIT 1" .opencode/service/gate` → **0 命中** ✅（blueprint §10.5）
- `rg -n "process.env.OPENCODE_SESSION_ID" .opencode/service/gate` → 仅 4 处注释，无真实调用 ✅（blueprint §10.5）
- `gate_call_context` 身份解析路径的 `ORDER BY created_at DESC LIMIT 1` 已全清；`resolveGateCallContextBySession` 已从代码移除

### 运行时（serve 重启加载新代码后 E2E）
- serve 重启（清 bun 缓存 → PID 1153610）→ compliance-gate MCP 干净加载，连通性 200
- 经 serve API 让 Orchestrator 调用 `compliance_gate_check`（带 plan_summary 触发合并流）→ 自动武装 `cg_ses_1783655017590`
- `gate_call_context` 落地 2 行，**call_id 全部已填充**：
  - id=31 `compliance_gate_check` → `call_00_JBtf…` status=completed
  - id=32 `compliance_gate_confirm` → `call_00_nqTv…` status=pending
- 解析走 `call_id` 精确路径（无 LIMIT 1 猜测）；后续 confirm 因已 armed 被拒属预期
- `gate_sessions` 绑定 0 行：本次为顶层 session（无 parent），`getParentSessionId` 返回 null → 按 `if (parentSessionId)` 跳过绑定，**符合预期**（父子绑定仅在子 agent 有父 session 时建立）

## 残留风险 / 建议
- 完整"并发双 gate 串身份"E2E 需构造带 parent 的子 agent session 交错执行，本次扁平 session 无法触发；建议在真实多 agent 编排场景下回归一次。
- `resolveGateCallContextStrict` 的 legacy `args_hash` 路径仍保留作为无 call_id 时的兜底（fail closed 已保证安全）；Fix A 全量生效后该路径实际不再触发。
