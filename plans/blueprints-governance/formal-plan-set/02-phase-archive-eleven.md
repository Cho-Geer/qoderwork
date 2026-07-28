# Phase PHASE-02: archive 11 retired files with move-ban [VERIFICATION]

**Phase ID**: `PHASE-02`
**Depends on**: `PHASE-01`
**Progression status**: `NOT_STARTED`
**Outcome**: 11 retired files move to `blueprints/archive/2026-06/` (5) and `blueprints/archive/2026-07/` (6) after a per-file fail-closed move-ban check; root holds 19 active files; each retirement has a `logs/` decision record.
**Evidence level**: `component`

## Goal

- Move 11 retired files to month folders by writing month (REQ-002, M2).
- Write a `logs/YYYY-MM-DD-*.md` decision record per retirement (REQ-006, M6).
- Update INDEX: archived files move from active/closed to `## 已归档`; mark closure v1 `已退役` (it stays in root — path-referenced by v1 plans).

## Starting state and dependency

PHASE-01 ACCEPTED (INDEX exists, registers all 30). The 11 archive candidates and their target months are fixed in the inventory (§5 of index). closure v1 stays in root (path-referenced by `plans/audit-governance-evidence-and-status-closure/`).

## Local requirements

| Requirement | Contract |
|---|---|
| REQ-002 | zero path-form refs in audits/ and active plans/ before mv; after mv old path absent, new path present |
| REQ-006 | each retirement has a logs/ decision record naming file, reason, successor |

## Allowed files

| Exact path | Change | Anchor |
|---|---|---|
| `blueprints/archive/2026-06/` | new dir + 5 moves | month folder |
| `blueprints/archive/2026-07/` | new dir + 6 moves | month folder |
| `blueprints/INDEX.md` | modify (archive section) | `## 已归档` |
| `logs/YYYY-MM-DD-blueprints-governance-archive-*.md` | new | retirement decision records |

## Forbidden files and behaviors

No move before a passing move-ban check. No move of closure v1 (`blueprint-audit-governance-evidence-and-status-closure.md`) — it stays in root marked `已退役`. No edit to frozen provenance records. The two undated files (`acp-bridge-design.md`, `acp-bridge-serve-api-redesign.md`) and `phase4-scripts-purification.md` use git-entry-month fallback (INDEX `日期依据` = 入库月).

## Fixed contract

Per candidate file, in order: (1) `rg --fixed-strings "<basename>" audits/ plans/` → must be zero hits or the check is UNAVAILABLE; (2) if zero hits, `mkdir -p archive/<month> && mv blueprints/<file> archive/<month>/`; (3) write a logs/ record; (4) update INDEX `## 已归档`. A non-zero hit or failed check converges to BLOCKED: file stays in root, marked `已退役` in INDEX, no mv.

### Archive map (fixed)

| File | Target month | Date basis |
|---|---|---|
| session-context-2026-06-28.md | 2026-06 | 写作月 06-28 |
| acp-integration-direction.md | 2026-06 | 写作月 06-28 |
| acp-protocol-verified.md | 2026-06 | 写作月 06-28 |
| context-lazy-loading-plan.md | 2026-06 | 写作月 06-29 |
| phase4-scripts-purification.md | 2026-06 | 入库月（无自述日期） |
| acp-bridge-design.md | 2026-07 | 入库月（无自述日期） |
| acp-bridge-serve-api-redesign.md | 2026-07 | 入库月（无自述日期） |
| blueprint-acp-bidirectional.md | 2026-07 | 写作月 07-01 |
| blueprint-acp-bridge-optimization-roadmap.md | 2026-07 | 写作月 07-02 |
| blueprint-acp-bridge-sse-events.md | 2026-07 | 写作月 07-02 |
| blueprint-permission-template-refactor.md | 2026-07 | 写作月 07-17 |

## Implementation steps

Exact commands (including the per-file rg + mkdir + mv + logs write + INDEX update) are frozen in the PHASE-02 scope lock. Intent only here; no write before scope lock + pre-change capture.

## Check Registry

| Check name | PASS |
|---|---|
| move_ban_zero_refs | each candidate: `rg --fixed-strings <basename> audits/ plans/` zero hits (or UNAVAILABLE→BLOCKED) |
| archive_new_path_present | `test -f archive/<month>/<file>` for each moved file |
| archive_old_path_absent | `! test -f blueprints/<file>` for each moved file |
| retirement_log_present | each archived file has a `logs/YYYY-MM-DD-*.md` record |
| index_archive_section_synced | INDEX `## 已归档` lists exactly the 11 archived files; root count = 19 |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
# exact commands frozen in the PHASE-02 scope lock; must include the per-file
# rg move-ban check, post-mv test -f / ! test -f, retirement-log rg, and INDEX diff
```

## Rollback/failure convergence

Any non-zero ref hit, failed check, or missing retirement record converges to BLOCKED: the file stays in root, marked `已退役` in INDEX, no mv executed for it; preserve the pre-change capture and the move/skip manifest. Other zero-ref candidates may proceed independently only if the scope lock permits.

## Phase completion gate

- [ ] PHASE-02 scope lock approved by HUMAN_USER and pre-change capture created (P-02).
- [ ] Five fixed checks passed at component level with retained receipts (P-03).
- [ ] 11 files archived (or fail-closed skipped with INDEX `已退役` mark), root = 19, each retirement logged.
