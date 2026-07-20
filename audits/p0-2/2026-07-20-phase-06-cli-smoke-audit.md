# Implementation Audit: PHASE-06 CLI Smoke — INVALID

## 0. Machine-Readable Audit Contract

<!-- AUDIT_CONTRACT_START -->
```json
{
  "schema_version": "2.1",
  "audit_id": "P02-PHASE-06-AUDIT-1",
  "generation": 1,
  "previous_audit": null,
  "scope_lock": {
    "path": "audits/p0-2/scope-lock.json",
    "sha256": "00007a777e43b2162500b8d3e0f77321cdf5c5e3457508bde40cf69a1c49992d",
    "lock_id": "PHASE-05"
  },
  "baseline": {
    "implementation_base_commit": "aa06fc827b978cfe6aa6237d55a2fa6929eb7a3a",
    "commit": "aa06fc827b978cfe6aa6237d55a2fa6929eb7a3a",
    "head_at_verdict": "aa06fc827b978cfe6aa6237d55a2fa6929eb7a3a",
    "workspace_root": "/home/zhaoge/workspace/qoderwork",
    "repository_root": "/home/zhaoge/workspace/opencode/work-one",
    "work_one_head": "95405b6eb52750f5c5e84eef75a24bb63c6009d1",
    "dirty_surface": "work-one clean (0 dirty entries); qoderwork dirty: 6 modified + 7 untracked files in scripts/test-serve/",
    "dirty_paths": [
      "scripts/test-serve/__tests__/verify-p02.test.ts",
      "scripts/test-serve/isolated-serve.ts",
      "scripts/test-serve/p01b-orchestrator.ts",
      "scripts/test-serve/run-context.ts",
      "scripts/test-serve/types.ts",
      "scripts/test-serve/verify-p02.ts",
      "scripts/test-serve/__tests__/p02-cli-harness.ts",
      "scripts/test-serve/__tests__/p02-cli.test.ts",
      "scripts/test-serve/__tests__/p02-orchestrator.test.ts",
      "scripts/test-serve/__tests__/p02-runtime.test.ts",
      "scripts/test-serve/cleanup.ts",
      "scripts/test-serve/p02-orchestrator.ts",
      "scripts/test-serve/p02-sentinel.ts"
    ],
    "pre_change_receipt": {
      "path": null,
      "sha256": null,
      "note": "pre-change-PHASE-06.json does NOT exist; only pre-change-PHASE-05.json and pre-change-PHASE-05-v2.json exist in audits/p0-2/evidence/"
    },
    "verdict_state_receipt": {
      "path": null,
      "sha256": null,
      "note": "Not captured; INVALID verdict does not require verdict-state receipt"
    },
    "plan_sources": [
      {
        "path": "plans/隔离 serve 测试基建待办/p0-2/06-phase-cli-smoke.md",
        "sha256": "6d589404dedd0a60f1ad2d0ee598683c3c67302998747f3f477b024274882d8e"
      }
    ],
    "supplemental_sources": [
      {
        "path": "logs/2026-07-20-phase-06-cli-smoke-pass.md",
        "sha256": "c7febc65aa467556f5f67b9a5252d2a71a39aebcad249dbe2ac26fad938b9863",
        "role": "CLAIM"
      }
    ]
  },
  "scope": {
    "status": "NOT_FROZEN_FOR_PHASE_06",
    "provenance_level": "v2.1-required",
    "frozen_at": null,
    "note": "scope-lock.json lock_id=PHASE-05 (not PHASE-06); PHASE-06 Freeze Gate never completed",
    "in_scope": [
      "REQ-001",
      "REQ-002",
      "REQ-003"
    ],
    "out_of_scope": [
      "live LLM E2E",
      "H2_AUTHORIZED=true",
      "PHASE-05 port reuse (4001/4002)"
    ],
    "assumptions": [
      {
        "statement": "PHASE-06 implementation required Pre-Implementation Freeze Gate per AGENTS.md §15 rule P-02 (provenance_level=v2.1-required)",
        "disproof": "ls audits/p0-2/evidence/pre-change-PHASE-06.json → no such file"
      }
    ],
    "exit_criteria": [
      "pre-change-PHASE-06.json receipt exists and non-empty (AGENTS.md §15 P-02)",
      "scope-lock.json has lock_id=PHASE-06 (AGENTS.md §15 P-02)",
      "human approval of scope-lock recorded (AGENTS.md §15 P-02)",
      "implementation delta contains only allowed_files (06-phase-cli-smoke.md execute-only)",
      "no code modifications (06-phase-cli-smoke.md Forbidden)"
    ]
  },
  "requirements": [
    {
      "id": "REQ-001",
      "plan_item_id": "PLAN-REQ-CLI-EXIT",
      "kind": "BEHAVIORAL",
      "source": "plans/隔离 serve 测试基建待办/p0-2/06-phase-cli-smoke.md#Local-requirements",
      "behavior": "CLI input: 使用新双端口 → command executes once",
      "required_evidence_level": "runtime-smoke",
      "oracle_id": "ORACLE-PHASE-06-001",
      "oracle": "cliExit==0 and CLI invoked exactly once with port pair distinct from PHASE-05",
      "positive_control": {
        "command": "N/A — INVALID verdict; Freeze Gate violation prevents control execution",
        "expected": "PASS",
        "observed": "NOT_RUN",
        "evidence": null
      },
      "negative_control": {
        "applicability": "REQUIRED",
        "method": "P02-S-PORTS: ports absent → BLOCKED",
        "command": "N/A — INVALID verdict",
        "expected": "FAIL",
        "observed": "NOT_RUN",
        "evidence": null
      },
      "status": "INVALID"
    },
    {
      "id": "REQ-002",
      "plan_item_id": "PLAN-REQ-CLI-PAYLOAD",
      "kind": "BEHAVIORAL",
      "source": "plans/隔离 serve 测试基建待办/p0-2/06-phase-cli-smoke.md#Local-requirements",
      "behavior": "CLI result: 输出 PASS JSON → exit 0",
      "required_evidence_level": "runtime-smoke",
      "oracle_id": "ORACLE-PHASE-06-002",
      "oracle": "stdout JSON contains ok:true, status:\"PASS\", 16 stages all ok, 5 check groups all true, A/B paths readable",
      "positive_control": {
        "command": "N/A — INVALID verdict",
        "expected": "PASS",
        "observed": "NOT_RUN",
        "evidence": null
      },
      "negative_control": {
        "applicability": "REQUIRED",
        "method": "P02-S-PAYLOAD: malformed stdout → cliPayload failure",
        "command": "N/A — INVALID verdict",
        "expected": "FAIL",
        "observed": "NOT_RUN",
        "evidence": null
      },
      "status": "INVALID"
    },
    {
      "id": "REQ-003",
      "plan_item_id": "PLAN-REQ-INDEPENDENT-EVIDENCE",
      "kind": "BEHAVIORAL",
      "source": "plans/隔离 serve 测试基建待办/p0-2/06-phase-cli-smoke.md#Local-requirements",
      "behavior": "evidence: A/B artifacts 可读 → independent run IDs",
      "required_evidence_level": "runtime-smoke",
      "oracle_id": "ORACLE-PHASE-06-003",
      "oracle": "A/B manifests have new run IDs distinct from PHASE-05, both readable",
      "positive_control": {
        "command": "N/A — INVALID verdict",
        "expected": "PASS",
        "observed": "NOT_RUN",
        "evidence": null
      },
      "negative_control": {
        "applicability": "REQUIRED",
        "method": "missing/reused run IDs → independentEvidence failure",
        "command": "N/A — INVALID verdict",
        "expected": "FAIL",
        "observed": "NOT_RUN",
        "evidence": null
      },
      "status": "INVALID"
    }
  ],
  "evidence_receipts": [],
  "sweep": {
    "status": "BLOCKED",
    "requirement_ids": [
      "REQ-001",
      "REQ-002",
      "REQ-003"
    ],
    "files_inspected": [
      "plans/隔离 serve 测试基建待办/p0-2/06-phase-cli-smoke.md",
      "plans/隔离 serve 测试基建待办/p0-2/00-plan-index.md",
      "audits/p0-2/scope-lock.json",
      "audits/p0-2/LATEST.md",
      "audits/p0-2/evidence/",
      "logs/2026-07-20-phase-06-cli-smoke-pass.md",
      "scripts/test-serve/cleanup.ts",
      "scripts/test-serve/isolated-serve.ts",
      "scripts/test-serve/p02-orchestrator.ts",
      "scripts/test-serve/p01b-orchestrator.ts"
    ],
    "commands": [
      "ls audits/p0-2/evidence/ | grep -i 'phase-06\\|pre-change'",
      "grep -E '\"lock_id\"|\"phase_id\"|\"amendment\"' audits/p0-2/scope-lock.json",
      "git status --short scripts/test-serve/",
      "git diff --stat HEAD -- scripts/test-serve/",
      "git log --oneline -- scripts/test-serve/cleanup.ts",
      "bun test scripts/test-serve/__tests__",
      "sha256sum plans/隔离 serve 测试基建待办/p0-2/06-phase-cli-smoke.md audits/p0-2/scope-lock.json logs/2026-07-20-phase-06-cli-smoke-pass.md"
    ],
    "completed_at": "2026-07-20T13:30:00Z"
  },
  "findings": [
    {
      "id": "F-001",
      "requirement_ids": ["REQ-001", "REQ-002", "REQ-003"],
      "classification": "BLOCKING",
      "origin": "PROCESS_VIOLATION",
      "introduced_after_freeze": false,
      "status": "OPEN",
      "summary": "Pre-Implementation Freeze Gate NOT completed for PHASE-06 (provenance_level=v2.1-required). No scope-lock.json with lock_id=PHASE-06 exists; no pre-change-PHASE-06.json receipt exists; no human approval recorded for PHASE-06 scope.",
      "evidence": "ls audits/p0-2/evidence/ → only pre-change-PHASE-05.json and pre-change-PHASE-05-v2.json; grep lock_id audits/p0-2/scope-lock.json → \"PHASE-05\"",
      "allowed_files": [],
      "forbidden_changes": [
        "AGENTS.md §15 rule P-02 violation: implementation began before Freeze Gate completion",
        "No scope-lock.json with lock_id=PHASE-06",
        "No pre-change-PHASE-06.json receipt",
        "No human approval for PHASE-06 scope"
      ],
      "closure_conditions": [
        "Fill scope-lock.json with lock_id=PHASE-06 covering PHASE-06 REQ/Check Registry/oracle",
        "Obtain human reviewer approval for PHASE-06 scope-lock",
        "Run capture-state.ts to produce evidence/pre-change-PHASE-06.json",
        "Verify pre-change-PHASE-06.json exists and non-empty (test -s + content assertion)",
        "Re-execute PHASE-06 CLI smoke with second port pair (4003/4004)",
        "Re-audit with frozen scope and full positive/negative controls"
      ],
      "pre_fix_control": {
        "command": "ls audits/p0-2/evidence/pre-change-PHASE-06.json 2>&1",
        "expected": "FAIL (file not found)",
        "observed": "FAIL (No such file or directory)",
        "evidence": null
      }
    },
    {
      "id": "F-002",
      "requirement_ids": ["REQ-001", "REQ-002", "REQ-003"],
      "classification": "BLOCKING",
      "origin": "PROCESS_VIOLATION",
      "introduced_after_freeze": true,
      "status": "OPEN",
      "summary": "PHASE-06 plan explicitly forbids code modification ('不修改代码') and Allowed files lists ONLY 06-phase-cli-smoke.md (execute only). However, implementation modified/created 4+ code files: cleanup.ts (new), isolated-serve.ts (276 lines changed), p01b-orchestrator.ts (2 lines), p02-orchestrator.ts (modified per log). Additionally, 6+ other dirty files exist in scripts/test-serve/ beyond PHASE-05 scope-lock allowed_files.",
      "evidence": "git status --short scripts/test-serve/ → 6 modified + 7 untracked files; grep -A 5 'Allowed files' 06-phase-cli-smoke.md → only 06-phase-cli-smoke.md; grep -A 3 'Forbidden' → '不修改代码'",
      "allowed_files": [
        "plans/隔离 serve 测试基建待办/p0-2/06-phase-cli-smoke.md"
      ],
      "forbidden_changes": [
        "scripts/test-serve/cleanup.ts (NEW FILE — code modification forbidden by plan)",
        "scripts/test-serve/isolated-serve.ts (276 lines changed — code modification forbidden)",
        "scripts/test-serve/p01b-orchestrator.ts (2 lines changed — code modification forbidden)",
        "scripts/test-serve/p02-orchestrator.ts (modified per log — code modification forbidden)"
      ],
      "closure_conditions": [
        "Either revert all code modifications and execute CLI smoke purely against existing implementation, OR",
        "Recognize that PHASE-06 plan's 'execute-only, no code modification' contract was violated and update plan to forbid the current path, then re-plan with a new phase (e.g., PHASE-06a) that legitimately covers the cleanup.ts extraction as an infrastructure fix",
        "The circular-dependency TDZ fix is a legitimate infrastructure defect, but it cannot be silently smuggled into an execute-only phase — it requires its own phase with proper Freeze Gate"
      ],
      "pre_fix_control": {
        "command": "git status --short scripts/test-serve/ | grep -E 'cleanup\\.ts|isolated-serve\\.ts|p02-orchestrator\\.ts|p01b-orchestrator\\.ts'",
        "expected": "FAIL (no matches if plan was honored)",
        "observed": "FAIL (matches found: 4 files modified/created)",
        "evidence": null
      }
    }
  ],
  "rework_package": {
    "status": "NONE",
    "finding_ids": [],
    "items": [],
    "note": "INVALID verdict cannot emit actionable rework package per plan-audit-archiver skill invariant #9"
  },
  "reopen_records": [],
  "inherited_blockers": [],
  "downgrade_declaration": null,
  "unclassified_findings": 0,
  "evidence_ceiling": "INVALID",
  "verdict": "INVALID",
  "blocker_reason": null,
  "invalid_reason": "Pre-Implementation Freeze Gate violation per AGENTS.md §15 rule P-02: PHASE-06 is v2.1-required but (a) no scope-lock.json with lock_id=PHASE-06 exists, (b) no evidence/pre-change-PHASE-06.json receipt exists, (c) no human approval recorded for PHASE-06 scope. Additionally, PHASE-06 plan explicitly forbids code modification ('不修改代码') and Allowed files lists ONLY 06-phase-cli-smoke.md (execute-only), but the implementation created cleanup.ts and modified isolated-serve.ts, p01b-orchestrator.ts, p02-orchestrator.ts. Per plan-audit-archiver skill rule 14: 'If the pre-change receipt is missing, the audit verdict MUST be INVALID (not BLOCKED)'. Reconstructed audits for phases missing a pre-change receipt are MUST NOT."
}
```
<!-- AUDIT_CONTRACT_END -->

