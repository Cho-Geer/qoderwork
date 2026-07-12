# Git/GH 写操作 Grant 与一等 Repo 工具实施方案

**版本**: v1.1.0
**日期**: 2026-07-08
**状态**: 已实施并完成审核；存在少量非阻塞遗留项
**优先级**: P0/P1
**目标项目**: `/home/zhaoge/workspace/opencode/work-one`

---

## 0. 实施状态更新（2026-07-08）

审核结论：本方案的主链路已经落地。代码提交 `bc2493c4` 实现一等 repo 工具、repo grant、v35 DB 表、CodeGraph/safe_shell 拦截和 dispatch/session 绑定；`e02a561a` 由 G9-003 live LLM E2E 通过 `safe_repo_stage` + `safe_repo_commit` 创建并消费 `repo_maintenance` grant。组件测试 `bun test ./.opencode/service/repo/__tests__/*.test.ts` 为 114/114 PASS。

| 阶段 | 当前状态 | 证据级别 | 说明 |
|---|---|---|---|
| P0 classifier + read tools | PASS | Component + runtime | `classify.ts` 覆盖 git/gh/GitHub MCP；read tools 有 `REPO-READ-ALLOWED` 审计 |
| P1 `repo_maintenance` grant + local write | PASS | Component + live LLM | `repo_operation_grants` v35 表、grant bind/consume、G9-003 commit `e02a561a` |
| P2 Orchestrator -> build -> commit | PASS | Live LLM E2E | `g9-003-orchestrator-grant-lifecycle.json` + `g9-003-build-child-session.json` |
| P3 remote write policy | PARTIAL PASS | Component + runtime negative | `remote_repo_write` + human confirmation service-level dry-run PASS；live agent 只验证了默认阻断 |
| P4 Explore/Scout compatibility | PASS/N/A | Live LLM | Explore/general read-only PASS；`scout` 当前未注册，记为 N/A |
| P5 legacy cleanup | PARTIAL | Static | active repo error 已不建议 `Super-Admin`；历史文档/legacy handler 仍有 `Super-Admin` 字样 |

实现偏差与遗留项：

| 项 | 状态 | 处理建议 |
|---|---|---|
| `opencode.json` 工作区漂移 | OPEN | 当前未提交 diff 将 `explore` 模型从 `deepseek-v4-pro` 改回 `glm-5.2`；需由实现方决定提交或回退 |
| GitHub MCP 写工具 active hook | DONE | `codegraph` active before-hook 已阻断 direct `github_*` write，新增 read/write 单测，并已完成 serve API runtime smoke；注意修改后必须重启 serve daemon |
| G7 remote positive live E2E | DEFERRED | 已有 service-level human-confirmation + dry-run 9/9 PASS；如要宣称 live remote-write success，需要单独授权并用 live agent 调 `safe_repo_push(dryRun=true)` |
| 旧测试 grant 残留 | LOW | `db-repo-grants.json` 仍保留历史快照；runtime cleanup 已补齐 expired `pending/bound` revoke + old terminal grants/events prune，后续可再增加 grant 创建期 runtime-path 校验 |

## 1. 问题背景

### 1.1 当前问题

当前框架已经将主要运行时 agent 收敛为 `Orchestrator + build/general/explore/plan`，但 repo 操作仍主要通过 `safe_shell` 表达。这个模型在提交任务中暴露出三个问题：

| 问题 | 当前现象 | 影响 |
|---|---|---|
| `safe_shell` 语义过宽 | `codegraph` before-hook 拦截 `safe_shell`，读类 `git status/diff` 也可能被当成 source edit 阻断 | 只读调查和提交任务都会被误伤 |
| git/gh 写操作缺少一等边界 | `git add/commit/push`、`gh pr/issue/release/workflow/api` 写操作没有统一分类与 grant | 只能靠 allowlist/denylist 正则，难以稳定审计 |
| legacy 身份泄漏 | `Super-Admin` 仍出现在 legacy alias、配置和错误文案中，但当前真实执行多落到 native `build` | 不能再把 `Super-Admin` 当成稳定高权限修复身份 |

当前代码证据：

