# 2026-07-28 — 退役决策：blueprint-acp-bidirectional.md

## 为什么

blueprints-governance PHASE-02 归档退役（REQ-002/REQ-006）。该文件是 ACP 双向通信完整改造方案 v2.1（2026-07-01），Part A 已实装、Part B/C/D 不再实施；整条 ACP bridge 线已于 2026-07 退役。

## 决策

- 文件：`blueprint-acp-bidirectional.md`
- 退役原因：ACP 双向通信线退役，未实装部分（B/C/D）取消，已实装部分（A）由运行代码承接。
- 继任者：无（ACP 线已终止，root 无活跃继任蓝图）。
- 日期依据：2026-07-01（写作月）→ 归档至 `blueprints/archive/2026-07/`。
- move-ban 检查：`rg --fixed-strings` 路径形引用在 audits/ 与 plans/ 零命中（PASS），fail-closed 闸门通过，执行 mv。

## 更新文档

- 移动：`blueprints/blueprint-acp-bidirectional.md` → `blueprints/archive/2026-07/blueprint-acp-bidirectional.md`
- 更新：`blueprints/INDEX.md`（## 已归档 段登记，状态 待归档 → 已退役）
