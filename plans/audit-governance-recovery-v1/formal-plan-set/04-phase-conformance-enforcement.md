# Phase PHASE-04: Executable governance conformance enforcement

**Phase ID**: `PHASE-04`
**Depends on**: `PHASE-03`
**Outcome**: One table-driven CLI mechanically checks every active governance surface without treating unreadable input as a successful negative search.
**Evidence level**: `file-integration`
**Progression status**: `NOT_STARTED`
**Completion receipt**: `N/A`

## Goal

Implement `REQ-GR-012` and freeze PHASE-05's query/error table.

## Starting state and admission

1. PHASE-01..03 are `ACCEPTED`.
2. Auditor freezes g001; entry nonzero stops before HUMAN approval and PRE_CHANGE.
3. Only then may distinct Implementer B write.

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
/home/zhaoge/.bun/bin/bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts \
  plans/audit-governance-recovery-v1/formal-plan-set PHASE-04
```

Any missing/nonzero prerequisite is `BLOCKED`.

## Allowed files

**PHASE-04 is the FIRST phase to introduce the conformance scripts. Both files below are CREATED by PHASE-04 — they do NOT pre-exist on disk before this phase begins.** The `(CREATE)` prefix is a hard marker that the file is a creation target, not a pre-existing file. Any v1 implementer who assumes either file already exists is in violation of DEC-GR-014 "after PRE_CHANGE then implement" and the producer_release_registry's `PHASE-04.add_paths` set (which declares the two paths as additions, not inheritances).

| Step | Status | Exact path | Symbol/anchor |
|---:|:---:|---|---|
| 1 | (CREATE) | `scripts/check-audit-governance-recovery-conformance.ts` | add `QUERY_REGISTRY`, `readSurface`, `evaluateQuery`, `runConformance`, CLI |
| 2 | (CREATE) | `scripts/__tests__/check-audit-governance-recovery-conformance.test.ts` | add `makeAllPassTree`, one-query mutations, ordering/root cases |

No other file is permitted in this phase. Both files are CREATED in PHASE-04 only; the path placeholders in the table above (the two `scripts/...` paths) are NOT in the workspace today and must NOT be treated as pre-existing.

## Forbidden behavior

- No governance surface/validator/plan/M1/work-one change.
- Each query reads its file and reports `READ_ERROR|PRESENT|ABSENT`; unavailable input never passes and failures stay table-ordered.

## Fixed CLI contract

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
bun run scripts/check-audit-governance-recovery-conformance.ts \
  --repository-root /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap \
  --profile governance-surfaces
```

Only registered repository-relative paths resolve. Any failed check exits nonzero:

```json
{"schema_version":"audit-governance-conformance/v1","ok":false,"checks":[],"failedChecks":[]}
```

Each check records ID, surface, query, expected/observed tri-state, and registered error.

## Exact query registry

`kind` is `LITERAL`, `REGEX_ABSENT`, `JSON_EQ`, `JSON_EXISTS`, `COUNT_EQ`, or `LINE_COUNT_MAX`; regex flags are `imu`.

