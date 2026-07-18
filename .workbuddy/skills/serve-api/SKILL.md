---
name: serve-api
description: "Operate and verify OpenCode via local serve API and SSE daemon. Use for session lifecycle, messages, questions, SSE events, child-agent monitoring, runtime evidence. Trigger: serve API, curl, SSE daemon, session 操作, question 回复, 直连 OpenCode, session 验证, 子 agent 监控, 主动干预. Not for: ACP bridge development, hand-written grants/DBs, isolated test orchestration, anti-bypass-only testing."
---

# Serve API Runtime Verification

## Language / 语言

Follow the user's language: reply in Chinese for Chinese requests and English for English requests. Provide both only when requested; preserve code, commands, paths, API names, identifiers, and quoted source text exactly.

This is a `[VERIFICATION]` skill: source inspection describes intent, while API calls establish runtime facts. Every state-changing or asserted API result needs a `Verified-by:` line containing the endpoint, session ID, and essential response or event evidence.

> **合理化检测**: Do not replace a declared API check with an inference from code, configuration, or an earlier response. If no live response or event exists, the runtime claim remains unverified.

## Prepare The Runtime

1. Start or restart the service with `bun run /home/zhaoge/workspace/qoderwork/scripts/start-serve.ts`.
2. Start `scripts/sse-daemon.ts` before creating a session when event evidence is required.
3. Check `GET http://localhost:4096/session` and the SSE daemon process before proceeding.

Use [reference-operations.md](reference-operations.md) for startup commands, Windows/WSL quoting, endpoint payloads, session-tree tools, intervention commands, and operational pitfalls. Use [reference.md](reference.md) for complete E2E and event-coverage procedures.

## Core Lifecycle

1. Create a session with `POST /session`, including the intended `agent`.
2. Use synchronous `POST /session/{SID}/message` for short work; use `prompt_async` for long work.
3. Observe completion through the SSE JSONL stream and supplement it with `GET /session/{SID}/message?limit=N`.
4. Poll `GET /question`; reply to the matching `QID` with `POST /question/{QID}/reply` when authorized.
5. Use `GET /session/{SID}/children` and the session-tree tools for child-agent work.
6. Abort only the intended session with `POST /session/{SID}/abort`.

Record evidence immediately after each call, for example:

`Verified-by: POST /session -> ses_abc (agent=Orchestrator)`

## Safety Rules

- Do not hand-write framework grants, session maps, or databases. Use their owning workflow or `isolated-serve-test` when an isolated test run is required.
- Before sending to an existing child session, read its actual agent and preserve that agent in the request. Prefer `scripts/guide.ts` or `scripts/intervene.ts` for guided intervention.
- `prompt_async` applies at a future turn boundary; `question/reply` and `abort` have different timing. Read [reference-operations.md](reference-operations.md) before relying on mid-turn behavior.
- Restart serve after changing `opencode.json`; it does not hot-reload that configuration.

## Completion Evidence

State the session IDs, endpoints invoked, observed terminal event or message state, pending-question result, and cleanup action. For E2E claims, use the matching procedure and report template in [reference.md](reference.md); do not promote a single endpoint check to full E2E coverage.
