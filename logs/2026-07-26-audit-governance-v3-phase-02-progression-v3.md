# 2026-07-26 — 审计治理 v3 PHASE-02：progression 回执判别 v3 化

## 为什么
progression 回执判别此前用 consumer-local 的 `value.schema_version !== PROGRESSION_SCHEMA`
比较，绕过共享 parser。PHASE-02 将其改为经共享 parser 判别
`audit-phase-progression/v3::phase-progression-receipt`，并精化扫描仪避免误报合法 plan-index 标记。

## 改了什么
- `phase-progression.ts`：`validateReceiptContract` 经 `parseAuditGovernanceV3Document` 判别回执；receipt 增 `document_kind`；`PROGRESSION_SCHEMA` 仅供 `isProgressionSchema`（plan-index 标记，不动）。
- `validate-phase-progression.ts`：判别随 `validateReceiptContract` 自然经共享 parser；NOT_STARTED 门、依赖 ACCEPTED、顶层派生、audit-report 绑定语义逐字未动。
- `PLAN-SET-TEMPLATE.md`：补 Progression schema / Progression status / Completion receipt 三件套。
- `scan-governance-surface.ts`：consumer-local 检测改为基于 SCHEMA_PAIRS discriminator + pre-v3 替身，不再误报 `phase-progression/v1`。
- `governance-surface-manifest.yaml`：progression 脚本 allowed_references 加共享 parser，更新被改资产 sha256。
- `run-conformance.ts`：progression 两脚本声明为 v3 consumer。

## 决策
plan-index 标记与门语义不迁移、不收紧；2 个 finding 诚实关闭，10 个 consumer-local finding 仍 OPEN。

## 更新了什么文档
- 新建本日志；同步 `logs/INDEX.md`。
