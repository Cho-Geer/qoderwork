# Phase PHASE-01: Runtime Import Fix [VERIFICATION]

**Phase ID**: `PHASE-01`
**Depends on**: NONE
**Outcome**: 6 TS files with static `/home/zhaoge` imports replaced with `workspace-paths.ts` dynamic resolver
**Evidence level**: component
**Progression status**: `NOT_STARTED`
**Completion receipt**: `<receipt-path>` (required when status is `ACCEPTED`)

## 1. Input contract + source ledger

| Source | Exact path | Sections used | Authority |
|---|---|---|---|
| Blueprint | `blueprints/blueprint-cross-platform-universality.md` v3 | S2.1 (B layer), S3 Phase 1, S4 XP-T-004 | requirements |
| Handoff | `handoff/native-windows-verification.md` | S1 (P0#1), 4 TS import lines | runtime evidence |
| Resolver | `scripts/lib/workspace-paths.ts` | full file (377 lines) | consume, not rewrite |
| Existing test | `scripts/test-serve/__tests__/bootstrap-import-source.test.ts` | full file | regression baseline |

## 2. Decisions, scope, and non-goals

### Decisions

| ID | Question | Upstream decision | Status |
|---|---|---|---|
| P1-DEC-001 | Replacement strategy | Each previously-static `/home/zhaoge` import becomes `await (async () => { const target = pathToFileURL(resolve(workOneRoot, '<relative>')).href; return await import(target); })()`. `workOneRoot` is resolved at runtime via `resolveWorkspacePaths({ env: process.env })` from `scripts/lib/workspace-paths.ts`. The IIFE keeps static `node:` and resolver imports; top-level imports cannot follow `await`. | CLOSED |
| P1-DEC-002 | Test fixture handling | Keep hardcoded `git -C /home/zhaoge/...` in test fixtures; they are test data, not runtime imports | CLOSED |
| P1-DEC-003 | `_d3_live.ts:23` OPENCODE_ROOT env | Keep `process.env.OPENCODE_ROOT || "/home/zhaoge/..."` fallback as-is; it's an env var with fallback, not a static import | CLOSED |
| P1-DEC-004 | Test for imported resolver | Use `pathToFileURL` + `resolve` from `node:path` + `node:url`; do not import workspace-paths.ts in the 6 files (avoids circular dep risk) | CLOSED |

### In scope

- 6 files with 10 logical imports: 9 static ESM imports plus the existing dynamic `await import(...)` at `test-hybrid-enforcement.ts:60`
- Static-import accounting: `cleanup-regress.ts` 1, `diag-handover-path.ts` 1, `diag-schema.ts` 1, `regress-parent-child.ts` 4 (db L4, gate/context L5-7, mcp-deliv L8-11, read-audit L12), `_d3_live.ts` 2 = 9; the dynamic await-import is counted separately
- In `regress-parent-child.ts`, 4 static imports target `/home/zhaoge`: L4 (db-manager), L5-7 (session-context-service, L7 is `} from` continuation), L8-11 (mcp-deliverables, L11 is `} from` continuation), L12 (read-audit-write)
- Replacement: each static import becomes a `pathToFileURL(resolve(workOneRoot, relativePath)).href` call
- `workOneRoot` resolved via existing `scripts/lib/workspace-paths.ts` resolver (consume, not rewrite)

### Non-goals

- Do not rewrite `scripts/lib/workspace-paths.ts` itself
- Do not modify test fixture hardcoded paths in test files
- Do not modify `_d3_live.ts:23` env fallback
- Do not modify `audits/`, `e2e-evidence/`, `logs/`, historical evidence
- Do not touch `.agents/skills/` files (Phase 2 scope)

## 3. Verified current baseline

| Claim | Command | Result |
|---|---|---|
| 6 unique files contain static `/home/zhaoge` import | `python -c "import os,re; d=r'C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\scripts'; p=re.compile(r'''from '/home/zhaoge\|require\('/home/zhaoge\|import\('/home/zhaoge'''); fs={f for r,_,fs in os.walk(d) for fn in fs if fn.endswith('.ts') and (f:=os.path.join(r,fn)) and p.search(open(f,'rb').read().decode('utf-8','ignore'))}; print(len(fs), sorted(fs))"` | 6 files |
| 10 logical imports total | blueprint-authoritative logical accounting | 9 static ESM imports across 6 files + 1 dynamic await-import at test-hybrid-enforcement.ts:60 |
| regress-parent-child.ts accounting | source statement boundaries | 4 static imports: db-manager L4, session-context-service L5-7 (L7 is `} from` continuation), mcp-deliverables L8-11 (L11 is `} from` continuation), read-audit-write L12 |
| workspace-paths.ts resolver is available | `bun run scripts/lib/workspace-paths.ts --work-dir /home/zhaoge/workspace/opencode/work-one` (WSL) | resolves correctly |
| `bootstrap-import-source.test.ts` passes currently | `bun test scripts/test-serve/__tests__/bootstrap-import-source.test.ts` | currently passes (baseline); loads only `bootstrap.ts`, not the 6 Phase-1 files — see §8 mutation |
| `bun run typecheck` baseline | exit 1, 10 TS2307 in 6 files (L4, L7, L11, L12, L15, L16, L1×3, L60) | baseline FAIL; §10 requires exit 0 |

## 4. End-to-end traceability

| Requirement | Check name | Evidence source | Happy fixture | Single mutation | Test ID |
|---|---|---|---|---|---|
| XP-REQ-001 | XP-RUNTIME-IMPORT | `bun test` + Python byte-level scan scripts/ | resolved paths all valid | one resolved path set to /nonexistent | XP-T-001 |
| XP-REQ-002 | XP-RUNTIME-FIXTURE | `git -C` commands in test fixtures | hardcoded test paths remain | wrong anchor path | XP-T-001 |

## 5. File change inventory

| Exact path | Change | Anchor |
|---|---|---|
| `scripts/cleanup-regress.ts` | modify import at L1 | Replace `from '/home/zhaoge/...'` with `pathToFileURL(resolve(workOneRoot, relativePath)).href` |
| `scripts/diag-handover-path.ts` | modify import at L4 | Same pattern |
| `scripts/diag-schema.ts` | modify import at L1 | Same pattern |
| `scripts/regress-parent-child.ts` | modify 4 static imports: db L4, session-context L5-7, mcp-deliv L8-11, read-audit L12 | Same pattern (4 logical imports; L7 and L11 are continuations) |
| `scripts/test-hybrid-enforcement.ts` | modify import at L60 | Same pattern (await import) |
| `scripts/_d3_live.ts` | modify imports at L15,16 | Same pattern (2 lines) |

### Globally forbidden changes in this Phase

- Do not modify any `.agents/skills/` file
- Do not modify `scripts/lib/workspace-paths.ts`
- Do not modify `audits/`, `e2e-evidence/`, `logs/`
- Do not modify AGENTS.md

## 6. Numbered edit steps

**Strategy**: 6 files contain **10 logical imports: 9 static ESM + 1 dynamic await-import**. Replace each with an async IIFE: `pathToFileURL(resolve(workOneRoot, relativePath)).href` then `await import(target)`. `workOneRoot` is resolved at runtime via `resolveWorkspacePaths({ env: process.env })` from `scripts/lib/workspace-paths.ts`. The IIFE keeps the existing top-level static `node:` and resolver imports while loading the previously hardcoded `/home/zhaoge/...` modules dynamically.

**Canonical pattern** (used for all 10 logical imports; only the `relativePath` and destructured symbols differ):

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

For files with multiple replaced lines (regress-parent-child.ts, _d3_live.ts), declare `node:url`/`node:path`/resolver/`workOneRoot` **once** at the top; each dynamic load uses a fresh IIFE referencing the same `workOneRoot` (IIFEs do not share state).

### Step 1–3, 4a, 6a — `getDb` from db-manager (4 files × 1 line)

Apply the canonical pattern with `relativePath = '.opencode/lib/db-manager.ts'` and `getDb` as the destructured symbol, in `scripts/cleanup-regress.ts:1`, `scripts/diag-handover-path.ts:4`, `scripts/diag-schema.ts:1`, and `scripts/regress-parent-child.ts:4` (Step 4a).

### Step 4b — `regress-parent-child.ts` L5-L7 (`recordGateCallContext, computeGateArgsHash` multi-line import)

Apply the canonical pattern with `relativePath = '.opencode/service/gate/session-context-service.ts'` and `{ recordGateCallContext, computeGateArgsHash }` as the destructured symbols. L7 is the `} from '/home/zhaoge/...'` continuation of the import begun at L5; do not create extra IIFEs for L7 alone.

### Step 4c — `regress-parent-child.ts` L8-L11 (`submitDeliverables...` multi-line import)

Treat L8-L11 as one logical import statement; L11 is its `} from '/home/zhaoge/...'` continuation. Apply the canonical pattern once with `relativePath = '.opencode/service/gate/mcp-deliverables.ts'`, preserving all destructured symbols from that block.

### Step 4d — `regress-parent-child.ts` L12 (`recordRead`)

Apply the canonical pattern with `relativePath = '.opencode/service/file-guard/read-audit-write.ts'` and `recordRead` as the destructured symbol; reuse `workOneRoot` from Step 4a.

### Step 4e — `regress-parent-child.ts` accounting guard

The file contains 4 static imports targeting `/home/zhaoge`: L4 (db), L5-L7 (session-context, L7 is `} from` continuation), L8-L11 (mcp-deliv, L11 is `} from` continuation), L12 (read-audit). L7 and L11 are continuations, not new imports. The file therefore receives exactly 4 dynamic loads, preserving the 9-static + 1-dynamic = 10-logical accounting across all six files.

### Step 5 — `scripts/test-hybrid-enforcement.ts` L60 (already `await import(...)`)

Wrap the existing `await import("/home/zhaoge/.../tool-tracker.ts")` in the canonical IIFE pattern with `relativePath = '.opencode/service/enforcement/tool-tracker.ts'`. L60 stays an `await import` and is the 10th logical import.

### Step 6a / 6b — `scripts/_d3_live.ts` L15 (`handle`) + L16 (`flushAll, getPluginLogPath`)

Apply the canonical pattern twice in `scripts/_d3_live.ts`: L15 with `relativePath = '.opencode/plugin-handlers/before/tool-governance-handler.ts'` and `handle`; L16 with `relativePath = '.opencode/lib/log-manager.ts'` and `{ flushAll, getPluginLogPath }`. Declare the resolver imports and `workOneRoot` once at top; both IIFEs share the same `workOneRoot`.

### Step 7: Run verification (UNAVAILABLE-handled; see §7)

## 7. Fixed verification commands

Three outcomes per check (UNAVAILABLE always = FAIL, not pass-by-omission):

| Outcome | Condition | Phase result |
|---|---|---|
| FOUND | cmd exits 0 AND query yields positive hit | per-check |
| NOT_FOUND | cmd exits 0 AND query yields 0 hits | per-check |
| UNAVAILABLE | cmd exits non-zero (missing binary, IO error, encoding) or output unparseable | **FAIL** — block |

```bash
cd C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan
# 1. Regression test (exit 0=PASS, exit !=0=FAIL regardless of cause)
bun test scripts/test-serve/__tests__/bootstrap-import-source.test.ts

# 2. Python byte-level .ts scan (UNAVAILABLE-handled)
python -c "
import os, re, sys
d = r'C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\scripts'
p = re.compile(r'/home/zhaoge')
try:
    if not os.path.isdir(d): print(f'UNAVAILABLE: missing {d}', file=sys.stderr); sys.exit(2)
    c = sum(len(p.findall(open(os.path.join(r,fn),'rb').read().decode('utf-8','ignore'))) for r,_,fs in os.walk(d) for fn in fs if fn.endswith('.ts'))
    print(f'ts_hits={c}'); sys.exit(0 if c == 0 else 1)
except (OSError, IOError, UnicodeDecodeError) as e:
    print(f'UNAVAILABLE: {e}', file=sys.stderr); sys.exit(2)
"
# FAIL if exit 1 (FOUND) or 2 (UNAVAILABLE)

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
| Revert any 1 of the 10 logical imports to original static | `bun run typecheck` exit 1 (≥1 TS2307) | `bun run typecheck` exit != 0 |
| Revert all 10 imports to original static | `bun run typecheck` exit 1 with 10 TS2307 (matches baseline) | `bun run typecheck` exit 1 |
| Fix all 10 imports to IIFE | `bun run typecheck` exit 0 | `bun run typecheck` exit 0 |
| Run `cleanup-regress.ts` with `WORK_ONE_ROOT` unset | Fail-closed `WORK_ONE_ROOT_INVALID` | resolver output |
| Leave `_d3_live.ts:23` env fallback unchanged | NOT a failure; by design | §7 step 3 |

Note: `bootstrap-import-source.test.ts` does NOT load any of the 6 Phase-1 files (loads only `bootstrap.ts`); mutation uses `bun run typecheck` which directly compiles the 6 target files.

## 9. Roll-back strategy

- **Per-file**: Each file's import change is a single edit; revert with `git checkout -- <file>`
- **Batch**: `git checkout -- scripts/cleanup-regress.ts scripts/diag-handover-path.ts scripts/diag-schema.ts scripts/regress-parent-child.ts scripts/test-hybrid-enforcement.ts scripts/_d3_live.ts`
- **Verification**: After rollback, Python scan should return 10 hits again (baseline)
- **Risk**: None; imports are pure replacements — no logic changes beyond the import mechanism

## 10. Completion gate

- [ ] `bun run typecheck` exit 0 (hard gate; baseline fails with 10 TS2307 in 6 files — fix all 10 to be ACCEPTED)
- [ ] `bun test scripts/test-serve/__tests__/bootstrap-import-source.test.ts` exit 0
- [ ] Python scan of `scripts/.ts` returns 0 hits for `/home/zhaoge` (use `re.compile(r'/home/zhaoge')`; quote-bracket pattern returns 0 always)
- [ ] .sh fixtures with `git -C /home/zhaoge/...` intentionally preserved (documented)
- [ ] Mutation test (typecheck exit 1 if any 1 of 10 imports reverted) — see §8
- [ ] Required receipts and hash bindings retained
- [ ] PHASE-02 may begin in parallel; PHASE-04 depends on PHASE-01 completion

### Prohibition on advancing before gate passes
- Do NOT begin PHASE-04 until PHASE-01 gate passes.
- PHASE-02 may proceed in parallel (no dependency on PHASE-01).
