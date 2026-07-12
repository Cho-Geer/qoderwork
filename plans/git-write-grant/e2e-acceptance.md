# Git/GH 写操作 Grant E2E 验收标准

**版本**: v1.1.0
**日期**: 2026-07-08
**状态**: 已执行；本地 repo-write 主链路通过，remote/GitHub MCP 边界仍有补测项
**目标项目**: `/home/zhaoge/workspace/opencode/work-one`

---

## 0. 2026-07-08 E2E 审核结果

证据包：`qoderwork/e2e-evidence/`。代码提交：`bc2493c4`、`8f5c1527`、`62e804b6`；G9-003 live child commit：`e02a561a`。

| 组 | 状态 | 证据级别 | 说明 |
|---|---|---|---|
| G0 Classifier | PASS | Component | 114/114 unit PASS，覆盖 git/gh/GitHub MCP 分类 |
| G1 Read Tools | PASS | Runtime + live | `REPO-READ-ALLOWED` 覆盖 Orchestrator/build/general/explore |
| G2 Naked shell guard | PASS | Static + runtime | `safe_shell`/CodeGraph 对 git/gh 写 fail closed，错误指向一等工具 |
| G3 No-grant block | PASS | Runtime + live | G9-002、G8 general 均证明无 grant 写被阻断 |
| G4 Local commit grant lifecycle | PASS | Live LLM E2E | build child stage + commit `e02a561a`，grant consumed |
| G5 Scope negative cases | PARTIAL PASS | Component + audit | wrong session/path/runtime path/consumed grant 已覆盖；expired grant 未单独见证 |
| G6 Remote write default block | PASS | Live negative + unit | `safe_repo_push` 和 `safe_gh_pr_create` 无 grant live blocked；direct GitHub MCP 写已完成 serve API runtime smoke，重启后 live blocked |
| G7 Remote write with human confirmation | PARTIAL PASS | Component/script | `scripts/e2e-g7-remote-write-positive.ts` 9/9 PASS；没有 live agent remote write success |
| G8 Scout/Explore compatibility | PASS/N/A | Live LLM | Explore/general PASS；`scout` 未注册，N/A |
| G9 Live LLM E2E | PASS | Live LLM | G9-001、G9-002、G9-003 三条主链路 PASS |

当前可宣称：本地提交任务从 Orchestrator dispatch 到 build child 的 `repo_maintenance` grant 闭环已通过 live E2E，direct GitHub MCP 写路径已通过 serve API live smoke 验证为“重启后 blocked”。当前不可宣称：remote write 已通过 live agent 成功路径完整验收。

## 1. 验收原则

本 E2E 只在实施后执行。通过标准必须区分证据级别：

| 级别 | 可声明 |
|---|---|
| Static | 代码路径存在，配置存在 |
| Component | 单函数/脚本通过 |
| Runtime smoke | serve API session 中工具行为通过 |
| Live LLM E2E | Orchestrator 派发 child agent，弱模型真实调用工具完成或被拒 |

最终完成标准必须达到 Live LLM E2E，不能只靠 DB/component 测试宣称完成。

---

## 2. E2E 前置条件

| 检查项 | 标准 |
|---|---|
| Serve | `http://127.0.0.1:4096/global/health` 可用 |
| Bun cache | 修改 TypeScript 后已清理并重启 serve |
| CodeGraph | `codegraph status` up to date |
| Git working tree | 用测试分支或可回滚 worktree，不污染用户主变更 |
| Test fixture | 使用 `src/_e2e_test_fixture/` 下的可提交临时 fixture；不得使用 `.task_temp/` 作为 commit fixture |
| Remote write | 默认使用 dry-run/mock；真实 push/gh 写必须显式人工确认 |

建议测试路径：

```text
src/_e2e_test_fixture/
  fixture.txt
  expected-commit-message.txt
```

不得把以下路径加入 commit：

```text
.opencode/state.db
.opencode/state/*.db
.opencode/state/*.db-wal
.opencode/state/*.db-shm
.opencode/_test_framework/**
.task_temp/**
```

---

## 3. E2E 矩阵

### G0: Classifier Component

| ID | 场景 | 输入 | 期望 |
|---|---|---|---|
| G0-001 | git read | `git status --short` | kind=`read` |
| G0-002 | git local write | `git add file && git commit -m x` | kind=`local_write` 或 multi-op 拒绝 |
| G0-003 | hook bypass | `git commit --no-verify -m x` | kind=`hook_bypass`, blocked |
| G0-004 | destructive | `git reset --hard HEAD` | kind=`destructive`, blocked |
| G0-005 | gh read | `gh pr view 1` | kind=`read` |
| G0-006 | gh write | `gh pr comment 1 -b x` | kind=`remote_write` |
| G0-007 | gh api write | `gh api -X PATCH repos/a/b/issues/1` | kind=`remote_write` |
| G0-008 | unknown shell | `git whatever --maybe` | kind=`unknown`, blocked |
| G0-009 | GitHub MCP read | `github_get_pull_request` | kind=`read` |
| G0-010 | GitHub MCP write | `github_create_or_update_file` | kind=`remote_write` |

