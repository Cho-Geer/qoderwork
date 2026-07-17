# TSI-04 P0：child/grant bootstrap 闭环实施方案【总体状态：PARTIAL】

**[ID]**: ISO-SERVE-P1-PLAN-20260716-02
**复审时间**: 2026-07-17 Asia/Tokyo
**状态**: `[VERIFIED][COMPONENT]` TSI-04 主体闭环，当前全量 `scripts/test-serve/__tests__` 为 37/37 PASS（2026-07-17 审计复跑确认）；`[VERIFIED][COMPONENT-COMPLETE]` cleanup evidence 留存契约已收口（evidence 返回字段、report schema、CLI 输出与 Blueprint/测试式样书一致，见 Section 9）；`[NOT-RUN]` runtime smoke / live LLM E2E。
**范围**: 仅闭环 `test-serve bootstrap` 的 root session、child session、生产 grant、bound DB oracle、失败退出与受限 cleanup。端口接管、overlay 和 runner 行为不在本方案内。

**状态图例**: `COMPLETE/PASS` 表示已有当前源码与本轮测试证据；`PARTIAL` 表示只有部分契约成立；`PENDING` 表示尚未实施；`NOT-RUN` 表示没有对应层级的运行证据。

## 1. 不可变完成契约【状态：[VERIFIED][COMPONENT-COMPLETE]】

一次 `bootstrap` 只有满足下列全部条件才成功：

1. 已创建 root session 和 child session，且 child 请求体的 `parentID` 等于 root ID。
2. 已从 `manifest.paths.worktreeDir` 动态导入该隔离 worktree 的生产 `privilege.ts`；未使用主 work-one 模块。
3. 生产 `createGrant()` 返回 grant，传入的 `agent_type` 等于 `input.childAgent`。
4. 生产 `bindGrant(dispatchKey, childSessionId)` 返回 bound grant。
5. 只读 SQLite oracle 查询同一 isolated framework DB，确认该 grant 的 `status='bound'` 且 `child_session_id===childSessionId`。
6. 仅在第 5 条成功后，manifest 一次性写入四个 ID、规范化 allowed paths、`bootstrapComplete=true`，并写为 `BOOTSTRAPPED`。

缺少任何一项时，必须持久化 `BLOCKED` 和 `bootstrapComplete=false`，然后抛错使 CLI 以非零退出；不得返回成功对象、不得写 `BOOTSTRAPPED`、不得执行 runner。

禁止 direct SQL 创建、绑定或修改 grant；SQL 只可作为只读 oracle。禁止设置 `H2_AUTHORIZED=true`、发送 live prompt、修改 work-one 业务代码。

## 2. 已验证根因【状态：[VERIFIED][HISTORICAL-FIXED]】

- `[FIXED]` `childAgent`、CLI 和 skill/reference 已改为必填；本轮指定 5 文件组件测试为 25/25 PASS。
- `[FIXED]` 历史“bindGrant 返回 null”测试曾在 root session HTTP 创建失败处提前结束；当前用例已实际进入 fake `bindGrant()` 并验证 `BLOCKED` 后 reject，CLI 子进程退出码为 1。
- `[FIXED]` 历史 operational failure 曾返回 `BLOCKED` 对象并使 CLI 以 0 结束；当前 `bootstrapRun()` 在持久化 `BLOCKED` 后抛错。
- `[FIXED]` 历史路径校验使用字符串前缀、进程停止未确认 SIGKILL 后退出；当前已使用 canonical realpath 边界，并在退出未确认时保留 PID/状态。

复审结论：上述根因均已有当前源码和组件测试证据；本节保留为历史问题说明，不再代表当前缺陷。

## 3. 唯一实施设计【状态：[VERIFIED][IMPLEMENTED]】

### 3.1 状态机与错误语义【状态：[VERIFIED][IMPLEMENTED]】

```text
READY
  -> validate input and canonical paths
  -> create root session
  -> create production grant
  -> create child session(parentID=root)
  -> bind production grant
  -> read-only DB oracle
  -> atomically persist proof fields
  -> BOOTSTRAPPED and return manifest

any operational failure after validation
  -> persist collected IDs + bootstrapComplete=false
  -> stop only verified run processes
  -> reread manifest
  -> BLOCKED
  -> throw BootstrapFailure (CLI exit 1)
```

输入验证失败（缺 child、空 allowed paths、路径越界）在任何 HTTP、动态 import、DB 访问或 manifest 状态写入之前直接抛固定错误，manifest 保持 `READY`。

### 3.2 `bootstrap.ts` 的精确修改【状态：[VERIFIED][IMPLEMENTED]】

1. 从 `node:fs` 导入 `realpathSync`，从 `node:path` 导入 `isAbsolute`、`relative`、`resolve`、`sep`。
2. 新增 `normalizeAllowedPaths(worktreeDir, inputPaths)`；只接受存在的 worktree 本身或真实子目录，解析 `..` 和 symlink 后返回 canonical absolute paths。实现固定为：

```ts
function normalizeAllowedPaths(worktreeDir: string, inputPaths: string[]): string[] {
  const root = realpathSync.native(resolve(worktreeDir));
  return inputPaths.map((inputPath) => {
    const candidate = realpathSync.native(resolve(inputPath));
    const rel = relative(root, candidate);
    const inside = rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
    if (!inside) throw new Error(`allowed path outside worktree: ${inputPath}`);
    return candidate;
  });
}
```

