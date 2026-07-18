---
name: pre-flight-enforcement
description: "强制在执行 skill 引导任务前输出 pre-flight checklist，声明适用 skill 和步骤顺序；执行后输出 audit 报告。v2.2 新增步骤类型标注（ANALYSIS/VERIFICATION/OBSERVATION）、ANALYSIS→VERIFICATION 间隙自检、Audit 合理化模式检测。Enforce pre-flight checklist before skill-guided tasks, output audit report after. Trigger: pre-flight, 执行前检查, skill 遵循, audit, 合规审计, checklist. Not for: 纯对话, 简单查询, 无需特定 skill 的通用任务."
version: 2.2.0
---

# Pre-Flight Enforcement

## Language / 语言

Follow the user's language: reply in Chinese for Chinese requests and English for English requests. Provide both only when requested; preserve code, commands, paths, API names, identifiers, and quoted source text exactly.

## 目的

解决 agent 读了 skill 但不遵循规定流程的问题。通过在执行前强制输出 pre-flight checklist、在执行后强制输出 audit 报告，创建可追溯的执行承诺，确保 skill 规定的步骤顺序被严格遵守。

**v2.0 新增**：在 pre-flight 之前增加 Skill 发现与选择阶段，解决"用户指定的 skill 与任务本质不匹配"或"需要约束 skill + 执行 skill 组合使用"的场景。

## 适用范围

**需要触发的场景：**
- 任务明确涉及某个已安装 skill 的工作流（如 ACP 监控、文档生成、PDF 处理等）
- 用户要求按特定流程或步骤执行任务
- 任务包含多个有序步骤且存在已知的易跳步风险
- 用户指定的 skill 可能不是最佳匹配，需要校验（v2.0 新增）

**豁免场景（无需输出 pre-flight）：**
- 纯对话、闲聊、简单事实查询
- 单步操作（如读一个文件、运行一条命令）
- 用户明确要求跳过 pre-flight
- 任务不涉及任何已安装 skill 的通用编程/文件操作

## 四阶段流程

```
Phase -1: Skill 发现与选择（v2.0 新增）
  → 任务意图分析 → 可用 skill 扫描 → 最佳匹配选择 → 用户意图校验

Phase 0: Pre-Flight Check
  → 区分约束 skill + 执行 skill → 声明步骤顺序 → 承诺

Phase 1: 执行
  → 按执行 skill 的流程操作 → 约束 skill 确保不跳步

Phase 2: Post-Execution Audit
  → Skill 选择评估 + 遵循情况 + 改进建议
```

---

## Phase -1: Skill 发现与选择（v2.0 新增）

在输出 pre-flight checklist 前，必须先完成 skill 选择。

### Step 1: 任务意图分析

用一句话描述任务本质（不是用户字面指令）。

**示例**：
- 用户说："用 pre-flight-enforcement 审核 blueprint"
- 任务本质："审核 blueprint 文档与代码的一致性"

### Step 2: 可用 skill 扫描

从已安装 skill 中识别匹配的候选，按匹配度排序。

**扫描方法**：
1. 提取任务关键词（如"审核"、"blueprint"、"文档"）
2. 遍历已安装 skill 的 description 字段
3. 匹配 description 中的 Trigger 词和用途描述

### Step 3: 最佳匹配选择

选择最匹配的 skill，如有多个可组合使用。

**skill 角色分类**：

| 角色 | 用途 | 示例 |
|------|------|------|
| **约束 skill** | 约束执行流程（不跳步、不调序） | pre-flight-enforcement |
| **执行 skill** | 提供具体执行方法 | opencode-blueprint-audit, serve-api |
| **标准来源 skill** | 提供标准模板用于对比 | blueprint-creation |

**选择规则**：
1. 优先选择"执行 skill"（提供具体方法的）
2. 如任务需要流程约束，组合使用"约束 skill + 执行 skill"
3. 如需要标准对比，组合使用"执行 skill + 标准来源 skill"

### Step 4: 用户意图校验

如果用户指定的 skill 与最佳匹配不同，按以下流程处理：

| 情况 | 处理方式 |
|------|---------|
| 用户指定的 skill 是约束层，任务需要执行层 | 建议组合使用（如 pre-flight + blueprint-audit） |
| 用户指定的 skill 是执行层但不匹配 | 建议替换为更匹配的 skill |
| 用户指定的 skill 完全不相关 | 说明不匹配原因，建议正确 skill |
| 用户坚持原选择 | 按用户选择执行，但在 audit 中记录 |

