# Blueprint: Dispatch 级框架维护权限隔离

**创建日期**: 2026-07-12
**更新日期**: 2026-07-28
**状态**: 已完成
**相关蓝图**: 无

**版本**: v2.2
**原状态（PHASE-03 前自述）**: 部分实施；组件级 smoke PASS，核心 live 授权闭环未完成
**更新时间**: 2026-07-07
**关联问题**: Orchestrator 将框架维护任务派发给弱模型执行时，弱模型需要在严格边界内修改 `.opencode/**` 等框架文件，但不能获得常驻全局高权限。

---

## 0. 2026-07-07 实施进度复核

本次复核结合了当前 work-one 代码、运行 SQLite schema、`e2e/todowrite-supervision-e2e.md` 中 D.2 记录，以及 CodeGraph 对 `dispatch_privilege`、`safe_framework_edit`、`bindGrant`、`hasGrant` 的索引结果。

总体结论：P0/P1/P2/P4 都已有代码落点，但只有 schema/table/service 层基本到位；从 Orchestrator dispatch 参数进入 router、写入 queue exact key、绑定 child session、通过 `safe_framework_edit` 执行 grant + CodeGraph 双门的端到端链路仍未闭合。

| 阶段 | 当前状态 | 已完成 | 未闭合/风险 |
|------|----------|--------|-------------|
| P0 Schema 与身份绑定 | 部分完成 | `db-manager.ts` 已有 `dispatch_key/parent_session_id/call_id` 幂等迁移；运行 DB `dispatch_queue` 已有三列；`dispatch_privilege_grants` 表存在 | `dbEnqueueDispatch()` 仍只写原始 6 列，不写 exact key/parent/call；`dbDequeueWithLease()` 与 `dbDequeueWithHash()` 查询了字段但返回对象未带出这些字段；并发 exact binding 未验证 |
| P1 DB-backed grant | 部分完成 | `service/dispatch/privilege.ts` 已有 `createGrant/bindGrant/hasGrant/consumeGrant/revokeGrant`；router 已校验只有 Orchestrator 可声明 `dispatch_privilege`；脚本读取 `DISPATCH_PRIVILEGE` 环境变量 | router 没有把 `dispatch_privilege/allowed_paths/reason` 传入 dispatch 脚本 env；grant 使用的 `dispatchToken` 未写入 queue，`bindGrant()` 在实际 lease 路径拿不到 key；grant 审计尚未写入 `session_events` |
| P2 受控框架写入 | 部分完成且存在阻断风险 | 新增 `.opencode/tools/safe_framework_edit.ts`；CodeGraph before handler 已把 `safe_framework_edit` 加入拦截列表；工具内部校验 bound grant 与 `.opencode/**` 路径 | `opencode.json` 未给 `build`/相关 agent 暴露 `safe_framework_edit`；CodeGraph handler 当前对有效 grant 直接 `CODEGRAPH-GRANT-BYPASS`，违反“grant 不得绕过 CodeGraph”；工具传入 `hasGrant()` 的是绝对路径，grant 测试数据多为相对路径，路径匹配可能误拒绝 |
| P3 Native Task metadata | 未实施 | 无 | 当前仍不应假设 legacy `before/task.ts` 是 active path；后续需要时再做轻量 metadata path |
| P4 agent-level exemption 清理 | 部分完成 | `.opencode/project.config.json` 与 `service/enforcement/exemptions.ts` 已将 CodeGraph `super-admin` 默认豁免收紧为空数组 | 还缺 build/Super-Admin 修改源码都必须先 CodeGraph impact 的 E2E 验证 |

本次复核对 `e2e/todowrite-supervision-e2e.md` 中 D.2 的解释做出修正：该结果可以证明表结构、grant service、环境变量入口等组件级实现存在，不能证明 dispatch privilege live E2E 已通过。

**当前最高优先级遗留任务**:

1. 先修 `dbEnqueueDispatch()`，让 dispatch key、parent session、call id 与 prompt ref 同事务写入，并确保所有 dequeue 返回对象带出这些字段。
2. 在 router 执行 dispatch 脚本时显式传递 `DISPATCH_PRIVILEGE`、`DISPATCH_ALLOWED_PATHS`、`DISPATCH_PRIVILEGE_REASON`。
3. 删除 `codegraph.ts` 中的 grant bypass；`safe_framework_edit` 必须继续要求 `impact_called`。
4. 在 `opencode.json` 中只给目标执行 agent 暴露 `safe_framework_edit`，保持 `safe_edit` 对 `.opencode/**` 的 deny。
5. 统一 `allowed_paths` 与实际 `filePath` 的相对路径匹配规则，避免绝对路径导致 grant path mismatch。
6. 补一组最小 live E2E：无 grant、有 grant 无 CodeGraph、有 CodeGraph 无 grant、grant+CodeGraph 成功、并发隔离、过期/越界拒绝。

### 0.1 Smoke Test 复核补充（2026-07-07）

`e2e/smoke-test-results-20260707.md` 将 G4 Dispatch Privilege 判定为 PASS，但需要按证据级别拆分：

| 项 | Smoke 结论 | 文档判定 |
|----|------------|----------|
| G4-001 lifecycle | pending -> bound -> consumed PASS | 组件级通过，证明 `privilege.ts` lifecycle 可用 |
| G4-002 path mismatch | PASS | 组件级通过 |
| G4-003 TTL | PASS | 组件级通过 |
| G4-004 非 Orchestrator 创建 grant | PASS | router 校验存在，但仍需真实 dispatch 参数路径验证 |
| G4-005 grant + CodeGraph + write | PARTIAL PASS | 不能视为 live E2E 通过；serve API 直接建 build session 不等于真实 build runtime，且当前 `codegraph.ts` 仍有 `CODEGRAPH-GRANT-BYPASS` |
| G4-006 DB failure | PASS | 证明不应静默降级 |

本次本地复核还确认：

- 运行 DB 当前有 `dispatch_privilege_grants` 表；`dispatch_queue` 已有 `dispatch_key/parent_session_id/call_id` 三列。
- `dbEnqueueDispatch()` 仍未写入 exact key/parent/call；`dbDequeueWithLease()` 与 `dbDequeueWithHash()` 仍未完整返回这些字段。
- `router.ts` 仍未把 `DISPATCH_PRIVILEGE`、`DISPATCH_ALLOWED_PATHS`、`DISPATCH_PRIVILEGE_REASON` 传入 dispatch 脚本环境。
- `opencode.json` 的各 native agent permission 未显式声明 `safe_framework_edit`；smoke 中工具能到达 tool 层，但配置矩阵仍应补齐显式授权边界。
- `safe_framework_edit` 内部仍用绝对路径调用 `hasGrant()`，与相对 `allowed_paths` 混用时存在误拒绝风险。

---

## 1. 当前代码审计结论

本 blueprint 已重新对照以下当前实现审核：

- `opencode.json`
- `.opencode/agents/Orchestrator.md`
- `.opencode/service/dispatch/**`
- `.opencode/plugin-handlers/before/{scope,codegraph,task,permission-safety}.ts`
- `.opencode/service/{gate,session,permission,enforcement}/**`
- `.opencode/tools/{dispatch_subagent,safe_edit}.ts`
- `.opencode/lib/db-manager.ts`
- 当前 SQLite 运行库表结构

核心结论：

