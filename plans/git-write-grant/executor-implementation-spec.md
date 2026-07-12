# Git/GH 写操作 Grant 弱模型执行规格

**版本**: v1.1.0
**日期**: 2026-07-08
**状态**: 已执行；保留为弱模型回归与后续补项施工规格
**执行方**: OpenCode 弱模型 build/explore/general 子 agent
**审核方**: QoderWork 强模型
**目标项目**: `/home/zhaoge/workspace/opencode/work-one`

---

## 0. 执行边界

本文件是给弱模型实施用的施工规格。执行时必须按 phase 顺序推进，不允许一次性大改。

### 0.0 执行后审核摘要（2026-07-08）

弱模型已完成主实现，强模型审核通过本地 repo-write 主链路：

| Phase | 状态 | 证据 |
|---|---|---|
| P0 baseline | PASS | work-one 当前提交包含 `bc2493c4`/`8f5c1527`/`62e804b6` |
| P1 classifier | PASS | 114/114 unit PASS，含 git/gh/GitHub MCP 分类 |
| P2 grants | PASS | v35 `repo_operation_grants`/`repo_operation_events` 已实现 |
| P3 git/gh service | PASS | 使用固定 argv `execFileSync`，未发现 `execSync("git ...")` 字符串拼接 |
| P4 tool implementations | PASS | `safe_repo_*` + `safe_gh_*` 已注册；build 写工具、explore/general 读工具 |
| P5 hook integration | PASS | `safe_shell`/CodeGraph 对裸 git/gh 写 fail closed |
| P6 dispatch/session binding | PASS | G9-003 repo grant bind -> commit -> consume |
| P7 permissions/tool summaries | PASS | `opencode.json` 与 tool summaries 已更新 |
| P8 tests | PASS/PARTIAL | 本地主链路 live E2E PASS；remote positive 仍是 service-level dry-run |

后续弱模型只能处理以下补项，不应重做主实现：

- 解决 `opencode.json` 当前未提交的 explore model 配置漂移。
- direct GitHub MCP 写 active hook 的 runtime smoke 已在 2026-07-08 补齐；后续只需保留“修改后必须重启 serve daemon”的运行约束说明。
- 如用户授权，只做 `safe_repo_push(dryRun=true)` live agent positive E2E；禁止真实 push/PR/issue 写。
- 如需更强硬化，可在 grant 创建阶段直接拒绝 runtime/test 路径；expired/bound 自动撤销与 terminal grant cleanup 已在 2026-07-08 补齐。

### 0.1 必须遵守

1. 先完成 P0 classifier + read tools，再进入 grant/write tools。
2. 每个 phase 完成后必须输出：改动文件、测试命令、测试结果、剩余风险。
3. 所有新增 shell/git/gh 执行必须使用固定 argv，禁止 `execSync("git ...")` 字符串拼接。
4. 所有写操作必须 fail closed。
5. 不允许通过 `Super-Admin`、`breakGlass`、`--no-verify` 或裸 `safe_shell git/gh` 完成写操作。
6. 不允许真实 push、真实 PR/issue/release 写操作，除非用户单独明确授权。
7. Scout/Explore 只能拿 repo read tools，不能拿 stage/commit/push/gh write tools。

### 0.2 Stop Conditions

遇到以下情况必须停止并汇报，不要继续尝试绕过：

| Code | 条件 | 必须汇报 |
|---|---|---|
| `STOP_REMOTE_WRITE` | 需要真实 `git push` 或 `gh`/GitHub MCP 写远端 | 请求 human confirmation |
| `STOP_HOOK_BYPASS` | 需要 `--no-verify`、`core.hooksPath`、`core.skipHooks` | 说明 hook bypass 永久禁止 |
| `STOP_UNKNOWN_REPO_CMD` | git/gh 命令分类为 unknown | 输出命令与分类结果 |
| `STOP_DIRTY_INDEX` | commit 前 index 混入未授权文件 | 输出 staged file 列表 |
| `STOP_GRANT_MISSING` | 写操作缺 grant 或 grant 未绑定当前 child session | 输出 session id 和 tool |
| `STOP_SCOUT_WRITE` | Scout/Explore 尝试 repo 写操作 | 输出 agent 和 tool |
| `STOP_SCHEMA_DRIFT` | DB schema 与本规格不一致 | 输出 `PRAGMA table_info` |

### 0.3 交付物