**校验输出格式**：

```markdown
## Skill 选择校验

**任务本质**: [一句话描述]

**候选 skill**:
| 候选 skill | 角色 | 匹配度 | 理由 |
|-----------|------|:---:|------|
| skill-a | 执行 | ★★★★★ | [任务本质完全匹配] |
| skill-b | 约束 | ★★★☆☆ | [可组合使用提供流程约束] |

**选择结论**: [约束 skill] + [执行 skill]（组合使用）
```

---

## Phase 0: Pre-Flight Check

在执行任何适用任务前，**必须先输出以下 checklist**：

```markdown
## Skill Pre-Flight Check

**约束 skill**: [pre-flight-enforcement，流程约束]
**执行 skill**: [实际执行任务的 skill，可多个]

**执行 skill 的规定流程**:
1. [执行 skill 的步骤 1]
2. [执行 skill 的步骤 2]
3. [执行 skill 的步骤 3]
...

**执行计划**:
- [ ] Skill 选择校验: 确认选定的执行 skill 是最佳匹配
- [ ] [ANALYSIS] 步骤 1: [分析/阅读/理解类操作]
- [ ] [VERIFICATION] 步骤 2: [验证/触发/测试类操作 — 必须产生运行态证据]
- [ ] [OBSERVATION] 步骤 3: [观察/检查/确认类操作]
...

**步骤类型规则**:
- `[ANALYSIS]`: 源码分析、文档阅读、代码理解。**仅产生理解，不产生运行态证据。**
- `[VERIFICATION]`: 真实触发、API 调用、命令执行。**必须产生可引用的运行态证据。**
- `[OBSERVATION]`: 检查日志、查看结果、确认输出。**基于 VERIFICATION 的证据做判断。**

**承诺**: 严格按上述顺序执行，不跳步、不调序。如需偏差，在 audit 中说明原因。
```

---

## 执行约束

1. **顺序锁定**: pre-flight 输出后，必须按声明的步骤顺序执行，不得调换
2. **不跳步**: 每个声明的步骤都必须执行，即使看似冗余
3. **偏差记录**: 如果执行中遇到无法完成的步骤，记录原因并继续后续步骤，在 audit 中说明
4. **多 skill 场景**: 如果任务涉及多个 skill，在 pre-flight 中全部列出，按逻辑顺序整合步骤
5. **Skill 角色明确**（v2.0 新增）: 约束 skill 和执行 skill 必须在 pre-flight 中明确区分
6. **Skill 选择校验**（v2.0 新增）: 执行计划第一步必须是"Skill 选择校验"
7. **ANALYSIS→VERIFICATION 间隙自检**（v2.2 新增）: 完成所有 `[ANALYSIS]` 步骤后、开始 `[VERIFICATION]` 步骤前，必须回答以下三个问题并输出：
   ```
   ## ANALYSIS→VERIFICATION 间隙自检

   **问题 1 — 代码 vs 运行态差距**: 代码分析和运行态行为可能在哪些地方不一致？
   （考虑：配置覆盖、handler 跳过、已修复 bug 但注释未更新、条件分支未覆盖等）
   → [具体列举]

   **问题 2 — 现有证据**: 我目前有什么运行态证据证明代码分析结论成立？
   → [无 / 具体证据来源]

   **问题 3 — 不验证的风险**: 如果跳过 VERIFICATION，最坏情况下我会得出什么错误结论？
   → [具体描述]

   **判定**: [必须验证 / 可跳过（需在 audit 说明理由）]
   ```
   **如果问题 2 的回答是「无」且问题 3 的风险不可接受，则不得跳过 VERIFICATION 步骤。**
8. **证据行要求**（v2.2 新增）: 每个 `[VERIFICATION]` 步骤完成后，必须输出一行 `Verified-by:` 证据行，写明具体的运行态证据来源（session ID、日志行号、curl 返回、命令输出）。如果写不出证据行，说明该步骤未实际执行，必须补做。
9. **合理化检测 / 模式检测**（v2.2 新增）: 在执行过程中和 audit 输出前，扫描自己的推理和输出中是否包含以下模式：
   - 「无需实际触发」/「无需验证」/「源码已足够」/「显而易见」/「可以推断」/「无需实际执行」
   - 「代码已经清楚表明」/「从代码可以看出」
   - 任何为跳过已声明步骤提供理由的表述
   
   **检测到上述模式时，必须暂停当前流程，重新检查是否跳过了 `[VERIFICATION]` 步骤。如果确认跳过，必须先补做再继续。**

