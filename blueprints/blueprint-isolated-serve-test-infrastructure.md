# Blueprint: 隔离 Serve 测试基建与测试专用 Skill

**版本**: v1.3.1
**日期**: 2026-07-17
**状态**: 部分实施（P0-1A cleanup 集成已实现并有历史 PASS；P0-1B runtime smoke 已通过全新 CLI-only run，`start` 自行返回 `READY` 并保存完整 manifest/双 DB/SSE/log/artifact/cleanup report；TSI-05 run-mode、双 run 与 live LLM E2E 仍未执行。）
**优先级**: P0
**唯一实施路径**: 本文定义的 `test-serve` 运行单元；不得继续扩展 `_b_pt_wm_00r2_live.ts` 的临时隔离实现。

---

## 实施审计状态（2026-07-17）

本节是当前代码的实测状态，不改变后续任务卡的 checkbox。只有 reviewer 在修复后重跑对应证据，才可勾选任务卡。

| 范围 | 当前结论 | 证据等级 | 审计结果 / 未关闭项 |
|---|---|---|---|
| TSI-01 run context / manifest | 🟡 部分实施 | component | overlay 在 reservation 前校验；run manifest 原子写入、端口 reservation、失败 `BLOCKED` 与 create 阶段 release 成功/失败分支均有回归覆盖。非法跳转、重复 run ID 等完整验收仍未逐项执行。 |
| TSI-02 worktree / 双 DB / overlay | 🟡 部分实施 | integration + component | P0-1A 已用真实临时 repo/detached worktree 覆盖 cleanup 与 evidence 保留；历史执行 1/1 + 规定回归 14/14 PASS。双 run 隔离仍缺失。 |
| TSI-03 serve / SSE / cleanup | ✅ runtime smoke PASS | runtime-smoke | P0-1B run `2026-07-17T15-39-11-311Z-p0-1b-runtime-smoke-5e5ffb6d` 在 port 4001 通过 `create → start → bootstrap → execute(plan) → stop → cleanup`；`start` 自行返回 `READY`，serve/SSE log、`events.jsonl`、plan artifact 与 cleanup report 完整可读。 |
| TSI-04 grant / session bootstrap | ✅ 组件闭环；runtime PASS | component + runtime-smoke | 组件覆盖不变；P0-1B run 的 isolated SDK DB 有 root/child（`ses_08f449b87ffeWTsmG54UdzwXQc`/`ses_08f449a8fffeyOypd63XAZ5JKn`），framework DB grant `bdb6420b-9a57-4e26-8a4e-f0a523932a6b` 为 `bound`。 |
| TSI-05 runner 迁移 | 🟡 部分实施 | static/code | `execute --mode plan --runner ...` 已确保只写 `NOT-RUN` artifact；2026-07-17 审计：14 个 `_b_pt_wm_00r2_*` 文件均经 `readRunManifest`/`clientContextFromManifest`/`--run-dir` 读取 manifest，runner 与 `serve-api-client.ts` 中 `4097`/`sse-events`/主 work-one 路径零命中，静态迁移契约已满足；run-mode 真跑验收（`GET /session`、root/child、isolated DB 查询）仍 NOT-RUN。 |
| TSI-06 专用 skill | 🟡 部分实施 | static/code | `.agents`、`.qoder`、`.workbuddy` 三份 skill/reference SHA-256 一致；尚无通过该 skill 的完整 run evidence。 |
| TSI-07 文档 / 运行日志归档 | ✅ 同步完成 | docs + runtime-smoke | 实施步骤、INDEX、skill reference 与日志已同步；P0-1B runtime smoke artifact 已保留并写入 closure log `logs/2026-07-17-P0-1B可靠运行闭环.md`。 |
| TSI-08 旧 launcher 删除 | ⏳ 未到条件 | static/code | `_b_pt_wm_00r2_live.ts` 仍是 shim；TSI-03/04 已闭合，TSI-05 run-mode 真跑与 live E2E 仍未完成，尚不得删除。 |

### 已执行证据

