# P0-3 隔离 Serve 剩余闭环 — Plan Index

**Plan mode**: `PLAN_SET`
**ID**: `ISO-SERVE-P0-3-PLANSET-20260722`
**Status**: `READY-FOR-IMPLEMENTATION`
**Only implementation path**: six ordered Phases; failure stops.
**Evidence ceiling**: PHASE-01/03/04 component; PHASE-02/05 live-E2E.

**Provenance level**: `v2.1-required` for every Phase; code writes require scope-lock, human approval, and a nonempty pre-change receipt.

## 1. Input contract and source ledger

| Source | Current status | Sections used | Authority | Use |
|---|---|---|---|---|
| `blueprints/blueprint-isolated-serve-test-infrastructure.md` | v1.3.2 | TSI-01 to TSI-08 | blueprint | completion contract |
| `scripts/test-serve/run-context.ts` | current | state functions | code | state and run-ID gap |
| `scripts/test-serve/execute.ts` | current | execute gate | code | H2 and dry-run gate |
| `scripts/_b_pt_wm_00r2_live_e2e.ts` | current | T-PT-046/047 | code | run-mode runner |
| `scripts/_b_pt_wm_00r2_g3_t051.ts` | current | T-PT-051 | code | live-step stub gap |
| `scripts/_b_pt_wm_00r2_g3_t052.ts` | current | T-PT-052 | code | mutation stub gap |
| `e2e/permission-template-enforcement-test-spec.md` | BLOCKED | T-PT-046 to T-PT-052 | spec | oracle gates |

## 2. Decisions, scope, and non-goals

### Decision ledger

| ID | Decision | Fixed contract | Status |
|---|---|---|---|
| DEC-001 | State enforcement location | `run-context.ts` owns transition validation and duplicate root rejection | closed |
| DEC-002 | Live authority | reviewer injects H2 only into the executing process; agent never writes or exports it | closed |
| DEC-003 | Runner execution | live runner must issue real manifest-derived requests; plan-only artifacts never close live checks | closed |
| DEC-004 | Mutation isolation | each mutation is applied only in its run worktree and is removed by controlled cleanup | closed |
| DEC-005 | Old launcher | delete only after PHASE-05 evidence and active-caller scan both pass | closed |

### In scope

- TSI-01, TSI-05, TSI-06, the hard-gate evidence required by TSI-03, and TSI-08.
- The cited QoderWork runner, test, blueprint, plan, evidence, and log files.

### Non-goals

- Unapproved work-one behavior changes, bare serve, port 4097, fixed SSE paths, `pkill`, or direct grant/session DB writes.
- Treating component, plan-only, or historical artifacts as live-E2E evidence.

### Open/blocking items

- PHASE-02/05 require reviewer H2 authorization and disabled dry-run; absence is `BLOCKED` before prompt creation.
- PHASE-05 requires PASS receipts for T-PT-048/049/050; absence blocks T-PT-051/052.
- T-PT-048/049/050 全部 NOT-RUN（仅有 dry-run artifacts）；P0-3-05 的 T-PT-051/052 live 执行以此为前置。若 T-PT-048/049/050 无 PASS 证据，P0-3-05 对 T-PT-051/052 的 live 裁决为 BLOCKED。这些测试 ID 的 runner 已存在（_b_pt_wm_00r2_g3_t048/049/050.ts）但为 dry-run stub，需独立于 P0-3 实施 live 执行或由 reviewer 直接授权运行。

### Negative evidence semantics

- A negative check passes only when its state is `NOT_FOUND` and the query completed.
- `FOUND`, `UNAVAILABLE`, malformed output, or a missing artifact is a failure with `failedChecks` naming the exact check.

### Current versus historical evidence

- P0-1B and P0-2 bundles support only their recorded isolation/lifecycle claims.
- This plan requires fresh commit- and run-ID-bound artifacts.

## 3. Verified current baseline

