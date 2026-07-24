# task-dispatch-router — Reference

本文件提供完整决策树、禁止场景判定标准、示例和边界说明。主流程见 `SKILL.md`。

## 1. 完整决策树（27 种组合）

以下覆盖 3×3×3 = 27 种 ComplexityProfile 组合的推荐结果。

图例：C=文件耦合, R=推理深度, S=规格确定性

| C | R | S | MODE | 角色 | 模型 tier | 原因 |
|:-:|:-:|:-:|:----:|------|----------|------|
| 1 | 1 | 1 | SUBAGENT | Fullstack | cheap | 机械执行，主 agent token 贵，委托 cheap |
| 1 | 1 | 2 | SINGLE | — | — | spec 不完整，主 agent 补全更快 |
| 1 | 1 | 3 | SINGLE | — | — | 需求模糊，需要主 agent 判断 |
| 1 | 2 | 1 | SUBAGENT | Fullstack | cheap | spec 确定 + 中等推理 → 可委托 |
| 1 | 2 | 2 | SINGLE | — | — | spec 不完整 + 中等推理 → 主 agent 更稳 |
| 1 | 2 | 3 | SINGLE | — | — | 需求模糊 + 中等推理 → 主 agent 判断 |
| 1 | 3 | 1 | SINGLE | — | — | 设计判断不可委托 |
| 1 | 3 | 2 | SINGLE | — | — | 设计判断不可委托 |
| 1 | 3 | 3 | SINGLE | — | — | 设计判断不可委托 |
| 2 | 1 | 1 | SUBAGENT | Fullstack | cheap | spec 确定 + 机械实现 → 可委托 |
| 2 | 1 | 2 | SINGLE | — | — | spec 不完整 + 多文件 → 主 agent 补全 |
| 2 | 1 | 3 | SINGLE | — | — | 需求模糊 + 多文件 → 主 agent 判断 |
| 2 | 2 | 1 | SUBAGENT | Fullstack | standard | spec 确定 + 中等推理 + 多文件 → 可委托 |
| 2 | 2 | 2 | SINGLE | — | — | spec 不完整 + 中等推理 + 多文件 → 主 agent 更稳 |
| 2 | 2 | 3 | SINGLE | — | — | 需求模糊 + 中等推理 + 多文件 → 主 agent 判断 |
| 2 | 3 | 1 | SINGLE | — | — | 设计判断不可委托 |
| 2 | 3 | 2 | SINGLE | — | — | 设计判断不可委托 |
| 2 | 3 | 3 | SINGLE | — | — | 设计判断不可委托 |
| 3 | 1 | 1 | SINGLE | — | — | 高频共享文件，§12.3 禁止 |
| 3 | 1 | 2 | SINGLE | — | — | 高频共享文件，§12.3 禁止 |
| 3 | 1 | 3 | SINGLE | — | — | 高频共享文件，§12.3 禁止 |
| 3 | 2 | 1 | SINGLE | — | — | 高频共享文件，§12.3 禁止 |
| 3 | 2 | 2 | SINGLE | — | — | 高频共享文件，§12.3 禁止 |
| 3 | 2 | 3 | SINGLE | — | — | 高频共享文件，§12.3 禁止 |
| 3 | 3 | 1 | SINGLE | — | — | 高频共享文件，§12.3 禁止 |
| 3 | 3 | 2 | SINGLE | — | — | 高频共享文件，§12.3 禁止 |
| 3 | 3 | 3 | SINGLE | — | — | 高频共享文件，§12.3 禁止 |

**统计**：27 种组合中，SINGLE 22 种，SUBAGENT 5 种，MULTI-AGENT 0 种（需额外检查）。

**SUBAGENT 触发条件总结**：S = 1 AND R ≤ 2 AND C ≤ 2。即「spec 确定 + 推理深度不高 + 文件耦合不高」时推荐委托。机械执行类任务（R=1, S=1）也委托给 cheap 子 agent 以节省主 agent token。

## 2. 禁止场景判定标准（AGENTS.md §12.3）

### 2.1 "任务很小且需要判断"

§12.3 禁止的是"任务很小 **且需要判断**"。机械执行类小任务（有明确指令、无需判断）不触发此禁止。

| 判定为"很小且不可委托"（需判断） | 判定为"很小但可委托"（机械执行） |
|--------------------------------|-------------------------------|
| 纯对话回答问题 | typo / 命名修复（有明确指令） |
| 选择 A 方案还是 B 方案 | 单行变更（有明确位置和内容） |
| 审计结论判断 | 改一个配置值（有明确值） |
| 评估风险或影响面 | git 提交（有明确的文件和 message） |
| 需要理解上下文才能决定怎么改 | 格式化 / lint 修复（有明确规则） |

**规则**：如果任务可以在不阅读超过 2 个文件的情况下完成：
- **且无需判断**（有明确指令，执行即可）→ 判定为"很小但可委托"，按矩阵推荐 SUBAGENT + cheap
- **但需要判断**（需要理解、选择、评估）→ 判定为"很小且不可委托"，强制 SINGLE

### 2.2 "强顺序依赖"