- 当前从 qoderwork 根目录运行的 component 记录：`bun test scripts/test-serve/__tests__` 为 **92 pass / 1 fail**；唯一失败为 `p01b-runtime.test.ts` 因未设置 `P0_1B_PORT` 而快速失败，属预期配置缺失。历史无沙箱阻断记录 `37 pass / 0 fail` 仍保留。
- 2026-07-17 P0-1B runtime smoke PASS：run `2026-07-17T15-39-11-311Z-p0-1b-runtime-smoke-5e5ffb6d`，port 4001，manifest `status: "CLEANED"`，`bootstrapComplete: true`，root/child session、bound grant、isolated 双 DB、serve/SSE log、`events.jsonl`、plan artifact 与 cleanup report 完整。
- 静态检查（当前版本）：Bun parse 与 `git diff --check` 通过。
- P0-1B runtime smoke 历史 supporting run：`2026-07-17T07-50-49-372Z-p0-1b-runtime-smoke-2-646d5ab1` 有 root/child、bound grant、isolated 双 DB、plan artifact 与 cleanup report；因手工写 `READY` 且缺 SSE event，仅作为 supporting evidence 保留。
- live LLM E2E：**NOT-RUN**。
- 类型检查边界：`bunx tsc --noEmit` 已运行；报错均为 work-one 既有类型债务与历史脚本问题，`scripts/test-serve/*` 本次改动未引入新错误。

### 剩余 P0 顺序

1. ~~为当前组件闭环版本执行一次完整 `create → start → bootstrap → execute(plan) → stop → cleanup` runtime smoke，并保存 run manifest、DB、SSE/log、PID 与 cleanup artifact。~~（2026-07-17 已完成：run `2026-07-17T15-39-11-311Z-p0-1b-runtime-smoke-5e5ffb6d`，port 4001，CLEANED。）
2. 完成双 run 隔离、SSE 写入归属和真实 serve 接管 reservation 的确定性集成证据。
3. ~~迁移所有 G2/G3/G4 runner 与 `serve-api-client.ts` 的固定端口/SSE/主路径假设~~（2026-07-17 审计：静态迁移已完成、遗留常量零命中）；剩余为迁移后 runner 在 run mode 下的真跑验收，随第 1 项 runtime smoke 一并执行。
4. 仅在 reviewer 显式提供 H2 后，执行所需 live LLM E2E。

---

## 0. 弱模型执行协议

本 Blueprint 面向弱模型实施。弱模型只能按下列任务卡顺序执行，不得跳步、合并任务、替换实现路径或自行判定完成。

1. 每张任务卡开始前记录 `git status --short`；只修改该任务卡列出的文件。
2. 修改 work-one 前，先执行 `codegraph status` 和任务卡指定的 `codegraph impact`；本 Blueprint 的实施不能修改 work-one 业务逻辑，除非任务卡明确列出。
3. 每个任务卡完成后，只运行该卡的固定验证命令；失败时保留输出，停止，不修复下一张任务卡。
4. 任何 live 或 mutation 执行必须由人类/reviewer 在**测试 runner 环境**显式提供 `H2_AUTHORIZED=true`。弱模型不得写入、转发、伪造或默认设置该变量。
5. `unit`、`component`、`integration`、`runtime-smoke`、`live-LLM-E2E` 必须分开记录；低层级成功不得关闭高层级测试。
6. 只有 reviewer 可将本 Blueprint 的 checkbox 标为完成，或把测试 ID 标为 `PASS`。

---

## 一、问题背景与已验证根因

### 1.1 当前缺口

现有 `scripts/_b_pt_wm_00r2_live.ts` 只能启动一个表面隔离的 4097 serve，不能作为真跑测试的基础设施：

| 缺口 | 当前代码证据 | 后果 |
|---|---|---|
| 共享源码 | `cwd` 与 `OPENCODE_ROOT` 都指向主 `work-one` | mutation、写工具与配置读取可能影响真实工作区 |
| 仅隔离 framework DB | 只设置 `FRAMEWORK_DB_PATH`，未设置 `OPENCODE_DB` | 原生 OpenCode session/parent 链可能读写全局 SDK DB |
| 无稳定停止句柄 | 每次运行都 `mkdtempSync()`，PID 文件落入新目录 | `--stop` 无法找到上一次启动的 PID |
| SSE 未真正绑定运行单元 | launcher 仅写未被消费的 `.sse-path`；live E2E 仍读取固定 `/tmp/sse-events.jsonl` | 多 serve 事件混流，证据不可归属 |
| SSE 自动 `session_map` 写主库 | `sse-daemon.ts` 硬编码主 framework DB | 隔离测试污染主状态，且 evidence 与测试 DB 不一致 |
| 权限/证据散落 | runner 各自处理 port、SSE、DRY_RUN、H2、artifact | 同一测试前置不一致，弱模型容易误报 |

### 1.2 已验证事实

- `FRAMEWORK_SKILL_READ_HARD_GATE=1` 是 `skill-policy.ts` 的 serve 进程环境开关；未设置时 enforcement 会直接跳过。
- `FRAMEWORK_DB_PATH` 是 framework DB 的权威覆盖变量。
- `OPENCODE_DB` 被 session plugin 用于原生 SDK session DB；未设定时使用 `$HOME/.local/share/opencode/opencode.db`。
- `sse-daemon.ts` 已能从环境读取 `SERVE_URL`、`EVENT_FILE`、`ARCHIVE_DIR`，但尚未正确读取 framework DB 路径。
- T-PT-051 的 `H2_AUTHORIZED` 是**测试 runner 授权闸门**，不是 serve 的 runtime enforcement。

