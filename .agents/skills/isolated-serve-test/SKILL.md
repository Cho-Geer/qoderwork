---
name: isolated-serve-test
description: "Orchestrate isolated serve test run units / 隔离 serve 测试运行单元编排 skill。负责创建/启动/bootstrap/执行/停止/清理 `test-serve` run，并输出 manifest 与 artifact 证据。Trigger: isolated serve, test-serve, run manifest, PT-WM-00R2, live runner, bootstrap grant, run-dir. Not for: 通用 serve API 调试、直接启动 `opencode serve`、手写 grant/DB、跳过 oracle 的结果裁决."
version: 1.0.0
---

# Isolated Serve Test

## Language / 语言

Follow the user's language: reply in Chinese for Chinese requests and English for English requests. Provide both only when requested; preserve code, commands, paths, API names, identifiers, and quoted source text exactly.

详细字段、manifest schema 和目录规则见 [reference.md](./reference.md)。

> **角色定位**: `isolated-serve-test` 是 `[VERIFICATION]` 技能。
> 它只负责编排隔离测试运行单元，不负责替代 `serve-api` 做通用交互，也不负责替代 `test-specification-execution` 做 oracle 裁决。
>
> **唯一职责**: 创建/管理 `test-serve` run，调用 bootstrap，执行 runner，收集 manifest/run 证据。
> **禁止事项**: 自授 H2、跳过 oracle、把未执行的 plan-only 证据写成 PASS、直接启动裸 `opencode serve`。

## 1. 职责边界

| Skill | 唯一职责 | 禁止事项 |
|---|---|---|
| `serve-api` | 通用 serve API 与 SSE 交互验证 | 创建/删除测试 worktree，判定测试通过 |
| `test-specification-execution` | 读取规格、执行 oracle、测试状态裁决 | 管理 serve 进程或隔离资源 |
| `isolated-serve-test` | 创建/管理 run、调用 bootstrap、输出 manifest 和运行证据 | 自授 H2、跳过 oracle、把运行时证据标 PASS |

`isolated-serve-test` 只允许调用 `test-serve` CLI。禁止在 skill 文本或执行步骤中出现以下路径：

- 直接运行 `opencode serve`
- 裸 `curl localhost:4097`
- 固定 `/tmp/...` SSE/manifest/PID 路径
- shell 后台操作如 `nohup`、`setsid`、`&`
- 直接 SQL 写 grant/session 状态

## 2. 固定流程

1. `admit`
   记录 `test_id`、目标 `commit`、执行模式（`plan` / `live`）、是否已有 reviewer 授权、runner 名称、oracle 来源。
   若缺 `test_id`、`commit`、runner、oracle，立即标记 `BLOCKED` 或 `INVALID`，不得继续。
2. `create`
   运行 `test-serve create --commit <sha> --port <port> --test-id <id>`。
   若用户明确要求测试主 tree 未提交改动，必须由 reviewer 先提供 `snapshot-source` 生成的 overlay，并额外传 `--source-overlay <overlay-dir>`；弱模型不得自行复制 dirty tree。
3. `start`
   运行 `test-serve start --run-dir <run-dir>`，只接受 create 产出的 run 目录。
4. `bootstrap`
   运行 `test-serve bootstrap --run-dir <run-dir> --root-agent <agent> --child-agent <agent> --allowed-paths <abs-path>`。
   必须要求 `allowed-paths` 非空、绝对路径、且位于 run worktree 允许范围内。
5. `execute`
   运行 `test-serve execute --run-dir <run-dir> --mode <plan|live> --runner <script> -- --run-dir <run-dir>`。
   所有 runner 只能从 manifest 读取 endpoint、DB、session、grant、SSE/event 路径。
6. `collect`
   保存 manifest 路径、artifact 路径、日志路径、event 路径，并逐步输出 `Verified-by:` 证据行。
7. `stop`
   运行 `test-serve stop --run-dir <run-dir>`，停止 run 绑定的进程。
8. `cleanup`
   运行 `test-serve cleanup --run-dir <run-dir>`。
   默认只清理 run worktree 与受控进程；run evidence bundle 应保留用于审计，除非当前 CLI 明确声明会同步保留 artifact。

## 3. 命令模板

```bash
test-serve create --commit <sha> --port <port> --test-id <id>
test-serve create --commit <sha> --port <port> --test-id <id> --source-overlay <overlay-dir>
test-serve start --run-dir <run-dir>
test-serve bootstrap --run-dir <run-dir> --root-agent <agent> --child-agent <agent> --allowed-paths <abs-path>
test-serve execute --run-dir <run-dir> --mode plan --runner <script> -- --run-dir <run-dir>
test-serve execute --run-dir <run-dir> --mode live --runner <script> -- --run-dir <run-dir>
test-serve stop --run-dir <run-dir>
test-serve cleanup --run-dir <run-dir>
```

