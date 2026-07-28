# ACP 双向通信完整改造方案

> **版本**: v2.1 (2026-07-01 更新)
> **审核状态**: Part A ✅ 已实装 | Part B/C/D 🔧 待实装

## 背景

当前 ACP 通信架构：

```
QoderWork → acp_send → POST /session/{id}/message (阻塞等待 Agent 完成) → 返回最终文本
Agent → acp_notify → 写 framework-state.db notifications 表
SSEListener → GET /event (实时 SSE) → 捕获 question.asked/replied + acp_notify 调用
acp_poll_events → 合并 SSE 事件 + DB 回退查询 → 返回给 QoderWork
```

**已有基础设施**（v0.5.0）：

| 组件 | 文件 | 状态 |
|---|---|---|
| SSE 事件监听 | `sse-listener.ts` | ✅ 已实现 |
| SSE+DB 混合轮询 | `acp_poll_events` (index.ts) | ✅ 已实现 |
| Guidance 投递 | `deliver_guidance` (extensions.ts) | ⚠️ 代码已写，但 DB 列 `qoderwork_session_id` 未建（见 C1 修复） |
| 独立 reader 游标 | `notification_readers` + `reader_id` | ✅ 已实现 |

**核心问题**：`acp_send` 返回时不包含等待期间 Agent 发出的 `acp_notify` 中间消息。QoderWork 必须额外调用 `acp_poll_events` 才能看到，实测中多次忘记轮询导致漏消息。

## 目标

1. `acp_send` 返回时自动附带等待期间收集的 `acp_notify` 消息
2. 利用已有 SSEListener 实现，无需新增 DB 轮询
3. 按 session 隔离 + 并发锁保证安全
4. 超时机制防止无限等待

---

## Part A：Phase-0 死锁修复 + attest 工具 ✅ 已实装

> 本部分已在 2026-07-01 完成部署。

### A1. acp_notify 加入 Phase-0 放行列表 ✅

**文件**：`.opencode/service/gate/checklist-validate.ts` + `.opencode/service/gate/phase0-enforce.ts`

两处 `INITIAL_READ_ALLOWED_TOOLS` 均已新增 `acp_notify` 和 `notify-server_acp_notify`。

### A2. attest 工具注册 ✅

已通过 Phase-0 放行列表解决。attest 工具（`config_read_attest` 等）在 Phase-0 期间不再被阻断。

---

## Part B：acp_send 返回值增强

### B1. 架构变更

```
改造前：
  acp_send → POST /session/{id}/message (阻塞) → 返回 SendResult {text, toolCalls, usage, subAgents}
  Agent 中间 acp_notify → SSEListener 捕获 → 需额外调 acp_poll_events

改造后：
  acp_send → POST /session/{id}/message (阻塞) → 返回增强 SendResult {text, toolCalls, usage, subAgents, notifications[]}
  等待期间 SSEListener 已在后台收集事件 → POST 返回后合并通知到返回值
```

**设计原则**：不改 HTTP 阻塞机制，不改 sendPrompt 内部逻辑，只在 `acp_send` handler 层做合并。

### B2. 改动文件清单

| 文件 | 路径 | 改动 |
|---|---|---|
| serve-session.ts | `acp-bridge/src/serve-session.ts` | sendPrompt() 前后记录 SSE 游标位置 |
| sse-listener.ts | `acp-bridge/src/sse-listener.ts` | 新增 `getEventsSince(sessionId?, sinceSeq?)` 按 session 过滤 |
| types.ts | `acp-bridge/src/types.ts` | 新增 `NotificationEvent` 接口，`SendResult` 扩展 `notifications` 字段 |
| index.ts | `acp-bridge/src/index.ts` | `acp_send` handler 合并 SSE 事件到返回值 |
| extensions.ts | `acp-bridge/src/extensions.ts` | `acp_events` 增加 `session_id` 过滤参数（可选） |
| db-manager.ts | `.opencode/lib/db-manager.ts` | 新增 migration：`ALTER TABLE tool_enforcement ADD COLUMN qoderwork_session_id TEXT DEFAULT ''` |

### B3. 实现逻辑

#### B3.1 SSEListener 增加按 session 过滤

