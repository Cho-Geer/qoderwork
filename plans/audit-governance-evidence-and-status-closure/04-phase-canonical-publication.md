# Phase PHASE-04: Canonical contract 与受控发布 `[ANALYSIS→VERIFICATION]`

**Phase ID**: `PHASE-04`
**Depends on**: PHASE-03
**Outcome**: `audit-contract.json` 成为唯一可编辑机器事实；报告为不可变渲染物，`LATEST.md` 为携带 report hash 的原子发布指针。
**Evidence level**: integration
**Progression status**: `NOT_STARTED`
**Completion receipt**: NONE

## Goal

- 完成 REQ-004 和 REQ-005：生成器不再产出占位或默认 verdict；发布器复用 receipt pre-check，先验证不可变报告，再以单次 rename 切换 `LATEST.md`。

## Starting state and dependency

- Required status: PHASE-03 completion gate is fully checked and its signed ACCEPT audit plus progression receipt pass admission.
- Required evidence before write: human-approved `scope-lock-PHASE-04.json`, nonempty `pre-change-PHASE-04.json`, current HEAD identity, and bounded `rg -n "buildAuditContract|buildReportMarkdown|loadEvidenceReceipts|validateAuditFile" .agents/skills/plan-audit-archiver/scripts` caller record.
- If any required item is absent, record `BLOCKED`, preserve the observed files, and do not edit code or documentation.

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-004-A | contract generation | actual required arguments and explicitly named receipts are complete | generated JSON contains no `REPLACE_` token or default verdict |
| REQ-004-B | contract template | single canonical schema describes all editable facts | report prose is absent from template authority |
| REQ-005-A | report rendering | pre-check and structural audit validation pass | immutable report has matching embedded contract |
| REQ-005-B | LATEST publication | report exists, hash matches, and pointer content validates | single atomic pointer rename publishes report |
| REQ-005-C | failure | validation, write, or hash guard fails | old LATEST bytes remain unchanged; new unreferenced report is not a published verdict |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `.agents/skills/plan-audit-archiver/scripts/prepare-audit.ts` | modify | argument grammar, explicit receipt loader, `buildAuditContract` |
| `.agents/skills/plan-audit-archiver/scripts/finalize-audit.ts` | add | `finalizeAudit`, immutable report writer, LATEST pointer writer |
| `.agents/skills/plan-audit-archiver/scripts/__tests__/prepare-audit.test.ts` | modify | complete-contract and missing-input suites |
| `.agents/skills/plan-audit-archiver/scripts/__tests__/finalize-audit.test.ts` | add | `AGC-PUBLISH` real-filesystem suites |
| `.agents/skills/plan-audit-archiver/templates/audit-contract-template.json` | add | canonical contract field reference |

## Forbidden files and behaviors

- Do not modify `validate-audit.ts`, `pre-check-evidence.ts`, any historical report or `LATEST.md`, `bun.lock`, work-one, or external state.
- Do not generate `REPLACE_*`, default a verdict or evidence ceiling, choose the newest report by mtime, overwrite a report, manually edit `LATEST.md`, or use a two-file partial publish sequence.
- `FOUND`, `NOT_FOUND`, and `UNAVAILABLE` are mandatory publication observations. A report is publishable only after every required object is `FOUND`.

## Fixed contract

- `prepare-audit.ts` accepts explicit `--workspace-root`, `--scope-lock`, `--pre-change`, `--verdict-state`, one or more `--receipt`, one or more `--sweep-file`, one or more `--sweep-command`, `--verdict`, `--evidence-ceiling`, and `--output`. It rejects omitted, repeated-singleton, empty, default, or placeholder values before writing.
- `--receipt` values are explicit workspace-relative paths. The loader does not enumerate an evidence directory and retains each receipt path, SHA-256, and JSON payload in canonical deterministic order.
- Output from `prepare-audit.ts` is JSON only. It uses `wx`, the output must be named `audit-contract.json`, and a read-back parse plus `REPLACE_` scan must pass before success.
- `finalize-audit.ts --contract audits/fixture/audit-contract.json --report audits/fixture/2026-07-25-phase-01-audit.md` requires contract and report to share one audit directory, requires a new report path, calls the exported pre-check API, renders the report, then calls `validateAuditSource` on the rendered bytes.
- A report file is immutable and written with `wx`; it is not published until a valid `LATEST.md` names its basename and full SHA-256. The temporary pointer is written in the same directory and atomically renamed over `LATEST.md` after before-hash verification.
- On pointer write or before-hash failure, retain the old `LATEST.md` bytes. A newly written but unreferenced report is an orphan candidate and is reported; it does not constitute an audit verdict.
- Tests use real temporary filesystem paths for report, pointer, hash, and rename. Their assertions expose `failedChecks` or an exact failure code.

## Implementation steps