## 1. Audit Identity and Source Ledger

| Item | Exact value | Authority | SHA-256 / evidence |
|---|---|---|---|
| Audit ID | P02-PHASE-06-AUDIT-1 | This audit generation | N/A |
| Generation | 1 (new chain; PHASE-05 audit was for different phase) | This audit | N/A |
| Baseline commit (qoderwork) | aa06fc827b978cfe6aa6237d55a2fa6929eb7a3a | Git | `git rev-parse HEAD` |
| Baseline commit (work-one) | 95405b6eb52750f5c5e84eef75a24bb63c6009d1 | Git | `git rev-parse HEAD` (work-one) |
| Scope lock | audits/p0-2/scope-lock.json | Human-approved plan registry | 00007a777e43b2162500b8d3e0f77321cdf5c5e3457508bde40cf69a1c49992d |
| Scope lock lock_id | PHASE-05 (NOT PHASE-06) | Frozen scope identifier | grep output |
| Pre-change state | audits/p0-2/evidence/pre-change-PHASE-06.json | Immutable state receipt | **DOES NOT EXIST** |
| Verdict state | Not captured | N/A | INVALID verdict does not require verdict-state receipt |
| Authoritative plan | plans/隔离 serve 测试基建待办/p0-2/06-phase-cli-smoke.md | Approved contract | 6d589404dedd0a60f1ad2d0ee598683c3c67302998747f3f477b024274882d8e |
| Implementation report | logs/2026-07-20-phase-06-cli-smoke-pass.md | Claim only | c7febc65aa467556f5f67b9a5252d2a71a39aebcad249dbe2ac26fad938b9863 |
| Evidence ceiling | INVALID | Process violation | Freeze Gate never completed; no positive/negative controls admissible |

