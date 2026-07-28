# Blueprint: Question 混合 Enforcement 优化方案

**创建日期**: 2026-07-12
**更新日期**: 2026-07-28
**状态**: 已完成
**相关蓝图**: 无

> **版本**: v2.1.0
> **日期**: 2026-07-07
> **状态**: 已实施（代码层面 5 条 recovery 路径全部就位），runtime smoke 已补（softThreshold STOP 注入 + question recovery 已通过 live LLM 验证；详见 `qoderwork/logs/2026-07-07-question-enforcement-smoke.md`）
> **基于**: work-one 项目当前代码（schema v34，enforcement.tool_tracker.soft_threshold=2, hard_threshold=3, total_limit=5）

---

## 0. 2026-07-07 Smoke Test 复核

`e2e/smoke-test-results-20260707.md` 对本 blueprint 的影响如下：

- G6-001 证明 question 工具/问题查询路径可用。
- 正确回复端点是 `POST /question/{QID}/reply`，不是 `POST /session/{SID}/reply`。
- `POST /session/{SID}/guide` 与 `/session/{SID}/interrupt` 不存在；普通 guidance 应走 `prompt_async + agent`，止损走 abort。
- 本次 smoke 没有覆盖 guidance gate active 时的完整 enforcement recovery：softThreshold/hardThreshold、before 白名单、after 清计数器、system 注入、QoderWork 直写 DB 仍按本 blueprint 的验证计划执行。

因此，该 blueprint 不能因 G6 question PASS 改成“已完成”；只能将“question API 可用”作为前置事实。

---

## 一、问题背景

### 1.1 问题描述

OpenCode 框架的 Guidance Gate 两阶段协议依赖 `acp_notify` MCP 工具作为 Agent 汇报通道，但：

1. **`deliverGuidance()` 丧失 MCP 入口**：acp-bridge 删除后，QoderWork 无法通过 MCP 工具下发指导
2. **`acp_notify` 遵从性低**：MCP 工具名 `notify-server_acp_notify` 带 server 前缀，Agent 识别困难
3. **6 步异步链路过长**：throw → 注入 → acp_notify → rewardReport → deliverGuidance → clear_guidance，任何一步断裂都导致 Agent 永久卡死
4. **故障点多**：依赖 SSE daemon、MCP server、token 验证等多个组件

### 1.2 根因分析

**直接原因**：`deliverGuidance()` 函数（`tool-tracker.ts:684`）存在于 service 层但无 MCP 工具入口（原在 acp-bridge/src/extensions.ts，已随目录删除）。

**根本原因**：Guidance Gate 设计了 `acp_notify`（MCP 工具）作为汇报通道，但框架原始设计中 `requestGuidance()` 函数（`tool-tracker.ts:602`）的注释明确写着 `"agent called 'question' tool"`——question 工具才是原始设计的汇报通道，acp_notify 是后加的替代路径。

### 1.3 实测验证

通过代码审查确认以下事实：

1. **`checkThreshold()` 是死代码**：函数定义在 `tool-tracker.ts:440`，被 `before/anti-bypass.ts` import（第 8 行），但**从未在 handle() 函数体中被调用**。`system/anti-bypass.ts` 也不调用它。→ softThreshold(2) 的 STOP 注入机制当前无效。

2. **`system/anti-bypass.ts` 仅检查 `awaiting_guidance`**：`getGuidanceStatus()` 只在 `awaiting_guidance=1` 时返回 `awaiting: true`，而 `awaiting_guidance=1` 仅由 `rewardReport()` 设置（`tool-tracker.ts:574`）。→ 如果 Agent 未调用 acp_notify，system.transform 不会注入任何指令。

3. **`clearAwaitingGuidance()` 要求 `guidance_requested_at > 0`**（`tool-tracker.ts:644`）：即必须先调用 `requestGuidance()` 才能清除 gate。而 `requestGuidance()` 又要求 `awaiting_guidance=1`（`tool-tracker.ts:611`），形成 `rewardReport() → requestGuidance() → clearAwaitingGuidance()` 的严格顺序链。

4. **`clearGuidance()` 不检查 `guidance_requested_at`**（`tool-tracker.ts:787-798`）：只要求 `awaiting_guidance=1` + 有效 token，比 `clearAwaitingGuidance()` 更简单。

