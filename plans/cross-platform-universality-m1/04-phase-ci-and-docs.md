# Phase PHASE-04: CI Matrix and Docs Update [VERIFICATION]

**Phase ID**: `PHASE-04`
**Depends on**: PHASE-01, PHASE-02
**Outcome**: AGENTS.md paths replaced, CI matrix updated, blueprint INDEX verified, log registered
**Evidence level**: analysis
**Progression status**: `NOT_STARTED`
**Completion receipt**: `<receipt-path>` (required when status is `ACCEPTED`)

## 1. Input contract + source ledger

| Source | Exact path | Sections used | Authority |
|---|---|---|---|
| Blueprint | `blueprints/blueprint-cross-platform-universality.md` v3 | S2.1 (E layer), S3 Phase 4 | requirements |
| Handoff | `handoff/native-windows-verification.md` | S1 (AGENTS.md 13 sites) | runtime evidence |
| AGENTS.md | `AGENTS.md` | L3/L10/L24/L25/L37/L41/L203/L222/L226/L230/L515/L516/L517 | verified baseline |

## 2. Decisions, scope, and non-goals

### Decisions

| ID | Question | Upstream decision | Status |
|---|---|---|---|
| P4-DEC-001 | AGENTS.md replacement | 3 `cd` commands → `cd "${WORK_ONE_ROOT}"`; 10 descriptive → generic placeholders | CLOSED |
| P4-DEC-002 | CI matrix | `os: [windows-latest, ubuntu-latest]`; new file `.github/workflows/cross-platform-universality.yml` (`.github/workflows/` does not exist at planning time) | CLOSED |
| P4-DEC-003 | blueprint INDEX | Verify entry exists; no modification needed | CLOSED |
| P4-DEC-004 | Log registration | `logs/` per §1.3 vs §3 L135; see §6 Step 4 | BLOCKED-BY-DECISION |

### In scope

- AGENTS.md: replace 13 `/home/zhaoge` occurrences
- `.github/workflows/cross-platform-universality.yml`: NEW FILE — create with `os: [windows-latest, ubuntu-latest]` matrix
- `blueprints/INDEX.md`: verify entry for cross-platform-universality exists
- `logs/INDEX.md`: **DO NOT MODIFY** — see §6 Step 4

### Non-goals

- Do not modify `audits/`, `e2e-evidence/`, `logs/` historical evidence (blueprint §1.3 / AGENTS.md forbid)
- Do not modify `.agents/skills/` files (Phase 2 scope)
- Do not modify `scripts/` files (Phase 1 scope)
- Do not modify `logs/INDEX.md` (per DEFECT 4; the `logs/` directory is read-only in this plan-set)

## 3. Verified current baseline

| Claim | Command | Result |
|---|---|---|
| AGENTS.md 13 hits | `python -c "print(open('AGENTS.md','rb').read().decode().count('/home/zhaoge'))"` | 13 |
| 3 `cd` commands at L222/L226/L230 | `python -c "..." scan lines` | 3 cd /home/zhaoge |
| 10 descriptive references | `python -c "..." scan lines` | L3/L10/L24/L25/L37/L41/L203/L515/L516/L517 |
| `.github/workflows/` directory exists at planning time | `ls -la .github/workflows/ 2>/dev/null` | NO (at planning time, 2026-08-03); creation of a new workflow file is in-scope |
| blueprints/INDEX.md exists | `test -f blueprints/INDEX.md; echo $?` | check at edit time |
| logs/INDEX.md modification | FORBIDDEN per blueprint §1.3; this plan does not modify `logs/` | n/a (not edited) |

## 4. End-to-end traceability

| Requirement | Check name | Evidence source | Happy fixture | Single mutation | Test ID |
|---|---|---|---|---|---|
| XP-REQ-008 | XP-DOCS-AGENTS | Python byte-level scan AGENTS.md | 0 hits | 1 hit left | XP-T-005 |
| XP-REQ-009 | XP-DOCS-CI | CI config inspection (workdir uses `WORK_ONE_ROOT` secret, no Linux fallback) | os: [windows, ubuntu] | missing os | XP-T-006 |
| XP-REQ-010 | XP-DOCS-INDEX | read blueprints/INDEX.md | entry present | missing entry | XP-T-007 |

