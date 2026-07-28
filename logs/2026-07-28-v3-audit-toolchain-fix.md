# 2026-07-28 — v3 audit 工具链修复（generate-evidence-receipt + finalize-audit）

## 为什么

PHASE-01 audit 手动跑通后发现 2 个工具链缺陷，会导致后续 PHASE-02~05 每个 phase 都需手动 workaround：
1. `generate-evidence-receipt.ts` 输出 receipt 缺顶层 `observed` 字段 → validator `EXPECTED_NONEMPTY_STRING`
2. `finalize-audit.ts` 期望 JSON `audit-report` 输入，但实际 audit 产物是 markdown → `REPORT_SCHEMA_INVALID`

## 改了什么 / 更新文档

- **修改** `generate-evidence-receipt.ts` (+6 行)：添加顶层 `observed` 字段（POSITIVE→"PASS"，NEGATIVE→"FAIL"，--observed-override N/A→"FAIL"）
- **修改** `finalize-audit.ts` (~82 行)：接受 markdown audit.md → 提取 embedded JSON contract → `buildAuditReportDocument` 生成 `audit-report.json` → LATEST.md 指向 JSON report；修复 `stableStringify` 嵌套字段丢失 bug（原 `Object.keys(obj).sort()` replacer 只白名单顶层 key，`settles` 子字段被静默丢弃）
- **重写** `finalize-audit.test.ts`：适配新 contract（markdown 输入 → derived JSON report），7/7 pass
- **回归测试**：删除旧 PHASE-01 audit 产物 → 重新 capture-state → 重新生成 8 EV receipts → 重新 prepare-audit → validate-audit.ts exit 0 → finalize-audit.ts exit 0 → audit-report.json + LATEST.md 自动生成

## 决策

- **双轨制**（用户确认）：接受 markdown audit.md（人类可读）+ auto-build audit-report.json（机器可读），LATEST.md 指向 JSON report
- **stableStringify 修复**：改为递归 key-sorting helper，确保 `settles.canonical_contract_sha256` / `scope_lock_sha256` 正确序列化
- **回归测试通过**：validate-audit.ts `{"valid": true}`，finalize-audit.ts exit 0，typecheck exit 0，7/7 unit tests pass

## 风险与后续

- 后续 PHASE-02~05 工具链可全自动跑通（无需手动 workaround）
- 旧 `2026-07-28-audit-contract.json` 已删除（contract 现嵌入 audit.md）
- 下一步：PHASE-02 Freeze Gate → 11 文件归档