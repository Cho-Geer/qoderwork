# Audit governance v3 — cross-session resume (supersedes 2026-07-26 genesis-bootstrap-resume)

**Updated**: 2026-07-27
**Supersedes**: `handoff/2026-07-26-audit-governance-v3-genesis-bootstrap-resume.md` (genesis bootstrap only; that file is historical)

## 1. Mission and non-negotiable controls

This is a v3 governance-framework rebuild, not a normal feature delivery. Active
work must never read or accept pre-v3 Plan/profile inputs, compatibility
reader/display paths, or generic bypasses. Preserve every substantive A-D
verification gate. The main agent designs and independently audits; delegated
agents implement and test only frozen instructions. Fail closed on every
contradiction, scope drift, missing evidence, or nonzero fixed command. Use
CodeGraph before understanding or modifying shared scripts. Text artifacts must
be written serially and immediately checked with nonempty, line-count, and
content assertions. Every scope-lock must keep its fix_contract and its
effective_allowlist consistent (lesson from the PHASE-02 run-conformance.ts gap).

## 2. Required workspace anchors

- Governance worktree and required next-session cwd:
  `/home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-v3`
- Governance HEAD [rechecked 2026-07-27]: `42d218fd7b73efa02e51c3da6993b6fe8011c1c4`
- Product anchor: `/home/zhaoge/workspace/opencode/work-one`
- Product HEAD [rechecked 2026-07-27]: `64df828d56611ac121baccfaf666f147980aec85`
- **All work this session is UNCOMMITTED** (30 dirty paths). Do NOT reset, clean,
  or delete the dirty v3 work. Recheck `git status` rather than copying this snapshot.
- Shared parser [rechecked, unchanged]: `scripts/lib/audit-governance-schema-v3.ts`
  SHA-256 `37b74a621bd31b3e2f254dd9c1638626a57c1d4afa339ab2e3cc1960a92ea7e5`

## 3. Active authority and exact hashes

| Artifact | SHA-256 | Status |
|---|---|---|
| `blueprints/blueprint-audit-governance-evidence-and-status-closure-v3.md` | `a510b7a8677c03e7ea1561e48620b95acec8611c88ff7ad2ddc558e0aa930d66` | approved design |
| `plans/audit-governance-evidence-and-status-closure-v3/canonical-requirements-contract.yaml` | `dd58ef590956c85c7ce96743589b1e25aa956e7a1030f0502ecbde59f6afd748` | canonical |
| `audits/.../genesis-bootstrap-admission.yaml` | `82609cb437349babdb81073a59039ae1f3c6bdb4b28de159b720d36df292f884` | CLOSED |
| `audits/.../genesis-bootstrap-closure-scope-lock.yaml` | `0bc91c02c7c9742b58e7dbbbf65df58a719d33cf1ed2538f1a0c03da0dbe87e4` | HUMAN_USER approved |
| `audits/.../genesis-bootstrap-closure-approval.json` | `f22c26c44bf97501f70251ef71de2a38494dbf8ee10d9913dcba6613725a53c7` | approval |
| `audits/.../genesis-bootstrap-closure-pre-change-capture.yaml` | `21671bfd03c396df112954c1483c409a3ba0c3a4e8da6d135b3928b1ec4aec76` | capture |
| `audits/.../genesis-bootstrap-closure-receipt.yaml` | `dece719a6b36a20278388448bdbf291c2a7baf69c122aa42ba659c503080d2ec` | CLOSED receipt |
| `audits/.../genesis-bootstrap-validator-path-fix-scope-lock.yaml` | `c90b5b18a43ad6c0193300983d5c1f099d23056b15c999c13e2370f583050155` | HUMAN_USER approved |
| `audits/.../genesis-bootstrap-validator-path-fix-approval.json` | `57c1415b9ad9fc95425bfef10a8837d9f35e6cc376e1895e5dd37ffa5877049f` | approval |
| `audits/.../genesis-bootstrap-validator-path-fix-pre-change-capture.yaml` | `983c78620583e1cc5db83ea249926b423a146c0065f40484611074cc3a1f672f` | capture |
| `audits/.../genesis-bootstrap-progression-labels-scope-lock.yaml` | `4d4b28fba01268dbb8a6ee778dcbbaa015c55f52f396b8f592efbcfa5c4a95b5` | HUMAN_USER approved |
| `audits/.../genesis-bootstrap-progression-labels-approval.json` | `9cd246e06520d1361613d24b58cccf3843ace57eade2a634423332b9b5f7f596` | approval |
| `audits/.../genesis-bootstrap-progression-labels-pre-change-capture.yaml` | `ed84eb1f829c079f61b15845219a1a78d385617f97d920b1588cf260f3842068` | capture |
| `audits/.../phase-01-scope-lock.yaml` | `03647474a8b32ac7083fac0b445c098f336aa972647efc0ee7afded79cdc7a2c` | HUMAN_USER approved |
| `audits/.../phase-01-scope-approval.json` | `34ff9ddc004905fb68e1d5023b639cfb68f8a535d3b6449a958333f3d4698285` | approval |
| `audits/.../phase-01-pre-change-capture.yaml` | `b511ac9aba72c7fba030b705974cc90a381200ce224bb19bbc08b7baaad7e78b` | capture |
| `audits/.../phase-02-scope-lock.yaml` | `859d72148060f107c922259a93a96261972b6346edc45111615a74661e9c8c76` | HUMAN_USER approved |
| `audits/.../phase-02-scope-approval.json` | `412e9c7c370b1f20bccd002bb7ff129f8ed15db3d2956fe098e16bce0829fa4b` | approval |
| `audits/.../phase-02-pre-change-capture.yaml` | `6fd81a091472f68b1537e4fcb14040e4afcdd420b871d9c6d80257c644ed6f66` | capture |

