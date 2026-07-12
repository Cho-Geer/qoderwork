# Blueprint: ACP Bridge 优化优先级路线图

**版本**: v0.9.0+  
**日期**: 2026-07-02  
**状态**: 规划中  
**定位**: QoderWork = 用户的直接交互层 + opencode 框架 agent 管理器

---

## 一、设计原则

QoderWork 作为用户与 opencode agent 之间的**管理中枢**，核心价值是：

1. **实时可见性** — 用户随时知道 agent 在做什么、做得怎样
2. **即时干预** — 发现问题立刻纠正，不等任务失败
3. **不丢消息** — agent 的每一条汇报都被捕获和呈现
4. **多 agent 协调** — 同时管理多个 agent/sub-agent 的生命周期

基于这四点，结合 v1.17.13 可用的 SSE 事件（V1 经典事件），按价值排序。

---

## 二、已完成基线

| 版本 | 能力 | 状态 |
|------|------|:----:|
| v0.7.0 | 长轮询（acp_check）、超时不 abort POST | ✅ |
| v0.7.1 | 500+UnknownError 区分（session gone vs serve 内部错误） | ✅ |
| v0.8.0 P1 | SSE 事件追踪（session.status/idle/step.ended/text）、serve API fallback | ✅ |
| v0.8.0 P2 | 代码基础设施（tool.failed/agent.switched/retry）— 依赖 Next 事件，当前不可用 | ⚠️ |

### v1.17.13 可用 SSE 事件（V1 经典事件，/event 端点）

| 事件 | 实测数量 | 当前利用 | 潜在价值 |
|------|:-------:|:--------:|:--------:|
| `session.status` | 4 | ✅ 已追踪 | 高 |
| `session.idle` | 1 | ✅ 已追踪 | 高 |
| `message.part.updated` | 7 | ✅ 已追踪（text + acp_notify） | 高 |
| `message.part.delta` | 57 | ❌ 未追踪 | **极高** |
| `session.diff` | 2 | ❌ 未追踪 | 高 |
| `session.updated` | 4 | ❌ 未追踪 | 中 |
| `message.updated` | 6 | ❌ 未追踪 | 中 |
| `session.error` | 0 | ❌ 未追踪 | 高 |
| `server.heartbeat` | 1 | ❌ 未追踪 | 低 |

---

## 三、优化优先级（按价值排序）

### P0: 实时文本流（`message.part.delta`）

**价值**：⭐⭐⭐⭐⭐ — 用户最核心的需求：看到 agent 正在输出什么

**当前问题**：`message.part.updated` 只在文本块完成时触发（7 次/session），用户只能看到整块文本。`message.part.delta` 触发 57 次/session，是真正的流式增量。

**改动方案**：

```
sse-listener.ts:
  isRelevant() 增加 message.part.delta
  updateCompletionState() 处理 delta 事件：
    - 按 partID 追踪每个文本块的增量
    - 累积 delta.text 到 lastText
  新增方法:
    getStreamingText(sessionId) → { text, isComplete, partCount }
```

**测试用例**：

| # | Case | 操作 | 预期 |
|---|------|------|------|
| P0.1 | delta 事件捕获 | `acp_send` 发长 prompt → `acp_poll_events(session_id)` | events 中包含 `message.part.delta` 类型事件 |
| P0.2 | 流式文本累积 | agent 生成 2000+ 字 → 每 5s `acp_poll_events` | `streaming_text` 逐次增长，每次 check 比上次多 |
| P0.3 | delta vs updated 一致性 | agent 完成后对比 | delta 累积的文本 = `message.part.updated` 的完整文本 |
| P0.4 | 多 part 区分 | agent 输出多段文本（被工具调用隔开） | 不同 partID 的 delta 分别追踪 |
| P0.5 | acp_check SSE 返回 | 超时 pending → `acp_check` | SSE 返回的 text 来自 delta 累积（更完整） |

---

### P1: 工具调用追踪（`message.part.updated` type=tool）

