# 2026-07-28 - deterministic-implementation-planning skill governanceRoot 语义澄清

## 为什么

创建 blueprints-governance plan 时误将 `validate-plan.ts` 第 2 参数 `governanceRoot` 当作 P-07 `repository_root`（work-one），首验报错。改进建议要求 skill 显式区分。

## 改了什么 / 更新文档

- `SKILL.md`：rule #12 后新增 **12a**，明确 `governanceRoot` = 计划所在 qoderwork worktree（非 work-one），与 P-07 `capture-state --repository-root`（work-one 锚点）是两概念，附 closure-v3 phase-01-scope-lock.yaml:166 调用示例。
- `validate-plan.ts`：governanceRoot 缺失报错文案改为指向 worktree（not work-one; see rule 12a）。
- `validate-plan.test.ts`：新增 GNEG-007 锁定缺失 -> ERR_PLAN_SCHEMA_UNSUPPORTED。

## 决策

路径 A（直改+留痕）。改前 SHA 自检 `703740b9`/`805aa2a9` 在 audits/ 零命中 -> 未被 v3 hash 绑定；澄清属文档/文案非准入行为变更。抢 closure-v3 PHASE-01 surface manifest 落地前窗口。未碰 `scripts/lib/audit-governance-schema-v3.ts`（真正 hash 绑定的 oracle）。验证：`bun test` 9 pass/0 fail（含 GNEG-007）；`typecheck` exit 0。
