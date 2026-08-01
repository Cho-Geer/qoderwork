# Audit Governance Recovery v1 — Final Verification

**Document kind**: `plan-final-verification`
**Current evidence ceiling**: `NOT-RUN`
**Final authority**: `AUDITOR_SESSION_A`
**Final status source**: committed `close-audit-phase --final`

## Pre-final readiness (no final publication)

Run after PHASE-00..06 `ACCEPTED`; this section does not publish.

### 0. Final preflight — worktree + bytes-mirror + 9-r8 artifacts must exist

Before the 99-final verification block runs, Auditor A MUST execute this preflight as a hard-gate check. Any failure exits with code 11 and reports `STATUS_PUBLICATION_UNAUTHORIZED`.

```bash
set -euo pipefail
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
test -d /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap || { echo "BLOCKED: target worktree missing"; exit 11; }
test -f audits/audit-governance-recovery-v1/approved-plan-files-r8.sha256 || { echo "BLOCKED: r8 manifest missing"; exit 11; }
test -d audits/audit-governance-recovery-v1/bootstrap/approved-plan-bytes-r8 || { echo "BLOCKED: r8 bytes-mirror missing"; exit 11; }
test -f audits/audit-governance-recovery-v1/approval-decision-r8.json || { echo "BLOCKED: r8 approval decision missing"; exit 11; }
sha256sum --check audits/audit-governance-recovery-v1/approved-plan-files-r8.sha256 || { echo "BLOCKED: r8 manifest hash mismatch"; exit 11; }
```

The worktree path was renamed from `audit-governance-recovery-v1` to `audit-governance-recovery-v1-bootstrap` to disambiguate from the historical `audit-governance-v2` and `audit-governance-v3` worktrees (which were abandoned predecessor attempts and are not the v1 plan target).

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
cd audits/audit-governance-recovery-v1/bootstrap/approved-plan-bytes-r8
sha256sum --check audits/audit-governance-recovery-v1/approved-plan-files-r8.sha256
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
/home/zhaoge/.bun/bin/bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts plans/audit-governance-recovery-v1/formal-plan-set /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
/home/zhaoge/.bun/bin/bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts plans/audit-governance-recovery-v1/formal-plan-set --final-readiness
/home/zhaoge/.bun/bin/bun test \
  .agents/skills/plan-audit-archiver/scripts/__tests__ \
  .agents/skills/deterministic-implementation-planning/scripts \
  scripts/lib/__tests__/audit-governance-schema-v3.test.ts \
  scripts/lib/__tests__/artifact-reference-graph.test.ts \
  scripts/__tests__/check-audit-governance-recovery-conformance.test.ts
/home/zhaoge/.bun/bin/bun run scripts/check-audit-governance-recovery-conformance.ts \
  --repository-root /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap --profile all
/home/zhaoge/.bun/bin/bun run typecheck
git diff --check
```

Every manifest entry must be `OK`; readiness/conformance must be `ok:true`; all commands must exit 0. Failure stops.

## Current final inputs

Emit the current release; stale releases fail:

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts \
  --emit-producer-release \
  --canonical plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml \
  --case-set FINAL \
  --object-root audits/audit-governance-recovery-v1/objects/sha256 \
  --output audits/audit-governance-recovery-v1/producer-releases/final-g001.json
```

### 1. Capture PRE_CHANGE

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
bun run .agents/skills/plan-audit-archiver/scripts/capture-state.ts --final --state-kind PRE_CHANGE \
  --qoderwork-root /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap \
  --work-one-root /home/zhaoge/workspace/opencode/work-one \
  --session-roles audits/audit-governance-recovery-v1/session-role-manifest.json \
  --producer-release audits/audit-governance-recovery-v1/producer-releases/final-g001.json \
  --output audits/audit-governance-recovery-v1/final/g001/pre-change-state.json