## 5. File change inventory

| Exact path | Change | Anchor |
|---|---|---|
| `AGENTS.md` | replace 13 `/home/zhaoge` occurrences | L3/L10/L24/L25/L37/L41/L203/L222/L226/L230/L515/L516/L517 |
| `.github/workflows/cross-platform-universality.yml` | NEW FILE — create CI workflow with `os: [windows-latest, ubuntu-latest]` matrix | new file (directory did not exist at planning time, 2026-08-03) |
| `logs/INDEX.md` | **NOT MODIFIED** — see §6 Step 4 for the BLOCKED-BY-DECISION log creation request | n/a |

## 6. Numbered edit steps

### Step 1: Replace AGENTS.md paths

3 `cd` command lines (L222, L226, L230):
- L222: `cd /home/zhaoge/workspace/qoderwork` → `cd "${QODERWORK_ROOT}"`
- L226: `cd /home/zhaoge/workspace/qoderwork` → `cd "${QODERWORK_ROOT}"`
- L230: `cd /home/zhaoge/workspace/qoderwork/scripts` → `cd "${QODERWORK_ROOT}/scripts"`

10 descriptive references (L3, L10, L24, L25, L37, L41, L203, L515, L516, L517):
- Replace `/home/zhaoge/workspace/opencode/work-one` with `${WORK_ONE_ROOT}`
- Replace `/home/zhaoge/workspace/qoderwork` with `${QODERWORK_ROOT}`
- Replace `/home/zhaoge/.bun/bin/bun` with `${BUN_BIN:-bun}`
- Replace `/home/zhaoge/.local/bin/codegraph` with `${CODEGRAPH_BIN:-codegraph}`

### Step 2: Create CI workflow file `.github/workflows/cross-platform-universality.yml` (NEW FILE)

Verified: `.github/workflows/` directory does not exist at planning time (2026-08-03). Therefore this step creates a new file with the matrix.

Create the directory if missing, then write the workflow file (excerpt; full YAML stored at the named path):

```bash
mkdir -p .github/workflows
cat > .github/workflows/cross-platform-universality.yml <<'YAML'
name: cross-platform-universality
on: { push: {branches:[main]}, pull_request: {branches:[main]}, workflow_dispatch: {} }
jobs:
  test:
    name: Test on ${{ matrix.os }}
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [windows-latest, ubuntu-latest]   # ANCHOR: cross-platform matrix literal
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm install -g bun
      - name: Resolve workspace paths (capture-state contract smoke test)
        shell: bash
        run: bun run scripts/lib/workspace-paths.ts --work-dir "${WORK_ONE_ROOT}"
        env:
          WORK_ONE_ROOT: ${{ secrets.WORK_ONE_ROOT }}
      - name: TypeScript compile check (typecheck)
        shell: bash
        run: bun run typecheck
      - name: Runtime regression test (bootstrap import source)
        shell: bash
        run: bun test scripts/test-serve/__tests__/bootstrap-import-source.test.ts
      - name: Byte-level scan for /home/zhaoge (combined)
        shell: bash
        run: python -c "import os,re,sys; t=sum(len(re.findall(r'/home/zhaoge',open(os.path.join(r,fn),'rb').read().decode('utf-8','ignore')))for r,_,fs in os.walk('scripts')for fn in fs if fn.endswith('.ts'))+sum(open(os.path.join(r,fn),'rb').read().decode('utf-8','ignore').count('/home/zhaoge')for r,_,fs in os.walk('.agents/skills')for fn in fs if fn.endswith('.md'))+open('AGENTS.md','rb').read().decode('utf-8','ignore').count('/home/zhaoge'); sys.exit(1 if t>0 else 0)"
YAML
```

Anchor for the matrix addition is the literal `os: [windows-latest, ubuntu-latest]` in the file's `jobs.<name>.strategy.matrix.os` block.

### Step 3: Verify blueprint INDEX

```bash
cd C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan
grep -i 'cross-platform-universality\|cross.platform.universality' blueprints/INDEX.md
```

If entry exists, no modification needed. If missing, add entry.

