# 2026-07-28 — 退役决策：blueprint-acp-bridge-sse-events.md

## 为什么

blueprints-governance PHASE-02 归档退役（REQ-002/REQ-006）。该文件是 ACP Bridge v0.8.0 SSE 驱动早期完成检测 + 事件集成方案（2026-07-02，待实装）；整条 ACP bridge 线已于 2026-07 退役，方案不再实施。

## 决策

- 文件：`blueprint-acp-bridge-sse-events.md`
- 退役原因：ACP bridge 整线退役，SSE 事件集成方案取消，未进入实装。
- 继任者：无（ACP 线已终止，root 无活跃继任蓝图）。
- 日期依据：2026-07-02（写作月）→ 归档至 `blueprints/archive/2026-07/`。
- move-ban 检查：`rg --fixed-strings` 路径形引用在 audits/ 与 plans/ 零命中（PASS），fail-closed 闸门通过，执行 mv。

## 更新文档

- 移动：`blueprints/blueprint-acp-bridge-sse-events.md` → `blueprints/archive/2026-07/blueprint-acp-bridge-sse-events.md`
- 更新：`blueprints/INDEX.md`（## 已归档 段登记，状态 待归档 → 已退役）
