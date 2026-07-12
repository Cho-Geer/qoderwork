# Blueprint: Session Persist Fail A+C 实施方案

**执行需求唯一ID**: `plan-20260708-01`
**日期**: `2026-07-08`
**状态**: 待实施
**优先级**: `P0`
**适用仓库**: `/home/zhaoge/workspace/opencode/work-one`
**覆盖范围**:
- `A`：`compliance_gate_check` 创建 gate session 后持久化失败却仍返回成功
- `C`：Orchestrator / anti-bypass 在连续失败后未强制上报，继续消耗 token 自救

---

## 一、理解需求

本方案需要解决两个串联问题：

1. `A` 线：gate session 在 `check -> confirm` 之间丢失，导致 `session not found`。
2. `C` 线：当工具失败持续累积时，框架没有可靠地把 Orchestrator 强制切换到“先汇报、后等待指导”的模式。

目标不是只修单点报错，而是建立一条**可失败即停、可观测、可验证、可回滚**的持久化与上报闭环。

---

## 二、拆分需求

### 2.1 子任务清单

- 子任务 A1：把 gate session 保存失败从“静默降级”改成“显式失败”。
- 子任务 A2：为 gate store 持久化补充结构化错误返回与运行时诊断。
- 子任务 C1：把 `tool_enforcement` / anti-bypass 从“DB 异常时 fail-open”改成“至少 report-now fail-closed”。
- 子任务 C2：让 Orchestrator 在 child 失败或 gate 异常时，明确触发 `acp_notify` / `question` 汇报链。
- 子任务 C3：补齐测试与 live E2E 验收，确保不再出现“继续烧 token 自救”的行为。
- 子任务 D1：同步更新计划文档、操作说明、变更日志。

### 2.2 成功定义

- `compliance_gate_check` 只有在 gate session 真正保存成功时才返回 `passed + session_id`。
- `compliance_gate_confirm` 不再对“刚返回的 session_id”立即报 `session not found`。
- 当 DB/FS 异常导致 `tool_enforcement` 不可写时，system anti-bypass 仍能向模型注入“立即汇报”的强约束。
- Orchestrator 在连续失败、child 失败、或 gate 持久化失败时，不再无上报地继续多轮自救。

---

## 三、问题背景

### 3.1 问题描述

本轮 live LLM E2E 中，Orchestrator 先后出现以下行为：

- `compliance_gate_check` 返回 `passed: true` 和新的 `session_id`
- 紧接着 `compliance_gate_confirm` 返回 `session not found`
- 后续 `dispatch_subagent` 在写 `.task_temp/_dispatch` 时命中 `EROFS`
- Orchestrator 没有及时调用 `acp_notify` 或 `question` 向 QoderWork 汇报
- 模型继续尝试别的手段，消耗额外 token

### 3.2 已确认根因

**A 线直接原因**

- `checkGateCompliance()` 创建 `store.sessions[gateSessionId]` 后调用 `saveGateStore(store)`。
- `saveGateStore()` 失败只返回 `false`，调用方没有检查返回值，仍然返回成功的 `session_id`。
- `confirmGateSession()` 重新 `loadGateStore()` 后读不到该 session，于是报 `session not found`。

**A 线根本原因**

- gate 持久化 API 只暴露 `boolean`，错误语义过弱。
- `mcp-check` 的控制流把“持久化”视为旁路副作用，而不是“成功返回 session_id 的前置条件”。

**C 线直接原因**

- active system anti-bypass 依赖 `tool_enforcement` 的 DB 状态来决定是否注入 STOP / Phase1 指令。
- `recordAttempt()` / `recordBlock()` / `recordResult()` / `checkThreshold()` 在 DB 异常时会 catch 并退化成“不阻断 / 不注入”。
- 因此模型没有被强制切换到“先调用 question / acp_notify”。

**C 线根本原因**

- anti-bypass 目前把“DB 可用”当成了“强约束注入的前提”。
- 一旦状态持久化层失效，整个上报硬约束链会同步失效，形成 fail-open。

### 3.3 实测验证

- `findmnt -T /home/zhaoge/workspace/opencode/work-one/.task_temp/_dispatch` 已确认根挂载为 `ro`。
- `dispatch-subagent.ts` 已确认先写 `_dispatch` 文件，再创建 privilege grant。
- `mcp-check.ts` 已确认 `saveGateStore(store)` 后未校验返回值。
- `mcp-confirm.ts` 已确认重新加载 store 并直接读取 `store.sessions[gateSessionId]`。
- `tool-tracker.ts` 与 `system/anti-bypass.ts` 已确认 STOP 注入依赖 DB 状态。
- `Orchestrator.md` 已确认规则层要求连续失败后必须上报，但现场 transcript 中未见 `acp_notify` / `question` 调用。

