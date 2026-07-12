# 01 · Code Quality Standards (work-one / QoderWork)

These are the team's "definition of good." They are intentionally opinionated and tailored to our stack: **TypeScript on Bun, OpenCode tools/plugin-handlers/agents, SQLite (DB-canonical), Jest**.

Important calibration: this document is the **target bar**, not a claim that every current file already conforms. Where the live repo still differs, that drift is called out explicitly so reviewers can distinguish **current fact** from **desired standard**.

---

## 1. TypeScript discipline

| Rule | Standard | Why |
|------|----------|-----|
| Strict mode | **Target:** `tsconfig.json` → `strict: true`. **Current runtime:** `strict: false` (migrate in stages, see §7) | Catch null/undefined & implicit `any` at compile time |
| No `any` | Ban `: any` and `as any`. **Current snapshot:** 0 hits remain in `.opencode/tools/**/*.ts` after the typed tool-context cleanup; keep it there | Type leaks defeat the type system |
| Explicit returns | New or materially changed functions should declare return types | Self-documenting contracts |
| Prefer `const` | `let` only when reassigned; no `var` | Immutability by default |
| Exhaustive switch | Use `never` check on the default branch | No silent unhandled cases |

**Tool pattern** — target end-state for each `.opencode/tools/*.ts`:
- Declare a typed input schema (zod or interface) — no positional/untyped args.
- Return a structured result `{ ok: boolean, data?, error? }` — never throw across the tool boundary silently.
- Be idempotent where possible (re-running is safe).

---

## 2. Structure & single responsibility

- **One tool = one job.** `safe_edit`, `safe_delete`, `safe_restore` are good models — narrow, named, safe-wrapped.
- **No business logic in plugin-handlers.** `before/*` and `after/*` intercept; they validate/observe, they don't implement features. Treat the current 22 `before` + 19 `after` handlers as an interception surface, not a feature surface.
- **Lib is for shared code.** `.opencode/lib/*.ts` (51 modules) holds reusable utilities — no tool-specific code duplicated there.
- **No stray files.** Delete `*.bak`, `*.tmp`, `*.bak-pre-*` from source. Backup artifacts have already slipped into the repo once; keep CI and review pressure high so they do not return.

---

## 3. Error handling contract

- Prefer **typed or contextual errors** (`class ToolError extends Error { code: string }`), not raw strings.
- `before` handlers must fail *fast* and *locally* — never block on slow network calls; gate async checks via cached/DB state.
- Always attach `context` (tool name, target path, grant id) to errors for debuggability.
- Empty `catch {}` blocks should be exceptional and justified. Current active examples still exist (for example `plugin-handlers/before/codegraph.ts` and several service/session helpers); do not copy that pattern into new code.

---

## 4. Database (SQLite, DB-canonical)

- **Migrations only** via `schema_version` (already in `db-manager.ts`). Never hand-edit schema in place.
- **Parameterized queries only** — no string interpolation into SQL.
- Wrap multi-statement writes in a **transaction**.
- The `tool-tracker.ts` INSERTs must use matching column/value counts (a past arity bug showed `INSERT OR IGNORE` hides failures) — add a schema assertion test.

---

## 5. Security & least privilege

- No secrets in code. Use the attestation pattern (`*_read_attest.ts`) already in place.
- Tools that touch the repo must go through the grant lifecycle (`repo_operation_grants`); never bypass with a raw `safe_shell`.
- `before` hooks enforce allow-lists (read-only tools don't block) — preserve that model.

---

## 6. Testing

- **Every new or materially changed tool has a focused test.** The repo has broad coverage (`*.test.*` / `*.spec.*` / `*.e2e-test.ts` are widespread), but not a clean one-tool-one-test-file mapping, so use behavior coverage as the bar rather than raw file-count ratios.
- **E2E for the dispatch path**: `Orchestrator → build` via serve API is the critical flow — cover grant create→bind→stage→commit→consume (G9 pattern).
- Tests must run in CI green; `bun x jest` is the runner.
- No `TODO` in shipped code without a tracking issue (see §7).

---

## 7. Staged `strict` migration (how we turn it on without freezing dev)

1. Set `"strict": true` in `tsconfig.json` but add `"// @ts-nocheck"` only to files not yet migrated.
2. Each sprint, migrate 3–5 files: remove `@ts-nocheck`, fix errors, add a test.
3. Track remaining `@ts-nocheck` count as a metric on the roadmap dashboard.
4. Goal: **0 `@ts-nocheck`** within two quarters.

---

## 8. Debt hygiene

- Active `.opencode` TS/JS paths currently have near-zero visible `TODO` / `FIXME` markers outside archived/docs/state areas. Preserve that signal: debt belongs in issues, plans, or review docs, not as silent comments in executable code.
- Quarterly "debt sprint": burn down the oldest high-friction cleanup items (backup artifacts, empty catches, legacy typing escapes) before they normalize.