3. `bootstrapRun()` 在读取 `READY` manifest 后依次验证空白 child、非空 paths、`normalizeAllowedPaths()`；将其结果保存为局部 `allowedPaths`。所有后续 createGrant 和 manifest 写入都只能使用该变量。
4. 增加仅供测试调用的第二参数，不写入 `BootstrapInput`、不暴露到 CLI：

```ts
export interface BootstrapDependencies {
  createSession?: typeof createSession;
  loadPrivilegeService?: typeof loadPrivilegeService;
  assertGrantBound?: typeof assertGrantBound;
  stopRunProcesses?: typeof stopRunProcesses;
}

export async function bootstrapRun(
  input: BootstrapInput,
  dependencies: BootstrapDependencies = {},
): Promise<RunManifest>
```

函数内部只用 `dependencies.x ?? productionX`。默认路径必须仍调用生产函数；依赖注入只用于确定性故障测试。
5. 设定并保留固定 stage 名称：`create-root-session`、`load-privilege-service`、`create-grant`、`create-child-session`、`bind-grant`、`db-oracle`、`stop-processes`。每个可能抛错的操作之前先写入当前 stage。
6. 成功路径严格调用：`createSession(root)` → `loadPrivilegeService()` → `createGrant()` → `createSession(child, parentID=root.id)` → `bindGrant()` → `assertGrantBound()`。`createGrant()` 的 `agent_type` 使用 `input.childAgent`，`allowed_paths` 使用 canonical `allowedPaths`。
7. 成功路径只在 oracle 成功后，单次 `writeRunManifest()` 写 root/child/grant/dispatchKey/allowedPaths/`bootstrapComplete=true`；随后 `setRunState(..., "BOOTSTRAPPED")` 并返回该 manifest。
8. catch 首先把已获得的 ID、canonical paths、`bootstrapComplete=false` 和 `bootstrap failed at <stage>: <message>` 写入 manifest。随后调用 `stopRunProcesses`；无论其结果都重新读取 manifest，再写 `BLOCKED`。
9. `stopRunProcesses` 成功时，BLOCKED manifest 必须满足三个 PID 均为 `null` 且两个 PID 文件均不存在；不满足时把 `stop-processes` 记录到 cleanup note，保持实际 PID 字段，写 `BLOCKED` 后抛 `BootstrapFailure`。
10. catch 的最后一行固定为 `throw new Error(`bootstrap failed at ${stage}: ${message}`)`；禁止 `return setRunState(..., "BLOCKED")`。

> 偏差说明（2026-07-17 审计）：实现未使用 `stop-processes` 字面 stage 标签；进程停止结果以 cleanup note（`bootstrap process stop failed: ...`）记录，抛出的为普通 `Error`（与第 10 条一致）。行为契约不变：保留真实 PID、写 `BLOCKED`、CLI 非零退出。

### 3.3 `process.ts` 与 `isolated-serve.ts` 的精确修改【状态：[VERIFIED][IMPLEMENTED]】

1. `stopRunProcesses()` 在 SIGTERM 超时后执行 SIGKILL；第二次 `waitForExit()` 返回 `false` 时立即抛 `process did not exit: <pid>`。
2. 只有所有目标进程均已确认退出后，才清空 serve/SSE PID、删除 PID 文件并写 `STOPPED`。任一失败时保留 manifest PID 和 PID 文件。
3. `cleanupRun()` 的 BLOCKED 例外增加 `!existsSync(servePidPath)` 与 `!existsSync(ssePidPath)`；PID 字段为 null 但 PID 文件仍在时必须拒绝 cleanup。
4. CLI 保持现有顶层 `main().catch(... process.exit(1))`；因为 bootstrap failure 改为抛错，所以不得为 bootstrap 分支额外捕获或转换成 exit 0。

## 4. 文件变更清单【状态：[VERIFIED][IMPLEMENTED-WITH-DEVIATION]】

| 文件 | 变更 | 当前状态 | 完成条件 |
|---|---|---|---|
| `scripts/test-serve/bootstrap.ts` | 修改 | `[VERIFIED][COMPLETE]` | canonical path、默认生产调用、测试注入、阶段化失败、BLOCKED 后抛错 |
| `scripts/test-serve/process.ts` | 修改 | `[VERIFIED][COMPLETE]` | SIGKILL 后必须确认退出才可清 PID |
| `scripts/test-serve/isolated-serve.ts` | 修改 | `[VERIFIED][COMPLETE]`（仅 TSI-04 范围） | BLOCKED cleanup 额外检查 PID 文件 |
| `scripts/test-serve/__tests__/bootstrap-fixtures.ts` | 原计划新建 | `[VERIFIED][ALTERNATE]` 未创建；fixture 实际内联在 `bootstrap.test.ts` | 行为覆盖成立，不再要求拆分文件 |
| `scripts/test-serve/__tests__/bootstrap.test.ts` | 重写相关 describe | `[VERIFIED][COMPLETE]` | 前置、成功生产集成、bind-null、oracle-mismatch、子进程失败、cleanup 覆盖 |
| `scripts/test-serve/__tests__/process.test.ts` | 新增用例 | `[VERIFIED][COMPLETE]` | SIGKILL 后仍存活不清 PID、不写 STOPPED |
| `scripts/test-serve/__tests__/cleanup.test.ts` | 新增用例 | `[VERIFIED][COMPLETE]`（仅 PID gate） | 仅无 PID 且无 PID 文件的 BLOCKED bootstrap run 可 cleanup |
| `plans/隔离 serve 测试基建待办/01-bootstrap-child-grant-fail-closed实施步骤.md` | 更新 | `[VERIFIED][UPDATED]` | 仅在对应层级验证完成后勾选成功标准 |
| `logs/2026-07-16-隔离-serve-bootstrap-child-grant.md` | 更新 | `[VERIFIED][COMPLETE]` | 记录组件验证与 runtime 未执行边界 |

