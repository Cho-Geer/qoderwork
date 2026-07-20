# Phase PHASE-01: fail-closed cross-run isolation verifier rework `[ANALYSIS → VERIFICATION]`

**Phase ID**: `PHASE-01`
**Status**: `REWORK-REQUIRED`
**Depends on**: NONE
**Outcome**: `verifyP02` 给出三态、诊断、component证据。
**Evidence level**: component

## Goal

- 修复缺表误分类、malformed events 误作 `NOT_FOUND`、attribution 未短路和 mutation 缺失；不得声明 runtime-smoke。

## Starting state and dependency

- 当前 `dbAvailable()` 只验证文件可打开；缺表被报告为后续 negative 失败。
- 当前 `eventState()` 委托布尔 `findSessionEvent()`；malformed JSON 被吞掉后成为 `NOT_FOUND`。
- 当前 attribution 未在 `aRootNonEmpty` 失败后停止；`P02-V-*` 只有 10 个测试名（含 all-pass），不覆盖独立检查实例。
- 历史 45 pass / 0 fail / 65 expect 仅是回归基线，不是 PHASE-01 completion evidence。
- 任何固定验证非零或任一 contract test 失败：`BLOCKED`，不得打开 PHASE-02。

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-001 | DB/events negative read | 返回 `FOUND`、`NOT_FOUND` 或 `UNAVAILABLE` | 缺文件、缺表、query error、read error、malformed event 均不能成为 negative PASS |
| REQ-002 | reservations | 对 19 个 `RunPaths` 字段分别做 distinct、A containment、B containment | 57 个 field check name 和 57 个独立 Test ID 可追溯 |
| REQ-003 | attribution | A 正向、B/main 对 A 负向、grant binding 按固定顺序短路 | 首个失败是唯一 `failedChecks` 元素；后续 check key 不出现 |
| REQ-004 | mutation matrix | 每个实际检查实例从同一 all-pass fixture 只破坏一个对象/字段 | 88 个 case 各自断言 exact diagnostic |
| REQ-005 | phase provenance | 代码 diff 与状态/审计文档分别留证 | 代码 scope 不混入 plan/log；状态仅在 gate 后更新 |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `scripts/test-serve/verify-p02.ts` | modify | `queryTriState`、events parser、reservations、attribution；仅代码 scope |
| `scripts/test-serve/types.ts` | modify | `P02VerifyInput` 的 readonly reader types，仅在测试隔离需要时增加 |
| `scripts/test-serve/__tests__/verify-p02.test.ts` | modify | `setupP02V`、`P02-V-*` table-driven matrix |

## Evidence/status files — not implementation scope

| Exact path | Permitted timing | Required content |
|---|---|---|
| `plans/隔离 serve 测试基建待办/p0-2/00-plan-index.md` | after this Phase gate | `PHASE-01=DONE`, `PHASE-02=READY`, test summary |
| `logs/YYYY-MM-DD-p0-2-phase-01-rework.md` | after this Phase gate | ≤20 lines: code files, command result, status |

## Forbidden files and behaviors

- 不修改 `oracle.ts` public API、`process.ts`、`run-context.ts`、`bootstrap.ts`、`verify-p01b.ts`。
- verifier 不得写 SQLite、manifest 或 events；fixture 可以在测试开始前创建自己的临时 DB/events。
- 不使用 `!sdkSessionExists`、`!sessionMapExists`、`!findSessionEvent`、`!grantExists` 作为 negative PASS。
- 不修改 PHASE-02+ 文件；不在 component 通过前更新 index 为 `DONE/READY`。

## Fixed contract

- `TriState` 仅为 `FOUND | NOT_FOUND | UNAVAILABLE`。negative PASS 仅为 `evidenceReadable && querySucceeded && state === NOT_FOUND`。
- `queryTriState(dbPath, sql, params)`：缺 DB、readonly open、表、SQL、timeout 或 identifier 失败为 `UNAVAILABLE`；有 row 为 `FOUND`；无 row 为 `NOT_FOUND`。
- `dbEvidenceAvailable` 必须由对目标表的 readonly probe 得出；probe 返回 `UNAVAILABLE` 时，写 `*EvidenceAvailable`，不得继续同一 store 的 positive/negative check。
- `eventSessionState(eventFilePath, sessionId)` 直接逐行解析 JSONL：缺文件、read error、空 identifier、任意 nonblank malformed line 为 `UNAVAILABLE`；目标 session 为 `FOUND`；否则 `NOT_FOUND`。不得调用布尔 `findSessionEvent()`。
- reservations 按 `runIdDistinct`、`portDistinct`、`pathDistinct.{field}`、`pathContainedA.{field}`、`pathContainedB.{field}`、`reservationPidDistinct`、`reservationPidAAlive`、`reservationPidBAlive`、`reservationPortAOwned` 全量执行；fixture mutation 只使一个实际 check 为 false。
- attribution 唯一顺序为：`aRootNonEmpty`、`aChildNonEmpty`、`aGrantNonEmpty`、A SDK availability/positive、A framework availability/positive、A events availability/positive、B SDK availability/negative、B framework availability/negative、B events availability/negative、main framework availability/negative、`aGrantBound`。每一步失败立即 return；`failedChecks` 仅为该 check，后续 check key 不出现。

