# 05 · CI Quality Gates (current-state design)

Goal: make "bad code can't merge" the *default*, not a hope. This revision is grounded in the **actual** 2026-07-11 workflow topology described in `04`, not an assumed greenfield CI setup.

---

## Status Update (Post-Remediation, 2026-07-11)

Implemented in the current working tree:
- `lint-and-test.yml` removed
- `lint-test.yml`, `ci.yml`, `framework-ci.yml`, and `quality-gate.yml` now use distinct `concurrency.group` values
- `.github/workflows/quality-gate.yml` added
- `.opencode/scripts/ci/run-quality-gates.ts` added and wired into CI
- `quality-gate` now executes batch-safe service-layer logic: `runFullScan()` + `checkGateCompliance()`
- repo-wide `bun run lint` / `tsc --noEmit` is green again under the current config
- `.opencode/tools/**/*.ts` now has 0 `: any` / `as any` hits
- `.opencode/tools` + `.opencode/plugin-handlers` now have 0 bare `catch {}` blocks

Still optional future work:
- merge `ci.yml` and `framework-ci.yml` further if the team wants fewer workflows
- add a single aggregate `framework-summary` job if branch-protection ergonomics require one required check instead of multiple framework jobs

---

## 1. Initial finding: there were **two collision pairs** to fix

Initial scan state:
- `lint-test.yml` and `lint-and-test.yml` share `concurrency.group: lint-test-${{ github.event_name }}-${{ github.ref }}`
- `ci.yml` and `framework-ci.yml` share `concurrency.group: framework-ci-${{ github.event_name }}-${{ github.ref }}`
- three workflows also reuse the summary job name `CI Status Summary`

Immediate action:
1. Delete `lint-and-test.yml` and keep one canonical lint/test workflow.
2. Either merge `ci.yml` + `framework-ci.yml`, or give them unique groups **and** unique required-check names while the merge is pending.
3. Rename summary jobs to stable names such as `lint-test-summary` and `framework-summary` so branch protection is unambiguous.

If a temporary transition is required, use distinct groups:
- `lint-test.yml` → `group: lint-test-${{ github.ref }}`
- `framework-ci.yml` → `group: framework-checks-${{ github.ref }}`
- `ci.yml` → `group: framework-self-test-${{ github.ref }}`

---

## 2. What the required checks should reflect now

The current repo now has four kinds of checks:

```text
lint/test         → TypeScript + Jest
framework checks  → hooks / LF / critical files / WAL / semantic validator
framework self-test → framework bootstrap / registry / integrity assertions
quality gate      → direct code-quality + compliance batch wrapper
```

The initial gap from the audit has now been closed: PR CI does directly run the quality-gate logic behind `code-quality-check` and `compliance-gate` through a batch-safe wrapper.

Recommended required checks after consolidation remain:

```text
lint-test-summary   → lint + test aggregate                [hard gate]
framework-summary   → framework integrity aggregate        [hard gate]
quality-gate        → direct code-quality + compliance run [hard gate, NEW]
```

---

## 3. Do not invoke the MCP server entrypoints directly in CI

Important repo fact: the current files
- `.opencode/scripts/mcp-tools/code-quality-check.ts`
- `.opencode/scripts/mcp-tools/compliance-gate.ts`

are **stdio MCP servers**, not simple one-shot CLI scripts. In CI, the right pattern is:

1. extract or reuse the underlying service-layer logic
2. call that logic from a thin non-interactive Bun wrapper
3. make that wrapper the required `quality-gate` job

So the old idea of "just run the MCP file as if it were a CLI command" is too hand-wavy for this repo.

---

## 4. Suggested end-state workflow layout

### Workflow A — `lint-test.yml`
- `lint`
- `test`
- `lint-test-summary`
  Status: implemented as `Lint & Test Summary`

### Workflow B — `framework-ci.yml` + `ci.yml`
- `hook-path-check`
- `lf-check`
- `critical-files-check`
- `wal-check`
- `semantic-validator`
- `framework-self-test`
  Status: currently split across `framework-ci.yml` and `ci.yml`; collisions are fixed, consolidation is optional follow-up.

### Workflow C — `quality-gate.yml` (new)
- `quality-gate`
  - runs a thin Bun wrapper such as `bun .opencode/scripts/ci/run-quality-gates.ts`
  - that wrapper should call the same underlying logic used by `code-quality-check` and `compliance-gate`
  Status: implemented.

If the team prefers fewer workflows, B and C can be combined, but the key is:
- unique concurrency groups
- unique required-check names
- direct execution of the gate logic

---

## 5. Minimal sample for the new gate job

```yaml
quality-gate:
  name: Quality Gate
  runs-on: ubuntu-latest
  timeout-minutes: 15
  needs: [lint, test]
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v2
      with:
        bun-version: latest
    - run: bun install
    - run: bun .opencode/scripts/ci/run-quality-gates.ts
```

Implementation note:
- `run-quality-gates.ts` does **not** need to speak MCP over stdio
- it should import/call the same service-layer code the MCP servers wrap
- that keeps CI deterministic and avoids pretending an interactive transport is a batch interface

---

## 6. Branch protection (the part that actually blocks merges)

In GitHub repo settings → Branches → `main`:
- ✅ Require status checks: `Lint & Test Summary`, `Framework Self-Test Summary`, `Quality Gate`
- ✅ Require a pull request before merging
- ✅ Require ≥ 1 approval from a member with **Senior** role (see `03`)
- ✅ Dismiss stale approvals on new commits
- ✅ No force-push, no deletion of `main`
- ✅ Require conversation resolution

If the team also wants framework integrity checks to gate merges, require the relevant jobs from `framework-ci.yml` explicitly until or unless a future `framework-summary` aggregate is added.

---

## 7. Pre-commit and local fast-fail

Add `lint-staged` + a formatter so obvious issues never reach CI:

```jsonc
// package.json
"lint-staged": {
  "*.ts": ["bun x prettier --write", "bun x tsc --noEmit"]
}
```

Also reject `*.bak*` / `*.tmp` at commit time via a hook, because backup artifacts have already appeared in-source before.

---

## 8. Metrics to watch

- duplicate workflow count (target: 0)
- required-check name collisions (target: 0)
- `tsc` strict error count (trend ↓ to 0)
- tool-layer `any` count (hold at 0)
- runtime-like bare `catch {}` count outside tests/e2e (trend ↓ from 108)
- CI gate pass rate & median duration
- PRs blocked by `quality-gate` (should be > 0 once enabled, or the gate is not biting)
