# Phase PHASE-01: Recovery audit bootstrap

**Phase ID**: `PHASE-01`
**Depends on**: `PHASE-00`
**Outcome**: Consume the toolchain implemented by PHASE-00 to mechanically produce scope-lock, session manifest, phase approval, evidence, audit report, and the one-use bootstrap activation/closure transaction.
**Evidence level**: `file-integration`
**Progression status**: `NOT_STARTED`
**Completion receipt**: `N/A`

## Goal and owned requirements

PHASE-01 is a **pure audit bootstrap phase**. It owns **zero source files** (the toolchain was implemented in PHASE-00). Its sole responsibility is to use the already-accepted tools from PHASE-00 to generate the governance artifacts that all later phases consume: session-role-manifest, scope-lock, phase-approval, dual-repository PRE_CHANGE/VERDICT, evidence receipts, prepared audit report, and the one-use bootstrap activation/closure transaction.

PHASE-01 consumes the sole waiver `PHASE-01_P02A_ENTRY_WHILE_INDEX_BLOCKED` to authorize entry while the live index remains BLOCKED (the tools now exist from PHASE-00, but the index projection has not yet been updated by a receipt transaction).

## Boundary with PHASE-00

PHASE-00 implements the toolchain (8 source/test files). PHASE-01 consumes it. PHASE-01 has **no allowed-files table** (source implementation = 0). The artifact output destinations (scope-lock, session-manifest, phase-approval, etc.) are governed by the scope-lock/phase-approval schema, not by an allowed-files table.

## Two ordered HUMAN decisions

P-02A cannot repair its blocker. HUMAN decision 1 binds canonical, manifest, baseline, and exceptions; it authorizes target materialization (already completed in r8 generation).

Auditor A then:

1. confirms `materialization_commands_r8` has been run (r8 overlay on bootstrap worktree);
2. creates a distinct, blocked Implementer B product task and records both task IDs;
3. freezes scope, qoderwork baseline, and phase request with those IDs (using `validate-phase-progression.ts --create-scope-lock` from PHASE-00);
4. obtains HUMAN decision 2 binding the request/scope/baseline/IDs;
5. captures clean work-one and runs canonical `prewrite_verification_command`;
6. only its `ok:true` receipt permits the bootstrap activation transaction.

Only these bootstrap exceptions exist:

```text
PHASE-01_P02A_ENTRY_WHILE_INDEX_BLOCKED
EXTERNAL_HUMAN_DECISION_FOR_PENDING_IMMUTABLE_LOCK
SUPPLEMENTAL_QODERWORK_BASELINE_WITH_WORK_ONE_P07_ANCHOR
CANDIDATE_BOOTSTRAP_ACTIVATION_AND_CLOSE_AFTER_VALID_AUDIT
PHASE-00_COMPONENT_LEVEL_NO_FORMAL_PRE_CHANGE
```

## Producer contracts

### Bootstrap state upgrade and normal dual state

Canonical `phase_00_release_command` (implemented in PHASE-00) resolves the fixed registry/imports and exclusively writes immutable source objects plus `PHASE-01-foundation.json`.

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
bun run .agents/skills/plan-audit-archiver/scripts/capture-state.ts \
  --upgrade-bootstrap-pre-change \
  --qoderwork-baseline audits/audit-governance-recovery-v1/bootstrap/qoderwork-baseline-PHASE-01.json \
  --work-one-baseline audits/audit-governance-recovery-v1/bootstrap/pre-change-work-one-PHASE-01.json \
  --scope-lock audits/audit-governance-recovery-v1/bootstrap/scope-lock-PHASE-01-g001.json \
  --phase-approval audits/audit-governance-recovery-v1/bootstrap/phase-approval-decision-PHASE-01-g001.json \
  --producer-release audits/audit-governance-recovery-v1/producer-releases/PHASE-01-foundation.json \
  --output audits/audit-governance-recovery-v1/phases/PHASE-01/g001/pre-change-state.json
