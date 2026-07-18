# Deterministic Implementation Plan Template

Use this template only when the complete plan is at most 20,000 Unicode
characters, 450 lines, and two executable Phases. Otherwise use
[PLAN-SET-TEMPLATE.md](PLAN-SET-TEMPLATE.md). Do not delete required sections.
Use `N/A — <exact reason>` only when a section genuinely does not apply.

## Contents

The copied plan keeps sections 1–9 in order: input contract, decisions,
baseline, traceability, inventory, Phase implementation, global verification,
risks/rollback, and final completion gate.

````markdown
# <Title>

**Plan mode**: `SINGLE_FILE`
**ID**: <stable-plan-id>
**Status**: `BLOCKED-BY-DECISION` | `READY-FOR-IMPLEMENTATION` | `IN-PROGRESS`
**Only implementation path**: <one sentence>
**Evidence ceiling**: <highest level actually executed; use NOT-RUN initially>

## 1. Input contract and source ledger

| Source | Version/status | Sections used | Authority | Current/historical |
|---|---|---|---|---|
| `<path>` | `<value>` | `<IDs>` | `<decision/requirement/evidence>` | `<current/historical>` |

### Atomic requirements

| ID | Condition | Required behavior | Observable result | Source |
|---|---|---|---|---|
| REQ-001 | ... | ... | ... | `<path#section>` |

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
- A negative PASS requires: `<evidence readable>` AND `<query succeeded>` AND
  `<target NOT_FOUND>`.
- Missing, corrupt, unavailable, or unqueryable evidence: `<exact FAIL result>`.

### Current versus historical evidence

- Historical source proves: `<exact past claim>`, or `N/A — <exact reason>`.
- Current observation command proves: `<exact current claim>`.
- A historical snapshot is forbidden for: `<exact current/post-transition claim>`.

## 3. Verified current baseline

| Claim | Status | Evidence/command | Result |
|---|---|---|---|
| `<fact>` | `VERIFIED/UNVERIFIED/CONFLICT` | `<command>` | `<exact output>` |

## 4. End-to-end traceability

| Requirement | Source | File/symbol | Check name | Evidence source | Happy fixture | Single mutation | Test ID | Level |
|---|---|---|---|---|---|---|---|---|

## 5. File change inventory

| # | Exact path | Change | Exact symbol/anchor | Reason | Phase |
|---|---|---|---|---|---|

### Globally forbidden changes

- `<exact file/API/schema/behavior>`

## 6. Phase-by-phase implementation

### Phase 0: <name> `[ANALYSIS/VERIFICATION/OBSERVATION]`

#### Goal

- `<one independently verifiable outcome>`

#### Starting state and dependency

- Required status: `<status>`
- Required evidence: `<artifact/command>`
- If absent: `BLOCKED`, do not continue

#### Local requirements

| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-001 | ... | ... | ... |

#### Allowed files

| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| `<path>` | `<add/modify/delete>` | `<symbol/anchor>` |

#### Forbidden files and behaviors

- `<exact path or behavior>`

#### Fixed contract

- API/signature: `<exact signature>`
- Fields/states/check names: `<complete literal list>`
- Error/missing evidence behavior: `<exact result>`
- Current vs historical source: `<exact observation>`

#### Implementation steps

```text
1. Open <file> and locate <exact symbol/anchor>.
2. Add/change <exact contract>.
3. Preserve <exact invariant>.
4. Do not modify <exact non-goal>.
```

#### Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|

#### All-pass Fixture

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|

#### Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | Other checks |
|---|---|---|---|---|---|

#### Fixed verification

```bash
cd <absolute-repository-path>
<exact command>
```

- Expected evidence level: `<component/integration/runtime-smoke/live-E2E>`
- Required output/artifacts: `<exact list>`
- On non-zero/missing evidence: `BLOCKED`; preserve evidence; do not advance

#### Rollback/failure convergence

1. `<exact controlled stop/revert/preservation action>`
2. `<prohibited destructive action>`

#### Phase completion gate

- [ ] Allowed-file diff only
- [ ] Fixed contract implemented exactly
- [ ] Every check has a complete all-pass fixture
- [ ] Every check has an exact single-failure test
- [ ] Missing evidence fails closed with diagnostics
- [ ] Fixed verification produced the declared evidence level
- [ ] Regression command passed or existing debt was accurately isolated
- [ ] Downstream Phase remains blocked until all boxes are checked

<!-- Repeat the complete Phase block. Do not replace it with “same as above”. -->
<!-- SINGLE_FILE permits at most two complete Phase blocks. -->

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

- [ ] Every atomic requirement has a complete traceability row
- [ ] Every Phase completion gate is fully checked with evidence
- [ ] All source conflicts and decisions are closed
- [ ] Required component/integration/runtime levels were actually executed
- [ ] No lower-level result is reported as a higher-level PASS
- [ ] Documentation/log/status updates reflect current evidence

**Final status rule**: any unchecked item keeps the plan incomplete and blocks
closure.
````
