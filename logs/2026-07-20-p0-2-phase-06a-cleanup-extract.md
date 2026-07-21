# PHASE-06a: cleanupRun 提取打破循环依赖 + 修复 TDZ

- 日期: 2026-07-20
- Plan: `plans/隔离 serve 测试基建待办/p0-2/06a-phase-circular-dependency-fix.md`
- Scope-lock: `audits/p0-2/scope-lock-phase-06a.json` (APPROVED, provenance_level=v2.1-required)
- Receipt: `audits/p0-2/evidence/pre-change-PHASE-06a-v2.json` (实施者捕获, P-02 步骤3-4)

## 为什么
PHASE-06 audit-1 INVALID 发现 CLI 因循环依赖/TDZ 实际不可用（`p0-2 --help` 抛 `Cannot access 'P02_KNOWN_FLAGS' before initialization`）。需提取 cleanupRun 到独立模块打破循环依赖，并把 import.meta.main 移到文件末尾消除 TDZ，为 PHASE-04 恢复 p0-2 路由铺路。

## 改了什么
- 新增 `scripts/test-serve/cleanup.ts`：从 isolated-serve.ts 逐行提取 `cleanupRun`（行为等价，无逻辑改动）。
- 修改 `scripts/test-serve/isolated-serve.ts`：删除内联 cleanupRun，改为 `export { cleanupRun } from "./cleanup"` re-export；移除仅 cleanupRun 使用的 run-context/types import；将 `import.meta.main` 块从顶部移到文件末尾（在所有模块级 const 之后）。
- 修改 `scripts/test-serve/p02-orchestrator.ts`：`import { cleanupRun } from "./isolated-serve"` → `from "./cleanup"`。
- 修改 `scripts/test-serve/p01b-orchestrator.ts`：同上。

## 验证（component 级）
- noCycle：`bun -e "await import('./isolated-serve.ts')"` → IMPORT_OK:NO_CYCLE；p02-orchestrator 同样 OK。
- cliNoTDZ：`bun run isolated-serve.ts p0-2 --help` → 返回 usage 文本，exit 0，无 ReferenceError；`p0-1b --help` exit 0 干净报错。
- cleanupBehavior：`bun test` 6 个 cleanup 相关测试文件 → 65 pass / 0 fail。
- backwardCompat：`bun run typecheck` 4 个 allowed files 零错误（全量 typecheck 的报错均在 out-of-scope 文件：_b_l3_012_*、外部 shell-targets.ts、p02-cli*.ts）。

## 决策
- 严格限于 4 个 allowed files；未改 verify-p02/verify-p01b/process/run-context/bootstrap/execute/types/p02-sentinel，未改 cleanupRun 行为，未运行 runtime smoke，未设 H2_AUTHORIZED。
- 改动未提交（`git add` 仅 4 个 allowed files 由 reviewer 决定）；PHASE-06 仍 BLOCKED，待本 phase 审计 ACCEPT 后再走 Freeze Gate。

## 更新文档
- `audits/p0-2/evidence/pre-change-PHASE-06a-v2.json`（新建）
- `logs/2026-07-20-p0-2-phase-06a-cleanup-extract.md`（本文件）
- `logs/INDEX.md`（追加索引）
