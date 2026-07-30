# Phase PHASE-03: Stable approval and complete artifact DAG validation

**Phase ID**: `PHASE-03`
**Depends on**: `PHASE-02`
**Outcome**: Every registered governance reference is type-checked, hash-checked, and cycle-checked before audit semantics.
**Evidence level**: `file-integration`
**Progression status**: `NOT_STARTED`
**Completion receipt**: `N/A`

## Goal

- Implement `REQ-GR-002` and `REQ-GR-003`.
- Prove the approval/index/scope/receipt graph is acyclic and accepts both JSON and registered byte artifacts.
- Respect the cross-phase activation field ownership rule declared in `canonical-requirements-contract.yaml`: each phase owns its own `phase_NN_activation_additions` block; PHASE-03 does NOT mutate `phase_06_activation_additions.documents_status_marker` (that field is exclusive to PHASE-06; see canonical L1172-1181 and the post-revision `phase_06_activation_additions` block). PHASE-03 only mutates the `phase_03_activation_additions` fields. This eliminates the historical finding that the projection snapshot for PHASE-06 was not declared exclusively.

## Starting state and admission

1. PHASE-01 and PHASE-02 are `ACCEPTED`; accepted wrapper use is mandatory.
2. Auditor A creates immutable PHASE-03 scope.
3. Auditor A runs P-02A entry admission; nonzero stops before approval.
4. HUMAN approves that exact scope; Auditor A captures dual PRE_CHANGE.
5. Only then may a distinct Implementer B task write.

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1
/home/zhaoge/.bun/bin/bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts \
  plans/audit-governance-recovery-v1/formal-plan-set PHASE-03
