# Serve-API Skill 优化蓝图：Session 树抽象 + 全树监控 + 定向指导路由

**创建日期**: 2026-07-12
**更新日期**: 2026-07-28
**状态**: 已完成
**相关蓝图**: 无

> **版本**: v1.4
> **日期**: 2026-07-07
> **作者**: QoderCN
> **范围**: `qoderwork/.qoder/skills/serve-api/` (SKILL.md v1.3.0 + reference.md) + 四个脚本已实施
> **关联**: `acp-bridge-serve-api-redesign.md`（ACP 层，本蓝图不重叠）、`documents/native-opencode/native-opencode-sse-events.md`（事件源）
> **实施状态**: SKILL.md 已升至 v1.3.0；`session-tree.ts`、`monitor-tree.ts`、`guide.ts`、`intervene.ts` 均已创建并通过 bun build；2026-07-07 smoke 证明 `question` 与 abort 可用，但 `/session/{SID}/guide|reply|interrupt` REST 端点不存在

---

## 0.1 Smoke Test 复核状态（2026-07-07）

`e2e/smoke-test-results-20260707.md` 对 serve API 的端点边界给出新的运行级证据：

| 能力 | 当前判定 | 正确使用方式 |
|------|----------|--------------|
| 创建/发消息/读消息/abort | PASS | `POST /session`、`POST /session/{SID}/message`、`GET /session/{SID}/message`、`POST /session/{SID}/abort` |
| identity-preserving guide | 脚本路径待单独验证；REST `/guide` 不存在 | `guide.ts` / `intervene.ts --mode=guide` 使用 `POST /session/{SID}/prompt_async` 并携带 `agent` 字段 |
| question reply | `GET /question` 与 `POST /question/{QID}/reply` 是正确模型；REST `/session/{SID}/reply` 不存在 | 先按 `question.sessionID` 校验 QID，再 `POST /question/{QID}/reply` |
| interrupt | BLOCKED | `/session/{SID}/interrupt` 当前不存在，止损使用 abort |

因此，文档中“guide/reply 端点”只能指脚本抽象或 question API，不能写成 `POST /session/{SID}/guide` / `POST /session/{SID}/reply`。

---

## 0. 代码/E2E 复核状态（2026-07-06 v1.3 更新）

四个脚本已实施并通过 `bun build --target bun` 编译验证：
- `session-tree.ts` — 递归 session 树查询（human-readable + JSON 输出）
- `monitor-tree.ts` — 5s 轮询全树监控（4 状态分类，连续 2 轮 idle 退出）
- `guide.ts` — 身份保持的指导消息发送（先查 agent 再发 prompt_async）
- `intervene.ts` — 统一 4 模式干预入口（guide / reply-qid / abort / status）

T2.1 native Task smoke test (2026-07-06) 已验证：
- `/children` endpoint 返回有效 JSON（child.agent=build, parentID 正确）
- codegraph enforcement 在子 agent 中正常触发
- 子 agent 自适应行为：被阻断后找到豁免路径完成目标

仍需补齐：
- `/children` endpoint 在 HTML/404/非 JSON 响应时的 DB/SSE fallback（当前 catch → 空数组）
- `session-tree.ts` root 查询失败时应 exit 2（当前 exit 0）
- `reference.md` 中 `sdk_session_id` 应改为 `session_id`
- 部分文档中 `/api/events/stream` 应为 `/event`

已存在能力：
- `start-serve.ts` 能加载 `.env`、清 Bun cache、启动/停止 `opencode serve`。
- `sse-daemon.ts` 订阅 `/event`，写 `/tmp/sse-events.jsonl`，并在 `session.created` 时直接补写 work-one `session_map`。
- 当前脚本是“扁平事件流 + session_map 补写”，还没有 Session 树抽象、全树 completion 判定或按子 session 路由的主动干预。

关键校正：
- `GET /session/{sid}/children` 不能再写成已可靠验证。当前 E2E 结果记录 `/children` endpoint 返回 HTML 而不是 JSON，说明路径错误、版本不支持或 endpoint 尚未实现。
- 因此 `session-tree.ts` 的第一任务不是直接递归 children，而是先验证 endpoint；若失败，必须从 SDK `opencode.db` 的 session parent_id、SSE `session.created` 事件和 framework `session_map/session_registry/session_events` 组合 fallback。
- `prompt_async` 携带 `agent` 字段的身份保留规则仍应保留，但也需要在脚本落地时重新做版本化 smoke，避免把单次实验写成长期 API 契约。

