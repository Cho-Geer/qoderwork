# OpenCode plans live refresh

**为什么**: work-one 框架已更新，`plans/` 仍引用旧 308 TS/65K/19 Skill/14+13 handler 基线，继续使用会误导后续重构。

**改了什么**:
- `plans/00-overview.md` — 更新 live 指标、阶段状态和新的 P0/P1 优先级。
- `plans/01-phase0-baseline-freeze.md` — 改为事实冻结收口，标注 work-one stale docs。
- `plans/02-phase1-skill-first.md` — 记录 17 Skill 现状，突出 `skill-summary` 未启用。
- `plans/03-phase2-native-agent-dag.md` — 更新 alias/DAG 当前状态和 orphan dispatch validator 风险。
- `plans/04-phase3-enforcement-slimming.md` — 更新 6+6 handler 现状，加入去模式化任务。
- `plans/05-phase4-minimal-state.md` — 更新 44 表/schema v33 和多 DB 权威源风险。
- `plans/06-phase5-legacy-retirement.md` — 改为行为验证计划，避免静态全绿结论。

**决策**: 不再按旧“大拆 65K 框架”叙述推进，改为基于已瘦身 live 代码做接线、去模式化、orphan 清理和运行级验证。
