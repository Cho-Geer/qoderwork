# Orchestrator 失败链根因调查

## 执行需求唯一ID

`inv-20260708-01`

## 执行时间戳

`2026-07-08`

## 执行内容

- 调查选项 A：`compliance_gate_check` 刚创建的 gate session 为什么在 `confirm` 阶段立即读不到。
- 调查选项 B：`dispatch_subagent` 为什么在写 `.task_temp/_dispatch` 时命中 `EROFS`。
- 调查为什么 `Orchestrator` 连续工具失败后没有向 QoderWork 汇报，反而继续消耗 token 尝试自救。

## 修改的代码路径

- 无。本次仅做代码阅读、日志核对、运行时状态核对。

## 生成的文档路径

- `plans/build-super-admin/2026-07-08-Orchestrator失败链根因调查.md`

## 实现的内容

### A线：gate session 丢失

- `checkGateCompliance()` 在内存中创建 `store.sessions[gateSessionId]` 后调用 `saveGateStore(store)`，但没有检查返回值，随后直接返回 `session_id`。
- `saveGateStore()` 只返回 `boolean`；底层 `dbSaveGateStore()` 失败时记录日志并返回 `false`，不会向上抛出 fatal。
- `confirmGateSession()` 随后调用 `loadGateStore()` 重新读取 store；如果上一阶段没有真正持久化成功，就会直接返回 `session not found`。
- 因此 A 线更接近“写失败被静默吞掉，check 假成功，confirm 真失败”，不是单纯的调用顺序错误。

### B线：dispatch_subagent 命中 EROFS

- `dispatch-subagent.ts` 在构建 prompt 后，先执行：
  - `fs.mkdirSync(OUTPUT_DIR, { recursive: true })`
  - `fs.writeFileSync(outputFile, result.prompt, "utf8")`
- 只有写完 `.task_temp/_dispatch` 之后，才会进入 queue enqueue 和 `dispatchPrivilege` grant 创建逻辑。
- 运行时 `findmnt -T /home/zhaoge/workspace/opencode/work-one/.task_temp/_dispatch` 显示根挂载为 `ro`，因此这里的写文件失败不是目录权限细节，而是整个根文件系统只读。
- 这解释了为什么 `dispatch_subagent` 在 privilege grant 之前就已经失败。

### C线：为什么没上报，还在自救

- `Orchestrator.md` 明确要求：
  - 连续失败 3 次以上触发 `qoderwork_bridge`
  - `When Blocked` 时先 `acp_notify`
  - 如果 `acp_notify` 失败，再立刻调用 `question`
- active system transform 位于 `plugin-handlers/system/anti-bypass.ts`，它是否注入 STOP / Phase1 指令，依赖 `tool-tracker.checkThreshold()` 与 `getGuidanceStatus()`。
- `tool-tracker.ts` 中：
  - `recordAttempt()` / `recordBlock()` / `recordResult()` 都依赖 SQLite 写入 `tool_enforcement`
  - `checkThreshold()` 也要先读 DB，再把 `stop_injected=1` 写回 DB
  - 如果 DB 异常，函数会 catch 后返回“不注入 / 不阻断”
- 在本轮根文件系统 `ro` 的前提下，`tool_enforcement` 这条链大概率无法稳定写入，于是系统级 STOP / `question` 指令没有可靠注入，模型只能继续按自身推理做“重试 / 换招 / 自救”。
- 现场 transcript 也没有看到 `acp_notify` 或 `question` 的实际调用记录。

## 配置方式

- 本次未新增配置。
- 调查时核对的权威源：
  - `opencode.json`
  - `.opencode/agents/Orchestrator.md`
  - `.opencode/project.config.json`

## Logs Checked

- `opencode export ses_0c091a825ffejuHk2O7j7pPTfe`
- `findmnt -T /home/zhaoge/workspace/opencode/work-one/.task_temp/_dispatch`
- `.task_temp/_logs/`

## 注意事项

- 本轮调查结论的上游根因不是单一插件 bug，而是“根文件系统只读”对多条持久化链路的联动破坏：
  - `.task_temp/_dispatch` 写入失败
  - gate store / gate_sessions 持久化异常
  - `tool_enforcement` 计数与 STOP 注入链不可靠
- 如果要继续做 live E2E 复现，必须先恢复 `work-one` 所在挂载为可写，再重启 `serve`，否则只会重复看到表面不同、底层同因的故障。
