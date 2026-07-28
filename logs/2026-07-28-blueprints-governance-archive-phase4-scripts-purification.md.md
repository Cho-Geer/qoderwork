# 2026-07-28 — 退役决策：phase4-scripts-purification.md

## 为什么

blueprints-governance PHASE-02 归档退役（REQ-002/REQ-006）。该文件是 Phase 4 Scripts Purification 实施方案（无自述日期），先被并入 context-lazy-loading 统一方案，后被框架简化路线图蓝图取代。

## 决策

- 文件：`phase4-scripts-purification.md`
- 退役原因：脚本净化方案已并入统一实施方案，最终由 `blueprint-opencode-framework-simplification-roadmap.md` 承接。
- 继任者：`blueprint-opencode-framework-simplification-roadmap.md`（root 活跃，已完成）。
- 日期依据：入库月（无自述日期）→ 归档至 `blueprints/archive/2026-06/`。
- move-ban 检查：`rg --fixed-strings` 路径形引用在 audits/ 与 plans/ 零命中（PASS），fail-closed 闸门通过，执行 mv。

## 更新文档

- 移动：`blueprints/phase4-scripts-purification.md` → `blueprints/archive/2026-06/phase4-scripts-purification.md`
- 更新：`blueprints/INDEX.md`（## 已归档 段登记，状态 待归档 → 已退役）
