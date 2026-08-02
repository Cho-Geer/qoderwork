# Phase PHASE-02: Single fail-fast audit closure entrypoint

**Phase ID**: `PHASE-02`
**Depends on**: `PHASE-01`
**Outcome**: One staged transaction closes every normal phase and the final plan without publishing a later effect after an earlier failure.
**Evidence level**: `file-integration`
**Progression status**: `NOT_STARTED`
**Completion receipt**: `N/A`

## Goal

- Implement `REQ-GR-011`.
- Adopt this phase's wrapper once; only PHASE-03 onward and final use it as accepted tooling.
- Build on PHASE-01's accepted `validate-phase-progression.ts` admission/status machine (the modes `--create-scope-lock`, `--create-phase-approval-request`, `--emit-producer-release`, `--closed-phase`, `--final-readiness`, `--final`, `--stage-status`, `--stage-final-status` are produced by PHASE-00's allowed-step #6 in `00-phase-toolchain-implementation.md` and consumed by PHASE-02 here as already-accepted tooling). PHASE-02 does NOT modify `validate-phase-progression.ts`; PHASE-02 only ADDS the `close-audit-phase.ts` wrapper (`02-phase-single-closure-entrypoint.md` allowed-files step 7) and the `pre-check-evidence.ts` / `finalize-audit.ts` / `generate-phase-projection.ts` siblings. The boundary eliminates historical overlap and is enforced by `00-phase-toolchain-implementation.md` Boundary with PHASE-01 section (toolchain ownership).

## Starting state and admission

1. PHASE-01 is `ACCEPTED`; its waiver and receipts validate.
2. Auditor A creates the immutable PHASE-02 g001 lock.
3. Auditor A runs P-02A entry admission; nonzero stops before approval.
4. HUMAN approves that exact lock; Auditor A captures dual PRE_CHANGE.
5. Only then may a distinct Implementer B task write.

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
/home/zhaoge/.bun/bin/bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts \
  plans/audit-governance-recovery-v1/formal-plan-set PHASE-02
```

Any missing/nonzero prerequisite is `BLOCKED`.

## Allowed files

| Step | Exact path | Symbol/anchor |
|---:|---|---|
| 1 | `.agents/skills/plan-audit-archiver/scripts/pre-check-evidence.ts` | `PrecheckInput`, `checkPreparedPair`: require distinct prepared report/contract |
| 2 | `.agents/skills/plan-audit-archiver/scripts/__tests__/pre-check-evidence.test.ts` | add prepared-pair/collision fixtures |
| 3 | `.agents/skills/plan-audit-archiver/scripts/finalize-audit.ts` | `FinalizeInput`, `stageAuditPublication`: stage immutable source to distinct destination |
| 4 | `.agents/skills/plan-audit-archiver/scripts/__tests__/finalize-audit.test.ts` | add exclusive destination/hash fixtures |
| 5 | `.agents/skills/plan-audit-archiver/scripts/generate-phase-projection.ts` | `ProjectionInput`, `generatePhaseProjection`: emit canonical projection only |
| 6 | `.agents/skills/plan-audit-archiver/scripts/__tests__/generate-phase-projection.test.ts` | add report/contract/state/release edge fixtures |
| 7 | `.agents/skills/plan-audit-archiver/scripts/close-audit-phase.ts` | add `StageName`, `runClosure`, `commitOrResume`, CLI |
| 8 | `.agents/skills/plan-audit-archiver/scripts/__tests__/close-audit-phase.test.ts` | add phase/final/candidate all-pass plus isolated failures |

No other file is permitted in this phase.

## Forbidden behavior

- No validator, state/scope, graph, EV/report, rule, skill, template, index/log, M1, or work-one source change.
- No direct hardened report, LATEST, progression, status, final-gate, or documents-marker publication.
- No status staging before its progression/final receipt exists and no later stage after a nonzero result.
- No deletion/reconstruction of an interrupted journal; no free-form resume inputs.
- Implementer Session B cannot invoke live closure or issue an audit verdict.

## Mechanical PHASE-02 audit inputs

After Implementer B stops, Auditor A creates the release and captures VERDICT:

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts \
  --emit-producer-release \
  --canonical plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml \
  --case-set PHASE-02 \
  --object-root audits/audit-governance-recovery-v1/objects/sha256 \
  --output audits/audit-governance-recovery-v1/producer-releases/PHASE-02-closure-candidate.json
bun run .agents/skills/plan-audit-archiver/scripts/capture-state.ts --state-kind VERDICT \
  --qoderwork-root /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap \
  --work-one-root /home/zhaoge/workspace/opencode/work-one \
  --scope-lock audits/audit-governance-recovery-v1/phases/PHASE-02/g001/scope-lock-PHASE-02-g001.json \
  --phase-approval audits/audit-governance-recovery-v1/phases/PHASE-02/g001/phase-approval-decision-PHASE-02-g001.json \
  --session-roles audits/audit-governance-recovery-v1/session-role-manifest.json \
  --producer-release audits/audit-governance-recovery-v1/producer-releases/PHASE-02-closure-candidate.json \
  --output audits/audit-governance-recovery-v1/phases/PHASE-02/g001/verdict-state.json
```

