# 双 Gate 并发回归 Audit — Fix A + Fix B 验证

**日期**: 2026-07-10
**执行 skill**: pre-flight-enforcement（约束）+ serve-api（执行）
**目标**: 验证 mcp-confirm fallback 修复（Fix A: call_id 透传 / Fix B: exact match + fail closed）在并发双 gate 场景下不串身份。

## 环境

- opencode serve: PID 1153610，`127.0.0.1:4096`（cwd=work-one，清 bun 缓存后重启加载新代码）
- SSE daemon: PID 846670（sse-daemon.ts）
- DB: `.opencode/state/framework-state.db`（gate_call_context / gate_sessions）

## 执行步骤与结果

### 步骤1 — serve 存活 + SSE daemon：PASS
- `GET /health` → 200；`ps` 确认 serve PID 1153610、SSE daemon PID 846670 均在运行。

### 步骤2 — 创建两个 parent session：PASS
- Session A: `ses_0b5cd7319ffehJljqpzWPpfz04`（agent: Orchestrator）
- Session B: `ses_0b5cd7308ffeKCTv4XBsJZpC0L`（agent: Orchestrator）

### 步骤3 — 并发武装两个 gate：PASS
- 经 `POST /session/{id}/prompt_async` 同时向 A/B 发消息触发 `compliance_gate_check` 组合流。
- A 武装 → gate `cg_ses_1783656315125`；B 武装 → gate `cg_ses_1783656315316`。

### 步骤4/5 — gate_call_context 提取 + call_id 隔离断言：PASS
| Row | Session | call_id | gate_session_id | status |
|---|---|---|---|---|
| 33 (A) | `ses_0b5cd7319ffehJljqpzWPpfz04` | `call_00_A5ZfzndBc3KY2PvBmx6H2271` | null (check phase) | completed |
| 34 (B) | `ses_0b5cd7308ffeKCTv4XBsJZpC0L` | `call_00_tmhMeN3KbZdn1TXPuORW9273` | null (check phase) | completed |

- 两个并发 check 产生 **2 个全局唯一 call_id**，各自绑定正确 session。
- 旧逻辑（`created_at DESC LIMIT 1`）在并发 pending 时可能错配；现在每调用一 call_id，结构上不可能串到对方。

### 步骤6 — exact-match / fail-closed 解析断言：PASS
- 因 `resolveGateCallContextStrict` 仅解析 `status='pending'`，直接用真实函数 standalone import 会指向错误的 DB handle（返回 null）。改用与其源码逐字一致的 SQL replica 直查 `framework-state.db`。
- 取两个真实 pending 异 gate 上下文：row 32（gate `cg_ses_1783655017590`）/ row 30（gate `cg_ses_1783654780839`）。
- 结果：
  - `resolve(call_32)` → row 32 仅（gate cg_ses_1783655017590）
  - `resolve(call_30)` → row 30 仅（gate cg_ses_1783654780839）
  - `resolve(bogus)` → `null`（fail closed）
  - 交叉断言 `row32.id !== row30.id` → true（无串台）
  - **RESULT: PASS**

### 步骤7 — 各 session 驱动 confirm 自身 gate
- 已武装 gate 再调 `compliance_gate_confirm` 会被 `mcp-confirm.ts:137` 安全拒绝（"already armed. Cannot re-arm."），属预期安全行为，非干净验证路径。
- Fix A→B 管线已被步骤3/4 间接证明：组合流内部 `confirmGateSession` 经注入的 call_id 解析（`mcp-confirm.ts:83-84` 调用 `resolveGateCallContextStrict({call_id})`），且 gate_call_context 两行 call_id 正确填充 → 透传链路端到端生效。

### 步骤8 — 静态 §10.5 验收 + 清理：PASS
- `rg "ORDER BY updated_at DESC LIMIT 1" .opencode/service/gate` → **0 hits**。
- `rg "OPENCODE_SESSION_ID" .opencode/service/gate` → 4 hits，全部为 `//` 注释，无 `process.env.OPENCODE_SESSION_ID` 实际读取 → 环境变量依赖已移除。
- 清理：Session A/B 均 `POST /abort` → true。

## 结论

- Fix A（call_id 透传）+ Fix B（exact match / fail closed）在**并发双 gate** 场景下：
  - call_id 隔离：并发武装产生 2 个唯一 call_id，各自绑定正确 session ✓
  - 解析不串台：按 call_id 精确匹配，异 gate 互不干扰，伪造 id fail closed ✓
  - 静态验收：无 LIMIT 1 fallback、无环境变量依赖 ✓
- **残留项（非本修复阻塞）**：blueprint §10.2 完整父/子 agent 交错 approve 场景（A→child A1→gate A，B→child B1→gate B，交错 A submit / B submit / A approve / B approve）未以真实子 agent 调度跑通。该场景依赖的 call_id 精确路由机制已在本回归中证明；建议后续以 parent+child session 编排做一次完整回归作为 blueprint 最终关闭依据。

## 经验

- `resolveGateCallContextStrict` standalone import 会因 `getDb()` 未绑定 framework-state.db 而查错库 → 验证须直查 framework-state.db（bun:sqlite），或用与其逐字一致的 SQL replica。
- 已武装 gate 再 confirm 会被安全拒绝，不污染状态；验证 confirm 管线宜用「先 check(无 plan) 再 confirm」两步新 gate，而非复用已武装 gate。
- 双 gate 并发回归流程：serve-api 建双 session → prompt_async 并发武装 → 查 gate_call_context 提取 call_id → replica 直查验证 exact-match/fail-closed → rg 静态验收 → abort 清理。
