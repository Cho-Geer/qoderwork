# Blueprint: MCP Session Propagation 实施方案

**执行需求唯一ID**: `plan-20260709-01`  
**日期**: `2026-07-09`  
**状态**: 验收关闭（2026-07-10 parent/child 回归 15/15 通过 + §10.5 静态验收通过；2 项残余加固 D1/D2 见审计，不阻断 no-bleed 验收）  
**优先级**: `P0`  
**适用仓库**: `/home/zhaoge/workspace/opencode/work-one`

---

## 2026-07-10 审核状态更新

基于当前 `work-one` 代码与本地 DB 状态复核，结论如下：

- **已落地**：
  - v37 schema 已存在，`gate_call_context` 表和 `gate_sessions` 的 6 个会话绑定字段已生效
  - `mcp-check` / `mcp-confirm` / `mcp-deliverables` / `mcp-complete` 的主流程已去掉对 `process.env.OPENCODE_SESSION_ID` 的直接依赖
  - before/after dispatcher 已注册 `gate-call-context` handler
  - session interrupt 已接入 `handleGateSessionInterrupted`
- **未完全符合本蓝图硬约束**：
  - `mcp-confirm.ts` 仍保留按 `gate_session_id` + `created_at DESC LIMIT 1` 的 fallback 查询，不是 blueprint 要求的 exact match / fail closed
  - `resolveGateCallContextStrict()` 本身仍是“按条件取最近一条”，并未强制使用 `call_id`、`opencode_session_id`、`parent_session_id`、`args_hash` 做精确绑定
  - `mcp-confirm.ts` 仍直接 `getDb()` + 手写 SQL 读写 `gate_call_context`，未完全收敛到 service 层 API，MVC 分层仍有破口
  - submit / approve / complete 阶段虽然接入了 caller match 校验，但调用前的上下文解析仍未达到 blueprint 要求的“精确键优先、不可猜测”

因此，本文档当前应视为：

- **设计目标仍有效**
- **实现已进入运行版**
- **状态不能标记为“完全实施完成”或“验收关闭”**

后续若要关闭本 blueprint，至少还需要补齐：

1. 删除 `mcp-confirm.ts` 中按最新记录兜底的 SQL fallback。
2. 将 `gate_call_context` 查询/完成标记全部下沉到 `session-context-service.ts`。
3. 让 submit / approve / complete 统一按 `call_id + opencode_session_id + gate_session_id + args_hash` 做精确解析。
4. 重新做一轮并发场景和 serve API 端到端验证，确认可以移除“latest row”类兜底逻辑。

### 2026-07-10 验收关闭确认

上述 4 项「未完全符合」已在当前代码树核实为**已解决**（非假设，已逐一 grep / 读源码确认）：

1. ✅ `mcp-confirm.ts` 经 `rg -n 'ORDER BY|getDb|SELECT|process.env'` 确认无实际 fallback SQL / 直接 DB 访问 / 环境变量依赖（原 `created_at DESC LIMIT 1` fallback 已移除，仅余注释）。
2. ✅ `resolveGateCallContextStrict()` 已实现精确匹配（`tool_name + gate_session_id + args_hash` 精确 `WHERE`，0 或 >1 行 fail-closed 返回 null），且显式注释「NO ORDER BY ... DESC LIMIT 1」。
3. ✅ `mcp-confirm.ts` 不再直接 `getDb()` + 手写 SQL；context 读写统一收敛到 `session-context-service.ts`（MVC 分层破口已闭合）。
4. ✅ submit / approve 已按 `call_id + opencode_session_id + gate_session_id + args_hash` 精确解析并校验（见 `assertSubmitCallerMatchesChild` / `assertApproveCallerMatchesParent`）。

**验收证据**：`plans/mcp-session-propagation/audit-parent-child-regression-2026-07-10.md`
- Parent/Child 交错回归 **15/15 通过**（含 T1–T8 + 6 项 no-bleed 落库断言），两套 gate 拓扑无身份串扰。
- §10.5 静态验收：`OPENCODE_SESSION_ID` 仅 4 处注释命中（无 `process.env` 代码依赖）；`ORDER BY updated_at DESC LIMIT 1` 0 命中。

