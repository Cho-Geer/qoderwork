# mcp-confirm fallback 修复 — 源码确认与修复设计 (2026-07-10)

> 触发: 用户要求结合官方文档 + source 确认 `mcp-confirm.ts` 仍保留 `created_at DESC LIMIT 1` fallback 的修复前提——`call_id` 能否从 before-hook 透传到 MCP tool handler。
> 结论: ✅ 可以透传，机制已源码确认。Fix A 形态确定为 `output.args` 注入（非 map / 非 custom-tool 迁移）。

## 一、权威源码确认（@opencode-ai/plugin v1.17.18 类型定义）

```typescript
"tool.execute.before"?: (input: {
    tool: string;
    sessionID: string;
    callID: string;        // typed, 必存在
}, output: {
    args: any;             // 可变，工具实际收到的参数
}) => Promise<void>;

"tool.execute.after"?: (input: {
    tool: string; sessionID: string; callID: string; args: any;
}, output: { title: string; output: string; metadata: any }) => Promise<void>;
```

配套官方文档证据:
- Plugins 文档示例 `output.args.command = escape(...)`（对 `bash` 工具）——证明 `output.args` 是派发给工具的参数，before-hook 可改。
- MCP Servers 文档: "MCP server tools are registered with server name as prefix… available as tools in OpenCode, alongside built-in tools… managed like any other tool"——故 `tool.execute.before/after` 对 MCP 工具同样触发。

## 二、断点精确定位（基于已读项目代码）

| 位置 | 现状 | 后果 |
|------|------|------|
| `gate-call-context.ts:39-56` | before-hook 读 `input.callID`，写 `gate_call_context` 行含 `call_id` | DB 有 call_id ✅ |
| `gate-call-context.ts:59-61` | 仅写 `input._gateCallContextId`（before/after 共享 `input`） | after-hook 可读；**MCP handler 收不到** ❌ |
| `compliance-gate.ts:84-101` (confirm schema) | zod `inputSchema` 无 `call_id` 字段 | 即便注入 `args.call_id` 也可能被 schema 剥离 ❌ |
| `compliance-gate.ts:71,103` | `confirmGateSession(..., undefined /*callContext*/, args)` | 走自动查找分支，无 call_id ❌ |
| `session-context-service.ts:273-280` | `resolveGateCallContextStrict` 用 `ORDER BY created_at DESC LIMIT 1` | 取最近一条而非精确命中 ❌ |
| `session-context-service.ts:325` | `resolveGateCallContextBySession` 更松兜底 | `tool_name + opencode_session_id` 误匹配 ❌ |

## 三、修复设计（形态已确定）

### Fix A — 透传 call_id（直接 pass-through）
`gate-call-context.ts` before-hook 末尾，替换原有 `input._gateCallContextId` 两行:
```ts
if (contextId) {
  output.args = output.args || {};
  output.args.call_id = callId;              // 注入 call_id
  output.args._gateCallContextId = contextId;
}
```
相关 MCP 工具 zod schema 加可选字段（项目自管 server）:
```ts
call_id: z.string().optional(),
```
confirm handler 改为:
```ts
confirmGateSession(args.session_id, args.plan_summary, args.agent,
  args.task_id, args.declared_deliverables, { call_id: args.call_id }, args);
```

### Fix B — exact match / fail closed（蓝图 §1 / §10.5）
- `resolveGateCallContextStrict`: WHERE 加 `call_id=?`；**删除 `ORDER BY created_at DESC LIMIT 1`**；命中 ≠ 1 行 → `return null`。
- **删除 `resolveGateCallContextBySession`**（:`325` 松兜底）。
- `confirmGateSession`: `resolveGateCallContextStrict` 返回 null → 返回 `rejected`（不 arm、不 bind parent/child）。

## 四、验证
- 静态: `rg -n "ORDER BY .* DESC LIMIT 1" .opencode/service/gate` → 零命中（蓝图 §10.5）。
- 动态: 并发双 gate（session A→gate A / session B→gate B 交错）后查 `gate_sessions.parent/child` 绑定是否串身份。
- 单点确认: 改完跑一次 E2E，验证 OpenCode 把 `output.args`（含注入 `call_id`）原样派发到 MCP server handler。

## 五、与上轮差异
上轮 Fix A 因不确定 MCP handler 能否拿 callID，列为「直接透传 vs 进程内 map vs 自定义 tool 迁移」三选一待定。本次源码确认: **handler 经 `output.args` 拿 callID**，故采用「直接透传」，排除 map 与迁移两方案。
