# 2026-07-28 — 退役决策：acp-protocol-verified.md

## 为什么

blueprints-governance PHASE-02 归档退役（REQ-002/REQ-006）。该文件是 2026-06-28 的 ACP 协议集成验证报告，验证结论已被 ACP bridge 设计系列吸收，且整条 ACP bridge 线已于 2026-07 退役。

## 决策

- 文件：`acp-protocol-verified.md`
- 退役原因：一次性验证报告，结论已并入 `acp-bridge-design.md`；ACP 线退役后无活跃承接。
- 继任者：`acp-bridge-design.md`（同批归档；ACP 线已终止，root 无活跃继任蓝图）。
- 日期依据：2026-06-28（写作月）→ 归档至 `blueprints/archive/2026-06/`。
- move-ban 检查：`rg --fixed-strings` 路径形引用在 audits/ 与 plans/ 零命中（PASS），fail-closed 闸门通过，执行 mv。

## 更新文档

- 移动：`blueprints/acp-protocol-verified.md` → `blueprints/archive/2026-06/acp-protocol-verified.md`
- 更新：`blueprints/INDEX.md`（## 已归档 段登记，状态 待归档 → 已退役）
