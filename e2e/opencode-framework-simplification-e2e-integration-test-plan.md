# OpenCode Framework Simplification — Full Live LLM E2E Master Plan

> Version: v2.0.0  
> Date: 2026-07-11  
> Scope: `/home/zhaoge/workspace/opencode/work-one`  
> Output location: `qoderwork/e2e/`  
> Supersedes: v1.0.0 (2026-07-06), which mixed pre-2026-07-11 gaps with later evidence and did not require every acceptance item to have a true live LLM witness.  
> Authoritative sources:
> - `plans/00-overview.md`
> - `plans/01-phase0-baseline-freeze.md`
> - `plans/02-phase1-skill-first.md`
> - `plans/03-phase2-native-agent-dag.md`
> - `plans/04-phase3-enforcement-slimming.md`
> - `plans/05-phase4-minimal-state.md`
> - `plans/06-phase5-legacy-retirement.md`
> - `blueprints/blueprint-opencode-framework-simplification-roadmap.md`
> - `blueprints/blueprint-tool-governance-mvc-refactor.md`
> - `e2e/skill-summary-keyword-regression.md`
> - `e2e/weak-model-23-regression.md`
> - `e2e/smoke-test-results-20260707.md`
> - `logs/2026-07-11-runtime-smoke.md`
> - `logs/2026-07-06-serve-api-e2e-validation.md`
> - `logs/2026-07-07-live-llm-dispatch-e2e-partial.md`
> - `logs/2026-07-11-tool-governance-protected-read-fix.md`

## 1. Purpose

This document is the master test ledger for the framework-simplification rollout, but with one hard rule:

**A roadmap item is not closed by component tests, direct handler smoke, or generic runtime smoke alone.**
It is only closed when we can point to at least one **full live LLM E2E** case:

1. a real Orchestrator session is created,
2. the LLM makes the relevant tool/child-session decisions,
3. the expected runtime behavior happens,
4. the evidence is captured from session trace, logs, DB, and/or artifacts.

Supporting evidence remains useful, but only as support:

- `static/code`: confirms structure exists
- `component`: confirms a module behaves in isolation
- `runtime smoke`: confirms a real runtime path exists
- `deterministic live-integration`: imports production handlers but does not use a real LLM decision loop

This plan uses those lower levels only to explain prerequisites, blockers, or partial coverage.
They do **not** substitute for the required live LLM E2E closure.

## 2. Non-Negotiable Evidence Rules

### 2.1 Evidence ladder

| Level | Meaning | Can close a case in this plan? |
|---|---|---|
| `static/code` | source/config/document existence | No |
| `component` | isolated tests, direct imports, synthetic DB checks | No |
| `runtime smoke` | real serve session, but narrow or partial path | No |
| `deterministic live-integration` | production handler invoked without real LLM loop | No |
| `live LLM E2E` | real Orchestrator / child session, real LLM choices, full evidence | Yes |
| `full matrix` | all positive and negative edges covered; usually built from multiple live cases plus support evidence | Only if at least one live witness exists for each matrix family |

### 2.2 Required evidence bundle per live case

Each live case must capture:

```text
Case ID:
Prompt:
Parent session ID:
Child session IDs (if any):
Expected tool / routing behavior:
Actual behavior:
Evidence:
  - message/session export
  - runtime logs
  - JSONL paths
  - DB query result
  - produced artifact (if any)
Verdict:
Notes / known deviations:
```

### 2.3 Correct live channels

For this plan, the valid interactive channels are:

- `POST /session`
- `POST /session/{SID}/message`
- `GET /session/{SID}/children` or equivalent session tree scripts
- `POST /session/{SID}/prompt_async` with `agent`
- `POST /question/{QID}/reply`
- `POST /session/{SID}/abort`

The following are **not** valid acceptance channels:

- `POST /session/{SID}/guide`
- `POST /session/{SID}/reply`
- `POST /session/{SID}/interrupt`

### 2.4 Serve/API execution discipline

When the live path goes through serve API:

1. send JSON with `Content-Type: application/json`
2. prefer real Orchestrator sessions over direct synthetic child-session creation
3. keep prompts minimally scoped so each case has one primary assertion
4. if a single live session covers multiple assertions, explicitly map every covered case ID

