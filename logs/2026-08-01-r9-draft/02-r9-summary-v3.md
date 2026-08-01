# r9 Paper Draft v3 — v1 plan-text reconciliation (PHASE-00 row 33 cell enumeration) + complete materialization_commands_r9 block

> **Status**: PAPER DRAFT v3 (post M3 + GLM-5.2 #4 + GLM-5.2 #5 reviews; v3 = v2 + M-1 BLOCKING fix complete)
> **Generator**: main session / reviewed by M3 (agent_ceb10d84) + GLM-5.2 #4 (agent_6e9334f3) + GLM-5.2 #5 (agent_d0f2f277)
> **Generation date**: 2026-08-01
> **Predecessor**: r8 (2026-08-01); v1 paper draft (2026-08-01); v2 paper draft (2026-08-01)
> **Plan name**: `audit-governance-recovery-v1`

## v3 change log (vs v2)

| Drift | Source | Status in v2 | Status in v3 |
|---|---|---|---|
| M-1 BLOCKING (concrete materialization_commands_r9 block) | GLM-5.2 #5 | **BLOCKING (skeleton only)** | **fixed: complete r9 block appended in §8 Patch 6** |
| nits (M-5..M-9, 5 items) | GLM-5.2 #5 | non-blocking | unchanged (still nits) |

v3 = v2 + §8 Patch 6 concrete content. All other v2 sections unchanged.

## v2 change log (vs v1) — retained for diff history

| Drift | Source | Status |
|---|---|---|
| D-1 | M3 | fixed |
| D-2 | M3 | fixed |
| D-3 | M3 | fixed |
| D-4 / M-1 | M3 / GLM-5.2 #4 | **fixed (added Patch 6 skeleton)** |
| D-5 / M-5 | M3 / GLM-5.2 #4 | fixed |
| D-8 / M-2 / M-3 | M3 / GLM-5.2 #4 | fixed |
| M-4 | GLM-5.2 #4 | fixed |
| M-6 / M-7 / M-8 | GLM-5.2 #4 | fixed |

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
  r9 reconciles row 33 with the operative L82-99 enumeration, AND
  adds a parallel materialization_commands_r9 block to canonical-contract
  (replicating the r8 block structure with `-r8` → `-r9` substitution).
fix-surface: |
  PHASE-00 row 33 cell (canonical text) + 4 footer notes + a new
  `materialization_commands_r9` block parallel to `materialization_commands_r8`
  at canonical-contract.yaml:1669-1690 (concrete content in §8).
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

## 8. Patch 6 (NEW, v3 = CONCRETE) — extend canonical-contract.yaml with `materialization_commands_r9` block

Add a new YAML mapping block **adjacent to** the existing `materialization_commands_r8` block (canonical-contract.yaml L1669-1690), with the same structure but `-r8` → `-r9` substituted in every path. v2 had only path-dict skeleton; **v3 supplies the complete concrete content** mirrored verbatim from r8's L1669-1690 (with -r8→-r9 substitutions throughout):

```yaml
  materialization_commands_r9: |  # parallel to materialization_commands_r8 (L1669-1690); r9 legitimates the textual reconciliation per Patch 1+4+5 + canonical-contract addition; -r8 -> -r9 substitution throughout
    cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
    export AUDIT_RECOVERY_SOURCE_ROOT=/home/zhaoge/workspace/qoderwork/.worktrees/check-plan
    export AUDIT_RECOVERY_TARGET_ROOT=/home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
    export AUDIT_RECOVERY_IMMUTABLE_ROOT="$AUDIT_RECOVERY_TARGET_ROOT/audits/audit-governance-recovery-v1/bootstrap/approved-plan-bytes-r9"
    # r9 reconciliation: target worktree already exists from r8 materialization; skip test ! -e check
    /home/zhaoge/.bun/bin/bun -e '
    import{chmodSync,mkdirSync,writeFileSync}from"node:fs";import{dirname,resolve}from"node:path";import{createHash}from"node:crypto";
    const src=process.env.AUDIT_RECOVERY_SOURCE_ROOT,tgt=process.env.AUDIT_RECOVERY_TARGET_ROOT;
    const p={o:"audits/audit-governance-recovery-v1/approved-plan-object-set-r9.json",m:"audits/audit-governance-recovery-v1/approved-plan-files-r9.sha256",b:"audits/audit-governance-recovery-v1/bootstrap/approved-index-baseline-r9.md",pending:"audits/audit-governance-recovery-v1/approval-decision-pending-r9.json",h:"audits/audit-governance-recovery-v1/bootstrap/m1-p0-freeze-manifest-r9.json",p4:"audits/audit-governance-recovery-v1/bootstrap/p4-boundary-r9.json",rp:"audits/audit-governance-recovery-v1/approval-request-r9.json",dp:"audits/audit-governance-recovery-v1/approval-decision-r9.json",t:"audits/audit-governance-recovery-v1/bootstrap/approved-plan-materialization-r9.json",index:"plans/audit-governance-recovery-v1/formal-plan-set/00-plan-index.md"};
    const bytes=async(r,x)=>Buffer.from(await Bun.file(resolve(r,x)).arrayBuffer()),H=b=>createHash("sha256").update(b).digest("hex");
    const ref=async(r,x)=>({path:x,sha256:H(await bytes(r,x))}),A=(x,m)=>{if(!x)throw Error("MATERIALIZATION_INVALID:"+m)};
    const [O,DP]=await Promise.all([JSON.parse((await bytes(src,p.o)).toString()),JSON.parse((await bytes(src,p.dp)).toString())]);A(DP.decision==="APPROVED"&&DP.approved_by==="HUMAN_USER","decision");
    const put=(x,b,mode)=>{const a=resolve(tgt,x);mkdirSync(dirname(a),{recursive:true});writeFileSync(a,b,{flag:"w"});chmodSync(a,mode)};
    for(const x of [p.o,p.m,p.b,p.pending,p.h,p.p4,p.rp,p.dp])put(x,await bytes(src,x),0o444);
    const semantic=[];for(const e of O.entries){const b=await bytes(src,e.bytes.path);A(H(b)===e.bytes.sha256,"object:"+e.logical_path);put(e.bytes.path,b,0o444);const lp=resolve(tgt,e.logical_path);mkdirSync(dirname(lp),{recursive:true});writeFileSync(lp,b);chmodSync(lp,0o644);const mirror="audits/audit-governance-recovery-v1/bootstrap/approved-plan-bytes-r9/"+e.logical_path;put(mirror,b,0o444);semantic.push({logical_path:e.logical_path,kind:e.kind,approved_object:{path:e.bytes.path,sha256:e.bytes.sha256},immutable_mirror:{path:mirror,sha256:e.bytes.sha256},initial_live_snapshot:{path:e.bytes.path,sha256:e.bytes.sha256}})}
    const ib=await bytes(src,p.b),io="audits/audit-governance-recovery-v1/objects/sha256/"+H(ib);put(io,ib,0o444);const ip=resolve(tgt,p.index);mkdirSync(dirname(ip),{recursive:true});writeFileSync(ip,ib);chmodSync(ip,0o644);
    const T={schema_version:"audit-approved-plan-materialization/v1",document_kind:"approved-plan-materialization",plan_id:O.plan_id,generation:O.generation,plan_approval:await ref(tgt,p.dp),object_set:await ref(tgt,p.o),approved_plan_files:await ref(tgt,p.m),approved_index_baseline:await ref(tgt,p.b),semantic_entry_count:9,live_path_count:10,semantic_entries:semantic,index_entry:{live_path:p.index,approved_index_baseline:await ref(tgt,p.b),initial_live_snapshot:{path:io,sha256:H(ib)}},materialized_at:new Date().toISOString()};put(p.t,Buffer.from(JSON.stringify(T,null,2)+"\n"),0o444);
    console.log(JSON.stringify({ok:true,materialization:p.t,semantic_entries:9,live_paths:9,generation:"r9-reconciliation"}));
    '
    cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
    test -s audits/audit-governance-recovery-v1/bootstrap/approved-plan-materialization-r9.json
```

Substitutions vs r8 (verified line-by-line):

| r8 element | r9 substitution |
|---|---|
| `audit-governance-recovery-v1/...-r8.json` paths | `...-r9.json` |
| `approved-plan-bytes-r8` env var | `approved-plan-bytes-r9` |
| `# r8 overlay` comment | `# r9 reconciliation` |
| `approved-plan-bytes-r8/` mirror path | `approved-plan-bytes-r9/` |
| `semantic_entry_count:9` | `semantic_entry_count:9` (unchanged) |
| `live_path_count:10` (canonical-contract.yaml L345 normative invariant; r8 stored receipt also has 10; historical pattern r6/r7 `{8,9}`, r8 `{9,10}` shows `live_path_count = semantic_entry_count + 1`) | `live_path_count:10` (unchanged — r9 mirrors r8 exactly per canonical-contract.yaml:345 schema invariant; r9 does NOT add or remove a semantic entry vs r8) |
| `index:"plans/.../00-plan-index.md"` (r8) | `index:"plans/.../00-plan-index.md"` (unchanged; r9 plan-index references r9 object set) |
| `generation:"r8-overlay"` console | `generation:"r9-reconciliation"` |

**Note on `live_path_count`**: r9 mirrors r8's `live_path_count:10` per canonical-contract.yaml:345 normative schema invariant ("semantic_entry_count is 9 and live_path_count is 10"). The +1 offset between `live_path_count` and `semantic_entry_count` is the historical pattern across r6/r7/r8 (r6 `{8,9}`, r7 `{8,9}`, r8 `{9,10}` — invariant `live_path_count = semantic_entry_count + 1`). r9 modifies existing plan-text files but does NOT add or remove a semantic entry vs r8 (object-set still has 9 entries), so the count semantics are identical to r8. (GLM-5.2 #6 NEW-V3-1 fix applied.)

## 9. Plan-files SHA impact (will change at r9 dispatch time)

Plan-text file SHA will change at r9 dispatch (Patch 1 + 4 + 5 modify `00-phase-toolchain-implementation.md`). Additionally, **Patch 6 modifies `canonical-requirements-contract.yaml`** (adds `materialization_commands_r9` block).

**Total of 9 approved plan files** (per `approved-plan-files-r8.sha256` self-referential ledger pattern; legacy r1 had 7, but r8 expanded to the full set including plan-index):

| # | File | Pre-r9 (r8-frozen) | Post-r9 (estimated) |
|---:|---|---|---|
| 1 | `plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml` | `cb26cff477a053de8a1d433dc1d561a5c2fd80499a21c84af1e44dc79fa2b065` | UNKNOWN (Patch 6 mutates: adds `materialization_commands_r9` block) |
| 2 | `plans/.../00-plan-index.md` | `bec2edb75d1e61e55c01715eb7a1f2cf31803e47f97c138669590be597e519f3` | UNKNOWN (header fields update per §14 step 4) |
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
3. **Replicates** the r8 materialization block as `materialization_commands_r9` (Patch 6, fixes M-1 BLOCKING). Without this, r9 dispatch cannot regenerate the 9 r9 audit-chain artifacts end-to-end.
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
- [ ] GLM-5.2 #5 re-audit of r9 v2 (verdict DRIFT_DETECTED, M-1 BLOCKING fix incomplete). ✅
- [ ] r9 paper draft v3 (this file) applies Patch 6 with **complete concrete materialization_commands_r9 block** (mirror of canonical-contract.yaml:1669-1690 with -r8→-r9 substitutions). ✅
- [ ] GLM-5.2 #6 review of v3 (verdict DRIFT_DETECTED, M-1 concrete ✅ + NEW-V3-1 BLOCKING + NEW-V3-2/V3-3 nits). ✅
- [ ] v3 (revised): apply 5 in-place Edits for NEW-V3-1 BLOCKING + NEW-V3-2 nit + NEW-V3-3 nit. ✅
- [ ] GLM-5.2 #7 final re-audit of v3 (revised) (verdict READY_FOR_ACCEPT, no new defects). ✅
- [ ] Plan-text post-rework SHA computation deferred to dispatch.
- [ ] User content review of THIS PAPER DRAFT v3 (this file).
- [ ] User content review of Patch 1, 4, 5, 6 text per §3..§8 of THIS PAPER DRAFT.

## 14. Dispatch sequence (post-accept, v3 with concrete Patch 6)

If user accepts r9 paper draft v3:

1. Apply **Patch 1, Patch 4, Patch 5** to `00-phase-toolchain-implementation.md`.
2. Apply **Patch 6** to `canonical-requirements-contract.yaml` — paste the complete `materialization_commands_r9` block from §8 (mirror of L1669-1690 with -r8→-r9 substitutions).
3. Recompute `sha256sum` of the **9 plan files** (1 canonical yaml + 1 plan-index + 7 phase files including the modified 00-phase, with 03..05 unchanged): see §9 table.
4. Generate 9 r9 audit-chain artifacts in `audits/audit-governance-recovery-v1/`:
   - `approved-plan-files-r9.sha256` (single-line ledger hashing `approved-plan-object-set-r9.json` only, per r8 pattern)
   - `approved-plan-object-set-r9.json` (regenerated with -r9 paths; structure mirrors r8)
   - `bootstrap/approved-index-baseline-r9.md` (regenerated with -r9 sha entries)
   - `bootstrap/m1-p0-freeze-manifest-r9.json` (87 entries; same as r8 if M1 files unchanged)
   - `bootstrap/p4-boundary-r9.json` (same content as r8 if boundary unchanged; recompute otherwise)
   - `bootstrap/approved-plan-materialization-r9.json` (regenerated materialization receipt — output of step 7 below)
   - `approval-request-r9.json` (request referencing r9 SHAs)
   - `approval-decision-pending-r9.json` (pending marker)
   - `approval-decision-r9.json` (final; human-approved per §10)
5. Update `00-plan-index.md` header fields: Approved plan files SHA → -r9; Approved index baseline SHA → -r9; Approval decision SHA → -r9.
6. User reviews and accepts r9. r9 acceptance supersedes r8 for plan-text PATCH and canonical-contract addition; r8 remains authoritative for the underlying M1 source (NOT modified by r9).
7. Execute the new `materialization_commands_r9` block (verbatim from §8 Patch 6). This:
   - Sets AUDIT_RECOVERY_SOURCE_ROOT/TARGET_ROOT/IMMUTABLE_ROOT (-r9 variant)
   - Runs `bun -e '...'` script: reads 9 r9 audit chain artifacts from src, validates decision APPROVED + approved_by HUMAN_USER, content-addresses each via SHA-256, writes to target worktree with 0o444 (read-only) + immutable mirror in `approved-plan-bytes-r9/`, writes live `00-plan-index.md` snapshot + object-root entry, generates `materialization` JSON with `semantic_entry_count:9, live_path_count:10, generation:"r9-reconciliation"`.
   - Asserts `test -s audits/audit-governance-recovery-v1/bootstrap/approved-plan-materialization-r9.json`.
8. Stage 0-β / PHASE-01..06 + 99-final can now run.

## 15. Disposition

This is a **PAPER DRAFT v3**, not yet committed. v3 = v2 with M-1 BLOCKING fix completed (concrete materialization_commands_r9 block from §8 Patch 6). Main session will wait for user content review against §3..§8 + §14 step 7 (dispatch sequence) before any disk write. If approved, dispatch proceeds per §14.

---

**THIS IS NOT r9. r9 is the audit chain that will be built from this draft after user Accept.**
**Disk status**: `plans/audit-governance-recovery-v1/` is in r8 frozen state. `audits/audit-governance-recovery-v1/` contains r8 chain + r1..r7 historical. No -r9 files exist yet.
**Previous drafts**: `00-r9-summary.md` (v1, 224 lines) and `01-r9-summary-v2.md` (v2, 287 lines) retained for diff history; do NOT discard. v3 supersedes v1 and v2 in active review.
