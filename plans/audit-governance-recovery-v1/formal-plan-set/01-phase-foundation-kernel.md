# Phase PHASE-01: Recovery foundation kernel

**Phase ID**: `PHASE-01`
**Depends on**: `NONE`
**Outcome**: Establish mechanical artifacts, immutable inputs/releases, admission, and receipt-only status.
**Evidence level**: `file-integration`
**Progression status**: `NOT_STARTED`
**Completion receipt**: `N/A`

## Goal and owned requirements

Implement `REQ-GR-001`, `REQ-GR-004`–`REQ-GR-010`; consume the sole waiver. PHASE-02 onward has no legacy/manual path.

## Two ordered HUMAN decisions

P-02A cannot repair its blocker. HUMAN decision 1 binds canonical, manifest, baseline, and exceptions; it authorizes target materialization, not unknown scope.

Auditor A then:

1. runs canonical `materialization_commands`;
2. creates a distinct, blocked Implementer B product task and records both task IDs;
3. freezes scope, qoderwork baseline, and phase request with those IDs;
4. obtains HUMAN decision 2 binding the request/scope/baseline/IDs;
5. captures clean work-one and runs canonical `prewrite_verification_command`;
6. only its `ok:true` receipt permits the Implementer task to write.

Only these bootstrap exceptions exist:

```text
PHASE-01_P02A_ENTRY_WHILE_INDEX_BLOCKED
EXTERNAL_HUMAN_DECISION_FOR_PENDING_IMMUTABLE_LOCK
SUPPLEMENTAL_QODERWORK_BASELINE_WITH_WORK_ONE_P07_ANCHOR
CANDIDATE_BOOTSTRAP_ACTIVATION_AND_CLOSE_AFTER_VALID_AUDIT
```

Canonical prewrite Bun uses awaited hashes, checks Rplan/Dplan/S/Q/Rphase/Dphase/W, waivers, roots/HEADs, and distinct actual task IDs, then exclusively writes its receipt. Auditor verifies IDs against orchestration.

## Allowed files and exact edits

| Step | Exact path | Exact symbol/anchor and edit |
|---:|---|---|
| 1 | `.agents/skills/plan-audit-archiver/scripts/validate-audit.ts` | `verifyJsonReference` and receipt/report validators: recovery decision, legacy-Q, release, contract checks; preserve v3 |
| 2 | `.agents/skills/plan-audit-archiver/scripts/capture-state.ts` | `RepositoryStateReceipt`, `captureRepositoryState`, CLI: dual states and one-use bootstrap upgrade |
| 3 | `.agents/skills/plan-audit-archiver/scripts/generate-evidence-receipt.ts` | load canonical case set; execute/parse exact commands; emit separate execution/domain observations |
| 4 | `.agents/skills/plan-audit-archiver/scripts/prepare-audit.ts` | emit content-addressed contract object and immutable prepared report |
| 5 | `.agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts` | `validatePlanSet`: export model; validate manifest/files/owners/status/receipts/gates |
| 6 | `.agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts` | add inputs/releases, admission/status/final, bootstrap close, PHASE-02 candidate adoption |
| 7 | `.agents/skills/plan-audit-archiver/scripts/__tests__/foundation-kernel.test.ts` | all-pass fixture plus isolated audit mutations |
| 8 | `.agents/skills/deterministic-implementation-planning/scripts/foundation-kernel.test.ts` | full-plan, journal/resume, staged/live-final fixtures |

No other file is permitted.

## Producer contracts

### Bootstrap state upgrade and normal dual state

Canonical `phase_01_release_command` resolves the fixed registry/imports and exclusively writes immutable source objects plus `PHASE-01-foundation.json`.

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1
bun run .agents/skills/plan-audit-archiver/scripts/capture-state.ts \
  --upgrade-bootstrap-pre-change \
  --qoderwork-baseline audits/audit-governance-recovery-v1/bootstrap/qoderwork-baseline-PHASE-01.json \
  --work-one-baseline audits/audit-governance-recovery-v1/bootstrap/pre-change-work-one-PHASE-01.json \
  --scope-lock audits/audit-governance-recovery-v1/bootstrap/scope-lock-PHASE-01-g001.json \
  --phase-approval audits/audit-governance-recovery-v1/bootstrap/phase-approval-decision-PHASE-01-g001.json \
  --producer-release audits/audit-governance-recovery-v1/producer-releases/PHASE-01-foundation.json \
  --output audits/audit-governance-recovery-v1/phases/PHASE-01/g001/pre-change-state.json
