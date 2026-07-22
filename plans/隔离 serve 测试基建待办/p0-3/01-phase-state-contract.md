# Phase P0-3-01: run-state and duplicate-ID contract [ANALYSIS→VERIFICATION]

**Phase ID**: `P0-3-01`
**Depends on**: NONE
**Outcome**: `setRunState` rejects illegal transitions before writing, `createRunContext` rejects an existing deterministic run root without reserving a port, manifest fields are fully asserted, PID identity check is tested, sse-daemon FRAMEWORK_DB_PATH is tested, and H2_AUTHORIZED never-written invariant is verified.
**Evidence level**: component

## Goal

Close TSI-01 without changing serve, bootstrap, or work-one behavior.

## Starting state and dependency

`setRunState` directly assigns `manifest.status`; `createRunContext` generates an ID then creates its root. No prior Phase is required.

## Local requirements

| ID | Fixed requirement | Observable result |
|---|---|---|
| REQ-301 | validate every state transition before mutation or manifest write | illegal transition throws with source and target states |
| REQ-302 | permit the documented lifecycle and transition to failure states | legal lifecycle remains executable |
| REQ-303 | derive the run ID before port reservation and reject an existing root | duplicate test factory throws and never acquires a reservation |
| REQ-304 | retain atomic manifest replacement | successful state write still uses `writeRunManifest` |
| REQ-305 | assert manifest fields (port, patchSha256, absolute paths) are written correctly | manifest contains all expected fields with correct values |
| REQ-306 | PID identity check rejects killing processes not belonging to this run | mismatched QODERWORK_TEST_RUN_ID throws before kill |
| REQ-307 | sse-daemon uses FRAMEWORK_DB_PATH and throws when missing | missing env var causes immediate error, no hardcoded DB path |
| REQ-308 | H2_AUTHORIZED is never written by infrastructure or skill code | static scan finds zero assignments to process.env.H2_AUTHORIZED |

## Allowed files

| Path | Anchor | Change |
|---|---|---|
| `scripts/test-serve/types.ts` | `CreateRunHooks` | add optional test-only run-ID factory type |
| `scripts/test-serve/run-context.ts` | `setRunState`, `createRunContext` | add transition table and root-existence guard |
| `scripts/test-serve/__tests__/run-context.test.ts` | `describe("run-context")` | add legal, illegal, and duplicate-root tests |
| `scripts/test-serve/process.ts` | `validateRunProcess` | add test-only export if needed; no production behavior change |
| `scripts/test-serve/__tests__/process.test.ts` | `describe("process")` | add PID mismatch rejection test |
| `scripts/sse-daemon.ts` | read-only verification | confirm FRAMEWORK_DB_PATH usage; no code change needed |
| `scripts/test-serve/__tests__/sse-daemon.test.ts` | `describe("sse-daemon")` | add FRAMEWORK_DB_PATH missing-throw test |

## Forbidden files and behaviors

- Do not modify `process.ts`, `bootstrap.ts`, `execute.ts`, work-one code, or CLI arguments.
- Do not suppress a rejection, silently overwrite an existing root, or delete an existing run directory.
- Do not change a state after a failed guard; the manifest must retain its prior value.

## Fixed contract

1. Define the transition table beside `setRunState`. `CREATED` may move to `WORKTREE_READY` or `BLOCKED`; lifecycle states may move to their documented successor or `BLOCKED`; `STOPPED` may move to `CLEANED` or `BLOCKED`; `CLEANED` and `BLOCKED` are terminal.
2. `setRunState` checks the table before assignment and throws `illegal run state transition: SOURCE -> TARGET` on rejection.
3. Add `makeRunId` to `CreateRunHooks` only for deterministic component tests. Production continues to call the existing random generator.
4. In `createRunContext`, validate overlay, derive the run ID, create paths, check `existsSync(paths.rootDir)`, then reserve the port. A present root throws `run id already exists: RUN_ID` before any directory or port mutation.
5. Negative checks report `FOUND`, `NOT_FOUND`, or `UNAVAILABLE`; unexpected state or filesystem errors append the exact check name to `failedChecks` in the test diagnostic.

## Implementation steps

1. Complete the v2.1 Freeze Gate for P0-3-01 and verify its receipt is nonempty.
2. Add the hook type and transition table without widening production CLI input.
3. Route every state change owned by `run-context.ts` through the guarded setter.
4. Add one legal lifecycle assertion, one terminal-to-active rejection assertion, one backward-transition rejection assertion, and one existing-root rejection assertion using the test hook.
5. Run the fixed verification commands. On failure, retain output and stop this Phase.

## Check Registry

| Check | Command/result | Exact failure result |
|---|---|---|
| P03-S-01 | legal state sequence writes expected manifest status | `failedChecks` names transition mismatch |
| P03-S-02 | terminal or backward transition throws before write | manifest status changed or no error |
| P03-S-03 | pre-created root rejects before reservation | root overwritten or reservation created |
| P03-S-04 | manifest has port, patchSha256, and absolute paths | missing field or non-absolute path |
| P03-S-05 | foreign PID rejected by validateRunProcess | PID killed or no error thrown |
| P03-S-06 | sse-daemon throws when FRAMEWORK_DB_PATH missing | daemon starts without error or uses hardcoded path |
| P03-S-07 | rg finds zero H2_AUTHORIZED assignments in infra/skill | assignment found |

## All-pass Fixture

Use a fresh temporary git repository and a run ID produced by the default generator. Assert `CREATED -> WORKTREE_READY`, then clean up only the fixture run.

## Single-failure Matrix

| Mutation | Expected observation | Required retained evidence |
|---|---|---|
| call `setRunState` from `CLEANED` to `READY` | throw, old manifest remains `CLEANED` | test output with `failedChecks` |
| hook returns an existing run ID | throw before port reservation | root path and reservation assertion |
| manifest missing port field | P03-S-04 fails with field name | test output |
| foreign PID passed to stopRunProcesses | P03-S-05 fails, PID not killed | test output with failedChecks |
| sse-daemon without FRAMEWORK_DB_PATH | P03-S-06 fails, no error thrown | test output |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork
bun test scripts/test-serve/__tests__/run-context.test.ts scripts/test-serve/__tests__/process.test.ts scripts/test-serve/__tests__/sse-daemon.test.ts
bun run typecheck
git diff --check
rg -n 'process\.env\.H2_AUTHORIZED\s*=' scripts/test-serve/ .agents/skills/isolated-serve-test/ .qoder/skills/isolated-serve-test/ .trae/skills/isolated-serve-test/ .workbuddy/skills/isolated-serve-test/
```

The last rg command should return zero matches (no assignments to H2_AUTHORIZED).

PASS requires zero test failures, typecheck exit 0, and a clean diff check. This is component evidence only.

## Rollback/failure convergence

If a new guard blocks a currently valid lifecycle test, revert only the P0-3-01 code edits, retain the failing output, and report `BLOCKED`. Never delete a pre-existing run root to make the duplicate test pass.

## Phase completion gate

- [ ] Freeze Gate receipt is present and approved.
- [ ] P03-S-01, P03-S-02, and P03-S-03 pass.
- [ ] P03-S-04, P03-S-05, P03-S-06, and P03-S-07 pass.
- [ ] Fixed verification passes at component level.
- [ ] Blueprint status is updated only with the component evidence ceiling.
