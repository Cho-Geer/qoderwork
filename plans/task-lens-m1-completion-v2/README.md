# plans/task-lens-m1-completion-v2/ — README

**目录类别**: 产品实施 plan（successor of `plans/task-lens-m1/`），**不是** `plans/task-lens-outcome-v2/` outcome receipts

## 0. 这是什么 / 不是什么

| 是 | 不是 |
|---|---|
| successor 实施 plan（PHASE-05-v2 / 06-v2 / 07-v2） | gen2 outcome `outcome-contract-v2.json` / `acceptance-spec-v2.json` / `outcome-test-bundle-v2.json` / `outcome-approval-v2.json` |
| 双环境（WSL Ubuntu-24.04 native FS + Windows Git Bash）独立 evidence 设计 | gen2 outcome chain 的 ledger event-003/004 / run-result-v2 / receipts（这些属于 `plans/task-lens-outcome-v1/` 同目录） |
| 蓝图 `blueprint-task-lens-m1-completion-v2.md` 的实施细节展开；gen2 通过 amendment 走 generation 2 outcome chain（同 outcome_id, generation=2, supersedes v1）— 不新建 outcome_id；不修改 v1 frozen 文件 | `blueprints/INDEX.md` 同步（本目录不修改 INDEX）；v1 ledger event-001/002 的覆盖（gen2 通过 hash-only 引用接入） |

## 1. 目录结构

```
plans/task-lens-m1-completion-v2/
├── README.md                          ← 本文件
├── 00-plan-index.md                   ← plan 索引（status: DRAFT）
├── 05-phase-metrics-feedback.md       ← successor PHASE-05（status: NOT_STARTED）
├── 06-phase-integration-zero-write.md ← successor PHASE-06（status: BLOCKED）
├── 07-phase-acceptance-closure.md     ← successor PHASE-07（status: BLOCKED）
└── 99-final-verification.md           ← 最终验证（status: NOT-RUN）
```

## 2. 与 frozen predecessor 的关系

- frozen predecessor: `plans/task-lens-m1/{00..99}-*.md`，PHASE-01~04 ACCEPTED，PHASE-05/06/07 frozen-NOT_STARTED；
- frozen outcome v1: `plans/task-lens-outcome-v1/{outcome-contract.json,acceptance-spec.json,outcome-test-bundle.json,outcome-approval.json,ledger/event-001-contract-approved.json,ledger/event-002-run-recorded.json,runs/outcome-run-result.json}`，gen-1 PASS（**4/4 outcome cases PASS**，T-001..T-004）；
- 本目录**不修改**任何 frozen predecessor 文件；
- 本目录**不创建** gen2 outcome 文件；gen2 文件由 v2 实施阶段创建并落盘到 `plans/task-lens-outcome-v1/` 同目录（与 v1 frozen 文件并存；validator 单目录调用，不支持跨目录 ledger continuation）。

## 3. 双环境 evidence root（实施阶段）

| 环境 | Metrics / Feedback | Integration | Acceptance |
|---|---|---|---|
| WSL Ubuntu-24.04 | `${HOME}/.local/state/qoderwork/task-lens/m1-validation/PHASE-05-v2` | `${HOME}/.local/state/qoderwork/task-lens/m1-validation/PHASE-06-v2` | `${HOME}/.local/state/qoderwork/task-lens/m1-acceptance` |
| Windows Git Bash | `%LOCALAPPDATA%\qoderwork\task-lens\m1-validation\PHASE-05-v2` | `%LOCALAPPDATA%\qoderwork\task-lens\m1-validation\PHASE-06-v2` | `%LOCALAPPDATA%\qoderwork\task-lens\m1-acceptance` |

Git Bash mkdir 路径契约：`mkdir -p "$LOCALAPPDATA/qoderwork/task-lens/..."` 或 `mkdir -p "$(cygpath -u "$LOCALAPPDATA")/qoderwork/task-lens/..."`；**禁止 PowerShell 命令**（PowerShell 不是 Git Bash 兼容 shell）。

两环境 evidence root 路径不同；禁止 evidence 跨环境复制。

## 4. v1 → gen2 chain 接入（实施阶段创建于 `plans/task-lens-outcome-v1/` 同目录）

- gen2 contract `outcome-contract-v2.json`：`outcome_id: "TASK-LENS-OUTCOME-V1"`、`generation: 2`、`supersedes` 引用 v1 contract SHA `8009501276e739b9a7cd309af3d5d653a74b67ca2f5934f27cdab70fdb7f0db9`；
- gen2 ledger event-003 `CONTRACT_SUPERSEDED`（hash-only 引用 v1 event-002）/ event-004 `RUN_RECORDED`（引用 event-003）；
- 单一 canonical `outcome-run-result-v2.json`：每个 REQ 两个固定 case（WSL + Git Bash），汇总到同一文件；
- **禁止** `outcome-run-result.gitbash.json` 自创模型；
- **禁止** `plans/task-lens-outcome-v2/` 新目录（validator schema 不支持跨目录 ledger continuation）。

