# 新增 OpenCode Session ID 获取对照表

**为什么**: 用户需要一个可复用的对照表，说明主 Agent / ACP / CLI / 子 Agent 派发等不同入口下，OpenCode session id 是否新建、如何获取、以及 `OPENCODE_SESSION_ID` 是否可靠。

**改了什么**:
- `documents/opencode-framework/session-id-acquisition-matrix.md` — 新增对照表文档，覆盖主会话、`/new`、`opencode run`、ACP、`dispatch_subagent`、独立 MCP 进程等路径
- `documents/INDEX.md` — 新增索引条目和场景推荐入口

**决策**: 采用“创建入口 / 是否新建 session / 最可靠获取位置 / 环境变量是否可依赖”四个核心维度组织内容，明确把 `input.sessionID/context.sessionID` 作为主路径，把 `OPENCODE_SESSION_ID` 降为辅助信号，避免未来继续把环境变量误当统一真相源。
