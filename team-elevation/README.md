# Team Technical Elevation Pack

**Owner:** Senior Developer (高级开发工程师)
**Scope:** work-one / QoderWork engineering org
**Date:** 2026-07-11
**Purpose:** Raise the team's technical level through four pillars — Code Quality Standards, Code Review Discipline, a Skill Leveling Roadmap, and enforced CI Quality Gates.

---

## How to use this pack

| # | Document | Pillar | Read it when… |
|---|----------|--------|---------------|
| 01 | `01-code-quality-standards.md` | Quality Ctrl | Defining "good" code for new contributors |
| 02 | `02-code-review-checklist.md` | Quality Ctrl | Reviewing a PR (use as the review template) |
| 03 | `03-skill-roadmap.md` | Skill Roadmap | Planning hiring, promotions, or 1:1 growth |
| 04 | `04-architecture-review.md` | Arch Review | Prioritizing refactors / tech-debt sprints |
| 05 | `05-ci-quality-gates.md` | CI Gates | Hardening the merge pipeline |

Start with **04** (it's grounded in a real runtime scan of the repo) so the rest has context.

---

## TL;DR — what the repo scan found

A live inspection of `/home/zhaoge/workspace/opencode/work-one` surfaced these signals:

**Strengths (protect these):**
- 37 custom tools + 18 skills + 5 plugin entrypoints + DB-backed repo grant lifecycle — the runtime surface is explicit and governable.
- 0 `console.log` in tools/handlers — clean operational logging discipline.
- `codegraph`, `compliance-gate`, `code-quality-check`, framework self-test, semantic validator, and now a dedicated `Quality Gate` workflow all exist.

**Status after the current remediation pass (working tree):**
- ✅ duplicate CI collision pairs removed or separated by unique `concurrency.group`
- ✅ direct PR-path `Quality Gate` workflow added
- ✅ stray backup file removed from `.opencode/tools/`
- ✅ tool-layer `: any` / `as any` hits reduced to 0
- ✅ bare `catch {}` removed from `.opencode/tools` and `.opencode/plugin-handlers`
- ✅ repo-wide `bun run lint` / `tsc --noEmit` is green again under the current config

**Remaining risks (详见 `04` / `05`):**
- 🟠 `strict: false` in `tsconfig.json`, so the compiler still isn't enforcing the target safety bar even though the current config now type-checks cleanly.
- 🟠 Bare `catch {}` blocks still exist in active service/script paths; current runtime-like count outside tests/e2e is 108.
- 🟠 Stray backup files (`.bak`) exist in active service paths: `service/dispatch/prompt-builder.ts.bak-pre-t17`, `service/enforcement/tool-tracker.ts.bak-phase3`, and `project.config.json.bak-pre-smoke1`. F5 only covered `.opencode/tools/` cleanup; these service-path artifacts violate the "No stray files" standard (§01.2).

---

## Rollout order (recommended)

1. **Week 1** — Adopt `02-code-review-checklist.md` as the PR template; collapse duplicate CI workflow pairs and stabilize required-check names.
  Status: done in the current working tree.
2. **Week 2** — Add a direct `quality-gate` CI job for `code-quality-check` + `compliance-gate`; turn on branch protection.
  Status: workflow added in the current working tree; branch protection still needs repo-side configuration.
3. **Week 3+** — Publish `01-code-quality-standards.md`; continue staged `strict` migration and empty-catch cleanup.
4. **Ongoing** — Map team members onto `03-skill-roadmap.md`; weekly senior-led review + pairing.

---

## Definition of done for "elevated team"

- Every PR passes the checklist + CI gates before merge.
- `tsc --noEmit` runs in `strict` mode and is green.
- No silent recovery path ships without being intentional, commented, and review-approved.
- Each engineer can name their next-level competency from the roadmap.
