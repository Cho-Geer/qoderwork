# 2026-07-19 P0-2 PHASE-03 Sentinel/Orchestrator 返工实现

## Why
审计 `audits/p0-2/2026-07-19-phase-03-sentinel-orchestrator-audit.md` 判定 Rework：absolute-path / sentinel 三态 / stop-once 三个固定合同未闭环，且 16-stage 失败矩阵缺少「后续业务调用为 0」断言（D1–D8）。

## What
- `types.ts`：新增 `SentinelIdentityState`（`FOUND/NOT_FOUND/UNAVAILABLE`）；`validateSentinelIdentity` 依赖返回三态；`P02Result` 失败分支新增 `stages` ledger。
- `p02-sentinel.ts`：`validateSentinelIdentity` 返回三态（pid 缺失=NOT_FOUND，environ 不匹配=NOT_FOUND，marker 不可读/损坏=UNAVAILABLE，全通过=FOUND）；`stopSentinel` 仅 `=== "FOUND"` 时停止。
- `p02-orchestrator.ts`：`validateInput` 对 `primaryWorktree/mainFrameworkDbPath` 用 `node:path.isAbsolute` fail-closed；正常 `stop-a/stop-b/stop-sentinel` 成功后即置位 `stopped`（stop-once，覆盖晚期失败重复 stop）；失败返回 `stages`。
- `__tests__/p02-orchestrator.test.ts`：新增相对路径拒绝（dependency call count=0）、晚期失败 per-object stop 断言（cleanup-a/b、verify-cleanup）、三态单测、16-stage 失败前缀 ledger 断言、独立 dependency-call counter ledger（`callCeilingAfter`：6 业务 + 5 verify 计数 ≤ stage 上限，收敛 stop/stopSentinel 由 P02-O-STOP 单独记账）。

## Decision
- D8：`RunManifest.rootDir?` 为本 rework 新增（git blame 证实未提交新增），被 verify-p02.ts:317 读取。已扩展 PHASE-03 plan 的 types.ts anchor 显式纳入该字段，属 P02 合同表面，非范围越界。

## Docs updated
- 新增本日志。
- `plans/隔离 serve 测试基建待办/p0-2/00-plan-index.md`：PHASE-03 READY → REWORK → DONE（5 项 completion gate 全过），PHASE-04 仍 BLOCKED。

## Evidence
- `bun test verify-p02.test.ts p02-orchestrator.test.ts` → 177 pass / 0 fail / 4975 expect（exit 0；D4 counter ledger 新增 16×11=176 断言）。
- `git diff --check` 4 文件 → exit 0。
- `bun run typecheck` → exit 1，32 条错误全为范围外既有债务（`work-one/.opencode/service/*`、`scripts/_b_l3_012_repo_op_deny.ts`），PHASE-03 四文件路径 0 诊断。
- runtime-smoke / live-LLM-E2E：NOT-RUN（PHASE-03 不要求）。

## Closure
- 5 项 completion gate 复审全过：PHASE-02 evidence 已附；16-stage 顺序 + 每 stage 失败已测（含独立 counter ledger）；sentinel 三态 + stop-once 合同通过；component command 0 fail；PHASE-04 仍 BLOCKED。
- D4（counter ledger）与 D8（rootDir? anchor 扩展 + 日志更正）已闭环。
