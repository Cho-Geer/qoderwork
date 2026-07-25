# Phase PHASE-03: Evidence ceiling 与 verdict 边界 `[ANALYSIS→VERIFICATION]`

**Phase ID**: `PHASE-03`
**Depends on**: PHASE-02
**Outcome**: 低于 requirement 下限的 evidence 永远不能签署 `ACCEPT` 或 `REWORK`；降级声明仅描述 `BLOCKED` 或 `INVALID` 的限制，不能把 validator 失败写成通过。
**Evidence level**: component
**Progression status**: `NOT_STARTED`
**Completion receipt**: NONE

## Goal

- 完成 REQ-003：把已存在的 level 比较变成清晰的 verdict 合同，并删除模板和 skill 中“降级仍可接受”的歧义。

## Starting state and dependency

- Required status: PHASE-02 completion gate is fully checked and its signed ACCEPT audit plus progression receipt pass admission.
- Required evidence before write: human-approved `scope-lock-PHASE-03.json`, nonempty `pre-change-PHASE-03.json`, current HEAD identity, and bounded `rg -n "checkDowngradeDeclaration|EVIDENCE_CEILING_TOO_LOW|EVIDENCE_RECEIPT_LEVEL_TOO_LOW" .agents/skills/plan-audit-archiver` caller record.
- If any required item is absent, record `BLOCKED`, preserve the observed files, and do not edit code or documentation.

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-003-A | `ACCEPT` contract | every PASS requirement has receipts and ceiling at or above its required level | exact lower-level mutation rejects ACCEPT |
| REQ-003-B | `REWORK` contract | every PASS or FAIL requirement has receipts and ceiling at or above its required level | level-short contract rejects REWORK |
| REQ-003-C | `BLOCKED` or `INVALID` contract | downgrade declaration names reason, ceiling, unaffected and affected scope | valid limitation narrative remains non-accepting |
| REQ-003-D | `ACCEPT` or `REWORK` contract | `downgrade_declaration` is null | any non-null declaration emits stable policy error |
| REQ-003-E | report template and skill | never describe validator errors as expected ACCEPT | literal policy text matches validator |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `.agents/skills/plan-audit-archiver/scripts/validate-audit.ts` | modify | `checkDowngradeDeclaration`, verdict/ceiling branch, policy error constants |
| `.agents/skills/plan-audit-archiver/scripts/__tests__/validate-audit.test.ts` | modify | `AGC-CEILING` contract mutations |
| `.agents/skills/plan-audit-archiver/templates/audit-report-template.md` | modify | downgrade declaration and signing guidance |
| `.agents/skills/plan-audit-archiver/SKILL.md` | modify | evidence ceiling and verdict instructions |

## Forbidden files and behaviors

- Do not lower `required_evidence_level`, alter receipt payloads, edit a historical report, change `LATEST.md`, or modify `pre-check-evidence.ts`.
- Do not permit `ACCEPT` or `REWORK` because a downgrade declaration is present. Do not translate a nonzero validator run into any accepted state.
- `FOUND`, `NOT_FOUND`, and `UNAVAILABLE` retain their evidence meanings. `UNAVAILABLE` forces `BLOCKED` or `INVALID`; it never supports `ACCEPT` or `REWORK`.

## Fixed contract

- Evidence rank order remains the current validator order. A receipt below `requirements[].required_evidence_level` emits `EVIDENCE_RECEIPT_LEVEL_TOO_LOW`; a contract ceiling below a PASS or FAIL requirement emits `EVIDENCE_CEILING_TOO_LOW`.
- `ACCEPT` requires `downgrade_declaration=null`. A non-null declaration emits `DOWNGRADE_WITH_ACCEPT_FORBIDDEN`, even if all receipts meet the level.
- `REWORK` requires `downgrade_declaration=null`. A non-null declaration emits `DOWNGRADE_WITH_REWORK_FORBIDDEN`; every PASS or FAIL requirement still needs evidence at its required level.
- `BLOCKED` and `INVALID` may include a declaration only when it has exactly four nonempty fields: `reason`, `ceiling`, `unaffected_scope`, and `affected_scope`. Its `ceiling` must equal `evidence_ceiling`.
- Template and skill wording state that a declaration records an evidence limitation and cannot change verdict validity. They must not contain `expected downgrade errors` or wording that pairs a lower standard with `ACCEPT`.
- Tests import `validateAuditSource` and assert `failedChecks` or exact validator codes; they do not use a mocked success result.

