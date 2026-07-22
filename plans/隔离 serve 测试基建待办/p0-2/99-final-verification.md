# P0-2 双 run 确定性隔离 — Final Verification

## 7. Global verification and evidence

| Level | Command | Preconditions | Exact PASS condition | Artifacts | Current status |
|---|---|---|---|---|---|
| component | PHASE-01–04 commands | prior gates | 0 fail | test output | PHASE-01 ready, later blocked |
| runtime-smoke | PHASE-05 command | reviewer pair A | 1 pass / 0 fail | A/B packet | ACCEPT（2026-07-22, 4001/4002） |
| runtime-smoke | PHASE-06 command | reviewer pair B | exit 0/PASS JSON | A/B packet | ACCEPT（2026-07-22, 4003/4004） |
| manual verification | PHASE-07/08 commands | two runtime packets | every closure gate true | diff/hash/log | PHASE-07 ACCEPT; PHASE-08 pending |

### Evidence preservation

- 每个 runtime packet 保存 `manifest.json`, `p0-2-stage-results.json`, cleanup report, framework/SDK DB, serve/SSE/framework logs, events, sentinel marker 和 stdout/stderr。
- 失败 run 保持原路径；不得以第二次 run 覆盖或替换失败证据。

### Evidence ceiling rule

- PHASE-01–04 的 component PASS 不得声明 runtime-smoke PASS。
- PHASE-05 或 PHASE-06 单独成功不得声明 P0-2 DONE。

## 8. Risks, failure convergence, and rollback

| Risk | Trigger | Detection | Fixed convergence | Evidence retained |
|---|---|---|---|---|
| evidence absence becomes PASS | boolean inversion | P02-V mutation | `UNAVAILABLE` FAIL | DB/events error |
| wrong process stopped | sentinel/run mismatch | P02-O identity test | refuse stop | marker/proc data |
| runtime pollution | lifecycle failure | PHASE-05/06 result | retain failure scene | run directories |
| unsupported closure | incomplete gates | PHASE-08 review | keep non-DONE | current docs/diff |

## 9. Final completion gate

- [x] Every index requirement has one owning Phase and traceability row.
- [x] PHASE-01–04 component gates have retained output.
- [x] PHASE-05 and PHASE-06 have two independent runtime-smoke packets.
- [x] PHASE-07 root typecheck, safety scans and regressions all pass.
- [ ] PHASE-08 hashes and evidence-qualified document updates pass.
- [x] No lower-level result is reported as runtime-smoke or DONE.

**Final status rule**: 任一未勾选项使 P0-2 保持非 DONE。
