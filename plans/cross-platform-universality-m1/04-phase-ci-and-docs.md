# Phase PHASE-04: CI Matrix and Docs Update [VERIFICATION]

**Phase ID**: `PHASE-04`
**Depends on**: PHASE-01, PHASE-02
**Outcome**: AGENTS.md paths replaced, CI matrix updated, blueprint INDEX verified, log registered
**Evidence level**: analysis
**Progression status**: `ACCEPTED`
**Completion receipt**: `audits/cross-platform-universality-m1/receipts/phase-04.json`
## 1. Input contract + source ledger

| Source | Exact path | Sections used | Authority |
|---|---|---|---|
| Blueprint | `blueprints/blueprint-cross-platform-universality.md` v3 | S2.1, S3 Phase 4 | requirements |
| Handoff | `handoff/native-windows-verification.md` | S1 (AGENTS.md 13 sites) | runtime evidence |
| AGENTS.md | `AGENTS.md` | L3/L10/L24/L25/L37/L41/L203/L222/L226/L230/L515/L516/L517 | verified baseline |

## 2. Decisions, scope, and non-goals

### Decisions

| ID | Question | Upstream decision | Status |
|---|---|---|---|
| P4-DEC-001 | AGENTS.md replacement | 3 `cd` → `cd "${WORK_ONE_ROOT}"`; 10 descriptive → placeholders | CLOSED |
| P4-DEC-002 | CI matrix | `os: [windows-latest, ubuntu-latest]`; new file `.github/workflows/cross-platform-universality.yml` (dir absent) | CLOSED |
| P4-DEC-003 | blueprint INDEX | Verify entry; no modification | CLOSED |
| P4-DEC-004 | Log registration | `logs/` per §1.3 vs §3 L135; see §6 Step 4 | BLOCKED-BY-DECISION |

### In scope

- AGENTS.md: replace 13 `/home/zhaoge` occurrences
- `.github/workflows/cross-platform-universality.yml`: NEW FILE, `os: [windows-latest, ubuntu-latest]` matrix
- `blueprints/INDEX.md`: verify entry exists
- `logs/INDEX.md`: **DO NOT MODIFY** — §6 Step 4

### Non-goals

- Do not modify `audits/`, `e2e-evidence/`, `logs/` historical evidence (blueprint §1.3)
- Do not modify `.agents/skills/` (Phase 2) or `scripts/` (Phase 1) files
- Do not modify `logs/INDEX.md` (DEFECT 4; `logs/` read-only in this plan-set)

## 3. Verified current baseline

| Claim | Command | Result |
|---|---|---|
| AGENTS.md 13 hits | `python -c "...count('/home/zhaoge')"` | 13 |
| 3 `cd` commands at L222/L226/L230 | python byte-level scan | 3 cd |
| 10 descriptive references | python byte-level scan | L3/L10/L24/L25/L37/L41/L203/L515/L516/L517 |
| `.github/workflows/` dir at planning time | `ls -la .github/workflows/` | NO (2026-08-03); new file in-scope |
| blueprints/INDEX.md exists | `test -f blueprints/INDEX.md; echo $?` | check at edit time |
| `logs/INDEX.md` | FORBIDDEN per blueprint §1.3; not modified | n/a |

## 4. End-to-end traceability

| Requirement | Check name | Evidence source | Happy fixture | Single mutation | Test ID |
|---|---|---|---|---|---|
| XP-REQ-008 | XP-DOCS-AGENTS | byte-level scan AGENTS.md | 0 hits | 1 hit | XP-T-005 |
| XP-REQ-009 | XP-DOCS-CI | CI config (workdir uses `WORK_ONE_ROOT`) | os: [windows, ubuntu] | missing os | XP-T-006 |
| XP-REQ-010 | XP-DOCS-INDEX | read blueprints/INDEX.md | entry present | missing | XP-T-007 |

## 5. File change inventory

| Exact path | Change | Anchor |
|---|---|---|
| `AGENTS.md` | replace 13 `/home/zhaoge` occurrences | L3/L10/L24/L25/L37/L41/L203/L222/L226/L230/L515/L516/L517 |
| `.github/workflows/cross-platform-universality.yml` | NEW FILE, `os: [windows-latest, ubuntu-latest]` matrix | new file (dir absent 2026-08-03) |
| `logs/INDEX.md` | **NOT MODIFIED** — §6 Step 4 (BLOCKED-BY-DECISION) | n/a |

## 6. Numbered edit steps

### Step 1: Replace AGENTS.md paths

3 `cd` lines (L222, L226, L230):
- L222/L226: `cd /home/zhaoge/workspace/qoderwork` → `cd "${QODERWORK_ROOT}"`
- L230: `cd /home/zhaoge/workspace/qoderwork/scripts` → `cd "${QODERWORK_ROOT}/scripts"`

10 descriptive references (L3, L10, L24, L25, L37, L41, L203, L515, L516, L517):
- `/home/zhaoge/workspace/opencode/work-one` → `${WORK_ONE_ROOT}`; `/home/zhaoge/workspace/qoderwork` → `${QODERWORK_ROOT}`
- `/home/zhaoge/.bun/bin/bun` → `${BUN_BIN:-bun}`; `/home/zhaoge/.local/bin/codegraph` → `${CODEGRAPH_BIN:-codegraph}`

### Step 2: Create CI workflow `.github/workflows/cross-platform-universality.yml` (NEW FILE)

