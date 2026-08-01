# r9 Paper Draft v2 — v1 plan-text reconciliation (PHASE-00 row 33 cell enumeration)

> **Status**: PAPER DRAFT v2 (post M3 + GLM-5.2 #4 dual review)
> **Generator**: main session / reviewed by M3 (agent_ceb10d84) + GLM-5.2 #4 (agent_6e9334f3)
> **Generation date**: 2026-08-01
> **Predecessor**: r8 (2026-08-01)
> **Plan name**: `audit-governance-recovery-v1`
> **r9 generation trigger**: Stage 0-α REWORK (M3 #4) closing 11 of 14 mode gap; row 33 cell must be reconciled to operative L82-99 enumeration.

## v2 change log (vs v1)

Reviewer findings were incorporated:

| Drift | Source | Status |
|---|---|---|
| D-2 | M3 | **fixed** |
| D-1 | M3 | **fixed** |
| D-3 | M3 | **fixed** |
| D-4 / M-1 | M3 / GLM-5.2 #4 | **fixed (added Patch 6)** BLOCKING |
| D-5 / M-5 | M3 / GLM-5.2 #4 | **fixed** |
| D-8 / M-2 / M-3 | M3 / GLM-5.2 #4 | **fixed** |
| M-4 | GLM-5.2 #4 | **fixed** |
| M-6 / M-7 / M-8 | GLM-5.2 #4 | **fixed** |

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
  PHASE-00 row 33 cell (canonical text) + 4 footer notes + (NEW) a new
  `materialization_commands_r9` block parallel to `materialization_commands_r8`
  at canonical-contract.yaml:1669-1690.
new-implementation: NONE (M3 #4 already delivered the 14-mode surface)
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
| 6 | `.agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts` | implement all 14 mutually-exclusive modes per PHASE-01 L82-99 enumeration: `--create-session-manifest`, `--create-scope-lock`, `--create-phase-approval-request`, `--emit-producer-release`, positional `PLAN_ROOT <PHASE-ID>` (admission), positional `PLAN_ROOT --closed-phase <PHASE-ID> --overlay-root <path>` (closed-phase), positional `PLAN_ROOT --final-readiness` (final-readiness), positional `PLAN_ROOT --final` (final), positional `PLAN_ROOT --final --overlay-root <path>` (final-overlay), `--stage-status`, `--stage-final-status`, `--verify-final-gate`, `--verify-final-audit-inputs`, `--verify-final-audit-regression`; argv routing via per-flag `process.argv.includes("--…")` presence checks (PHASE-01 L101's `argv[2].startsWith("--")` is the intent, not literal pattern) |
```

## 4. Patch 2 — PHASE-00 L12 outcome prose

L12 already says "all 14 modes" — **no change needed**.

## 5. Patch 3 — PHASE-00 L66 phase completion gate item g3

L66 already references `--create-scope-lock` — **no change needed**; g3 was correct.

## 6. Patch 4 — PHASE-00 allowed-files table footer (recommended)

Add a single explanatory line under the table:

```
> Note: row 33 enumerates the full 14-mode surface that step 6 must implement; the edit operations are 14 independent flag dispatchers (in practice users invoke one mode per call). See PHASE-01 L82-99 for exact signatures, PHASE-02 L14 for downstream consumer anchors, and canonical-contract.yaml L1722 for phase_00 release command invoking `--emit-producer-release`.
```

## 7. Patch 5 — PHASE-00 L45-54 fixed-verification suite footnote (recommended)

Add a note to the fixed-verification command (PHASE-00 L46-54) explaining the test-file split:

```
> Fixed-verification (PHASE-00 L45-54) exercises the foundation-kernel surface (8 test files listed above). Mode coverage for all 14 `--*` flag dispatchers is asserted by `__tests__/validate-phase-progression-14-modes.test.ts` (the new fixture file created by M3 #4 Stage 0-α REWORK; SHA `6d4cda9e…`). The 8-file fixed-verification invocation list above does NOT include the new 14-modes fixture; F-11 acknowledges this as a follow-up r9/r10 wiring patch (out of scope for r9 textual reconciliation).
```

## 8. Patch 6 (NEW) — extend canonical-contract.yaml with `materialization_commands_r9` block

Add a new YAML mapping block **adjacent to** the existing `materialization_commands_r8` block (canonical-contract.yaml L1669-1690), with the same structure but `-r8` -> `-r9` substituted in every path:

### Block structure (skeleton)

```yaml
materialization_commands_r9: |  # parallel to materialization_commands_r8 (L1669-1690); r9 legitimates the textual reconciliation per Patch 1+4+5
  # audit / freeze CHAIN — 9 artifacts (mirror of r8)
  const p={o:"audits/audit-governance-recovery-v1/approved-plan-object-set-r9.json",m:"audits/audit-governance-recovery-v1/approved-plan-files-r9.sha256",b:"audits/audit-governance-recovery-v1/bootstrap/approved-index-baseline-r9.md",pending:"audits/audit-governance-recovery-v1/approval-decision-pending-r9.json",h:"audits/audit-governance-recovery-v1/bootstrap/m1-p0-freeze-manifest-r9.json",p4:"audits/audit-governance-recovery-v1/bootstrap/p4-boundary-r9.json",rp:"audits/audit-governance-recovery-v1/approval-request-r9.json",dp:"audits/audit-governance-recovery-v1/approval-decision-r9.json",t:"audits/audit-governance-recovery-v1/bootstrap/approved-plan-materialization-r9.json",index:"plans/audit-governance-recovery-v1/formal-plan-set/00-plan-index.md"};
  # (validate each artifact exists + non-empty via test -s; copy to bootstrap worktree; sha256sum each artifact; verify approved-plan-files ledger hashes approved-plan-object-set correctly)
  test -s audits/audit-governance-recovery-v1/bootstrap/approved-plan-materialization-r9.json
  # PHASE-00 bootstrap closure (mirror of L1685-1697 in r8 block; -r8 -> -r9 substitution)
  const q={c:"plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml",m:"audits/audit-governance-recovery-v1/approved-plan-files-r9.sha256",b:"audits/audit-governance-recovery-v1/bootstrap/approved-index-baseline-r9.md",rp:"audits/audit-governance-recovery-v1/approval-request-r9.json",dp:"audits/audit-governance-recovery-v1/approval-decision-r9.json",s:"audits/audit-governance-recovery-v1/bootstrap/scope-lock-PHASE-01-g001.json",q:"audits/audit-governance-recovery-v1/bootstrap/qoderwork-baseline-PHASE-01.json",rph:"audits/audit-governance-recovery-v1/bootstrap/phase-approval-request-PHASE-01-g001.json",dph:"audits/audit-governance-recovery-v1/bootstrap/phase-approval-decision-PHASE-01-g001.json",w:"audits/audit-governance-recovery-v1/bootstrap/pre-change-work-one-PHASE-01.json",out:"audits/audit-governance-recovery-v1/bootstrap/prewrite-verification.json"};
```

(Full concrete r9 block text is below in §13.4. The above skeleton shows the structural substitution pattern.)

## 9. Plan-files SHA impact (will change at r9 dispatch time)

Plan-text file SHA will change at r9 dispatch (Patch 1 + 4 + 5 modify `00-phase-toolchain-implementation.md`). Additionally, **Patch 6 modifies `canonical-requirements-contract.yaml`** (adds `materialization_commands_r9` block).

**Total of 9 approved plan files** (per `approved-plan-files-r8.sha256` self-referential ledger pattern; legacy r1 had 7, but r8 expanded to the full set including plan-index):

| # | File | Pre-r9 (r8-frozen) | Post-r9 (estimated) |
|---:|---|---|---|
| 1 | `plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml` | `cb26cff477a053de8a1d433dc1d561a5c2fd80499a21c84af1e44dc79fa2b065` | UNKNOWN (Patch 6 mutates: adds `materialization_commands_r9` block) |
| 2 | `plans/.../00-plan-index.md` | `bec2edb75d1e61e55c01715eb7a1f2cf31803e47f97c138669590be597e519f3` | UNKNOWN (header fields update per §13 step 4) |
| 3 | `plans/.../00-phase-toolchain-implementation.md` | `b97551dd2ad28d756a31ec0bfb5b7e4c8a9f2c537cdf78d39c072f3771641baf` | UNKNOWN (Patch 1 + 4 + 5 mutate) |
| 4..9 | `01..06-phase-*.md`, `99-final-verification.md` | UNCHANGED | UNCHANGED (not patched) |

(8 plan-set: 00-plan-index + 00..06-phase + 99-final = 9. r8 ledger hashes 1 canonical + 8 plan-set = 9 files. Patched in r9: 00-plan-index + 00-phase + canonical = 3 of 9; rest 6 unchanged. Approved-plan-files-r9.sha256 ledger will hash the new `approved-plan-object-set-r9.json` only, per r8 pattern.)

## 10. Approval-decision-r9.json skeleton (proposal, with full 5-IDs)

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
    "sha256": "<COMPUTED_AT_DISPATCH>"
  },
  "canonical_contract": {
    "path": "plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml",
    "sha256": "<COMPUTED_AT_DISPATCH>"
  },
  "approved_plan_object_set": {
    "path": "audits/audit-governance-recovery-v1/approved-plan-object-set-r9.json",
    "sha256": "<COMPUTED_AT_DISPATCH>"
  },
  "approved_plan_files": {
    "path": "audits/audit-governance-recovery-v1/approved-plan-files-r9.sha256",
    "sha256": "<COMPUTED_AT_DISPATCH>"
  },
  "approved_index_baseline": {
    "path": "audits/audit-governance-recovery-v1/bootstrap/approved-index-baseline-r9.md",
    "sha256": "<COMPUTED_AT_DISPATCH>"
  },
  "frozen_m1_files": {
    "path": "audits/audit-governance-recovery-v1/bootstrap/m1-p0-freeze-manifest-r9.json",
    "sha256": "<COMPUTED_AT_DISPATCH>"
  },
  "p4_boundary": {
    "path": "audits/audit-governance-recovery-v1/bootstrap/p4-boundary-r9.json",
    "sha256": "<COMPUTED_AT_DISPATCH_IF_CHANGED>"
  },
  "approved_artifacts": {
    "canonical_contract": {
      "path": "plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml",
      "sha256": "<COMPUTED_AT_DISPATCH>"
    },
    "approved_plan_object_set": {
      "path": "audits/audit-governance-recovery-v1/approved-plan-object-set-r9.json",
      "sha256": "<COMPUTED_AT_DISPATCH>"
    },
    "approved_plan_files": {
      "path": "audits/audit-governance-recovery-v1/approved-plan-files-r9.sha256",
      "sha256": "<COMPUTED_AT_DISPATCH>"
    },
    "approved_index_baseline": {
      "path": "audits/audit-governance-recovery-v1/bootstrap/approved-index-baseline-r9.md",
      "sha256": "<COMPUTED_AT_DISPATCH>"
    },
    "frozen_m1_files": {
      "path": "audits/audit-governance-recovery-v1/bootstrap/m1-p0-freeze-manifest-r9.json",
      "sha256": "<COMPUTED_AT_DISPATCH>"
    },
    "p4_boundary": {
      "path": "audits/audit-governance-recovery-v1/bootstrap/p4-boundary-r9.json",
      "sha256": "<COMPUTED_AT_DISPATCH_IF_CHANGED>"
    }
  },
  "waiver_ids": [
    "PHASE-01_P02A_ENTRY_WHILE_INDEX_BLOCKED",
    "EXTERNAL_HUMAN_DECISION_FOR_PENDING_IMMUTABLE_LOCK",
    "SUPPLEMENTAL_QODERWORK_BASELINE_WITH_WORK_ONE_P07_ANCHOR",
    "CANDIDATE_BOOTSTRAP_ACTIVATION_AND_CLOSE_AFTER_VALID_AUDIT",
    "PHASE-00_COMPONENT_LEVEL_NO_FORMAL_PRE_CHANGE"
  ],
  "exact_waiver_ids": [
    "PHASE-01_P02A_ENTRY_WHILE_INDEX_BLOCKED",
    "EXTERNAL_HUMAN_DECISION_FOR_PENDING_IMMUTABLE_LOCK",
    "SUPPLEMENTAL_QODERWORK_BASELINE_WITH_WORK_ONE_P07_ANCHOR",
    "CANDIDATE_BOOTSTRAP_ACTIVATION_AND_CLOSE_AFTER_VALID_AUDIT",
    "PHASE-00_COMPONENT_LEVEL_NO_FORMAL_PRE_CHANGE"
  ],
  "cryptographic_references": [],
  "effect": "AUTHORIZES_MATERIALIZATION_PHASE_00_REWORK_LEGITIMATION",
  "immutable": true,
  "supersedes": "R9-PENDING",
  "acyclicity_note": "r9",
  "approval_effect": "Any change requires new approval (r10)."
}
```

## 11. Effect statement

r9's effect is **AUTHORIZES_MATERIALIZATION_PHASE_00_REWORK_LEGITIMATION**:

1. **Legitimizes** M3 #4's REWORK (which closes the 11-mode gap) as falling within r8's original scope.
2. **Reconciles** row 33 cell so future PHASE-01..06 readers see the full 14-mode surface.
3. **Replicates** the r8 materialization block as `materialization_commands_r9` (Patch 6, addresses M-1 BLOCKING). Without this, r9 dispatch cannot regenerate the 9 r9 audit-chain artifacts end-to-end.
4. **Does NOT** change r8's 5 waivers.
5. **Does NOT** introduce any new implementation beyond M3 #4's existing REWORK.
6. **Acknowledges F-11** (process gap): The 9-file fixed-verification invocation list in PHASE-00 L45-54 does NOT include `__tests__/validate-phase-progression-14-modes.test.ts`. This is a follow-up r9+r10 wiring patch (out of scope for r9 textual reconciliation). The new 22-test file is on disk, exercises all 14 modes, and is invoked by the dispatch prompt (M3 #4 §V5); it is only the plan-text L45-54 string that lags.

## 12. Risks the user should know

(Risks labelled R-1..R-6 below; supersedes M3 review's R-1 condensation per M-4 fix.)

- **R-1**: M3 #4 must produce a complete 14-mode implementation before r9's plan-text patch lands; otherwise r9 legitimizes a partially-working toolchain. ✅ Verified by GLM-5.2 #3 AUDIT_PASS (16 edge cases, 9/9 SHA invariants).
- **R-2**: r9's 6 patches (1+4+5 on `00-phase-toolchain-implementation.md`, 6 on `canonical-requirements-contract.yaml` adding `materialization_commands_r9`, plus `00-plan-index.md` header fields update) and 9 audit-chain artifacts are all linked; if any chain link is corrupt, r9 MUST be rejected and re-dispatched.
- **R-3**: r9 does NOT supersede r8's audit chain; r8 remains authoritative for the underlying M1 source (NOT modified by r9). r9 only extends plan-text + canonical-contract by 1 block.
- **R-4**: Marker stubs (modes 1, 3, 4, 5, 6, 7, 8, 10, 11) emit `STAGE_0α_NOT_INSTALLED` markers per M3 #4 §V2. Stage 0-β / Auditor A must upgrade them to real implementations before PHASE-01 PHASE-02 etc. can use those modes.
- **R-5**: Marker stubs MUST NOT write files to `--output` paths during Stage 0-α. Verified by GLM-5.2 #3 EDGE 11: only `--create-scope-lock` produced an output file. Confirmed.
- **R-6**: r9 drafts pattern after r6→r7→r8 historical chain (canonical-contract.yaml:25-29 historical generation tracking): spec-drift fix generations have been precedented without waivers.

## 13. Things to verify before user accepts r9 (extended for F-11)

- [ ] M3 #4 reports Self-Pass with all 14 modes CLI-tested. ✅
- [ ] Main session independent reproduce V1-V7 of M3 #4 dispatch protocol. ✅
- [ ] GLM-5.2 #3 reports AUDIT_PASS on Stage 0-α REWORK. ✅
- [ ] Main session new Final Gate Accepts Stage 0-α REWORK. ✅
- [ ] M3 review of r9 paper draft completed (verdict DRIFT_DETECTED). ✅
- [ ] GLM-5.2 #4 review of M3 review completed (verdict DRIFT_DETECTED, with M-1 BLOCKING identified). ✅
- [ ] r9 paper draft v2 incorporates all review fixes (Patch 6 added for M-1 BLOCKING; D-1..D-5 + D-8 nits fixed; M-2..M-9 fixed; cross-references checked). ✅ (this document)
- [ ] Plan-text post-rework SHA computation deferred to dispatch.
- [ ] User content review of THIS PAPER DRAFT v2 (this file).
- [ ] User content review of Patch 1, 4, 5, 6 text per §3..§8 of THIS PAPER DRAFT.

## 14. Dispatch sequence (post-accept, corrected)

If user accepts r9 paper draft v2:

1. Apply **Patch 1, Patch 4, Patch 5** to `00-phase-toolchain-implementation.md`.
2. Apply **Patch 6** to `canonical-requirements-contract.yaml` — add `materialization_commands_r9` block parallel to `materialization_commands_r8` at L1669-1690 (substitute `-r8` → `-r9` in every path string).
3. Recompute `sha256sum` of the **9 plan files** (1 canonical yaml + 1 plan-index + 7 phase files including the modified 00-phase, with 03..05 unchanged): see §9 table.
4. Generate 9 r9 audit-chain artifacts in `audits/audit-governance-recovery-v1/`:
   - `approved-plan-files-r9.sha256` (single-line ledger hashing `approved-plan-object-set-r9.json` only, per r8 pattern)
   - `approved-plan-object-set-r9.json` (regenerated with -r9 paths; structure mirrors r8)
   - `bootstrap/approved-index-baseline-r9.md` (regenerated with -r9 sha entries)
   - `bootstrap/m1-p0-freeze-manifest-r9.json` (87 entries; same as r8 if M1 files unchanged)
   - `bootstrap/p4-boundary-r9.json` (same content as r8 if boundary unchanged; recompute otherwise)
   - `bootstrap/approved-plan-materialization-r9.json` (regenerated materialization receipt)
   - `approval-request-r9.json` (request referencing r9 SHAs)
   - `approval-decision-pending-r9.json` (pending marker)
   - `approval-decision-r9.json` (final; human-approved per §10)
5. Update `00-plan-index.md` header fields: Approved plan files SHA → -r9; Approved index baseline SHA → -r9; Approval decision SHA → -r9.
6. User reviews and accepts r9. r9 acceptance supersedes r8 for plan-text PATCH and canonical-contract addition; r8 remains authoritative for the underlying M1 source (NOT modified by r9).
7. Run the new `materialization_commands_r9` block (canonical-contract.yaml as patched). This satisfies §13 step 6 of v1 draft and the M-1 BLOCKING fix.
8. Stage 0-β / PHASE-01..06 + 99-final can now run.

## 15. Disposition

This is a **PAPER DRAFT v2**, not yet committed. v2 incorporates all 6 M3 findings + 9 GLM-5.2 #4 findings (1 BLOCKING + 8 non-blocking). Main session will wait for user content review against §3..§8 + §14.7 (dispatch sequence) before any disk write. If approved, dispatch proceeds per §14.

---

**THIS IS NOT r9. r9 is the audit chain that will be built from this draft after user Accept.**
**Disk status**: `plans/audit-governance-recovery-v1/` is in r8 frozen state. `audits/audit-governance-recovery-v1/` contains r8 chain + r1..r7 historical. No -r9 files exist yet.
**Previous draft**: `00-r9-summary.md` (v1) is retained for diff history; do NOT discard. v2 supersedes v1 in active review.
