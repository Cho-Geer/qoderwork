# 2026-08-08 — validate-outcome-governance.ts relative() 路径归一化 Windows 修复（X4, standalone）

## 为什么
[Windows relative() 产 \ vs 冻结 JSON / → sameReference 严格比较失败 → LEDGER_PREDECESSOR_RAW_REFERENCE_INVALID + RUN_APPROVAL_OR_LEDGER_BINDING_INVALID]

## 改了什么 / 更新文档
- **修改** scripts/validate-outcome-governance.ts L61 + L215（relative() 后 split("\\").join("/") 归一化）
- 前置：L22 auxiliaryRunArtifact regex 已修（2026-08-07，本文件不含）
- **更新** logs/2026-08-08-v2-gen2-amendment-draft.md（14→15 字段）
- **更新** logs/2026-08-08-windows-git-bash-5-test-failures-solutions.md（L66 rc=1 / L70 SHA nuance / X4 排序 / 13-case / WSL UNVERIFIED）

## 决策
- **decision**: APPROVED（dual-review ACCEPT：reviewer-B round-2）
- **approved_by**: 主会话（Final Gate 独立复核）
- **未授权项**: 不触碰 scripts/lib/outcome-governance-v1.ts（X2 拒绝）、v2 plan、blueprints/INDEX.md、plans/task-lens-outcome-v1/**

## 验证证据
- before: validator 3 errors（LEDGER_PREDECESSOR + RUN_APPROVAL + RUN_GIT_TREE_MISMATCH）rc=1
- after: validator 1 error（仅 RUN_GIT_TREE_MISMATCH）rc=1
- unit suite: 9 pass/4 fail → 12 pass/1 fail（剩 symlink EPERM）
- git diff: 仅 2 行 + pre-existing FACT-1 hunk

## 风险与后续
- L26 safeBelow 逃逸防护 Windows `..\` 失效 → 独立后续项（不并入本修复）
- WSL no-op UNVERIFIED（无 WSL bun 实证）
- X4 必须先于 PHASE-07 gen2 落盘
