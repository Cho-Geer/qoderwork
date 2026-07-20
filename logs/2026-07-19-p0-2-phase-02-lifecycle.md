# P0-2 PHASE-02 生命周期与 cleanup verifier 完成

- 日期: 2026-07-19
- 需求: 按 `02-phase-verifier-lifecycle.md` 将 coexistence/after-stop-a/cleanup 改为 current observation + fail-closed。
- 改动文件 (3，均 Allowed):
  - `scripts/test-serve/verify-p02.ts`: 新增 processReader/markerReader 依赖与 default 实现；coexistence 增加 `aServeAliveCurrent/aSseAliveCurrent/aHealthCurrent/bServeAliveCurrent/bSseAliveCurrent/bHealthCurrent/aSseReadyValid/bSseReadyValid/sentinelAliveIdentity`；after-stop-a 增加 `aOldPidEvidenceAvailable/aOldServeExited/aOldSseExited/bServeAliveCurrent/bSseAliveCurrent/bHealthCurrent/bSseReadyValid/sentinelAliveIdentity`；cleanup 展开 framework DB/SDK DB/serve log/sse log/framework log dir/events 的 readable 检查与 reportReadable/reportSuccess 语义检查；`sentinelExited` 改为 `readable && !alive`。
  - `scripts/test-serve/types.ts`: 新增 `P02ProcessState/P02MarkerState`；`P02VerifyInput` 增加 `stoppedServePidA/stoppedSsePidA` 与 `readers.processReader/markerReader`。
  - `scripts/test-serve/__tests__/verify-p02.test.ts`: `setupCoexistence/setupCleanup` 补全 sse-ready 与 artifact fixture；新增每 current/cleanup check 单失败 mutation 与 P02-L-B-HEALTH/P02-L-OLD-PID/P02-L-REPORT/P02-L-SENTINEL 矩阵。
- 验证: `bun test scripts/test-serve/__tests__/verify-p02.test.ts` → 145 pass / 0 fail；`git diff --check` 通过；仅改动 3 个 Allowed 文件，`process.ts/run-context.ts/bootstrap.ts/oracle.ts` 未动。
- 已知: 根 `bun run typecheck` 仍有范围外既有错误（含 `RunManifest.rootDir` 类型缺口与 PHASE-01 reservation case），按 DEC-004 不阻断 PHASE-02；component 证据为 0 fail。
- 状态: PHASE-02 = DONE；PHASE-03 = READY。
