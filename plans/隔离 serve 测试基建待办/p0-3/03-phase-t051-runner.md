# Phase P0-3-03: real T-PT-051 positive-path runner [ANALYSIS→VERIFICATION]

**Phase ID**: `P0-3-03`
**Depends on**: P0-3-02
**Outcome**: T-PT-051 replaces its live-step stub with manifest-derived real serve requests and emits one request/result record per oracle step.
**Evidence level**: component

## Goal

Make the T-PT-051 runner executable under reviewer authority; do not claim its live-E2E result until PHASE-05.

## Starting state and dependency

PHASE-02 established the manifest run-mode contract. `_b_pt_wm_00r2_g3_t051.ts` currently declares ten steps but contains a live-step stub, so its generated checklist is not a real request trace.

## Local requirements

| ID | Fixed requirement | Observable result |
|---|---|---|
| REQ-313 | issue each step through `serve-api-client` using the manifest endpoint | actual HTTP status and payload fields are recorded |
| REQ-314 | create and retain root, child, and unauthenticated session identities | records link every request to the run ID |
| REQ-315 | validate expected status and payload before the next step | first mismatch names the step in `failedChecks` |
| REQ-316 | enforce no silent fallback | request error, malformed payload, and timeout are failures |

## Allowed files

| Path | Anchor | Change |
|---|---|---|
| `scripts/_b_pt_wm_00r2_g3_t051.ts` | live-step executor and evidence writer | replace stub with real client calls |
| `scripts/test-serve/__tests__/t051-runner.test.ts` | new component test | verify request mapping and failure record shape |
| `scripts/lib/serve-api-client.ts` | only a missing typed operation used by T-PT-051 | add typed manifest-derived client helper |

## Forbidden files and behaviors

- Do not hardcode a port, event path, DB path, session ID, or worktree path.
- Do not mark an unexecuted step as passed, catch and discard a request error, or synthesize a successful response.
- Do not modify work-one source, authorization variables, or the old launcher in this Phase.

## Fixed contract

1. Read the run once with `readRunManifest`; build the client context from its port and paths.
2. Replace the stub with a dispatcher that executes the ten declared steps in order and records method, endpoint, status, expected value, observed value, session ID, and oracle IDs.
3. Build root, child, and unauthenticated sessions only through serve API calls; do not preseed DB state.
4. Stop at the first failed step, set `pass:false`, and write `failedChecks` containing `T-PT-051 step N`.
5. The negative step passes only for `NOT_FOUND` unsafe execution after a completed query. `FOUND` execution and `UNAVAILABLE` trace evidence fail the runner.

## Implementation steps

1. Complete the P0-3-03 Freeze Gate before editing runner code.
2. Map every declared endpoint to an existing typed client operation or add one minimal helper in `serve-api-client.ts`.
3. Replace the live-step stub with ordered real requests and explicit response assertions.
4. Write a component test that injects one complete fake HTTP transcript and one failing step-five transcript; assert the second transcript retains `failedChecks` and does not execute later steps.
5. Run fixed verification. Keep the code-phase label at component even when the runner compiles.

## Check Registry

| Check | Command/result | Exact failure result |
|---|---|---|
| P03-051-01 | ten-step transcript maps to ten result records | missing or fabricated record |
| P03-051-02 | one mismatch stops the sequence | later request observed after failure |
| P03-051-03 | unauthenticated write requires zero execution trace | `FOUND` executor entry or changed target |

## All-pass Fixture

Use a local component HTTP transcript with ten responses matching the declared T-PT-051 statuses and values. Assert ten completed records and four passing oracle summaries.

## Single-failure Matrix

| Mutation | Expected observation | Required retained evidence |
|---|---|---|
| step five returns 403 | step five fails and steps six through ten are absent | result artifact with `failedChecks` |
| unauthenticated trace is unavailable | phase fails as `UNAVAILABLE` | trace query output and result artifact |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork
bun test scripts/test-serve/__tests__/t051-runner.test.ts
bun run typecheck
git diff --check
```

PASS requires zero component failures, typecheck exit 0, and no fixed-path match in the runner. No live-E2E status changes occur in this Phase.

## Rollback/failure convergence

If a typed client operation cannot represent a declared step, retain the compiler or test failure and report `BLOCKED`. Do not restore a stub or create a mock PASS artifact.

## Phase completion gate

- [ ] Freeze Gate receipt is present and approved.
- [ ] P03-051-01, P03-051-02, and P03-051-03 pass.
- [ ] Runner records actual request fields when executed.
- [ ] Evidence label remains component until PHASE-05.
