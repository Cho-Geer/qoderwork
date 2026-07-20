# Plan 实施闭合审计报告模板 v2.1

复制本模板到 `audits/plan-name/YYYY-MM-DD-audit-N.md`。审计前先用
`scope-lock-template.json` 形成完整 plan registry 并取得人工批准，再冻结
pre-change state receipt。删除所有 `REPLACE_...` 值；不要删除必填字段。
报告完成后必须冻结 verdict-state、执行回执与输出 artifact，并运行
`scripts/validate-audit.ts`。CLI 外部校验通过前不得签发 `ACCEPT/REWORK`。

# Implementation Audit: REPLACE_AUDIT_TITLE

## 0. Machine-Readable Audit Contract

`AUDIT_CONTRACT` 是审计裁决的规范数据。正文必须与它一致；发生冲突时报告
无效，先修复审计，不得下发返工。

<!-- AUDIT_CONTRACT_START -->
```json
{
  "schema_version": "2.1",
  "audit_id": "REPLACE_AUDIT_ID",
  "generation": 1,
  "previous_audit": null,
  "scope_lock": {
    "path": "audits/REPLACE_PLAN_NAME/scope-lock.json",
    "sha256": "REPLACE_64_HEX_SHA256",
    "lock_id": "REPLACE_LOCK_ID"
  },
  "baseline": {
    "implementation_base_commit": "REPLACE_40_HEX_COMMIT",
    "commit": "REPLACE_40_HEX_COMMIT",
    "head_at_verdict": "REPLACE_40_HEX_COMMIT",
    "workspace_root": "/home/zhaoge/workspace/qoderwork",
    "repository_root": "/home/zhaoge/workspace/opencode/work-one",
    "dirty_surface": "REPLACE_GIT_STATUS_SUMMARY",
    "dirty_paths": [
      "REPLACE_EXACT_DIRTY_PATH"
    ],
    "pre_change_receipt": {
      "path": "audits/REPLACE_PLAN_NAME/evidence/pre-change.json",
      "sha256": "REPLACE_64_HEX_SHA256"
    },
    "verdict_state_receipt": {
      "path": "audits/REPLACE_PLAN_NAME/evidence/verdict-state.json",
      "sha256": "REPLACE_64_HEX_SHA256"
    },
    "plan_sources": [
      {
        "path": "plans/REPLACE_PLAN_PATH.md",
        "sha256": "REPLACE_64_HEX_SHA256"
      }
    ],
    "supplemental_sources": [
      {
        "path": "logs/REPLACE_IMPLEMENTATION_LOG.md",
        "sha256": "REPLACE_64_HEX_SHA256",
        "role": "CLAIM"
      }
    ]
  },
  "scope": {
    "status": "FROZEN",
    "frozen_at": "REPLACE_ISO8601_TIMESTAMP",
    "in_scope": [
      "REQ-001"
    ],
    "out_of_scope": [
      "REPLACE_EXPLICIT_NON_GOAL"
    ],
    "assumptions": [
      {
        "statement": "REPLACE_ASSUMPTION",
        "disproof": "REPLACE_COMMAND_OR_OBSERVATION_THAT_DISPROVES_IT"
      }
    ],
    "exit_criteria": [
      "REPLACE_DETERMINISTIC_EXIT_CRITERION"
    ]
  },
  "requirements": [
    {
      "id": "REQ-001",
      "plan_item_id": "PLAN-REQ-001",
      "kind": "BEHAVIORAL",
      "source": "plans/REPLACE_PLAN_PATH.md#REPLACE_SECTION",
      "behavior": "REPLACE_ONE_OBSERVABLE_BEHAVIOR",
      "required_evidence_level": "component",
      "oracle_id": "ORACLE-001",
      "oracle": "REPLACE_IMPLEMENTATION_INDEPENDENT_ORACLE",
      "positive_control": {
        "command": "cd /REPLACE/CWD && REPLACE_COMMAND",
        "expected": "PASS",
        "observed": "REPLACE_PASS_FAIL_BLOCKED_NOT_RUN",
        "evidence": "EV-001"
      },
      "negative_control": {
        "applicability": "REQUIRED",
        "method": "REPLACE_BAD_FIXTURE_FAULT_OR_MUTATION",
        "command": "cd /REPLACE/CWD && REPLACE_NEGATIVE_COMMAND",
        "expected": "FAIL",
        "observed": "REPLACE_FAIL_PASS_BLOCKED_NOT_RUN",
        "evidence": "EV-002"
      },
      "status": "REPLACE_PASS_FAIL_BLOCKED_INVALID"
    }
  ],
  "evidence_receipts": [
    {
      "id": "EV-001",
      "path": "audits/REPLACE_PLAN_NAME/evidence/req-001-positive-receipt.json",
      "sha256": "REPLACE_64_HEX_SHA256",
      "command": "cd /REPLACE/CWD && REPLACE_POSITIVE_COMMAND",
      "observed": "PASS",
      "requirement_id": "REQ-001",
      "polarity": "POSITIVE",
      "oracle_id": "ORACLE-001",
      "fixture_id": "FIXTURE-GOOD-001",
      "evidence_level": "component",
      "repository_state_sha256": "REPLACE_VERDICT_STATE_SHA256",
      "exit_code": 0,
      "cwd": "/REPLACE/CWD",
      "artifacts": [
        {
          "path": "audits/REPLACE_PLAN_NAME/evidence/req-001-positive-output.txt",
          "sha256": "REPLACE_64_HEX_SHA256"
        }
      ],
      "completed_at": "REPLACE_ISO8601_TIMESTAMP"
    },
    {
      "id": "EV-002",
      "path": "audits/REPLACE_PLAN_NAME/evidence/req-001-negative-receipt.json",
      "sha256": "REPLACE_64_HEX_SHA256",
      "command": "cd /REPLACE/CWD && REPLACE_NEGATIVE_COMMAND",
      "observed": "FAIL",
      "requirement_id": "REQ-001",
      "polarity": "NEGATIVE",
      "oracle_id": "ORACLE-001",
      "fixture_id": "FIXTURE-BAD-001",
      "evidence_level": "component",
      "repository_state_sha256": "REPLACE_VERDICT_STATE_SHA256",
      "exit_code": 1,
      "cwd": "/REPLACE/CWD",
      "artifacts": [
        {
          "path": "audits/REPLACE_PLAN_NAME/evidence/req-001-negative-output.txt",
          "sha256": "REPLACE_64_HEX_SHA256"
        }
      ],
      "completed_at": "REPLACE_ISO8601_TIMESTAMP"
    }
  ],
  "sweep": {
    "status": "COMPLETE",
    "requirement_ids": [
      "REQ-001"
    ],
    "files_inspected": [
      "REPLACE_EXACT_FILE"
    ],
    "commands": [
      "cd /REPLACE/CWD && REPLACE_COMMAND"
    ],
    "completed_at": "REPLACE_ISO8601_TIMESTAMP"
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
  "evidence_ceiling": "component",
  "verdict": "ACCEPT",
  "blocker_reason": null,
  "invalid_reason": null
}
```
<!-- AUDIT_CONTRACT_END -->

