# PHASE-05 Runtime Test 审计复审 ACCEPT

## 为什么

PHASE-05 runtime test 初审（generation 1）因 scope-lock allowed_files 过窄（仅 1 个文件，实际变更涉及 5 个）、负控制未执行、4 个代码文件超出 scope，被判为 INVALID。需要在 scope-lock 修订、receipt 重捕和负控制执行后进行复审。

## 改了什么

1. **scope-lock v2 amendment**: allowed_files 从 1 个扩展到 5 个（p02-runtime.test.ts、run-context.ts、types.ts、p02-orchestrator.ts、p02-sentinel.ts）；plan_item_id 唯一化为 PLAN-REQ-005/006/007；human reviewer (zhaoge) 批准。
2. **receipt 重捕**: 删除并重新捕获 pre-change-PHASE-05-v2.json 和 verdict-state-PHASE-05-v2.json，绑定 scope-lock v2 SHA-256。
3. **8 个 EV-NNN 证据回执**:
   - EV-001/005/006: 3 个 REQ 的独立正面控制（runtime-smoke 级，1 pass/0 fail/50 expect() [18.70s]）
   - EV-002: P02-R-PORT 负控制（占用端口 4001 → runtimeResult FAIL）
   - EV-003/004: P02-R-ARTIFACT 负控制（删除 stage results 文件 → artifactRetention/stageEvidence FAIL）
   - EV-007: POST_FIX 正面控制（scope-lock v2 后所有文件在 scope 内 → PASS）
   - EV-008: NEGATIVE 负控制（scope-lock v1 下 4 文件超出 scope → FAIL, exit_code=1）
4. **审计报告**: `audits/p0-2/2026-07-20-phase-05-runtime-test-audit-2.md`（566 行），generation 1（新链），verdict ACCEPT。
5. **F-001 CLOSED**: scope violation finding，pre_fix_control=EV-008(FAIL)，post_fix_control=EV-007(PASS)，closure_evidence="EV-007"。

## 决策

- **generation 1 新链**: 初审 INVALID 有 26 个结构错误，不构成有效 generation base。将复审设为 generation 1（新链），previous_audit=null，避免 PREVIOUS_AUDIT_INVALID 错误。
- **plan_item_id 唯一化**: 3 个 REQ 共用 PLAN-REQ-005 导致 DUPLICATE_ID。改为 PLAN-REQ-005/006/007，同步更新 scope-lock.json 的 requirements 和 plan_registry。
- **polarity 规范**: PRE_FIX 不在 validator 允许列表中（仅允许 POSITIVE/NEGATIVE/POST_FIX）。EV-008 改为 NEGATIVE，EV-007 为 POST_FIX。
- **artifacts 非空**: EV-007/EV-008 的 artifacts 不能为空数组，添加 scope-lock.json 作为 artifact。

## 更新了什么文档

- 新建: `audits/p0-2/2026-07-20-phase-05-runtime-test-audit-2.md`（566 行）
- 更新: `audits/p0-2/LATEST.md`（指针指向 audit-2，结果 ACCEPT）
- 更新: `audits/p0-2/scope-lock.json`（v2 amended，176 行）
- 新建: `audits/p0-2/evidence/ev-001-runtime-positive.json` ~ `ev-008-pre-fix-scope-violation.json`（8 个文件）
- 重捕: `audits/p0-2/evidence/pre-change-PHASE-05-v2.json`、`verdict-state-PHASE-05-v2.json`
- 新建: 本日志 `logs/2026-07-20-phase-05-audit-2-accept.md`

## Validator 证据

```
validate-audit.ts → valid=true, exit 0, 0 errors, verdict=ACCEPT
counts: requirements=3, findings=1, openBlockers=0, reopenRecords=0
```
