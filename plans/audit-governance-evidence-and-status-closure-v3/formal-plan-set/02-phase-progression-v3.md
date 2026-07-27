# Phase PHASE-02: phase-progression v3 discrimination and template repair [NOT_STARTED]

**Phase ID**: `PHASE-02`
**Depends on**: `PHASE-01`
**Progression status**: `NOT_STARTED`
**Outcome**: v3-ify the progression receipt discrimination by routing it through the shared parser as `audit-phase-progression/v3::phase-progression-receipt`, repair the v3 PLAN-SET template progression markers, synchronize the surface manifest, and refine the surface scanner so it distinguishes a consumer-local v3 schema interpretation (a blocking finding) from the legitimate plan-index progression marker `phase-progression/v1` (not a finding)
**Provenance level**: `v3-required`
**Evidence level**: `component` (REQ-002) / `file-integration` (REQ-006, REQ-007)

## Goal

- Route the progression receipt schema discrimination through the shared v3 parser `parseAuditGovernanceV3Document` as `audit-phase-progression/v3::phase-progression-receipt` (REQ-002).
- Add the v3 PLAN-SET template progression markers (index `Progression` schema marker `phase-progression/v1`, and each phase `Progression status` and `Completion receipt` lines), aligned with `PLAN-TEMPLATE.md` (REQ-006).
- Synchronize the surface manifest and refine the surface scanner so it flags consumer-local v3 schema interpretation (any of the 17 `SCHEMA_PAIRS` or pre-v3 stand-ins) and does NOT flag the legitimate plan-index progression marker `phase-progression/v1` used by `isProgressionSchema` (REQ-006, REQ-007).
- Declare the rewired `phase-progression.ts` and `validate-phase-progression.ts` as v3 consumers in the conformance runner set (REQ-007).

## Starting state and dependency

PHASE-01 is ACCEPTED. The shared v3 parser, the v3 PLAN_SET admission, the surface manifest, the findings-first scanner, and the independent shared conformance corpus with mismatch probes are established.

The plan-index marker `phase-progression/v1` (used by `isProgressionSchema`) is plan metadata consumed only by the P-02A gate and is decoupled from v3 admission; it stays unchanged.

## Local requirements

| Requirement | Contract |
|---|---|
| REQ-002 | schema-family documents are unambiguous and share one parser |
| REQ-006 | active governance surface is manifest-bound and findings-first |
| REQ-007 | every consumer conforms to one independent v3 contract corpus |

## Decision cases covered

| Decision case | Phrase |
|---|---|
| DC-003 | REQ-002 schema-family documents share one parser |
| DC-004 | REQ-002 receipt discrimination routes through shared parser |
| DC-012 | REQ-006 surface scanner flags consumer-local v3 schema interpretation |
| DC-013 | REQ-006 scanner does not flag legitimate plan-index progression marker |
| DC-014 | REQ-007 progression scripts declared v3 consumers |
| DC-015 | REQ-007 conformance corpus extended with progression consumer samples and mismatch probes |

## Allowed files

| Exact path | Change | Anchor |
|---|---|---|
| .agents/skills/deterministic-implementation-planning/scripts/phase-progression.ts | modify | validateReceiptContract v3 discrimination through shared parser |
| .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts | modify | gate semantics preserved, only receipt discrimination call path changes |
| .agents/skills/deterministic-implementation-planning/scripts/phase-progression.test.ts | modify | tests for v3 receipt discrimination |
| .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.test.ts | modify | gate semantics tests preserved |
| .agents/skills/deterministic-implementation-planning/PLAN-SET-TEMPLATE.md | modify | add index `Progression` marker and per-phase `Progression status` / `Completion receipt` lines |
| .agents/skills/deterministic-implementation-planning/SKILL.md | modify | reflect template progression markers |
| scripts/lib/scan-governance-surface.ts | modify | refine consumer-local v3 schema interpretation detection |
| scripts/lib/__tests__/scan-governance-surface.test.ts | modify | tests for refined detection |
| scripts/lib/governance-surface-manifest.yaml | modify | add scripts/lib/audit-governance-schema-v3.ts to allowed_references; update sha256 of modified registered assets |
| logs/INDEX.md | modify | log index entry for this phase |
| audits/audit-governance-evidence-and-status-closure-v3/phase-02-pre-change-capture.yaml | add | pre-change capture (must bind this scope lock, approval, hashes of allowlist paths, worktree git status, work-one clean status) |
| audits/audit-governance-evidence-and-status-closure-v3/phase-02-evidence/ | add | phase-02 evidence directory root (only files created under it for this phase are allowed) |
| logs/2026-07-26-audit-governance-v3-phase-02-progression-v3.md | add | phase-02 implementation log |

## Forbidden files and behaviors

No pre-v3 input, compatibility entry, generic bypass, phase ACCEPT, audit report write, LATEST pointer write, or shared parser code change. The shared parser `scripts/lib/audit-governance-schema-v3.ts` is read-only (hash `37b74a62...`). The plan-index marker `phase-progression/v1` is not migrated. Quarantined paths and legacy exemptions content are classified by path only and never opened.

