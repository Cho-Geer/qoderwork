# Cross-Platform Universality M1 — Plan Index

**Plan mode**: `PLAN_SET`
**Schema version**: `audit-plan-set/v3`
**Document kind**: `plan-set-index`
**ID**: `CROSS-PLATFORM-UNIVERSALITY-M1-20260803`
**Status**: `READY-FOR-IMPLEMENTATION`
**Progression schema**: `phase-progression/v1`
**Provenance level**: `v3-required`
**Canonical contract**: `plans/cross-platform-universality-m1/canonical-requirements-contract.yaml`
**Canonical contract SHA-256**: `dd400ed2554d0cfa0bb8b12d1cb4a5b822a0d854102b6c1e74cccc023cd56c58`
**Approval decision**: `plans/cross-platform-universality-m1/approval-decision.json`
**Approval decision SHA-256**: `9212bdf0322d5f01d416762801a14ce02583a0db36225c9e6712e2980372ffe6`

## 1. Input contract and source ledger

| Source | Exact path | Sections used | Authority |
|---|---|---|---|
| Blueprint | `blueprints/blueprint-cross-platform-universality.md` v3 | S1-S6 | requirements |
| Handoff | `handoff/native-windows-verification.md` | S1-S8 | runtime evidence |
| Template | `.agents/skills/deterministic-implementation-planning/PLAN-SET-TEMPLATE.md` | all | structural |
| Quality gates | `.agents/skills/deterministic-implementation-planning/QUALITY-GATES.md` | all | governance |
| Resolver | `scripts/lib/workspace-paths.ts` | full | consume, not rewrite |
| Example config | `scripts/local-paths.example.json` | full | consume, not rewrite |
| Existing plan | `plans/path-dynamic-resolution-m1/00-plan-index.md` | scaffolding | reference |

## 2. Decisions, scope, and non-goals

### Decision ledger

| ID | Question | Upstream decision | Current-code constraint | Status |
|---|---|---|---|---|
| DEC-001 | Platform scope | Windows Git Bash + WSL Ubuntu | both bash-derived | CLOSED |
| DEC-002 | Root anchor | `WORK_ONE_ROOT` + `QODERWORK_ROOT` only | no `QW_ROOT` | CLOSED |
| DEC-003 | `tree-kill` | NOT needed | SIGTERM bun parent kills tree | CLOSED |
| DEC-004 | Phase 3 entrypoint | optional; marked BLOCKED-BY-DECISION | awaits user decision | BLOCKED |
| DEC-005 | Evidence method | Python byte-level (not `grep -c`) | MSYS path gotcha in Git Bash | CLOSED |
| DEC-006 | Outcome contract | no gen-2 amendment needed | handoff L294 covers | CLOSED |
| DEC-007 | Test ID namespace | `XP-T-001..004` reserved for blueprint §4; `XP-T-005..007` for Phase 4 docs | avoid blueprint ID reuse | CLOSED |

### In scope

- Phase 1: 6 TS files with static `/home/zhaoge` imports — replace with `workspace-paths.ts` resolver
- Phase 2: 18 `.md` skill files, 168 `/home/zhaoge` — 3-bucket (桶2 = 10 co-occurrences)
- Phase 3: Optional `scripts/qoderwork.sh` — BLOCKED-BY-DECISION
- Phase 4: AGENTS.md (13), CI matrix, blueprint INDEX verification, log registration
- `capture-state.ts` at `.agents/skills/plan-audit-archiver/scripts/capture-state.ts`; flags: `--repository-root --output --scope-lock --phase-id` (no `--plan-set`)

### Non-goals

- Modify `audits/`, `e2e-evidence/`, `logs/`, historical evidence
- Introduce `QW_ROOT` environment variable; introduce `tree-kill` package
- Modify work-one, IDE machine config, `bun.lock`; existing plans under `plans/`
- Support native cmd.exe (only Git Bash + WSL Ubuntu)
- Modify `outcome-contract` JSON under `plans/path-dynamic-resolution-outcome-v1/`

### Negative evidence semantics (three-state)

Each Phase's §7 declares FOUND / NOT_FOUND / UNAVAILABLE. UNAVAILABLE (cmd exits non-zero or output unparseable) is always **FAIL** — never absence PASS.

### Current versus historical evidence

- **TS import count**: 6 files / 9 static ESM + 1 dynamic = 10 logical.
- **Skill count**: blueprint 168 = verified 168.
- Every implementation claim requires a new command, retained artifact, and phase-bound receipt.

## 3. Verified current baseline