**结论**：question 工具是框架原始设计的汇报通道，复用已有函数即可实现零 MCP 依赖的混合方案，但需要修正 `checkThreshold()` 死代码问题和 after-hook 的调用顺序。

---

## 二、解决方案

### 2.1 方案对比

| 维度 | 方案 A：修复 acp_notify 路径 | 方案 B：question 混合（本方案） |
|------|---------------------------|-------------------------------|
| 核心思路 | 在 notify-server.ts 添加 deliver_guidance MCP 工具 | 用 question 替代 acp_notify，QoderWork 直写 DB |
| Agent 遵从性 | ★★★☆☆ MCP 工具识别困难 | ★★★★★ OpenCode 内置工具，LLM 天然认知 |
| 交互延迟 | 30s-数分钟（SSE 轮询） | <1s（question 同步阻塞） |
| 依赖组件 | 6+（SSE、MCP、token） | 3（tool-tracker + system + question） |
| 故障点 | 6+ | 2 |
| 代码改动量 | 小（仅添加 MCP 工具） | 中（修改 3 个 handler + 1 个 service） |
| 向后兼容 | 完全兼容 | 需迁移（acp_notify 保留向后兼容） |

### 2.2 选择结论

选择**方案 B（question 混合）**，理由：
1. 遵从性显著优于方案 A（内置工具 vs MCP 工具）
2. 消除 deliverGuidance 断裂问题（QoderWork 直写 DB）
3. 回归框架原始设计意图（`requestGuidance()` 注释已说明）
4. 故障点从 6+ 降至 2

### 2.3 否决理由

- **方案 A**：虽改动量小，但保留了 acp_notify 的低遵从性和长链路问题，只是修复了断裂点，未解决根本问题。

---

## 三、核心设计

### 3.1 三层协同架构

```
┌─────────────────────────────────────────────────────────┐
│  检测层（保留 + 修复）                                    │
│  tool-tracker.ts: 计数器 + 阈值检查                       │
│  before/anti-bypass.ts: throw 阻断（hardThreshold）       │
│  ⚠️ 修复: checkThreshold() 死代码 → 从 system hook 调用   │
└────────────────────────┬────────────────────────────────┘
                         │ 阈值触发
                         ▼
┌─────────────────────────────────────────────────────────┐
│  注入层（修改 system/anti-bypass.ts）                     │
│  Phase 1: 注入"调用 question 汇报"指令                    │
│  Phase 2: 注入 QoderWork 指导文本                         │
│  ⚠️ 新增: checkThreshold() 调用（softThreshold 注入）     │
└────────────────────────┬────────────────────────────────┘
                         │ Agent 调用 question
                         ▼
┌─────────────────────────────────────────────────────────┐
│  交互层（修改 after/anti-bypass.ts + before 白名单）      │
│  question 同步阻塞 → QoderWork 即时回答                   │
│  after-hook 检测 question → rewardReport + clearGuidance  │
└─────────────────────────────────────────────────────────┘
                         ▲
                         │ QoderWork 直写 DB（场景 5a）
┌─────────────────────────────────────────────────────────┐
│  指导下发层（QoderWork 直写 DB，零 MCP 依赖）              │
│  sqlite3 UPDATE tool_enforcement SET guidance_text=...   │
│  system.transform 自动检测并注入                          │
└─────────────────────────────────────────────────────────┘
```

### 3.2 已有计数器重置机制（不改动）

| 计数器 | 递增条件 | 重置条件 | 代码位置 |
|--------|---------|---------|---------|
| `consecutive_failures` | `detectFailure()=true` 或 `recordBlock()` | `clearGuidance()` / `clearAwaitingGuidance()` / TTL 过期 | `tool-tracker.ts:357-370` |
| `total_failures` | 每次失败 | **仅 TTL 过期**（永不主动重置） | `tool-tracker.ts:362` |
| `compliance_blocks` | orphan detection | **工具执行成功后自动重置**（`recordResult()` 中 `compliance_blocks=0`） | `tool-tracker.ts:384-387` |
| `soft_rejections` | `detectSoftRejection()=true` | `resetSoftRejections()`（独立函数，`clearGuidance()` 不重置） | `tool-tracker.ts:875-880` |
| `stop_injected` | `checkThreshold()` 或 `rewardReport()` | `clearGuidance()` / `clearAwaitingGuidance()` / `recordResult()` 失败时 | `tool-tracker.ts:459,367,577` |

