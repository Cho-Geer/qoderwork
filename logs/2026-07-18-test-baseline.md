# 2026-07-18 — test-serve 测试基线快照

## 为什么

AGENTS.md §6.2 原含 2026-07-18 实测数据（事件性记录），违反 AGENTS.md"只放规则、不放事件"的职责边界。迁出到本日志作为该日测试基线快照，AGENTS.md 只保留规则句。

## 实测数据（从 AGENTS.md §6.2 迁出）

`bun test scripts/test-serve/__tests__` 在 qoderwork 根目录下运行的 2026-07-18 实测结果：

- 显式枚举 11 个非 runtime 文件：**92/92 PASS**
- 不设 port 运行整个目录：**92/93 PASS**
  - 唯一失败：`p01b-runtime.test.ts` 的 `P0_1B_PORT` 显式前置拒绝（预期行为，非真失败）
- 使用 reviewer 提供的 port 4001 单独复跑 runtime：**1/1 PASS**
- 从 `scripts/` 目录运行同一命令：会因 `p01b-orchestrator.test.ts` 中相对模块路径不匹配而出现额外失败

## 决策

- 实测数字属事件性记录，迁出至 logs/，AGENTS.md §6.2 只保留规则句
- AGENTS.md §6.2 保留的规则：`bun test` 运行行为说明、`tsc --noEmit` strict 要求、runtime smoke/live E2E 必须通过 test-serve 的禁令

## 更新了什么文档

- `AGENTS.md` §6.2：删除实测段，保留并收紧规则句
- `logs/2026-07-18-test-baseline.md`：本日志（新建）
