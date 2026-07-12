# P0-B 迁移 + P1 dispatch_privilege 直接实施

**为什么**: build agent 方案失败（偏离任务做无关重构），QoderWork 直接实施 P0+P1。

**改了什么**:
- `.opencode/lib/db-manager.ts` — P0-B ALTER TABLE 幂等迁移 + P1 dispatch_privilege_grants 表（16 列 + 2 索引）
- `.opencode/service/dispatch/privilege.ts` — 新建 208 行，grant 生命周期（create/bind/has/consume/revoke）
- `.opencode/service/dispatch/router.ts` — DispatchInput 新增 dispatch_privilege 字段 + Orchestrator-only 校验
- `.opencode/scripts/command-tools/dispatch-subagent.ts` — DISPATCH_PRIVILEGE 环境变量支持

**决策**: 
- quality-contract.ts 无 bug（sessionId 误报是字段名大小写问题）
- P1 由 QoderWork 直接实施，不依赖 build agent
