# Deterministic plan 长度治理

- 原因：单体详细实施计划过长时会挤占弱模型执行上下文，且原 validator 只报告行数、不阻断超限。
- 决策：固定 `SINGLE_FILE` 与 `PLAN_SET` 两种输出模式，禁止按文本位置机械切分。
- 长度门禁：单文件 20,000 字符/450 行/2 Phase；Phase 14,000 字符/320 行；index/final 各 8,000 字符/160 行。
- 复杂度门禁：单 Phase 最多 10 requirements、8 files、12 checks；一个 plan set 最多 8 Phase。
- 校验器：支持文件或目录输入，检查预算、manifest、依赖顺序、重复/缺失/未登记 Phase 和局部自包含契约。
- Skill 合规：移除非标准 `version`/`description_zh` frontmatter，双语触发词保留在标准 `description`。
- 更新文档：
  - `.agents/skills/deterministic-implementation-planning/SKILL.md`
  - `.agents/skills/deterministic-implementation-planning/PLAN-TEMPLATE.md`
  - `.agents/skills/deterministic-implementation-planning/PLAN-SET-TEMPLATE.md`
  - `.agents/skills/deterministic-implementation-planning/QUALITY-GATES.md`
