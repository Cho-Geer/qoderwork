# 可复用核心基础设施 — 函数清单

> 范围：仅覆盖 `scripts/` 下可复用核心基础设施（上一轮分类中的"排除项"），不含 `_` 前缀 ad-hoc 脚本、`*.test.ts` 与 `test-serve/__tests__/` 组件测试。
> 生成方式：逐文件 `read_file` + `ripgrep` 枚举函数签名与调用点（静态分析，未运行任何代码）。

## 范围与目录结构

```
scripts/
├── lib/                         # 基础客户端层（仅被外部 ad-hoc/live-E2E 脚本消费，详见§0）
│   ├── serve-api-client.ts
│   ├── sse-watcher.ts
│   └── types.ts                 # 仅类型/接口，无函数
├── test-serve/                  # 隔离 serve 测试运行单元（核心子系统）
│   ├── isolated-serve.ts        # CLI 入口
│   ├── run-context.ts           # 环境/清单/端口基础层
│   ├── process.ts               # 进程生命周期
│   ├── bootstrap.ts             # 会话 bootstrap
│   ├── execute.ts               # plan 执行
│   ├── cleanup.ts               # 清理
│   ├── oracle.ts                # SDK/框架 DB 只读 oracle
│   ├── port-reserver.ts         # 端口预留守护（被 spawn，不被 import）
│   ├── verify-p01b.ts           # P01B 验证 oracle
│   ├── verify-p02.ts            # P02 验证 oracle
│   ├── p01b-orchestrator.ts     # P01B 编排
│   ├── p02-orchestrator.ts      # P02 编排
│   ├── p02-sentinel.ts          # P02 sentinel 进程
│   └── types.ts                 # 仅类型/接口，无函数
└── *.ts (通用 CLI)              # clean-sessions / start-serve / guide / qoder-watcher /
                                 # deliver-guidance / intervene / session-tree / tree-watcher /
                                 # monitor-tree / sse-daemon
```

## §0 重要结构修正（相对原计划假设）

原计划假设"CLI 入口 → test-serve 中间层 → lib 基础层"的单一三层链。实际经 `ripgrep` 交叉验证：

- **`lib/serve-api-client.ts` 与 `lib/sse-watcher.ts` 仅被被排除的 `_b*` ad-hoc 脚本与 `live-*` E2E 脚本 import**；`test-serve/` 全部模块与通用 CLI **均不 import lib**（仅 serve-api-client 内部 import sse-watcher）。
- 因此 in-scope 复用基础设施实际由 **3 个互不相连的子图** 构成：
  1. **test-serve 子系统 DAG**（内部自包含，不依赖 lib）。
  2. **lib 子系统**（serve-api-client ↔ sse-watcher，对外仅被排除脚本消费）。
  3. **独立 CLI 叶子 + sse-daemon**（各自自包含，通过内联 `fetch` / `bun:sqlite` 直连 serve / DB，不依赖 lib 或 test-serve）。

调用链拓扑图（`callgraph-layered.md` / `callgraph-global.md`）据此忠实呈现，不再强行串联。

## 图例（调用边约定）

- `-->` 实线：直接调用（A 函数体内显式调用 B）
- `-.->` 虚线：间接调用（A→B→C 的传递链，或经由 spawn/回调/参数注入）
- 函数名采用 `文件#函数` 缩写（如 `iso#main` = `isolated-serve.ts` 的 `main`）。

---

# 1. lib/serve-api-client.ts