| 事实 | 证据 |
|---|---|
| Active agent 只有 `Orchestrator/build/general/plan/explore` | `opencode.json.agent` |
| `scout` 是 resolver 预留 native executor，但未注册到 `opencode.json.agent` | `.opencode/service/dispatch/agent-target.ts` |
| `codegraph` hook 拦截 `safe_shell`/`bash` | `.opencode/plugin-handlers/before/codegraph.ts` |
| `safe_shell` 通过 allowlist + dangerous pattern + eval/script scan 执行 | `.opencode/service/file-guard/shell-guard.ts` |
| shell 分类器已有基础，但 `gh` 与部分 git 写命令未覆盖 | `.opencode/service/dispatch/tool-scope-match.ts` |
| GitHub MCP server 已启用，存在 `github_create_*` 等写能力 | `opencode.json` + `.opencode/service/context/tool-summaries.ts` |

### 1.2 根因

直接原因：repo 操作被建模为通用 shell 命令，而不是框架一等工具。

根本原因：框架没有把 repo 操作按副作用强度建模为 `read / local-write / remote-write / destructive / hook-bypass`，也没有将写操作绑定到一次具体 dispatch/session 的 DB grant。

### 1.3 目标

本方案目标是：

1. 给 repo 操作建立稳定的一等工具边界。
2. 允许 Scout/Explore 做只读调查，不误伤证据采集。
3. 允许 Build 在 task-level grant 下执行本地 stage/commit。
4. 默认禁止 push/gh/GitHub MCP 写操作，除非存在单独 remote-write grant 和人工确认。
5. 不再依赖 legacy `Super-Admin` 作为 repo 写权限来源。

---

## 2. 方案对比

| 维度 | 方案 A: 扩大 `safe_shell` allowlist | 方案 B: hook 中继续加正则 | 方案 C: 一等 `safe_repo_*` 工具 + DB grant |
|---|---|---|---|
| 核心思路 | 允许更多 `git/gh` 命令 | 在 before-hook 中拦截危险命令 | 固定 repo 工具、固定参数、固定权限、grant 控制 |
| 实现复杂度 | 低 | 中 | 中高 |
| 安全边界 | 弱 | 中 | 强 |
| 可审计性 | 弱 | 中 | 强 |
| Scout 只读兼容 | 易误伤或过放 | 可做但分散 | 清晰 |
| 长期维护 | 差 | 一般 | 好 |

选择方案 C。

否决理由：

| 方案 | 否决原因 |
|---|---|
| A | `safe_shell` 本质是任意 shell，allowlist 扩大后很难阻止组合命令、重定向、别名和 `gh api` 写操作。 |
| B | 正则分散在多个 hook 中会产生重复分类、顺序依赖和误报；当前已有 `tool-scope` 分类器，应提升为 repo policy，而不是继续堆补丁。 |

---

## 3. 核心设计

### 3.1 Repo Operation Policy

新增服务模块：

```text
.opencode/service/repo/
  classify.ts
  grants.ts
  git.ts
  gh.ts
  audit.ts
  types.ts
```

核心类型：

```ts
export type RepoOperationKind =
  | "read"
  | "local_write"
  | "remote_write"
  | "destructive"
  | "hook_bypass"
  | "unknown";

export interface RepoOperation {
  provider: "git" | "gh" | "github_mcp";
  command: string;
  subcommand: string;
  kind: RepoOperationKind;
  paths: string[];
  remote: boolean;
  requiresGrant: boolean;
  requiresHumanConfirmation: boolean;
}
```

分类规则：

| 类别 | 示例 | 默认策略 |
|---|---|---|
| read | `git status`, `git diff`, `git log`, `git show`, `git branch --list`, `gh pr view`, `gh issue view`, `github_get_*`, `github_list_*`, `github_search_*` | 允许给 Orchestrator/build/general/explore/Scout |
| local_write | `git add`, `git restore --staged`, `git commit` | 需要 `repo_maintenance` grant |
| remote_write | `git push`, `gh pr create/comment/merge`, `gh issue create/comment/close`, `gh release create/upload`, `github_create_*`, `github_create_or_update_file` | 需要 `remote_repo_write` grant + human confirmation |
| destructive | `git reset --hard`, `git clean`, `git checkout --`, `git rebase`, `git merge`, `git stash pop`, `git worktree remove` | 默认拒绝；只有明确人工授权的 emergency grant 可放行 |
| hook_bypass | `git commit --no-verify`, `git -c core.hooksPath=... commit`, `git config core.hooksPath` | 永久拒绝 |
| unknown | 任意无法解析的 `git/gh` shell | fail closed |

