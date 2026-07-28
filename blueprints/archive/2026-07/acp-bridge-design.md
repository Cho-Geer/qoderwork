# ACP-Bridge MCP Server 设计方案 (v2)

> QoderWork ↔ OpenCode ACP 桥梁，实现实时协作、中途介入、生命周期管理

---

## 一、架构概览

### 1.1 Agent 访问层级

```
ACP 直达（QoderWork 可直接对话）：
  Orchestrator  — 默认入口，任务调度，可交互
  Super-Admin   — 框架修复，紧急操作，可交互

间接到达（通过 Orchestrator dispatch_subagent 分发）：
  Meta-Planner, Architect, Coder-BE, Coder-FE,
  Guardian, Arbiter, CI-CD-Agent, Knowledge-Curator
  — 这些全是子 Agent，不可直达
```

### 1.2 整体架构

```
QoderWork
  │
  │  MCP 工具调用
  ▼
┌──────────────────────────────────────────────┐
│  acp-bridge MCP Server                       │
│  (TypeScript + Bun, WSL)                     │
│                                              │
│  SessionManager                              │
│  ├─ sessions: Map<id, AcpSession>            │
│  ├─ 进程生命周期管理                          │
│  ├─ 上下文监控（token 计数、compaction 检测） │
│  └─ 中途介入队列                              │
│                                              │
│  MCP Tools:                                  │
│  acp_start / acp_send / acp_stop            │
│  acp_observe / acp_intervene                │
│  acp_list / acp_status / acp_resume         │
└────────────┬─────────────────────────────────┘
             │
             │  stdio JSON-RPC 2.0
             ▼
┌──────────────────────────────────────────────┐
│  opencode acp (子进程，每 session 一个)      │
│                                              │
│  Session 状态机:                             │
│  created → active → (compacting) → active    │
│         → idle → expired                     │
│                                              │
│  通知流:                                     │
│  ← thought_chunk / message_chunk             │
│  ← tool_call_start / tool_call_end           │
│  ← usage_update (token 计数)                │
│  ← session/compacted (上下文压缩事件)        │
│  ← session/idle                              │
└────────────┬─────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│  Orchestrator / Super-Admin                  │
│  （仅此二者可 ACP 直达）                     │
│                                              │
│  内部通过 dispatch_subagent 分发子 Agent:    │
│  Orchestrator → Coder-BE / Coder-FE / ...   │
│  Super-Admin → Knowledge-Curator (UC7KS)    │
│                                              │
│  子 Agent 的执行过程通过                     │
│  Orchestrator 的输出间接观察                 │
└──────────────────────────────────────────────┘
```

---

## 二、MCP 工具定义

### Phase 1：核心交互

#### 2.1 acp_start

启动 ACP session。仅允许 Orchestrator 和 Super-Admin。

```typescript
{
  name: "acp_start",
  description: "启动与 OpenCode Agent 的 ACP 会话。仅支持 Orchestrator 和 Super-Admin。",
  inputSchema: {
    type: "object",
    properties: {
      agent: {
        type: "string",
        enum: ["Orchestrator", "Super-Admin"],
        description: "目标 Agent（仅 Orchestrator 或 Super-Admin）",
        default: "Orchestrator"
      },
      cwd: {
        type: "string",
        description: "工作目录",
        default: "/home/zhaoge/workspace/opencode/work-one"
      },
      initial_prompt: {
        type: "string",
        description: "可选的初始消息"
      }
    },
    required: []
  }
}
```

**返回：**
```json
{
  "session_id": "abc123...",
  "agent": "Orchestrator",
  "status": "ready",
  "agent_info": { "name": "Orchestrator", "version": "..." },
  "initial_response": "..."
}
```

**内部流程：**
```
1. 校验 agent ∈ {Orchestrator, Super-Admin}，否则拒绝
2. spawn("opencode", ["acp"], { cwd, stdio: ["pipe","pipe","pipe"] })
3. 等待进程就绪（1.5s）
4. 发送 initialize { protocolVersion: 1, capabilities: {}, clientInfo }
5. 等待 initialize 响应 → 捕获 agentInfo
6. 发送 session/new { agent, cwd, mcpServers: [] }
7. 等待 session/new 响应 → 捕获 sessionId
8. 注册到 sessions Map，初始化上下文监控
9. 如果提供 initial_prompt → 调用 acp_send 逻辑
10. 返回 { session_id, agent, agent_info, status }
```