### Generation 2+ variant

`generation > 1` 时不得覆盖上一份报告；将 `previous_audit` 改为：

```json
{
  "path": "audits/exact-plan/2026-07-18-audit.md",
  "sha256": "REPLACE_64_HEX_SHA256",
  "audit_id": "REPLACE_PREVIOUS_AUDIT_ID"
}
```

### Static requirement variant

For a `STATIC` requirement, retain both control objects and use:

```json
{
  "kind": "STATIC",
  "negative_control": {
    "applicability": "NOT_APPLICABLE_STATIC",
    "method": "N/A",
    "command": "N/A",
    "expected": "N/A",
    "observed": "N/A",
    "evidence": "Exact reason this is a static observation"
  }
}
```

### Finding object variant

Add one object per immutable finding:

```json
{
  "id": "F-001",
  "requirement_ids": ["REQ-001"],
  "classification": "BLOCKING",
  "origin": "PRE_EXISTING",
  "introduced_after_freeze": false,
  "status": "OPEN",
  "summary": "Exact violated behavior",
  "evidence": "Exact source/log/test artifact",
  "allowed_files": ["exact/path.ts"],
  "forbidden_changes": ["Exact prohibited change"],
  "closure_conditions": ["Exact observable closure condition"],
  "pre_fix_control": {
    "command": "cd /exact/cwd && bun test exact.test.ts",
    "expected": "FAIL",
    "observed": "FAIL",
    "evidence": "EV-003"
  }
}
```

For a closed blocker, retain the immutable finding fields and add:

```json
{
  "status": "CLOSED",
  "post_fix_control": {
    "command": "cd /exact/cwd && bun test exact.test.ts",
    "expected": "PASS",
    "observed": "PASS",
    "evidence": "EV-004"
  },
  "closure_evidence": "EV-004"
}
```

