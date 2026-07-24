---
name: task-dispatch-router
description: >-
  Use as the FIRST step before executing any non-trivial task. Evaluates task
  complexity across three dimensions (file scope & coupling, reasoning depth,
  spec determinism) and outputs a dispatch recommendation: SINGLE mode (do it
  yourself), SUBAGENT mode (dispatch one sub-agent with role + model), or
  MULTI-AGENT mode (dispatch multiple sub-agents in parallel). References
  dispatching-parallel-agents
  for parallel/sequential decisions — does not duplicate them. Trigger: any task
  that involves code changes, file edits, git commit, multi-step work, or
  uncertainty about whether to delegate. Also trigger: 提交文件, 修改代码, 实施计划,
  运行测试, 创建文件. Not for: pure conversation, single-file reads, or tasks where
  MODE is already obvious.
---

# Task Dispatch Router

## 阻断规则（优先于一切）

收到任何非纯对话任务时，**必须**先输出 Dispatch Assessment 再执行。不得以"任务很简单"、"直接做更快"、"我知道该怎么做"为由跳过评估。如果发现自己已经开始执行但未输出 Dispatch Assessment，**立即停止**，补输出评估后再继续。

## Language / 语言

Follow the user's language: reply in Chinese for Chinese requests and English for English requests. Provide both only when requested; preserve code, commands, paths, API names, identifiers, and quoted source text exactly.

## 目的

在任务执行前评估复杂度，输出结构化的派遣决策（MODE + 角色），然后交接给相应的执行 skill。本 skill 是前置路由器——只做决策，不做执行。

**核心原则**：不复制已有 skill 的功能。并行/串行决策引用 `dispatching-parallel-agents`；skill 选择引用 `pre-flight-enforcement` Phase -1。

## 适用范围

**触发的场景**：
- 任何涉及代码修改的任务
- 多步骤工作流
- 不确定是否应该委托给子 agent 的任务
- 用户要求多智能体模式时

**不触发的场景**：
- 纯对话、闲聊、简单事实查询
- 单步操作（读一个文件、运行一条命令）
- MODE 已经显而易见的任务
- 用户明确要求跳过评估

## 三阶段流程

```
Phase 1: 复杂度评估 [ANALYSIS]
  → 评估 3 个维度，每维度打 1-3 分
  → 输出 ComplexityProfile

Phase 2: 派遣决策 [ANALYSIS]
  → 用决策矩阵将 ComplexityProfile 映射到 MODE
  → 检查 AGENTS.md §12.3 禁止场景（5 条规则）
  → 检查 MULTI-AGENT 额外触发条件
  → 输出 DispatchRecommendation

Phase 3: 交接 [OBSERVATION]
  → SINGLE: 直接开始执行
  → SUBAGENT: 构造 dispatch prompt
  → MULTI-AGENT: 引用 dispatching-parallel-agents 确定并行策略
```

## Phase 1: 复杂度评估 [ANALYSIS]

评估以下 3 个维度，每维度打 1-3 分。

### 维度 1: 文件范围与耦合度 (File Scope & Coupling)

| 分数 | 标准 |
|:----:|------|
| 1 | 单文件或 2 个独立文件，无跨文件依赖 |
| 2 | 3-5 个文件，有跨文件引用但边界清晰 |
| 3 | 6+ 文件或强耦合共享状态，高频共享同一批文件 |

### 维度 2: 推理深度 (Reasoning Depth)

| 分数 | 标准 |
|:----:|------|
| 1 | 规格完整，实现是转录+测试（有 Fixed Contract / API 签名 / 完整 spec） |
| 2 | 需要模式匹配、多文件协调，但方向明确 |
| 3 | 需要设计判断、广泛代码理解、架构决策 |

### 维度 3: 规格确定性 (Spec Determinism)

| 分数 | 标准 |
|:----:|------|
| 1 | 有 plan / blueprint / Fixed Contract，API 签名固定 |
| 2 | 有需求描述但缺细节，需要自行推断部分实现 |
| 3 | 需求模糊，需要 brainstorm / 探索后才能定义 |

## Phase 2: 派遣决策 [ANALYSIS]

### 决策矩阵

将 3 维分数代入矩阵，得到初始 MODE 推荐：

| 文件耦合 | 推理深度 | 规格确定性 | MODE | 角色 |
|:-------:|:-------:|:---------:|:----:|------|
| 1 | 1 | 1 | SUBAGENT | Fullstack Engineer |
| 1 | 1 | 2-3 | SUBAGENT | Fullstack Engineer |
| 1 | 2 | 1 | SUBAGENT | Fullstack Engineer |
| 1 | 2 | 2-3 | SUBAGENT | Fullstack Engineer |
| 1 | 3 | * | SINGLE | — |
| 2 | 1 | 1 | SUBAGENT | Fullstack Engineer |
| 2 | 2 | 1 | SUBAGENT | Fullstack Engineer |
| 2 | 2 | 2-3 | SUBAGENT | Fullstack Engineer |
| 2 | 3 | * | SINGLE | — |
| 3 | * | * | SUBAGENT | Fullstack Engineer |

