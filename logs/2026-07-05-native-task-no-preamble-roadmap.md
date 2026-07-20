# Native Task no-preamble roadmap

**为什么**: 用户明确希望本轮重构以 skill-first、active hook、light-weight 为核心，删除 `subagent-preamble.md`，默认使用原生 `Task` 派遣，避免上下文拥挤和语义重复。

**改了什么**:
- `plans/opencode-framework-simplification-roadmap/00-overview.md` — 将 P0 目标改为删除/退役 `subagent-preamble.md`、原生 `Task` 默认派遣、`dispatch_subagent` 降级为兼容层。
- `plans/opencode-framework-simplification-roadmap/01-phase0-baseline-freeze.md` — 将待验证项改为原生 Task 无 DAG 派遣。
- `plans/opencode-framework-simplification-roadmap/02-phase1-skill-first.md` — 将 T1.7 从“瘦身 preamble”改为删除 preamble，并把内容迁移到 Skill/reference 与 active hooks。
- `plans/opencode-framework-simplification-roadmap/03-phase2-native-agent-dag.md` — 新增原生 Task no-preamble 验证和 `dispatch_subagent` 退役路线。
- `plans/opencode-framework-simplification-roadmap/04-phase3-enforcement-slimming.md` — 新增 native Task 兼容的 dispatch integrity 改造，要求 `DISPATCH_TOKEN` 不再是普通 Task 前置硬约束。
- `plans/opencode-framework-simplification-roadmap/06-phase5-legacy-retirement.md` — 将回归验证改为 preamble deletion + native Task smoke。

**决策**: 最终默认路径是原生 `Task` + Skill 按需加载 + active hooks 硬约束；`dispatch_subagent` 不再是默认派遣原语，只能短期兼容或最终删除。