**价值**：⭐⭐⭐⭐⭐ — 用户需要知道 agent 在调用什么工具（特别是写操作）

**当前问题**：bridge 只追踪 `message.part.updated` 中 `type=text` 和 `tool=acp_notify` 的事件。不追踪普通工具调用。用户无法实时知道 agent 在做什么。

**改动方案**：

```
sse-listener.ts:
  isRelevant() 扩展 message.part.updated：
    - part.type === "tool" 时也返回 true
  updatePhase2State() 新增工具调用追踪：
    - 记录 toolName, status, input summary
  新增方法:
    getToolCalls(sessionId, since?) → ToolCallInfo[]
    getLastToolCall(sessionId) → ToolCallInfo | null
```

**数据结构**：

```typescript
interface ToolCallInfo {
  timestamp: number;
  toolName: string;
  status: "started" | "completed" | "error";
  inputPreview: string;  // 前 100 字符
  outputPreview?: string;
}
```

**测试用例**：

| # | Case | 操作 | 预期 |
|---|------|------|------|
| P1.1 | 工具调用捕获 | agent 执行 `read` + `bash` → `acp_poll_events(session_id)` | events 中包含 tool 类型的 `message.part.updated` |
| P1.2 | 写操作检测 | agent 执行 `write` → `acp_poll_events` | tool_failures 或 tool_calls 中出现 `write`/`safe_edit` |
| P1.3 | 工具链追踪 | agent 连续调用 5 个工具 → `acp_poll_events` | 5 条 tool call 记录，按时间排序 |
| P1.4 | acp_check pending 增强 | pending 状态 → `acp_check` | 返回最近工具调用列表 |
| P1.5 | 死循环工具检测 | agent 反复调用同一工具 → `acp_poll_events` | 标记重复工具调用 + 计数 |

---

### P2: Sub-agent 生命周期监控（`/children` API 轮询）

**价值**：⭐⭐⭐⭐ — 用户需要知道 Orchestrator dispatch 了哪些 sub-agent

**当前问题**：sub-agent 追踪只在 POST 返回后通过 `refreshSubAgents()` 获取。pending 期间无法知道是否有 sub-agent 被 dispatch。V1 SSE 不发 `agent.switched` 事件。

**改动方案**：

```
serve-session.ts:
  新增 refreshSubAgentsPeriodic()：
    - 在 sendPrompt 后台 POST 期间，每 10s 调用一次 refreshSubAgents()
    - 新发现的 sub-agent 记录到 subAgents Map

index.ts:
  acp_check 增加 sub-agent 状态：
    - 如果 subAgents Map 有新条目，在返回中包含
  acp_poll_events 增加 sub-agent 状态：
    - 返回当前活跃的 sub-agent 列表
```

**测试用例**：

| # | Case | 操作 | 预期 |
|---|------|------|------|
| P2.1 | sub-agent 实时发现 | Orchestrator dispatch Super-Admin → `acp_check` | 返回 `sub_agents` 包含 Super-Admin |
| P2.2 | 多 sub-agent 追踪 | dispatch 2+ sub-agent → 多次 `acp_check` | 每次 check 返回递增的 sub-agent 数量 |
| P2.3 | sub-agent 状态变化 | sub-agent 完成 → `acp_check` | sub-agent 状态从 running → completed |
| P2.4 | sub-agent 通知路由 | sub-agent 发 acp_notify → `acp_poll_events` | 通知中包含 sub-agent 的 session_id |
| P2.5 | pending 期间 sub-agent | pending → sub-agent dispatch → `acp_check` | pending 响应中包含新 sub-agent 信息 |

---

### P3: Session 错误检测（`session.error`）

**价值**：⭐⭐⭐⭐ — 早期检测 agent 致命错误

**当前问题**：`session.error` 事件已注册但从未在实测中触发（0 次）。可能是 serve 只在特定条件下发送。需要确认触发条件。

**改动方案**：

