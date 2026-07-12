# Serve API E2E doc sync

**为什么**: `2026-07-06-serve-api-e2e-validation.md` 已证明 serve-api v1.3.0 Session 树监控与主动干预 6/6 PASS，原框架简化文档仍把部分能力写成未验收或未区分通道。

**改了什么**:
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md` — 升级 v1.9.0，记录 serve-api 6/6 PASS、`/children` JSON 主路径已验收、DB fallback 仅代码审计未故障注入。
- `plans/00-overview.md` — 升级 1.10.0，更新 live metric 口径、preflight FULL 状态、serve-api E2E 与 ACP/SSE watcher 边界。
- `plans/01-phase0-baseline-freeze.md` 到 `plans/06-phase5-legacy-retirement.md` — 补充 serve-api tree/monitor/guide/reply/abort 运行证据，保留完整 native agent 矩阵和 ACP/SSE watcher pending。

**决策**: serve API 直连干预能力标为 PASS；不把它扩大解释为 ACP watcher 主动监督完成，也不把 `/children` JSON 主路径 PASS 扩大解释为 DB fallback 故障注入 PASS。