每个 phase 的 handoff 必须包含：

```text
Changed files:
- <path> — <one-line change>

Verification:
- <command> => PASS/FAIL

Evidence:
- log path:
- DB query:
- session id, if runtime:

Residual risk:
- <risk or none>
```

---

## 1. Phase P0 — Baseline And Current-Code Guard

### 1.1 开始前命令

在 `/home/zhaoge/workspace/opencode/work-one` 执行：

```bash
git diff --stat
git log --oneline -5
codegraph status
python3 - <<'PY'
import json
cfg=json.load(open('opencode.json'))
print(sorted((cfg.get('agent') or {}).keys()))
print(cfg.get('default_agent'))
PY
```

预期：

- `codegraph status` up to date。
- active agents 为 `Orchestrator/build/general/explore/plan`。
- 如果 worktree 已有用户改动，不得 revert，不得覆盖。

### 1.2 必读文件

实施前必须读取：

```text
.opencode/tools/safe_shell.ts
.opencode/tools/safe_framework_edit.ts
.opencode/service/file-guard/shell-guard.ts
.opencode/service/file-guard/shell-config.ts
.opencode/service/dispatch/tool-scope-match.ts
.opencode/service/dispatch/privilege.ts
.opencode/service/dispatch/router.ts
.opencode/plugins/session.ts
.opencode/plugin-handlers/before/codegraph.ts
.opencode/service/context/tool-summaries.ts
opencode.json
```

---

## 2. Phase P1 — Repo Operation Classifier

### 2.1 新建文件

```text
.opencode/service/repo/types.ts
.opencode/service/repo/classify.ts
.opencode/service/repo/audit.ts
```

### 2.2 `types.ts`

必须导出：

```ts
export type RepoProvider = "git" | "gh" | "github_mcp";

export type RepoOperationKind =
  | "read"
  | "local_write"
  | "remote_write"
  | "destructive"
  | "hook_bypass"
  | "unknown";

export type RepoDecision =
  | "allow"
  | "block"
  | "grant_required"
  | "human_confirmation_required";

export interface RepoOperation {
  provider: RepoProvider;
  command: string;
  argv: string[];
  subcommand: string;
  kind: RepoOperationKind;
  decision: RepoDecision;
  paths: string[];
  remotes: string[];
  requiresGrant: boolean;
  requiresHumanConfirmation: boolean;
  reason: string;
}

export interface RepoClassificationInput {
  provider?: RepoProvider;
  command?: string;
  argv?: string[];
  toolName?: string;
  args?: Record<string, unknown>;
}
```

### 2.3 `classify.ts`

必须导出：

```ts
export function classifyRepoOperation(input: RepoClassificationInput): RepoOperation;
export function classifyGitArgv(argv: string[]): RepoOperation;
export function classifyGhArgv(argv: string[]): RepoOperation;
export function classifyGithubMcpTool(toolName: string, args?: Record<string, unknown>): RepoOperation;
export function splitRepoShellCommand(command: string): string[] | null;
export function classifyRepoShellCommand(command: string): RepoOperation;
export function isRepoReadOperation(op: RepoOperation): boolean;
export function isRepoWriteOperation(op: RepoOperation): boolean;
```

实现要求：

1. `splitRepoShellCommand()` 只允许单条命令；遇到 `;`、`&&`、`||`、管道、重定向时返回 `null`。
2. `classifyRepoShellCommand()` 对 multi-command 直接返回 `unknown/block`。
3. `git -c core.hooksPath=... commit`、`git -c core.skipHooks=... commit`、`git config core.hooksPath`、`git commit --no-verify` 必须返回 `hook_bypass/block`。
4. `gh api -X POST|PUT|PATCH|DELETE` 必须返回 `remote_write/human_confirmation_required`。
5. 任何无法分类的 `git` 或 `gh` 返回 `unknown/block`。

### 2.4 Git 分类表

| Pattern | Kind | Decision |
|---|---|---|
| `git status ...` | read | allow |
| `git diff ...` | read | allow |
| `git log ...` | read | allow |
| `git show ...` | read | allow |
| `git branch`, `git branch --list`, `git branch --show-current` | read | allow |
| `git add <paths>` | local_write | grant_required |
| `git restore --staged <paths>` | local_write | grant_required |
| `git reset <paths>` without `--hard` | local_write | grant_required |
| `git commit -m <msg>` | local_write | grant_required |
| `git push ...` | remote_write | human_confirmation_required |
| `git tag`, `git merge`, `git rebase`, `git stash`, `git checkout`, `git switch`, `git worktree` write forms | destructive | block |
| `git reset --hard`, `git clean ...` | destructive | block |
| `git commit --no-verify`, `git commit -n` | hook_bypass | block |
| `git config core.hooksPath`, `git config core.skipHooks` | hook_bypass | block |

