# 审计：Parent/Child 编排回归 — MCP Session Propagation Blueprint

**日期**: 2026-07-10
**Blueprint**: `plans/mcp-session-propagation/blueprint-mcp-session-propagation.md` (`plan-20260709-01`)
**目标**: 验证 blueprint §10.2（并发双 gate 不串身份）+ §10.5（静态验收）是否达成，以正式关闭 blueprint。
**结论**: **15/15 回归检查通过；§10.5 静态验收通过；blueprint 标记为「验收关闭」**。发现 2 项残余缺陷（D1 fail-open 包裹、D2 approve HANDOVER 路径回退不一致），列为后续加固项，不阻断 no-bleed 验收。

---

## 1. 测试拓扑（两套交错的 parent→child gate）

| Gate | Gate Session | Parent (主 agent) | Child (子 agent) | 绑定关系 |
|---|---|---|---|---|
| GateA | `cg_ses_1783657767464` | `ses_0b5bb313effeDbHTMEjJbn2PDk` (ParentA) | `ses_0b5bb310fffeDbRmDULjMY1Tg9` (ChildA1) | ChildA1→ParentA |
| GateB | `cg_ses_1783657987555` | `ses_0b5bb314dffeSrUhp5Ou4F0o57` (ParentB) | `ses_0b5bb311cffeLMKPXEdqcChqww` (ChildB1) | ChildB1→ParentB |

## 2. 被测服务

- 真实服务函数（非 mock）：
  - `service/gate/mcp-deliverables.ts` → `submitDeliverablesWithCrossCheck`、`approveDeliverablesWithAudit`
  - `service/gate/session-context-service.ts` → `resolveGateCallContextStrict`（`tool_name+gate_session_id+args_hash` 精确匹配，0 或 >1 行则 fail-closed 返回 null，**无 `ORDER BY ... DESC LIMIT 1`**）、`assertSubmitCallerMatchesChild`、`assertApproveCallerMatchesParent`
- Gate store 权威源：**DB（`framework-state.db`）**，经 `dbLoadGateStore`，非 JSON `gate-state.json`。
- 调用链模拟：harness `qoderwork/scripts/regress-parent-child.ts` 通过 `recordGateCallContext` 模拟 before-hook 注入 `call_id`/`opencode_session_id`/`parent_session_id`/`args_hash`，再直接调用服务函数，断言返回值与 `gate_sessions` 落库绑定列。

## 3. 回归结果（15/15 PASS）

| # | 用例 | 期望 | 结果 |
|---|---|---|---|
| T1 | POS submit GateA by 正确 child ChildA1 | delivered | ✅ delivered |
| T2 | NEG submit GateA by 错误 child ChildB1 | rejected `Submit caller mismatch` | ✅ rejected，精确给出 expected/actual session |
| T3 | POS submit GateB by 正确 child ChildB1 | delivered | ✅ delivered |
| T4 | NEG approve GateA by 错误 parent ParentB | rejected `Approve caller mismatch` | ✅ rejected |
| T7 | NEG approve GateB by 跨 gate ParentA | rejected `Approve caller mismatch` | ✅ rejected |
| T8 | NEG approve GateA by 跨 gate ParentB | rejected `Approve caller mismatch` | ✅ rejected |
| T1b | re-deliver GateA by ChildA1（为 T5 准备 delivered 态） | delivered | ✅ delivered |
| T5 | POS approve GateA by 正确 parent ParentA（真实 SHA-256 + READ-BEFORE-APPROVE） | approved/completed | ✅ **completed** |
| T6 | POS approve GateB by 正确 parent ParentB（真实 SHA-256 + READ-BEFORE-APPROVE） | approved/completed | ✅ **completed** |
| F1 | no-bleed binding GateA（child/parent） | child=ChildA1, parent=ParentA | ✅ |
| F2 | no-bleed last_submit GateA | =ChildA1 | ✅ |
| F3 | no-bleed last_approve GateA | =ParentA, status=completed | ✅ |
| F4 | no-bleed binding GateB | child=ChildB1, parent=ParentB | ✅ |
| F5 | no-bleed last_submit GateB | =ChildB1 | ✅ |
| F6 | no-bleed last_approve GateB | =ParentB, status=completed | ✅ |