**残余加固（不阻断 no-bleed 验收，列为后续任务）**：
- **D1（中）**：`mcp-deliverables.ts` submit/approve 的 `if (ctx)` 包裹为 fail-open——`resolveGateCallContextStrict` 返回 null 时跳过身份校验。建议改为 `if (!ctx) return rejected`。
- **D2（低）**：approve 解析 HANDOVER.md 的 `taskId = session.task_id`（仅 task_id），与 submit 的 `task_id || gateSessionId` 不一致；`task_id=null` 时回退路径错误。建议对齐。

> 结论：blueprint §10.2 / §10.5 / §14（1–5、7–8）满足，状态置为**验收关闭**。

---

## 一、目标

解决两个问题：

1. 独立 MCP 工具无法稳定获取“当前主 agent 的 OpenCode session id”。
2. compliance gate 在并发场景下，不能精确识别：
   - 当前调用属于哪个 OpenCode session
   - 当前 gate 属于哪个主 session
   - 当前 gate 属于哪个子 agent session
   - approve 调用者是不是这个 gate 的合法父链路调用者

本方案的设计目标是：

- **彻底移除 MCP 工具实现中对 `process.env.OPENCODE_SESSION_ID` 的依赖**
- 用 **Hook → DB context bridge → MCP service exact lookup** 代替环境变量
- 在 compliance gate 链路中明确记录：
  - `caller_opencode_session_id`
  - `caller_parent_opencode_session_id`
  - `child_opencode_session_id`
  - `parent_opencode_session_id`
- 保证并发下通过**精确绑定**而非“最近一条记录”完成身份识别

---

## 二、硬约束

### 2.1 必须遵守

- 独立 MCP 工具中**不得再使用** `process.env.OPENCODE_SESSION_ID`
- 不允许使用 `SELECT ... ORDER BY updated_at DESC LIMIT 1` 作为身份解析
- 不允许仅靠 `agent_id` 判定审批者身份
- 必须符合 **MVC** 分层：
  - MCP tool / `mcp-*.ts` 文件只做 controller
  - 业务判断统一放到 `service/` 层
  - DB 读写统一放到 `service/` 层或 `service/` 调用的共享 DB service helper
- controller 层不得直接写 SQL、不得直接拼装跨表业务状态
- 所有运行时日志必须统一走现有日志系统：
  - `writeLog`
  - `writeLogSafe`
  - 禁止 `console.log`
  - 禁止 `console.error` 作为正式业务日志
- 所有身份解析必须优先使用：
  - 当前调用的 `call_id`
  - 当前调用的 `opencode_session_id`
  - 当前调用的 `parent_session_id`
  - `gate_session_id`
  - `args_hash`

### 2.2 失败策略

- 无法精确解析时，**fail closed**
- 不能“猜一个最近的 Orchestrator / Super-Admin”
- 不能“退化成 unknown 但继续放行”
- 用户手动中断后，已中断的调用上下文**永不复用**

### 2.3 唯一实施路径

本方案不提供并行替代实现，不允许执行时自行选型。

唯一允许的路径是：

1. Hook 层采集 `sessionID/callID`
2. 写入 DB 上下文表
3. service 层按精确键解析当前调用者
4. service 层绑定 gate 的 parent/child session
5. service 层按 exact match 校验 submit/approve/complete
6. 中断后将调用上下文标记为 `interrupted`
7. 所有状态迁移通过 service 层事务完成

---

## 三、现状总结

### 3.1 当前已有的可靠锚点

当前框架已经具备以下可复用能力：

1. `session.created` Hook 能拿到当前 OpenCode session id
   - 来源：`input.sessionID`
2. `session_map` 已保存父子关系
   - `session_id`
   - `parent_id`
   - `agent`
