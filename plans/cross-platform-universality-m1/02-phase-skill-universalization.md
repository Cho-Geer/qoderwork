# Phase PHASE-02: Skill Universalization [VERIFICATION]

**Phase ID**: `PHASE-02`
**Depends on**: NONE (parallel with PHASE-01)
**Outcome**: 18 skill `.md` files with 168 `/home/zhaoge` occurrences replaced with placeholders
**Evidence level**: analysis
**Progression status**: `NOT_STARTED`
**Completion receipt**: `<receipt-path>` (required when status is `ACCEPTED`)

## 1. Input contract + source ledger

| Source | Exact path | Sections used | Authority |
|---|---|---|---|
| Blueprint | `blueprints/blueprint-cross-platform-universality.md` v3 | S2.1 (C layer), S3 Phase 2, S4 XP-T-003 | requirements |
| Handoff | `handoff/native-windows-verification.md` | S2 (18 files, 168 matches), S6-N2/N3 | runtime evidence |
| Main session | 2026-08-03 verified baseline | actual 168 matches blueprint | re-verified at implementation time |

### Verified baseline (main session 2026-08-03, Python byte-level)

**Actual counts (matches blueprint)**:
- Total: 18 files / 168 matches (per-file: 32+30+16+15+12+11+9+8+7+7+5+4+3+3+2+2+1+1 = 168, Python byte-level sum)
- 6 high-frequency files (>=10): 116 matches (32+30+16+15+12+11)
- 5 mid-frequency files (5-9): 36 matches (9+8+7+7+5)
- 7 low-frequency files (1-4): 16 matches (4+3+3+2+2+1+1)

**Bucket classification** (per blueprint S2.1, cross-checked against per-file audit using line-level co-occurrence, not literal counts):
- 桶1 (command templates): ~87 hits across ~15 files — `${WORK_ONE_ROOT}` / `${QODERWORK_ROOT}` placeholders. (Note: only 43 lines are pure command templates; the additional 44 lines share `wsl -d` with `/home/zhaoge` and are classified below as 桶2 lines.)
- 桶2 (wsl -d + /home/zhaoge co-occurrence on same line): **10** lines where `wsl -d` and `/home/zhaoge` co-occur on the same line, in 7 files. Replace `wsl -d Ubuntu-24.04` with `wsl -d ${QW_WSL_DISTRO:-Ubuntu-24.04}`. Verified: total `wsl -d` lines = 44, total `/home/zhaoge` lines = 146, intersection = 10.
- 桶3 (prose + TS constants + JSON): ~71 hits — generic rewrites. Per blueprint §2.1 breakdown: 61 prose + 8 TS constants + 2 JSON.

**Arithmetic verification**: 桶1 + 桶2 + 桶3 = 87 + 10 + 71 = **168**, matching the per-file Python byte-level sum.

**N2 fix required**: 5+ skill files with "WSL-only / Linux only / 走 WSL" framing must be updated to "Windows Git Bash + WSL Ubuntu"
**N3 fix required**: `debug-environment-toolkit/SKILL.md` 12 hits — must be replaced

## 2. Decisions, scope, and non-goals

### Decisions

| ID | Question | Upstream decision | Status |
|---|---|---|---|
| P2-DEC-001 | Replacement target | `${WORK_ONE_ROOT}` and `${QODERWORK_ROOT}` placeholders; do NOT introduce `QW_ROOT` | CLOSED |
| P2-DEC-002 | WSL distro var | `${QW_WSL_DISTRO:-Ubuntu-24.04}` with default fallback | CLOSED |
| P2-DEC-003 | Prose replacements | Rewrite as "your QoderWork workspace root directory" | CLOSED |
| P2-DEC-004 | N2 "WSL-only" fix | Change to "Windows Git Bash + WSL Ubuntu" | CLOSED |
| P2-DEC-005 | N3 debug-env fix | Replace 12 hardcoded paths in `debug-environment-toolkit/SKILL.md` | CLOSED |

### In scope

- 18 skill `.md` files under `.agents/skills/`
- 168 `/home/zhaoge` occurrences across all 18 files
- N2: 5+ files with "WSL-only" framing
- N3: `debug-environment-toolkit/SKILL.md` 12 hits

### Non-goals

