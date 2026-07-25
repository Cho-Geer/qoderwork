# Phase PHASE-02: Canonical contract receipt pre-check `[ANALYSIS→VERIFICATION]`

**Phase ID**: `PHASE-02`
**Depends on**: PHASE-01
**Outcome**: evidence pre-check 只检查 canonical contract 显式列出的 receipt，支持嵌套路径，并且不再以浅层目录为空作为通过结论。
**Evidence level**: component
**Progression status**: `NOT_STARTED`
**Completion receipt**: NONE

## Goal

- 完成 REQ-002：建立 `--contract` 唯一输入，逐项验证 receipt path、identity、hash、level、command 和 requirement binding。

## Starting state and dependency

- Required status: PHASE-01 completion gate is fully checked and its signed ACCEPT audit plus progression receipt pass admission.
- Required evidence before write: human-approved `scope-lock-PHASE-02.json`, nonempty `pre-change-PHASE-02.json`, current HEAD identity, and bounded `rg -n "findEvidenceFiles|extractAuditContract|checkGenerationConsistency" .agents/skills/plan-audit-archiver/scripts` caller record.
- If any required item is absent, record `BLOCKED`, preserve the observed files, and do not edit code or documentation.

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-002-A | CLI invocation | only `--contract` plus one concrete JSON path is accepted | missing, duplicate, or positional audit-dir input exits 2 |
| REQ-002-B | receipt path | normalize relative path and require it inside contract directory | outside path fails before read |
| REQ-002-C | listed receipt | verify nonempty JSON, id, audit_id, generation, requirement_id, polarity, cwd, command, artifacts, level, and SHA-256 | nested receipt passes when equal to ledger |
| REQ-002-D | behavior requirement | at least one matching receipt is present | empty behavior receipt list fails closed |
| REQ-002-E | orphan file | report unreferenced receipt as warning only | orphan cannot make a missing listed receipt pass |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `.agents/skills/plan-audit-archiver/scripts/pre-check-evidence.ts` | modify | CLI parser, contract reader, receipt-list validator, stable issue printer |
| `.agents/skills/plan-audit-archiver/scripts/__tests__/pre-check-evidence.test.ts` | add | `AGC-RECEIPT` temporary-audit fixtures |

## Forbidden files and behaviors

- Do not modify audit reports, `LATEST.md`, `validate-audit.ts`, `prepare-audit.ts`, `bun.lock`, work-one, or existing evidence files.
- Do not call `findLatestAuditReport`, use mtime ordering, treat `evidence/` shallow enumeration as the source of receipt truth, or issue a successful result for an empty behavior receipt list.
- `FOUND`, `NOT_FOUND`, and `UNAVAILABLE` are mandatory path states. A parse, permission, or directory-read failure is `UNAVAILABLE`; only `FOUND` is positive.

## Fixed contract

- The command grammar is exactly `bun run .agents/skills/plan-audit-archiver/scripts/pre-check-evidence.ts --contract audits/fixture/audit-contract.json`; reject all other argument shapes with exit 2 and `PRECHECK_ARGUMENT_INVALID`.
- Export one pure-result pre-check API that accepts the resolved contract path and returns issues plus warnings. The CLI only parses arguments, prints that result, and maps it to exit code; `finalize-audit.ts` must call this API rather than duplicate receipt rules.
- Contract input includes `audit_id`, `generation`, `requirements`, and `evidence_receipts`. Each ledger item supplies `id`, `path`, `sha256`, `requirement_id`, `polarity`, `oracle_id`, `fixture_id`, `evidence_level`, `command`, `observed`, `exit_code`, `cwd`, and `artifacts`.
- Resolve each receipt path against the contract file directory. After `resolve`, require the path prefix to remain within that directory. Require `readFileSync` success, nonempty content, JSON object, and SHA-256 equality with the contract ledger.
- Verify immutable receipt payload identity against contract `audit_id` and `generation`, then verify ledger fields against receipt fields. Emit a stable issue per failure: `EVIDENCE_RECEIPT_NOT_FOUND`, `EVIDENCE_RECEIPT_PATH_OUTSIDE_AUDIT`, `EVIDENCE_HASH_MISMATCH`, `EVIDENCE_RECEIPT_AUDIT_MISMATCH`, `EVIDENCE_RECEIPT_PAYLOAD_MISMATCH`, or `EVIDENCE_RECEIPT_LEVEL_TOO_LOW`.
- Derive required evidence level from the matching requirement. A behavior requirement has a receipt binding in its positive or negative control. A manual-only requirement is exempt only when its kind is exactly `STATIC` and both controls name `MANUAL`; do not infer exemption from missing data.
- Scan `evidence/` recursively only after listed receipts have passed. Print unreferenced receipt paths as `ORPHAN_RECEIPT_WARNING`; do not let an orphan affect exit status.
- Test diagnostics expose `failedChecks` or `Exact failure result`; tests assert exact stable codes and exit values.

