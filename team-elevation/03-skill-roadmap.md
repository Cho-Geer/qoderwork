# 03 · Team Skill Leveling Roadmap

A role-based path from Junior → Mid → Senior → Staff, mapped to the **current** work-one runtime shape: 5 registered agents in `opencode.json`, 37 custom tools, 18 skills, 5 plugin entrypoints, and a DB-backed repo grant system. Use it for hiring bars, promotion cases, and 1:1 growth plans.

---

## Competency matrix

| Competency | Junior | Mid | Senior | Staff |
|-----------|--------|-----|--------|-------|
| **TypeScript** | Writes typed functions; avoids `any` with help | Strict-mode fluent; designs types | Migrates legacy to strict; reviews types | Sets TS standards org-wide |
| **OpenCode tools** | Adds a tool with template + test | Designs safe-wrapped tools (safe_*) | Owns tool architecture & grant model | Defines tool platform strategy |
| **plugin-handlers** | Reads before/after flows | Adds a gate correctly (no net block) | Debugs gate interactions & ordering | Redesigns hook pipeline |
| **DB / SQLite** | Writes parameterized queries | Designs migrations via schema_version | Optimizes transactions; audits arity | DB scaling & integrity strategy |
| **Testing** | Unit-tests own tools | E2E on dispatch path | Authors test strategy & fixtures | Quality gates + CI architecture |
| **Code review** | Receives reviews | Reviews peers' PRs | Blocks Majors; mentors | Sets review culture |
| **Architecture** | Follows patterns | Proposes localized refactors | Drives module redesign | Cross-system architecture |

---

## Leveling milestones (measurable)

**Junior → Mid**
- Shipped 5+ tools, each with a passing test.
- Zero `any` in own code; `tsc` green without help.
- Led 1 small PR review end-to-end.

**Mid → Senior**
- Owned a handler or DB migration that shipped to `main`.
- Blocked a Major in review with a correct, cited reason.
- Triaged ≥ 10 meaningful debt items (cleanup, backup artifacts, empty catches, legacy typing escapes, or stale docs).
- On-call capable: debugged a serve-API / dispatch failure.

**Senior → Staff**
- Designed or hardened a quality gate path (for example standalone MCP-gate CI integration, framework-self-test hardening, or semantic-validator coverage).
- Drove a cross-module refactor (e.g., consolidated duplicate CI).
- Mentors ≥ 2 engineers; published a standards doc adopted by the team.

---

## Mentoring cadence

- **Weekly senior-led review**: 60 min, rotate PRs, live-review one tricky diff.
- **Pairing**: 2 hrs/week junior↔senior on a real tool or handler.
- **RFC process**: any change touching `before`/`after` gates or DB schema needs a 1-page RFC reviewed by a senior first.
- **Demo Friday**: 15 min each, show one thing you learned (keeps craft visible).

---

## Growth tracks (pick one to go deep)

- **Platform track**: tools + handlers + MCP servers + serve API.
- **Data track**: SQLite schema, migrations, tool-tracker integrity, codegraph.
- **Quality track**: CI gates, framework self-test, `code-quality-check` / `compliance-gate` integration, test strategy.

Map each engineer to a track; seniors span two.

---

## 30/60/90 for a new hire

- **30**: environment setup, read `AGENTS.md` + `documents/INDEX.md`, ship 1 tool + test.
- **60**: own a handler tweak + a DB migration; review 3 PRs.
- **90**: lead a small refactor; present a tech-debt triage plan.
