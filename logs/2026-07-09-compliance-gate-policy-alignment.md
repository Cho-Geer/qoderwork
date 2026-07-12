# compliance gate policy alignment

**为什么**: 问题2不是运行时校验错误，而是 `.opencode` 内部对 gate 使用场景的说明漂移：部分文档仍要求“所有任务必须先 gate”，与 `preflight-lite` v3 的 active path 和 dispatch-backed `task_id` 省略策略冲突。

**改了什么**:
- `work-one/.opencode/rules/common/common-project.md` — 将 gate 从“所有任务强制”改为“高风险/交付/跨 Agent/审计任务升级”
- `work-one/.opencode/rules/common/mcp-compliance-guide.md` — 将 gate checklist 改为条件触发，不再对普通任务默认阻塞
- `work-one/.opencode/commands/compliance-gate.md` — 将命令定位改为治理任务入口，而非所有任务前置
- `work-one/.opencode/scripts/mcp-tools/compliance-gate.ts` — 将 `compliance_gate_check` tool 描述改为 governed-task 用途
- `work-one/.opencode/service/dispatch/prompt-builder.ts` — 强化 dispatch-backed flow 省略 `task_id` 的说明，并移除 prompt 中的 `task_id` 展示
- `work-one/.opencode/service/dispatch/prompt-sections.ts` — combined gate 示例移除显式 `task_id`
- `work-one/.opencode/service/gate/checklist-phase.ts` — remediation 改回 plain `compliance_gate_check(task_description)`

**决策**: 问题2优先做口径统一而非扩展新逻辑。普通任务继续走 `preflight-lite`，gate 只作为治理路径升级；dispatch-backed flow 统一避免手传 `task_id`，为问题1的 L1/L2 修复提供一致协议。
