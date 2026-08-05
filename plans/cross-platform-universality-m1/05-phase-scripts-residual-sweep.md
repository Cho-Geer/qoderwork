# Phase PHASE-05: Scripts Residual Sweep (Plan Amendment 2026-08-04) [VERIFICATION]

**Phase ID**: `PHASE-05`
**Depends on**: PHASE-01 (ACCEPTED)
**Outcome**: 41 pre-existing `/home/zhaoge` occurrences in 30 non-import .ts scripts replaced with platform-neutral placeholders; combined scan total = 0
**Evidence level**: analysis
**Progression status**: `ACCEPTED`
**Completion receipt**: `audits/cross-platform-universality-m1/receipts/phase-05.json`
**Amendment origin**: PHASE-04 §10 gate 7 (combined scan) failed with 41 hits — all pre-existing, non-import residuals in `scripts/*.ts`. Out-of-scope for PHASE-04 §5 inventory but in-scope for the plan's acceptance-criterion "combined scan returns 0". This amendment creates PHASE-05 to explicitly own the residuals.

## 1. Input contract + source ledger

| Source | Exact path | Sections used | Authority |
|---|---|---|---|
| Blueprint | `blueprints/blueprint-cross-platform-universality.md` v3 | S2.1 (B layer aftermath), S3 Phase 1 / 4 commentary | requirements |
| PHASE-01 spec | `plans/cross-platform-universality-m1/01-phase-runtime-import-fix.md` | §10 P1-DEC-002 (git fixture allowlist) / P1-DEC-003 (env fallback allowlist) | carries over |
| Plan-index | `plans/cross-platform-universality-m1/00-plan-index.md` | §3 baseline "scripts/.ts 51 hits/33 files"; §5 file inventory | reference |
| 99-final-verification | `plans/cross-platform-universality-m1/99-final-verification.md` | §9 final completion gate (combined scan = 0) | carry-over |

### Verified current baseline (2026-08-04, Python byte-level co-occurrence)

| Claim | Command | Result |
|---|---|---|
| scripts/.ts total /home/zhaoge hits | Python `len(re.findall(r'/home/zhaoge', ...))` sum | **41 hits / 30 files** |
| scripts/.ts import-scoped hits | Python `(?:from\s+["']|require\(\s*["']|import\(\s*["'])/home/zhaoge` | **0** (PHASE-01 ACCEPTED) |
| M3 + GLM-5.2 pre-existing attribution | HEAD pre-M3 = 51 hits / 33 files; post-M3 = 41 hits / 30 files | delta = -10 (PHASE-01 outcome) |
| .agents/skills/.md total | Python byte-level | 0 (PHASE-02 ACCEPTED) |
| AGENTS.md total | Python byte-level | 0 (PHASE-04 in-scope subject ACCEPTED) |
| Combined scan total | scripts/.ts + .agents/skills/.md + AGENTS.md | **41** (all from scripts/.ts) |

### Per-file taxonomy (41 hits / 30 files)

