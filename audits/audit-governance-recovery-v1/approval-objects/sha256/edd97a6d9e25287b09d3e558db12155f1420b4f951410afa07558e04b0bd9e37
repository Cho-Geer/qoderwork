# Phase PHASE-06: Documentation projection and final-audit handoff

**Phase ID**: `PHASE-06`
**Depends on**: `PHASE-05`
**Outcome**: Project indexes and the implementation log truthfully record implemented governance pending an independent final audit.
**Evidence level**: `file-integration`
**Progression status**: `NOT_STARTED`
**Completion receipt**: `N/A`

## Goal

- Implement `REQ-GR-014`.
- Hand the complete implementation back to Auditor Session A without prematurely claiming final acceptance.

## Starting state and admission

1. PHASE-01 through PHASE-05 are individually `ACCEPTED`.
2. Auditor A creates PHASE-06 g001 scope and runs P-02A entry admission.
3. Only after exit 0 does HUMAN approve that exact scope.
4. Auditor A captures PRE_CHANGE; then a distinct Implementer B task may write.

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
/home/zhaoge/.bun/bin/bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts \
  plans/audit-governance-recovery-v1/formal-plan-set PHASE-06
```

Any missing/nonzero prerequisite is `BLOCKED`.

## Allowed files (Implementer B scope)

| Step | Exact path | Anchor/edit |
|---:|---|---|
| 1 | `documents/INDEX.md` | replace one `AUDIT_GOVERNANCE_RECOVERY_V1` block |
| 2 | `logs/INDEX.md` | add one active and one governance-topic link |

No other file is permitted in this phase. The implementation-evidence log (`logs/2026-07-30-audit-governance-recovery-implementation.md`) is NOT in Implementer B's allowed-files; it is Auditor A's exclusive write (see `## Auditor implementation log` below).

## Auditor implementation log (Auditor Session A only)

The implementation-evidence log `logs/2026-07-30-audit-governance-recovery-implementation.md` is written by Auditor Session A after Implementer B has stopped and the Auditor has independently re-run the PHASE-00..06 fixed-verification commands. This enforces `closed_decisions.DEC-GR-002` (Auditor A may not author governance source changes, but may author post-acceptance evidence logs) and the boundary that "Implementer B cannot author or publish formal audit/progression/status artifacts" (00-plan-index §2 P3 row).

**Format** (≤20 lines, AUDIT-GOVERNANCE-RECOVERY-V1 contract):

```
# Audit Governance Recovery v1 — Implementation Evidence Log

- audit_session: <Auditor Session A id>
- captured_at: <ISO 8601 timestamp>
- plan_id: AUDIT-GOVERNANCE-RECOVERY-V1-20260730
- evidence_ceiling: file-integration
- pre-audit-read-gate: logs/<YYYY-MM-DD>-pre-audit-read-<implementer-task-id>.md (sha256, line count, timestamp)
- distinct-tasks: Implementer B id != Auditor A id
- phases: PHASE-00..06 each = ACCEPTED, progression-receipt, scope-lock, audit-report all sha256 listed
- m1-artifacts: unchanged/nonrepairable; P0 freeze manifest sha256 listed
- remaining-gate: 99-final-verification GATE-GR-FINAL-001..010
- updated-docs: documents/INDEX.md, logs/INDEX.md, plans/audit-governance-recovery-v1/formal-plan-set/*.md, .agents/skills/plan-audit-archiver/provenance-rules.md
- p4: blocked until final ACCEPT
- final-authority: AUDITOR_SESSION_A
- line_count: 17
```

**When the log is written**: after the PHASE-06 `Fixed verification` returns `ok:true, failedChecks:[]` AND Auditor A's independent sweep finds no blocker. The log write is one of the `## Auditor closure commands` (below) — NOT an allowed-file in Implementer B's table.

## Handoff and final convergence

1. Implementer Session B stops after fixed verification and returns exact outputs to Auditor Session A.
2. Auditor A creates formal PHASE-06 evidence, independently sweeps, and runs the wrapper.
3. After PHASE-06 `ACCEPT`, Auditor A alone executes `99-final-verification.md`.
4. Only a final `ACCEPT` permits final sync to change the registered documents projection from pending to accepted.
5. Any final finding produces one consolidated `REWORK`; P4 and M1 re-baselining remain blocked.
6. Auditor A (not Implementer B) writes the implementation-evidence log per the `## Auditor implementation log` section above.

## Forbidden behavior