| 判定为"强顺序依赖" | 不算 |
|-------------------|------|
| B 步必须等 A 步的输出才能开始 | A 和 B 可以独立完成 |
| 修改 → 测试 → 修复必须在同一上下文 | 3 个独立 bug 修复 |
| 前一步的错误会传播到后续步骤 | 不同模块的独立改进 |

**规则**：如果移除顺序约束后任务无法完成或会产生错误结果，判定为"强顺序依赖"。

### 2.3 "高频共享同一批文件"

| 判定为"高频共享" | 不算 |
|----------------|------|
| 多个 agent 都需要修改 `types.ts` | 每个 agent 修改不同的独立文件 |
| 多个 agent 需要修改同一个测试文件 | 每个 agent 有自己的测试文件 |
| 修改 → 验证 → 修复循环涉及同一文件 | 读取是共享的，写入是独立的 |

**规则**：如果有 2+ 个子任务需要**写入**同一文件，判定为"高频共享"。

### 2.4 "需要单一路径连续实现"

| 判定为"单一路径" | 不算 |
|----------------|------|
| 实现一个完整的 class，方法间有状态依赖 | 实现多个独立的 utility 函数 |
| 一个算法的多个步骤 | 多个独立的算法 |
| 一个 API 的 handler → service → dao 链 | 多个独立的 API endpoint |

**规则**：如果任务拆分后各部分无法独立验收，判定为"单一路径"。

### 2.5 "需要统一最终裁决的单一结论"

| 判定为"统一裁决" | 不算 |
|----------------|------|
| 架构决策（选 A 方案还是 B 方案） | 实现已确定的方案 |
| 审计结论（PASS/FAIL/REWORK） | 独立的代码审查（各自出报告） |
| 安全评估 | 独立的测试执行 |

**规则**：如果任务最终需要一个统一的判断而非多个独立结果，判定为"统一裁决"。

## 3. 完整示例

### 示例 1: 单文件 typo 修复（机械执行）

**任务**：修复 `scripts/task-lens/types.ts` 中一个类型名的拼写错误，用户明确指出了错误位置和正确拼写。

**Phase 1 评估**：
- File scope & coupling: **1** — 单文件，无跨文件依赖
- Reasoning depth: **1** — 规格完整（就是改一个词）
- Spec determinism: **1** — 用户明确指出了错误

**Phase 2 决策**：
- 矩阵：C=1, R=1, S=1 → SUBAGENT + cheap
- 禁止检查：§12.3.1 "任务很小且需要判断" → 不命中（机械执行，无需判断）
- MULTI-AGENT 检查：不满足（单任务）

**输出**：
```markdown
## Dispatch Assessment

**Complexity Profile**:
| Dimension | Score | Reason |
|-----------|:-----:|--------|
| File scope & coupling | 1 | 单文件 typo 修复 |
| Reasoning depth | 1 | 直接替换，无需推理 |
| Spec determinism | 1 | 用户明确指定位置和正确拼写 |

**Prohibited-dispatch check**: PASS (机械执行类小任务，不触发 §12.3.1)

**Dispatch Recommendation**:
- MODE: SUBAGENT
- Role: Fullstack Engineer
- Model tier: cheap (per SDD: 1-2 files with complete spec, transcription+testing)
- Handoff: SDD + Agent tool (model=haiku)
```

### 示例 2: 5 文件 feature 实施（有 plan + Fixed Contract）

**任务**：按已批准的 plan 实施 PHASE-03，涉及 7 个新文件，有 Fixed Contract 定义 API 签名和测试矩阵。

**Phase 1 评估**：
- File scope & coupling: **2** — 7 个文件但都是新建，边界清晰，无跨文件修改
- Reasoning depth: **2** — 需要理解类型契约、实现逻辑、写测试，但方向明确
- Spec determinism: **1** — 有 plan + Fixed Contract + Check Registry

**Phase 2 决策**：
- 矩阵：C=2, R=2, S=1 → SUBAGENT + Fullstack Engineer + standard
- 禁止检查：全部 PASS
- MULTI-AGENT 检查：不满足（单一连续实现路径）

**输出**：
```markdown
## Dispatch Assessment

**Complexity Profile**:
| Dimension | Score | Reason |
|-----------|:-----:|--------|
| File scope & coupling | 2 | 7 个新文件，边界清晰，无跨文件修改 |
| Reasoning depth | 2 | 需理解类型契约+实现+测试，方向明确 |
| Spec determinism | 1 | 有 plan + Fixed Contract + Check Registry |

**Prohibited-dispatch check**: PASS

**Dispatch Recommendation**:
- MODE: SUBAGENT
- Role: Fullstack Engineer
- Model tier: standard (per SDD Model Selection: multi-file with integration concerns)
- Handoff: SDD + Agent tool (model=sonnet)
```

### 示例 3: 3 个独立 bug 修复

**任务**：3 个不同模块的测试失败，根因不同，文件不重叠。

**Phase 1 评估**（每个子任务）：
- Bug A (auth 模块): C=1, R=1, S=1 → SUBAGENT candidate
- Bug B (payment 模块): C=1, R=1, S=1 → SUBAGENT candidate
- Bug C (logging 模块): C=1, R=1, S=1 → SUBAGENT candidate

