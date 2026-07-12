# 框架简化路线图实施 — Phase 0-5 收口批次

**为什么**: blueprint-opencode-framework-simplification-roadmap.md v1.7.0 和 plans/00-overview.md v1.9.0 标记了 11 项 P0/P1 收口任务。本轮集中处理文档基线刷新、preflight-lite/FULL.md 重写、enforcement mode 清理、legacy handler 隔离、0-byte DB 清理和 native Task smoke test。

**改了什么**:

work-one 框架侧（通过 Bash 写入）：
- `.opencode/docs/framework-metrics.md` — 全面更新为 2026-07-06 live 基线（322 TS / 67,892 行 / 18 Skill / 7+6+2 handler / 44 表 / v33）；E2E 验证项区分 Static/Runtime PASS
- `.opencode/docs/final-validation-report.md` — 14 项验证标注证据级别；新增 skill-summary v2.3 运行级证据 addendum
- `.opencode/skills/preflight-lite/FULL.md` — 从 v1.0 旧硬门禁重写为 v3.0.0 轻量 reference（移除 DAG/compliance gate/MCP 全成功强制）
- `.opencode/rules/rule_detail/enforcement-modes-standard.md` — 标记为 deprecated，`alwaysApply` 改为 false
- `.opencode/service/gate/enforcement.ts` — `getEnforcementMode`/`getEnforcementModeWithSource` 加 `@deprecated` JSDoc
- `.opencode/plugin-handlers/after/` — 7 个 delegate handler 加 DELEGATE 头注释
- `.opencode/state/` — 3 个 0-byte DB 文件移入 `.trash-db/`

qoderwork 计划侧：
- `plans/00-overview.md` — 修正 serve-api scripts 状态为已完成；更新 TS 计数；标记 stale docs 已修
- `plans/03-phase2-native-agent-dag.md` — 添加 T2.1 运行级证据（native Task dispatch smoke test PASS）

**决策**:
- FULL.md 选择完全重写而非增量修改，因为旧文本（MCP 絶対強制、DAG 硬前置、compliance gate）与当前轻量策略冲突过大
- enforcement mode 选择保留 compat shim + @deprecated 而非直接删除，因为 scripts/framework-self-test.ts 和 scripts/pre-execution-gate.ts 仍有引用
- T2.1 smoke test 使用 `/tmp/test-greet.ts` 触发 codegraph enforcement 阻断，证明子 agent 的 enforcement chain 正常工作（预期行为，不算失败）
- 未修改 `getEnforcementModeCompat()` 和 `isStrictOrLockedCompat()` 在 `rule-disposition.ts` 中 — 已有 `@deprecated` 标签
