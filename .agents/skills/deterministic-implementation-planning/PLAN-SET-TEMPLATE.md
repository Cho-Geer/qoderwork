# v3 PLAN_SET Template

Use this template only for an active audit-governance v3 PLAN_SET. Every path is
relative to the PLAN_SET directory and every referenced artifact is explicit.

## `00-plan-index.md`

```markdown
# <title> — v3 PLAN_SET

**Plan mode**: `PLAN_SET`
**Schema version**: `audit-plan-set/v3`
**Document kind**: `plan-set-index`
**Status**: `NOT_STARTED`
**Progression schema**: `phase-progression/v1`
**Provenance level**: `v3-required`
**Canonical contract**: `<canonical-contract.yaml>`
**Canonical contract SHA-256**: `<64 lowercase hex>`
**Approval decision**: `<approval-decision.json>`
**Approval decision SHA-256**: `<64 lowercase hex>`

## 1. Input contract and source ledger

| Source | Exact path | SHA-256 | Authority |
|---|---|---|---|
| Canonical | `<canonical-contract.yaml>` | `<64 lowercase hex>` | semantic source |
| Approval | `<approval-decision.json>` | `<64 lowercase hex>` | HUMAN_USER binding |

## 2. Decisions, scope, and non-goals

- In scope: `<exact behavior>`
- Non-goal: `<exact prohibited behavior>`

## 3. Verified current baseline

| Claim | Command | Result |
|---|---|---|
| `<fact>` | `cd <absolute-worktree> && <command>` | `FOUND/NOT_FOUND/UNAVAILABLE` |

## 4. End-to-end traceability

| REQ | DC | Fixture | Oracle | Owning phase | Evidence level |
|---|---|---|---|---|---|
| REQ-001 | DC-001 | FX-001 | ORACLE-001 | PHASE-01 | component |

## 5. File change inventory

| Exact path | Change | Phase |
|---|---|---|
| `<path>` | modify | PHASE-01 |

## 6. Phase manifest

| Order | Phase ID | File | Depends on | Status |
|---|---|---|---|---|
| 1 | PHASE-01 | `01-phase-<name>.md` | NONE | NOT_STARTED |
```

## `NN-phase-<name>.md`

```markdown
# Phase PHASE-01: <outcome> [VERIFICATION]

**Phase ID**: `PHASE-01`
**Depends on**: NONE
**Outcome**: `<observable result>`
**Evidence level**: `component`
**Progression status**: `NOT_STARTED` | `IN_PROGRESS` | `ACCEPTED` | `BLOCKED` | `INVALID`
**Completion receipt**: `<relative receipt path>` (required when status is `ACCEPTED`)

## Goal

- `<one result>`

## Allowed files

| Exact path | Change | Anchor |
|---|---|---|
| `<path>` | modify | `<symbol>` |

## Fixed verification

```bash
cd <absolute-worktree>
<exact command>
```

## Phase completion gate

- [ ] Fixed checks passed at the declared evidence level.
- [ ] Required receipts and hash bindings are retained.
```

## `99-final-verification.md`

```markdown
# <title> — Final Verification

## 7. Global verification and evidence

| Command | PASS condition | Evidence level |
|---|---|---|
| `cd <absolute-worktree> && <command>` | exit 0 | component |

## 8. Risks, failure convergence, and rollback

| Trigger | Convergence |
|---|---|
| hash drift or nonzero validator | BLOCKED; preserve evidence |

## 9. Final completion gate

- [ ] Every phase has approved scope and evidence.
- [ ] No forbidden publication occurred.
```
