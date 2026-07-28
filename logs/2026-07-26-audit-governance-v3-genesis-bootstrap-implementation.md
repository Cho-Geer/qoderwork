# Audit governance v3 Genesis Bootstrap implementation

- Purpose: establish the shared v3 schema parser and fail-closed PLAN_SET admission.
- Changed: shared parser/tests, v3-only validator/tests/template, and B1 explicit-root dynamic loader/test.
- Removed: active pre-v3 PLAN input and the worktree-relative B1 handler import.
- Verification: B1 path unit 3/3; schema unit 4/4; validator component 5/5.
- Verification: `bun run typecheck` exit 0; CodeGraph shows validator caller.
- Static checks: old-entry scan and B1 static-import scan both returned zero matches.
- Scope check: `git diff --check` exit 0; no report, LATEST, or phase acceptance written.
- Evidence ceiling: unit/component/static only; no audit closure is claimed.
