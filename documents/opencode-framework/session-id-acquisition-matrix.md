# OpenCode Session ID 获取对照表

**版本**: v1.0.0  
**创建日期**: 2026-07-09  
**状态**: 现状核对文档  
**适用范围**: `work-one` 当前主链路、ACP、CLI、子 Agent 派发

---

## 1. 先说结论

在 `work-one` 当前代码里，**主 Agent 的 OpenCode session id 最可靠的来源是 OpenCode 上游运行时上下文**：

- 插件 Hook: `input.sessionID`
- 工具执行: `context.sessionID`

`process.env.OPENCODE_SESSION_ID` **不能当统一真相源**。它在某些脚本/子进程链路里可用，但在独立 MCP 进程里并不可靠，不能假设总是存在。

---

## 2. 对照表

| 创建/进入途径 | 是否新建 OpenCode session | Session ID 形式 | 当前链路是否能拿到主 session id | 最可靠获取位置 | `OPENCODE_SESSION_ID` 是否可依赖 | 说明 |
|---|---|---|---|---|---|---|
| `opencode` TUI 首次进入对话 | 是 | `ses_*` | 能 | `input.sessionID` / `context.sessionID` | 否 | 主对话建立后，后续轮次共享同一个 `ses_*` |
| TUI 内普通多轮对话 | 否，复用当前 session | 同一个 `ses_*` | 能 | `input.sessionID` / `context.sessionID` | 否 | 不会因新一轮消息改变 session id |
| TUI `/new` | 是 | 新的 `ses_*` | 能 | `input.sessionID` / `context.sessionID` | 否 | `/new` 会切到全新 session |
| `opencode run --agent X "..."` | 是 | 新的 `ses_*` | 通常能 | 上游 session 上下文 | 不应假设 | 非交互式，但底层仍是 OpenCode session |
| `opencode run --continue` | 否，复用上一个 session | 已有 `ses_*` | 通常能 | 上游 session 上下文 | 不应假设 | 继续已有 session，不创建新 id |
| `opencode run --session <id>` | 否，复用指定 session | 指定 `ses_*` | 通常能 | 上游 session 上下文 | 不应假设 | 直接挂到已知 session |
| `opencode run --fork` | 是，基于旧 session 分叉 | 新的 `ses_*` | 通常能 | 上游 session 上下文 | 不应假设 | 会得到新的 session，同时保留来源关系 |
| `opencode acp` `session/new` | 是 | 新的 `ses_*` | 能 | `session/new` 返回值；随后 `session/prompt` 的 `sessionId` | 不相关 | ACP 是最显式的一条链路，客户端直接拿返回的 `sessionId` |
| `opencode serve` / Web 创建会话 | 是 | 新的 `ses_*` | 能 | 上游 session 上下文 / API 返回 | 不应假设 | 本质仍是 OpenCode 上游创建 session |
| `dispatch_subagent -> Task()` 子 Agent 派发 | 是 | 新的子 session `ses_*` | 能 | 子会话自己的 `input.sessionID` / `context.sessionID` | 在脚本链路里常可用，但不应作统一依赖 | 每次派发都会创建新子 session，并通过 `parent_id` 关联父 session |
| `resume_session_id` 恢复子 Agent | 否，复用已有子 session | 已有子 session `ses_*` | 能 | 恢复后的运行时上下文 | 不应假设 | 这是恢复子 session，不是回到父 session |
| 独立 MCP 服务进程内直接读环境变量 | 不一定 | 不确定 | 不稳定 | 无 | 否 | 这是当前 `compliance-gate` 问题的根源之一：不能把它当必有字段 |

---

## 3. 分层理解

### 3.1 “Session 存在” 和 “当前代码能直接拿到” 不是一回事

几乎所有正常创建路径都会产生 OpenCode 自己的 `ses_*`。  
但某段代码能不能拿到，取决于它运行在什么层：

- **插件/工具层**：通常直接有 `input.sessionID` 或 `context.sessionID`
- **dispatch 脚本/子进程层**：有时能通过环境变量拿到
- **独立 MCP 服务层**：不能假设环境变量一定被注入

所以要区分：

1. OpenCode 有没有创建 session
2. 当前这段框架代码有没有拿到 session 上下文
3. 当前代码是不是只能靠环境变量猜

### 3.2 主 Agent 和子 Agent 的 session 关系

- 主 Agent 对话有自己的 `ses_*`
- 每次 `dispatch_subagent` 都会创建新的子 Agent `ses_*`
- 子 session 不复用父 session
- 父子关系靠 `ParentSessionID` / `parent_id` 关联，不是共用同一个 session id

---

## 4. 在 `work-one` 当前代码中的主路径

### 4.1 主链路：`session.created`

`session` 插件在 `session.created` 钩子里直接读取：

- `input.sessionID`
- 若兼容载荷变体，则退到 `input.session?.id`

随后会把该值写入 `session_map`，并尝试从 OpenCode SDK session 表里补 `parent_id`。

这说明当前框架的**主设计假设**是：

- Session ID 来自上游事件载荷
- `session_map` 是框架内的规范化落点

### 4.2 ACP 链路

ACP 的 `session/new` 直接返回 `sessionId`。  
这条链路最明确，因为客户端在创建时就拿到 id，不需要依赖 Hook 或环境变量补捞。

### 4.3 Gate / MCP 链路的现状限制

`mcp-check.ts` 和 `mcp-confirm.ts` 里仍在尝试读取：

```ts
process.env.OPENCODE_SESSION_ID
```

这在某些场景下可用，但不能覆盖“独立 MCP 服务进程未注入该环境变量”的情况。  
因此它更适合做：

- 已知进程链路中的辅助信号
- 兜底

不适合做：

- caller identity 的唯一来源
- gate 审批身份的唯一绑定依据

---

## 5. 排查建议

### 5.1 如果你要拿“主 Agent 当前 session id”

优先顺序建议：

1. 当前 Hook / Tool 上下文里的 `input.sessionID` 或 `context.sessionID`
2. 框架落库后的 `session_map.session_id`
3. 仅在确定运行环境会注入时，再看 `process.env.OPENCODE_SESSION_ID`

### 5.2 如果你要在跨进程链路上传递它

优先顺序建议：

1. 在 before-hook 里记录当前调用的 `sessionID`
2. 写入 DB 关联表，例如 `approval_read_context`
3. 通过受控字段传递 `parent_session_id` / `child_session_id`
4. 无法精确绑定时 fail closed

不要使用：

- `SELECT ... ORDER BY updated_at DESC LIMIT 1` 这种“最近会话猜测”
- “某个 privileged agent 最近出现过”这种弱绑定

---

## 6. 适合回答的两个具体问题

### Q1. 主 Agent 的 OpenCode session id 如何获取？

答：在当前框架里，优先从 `input.sessionID` / `context.sessionID` 获取；这是主路径。

### Q2. 目前几种创建 session 的途径，是否都会能获取到 OpenCode session id？

答：**正常创建路径都会有 OpenCode session id**；但**不是每一层代码都能直接靠环境变量拿到**。  
插件和工具层通常能直接拿到；独立 MCP 服务层不能假设 `OPENCODE_SESSION_ID` 一定存在。

---

## 7. 相关文件

- `.opencode/plugins/session.ts`
- `.opencode/service/session/lifecycle.ts`
- `.opencode/tools/dispatch_subagent.ts`
- `.opencode/scripts/command-tools/dispatch-subagent.ts`
- `documents/opencode-framework/session-concepts-complete.md`
- `documents/opencode-framework/opencode-cli-acp-integration.md`
