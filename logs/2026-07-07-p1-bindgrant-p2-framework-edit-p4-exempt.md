# P1 补完 + P2 safe_framework_edit + P4 exempt_agents 收紧

**为什么**: blueprint-dispatch-scope-privilege.md 的 P1 bindGrant 调用点缺失（grant 创建后从未绑定到 child session），P2 受控写入工具未实现，P4 super-admin CodeGraph 豁免过宽。

**改了什么**:
- `.opencode/service/dispatch/queue.ts` — `dbDequeueWithLease` 和 `dbDequeueWithHash` 的 SELECT 补 `dispatch_key`, `parent_session_id`, `call_id`
- `.opencode/service/dispatch/marker-consume.ts` — 两处 dequeue 成功后调用 `bindGrant(entry.dispatch_key, params.sessionID)`，try/catch 包裹不阻断 dispatch
- `.opencode/tools/safe_framework_edit.ts` — 新建受控写入工具，require bound grant + .opencode/** 路径限制 + 一次性 grant 消费
- `.opencode/plugin-handlers/before/codegraph.ts` — 加入 `safe_framework_edit` 到拦截列表 + grant bypass（有 grant 跳过 CodeGraph 检查）
- `.opencode/project.config.json` — codegraph.exempt_agents 从 `["super-admin"]` 改为 `[]`
- `.opencode/service/enforcement/exemptions.ts` — DEFAULT_CONFIG 同步收紧

**决策**:
- P1 bindGrant 选择 marker-consume.ts 作为调用点，因为这是 child session 启动时消费 dispatch 的唯一入口，dispatch_key 和 sessionID 同时可用
- P2 工具在 codegraph.ts 中做 grant bypass 而非在工具内部跳过，确保审计链路完整
- P3 Native Task metadata 延后（用户标记"可延后"）
- P4 直接清空 exempt_agents，所有 agent（包括 Super-Admin）均需 CodeGraph impact
