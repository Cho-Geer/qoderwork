# ACP-Bridge 方案 C 改造设计：Serve API 替代子进程

> 将 acp-bridge 从 spawn `opencode acp` 子进程 + JSON-RPC 2.0 改为调用 `opencode serve` HTTP API，实现 web UI 原生实时流式显示。

---

## 一、现状与问题

### 1.1 当前架构

```
QoderWork → acp-bridge(MCP) → spawn opencode acp(子进程) → stdio JSON-RPC 2.0
                                    ↓
                              事件留在 bridge 内存
                              web UI 看不到实时流
```

### 1.2 核心问题

| 问题 | 影响 |
|---|---|
| serve 与 acp 是独立进程，无事件转发 | web UI SSE `/event` 不推送 ACP session 事件 |
| 多一层子进程管理 | 进程生命周期、env 继承、超时恢复等复杂度 |
| wrapper 脚本解决 WSL env | 额外的维护负担 |
| JSON-RPC 2.0 协议解析 | 自定义协议层，需处理 notification/response 分发 |

### 1.3 实测验证（2026-07-01）

- `POST /session/{id}/message` + `noReply:true` → 消息注入成功，GET 可见
- SSE `/event` → 不广播注入消息，只广播 serve 原生 session 事件
- serve SSE 事件类型：`message.part.delta`（实时流）、`message.part.updated`、`session.status`、`session.diff` 等 14 种
- `deliver_guidance` / `acp_events` → 纯 DB 操作，与传输协议无关

---

## 二、目标架构

### 2.1 新架构

```
QoderWork
  │
  │  MCP 工具调用
  ▼
┌──────────────────────────────────────────────┐
│  acp-bridge MCP Server (v3)                  │
│  (TypeScript + Bun, WSL)                     │
│                                              │
│  ServeSessionManager                         │
│  ├─ sessions: Map<id, ServeSession>          │
│  ├─ HTTP API 调用 serve                      │
│  ├─ SSE 订阅 /event（可选，用于事件缓存）     │
│  ─ context health（从 session 响应提取）     │
│                                              │
│  MCP Tools:                                  │
│  acp_start / acp_send / acp_stop            │
│  acp_list / acp_debug                        │
│  deliver_guidance / acp_events（不变）        │
└────────────┬─────────────────────────────────┘
             │
             │  HTTP REST API
             ▼
┌──────────────────────────────────────────────┐
│  opencode serve（已有进程，port 4096）        │
│                                              │
│  Session 管理:                               │
│  POST /session → 创建 session                │
│  POST /session/{id}/message → 发送+流式响应  │
│  POST /session/{id}/abort → 中止             │
│  GET /session → 列表                         │
│  GET /session/{id}/children → 子 agent       │
│                                              │
│  SSE 事件广播:                               │
│  GET /event → message.part.delta (实时流)    │
│           → session.status / updated         │
│           → session.diff / idle              │
────────────┬─────────────────────────────────
             │
             │  原生 SSE
             ▼
┌──────────────────────────────────────────────┐
│  Web UI（浏览器）                             │
│  实时显示 agent 执行过程 ✓                    │
──────────────────────────────────────────────┘
```

### 2.2 关键变化

| 变化点 | 旧（v2） | 新（v3） |
|---|---|---|
| 通信协议 | stdio JSON-RPC 2.0 | HTTP REST + JSON |
| Session 创建 | spawn 子进程 + initialize + session/new | `POST /session` |
| 消息发送 | `session/prompt` JSON-RPC request | `POST /session/{id}/message` |
| 事件接收 | 解析 stdout JSON-RPC notification | SSE `/event` 或 HTTP 响应 |
| 子进程管理 | ChildProcess 生命周期 | 无（serve 进程管理） |
| WSL env 继承 | wrapper 脚本 | 不需要 |
| web UI 实时 | 不可见 | 原生可见 |

---

## 三、功能映射（100% 覆盖）

### 3.1 核心 MCP 工具