---

## 一、问题陈述

当前 serve-api skill 把所有操作都写成"对单个 SID"，没有"Session 树"这个一等概念。当 Orchestrator 通过 native Task 派遣子 agent 后，父/子 session 被当成独立个体处理，监控和指导都要人工切换 SID，导致两类具体问题：

**问题 1：监控盲区**
- 当前三种完成检测方法（JSONL grep / REST 补漏 / question 检测）都硬编码单 SID
- `session.idle` 检测只判断单 session，不知道子 session 是否仍在跑
- dispatch 可能延迟，子 session 不是一次性全部出现，静态 children 查询会漏
- 用户诉求：**主 agent 派遣子 agent 后，主动监控要同时覆盖主 agent 和所有子 agent**

**问题 2：指导错位**
- 当前 `POST /session/{SID}/message` 不传 agent，子 session 会被覆盖成 `Orchestrator`（实测发现的身份污染副作用）
- guidance 没有"给谁发"的判断逻辑，统一发给 root 或统一发给 child 都会错
- 用户诉求：**主动指导要区分主 agent 和子 agent，分别给正确的目标发消息**

## 二、设计原则

1. **Session 树是一等公民**：所有后续操作（监控、指导、完成判定）都基于树而不是单 SID
2. **curl 直调、零外部依赖**：不做成 MCP server，保留 serve-api skill 的核心卖点
3. **脚本封装 + 原始命令并存**：脚本给日常使用，curl 命令保留给高级用户
4. **不发明新协议**：优先走 `prompt_async` body 字段保留 agent 身份；不要假设存在 `/session/{SID}/guide` 端点
5. **渐进增强**：不破坏 SKILL.md 现有内容，新增章节 + 引用脚本

## 三、方向 1：引入 Session 树抽象

### 3.1 数据模型

```typescript
interface SessionNode {
  id: string;
  agent: string;       // 真实 agent 身份（Orchestrator / build / plan / general / explore / scout）
  parent: string | null;
  children: string[];
  status?: "idle" | "working" | "error";
  title?: string;
}

interface SessionTree {
  root: string;
  nodes: Record<string, SessionNode>;
  allIds: string[];    // 扁平化，方便 grep -E
  leafIds: string[];   // 叶子节点（完成判定用）
}
```

### 3.2 查询脚本：`qoderwork/scripts/session-tree.ts`

```bash
bun run scripts/session-tree.ts <ROOT_SID>
# 输出示例：
# ses_0c9798a78ffe4r46ZvYSXZyBWL | Orchestrator | root
# └─ ses_0c9792cbaffeVQhM1254ZgYpqR | build | child

# 加 --json 输出结构化数据
bun run scripts/session-tree.ts <ROOT_SID> --json
```

**实现要点**：
- 优先验证并递归调 `GET /session/{sid}/children`；若返回 HTML、非 JSON 或 404，则启用 fallback
- fallback 顺序：SDK `opencode.db.session.parent_id` -> `/tmp/sse-events.jsonl` 的 `session.created` -> work-one `session_map/session_registry/session_events`
- 从 `GET /session/{sid}`、children 响应或 fallback 记录拿 `agent` 字段；无法确认时标记为 `unknown`，不得臆造身份
- 深度上限 5（防止 dispatch 环），超时 5s
- 错误容忍：单个子查询失败不阻断整棵树

### 3.3 SKILL.md 文档调整

新增 §1.1 "Session 树查询"，把 `GET /session/{SID}/children` 写为首选查询方式，同时明确 fallback。在"核心操作快速参考"表中新增第 11 行：

| # | 操作 | 命令 |
|---|---|---|
| 11 | Session 树查询 | `bun run scripts/session-tree.ts {ROOT_SID}` |

## 四、方向 2：统一监控改为"全树监控"

### 4.1 当前三种方法的升级

