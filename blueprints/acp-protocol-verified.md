# ACP 协议集成验证报告

**日期**: 2026-06-28
**状态**: 验证通过，可进入实装阶段

## 验证结论

ACP（Agent Client Protocol）是 QoderWork ↔ OpenCode 集成的最佳通道。完整 round-trip 测试通过。

## 协议交互流程

```
Client (QoderWork)                    Server (opencode acp)
    │                                        │
    │── initialize ──────────────────────────>│
    │<── agentCapabilities, agentInfo ───────│
    │                                        │
    │── session/new {agent, cwd} ────────────>│
    │<── sessionId, configOptions, commands ─│
    │<── available_commands_update (notify) ──│
    │                                        │
    │── session/prompt {sessionId, msg} ─────>│
    │<── agent_thought_chunk ×N (流式思考) ──│
    │<── agent_message_chunk ×N (流式输出) ──│
    │<── usage_update (token 消耗) ──────────│
    │<── {stopReason, usage} (最终响应) ─────│
    │                                        │
    │── session/close ───────────────────────>│
    │<── {} ─────────────────────────────────│
```

## 关键数据

| 指标 | 值 |
|------|-----|
| 协议版本 | 1 (protocolVersion) |
| 传输方式 | stdio JSON-RPC 2.0 |
| 流式通知数 | 86 个 session/update 事件 |
| 思考 token | 83 (agent_thought_chunk) |
| 输出 token | 2 (最终答案 "2") |
| 输入 token | 113,592 (含框架上下文) |
| 会话能力 | close, fork, list, resume |

## 事件类型

- `agent_thought_chunk` — Agent 内部推理过程，逐 chunk 流式推送
- `agent_message_chunk` — Agent 最终输出，逐 chunk 流式推送
- `usage_update` — 实时 token 消耗（used/size/cost）
- `available_commands_update` — 可用 skill/command 列表

## 对比 opencode run

| 维度 | `opencode run` | `opencode acp` |
|------|---------------|-----------------|
| 交互模式 | Fire-and-forget | 持久双向 |
| 流式输出 | 无 | 有（thought + message） |
| 多轮对话 | 不支持 | 支持（同一 sessionId） |
| 观察推理过程 | 不可能 | 可以（thought_chunk） |
| Token 追踪 | 无 | 有（usage_update） |
| 会话恢复 | 不可能 | 可以（session/resume） |
| 会话分叉 | 不可能 | 可以（session/fork） |
| 适用场景 | 一次性任务投放 | 交互式协作 |

## 集成架构方向

```
QoderWork (外层协调)
    │
    ├── 简单查询 → 直接 bash (codegraph CLI, sqlite3, etc.)
    │
    ├── 一次性任务 → opencode run --agent <name> "msg"
    │
    └── 交互式协作 → opencode acp (stdio JSON-RPC)
         ├── 需要观察推理过程的任务
         ├── 多轮对话式调试
         ├── 需要实时反馈的复杂任务
         └── 跨 Agent 协作编排
```

## 待解决

1. **ACP Server 生命周期管理** — 谁启动/停止 opencode acp 进程？QoderWork session 级别还是 task 级别？
2. **权限控制** — ACP session 是否继承 opencode.json 的 permission 配置？
3. **审计日志** — ACP 交互是否自动写入 audit_log 表？
4. **Gate 系统交互** — ACP session 中的 Agent 能否触发 Gate 门禁？
5. **并发** — 多个 ACP session 能否并行（不同 agent）？

## 测试脚本

`/tmp/acp-test.ts` — bun 脚本，完整实现 initialize → session/new → session/prompt → session/close 流程。