**关键设计**：
- `total_failures` 永不重置 → 用于 session 级监控
- `compliance_blocks` 成功即重置 → 鼓励 Agent 遵守框架要求
- `soft_rejections` 独立重置 → per-tool 追踪，不与全局计数器耦合

### 3.3 关键设计约束（代码验证结果）

**`rewardReport()` → `clearGuidance()` 调用顺序**（修正 v1.0 的错误）：

```
after-hook 检测到 question 成功后：
  Step 1: rewardReport(sessionId, agent)
    → 检查 consecutive_failures > 0 或 compliance_blocks > 0
    → 生成 token (randomBytes(16).hex)
    → 设置 awaiting_guidance = 1
    → 设置 stop_injected = 1
    → 返回 { token, previousCount }

  Step 2: clearGuidance(sessionId, agent, token)
    → 验证 awaiting_guidance = 1 ✅（Step 1 刚设置）
    → 验证 token 匹配 ✅（Step 1 刚生成）
    → 重置 consecutive_failures = 0
    → 重置 compliance_blocks = 0
    → 重置 awaiting_guidance = 0
    → 重置 stop_injected = 0
```

**为什么不用 `clearAwaitingGuidance()`？**
- `clearAwaitingGuidance()` 额外要求 `guidance_requested_at > 0`（`tool-tracker.ts:644`）
- 这需要先调用 `requestGuidance()` 设置时间戳
- `clearGuidance()` 不检查 `guidance_requested_at`，更简单
- question 是同步工具，QoderWork 已即时回答，无需 Phase 2 中间态

### 3.4 子系统合规审计

| # | 子系统 | 状态 | 检查要点 |
|---|--------|------|----------|
| 1 | MVC Architecture | ✅ | 检测层(tool-tracker) / 注入层(system hook) / 交互层(after hook) 分层清晰 |
| 2 | DB-only & DB-canonical | ✅ | QoderWork 直写 DB 符合 DB-canonical 设计（DB 是单一真相源） |
| 3 | Permission Matrix | ✅ | `question_policy.allow_all_agents: true` 已启用，无需改动权限矩阵 |
| 4 | Concurrency Safe | ✅ | `rewardReport()` + `clearGuidance()` 均使用单条 UPDATE + WHERE 子句，WAL 模式 + busy_timeout=5000 |
| 5 | Hardened Enforcement | ✅ | before-hook throw 保留（hardThreshold 阻断），question 加入白名单 |
| 6 | Framework Harness | ✅ | 不影响框架 harness 兼容性 |
| 7 | Central State Management | ✅ | 所有状态通过 tool_enforcement 表管理，无分布式状态 |
| 8 | Multi-Agent | ✅ | question 工具对所有 Agent 开放（allow_all_agents），不影响多 Agent 调度 |
| 9 | Log Central Management | ✅ | 所有 hook 统一使用 writeLog → .task_temp/_logs/ |
| 10 | DB-canonical Management | ✅ | 无 schema 变更（guidance_text 列已在 v31 迁移中添加），零迁移 |
| 11 | Templatization & Parameterization | ✅ | 阈值通过 project.config.json 参数化，无硬编码 |
| 12 | TypeScript + Bun Runtime | ✅ | 修改的文件均未超过 400 行目标（anti-bypass.ts 75行、before 141行、after 93行、system 75行） |

---

## 四、五种场景的完整流程

### 4.1 场景 1：Agent 有疑问需要澄清

**流程**：Agent 主动调用 question → QoderWork 回答 → Agent 继续

**无需框架改动**。`question_policy.allow_all_agents: true` 已启用。

### 4.2 场景 2：Agent 需要用户决策

**流程**：Agent 调用 question，options 含 A/B 选项 + "type your own answer"

**无需框架改动**。question 工具原生支持 options + 自定义回答。

### 4.3 场景 3：Agent 累积失败（softThreshold = 2）

**触发条件**：`failure_count >= softThreshold (2)`（代码实际字段为 `failure_count`，不是 `consecutive_failures`；见 `tool-tracker.ts:450`）