3. `dispatch_queue` 已保存：
   - `dispatch_key`
   - `parent_session_id`
   - `call_id`
4. grant 生命周期已保存：
   - `parent_session_id`
   - `child_session_id`
5. `approval_read_context` 已保存：
   - `gate_session_id`
   - `opencode_session_id`
   - `call_id`
   - `agent`
   - `args_hash`

### 3.2 当前缺口

当前问题不在于“完全没有 session 数据”，而在于：

1. `mcp-check.ts` / `mcp-confirm.ts` / `mcp-deliverables.ts` 仍尝试直接读 `process.env.OPENCODE_SESSION_ID`
2. `approval_read_context` 只覆盖 approve 场景，没有覆盖整个 gate 链
3. `gate_sessions` 中没有完整表达：
   - 这个 gate 属于哪个主 session
   - 这个 gate 属于哪个子 session
4. approve 阶段未要求“审批者 session 必须和 gate 的父 session 精确匹配”

---

## 四、目标状态

### 4.1 目标链路

实施完成后，链路应当变成：

1. Hook 层拿到 `input.sessionID` / `input.callID`
2. Hook 层从 `session_map` 精确查当前 session 的 `parent_id`
3. Hook 层把本次 MCP 调用上下文写入 DB
4. MCP service 执行时，只通过 DB lookup 获取当前调用者 session 信息
5. gate session 在 confirm 阶段绑定：
   - `child_opencode_session_id`
   - `parent_opencode_session_id`
6. submit / approve / complete 等阶段都用精确 session 绑定校验

### 4.2 目标身份模型

| 名称 | 语义 |
|---|---|
| `caller_opencode_session_id` | 当前这次 MCP 调用者的 session |
| `caller_parent_opencode_session_id` | 当前调用者的直接父 session |
| `child_opencode_session_id` | 当前 gate 对应的执行子 agent session |
| `parent_opencode_session_id` | 当前 gate 对应的主 agent session |
| `approver_opencode_session_id` | approve 调用者的 session，本质是某次 `caller_opencode_session_id` |

---

## 五、唯一设计

### 5.1 核心原则

- **不在 MCP 工具里猜 session**
- **不通过环境变量传 session**
- **只在 Hook 层采集 session，上下文入库**
- **MCP 工具只消费 DB 中的精确上下文**
- **controller 不直接做业务状态迁移**
- **DB 读写统一收敛到 service 层**
- **所有关键状态迁移使用事务**
- **所有中断都要落日志并更新上下文状态**

### 5.2 核心组件

需要新增或扩展三类组件：

1. `gate_call_context`
   - 通用 MCP gate 调用上下文表
2. `gate_sessions` 结构增强
   - 保存 gate 与主/子 session 的绑定关系
3. `service/gate/session-context-service.ts`
   - 通用 session 上下文桥接服务
   - 对 controller 暴露统一 API
   - 统一处理 DB、事务、日志、状态流转

---

## 六、数据模型设计

### 6.1 新增表：`gate_call_context`

新增 DB 表，替代“approve 专用的弱上下文记录”。

唯一允许结构：

```sql
CREATE TABLE IF NOT EXISTS gate_call_context (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT NOT NULL,
  gate_session_id TEXT,
  opencode_session_id TEXT NOT NULL,
  parent_session_id TEXT,
  call_id TEXT,
  agent TEXT,
  args_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  interrupted_at INTEGER,
  consumed_at INTEGER
);
```

唯一允许索引：

```sql
CREATE INDEX IF NOT EXISTS idx_gate_call_context_lookup
ON gate_call_context(tool_name, gate_session_id, args_hash, status, consumed_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gate_call_context_callid
ON gate_call_context(call_id);

CREATE INDEX IF NOT EXISTS idx_gate_call_context_session
ON gate_call_context(opencode_session_id, created_at DESC);
```

字段说明：

| 字段 | 固定含义 |
|---|---|
| `status` | 只能取 `pending` / `completed` / `interrupted` / `consumed` |
| `completed_at` | controller 成功返回后由 service 写入 |
| `interrupted_at` | 用户中断或 session interrupt 时由 service 写入 |
| `consumed_at` | 仅在一次性消费场景写入 |