### Step 4: Log creation — `BLOCKED-BY-DECISION` (DEFECT 4)

Blueprint §1.3 L50 forbids modifying `logs/` paths inside frozen evidence; blueprint §3 L135 demands a new log file. **Resolution**: the §1.3/§3 contradiction is treated as a non-binding recommendation. This plan does NOT create `logs/2026-08-03-blueprint-cross-platform-universality.md` and does NOT modify `logs/INDEX.md`. Step 4 remains `BLOCKED-BY-DECISION` until the user lifts the contradiction; no log is required for Phase 4 completion.

### Step 5: Run `capture-state.ts` (P-07 command-level enforcement, DEFECT 8)

After Steps 1–4 (with Step 4 BLOCKED), invoke capture-state for P-07 command-level enforcement. The script lives at `.agents/skills/plan-audit-archiver/scripts/capture-state.ts` (NOT `scripts/`); mandatory flags are `--repository-root`, `--output`, `--scope-lock`, `--phase-id` (no `--plan-set` flag exists).

```bash
cd C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan
bun run .agents/skills/plan-audit-archiver/scripts/capture-state.ts \
  --repository-root /home/zhaoge/workspace/opencode/work-one \
  --output audits/cross-platform-universality-m1/evidence/pre-change-PHASE-04.json \
  --scope-lock audits/cross-platform-universality-m1/scope-lock-PHASE-04.json \
  --phase-id PHASE-04
```

Expected: capture-state produces a JSON snapshot under `audits/`. The `--repository-root /home/zhaoge/workspace/opencode/work-one` is mandatory. Missing `--output` / `--scope-lock` / `--phase-id` cause the script to throw; surface as `ESCALATION`.

### Step 6: Verification (UNAVAILABLE-handled; see §7)

## 7. Fixed verification commands

Three outcomes per check (UNAVAILABLE always = FAIL, not pass-by-omission):

| Outcome | Condition | Phase result |
|---|---|---|
| FOUND | cmd exits 0 AND query yields positive hit | per-check |
| NOT_FOUND | cmd exits 0 AND query yields 0 hits | per-check |
| UNAVAILABLE | cmd exits non-zero (missing binary, IO error, encoding) or output unparseable | **FAIL** — block |

grep exit codes: rc=0 = FOUND match; rc=1 = NOT_FOUND; rc=2+ = UNAVAILABLE.

```bash
cd C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan

# 1. AGENTS.md scan (UNAVAILABLE-handled)
python -c "
import os, sys
p='AGENTS.md'
if not os.path.isfile(p): print(f'UNAVAILABLE: missing {p}', file=sys.stderr); sys.exit(2)
try:
    c = open(p,'rb').read().decode('utf-8','ignore').count('/home/zhaoge')
    print(f'AGENTS.md: {c}'); sys.exit(0 if c == 0 else 1)
except (OSError, IOError, UnicodeDecodeError) as e:
    print(f'UNAVAILABLE: {e}', file=sys.stderr); sys.exit(2)
"

# 2. CI workflow file exists and matrix FOUND (two single-mutation checks, defect-D fix)
f='.github/workflows/cross-platform-universality.yml'
[ ! -f "$f" ] && { echo "UNAVAILABLE: missing $f"; exit 1; }
test "$(grep -c 'windows-latest' "$f")" -ge 1 || { echo "NOT_FOUND windows-latest -> FAIL"; exit 1; }
test "$(grep -c 'ubuntu-latest' "$f")" -ge 1 || { echo "NOT_FOUND ubuntu-latest -> FAIL"; exit 1; }
echo "CI_MATRIX_PRESENT"

# 3. Blueprint INDEX entry FOUND
f='blueprints/INDEX.md'
[ ! -f "$f" ] && { echo "UNAVAILABLE: missing $f"; exit 2; }
grep -qi 'cross-platform-universality\|cross.platform.universality' "$f" && echo "INDEX_ENTRY_PRESENT" || { echo "NOT_FOUND -> FAIL"; exit 1; }

# 4. Combined cross-phase scan (scripts/.ts + .agents/skills/.md + AGENTS.md, UNAVAILABLE-handled)
python -c "
import os, re, sys
total = 0
try:
    for fn in ['AGENTS.md']:
        if not os.path.isfile(fn): print(f'UNAVAILABLE: missing {fn}', file=sys.stderr); sys.exit(2)
        total += open(fn,'rb').read().decode('utf-8','ignore').count('/home/zhaoge')
    for base, ext in [('scripts','.ts'), ('.agents/skills','.md')]:
        if not os.path.isdir(base): print(f'UNAVAILABLE: missing dir {base}', file=sys.stderr); sys.exit(2)
        for r,_,fs in os.walk(base):
            for fn in fs:
                if fn.endswith(ext):
                    fpath = os.path.join(r,fn)
                    if base == 'scripts':
                        total += len(re.findall(r'/home/zhaoge', open(fpath,'rb').read().decode('utf-8','ignore')))
                    else:
                        total += open(fpath,'rb').read().decode('utf-8','ignore').count('/home/zhaoge')
    print(f'Combined total: {total}'); sys.exit(0 if total == 0 else 1)
except (OSError, IOError, UnicodeDecodeError) as e:
    print(f'UNAVAILABLE: {e}', file=sys.stderr); sys.exit(2)
"
```