## 2. Frozen Scope and Exit Contract

### 2.1 IN-SCOPE (per PHASE-06 plan §Local requirements)

| Requirement ID | plan_item_id | One required behavior | Source |
|---|---|---|---|
| REQ-001 | PLAN-REQ-CLI-EXIT | CLI input: 使用新双端口 → command executes once | 06-phase-cli-smoke.md#Local-requirements |
| REQ-002 | PLAN-REQ-CLI-PAYLOAD | CLI result: 输出 PASS JSON → exit 0 | 06-phase-cli-smoke.md#Local-requirements |
| REQ-003 | PLAN-REQ-INDEPENDENT-EVIDENCE | evidence: A/B artifacts 可读 → independent run IDs | 06-phase-cli-smoke.md#Local-requirements |

### 2.2 OUT-OF-SCOPE

| Item | Why excluded | Destination |
|---|---|---|
| live LLM E2E | Plan non-goal; requires H2_AUTHORIZED | separate audit |
| H2_AUTHORIZED=true | Plan non-goal | separate audit |
| PHASE-05 port reuse (4001/4002) | Plan explicit non-goal: 不复用 PHASE-05 端口 | blocked |
| Code modification | Plan explicit Forbidden: 不修改代码 | should not have happened |

### 2.3 Assumptions and disproof

