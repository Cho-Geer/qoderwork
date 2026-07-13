# safe_shell verified plan 上下文贯通

**为什么**: Phase 7 第一轮已经引入 `VerifiedCommandPlan`，但治理层和执行层仍各自重算一次；这会放大判定漂移风险，也让“before 已验证”到“最终执行”的证据链断开。

**改了什么**:
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/tool-governance/context.ts` / `policies/shell-policy.ts` — 让治理上下文携带 `verifiedCommandPlan`，shell policy 在通过解析后把唯一 plan 挂到上下文。
- `/home/zhaoge/workspace/opencode/work-one/.opencode/plugin-handlers/before/tool-governance-handler.ts` / `.opencode/tools/safe_shell.ts` — before hook 把 plan 注入 internal arg `__verified_command_plan`，`safe_shell` 显式声明并消费它，同时把 `context.abort` 传入执行层。
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/file-guard/shell-guard.ts` / `shell-plan.ts` / tests — `safeBashTool` 优先执行注入的 verified plan，只做结构性校验不再重解析；新增 handler 注入回归测试。

**决策**: 采用仓库现有的“before 注入 internal args”模式，而不是改 plugin runtime 或发明新的上下文通道；这样能最小化接线成本，同时保持 blueprint 想要的“policy 产出唯一执行契约，executor 只消费契约”的方向。
