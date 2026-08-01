# Audit Governance Recovery v1 — v3 PLAN_SET

**Plan mode**: `PLAN_SET`
**Schema version**: `audit-plan-set/v3`
**Document kind**: `plan-set-index`
**Status**: `BLOCKED`
**Admission state**: `P1_R7_PENDING_REFREEZE` (was P1_R6_PENDING_REFREEZE; superseded by 2026-08-01 r7 spec-drift fix: placeholder fill + final-gate flag ownership + generation reference cleanup)
**Progression schema**: `phase-progression/v1`
**Provenance level**: `v3-required`
**Governance profile**: `audit-governance-recovery/v1`
**Canonical contract**: `plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml`
**Canonical contract SHA-256**: `ea07be8357c1f6ee60f48f334c76920d6be2d9f51cdcfe009f0994e5401adcd9`
**Approved plan files**: `audits/audit-governance-recovery-v1/approved-plan-files-r7.sha256`
**Approved plan files SHA-256**: `6221c7ab684908a88fac7f870b66d5701b0a98601104f4ab8b54036c2d5431cf`
**Approved index baseline**: `audits/audit-governance-recovery-v1/bootstrap/approved-index-baseline-r7.md`
**Approved index baseline SHA-256**: `PENDING_R7_SELF_REFERENCE`
**Approval request**: `audits/audit-governance-recovery-v1/approval-request-r7.json`
**Approval request SHA-256**: `NOT_EMBEDDED_ACYCLIC_PENDING_R7` (request hash embedded in decision, not in index)
**Approval decision**: `audits/audit-governance-recovery-v1/approval-decision-r7.json`
**Approval decision SHA-256**: `PENDING_R7_FREEZE`

This projection is not approval authority; only receipt transactions change status.

## 1. Current truth and P0 boundary

| Fact | State | Evidence |
|---|---|---|
| P0 freeze | COMPLETE | `temporary-audits/2026-07-30-path-dynamic-resolution-m1-p0-freeze.md` |
| four old M1 reports | `HISTORICAL_INVALID_NONREPAIRABLE` | current `validate-audit` 4/4 `valid:false` |
| current M1 source | `UNACCEPTED_IMPLEMENTATION_CANDIDATE` | 52 pass/1 fail component aggregate; no valid audits |
| lock graph | CYCLIC | direct PHASE-01 ↔ PHASE-02 lock references; 15 stale approval hashes |
| governance recovery P1 | IN_PROGRESS | r1/r2/r3 rejected; r4 under independent review |
| implementation P2 | BLOCKED | no HUMAN plan or PHASE-01 decision; no Implementer B task |

P0 is observation only; this plan repairs no M1 source or artifact.

## 1.5 P0 preflight — must complete before PHASE-01 admission

Auditor Session A MUST run this preflight before the r7 admission freeze. Each step has a hard-gate check; any failure blocks admission and returns a `STATUS_PUBLICATION_UNAUTHORIZED` verdict (not BLOCKED).

1. **Target worktree exists**: `test -d /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap || { echo "BLOCKED: target worktree missing; run materialization_commands first"; exit 11; }`
2. **9-r7 artifacts present** (the post-revision generation is r7 because the 2026-08-01 r7 spec-drift fix changed canonical/00-index/01-phase/99-final bytes; the r6 path layout becomes r7):
   - `audits/audit-governance-recovery-v1/approved-plan-files-r7.sha256`
   - `audits/audit-governance-recovery-v1/approved-plan-object-set-r7.json`
   - `audits/audit-governance-recovery-v1/bootstrap/approved-index-baseline-r7.md`
   - `audits/audit-governance-recovery-v1/bootstrap/m1-p0-freeze-manifest-r7.json`
   - `audits/audit-governance-recovery-v1/bootstrap/p4-boundary-r7.json`
   - `audits/audit-governance-recovery-v1/bootstrap/approved-plan-materialization-r7.json`
   - `audits/audit-governance-recovery-v1/approval-request-r7.json`
   - `audits/audit-governance-recovery-v1/approval-decision-pending-r7.json`
   - `audits/audit-governance-recovery-v1/approval-decision-r7.json`
3. **PHASE-04 paths declared as TO BE CREATED**: `04-phase` allowed-files 表中每行加 `(CREATE) ` 前缀；不允许 v1 隐含假设 pre-existing。
4. **HUMAN waiver satisfied by r7 approval chain** (r7 supersedes the stale r2→r3→r4 upgrade path): The r7 approval chain (`approval-request-r7.json` → `approval-decision-r7.json` with full `approved_artifacts`) replaces the historical r2/r3/r4 pending upgrade. This gate is satisfied by the existence of `approval-decision-r7.json` with `decision: APPROVED` and non-empty `approved_artifacts`. The legacy `approval-decision-pending-r2.json` remains on disk for traceability but is not part of the r7 admission chain.
5. **Pre-Audit Knowledge Required** (P-02 step 1.5, **PHASE-01 implementer responsibility — not a generation gate**): The PHASE-01 implementer session MUST read 5 mandatory files + write `logs/<YYYY-MM-DD>-pre-audit-read-<implementer-task-id>.md` before PHASE-01 admission. This gate is checked at PHASE-01 entry time, not at generation/admission-freeze time. It is listed here for implementer awareness.
6. **r7 plan-files hash recorded**: `sha256sum plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml plans/audit-governance-recovery-v1/formal-plan-set/*.md` 输出到 `audits/audit-governance-recovery-v1/approved-plan-files-r7.sha256`，与 manifest 字段一致。

