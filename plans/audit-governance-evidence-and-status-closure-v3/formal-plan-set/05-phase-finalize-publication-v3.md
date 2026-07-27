# PHASE-05: Finalize & Publication v3

**Phase ID**: `PHASE-05`
**Progression status**: `NOT_STARTED`
**Depends on**: `PHASE-04`
**Provenance level**: `v3-required`

## Phase completion gate

- [ ] finalize-audit.ts emits audit-governance-report/v3::audit-report + audit-governance-latest/v3::latest-pointer
- [ ] CAS atomic publish via temp+rename (immutable report + atomic LATEST pointer)
- [ ] fail-closed paths preserved: AUDIT_VALIDATION_FAILED, LATEST_POINTER_CONFLICT, REPORT_HASH_DRIFT, REPORT_BINDING_MISSING, REPORT_SCHEMA_INVALID, REPORT_UNAVAILABLE
- [ ] Added helpers: buildAuditReportDocument, buildLatestPointerDocument
- [ ] scope-lock-template.json migrated to audit-scope-lock/v3 + v3-required
- [ ] Governance surface manifest / conformance corpus / tests / consumer registration synced
- [ ] Final 2 OPEN findings closed: scope-lock-template.json:pre-v3-schema_version, scope-lock-template.json:provenance-exposure
- [ ] Finalize-audit tests pass: 7 pass / 0 fail (happy + 2 fail-closed + v3 parse + failure-mutation matrix)
- [ ] Total 23 pass / 0 fail across finalize-audit + run-conformance + parser (component + unit levels)
- [ ] Scanner reports NO_OPEN_FINDINGS, findings=[] across all registered assets
- [ ] Shared parser hash remained unchanged (37b74a62...) and Phase 3/4 scripts were not modified
- [ ] No real phase ACCEPT verdict, audit report, or LATEST pointer was self-issued by this phase (publication machinery exists and is tested, but no self-issued verdict)

## Requirements covered

| REQ | DC | Fixture | Oracle | Evidence level |
|---|---|---|---|---|
| REQ-005 | DC-010 | N/A | N/A | file-integration |
| REQ-005 | DC-011 | N/A | N/A | file-integration |

## Scope

- Added: plans/audit-governance-evidence-and-status-closure-v3/formal-plan-set/05-phase-finalize-publication-v3.md
- Added: audits/audit-governance-evidence-and-status-closure-v3/phase-05-evidence/
- Modified: .agents/skills/plan-audit-archiver/scripts/finalize-audit.ts
- Modified: .agents/skills/plan-audit-archiver/scripts/__tests__/finalize-audit.test.ts
- Modified: .agents/skills/plan-audit-archiver/templates/scope-lock-template.json
- Modified: scripts/lib/governance-surface-manifest.yaml
- Modified: scripts/lib/run-conformance.ts
- Modified: scripts/lib/conformance-corpus/corpus.json
- Modified: scripts/lib/__tests__/run-conformance.test.ts
- Modified: scripts/lib/__tests__/scan-governance-surface.test.ts
- Modified: plans/audit-governance-evidence-and-status-closure-v3/formal-plan-set/00-plan-index.md
- Modified: logs/INDEX.md

## Out of scope

- Shared parser (scripts/lib/audit-governance-schema-v3.ts) — hash 37b74a62... must remain unchanged
- Phase 3 scripts (validate-plan.ts, phase-progression.ts, scope/projection/receipt/precheck chain)
- Phase 4 scripts (validate-audit.ts, prepare-audit.ts, pre-check-evidence.ts)
- Self-issued phase ACCEPT verdict for PHASE-03/04/05 (publication machinery exists but no verdict was self-issued)
- Compatibility entry / generic bypass / legacy-exempt / old Plan inputs
- Quarantined content reads