| MCP Tool | 旧实现 | 新实现 | 状态 |
|---|---|---|---|
| `acp_start` | spawn + initialize + session/new + set_model | `POST /session` (agent, model, title, parentID) | 更简单 |
| `acp_send` | session/prompt JSON-RPC + 解析 notification | `POST /session/{id}/message` + 解析 HTTP response | 更简单 |
| `acp_stop` | session/close JSON-RPC + proc.kill() | `POST /session/{id}/abort` | 更简单 |
| `acp_list` | 遍历 Map<AcpSession> | `GET /session` + `GET /session/status` | 更丰富 |
| `acp_debug` | spawn + 完整协议测试 | `POST /session` + `POST /session/{id}/message` 端到端测试 | 需改写 |

### 3.2 扩展工具（零改动）

| MCP Tool | 机制 | 改动 |
|---|---|---|
| `deliver_guidance` | 直接写 framework-state.db `tool_enforcement` 表 | **零改动** — 纯 DB 操作 |
| `acp_events` | 直接读 framework-state.db `notifications` 表 | **零改动** — 纯 DB 读操作 |

### 3.3 内部能力映射

| 能力 | 旧实现 | 新实现 |
|---|---|---|
| Context health（token 监控） | 解析 `usage_update` notification | 从 `POST /session/{id}/message` 响应的 `tokens` 字段提取 |
| 子 agent 可见性 | 解析 notification 的 sessionId 区分 parent/subagent | `GET /session/{id}/children` 原生支持 |
| Compaction 检测 | 解析 `compacted` notification | serve session 响应含 compaction 信息 |
| 超时处理 | JSON-RPC request timeout | HTTP fetch timeout（原生支持） |
| Session 状态机 | 自行维护 starting/ready/busy/closed | serve API `GET /session/status` 原生提供 |

---

## 四、文件改造计划

### 4.1 文件变更清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/types.ts` | **重写** | 移除 ACP 协议类型，新增 Serve API 类型 |
| `src/acp-session.ts` | **删除** → `src/serve-session.ts` | 从子进程管理改为 HTTP 客户端 |
| `src/session-manager.ts` | **重写** | 从 spawn 管理改为 serve API 调用 |
| `src/jsonrpc.ts` | **删除** | 不再需要 JSON-RPC 编解码 |
| `src/index.ts` | **重写** | 更新工具注册，移除 inline tools |
| `src/config.ts` | **小改** | 移除 wrapper 路径，简化配置 |
| `src/extensions.ts` | **不变** | deliver_guidance + acp_events 零改动 |
| `src/tools/*.ts` | **删除** | 工具定义迁入 index.ts（与当前 index.ts 模式一致） |
| `opencode-acp-wrapper.sh` | **删除** | 不再需要 wrapper 脚本 |
| `src/direct-test*.ts` | **删除** | 调试文件清理 |
| `src/test-session.ts` | **删除** | 调试文件清理 |

### 4.2 新增文件

| 文件 | 说明 |
|---|---|
| `src/serve-session.ts` | ServeSession 类：HTTP 调用 serve API，管理单个 session |
| `src/sse-client.ts` | 可选：SSE 客户端，订阅 `/event` 用于事件缓存和 sub-agent 追踪 |

### 4.3 代码量预估

