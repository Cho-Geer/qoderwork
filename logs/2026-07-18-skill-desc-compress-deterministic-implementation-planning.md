# 2026-07-18 — deterministic-implementation-planning description 压缩（方案 A）

## 为什么

全量 skill 审核（见 `documents/review/skill-audit-report.md`）发现 `deterministic-implementation-planning` 的 description 为 636 chars，超过 500 上限，是全体系唯一 ❌ 项。用户确认执行方案 A：压缩至 ≤400 chars。

## 改了什么

- `.agents/skills/deterministic-implementation-planning/SKILL.md` frontmatter description：636 → 397 chars。
- 保留优先级按规则执行：触发词 > 负面边界 > WHAT > WHEN；删去冗余触发词（copy-paste plan、blueprint to implementation plan）与修饰语（closed-world、detailed 等）。

## 决策

- 目标区间取 200-400 最佳区间而非仅 <500；最终 397。
- 方案 B/C/D 未执行，待用户后续确认。

## 更新的文档

- 修改：`.agents/skills/deterministic-implementation-planning/SKILL.md`
- 修改：`documents/review/skill-audit-report.md`（修复结果与健康指标同步）
- 新建：本日志