### 1.3 根因结论

根因不是缺少一个启动命令，而是缺少一个可标识、可复现、可审计、可清理的测试运行单元。启动、双 DB、worktree、SSE、授权、session/grant bootstrap 和证据目前没有共同所有者。

---

## 二、确定方案

建立 `test-serve` 测试运行单元。每次运行由一个不可复用的 `run_id` 唯一标识，并且只允许通过统一 CLI 创建、查询、执行和清理。

### 2.1 固定目录与状态模型

运行根目录固定为：

```text
${XDG_STATE_HOME:-$HOME/.local/state}/qoderwork/test-runs/<run_id>/
├── manifest.json
├── worktree/
├── db/framework-state.db
├── db/opencode.db
├── logs/serve.log
├── logs/sse.log
├── events/events.jsonl
├── events/archive/
├── pids/serve.pid
├── pids/sse.pid
├── artifacts/
└── cleanup-report.json
```

`manifest.json` 是该 run 的唯一控制面，至少包含：`run_id`、创建时间、commit、source overlay manifest SHA-256（无 overlay 时为 `null`）、worktree、端口、全部 DB/日志/事件路径、serve/SSE PID、环境白名单、root/child session、grant ID、测试 ID、授权状态和最终清理状态。

禁止使用固定 `/tmp/sse-events.jsonl`、固定 4097、主 worktree、主 framework DB 或全局 SDK DB 作为测试状态。

### 2.2 不可变隔离契约

每次 `test-serve create` 必须同时满足下表。任一项失败，命令退出非零，manifest 写 `status: "BLOCKED"`，不得启动 serve。

| 资源 | 固定实现 | 验证 |
|---|---|---|
| 源码 | `git worktree add --detach <run>/worktree <commit>` | worktree 的 `HEAD` 等于 manifest commit |
| 主 tree 脏改动 | 默认拒绝带入；仅接受显式 source overlay（`tracked.patch` + `untracked.tar` + `source-manifest.json`） | 未提供 overlay 时绝不读取/复制主工作区未提交改动 |
| 已跟踪修改 | `tracked.patch` 必须由 `git diff --binary HEAD` 生成 | overlay manifest 记录 patch SHA-256 和源 `git status --porcelain=v1 -z` |
| 未跟踪文件 | 仅允许 `git ls-files --others --exclude-standard -z` 枚举后打包到 `untracked.tar` | ignored 文件、`.env`、密钥、`.opencode/state/**`、`.task_temp/**`、`node_modules/**` 一律拒绝 |
| Framework DB | `FRAMEWORK_DB_PATH=<run>/db/framework-state.db` | framework 表写入该文件，主 DB mtime 不变 |
| SDK DB | `OPENCODE_DB=<run>/db/opencode.db` | root session 创建后该 DB 有对应 session 行 |
| serve 根 | `cwd` 和 `OPENCODE_ROOT` 均为 `<run>/worktree` | `/proc/<pid>/cwd` 与环境变量一致 |
| 端口 | 调用者必须显式传入 `--port <1024-65535>`；已占用即 `BLOCKED`，绝不 kill 外部进程 | health check 前后端口 PID 一致 |
| SSE | `SERVE_URL`、`EVENT_FILE`、`ARCHIVE_DIR` 均指向 run | 事件中的 session ID 属于 manifest root/child 集合 |
| 日志 | `OPENCODE_LOG_DIR=<run>/logs/framework` | run 内存在当次日志，主日志目录无新测试事件 |

### 2.3 进程生命周期

`test-serve start` 必须使用 Node/Bun `spawn()`，不允许调用者使用内联 `&`、`nohup`、`setsid` 或手工 PID 文件。