| 事项 | 当前事实 | 对方案的影响 |
|------|----------|--------------|
| Native agent | 当前 `opencode.json` 主要是 `Orchestrator + build/general/plan/explore`，`Super-Admin` 只存在于 legacy profile 映射 | 不能把 `Super-Admin` 当成真实原生运行 agent 来设计权限 |
| `dispatch_subagent` | 只是薄 wrapper，核心逻辑在 `.opencode/service/dispatch/router.ts` | 权限 grant 应接入 router/service 层，不应堆在 tool wrapper |
| Task hook | `.opencode/plugin-handlers/before/task.ts` 标记为 legacy，且不在 active before chain | 旧方案假设 Task hook 自动消费 dispatch_queue 不成立 |
| CodeGraph gate | 当前拦截 `safe_edit/safe_delete/safe_restore/safe_shell/bash/safe_framework_edit`，按 agent exemption 或 impact 状态放行 | 不能用框架维护权限绕过 CodeGraph；当前 `safe_framework_edit` grant bypass 必须删除 |
| 静态权限 | `build.safe_edit` 明确 deny `.opencode/**`，`Orchestrator.safe_edit` 也 deny `.opencode/**` | 仅在 DB 写入 scope/grant 不会自动获得写权限，需要专用写路径或 tool 内动态授权 |
| `dispatch_queue` 代码 schema | `db-manager.ts` 建表定义已包含 `dispatch_key/parent_session_id/call_id` | 新库可能具备精确绑定字段 |
| 当前运行 DB schema | 2026-07-07 实测 `dispatch_queue` 已有 `dispatch_key/parent_session_id/call_id`，`dispatch_privilege_grants` 已存在；`session_map` 不承载 privilege 字段 | P0 schema 基础已落地，但 enqueue/dequeue exact key 链路仍未闭合 |
| `safe_framework_edit` | 工具文件已新增，内部校验 bound grant 与 `.opencode/**`，但未在 `opencode.json` 暴露给目标 agent | P2 只能算组件级落地，尚不能作为弱模型真实可用写入路径 |
| caller identity | `resolveCallerIdentity` 仍有 latest dispatch fallback | 权限判定不能依赖该 fallback，必须使用精确 session/grant 绑定 |
| scope gate | `scope-validate.ts` 当前做 route mismatch、配置写入审计、UC7、shell backup-bypass 阻断 | 它不是任务级动态授权系统 |

因此，原 v1 方向“需要 dispatch 级权限”成立，但实现设计需要调整：

- 不再使用 `dispatch_scope` 作为主概念，改为 `dispatch_privilege` / `maintenance_grant`，避免和路径 scope、agent scope 混淆。
- 不再建议 `hasFrameworkScope()` 直接绕过 CodeGraph。CodeGraph 是影响分析证据门，框架维护权限只解决“谁能写哪些框架路径”。
- 不再把 `Super-Admin` agent exemption 当作主路径。当前执行身份多会落到 native `build`，agent 名称豁免既不稳定也过宽。
- 必须补齐 dispatch exact key 的写入、返回、绑定和 E2E，再宣称权限 grant 可用于真实任务。

---

## 2. 问题定义

### 2.1 现象

Orchestrator 可判断某任务属于框架维护，例如：

- 更新 `.opencode/plugin-handlers/**`
- 调整 `.opencode/service/**`
- 修改 `.opencode/agents/**`
- 维护 `opencode.json` 或 `project.config.json`

但当前弱模型执行方通常是 native `build`。`build` 的静态权限禁止 `.opencode/**`，所以即使任务由 Orchestrator 合法派发，执行时仍会被权限系统阻断。

### 2.2 根因

当前权限模型主要是三类静态或半静态判断：

1. **agent 静态权限**：`opencode.json.permission` 决定某 agent 可调用哪些工具、哪些路径。
2. **hook gate**：before handlers 做 CodeGraph、scope、skill、route 等检查。
3. **session 身份推断**：`session_map/gate_session/resolveCallerIdentity` 尝试还原当前 agent。

缺失的是：

> Orchestrator 在一次具体 dispatch 中，对一个具体 child session 授予有限、可审计、可过期的框架维护权限。

换言之，当前系统能表达“build 永远不能写 `.opencode/**`”，也能表达“super-admin 理论上高权限”，但不能表达“这个由 Orchestrator 派发的 build 子任务，本次只允许改 `.opencode/plugin-handlers/system/skill-summary.ts`，且必须先完成 CodeGraph impact”。

---

## 3. 设计目标

### 3.1 必须满足

- **任务级授权**：权限绑定到一次 dispatch / child session，而不是永久绑定到 agent。
- **最小权限**：grant 必须包含允许路径、工具、原因、过期时间。
- **精确绑定**：grant 只能被目标 child session 使用，不能被同类并发任务复用。
- **CodeGraph 保留**：框架维护 grant 不得跳过 CodeGraph impact evidence。
- **审计可追踪**：grant 创建、消费、拒绝都写入 `session_events` 或独立审计表。
- **fail closed**：缺少 dispatch_key、child session、grant、impact evidence 任一关键条件时拒绝。
- **兼容当前简化架构**：优先接入 active path，即 `dispatch_subagent -> service/dispatch/router.ts -> native build`。

