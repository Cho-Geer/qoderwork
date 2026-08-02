# 2026-08-03 路径动态化 Outcome v1 重建
**日期**: 2026-08-03
**类型**: 治理重建 / outcome-governance v1
**相关**: blueprint-dynamic-path-resolution.md（v1.1.0，SUPERSEDED）、plans/path-dynamic-resolution-m1/（4 phase ACCEPTED）

## 为什么
旧蓝图与旧 M1 plan 已标记 SUPERSEDED_BY_OUTCOME_GOVERNANCE_V1；M1 已交付解析契约按 outcome-governance v1 重建为冻结验收基线，防止回归。

## 改了什么
- 新蓝图 blueprint-dynamic-path-resolution-outcome-v1.md（v1.0.0，待实施）
- 5 个 v1 工件：outcome-contract / outcome-test-bundle / acceptance-spec / outcome-approval / ledger event-001（plans/path-dynamic-resolution-outcome-v1/）
- 2 处 INDEX 投影：blueprints/INDEX.md（32→33、新行、旧行 SUPERSEDED）；documents/INDEX.md（新合同行、旧 plan 行 SUPERSEDED）

## 决策
- genesis contract 冻结 M1 成果（4 固定组件测试 T-001..T-004；boundary 显式）
- approval 由 HUMAN 指令签发（CHOGEER，human-primary）；ledger event-001 锚定
- 旧蓝图/旧 plan 冻结不动；变更走 amendment（gen 2 from/to contract + 冻结 diff）

## 更新文档
blueprints/INDEX.md（3 处）、documents/INDEX.md（2 处）、logs/INDEX.md（活跃窗口 + 新日期行）