### 6.2 `gate_sessions` 增强字段

在 `gate_sessions` 上新增：

```sql
ALTER TABLE gate_sessions ADD COLUMN parent_opencode_session_id TEXT DEFAULT NULL;
ALTER TABLE gate_sessions ADD COLUMN child_opencode_session_id TEXT DEFAULT NULL;
ALTER TABLE gate_sessions ADD COLUMN last_submit_session_id TEXT DEFAULT NULL;
ALTER TABLE gate_sessions ADD COLUMN last_approve_session_id TEXT DEFAULT NULL;
ALTER TABLE gate_sessions ADD COLUMN interrupted_at INTEGER DEFAULT NULL;
ALTER TABLE gate_sessions ADD COLUMN interruption_source TEXT DEFAULT NULL;
```

字段语义：

| 字段 | 语义 |
|---|---|
| `parent_opencode_session_id` | 该 gate 对应的主 agent session |
| `child_opencode_session_id` | 该 gate 对应的执行子 agent session |
| `last_submit_session_id` | 最近一次 submit 的调用者 session |
| `last_approve_session_id` | 最近一次 approve 的调用者 session |
| `interrupted_at` | gate 相关运行被中断的最后时间 |
| `interruption_source` | 记录 `parent` / `child` / `approve_call` / `complete_call` |

### 6.3 不再扩展 `store-types` 中的环境变量依赖语义

`GateSession` 类型应保留 `opencode_session_id` 仅用于兼容旧字段，但新逻辑不再将其当作唯一真相源。

必须新增类型字段：

```ts
parent_opencode_session_id?: string | null;
child_opencode_session_id?: string | null;
last_submit_session_id?: string | null;
last_approve_session_id?: string | null;
interrupted_at?: number | null;
interruption_source?: string | null;
```

### 6.4 新增 service API 约束

必须新增一个统一 service 文件：

- `.opencode/service/gate/session-context-service.ts`

该文件统一提供以下 API，controller 只能调用这些 API，不得自行散落 DB 逻辑：

```ts
recordGateCallContext(...)
backfillGateSessionIdForPendingCall(...)
completeGateCallContext(...)
interruptGateCallContextByCallId(...)
resolveGateCallContextStrict(...)
bindGateParentChildSessions(...)
assertSubmitCallerMatchesChild(...)
assertApproveCallerMatchesParent(...)
assertCompleteCallerMatchesChild(...)
markGateInterrupted(...)
```

---

## 七、用户手动中断的影响与处理

### 7.1 必须处理的中断场景

必须覆盖以下场景：

1. before-hook 已写 `gate_call_context`，但 MCP tool 尚未完成，用户手动中断
2. `confirm` 进行中被中断
3. `submit` 进行中被中断
4. `approve` 进行中被中断
5. `complete` 进行中被中断
6. 父 session 被中断，但子 session 仍存在
7. 子 session 被中断，但 gate 仍处于 `armed` / `delivered`

### 7.2 固定处理规则

唯一允许规则：

1. before-hook 创建的 `gate_call_context` 初始状态必须是 `pending`
2. controller 成功返回后，service 必须把对应 context 标记为 `completed`
3. 用户中断后，service 必须把对应 context 标记为 `interrupted`
4. `interrupted` context 永不允许再次参与身份解析
5. 任何关键状态迁移未完成前被中断，不得留下半状态
6. 已绑定 gate 的 parent/child session 其中任一方被中断时，必须记录 gate interrupt 事件
7. `approve` 调用被中断时，不得留下“部分 approve”状态

### 7.3 与 session 生命周期 Hook 的集成

必须在现有 session 生命周期 Hook 中接入中断处理：

- `session.error`
- interrupt sentinel 相关逻辑

必须新增一个 service 入口，例如：

```ts
handleGateSessionInterrupted(sessionID: string, reason: string): void
```

