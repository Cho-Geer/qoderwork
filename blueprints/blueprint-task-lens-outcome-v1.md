# Blueprint: Task Lens 解析契约 Outcome v1

**创建日期**: 2026-08-05
**更新日期**: 2026-08-06
**状态**: 已完成
**相关蓝图**: blueprint-task-lens-m1.md（v0.1.5，已被本蓝图取代）

**版本**: v1.0.0
**日期**: 2026-08-05
**治理框架**: outcome-governance v1（冻结 outcome/boundary/固定验收；amendment 管理变更）
**对应合同**: plans/task-lens-outcome-v1/outcome-contract.json
**合同 SHA-256**: 8009501276e739b9a7cd309af3d5d653a74b67ca2f5934f27cdab70fdb7f0db9

## 一、问题与目标

### 1.1 背景
旧蓝图 blueprint-task-lens-m1.md（v0.1.5）描述任务透镜 M1（AI 任务的函数级理解收据生成器）；旧 plan（plans/task-lens-m1/，PHASE-01~04 ACCEPTED，状态待 v3 框架裁决）已交付：

- 输入收据冻结（working-tree/commit 差异语义 + untracked + preimage-only 删除）
- 命令行/配置/路径 fail-closed 输入安全
- provider DB capability probe + CLI fallback 构图、搜索预算 200/500/50、单卡≤20
- lcov 三态（covered/unknown/uncovered）、固定五节卡片、canonical artifact 写入

旧蓝图与旧 plan 同步由 blueprints/INDEX.md 与 plan-index 头部标记 SUPERSEDED_BY_OUTCOME_GOVERNANCE_V1，文件本体按 AGENTS.md L531 冻结不动。PHASE-05 metrics 状态分裂（LATEST ACCEPTED vs plan-index NOT_STARTED vs handoff BLOCKED）未裁决，本蓝图显式 out_of_scope。

### 1.2 目标（outcome）
将 M1 已交付的解析契约冻结为 outcome-governance v1 验收基线：4 个固定组件测试（T-001..T-004）独立验收契约保持正确，防止回归。

### 1.3 非目标
- work-one 业务代码；PHASE-05 metrics（状态分裂未裁决）；PHASE-06 双目标集成；PHASE-07 10 任务验收；M1.5/M2/M3；runtime smoke / live-LLM-E2E；历史证据路径；Windows/其他 OS 实机行为。

## 二、验收策略
固定 test_id T-001..T-004 的 bun:test 断言集（input-diff/command-security/provider-graph/spine/coverage-render/artifact-writer）独立运行，断言违反或 exit 非 0 即 FAIL；validate-outcome-governance.ts 结构校验 exit 0。证据层级仅 component，不冒充 runtime/live。

## 三、变更管理
outcome-contract immutable；验收决策变化必须先创建 amendment（generation 2，from/to contract + 冻结 diff），不编辑旧 contract。弱化变更（WEAKENING）需第二个 HUMAN 批准（不同 trust domain）。

## 四、风险
- 测试与实现耦合回归 → 固定 bundle 对测试源做 sha256 冻结。
- 误标证据层级 → acceptance-strategy boundary 显式 component-only。
- 旧 plan/旧蓝图冻结链被触碰 → side_effect_boundary prohibited 显式禁止。