#### 2.2 acp_send

向 session 发送消息，等待 Agent 完成当前轮次。

```typescript
{
  name: "acp_send",
  description: "向 ACP 会话发送消息。等待 Agent 完成当前轮次后返回完整响应。",
  inputSchema: {
    type: "object",
    properties: {
      session_id: { type: "string", description: "ACP 会话 ID" },
      message: { type: "string", description: "发送给 Agent 的消息" },
      timeout_ms: { type: "number", description: "超时（毫秒）", default: 120000 }
    },
    required: ["session_id", "message"]
  }
}
```

**返回：**
```json
{
  "session_id": "abc123",
  "response": {
    "text": "Agent 完整文本响应",
    "thoughts": ["推理过程摘要"],
    "tool_calls": [
      { "tool": "dispatch_subagent", "args": {"agent_type": "Coder-BE"}, "status": "completed" }
    ],
    "usage": { "input_tokens": 1234, "output_tokens": 567, "total_tokens": 1801 }
  },
  "session_health": {
    "context_usage_pct": 45,
    "compaction_count": 0,
    "message_count": 3
  },
  "status": "completed"
}
```

**内部流程：**
```
1. 查找 AcpSession，校验 status ∈ {ready, idle}
2. 标记 status = "busy"
3. 清空当前轮次的 notifications 缓冲区
4. 发送 session/prompt { sessionId, prompt: [{ type: "text", text: message }] }
5. 监听 stdout，收集:
   - thought_chunk → thoughts[]
   - message_chunk → text
   - tool_call_start/end → tool_calls[]
   - usage_update → 更新 token 计数
   - session/compacted → 记录压缩事件，通知 QoderWork
6. 等待 response 到达（或超时）
7. 标记 status = "idle"
8. 返回完整响应 + session 健康状态
```

#### 2.3 acp_stop

关闭 session，终止子进程。

```typescript
{
  name: "acp_stop",
  description: "关闭 ACP 会话，释放资源。",
  inputSchema: {
    type: "object",
    properties: {
      session_id: { type: "string", description: "要关闭的 ACP 会话 ID" }
    },
    required: ["session_id"]
  }
}
```

**内部流程：**
```
1. 发送 session/close { sessionId }
2. 等待 2s
3. proc.kill("SIGTERM") → 等 3s → SIGKILL
4. 从 sessions Map 移除
5. 返回 { status: "closed" }
```

---

### Phase 2：观察与介入

#### 2.4 acp_observe

实时观察 Agent 的工作过程，不发送消息。用于在 Agent 执行任务时监控进展。

```typescript
{
  name: "acp_observe",
  description: "实时观察 Agent 的工作过程。返回自上次 observe 以来的所有事件（思考、工具调用、消息）。不发送任何消息给 Agent。",
  inputSchema: {
    type: "object",
    properties: {
      session_id: { type: "string", description: "ACP 会话 ID" },
      wait_ms: {
        type: "number",
        description: "如果没有新事件，等待多久（毫秒）。0=立即返回已有事件。",
        default: 5000
      }
    },
    required: ["session_id"]
  }
}
```

**返回：**
```json
{
  "session_id": "abc123",
  "agent_status": "busy",
  "events": [
    {
      "type": "thought",
      "text": "需要先检查 gate_audit_history 表的行数...",
      "timestamp": "2026-06-28T12:01:05Z"
    },
    {
      "type": "tool_call",
      "tool": "safe_shell",
      "args": { "command": "bun -e '...'" },
      "status": "completed",
      "result_summary": "785万行，5.88GB",
      "timestamp": "2026-06-28T12:01:12Z"
    },
    {
      "type": "tool_call",
      "tool": "safe_edit",
      "args": { "filePath": ".opencode/lib/db-state-manager.ts", "mode": "patch" },
      "status": "completed",
      "result_summary": "修改了 dbLoadGateStore 函数",
      "timestamp": "2026-06-28T12:01:30Z"
    },
    {
      "type": "message",
      "text": "已完成读端修复，接下来处理写端...",
      "timestamp": "2026-06-28T12:01:35Z"
    }
  ],
  "context_health": {
    "input_tokens": 45000,
    "output_tokens": 12000,
    "estimated_pct": 38,
    "compaction_count": 0
  }
}
```

