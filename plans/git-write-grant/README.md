# Git Write Grant Plan

**Created**: 2026-07-07
**Status**: Implemented and audited on 2026-07-08
**Scope**: OpenCode work-one repo operation governance

This directory contains the implementation plan and E2E acceptance standard for
first-class repo operation tools and grant-based git/gh write control.

## Current Status

The main local repo-write path is implemented in work-one and verified by code
review plus exported E2E evidence under `../../e2e-evidence/`.

| Area | Status | Evidence |
|---|---|---|
| First-class repo tools | PASS | `safe_repo_*` and `safe_gh_*` tools in work-one commit `bc2493c4` |
| Local write grant | PASS | G9-003 live LLM E2E committed `e02a561a` and consumed grant |
| Read-only Scout/Explore impact | PASS/N/A | Explore/general live read tests PASS; `scout` remains not registered |
| Remote write default block | PASS | `g7-build-remote-write-block.json` blocks `safe_repo_push` and `safe_gh_pr_create` without grant |
| Remote write positive path | PARTIAL | Service-level dry-run + human-confirmation test PASS; no live agent remote-write success was executed |
| GitHub MCP write governance | PASS | Dedicated live smoke now completed: pre-restart stale daemon leaked one direct write, post-restart live smoke correctly blocked direct `github_*` write; see `2026-07-08-GitHub-MCP-live-E2E-现状报告.md` |

Open residuals:

- `work-one/opencode.json` is currently dirty: committed `explore` model was `deepseek-v4-pro`, working tree now has `glm-5.2`. Decide whether to commit or revert that config drift before treating the branch as clean.
- `db-repo-grants.json` remains a historical evidence snapshot containing one old `.task_temp/...` bound test grant; runtime cleanup now revokes expired `pending/bound` grants and prunes old terminal grants/events, but grant-creation-time runtime-path validation is still optional hardening.

## Documents

| Document | Purpose |
|---|---|
| [implementation-plan.md](./implementation-plan.md) | Concrete design and implementation plan for `safe_repo_*`, repo operation classification, grants, permissions, hooks, and Scout compatibility. |
| [executor-implementation-spec.md](./executor-implementation-spec.md) | Weak-model execution specification with exact phase order, files, exported functions, error codes, stop conditions, and code-review checklist. |
| [e2e-acceptance.md](./e2e-acceptance.md) | End-to-end acceptance matrix covering read-only repo operations, local git writes, remote git/gh writes, grant lifecycle, and negative cases. |
| [2026-07-08-继续实施说明.md](./2026-07-08-%E7%BB%A7%E7%BB%AD%E5%AE%9E%E6%96%BD%E8%AF%B4%E6%98%8E.md) | 本轮继续实施的中文说明，记录唯一ID、修改路径、生成路径、实现内容、配置方式与注意事项。 |
| [2026-07-08-GitHub-MCP-live-E2E-现状报告.md](./2026-07-08-GitHub-MCP-live-E2E-%E7%8E%B0%E7%8A%B6%E6%8A%A5%E5%91%8A.md) | GitHub MCP 读写 live smoke 的中文证据报告，包含重启前后差异、外部副作用和当前可宣称结论。 |

## Design Summary

The recommended path is to introduce stable first-class repo tools instead of
expanding `safe_shell` allowlists:

- `safe_repo_status`, `safe_repo_diff`, `safe_repo_log`, `safe_repo_show`, `safe_repo_branch`: read-only tools available to Orchestrator, build, general, explore, and future scout.
- `safe_repo_stage`, `safe_repo_unstage`, `safe_repo_commit`: local write tools requiring a bound `repo_maintenance` grant.
- `safe_repo_push` and `safe_gh_*` write tools: remote-write tools requiring a separate `remote_repo_write` grant and explicit human confirmation.

Scout impact is handled by keeping repo investigation read-only. Scout/explore
must be able to inspect status/diff/log evidence, but must not stage, commit,
push, or mutate GitHub state.
