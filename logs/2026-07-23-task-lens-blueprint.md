# 2026-07-23 task-lens M1 blueprint 创建与 v0.1.5 返工

## 为什么
M1 的方向可行，但 v0.1.4 存在输入、图模型、coverage、反馈闭环、安全边界与 provenance 合同缺口，不能直接进入实施。

## 改了什么
- 将输入冻结为 `TaskInputReceiptV1`，明确 working-tree/commit、tracked/untracked/rename/delete 语义与项目外输出目录。
- 将图产物冻结为可序列化 `TaskGraphV1` 与 `SpineForest`，限定 calls-only 边并保留 confidence/resolvedBy。
- 将 Bun lcov 契约改为 DA 行覆盖；补反馈写回、资源上限、安全、12 子系统逐项审计、版本化产物和硬验收闸门。

## 关键决策
- M1 后续 plan 必须声明 `provenance_level: v2.1-required`，先完成人工批准的 scope-lock 与 pre-change receipt。
- M2/M3 仅保留为待独立规格验证的路线图，不再伪装成当前能力。

## 实测依据
- Bun 1.3.14 lcov 实产物含 `DA` 而无 `FN/FNDA`；Git 最小复现确认 untracked 与纯删除需独立建模。
- 当前 work-one 基线未命中会 `populateBaseline` 后继续；CodeGraph 边含种类、置信度与解析来源，需显式过滤。

## 更新了什么文档
- `blueprints/blueprint-task-lens-m1.md`、`handoff/task-lens-resume.md`、`documents/INDEX.md`、`logs/INDEX.md`、本日志。
