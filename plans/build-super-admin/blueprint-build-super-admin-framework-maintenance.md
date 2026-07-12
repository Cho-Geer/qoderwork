# Build/Super-Admin 框架维护授权重构蓝图

状态: 待实施
日期: 2026-07-08
适用仓库: `/home/zhaoge/workspace/opencode/work-one`
产物用途: 交给弱模型执行；完成后由强模型按本文验收清单复核。

## 0. 审核结论

本轮按当前代码、DB schema、before-hook 路由和现有文档复核。原分析的大方向属实，但需要修正两个点，并补充一个遗漏的 scope enforcement 漂移。

| 结论 | 判定 | 当前证据 |
| --- | --- | --- |
| `Super-Admin` 实际映射到 native executor `build` | 属实 | `.opencode/service/dispatch/agent-target.ts:60-64` |
| `dispatch_privilege` 是可选输入，不会自动创建 | 属实 | `.opencode/service/dispatch/router.ts:125-139`, `.opencode/scripts/command-tools/dispatch-subagent.ts:136-143` |
| 无 grant 时 `safe_framework_edit` 报 `NO-GRANT` | 属实 | `.opencode/tools/safe_framework_edit.ts:58-70` |
| 当前 framework grant 一次成功写入后被消费 | 属实 | `.opencode/tools/safe_framework_edit.ts:83-99`, `.opencode/service/dispatch/privilege.ts:204-210` |
| `behavioral-path-guard` 未覆盖 `safe_framework_edit` | 属实 | `.opencode/plugin-handlers/before/behavioral-path-guard.ts:20-22`; `before-dispatcher.ts` 的 filter 也未路由该工具 |
| `codegraph.ts` 声明拦截 `safe_framework_edit`，但 `before-dispatcher.ts` 未路由 | 属实 | `.opencode/plugin-handlers/before/codegraph.ts:14-23`, `.opencode/plugins/before-dispatcher.ts:40-48` |
| `router.ts` 会写入 `dispatch:child:{dagTaskId}` 合成键 | 属实 | `.opencode/service/dispatch/router.ts:358-366` |
| “真实 child sid 没写入 `session_map`” | 需修正 | `.opencode/plugins/session.ts:81-105` 会在 child session 创建时写真实 sid；真正风险是绑定时序和并发歧义 |
| “`codegraph.ts:129` 仍有硬编码错误文案” | 不属实 | 当前代码已无该硬编码；当前错误文案在 `.opencode/plugin-handlers/before/codegraph.ts:209-218` |

补充发现:

- `safe_framework_edit` 还会绕过 scope path 识别: `.opencode/service/dispatch/tool-scope-match.ts:24-41` 的 modify tool 列表未包含它，导致 `.opencode/service/dispatch/tool-scope-paths.ts:294-307` 无法把它当成写工具解析。
- `tools/dispatch_subagent.ts` 的描述仍写着 “one-time grant” 和 “allowed_paths required”，这已经和目标行为冲突，必须同步更新。
- 当前 `repo_operation_grants` 也是一次性消费模型，但本蓝图只改 framework maintenance，不顺手重构 repo grant。

## 1. 用户约束转成设计原则

必须满足以下设计原则:

1. 不接受“一文件一次 Super-Admin 派遣”。
2. 不要求 Orchestrator 在派遣前提供非空 `allowed_paths`。
3. 不要求 Orchestrator 预先分析“应该改哪些文件、怎么改”。Orchestrator 的职责是调度和授权任务级能力，不是做框架维护方案设计。
4. 文件级影响分析、修改计划、具体编辑应由被派遣的 `build` / Super-Admin 子 Agent 在自己的 session 内完成。
5. 不能把授权做成无限放权。必须有默认路径策略、子 Agent 自声明计划、多写预算、CodeGraph 约束和日志审计。

## 2. 推荐方案

采用“任务级 framework maintenance grant + 子 Agent 自主计划 + 多写预算”的模型。

流程如下:

