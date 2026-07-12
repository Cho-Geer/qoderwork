# MCP Session Propagation 运行时验证报告

**日期**: 2026-07-09
**Blueprint**: `blueprint-mcp-session-propagation.md`
**验证方法**: serve API 直调 + DB 查询（serve-api skill）

---

## 0. 2026-07-10 代码复审状态

本报告的 v11 运行结果仍可作为**历史运行证据**，但结合 2026-07-10 当前代码复审，需要把“运行通过”和“蓝图已闭环”区分开：

| 项目 | 当前状态 | 说明 |
|---|---|---|
| v37 schema 本地生效 | ✅ 已确认 | 本地 `framework-state.db` 已是 schema v37，`gate_call_context` 表存在，`gate_sessions` 新增 6 列已落库 |
| 去除 gate MCP 对 `process.env.OPENCODE_SESSION_ID` 的直接依赖 | ✅ 已确认 | 当前 `mcp-check` / `mcp-confirm` / `mcp-deliverables` / `mcp-complete` 主流程已改为读 DB context |
| before/after dispatcher 注册 gate context handler | ✅ 已确认 | 当前代码已注册 |
| exact match / fail closed 完全达标 | ❌ 未达标 | `mcp-confirm.ts` 仍保留按 `gate_session_id` 取最近记录的 fallback；`resolveGateCallContextStrict()` 也仍是 latest-row 语义 |
| MVC 分层完全达标 | ❌ 未达标 | `mcp-confirm.ts` 仍直接 `getDb()` 并手写 SQL 访问 `gate_call_context` |
| `tool.execute.after` 根因已修复 | ⚠️ 未重新验证 | 当前代码仍保留 after-hook handler，同时也保留 service 内部直接 `UPDATE` 的 workaround，说明根因未确认关闭 |
| serve API 创建 session 自动入 `session_map` | ⚠️ 仅代码可见，未补跑 | `plugins/session.ts` 当前存在 `session.created` 写 `session_map` 路径，但本次未重跑 serve API 场景确认 |

补充静态验证：

- `bunx tsc -p tsconfig.json --noEmit` 当前未通过，但失败点落在其他模块和测试文件，不能作为本方案已回归或未回归的直接证据。

---

## 1. 验证目标

验证 v37 migration 实现的 DB-backed context bridge 在真实 serve API 环境下正确替代 `process.env.OPENCODE_SESSION_ID`，具体包括：

1. `gate_call_context` 表在 gate tool 调用前后正确记录/更新
2. `gate_sessions` 表的 `opencode_session_id` 正确持久化
3. parent/child session binding 在 confirm 后写入
4. caller match validation 阻止非匹配 session 的操作

---

## 2. 验证环境

| 组件 | 版本/路径 |
|------|----------|
| opencode binary | `/home/zhaoge/.opencode/bin/opencode` (ELF, 2026-07-08 build) |
| serve API | `localhost:4096` |
| DB | `.opencode/state/framework-state.db` (SQLite, schema v37) |
| Plugin SDK | `@opencode-ai/plugin` (`~/.opencode/node_modules/`) |
| 测试 session | Orchestrator agent, 通过 `POST /session` 创建 |

---

## 3. 测试结果（v11 最终轮）

| # | 检查项 | 结果 | 证据 |
|---|--------|------|------|
| 1 | before-hook 写入 gate_call_context | ✅ PASS | id=17,18 两条记录 |
| 2 | gate_session_id 正确捕获 | ✅ PASS | confirm 记录: `cg_ses_1783602246632` |
| 3 | agent 正确解析 | ✅ PASS | `Orchestrator` |
| 4 | auto-lookup 找到 context | ✅ PASS | `found: true` in log |
| 5 | gate_sessions.opencode_session_id 持久化 | ✅ PASS | `ses_0b905cc04fferqZcc97CPD8Tnn` |
| 6 | context status → completed | ✅ PASS | `completed_at=1783602250126` |
| 7 | parent/child binding | N/A | root session 无 parent（设计正确） |

---

## 4. 迭代历程（v1 → v11）