### 3.2 明确不做

- 不恢复“三层十角色”完整 legacy agent 体系。
- 不给 `build` 常驻 `.opencode/**` 写权限。
- 不用 `Super-Admin` agent 名称作为通用高权限开关。
- 不把 framework maintenance grant 做成 CodeGraph exemption。
- 不依赖 `resolveCallerIdentity` 的 latest dispatch fallback 做安全决策。

---

## 4. 推荐方案

### 4.1 总体设计

引入 DB-backed `dispatch_privilege`，并将框架文件写入收敛到一个显式受控路径：

```
Orchestrator
  -> dispatch_subagent(agentType=Super-Admin/build, dispatch_privilege=framework_maintenance)
  -> dispatch router 写入 privilege grant
  -> child session 建立后绑定 grant
  -> child 调用 codegraph_explore 完成 impact evidence
  -> child 调用 safe_framework_edit 或受控 safe_edit
  -> write guard 校验 grant + path + tool + impact
  -> 写入框架文件
```

关键拆分：

- `dispatch_privilege` 只回答“这个 child 是否有本次维护授权”。
- `permission/opencode.json` 只回答“这个 agent 静态上能否调用某个工具”。
- `CodeGraph` 只回答“写之前是否完成影响分析证据”。
- `scope-validate` 继续做 route/config/shell bypass 约束，不承担 grant 语义。

### 4.2 命名

不建议沿用 `dispatch_scope`。

原因：

- `scope` 在当前框架中已经用于路径写入边界、route mismatch、agent scope 等语义。
- `dispatch_scope=framework_maintenance` 容易被误实现为路径 scope 豁免。
- 本需求本质是“临时权限 grant”，不是“作用域分类”。

推荐命名：

- 对外参数：`dispatch_privilege`
- 枚举值：`framework_maintenance`
- DB 记录：`dispatch_privilege_grants`
- 校验函数：`hasFrameworkMaintenanceGrant(sessionId, filePath, toolName)`

---

## 5. 数据模型

### 5.1 先修复 dispatch 精确绑定

当前代码中 `db-manager.ts` 的 `dispatch_queue` 建表定义包含：

- `dispatch_key`
- `parent_session_id`
- `call_id`

2026-07-07 复核：当前运行 SQLite 表已具备这些列，P0 schema migration 已基本落地。但 queue 代码仍未把 exact binding 字段写入和完整返回，因此不能把 schema 完成等同于授权链路完成。实现仍需确保：

- `PRAGMA table_info(dispatch_queue)` 持续自检运行库字段，而不只检查新库建表定义。
- `dbEnqueueDispatch` 与 `dispatch_prompt_refs` 同事务写入 exact key、parent session、call id。
- `dbDequeueWithLease`、`dbDequeueWithHash`、`dbDequeueWithExactKey` 返回对象都带出 exact binding 字段。
- privileged dispatch 如果无法生成 exact key，直接拒绝。

### 5.2 新增 grant 表

建议新增独立表，而不是把复杂 JSON 堆进 `session_map`：

```sql
CREATE TABLE IF NOT EXISTS dispatch_privilege_grants (
  id TEXT PRIMARY KEY,
  dispatch_key TEXT NOT NULL,
  parent_session_id TEXT NOT NULL,
  child_session_id TEXT,
  dag_task_id TEXT,
  agent_type TEXT NOT NULL,
  privilege TEXT NOT NULL,
  allowed_tools TEXT NOT NULL,
  allowed_paths TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  bound_at INTEGER,
  consumed_at INTEGER,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_dispatch_privilege_child
ON dispatch_privilege_grants(child_session_id, privilege, status);

CREATE INDEX IF NOT EXISTS idx_dispatch_privilege_dispatch
ON dispatch_privilege_grants(dispatch_key, status);
```

字段语义：

