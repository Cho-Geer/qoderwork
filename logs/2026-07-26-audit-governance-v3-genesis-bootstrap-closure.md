# 2026-07-26 审计治理 v3 Genesis Bootstrap 关闭

**为什么**：Stage G 须走到 CLOSED 才能创建并批准正式 v3 PLAN_SET，进而启动 A-D 剩余 phase 冻结。

**改了什么**：
- 共享 v3 parser posthoc 验证 5 个 bootstrap artifact（admission/repair-v4 scope-lock 与 capture/closure scope-lock 与 capture）全部按精确 schema pair 解析。
- 创建并准入正式 v3 PLAN_SET（formal-plan-set，PHASE-01=surface/conformance，NOT_STARTED），准入 exit 0 ok:true。
- admission 状态机迁移 DRAFT→HUMAN_APPROVED→IMPLEMENTING→POSTHOC_V3_VALIDATED→CLOSED。

**决策**：closure 不是 ACCEPT，不产生 report/LATEST，不可复用为批准或豁免；每个 phase 仍需各自 approved v3 phase scope lock。

**前置修复**：另起人类批准的 validator-path-fix scope-lock，修正 validate-plan.ts 权威路径信任边界（canonical/approval 按 governanceRoot 解析），共享 parser 未改动。

**更新文档**：genesis-bootstrap-closure-receipt.yaml、genesis-bootstrap-admission.yaml、logs/INDEX.md。