| 旧方法 | 新方法 |
|---|---|
| `grep "ses_XXXXX"` 单 SID | `grep -E "ses_A\|ses_B\|ses_C"` 多 SID |
| `session.idle && sid == X` | 所有叶子 + 根 idle → 全树完成 |
| 一次性 children 查询 | 每 5s 重跑 session-tree.ts，把新出生的子 session 并入监控池；children endpoint 不可用时走 DB/SSE fallback |

### 4.2 监控脚本：`qoderwork/scripts/monitor-tree.ts`

```bash
bun run scripts/monitor-tree.ts <ROOT_SID>
# 每 5s 输出一次：
# [08:25:00] root=Orchestrator(idle)    | child=build(working) | pending_questions=0
# [08:25:05] root=Orchestrator(working) | child=build(idle)    | pending_questions=1
# [08:25:10] root=Orchestrator(idle)    | child=build(idle)    | pending_questions=0
# [08:25:23] ✓ all nodes idle, tree completed

# 选项：
#   --interval 5       轮询间隔（秒），默认 5
#   --timeout 600      超时（秒），默认 600
#   --on-question url  检测到 question 时调用 webhook
```

**实现要点**：
1. 启动时拉一次 session tree
2. 每轮（默认每 5s）：
   - 重跑 session-tree.ts 合并新出现的 child（应对 dispatch 延迟）
   - 从 `/tmp/sse-events.jsonl` 过滤 `allIds`，解析最近 `session.idle` / `session.error` / `question.asked`
   - 从 `GET /question` 统计 `pending_questions`
   - 对每个节点判定 status：最近 15s 内有 `message.updated` / `tool.execute` 即 working，有 `question.asked` 且未 replied 即 question-pending，否则 idle
3. 全树 idle 连续 2 轮（即连续 10s）→ 输出完成信号并退出
4. 超时或任一节点 `session.error` → 异常退出

### 4.3 SKILL.md 文档调整

- **重写 §"Agent 完成检测"** 为"全树完成检测"，三种方法都加 tree 版本
- **合并 §"并行 Sub-Agent 交互流程"** 到新的 §"全树监控流程"，强调"动态发现 + 多 SID grep + 全树 idle 判定"
- **新增 §"全树监控 Pitfalls"**：
  - dispatch 延迟：monitor-tree 自动处理，单查 children 会漏
  - children endpoint 不可用：不要解析 HTML；切换到 SDK DB / SSE / framework DB fallback
  - 嵌套孙 agent：脚本递归到深度 5，更深要手动介入
  - SSE 断连：仍保留 REST 补漏，每 30s `GET /session/{SID}/message?limit=1` 兜底

## 五、方向 3：指导路由改为"按 question.sessionID 路由 + 身份保留"

### 5.1 身份保留发送（所有直发场景强制使用）

**核心规则**：直发消息给任何 session 时，**必须传 agent 字段**，否则子 session 会被覆盖成 `Orchestrator`。

```bash
# 旧写法（会污染子 session 身份）
curl -X POST http://localhost:4096/session/{SID}/prompt_async \
  -d '{"parts":[{"type":"text","text":"..."}]}'

# 新写法（身份保留）
curl -X POST http://localhost:4096/session/{SID}/prompt_async \
  -H 'Content-Type: application/json' \
  -d '{"parts":[{"type":"text","text":"..."}], "agent":"<SID 真实 agent>"}'
```

agent 来自 session-tree 查询结果，不靠人记。

### 5.2 指导脚本：`qoderwork/scripts/guide.ts`

```bash
bun run scripts/guide.ts <SID> "<guidance text>"
# 自动：
#   1. 查 SID 真实 agent（通过 session-tree.ts）
#   2. POST prompt_async 带 agent 字段
#   3. 打印回执（status code + 子 session 最新回复预览）

# 选项：
#   --sync     同步等待完成（默认 async）
#   --timeout  同步超时（秒）
```

### 5.3 路由判定规则

**核心规则**：question 来自谁就指导谁，不绕回父节点。

```
1. GET /question → 返回所有 pending questions，每个带 sessionID
2. 用 session-tree 反查该 SID 是 root 还是 child
3. 路由：
   - SID 是 root       → guidance 发给主 agent（agent="Orchestrator"）
   - SID 是 child      → guidance 直发给子 session（agent=child 真实 agent）
4. reply 路由不变：`POST /question/{QID}/reply` 是按 QID 路由的，天然正确；不要使用不存在的 `/session/{SID}/reply`
```