## 5. 可复制执行步骤【状态：[VERIFIED][IMPLEMENTED-WITH-DEVIATION]】

### S1：建立测试 fixture【状态：[VERIFIED][ALTERNATE-IMPLEMENTATION]】

复审说明：未创建独立 `bootstrap-fixtures.ts`；临时 manifest、Bun HTTP server、isolated worktree copy 与 SQLite oracle 已内联在 `bootstrap.test.ts`。当前验收行为成立，此文件拆分不再作为完成门禁。

1. 实际在 `bootstrap.test.ts` 内创建唯一 `/tmp` run root、`worktree`、`db`、`pids`、`artifacts` 和 manifest；不再新建 `bootstrap-fixtures.ts`。
2. 使用 `cpSync('/home/zhaoge/workspace/opencode/work-one/.opencode', '<temp>/worktree/.opencode', { recursive: true })` 创建独立 worktree source；不得 symlink 主 work-one。
3. manifest.env 固定设置 `OPENCODE_ROOT=<temp>/worktree`、`FRAMEWORK_DB_PATH=<temp>/db/framework-state.db`、`OPENCODE_LOG_DIR=<temp>/logs/framework` 和唯一 `QODERWORK_TEST_RUN_ID`。
4. 使用 `Bun.serve({ port: 0, fetch })` 创建本地 session server。它只接受两次 `POST /session`：第一次返回 `{id:'root-1'}`，第二次断言 body 的 `parentID==='root-1'` 后返回 `{id:'child-1'}`。fixture 返回实际 port、请求列表和 stop 函数。
5. 每个测试 `finally` 必须 `server.stop(true)`、删除 temp root；不得接触真实 serve、真实 work-one DB 或 Git 元数据。

### S2：实现生产成功链【状态：[VERIFIED][COMPLETE]】

1. 按第 3.2 节改 `bootstrap.ts`，保留 `loadPrivilegeService(manifest)` 的动态路径，不允许在测试或生产中改为主仓库绝对路径。
2. 成功集成测试调用 `bootstrapRun(input)`，不传第二参数；因此必须执行 copied isolated worktree 的真实 `createGrant/bindGrant`。
3. 测试用 `new Database(manifest.paths.frameworkDbPath, { readonly: true })` 查询：

```sql
SELECT id, status, child_session_id, parent_session_id, agent_type
FROM dispatch_privilege_grants
WHERE id = ?
```

4. 断言 row 的 `id===manifest.grantId`、`status==='bound'`、`child_session_id==='child-1'`、`parent_session_id==='root-1'`、`agent_type===input.childAgent`；同时断言 session request 顺序与 manifest 的四个 ID、canonical allowed paths、`bootstrapComplete===true`、`status==='BOOTSTRAPPED'`。

### S3：实现确定性失败链【状态：[VERIFIED][COMPLETE]】

1. bind-null 单元测试传入 `BootstrapDependencies`：fake root/child `createSession`、fake `loadPrivilegeService`（`createGrant` 返回 `{id:'grant-1'}`，`bindGrant` 返回 `null`）、真实 fixture manifest，以及成功返回 STOPPED manifest 的 fake `stopRunProcesses`。
2. 断言 `bootstrapRun()` reject 的错误精确包含 `bootstrap failed at bind-grant: bindGrant returned null`；重新读取 manifest，断言 `BLOCKED`、`bootstrapComplete=false`、root/child/grant/dispatchKey 已保存，且无 `BOOTSTRAPPED`。
3. DB-oracle-mismatch 单元测试使 fake `bindGrant` 返回 `{id:'grant-1'}`、fake `assertGrantBound` 抛 `grant row not bound in framework DB`；断言同一 BLOCKED/throw 契约，stage 必须是 `db-oracle`。
4. child session 创建失败、production import 失败各有一例；每例必须验证对应 stage 与已产生 ID 的保留。bind-null 另由 CLI 子进程验证非零退出。
5. 缺 child、`<worktree>/../outside`、worktree 内指向外部的 symlink 三例在 HTTP request count 为 0 时抛错，并保持 manifest `READY`/`bootstrapComplete=false`。
6. 在临时 run directory 中保留 PID 文件或让 fake stop 抛错；断言 manifest 为 `BLOCKED`、PID 信息未被伪造为 null、`cleanupRun()` 拒绝。

### S4：验证 CLI 与 cleanup【状态：[VERIFIED][COMPLETE]】

1. 用 `Bun.spawnSync([process.execPath, 'run', 'scripts/test-serve/isolated-serve.ts', 'bootstrap', ...])` 执行 bind-null fixture 的 CLI 子进程；断言 `exitCode===1`、stderr 含固定 stage 错误、manifest 为 `BLOCKED`。
2. 对无 PID/无 PID 文件的 BLOCKED bootstrap fixture 调用 `cleanupRun()`，注入成功的 `git worktree remove`；断言返回 `ok:true` 且状态为 `CLEANED`。
3. 对任一 PID 字段非 null 或任一 PID 文件存在的 BLOCKED fixture 调用 `cleanupRun()`；断言拒绝 `cleanup requires STOPPED state`。