| 函数 | 功能描述 | 参数 | 返回值 |
|------|----------|------|--------|
| `httpJson(method, path, serveUrl, body?)` | 通用 serve API HTTP 封装（基于 `fetch`）。 | `method:string`、`path:string`、`serveUrl:string`、`body?:unknown` | `Promise<HttpResponse>`（`{status, ok, body}`） |
| `getSessionAgent(sid, serveUrl)` | 获取指定 session 的 agent 名。 | `sid:string`、`serveUrl:string` | `Promise<string>`（agent id） |
| `promptAsync(sid, text, serveUrl)` | 向 session 发送一条 prompt。 | `sid:string`、`text:string`、`serveUrl:string` | `Promise<void>` |
| `defaultReplier` (const arrow) | 默认问题回复器，使用空已知集与默认回复映射。 | `serveUrl:string` | `Promise<number>`（已回复问题数） |
| `pollAndReplyQuestionsWithMap(serveUrl, knownSids, replyMap)` | 轮询会话并自动回复 question 类事件。 | `serveUrl:string`、`knownSids:Set<string>`、`replyMap:Record<string,string>` | `Promise<number>` |
| `waitForIdle(sid, timeoutMs, sseFile, serveUrl, customReplier?, pollIntervalMs=2000)` | 基于 SSE 等待 session 空闲；可注入自定义回复器。 | `sid:string`、`timeoutMs:number`、`sseFile:string`、`serveUrl:string`、`customReplier?:QuestionReplier`、`pollIntervalMs?:number` | `Promise<WaitResult>`（`{idle:boolean,...}`） |
| `clientContextFromManifest(manifest)` | 从 run manifest 构造 serve 客户端上下文（纯函数）。 | `manifest:RunManifest` | `ServeClientContext` |

类型符号（非函数，作依赖叶子）：`HttpResponse`、`QuestionReplier`、`WaitResult`、`ServeClientContext`、`QUESTION_REPLY_DEFAULTS`。

# 2. lib/sse-watcher.ts

| 函数 | 功能描述 | 参数 | 返回值 |
|------|----------|------|--------|
| `SSEWatcherFd` 构造 | 基于文件描述符的 SSE 事件轮询器。 | `path:string` | 实例 |
| `SSEWatcherFd.poll(ms)` | 轮询并返回新增事件。 | `ms:number` | `any[]` |
| `SSEWatcherFd.reopen()` | 重新打开底层文件描述符。 | — | `void` |
| `SSEWatcherFd.close()` | 关闭 fd。 | — | `void` |
| `SSEWatcherFd.all()` | 返回全部已读事件。 | — | `any[]` |
| `SSEWatcherTail` 构造 | 基于文件尾读（tail）的轮询器。 | `path:string` | 实例 |
| `SSEWatcherTail.poll(ms)` | 轮询新增事件。 | `ms:number` | `any[]` |
| `SSEWatcherTail.close()` | 关闭 watcher。 | — | `void` |
| `SSEWatcherTail.all()` | 返回全部事件。 | — | `any[]` |
| `SSEWatcher` 构造 | 根据文件大小自动选择 fd 或 tail 实现的 SSE 轮询器。 | `path:string`、`sizeThreshold?:number`(默认 5MB) | 实例 |
| `SSEWatcher.registerCleanup()` | 注册进程退出时的清理钩子。 | — | `void` |
| `SSEWatcher.disableAutoCleanup()` | 禁用自动清理。 | — | `void` |
| `SSEWatcher.poll(ms)` | 委托底层实现轮询。 | `ms:number` | `any[]` |
| `SSEWatcher.close()` | 关闭底层实现。 | — | `void` |
| `SSEWatcher.all()` | 返回全部事件。 | — | `any[]` |

# 3. test-serve/run-context.ts（基础层）

导出函数：