1. 以 `detached: true`、文件型 stdout/stderr、`QODERWORK_TEST_RUN_ID=<run_id>` 启动 serve；写入 `pids/serve.pid` 和 manifest 后 `unref()`。
2. 以同一运行环境启动 SSE daemon；写入 `pids/sse.pid`。
3. 在 30 秒内轮询 `GET /session`。成功后更新 manifest 为 `READY`；超时则保存日志并执行 `stop`。
4. `test-serve status` 必须验证：PID 存活、命令行匹配预期二进制、环境中的 `QODERWORK_TEST_RUN_ID` 匹配、health endpoint 成功。仅 PID 存在不算 READY。
5. `test-serve stop` 只终止 manifest 中且 `QODERWORK_TEST_RUN_ID` 匹配的 PID；先 SSE 后 serve，SIGTERM 等待 10 秒，再 SIGKILL。PID 被复用或环境不匹配时拒绝杀进程并标 `BLOCKED`。
6. `test-serve cleanup` 只有在 stop 成功后才能移除 `manifest.paths.worktreeDir`；`manifest.paths.rootDir` 是持久 runtime evidence bundle，必须保留其中的 manifest、双 DB、logs、events、artifacts 与 `cleanup-report.json`。失败时额外保留仍存在的 worktree，并写 `BLOCKED` cleanup report。删除历史 evidence 不属于 cleanup 命令职责。

### 2.4 授权、grant 与 session bootstrap

`test-serve bootstrap` 只在 `READY` 状态运行，顺序固定：

1. `POST /session` 创建 root session，并立即记录 session ID/agent。
2. 按测试所需的生产服务 API 调用 isolated worktree 的 `createGrant()`；禁止 direct SQL 插入 grant。
3. 按测试场景创建 child session，并由生产 `bindGrant()` 绑定；查询 isolated framework DB 确认绑定字段。
4. 把 root/child、grant ID、`allowed_paths`、grant 状态写回 manifest。
5. 任何路径超出 manifest `allowed_paths`、grant 未绑定或 grant 已消费时，bootstrap 失败并停止。

`H2_AUTHORIZED=true` 只由 `test-serve execute --mode live` 检查；`create`、`start`、`status`、`stop`、`cleanup` 不读取它。`execute` 同时要求 `H2_AUTHORIZED=true`、`DRY_RUN=false` 和 manifest `READY + bootstrap_complete`，缺任一项只写 plan-only evidence 并返回 `NOT-RUN`，绝不发 live prompt。

### 2.5 Skill 职责边界

新增技能名固定为 `isolated-serve-test`，它是测试运行环境编排 skill，不是 `serve-api` 的副本。

| Skill | 唯一职责 | 禁止事项 |
|---|---|---|
| `serve-api` | 通用 serve API 与 SSE 交互验证 | 创建/删除测试 worktree，判定测试通过 |
| `test-specification-execution` | 读取规格、执行 oracle、测试状态裁决 | 管理 serve 进程或隔离资源 |
| `isolated-serve-test` | 创建/管理 run、调用 bootstrap、输出 manifest 和运行证据 | 自授 H2、跳过 oracle、把运行时证据标 PASS |

`isolated-serve-test` 只允许调用 `test-serve` CLI；禁止在 skill 文本中出现直接 `opencode serve`、裸 `curl localhost:4097`、固定 `/tmp` 路径或 shell 后台操作。

### 2.5.1 主 tree 未提交文件的固定处理

`git worktree add` 只检出 commit，不复制主 tree 的已跟踪修改、未跟踪文件或 ignored 文件。因此测试输入固定分为两类：

1. **默认 committed mode**：调用 `test-serve create --commit <sha> --port <port> --test-id <id>`。它只测试 `<sha>`，主 tree 是否 dirty 不影响测试输入。
2. **显式 dirty-overlay mode**：reviewer 先运行 `test-serve snapshot-source --from <primary-worktree> --output <overlay-dir> --allow-dirty-source`，再将 `--source-overlay <overlay-dir>` 传给 `create`。该命令必须生成以下三个文件：

```text
<overlay-dir>/tracked.patch
<overlay-dir>/untracked.tar
<overlay-dir>/source-manifest.json
```

`source-manifest.json` 必须记录：源 commit、原始 `git status --porcelain=v1 -z`、patch SHA-256、tar SHA-256、每个 untracked 文件的相对路径/大小/SHA-256，以及 overlay 创建时间。`create` 必须先验证全部 hash 和路径白名单，再创建 detached worktree，最后按顺序 `git apply --index tracked.patch`、解包 `untracked.tar`。任一验证或应用失败即删除新 worktree 并标 `BLOCKED`。

弱模型不得调用 `snapshot-source`，不得把主 tree 目录复制到测试目录，也不得把 ignored 或敏感文件加入 overlay。是否测试未提交代码是 reviewer 的显式输入；任何 dirty-overlay 的结果只能归属到 `commit + overlay manifest SHA-256`，不得写作该 commit 的纯净测试结果。

### 2.6 子系统合规审计

