# 2026-08-07 — validate-outcome-governance.ts regex Windows 路径兼容修复

## 为什么

`scripts/validate-outcome-governance.ts` 第 22 行 regex `/^runs\/(?:receipt|env|out|err)(?:[-.]|\/)/` 只接受正斜杠路径，Windows 反斜杠路径触发 false `DOCUMENT_INVALID`。v1 LATEST.md 文档化为"out-of-scope Windows hardening"留待后续；v2 plan 显式复用此 validator 作为 gen2 outcome chain 验收门（blueprint §6.3/§6.7 + 05/06/07/99 plan），不修此 bug 则 v2 在 Windows Git Bash 上必然 false-FAIL。双重独立审核：1st-Implementer（general-purpose）执行单行 Edit，2nd-Reviewer（high-precision）独立复审 7 项验证（含 HEAD baseline 对比），main-session Final Gate 独立核查 5 项。

## 改了什么

- **修改** `scripts/validate-outcome-governance.ts` 第 22 行：regex 字面量替换
  - 旧：`/^runs\/(?:receipt|env|out|err)(?:[-.]|\/)/`
  - 新：`/^runs[\/\\](?:receipt|env|out|err)(?:[-.][\/\\]?|[\/\\])/`
- **未碰**：`scripts/lib/outcome-governance-v1.ts`、`scripts/__tests__/validate-outcome-governance.test.ts`、`plans/task-lens-outcome-v1/**`（v1 frozen artifacts）、`plans/task-lens-m1-completion-v2/**`、`blueprints/**`、`audits/**`、`package.json`、`bun.lock`、scripts/task-lens/**

## 决策

- **decision**: ACCEPT（regex Windows 兼容 fix）
- **approved_by**: 主会话（main-session Final Gate — audit-separation §c 独立验收）
- **approved_at**: 2026-08-07
- **rounds**: 1（1st-Implementer 一次通过，2nd-Reviewer PASS，main-session Final Gate PASS）
- **scope**: 1 file / 1 line / 1 hunk

## 验证证据

### 独立 regex 13 case 实测（1st-Implementer + 2nd-Reviewer + main-session 三方均独立运行）

| 路径类别 | 期望 | 旧 regex | 新 regex |
|---------|------|---------|---------|
| 5 个 Linux 路径（`runs/receipt/case-001.json` 等） | 命中 | 5/5 PASS | 5/5 PASS |
| 5 个 Windows 路径（`runs\receipt\case-001.json` 等） | 命中 | **0/5 FAIL** | 5/5 PASS |
| 3 个非辅助 artifact 路径 | 不命中 | 3/3 PASS | 3/3 PASS |
| **总计** | — | **8/13** | **13/13** |

### before/after validator 错误对比（2nd-Reviewer V5 + main-session Final Gate 双独立跑）

| 维度 | before | after | delta |
|------|--------|-------|-------|
| EXIT | 1 | 1 | 不变（3 个 WSL-only baseline 错误仍在） |
| 错误总数 | 8 | 3 | -5 |
| DOCUMENT_INVALID | 5 | 0 | **-5（regex bug 已修）** |
| LEDGER_PREDECESSOR_RAW_REFERENCE_INVALID | 1 | 1 | 不变（v1 baseline，WSL-only） |
| RUN_APPROVAL_OR_LEDGER_BINDING_INVALID | 1 | 1 | 不变（v1 baseline，WSL-only） |
| RUN_GIT_TREE_MISMATCH | 1 | 1 | 不变（v1 baseline，WSL-only） |

### 测试 baseline 不退化（2nd-Reviewer V7）

- HEAD baseline: 9 pass / 4 fail（4 fail 全部 Windows EPERM symlink + 路径处理差异）
- 修改后: 9 pass / 4 fail（与 HEAD 完全一致；4 fail 全部 pre-existing Windows 环境限制，与 regex 修改正交）

### Scope discipline

`git status --porcelain` 最终状态：

```
 M scripts/validate-outcome-governance.ts
```

仅 1 文件 modified（line 22），无其他变化。Pre-existing 的 ` A`（蓝图 + 6 plan 文件）和 `??`（3 logs）来自前几次 session。

## 风险与后续

- **EXIT code 仍为 1**：剩 3 个 WSL-only baseline 错误（LEDGER/RUN_*）— 这些与 regex 无关，需在 WSL Ubuntu-24.04 native FS clone 环境下才会通过。Windows Git Bash 上 v2 outcome chain 验证仍依赖 WSL canonical env。
- **validator scope 不变**：本 fix 仅影响 `auxiliaryRunArtifact` regex 的 Windows 路径识别能力；validator 的"structural-only / review-separated"性质不变；不构成 admission 决策。
- **未签发 outcome-run-result-v2.json**：本会话不创建 gen2 outcome chain 文件，仅修复 validator 工具能力。gen2 contract/spec/bundle/amendment/approval/ledger event-003/004/run-result-v2 仍待 v2 实施阶段独立 session 落盘。
- **未签发 INDEX.md 同步**：v2 blueprint 仍未登记到 `blueprints/INDEX.md` 活跃段（per blueprint §5.3 deferred blocker）；本 fix 不触发 INDEX 同步。
- **下次启动 v2 实施阶段前**：可重跑 validator 验收；但仍需 WSL 才能完全 EXIT=0。Windows Git Bash 上 gen2 outcome chain 文件落盘后，DOCUMENT_INVALID 错误不再出现，但 LEDGER/RUN_* baseline 错误仍需 WSL。
- **下一步**：等待 user 指令启动 v2 实施 phase session（双环境 dual-env evidence + outcome chain 落盘）。本会话 Final Gate 已 Accept validator regex fix；不擅自启动实施。

## 自检（FAIL-CLOSED 闸门）

- [x] line 22 内容：含 `[\/\\]` 字符类（独立 awk NR==22 验证）
- [x] line count 保持 246（独立 wc -l 验证）
- [x] git diff 仅 line 22 1 行（独立 git diff 验证）
- [x] 13/13 regex test case PASS（独立测试文件 /tmp/v2-independent-test.js 验证）
- [x] validator 5 个 DOCUMENT_INVALID 全部消失（独立 before/after 跑验证）
- [x] 测试 baseline 不退化（HEAD 对比 9/4 一致）
- [x] scope discipline 保持（仅 1 文件 modified）
- [x] 2nd-Reviewer PASS + main-session Final Gate 独立核查 PASS