## 6. 固定验证命令与独立 oracle【状态：[VERIFIED][PASS：25/25]】

禁止并行执行下列测试，避免 SQLite 写入互相影响：

```bash
TMPDIR=/tmp XDG_STATE_HOME=/tmp/qoderwork-tsi04 \
  /home/zhaoge/.bun/bin/bun test \
  scripts/test-serve/__tests__/bootstrap.test.ts \
  scripts/test-serve/__tests__/bootstrap-import-source.test.ts \
  scripts/test-serve/__tests__/process.test.ts \
  scripts/test-serve/__tests__/cleanup.test.ts \
  scripts/test-serve/__tests__/execute.test.ts

/home/zhaoge/.bun/bin/bun run scripts/test-serve/isolated-serve.ts bootstrap \
  --run-dir /tmp/no-run --allowed-paths /tmp/x
```

本轮复审结果：第一条命令 25/25 PASS；第二条命令退出码为 1，stderr 精确包含 `missing required arg --child-agent`，且未创建目标 run（2026-07-17 审计复跑：全量 37/37 PASS、CLI 契约不变）。Section 9 cleanup 契约已收口；runtime smoke 因 Section 9.6 的确定性集成与 runtime gate 未执行而保持 `NOT-RUN`。

## 7. 审核通过清单【状态：[VERIFIED][COMPONENT-PASS：37/37]】

- [x] production-success 测试通过：真实 isolated worktree `createGrant/bindGrant`、两次本地 HTTP session、只读 DB bound oracle 三者同时成立。
- [x] bind-null、DB-oracle-mismatch、child-session-failure、import-failure 都持久化 `BLOCKED` 后 reject；bind-null CLI exit=1。
- [x] 缺 child、路径 `..` 逃逸和 symlink 逃逸在任何 HTTP/DB/import 前拒绝，manifest 保持 READY。
- [x] 进程未确认退出时不清 PID；BLOCKED cleanup 仅在 PID 字段和 PID 文件均为空时允许。
- [x] dynamic import 回归继续证明来源是 isolated worktree，不是主 work-one。
- [x] 全部 test-serve 组件测试 37/37 PASS；create 阶段 release 失败持久化 BLOCKED、保留 PID/worktree 的回归已覆盖；runtime smoke、live LLM E2E 仍为 NOT-RUN。

## 8. 回滚【状态：[VERIFIED][NOT-TRIGGERED]】

若任一新增测试失败，保留其 `/tmp` failure artifact 到测试结束；仅回滚本方案列出的 `scripts/test-serve` 和对应文档变更。不得回滚 work-one 无关脏改动。回滚后重跑第 6 节组件命令；只有原有基线重新通过，才允许结束本轮。

## 9. P0-1 前置：cleanup evidence 留存契约收口实施步骤【状态：[VERIFIED][COMPONENT-COMPLETE][RUNTIME-NOT-RUN]】

### 9.1 问题裁决与实施边界【状态：[VERIFIED][RISK-CONFIRMED]】

**裁决**: 必须先完成本节并通过组件验证，再执行正式 P0-1 runtime smoke；但当前缺口不是“cleanup 已经删除了全部 evidence”的生产故障，而是 Blueprint、CLI 输出和显式回归断言未形成同一契约。

当前 live 代码证据：

1. `createRunPaths()` 将 `manifest.json`、双 DB、logs、events、artifacts 与 `cleanup-report.json` 放在 `<state-root>/<run-id>/`；`worktreeDir` 只是该目录下的一个子目录。
2. `cleanupRun()` 当前仅对 `manifest.paths.worktreeDir` 执行 `git worktree remove --force` 和本地 `rmSync()`，没有删除 `manifest.paths.rootDir`。
3. cleanup 成功后，函数在 `<run>/cleanup-report.json` 写报告，再把 `<run>/manifest.json` 更新为 `CLEANED`。
4. 当前 success 组件测试已在 cleanup 返回后重新读取 manifest 和 cleanup report；本轮复审实跑为 4/4 PASS。
5. 冲突来自 Blueprint 的“移除 worktree 和 run 目录”表述；若未来实施者按该文字增加 `rmSync(rootDir)`，P0-1 所需 manifest、双 DB、SSE/log、PID、artifacts 与 cleanup report 会一起丢失。

**固定边界**:

```text
cleanup success
  -> archive framework logs into <run>/artifacts/framework-logs
  -> remove only <run>/worktree
  -> write <run>/cleanup-report.json
  -> write <run>/manifest.json status=CLEANED
  -> return retained evidence paths
  -> keep <run>/ as the immutable runtime evidence bundle

cleanup failure
  -> write <run>/cleanup-report.json success=false
  -> write <run>/manifest.json status=BLOCKED
  -> keep <run>/worktree when it still exists
  -> return retained evidence paths + failure details
```

禁止在 `cleanupRun()`、CLI cleanup 分支或 cleanup 测试中删除 `manifest.paths.rootDir`。本任务不新增第二个 evidence root、不复制单个 report 到目录外、不新增 purge 命令；run evidence 的后续保留期限不在本 P0 前置范围内。

### 9.2 方案对比与唯一选择【状态：[VERIFIED][DECIDED]】

