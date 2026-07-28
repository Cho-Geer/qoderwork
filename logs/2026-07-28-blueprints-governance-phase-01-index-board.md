# 2026-07-28 — blueprints-governance PHASE-01 INDEX 看板落地

## 为什么

完成 plan admission (`ae0cf3c`) 后立即启动 PHASE-01 Freeze Gate：scope-lock → capture-state → 写 INDEX.md → 4 check 全 PASS。

## 改了什么 / 更新文档

- **新建** `audits/blueprints-governance/phase-01-scope-lock.yaml`：FROZEN status、approval=APPROVED、repository_root=work-one、4 fixed verification (P01-CHK-1~4)
- **新建** `audits/blueprints-governance/evidence/pre-change-PHASE-01.json`：v3 schema, phase_id=lock_id, repo=work-one clean (entries=0)
- **新建** `blueprints/INDEX.md`：三段（活跃/已闭环/已归档）+ 两段预留（反向边视图/豁免清单）；30 pre-existing + 1 新登记 = 31 文件全覆盖；v3 blueprint 在豁免清单（含 SHA-256 `a510b7a8...` + 绑定依据 `audits/...-v3/phase-01-scope-lock.yaml:40-42`）

## 决策

- **P02 Freeze Gate 走通顺序**：先填 scope-lock → capture-state 用 --freeze 原子化（设 frozen_at + FROZEN + 捕获 pre-change）
- **PHASE-01 INDEX 注册策略**：表格首列文件名（无 Markdown 链接），status + truth-source pointer + date basis 三列对齐 contract；v3 blueprint 不在活跃表格，仅在豁免清单
- **status 临时扩充**：在七值基础上临时加 `待归档` 值（明确 PHASE-02 候选）；待 PHASE-02 完成后清理
- **未跑** validate-audit.ts（PHASE-01 仅完成 INDEX 落地，audit 与 ACCEPT 留给 PHASE-01 收尾阶段）

## 风险与后续

- PHASE-02 必须严格按 INDEX `待归档` 行执行 move（11 文件对应 5+6 月份）
- PHASE-03 须按「活跃」表格中的 PHASE-03 边纠正候选行（task-lens-m1 / phase-progression / agent-read）
- v3 工具兼容性首验推迟到 PHASE-01 audit 时触发
- M9 接线（CONTINUATION-001）延后到后继 PLAN_SET
- 下一步：PHASE-02 Freeze Gate → 11 文件 move