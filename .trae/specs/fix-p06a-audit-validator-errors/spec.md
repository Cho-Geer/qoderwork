# PHASE-06a 审计报告 Validator 错误修复 Spec

## Why

PHASE-06a 审计报告（`audits/p0-2/2026-07-20-phase-06a-cleanup-extract-audit.md`）未通过 `validate-audit.ts` 验证，报 30 个错误。根因是写报告前未系统读 validator 代码，导致 scope-lock 合同字段缺失、STATIC negative_control 格式错误、plan_item_id 正则不匹配、仓库身份混淆、receipt payload 不一致、降级声明遗漏、时间顺序倒挂。需系统性修复全部 30 个错误，使 validator exit 0 后签署 ACCEPT。

## What Changes

- 修复审计报告 AUDIT_CONTRACT JSON 中的 6 类格式/合同错误
- 重写 scope-lock-phase-06a.json（status FROZEN + plan_registry + approval 结构 + 合同对齐）
- 重新生成 verdict-state receipt（在 sweep 完成后捕获，修正时间顺序）
- 补充 downgrade_declaration（v2.1-required + component 证据上限）
- 修正 baseline 仓库身份（work-one HEAD + 空 dirty_paths）

## Impact

- Affected specs: plan-audit-archiver skill 的审计流程
- Affected code:
  - `audits/p0-2/2026-07-20-phase-06a-cleanup-extract-audit.md`（审计报告，主要修改对象）
  - `audits/p0-2/scope-lock-phase-06a.json`（scope-lock 合同重写）
  - `audits/p0-2/evidence/verdict-state-PHASE-06a.json`（重新生成）

## ADDED Requirements

### Requirement: RC-4 仓库身份统一

审计报告 baseline 必须与 validator 的仓库基准一致。validator 以 `baseline.repository_root`（work-one）为基准执行 `git rev-parse HEAD` 和 `git status --porcelain`。

#### Scenario: baseline 使用 work-one 仓库身份
- **WHEN** validator 执行 `git -C /home/zhaoge/workspace/opencode/work-one rev-parse HEAD`
- **THEN** baseline.commit 和 baseline.head_at_verdict 必须等于 work-one 的 HEAD（`95405b6eb52750f5c5e84eef75a24bb63c6009d1`）
- **AND** baseline.implementation_base_commit 必须是 work-one HEAD 的祖先
- **AND** baseline.dirty_paths 必须为空数组（work-one 仓库干净）
- **AND** pre_change_receipt.repository_realpath 必须等于 work-one 的 realpath
- **AND** pre_change_receipt.head 必须等于 implementation_base_commit

### Requirement: RC-1 scope-lock 合同完整

scope-lock 必须满足 validator 对 FROZEN 合同的全部要求。

#### Scenario: scope-lock 通过 validator 校验
- **WHEN** validator 读取 scope-lock-phase-06a.json
- **THEN** status 必须为 `FROZEN`
- **AND** approval 对象必须含 `status: "APPROVED"`, `actor_type: "HUMAN"`, `approved_by`（非空）, `evidence`（非空）
- **AND** plan_registry 数组非空，每项含 `plan_item_id`（匹配 `^PLAN-REQ-\d{3}$`）
- **AND** plan_registry 的 IN_SCOPE 项必须与审计 requirements 一一映射
- **AND** scopeLockProjection（plan_sources/in_scope/out_of_scope/assumptions/exit_criteria/requirements 投影）必须与审计报告 frozenProjection 完全一致

### Requirement: RC-2 STATIC negative_control 格式

STATIC 类型 REQ 的 negative_control 必须使用特定格式。

#### Scenario: STATIC REQ negative_control 通过校验
- **WHEN** validator 检查 kind=STATIC 的 requirement 的 negative_control
- **THEN** applicability 必须为 `"NOT_APPLICABLE_STATIC"`
- **AND** command/method/expected/observed 必须为 `"N/A"`
- **AND** evidence 必须为非空字符串，且不能是 `"N/A"`/`"NOT-RUN"`/`"NONE"`（如 `"STATIC-NA: pre-fix state is the negative control"`）

### Requirement: RC-3 plan_item_id 格式

plan_item_id 必须匹配正则 `^PLAN-REQ-\d{3}$`。

#### Scenario: plan_item_id 通过校验
- **WHEN** validator 检查 requirements[].plan_item_id
- **THEN** 值必须为 `PLAN-REQ-001`/`PLAN-REQ-002`/`PLAN-REQ-003`/`PLAN-REQ-004`

### Requirement: RC-5 evidence_receipts payload 一致性

审计报告 ledger 中的 evidence_receipts 条目必须与 receipt 文件逐字段一致。

#### Scenario: ledger 与 receipt 文件一致
- **WHEN** validator 对比 evidence_receipts[i] 与 receipt 文件（去掉 path/sha256 后）
- **THEN** 所有字段（含 command）必须逐字符一致
- **AND** EV-003 的 command 必须含 `2>&1 | tail -5`
- **AND** EV-004 的 command 必须含 `> /tmp/neg-out.txt 2>&1`

### Requirement: RC-6a 降级声明

v2.1-required provenance + component 证据上限必须含 downgrade_declaration。

#### Scenario: 降级声明通过校验
- **WHEN** validator 检查 provenance_level=v2.1-required 且 evidence_ceiling=component
- **THEN** downgrade_declaration 必须非 null
- **AND** 含 4 个非空字符串字段：reason, ceiling, unaffected_scope, affected_scope

### Requirement: RC-6b 时间顺序

scope.frozen_at 必须早于或等于 sweep.completed_at；verdict-state receipt 必须在 sweep 完成后捕获。

#### Scenario: 时间顺序通过校验
- **WHEN** validator 检查时间顺序
- **THEN** scope.frozen_at ≤ sweep.completed_at
- **AND** verdict-state receipt 的 captured_at > sweep.completed_at

## REMOVED Requirements

无。
