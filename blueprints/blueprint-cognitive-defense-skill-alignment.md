# Blueprint: create-skill 与 skill-diagnosis-optimization 认知缺陷防护对齐

**版本**: 1.0.0
**日期**: 2026-07-13
**状态**: 待实施
**优先级**: P0

---

## 一、问题背景

### 1.1 问题描述

当前 `create-skill` 和 `skill-diagnosis-optimization` 两个技能不支持 v2.2 认知缺陷防护模式：

- **create-skill**：不会教创建者把 `[ANALYSIS]`/`[VERIFICATION]` 步骤类型标注、`Verified-by:` 证据行、合理化检测、认知说明写进新技能里
- **skill-diagnosis-optimization**：7 个评分维度全是元数据质量（description 长度、触发词等），没有检查 v2.2 认知缺陷防护模式的维度

### 1.2 根因分析

- **直接原因**：v2.2 模式是本次事件后新增的，两个技能尚未对齐
- **根本原因**：create-skill 缺少「认知缺陷防护模式」教学章节；skill-diagnosis-optimization 的评分维度和修复步骤缺少 v2.2 检查项

### 1.3 实测验证

- `create-skill` Phase 4 已有 `[VERIFICATION]` 标注但无教学章节：`Verified-by: grep -c '认知缺陷防护' SKILL.md -> 0`
- `skill-diagnosis-optimization` 7 个评分维度无 v2.2 检查项：`Verified-by: grep '步骤类型\|证据行\|合理化\|认知说明' SKILL.md -> 0 匹配`

---

## 二、解决方案

### 2.1 方案对比

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| A. 最小改动 | 只在现有章节中插入 v2.2 检查项 | 改动小 | 教学不完整，创建者看不到模板 |
| B. 新增独立章节 + 扩展评分维度 | create-skill 新增「认知缺陷防护模式」章节；skill-diagnosis 新增 4 个评分维度 + 4 个修复步骤 | 教学完整，审计覆盖 | 改动量中等 |
| C. 创建独立技能 | 新建一个 `cognitive-defense-patterns` 技能 | 解耦 | 增加技能总数，违反 ≤15 原则 |

### 2.2 选择结论

**方案 B**：新增独立章节 + 扩展评分维度。教学完整，且不增加技能总数。

### 2.3 否决理由

- 方案 A：创建者看不到 4 种模式的定义和模板，无法正确应用
- 方案 C：当前 QoderWork 已有 19 个技能，新增会加剧超量问题

---

## 三、核心设计

### 3.1 create-skill 改动设计

在 `## Core Authoring Principles` 和 `## Common Patterns` 之间新增 `## 认知缺陷防护模式` 章节，教创建者在编写技能步骤时自动应用 v2.2 模式。同时更新 Phase 1-3 标注和 Summary Checklist。

### 3.2 skill-diagnosis-optimization 改动设计

在 Phase 1 Step 3 评分表后新增 Step 3b（4 个认知缺陷防护评分维度），在 Phase 4 新增 Step 22-25（4 个修复步骤），在 Phase 5 报告模板和验证清单中增加对应项。

---

## 四、实施清单

### 4.1 文件变更列表

| 序号 | 文件 | 变更类型 | 说明 |
|------|------|---------|------|
| 1 | `.agents/skills/create-skill/SKILL.md` | 修改 | 新增「认知缺陷防护模式」章节（~80 行）+ Phase 1-3 标注 `[ANALYSIS]` + Summary Checklist 新增 4 项 |
| 2 | `.agents/skills/skill-diagnosis-optimization/SKILL.md` | 修改 | Phase 1 新增 Step 3b（4 个评分维度）+ Phase 4 新增 Step 22-25（4 个修复步骤）+ Phase 5 报告模板 + 验证清单新增 4 项 |
| 3 | `blueprints/blueprint-cognitive-defense-skill-alignment.md` | 新建 | 本文档 |

### 4.2 实施步骤

#### Phase 1: 保存 blueprint 文档

将完整 blueprint 保存到 `blueprints/blueprint-cognitive-defense-skill-alignment.md`。

#### Phase 2: create-skill 优化

**步骤 2.1**: 在 `## Core Authoring Principles` 末尾（`### 4. Set Appropriate Degrees of Freedom` 之后）、`## Common Patterns` 之前，插入新章节 `## 认知缺陷防护模式`。

新章节内容包含 4 个子节：
1. `### 1. 步骤类型标注` - 定义 `[ANALYSIS]`/`[VERIFICATION]`/`[OBSERVATION]` + 标注位置说明
2. `### 2. Verified-by 证据行` - 格式定义 + "写不出 = 未执行"规则
3. `### 3. 合理化检测` - 格式模板 + 常见跳步理由列表
4. `### 4. 认知说明` - 格式模板
5. `### 何时应用` - 场景表格

