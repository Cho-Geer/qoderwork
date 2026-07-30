# Phase PHASE-05: Rules, skills, and active templates

**Phase ID**: `PHASE-05`
**Depends on**: `PHASE-04`
**Outcome**: All active written governance surfaces express the same recovery profile and pass the executable conformance verifier.
**Evidence level**: `file-integration`
**Progression status**: `NOT_STARTED`
**Completion receipt**: `N/A`

## Goal

- Implement `REQ-GR-013` without changing executable governance behavior.
- Use the already accepted `REQ-GR-012` verifier as the independent oracle for the real repository surfaces.

## Starting state and admission

1. PHASE-01 through PHASE-04 are `ACCEPTED`; the conformance CLI is accepted.
2. Auditor A creates PHASE-05 g001 scope and runs P-02A entry admission.
3. Only after exit 0 does HUMAN approve the exact scope.
4. Auditor A captures PRE_CHANGE; then a distinct Implementer B task may write.

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1
/home/zhaoge/.bun/bin/bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts \
  plans/audit-governance-recovery-v1/formal-plan-set PHASE-05
```

Any missing/nonzero prerequisite is `BLOCKED`.

## Allowed files

| Step | Exact path | Anchor/edit |
|---:|---|---|
| 1 | `AGENTS.md` | replace §15 recovery workflow; insert exact A01–A07 markers |
| 2 | `.agents/skills/plan-audit-archiver/SKILL.md` | replace role/pre-audit/write workflow; insert S01–S06 |
| 3 | `.agents/skills/plan-audit-archiver/provenance-rules.md` | replace P-02/P-03/status rules; insert P01–P07 (note: P-02 step 1.5 Pre-Audit Knowledge Required is NOT a replacement target — preserve verbatim) |
| 4 | `.agents/skills/deterministic-implementation-planning/SKILL.md` | replace admission/final/status gates; insert D01–D07 |
| 5 | `.agents/skills/plan-audit-archiver/templates/scope-lock-template.json` | replace with exact scope schema below |
| 6 | `.agents/skills/plan-audit-archiver/templates/evidence-receipt-template.json` | replace with exact EV schema below |
| 7 | `.agents/skills/plan-audit-archiver/templates/audit-report-template.md` | replace with generated-report skeleton below |
| 8 | `.agents/skills/plan-audit-archiver/templates/phase-projection-template.json` | replace with exact projection schema below |

## Pre-audit read gate `[ANALYSIS]`

Per provenance-rules P-02 step 1.5, the v1 PHASE-01 implementer MUST read the 5 mandatory files in full before drafting any audit-report, scope-lock, or EV receipt. The read happens once, before the first audit report is written.

**Mandatory reads** (in order):

1. `.agents/skills/plan-audit-archiver/scripts/validate-audit.ts` — the acceptance oracle. Extract every `issue(errors, ...)` call site as a rule. Each `code` string is an ERROR_CODE the report must not trigger.
2. `.agents/skills/plan-audit-archiver/scripts/pre-check-evidence.ts` — gate-1 of the two-gate validation; its rules are the sole source of truth for evidence-file pre-checks and MUST NOT be paraphrased elsewhere.
3. `.agents/skills/plan-audit-archiver/templates/scope-lock-template.json` — the canonical field shape. Any scope-lock file MUST match field-for-field.
4. `.agents/skills/plan-audit-archiver/templates/audit-report-template.md` and `.agents/skills/plan-audit-archiver/templates/evidence-receipt-template.json` — the canonical report and receipt shapes.

**Read gate artifact**: the PHASE-01 implementer writes `logs/<YYYY-MM-DD>-pre-audit-read-<implementer-task-id>.md` containing, for each of the 5 files: `path`, `line count`, `sha256`, `read timestamp (ISO 8601)`. The artifact is a hard precondition for the first `--emit-producer-release` invocation. SKILL.md L149-173 (`Pre-Audit Knowledge Required [ANALYSIS]`) is the only authoritative description of the requirement; this section is the in-plan cross-reference.

**Why this step exists**: the 2026-07-29 M1 implementation review concluded that 4 audit-report `valid:false` was the root cause of the M1 plan failure. The root cause was: the M1 implementer did NOT read `validate-audit.ts` in full before drafting the audit reports, instead relying on the prior phase's audit report as a template (a process violation per SKILL.md L171). The v1 plan-text revision embeds this step as a P-02 hard constraint so that the v1 implementer cannot repeat the same mistake. Reading the prior phase's audit report as a substitute for the validator source is a process violation.

No other file is permitted in this phase.

## Forbidden behavior

- No executable script/test, plan status, index, log, audit artifact, M1 artifact, or work-one change.
- No options that let an agent choose between manual and mechanical cryptographic preparation.
- No rule that lets Implementer Session B create formal evidence, approve a phase, publish status, or repair an invalid artifact.
- No statement that a validator PASS replaces independent Auditor semantic review.
- No stale `v2.1-required`, manual template-copy, `capture-state --freeze`, cross-lock approval, overall-report multi-phase closure, or direct hardened publication instruction.

## Required cross-surface contract

Each applicable surface must state one deterministic path:

1. Auditor Session A and Implementer Session B are separate product tasks; HUMAN approval binds each exact scope before writes. The sole PHASE-01 waiver is exact, consumed, and non-reusable.
2. Stable plan approval is outside the lock graph; phase approval points to the immutable generation-addressed lock, never the reverse.
3. Mandatory producers derive hashes and create artifacts exclusively; no manual SHA repair or synchronization.
4. One dual-workspace receipt permits only the frozen in-scope qoderwork delta and zero work-one delta.
5. Execution observation and domain observation remain separate.
6. Every normal phase has entry, independent audit, closed-phase validation, progression receipt, and receipt-only status publication; final validation supports staged and committed views.
7. PHASE-02 candidate closure is adopted by its candidate transaction; accepted `close-audit-phase` is mandatory for PHASE-03 onward and final. PHASE-01 uses only its consumed bootstrap transaction.
8. Historical invalid M1 artifacts stay invalid/nonrepairable; re-baselining is a new task after governance final ACCEPT.

AGENTS and both skills must make the P0–P4 boundary explicit:

`AUDIT_RECOVERY_STAGE_BOUNDARY: P0_FREEZE>P1_APPROVAL>P2_IMPLEMENT>P3_AUDIT>P4_FINALIZE`

P0/P1 are Auditor-only freeze/planning/approval; P2 is a separate scoped Implementer task; P3 returns to Auditor for evidence/verdict/publication; P4 permits a new M1 baseline only after governance final ACCEPT.

The text must distinguish mechanical declaration consistency from actual task identity: local scripts do not cryptographically authenticate the caller.

## Exact template contract

Every `REF` is exactly `{"path":"<repo-relative>","sha256":"<64 lowercase hex>"}`. JSON templates contain one object, one discriminator, no comments, and only the keys below.

| Template | Required keys and exact constants |
|---|---|
| `scope-lock-template.json` | `schema_version="audit-scope-lock/v3"`; `document_kind="phase-scope-lock"`; `governance_profile="audit-governance-recovery/v1"`; `phase_id`; `generation`; `status="PENDING_EXTERNAL_DECISION"`; `plan_approval:REF`; `canonical_contract:REF`; `plan_phase:REF`; `session_roles:REF`; `producer_release:REF`; `supersedes:null|REF`; `requirements:string[]`; `allowed_files:string[]`; `impact_analysis:{shared_functions:string[],caller_tests:string[]}` |
| `evidence-receipt-template.json` | `schema_version="audit-evidence-receipt/v3"`; `document_kind="evidence-receipt"`; `governance_profile`; `audit_id`; `evidence_id`; `phase_id`; `decision_case_id`; `requirement_id`; `polarity`; `oracle_id`; `fixture_id`; `scope_lock:REF`; `phase_approval:REF`; `session_roles:REF`; `canonical_contract:REF`; `pre_change_state:REF`; `verdict_state:REF`; `producer_release:REF`; `execution:{observed,exit_code,timed_out}`; `domain_observation:{result,error_code,observations}`; `captured_at` |
| `phase-projection-template.json` | `schema_version="phase-projection/v1"`; `document_kind="phase-projection"`; `governance_profile`; `phase_id`; `status="ACCEPTED"`; `audit_report:REF`; `audit_report_contract:REF`; `scope_lock:REF`; `phase_approval:REF`; `session_roles:REF`; `verdict_state:REF`; `producer_release:REF`; no progression/status/final or overall-report field |

The Markdown template is exactly these anchors plus generated content between them:

```markdown
<!-- GENERATED_FROM_AUDIT_REPORT_CONTRACT -->
# Audit report: {{AUDIT_ID}}
Contract: {{AUDIT_REPORT_CONTRACT_REF}}
Auditor findings source: {{AUDITOR_FINDINGS_REF}}
## Mechanical evidence projection
{{MECHANICAL_PROJECTION}}
## Auditor semantic findings
{{AUDITOR_FINDINGS_VERBATIM}}
## Verdict
{{VERDICT}}
```

Only `prepare-audit.ts` substitutes placeholders. The report and contract outputs are exclusive; findings are read from the immutable Auditor file.

## Check Registry

| Check | PASS condition | Exact failure |
|---|---|---|
| `profile` | all surfaces name recovery profile | `CONFORMANCE_RECOVERY_PROFILE` |
| `sessionBoundary` | role/P0-P4 ownership is consistent | `CONFORMANCE_SESSION_BOUNDARY` |
| `mechanicalProducer` | manual cryptographic preparation forbidden | `CONFORMANCE_MECHANICAL_PRODUCER` |
| `artifactDag` | stable approval and one-way graph stated | `CONFORMANCE_ARTIFACT_DAG` |
| `dualWorkspace` | scoped qoderwork plus zero work-one delta | `CONFORMANCE_DUAL_WORKSPACE` |
| `statusSync` | phase-specific admission and sync-only status | `CONFORMANCE_STATUS_SYNC` |
| `closure` | single wrapper/order/fail-fast stated | `CONFORMANCE_CLOSURE` |
| `historicalBoundary` | M1 invalid artifacts not repairable | `CONFORMANCE_HISTORICAL_BOUNDARY` |
| `staleText` | every forbidden marker absent | `CONFORMANCE_STALE_TEXT` |

## Fixed verification

Run each command separately; no negative search is hidden behind `!`, a pipe, or a compound shell expression.

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1
/home/zhaoge/.bun/bin/bun run scripts/check-audit-governance-recovery-conformance.ts \
  --repository-root /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1 \
  --profile governance-surfaces
/home/zhaoge/.bun/bin/bun test scripts/__tests__/check-audit-governance-recovery-conformance.test.ts
/home/zhaoge/.bun/bin/bun -e 'for (const p of [".agents/skills/plan-audit-archiver/templates/scope-lock-template.json",".agents/skills/plan-audit-archiver/templates/evidence-receipt-template.json",".agents/skills/plan-audit-archiver/templates/phase-projection-template.json"]) JSON.parse(await Bun.file(p).text()); console.log("templates:ok")'
/home/zhaoge/.bun/bin/bun run typecheck
git diff --check
```

