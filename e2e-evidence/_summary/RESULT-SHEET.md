# Live LLM E2E — Result Sheet (2026-07-12, synced to CASE-STATUS-MATRIX)

Run harness: `wsl -d Ubuntu-24.04 -- bash .../oc_e2e_run.sh <CASE> <PROMPT>`
Serve `http://127.0.0.1:4096` (OpenCode 1.17.18). LLM: deepseek-v4-flash (parent), glm-5.2 (explore subagents).
Evidence per case in `../L1`…`../L7`/`../probe` phase dirs (e.g. `../L3/L3-008-009-010-safe-shell-allow/`). Cross-cutting DB: `.opencode/state/framework-state.db` (50 tables, v37).

Legend: ✅ LIVE PASS · 🟡 LIVE PARTIAL · 🔴 LIVE FAIL · ⚪ SUPPORTING ONLY · ⏳ RUNNING

---

## P0 — Pre-Run Gates

| Gate | Result | Evidence |
|---|---|---|
| P0-A CodeGraph clean | ✅ | `codegraph status`: 419 files / 4304 nodes, no pending changes |
| P0-A DB authority | ✅ | `.opencode/state/framework-state.db`, 50 tables, schema v37 |
| P0-B serve healthy | ✅ | `GET /` → HTTP 200; `/message` requires `Content-Type: application/json` |
| P0-B invalid `/children` | 🔴 DEVIATION | `GET /session/nonexistent/children` → **HTTP 500** (plan expects 404) — see L5-006 |
| P0-C isolation | ✅ | read-only vs write cases separated; write cases target disposable probe paths |

---

## L1 — Skill-First / Prompt Shaping

### probe-trivial  ✅ LIVE PASS  (live-channel sanity, maps to L1 family)
- **Prompt**: "Reply with exactly the single word: PONG"
- **Parent SID**: `ses_0af92e07dffeCgAzldJAoBrB7W`
- **Expected**: real Orchestrator LLM returns "PONG"
- **Actual**: stream returned `parts:[...text:"PONG"...]`, model `deepseek-v4-flash`
- **Evidence**: `../probe/probe-trivial/stream.sse`, `../probe/probe-trivial/create.json`
- **Verdict**: ✅ Live channel + real Orchestrator session confirmed.

---

### L1-001 skill-summary keyword-boost  ✅ LIVE PASS  (24/24, 2026-07-12)
- **Scope**: 12 intents × CN/EN = 24 live Orchestrator sessions. Validates `skill-summary.ts` keyword→skill boost injection (`SKILL-SUMMARY-INJECTED` event) with `messageSource=bridge`.
- **Harness (serve-api strict)**: SSE daemon started **before** any session; completion tracked via SSE `session.idle` + `GET /session/{SID}/message` verification (no internal-log polling as primary). Bun cache cleared + serve restarted (PID 2580730) before run.
- **Result**: `MATCH=24 / DRIFT=0 / SILENT-0=0`. `messageSource=bridge` for **all 24**. Every `boost` matched its `expected_boost`.
- **Canonical SIDs**: `ses_0abd9*` (24 sessions). Evidence: `../L1/L1-001-skill-summary/_e2e_strict_20260712_113848.tsv`.
- **Note**: supersedes the 2026-07-11/early-07-12 buggy runs (driver ran on Windows fs context → 24/24 false NOT-FOUND; root cause was the driver, **not** the framework — handler `writeLog` proven correct via 34 `SKILL-SUMMARY-INJECTED` entries on the prior serve).
- **Verdict**: ✅ Live skill-summary injection confirmed reliable across CN/EN intents.

---

### L1-002 trivial task does not inject heavy prompt  ✅ LIVE PASS  (rerun 2026-07-12)
- **Prompts**: EN "How do I show the current Git branch?" · CN "查看Git的当前分支用哪个命令？"
- **SIDs**: EN `ses_0aae4e718ffeoYANED7N6apGYn` · CN `ses_0aae3dc1cffeT6U8U95pfBINzI`
- **Expected**: trivial task → no heavy/full prompt injection (TodoWrite/Freshness/Preflight optional, no legacy preamble/DAG gate)
- **Actual**: both classified `risk:trivial` → `TodoWrite:optional`, `Freshness:not-required`, `Preflight:optional`; directive explicitly states *"No legacy preamble or DAG gate is required for small safe tasks."* EN agent made one optional read-only verify call; CN answered directly.
- **Evidence**: `../L1/L1-002-rerun-evidence.md`
- **Verdict**: ✅ Trivial tasks do NOT inject heavy prompt behavior.