| Assumption | Cheapest disproof | Observed result |
|---|---|---|
| PHASE-06 implementation required Pre-Implementation Freeze Gate (v2.1-required) | `ls audits/p0-2/evidence/pre-change-PHASE-06.json` | no such file → assumption of Freeze Gate completion is DISPROVED |
| scope-lock.json covers PHASE-06 | `grep lock_id audits/p0-2/scope-lock.json` | lock_id=PHASE-05 → DISPROVED |
| PHASE-06 plan forbids code modification | `grep -A 3 Forbidden 06-phase-cli-smoke.md` | "不修改代码" confirmed → code modification is forbidden |
| Implementation honored the no-code-modification rule | `git status --short scripts/test-serve/` | 6 modified + 7 untracked → DISPROVED |

### 2.4 Deterministic exit criteria

- pre-change-PHASE-06.json receipt exists and non-empty (AGENTS.md §15 P-02) ✗ NOT MET
- scope-lock.json has lock_id=PHASE-06 (AGENTS.md §15 P-02) ✗ NOT MET (still PHASE-05)
- human approval of scope-lock recorded for PHASE-06 (AGENTS.md §15 P-02) ✗ NOT MET
- implementation delta contains only allowed_files (06-phase-cli-smoke.md execute-only) ✗ NOT MET (4+ code files modified)
- no code modifications (06-phase-cli-smoke.md Forbidden) ✗ NOT MET

