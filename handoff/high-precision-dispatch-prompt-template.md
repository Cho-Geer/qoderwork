# High-Precision (GLM-5.2) Subagent Dispatch Prompt Template

> Saved 2026-08-05 per user request. This is the system prompt used to dispatch high-precision/GLM-5.2 as an independent second reviewer for the cross-platform-universality-m1 dual-review workflow.
>
> **Background**: GLM-5.2 was unavailable for tool-call-heavy tasks (persistent `server overload` after ~6 retries). User probed minimal prompt succeeded (no tools, ~8.7s). Full review prompt with 7+ tool calls consistently failed. Replaced with M3 as second reviewer per user decision.

## Prompt

```
## Subagent Handoff — Phase 3 Step 2: Independent SECOND Review (high-precision/GLM-5.2)

**Role**: Independent second reviewer (GLM-5.2, high-precision). A general-purpose/M3 reviewer has already completed a first review with Self-Pass. You must perform an independent review — do NOT simply confirm the first reviewer's findings. Form your own judgment first, then compare.

**Goal**: Independently verify that all 5 phases of the cross-platform-universality-m1 plan have been correctly implemented. Look for issues the first reviewer may have missed.

**Scope boundary**: Read-only review. DO NOT modify any files. DO NOT re-implement anything.

### Context

The plan `C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\plans\cross-platform-universality-m1\` has 5 phases replacing hardcoded `/home/zhaoge` paths with platform-neutral placeholders.

### What a high-precision reviewer should catch that M3 might miss:

1. **Edge cases in regex patterns**: The import-hits regex — does it miss any edge cases?
2. **Cross-phase consistency**: Are placeholder variable names used consistently?
3. **Scope violations**: Any files outside declared scope modified?
4. **Semantic correctness**: Are replacements semantically correct?
5. **Combined scan blind spots**: Any location missed?

### Phases to verify:

**PHASE-01**: 6 TS files' static imports → IIFE dynamic imports. Check: typecheck exit 0, bun test exit 0, import-hits = 0. Verify 7 allowlisted residuals match spec.

**PHASE-02**: 18 skill .md files, 168 hits → 0. Check: byte-level scan = 0, N2 NOT_FOUND, 桶2 NOT_FOUND, N3 = 0. Also check for `wsl.exe -d Ubuntu-24.04` edges.

**PHASE-03**: `scripts/qoderwork.sh`. Check: executable, no hardcoded literals, no QW_ROOT, consumes resolver.

**PHASE-04**: AGENTS.md, CI workflow, blueprint INDEX. Check: AGENTS.md = 0, CI matrix present, INDEX entry present.

**PHASE-05**: 30 scripts/*.ts, 41 residuals. Check: combined scan = 0, typecheck, bun test regression.

### Verification commands to run independently:

```bash
cd C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan

# 1. Combined scan
python -c "
import os, re, sys
total = 0
for r,_,fs in os.walk('scripts'):
    for fn in fs:
        if fn.endswith('.ts'):
            total += len(re.findall(r'/home/zhaoge', open(os.path.join(r,fn),'rb').read().decode('utf-8','ignore')))
for r,_,fs in os.walk('.agents/skills'):
    for fn in fs:
        if fn.endswith('.md'):
            total += open(os.path.join(r,fn),'rb').read().decode('utf-8','ignore').count('/home/zhaoge')
total += open('AGENTS.md','rb').read().decode('utf-8','ignore').count('/home/zhaoge')
print(f'combined total = {total}')
sys.exit(0 if total == 0 else 1)
"

# 2. Typecheck
bun run typecheck

# 3. Bootstrap test
bun test scripts/test-serve/__tests__/bootstrap-import-source.test.ts

# 4. Skill scan
python -c "
import os
d = '.agents/skills'
c = sum(open(os.path.join(r,fn),'rb').read().decode('utf-8','ignore').count('/home/zhaoge') for r,_,fs in os.walk(d) for fn in fs if fn.endswith('.md'))
print(f'skill_total={c}')
sys.exit(0 if c == 0 else 1)
"

# 5. Edge checks
grep -rn 'wsl\.exe -d Ubuntu-24.04\|wsl -d Ubuntu-24.04' .agents/skills/ --include='*.md'
grep -rn 'WSL-only\|Linux only\|走 WSL\|Windows 侧直连' .agents/skills/ --include='*.md'

# 6. PHASE-01 allowlist check
python -c "
import os, re
d='scripts'
p=re.compile(r'from [\"\\047]/home/zhaoge|require\([\"\\047]/home/zhaoge|import\([\"\\047]/home/zhaoge')
files=['cleanup-regress.ts','diag-handover-path.ts','diag-schema.ts','regress-parent-child.ts','test-hybrid-enforcement.ts','_d3_live.ts']
hits=0; residuals=[]
for fn in files:
    f=os.path.join(d,fn)
    if not os.path.isfile(f): print(f'MISSING {f}'); continue
    for i,ln in enumerate(open(f,'rb').read().decode('utf-8','ignore').splitlines(),1):
        if '/home/zhaoge' not in ln: continue
        if p.search(ln): hits+=1
        else: residuals.append(f'{fn}:{i}')
print(f'import_hits={hits}')
print(f'residuals={sorted(residuals)}')
"

# 7. CI matrix check
f='.github/workflows/cross-platform-universality.yml'
[ -f "$f" ] && echo "CI_FILE_EXISTS" || echo "CI_FILE_MISSING"
grep -c 'windows-latest' "$f" 2>/dev/null
grep -c 'ubuntu-latest' "$f" 2>/dev/null
```

### Self-Check Gate format:

## Self-Check Gate

**Methodology**: Independent review — formed my own judgment before consulting the M3 review results.

**Acceptance criteria**:
- [x/✗] Combined scan = 0
- [x/✗] typecheck exit 0 + bun test exit 0
- [x/✗] PHASE-02: skill scan = 0, N2 NOT_FOUND, 桶2 NOT_FOUND
- [x/✗] PHASE-03: qoderwork.sh executable + no hardcoded literals
- [x/✗] PHASE-04: AGENTS.md = 0, CI matrix, INDEX entry
- [x/✗] PHASE-05: combined scan = 0 (verified above)

**Second-review specific checks (high-precision)**:
- [x/✗] PHASE-01 allowlisted residuals match spec
- [x/✗] No `wsl.exe -d` edges missed by 桶2
- [x/✗] Cross-phase consistency

**Self-Decision**: Self-Pass / Self-Fail (with specific findings)

**Do not**: Modify any files. Read-only review.
```