Required conformance output is `ok:true` and `failedChecks:[]`. Evidence also includes exact exits/counts, per-surface check records, JSON parse output, and allowed-file diff. Any failure is `BLOCKED`; no marker is waived.

## Auditor closure commands

After Implementer B stops, Auditor A runs:

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1
export AUDIT_RECOVERY_PHASE_DIR=audits/audit-governance-recovery-v1/phases/PHASE-05/g001
export AUDIT_RECOVERY_RELEASE=audits/audit-governance-recovery-v1/producer-releases/PHASE-05-g001.json
bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts \
  --emit-producer-release --canonical plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml \
  --case-set PHASE-05 --object-root audits/audit-governance-recovery-v1/objects/sha256 --output "$AUDIT_RECOVERY_RELEASE"
bun run .agents/skills/plan-audit-archiver/scripts/capture-state.ts --state-kind VERDICT \
  --qoderwork-root /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1 \
  --work-one-root /home/zhaoge/workspace/opencode/work-one \
  --scope-lock "$AUDIT_RECOVERY_PHASE_DIR/scope-lock-PHASE-05-g001.json" \
  --phase-approval "$AUDIT_RECOVERY_PHASE_DIR/phase-approval-decision-PHASE-05-g001.json" \
  --session-roles audits/audit-governance-recovery-v1/session-role-manifest.json \
  --producer-release "$AUDIT_RECOVERY_RELEASE" --output "$AUDIT_RECOVERY_PHASE_DIR/verdict-state.json"