1. Orchestrator 派遣 `Super-Admin` / `build`，只提供 `dispatch_privilege="framework_maintenance"` 和任务理由。
2. grant 创建时如果没有 `allowed_paths`，系统使用框架维护默认路径策略，而不是拒绝。
3. 子 Agent 进入自己的 session 后，先运行 CodeGraph 查询，判断影响范围和需要修改的文件。
4. 子 Agent 调用新增的 `framework_maintenance_plan` 工具，声明本任务计划修改的路径、原因、风险和 CodeGraph 证据。
5. 子 Agent 在同一个 session 内多次调用 `safe_framework_edit`，每次写入必须同时满足:
   - 有 active bound framework grant；
   - 目标路径在 grant policy 允许范围内；
   - 目标路径已出现在 active plan 的 `planned_paths`；
   - 同 session 已记录 CodeGraph explore/impact；
   - `writes_used < max_writes`。
6. 子 Agent 完成后调用 `framework_maintenance_complete` 消费/完成 grant；如果忘记完成，grant 到 TTL 后过期。

## 3. 被否决方案

| 方案 | 结论 | 原因 |
| --- | --- | --- |
| 一文件一次派遣 | 否决 | 交互成本高、弱模型容易重复丢上下文，也不符合任务级维护的自然粒度 |
| Orchestrator 必须提供 `allowed_paths` | 否决 | 把文件级分析责任放到了调度者身上，违反 Orchestrator 职责边界 |
| 一次 grant 只允许一次成功写入 | 否决 | 框架级任务经常需要同时改工具、service、hook、配置和测试；单写会强迫拆任务 |
| 给 build 一个无限宽 grant | 否决 | 弱模型执行风险太高，缺少计划、预算和路径策略 |
| 推荐方案: 子 Agent 计划 + 多写预算 | 采用 | 保留调度职责边界，同时把具体编辑限制在可审计的计划和预算内 |

## 4. 目标行为

### 4.1 Orchestrator 侧

Orchestrator 只需要这样派遣:

```ts
dispatch_subagent({
  agent_type: "Super-Admin",
  task: "...框架维护任务...",
  dispatch_privilege: "framework_maintenance",
  privilege_reason: "...为什么需要框架维护权限..."
})
```

`allowed_paths` 仍然可以作为“额外收窄”输入保留，但不得再是必填项。

### 4.2 子 Agent 侧

子 Agent 需要按顺序执行:

1. 读取任务和相关代码。
2. 调用 CodeGraph 查询影响范围。
3. 调用 `framework_maintenance_plan` 声明 planned paths。
4. 使用 `safe_framework_edit` 完成多文件写入。
5. 跑验证。
6. 调用 `framework_maintenance_complete` 结束 grant。

### 4.3 默认路径策略

建议默认允许:

- `.opencode/**`
- `opencode.json`
- `AGENTS.md`

建议默认阻断:

- `.opencode/state/**`
- `.opencode/state.db`
- `.opencode/_test_framework/**`
- `.task_temp/**`
- `node_modules/**`
- `.git/**`
- 任意绝对路径、`..` 越界路径、符号链接越界路径

如果团队希望先保持更小范围，可以第一版只允许 `.opencode/**`，但必须把 `opencode.json` 作为显式可配置项保留；否则很多框架权限或 agent 配置修改仍会被迫绕回 `safe_edit`。

## 5. 数据模型变更

在 `.opencode/lib/db-manager.ts` 增加下一版本迁移。当前已有 v35 `repo_operation_grants`，所以建议新增 v36。执行前以当前文件为准，如果已有 v36，则使用下一个空版本号。

### 5.1 扩展 `dispatch_privilege_grants`

新增列:

```sql
ALTER TABLE dispatch_privilege_grants ADD COLUMN max_writes INTEGER DEFAULT 1;
ALTER TABLE dispatch_privilege_grants ADD COLUMN writes_used INTEGER DEFAULT 0;
ALTER TABLE dispatch_privilege_grants ADD COLUMN policy_version TEXT DEFAULT 'framework-maintenance-v1';
ALTER TABLE dispatch_privilege_grants ADD COLUMN completed_at TEXT;
```

迁移要求:

- 使用 `PRAGMA table_info(dispatch_privilege_grants)` 做幂等检查，不要重复 `ALTER`。
- 旧 grant 默认 `max_writes=1`，避免历史行为突然扩大。
- 新 `framework_maintenance` grant 的默认 `max_writes` 由配置决定，不能沿用旧默认 1。

### 5.2 新增 `framework_maintenance_plans`

```sql
CREATE TABLE IF NOT EXISTS framework_maintenance_plans (
  id TEXT PRIMARY KEY,
  grant_id TEXT NOT NULL,
  child_session_id TEXT NOT NULL,
  dag_task_id TEXT,
  planned_paths TEXT NOT NULL,
  codegraph_targets TEXT NOT NULL,
  rationale TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY(grant_id) REFERENCES dispatch_privilege_grants(id)
);
CREATE INDEX IF NOT EXISTS idx_framework_plans_grant_status
  ON framework_maintenance_plans(grant_id, status);
CREATE INDEX IF NOT EXISTS idx_framework_plans_session_status
  ON framework_maintenance_plans(child_session_id, status);
```

`planned_paths` 和 `codegraph_targets` 存 JSON 数组。第一版不要建复杂归一化表，降低实现风险。

## 6. 配置变更

在 `.opencode/project.config.json` 增加 framework maintenance policy。建议结构:

```json
{
  "dispatch_privilege": {
    "framework_maintenance": {
      "ttl_minutes": 45,
      "default_max_writes": 8,
      "hard_max_writes": 20,
      "default_allowed_paths": [
        ".opencode/**",
        "opencode.json",
        "AGENTS.md"
      ],
      "blocked_paths": [
        ".opencode/state/**",
        ".opencode/state.db",
        ".opencode/_test_framework/**",
        ".task_temp/**",
        "node_modules/**",
        ".git/**"
      ],
      "require_plan": true,
      "require_codegraph": true
    }
  }
}
```

如果当前配置已有同名上层节点，合并，不要覆盖既有配置。

## 7. 逐文件实施步骤

### Phase 0: 预检

执行目录: `/home/zhaoge/workspace/opencode/work-one`

1. `git diff --stat`，确认已有未提交改动，不要覆盖用户改动。
2. `codegraph status`，如果 pending，先 `codegraph sync`。
3. `rg -n "framework_maintenance|safe_framework_edit|dispatch_privilege_grants" .opencode opencode.json`
4. 记录当前 schema 最新版本，决定本次迁移版本号。

### Phase 1: 新增 policy 模块

新增文件:

`/.opencode/service/dispatch/framework-maintenance-policy.ts`

职责:

- 读取 `.opencode/project.config.json` 的 policy。
- 返回默认 allowed paths、blocked paths、default/hard max writes。
- 提供路径标准化和匹配函数。

建议导出:

```ts
export interface FrameworkMaintenancePolicy {
  ttlMinutes: number;
  defaultMaxWrites: number;
  hardMaxWrites: number;
  defaultAllowedPaths: string[];
  blockedPaths: string[];
  requirePlan: boolean;
  requireCodeGraph: boolean;
  policyVersion: string;
}

export function getFrameworkMaintenancePolicy(): FrameworkMaintenancePolicy;
export function normalizeFrameworkPath(path: string): string;
export function isFrameworkPathAllowed(path: string, allowed: string[], blocked: string[]): boolean;
export function resolveGrantAllowedPaths(inputAllowedPaths?: string[]): string[];
export function resolveGrantMaxWrites(inputMaxWrites?: number): number;
```

实现要求:

- `normalizeFrameworkPath()` 必须拒绝绝对路径、空路径、`..` 越界。
- wildcard 匹配可复用当前已有 glob/match 工具；没有稳定 helper 时，只实现 `/**` 后缀和精确匹配，避免引入新依赖。
- `inputAllowedPaths` 只能收窄默认 policy，不能扩大到 blocked paths。

### Phase 2: 修改 dispatch privilege service

修改文件:

`.opencode/service/dispatch/privilege.ts`

目标:

- `allowed_paths` 对 `framework_maintenance` 不再必填。
- 新 grant 支持 `max_writes`、`writes_used`、`policy_version`。
- 成功写入不再立即消费整个 grant，改为记录一次写入。
- 增加完成/撤销入口。

建议变更:

1. `CreateGrantInput` 增加:

```ts
allowed_paths?: string[];
max_writes?: number;
```

2. 删除当前 “`allowed_paths` 为空直接 throw” 的逻辑，改为:

```ts
const allowedPaths = resolveGrantAllowedPaths(input.allowed_paths);
const maxWrites = resolveGrantMaxWrites(input.max_writes);
```

3. `hasGrant(sessionId, privilege, path)` 改为同时检查:

- `status='bound'`
- `expires_at > now`
- `writes_used < max_writes`
- path 符合 grant allowed paths 与 blocked paths

4. 新增:

```ts
export function recordGrantWrite(grantId: string): void;
export function completeGrant(grantId: string): void;
```

`recordGrantWrite()` 行为:

- `writes_used = writes_used + 1`
- 如果 `writes_used >= max_writes`，设置 `status='consumed'`、`consumed_at=now`
- 必须记录结构化日志，例如 `GRANT-WRITE-RECORDED`

`completeGrant()` 行为:

- 主动完成任务时设置 `status='consumed'`、`consumed_at=now`、`completed_at=now`
- 必须记录 `GRANT-COMPLETED`

注意:

- 不要删除 `consumeGrant()`，旧调用和其他逻辑可能还依赖它。
- `safe_framework_edit` 改用 `recordGrantWrite()`，不再直接调用 `consumeGrant()`。

### Phase 3: 新增 framework maintenance plan service

新增文件:

`.opencode/service/dispatch/framework-maintenance-plan.ts`

职责:

- 创建 active plan。
- 查询当前 session 的 active plan。
- 判断某个 path 是否在 plan 内。
- 完成 plan。

建议导出:

```ts
export function createFrameworkMaintenancePlan(input: {
  sessionId: string;
  grantId: string;
  dagTaskId?: string;
  plannedPaths: string[];
  codegraphTargets: string[];
  rationale: string;
  riskLevel?: "low" | "medium" | "high";
}): { id: string };

export function getActiveFrameworkMaintenancePlan(sessionId: string, grantId: string): FrameworkMaintenancePlan | null;
export function assertPathInActivePlan(sessionId: string, grantId: string, path: string): void;
export function completeFrameworkMaintenancePlan(sessionId: string, grantId: string): void;
```

校验要求:

- `plannedPaths` 不允许为空。
- 每个 path 必须满足 grant policy。
- `codegraphTargets` 不允许为空。
- 同一 `sessionId + grantId` 同时只能有一个 active plan。重复创建时，要么拒绝，要么覆盖为新 plan；第一版建议拒绝，避免弱模型误覆盖。
- 所有拒绝都要给出可执行错误信息。

### Phase 4: 新增两个工具

新增文件:

- `.opencode/tools/framework_maintenance_plan.ts`
- `.opencode/tools/framework_maintenance_complete.ts`

`framework_maintenance_plan` 输入:

```ts
{
  planned_paths: string[];
  codegraph_targets: string[];
  rationale: string;
  risk_level?: "low" | "medium" | "high";
}
```

行为:

- 从当前 `sessionID` 找 active bound `framework_maintenance` grant。
- 验证 planned paths 均在 grant policy 内。
- 写入 `framework_maintenance_plans`。
- 返回 plan id、grant id、max writes、剩余写入次数。

`framework_maintenance_complete` 输入:

```ts
{
  summary: string;
}
```

行为:

- 找当前 session active grant 和 active plan。
- 标记 plan complete。
- 调用 `completeGrant()`。
- 返回完成摘要。

工具文案要求:

- 明确写出 Orchestrator 不需要提供文件列表。
- 明确写出 build 子 Agent 必须先 CodeGraph，再 plan，再 edit。

### Phase 5: 修改 `safe_framework_edit`

修改文件:

`.opencode/tools/safe_framework_edit.ts`