**步骤 2.2**: 更新 `## Skill Creation Workflow` 中 Phase 1-3 标题：
- `### Phase 1: Discovery` -> `### Phase 1: Discovery \`[ANALYSIS]\``
- `### Phase 2: Design` -> `### Phase 2: Design \`[ANALYSIS]\``
- `### Phase 3: Implementation` -> `### Phase 3: Implementation \`[ANALYSIS]\``

**步骤 2.3**: 更新 `## Summary Checklist`，在 `### Core Quality` 末尾新增 `### 认知缺陷防护` 4 项检查。

#### Phase 3: skill-diagnosis-optimization 优化

**步骤 3.1**: 在 Phase 1 Step 3 评分表之后、Step 4 之前，新增 `### Step 3b: 认知缺陷防护评分`，包含 4 个评分维度表 + 适用判断说明。

**步骤 3.2**: 在 Phase 4 修复表（Step 13-21）之后、修复顺序说明之后，新增 `### Step 22-25: 认知缺陷防护修复`，包含修复表 + 修复顺序说明。

**步骤 3.3**: 在 Phase 5 报告模板的 `### 4. 修复结果` 表之后，新增 `### 4.1 认知缺陷防护修复结果` 表。

**步骤 3.4**: 在验证清单现有 8 项之后，新增 4 项认知缺陷防护验证（每项附 `Verified-by:` 证据行）。

---

## 五、验证计划

### 5.1 单元验证

- [ ] create-skill 新增章节包含 4 种防护模式的定义和模板
- [ ] create-skill Summary Checklist 包含 4 项认知缺陷防护检查
- [ ] skill-diagnosis Step 3b 包含 4 个新评分维度
- [ ] skill-diagnosis Step 22-25 包含 4 个新修复步骤

### 5.2 集成验证

- [ ] create-skill Phase 1-3 标注了 `[ANALYSIS]`，Phase 4 标注了 `[VERIFICATION]`
- [ ] skill-diagnosis 验证清单包含 12 项（原 8 + 新 4）
- [ ] skill-diagnosis 报告模板包含认知缺陷防护修复结果表

### 5.3 端到端验证

- [ ] 用 create-skill 创建一个测试技能，确认新章节指导创建者添加了 4 种防护模式
- [ ] 用 skill-diagnosis 扫描一个缺标注的技能，确认 Step 3b 检测出问题，Step 22-25 执行了修复

---

## 六、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 纯操作型技能被误判为缺标注 | 低 | Step 3b 明确「无验证步骤 -> ⏭️ 不适用，不影响总评」 |
| 新增内容使 SKILL.md 超长 | 中 | 新增章节控制在 ~80 行内；skill-diagnosis 新增控制在 ~60 行内 |
| 弱模型不理解何时用哪种防护模式 | 中 | 新增章节有「何时应用」表格 + 具体示例 |

---

## 七、成功标准

- [ ] create-skill 包含「认知缺陷防护模式」章节，覆盖 4 种模式 + 何时应用表格
- [ ] create-skill Summary Checklist 包含「认知缺陷防护」4 项检查
- [ ] skill-diagnosis Phase 1 Step 3b 包含 4 个认知缺陷防护评分维度
- [ ] skill-diagnosis Phase 4 Step 22-25 包含 4 个认知缺陷防护修复步骤
- [ ] skill-diagnosis Phase 5 报告模板包含认知缺陷防护修复结果表
- [ ] skill-diagnosis 验证清单包含 12 项（原 8 + 新 4）

---

## 八、附录

### 8.1 相关文件

- `.agents/skills/pre-flight-enforcement/SKILL.md` - v2.2 步骤类型系统定义来源
- `.agents/skills/serve-api/SKILL.md` - v1.4.0 证据产出标准定义来源
- `.agents/skills/blueprint-creation/SKILL.md` - blueprint 标准模板

### 8.2 背景

本次对齐源于 2026-07-13 的一次真实事件：agent 在验证 `safe_shell gh issue create --repo ...` 的 before-hook 链路时，用源码分析替代了 serve API 真实触发，并在 audit 中写「无需实际触发」合理化跳步。事后分析发现这是 ANALYSIS vs VERIFICATION 认知偏差，随后更新了 pre-flight-enforcement (v2.2) 和 serve-api (v1.4.0)，并对全部 37 个技能做了认知缺陷风险审计。本 blueprint 是审计结论的落地：让 create-skill 教创建者预防，让 skill-diagnosis-optimization 自动检测和修复。