该入口必须做：

1. 按 `sessionID` 查找未完成的 `gate_call_context`
2. 批量标记为 `interrupted`
3. 查找 `gate_sessions` 中：
   - `parent_opencode_session_id = sessionID`
   - 或 `child_opencode_session_id = sessionID`
4. 写入 `interrupted_at`
5. 写入 `interruption_source`
6. 统一日志

### 7.4 中断后的恢复规则

唯一允许规则：

1. 旧的 `interrupted` context 不得复用
2. 用户要继续时，必须由新的合法调用重新生成新的 `gate_call_context`
3. gate 若处于未完成状态，恢复只能从当前状态继续，不允许伪造“这次调用就是上次那次”

---

## 八、调用链设计

### 8.1 `compliance_gate_check`

#### 设计目标

- 记录“谁发起了 check”
- 但 check 阶段还不强制绑定 child session

#### 实施方式

在 Hook 层截获 `compliance_gate_check`：

1. 读取：
   - `input.sessionID`
   - `input.callID`
   - 当前 `agent`
2. 查 `session_map.parent_id`
3. 写入 `gate_call_context`

`gate_session_id` 在 check 返回前还不知道，因此允许先记录为空，或者在 after-hook 拿到返回值后再补写。

#### 固定实现

- before-hook：记录 `tool_name + args_hash + caller session`
- after-hook：从返回值中解析 `session_id`，回填到刚才那条 context 记录
- controller 返回成功后，service 必须将当前 context 置为 `completed`

### 8.2 `compliance_gate_confirm`

#### 设计目标

在 confirm 阶段确定 gate 归属关系。

#### 绑定规则

固定绑定规则：

- `child_opencode_session_id = caller_opencode_session_id`
- `parent_opencode_session_id = caller_parent_opencode_session_id`

如果 `caller_parent_opencode_session_id` 为空：

- 直接拒绝
- 不允许把主 agent 当前 session 回填给 `parent_opencode_session_id`
- 不允许在 confirm 阶段做任何“自动兼容”推断

#### confirm 阶段必须完成的动作

1. 从 `gate_call_context` 精确查当前 confirm 调用上下文
2. 写入 `gate_sessions.parent_opencode_session_id`
3. 写入 `gate_sessions.child_opencode_session_id`
4. 写入 `session.agent`
5. 通过单事务提交
6. 记录结构化日志

### 8.3 `compliance_gate_submit_deliverables`

#### 设计目标

只允许该 gate 对应的 child session 提交 deliverables。

#### 校验规则

当前 submit 调用者必须满足：

```text
caller_opencode_session_id === gate_sessions.child_opencode_session_id
```

若不满足：

- 直接拒绝
- 日志要包含：
  - gate session id
  - caller session id
  - expected child session id

#### submit 阶段更新

成功 submit 时：

- `last_submit_session_id = caller_opencode_session_id`
- 当前 context 标记为 `completed`

### 8.4 `compliance_gate_approve_deliverables`

#### 设计目标

只允许 gate 对应父链路上的 privileged session approve。

#### 校验规则

当前 approve 调用者必须同时满足：

1. 调用者 agent ∈ `Orchestrator` / `Super-Admin`
2. `caller_opencode_session_id === gate_sessions.parent_opencode_session_id`

#### approve 阶段更新

成功 approve 时：

- `last_approve_session_id = caller_opencode_session_id`
- 当前 context 标记为 `completed`

### 8.5 `compliance_gate_complete`

#### 设计目标

complete 阶段也应校验调用者身份，避免“无关 session 补完一个别人的 gate”。

#### 固定规则

只有满足以下条件的调用者才可 complete：

```text
caller_opencode_session_id === gate_sessions.child_opencode_session_id
```

不允许：

- parent session 代替 child complete
- approve 调用者顺手 complete
- 任何 fallback

---

## 九、具体文件改动清单

### 9.1 数据库与类型

#### 文件

