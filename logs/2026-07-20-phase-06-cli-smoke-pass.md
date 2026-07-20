# PHASE-06 CLI Smoke PASS + 循环依赖修复

**为什么**: PHASE-05 审计 ACCEPT 后，使用第二组 reviewer 端口 4003/4004 执行独立 CLI-only dual-run smoke，证明 test-serve p0-2 入口独立有效。

**改了什么**:
- 新增 `scripts/test-serve/cleanup.ts`：从 isolated-serve.ts 提取 cleanupRun，打破循环依赖（isolated-serve → p02-orchestrator → isolated-serve）
- 修改 `scripts/test-serve/isolated-serve.ts`：移除内联 cleanupRun 定义，改为 import + re-export；将 import.meta.main 入口移至文件末尾修复 TDZ
- 修改 `scripts/test-serve/p02-orchestrator.ts`：import cleanupRun 从 ./cleanup
- 修改 `scripts/test-serve/p01b-orchestrator.ts`：import cleanupRun 从 ./cleanup
- 更新 `plans/隔离 serve 测试基建待办/p0-2/00-plan-index.md`：PHASE-06 BLOCKED→DONE

**决策**: 循环依赖是 PHASE-02/03 遗留的阻断性缺陷（CLI 完全不可用），与 PHASE-05 修复的 4 处缺陷同类。采用最小化提取（cleanup.ts）打破环路，不改变任何行为逻辑。45 pass / 0 fail / 264 expect() 确认无回归。

**更新文档**:
- `plans/隔离 serve 测试基建待办/p0-2/00-plan-index.md`（PHASE-06 状态更新）
- `logs/2026-07-20-phase-06-cli-smoke-pass.md`（本文件）