**结论**

本轮并不是三个独立 bug，而是一个共同故障面：**持久化层失效时，A 线继续“假成功”，C 线继续“假自由”，最终让模型陷入无汇报的自救循环。**

---

## 四、解决方案

### 4.1 方案对比

| 维度 | 方案 A：最小修补 | 方案 B：推荐方案（Fail-Fast + Fail-Closed） | 方案 C：全量重构 |
| --- | --- | --- | --- |
| A 线处理 | 仅在 `mcp-check` 中检查 `saveGateStore()` 返回值 | 引入结构化保存结果；`mcp-check` fail-fast；补日志与错误分类 | 重写 gate store API 与调用链 |
| C 线处理 | 仅调整 prompt，提示模型多汇报 | 保留现有 DB 计数，但 DB 异常时注入本地 report-now 指令 | 完全重做 anti-bypass 状态机 |
| 实现复杂度 | 低 | 中 | 高 |
| 风险 | 低，但只能止血 A 线 | 中，能同时修 A 与 C | 高，回归面过大 |
| 对现有架构侵入 | 小 | 中等，可控 | 高 |
| 验证成本 | 低 | 中 | 高 |
| 是否推荐 | 否 | 是 | 否 |

### 4.2 选择结论

采用**方案 B：Fail-Fast + Fail-Closed 组合修复**。

原因：

- 只修 A 不修 C，会继续出现“虽然不再给假 session_id，但模型仍可能在其它失败点无上报自救”。
- 直接全量重构 anti-bypass 成本过高，不适合当前 P0 止血。
- 方案 B 能在当前架构上最小化改动，快速建立“存不进去就别返回成功、计不到数也必须先上报”的双保险。

### 4.3 否决理由

- 否决方案 A：只能修 `session not found`，不能解决未汇报和 token 浪费。
- 否决方案 C：改动面过大，风险超过当前问题窗口，且会拖慢验证闭环。

---

## 五、核心设计

### 5.1 总体设计原则

- gate session 的“创建成功”定义必须包含“持久化成功”。
- anti-bypass 的“上报强约束”不能完全依赖 DB。
- error path 必须结构化，禁止只有 `boolean` / `false` 这类弱语义返回。
- prompt 指令与运行时 enforcement 都要覆盖，避免单点失效。

### 5.2 A 线设计：gate 保存 Fail-Fast

#### 5.2.1 设计目标

- `saveGateStore()` 失败时，调用方可以拿到明确原因。
- `checkGateCompliance()` 在 gate session 未持久化时不得返回 `passed + session_id`。

#### 5.2.2 推荐改动

将 `saveGateStore()` 从：

```ts
export function saveGateStore(store: GateStore, root?: string): boolean
```

改为更强语义的结果对象，例如：

```ts
export interface GateStoreSaveResult {
  ok: boolean;
  storage: "db";
  error_code?: "DB_SAVE_FAILED" | "DB_EXCEPTION";
  error_message?: string;
}
```

新行为：

- `store-crud.ts`
  - `saveGateStore()` 返回 `GateStoreSaveResult`
  - `writeLogSafe()` 记录结构化事件，包含 `error_code`
- `db-state-manager.ts`
  - `dbSaveGateStore()` 增加可选的错误细节返回
  - 至少要把 `e.message` 回传到上层，而不是只在本层吞掉
- `mcp-check.ts`
  - 调用 `saveGateStore()` 后立即检查 `ok`
  - 若失败，返回：
    - `passed: false`
    - `session_id: ""`
    - `failed_items` 增加 `gate_store_persist_failed`
    - `reason` 进入日志与 MCP 输出

#### 5.2.3 行为示意

```ts
const saveResult = saveGateStore(store);
if (!saveResult.ok) {
  writeLog(SRC, "ERROR", {
    event: "GATE-CHECK-PERSIST-FAILED",
    errorCode: saveResult.error_code,
    detail: saveResult.error_message,
    gateSessionId,
  });

  return {
    passed: false,
    session_id: "",
    enforcement_mode: GATE_POLICY_COMPAT,
    failed_items: [
      ...failed,
      {
        id: "gate_store_persist_failed",
        desc: `Gate session persistence failed: ${saveResult.error_message || saveResult.error_code || "unknown"}`,
        severity: "HIGH",
      },
    ],
    rule_status: ruleStatus,
  };
}
```

