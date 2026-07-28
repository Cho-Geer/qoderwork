# 2026-07-28 — 退役决策：blueprint-permission-template-refactor.md

## 为什么

blueprints-governance PHASE-02 归档退役（REQ-002/REQ-006）。该文件是权限模板化重构占位文件（2026-07-17），文件内已自述由 `blueprint-permission-template-driven-enforcement.md` 取代，后续实施以新文件为唯一权威源。

## 决策

- 文件：`blueprint-permission-template-refactor.md`
- 退役原因：占位文件，已被行为驱动权限模板蓝图显式取代（文件内 Superseded-by 自述）。
- 继任者：`blueprint-permission-template-driven-enforcement.md`（root 活跃，已完成）。
- 日期依据：2026-07-17（写作月）→ 归档至 `blueprints/archive/2026-07/`。
- move-ban 检查：`rg --fixed-strings` 路径形引用在 audits/ 与 plans/ 零命中（PASS），fail-closed 闸门通过，执行 mv。

## 更新文档

- 移动：`blueprints/blueprint-permission-template-refactor.md` → `blueprints/archive/2026-07/blueprint-permission-template-refactor.md`
- 更新：`blueprints/INDEX.md`（## 已归档 段登记，状态 待归档 → 已退役）
