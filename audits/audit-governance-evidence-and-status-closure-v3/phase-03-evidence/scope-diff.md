# P03-SCOPE-DIFF — scope containment evidence

Generated: 2026-07-27
Phase: PHASE-03 (receipt/projection/precheck v3)
Baseline: phase-03-pre-change-capture.yaml

## Method
Compare `git status --porcelain` after P03-CHAIN-001 writes against the
`effective_allowlist` of phase-03-scope-lock.yaml (SHA-256
3252ba74a4717ae5b28fa4d07f7614253819ac9b07d673fd803d88f9b73c849f).

## New writes introduced by P03-CHAIN-001
All under the allowlisted directory root `audits/audit-governance-evidence-and-status-closure-v3/phase-03-evidence/`:
- cases.json
- receipt-DC-005.json .. receipt-DC-009.json (5 explicit receipt artifacts)
- projection.json (sha256 2eff82f5d6b10b39c295c5cc7e4a09b3b4eb0bc6cf959e7759cb39c53170bf42)
- boundary-matrix.json (sha256 56a2edcf337a3a872b47cf625a96f8cb2113d04f0ba0f58620f91f7fadf2eb38)
- scope-diff.md (this file)

## Containment verdict
- No path outside `effective_allowlist.added_paths` / `modified_paths` was created or
  modified by this step.
- The shared parser (`scripts/lib/audit-governance-schema-v3.ts`) was NOT changed
  (shared_parser_writable: false).
- Phase 4 scripts (prepare-audit / pre-check-evidence / validate-audit) were NOT
  changed (phase4_scripts_writable: false).
- No ACCEPT / audit-report / LATEST pointer was created (prohibited_effects honored).

## git status --porcelain (post-write, same set as pre-change capture + phase-03-evidence root)
All untracked entries (audits/..., plans/..., scripts/lib/..., logs/..., handoff/...,
blueprints/...) and modified entries were already present in the pre-change capture
baseline; P03-CHAIN-001 only added files inside the already-allowlisted
`audits/audit-governance-evidence-and-status-closure-v3/` tree.

Result: PASS — scope containment holds.