```typescript
// sse-listener.ts — 新增方法
getEventsSince(options: {
  sessionId?: string;    // OpenCode session_id 过滤
  sinceSeq?: number;     // 只返回 seq > sinceSeq 的事件
  eventTypes?: string[]; // 过滤事件类型
}): SSEEvent[] {
  return this.eventBuffer.filter(e => {
    if (options.sessionId && e.sessionId !== options.sessionId) return false;
    if (options.sinceSeq !== undefined && e.seq <= options.sinceSeq) return false;
    if (options.eventTypes?.length && !options.eventTypes.includes(e.type)) return false;
    return true;
  });
}
```

#### B3.2 acp_send handler 合并逻辑

```typescript
// index.ts — acp_send handler 改造
server.tool("acp_send", ...async (args) => {
  const session = manager.getSession(args.session_id);
  if (!session) return errorResponse("Session not found");

  // 1. 记录发送前的 SSE 游标位置
  const preSeq = sseListener.getMaxSeq();

  // 2. 发送 prompt（阻塞等待 Agent 完成，不改 sendPrompt 内部）
  const result = await session.sendPrompt(args.message, args.timeout_ms);

  // 3. POST 返回后，从 SSEListener 收集等待期间的通知
  const notifications = sseListener.getEventsSince({
    sessionId: session.id,
    sinceSeq: preSeq,
    eventTypes: ["message.part.updated"], // 过滤 acp_notify 调用
  });

  // 4. 合并到返回值
  const response = {
    session_id: args.session_id,
    text: result.text.slice(0, 2000),
    tool_calls: result.toolCalls,
    context: session.contextHealth,
    has_sub_agents: result.subAgents.length > 0,
    sub_agents: ...,
    notifications: notifications.map(e => ({
      seq: e.seq,
      event_type: e.eventType,
      data: e.data,
      timestamp: e.timestamp,
    })),
  };
});
```

### B4. 类型扩展

```typescript
// types.ts — 新增
export interface NotificationEvent {
  seq: number;
  created_at: number;
  agent: string;
  session_id: string;
  event_type: string;
  data: Record<string, any>;
}

// types.ts — 扩展
export interface SendResult {
  text: string;
  toolCalls: ToolCallRecord[];
  usage: UsageInfo | null;
  subAgents: SubAgentSummary[];
  notifications?: NotificationEvent[];  // 新增：可选，向后兼容
}
```

### B5. acp_events 增加 session_id 过滤（可选增强）

```typescript
// extensions.ts — acp_events 增加可选参数
server.tool("acp_events", ..., {
  limit: z.number().optional(),
  reader_id: z.string().optional(),
  session_id: z.string().optional().describe("按 OpenCode session_id 过滤（可选）"),
}, async (args) => {
  // SQL 增加 WHERE session_id = ? 条件（当参数提供时）
  let query = "SELECT ... FROM notifications WHERE seq > ?";
  const params = [lastSeq];
  if (args.session_id) {
    query += " AND session_id = ?";
    params.push(args.session_id);
  }
  query += " ORDER BY seq ASC LIMIT ?";
  params.push(limit);
});
```

---

## Part C：并发安全

### C1. 消息隔离（现状 + 改进）

**已有机制**：

| 方向 | 机制 | 隔离字段 |
|---|---|---|
| Agent → QW (notifications) | session_id (OpenCode 内部) | notifications.session_id |
| QW → Agent (deliver_guidance) | tool_enforcement.qoderwork_session_id | ⚠️ bridge 代码已写但 DB 列未建 |
| SSE 事件读取 | SSEListener 内存环形缓冲区 | 全量（无 session 隔离） |
| DB 事件读取 | reader_id 独立游标 | ✅ per-instance 隔离 |

**当前缺口**：

- `tool_enforcement` 表缺少 `qoderwork_session_id` 列。`deliver_guidance` 的 SELECT/UPDATE SQL 会因列不存在而失败。需要在 `db-manager.ts` 增加 migration（ALTER TABLE ADD COLUMN）。
- notifications 表**没有** `qoderwork_session_id` 列。`session_id` 是 OpenCode 内部 session，通过 `session_map` 解析。
- SSEListener 当前不做 session 过滤，所有 session 的事件混在一个缓冲区。

**改进方案**：

- SSEListener 增加 sessionId 字段到事件结构，`getEventsSince()` 按 session 过滤
- 无需给 notifications 表加 `qoderwork_session_id` 列——通过 OpenCode session_id 做隔离已足够（serve-session 持有 OpenCode session.id）