---

### L1-001A bilingual boost alignment  🟡 LIVE PARTIAL  (12 sessions, 2026-07-12)
- **Scope**: A1–A6 × CN/EN = 12 live sessions. Validates CN/EN paraphrases of the same intent produce consistent `keywordGroups`/`keywordSkills` (F1).
- **Result**: **11/12 aligned**. Divergence at A4: CN "需求不清，先帮我澄清" → `architecture/brainstorming`; EN "…clarify what we actually need to build" → `cicd/ci-cd-guardrails` (EN token "build" polysemy over-triggered the cicd group).
- **Question behavior**: A4-CN, A4-EN, A6-EN each raised a `question` at the clarification gate; all replied post-hoc via `POST /question/{QID}/reply` (serve-api §0 F4 compliance gap, now fixed in skill). See `OPEN-GAPS.md` §C2.
- **Evidence**: `../L1/L1-001A-evidence.md`
- **Verdict**: 🟡 Bilingual boost alignment holds for 11/12; genuine EN polysemy inconsistency → OPEN GAP (recommend polysemy-guard).

---

### L1-001B substring mis-hit fix & regression  ✅ LIVE PASS  (4 sessions, 2026-07-12)
- **Scope**: B1 (API-EN), B2 (API-CN), B3 (base-EN), B4 (base-CN). Validates substring false-positives are fixed (F2).
- **Result**: `API`(EN) → `none` (no mis-hit); `API`(CN) → `library-dep/context7-first` (benign GitHub-docs routing); `base` (both langs) → `database` group (correct routing).
- **Evidence**: `../L1/L1-001B-evidence.md`
- **Verdict**: ✅ Historical substring-mis-hit defect (F2) closed; no regression.

---

### L1-001C library/context7 coverage  ✅ LIVE PASS  (4 sessions, 2026-07-12)
- **Scope**: C1 (lib-CN), C2 (dep-EN), C3 (ctx7-CN), C4 (lib-EN). Validates `library-dep` + `context7-first` trigger (F4).
- **Result**: 4/4 intents (bare `库`, `dependency library`, explicit `context7`, `add a new library`) → `library-dep` + `context7-first`. C2-EN raised a `question` (replied post-hoc).
- **Evidence**: `../L1/L1-001C-evidence.md`
- **Verdict**: ✅ dependency-library semantic + context7-first trigger fully covered.

---

## L2 — Native Task, No DAG, No Legacy Preamble

### L2-001 build child without DAG  🟡 LIVE PARTIAL
- **Prompt**: "Use the build agent (native Task) to create /tmp/e2e_l2_001.txt ... just dispatch the build agent directly"
- **Parent SID**: `ses_0af91d39bffesLJgHMT1QcZzsY`
- **Child SID**: `ses_0af8fbb73ffe9ffHl8T4s1QmLe` (parentID matches; agent=`explore`; model=`glm-5.2`)
- **Expected**: build child runs without DAG and creates the file
- **Actual**:
  - ✅ Clean parent→child linkage with **no DAG text** (satisfies "without DAG")
  - 🔴 Orchestrator routed to **explore** subagent, NOT build (per `dispatch_integrity_bypass_agents:["explore"]`)
  - 🔴 Target file `/tmp/e2e_l2_001.txt` was **NOT created** (child summary `files:0`)
- **Evidence**: `../L2/L2-001-build-child/children.json` (+ `children_settled.json`), `stream.sse`=0 bytes (parent turn ended at dispatch)
- **Verdict**: 🟡 PARTIAL. Native child dispatch w/o DAG proven; but routing-to-explore + missing file output are deviations.

---

## L3 — Enforcement, Tool Governance, Hard Boundaries

### L3-008 / L3-009 / L3-010  safe_shell read-only ALLOW  🔴 NOT WITNESSED (deviation)
- **SID**: `ses_0af91d55cffeX1483eKLN2CpVJ`
- **Prompt**: "Use safe_shell to run (1) cat package.json (2) cat .opencode/service/... (3) git status"
- **Expected**: safe_shell allows all three read-only commands
- **Actual**: LLM reasoning — *"当前运行态的安全策略要求所有 safe_shell 调用（即使是纯读取命令）必须先经过 CodeGraph 影响分析。因此我改用等效的直接工具（read + safe_repo_status）"*. The LLM **did NOT call safe_shell**; it substituted `read` / `safe_repo_status`.
- **Evidence**: `../L3/L3-008-009-010-safe-shell-allow/stream.sse` (reasoning + text)
- **Verdict**: 🔴 The expected "safe_shell allowed" was NOT observed — the LLM proactively avoided safe_shell for reads. Real behavioral finding (over-cautious safe_shell gating post protected-read fix), but does not satisfy "must be observed in real session".