## 3. What Already Exists vs What Still Needs Full Live Upgrade

This table prevents us from double-counting lower-grade evidence as live closure.

| Area | Current best artifact | Current best evidence | Counts as closed for this plan? | Notes |
|---|---|---|---|---|
| Skill-summary 12 intents x CN/EN (24 sessions) | `e2e/skill-summary-keyword-regression.md` | `live LLM E2E` | Yes, for injection mechanics | Semantic parity still has Findings F1-F6 |
| Native Task build/general/plan/explore | `e2e/smoke-test-results-20260707.md`, `logs/2026-07-11-runtime-smoke.md` | `runtime smoke` | No | Must be upgraded to full live closure per executor family |
| Question / reply / prompt_async / abort mechanics | `logs/2026-07-06-serve-api-e2e-validation.md` | live session validation | Partial | Need one integrated blocked-task recovery loop under current framework simplification acceptance |
| Safety hard-blocks | `e2e/smoke-test-results-20260707.md` | `runtime smoke` | No | GOV/GUARD probes upgraded only some guard paths to live |
| GOV / GUARD live probes | `e2e/weak-model-23-regression.md` | `live LLM E2E` | Partial | Confirms guard chain firing/blocking, not full enforcement matrix |
| Tool governance REPO-OP write | `plans/04-phase3-enforcement-slimming.md`, D3 references | deterministic live-integration + runtime log smoke | No | Still needs actual LLM-triggered REPO-OP deny |
| Tool governance protected-read allow | `logs/2026-07-11-tool-governance-protected-read-fix.md` | component + direct smoke | No | Must be seen in a real LLM session |
| Ordinary hot-path DB slimming | `logs/2026-07-11-runtime-smoke.md` | `runtime smoke` | No | Needs explicit live-case closure in this master plan |
| Weak-model 23-scenario matrix | `e2e/weak-model-23-regression.md` | mixed (`static/code` + `runtime smoke` + partial `live`) | No | Appendix A upgrades all 23 to explicit live targets |
| Framework maintenance write chain | `e2e/smoke-test-results-20260707.md`, `logs/2026-07-07-live-llm-dispatch-e2e-partial.md`, `plans/06-phase5-legacy-retirement.md` | partial live + runtime smoke + component | No | Still the most important open full-live chain |

## 4. Pre-Run Gates (Not Counted as Live Cases)

These must be run before the live matrix, but they do not close any live case by themselves.

### P0-A Baseline freeze

- CodeGraph status/sync is clean
- `.opencode` TS count / line count match current plans
- active order matches before 11 / after 7 / system 2
- DB authority remains `.opencode/state/framework-state.db`

### P0-B Runtime harness sanity

- serve daemon healthy
- SSE or session-tree observation available
- JSON body path avoids shell escaping bugs
- `Content-Type: application/json` confirmed for `/message`

### P0-C Isolation

- use disposable branch/worktree for any write case
- separate read-only live cases from write live cases
- framework-maintenance live write cases must target disposable framework probe files

## 5. Full Live LLM E2E Master Matrix

Every row below requires at least one real LLM-driven witness.

### L1. Skill-First and Prompt Shaping

| Case ID | Assertion | Current best evidence | Full-live requirement |
|---|---|---|---|
| L1-001 | 12 intent x CN/EN skill-summary boost matrix (24 sessions) | `e2e/skill-summary-keyword-regression.md` | Reuse as canonical live suite; rerun only if matcher code changes |
| L1-002 | trivial task does not inject heavy/full prompt behavior | B1 row #12 + runtime smoke | Must capture prompt/system evidence, not only logs |
| L1-003 | high-risk ambiguous framework task triggers `preflight-lite` + risk-aware clarification | mixed runtime smoke | Must show real output includes assumptions/open questions/decision points |
| L1-004 | missing recommended skill yields warn/observable gap, not silent pass | runtime smoke | Must show one real session where skill-policy is observable |

### L2. Native Task, No DAG, No Legacy Preamble

