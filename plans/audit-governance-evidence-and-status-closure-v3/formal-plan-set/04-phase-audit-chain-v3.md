# PHASE-04: Audit Chain v3

**Phase ID**: `PHASE-04`
**Progression status**: `NOT_STARTED`
**Depends on**: `PHASE-03`
**Provenance level**: `v3-required`

## Phase completion gate

- [ ] validate-audit.ts consumes v3 discriminators, including audit-governance-audit/v3::audit-contract
- [ ] prepare-audit.ts emits audit-governance-audit/v3::audit-contract
- [ ] pre-check-evidence.ts consumes audit-evidence-receipt/v3::evidence-receipt via the shared parser
- [ ] audit-boundary-matrix/v1 migrated to audit-boundary-matrix/v3
- [ ] schema_version "2.1" pairs and v2.1-required migrated to v3 pairs and v3-required
- [ ] MODEL_REVIEW binds to the v3 boundary matrix
- [ ] Four consumer-local findings closed
- [ ] Audit-chain tests pass: 72 pass / 0 fail across validate, prepare, and precheck
- [ ] Shared parser hash remained unchanged and Phase 3 scripts were not modified
- [ ] No audit report, LATEST pointer, or phase ACCEPT was created by this phase

## Requirements covered

| REQ | DC | Fixture | Oracle | Evidence level |
|---|---|---|---|---|
| REQ-005 | DC-010 | N/A | N/A | file-integration |
| REQ-005 | DC-011 | N/A | N/A | file-integration |

## Scope

- Added: plans/audit-governance-evidence-and-status-closure-v3/formal-plan-set/04-phase-audit-chain-v3.md
- Added: audits/audit-governance-evidence-and-status-closure-v3/phase-04-evidence/
- Modified: .agents/skills/plan-audit-archiver/scripts/validate-audit.ts
- Modified: .agents/skills/plan-audit-archiver/scripts/prepare-audit.ts
- Modified: .agents/skills/plan-audit-archiver/scripts/pre-check-evidence.ts
- Modified: .agents/skills/plan-audit-archiver/scripts/__tests__/validate-audit.test.ts
- Modified: .agents/skills/plan-audit-archiver/scripts/__tests__/prepare-audit.test.ts
- Modified: .agents/skills/plan-audit-archiver/scripts/__tests__/pre-check-evidence.test.ts
- Modified: scripts/lib/governance-surface-manifest.yaml
- Modified: scripts/lib/run-conformance.ts
- Modified: scripts/lib/conformance-corpus/corpus.json
- Modified: scripts/lib/__tests__/run-conformance.test.ts
- Modified: scripts/lib/__tests__/scan-governance-surface.test.ts
- Modified: plans/audit-governance-evidence-and-status-closure-v3/formal-plan-set/00-plan-index.md
- Modified: logs/INDEX.md

## Out of scope

- finalize-audit.ts (Phase 5)
- scope-lock-template.json (Phase 5)
