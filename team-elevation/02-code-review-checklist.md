# 02 · Code Review Checklist (per-PR template)

Copy the applicable tier into your PR description. A PR may merge only when **all Blockers + Majors are resolved** and at least one senior has approved.

Calibration: this checklist is aligned to the **current** work-one runtime as of 2026-07-11, not an imagined future-state pipeline.

Tiers: 🔴 Blocker · 🟠 Major · 🟡 Minor · ⚪ Nit

---

## 🔴 Blocker — must fix before merge
- [ ] **Type safety**: no new `: any` / `as any`; no `@ts-nocheck` added without an issue link.
- [ ] **Builds & type-checks**: `bun run lint` / `bun x tsc --noEmit` passes locally under the current config; the change does not worsen the strict-migration backlog.
- [ ] **Tests pass**: `bun run test` green; new tool/behavior has a focused test.
- [ ] **No secrets**: no tokens/keys/credentials committed (attestation pattern used instead).
- [ ] **No stray files**: no new `*.bak`, `*.tmp`, `*.bak-*` in the diff. Backup artifacts have landed in this repo before; do not reintroduce them.
- [ ] **DB safe**: new/changed tables go through `schema_version` migration; queries parameterized.
- [ ] **Grant model respected**: repo-mutating paths use `repo_operation_grants`, not raw `safe_shell`.

## 🟠 Major — fix or get explicit senior waiver
- [ ] **Single responsibility**: tool does one job; no feature logic in `before`/`after` handlers.
- [ ] **Error contract**: errors are typed or at least contextualized; no silent `catch {}` without a comment explaining the recovery path.
- [ ] **Handler performance**: `before` hooks don't block on slow network; use cached/DB state.
- [ ] **CI wired**: if quality tooling changes, `lint-test.yml`, `ci.yml`, and `framework-ci.yml` still pass. If you introduce a standalone gate job, make its required-check name stable and unique.
- [ ] **No new `TODO`** without a linked `tech-debt` issue.

## 🟡 Minor — should fix this PR or next
- [ ] Naming is descriptive (`safe_edit`, not `se`); no abbreviations only you understand.
- [ ] Function < ~60 lines; file < ~250 lines (split if over).
- [ ] Logging structured, no `console.log` left in (0 tolerance in tools/handlers).
- [ ] Comments explain **why**, not **what**.

## ⚪ Nit — optional polish
- [ ] Consistent formatting (Prettier/format-on-save).
- [ ] JSDoc on public tool entrypoints.

---

## Reviewer microscope (what seniors look for)

1. **Diff blast radius** — did a "small" change touch 15 files? Question it.
2. **Implicit `any` sneaking in via inference** — e.g. `JSON.parse(...)` untyped.
3. **Concurrency group collisions** in workflow edits. The repo recently had duplicate `lint-test-*` and `framework-ci-*` groups; the current working tree separates them, so verify new workflow edits do not reintroduce that class of collision.
4. **DB column/value arity** in INSERTs (past bug: mismatch swallowed by `INSERT OR IGNORE`).
5. **Behavioral drift** — does the change alter a `before`/`after` gate's allow/deny behavior? That's security-sensitive.
6. **Silent recovery paths** — a bare `catch {}` in tools/handlers/scripts should trigger a "what failure is being hidden?" review thread.

---

## Example PR comment (senior)

> ✅ Blocker checks pass; `bun run lint` green; `bun run test` green.
> 🟠 One major: `plugin-handlers/before/codegraph.ts` still hides enforcement-path failures behind a bare `catch {}`. Either document why this fallback is safe or surface a contextual warning so debugging stays tractable. Otherwise LGTM after that.