## 4. Live Gate

`test-serve execute --mode live` 只有在以下条件全部满足时才允许真实发 prompt：

> **合理化检测**：如果你发现自己在想「manifest 看起来已经 READY，所以可以直接真跑」--停下来，这是跳步信号。必须逐项确认 H2、DRY_RUN、bootstrap 和 oracle。

- `H2_AUTHORIZED=true`
- `DRY_RUN=false`
- manifest 状态为 `READY`
- `bootstrapComplete === true`
- root/child session 与 grant oracle 已满足

缺任一条件时：

- 只允许输出 plan-only evidence
- 结果必须标记为 `NOT-RUN`
- 不得发送 live prompt
- 不得把 plan-only artifact 写成 PASS

`create`、`start`、`status`、`stop`、`cleanup` 不读取 `H2_AUTHORIZED`。

## 5. 失败分流

- `BLOCKED`: 前置缺失、commit 不存在、port 冲突、overlay 缺三件套、导入生产 bootstrap service 失败、cleanup 无法安全执行
- `INVALID`: 规格缺 oracle、runner 参数不完整、`allowed-paths` 为空或非绝对路径
- `FAIL`: bootstrap oracle 不满足、grant 未绑定、child session 不属于 root、执行结果与 oracle 不匹配
- `NOT-RUN`: `H2_AUTHORIZED` 或 `DRY_RUN` gate 不满足，或 manifest 未到 live 可执行状态

不要把 `BLOCKED`、`INVALID`、`NOT-RUN` 混写成 `FAIL`。它们的含义不同：

- `BLOCKED` 是环境或前置未满足
- `INVALID` 是规格或输入本身不合格
- `NOT-RUN` 是明确未执行 live
- `FAIL` 是已执行到可判定阶段但 oracle 不通过

## 6. 硬约束

- 只允许通过 `test-serve` CLI 管理 run；不得直接拼装 serve/SSE 生命周期
- 不允许使用固定端口；端口必须来自 create 阶段显式参数
- 不允许读取或写入固定临时 SSE 文件、固定 PID 文件、固定 DB 路径
- 不允许自行设置 `H2_AUTHORIZED=true`
- 不允许直接写 framework DB 或 SDK DB 改 grant/session 状态；直接 SQL 只可作只读 oracle
- 不允许把主 worktree 目录整体复制到测试目录
- 不允许把 ignored 或敏感文件加入 overlay

## 7. 证据纪律

每一步都必须输出：

- manifest 路径
- run ID
- `Verified-by: <command or artifact>`

建议最少证据集：

- `create`: `Verified-by: manifest.json created at <path>`
- `start`: `Verified-by: serve pid/log path recorded in manifest`
- `bootstrap`: `Verified-by: manifest.childSessionId=<id>, grantId=<id>, oracle=bound`
- `execute(plan)`: `Verified-by: plan-only evidence written, live prompt not sent`
- `execute(live)`: `Verified-by: runner artifact <path> + oracle result`
- `stop`: `Verified-by: run process stopped for <run-id>`
- `cleanup`: `Verified-by: worktree removed, evidence bundle retained`

如果写不出 `Verified-by:`，该步骤视为未实际完成。

## 8. P0-1B runtime smoke 专用流程

P0-1B 用于验证 `create → start → bootstrap → execute(plan) → verify-runtime → stop → cleanup → verify-cleanup` 全生命周期。弱模型**只能**使用单一 `p0-1b` 子命令执行，禁止分步调用 `create`/`start`/`bootstrap` 等手动拼接生命周期。

**唯一命令**：

```bash
COMMIT=$(git -C /home/zhaoge/workspace/opencode/work-one rev-parse HEAD)
: "${P0_1B_PORT:?reviewer must provide P0_1B_PORT}"

/home/zhaoge/.bun/bin/bun run scripts/test-serve/isolated-serve.ts p0-1b \
  --primary-worktree /home/zhaoge/workspace/opencode/work-one \
  --commit "$COMMIT" --port "$P0_1B_PORT" --test-id P0-1B-RUNTIME-SMOKE
```

**PASS 唯一标准**（必须同时满足）：
- 命令 exit 0
- 最终 JSON `ok:true`
- 最终 JSON `status:"PASS"`
- `checks.runtime` 全部 true
- `checks.cleanup` 全部 true

**禁止**：
- 失败时修改 manifest 或手写 `READY`
- 同 run ID 重试 `p0-1b`
- 用 `curl`/SQL/直接读日志推断 PASS
- 缺少 `P0_1B_PORT` 时自行扫描、猜测或复用历史端口

失败时只记录结构化 `firstFailure` 与 `evidencePaths`，等待 reviewer 提供新端口后创建全新 run。