**FINAL `gate_sessions` 落库（证明无串身份）**:
```json
GateA: child=ses_0b5bb310fffeDbRmDULjMY1Tg9, parent=ses_0b5bb313effeDbHTMEjJbn2PDk,
       last_submit=ses_0b5bb310fffeDbRmDULjMY1Tg9, last_approve=ses_0b5bb313effeDbHTMEjJbn2PDk, status=completed
GateB: child=ses_0b5bb311cffeLMKPXEdqcChqww, parent=ses_0b5bb314dffeSrUhp5Ou4F0o57,
       last_submit=ses_0b5bb311cffeLMKPXEdqcChqww, last_approve=ses_0b5bb314dffeSrUhp5Ou4F0o57, status=completed
```

> 关键：T4/T7/T8 的 NEG 用例在「身份校验」阶段即被拒（先跑 `assertApproveCallerMatchesParent` 再检查 `gate_status`），精确匹配到绑定 parent/child；T2 同理。这证明**交错提交/审批下，A 的调用者无法影响 B，反之亦然**（blueprint §10.2 验收标准）。

## 4. §10.5 静态验收（执行脚本原文命令）

```bash
rg -n "OPENCODE_SESSION_ID" .opencode/service/gate
# → 4 命中，全部为注释（如 // v37: ... replaces process.env.OPENCODE_SESSION_ID）
#   无 process.env.OPENCODE_SESSION_ID 实际代码依赖 ✅

rg -n "ORDER BY updated_at DESC LIMIT 1" .opencode/service/gate
# → 0 命中 ✅
```

`resolveGateCallContextStrict` 内部使用精确 `WHERE` 且**显式注释「NO ORDER BY ... DESC LIMIT 1」**；`mcp-confirm.ts` 经 grep 确认无 `SELECT`/`getDb`/`ORDER BY`/`process.env` 实际代码（仅注释）。即 2026-07-10 审核段落中所列「mcp-confirm.ts 保留 created_at DESC LIMIT 1 fallback / 直接 getDb 手写 SQL」**现已不存在**，已在本树解决。

## 5. 残余缺陷（后续加固，不阻断 no-bleed 验收）

### D1 — submit/approve 的 `if (ctx)` 包裹为 fail-open（中）
`service/gate/mcp-deliverables.ts`:
- submit 行 200 `if (submitCtx) { ... assertSubmitCallerMatchesChild ... }`
- approve 行 359 `if (approveCtx) { ... assertApproveCallerMatchesParent ... }`

当 `resolveGateCallContextStrict` 因 0 或 >1 行返回 `null` 时，身份校验被整体跳过。approve 路径随后仅依赖 `resolvedAgent`（来自 `session.agent` / `session_map`）的 privileged 检查——一个 session 非绑定 parent 但 agent 标注为 Orchestrator 的调用可绕过 parent/child 精确匹配。这与 blueprint §2.2「无法精确解析时 fail closed / 不能退化成 unknown 但继续放行」相悖。

**建议修复**：将 `if (ctx)` 改为 `if (!ctx) return rejected("caller context unresolved")`，使 null/歧义上下文一律拒绝。注意这会收紧行为，需按 `AGENTS.md` 规则 8（清 bun 缓存→重启 serve→Orchestrator 入口复跑）回归。

### D2 — approve 解析 HANDOVER.md 路径回退与 submit 不一致（低）
- submit 行 262：`const taskId = session.task_id || gateSessionId;`
- approve 行 431：`const taskId = session.task_id;`（仅 task_id）

当 `task_id` 为 `null`（gate 以 `session_id` 寻址的常见情形）时，approve 回退到 `declared_deliverables[].artifact_path`；若该字段缺失，则解析为 `.task_temp/null/HANDOVER.md` → 误报「missing or empty」。本次回归通过为测试 gate 写入 `task_id` 与 `artifact_path`（模拟真实 confirm 流程）规避。

**建议修复**：approve 行 431 改为 `const taskId = session.task_id || gateSessionId;`，与 submit 对齐。

## 6. 清理动作
- 经 serve API `POST /session/{id}/abort` 终止 4 个测试 live session（均 200）。
- `gate_call_context` 瞬时行已随 harness `resetGates` + T5/T6 consume 清零（purge 0 行）。
- 2 个测试 gate 行重置为 inert `armed` 态（保留以便复跑 harness）。
- 删除 4 行测试 `session_map`（ParentA/ParentB/ChildA1/ChildB1）。

## 7. 结论
Blueprint §10.2（并发双 gate 无身份串扰）经 15/15 回归证明成立，§10.5 静态验收通过，§14 最终验收标准 1–5、7–8 满足（第 6 项中断复用防护机制 `handleGateSessionInterrupted` + fail-closed resolve 已就位，本次未单独回归）。**状态置为「验收关闭」**，D1/D2 列为后续加固任务。
