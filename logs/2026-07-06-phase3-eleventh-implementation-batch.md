# Phase 3 第十一批顶层指令与入口脚本对齐

**为什么**: 即使热路径代码已瘦身，如果 `AGENTS.md` 和入口脚本仍坚持“所有任务必须先 gate / 先 Meta-Planner / 先 dispatch_subagent”，弱模型依然会优先服从这层旧叙事，继续把轻任务拖回重框架。

**改了什么**:
- `/home/zhaoge/workspace/opencode/work-one/AGENTS.md` — 顶部协作规范改为 `preflight-lite` first、native `Task` first、DAG/gate 仅按复杂度和风险升级
- `/home/zhaoge/workspace/opencode/work-one/AGENTS.md` — `compliance_gate_complete` 改成仅适用于 gate 治理路径，不再宣称所有任务无条件强制
- `/home/zhaoge/workspace/opencode/work-one/.opencode/scripts/pre-execution-gate.ts` — 对外字段改为 `enforcement_policy`，减少旧 `strict` 话术，KC dispatch 提示改为 approved native Task path
- `/home/zhaoge/workspace/qoderwork/implementation-plans/phase3-implementation-plan.md` — 新增第十一批实施状态与剩余口径

**决策**: 先改最上层行为指令，再继续清理下层 residual 文案。因为对弱模型来说，顶层叙事比底层实现更先被注意到，必须先把“所有任务都走重流程”的默认心智拆掉。
