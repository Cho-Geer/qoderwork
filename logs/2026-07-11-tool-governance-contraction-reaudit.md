# Tool Governance 收缩闭合再审

**为什么**: work-one 再次更新后，`tool-governance` 与 `codegraph.ts` 的职责边界发生变化，原文档仍有 414/369/75,218、27/27、`codegraph.ts` repo-op 未收敛、safe-bash 旧角色测试失败等旧状态。

**改了什么**:
- `blueprints/blueprint-tool-governance-mvc-refactor.md` — 更新为 v2.3，确认 repo-op 主裁决已从 `codegraph.ts` / `shell-guard.ts` 收敛到 `repo-policy`，记录 29/29、handler 2/2、safe-bash 23/23，并新增 protected-path read 边界。
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md`、`plans/00-overview.md`、`plans/01-phase0-baseline-freeze.md`、`plans/04-phase3-enforcement-slimming.md`、`plans/06-phase5-legacy-retirement.md` — 同步 CodeGraph 417 / TS 371 / 75,410 lines、D3 证据等级、safe-bash 23/23。

**决策**: D3 由 `scripts/_d3_live.ts` 直接导入生产 handler，证据等级记为 deterministic live-integration/runtime log smoke，不写成真正 Orchestrator -> build live LLM E2E；`plans/02`、`03`、`05` 本轮未发现直接漂移，保持不改。
