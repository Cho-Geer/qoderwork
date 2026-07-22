# Phase P0-3-04: isolated T-PT-052 mutation runner [ANALYSIS→VERIFICATION]

**Phase ID**: `P0-3-04`
**Depends on**: P0-3-03
**Outcome**: each T-PT-052 mutation is materialized only in a fresh run worktree before serve start, recorded with hashes, and observed by a non-stub manifest runner.
**Evidence level**: component

## Goal

Replace the current mutation-application stub with a fail-closed pre-start mutation contract. Live mutation verdicts remain reserved for PHASE-05.

## Starting state and dependency

PHASE-03 established real request recording. T-PT-052 currently lists eight mutations but does not apply one to an isolated run worktree.

## Local requirements

| ID | Fixed requirement | Observable result |
|---|---|---|
| REQ-317 | apply exactly one named mutation to one run worktree | preimage and postimage hashes are in the mutation artifact |
| REQ-318 | allow mutation only while manifest state is `WORKTREE_READY` | running or cleaned run rejects before file write |
| REQ-319 | use a fresh run for each mutation | no run contains more than one mutation ID |
| REQ-320 | make T-PT-052 observe real results | no mutation-application stub remains |

## Allowed files

| Path | Anchor | Change |
|---|---|---|
| `scripts/test-serve/types.ts` | mutation input and artifact types | add typed contract |
| `scripts/test-serve/mutation.ts` | new module | validate and apply one named mutation |
| `scripts/test-serve/isolated-serve.ts` | command switch and help | add pre-start `mutate` command |
| `scripts/_b_pt_wm_00r2_g3_t052.ts` | mutation application and evidence paths | replace stub with manifest observation reader |
| `scripts/test-serve/__tests__/mutation.test.ts` | new component test | cover apply, state, path, and repeat rejection |

## Forbidden files and behaviors

- Do not mutate the primary worktree, global DB, or a running serve process.
- Do not apply two mutations in one run, use shell interpolation, or erase a failed mutation diff.
- Do not treat a mutation checklist or dry-run marker as a killed-mutant result.

## Fixed contract

1. `test-serve mutate` accepts an absolute run directory and one enumerated T-PT-052 mutation ID.
2. It reads the manifest, requires `WORKTREE_READY`, resolves the target beneath `manifest.paths.worktreeDir`, records preimage SHA-256, performs one deterministic text replacement, records postimage SHA-256, and writes an artifact under `manifest.paths.artifactsDir`.
3. A mutation marker in the manifest artifact rejects a second call for that run ID. The command never edits the primary worktree.
4. `t052` reads the mutation artifact and live result records; it must not contain an apply stub, placeholder success, or default PASS.
5. Negative checks use `FOUND`, `NOT_FOUND`, and `UNAVAILABLE`. Any `FOUND` primary path, `UNAVAILABLE` hash, or repeated mutation fails with `failedChecks`.

## Implementation steps

1. Complete the P0-3-04 Freeze Gate before implementation.
2. Move the eight mutation definitions into a typed, enumerable contract shared by the CLI mutation module and T-PT-052 observer.
3. Implement the pre-start CLI command with state, realpath, source-hash, and marker guards.
4. Replace the T-PT-052 stub with a reader of the mutation artifact plus actual live oracle records.
5. Add component fixtures for one valid mutation, a running-state rejection, an outside-worktree rejection, and a duplicate mutation rejection.

## Check Registry

| Check | Command/result | Exact failure result |
|---|---|---|
| P03-052-01 | one valid mutation writes preimage and postimage hashes | missing artifact or unchanged hash |
| P03-052-02 | state and path guard reject before write | target changed after rejection |
| P03-052-03 | second mutation in the same run rejects | two mutation artifacts for one run |

## All-pass Fixture

Create one isolated temporary run in `WORKTREE_READY`, choose one enumerated mutation, apply it once, and assert its artifact names the run ID, mutation ID, target, preimage, and postimage.

## Single-failure Matrix

| Mutation | Expected observation | Required retained evidence |
|---|---|---|
| call `mutate` after start | `FAILED` before target write | manifest and `failedChecks` |
| choose a path outside worktree | `FOUND` path violation and rejection | realpath report and artifact |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork
bun test scripts/test-serve/__tests__/mutation.test.ts
bun run scripts/test-serve/isolated-serve.ts help
bun run typecheck
git diff --check
```

PASS requires the component suite to prove no primary-tree mutation, one mutation per run, and an artifact for every accepted mutation. This is component evidence only.

## Rollback/failure convergence

If hash, state, or path validation fails, keep the run root and mutation artifact, mark the phase `FAIL`, and do not run serve. Restore only the isolated worktree by normal cleanup after evidence preservation.

## Phase completion gate

- [ ] Freeze Gate receipt is present and approved.
- [ ] P03-052-01, P03-052-02, and P03-052-03 pass.
- [ ] T-PT-052 has no mutation-application stub.
- [ ] Evidence label remains component until PHASE-05.
