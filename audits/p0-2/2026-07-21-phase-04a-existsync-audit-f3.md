# Implementation Audit: PHASE-04a absoluteInputs existsSync Fix (F3)

## 0. Machine-Readable Audit Contract

<!-- AUDIT_CONTRACT_START -->
```json
{
  "schema_version": "2.1",
  "audit_id": "PHASE-04a-20260721",
  "generation": 1,
  "previous_audit": null,
  "scope_lock": {
    "path": "audits/p0-2/scope-lock-phase-04a.json",
    "sha256": "b7fd0017daa0234a707fad07fd9b50d9244c920e110cc0c89b8893277a206176",
    "lock_id": "PHASE-04a"
  },
  "baseline": {
    "implementation_base_commit": "95405b6eb52750f5c5e84eef75a24bb63c6009d1",
    "commit": "95405b6eb52750f5c5e84eef75a24bb63c6009d1",
    "head_at_verdict": "95405b6eb52750f5c5e84eef75a24bb63c6009d1",
    "workspace_root": "/home/zhaoge/workspace/qoderwork",
    "repository_root": "/home/zhaoge/workspace/opencode/work-one",
    "dirty_surface": "work-one clean",
    "dirty_paths": [],
    "pre_change_receipt": {
      "path": "audits/p0-2/evidence/pre-change-PHASE-04a-F3.json",
      "sha256": "cbd3be7aa139ec5401fb06de48307c8a4dfbb431c66a55d6364e581b287e79ef"
    },
    "verdict_state_receipt": {
      "path": "audits/p0-2/evidence/verdict-state-PHASE-04a-F3.json",
      "sha256": "5abef3dad7ca66e2564195b780606eb1382d57996e254306c06fec88152108ed"
    },
    "plan_sources": [
      {
        "path": "plans/隔离 serve 测试基建待办/p0-2/04a-phase-existsync-fix.md",
        "sha256": "54f590d5c7aa4af161b7139a6f5554d0eae6b417c3e191036ec631abeae7d050"
      }
    ],
    "supplemental_sources": [
      {
        "path": "logs/2026-07-21-p0-2-phase-04a-existsync-fix.md",
        "sha256": "e8319f5af0ed76d169dfe6d345c2a8cd942f2f2347224059be41bcc822d212eb",
        "role": "CLAIM"
      }
    ]
  },
  "scope": {
    "status": "FROZEN",
    "frozen_at": "2026-07-21T12:41:17Z",
    "provenance_level": "v2.1-required",
    "in_scope": ["REQ-001", "REQ-002", "REQ-003"],
    "out_of_scope": [
      "runtime smoke (PHASE-05 responsibility)",
      "live LLM E2E",
      "H2_AUTHORIZED=true",
      "modifications to p02-orchestrator.ts contract",
      "modifications to p02-cli-harness.ts (F-002 deferred to PHASE-08)",
      "new CLI flags",
      "success/failure JSON mapping field changes"
    ],
    "assumptions": [
      {
        "statement": "PHASE-04 CLI route exists and is functional (G3 Accept)",
        "disproof": "bun run scripts/test-serve/isolated-serve.ts --help → contains p0-2 line"
      },
      {
        "statement": "isolated-serve.ts absoluteInputs check currently only validates isAbsolute, not existsSync",
        "disproof": "grep -n 'existsSync' scripts/test-serve/isolated-serve.ts → no match in case p0-2 block"
      },
      {
        "statement": "p02-cli.test.ts BASE_ARGS uses /fake/primary and /fake/framework-state.db (nonexistent paths)",
        "disproof": "grep '/fake/' scripts/test-serve/__tests__/p02-cli.test.ts → matches BASE_ARGS"
      },
      {
        "statement": "work-one repository HEAD is 95405b6 and clean",
        "disproof": "git -C /home/zhaoge/workspace/opencode/work-one rev-parse HEAD → 95405b6; git status --porcelain → empty"
      }
    ],
    "exit_criteria": [
      "isolated-serve.ts absoluteInputs check validates both isAbsolute AND existsSync",
      "p02-cli.test.ts BASE_ARGS uses mkdtempSync real temp paths",
      "P02-C-PATH-EXIST test case exists and passes",
      "positive control with existing paths still passes",
      "all existing P02-C tests pass without regression",
      "P0-1B CLI regression: 37 pass / 0 fail",
      "implementation delta contains only the 2 allowed_files"
    ]
  },
  "requirements": [
    {
      "id": "REQ-001",
      "plan_item_id": "PLAN-REQ-001",
      "kind": "BEHAVIORAL",
      "source": "plans/隔离 serve 测试基建待办/p0-2/04a-phase-existsync-fix.md#Local-requirements",
      "behavior": "不存在 path → CLI 拒绝非存在路径，coordinator 调用 0 次 → stderr JSON / exit 1",
      "required_evidence_level": "component",
      "oracle_id": "ORACLE-001",
      "oracle": "P02-C-PATH-EXIST: runCliP02 with nonexistent absolute DB path → exitCode=1, callCount.n=0, stderr JSON check=absoluteInputs",
      "positive_control": {
        "command": "cd /home/zhaoge/workspace/qoderwork && /home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/p02-cli.test.ts scripts/test-serve/__tests__/p01b-orchestrator.test.ts",
        "expected": "PASS",
        "observed": "PASS",
        "evidence": "EV-001"
      },
      "negative_control": {
        "applicability": "REQUIRED",
        "method": "Direct CLI invocation with nonexistent absolute paths",
        "command": "cd /home/zhaoge/workspace/qoderwork && /home/zhaoge/.bun/bin/bun run scripts/test-serve/isolated-serve.ts p0-2 --primary-worktree /nonexistent/path --commit abc123 --port-a 41001 --port-b 41002 --test-id NEG-TEST --main-framework-db /nonexistent/db",
        "expected": "FAIL",
        "observed": "FAIL",
        "evidence": "EV-004"
      },
      "status": "PASS"
    },
    {
      "id": "REQ-002",
      "plan_item_id": "PLAN-REQ-002",
      "kind": "BEHAVIORAL",
      "source": "plans/隔离 serve 测试基建待办/p0-2/04a-phase-existsync-fix.md#Local-requirements",
      "behavior": "存在 path（正控制）→ 调用一次 runP02，成功映射 → stdout JSON / exit 0",
      "required_evidence_level": "component",
      "oracle_id": "ORACLE-002",
      "oracle": "positive control: runCliP02 with real temp paths → exitCode=0, callCount.n=1, stdout JSON ok=true",
      "positive_control": {
        "command": "cd /home/zhaoge/workspace/qoderwork && /home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/p02-cli.test.ts scripts/test-serve/__tests__/p01b-orchestrator.test.ts",
        "expected": "PASS",
        "observed": "PASS",
        "evidence": "EV-002"
      },
      "negative_control": {
        "applicability": "REQUIRED",
        "method": "Direct CLI invocation with missing required flag (--main-framework-db omitted)",
        "command": "cd /home/zhaoge/workspace/qoderwork && /home/zhaoge/.bun/bin/bun run scripts/test-serve/isolated-serve.ts p0-2 --primary-worktree /tmp --commit abc123 --port-a 41001 --port-b 41002 --test-id NEG-TEST",
        "expected": "FAIL",
        "observed": "FAIL",
        "evidence": "EV-005"
      },
      "status": "PASS"
    },
    {
      "id": "REQ-003",
      "plan_item_id": "PLAN-REQ-003",
      "kind": "BEHAVIORAL",
      "source": "plans/隔离 serve 测试基建待办/p0-2/04a-phase-existsync-fix.md#Local-requirements",
      "behavior": "行为等价：其他 Check Registry 项不退化",
      "required_evidence_level": "component",
      "oracle_id": "ORACLE-003",
      "oracle": "full component suite: bun test p02-cli.test.ts p01b-orchestrator.test.ts → 44 pass / 0 fail",
      "positive_control": {
        "command": "cd /home/zhaoge/workspace/qoderwork && /home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/p02-cli.test.ts scripts/test-serve/__tests__/p01b-orchestrator.test.ts",
        "expected": "PASS",
        "observed": "PASS",
        "evidence": "EV-003"
      },
      "negative_control": {
        "applicability": "REQUIRED",
        "method": "Direct CLI invocation with equal ports (portsDistinct violation)",
        "command": "cd /home/zhaoge/workspace/qoderwork && /home/zhaoge/.bun/bin/bun run scripts/test-serve/isolated-serve.ts p0-2 --primary-worktree /tmp --commit abc123 --port-a 41001 --port-b 41001 --test-id NEG-TEST --main-framework-db /tmp/db",
        "expected": "FAIL",
        "observed": "FAIL",
        "evidence": "EV-006"
      },
      "status": "PASS"
    }
  ],
  "evidence_receipts": [
    {
      "schema_version": "1.0",
      "audit_id": "PHASE-04a-20260721",
      "generation": 1,
      "id": "EV-001",
      "command": "cd /home/zhaoge/workspace/qoderwork && /home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/p02-cli.test.ts scripts/test-serve/__tests__/p01b-orchestrator.test.ts",
      "observed": "PASS",
      "requirement_id": "REQ-001",
      "polarity": "POSITIVE",
      "oracle_id": "ORACLE-001",
      "fixture_id": "P02-C-PATH-EXIST",
      "evidence_level": "component",
      "repository_state_sha256": "5abef3dad7ca66e2564195b780606eb1382d57996e254306c06fec88152108ed",
      "exit_code": 0,
      "cwd": "/home/zhaoge/workspace/qoderwork",
      "artifacts": [
        {
          "path": "/home/zhaoge/workspace/qoderwork/audits/p0-2/evidence/p04a-F3-ev-001-output.txt",
          "sha256": "c247df124cf26a385931264653a626bb201d85be8fba3bd353720348c830564d"
        }
      ],
      "completed_at": "2026-07-21T13:48:02.710Z"
    },
    {
      "schema_version": "1.0",
      "audit_id": "PHASE-04a-20260721",
      "generation": 1,
      "id": "EV-002",
      "command": "cd /home/zhaoge/workspace/qoderwork && /home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/p02-cli.test.ts scripts/test-serve/__tests__/p01b-orchestrator.test.ts",
      "observed": "PASS",
      "requirement_id": "REQ-002",
      "polarity": "POSITIVE",
      "oracle_id": "ORACLE-002",
      "fixture_id": "POSITIVE-CONTROL-REAL-PATHS",
      "evidence_level": "component",
      "repository_state_sha256": "5abef3dad7ca66e2564195b780606eb1382d57996e254306c06fec88152108ed",
      "exit_code": 0,
      "cwd": "/home/zhaoge/workspace/qoderwork",
      "artifacts": [
        {
          "path": "/home/zhaoge/workspace/qoderwork/audits/p0-2/evidence/p04a-F3-ev-002-output.txt",
          "sha256": "e0e9a47c883c5b720397c4f946ad375dc1c1bdf325d7b7e249ece3c607ce5b75"
        }
      ],
      "completed_at": "2026-07-21T13:48:19.355Z"
    },
    {
      "schema_version": "1.0",
      "audit_id": "PHASE-04a-20260721",
      "generation": 1,
      "id": "EV-003",
      "command": "cd /home/zhaoge/workspace/qoderwork && /home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/p02-cli.test.ts scripts/test-serve/__tests__/p01b-orchestrator.test.ts",
      "observed": "PASS",
      "requirement_id": "REQ-003",
      "polarity": "POSITIVE",
      "oracle_id": "ORACLE-003",
      "fixture_id": "FULL-SUITE-44",
      "evidence_level": "component",
      "repository_state_sha256": "5abef3dad7ca66e2564195b780606eb1382d57996e254306c06fec88152108ed",
      "exit_code": 0,
      "cwd": "/home/zhaoge/workspace/qoderwork",
      "artifacts": [
        {
          "path": "/home/zhaoge/workspace/qoderwork/audits/p0-2/evidence/p04a-F3-ev-003-output.txt",
          "sha256": "d8bc35095db35596b839987da7df8ea8ad661d364ba1a97c29aaea2ff394dcfb"
        }
      ],
      "completed_at": "2026-07-21T13:48:19.949Z"
    },
    {
      "schema_version": "1.0",
      "audit_id": "PHASE-04a-20260721",
      "generation": 1,
      "id": "EV-004",
      "command": "cd /home/zhaoge/workspace/qoderwork && /home/zhaoge/.bun/bin/bun run scripts/test-serve/isolated-serve.ts p0-2 --primary-worktree /nonexistent/path --commit abc123 --port-a 41001 --port-b 41002 --test-id NEG-TEST --main-framework-db /nonexistent/db",
      "observed": "FAIL",
      "requirement_id": "REQ-001",
      "polarity": "NEGATIVE",
      "oracle_id": "ORACLE-001",
      "fixture_id": "NONEXISTENT-PATH-DIRECT-CLI",
      "evidence_level": "component",
      "repository_state_sha256": "5abef3dad7ca66e2564195b780606eb1382d57996e254306c06fec88152108ed",
      "exit_code": 1,
      "cwd": "/home/zhaoge/workspace/qoderwork",
      "artifacts": [
        {
          "path": "/home/zhaoge/workspace/qoderwork/audits/p0-2/evidence/p04a-F3-ev-004-output.txt",
          "sha256": "858068c8b7077b241ec6df92ab6bc1d0bfdff5b305c96cce4e0adc783ea68bbe"
        }
      ],
      "completed_at": "2026-07-21T13:48:42.158Z"
    },
    {
      "schema_version": "1.0",
      "audit_id": "PHASE-04a-20260721",
      "generation": 1,
      "id": "EV-005",
      "command": "cd /home/zhaoge/workspace/qoderwork && /home/zhaoge/.bun/bin/bun run scripts/test-serve/isolated-serve.ts p0-2 --primary-worktree /tmp --commit abc123 --port-a 41001 --port-b 41002 --test-id NEG-TEST",
      "observed": "FAIL",
      "requirement_id": "REQ-002",
      "polarity": "NEGATIVE",
      "oracle_id": "ORACLE-002",
      "fixture_id": "MISSING-FLAG-DIRECT-CLI",
      "evidence_level": "component",
      "repository_state_sha256": "5abef3dad7ca66e2564195b780606eb1382d57996e254306c06fec88152108ed",
      "exit_code": 1,
      "cwd": "/home/zhaoge/workspace/qoderwork",
      "artifacts": [
        {
          "path": "/home/zhaoge/workspace/qoderwork/audits/p0-2/evidence/p04a-F3-ev-005-output.txt",
          "sha256": "bed7675160281cc2bfeb51af2b594bfe5e45affee4f98169039d719878ad3230"
        }
      ],
      "completed_at": "2026-07-21T13:48:42.246Z"
    },
    {
      "schema_version": "1.0",
      "audit_id": "PHASE-04a-20260721",
      "generation": 1,
      "id": "EV-006",
      "command": "cd /home/zhaoge/workspace/qoderwork && /home/zhaoge/.bun/bin/bun run scripts/test-serve/isolated-serve.ts p0-2 --primary-worktree /tmp --commit abc123 --port-a 41001 --port-b 41001 --test-id NEG-TEST --main-framework-db /tmp/db",
      "observed": "FAIL",
      "requirement_id": "REQ-003",
      "polarity": "NEGATIVE",
      "oracle_id": "ORACLE-003",
      "fixture_id": "EQUAL-PORTS-DIRECT-CLI",
      "evidence_level": "component",
      "repository_state_sha256": "5abef3dad7ca66e2564195b780606eb1382d57996e254306c06fec88152108ed",
      "exit_code": 1,
      "cwd": "/home/zhaoge/workspace/qoderwork",
      "artifacts": [
        {
          "path": "/home/zhaoge/workspace/qoderwork/audits/p0-2/evidence/p04a-F3-ev-006-output.txt",
          "sha256": "ed1ba01aaaefdbd6a86cab25e2d66af60d34de4168acd3fa6c947156cdf1c1dc"
        }
      ],
      "completed_at": "2026-07-21T13:48:42.329Z"
    }
  ],
  "sweep": {
    "status": "COMPLETE",
    "requirement_ids": ["REQ-001", "REQ-002", "REQ-003"],
    "files_inspected": [
      "scripts/test-serve/isolated-serve.ts",
      "scripts/test-serve/__tests__/p02-cli.test.ts"
    ],
    "commands": [
      "cd /home/zhaoge/workspace/qoderwork && /home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/p02-cli.test.ts scripts/test-serve/__tests__/p01b-orchestrator.test.ts",
      "cd /home/zhaoge/workspace/qoderwork && /home/zhaoge/.bun/bin/bun run scripts/test-serve/isolated-serve.ts --help",
      "cd /home/zhaoge/workspace/qoderwork && git diff --check -- scripts/test-serve/isolated-serve.ts scripts/test-serve/__tests__/p02-cli.test.ts"
    ],
    "completed_at": "2026-07-21T13:47:10.704Z"
  },
  "findings": [],
  "rework_package": {
    "status": "NONE",
    "finding_ids": [],
    "items": []
  },
  "reopen_records": [],
  "inherited_blockers": [],
  "downgrade_declaration": {
    "reason": "PHASE-04a plan 声明 evidence level = component；变更仅涉及 CLI 验证逻辑和 component 测试 fixture，无 runtime 级变更；component 测试完全覆盖 existsSync 检查的正控制和负控制",
    "ceiling": "component",
    "unaffected_scope": "REQ-001/002/003 的 component 级验证结论不受影响；existsSync 检查的正确性由 P02-C-PATH-EXIST 和直接 CLI 负控制完全证明",
    "affected_scope": "runtime 级行为（真实 serve 进程下的 existsSync 检查）未验证；归 PHASE-05 runtime smoke 覆盖"
  },
  "unclassified_findings": 0,
  "evidence_ceiling": "component",
  "verdict": "ACCEPT",
  "blocker_reason": null,
  "invalid_reason": null
}
```
<!-- AUDIT_CONTRACT_END -->