```

Any missing/nonzero prerequisite is `BLOCKED`.

## Allowed files

| Step | Exact path | Symbol/anchor |
|---:|---|---|
| 1 | `scripts/lib/audit-governance-schema-v3.ts` | `GovernanceNodeKind`, `parseGovernanceNode`, exact discriminator dispatch |
| 2 | `scripts/lib/__tests__/audit-governance-schema-v3.test.ts` | one all-pass node per kind plus isolated parser failures |
| 3 | `scripts/lib/artifact-reference-graph.ts` | add `EDGE_REGISTRY`, `buildArtifactGraph`, `validateEdges`, `kahnSort` |
| 4 | `scripts/lib/__tests__/artifact-reference-graph.test.ts` | canonical all-pass graph plus edge/cycle/completeness mutations |
| 5 | `.agents/skills/plan-audit-archiver/scripts/validate-audit.ts` | call graph validation before semantic checks; stable EXCLUDED target rule |
| 6 | `.agents/skills/plan-audit-archiver/scripts/__tests__/validate-audit.test.ts` | add full-bundle integration and graph-error isolation |

No other file is permitted in this phase.

## Forbidden behavior

- No scope/session/state/status/closure/evidence/report producer, rule, skill, template, index/log, M1, or work-one change.
- No cross-lock approval target, lock-to-decision back-edge, hash synchronization, or in-place generation edit.
- No schema-parse-only PASS and no unregistered generic `inputs` edge.
- No JSON discriminator requirement for a registered Markdown/text manifest; byte artifacts use their own parser contract.

## Fixed graph contract

### Node parsers

| Node class | Kinds | Validation |
|---|---|---|
| YAML | canonical requirements | YAML parse plus exact discriminator/profile |
| JSON | plan request/decision/pending, phase request/decision, scope, legacy bootstrap receipt, session, dual state, release, EV, report contract, phase projection, phase/final progression, projection snapshot, status, activation, closure | JSON parse plus exact discriminator/profile |
| Markdown | approved index baseline, phase, final verification, audit report, Auditor findings | nonempty bytes plus kind-specific anchors |
| checksum manifest | approved-plan-files | strict `64hex two-spaces relative-path` lines, unique paths, each hash resolves |
| bytes | released tool/dependency and immutable projection-copy files | readable nonempty bytes with exact path/SHA |

Read failure, parse failure, discriminator failure, or hash mismatch is not an absent edge and cannot pass.

The PHASE-01-only legacy parser accepts current `schema_version="audit-evidence-receipt/v3"`, `document_kind="evidence-receipt"`, `repository_realpath`, `phase_id`, `head`, `captured_at`, `status_entries`, and scalar `scope_lock_sha256`. It correlates the scalar to the target lock hash, distinguishes roots by approved realpath, and otherwise fails `BOOTSTRAP_BASELINE_CONTRACT_MISMATCH`.

### Registered graph

The canonical `artifact_dag.allowed_edges` table is the only edge authority. Every entry supplies exact source kind, field, target kind, path/SHA or registered scalar-SHA constraint. List fields expand per element. Closure inputs are field-by-field; no wildcard exists. In particular:

- phase decision directly references its scope; scope never references that decision;
- audit Markdown references only its contract; the contract owns scope/approval/session/states/EV/canonical/findings/releases;
- progression references the phase projection; status uses distinct phase/final receipt fields;
- status and activation bind immutable before/after projection snapshots;
- `supersedes` and `prior_publication` target only the immediately previous generation/sequence;
- producer releases bind tool sources and transitive dependencies; closure transactions bind prepared and published report nodes separately.

Validation order is:

1. read/parse every reachable node with its registered parser;
2. verify every path/hash;
3. verify source-kind/field/target-kind and edge constraint;
4. build the complete directed graph;
5. reject any cycle;
6. only then run audit semantics.

`EXCLUDED.approval_receipt` resolves only to the stable plan decision. Scope-lock, status, baseline, request, or phase decision targets fail `APPROVAL_ARTIFACT_UNSTABLE`.

## All-pass fixture inventory

| Object | Creation | Required binding |
|---|---|---|
| approval/bootstrap | canonical `concrete_all_pass_graph` | C/M/B/Rplan/Dplan/S01/Q01/W01/D01 |
| PHASE-01 closure | canonical graph | release/session/states/EV/contract/report/projection/progression/activation/status/transaction |
| PHASE-02..06 | expanded normal template | every direct edge including prior status and snapshots |
| final | canonical final graph | current release/report/contract/six projections/final progression/status/transaction |
| synthetic oracle | separately built adjacency | exact 154/531 count and topological hash |
| live bundle | actual registry-expanded releases | discovered nodes/edges equal an independent traversal; no fixed count |

## Check Registry and isolated mutations

Eleven table-driven check families own all 16 isolated mutations:

| Family | Cases and only mutations | Exact failures |
|---|---|---|
| `stableApproval` | GR3-001 EXCLUDED→scope | `APPROVAL_ARTIFACT_UNSTABLE` |
| `referenceIntegrity` | GR3-002 changed byte; GR3-010 missing transitive source | `ARTIFACT_REFERENCE_HASH_MISMATCH` |
| `edgeRegistry` | GR3-003 unknown field; GR3-012 report→scope | `ARTIFACT_EDGE_FORBIDDEN` |
| `cycleOracle` | GR3-004 two-node back-edge | `ARTIFACT_REFERENCE_CYCLE` |
| `nodeParsers` | GR3-005 malformed manifest; GR3-006 missing Markdown anchor; GR3-007 wrong parser | format/kind registered errors |
| `scopeChain` | GR3-008 skipped generation; GR3-009 missing decision | generation/approval registered errors |
| `legacyBootstrap` | GR3-011 wrong Q scalar/discriminator | `BOOTSTRAP_BASELINE_CONTRACT_MISMATCH` |
| `graphCompleteness` | GR3-013 omitted contract/snapshot/final projection | `ARTIFACT_GRAPH_INCOMPLETE` |
| `publicationSequence` | GR3-014 skipped prior status | `PRIOR_PUBLICATION_SEQUENCE_INVALID` |
| `projectionSnapshot` | GR3-015 bytes/hash/path mismatch | `PROJECTION_SNAPSHOT_MISMATCH` |
| `liveReleaseSet` | remove one registry source/object from a live bundle | `ARTIFACT_GRAPH_INCOMPLETE` |

Each case starts from the synthetic complete graph and yields only its family error. Separately, a live-bundle fixture expands every immutable release object and compares exact discovered node/edge sets with an independent traversal.

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1
/home/zhaoge/.bun/bin/bun test \
  scripts/lib/__tests__/audit-governance-schema-v3.test.ts \
  scripts/lib/__tests__/artifact-reference-graph.test.ts \
  .agents/skills/plan-audit-archiver/scripts/__tests__/validate-audit.test.ts
/home/zhaoge/.bun/bin/bun run typecheck
git diff --check
```

Evidence must include exact exits/counts, all node/edge/mutation results, independent adjacency/cycle output, CodeGraph impact, and allowed-file diff. Any failure is `BLOCKED`.

## Auditor closure commands

After Implementer B stops, Auditor A runs:

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1
export AUDIT_RECOVERY_PHASE_DIR=audits/audit-governance-recovery-v1/phases/PHASE-03/g001
export AUDIT_RECOVERY_RELEASE=audits/audit-governance-recovery-v1/producer-releases/PHASE-03-g001.json
bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts \
  --emit-producer-release --canonical plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml \
  --case-set PHASE-03 --object-root audits/audit-governance-recovery-v1/objects/sha256 --output "$AUDIT_RECOVERY_RELEASE"
bun run .agents/skills/plan-audit-archiver/scripts/capture-state.ts --state-kind VERDICT \
  --qoderwork-root /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1 \
  --work-one-root /home/zhaoge/workspace/opencode/work-one \
  --scope-lock "$AUDIT_RECOVERY_PHASE_DIR/scope-lock-PHASE-03-g001.json" \
  --phase-approval "$AUDIT_RECOVERY_PHASE_DIR/phase-approval-decision-PHASE-03-g001.json" \
  --session-roles audits/audit-governance-recovery-v1/session-role-manifest.json \
  --producer-release "$AUDIT_RECOVERY_RELEASE" --output "$AUDIT_RECOVERY_PHASE_DIR/verdict-state.json"
