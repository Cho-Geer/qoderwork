# Tool Governance MVC 再审与文档状态同步

**为什么**: work-one 已按 `blueprint-tool-governance-mvc-refactor.md` 更新代码，需要重新核验当前运行链并修正文档中“未接线/不可导入”的旧状态。

**改了什么**:
- `blueprints/blueprint-tool-governance-mvc-refactor.md` — 更新为 v2.2，记录 Phase 0-2 已落地、Phase 3 部分完成、测试 27/27 PASS、`codegraph.ts` 尚未收敛。
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md` — 更新为 v1.14.1，补入 Tool Governance MVC live 状态与 before 10 基线。
- `plans/opencode-framework-simplification-roadmap/00-overview.md`、`plans/opencode-framework-simplification-roadmap/01-phase0-baseline-freeze.md`、`plans/opencode-framework-simplification-roadmap/04-phase3-enforcement-slimming.md` — 同步 CodeGraph 414 / TS 369 / 75,218 lines / before 10，并标明 `tool-governance` 已接入。

**决策**: `plans/02`、`03`、`05`、`06` 未发现本轮代码更新导致的直接漂移，保持不改；DB schema 仍按项目自管 `schema_version`/文档口径记录为 v37，不用 `pragma user_version=0` 覆盖。