## 3. Requirement, Oracle, and Falsification Matrix

| ID | Kind | Independent oracle | Positive observed | Negative observed | Required/actual level | Status |
|---|---|---|---|---|---|---|
| REQ-001 | BEHAVIORAL | cliExit==0 and CLI invoked exactly once with port pair distinct from PHASE-05 | NOT_RUN | NOT_RUN | runtime-smoke/INVALID | INVALID |
| REQ-002 | BEHAVIORAL | stdout JSON: ok:true, status:"PASS", 16 stages all ok, 5 check groups all true | NOT_RUN | NOT_RUN | runtime-smoke/INVALID | INVALID |
| REQ-003 | BEHAVIORAL | A/B manifests have new run IDs distinct from PHASE-05, both readable | NOT_RUN | NOT_RUN | runtime-smoke/INVALID | INVALID |

**Why controls were NOT_RUN**: Per plan-audit-archiver skill rule 14, "Reconstructed audits for phases missing a pre-change receipt are MUST NOT." Running positive/negative controls now would constitute a reconstructed audit, which is explicitly forbidden. The verdict must be INVALID based on the process violation alone.

## 4. Full In-Scope Sweep

| REQ | Symbols/callers inspected | Success/error/cleanup paths | Commands and artifacts | Result |
|---|---|---|---|---|
| REQ-001 | isolated-serve.ts `p0-2` command path, parseP02Args, getP02Runner | CLI route → parse → execute; rejection paths for missing/distinct ports | `Verified-by: ls audits/p0-2/evidence/pre-change-PHASE-06.json → No such file` | INVALID (Freeze Gate) |
| REQ-002 | isolated-serve.ts p0-2 stdout branch (lines 178-186), runP02 result.ok/status | PASS JSON contract; firstFailure mapping on FAIL | `Verified-by: grep lock_id audits/p0-2/scope-lock.json → "PHASE-05"` | INVALID (Freeze Gate) |
| REQ-003 | runP02 result.runDirA/runDirB, manifestA/B.paths.manifestPath | A/B independent run IDs; readable artifacts | `Verified-by: git status --short scripts/test-serve/ → 6 modified + 7 untracked` | INVALID (Freeze Gate + scope violation) |
| SCOPE | PHASE-06 Allowed files (only 06-phase-cli-smoke.md execute-only) vs actual dirty paths | Plan Forbidden: 不修改代码 | `Verified-by: git diff --stat HEAD -- scripts/test-serve/ → 4+ code files modified` | INVALID (scope violation) |

