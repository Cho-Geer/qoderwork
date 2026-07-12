# P0 遗留项修复：Dispatch Exact Binding + CodeGraph Grant Bypass + Enforcement 标记

**为什么**: work-one 框架重构路线图的 6 项 P0 遗留阻断项需要修复，以打通 dispatch privilege grant live E2E 链路，并为 Phase 3 行为型 enforcement 转换铺路。

**改了什么**:
- `.opencode/plugin-handlers/before/codegraph.ts` — 删除 CODEGRAPH-GRANT-BYPASS 块（lines 105-118），safe_framework_edit 不再跳过 CodeGraph impact 检查
- `.opencode/tools/safe_framework_edit.ts` — 修正注释（删除"grant bypass"引用）；修复路径匹配 bug：hasGrant() 现使用相对路径而非绝对路径，与 grant allowed_paths 匹配
- `.opencode/service/dispatch/queue.ts` — `dbEnqueueDispatch()` 新增 dispatchKey/parentSessionId/callId 可选参数并写入 dispatch_queue；`dbDequeueWithLease()` 和 `dbDequeueWithHash()` 返回对象补齐 exact binding 三字段
- `.opencode/service/dispatch/router.ts` — 生成 dispatchKey 并通过 env 传递给 dispatch-subagent.ts（DISPATCH_KEY/DISPATCH_PRIVILEGE/DISPATCH_ALLOWED_PATHS/DISPATCH_PRIVILEGE_REASON）
- `.opencode/scripts/command-tools/dispatch-subagent.ts` — 读取 DISPATCH_KEY env，传递给 dbEnqueueDispatch() 和 createGrant()，确保 queue 和 grant 使用同一 dispatch_key
- `.opencode/service/dispatch/tool-scope-paths.ts` — `readDispatchAllowedTools()` 和 `isToolAllowed()` 标记 @deprecated（0 runtime callers）
- `.opencode/service/permission/isolation.ts` — PermissionIsolation 类标记 @deprecated（0 runtime callers）
- `.opencode/service/permission/reader.ts` — `getAgentPermission()` 标记 @deprecated（2 internal callers，Phase 3 迁移）
- `.opencode/service/gate/checks.ts` — `isWriteAllowed()` 标记 @deprecated（1 runtime caller）
- `.opencode/service/session/config-attest.ts` — `attestConfigRead()` 标记 @deprecated（per-agent 对 native agent 无效）
- `.opencode/plugin-handlers/before/{config-guard,git-guard,anti-bypass}.ts` — 添加 LEGACY HANDLER 文件头
- `.opencode/legacy/subagent-preamble.md` — frontmatter 改为 deprecated:true/active:false

**决策**:
- P0-3（安全漏洞）最先修复：CodeGraph grant bypass 违反 double-gate 要求
- P0-1 分三步修：queue 写入 → dequeue 返回 → router env 传递，形成完整的 dispatch_key 链路
- P0-4/P0-5 采用标记而非删除：有 runtime callers 的函数不能安全删除，标记 @deprecated 并记录迁移路径，留给 Phase 3 完整行为型转换
- P0-2（grant E2E）deferred：需要 live serve API + 真实 Orchestrator dispatch 闭环验证，不属于代码修改范围
- safe_framework_edit 路径匹配修复：allowed_paths 是相对路径（如 `.opencode/**`），但 hasGrant 传入的是绝对路径，导致永远不匹配

## DB/函数级 Grant Lifecycle 验证 (2026-07-07)

脚本: `qoderwork/scripts/e2e-grant-lifecycle.ts` — 17 PASS / 0 FAIL（**DB/函数级模拟**，非 live LLM E2E；真实 Orchestrator→build child 链路待补）

| 测试 | 结果 |
|------|:----:|
| E2E-01: 无 grant session → hasGrant 返回 null | PASS |
| E2E-02: grant 全生命周期 (create→bind→hasGrant→path match→consume) | 6 PASS |
| E2E-03: dispatch exact binding (queue dispatch_key + grant 绑定) | 6 PASS |
| E2E-04: 并发 child 隔离 (child B 无法使用 child A grant) | 2 PASS |
| E2E-05: 过期 grant 被拒绝 | PASS |
| E2E-06: 已撤销 grant 被拒绝 | PASS |