| 函数 | 功能描述 | 参数 | 返回值 |
|------|----------|------|--------|
| `getDefaultPrimaryWorktree()` | 返回主 worktree 默认路径。 | — | `string` |
| `getStateRoot()` | 返回状态根目录。 | — | `string` |
| `createRunPaths(runId)` | 构造一次 run 的全部路径集合。 | `runId:string` | `RunPaths` |
| `makeRunId(testId)` | 由 testId 生成 runId。 | `testId:string` | `string` |
| `ensureRunDirectories(paths)` | 创建 run 目录结构。 | `paths:RunPaths` | `void` |
| `readRunManifest(runDirOrManifestPath)` | 读取 run manifest。 | `runDirOrManifestPath:string` | `RunManifest` |
| `writeRunManifest(manifest)` | 原子写入 manifest（rename）。 | `manifest:RunManifest` | `void` |
| `setRunState(manifest, status)` | 设置并写回 run 状态。 | `manifest:RunManifest`、`status:RunState` | `RunManifest` |
| `createRunContext(input, hooks?)` | 创建隔离 run 上下文（含端口预留、worktree 快照、manifest 落地）。 | `input:CreateRunInput`、`hooks?:CreateRunHooks` | `Promise<RunManifest>` |
| `snapshotSourceOverlay(input)` | 生成并校验源码覆盖快照（tar）。 | `input:SnapshotSourceInput` | `SourceOverlayMetadata` |
| `validateSourceOverlay(overlayDir)` | 校验覆盖快照完整性（sha256/条目）。 | `overlayDir:string` | `SourceOverlayMetadata` |
| `applySourceOverlay(worktreeDir, overlay)` | 将快照应用到 worktree。 | `worktreeDir:string`、`overlay:SourceOverlayMetadata` | `void` |
| `spawnPortReserver(port)` | spawn 端口预留守护进程。 | `port:number` | `Promise<number>`（pid） |
| `releasePortReservation(pid, dependencies?)` | 释放端口预留（kill 守护并等待退出）。 | `pid:number`、`dependencies?` | `Promise<void>` |
| `sha256File(path)` | 计算文件 sha256。 | `path:string` | `string` |
| `archiveFrameworkLogs(worktreeDir, artifactsDir)` | 归档 framework 日志到 artifacts。 | `worktreeDir:string`、`artifactsDir:string` | `string \| null` |

模块内私有辅助（被上述导出函数调用）：`buildRunEnvironment`、`resolveRequiredDir`、`ensurePortAvailable`、`waitForReadyLine`、`waitForProcessExit`、`sleepAsync`、`ensureGitCommit`、`ensureAllowedOverlayPath`、`git`、`readOverlayManifest`、`cleanupFailedCreate`、`readTarEntries`、`readTarEntry`、`sanitizeSlug`。

# 4. test-serve/process.ts（进程生命周期）

| 函数 | 功能描述 | 参数 | 返回值 |
|------|----------|------|--------|
| `startRunProcesses(deps?)` | 启动 run 子进程（serve + 端口预留），标记健康。 | `deps?:StartRunProcessesDependencies` | `Promise<RunManifest>` |
| `inspectRunProcesses(runDir)` | 检查 run 进程状态/健康标记。 | `runDir:string` | `{...}` |
| `stopRunProcesses(deps?)` | 停止 run 子进程并置状态。 | `deps?:StopRunProcessesDependencies` | `Promise<RunManifest>` |
| `readValidSseReadyMarker(manifest)` | 读取 SSE ready 标记是否有效。 | `manifest:RunManifest` | `boolean` |
| `validateRunProcess(pid, runId, commandFragment)` | 校验进程是否符合预期。 | `pid:number\|null`、`runId:string`、`commandFragment:string` | `boolean` |
| `resolveOpencodeBin()` | 解析 opencode 可执行路径。 | — | `string` |
| `waitForHealth(port, timeoutMs)` | 等待 serve 健康。 | `port:number`、`timeoutMs:number` | `Promise<boolean>` |
| `canReachHealth(port)` | 探测端口是否可连通。 | `port:number` | `boolean` |
| `waitForExit(pid, timeoutMs)` | 等待进程退出。 | `pid:number`、`timeoutMs:number` | `Promise<boolean>` |
| `sleep(ms)` | 异步休眠。 | `ms:number` | `Promise<void>` |
| `isPortListening(port)` | 判断端口是否监听。 | `port:number` | `Promise<boolean>` |

# 5. test-serve/bootstrap.ts（会话 bootstrap）