State why the sweep requirement set exactly equals the frozen in-scope set: The three requirements (REQ-001/002/003) from 06-phase-cli-smoke.md#Local-requirements form the complete in-scope set. However, sweep is BLOCKED at the Freeze Gate verification step — without a frozen scope-lock and pre-change receipt, no control can be admissibly executed. Sweep status is BLOCKED, not COMPLETE; verdict is INVALID.

## 5. Classified Findings

### 5.1 BLOCKING

**F-001: Pre-Implementation Freeze Gate NOT completed for PHASE-06 (AGENTS.md §15 P-02 violation)**

- **Linked requirements**: REQ-001, REQ-002, REQ-003
- **Classification**: BLOCKING
- **Origin**: PROCESS_VIOLATION (implementation began before Freeze Gate completion)
- **Status**: OPEN
- **Pre-fix control**: `ls audits/p0-2/evidence/pre-change-PHASE-06.json` → FAIL (No such file or directory)
- **Evidence**:
  - `ls audits/p0-2/evidence/` → only `pre-change-PHASE-05.json` and `pre-change-PHASE-05-v2.json` exist; no PHASE-06 receipt
  - `grep lock_id audits/p0-2/scope-lock.json` → `"lock_id": "PHASE-05"` (not PHASE-06)
  - `grep phase_id audits/p0-2/scope-lock.json` → `"phase_id": "PHASE-05"`
- **Closure conditions**:
  1. Fill `scope-lock.json` (or new scope-lock-phases-06.json) with `lock_id=PHASE-06` covering PHASE-06 REQ/Check Registry/oracle
  2. Obtain human reviewer approval for PHASE-06 scope-lock
  3. Run `capture-state.ts --phase-id PHASE-06` to produce `evidence/pre-change-PHASE-06.json`
  4. Verify `pre-change-PHASE-06.json` exists and non-empty (`test -s` + content assertion)
  5. Re-execute PHASE-06 CLI smoke with second port pair (4003/4004) **without modifying any code**
  6. Re-audit with frozen scope and full positive/negative controls

**F-002: PHASE-06 plan scope violated — code modified despite 'execute-only, 不修改代码'**

- **Linked requirements**: REQ-001, REQ-002, REQ-003
- **Classification**: BLOCKING
- **Origin**: PROCESS_VIOLATION (introduced_after_freeze: true — code changes introduced during a phase whose plan forbids code changes)
- **Status**: OPEN
- **Pre-fix control**: `git status --short scripts/test-serve/` → FAIL (4+ code files modified/created)
- **Evidence**:
  - `git status --short scripts/test-serve/` shows:
    - `M scripts/test-serve/__tests__/verify-p02.test.ts`
    - `M scripts/test-serve/isolated-serve.ts`
    - `M scripts/test-serve/p01b-orchestrator.ts`
    - `M scripts/test-serve/run-context.ts`
    - `M scripts/test-serve/types.ts`
    - `M scripts/test-serve/verify-p02.ts`
    - `?? scripts/test-serve/cleanup.ts` (NEW)
    - `?? scripts/test-serve/p02-orchestrator.ts`
    - `?? scripts/test-serve/p02-sentinel.ts`
    - `?? scripts/test-serve/__tests__/p02-cli-harness.ts`
    - `?? scripts/test-serve/__tests__/p02-cli.test.ts`
    - `?? scripts/test-serve/__tests__/p02-orchestrator.test.ts`
    - `?? scripts/test-serve/__tests__/p02-runtime.test.ts`
  - `git diff --stat HEAD -- scripts/test-serve/cleanup.ts scripts/test-serve/isolated-serve.ts scripts/test-serve/p02-orchestrator.ts scripts/test-serve/p01b-orchestrator.ts` → `isolated-serve.ts 276 lines, p01b-orchestrator.ts 2 lines` (plus cleanup.ts as new untracked file)
  - `grep -A 5 'Allowed files' 06-phase-cli-smoke.md` → only `06-phase-cli-smoke.md` (execute only)
  - `grep -A 3 'Forbidden' 06-phase-cli-smoke.md` → `不修改代码；不复用 PHASE-05 端口；不设置 H2；不在失败后重试；不手工编辑 manifest。`