**禁忌**：
- ❌ 看到子 session 的 question 却给父 session 发 guidance（父无法替子回答）
- ❌ 给 child 发 guidance 时不传 agent（身份会被覆盖）
- ❌ 同时给父子发同一条 guidance（重复干扰）

### 5.4 SKILL.md 文档调整

- **改造 §5 "检查 Questions" + §6 "回复 Question"**：强调 question.sessionID 是路由键
- **新增 §"主动指导路由"** 章节：
  - 路由判定规则
  - 身份保留发送示例
  - 三种典型场景：主 agent 求助、子 agent 求助、父子同时求助
- **新增 §"Pitfalls: agent 身份覆盖"**：把"不传 agent 导致子 session 变 Orchestrator"写成显式警告

## 六、方向 4：主动干预的工具、触发时机与生效点

本节回答三个问题：用什么工具干预、什么时候触发干预、在 OpenCode 侧什么时候生效。

### 6.1 干预工具矩阵（按介入时机分类）

| 工具 | 调用方式 | 是否阻塞 agent | 生效时机 | Token 成本 |
|---|---|---|---|---|
| `POST /session/{SID}/message` | 同步 HTTP | **阻塞**到 agent 完成后返回 | agent 开始新一轮 | 高（agent 完整跑完）|
| `POST /session/{SID}/prompt_async` | 异步 HTTP | 立即返回 | 排入队列，下一轮开始 | 高（同上）|
| `POST /question/{QID}/reply` | 同步 HTTP | 立即返回 | **立即恢复**被暂停的 agent | 低（仅 agent 后续动作）|
| `POST /session/{SID}/abort` | 同步 HTTP | 立即终止 | 立即 | 无 |
| SSE `/tmp/sse-events.jsonl` | tail 文件 | 只读 | N/A | 无 |
| `GET /question` | 轮询 | 只读 | N/A | 无 |

### 6.2 触发判定链（机械层 + LLM 层混合）

```
1. [机械] monitor-tree.ts 持续报告（每 5s 一次）
     ↓ 检测到以下任一信号：
     - pending_questions 由 0 → 1
     - session.error 出现
     - 同一 tool 连续 3 次 failed
     - 3 分钟无 message.updated 但未 idle
     
2. [LLM] QoderWork 读取原始数据（question 文本 / 错误详情 / 最近 message）
     ↓ 判断：
     - 是否需要干预？
     - 干预给谁（root / 哪个 child）？
     - 用什么工具（reply / prompt_async / abort）？
     - 指导内容是什么？
     
3. [机械] intervene.ts 执行投递（身份保留 + turn 状态检查）
```

### 6.3 典型触发场景

| 场景 | 触发信号 | 选用工具 | 原因 |
|---|---|---|---|
| agent 主动求助 | `GET /question` 返回该 SID 的 question | `POST /question/{QID}/reply` | agent 已暂停等待，reply 立即恢复 |
| agent 跑偏但未察觉 | QoderWork 读 message 发现方向错误 | `POST /session/{SID}/prompt_async` + `abort` 组合 | 异步注入 + 强制重新思考 |
| 子 agent 陷入循环 | tool 失败计数超阈值 | `POST /session/{childSID}/abort` | 止损优先 |
| 父子协作卡住 | 父 idle 但 child 还在跑 | 不干预，继续 monitor | 正常状态 |
| 全树 idle 但任务未完 | 全树 idle + QoderWork 判定未达标 | `POST /session/{rootSID}/prompt_async`（新一轮）| 让 root 重新评估并可能再 dispatch |

### 6.4 OpenCode 侧的 Turn 模型与生效点

**OpenCode 是 turn-based（回合制），不是流式可中断的**。这是理解生效时机的核心。

#### Turn 结构

```
用户消息到达
   ↓
[Turn 开始]
   ↓
system prompt 构造（含 skill-summary 注入）
   ↓
LLM 推理 → 决定 tool calls
   ↓
tools 顺序执行（read/write/bash/...）
   ↓
LLM 看到 tool results → 继续推理
   ↓
可能继续 tool calls（循环）
   ↓
LLM 输出最终 text，无 tool calls
   ↓
[Turn 结束] → session.idle
```