| 轮次 | 问题发现 | 修复 |
|------|---------|------|
| v1-v2 | `gate_call_context` 表为空，handler 不触发 | TOOL_FILTER 加 MCP 前缀 |
| v3-v4 | handler 触发但 `gate_session_id` 和 `args_hash` 全为零 | args 从 `output.args` 读取 |
| v5 | MCP server 报 `output is not defined` | 函数参数 `_output` → `output` |
| v6-v7 | auto-lookup 找到 context 但 binding 不写入 | `callContext` → `resolvedContext` |
| v8 | `opencode_session_id` 内存设置正确但 DB 为 null | dbSaveGateStore UPSERT 加 v37 列 |
| v9 | 框架更新后 session_id 格式变化 | 用户更新框架 |
| v10 | after-hook 不触发，status 永远 pending | MCP service 内部直接 UPDATE |
| **v11** | **全部通过** | — |

---

## 5. 发现的问题点

### 问题 1: MCP 工具名前缀不匹配（P0）

**现象**: before-hook 的 HANDLER-START 日志中没有 `gate-call-context` handler。

**根因**: MCP 工具在 plugin hook 中的名称带 server 前缀（`compliance-gate_compliance_gate_check`），但 TOOL_FILTER 和 GATE_TOOLS 使用的是无前缀名称（`compliance_gate_check`）。

**影响**: gate-call-context handler 完全不触发，gate_call_context 表始终为空。

**修复**: 
- `before-dispatcher.ts` TOOL_FILTER 加前缀
- `after-dispatcher.ts` TOOL_FILTER 加前缀
- `before/gate-call-context.ts` GATE_TOOLS 加前缀

**文件**: 3 个文件

---

### 问题 2: Plugin hook 的 args 位置错误（P0）

**现象**: gate_call_context 记录的 `args_hash` 全部相同（空对象 `{}` 的 hash），`gate_session_id` 全部为 null。

**根因**: Plugin hook 的工具参数在 `output.args` 中，而非 `input.args`。`input.args` 始终为空对象 `{}`。参照 `gate-validate.ts:220` 的 `const args = output?.args || {}` 确认。

**影响**: 无法从 args 中提取 gate_session_id，args_hash 无法用于 MCP service 层的 auto-lookup 匹配。

**修复**: `before/gate-call-context.ts` 改为 `output?.args || input.args || {}`

**文件**: 1 个文件

---

### 问题 3: 函数参数命名错误（P1）

**现象**: MCP server 报 `output is not defined` 错误，gate check 工具调用失败。

**根因**: handler 函数签名使用 `_output`（下划线前缀表示未使用），但代码中引用了 `output`。

**修复**: `_output` → `output`

**文件**: 1 个文件

---

### 问题 4: auto-lookup 结果未使用（P0）

**现象**: auto-lookup 成功找到 context（`found: true`），但 gate_sessions 的 `opencode_session_id` 仍为 null。

**根因**: auto-lookup 将结果写入 `resolvedContext` 变量，但后续代码（agent 解析、opencode_session_id 设置、parent/child binding）全部读取 `callContext`（原始参数，为 null）。

**影响**: context bridge 的核心功能完全失效 — opencode_session_id 不写入 gate_sessions。

**修复**: mcp-confirm.ts 中 3 处 `callContext?.` → `resolvedContext?.`

**文件**: 1 个文件

---

### 问题 5: dbSaveGateStore UPSERT 缺 v37 列（P0）

**现象**: 内存中 `session.opencode_session_id` 设置正确（日志确认），但 DB 查询始终为 null。

**根因**: `db-state-manager.ts` 的 `dbSaveGateStore` 函数的 UPSERT 语句不包含 v37 新增的 7 个列（`opencode_session_id`, `parent_opencode_session_id`, `child_opencode_session_id`, `last_submit_session_id`, `last_approve_session_id`, `interrupted_at`, `interruption_source`）。

**影响**: 所有 v37 新增字段无法持久化到 DB。

**修复**: UPSERT 语句添加 7 列到 INSERT、ON CONFLICT DO UPDATE（使用 COALESCE 防止 null 覆盖）、.run() 参数。

**文件**: 1 个文件

---

### 问题 6: `tool.execute.after` hook 框架不触发（P1，workaround）

**现象**: after-dispatcher 的 PLUGIN-LOADED 和 HOOK-REGISTERED 日志正常，但 runtime log 文件在所有日期都不存在。

**根因**: opencode binary 源码中虽有 `s.trigger("tool.execute.after", ...)` 调用，但实际运行时从未触发。只有 after-dispatcher.ts 注册了此 hook（无其他 plugin 可对比），无法确定是 trigger 实现 bug 还是 hook 类型未完全支持。