## 8. Single-failure mutation matrix

| Mutation | Expected result | Verification |
|---|---|---|
| Leave one `/home/zhaoge` in AGENTS.md | Python scan finds 1+ hits, exit 1 | Step 1 exit 1 |
| CI matrix missing `ubuntu-latest` (single-mutation) | `grep -c 'ubuntu-latest'` returns 0; second check fails | Step 2 second test fails, exit 1 |
| CI matrix missing `windows-latest` (single-mutation) | `grep -c 'windows-latest'` returns 0; first check fails | Step 2 first test fails, exit 1 |
| CI workflow file absent | File-not-found reported as UNAVAILABLE | Step 2 exit 1 |
| blueprint INDEX missing entry | grep fails | Step 3 exit 1 |
| Blueprint INDEX file missing | UNAVAILABLE -> FAIL (block) | Step 3 exit 2 |
| `logs/INDEX.md` modified | FORBIDDEN; any modification is a violation, not a check | n/a (forbidden) |
| capture-state.ts not invoked or no audits snapshot | P-07 unenforced | Step 5 produces no audit artifact -> blocked |

## 9. Roll-back strategy

- **AGENTS.md**: `git checkout -- AGENTS.md`
- **CI files**: `git checkout -- .github/workflows/*.yml`
- **Verification**: After rollback, AGENTS.md Python scan returns 13 hits (baseline)
- **Risk**: Low — AGENTS.md is documentation, CI changes are additive

## 10. Completion gate

- [ ] Python byte-level scan of AGENTS.md returns 0 hits for `/home/zhaoge` (UNAVAILABLE-handled per §7)
- [ ] `.github/workflows/cross-platform-universality.yml` exists and both `grep -c 'windows-latest'` and `grep -c 'ubuntu-latest'` return ≥ 1 (split single-mutation grep, defect-D fix)
- [ ] `.github/workflows/cross-platform-universality.yml` runs `bun run typecheck` and `bun test scripts/test-serve/__tests__/bootstrap-import-source.test.ts` in each matrix job (defect-B fix)
- [ ] `blueprints/INDEX.md` has entry for cross-platform-universality
- [ ] Step 4 (log creation) is annotated `BLOCKED-BY-DECISION` and `logs/INDEX.md` is **not** modified
- [ ] `bun run .agents/skills/plan-audit-archiver/scripts/capture-state.ts --repository-root /home/zhaoge/workspace/opencode/work-one --output audits/cross-platform-universality-m1/evidence/pre-change-PHASE-04.json --scope-lock audits/cross-platform-universality-m1/scope-lock-PHASE-04.json --phase-id PHASE-04` was invoked in Step 5 and produced an `audits/` snapshot
- [ ] Combined cross-phase scan (scripts/ .ts + .agents/skills/ .md + AGENTS.md) returns 0 hits, with explicit UNAVAILABLE handling per §7
- [ ] Required receipts and hash bindings are retained
- [ ] This is the final implementation phase — no next phase dependency
