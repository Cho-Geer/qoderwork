# Plans live-code re-audit

**为什么**: 用户要求根据当前 work-one 框架代码重新审核并更新 plan。旧 plan 仍把 17 Skill、464 agent 行、6 before、44 DB 表、active preamble 等过期事实当成当前状态。

**改了什么**:
- `plans/opencode-framework-simplification-roadmap/00-overview.md` — 更新 live 指标、优先级和总览状态，明确 Orchestrator-only 尚未物理完成
- `plans/opencode-framework-simplification-roadmap/01-phase0-baseline-freeze.md` — 更新 CodeGraph/TS/Skill/Agent/DB/handler 基线
- `plans/opencode-framework-simplification-roadmap/02-phase1-skill-first.md` — 修正 preflight-lite 已接线、FULL.md 未轻量化、Skill 列表 18 个
- `plans/opencode-framework-simplification-roadmap/03-phase2-native-agent-dag.md` — 更新 native Task compat、active preamble 删除、dispatch_subagent 未退役状态
- `plans/opencode-framework-simplification-roadmap/04-phase3-enforcement-slimming.md` — 更新 7 before active chain、mode 残留、prompt-level 剩余项
- `plans/opencode-framework-simplification-roadmap/05-phase4-minimal-state.md` — 更新主 DB 45 表/schema v33/size 与 lineage 验证风险
- `plans/opencode-framework-simplification-roadmap/06-phase5-legacy-retirement.md` — 更新 agent 文件 539 行、Orchestrator-only 物理收敛未完成
- `implementation-plans/phase3-implementation-plan.md` — 增加第十五批 live code re-audit 状态

**决策**: 不把静态代码结构等同于运行级通过。能从当前代码直接证明的项标为已落地；需要真实 OpenCode session、native Task lineage、system transform 日志或弱模型回归的项保持 pending。
