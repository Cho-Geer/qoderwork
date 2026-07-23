# P0-3-01 状态转换守卫与重复 run ID 拒绝 — 实施日志

**日期**: 2026-07-22
**Phase**: P0-3-01（state-contract）
**审计**: ACCEPT（component ceiling，v2.1-required provenance）

## 为什么

TSI-01 缺口：`setRunState` 直接赋值无转换守卫；`createRunContext` 随机生成 run ID 无重复拒绝。

## 改了什么

- `run-context.ts`: 加 `TRANSITION_TABLE` + `setRunState` 守卫；`createRunContext` 先推导 run ID 再 `existsSync` 检查
- `types.ts`: `CreateRunHooks` 加 `makeRunId` 可选 hook
- `process.ts`: export `validateRunProcess`（test-only）
- 3 个测试文件新增 P03-S-01~S-06 测试（28 pass / 0 fail）

## 决策

- 转换表含 FAILED 为 terminal（任何非 terminal 状态可转 FAILED）
- 现有测试 line 109 的 WORKTREE_READY→STOPPED 改为合法路径（经 READY→BOOTSTRAPPED→EXECUTED→STOPPED）
- sse-daemon.ts 未修改（read-only verification）

## 更新了哪些文档

- `blueprints/blueprint-isolated-serve-test-infrastructure.md`: TSI-01 状态 → ✅ 已实施（component）
- `audits/p0-3/`: scope-lock、pre-change/verdict-state receipt、15 EV receipts、audit report、LATEST.md