当前行为:

- 只允许 `.opencode/`
- 检查 grant
- 写入
- `consumeGrant(grant.id)`

目标行为:

1. 路径允许范围由 framework policy 决定，不再硬编码只能 `.opencode/`。
2. 写入前检查 active grant。
3. 写入前检查 active plan 且 target path 在 `planned_paths` 内。
4. 写入后调用 `recordGrantWrite(grant.id)`。
5. 返回剩余写入次数。

伪代码:

```ts
const relPath = normalizeFrameworkPath(args.path);
const grant = hasGrant(sessionId, "framework_maintenance", relPath);
if (!grant) throw noGrantError(...);

assertPathInActivePlan(sessionId, grant.id, relPath);

await writeSafeFull({ ... });
recordGrantWrite(grant.id);
```

错误信息要区分:

- `NO-GRANT`: 没有 active grant。
- `NO-PLAN`: 没有 active framework maintenance plan。
- `PATH-NOT-IN-PLAN`: 目标路径没有列入 plan。
- `WRITE-BUDGET-EXHAUSTED`: 超出 grant 写入预算。
- `PATH-BLOCKED`: 命中 blocked path。

### Phase 6: 修复 before-chain 路由漂移

修改文件:

- `.opencode/plugins/before-dispatcher.ts`
- `.opencode/plugin-handlers/before/codegraph.ts`
- `.opencode/plugin-handlers/before/behavioral-path-guard.ts`
- `.opencode/service/dispatch/tool-scope-match.ts`
- `.opencode/service/dispatch/tool-scope-paths.ts`

必须完成:

1. `before-dispatcher.ts`
   - `TOOL_FILTER.codegraph` 加入 `safe_framework_edit`。
   - `TOOL_FILTER["behavioral-path-guard"]` 加入 `safe_framework_edit`。
   - hot-path 统计列表加入 `safe_framework_edit`。
   - 保留现有 `github_*` wildcard 逻辑，不要回退。

2. `codegraph.ts`
   - 当前已经声明 `safe_framework_edit`，主要确认 dispatcher 路由后可实际触发。
   - 如果 CodeGraph 状态记录依赖 after-hook，补充日志，确保同 session 的 `codegraph_explore` 能被识别。
   - 不要恢复旧的 `@Super-Admin` 硬编码错误文案。

3. `behavioral-path-guard.ts`
   - 把 `safe_framework_edit` 纳入 `WRITE_TOOLS`。
   - 对 `safe_framework_edit` 使用显式 grant-aware 分支:
     - 不要把它当普通 `safe_edit` 直接拦死；
     - 记录 `BEHAVIORAL-PATH-GUARD-DELEGATED-FRAMEWORK-GRANT`；
     - 让 `safe_framework_edit` 自身完成 grant + plan + policy 校验。

4. scope path
   - `tool-scope-match.ts` 的 modify tool 识别加入 `safe_framework_edit`。
   - `tool-scope-paths.ts` 能从 `args.path` 提取路径。
   - 对 `safe_framework_edit` 的 `.opencode/**` / `opencode.json` 框架路径要和 policy 一致。

### Phase 7: 修复 session/grant 绑定歧义

修改文件:

- `.opencode/plugins/session.ts`
- `.opencode/service/dispatch/router.ts`
- `.opencode/scripts/command-tools/dispatch-subagent.ts`

目标:

- 保留真实 child sid 写入 `session_map` 的逻辑。
- 减少 “按 parent 找最新 pending/running queue” 的并发歧义。

最低要求:

1. `router.ts` 创建 dispatch queue 时生成并持久化 `dispatch_key`。
2. `dispatch-subagent.ts` 将 `DISPATCH_KEY` 注入 child 启动环境或 prompt marker。当前已有 grant 创建需要 dispatch key，继续沿用。
3. `session.ts` 绑定 grant 时优先使用精确 `dispatch_key`；只有没有 key 时才 fallback 到 parent 最新队列。
4. 如果同一 parent 下存在多个 pending/running dispatch 且无法精确匹配，必须拒绝绑定并记录 `GRANT-BIND-AMBIGUOUS`，不要猜最新。

