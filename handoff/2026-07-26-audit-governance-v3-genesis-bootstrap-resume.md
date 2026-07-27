# Audit governance v3 Genesis Bootstrap — cross-session resume

## 1. Mission and non-negotiable controls

This is a v3 governance-framework rebuild, not a normal feature delivery. Active
work must never read or accept pre-v3 Plan/profile inputs, compatibility
reader/display paths, or generic bypasses. Preserve every substantive A-D
verification gate. The main agent designs and independently audits; delegated
agents implement and test only frozen instructions. Fail closed on every
contradiction, scope drift, missing evidence, or nonzero fixed command. Use
CodeGraph before understanding or modifying shared scripts. Text artifacts must
be written serially and immediately checked with nonempty, line-count, and
content assertions.

## 2. Required workspace anchors

- Governance worktree and required next-session cwd:
  `/home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-v3`
- Governance HEAD [rechecked]: `42d218fd7b73efa02e51c3da6993b6fe8011c1c4`
- Product anchor: `/home/zhaoge/workspace/opencode/work-one`
- Product HEAD [rechecked]: `64df828d56611ac121baccfaf666f147980aec85`
- Product status was clean when captured. Recheck it; do not use `check-plan` or
  the main worktree as the governance cwd.

## 3. Active authority and exact hashes

| Artifact | SHA-256 | Status |
|---|---|---|
| `blueprints/blueprint-audit-governance-evidence-and-status-closure-v3.md` | `a510b7a8677c03e7ea1561e48620b95acec8611c88ff7ad2ddc558e0aa930d66` | approved design |
| `plans/audit-governance-evidence-and-status-closure-v3/canonical-requirements-contract.yaml` | `dd58ef590956c85c7ce96743589b1e25aa956e7a1030f0502ecbde59f6afd748` | canonical |
| `audits/audit-governance-evidence-and-status-closure-v3/genesis-bootstrap-admission.yaml` | `20bf4624e58919f932c00d9ba083954389ba483658001df1da842debc7ce7ff3` | bootstrap admission |
| `audits/audit-governance-evidence-and-status-closure-v3/genesis-bootstrap-scope-repair-v4.yaml` | `99040763bd67628959c7a73e8da811507d0d592509866eec7a56655c65f3a908` | effective frozen scope |
| `audits/audit-governance-evidence-and-status-closure-v3/genesis-bootstrap-scope-repair-v4-approval.json` | `dfef79ad15694ca675a00e0e68d3a2ef2dafb5c9609f41aa37fe9deab6c663f3` | HUMAN_USER approval |
| `audits/audit-governance-evidence-and-status-closure-v3/genesis-bootstrap-scope-repair-v4-pre-change-capture.yaml` | `81604ccac7e8315fa905b9b013b395ee1b27655c6843ddfb7feaed7029003d26` | fresh capture |

Original scope/capture are historical only; replacement scope/capture are
historical only; v2 is nonreusable because its schema registry mismatched the
canonical; v3 is nonreusable because its component command could falsely pass
without discovering tests. Do not revive any of them.

## 4. Implemented design facts

- The shared parser is `scripts/lib/audit-governance-schema-v3.ts` and contains
  the only 17 canonical schema/document-kind discriminator pairs.
- PLAN_SET admission is v3-only. Its actual Bun test command requires `./`:
  `bun test ./.agents/skills/deterministic-implementation-planning/scripts/validate-plan.test.ts`.
- B1 no longer uses a worktree-relative handler import. It validates an explicit
  absolute `OPENCODE_ROOT`, resolves the handler under that root, then dynamically
  loads it; empty/relative roots fail before loading or handler execution.
- No active old profile, pre-v3 input, compatibility entry, or generic bypass is
  authorized.

## 5. v4 implementation evidence and ceiling

The nine v4 allowlist paths are:

1. `scripts/lib/audit-governance-schema-v3.ts`
2. `scripts/lib/__tests__/audit-governance-schema-v3.test.ts`
3. `.agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts`
4. `.agents/skills/deterministic-implementation-planning/scripts/validate-plan.test.ts`
5. `.agents/skills/deterministic-implementation-planning/PLAN-SET-TEMPLATE.md`
6. `logs/2026-07-26-audit-governance-v3-genesis-bootstrap-implementation.md`
7. `logs/INDEX.md`
8. `scripts/_b1_live.ts`
9. `scripts/__tests__/_b1_live.test.ts`

Historical implementation and independent verification ran the same eight fixed
checks: B1 path unit 3/3 named cases, schema unit 4/4, PLAN_SET component 5/5,
typecheck exit 0, CodeGraph parser caller check, old-entry zero-match scan, B1
static-import zero-match scan, and `git diff --check` exit 0. This is only
unit/component/static evidence. It is not ACCEPT, an audit report, A-D closure,
or a claim that the framework is synchronized. No report, LATEST, or phase
ACCEPT was created.

## 6. Unresolved log-metadata evidence conflict

An independent verifier previously stated that the implementation log had 8
lines while the index stated 10. A later implementation agent personally ran
`wc -l` and obtained 10; `logs/INDEX.md:180` also states `(10 行)`, while line 11
contains its date-table link. No write was made for the proposed 8-line change.
Treat this as unresolved evidence provenance conflict: do not alter the index
because of the earlier 8-line claim.

## 7. Safe restart sequence

1. Read `AGENTS.md`, `RULES.md`, provenance rules, and this handoff.
2. Confirm the required governance cwd; run `codegraph status`.
3. Perform a fresh read-only, reproducible line-count and provenance investigation
   of the implementation log before changing scope or documentation.
4. If there is no current inconsistency, record it as correction to verifier
   evidence only, never as governance completion.
5. If any write is required, freeze a fresh narrow remediation, obtain exact human
   approval and a new capture under current v3 controls before writing.

## 8. Hard prohibitions

Do not reset or delete existing dirty v3 work. Do not create an audit report,
LATEST pointer, or phase ACCEPT. Do not equate the eight fixed checks with A-D
completion. Do not add old inputs, profiles, readers, displays, adapters, or
compatibility layers.

## 9. Current affected files and state handling

The affected implementation paths are the nine listed in §5. The implementation
log is the path in item 6; the index metadata currently says `(10 行)`. Current
git status must be rechecked rather than copied from this handoff: the worktree
contains earlier untracked v3 authority artifacts plus the allowed implementation
changes. Preserve them unless a separately approved scope says otherwise.

## 10. Completion definition

A-D total v3 remediation remains incomplete. Only Genesis repair v4 fixed checks
passed at the evidence ceiling stated in §5. Do not state that governance is
synchronized or conflict-free without the remaining surface, conformance,
integration, audit, and closure work plus their independent evidence.
