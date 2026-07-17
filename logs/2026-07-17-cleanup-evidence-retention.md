# cleanup evidence 留存契约收口

**为什么**: cleanup-report.json 位于 run 目录，但 Blueprint 写"移除 worktree 和 run 目录"，导致 cleanup 后 evidence 丢失风险。

**改了什么**:
- `scripts/test-serve/types.ts` — CleanupResult 两分支加 evidenceRoot/manifestPath/cleanupReportPath/artifactsDir
- `scripts/test-serve/isolated-serve.ts` — cleanupRun() 用 manifest.paths.worktreeDir 替代 join；report 加 schemaVersion/evidence/worktreeRemoved；返回值加 evidence；CLI 输出加四条路径
- `scripts/test-serve/__tests__/cleanup.test.ts` — success/failure 用例加 retained artifact 哨兵、四条返回路径、report schema 断言
- `blueprints/blueprint-isolated-serve-test-infrastructure.md` §2.3 第6条 — "移除 worktree 和 run 目录" → "只移除 worktree，保留 run evidence bundle"
- `e2e/current-version-runtime-smoke-test-spec.md` — 删除 OPEN-RSM-01，更新 ORA-07/RSM-007/质量门禁

**决策**: 采用方案 A（保留 run root，只删除 worktree）；否决方案 B（双目录复制）和 C（仅复制 report）。组件验证 37/37 PASS。