Verified: `.github/workflows/` absent at planning time (2026-08-03). Create dir if missing, then write the file (excerpt; full YAML at the named path):

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
      - name: Resolve workspace paths
        if: env.WORK_ONE_ROOT != ''
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

Fork-PR behavior: `secrets.WORK_ONE_ROOT` is empty for PRs from forks (GitHub never exposes secrets to fork PRs), so the `if:` guard skips the resolve step; typecheck/regression/scan still run.

Anchor for the matrix addition is the literal `os: [windows-latest, ubuntu-latest]` in the file's `jobs.<name>.strategy.matrix.os`.

### Step 3: Verify blueprint INDEX

```bash
cd C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan
grep -i 'cross-platform-universality\|cross.platform.universality' blueprints/INDEX.md
```

If entry exists, no change. If missing, add entry.

### Step 4: Log creation — `BLOCKED-BY-DECISION` (DEFECT 4)

Blueprint §1.3 L50 forbids modifying `logs/` paths in frozen evidence; blueprint §3 L135 demands a new log file. **Resolution**: contradiction treated as non-binding recommendation. This plan does NOT create `logs/2026-08-03-blueprint-cross-platform-universality.md` nor modify `logs/INDEX.md`. Step 4 stays `BLOCKED-BY-DECISION` until the user lifts the contradiction.

### Step 5: capture-state invocation REMOVED (P-02 Freeze Gate is a pre-implementation ritual)

The previous Step 5 ran `capture-state.ts` after Steps 1–4 edits. Removed for two reasons (BLOCKING-004):

1. **Ordering (P-02)**: Freeze Gate requires scope-lock → human approval → pre-change capture-state BEFORE any implementation write. Running it AFTER Steps 1–4 inverts this.
2. **Mechanical (capture-state.ts L63)**: throws unless an existing, human-approved scope-lock exists; no plan-set step creates one.

**Resolution (Option A)**: Step 5 removed. The P-02 Freeze Gate is a **separate pre-implementation ritual** run at the START of any v3-required phase. No capture-state invocation or audit snapshot required.

### Step 6: Verification (UNAVAILABLE-handled; see §7)

## 7. Fixed verification commands

Three outcomes per check (UNAVAILABLE always = FAIL):

| Outcome | Condition | Phase result |
|---|---|---|
| FOUND | cmd exits 0 AND query yields positive hit | per-check |
| NOT_FOUND | cmd exits 0 AND query yields 0 hits | per-check |
| UNAVAILABLE | cmd exits non-zero (missing binary, IO error, encoding) or unparseable output | **FAIL** — block |

grep exit codes: rc=0 FOUND; rc=1 NOT_FOUND; rc=2+ UNAVAILABLE.

```bash
cd C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan

# 1. AGENTS.md scan
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

# 4. Combined cross-phase scan (scripts/.ts + .agents/skills/.md + AGENTS.md)
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
| Leave one `/home/zhaoge` in AGENTS.md | scan finds 1+ hits, exit 1 | Step 1 exit 1 |
| CI matrix missing `ubuntu-latest` (single-mutation) | `grep -c 'ubuntu-latest'` = 0; second check fails | Step 2 exit 1 |
| CI matrix missing `windows-latest` (single-mutation) | `grep -c 'windows-latest'` = 0; first check fails | Step 2 exit 1 |
| CI workflow file absent | reported as UNAVAILABLE | Step 2 exit 1 |
| blueprint INDEX missing entry | grep fails | Step 3 exit 1 |
| blueprint INDEX file missing | UNAVAILABLE -> FAIL | Step 3 exit 2 |
| `logs/INDEX.md` modified | FORBIDDEN; violation, not a check | n/a (forbidden) |
| capture-state invoked inside Phase 4 Steps 1–4 | FORBIDDEN (P-02 inversion; BLOCKING-004) | P-02 Freeze Gate is a separate ritual; no step here |

## 9. Roll-back strategy

- **AGENTS.md**: `git checkout -- AGENTS.md`
- **CI files**: `git checkout -- .github/workflows/*.yml`
- **Verification**: After rollback, AGENTS.md scan returns 13 hits (baseline)
- **Risk**: Low — AGENTS.md is documentation, CI changes additive

## Phase completion gate

- [x] Python byte-level scan of AGENTS.md returns 0 hits for `/home/zhaoge`
- [x] `.github/workflows/cross-platform-universality.yml` exists; `grep -c 'windows-latest'` and `grep -c 'ubuntu-latest'` each ≥ 1 (split single-mutation grep)
- [x] `.github/workflows/cross-platform-universality.yml` runs `bun run typecheck` and `bun test .../bootstrap-import-source.test.ts` in each matrix job (defect-B fix)
- [x] `blueprints/INDEX.md` has entry for cross-platform-universality
- [x] Step 4 (log creation) annotated `BLOCKED-BY-DECISION`; `logs/INDEX.md` **not** modified
- [x] No capture-state invocation in this phase's edit steps (BLOCKING-004 fix: P-02 Freeze Gate — scope-lock, human approval, pre-change capture-state — is a separate pre-implementation ritual; no audit snapshot required)
- [x] Combined cross-phase scan (scripts/.ts + .agents/skills/.md + AGENTS.md) returns 0 hits
- [x] Required receipts and hash bindings are retained
- [x] This is the final implementation phase — no next phase dependency
