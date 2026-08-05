# Phase PHASE-01: Runtime Import Fix [VERIFICATION]

**Phase ID**: `PHASE-01`
**Depends on**: NONE
**Outcome**: 6 TS files' static `/home/zhaoge` imports → `workspace-paths.ts` dynamic resolver
**Evidence level**: component
**Progression status**: `ACCEPTED`
**Completion receipt**: `audits/cross-platform-universality-m1/receipts/phase-01.json`
## 1. Input contract + source ledger

| Source | Exact path | Sections used | Authority |
|---|---|---|---|
| Blueprint | `blueprints/blueprint-cross-platform-universality.md` v3 | S2.1, S3 Phase 1, S4 XP-T-004 | requirements |
| Handoff | `handoff/native-windows-verification.md` | S1 (P0#1), 4 TS import lines | runtime evidence |
| Resolver | `scripts/lib/workspace-paths.ts` | full file | consume, not rewrite |
| Existing test | `scripts/test-serve/__tests__/bootstrap-import-source.test.ts` | full file | regression baseline |

## 2. Decisions, scope, and non-goals

### Decisions

| ID | Question | Upstream decision | Status |
|---|---|---|---|
| P1-DEC-001 | Replacement strategy | Each static `/home/zhaoge` import becomes an async IIFE `await (async () => { const target = pathToFileURL(resolve(workOneRoot, '<relative>')).href; return await import(target); })()`; top-level `await` cannot follow imports | CLOSED |
| P1-DEC-002 | Test fixture handling | Keep hardcoded `git -C /home/zhaoge/...` — test data, not runtime imports | CLOSED |
| P1-DEC-003 | `_d3_live.ts:23` OPENCODE_ROOT env | Keep `process.env.OPENCODE_ROOT || "/home/zhaoge/..."` fallback — env var, not a static import | CLOSED |
| P1-DEC-004 | Test for imported resolver | Use `pathToFileURL` + `resolve` from `node:path`/`node:url`; do not import workspace-paths.ts in the 6 files | CLOSED |

### In scope

- 6 files, 10 logical imports: 9 static ESM + dynamic `await import` at `test-hybrid-enforcement.ts:60`
- Static-import accounting: 1+1+1+4+2 = 9
- In `regress-parent-child.ts`, 4 static imports target `/home/zhaoge` (see Steps 4a-4e)
- Replacement: each static import becomes a `pathToFileURL(resolve(workOneRoot, relativePath)).href` IIFE

### Non-goals

- Do not rewrite `scripts/lib/workspace-paths.ts` itself
- Do not modify test fixture hardcoded paths in test files
- Do not modify `_d3_live.ts:23` env fallback
- Do not modify `audits/`, `e2e-evidence/`, `logs/`, historical evidence
- Do not touch `.agents/skills/` files (Phase 2 scope)
- Do not modify AGENTS.md

## 3. Verified current baseline

| Claim | Command | Result |
|---|---|---|
| 6 unique files contain static `/home/zhaoge` import | `python -c "import os,re; d=r'C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\scripts'; p=re.compile(r'from [\"\047]/home/zhaoge|require\([\"\047]/home/zhaoge|import\([\"\047]/home/zhaoge'); fs={f for r,_,fs in os.walk(d) for fn in fs if fn.endswith('.ts') and (f:=os.path.join(r,fn)) and p.search(open(f,'rb').read().decode('utf-8','ignore'))}; print(len(fs), sorted(fs))"` | 6 files (`\047` = `'`) |
| 10 logical imports total | source-inspected (python byte-level) | 9 static ESM + 1 dynamic await-import at test-hybrid-enforcement.ts:60 |
| regress-parent-child.ts accounting | source statement boundaries | 4 static: db L4, session-context L5-7, mcp-deliv L8-11, read-audit L12 |
| workspace-paths.ts resolver is available | `bun run scripts/lib/workspace-paths.ts --work-dir /home/zhaoge/workspace/opencode/work-one` (WSL) | resolves correctly |
| `bootstrap-import-source.test.ts` passes currently | `bun test scripts/test-serve/__tests__/bootstrap-import-source.test.ts` | passes (baseline); loads only `bootstrap.ts` — see §8 |
| `bun run typecheck` baseline | exit 1, 10 TS2307 in 6 files | baseline FAIL; §10 exit 0 |

## 4. End-to-end traceability

| Requirement | Check name | Evidence source | Happy fixture | Single mutation | Test ID |
|---|---|---|---|---|---|
| XP-REQ-001 | XP-RUNTIME-IMPORT | `bun test` + byte-level scan scripts/ | resolved paths valid | one path set /nonexistent | XP-T-001 |
| XP-REQ-002 | XP-RUNTIME-FIXTURE | `git -C` in test fixtures | hardcoded paths remain | wrong anchor | XP-T-001 |

## 5. File change inventory

| Exact path | Change | Anchor |
|---|---|---|
| `scripts/cleanup-regress.ts` | modify import at L1 | Replace `from '/home/zhaoge/...'` → `pathToFileURL(...)` IIFE |
| `scripts/diag-handover-path.ts` | modify import at L4 | Same pattern |
| `scripts/diag-schema.ts` | modify import at L1 | Same pattern |
| `scripts/regress-parent-child.ts` | modify 4 static imports: db L4, session-context L5-7, mcp-deliv L8-11, read-audit L12 | Same pattern (L7/L11 are continuations) |
| `scripts/test-hybrid-enforcement.ts` | modify import at L60 | Same pattern (await import) |
| `scripts/_d3_live.ts` | modify imports at L15,16 | Same pattern (2 lines) |

## 6. Numbered edit steps

**Strategy**: 6 files hold **10 logical imports: 9 static ESM + 1 dynamic await-import**. Each static import becomes an async IIFE — `pathToFileURL(resolve(workOneRoot, relativePath)).href` then `await import(target)` — while top-level static `node:`/resolver imports stay. `workOneRoot` via `resolveWorkspacePaths({ env: process.env })`.

**Canonical pattern** (all 10 imports):

```ts
// BEFORE (one example)
import { getDb } from '/home/zhaoge/workspace/opencode/work-one/.opencode/lib/db-manager';

// AFTER
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { resolveWorkspacePaths } from './lib/workspace-paths';
const { workOneRoot } = resolveWorkspacePaths({ env: process.env });

const { getDb } = await (async () => {
  const target = pathToFileURL(resolve(workOneRoot, '.opencode/lib/db-manager.ts')).href;
  return await import(target);
})();
```

Multi-line files: declare `node:url`/`node:path`/resolver/`workOneRoot` **once** at top; each load uses a fresh IIFE.

### Step 1–3, 4a, 6a — `getDb` from db-manager (4 files × 1 line)

Apply the pattern with `relativePath = '.opencode/lib/db-manager.ts'` and symbol `getDb` in `cleanup-regress.ts:1`, `diag-handover-path.ts:4`, `diag-schema.ts:1`, `regress-parent-child.ts:4`.

### Step 4b — `regress-parent-child.ts` L5-L7 (session-context multi-line import)

Apply the pattern with `relativePath = '.opencode/service/gate/session-context-service.ts'` and symbols `{ recordGateCallContext, computeGateArgsHash }`. L7 is the `} from` continuation.

### Step 4c — `regress-parent-child.ts` L8-L11 (mcp-deliv multi-line import)

L8-L11 = one logical import; L11 is the `} from` continuation. Apply the pattern once with `relativePath = '.opencode/service/gate/mcp-deliverables.ts'`, preserving all destructured symbols.

### Step 4d — `regress-parent-child.ts` L12 (`recordRead`)

Apply the pattern with `relativePath = '.opencode/service/file-guard/read-audit-write.ts'` and symbol `recordRead`.

### Step 4e — `regress-parent-child.ts` accounting guard

The file has exactly 4 static `/home/zhaoge` imports (L4 db, L5-L7, L8-L11, L12; L7/L11 are `} from` continuations) → exactly 4 dynamic loads, preserving the 10-logical accounting.

### Step 5 — `test-hybrid-enforcement.ts` L60 (already `await import(...)`)

Wrap the existing `await import("/home/zhaoge/.../tool-tracker.ts")` in the IIFE pattern with `relativePath = '.opencode/service/enforcement/tool-tracker.ts'`.

### Step 6a / 6b — `_d3_live.ts` L15 (`handle`) + L16 (`flushAll, getPluginLogPath`)

Apply the pattern twice in `_d3_live.ts`: L15 with `relativePath = '.opencode/plugin-handlers/before/tool-governance-handler.ts'` and `handle`; L16 with `relativePath = '.opencode/lib/log-manager.ts'` and `{ flushAll, getPluginLogPath }`.

### Step 7: Run verification (UNAVAILABLE-handled; see §7)

## 7. Fixed verification commands

Three outcomes per check (UNAVAILABLE always = FAIL):

| Outcome | Condition | Phase result |
|---|---|---|
| FOUND | cmd exits 0 AND query yields positive hit | per-check |
| NOT_FOUND | cmd exits 0 AND query yields 0 hits | per-check |
| UNAVAILABLE | cmd exits non-zero (missing binary, IO error, encoding) or output unparseable | **FAIL** — block |

```bash
cd C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan
# 1. Regression test (exit 0=PASS, else FAIL)
bun test scripts/test-serve/__tests__/bootstrap-import-source.test.ts

# 2. Byte-level scan of the 6 in-scope files: counts /home/zhaoge import statements in the 6-file inventory (§5), not all scripts/.ts (51 hits/33 files out of scope); the 7 residual non-import hits are allowlisted (§10).
python -c "
import os, re, sys
d = r'C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\scripts'
p = re.compile(r'from [\"\047]/home/zhaoge|require\([\"\047]/home/zhaoge|import\([\"\047]/home/zhaoge')
files = ['cleanup-regress.ts','diag-handover-path.ts','diag-schema.ts','regress-parent-child.ts','test-hybrid-enforcement.ts','_d3_live.ts']
try:
    import_hits = 0; residual_hits = 0; residual_lines = []
    for fn in files:
        f = os.path.join(d, fn)
        if not os.path.isfile(f): print(f'UNAVAILABLE: missing {f}', file=sys.stderr); sys.exit(2)
        for i, ln in enumerate(open(f,'rb').read().decode('utf-8','ignore').splitlines(), 1):
            if '/home/zhaoge' not in ln: continue
            if p.search(ln): import_hits += 1
            else: residual_hits += 1; residual_lines.append(f'{fn}:{i}')
    print(f'import_hits={import_hits} residual_hits={residual_hits}')
    print(f'RESIDUAL_ALLOWLIST={sorted(residual_lines)}')
    sys.exit(0 if import_hits == 0 else 1)
except (OSError, IOError, UnicodeDecodeError) as e:
    print(f'UNAVAILABLE: {e}', file=sys.stderr); sys.exit(2)
"
# PASS only when import_hits == 0 (exit 1/2 = FAIL). residual_hits are BY DESIGN (P1-DEC-002/003, comments).

# 3. Informational: .sh fixture presence (intentional; UNAVAILABLE non-blocking)
python -c "
import os, re, sys
d = r'C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\scripts'
p = re.compile(r'/home/zhaoge')
try:
    c = sum(len(p.findall(open(os.path.join(r,fn),'rb').read().decode('utf-8','ignore'))) for r,_,fs in os.walk(d) for fn in fs if fn.endswith('.sh'))
    print(f'sh_fixture_hits={c}')
except (OSError, IOError) as e:
    print(f'UNAVAILABLE: {e}', file=sys.stderr); sys.exit(2)
"
```

## 8. Single-failure mutation matrix

| Mutation | Expected result | Verification |
|---|---|---|
| Revert any 1 of the 10 logical imports to original static | `bun run typecheck` exit 1 (≥1 TS2307) | typecheck exit != 0 |
| Revert all 10 imports to original static | typecheck exit 1 with 10 TS2307 (baseline) | typecheck exit 1 |
| Fix all 10 imports to IIFE | typecheck exit 0 | typecheck exit 0 |
| Run `cleanup-regress.ts` with `WORK_ONE_ROOT` unset | Fail-closed `WORK_ONE_ROOT_INVALID` | resolver output |
| Leave `_d3_live.ts:23` env fallback unchanged | NOT a failure; by design | §7 step 3 |

Note: `bootstrap-import-source.test.ts` loads only `bootstrap.ts`; mutation uses `bun run typecheck` on the 6 targets.

## 9. Roll-back strategy

- **Per-file**: each import change is a single edit; revert with `git checkout -- <file>`
- **Batch**: `git checkout -- scripts/cleanup-regress.ts scripts/diag-handover-path.ts scripts/diag-schema.ts scripts/regress-parent-child.ts scripts/test-hybrid-enforcement.ts scripts/_d3_live.ts`
- **Verification**: After rollback, Python scan of the 6-file inventory should return 17 hits again (10 logical imports + 7 residual comments/fixtures/fallbacks)
- **Risk**: None — pure import-mechanism replacements

## Phase completion gate

- [x] `bun run typecheck` exit 0 (hard gate; baseline fails with 10 TS2307 — fix all 10 to be ACCEPTED)
- [x] `bun test scripts/test-serve/__tests__/bootstrap-import-source.test.ts` exit 0
- [x] Python scan of the 6 in-scope files returns 0 import hits for `/home/zhaoge` (import-scoped regex from §7 step 2). 7 residual non-import hits allowlisted (out of Phase-1 scope): `diag-handover-path.ts:7`, `regress-parent-child.ts:15`, `_d3_live.ts:23` = `OPENCODE_ROOT` env fallbacks (P1-DEC-003); `_d3_live.ts:35,36` = `git -C /home/zhaoge/...` fixtures (P1-DEC-002); `_d3_live.ts:9,10` = comments. Other scripts/.ts (51 hits/33 files) NOT scanned here — covered by Phase-4 combined scan.
- [x] .sh fixtures with `git -C /home/zhaoge/...` intentionally preserved (documented)
- [x] Mutation test (typecheck exit 1 if any 1 of 10 imports reverted) — §8
- [x] Required receipts and hash bindings retained
- [x] PHASE-02 may begin in parallel; PHASE-04 depends on PHASE-01 completion

### Prohibition on advancing before gate passes
- Do NOT begin PHASE-04 until PHASE-01 gate passes.
- PHASE-02 may proceed in parallel (no dependency on PHASE-01).
