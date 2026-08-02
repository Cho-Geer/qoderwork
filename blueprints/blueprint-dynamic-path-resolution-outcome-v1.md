# Blueprint: 路径动态化解析契约 Outcome v1

**创建日期**: 2026-08-03
**更新日期**: 2026-08-03
**状态**: 待实施
**相关蓝图**: blueprint-dynamic-path-resolution.md（v1.1.0，已被本蓝图取代）

**版本**: v1.0.0
**日期**: 2026-08-03
**治理框架**: outcome-governance v1（冻结 outcome/boundary/固定验收；amendment 管理变更）
**对应合同**: plans/path-dynamic-resolution-outcome-v1/outcome-contract.json
**合同 SHA-256**: 8fe8fdfbbd33d94053d840b8c813ba3b65f67cee1fbe2a3c40dafe9c86f04929

## 一、问题与目标

### 1.1 背景
旧蓝图 blueprint-dynamic-path-resolution.md（v1.1.0）描述路径动态化与跨平台配置收敛；M1 plan（plans/path-dynamic-resolution-m1/，4 phase ACCEPTED，Status COMPLETE）已交付：
- scripts/lib/workspace-paths.ts 解析器（优先级契约 + fail-closed 校验）
- start-serve.ts 接入 + scripts/.env 职责分离
- test-serve 消费点（--primary-worktree/--from 参数缝）
- pathToFileURL 动态 import（隔离 worktree 来源）

旧蓝图与旧 plan 已由 blueprints/INDEX.md 与 documents/INDEX.md 标记 SUPERSEDED_BY_OUTCOME_GOVERNANCE_V1，文件本体冻结不动。

### 1.2 目标（outcome）
将 M1 已交付的解析契约冻结为 outcome-governance v1 验收基线：4 个固定组件测试（T-001..T-004）独立验收解析契约保持正确，防止回归。

### 1.3 非目标
- work-one 业务代码；IDE 客户端适配（deferred）；runtime smoke / live-LLM-E2E；历史证据路径；Windows/其他 OS 实机行为。

## 二、验收策略
固定 test_id T-001..T-004 的 bun:test 断言集（PDR-C-101..204 正例 + 单点失败负例）独立运行，断言违反或 exit 非 0 即 FAIL；validate-outcome-governance.ts 结构校验 exit 0。证据层级仅 component，不冒充 runtime/live。

## 三、变更管理
outcome-contract immutable；验收决策变化必须先创建 amendment（generation 2，from/to contract + 冻结 diff），不编辑旧 contract。弱化变更（WEAKENING）需第二个 HUMAN 批准（不同 trust domain）。

## 四、风险
- 测试与实现耦合回归 → 固定 bundle 对测试源做 sha256 冻结。
- 误标证据层级 → acceptance-strategy boundary 显式 component-only。
- 旧 plan/旧蓝图冻结链被触碰 → side_effect_boundary prohibited 显式禁止。