```

Upgrade records source hashes/times plus `materialized_at`; effective time is the earlier capture. After Implementer B stops, Auditor A captures VERDICT:

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1
export AUDIT_RECOVERY_PHASE_DIR=audits/audit-governance-recovery-v1/phases/PHASE-01/g001
bun run .agents/skills/plan-audit-archiver/scripts/capture-state.ts --state-kind VERDICT \
  --qoderwork-root /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1 \
  --work-one-root /home/zhaoge/workspace/opencode/work-one \
  --scope-lock audits/audit-governance-recovery-v1/bootstrap/scope-lock-PHASE-01-g001.json \
  --phase-approval audits/audit-governance-recovery-v1/bootstrap/phase-approval-decision-PHASE-01-g001.json \
  --session-roles audits/audit-governance-recovery-v1/session-role-manifest.json \
  --producer-release audits/audit-governance-recovery-v1/producer-releases/PHASE-01-foundation.json \
  --output "$AUDIT_RECOVERY_PHASE_DIR/verdict-state.json"
```

Later phases use native `PRE_CHANGE|VERDICT`. Missing workspace fails `WORKSPACE_STATE_MISSING`; unauthorized delta fails `WORKSPACE_DELTA_OUT_OF_SCOPE`.

### EV, findings, and prepared report

Only after VERDICT, Auditor A independently sweeps and writes semantics only to the following path; a blocker stops:

`audits/audit-governance-recovery-v1/phases/PHASE-01/g001/auditor-findings.md`

The canonical `evidence_case_registry.PHASE-01` owns all 16 positive/negative cases for the eight requirements. One command executes them in registry order:

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1
bun run .agents/skills/plan-audit-archiver/scripts/generate-evidence-receipt.ts \
  --audit-id AUDIT-GOVERNANCE-RECOVERY-PHASE-01-g001 \
  --canonical plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml \
  --generate-case-set PHASE-01 \
  --scope-lock audits/audit-governance-recovery-v1/bootstrap/scope-lock-PHASE-01-g001.json \
  --phase-approval audits/audit-governance-recovery-v1/bootstrap/phase-approval-decision-PHASE-01-g001.json \
  --pre-change audits/audit-governance-recovery-v1/phases/PHASE-01/g001/pre-change-state.json \
  --verdict-state audits/audit-governance-recovery-v1/phases/PHASE-01/g001/verdict-state.json \
  --producer-release audits/audit-governance-recovery-v1/producer-releases/PHASE-01-foundation.json \
  --output-dir audits/audit-governance-recovery-v1/phases/PHASE-01/g001/evidence
bun run .agents/skills/plan-audit-archiver/scripts/prepare-audit.ts \
  --scope-lock audits/audit-governance-recovery-v1/bootstrap/scope-lock-PHASE-01-g001.json \
  --phase-approval audits/audit-governance-recovery-v1/bootstrap/phase-approval-decision-PHASE-01-g001.json \
  --auditor-findings audits/audit-governance-recovery-v1/phases/PHASE-01/g001/auditor-findings.md \
  --evidence-dir audits/audit-governance-recovery-v1/phases/PHASE-01/g001/evidence \
  --pre-change audits/audit-governance-recovery-v1/phases/PHASE-01/g001/pre-change-state.json \
  --verdict-state audits/audit-governance-recovery-v1/phases/PHASE-01/g001/verdict-state.json \
  --producer-release audits/audit-governance-recovery-v1/producer-releases/PHASE-01-foundation.json \
  --object-root audits/audit-governance-recovery-v1/objects/sha256 \
  --output-dir audits/audit-governance-recovery-v1/phases/PHASE-01/g001/prepared
```

Prepared/published report views share one content-addressed contract; publication copies only report bytes.

### Phase inputs, releases, admission, and status

`validate-phase-progression.ts` has exact mutually exclusive modes:

```text
--create-session-manifest --plan-decision path --auditor-task-id id --implementer-task-id id --output audits/.../session-role-manifest.json
--create-scope-lock --phase PHASE-02 --generation 1 --plan-decision path --session-roles path --output audits/.../phases/PHASE-02/g001/scope-lock-PHASE-02-g001.json
--create-phase-approval-request --phase PHASE-02 --plan-decision path --scope-lock path --session-roles path --output audits/.../phases/PHASE-02/g001/phase-approval-request-PHASE-02-g001.json
--emit-producer-release --canonical path --case-set id --object-root path --output path
PLAN_ROOT PHASE-02
PLAN_ROOT --closed-phase PHASE-02 --overlay-root audits/.../phases/PHASE-02/g001/closure-transaction/staged
PLAN_ROOT --final-readiness
PLAN_ROOT --final
PLAN_ROOT --final --overlay-root audits/.../final/g001/closure-transaction/staged
--stage-status --phase PHASE-02 --progression-receipt path --transaction-dir path
--stage-final-status --final-receipt path --transaction-dir path
```

Order: scope → entry 0 → HUMAN approval → PRE_CHANGE → write. g001 forbids `supersedes`; later generations bind the immediate prior. Outputs are exclusive; readiness requires six accepted phases.

**Boundary with PHASE-02**: PHASE-01 ENABLES the modes `validate-phase-progression.ts` supports (`--create-scope-lock`, `--create-phase-approval-request`, `--emit-producer-release`, `--closed-phase`, `--final-readiness`, `--final`, `--stage-status`, `--stage-final-status`). PHASE-01 does NOT own the closure wrapper or the candidate-staging transaction. PHASE-02 INVOKES these modes as already-accepted tooling and ADDS the `close-audit-phase.ts` `--adopt-closure-candidate PHASE-02` flag plus the candidate staging + adoption transaction (`02-phase-single-closure-entrypoint.md` L102-137). The division is: PHASE-01 is the admission/status machine factory; PHASE-02 is the closure wrapper. This boundary eliminates the historical overlap where PHASE-02's allowed-files included `close-audit-phase.ts` AND PHASE-01's `validate-phase-progression.ts` work; each phase now owns exactly one tier.

## One-use PHASE-01 adoption transaction

After candidate `validate-audit` returns `valid:true`, Auditor Session A runs:

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1
bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts \
  --bootstrap-activate-and-close PHASE-01 \
  --plan-root plans/audit-governance-recovery-v1/formal-plan-set \
  --prepared-report audits/audit-governance-recovery-v1/phases/PHASE-01/g001/prepared/audit-report.md \
  --plan-decision audits/audit-governance-recovery-v1/approval-decision-r4.json \
  --phase-decision audits/audit-governance-recovery-v1/bootstrap/phase-approval-decision-PHASE-01-g001.json \
  --producer-release audits/audit-governance-recovery-v1/producer-releases/PHASE-01-foundation.json \
  --transaction-dir audits/audit-governance-recovery-v1/phases/PHASE-01/g001/bootstrap-closure-transaction
```

