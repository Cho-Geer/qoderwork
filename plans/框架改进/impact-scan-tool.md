# Plan: 共享函数影响面扫描工具

**Provenance level**: `component-only`
**Blueprint source**: `blueprints/blueprint-impact-analysis-framework.md` (sha256: `2fc94b01...`)
**Evidence ceiling**: component

## 目标

实施 blueprint 的 Track B（框架代码变更）：scope-lock 模板新增 `impact_analysis` 字段、plan-audit-archiver SKILL.md 新增 Step 1.5、新建 `scripts/impact-scan.ts` 工具及其组件测试。

## 修改清单

| # | 文件 | 变更类型 |
|---|------|---------|
| 1 | `.agents/skills/plan-audit-archiver/templates/scope-lock-template.json` | 修改：新增 `impact_analysis` 字段 |
| 2 | `.agents/skills/plan-audit-archiver/SKILL.md` | 修改：Step 1 和 Step 2 之间新增 Step 1.5 |
| 3 | `scripts/impact-scan.ts` | 新建：共享函数影响面扫描工具 |
| 4 | `scripts/test-serve/__tests__/impact-scan.test.ts` | 新建：组件测试 |

## 验收标准

- `bun test scripts/test-serve/__tests__/impact-scan.test.ts` exit 0
- `bun run scripts/impact-scan.ts --functions setRunState` 输出 `shared_functions: ["setRunState"]`
- `bun run typecheck` 无新增错误
- `git diff --check` exit 0
- 现有 scope-lock 不含 `impact_analysis` 时 validator 仍兼容