```

Auditor A independently sweeps and writes only
`audits/audit-governance-recovery-v1/phases/PHASE-05/g001/auditor-findings.md`; a blocker stops.

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1
export AUDIT_RECOVERY_PHASE_DIR=audits/audit-governance-recovery-v1/phases/PHASE-05/g001
export AUDIT_RECOVERY_RELEASE=audits/audit-governance-recovery-v1/producer-releases/PHASE-05-g001.json
bun run .agents/skills/plan-audit-archiver/scripts/generate-evidence-receipt.ts \
  --audit-id AUDIT-GOVERNANCE-RECOVERY-PHASE-05-g001 \
  --canonical plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml --generate-case-set PHASE-05 \
  --scope-lock "$AUDIT_RECOVERY_PHASE_DIR/scope-lock-PHASE-05-g001.json" \
  --phase-approval "$AUDIT_RECOVERY_PHASE_DIR/phase-approval-decision-PHASE-05-g001.json" \
  --pre-change "$AUDIT_RECOVERY_PHASE_DIR/pre-change-state.json" --verdict-state "$AUDIT_RECOVERY_PHASE_DIR/verdict-state.json" \
  --producer-release "$AUDIT_RECOVERY_RELEASE" --output-dir "$AUDIT_RECOVERY_PHASE_DIR/evidence"
bun run .agents/skills/plan-audit-archiver/scripts/prepare-audit.ts \
  --scope-lock "$AUDIT_RECOVERY_PHASE_DIR/scope-lock-PHASE-05-g001.json" \
  --phase-approval "$AUDIT_RECOVERY_PHASE_DIR/phase-approval-decision-PHASE-05-g001.json" \
  --auditor-findings "$AUDIT_RECOVERY_PHASE_DIR/auditor-findings.md" --evidence-dir "$AUDIT_RECOVERY_PHASE_DIR/evidence" \
  --pre-change "$AUDIT_RECOVERY_PHASE_DIR/pre-change-state.json" --verdict-state "$AUDIT_RECOVERY_PHASE_DIR/verdict-state.json" \
  --producer-release "$AUDIT_RECOVERY_RELEASE" --object-root audits/audit-governance-recovery-v1/objects/sha256 \
  --output-dir "$AUDIT_RECOVERY_PHASE_DIR/prepared"
bun run .agents/skills/plan-audit-archiver/scripts/validate-audit.ts "$AUDIT_RECOVERY_PHASE_DIR/prepared/audit-report.md"
bun run .agents/skills/plan-audit-archiver/scripts/close-audit-phase.ts \
  --workspace-root /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1 \
  --plan-root plans/audit-governance-recovery-v1/formal-plan-set --phase PHASE-05 \
  --prepared-report "$AUDIT_RECOVERY_PHASE_DIR/prepared/audit-report.md" \
  --published-report "$AUDIT_RECOVERY_PHASE_DIR/published/audit-report.md" \
  --scope-lock "$AUDIT_RECOVERY_PHASE_DIR/scope-lock-PHASE-05-g001.json" \
  --phase-approval "$AUDIT_RECOVERY_PHASE_DIR/phase-approval-decision-PHASE-05-g001.json" \
  --session-roles audits/audit-governance-recovery-v1/session-role-manifest.json \
  --pre-change "$AUDIT_RECOVERY_PHASE_DIR/pre-change-state.json" --verdict-state "$AUDIT_RECOVERY_PHASE_DIR/verdict-state.json" \
  --producer-release "$AUDIT_RECOVERY_RELEASE" --session-role AUDITOR \
  --transaction-dir "$AUDIT_RECOVERY_PHASE_DIR/closure-transaction"
```

Every command exits 0; `validate-audit` returns `valid:true, errors:[], verdict:ACCEPT`. Otherwise stop.

## Phase completion gate

- [ ] Only the eight allowed files changed.
- [ ] Every surface states the same role, approval, DAG, producer, state, progression, and closure contract.
- [ ] Templates parse and name mandatory producers.
- [ ] Every stale instruction is absent by an independent tri-state check.
- [ ] Real-repository conformance returns `ok:true` with no failed check.
- [ ] Fixed tests, typecheck, and diff check pass.
- [ ] Auditor Session A independently audits and publishes PHASE-05 `ACCEPT`.
- [ ] PHASE-06 remains blocked until the receipt/status chain validates.
- [ ] Pre-audit read gate completed and recorded in `logs/<YYYY-MM-DD>-pre-audit-read-<implementer-task-id>.md` with the 5 mandatory file reads (path, line count, sha256, timestamp).
