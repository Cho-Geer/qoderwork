# Phase PHASE-01: fail-closed cross-run isolation verifier `[ANALYSIS → VERIFICATION]`

**Phase ID**: `PHASE-01`
**Depends on**: NONE
**Outcome**: `verifyP02` 能对 reservations 与 attribution 产生可诊断的三态隔离裁决。
**Evidence level**: component

## Goal

- 消除“缺失证据经 boolean 取反后通过”的路径；完成后仍不声明 runtime-smoke。

## Starting state and dependency

- 当前 `verifyP02` 对 SDK/framework/events/main 查询均使用 boolean oracle；缺文件与未找到均为 `false`。
- 当前测试为 44 pass / 0 fail / 83 expect；该结果不是三态隔离证明。
- 若固定测试失败：`BLOCKED`，不得打开 PHASE-02。

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-001 | DB/events 可读 | 返回 `FOUND/NOT_FOUND/UNAVAILABLE` | 缺失证据为 `UNAVAILABLE` |
| REQ-002 | reservations | 比较 19 个 `RunPaths` 字段和 containment | 每项有独立 check |
| REQ-003 | attribution | A 正向、B/main 对 A 负向、grant bound | 每项缺证据先失败 |
| REQ-004 | 失败 | 前置失败短路 | `failedChecks` 只含首个前置 |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `scripts/test-serve/verify-p02.ts` | modify | `verifyP02` 和本地只读 helpers |
| `scripts/test-serve/types.ts` | modify | `P02VerifyInput`、dependency types |
| `scripts/test-serve/__tests__/verify-p02.test.ts` | modify | P02-V fixtures/mutations |

## Forbidden files and behaviors

- 不修改 `oracle.ts` 的 public API；不向 SQLite、manifest、events 写入 verifier 数据。
- 不使用 `!sdkSessionExists`、`!sessionMapExists`、`!findSessionEvent` 作为负向 PASS。

## Fixed contract

- `P02VerifyInput` 增加可选只读 dependency，默认实现读取真实文件/进程；fixture 明确注入，不依赖宿主伪 PID。
- 在 `verify-p02.ts` 内部定义 `FOUND | NOT_FOUND | UNAVAILABLE`；DB 只有文件可读、readonly 打开、目标表存在且 query 成功后才可返回 `NOT_FOUND`。
- `RunPaths` 字段固定为 `rootDir,manifestPath,worktreeDir,dbDir,frameworkDbPath,opencodeDbPath,logsDir,frameworkLogDir,serveLogPath,sseLogPath,eventsDir,eventFilePath,sseReadyPath,archiveDir,pidsDir,servePidPath,ssePidPath,artifactsDir,cleanupReportPath`。
- `pathContainedA/B` 使用 `relative(resolve(root),resolve(candidate))`；`..`、`../`、绝对结果失败；存在路径追加 realpath 比较。
- reservation 检查固定为 `runIdDistinct`, `portDistinct`, 每字段 `pathDistinct.*`, `pathContainedA.*`, `pathContainedB.*`, `reservationPidDistinct`, `reservationPidAAlive`, `reservationPidBAlive`。
- attribution 按 A root/child/grant 非空、A evidence availability、A positive、B negative、main negative、`grantBoundTo(A framework DB, grantId, childSessionId)` 顺序短路。

## Implementation steps

```text
1. 为每种 DB/events 读取实现本地三态 helper，保留 oracle.ts 不变。
2. 将 reservations 替换为完整字段 distinct/containment registry。
3. 将 attribution 拆为 availability、positive、negative、grant-bound registry。
4. 建立完整 A/B/main fixture；每次仅破坏一个 evidence object 或字段。
5. 对每个 registry 项断言 ok=false、failedChecks 仅含该项、其余 checks 为 true。
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| `aSdkEvidenceAvailable` | A SDK DB | readonly `session` query | query succeeds | file/table/query failure | `aSdkEvidenceAvailable` |
| `bFrameworkNegative` | B framework DB | grant/session query | `NOT_FOUND` | `FOUND` or `UNAVAILABLE` | `bFrameworkNegative` |
| `mainFrameworkNegative` | main DB | A identifiers query | `NOT_FOUND` | `FOUND` or `UNAVAILABLE` | `mainFrameworkNegative` |
| `aGrantBound` | A framework DB | grant row | bound to A child | missing/wrong row | `aGrantBound` |
| `pathContainedA.*` | A `RunPaths` | resolved path test | contained | escaped/unreadable path | exact field check |
| `reservationPortAOwned` | `/proc` socket owner | inode/PID association | A reservation owns port | unavailable/wrong owner | `reservationPortAOwned` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| A/B manifests | fixture builder | distinct paths, ports, reservation PIDs | reservations |
| A SDK/framework/events | readonly-compatible files | root, child, bound grant | A positive |
| B/main DB/events | readable target stores | no A identifiers | negative proof |
| `/proc` reader dependency | injected reader | port-to-owned PID mapping | host-independent owner test |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| P02-V-DB-MISSING | all-pass | remove B SDK DB | `bSdkEvidenceAvailable` | `["bSdkEvidenceAvailable"]` | true |
| P02-V-NEG-FOUND | all-pass | insert A root in B DB | `bSdkNegative` | `["bSdkNegative"]` | true |
| P02-V-PATH | all-pass | B event path equals A path | `pathDistinct.eventFilePath` | exact singleton | true |
| P02-V-PORT | all-pass | owner PID differs | `reservationPortAOwned` | exact singleton | true |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork
/home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/oracle.test.ts scripts/test-serve/__tests__/verify-p02.test.ts
git diff --check -- scripts/test-serve/verify-p02.ts scripts/test-serve/types.ts scripts/test-serve/__tests__/verify-p02.test.ts
```

- Required output/artifacts: test output and scoped diff.
- On non-zero/missing evidence: `BLOCKED`; preserve fixture failure output; do not advance.

## Rollback/failure convergence

1. Revert only PHASE-01 allowed-file changes.
2. Do not weaken the registry or delete mutation cases.

## Phase completion gate

- [ ] Allowed-file diff only
- [ ] Every negative query distinguishes `FOUND/NOT_FOUND/UNAVAILABLE`
- [ ] Every registry item has one all-pass fixture and one singleton mutation
- [ ] Component command is 0 fail
- [ ] PHASE-02 remains blocked until all boxes are checked
