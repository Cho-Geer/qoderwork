# Tool governance blueprint re-audit after safe_shell incident

**为什么**: live session `ses_0aa0c8f84ffeAI3ZRAtL8hFkOI` 暴露出 `safe_shell` 治理链并非只差 E2E 证据：`path-validate` 曾把 `gh --repo microsoft/vscode` 误判为本地路径，修复后又确认 `codegraph` 仍会先于 `repo-policy` 对 repo/gh 远程写抛 `CODEGRAPH-ENFORCE`。

**改了什么**:
- `qoderwork/blueprints/blueprint-tool-governance-mvc-refactor.md` — 升级到 v2.4.0，补写 2026-07-12 追补复核，修正“只剩 live E2E”的旧结论，新增 `path-validate` shell parser 修复、active before 链首裁决未统一、`codegraph` 过拦截 repo/gh remote write 等状态与风险。

**决策**: 不把本次事故归因为单一 repo-policy 缺陷；正式认定它是“治理域已落地，但 `path-validate` / `codegraph` 仍先于统一治理出手”的架构收口问题。蓝图后续重点改为“先统一 safe_shell 的首裁决顺序与解析权威源，再补 live LLM E2E”。
