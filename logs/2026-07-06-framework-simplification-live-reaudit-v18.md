# Framework simplification live re-audit v1.8

**为什么**: work-one 框架更新后，原路线图和 Phase 0-5 计划仍混有旧指标、旧 DB 文件状态、preflight-lite 旧门禁和 serve-api 脚本未实施叙述。

**改了什么**:
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md` — 升级到 v1.8.0，更新 325 TS/68,458 行、7+6+2 active handler、state 单主 DB、serve-api 脚本已存在但未验收。
- `plans/opencode-framework-simplification-roadmap/01-phase0-baseline-freeze.md` — 更新 live metric 与 `.trash-db` 归档状态。
- `plans/opencode-framework-simplification-roadmap/02-phase1-skill-first.md` — 标记 `preflight-lite/FULL.md` v3.0.0 已轻量化，剩余 stale 文档/回归。
- `plans/opencode-framework-simplification-roadmap/03-phase2-native-agent-dag.md`、`plans/opencode-framework-simplification-roadmap/04-phase3-enforcement-slimming.md`、`plans/opencode-framework-simplification-roadmap/06-phase5-legacy-retirement.md` — 将 native Task 状态统一为 build smoke PASS、完整矩阵 pending。
- `plans/opencode-framework-simplification-roadmap/05-phase4-minimal-state.md` — 更新 DB size、state 目录单主 DB与 WAL/SHM 附件口径。

**决策**: 不把单条 Orchestrator->build smoke 扩大解释为 native Task 全通过；不再把 `preflight-lite/FULL.md` 当遗留硬门禁；serve-api session-tree 脚本按“已实现但 fallback/退出码/Section C E2E 未验收”处理。