- Do not modify `scripts/` files (Phase 1 scope)
- Do not modify `AGENTS.md` (Phase 4 scope)
- Do not modify `audits/`, `e2e-evidence/`, `logs/`
- Do not modify `work-one` or IDE config files
- Do not modify files outside `.agents/skills/` (except N2 text changes are within skill files only)

## 3. Verified current baseline

| Claim | Command | Result |
|---|---|---|
| 18 skill files with /home/zhaoge | `python -c "import os; d=r'C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\.agents\skills'; c=0; [exec('c+=open(os.path.join(r,fn),\"rb\").read().decode(\"utf-8\",\"ignore\").count(\"/home/zhaoge\")') for r,_,fs in os.walk(d) for fn in fs if fn.endswith('.md')]; print(c)"` | 168 |
| High-freq files (>=10) | Per-file Python scan | 6 files / 116 hits |
| Mid-freq files (5-9) | Per-file Python scan | 5 files / 36 hits |
| Low-freq files (1-4) | Per-file Python scan | 7 files / 16 hits |
| wsl -d + /home/zhaoge co-occurrences (桶2) | line-by-line Python scan of `.agents/skills/.md` | 10 lines (in 7 files) where both `wsl -d` and `/home/zhaoge` appear on the same line |
| N2 "WSL-only" framing | `grep -ril 'WSL-only\|Linux only\|走 WSL' .agents/skills/` | 5+ files (exact count at edit time) |
| N3 debug-env hits | `python -c "print(open('.agents/skills/debug-environment-toolkit/SKILL.md','rb').read().decode().count('/home/zhaoge'))"` | 12 |

## 4. End-to-end traceability

| Requirement | Check name | Evidence source | Happy fixture | Single mutation | Test ID |
|---|---|---|---|---|---|
| XP-REQ-003 | XP-SKILL-COUNT | Python byte-level scan | 0 hits across 18 files | leave one cd path | XP-T-003 |
| XP-REQ-004 | XP-SKILL-BUCKET | per-file audit | all buckets 0 | bucket 1 miss | XP-T-003 |
| XP-REQ-005 | XP-SKILL-N2 | grep "WSL-only" | NOT_FOUND | FOUND | XP-T-003 |
| XP-REQ-006 | XP-SKILL-N3 | Python scan debug-env | 0 hits | 1 hit left | XP-T-003 |

## 5. File change inventory

### 6 high-frequency files (>=10 hits each)

| Exact path | Hits | Primary bucket |
|---|---|---|
| `.agents/skills/serve-api/reference-operations.md` | 32 | 桶1 (command templates) |
| `.agents/skills/serve-api/reference.md` | 30 | 桶1 + 桶2 (wsl calls) |
| `.agents/skills/opencode-framework-dev/SKILL.md` | 16 | 桶1 + 桶3 (prose) |
| `.agents/skills/isolated-serve-test/SKILL.md` | 15 | 桶1 |
| `.agents/skills/debug-environment-toolkit/SKILL.md` | 12 | 桶1 + N3 fix |
| `.agents/skills/plan-audit-archiver/SKILL.md` | 11 | 桶1 + 桶3 |

### 5 mid-frequency files (5-9 hits)

| Exact path | Hits | Primary bucket |
|---|---|---|
| `.agents/skills/debug-environment-toolkit/reference.md` | 9 | 桶1 + 桶3 |
| `.agents/skills/doc-code-sync/SKILL.md` | 8 | 桶1 + 桶2 |
| `.agents/skills/skill-diagnosis-optimization/SKILL.md` | 7 | 桶1 + 桶3 |
| `.agents/skills/logs-governance/SKILL.md` | 7 | 桶1 + 桶2 |
| `.agents/skills/opencode-framework-dev/reference.md` | 5 | 桶3 (TS constants) |

### 7 low-frequency files (1-4 hits)

| Exact path | Hits | Primary bucket |
|---|---|---|
| `.agents/skills/deterministic-implementation-planning/SKILL.md` | 4 | 桶1 |
| `.agents/skills/plan-audit-archiver/templates/audit-report-template.md` | 3 | 桶3 (JSON) |
| `.agents/skills/guided-code-editing/SKILL.md` | 3 | 桶1 |
| `.agents/skills/plan-audit-archiver/provenance-rules.md` | 2 | 桶3 |
| `.agents/skills/guided-code-editing/reference.md` | 2 | 桶1 |
| `.agents/skills/serve-api/SKILL.md` | 1 | 桶1 |
| `.agents/skills/outcome-governance/SKILL.md` | 1 | 桶1 |