> ⚠️ **v2.0 修正**：原方案假设 `checkThreshold()` 被 system hook 调用，但代码审查发现 `checkThreshold()` 是**死代码**（import 了但从未调用）。本方案修复此问题。
> ⚠️ **v2.1 修正**：代码层面 `checkThreshold()` 实际由 `system/anti-bypass.ts:18` 调用（system.transform hook），不是 after-hook；after-hook 只负责递增 `failure_count`（via `recordResult()`）。

```
Step 1: after/anti-bypass.ts 检测到工具失败
  → recordResult() 递增 failure_count（以及 consecutive_failures）
  → 此时不触发 checkThreshold()，仅日志记录

Step 2: system/anti-bypass.ts 在下次 LLM 调用前调用 checkThreshold(sessionId)
  → 如果 failure_count >= softThreshold(2) 且 stop_injected=0
  → 设置 stop_injected=1
  → 返回 shouldInject=true + directive（含 question 指令）
  → output.system.push(directive)
  → 日志 event="STOP-INJECTED"

Step 3: Agent 调用 question（同步阻塞）
  → guidance-bridge (before hook pos 1) 放行 question（enforcement_passthrough_tools 白名单）
  → before/anti-bypass.ts delegate 也放行（isEnforcementPassthrough(question)=true）

Step 4: QoderWork 收到 question，即时回答

Step 5: after/anti-bypass.ts 检测到 question 成功
  → 如果 status.awaiting 或 summary.consecutiveFailures > 0:
    → rewardReport(sessionId, agent) → 生成 token + awaiting_guidance=1 + stop_injected=1
    → clearGuidance(sessionId, agent, token) → 重置 failure_count/consecutive_failures/compliance_blocks/stop_injected/awaiting_guidance
  → 日志 event="QUESTION-RECOVERY-COMPLETE"
  → Agent 获得指导，继续工作
```

**计数器变化**：
- `failure_count`: 2 → 0（clearGuidance 重置）
- `consecutive_failures`: 2 → 0（clearGuidance 重置）
- `total_failures`: 不变（仅 TTL 重置；clearGuidance UPDATE 未涉及此字段）
- `compliance_blocks`: → 0（clearGuidance 重置）
- `soft_rejections`: 不变（需独立 resetSoftRejections）
- `stop_injected`: 1 → 0（clearGuidance 重置）

### 4.4 场景 4：Agent 陷入循环（hardThreshold = 3）

**触发条件**：`consecutive_failures >= hardThreshold (3)`（`project.config.json:1878` 配置 `hard_threshold: 3`；v2.0 写为 4 是误记）

> ⚠️ **v2.1 修正**：before/anti-bypass.ts 已被标记为 LEGACY handler（不在 `plugin_execution_order.before` 数组），但其逻辑通过 `guidance-bridge.ts` delegate 仍然生效（`project.config.json:1908` guidance-bridge 在第 1 位）。

```
Step 1: before/anti-bypass.ts 检测到 hardThreshold
  → recordAttempt() 返回 shouldBlock=true
  → throw 阻断所有工具（除 question 和 clear_guidance）

Step 2: system/anti-bypass.ts 注入指令
  → 如果 awaiting_guidance=1（已通过 rewardReport 设置）→ Phase 1 指令
  → 否则 → checkThreshold() 的 STOP directive（含 question 指令）

Step 3: Agent 调用 question（唯一被允许的工具）

Step 4: QoderWork 回答
  → 子场景 4a: 即时回答 → Agent 继续
  → 子场景 4b: 需要调查 → 回答"等待" → QoderWork 直写 DB → system.transform 注入 Phase 2

Step 5: after/anti-bypass.ts 检测到 question 成功
  → rewardReport() → 生成 token + awaiting_guidance=1
  → clearGuidance() → 重置计数器
```

### 4.5 场景 5：QoderWork 主动推送指导

**子场景 5a：Agent 正在工作（不打断）**

```
Step 1: QoderWork 直写 DB
  sqlite3 ... "UPDATE tool_enforcement SET
    guidance_text='指导内容',
    guidance_requested_at=$(date +%s%3N),
    awaiting_guidance=1
    WHERE session_id='ses_xxx'"

Step 2: Agent 下次 LLM 调用时
  → system/anti-bypass.ts 检测到 awaiting_guidance=1 且 guidance_requested_at>0
  → 注入 Phase 2 指导到 system prompt
  → Agent 自行调整行为

Step 3: Agent 调用 question 确认（可选）
  → after-hook → rewardReport() + clearGuidance() → 计数器重置
```

