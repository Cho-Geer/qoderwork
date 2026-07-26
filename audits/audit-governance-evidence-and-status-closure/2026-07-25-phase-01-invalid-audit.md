# Audit Report: AUDIT-GOV-PHASE-01-R2-INVALID-01

## 0. Machine-Readable Audit Contract

<!-- AUDIT_CONTRACT_START -->
```json
{
  "schema_version": "2.1",
  "audit_id": "AUDIT-GOV-PHASE-01-R2-INVALID-01",
  "generation": 1,
  "previous_audit": null,
  "scope_lock": {
    "path": "audits/audit-governance-evidence-and-status-closure/scope-lock-PHASE-01-r2.json",
    "sha256": "8bfd5ba1bfa186270874c57cea506faa2a8993a352765607976311298a910416",
    "lock_id": "AUDIT-GOV-PHASE-01-R2"
  },
  "baseline": {
    "implementation_base_commit": "64df828d56611ac121baccfaf666f147980aec85",
    "commit": "64df828d56611ac121baccfaf666f147980aec85",
    "head_at_verdict": "64df828d56611ac121baccfaf666f147980aec85",
    "workspace_root": "/home/zhaoge/workspace/qoderwork/.worktrees/check-plan",
    "repository_root": "/home/zhaoge/workspace/opencode/work-one",
    "dirty_surface": "work-one clean",
    "dirty_paths": [],
    "pre_change_receipt": {
      "path": "audits/audit-governance-evidence-and-status-closure/evidence/pre-change-PHASE-01-r2.json",
      "sha256": "30352c15da0445c21eb3f4b58e0a2724845e18ef2f1467fc3e5e4fec1799e1d7"
    },
    "verdict_state_receipt": null,
    "plan_sources": [
      {
        "path": "plans/audit-governance-evidence-and-status-closure/00-plan-index.md",
        "sha256": "176939bdb1b79480b8c740899e71f2177d25ca7a995884ec3e2806aab6c50bbc"
      },
      {
        "path": "plans/audit-governance-evidence-and-status-closure/01-phase-plan-gate-semantics.md",
        "sha256": "b011b4bf13b092e552a4aad3fe646f7e9e5ded3c98b2159e66268f714a5e0c78"
      }
    ],
    "supplemental_sources": []
  },
  "scope": {
    "status": "FROZEN",
    "provenance_level": "v2.1-required",
    "frozen_at": "2026-07-25T13:34:53.371Z",
    "in_scope": [
      "REQ-001"
    ],
    "out_of_scope": [
      "phase-progression.ts modification",
      "any plan under plans/task-lens-m1",
      "bun.lock and new dependencies",
      "work-one code",
      "historical audit report repair",
      "manual LATEST.md edits",
      "shallow directory-scan receipt discovery",
      "verdict defaulting or evidence-level promotion",
      "--force or status-only bypass"
    ],
    "assumptions": [
      {
        "statement": "CodeGraph index belongs to the qoderwork main worktree rather than this worktree (UNAVAILABLE); the rg fallback caller scan is authoritative for this freeze.",
        "disproof": "codegraph status shows a worktree-local index"
      },
      {
        "statement": "checkEvidenceContracts has file-level callers only in validate-plan.ts and does not require shared-function caller-test expansion.",
        "disproof": "the bounded caller scan finds a second caller file"
      },
      {
        "statement": "The fixed command needs the explicit ./.agents path prefix under Bun 1.3.14; the prefix changes path interpretation only, not test selection.",
        "disproof": "the revised fixed command does not execute validate-plan.test.ts or changes the named test set"
      }
    ],
    "exit_criteria": [
      "scope-lock has no placeholder and covers only REQ-001 with the two allowed implementation files",
      "pre-change-PHASE-01-r2.json exists, is nonempty, and matches the approved r2 scope-lock hash",
      "approval is HUMAN and APPROVED with the direct user authorization recorded",
      "the revised fixed test command executes the target test file rather than a Bun filter"
    ]
  },
  "requirements": [
    {
      "id": "REQ-001",
      "plan_item_id": "PLAN-REQ-001",
      "kind": "BEHAVIORAL",
      "source": "plans/audit-governance-evidence-and-status-closure/01-phase-plan-gate-semantics.md#REQ-001",
      "behavior": "validate-plan.ts determines phase completion only from the Phase completion gate section and progression status: non-accepted gates are all unchecked; accepted gates are all checked with a nonempty completion receipt; unchecked boxes outside the section do not affect the result; 99-final-verification.md retains its own unfinished checklist requirement.",
      "required_evidence_level": "component",
      "oracle_id": "ORACLE-001",
      "oracle": "A temporary PLAN_SET fixture passes for a NOT_STARTED all-unchecked gate and an ACCEPTED all-checked gate with a nonempty receipt, while checked-not-started, unchecked-accepted, missing-receipt, and empty-gate mutations emit PHASE_COMPLETION_GATE_MISMATCH or PHASE_RECEIPT_MISSING through independent bun test assertions.",
      "positive_control": {
        "command": "cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan && bun test ./.agents/skills/deterministic-implementation-planning/scripts/validate-plan.test.ts",
        "expected": "PASS",
        "observed": "NOT_RUN",
        "evidence": "NOT-RUN"
      },
      "negative_control": {
        "applicability": "REQUIRED",
        "method": "AGC-C-101 controlled gate mutation",
        "command": "cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan && bun test ./.agents/skills/deterministic-implementation-planning/scripts/validate-plan.test.ts --test-name-pattern AGC-C-101",
        "expected": "FAIL",
        "observed": "NOT_RUN",
        "evidence": "NOT-RUN"
      },
      "status": "BLOCKED"
    }
  ],
  "evidence_receipts": [],
  "sweep": {
    "status": "INCOMPLETE",
    "requirement_ids": [],
    "files_inspected": [],
    "commands": [],
    "completed_at": "2026-07-25T13:45:00.178Z"
  },
  "findings": [],
  "rework_package": {
    "status": "NONE",
    "finding_ids": [],
    "items": []
  },
  "reopen_records": [],
  "inherited_blockers": [],
  "downgrade_declaration": null,
  "unclassified_findings": 0,
  "evidence_ceiling": "NOT-RUN",
  "verdict": "INVALID",
  "blocker_reason": null,
  "invalid_reason": "P-02 pre-change provenance is invalid: the two PHASE-01 implementation files were already modified before the r2 scope-lock and pre-change receipt were created. A post-implementation re-freeze cannot establish the required pre-write baseline. The r2 plan_registry source also uses #REQ-001, but the authoritative phase file has no heading whose normalized anchor is req-001."
}
```
<!-- AUDIT_CONTRACT_END -->

