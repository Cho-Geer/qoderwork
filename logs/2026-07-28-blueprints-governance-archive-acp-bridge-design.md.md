# 2026-07-28 — 退役决策：acp-bridge-design.md

## 为什么

blueprints-governance PHASE-02 归档退役（REQ-002/REQ-006）。该文件是 ACP-Bridge MCP Server 设计方案 v2（无自述日期），已被方案 C（Serve API 替代子进程）改造设计取代，且整条 ACP bridge 线已于 2026-07 退役。

## 决策

- 文件：`acp-bridge-design.md`
- 退役原因：v2 子进程 + JSON-RPC 设计被 Serve API 方案取代；ACP bridge 整线退役后无活跃承接。
- 继任者：`acp-bridge-serve-api-redesign.md`（同批归档；ACP 线已终止，root 无活跃继任蓝图）。
- 日期依据：入库月（无自述日期）→ 归档至 `blueprints/archive/2026-07/`。
- move-ban 检查：`rg --fixed-strings` 路径形引用在 audits/ 与 plans/ 零命中（PASS），fail-closed 闸门通过，执行 mv。

## 更新文档

- 移动：`blueprints/acp-bridge-design.md` → `blueprints/archive/2026-07/acp-bridge-design.md`
- 更新：`blueprints/INDEX.md`（## 已归档 段登记，状态 待归档 → 已退役）
