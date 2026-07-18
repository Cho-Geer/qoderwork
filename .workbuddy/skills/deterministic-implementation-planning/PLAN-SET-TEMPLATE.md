# Deterministic Implementation Plan Set Template

Use this template when a single plan would exceed 20,000 Unicode characters,
450 lines, two executable Phases, or any Phase complexity limit. Split by
independently verifiable outcomes, never by arbitrary text position.

Create this exact shape:

```text
<plan-directory>/
├── 00-plan-index.md
├── 01-phase-<semantic-name>.md
├── ...
└── 99-final-verification.md
```

Hard limits:

| Document | Unicode characters | Lines | Additional limits |
|---|---:|---:|---|
| `00-plan-index.md` | 8,000 | 160 | one manifest row per Phase |
| each Phase file | 14,000 | 320 | 10 requirements, 8 files, 12 checks |
| `99-final-verification.md` | 8,000 | 160 | cross-Phase closure only |
| complete plan set | N/A | N/A | at most 8 Phases |

## Contents

1. `00-plan-index.md`
2. Manifest rules
3. Each `NN-phase-<semantic-name>.md`
4. `99-final-verification.md`

## `00-plan-index.md`

```markdown
# <Title> — Plan Index

**Plan mode**: `PLAN_SET`
**ID**: <stable-plan-id>
**Status**: `BLOCKED-BY-DECISION` | `READY-FOR-IMPLEMENTATION` | `IN-PROGRESS`
**Only implementation path**: <one sentence>
**Evidence ceiling**: <highest level actually executed; use NOT-RUN initially>

## 1. Input contract and source ledger

| Source | Version/status | Sections used | Authority | Current/historical |
|---|---|---|---|---|
| `<path>` | `<value>` | `<IDs>` | `<decision/requirement/evidence>` | `<current/historical>` |

### Atomic requirements

| ID | Condition | Required behavior | Observable result | Source | Owning Phase |
|---|---|---|---|---|---|
| REQ-001 | ... | ... | ... | `<path#section>` | PHASE-01 |

## 2. Decisions, scope, and non-goals

### Decision ledger

| ID | Question | Upstream decision | Current-code constraint | Final contract | Status |
|---|---|---|---|---|---|

### In scope

- `<exact item>`

### Non-goals

- `<exact prohibited expansion>`

### Open/blocking items

- `NONE` or `<owner + decision required>`

### Negative evidence semantics

- Use `FOUND / NOT_FOUND / UNAVAILABLE`, or `N/A — <exact reason>`.
- Missing, corrupt, unavailable, or unqueryable evidence: `<exact FAIL result>`.

### Current versus historical evidence

- Historical source proves: `<exact past claim>`, or `N/A — <exact reason>`.
- Current observation command proves: `<exact current claim>`.

## 3. Verified current baseline

| Claim | Status | Evidence/command | Result |
|---|---|---|---|
| `<fact>` | `VERIFIED/UNVERIFIED/CONFLICT` | `<command>` | `<exact output>` |

## 4. End-to-end traceability

| Requirement | Source | Phase | File/symbol | Check name | Evidence source | Happy fixture | Single mutation | Test ID | Level |
|---|---|---|---|---|---|---|---|---|---|

## 5. File change inventory

| # | Exact path | Change | Exact symbol/anchor | Reason | Phase |
|---|---|---|---|---|---|

### Globally forbidden changes

- `<exact file/API/schema/behavior>`

## 6. Phase manifest

| Order | Phase ID | File | Depends on | Status |
|---|---|---|---|---|
| 1 | PHASE-01 | `01-phase-<semantic-name>.md` | NONE | `READY/BLOCKED/DONE` |
| 2 | PHASE-02 | `02-phase-<semantic-name>.md` | PHASE-01 | `READY/BLOCKED/DONE` |
```

Manifest rules:

- Use contiguous order values starting at `1`.
- Use one unique Phase ID and one unique file per row.
- List dependencies as comma-separated earlier Phase IDs or `NONE`.
- Register every `NN-phase-*.md` file exactly once.
- Do not add a ninth Phase; create a new milestone plan set instead.

## Each `NN-phase-<semantic-name>.md`

````markdown
# Phase PHASE-01: <semantic outcome> `[ANALYSIS/VERIFICATION/OBSERVATION]`

**Phase ID**: `PHASE-01`
**Depends on**: NONE
**Outcome**: <one independently verifiable result>
**Evidence level**: <component/integration/runtime-smoke/live-E2E>

## Goal

- `<one independently verifiable outcome>`

## Starting state and dependency

- Required status: `<status>`
- Required evidence: `<artifact/command>`
- If absent: `BLOCKED`, do not continue

## Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-001 | ... | ... | ... |

## Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `<path>` | `<add/modify/delete>` | `<symbol/anchor>` |

## Forbidden files and behaviors

- `<exact path or behavior>`

## Fixed contract

- API/signature: `<exact signature>`
- Fields/states/check names: `<complete literal list>`
- Error/missing evidence behavior: `<exact result with failedChecks>`
- Negative states: `FOUND / NOT_FOUND / UNAVAILABLE`, or `N/A — <exact reason>`
- Current vs historical source: `<exact observation>`

## Implementation steps

```text
1. Open <file> and locate <exact symbol/anchor>.
2. Add/change <exact contract>.
3. Preserve <exact invariant>.
4. Do not modify <exact non-goal>.
```

## Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|

## All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|

## Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|

## Fixed verification

```bash
cd <absolute-repository-path>
<exact command>
```

- Required output/artifacts: `<exact list>`
- On non-zero/missing evidence: `BLOCKED`; preserve evidence; do not advance

## Rollback/failure convergence

1. `<exact controlled stop/revert/preservation action>`
2. `<prohibited destructive action>`

## Phase completion gate

- [ ] Allowed-file diff only
- [ ] Fixed contract implemented exactly
- [ ] Every local requirement has a check, fixture, mutation, and test
- [ ] Missing evidence fails closed with diagnostics
- [ ] Fixed verification produced the declared evidence level
- [ ] Downstream Phase remains blocked until all boxes are checked
````

The Phase document is the weak implementer's complete execution packet. Repeat
local constraints; never require it to merge another Phase or recall the index.

## `99-final-verification.md`

```markdown
# <Title> — Final Verification

## 7. Global verification and evidence

| Level | Command | Preconditions | Exact PASS condition | Artifacts | Current status |
|---|---|---|---|---|---|

### Evidence preservation

- `<run ID, manifest, DB, logs, report, retention path>`

### Evidence ceiling rule

- `<lower-level PASS cannot claim higher level>`

## 8. Risks, failure convergence, and rollback

| Risk | Trigger | Detection | Fixed convergence | Evidence retained |
|---|---|---|---|---|

## 9. Final completion gate

- [ ] Every index requirement is owned by exactly one Phase
- [ ] Every Phase completion gate is checked with evidence
- [ ] Phase execution followed manifest dependency order
- [ ] Required evidence levels were actually executed
- [ ] No lower-level result is reported as a higher-level PASS
- [ ] Documentation/log/status updates reflect current evidence

**Final status rule**: any unchecked item keeps the plan set incomplete and
blocks closure.
```