| 字段 | 语义 |
|------|------|
| `dispatch_key` | 精确 dispatch 调用标识，禁止仅按 `agent_type` 匹配 |
| `parent_session_id` | 授权来源 session，必须是 Orchestrator 或明确允许的控制方 |
| `child_session_id` | 实际执行 session，child 创建后绑定 |
| `privilege` | 当前仅允许 `framework_maintenance` |
| `allowed_tools` | 建议初始仅 `["safe_framework_edit"]` |
| `allowed_paths` | 精确文件或窄 glob，不允许裸 `.opencode/**` 作为默认值 |
| `status` | `pending/bound/consumed/revoked/expired` |
| `expires_at` | 短 TTL，建议 30-60 分钟 |

---

## 6. 写入路径设计

### 6.1 首选：新增 `safe_framework_edit`

推荐新增一个专用工具：

```
.opencode/tools/safe_framework_edit.ts
```

职责：

- 只处理框架维护写入。
- 内部调用现有 `writeSafeFull` / backup / audit 能力。
- 写入前强制校验：
  - 当前 session 有 bound `framework_maintenance` grant。
  - 文件路径命中 grant 的 `allowed_paths`。
  - 工具名命中 grant 的 `allowed_tools`。
  - grant 未过期、未撤销。
  - 当前 session 已完成 CodeGraph impact evidence。

静态权限建议：

- `build` 可调用 `safe_framework_edit`。
- `build.safe_edit` 继续 deny `.opencode/**`。
- `Orchestrator` 不直接获得框架写权限，除非另有明确需求。

优点：

- 权限边界清晰，普通代码写入和框架维护写入分离。
- 不需要放宽 `safe_edit` 对 `.opencode/**` 的静态 deny。
- 审计事件更容易识别。

代价：

- 需要新增一个 tool，并把它纳入 before hook / CodeGraph tool 分类。

### 6.2 备选：在 `safe_edit` 内增加 grant 检查

如果不希望新增工具，可在 `safe_edit.ts` 内部加入：

```
if (isFrameworkPath(filePath)) {
  requireFrameworkMaintenanceGrant(sessionId, filePath, "safe_edit")
}
```

同时需要调整静态 permission，让 `build.safe_edit` 对有限 `.opencode/**` 路径可被调用，否则请求到不了工具内部。

不推荐作为首选，原因：

- 容易把普通写入工具变成多语义工具。
- 稍有配置不当就会把 `.opencode/**` 暴露给 build 常驻权限。
- 后续审计要同时理解 `safe_edit` 的普通路径和框架路径。

---

## 7. CodeGraph 与权限的关系

### 7.1 当前旧方案的问题

旧方案建议在 `codegraph.ts` 中加入：

```ts
if (hasFrameworkScope(sessionId)) return;
```

该设计应废弃。

原因：

- 框架文件修改更需要 CodeGraph impact，而不是更少。
- 这会让 Orchestrator dispatch 成为 CodeGraph 绕过通道。
- 当前项目已把 CodeGraph 作为框架修改硬约束，不能因动态权限引入回退。

### 7.2 正确策略

CodeGraph gate 继续独立运行：

- `safe_framework_edit` 必须加入 CodeGraph 拦截工具列表。
- 有 grant 但没有 `impact_called`：仍然阻断。
- 没有 grant 但有 `impact_called`：仍然阻断。
- 同时具备 grant 和 `impact_called`：才允许进入写入。

建议把 `project.config.json` 中：

```json
"exempt_agents": ["super-admin"]
```

改为空数组或删除该项，但这应作为单独实施步骤验证。因为当前 native 执行身份不是稳定的 `Super-Admin`，继续保留 agent-level exemption 会产生误导。

---

## 8. 实施计划

### P0: Schema 与身份绑定基线

目标：先让 dispatch 能精确绑定，不引入任何新权限。

**实施状态（2026-07-07）**: 部分完成。运行 DB schema 已具备 exact binding 三列，但 `dbEnqueueDispatch()` 没有写入这些列，`dbDequeueWithLease()` 和 `dbDequeueWithHash()` 返回对象也没有带出这些字段；因此 `marker-consume.ts` 中新增的 `bindGrant(entry.dispatch_key, sessionID)` 在常规 hash/lease 路径上拿不到可绑定 key。

变更：