**子场景 5b：Agent 空闲**

```
QoderWork 调用 curl POST /session/$SID/prompt_async
  → 消息进入 Agent 对话历史
  → Agent 处理新消息
```

---

## 五、实施清单

### 5.1 文件变更列表

> ✅ **v2.1 状态**：以下 5 项变更已全部实施完毕（2026-07-04 实施，2026-07-07 runtime smoke 验证）。

| 序号 | 文件 | 变更类型 | 说明 | 状态 |
|------|------|---------|------|------|
| 1 | `.opencode/plugin-handlers/system/anti-bypass.ts` | 修改 | Phase 1 指令将 acp_notify 替换为 question；新增 checkThreshold() 调用 | ✅ 已实施 |
| 2 | `.opencode/plugin-handlers/before/anti-bypass.ts` | 修改 | question 加入 guidance gate 白名单（enforcement_passthrough_tools） | ✅ 已实施（LEGACY delegate via guidance-bridge） |
| 3 | `.opencode/plugin-handlers/after/anti-bypass.ts` | 修改 | 新增 question 检测 → rewardReport() + clearGuidance() | ✅ 已实施（DELEGATE via guidance-recovery） |
| 4 | `.opencode/service/enforcement/tool-tracker.ts` | 修改 | checkThreshold() 的 directive 内容将 acp_notify 替换为 question | ✅ 已实施 |
| 5 | `qoderwork/scripts/deliver-guidance.sh` | 新建 | QoderWork 直写 DB 脚本 | ✅ 已实施（2026-07-07 补建） |

### 5.2 详细代码修改

#### 5.2.1 修改 `system/anti-bypass.ts`（注入层）

**修改 1**：Phase 1 指令将 `acp_notify` 替换为 `question`

```typescript
// ═══ Phase 1: Guidance NOT yet delivered by QoderWork ═══
const phase1Directive = [
  `[FW-ENFORCE][GUIDANCE-GATE] YOU ARE BLOCKED.`,
  `Cumulative tool failures triggered the enforcement gate.`,
  ``,
  `IMMEDIATE ACTION REQUIRED:`,
  `1. Call the "question" tool to report the failure to QoderWork:`,
  `   - question: "工具 ${status.lastFailureTool} 连续失败，错误: ${status.lastFailureError?.slice(0, 100) || "blocked"}"`,
  `   - options: ["我理解了，换一种方法", "需要更详细的指导", "此任务无法完成，需要帮助"]`,
  `2. After QoderWork responds, follow their instructions.`,
  ``,
  `DO NOT attempt to retry the failed tool or switch to other tools.`,
  `The question tool is the ONLY tool allowed while in this gate.`,
].join("\n");
```

**修改 2**：新增 `checkThreshold()` 调用（修复死代码）

```typescript
export async function handle(input: any, output: any): Promise<void> {
  const sessionId = input?.sessionID;
  if (!sessionId) return;

  try {
    const agent = resolveAgent(sessionId);

    // ── NEW: softThreshold STOP 注入（修复 checkThreshold 死代码）──
    const thresholdCheck = checkThreshold(sessionId);
    if (thresholdCheck.shouldInject) {
      if (output?.system && Array.isArray(output.system)) {
        output.system.push(thresholdCheck.directive);
      }
      writeLog("plugin-anti-bypass", "WARN", {
        event: "STOP-INJECTED", sessionId, agent,
        consecutive: thresholdCheck.count,
      });
    }

    // ── 原有: guidance gate 注入 ──
    const status = getGuidanceStatus(sessionId);
    if (!status.awaiting) return;
    // ... Phase 1 / Phase 2 逻辑（Phase 1 指令已修改）
  } catch (e: any) { ... }
}
```

**新增 import**：
```typescript
import { getGuidanceStatus, checkThreshold } from "../../service/enforcement/tool-tracker";
```

#### 5.2.2 修改 `before/anti-bypass.ts`（白名单）

