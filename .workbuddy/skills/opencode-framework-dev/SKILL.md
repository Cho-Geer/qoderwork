---
name: opencode-framework-dev
description: "OpenCode framework current-code audit and maintenance / OpenCode 框架现状审计与维护。Use for qoderwork/work-one claim verification, active hook debugging, dispatch_privilege/safe_framework_edit, question guidance recovery, session/DB drift, serve API E2E, CodeGraph enforcement, scripts-to-service refactors, and blueprint/plan sync. Trigger: work-one, guidance-bridge, anti-bypass, session_map, 框架审计. Not for: generic app bugs, broad skill cleanup, or unverified recap."
version: 2.1.0
agent_created: true
last_verified: 2026-07-07
---

# OpenCode Framework Dev Suite

## Language / 语言

Follow the user's language: reply in Chinese for Chinese requests and English for English requests. Provide both only when requested; preserve code, commands, paths, API names, identifiers, and quoted source text exactly.

This skill is for evidence-backed OpenCode framework work from
`/home/zhaoge/workspace/qoderwork` against the live framework checkout at
`/home/zhaoge/workspace/opencode/work-one`.

Core rule: treat old docs, old logs, and this skill's `reference.md` as
hypotheses until the current code/config/DB/logs confirm them.

> **步骤类型区分**：读取代码、配置、文档、CodeGraph 输出属于 `[ANALYSIS]`；读取 live DB、运行 serve API、执行脚本、重放 E2E 属于 `[VERIFICATION]`。
> **Verified-by 要求**：每次 `[VERIFICATION]` 后都要记录 `Verified-by: <命令/接口> -> <行号/表查询结果/session id/artifact path>`。
> **合理化检测**：如果你发现自己在想「这份旧文档以前审核过，所以这次应该还是对的」--停下来，这是跳步信号。必须回到当前代码、DB 和日志重新确认。
> **认知说明**：源码分析回答“框架现在看起来怎么实现”；运行态验证回答“当前 session / DB / serve 实际怎么工作”。旧结论必须服从新证据。

## 0. Current Truth Snapshot

Verified on 2026-07-07 against current `work-one`:

| Area | Current fact |
|------|--------------|
| Framework root | `/home/zhaoge/workspace/opencode/work-one` |
| QoderWork root | `/home/zhaoge/workspace/qoderwork` |
| Active agents in `opencode.json` | `Orchestrator`, native `build`, `general`, `explore`, `plan` |
| Agent prompt files | `.opencode/agents/Orchestrator.md` only; old role prompts live under `.opencode/legacy/agent-profiles/` |
| Plugin entrypoints | `before-dispatcher.ts`, `after-dispatcher.ts`, `system-dispatcher.ts`, `session.ts`, `tool-def-trimmer.ts` |
| Before handler order | `guidance-bridge`, `permission-safety`, `behavioral-path-guard`, `scope`, `codegraph`, `skill-policy`, `dispatch-signal` |
| After handler order | `unified-audit`, `skill-audit`, `quality-contract`, `dispatch-trace`, `db-health`, `guidance-recovery` |
| System handler order | `anti-bypass`, `skill-summary` |
| Custom tool files | 23 files under `.opencode/tools`, including `safe_framework_edit.ts` |
| DB tables | 45 business tables, 46 including `sqlite_sequence` |
| Dispatch binding schema | `dispatch_queue.dispatch_key`, `parent_session_id`, `call_id`; `dispatch_privilege_grants` table exists |
| Dispatch privilege status | DB/service/component tests pass; live LLM Orchestrator -> build -> CodeGraph -> `safe_framework_edit` E2E still must be verified before claiming complete |
| Question guidance status | Code path is implemented through `system/anti-bypass`, `before/guidance-bridge`, `after/guidance-recovery`; full recovery E2E still requires live validation |
| Serve API boundary | Use `/session`, `/session/{SID}/prompt_async`, `/question/{QID}/reply`, `/session/{SID}/abort`; do not assume `/session/{SID}/guide`, `/reply`, or `/interrupt` exists |
| Skill copies | `.qoder/skills`, `.agents/skills`, and `.workbuddy/skills` may all contain copies; update/sync deliberately |

