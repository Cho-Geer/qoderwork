# TSI-04：child/grant bootstrap 闭环（实施中）

**为什么**: 原 bind-null 测试在 root HTTP 失败处提前结束，且 operational failure 会返回 exit 0；因此未能证明或强制 fail-closed 契约。

**改了什么**:
- `scripts/test-serve/bootstrap.ts` — canonical realpath 边界、测试依赖注入、阶段化失败记录、BLOCKED 后抛错；默认仍调用隔离 worktree 的生产 grant 服务。
- `scripts/test-serve/process.ts` — SIGKILL 后必须确认进程退出，才清 PID 和写 STOPPED。
- `scripts/test-serve/isolated-serve.ts` — BLOCKED cleanup 同时要求 PID 字段为 null 且 PID 文件不存在。
- `scripts/test-serve/__tests__/bootstrap.test.ts` — 覆盖真实生产模块+isolated SQLite bound oracle、bind-null、oracle mismatch、`..`/symlink 越界与残留 PID 文件拒绝 cleanup。
- `plans/隔离 serve 测试基建待办/01-bootstrap-child-grant-fail-closed实施步骤.md` — 状态更新为实施中。

**验证**: 指定组件测试 20/20 PASS；缺 `--child-agent` CLI exit=1，且未创建 `/tmp/no-run`。

**未执行**: child-session/import failure CLI 子进程用例、真实 create→start→bootstrap→stop→cleanup runtime smoke、live LLM E2E。
