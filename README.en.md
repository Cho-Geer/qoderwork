# qoderwork

> Personal AI Agent collaboration workspace / 个人 AI Agent 协作工作区 / 個人 AI エージェント連携ワークスペース

This repository is a **personal AI Agent governance workspace**, built on the OpenCode framework.
It centralizes plan-audit archiving, multi-agent orchestration, and skill/rules/memory operations.

---

## 📌 What it is

qoderwork is organized around four pillars:

- **Plan-Audit Archiver** — immutable, time-ordered artifacts covering design → review → retrospective
- **Agent Orchestration** — unified rule-based operation of OpenCode / Codex / Qoder / Trae / WorkBuddy
- **Skill / Memory Governance** — periodic consistency checks on Agent skills and persistent memory
- **Governance First** — discipline and verification are prioritized over delivery speed

In short: a **Plan–Audit–Code workspace for solo development**.

---

## 🏗 Layout

| Area | Role | Contents |
|---|---|---|
| `blueprints/` | Design (Plan layer) | Task definitions, dependencies, exit criteria |
| `audits/` | Audit logs | P0-2 / P0-3 / task-lens-m1 review records |
| `documents/` | Domain docs | Domain knowledge and design rationale |
| `e2e-evidence/` | Runtime evidence | Agent execution and verification logs |
| `AGENTS.md` / `RULES.md` / `MEMORY.md` | Session-wide rules | Agent behavior, judgment criteria, persistent memory |
| `.codebuddy/` `.qoder/` `.trae/` `.workbuddy/` `.kimi-code/` `.codex/` `.codegraph/` | Tool mirrors | Per-tool local configs |

---

## 🔁 Typical workflow

```
blueprints/   →   audits/   →   implement   →   e2e-evidence/   →   MEMORY.md
   design         review         commit            verify           update
```

---

## ⚙️ Tech

- TypeScript (primary)
- Bun (runtime)
- OpenCode Framework
- Conventional Commits
- Worktree-based development (`.worktrees/` is `.gitignore`'d)

---

## 📊 Activity

> Last 12 months on GitHub: ~600 commits / ~200 issues / 38 PRs
> Concentrated in 2026-03 to 2026-06 (4 months).
> Demonstrates sustained independent engineering activity.

---

## ⚠️ Security policy

- Never commit real API keys, tokens, or private keys
- `.env` and `secrets.*` are excluded via `.gitignore`
- GitHub Secret Scanning + Push Protection are enabled
- Placeholder strings like `mypassword` / `secret123` in examples are **not** real credentials

---

## 📄 License

No LICENSE file is included — this is a personal project.
**Read-only access** by default; redistribution, modification, or commercial use requires prior notice (Issue).

---

## 🇯🇵 日本語 | 🇨🇳 中文

- [日本語版](./README.md)
- [中文版本](./README.zh.md)