### C2. Session 级 Prompt 锁

同一 OpenCode session 同时只允许一个 `acp_send` 在等待：

```typescript
// serve-session.ts 或 session-manager.ts
// 在 ServeSession 上增加状态锁
class ServeSession {
  private isPromptActive = false;

  async sendPrompt(text: string, timeoutMs?: number): Promise<SendResult> {
    if (this.isPromptActive) {
      throw new Error("Session already has an active prompt. Wait for it to complete.");
    }
    this.isPromptActive = true;
    try {
      return await this.doSendPrompt(text, timeoutMs);
    } finally {
      this.isPromptActive = false;
    }
  }
}
```

### C3. DB 读取安全

- SQLite WAL 模式：读操作不阻塞写操作 ✅
- `notification_readers` 游标机制：`seq > lastSeq` 增量读取 ✅
- 只读连接：`acp_events` 使用 `{readonly: true}` 打开 DB ✅
- 写连接：仅在更新 `notification_readers` 游标时开写连接 ✅

---

## Part D：验证计划

### D1. 基础功能验证

| Case | 操作 | 预期 |
|---|---|---|
| D1.1 | acp_send 发 prompt，agent 正常回复 | 返回 text + status=completed，notifications 为空数组 |
| D1.2 | acp_send 发 prompt，agent 中途调 acp_notify | 返回值的 notifications[] 包含通知 |
| D1.3 | acp_send 发 prompt，agent 不回复 | 超时后返回 text="(timeout)"，notifications 可能非空 |
| D1.4 | acp_send 发 prompt，agent 调多次 acp_notify | notifications[] 包含所有消息，按 seq 排序 |
| D1.5 | acp_send 返回后单独调 acp_poll_events | 返回相同/更多事件（DB 回退路径） |

### D2. 并发安全验证

| Case | 操作 | 预期 |
|---|---|---|
| D2.1 | 两个 QW session 同时 acp_send 不同 agent | 各自收到各自的通知，不串 |
| D2.2 | 同一 session 并发两个 acp_send | 第二个返回 error |
| D2.3 | acp_send 等待期间 agent 写 DB | SSE 实时捕获，POST 返回后合并 |

### D3. Phase-0 流程验证 ✅ 已验证

Part A 已实装，Phase-0 流程已通过端到端验证。

---

## 实施顺序

1. **DB Migration**：db-manager.ts 新增 `tool_enforcement.qoderwork_session_id` 列（10 分钟）
2. **B2-B4**：types.ts 扩展 + SSEListener 增加 session 过滤（30 分钟）
3. **B3.2**：acp_send handler 合并逻辑（30 分钟）
4. **B5**：acp_events session_id 过滤（10 分钟）
5. **C2**：ServeSession prompt 锁（15 分钟）
6. **D1-D2**：全量验证（1 小时）

**预计总工时：2-3 小时**

## 风险

| 风险 | 缓解 |
|---|---|
| SSE 断连期间漏事件 | SSEListener 有 3s 自动重连 + acp_poll_events DB 回退 |
| POST 返回时 SSE 事件还未到达 | 增加短延迟（100ms）或同时查 DB 兜底 |
| 返回值变大影响 LLM token | notifications 截断（最多 20 条，每条 data 截断 500 字） |
| 改造影响现有 acp_send 调用方 | notifications 字段可选，向后兼容 |
| SSEListener ring buffer 溢出（200 cap） | 短 session 够用；长 session 需增大或持久化 |

## 与 v1 Blueprint 的关键差异

| 项目 | v1 方案 | v2 方案（当前） | 原因 |
|---|---|---|---|
| 中间消息收集 | while-loop 轮询 DB | SSE 事件合并 | SSEListener 已存在，更高效 |
| sendPrompt 改造 | 替换为异步轮询 | **不改** sendPrompt 内部 | HTTP POST 本身已阻塞，无需替换 |
| 并发锁位置 | session-manager activePrompts Map | ServeSession.isPromptActive | 更贴近执行点 |
| 隔离机制 | qoderwork_session_id 列 | OpenCode session_id 过滤 | notifications 表无 qoderwork_session_id |
| DB Migration | 无 | tool_enforcement ADD COLUMN qoderwork_session_id | bridge 代码引用了但 migration 未创建 |
| 新增类型 | SendPromptResult + Notification | SendResult 扩展 + NotificationEvent | 对齐已有类型命名 |
