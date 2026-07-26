# 路径动态化与跨平台配置收敛 M1 — Final Verification

## 7. Global verification and evidence

| Level | Command | Preconditions | Exact PASS condition | Artifacts | Current status |
|---|---|---|---|---|---|
| plan structure | `bun run .../validate-plan.ts plans/path-dynamic-resolution-m1` | each plan file exists | exit 0 with no errors | validator JSON | run while authoring |
| manual freeze | PHASE-01 fixed commands | human-approved lock and clean work-one | inventory, lock, and receipt parse | scan JSONL, inventory, receipt | NOT-RUN |
| component | PHASE-02 and PHASE-03 fixed test commands | accepted prior phase and its receipt | named tests plus typecheck exit 0 | test output and audit receipts | NOT-RUN |
| runtime-smoke | successor isolated-serve lifecycle | approved successor scope and a unique available port | plan-mode run retains manifest, dual DB paths, SSE, PIDs, cleanup result | isolated run directory | NOT-RUN |
| live-E2E | reviewer-created authorized run | reviewer independently provides authorization and non-dry-run setting | retained real-model evidence | reviewer evidence package | NOT-RUN |

### Evidence preservation

- Keep phase scope locks, pre-change receipts, component outputs, audit reports, continuation register, and validator JSON below `audits/path-dynamic-resolution-m1/`.
- An isolated runtime run is retained by its own `test-serve` run directory. Cleanup evidence is read after cleanup; a start log alone cannot prove post-cleanup state.

### Evidence ceiling rule

- Static plan inspection is analysis only. A Bun component result is component only. A real isolated lifecycle is runtime-smoke only. A reviewer-authorized real-model workflow is live-E2E only.
- `FOUND / NOT_FOUND / UNAVAILABLE` applies to negative evidence in each Phase; `UNAVAILABLE` fails closed.

## 8. Risks, failure convergence, and rollback

| Risk | Trigger | Detection | Fixed convergence | Evidence retained |
|---|---|---|---|---|
| stale CodeGraph result | index points to qoderwork main | `codegraph status` warns of foreign worktree | record conflict and use bounded current-worktree search | status output and search output |
| scope expansion | an inventory path lacks approved successor plan | continuation register inspection | mark `BLOCKED`; do not edit the path | inventory and register |
| local JSON leak | local paths file becomes tracked | `git ls-files --error-unmatch scripts/local-paths.json` | remove from index before source work continues | Git output and audit note |
| false negative | read or parse fails | explicit `UNAVAILABLE` diagnostic | stop rather than treating it as absence | command output |
| evidence inflation | component result called runtime/live | phase audit wording check | replace assertion with exact level or stop | report and corrected audit |
| failed rollback | a restricted file changes | allowed-file diff check | revert only the responsible phase list; preserve diagnostics | diff and failure report |

## 9. Final completion gate

- [ ] Plan validator exits 0 with no errors after every plan edit
- [ ] PHASE-01 inventory, human-approved lock, and pre-change receipt are accepted
- [ ] PHASE-02 component checks and typecheck are accepted with evidence
- [ ] PHASE-03 component checks and typecheck are accepted with evidence
- [ ] PHASE-04 continuation register, audit, log, and indexes are accepted
- [ ] Every external inventory row has an approved successor PLAN_SET before it is edited
- [ ] Required isolated runtime-smoke is executed by that successor and retained at its own evidence level
- [ ] No component result is reported as runtime-smoke or live-E2E

**Final status rule**: any unchecked item keeps implementation incomplete. The present PLAN_SET is `READY-FOR-IMPLEMENTATION`; it is not implementation evidence.