**矩阵设计原则**：
- 主 Agent 负责"脑力工作"（推理、评估、规划、审核），子 Agent 负责机械执行
- 推理深度 1-2 → 全部 SUBAGENT：主 agent 提供 plan/spec 后子 agent 可独立执行
- 推理深度 3（设计判断）→ 始终 SINGLE：设计判断不可委托，需要主 agent 的全局上下文
- 规格确定性 2-3 → 仍可 SUBAGENT：主 agent 补足 spec 上下文后子 agent 可执行
- 文件耦合 3 → SUBAGENT：多文件任务仍可委托
- 禁止场景（强顺序依赖、共享文件冲突）触发时强制 SINGLE（AGENTS.md §12.3）
- SUBAGENT 在「spec 确定 + 推理深度 ≤ 2 + 文件耦合 ≤ 2」时推荐

### 禁止场景检查（AGENTS.md §12.3 强制）

在输出 DispatchRecommendation 前，**必须**逐条检查以下 5 条规则。任一命中则强制 SINGLE：

1. **任务很小且需要判断** — 纯对话、回答问题、选择方案等需要主 agent 判断力的小任务 → SINGLE。机械执行类小任务（有明确指令、无需判断，如 typo 修复、git 提交）**不触发**此禁止，按矩阵推荐 SUBAGENT
2. **强顺序依赖** — 后一步必须等前一步完成，且无法并行 → SINGLE
3. **高频共享同一批文件** — 多个 agent 会同时修改相同文件 → SINGLE
4. **需要单一路径连续实现** — 实现路径不可拆分，需要同一上下文贯穿 → SINGLE
5. **需要统一最终裁决的单一结论** — 审计、架构决策等需要统一判断 → SINGLE

### MULTI-AGENT 额外触发条件

MULTI-AGENT 不在决策矩阵中，需要**额外检查**以下全部条件：

- ✅ 多个子任务低耦合（每个子任务可独立理解）
- ✅ 每个子任务可独立验收
- ✅ 并行执行能显著提升速度或质量
- ✅ 无共享文件冲突
- ✅ 矩阵推荐每个子任务单独为 SUBAGENT

全部满足时 → 引用 `dispatching-parallel-agents` 确定并行 vs 串行策略。

## Phase 3: 交接 [OBSERVATION]

根据 MODE 执行交接：

### SINGLE

直接开始执行。如果任务涉及已安装 skill 的工作流，引用 `pre-flight-enforcement` Phase -1 选 skill。

### SUBAGENT

1. **构造 dispatch prompt**（AGENTS.md §12.2 要求 5 要素）：
   - subtask goal: 子任务目标
   - scope boundary: 允许修改的文件/模块
   - expected deliverable: 预期交付物
   - required evidence: 必须提供的证据
   - completion condition: 完成条件

2. **派遣**：使用 Agent 工具，显式指定 `model` 和 `subagent_type`

### MULTI-AGENT

1. **确定并行策略**：引用 `dispatching-parallel-agents`：
   - 独立 + 可并行 → 在单条消息中发起多个 Agent 调用
   - 独立但不可并行 → 串行派遣
   - 不独立 → 退回 SINGLE

2. **派遣**：在单条消息中发起多个 Agent 调用实现并行

## 输出格式

评估完成后，**必须**输出以下结构：

```markdown
## Dispatch Assessment

**Complexity Profile**:
| Dimension | Score | Reason |
|-----------|:-----:|--------|
| File scope & coupling | 1/2/3 | <reason> |
| Reasoning depth | 1/2/3 | <reason> |
| Spec determinism | 1/2/3 | <reason> |

**Prohibited-dispatch check**: PASS / FAIL (<which rule triggered>)

**Dispatch Recommendation**:
- MODE: SINGLE / SUBAGENT / MULTI-AGENT
- Role: — / Fullstack Engineer / Testing Expert / Audit Expert
- Handoff: direct / SDD + Agent tool / dispatching-parallel-agents + SDD
```

## 合理化检测

> **合理化检测**：如果你发现自己想"这个任务很简单，不需要评估"——停下来，这是跳过评估的信号。即使是简单任务，也至少完成 Phase 1 的 3 维打分（可以快速），这样决策才有依据。

## 不覆盖已有功能的保证

| 已有 skill 的功能 | 本 skill 如何处理 |
|------------------|------------------|
| dispatching-parallel-agents 的并行/串行决策 | **引用**：输出 "handoff: dispatching-parallel-agents"，不复制决策图 |
| pre-flight-enforcement 的 skill 选择 | **不涉及**：本 skill 选 MODE/角色/模型，不选 skill |
| AGENTS.md §4.4/§12 的派遣规则 | **执行**：禁止场景检查直接引用 §12.3 的 5 条规则 |
| SDD 的 implementer→reviewer 循环 | **不涉及**：本 skill 只做前置决策，不参与执行循环 |

## 示例（简版）

完整示例见 `reference.md`。

**示例 A**: 单文件 typo 修复（机械执行，有明确指令）
- Coupling=1, Reasoning=1, Spec=1 → SUBAGENT

**示例 B**: 纯对话回答问题（小任务但需要判断）
- Coupling=1, Reasoning=1, Spec=2 → SINGLE（spec 不确定，需主 agent 判断）

**示例 C**: 5 文件 feature 实施（有 plan + Fixed Contract）
- Coupling=2, Reasoning=2, Spec=1 → SUBAGENT

**示例 D**: 3 个独立 bug 修复（不同文件，不同根因）
- 每个子任务: Coupling=1, Reasoning=1, Spec=1 → 各自 SUBAGENT
- MULTI-AGENT 检查: 低耦合 + 独立验收 + 并行提升 → MULTI-AGENT + 引用 dispatching-parallel-agents
