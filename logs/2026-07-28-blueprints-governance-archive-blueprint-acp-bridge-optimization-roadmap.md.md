# 2026-07-28 — 退役决策：blueprint-acp-bridge-optimization-roadmap.md

## 为什么

blueprints-governance PHASE-02 归档退役（REQ-002/REQ-006）。该文件是 ACP Bridge 优化优先级路线图 v0.9.0+（2026-07-02，状态：规划中）；整条 ACP bridge 线已于 2026-07 退役，路线图不再执行。

## 决策

- 文件：`blueprint-acp-bridge-optimization-roadmap.md`
- 退役原因：ACP bridge 整线退役，优化路线图失去实施对象，规划取消。
- 继任者：无（ACP 线已终止，root 无活跃继任蓝图）。
- 日期依据：2026-07-02（写作月）→ 归档至 `blueprints/archive/2026-07/`。
- move-ban 检查：`rg --fixed-strings` 路径形引用在 audits/ 与 plans/ 零命中（PASS），fail-closed 闸门通过，执行 mv。

## 更新文档

- 移动：`blueprints/blueprint-acp-bridge-optimization-roadmap.md` → `blueprints/archive/2026-07/blueprint-acp-bridge-optimization-roadmap.md`
- 更新：`blueprints/INDEX.md`（## 已归档 段登记，状态 待归档 → 已退役）