```

After the bootstrap transaction, Auditor A captures VERDICT:

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
export AUDIT_RECOVERY_PHASE_DIR=audits/audit-governance-recovery-v1/phases/PHASE-01/g001
bun run .agents/skills/plan-audit-archiver/scripts/capture-state.ts --state-kind VERDICT \
  --qoderwork-root /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap \
  --work-one-root /home/zhaoge/workspace/opencode/work-one \
  --scope-lock audits/audit-governance-recovery-v1/bootstrap/scope-lock-PHASE-01-g001.json \
  --phase-approval audits/audit-governance-recovery-v1/bootstrap/phase-approval-decision-PHASE-01-g001.json \
  --session-roles audits/audit-governance-recovery-v1/session-role-manifest.json \
  --producer-release audits/audit-governance-recovery-v1/producer-releases/PHASE-01-foundation.json \
  --output "$AUDIT_RECOVERY_PHASE_DIR/verdict-state.json"
```

### EV, findings, and prepared report

Only after VERDICT, Auditor A independently sweeps and writes semantics only to `audits/audit-governance-recovery-v1/phases/PHASE-01/g001/auditor-findings.md`.

### Phase inputs, releases, admission, and status

`validate-phase-progression.ts` (implemented in PHASE-00) has exact mutually exclusive modes:

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
--verify-final-gate <GATE_ID> --canonical path --plan-root path --audit-root path --output path
--verify-final-audit-inputs --canonical path --plan-root path --audit-root path --output path
--verify-final-audit-regression --canonical path --plan-root path --audit-root path --output path
```

**Final-gate verification modes**: The `--verify-final-gate`, `--verify-final-audit-inputs`, and `--verify-final-audit-regression` modes are named-flag interfaces that do not require positional `PLAN_ROOT`/`<next-phase-id>` arguments. The script's argv entry guard must distinguish named-flag invocation from positional invocation: if `argv[2]` starts with `--`, route to the final-gate path; otherwise fall back to the positional path. PHASE-00 owns the implementation of all 14 modes; PHASE-01 and later phases invoke them as accepted tooling.

**Boundary with PHASE-02**: PHASE-01 ENABLES the modes `validate-phase-progression.ts` supports. PHASE-02 INVOKES these modes as already-accepted tooling and ADDS the `close-audit-phase.ts` wrapper plus candidate staging + adoption transaction.

## One-use PHASE-01 adoption transaction

After candidate `validate-audit` returns `valid:true`, Auditor Session A runs:

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts \
  --bootstrap-activate-and-close PHASE-01 \
  --plan-root plans/audit-governance-recovery-v1/formal-plan-set \
  --prepared-report audits/audit-governance-recovery-v1/phases/PHASE-01/g001/prepared/audit-report.md \
  --plan-decision audits/audit-governance-recovery-v1/approval-decision-r8.json \
  --phase-decision audits/audit-governance-recovery-v1/bootstrap/phase-approval-decision-PHASE-01-g001.json \
  --producer-release audits/audit-governance-recovery-v1/producer-releases/PHASE-01-foundation.json \
  --transaction-dir audits/audit-governance-recovery-v1/phases/PHASE-01/g001/bootstrap-closure-transaction
```

## Phase completion gate

- [ ] PHASE-00 ACCEPTED (toolchain implemented and verified).
- [ ] Both HUMAN decisions and prewrite bootstrap precheck pass.
- [ ] PHASE-01 has native dual PRE_CHANGE/VERDICT, independent EVs, immutable findings, and prepared/published report separation (all produced by PHASE-00 tools).
- [ ] Session/scope/release/state/evidence/report outputs are mechanical and write-once.
- [ ] Entry/closed/readiness/final/status modes pass complete and isolated failure fixtures (from PHASE-00 tests).
- [ ] Bootstrap progression/activation/status transaction passes interruption/resume and is consumed once.
- [ ] Auditor Session A publishes PHASE-01 `ACCEPT`; PHASE-02 remains blocked until its receipt/status chain validates.