(`audits/...` = `audits/audit-governance-evidence-and-status-closure-v3`.)

## 4. Completed work and evidence ceiling

- **Stage G is CLOSED** (not ACCEPT): posthoc v3 validation of every bootstrap
  artifact by the shared parser, admission of one fresh formal v3 PLAN_SET, and the
  admission state transition DRAFT→HUMAN_APPROVED→IMPLEMENTING→POSTHOC_V3_VALIDATED→CLOSED.
  Closure publishes no report or LATEST and is not reusable.
- **Validator path fix**: `validate-plan.ts` resolves canonical/approval against an
  explicit governance worktree root (second positional arg); absolute/NUL/escape paths
  still rejected; sha256/schema/APPROVED checks unchanged; shared parser untouched.
- **Progression labels**: formal v3 PLAN_SET carries `phase-progression/v1` marker +
  derived Status + phase Progression status, so P-02A (`validate-phase-progression.ts`)
  exits 0 for PHASE-01.
- **PHASE-01 (surface/conformance) implemented**: `scripts/lib/governance-surface-manifest.yaml`,
  `scan-governance-surface.ts` (findings-first), `run-conformance.ts` (consumer agreement),
  `conformance-corpus/`, `conformance-mismatch-probes/`, tests. Scanner surfaces 12→10
  OPEN consumer-local findings; conformance ALL_CONSUMERS_AGREE with mismatch probes rejected.
- **PHASE-02 (progression v3) implemented**: `validateReceiptContract` discriminates
  receipts via the shared parser as `audit-phase-progression/v3::phase-progression-receipt`;
  plan-index marker, NOT_STARTED gate, and audit-report binding unchanged;
  `PLAN-SET-TEMPLATE.md` progression markers repaired; scanner refined to not flag the
  legitimate plan-index marker; manifest synced. Closes 2 findings, 10 remain OPEN.

**Evidence ceiling**: PHASE-01 and PHASE-02 are verified at component / file-integration
level via their fixed checks. They are **NOT formal v3 phase ACCEPT** — that requires an
independent audit under P-03 to P-07 (EV receipts, MODEL_REVIEW, `validate-audit` exit 0),
and the v3 audit chain does not exist until Phase 4. No report, LATEST, or phase ACCEPT exists.

## 5. Formal v3 PLAN_SET state

- Directory: `plans/audit-governance-evidence-and-status-closure-v3/formal-plan-set`
- Admitted by `validate-plan.ts` (exit 0) and P-02A `validate-phase-progression.ts` (exit 0).
- PHASE-01 is the first executable phase (surface/conformance), Status NOT_STARTED in the
  progression gate sense (kept NOT_STARTED so P-02A admission stays valid).
- Phase graph currently declares PHASE-01 only; later phases (2-5) are designed in this
  handoff but not yet added as manifest rows.

## 6. OPEN findings (10, retained for phase 3-4)

