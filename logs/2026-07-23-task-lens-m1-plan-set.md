# 2026-07-23 Task Lens M1 确定性 PLAN_SET

## 为什么
将 blueprint v0.1.5、handoff 与演进日志转成弱模型可逐阶段执行、失败即停的实施合同。

## 改了什么
- 新建 `plans/task-lens-m1/`：index、7 个语义 Phase、final verification。
- 固定 Freeze Gate、精确 allowed files、checks、all-pass fixtures、single mutations、命令与证据层级。
- 将 M1 多卡冲突收敛为单卡 ≤20 节点；超限 seeds 写 `uncoveredSeeds` 并 exit 2。

## 决策与证据边界
- `provenance_level=v2.1-required`；每个代码 Phase 需 Human-approved scope-lock 与 pre-change receipt。
- 根 typecheck 现有 `_b1_live.ts` TS2307 仅登记为基线；中间禁止新增，M1 关闭前必须归零。
- validator `ok=true/errors=[]`；index 7,999 chars warning 已有不可再语义拆分的明示例外，不代表实现 PASS。

## 更新了什么文档
- `plans/task-lens-m1/*.md`、`documents/INDEX.md`、`logs/INDEX.md`、本日志。