## 5. 状态机

| State | Meaning | Next |
|---|---|---|
| DRAFT | 蓝图草稿/待审批 | human approval → READY-FOR-IMPLEMENTATION |
| READY-FOR-IMPLEMENTATION | human approved | dispatch PHASE-05-v2 |
| IN_PROGRESS | 任一 phase freeze gate 通过 | dispatch next phase |
| BLOCKED | 任一 gate 失败 / frozen conflict / 双端任一 case FAIL / typecheck exit≠0 | stop；record blocker |
| ACCEPTED | FINAL-v2 全部勾选 + INDEX sync + gen2 chain 双端（双 case 全 PASS） | gen2 ledger event-004 落盘到 `plans/task-lens-outcome-v1/` 同目录 |
| WITHDRAWN | human 显式撤销 | 删除本目录 7 文件 + 不修改 frozen |

## 6. INDEX 同步 blocker

- `blueprints/INDEX.md`、`documents/INDEX.md` 不在本目录修改范围；
- INDEX 同步需独立 session，按 blueprints-governance 流程（修改 index 需 plan+audit+INDEX.md 三向同步）；
- 本目录完成 ACCEPT 后，INDEX 同步由独立 session 处理；本目录不冒充 DONE。

## 7. plan vs outcome chain 区分

| 路径 | 角色 |
|---|---|
| `plans/task-lens-m1-completion-v2/` | **产品实施 plan**（本目录） |
| `plans/task-lens-outcome-v1/outcome-{contract,spec,bundle,amendment,approval}-v2.json` + `ledger/event-{003,004}-v2-*.json` + `runs/outcome-run-result-v2.json` | **gen2 outcome receipts**（v2 实施阶段落盘到 `plans/task-lens-outcome-v1/`） |

两份文件骨架不重叠；plan 不创建 outcome 文件，outcome 不写实施步骤。

## 8. 命令契约与不可执行命令

- `validate-plan.ts` argv 契约已实测：2 argv `<plan-dir> <governance-root>`，USAGE 错误 exit 2；
- `validate-outcome-governance.ts` argv 契约已实测：3 argv `<outcome-dir> --repository-root <repo>`；
- `validate-audit.ts` 与 P-01..P-07 v2.1 audit 模板**不引用**（改用 `validate-outcome-governance.ts`）；
- 不可执行命令全部标 `[POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT]` + preflight `test -f`；
- typecheck exit 0 硬约束（v2 严格；predecessor exit=1 容忍已删除）。

## 9. predecessor 状态分裂处置

- predecessor LATEST ACCEPTED vs plan-index NOT_STARTED vs handoff BLOCKED **不再裁决**（DEC-V2-009），仅作历史输入（audits/task-lens-m1/LATEST.md 已 Read，55-pass component claim）；
- successor 以当前树缺失（无 `scripts/task-lens/metrics.ts` 等）+ v1 out_of_scope 为新工作起点。

## 10. 一句话总结
**`plans/task-lens-m1-completion-v2/` 是产品实施 plan，不是 gen2 outcome receipts；它约束目标/边界/固定验收，但不假装已有 v2 代码或测试存在；它接入 v1 通过 gen2 amendment + hash-only ledger reference，不修改 v1；typecheck 必须 exit 0；双 case per REQ 汇总到单一 canonical run-result；禁止 outcome-run-result.gitbash.json 自创模型。**

## 11. Self-Check Gate（本文件级别）

- [x] 目录目的 + frozen-predecessor + INDEX blocker 声明完整
- [x] 双端 evidence root 表 + gen2 chain 摘要 + 命令契约完整
- [x] plan-vs-outcome 区分 + status-split disposition 完整
- [x] 实施后回填 6 行 evidence root 实际路径（WSL: `${HOME}/.local/state/qoderwork/task-lens/{m1-validation/PHASE-05-v2,m1-validation/PHASE-06-v2,m1-acceptance}`；Git Bash: `%LOCALAPPDATA%\qoderwork\task-lens\{...}`；gen2 证据 root: `plans/task-lens-outcome-v1/runs/{env,out,err,receipt}/`，receipt 含 `environment` 字段区分 wsl/gitbash）
- [x] 双端 PASS 后回填 2 行 actual verdict（WSL case verdict: PASS；Git Bash case verdict: PASS；run-result-v2 13/13 case_results 全 PASS；case_id 含 `-WSL`/`-GITBASH` 后缀；validator `ok:true`）
- [x] gen2 落盘后回填 contract/bundle SHA（contract-v2: `ecf48f8a…`；acceptance-spec-v2: `c72eab2e…`；test-bundle-v2: `dddca6c79…`；approval-v2: `847a69c1…`；run-result-v2: `5a2a1075…`；ledger event-003: `ee7cf244…`；event-004: `72d60eba…`）