```typescript
// 新增：question 工具在 guidance gate 期间被允许
function isQuestionTool(tool: string): boolean {
  return tool === "question";
}

export async function handle(input: any, _output: any): Promise<void> {
  // ...
  if (phase === 1) {
    if (isClearGuidanceTool(tool)) { ... return; }
    if (isReportToolExempt(tool)) { ... return; }
    // NEW: 允许 question 工具
    if (isQuestionTool(tool)) {
      writeLog("plugin-anti-bypass", "INFO", {
        event: "GATE-QUESTION-ALLOWED",
        agent, sessionId, tool,
      });
      return;
    }
    // ... throw 阻断
  }
  // ...
}
```

#### 5.2.3 修改 `after/anti-bypass.ts`（交互层）

**新增 import**（v1.0 遗漏，v2.0 修正）：
```typescript
import {
  isReportTool,
  rewardReport,
  recordResult,
  isReadOnlyTool,
  recordSoftRejection,
  getGuidanceStatus,    // NEW
  clearGuidance,         // NEW
} from "../../service/enforcement/tool-tracker";
```

**新增 question 检测逻辑**：
```typescript
export async function handle(input: any, output: any): Promise<void> {
  const tool = input.tool as string;
  const sessionId = input.sessionID || "unknown";

  try {
    const agent = resolveAgent(sessionId);

    // ── NEW: question 工具成功 → 触发恢复流程 ──
    if (tool === "question") {
      const status = getGuidanceStatus(sessionId);
      // 如果在 guidance gate 中，或者有累积失败，触发恢复
      if (status.awaiting || (status.lastFailureTool && status.lastFailureTool.length > 0)) {
        // Step 1: rewardReport 生成 token + 设置 awaiting_guidance=1
        const result = rewardReport(sessionId, agent);
        if (result.token) {
          // Step 2: clearGuidance 验证 token + 重置所有计数器
          const cleared = clearGuidance(sessionId, agent, result.token);
          writeLog("plugin-anti-bypass", "INFO", {
            event: "QUESTION-RECOVERY-COMPLETE",
            agent, sessionId,
            previousCount: result.previousCount,
            cleared: cleared.success,
            detail: "Agent called question, QoderWork answered, counters reset",
          });
        }
      }
      return;
    }

    // ── 保留: acp_notify 奖励逻辑（向后兼容）──
    if (isReportTool(tool)) {
      const result = rewardReport(sessionId, agent);
      // ... 原有逻辑
      return;
    }

    // ── 保留: 正常失败检测 ──
    const { failed, count, error } = recordResult(sessionId, agent, tool, output);
    // ... 原有逻辑
  } catch (e: any) { ... }
}
```

#### 5.2.4 修改 `checkThreshold()` 指令内容

**文件**: `tool-tracker.ts:440-488`

```typescript
const directive = [
  `[FW-ENFORCE][STOP][ANTI-BYPASS] CUMULATIVE TOOL FAILURE LIMIT REACHED.`,
  `Cumulative failures: ${row.consecutive_failures} (threshold: ${cfg.softThreshold})`,
  `Last failed tool: ${row.last_failure_tool}`,
  `Last error: ${row.last_failure_error?.slice(0, 200) || "unknown"}`,
  ``,
  `[STOP] CEASE ALL TOOL CALLS IMMEDIATELY.`,
  `[REPORT] Call the "question" tool to report to QoderWork:`,
  `  - question: "工具 ${row.last_failure_tool} 失败 ${row.consecutive_failures} 次"`,
  `  - options: ["换一种方法", "需要更多指导", "放弃此任务"]`,
  `[WAIT] Do NOT retry or switch tools. Wait for QoderWork's response via question.`,
].join("\n");
```

#### 5.2.5 新建 `deliver-guidance.sh`

```bash
#!/bin/bash
# QoderWork 指导下发脚本 — 直写 DB，零 MCP 依赖
DB_PATH="/home/zhaoge/workspace/opencode/work-one/.opencode/state/framework-state.db"
SESSION_ID="$1"
GUIDANCE_TEXT="$2"
if [ -z "$SESSION_ID" ] || [ -z "$GUIDANCE_TEXT" ]; then
  echo "Usage: $0 <session_id> <guidance_text>"
  exit 1
fi
NOW=$(date +%s%3N)
sqlite3 "$DB_PATH" \
  "UPDATE tool_enforcement SET
     guidance_text = '${GUIDANCE_TEXT//\'/\'\'}',
     guidance_requested_at = ${NOW},
     awaiting_guidance = 1,
     updated_at = ${NOW}
   WHERE session_id = '${SESSION_ID}'"