## 6. Numbered edit steps

### Bucket replacement patterns

**Bucket arithmetic (must hold after every sub-step)**: 桶1 + 桶2 + 桶3 = **168**.
Verified: 87 (command templates) + 10 (wsl -d + /home/zhaoge co-occurrences) + 71 (prose 61 + TS 8 + JSON 2) = 168.

**桶1 (command templates ~87 hits across ~15 files)**: Replace `/home/zhaoge/workspace/qoderwork` with `${QODERWORK_ROOT}` and `/home/zhaoge/workspace/opencode/work-one` with `${WORK_ONE_ROOT}`.

Pattern: `s|/home/zhaoge/workspace/qoderwork|${QODERWORK_ROOT}|g` and `s|/home/zhaoge/workspace/opencode/work-one|${WORK_ONE_ROOT}|g`

**桶2 (10 co-occurrence lines: wsl -d + /home/zhaoge on same line, in 7 files)**: Replace `wsl -d Ubuntu-24.04` with `wsl -d ${QW_WSL_DISTRO:-Ubuntu-24.04}`.

Pattern: `s|wsl -d Ubuntu-24.04|wsl -d "${QW_WSL_DISTRO:-Ubuntu-24.04}"|g`

**桶3 (prose + TS constants + JSON ~71 hits)**: 
- Prose paths: replace with "your QoderWork workspace root" or "the work-one project root"
- TS constants in code examples: replace with `${WORK_ONE_ROOT}` variable reference
- JSON template fields: replace with placeholder comments

If a hit does not fall into 桶1 or 桶2, it MUST be classified into 桶3 to keep the arithmetic closed.

### Step 1: High-frequency files (6 files)

For each of the 6 high-frequency files, apply 桶1 + 桶2 + 桶3 replacements. Use `sed` or manual edit per file.

```bash
cd C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan
# Apply 桶1 replacement to all skill files
for f in .agents/skills/serve-api/reference-operations.md .agents/skills/serve-api/reference.md .agents/skills/opencode-framework-dev/SKILL.md .agents/skills/isolated-serve-test/SKILL.md .agents/skills/debug-environment-toolkit/SKILL.md .agents/skills/plan-audit-archiver/SKILL.md; do
  sed -i 's|/home/zhaoge/workspace/qoderwork|${QODERWORK_ROOT}|g' "$f"
  sed -i 's|/home/zhaoge/workspace/opencode/work-one|${WORK_ONE_ROOT}|g' "$f"
done
```

### Step 2: Mid-frequency files (5 files)

Apply same 桶1 + 桶2 + 桶3 patterns.

### Step 3: Low-frequency files (7 files)

Apply same patterns. These have fewer hits but must be comprehensive.

### Step 4: 桶2 (wsl -d) replacement

```bash
cd C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan
for f in .agents/skills/serve-api/reference.md .agents/skills/doc-code-sync/SKILL.md .agents/skills/logs-governance/SKILL.md; do
  sed -i 's|wsl -d Ubuntu-24.04|wsl -d "${QW_WSL_DISTRO:-Ubuntu-24.04}"|g' "$f"
done
```

### Step 5: N2 fix — Update "WSL-only" framing

Find and update files with "WSL-only / Linux only / 走 WSL" language:

```bash
cd C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan
grep -rn 'WSL-only\|Linux only\|走 WSL' .agents/skills/ --include='*.md'
```

For each match, update the framing to "Windows Git Bash + WSL Ubuntu".

### Step 6: N3 fix — `debug-environment-toolkit/SKILL.md` 12 hits

Apply 桶1 + 桶2 + 桶3 patterns specifically to this file. Verify all 12 hits are replaced.

### Step 7: Verification

```bash
cd C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan
python -c "
import os
d = r'C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\.agents\skills'
total = 0
for r,_,fs in os.walk(d):
    for fn in fs:
        if fn.endswith('.md'):
            fp = os.path.join(r, fn)
            cnt = open(fp, 'rb').read().decode('utf-8', 'ignore').count('/home/zhaoge')
            if cnt > 0:
                print(f'FOUND: {cnt} in {fp}')
            total += cnt
print(f'Total: {total}')
exit(1 if total > 0 else 0)
"
```

## 7. Fixed verification commands

Three outcomes per check (UNAVAILABLE always = FAIL, not pass-by-omission):