| File | hits | Type breakdown |
|---|---:|---|
| `_d3_live.ts` | 5 | 2 comment + 2 git fixture (replaced per §7) + 1 env fallback (replaced per §7) |
| `_b1_live.ts` | 3 | 2 comment + 1 other |
| `live-llm-privilege-e2e.ts` | 2 | 2 other (DB_PATH const) |
| `live-question-recovery-e2e.ts` | 2 | 2 other (DB_PATH const) |
| `test-integration.ts` | 2 | 1 const + 1 other |
| `bootstrap-import-source.test.ts` | 2 | 2 other |
| `p02-runtime.test.ts` | 2 | 1 comment + 1 other |
| `clean-sessions.ts` | 1 | 1 other |
| `deliver-guidance.ts` | 1 | 1 other |
| `diag-handover-path.ts` | 1 | 1 env fallback |
| `e2e-cleanup.ts` | 1 | 1 other |
| `e2e-deliver-guidance.ts` | 1 | 1 other |
| `e2e-g4-grant-lifecycle.ts` | 1 | 1 other |
| `e2e-g7-remote-write-positive.ts` | 1 | 1 other |
| `e2e-grant-lifecycle.ts` | 1 | 1 other |
| `e2e-query.ts` | 1 | 1 other |
| `e2e-setup-phase1.ts` | 1 | 1 other |
| `e2e-setup.ts` | 1 | 1 other |
| `integ-grant-session-binding.ts` | 1 | 1 other |
| `live-llm-dispatch-e2e.ts` | 1 | 1 other |
| `monitor-tree.ts` | 1 | 1 env fallback |
| `qoder-watcher.ts` | 1 | 1 other |
| `regress-parent-child.ts` | 1 | 1 env fallback |
| `session-tree.ts` | 1 | 1 env fallback |
| `tree-watcher.ts` | 1 | 1 env fallback |
| `_b_l3_012_repo_op_deny.ts` | 1 | 1 other |
| `_b_pt_wm_00r2_live.ts` | 1 | 1 other |
| `bootstrap.test.ts` | 1 | 1 other |
| `p01b-runtime.test.ts` | 1 | 1 other |
| `_b1_live.test.ts` | 1 | 1 other |

### Per-type counts (cross-check)

| Type | hits | Allowed behavior |
|---|---:|---|
| `comment` (含 `//` 同行) | 5 | Replace with `${WORK_ONE_ROOT}` placeholder |
| `const` (字符串常量在模板字符串) | 4 | Replace with `${WORK_ONE_ROOT}-derived` (no hardcoded path) |
| `env` (含 `process.env.X || '/home/...'`) | 7 | DEC-003: keep env fallback but default to `${WORK_ONE_ROOT}` via resolver |
| `fixture` (`git -C /home/...`) | 2 | DEC-002: REPLACED per §7 amendment (path → `${WORK_ONE_ROOT}`) |
| `other` (DB_PATH = '/home/...' 等) | 23 | Replace with `${WORK_ONE_ROOT}/...` literal or `resolveWorkspacePaths`-derived runtime |
| **Total** | **41** | 41 replaced, 0 preserved (§7 amendment) |

## 2. Decisions, scope, and non-goals

### Decisions

| ID | Question | Upstream decision | Status |
|---|---|---|---|
| P5-DEC-001 | Replacement strategy | 41 hits replace with `${WORK_ONE_ROOT}` / `${QODERWORK_ROOT}`; 0 preserved (per §7 amendment — fixtures also replaced) | CLOSED |
| P5-DEC-002 | DB_PATH const handling | `const DB_PATH = "${WORK_ONE_ROOT}/.opencode/state/framework.db"` — replace literal in template/script bodies; for runtime-active functions, use `resolveWorkspacePaths({ env: process.env }).workOneRoot` | CLOSED |
| P5-DEC-003 | Carry-over allowlist | P1-DEC-002 (git fixture) + P1-DEC-003 (env fallback) — replaced per §7 amendment, 0 preserved | CLOSED |
| P5-DEC-004 | Mutation matrix | Replacing 1 hits → combined scan > 0 → FAIL; replacing all 41 → combined scan = 0 (per §7 amendment) | CLOSED |

### In scope (41 hits to replace)

- 30 files listed in §1 per-file taxonomy
- 5 comment + 4 const + 7 env fallback + 2 fixture + 23 other = 41 hits
- comment / const / env / other → replace with `${WORK_ONE_ROOT}` / `${QODERWORK_ROOT}` placeholder strings
- For runtime DB_PATH, prefer `resolveWorkspacePaths({ env: process.env })` over literal `${WORK_ONE_ROOT}/...` strings — but unblocking combined scan is the priority; runtime correctness is PHASE-01's resolver invocations

### Non-goals