| 文件 | 变更 |
|------|------|
| `.opencode/lib/db-manager.ts` | 增加幂等 migration，补齐现有库 `dispatch_key/parent_session_id/call_id` |
| `.opencode/service/dispatch/queue.ts` | `dbEnqueueDispatch` 写入 exact key、parent、call；lease/dequeue 返回完整字段 |
| `.opencode/service/dispatch/router.ts` | privileged dispatch 必须生成 exact dispatch key |
| `.opencode/service/session/resolver.ts` | 权限相关调用禁止使用 latest dispatch fallback |
| `.opencode/scripts/self-test/*` | 增加运行库 schema 检查 |

验收：

- `PRAGMA table_info(dispatch_queue)` 显示 exact binding 字段。
- 并发两个 build dispatch 时，能区分各自 `dispatch_key`。
- 缺少 exact key 的 dispatch 不允许创建 privilege grant。

### P1: DB-backed privilege grant

目标：Orchestrator 可创建一次性框架维护授权，但还不开放写入。

**实施状态（2026-07-07）**: 部分完成。`dispatch_privilege_grants` 表和 `service/dispatch/privilege.ts` 已存在，`dispatch-subagent.ts` 可从环境变量创建 grant，router 已拒绝非 Orchestrator privilege 请求。但 router 尚未把 `dispatch_privilege/allowed_paths/reason` 传给脚本环境，grant 的 `dispatch_key` 也未写入 queue，导致 pending grant 无法在真实 child session 建立时稳定绑定。

变更：

| 文件 | 变更 |
|------|------|
| `.opencode/lib/db-manager.ts` | 新增 `dispatch_privilege_grants` 表 |
| `.opencode/tools/dispatch_subagent.ts` | 新增可选参数 `dispatch_privilege`、`allowed_paths`、`reason` |
| `.opencode/service/dispatch/router.ts` | 校验只有 Orchestrator 可创建 `framework_maintenance` grant |
| `.opencode/service/dispatch/privilege.ts` | 新增 grant 创建、绑定、查询、过期、审计逻辑 |
| `.opencode/plugins/session.ts` | child session 建立后按 exact dispatch key 绑定 grant |

授权规则：

- `dispatch_privilege` 默认空。
- 仅允许 `framework_maintenance` 一个枚举值。
- `allowed_paths` 必填，且必须是窄路径。
- parent 必须是 Orchestrator，且 caller identity 不能来自 latest dispatch fallback。
- grant 默认 TTL 30-60 分钟。

验收：

- Orchestrator dispatch 可创建 pending grant。
- child session 创建后 grant 变为 bound。
- 非 Orchestrator 创建 grant 被拒绝。
- 过期 grant 不可用。

### P2: 受控框架写入工具

目标：弱模型在 grant + CodeGraph evidence 双满足时可完成框架维护写入。

**实施状态（2026-07-07）**: 部分完成，当前不可验收。`.opencode/tools/safe_framework_edit.ts` 已新增，工具内部要求 bound grant 并限制 `.opencode/**`；`codegraph.ts` 已加入该工具。但 `opencode.json` 未暴露 `safe_framework_edit`，且 `codegraph.ts` 当前对有效 grant 直接 `CODEGRAPH-GRANT-BYPASS`，违反本 blueprint 的双门要求。必须先删除 bypass，再补权限与 E2E。

首选变更：

| 文件 | 变更 |
|------|------|
| `.opencode/tools/safe_framework_edit.ts` | 新增专用框架维护写入工具 |
| `opencode.json` | `build` 允许调用 `safe_framework_edit`，但 `safe_edit` 仍 deny `.opencode/**` |
| `.opencode/plugin-handlers/before/codegraph.ts` | 将 `safe_framework_edit` 加入 CodeGraph 拦截 |
| `.opencode/service/dispatch/privilege.ts` | 新增 `requireFrameworkMaintenanceGrant` |
| `.opencode/service/file-guard/execute.ts` | 复用现有 backup / atomic write / audit 能力 |

验收：

- 无 grant 写 `.opencode/**` 被拒绝。
- 有 grant 但未做 CodeGraph impact 被拒绝。
- 有 CodeGraph impact 但无 grant 被拒绝。
- grant 路径不匹配被拒绝。
- grant + impact + 路径匹配时可写入。