## 2. Session and stage boundary

`AUDIT_RECOVERY_STAGE_BOUNDARY: P0_FREEZE>P1_APPROVAL>P2_IMPLEMENT>P3_AUDIT>P4_FINALIZE`

| Stage | Owner/session | Allowed result | Gate |
|---|---|---|---|
| P0 | Auditor A | read-only freeze | complete |
| P1 | Auditor A + HUMAN | canonical/plan/manifest/baseline and two exact decisions | current |
| P2 | separate Implementer B product task | phase-scoped source/doc implementation and self-check only | both exact decisions + PRE_CHANGE |
| P3 | Auditor A | independent EV/findings/report/verdict/progression/status | Implementer stopped |
| P4 | Auditor A; new plan/task | M1 re-baseline or rework | governance final ACCEPT only |

Auditor subagents are read-only. Implementer B cannot author or publish formal audit/progression/status artifacts.

## 3. Two-decision bootstrap and acyclic hashes

Decision 1 binds canonical/manifest/baseline/four waivers and authorizes materialization only. Auditor then freezes PHASE-01 scope/baseline; decision 2 binds them before PRE_CHANGE or writes.

```text
C + six phase files + F99 -> M
B -> C + M + pending-decision-marker
Rplan -> C + M + B
Dplan -> Rplan + C + M + B
S01 -> Dplan + C + PHASE-01
Q01.scalar_scope_sha -> S01
Rphase01 -> Dplan + S01 + Q01
Dphase01 -> Rphase01 + Dplan + S01 + Q01
```

Edges target prerequisites only. Manifest excludes mutable governance artifacts; baseline has no request/self hash. EXCLUDED approvals target stable `Dplan`.

The only waiver IDs are:

```text
PHASE-01_P02A_ENTRY_WHILE_INDEX_BLOCKED
EXTERNAL_HUMAN_DECISION_FOR_PENDING_IMMUTABLE_LOCK
SUPPLEMENTAL_QODERWORK_BASELINE_WITH_WORK_ONE_P07_ANCHOR
CANDIDATE_BOOTSTRAP_ACTIVATION_AND_CLOSE_AFTER_VALID_AUDIT
```

### 3.5 dataflow_pipeline — formal phase-to-phase contract

Each phase has a typed producer/consumer contract. Inputs are read-only at the start; outputs are write-once to the path the next phase consumes. The pipeline enforces the order: scope → entry → approval → pre-change → write → VERDICT → EV → report → progression → status.

| Phase | Producer name | Input artifact | Output artifact | Consumer gate |
|---|---|---|---|---|
| PHASE-01 | `validate-phase-progression.ts --create-scope-lock` | `bootstrap/prewrite-verification.json` | `bootstrap/scope-lock-PHASE-01-g001.json` | PHASE-01 entry admission |
| PHASE-01 | `capture-state.ts --upgrade-bootstrap-pre-change` | dual workspace HEAD | `phases/PHASE-01/g001/pre-change-state.json` | PHASE-01 PRE_CHANGE |
| PHASE-01 | `prepare-audit.ts --bootstrap-activate-and-close PHASE-01` | scope + pre-change + producer release | `phases/PHASE-01/g001/auditor-findings.md` + `prepared/audit-report.md` | PHASE-01 audit gate |
| PHASE-02 | `close-audit-phase.ts --adopt-closure-candidate PHASE-02` | PHASE-01 audit-report + producer release | `phases/PHASE-02/g001/closure-transaction/` | PHASE-02 admission |
| PHASE-02 | `validate-phase-progression.ts --create-scope-lock PHASE-02` | PHASE-01 closed-phase | `phases/PHASE-02/g001/scope-lock-PHASE-02-g001.json` | PHASE-02 PRE_CHANGE |
| PHASE-03..06 | repeated per-phase: scope → entry → approval → pre-change → write → audit → progression | per-phase scope-lock | per-phase audit-report | next phase's scope |
| 99-final | `close-audit-phase.ts --final` | all 6 phase-accepted reports + producer release | `final/g001/{auditor-findings,prepared/audit-report,published/audit-report,verdict-state,pre-change-state}.json` + `progression-receipt` | P4 M1 re-baseline gate |

The dataflow table replaces the informal "phase N depends on phase N-1" prose. Each producer invocation must respect the 8-step PHASE-04 / 02-phase Fixed stage order.

## 4. Mandatory phase order

For PHASE-02..06 the only order is:

1. Auditor creates immutable g001 scope/request with accepted tooling.
2. Entry admission nonzero stops before approval.
3. HUMAN binds that exact request/scope.
4. Auditor captures dual PRE_CHANGE.
5. Implementer B writes allowed files, checks, hands off, and stops.
6. Auditor creates VERDICT/EV/findings/report, requires `valid:true`, and closes.

PHASE-01 uses its two-decision bootstrap transaction. PHASE-02 uses one candidate-adoption transaction. Accepted `close-audit-phase` is mandatory only for PHASE-03..06 and final.

## 5. Requirement ownership

| Phase | Requirements | Primary outcome |
|---|---|---|
| PHASE-01 | 001, 004–010 | foundation, releases, states, EV/report, admission/status, bootstrap close |
| PHASE-02 | 011 | candidate-adopted fail-fast closure |
| PHASE-03 | 002–003 | stable approval and complete artifact DAG |
| PHASE-04 | 012 | executable conformance oracle |
| PHASE-05 | 013 | rules, skills, exact templates |
| PHASE-06 | 014 | truthful docs/log handoff |

## 6. Allowed-file inventory

| Phase | Count | Authoritative file |
|---|---:|---|
| PHASE-01 | 8 | `01-phase-foundation-kernel.md#allowed-files-and-exact-edits` |
| PHASE-02 | 8 | `02-phase-single-closure-entrypoint.md#allowed-files` |
| PHASE-03 | 6 | `03-phase-artifact-dag-validation.md#allowed-files` |
| PHASE-04 | 2 | `04-phase-conformance-enforcement.md#allowed-files` |
| PHASE-05 | 8 | `05-phase-rules-skills-and-templates.md#allowed-files` |
| PHASE-06 | 3 | `06-phase-documentation-and-final-handoff.md#allowed-files` |

Forbidden: M1/work-one writes, old-artifact repair, direct status edits, runtime/live work, unrelated refactors, or Auditor implementation.

## 7. Phase manifest

| Order | Phase ID | File | Depends on | Status |
|---|---|---|---|---|
| 1 | PHASE-01 | `01-phase-foundation-kernel.md` | NONE | NOT_STARTED |
| 2 | PHASE-02 | `02-phase-single-closure-entrypoint.md` | PHASE-01 | NOT_STARTED |
| 3 | PHASE-03 | `03-phase-artifact-dag-validation.md` | PHASE-02 | NOT_STARTED |
| 4 | PHASE-04 | `04-phase-conformance-enforcement.md` | PHASE-03 | NOT_STARTED |
| 5 | PHASE-05 | `05-phase-rules-skills-and-templates.md` | PHASE-04 | NOT_STARTED |
| 6 | PHASE-06 | `06-phase-documentation-and-final-handoff.md` | PHASE-05 | NOT_STARTED |

Any drift, role/order/gate/receipt failure, nonzero command, or Auditor blocker stops progression.

## 8. Size review

Hard limits pass. PHASE-01..05/F99 cross 80% because local closure commands are mandatory; six dependency boundaries avoid added cycles.

### 8.1 gate_count derivation rule

`mutable_projection_registry.phase_updates[*].gate_count` is the count of `- [ ] ` items in that phase's `## Phase completion gate` section, after applying the `gate_text_normalization` rule (see canonical-requirements-contract.yaml `mutable_projection_registry` block). The rule: take the section, keep lines matching `^- \[ \] `, replace each `- [ ] ` with `- [] `, join with LF, append one LF, hash UTF-8. The hash is `gate_text_sha256`. The number of items in the normalized list is `gate_count`.

Why PHASE-02 has 9 (vs 8): PHASE-02's gate has two extra "candidate/accepted adoption distinction" items that PHASE-01 does not have (the candidate staging produces staged bytes only; accepted controller alone adopts and publishes). Why PHASE-03 has 9: PHASE-03's gate has two extra "closed-phase + adjacent status checks" (the "PHASE-04 remains blocked" and "Implementer Session B stops" lines). All other phases have exactly 8 (entry, pre-change, audit, progression, status, typecheck, codegraph, allowed-file diff). The 8 vs 9 difference is structural, not arbitrary.

### 8.2 r7 generation marker

All "*-r6.*" path references in 00-index.md L12-20 header and in canonical-requirements-contract.yaml approval_freeze_registry are now `*-r7.*` because the 2026-08-01 r7 spec-drift fix (filling the three `PENDING_R6_FREEZE` placeholders with real SHA-256 hashes, adding the `verify-final-*` flag descriptions to PHASE-01 step 6, and updating stale r5 generation references across 00-index/01-phase/99-final to r7) changes every plan file's SHA-256. The r1 through r6 freeze artifacts remain in `audits/audit-governance-recovery-v1/` for historical reference but the r7 freeze is the new authoritative generation. The legacy `approved-plan-files.sha256` (r1) and `approval-decision-pending-r2.json` (r2) files remain on disk for traceability but are not part of the r7 admission chain.
