# 隔离 serve create release fail-closed

**为什么**: create 阶段 worktree/overlay 失败时，若 port reserver 无法确认退出，旧 catch 会在 release 抛错处中断，manifest 留在 CREATED 且现场状态漂移。

**改了什么**:
- `scripts/test-serve/types.ts` — 为 `CreateRunHooks` 增加仅测试用的 reservation release 注入点。
- `scripts/test-serve/run-context.ts` — release 成功才清 `portReserverPid` 并清理 worktree；release 失败先写 BLOCKED、保留 PID/worktree 和两类失败 note，再抛组合错误。
- `scripts/test-serve/__tests__/create-failure-cleanup.test.ts` — 新增真实 reservation + 注入 release failure 回归；finally 释放真实 reservation 并回收临时 run。
- `plans/隔离 serve 测试基建待办/01-bootstrap-child-grant-fail-closed实施步骤.md`、`documents/INDEX.md` — 同步 37/37 组件边界。

**验证**: 定向 create/run-context/process 测试 16/16 PASS；完整 `scripts/test-serve/__tests__` 37/37 PASS；Bun parse 与 `git diff --check` 通过。

**未执行**: runtime smoke 与 live LLM E2E。
