# Phase PHASE-01: surface and conformance infrastructure [VERIFICATION]

**Phase ID**: `PHASE-01`
**Depends on**: NONE
**Progression status**: `NOT_STARTED`
**Outcome**: hash-bound governance surface manifest with findings-first scanner, and an independent shared conformance corpus with mismatch probes
**Evidence level**: `file-integration`

## Goal

- Establish the active governance surface manifest and a complete-finding-set scanner (REQ-006).
- Establish the independent conformance corpus and consumer-agreement runner with intentional mismatch probes (REQ-007).

## Starting state and dependency

The shared v3 parser and v3 PLAN_SET admission exist and are posthoc-validated by the genesis bootstrap closure. No prior phase ACCEPT is required.

## Local requirements

| Requirement | Contract |
|---|---|
| REQ-006 | active governance surface is manifest-bound and findings-first |
| REQ-007 | every consumer conforms to one independent v3 contract corpus |

## Allowed files

| Exact path | Change | Anchor |
|---|---|---|
| frozen in PHASE-01 scope lock | add | surface manifest/validator |
| frozen in PHASE-01 scope lock | add | conformance corpus/runner |

## Forbidden files and behaviors

No pre-v3 input, compatibility entry, generic bypass, phase ACCEPT, report, or LATEST pointer. No consumer-local schema parsing. Quarantined paths are classified by path only and never opened.

## Fixed contract

Surface scanner exits nonzero after reporting the complete finding set on mismatch; conformance runner records matching normalized outputs and failing intentional mismatch probes. FOUND / NOT_FOUND / UNAVAILABLE are reserved for receipt lookup semantics.

## Implementation steps

Frozen in the PHASE-01 v3 phase scope lock; this phase declares intent only and authorizes no code write.

## Check Registry

| Check name | PASS |
|---|---|
| surface_manifest_complete_findings | scanner reports every discovered mismatch and completes |
| conformance_consumer_agreement | all consumers agree and mismatch probes fail the gate |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-v3
# exact commands frozen in the PHASE-01 scope lock
```

## Rollback/failure convergence

Any blocking finding, consumer disagreement, or hash drift converges to BLOCKED; preserve evidence.

## Phase completion gate

- [ ] PHASE-01 scope lock approved by HUMAN_USER and pre-change capture created.
- [ ] Fixed checks passed at file-integration level with retained receipts.