| Case ID | Assertion | Current best evidence | Full-live requirement |
|---|---|---|---|
| L2-001 | build child runs without DAG | G2 runtime smoke | Must have live child session, completion, and evidence |
| L2-002 | general child runs without DAG | G2 runtime smoke | Same |
| L2-003 | plan child runs without DAG | G2 runtime smoke | Same |
| L2-004 | explore child runs without DAG and returns evidence bundle | T4 runtime smoke | Must show returned evidence bundle in live session |
| L2-005 | missing `DISPATCH_TOKEN` is audit/not hard block on native path | G2/T2 runtime smoke | Must capture actual non-blocking behavior in session/logs |
| L2-006 | concurrent child sessions do not collide | G2 runtime smoke | Must show concurrent live children and clean lineage |
| L2-007 | child prompt contains no legacy preamble / no mandatory DAG text | mostly static | Must capture live child prompt/session trace |
| L2-008 | session tree + DB lineage visible for native path | T3 + B2 runtime/proxy | Must show parent/child linkage from the same live case |

### L3. Enforcement, Tool Governance, and Hard Boundaries

| Case ID | Assertion | Current best evidence | Full-live requirement |
|---|---|---|---|
| L3-001 | native `edit` is blocked | G3 runtime smoke | Must remain live-reproducible |
| L3-002 | native `bash` is blocked | G3 runtime smoke | Same |
| L3-003 | wrong-path write triggers scope/protected-path block | G3 + weak-model live subset | Must capture one real wrong-path attempt with block evidence |
| L3-004 | source edit without CodeGraph is blocked | G3 runtime smoke | Must capture one real blocked write with remediation text |
| L3-005 | dangerous shell / backup-bypass write is blocked | GUARD live probe | Keep as canonical live case; rerun if shell policy changes |
| L3-006 | `question` remains pass-through under blocking state | T5 runtime smoke | Must be witnessed inside a real blocked workflow |
| L3-007 | route mismatch is audit-only, not unintended hard block | mostly static | Must have at least one live witness |
| L3-008 | `safe_shell cat package.json` is allowed | direct smoke | Must be observed in real session |
| L3-009 | `safe_shell cat .opencode/service/...` is allowed after protected-read fix | direct smoke | Must be observed in real session |
| L3-010 | `safe_shell git status` is allowed | smoke/direct | Must be observed in real session |
| L3-011 | `safe_shell git add ...` is denied and redirects to `safe_repo_*` | D3 + smoke | Must be observed in real session |
| L3-012 | GitHub / gh write is denied by `REPO-OP` in an actual LLM session | deterministic D3 only | Mandatory open live case |

### L4. QoderWork Bridge and Intervention

| Case ID | Assertion | Current best evidence | Full-live requirement |
|---|---|---|---|
| L4-001 | a blocked/uncertain live task emits `question` | T5 + serve validation | Must capture the actual question event and SID/QID |
| L4-002 | `POST /question/{QID}/reply` recovers the same flow | serve validation + question smoke | Must be exercised in framework-simplification context |
| L4-003 | `prompt_async` with preserved `agent` enters the next turn | serve validation | Must be tied to a real simplification task, not only harness demo |
| L4-004 | `abort` immediately stops a live session | serve validation + smoke | Must remain part of final live suite |
| L4-005 | watcher R1-R7 can build an evidence capsule and suggest intervention | code/scripts mostly | Mandatory open live case |
| L4-006 | no case uses nonexistent `/session/{SID}/guide|reply|interrupt` endpoints | doc discipline | Must be enforced in every execution note |

### L5. Minimal State and Observability

| Case ID | Assertion | Current best evidence | Full-live requirement |
|---|---|---|---|
| L5-001 | read-only task causes zero critical DB writes | T7 runtime smoke | Must keep one full live witness with before/after DB snapshot |
| L5-002 | ordinary `safe_edit` hot path touches only expected DB/log surfaces | G1-006 runtime smoke | Mandatory open live case |
| L5-003 | ordinary task creates no checklist rows | G1-004/005 runtime smoke | Must be carried by one full live case |
| L5-004 | high-risk task only creates checklist when truly appropriate | mostly plan/runtime | Mandatory open live case |
| L5-005 | `audit.jsonl`, `quality.jsonl`, `skill.jsonl`, `guidance.jsonl` are all exercised by appropriate live flows | mixed | Mandatory open live case family |
| L5-006 | `/children` 404 fallback works | B2/T8 runtime/proxy | Must stay in observability suite; live+proxy accepted |
| L5-007 | `/children` HTML fallback works | B2/proxy | Mandatory open observability case |
| L5-008 | `/children` non-JSON fallback works | B2/proxy | Mandatory open observability case |

