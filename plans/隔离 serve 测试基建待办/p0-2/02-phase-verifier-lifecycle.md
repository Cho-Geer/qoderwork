# Phase PHASE-02: current lifecycle and cleanup verifier `[ANALYSIS → VERIFICATION]`

**Phase ID**: `PHASE-02`
**Depends on**: PHASE-01
**Outcome**: coexistence、after-stop-a 和 cleanup 检查读取当前状态并 fail-closed。
**Evidence level**: component

## Goal

- 在不修改进程生命周期实现的前提下，令 verifier 明确证明 A/B/sentinel 当前状态与 cleanup 后证据可读性。

## Starting state and dependency

- PHASE-01 completion gate 必须有 component 证据。
- 当前代码仅验证 `sentinelAlive`、stage JSON 和 manifest 状态，未验证 B 当前 process/health，也未保留 stop 前 A PID。
- 依赖缺失时：`BLOCKED`，不得创建 coordinator。

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-001 | coexistence | A/B 各自读取 process、health、marker | 每端独立 singleton check |
| REQ-002 | after-stop-a | 旧 A PID 已退出且 B 仍存活 | current observation 证明 |
| REQ-003 | cleanup | A/B artifacts 与 cleanup report 可读 | 缺一项 FAIL |
| REQ-004 | sentinel | marker identity 和 PID 生命周期一致 | mismatch 不可通过 |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `scripts/test-serve/verify-p02.ts` | modify | coexistence/after-stop-a/cleanup |
| `scripts/test-serve/types.ts` | modify | old A PID and reader dependencies |
| `scripts/test-serve/__tests__/verify-p02.test.ts` | modify | P02-L fixtures/mutations |

## Forbidden files and behaviors

- 不修改 `process.ts`、`run-context.ts`、`bootstrap.ts`；不以 start-time snapshot 代替 current inspection。
- 不将 manifest 缺失、marker 缺失或 cleanup report 解析失败解释为 target absent。

## Fixed contract

- `after-stop-a` 输入固定要求 `stoppedServePidA` 与 `stoppedSsePidA` 非空；任一缺失为 `aOldPidEvidenceAvailable` FAIL。
- process reader 返回 A/B 的 `serveAlive,sseAlive,healthOk`；marker reader 验证 `runId,serveUrl,eventFile` 与 sentinel id/PID identity。
- coexistence 依次检查 `aReady,bReady,aStartChecks,bStartChecks,reserverAExited,reserverBExited,manifestReserverNull,serveSsePidDistinct,aServeAliveCurrent,aSseAliveCurrent,aHealthCurrent,bServeAliveCurrent,bSseAliveCurrent,bHealthCurrent,aSseReadyValid,bSseReadyValid,sentinelAliveIdentity`。
- after-stop-a 依次检查 A stopped/null PID/old PID exited，再检查 B ready/current process/current marker/sentinel identity。
- cleanup 读取 A/B manifest、worktree absent、framework DB、SDK DB、serve log、SSE log、framework log dir、events、cleanup report；report 需 `success === true && worktreeRemoved === true`；marker 必须可读且 sentinel PID 已退出。

## Implementation steps

```text
1. 添加 current process、marker identity 和 artifact readability reader dependencies。
2. 将 coexistence 与 after-stop-a 改为按固定顺序执行 singleton checks。
3. 将 cleanup 展开为每个 artifact 的 readable check 和 report semantic checks。
4. 用 complete fixture 覆盖 A/B marker、old PID、cleanup evidence。
5. 为每个 current/cleanup check 注入一个 false 或 unreadable mutation。
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| `bHealthCurrent` | B serve | injected current health | true now | reader false/error | `bHealthCurrent` |
| `aOldServeExited` | A old PID | current PID inspection | exited | absent/alive/error | `aOldServeExited` |
| `bSseReadyValid` | B marker | identity parse | exact fields | missing/mismatch | `bSseReadyValid` |
| `aCleanupReportSuccess` | A report | parse JSON | success/worktreeRemoved true | unreadable/false | `aCleanupReportSuccess` |
| `sentinelExited` | sentinel marker | PID inspection | marker readable and PID exited | missing/malformed/alive | `sentinelExited` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| current reader map | injected dependency | A/B process/health values | no host PID dependency |
| A old PIDs | injected dependency | exited identities | after-stop proof |
| A/B cleanup artifacts | fixture files | parsable reports, DB/log/event paths | cleanup proof |
| sentinel marker | parsable JSON | id, pid, run binding | identity lifecycle |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| P02-L-B-HEALTH | all-pass | B health false | `bHealthCurrent` | singleton | true |
| P02-L-OLD-PID | all-pass | A old serve PID alive | `aOldServeExited` | singleton | true |
| P02-L-REPORT | all-pass | B report malformed | `bCleanupReportReadable` | singleton | true |
| P02-L-SENTINEL | all-pass | marker id mismatch | `sentinelAliveIdentity` | singleton | true |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork
/home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/verify-p02.test.ts
git diff --check -- scripts/test-serve/verify-p02.ts scripts/test-serve/types.ts scripts/test-serve/__tests__/verify-p02.test.ts
```

- Required output/artifacts: test output and scoped diff.
- On non-zero/missing evidence: `BLOCKED`; preserve outputs; do not advance.

## Rollback/failure convergence

1. Revert only PHASE-02 allowed-file changes.
2. Do not remove current-observation checks to satisfy fixtures.

## Phase completion gate

- [ ] PHASE-01 evidence is attached
- [ ] Lifecycle and cleanup checks are singleton-tested
- [ ] Missing evidence always fails closed with named diagnostics
- [ ] Component command is 0 fail
- [ ] PHASE-03 remains blocked until all boxes are checked
