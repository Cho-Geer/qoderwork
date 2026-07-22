# Phase P0-3-05: reviewer live evidence and status adjudication [VERIFICATION→OBSERVATION]

**Phase ID**: `P0-3-05`
**Depends on**: P0-3-04
**Outcome**: reviewer-owned runs produce independent, complete evidence for T-PT-046, T-PT-047, T-PT-051, and each T-PT-052 mutation before any blueprint completion label changes.
**Evidence level**: runtime-smoke + live-E2E

## Goal

Execute the implemented runners under the only permitted authorization path and classify each test by its observed oracle result.

## Starting state and dependency

PHASE-01 through PHASE-04 code changes are accepted at component level. The test specification still marks T-PT-046, T-PT-047, T-PT-051, and T-PT-052 `BLOCKED`; T-PT-048, T-PT-049, and T-PT-050 PASS receipts are mandatory before the T-PT-051/052 runs.

## Local requirements

| ID | Fixed requirement | Observable result |
|---|---|---|
| REQ-321 | reviewer owns H2 and dry-run gate | inherited environment proves authorization without agent export |
| REQ-322 | every test ID uses an independent run ID | manifest test ID and evidence root agree |
| REQ-323 | T-PT-051 proves root/child positive and unauthenticated negative paths | requests, DB state, trace, and target diff agree |
| REQ-324 | each T-PT-052 mutation uses a fresh worktree and cold serve start | mutation artifact and cleanup report are unique |
| REQ-325 | result labels match complete oracle evidence | PASS, FAIL, or BLOCKED is traceable |

## Allowed files

| Path | Anchor | Change |
|---|---|---|
| `e2e/permission-template-enforcement-test-spec.md` | T-PT-046 to T-PT-052 rows | reviewer-only status update |
| `blueprints/blueprint-isolated-serve-test-infrastructure.md` | §5.3 and §5.4 | evidence-qualified status update |
| `logs/` | dated reviewer receipt log | add retained evidence index |
| `e2e-evidence/` | T-PT evidence directory | add run-ID receipts and hashes |

## Forbidden files and behaviors

- Do not have an agent set authorization variables or convert an absent gate into a plan-only PASS.
- Do not combine test IDs or mutation IDs in one run, reuse an evidence directory, or discard a failed run.
- Do not update a reviewer-only checkbox from static source or component output.

## Fixed contract

1. Reviewer provides H2 authorization and disabled dry-run only to the runner process. Missing authorization yields `BLOCKED` before prompt creation.
2. Run T-PT-046, T-PT-047, and T-PT-051 in distinct fresh manifest roots. Collect request/response, session identity, framework DB, SDK DB, event/log, executor trace, target hash, and cleanup report.
3. Before T-PT-051 and T-PT-052, verify retained PASS evidence for T-PT-048, T-PT-049, and T-PT-050 at the same code commit. Current status: all three NOT-RUN (dry-run only). If PASS evidence is absent, T-PT-051/052 live execution is BLOCKED. T-PT-048/049/050 runners exist as dry-run stubs and require independent live execution under reviewer H2 authorization before T-PT-051/052 can proceed.
4. For each of the eight T-PT-052 mutations, create a fresh run, call `test-serve mutate` while `WORKTREE_READY`, start and bootstrap, execute the observer, stop, and cleanup.
5. A negative oracle passes only with `NOT_FOUND` execution and a completed trace query. `FOUND`, `UNAVAILABLE`, missing raw response, or mismatched code commit causes `FAIL` with `failedChecks`.

## Implementation steps

1. Complete P0-3-05 Freeze Gate and confirm reviewer authorization before any live action.
2. Record the work-one commit and calculate SHA-256 for the three copied skill/reference pairs before the first run.
3. Execute independent runs in order: T-PT-046, T-PT-047, T-PT-051, then eight T-PT-052 mutation runs.
4. After every run, preserve artifacts and stop at the first incomplete oracle. Do not execute the next test ID after a failure.
5. Reviewer signs the evidence matrix, then updates only the matching blueprint and specification rows.

## Check Registry

| Check | Command/result | Exact failure result |
|---|---|---|
| P03-L-01 | T-PT-046/047 artifacts have independent run IDs | shared run ID or dry-run marker |
| P03-L-02 | T-PT-051 has ten request records and four resolved oracles | missing step, `FOUND` unsafe execution, or `UNAVAILABLE` trace |
| P03-L-03 | each mutation run records one ID and a cleanup report | repeat mutation, missing hash, or missing cleanup |
| P03-L-04 | evidence code commit equals reviewer-recorded commit | commit mismatch |

## All-pass Fixture

Reviewer runs one fresh test root for each test ID and mutation. Every raw response and oracle is present, every unauthorized path has zero executor entry, allowed path change is confined to its grant, and each cleanup report succeeds.

## Single-failure Matrix

| Mutation | Expected observation | Required retained evidence |
|---|---|---|
| remove reviewer authorization | `BLOCKED` and no prompt | gate artifact |
| one mutation survives | `FOUND` survivor and phase `FAIL` | mutation artifact, trace, target hash, `failedChecks` |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork
rg -n 'T-PT-048|T-PT-049|T-PT-050' e2e-evidence audits
rg -n 'H2_AUTHORIZED|DRY_RUN|runId|testId|failedChecks' e2e-evidence audits
rg -n '_b_pt_wm_00r2_live' scripts e2e .agents .qoder .workbuddy
```

PASS requires reviewer-signed receipts for every listed test ID, separate run IDs, complete raw artifacts, and zero unresolved oracle fields. This Phase is the only source of runtime-smoke and live-E2E closure evidence.

## Rollback/failure convergence

On a failed live oracle, stop only the run-owned processes, preserve its run root, leave blueprint checkboxes unchanged, and report `FAIL` with `failedChecks`. Do not retry in place or reuse a run ID.

## Phase completion gate

- [ ] Freeze Gate and reviewer authorization are recorded.
- [ ] P03-L-01, P03-L-02, P03-L-03, and P03-L-04 pass.
- [ ] Reviewer updates T-PT-046, T-PT-047, T-PT-051, and T-PT-052 statuses from retained evidence.
- [ ] Blueprint live-E2E wording matches the reviewer verdict.
