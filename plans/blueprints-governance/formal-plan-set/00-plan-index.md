# blueprints/ 目录治理与生命周期管理 — v3 PLAN_SET

**Plan mode**: `PLAN_SET`
**Schema version**: `audit-plan-set/v3`
**Document kind**: `plan-set-index`
**Status**: `COMPLETE`
**Progression schema**: `phase-progression/v1`
**Provenance level**: `v3-required`
**Canonical contract**: `plans/blueprints-governance/canonical-requirements-contract.yaml`
**Canonical contract SHA-256**: `39235a4290e0af52a8b68b9cc54b5ceb595a5eb064366cf53c2189096e7690ff`
**Approval decision**: `audits/blueprints-governance/approval-decision.json` (decision_id `BLUEPRINTS-GOVERNANCE-APPROVAL-20260728`, APPROVED by HUMAN_USER at 2026-07-28T18:40:00Z; binds blueprint sha256 `3051a5df...` + canonical_contract sha256 `39235a429...` + approval_request sha256 `b7511657...`).
**Evidence ceiling**: `component`

## 1. Input contract and source ledger

| Source | Exact path | SHA-256 | Authority |
|---|---|---|---|
| Canonical | `plans/blueprints-governance/canonical-requirements-contract.yaml` | `39235a4290e0af52a8b68b9cc54b5ceb595a5eb064366cf53c2189096e7690ff` | semantic source |
| Blueprint | `blueprints/blueprint-blueprints-governance.md` | `3051a5df8f90ffbe1ef148dc932578040ba86044b1514424491ddda42a0d6ea1` | requirements/design source |
| Provenance rules | `.agents/skills/plan-audit-archiver/provenance-rules.md` | _not hash-bound_ | mandatory process constraints (P-01~P-07) |
| Plan skill | `.agents/skills/deterministic-implementation-planning/SKILL.md` | _not hash-bound_ | plan authoring method |
| Inspection | 2026-07-28 three-round read-only survey (blueprint §1.3) | _historical_ | baseline |

### Atomic requirements

| ID | Condition | Required behavior | Observable result | Source | Owning Phase |
|---|---|---|---|---|---|
| REQ-001 | code/file write | lock + receipt first | three-section INDEX, every file once | BP §2.2.5 | PHASE-01 |
| REQ-002 | archive | move-ban check then mv | zero refs, new path present | BP §2.2.1/§2.2.6 | PHASE-02 |
| REQ-003 | header backfill | modification-ban check then write | four fields on non-exempt root files | BP §2.2.2/§2.2.7 | PHASE-03 |
| REQ-004 | causal edges | single-side write, reverse derive | targets exist, reverse consistent | BP §2.2.4 | PHASE-03 |
| REQ-005 | lint | all-pass + single-failure mutations | zero drift + per-mutation one fail | BP §2.2.8 | PHASE-05 |
| REQ-006 | retirement | logs/ decision record | each archive has a record | BP §2.2.6/§11.1 | PHASE-02 |

## 2. Decisions, scope, and non-goals

### Decision ledger

| ID | Question | Upstream decision | Current-code constraint | Final contract | Status |
|---|---|---|---|---|---|
| DEC-001 | provenance level | BP §3.2 "建议 v3-required" + user confirmed 2026-07-28 | v3 tooling merged but compatibility unverified (merge log) | v3-required; first real post-merge v3 plan — risk disclosed | CLOSED |
| DEC-002 | plan format | v3 schema requires formal-plan-set (validate-plan.ts) | closure-v3 is the only v3 plan precedent | formal-plan-set mirroring closure-v3 | CLOSED |
| DEC-003 | date granularity | BP §2.2.1 archive/YYYY-MM by writing month | logs-governance precedent | monthly; writing-month; git-entry-month fallback | CLOSED |
| DEC-004 | backfill scope | BP §2.2.7 archived files not backfilled | reduces modification-ban risk surface | root 18 files backfilled; v3 exempt | CLOSED |
| DEC-005 | M9 wiring target | BP §2.2.8 "session-startup or audit-finalize" undecided | no concrete hook decided | deferred CONTINUATION-001 | CLOSED (deferred) |

### In scope

- PHASE-01 INDEX.md board (M1); PHASE-02 archive 11 files (M2); PHASE-03 header backfill + 3 causal edges (M3/M4 edges); PHASE-04 spec sync blueprint-creation/AGENTS/documents (M4-M7/M10); PHASE-05 lint script + tests (M8).
- retirement logs (§11.1) and documents/INDEX.md sync.

### Non-goals

- work-one product code, DB schema, serve lifecycle, LLM permissions, npm dependencies.
- M9 stagnation/wake scan wiring (CONTINUATION-001 — needs a concrete hook decision; successor plan).
- any edit to frozen provenance records (scope-lock/approval/receipt) in `audits/`.
- live-LLM-E2E, runtime-smoke, reviewer authorization variables.

### Open/blocking items

- `BLOCKED-BY-DECISION`: plan awaits a HUMAN_USER APPROVED `audits/blueprints-governance/approval-decision.json` binding the canonical contract + blueprint by exact SHA-256 before any phase scope-lock or implementation (P-01/P-02).
- `CONTINUATION-001`: M9 wiring target undecided; a successor PLAN_SET must decide the hook (session-startup vs audit-finalize) before M9 work.

