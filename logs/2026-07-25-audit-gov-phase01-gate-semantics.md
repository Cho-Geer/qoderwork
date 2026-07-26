# 2026-07-25 PHASE-01 plan completion gate 语义实施

## Why
plan `audit-governance-evidence-and-status-closure` PHASE-01 要求修复 `validate-plan.ts` 的 whole-document checkbox 规则，改为仅检查 `## Phase completion gate` 区段（REQ-001-A~D）。

## What changed
- `validate-plan.ts`：新增 `extractGateTokens()`（仅解析 gate 区段）；`checkEvidenceContracts` 增加 `isPlanSetPhase` 参数，PLAN_SET phase 文件不再要求 whole-document `[ ]`；progression 分支补「零 gate 框 = PHASE_COMPLETION_GATE_MISMATCH」。
- `validate-plan.test.ts`：新增 all-pass fixture + AGC-C-101~104 四个 mutation 测试。

## Freeze Gate
- `audits/audit-governance-evidence-and-status-closure/scope-lock-PHASE-01.json`（HUMAN APPROVED）
- `audits/.../evidence/pre-change-PHASE-01.json`（repository-root=work-one, 非空, hash 一致）

## Verification
- `bun test` 22/22 pass（含 AGC-C-101~104）
- `git diff --check` exit 0；仅改两 allowed 文件；`bun.lock` 未变
- `bun run typecheck`：唯一错误为历史基线 `_b1_live.ts TS2307`（非本次引入）

## Docs updated
- 无（本次未改文档；documents/INDEX.md / logs/INDEX.md 的改动属其他进行中任务，未触碰）