| Claim | Status | Evidence/command | Result |
|---|---|---|---|
| Runtime TS imports | VERIFIED | blueprint-authoritative accounting | 6 files / 9 static ESM + 1 dyn await-import = 10 logical (cleanup=1, diag-handover=1, diag-schema=1, regress-parent-child=4, test-hybrid=1 dyn, _d3_live=2) |
| Skill files with /home/zhaoge | VERIFIED | `python -c "..." byte-level across 18 .md files` | 18 files / 168 matches (32+30+16+15+12+11+9+8+7+7+5+4+3+3+2+2+1+1) |
| AGENTS.md /home/zhaoge | VERIFIED | `python -c "open('AGENTS.md').read().count('/home/zhaoge')"` | 13 |
| workspace-paths.ts resolver | VERIFIED | source inspection | 4-level precedence, fail-closed |
| local-paths.example.json | VERIFIED | source inspection | linux + win32 keys present |
| `grep -c` returns 0 in Git Bash | VERIFIED | `grep -c '/home/zhaoge' scripts/` exit 0 | MSYS path reinterpretation gotcha confirmed |
| Python byte-level .ts regex + typecheck | VERIFIED | `re.compile(r'/home/zhaoge')`=51; broken quote-bracket=0; `bun run typecheck` exit 1, 10 TS2307 in 6 files | use plain pattern; Phase 1 §10 requires typecheck exit 0 |
| Blueprint inaccuracy: skill count | VERIFIED | main session 2026-08-03 | blueprint 168 = actual 168; per-file distribution re-verified at implementation time |

## 4. End-to-end traceability

| Requirement | Phase | File/symbol | Check name | Evidence source | Happy fixture | Single mutation | Test ID | Level |
|---|---|---|---|---|---|---|---|---|
| XP-REQ-001 | 01 | 6 TS files | XP-RUNTIME-IMPORT | `bun run typecheck` exit 0 + Python byte-level scan scripts/.ts | resolved paths all valid | /nonexistent path | XP-T-004 | component |
| XP-REQ-002 | 01 | test fixtures | XP-RUNTIME-FIXTURE | git commands on test paths | hardcoded paths | wrong anchor | XP-T-004 | component |
| XP-REQ-011 | 01 | Git Bash smoke (DEFERRED) | XP-RUNTIME-GITBASH | windows-latest CI runner test | exit 0 | wrong anchor | XP-T-001 (DEFERRED) | component |
| XP-REQ-012 | 01 | WSL smoke (DEFERRED) | XP-RUNTIME-WSL | ubuntu-latest CI runner test | exit 0 | wrong anchor | XP-T-002 (DEFERRED) | component |
| XP-REQ-003 | 02 | 18 skill files | XP-SKILL-COUNT | Python byte-level scan | zero hits | one cd left | XP-T-003 | analysis |
| XP-REQ-004 | 02 | 3-bucket | XP-SKILL-BUCKET | per-file audit | all buckets 0 | bucket 1 miss | XP-T-003 | analysis |
| XP-REQ-005 | 02 | N2 fix | XP-SKILL-N2 | grep for "WSL-only" | NOT_FOUND | FOUND | XP-T-003 | analysis |
| XP-REQ-006 | 02 | N3 fix | XP-SKILL-N3 | Python scan debug-env | 0 hits | 1 hit left | XP-T-003 | analysis |
| XP-REQ-007 | 03 | entrypoint | XP-ENTRYPOINT | user decision | N/A | N/A | N/A | blocked |
| XP-REQ-008 | 04 | AGENTS.md | XP-DOCS-AGENTS | Python byte-level scan | 0 hits | 1 hit left | XP-T-005 | analysis |
| XP-REQ-009 | 04 | CI matrix | XP-DOCS-CI | CI config inspection | os: [windows, ubuntu] | missing os | XP-T-006 | component |
| XP-REQ-010 | 04 | blueprint INDEX | XP-DOCS-INDEX | read INDEX.md | entry present | missing | XP-T-007 | analysis |

## 5. File change inventory

| Exact path | Change | Phase |
|---|---|---|
| `scripts/cleanup-regress.ts:1` | modify import | PHASE-01 |
| `scripts/diag-handover-path.ts:4` | modify import | PHASE-01 |
| `scripts/diag-schema.ts:1` | modify import | PHASE-01 |
| `scripts/regress-parent-child.ts:1-12` | modify 4 static imports: db L4, gate/context L5-7, mcp-deliv L8-11, read-audit L12 | PHASE-01 |
| `scripts/test-hybrid-enforcement.ts:60` | modify import | PHASE-01 |
| `scripts/_d3_live.ts:15,16` | modify imports | PHASE-01 |
| `.agents/skills/` (18 files, 168 hits) | replace paths | PHASE-02 |
| `scripts/qoderwork.sh` (optional) | create | PHASE-03 |
| `AGENTS.md` (13 occurrences) | replace paths | PHASE-04 |
| `.github/workflows/cross-platform-universality.yml` (NEW FILE) | create os matrix | PHASE-04 |

## 6. Phase manifest

| Order | Phase ID | File | Depends on | Status |
|---|---|---|---|---|
| 1 | PHASE-01 | `01-phase-runtime-import-fix.md` | NONE | NOT_STARTED |
| 2 | PHASE-02 | `02-phase-skill-universalization.md` | NONE (parallel with 01) | NOT_STARTED |
| 3 | PHASE-03 | `03-phase-entrypoint-optional.md` | NONE | BLOCKED-BY-DECISION |
| 4 | PHASE-04 | `04-phase-ci-and-docs.md` | PHASE-01, PHASE-02 | NOT_STARTED |