If this table conflicts with current code, re-audit and update this skill.

## 1. Required Startup

Run these before any non-trivial framework audit or edit:

1. Check recent framework changes:
   `git -C /home/zhaoge/workspace/opencode/work-one diff --stat`
2. Check recent work-one commits:
   `git -C /home/zhaoge/workspace/opencode/work-one log --oneline -5`
3. Read `/home/zhaoge/workspace/qoderwork/documents/INDEX.md`.
4. Run CodeGraph before code analysis:
   `codegraph status` and then `codegraph query|impact|callers|callees <symbol>`.
5. For DB facts, query live SQLite read-only where possible.

Do not trust a prior blueprint/status claim without live evidence.

## 2. Environment Rules

- The current environment is local WSL. Prefer direct shell commands from the
  relevant directory. Do not wrap every command in `wsl.exe -d Ubuntu-24.04`.
- Use `/home/zhaoge/.bun/bin/bun` when Bun path matters.
- Avoid inline `bash -c` quote pyramids for complex scripts. Write or reuse a
  `.ts`/`.sh` script and run it directly.
- After changing framework TypeScript loaded by OpenCode, clear Bun cache before
  runtime validation: `rm -rf /home/zhaoge/.cache/bun`.
- Do not run destructive git commands or revert user changes unless explicitly
  requested.

## 3. Evidence Standard

A framework conclusion is valid only when backed by at least one of:

- Live source/config line evidence from `work-one`.
- Live DB schema/data evidence from `.opencode/state/framework-state.db`.
- A reproducible script result from `qoderwork/scripts/` or `qoderwork/e2e/`.
- Serve API E2E with session id, logs, and result state.
- CodeGraph query/impact evidence for code-path claims.

Use this language precisely:

| Evidence level | Allowed wording |
|----------------|-----------------|
| Static source only | "code path exists", "component implemented" |
| DB/script simulation | "DB/function integration passes" |
| serve API with real session | "runtime smoke passes" |
| real Orchestrator -> child tool use | "live LLM E2E passes" |

Do not call DB simulations "full E2E".

## 4. Active Hook Debugging

The active hook model is dispatcher-based, not many independent plugin files.

| Chain | Entrypoint | Order source |
|-------|------------|--------------|
| Before | `.opencode/plugins/before-dispatcher.ts` | `project.config.json.plugin_execution_order.before` |
| After | `.opencode/plugins/after-dispatcher.ts` | `project.config.json.plugin_execution_order.after` |
| System | `.opencode/plugins/system-dispatcher.ts` | `project.config.json.plugin_execution_order.system` |
| Session | `.opencode/plugins/session.ts` | direct lifecycle hooks |

Debug sequence:

1. Confirm handler is in the active order.
2. Confirm dispatcher imports it.
3. Add `writeLog()` markers at handler entry and branch points.
4. Clear Bun cache and restart serve only if runtime validation is needed.
5. Trigger one minimal session/tool call.
6. Cross-check `.task_temp/_logs/<date>/`, `/tmp/opencode-serve.log`, serve
   API message state, and SSE JSONL if available.

Common trap: a delegate handler can be inactive directly but still active through
another handler. Example: `after/anti-bypass.ts` is called by
`after/guidance-recovery.ts`; `before/anti-bypass.ts` is called by
`before/guidance-bridge.ts`.

## 5. Serve API Validation

Use serve API for runtime checks:

```bash
curl -s http://127.0.0.1:4096/global/health
curl -s -X POST http://127.0.0.1:4096/session \
  -H 'content-type: application/json' \
  -d '{"title":"framework-test","agent":"Orchestrator"}'
curl -s -X POST http://127.0.0.1:4096/session/$SID/prompt_async \
  -H 'content-type: application/json' \
  -d '{"parts":[{"type":"text","text":"<prompt>"}]}'
curl -s http://127.0.0.1:4096/session/$SID/message?limit=5
curl -s -X POST http://127.0.0.1:4096/session/$SID/abort
```

Question replies use:

```bash
curl -s -X POST http://127.0.0.1:4096/question/$QID/reply \
  -H 'content-type: application/json' \
  -d '{"answers":[["<option-label>"]]}'
```

Guidance is sent by `prompt_async + agent`, not by a nonexistent guide endpoint.

## 6. Dispatch Privilege Audit

Use this when auditing `dispatch_privilege`, `safe_framework_edit`, or framework
maintenance writes.

Expected current chain:

```text
Orchestrator dispatch(input.dispatch_privilege, allowed_paths)
  -> router generates DISPATCH_KEY
  -> dispatch-subagent receives DISPATCH_KEY/DISPATCH_PRIVILEGE/DISPATCH_ALLOWED_PATHS
  -> dbEnqueueDispatch writes dispatch_key + parent_session_id
  -> createGrant writes pending dispatch_privilege_grants row
  -> child session is created or marker is consumed
  -> bindGrant(dispatch_key, child_session_id)
  -> CodeGraph before-hook validates impact_called for safe_framework_edit
  -> safe_framework_edit validates bound grant + allowed path
  -> writeSafeFull writes and consumeGrant marks one-time use
```

Audit checklist:

- `router.ts` passes `DISPATCH_KEY`, `DISPATCH_PRIVILEGE`, `DISPATCH_ALLOWED_PATHS`,
  and `DISPATCH_PRIVILEGE_REASON` to the script.
- `queue.ts` writes and returns `dispatch_key`, `parent_session_id`, `call_id`.
- `session.ts` and/or `marker-consume.ts` can bind the same dispatch key.
- `safe_framework_edit` is allowed only where intended, currently `build`.
- `codegraph.ts` includes `safe_framework_edit` and has no grant bypass.
- Tests distinguish DB simulation from live LLM E2E.

Useful scripts:

```bash
/home/zhaoge/.bun/bin/bun run /home/zhaoge/workspace/qoderwork/scripts/e2e-grant-lifecycle.ts
/home/zhaoge/.bun/bin/bun run /home/zhaoge/workspace/qoderwork/scripts/integ-grant-session-binding.ts
```

## 7. Question Guidance Audit

Current question-based recovery path:

```text
tool failures or blocks
  -> tool-tracker counters
  -> system/anti-bypass checkThreshold() injects question directive
  -> before/guidance-bridge lets question pass
  -> question answer returns through OpenCode question API
  -> after/guidance-recovery delegates to after/anti-bypass
  -> rewardReport() + clearGuidance() reset counters
```

Verify code path:

- `.opencode/plugin-handlers/system/anti-bypass.ts`
- `.opencode/plugin-handlers/before/guidance-bridge.ts`
- `.opencode/plugin-handlers/after/guidance-recovery.ts`
- `.opencode/plugin-handlers/after/anti-bypass.ts`
- `.opencode/service/enforcement/tool-tracker.ts`
- `project.config.json.question_policy`

Do not mark complete from static code alone. Full proof requires a live session
that enters guidance state, calls `question`, receives a reply, and clears
`tool_enforcement`.

## 8. Session And DB Audit

DB paths:

| DB | Path |
|----|------|
| Framework DB | `/home/zhaoge/workspace/opencode/work-one/.opencode/state/framework-state.db` |
| SDK DB | `${OPENCODE_DB:-$HOME/.local/share/opencode/opencode.db}` |

Use read-only connections for audit. Key checks:

- `session_map.parent_id` and SDK session `parent_id` alignment.
- `session_events` dual writes for dispatch/session lifecycle.
- `tool_enforcement.awaiting_guidance`, `guidance_token`, `guidance_text`.
- `dispatch_queue` exact binding fields.
- `dispatch_privilege_grants` lifecycle fields.

SQLite lock note: do not run multiple DB-writing test scripts in parallel. A
parallel run can produce `SQLITE_BUSY` unrelated to framework correctness.

## 9. Scripts To Service Refactor

Current service domains:

| Domain | Responsibility |
|--------|----------------|
| `dispatch/` | native dispatch, router, queue, prompt, grants |
| `enforcement/` | anti-bypass, exemptions, rule disposition |
| `file-guard/` | CodeGraph state, write/test/format guards |
| `gate/` | checklist and compliance gate lifecycle |
| `knowledge/` | knowledge/cache pipeline |
| `notification/` | notify integration |
| `permission/` | permission reader and legacy isolation |
| `session/` | session lifecycle, session map, config attest |
| `state/` | substates |
| `tdd/` | test/report helpers |
| `context/` | context/tool summaries |

Refactor rule: scripts may parse args and print results; service modules own DB
logic, state transitions, validation, and reusable business behavior.

## 10. MCP And Tool Integration

Current agent model is not the old 10 custom-agent matrix. For new tool/MCP
capabilities:

1. Update `opencode.json` permission for the actual active agent keys:
   `Orchestrator`, `build`, `general`, `explore`, `plan`.
2. Update `.opencode/agents/Orchestrator.md` only when Orchestrator prompt
   needs to know the capability.
3. For native agents, prefer skills, dispatch prompt content, or tool
   permission config; there are no `.opencode/agents/build.md` etc. in this
   checkout.
4. Add enforcement exemptions only when the active handler actually checks them.

Do not copy old agent lists such as Architect/Coder-BE/Super-Admin into current
permission guidance without confirming they are still active runtime identities.

## 11. Context And Skill Token Audit

Useful checks:

```bash
python3 - <<'PY'
import json
cfg=json.load(open('/home/zhaoge/workspace/opencode/work-one/opencode.json'))
print(cfg.get('instructions'))
print(sorted((cfg.get('agent') or {}).keys()))
print(len(cfg.get('mcp') or {}))
PY
find /home/zhaoge/workspace/opencode/work-one/.opencode/skills -name SKILL.md -maxdepth 2 -print | wc -l
```

Current skill behavior should be verified against native OpenCode skill support
and the framework's `skill_read_attest` flow. Do not introduce a fictional
`read_skill` tool unless current code/config actually provides it.

ACP token measurement may still be useful for upstream protocol research, but
serve API is the default validation path for this framework.

## 12. Blueprint And Plan Audit

For every blueprint/plan status update:

1. Extract concrete claims: file exists, count, handler order, DB column, test
   result, endpoint, permission, live E2E.
2. Verify with current code/config/DB/logs.
3. Label the evidence level: static, DB/script, runtime smoke, or live LLM E2E.
4. Update only claims that drifted.
5. Add a short qoderwork log under `logs/YYYY-MM-DD-<topic>.md` when code or
   important framework docs are changed.

Common stale claims to catch:

- "29 plugin files" or "20+ plugin entrypoints" when the active model is 5
  plugin entrypoints plus ordered handlers.
- "10 custom agents" as active runtime config when only `Orchestrator` plus
  native agents are active in `opencode.json`.
- "/session/{SID}/guide", "/session/{SID}/reply", or "/interrupt" endpoints.
- "DB E2E" being treated as live LLM E2E.
- Super-Admin as a reliable runtime repair identity without current routing
  proof.

## 13. Reference File Policy

`reference.md` contains command templates and historical examples. Use it as a
snippet library, not as current truth. When a template mentions old agent lists,
historical bridge wording, `wsl.exe`, or old plugin counts, adapt it to the
current snapshot in this `SKILL.md` before execution.

If you discover a repeated mismatch in `reference.md`, update the reference too.