- **Allowed files**: `plans/隔离 serve 测试基建待办/p0-2/06-phase-cli-smoke.md` only
- **Forbidden changes**:
  - `scripts/test-serve/cleanup.ts` (NEW FILE — code modification forbidden by plan)
  - `scripts/test-serve/isolated-serve.ts` (276 lines changed — code modification forbidden)
  - `scripts/test-serve/p01b-orchestrator.ts` (2 lines changed — code modification forbidden)
  - `scripts/test-serve/p02-orchestrator.ts` (modified per log — code modification forbidden)
- **Closure conditions**:
  1. Either revert all code modifications and execute CLI smoke purely against existing implementation, OR
  2. Recognize that PHASE-06 plan's 'execute-only, no code modification' contract was violated and update plan to forbid the current path, then re-plan with a new phase (e.g., PHASE-06a) that legitimately covers the cleanup.ts extraction as an infrastructure fix with proper Freeze Gate
  3. The circular-dependency TDZ fix is a legitimate infrastructure defect (similar to PHASE-05's F-001 scope-lock amendment), but it cannot be silently smuggled into an execute-only phase — it requires its own phase with proper Freeze Gate

### 5.2 NON_BLOCKING_DEBT

**Implementation log inaccuracy**: log claims "45 pass / 0 fail / 264 expect() 确认无回归" but actual `bun test scripts/test-serve/__tests__` returns `292 pass / 2 fail / 5350 expect() calls`. The 2 failures are runtime tests requiring explicit `P0_1B_PORT`/`P0_2_PORT_A|B` environment variables (per AGENTS.md §6.2). The log's numbers refer to a subset (likely cleanup-related tests only) but are presented as if the full suite passed. This is a documentation accuracy issue, not a blocking defect.

### 5.3 OUT_OF_SCOPE

NONE for this audit. The component test discrepancy is classified as debt (5.2); the scope violations are in-scope findings (5.1).

### 5.4 UNVERIFIED

- PHASE-06 CLI smoke actual runtime PASS/FAIL cannot be verified because no admissible pre-change receipt exists. The log's claim of "ok:true status:PASS; 16 stages all ok; 5 check groups all true; A/B independent run IDs" is a CLAIM only and cannot be promoted to VERIFIED without a reconstructed audit (which is forbidden by skill rule 14).

## 6. Falsification Evidence

| REQ | Positive command/result | Negative method | Negative command/result | Sensitivity verdict |
|---|---|---|---|---|
| REQ-001 | NOT_RUN (reconstructed audit forbidden) | P02-S-PORTS | NOT_RUN | INVALID (process violation) |
| REQ-002 | NOT_RUN (reconstructed audit forbidden) | P02-S-PAYLOAD | NOT_RUN | INVALID (process violation) |
| REQ-003 | NOT_RUN (reconstructed audit forbidden) | independentEvidence | NOT_RUN | INVALID (process violation) |
| SCOPE | `git status --short scripts/test-serve/` → 6 modified + 7 untracked | N/A (static check) | N/A | SENSITIVE (scope violation detected) |

## 7. Frozen Rework Package

NONE. INVALID verdict cannot emit actionable rework package per plan-audit-archiver skill invariant #9: "Fail closed. An invalid audit contract produces `INVALID`; unavailable required evidence produces `BLOCKED`. Neither state may emit an actionable rework package or claim completion."

The closure conditions listed in F-001 and F-002 are informational guidance for the implementer to re-enter the proper Freeze Gate workflow, not a frozen rework package.

## 8. Reopen Records

NONE. This is generation 1 of a new audit chain for PHASE-06; no prior PHASE-06 audit exists to reopen.

## 9. Closure Matrix

| Requirement | Status | Blocking findings | Positive proof | Negative sensitivity proof | Exit gate |
|---|---|---|---|---|---|
| REQ-001 | INVALID | F-001, F-002 | NONE (NOT_RUN) | NONE (NOT_RUN) | OPEN |
| REQ-002 | INVALID | F-001, F-002 | NONE (NOT_RUN) | NONE (NOT_RUN) | OPEN |
| REQ-003 | INVALID | F-001, F-002 | NONE (NOT_RUN) | NONE (NOT_RUN) | OPEN |
| SCOPE-CHECK | FAIL | F-002 | `git status` → 4+ code files modified | N/A (static) | OPEN |

## 10. Verdict

**Verdict**: `INVALID`

**Rationale**:

1. **Pre-Implementation Freeze Gate violation (AGENTS.md §15 rule P-02)**: PHASE-06 is declared `v2.1-required` in `00-plan-index.md` (line 11). Rule P-02 requires that before any code write, the implementer must (a) fill `scope-lock.json` with PHASE-06 scope, (b) obtain human reviewer approval, (c) run `capture-state.ts` to produce `evidence/pre-change-PHASE-06.json`, and (d) verify the receipt exists and is non-empty. **None of these steps were completed for PHASE-06.** The `scope-lock.json` still has `lock_id=PHASE-05`; no `pre-change-PHASE-06.json` exists. Per rule P-02 violation consequence: "审计必须判定为 `INVALID`（不是 BLOCKED），因为实施流程违规导致审计合同无效."

2. **Plan-audit-archiver skill rule 14**: "When `provenance_level = v2.1-required`, Step 1 (Freeze) MUST verify that `evidence/pre-change-<PHASE-N>.json` exists and is non-empty before any implementation write. If the pre-change receipt is missing, the audit verdict MUST be `INVALID` (not `BLOCKED`). Reconstructed audits for phases missing a pre-change receipt are MUST NOT."

3. **Plan scope violation (F-002)**: PHASE-06 plan's Allowed files lists ONLY `06-phase-cli-smoke.md` (execute only), and Forbidden section explicitly states `不修改代码`. However, the implementation created `scripts/test-serve/cleanup.ts` (new file) and modified `isolated-serve.ts` (276 lines), `p01b-orchestrator.ts` (2 lines), and `p02-orchestrator.ts`. This is a direct violation of the plan's frozen contract.

4. **No positive/negative controls admissible**: Per skill rule 14, reconstructed audits are forbidden. Running controls now would require reconstructing the pre-change state, which is explicitly forbidden. Therefore all three requirements are NOT_RUN and the sweep status is BLOCKED.

5. **Implementation log inaccuracy**: The log's claim of "45 pass / 0 fail / 264 expect()" is a subset figure presented as if the full suite passed. Actual full-suite result is `292 pass / 2 fail / 5350 expect()` (2 failures are runtime tests requiring explicit ports). This is documentation debt but not a blocking finding.

## 11. Validator Evidence

```text
Verified-by: cd /home/zhaoge/workspace/qoderwork && bun run .agents/skills/plan-audit-archiver/scripts/validate-audit.ts audits/p0-2/2026-07-20-phase-06-cli-smoke-audit.md → (output recorded in Step 9)
```

For INVALID verdicts, `validate-audit.ts` exit 0 is NOT a signing requirement per skill rule 16 (which applies only to ACCEPT/REWORK). The validator is run for diagnostic purposes to confirm the INVALID classification is structurally consistent.

## 12. Anti-Loop Answers

1. **Full frozen scope completed?** NO. The scope was never frozen for PHASE-06 (scope-lock still has PHASE-05 lock_id). Sweep status is BLOCKED at the Freeze Gate verification step, not COMPLETE. This is why the verdict is INVALID, not REWORK.

2. **Bad fixture proving test sensitivity?** NO. No positive/negative controls were run because reconstructed audits are forbidden (skill rule 14). All three requirements have `NOT_RUN` for both controls.

3. **Rework package equals all open blockers?** N/A. INVALID verdict cannot emit a rework package (skill invariant #9). F-001 and F-002 are open blockers with informational closure conditions only.

4. **Criteria added after freeze?** N/A. No freeze occurred for PHASE-06. The criteria being applied (AGENTS.md §15 P-02 + PHASE-06 plan Allowed/Forbidden) are pre-existing plan and rule requirements, not post-hoc additions.

5. **New findings classified by origin?** YES. F-001 and F-002 are both `PROCESS_VIOLATION` origin (a non-standard but accurate classification — the implementer violated the process contract before any code was written). F-002 has `introduced_after_freeze: true` because code changes were introduced during a phase whose plan forbids code changes.

6. **Exact condition ending this audit generation?** INVALID — the Pre-Implementation Freeze Gate was not completed for a v2.1-required phase, which per AGENTS.md §15 P-02 and skill rule 14 mandates INVALID verdict. The audit cannot be reconstructed; the implementer must re-enter the proper Freeze Gate workflow with a new phase (PHASE-06a or amended PHASE-06) that either (a) honors the execute-only contract or (b) legitimately covers the cleanup.ts extraction with proper scope-lock and human approval.

7. **External CLI checks?** The validator `validate-audit.ts` is run diagnostically. For INVALID verdicts, exit 0 is not required (rule 16 applies only to ACCEPT/REWORK). The pre-check `pre-check-evidence.ts` is also run for completeness. Both results are recorded in Step 9.