| 子系统 | 结论 | 固定约束 |
|---|---|---|
| MVC Architecture | ✅ | CLI 只编排；run context、进程、bootstrap、执行、evidence 分模块，不把业务逻辑塞入入口脚本 |
| DB-only & DB-canonical | ✅ | framework 状态和原生 session DB 都显式指向 run；manifest 只是运行元数据，不替代 DB 业务状态 |
| Permission Matrix | ✅ | H2 仅是 runner 外部授权；grant 必须经生产 `createGrant/bindGrant`，不新增权限绕过 |
| Concurrency Safe | ✅ | 一个 run 一组 DB/端口/PID；端口冲突 fail-closed；不在不同 run 间共享可写状态 |
| Hardened Enforcement | ✅ | hard gate 由 serve 启动环境固定注入；runner 和 skill 无法关闭或改写它 |
| Framework Harness | ✅ | 只复用真实 serve、真实 session、真实 dispatcher 与生产 grant service |
| Central State Management | ✅ | manifest 是唯一控制面；不再通过临时 PID 文件、固定路径或 shell 约定传递状态 |
| Multi-Agent | ✅ | root/child/session/grant 绑定均记录并在 isolated DB 中验证 |
| Log Central Management | ✅ | serve、SSE、artifact 都归入 run 目录；不把测试事件写入主库/主事件流 |
| DB-canonical Management | ✅ | DB 路径由 manifest 单点生成；所有写入均可由 run ID 定位和清理 |
| Templatization & Parameterization | ✅ | run ID、commit、patch、port、allowed paths 均参数化；禁止硬编码 4097 或 `/tmp` |
| TypeScript + Bun Runtime | ✅ | 仅 TypeScript/Bun/Node 标准库；进程通过 `spawn` argv 启动，不引入 npm 或 shell 解析 |

### 2.7 明确拒绝的实现

- 不修补原 launcher 的 `mkdtempSync()` PID 逻辑；它没有解决 worktree、SDK DB、SSE、授权和证据的共同所有权问题。
- 不创建第二份通用 `serve-api` 文档；测试基础设施必须由可执行 CLI 和 manifest 约束，不能依赖提示词记忆。
- 不允许测试 skill 直接写 DB、启动裸 serve、自动设置 H2 或清理未知 PID；这些路径会让自动化越过真实生产边界。

### 2.8 `scripts/` 整理与退役契约

`scripts/` 不做目录级批量删除。每个文件必须归入“保留”“迁移后保留”或“迁移后删除”之一；未列出的文件不在本 Blueprint 范围内，弱模型不得删除。

| 文件/范围 | 最终状态 | 固定处理 |
|---|---|---|
| `scripts/test-serve/*.ts` | 新建并保留 | 成为唯一隔离测试基础设施实现 |
| `scripts/_b_pt_wm_00r2_live.ts` | 迁移后删除 | 先改为最小 deprecation shim；所有调用者迁移并验收后删除文件 |
| `scripts/_b_pt_wm_00r2_live_e2e.ts` | 迁移后保留 | 作为 PT-WM-00R2 场景 runner，只从 manifest 读取 run 参数 |
| `scripts/_b_pt_wm_00r2_g2_*.ts` | 迁移后保留 | 保留具体 deterministic test ID 逻辑，删除其内部 lifecycle/固定路径假设 |
| `scripts/_b_pt_wm_00r2_g3_*.ts` | 迁移后保留 | 保留具体 live test ID/oracle；通过 `test-serve execute` 受控运行 |
| `scripts/_b_pt_wm_00r2_g4_*.ts` | 迁移后保留 | 保留 adversarial/mutation 场景；不得直接启动 serve |
| `scripts/start-serve.ts` | 保留 | 仍是人工/通用 serve 入口，不承担隔离测试 |
| `scripts/sse-daemon.ts` | 保留并修复 | 保持通用订阅器，必须接受 run 的 DB/事件参数 |
| `scripts/lib/serve-api-client.ts` | 保留并适配 | 保持 API 客户端；endpoint/SSE 文件只能由 manifest 注入 |

删除 `scripts/_b_pt_wm_00r2_live.ts` 前必须按顺序满足四项：

1. `test-serve` 的 unit、双 run integration、runtime smoke 全部通过。
2. `_b_pt_wm_00r2_live_e2e.ts` 与 T-PT-051 已用 manifest 实际运行，不再读取固定 4097、固定 `/tmp` 或主 worktree。
3. 执行 `rg -n '_b_pt_wm_00r2_live' scripts e2e .agents .qoder .workbuddy`；除 Blueprint、历史日志和该 shim 本身外为零调用者。
4. 删除文件后重跑迁移后的 component、runtime smoke 和所需 live E2E；任一失败则从当前提交恢复该文件并记录 first failure。

---

## 三、文件变更清单