## Implementation steps

```text
1. 在 verify-p02.ts 中保留 oracle.ts 的 public API，改为本地 queryTriState 和 eventSessionState 作为唯一三态来源。
2. 用对 session、session_map、dispatch_privilege_grants 的 readonly probe 计算每个 EvidenceAvailable；probe UNAVAILABLE 时立即结束 attribution。
3. 让 attribution 使用固定顺序的 require-check helper；helper 记录一个 check 后失败即返回 P02VerificationResult。
4. 保留 RUN_PATH_FIELDS 的 19 字段 literal list；用三个 table-driven reservation case groups 生成 57 个 field mutation。
5. 在 verify-p02.test.ts 建立唯一 all-pass A/B/main fixture；每个 P02-V case 从新的 fixture 开始，应用一个 mutation，断言 exact failedChecks。
6. 在测试中断言 matrix case ID 唯一、负向 case 总数为 88、all-pass 使每个 reservations/attribution check 为 true。
7. 仅在固定验证全部通过后创建 phase rework log 并将 index 状态改为 DONE/READY。
```

## Check Registry

| Check family | Actual check names | Source of truth | PASS | Failure diagnostic |
|---|---|---|---|---|
| reservation identity | `runIdDistinct`,`portDistinct` | A/B manifests | both distinct | exact failed check |
| reservation paths | `pathDistinct.{field}` | A/B `RunPaths` | every field differs | exact field check |
| A containment | `pathContainedA.{field}` | A root/path | every field contained | exact field check |
| B containment | `pathContainedB.{field}` | B root/path | every field contained | exact field check |
| reservation PID/port | `reservationPidDistinct`,`reservationPidAAlive`,`reservationPidBAlive`,`reservationPortAOwned` | injected PID and port reader | exact ownership/liveness | exact failed check |
| A identity chain | `aRootNonEmpty`,`aChildNonEmpty`,`aGrantNonEmpty` | A manifest | all nonempty | first failed identity |
| A positive chain | six A availability/positive checks | A SDK/framework/events | probe then FOUND root+child | first failed check |
| B negative chain | six B availability/negative checks | B SDK/framework/events | probe then NOT_FOUND root+child | first failed check |
| main negative chain | `mainFrameworkEvidenceAvailable`,`mainFrameworkNegative` | main framework DB | probe then NOT_FOUND root+child+grant | first failed check |
| grant binding | `aGrantBound` | A framework DB | exact bound child | `aGrantBound` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| A/B manifests | new temp roots per case | distinct IDs, ports, all 19 contained paths, live reservation PIDs | reservations |
| A SDK DB | fixture SQLite | `session` table with root and child | A SDK positive |
| A framework DB | fixture SQLite | `session_map` root/child and bound grant row | A framework/grant positive |
| A events | valid JSONL | parseable root and child records | A events positive |
| B SDK/framework/events | fixture stores | target tables parseable; no A identifiers | B negatives |
| main framework DB | fixture SQLite | `session_map` and grant table; no A identifiers | main negative |
| port owner reader | injected readonly dependency | A port maps to reservationPidA | host-independent ownership |

## Single-failure Matrix

All rows start from a newly created all-pass fixture. Every case asserts `ok === false`, `failedChecks === [expected]`, `checks[expected] === false`; reservations assert every other check true, while attribution asserts every earlier check true and every later check key absent.

### Reservation identity and PID cases

| Test ID | Only mutation | Expected check |
|---|---|---|
| `P02-V-R-RUN-ID` | set B runId equal to A | `runIdDistinct` |
| `P02-V-R-PORT` | set B port equal to A | `portDistinct` |
| `P02-V-R-PID-DISTINCT` | set reservationPidB equal to A | `reservationPidDistinct` |
| `P02-V-R-PID-A-DEAD` | inject dead A PID | `reservationPidAAlive` |
| `P02-V-R-PID-B-DEAD` | inject dead B PID | `reservationPidBAlive` |
| `P02-V-R-PORT-OWNER` | port owner reader returns other PID | `reservationPortAOwned` |

### Exact 19-field path ledger

```text
FIELDS = [rootDir, manifestPath, worktreeDir, dbDir, frameworkDbPath,
  opencodeDbPath, logsDir, frameworkLogDir, serveLogPath, sseLogPath,
  eventsDir, eventFilePath, sseReadyPath, archiveDir, pidsDir,
  servePidPath, ssePidPath, artifactsDir, cleanupReportPath]

For every literal field F in FIELDS, generate exactly these rows:
P02-V-R-D-F: set only B paths.F = A paths.F; expect pathDistinct.F.
P02-V-R-A-F: replace only A paths.F with an existing symlink escaping A root; expect pathContainedA.F.
P02-V-R-B-F: replace only B paths.F with an existing symlink escaping B root; expect pathContainedB.F.
```

