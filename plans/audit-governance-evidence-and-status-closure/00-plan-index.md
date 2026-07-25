# 审计证据、状态与报告闭环 — Plan Index

**Plan mode**: `PLAN_SET`
**ID**: `AUDIT-GOVERNANCE-CLOSURE-PLANSET-20260725`
**Status**: `READY-FOR-IMPLEMENTATION`
**Progression schema**: `phase-progression/v1`
**Provenance level**: `v2.1-required`
**Only implementation path**: PHASE-01 至 PHASE-05 严格顺序执行；每张卡的 Freeze Gate 失败即停止。
**Evidence ceiling**: `integration`

## 1. Input contract and source ledger

| Source | Use |
|---|---|
| `blueprints/blueprint-audit-governance-evidence-and-status-closure.md` | current requirements, §1-§8 |
| `blueprints/blueprint-phase-progression-audit-gate.md` | current progression constraint, §2.4/§3.1/§3.3 |
| `validate-plan.ts`; `pre-check-evidence.ts`; `validate-audit.ts`; `prepare-audit.ts` | current implementation baseline |
| 用户决议 2026-07-25 | blueprint then weak-model plan |

### Atomic requirements

| ID | Condition | Required behavior | Observable result | Source | Owning Phase |
|---|---|---|---|---|---|
| REQ-001 | plan status | gate is status-local and nonempty | no unrelated unchecked box | BP §4.5 | PHASE-01 |
| REQ-002 | pre-check | contract list is the sole pass input | nested/missing/outside result | BP §4.2 | PHASE-02 |
| REQ-003 | level mismatch | lower receipt never signs ACCEPT | exact rejection | BP §4.3 | PHASE-03 |
| REQ-004 | authoring | contract has machine facts | no `REPLACE_*` or default verdict | BP §4.1/4.4 | PHASE-04 |
| REQ-005 | publication | report/LATEST use one contract | failure publishes no new pointer | BP §4.4 | PHASE-04 |
| REQ-006 | closure | policy and fixture agree | component plus integration proof | BP §5/§6 | PHASE-05 |

## 2. Decisions, scope, and non-goals

### Decision ledger

| ID | Question | Final contract | Status |
|---|---|---|---|
| DEC-001 | receipt authority | contract list; directory scan is diagnostic only | CLOSED |
| DEC-002 | ceiling mismatch | lower evidence never signs ACCEPT | CLOSED |
| DEC-003 | report/status authority | contract truth; report/LATEST projections | CLOSED |
| DEC-004 | plan checkbox rule | inspect only Phase completion gate by progression status | CLOSED |
| DEC-005 | existing progression gate | preserve P-02A semantics and consume validated audit output | CLOSED |

### In scope

- plan validator/test; audit parser, pre-check, renderer, templates, tests, and skills; `AGENTS.md` publication rule.

### Non-goals

- work-one code, serve process, DB schema, external network, npm dependencies, historical audit repair, or evidence deletion.
- completion of any existing Task Lens/P0-2 phase, manual verdict changes, `--force`, or status-only bypass.

### Open/blocking items

- Each Phase needs human approval, nonempty pre-change receipt, and HEAD identity before writes.
- CodeGraph indexes the main worktree; record bounded `rg` caller evidence before shared-function edits.

### Negative evidence semantics

- `FOUND` means a requested object exists and matches its contract.
- `NOT_FOUND` means the requested object was successfully located but does not exist.
- `UNAVAILABLE` means a read, parser, or permission condition prevents determination.
- Only `FOUND` counts as a positive evidence observation.

### Current versus historical evidence

- Historical audits demonstrate fixture shape only. Every implementation claim requires current HEAD-bound tests and receipts.

## 3. Verified current baseline

| Claim | Status | Evidence/command | Result |
|---|---|---|---|
| whole-document checkbox rule | VERIFIED | `validate-plan.ts` | conflicts with accepted gate |
| shallow pre-check | VERIFIED | `pre-check-evidence.ts` | direct `readdirSync(evidenceDir)` |
| PHASE-05 false pass | VERIFIED | pre-check plus nested listing | no EV reported despite receipts |
| CodeGraph index mismatch | VERIFIED | `codegraph status` | bounded source search |
| user edits exist | VERIFIED | `git status --short` | preserve them |

