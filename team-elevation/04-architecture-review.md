# 04 · Architecture Review — work-one (runtime scan 2026-07-11)

**Method:** Direct inspection of `/home/zhaoge/workspace/opencode/work-one` via WSL + CodeGraph (`codegraph status/query/impact`, `rg`, `find`, `tsconfig.json`, `opencode.json`, `.github/workflows`). Findings below describe the **current runtime**, not the historical design blueprint. Severity: 🔴 High · 🟠 Medium · 🟡 Low · 🟢 Strength.

---

## Status Update (Re-audit after current framework update, 2026-07-11; verified 2026-07-12)

- **F1 fixed in the current working tree**: `lint-and-test.yml` removed; `lint-test.yml`, `ci.yml`, `framework-ci.yml`, and `quality-gate.yml` now all use distinct `concurrency.group` values.
- **F2 fixed in the current working tree**: direct PR-path quality gate added via `quality-gate.yml` + `.opencode/scripts/ci/run-quality-gates.ts`, which executes `runFullScan()` and `checkGateCompliance()` from service-layer code.
- **F5 fixed in the current working tree**: `.opencode/tools/safe_edit.ts.bak-pre-smoke2` removed.
- **F3 materially improved but not closed**: `.opencode/tools/**/*.ts` is now at **0** `: any` / `as any` hits, and repo-wide `bun run lint` / `tsc --noEmit` is green again under the current config. The remaining gap is that `tsconfig.json` is still `strict: false`.
- **F4 materially improved but not closed**: `.opencode/tools` + `.opencode/plugin-handlers` now have **0** bare `catch {}` blocks, but the current scan still finds **108** runtime-like bare catches outside tests/e2e across service/script paths.

---

## 🔴 F1 — CI topology had **two active concurrency collisions** in the initial scan
- `lint-test.yml` and `lint-and-test.yml` both trigger on `push`/`pull_request` to `main`/`develop`, and both use `concurrency.group: lint-test-${{ github.event_name }}-${{ github.ref }}`.
- `ci.yml` and `framework-ci.yml` also both trigger on `push`/`pull_request` to `main`/`develop`, and both use `concurrency.group: framework-ci-${{ github.event_name }}-${{ github.ref }}`.
- Result: at least **two workflow pairs can cancel each other** on the same ref. In addition, three workflows reuse the summary job name `CI Status Summary`, which makes required-check naming harder to reason about.
- **Fix:** collapse each pair to one canonical workflow or give every surviving workflow a unique concurrency group and unique required-check name. (Detailed in `05`.)
- **Status:** fixed in the current working tree.

## 🔴 F2 — PR CI did **not directly execute** the MCP quality gates in the initial scan
- The repo does contain active MCP server entrypoints for `code-quality-check` and `compliance-gate` under `.opencode/scripts/mcp-tools/`.
- At the initial scan, PR-path workflows did **not** run `code_quality_check.run_full_scan` or `compliance_gate_*` as standalone required jobs. What CI did then was:
  - `lint-test.yml` / `lint-and-test.yml` run TypeScript + Jest
  - `ci.yml` runs `framework-self-test.ts`
  - `framework-ci.yml` runs hook / LF / critical-file / WAL / semantic checks
- `framework-self-test.ts` validates gate bootstrap/config, but that is **not the same thing** as running the gates as first-class merge blockers.
- **Fix:** add a dedicated `quality-gate` job (or equivalent canonical framework job) that invokes the same underlying logic in non-interactive CI mode.
- **Status:** fixed in the current working tree via `quality-gate.yml` + `.opencode/scripts/ci/run-quality-gates.ts`.

## 🟠 F3 — TypeScript strictness is still off, even though the tool layer no longer leaks `any`
- `tsconfig.json` still has `"strict": false`.
- `.opencode/tools/**/*.ts` now contains **0** `: any` / `as any` hits after introducing a typed tool execution context and removing tool-local typing escapes.
- This is a real improvement at the tool boundary, and repo-wide typecheck is green again under the current config, but the compiler is still not enforcing the full safety model the team documents describe because strict mode remains off.
- **Fix:** staged strict migration per `01` §7, starting with tool/context boundaries.

## 🟠 F4 — Error-handling discipline is uneven; empty catches exist in active paths
- The repo does have **0 `console.log`** in `.opencode/tools` and `.opencode/plugin-handlers`, which is good.
- But the earlier "0 swallowed catches" claim is false. Active paths currently include bare `catch {}` blocks in places like:
  - several CI/framework scripts and service helpers
  - service-layer knowledge/session/file-guard paths that still silently ignore parse/update failures