| IDs | Exact surface | Required queries | Forbidden queries | Owning failure |
|---|---|---|---|---|
| A01–A07 | `AGENTS.md` | `LITERAL:audit-governance-recovery/v1`; `LITERAL:AUDITOR_SESSION_A`; `LITERAL:IMPLEMENTER_SESSION_B`; `LITERAL:AUDIT_RECOVERY_STAGE_BOUNDARY: P0_FREEZE>P1_APPROVAL>P2_IMPLEMENT>P3_AUDIT>P4_FINALIZE`; `LITERAL:PHASE-01_P02A_ENTRY_WHILE_INDEX_BLOCKED` | `REGEX_ABSENT:v2\\.1-required`; `REGEX_ABSENT:manual(?:ly)?[^\\n]{0,40}(?:sha|hash)[^\\n]{0,40}(?:sync|update)` | `CONFORMANCE_RECOVERY_PROFILE` |
| S01–S06 | `.agents/skills/plan-audit-archiver/SKILL.md` | `LITERAL:ROLE_OWNER:AUDITOR_SESSION_A`; `LITERAL:ROLE_OWNER:IMPLEMENTER_SESSION_B`; `LITERAL:MECHANICAL_PRODUCER_REQUIRED`; `LITERAL:close-audit-phase` | `REGEX_ABSENT:cp\\s+.*audit-report`; `REGEX_ABSENT:IMPLEMENTER_SESSION_B[^\\n]{0,80}(?:publish|edit).*audit-report` | `CONFORMANCE_SESSION_BOUNDARY` |
| P01–P07 | `.agents/skills/plan-audit-archiver/provenance-rules.md` | `LITERAL:EXTERNAL_HUMAN_DECISION_FOR_PENDING_IMMUTABLE_LOCK`; `LITERAL:SCOPE_LOCK_GENERATION`; `LITERAL:ARTIFACT_DAG`; `LITERAL:CANDIDATE_BOOTSTRAP_ACTIVATION_AND_CLOSE_AFTER_VALID_AUDIT`; `LITERAL:scope_lock -> phase_approval: FORBIDDEN` | `REGEX_ABSENT:--freeze`; `REGEX_ABSENT:approval_receipt[^\\n]{0,120}scope-lock` | `CONFORMANCE_ARTIFACT_DAG` |
| D01–D07 | `.agents/skills/deterministic-implementation-planning/SKILL.md` | `LITERAL:ENTRY_ADMISSION_BEFORE_PHASE_APPROVAL`; `LITERAL:PRE_CHANGE_AFTER_PHASE_APPROVAL`; `LITERAL:STAGED_FINAL_VALIDATION`; `LITERAL:RECEIPT_ONLY_STATUS_PUBLICATION`; `LITERAL:FULL_PLAN_MANIFEST_ADMISSION` | `REGEX_ABSENT:presence-only completion`; `REGEX_ABSENT:manual status` | `CONFORMANCE_STATUS_SYNC` |
| T01–T06 | `.agents/skills/plan-audit-archiver/templates/scope-lock-template.json` | `JSON_EQ:$.schema_version=audit-scope-lock/v3`; `JSON_EQ:$.governance_profile=audit-governance-recovery/v1`; `JSON_EXISTS:$.plan_approval.path`; `JSON_EXISTS:$.plan_approval.sha256`; `JSON_EXISTS:$.session_roles.path`; `JSON_EXISTS:$.producer_release.path` | — | `CONFORMANCE_MECHANICAL_PRODUCER` |
| E01–E10 | `.agents/skills/plan-audit-archiver/templates/evidence-receipt-template.json` | `JSON_EQ:$.schema_version=audit-evidence-receipt/v3`; `JSON_EQ:$.governance_profile=audit-governance-recovery/v1`; `JSON_EXISTS:$.execution.observed`; `JSON_EXISTS:$.execution.exit_code`; `JSON_EXISTS:$.execution.timed_out`; `JSON_EXISTS:$.domain_observation.result`; `JSON_EXISTS:$.domain_observation.error_code`; `JSON_EXISTS:$.pre_change_state.path`; `JSON_EXISTS:$.verdict_state.path`; `JSON_EXISTS:$.producer_release.path` | — | `CONFORMANCE_DUAL_WORKSPACE` |
| R01–R04 | `.agents/skills/plan-audit-archiver/templates/audit-report-template.md` | `LITERAL:<!-- GENERATED_FROM_AUDIT_REPORT_CONTRACT -->`; `LITERAL:Contract:`; `LITERAL:Auditor findings source:` | `REGEX_ABSENT:MANUALLY_BOUND_STRUCTURAL_REFERENCE` | `CONFORMANCE_CLOSURE` |
| V01–V07 | `.agents/skills/plan-audit-archiver/templates/phase-projection-template.json` | `JSON_EQ:$.schema_version=phase-projection/v1`; `JSON_EQ:$.governance_profile=audit-governance-recovery/v1`; `JSON_EXISTS:$.phase_id`; `JSON_EXISTS:$.audit_report.path`; `JSON_EXISTS:$.audit_report_contract.path`; `JSON_EXISTS:$.phase_approval.path`; `JSON_EXISTS:$.verdict_state.path` | — | `CONFORMANCE_HISTORICAL_BOUNDARY` |
| I01–I08 | `documents/INDEX.md` | START/END once; links/authority; state-coupled pending or final marker/status exactly matches plan index `Status` | opposite-state marker or mixed pending/final text absent | `DOC_STATUS_PREMATURE_OR_MISSING` |
| I09–I18 | `logs/2026-07-30-audit-governance-recovery-implementation.md` | pending state; PHASE-01/06; level; roles; M1 boundary; final gate; updated-doc heading; `LINE_COUNT_MAX:20` | `REGEX_ABSENT:FINAL_ACCEPTED` | `IMPLEMENTATION_LOG_CONTRACT` |
| I19–I20 | `logs/INDEX.md` | implementation log `COUNT_EQ:1` in active section and `COUNT_EQ:1` in governance section | — | `LOG_INDEX_CONTRACT` |

