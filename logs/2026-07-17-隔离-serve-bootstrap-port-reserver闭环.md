# TSI-04 port reserver fail-closed 闭环

**为什么**: 审核发现 `releasePortReservation()` 在 SIGKILL 后未确认退出，`stopRunProcesses()` 仍可能清 PID 并写 STOPPED；另发现 overlay 校验失败可在释放前遗留 reserver。

**改了什么**:
- `scripts/test-serve/run-context.ts` — reservation 仅在 overlay 校验后创建；SIGTERM/SIGKILL 均须确认退出，否则抛错。
- `scripts/test-serve/process.ts` — reservation release 失败时保留 `portReserverPid`，不写 STOPPED；增加可控测试依赖。
- `scripts/test-serve/__tests__/process.test.ts` — 覆盖 SIGKILL 后仍存活和 STOPPED/PID 保留。
- `scripts/test-serve/__tests__/bootstrap.test.ts` — 补 child-session、production import、bind-null CLI exit=1 失败链。
- `scripts/test-serve/__tests__/create-failure-cleanup.test.ts` — 修正 overlay fixture 目录并验证校验失败不遗留端口。
- `plans/隔离 serve 测试基建待办/01-bootstrap-child-grant-fail-closed实施步骤.md`、`documents/INDEX.md` — 同步组件闭环与 runtime 边界。

**验证**: `TMPDIR=/tmp XDG_STATE_HOME=/tmp/qoderwork-tsi04 /home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__` 为 36/36 PASS；缺 `--child-agent` CLI exit=1 且未创建 `/tmp/no-run`；Bun parse 与 `git diff --check` 通过。

**未执行**: 真实 `create → start → bootstrap → execute(plan) → stop → cleanup` runtime smoke；live LLM E2E。
