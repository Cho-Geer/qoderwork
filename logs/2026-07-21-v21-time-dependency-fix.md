# v2.1 时间依赖修复 + capture-state --freeze — 变更日志

**日期**: 2026-07-21

## 为什么
v2.1 审计流程中 `PRE_CHANGE_TIME_INVALID` 要求 `pre_change.captured_at ≤ scope.frozen_at`，但 `capture-state.ts` 需要 scope-lock 已含 `frozen_at` 才能计算 `scope_lock_sha256` 绑定，构成循环依赖。`pre_change ≤ frozen_at` 是人为顺序约束，非实质性审计保证。

## 改了什么
- `validate-audit.ts`：`PRE_CHANGE_TIME_INVALID` 检查从 `preAt > frozenAt` 改为 `preAt > sweepCompletedAt`；`sweepCompletedAt` 提取为共享变量供 pre-change 和 verdict-state 两个检查块使用。
- `capture-state.ts`：新增 `--freeze <ISO8601>` 可选参数和 `freezeAt` 选项；提供时，在计算 `scope_lock_sha256` 前将 `scope.frozen_at` 和 `scope.status=FROZEN` 写入 scope-lock 文件（原子操作）。
- `capture-state.test.ts`：新增 3 个测试（--freeze 设置验证、幂等性、无 --freeze 不修改文件）。
- `SKILL.md`：时间依赖图从链式 `pre_change ≤ frozen_at ≤ sweep ≤ verdict_state` 改为三条独立约束；ERROR_CODE 速查表补 `PRE_CHANGE_TIME_INVALID`；Step 1 示例增加 `--freeze` 用法。

## 决策
- 不修改 AGENTS.md P-02（描述步骤顺序，不声明时间戳约束，顺序在修改后仍有效）。
- 不修改 plan 文档和模板文件（不引用具体时间约束）。
- 不修改 `FREEZE_AFTER_SWEEP` 和 `VERDICT_STATE_TIME_INVALID`（实质性约束，不变）。

## 更新了什么文档
- `.agents/skills/plan-audit-archiver/SKILL.md`（3 处段落更新）。
- 本日志 `logs/2026-07-21-v21-time-dependency-fix.md`（新建）。
