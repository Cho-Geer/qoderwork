# 共享函数改动影响面分析框架 - 实施日志

**日期**: 2026-07-23
**Blueprint**: blueprint-impact-analysis-framework.md (v1.0.0)
**Provenance**: component-only

## 为什么

P0-3-01 修改共享函数 `setRunState` 但 scope 只覆盖 3 个文件，5 处非法转换被 fake 测试掩盖。根因：scope 按文件定义不按调用方定义，CodeGraph 工具存在但规则未要求使用。

## 改了什么

**Track A（治理变更）**：
- AGENTS.md §9.1: 扩展适用范围到 qoderwork `scripts/` 共享函数
- AGENTS.md §8.4: 新增共享函数验证覆盖规则
- AGENTS.md §8.5: 新增共享函数测试覆盖策略（FAKE-INJECTION 标注）

**Track B（框架代码）**：
- scope-lock-template.json: 新增 `impact_analysis` 字段（6 子字段）
- plan-audit-archiver SKILL.md: 新增 Step 1.5 影响面分析
- scripts/impact-scan.ts: 新建扫描工具（codegraph callers + rg fallback）
- scripts/test-serve/__tests__/impact-scan.test.ts: 新建 4 个组件测试

## 决策

- 子 Agent 将 `parseCallerFiles` 正则去行首锚定以适配 codegraph ANSI 转义码输出，偏离合理
- impact_analysis 是新增可选字段，旧 scope-lock 不受影响（向后兼容）

## 更新了哪些文档

- `plans/框架改进/impact-scan-tool.md`: plan 文件
- `audits/impact-scan/`: scope-lock、pre-change receipt、audit-note、LATEST
- `blueprints/blueprint-impact-analysis-framework.md`: 状态待实施 -> 已实施