Pass 条件：

- [ ] 所有 unknown 写风险 fail closed。
- [ ] `gh api -X POST|PUT|PATCH|DELETE` 全部识别为 remote write。
- [ ] 分类器输出 provider、subcommand、kind、requiresGrant、requiresHumanConfirmation。

### G1: Repo Read Tools Runtime Smoke

| ID | Agent | Tool | 期望 |
|---|---|---|---|
| G1-001 | Orchestrator | `safe_repo_status` | 返回 status，不触发 CodeGraph block |
| G1-002 | build | `safe_repo_diff` | 返回 diff/stat，不触发 CodeGraph block |
| G1-003 | general | `safe_repo_log` | 返回最近 commit，不触发 CodeGraph block |
| G1-004 | explore | `safe_repo_status` | 返回 status，不需要 grant |
| G1-005 | future scout | `safe_repo_diff` | 如果 `scout` 已注册，应返回 diff；未注册则记录为 N/A |

Pass 条件：

- [ ] `.task_temp/_logs/*/plugin-repo-operation-runtime.log` 有 `REPO-READ-ALLOWED`。
- [ ] `codegraph` 日志没有对 repo read 抛 `[CODEGRAPH-ENFORCE]`。
- [ ] repo read tools 不修改 Git index、working tree 或 remote。

### G2: Naked `safe_shell git/gh` Guard

| ID | 命令 | 期望 |
|---|---|---|
| G2-001 | `safe_shell: git status --short` | 允许或提示迁移到 `safe_repo_status`，但不得被 CodeGraph 误判 |
| G2-002 | `safe_shell: git add <file>` | 阻断，提示使用 `safe_repo_stage` |
| G2-003 | `safe_shell: git commit -m x` | 阻断，提示使用 `safe_repo_commit` |
| G2-004 | `safe_shell: git push origin branch` | 阻断，提示需要 `remote_repo_write` |
| G2-005 | `safe_shell: gh pr comment 1 -b x` | 阻断，提示需要 `safe_gh_pr_comment` + remote grant |
| G2-006 | `safe_shell: gh api -X PATCH ...` | 阻断 |
| G2-007 | `safe_shell: git commit --no-verify -m x` | 永久阻断，不能被 grant 绕过 |

Pass 条件：

- [ ] 写类裸 `git/gh` 不再通过 `safe_shell` 执行。
- [ ] 错误消息指向一等工具，不再建议 `Super-Admin`。

### G3: No Grant Local Write Block

| ID | Agent | Tool | 期望 |
|---|---|---|---|
| G3-001 | build | `safe_repo_stage(paths=[fixture])` | blocked: no `repo_maintenance` grant |
| G3-002 | build | `safe_repo_commit(message, expectedPaths)` | blocked: no `repo_maintenance` grant |
| G3-003 | explore | `safe_repo_stage` | permission denied |
| G3-004 | Orchestrator | `safe_repo_commit` | permission denied |

Pass 条件：

- [ ] 无 grant 时没有 staged file 变化。
- [ ] DB audit 有 `REPO-WRITE-GRANT-MISSING`。

### G4: Grant Lifecycle Local Commit

流程：

1. Orchestrator 创建 session。
2. Orchestrator 以 `dispatch_privilege=repo_maintenance` 派发 build child。
3. Grant 写入 DB，状态 `pending`。
4. Child session 创建后绑定 grant，状态 `bound`。
5. Child 修改测试 fixture。
6. Child 调用 `safe_repo_stage(paths=[fixture])`。
7. Child 调用 `safe_repo_commit(message, expectedPaths=[fixture])`。
8. Commit 成功，grant 状态 `consumed`。

验收项：

- [ ] `repo_operation_grants.status`: `pending -> bound -> consumed`。
- [ ] `child_session_id` 精确等于 build child session。
- [ ] commit sha 非空。
- [ ] staged files 与 expectedPaths 一致。
- [ ] pre-commit hook 被执行，没有 `--no-verify`。
- [ ] `.task_temp/_logs` 有 `REPO-WRITE-STAGED` 和 `REPO-COMMIT-SUCCESS`。
- [ ] Orchestrator final answer 不得只返回 `privilege-dispatched`，必须包含 commit sha 和 evidence。

### G5: Grant Scope Negative Cases