## 1. Audit Identity and Source Ledger

Audit `AUDIT-GOV-PHASE-01-R2-INVALID-01` reviews PHASE-01 at work-one baseline commit `64df828d56611ac121baccfaf666f147980aec85`. The r2 scope lock is `audits/audit-governance-evidence-and-status-closure/scope-lock-PHASE-01-r2.json`; its r2 pre-change receipt is `audits/audit-governance-evidence-and-status-closure/evidence/pre-change-PHASE-01-r2.json`. Evidence ceiling is `NOT-RUN` because P-02 invalidates any acceptance sweep.

## 2. Frozen Scope and Exit Contract

### 2.1 IN-SCOPE

| Requirement | Required behavior | Source |
|---|---|---|
| REQ-001 | Status-local nonempty completion-gate semantics | `01-phase-plan-gate-semantics.md#REQ-001` |

### 2.2 OUT-OF-SCOPE

The r2 scope exclusions remain unchanged: phase progression code, Task Lens plans, `bun.lock`, work-one code, historical report repair, manual `LATEST.md`, shallow receipt discovery, verdict/evidence promotion, and bypass flags.

### 2.3 Assumptions and disproof

The r2 caller scan is the fallback because CodeGraph is indexed to the main worktree. Its scope claim is not sufficient to repair P-02: the pre-change receipt must precede implementation, not merely be nonempty and hash-bound.

### 2.4 Deterministic exit criteria

The required pre-write provenance condition is false. Therefore REQ-001 cannot reach a valid component acceptance state in this generation.

## 3. Requirement, Oracle, and Falsification Matrix

| REQ | Oracle | Positive | Negative | Status |
|---|---|---|---|---|
| REQ-001 | ORACLE-001 temporary PLAN_SET fixture | NOT_RUN | NOT_RUN | BLOCKED |

## 4. Full In-Scope Sweep

Sweep status is INCOMPLETE. The audit stopped before execution because the required pre-change state was reconstructed after implementation; executing controls cannot make that provenance condition true.

## 5. Classified Findings

### 5.1 BLOCKING

NONE. The terminal defect is an invalid audit contract, not a reworkable implementation finding.

### 5.2 NON_BLOCKING_DEBT

NONE.

### 5.3 OUT_OF_SCOPE

NONE.

### 5.4 UNVERIFIED

REQ-001 controls are intentionally NOT_RUN because P-02 has already invalidated this generation.

## 6. Falsification Evidence

No EV receipt is emitted. The planned AGC-C-101 negative control is recorded as NOT_RUN; using a later green or red test run would not repair the missing pre-write provenance.

## 7. Frozen Rework Package

NONE. INVALID must not issue an actionable rework package.

## 8. Reopen Records

NONE.

## 9. Closure Matrix

| Requirement | Status | Reason |
|---|---|---|
| REQ-001 | BLOCKED | P-02 pre-change provenance was created after the implementation was already present. |

## 10. Verdict

**Verdict**: `INVALID`

Audit AUDIT-GOV-PHASE-01-R2-INVALID-01 does not sign completion. Baseline `64df828d56611ac121baccfaf666f147980aec85` remains a clean work-one anchor, but it cannot substitute for a pre-write receipt captured before the qoderwork implementation change.

## 11. Validator Evidence

Verified-by: `cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan && bun run .agents/skills/plan-audit-archiver/scripts/validate-audit.ts audits/audit-governance-evidence-and-status-closure/2026-07-25-phase-01-invalid-audit.md` -> exit 1, `valid:false`, `errors:[PLAN_REGISTRY_ANCHOR_MISSING]`. The validator confirms that PLAN-REQ-001 points to a source anchor absent from the hashed phase plan.

## 12. Anti-Loop Answers

1. All in-scope requirements satisfied? No; REQ-001 is BLOCKED by invalid provenance.
2. Negative control EV ids: none; execution is NOT_RUN.
3. Rework package status: NONE.
4. Exit criteria changed since freeze? No.
5. Open findings count: 0.
6. Exit condition met: INVALID is terminal for this generation.
7. Validator result: exit 1 with PLAN_REGISTRY_ANCHOR_MISSING; the report is a formal INVALID record, not a machine-valid acceptance artifact.
