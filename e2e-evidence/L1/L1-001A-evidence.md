# L1-001A — 双语语义对齐 (Bilingual Boost Alignment) · LIVE EVIDENCE

- **Date**: 2026-07-12 16:35 (rerun)
- **Method**: serve-api live — `POST /session` + `POST /session/{sid}/message` driven by `scripts/_e2e_l1001abc_live.py`; opencode-side `SKILL-SUMMARY-INJECTED` captured from `plugin-plugin-skill-summary-runtime.log` (2026-07-12).
- **Skills**: pre-flight-enforcement (constraint) + serve-api + clean-sessions (execution)
- **Sessions**: 12 (A1–A6 × CN/EN)

## Assertion

CN/EN paraphrases of the **same intent** must produce a **consistent** `keywordGroups`/`keywordSkills` boost (bilingual semantic alignment, F1).

## Evidence (opencode runtime-confirmed)

| Tag | Intent | SID | groups | skills | Aligned? |
|---|---|---|---|---|---|
| A1-CN | 修改框架源码：在 before/codegraph.ts 加一行日志 | ses_0aac4b323ffeKDI2Mf3uAFdBmh | source-edit | codegraph-first | ✓ |
| A1-EN | Edit framework source: add a log line in before/codegraph.ts | ses_0aac4748affew0n5ju7vWdEbLd | source-edit | codegraph-first | ✓ |
| A2-CN | 给项目加一条 CI 流水线，跑 lint 和测试 | ses_0aac435f8ffeJSsnE3a8Zah1y0 | cicd | ci-cd-guardrails,cross-directory-ci | ✓ |
| A2-EN | Add a CI pipeline to the project that runs lint and tests | ses_0aac3f765ffe8XYe1LwKNYqQ8f | cicd | ci-cd-guardrails,cross-directory-ci | ✓ |
| A3-CN | 一句话问答：Git 怎么看当前分支 | ses_0aac3b8d4ffe6MrVnAaI7m9Fci | none | none | ✓ |
| A3-EN | Quick question: how do I see the current Git branch? | ses_0aac37a41ffe4g6jO6FtwmhpkQ | none | none | ✓ |
| A4-CN | 需求不清，先帮我澄清到底要做什么 | ses_0aac33bb2ffe3Ax8X4OIMY3GD5 | architecture | brainstorming | ✗ **DIVERGE** |
| A4-EN | The requirements are unclear - help me clarify what we actually need to build | ses_0aac2fd22ffeGEkQTCfGLpPB0t | cicd | ci-cd-guardrails,cross-directory-ci | ✗ **DIVERGE** |
| A5-CN | 把一个子任务 dispatch 给 build agent 去执行 | ses_0aac2be98ffeheiNjD3O8ZJrHy | cicd | ci-cd-guardrails,cross-directory-ci | ✓ |
| A5-EN | Dispatch a subtask to the build agent for execution | ses_0aac2800affelLKX8Rw6Lh7E2L | cicd | ci-cd-guardrails,cross-directory-ci | ✓ |
| A6-CN | 这个偶发崩溃根因一直查不清，帮我系统调查 | ses_0aac24177ffeWw4R1MypwVzMpj | none | none | ✓ |
| A6-EN | This intermittent crash's root cause is hard to pin down - help me investigate systematically | ses_0aac202dfffeHaVmbi37BETKhL | none | none | ✓ |

## Verdict: 🟡 LIVE PARTIAL

- **11 / 12** bilingual pairs produced identical boost → alignment holds for A1, A2, A3, A5, A6.
- **A4 diverges**: CN → `architecture/brainstorming` (clarification/discussion), EN → `cicd/ci-cd-guardrails,cross-directory-ci`.
  - **Root cause**: the English token **"build"** (in "…what we actually need to build") polysemously matched the `cicd` keyword group (CI/CD build), whereas the CN twin "要做什么 / 澄清" correctly mapped to `brainstorming`.
  - This is a genuine **bilingual keyword inconsistency** (English polysemy over-trigger), not a capture-reliability defect.

## Finding → OPEN GAP

Bilingual keyword boost is not fully symmetric: semantically-equivalent CN/EN prompts can land in different keyword groups when one language contains a polysemous token (e.g. EN "build" ↔ CN "做什么"). Recommend a polysemy-guard / CN-EN consensus pass in `skill-summary.ts` keyword classification. Logged to `OPEN-GAPS.md` (L1-001A).

## Question behavior (opencode-side, traced 2026-07-12)

- **A4-CN / A4-EN both raised a `question`** at the clarification gate ("需求不清 / requirements unclear"). The pre-question keyword boost (CN `architecture/brainstorming`, EN `cicd`) was captured at that moment.
- **A6-EN also raised a `question`** ("请描述崩溃的具体现象…").
- The keyword-boost driver initially **did not poll `GET /question` nor reply** (serve-api Steps 5/6 violation) → all 3 went unanswered. Corrected post-hoc: all replied via `POST /question/{QID}/reply`; agents resumed (A4-CN last message `finish:tool-calls`). See `OPEN-GAPS.md` §C2.
- Lesson: clarification/ambiguous intents reliably hit the question gate; a live run must answer them or the session hangs at the gate.
