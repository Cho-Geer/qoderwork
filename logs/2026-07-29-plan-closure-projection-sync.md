# 2026-07-29 — plan 闭环状态投影同步（R3/R4）

## 为什么
核实确认两 plan 均经审计 ACCEPT 闭环（权威源 `audits/<plan>/LATEST.md`，§11.5），但两处状态投影滞后，会误导后续 agent 以为未实施。

## 改了什么
- R3 `plans/audit-governance-evidence-and-status-closure-v3/formal-plan-set/00-plan-index.md`：Status `READY-FOR-IMPLEMENTATION`→`COMPLETE`；phase manifest 5×`NOT_STARTED`→`ACCEPTED`；追加 Closure projection 注记（标明**单一整体 ACCEPT** 闭环模型 `AGV3-AUDIT-20260727`，非逐 phase 独立报告）。approval 字段 L11-12 原样保留。
- R4 `blueprints/INDEX.md`：`blueprint-blueprints-governance.md` 行原地更新 待实施→已完成、truth-source→`audits/blueprints-governance/LATEST.md`。按看板规约（INDEX L34）已完成 blueprint 留活跃段，未移入已闭环。

## 决策
- 冻结核查：两目标文件 SHA 全树无引用（非哈希绑定）可编辑；`audits/` 冻结记录零触碰（git diff 验证）。
- R3 后 `validate-plan.ts` 仍 `ok:true`；R4 后 `check-blueprint-status.ts` zero drift（9/9，exit 0）。
- 范围外发现（**未修**）：blueprints-governance plan 索引 `validate-plan.ts` 报 `ERR_APPROVAL_MISSING×2`（头部 approval 写成散文段落，缺独立 `Approval decision SHA-256` 字段）——既有问题，非本次引入，建议另开任务修复。

## 更新文档
- `plans/audit-governance-evidence-and-status-closure-v3/formal-plan-set/00-plan-index.md`（改）
- `blueprints/INDEX.md`（改）
