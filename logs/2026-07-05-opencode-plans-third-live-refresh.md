# OpenCode plans third live refresh

**为什么**: work-one 框架再次大更新，上一版 plan 仍把 `skill-summary` 写成未启用，并使用 312 TS/65,262 行/CodeGraph 358 的旧指标。

**改了什么**:
- `plans/opencode-framework-simplification-roadmap/00-overview.md` — 升级到 v1.3.0，记录 315 TS、66,436 行、CodeGraph 361、system 2、rule-disposition 迁移中。
- `plans/opencode-framework-simplification-roadmap/01-phase0-baseline-freeze.md` — 更新 live baseline 和 DB 文件拓扑，区分主 DB、state 下 0 byte DB、`.trash-db` 归档。
- `plans/opencode-framework-simplification-roadmap/02-phase1-skill-first.md` — 将任务从启用 `skill-summary` 改为运行验证和中文关键词调优。
- `plans/opencode-framework-simplification-roadmap/03-phase2-native-agent-dag.md` — 补充 DAG 规则已 audit-only、`dispatch-sa-repair` 未注册的迁移风险。
- `plans/opencode-framework-simplification-roadmap/04-phase3-enforcement-slimming.md` — 记录 `rule-disposition.ts` 已落地但 `getEnforcementMode()`/`ENFORCEMENT_MODE` 仍残留。
- `plans/opencode-framework-simplification-roadmap/05-phase4-minimal-state.md` — 更新多 DB 风险和 `.trash-db` 处理建议。
- `plans/opencode-framework-simplification-roadmap/06-phase5-legacy-retirement.md` — 修正 Skill injection smoke 预期为 PENDING 而非未接线失败。

**决策**: 不重写路线图，只做事实漂移修正；当前优先级改为验证 `skill-summary` 真实注入、完成 rule-disposition 迁移、隔离 legacy handler。
