# Phase PHASE-05: drift lint script + component tests [VERIFICATION]

**Phase ID**: `PHASE-05`
**Depends on**: `PHASE-04`
**Progression status**: `NOT_STARTED`
**Outcome**: `scripts/check-blueprint-status.ts` validates the 9 drift checks with an all-pass fixture (zero drift) and single-failure mutations (each mutation fails exactly one check); `tsc --noEmit` passes; `bun test` passes; `bun.lock` unchanged.
**Evidence level**: `component`

## Goal

- Implement M8 (BP §2.2.8): the 9 drift checks as a read-only component-level lint.

## Starting state and dependency

PHASE-04 ACCEPTED (spec synced). The lint reads the now-standardized headers + INDEX; it does not mutate them.

## Local requirements

| Requirement | Contract |
|---|---|
| REQ-005 | all-pass zero drift + each single-failure mutation fails exactly its check; tsc + bun test pass; no new npm dep |

## Allowed files

| Exact path | Change | Anchor |
|---|---|---|
| `scripts/check-blueprint-status.ts` | new | lint entry |
| `scripts/__tests__/check-blueprint-status.test.ts` | new | component tests |

## Forbidden files and behaviors

No edit to `blueprints/` content (lint is read-only). No edit to work-one, `bun.lock`, frozen provenance records. No new npm dependency. No mutation of business state. M9 (stagnation/wake scan wiring) is OUT of scope — CONTINUATION-001.

## Fixed contract

The 9 checks (BP §2.2.8): (1) four-field existence; (2) status ∈ seven values; (3) `已暂停 ⇒ 暂停于非空`; (4) edge target file exists; (5) pause chain acyclic; (6) 更新日期 vs `git log -1` (exempt files skipped); (7) INDEX reverse view matches single-side edges; (8) INDEX three sections vs actual directory file set; (9) archived files not newly referenced by active plans//audits/. The lint is pure read + report; exit 0 = zero drift, nonzero = drift list. Single-failure mutations: for each check C, remove/violate exactly C's precondition and assert the lint fails on C only.

## Implementation steps

Exact module shape (exports, return type `{ ok: boolean, failedChecks: string[] }`), the 9 check function names, the all-pass fixture path, and the mutation table are frozen in the PHASE-05 scope lock. Intent only here; no write before scope lock + pre-change capture.

## Check Registry

| Check name | PASS |
|---|---|
| all_pass_zero_drift | lint reports zero drift on the all-pass fixture |
| single_failure_per_check | each of 9 mutations fails exactly its check, others pass |
| tsc_noemit_pass | `bun run typecheck` exit 0 |
| bun_test_pass | `bun test scripts/__tests__/check-blueprint-status.test.ts` exit 0 |
| no_new_dependency | `git diff --quiet bun.lock` (unchanged) |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
# exact commands frozen in the PHASE-05 scope lock; must include:
#   bun run scripts/check-blueprint-status.ts   (all-pass, exit 0)
#   bun run scripts/check-blueprint-status.ts <mutation>   (per mutation, exit nonzero, fails exactly one)
#   bun run typecheck
#   bun test scripts/__tests__/check-blueprint-status.test.ts
#   git diff --quiet bun.lock
```

## Rollback/failure convergence

Any undetected drift, multi-check failure on a single mutation, tsc/bun test failure, or bun.lock change converges to BLOCKED: delete the lint file (pure addition, trivial rollback), preserve the pre-change capture. No publication or plan admission.

## Phase completion gate

- [ ] PHASE-05 scope lock approved by HUMAN_USER and pre-change capture created (P-02).
- [ ] Five fixed checks passed at component level with retained receipts (P-03).
- [ ] Lint validates 9 checks with all-pass + single-failure mutations; toolchain clean; no new dependency.
