# Context7 与 Scout 质量下限路线并入 plan

**为什么**: 用户确认 skill-first/light-weight 方向后，希望进一步用 Context7 弥补弱模型外部知识过时，用官方 Scout 弥补复杂调研和不会主动提问的问题，同时避免恢复旧重型多 Agent 编排。

**改了什么**:
- `plans/00-overview.md` — 增加 Context7 条件性知识新鲜度和 Scout 升级侦察为重构优先项
- `plans/02-phase1-skill-first.md` — 将 Context7/Scout 纳入 `preflight-lite`、`skill-summary` 触发规则和验收标准
- `plans/03-phase2-native-agent-dag.md` — 增加通过原生 `Task` 派遣 Scout 的 smoke test 和输出契约
- `plans/04-phase3-enforcement-slimming.md` — 增加 freshness/Scout 的 warn/audit 治理边界，避免新硬门
- `plans/06-phase5-legacy-retirement.md` — 增加 Context7/Scout 弱模型回归验证集

**决策**: Context7 和 Scout 都是条件触发的质量下限机制，不作为每个任务的全局前置门禁；高风险外部 API 任务才允许把 freshness evidence 缺失升级为 hard block。
