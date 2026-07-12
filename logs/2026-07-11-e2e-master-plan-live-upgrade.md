# E2E master plan 升级为 full live LLM E2E 账本

**为什么**: `e2e/opencode-framework-simplification-e2e-integration-test-plan.md` 仍停留在 2026-07-06 的缺口视角，混用了旧 residual task、runtime smoke、component 和 partial live 证据，不足以约束“全量 live LLM E2E，不漏 case”的后续执行。

**改了什么**:
- `qoderwork/e2e/opencode-framework-simplification-e2e-integration-test-plan.md` — 重写为 v2.0.0 full live LLM E2E master plan，新增 evidence ladder、current coverage ledger、L1-L7 主矩阵、mandatory open live cases、Appendix A（23 弱模型场景映射）和 Appendix B（禁止冒充 full-live 的证据类型）。
- 文档显式纠正 QoderWork bridge 通道：接受 `prompt_async + agent`、`POST /question/{QID}/reply`、`abort`，拒绝把不存在的 `/session/{SID}/guide|reply|interrupt` 当验收路径。
- 文档显式把 `tool-governance` protected-read、REPO-OP live deny、framework-maintenance 正向写链、watcher R1-R7、optional checklist live 闭环列为 mandatory open cases，防止遗漏。

**决策**: 不再把 2026-07-11 之前的 runtime smoke / deterministic live-integration / direct handler smoke 写成 live LLM E2E；新 master plan 统一要求每个 acceptance item 至少有一个真实 Orchestrator/child live witness，否则保持 open。