```

### 2. Perform the independent semantic sweep

Auditor A checks canonical, seven chains, diff, mirror, graph, tests, conformance, and both roots; only Auditor A writes `audits/audit-governance-recovery-v1/final/g001/auditor-findings.md`. A blocker stops.

### 3. Capture VERDICT and generate the fixed case set

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
export AUDIT_RECOVERY_FINAL_DIR=audits/audit-governance-recovery-v1/final/g001
export AUDIT_RECOVERY_RELEASE=audits/audit-governance-recovery-v1/producer-releases/final-g001.json
bun run .agents/skills/plan-audit-archiver/scripts/capture-state.ts --final --state-kind VERDICT \
  --qoderwork-root /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap \
  --work-one-root /home/zhaoge/workspace/opencode/work-one \
  --session-roles audits/audit-governance-recovery-v1/session-role-manifest.json \
  --producer-release "$AUDIT_RECOVERY_RELEASE" --output "$AUDIT_RECOVERY_FINAL_DIR/verdict-state.json"
bun run .agents/skills/plan-audit-archiver/scripts/generate-evidence-receipt.ts \
  --final --audit-id AUDIT-GOVERNANCE-RECOVERY-FINAL-g001 \
  --canonical plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml \
  --generate-case-set FINAL \
  --session-roles audits/audit-governance-recovery-v1/session-role-manifest.json \
  --pre-change "$AUDIT_RECOVERY_FINAL_DIR/pre-change-state.json" --verdict-state "$AUDIT_RECOVERY_FINAL_DIR/verdict-state.json" \
  --producer-release "$AUDIT_RECOVERY_RELEASE" --output-dir "$AUDIT_RECOVERY_FINAL_DIR/evidence"
bun run .agents/skills/plan-audit-archiver/scripts/prepare-audit.ts \
  --final \
  --canonical plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml \
  --session-roles audits/audit-governance-recovery-v1/session-role-manifest.json \
  --auditor-findings "$AUDIT_RECOVERY_FINAL_DIR/auditor-findings.md" --evidence-dir "$AUDIT_RECOVERY_FINAL_DIR/evidence" \
  --pre-change "$AUDIT_RECOVERY_FINAL_DIR/pre-change-state.json" --verdict-state "$AUDIT_RECOVERY_FINAL_DIR/verdict-state.json" \
  --producer-release "$AUDIT_RECOVERY_RELEASE" \
  --object-root audits/audit-governance-recovery-v1/objects/sha256 \
  --output-dir "$AUDIT_RECOVERY_FINAL_DIR/prepared"
bun run .agents/skills/plan-audit-archiver/scripts/validate-audit.ts \
  "$AUDIT_RECOVERY_FINAL_DIR/prepared/audit-report.md" --final
```

Required: `valid:true`, no errors, `ACCEPT`, and distinct prepared/published paths.

## Staged final transaction and live recheck

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
export AUDIT_RECOVERY_FINAL_DIR=audits/audit-governance-recovery-v1/final/g001
export AUDIT_RECOVERY_RELEASE=audits/audit-governance-recovery-v1/producer-releases/final-g001.json
bun run .agents/skills/plan-audit-archiver/scripts/close-audit-phase.ts \
  --workspace-root /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap \
  --plan-root plans/audit-governance-recovery-v1/formal-plan-set \
  --final \
  --prepared-report "$AUDIT_RECOVERY_FINAL_DIR/prepared/audit-report.md" \
  --published-report "$AUDIT_RECOVERY_FINAL_DIR/published/audit-report.md" \
  --session-roles audits/audit-governance-recovery-v1/session-role-manifest.json \
  --pre-change "$AUDIT_RECOVERY_FINAL_DIR/pre-change-state.json" --verdict-state "$AUDIT_RECOVERY_FINAL_DIR/verdict-state.json" \
  --producer-release "$AUDIT_RECOVERY_RELEASE" \
  --session-role AUDITOR \
  --transaction-dir "$AUDIT_RECOVERY_FINAL_DIR/closure-transaction"
/home/zhaoge/.bun/bin/bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts plans/audit-governance-recovery-v1/formal-plan-set /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
/home/zhaoge/.bun/bin/bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts plans/audit-governance-recovery-v1/formal-plan-set --final
```

The wrapper stages, validates, then commits; both live rechecks must return `ok:true`.

## Final completion gate

- [ ] `GATE-GR-FINAL-001` — exact r8 plan/PHASE-00 toolchain + PHASE-01 bootstrap decisions.
- [ ] `GATE-GR-FINAL-002` — distinct tasks; waiver consumed once.
- [ ] `GATE-GR-FINAL-003` — seven valid audit/progression/status chains.
- [ ] `GATE-GR-FINAL-004` — manifest/tests/conformance/type/diff pass.
- [ ] `GATE-GR-FINAL-005` — complete hash-valid acyclic graph.
- [ ] `GATE-GR-FINAL-006` — current final release and dual states.
- [ ] `GATE-GR-FINAL-007` — no Auditor semantic blocker.
- [ ] `GATE-GR-FINAL-008` — staged/committed rechecks pass.
- [ ] `GATE-GR-FINAL-009` — old M1 remains invalid and unchanged.
- [ ] `GATE-GR-FINAL-010` — no P4 before final `ACCEPT`.

Unchecked means incomplete. P4 starts after final `ACCEPT`.