```
sse-listener.ts:
  isRelevant() 已包含（通过 session.status 分支）
  updateCompletionState() 新增 error 处理：
    - 记录 error 信息到 completion state
  新增方法:
    getSessionError(sessionId) → SessionError | null

index.ts:
  acp_check 增加 error 检测：
    - 如果有 session.error，立即返回 status: "error"
```

**测试用例**：

| # | Case | 操作 | 预期 |
|---|------|------|------|
| P3.1 | error 事件触发 | 触发 agent 致命错误（如 context overflow） | `session.error` 事件被捕获 |
| P3.2 | error 快速返回 | error 发生 → `acp_check` | 返回 `status: "error"` + 错误信息 |
| P3.3 | error vs pending | error 在 pending 期间发生 | acp_check 优先返回 error（不等 POST） |
| P3.4 | error 恢复 | error 后 agent 自动重试 | 状态从 error → busy → idle |

---

### P4: 文件变更追踪（`session.diff`）

**价值**：⭐⭐⭐ — 用户需要知道 agent 修改了哪些文件

**当前问题**：`session.diff` 事件已发送（2 次/session），但 bridge 不追踪。用户只能通过 POST 返回或手动检查才知道文件被修改。

**改动方案**：

```
sse-listener.ts:
  isRelevant() 增加 session.diff
  新增 fileChanges Map<string, FileChange[]>
  updatePhase2State() 处理 diff 事件：
    - 记录文件名、变更类型（add/modify/delete）
  新增方法:
    getFileChanges(sessionId, since?) → FileChange[]

类型:
  interface FileChange {
    timestamp: number;
    fileName: string;
    changeType: "add" | "modify" | "delete";
    additions: number;
    deletions: number;
  }
```

**测试用例**：

| # | Case | 操作 | 预期 |
|---|------|------|------|
| P4.1 | diff 事件捕获 | agent 修改文件 → `acp_poll_events(session_id)` | events 中包含 `session.diff` 事件 |
| P4.2 | 文件名解析 | agent 修改 test.ts → `acp_poll_events` | file_changes 包含 `test.ts` |
| P4.3 | 多文件变更 | agent 修改 3 个文件 → `acp_poll_events` | 3 条 FileChange 记录 |
| P4.4 | acp_check 集成 | agent 修改文件 → `acp_check` | 返回包含 file_changes 摘要 |

---

### P5: Bridge 会话恢复（进程重启后自动重连）

**价值**：⭐⭐⭐ — 当前 bridge 重启后所有 session 丢失

**当前问题**：bridge 进程重启（connector disable/enable、crash）后，sessions Map 清空。serve 上的 session 仍在运行，但 bridge 不知道。用户必须手动 acp_start 重建 session。

**改动方案**：

```
session-manager.ts:
  startSession() 时检测 serve 上已有的 session：
    - GET /session 获取所有活跃 session
    - 对比本地 Map，将 serve 上有但本地没有的 session 加入 Map
  新增 recoverSessions() 方法：
    - 在 bridge 启动时自动调用
    - 遍历 serve session 列表，为每个 session 创建 ServeSession 对象

index.ts:
  main() 中 bridge 启动后调用 recoverSessions()
```

**测试用例**：

| # | Case | 操作 | 预期 |
|---|------|------|------|
| P5.1 | 自动恢复 | 创建 session → 重启 bridge → `acp_list` | session 仍在列表中 |
| P5.2 | 状态恢复 | 恢复的 session → `acp_send` | 正常发送消息 |
| P5.3 | 多 session 恢复 | 创建 3 个 session → 重启 → `acp_list` | 3 个 session 全部恢复 |
| P5.4 | stale 清理 | serve 重启 → bridge 重启 → `acp_list` | stale session 被自动清理 |

---

### P6: Token 使用量累计追踪

**价值**：⭐⭐⭐ — 用户需要监控 token 消耗

**当前问题**：token 使用量只在 POST 返回时更新。长任务期间无法知道已消耗多少 token。`message.part.updated` 中的 `step.ended` 事件（如果可用）可以提供中间数据。