### 2.5 GH 分类表

| Pattern | Kind | Decision |
|---|---|---|
| `gh pr view`, `gh pr list`, `gh issue view`, `gh issue list`, `gh repo view`, `gh release view`, `gh release list` | read | allow |
| `gh pr create`, `gh pr comment`, `gh pr merge`, `gh pr edit`, `gh pr close`, `gh pr review` | remote_write | human_confirmation_required |
| `gh issue create`, `gh issue comment`, `gh issue edit`, `gh issue close` | remote_write | human_confirmation_required |
| `gh release create`, `gh release upload`, `gh release delete`, `gh release edit` | remote_write | human_confirmation_required |
| `gh workflow run`, `gh workflow enable`, `gh workflow disable` | remote_write | human_confirmation_required |
| `gh secret set`, `gh secret delete` | remote_write | human_confirmation_required |
| `gh api -X GET ...` | read | allow |
| `gh api -X POST|PUT|PATCH|DELETE ...` | remote_write | human_confirmation_required |
| unknown `gh ...` | unknown | block |

### 2.6 GitHub MCP 分类表

| Tool | Kind | Decision |
|---|---|---|
| `github_search_*` | read | allow |
| `github_get_*` | read | allow |
| `github_list_*` | read | allow |
| `github_create_issue` | remote_write | human_confirmation_required |
| `github_create_pull_request` | remote_write | human_confirmation_required |
| `github_create_or_update_file` | remote_write | human_confirmation_required |
| `github_fork_repository` | remote_write | human_confirmation_required |
| unknown `github_*` | unknown | block |

### 2.7 Unit Test

新增：

```text
.opencode/service/repo/__tests__/classify.test.ts
```

最低用例：

```text
git status --short => read/allow
git diff -- .opencode/plugin.ts => read/allow
git add file.ts => local_write/grant_required
git commit -m x => local_write/grant_required
git commit --no-verify -m x => hook_bypass/block
git -c core.hooksPath=/tmp/noop commit -m x => hook_bypass/block
git reset --hard HEAD => destructive/block
git checkout -- file.ts => destructive/block
git push origin work-one => remote_write/human_confirmation_required
gh pr view 1 => read/allow
gh pr comment 1 -b x => remote_write/human_confirmation_required
gh api -X PATCH repos/a/b/issues/1 => remote_write/human_confirmation_required
github_get_pull_request => read/allow
github_create_or_update_file => remote_write/human_confirmation_required
git status && git add x => unknown/block
```

---

## 3. Phase P2 — Repo Grants

### 3.1 新建文件

```text
.opencode/service/repo/grants.ts
```

### 3.2 DB migration

修改：

```text
.opencode/lib/db-manager.ts
```

新增幂等迁移。版本号必须使用当前最大 schema 后的下一个版本，不要硬编码覆盖已有 v34；实施时先查询当前 `schema_version max(version)`。

表：

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

CREATE INDEX IF NOT EXISTS idx_repo_grants_dispatch_key
  ON repo_operation_grants(dispatch_key, status);

CREATE INDEX IF NOT EXISTS idx_repo_grants_child
  ON repo_operation_grants(child_session_id, privilege, status, expires_at);

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

### 3.3 `grants.ts`

必须导出：