| 函数 | 功能描述 | 参数 | 返回值 |
|------|----------|------|--------|
| `waitForSessionBarrier(input, deps?)` | 等待 session 满足 barrier（事件文件/sessionMap/sdk 父子关系）。 | `input:WaitBarrierInput`、`deps?:WaitBarrierDependencies` | `Promise<WaitResult>` |
| `bootstrapRun(input, dependencies?)` | 创建子 session 并 bootstrap（调用 createSession/loadPrivilegeService）。 | `input:BootstrapInput`、`dependencies?:BootstrapDependencies` | `Promise<RunManifest>` |
| `loadPrivilegeService(manifest)` | 从 manifest 加载权限服务实例。 | `manifest:RunManifest` | `Promise<PrivilegeService>` |
| `checkEventFile(eventFilePath, sessionId)` | 检查事件文件是否含指定 session。 | `eventFilePath:string`、`sessionId:string` | `boolean` |
| `checkSessionMap(frameworkDbPath, sessionId)` | 检查 sessionMap 表是否含指定 session。 | `frameworkDbPath:string`、`sessionId:string` | `boolean` |
| `checkSdkDbParent(opencodeDbPath, sessionId, parentSessionId)` | 检查 SDK DB 父子关系。 | `opencodeDbPath:string`、`sessionId:string`、`parentSessionId:string` | `boolean` |
| `createSession(manifest, ...)` | spawn 子 opencode session 进程。 | `manifest:RunManifest` | `Promise<...>` |
| `withRunEnvironment(manifest, fn)` | 在 run 环境（env）中执行 fn。 | `manifest:RunManifest`、`fn:()=>T` | `T` |
| `assertGrantBound(manifest, grantId, childSessionId)` | 断言 grant 已绑定到子 session。 | `manifest:RunManifest`、`grantId:string`、`childSessionId:string` | `void` |
| `normalizeAllowedPaths(worktreeDir, inputPaths)` | 归一化允许路径（绝对化/校验）。 | `worktreeDir:string`、`inputPaths:string[]` | `string[]` |

# 6. test-serve/execute.ts

| 函数 | 功能描述 | 参数 | 返回值 |
|------|----------|------|--------|
| `executeRun(input)` | 以 plan 模式执行 run（spawn opencode serve 进入 plan 执行）。 | `input:ExecuteInput` | `Promise<{...}>` |

# 7. test-serve/cleanup.ts

| 函数 | 功能描述 | 参数 | 返回值 |
|------|----------|------|--------|
| `cleanupRun(input, deps?)` | 归档日志并清理 run（置状态、写回 manifest）。 | `input:CleanupInput`、`deps?:CleanupDependencies` | `Promise<RunManifest>` |

# 8. test-serve/oracle.ts（SDK/框架 DB 只读 oracle）

| 函数 | 功能描述 | 参数 | 返回值 |
|------|----------|------|--------|
| `openReadonly(dbPath)` | 以只读方式打开 SQLite DB（失败返回 null）。 | `dbPath:string` | `Database \| null` |
| `findSessionEvent(eventFilePath, sessionId)` | 事件文件是否含指定 session 事件。 | `eventFilePath:string`、`sessionId:string` | `boolean` |
| `sdkSessionExists(dbPath, sessionId)` | SDK DB 是否含指定 session。 | `dbPath:string`、`sessionId:string` | `boolean` |
| `sessionMapExists(dbPath, sessionId)` | sessionMap 表是否含指定 session。 | `dbPath:string`、`sessionId:string` | `boolean` |
| `grantExists(dbPath, grantId)` | grant 记录是否存在。 | `dbPath:string`、`grantId:string` | `boolean` |
| `grantBoundTo(dbPath, grantId, childSessionId)` | grant 是否绑定到子 session。 | `dbPath:string`、`grantId:string`、`childSessionId:string` | `boolean` |

# 9. test-serve/port-reserver.ts（被 spawn 的端口守护，不被 import）

| 函数 | 功能描述 | 参数 | 返回值 |
|------|----------|------|--------|
| `main` / 模块顶层 | 监听 TCP 端口并写 ready 标记，保持占用。 | 命令行参数（port） | 长时间运行进程 |
| `gracefulShutdown()` | SIGINT/SIGTERM 优雅退出。 | — | `void` |

> 注：本文件通过 `child_process.spawn` 由 `run-context#spawnPortReserver` 拉起，不在 import 图中。

# 10. test-serve/verify-p01b.ts

| 函数 | 功能描述 | 参数 | 返回值 |
|------|----------|------|--------|
| `verifyP01b(input, phase)` | P01B 阶段验证（运行时/清理检查 + oracle 断言）。 | `input:P01BVerifyInput`、`phase:P01BPhase` | `P01BVerificationResult` |
| `checkRuntimeChecks(manifest)` | 运行时检查集合。 | `manifest:RunManifest` | `boolean` |
| `checkCleanupChecks(manifest)` | 清理检查集合。 | `manifest:RunManifest` | `boolean` |
| `querySdkDbParent(manifest, childSessionId)` | 查询 SDK DB 父子关系。 | `manifest:RunManifest`、`childSessionId:string` | `...` |