## 4. End-to-end traceability

| Requirement | Source | File/symbol | Check name | Evidence source | Happy fixture | Single mutation | Test ID | Level |
|---|---|---|---|---|---|---|---|---|
| REQ-001 | BP §4.5 | `validate-plan.ts` gate parser | AGC-GATE | direct unit test | two-phase PLAN_SET | one gate toggle | AGC-C-101 | component |
| REQ-002 | BP §4.2 | `pre-check-evidence.ts` | AGC-RECEIPT | temp audit dir | nested receipt list | remove one receipt | AGC-C-201 | component |
| REQ-003 | BP §4.3 | `validate-audit.ts` ceiling rule | AGC-CEILING | validator test | integration receipt | lower level only | AGC-C-301 | component |
| REQ-004 | BP §4.1 | `prepare-audit.ts` contract creator | AGC-CONTRACT | direct unit test | complete input | `REPLACE_COMMAND` | AGC-C-401 | component |
| REQ-005 | BP §4.4 | `finalize-audit.ts` | AGC-PUBLISH | temp audit dir | valid contract | corrupt receipt hash | AGC-I-501 | integration |
| REQ-006 | BP §5/§6 | skill/AGENTS/tests | AGC-CLOSURE | fixed suite | full fixture | manual LATEST write | AGC-I-601 | integration |

## 5. File change inventory

| Phase | Exact paths | Change |
|---|---|---|
| 01 | `.agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts`; `.agents/skills/deterministic-implementation-planning/scripts/validate-plan.test.ts` | status-local gate rule and regression suite |
| 02 | `.agents/skills/plan-audit-archiver/scripts/pre-check-evidence.ts`; `.agents/skills/plan-audit-archiver/scripts/__tests__/pre-check-evidence.test.ts` | canonical receipt-list pre-check |
| 03 | `.agents/skills/plan-audit-archiver/scripts/validate-audit.ts`; `.agents/skills/plan-audit-archiver/scripts/__tests__/validate-audit.test.ts`; `.agents/skills/plan-audit-archiver/templates/audit-report-template.md`; `.agents/skills/plan-audit-archiver/SKILL.md` | strict ceiling/verdict contract |
| 04 | `.agents/skills/plan-audit-archiver/scripts/prepare-audit.ts`; `.agents/skills/plan-audit-archiver/scripts/finalize-audit.ts`; `.agents/skills/plan-audit-archiver/scripts/__tests__/prepare-audit.test.ts`; `.agents/skills/plan-audit-archiver/scripts/__tests__/finalize-audit.test.ts`; `.agents/skills/plan-audit-archiver/templates/audit-contract-template.json` | canonical input and atomic publication |
| 05 | `AGENTS.md`; `.agents/skills/plan-audit-archiver/SKILL.md`; `.agents/skills/deterministic-implementation-planning/SKILL.md`; `.agents/skills/plan-audit-archiver/scripts/__tests__/audit-governance-integration.test.ts`; `logs/2026-07-25-audit-governance-closure.md`; `logs/INDEX.md` | governance contract, cross-script proof, and task log |

### Globally forbidden changes

- `bun.lock`、work-one、`audits/task-lens-m1/**`、existing historical reports, `LATEST.md` under existing audit directories, database files, and `.codegraph/**`.
- Any manual `LATEST.md` edit, receipt discovery by shallow directory scan, verdict defaulting, evidence level promotion, `--force`, or code outside the active Phase allowlist.

## 6. Phase manifest

| Order | Phase ID | File | Depends on | Status |
|---:|---|---|---|---|
| 1 | PHASE-01 | `01-phase-plan-gate-semantics.md` | NONE | NOT_STARTED |
| 2 | PHASE-02 | `02-phase-contract-receipt-precheck.md` | PHASE-01 | NOT_STARTED |
| 3 | PHASE-03 | `03-phase-evidence-ceiling-verdict.md` | PHASE-02 | NOT_STARTED |
| 4 | PHASE-04 | `04-phase-canonical-publication.md` | PHASE-03 | NOT_STARTED |
| 5 | PHASE-05 | `05-phase-governance-integration-closure.md` | PHASE-04 | NOT_STARTED |