### P3: Native Task metadata path

目标：如果后续希望原生 Task 工具也能携带维护 grant，再实现 Task metadata path。

**实施状态（2026-07-07）**: 未实施，仍保持可选。当前优先级低于修复 `dispatch_subagent -> router -> queue -> bindGrant -> safe_framework_edit` 主链路。

当前不应假设 legacy `before/task.ts` 有效，因为它不在 active chain。

可选变更：

| 文件 | 变更 |
|------|------|
| `.opencode/plugin-handlers/before/task-metadata.ts` | 新增轻量 active handler，仅记录 Task metadata 和 exact dispatch key |
| `.opencode/plugins/before-dispatcher.ts` | 显式加入 `task-metadata`，位置早于 scope/codegraph |
| `.opencode/service/dispatch/privilege.ts` | 支持 native Task 子 session 绑定 |

约束：

- 不能恢复旧 task integrity 的大块复杂逻辑。
- 不能按 `agent_type` 消费 dispatch_queue。
- 没有 exact parent/child 绑定时 fail closed。

### P4: 清理 agent-level exemption

目标：移除不稳定、过宽的 `super-admin` CodeGraph 豁免。

**实施状态（2026-07-07）**: 部分完成。`.opencode/project.config.json` 与 `.opencode/service/enforcement/exemptions.ts` 已把 CodeGraph agent exemption 收紧为空数组；仍需补 E2E，证明 build/Super-Admin/legacy profile 修改源码和框架文件时都必须先产生 CodeGraph impact evidence。

变更：

| 文件 | 变更 |
|------|------|
| `.opencode/project.config.json` | 将 `enforcement_exemptions.codegraph.exempt_agents` 改为空数组或删除 |
| `.opencode/service/enforcement/exemptions.ts` | 默认值同步收紧 |
| `.opencode/e2e/*` | 增加 Super-Admin/build 均需 CodeGraph impact 的验证 |

验收：

- 任意 agent 修改源码/框架文件前都需要 CodeGraph impact，除非路径命中明确 path exemption。
- `.task_temp/**`、`docs/**` 等低风险路径 exemption 仍按配置生效。

---

## 9. E2E 验证矩阵

当前状态（2026-07-07）：以下矩阵仍是待补 live E2E。已有 D.2 记录只覆盖 DB 表、grant service 与部分入口的组件级验证，不覆盖 Orchestrator dispatch 到 child `safe_framework_edit` 的真实闭环。

| 用例 | 前置 | 操作 | 预期 |
|------|------|------|------|
| E2E-01 无 grant 框架写入 | build 子任务 | 写 `.opencode/plugin-handlers/system/skill-summary.ts` | 被权限/grant gate 拒绝 |
| E2E-02 有 grant 但无 CodeGraph | Orchestrator 创建 grant | 直接写框架文件 | 被 CodeGraph gate 拒绝 |
| E2E-03 有 CodeGraph 但无 grant | build 调用 codegraph_explore | 写框架文件 | 被 grant gate 拒绝 |
| E2E-04 grant + CodeGraph 成功 | grant path 精确匹配 | 写目标框架文件 | 成功写入并有 backup/audit |
| E2E-05 grant 路径越界 | grant 仅允许 file A | 写 file B | 拒绝 |
| E2E-06 并发 child 隔离 | 两个 build 子任务 | child B 复用 child A grant | 拒绝 |
| E2E-07 过期 grant | TTL 到期 | 写目标文件 | 拒绝 |
| E2E-08 shell bypass | 有 grant | 用 bash/safe_shell 重定向写 `.opencode/**` | 仍被 shell bypass / scope gate 拒绝 |
| E2E-09 非 Orchestrator 授权 | build/general 发起 grant | 创建 `framework_maintenance` | 拒绝 |
| E2E-10 Super-Admin exemption 清理 | config 无 agent exemption | 修改源码/框架文件 | 仍要求 CodeGraph impact |

---

## 10. 风险与回滚