#### 各工具在 turn 中的生效点

```
                ┌─ prompt_async 消息入队 ─┐
                │                          ↓
Turn N:  [system][LLM][tool][tool][LLM][text] → idle
                                                    ↓
Turn N+1:[system 重读队列][LLM 看到新消息][tool]...
                ↑
                └─ 这是 prompt_async 实际生效的位置
                
question/reply 特殊：
Turn N:  [LLM][tool:question][暂停]───等待 reply───[继续][tool][text] → idle
                                    ↑              ↑
                                 reply 到达 ─── 立即恢复
```

#### 关键事实

1. **agent 执行完（turn 结束）不是唯一生效点**。准确说法是：
   - `prompt_async`：**下一轮 turn 开始时**生效（可能在当前 turn 结束后，也可能 agent 自己还有后续 turn）
   - `question/reply`：**当前 turn 内立即**生效（agent 被 question 工具主动暂停）
   - `abort`：**立即**生效（终止当前 turn）

2. **Mid-turn 无法注入**：如果 agent 正在执行 tool（比如 bash 跑了 30s），这 30s 内任何 `prompt_async` 都进不去，必须等当前 tool 完成、LLM 看到结果、决定下一步时才能读取新消息。

3. **system.transform 是注入 guidance 的天然入口**：每轮 turn 开始前都会重跑 `experimental.chat.system.transform`，所以 skill-summary v2.3 注入的 guidance 在**每个 turn 开始都重新生效**。如果要持久化 guidance，应该写在这里而不是单发消息。

4. **子 agent 的 turn 独立于父 agent**：dispatch 出的 child 有自己的 turn 循环，父 turn 暂停等 child 完成。所以给 child 发 `prompt_async` 会在 child 的下一个 turn 生效，与父无关。

### 6.5 统一干预脚本：`qoderwork/scripts/intervene.ts`

把 guide.ts 的"投递"能力和 abort/reply 能力合并为统一入口：

```bash
bun run scripts/intervene.ts <SID> --mode=guide --text="..."
# 内部：查 SID 真实 agent → POST prompt_async 带 agent 字段

bun run scripts/intervene.ts <SID> --mode=reply-qid <QID> --text="..."
# 内部：POST /question/{QID}/reply，自动校验 QID 属于 SID

bun run scripts/intervene.ts <SID> --mode=abort
# 内部：POST /session/{SID}/abort，等待 session.error 确认

bun run scripts/intervene.ts <SID> --mode=status
# 内部：返回 turn 状态（idle | working | question-pending | error）
```

**与 guide.ts 的关系**：guide.ts 作为轻量快捷方式保留（`bun guide.ts <SID> "..."` 等价于 `intervene.ts --mode=guide`），intervene.ts 作为完整入口覆盖所有干预模式。

### 6.6 monitor-tree 的 turn 状态扩展

当前 §4.2 的 status 枚举扩展为 4 种，以支持 intervention 路由：

| status | 判定条件 | intervention 含义 |
|---|---|---|
| `idle` | 最近 15s 无 `message.updated` 且无 `tool.execute` | 可以发新一轮 prompt_async |
| `working` | 最近 15s 内有 `message.updated` 或 `tool.execute` | 不要打断，等下一轮 |
| `question-pending` | 有 `question.asked` 事件且未 replied | 优先用 `POST /question/{QID}/reply` 立即恢复 |
| `error` | 有 `session.error` 事件 | 需要 abort + 重新 dispatch 或人工介入 |

### 6.7 SKILL.md 文档调整

- **新增 §"主动干预时机与工具"**：完整覆盖 §6.1-6.4 内容
- **新增 §"Turn 模型与生效点"**：用 ASCII 图解释 turn 结构和各工具生效位置
- **新增 §"Pitfalls: mid-turn 注入不可行"**：明确"agent 正在跑 tool 时无法注入，必须等 turn 边界"
- **新增 §"intervene.ts 使用示例"**：覆盖 4 种 mode 的典型用法
- **更新 §"全树监控"**：状态枚举扩展为 4 种

## 七、方向 5：文档结构调整总览

