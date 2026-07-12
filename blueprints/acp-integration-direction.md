# ACP 实时对话集成方向

**日期**: 2026-06-28
**状态**: 规划中

## 背景

当前框架的 Agent 间通信全靠 DB 异步协调（dispatch_subagent + gate_sessions + substate_kv），本质是"留言板"模式——Agent 之间不直接对话，靠共享状态间接衔接。

原生 OpenCode 已内置两个未被利用的能力：
- `opencode run --agent <name> "<msg>"` — 非交互式任务投放
- `opencode acp` — Agent Client Protocol 实时对话 Server

二进制路径：`/home/zhaoge/.opencode/bin/opencode`

## 设计方向

两套通信机制并存，各管各的场景：

| 机制 | 场景 | 特点 |
|------|------|------|
| 异步管道（现有） | 关键路径：DAG 调度、Gate 门禁、产物审批 | 可审计、可回溯、结构化 |
| ACP 实时对话（新增） | 探索性协作：Agent 间协商、调试讨论、接口对齐 | 灵活、多轮、低延迟 |

## 待设计

- ACP Server 的生命周期管理（随框架启动？按需启动？）
- Agent 间 ACP 对话的权限控制（谁跟谁可以对话）
- ACP 对话的审计记录（写入 audit_log？）
- ACP 与现有 Gate 系统的交互（对话中达成的共识如何提交 Gate 审批）
- QoderWork 作为 ACP Client 的可能性（通过 `opencode attach` 直接指挥 Agent）

## 关联

- File Guard 统一 API（另一个架构演进方向，见 session-context-2026-06-28.md）
- 认知地图 Layer 3（关键执行流的函数级拆解，需要理解 ACP 交互流）
