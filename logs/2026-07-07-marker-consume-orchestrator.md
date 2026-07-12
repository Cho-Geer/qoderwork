# 改进轮次：marker-consume 机制验证 + SSEWatcher 防护 + silent 语义 + SA 回归

**为什么**: 上一轮 live privilege E2E 发现 child session 未创建（dispatch_privilege 创建 OK 但 queue 停留 pending）。根因是 Orchestrator LLM 不知道 dispatch_subagent 返回值应透传给 Task() 工具。本轮实施 4 项改进并验证。

**改了什么**:
- `.opencode/agents/Orchestrator.md` — Dispatch Rules 新增 rule 7：dispatch_subagent 返回值必须立即透传给 Task() 工具，否则会停留在 pending 状态。这是 marker-consume 链路激活的前提
- `.opencode/plugin-handlers/after/dispatch.ts` — 新增 diagnostic hook：追踪 dispatch_subagent / Task() 是否在同一 session 内成对出现；暴露 `checkUnpairedDispatch()` 函数供 session.idle hook 调用（本次 defer wiring）
- `qoderwork/scripts/lib/sse-watcher.ts` — SSEWatcher 新增 process.on("exit"/"SIGINT"/"SIGTERM"/"uncaughtException"/"unhandledRejection") 自动 cleanup；避免 fd 泄漏与 tail 子进程孤儿
- `qoderwork/scripts/live-llm-dispatch-e2e.ts` + `live-llm-privilege-e2e.ts` — 移除重复的 process.on cleanup（由 SSEWatcher 内部处理）
- `qoderwork/scripts/start-serve.ts` — `stopOrphanServe()` 拆分 `silent` 与 `bestEffort` 两个正交 flag；stopDaemon 内的 silent:true 全部改为 bestEffort:true（让诊断日志可见但不阻塞）

**验证结果**:

### 1. Orchestrator.md rule 7 实测
```
Live privilege E2E (session: ses_0c4dcc660ffeqSZNtMIjxRH40e):
  ✓ dispatch_subagent completed (callID: call_r007m7kdzfipy4x8p5af07w0)
  ✓ child session created via API: ses_0c4dbdfd2ffeqj3wYWs080uliO (agent: build)
  ✓ dispatch_queue row id=30 (dispatch_key + parent_session_id + call_id)
  ✓ dispatch_privilege_grants row id=392c72a7 (privilege=framework_maintenance)

Assertion: 5 PASS / 0 FAIL (vs 4/0 in prior run)
```

**关键改进**: 之前 privilege E2E 的 child session 未创建（0/1）；Orchestrator.md rule 7 添加后，child session 实际被 Task() 创建（1/1）。**marker-consume 机制现已可被激活**——前提是 child 调用 Task() 触发。

### 2. 新发现的 gap（defer 项）
- **bindGrant 未在 session.created 触发**：dispatch_privilege_grants.child_session_id 仍为 null，status=pending，bound_at=null。session.ts 中的 onSessionCreated bindGrant 逻辑存在但日志中无 GRANT-BOUND-ON-SESSION-CREATED 事件。可能原因：(a) hook 注册顺序导致 session.created 未实际触发 onSessionCreated；(b) 子进程启动与 hook 注册的 race
- **session.created 事件在某些 serve restart 后未注册**：plugin-session-hooks.log 显示 05:35:14 / 05:52:56 的注册列表缺少 session.created，而其他时刻完整。这是框架级 plugin lifecycle 问题，非本轮任务范围

### 3. SSEWatcher 防护
- 实测 sanity test：5 polls 504ms，auto-cleanup registered silently
- process.on 注册成功；异常退出时会自动 close() fd / kill tail 子进程
- live-llm-dispatch-e2e.ts + live-llm-privilege-e2e.ts 移除了重复 cleanup 注册

### 4. start-serve.ts silent/bestEffort 拆分
- `stopOrphanServe({bestEffort: true})` 实测：stopDaemon 成功后会打印 "[INFO] Found N orphan serve process(es)" 可见诊断信息，但不会阻塞 stopDaemon 返回
- --stop 实测：PID 文件存在时正常停止 + bestEffort orphan 清理；PID 缺失时 orphan 检测 + 清理

### 5. Super-Admin 回归测试
- 通过 CLI 直接调用 dispatch-subagent.ts Super-Admin "knowledge acquisition task..."
- 结果：成功生成 dispatch prompt 文件；dispatch_queue row id=29 写入（agent_type=Super-Admin, dispatch_key=promptHash fallback, call_id=null, status=pending）
- **向后兼容确认**：新参数 dispatch_privilege / allowed_paths / privilege_reason 默认 undefined；既有 Super-Admin / Orchestrator 调用路径无影响
- 测试 artifacts 已清理（DELETE id=29 + rm prompt file）

**证据矩阵（最终）**:

| 环节 | DB/函数级 | Live v1 | Live privilege v1 | Live privilege v2（本轮）|
|------|:---:|:---:|:---:|:---:|
| dispatch_subagent → queue 写入 | ✓ | ✓ | ✓ | ✓ |
| queue 含 dispatch_key | ✓ | ✓ | ✓ | ✓ |
| queue 含 parent_session_id | ✓ | ✓ | ✓ | ✓ |
| queue 含 call_id | ✓ | ✗ | ✓ | ✓ |
| createGrant | ✓ | ✗ | ✓ | ✓ |
| child session created | ✗ | ✗ | ✗ | **✓ LIVE** |
| bindGrant (session.created) | ✓ | ✗ | ✗ | ◐ (未触发，gap) |
| hasGrant + path match | ✓ | ✗ | ✗ | ✗ |
| CodeGraph 双门 | ✓ | ✗ | ✗ | ✗ |

**证据等级跃迁**: 4.5/9 → **5.5/9**（新增 child session created live-proven）。

**决策**:
- **marker-consume 机制验证达成目标**：Orchestrator.md rule 7 让 Orchestrator LLM 实际调用 Task()，child session 创建 live-proven
- **bindGrant gap 作为独立任务 defer**：根因是 session.created hook 注册不稳定，需要深入 plugin-lifecycle.ts 调试（非本轮任务）
- **super-Admin 回归确认**：dispatch_privilege 新参数向后兼容，既有的 dispatch_subagent 调用路径零影响

**仍存在的风险/改进空间**:
1. **session.created hook 注册 race**：plugin-session-hooks.log 显示某些 restart 后 hook 列表中缺失 session.created。需要在 plugin-lifecycle.ts 或 hook-lifecycle.ts 中排查。影响：bindGrant onSessionCreated 路径不稳定
2. **checkUnpairedDispatch() 未 wire 到 session.idle**：诊断函数存在但未自动调用。需要在 session.ts 的 onSessionIdle 中调用，使 unpaired dispatch 自动 WARN
3. **child session 实际执行未验证**：本轮只到"child session 创建"，未验证 child 是否执行 codegraph_explore + safe_framework_edit。需要延长 watcher 等待时间或改用 SSE 事件驱动（child 完成事件）