Valid classification values are `BLOCKING`, `NON_BLOCKING_DEBT`,
`OUT_OF_SCOPE`, and `UNVERIFIED`. Valid origin values are `PRE_EXISTING`,
`REGRESSION`, `AUDIT_MISS`, and `EVIDENCE_INVALIDATION`.

### Frozen rework item variant

For `REWORK`, set package status to `FROZEN` and add exactly one item for every
open blocking finding:

```json
{
  "finding_id": "F-001",
  "allowed_files": ["exact/path.ts", "exact/path.test.ts"],
  "forbidden_changes": ["Do not edit unrelated modules"],
  "required_changes": ["Exact symbol and required behavior"],
  "acceptance_commands": [
    {
      "command": "cd /exact/cwd && bun test exact/path.test.ts",
      "expected": "0 fail and named negative control observed FAIL"
    }
  ]
}
```

### Reopen record variant

Any blocking finding with `introduced_after_freeze: true` requires:

```json
{
  "finding_id": "F-002",
  "gate": "IN_SCOPE_REGRESSION",
  "origin": "REGRESSION",
  "linked_rule": "REQ-001",
  "baseline_proof": "Evidence at the newly audited baseline",
  "causal_proof": "Diff/test proving the patch caused the regression",
  "miss_explanation": "N/A for a regression",
  "debt_rejection_reason": "Why this directly blocks the frozen exit criterion",
  "affected_requirement_ids": ["REQ-001"],
  "resweep_evidence": "Evidence that all affected requirements were reswept",
  "approval_evidence": "User/reviewer approval or existing-scope authority",
  "approved": true
}
```

Valid gates are `IN_SCOPE_REGRESSION`, `SAFETY_OR_DATA_LOSS`,
`EVIDENCE_INVALIDATION`, and `AUDIT_MISS`.

### Inherited blockers variant (AGENTS.md §15 rule P-04)

For `generation > 1`, every `BLOCKED` item from the previous audit MUST appear
exactly once in `inherited_blockers` with one of three dispositions:

```json
{
  "inherited_blockers": [
    {
      "previous_audit_id": "REPLACE_PREVIOUS_AUDIT_ID",
      "blocker_id": "REPLACE_BLOCKER_ID",
      "disposition": "CLOSED",
      "evidence": "REPLACE_RECEIPT_OR_COMMAND_PROOF",
      "reason": "REPLACE_CLOSURE_OR_INHERITANCE_REASON"
    }
  ]
}
```

Valid dispositions are `CLOSED` (resolved,附 receipt), `INHERITED` (carried
forward,附 reason and planned resolution time), and `REOPENED` (reopened,附
new evidence). Silent omission of a prior `BLOCKED` item is MUST NOT; the
report is `INVALID` if any prior blocker is missing from `inherited_blockers`.

### Downgrade declaration variant (AGENTS.md §15 rule P-05)

When the auditor uses an evidence standard lower than the plan's declared
`provenance_level` (e.g., plan declares `v2.1-required` but auditor uses
component-level evidence), `downgrade_declaration` MUST be a non-null object
with all four required fields:

```json
{
  "downgrade_declaration": {
    "reason": "REPLACE_SPECIFIC_VERIFIABLE_REASON",
    "ceiling": "component",
    "unaffected_scope": "REPLACE_CONCLUSIONS_NOT_AFFECTED",
    "affected_scope": "REPLACE_CONCLUSIONS_AFFECTED_OR_NONE"
  }
}
```

Signing `ACCEPT` with a lower standard and no `downgrade_declaration` is MUST
NOT; the report is `INVALID`.

## 1. Audit Identity and Source Ledger

| Item | Exact value | Authority | SHA-256 / evidence |
|---|---|---|---|
| Audit ID | REPLACE_AUDIT_ID | This audit generation | N/A |
| Baseline commit | REPLACE_COMMIT | Git | REPLACE_COMMAND_OUTPUT |
| Scope lock | REPLACE_PATH | Human-approved plan registry | REPLACE_SHA256 |
| Pre-change state | REPLACE_PATH | Immutable state receipt | REPLACE_SHA256 |
| Verdict state | REPLACE_PATH | Immutable state receipt | REPLACE_SHA256 |
| Authoritative plan | REPLACE_PLAN | Approved contract | REPLACE_SHA256 |
| Implementation report | REPLACE_LOG | Claim only | REPLACE_SHA256 |
| Evidence ceiling | REPLACE_LEVEL | Executed evidence | REPLACE_REASON |

## 2. Frozen Scope and Exit Contract

### 2.1 IN-SCOPE

