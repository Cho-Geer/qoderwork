# Git Write Grant 收尾补齐

**为什么**: 计划文档审核后仍有两个实现缺口：direct GitHub MCP 写路径缺 active runtime hook，repo grant 缺 runtime cleanup，导致治理闭环和文档状态不一致。

**改了什么**:
- `work-one/.opencode/plugin-handlers/before/codegraph.ts` — 增加 `github_*` read/write 分流：读放行，写 fail-closed 并指向 `safe_gh_*` / `safe_repo_push`
- `work-one/.opencode/plugins/before-dispatcher.ts` — 为 `codegraph` handler 增加 `github_*` 前缀匹配
- `work-one/.opencode/lib/db-maintenance.ts` — 增加 expired `pending/bound` repo grant revoke、old terminal grant cleanup、`repo_operation_events` cleanup
- `work-one/.opencode/plugin-handlers/before/__tests__/codegraph.test.ts` — 新增 GitHub MCP active hook 单测
- `work-one/.opencode/lib/__tests__/db-maintenance.test.ts` — 新增 repo grant cleanup 单测
- `plans/git-write-grant/*.md` — 同步 README / implementation / e2e / executor / status audit 当前状态

**决策**: 保留用户当前未提交的 `explore.model=glm-5.2` 漂移不动，本轮只补治理闭环；证据级别提升到“代码接线 + unit test”，但仍不宣称 remote positive live E2E 已完成。
