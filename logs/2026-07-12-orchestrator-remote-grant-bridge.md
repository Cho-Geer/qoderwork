# Restore Orchestrator Remote Grant Bridge

**为什么**: Orchestrator 的远端推送路径在 Phase 2 收窄后断裂了。`dispatch_subagent` 普通路径被退休后，repo grant 仍只在旧 wrapper 链路创建/绑定；同时 `remote_repo_write` 没有可供 Orchestrator 调用的人工确认入口，导致 child 永远进不到 `safe_repo_push` 的可执行状态。

**改了什么**:
- `/home/zhaoge/workspace/opencode/work-one/.opencode/tools/dispatch_subagent.ts` — 仅对显式 privilege dispatch 重新开放 wrapper，并补暴露 `allowed_remotes` 参数。
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/repo/grants.ts` — 新增按 parent session 查找并确认最新 repo grant 的 helper，补确认审计 note。
- `/home/zhaoge/workspace/opencode/work-one/.opencode/tools/confirm_repo_grant.ts` — 新增 Orchestrator 专用 repo grant 确认工具。
- `/home/zhaoge/workspace/opencode/work-one/.opencode/agents/Orchestrator.md` / `opencode.json` / `.opencode/skills/dispatch-protocol/SKILL.md` — 明确 privilege-bearing child work 必须走 `dispatch_subagent`，remote write 在 `Task()` 前先 `confirm_repo_grant`。
- `/home/zhaoge/workspace/opencode/work-one/.opencode/tools/safe_repo_push.ts` 与 `safe_gh_*` — 更新阻断提示，指向新的确认链路；`.opencode/service/repo/__tests__/grants.test.ts` 增补 parent-session confirm 覆盖。

**决策**: 不恢复 `dispatch_subagent` 的普通路径，只把它恢复为“显式特权子任务”桥接器；human confirmation 也不做隐式自动放行，而是新增一等确认工具，让 Orchestrator 在用户明确授权后显式落审计并继续 `Task()`。