**内部流程：**
```
1. 查找 AcpSession
2. 返回自上次 observe 以来累积的 events（从 notifications 缓冲区读取）
3. 如果 events 为空且 wait_ms > 0 且 agent_status == "busy":
   - 等待新事件到达（最多 wait_ms）
   - 超时后返回空 events + 当前状态
4. 清空已返回的 events（下次 observe 只返回新增的）
```

**关键设计：** observe 是**非阻塞的轮询**。QoderWork 可以在 Agent 工作时反复调用 observe 来监控进展，发现错误时调用 intervene 介入。

#### 2.5 acp_intervene

中途介入——在 Agent 执行任务过程中注入修正指令。与 acp_send 的区别：intervene 用于 Agent 正在工作时纠偏，send 用于 Agent 空闲时发起新对话。

```typescript
{
  name: "acp_intervene",
  description: "中途介入 Agent 的执行过程。当观察到 Agent 方向错误或遗漏时，注入修正指令。消息会在 Agent 当前轮次完成后被处理。",
  inputSchema: {
    type: "object",
    properties: {
      session_id: { type: "string", description: "ACP 会话 ID" },
      message: {
        type: "string",
        description: "介入指令。描述需要 Agent 调整的内容。"
      },
      priority: {
        type: "string",
        enum: ["normal", "urgent"],
        description: "urgent=在 Agent 下一个 tool 调用前注入（如果协议支持），normal=当前轮次结束后注入",
        default: "normal"
      }
    },
    required: ["session_id", "message"]
  }
}
```

**返回：**
```json
{
  "session_id": "abc123",
  "status": "queued",
  "injected_at": "next_turn",
  "message": "你的介入指令已排队，将在 Agent 当前轮次完成后注入"
}
```

**内部流程：**
```
1. 查找 AcpSession
2. 如果 agent_status == "idle":
   - 直接调用 acp_send 逻辑（Agent 空闲，立即发送）
   - 返回 { status: "sent" }
3. 如果 agent_status == "busy":
   - 将消息排入 intervene_queue
   - 等待 Agent 当前轮次完成（监听 response）
   - 轮次完成后，自动发送 session/prompt 注入介入消息
   - 返回 { status: "queued" }
4. 如果 priority == "urgent":
   - 尝试在当前 tool 调用间隙注入（依赖 ACP 协议能力）
   - 如果协议不支持实时中断 → 降级为 normal，告知 QoderWork
```

**介入时序：**
```
Agent 工作中:
  thought → tool_call → result → thought → tool_call → ...
                                              ↑
                                    轮次间隙：此时注入 intervene 消息
                                              ↓
                                    Agent 看到新消息，调整方向
```

---

### Phase 3：生命周期管理

#### 2.6 acp_status

查看 session 的详细状态，包括上下文健康度。

```typescript
{
  name: "acp_status",
  description: "查看 ACP 会话的详细状态，包括上下文使用率、压缩次数、token 消耗等。",
  inputSchema: {
    type: "object",
    properties: {
      session_id: { type: "string", description: "ACP 会话 ID" }
    },
    required: ["session_id"]
  }
}
```

**返回：**
```json
{
  "session_id": "abc123",
  "agent": "Orchestrator",
  "status": "idle",
  "lifecycle": {
    "started_at": "2026-06-28T12:00:00Z",
    "last_activity": "2026-06-28T12:15:00Z",
    "message_count": 8,
    "turn_count": 12
  },
  "context": {
    "input_tokens": 85000,
    "output_tokens": 32000,
    "estimated_pct": 65,
    "compaction_count": 1,
    "last_compaction_at": "2026-06-28T12:10:00Z",
    "health": "warning"
  },
  "warnings": [
    "上下文使用率 65%，建议控制在 80% 以下",
    "已发生 1 次上下文压缩，部分历史细节可能丢失"
  ]
}
```

#### 2.7 acp_list

列出所有活跃 session。

```typescript
{
  name: "acp_list",
  description: "列出所有活跃的 ACP 会话。",
  inputSchema: { type: "object", properties: {} }
}
```