- `.opencode/tools` and `.opencode/plugin-handlers` themselves are now at **0** bare `catch {}` blocks; the remaining backlog is outside the tool/handler layer.
- Risk: integrity or observability failures can be silently masked, especially around checklist wiring, codegraph enforcement, and runtime state maintenance.
- **Fix:** when a failure is intentionally ignorable, comment it; otherwise emit context or rethrow.

## 🟡 F5 — Backup artifact was committed in the tool directory during the initial scan
- `.opencode/tools/safe_edit.ts.bak-pre-smoke2` was present during the initial scan.
- It was not part of the TypeScript include set, but it cluttered the source tree and normalized backup-file drift.
- **Fix:** delete it and add a CI/commit-time guard for `*.bak*`.
- **Status:** fixed in the current working tree by removing the file.


## 🟡 F6 — Stray backup artifacts remain in active service paths (re-audit 2026-07-12)
- F5 addressed the backup artifact in `.opencode/tools/` (`safe_edit.ts.bak-pre-smoke2`), which is now removed.
- However, a re-audit on 2026-07-12 found **3 additional `.bak` files** in active source paths outside `.opencode/tools/`:
  - `.opencode/service/dispatch/prompt-builder.ts.bak-pre-t17`
  - `.opencode/service/enforcement/tool-tracker.ts.bak-phase3`
  - `.opencode/project.config.json.bak-pre-smoke1`
- These are not in the `.trash-phase0/` archive directory; they are in live source paths.
- They violate the "No stray files" standard documented in `01` §2 ("Delete `*.bak`, `*.tmp`, `*.bak-pre-*` from source").
- **Fix:** delete the 3 files and add a CI/commit-time guard for `*.bak*` across the entire `.opencode/` tree, not just `.opencode/tools/`.
- **Status:** new finding, not yet fixed.

## 🟢 S1 — Runtime shape is now explicit and easier to reason about
- `opencode.json` currently registers **5 agents** (1 custom `Orchestrator` + 4 native), **5 plugin entrypoints**, and the repo contains **37 custom tools** plus **18 skills**.
- This is a healthier operational surface than the older "many conceptual roles, unclear runtime registry" state.

## 🟢 S2 — Repo write governance is real, not aspirational
- `repo_operation_grants` / `repo_operation_events` exist in the DB schema.
- `safe_repo_stage`, `safe_repo_commit`, `safe_repo_push`, `safe_gh_pr_create`, and related tools are implemented and wired into policy/audit code.
- `git-guard.ts` explicitly blocks bypass patterns and points contributors back to the grant lifecycle.

## 🟢 S3 — Test and verification layers are broad
- `package.json` wires `bun run lint` and `bun run test`.
- The repo contains a large named test/spec/e2e surface across `.opencode/**`, and CI adds both `framework-self-test.ts` and `ci-semantic-validator.ts` style integrity checks.
- This is a solid base for ratcheting standards upward without flying blind.

## 🟢 S4 — Tool/handler logging is cleaner than the average TS repo
- `console.log` usage is absent from `.opencode/tools` and `.opencode/plugin-handlers`.
- The issue in this repo is not noisy logging; it's selective silent recovery. That is a much narrower cleanup target.

---

## Prioritized action list

| Pri | Finding | Effort | Owner track |
|-----|---------|--------|-------------|
| P0 | F1 collapse duplicate CI pairs / unique check names | S | Quality |
| P0 | F2 add direct quality-gate execution to PR path | M | Quality |
| P1 | F3 staged strict migration at tool/context boundaries | M | Platform |
| P1 | F4 remove or document silent recovery paths | M | Platform |
| P2 | F5 delete backup artifact + guard `*.bak*` | S | Platform |
| P2 | F6 delete service-path `.bak` files + widen `*.bak*` guard | S | Platform |

After the current remediation pass, **F1/F2/F5 are fixed**, **F3 has been pushed down to the strict-mode gap itself**, **F4 is narrower than before (108 → target 0)**, and **F6 is a new finding** (service-path `.bak` files). The remaining leverage is now less about tool wrappers and more about enabling stricter compiler settings, cleaning silent recovery in service/script internals, and removing stray backup artifacts from service paths.

**Bottom line:** the framework is not short on infrastructure; it is short on **operational consolidation**. The next leverage point is not inventing new systems, but making the existing typing, gate, and error-signaling layers line up with one another.
