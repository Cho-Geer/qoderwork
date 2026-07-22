# Phase P0-3-02: manifest run-mode and skill evidence [VERIFICATION→OBSERVATION]

**Phase ID**: `P0-3-02`
**Depends on**: P0-3-01
**Outcome**: two reviewer-authorized manifest runs record T-PT-046 and T-PT-047 independently through `isolated-serve-test`, each with start, bootstrap, runner, stop, and cleanup evidence tied to its own run ID.
**Evidence level**: live-E2E

## Goal

Close the TSI-05 run-mode and TSI-06 skill-evidence gaps without treating a plan-only artifact as a live result.

## Starting state and dependency

PHASE-01 component contract is accepted. The current `executeRun` gate refuses live execution unless the reviewer process supplies H2 authorization, disabled dry-run, and a bootstrapped manifest.

## Local requirements

| ID | Fixed requirement | Observable result |
|---|---|---|
| REQ-309 | use only `test-serve` lifecycle commands | manifest records one isolated root, DB pair, logs, and events |
| REQ-310 | invoke the manifest runner only through `execute --mode live` | execute artifact says `EXECUTED`, not `NOT-RUN` |
| REQ-311 | preserve T-PT-046 and T-PT-047 observations | request, session, oracle, DB, and event artifacts share one run ID |
| REQ-312 | stop and cleanup through the CLI | cleanup report is readable and does not delete evidence bundle |

## Allowed files

| Path | Anchor | Change |
|---|---|---|
| `scripts/_b_pt_wm_00r2_live_e2e.ts` | manifest runner | no code change unless its current contract fails a real request |
| `e2e/permission-template-enforcement-test-spec.md` | T-PT-046, T-PT-047 rows | reviewer-only evidence status update |
| `blueprints/blueprint-isolated-serve-test-infrastructure.md` | TSI-05, TSI-06 | reviewer-qualified status update |
| `logs/` | dated receipt log | add one concise evidence log |

## Forbidden files and behaviors

- Do not export, write, forward, or fabricate `H2_AUTHORIZED=true` or `DRY_RUN=false`.
- Do not start bare serve, use a fixed event file, access the main DB, or use the old launcher.
- Do not mark PASS when the artifact says `NOT-RUN`, contains dry-run data, or lacks raw request and oracle output.

## Fixed contract

1. A human reviewer starts the executing process with H2 authorization and disabled dry-run. The agent only reads the inherited environment at execution time.
2. Create the run from the current clean work-one commit and obtain `RUN_DIR` from the create JSON result.
3. Use the copied `isolated-serve-test` workflow for each test ID: admit, create, start, bootstrap, execute, collect, stop, cleanup.
4. Execute `/home/zhaoge/workspace/qoderwork/scripts/_b_pt_wm_00r2_live_e2e.ts` through the CLI. The runner receives `--run-dir` from `executeRun` and reads endpoint, DB, session, and event paths from the manifest.
5. Every negative observation uses `FOUND`, `NOT_FOUND`, or `UNAVAILABLE`. A `FOUND` unsafe execution, `UNAVAILABLE` oracle, or missing artifact is `FAIL` with `failedChecks`.

## Implementation steps

1. Complete the P0-3-02 Freeze Gate; verify scope-lock and pre-change receipt before changing any evidence status.
2. Reviewer confirms H2 authorization, disabled dry-run, and an unused port. If any is absent, record `BLOCKED` and stop before create.
3. Run the fixed lifecycle once for T-PT-046 and once for T-PT-047; do not reuse a run directory or port.
4. Inspect manifest, both DB files, event file, runner artifact, raw session output, and cleanup report. Preserve the whole run root.
5. Reviewer compares observed T-PT-046/047 oracle values against the test specification before changing a status row.

## Check Registry

| Check | Command/result | Exact failure result |
|---|---|---|
| P03-R-01 | live execute returns `EXECUTED` | `NOT-RUN`, nonzero runner exit, or missing artifact |
| P03-R-02 | each collected path is within `RUN_DIR` | `FOUND` main path or `UNAVAILABLE` path |
| P03-R-03 | negative tool path has zero executor entry and unchanged target | nonzero executor entry or changed target |

## All-pass Fixture

The reviewer supplies authorization and two unused ports. Each new run creates root and child sessions, the runner records its observation, and cleanup leaves each evidence bundle readable.

## Single-failure Matrix

| Mutation | Expected observation | Required retained evidence |
|---|---|---|
| reviewer gate absent | `NOT-RUN` with gate reason | execute artifact |
| unauthenticated write reaches executor | `FOUND` and phase `FAIL` | request, trace, target hash, `failedChecks` |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork
COMMIT="$(git -C /home/zhaoge/workspace/opencode/work-one rev-parse HEAD)"
for TEST_ID in T-PT-046 T-PT-047; do
  if [ "$TEST_ID" = T-PT-046 ]; then PORT=4101; else PORT=4102; fi
  CREATE_JSON="$(bun run scripts/test-serve/isolated-serve.ts create --primary-worktree /home/zhaoge/workspace/opencode/work-one --commit "$COMMIT" --port "$PORT" --test-id "$TEST_ID")"
  RUN_DIR="$(printf '%s' "$CREATE_JSON" | jq -r '.rootDir')"
  bun run scripts/test-serve/isolated-serve.ts start --run-dir "$RUN_DIR"
  mkdir -p "$RUN_DIR/worktree/.task_temp"
  : > "$RUN_DIR/worktree/.task_temp/p0-3-live-fixture.txt"
  bun run scripts/test-serve/isolated-serve.ts bootstrap --run-dir "$RUN_DIR" --root-agent build --child-agent build --allowed-paths "$RUN_DIR/worktree/.task_temp/p0-3-live-fixture.txt"
  bun run scripts/test-serve/isolated-serve.ts execute --run-dir "$RUN_DIR" --mode live --runner /home/zhaoge/workspace/qoderwork/scripts/_b_pt_wm_00r2_live_e2e.ts
  bun run scripts/test-serve/isolated-serve.ts stop --run-dir "$RUN_DIR"
  bun run scripts/test-serve/isolated-serve.ts cleanup --run-dir "$RUN_DIR"
done
```

PASS requires an `EXECUTED` artifact, complete T-PT-046/047 oracle fields, no dry-run marker, and a successful cleanup report. This is live-E2E evidence.

## Rollback/failure convergence

On any runner, oracle, or cleanup failure, do not change test or blueprint PASS labels. Stop only the manifest-owned processes, retain the run root, and report `BLOCKED` or `FAIL` with `failedChecks`.

## Phase completion gate

- [ ] Freeze Gate and reviewer authorization are recorded.
- [ ] P03-R-01, P03-R-02, and P03-R-03 pass.
- [ ] T-PT-046 and T-PT-047 have reviewer-qualified artifacts.
- [ ] Skill workflow and cleanup evidence reference the same run ID.