| Requirement ID | One required behavior | Source |
|---|---|---|
| REQ-001 | REPLACE_BEHAVIOR | REPLACE_SOURCE_SECTION |

### 2.2 OUT-OF-SCOPE

| Item | Why excluded | Destination |
|---|---|---|
| REPLACE_ITEM | REPLACE_CAUSAL_BOUNDARY | debt / later phase / separate audit |

### 2.3 Assumptions and disproof

| Assumption | Cheapest disproof | Observed result |
|---|---|---|
| REPLACE_ASSUMPTION | REPLACE_COMMAND | REPLACE_RESULT |

### 2.4 Deterministic exit criteria

- REPLACE_EXACT_CRITERION

## 3. Requirement, Oracle, and Falsification Matrix

| ID | Kind | Independent oracle | Positive observed | Negative observed | Required/actual level | Status |
|---|---|---|---|---|---|---|
| REQ-001 | BEHAVIORAL | REPLACE_ORACLE | PASS/FAIL | FAIL/PASS | component/component | PASS/FAIL/BLOCKED/INVALID |

## 4. Full In-Scope Sweep

| REQ | Symbols/callers inspected | Success/error/cleanup paths | Commands and artifacts | Result |
|---|---|---|---|---|
| REQ-001 | REPLACE_EXACT_SYMBOLS | REPLACE_PATHS | `Verified-by: REPLACE_COMMAND -> REPLACE_OUTPUT` | PASS/FAIL |

State why the sweep requirement set exactly equals the frozen in-scope set.

## 5. Classified Findings

### 5.1 BLOCKING

List exact `F-NNN` records or write `NONE`.

### 5.2 NON_BLOCKING_DEBT

List evidence-backed debt that does not change this audit's exit gate, or `NONE`.

### 5.3 OUT_OF_SCOPE

List unrelated observations and their destination, or `NONE`.

### 5.4 UNVERIFIED

List unavailable facts and whether they block a frozen requirement, or `NONE`.

## 6. Falsification Evidence

For each behavioral requirement, show both controls using the same oracle.

| REQ | Positive command/result | Negative method | Negative command/result | Sensitivity verdict |
|---|---|---|---|---|
| REQ-001 | EV-001 + artifact SHA | REPLACE_MUTATION | EV-002 + artifact SHA | SENSITIVE/INVALID |

## 7. Frozen Rework Package

Write `NONE` for `ACCEPT`, `BLOCKED`, or `INVALID`. For `REWORK`, list exactly
the open blocking finding set and no other work.

| Finding | Exact files/symbols | Required change | Forbidden change | Failing control | Acceptance command/output |
|---|---|---|---|---|---|
| F-001 | REPLACE_PATH_SYMBOL | REPLACE_BEHAVIOR | REPLACE_PROHIBITION | REPLACE_FAIL | REPLACE_COMMAND_OUTPUT |

## 8. Reopen Records

Write `NONE` when no post-freeze blocker was introduced. Otherwise explain the
gate, origin, causal/baseline proof, original audit miss, affected resweep, and
approval evidence for each record.

## 9. Closure Matrix

| Requirement | Status | Blocking findings | Positive proof | Negative sensitivity proof | Exit gate |
|---|---|---|---|---|---|
| REQ-001 | PASS/FAIL/BLOCKED/INVALID | NONE/F-001 | REPLACE_EVIDENCE | REPLACE_EVIDENCE | CLOSED/OPEN |

## 10. Verdict

**Verdict**: `ACCEPT` / `REWORK` / `BLOCKED` / `INVALID`

State only what the machine contract and evidence prove. For `REWORK`, state
that the package is the complete frozen blocker set from this full sweep. For a
reopen, distinguish implementation regression from audit miss and account for
the added rework explicitly.

## 11. Validator Evidence

```text
Verified-by: cd /home/zhaoge/workspace/qoderwork && bun run .agents/skills/plan-audit-archiver/scripts/validate-audit.ts audits/REPLACE_REPORT.md -> valid=true, errors=[]
```

## 12. Anti-Loop Answers

1. Full frozen scope completed: REPLACE_YES_WITH_EVIDENCE
2. Bad fixture proving test sensitivity: REPLACE_EVIDENCE
3. Rework package equals all open blockers: REPLACE_SET_COMPARISON
4. Criteria added after freeze: REPLACE_NONE_OR_REOPEN_IDS
5. New findings classified by origin: REPLACE_CLASSIFICATION
6. Exact condition ending this generation: REPLACE_EXIT_CONDITION
7. Scope lock, pre/verdict state, and evidence receipts externally verified: REPLACE_VALIDATOR_RESULT
