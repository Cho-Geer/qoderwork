# Hotfix: TRANSITION_TABLE 与实际状态机对齐 - 实施日志

**日期**: 2026-07-22
**Phase**: P0-3-HOTFIX-TT（component-only）

## 为什么

P0-3-01 的 TRANSITION_TABLE 建模理想化线性生命周期，但 `stopRunProcesses` 从 READY/BOOTSTRAPPED/WORKTREE_READY 无条件调 `setRunState("STOPPED")`，全部非法。重启路径 `STOPPED->READY`、失败 run 清理 `BLOCKED->CLEANED` 也非法。所有路径被 fake 测试注入掩盖。

## 改了什么

- `run-context.ts`: TRANSITION_TABLE 扩展 5 条路径（+STOPPED 到 WORKTREE_READY/READY/BOOTSTRAPPED，+READY 到 STOPPED，+CLEANED 到 BLOCKED）
- `execute.ts`: gate 收紧，删除 READY 死分支
- `cleanup.ts`: 条件调用避免 BLOCKED 自环
- `cleanup-integration.test.ts`: line 73 合法生命周期行走
- `run-context.test.ts`: +2 测试（BLOCKED->CLEANED, BOOTSTRAPPED->STOPPED）
- `process.test.ts`: +1 测试（STOPPED->READY 重启）

## 决策

- STOPPED 语义为"进程未运行"，任何有进程的状态都应能停止
- BLOCKED 不再是纯 terminal，允许 CLEANED（失败 run 可清理）
- execute gate 的 READY 是死分支（bootstrapComplete=true 蕴含 BOOTSTRAPPED）

## 更新了哪些文档

- `plans/隔离 serve 测试基建待办/p0-3/07-hotfix-transition-table.md`: hotfix plan
- `audits/p0-3-hotfix/`: scope-lock、pre-change receipt、audit-note、LATEST
- `blueprints/blueprint-isolated-serve-test-infrastructure.md`: TSI-01 补充 hotfix 说明