Auditor A independently sweeps and writes only `audits/audit-governance-recovery-v1/phases/PHASE-02/g001/auditor-findings.md`; a blocker stops. Then:

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
bun run .agents/skills/plan-audit-archiver/scripts/generate-evidence-receipt.ts \
  --audit-id AUDIT-GOVERNANCE-RECOVERY-PHASE-02-g001 \
  --canonical plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml \
  --generate-case-set PHASE-02 \
  --scope-lock audits/audit-governance-recovery-v1/phases/PHASE-02/g001/scope-lock-PHASE-02-g001.json \
  --phase-approval audits/audit-governance-recovery-v1/phases/PHASE-02/g001/phase-approval-decision-PHASE-02-g001.json \
  --pre-change audits/audit-governance-recovery-v1/phases/PHASE-02/g001/pre-change-state.json \
  --verdict-state audits/audit-governance-recovery-v1/phases/PHASE-02/g001/verdict-state.json \
  --producer-release audits/audit-governance-recovery-v1/producer-releases/PHASE-02-closure-candidate.json \
  --output-dir audits/audit-governance-recovery-v1/phases/PHASE-02/g001/evidence
bun run .agents/skills/plan-audit-archiver/scripts/prepare-audit.ts \
  --scope-lock audits/audit-governance-recovery-v1/phases/PHASE-02/g001/scope-lock-PHASE-02-g001.json \
  --phase-approval audits/audit-governance-recovery-v1/phases/PHASE-02/g001/phase-approval-decision-PHASE-02-g001.json \
  --auditor-findings audits/audit-governance-recovery-v1/phases/PHASE-02/g001/auditor-findings.md \
  --evidence-dir audits/audit-governance-recovery-v1/phases/PHASE-02/g001/evidence \
  --pre-change audits/audit-governance-recovery-v1/phases/PHASE-02/g001/pre-change-state.json \
  --verdict-state audits/audit-governance-recovery-v1/phases/PHASE-02/g001/verdict-state.json \
  --producer-release audits/audit-governance-recovery-v1/producer-releases/PHASE-02-closure-candidate.json \
  --object-root audits/audit-governance-recovery-v1/objects/sha256 \
  --output-dir audits/audit-governance-recovery-v1/phases/PHASE-02/g001/prepared
```

## Candidate staging and accepted adoption

Auditor Session A uses the exact active phase/generation paths. PHASE-02 g001 is:

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
bun run .agents/skills/plan-audit-archiver/scripts/close-audit-phase.ts \
  --workspace-root /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap \
  --plan-root plans/audit-governance-recovery-v1/formal-plan-set \
  --stage-candidate PHASE-02 \
  --prepared-report audits/audit-governance-recovery-v1/phases/PHASE-02/g001/prepared/audit-report.md \
  --published-report audits/audit-governance-recovery-v1/phases/PHASE-02/g001/published/audit-report.md \
  --scope-lock audits/audit-governance-recovery-v1/phases/PHASE-02/g001/scope-lock-PHASE-02-g001.json \
  --phase-approval audits/audit-governance-recovery-v1/phases/PHASE-02/g001/phase-approval-decision-PHASE-02-g001.json \
  --session-roles audits/audit-governance-recovery-v1/session-role-manifest.json \
  --pre-change audits/audit-governance-recovery-v1/phases/PHASE-02/g001/pre-change-state.json \
  --verdict-state audits/audit-governance-recovery-v1/phases/PHASE-02/g001/verdict-state.json \
  --producer-release audits/audit-governance-recovery-v1/producer-releases/PHASE-02-closure-candidate.json \
  --session-role AUDITOR \
  --transaction-dir audits/audit-governance-recovery-v1/phases/PHASE-02/g001/closure-transaction
```

The candidate may write only inside `closure-transaction/staged`; it cannot commit, resume, publish, or mark itself accepted. Accepted PHASE-01 control then runs:

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts \
  --adopt-closure-candidate PHASE-02 \
  --plan-root plans/audit-governance-recovery-v1/formal-plan-set \
  --candidate-transaction audits/audit-governance-recovery-v1/phases/PHASE-02/g001/closure-transaction \
  --candidate-release audits/audit-governance-recovery-v1/producer-releases/PHASE-02-closure-candidate.json \
  --phase-decision audits/audit-governance-recovery-v1/phases/PHASE-02/g001/phase-approval-decision-PHASE-02-g001.json \
  --session-role AUDITOR
