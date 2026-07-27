# 2026-07-26 audit-governance v3 PHASE-01 surface/conformance 基建

## 为什么

PHASE-01 scope-lock 冻结后实施：建造 hash-bound 治理表面 manifest + findings-first scanner + 独立 conformance corpus + consumer-agreement runner + mismatch probes。只造设备、揪毛病，不修消费者。

## 改了什么

- 新增 `scripts/lib/governance-surface-manifest.yaml`：22 项治理资产登记（含 HISTORICAL 分类）
- 新增 `scripts/lib/scan-governance-surface.ts`：findings-first scanner，接共享 parser
- 新增 `scripts/lib/run-conformance.ts`：conformance runner，接共享 parser
- 新增 `scripts/lib/conformance-corpus/corpus.json`：32 个独立 oracle 样本
- 新增 `scripts/lib/conformance-mismatch-probes/probes.json`：6 个 kill test probes
- 新增 `scripts/lib/__tests__/scan-governance-surface.test.ts`：11 pass
- 新增 `scripts/lib/__tests__/run-conformance.test.ts`：11 pass

## 决策

- plan 文件 progression status 保持 NOT_STARTED（validate-phase-progression exit 0 硬约束优先于 IN_PROGRESS 派生值）
- scanner OPEN findings 不关闭、不修复对应代码（由后续 phase 继承）
- 共享 parser 与现有消费者零改动

## 更新了什么文档

- 新建：`scripts/lib/governance-surface-manifest.yaml`
- 新建：`scripts/lib/scan-governance-surface.ts`
- 新建：`scripts/lib/run-conformance.ts`
- 新建：`scripts/lib/conformance-corpus/corpus.json`
- 新建：`scripts/lib/conformance-mismatch-probes/probes.json`
- 新建：`scripts/lib/__tests__/scan-governance-surface.test.ts`
- 新建：`scripts/lib/__tests__/run-conformance.test.ts`
- 新建：本日志