# 11. test-serve/verify-p02.ts

导出：

| 函数 | 功能描述 | 参数 | 返回值 |
|------|----------|------|--------|
| `verifyP02(input, phase)` | P02 阶段验证（进程/sentinel/marker/DB tri-state 断言）。 | `input:P02VerifyInput`、`phase:P02Phase` | `P02VerificationResult` |
| `RUN_PATH_FIELDS` (const) | 路径字段清单（数据，非函数）。 | — | `string[]` |

模块内私有辅助：`isProcessAlive`、`readSentinelAlive`、`startChecksAllTrue`、`safeReadManifest`、`cleanupReportSuccess`、`reportReadable`、`reportSuccess`、`markerIdentityOk`、`defaultProcessReader`、`defaultMarkerReader`、`queryTriState`、`tableAvailable`、`sdkSessionState`、`sessionMapState`、`grantState`、`eventsReadable`、`eventSessionState`、`pathContained`、`defaultPortOwnerReader`。

# 12. test-serve/p01b-orchestrator.ts

| 函数 | 功能描述 | 参数 | 返回值 |
|------|----------|------|--------|
| `runP01b(input, deps?)` | P01B 编排：`createRunContext→bootstrapRun→executeRun→startRunProcesses→(verifyP01b)→stopRunProcesses→cleanupRun`。 | `input:P01BInput`、`deps?:P01BDependencies` | `Promise<RunManifest>` |
| `validateInput(input)` | 校验编排输入。 | `input:P01BInput` | `void` |
| `canVerifyRunProcesses(manifest)` | 判断是否可验证 run 进程。 | `manifest:RunManifest` | `boolean` |
| `defaultWriteStageResults(artifactsDir, payload)` | 默认阶段结果落盘。 | `artifactsDir:string`、`payload:P01BStageResultsFile` | `void` |
| `defaultValidateRunProcess(manifest, childSessionId)` | 默认 run 进程校验。 | `manifest:RunManifest`、`childSessionId:string` | `boolean` |

# 13. test-serve/p02-orchestrator.ts

| 函数 | 功能描述 | 参数 | 返回值 |
|------|----------|------|--------|
| `runP02(input, deps?)` | P02 编排：sentinel 生命周期 + `createRunContext→bootstrapRun→executeRun→startRunProcesses→stopRunProcesses→verifyP02→cleanupRun`。 | `input:P02Input`、`deps?:P02Dependencies` | `Promise<RunManifest>` |
| `validateInput(input)` | 校验 P02 输入。 | `input:P02Input` | `void` |
| `defaultWriteStageResults(artifactsDir, payload)` | 默认阶段结果落盘。 | `artifactsDir:string`、`payload:P02StageResultsFile` | `void` |
| `defaultObserveCleanupB(runB, sentinelMarkerPath)` | 观察 cleanup-B 行为。 | `runB:RunManifest`、`sentinelMarkerPath:string` | `P02CleanupBObservation` |
| `isPidAlive(pid)` | 判断 PID 是否存活。 | `pid:number` | `boolean` |
| `ensureFrameworkDb(dbPath)` | 确保 framework DB 存在。 | `dbPath:string` | `void` |

# 14. test-serve/p02-sentinel.ts

| 函数 | 功能描述 | 参数 | 返回值 |
|------|----------|------|--------|
| `startSentinel(input, opts?)` | 启动 sentinel 进程并写 marker。 | `input:SentinelInput`、`opts?:SentinelOptions` | `Promise<SentinelHandle>` |
| `stopSentinel(handle)` | 停止 sentinel 进程。 | `handle:SentinelHandle` | `Promise<void>` |
| `validateSentinelIdentity(m, manifest)` | 校验 sentinel marker 身份一致性。 | `m:P02MarkerState`、`manifest:RunManifest` | `boolean` |
| `finalizeSentinelMarker(m, manifest)` | 固化 sentinel marker 终态。 | `m:P02MarkerState`、`manifest:RunManifest` | `void` |