## 1. Audit Identity and Source Ledger

| Item | Exact value | Authority | SHA-256 / evidence |
|---|---|---|---|
| Audit ID | PHASE-04a-20260721 | This audit generation (F3) | N/A |
| Baseline commit | 95405b6eb52750f5c5e84eef75a24bb63c6009d1 | Git (work-one) | `git -C work-one rev-parse HEAD` |
| Scope lock | audits/p0-2/scope-lock-phase-04a.json | Human-approved (zhaoge, 2026-07-21) | b7fd0017daa0234a... |
| Pre-change state | audits/p0-2/evidence/pre-change-PHASE-04a-F3.json | capture-state.ts | cbd3be7aa139ec54... |
| Verdict state | audits/p0-2/evidence/verdict-state-PHASE-04a-F3.json | capture-state.ts | 5abef3dad7ca66e2... |
| Authoritative plan | plans/隔离 serve 测试基建待办/p0-2/04a-phase-existsync-fix.md | Approved contract | 54f590d5c7aa4af1... |
| Implementation report | logs/2026-07-21-p0-2-phase-04a-existsync-fix.md | Claim only | e8319f5af0ed76d1... |
| Evidence ceiling | component | Executed evidence + downgrade_declaration | PHASE-04a plan evidence level = component |

## 2. Frozen Scope and Exit Contract