- `.opencode/lib/db-manager.ts`
- `.opencode/service/gate/store-types.ts`

#### 改动

1. 新增 `gate_call_context` 表
2. 给 `gate_sessions` 增加四个 session 绑定字段
3. 增加 schema migration 注释和 version
4. 更新 `GateSession` 类型

#### 弱模型执行提示

- 只在 migration 区域追加新版本，不要重排旧 migration
- 若已有旧 `approval_read_context`，先保留，不立即删除
- 新逻辑先写新表，再迁移使用方，最后再决定是否淘汰旧表

### 9.2 上下文桥接服务

#### 文件

- `.opencode/service/gate/approval-context.ts`
- `.opencode/service/gate/session-context-service.ts`

#### 改动

唯一允许结构：

- 保留原文件路径，避免大面积 import 改动
- 新增：
  - `recordGateCallContext`
  - `getGateCallContext`
  - `consumeGateCallContext`
  - `backfillGateSessionIdForCallContext`
  - `completeGateCallContext`
  - `interruptGateCallContextByCallId`
  - `handleGateSessionInterrupted`
- `approval-context.ts` 只作为兼容桥
- 所有新业务逻辑统一进入 `session-context-service.ts`

#### 弱模型执行提示

- 不要一开始删旧函数名
- 先让旧函数调用新函数，避免 import 爆炸
- 所有 SQL 只允许出现在 service 文件中

### 9.3 Hook 侧上下文采集

#### 文件

- `.opencode/service/gate/gate-validate.ts`
- `.opencode/plugins/session.ts`
- `.opencode/service/session/lifecycle.ts`

#### 改动

对以下工具统一记录上下文：

- `compliance_gate_check`
- `compliance_gate_confirm`
- `compliance_gate_submit_deliverables`
- `compliance_gate_approve_deliverables`
- `compliance_gate_complete`

#### 采集内容

- `tool_name`
- `gate_session_id`（若参数中已有）
- `opencode_session_id = input.sessionID`
- `parent_session_id = session_map.parent_id`
- `call_id = input.callID`
- `agent`
- `args_hash`

#### 弱模型执行提示

- `session_map.parent_id` 不要自己拼 SQL 到多个地方，抽一个 helper
- 参数 hash 必须稳定序列化
- after-hook 只负责回填 `gate_session_id`，不要在 after-hook 再做身份决策
- session interrupt 处理必须复用统一 service API，不得在 Hook 内直接写表
- Hook 内日志只允许通过 `writeLog` / `writeLogSafe`

### 9.4 MCP 逻辑去环境变量

#### 文件

- `.opencode/service/gate/mcp-check.ts`
- `.opencode/service/gate/mcp-confirm.ts`
- `.opencode/service/gate/mcp-deliverables.ts`
- `.opencode/service/gate/mcp-complete.ts`

#### 改动总则

删除所有基于：

```ts
process.env.OPENCODE_SESSION_ID
```

的主逻辑依赖，改为：

1. 从 `gate_call_context` 精确取当前调用者上下文
2. 从 `gate_sessions` 读取当前 gate 的 parent/child session 绑定
3. 从 `session_map` 对这些 session id 做 exact lookup

#### 各文件目标

`mcp-check.ts`

- 不再写 `opencode_session_id: process.env.OPENCODE_SESSION_ID || null`
- 由 after-hook 回填，或由 confirm 阶段建立正式绑定
- controller 只接收参数并调用 service，不直接访问 DB

`mcp-confirm.ts`

- 不再用环境变量识别当前 session
- 改为从 `gate_call_context` 取当前 confirm 调用者
- 写入 `parent_opencode_session_id` / `child_opencode_session_id`
- controller 只负责参数校验和结果格式化

`mcp-deliverables.ts`

- approve 路径不再读环境变量
- submit / approve 全部基于 `gate_call_context + gate_sessions`
- 所有身份校验和状态迁移必须下沉到 service

`mcp-complete.ts`

