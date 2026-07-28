schema_version: audit-governance-latest/v3
document_kind: latest-pointer
report_filename: 2026-07-28-audit.md
report_sha256: ad9cc26abacbf4cd823c4132a60868387377359fd5f9a6b931e922dbc11dcda1
settles:
  canonical_contract_sha256: 39235a4290e0af52a8b68b9cc54b5ceb595a5eb064366cf53c2189096e7690ff
  scope_lock_sha256: f10a7e544cef2c3efcf4251f68922f12c54d1d344666f742b1bab3aa1cfd9954
audit:
  audit_id: BLUEPRINTS-GOVERNANCE-PHASE-01-AUDIT-20260728
  generation: 1
  verdict: ACCEPT
  phase_id: PHASE-01
  plan_name: blueprints-governance
  evidence_ceiling: component
  reported_at: 2026-07-28T13:30:00Z
  requirements_closed: 2
  open_blockers: 0
  evidence_receipts: 8
  validator: validate-audit.ts
  validator_status: exit_0
  notes: |
    PHASE-01 INDEX board landed: blueprints/INDEX.md three-section board with
    31 .md files registered exactly once, status enum valid, v3 blueprint
    listed in exemption list. P-02 Freeze Gate complete with HUMAN_USER
    approval (decision_id BLUEPRINTS-GOVERNANCE-APPROVAL-20260728). P-03
    audit toolchain (8 EV-NNN receipts hash-bound, pre-change + verdict-state
    receipts time-ordered) completed with validate-audit.ts exit 0. v3
    tooling compatibility first-touch verified by Gate 1 (pre-check-evidence)
    and Gate 2 (validate-audit) success.