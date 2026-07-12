# L1-001C — library / context7 类意图覆盖 (Dependency-Library & Context7 Coverage) · LIVE EVIDENCE

- **Date**: 2026-07-12 16:35 (rerun)
- **Method**: serve-api live — `scripts/_e2e_l1001abc_live.py`; opencode-side `SKILL-SUMMARY-INJECTED` from `plugin-plugin-skill-summary-runtime.log` (2026-07-12).
- **Skills**: pre-flight-enforcement (constraint) + serve-api + clean-sessions (execution)
- **Sessions**: 4 (C1–C4)

## Assertion

Library / dependency intents must be covered by the `library-dep` keyword group and must trigger `context7-first` (F4):
- bare `库` / `library`
- `dependency` / `添加依赖`
- explicit `context7` documentation lookup

## Evidence (opencode runtime-confirmed)

| Tag | Intent | SID | groups | skills | Covered? |
|---|---|---|---|---|---|
| C1-lib-CN | 给项目加一个第三方库做日期格式化 | ses_0aac0ca06ffe9UHmm9kBPIWk0L | library-dep | context7-first | ✅ |
| C2-dep-EN | Add a dependency library for date formatting to the project | ses_0aac08b76ffeYob7qSKxai2vKT | library-dep | context7-first | ✅ |
| C3-ctx7-CN | 查一下这个库的 context7 文档 | ses_0aac04ce5ffeGEoPdiETsILQ5l | library-dep | context7-first | ✅ |
| C4-lib-EN | How do I add a new library to the project? | ses_0aac00e5fffegS8M7PwgfwVJMs | library-dep | context7-first | ✅ |

## Verdict: ✅ LIVE PASS

- **4 / 4** library/dependency intents resolved to `library-dep` + `context7-first`.
- Bare `库` (C1), `dependency library` (C2), explicit `context7` (C3), and `add a new library` (C4) all trigger `context7-first` correctly.
- The `dependency-library` semantic + `context7-first` trigger condition (F4) is **fully covered**; no gap observed.

## Note

All four intents are CN/EN paraphrases of the same library-add/lookup family and produce identical routing — bilingual symmetry holds for the library/context7 domain.

## Question behavior (opencode-side, traced 2026-07-12)

- **C2-EN raised a `question`** ("Which date formatting library would you like to add?"). The library-dep/context7-first boost was captured pre-question.
- The keyword-boost driver initially did not poll `GET /question` nor reply → C2-EN's question went unanswered. Corrected post-hoc (replied via `POST /question/{QID}/reply`; agent resumed). See `OPEN-GAPS.md` §C2.