- No code, test, rule, skill, template, plan/audit status, M1 artifact, or work-one change.
- No `ACCEPTED`, `COMPLETE`, `CLOSED`, runtime, live-LLM, or M1-recovered claim for this plan.
- No overwriting historical logs or presenting Implementer self-checks as independent audit evidence.
- No final status sync by Implementer Session B.

## Fixed content contract

### `documents/INDEX.md`

Register the recovery governance documents and use exactly:

```text
<!-- AUDIT_GOVERNANCE_RECOVERY_V1_START -->
<!-- AUDIT_GOVERNANCE_RECOVERY_V1_STATUS: IMPLEMENTED_PENDING_FINAL_AUDIT -->
Evidence ceiling: file-integration
Final authority: Auditor Session A
Final audit status: PENDING_AUDITOR_FINAL_CLOSURE
<!-- AUDIT_GOVERNANCE_RECOVERY_V1_END -->
```

The entry links the canonical, plan index, final verification, and audit directory. It states that PHASE-01 through PHASE-06 implementation evidence exists but final audit/status is pending.

### Implementation log

The new log is no more than 20 lines and records:

- reason: governance recovery following invalid M1 provenance;
- exact implementation phases and changed-surface categories;
- exact mechanical command results with evidence levels;
- separate Implementer and Auditor product task IDs;
- historical M1 artifacts unchanged/nonrepairable;
- remaining gate: Auditor final sweep plus final closure transaction;
- all updated documents.

It must not duplicate a raw diff or claim final acceptance.

### `logs/INDEX.md`

Register the exact log path under the current active and governance topic views with the same `IMPLEMENTED_PENDING_FINAL_AUDIT` state. Do not move/archive any existing entry.

## Check Registry

| Check | PASS condition | Exact failure |
|---|---|---|
| `docStatus` | one bounded block, exact pending marker/links, no final claim inside block | `DOC_STATUS_PREMATURE_OR_MISSING` |
| `implementationLog` | nonempty, at most 20 lines, exact phases/levels/roles/M1/gate/docs facts present | `IMPLEMENTATION_LOG_CONTRACT` |
| `logIndex` | exact log path appears once under active view and once under governance view | `LOG_INDEX_CONTRACT` |
| `allowedDiff` | only three files changed in this phase | phase `REWORK` |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
/home/zhaoge/.bun/bin/bun run scripts/check-audit-governance-recovery-conformance.ts \
  --repository-root /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap \
  --profile implementation-docs
/home/zhaoge/.bun/bin/bun run typecheck
git diff --check
```

Required output: `ok:true, failedChecks:[]`; evidence includes query observations, line count, three-file diff, and last PHASE-05 progression. Failure is `BLOCKED`.

## Handoff and final convergence

1. Implementer Session B stops after fixed verification and returns exact outputs to Auditor Session A.
2. Auditor A creates formal PHASE-06 evidence, independently sweeps, and runs the wrapper.
3. After PHASE-06 `ACCEPT`, Auditor A alone executes `99-final-verification.md`.
4. Only a final `ACCEPT` permits final sync to change the registered documents projection from pending to accepted.
5. Any final finding produces one consolidated `REWORK`; P4 and M1 re-baselining remain blocked.

## Auditor closure commands

After Implementer B stops, Auditor A runs:

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
export AUDIT_RECOVERY_PHASE_DIR=audits/audit-governance-recovery-v1/phases/PHASE-06/g001
export AUDIT_RECOVERY_RELEASE=audits/audit-governance-recovery-v1/producer-releases/PHASE-06-g001.json
bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts \
  --emit-producer-release --canonical plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml \
  --case-set PHASE-06 --object-root audits/audit-governance-recovery-v1/objects/sha256 --output "$AUDIT_RECOVERY_RELEASE"
bun run .agents/skills/plan-audit-archiver/scripts/capture-state.ts --state-kind VERDICT \
  --qoderwork-root /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap \
  --work-one-root /home/zhaoge/workspace/opencode/work-one \
  --scope-lock "$AUDIT_RECOVERY_PHASE_DIR/scope-lock-PHASE-06-g001.json" \
  --phase-approval "$AUDIT_RECOVERY_PHASE_DIR/phase-approval-decision-PHASE-06-g001.json" \
  --session-roles audits/audit-governance-recovery-v1/session-role-manifest.json \
  --producer-release "$AUDIT_RECOVERY_RELEASE" --output "$AUDIT_RECOVERY_PHASE_DIR/verdict-state.json"
```