| 方案 | 核心行为 | 与当前代码一致性 | 风险 | 结论 |
|---|---|---:|---|---|
| A：保留 run root，只删除 worktree | `<run>/` 作为 evidence bundle，cleanup 只回收 worktree | 高 | evidence 占用磁盘，后续另设 retention 策略 | **采用** |
| B：复制全部 evidence 到第二目录后删除 run root | cleanup 跨两个目录复制、校验、删除 | 低 | 双控制面、复制中断、hash/容量/原子性复杂 | 否决 |
| C：仅把 cleanup report 复制到目录外 | 删除其余 manifest/DB/log/event | 低 | report 无法独立证明完整 runtime | 否决 |

唯一选择方案 A。它复用现有 `RunPaths.rootDir`、`writeRunManifest()`、`cleanupReportPath` 和 `artifactsDir`，不引入新状态根或新清理系统。

### 9.3 不可变完成契约【状态：[VERIFIED][COMPONENT-COMPLETE]】

完成本前置必须同时满足：

1. cleanup 成功后：
   - `manifest.paths.rootDir` 存在；
   - `manifest.paths.worktreeDir` 不存在；
   - `manifest.paths.manifestPath`、`cleanupReportPath`、`artifactsDir` 仍可读取；
   - manifest 为 `status='CLEANED'`、`cleanup.status='completed'`；
   - cleanup report 为 `success=true`、`worktreeRemoved=true`，并记录 retained evidence 路径。
2. cleanup 失败后：
   - manifest 为 `status='BLOCKED'`、`cleanup.status='blocked'`；
   - cleanup report 为 `success=false`，记录 stage/exitCode/stdout/stderr/rmError；
   - rootDir 与可用 evidence 保留；worktree 是否存在必须由 `worktreeRemoved` 的实际值表达，不得伪造。
3. `cleanupRun()` 的 success 和 failure 返回值都包含：`evidenceRoot`、`manifestPath`、`cleanupReportPath`、`artifactsDir`。
4. CLI success/failure JSON 都打印上述四条路径；调用者无需根据内部目录布局猜测证据位置。
5. 任一 evidence 文件写入或 manifest 终态写入失败时，CLI 非零退出；不得输出 `CLEANED` 成功 JSON。
6. 本节组件验证通过前，P0-1 runtime smoke 保持 `NOT-RUN`。

### 9.4 文件变更清单【状态：[VERIFIED][7/7-FILES-CLOSED]】

| 顺序 | 文件 | 变更 | 完成条件 |
|---:|---|---|---|
| 1 | `scripts/test-serve/types.ts` | 修改 | `CleanupResult` 两个分支都暴露 retained evidence 路径 |
| 2 | `scripts/test-serve/isolated-serve.ts` | 修改 | cleanup 只删除 `manifest.paths.worktreeDir`；report 与 CLI 输出包含 evidence 路径 |
| 3 | `scripts/test-serve/__tests__/cleanup.test.ts` | 修改 | success/failure 显式断言 root/report/manifest/artifacts 留存与 worktree 边界 |
| 4 | `blueprints/blueprint-isolated-serve-test-infrastructure.md` | 修改 | 将“移除 worktree 和 run 目录”改为“只移除 worktree，保留 run evidence bundle” |
| 5 | `e2e/current-version-runtime-smoke-test-spec.md` | 修改 | 组件验证通过后关闭 `OPEN-RSM-01`，保留 RSM-007 的 artefact oracle |
| 6 | `plans/隔离 serve 测试基建待办/01-bootstrap-child-grant-fail-closed实施步骤.md` | 更新 | 勾选本节成功标准并记录真实测试数量 |
| 7 | `logs/2026-07-17-cleanup-evidence-retention.md` | 新建 | 20 行内记录为什么保留 run root、改动文件、验证与否决方案 |

不得修改 work-one 业务代码、DB schema、serve API、bootstrap grant 逻辑或 H2 gate。

### 9.5 可复制实施步骤【状态：[VERIFIED][S0-S7-COMPLETE]】

以下步骤必须在 `/home/zhaoge/workspace/qoderwork` 执行，不得并行运行测试。

#### S0：冻结基线【状态：[VERIFIED][PASS：4/4]】

```bash
cd /home/zhaoge/workspace/qoderwork
git status --short
TMPDIR=/tmp XDG_STATE_HOME=/tmp/qoderwork-cleanup-retention \
  /home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/cleanup.test.ts
```

本轮复审基线为 4/4 PASS。未来实施时仍须重新执行；失败则停止，不修改文件，并把原始输出记录为 `BLOCKED: cleanup baseline failed`。

#### S1：扩展 `CleanupResult` 的固定证据返回契约【状态：[VERIFIED][COMPLETE]】

在 `scripts/test-serve/types.ts` 中，用下列定义完整替换现有 `CleanupResult`：

```ts
export type CleanupResult = {
  runId: string;
  archivedLogs: string | null;
  evidenceRoot: string;
  manifestPath: string;
  cleanupReportPath: string;
  artifactsDir: string;
} & (
  | { ok: true }
  | {
      ok: false;
      exitCode: number;
      stderr: string;
      stdout: string;
    }
);
```

不得把这些字段设为可选；success 和 failure 都必须返回同一组定位信息。

#### S2：固定 `cleanupRun()` 的删除边界与 report schema【状态：[VERIFIED][COMPLETE]】

（收口前基线：当时仅“只删除 worktree、保留 run root”的行为成立，`evidence`、`reportBase`、`worktreeRemoved` 与统一返回路径均未实现；2026-07-17 已按下列步骤全部落地并通过组件验证。）

在 `scripts/test-serve/isolated-serve.ts` 的 `cleanupRun()` 中，读取 manifest 后立即定义：