```ts
export type RepoPrivilege =
  | "repo_maintenance"
  | "remote_repo_write"
  | "repo_destructive_emergency";

export interface RepoGrant {
  id: string;
  dispatch_key: string;
  parent_session_id: string;
  child_session_id: string | null;
  dag_task_id: string | null;
  agent_type: string;
  privilege: RepoPrivilege;
  allowed_tools: string;
  allowed_paths: string;
  allowed_remotes: string;
  reason: string;
  status: "pending" | "bound" | "consumed" | "revoked";
  requires_human_confirmation: 0 | 1;
  human_confirmed_at: number | null;
  expires_at: number;
  created_at: number;
  bound_at: number | null;
  consumed_at: number | null;
  revoked_at: number | null;
}

export interface CreateRepoGrantInput {
  dispatch_key: string;
  parent_session_id: string;
  agent_type: string;
  privilege: RepoPrivilege;
  allowed_tools: string[];
  allowed_paths: string[];
  allowed_remotes?: string[];
  reason: string;
  dag_task_id?: string;
  ttl_ms?: number;
  requires_human_confirmation?: boolean;
}

export function createRepoGrant(input: CreateRepoGrantInput): RepoGrant | null;
export function bindRepoGrant(dispatchKey: string, childSessionId: string): RepoGrant | null;
export function confirmRepoGrant(grantId: string, confirmerSessionId: string): RepoGrant | null;
export function hasRepoGrant(
  childSessionId: string,
  privilege: RepoPrivilege,
  toolName: string,
  paths?: string[],
  remotes?: string[],
): RepoGrant | null;
export function consumeRepoGrant(grantId: string): void;
export function revokeRepoGrant(grantId: string, reason?: string): void;
```

Rules：

1. `repo_maintenance` TTL 默认 30 分钟。
2. `remote_repo_write` TTL 默认 10 分钟，必须 `requires_human_confirmation=1`。
3. `repo_destructive_emergency` TTL 默认 5 分钟，必须 `requires_human_confirmation=1`。
4. `hasRepoGrant()` 必须校验 child session、privilege、toolName、paths、remotes、status、expires_at、human confirmation。
5. `repo_maintenance` 在 `safe_repo_commit` 成功后消费，不在 stage 后消费。
6. remote write 成功后消费。
7. path 统一使用 repo root 相对路径，禁止 absolute path 直接比较。

### 3.4 Path allowlist

必须实现：

```ts
export function toRepoRelativePath(inputPath: string, root?: string): string;
export function isPathAllowedByPatterns(path: string, patterns: string[]): boolean;
export function assertNoRuntimeStatePaths(paths: string[]): void;
```

默认禁止 stage/commit：

```text
.opencode/state.db
.opencode/state/*.db
.opencode/state/*.db-wal
.opencode/state/*.db-shm
.opencode/_test_framework/**
.task_temp/**
node_modules/**
```

---

## 4. Phase P3 — Git Service

### 4.1 新建文件

```text
.opencode/service/repo/git.ts
```

### 4.2 导出函数

```ts
export interface GitExecResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  argv: string[];
}

export function execGit(argv: string[], timeoutMs?: number): GitExecResult;
export function repoStatus(porcelain?: boolean): GitExecResult;
export function repoDiff(input: { paths?: string[]; cached?: boolean; stat?: boolean }): GitExecResult;
export function repoLog(input: { maxCount?: number; paths?: string[] }): GitExecResult;
export function repoShow(input: { ref: string; paths?: string[] }): GitExecResult;
export function repoBranch(input: { mode: "current" | "list" }): GitExecResult;
export function repoStage(paths: string[]): GitExecResult;
export function repoUnstage(paths: string[]): GitExecResult;
export function getStagedFiles(): string[];
export function assertStagedFilesAllowed(expectedPaths: string[]): void;
export function repoCommit(message: string): GitExecResult & { commitSha?: string };
```

Implementation constraints：

1. `execGit()` must call `execFileSync("git", argv, ...)`.
2. Use `--` before paths.
3. `repoStage()` must reject empty path list.
4. `repoStage()` must reject `"."`, `"*"`, `":/"`, path with `..`, absolute paths outside repo root.
5. `repoCommit()` must not include `--no-verify`.
6. `repoCommit()` must call `git rev-parse HEAD` after success to obtain commit sha.
7. `assertStagedFilesAllowed()` must compare staged files from `git diff --cached --name-only` with expectedPaths.

---

## 5. Phase P4 — Tool Implementations

All tools must follow the current tool pattern:

```ts
import { tool } from "@opencode-ai/plugin";
import { withInterruptGuard } from "../lib";
```

All tools return JSON string:

```ts
interface RepoToolResponse {
  ok: boolean;
  tool: string;
  operationKind: string;
  provider: "git" | "gh" | "github_mcp";
  grantId?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  paths?: string[];
  commitSha?: string;
  dryRun?: boolean;
  blockedReason?: string;
}
```

### 5.1 Read tools

Create:

```text
.opencode/tools/safe_repo_status.ts
.opencode/tools/safe_repo_diff.ts
.opencode/tools/safe_repo_log.ts
.opencode/tools/safe_repo_show.ts
.opencode/tools/safe_repo_branch.ts
```

Read tool behavior:

1. No grant required.
2. Call classifier and assert `kind=read`.
3. Call git service function.
4. Write `REPO-READ-ALLOWED` audit.
5. Return JSON response.

### 5.2 Local write tools

Create:

```text
.opencode/tools/safe_repo_stage.ts
.opencode/tools/safe_repo_unstage.ts
.opencode/tools/safe_repo_commit.ts
```

`safe_repo_stage` args:

```ts
paths: string[]
reason?: string
dryRun?: boolean
```

Flow:

1. Normalize paths to repo-relative.
2. Reject runtime state/test scaffold paths.
3. Check `hasRepoGrant(sessionID, "repo_maintenance", "safe_repo_stage", paths)`.
4. If dryRun, return allowed without executing.
5. Execute `repoStage(paths)`.
6. Write `REPO-WRITE-STAGED`.

`safe_repo_commit` args:

```ts
message: string
expectedPaths: string[]
reason?: string
dryRun?: boolean
```

Flow:

1. Reject missing/empty message.
2. Reject `--no-verify`, `[BYPASS`, `core.hooksPath`, `core.skipHooks` in message.
3. Normalize expectedPaths.
4. Check grant for `safe_repo_commit`.
5. Read staged files.
6. Assert staged files are non-empty.
7. Assert staged files are subset of expectedPaths.
8. Assert no runtime state/test scaffold paths.
9. If dryRun, return staged files and grant id.
10. Execute `git commit -m message`.
11. On success, consume grant and return commit sha.
12. On hook failure, do not consume grant; return stderr and exitCode.

### 5.3 Remote write tools

P1/P2 implementation only after local write E2E passes.

Create only after approval:

```text
.opencode/tools/safe_repo_push.ts
.opencode/tools/safe_gh_pr_create.ts
.opencode/tools/safe_gh_pr_comment.ts
.opencode/tools/safe_gh_issue_comment.ts
```

Remote write flow:

1. Classify as remote_write.
2. Check `remote_repo_write` grant.
3. Check `human_confirmed_at`.
4. Verify remote/repo/branch allowlist.
5. Default to dryRun/mock if available.
6. Consume grant only after actual successful remote write.

Do not implement generic `safe_gh_api`.

---

## 6. Phase P5 — Hook Integration

### 6.1 `codegraph.ts`

Modify:

```text
.opencode/plugin-handlers/before/codegraph.ts
```

Required behavior:

1. If tool is `safe_shell` or `bash`, classify command.
2. If provider is git/gh and kind is read, return without CodeGraph block.
3. If provider is git/gh and kind is local_write/remote_write/destructive/hook_bypass/unknown, throw explicit error:

```text
[FW-ENFORCE][REPO-OP] Direct git/gh writes through safe_shell are blocked.
Use safe_repo_* first-class tools. Operation=<kind>.
```

4. Remove `@Super-Admin` from CodeGraph error message. Replace with current truth:

```text
Exemptions: configured path exemptions only. Repo writes require safe_repo_* grant.
```

### 6.2 `shell-guard.ts`

Modify:

```text
.opencode/service/file-guard/shell-guard.ts
```

Insert classifier check before allowlist execution:

```ts
const repoOp = classifyRepoShellCommand(command);
if (repoOp.provider === "git" || repoOp.provider === "gh") {
  if (repoOp.kind === "read") {
    // allow only if opencode.json already allows the command
  } else {
    return blocked("REPO_WRITE_VIA_SAFE_SHELL_BLOCKED", ...);
  }
}
```

Do not let `breakGlass` bypass repo write classification.

### 6.3 `tool-scope-match.ts`

Modify:

```text
.opencode/service/dispatch/tool-scope-match.ts
```

Requirement:

1. Reuse `classifyRepoShellCommand()` for git/gh.
2. Treat read repo ops as read_only.
3. Treat local_write/remote_write/destructive/hook_bypass/unknown as unparseable_write or write according to returned paths.
4. Do not duplicate large git/gh regex tables in this file.

### 6.4 `git-guard.ts`

Keep only as temporary hook-bypass defense or mark legacy. If kept:

1. It must call repo classifier.
2. It must not mention `Super-Admin` as bypass.
3. It must never allow hook bypass.

---