| 当前章节 | 调整 |
|---|---|
| §1 核心操作 | 新增 §1.1 "Session 树查询"，把 `GET /session/{SID}/children` 作为首选操作，并记录 DB/SSE fallback |
| §"Agent 完成检测" | 重写为"全树完成检测"，三种方法都加 tree 版本 |
| §"并行 Sub-Agent 交互流程" | 合并到新的 §"全树监控流程"，强调"动态发现 + 多 SID grep + 全树 idle 判定" |
| 新增 §"主动指导路由" | 讲清楚"按 question.sessionID 路由 + identity 保留 + 绕回禁忌" |
| 新增 §"主动干预时机与工具" | 覆盖 §6.1-6.4 内容（干预矩阵 / 触发链 / turn 模型 / 生效点） |
| 新增 §"Pitfalls: agent 身份覆盖" | 把"不传 agent 导致子 session 变 Orchestrator"写成显式警告 |
| 新增 §"Pitfalls: mid-turn 注入不可行" | 明确 prompt_async 只在 turn 边界生效 |
| reference.md §A | 新增 4 个脚本的 E2E 验证用例（含 intervene.ts） |

## 八、落地顺序

1. **先写四个脚本**（`session-tree.ts` / `monitor-tree.ts` / `guide.ts` / `intervene.ts`）
   - 独立可测、不破坏 SKILL.md 现有内容
   - 每个脚本附 `--help` 和简单示例
   - 单元测试：mock 一个 2 层树（root + 2 children），验证递归、children endpoint 失败 fallback、身份保留、4 种 intervene mode

2. **再改 SKILL.md**
   - 引用脚本、加入 session 树概念
   - 新增 §1.1 Session 树查询、§"全树监控流程"、§"主动指导路由"、§"主动干预时机与工具"、§"Turn 模型与生效点"、§"Pitfalls"
   - 保留原有 curl 命令（高级用户仍可用）

3. **最后改 reference.md**
   - 补充详细测试用例
   - 新增"子 session 工作中被打断"的并发场景
   - 新增"嵌套孙 agent"场景
   - 新增"mid-turn 注入无效"反例场景

## 九、主要取舍

| 取舍 | 选择 | 理由 |
|---|---|---|
| MCP server vs 独立脚本 | 独立脚本 | 保持"curl 直调、零外部依赖"核心卖点 |
| 替换 vs 并存 curl 命令 | 并存 | 保留底层原始命令给高级用户 |
| agent 身份保留机制 | prompt_async body 字段 | 已实测可行，不发明新协议 |
| 监控粒度 | 全树 + 动态发现 | dispatch 有延迟，静态查询会漏 |
| 完成判定 | 全树 idle 连续 2 轮（10s） | 防抖，避免瞬态 idle 误判 |
| 干预工具统一入口 | intervene.ts 覆盖 4 种 mode | guide.ts 保留为轻量别名，避免脚本爆炸 |
| 干预生效时机 | 接受 turn-based 语义 | prompt_async 只在 turn 边界生效；要立即生效必须诱导 agent 用 question 工具 |

## 十、验证标准

### 10.1 脚本功能验证

- [ ] `session-tree.ts` 先验证 `GET /session/{sid}/children` 返回 JSON；若返回 HTML/404/非 JSON，自动启用 DB/SSE fallback
- [ ] `session-tree.ts` 能查询 2 层树（root + 2 children），返回正确 parentID/agent
- [ ] `session-tree.ts` 处理 dispatch 延迟（首次查询 0 child，5s 后 1 child）
- [ ] `monitor-tree.ts` 能识别 root idle 但 child working
- [ ] `monitor-tree.ts` 能在全树 idle 连续 2 轮后退出
- [ ] `monitor-tree.ts` 能区分 4 种 status：idle / working / question-pending / error
- [ ] `guide.ts` 给子 session 发消息后，child 的 agent 字段保持不变
- [ ] `intervene.ts --mode=guide` 等价于 guide.ts
- [ ] `intervene.ts --mode=reply-qid` 能正确 reply 并校验 QID 属于 SID
- [ ] `intervene.ts --mode=abort` 能终止运行中的 session 并等待 session.error 确认
- [ ] `intervene.ts --mode=status` 能返回 4 种 status 之一

### 10.2 端到端场景验证

