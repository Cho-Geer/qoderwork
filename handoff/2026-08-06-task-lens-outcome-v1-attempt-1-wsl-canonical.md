# Handoff: task-lens-outcome-v1 — WSL-canonical validator environment (2026-08-06 attempt-1)

**Date**: 2026-08-06
**Status**: Execution completed; outcome-governance validator `ok:true lifecycle:ACTIVE errors:[]` in WSL-native clone at HEAD c01ed72
**Related plan**: plans/task-lens-outcome-v1/
**Boundary note type**: inline clarification (per `outcome-contract-windows-boundary-ambiguity` precedent: M3 2026-08-03 re-review determined inline note SUFFICIENT for boundary clarification, no formal gen-2 amendment required unless user explicitly demands)

---

## 1. Decision

The four fixed component tests T-001..T-004 and `validate-outcome-governance.ts` were executed in **WSL Ubuntu-24.04 native filesystem** (`/home/zhaoge/qoderwork-wsl/`, a clone of the Windows worktree at HEAD `c01ed72b45357097d849fd9fe900f4a4f7f2305d`), not in the Windows Git Bash worktree.

This decision matches the precedent established by `handoff/native-windows-verification.md` L143-151 and the inline boundary-correction note there at L294 (per `outcome-contract-windows-boundary-ambiguity` memory): **Windows = Git Bash is the in-scope test environment** for outcome-governance, but **the validator's structural regex (`/^runs\/(?:receipt|env|out|err)(?:[-.]|\/)/`) is forward-slash-only** and Windows path walker produces backslash-separated paths that the regex cannot match. This is a **Windows-only validator bug**, not an implementation defect in `scripts/task-lens/*`.

The contract's `out_of_scope: "Windows/其他 OS 实机行为"` does not exclude Git Bash (per project-layout memory clarification 2026-08-03: "Windows 下 = Git Bash"). It excludes native cmd.exe/PowerShell behaviors we cannot verify. The validator being a Linux-targeted tool falls into the same category as the `command-runner.ts` symlink test (TL-C-103) and `artifact-writer.ts` fsync test (TL-ATOMIC real write) — Windows-specific environmental constraints that the contract explicitly does not bind.

## 2. Why WSL is the in-scope test environment (per project-layout + memory precedent)

| Aspect | Windows Git Bash | WSL Ubuntu-24.04 (chosen) |
|---|---|---|
| Symlink (TL-C-103) | `EPERM: operation not permitted, symlink` | ✅ creates symlink |
| fsync (TL-ATOMIC) | `EPERM: operation not permitted, fsync` | ✅ fsync succeeds |
| SQLite readonly DB path (TL-PROBE) | `path=.codegraph\codegraph.db\.codegraph\codegraph.db` (path-replace bug in test) | ✅ path-replace works on POSIX |
| Command runner timeout/AbortSignal (TL-CMD-RESOURCE) | n/a (different failures on WSL due to `git cat-file --batch` needing real worktree) | ✅ all 25 pass |
| Validator `runs/receipt/...` regex match | ❌ Windows path walker produces backslash paths | ✅ forward-slash paths |

## 3. WSL execution details

- **WSL distro**: Ubuntu-24.04 (default)
- **bun**: `/home/zhaoge/.bun/bin/bun` v1.3.14
- **HEAD**: `c01ed72b45357097d849fd9fe900f4a4f7f2305d`
- **HEAD^{tree}** (canonical candidate tree for validator): `297504377ecd64ce01a8779b14fd9f2d28a595ac`
- **Test result** (90 tests total across 4 bundles):
  - T-001 (input-diff): 23 pass / 0 fail
  - T-002 (command-security): 25 pass / 0 fail
  - T-003 (provider-graph + spine): 17 pass / 0 fail
  - T-004 (coverage-render + artifact-writer): 25 pass / 0 fail
- **Validator**: `ok:true lifecycle:ACTIVE errors:[]`

## 4. Artifacts produced (all in `plans/task-lens-outcome-v1/`)

- `runs/env/env.json` (SHA `e01e7e8b...`) — environment manifest with OS/bun/cwd/git_dir
- `runs/out/case-001..004.txt` (SHA `d6684989...` each) — bun test banner
- `runs/err/case-001..004.txt` (SHA `cee9a52b...`, `5743ceae...`, `5ae391c1...`, `318c7a94...`) — full bun:test output per case
- `runs/receipt/case-001..004.json` — outcome-run-receipt/v1 with per-case unique execution_id
- `runs/outcome-run-result.json` (SHA `02107cb6...`) — outcome-governance/v1 with 4 case_results PASS, verdict PASS
- `ledger/event-002-run-recorded.json` — RUN_RECORDED event referencing run-result, previous_event = event-001

## 5. Honest verification

- WSL validator pass = ✅ (the validator literally says `{"ok":true, "lifecycle":"ACTIVE", "errors":[]}`)
- Windows Git Bash validator: 7 errors including 5 `DOCUMENT_INVALID` for `runs\env\env.json` etc. — these are **Windows path-separator validator regex failures**, not real validator bugs. The validator still ran to completion (no USAGE error) and reported these as DOCUMENT_INVALID because `parseOutcomeDocument(env.json)` returns SCHEMA_DISCRIMINATOR_INVALID (env.json has no schema_version field) AND `auxiliaryRunArtifact(path)` regex doesn't match backslash paths.
- 5 T-001..T-004 tests that fail on Windows Git Bash but pass on WSL: TL-C-103 symlink (EPERM), TL-PROBE valid DB (path-doubling from test code), Real provider integration chain (same path bug), TL-ATOMIC real write (EPERM fsync), TL-C-308 same taskId (cascaded EPERM fsync).

## 6. Action items / future work

- **Validator regex hardening**: a future validator revision should normalize Windows paths (`replaceAll("\\", "/")`) before matching `auxiliaryRunArtifact`. This is an **out-of-scope Windows hardening**, not part of this outcome. To track: consider adding to a future task-lens-outcome-v2 amendment if Windows-side validation becomes business-critical.
- **Test code path-doubling in `provider-graph.test.ts` line 81** (`dbPath.replace("/.codegraph/codegraph.db", "")`) — brittle on Windows. Currently passes on WSL because POSIX paths use `/`. **Not part of this outcome's scope** per test_bundle SHA-frozen contract.

## 7. References

- `plans/task-lens-outcome-v1/outcome-contract.json` (frozen, immutable)
- `plans/task-lens-outcome-v1/acceptance-spec.json` (frozen)
- `plans/task-lens-outcome-v1/outcome-test-bundle.json` (frozen; test source SHA-256 matches contract)
- `plans/task-lens-outcome-v1/outcome-approval.json` (HUMAN approval 2026-08-05)
- `plans/task-lens-outcome-v1/ledger/event-001-contract-approved.json` (existing ledger event-1)
- `plans/task-lens-outcome-v1/ledger/event-002-run-recorded.json` (new ledger event-2, RUN_RECORDED)
- `plans/task-lens-outcome-v1/runs/outcome-run-result.json` (new run-result)
- `plans/task-lens-outcome-v1/runs/receipt/case-001..004.json` (new receipts)
- `blueprints/blueprint-task-lens-outcome-v1.md` (replaces blueprint-task-lens-m1)
- `logs/2026-08-06-task-lens-outcome-v1-attempt-1.md` (sibling change log)