### 3.2 一等工具清单

Repo read tools：

| Tool | 参数 | 允许 agent | 说明 |
|---|---|---|---|
| `safe_repo_status` | `porcelain?: boolean` | Orchestrator/build/general/explore/scout | 固定执行 `git status --short` 或 `git status --porcelain=v1` |
| `safe_repo_diff` | `paths?: string[]`, `cached?: boolean`, `stat?: boolean` | Orchestrator/build/general/explore/scout | 固定 argv 调用，不走 shell |
| `safe_repo_log` | `maxCount?: number`, `paths?: string[]` | Orchestrator/build/general/explore/scout | 最大条数上限，如 50 |
| `safe_repo_show` | `ref: string`, `paths?: string[]` | Orchestrator/build/general/explore/scout | 禁止 shell expansion |
| `safe_repo_branch` | `mode: "current" or "list"` | Orchestrator/build/general/explore/scout | 不允许创建/删除分支 |

Repo local write tools：

| Tool | 参数 | 允许 agent | Grant |
|---|---|---|---|
| `safe_repo_stage` | `paths: string[]` | build | `repo_maintenance` |
| `safe_repo_unstage` | `paths: string[]` | build | `repo_maintenance` |
| `safe_repo_commit` | `message: string`, `expectedPaths: string[]` | build | `repo_maintenance` |

Repo remote write tools：

| Tool | 参数 | 允许 agent | Grant |
|---|---|---|---|
| `safe_repo_push` | `remote`, `branch`, `dryRun?: boolean` | build | `remote_repo_write` + human confirmation |
| `safe_gh_pr_create` | title/body/base/head | build | `remote_repo_write` + human confirmation |
| `safe_gh_pr_comment` | pr/body | build/general if granted | `remote_repo_write` + human confirmation |
| `safe_gh_issue_comment` | issue/body | build/general if granted | `remote_repo_write` + human confirmation |

不提供通用 `safe_gh_api`。如必须支持，限制为 read-only HTTP method，写方法不通过通用 API 暴露。

### 3.3 Grant 模型

新增或扩展 DB-backed grant：

```sql
CREATE TABLE IF NOT EXISTS repo_operation_grants (
  id TEXT PRIMARY KEY,
  dispatch_key TEXT NOT NULL,
  parent_session_id TEXT NOT NULL,
  child_session_id TEXT,
  dag_task_id TEXT,
  agent_type TEXT NOT NULL,
  privilege TEXT NOT NULL,
  allowed_tools TEXT NOT NULL,
  allowed_paths TEXT NOT NULL,
  allowed_remotes TEXT NOT NULL DEFAULT '[]',
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  requires_human_confirmation INTEGER NOT NULL DEFAULT 0,
  human_confirmed_at INTEGER,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  bound_at INTEGER,
  consumed_at INTEGER,
  revoked_at INTEGER
);
```

Privilege values：

| Privilege | 含义 | 默认 TTL | 一次性 |
|---|---|---:|---|
| `repo_maintenance` | 本地 stage/commit | 30 分钟 | commit 后消费 |
| `remote_repo_write` | push/gh/GitHub MCP 写 | 10 分钟 | 单次远端写后消费 |
| `repo_destructive_emergency` | reset/clean/rebase/merge 等危险操作 | 5 分钟 | 单次操作后消费 |

建议复用当前 `dispatch_privilege_grants` 的生命周期模式，但不要混进 `framework_maintenance` 的路径语义。可以二选一：

| 选项 | 说明 | 建议 |
|---|---|---|
| 扩展 `dispatch_privilege_grants` | 将 `ALLOWED_PRIVILEGES` 增加 `repo_maintenance`/`remote_repo_write`，新增 remote/human confirmation 字段 | 如果希望少建表，可选 |
| 新增 `repo_operation_grants` | repo 操作独立审计和策略字段 | 推荐，语义更清晰，避免污染 framework edit grant |

### 3.4 与 `safe_shell` / CodeGraph / scope 的关系

关键原则：