**改动方案**：

```
sse-listener.ts:
  在 message.part.updated 中追踪 usage 信息
  新增 tokenUsage Map<string, TokenUsage>
  新增方法:
    getAccumulatedUsage(sessionId) → TokenUsage | null

serve-session.ts:
  contextHealth 增加 accumulated 字段
  每次 acp_send/acp_check 时合并 SSE 追踪的 usage
```

**测试用例**：

| # | Case | 操作 | 预期 |
|---|------|------|------|
| P6.1 | 中间 token 追踪 | 长任务 → 每 10s `acp_poll_events` | token 使用量逐次增长 |
| P6.2 | 累计准确性 | 任务完成 → 对比 POST 返回的 usage | SSE 累计 ≈ POST 返回 |
| P6.3 | context warning | token 接近阈值 → `acp_check` | context.health = "warning" |

---

### P7: `acp_poll_events` 增强 — session_id 过滤

**价值**：⭐⭐ — 当前返回所有 session 的事件，噪音大

**当前问题**：`acp_poll_events` 返回所有 session 的事件。多 session 场景下，用户需要按 session 过滤。

**改动方案**：

```
index.ts:
  acp_poll_events 的 session_id 参数（已有）增加事件过滤：
    - events 按 sessionId 过滤
    - phase2_status 按 sessionId 查询
```

**测试用例**：

| # | Case | 操作 | 预期 |
|---|------|------|------|
| P7.1 | session 过滤 | 2 个 session → `acp_poll_events(session_id=A)` | 只返回 A 的事件 |
| P7.2 | 无 session_id | `acp_poll_events()` | 返回所有事件（向后兼容） |

---

## 四、实施路线图

```
Week 1: P0 (实时文本流) + P1 (工具调用追踪)
         → 用户获得 agent 实时可见性
         
Week 2: P2 (Sub-agent 生命周期) + P3 (错误检测)
         → 用户获得多 agent 管理能力
         
Week 3: P4 (文件变更) + P5 (会话恢复)
         → bridge 稳定性和文件级可见性
         
Week 4: P6 (Token 追踪) + P7 (事件过滤)
         → 运维和监控完善
```

## 五、与 Next 事件的关系

当前 serve v1.17.13 不支持 Next 事件（`session.next.*`）。以下能力**依赖 Next 事件**，暂不实装但保留代码：

| 能力 | 需要的事件 | 当前替代方案 |
|------|-----------|-------------|
| agent 切换追踪 | `session.next.agent.switched` | P2: `/children` API 轮询 |
| tool 失败实时检测 | `session.next.tool.failed` | P1: `message.part.updated` type=tool |
| retry 循环感知 | `session.status` retry 子字段 | P3: `session.error` + retry 计数 |
| step 结束 usage | `session.next.step.ended` | P6: `message.part.updated` usage 累积 |

**当 serve 升级支持 Next 事件时**，v0.8.0 Phase 2 的代码可以直接启用，无需额外改动。

## 六、文件变更预估

| 文件 | P0 | P1 | P2 | P3 | P4 | P5 | P6 | P7 |
|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| sse-listener.ts | +40 | +50 | | +20 | +30 | | +20 | |
| serve-session.ts | | | +30 | | | +40 | +10 | |
| index.ts | +20 | +30 | +20 | +15 | +15 | +10 | +10 | +10 |
| types.ts | +10 | +15 | +10 | +5 | +15 | | +10 | |
| **合计** | **70** | **95** | **60** | **40** | **60** | **50** | **40** | **20** |

**总计**: ~435 行新增代码

---

## 七、验证策略

每个优先级完成后执行：

1. **冒烟测试** — 对应 P*.* 测试用例全部 PASS
2. **回归测试** — 模块 1（Session 生命周期）4/4 PASS + 模块 2（长轮询）6.5/7 PASS
3. **TypeScript 检查** — `bunx tsc --noEmit` 零错误
4. **构建验证** — `bun build` 成功，零 warning
