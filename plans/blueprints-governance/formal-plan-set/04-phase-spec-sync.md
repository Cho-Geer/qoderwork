# Phase PHASE-04: spec sync (blueprint-creation / AGENTS / documents) [VERIFICATION]

**Phase ID**: `PHASE-04`
**Depends on**: `PHASE-03`
**Progression status**: `NOT_STARTED`
**Outcome**: `blueprint-creation` skill template carries the four-field header + seven-value status + causal-edge vocabulary + naming/archive/ban rules; `AGENTS.md` §3 directory tree and §11 reflect `blueprints/INDEX.md` maintenance duty; `documents/INDEX.md` blueprint entries + reading suggestions are synced.
**Evidence level**: `component`

## Goal

- Land M4 (metadata spec), M5 (truth-source rule), M6 (retirement flow + bans), M7 (naming + creation registration), M10 (governance ownership + documents/INDEX sync) into the living spec sources (P1 of blueprint §3.2).

## Starting state and dependency

PHASE-03 ACCEPTED (headers + edges in place; the spec the skill teaches now matches what the files actually carry). No code change; pure spec/doc sync.

## Local requirements

| Requirement | Contract |
|---|---|
| REQ-003 (spec) | blueprint-creation template defines the four fields + seven values |
| REQ-004 (spec) | blueprint-creation template defines the three edge types + single-side rule |

## Allowed files

| Exact path | Change | Anchor |
|---|---|---|
| `.agents/skills/blueprint-creation/SKILL.md` | modify | template + §陷阱 #8 |
| `AGENTS.md` | modify | §3 directory tree, §11 maintenance duty |
| `documents/INDEX.md` | modify | blueprint entries + reading suggestions |

## Forbidden files and behaviors

No change to work-one, `bun.lock`, frozen provenance records, or the v3 blueprint. No opportunistic refactor of the skill beyond the four-field/status/edge/naming/archive/ban additions. No change that contradicts an `audits/LATEST.md` verdict.

## Fixed contract

The skill template header block matches BP §2.2.2 exactly; the seven-value status set matches BP §2.2.3; the edge vocabulary matches BP §2.2.4; the naming rule is `blueprint-<topic>.md`; the archive rule is `archive/YYYY-MM/` by writing month; the bans (move/modify, fail-closed) are stated. AGENTS.md §3 gains `blueprints/INDEX.md` and `blueprints/archive/`; §11 gains a `blueprints/INDEX.md` maintenance duty line mirroring the `logs/INDEX.md` and `documents/INDEX.md` duties.

## Implementation steps

Exact edits (anchors + replacement text) frozen in the PHASE-04 scope lock. Intent only here; no write before scope lock + pre-change capture.

## Check Registry

| Check name | PASS |
|---|---|
| skill_template_four_fields | `rg '创建日期.*更新日期.*状态.*相关蓝图\|four-field' .agents/skills/blueprint-creation/SKILL.md` (or four field lines present) |
| skill_template_seven_values | seven status values present in skill |
| skill_template_three_edges | three edge types present in skill |
| agents_md_index_duty | AGENTS.md §11 mentions `blueprints/INDEX.md` |
| agents_md_dir_tree | AGENTS.md §3 mentions `blueprints/INDEX.md` and `blueprints/archive/` |
| documents_index_synced | documents/INDEX.md blueprint entries match current root set |

## Fixed verification

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
# exact commands frozen in the PHASE-04 scope lock; rg assertions on the three files
```

## Rollback/failure convergence

Any assertion failure converges to BLOCKED: revert the spec edit, preserve the pre-change capture. No PHASE-05 start.

## Phase completion gate

- [ ] PHASE-04 scope lock approved by HUMAN_USER and pre-change capture created (P-02).
- [ ] Six fixed checks passed at component level with retained receipts (P-03).
- [ ] Skill/AGENTS/documents synced to match the implemented metadata + archive model.