| # | 文件 | 类型 | 必须完成的变更 |
|---|---|---|---|
| 1 | `scripts/test-serve/types.ts` | 新建 | `RunManifest`、状态枚举、环境白名单、命令结果类型 |
| 2 | `scripts/test-serve/run-context.ts` | 新建 | run ID、目录、commit/patch、worktree、manifest 原子读写 |
| 3 | `scripts/test-serve/process.ts` | 新建 | 受 run ID 约束的 spawn/status/stop，无 shell 命令字符串 |
| 4 | `scripts/test-serve/isolated-serve.ts` | 新建 | `create/start/status/stop/cleanup` CLI 入口 |
| 5 | `scripts/test-serve/bootstrap.ts` | 新建 | root/child session、生产 `createGrant/bindGrant` 调用、DB 断言 |
| 6 | `scripts/test-serve/execute.ts` | 新建 | H2/DRY_RUN gate、runner 启动、evidence 索引 |
| 7 | `scripts/test-serve/__tests__/run-context.test.ts` | 新建 | manifest、path、patch、port 冲突、脏工作区拒绝 |
| 8 | `scripts/test-serve/__tests__/process.test.ts` | 新建 | PID 身份校验、拒绝杀非本 run 进程、stop 升级路径 |
| 9 | `scripts/test-serve/__tests__/bootstrap.test.ts` | 新建 | grant 必须由生产 service 创建/绑定、越界路径拒绝 |
| 10 | `scripts/sse-daemon.ts` | 修改 | `FRAMEWORK_DB_PATH` 取代硬编码主库；去除未使用 SDK DB 局部变量 |
| 11 | `scripts/_b_pt_wm_00r2_live.ts` | 修改后删除 | 先变为废弃 shim；满足 TSI-08 删除门槛后删除，不保留长期兼容实现 |
| 12 | `scripts/_b_pt_wm_00r2_live_e2e.ts` | 修改 | 接收 `--run-dir`/manifest，不再硬编码 port 与 SSE 文件 |
| 13 | `scripts/_b_pt_wm_00r2_g3_t051.ts` | 修改 | 从 manifest 读取 endpoint 与 session/grant；保留 H2/DRY_RUN gate |
| 14 | `.agents/skills/isolated-serve-test/SKILL.md` | 新建 | 测试专用流程、硬约束、命令模板、失败处理 |
| 15 | `.agents/skills/isolated-serve-test/reference.md` | 新建 | manifest schema、命令示例、evidence 目录规则 |
| 16 | `.qoder/skills/isolated-serve-test/{SKILL.md,reference.md}` | 新建 | 与 `.agents` 完全相同的受控副本 |
| 17 | `.workbuddy/skills/isolated-serve-test/{SKILL.md,reference.md}` | 新建 | 与 `.agents` 完全相同的受控副本 |
| 18 | `e2e/permission-template-enforcement-test-spec.md` | 修改 | 把 00R2 真跑前置改为 manifest/run ID 契约 |
| 19 | `documents/INDEX.md` | 修改 | 登记本 Blueprint 与测试基础设施入口 |
| 20 | `logs/YYYY-MM-DD-isolated-serve-test-infrastructure.md` | 新建 | 仅在发生代码变更后记录设计决策与拒绝路径 |

---

## 四、实施任务卡

### TSI-01：运行上下文与 manifest

**修改文件**：#1、#2、#7。
**实现**：`createRunContext()` 只接受绝对路径的 `--commit`、可选 `--source-overlay`、必填 `--port`、测试 ID；用 `fs.rename()` 原子替换 manifest。状态只能是 `CREATED → WORKTREE_READY → READY → BOOTSTRAPPED → EXECUTED → STOPPED → CLEANED` 或 `BLOCKED/FAILED`。
**拒绝条件**：port 非法/占用、commit 不存在、overlay 缺三件套或 hash 不符、overlay 有敏感/ignored/越界路径、run ID 已存在。
**固定验证**：`bun test scripts/test-serve/__tests__/run-context.test.ts`。

### TSI-02：受控 worktree 与双 DB

**修改文件**：#2、#4、#7。
**实现**：调用 `git worktree add --detach` 创建 run worktree；仅在 hash 校验成功后应用 `tracked.patch` 和 `untracked.tar`。manifest 中固定导出 `OPENCODE_ROOT`、`FRAMEWORK_DB_PATH`、`OPENCODE_DB`、`OPENCODE_LOG_DIR`、`QODERWORK_TEST_RUN_ID`。
**拒绝条件**：禁止读取主 worktree 文件以“复制脏改动”；禁止软链接到主 `.opencode/state`；禁止自动收集 ignored 文件。
**固定验证**：创建临时 git repo，证明 `git worktree` 默认不带入 tracked/untracked 脏改动；证明显式 overlay 能带入两类文件；证明 overlay 失败不留下 worktree；断言两个 DB 的 realpath 位于 run 目录。