这部分不是为了证明当前一定失败，而是为了把“时序竞态/并发歧义”从隐患变成可观测、可拒绝的状态。

### Phase 8: 更新工具声明和权限

修改文件:

- `.opencode/tools/dispatch_subagent.ts`
- `opencode.json`
- `.opencode/agents/Super-Admin.md`
- 如有 build/native agent 工具清单，也要同步。

必须完成:

1. `dispatch_subagent.ts` 文案删除:
   - “one-time dispatch_privilege_grant”
   - “allowed_paths required when dispatch_privilege is set”
2. 新文案说明:
   - `framework_maintenance` 默认创建任务级 grant；
   - `allowed_paths` 是可选收窄；
   - 具体 planned paths 由 child session 通过 `framework_maintenance_plan` 声明。
3. `opencode.json` 给 `build` 允许:
   - `framework_maintenance_plan`
   - `framework_maintenance_complete`
   - `safe_framework_edit`
   - CodeGraph 查询工具
4. 不要给 Orchestrator 新增文件写能力。

## 8. 测试计划

### 8.1 单元测试

至少覆盖:

1. `createGrant()` 无 `allowed_paths` 时能创建 framework grant，并使用默认 policy。
2. `createGrant()` 显式传入 blocked path 时拒绝。
3. `hasGrant()` 在 `writes_used >= max_writes` 时返回 null。
4. `recordGrantWrite()` 会递增 `writes_used`。
5. `recordGrantWrite()` 到达预算后把 grant 置为 `consumed`。
6. `framework_maintenance_plan` 拒绝空 `planned_paths`。
7. `framework_maintenance_plan` 拒绝 grant policy 外路径。
8. `safe_framework_edit` 无 plan 时拒绝。
9. `safe_framework_edit` 目标路径不在 plan 中时拒绝。

### 8.2 before-chain 测试

至少覆盖:

1. `before-dispatcher` 会把 `safe_framework_edit` 路由到 `codegraph`。
2. `before-dispatcher` 会把 `safe_framework_edit` 路由到 `behavioral-path-guard`。
3. `tool-scope-match.isModifyTool("safe_framework_edit") === true`。
4. `tool-scope-paths` 能解析 `safe_framework_edit({ path })`。
5. `github_*` wildcard 路由仍然有效，不被本次修改破坏。

### 8.3 集成测试

建议新增 fixture 流程:

1. 创建 parent session。
2. dispatch `Super-Admin` / `build`，只传 `dispatch_privilege="framework_maintenance"`，不传 `allowed_paths`。
3. child session 创建后绑定 grant。
4. child 调用 CodeGraph。
5. child 调用 `framework_maintenance_plan`，planned paths 包含两个测试文件。
6. child 连续两次调用 `safe_framework_edit` 成功。
7. 第三次超过 `max_writes` 时被拒绝，或在预算内继续成功。
8. child 调用 `framework_maintenance_complete` 后，再次写入被拒绝。

测试文件建议放在可清理的 fixture 路径，例如:

- `.opencode/service/dispatch/__framework_plan_test_a__.ts`
- `.opencode/service/dispatch/__framework_plan_test_b__.ts`

测试结束必须删除 fixture 文件或恢复原内容。

### 8.4 Live E2E 验证

必须从 Orchestrator 入口触发，不允许只调底层函数:

1. 清 bun 缓存。
2. 重启 serve。
3. 通过 serve API 创建 Orchestrator session。
4. 发送任务: “派遣 Super-Admin/build 做一个需要改两个框架测试文件的维护任务，不提供 allowed_paths。”
5. 观察日志:
   - `GRANT-CREATED`
   - `GRANT-BOUND`
   - `FRAMEWORK-PLAN-CREATED`
   - `CODEGRAPH-ENFORCE-PASS`
   - `FRAMEWORK-EDIT-SUCCESS`
   - `GRANT-WRITE-RECORDED`
   - `GRANT-COMPLETED`