---

## Phase 2: Post-Execution Audit

任务完成后，**必须输出以下 audit 报告**：

```markdown
## Post-Execution Audit

**Skill 选择评估**:
- [x/✗] 选定的执行 skill 是最佳匹配（如不是，说明原因）
- [x/✗] 是否考虑了组合使用多个 skill
- [x/✗] 如有更优 skill 未被选择，是否记录原因

**遵循情况**:
- [x/✗] Skill 选择校验: [校验结果简述]
- [x/✗] [ANALYSIS] 步骤 1: [实际执行结果简述]
- [x/✗] [VERIFICATION] 步骤 2: [实际执行结果简述]
  - 证据行: `Verified-by: [session ID / 日志行 / curl 返回 / 命令输出]`
- [x/✗] [OBSERVATION] 步骤 3: [实际执行结果简述]
...

**ANALYSIS→VERIFICATION 间隙自检**（如适用）:
- [x/✗] 间隙自检已执行
- [x/✗] 判定结论: [必须验证 / 可跳过]
- [x/✗] 如判定为「可跳过」，理由是否充分: [是/否]

**合理化模式检测**:
- [x/✗] 执行过程中未出现合理化跳步表述
- [x/✗] 如出现，已暂停并补做

**偏差说明**: [无 / 详细说明偏差原因和应对措施]

**改进建议**: [下次类似任务应该如何选择 skill，或流程有何改进空间]

**总体评估**: [完全遵循 / 部分遵循（说明原因）]
```

---

## 示例

### 场景 1：用户要求用 serve API 监控 session 状态（单一执行 skill）

**Phase -1: Skill 选择校验**

```markdown
## Skill 选择校验

**任务本质**: 通过 serve API 查看 OpenCode session 状态

**候选 skill**:
| 候选 skill | 角色 | 匹配度 | 理由 |
|-----------|------|:---:|------|
| serve-api | 执行 | ★★★★★ | 专门用于 serve API 直调操作 |
| pre-flight-enforcement | 约束 | ★★★☆☆ | 可提供流程约束 |

**选择结论**: serve-api（执行）
```

**Phase 0: Pre-Flight Check**

```markdown
## Skill Pre-Flight Check

**约束 skill**: pre-flight-enforcement（流程约束）
**执行 skill**: serve-api

**执行 skill 的规定流程**:
1. curl GET /session（先看活跃 session 列表）
2. tail /tmp/sse-events.jsonl（再查 SSE 事件确认状态）

**执行计划**:
- [x] Skill 选择校验: serve-api 是最佳匹配
- [ ] [VERIFICATION] 步骤 1: curl GET /session 查看 session 列表
- [ ] [OBSERVATION] 步骤 2: tail /tmp/sse-events.jsonl 确认事件状态

**步骤类型规则**:
- `[ANALYSIS]`: 源码分析、文档阅读、代码理解。**仅产生理解，不产生运行态证据。**
- `[VERIFICATION]`: 真实触发、API 调用、命令执行。**必须产生可引用的运行态证据。**
- `[OBSERVATION]`: 检查日志、查看结果、确认输出。**基于 VERIFICATION 的证据做判断。**

**承诺**: 严格按上述顺序执行，不跳步、不调序。
```

**Phase 2: Post-Execution Audit**

```markdown
## Post-Execution Audit

**Skill 选择评估**:
- [x] 选定的执行 skill 是最佳匹配
- [x] 单一执行 skill 足够，无需组合
- [x] 无更优 skill 遗漏

**遵循情况**:
- [x] Skill 选择校验: serve-api 完全匹配任务
- [x] [VERIFICATION] 步骤 1: curl GET /session，发现 2 个活跃 session
  - 证据行: `Verified-by: curl http://localhost:4096/session → 返回 session 列表`
- [x] [OBSERVATION] 步骤 2: tail SSE 事件，确认 session 状态为 idle

**ANALYSIS→VERIFICATION 间隙自检**: 不适用（无 ANALYSIS 步骤）

**合理化模式检测**:
- [x] 执行过程中未出现合理化跳步表述

**偏差说明**: 无

**改进建议**: 无

**总体评估**: 完全遵循
```

---

### 场景 2：用户要求审核 blueprint 文档（组合 skill）

**Phase -1: Skill 选择校验**

```markdown
## Skill 选择校验

**任务本质**: 审核 blueprint 文档与代码的一致性