```ts
const evidence = {
  evidenceRoot: manifest.paths.rootDir,
  manifestPath: manifest.paths.manifestPath,
  cleanupReportPath: manifest.paths.cleanupReportPath,
  artifactsDir: manifest.paths.artifactsDir,
};
```

把：

```ts
const worktreeRoot = join(manifest.paths.rootDir, "worktree");
```

替换为：

```ts
const worktreeRoot = manifest.paths.worktreeDir;
```

删除 `join` 的其他引用后，若该文件已不再使用 `join`，把 import 从：

```ts
import { join, resolve } from "node:path";
```

改为：

```ts
import { resolve } from "node:path";
```

在清理动作结束后、成功/失败分支之前定义实际结果：

```ts
const worktreeRemoved = !existsSync(manifest.paths.worktreeDir);
const reportBase = {
  schemaVersion: 1,
  runId: manifest.runId,
  cleanedAt,
  ...evidence,
  worktreeDir: manifest.paths.worktreeDir,
  worktreeRemoved,
  archivedLogs,
};
```

成功 report 的 JSON 对象固定替换为：

```ts
{
  ...reportBase,
  success: true,
}
```

失败 report 的 JSON 对象固定替换为：

```ts
{
  ...reportBase,
  success: false,
  stage: gitFailed ? "git-worktree-remove" : "local-rm",
  exitCode: spawnResult.exitCode,
  command: ["git", "worktree", "remove", "--force", manifest.paths.worktreeDir],
  cwd: manifest.primaryWorktree,
  stdout: spawnResult.stdout,
  stderr: spawnResult.stderr,
  rmError,
}
```

成功返回值固定为：

```ts
return {
  ok: true,
  runId: manifest.runId,
  archivedLogs,
  ...evidence,
};
```

失败返回值在现有字段后追加：

```ts
...evidence,
```

不得新增任何 `rmSync(manifest.paths.rootDir, ...)`、`rmSync(runDir, ...)` 或等价递归删除；`removeWorktreeDir` 只能接收 `manifest.paths.worktreeDir`。

#### S3：让 CLI 输出可直接定位 evidence【状态：[VERIFIED][COMPLETE]】

把 cleanup success 输出替换为：

```ts
console.log(
  JSON.stringify(
    {
      runId: result.runId,
      status: "CLEANED",
      evidenceRoot: result.evidenceRoot,
      manifestPath: result.manifestPath,
      cleanupReportPath: result.cleanupReportPath,
      artifactsDir: result.artifactsDir,
    },
    null,
    2,
  ),
);
```

在 cleanup failure 的现有 JSON 对象中追加：

```ts
evidenceRoot: result.evidenceRoot,
manifestPath: result.manifestPath,
cleanupReportPath: result.cleanupReportPath,
artifactsDir: result.artifactsDir,
```

failure 分支仍必须 `process.exit(1)`，不得因已保存 report 而返回 0。

#### S4：补强 cleanup 组件测试【状态：[VERIFIED][COMPLETE]】

（收口前基线：当时 4 个 cleanup 用例仅覆盖成功删除 worktree、两类失败 `BLOCKED` 与非法状态拒绝；本节要求的四条返回路径、retained artifact 和 `worktreeRemoved` schema 已于 2026-07-17 补齐并通过组件验证。）

在 success fixture 创建 `artifactsDir` 后新增：

```ts
const retainedArtifact = join(artifactsDir, "runtime-evidence.json");
writeFileSync(retainedArtifact, '{"retained":true}\n');
```

在 success 调用 `cleanupRun()` 后追加全部断言：

```ts
expect(existsSync(rootDir)).toBe(true);
expect(existsSync(paths.worktreeDir)).toBe(false);
expect(existsSync(paths.manifestPath)).toBe(true);
expect(existsSync(paths.cleanupReportPath)).toBe(true);
expect(existsSync(paths.artifactsDir)).toBe(true);
expect(existsSync(retainedArtifact)).toBe(true);
expect(result.evidenceRoot).toBe(rootDir);
expect(result.manifestPath).toBe(paths.manifestPath);
expect(result.cleanupReportPath).toBe(paths.cleanupReportPath);
expect(result.artifactsDir).toBe(paths.artifactsDir);
```

把 success report 类型与断言扩展为：

```ts
const report = JSON.parse(
  await Bun.file(paths.cleanupReportPath).text(),
) as {
  success: boolean;
  evidenceRoot: string;
  manifestPath: string;
  cleanupReportPath: string;
  artifactsDir: string;
  worktreeDir: string;
  worktreeRemoved: boolean;
};

expect(report.success).toBe(true);
expect(report.evidenceRoot).toBe(rootDir);
expect(report.manifestPath).toBe(paths.manifestPath);
expect(report.cleanupReportPath).toBe(paths.cleanupReportPath);
expect(report.artifactsDir).toBe(paths.artifactsDir);
expect(report.worktreeDir).toBe(paths.worktreeDir);
expect(report.worktreeRemoved).toBe(true);
```

在 `git worktree remove exits non-zero` 和 `local rm fails` 两个失败用例中分别追加：

```ts
expect(existsSync(rootDir)).toBe(true);
expect(existsSync(paths.manifestPath)).toBe(true);
expect(existsSync(paths.cleanupReportPath)).toBe(true);
expect(result.evidenceRoot).toBe(rootDir);
```

并断言失败 report 的 `evidenceRoot===rootDir`、`worktreeRemoved===false`。若某个故障注入实际删除了 worktree，则该用例必须按真实 `existsSync(worktreeDir)` 值断言，禁止硬编码与现场不符的结果。