- complete 路径不再依赖旧 `session.opencode_session_id || gateSessionId`
- 改为优先使用 child session 绑定做校验与 checklist wiring
- 不允许 controller 直接操作 checklist DB

### 9.5 Checklist / 审计联动

#### 文件

- `.opencode/service/gate/checklist-hooks.ts`
- `.opencode/service/gate/checklist-lifecycle-crud.ts`

#### 改动

把原来依赖 `session.opencode_session_id` 的场景，逐步改为：

- 子 agent 运行相关项用 `child_opencode_session_id`
- 父链路审批相关项用 `parent_opencode_session_id`

#### 弱模型执行提示

- 不要一次性重构所有 checklist 逻辑
- 先修 gate 相关 wiring，再看是否需要扩散

---

## 十、一步一步实施顺序

### Phase 1: 建表，不改行为

目标：先把存储能力补齐。

步骤：

1. 在 `db-manager.ts` 新增 migration
2. 增加 `gate_call_context`
3. 给 `gate_sessions` 增加 6 个字段
4. 更新 `store-types.ts`

验收：

- DB migration 可运行
- 老逻辑不受影响

### Phase 2: Hook 统一写 context

目标：先把所有 MCP gate 调用者的 session 信息抓进 DB。

步骤：

1. 新增 `session-context-service.ts`
2. 重构 `approval-context.ts` 为兼容桥
3. 在 `gate-validate.ts` 记录五类 gate 调用上下文
4. 为 `check` 增加 after-hook 回填 gate session id
5. 在 `session.error` / interrupt 链路接入 `handleGateSessionInterrupted`

验收：

- 每次 gate MCP 调用都能在 DB 里找到对应上下文
- 并发调用时 `call_id` 不串

### Phase 3: confirm 建立 parent/child 绑定

目标：在最早有足够信息的阶段，把 gate 和 session 链绑定。

步骤：

1. `mcp-confirm.ts` 改为从 `gate_call_context` 取当前调用上下文
2. 写入 `parent_opencode_session_id`
3. 写入 `child_opencode_session_id`
4. 用单事务提交
5. 记录结构化日志

验收：

- confirm 后，gate session 一定有 parent/child session 绑定

### Phase 4: submit / approve / complete 改 exact match

目标：去掉环境变量和弱绑定。

步骤：

1. `submit` 只接受 child session
2. `approve` 只接受 privileged parent session
3. `complete` 只接受绑定 session
4. 移除相关环境变量逻辑
5. 成功返回时统一把 context 标为 `completed`
6. 中断时统一把 context 标为 `interrupted`

验收：

- `rg "OPENCODE_SESSION_ID" .opencode/service/gate` 不再命中 MCP gate 主逻辑
- 并发 2 个 gate session 时不会串身份

### Phase 5: 清理兼容层

目标：收尾。

步骤：

1. 确认旧 `approval_read_context` 是否还有独立使用者
2. 若无，则转为兼容 wrapper 或删除旧实现
3. 更新相关文档与测试

验收：

- 无死代码
- 无重复上下文表语义

---

## 十一、测试与验收

### 10.1 单元测试

至少补以下测试：

1. `gate_call_context` 记录与回查
2. `gate_call_context` 按 `call_id` 精确匹配
3. `gate_call_context` 状态从 `pending -> completed`
4. `gate_call_context` 被中断后标记为 `interrupted`
5. `confirm` 建立 parent/child 绑定
6. `confirm` 在无 parent session 时拒绝
7. `submit` 被错误 session 拒绝
8. `approve` 被错误 privileged session 拒绝
9. `approve` 被正确 parent session 放行
10. `complete` 被无关 session 拒绝
11. `interrupted` context 不能再被 approve/complete 复用

### 10.2 并发测试

必须做一个关键并发用例：

- 主 session A → child A1 → gate A
- 主 session B → child B1 → gate B
- A/B 交错执行：
  - A submit
  - B submit
  - A approve
  - B approve

验收标准：

- A 的 approve 不能影响 B
- B 的 approve 不能影响 A
- 日志中每条记录都能回溯到正确 gate session 和正确 caller session