| ID | 场景 | 期望 |
|---|---|---|
| G5-001 | grant allowed_paths 不含目标文件 | stage blocked |
| G5-002 | expectedPaths 含 `.opencode/state.db` | commit blocked |
| G5-003 | index 中混入未授权文件 | commit blocked |
| G5-004 | grant expired | stage/commit blocked |
| G5-005 | grant bound to session A，session B 使用 | blocked |
| G5-006 | grant consumed 后二次 commit | blocked |
| G5-007 | path 使用 `../` 逃逸 | blocked |

Pass 条件：

- [ ] 所有失败都 fail closed。
- [ ] 失败不消费未使用 grant，除非策略明确为 fatal revoke。
- [ ] DB audit 记录具体拒绝原因。

### G6: Remote Write Default Block

| ID | 操作 | 期望 |
|---|---|---|
| G6-001 | `safe_repo_push` 无 grant | blocked |
| G6-002 | `safe_gh_pr_create` 无 grant | blocked |
| G6-003 | GitHub MCP `github_create_issue` 无 grant | blocked or hidden |
| G6-004 | GitHub MCP `github_create_or_update_file` 无 grant | blocked or hidden |
| G6-005 | `gh api -X POST` 裸 shell | blocked |

Pass 条件：

- [ ] 无 remote grant 时没有 push、PR、issue、release、workflow、file update。
- [ ] remote write 拒绝消息要求 human confirmation。

### G7: Remote Write With Human Confirmation

默认使用 mock/dry-run。真实远端写只有用户显式授权后执行。

流程：

1. Orchestrator 请求 remote write，创建 `remote_repo_write` grant。
2. 系统通过 question 或 QoderWork 确认 human approval。
3. grant 写入 `human_confirmed_at`。
4. 执行 `safe_repo_push --dryRun` 或 mock `safe_gh_pr_create`。
5. 成功后 grant consumed。

验收项：

- [ ] 没有 human confirmation 时 blocked。
- [ ] confirmation 过期后 blocked。
- [ ] remote/branch/repo 不匹配 grant 时 blocked。
- [ ] 成功路径产生 preview/dry-run evidence。
- [ ] 如执行真实 remote write，必须记录 URL/remote/ref。

### G8: Scout/Explore Compatibility

| ID | Agent | 操作 | 期望 |
|---|---|---|---|
| G8-001 | explore | `safe_repo_status` | allowed |
| G8-002 | explore | `safe_repo_diff` | allowed |
| G8-003 | explore | `safe_repo_commit` | permission denied |
| G8-004 | explore | `safe_gh_pr_comment` | permission denied |
| G8-005 | scout future | repo read tools | allowed if registered |
| G8-006 | scout future | repo write tools | denied |

Pass 条件：

- [ ] Explore/Scout 能完成只读 evidence bundle。
- [ ] Explore/Scout 无法改变 working tree、index、commit history 或 remote state。

### G9: Live LLM E2E

必须至少完成 3 条真实 Orchestrator 派发链路：

| ID | 场景 | 期望 |
|---|---|---|
| G9-001 | Orchestrator -> explore repo investigation | child 使用 repo read tools 输出 evidence，无写入 |
| G9-002 | Orchestrator -> build no grant commit attempt | child 被拒并通过 result gate 汇报失败 |
| G9-003 | Orchestrator -> build with `repo_maintenance` | child stage + commit 成功，返回 commit sha |
| G9-004 | Orchestrator -> build remote write without confirmation | blocked，Orchestrator 汇报需要 human confirmation |

Pass 条件：

- [ ] 每条都有 parent session id、child session id、dispatch key、grant id 或拒绝原因。
- [ ] Orchestrator result gate 正确传播 child 成功/失败。
- [ ] SSE/DB/log 三方证据一致。

---

## 4. 最终验收定义

本方案可标记为完成，必须同时满足：

- [ ] PARTIAL: G0-G6 主链路 PASS；G5 expired grant 已由 cleanup 覆盖，direct GitHub MCP 写 runtime smoke 已完成，但仍缺 remote positive live E2E。
- [x] G8 PASS 或明确记录 scout 未注册时的 N/A，且 explore PASS。
- [x] G9 至少 3 条 Live LLM E2E PASS。
- [x] 所有已执行 repo write 都有 DB audit 和集中日志。
- [x] 无任何测试通过 `Super-Admin` exemption 获得 repo 写权限。
- [x] 无任何测试通过裸 `safe_shell git/gh` 完成写操作。
- [x] 无远端写在缺少 human confirmation 时发生。

---

## 5. 测试产物要求

每次 E2E 后保存：

```text
qoderwork/logs/YYYY-MM-DD-git-write-grant-e2e.md
/tmp/sse-git-write-grant-*.jsonl
work-one/.task_temp/_logs/YYYY-MM-DD/plugin-repo-operation-runtime.log
work-one/.opencode/state/framework-state.db
```

日志必须包含：

- session ids。
- child session ids。
- dispatch keys。
- grant ids。
- commit sha。
- blocked reason。
- staged files list。
- remote dry-run/confirmation evidence。