Profiles: `governance-surfaces` runs A/S/P/D/T/E/R/V; `implementation-docs` runs I; `all` runs both, in ID order. JSON paths use own-properties; duplicate keys/discriminators fail.

## Check Registry

| Check | PASS condition | Failure behavior |
|---|---|---|
| `rootExact` | exact repository root | nonzero; no fallback |
| `profileExact` | one of three profiles | nonzero; no fallback |
| `surfaceReadable` | readable/nonempty | owning error |
| `requiredMarkers` | each query is `PRESENT` | owning error |
| `forbiddenMarkers` | each query is `ABSENT` | owning/stale error |
| `templateDiscriminator` | exactly one expected discriminator | owning `CONFORMANCE_*` |
| `orderedFailures` | output follows table/query order | test failure |
| `oneMutationOneFailure` | isolated mutation yields exactly one expected ID | test failure |

## Fixture matrix

| Test ID | Fixture/mutation | Expected |
|---|---|---|
| `DC-GR4-012-P` | complete eight-surface tree | `DOMAIN_RESULT=PASS`; `ok:true` |
| `GR5-002` | remove one required marker | exactly its owning check |
| `DC-GR4-012-N` | one stale marker | `DOMAIN_ERROR=CONFORMANCE_STALE_TEXT` only |
| `GR5-004` | make one surface unreadable | exactly its owning check; never ABSENT PASS |
| `GR5-005` | delete one surface | exactly its owning check |
| `GR5-006` | corrupt one JSON template | exactly its owning check |
| `GR5-007` | add two failures in reverse filesystem order | canonical ordered output |
| `GR5-008` | pass a parent/child fallback root | nonzero; no path substitution |
| `DC-GR5-013-N` | stale governance surface | `DOMAIN_ERROR=CONFORMANCE_STALE_TEXT` only |
| `GR4-009` | complete implementation-doc tree | docs profile `ok:true` |
| `DC-GR6-014-N` | premature document marker only | `DOMAIN_ERROR=DOC_STATUS_PREMATURE_OR_MISSING` only |
| `GR4-011` | final index plus final document markers | docs/all profiles `ok:true` |

PHASE-04 validates only the verifier fixtures. Real-surface conformance stays `NOT-RUN` until PHASE-05 updates all eight files.

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
/home/zhaoge/.bun/bin/bun test scripts/__tests__/check-audit-governance-recovery-conformance.test.ts
/home/zhaoge/.bun/bin/bun run typecheck
git diff --check
```

Evidence includes exits/counts, fixture JSON, failure order, CodeGraph/fallback impact, and allowed diff. Failure is `BLOCKED`.

## Auditor closure commands

After Implementer B stops, Auditor A runs:

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
export AUDIT_RECOVERY_PHASE_DIR=audits/audit-governance-recovery-v1/phases/PHASE-04/g001
export AUDIT_RECOVERY_RELEASE=audits/audit-governance-recovery-v1/producer-releases/PHASE-04-g001.json
bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts \
  --emit-producer-release --canonical plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml \
  --case-set PHASE-04 --object-root audits/audit-governance-recovery-v1/objects/sha256 --output "$AUDIT_RECOVERY_RELEASE"
bun run .agents/skills/plan-audit-archiver/scripts/capture-state.ts --state-kind VERDICT \
  --qoderwork-root /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap \
  --work-one-root /home/zhaoge/workspace/opencode/work-one \
  --scope-lock "$AUDIT_RECOVERY_PHASE_DIR/scope-lock-PHASE-04-g001.json" \
  --phase-approval "$AUDIT_RECOVERY_PHASE_DIR/phase-approval-decision-PHASE-04-g001.json" \
  --session-roles audits/audit-governance-recovery-v1/session-role-manifest.json \
  --producer-release "$AUDIT_RECOVERY_RELEASE" --output "$AUDIT_RECOVERY_PHASE_DIR/verdict-state.json"
```