### L6. Weak-Model Quality Floor

The weak-model suite is not considered closed until **all 23 scenarios** in Appendix A have an explicit live witness or are explicitly marked as technically impossible to drive with a real LLM, with a documented reason. At the current snapshot, only a subset has live witnesses.

Primary live families:

| Case ID | Assertion | Current best evidence | Full-live requirement |
|---|---|---|---|
| L6-001 | ambiguity handling does not jump straight to unsafe edits | B1 row #1 + weak-model matrix | Needs explicit live witness with output quality, not only skill boost |
| L6-002 | evidence-first behavior before action | mixed static/runtime | Mandatory open live case |
| L6-003 | TodoWrite standard/high-risk/trivial/failure/recovery discipline | G5 runtime smoke | Must be turned into explicit live matrix |
| L6-004 | freshness decision fires only on external/current tasks | G7 runtime smoke | Must be retained as live family |
| L6-005 | research escalation returns evidence bundle | T4/G7 runtime smoke | Must be retained as live family |
| L6-006 | final answer includes verification discipline | mostly static/hook | Mandatory open live case |

### L7. Framework Maintenance Privileged Write Chain

This is the most important open full-live chain. Current evidence is partial live + runtime smoke + component, not full closure.

| Case ID | Assertion | Current best evidence | Full-live requirement |
|---|---|---|---|
| L7-001 | Orchestrator requests `dispatch_privilege=framework_maintenance` for build child | partial live | Must show actual privilege request in live session |
| L7-002 | dispatch queue exact binding fields are present (`dispatch_key`, `parent_session_id`, `call_id`) | live partial | Current live evidence exists; keep as part of chain |
| L7-003 | child session is actually created and grant is bound to child | partial live/runtime | Mandatory open live case |
| L7-004 | child performs CodeGraph query/impact before write | runtime/component | Mandatory open live case |
| L7-005 | child creates `framework_maintenance_plan` | runtime/component | Mandatory open live case |
| L7-006 | `safe_framework_edit` succeeds on allowed framework probe path | not fully live | Mandatory open live case |
| L7-007 | `framework_maintenance_complete` finalizes the chain | runtime/component | Mandatory open live case |
| L7-008 | no grant => blocked | G3/G4/runtime | Keep as live negative case |
| L7-009 | no plan => blocked | component/runtime | Must be observed from live chain or explicitly negative live task |
| L7-010 | no CodeGraph evidence => blocked | component/runtime | Same |
| L7-011 | path outside plan => blocked | component/runtime | Same |
| L7-012 | path outside allowlist => blocked | component/runtime | Same |
| L7-013 | TTL expired => blocked | runtime/component | Same |
| L7-014 | write budget exhausted => blocked | component | Mandatory open live case |
| L7-015 | write after complete => blocked | component + weak-model mapping | Mandatory open live case |

## 6. Mandatory Open Live Cases

The following are the highest-priority gaps. They must remain explicit until a real live witness is attached.

1. **L3-012** — actual LLM-triggered GitHub/gh write denied by `REPO-OP`
2. **L4-005** — watcher R1-R7 evidence capsule under a real simplification task
3. **L5-002** — ordinary `safe_edit` hot path full live touch-set closure
4. **L5-004** — high-risk checklist optionality proven in live task, not just config
5. **L5-007 / L5-008** — `/children` HTML and non-JSON fallback retained as explicit observability cases
6. **L7-003 ~ L7-007** — real framework-maintenance privileged positive chain
7. **L7-014 / L7-015** — budget exhaustion and post-complete rejection in real live chain
8. **Appendix A scenarios #2, #10, #14, #18, #20, #22** — currently mostly static/hook-backed and need explicit live witnesses

## 7. Execution Order

1. Run `P0-A` / `P0-B` / `P0-C`.
2. Run `L1` first to confirm skill injection and prompt shaping.
3. Run `L2` next to establish native child-path truth.
4. Run `L3` after `L2` to verify hard boundaries on the native path.
5. Run `L4` while blocked/recovery flows are still fresh.
6. Run `L5` against the same session families to capture DB/log evidence.
7. Run `L7` in isolated disposable framework probe paths.
8. Finish with Appendix A weak-model reruns and map every scenario to a live witness.

