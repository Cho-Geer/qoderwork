# PHASE-03: Receipt, Projection, and Boundary Precheck v3

**Phase ID**: `PHASE-03`
**Progression status**: `NOT_STARTED`
**Depends on**: `PHASE-01`
**Provenance level**: `v3-required`

## Phase completion gate

- [ ] generate-phase-projection.ts produces audit-phase-projection/v3::phase-projection via shared parser
- [ ] audit-boundary-precheck.ts consumes projection with explicit receipt paths (no directory enumeration)
- [ ] audit-boundary-precheck.ts outputs only READY_FOR_LLM_REVIEW or BLOCKED (never a verdict)
- [ ] generate-evidence-receipt.ts produces audit-evidence-receipt/v3::evidence-receipt with dual observation
- [ ] capture-state.ts discriminates as audit-evidence-receipt/v3::evidence-receipt via shared parser
- [ ] evidence-receipt-template.json upgraded to v3
- [ ] Surface manifest synchronized (4 findings closed, 6 remain OPEN)
- [ ] Conformance corpus extended with projection/receipt/matrix samples and probes
- [ ] All fixed verification commands pass

## Requirements covered

| REQ | DC | Fixture | Oracle | Evidence level |
|---|---|---|---|---|
| REQ-003 | DC-005 | FX-005 | ORACLE-005 | file-integration |
| REQ-003 | DC-006 | FX-006 | ORACLE-006 | file-integration |
| REQ-004 | DC-007 | FX-007 | ORACLE-007 | file-integration |
| REQ-004 | DC-008 | FX-008 | ORACLE-008 | file-integration |
| REQ-004 | DC-009 | FX-009 | ORACLE-009 | file-integration |

## Scope

- New: generate-phase-projection.ts, phase-projection-template.json, tests
- Rewritten: audit-boundary-precheck.ts (projection-driven, explicit receipt paths)
- Upgraded: generate-evidence-receipt.ts (v3 dual observation), capture-state.ts (v3 discriminator)
- Synchronized: governance-surface-manifest.yaml, run-conformance.ts, corpus.json
- Out of scope: Phase 4 scripts (prepare-audit.ts, pre-check-evidence.ts, validate-audit.ts)