**Phase 2 决策**：
- 矩阵：每个子任务 → SUBAGENT
- 禁止检查：每个子任务 PASS
- MULTI-AGENT 检查：
  - ✅ 低耦合（不同模块，不同根因）
  - ✅ 可独立验收（每个模块测试独立 PASS）
  - ✅ 并行显著提升速度（3x）
  - ✅ 无共享文件冲突
  - ✅ 每个子任务矩阵推荐 SUBAGENT

**输出**：
```markdown
## Dispatch Assessment

**Complexity Profile** (per subtask):
| Dimension | Score | Reason |
|-----------|:-----:|--------|
| File scope & coupling | 1 | 每个子任务单模块，无跨模块依赖 |
| Reasoning depth | 1 | 测试失败定位+修复，spec 由测试定义 |
| Spec determinism | 1 | 测试即 spec |

**Prohibited-dispatch check**: PASS (each subtask)

**Dispatch Recommendation**:
- MODE: MULTI-AGENT
- Role: Fullstack Engineer (per subtask)
- Model tier: cheap (per SDD: 1-2 files with complete spec)
- Handoff: dispatching-parallel-agents + SDD (3 parallel Agent calls, model=haiku)
```

### 示例 4: 纯对话回答问题（小任务但需要判断）

**任务**：用户问"我们的 CodeGraph 索引用的是哪个版本？"

**Phase 1 评估**：
- File scope & coupling: **1** — 可能需要读 1 个文件确认
- Reasoning depth: **1** — 查找事实，无需复杂推理
- Spec determinism: **2** — 用户给了问题但答案需要从代码/配置中查找和判断

**Phase 2 决策**：
- 矩阵：C=1, R=1, S=2 → SINGLE
- 禁止检查：§12.3.1 "任务很小且需要判断" → 命中（需要判断查找哪个文件、如何解读），强制 SINGLE

**输出**：
```markdown
## Dispatch Assessment

**Complexity Profile**:
| Dimension | Score | Reason |
|-----------|:-----:|--------|
| File scope & coupling | 1 | 可能读 1 个配置文件 |
| Reasoning depth | 1 | 事实查找 |
| Spec determinism | 2 | 需自行判断查找哪个文件和如何解读 |

**Prohibited-dispatch check**: FAIL (§12.3.1 任务很小且需要判断)

**Dispatch Recommendation**:
- MODE: SINGLE
- Role: —
- Model tier: —
- Handoff: direct
```

## 4. 边界说明：与其他 skill 的关系

### 4.1 与 subagent-driven-development (SDD) 的边界

| 问题 | 由谁回答 |
|------|---------|
| 这个任务要不要派子 agent？ | **task-dispatch-router**（Phase 2 决策矩阵） |
| 派什么模型？ | **SDD Model Selection**（task-dispatch-router 引用其 tier，SDD 给出具体模型名） |
| implementer → reviewer 循环怎么跑？ | **SDD**（task-dispatch-router 不涉及执行循环） |
| 子 agent BLOCKED 后怎么升级模型？ | **SDD Handling Implementer Status**（task-dispatch-router 只做前置决策） |

**交接点**：task-dispatch-router 输出 "model tier: standard (per SDD)"，然后由 SDD 的 Model Selection 规则将 tier 映射到具体模型（如 sonnet）。

### 4.2 与 dispatching-parallel-agents 的边界

| 问题 | 由谁回答 |
|------|---------|
| 多个子任务能不能并行？ | **task-dispatch-router**（MULTI-AGENT 额外检查） |
| 并行还是串行？ | **dispatching-parallel-agents**（独立→并行，共享状态→串行） |
| 怎么构造并行 agent prompt？ | **dispatching-parallel-agents**（Agent Prompt Structure） |

**交接点**：task-dispatch-router 输出 "handoff: dispatching-parallel-agents"，然后由该 skill 确定并行/串行策略和 prompt 构造。

### 4.3 与 pre-flight-enforcement 的边界

| 问题 | 由谁回答 |
|------|---------|
| 这个任务用 SINGLE 还是 SUBAGENT？ | **task-dispatch-router** |
| 这个任务用哪个 skill？ | **pre-flight-enforcement Phase -1**（skill 选择） |
| 执行步骤顺序怎么约束？ | **pre-flight-enforcement**（pre-flight checklist） |

**交接点**：task-dispatch-router 先决定 MODE，然后如果任务涉及已安装 skill，pre-flight-enforcement Phase -1 决定用哪个 skill。两者可以串联：先 task-dispatch-router → 再 pre-flight-enforcement。

### 4.4 串联使用示例

```
用户: "实施 PHASE-03"
  ↓
task-dispatch-router: C=2, R=2, S=1 → SUBAGENT + standard + SDD
  ↓
pre-flight-enforcement Phase -1: 选 opencode-framework-dev skill
  ↓
pre-flight-enforcement Phase 0: pre-flight checklist
  ↓
SDD: 派遣 implementer (model=sonnet) → reviewer → final review
```