| 模块 | 旧代码量 | 新代码量 | 变化 |
|---|---|---|---|
| types.ts | 66L | ~40L | -40% |
| acp-session.ts → serve-session.ts | 443L | ~200L | -55% |
| session-manager.ts | 161L | ~120L | -25% |
| jsonrpc.ts | 49L | 删除 | -100% |
| index.ts | 225L | ~180L | -20% |
| config.ts | 47L | ~35L | -25% |
| extensions.ts | 135L | 不变 | 0% |
| tools/*.ts | 196L | 删除（迁入 index.ts） | -100% |
| wrapper.sh | 存在 | 删除 | -100% |
| 调试文件 | 63L | 删除 | -100% |
| **总计** | **~1385L** | **~575L** | **-58%** |

---

## 五、核心类设计

### 5.1 ServeSession

```typescript
// src/serve-session.ts
export class ServeSession {
  id: string;                    // serve 返回的 session ID (ses_xxx)
  agent: string;
  status: "creating" | "ready" | "busy" | "closed" = "creating";

  // Context health（从 serve 响应提取）
  contextHealth: ContextHealth;

  // Sub-agent tracking（从 /children API 获取）
  subAgents: Map<string, SubAgentInfo>;

  constructor(agent: string, id: string) { ... }

  // 发送消息（核心方法）
  async sendPrompt(text: string, timeoutMs?: number): Promise<SendResult> {
    // POST /session/{id}/message
    // 解析响应：text, toolCalls, tokens, subAgents
  }

  // 获取子 agent 列表
  async refreshSubAgents(): Promise<SubAgentInfo[]> {
    // GET /session/{id}/children
  }

  // 中止 session
  async abort(): Promise<void> {
    // POST /session/{id}/abort
  }

  // 更新 context health
  private updateContextHealth(tokens: TokenInfo): void { ... }
}
```

### 5.2 ServeSessionManager

```typescript
// src/session-manager.ts（重写）
export class ServeSessionManager {
  private sessions: Map<string, ServeSession> = new Map();
  private serveUrl: string;
  private cleanupTimer: ReturnType<typeof setInterval>;

  // 创建 session
  async startSession(agent?, cwd?, initialPrompt?): Promise<ServeSession> {
    // POST /session { agent, model, title }
    // 可选：发送 initial_prompt
  }

  // 获取 session
  getSession(id: string): ServeSession | undefined { ... }

  // 停止 session
  async stopSession(id: string): Promise<void> {
    // POST /session/{id}/abort
  }

  // 列出 session
  async listSessions(): Promise<SessionInfo[]> {
    // GET /session + GET /session/status
  }

  // 清理过期 session
  private async cleanupStale(): Promise<void> { ... }

  // 关闭所有
  async shutdown(): Promise<void> { ... }
}
```

### 5.3 类型定义

```typescript
// src/types.ts（重写）

// Serve API 响应类型
export interface ServeSessionCreateResponse {
  info: {
    id: string;
    agent: string;
    model: { providerID: string; modelID: string };
    time: { created: number };
  };
}

export interface ServeMessageResponse {
  info: {
    id: string;
    role: string;
    tokens: { input: number; output: number; reasoning: number };
    time: { created: number; completed: number };
  };
  parts: Array<{
    type: "text" | "tool" | "file";
    text?: string;
    tool?: { name: string; input: any; output?: string };
  }>;
}

export interface ServeSessionStatus {
  id: string;
  agent: string;
  status: "active" | "idle" | "completed";
  tokens: { input: number; output: number };
  time: { created: number; updated: number };
}

// 内部类型（保持与 v2 兼容的接口）
export interface SendResult {
  text: string;
  toolCalls: ToolCallRecord[];
  usage: UsageInfo | null;
  subAgents: SubAgentSummary[];
}

export interface ContextHealth {
  inputTokens: number;
  outputTokens: number;
  estimatedPct: number;
  compactionCount: number;
  lastCompactionAt: string | null;
  health: "good" | "warning" | "critical";
}

export interface ToolCallRecord {
  tool: string;
  args?: Record<string, any>;
  status: "started" | "completed" | "failed";
  result_summary?: string;
  timestamp: string;
}

export interface SubAgentSummary {
  sessionId: string;
  agent: string;
  text: string;
  toolCalls: ToolCallRecord[];
  eventCount: number;
}

export interface SessionInfo {
  session_id: string;
  agent: string;
  status: string;
  message_count: number;
  turn_count: number;
  started_at: string;
  last_activity: string;
  context: ContextHealth;
}
```

---

## 六、关键实现细节

### 6.1 acp_start → POST /session

```typescript
// 旧：spawn + initialize(15s) + wait(2s) + session/new(30s) + set_model
// 新：一次 HTTP 请求

const resp = await fetch(`${serveUrl}/session`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    agent: targetAgent,
    model: modelFromConfig,  // 从 opencode.json 读取
    title: `${targetAgent}-${Date.now()}`,
  }),
});
const data = await resp.json();
const sessionId = data.info.id;
```

**优势**：从 3 步 RPC + 2s 等待 → 1 次 HTTP 请求

### 6.2 acp_send → POST /session/{id}/message

```typescript
// 旧：session/prompt JSON-RPC → 解析 stdout notification 流
// 新：HTTP POST → 解析响应 JSON

const resp = await fetch(`${serveUrl}/session/${sessionId}/message`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    parts: [{ type: "text", text: message }],
  }),
  signal: AbortSignal.timeout(timeoutMs),
});
const data = await resp.json();

// 从响应提取信息
const textPart = data.parts?.find((p: any) => p.type === "text");
const toolParts = data.parts?.filter((p: any) => p.type === "tool");
const tokens = data.info?.tokens;
```

**注意**：serve 的 `/message` 端点是同步等待 AI 完成后返回完整响应（非流式 HTTP），但 SSE `/event` 端点会实时推送 `message.part.delta`。

### 6.3 子 agent 追踪

```typescript
// 旧：解析 notification 的 sessionId 区分 parent/subagent
// 新：GET /session/{id}/children

const resp = await fetch(`${serveUrl}/session/${sessionId}/children`);
const children = await resp.json();
// children.data 包含所有子 agent session 信息
```

### 6.4 Context Health

```typescript
// 旧：解析 usage_update notification 累加 token
// 新：从 message 响应的 tokens 字段提取

const tokens = data.info?.tokens;  // { input, output, reasoning }
contextHealth.inputTokens = tokens?.input || 0;
contextHealth.outputTokens = tokens?.output || 0;
contextHealth.estimatedPct = Math.round(
  (total / CONFIG.defaultContextWindow) * 100
);
```

### 6.5 deliver_guidance / acp_events（零改动）

```typescript
// extensions.ts 完全不变
// 直接读写 framework-state.db，与 serve API 无关
```

---

## 七、SSE 可选增强

### 7.1 方案

acp-bridge 可选订阅 serve 的 `/event` SSE 端点，用于：
- 缓存实时事件（`message.part.delta`）供 `acp_events` 查询
- 追踪 sub-agent 创建/销毁
- 检测 session 状态变化（idle → active）

### 7.2 实现

```typescript
// src/sse-client.ts（可选）
export class ServeSSEClient {
  private eventBuffer: Map<string, SSEEvent[]> = new Map();  // sessionId → events
  private abortController: AbortController;

  constructor(serveUrl: string) {
    this.connect(serveUrl);
  }

  private async connect(serveUrl: string): Promise<void> {
    // fetch with ReadableStream, parse SSE events
    // 按 sessionID 分类缓存
  }

  getEvents(sessionId: string, since?: number): SSEEvent[] { ... }
  disconnect(): void { ... }
}
```

### 7.3 优先级

SSE 客户端标记为 **Phase 2**（可选增强），不影响核心功能。Phase 1 只需 HTTP API 调用即可实现全部现有功能。

---

## 八、风险与缓解

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| serve API 的 `/message` 是同步返回（非流式） | acp_send 需等待 AI 完成才能返回 | 与旧版行为一致（旧版也是等待 session/prompt 完成）；实时流通过 web UI SSE 查看 |
| serve 进程崩溃 | 所有 session 丢失 | 与旧版风险相同（旧版 serve 崩溃 web UI 也不可用）；acp-bridge 检测到 serve 不可达时报错 |
| serve API 格式变化 | 解析失败 | 使用 SDK 类型定义（`@opencode-ai/sdk`），随 OpenCode 升级同步更新 |
| session 创建失败（agent 不存在等） | acp_start 报错 | serve API 返回明确错误信息，比旧版 spawn 失败更易诊断 |
| 并发 session 限制 | 超过 maxSessions 被拒 | 保留 SessionManager 的并发控制逻辑 |

---

## 九、迁移步骤

### Phase 1：核心改造（P0）

1. 重写 `types.ts` — 新类型定义
2. 新建 `serve-session.ts` — ServeSession 类
3. 重写 `session-manager.ts` — ServeSessionManager
4. 重写 `index.ts` — 更新工具注册
5. 小改 `config.ts` — 移除 wrapper 相关配置
6. 删除 `acp-session.ts`、`jsonrpc.ts`、`tools/*.ts`、`opencode-acp-wrapper.sh`
7. 保留 `extensions.ts` 不变

### Phase 2：SSE 增强（P1，可选）

8. 新建 `sse-client.ts` — SSE 事件订阅
9. 集成到 ServeSessionManager

### Phase 3：清理与验证

10. 删除调试文件（direct-test*.ts, test-session.ts）
11. 全量 MCP 工具测试
12. web UI 实时流验证
13. deliver_guidance / acp_events 回归测试

---

## 十、验证计划

### 10.1 功能验证

| 测试项 | 验证方法 |
|---|---|
| acp_start 创建 session | 调用 → 返回 session_id → GET /session/{id} 确认存在 |
| acp_send 发送消息 | 调用 → 返回 text + tool_calls → web UI 可见 |
| acp_stop 关闭 session | 调用 → GET /session/status 确认 aborted |
| acp_list 列出 session | 调用 → 返回 session 列表与 serve API 一致 |
| 子 agent 可见性 | Orchestrator dispatch → GET /session/{id}/children 确认 |
| context health | 发送消息 → 响应含 tokens → health 计算正确 |
| deliver_guidance | 触发阻断 → 投递指引 → agent 恢复（回归测试） |
| acp_events | 发送消息 → 读 notifications 表 → 事件可见 |
| web UI 实时流 | acp_send 执行中 → 浏览器刷新 web UI → 实时显示 |

### 10.2 性能对比

| 指标 | 旧（v2） | 新（v3）预期 |
|---|---|---|
| acp_start 延迟 | ~5s（spawn + initialize + wait + session/new） | ~1s（单次 HTTP） |
| acp_send 延迟 | JSON-RPC 往返 + notification 解析 | HTTP 往返（相当） |
| 内存占用 | 每 session 一个子进程 (~50-100MB) | 零额外进程 |
| 代码量 | 1385L | ~575L |

---

## 十一、与 v2 设计的差异

| 维度 | v2 设计（当前实现） | v3 设计（方案 C） |
|---|---|---|
| 通信方式 | stdio JSON-RPC 2.0 | HTTP REST |
| 进程模型 | 每 session 一个子进程 | 复用 serve 进程 |
| web UI 实时 | 不支持 | 原生支持 |
| 事件获取 | 解析 stdout notification | HTTP 响应 + 可选 SSE |
| 子 agent | 解析 sessionId 区分 | `/children` API |
| wrapper 脚本 | 需要（WSL env） | 不需要 |
| 代码量 | 1385L | ~575L |
| 维护负担 | 高（协议 + 进程 + env） | 低（HTTP 客户端） |

---

## 十二、实施记录（2026-07-01）

### 12.1 实际 API 响应格式修正

实施过程中发现的实际 API 格式（与初始假设不同）：

| 端点 | 初始假设 | 实际格式 |
|---|---|---|
| POST /session | `{ info: { id, agent } }` | `{ id, agent, tokens, title }`（扁平） |
| POST /session/{id}/message | `{ message: { parts } }` | `{ info: { tokens, id, sessionID }, parts: [...] }` |
| parts 类型 | 仅 text | `step-start, reasoning, text, step-finish, tool` |

### 12.2 实施结果

- 代码量：1385L → ~575L（-58%），符合预期
- 文件数：15+ → 6（index/config/types/serve-session/session-manager/extensions）
- bun build：229 modules，0 errors
- 功能测试：全部 5 步通过（health → create → message → children → abort）
- serve 响应中 `parts` 数组含 step-start/reasoning/text/step-finish/tool 五种类型
- token 统计在 `info.tokens` 中（input/output/total）

### 12.3 废弃文件清单

已删除：acp-session.ts(443L), jsonrpc.ts(49L), tools/acp-start.ts, tools/acp-send.ts, tools/acp-stop.ts, tools/acp-list.ts, opencode-acp-wrapper.sh, direct-test*.ts, test-session.ts

备份：.backup-v2/ 保留完整 v2 源码
