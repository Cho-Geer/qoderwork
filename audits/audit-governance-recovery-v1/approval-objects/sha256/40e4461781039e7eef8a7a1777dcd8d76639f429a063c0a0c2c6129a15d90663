# Phase PHASE-00: Toolchain implementation

**Phase ID**: `PHASE-00`
**Depends on**: `NONE`
**Outcome**: Implement the governance audit toolchain (8 source/test files) that PHASE-01 onward consumes as accepted tooling.
**Evidence level**: `component`
**Progression status**: `NOT_STARTED`
**Completion receipt**: `N/A`

## Goal and owned requirements

Implement the mechanical producers and validators that all later phases invoke as already-accepted tooling. This phase owns the **source code implementation** of `validate-phase-progression.ts` (all 14 modes), `capture-state.ts` (dual-repository + bootstrap upgrade + VERDICT), `validate-audit.ts` (v3 recovery), `generate-evidence-receipt.ts`, `prepare-audit.ts`, `validate-plan.ts`, and the two `foundation-kernel.test.ts` test files. No governance artifact (scope-lock, EV receipt, audit report) is produced as a **deliverable** of this phase; PHASE-01 owns the audit bootstrap that uses these tools.

## Two-stage internal bootstrap

PHASE-00 is a self-bootstrapping tool-implementation phase. It uses a two-stage internal sequence to resolve the cold-start circular dependency (tools needed to generate scope-lock, but scope-lock needed to start the phase):

**Stage 0-α (tool implementation)**: Implementer B implements all 8 allowed-files in fixed order, runs the fixed verification suite, and stops. No formal PRE_CHANGE receipt is produced (the existing `capture-state.ts` lacks PRE_CHANGE/VERDICT capability before enhancement). The pre-change baseline is an informal git HEAD snapshot recorded by Auditor A.

**Stage 0-β (self-bootstrap audit)**: After Stage 0-α, Auditor A uses the **just-implemented tools** to mechanically generate PHASE-00's own scope-lock, PRE_CHANGE/VERDICT, evidence receipts, and prepared audit report. This stage exercises the tools against their own implementation as a functional smoke test.

**Waiver**: `PHASE-00_COMPONENT_LEVEL_NO_FORMAL_PRE_CHANGE` authorizes component-level audit to omit the formal PRE_CHANGE receipt (Stage 0-α uses git HEAD diff as informal baseline). The canonical `prewrite_verification_command` must declare a PHASE-00 exception branch (skip scope-lock presence check when phase=PHASE-00).

## Allowed files and exact edits

| Step | Exact path | Exact symbol/anchor and edit |
|---:|---|---|
| 1 | `.agents/skills/plan-audit-archiver/scripts/validate-audit.ts` | `verifyJsonReference` and receipt/report validators: recovery decision, legacy-Q, release, contract checks; preserve v3 |
| 2 | `.agents/skills/plan-audit-archiver/scripts/capture-state.ts` | `RepositoryStateReceipt`, `captureRepositoryState`, CLI: dual states and one-use bootstrap upgrade |
| 3 | `.agents/skills/plan-audit-archiver/scripts/generate-evidence-receipt.ts` | load canonical case set; execute/parse exact commands; emit separate execution/domain observations |
| 4 | `.agents/skills/plan-audit-archiver/scripts/prepare-audit.ts` | emit content-addressed contract object and immutable prepared report |
| 5 | `.agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts` | `validatePlanSet`: export model; validate manifest/files/owners/status/receipts/gates |
| 6 | `.agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts` | implement all 14 mutually-exclusive modes per PHASE-01 L82-99 enumeration: `--create-session-manifest`, `--create-scope-lock`, `--create-phase-approval-request`, `--emit-producer-release`, positional `PLAN_ROOT <PHASE-ID>` (admission), positional `PLAN_ROOT --closed-phase <PHASE-ID> --overlay-root <path>` (closed-phase), positional `PLAN_ROOT --final-readiness` (final-readiness), positional `PLAN_ROOT --final` (final), positional `PLAN_ROOT --final --overlay-root <path>` (final-overlay), `--stage-status`, `--stage-final-status`, `--verify-final-gate`, `--verify-final-audit-inputs`, `--verify-final-audit-regression`; argv routing via per-flag `process.argv.includes("--…")` presence checks (PHASE-01 L101's `argv[2].startsWith("--")` is the intent, not literal pattern) |
| 7 | `.agents/skills/plan-audit-archiver/scripts/__tests__/foundation-kernel.test.ts` | all-pass fixture plus isolated audit mutations |
| 8 | `.agents/skills/deterministic-implementation-planning/scripts/foundation-kernel.test.ts` | full-plan, journal/resume, staged/live-final fixtures |

No other file is permitted.

> Note: row 33 enumerates the full 14-mode surface that step 6 must implement; the edit operations are 14 independent flag dispatchers (in practice users invoke one mode per call). See PHASE-01 L82-99 for exact signatures, PHASE-02 L14 for downstream consumer anchors, and canonical-contract.yaml L1722 for phase_00 release command invoking `--emit-producer-release`.

## Fixed verification and numbered execution

1. Query CodeGraph impact/callers for all six modified sources.
2. Implement allowed steps 1–8 in order; existing tests stay unchanged.
3. Run:

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
/home/zhaoge/.bun/bin/bun test \
  .agents/skills/plan-audit-archiver/scripts/__tests__/validate-audit.test.ts \
  .agents/skills/plan-audit-archiver/scripts/__tests__/capture-state.test.ts \
  .agents/skills/plan-audit-archiver/scripts/__tests__/generate-evidence-receipt.test.ts \
  .agents/skills/plan-audit-archiver/scripts/__tests__/prepare-audit.test.ts \
  .agents/skills/plan-audit-archiver/scripts/__tests__/foundation-kernel.test.ts \
  .agents/skills/deterministic-implementation-planning/scripts/validate-plan.test.ts \
  .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.test.ts \
  .agents/skills/deterministic-implementation-planning/scripts/foundation-kernel.test.ts
/home/zhaoge/.bun/bin/bun run typecheck
git diff --check
```

> Fixed-verification (PHASE-00 L45-54) exercises the foundation-kernel surface (8 test files listed above). Mode coverage for all 14 `--*` flag dispatchers is asserted by `__tests__/validate-phase-progression-14-modes.test.ts` (the new fixture file created by M3 #4 Stage 0-α REWORK; SHA `6d4cda9e…`). The 8-file fixed-verification invocation list above does NOT include the new 14-modes fixture; F-11 acknowledges this as a follow-up r9/r10 wiring patch (out of scope for r9 textual reconciliation).

4. Implementer B returns outputs and stops. Auditor A runs Stage 0-β self-bootstrap audit using the just-implemented tools.

## Phase completion gate

- [ ] Only the eight allowed files changed; all legacy tests remain unedited and pass.
- [ ] Stage 0-α tool implementation passes fixed verification (8 tests + typecheck + diff).
- [ ] Stage 0-β self-bootstrap: `validate-phase-progression.ts --create-scope-lock` produces a valid scope-lock-PHASE-00-g001.json.
- [ ] `capture-state.ts` enhanced version produces valid dual-repository VERDICT receipt.
- [ ] `generate-evidence-receipt.ts` + `prepare-audit.ts` produce valid evidence + prepared report.
- [ ] `validate-audit.ts` returns `valid:true` for the PHASE-00 prepared report.
- [ ] Fixed tests, typecheck, diff check, CodeGraph, and allowed-file diff pass.
- [ ] Auditor Session A publishes PHASE-00 `ACCEPT`; PHASE-01 may then start its bootstrap.