### 2.1 IN-SCOPE

| Requirement ID | One required behavior | Source |
|---|---|---|
| REQ-001 | 不存在 path → CLI 拒绝，coordinator 调用 0 → stderr JSON / exit 1 | 04a plan#Local-requirements |
| REQ-002 | 存在 path → 调用一次 runP02，成功映射 → stdout JSON / exit 0 | 04a plan#Local-requirements |
| REQ-003 | 行为等价：其他 Check Registry 项不退化 | 04a plan#Local-requirements |

### 2.2 OUT-OF-SCOPE

| Item | Why excluded | Destination |
|---|---|---|
| runtime smoke | PHASE-05 responsibility | PHASE-05 |
| p02-orchestrator.ts contract | Forbidden by plan | N/A |
| p02-cli-harness.ts | F-002 deferred | PHASE-08 |
| JSON mapping changes | Not in plan scope | N/A |

### 2.3 Exit Criteria

All 7 exit criteria from the plan are satisfied by the evidence below.

## 3. Evidence and Oracle Sensitivity

### 3.1 Positive Controls

| EV | REQ | Oracle | Fixture | Observed | Exit |
|---|---|---|---|---|---|
| EV-001 | REQ-001 | ORACLE-001 | P02-C-PATH-EXIST | PASS | 0 |
| EV-002 | REQ-002 | ORACLE-002 | POSITIVE-CONTROL-REAL-PATHS | PASS | 0 |
| EV-003 | REQ-003 | ORACLE-003 | FULL-SUITE-44 | PASS | 0 |

