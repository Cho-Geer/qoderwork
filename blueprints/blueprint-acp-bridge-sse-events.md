# Blueprint: ACP Bridge v0.8.0 — SSE 驱动早期完成检测 + 事件集成

**版本**: v0.8.0  
**日期**: 2026-07-02  
**状态**: 方案设计完成，待实装  
**前置依赖**: v0.7.0 长轮询（已完成）、v0.7.1 500 错误区分（已完成）

---

## 一、问题背景

### 1.1 当前缺陷

Test 2.6 暴露：agent 已完成并发送 summary，但 `acp_check` 持续返回 `pending`。

**根因**：`acp_check` 只检查 `_completedResult`（POST 完成后才设置），不检查 agent 实际状态。serve 的 POST 需要等整个响应 buffer 完成才返回，而 SSE 事件是流式的——`session.status: idle` 在 agent 完成时立即到达，比 POST 更早。

### 1.2 实测数据

| 事件 | 端点 | 时序 |
|------|------|------|
| `session.status` → `{type: "busy"}` | `/event` ✅ | POST 发送后立即 |
| `session.status` → `{type: "idle"}` | `/event` ✅ | agent 完成时 |
| `session.idle` → `{sessionID}` | `/event` ✅ | 与 status.idle 同时 |
| `/api/event`, `/global/event` | 无事件 ❌ | 不发送 session 事件 |

**结论**：`GET /event` 端点（当前 bridge 已连接）发送 `session.status` 事件，可以直接利用。

---

## 二、改进方案

### 2.1 核心思路

```
当前:  acp_check 只看 _completedResult（POST 完成后才有）
改进:  acp_check 同时检查 SSE completion signal（agent idle 即可返回）
```

### 2.2 数据流

```
POST /session/{id}/message  ─────────────────────────────────→  完整响应（慢）
SSE /event ──→ session.status:busy ──→ step.ended ──→ session.status:idle  （快）
                                                                 ↓
                                                    sse-listener 标记 session idle
                                                                 ↓
                                                    acp_check 检测到 idle → 用 SSE 累积的 text + step.ended 的 usage 返回
```

### 2.3 改进效果

| 场景 | 当前行为 | 改进后 |
|------|---------|--------|
| 短 prompt（<5s） | POST 直接返回 completed | 不变（POST 更快） |
| 长 prompt（>30s） | acp_check 持续 pending 直到 POST 完成 | SSE idle 到达后立即返回 completed（source: "sse"） |
| agent dispatch sub-agent | POST 等所有 sub-agent 完成 | SSE idle 在 primary agent 完成时到达，可提前返回 |
| POST 卡住/超时 | 永远 pending | SSE idle 仍然会到达，可返回结果 |

---

## 三、SSE 事件集成方案

### 3.1 分阶段集成计划

#### Phase 1：早期完成检测（立即实装）

| 事件 | 用途 | 改动文件 |
|------|------|---------|
| `session.status` → `{type: "idle"}` | 检测 agent 完成 | sse-listener.ts |
| `session.status` → `{type: "busy"}` | 检测 agent 开始处理 | sse-listener.ts |
| `session.next.step.ended` | 早期 usage/cost/finish 数据 | sse-listener.ts |
| `message.part.updated` (type: "text") | 流式文本累积 | sse-listener.ts |

**改动量**：~40 行

#### Phase 2：实时拦截 + 多 Agent 可见性（下一轮）

| 事件 | 用途 | 改动文件 |
|------|------|---------|
| `session.next.tool.failed` | 实时检测 tool 失败（codegraph-enforce 拦截等） | sse-listener.ts |
| `session.next.agent.switched` | Sub-agent 切换追踪 | sse-listener.ts |
| `session.status` → `{type: "retry"}` | 重试循环感知 | sse-listener.ts |

**改动量**：~50 行

#### Phase 3：完善度提升（按需）

| 事件 | 用途 | 改动文件 |
|------|------|---------|
| `session.error` | 早期错误检测 | sse-listener.ts |
| `session.next.compaction.started/ended` | 上下文压缩感知 | sse-listener.ts |
| `session.idle` | 兼容旧版 idle 事件 | sse-listener.ts |

**改动量**：~30 行

#### Phase 4：流式输出增强（可选）

| 事件 | 用途 | 改动文件 |
|------|------|---------|
| `session.next.text.delta` | 最细粒度文本流（数据量大，需评估） | sse-listener.ts |
| `session.next.shell.started/ended` | Shell 命令追踪 | sse-listener.ts |

**改动量**：~40 行

---

## 四、Phase 1 实施细节

### 4.1 `sse-listener.ts` 变更

#### 4.1.1 扩展 `isRelevant()` 过滤器

