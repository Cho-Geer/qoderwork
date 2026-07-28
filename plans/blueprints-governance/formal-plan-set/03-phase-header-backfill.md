# Phase PHASE-03: four-field header backfill + causal edges [VERIFICATION]

**Phase ID**: `PHASE-03`
**Depends on**: `PHASE-01`
**Progression status**: `NOT_STARTED`
**Outcome**: 18 non-exempt root blueprints carry `创建日期/更新日期/状态/相关蓝图` headers after a per-file modification-ban check; 3 causal edges written (closure v1 被取代←v3; phase-progression 前置依赖→v3; agent-read 被取代·机制吸收←driven-enforcement); 3 stale headers corrected (task-lens-m1, phase-progression, agent-read → 已完成); closure v3 exempt, listed in INDEX exemption list.
**Evidence level**: `component`

## Goal

- Backfill four-field headers on the 18 non-exempt root files (REQ-003, M3/M4).
- Write 3 causal edges single-side; INDEX derives the reverse view (REQ-004, M4 边规则).
- Correct the 3 stale headers identified in the blueprint §1.1.3.

## Starting state and dependency

PHASE-01 ACCEPTED (INDEX exists). PHASE-02 may run in parallel or before; this phase touches only root active files, not archived ones (archived files are not backfilled — BP §2.2.7). The v3 blueprint is hash-frozen by `audits/...-v3/phase-01-scope-lock.yaml:40-42` (sha256 `a510b7a8...`) and is exempt.

## Local requirements

| Requirement | Contract |
|---|---|
| REQ-003 | non-exempt root files: four fields complete; exempt files: INDEX-only |
| REQ-004 | causal edges single-side; targets exist; INDEX reverse consistent; 已暂停⇒暂停于非空 |

## Allowed files

| Exact path | Change | Anchor |
|---|---|---|
| 18 root blueprints (see inventory) | modify (header only) | `**创建日期**` block |
| `blueprints/INDEX.md` | modify (exemption list + reverse-edge view) | `## 豁免清单`, `## 反向边视图` |

## Forbidden files and behaviors

No edit to `blueprint-audit-governance-evidence-and-status-closure-v3.md` (frozen-bound → INDEX exemption only). No edit to archived files. No edit to frozen provenance records. Informational references stay in body text, not in the `相关蓝图` field. No `已暂停` without a `暂停于` edge.

### The 18 backfill targets (fixed)

The 19 root files minus closure v3 (exempt) = 18. Includes closure v1 (`blueprint-audit-governance-evidence-and-status-closure.md`, also subject to modification-ban check before edit — if its SHA is frozen-bound anywhere, fall back to INDEX-only). The 3 causal edges to write:

| File | Edge | New status |
|---|---|---|
| blueprint-audit-governance-evidence-and-status-closure.md (v1) | `被取代 ← blueprint-audit-governance-evidence-and-status-closure-v3.md` | 已退役 |
| blueprint-phase-progression-audit-gate.md | `前置依赖 → blueprint-audit-governance-evidence-and-status-closure-v3.md（2026-07-28 已满足）` | 已完成 |
| blueprint-agent-read-enforcement.md | `被取代（机制吸收） ← blueprint-permission-template-driven-enforcement.md` | 已完成 |

Stale-header corrections (no edge change): `blueprint-task-lens-m1.md` 状态 → 实施中 (PHASE-05 ACCEPTED per audits/task-lens-m1/LATEST.md); phase-progression and agent-read → 已完成 (above).

## Fixed contract

Per root file, in order: (1) modification-ban check — `rg --fixed-strings "<basename>" audits/ -g '*.json' -g '*.yaml'` for path/SHA binding; (2) if clean, prepend/replace the four-field header block; (3) if frozen-bound, do not edit the file, register its metadata in INDEX `## 豁免清单` instead. The header block format is fixed in BP §2.2.2.

## Implementation steps

Exact header values (创建日期 from git log or header, 更新日期 = backfill date 2026-07-28, 状态 per audit/LATEST or correction, 相关蓝图 per the 3-edge table or `无`) and commands are frozen in the PHASE-03 scope lock. Intent only here.

## Check Registry

| Check name | PASS |
|---|---|
| modification_ban_checked | each of 18 files: ban check run; frozen-bound → INDEX exemption, not edited |
| header_four_fields_present | `rg '^\*\*创建日期\*\*|^\*\*更新日期\*\*|^\*\*状态\*\*|^\*\*相关蓝图\*\*'` 4 hits per non-exempt file |
| v3_exempt_not_edited | `sha256sum blueprints/blueprint-audit-governance-evidence-and-status-closure-v3.md` unchanged = `a510b7a8...` |
| edges_single_side | 3 edges written on dependent side only; reverse view derived in INDEX |
| edge_targets_exist | each edge target file exists |
| pause_rule | no `已暂停` status without `暂停于` edge (none expected this phase) |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
# exact commands frozen in the PHASE-03 scope lock; must include per-file ban check,
# four-field rg, v3 sha256sum unchanged assertion, edge-target test -f, INDEX reverse diff
```

## Rollback/failure convergence

Any frozen-bound file edited, missing field, broken edge target, or reverse-view mismatch converges to BLOCKED: revert the header edit (git checkout the file), register the file in INDEX exemption, preserve the pre-change capture. Do not start PHASE-04.

## Phase completion gate

- [ ] PHASE-03 scope lock approved by HUMAN_USER and pre-change capture created (P-02).
- [ ] Six fixed checks passed at component level with retained receipts (P-03).
- [ ] 18 non-exempt files four-field complete; v3 exempt + INDEX-listed; 3 edges + reverse view consistent; 3 stale headers corrected.
