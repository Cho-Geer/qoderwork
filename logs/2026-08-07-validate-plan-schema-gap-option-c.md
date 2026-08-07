# 2026-08-07 — validate-plan.ts schema gap 决策：选项 C（接受 + 文档 + 延期至 PHASE-07 后）

## 为什么

`bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts plans/task-lens-m1-completion-v2 "$(pwd)"` 实测 EXIT=1，错误码 `ERR_SCHEMA_DISCRIMINATOR` + `ERR_PLAN_SCHEMA_UNSUPPORTED`。本会话启动 3 步调研：① Explore 收集事实 → ② 主会话判断选项 → ③ high-precision 独立验收（含 EXIT code capture 与 Option A 可行性反证）。

## 选项矩阵

| 选项 | 行动 | 状态 |
|------|------|------|
| **A** | 加 v3 bold-key 行 + 引用 v1 frozen SHA 作 placeholder | **不可能**（2nd-reviewer V7b 反证：validator 的 schema pairs 白名单 `scripts/lib/audit-governance-schema-v3.ts` 第 19-37 行只接受 `audit-governance/v3::*`、`audit-plan-set/v3::plan-set-index` 等 17 对，**显式排除** `outcome-governance/v1::*`。即使填入正确的 v1 SHA，validator 也会在 discriminator 阶段拒绝） |
| **B** | 修改 validator 加 `--allow-inline` flag | 越界（validator header 注释 `/** v3-only PLAN_SET admission. */` 明确禁止；改动会影响所有 plans；不在本会话 scope） |
| **C** | 接受 gap + 文档 + 延期至 PHASE-07 后 | **采纳** |
| **D** | 立即创建新 v3 schema contract/approval 文件 | 自相矛盾（plan 显式声明 `Provenance level: outcome-governance/v1`；不允许新建 `plans/task-lens-outcome-v2/`；DEC-V2-007） |

## Explore agent 报告（已 verification）

- Validator 是 markdown bold-key 解析器（非 YAML frontmatter）。regex `/^\*\*([^*]+)\*\*:\s*`?([^`\n]+)`?\s*$/gm` 解析 `**Key**: value` 行
- Validator 无 flag/env/JSON escape hatch
- 顶层 5 个 plan index 中，3 个缺 Schema version（task-lens-m1, task-lens-m1-completion-v2, audit-governance-evidence-and-status-closure），2 个有 Schema version（path-dynamic-resolution-m1, cross-platform-universality-m1）
- v2 outcome chain 8 文件（contract-v2/spec-v2/bundle-v2/amendment-v2/approval-v2/ledger event-003/event-004/run-result-v2）全部 MISSING
- v2 00-plan-index.md Status = DRAFT
- v2 outcome-governance/v1 provenance 与 validator 的 audit-governance/v3 架构不兼容

## high-precision 独立验收（V1-V8）

| 验证 | 结论 | 证据 |
|------|------|------|
| V1 无 escape hatch | 已核实 | validator source 无 flag/env/JSON |
| V2 bold-key parser | 已核实 | regex 第 26 行；不解析 YAML `---` |
| V3 EXIT codes via bash; echo $? | 部分核实（methodology 修正：Windows Git Bash `bash -c 'echo $?'` 重置 `$?`，正确模式 `cmd ; rc=$? ; echo $rc`）| v2 plan EXIT=1；cross-platform EXIT=0；path-dynamic EXIT=1 |
| V4 v2 outcome chain 文件 | 已核实 | 8/8 MISSING |
| V5 DRAFT status | 已核实 | line 5 `**Status**: \`DRAFT\`` |
| V6 系统性 gap | 已核实（修正） | ≥3 个顶层 plan（含 audit-governance-evidence-and-status-closure，Explore 漏数） |
| V7 Option A 可行性 | **反证 Option A** | V7b 测试：填入真实 v1 SHAs 仍 EXIT=1（schema whitelist 排除 outcome-governance/v1） |
| V8 蓝图 preflight 嵌入 | **发现不一致** | 蓝图 §6.2 + 00-plan-index §8.1 + 99 §2.1+§2.2 preflight 嵌入 validator 调用但**未**标 `[POST-IMPLEMENTATION]`，与 plan 自身的 outcome-governance/v1 provenance 矛盾 |

## 决策

- **decision**: ACCEPT 选项 C（接受 gap + 文档 + 延期）
- **approved_by**: 主会话（main-session Final Gate — audit-separation §c 独立验收）
- **approved_at**: 2026-08-07
- **rounds**: 2（Explore 收集事实 + high-precision 反证 Option A）
- **validator EXIT**:
  - `validate-plan.ts plans/task-lens-m1-completion-v2 $(pwd)` → EXIT=1（独立 captured）
  - 接受为 known limitation，不修
- **延期触发条件**: PHASE-07 完成后，gen2 outcome chain 8 文件（contract-v2/approval-v2 等）落盘到 `plans/task-lens-outcome-v1/` 同目录后；那时将重新评估。但即使 PHASE-07 完成，**outcome-governance/v1 provenance 仍与 validator 的 audit-governance/v3 whitelist 冲突** — 这意味着该 validator 命令在本 v2 plan 上下文永远不可能 EXIT=0

## 后续操作

1. **本会话不修改 plan 文件**（选项 C 意味着接受现状）
2. **本会话不修改 validator**（越界）
3. **下次启动 v2 实施阶段前**：在 plan-index 的 §8.1 preflight 与 99 §2.1+§2.2 preflight 中标记 validator 调用为 `[POST-IMPLEMENTATION; PROVENANCE-MISMATCH]` — 因为 validator 的 audit-governance/v3 架构与 plan 的 outcome-governance/v1 provenance 在设计层不兼容
4. **下次启动 v2 实施阶段时**：改用 `scripts/validate-outcome-governance.ts plans/task-lens-outcome-v1 --repository-root $(pwd)`（outcome-governance/v1 chain 自己的 validator）替代 `validate-plan.ts`，并在 blueprint §6.2 中更新引用
5. **未碰**: blueprint header / INDEX.md / frozen predecessor / plans/task-lens-m1-completion-v2/ 6 文件本体 / outcome-governance v1 文件 / validator source / audit-governance-schema-v3.ts