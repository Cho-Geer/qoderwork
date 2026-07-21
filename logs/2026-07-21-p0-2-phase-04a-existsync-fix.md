# PHASE-04a absoluteInputs existsSync Fix — 实施日志

**日期**: 2026-07-21
**Phase**: PHASE-04a
**Provenance**: v2.1-required（Freeze Gate 已完成）

## 为什么
PHASE-04 审计 G1/G2/G3 标注 F-001：`absoluteInputs` 仅校验 `isAbsolute`，未校验 `existsSync`，对"不存在的绝对路径"放行。本 phase 关闭该债务。

## 改了什么
- `scripts/test-serve/isolated-serve.ts`：import 增加 `existsSync`；`absoluteInputs` 块增加 `!existsSync(p02PrimaryWorktree) || !existsSync(p02MainFrameworkDb)`。
- `scripts/test-serve/__tests__/p02-cli.test.ts`：`BASE_ARGS` fixture 由 `/fake/*` 改为 `mkdtempSync` 真实临时路径（`beforeEach` 重建 + `writeFileSync` 建 DB）；新增 `P02-C-PATH-EXIST`（不存在绝对 DB → exit 1 / check=absoluteInputs / runP02 0）。

## 验证
- `bun test p02-cli + p01b-orchestrator` → 44 pass / 0 fail（原 43 + 新增 1）。
- `bun run isolated-serve.ts --help` → 含 p0-2 行。
- `git diff --check`（scoped）→ clean。
- 代码变更严格限定 2 个 allowed_files（session 前既存的 3 个计划/技能文件改动不在本 phase）。

## 决策
- 不改 `runP02` contract、success/failure JSON 映射、其他 Check Registry 项（行为等价）。

## 更新了什么文档
- 本日志 `logs/2026-07-21-p0-2-phase-04a-existsync-fix.md`（新建）。
- 正式 v2.1 审计（capture-state receipt + validate-audit.ts）待审计者执行，PHASE-07 维持 blocked。