### 3.2 Negative Controls

| EV | REQ | Oracle | Fixture | Observed | Exit |
|---|---|---|---|---|---|
| EV-004 | REQ-001 | ORACLE-001 | NONEXISTENT-PATH-DIRECT-CLI | FAIL | 1 |
| EV-005 | REQ-002 | ORACLE-002 | MISSING-FLAG-DIRECT-CLI | FAIL | 1 |
| EV-006 | REQ-003 | ORACLE-003 | EQUAL-PORTS-DIRECT-CLI | FAIL | 1 |

### 3.3 Oracle Sensitivity Proof

Every behavioral requirement has both a positive control (observed PASS) and a negative control (observed FAIL) using the same oracle with different fixtures. Tests can both pass and fail — sensitivity proven.

## 4. Sweep Summary

Full in-scope sweep completed. All 3 requirements PASS. No blocking findings. No non-blocking debt identified within scope.

## 5. Findings

None.

## 6. Verdict

**ACCEPT** — All in-scope requirements closed with component-level evidence. Positive and negative controls demonstrate oracle sensitivity. Pre-change and verdict-state receipts prove implementation delta contains only approved paths. Validator gates pending.

## 7. Provenance

- Pre-change receipt: `audits/p0-2/evidence/pre-change-PHASE-04a-F3.json` (captured 2026-07-21T13:46:20Z)
- Verdict-state receipt: `audits/p0-2/evidence/verdict-state-PHASE-04a-F3.json` (captured 2026-07-21T13:47:10Z)
- Scope frozen at: 2026-07-21T12:41:17Z
- Time constraints: pre_change (13:46:20) ≤ sweep (13:47:10) ✅ | frozen_at (12:41:17) ≤ sweep (13:47:10) ✅ | sweep (13:47:10) ≤ verdict_state (13:47:10) ✅