### TSI-03：serve/SSE 生命周期与隔离修复

**修改文件**：#3、#4、#8、#10。
**实现**：只用 `spawn` 启动两个子进程。SSE daemon 的 `fwDbPath` 必须为 `process.env.FRAMEWORK_DB_PATH`，缺失时立即报错；`OPENCODE_DB` 只用于它实际需要的 SDK 查询。
**拒绝条件**：禁止 `exec`、`execSync`、`bash -c`、`setsid`、`nohup`、命令字符串拼接；禁止 `pkill`。
**固定验证**：component test 证明不同 run 的事件文件和 session_map 写入不同 framework DB；stop 拒绝 `QODERWORK_TEST_RUN_ID` 不匹配 PID。

### TSI-04：生产 grant/session bootstrap

**修改文件**：#5、#9。
**实现**：从 isolated worktree 动态导入 `.opencode/service/dispatch/privilege.ts` 的 `createGrant`、`bindGrant`；以显式 `allowed_paths` 创建并绑定 grant。直接 SQL 只允许作只读 oracle。
**拒绝条件**：`allowed_paths` 为空、包含 worktree 外路径、grant 未绑定、child session 不属于 root、生产 service 导入失败。
**固定验证**：component test 覆盖成功绑定、越界路径拒绝、重复消费拒绝；integration test 在临时 framework DB 查询 grant 生命周期。

### TSI-05：真跑执行适配与 00R2 迁移

**修改文件**：#6、#11、#12、#13、#18。
**实现**：所有 runner 改以 `--run-dir <absolute-path>` 为唯一输入；端点、SSE 文件、DB、session、grant 只能从 manifest 读取。`_b_pt_wm_00r2_live.ts` 仅调用新 CLI，保留旧命令兼容性但不得保留旧生命周期代码。
**拒绝条件**：runner 中出现 `4097`、`/tmp/sse-events.jsonl`、主 `work-one`、或直接启动 serve，即失败。
**固定验证**：`rg` 断言上述遗留常量仅出现在历史/迁移说明；在 run mode 下完成 `GET /session`、root/child 创建和 isolated DB 查询。

### TSI-06：测试专用 skill

**修改文件**：#14–#17。
**实现**：skill 固定执行 `admit → create → start → bootstrap → execute → collect → stop → cleanup`。每一步必须写 manifest 路径和 `Verified-by`。失败分流固定为：前置缺失=`BLOCKED`，oracle 不满足=`FAIL`，H2/DRY_RUN 不满足=`NOT-RUN`，规格缺 oracle=`INVALID`。
**拒绝条件**：skill 不得自行运行 `export H2_AUTHORIZED=true`；不得在 `NOT-RUN` 情形发送 prompt；不得调用普通 `start-serve.ts`。
**固定验证**：三份副本文件 hash 相同；skill 的命令示例全部以 `test-serve` 开头。

### TSI-07：文档、日志与交接

**修改文件**：#18–#20。
**实现**：测试式样书只引用 run manifest；INDEX 标注基建入口；代码变更当日创建 20 行以内日志。
**固定验证**：`rg '4097|/tmp/sse-events.jsonl'` 在活跃 test runner/skill 路径零命中；文档命令与 CLI `--help` 输出一致。

### TSI-08：脚本迁移收口与旧 launcher 删除

**修改文件**：#11，以及 TSI-05 已迁移的 #12–#13。
**实现**：先将 `_b_pt_wm_00r2_live.ts` 收缩为只转调 `test-serve` 的 shim；完成 §2.8 的四项删除门槛后，用 `apply_patch` 删除该文件。不得删除 `start-serve.ts`、`sse-daemon.ts`、`lib/serve-api-client.ts`、任一 G2/G3/G4 runner 或未列入 §2.8 的脚本。
**拒绝条件**：任一 runner 仍引用旧 launcher、固定 4097、固定 SSE 文件或主 worktree；删除前未完成 runtime smoke；`rg` 仍发现活跃调用者。
**固定验证**：删除前后分别保存 `rg -n '_b_pt_wm_00r2_live' scripts e2e .agents .qoder .workbuddy` 输出；删除后重跑 TSI-05 的 component/runtime smoke/live E2E 子集，并在日志中记录被拒绝的“批量清理 scripts/”方案。

---

## 五、验证计划与验收门槛

### 5.1 单元/组件

