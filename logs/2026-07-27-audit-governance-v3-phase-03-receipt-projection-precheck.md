# 2026-07-27 审计治理 v3 PHASE-03：receipt/projection/boundary precheck v3 化

## 为什么

PHASE-03 将证据链（projection → receipt → matrix）升级到 v3 共享 parser 判别，废除 precheck 的目录枚举和 boundary-contract/v1 输入，实现双观察区分。

## 改了什么

- 新增 generate-phase-projection.ts：生成 audit-phase-projection/v3::phase-projection，绑定 canonical/scope-lock hash、REQ/DC 选择、显式 receipt 路径声明
- 重写 audit-boundary-precheck.ts：消费 projection 显式 receipt 路径，拒绝 path escape/symlink escape，输出 audit-boundary-matrix/v3::boundary-matrix，只 READY_FOR_LLM_REVIEW 或 BLOCKED
- 升级 generate-evidence-receipt.ts：v3 双观察（execution.observed 由 exit_code 推导，domain_observation.result 由 --domain-result 提供），新增 decision_case_id、forbidden_side_effects_observed、projection/canonical hash 绑定
- 升级 capture-state.ts：判别改 audit-evidence-receipt/v3::evidence-receipt
- 升级 evidence-receipt-template.json：v3 双观察字段
- 同步 governance-surface-manifest.yaml：新增 generate-phase-projection.ts 登记，4 个 consumer 加 allowed_references
- 扩容 run-conformance.ts + corpus.json：10 个 consumer，41 个样本，6 个探针
- formal-plan-set 加 PHASE-03 行

## 决策

- capture-state 分类为 audit-evidence-receipt/v3（parser 无专用 state-receipt kind）
- precheck 不发 verdict，不枚举目录

## 更新了什么文档

- plans/.../formal-plan-set/00-plan-index.md（PHASE-03 行）
- plans/.../formal-plan-set/03-phase-receipt-projection-precheck.md（新建）
- logs/INDEX.md（本条）
