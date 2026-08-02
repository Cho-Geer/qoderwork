# Phase PHASE-01: 冻结范围与路径清单 `[ANALYSIS→VERIFICATION]`

**Phase ID**: `PHASE-01`
**Depends on**: NONE
**Outcome**: 产生可解析的路径清单、经 human reviewer 批准的 PHASE-02 scope lock，以及 work-one 锚点的 pre-change receipt。
**Evidence level**: `manual`; component is not claimed in this phase.
**Progression status**: `ACCEPTED`
**Completion receipt**: `../../audits/path-dynamic-resolution-m1/evidence/progression-receipt-PHASE-01.json`

## Goal

- 将路径扫描结果冻结为可审查对象，使 PHASE-02 只能修改索引中明确登记的六个产品文件。

## Starting state and dependency

- Required status: no earlier phase exists; work-one `git status --short` is empty immediately before capture.
- Required evidence: Blueprint v1.1.0 and this index both remain readable; `audits/path-dynamic-resolution-m1/` has no pre-existing PHASE-02 receipt.
- If absent: `BLOCKED`; do not create code files, scope locks, or receipts.

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-001 | scan input | run the exact fixed-string search from the blueprint | every result has path, line, text, and classification |
| REQ-001 | historical prefix | classify `audits/`, `e2e-evidence/`, and `logs/` as `PRESERVE_HISTORY` | no historical path enters PHASE-02 lock |
| REQ-001 | M1 source path | classify each exact PHASE-02 source path as `MIGRATE` | six source paths appear once in the lock |
| REQ-001 | unresolved row | retain `UNCLASSIFIED` and seek human decision | `failedChecks` contains `UNCLASSIFIED_PATH` and no downstream phase starts |
| REQ-001 | PHASE-02 admission | obtain human approval, then capture work-one state | receipt has matching `phase_id`, lock hash, and HEAD |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `audits/path-dynamic-resolution-m1/scope-lock-PHASE-02.json` | add | `lock_id: PHASE-02`, approval, repository scope |
| `audits/path-dynamic-resolution-m1/evidence/pre-change-PHASE-02.json` | add | `RepositoryStateReceipt` |
| `audits/path-dynamic-resolution-m1/evidence/path-scan.jsonl` | add | `rg --json` retained stream |
| `audits/path-dynamic-resolution-m1/evidence/path-inventory.json` | add | `schema_version`, `entries`, `failedChecks` |

## Forbidden files and behaviors

- Do not alter any `scripts/`, IDE configuration, `.gitignore`, blueprint, plan, work-one path, or historical evidence in this phase.
- Do not invent an approver identity, mark an unapproved lock `FROZEN`, or convert `UNAVAILABLE` into `NOT_FOUND`.

## Fixed contract

- Inventory schema: `{ "schema_version": 1, "scan_root": "/home/zhaoge/workspace/qoderwork/.worktrees/check-plan", "entries": [{ "path": string, "line": positive integer, "text": string, "classification": "MIGRATE" | "TEST_FIXTURE" | "LOCAL_CONFIG" | "DOC_EXAMPLE" | "PRESERVE_HISTORY" | "UNCLASSIFIED" }], "failedChecks": string[] }`.
- `scope-lock-PHASE-02.json.lock_id` equals `PHASE-02`; its `repository_scope.allowed_paths` equals exactly the six PHASE-02 source paths in the index; `forbidden_paths` includes the four tracked IDE files and work-one.
- Negative states: `FOUND / NOT_FOUND / UNAVAILABLE`. An unreadable scan or malformed JSON produces `failedChecks: ["INVENTORY_UNAVAILABLE"]`; an unresolved row produces `failedChecks: ["UNCLASSIFIED_PATH"]`.
- Current source: execute the scan and Git status now; historical scan totals cannot satisfy this gate.

## Implementation steps

```text
1. Read the M1 index and confirm no target code file is in this phase's allowed-file table.
2. Run the fixed scan below and create path-inventory.json using the stated schema.
3. Apply only the listed prefix and exact-path classifications; leave every other ambiguous row UNCLASSIFIED.
4. If failedChecks is nonempty, set this phase BLOCKED and request a human classification; do not continue.
5. Prepare the PHASE-02 scope lock, obtain human approval, then run capture-state with the fixed command.
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| PDR-SCAN | `rg --json` output | parse each match | readable entries | unreadable stream | `INVENTORY_UNAVAILABLE` |
| PDR-HISTORY | inventory JSON | inspect prefix rows | no history row is `MIGRATE` | malformed JSON | `INVENTORY_UNAVAILABLE` |
| PDR-CLASS | inventory JSON | inspect `failedChecks` | empty array | an `UNCLASSIFIED` row | `UNCLASSIFIED_PATH` |
| PDR-LOCK | scope lock JSON | compare six paths and approval | exact paths, human approval | missing/invalid lock | `SCOPE_LOCK_INVALID` |
| PDR-RECEIPT | receipt JSON | parse phase and lock hash | `phase_id` is `PHASE-02` | absent/unreadable receipt | `PRE_CHANGE_RECEIPT_INVALID` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| inventory | fixed scan and parse | every scanned match; empty `failedChecks` | freezes the review input |
| scope lock | audit author plus human approval | lock ID, approved timestamp, six allowed paths | limits PHASE-02 writes |
| pre-change receipt | `capture-state.ts` | repository realpath, HEAD, lock hash, phase ID | binds the baseline |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|
| PDR-M-001 | readable classified inventory | remove one entry classification | PDR-CLASS | `UNCLASSIFIED_PATH` | PDR-SCAN remains true |
| PDR-M-002 | approved lock | replace one allowed path | PDR-LOCK | `SCOPE_LOCK_INVALID` | PDR-SCAN remains true |
| PDR-M-003 | readable receipt | remove receipt file | PDR-RECEIPT | `PRE_CHANGE_RECEIPT_INVALID` | PDR-LOCK remains true |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
mkdir -p audits/path-dynamic-resolution-m1/evidence
git -C /home/zhaoge/workspace/opencode/work-one status --short
rg --hidden --json -F '/home/zhaoge/' -g '!blueprints/blueprint-dynamic-path-resolution.md' -g '!.git/**' > audits/path-dynamic-resolution-m1/evidence/path-scan.jsonl
/home/zhaoge/.bun/bin/bun run .agents/skills/plan-audit-archiver/scripts/capture-state.ts --repository-root /home/zhaoge/workspace/opencode/work-one --scope-lock audits/path-dynamic-resolution-m1/scope-lock-PHASE-02.json --phase-id PHASE-02 --output audits/path-dynamic-resolution-m1/evidence/pre-change-PHASE-02.json
```

- Required output/artifacts: `path-inventory.json`, approved scope lock, and nonempty receipt; `path-scan.jsonl` is retained as an audit artifact.
- Expected evidence level: manual. On nonzero output, nonempty work-one status, `UNCLASSIFIED_PATH`, or missing approval: `BLOCKED`; preserve artifacts; do not advance.

## Rollback/failure convergence

1. Preserve scan and incomplete lock under the audit directory; set progression status `BLOCKED` without changing source files.
2. Do not delete a receipt, overwrite an existing artifact, or retry with reviewer fields fabricated.

## Phase completion gate

- [X] Allowed-file diff only
- [X] Inventory schema parses and `failedChecks` is empty
- [X] Historical prefixes are `PRESERVE_HISTORY`
- [X] PHASE-02 lock has a human approval and the exact six allowed source paths
- [X] Pre-change receipt is nonempty and binds `PHASE-02`
- [X] Downstream Phase remains blocked until every box is checked