## 8. Final Acceptance Gate

The simplification roadmap is not considered fully live-E2E-accepted until all of the following are true:

- every `L1-L7` case has a named live witness or an explicit technical impossibility note
- `L7` positive chain is fully live, not partial
- `L3-012` has a real LLM-triggered `REPO-OP` deny
- `L4-001` through `L4-004` form one integrated blocked-task recovery loop
- `L5-001` through `L5-005` have real DB/log evidence from live tasks
- all 23 Appendix A scenarios are mapped to live witnesses
- no result table upgrades `runtime smoke`, `component`, or `deterministic live-integration` to `live LLM E2E`

## 9. Deliverables

The full execution of this plan must produce:

1. one result sheet per live suite or case family
2. a coverage ledger that maps every case ID to:
   - session IDs
   - evidence files
   - verdict
3. one explicit open-gaps table for cases still below live level
4. one final acceptance summary:
   - `LIVE PASS`
   - `LIVE FAIL`
   - `LIVE BLOCKED`
   - `SUPPORTING ONLY`

## Appendix A — 23 Weak-Model Scenario Mapping

Every row below must ultimately point to a real live witness.

| # | Weak-model scenario | Primary live case(s) | Current best evidence | Need new live witness? |
|--:|---|---|---|:---:|
| 1 | ambiguous task writes too early | L1-003 / L6-001 | B1 live + runtime smoke | Yes |
| 2 | does not know what to ask | L6-001 / L4-001 | static/code | Yes |
| 3 | forgets to read relevant files | L6-002 | runtime smoke | Yes |
| 4 | forgets CodeGraph | L3-004 | runtime smoke | Yes |
| 5 | writes wrong file | L3-003 | live subset exists | Prefer rerun in unified suite |
| 6 | repeated tool failures | L4-001 / L4-002 | runtime smoke | Yes |
| 7 | skips recommended skill | L1-004 | runtime smoke | Yes |
| 8 | trivial task enters heavy DAG/checklist flow | L2-007 / L5-003 | runtime smoke | Yes |
| 9 | high-risk framework task skips grant/plan/write discipline | L7-001..007 | runtime/component | Yes |
| 10 | preamble comes back into active child prompt | L2-007 | static/code | Yes |
| 11 | external knowledge task lacks freshness decision | L6-004 | runtime smoke | Yes |
| 12 | pure local task unnecessarily triggers Context7 | L6-004 | runtime smoke | Yes |
| 13 | complex research fails to produce evidence bundle | L2-004 / L6-005 | runtime smoke | Yes |
| 14 | proceeds without enough evidence | L6-002 | static/code | Yes |
| 15 | non-trivial task has no TodoWrite | L6-003 | runtime smoke | Yes |
| 16 | write action deviates from current todo | L6-003 + L3-003 | live subset exists | Prefer rerun in unified suite |
| 17 | failure does not update recovery todo | L6-003 | runtime smoke | Yes |
| 18 | todos are vague and non-actionable | L6-003 | static/code | Yes |
| 19 | trivial task produces TodoWrite noise | L6-003 | runtime smoke | Yes |
| 20 | final output lacks verification evidence | L6-006 | static/code | Yes |
| 21 | native Task still needs DAG/token | L2-001..006 | live subset + runtime smoke | Prefer rerun in unified suite |
| 22 | route mismatch becomes unintended hard block | L3-006 | static/code | Yes |
| 23 | write after `framework_maintenance_complete` still succeeds | L7-015 | component + live subset | Yes |

## Appendix B — Things That Must Never Be Counted as Full-Live Closure

Do not mark a case as closed by this plan if its best evidence is only one of the following:

1. `bun test` on policy files (`tool-governance 30/30`, `safe-bash-core 23/23`, `framework-maintenance 13/13`)
2. direct `bun -e` handler smoke such as `evaluate(...) === null`
3. deterministic production-handler import scripts such as `_d3_live.ts`
4. static prompt/config inspection
5. proxy-only fallback checks without a paired live session family

These are valuable supporting artifacts, but they remain support evidence only.