1. `safe_shell` 不再作为 git/gh 写操作入口。
2. `safe_shell` 中的 read-only git 可以临时保留，但应逐步提示使用 `safe_repo_*`。
3. `codegraph` hook 遇到 repo read operation 应直接跳过 source-edit enforcement。
4. `codegraph` hook 遇到 repo local/remote write 不负责授权，应交给 repo policy 或直接阻断裸 `safe_shell`。
5. `scope-validate` 继续拦截 shell write bypass，但 repo 一等工具应通过自己的 policy + audit，不靠 shell path parser。

修改方向：

| 文件 | 改动 |
|---|---|
| `.opencode/service/dispatch/tool-scope-match.ts` | 扩展 shell classification：覆盖 `gh`、更多 git subcommand，或拆出 repo classifier 供其复用 |
| `.opencode/plugin-handlers/before/codegraph.ts` | 对 `safe_shell git status/diff/log/show/branch --list` 识别为 repo read 并跳过；对写类 git/gh 返回明确“使用 safe_repo_*”错误 |
| `.opencode/service/file-guard/shell-guard.ts` | 在 allowlist 前加入 repo classifier；写类 git/gh fail closed |
| `.opencode/plugin-handlers/before/git-guard.ts` | 退化为 hook-bypass 专项或归档到 repo policy |

### 3.5 权限矩阵

`opencode.json` 建议：

| Agent | Read repo tools | Local write repo tools | Remote write repo tools |
|---|---|---|---|
| Orchestrator | allow | deny | deny |
| build | allow | allow, grant required | allow, grant + human confirmation required |
| general | allow | deny | deny by default |
| explore | allow | deny | deny |
| plan | allow minimal or deny | deny | deny |
| scout future | allow | deny | deny |

注意：如果 native `scout` 后续加入 `opencode.json.agent`，只注册 repo read tools，不注册 stage/commit/push/gh write tools。

### 3.6 Scout 影响设计

Scout/Explore 的职责是调查，不是修改。

必须保留：

- 查看当前分支。
- 查看 `git status --short`。
- 查看 unstaged/staged diff。
- 查看最近 commits。
- 查看 PR/issue 的只读信息。

必须禁止：

- `git add/commit/push/reset/checkout/rebase/merge/stash/worktree remove`。
- `gh pr create/merge/comment/edit/close`。
- `gh issue create/comment/edit/close`。
- `gh release/workflow/secret` 写操作。
- `github_create_*` / `github_create_or_update_file` 等 MCP 写操作。

Scout E2E 必须证明：Scout 能收集 repo evidence，但不能产生任何 repo mutation。

### 3.7 日志与审计

所有 repo tool 必须写集中日志：

```text
.task_temp/_logs/YYYY-MM-DD/plugin-repo-operation-runtime.log
```

事件建议：

| Event | 触发 |
|---|---|
| `REPO-OP-CLASSIFIED` | 每次 classify |
| `REPO-READ-ALLOWED` | 只读 repo 操作放行 |
| `REPO-WRITE-GRANT-MISSING` | 写操作缺 grant |
| `REPO-WRITE-GRANT-BOUND` | grant 绑定 child session |
| `REPO-WRITE-STAGED` | 成功 stage |
| `REPO-COMMIT-SUCCESS` | commit 成功，记录 sha |
| `REPO-COMMIT-HOOK-FAILED` | hook 失败 |
| `REPO-REMOTE-WRITE-BLOCKED` | 远端写缺 human confirmation |
| `REPO-HOOK-BYPASS-BLOCKED` | `--no-verify` 等被拒 |
| `REPO-SCOUT-WRITE-BLOCKED` | Scout/Explore 写操作被拒 |

同时写 DB audit 表：

```sql
CREATE TABLE IF NOT EXISTS repo_operation_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  tool TEXT NOT NULL,
  operation_kind TEXT NOT NULL,
  provider TEXT NOT NULL,
  command_summary TEXT NOT NULL,
  paths TEXT NOT NULL,
  grant_id TEXT,
  result TEXT NOT NULL,
  commit_sha TEXT,
  error TEXT,
  created_at INTEGER NOT NULL
);
```

---

## 4. 实施清单

### 4.1 文件变更表

