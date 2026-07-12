# Coverage Ledger — Live LLM E2E (2026-07-11)

Maps every executed case to session IDs, evidence files, and verdict.
Status legend: ✅ LIVE PASS · 🟡 LIVE PARTIAL · 🔴 LIVE FAIL / NOT WITNESSED · ⚪ SUPPORTING ONLY · ⏳ RUNNING (rerun in progress)

> Evidence bundles now live under phase dirs: `../L1` … `../L7` / `../probe` (e.g. `../L3/L3-008-009-010-safe-shell-allow/`; files: create.json, stream.sse, children.json, meta.txt)
> DB: `.opencode/state/framework-state.db` (50 tables, v37)

## Executed this run

| Case | Requirement | Parent SID | Child SID(s) | Evidence | Verdict |
|---|---|---|---|---|---|
| probe-trivial | live channel sanity (L1) | `ses_0af92e07dffeCgAzldJAoBrB7W` | — | ../probe/probe-trivial/* | ✅ LIVE PASS |
| L2-001 | build child w/o DAG | `ses_0af91d39bffesLJgHMT1QcZzsY` | `ses_0af8fbb73ffe9ffHl8T4s1QmLe` (explore) | ../L2/L2-001-build-child/* | 🟡 PARTIAL |
| L3-008/009/010 | safe_shell read allow | `ses_0af91d55cffeX1483eKLN2CpVJ` | — | L3-008-009-010-safe-shell-allow/* | 🔴 NOT WITNESSED |
| L3-011 | safe_shell git add deny | `ses_0af91d551ffepNMgbl0k3RAd25` | — | ../L3/L3-011-safe-shell-gitadd-deny/* | 🔴 NOT WITNESSED |
| L3-012 | REPO-OP denies gh push (MANDATORY) | `ses_0af91d3b4ffeycTapv6j4N7yE9` | `ses_0af8d95d4ffejR7ucISK8CbwJz` (explore) | ../L3/L3-012-repo-op-deny/* | 🟡 PARTIAL |
| L5-006/007/008 | /children fallback | — (invalid session) | — | run log; see RESULT-SHEET | 🔴 DEVIATION (500 not 404) |
| L4-001/002 | question + reply recovery | `ses_0af882bdfffeoP2gc5xGdPh0R9` | — | ../L4/L4-question-reply/* | 🔴 NOT WITNESSED |
| L5-002 | safe_edit hot-path DB touch-set | `ses_0af882a3bffez6MY6lKa3L3WWd` | — | ../L5/L5-002-safe-edit-hotpath/* | 🔴 INVALID (saturation — rerun ⏳) |
| L7-003~007 | framework_maintenance chain | `ses_0af882bd9ffeNnSu4iNyIHSoIG` | — | ../L7/L7-framework-maint-chain/* | 🔴 INVALID (saturation — rerun ⏳) |
| L4-rerun / L5-002-rerun / L7-rerun | reruns (sequential, no saturation) | ⏳ | ⏳ | ../L4/L4-rerun/*, ../L5/L5-002-rerun/*, ../L7/L7-rerun/* | ⏳ RUNNING |
| L1-001 | skill-summary keyword-boost (12 intents × CN/EN = 24) | `ses_0abd914ccffe4c0oMPE9dnYFO3` … (24 SIDs, see TSV) | — | ../L1/L1-001-skill-summary/_e2e_strict_20260712_113848.tsv | ✅ LIVE PASS (24/24) |

## Full-matrix rollup (L1–L7 + mandatory open)

| Level | Cases | Live witness this run | Notes |
|---|---|---|---|
| L1 | 24 | 24 (L1-001 skill-summary 24/24 ✅) | full keyword-boost matrix validated live (CN/EN); reuse of probe-trivial sanity retained |
| L2 | 8 | 1 partial (L2-001) | native child w/o DAG proven; explore-routing deviation |
| L3 | 12 | 1 partial (L3-012) + 2 not witnessed (L3-008/9/10, L3-011) | LLM avoids controlled tools → denials not triggered |
| L4 | 6 | 0 | L4-001 question NOT emitted; L4-002 reply untested (rerun ⏳) |
| L5 | 8 | 0 solid (L5-006 deviation; L5-002 rerun ⏳) | observability endpoint 500 not 404 |
| L6 | 6 | 0 | weak-model matrix not re-run this session |
| L7 | 15 | 0 (rerun ⏳) | mandatory positive chain pending rerun |

## Mandatory open live cases (test plan §6) — status

1. **L3-012** REPO-OP deny gh — 🟡 partial (legacy heavy flow intercepted before push)
2. **L4-005** watcher capsule — ⚪ code/scripts only (not live-driven)
3. **L5-002** safe_edit touch-set — ⏳ rerun in progress
4. **L5-004** high-risk checklist optionality — 🔴 not run
5. **L5-007/008** /children HTML/non-JSON — 🔴 deviation (500 not 404)
6. **L7-003~007** framework_maintenance chain — ⏳ rerun in progress
7. **L7-014/015** budget/post-complete — 🔴 not run
8. **Appendix A #2,#10,#14,#18,#20,#22** — 🔴 not run (mostly static/hook-backed)

## Key systemic findings (cross-cutting)

- **F1 — Action turns yield 0-byte `/message` responses.** Evidence for dispatch/blocked turns must come from the DB + `GET /session/{SID}` children, not the response body.
- **F2 — LLM proactively avoids controlled write tools** (safe_shell/git/gh). Denials (L3-008/9/10, L3-011) are therefore not triggered by the current prompt + model, so enforcement tables stay empty.
- **F3 — Legacy heavy compliance/checklist DAG is STILL active** for native explore subagents (L3-012 child loaded full domain/knowledge/HANDOVER gates). Violates simplification intent (relevant to L2-007/L5-003).
- **F4 — `/children` (invalid session) returns HTTP 500**, not the 404 the plan expects; endpoint also flaky.
- **F5 — Concurrent live sessions saturate the single serve** (HTTP 000). Runs must be sequential.