Stages are bootstrap/audit validation, report/receipt/status staging, closed-phase/plan validation, then commit. Before-hashes, lock, journal, `COMMIT_INTERRUPTED`, and exact resume are mandatory; activation binds both decisions and consumes the waiver.

## Check Registry

| Check family | Isolated mutations and exact failures |
|---|---|
| `bootstrapBindings` | missing/broadened/reused waiver → `BOOTSTRAP_WAIVER_INVALID` |
| `sessionIdentity` | missing ID → `SESSION_ROLE_MISSING`; equal IDs → `SESSION_ROLE_COLLISION` |
| `scopeGeneration` | existing output → `SCOPE_LOCK_MUTATION_FORBIDDEN`; skipped prior → `SCOPE_LOCK_GENERATION_INVALID` |
| `workspacePair` | missing repository → `WORKSPACE_STATE_MISSING`; out-of-scope delta → `WORKSPACE_DELTA_OUT_OF_SCOPE` |
| `producerEnvelope` | no release → `PRODUCER_METADATA_MISSING`; drift → `PRODUCER_RELEASE_MISMATCH` |
| `executionLiteral` | changed execution field → `EXECUTION_OBSERVATION_MISMATCH` |
| `domainLiteral` | changed domain → `DOMAIN_OBSERVATION_MISMATCH`; reused positive/negative EV → `CONTROL_EVIDENCE_NOT_INDEPENDENT` |
| `reportPair` | missing contract/findings or precreated output → `PREPARED_REPORT_INCOMPLETE` |
| `planManifest` | duplicate/unregistered phase or owner → `PLAN_PHASE_MANIFEST_MISMATCH` |
| `phaseAdmission` | skipped/invalid closed phase → `PHASE_ADMISSION_ORDER_MISMATCH` / `PHASE_CLOSURE_STATE_MISMATCH` |
| `finalModes` | incomplete chain/gate → `PHASE_CLOSURE_STATE_MISMATCH` / `PLAN_FINAL_GATE_INCOMPLETE` |
| `bootstrapTransaction` | extra activation field → `STATUS_PUBLICATION_UNAUTHORIZED`; partial commit → `COMMIT_INTERRUPTED`/resume |

Each mutation starts all-pass, yields its listed failure, and preserves destinations.

## Fixed verification and numbered execution

1. Query CodeGraph impact/callers for all six modified sources.
2. Implement allowed steps 1–8 in order; existing tests stay unchanged.
3. Run:

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1
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

4. Implementer B returns outputs and stops. Auditor A produces the audit, obtains `valid:true`, then alone runs adoption.

## Phase completion gate

- [ ] Only the eight allowed files changed; all legacy tests remain unedited and pass.
- [ ] Both HUMAN decisions and prewrite bootstrap precheck pass.
- [ ] PHASE-01 has native dual PRE_CHANGE/VERDICT, independent EVs, immutable findings, and prepared/published report separation.
- [ ] Session/scope/release/state/evidence/report outputs are mechanical and write-once.
- [ ] Entry/closed/readiness/final/status modes pass complete and isolated failure fixtures.
- [ ] Bootstrap progression/activation/status transaction passes interruption/resume and is consumed once.
- [ ] Fixed tests, typecheck, diff check, CodeGraph, and allowed-file diff pass.
- [ ] Auditor Session A publishes PHASE-01 `ACCEPT`; PHASE-02 remains blocked until its receipt/status chain validates.