6. 确认没有出现:
   - `NO-GRANT`
   - `PATH-NOT-IN-PLAN`，除非测试故意触发
   - `CODEGRAPH-ENFORCE-BLOCK`，除非测试故意触发
   - `GRANT-BIND-AMBIGUOUS`

## 9. 弱模型执行清单

按顺序执行，不要跳步:

- [ ] 预检 `git diff --stat`，确认不覆盖已有改动。
- [ ] `codegraph sync`，确认索引最新。
- [ ] 新增 v36 DB 迁移，幂等扩展 grant 表并创建 plan 表。
- [ ] 新增 framework maintenance policy service。
- [ ] 修改 `privilege.ts` 支持默认路径、写入预算、`recordGrantWrite()`、`completeGrant()`。
- [ ] 新增 framework maintenance plan service。
- [ ] 新增 `framework_maintenance_plan` tool。
- [ ] 新增 `framework_maintenance_complete` tool。
- [ ] 修改 `safe_framework_edit` 为 grant + plan + policy + multi-write 模型。
- [ ] 修复 `before-dispatcher` 对 `safe_framework_edit` 的 filter 路由。
- [ ] 修复 `behavioral-path-guard` 的显式 grant-aware 分支。
- [ ] 修复 scope path 对 `safe_framework_edit` 的识别。
- [ ] 修复 session grant 精确绑定，无法精确匹配时拒绝。
- [ ] 更新 `dispatch_subagent` 工具描述。
- [ ] 更新 `opencode.json` 和 agent 工具清单。
- [ ] 添加单元、before-chain、集成测试。
- [ ] 清 bun 缓存并跑验证。
- [ ] 从 Orchestrator 入口跑 live E2E。
- [ ] 写 qoderwork `logs/YYYY-MM-DD-<topic>.md` 说明为什么改、改了什么、关键决策。

## 10. 强模型最终验收清单

完成实施后，验收者必须逐项确认:

1. Orchestrator 可以不传 `allowed_paths` 成功创建 framework grant。
2. 同一个 child session、同一个 grant 能成功写两个计划内 framework 文件。
3. 子 Agent 未创建 plan 时，`safe_framework_edit` 拒绝写入。
4. 子 Agent 修改 plan 外路径时，`safe_framework_edit` 拒绝写入。
5. 超出 `max_writes` 时拒绝继续写入。
6. `framework_maintenance_complete` 后 grant 不可再写。
7. `safe_framework_edit` 实际经过 CodeGraph before-hook。
8. `safe_framework_edit` 不再默默绕过 behavioral path guard 和 scope path 识别；如果委托给 grant-aware 分支，日志必须清楚。
9. `codegraph.ts` 没有恢复旧的 `@Super-Admin` 硬编码错误文案。
10. 并发 dispatch 无法精确绑定时 fail closed，并有 `GRANT-BIND-AMBIGUOUS` 日志。
11. `dispatch_subagent` 文案不再误导弱模型认为必须一文件一次 grant。
12. `opencode.json` 未给 Orchestrator 新增文件写权限。
13. Live E2E 必须从 Orchestrator 入口触发通过。

## 11. 回滚方案

如果实施后出现严重阻断:

1. 配置加开关:

```json
{
  "dispatch_privilege": {
    "framework_maintenance": {
      "multi_write_enabled": false
    }
  }
}
```

2. `safe_framework_edit` 在开关关闭时回退到旧行为:
   - active grant；
   - 单次写入；
   - `consumeGrant()`。
3. 新增 DB 列和 plan 表不删除，保留为向前兼容数据。
4. 新增 tools 从 `opencode.json` 禁用即可停止暴露。
5. before-chain 对 `safe_framework_edit` 的 CodeGraph 路由不要回滚，除非它本身导致所有 framework maintenance 全阻断；该路由漂移是已证实问题。

## 12. 实施边界

本蓝图不处理:

- repo grant 的一次性消费模型；
- GitHub MCP write grant 的远程写入授权；
- explore agent 模型选择；
- 历史日志重写；
- 大规模 session registry 重构。

这些问题可以后续独立立项，避免本次 build/Super-Admin 授权重构失焦。