## Implementation steps

```text
1. Verify Phase-02 Freeze Gate artifacts and record source hashes.
2. Replace positional audit-directory parsing with the exact --contract grammar.
3. Parse the contract once; validate its identity and ledger shape before reading any receipt.
4. Resolve and validate each listed receipt, including a nested evidence path.
5. Enforce requirement-to-receipt coverage and evidence-level comparison.
6. Add recursive orphan reporting after the mandatory list check; warnings never satisfy a requirement.
7. Build temporary all-pass audit fixtures and isolated missing, outside-path, hash, identity, level, and orphan mutations.
8. Run fixed verification. Any nonzero, `UNAVAILABLE`, scope drift, or changed forbidden file is BLOCKED.
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| AGC-RECEIPT-NESTED | contract ledger | read nested receipt | receipt equals ledger and hash | receipt absent: NOT_FOUND | `exit=0` |
| AGC-RECEIPT-BOUNDARY | contract path | resolve path | remains under audit directory | read failure: UNAVAILABLE | `EVIDENCE_RECEIPT_PATH_OUTSIDE_AUDIT` |
| AGC-RECEIPT-HASH | receipt JSON | SHA-256 compare | exact hash | file absent: NOT_FOUND | `EVIDENCE_HASH_MISMATCH` |
| AGC-RECEIPT-COVERAGE | requirement controls | coverage compare | behavior requirement has binding | contract unreadable: UNAVAILABLE | `EVIDENCE_RECEIPT_NOT_FOUND` |
| AGC-RECEIPT-ORPHAN | audit evidence tree | recursive post-check | warning only | directory unavailable: UNAVAILABLE | `ORPHAN_RECEIPT_WARNING` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| temporary audit directory | `mkdtempSync` | contract, nested evidence directory, result files | filesystem boundary proof |
| canonical contract | direct JSON | audit identity, one behavior requirement, one receipt ledger item | sole discovery source |
| nested receipt | direct JSON plus hash | matching identity, command cwd, positive polarity, integration level | proves nested path works |
| orphan receipt | direct JSON outside ledger | structurally valid but unreferenced | proves warning does not replace binding |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failure result | Other checks |
|---|---|---|---|---|---|
| AGC-C-201 | nested receipt | delete listed file | AGC-RECEIPT-NESTED | `EVIDENCE_RECEIPT_NOT_FOUND` | true |
| AGC-C-202 | nested receipt | set path to parent directory | AGC-RECEIPT-BOUNDARY | `EVIDENCE_RECEIPT_PATH_OUTSIDE_AUDIT` | true |
| AGC-C-203 | hashed receipt | alter one JSON field | AGC-RECEIPT-HASH | `EVIDENCE_HASH_MISMATCH` | true |
| AGC-C-204 | behavior control | remove ledger entry only | AGC-RECEIPT-COVERAGE | `EVIDENCE_RECEIPT_NOT_FOUND` | true |
| AGC-C-205 | no orphan | add unreferenced valid file | AGC-RECEIPT-ORPHAN | `exit=0` plus warning | true |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
bun test .agents/skills/plan-audit-archiver/scripts/__tests__/pre-check-evidence.test.ts
bun run typecheck
git diff --check
git diff --name-only -- .agents/skills/plan-audit-archiver/scripts/pre-check-evidence.ts .agents/skills/plan-audit-archiver/scripts/__tests__/pre-check-evidence.test.ts
git diff --exit-code -- bun.lock
```

- Required output: AGC-C-201 through AGC-C-205 pass with their exact result.
- Expected evidence level: component; no report or status page is published in this phase.
- On nonzero, missing, or `UNAVAILABLE` evidence: `BLOCKED`, preserve output, and do not advance.

## Rollback/failure convergence

1. Revert only edits in the two allowed files after preserving fixture output and issue records.
2. Do not delete a receipt to hide an orphan warning, modify historical audit directories, or restore positional input compatibility.

## Phase completion gate

- [ ] Freeze Gate artifacts are valid and PHASE-01 progression is accepted.
- [ ] AGC-C-201 through AGC-C-205 pass with exact diagnostics.
- [ ] A nested listed receipt passes and a shallow-empty directory cannot pass a behavior requirement.
- [ ] Typecheck, diff check, and allowlist check pass.
- [ ] PHASE-03 remains `NOT_STARTED` until this gate is fully checked and accepted.
