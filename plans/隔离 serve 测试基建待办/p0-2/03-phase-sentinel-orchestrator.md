# Phase PHASE-03: deterministic sentinel and dual-run orchestrator `[ANALYSIS → VERIFICATION]`

**Phase ID**: `PHASE-03`
**Depends on**: PHASE-02
**Outcome**: `runP02` 串行执行固定 16 stage，并在第一个失败处安全收敛。
**Evidence level**: component

## Goal

- 新建 P0-2 coordinator；不把业务逻辑加入 CLI，不运行真实 runtime。
- 涉及 sentinel、进程或 marker 的负向结论固定三态：`FOUND`、`NOT_FOUND`、`UNAVAILABLE`；仅 `NOT_FOUND` 可作为目标不存在的证明。

## Starting state and dependency

- PHASE-02 component gate 必须通过。
- 当前 `scripts/test-serve/` 不存在 `p02-sentinel.ts` 或 `p02-orchestrator.ts`。
- 依赖缺失：`BLOCKED`，不得修改 CLI。

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-001 | sentinel start | marker 与 `/proc` identity 均有效 | stage `start-sentinel` ok |
| REQ-002 | orchestration | 固定 16 stage 顺序 | stage JSON 完整 |
| REQ-003 | stage failure | 记录 firstFailure 后停止本 run process | 后续业务调用为 0 |
| REQ-004 | cleanup-a | B 当前五项仍真 | 否则失败于 `cleanup-a` |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `scripts/test-serve/p02-sentinel.ts` | add | module entry |
| `scripts/test-serve/p02-orchestrator.ts` | add | `P02_STAGES`, `runP02` |
| `scripts/test-serve/types.ts` | modify | P02 stage/result types; `RunManifest.rootDir?`（orchestrator 写入、verifier 读取的冗余顶层字段，属 P02 合同表面） |
| `scripts/test-serve/__tests__/p02-orchestrator.test.ts` | add | P02-O matrix |

## Forbidden files and behaviors

- 不修改 `process.ts`、`run-context.ts`、`bootstrap.ts`、`verify-p01b.ts`、`oracle.ts`。
- 不使用 sleep 假定 ready；失败时不调用 `cleanupRun`、不重试同一 run、不中止非本 run PID。

## Fixed contract

- `P02_STAGES`：`create-a,create-b,verify-reservations,start-sentinel,start-a,start-b,verify-coexistence,bootstrap-a,verify-attribution,stop-a,verify-after-stop-a,cleanup-a,stop-b,cleanup-b,stop-sentinel,verify-cleanup`。
- `runP02` 仅接受绝对 `primaryWorktree/mainFrameworkDbPath`、commit、不同有效 `portA/portB`、非空 testId。
- sentinel 环境变量固定 `QODERWORK_P0_2_SENTINEL_ID` 和绝对 marker path；marker 为 `{sentinelId,pid,readyAt}`。
- `bootstrap-a` 固定 root `build`、child `general`、allowedPaths 仅 A worktree；`stop-a` 前保存 A serve/SSE PID。
- 失败收敛：验证 marker + `/proc/{pid}/environ` identity 后 stop sentinel；再 stop B、stop A；每对象最多一次；不 cleanup。

## Implementation steps

```text
1. 定义 stage/result/firstFailure types 和原子 stage-results writer。
2. 实现 sentinel marker 写入、信号退出和 identity validator。
3. 实现 runP02 的固定 stage loop 与依赖注入。
4. 把五个 verifier stage 固定为 verifyP02 调用。
5. 在 cleanup-a 后重新观测 B process、health、marker 和 sentinel。
6. 用注入依赖覆盖 success、16 个 stage failure、identity mismatch、stop-once。
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| `stageOrder` | `P02_STAGES` | literal array compare | 16 names in order | mismatch | `stageOrder` |
| `sentinelIdentity` | marker + `/proc` | id/PID compare | exact match | unreadable/mismatch | `sentinelIdentity` |
| `firstFailure` | stage result | injected throw | exact stage/error | missing/wrong | `firstFailure` |
| `cleanupABIsolation` | B current readers | five reads | all true | any false | `cleanup-a` |
| `controlledStops` | injected stop spies | call count | at most once/object | excess/non-owned | `controlledStops` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| injected lifecycle deps | test doubles | create/start/bootstrap/stop/cleanup | deterministic loop |
| stage writer target | temp A artifacts dir | atomic JSON path | evidence persistence |
| sentinel reader | injected marker/proc data | matching id/PID | safe stop |
| B readers | injected current truth | five true checks | cleanup-a proof |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| P02-O-STAGE | all-pass | each stage throws once | `firstFailure` | exact stage | later calls 0 |
| P02-O-ID | all-pass | sentinel id differs | `sentinelIdentity` | exact singleton | stop sentinel 0 |
| P02-O-CLEANUP | all-pass | one B current value false | `cleanupABIsolation` | `cleanup-a` | stop B 0 |
| P02-O-STOP | failed stage | duplicate stop candidate | `controlledStops` | exact singleton | no cleanup |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork
/home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/verify-p02.test.ts scripts/test-serve/__tests__/p02-orchestrator.test.ts
git diff --check -- scripts/test-serve/p02-sentinel.ts scripts/test-serve/p02-orchestrator.ts scripts/test-serve/types.ts scripts/test-serve/__tests__/p02-orchestrator.test.ts
```

- Required output/artifacts: component output and stage JSON fixture paths.
- On non-zero/missing evidence: `BLOCKED`; preserve stage JSON; do not advance.

## Rollback/failure convergence

1. Revert only PHASE-03 allowed files.
2. Keep failed fixture and firstFailure evidence; do not invoke real cleanup.

## Phase completion gate

- [ ] PHASE-02 evidence is attached
- [ ] Exact 16-stage order and every stage failure have a sensitive failure boundary proving later business calls are 0 (D1 closed per audit-5: `P02-O-D1-FAILURE-BOUNDARY` + `-OK`; `assertNoBusinessAfterFailure` uses last `failure` marker as boundary)
- [ ] Sentinel signal errors fail closed; identity and stop-once contracts pass (D2 closed per audit-5: `P02-O-D2-SIGTERM-NONESRCH` + `validateSentinelIdentity three-state`; `stopSentinel` only swallows ESRCH, non-ESRCH signal errors fail-closed)
- [ ] Component command is 0 fail (186 pass / 0 fail per audit-5)
- [ ] PHASE-04 remains blocked until all boxes are checked
- [ ] P0-2 plan remains IN-PROGRESS (PHASE-03 DONE per audit-5; PLAN_SET validator requires ≥1 unchecked box per phase)