| Claim | Status | Evidence | Result |
|---|---|---|---|
| TSI-01 transition enforcement | VERIFIED gap | CodeGraph source for `setRunState` | direct assignment, no transition guard |
| TSI-01 duplicate run-ID rejection | VERIFIED gap | CodeGraph source for `createRunContext` | random ID generation, no existing-root rejection |
| TSI-02 patch failure cleanup | VERIFIED | current component command | 19 pass / 0 fail across selected suites |
| TSI-05 static migration | VERIFIED | runner-scoped fixed-path scan | zero banned fixed-path matches |
| TSI-03 skill-read hard gate | VERIFIED | work-one skill-attest.test.ts 6/6 pass + live E2E core confirmed | §5.3 checkbox checked |
| T-PT-051 live execution | VERIFIED gap | runner source | live-step stub remains |
| T-PT-052 mutation execution | VERIFIED gap | runner source | mutation-application stub remains |
| reviewer live evidence | NOT-RUN | test specification status | T-PT-046/047/051/052 not closed |

## 4. End-to-end traceability

| Requirement | Source | File/symbol | Check name | Evidence source | Happy fixture | Single mutation | Test ID | Level |
|---|---|---|---|---|---|---|---|---|
| REQ-301 | TSI-01 | `setRunState` | legal transition | component output | CREATED to WORKTREE_READY | CLEANED to READY | P03-S-01 | component |
| REQ-302 | TSI-01 | `createRunContext` | duplicate run ID | component output | fresh generated ID | pre-created run root | P03-S-02 | component |
| REQ-305 | TSI-01 | manifest fields | manifest field assertion | component output | port+patchSha256+abs paths written | missing field | P03-S-04 | component |
| REQ-306 | TSI-01 | validateRunProcess | PID identity mismatch | component output | correct PID accepted | foreign PID rejected | P03-S-05 | component |
| REQ-307 | TSI-03 | sse-daemon | FRAMEWORK_DB_PATH usage | component output | env var read and used | missing env var throws | P03-S-06 | component |
| REQ-308 | TSI-01 | H2_AUTHORIZED | never written invariant | static scan | no assignment found | assignment found | P03-S-07 | component |
| REQ-309 | TSI-05/06 | manifest runner and skill | run-mode receipt | run artifact | root/child manifest | missing H2 | T-PT-046/047 | live-E2E |
| REQ-313 | TSI-05 | T-PT-051 runner | ten real requests | request/oracle artifact | root and child allowed flow | unauthenticated edit | T-PT-051 | live-E2E |
| REQ-317 | TSI-05 | T-PT-052 runner | isolated mutation matrix | mutation receipts | each mutant rejected | one surviving mutant | T-PT-052 | live-E2E |
| REQ-326 | TSI-08 | old launcher | retirement scan | rg output and regression | no active caller | one active caller | P03-R-01 | manual verification |

## 5. File change inventory

| # | Exact path | Change | Phase |
|---|---|---|---|
| 1 | `scripts/test-serve/run-context.ts` | modify | PHASE-01 |
| 2 | `scripts/test-serve/types.ts` | modify | PHASE-01 |
| 3 | `scripts/test-serve/__tests__/run-context.test.ts` | modify | PHASE-01 |
| 4 | `scripts/_b_pt_wm_00r2_live_e2e.ts` | verify and evidence update | PHASE-02 |
| 5 | `scripts/_b_pt_wm_00r2_g3_t051.ts` | modify | PHASE-03 |
| 6 | `scripts/_b_pt_wm_00r2_g3_t052.ts` | modify | PHASE-04 |
| 7 | `scripts/_b_pt_wm_00r2_live.ts` | delete after gate | PHASE-06 |
| 8 | `blueprints/blueprint-isolated-serve-test-infrastructure.md` | status update | PHASE-05, PHASE-06 |

## 6. Phase manifest

| Order | Phase ID | File | Depends on | Outcome |
|---:|---|---|---|---|
| 1 | P0-3-01 | `01-phase-state-contract.md` | NONE | legal state and duplicate-ID component contract |
| 2 | P0-3-02 | `02-phase-run-mode-skill-evidence.md` | P0-3-01 | reviewer-authorized T-PT-046/047 manifest evidence |
| 3 | P0-3-03 | `03-phase-t051-runner.md` | P0-3-02 | real T-PT-051 request runner |
| 4 | P0-3-04 | `04-phase-t052-mutation-runner.md` | P0-3-03 | real isolated mutation runner |
| 5 | P0-3-05 | `05-phase-reviewer-live-evidence.md` | P0-3-04 | reviewer receipts for T-PT-046/047/051/052 |
| 6 | P0-3-06 | `06-phase-retire-old-launcher.md` | P0-3-05 | safe old-launcher deletion and regression |
