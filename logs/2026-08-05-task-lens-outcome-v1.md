# task-lens outcome-v1 创建日志

**Date**: 2026-08-05
**Subject**: 走 outcome-governance/v1 新框架,创建 task-lens 解析契约 Outcome v1

## 为什么

旧蓝图 blueprint-task-lens-m1.md(v0.1.5)+ 旧 plan plans/task-lens-m1/(provenance_level: v2.1-required) 违反 provenance-rules.md P-01 取值规则(2026-07-28 升级为 `{v3-required, component-only}`),且 outcome-governance/v1 框架(2026-08-03 引入)是新工作默认入口。用户指令:走新框架,参照 path-dynamic-resolution-m1 先例,创建新蓝图+新 plan。

## 改了什么

新建 6 个文件:
- `plans/task-lens-outcome-v1/outcome-contract.json`(contract_id=TASK-LENS-OUTCOME-CONTRACT-V1, sha256=80095012...0db9)
- `plans/task-lens-outcome-v1/outcome-test-bundle.json`(bundle_id=TASK-LENS-TEST-BUNDLE-V1, sha256=a6ce76f4...b8b1)
- `plans/task-lens-outcome-v1/acceptance-spec.json`(spec_id=TASK-LENS-ACCEPTANCE-SPEC-V1, sha256=e3d9f658...be0)
- `plans/task-lens-outcome-v1/outcome-approval.json`(approval_id=TASK-LENS-APPROVAL-V1-GEN1, sha256=27301692...6446)
- `plans/task-lens-outcome-v1/ledger/event-001-contract-approved.json`(CONTRACT_APPROVED, sha256=19c5f673...5d63)
- `blueprints/blueprint-task-lens-outcome-v1.md`(v1.0.0)

修改 2 个文件:
- `plans/task-lens-m1/00-plan-index.md`(头部 Status 改 SUPERSEDED_BY_OUTCOME_GOVERNANCE_V1 + Superseded at/by 2 行)
- `blueprints/INDEX.md`(登记新蓝图 L29 + 旧蓝图 L28 状态列改"已退役"并加 SUPERSEDED 注记)

## 决策

- **身份**:approved_by=ChoGeer(参照 path-dynamic 先例,工作区既定 HUMAN 签名者);evidence 字段明确"用户通过任务指令授权主会话代为签发"
- **冻结范围**:只冻结 PHASE-01~04 已交付契约(6 个现存组件测试文件),PHASE-05/06/07 显式 out_of_scope(PHASE-05 状态分裂未裁决)
- **不做**:不创建 runs/(本轮未实际运行测试,validator 不强制 RUN_RECORDED);不改 audits/task-lens-m1/(L531 保护);不改旧 blueprint 头部(冻结规则)

## 更新了什么文档

- 6 新文件(见上)
- 2 改文件(见上)
- 本日志

## 验证证据

- `bun run scripts/validate-outcome-governance.ts plans/task-lens-outcome-v1 --repository-root <repo>` → `{"ok":true,"lifecycle":"ACTIVE","errors":[]}` exit 0
- 所有 sha256 字面匹配(contract/spec/bundle/approval/ledger 互引 + bundle 内 6 测试 + 1 preset + 3 oracle_sources + 1 runner_config + 1 lockfile)
- baseline.baseline_tree_sha256 = HEAD^{tree} 实测 = `297504377e...`
- 受保护范围 git status 验证:audits/task-lens-m1/ 空 diff + 旧 blueprint 头部四字段未改
- high-precision 复审通过(修补 F1/F3 后:Pass with minor,F2/F4-F7 不阻断)