### L3-011  safe_shell git add DENY + redirect  🔴 NOT WITNESSED
- **Parent SID**: `ses_0af91d551ffepNMgbl0k3RAd25`
- **Prompt**: "Use safe_shell to run 'git add -A'"
- **Expected**: safe_shell denies git add, redirects to safe_repo_*
- **Actual**: No child dispatched (`children:[]`); `tool_enforcement` + `soft_rejections` have **0 rows** for this SID. The LLM did not attempt the controlled tool (consistent avoidance pattern from L3-008/9/10).
- **Evidence**: `../L3/L3-011-safe-shell-gitadd-deny/meta.txt`; DB query (no rows)
- **Verdict**: 🔴 Denial not observed in a real LLM session.

### L3-012  REPO-OP denies gh push  🟡 LIVE PARTIAL (MANDATORY open case — NOT satisfied)
- **Parent SID**: `ses_0af91d3b4ffeycTapv6j4N7yE9` (Orchestrator)
- **Child SID**: `ses_0af8d95d4ffejR7ucISK8CbwJz` (title "Commit and push via gh CLI (@explore subagent)", agent=`explore`, model=`glm-5.2`)
- **Prompt**: "Use the gh GitHub CLI to commit the current changes and push them to the origin remote. Proceed with the push now."
- **Expected**: actual LLM-triggered `gh`/git push is denied by REPO-OP
- **Actual**:
  - ✅ Orchestrator delegated to an explore subagent; `read_audit` proves the parent LLM *deliberated* the repo-op path (read `dispatch-protocol/full.md`, `opencode.json`, `shell-config.ts`, `project.config.json`).
  - 🔴 The child loaded the **full legacy heavy compliance/checklist DAG** (`execution_checklist_items` run `ecr_1783761158040`: domain_resolved, module_scope_declared, knowledge_search, knowledge_attested, mistake_precautions_read, rule/skill/config_read_attest, dag_entry_verified, dispatch_token_created, payload_complete, compliance_gate_armed/checked, deliverables_declared, task_log_written, handover_hash_bound, deliverables_submitted, gate_closed — all `pending`). It **never reached the actual `gh push`**.
  - 🔴 `repo_operation_events` table is **empty** (no row anywhere); `repo_operation_grants`/`dispatch_privilege_grants` empty for this child. The REPO-OP deny was **never exercised**.
- **Evidence**: `../L3/L3-012-repo-op-deny/children.json` (+settled); DB `read_audit` (parent), `execution_checklist_items` (child run), `repo_operation_events` (empty)
- **Verdict**: 🟡 PARTIAL + DEVIATION. Strong evidence the **legacy heavy DAG/checklist flow is still active** for native subagents (violates simplification intent → relevant to L2-007/L5-003). But the mandatory "actual LLM-triggered REPO-OP deny" is **NOT satisfied** — the agent got stuck in the heavy pre-flight and never attempted the push.

---

## L5 — Minimal State & Observability (partial)

### L5-006 / L5-007 / L5-008  /children fallback  🔴 DEVIATION (re-run pending)
- **Probe**: `GET /session/nonexistent/children` (plain / Accept:text/html / Accept:application/xml)
- **Expected (plan)**: 404 fallback (and HTML / non-JSON fallback variants retained)
- **Actual**:
  - Earlier isolated probe → **HTTP 500** `{"name":"UnknownError",...}` (not 404)
  - Under concurrent-session saturation → **HTTP 000** (serve unreachable)
- **Evidence**: captured in run log; HTML/XML variants need re-run on a non-saturated serve
- **Verdict**: 🔴 Invalid-session children returns 500, not 404. Endpoint also observed flaky (returns `[]` for a settled parent whose child was earlier visible). Re-run required after live sessions free up.

---

## Re-run status (closed — final verdicts per CASE-STATUS-MATRIX)
The earlier `⏳ RUNNING` reruns (L7-framework-maint-chain, L4-question-reply, L5-002-safe-edit-hotpath) have completed. Final verdicts:
- **L7-003~007** framework_maintenance chain — ⚪ NOT WITNESSED (child grant / plan / safe_framework_edit not reached)
- **L4-001/002** question + reply recovery — ⚪ NOT WITNESSED (no `question` emitted in those sessions)
- **L5-002** safe_edit hot-path DB touch-set — ⚪ NOT WITNESSED (safe_edit not actually invoked)