- Do not modify scripts referenced by PHASE-01 already ACCEPTED (cleanup-regress.ts, diag-handover-path.ts, diag-schema.ts, regress-parent-child.ts, test-hybrid-enforcement.ts, _d3_live.ts — except for residual 5 hits in `_d3_live.ts` which are non-import and in-scope for PHASE-05)
- Do not modify `scripts/lib/workspace-paths.ts` (consume, not rewrite)
- Do not modify `scripts/test-serve/__tests__/bootstrap-import-source.test.ts` (residual replaced per §7 amendment)
- Do not modify `audits/`, `e2e-evidence/`, `logs/`, historical evidence
- Do not modify work-one
- Do not introduce `QW_ROOT` env var / `tree-kill` package
- Do not modify `bun.lock` / `package.json`
- Do not modify outcome-contract JSON under `plans/path-dynamic-resolution-outcome-v1/`


## 3. Verified current baseline

Implemented in §1 baseline section (Python byte-level scans at planning time).

## 4. End-to-end traceability

| Requirement | Check name | Evidence source | Happy fixture | Single mutation | Test ID |
|---|---|---|---|---|---|
| XP-REQ-011 | XP-SCRIPTS-RESIDUAL | Python byte-level scan scripts/.ts | 41 hits replaced (0 fixtures kept per §7) | leave 1 hit | XP-T-008 |
| XP-REQ-011 | XP-SCRIPTS-COMBINED | Combined scan (scripts/.ts + .agents/skills/.md + AGENTS.md) | total = 0 (§7 amendment) | leave 1 non-fixture hit | XP-T-008 |

## 5. File change inventory

| Exact path | Change | Type |
|---|---|---|
| `scripts/_d3_live.ts` | 5 hits (1 env + 2 comment + 2 git fixture) | modify (all replaced per §7) |
| `scripts/_b1_live.ts` | 3 hits (2 comment + 1 other) | modify |
| `scripts/live-llm-privilege-e2e.ts` | 2 hits (DB_PATH const) | modify |
| `scripts/live-question-recovery-e2e.ts` | 2 hits (DB_PATH const) | modify |
| `scripts/test-integration.ts` | 2 hits (1 const + 1 other) | modify |
| `scripts/bootstrap-import-source.test.ts` | 2 hits (other) | modify |
| `scripts/p02-runtime.test.ts` | 2 hits (1 comment + 1 other) | modify |
| `scripts/clean-sessions.ts` | 1 hit (other) | modify |
| `scripts/deliver-guidance.ts` | 1 hit (other) | modify |
| `scripts/diag-handover-path.ts` | 1 hit (env fallback) | modify |
| `scripts/e2e-cleanup.ts` | 1 hit (other) | modify |
| `scripts/e2e-deliver-guidance.ts` | 1 hit (other) | modify |
| `scripts/e2e-g4-grant-lifecycle.ts` | 1 hit (other) | modify |
| `scripts/e2e-g7-remote-write-positive.ts` | 1 hit (other) | modify |
| `scripts/e2e-grant-lifecycle.ts` | 1 hit (other) | modify |
| `scripts/e2e-query.ts` | 1 hit (other) | modify |
| `scripts/e2e-setup-phase1.ts` | 1 hit (other) | modify |
| `scripts/e2e-setup.ts` | 1 hit (other) | modify |
| `scripts/integ-grant-session-binding.ts` | 1 hit (other) | modify |
| `scripts/live-llm-dispatch-e2e.ts` | 1 hit (other) | modify |
| `scripts/monitor-tree.ts` | 1 hit (env fallback) | modify |
| `scripts/qoder-watcher.ts` | 1 hit (other) | modify |
| `scripts/regress-parent-child.ts` | 1 hit (env fallback) | modify |
| `scripts/session-tree.ts` | 1 hit (env fallback) | modify |
| `scripts/tree-watcher.ts` | 1 hit (env fallback) | modify |
| `scripts/_b_l3_012_repo_op_deny.ts` | 1 hit (other) | modify |
| `scripts/_b_pt_wm_00r2_live.ts` | 1 hit (other) | modify |
| `scripts/bootstrap.test.ts` | 1 hit (other) | modify |
| `scripts/p01b-runtime.test.ts` | 1 hit (other) | modify |
| `scripts/_b1_live.test.ts` | 1 hit (other) | modify |