```text
1. Verify Phase-04 Freeze Gate artifacts and record source hashes.
2. Change prepare-audit CLI to require concrete single-value inputs and repeated explicit receipt and sweep inputs.
3. Make the generator write only audit-contract.json after read-back, SHA-256, and unresolved-token checks.
4. Add the canonical contract template and update tests for complete input and a single missing input.
5. Implement finalize-audit as a library function plus CLI wrapper that calls the Phase-02 pre-check API.
6. Render and structurally validate an immutable report before building a hash-bound LATEST pointer.
7. Use same-directory temporary pointer plus before-hash guard and atomic rename for the single publication transition.
8. Add real-filesystem all-pass, pre-check failure, report-hash failure, and pointer-conflict tests.
9. Run fixed verification. Any partial pointer change, replaced report, or out-of-allowlist diff is BLOCKED.
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| AGC-CONTRACT-COMPLETE | generator input | create contract JSON | read-back JSON has no unresolved token | input absent: NOT_FOUND | `PREPARE_ARGUMENT_INVALID` |
| AGC-CONTRACT-RECEIPT | explicit path list | hash and order receipts | canonical ledger matches inputs | read failure: UNAVAILABLE | `EVIDENCE_RECEIPT_NOT_FOUND` |
| AGC-PUBLISH-REPORT | rendered bytes | validate source | report contract is structurally valid | parser unavailable: UNAVAILABLE | validator errors |
| AGC-PUBLISH-POINTER | old and new LATEST | verify rename result | new pointer names report and SHA-256 | report absent: NOT_FOUND | `LATEST_REPORT_HASH_MISMATCH` |
| AGC-PUBLISH-ROLLBACK | injected failure | compare old pointer bytes | bytes unchanged | filesystem unavailable: UNAVAILABLE | `LATEST_PUBLISH_CONFLICT` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| temporary audit directory | `mkdtempSync` | valid contract, nested receipt, old LATEST | real publication boundary |
| complete generator inputs | direct JSON and files | frozen lock, state receipts, explicit receipt, sweep fields | removes placeholder path |
| immutable report name | fixture argument | unused date-stamped audit filename | `wx` no-overwrite proof |
| pointer | rendered Markdown | report basename, full SHA-256, verdict, ceiling | single publish object |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failure result | Other checks |
|---|---|---|---|---|---|
| AGC-C-401 | complete generator input | omit one sweep command | AGC-CONTRACT-COMPLETE | `PREPARE_ARGUMENT_INVALID` | true |
| AGC-C-402 | explicit receipt | change receipt bytes | AGC-CONTRACT-RECEIPT | `EVIDENCE_HASH_MISMATCH` | true |
| AGC-I-501 | valid publication | corrupt contract receipt hash | AGC-PUBLISH-REPORT | pre-check nonzero | true |
| AGC-I-502 | old LATEST | alter before-hash after report write | AGC-PUBLISH-ROLLBACK | `LATEST_PUBLISH_CONFLICT` | true |
| AGC-I-503 | unused report path | precreate report file | AGC-PUBLISH-REPORT | `REPORT_ALREADY_EXISTS` | true |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
bun test .agents/skills/plan-audit-archiver/scripts/__tests__/prepare-audit.test.ts
bun test .agents/skills/plan-audit-archiver/scripts/__tests__/finalize-audit.test.ts
bun run typecheck
git diff --check
git diff --name-only -- .agents/skills/plan-audit-archiver/scripts/prepare-audit.ts .agents/skills/plan-audit-archiver/scripts/finalize-audit.ts .agents/skills/plan-audit-archiver/scripts/__tests__/prepare-audit.test.ts .agents/skills/plan-audit-archiver/scripts/__tests__/finalize-audit.test.ts .agents/skills/plan-audit-archiver/templates/audit-contract-template.json
git diff --exit-code -- bun.lock
```

- Required output: AGC-C-401 through AGC-I-503 pass; old LATEST bytes remain exact on every failure branch.
- Expected evidence level: file integration; no runtime-smoke or live-LLM-E2E conclusion is allowed.
- On nonzero, missing, or `UNAVAILABLE` evidence: `BLOCKED`, preserve output, and do not advance.

## Rollback/failure convergence

1. Revert only edits in the five allowed files after preserving test output and any unreferenced report fixture.
2. Do not remove an orphan candidate to hide a failed publication, overwrite a report, or hand-edit a pointer after a conflict.

## Phase completion gate

- [ ] Freeze Gate artifacts are valid and PHASE-03 progression is accepted.
- [ ] AGC-C-401 through AGC-I-503 pass with exact results.
- [ ] Generated contract contains no placeholder or default verdict, and report publication uses one hash-bound pointer transition.
- [ ] Typecheck, diff check, and allowlist check pass.
- [ ] PHASE-05 remains `NOT_STARTED` until this gate is fully checked and accepted.
