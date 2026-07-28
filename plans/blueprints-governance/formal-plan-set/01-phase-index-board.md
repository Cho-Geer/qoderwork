# Phase PHASE-01: blueprints/INDEX.md three-section board [VERIFICATION]

**Phase ID**: `PHASE-01`
**Depends on**: NONE
**Progression status**: `NOT_STARTED`
**Outcome**: `blueprints/INDEX.md` exists with active/closed/archived sections, reverse-edge view, and exemption list; every `.md` under `blueprints/` (root + `archive/`) is registered exactly once with status, truth-source pointer, and date basis.
**Evidence level**: `component`

## Goal

- Establish the three-section INDEX board (active / closed / archived) registering all 30 current files at their current locations (pre-archive state) (REQ-001, M1).
- Reserve the reverse-edge view and exemption-list sections (populated by PHASE-02/03).

## Starting state and dependency

No prior phase ACCEPT required. The blueprint (v1.0.1, sha256 `3051a5df...`) and canonical contract are the semantic source. 30 files sit flat in `blueprints/` root; no `archive/` exists yet.

## Local requirements

| Requirement | Contract |
|---|---|
| REQ-001 | three-section board; every `.md` under `blueprints/` registered exactly once with status + truth-source pointer + date basis |

## Allowed files

| Exact path | Change | Anchor |
|---|---|---|
| `blueprints/INDEX.md` | new | three-section board |

## Forbidden files and behaviors

No archive move (PHASE-02), no header backfill (PHASE-03), no edit to frozen provenance records under `audits/`, no edit to the v3 blueprint (`blueprint-audit-governance-evidence-and-status-closure-v3.md`). INDEX is a projection — it must not override any `audits/LATEST.md` verdict.

## Fixed contract

INDEX has exactly three sections (`## 活跃`, `## 已闭环`, `## 已归档`) plus two reserved sections (`## 反向边视图`, `## 豁免清单`). Each registered row carries: file | status (七值) | truth-source pointer | date basis (写作月/入库月) | 备注. As of PHASE-01 completion, all 30 files are in `## 活跃` or `## 已闭环` (none archived yet); the exemption list seeds `blueprint-audit-governance-evidence-and-status-closure-v3.md` (frozen-bound, INDEX-only metadata).

## Implementation steps

Exact commands and the per-file status/truth-source values are frozen in the PHASE-01 v3 phase scope lock (filled by auditor per P-02); this phase declares intent only and authorizes no file write before the scope lock + pre-change capture exist.

## Check Registry

| Check name | PASS |
|---|---|
| index_three_sections_present | three sections exist with reserved reverse/exemption sections |
| index_file_coverage_complete | `find blueprints -name '*.md'` set equals INDEX registration set (no orphan, no duplicate) |
| index_status_values_valid | every status ∈ {草稿,待审批,待实施,实施中,已暂停,已完成,已退役} |
| index_truth_source_pointer | every row has an audits LATEST pointer or `头部自述-未独立验证` |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
# exact commands frozen in the PHASE-01 scope lock; must include:
#   test -s blueprints/INDEX.md
#   rg -n '^## 活跃|^## 已闭环|^## 已归档|^## 反向边视图|^## 豁免清单' blueprints/INDEX.md
#   find blueprints -name '*.md' ! -name INDEX.md | sort vs INDEX registered filenames
```

## Rollback/failure convergence

Any missing section, orphan/duplicate registration, invalid status, or missing pointer converges to BLOCKED; preserve the partial INDEX and the pre-change capture. No archive or backfill may start.

## Phase completion gate

- [ ] PHASE-01 scope lock approved by HUMAN_USER and pre-change capture created (P-02).
- [ ] Four fixed checks passed at component level with retained receipts (P-03).
- [ ] INDEX registers all 30 current files exactly once with valid status + pointer + date basis.