`F-CONSUMER-LOCAL:validate-audit.ts:schema_version-2.1`,
`F-CONSUMER-LOCAL:validate-audit.ts:audit-boundary-matrix/v1`,
`F-CONSUMER-LOCAL:audit-boundary-precheck.ts:boundary-contract/v1`,
`F-CONSUMER-LOCAL:capture-state.ts:schema_version`,
`F-CONSUMER-LOCAL:prepare-audit.ts:schema_version`,
`F-CONSUMER-LOCAL:generate-evidence-receipt.ts:schema_version`,
`F-CONSUMER-LOCAL:pre-check-evidence.ts:schema_version`,
`F-CONSUMER-LOCAL:scope-lock-template.json:pre-v3-schema_version`,
`F-CONSUMER-LOCAL:scope-lock-template.json:provenance-exposure`,
`F-CONSUMER-LOCAL:evidence-receipt-template.json:pre-v3-schema_version`.
Closed by PHASE-02: `F-PHASE01-TEMPLATE-PROGRESSION-MARKER`,
`F-CONSUMER-LOCAL:phase-progression.ts:phase-progression/v1`.

## 7. Scope adjudication record

PHASE-02 modified `scripts/lib/run-conformance.ts` (DECLARED_CONSUMERS += phase-progression.ts,
validate-phase-progression.ts) which was mandated by the approved
`fix_contract.conformance_extension` but omitted from `effective_allowlist.modified_paths`.
HUMAN_USER adjudicated (2026-07-27): accepted as a scope-lock drafting gap (minimal change,
transparently recorded in `audits/.../phase-02-evidence/`), not a rogue expansion. Future
scope-locks must keep fix_contract and allowlist consistent.

## 8. Remaining A-D work

- **Phase 3**: scope/projection schema, receipt generator, receipt template, boundary
  precheck v3 (closes audit-boundary-precheck/capture-state/generate-evidence-receipt findings).
- **Phase 4**: v3 audit chain — prepare-audit, pre-check-evidence, validate-audit v3
  (audit-contract/report, MODEL_REVIEW, evidence ceiling; closes validate-audit/prepare-audit/
  pre-check-evidence findings). **This is the prerequisite for any formal v3 phase ACCEPT.**
- **Phase 5**: finalize-audit (immutable report + atomic CAS LATEST pointer), publication
  tests, active asset index sync, full file-integration regression, final v3 audit.
- Each phase needs its own scope-lock → HUMAN_USER approval of exact SHA-256 → pre-change
  capture → implementation (delegated) → independent verification → independent audit.

## 9. Hard prohibitions

Do not reset or delete the dirty v3 work. Do not create an audit report, LATEST pointer,
or phase ACCEPT until the v3 audit chain exists (Phase 4). Do not equate fixed checks with
A-D completion or formal ACCEPT. Do not add old inputs, profiles, readers, displays,
adapters, or compatibility layers. Do not modify the shared parser
`scripts/lib/audit-governance-schema-v3.ts`. Do not migrate the plan-index progression
marker `phase-progression/v1` (it is active plan metadata, decoupled from v3 admission).
Do not read quarantined content (`legacy-boundary-contract-exemptions.json` is path-only HISTORICAL).

## 10. Safe restart sequence

1. Read `AGENTS.md`, `RULES.md`, `.agents/skills/plan-audit-archiver/provenance-rules.md`,
   and this handoff.
2. Confirm the governance cwd; recheck governance HEAD `42d218f…` and work-one HEAD
   `64df828…`; run `codegraph status` (sync if pending).
3. Recheck `git status` (expect ~30 uncommitted paths); preserve them.
4. Re-run the cheap integrity probes before any new scope:
   `bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts plans/audit-governance-evidence-and-status-closure-v3/formal-plan-set <governance-worktree>` (exit 0),
   `bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts plans/audit-governance-evidence-and-status-closure-v3/formal-plan-set PHASE-01` (exit 0),
   `bun run scripts/lib/scan-governance-surface.ts scripts/lib/governance-surface-manifest.yaml` (HAS_OPEN_FINDINGS, 10),
   `bun run scripts/lib/run-conformance.ts scripts/lib/conformance-corpus` (ALL_CONSUMERS_AGREE).
5. Then design the next phase scope-lock (Phase 3), freeze, obtain exact HUMAN_USER
   approval and a fresh pre-change capture under current v3 controls before any write.

## 11. Completion definition

A-D total v3 remediation remains incomplete. Stage G is CLOSED and PHASE-01/PHASE-02 are
implemented at component/file-integration evidence ceiling, but no formal v3 phase ACCEPT,
audit report, or LATEST pointer exists. Governance is not synchronized or conflict-free
until phases 3-5 land, the 10 OPEN findings close with receipt evidence, the independent
conformance corpus and mismatch probes pass, the v3 audit chain validates each phase, and
immutable publication succeeds.
