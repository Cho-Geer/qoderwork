# Phase PHASE-01: 计划 completion gate 语义 `[ANALYSIS→VERIFICATION]`

**Phase ID**: `PHASE-01`
**Depends on**: NONE
**Outcome**: `validate-plan.ts` 只按 phase completion gate 和 progression status 判断完成状态，已接受 phase 不再需要无关未勾选框。
**Evidence level**: component
**Progression status**: `ACCEPTED`
**Completion receipt**: `../../audits/audit-governance-evidence-and-status-closure/evidence/PHASE-01-R2-ACCEPT-01/progression-PHASE-01.json`

## Goal

- 完成 REQ-001：修复 whole-document checkbox 规则，同时保留非接受状态不得勾选、接受状态必须全勾选和 receipt 必须存在的 fail-closed 约束。

## Starting state and dependency

- Required status: no predecessor; plan manifest lists PHASE-01 as `NOT_STARTED`.
- Required evidence before write: human-approved `scope-lock-PHASE-01.json`, nonempty `pre-change-PHASE-01.json`, current HEAD identity, and bounded `rg -n "checkEvidenceContracts|Phase completion gate" .agents/skills/deterministic-implementation-planning/scripts` caller record.
- If any required item is absent, record `BLOCKED`, preserve the observed files, and do not edit code or documentation.

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-001-A | non-accepted phase | gate has at least one checkbox and each is `[ ]` | `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `INVALID` accept only all-unchecked gate |
| REQ-001-B | accepted phase | gate has at least one checkbox and each is `[x]` | partial or empty gate emits `PHASE_COMPLETION_GATE_MISMATCH` |
| REQ-001-C | accepted phase | completion receipt is nonempty and not `NONE` | missing receipt emits `PHASE_RECEIPT_MISSING` |
| REQ-001-D | unrelated text | unchecked Markdown outside the gate has no effect | accepted fixture passes without unrelated `[ ]` |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `.agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts` | modify | `checkEvidenceContracts`, PLAN_SET progression gate branch |
| `.agents/skills/deterministic-implementation-planning/scripts/validate-plan.test.ts` | modify | `AGC-GATE` fixture and mutation suites |

## Forbidden files and behaviors

- Do not modify `phase-progression.ts`, any plan under `plans/task-lens-m1`, `bun.lock`, work-one, or an audit artifact.
- Do not relax the accepted receipt rule, infer a status from prose, count a checkbox outside `## Phase completion gate`, or add a hidden unchecked checkbox to satisfy validation.
- `FOUND`, `NOT_FOUND`, and `UNAVAILABLE` are the only observation states for fixture paths; only `FOUND` is positive.

## Fixed contract

- Add a single helper that extracts checkbox tokens only from the `## Phase completion gate` section. It returns gate token count and checked count; it does not inspect unrelated Markdown.
- `checkEvidenceContracts` must stop requiring `source.includes("- [ ]")` for PLAN_SET phase files. `99-final-verification.md` retains its own unfinished checklist requirement.
- For every progression-enabled phase: zero gate boxes is `PHASE_COMPLETION_GATE_MISMATCH`; non-accepted with a checked box is `PHASE_COMPLETION_GATE_MISMATCH`; accepted with any unchecked box is `PHASE_COMPLETION_GATE_MISMATCH`.
- Test diagnostics expose `failedChecks` or the literal `Exact failure result`; a test must assert the exact diagnostic code, not merely nonzero exit.
- Tests create a temporary PLAN_SET with an index, phase file, and final file. The accepted fixture supplies a real nonempty completion receipt path string but does not claim audit execution.

## Implementation steps

```text
1. Verify the Phase Freeze Gate artifacts and record the current source hashes.
2. Read the current gate parser and progression-status branch; do not change status derivation.
3. Add a narrow helper for the exact gate section and replace the whole-document unchecked-box predicate.
4. Preserve existing manifest/phase status equality, accepted receipt, dependency, budget, and diagnostic behavior.
5. Add an all-pass fixture containing one NOT_STARTED phase with only unchecked gate boxes and one ACCEPTED phase with only checked gate boxes.
6. Add four isolated mutations: check a not-started gate, uncheck an accepted gate, remove an accepted receipt, and remove every gate box.
7. Run the fixed verification commands. Any extra diagnostic, changed outside file, or typecheck delta is BLOCKED.
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| AGC-GATE-READY | temporary plan | validate NOT_STARTED phase | gate all unchecked | fixture unavailable: UNAVAILABLE | `errors=[]` |
| AGC-GATE-ACCEPT | temporary plan | validate ACCEPTED phase | all checked plus receipt | receipt absent: NOT_FOUND | `errors=[]` |
| AGC-GATE-PARTIAL | one gate mutation | validate | only target phase rejected | parser unavailable: UNAVAILABLE | `PHASE_COMPLETION_GATE_MISMATCH` |
| AGC-GATE-EMPTY | zero gate mutation | validate | only target phase rejected | section missing: NOT_FOUND | `PHASE_COMPLETION_GATE_MISMATCH` |
| AGC-TSC | workspace source | `bun run typecheck` | no new diagnostic | compiler unavailable: UNAVAILABLE | command nonzero |

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| temporary PLAN_SET | `mkdtempSync` plus direct files | two manifest rows, progression schema, final checklist | parses real CLI input |
| ready phase | fixture Markdown | `NOT_STARTED` and two `[ ]` gate boxes | proves no unrelated box dependency |
| accepted phase | fixture Markdown | `ACCEPTED`, two `[x]` gate boxes, receipt path | proves accepted contract |

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failure result | Other checks |
|---|---|---|---|---|---|
| AGC-C-101 | ready gate | change one `[ ]` to `[x]` | AGC-GATE-READY | `PHASE_COMPLETION_GATE_MISMATCH` | true |
| AGC-C-102 | accepted gate | change one `[x]` to `[ ]` | AGC-GATE-ACCEPT | `PHASE_COMPLETION_GATE_MISMATCH` | true |
| AGC-C-103 | accepted receipt | set receipt to `NONE` | AGC-GATE-ACCEPT | `PHASE_RECEIPT_MISSING` | true |
| AGC-C-104 | ready gate | remove both gate lines | AGC-GATE-EMPTY | `PHASE_COMPLETION_GATE_MISMATCH` | true |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
bun test ./.agents/skills/deterministic-implementation-planning/scripts/validate-plan.test.ts
bun run typecheck
git diff --check
git diff --name-only -- .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts .agents/skills/deterministic-implementation-planning/scripts/validate-plan.test.ts
git diff --exit-code -- bun.lock
```

- Required output: AGC-C-101 through AGC-C-104 pass and typecheck has no new diagnostic.
- Expected evidence level: component; this phase does not prove audit publication or runtime behavior.
- On nonzero, missing, or `UNAVAILABLE` evidence: `BLOCKED`, preserve output, and do not advance.

## Rollback/failure convergence

1. Revert only edits in the two allowed files after recording test output and source hashes.
2. Do not edit phase fixtures outside the test temporary directory, change historical plan files, or mask a diagnostic with unrelated Markdown.

## Phase completion gate

- [x] Freeze Gate artifacts are valid and HEAD is unchanged.
- [x] AGC-C-101 through AGC-C-104 pass with exact diagnostics.
- [x] A valid accepted phase passes without an unrelated unchecked checkbox.
- [x] Typecheck, diff check, and allowlist check pass.
- [x] PHASE-02 remains `NOT_STARTED` until this gate is fully checked and accepted.