#### 5.2.4 附加诊断增强

- 在 `mcp-confirm.ts` 中，如果 `session not found`，额外记录：
  - `gateSessionId`
  - 最近一次 save 失败摘要
  - 当前 store session 数量
- 这样即使 A 线再次回归，也能快速区分“真的没 check”与“check 假成功”。

### 5.3 C 线设计：anti-bypass 上报 Fail-Closed

#### 5.3.1 设计目标

- 当 `tool_enforcement` 可写时，继续沿用现有阈值机制。
- 当 `tool_enforcement` 不可写或 `checkThreshold()` 异常时，system anti-bypass 仍要向模型注入“立即汇报”的强指令。

#### 5.3.2 推荐改动

在 `plugin-handlers/system/anti-bypass.ts` 增加“本地兜底注入”：

- 对 `checkThreshold(sessionId)` 外层结果做判定
- 如果发现：
  - `checkThreshold()` 返回异常态
  - 或 `getGuidanceStatus()` 抛错
  - 或检测到最近工具失败，但 enforcement 无法读取
- 则直接注入 fallback directive：
  - 明确禁止继续重试
  - 明确要求先 `acp_notify`
  - 若失败，再 `question`

建议新增 helper：

```ts
function buildPersistenceFailureDirective(reason: string): string
```

内容类似：

```text
[CRITICAL][FW-ENFORCE][PERSISTENCE-FAILURE]
Framework persistence/enforcement state is unavailable.
Do NOT retry tools.
Call acp_notify(event_type="task_blocked") immediately.
If acp_notify fails or returns unresolved, call question immediately.
Do not continue autonomous recovery.
```

#### 5.3.3 tool-tracker 改动

`tool-tracker.ts` 不建议直接改成处处 throw，因为会影响现有调用面；推荐：

- 保持现有返回结构
- 但在 catch 时返回显式异常态，例如：

```ts
type ThresholdCheck = {
  shouldInject: boolean;
  directive: string;
  count: number;
  tracker_error?: boolean;
  tracker_error_message?: string;
}
```

`recordAttempt()` / `recordBlock()` / `recordResult()` 的 catch 也应写入统一错误事件，并把异常状态暴露给上游调用点，而不是纯静默。

#### 5.3.4 Orchestrator 结果门增强

在 Orchestrator 规则和相关 dispatch/child 结果解析路径中，加一个明确约束：

- 当 child 返回包含：
  - `session not found`
  - `PERSISTENCE-FAILURE`
  - `DB_SAVE`
  - `EROFS`
  - `failed`
  - `blocked`
- Orchestrator 必须：
  1. `acp_notify(event_type="task_failed" 或 "task_blocked")`
  2. 若 `acp_notify` 不可用，则立刻 `question`
  3. 不得继续发起下一轮“自救型”工具调用

这部分主要通过两处落实：

- `.opencode/agents/Orchestrator.md`：更新规则文字
- 相关 runtime 结果门逻辑：如果已有结果解析器，则增加关键词分类；如果暂无集中结果门，则在 dispatch / completion 路径先做最小化字符串 gate

### 5.4 C 线补充：prompt 层同步修复

为了减少模型在 enforcement 生效前的自由发挥，还需要同步更新 prompt / 规则文案：

- `.opencode/agents/Orchestrator.md`
  - 明确 `session not found` 与 `EROFS` 属于不可自愈类错误
  - 明确禁止“同类失败连续重试超过 1 次”
- 如当前存在 dispatch skill / preflight skill 对阻断恢复有指导，也同步补一句：
  - “持久化或文件系统异常优先上报，不做多轮自救”

---

## 六、子系统合规审计

| # | 子系统 | 状态 | 说明 |
| --- | --- | --- | --- |
| 1 | MVC Architecture | ✅ | 变更集中在 service / plugin / agent prompt，分层清晰 |
| 2 | DB-only & DB-canonical | ✅ | 不新增 JSON 双写，反而进一步强化 DB 成功语义 |
| 3 | Permission Matrix | ✅ | 不新增 agent 权限，仅强化现有 `acp_notify` / `question` 使用约束 |
| 4 | Concurrency Safe | ⚠️ | A 线仍需确认 `saveGateStore()` 结果对象不会引入额外竞态 |
| 5 | Hardened Enforcement | ✅ | C 线核心就是增强 enforcement 在持久化异常下的 fail-closed |
| 6 | Framework Harness | ✅ | 可通过现有 serve API / self-test / targeted tests 验证 |
| 7 | Central State Management | ✅ | 不新增分散状态，仍以 DB 和统一日志为中心 |
| 8 | Multi-Agent | ✅ | 直接改善 Orchestrator 与 child 失败传播 |
| 9 | Log Central Management | ✅ | 所有新增诊断统一走 `writeLog` |
| 10 | DB-canonical Management | ✅ | 仅增强 DB 错误语义，无需新增表即可落首版 |
| 11 | Templatization & Parameterization | ✅ | directive 文案可封装 helper，避免散落硬编码 |
| 12 | TypeScript + Bun Runtime | ✅ | 改动集中、依赖不新增、兼容现有 Bun 运行时 |