**候选 skill**:
| 候选 skill | 角色 | 匹配度 | 理由 |
|-----------|------|:---:|------|
| opencode-blueprint-audit | 执行 | ★★★★★ | 专门用于审核蓝图文档准确性 |
| blueprint-creation | 标准来源 | ★★★★☆ | 提供标准模板用于对比 |
| pre-flight-enforcement | 约束 | ★★★☆☆ | 可提供流程约束 |

**选择结论**: pre-flight-enforcement（约束）+ opencode-blueprint-audit（执行）+ blueprint-creation（标准来源）组合使用
```

**Phase 0: Pre-Flight Check**

```markdown
## Skill Pre-Flight Check

**约束 skill**: pre-flight-enforcement（流程约束）
**执行 skill**: opencode-blueprint-audit（审核方法）+ blueprint-creation（标准模板）

**执行 skill 的规定流程**:
1. 提取可验证声明（文件计数、行数、函数签名、配置值）
2. 逐项核实（用 WSL 命令验证）
3. 对比 blueprint-creation 标准模板（6 阶段 + 12 子系统审计）
4. 生成差异报告
5. 修正文档

**执行计划**:
- [x] Skill 选择校验: 三 skill 组合使用
- [ ] [ANALYSIS] 步骤 1: 提取 blueprint 中的可验证声明
- [ ] [VERIFICATION] 步骤 2: 用 WSL 命令逐项核实声明
- [ ] [ANALYSIS] 步骤 3: 对比 blueprint-creation 标准模板
- [ ] [ANALYSIS] 步骤 4: 生成差异报告
- [ ] [VERIFICATION] 步骤 5: 修正文档并验证修改

**步骤类型规则**:
- `[ANALYSIS]`: 源码分析、文档阅读、代码理解。**仅产生理解，不产生运行态证据。**
- `[VERIFICATION]`: 真实触发、API 调用、命令执行。**必须产生可引用的运行态证据。**
- `[OBSERVATION]`: 检查日志、查看结果、确认输出。**基于 VERIFICATION 的证据做判断。**

**承诺**: 严格按上述顺序执行，不跳步、不调序。
```

**Phase 1: 执行中的 ANALYSIS→VERIFICATION 间隙自检**

```markdown
## ANALYSIS→VERIFICATION 间隙自检

（步骤 1 完成后、步骤 2 开始前）

**问题 1 — 代码 vs 运行态差距**: 代码分析和运行态行为可能在哪些地方不一致？
→ blueprint 声明的文件计数可能基于旧 commit，实际文件数可能不同。
→ 函数签名可能在近期重构中已变更但文档未更新。

**问题 2 — 现有证据**: 我目前有什么运行态证据证明代码分析结论成立？
→ 无。步骤 1 仅从文档提取声明，未执行任何命令验证。

**问题 3 — 不验证的风险**: 如果跳过 VERIFICATION，最坏情况下我会得出什么错误结论？
→ 可能报告「blueprint 与代码一致」但实际上文件数/行数/函数签名已变化。

**判定**: 必须验证
```

**Phase 2: Post-Execution Audit**

```markdown
## Post-Execution Audit

**Skill 选择评估**:
- [x] 选定的执行 skill 是最佳匹配
- [x] 正确组合使用了约束 + 执行 + 标准来源 skill
- [x] 无更优 skill 遗漏

**遵循情况**:
- [x] Skill 选择校验: 三 skill 组合为最优方案
- [x] [ANALYSIS] 步骤 1: 提取了 12 个可验证声明
- [x] [VERIFICATION] 步骤 2: 逐项核实发现 4 个差异
  - 证据行: `Verified-by: wc -l src/file.ts → 125 行（blueprint 声明 150 行）`
- [x] [ANALYSIS] 步骤 3: 对比标准发现缺失 12 子系统审计
- [x] [ANALYSIS] 步骤 4: 生成差异报告
- [x] [VERIFICATION] 步骤 5: 修正文档至 v2.0
  - 证据行: `Verified-by: git diff --stat → 3 files changed, 45 insertions`

**ANALYSIS→VERIFICATION 间隙自检**:
- [x] 间隙自检已执行
- [x] 判定结论: 必须验证
- [x] 判定后正确执行了 VERIFICATION 步骤

**合理化模式检测**:
- [x] 执行过程中未出现合理化跳步表述

**偏差说明**: 无

**改进建议**: 下次审核 blueprint 时，Phase -1 应自动识别 opencode-blueprint-audit，无需用户提示

