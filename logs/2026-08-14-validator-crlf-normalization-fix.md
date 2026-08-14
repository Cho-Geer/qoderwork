# 2026-08-14 Validator CRLF Normalization Fix

**目的**: 修复 `scripts/lib/outcome-governance-v1.ts:102` 的 sha256() CRLF 归一化缺口，使 Windows Git Bash 上 validator 返回 EXIT=0。

**改了什么**:
1. `scripts/lib/outcome-governance-v1.ts:102` sha256() 函数增加 CRLF→LF 归一化（与 CLI `sha()` 一致）
2. 新建独立 plan `plans/task-lens-validator-crlf-fix/00-plan-index.md`（D-A 方案实现记录，237 行，Status: IMPLEMENTED）
3. 新建 handoff `handoff/2026-08-14-task-lens-m1-completion-v2-validator-crlf-handoff.md`

**决策**: D-A（lib 级归一化）而非 D-B（CLI 级）或 D-C（bundle 声明改 raw）。理由：lib 级 fix 与 WSL LF native 行为等价，影响面最小、检测能力保留（A6 负向控制验证）。

**更新文档**:
- 修改 `scripts/lib/outcome-governance-v1.ts`（+7/-1）
- 新建 `plans/task-lens-validator-crlf-fix/00-plan-index.md`
- 新建 `handoff/2026-08-14-task-lens-m1-completion-v2-validator-crlf-handoff.md`