#### 2.8 acp_resume

恢复到之前的 session（如果进程还活着）。

```typescript
{
  name: "acp_resume",
  description: "恢复到已有的 ACP 会话（检查进程是否存活）。",
  inputSchema: {
    type: "object",
    properties: {
      session_id: { type: "string", description: "要恢复的 ACP 会话 ID" }
    },
    required: ["session_id"]
  }
}
```

---

## 三、Session 生命周期管理

### 3.1 Session 状态机

```
         acp_start
             │
             ▼
  ┌───── created ─────┐
  │                    │
  │  initialize OK     │  initialize fail
  │                    │  → closed
  ▼                    │
 ready ◄──────────┐   │
  │               │   │
  │  acp_send     │   │
  ▼               │   │
 busy             │   │
  │               │   │
  │  response OK  │   │
  ▼               │   │
 idle ────────────┘   │
  │                    │
  │  30min 无活动      │  进程崩溃
  ▼                    ▼
 expired           closed
```

### 3.2 上下文压缩处理

```
Agent 上下文窗口填充过程:
  turn 1: 10% → turn 5: 40% → turn 10: 70% → turn 15: 90%
                                                  │
                                    OpenCode 触发 compaction
                                                  │
                                                  ▼
                                    session.compacted 事件
                                                  │
                                                  ▼
                                    acp-bridge 捕获事件:
                                    1. 记录 compaction_count++
                                    2. 记录 last_compaction_at
                                    3. 重置 token 估算（压缩后 token 减少）
                                    4. 在下次 acp_status/observe 返回时
                                       通知 QoderWork "上下文已压缩"

QoderWork 的应对策略:
  - context_usage_pct < 60%  → 正常
  - context_usage_pct 60-80% → warning，建议控制消息密度
  - context_usage_pct > 80%  → critical，建议开新 session
  - compaction 发生后       → 提醒 QoderWork Agent 可能丢失历史细节
```

### 3.3 Token 估算

```
由于 ACP 的 usage_update 提供 token 计数:
  - 每次 usage_update 更新最新的 input_tokens / output_tokens
  - estimated_pct = total_tokens / model_context_window * 100
  - model_context_window 从 initialize 响应的 agentInfo 中获取（或配置默认值）
  - compaction 后 token 数会突降，需要重新校准
```

### 3.4 自动清理

```
MCP Server 退出时:
  1. 遍历所有活跃 session
  2. 发送 session/close
  3. SIGTERM → 等 3s → SIGKILL
  4. 清理 sessions Map

定期清理（每 5 分钟）:
  1. 检查所有 session 的 lastActivity
  2. 超过 30 分钟无活动 → 自动关闭
  3. 检查进程存活（proc.exitCode !== null → 标记 closed）
```

---

## 四、核心模块设计

### 4.1 AcpSession 类

```typescript
class AcpSession {
  // 身份
  id: string;                         // OpenCode sessionId
  agent: "Orchestrator" | "Super-Admin";
  
  // 进程
  proc: ChildProcess;
  
  // 状态
  status: "created" | "ready" | "busy" | "idle" | "expired" | "closed";
  buffer: string;                     // stdout 行缓冲
  requestId: number;
  
  // 响应收集（acp_send 用）
  pendingResponse: {
    resolve: (result: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  } | null;
  
  // 事件缓冲（acp_observe 用）
  eventBuffer: AcpEvent[];            // 自上次 observe 以来的事件
  lastObserveAt: Date;
  
  // 介入队列（acp_intervene 用）
  interveneQueue: string[];
  
  // 上下文监控
  context: {
    inputTokens: number;
    outputTokens: number;
    estimatedPct: number;
    compactionCount: number;
    lastCompactionAt: Date | null;
    health: "good" | "warning" | "critical";
  };
  
  // 统计
  messageCount: number;
  turnCount: number;
  startedAt: Date;
  lastActivity: Date;
  
  // 方法
  async send(method: string, params: any): Promise<any>;
  onStdoutLine(line: string): void;
  pushEvent(event: AcpEvent): void;
  drainEvents(): AcpEvent[];
  flushInterveneQueue(): void;
  updateContextHealth(usage: UsageInfo): void;
  destroy(): void;
}
```