| Outcome | Condition | Phase result |
|---|---|---|
| FOUND | cmd exits 0 AND query yields positive hit | per-check |
| NOT_FOUND | cmd exits 0 AND query yields 0 hits | per-check |
| UNAVAILABLE | cmd exits non-zero (missing binary, IO error, encoding) or output unparseable | **FAIL** — block |

grep exit codes: rc=0 = FOUND match; rc=1 = NOT_FOUND (no match); rc=2+ = UNAVAILABLE.

```bash
cd C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan
# 1. Byte-level scan of .agents/skills (UNAVAILABLE-handled)
python -c "
import os, sys
d = r'C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\.agents\skills'
try:
    c = sum(open(os.path.join(r,fn),'rb').read().decode('utf-8','ignore').count('/home/zhaoge') for r,_,fs in os.walk(d) for fn in fs if fn.endswith('.md'))
    print(f'total={c}'); sys.exit(0 if c == 0 else 1)
except (OSError, IOError, UnicodeDecodeError) as e:
    print(f'UNAVAILABLE: {e}', file=sys.stderr); sys.exit(2)
"
# FAIL if exit 1 (FOUND) or 2 (UNAVAILABLE)

# 2. N2 — no "WSL-only" framing (UNAVAILABLE-handled)
out=$(grep -rn 'WSL-only\|Linux only\|走 WSL' .agents/skills/ --include='*.md' 2>&1); rc=$?
[ $rc -eq 1 ] && [ -z "$out" ] && echo "NOT_FOUND PASS" || { echo "rc=$rc -> FAIL"; exit 1; }

# 3. N3 — debug-environment-toolkit SKILL.md (UNAVAILABLE-handled)
python -c "
import os, sys
p = r'C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\.agents\skills\debug-environment-toolkit\SKILL.md'
if not os.path.isfile(p): print(f'UNAVAILABLE: missing {p}', file=sys.stderr); sys.exit(2)
try:
    c = open(p,'rb').read().decode('utf-8','ignore').count('/home/zhaoge')
    print(f'debug-env SKILL.md: {c}'); sys.exit(0 if c == 0 else 1)
except (OSError, IOError, UnicodeDecodeError) as e:
    print(f'UNAVAILABLE: {e}', file=sys.stderr); sys.exit(2)
"

# 4. 桶2 — no bare `wsl -d Ubuntu-24.04` left (UNAVAILABLE-handled)
out=$(grep -rn 'wsl -d Ubuntu-24.04' .agents/skills/ --include='*.md' 2>&1); rc=$?
[ $rc -eq 1 ] && [ -z "$out" ] && echo "NOT_FOUND PASS" || { echo "rc=$rc -> FAIL"; exit 1; }
```

## 8. Single-failure mutation matrix

| Mutation | Expected result | Verification |
|---|---|---|
| Leave one `/home/zhaoge` in a skill file | Python scan finds 1+ hits, exit 1 | Step 1 exit 1 |
| Leave one "WSL-only" text unchanged | grep finds match, exit 0 | Step 2 exit 0 |
| Leave one `wsl -d Ubuntu-24.04` unmodified | grep finds match, exit 0 | Step 4 exit 0 |
| Skip N3 fix in debug-env SKILL.md | Python scan shows 12 hits | Step 3 exit 1 |

## 9. Roll-back strategy

- **Per-file**: `git checkout -- .agents/skills/<file>`
- **Batch all 18 files**: `git checkout -- .agents/skills/`
- **Verification**: After rollback, Python scan returns 168 hits (baseline)
- **Risk**: Low — these are documentation/skill files, not runtime code

## 10. Completion gate

- [ ] Python byte-level scan of `.agents/skills/` `.md` files returns 0 hits for `/home/zhaoge`
- [ ] grep for "WSL-only" / "Linux only" / "走 WSL" returns NOT_FOUND in skill files
- [ ] grep for bare `wsl -d Ubuntu-24.04` returns NOT_FOUND (all replaced with variable)
- [ ] `debug-environment-toolkit/SKILL.md` has 0 `/home/zhaoge` hits (N3 fix)
- [ ] Mutation test: leaving one `/home/zhaoge` in any skill file causes verification to FAIL
- [ ] Required receipts and hash bindings are retained
- [ ] Next Phase prohibition: PHASE-04 depends on PHASE-02 completion (in addition to PHASE-01)