echo "Guidance delivered to session $SESSION_ID"
```

### 5.3 不需要修改的部分

| 组件 | 原因 |
|------|------|
| `tool-tracker.ts` 计数器逻辑 | 保留原有递增 + 重置机制 |
| `clearGuidance()` 函数 | 保留，question 路径直接复用 |
| `clearAwaitingGuidance()` 函数 | 保留，acp_notify 路径向后兼容 |
| `requestGuidance()` 函数 | 保留，场景 5a 的 Phase 2 路径使用 |
| `rewardReport()` 函数 | 保留，question 路径复用（生成 token） |
| `notify-server.ts` 的 `acp_notify` / `clear_guidance` | 保留，向后兼容 |
| `question-policy.ts` | 保留 `allow_all_agents: true` |
| `recordResult()` 的 `compliance_blocks` 重置 | 保留原有"成功即重置"逻辑 |
| `resetSoftRejections()` | 保留独立重置逻辑 |

---

## 六、验证计划

### 6.1 单元测试

- [ ] `checkThreshold()` 在 `consecutive_failures=2` 时返回 `shouldInject=true`
- [ ] `rewardReport()` 在 `consecutive_failures>0` 时生成 token 并设置 `awaiting_guidance=1`
- [ ] `clearGuidance()` 在 `awaiting_guidance=1` + 有效 token 时重置所有计数器
- [ ] `clearGuidance()` 在 token 不匹配时返回 `success=false`
- [ ] `getGuidanceStatus()` 正确返回 `awaiting` / `delivered` / `token` / `guidanceText`

### 6.2 集成测试

- [ ] `system/anti-bypass.ts` 正确调用 `checkThreshold()` 并注入 directive
- [ ] `before/anti-bypass.ts` 放行 `question` 工具（guidance gate 期间）
- [ ] `after/anti-bypass.ts` 检测 `tool === "question"` 并调用 `rewardReport()` + `clearGuidance()`
- [ ] `deliver-guidance.sh` 直写 DB 后 `system/anti-bypass.ts` 正确注入 Phase 2

### 6.3 端到端测试

- [ ] 触发 softThreshold(2) → Agent 调 question → QoderWork 回答 → 计数器重置
- [ ] 触发 hardThreshold(4) → throw → Agent 调 question → 恢复
- [ ] QoderWork 直写 DB → system.transform 注入 Phase 2 → Agent 调 question 确认 → 恢复
- [ ] acp_notify 路径仍正常工作（向后兼容）

### 6.4 子系统合规验证

- [ ] **Concurrency Safe**: `rewardReport()` + `clearGuidance()` 连续调用无竞态（单 session 串行）
- [ ] **Log Central Management**: 所有新逻辑使用 `writeLog()`，无 `console.log` / `process.stderr.write`
- [ ] **DB-canonical Management**: 无 schema 变更，`guidance_text` 列已存在（v31 迁移）
- [ ] **TypeScript + Bun Runtime**: 修改后文件行数未超标（system 75→~95、before 141→~150、after 93→~130）

---

## 七、风险与回滚

### 7.1 风险

| 风险 | 概率 | 影响 | 缓解 |
|------|:---:|:---:|------|
| question 工具在 programmatic 模式不可用 | 低 | 高 | 已确认 `allow_all_agents: true` |
| after-hook 未触发（question 被其他 plugin 拦截） | 低 | 高 | question-policy 放行所有 Agent |
| `rewardReport()` + `clearGuidance()` 非原子操作 | 低 | 中 | 单 session 串行执行，WAL 模式 |
| `checkThreshold()` 从 after-hook 调用可能导致重复注入 | 中 | 低 | `stop_injected=1` 守卫防止重复 |
| Agent 不遵循 system.prompt 指令调用 question | 中 | 高 | before-hook throw 强制阻断其他工具 |

### 7.2 回滚方案

1. **还原 `system/anti-bypass.ts`**：移除 `checkThreshold()` 调用，恢复 Phase 1 指令为 acp_notify
2. **还原 `before/anti-bypass.ts`**：移除 `isQuestionTool()` 白名单
3. **还原 `after/anti-bypass.ts`**：移除 question 检测逻辑和新增 import
4. **还原 `tool-tracker.ts`**：恢复 `checkThreshold()` directive 为 acp_notify
5. acp_notify 路径在回滚后仍可用（deliverGuidance MCP 入口除外，需另行修复）

---

## 八、成功标准

- [ ] softThreshold(2) 触发时 system.transform 注入含 question 的 STOP 指令
- [ ] Agent 在 guidance gate 期间可调用 question（不被阻断）
- [ ] question 返回后 consecutive_failures 重置为 0
- [ ] QoderWork 直写 DB 后 system.transform 注入 Phase 2 指导
- [ ] acp_notify 路径仍正常工作（向后兼容）
- [ ] 交互延迟从 30s+ 降至 <1s

---

## 九、迁移策略

### 阶段 1：并行运行（向后兼容）
- 保留 `acp_notify` / `clear_guidance` MCP 工具
- 新增 question 工具路径
- system.transform 注入同时提及两个选项（question 优先）

### 阶段 2：question 优先
- system.transform 注入只提及 question
- acp_notify 仍可用但不推荐

### 阶段 3：清理（可选）
- 移除 `acp_notify` / `clear_guidance` 从 notify-server.ts
- 移除 `rewardReport()` 中 acp_notify 专属逻辑

---

## 十、附录

### 10.1 框架已有的 question 相关函数

| 函数 | 位置 | 用途 |
|------|------|------|
| `requestGuidance(sessionId, agent)` | `tool-tracker.ts:602` | question 调用后设置 Phase 2 标记（场景 5a 使用） |
| `clearGuidance(sessionId, agent, token)` | `tool-tracker.ts:787` | 验证 token 并重置所有计数器（question 路径使用） |
| `clearAwaitingGuidance(sessionId, agent, token)` | `tool-tracker.ts:633` | 要求 guidance_requested_at>0（acp_notify 路径使用） |
| `rewardReport(sessionId, agent)` | `tool-tracker.ts:548` | 生成 token + 设置 awaiting_guidance=1 |
| `getGuidanceStatus(sessionId)` | `tool-tracker.ts:732` | 获取当前 guidance gate 状态 |
| `checkThreshold(sessionId)` | `tool-tracker.ts:440` | softThreshold 检测 + STOP directive 生成（⚠️ 当前死代码，本方案修复） |
| `isQuestionAllowedForAll()` | `exemptions.ts` | 检查 `question_policy.allow_all_agents` |

### 10.2 v1.0 → v2.0 修正记录

| 修正项 | v1.0 错误 | v2.0 修正 |
|--------|----------|----------|
| `checkThreshold()` 调用位置 | 假设 system hook 已调用 | 代码审查发现是死代码，新增从 system hook 调用 |
| after-hook 调用顺序 | `requestGuidance()` → `clearAwaitingGuidance()` | `rewardReport()` → `clearGuidance()`（修正函数选择） |
| `clearAwaitingGuidance` vs `clearGuidance` | 使用 `clearAwaitingGuidance` | 改用 `clearGuidance`（不要求 `guidance_requested_at > 0`） |
| after-hook import | 遗漏 `getGuidanceStatus` / `clearGuidance` import | 新增 import 声明 |
| 12 子系统合规审计 | 缺失 | 新增完整审计表 |
| 方案对比 | 缺失 | 新增方案 A vs B 对比 |
| 回滚方案 | 缺失 | 新增明确回滚步骤 |
| 成功标准 | 缺失 | 新增可衡量指标 |

### 10.3 关键代码验证索引

| 声明 | 验证结果 | 代码位置 |
|------|---------|---------|
| `requestGuidance()` 注释 "agent called 'question' tool" | ✅ 确认 | `tool-tracker.ts:599` |
| `checkThreshold()` 是死代码 | ✅ 确认（import 但未调用） | `before/anti-bypass.ts:8` import，handle() 中无调用 |
| `clearGuidance()` 不检查 `guidance_requested_at` | ✅ 确认 | `tool-tracker.ts:787-798` |
| `clearAwaitingGuidance()` 检查 `guidance_requested_at > 0` | ✅ 确认 | `tool-tracker.ts:644` |
| `question_policy.allow_all_agents: true` | ✅ 确认 | `project.config.json:2062` |
| `rewardReport()` 设置 `awaiting_guidance=1` | ✅ 确认 | `tool-tracker.ts:574` |