## 7. Phase P6 — Dispatch And Session Binding

### 7.1 Router

Modify:

```text
.opencode/service/dispatch/router.ts
```

Rules:

1. Only Orchestrator may request repo privileges.
2. Accepted values:

```text
repo_maintenance
remote_repo_write
repo_destructive_emergency
```

3. If privilege is repo write, dispatch key must be generated.
4. `allowed_paths` required for `repo_maintenance`.
5. `allowed_remotes` required for `remote_repo_write`.
6. `privilege_reason` required.
7. The router must create the repo grant at dispatch time or pass env to script so grant is created in the same lifecycle as existing dispatch grants.

### 7.2 `dispatch-subagent.ts`

Modify:

```text
.opencode/scripts/command-tools/dispatch-subagent.ts
```

Requirement:

1. Preserve existing `DISPATCH_KEY`.
2. Preserve `DISPATCH_PRIVILEGE`.
3. Add support for `DISPATCH_ALLOWED_REMOTES`.
4. Ensure queue record carries dispatch key and parent session id.
5. Do not overwrite canonical dag task id with task description.

### 7.3 Session binding

Modify:

```text
.opencode/plugins/session.ts
```

Requirement:

1. When child session/chat message consumes dispatch key, bind repo grant by same dispatch key.
2. Log:

```text
REPO-GRANT-BIND-QUERY
REPO-GRANT-BOUND
REPO-GRANT-BIND-NO-MATCH
```

3. Binding must not use latest-dispatch fallback.

---

## 8. Phase P7 — Permissions And Tool Summaries

### 8.1 `opencode.json`

Apply exact permission direction:

| Agent | Add allow |
|---|---|
| Orchestrator | `safe_repo_status`, `safe_repo_diff`, `safe_repo_log`, `safe_repo_show`, `safe_repo_branch` |
| build | all read tools, `safe_repo_stage`, `safe_repo_unstage`, `safe_repo_commit`; remote tools only after P3 |
| general | read tools only |
| explore | read tools only |
| plan | `safe_repo_status`, `safe_repo_diff` optional; no writes |
| scout future | read tools only if scout is registered |

Do not add:

```text
safe_repo_stage/safe_repo_commit to Orchestrator
safe_repo_stage/safe_repo_commit to explore
safe_repo_push/safe_gh_* to any agent before remote-write phase
gh * to safe_shell
git add/commit/push to safe_shell
```

### 8.2 Tool summaries

Modify:

```text
.opencode/service/context/tool-summaries.ts
```

Add concise summaries for each `safe_repo_*` and `safe_gh_*`.

### 8.3 MCP GitHub writes

If GitHub MCP write tools are visible, add one of:

1. A before-hook repo policy check for `github_*` write tools.
2. A tool-definition/hiding policy so write tools are not visible unless remote grant is active.

Do not rely on `mcp-role-filter.ts` unless it is actually wired into active `tool.definition` or before-hook path.

---

## 9. Phase P8 — Tests

### 9.1 Unit tests

Minimum files:

```text
.opencode/service/repo/__tests__/classify.test.ts
.opencode/service/repo/__tests__/grants.test.ts
.opencode/service/repo/__tests__/git.test.ts
```

### 9.2 Integration tests

Suggested qoderwork scripts:

```text
qoderwork/scripts/integ-repo-classifier.ts
qoderwork/scripts/integ-repo-grant-lifecycle.ts
qoderwork/scripts/integ-safe-repo-tools.ts
```

Integration checks:

1. Grant create/bind/has/consume.
2. Path allowlist exact match and `/**` match.
3. Runtime state path rejection.
4. Hook bypass rejection.
5. Staged files vs expectedPaths mismatch rejection.

### 9.3 E2E scripts

Suggested qoderwork scripts:

```text
qoderwork/scripts/e2e-repo-read-tools.ts
qoderwork/scripts/e2e-repo-local-commit-grant.ts
qoderwork/scripts/e2e-repo-remote-write-block.ts
qoderwork/scripts/e2e-repo-scout-readonly.ts
```

Each script must save a log under:

```text
qoderwork/logs/YYYY-MM-DD-git-write-grant-<case>.md
```

---

## 10. Implementation Order For Weak Model

Do exactly this order:

1. P0 baseline commands and handoff.
2. P1 classifier + classifier unit tests.
3. P2 grants + DB migration + grant tests.
4. P3 git service + git service tests.
5. P4 read tools only + runtime smoke for read tools.
6. P5 hook integration for read vs write git/gh through safe_shell.
7. P4 local write tools + no-grant negative tests.
8. P6 dispatch/session binding for `repo_maintenance`.
9. G4 live local commit grant E2E.
10. P7 permissions + tool summaries.
11. Remote write tools only after local write E2E passes and user confirms.
12. Scout/Explore read-only E2E.

Do not start remote write implementation before step 9 passes.

---

## 11. Error Codes

Use these exact blocked reasons where applicable:

| Code | Meaning |
|---|---|
| `REPO_UNKNOWN_COMMAND` | classifier cannot safely classify command |
| `REPO_MULTI_COMMAND_BLOCKED` | command includes shell chaining/redirection |
| `REPO_WRITE_VIA_SAFE_SHELL_BLOCKED` | git/gh write attempted through safe_shell |
| `REPO_HOOK_BYPASS_BLOCKED` | hook bypass attempted |
| `REPO_DESTRUCTIVE_BLOCKED` | destructive repo operation attempted |
| `REPO_GRANT_MISSING` | required grant missing |
| `REPO_GRANT_PATH_MISMATCH` | path not covered by grant |
| `REPO_GRANT_REMOTE_MISMATCH` | remote/repo not covered by grant |
| `REPO_HUMAN_CONFIRMATION_REQUIRED` | remote/destructive write lacks confirmation |
| `REPO_RUNTIME_PATH_BLOCKED` | runtime/test path attempted in stage/commit |
| `REPO_STAGED_FILES_MISMATCH` | staged files do not match expectedPaths |
| `REPO_COMMIT_HOOK_FAILED` | git commit hook failed |
| `REPO_AGENT_NOT_ALLOWED` | agent lacks tool permission |

---

## 12. Code Review Checklist

QoderWork reviewer will reject implementation if any item is true:

- [ ] Uses `execSync("git ...")` or `execSync("gh ...")` with string command.
- [ ] Adds `git add/commit/push` or `gh *` to `safe_shell` allowlist.
- [ ] Lets `breakGlass` bypass repo write policy.
- [ ] Mentions `Super-Admin` as repo write bypass in active error messages.
- [ ] Allows remote write without human confirmation.
- [ ] Allows Scout/Explore to stage/commit/push/comment.
- [ ] Consumes grant before commit success.
- [ ] Consumes grant on hook failure.
- [ ] Compares absolute paths directly to grant allowlist without normalization.
- [ ] Allows `.opencode/state*.db`, `.task_temp/**`, or test scaffold files into commit.
- [ ] Calls DB/component tests "full E2E".

---

## 13. Expected Final Handoff

Final handoff must include:

```text
Implementation status:
- P0:
- P1:
- P2:
- P3:
- P4:
- P5:
- P6:
- P7:
- P8:

Tests:
- unit:
- integration:
- runtime smoke:
- live LLM E2E:

Evidence:
- session ids:
- grant ids:
- commit sha:
- log files:
- DB query output:

Known limitations:
- remote write:
- scout:
- legacy cleanup:
```

Completion cannot be claimed unless `plans/git-write-grant/e2e-acceptance.md` G0-G6 and at least three G9 live LLM E2E scenarios pass.

### 13.1 Audited Handoff（2026-07-08）

```text
Implementation status:
- P0: PASS
- P1: PASS
- P2: PASS
- P3: PASS
- P4: PASS
- P5: PASS
- P6: PASS
- P7: PASS
- P8: PASS for local repo-write main path; PARTIAL for remote positive live path

Tests:
- unit: 114/114 PASS
- integration: G4 grant lifecycle PASS, G7 remote grant service-level dry-run PASS
- runtime smoke: repo read/default-block audit logs exported
- live LLM E2E: G9-001/G9-002/G9-003 PASS

Evidence:
- evidence bundle: qoderwork/e2e-evidence/
- commit sha: e02a561a for G9-003 live local commit
- implementation commits: bc2493c4, 8f5c1527, 62e804b6

Known limitations:
- remote write: default block live PASS; positive live agent execution deferred
- scout: explore/general PASS; scout not registered
- GitHub MCP: active `codegraph` hook now blocks direct `github_*` writes; serve API runtime smoke completed, with restart-before-verify caveat documented
- config drift: work-one opencode.json has uncommitted explore model change
```