```typescript
function isRelevant(evt: any): boolean {
  const type = evt.type || "";
  
  // 现有过滤器
  if (type === "question.asked" || type === "question.replied") return true;
  if (type === "message.part.updated") {
    const part = evt.properties?.part;
    if (part?.type === "tool" && part?.tool === "notify-server_acp_notify") return true;
    if (part?.type === "text") return true;  // ← 新增：追踪文本输出
  }
  
  // Phase 1 新增
  if (type === "session.status") return true;      // busy/idle/retry
  if (type === "session.idle") return true;          // 兼容旧版
  if (type === "session.next.step.ended") return true; // 早期 usage 数据
  
  return false;
}
```

#### 4.1.2 新增 per-session 完成状态追踪

```typescript
// 新增字段
private sessionCompletion: Map<string, {
  idle: boolean;              // session.status → idle 已收到
  busy: boolean;              // session.status → busy 已收到
  lastText: string;           // 累积的文本输出
  lastTextAt: number;         // 最后文本时间戳
  stepEnded: {                // 最近的 step.ended 数据
    finish: string;
    cost: number;
    tokens: { input: number; output: number; reasoning: number };
  } | null;
}> = new Map();
```

#### 4.1.3 事件处理逻辑

在 `readStream` 的事件处理循环中新增：

```typescript
// session.status 处理
if (evt.type === "session.status") {
  const props = evt.properties || evt;
  const sid = props.sessionID;
  const statusType = props.status?.type;
  
  let c = this.sessionCompletion.get(sid) || {
    idle: false, busy: false, lastText: "", lastTextAt: 0, stepEnded: null
  };
  
  if (statusType === "idle") {
    c.idle = true;
    console.error(`[SSEListener] Session ${sid} → idle`);
  } else if (statusType === "busy") {
    c.busy = true;
    c.idle = false;  // 重置 idle 状态
  } else if (statusType === "retry") {
    console.error(`[SSEListener] Session ${sid} → retry (attempt ${props.status?.attempt})`);
  }
  
  this.sessionCompletion.set(sid, c);
}

// session.next.step.ended 处理
if (evt.type === "session.next.step.ended") {
  const props = evt.properties || evt;
  const sid = props.sessionID;
  
  let c = this.sessionCompletion.get(sid) || {
    idle: false, busy: false, lastText: "", lastTextAt: 0, stepEnded: null
  };
  
  c.stepEnded = {
    finish: props.finish || "unknown",
    cost: props.cost || 0,
    tokens: {
      input: props.tokens?.input || 0,
      output: props.tokens?.output || 0,
      reasoning: props.tokens?.reasoning || 0,
    },
  };
  
  this.sessionCompletion.set(sid, c);
  console.error(`[SSEListener] Session ${sid} step.ended: finish=${props.finish}, tokens=${props.tokens?.input}/${props.tokens?.output}`);
}

// message.part.updated (text) 处理
if (evt.type === "message.part.updated") {
  const props = evt.properties || evt;
  const part = props.part;
  
  if (part?.type === "text" && part?.text) {
    const sid = props.sessionID;
    let c = this.sessionCompletion.get(sid) || {
      idle: false, busy: false, lastText: "", lastTextAt: 0, stepEnded: null
    };
    
    c.lastText += part.text;
    c.lastTextAt = Date.now();
    this.sessionCompletion.set(sid, c);
  }
}
```

#### 4.1.4 新增查询方法

```typescript
/** Check if SSE has detected session idle */
isSessionIdle(sessionId: string): boolean {
  return this.sessionCompletion.get(sessionId)?.idle === true;
}

/** Get accumulated text from SSE for a session */
getAccumulatedText(sessionId: string): string | null {
  const c = this.sessionCompletion.get(sessionId);
  return c?.lastText || null;
}

/** Get step.ended data (usage/cost/finish) from SSE */
getStepEndedData(sessionId: string): {
  finish: string;
  cost: number;
  tokens: { input: number; output: number; reasoning: number };
} | null {
  return this.sessionCompletion.get(sessionId)?.stepEnded || null;
}

/** Clear completion state for a session (after retrieval) */
clearSessionCompletion(sessionId: string): void {
  this.sessionCompletion.delete(sessionId);
}

/** Get session status (busy/idle) for monitoring */
getSessionStatus(sessionId: string): "busy" | "idle" | "unknown" {
  const c = this.sessionCompletion.get(sessionId);
  if (!c) return "unknown";
  if (c.idle) return "idle";
  if (c.busy) return "busy";
  return "unknown";
}
```

### 4.2 `index.ts` 变更

#### 4.2.1 `acp_check` 增加 SSE 早期返回

在 `acp_check` handler 中，Case 1（`_completedResult`）之后新增 Case 1.5：