| 文件 | 类型 | 内容 |
|---|---|---|
| `.opencode/service/repo/types.ts` | 新建 | Repo operation 类型、grant 类型、结果类型 |
| `.opencode/service/repo/classify.ts` | 新建 | git/gh/GitHub MCP 分类器 |
| `.opencode/service/repo/grants.ts` | 新建 | repo grant 创建、绑定、校验、消费、撤销 |
| `.opencode/service/repo/git.ts` | 新建 | 固定 argv 的 git read/local write 执行 |
| `.opencode/service/repo/gh.ts` | 新建 | 固定 argv 的 gh read/remote write 执行 |
| `.opencode/service/repo/audit.ts` | 新建 | repo_operation_events + writeLog |
| `.opencode/tools/safe_repo_status.ts` | 新建 | repo status 一等工具 |
| `.opencode/tools/safe_repo_diff.ts` | 新建 | repo diff 一等工具 |
| `.opencode/tools/safe_repo_log.ts` | 新建 | repo log 一等工具 |
| `.opencode/tools/safe_repo_show.ts` | 新建 | repo show 一等工具 |
| `.opencode/tools/safe_repo_branch.ts` | 新建 | repo branch read 一等工具 |
| `.opencode/tools/safe_repo_stage.ts` | 新建 | grant 保护的 stage |
| `.opencode/tools/safe_repo_unstage.ts` | 新建 | grant 保护的 unstage |
| `.opencode/tools/safe_repo_commit.ts` | 新建 | grant 保护的 commit |
| `.opencode/tools/safe_repo_push.ts` | 新建/P1 | remote grant 保护的 push |
| `.opencode/tools/safe_gh_pr_create.ts` | 新建/P1 | remote grant 保护的 PR 创建 |
| `.opencode/lib/db-manager.ts` | 修改 | schema migration：repo_operation_grants/events |
| `.opencode/service/dispatch/router.ts` | 修改 | 支持 `dispatch_privilege=repo_maintenance/remote_repo_write` |
| `.opencode/scripts/command-tools/dispatch-subagent.ts` | 修改 | 透传 repo grant env |
| `.opencode/plugins/session.ts` | 修改 | child session/chat hook 绑定 repo grant |
| `.opencode/plugin-handlers/before/codegraph.ts` | 修改 | repo read 跳过 source-edit；repo write 指向 safe_repo 工具 |
| `.opencode/service/file-guard/shell-guard.ts` | 修改 | 裸 `git/gh` 写操作 fail closed |
| `.opencode/service/dispatch/tool-scope-match.ts` | 修改 | 复用 repo classifier 或减少重复 shell 分类 |
| `.opencode/service/context/tool-summaries.ts` | 修改 | 增加 safe_repo/safe_gh tool 摘要 |
| `.opencode/service/context/mcp-role-filter.ts` | 修改/P1 | 如果接线 MCP role filter，确保 GitHub 写工具不可见或需 grant |
| `opencode.json` | 修改 | 注册 safe_repo 工具权限 |
| `.opencode/agents/Orchestrator.md` | 修改 | repo operation 规则和 result gate |
| `qoderwork/e2e/` 或 `qoderwork/scripts/` | 新建 | E2E 脚本 |

### 4.2 Phase 计划

| Phase | 内容 | 当前状态 | 证据 |
|---|---|---|---|
| P0 | repo classifier + read tools + CodeGraph/safe_shell 误拦截修复 | PASS | 114/114 unit + read audit logs |
| P1 | `repo_maintenance` grant + stage/commit tools + audit DB | PASS | v35 schema + G4/G9 grant lifecycle |
| P2 | Live Orchestrator -> build -> commit E2E | PASS | G9-003 commit `e02a561a` |
| P3 | remote write policy + safe_gh/safe_repo_push + human confirmation | PARTIAL PASS | default block live PASS; positive path service-level dry-run PASS |
| P4 | Scout/explore read-only E2E + future `scout` config guard | PASS/N/A | Explore/general PASS; `scout` not registered |
| P5 | legacy cleanup：Super-Admin 文案、git-guard 归档、旧 auto-commit skill 警戒 | PARTIAL | active repo messages clean; legacy docs/handlers remain |

---

## 5. 关键实现约束

### 5.1 Git 执行方式

必须使用 `execFileSync("git", args, ...)` 或等价固定 argv，不使用 `execSync("git ...")`。

禁止：

- shell string 拼接。
- `git add .`。
- `git commit --no-verify`。
- `git -c core.hooksPath=... commit`。
- 自动 push。
- 对 `.opencode/state.db`、`.opencode/state/*.db*`、`.opencode/_test_framework/**`、`.task_temp/**` 等 runtime/test 文件默认 stage。

