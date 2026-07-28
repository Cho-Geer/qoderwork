# PHASE-02 Implementation Evidence — progression 回执判别 v3 化

scope_lock_id: AGV3-PHASE-02-PROGRESSION-V3-SCOPE-LOCK-20260726
scope_lock_sha256: 859d72148060f107c922259a93a96261972b6346edc45111615a74661e9c8c76
pre_change_capture: phase-02-pre-change-capture.yaml (CAPTURED)
role: Fullstack Engineer 子 agent（机械执行冻结指令）

## 实施的冻结变更

1. phase-progression.ts — validateReceiptContract 经 parseAuditGovernanceV3Document 判别
   audit-phase-progression/v3::phase-progression-receipt；receipt 增 document_kind；
   PROGRESSION_SCHEMA 仅供 isProgressionSchema（plan-index 标记，保留未迁移）。
2. validate-phase-progression.ts — 脚本体未改；判别随 validateReceiptContract 经共享 parser；
   NOT_STARTED 门、依赖 ACCEPTED、顶层派生、completion-gate、audit-report 绑定逐字未动。
3. PLAN-SET-TEMPLATE.md — index 块补 Progression schema；phase 块补 Progression status + Completion receipt。
4. scan-governance-surface.ts — consumer-local 检测改为 SCHEMA_PAIRS discriminator + pre-v3 替身（quoted-literal），
   不再误报合法 plan-index 标记 phase-progression/v1；仍接共享 parser。
5. governance-surface-manifest.yaml — progression 脚本 allowed_references 加共享 parser；更新被改资产 sha256。
6. run-conformance.ts — DECLARED_CONSUMERS 加 phase-progression.ts 与 validate-phase-progression.ts
   （fix_contract.conformance_extension + 任务指令 #7 明确要求；corpus 现有 progression 样本足以覆盖，未新建 corpus 文件）。
7. 测试：phase-progression.test.ts / validate-phase-progression.test.ts fixture v3 化；scan-governance-surface.test.ts
   两个关闭 finding 断言改为 undefined。

## 固定验证结果（exit code）

- P02-POS-001 phase-progression.test.ts：8 pass / 0 fail（需 `./` 前缀；bun 1.3.14 将裸 .agents 路径当 name filter）
- P02-POS-002 validate-phase-progression.test.ts：4 pass / 0 fail（门语义保留）
- P02-POS-003 validate-phase-progression CLI PHASE-01：exit 0（formal PLAN_SET 仍准入）
- P02-POS-004 validate-plan CLI：exit 0（v3 admission intact）
- P02-SCAN-001 scan-governance-surface.test.ts：11 pass / 0 fail
- P02-SCAN-002 scanner CLI：HAS_OPEN_FINDINGS，10 OPEN / 0 BLOCKING，无 illegal-reference 自报
- P02-CONF-001 run-conformance.test.ts：11 pass / 0 fail
- P02-CONF-002 conformance CLI：ALL_CONSUMERS_AGREE，6 consumers（含 progression×2），32 samples，6 probes 全 PASS
- P02-POS-005 audit-governance-schema-v3.test.ts：4 pass / 0 fail（parser 不变）
- P02-TYPECHECK：exit 0
- P02-PARSER-CALLERS：phase-progression.ts(validateReceiptContract:140)、scan-governance-surface.ts、run-conformance.ts、validate-plan.ts 为 caller；parser sha 37b74a62… 未变
- P02-SCOPE-DIFF：见下

## Finding 处置

- 关闭：F-PHASE01-TEMPLATE-PROGRESSION-MARKER；F-CONSUMER-LOCAL:phase-progression.ts:phase-progression/v1
- 仍 OPEN（10）：validate-audit.ts×2、audit-boundary-precheck.ts、capture-state.ts、prepare-audit.ts、
  generate-evidence-receipt.ts、pre-check-evidence.ts、scope-lock-template.json×2、evidence-receipt-template.json

## 不变量声明

- 共享 parser audit-governance-schema-v3.ts：未改（sha 37b74a62… 与 manifest 一致）
- plan-index 标记 phase-progression/v1：未迁移（formal index 第 7 行原样）
- NOT_STARTED 防重入门：未改
- audit-report 绑定语义：未收紧
- 隔离/检疫内容（legacy-boundary-contract-exemptions.json）：未读
- 未创建 report/LATEST，未做 phase ACCEPT

## 范围说明（供审计裁决）

run-conformance.ts 与 run-conformance.test.ts 不在 effective_allowlist.modified_paths / pre-change-capture
modified_path_baseline 枚举中；其中 run-conformance.ts 的 DECLARED_CONSUMERS 扩容由 fix_contract.conformance_extension
与任务指令 #7 明确强制（consumer 列表硬编码），corpus 现有 progression 样本足以覆盖故未硬凑/未新建 corpus 文件。
run-conformance.test.ts 曾加 2 行断言，已回退至基线以最小化范围足迹（progression consumer 仍被每个样本/探针执行）。
其余改动均落 allowlist；基线已存在的 validate-plan.ts/test、scripts/_b1_live.ts 修改非本 phase 所为。