```typescript
// Case 1.5: SSE detected idle but POST hasn't completed → return SSE data
if (sseListener.isSessionIdle(session.id) && !session.getCompletedResult()) {
  const sseText = sseListener.getAccumulatedText(session.id);
  const stepData = sseListener.getStepEndedData(session.id);
  
  sseListener.clearSessionCompletion(session.id);
  
  const response: any = {
    status: "completed",
    source: "sse",  // ← 标记来源是 SSE 而非 POST
    session_id: args.session_id,
    text: (sseText || "(SSE: agent idle, no text captured)").substring(0, 2000),
    hint: "Result from SSE stream (POST still pending). Full tool_calls data will be available after POST completes.",
    notifications: sseNotifications,
    elapsed_ms: Date.now() - session.getPromptStartTime(),
  };
  
  // 如果有 step.ended 数据，带上 usage 和 cost
  if (stepData) {
    response.usage = {
      input_tokens: stepData.tokens.input,
      output_tokens: stepData.tokens.output,
      total_tokens: stepData.tokens.input + stepData.tokens.output,
    };
    response.cost = stepData.cost;
    response.finish_reason = stepData.finish;
  }
  
  return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
}
```

#### 4.2.2 `acp_poll_events` 增加 session 状态信息

在 `acp_poll_events` 返回中新增 `session_status` 字段：

```typescript
// 在返回对象中新增
session_status: sseListener.getSessionStatus(args.session_id || ""),
```

---

## 五、限制与注意事项

### 5.1 SSE 返回的局限性

- **文本累积**：SSE 的 `message.part.updated` text 事件是流式累积的，可能不包含完整的 tool_calls 结构
- **usage 数据**：`session.next.step.ended` 提供 token 和 cost，但不包含 tool_calls 详情
- **source 标记**：返回中 `source: "sse"` 让调用方知道这是 SSE 结果，完整数据需等 POST

### 5.2 Sub-agent 场景的复杂性

- Primary agent dispatch sub-agent 时，可能产生多个 `busy` → `idle` 循环
- `session.status: idle` 在 primary agent 完成时到达，但 sub-agent 可能还在运行
- 需要处理重复 idle 事件（同一个 session 多次 idle）

### 5.3 事件格式

- `session.status` 事件的格式是 `properties.sessionID` + `properties.status.type`
- `session.next.step.ended` 事件的格式是 `properties.sessionID` + `properties.finish` + `properties.tokens`
- 需要注意 `properties` 字段可能不存在，需要 fallback 到事件根对象

---

## 六、验证计划

### 6.1 Phase 1 验证用例

| Case | 操作 | 预期 |
|------|------|------|
| V1.1 | 短 prompt（<5s） | POST 直接返回 completed，SSE 路径不触发 |
| V1.2 | 长 prompt（>30s） | acp_check 在 SSE idle 后立即返回 completed（source: "sse"） |
| V1.3 | SSE 返回的 usage 数据 | 包含 input_tokens, output_tokens, cost |
| V1.4 | SSE 返回的 text | 包含 agent 的完整文本输出 |
| V1.5 | POST 完成后 acp_check | 返回 completed（source: "post"），数据更完整 |
| V1.6 | Sub-agent 场景 | 正确处理多次 busy/idle 循环 |

### 6.2 回归测试

- 模块 1（Session 生命周期）：4/4 PASS
- 模块 2（长轮询）：6.5/7 PASS（Test 2.6 应改善）
- 模块 3-10：待执行

---

## 七、文件变更清单

| 文件 | 改动 | 行数 |
|------|------|:----:|
| `sse-listener.ts` | 扩展 `isRelevant()` + 新增 `sessionCompletion` Map + 事件处理 + 查询方法 | ~80 |
| `index.ts` | `acp_check` Case 1.5 + `acp_poll_events` session_status | ~30 |
| `types.ts` | 新增 `SessionCompletionState` 接口（可选） | ~10 |
| **合计** | | ~120 |

---

## 八、后续改进方向

### 8.1 Phase 2 预告

- `session.next.tool.failed`：实时检测 tool 失败，配合 `deliver_guidance` 自动恢复
- `session.next.agent.switched`：实时追踪 sub-agent dispatch
- `session.status` retry：重试循环感知

### 8.2 长期目标

- SSE 事件驱动的实时 dashboard（agent 状态、token 消耗、tool 调用统计）
- 基于 SSE 事件的自动干预（检测到死循环自动发送 guidance）
- 多 session 并行监控（同时追踪多个 agent 的执行状态）

---

## 九、参考资料

- SSE 事件完整参考：`documents/opencode-sse-events.md`（58 个事件）
- 测试用例报告：`documents/acp-bridge-test-suite.md`（71 个 case）
- ACP Bridge 源码：`/home/zhaoge/workspace/qoderwork/acp-bridge/src/`
