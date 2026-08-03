# Cross-Platform Universality M1 — Final Verification

## 7. Global verification and evidence

### Cross-phase composition

| Command | PASS condition | Evidence level |
|---|---|---|
| `cd <worktree> && python -c "...byte-level scan scripts/.ts..."` | exit 0 (0 hits) | component |
| `cd <worktree> && python -c "...byte-level scan .agents/skills/.md..."` | exit 0 (0 hits) | analysis |
| `cd <worktree> && python -c "...byte-level scan AGENTS.md..."` | exit 0 (0 hits) | analysis |
| `cd <worktree> && bun test scripts/test-serve/__tests__/bootstrap-import-source.test.ts` | exit 0 | component |
| `cd <worktree> && grep -rn 'WSL-only\|Linux only' .agents/skills/ --include='*.md'` | NOT_FOUND (exit 1) | analysis |
| `cd <worktree> && grep -rn 'wsl -d Ubuntu-24.04' .agents/skills/ --include='*.md'` | NOT_FOUND (exit 1) | analysis |
| `cd <worktree> && grep -q 'windows-latest' .github/workflows/*.yml` (if CI exists) | exit 0 | component |
| `cd <worktree> && grep -q 'cross-platform-universality' blueprints/INDEX.md` | exit 0 | analysis |

### Combined all-targets scan

```bash
cd C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan
python -c "
import os, re

total = 0
targets = {}

# 1. scripts/ .ts files (Phase 1 scope)
ts_count = 0
ts_pattern = re.compile(r'/home/zhaoge')
for r,_,fs in os.walk('scripts'):
    for fn in fs:
        if fn.endswith('.ts'):
            c = len(ts_pattern.findall(open(os.path.join(r,fn),'rb').read().decode('utf-8','ignore')))
            ts_count += c
targets['scripts/.ts'] = ts_count
total += ts_count

# 2. .agents/skills/ .md files (Phase 2 scope)
sk_count = 0
for r,_,fs in os.walk('.agents/skills'):
    for fn in fs:
        if fn.endswith('.md'):
            c = open(os.path.join(r,fn),'rb').read().decode('utf-8','ignore').count('/home/zhaoge')
            sk_count += c
targets['.agents/skills/.md'] = sk_count
total += sk_count

# 3. AGENTS.md (Phase 4 scope)
ag_count = open('AGENTS.md','rb').read().decode('utf-8','ignore').count('/home/zhaoge')
targets['AGENTS.md'] = ag_count
total += ag_count

for k, v in targets.items():
    print(f'  {k}: {v}')
print(f'  TOTAL: {total}')
exit(1 if total > 0 else 0)
"
```

Expected output:
```
  scripts/.ts: 0
  .agents/skills/.md: 0
  AGENTS.md: 0
  TOTAL: 0
```

## 8. Risks, failure convergence, and rollback

| Trigger | Convergence |
|---|---|
| Phase 1 Python scan finds `/home/zhaoge` in .ts files | BLOCKED; verify each file was edited; revert to git baseline and re-apply edits |
| Phase 2 scan finds `/home/zhaoge` in skill files | BLOCKED; check which files were missed; apply 桶1/桶2/桶3 replacements |
| Phase 4 scan finds `/home/zhaoge` in AGENTS.md | BLOCKED; verify all 13 sites were replaced; check L222/L226/L230 cd commands |
| `bun test` fails after Phase 1 edits | BLOCKED; check import syntax; verify `pathToFileURL` and `resolve` are correct |
| CI matrix missing after Phase 4 | Non-blocking (if no CI file existed, this is expected) |
| Phase 3 remains BLOCKED-BY-DECISION | Non-blocking for other phases; PHASE-04 does not depend on it |

### Rollback by phase

| Phase | Rollback command | Verification after rollback |
|---|---|---|
| PHASE-01 | `git checkout -- scripts/cleanup-regress.ts scripts/diag-handover-path.ts scripts/diag-schema.ts scripts/regress-parent-child.ts scripts/test-hybrid-enforcement.ts scripts/_d3_live.ts` | Python scan shows 10 logical imports (9 static ESM imports + 1 dynamic await-import) |
| PHASE-02 | `git checkout -- .agents/skills/` | Python scan shows 168 hits |
| PHASE-03 | `rm scripts/qoderwork.sh` (if created) | N/A |
| PHASE-04 | `git checkout -- AGENTS.md .github/workflows/` | AGENTS.md Python scan shows 13 hits |
| Full rollback | `git checkout -- plans/cross-platform-universality-m1/` | Plans removed, no side effects |

## 9. Final completion gate

- [ ] Phase 1 gate: 0 `/home/zhaoge` in `scripts/` `.ts` files (Python byte-level)
- [ ] Phase 1 gate: `bun test scripts/test-serve/__tests__/bootstrap-import-source.test.ts` exit 0
- [ ] Phase 2 gate: 0 `/home/zhaoge` in `.agents/skills/` `.md` files (Python byte-level)
- [ ] Phase 2 gate: 0 "WSL-only" / "Linux only" framing in skill files (grep)
- [ ] Phase 2 gate: 0 bare `wsl -d Ubuntu-24.04` in skill files (grep)
- [ ] Phase 2 gate: `debug-environment-toolkit/SKILL.md` N3 fix verified (0 hits)
- [ ] Phase 3 gate: BLOCKED-BY-DECISION (awaiting user decision)
- [ ] Phase 4 gate: 0 `/home/zhaoge` in AGENTS.md (Python byte-level)
- [ ] Phase 4 gate: CI matrix includes `os: [windows-latest, ubuntu-latest]` (if CI exists)
- [ ] Phase 4 gate: `blueprints/INDEX.md` entry for cross-platform-universality verified
- [ ] Cross-phase composition: combined scan (scripts/.ts + skills/.md + AGENTS.md) returns 0 total
- [ ] Mutation test: each phase's single-failure check causes verification failure
- [ ] No forbidden publication occurred (audits/, e2e-evidence/, logs/ untouched)
- [ ] No files outside `plans/cross-platform-universality-m1/` were modified during planning

### Readiness assertion

This PLAN_SET is **READY-FOR-IMPLEMENTATION** pending user approval. The plan consists of:

- 4 implementation phases (1, 2, 4) + 1 blocked decision phase (3) + 1 final verification
- 32 total traceability rows across all phases
- 6 files in Phase 1, 18 files in Phase 2, 1 optional file in Phase 3, 3 files in Phase 4
- All phases use Python byte-level verification (Git Bash compatible)
- Test ID namespace: `XP-T-001..XP-T-004` reserved strictly for blueprint §4 (Git Bash runtime smoke, WSL Ubuntu runtime smoke, Skill 路径零硬编码, Script 路径零硬编码); Phase 4 additional checks use `XP-T-005..XP-T-007` (XP-DOCS-AGENTS, XP-DOCS-CI, XP-DOCS-INDEX) to avoid blueprint ID reuse. Phase 1 actual scope (script scan) maps to `XP-T-004`; `XP-T-001` and `XP-T-002` are DEFERRED (not in Phase 1 implementation scope)
- `capture-state.ts` lives at `.agents/skills/plan-audit-archiver/scripts/capture-state.ts`; mandatory flags: `--repository-root`, `--output`, `--scope-lock`, `--phase-id` (no `--plan-set` flag); `repository_root` for any invocation = `/home/zhaoge/workspace/opencode/work-one`

**Final Accept belongs to main session.** This agent does not produce a final Accept — only a Self-Check Gate.
