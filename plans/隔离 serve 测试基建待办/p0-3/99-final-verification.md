# P0-3 隔离 Serve 剩余闭环 — Final Verification

## 7. Global verification and evidence

| Level | Phase | Command or receipt | Exact PASS condition | Evidence retained |
|---|---|---|---|---|
| component | P0-3-01 | run-context test, typecheck | legal/illegal/duplicate gates pass | test output and Freeze receipt |
| live-E2E | P0-3-02 | reviewer T-PT-046/047 runs | two `EXECUTED` artifacts and complete oracle fields | two independent run roots |
| component | P0-3-03 | T-PT-051 runner test | real request mapping and stop-on-failure pass | test output and source diff |
| component | P0-3-04 | mutation runner test | one mutation per run and no primary-tree write | test output and hash artifact |
| runtime-smoke + live-E2E | P0-3-05 | reviewer receipts | T-PT-046/047/051/052 verdicts are complete | raw requests, DB, trace, logs, events, cleanup |
| manual verification + component | P0-3-06 | caller scan and regressions | shim absent, caller `NOT_FOUND`, tests pass | scan output, diff, closure log |

### Evidence preservation

- Keep every manifest, framework DB, SDK DB, runner artifact, raw request/response, trace, event log, target hash, and cleanup report under its original run root.
- A failed run is evidence. Do not retry in place, overwrite its artifact, or delete it before reviewer disposition.
- `FOUND`, `NOT_FOUND`, and `UNAVAILABLE` must be visible in each negative-oracle receipt. `UNAVAILABLE` never satisfies a negative check.

### Evidence ceiling rule

- P0-3-01, P0-3-03, and P0-3-04 component PASS cannot close runtime-smoke or live-E2E requirements.
- P0-3-02 plan-only, dry-run, or historical artifacts cannot close TSI-05 or TSI-06.
- Only reviewer-owned P0-3-05 receipts may change the live test status.

## 8. Risks, failure convergence, and rollback

| Risk | Detection | Fixed convergence | Retained evidence |
|---|---|---|---|
| state guard blocks valid lifecycle | P0-3-01 component test | revert only Phase-01 edits and stop | failing test output |
| authorization absent | execute gate artifact | `BLOCKED`, no prompt | gate artifact |
| runner returns fabricated success | raw request mismatch | `FAIL`, retain run root | request/response and `failedChecks` |
| mutation reaches primary tree | realpath or hash check | stop before serve and retain artifact | path and hash report |
| old caller remains | static scan `FOUND` | do not delete shim | scan output |

## 9. Final completion gate

- [ ] P0-3-01 component contract is accepted with a v2.1 receipt, covering §5.1 all 5 items (state machine, duplicate run ID, manifest fields, PID identity, sse-daemon, H2 invariant).
- [ ] P0-3-02 has independent reviewer runs for T-PT-046 and T-PT-047.
- [ ] P0-3-03 and P0-3-04 remove their execution stubs with component evidence.
- [ ] P0-3-05 records reviewer verdicts for T-PT-046, T-PT-047, T-PT-051, and every T-PT-052 mutation.
- [ ] P0-3-06 deletes only the old shim after `NOT_FOUND` caller scan and regression PASS.
- [ ] Blueprint, test specification, document index, and closure log state the same evidence level.

**Final status rule**: any unchecked item keeps the isolated-serve blueprint `PARTIALLY IMPLEMENTED`; `DONE` is allowed only after the reviewer signs the live evidence and the old launcher deletion gate passes.
