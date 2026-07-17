# Tool Governance Phase 8/9 — Cross-Reference Audit and Remaining Work

## Cross-Reference Findings

### Phase 8: Instant Bug Fixes — ALL 3 ALREADY IMPLEMENTED

| Step | Blueprint Requirement | Actual Code Status | Verified By |
|------|----------------------|-------------------|-------------|
| 8.1 | `codegraph.ts` `isExemptPath()` add non-source file exemptions | DONE — lines 76-82 already contain `.gitignore`, `.gitattributes`, `package.json`, `tsconfig.json`, etc. | codegraph.test.ts: 9/9 PASS including `.gitignore`/`package.json`/`tsconfig.json` exemption tests |
| 8.2 | `safe_shell.ts` fix Zod v4 `record()` to dual-param | DONE — line 29: `tool.schema.record(tool.schema.string(), tool.schema.string())` | Import smoke PASS |
| 8.3 | `before-dispatcher.ts` move `tool-governance` after `permission-safety` | DONE — DEFAULT_ORDER matches blueprint spec exactly (lines 63-75) | `bun -e import` PASS |
| 8.3 | `project.config.json` sync before order | DONE — `plugin_execution_order.before` (lines 1907-1918) matches DEFAULT_ORDER exactly | Direct comparison |
| 8.4 | Add codegraph exemption tests | DONE — tests exist and pass | 9/9 PASS |

### Phase 9: Option A Security Hardening — ALL 3 ALREADY IMPLEMENTED

| Step | Blueprint Requirement | Actual Code Status | Verified By |
|------|----------------------|-------------------|-------------|
| 9.1 | `opencode.json` Orchestrator `node -e`/`node *.ts`/`node *.js` -> deny | DONE — lines 66-68: all three set to `"deny"` | grep confirms |
| 9.1 | `Orchestrator.md` update safe_shell description | DONE — line 106: "allow for read-only commands only (echo/cat/ls/head/tail/wc/find/grep/which/sha256sum)" | grep confirms |
| 9.2 | `shell-guard.ts` remove `isOrchestrator` + `allow-write` | DONE — `grep -c "isOrchestrator"` = 0, `grep -c "allow-write"` = 0 | grep confirms |
| 9.3 | `tool-scope-match.ts` writeApis regex add bracket notation | DONE — line 223-224 contains full hardened regex with bracket notation patterns | grep confirms |
| 9.3 | `shell-config.ts` WRITE_PATTERNS add bracket notation | DONE — lines 320-323 contain bracket notation patterns | grep confirms |
| 9.4 | `write-bypass-prevention.test.ts` | DONE — file exists, 5/5 PASS | bun test confirms |

### One Failing Test Found (caused by Phase 9 changes, not yet aligned)

**File**: `.opencode/lib/__tests__/safe-bash-core.test.ts` line 188-192

**Current (failing)**:
```typescript
it('should have Orchestrator extensions for node (from opencode.json)', () => {
  const result = getAgentShellAllowlist('@Orchestrator');
  expect(result.allowed).toContain('node *.js *');
});
```

**Fix needed**: This test expects `node *.js *` in the `allowed` list, but Phase 9 moved it to `deny`. Must update to assert `result.denied` instead.

### Untracked Files (need git staging per WG-01)

```
?? .opencode/service/file-guard/__tests__/
?? .opencode/service/file-guard/command-executor.ts
?? .opencode/service/file-guard/shell-plan.ts
?? .opencode/service/tool-governance/__tests__/shell-targets.test.ts
?? .opencode/service/tool-governance/__tests__/write-bypass-prevention.test.ts
?? .opencode/service/tool-governance/shell-targets.ts
```

---

## Task 1: Fix the Failing Test

**File**: `/home/zhaoge/workspace/opencode/work-one/.opencode/lib/__tests__/safe-bash-core.test.ts`

Replace lines 188-192:
```typescript
it('should have node *.js * in Orchestrator deny list (Phase 9: write via node removed)', () => {
  const result = getAgentShellAllowlist('@Orchestrator');
  // Phase 9 step 9.1: node -e/node *.ts/node *.js moved from allow to deny
  expect(result.denied).toContain('node *.js *');
  expect(result.denied).toContain('node -e *');
  expect(result.denied).toContain('node *.ts *');
  // Read-only commands remain allowed
  expect(result.allowed).toContain('cat *');
  expect(result.allowed).toContain('ls *');
});
```

**Verification**:
```bash
cd /home/zhaoge/workspace/opencode/work-one
bun test ./.opencode/lib/__tests__/safe-bash-core.test.ts
```

## Task 2: Full Regression Test Suite

Run the complete related test suite to confirm nothing else is broken:
```bash
cd /home/zhaoge/workspace/opencode/work-one
bun test ./.opencode/service/tool-governance/__tests__/*.test.ts \
  ./.opencode/plugin-handlers/before/__tests__/tool-governance-handler.test.ts \
  ./.opencode/plugin-handlers/before/__tests__/codegraph.test.ts \
  ./.opencode/plugin-handlers/before/__tests__/path-validate.test.ts \
  ./.opencode/lib/__tests__/safe-bash-core.test.ts \
  ./.opencode/service/file-guard/__tests__/*.test.ts
```

Expected: all tests pass (currently 105 pass + 1 fail, after fix should be 106+ pass, 0 fail).

## Task 3: Untracked File Inventory (WG-01)

No source code changes. Document which untracked files belong to the blueprint:
- `shell-targets.ts` + test — Phase 6 shared parser
- `shell-plan.ts` — Phase 7 VerifiedCommandPlan builder
- `command-executor.ts` — Phase 7 async execFile/spawn executor
- `file-guard/__tests__/` — Phase 7 execution tests
- `write-bypass-prevention.test.ts` — Phase 9 regression test

All 6 items are blueprint-related and should be staged by the reviewer.

## Summary

The blueprint's Phase 8 and Phase 9 code changes are **already fully implemented in the codebase**. The only gap is one stale test assertion that hasn't been updated to reflect Phase 9's permission changes. After fixing that test, the code-level implementation is complete. The remaining blueprint items (Task Cards WG-01 through WG-06) are all E2E evidence gathering, documentation, and audit tasks that don't involve source code changes.