---

## 七、实施清单

### 7.1 文件变更列表

| 序号 | 文件 | 变更类型 | 说明 |
| --- | --- | --- | --- |
| 1 | `/home/zhaoge/workspace/opencode/work-one/.opencode/service/gate/store-crud.ts` | 修改 | `saveGateStore()` 返回结构化结果 |
| 2 | `/home/zhaoge/workspace/opencode/work-one/.opencode/lib/db-state-manager.ts` | 修改 | `dbSaveGateStore()` 透出错误细节 |
| 3 | `/home/zhaoge/workspace/opencode/work-one/.opencode/service/gate/mcp-check.ts` | 修改 | gate session 保存失败 fail-fast |
| 4 | `/home/zhaoge/workspace/opencode/work-one/.opencode/service/gate/mcp-confirm.ts` | 修改 | `session not found` 诊断增强 |
| 5 | `/home/zhaoge/workspace/opencode/work-one/.opencode/service/enforcement/tool-tracker.ts` | 修改 | threshold / record* 返回显式 tracker_error 状态 |
| 6 | `/home/zhaoge/workspace/opencode/work-one/.opencode/plugin-handlers/system/anti-bypass.ts` | 修改 | tracker 异常时 fallback directive fail-closed |
| 7 | `/home/zhaoge/workspace/opencode/work-one/.opencode/agents/Orchestrator.md` | 修改 | 明确 persistence/EROFS 类错误必须优先上报 |
| 8 | `/home/zhaoge/workspace/opencode/work-one/.opencode/scripts/__tests__/...` 或邻近测试目录 | 新增/修改 | A/C 相关单测与集成测试 |
| 9 | `/home/zhaoge/workspace/qoderwork/logs/2026-07-08-*.md` | 新增 | 记录为什么做、改了什么、为何这么做 |
| 10 | `/home/zhaoge/workspace/qoderwork/plans/session-persist-fail/` 下文档 | 新增/更新 | 保存本实施方案与后续验收记录 |

### 7.2 分阶段实施步骤

#### Phase 0：预检与复现实验（0.5 天）

1. `git diff --stat` 审计当前未提交改动，避免覆盖用户工作。
2. `codegraph status`，确认索引最新。
3. 用 `codegraph query` / `impact` 复核以下符号：
   - `saveGateStore`
   - `checkGateCompliance`
   - `confirmGateSession`
   - `checkThreshold`
   - `recordAttempt`
4. 记录当前 live 故障基线：
   - `session not found`
   - `EROFS`
   - 无 `acp_notify/question`

#### Phase 1：A 线 Fail-Fast（0.5 天）

1. 修改 `store-crud.ts` 与 `db-state-manager.ts`，提供结构化 save 结果。
2. 修改 `mcp-check.ts`，把持久化失败纳入返回结果。
3. 修改 `mcp-confirm.ts`，补诊断日志。
4. 补 A 线单元测试。

#### Phase 2：C 线 Fail-Closed（0.5 天）

1. 修改 `tool-tracker.ts`，增加 `tracker_error` 可观测状态。
2. 修改 `system/anti-bypass.ts`，在 tracker 异常时注入 fallback directive。
3. 修改 `Orchestrator.md`，明确禁止 persistence/EROFS 类错误多轮自救。
4. 若存在集中结果门逻辑，补字符串 gate。

#### Phase 3：测试与回归（0.5 天）

1. 跑单元测试。
2. 跑集成测试。
3. 用 TestContainers 跑持久化异常场景。
4. 重启 serve，跑 live E2E。

#### Phase 4：文档与日志收口（0.25 天）

1. 写 `logs/` 变更记录。
2. 更新相关 blueprint / 验收文档。
3. 记录已验证结论与残余风险。

---

## 八、验证计划

### 8.1 单元测试

