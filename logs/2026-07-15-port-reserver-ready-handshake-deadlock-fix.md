# 修复 port-reserver READY 握手同步忙等导致 createRunContext 必然失败

**为什么**: `spawnPortReserver()` 里的 `readReadyLineSync()` 用同步 CPU busy-loop 等待子进程 stdout 的 `READY\n`。但是 Node.js 单线程模型下，主线程被同步循环占据时事件循环无法推进，`child.stdout.on("data")` 这个只有事件循环才能派发的回调永远不会被调度。结果是 `settled` 永远为 `false`，3500ms 后靠 wall-clock 超时跳出 → value=null → spawnPortReserver 抛 "no READY signal" → createRunContext 必然走失败分支。表现为超时退出，不是无限挂死，但工程语义上等价于自死锁。

**改了什么**:
- `scripts/test-serve/types.ts` — 新增 `ReadyResult` 类型：`{ ok: true } | { ok: false; reason: string; stderr: string }`
- `scripts/test-serve/run-context.ts`:
  - 删除 `readReadyLineSync()`（同步 busy-wait 实现）
  - 删除 `readChildStderr()`（同步 fd.read，流处于 flowing 模式时本就脆弱）
  - 新增 `waitForReadyLine(child, timeoutMs)`：Promise 封装 READY / exit / error / timeout 四类终态，握手窗口内累积 stderr buffer（EADDRINUSE 等错误原因不再丢失）
  - `spawnPortReserver()` 改为 `async function ... Promise<number>`，`await waitForReadyLine()`，失败分支读 `ready.stderr` / `ready.reason`
  - `createRunContext()` 改为 `async function ... Promise<RunManifest>`，`await spawnPortReserver()`
  - 恢复误删的 `releasePortReservation` export（`process.ts` 依赖它）
- `scripts/test-serve/isolated-serve.ts` — CLI `case "create"` 分支 `createRunContext(...)` 前加 `await`（main 已 async）
- `scripts/test-serve/__tests__/run-context.test.ts`:
  - 原 "writes manifest..." 测试改 `async`，结束时 `await releasePortReservation()` 释放端口
  - import 补上 `spawnPortReserver`、`releasePortReservation`、`net`
  - 新增测试 `create fails with clear message when port is already in use`：外部 net.createServer 占用端口后调 createRunContext，断言抛 "port already in use"
  - 新增测试 `spawnPortReserver holds the port until released`：三段断言（空闲→被占→释放后空闲）验证端口占位契约
  - 新增 `isPortListening(port)` helper（用 net.connect 探测，不与 reserver 抢端口）

**决策**:
- 选方案 3（async 化整条调用链）。方案 1（net.connect 探测）会回退到"先看再占"的竞态模型，不能实现"占位直到 serve 接管"的核心目标；方案 2（fs.readSync 读 pipe fd）技术上可行但平台细节脆弱、可读性差，只有在"绝不改 createRunContext 为 async"的硬约束下才值得考虑。
- async 传播面只有两个调用方（CLI case "create" + 单个测试），上抬成本极低，验证了"调用链顺势上抬不困难"的判断。
- 保留"真正物理占位端口"的设计：port-reserver 子进程 listen 成功才返 READY，拒绝 EADDRINUSE 立即带清晰错误消息退出。

**验证**: `bun test ./scripts/test-serve/__tests__/run-context.test.ts` — 7 pass / 0 fail / 12 expect() calls / 785ms（原有 5 个测试零回归 + 新增 2 个契约测试全绿）。

---

## 独立审核后追加补丁（同日）

**为什么**: 对初始修复做独立审核，发现两个 fail-closed 漏洞：
- **P1** STOPPED → start 重启路径不会重新保留端口。`startRunProcesses()` 在 portReserverPid 为 null 时跳过 release 步骤，直接裸 spawn serve，退回到无占位保护模型，端口在 STOPPED 窗口被抢占时 serve 会静默失败并最终 30s 超时。
- **P2** create 失败分支只发 SIGTERM 不等待退出（best-effort），git worktree add 或 overlay 失败后立即重试同一端口可能得到假性 EADDRINUSE。

**改了什么**:
- `scripts/test-serve/process.ts`:
  - import 追加 `spawnPortReserver`
  - `startRunProcesses()` 状态检查之后插入 STOPPED 分支：先 `await spawnPortReserver(manifest.port)` 重新占位，EADDRINUSE 时置 `manifest.status = "BLOCKED"`、cleanup.notes 追加原因并 re-throw，保证 fail-closed；后续 release→serve 原子交接与首次启动复用同一逻辑路径，无需 fork。
- `scripts/test-serve/run-context.ts`:
  - create catch 分支 `killPortReserver(portReserverPid)`（只发 SIGTERM）改为 `await releasePortReservation(portReserverPid)`（等待退出 + SIGKILL 兜底，确定性释放）
  - 删除已无引用的内部 `killPortReserver()` 函数
- `scripts/test-serve/__tests__/run-context.test.ts`:
  - import 追加 `setRunState`、`startRunProcesses`
  - 新增测试 `STOPPED -> start fails BLOCKED when port was stolen while stopped`：create → 释放端口 → 手工置 STOPPED → 外部抢占端口 → 断言 startRunProcesses 抛 "port already in use" 且 manifest.status 为 "BLOCKED"、cleanup.notes 含 "restart blocked"。**测试不启动真实 opencode serve**——断言点在 re-reserve 阶段抛错，到不了 spawn serve 那一步，所以不依赖 opencode 二进制存在。

**决策**:
- 保留 "STOPPED 是合法启动状态" 的语义，用重新占位方案修复，而不是砍掉 restart 路径。理由：STOPPED 状态在 CLI 中已被使用，砍掉会破坏上层清理流程；重新占位的代价极低（一次子进程 spawn + READY 握手 <50ms）。
- catch 分支用 releasePortReservation 而不是手工 SIGTERM+轮询：releasePortReservation 已处理 pid 不存在 / SIGKILL 升级 / 5s 超时兜底等边界，复用比重写安全。
- restart 竞态测试设计为"失败路径测试"：它只验证 BLOCKED 分支，不验证成功 restart（成功 restart 需要真实 opencode serve，属于更高层的 E2E 范畴）。

**验证**: `bun test ./scripts/test-serve/__tests__/run-context.test.ts` — 8 pass / 0 fail / 15 expect() calls / 907ms（原 7 个测试零回归 + restart 竞态测试 192ms 通过）。
