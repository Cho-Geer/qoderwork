# Git Write Grant: Full Implementation + E2E Verification

**为什么**: work-one 框架缺少一等 repo 工具，git/gh 操作走 safe_shell 导致 CodeGraph 误拦截读操作，写操作缺少统一 grant 控制。

**改了什么** (57 files, +3935/-169, commit `bc2493c4`):
- `.opencode/service/repo/` — 7 files: types, classify (617L), grants (397L), git, gh, audit + 3 test files
- `.opencode/tools/safe_repo_*.ts` — 9 read/write tools + `safe_repo_push.ts`
- `.opencode/tools/safe_gh_*.ts` — 3 remote write tools (pr_create, pr_comment, issue_comment)
- `.opencode/lib/db-manager.ts` — v35 migration: repo_operation_grants + repo_operation_events
- `.opencode/plugin-handlers/before/codegraph.ts` — repo read 跳过 CodeGraph，repo write 指向 safe_repo_*
- `.opencode/service/file-guard/shell-guard.ts` — git/gh 写操作通过 safe_shell 阻断
- `.opencode/scripts/command-tools/dispatch-subagent.ts` — repo grant 创建（REPO_PRIVILEGES 分支）
- `.opencode/plugins/session.ts` — repo grant 绑定（dispatch key 匹配 child session）
- `.opencode/service/dispatch/router.ts` — dispatch_key + allowed_remotes 透传
- `opencode.json` — 5 agent 权限矩阵（Orchestrator=read, build=all, explore/general=read, plan=minimal）

**决策**:
- 独立 `repo_operation_grants` 表而非扩展 `dispatch_privilege_grants`
- 分类器使用固定 argv 解析（execFileSync），禁止 shell 字符串拼接
- Remote write 需 `remote_repo_write` grant + human confirmation 双门

**测试结果**:
- Unit: 114/114 PASS（classify 70 + grants 18 + git 26）
- G4 script-level E2E: 12/12 PASS
- **G7 Negative (default block)**: `safe_repo_push` + `safe_gh_pr_create` 无 grant → `REPO-REMOTE-WRITE-BLOCKED`。审计确认
- **G7 Positive (human confirmation)**: 9/9 PASS。grant created(requires_human=1) → bound → WITHOUT confirm→blocked → confirmRepoGrant() → WITH confirm→allowed → wrong remote→blocked → dry-run push → consumed → consumed grant→blocked。Grant `04e3686c`
- **G8 Explore read-only (live LLM)**: explore(deepseek-v4-pro) `safe_repo_status` → REPO-READ-ALLOWED 成功; `safe_repo_stage` → tool not available (permission denied) + `safe_shell` bypass → `[FW-ENFORCE][REPO-OP]` blocked。双层防御确认
- **G8 General read-only (live LLM)**: general `safe_repo_status` → REPO-READ-ALLOWED; `safe_repo_stage` → REPO-WRITE-GRANT-MISSING
- **G9-001 Live LLM E2E**: Orchestrator 使用 5 个 read tools，REPO-READ-ALLOWED 审计确认
- **G9-002 Live LLM E2E**: Orchestrator → build（无 grant）→ BLOCKED
- **G9-003 Live LLM E2E**: Orchestrator → dispatch_subagent(repo_maintenance) → build → stage + commit `e02a561a` → grant consumed

**已完成**:
- `.gitignore` 补齐（.opencode/state.db + .opencode/_test_framework/），commit `8f5c1527`
- Explore 模型从 glm-5.2 更新为 deepseek-v4-pro，explore agent 现在正常工作
- Serve 重启 + bun cache 清理

**剩余**: 无关键剩余项。G7 正向路径和 G8 explore live E2E 均已验证
