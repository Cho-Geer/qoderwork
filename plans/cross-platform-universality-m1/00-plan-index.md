# Cross-Platform Universality M1 — Plan Index

**Plan mode**: `PLAN_SET`
**Schema version**: `audit-plan-set/v3`
**Document kind**: `plan-set-index`
**ID**: `CROSS-PLATFORM-UNIVERSALITY-M1-20260803`
**Status**: `COMPLETE`
**Progression schema**: `phase-progression/v1`
**Provenance level**: `v3-required`
**Canonical contract**: `plans/cross-platform-universality-m1/canonical-requirements-contract.yaml`
**Canonical contract SHA-256**: `f8548087a8079731ce1ebbfcd33aaf869b6c1f77caa3b73e6ca7fe1d3b2103c3`
**Approval decision**: `plans/cross-platform-universality-m1/approval-decision.json`
**Approval decision SHA-256**: `7ee11e11faabc81ebc5e74721a133da8a22e9bacb42b73b745a1d632ed750658`

## 1. Input contract and source ledger

| Source | Exact path | SHA-256 | Authority |
|---|---|---|---|
| Canonical | `plans/cross-platform-universality-m1/canonical-requirements-contract.yaml` | `f8548087a8079731ce1ebbfcd33aaf869b6c1f77caa3b73e6ca7fe1d3b2103c3` | semantic source |
| Approval | `plans/cross-platform-universality-m1/approval-decision.json` | `7ee11e11faabc81ebc5e74721a133da8a22e9bacb42b73b745a1d632ed750658` | HUMAN_USER binding (re-signed 2026-08-05T11:09:45Z) |
| Blueprint | `blueprints/blueprint-cross-platform-universality.md` v3 | `0af8a1864e2f23e4365c1a136b48cdba8bdbd4c13450a69595bb9dc1e4733ec1` | requirements |
| Handoff | `handoff/native-windows-verification.md` | `cfb3d4d4a45600c5827658290815be15b4c22bc23bd488e3524d38bfbdc36a02` | runtime evidence |
| Template | `.agents/skills/deterministic-implementation-planning/PLAN-SET-TEMPLATE.md` | all | structural |
| Quality gates | `.agents/skills/deterministic-implementation-planning/QUALITY-GATES.md` | all | governance |
| Resolver | `scripts/lib/workspace-paths.ts` | full | consume, not rewrite |
| Example config | `scripts/local-paths.example.json` | full | consume, not rewrite |
| Existing plan | `plans/path-dynamic-resolution-m1/00-plan-index.md` | scaffolding | reference |
| PHASE-05 spec | `plans/cross-platform-universality-m1/05-phase-scripts-residual-sweep.md` | all | NEW 2026-08-04 amendment |

## 2. Decisions, scope, and non-goals

### Decision ledger

| ID | Question | Upstream decision | Current-code constraint | Status |
|---|---|---|---|---|
| DEC-001 | Platform scope | Windows Git Bash + WSL Ubuntu | both bash-derived | CLOSED |
| DEC-002 | Root anchor | `WORK_ONE_ROOT` + `QODERWORK_ROOT` | no `QW_ROOT` | CLOSED |
| DEC-003 | `tree-kill` | NOT needed | SIGTERM bun kills tree | CLOSED |
| DEC-004 | Phase 3 entrypoint | optional; BLOCKED-BY-DECISION | **lifted 2026-08-04 (P3-A YES)** | CLOSED |
| DEC-005 | Evidence method | Python byte-level (not `grep -c`) | MSYS gotcha | CLOSED |
| DEC-006 | Outcome contract | no gen-2 amendment | handoff L294 covers | CLOSED |
| DEC-007 | Test ID namespace | `XP-T-001..004` blueprint §4; `XP-T-005..007` Phase 4; `XP-T-008` Phase 5; `XP-T-009` Phase 3 | avoid ID reuse | CLOSED |
| DEC-008 | Phase 5 added | PHASE-05 created by 2026-08-04 amendment | addresses gate 7 failure | CLOSED |
| DEC-009 | PHASE-05 fixture handling | P1-DEC-002 NOT extended to PHASE-05; all 41 hits replaced; combined scan target = 0 | regression on plan amendment | CLOSED |

