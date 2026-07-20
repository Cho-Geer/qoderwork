# OpenCode plans second live refresh

**为什么**: work-one 再次更新后，CodeGraph/TS 文件数、Agent 行数、legacy handler 文件状态和 after delegate 状态都与上一版 plan 有差异。

**改了什么**:
- `plans/opencode-framework-simplification-roadmap/00-overview.md` — 更新 live 指标到 312 TS / 65,262 行 / Agent 464 行 / CodeGraph 358 文件。
- `plans/opencode-framework-simplification-roadmap/01-phase0-baseline-freeze.md` — 增加 active handler vs legacy handler 的区分和 `.opencode/opencode.db` 0 byte 风险。
- `plans/opencode-framework-simplification-roadmap/02-phase1-skill-first.md` — 明确 `skill-summary` 默认顺序存在但被 config 覆盖，MCP role filter 仍未接线。
- `plans/opencode-framework-simplification-roadmap/03-phase2-native-agent-dag.md` — 将 dispatch validator 从 orphan 调整为 legacy/quarantine 风险。
- `plans/opencode-framework-simplification-roadmap/04-phase3-enforcement-slimming.md` — 更新 legacy hard-block handler 恢复、after delegate 恢复后的热路径副作用。
- `plans/opencode-framework-simplification-roadmap/05-phase4-minimal-state.md` — 更新 audit delegate 实际副作用和 DB 权威源风险。
- `plans/opencode-framework-simplification-roadmap/06-phase5-legacy-retirement.md` — 更新 Agent 行数和 skill-summary smoke 当前预期。

**决策**: 后续计划必须同时记录 active execution order 与 legacy files；不能用目录中文件存在性推断运行时行为。
