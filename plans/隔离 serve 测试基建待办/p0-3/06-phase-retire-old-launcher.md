# Phase P0-3-06: retire deprecated old launcher [OBSERVATION→VERIFICATION]

**Phase ID**: `P0-3-06`
**Depends on**: P0-3-05
**Outcome**: `_b_pt_wm_00r2_live.ts` is deleted only after live evidence, active-caller absence, and regression checks prove the manifest path is the sole execution path.
**Evidence level**: manual verification + component

## Goal

Close TSI-08 without broad script cleanup or deletion of retained runner and serve infrastructure.

## Starting state and dependency

PHASE-05 has reviewer-qualified evidence. The old file is still a deprecated shim and may remain while any active caller or incomplete live oracle exists.

## Local requirements

| ID | Fixed requirement | Observable result |
|---|---|---|
| REQ-326 | retain the file until every PHASE-05 gate passes | pre-delete receipt names reviewer evidence |
| REQ-327 | prove no active caller exists | static scan returns `NOT_FOUND` outside historical text |
| REQ-328 | delete only the shim | no other serve, runner, client, or skill file is removed |
| REQ-329 | rerun focused regression after deletion | selected test and typecheck commands pass |

## Allowed files

| Path | Anchor | Change |
|---|---|---|
| `scripts/_b_pt_wm_00r2_live.ts` | complete file | delete with `apply_patch` |
| `blueprints/blueprint-isolated-serve-test-infrastructure.md` | TSI-08 and completion standard | reviewer-qualified status update |
| `documents/INDEX.md` | blueprint summary | update current status wording |
| `logs/` | dated closure log | add deletion evidence log |

## Forbidden files and behaviors

- Do not delete `start-serve.ts`, `sse-daemon.ts`, `serve-api-client.ts`, G2/G3/G4 runners, skills, evidence bundles, or unrelated scripts.
- Do not delete when scan returns `FOUND`, `UNAVAILABLE`, or an incomplete PHASE-05 oracle.
- Do not use bulk removal, shell globs, or filesystem deletion commands.

## Fixed contract

1. Capture pre-delete scan output for active callers and PHASE-05 reviewer receipt locations.
2. Scan `scripts`, `e2e`, `.agents`, `.qoder`, and `.workbuddy`. The shim definition itself is excluded from the caller result; any other executable reference is `FOUND` and blocks deletion.
3. Delete exactly `scripts/_b_pt_wm_00r2_live.ts` using `apply_patch`.
4. Repeat the scan, run focused test-serve component tests and typecheck, then write the closure log after each text file passes its integrity check.
5. A scan with no caller is `NOT_FOUND`; a permission/read failure is `UNAVAILABLE` and blocks completion with `failedChecks`.

## Implementation steps

1. Complete the P0-3-06 Freeze Gate and verify PHASE-05 is reviewer-accepted.
2. Save pre-delete caller scan and verify every live oracle receipt is present.
3. Delete only the shim with `apply_patch`.
4. Run post-delete caller scan and focused regressions.
5. Update blueprint, index, and log in serial order; validate each write before the next.

## Check Registry

| Check | Command/result | Exact failure result |
|---|---|---|
| P03-R-01 | pre-delete active callers are `NOT_FOUND` | any executable caller is `FOUND` |
| P03-R-02 | old file is absent and retained runners remain present | old file present or retained file missing |
| P03-R-03 | focused regression and typecheck pass | test failure, type error, or diff error |

## All-pass Fixture

PHASE-05 evidence is complete, no active caller references the shim, deletion removes one path, and focused test-serve tests plus typecheck pass.

## Single-failure Matrix

| Mutation | Expected observation | Required retained evidence |
|---|---|---|
| scan finds an executable caller | `FOUND` and no deletion | pre-delete scan and `failedChecks` |
| scan cannot read one root | `UNAVAILABLE` and no deletion | command error and receipt |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork
rg -n '_b_pt_wm_00r2_live' scripts e2e .agents .qoder .workbuddy
test ! -e scripts/_b_pt_wm_00r2_live.ts
bun test scripts/test-serve/__tests__/run-context.test.ts scripts/test-serve/__tests__/execute.test.ts
bun run typecheck
git diff --check
```

PASS requires a post-delete `NOT_FOUND` caller result, exactly one deleted file, and zero focused regression or typecheck failures. This does not replace reviewer live-E2E evidence.

## Rollback/failure convergence

If a caller, test, or typecheck failure appears, restore only the shim through `apply_patch`, retain scan output, and report `BLOCKED` with `failedChecks`. Do not restore or alter unrelated files.

## Phase completion gate

- [ ] Freeze Gate and PHASE-05 reviewer receipt are present.
- [ ] P03-R-01, P03-R-02, and P03-R-03 pass.
- [ ] Blueprint and document index state TSI-08 with matching evidence level.
- [ ] Closure log lists the one deleted path and retained evidence roots.
