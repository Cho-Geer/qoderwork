# Framework 状态再审与文档同步

**为什么**: `work-one` 代码在 2026-07-11 又有更新，原 roadmap/plan 文档出现 live metric 漂移、before 链数量过期、Phase 5 完成度前后冲突，继续沿用会误导后续审计。

**改了什么**:
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md`、`blueprints/blueprint-tool-governance-mvc-refactor.md` — 同步当前 live metric（CodeGraph 419 / `.opencode` TS 372 / 75,563 lines）、before 11、Tool Governance 日志字段闭环、Phase 5 完成状态
- `plans/00-overview.md`、`plans/01-phase0-baseline-freeze.md`、`plans/02-phase1-skill-first.md`、`plans/04-phase3-enforcement-slimming.md`、`plans/05-phase4-minimal-state.md`、`plans/06-phase5-legacy-retirement.md` — 清理互相冲突的结论，补齐 `path-validate` active order、Skill-first/Phase 5 实际状态、JSONL `outcome` 事实

**决策**: 本轮只更新 qoderwork 侧规划/蓝图文档，不改 `work-one` 运行代码；保留两个显式未闭环项为后续 follow-up：`safe_shell` protected-path read 语义，以及真正 Orchestrator -> build 的 Tool Governance live LLM E2E。