**影响**: gate_call_context 的 status 永远停留在 `pending`，无法通过 after-hook 标记 `completed`。

**Workaround**: 在 mcp-confirm.ts 的 `saveGateStore` 之后直接执行 `UPDATE gate_call_context SET status='completed'`。

**文件**: 1 个文件（workaround）

---

### 问题 7: args_hash 在 before-hook 和 MCP service 之间不一致（P2）

**现象**: before-hook 存储的 args_hash 来自 `output.args`（完整的 MCP 工具参数），MCP service 的 auto-lookup 计算的 args_hash 来自硬编码的子集（`session_id`, `plan_summary`, `agent`, `task_id`）。两者 hash 永远不匹配。

**影响**: strict lookup（tool_name + gate_session_id + args_hash）永远失败，必须依赖 fallback lookup。

**Workaround**: 添加 fallback lookup — 当 strict 匹配失败时，仅按 `gate_session_id` 查询最近一条 pending 记录。

**文件**: 1 个文件（fallback）

---

### 问题 8: session_map 不自动注册 serve API 创建的 session（P2）

**现象**: 通过 `POST /session` 创建的 session 不在 session_map 中，导致 `resolveAgent()` 返回 null、`getParentSessionId()` 返回 null。

**影响**: gate_call_context 记录的 agent 字段为 null，parent_session_id 为 null。

**Workaround**: 测试时手动 INSERT session_map。正式环境需要 `session.created` hook 自动注册。

**文件**: 无（运行时 workaround）

---

## 6. 修改文件清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `.opencode/plugins/before-dispatcher.ts` | 修改 | TOOL_FILTER 加 MCP 前缀 |
| `.opencode/plugins/after-dispatcher.ts` | 修改 | TOOL_FILTER 加 MCP 前缀 |
| `.opencode/plugin-handlers/before/gate-call-context.ts` | 修改 | GATE_TOOLS 前缀 + output.args + 参数名 + getDb 移到 service |
| `.opencode/plugin-handlers/after/gate-call-context.ts` | 修改 | toolName 匹配加前缀 |
| `.opencode/service/gate/mcp-confirm.ts` | 修改 | resolvedContext 修复 + fallback lookup + status completed workaround |
| `.opencode/service/gate/session-context-service.ts` | 修改 | 新增 getParentSessionId + resolveGateCallContextBySession |
| `.opencode/lib/db-state-manager.ts` | 修改 | dbSaveGateStore UPSERT 加 v37 列 |
| `scripts/db-query.ts` | 新建 | DB 查询工具脚本 |
| `scripts/db-schema.ts` | 新建 | DB schema 查看工具脚本 |
| `package.json` | 修改 | 添加 db:query 和 db:schema npm scripts |

---

## 7. 待解决项

1. **`tool.execute.after` hook**: 需向 opencode 框架报告此 bug，或等框架更新后验证
2. **args_hash 一致性**: before-hook 和 MCP service 使用不同 args 计算 hash，需要统一或永久依赖 fallback
3. **session_map 自动注册**: serve API 创建的 session 需要 `session.created` hook 自动写入 session_map
4. **parent/child binding 验证**: 需要 sub-agent dispatch 场景验证（root Orchestrator 无 parent，无法验证 binding）
5. **submit/approve caller match**: 需要完整的 sub-agent 调度链验证 `assertSubmitCallerMatchesChild` 和 `assertApproveCallerMatchesParent`

### 7.1 2026-07-10 复核后状态

- **问题 1-5**：代码层面已保留修复结果，相关文件仍在当前工作树中，可视为“实现仍存在”。
- **问题 6 (`tool.execute.after`)**：仍不能标记为根因已修复；当前代码同时保留 after-hook 注册和 service 内部 `UPDATE gate_call_context` workaround。
- **问题 7 (`args_hash` 一致性)**：仍未根治。当前实现继续依赖 fallback/最近记录语义，不符合 blueprint 的 exact match 目标。
- **问题 8 (`session_map` 自动注册)**：当前代码存在 `session.created` 写 `session_map` 的路径，但本次没有新的 serve API 运行证据，因此状态应从“纯 workaround”更新为“代码已补，运行态待复验”。