**总体评估**: 完全遵循
```

---

### 场景 3：用户指定的 skill 与任务不匹配

**用户指令**: "用 pre-flight-enforcement 审核 blueprint"

**Phase -1: Skill 选择校验**

```markdown
## Skill 选择校验

**任务本质**: 审核 blueprint 文档与代码的一致性

**候选 skill**:
| 候选 skill | 角色 | 匹配度 | 理由 |
|-----------|------|:---:|------|
| opencode-blueprint-audit | 执行 | ★★★★★ | 专门用于审核蓝图文档准确性 |
| pre-flight-enforcement | 约束 | ★★★☆☆ | 用户指定，可提供流程约束 |

**用户指定 skill 分析**:
用户指定的 `pre-flight-enforcement` 是约束层 skill，不提供具体的审核方法。
任务需要执行层 skill 提供审核流程。

**建议**: 组合使用 pre-flight-enforcement（约束）+ opencode-blueprint-audit（执行）
```

---

## v1.0 → v2.0 → v2.2 变更记录

| 变更项 | v1.0 | v2.0 | v2.2 |
|--------|------|------|------|
| Skill 发现与选择 | 无（假设 skill 已选好） | 新增 Phase -1 | 同 v2.0 |
| Skill 角色区分 | 无（单一"适用 skill"） | 区分约束 skill + 执行 skill + 标准来源 skill | 同 v2.0 |
| Skill 不匹配处理 | 无 | 新增用户意图校验流程 | 同 v2.0 |
| Pre-Flight 模板 | "适用 skill: [名称]" | "约束 skill + 执行 skill" + "Skill 选择校验"检查项 | **新增步骤类型标注 `[ANALYSIS]/[VERIFICATION]/[OBSERVATION]` + 步骤类型规则说明** |
| Audit 模板 | 仅遵循情况 | 新增 Skill 选择评估 + 改进建议 | **新增证据行检查 + ANALYSIS→VERIFICATION 间隙自检 + 合理化模式检测** |
| 执行约束 | 4 条 | 6 条（新增 Skill 角色明确 + Skill 选择校验） | **9 条（新增 ANALYSIS→VERIFICATION 间隙自检、证据行要求、合理化模式检测）** |
| 示例 | 1 个（单一 skill） | 3 个（单一、组合、不匹配） | **示例 1/2 升级为 v2.2 模板，新增间隙自检展示** |

---

## v2.1 Task Contract + Final Gate（强模型监督弱模型场景）

当 QoderWork 强模型指导 OpenCode 弱模型执行任务时，在 pre-flight 之前输出 Task Contract，在 audit 之前执行 Final Gate。

### Task Contract 模板

在 Phase 0 Pre-Flight Check **之前**输出：

```markdown
## Task Contract

Goal: [一句话目标]
Scope: [允许修改/读取的路径或模块]
Non-goals: [明确不做什么]
Required skills: [preflight-lite, codegraph-first, ...]
Acceptance criteria:
- [可验证标准 1]
- [可验证标准 2]
Evidence required:
- [必须提供的日志/测试/diff/文档]
Risk notes:
- [高风险点]
Escalation triggers:
- [何时必须询问或等待指导]
```

**设计原则**：
1. Contract 只定义边界和验收，不剥夺弱模型内部推理空间
2. 控制在 300-800 token
3. 必须包含 evidence required，否则验收退化为听弱模型自述

### Final Gate 模板

在 Phase 2 Post-Execution Audit **之前**执行：

```markdown
## Final Gate

**Contract 对照**:
- [x/✗] Acceptance criteria 1: [证据来源]
- [x/✗] Acceptance criteria 2: [证据来源]

**Evidence 检查**:
- [x/✗] Evidence required 全部提供
- [x/✗] 变更文件在 Scope 内
- [x/✗] 测试/构建/验证已运行

**风险检查**:
- [x/✗] 无遗留 assumption 当事实
- [x/✗] 回滚/handoff 说明存在

**判定**: [Accept / Rework: 具体返工包 / Stop: 风险未解除]
```

**判定规则**：
- **Accept**: 所有 acceptance criteria 有证据，evidence required 齐全，无遗留风险
- **Rework**: 部分 criteria 缺证据或变更超出 scope，给出具体返工清单
- **Stop**: 高风险未解除、测试严重失败、不可逆操作未确认

### 与 tree-watcher 的配合

Task Contract 下发后，使用 `tree-watcher.ts --capsule` 观察弱模型执行。Final Gate 验收时以 capsule 为主要输入，不读取完整 transcript。