The test must assert `FIELDS.length === 19`, generated path case count `=== 57`, unique Test IDs, and exact generated check names.

### Attribution chain ledger

| Test ID | Only mutation | Expected check |
|---|---|---|
| `P02-V-A-ROOT` | clear A rootSessionId | `aRootNonEmpty` |
| `P02-V-A-CHILD` | clear A childSessionId | `aChildNonEmpty` |
| `P02-V-A-GRANT` | clear A grantId | `aGrantNonEmpty` |
| `P02-V-A-SDK-MISSING` | remove A SDK DB | `aSdkEvidenceAvailable` |
| `P02-V-A-SDK-TABLE` | remove A `session` table | `aSdkEvidenceAvailable` |
| `P02-V-A-SDK-POSITIVE` | remove A child session row | `aSdkPositive` |
| `P02-V-A-FW-MISSING` | remove A framework DB | `aFrameworkEvidenceAvailable` |
| `P02-V-A-FW-TABLE` | remove A `session_map` table | `aFrameworkEvidenceAvailable` |
| `P02-V-A-FW-POSITIVE` | remove A child map row | `aFrameworkPositive` |
| `P02-V-A-EVENT-MISSING` | remove A event file | `aEventsEvidenceAvailable` |
| `P02-V-A-EVENT-MALFORMED` | replace one A JSONL line with malformed JSON | `aEventsEvidenceAvailable` |
| `P02-V-A-EVENT-POSITIVE` | remove A child event | `aEventsPositive` |
| `P02-V-B-SDK-MISSING` | remove B SDK DB | `bSdkEvidenceAvailable` |
| `P02-V-B-SDK-TABLE` | remove B `session` table | `bSdkEvidenceAvailable` |
| `P02-V-B-SDK-FOUND` | insert A root into B SDK | `bSdkNegative` |
| `P02-V-B-FW-MISSING` | remove B framework DB | `bFrameworkEvidenceAvailable` |
| `P02-V-B-FW-TABLE` | remove B `session_map` table | `bFrameworkEvidenceAvailable` |
| `P02-V-B-FW-FOUND` | insert A root into B framework | `bFrameworkNegative` |
| `P02-V-B-EVENT-MISSING` | remove B event file | `bEventsEvidenceAvailable` |
| `P02-V-B-EVENT-MALFORMED` | replace one B JSONL line with malformed JSON | `bEventsEvidenceAvailable` |
| `P02-V-B-EVENT-FOUND` | insert A root event into B JSONL | `bEventsNegative` |
| `P02-V-MAIN-MISSING` | remove main framework DB | `mainFrameworkEvidenceAvailable` |
| `P02-V-MAIN-TABLE` | remove main `session_map` table | `mainFrameworkEvidenceAvailable` |
| `P02-V-MAIN-FOUND` | insert A root into main framework | `mainFrameworkNegative` |
| `P02-V-GRANT-WRONG` | bind A grant to another child | `aGrantBound` |

The 6 reservation identity/PID cases, 57 field cases, and 25 attribution cases total 88. The test calculates this count from the three tables and asserts 88; no hand-maintained case list.

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork
/home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/oracle.test.ts scripts/test-serve/__tests__/verify-p02.test.ts
git diff --check -- scripts/test-serve/verify-p02.ts scripts/test-serve/types.ts scripts/test-serve/__tests__/verify-p02.test.ts
git diff --name-only -- scripts/test-serve/verify-p02.ts scripts/test-serve/types.ts scripts/test-serve/__tests__/verify-p02.test.ts
```

- Expected evidence level: component.
- Required output/artifacts: test summary, `P02-V-ALL` result, 88 negative case names/results, and the three-path scoped diff output.
- PASS condition: 0 fail; every generated case has the declared Test ID; all-pass has every registered check true; each negative case has the exact singleton diagnostic contract above.
- On non-zero, absent case, duplicate Test ID, unexpected check, or missing artifact: `BLOCKED`; retain first-failure output; do not update index status or start PHASE-02.

## Rollback/failure convergence

1. Revert only the three Allowed implementation files from the current PHASE-01 rework; preserve failing test output and the audit log.
2. Do not weaken a check, delete a case, convert `UNAVAILABLE` to `NOT_FOUND`, or edit PHASE-02 to bypass the gate.

## Phase completion gate

- [ ] Scoped code diff contains only the three Allowed implementation files.
- [ ] DB and event readers implement the exact three-state contract.
- [ ] Attribution returns at the first failed prerequisite with exact diagnostics.
- [ ] `RUN_PATH_FIELDS` has the literal 19-field ledger and all 57 field cases.
- [ ] All 88 negative cases and `P02-V-ALL` pass the declared assertions.
- [ ] Fixed verification is 0 fail at component level.
- [ ] Status evidence log exists before index changes.
- [ ] PHASE-02 remains `BLOCKED` until every box is checked.