#### S5：先同步 cleanup 权威契约【状态：[VERIFIED][COMPLETE]】

1. 将 `blueprints/blueprint-isolated-serve-test-infrastructure.md` §2.3 第 6 条替换为：

```md
6. `test-serve cleanup` 只有在 stop 成功后才能移除 `manifest.paths.worktreeDir`；`manifest.paths.rootDir` 是持久 runtime evidence bundle，必须保留其中的 manifest、双 DB、logs、events、artifacts 与 `cleanup-report.json`。失败时额外保留仍存在的 worktree，并写 `BLOCKED` cleanup report。删除历史 evidence 不属于 cleanup 命令职责。
```

2. 此时不得删除 `e2e/current-version-runtime-smoke-test-spec.md` 中的 `OPEN-RSM-01`；只有 S6 组件验证全部通过后才能按 S7 关闭。

#### S6：固定验证命令【状态：[VERIFIED][PASS：37/37]】

按顺序执行，任一步失败立即停止：

```bash
cd /home/zhaoge/workspace/qoderwork

TMPDIR=/tmp XDG_STATE_HOME=/tmp/qoderwork-cleanup-retention \
  /home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/cleanup.test.ts

TMPDIR=/tmp XDG_STATE_HOME=/tmp/qoderwork-cleanup-retention \
  /home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__

if rg -n 'rmSync\((manifest\.paths\.rootDir|runDir)' scripts/test-serve/isolated-serve.ts; then
  echo 'FAIL: cleanup code can delete run evidence root' >&2
  exit 1
fi

rg -n 'evidenceRoot|manifestPath|cleanupReportPath|artifactsDir|worktreeRemoved' \
  scripts/test-serve/types.ts \
  scripts/test-serve/isolated-serve.ts \
  scripts/test-serve/__tests__/cleanup.test.ts

git diff --check -- \
  scripts/test-serve/types.ts \
  scripts/test-serve/isolated-serve.ts \
  scripts/test-serve/__tests__/cleanup.test.ts \
  blueprints/blueprint-isolated-serve-test-infrastructure.md

for task_file in \
  scripts/test-serve/types.ts \
  scripts/test-serve/isolated-serve.ts \
  scripts/test-serve/__tests__/cleanup.test.ts \
  blueprints/blueprint-isolated-serve-test-infrastructure.md; do
  if git diff --no-index --check /dev/null "$task_file" 2>&1 | \
    rg 'trailing whitespace|space before tab|new blank line at EOF'; then
    echo "FAIL: whitespace error in $task_file" >&2
    exit 1
  fi
done
```

通过条件：

- cleanup 定向测试全通过；
- `scripts/test-serve/__tests__` 全量组件测试全通过，记录真实 pass/fail 数量，不沿用旧数字；
- run-root 删除扫描零命中；
- evidence 字段在类型、实现和测试三处都有命中；
- `git diff --check` 无输出且退出码为 0。

复审说明：本轮 cleanup 定向测试 4/4、全量组件测试 37/37 PASS，生产 cleanup 文件的 run-root 删除扫描为零命中；evidence 字段与 schema 门禁未满足。扫描范围已从整个 `scripts/test-serve/` 收窄到生产文件，避免把 `create-failure-cleanup.test.ts` 的合法 fixture teardown `rmSync(runDir)` 误判为生产风险。

#### S7：组件验证通过后关闭 OPEN 并记录【状态：[VERIFIED][COMPLETE]】

只有 S6 全部通过后才能执行：

1. 更新 `e2e/current-version-runtime-smoke-test-spec.md`：
   - 删除 `OPEN-RSM-01`；
   - 把 RSM-007 oracle 固定为 cleanup 后 `rootDir` 存在、worktree 不存在、manifest/report/artifacts 可读；
   - 把质量门禁 `OPEN / BLOCKED` 更新为 `0 / 0`；
   - 保持 runtime smoke 为 `DESIGNED/NOT-RUN`，不得写 PASS。
2. 更新本节状态与成功标准，写入 S6 的真实 pass/fail 数量。
3. 新增 `logs/2026-07-17-cleanup-evidence-retention.md`，控制在 20 行内，记录采用方案 A、否决 B/C、修改文件与验证结果。
4. 执行最终文档门禁：

```bash
cd /home/zhaoge/workspace/qoderwork

if rg -n 'OPEN-RSM-01' e2e/current-version-runtime-smoke-test-spec.md; then
  echo 'FAIL: cleanup evidence risk is still OPEN after component closure' >&2
  exit 1
fi

git diff --check -- \
  blueprints/blueprint-isolated-serve-test-infrastructure.md \
  e2e/current-version-runtime-smoke-test-spec.md \
  'plans/隔离 serve 测试基建待办/01-bootstrap-child-grant-fail-closed实施步骤.md' \
  logs/2026-07-17-cleanup-evidence-retention.md

for task_file in \
  blueprints/blueprint-isolated-serve-test-infrastructure.md \
  e2e/current-version-runtime-smoke-test-spec.md \
  'plans/隔离 serve 测试基建待办/01-bootstrap-child-grant-fail-closed实施步骤.md' \
  logs/2026-07-17-cleanup-evidence-retention.md; do
  if git diff --no-index --check /dev/null "$task_file" 2>&1 | \
    rg 'trailing whitespace|space before tab|new blank line at EOF'; then
    echo "FAIL: whitespace error in $task_file" >&2
    exit 1
  fi
done
```

