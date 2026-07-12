# E2E Evidence Capture Methodology — 2026-07-11 Live Run

Scope: `/home/zhaoge/workspace/opencode/work-one` (OpenCode framework "work-one")
Serve: `http://127.0.0.1:4096` (HTTP 200, OpenCode 1.17.18)
Driver host: WSL `Ubuntu-24.04`, invoked via `wsl -d Ubuntu-24.04 -- bash ...`

## Live channel (per test plan §2.3 — valid acceptance channels)

- `POST /session` → create real Orchestrator session
- `POST /session/{SID}/message` with body `{"parts":[{"type":"text","text":"<prompt>"}]}` → drive real LLM (deepseek-v4-flash) decisions
- `GET /session/{SID}` → returns the **children/session-tree** JSON (parent→child linkage)
- `POST /question/{QID}/reply` → recovery (used by L4)

> NOTE: `POST /session/{SID}/guide|reply|interrupt` are NOT valid acceptance channels and were avoided.

## Evidence sources per case (test plan §2.2 bundle)

Each case directory under `e2e-evidence/<CASE>/` contains:
- `create.json` — session-create response (proves real Orchestrator session)
- `stream.sse` — raw `/message` response body (final assistant text + parts)
- `children.json` / `children_settled.json` — `GET /session/{SID}` session tree
- `meta.txt` — SID + timestamps

Cross-cutting authoritative evidence comes from the framework DB:
- `/home/zhaoge/workspace/opencode/work-one/.opencode/state/framework-state.db` (SQLite, 50 tables, schema v37)
- Key tables: `read_audit`, `tool_enforcement`, `soft_rejections`, `repo_operation_grants/events`,
  `dispatch_queue`, `dispatch_privilege_grants`, `session_events`, `execution_checklist_items`,
  `framework_maintenance_plans`, `audit_log`.

## Helper scripts (qoderwork/scripts/)

- `oc_e2e_run.sh <CASE> <PROMPT> [TIMEOUT]` — create session + send message + capture children
- `oc_parse.sh <CASE>` — pretty-print stream.sse parts (text/reasoning/tool parts)
- `oc_db.sh "<SQL>"` — query framework-state.db (avoids shell-escaping bugs)
- `oc_enf.sh "<SID>"` — dump enforcement/observability rows for a session

## Known capture limitation (important)

The `/message` POST returns a **non-empty body only when the turn ends with assistant text**.
When the Orchestrator performs an *action* (dispatches a child, or hits a blocked tool that ends
the turn), the response body is **0 bytes**. In those cases the authoritative evidence is:
1. `GET /session/{SID}` children tree (dispatch/routing), and
2. the framework DB (enforcement outcomes, audit rows).

Also observed: `GET /session/{invalid}/children` returns **HTTP 500** (not the 404 the plan
expects for L5-006), and the children endpoint can be **flaky** (returns `[]` for a settled parent
whose child was earlier visible). Session lineage should therefore be corroborated from the DB
where possible.

## P0 gates (run before matrix)

- **P0-A Baseline freeze**: CodeGraph index clean (419 files / 4304 nodes, no pending changes);
  DB authority confirmed at `.opencode/state/framework-state.db` (50 tables, v37).
- **P0-B Runtime harness sanity**: serve daemon healthy (HTTP 200); `Content-Type: application/json`
  required for `/message`; invalid-session `/children` returns 500.
- **P0-C Isolation**: read-only vs write live cases separated; framework-write cases target
  disposable probe paths (`.opencode/tools/safe_edit.ts` comment, `NOTES-e2e-probe.md`).