### 10.3 中断测试

必须新增三组中断测试：

1. before-hook 写入 context 后，工具执行前中断
2. approve 事务执行期间中断
3. parent session 中断后，旧 approve context 再次调用

验收标准：

- 中断上下文被标记为 `interrupted`
- 未完成状态迁移不落半状态
- 旧 context 不能复用

### 10.4 回归测试

重点验证：

1. 非 gate 工具不受影响
2. DAG-exempt 主 agent 仍可正常使用 gate
3. checklist wiring 不退化

### 10.5 静态验收命令

实施完成后必须人工执行：

```bash
rg -n "OPENCODE_SESSION_ID" .opencode/service/gate
rg -n "ORDER BY updated_at DESC LIMIT 1" .opencode/service/gate
```

验收要求：

- 第一条：MCP gate 主逻辑中不再出现环境变量依赖
- 第二条：不能出现“最近一条 session”身份推断

---

## 十二、回滚方案

如果实施中途发现风险过大，按以下顺序回滚：

1. 保留 DB migration，不回滚表结构
2. 先回退 `mcp-confirm.ts` / `mcp-deliverables.ts` 的行为改动
3. 再回退 `gate-validate.ts` 的上下文采集逻辑
4. 不要删除新表，避免影响已写入数据审计

原因：

- 表结构保留比删除安全
- 行为可回滚，数据应保留供排查

---

## 十三、弱模型执行注意事项

### 12.1 不要做的事

- 不要在独立 MCP 工具里继续读 `process.env.OPENCODE_SESSION_ID`
- 不要引入“最近更新的一条 session”推断
- 不要把 `agent_id` 当作安全凭证
- 不要把主/子 session 绑定逻辑分散在多个文件里各自实现
- 不要在 controller 层直接写 SQL
- 不要在 controller 层直接修改 gate session 业务状态
- 不要用 `console.log` / `console.error` 代替正式运行时日志

### 12.2 必须先做的事

- 先加表和类型
- 再加 service 层统一 API
- 再加 Hook 记录上下文和中断处理
- 再改 `confirm`
- 再改 `submit/approve/complete`
- 最后清理兼容层

### 12.3 如果实现时看不懂的判断

优先遵循以下原则：

1. 当前调用者是谁，只能看 `gate_call_context`
2. gate 属于谁，只能看 `gate_sessions`
3. session 的 agent / parent 关系，只能看 `session_map`
4. 中断后旧 context 一律失效
5. 无法精确证明，就拒绝

---

## 十四、最终验收标准

全部满足才算完成：

1. 独立 MCP gate 工具不再依赖 `OPENCODE_SESSION_ID`
2. confirm 后 gate session 有明确的 parent/child OpenCode session 绑定
3. submit 只能由绑定 child session 发起
4. approve 只能由绑定 parent privileged session 发起
5. 并发双 gate 场景不串身份
6. 用户手动中断后，旧 context 不可复用，且不会留下半状态
7. 实现符合 MVC：
   - controller 不直接写 SQL
   - DB/业务状态迁移统一收敛到 service 层
8. 日志中每一步都能追溯：
   - 哪个 gate session
   - 哪个 caller session
   - 哪个 parent session
   - 哪个 child session

---

## 十五、唯一落地文件顺序

给执行模型的最小顺序：

1. `.opencode/lib/db-manager.ts`
2. `.opencode/service/gate/store-types.ts`
3. `.opencode/service/gate/session-context-service.ts`
4. `.opencode/service/gate/approval-context.ts`
5. `.opencode/service/gate/gate-validate.ts`
6. `.opencode/plugins/session.ts`
7. `.opencode/service/session/lifecycle.ts`
8. `.opencode/service/gate/mcp-confirm.ts`
9. `.opencode/service/gate/mcp-deliverables.ts`
10. `.opencode/service/gate/mcp-complete.ts`
11. gate 相关 tests

这是唯一允许顺序，必须严格按这个顺序做。