## Fixed contract

`validateReceiptContract` must discriminate the receipt schema through the shared parser `parseAuditGovernanceV3Document` as `audit-phase-progression/v3::phase-progression-receipt`, replacing the consumer-local comparison against `PROGRESSION_SCHEMA`. The receipt gains a `document_kind` field. `PROGRESSION_SCHEMA` may remain only as the plan-index marker literal used by `isProgressionSchema`.

`PROGRESSION_STATUSES` and `TOP_LEVEL_STATUSES` enums, `deriveTopLevelStatus` semantics, `parseManifest` and `validateManifestRows`, and the receipt hash binding fields (`plan_index_sha256`, `phase_file_sha256`, `audit_report_sha256`, `validator_output_sha256`) and `previous_status`/`new_status` validation are unchanged.

The `NOT_STARTED` re-entrancy gate (next phase must be `NOT_STARTED`), dependency `ACCEPTED` requirement, top-level derived status check, and completion-gate consistency are preserved verbatim.

The scanner must still call the shared parser, complete the full finding set, and after refinement must flag consumer-local interpretation of a v3 schema-family discriminator (any of the 17 `SCHEMA_PAIRS`, or pre-v3 stand-ins such as `2.1`, `1.0`, `audit-boundary-matrix/v1`, `boundary-contract/v1`) and must NOT flag the legitimate plan-index progression marker `phase-progression/v1` used by `isProgressionSchema`.

## Implementation steps

Frozen in the PHASE-02 v3 phase scope lock (`audits/audit-governance-evidence-and-status-closure-v3/phase-02-scope-lock.yaml`, scope_lock_id `AGV3-PHASE-02-PROGRESSION-V3-SCOPE-LOCK-20260726`); this phase declares intent only and authorizes no further code write.

## Check Registry