### 4.2 SessionManager 类

```typescript
class SessionManager {
  sessions: Map<string, AcpSession>;
  opencodeBin: string;
  defaultCwd: string;
  cleanupTimer: NodeJS.Timer;
  
  async startSession(agent: string, cwd?: string): Promise<AcpSession>;
  getSession(sessionId: string): AcpSession | null;
  async stopSession(sessionId: string): Promise<void>;
  async stopAll(): Promise<void>;
  listSessions(): SessionInfo[];
  cleanupStaleSessions(maxIdleMs?: number): void;
  
  // 启动定期清理
  startCleanupTimer(intervalMs?: number): void;
}
```

### 4.3 消息处理核心

```typescript
function handleAcpMessage(session: AcpSession, obj: any): void {
  // 1. 响应消息（有 id）→ 给 acp_send 的 Promise
  if (obj.id !== undefined) {
    if (obj.error) {
      session.pendingResponse?.reject(obj.error);
    } else {
      session.pendingResponse?.resolve(obj.result);
    }
    // 检查介入队列：轮次完成后，自动发送排队的介入消息
    if (session.interveneQueue.length > 0) {
      const msg = session.interveneQueue.shift()!;
      session.send("session/prompt", {
        sessionId: session.id,
        prompt: [{ type: "text", text: `[介入指令] ${msg}` }]
      });
    }
    return;
  }
  
  // 2. 通知消息（有 method，无 id）→ 给 acp_observe
  const params = obj.params || {};
  switch (obj.method) {
    case "session/update":
      switch (params.type) {
        case "thought_chunk":
          session.pushEvent({ type: "thought", text: params.text, timestamp: now() });
          break;
        case "message_chunk":
          session.pushEvent({ type: "message", text: params.text, timestamp: now() });
          break;
        case "tool_call_start":
          session.pushEvent({ type: "tool_call_start", tool: params.tool, args: params.args, timestamp: now() });
          break;
        case "tool_call_end":
          session.pushEvent({ type: "tool_call_end", tool: params.tool, result: params.result, timestamp: now() });
          break;
        case "usage_update":
          session.updateContextHealth(params);
          break;
      }
      break;
    case "session/compacted":
      session.context.compactionCount++;
      session.context.lastCompactionAt = new Date();
      session.pushEvent({ type: "compacted", timestamp: now() });
      break;
    case "session/idle":
      session.status = "idle";
      break;
  }
}
```

---

## 五、项目结构

```
/home/zhaoge/workspace/qoderwork/acp-bridge/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # MCP Server 入口，注册所有工具
│   ├── session-manager.ts    # SessionManager 类
│   ├── acp-session.ts        # AcpSession 类 + 消息处理
│   ├── jsonrpc.ts            # JSON-RPC 2.0 编解码
│   ├── types.ts              # 类型定义（AcpEvent, UsageInfo 等）
│   ├── config.ts             # 配置常量
│   └── tools/
│       ├── acp-start.ts
│       ├── acp-send.ts
│       ├── acp-stop.ts
│       ├── acp-observe.ts
│       ├── acp-intervene.ts
│       ├── acp-status.ts
│       ├── acp-list.ts
│       └── acp-resume.ts
└── README.md
```

---

## 六、使用场景

### 场景 1：投放任务 + 观察 + 中途介入

```
// 启动任务
QoderWork: acp_start(agent="Orchestrator", initial_prompt="修复 gate_audit_history 膨胀问题")
  → { session_id: "abc123", status: "ready" }

// 观察 Agent 工作
QoderWork: acp_observe(session_id="abc123", wait_ms=10000)
  → events: [
      { type: "thought", text: "需要检查 gate_audit_history 行数..." },
      { type: "tool_call", tool: "safe_shell", status: "completed", result: "785万行" },
      { type: "tool_call", tool: "safe_edit", args: { filePath: "db-state-manager.ts" }, status: "completed" },
      { type: "message", text: "已完成读端修复..." }
    ]

// 发现 Agent 漏了清理端修复
QoderWork: acp_intervene(session_id="abc123", message="你改了读端和写端，但清理端的 compactor 还没激活，column name bug（timestamp vs confirmed_at）也没修。请先处理这两个。")
  → { status: "queued", injected_at: "next_turn" }

// Agent 当前轮次完成后收到介入消息，调整方向
// 继续观察...
QoderWork: acp_observe(session_id="abc123", wait_ms=15000)
  → events: [
      { type: "message", text: "收到，现在处理 compactor 激活和列名修正..." },
      { type: "tool_call", tool: "safe_edit", args: { filePath: "db-state-manager.ts" }, status: "completed" }
    ]

// 检查上下文健康度
QoderWork: acp_status(session_id="abc123")
  → { context: { estimated_pct: 45, compaction_count: 0, health: "good" } }

// 任务完成，关闭
QoderWork: acp_stop(session_id="abc123")
```

