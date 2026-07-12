# Open Gaps — Cases Below Live Level (2026-07-11 run)

Per test plan §8–§9, a case is only "live-closed" with a real LLM witness + evidence bundle.
The following remain open after this run.

## A. Denials not triggered because the LLM avoids controlled tools (F2)

- **L3-008 / L3-009 / L3-010** — expected `safe_shell` read-only allows. Actual: LLM substituted `read`/`safe_repo_status`, never called `safe_shell`. → NOT WITNESSED.
- **L3-011** — expected `safe_shell git add` deny + redirect. Actual: no child, no `tool_enforcement`/`soft_rejections` row; LLM avoided the tool. → NOT WITNESSED.
- **Remediation**: force the tool call via a prompt that cannot be satisfied without the controlled tool, or drive the tool directly through a deterministic harness (lower-grade evidence per plan Appendix B). Re-validate after the safe_shell gating policy is relaxed/tuned.

## B. REPO-OP positive deny not reached (F3)

- **L3-012 (MANDATORY)** — LLM routed `gh push` to an explore subagent that loaded the **full legacy heavy compliance/checklist DAG** and never reached the actual push; `repo_operation_events` empty. → PARTIAL. The mandatory "actual LLM-triggered REPO-OP deny" is **not satisfied**.
- **Remediation**: the legacy heavy flow (domain/knowledge/HANDOVER gates) must be trimmed for native subagents; only then will the agent reach the repo-op step where REPO-OP can deny.

## C. Question / recovery loop not demonstrated (F1 capture + behavior)

- **L4-001** — ambiguous/blocked task did **not** emit a `question` event (0 `question` notifications for the session). → NOT WITNESSED.
- **L4-002** — `POST /question/{QID}/reply` recovery untested (no QID produced). → NOT WITNESSED.
- **Remediation**: capture the `question` event via SSE subscription (the `/message` POST body is 0 bytes for action turns). Verify the `question` tool is actually invoked by the Orchestrator for blocked tasks.

## C2. Question loop IS raised + MUST be replied (empirically confirmed 2026-07-12, L1-001A/B/C rerun)

- **opencode 确实抛 `question`**：L1-001A/B/C 20 session 中，4 个触发 `question` —— A4-CN / A4-EN（澄清类「需求不清/requirements unclear」）、A6-EN（「系统性调查偶发崩溃」）、C2-EN（「用哪个日期库」）。
- **初版 driver 违规**：关键词 boost driver 只 `POST /message` + 读 `SKILL-SUMMARY-INJECTED` 日志，**漏掉 `GET /question` 监控 + `POST /question/{QID}/reply` 回复循环**（违反 serve-api 技能 Steps 5/6 + `question-pending` 必须立即回复规则）→ 4 个全未回复。
- **事后补做（已闭环）**：对 4 个 question 全回复（HTTP 200/`true`），agent 恢复执行（A4-CN 末条消息 `finish:tool-calls` 证明已跨过 question 门）；复测 `GET /question` = 0 pending。
- **教训（强复用）**：任何 serve-api live run **必须**轮询 `GET /question` 并回复，关键词 boost driver 不能只发消息+读日志。question 回复是 turn 内唯一即时生效工具，缺失会让澄清类意图永远停在 question 门。

## D. Observability endpoint deviation (F4)

- **L5-006** — `/session/{invalid}/children` returns **HTTP 500**, not 404.
- **L5-007 / L5-008** — HTML / non-JSON fallback variants not confirmed (serve saturated at probe time; re-probe needed).
- **Remediation**: serve should return 404 (or a clean fallback) for unknown sessions, not an `UnknownError` 500.

## E. Framework-maintenance positive chain (MANDATORY) — pending rerun

- **L7-003~007** — first run invalid (serve saturation, 0 DB activity). Sequential rerun in progress. Outcome TBD.

## F. Not executed this session

- **L1-001** (skill-summary keyword-boost, 12 intents × CN/EN = 24) — ✅ **LIVE PASS 24/24** on 2026-07-12 (serve-api strict run; `messageSource=bridge` all 24; SIDs `ses_0abd9*`). Supersedes earlier buggy runs. Now live-closed.
- **L1-003/004** (prompt shaping) — L1-001 canonical + probe-trivial sanity retained; not separately run. **L1-002 已于 2026-07-12 LIVE PASS**（real session，Risk=trivial，未注入重型 prompt），移出 open gap；证据 `../L1/L1-002-rerun-evidence.md`。
- **L2-002~008** (general/plan/explore children, no-DAG, lineage) — only L2-001 run.
- **L3-001~007** (native edit/bash block, wrong-path, codegraph-gate, shell-policy, question-pass-through, route-mismatch) — not run.
- **L4-003/004/005/006** (prompt_async, abort, watcher capsule, endpoint discipline) — not run.
- **L5-001/003/004/005** (DB-write minimality, checklist optionality, jsonl exercise) — not run.
- **L6-001~006** (weak-model matrix) — not re-run.
- **L7-008~015** (negative chain: no-grant/no-plan/no-codegraph/path-outside/ttl/budget/post-complete) — not run.
- **Appendix A #1–#23** — not individually re-run (mostly static/hook-backed).

## H. Bilingual keyword-boost inconsistency (found in L1-001A rerun, 2026-07-12)

- **L1-001A (🟡 PARTIAL)** — CN/EN paraphrases of the same intent mostly align (11/12), but A4 diverged: CN "需求不清，先帮我澄清" → `architecture/brainstorming`; EN "The requirements are unclear - help me clarify what we actually need to build" → `cicd/ci-cd-guardrails,cross-directory-ci`. Root cause: the EN token **"build"** polysemously matched the `cicd` keyword group. Evidence `../L1/L1-001A-evidence.md`.
- **Remediation**: add a polysemy-guard / CN-EN consensus pass in `skill-summary.ts` keyword classification so semantically-equivalent bilingual prompts land in the same keyword group.

## G. Methodology gaps to close before next run

1. Serialize live sessions (avoid F5 saturation → HTTP 000).
2. Subscribe to SSE to capture `question`/tool events lost in 0-byte POST bodies (F1).
3. Tune safe_shell gating so read-only `safe_shell` is actually exercised (F2).
4. Trim legacy heavy checklist DAG for native subagents (F3) before REPO-OP/L7 can be fairly tested.