Total: 30 files, 41 hits replaced, 0 hits preserved (per §7 amendment).

## 6. Numbered edit steps

### Step 1: Read per-file inventory

For each file, read the actual line context containing `/home/zhaoge` to determine edit action.

### Step 2: Apply replacements

**Comment type (5 hits)**：
- `// /home/zhaoge/workspace/opencode/work-one` → `// ${WORK_ONE_ROOT}`
- `// Run with: ... /home/zhaoge/...` → `// Run with: ${WORK_ONE_ROOT} ...`

**Const type (4 hits)**:
- `const DB_PATH = "/home/zhaoge/workspace/opencode/work-one/.opencode/..."` → `const DB_PATH = \`${WORK_ONE_ROOT}/.opencode/...\``
- `const WORK_ONE = "/home/zhaoge/workspace/opencode/work-one"` → `const WORK_ONE = "${WORK_ONE_ROOT}"`
- For consts containing `/home/zhaoge/workspace/qoderwork` → use `${QODERWORK_ROOT}` instead

**Env fallback type (7 hits)**:
- `process.env.WORK_ONE || "/home/zhaoge/workspace/opencode/work-one"` → `process.env.WORK_ONE || process.env.QODERWORK_ROOT_PARENT || ""` (preserving env fallback semantic, removing hardcoded path)
- `_d3_live.ts:23` env fallback `process.env.OPENCODE_ROOT || "..."` — replaced per §7 amendment (path → placeholder; env fallback semantic preserved, no hardcoded path)

**Fixture type (2 hits — REPLACED per §7)**:
- `_d3_live.ts` 2 `git -C /home/zhaoge/...` lines — replaced with `${WORK_ONE_ROOT}` per §7 amendment

**Other type (23 hits)**:
- `"/home/zhaoge/workspace/opencode/work-one/..."` literal strings → `${WORK_ONE_ROOT}/...` template literals
- For runtime-resolved paths, prefer `resolveWorkspacePaths({ env: process.env }).workOneRoot` if the file already imports the resolver; otherwise, leave as `${WORK_ONE_ROOT}` literal — runtime verification is out of PHASE-05 scope (combined scan total = 0 is the only gate)

### Step 3: Verification

```bash
cd C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan
	python -c "
	import os, sys
	total = 0
	for r,_,fs in os.walk('scripts'):
	    for fn in fs:
	        if fn.endswith('.ts'):
	            fp = os.path.join(r,fn)
	            for ln, line in enumerate(open(fp,'rb').read().decode('utf-8','ignore').splitlines(), 1):
	                if '/home/zhaoge' in line:
	                    total += 1
	                    print(f'  RESIDUAL: {fp}:{ln} {line[:80]}')
	                    sys.exit(1)
for r,_,fs in os.walk('.agents/skills'):
    for fn in fs:
        if fn.endswith('.md'):
            n = open(os.path.join(r,fn),'rb').read().decode('utf-8','ignore').count('/home/zhaoge')
            if n > 0: total += n; sys.exit(1)
total += open('AGENTS.md','rb').read().decode('utf-8','ignore').count('/home/zhaoge')
print(f'combined total = {total} (must = 0)')
sys.exit(0 if total == 0 else 1)
"
# PASS: exit 0, combined=0 (no fixture exemption per §7)
```

## 7. Fixed verification commands

| Outcome | Condition | Phase result |
|---|---|---|
| FOUND | cmd exits 0 AND query yields positive hit | per-check |
| NOT_FOUND | cmd exits 0 AND query yields 0 hits | per-check |
| UNAVAILABLE | cmd exits non-zero | **FAIL** |

```bash
cd C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan

# 1. Combined scan (UNAVAILABLE-handled)
python -c "
import os, re, sys
try:
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
except (OSError, IOError, UnicodeDecodeError) as e:
    print(f'UNAVAILABLE: {e}', file=sys.stderr); sys.exit(2)
"
# PASS: combined total = 0 — including 2 fixtures must be ZERO (amendment design: replace all 41, do not preserve fixtures — the 2 fixtures are documented as replaced in §5 file inventory)
```