Auditor A independently sweeps and writes only
`audits/audit-governance-recovery-v1/phases/PHASE-04/g001/auditor-findings.md`; a blocker stops.

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap
export AUDIT_RECOVERY_PHASE_DIR=audits/audit-governance-recovery-v1/phases/PHASE-04/g001
export AUDIT_RECOVERY_RELEASE=audits/audit-governance-recovery-v1/producer-releases/PHASE-04-g001.json
bun run .agents/skills/plan-audit-archiver/scripts/generate-evidence-receipt.ts \
  --audit-id AUDIT-GOVERNANCE-RECOVERY-PHASE-04-g001 \
  --canonical plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml --generate-case-set PHASE-04 \
  --scope-lock "$AUDIT_RECOVERY_PHASE_DIR/scope-lock-PHASE-04-g001.json" \
  --phase-approval "$AUDIT_RECOVERY_PHASE_DIR/phase-approval-decision-PHASE-04-g001.json" \
  --pre-change "$AUDIT_RECOVERY_PHASE_DIR/pre-change-state.json" --verdict-state "$AUDIT_RECOVERY_PHASE_DIR/verdict-state.json" \
  --producer-release "$AUDIT_RECOVERY_RELEASE" --output-dir "$AUDIT_RECOVERY_PHASE_DIR/evidence"
bun run .agents/skills/plan-audit-archiver/scripts/prepare-audit.ts \
  --scope-lock "$AUDIT_RECOVERY_PHASE_DIR/scope-lock-PHASE-04-g001.json" \
  --phase-approval "$AUDIT_RECOVERY_PHASE_DIR/phase-approval-decision-PHASE-04-g001.json" \
  --auditor-findings "$AUDIT_RECOVERY_PHASE_DIR/auditor-findings.md" --evidence-dir "$AUDIT_RECOVERY_PHASE_DIR/evidence" \
  --pre-change "$AUDIT_RECOVERY_PHASE_DIR/pre-change-state.json" --verdict-state "$AUDIT_RECOVERY_PHASE_DIR/verdict-state.json" \
  --producer-release "$AUDIT_RECOVERY_RELEASE" --object-root audits/audit-governance-recovery-v1/objects/sha256 \
  --output-dir "$AUDIT_RECOVERY_PHASE_DIR/prepared"
bun run .agents/skills/plan-audit-archiver/scripts/validate-audit.ts "$AUDIT_RECOVERY_PHASE_DIR/prepared/audit-report.md"
bun run .agents/skills/plan-audit-archiver/scripts/close-audit-phase.ts \
  --workspace-root /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap \
  --plan-root plans/audit-governance-recovery-v1/formal-plan-set --phase PHASE-04 \
  --prepared-report "$AUDIT_RECOVERY_PHASE_DIR/prepared/audit-report.md" \
  --published-report "$AUDIT_RECOVERY_PHASE_DIR/published/audit-report.md" \
  --scope-lock "$AUDIT_RECOVERY_PHASE_DIR/scope-lock-PHASE-04-g001.json" \
  --phase-approval "$AUDIT_RECOVERY_PHASE_DIR/phase-approval-decision-PHASE-04-g001.json" \
  --session-roles audits/audit-governance-recovery-v1/session-role-manifest.json \
  --pre-change "$AUDIT_RECOVERY_PHASE_DIR/pre-change-state.json" --verdict-state "$AUDIT_RECOVERY_PHASE_DIR/verdict-state.json" \
  --producer-release "$AUDIT_RECOVERY_RELEASE" --session-role AUDITOR \
  --transaction-dir "$AUDIT_RECOVERY_PHASE_DIR/closure-transaction"
```

Every command exits 0; `validate-audit` returns `valid:true, errors:[], verdict:ACCEPT`. Otherwise stop.

## Phase completion gate

- [ ] Only the two allowed files changed.
- [ ] Every surface/marker pair is table-driven and independently queried.
- [ ] Read errors cannot satisfy negative checks.
- [ ] Every isolated mutation yields exactly one stable failure.
- [ ] Failure ordering is deterministic.
- [ ] Fixed tests, typecheck, and diff check pass.
- [ ] Auditor Session A independently audits and publishes PHASE-04 `ACCEPT`.
- [ ] Active-surface conformance remains `NOT-RUN` until PHASE-05.