S7 完成后才允许进入第 9.6 节的确定性集成与 runtime gate。

### 9.6 三层验证与 runtime gate【状态：[VERIFIED][COMPONENT-PASS：37/37/INTEGRATION-AND-RUNTIME-NOT-RUN]】

#### 单元/组件【状态：[VERIFIED][4/4-COMPONENT-CRITERIA]】

- [x] `[VERIFIED]` success：root/manifest/report/artifacts 保留且 worktree 删除；retained artifact 哨兵、report schema（evidenceRoot/worktreeRemoved）与返回路径一致性已断言。
- [x] `[VERIFIED]` git remove failure：`BLOCKED`、report 含 stderr、root 与现场保留。evidenceRoot 断言已补。
- [x] `[VERIFIED]` local rm failure：`BLOCKED`、stage=`local-rm`、实际 worktree 状态与 report 一致。evidenceRoot 断言已补。
- [x] `[VERIFIED]` 非 STOPPED 且不满足 bootstrap BLOCKED 例外时，cleanup 继续拒绝。

#### 确定性集成【状态：[NOT-RUN]】

- [ ] `[NOT-RUN]` 使用临时 Git repo + 真实 detached worktree 执行 cleanup；确认 Git worktree 列表不再含测试 worktree。
- [ ] `[NOT-RUN]` cleanup 后仍可读取 manifest、cleanup report、双 DB、SSE/log 和 artifacts。
- [ ] `[NOT-RUN]` 重复读取 evidence 不改变任何文件；本任务不要求重复 cleanup 成功。

#### runtime smoke【状态：[NOT-RUN][BLOCKED-BY-SECTION-9]】

- [ ] `[NOT-RUN]` 仅在组件与确定性集成均通过后，执行 P0-1 的 `create → start → bootstrap → execute(plan) → stop → cleanup`。
- [ ] `[NOT-RUN]` cleanup CLI 输出的四条 evidence 路径均存在且可读。
- [ ] `[NOT-RUN]` runtime 结果只关闭 P0-1；不得关闭 P0-2 deterministic integration 或 live LLM E2E。

### 9.7 子系统合规审计【状态：[VERIFIED][DESIGN-ONLY/IMPLEMENTATION-PENDING]】

下表的 `✅ 设计` 仅表示本方案没有扩大对应子系统边界，不表示 Section 9 已实施或 runtime 已验证。

| # | 子系统 | 状态 | 本方案约束 |
|---:|---|:---:|---|
| 1 | MVC Architecture | ✅ 设计 | CLI 只输出结果；cleanup 逻辑仍由 `cleanupRun()` 所有 |
| 2 | DB-only & DB-canonical | ✅ 设计 | 不改 DB schema；双 DB 作为 evidence 保留 |
| 3 | Permission Matrix | ✅ 设计 | 不改 agent/tool 权限 |
| 4 | Concurrency Safe | ✅ 设计 | 单 run 唯一路径；不引入第二 evidence root 或跨目录复制 |
| 5 | Hardened Enforcement | ✅ 设计 | 不改 H2、skill gate 或 hook |
| 6 | Framework Harness | ✅ 设计 | 复用现有 test-serve CLI、manifest 与 worktree cleanup |
| 7 | Central State Management | ✅ 设计 | manifest 继续是控制面；rootDir 是唯一 evidence bundle |
| 8 | Multi-Agent | ✅ 设计 | root/child/grant evidence 保留，不改调度 |
| 9 | Log Central Management | ✅ 设计 | framework logs 继续归档到 `<run>/artifacts/framework-logs` |
| 10 | DB-canonical Management | ✅ 设计 | 无 schema/migration；只保留现有 isolated DB 文件 |
| 11 | Templatization & Parameterization | ✅ 设计 | 全部路径来自 manifest，禁止新增固定目录 |
| 12 | TypeScript + Bun Runtime | ✅ 设计 | 仅扩展类型、JSON 与 Bun 测试，不引入依赖 |

### 9.8 回滚与成功标准【状态：[VERIFIED][7/7-COMPONENT-PASS]】

若任一验证失败：

1. 不运行 runtime smoke。
2. 保留失败测试的 `/tmp` 输出到本轮结束。
3. 仅用 `apply_patch` 逆向撤销本节列出的代码/文档改动；不得使用 `git reset --hard`、`git checkout --` 或覆盖整个脏工作区。
4. 重跑 S0 基线；只有恢复为原 4/4 PASS 才算回滚完成。
5. 在日志记录 first failure、回滚文件与恢复验证结果。

成功标准：

- [x] `[VERIFIED]` 当前 live 代码、Blueprint、测试式样书对 cleanup 删除边界表述一致。
- [x] `[VERIFIED]` cleanup success/failure 返回值均提供四条 retained evidence 路径。
- [x] `[VERIFIED]` success report 明确 `worktreeRemoved=true`，失败 report 记录实际值。
- [x] `[VERIFIED]` success cleanup 后 run root、manifest、report、artifacts 可读且 worktree 不存在。
- [x] `[VERIFIED][COMPONENT]` failure cleanup 为 `BLOCKED` 且现场/evidence 保留。
- [x] `[VERIFIED][COMPONENT]` 全量 test-serve 组件测试通过：37/37 PASS，0 FAIL。
- [x] `[VERIFIED][GATE]` runtime smoke 仍为 `NOT-RUN`，直到上述项目全部由 reviewer 勾选。