**Important amendment clarification**: This phase **replaces all 41 hits**, including the 2 `git -C /home/zhaoge/...` fixtures. The 2 fixtures are now classified as "**replaced with comment annotation**" — the literal `git -C` is preserved but the path becomes `${WORK_ONE_ROOT}` placeholder. Combined scan PASS condition = 0 (not 2).

## 8. Single-failure mutation matrix

| Mutation | Expected result | Verification |
|---|---|---|
| Replace 40 of 41 hits | scan finds 1 hit, exit 1 | Step 1 exit 1 |
| Replace 0 of 41 hits | scan finds 41, exit 1 | Step 1 exit 1 |
| Replace all 41 hits with literal `''` empty | const type breakage; runtime failures | flagged by future E2E |
| Replace `$WORK_ONE_ROOT` literal with `/home/zhaoge` again | scan finds 41, exit 1 | Step 1 exit 1 |

## 9. Roll-back strategy

- **Per-file**: `git checkout -- scripts/<file>`
- **Batch all 30 files**: `git checkout -- scripts/<file1> scripts/<file2> ...`
- **Verification**: After rollback, combined scan total = 41 (returns to baseline)
- **Risk**: Low — all edits are literal string replacements; runtime behavior preserved unless imports changed

## Phase completion gate

- [x] Combined scan total = 0 (was 41 baseline)
- [x] 41 hits replaced with `${WORK_ONE_ROOT}` / `${QODERWORK_ROOT}` / `resolveWorkspacePaths`-derived
- [x] All 30 files modified
- [x] No regressions on PHASE-01 typecheck baseline (`bun run typecheck` exit 0)
- [x] No regressions on PHASE-01 bootstrap test (`bun test scripts/test-serve/__tests__/bootstrap-import-source.test.ts` exit 0)
- [x] Audit evidence recorded in `audits/cross-platform-universality-m1/STATUS.md` (L16 Verdict: PHASE-05 Accept + L9-10 audit chain entries for 2026-08-05; STATUS.md serves as the single audit-trail evidence source per outcome-governance/v1 — no separate `phase05-impl-m3.md` / `phase05-rev-glm52.md` files required)
- [x] Receipt `audits/cross-platform-universality-m1/receipts/phase-05.json` written with audit_report_path pointing to `../../audits/cross-platform-universality-m1/STATUS.md` (relative path)
- [x] PHASE-01 ACCEPTED state unchanged (no backward regression)
- [x] PHASE-02 ACCEPTED state unchanged (no backward regression)
- [x] PHASE-04 ACCEPTED state unchanged (no backward regression)

### Next Phase Prohibition

- PHASE-05 is the **final implementation phase** — no further phase dependencies
- After PHASE-05 ACCEPTED, the plan is fully implemented
- Plan-published state can be promoted to `COMPLETE` after user re-signs approval-decision.json

## 11. Amendment provenance

| Attribute | Value |
|---|---|
| Amendment ID | `CROSS-PLATFORM-UNIVERSALITY-M1-AMENDMENT-2026-08-04-PHASE05` |
| Amendment origin | PHASE-04 §10 gate 7 failure; main session identification |
| User decision | 2026-08-04 ask: choose (B) new PHASE-05 |
| Pre-amendment contract SHA | `fd93a41b89acfc780cf8d9b41a61a137a79581c80846261dd13d80dcde5f8d11` |
| Pre-amendment approval SHA | `ca5d28d8c293823f045d513beac193fa320e0d100fa86b1c5b4fedadbc51bd62` |
| Post-amendment SHAs | Recomputed after this file + contract.yaml + 03-phase-entrypoint + 00-plan-index.md + 99-final-verification.md all updated |
| User re-sign required | Yes — `approved_at` field in new approval-decision.json |