- [ ] 场景 A：Orchestrator 派遣 1 个 build 子 agent，monitor-tree 同时监控两者直到全树完成
- [ ] 场景 B：Orchestrator 派遣 2 个并行子 agent（build + plan），monitor-tree 同时监控 3 节点
- [ ] 场景 C：子 agent 发出 question，intervene.ts --mode=reply-qid 直发给子 agent 并保留 build 身份
- [ ] 场景 D：父子同时发出 question，intervene.ts 分别路由到正确目标
- [ ] 场景 E：子 session 工作中被打断（接收 guidance），验证 mid-turn 注入延迟到下一 turn 才生效
- [ ] 场景 F：子 agent 陷入循环（同 tool 连续失败 3 次），intervene.ts --mode=abort 止损

### 10.3 文档验证

- [ ] SKILL.md 新增章节全部引用了脚本
- [ ] reference.md 新增 6 个场景的实测步骤（含 mid-turn 反例）
- [ ] §"Pitfalls" 至少覆盖：agent 身份覆盖、dispatch 延迟、SSE 断连、嵌套孙 agent、mid-turn 注入不可行

## 十一、风险与缓解

| 风险 | 缓解 |
|---|---|
| dispatch 可能嵌套到 3 层以上 | session-tree.ts 深度上限 5，更深要手动介入 |
| `/children` endpoint 返回 HTML/非 JSON | 不解析页面；改走 SDK DB parent_id、SSE session.created、framework session_map/session_registry/session_events fallback |
| SSE 断连丢事件 | monitor-tree 保留 REST 补漏（每 15s，与轮询 cadence 对齐） |
| 子 session 拒绝外部直发（权限模型） | intervene.ts 检测 403 时回退到通过父 session 中转 |
| prompt_async 的 agent 字段被 SDK 忽略 | 实测 v1.17.13 工作；加版本检查提示 |
| monitor-tree 长轮询阻塞终端 | 默认 async 输出，加 `--detach` 写入 `/tmp/monitor-{ROOT_SID}.log` |
| mid-turn 注入被误解为"立即生效" | SKILL.md §"Turn 模型"章节强制说明，intervene.ts 在 status=working 时打印警告 |
| question-pending 状态误判（已 reply 但事件延迟） | 同时查 `GET /question` 和 SSE `question.replied` 双保险 |

## 十二、与相关蓝图的关系

- `acp-bridge-serve-api-redesign.md`：ACP 层桥接，与本蓝图不重叠；intervene.ts 输出可被 ACP bridge 复用
- `blueprint-opencode-framework-simplification-roadmap.md`：§4 提到的"QoderWork 双向通信"是本蓝图的上层目标
- `documents/native-opencode/native-opencode-sse-events.md`：事件源文档，monitor-tree 的 JSONL 解析规则来源
- `blueprint-opencode-framework-simplification-roadmap.md` §"QoderWork guidance bridge"：本蓝图的 intervene.ts 是该桥接的具体落地

## 十三、版本历史

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-07-06 | 初始版本：4 个优化方向 + 3 个脚本 + 落地顺序 |
| v1.1 | 2026-07-06 | 新增 §六"主动干预的工具、触发时机与生效点"（干预矩阵 / 触发判定链 / Turn 模型 / intervene.ts 统一脚本 / 4 种 turn 状态）；轮询间隔 10s → 5s，working 检测窗口 30s → 15s，stale-session 阈值 30min → 3min；新增 intervene.ts 为第 4 个脚本；主要取舍增加 2 行（干预统一入口 / turn-based 语义接受）；验证标准扩展到 10 项脚本验证 + 6 个端到端场景；风险表增加 mid-turn 误解和 question-pending 误判两条 |
| v1.2 | 2026-07-06 | 结合 qoderwork/scripts 与 E2E 结果校正实施状态：四个 session-tree 脚本尚未创建，当前只有 start-serve/sse-daemon/E2E helper；`/children` endpoint 不能视为已验证可靠，新增 SDK DB/SSE/framework DB fallback 要求 |
| v1.4 | 2026-07-07 | 结合 smoke-test-results-20260707 校正端点边界：`/session/{SID}/guide`、`/session/{SID}/reply`、`/session/{SID}/interrupt` 不存在；guide 通过 `prompt_async + agent`，reply 通过 `/question/{QID}/reply`，止损通过 abort |