## Implementation steps

```text
1. Verify Phase-03 Freeze Gate artifacts and record source hashes.
2. Read current evidence-level rank and verdict branches without changing the rank order.
3. Add explicit ACCEPT and REWORK declaration-forbidden checks beside current ceiling checks.
4. Restrict declaration validity to BLOCKED and INVALID, including four required fields and ceiling equality.
5. Update template and skill text to state the same non-promotion policy.
6. Add all-pass contracts for ACCEPT, REWORK, BLOCKED, and INVALID.
7. Add isolated lower-receipt, lower-ceiling, ACCEPT-declaration, REWORK-declaration, and incomplete-BLOCKED-declaration mutations.
8. Run fixed verification. Any changed evidence payload, altered rank order, or nonzero result is BLOCKED.
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| AGC-CEILING-ACCEPT | contract source | validate exact-level ACCEPT | contract is valid | receipt unavailable: UNAVAILABLE | `errors=[]` |
| AGC-CEILING-REWORK | contract source | validate exact-level REWORK | contract is valid | receipt absent: NOT_FOUND | `errors=[]` |
| AGC-CEILING-LOW | lower-level mutation | validate ACCEPT | only level contract rejects | parser unavailable: UNAVAILABLE | `EVIDENCE_RECEIPT_LEVEL_TOO_LOW` |
| AGC-CEILING-DECL | declaration mutation | validate ACCEPT and REWORK | both reject declaration | source unreadable: UNAVAILABLE | policy error code |
| AGC-CEILING-BLOCKED | blocked contract | validate four-field declaration | limitation remains valid | field absent: NOT_FOUND | `DOWNGRADE_DECLARATION_REQUIRED` |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| base audit contract | existing test builder | frozen scope, matching receipts, PASS requirement | validator real path |
| accept contract | cloned base | integration required/receipt/ceiling and null declaration | non-promotion baseline |
| rework contract | cloned base with evidence | FAIL requirement, frozen rework package, null declaration | known defect baseline |
| blocked contract | cloned base | blocker reason and four-field declaration | limitation disclosure boundary |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failure result | Other checks |
|---|---|---|---|---|---|
| AGC-C-301 | accept contract | receipt `integration` to `component` | AGC-CEILING-LOW | `EVIDENCE_RECEIPT_LEVEL_TOO_LOW` | true |
| AGC-C-302 | accept contract | ceiling `integration` to `component` | AGC-CEILING-LOW | `EVIDENCE_CEILING_TOO_LOW` | true |
| AGC-C-303 | accept contract | add valid declaration | AGC-CEILING-DECL | `DOWNGRADE_WITH_ACCEPT_FORBIDDEN` | true |
| AGC-C-304 | rework contract | add valid declaration | AGC-CEILING-DECL | `DOWNGRADE_WITH_REWORK_FORBIDDEN` | true |
| AGC-C-305 | blocked contract | remove affected scope | AGC-CEILING-BLOCKED | `DOWNGRADE_DECLARATION_REQUIRED` | true |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
bun test .agents/skills/plan-audit-archiver/scripts/__tests__/validate-audit.test.ts
bun run typecheck
git diff --check
git diff --name-only -- .agents/skills/plan-audit-archiver/scripts/validate-audit.ts .agents/skills/plan-audit-archiver/scripts/__tests__/validate-audit.test.ts .agents/skills/plan-audit-archiver/templates/audit-report-template.md .agents/skills/plan-audit-archiver/SKILL.md
git diff --exit-code -- bun.lock
```

- Required output: AGC-C-301 through AGC-C-305 pass with exact stable codes.
- Expected evidence level: component; no external repository or live session is exercised.
- On nonzero, missing, or `UNAVAILABLE` evidence: `BLOCKED`, preserve output, and do not advance.

## Rollback/failure convergence

1. Revert only edits in the four allowed files after preserving test output and validator diagnostics.
2. Do not weaken requirement level, backfill a report, or change a verdict solely to make a lower-level receipt pass.

## Phase completion gate

- [ ] Freeze Gate artifacts are valid and PHASE-02 progression is accepted.
- [ ] AGC-C-301 through AGC-C-305 pass with exact diagnostics.
- [ ] Lower-level evidence cannot sign ACCEPT or REWORK, and a valid BLOCKED limitation remains explicit.
- [ ] Typecheck, diff check, and allowlist check pass.
- [ ] PHASE-04 remains `NOT_STARTED` until this gate is fully checked and accepted.
