# Phase PHASE-05: first real dual-run runtime test `[VERIFICATION]`

**Phase ID**: `PHASE-05`
**Depends on**: PHASE-04
**Outcome**: 一次真实双 run runtime test 产生持久、可读的隔离证据。
**Evidence level**: runtime-smoke

## Goal

- 在 reviewer 提供两端口后运行一次真实 `p0-2`；不发送 live prompt。
- 对 runtime artifact 的负向判断固定输出 `FOUND`、`NOT_FOUND`、`UNAVAILABLE`；`UNAVAILABLE` 立即 `BLOCKED`。

## Starting state and dependency

- PHASE-04 gate 必须通过；reviewer 已提供不同且当前未占用的 `P0_2_PORT_A/P0_2_PORT_B`。
- 当前 P0-2 runtime evidence 为 `NOT-RUN`。
- 缺端口或 PHASE-04 证据：`BLOCKED`，不得运行命令。

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-001 | runtime start | 真实 worktree/DB/serve/SSE | A/B manifests 可读 |
| REQ-002 | isolation | 16 stage 与 verifier checks | `ok:true,status:"PASS"` |
| REQ-003 | retention | 证据位于 persistent state root | DB/log/event/report 可读 |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `scripts/test-serve/__tests__/p02-runtime.test.ts` | add | one real runtime case |

## Forbidden files and behaviors

- 不 mock serve/SSE/worktree/bootstrap；不裸启动 serve；不设置 H2；不重试失败 run；不以 `/tmp` 作为唯一证据。

## Fixed contract

- `XDG_STATE_HOME=/home/zhaoge/.local/state/qoderwork`；`DRY_RUN` 保持默认。
- 测试调用 `runP02` 一次，读取 A/B manifest、stage results、cleanup report、DB、logs、events、marker。
- PASS：1 pass/0 fail、16 stage 全 ok、A/B evidence 可读、五组 checks 全真。
- FAIL：保留 failure run 和 firstFailure；不 cleanup/retry 失败现场。

## Implementation steps

```text
1. 添加一个不 mock 生产生命周期的 p02-runtime test。
2. 以 reviewer 两端口运行一次 runP02。
3. 读取并断言 A/B runtime artifacts 与 16 stage。
4. 失败时输出 run paths，不删除失败现场。
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| `runtimeResult` | runP02 result | JSON fields | PASS/ok true | missing/false | `runtimeResult` |
| `stageEvidence` | stage JSON | parse 16 stages | all ok | unreadable/failed | `stageEvidence` |
| `artifactRetention` | A/B paths | read artifacts | all readable | one missing | `artifactRetention` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| reviewer ports | reviewer input | two distinct free ports | real bind |
| persistent state root | environment | P0-2 run directories | retention |
| A/B run artifacts | production lifecycle | manifests/DB/logs/events/reports | runtime proof |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| P02-R-PORT | ready input | one occupied reviewer port | `runtimeResult` | BLOCKED | no second run |
| P02-R-ARTIFACT | completed run | unreadable stage path | `artifactRetention` | exact failure | preserved |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork
XDG_STATE_HOME=/home/zhaoge/.local/state/qoderwork P0_2_PORT_A="$P0_2_PORT_A" P0_2_PORT_B="$P0_2_PORT_B" /home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/p02-runtime.test.ts
```

- Required output/artifacts: test output and absolute A/B run paths.
- On non-zero/missing evidence: `BLOCKED`; preserve run directories; do not advance.

## Rollback/failure convergence

1. Do not delete failed runtime evidence.
2. Do not run a replacement test with the same run evidence.

## Phase completion gate

- [ ] PHASE-04 evidence is attached
- [ ] reviewer ports were supplied and distinct
- [ ] one runtime test is 1 pass / 0 fail
- [ ] A/B persistent artifacts are readable
- [ ] PHASE-06 remains blocked until all boxes are checked
