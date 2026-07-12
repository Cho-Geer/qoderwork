# 新增 MCP session 传播实施方案

**为什么**: 用户需要一份弱模型也能执行的详细方案，解决独立 MCP 工具如何稳定获取主/子 OpenCode session 身份，以及如何在 compliance gate 链中移除环境变量依赖并建立并发安全的父子 session 绑定；后续又要求补齐“用户手动中断任务”的影响处理，并明确 MVC / service / logging 约束。

**改了什么**:
- `plans/mcp-session-propagation/blueprint-mcp-session-propagation.md` — 更新为唯一实施路径，补充中断上下文生命周期、MVC 分层、service 层统一 DB/业务状态迁移、日志系统统一接入、以及不可选的落地顺序

**决策**: 采用 Hook 采集 `sessionID/callID` → DB context bridge → MCP service exact lookup 的设计，明确禁止 `process.env.OPENCODE_SESSION_ID` 和“最近一条 session”推断；中断后的旧 context 永不复用，controller 不直写 SQL，所有 DB/业务操作统一进 service 层，所有正式运行时日志统一走现有 log system。