Note: XP-REQ-* are canonical-contract IDs; future audit scope-locks will rename these to REQ-###/PLAN-REQ-### per plan-audit-archiver/SKILL.md §ID table (L195-206).

### In scope

- Phase 1: 6 TS: `/home/zhaoge` imports → `workspace-paths.ts`
- Phase 2: 18 `.md`, 168 hits — 3-bucket (桶2 = 10)
- Phase 3: `scripts/qoderwork.sh` entrypoint (unblocked 2026-08-04; was BLOCKED-BY-DECISION)
- Phase 4: AGENTS.md (13), CI matrix, INDEX, log registration
- **Phase 5 (NEW 2026-08-04)**: 30 scripts/*.ts files, 41 non-import /home/zhaoge residuals → `${WORK_ONE_ROOT}` / `${QODERWORK_ROOT}` / `resolveWorkspacePaths`-derived
- `capture-state.ts`: `.agents/skills/plan-audit-archiver/scripts/capture-state.ts` (no `--plan-set`)

### Non-goals

- Modify `audits/`, `e2e-evidence/`, `logs/`, historical evidence
- Introduce `QW_ROOT` env var or `tree-kill` package
- Modify work-one, IDE config, `bun.lock`, existing plans
- Support native cmd.exe (only Git Bash + WSL Ubuntu)
- Modify outcome-contract JSON under `plans/path-dynamic-resolution-outcome-v1/`
- **Known residual (deferred)**: `doc-code-sync/SKILL.md` 4x `Ubuntu-24.04` in UNC paths (`//wsl.localhost/Ubuntu-24.04...`) — pre-existing, out of PHASE-02 §7 scan scope
- **Known residual (future scope)**: `scripts/*.py` 6x `/home/zhaoge` in 4 e2e test files — not in plan-defined combined scan scope (scripts/.ts + skills/.md + AGENTS.md only)

### Negative evidence semantics

Each Phase's §7: FOUND/NOT_FOUND/UNAVAILABLE; UNAVAILABLE = **FAIL**.

### Current versus historical evidence

Every implementation claim needs a new command, retained artifact, and phase-bound receipt.

## 3. Verified current baseline

| Claim | Status | Evidence/command | Result |
|---|---|---|---|
| Runtime TS imports | VERIFIED | source-inspected | 6 files / 9 static ESM + 1 dyn await-import = 10 logical |
| Skill files /home/zhaoge | VERIFIED | byte-level 18 .md files | 18 / 168 |
| AGENTS.md /home/zhaoge | VERIFIED | byte-level scan | 13 |
| workspace-paths.ts resolver | VERIFIED | source | 4-level precedence, fail-closed |
| local-paths.example.json | VERIFIED | source | linux + win32 keys |
| `grep -c` gotcha in Git Bash | VERIFIED | `grep -c '/home/zhaoge' scripts/` exit 1 (every file prints :0) | MSYS gotcha confirmed |
| .ts regex + typecheck baseline | VERIFIED | `re.compile(r'/home/zhaoge')`=51; `bun run typecheck` exit 1, 10 TS2307 | use plain pattern; §10 exit 0 |
| Blueprint skill count | VERIFIED | main session | 168 = 168 |

## 4. End-to-end traceability

| Requirement | Phase | File/symbol | Check name | Evidence source | Happy fixture | Single mutation | Test ID | Level |
|---|---|---|---|---|---|---|---|---|
| XP-REQ-001 | 01 | 6 TS files | XP-RUNTIME-IMPORT | typecheck + scan scripts/.ts | paths resolve | /nonexistent | XP-T-004 | component |
| XP-REQ-002 | 01 | test fixtures | XP-RUNTIME-FIXTURE | git cmds in fixtures | hardcoded paths | wrong anchor | XP-T-004 | component |
| XP-REQ-003 | 02 | 18 skill files | XP-SKILL-COUNT | byte-level scan | 0 hits | one cd | XP-T-003 | analysis |
| XP-REQ-004 | 02 | 3-bucket | XP-SKILL-BUCKET | per-file audit | buckets 0 | one miss | XP-T-003 | analysis |
| XP-REQ-005 | 02 | N2 fix | XP-SKILL-N2 | grep WSL-only | NOT_FOUND | FOUND | XP-T-003 | analysis |
| XP-REQ-006 | 02 | N3 fix | XP-SKILL-N3 | scan debug-env | 0 hits | 1 hit left | XP-T-003 | analysis |
| XP-REQ-007 | 03 | entrypoint | XP-ENTRYPOINT | user decision | YES (2026-08-04) | NO | XP-T-009 | component |
| XP-REQ-008 | 04 | AGENTS.md | XP-DOCS-AGENTS | byte-level scan | 0 hits | 1 hit | XP-T-005 | analysis |
| XP-REQ-009 | 04 | CI matrix | XP-DOCS-CI | inspect config | os: [windows, ubuntu] | missing os | XP-T-006 | component |
| XP-REQ-010 | 04 | blueprint INDEX | XP-DOCS-INDEX | read INDEX | entry present | missing | XP-T-007 | analysis |
| XP-REQ-011 | 05 | scripts/.ts residuals | XP-SCRIPTS-RESIDUAL | combined scan | total=0 | 1 hit | XP-T-008 | analysis |
| XP-REQ-012 | 03 | entrypoint script | XP-ENTRYPOINT-SCRIPT | resolver proxy | exit 0 | hardcoded literal | XP-T-009 | component |

## 5. File change inventory

| Exact path | Change | Phase |
|---|---|---|
| `scripts/cleanup-regress.ts:1` | modify import | PHASE-01 |
| `scripts/diag-handover-path.ts:4` | modify import | PHASE-01 |
| `scripts/diag-schema.ts:1` | modify import | PHASE-01 |
| `scripts/regress-parent-child.ts:1-12` | modify 4 static imports | PHASE-01 |
| `scripts/test-hybrid-enforcement.ts:60` | modify import | PHASE-01 |
| `scripts/_d3_live.ts:15,16` | modify imports | PHASE-01 |
| `.agents/skills/` (18, 168 hits) | replace paths | PHASE-02 |
| `scripts/qoderwork.sh` (NEW) | create entrypoint | PHASE-03 |
| `AGENTS.md` (13) | replace paths | PHASE-04 |
| `.github/workflows/cross-platform-universality.yml` (NEW) | create os matrix | PHASE-04 |
| `scripts/*.ts` (30 files, 41 non-import residuals) | replace with `${WORK_ONE_ROOT}` / `${QODERWORK_ROOT}` / `resolveWorkspacePaths`-derived | PHASE-05 |

## 6. Phase manifest

| Order | Phase ID | File | Depends on | Status |
|---|---|---|---|---|
| 1 | PHASE-01 | `01-phase-runtime-import-fix.md` | NONE | ACCEPTED |
| 2 | PHASE-02 | `02-phase-skill-universalization.md` | NONE | ACCEPTED |
| 3 | PHASE-03 | `03-phase-entrypoint-optional.md` | NONE | ACCEPTED |
| 4 | PHASE-04 | `04-phase-ci-and-docs.md` | PHASE-01, PHASE-02 | ACCEPTED |
| 5 | PHASE-05 | `05-phase-scripts-residual-sweep.md` | PHASE-01 | ACCEPTED |

Note: PHASE-02 runs parallel to PHASE-01; PHASE-04 depends on both; PHASE-05 depends on PHASE-01; PHASE-03 has no dependency. PHASE-05 is the new final implementation phase.