### 10.1 主要风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| dispatch_key 绑定不准确 | grant 被错误 child 使用 | P0 先做 exact binding E2E；权限逻辑禁止 fallback |
| 静态 permission 与动态 grant 冲突 | 工具请求到不了内部校验 | 首选新增 `safe_framework_edit`，避免放宽 `safe_edit` |
| CodeGraph 被误绕过 | 框架改动失去影响分析 | 明确 grant 不改变 CodeGraph gate |
| native Task metadata 缺失 | 通过 Task 派发无法自动 grant | MVP 只支持 `dispatch_subagent` active path，P3 再扩展 |
| 旧 Super-Admin 概念混淆 | 文档与运行身份不一致 | 文档和代码统一按 native build + legacy profile 映射处理 |

### 10.2 回滚策略

- DB migration 使用 add-column / create-table 幂等方式，不破坏既有字段。
- `safe_framework_edit` 可通过 `opencode.json` permission 禁用。
- privilege grant 创建可通过 feature flag 关闭，例如 `dispatch_privilege.enabled=false`。
- CodeGraph exemption 清理如造成阻塞，可临时恢复 path-level exemption，不恢复 agent-level exemption。

---

## 11. 最小可行实施顺序

建议按以下顺序推进：

1. **只做 P0**：补齐 dispatch exact binding schema 和 queue 返回字段，确认运行 DB 与代码 schema 一致。
2. **做 P1 但不写文件**：Orchestrator dispatch 能创建、绑定、过期 grant，并输出审计事件。
3. **新增 `safe_framework_edit`**：先只允许一个测试 fixture 路径，跑通 grant + CodeGraph 双门。
4. **扩大 allowed path**：逐步覆盖 `.opencode/plugin-handlers/**`、`.opencode/service/**`、`.opencode/agents/**`。
5. **清理 `super-admin` CodeGraph exemption**：在 E2E 通过后移除 agent-level exemption。
6. **再考虑 native Task metadata**：只有当实际调度链路需要 Task 直接携带 grant 时再做。

---

## 12. 成功标准

当前状态（2026-07-07）：尚未达成。主要阻断点是 exact key 未进入 queue、grant 未能稳定绑定 child session、`safe_framework_edit` 未暴露给执行 agent，以及 CodeGraph 被 grant bypass。

本方案完成后，应满足：

- 弱模型仍是任务主要执行方。
- 强模型/Orchestrator 只在任务开始时授予窄范围临时权限。
- 弱模型不能凭 agent 身份获得常驻框架写权限。
- 框架维护写入必须同时满足 grant 和 CodeGraph impact。
- 所有 grant 都可审计、可过期、可撤销。
- 并发子任务之间不能互相复用权限。
- 旧的 `Super-Admin` agent exemption 不再是安全边界。

---

## 13. 对旧版 blueprint 的修订摘要

| 旧版主张 | v2.0 修订 |
|----------|-----------|
| 使用 `dispatch_scope` | 改为 `dispatch_privilege` / `maintenance_grant` |
| `hasFrameworkScope()` 让 CodeGraph 放行 | 废弃；grant 不得绕过 CodeGraph |
| P0-B `dispatch_key` schema 已就绪 | 修正为代码 schema 与运行 DB 漂移，必须先迁移 |
| Task hook 可消费 dispatch_queue | 修正为 legacy inactive，MVP 走 `dispatch_subagent` active path |
| Super-Admin 是主要运行身份 | 修正为 legacy profile 映射，实际 native executor 多为 `build` |
| 修改 `session_map` 添加 scope 即可 | 改为独立 `dispatch_privilege_grants` 表 + child session 精确绑定 |
| 直接让 build 写 `.opencode/**` | 改为首选 `safe_framework_edit` 专用工具 |

### v2.1 状态修订

| v2.0 假设/计划 | 2026-07-07 复核修订 |
|----------------|----------------------|
| P0/P1 尚待实施 | schema/table/service 已部分实施，但 queue exact key 写入和 child bind 未闭合 |
| `safe_framework_edit` 作为推荐新增工具 | 工具已新增，但未在 `opencode.json` 暴露，且 CodeGraph handler 当前错误绕过 impact gate |
| D.2 可作为 P1 通过证据 | D.2 只算组件级证据，不能证明 live dispatch privilege E2E |
| P4 清理待做 | config/default 已收紧，但仍缺 E2E 验证 |