- [ ] manifest 状态机拒绝非法跳转和重复 run ID。
- [ ] patch SHA-256、commit、port、绝对路径被写入 manifest。
- [ ] PID 身份校验拒绝终止非本 run 的任意进程。
- [ ] `sse-daemon` 使用 `FRAMEWORK_DB_PATH`，不再硬编码主库。
- [ ] `H2_AUTHORIZED` 不会被基建或 skill 写入。

### 5.2 确定性集成

- [ ] 同时创建两个 run；worktree、双 DB、日志、事件文件均不同。
- [ ] 在 run A 创建 session/grant；run B 和主 DB 均查询不到该记录。
- [ ] 让 run A 的 SSE 收到 `session.created`；只写 A 的 framework DB。
- [ ] `stop` 仅停止 A 的 serve/SSE，不影响 B、4096 或其他外部 PID。
- [ ] 强制 patch 应用失败；确认没有残留 worktree/进程/DB。

### 5.3 runtime smoke

- [ ] 用真实 `opencode serve` 在 isolated worktree 启动；health endpoint 在 30 秒内成功。
- [ ] 创建 root session 后，isolated `OPENCODE_DB` 存在对应 session 记录。
- [ ] `FRAMEWORK_SKILL_READ_HARD_GATE=1` 下，未 attest 的非 allowlist tool 被 `skill-read-attest-required` 拒绝。
- [ ] 通过生产 `createGrant/bindGrant` 创建 root/child 正向链路，DB oracle 与 manifest 一致。

2026-07-17 复审：上述 root/child 与 bound grant 已在 run `2026-07-17T07-50-49-372Z-p0-1b-runtime-smoke-2-646d5ab1` 中观察到，但 `READY` 被手工写入且缺 SSE event，故本节 checkbox 全部保持未勾选。当前受管沙箱禁止 local bind，本轮测试复跑被环境阻断，不能替代无沙箱 reviewer 重跑。

### 5.4 live LLM E2E

- [ ] 仅在 `H2_AUTHORIZED=true DRY_RUN=false` 下执行 T-PT-046、T-PT-051、T-PT-052。
- [ ] 每个 test ID 有独立 run ID、原始 request、session/agent/task/call identity、DB 前后快照、SSE/log 和 oracle 结果。
- [ ] 未认证负向路径证明 executor 零执行和目标状态不变。
- [ ] 执行完成后 bootstrap grant 已消费；cleanup 成功或保留明确的失败现场。

---

## 六、风险与回滚

| 风险 | 缓解 | 回滚 |
|---|---|---|
| worktree 不能覆盖未提交目标改动 | 显式 patch + SHA-256；无 patch 即拒绝 | 删除 run worktree，不碰主 worktree |
| untracked 文件未被 patch 覆盖或意外泄露敏感内容 | source overlay 强制 `tracked.patch + untracked.tar + manifest`，拒绝 ignored/敏感路径并逐文件 hash | 删除 run worktree 和 overlay；主 tree 不受影响 |
| port race 或端口冲突 | 强制 `--port`，启动前检查、绑定失败即停止 | 仅清理本 run PID，不 kill 外部服务 |
| 原生 OpenCode 不尊重 `OPENCODE_DB` | runtime smoke 必须查询 isolated DB；失败即 BLOCKED | 保留 run 目录与日志，禁止 live E2E |
| SSE daemon 影响主库 | 修改为仅使用 `FRAMEWORK_DB_PATH`，以双 run 集成验证 | 回滚该单文件改动，停止所有 test run |
| 测试 runner 误授权 | H2 仅外部读取；skill/CLI 不写该变量 | 将执行标为 NOT-RUN，保留 plan-only artifact |
| 清理误杀 PID | run ID 环境与命令行双重匹配，失败拒绝 kill | 手工 reviewer 处理残留 PID，不自动扩大 kill 范围 |

---

## 七、完成标准

- [ ] 不再存在测试专用 launcher 直接使用主 worktree、主 framework DB、全局 SDK DB 或固定 SSE 文件。
- [ ] 每个 live 测试均可由 run ID 完整追溯到源码快照、环境、session、grant、日志和 oracle。
- [ ] `start/status/stop/cleanup` 可重复运行，且不会影响非本 run 的 process/state。
- [ ] `isolated-serve-test` 与 `serve-api`、`test-specification-execution` 无职责重叠。
- [ ] 00R2 runner 已迁移至 manifest 契约，所有前置不足均明确为 `BLOCKED/NOT-RUN/INVALID`。
- [ ] `scripts/_b_pt_wm_00r2_live.ts` 已按 §2.8/TSI-08 删除；其余保留脚本均不含重复的 serve lifecycle 实现。
- [ ] reviewer 完成 runtime smoke 与所需 live LLM E2E 后，才允许更新 PT-WM-00R2 的状态裁决。
