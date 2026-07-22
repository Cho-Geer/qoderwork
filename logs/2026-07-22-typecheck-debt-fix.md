# 2026-07-22 Typecheck 债务修复（33 errors → 0）

## 为什么

PHASE-07 regression gate 要求 `bun run typecheck` exit 0。33 个类型错误（源自 commit 77c0d708 gate 子系统重构 + 43992ad5 db/state 管理）阻断了 PHASE-07 签署。

## 改了什么

6 根因分类，12 文件修复：

| RC | 错误数 | 修复模式 |
|----|--------|----------|
| RC-1 | 8 | `string \| null` → `?? undefined` / `?? ""` / `?? null` |
| RC-2 | 9 | 添加 optional chaining / null guard |
| RC-3 | 5 | 修正 overload 选择（cast + explicit callback types） |
| RC-4 | 3 | `null` → `undefined`；移除 dead comparison |
| RC-5 | 1 | 导出 `LoadedReceipt` type |
| RC-6 | 5 | 更新 `_b_l3_012_repo_op_deny.ts` 调用签名 |

## 决策

- 所有修复为 type-level only，不改变运行时行为
- shell-targets.ts:59 的 `ch === "&"` 为 dead code（`&` 在独立分支处理），移除无行为变化
- work-one 自身仍有 3 个 pre-existing errors（tool-scope.ts + safe-bash-execution.test.ts），不在 qoderwork tsconfig 覆盖范围内，不阻断

## 验证

- `bun run typecheck` → exit 0（qoderwork 范围）
- P0-2 regression suite: 206 pass / 1 fail（runtime test 需端口，非回归）
- 4953 expect() calls

## 更新的文档

- 新建: `logs/2026-07-22-typecheck-debt-fix.md`
