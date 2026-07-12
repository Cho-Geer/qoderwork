# Phase 3: Enforcement 热路径瘦身 — 静态实施 + 漂移验证

**为什么**: 按路线图顺序推进 Phase 3（Enforcement 从身份绑定转行为治理）。核心是把全局 enforcement mode（advisory/strict/locked）收敛为 per-rule disposition，隔离 legacy hard-block handler，固化 before 9 / after 7 / system 2 链路。

**改了什么**:
- `service/gate/checklist-validate.ts` — 加 `LEGACY HANDLER — NOT in active execution_order` 文件头；删除旧 "Phase 0 (initial_read) hard constraint" 叙事注释（改写说明已转 rule-disposition 驱动）。走 grant(`d5b43669`) + plan(`4cb2a92e`)，已 consumed/completed；`bun build` 通过。

**没改（已确认满足，非遗漏）**:
- Step 1 mode compat：active before/after/system handler **不 import** 旧 `service/gate/enforcement` 的 `getEnforcementMode`（仅 git hooks + scripts 引用）；active 链已用 `rule-disposition.ts` 的 `getRuleDisposition`/`shouldBlock`。旧 mode shim（`getEnforcementModeCompat`/`isStrictOrLockedCompat`）已是 `@deprecated` no-op。Step 1 完成门槛（active 不按 mode 阻断）已满足。
- Step 2 per-agent 层：`PermissionIsolation` 类已 `DEPRECATED (2026-07-07)`；`getAgentPermission` 是 Phase 2 G3 触碰过的 legacy fallback；`isWriteAllowed`/`getAgentShellAllowlist` 仍被 `file-guard`/legacy 引用，深重构属 follow-up。
- Step 3 dispatcher 漂移：脚本验证 `plugin_execution_order` 与三 dispatcher `HANDLER_MAP` **完全一致**（before 9 / after 7 / system 2，无 orphan）。Step 3 完成门槛已满足。

**决策**:
- Step 4 实际只需给 `checklist-validate.ts` 加头——其余 6 个 legacy handler（phase0-enforce/checklist/json-validate/before-uc7ks/dispatch-validate/after-uc7ks）在前序 Phase 已带 legacy 头。
- 框架路径写入一律先建 grant+plan（DB 真实 schema：`dispatch_privilege_grants` 含 `agent_type/privilege/allowed_tools/allowed_paths/reason` 等；`framework_maintenance_plans` 含 `rationale/risk_level/updated_at`）。注意 `new Database(DB,{create:false})` 在 bun v1.3.14 报 SQLITE_MISUSE，改用 `new Database(DB)`。

**待 runtime 闭环（需 serve session，非静默遗漏）**:
- Step 5 Question full-runtime：五段证据（STOP/question/reply/recovery/guidance）未跑。
- Step 6 framework maintenance edge-case matrix：grant gate 已实操可用（本阶段即证明），但边界矩阵（无 grant/无 plan/无 CodeGraph/TTL 过期/budget 耗尽/complete 后写）需 live 验证。
- Step 1.2/1.3、Step 2 深重构：test/doc 的 `advisory/strict/locked` → rule id 清理属低风险 follow-up，未批量改。