### Negative evidence semantics

- `FOUND`: the requested readable object exists and query succeeds.
- `NOT_FOUND`: the requested readable object is absent after a successful query.
- `UNAVAILABLE`: read, parse, query, or identity validation failed. `UNAVAILABLE` is FAIL, never absence PASS.

### Current versus historical evidence

- The 2026-07-28 three-round survey (blueprint §1.3) is historical baseline only.
- Every implementation claim requires a new command, retained artifact, and phase-bound receipt.

## 3. Verified current baseline

| Claim | Status | Command | Result |
|---|---|---|---|
| 30 blueprints present, no archive dir | VERIFIED | `ls blueprints/ \| wc -l && ls blueprints/archive/ 2>/dev/null \|\| echo no-archive` | 30 files, no archive |
| no script scans blueprints/ | VERIFIED | `rg 'blueprints/' scripts/ .agents/skills/ --glob '*.ts'` | zero hits |
| v3 blueprint hash-frozen by scope-lock | VERIFIED | `rg -A2 'blueprint' audits/audit-governance-evidence-and-status-closure-v3/phase-01-scope-lock.yaml` | sha256 a510b7a8... bound |
| archive candidates audits//plans/ refs | VERIFIED | blueprint §1.3 (rg ×30 ×7 dims) | 11/11 zero path refs |
| validate-plan.ts runnable, needs governanceRoot | VERIFIED | `bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts <plan> <governanceRoot>` | runs; governanceRoot must exist |
| v3 tooling compatibility | UNVERIFIED | merge log 2026-07-28 | "留待后续 phase 触发时由 audit chain v3 自然校验" — this plan is the first real test |
| blueprint current version | VERIFIED | `sha256sum blueprints/blueprint-blueprints-governance.md` | 3051a5df... = authority.blueprint.sha256 |

## 4. End-to-end traceability

| REQ | DC | Fixture | Oracle | Owning phase | Evidence level |
|---|---|---|---|---|---|
| REQ-001 | DC-001 | FX-001 | ORACLE-001 | PHASE-01 | component |
| REQ-001 | DC-002 | FX-002 | ORACLE-002 | PHASE-01 | component |
| REQ-002 | DC-003 | FX-003 | ORACLE-003 | PHASE-02 | component |
| REQ-002 | DC-004 | FX-004 | ORACLE-004 | PHASE-02 | component |
| REQ-003 | DC-005 | FX-005 | ORACLE-005 | PHASE-03 | component |
| REQ-003 | DC-006 | FX-006 | ORACLE-006 | PHASE-03 | component |
| REQ-004 | DC-007 | FX-007 | ORACLE-007 | PHASE-03 | component |
| REQ-004 | DC-008 | FX-008 | ORACLE-008 | PHASE-03 | component |
| REQ-005 | DC-009 | FX-009 | ORACLE-009 | PHASE-05 | component |
| REQ-005 | DC-010 | FX-010 | ORACLE-010 | PHASE-05 | component |
| REQ-006 | DC-011 | FX-011 | ORACLE-011 | PHASE-02 | component |
| REQ-006 | DC-012 | FX-012 | ORACLE-012 | PHASE-02 | component |

## 5. File change inventory

| Exact path | Change | Phase |
|---|---|---|
| `blueprints/INDEX.md` | new | PHASE-01 |
| `blueprints/archive/2026-06/` | new dir | PHASE-02 |
| `blueprints/archive/2026-07/` | new dir | PHASE-02 |
| 11 retired files → `blueprints/archive/<month>/` | move | PHASE-02 |
| `blueprints/blueprint-audit-governance-evidence-and-status-closure-v3.md` | no change (exempt) | PHASE-03 |
| 18 root blueprints (four-field backfill) | modify | PHASE-03 |
| `.agents/skills/blueprint-creation/SKILL.md` | modify | PHASE-04 |
| `AGENTS.md` | modify (§3/§11) | PHASE-04 |
| `documents/INDEX.md` | modify | PHASE-04 |
| `scripts/check-blueprint-status.ts` + `__tests__/` | new | PHASE-05 |
| `logs/YYYY-MM-DD-*.md` (P0/P1/P2 batch + retirement records) | new | PHASE-02/04/05 |

### Globally forbidden changes

- `.opencode/`, work-one, `bun.lock`, frozen provenance records under `audits/`, reviewer authorization settings.
- Any phase advance lacking an ACCEPTED dependency, receipt, and checked completion gate (P-02A).

## 6. Phase manifest

| Order | Phase ID | File | Depends on | Status |
|---:|---|---|---|---|
| 1 | PHASE-01 | `01-phase-index-board.md` | NONE | ACCEPTED |
| 2 | PHASE-02 | `02-phase-archive-eleven.md` | PHASE-01 | ACCEPTED |
| 3 | PHASE-03 | `03-phase-header-backfill.md` | PHASE-01 | ACCEPTED |
| 4 | PHASE-04 | `04-phase-spec-sync.md` | PHASE-03 | ACCEPTED |
| 5 | PHASE-05 | `05-phase-lint-script.md` | PHASE-04 | ACCEPTED |