### 5.2 Commit 工具流程

`safe_repo_commit` 必须执行：

1. 检查 child session 是否有 bound `repo_maintenance` grant。
2. 检查 `expectedPaths` 非空且全部匹配 grant `allowed_paths`。
3. 检查 staged files 与 `expectedPaths` 完全一致或严格子集。
4. 检查无未允许 runtime/test 文件进入 index。
5. 执行 `git commit -m <message>`，不允许 hook bypass。
6. 捕获 hook 输出。
7. 成功后记录 commit sha，消费 grant。
8. 失败时不消费 grant，但记录失败并返回可恢复信息。

### 5.3 Remote write 流程

远端写必须额外满足：

1. `remote_repo_write` grant。
2. `requires_human_confirmation=1`。
3. `human_confirmed_at` 不为空且未过期。
4. remote/branch/repo 匹配 grant allowlist。
5. dry-run 或 preview 已返回给 Orchestrator/QoderWork。

默认不提供自动 remote write。即使用户授权 repo commit，也不等于授权 push 或 gh 写。

### 5.4 Scout/Explore 兼容

不能通过“全面禁用 git/gh”实现安全。Scout/Explore 需要只读 repo evidence。正确策略是：

| 操作 | Scout/Explore |
|---|---|
| `safe_repo_status` | allow |
| `safe_repo_diff` | allow |
| `safe_repo_log` | allow |
| `safe_repo_show` | allow |
| `safe_repo_branch` | allow read |
| `safe_repo_stage` | deny |
| `safe_repo_commit` | deny |
| `safe_repo_push` | deny |
| `safe_gh_*` write | deny |

---

## 6. 风险与回滚

| 风险 | 影响 | 缓解 |
|---|---|---|
| classifier 漏判写操作 | 远端或本地状态被误改 | unknown fail closed；E2E 覆盖 `gh api -X POST/PATCH/DELETE` |
| commit 工具 stage 错误文件 | runtime/test 文件进入 commit | staged files 必须与 expectedPaths 比对；默认排除 DB/test scaffold |
| Scout 被误伤 | 调查 agent 失去 repo evidence | read tools 独立授权给 explore/scout |
| grant 绑定 race | 非目标 session 消费 grant | 复用 dispatch exact key + child session bind，消费时校验 session |
| hooks 执行环境不稳定 | commit 失败 | commit 工具返回 hook stdout/stderr，不允许 bypass |
| remote write 被误放行 | push/PR/issue 意外发生 | remote grant + human confirmation 双门；默认不注册通用 `safe_gh_api` |

回滚方案：

1. 从 `opencode.json` 移除 `safe_repo_*` / `safe_gh_*` 写工具权限。
2. 保留 read tools 或全部禁用新工具。
3. 将 `dispatch_privilege=repo_maintenance/remote_repo_write` 在 router 中拒绝。
4. 保留 DB 表，不删除数据；后续迁移只标记 deprecated。
5. `safe_shell` 恢复旧读类 git 行为，但写类 git/gh 仍建议保持 deny。

---

## 7. 成功标准

- [x] `git status/diff/log/show/branch` 读操作不再被 `CODEGRAPH-ENFORCE` 误判为 source edit。
- [x] Explore/general 能通过一等 repo read tools 收集 evidence；`scout` 未注册，按 N/A 处理。
- [x] Build/general 无 grant 时无法 stage/commit。
- [x] Build 有 `repo_maintenance` grant 时可以 stage 指定文件并 commit，commit 后 grant consumed。
- [x] `git commit --no-verify`、`core.hooksPath`、`core.skipHooks` 永久拒绝。
- [x] `git push`、`gh` 写操作和 direct GitHub MCP 写操作默认拒绝；GitHub MCP write 已接入 active `codegraph` before-hook，且已完成 serve API runtime smoke。
- [ ] PARTIAL: remote write 只有在 `remote_repo_write` grant + human confirmation 下才能执行：service-level dry-run PASS，live agent success deferred。
- [x] repo operation 写入 DB audit 和 `.task_temp/_logs`。
- [x] legacy `Super-Admin` 不再作为 repo 写权限依据出现在 active-path repo 错误文案中；历史文档/legacy handler 清理未完成。