| Check name | PASS |
|---|---|
| receipt_v3_discrimination | `phase-progression.test.ts` all named tests pass with v3 receipt discrimination through shared parser |
| progression_gate_preserved | `validate-phase-progression.test.ts` all named tests pass with gate semantics preserved |
| formal_plan_set_p02a_intact | `validate-phase-progression.ts` on the formal PLAN_SET with PHASE-01 returns exit 0 |
| v3_admission_intact | `validate-plan.ts` on the formal PLAN_SET returns exit 0 |
| scanner_refined_detection | `scan-governance-surface.test.ts` all named tests pass with refined consumer-local detection |
| progression_marker_finding_closed | `scan-governance-surface.ts` run reports `F-CONSUMER-LOCAL:phase-progression.ts:phase-progression/v1` closed; remaining consumer-local findings stay OPEN; no illegal-reference self-finding |
| conformance_consumer_agreement | `run-conformance.test.ts` all named tests pass including progression consumer and mismatch probes |
| conformance_runner_run | `run-conformance.ts` on the conformance corpus reports declared v3 consumers (including progression) agree and mismatch probes rejected |
| parser_unchanged | `audit-governance-schema-v3.test.ts` 4 tests pass and parser hash `37b74a62...` unchanged |
| typecheck_exit_0 | `bun run typecheck` exits 0 |
| parser_callers_correct | `codegraph sync && codegraph callers parseAuditGovernanceV3Document` lists progression scripts, scanner, and runner as callers; parser is unchanged |
| scope_diff_clean | `git status --porcelain` shows only allowlist paths and the `phase-02-evidence/` root changed since the pre-change capture |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-v3
# exact commands frozen in the PHASE-02 scope lock
# P02-POS-001: bun test .agents/skills/deterministic-implementation-planning/scripts/phase-progression.test.ts
# P02-POS-002: bun test .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.test.ts
# P02-POS-003: bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts plans/audit-governance-evidence-and-status-closure-v3/formal-plan-set PHASE-01
# P02-POS-004: bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts plans/audit-governance-evidence-and-status-closure-v3/formal-plan-set /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-v3
# P02-SCAN-001: bun test scripts/lib/__tests__/scan-governance-surface.test.ts
# P02-SCAN-002: bun run scripts/lib/scan-governance-surface.ts scripts/lib/governance-surface-manifest.yaml
# P02-CONF-001: bun test scripts/lib/__tests__/run-conformance.test.ts
# P02-CONF-002: bun run scripts/lib/run-conformance.ts scripts/lib/conformance-corpus
# P02-POS-005: bun test scripts/lib/__tests__/audit-governance-schema-v3.test.ts
# P02-TYPECHECK: bun run typecheck
# P02-PARSER-CALLERS: codegraph sync && codegraph callers parseAuditGovernanceV3Document
# P02-SCOPE-DIFF: git status --porcelain
```

## Rollback/failure convergence

Any named test absent or failed, formal PLAN_SET P-02A or v3 admission regressed, `NOT_STARTED` gate semantic changed, plan-index marker migrated, audit report binding tightened, consumer-local finding silently closed without receipt, scanner flags legitimate progression marker, scanner self-flags illegal reference after manifest sync, parser or shared schema registry changed, or scope or hash drift converges to `BLOCKED`. Revert only the PHASE-02 allowlist writes; never delete evidence, never close a finding without receipt evidence, never publish a report or LATEST pointer.

## Findings disposition

- Closes: `F-PHASE01-TEMPLATE-PROGRESSION-MARKER` (template repaired); `F-CONSUMER-LOCAL:phase-progression.ts:phase-progression/v1` (receipt discrimination v3-ified; residual marker is legitimate plan metadata; scanner refined).
- Stays OPEN: `F-CONSUMER-LOCAL:validate-audit.ts:schema_version-2.1`, `F-CONSUMER-LOCAL:validate-audit.ts:audit-boundary-matrix/v1`, `F-CONSUMER-LOCAL:audit-boundary-precheck.ts:boundary-contract/v1`, `F-CONSUMER-LOCAL:capture-state.ts:schema_version`, `F-CONSUMER-LOCAL:prepare-audit.ts:schema_version`, `F-CONSUMER-LOCAL:generate-evidence-receipt.ts:schema_version`, `F-CONSUMER-LOCAL:pre-check-evidence.ts:schema_version`, `F-CONSUMER-LOCAL:scope-lock-template.json:pre-v3-schema_version`, `F-CONSUMER-LOCAL:scope-lock-template.json:provenance-exposure`, `F-CONSUMER-LOCAL:evidence-receipt-template.json:pre-v3-schema_version`.
- Closure requires receipt evidence.

## Out of scope

- Phase 3 scripts (scope/projection/receipt/precheck chain; receipt discrimination beyond the `phase-progression/v3::phase-progression-receipt` schema introduced here).
- Phase 4 audit chain v3 (validate-audit / prepare-audit / pre-check-evidence v3-ification; `boundary-contract/v1` -> `audit-boundary-matrix/v3` migration; MODEL_REVIEW binding to v3 matrix).
- Phase 5 finalize-publication v3 (`finalize-audit.ts` producing `audit-governance-report/v3::audit-report` + `audit-governance-latest/v3::latest-pointer`; CAS temp+rename atomic publication; `scope-lock-template.json` upgrade to `audit-scope-lock/v3` + `v3-required`).
- Tightening the receipt `audit_report_path`/`audit_verdict`/`audit_exit_code` binding semantics (depends on phase 4-5 v3 audit reports).
- Migrating the plan-index marker `phase-progression/v1` (would break the admitted formal PLAN_SET P-02A gate and ripple into three active plans).
- Modifying the shared parser `scripts/lib/audit-governance-schema-v3.ts` (hash `37b74a62...`, unchanged across all phases).
- Writing a phase ACCEPT, audit report, or LATEST pointer for this phase (no live receipt is produced because no phase reaches `ACCEPTED`).

## Phase completion gate

- [ ] PHASE-02 scope lock approved by HUMAN_USER and pre-change capture created.
- [ ] `validateReceiptContract` discriminates the receipt schema through the shared parser as `audit-phase-progression/v3::phase-progression-receipt` (REQ-002; DC-003, DC-004).
- [ ] PLAN-SET template progression markers added: index `Progression` schema marker `phase-progression/v1`, and each phase `Progression status` and `Completion receipt` lines aligned with `PLAN-TEMPLATE.md` (closes `F-PHASE01-TEMPLATE-PROGRESSION-MARKER`).
- [ ] Surface manifest synchronized: `scripts/lib/audit-governance-schema-v3.ts` added to `allowed_references` of `phase-progression.ts` and `validate-phase-progression.ts` (and `scan-governance-surface.ts` if its hash changes); sha256 of every modified registered asset updated; no illegal-reference self-finding.
- [ ] Surface scanner refined: flags consumer-local v3 schema interpretation (any of the 17 `SCHEMA_PAIRS` or pre-v3 stand-ins) and does NOT flag the legitimate plan-index progression marker `phase-progression/v1` used by `isProgressionSchema` (closes `F-CONSUMER-LOCAL:phase-progression.ts:phase-progression/v1`; remaining consumer-local findings stay OPEN) (REQ-006; DC-012, DC-013).
- [ ] Progression scripts (`phase-progression.ts`, `validate-phase-progression.ts`) declared as v3 consumers in the conformance runner set; corpus extended with `audit-phase-progression/v3::phase-progression-receipt` samples and mismatch probes; conformance corpus agreement and mismatch probes rejected (REQ-007; DC-014, DC-015).
- [ ] `NOT_STARTED` re-entrancy gate, dependency `ACCEPTED` requirement, top-level derived status check, and completion-gate consistency preserved verbatim in `validate-phase-progression.ts`.
- [ ] Receipt hash binding fields (`plan_index_sha256`, `phase_file_sha256`, `audit_report_sha256`, `validator_output_sha256`) and `previous_status`/`new_status` validation unchanged.
- [ ] Shared parser `scripts/lib/audit-governance-schema-v3.ts` unchanged (hash `37b74a62...`); plan-index marker `phase-progression/v1` not migrated; no phase ACCEPT, audit report, or LATEST pointer written for this phase.
- [ ] Fixed checks passed at file-integration level with retained receipts.