# 15. test-serve/isolated-serve.ts（CLI 入口）

| 函数 | 功能描述 | 参数 | 返回值 |
|------|----------|------|--------|
| `main()` | CLI 入口：解析子命令（`create/start/bootstrap/execute/verify/p0-1b/stop/cleanup/status/inspect`），分派到 test-serve 模块函数。 | 命令行 `process.argv` | `Promise<void>` |
| `requiredArg(args, name)` | 取必填参数，缺失抛错。 | `args:Record<string,string\|undefined>`、`name:string` | `string` |
| `getArg(args, name, fallback?)` | 取可选参数。 | `args`、`name`、`fallback?` | `string \| undefined` |
| `hasFlag(args, name)` | 判断 flag 是否存在。 | `args`、`name` | `boolean` |
| `collectTailArgs(argv)` | 收集尾部透传参数。 | `argv:string[]` | `string[]` |
| `printHelp()` | 打印帮助并退出。 | — | `void` |

# 16. 通用 CLI（独立叶子，自包含）

| 文件 | 主要函数/结构 | 说明 |
|------|---------------|------|
| `clean-sessions.ts` | 模块顶层执行（内联 `const cleanTable = (...)` 闭包） | 清理 OpenCode 残留 session；只读 SQLite，不调用 lib/test-serve。 |
| `start-serve.ts` | `main`、`parseArgs`、`loadEnv`、`isWSL`、`resolveWorkDir`、`resolveOpencodeBin`、`cleanBunCache`、`stopDaemon`、`stopOrphanServe`、`checkPortConflict` | 启动 opencode serve；自包含。 |
| `guide.ts` | `main`、`argvStr`、`flag`、`serveGet`、`servePost`、`resolveAgent`、`sendGuidance`、`syncWait` | 向 agent 发送 guidance；内联 `fetch`。 |
| `qoder-watcher.ts` | `main`、`parseArgs`、`loadJSONL`、`isFailure`、`isWrite`、`evaluate` | 监听 JSONL 事件评估；自包含。 |
| `deliver-guidance.ts` | 模块顶层执行（无函数声明） | 投递 guidance；内联 `fetch`/DB，自包含。 |
| `intervene.ts` | `main`、`argvStr`、`serveGet`、`servePost`、`modeGuide`、`modeReply`、`modeAbort`、`modeStatus` | 人工干预 CLI；内联 `fetch`。 |
| `session-tree.ts` | `main`、`argv`、`flag`、`serveGet`、`dbFallbackChildren`、`buildTree`、`renderTree` | 渲染 session 树；内联 `fetch`/`bun:sqlite`。 |
| `tree-watcher.ts` | `main`、`argvNum`、`argvStr`、`argvFlag`、`serveGet`、`dbFallbackChildren`、`buildTree`、`classifyAll`、`tailJsonl`、`filterSseEvents`、`filterTodoSignals`、`buildCapsule`、`assessIntervention`、`suggestGuideCommand`、`fmtStatusLine` | 实时观察 session 树；自包含。 |
| `monitor-tree.ts` | `main`、`argvNum`、`argvStr`、`serveGet`、`dbFallbackChildren`、`buildTree`、`classifyAll`、`fmtLine` | 监控 session 树；自包含。 |
| `sse-daemon.ts` | `main`、`ensureEventFile`、`writeSseReadyMarker`、`log`、`isRelevant`、`archiveIfNeeded`、`autoWriteSessionMap`、`appendEvent`、`connectSSE` | 独立 SSE 事件订阅守护；用 `fetch`+`bun:sqlite`+`fs`，不依赖 lib/test-serve。 |

# 17. Types-only 模块（依赖叶子，无函数）

- `scripts/lib/types.ts`：serve-api-client 的类型/接口集合。
- `scripts/test-serve/types.ts`：test-serve 公共类型（`RunManifest`、`RunState`、`RunPaths`、`BootstrapInput`、`ExecuteInput`、`CreateRunInput`、`SnapshotSourceInput`、`P01BInput`、`P02Input`、`SentinelInput` 等）。

> 这些类型被各模块 import 作为形参/返回值，但不构成调用边；拓扑图中作叶子标注。