Auditor A independently sweeps and writes only
`audits/audit-governance-recovery-v1/phases/PHASE-06/g001/auditor-findings.md`; a blocker stops.

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
export AUDIT_RECOVERY_PHASE_DIR=audits/audit-governance-recovery-v1/phases/PHASE-06/g001
export AUDIT_RECOVERY_RELEASE=audits/audit-governance-recovery-v1/producer-releases/PHASE-06-g001.json
bun run .agents/skills/plan-audit-archiver/scripts/generate-evidence-receipt.ts \
  --audit-id AUDIT-GOVERNANCE-RECOVERY-PHASE-06-g001 \
  --canonical plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml --generate-case-set PHASE-06 \
  --scope-lock "$AUDIT_RECOVERY_PHASE_DIR/scope-lock-PHASE-06-g001.json" \
  --phase-approval "$AUDIT_RECOVERY_PHASE_DIR/phase-approval-decision-PHASE-06-g001.json" \
  --pre-change "$AUDIT_RECOVERY_PHASE_DIR/pre-change-state.json" --verdict-state "$AUDIT_RECOVERY_PHASE_DIR/verdict-state.json" \
  --producer-release "$AUDIT_RECOVERY_RELEASE" --output-dir "$AUDIT_RECOVERY_PHASE_DIR/evidence"
bun run .agents/skills/plan-audit-archiver/scripts/prepare-audit.ts \
  --scope-lock "$AUDIT_RECOVERY_PHASE_DIR/scope-lock-PHASE-06-g001.json" \
  --phase-approval "$AUDIT_RECOVERY_PHASE_DIR/phase-approval-decision-PHASE-06-g001.json" \
  --auditor-findings "$AUDIT_RECOVERY_PHASE_DIR/auditor-findings.md" --evidence-dir "$AUDIT_RECOVERY_PHASE_DIR/evidence" \
  --pre-change "$AUDIT_RECOVERY_PHASE_DIR/pre-change-state.json" --verdict-state "$AUDIT_RECOVERY_PHASE_DIR/verdict-state.json" \
  --producer-release "$AUDIT_RECOVERY_RELEASE" --object-root audits/audit-governance-recovery-v1/objects/sha256 \
  --output-dir "$AUDIT_RECOVERY_PHASE_DIR/prepared"
bun run .agents/skills/plan-audit-archiver/scripts/validate-audit.ts "$AUDIT_RECOVERY_PHASE_DIR/prepared/audit-report.md"
bun run .agents/skills/plan-audit-archiver/scripts/close-audit-phase.ts \
  --workspace-root /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap \
  --plan-root plans/audit-governance-recovery-v1/formal-plan-set --phase PHASE-06 \
  --prepared-report "$AUDIT_RECOVERY_PHASE_DIR/prepared/audit-report.md" \
  --published-report "$AUDIT_RECOVERY_PHASE_DIR/published/audit-report.md" \
  --scope-lock "$AUDIT_RECOVERY_PHASE_DIR/scope-lock-PHASE-06-g001.json" \
  --phase-approval "$AUDIT_RECOVERY_PHASE_DIR/phase-approval-decision-PHASE-06-g001.json" \
  --session-roles audits/audit-governance-recovery-v1/session-role-manifest.json \
  --pre-change "$AUDIT_RECOVERY_PHASE_DIR/pre-change-state.json" --verdict-state "$AUDIT_RECOVERY_PHASE_DIR/verdict-state.json" \
  --producer-release "$AUDIT_RECOVERY_RELEASE" --session-role AUDITOR \
  --transaction-dir "$AUDIT_RECOVERY_PHASE_DIR/closure-transaction"
```

Every command exits 0; `validate-audit` returns `valid:true, errors:[], verdict:ACCEPT`. Otherwise stop.

## Phase completion gate

- [ ] Only the three allowed files changed.
- [ ] All entries use `IMPLEMENTED_PENDING_FINAL_AUDIT`.
- [ ] The implementation log is nonempty, at most 20 lines, and evidence-layer accurate.
- [ ] Historical M1 invalid/nonrepairable status is explicit.
- [ ] Fixed document checks, typecheck, and diff check pass.
- [ ] Implementer Session B stops and hands off without final publication.
- [ ] Auditor Session A independently audits and publishes PHASE-06 `ACCEPT`.
- [ ] Final verification remains a separate Auditor-only step.