```

The accepted controller rehashes sources, reruns audit/overlay/plan validation, then journal-commits once. Reuse/live candidate writes fail `STATUS_PUBLICATION_UNAUTHORIZED`; role mismatch fails `SESSION_ROLE_DECLARATION_MISMATCH`.

## Fixed final invocation

The exact 99 invocation supplies `--final`, distinct reports, roles, both states, current release, and transaction. Six accepted chains plus readiness exit 0 precede final receipt, ten gates/index/doc staging, and staged admission.

## Fixed stage order

```text
1 EVIDENCE_PRECHECK
2 VALIDATE_AUDIT
3 STAGE_AUDIT_PUBLICATION
4 STAGE_PROGRESSION_RECEIPT
5 STAGE_STATUS_SYNC
6 VALIDATE_CLOSED_OR_FINAL_OVERLAY
7 VALIDATE_PLAN_OVERLAY
8 COMMIT
```

Stages 6–7 validate the same closed/final overlay; status consumes its staged receipt. Commit requires seven zero exits.

## Transaction and recovery contract

The exclusive transaction holds ledger, stable report/contract refs, staged report/LATEST, projection, receipt, status/snapshots, plan/doc bytes, and journal. Equal report paths fail `REPORT_OUTPUT_COLLISION`.

Stages 1–7 are overlay-only. Commit locks the plan, rechecks before-hashes, atomically renames pre-hashed outputs, and journals each path/hash. Repetition returns the same receipt.

Interruption yields `COMMIT_INTERRUPTED`; exact `--resume` validates the prefix and finishes the suffix. Hash mismatch yields `CLOSURE_STEP_FAILED:COMMIT` and preserves all.

## All-pass fixture inventory

| Object | Creation | Required binding |
|---|---|---|
| accepted report pair | accepted PHASE-01 fixture | scope/approval/roles/states/EVs/release |
| complete PLAN_SET | temporary six-phase tree | admission/dependencies |
| transaction root | real wrapper | absent before call |
| staged overlay | real APIs | report/receipt/status/plan/doc |
| live destinations | temporary tree | frozen before-hashes |
| final bundle | six chains/current release | report/ten gates/marker |

## Isolated mutation matrix

| Test | Only mutation | Exact failure | Later live effects |
|---|---|---|---|
| `GR2-001` | remove one EV | `CLOSURE_STEP_FAILED:EVIDENCE_PRECHECK` | none |
| `GR2-002` | alter report contract | `CLOSURE_STEP_FAILED:VALIDATE_AUDIT` | none |
| `GR2-003` | precreate report destination | `CLOSURE_STEP_FAILED:STAGE_AUDIT_PUBLICATION` | none |
| `GR2-004` | mismatch report hash in receipt | `CLOSURE_STEP_FAILED:STAGE_PROGRESSION_RECEIPT` | none |
| `GR2-005` | supply wrong progression receipt | `CLOSURE_STEP_FAILED:STAGE_STATUS_SYNC` | none |
| `GR2-006` | open dependency/unchecked final gate in overlay | `CLOSURE_STEP_FAILED:VALIDATE_CLOSED_PHASE` | none |
| `GR2-007` | corrupt a registered staged plan file | `CLOSURE_STEP_FAILED:VALIDATE_PLAN` | none |
| `GR2-008` | mutate live destination before commit | `CLOSURE_STEP_FAILED:COMMIT` | none |
| `GR2-009` | interrupt after first rename | `COMMIT_INTERRUPTED`; exact resume succeeds | journaled prefix only |
| `GR2-010` | prepared path equals published destination | `REPORT_OUTPUT_COLLISION` | none |
| `GR2-011` | declared role is IMPLEMENTER | `SESSION_ROLE_DECLARATION_MISMATCH` | none |
| `GR2-012` | stale PHASE-02 release supplied to final | `PRODUCER_RELEASE_MISMATCH` | none |
| `GR2-013` | candidate attempts a live write/commit | `STATUS_PUBLICATION_UNAUTHORIZED` | none |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
/home/zhaoge/.bun/bin/bun test \
  .agents/skills/plan-audit-archiver/scripts/__tests__/pre-check-evidence.test.ts \
  .agents/skills/plan-audit-archiver/scripts/__tests__/finalize-audit.test.ts \
  .agents/skills/plan-audit-archiver/scripts/__tests__/generate-phase-projection.test.ts \
  .agents/skills/plan-audit-archiver/scripts/__tests__/close-audit-phase.test.ts
/home/zhaoge/.bun/bin/bun run typecheck
git diff --check
```

Evidence must include exact exits/counts, every phase/final stage ledger, before/after hashes, interruption journal/resume, CodeGraph output, and allowed-file diff. Any failure is `BLOCKED`.

## Phase completion gate

- [ ] Only the eight allowed files changed.
- [ ] Phase and final modes use the same exact stage order.
- [ ] Every stage has a complete passing fixture and isolated failure.
- [ ] Stages 1–7 prove zero live publication.
- [ ] Final status is staged before final admission, eliminating the final-gate cycle.
- [ ] Commit before-hash, journal, exact resume, and idempotency pass.
- [ ] Fixed tests, typecheck, and diff check pass.
- [ ] Candidate produces staged bytes only; accepted PHASE-01 controller alone adopts and publishes PHASE-02.
- [ ] PHASE-03 onward and final require the accepted wrapper; PHASE-02 never claims it was already accepted.