### 场景 2：通过 Orchestrator 间接调度子 Agent

```
QoderWork: acp_start(agent="Orchestrator")
  → { session_id: "s1" }

// 让 Orchestrator 分发 Coder-BE
QoderWork: acp_send(session_id="s1", message="请分发 Coder-BE 实现用户登录 API，参照 contract.yaml 的用户模型")
  → response.tool_calls: [
      { tool: "dispatch_subagent", args: { agent_type: "Coder-BE", task_description: "..." }, status: "completed" }
    ]

// 通过 Orchestrator 的输出间接观察 Coder-BE 的工作进展
QoderWork: acp_observe(session_id="s1", wait_ms=30000)
  → events: [
      { type: "message", text: "Coder-BE 已完成用户登录 API 实现，正在 Guardian 审查..." }
    ]
```

### 场景 3：上下文健康管理

```
// 长时间运行的 session
QoderWork: acp_status(session_id="s1")
  → { context: { estimated_pct: 78, compaction_count: 1, health: "warning" } }

// QoderWork 决定开新 session 继续
QoderWork: acp_send(session_id="s1", message="请总结当前进度和未完成的工作")
  → { response: { text: "已完成: ... 未完成: ..." } }

QoderWork: acp_stop(session_id="s1")

// 新 session 继续
QoderWork: acp_start(agent="Orchestrator", initial_prompt="接续上一个 session 的工作。上次的进度总结：已完成... 未完成...")
  → { session_id: "s2", status: "ready" }
```

---

## 七、实现优先级

```
Phase 1（MVP）:
  ├─ acp_start（仅 Orchestrator/Super-Admin）
  ├─ acp_send（同步等待响应）
  └─ acp_stop

Phase 2（观察+介入）:
  ├─ acp_observe（非阻塞轮询事件）
  ├─ acp_intervene（中途介入，排队注入）
  └─ acp_status（上下文健康度）

Phase 3（生命周期）:
  ├─ acp_list（列出活跃 session）
  ├─ acp_resume（恢复 session）
  ├─ 自动清理过期 session
  └─ compaction 事件处理 + token 估算
```

---

## 八、MCP Server 注册

acp-bridge 在 QoderWork 侧注册（opencode.json 不需要改）：

```json
{
  "mcpServers": {
    "acp-bridge": {
      "command": "bun",
      "args": ["run", "/home/zhaoge/workspace/qoderwork/acp-bridge/src/index.ts"],
      "env": {
        "OPENCODE_BIN": "/home/zhaoge/.opencode/bin/opencode",
        "DEFAULT_CWD": "/home/zhaoge/workspace/opencode/work-one"
      }
    }
  }
}
```

运行在 WSL 中，QoderWork 通过 WSL 调用。

---

## 九、待验证的技术风险

| 风险 | 影响 | 缓解方案 |
|------|------|---------|
| ACP 是否支持 busy 状态下接收 session/prompt | 决定 intervene 是排队还是立即发送 | Phase 1 先实现排队模式，后续测试实时注入 |
| usage_update 的 token 计数精度 | 影响上下文健康度估算 | 与 OpenCode 实际 compaction 触发点对比校准 |
| 子进程崩溃恢复 | session 丢失 | 记录 session 状态到文件，acp_resume 尝试重连 |
| 多 session 并发时的资源消耗 | 内存/CPU | 限制最大并发 session 数（默认 3） |
| compaction 后 Agent 丢失关键上下文 | 输出质量下降 | QoderWork 在 observe 到 compaction 事件后主动注入关键上下文 |