- [ ] `saveGateStore()` 在 DB 写入异常时返回 `ok=false + error_code`
- [ ] `checkGateCompliance()` 在 `saveGateStore().ok=false` 时返回 `passed=false`
- [ ] `confirmGateSession()` 在 session 缺失时输出增强诊断
- [ ] `checkThreshold()` 在 tracker DB 异常时返回 `tracker_error=true`
- [ ] `anti-bypass` 在 `tracker_error=true` 时注入 fallback directive

### 8.2 集成测试

- [ ] 模拟 `dbSaveGateStore()` 失败后，`compliance_gate_check` 不再返回假 `session_id`
- [ ] 模拟 `tool_enforcement` 写入失败后，system transform 仍注入“立即汇报”指令
- [ ] Orchestrator 结果门遇到 `session not found` 时，停止继续派发/重试
- [ ] Orchestrator 结果门遇到 `EROFS` 时，优先进入上报路径

### 8.3 TestContainers 集成测试

说明：按你的要求，集成测试明确使用 TestContainers。

- [ ] 使用 TestContainers 启动隔离 SQLite/FS 测试容器，模拟 gate save 异常，验证 A 线 fail-fast
- [ ] 使用 TestContainers 启动只读挂载或受限卷场景，验证 `_dispatch` 写失败时 C 线 fallback directive 生效
- [ ] 使用 TestContainers 复现 `tool_enforcement` 不可写场景，验证模型侧收到 report-now 指令而非继续自救

### 8.4 端到端测试

- [ ] serve 重启后，从 Orchestrator 入口复现原 prompt
- [ ] 当 gate 持久化失败时，assistant 输出必须明确说明 blocked/failed，不得继续工具调用
- [ ] 当 `_dispatch` 命中 `EROFS` 时，assistant 必须优先 `acp_notify/question`
- [ ] transcript 中出现上报动作，且不再出现无上报的多轮自救

### 8.5 文档一致性验证

- [ ] `Orchestrator.md` 规则与实际 runtime 行为一致
- [ ] blueprint、logs、验收文档与代码实现一致
- [ ] 不再保留“gate save 失败仍可继续”的过时描述

---

## 九、风险与缓解

### 9.1 风险表

| 风险 | 影响 | 缓解措施 |
| --- | --- | --- |
| `saveGateStore()` 返回类型变化影响调用面 | 编译失败或漏改 | 先用 CodeGraph 全量查调用点，逐个改完再跑 TS 检查 |
| tracker fail-closed 过严 | 可能让部分本可恢复场景提前中断 | fallback directive 只覆盖 persistence/tracker 异常，不覆盖普通工具失败 |
| prompt 文案与 runtime 逻辑不一致 | 模型执行混乱 | 文案改动与 live E2E 绑定验收 |
| TestContainers 场景构造复杂 | 集成测试开发成本上升 | 第一版优先覆盖只读卷与 DB open/write fail 两个关键场景 |

### 9.2 回滚方案

如果实施后出现误阻断或大面积行为回归，按以下顺序回滚：

1. 回滚 `system/anti-bypass.ts` 的 fallback directive 注入逻辑。
2. 保留 A 线 fail-fast，不回滚 `mcp-check` 的保存失败保护。
3. 若 `saveGateStore()` 返回类型改动影响面过大，可临时保留兼容包装：
   - 新增 `saveGateStoreDetailed()`
   - 原 `saveGateStore()` 继续返回 `boolean`
4. 重新跑 serve API 基线，确认系统恢复到变更前行为。

---

## 十、成功标准

- [ ] A 线不再出现“刚返回 session_id，confirm 立即 session not found”
- [ ] C 线在 tracker/DB 异常时仍能强制模型优先上报
- [ ] Orchestrator 不再在 persistence/EROFS 类错误上多轮自救
- [ ] TestContainers 集成测试通过
- [ ] live E2E transcript 中可见 `acp_notify` 或 `question` 上报动作
- [ ] 所有新增/修改文档与代码行为一致

---

## 十一、执行说明

### 11.1 本次文档产出

- 本文档路径：
  - `/home/zhaoge/workspace/qoderwork/plans/session-persist-fail/blueprint-session-persist-fail-A-C.md`

### 11.2 修改的代码路径

- 本次仅生成实施方案，未修改 `work-one` 代码。

### 11.3 后续建议执行顺序

建议下一轮直接按以下顺序实施：

1. 先做 `A` 线 fail-fast
2. 再做 `C` 线 fail-closed
3. 再补 TestContainers 集成测试
4. 最后跑 serve live E2E 验收

这样可以先消灭“假成功”，再消灭“无上报自救”，回归分析最清晰。
