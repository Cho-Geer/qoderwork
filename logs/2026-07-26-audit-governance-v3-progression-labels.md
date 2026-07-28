# 2026-07-26 审计治理 v3 正式 PLAN_SET 补进度标签

**为什么**：正式 v3 PLAN_SET 过了 v3 准入，但过不了 P-02A 进度门卫（validate-phase-progression.ts），无法提交 PHASE-01 scope-lock 批准。

**改了什么**（仅计划书实例三处，不动代码/门卫/模板）：
- 00-plan-index.md：补 `**Progression schema**: phase-progression/v1`；Status `NOT_STARTED` → `READY-FOR-IMPLEMENTATION`（派生值）。
- 01-phase-surface-conformance.md：补 `**Progression status**: NOT_STARTED`。

**决策**：`phase-progression/v1` 是活动进度契约（其他 3 个在用 plan 都用），非 pre-v3 兼容入口；progression 门卫的 v3 化（消费 audit-phase-progression/v3）属 phase-2，不在此抢跑。

**遗留 finding**：F-PHASE01-TEMPLATE-PROGRESSION-MARKER —— v3 PLAN-SET-TEMPLATE.md 漏了进度标记，登记给 PHASE-01 surface/conformance 揪出并修复。

**更新文档**：logs/INDEX.md。
