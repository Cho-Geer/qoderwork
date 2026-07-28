# 2026-07-28 — 退役决策：context-lazy-loading-plan.md

## 为什么

blueprints-governance PHASE-02 归档退役（REQ-002/REQ-006）。该文件是 2026-06-29 的框架优化统一实施方案（context-lazy-loading + phase4-scripts-purification 合并稿），已被框架简化路线图蓝图取代。

## 决策

- 文件：`context-lazy-loading-plan.md`
- 退役原因：统一实施方案已被 `blueprint-opencode-framework-simplification-roadmap.md`（root 活跃，已完成）取代。
- 继任者：`blueprint-opencode-framework-simplification-roadmap.md`（root 活跃）。
- 日期依据：2026-06-29（写作月）→ 归档至 `blueprints/archive/2026-06/`。
- move-ban 检查：`rg --fixed-strings` 路径形引用在 audits/ 与 plans/ 零命中（PASS），fail-closed 闸门通过，执行 mv。

## 更新文档

- 移动：`blueprints/context-lazy-loading-plan.md` → `blueprints/archive/2026-06/context-lazy-loading-plan.md`
- 更新：`blueprints/INDEX.md`（## 已归档 段登记，状态 待归档 → 已退役）