```

Auditor A independently sweeps the implementation and writes only
`audits/audit-governance-recovery-v1/phases/PHASE-03/g001/auditor-findings.md`. A blocker stops before the next block.

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1
export AUDIT_RECOVERY_PHASE_DIR=audits/audit-governance-recovery-v1/phases/PHASE-03/g001
export AUDIT_RECOVERY_RELEASE=audits/audit-governance-recovery-v1/producer-releases/PHASE-03-g001.json
bun run .agents/skills/plan-audit-archiver/scripts/generate-evidence-receipt.ts \
  --audit-id AUDIT-GOVERNANCE-RECOVERY-PHASE-03-g001 \
  --canonical plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml --generate-case-set PHASE-03 \
  --scope-lock "$AUDIT_RECOVERY_PHASE_DIR/scope-lock-PHASE-03-g001.json" \
  --phase-approval "$AUDIT_RECOVERY_PHASE_DIR/phase-approval-decision-PHASE-03-g001.json" \
  --pre-change "$AUDIT_RECOVERY_PHASE_DIR/pre-change-state.json" --verdict-state "$AUDIT_RECOVERY_PHASE_DIR/verdict-state.json" \
  --producer-release "$AUDIT_RECOVERY_RELEASE" --output-dir "$AUDIT_RECOVERY_PHASE_DIR/evidence"
bun run .agents/skills/plan-audit-archiver/scripts/prepare-audit.ts \
  --scope-lock "$AUDIT_RECOVERY_PHASE_DIR/scope-lock-PHASE-03-g001.json" \
  --phase-approval "$AUDIT_RECOVERY_PHASE_DIR/phase-approval-decision-PHASE-03-g001.json" \
  --auditor-findings "$AUDIT_RECOVERY_PHASE_DIR/auditor-findings.md" --evidence-dir "$AUDIT_RECOVERY_PHASE_DIR/evidence" \
  --pre-change "$AUDIT_RECOVERY_PHASE_DIR/pre-change-state.json" --verdict-state "$AUDIT_RECOVERY_PHASE_DIR/verdict-state.json" \
  --producer-release "$AUDIT_RECOVERY_RELEASE" --object-root audits/audit-governance-recovery-v1/objects/sha256 \
  --output-dir "$AUDIT_RECOVERY_PHASE_DIR/prepared"
bun run .agents/skills/plan-audit-archiver/scripts/validate-audit.ts "$AUDIT_RECOVERY_PHASE_DIR/prepared/audit-report.md"
bun run .agents/skills/plan-audit-archiver/scripts/close-audit-phase.ts \
  --workspace-root /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1 \
  --plan-root plans/audit-governance-recovery-v1/formal-plan-set --phase PHASE-03 \
  --prepared-report "$AUDIT_RECOVERY_PHASE_DIR/prepared/audit-report.md" \
  --published-report "$AUDIT_RECOVERY_PHASE_DIR/published/audit-report.md" \
  --scope-lock "$AUDIT_RECOVERY_PHASE_DIR/scope-lock-PHASE-03-g001.json" \
  --phase-approval "$AUDIT_RECOVERY_PHASE_DIR/phase-approval-decision-PHASE-03-g001.json" \
  --session-roles audits/audit-governance-recovery-v1/session-role-manifest.json \
  --pre-change "$AUDIT_RECOVERY_PHASE_DIR/pre-change-state.json" --verdict-state "$AUDIT_RECOVERY_PHASE_DIR/verdict-state.json" \
  --producer-release "$AUDIT_RECOVERY_RELEASE" --session-role AUDITOR \
  --transaction-dir "$AUDIT_RECOVERY_PHASE_DIR/closure-transaction"
```

Every command exits 0; `validate-audit` returns `valid:true, errors:[], verdict:ACCEPT`. Otherwise stop.

## Phase completion gate

- [ ] Only the six allowed files changed.
- [ ] Every approval-package and normal-phase reference has an exact registered edge.
- [ ] YAML, JSON, legacy-Q, Markdown, checksum, source-byte, and projection-byte parsers are fail-closed.
- [ ] Expanded PHASE-01, every normal phase, and final graph are complete and acyclic.
- [ ] Every mutation yields one stable error and the independent cycle oracle agrees.
- [ ] Fixed tests, typecheck, and diff check pass.
- [ ] Implementer Session B stops without formal evidence/publication.
- [ ] Auditor Session A creates formal evidence and uses the accepted wrapper to publish PHASE-03 `ACCEPT`.
- [ ] PHASE-04 remains blocked until its receipt/status chain validates.
