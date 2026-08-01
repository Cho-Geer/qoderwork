# r9 Paper Draft — v1 spec-drift reconciliation: PHASE-00 row 33 cell enumeration aligned with PHASE-01 L82-99 / PHASE-02 L14 / canonical-contract L1085

> **Status**: PAPER DRAFT (pre-approval; not yet committed to immutable plan-text)
> **Generator**: main session / approved by GLM-5.2 (agent_a08508ac)
> **Generation date**: 2026-08-01
> **Predecessor**: r8 (2026-08-01)
> **Plan name**: `audit-governance-recovery-v1`
> **r9 generation trigger**: Stage 0-α REWORK (M3 #4) closing 11 of 14 mode gap; row 33 cell must be reconciled to operative L82-99 enumeration.

## 1. Generation metadata

```yaml
generation: r9
predecessor: r8
post-revision: yes
type: spec-drift
trigger: |
  Stage 0-α REWORK (M3 #4 dispatched in parallel) closes 11-mode gap.
  Row 33 cell text was a thin summary that did not enumerate the same modes
  that 5 independent textual anchors (PHASE-00 L12/L66, PHASE-01 L82-99 + L99,
  PHASE-02 L14, canonical-contract L1085+1338+1722) collectively authorize.
  r9 reconciles row 33 with the operative L82-99 enumeration.
fix-surface: |
  row 33 cell (canonical text) + 4 footer notes + (no canonical-contract
  patch in r9 itself; canonical-contract's producer registrations are
  unchanged because they were already r8-consistent)
new-implementation: NONE (M3 #4 already delivered)
```

## 2. Waiver_ids (verbatim continuation of r8's 5)

```yaml
exact_waiver_ids:
  - PHASE-01_P02A_ENTRY_WHILE_INDEX_BLOCKED
  - EXTERNAL_HUMAN_DECISION_FOR_PENDING_IMMUTABLE_LOCK
  - SUPPLEMENTAL_QODERWORK_BASELINE_WITH_WORK_ONE_P07_ANCHOR
  - CANDIDATE_BOOTSTRAP_ACTIVATION_AND_CLOSE_AFTER_VALID_AUDIT
  - PHASE-00_COMPONENT_LEVEL_NO_FORMAL_PRE_CHANGE

rationale: |
  Row 33 reconciliation is a textual correction only, not a scope expansion.
  The 5 r8 anchors (L12 normative prose; L66 phase completion gate item g3;
  PHASE-01 L99 cross-reference; PHASE-02 L14 cross-reference; canonical-contract
  L1085+1338+1722 producer registrations) collectively authorize all 14 modes
  under r8. Row 33 was a thin cell-summary that did not enumerate them. No
  waiver governs "correct description of authorized scope."
```

## 3. Patch 1 — PHASE-00 row 33 cell (L33 step 6 column 3)

### BEFORE
```
| 6 | `.agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts` | add inputs/releases, admission/status/final, bootstrap close, PHASE-02 candidate adoption, verify-final-* modes |
```

### AFTER
```
| 6 | `.agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts` | implement all 14 mutually-exclusive modes per PHASE-01 L82-99 enumeration: `--create-session-manifest`, `--create-scope-lock`, `--create-phase-approval-request`, `--emit-producer-release`, positional `PLAN_ROOT PHASE-ID` (admission), positional `PLAN_ROOT --closed-phase PHASE-ID --overlay-root PATH` (closed-phase), positional `PLAN_ROOT --final-readiness` (final-readiness), positional `PLAN_ROOT --final` (final), positional `PLAN_ROOT --final --overlay-root PATH` (final-overlay), `--stage-status`, `--stage-final-status`, `--verify-final-gate`, `--verify-final-audit-inputs`, `--verify-final-audit-regression`; argv guard per L101 distinguishes named-flag vs positional invocation |
```

## 4. Patch 2 — PHASE-00 L12 outcome prose

L12 already says "all 14 modes" — **no change needed**.
[UNVERIFIED whether r9 should add cross-reference footnote to PHASE-01 L82-99.]

## 5. Patch 3 — PHASE-00 L66 phase completion gate item g3

L66 already references `--create-scope-lock` — **no change needed**; g3 was correct.

## 6. Patch 4 — PHASE-00 allowed-files table footer (recommended)

Add a single explanatory line under the table:

```
> Note: row 33 enumerates the full 14-mode surface that step 6 must implement; the edit operations are mutually-exclusive flag dispatchers, not 14 separate functions. See PHASE-01 L82-99 for exact signatures, PHASE-02 L14 for downstream consumer anchors, and canonical-contract.yaml L1085 for producer registration.
```

## 7. Patch 5 — PHASE-00 L45-54 fixed-verification suite footnote (recommended)

Add a note to the fixed-verification command (PHASE-00 L46-54) explaining that the foundation-kernel suite tests the foundation surface, not every CLI mode; full mode coverage is the responsibility of `validate-phase-progression.test.ts`:

```
> Fixed-verification exercises the foundation-kernel surface (file-level tests). Mode coverage for all 14 `--*` flags is asserted by `validate-phase-progression.test.ts` fixtures, not by the eight foundation tests above.
```

## 8. Plan-files SHA impact (will change at r9 dispatch time)

Plan-text file SHA will change at r9 dispatch (Patch 1 + Patch 4 + Patch 5 modify plan-text). Specifically:

| File | Pre-r9 (r8-frozen) | Post-r9 (estimated) |
|---|---|---|
| `plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml` | `cb26cff477a053de8a1d433dc1d561a5c2fd80499a21c84af1e44dc79fa2b065` | UNKNOWN (depends on r9 implementation; will compute at draft time) |
| `plans/.../00-plan-index.md` | `bec2edb75d1e61e55c01715eb7a1f2cf31803e47f97c138669590be597e519f3` | UNKNOWN |
| `plans/.../00-phase-toolchain-implementation.md` | `b97551dd2ad28d756a31ec0bfb5b7e4c8a9f2c537cdf78d39c072f3771641baf` | UNKNOWN (Patch 1 + 4 + 5 mutate) |
| `plans/.../01..05-phase-*.md` | UNCHANGED | UNCHANGED (not patched) |
| `plans/.../06-phase-...md` | UNCHANGED | UNCHANGED |
| `plans/.../99-final-verification.md` | UNCHANGED | UNCHANGED |

At r9 dispatch time, the audit chain's r9 approved-plan-files-r9.sha256 will enumerate all 7 plan files with their new SHAs (PATCHED + UNCHANGED entries).

## 9. Approval-decision-r9.json skeleton (proposal)

```json
{
  "schema_version": "audit-governance-approval/v3",
  "document_kind": "approval-decision",
  "decision_id": "R9",
  "plan_id": "AUDIT-GOVERNANCE-RECOVERY-V1-20260730",
  "governance_profile": "audit-governance-recovery/v1",
  "decision": "APPROVED",
  "approved_by": "HUMAN_USER",
  "approved_at": "<USER-SUPPLIED UTC>",
  "approval_request": {
    "path": "audits/audit-governance-recovery-v1/approval-request-r9.json",
    "sha256": "<computed at dispatch>"
  },
  "canonical_contract": {
    "path": "plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml",
    "sha256": "<r9 post-patch>"
  },
  "approved_plan_object_set": {
    "path": "audits/audit-governance-recovery-v1/approved-plan-object-set-r9.json",
    "sha256": "<computed at dispatch>"
  },
  "approved_plan_files": {
    "path": "audits/audit-governance-recovery-v1/approved-plan-files-r9.sha256",
    "sha256": "<computed at dispatch>"
  },
  "approved_index_baseline": {
    "path": "audits/audit-governance-recovery-v1/bootstrap/approved-index-baseline-r9.md",
    "sha256": "<computed at dispatch>"
  },
  "frozen_m1_files": {
    "path": "audits/audit-governance-recovery-v1/bootstrap/m1-p0-freeze-manifest-r9.json",
    "sha256": "<r9 post-patch>"
  },
  "p4_boundary": {
    "path": "audits/audit-governance-recovery-v1/bootstrap/p4-boundary-r9.json",
    "sha256": "<UNVERIFIED — same as r8 if boundary unchanged; would need recompute>"
  },
  "approved_artifacts": {
    "canonical_contract": {
      "path": "plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml",
      "sha256": "<r9 post-patch>"
    },
    "approved_plan_object_set": { ... },
    "approved_plan_files": { ... },
    "approved_index_baseline": { ... },
    "frozen_m1_files": { ... },
    "p4_boundary": { ... }
  },
  "waiver_ids": [
    "PHASE-01_P02A_ENTRY_WHILE_INDEX_BLOCKED",
    "EXTERNAL_HUMAN_DECISION_FOR_PENDING_IMMUTABLE_LOCK",
    "SUPPLEMENTAL_QODERWORK_BASELINE_WITH_WORK_ONE_P07_ANCHOR",
    "CANDIDATE_BOOTSTRAP_ACTIVATION_AND_CLOSE_AFTER_VALID_AUDIT",
    "PHASE-00_COMPONENT_LEVEL_NO_FORMAL_PRE_CHANGE"
  ],
  "exact_waiver_ids": [ ... ],
  "cryptographic_references": [],
  "effect": "AUTHORIZES_MATERIALIZATION_PHASE_00_REWORK_LEGITIMATION",
  "immutable": true,
  "supersedes": "R9-PENDING",
  "acyclicity_note": "r9",
  "approval_effect": "Any change requires new approval (r10)."
}
```

## 10. Effect statement

r9's effect is **AUTHORIZES_MATERIALIZATION_PHASE_00_REWORK_LEGITIMATION**:
1. Legitimizes M3 #4's REWORK (which closes the 11-mode gap) as falling within r8's original scope.
2. Reconciles row 33 cell so future PHASE-01..06 readers see the full 14-mode surface.
3. Does NOT change r8's waivers.
4. Does NOT introduce any new implementation beyond M3 #4's existing REWORK.
5. Does NOT touch the 5 r8 waivers; does NOT introduce a 6th waiver.

## 11. Risks the user should know

(R-1 from GLM-5.2 r9 assessment, condensed)
- M3 #4 must produce a complete 14-mode implementation before r9's plan-text patch lands; otherwise r9 legitimizes a partially-working toolchain.
- r9's full 5-patch plan-text edits and 9 audit-chain artifacts are all linked; if any chain link is corrupt, r9 MUST be rejected and re-dispatched.
- r9 does NOT supersede r8's audit chain; r8 remains authoritative until r9 PASSES r8-priority gate (e.g., the r9 freeze depends on r8 PASS for materialization).
- r9 drafts pattern after r6→r7→r8 historical chain (canonical-contract L27-29): spec-drift fix generations have been precedented without waivers.

## 12. Things to verify before user accepts r9

- [ ] M3 #4 reports Self-Pass with all 14 modes CLI-tested.
- [ ] Main session independent reproduce V1-V7 of M3 #4 dispatch protocol.
- [ ] GLM-5.2 #3 (next dispatch) reports AUDIT_PASS on Stage 0-α REWORK.
- [ ] Main session new Final Gate Accepts Stage 0-α REWORK.
- [ ] Plan-text post-rework SHA computed.
- [ ] User content review of THIS PAPER DRAFT (this file).
- [ ] User content review of Patch 1..5 text per §3..§7 of THIS PAPER DRAFT.

## 13. Dispatch sequence (post-accept)

If user accepts r9 paper draft:

1. Apply Patch 1, Patch 4, Patch 5 to `00-phase-toolchain-implementation.md`.
2. Recompute `sha256sum` of all 7 plan-text files (canonical yaml + plan-index + 7 phase files including the modified 00-phase, 03..05 phase if changed).
3. Generate 9 r9 audit chain artifacts in `audits/audit-governance-recovery-v1/` directory:
   - `approved-plan-files-r9.sha256` (SHA of all 10 plan files)
   - `approved-plan-object-set-r9.json` (the r8 object-set structure, regenerated with -r9 paths and updated SHA entries; reuses canonical schema from object-set template)
   - `bootstrap/approved-index-baseline-r9.md` (regenerated with -r9 sha)
   - `bootstrap/m1-p0-freeze-manifest-r9.json` (regenerated with -r9 sha, 87 entries same as r8)
   - `bootstrap/p4-boundary-r9.json` (same content as r8 if no path changes; otherwise regenerated)
   - `bootstrap/approved-plan-materialization-r9.json` (regenerated materialization receipt)
   - `approval-request-r9.json` (request referencing r9 SHAs)
   - `approval-decision-pending-r9.json` (pending marker)
   - `approval-decision-r9.json` (final; human-approved)
4. Update `00-plan-index.md` header fields: Approved plan files SHA → -r9; Approved index baseline SHA → -r9; Approval decision SHA → -r9.
5. User reviews and accepts. r9 acceptance supersedes r8 for plan-text PATCH; r8 remains authoritative for the underlying M1 source (NOT modified by r9).
6. Run materialization_commands (canonical L1631-1658) with r9 paths.
7. Stage 0-β / PHASE-01..06 + 99-final can now run.

## 14. Disposition

This is a **PAPER DRAFT**, not yet committed. Main session will wait for user content review against §3..§7 before any disk write. If approved, dispatch proceeds per §13.

---

**THIS IS NOT r9. r9 is the audit chain that will be built from this draft after user Accept.**
**Disk status**: `plans/audit-governance-recovery-v1/` is in r8 frozen state. `audits/audit-governance-recovery-v1/` contains r8 chain + r1..r7 historical. No -r9 files exist yet.
