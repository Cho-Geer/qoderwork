# Task Lens M1 完工作业 v2 — Plan Index（successor 实施计划）

**Plan mode**: `PLAN_SET`
**ID**: `TASK-LENS-M1-COMPLETION-V2-PLANSET-20260806`
**Status**: `DRAFT`（草稿/待审批；不写"已完成"或"READY-FOR-IMPLEMENTATION"）
**Plan category**: 产品实施 plan（successor of `plans/task-lens-m1/`，不是 generation 2 outcome receipts）
**Progression schema**: `phase-progression/v1`
**Execution order**: 严格遵循 PHASE-05 → PHASE-06 → PHASE-07；任一 gate 失败即停止。
**Evidence ceiling**: `integration + manual verification`（不再 component-only）
**Provenance level**: outcome-governance/v1（不再沿用 v2.1 audit framework）
**Outcome governance**: 通过 amendment 走 generation 2；与 v1 同 `outcome_id: TASK-LENS-OUTCOME-V1`；不新建 `outcome_id`；不新建 `plans/task-lens-outcome-v2/` 目录

> 本文件是 successor plan index，不修改 frozen predecessor `plans/task-lens-m1/00-plan-index.md`。两份 index 并存：旧 index `Status: SUPERSEDED_BY_OUTCOME_GOVERNANCE_V1`；本 index `Status: DRAFT`。

## 0. 关系与边界

### 0.1 前驱（已冻结，不在本轮编辑范围）

| 前驱文件 | 状态 | v2 关联方式 |
|---|---|---|
| `blueprints/blueprint-task-lens-m1.md` | 已退役（v0.1.5） | 仅引用，§0/§2/§G1-G5 |
| `blueprints/blueprint-task-lens-outcome-v1.md` | 已完成（v1.0.0） | outcome-governance/v1 框架 reference |
| `plans/task-lens-m1/00..04-phase-*.md` | PHASE-01~04 ACCEPTED | v2 视为前置；不得修改 |
| `plans/task-lens-m1/05..07-phase-*.md`、`99-final-verification.md` | NOT_STARTED / BLOCKED（predecessor 状态分裂不再裁决，仅作为历史输入） | frozen-NOT_STARTED；v2 不修改；v2 在 `plans/task-lens-m1-completion-v2/` 新建对应文件 |
| `plans/task-lens-outcome-v1/{outcome-contract,acceptance-spec,outcome-test-bundle,outcome-approval}.json` + `ledger/event-001-contract-approved.json` + `ledger/event-002-run-recorded.json` + `runs/outcome-run-result.json` | gen-1 PASS（**4/4 outcome cases PASS**（T-001..T-004）） | frozen immutable；v2 不修改 |
| `audits/task-lens-m1/**` | 历史 evidence | frozen；v2 不修改；**v2 禁止作为 evidence root 引用 / 不得写入 legacy `audits/**`**（§1 source ledger 表允许以 historical input 角色 Read frozen `audits/task-lens-m1/LATEST.md` 与 `audits/task-lens-outcome-v1/LATEST.md` 来理解 predecessor 状态分裂 — DEC-V2-010） |
| `blueprints/INDEX.md`、`documents/INDEX.md` | 当前状态 | v2 INDEX 同步是 blocker，非本轮范围 |

### 0.2 successor（v2 本轮新建）

| 路径 | 类别 | 行数预算 |
|---|---|---|
| `blueprints/blueprint-task-lens-m1-completion-v2.md` | 蓝图（草稿/待审批） | 350-450 |
| `plans/task-lens-m1-completion-v2/00-plan-index.md` | 本文件 | 280-330 |
| `plans/task-lens-m1-completion-v2/05-phase-metrics-feedback.md` | successor PHASE-05 | 200-280 |
| `plans/task-lens-m1-completion-v2/06-phase-integration-zero-write.md` | successor PHASE-06 | 240-320 |
| `plans/task-lens-m1-completion-v2/07-phase-acceptance-closure.md` | successor PHASE-07 | 220-300 |
| `plans/task-lens-m1-completion-v2/99-final-verification.md` | 最终验证 | 120-180 |
| `plans/task-lens-m1-completion-v2/README.md` | 范围说明 | 60-100 |

### 0.3 generation 2 outcome chain 设计接口（gen2 文件待 v2 实施阶段落盘；不创建在本轮）

gen2 文件置于 `plans/task-lens-outcome-v1/` 同目录（validator 单目录调用，不支持跨目录 ledger continuation）。v1 frozen 文件保持不动。

| 路径 | 角色 | 本轮状态 |
|---|---|---|
| `plans/task-lens-outcome-v1/outcome-contract-v2.json` | gen=2 contract，`supersedes` 引用 v1 SHA `8009501276e739b9a7cd309af3d5d653a74b67ca2f5934f27cdab70fdb7f0db9` | 设计接口已写；不创建 |
| `plans/task-lens-outcome-v1/acceptance-spec-v2.json` | REQ-011v2/012v2/013v2/014v2/REQ-CROSS-ENV + oracle O-002 | 设计接口已写；不创建 |
| `plans/task-lens-outcome-v1/outcome-test-bundle-v2.json` | tests SHA 绑定（SHA 在实施后采集），冻结双端 runner/oracle | 不预先填 SHA |
| `plans/task-lens-outcome-v1/outcome-amendment-v2.json` | from_contract=v1、to_contract=gen2、change_class=NORMAL、prior_failures=[]、frozen_diff by validator function | 不创建 |
| `plans/task-lens-outcome-v1/outcome-approval-v2.json` | `actor_type: HUMAN`、`approved_by: ChoGeer`、`principal_id: HUMAN:ChoGeer`、`trust_domain: human-primary`、amendment 字段引用 gen2 amendment | 不创建 |
| `plans/task-lens-outcome-v1/ledger/event-003-v2-contract-superseded.json` | sequence=3、event_type=CONTRACT_SUPERSEDED、amendment_ref=gen2 amendment、previous_event=hash-only ref v1 event-002 | 不创建 |
| `plans/task-lens-outcome-v1/ledger/event-004-v2-run-recorded.json` | sequence=4、event_type=RUN_RECORDED、previous_event=event-003 | 不创建 |
| `plans/task-lens-outcome-v1/runs/{env,out,err,receipt}/` | WSL native FS + Windows Git Bash 双端 evidence root；case 独立 receipt | 不创建 |
| `plans/task-lens-outcome-v1/runs/outcome-run-result-v2.json` | gen2 verdict（每个 REQ 两个固定 case：WSL case + Git Bash case，汇总到单一 canonical run-result） | 不创建 |

### 0.4 禁止项

- 新建 `plans/task-lens-outcome-v2/` 目录（validator schema 不支持跨目录 ledger continuation，且 outcome-governance/v1 要求同 outcome_id 跨 generation）；
- 新建 `runs/outcome-run-result.gitbash.json` 自创模型（不在 outcome-governance/v1 schema 中）；
- 修改任何 v1 frozen 文件（含 `outcome-contract.json` 等 7 件 + 全部 ledger event + 全部 runs 文件）；
- 复制 v1 ledger 文件内容到 gen2 ledger（hash-only reference 即可）；
- 创建 `plans/task-lens-outcome-v2/**` 任何文件（gen2 文件均位于 `plans/task-lens-outcome-v1/` 同目录）；
- 禁止作为 evidence root 引用 / 不得写入 `audits/**`（包括 `audits/task-lens-m1/**`、`audits/task-lens-outcome-v1/**`）；仅允许以 historical input 角色 Read frozen `audits/task-lens-m1/LATEST.md` 与 `audits/task-lens-outcome-v1/LATEST.md`（DEC-V2-010）；
- 引用 `validate-audit.ts`（`scripts/lib/plan-audit-archiver/scripts/validate-audit.ts`）任何变体；
- 引用 P-01..P-07 audit governance v2.1 模板；
- 沿用 predecessor `typecheck_exit=1` 容忍（v2 typecheck 必须 exit 0）。

## 1. 输入契约与源 ledger

| Source | Version/status | Sections used | Authority | Current/historical |
|---|---|---|---|---|
| `blueprints/blueprint-task-lens-m1-completion-v2.md` | v2.0.0-draft | 全文 | requirements | current |
| `blueprints/blueprint-task-lens-outcome-v1.md` | v1.0.0 | §一、§二、§三 | framework | current |
| `plans/task-lens-m1/00-plan-index.md` | ACCEPTED-PHASE-04（predecessor 状态分裂不再裁决） | REQ-001..014、文件清单、phase manifest | inheritance | historical |
| `plans/task-lens-m1/05-phase-metrics-feedback.md` | frozen-NOT_STARTED | REQ-011/012 | inheritance | historical |
| `plans/task-lens-m1/06-phase-integration-zero-write.md` | frozen-BLOCKED | REQ-013 | inheritance | historical |
| `plans/task-lens-m1/07-phase-acceptance-closure.md` | frozen-BLOCKED | REQ-014 | inheritance | historical |
| `plans/task-lens-outcome-v1/outcome-contract.json` | gen-1 PASS（4/4 outcome cases PASS, T-001..T-004） | `out_of_scope` 列表、`in_scope[5]` metrics 写入契约 vs PHASE-05 out_of_scope 模糊点 | boundary | current |
| `plans/task-lens-outcome-v1/runs/outcome-run-result.json` | gen-1 PASS | 4 case_results[] | evidence | current |
| `handoff/2026-08-06-task-lens-outcome-v1-attempt-1-wsl-canonical.md` | wsl canonical | 双环境差异表 | evidence | current |
| `blueprints/blueprint-cross-platform-universality.md` | v3 ACCEPTED | §1.2 + §2.1（WORK_ONE_ROOT + QODERWORK_ROOT） | anchor | current |
| `audits/task-lens-m1/LATEST.md` | PHASE-05 ACCEPTED（**55 pass / 0 fail across 4 suites — historical component claim only**，不等于 v1 4-case outcome scope） | predecessor 状态 | inheritance | historical |
| `audits/task-lens-outcome-v1/LATEST.md` | v1 outcome 历史审计（frozen） | predecessor 状态分裂理解（DEC-V2-009） | inheritance | historical |
| `scripts/lib/outcome-governance-v1.ts` | 355 行已 Read | validator schema | framework | current |
| `scripts/validate-outcome-governance.ts` | 246 行已 Read | validator CLI USAGE + structural-only mode | framework | current |
| `scripts/validate-plan.ts` | 已 Read argv contract | plan structural validator | framework | current |

### 1.1 successor atomic requirements（REQ-XXXv2 编号）

| ID | Condition | Required behavior | Observable result | Source | Owning Phase |
|---|---|---|---|---|---|
| REQ-011v2 | artifact commit 后生成 event | mkdir-lock + append + fsync + full-parse | metrics.jsonl 可解析且绑定 taskId；generated 单事件 | plans/task-lens-m1/05 §REQ-011（predecessor） | PHASE-05-v2 |
| REQ-012v2 | single mutation 负例 | lock/JSONL/generated/recovery/feedback/summary/CLI 任一被破坏 | failedChecks singleton + 正确 exit 21/10/2 | plans/task-lens-m1/05 §REQ-012 | PHASE-05-v2 |
| REQ-013v2 | fixture + 双真实目标 | fixture WT/commit/delete/coverage/safety + work-one + qoderwork-main | 双目标 before/after status/tracked/nonTool hash 全等 | plans/task-lens-m1/06 §REQ-013 | PHASE-06-v2 |
| REQ-014v2 | 10 任务业务验收 | 10 unique pairs + ≥7/10 双 yes + 全测试 + typecheck exit 0（v2 严格） + 双目标 receipts | summary gate PASS + validate-outcome-governance.ts exit 0 + 4 文档状态一致 | plans/task-lens-m1/07 §REQ-014 | PHASE-07-v2 |
| REQ-CROSS-ENV | 双环境独立 evidence + 双 case per REQ | WSL case + Git Bash case 各自 verdict；任一 FAIL = 整体 FAIL | 互不外推；单 canonical run-result 汇总 | handoff §2 + blueprint §3.5 | ALL-v2 phases |

## 2. 决策、非目标与优先级

### 2.1 Decision ledger

| ID | Question | Upstream decision | Current-code constraint | Final contract | Status |
|---|---|---|---|---|---|
| DEC-V2-001 | 实施 plan 与 outcome 分离 | outcome-governance/v1 区分 | v1 frozen | 本轮只写 plan + gen2 outcome 设计接口，不创建 gen2 文件 | CLOSED |
| DEC-V2-002 | frozen predecessor 不可改 | plans/task-lens-m1/ 与 plans/task-lens-outcome-v1/ frozen | git diff 只命中 v2 新建 | 任何越界 diff = blocker | CLOSED |
| DEC-V2-003 | 双环境独立 evidence | handoff §2 已记录差异 | validator regex 仅 POSIX path | WSL evidence root ≠ Git Bash evidence root；单 canonical run-result 汇总两端 case | CLOSED |
| DEC-V2-004 | INDEX 同步延期 | v2 蓝图未审批 | INDEX 同步需 plan+audit 三向 | 本轮报告 blocker；不修改 INDEX | CLOSED |
| DEC-V2-005 | v1 ledger chain 不篡改 | v1 ledger sequence=1..2 frozen | ledger hash reference only | gen2 event-003.previous_event = hash-only ref v1 event-002；event-003/004 新建 | CLOSED |
| DEC-V2-006 | typecheck exit 0 硬约束 | predecessor 容忍 exit=1（BLAST-V1 残留） | 当前 HEAD 实测 `bun run typecheck` EXIT=0 | v2 严禁容忍 exit≠0；BLK-V2-003 删除 | CLOSED |
| DEC-V2-007 | gen2 chain 不新建 outcome_id | validator schema 要求同 outcome_id 跨 generation | `validateOutcomeLedger` 第 333 行 | gen2 文件置于 `plans/task-lens-outcome-v1/` 同目录；outcome_id=`TASK-LENS-OUTCOME-V1`；generation=2 | CLOSED |
| DEC-V2-008 | 双端验收建模 | outcome-governance/v1 schema | 单 `outcome-run-result.json` | 每个 REQ 两个固定 case（WSL + GitBash），汇总到单一 canonical run-result | CLOSED |
| DEC-V2-009 | predecessor 状态分裂不再裁决 | LATEST ACCEPTED vs plan-index NOT_STARTED vs handoff BLOCKED | 不裁决 | 仅作为历史输入；successor 以当前树缺失 + v1 out_of_scope 为新工作起点 | CLOSED |
| DEC-V2-010 | v2 不把 `audits/**` 作为 gen2 evidence root 或 PASS 来源；v2 plan-index §1 source ledger 表允许以 historical input 角色 Read frozen `audits/task-lens-m1/LATEST.md` 与 `audits/task-lens-outcome-v1/LATEST.md` 来理解 predecessor 状态分裂（DEC-V2-009），但不得作为 v2 acceptance 或 verdict 证据 | predecessor 引用 `audits/task-lens-m1/**` 作为 evidence root | v2 改用 gen2 evidence 全部在 `plans/task-lens-outcome-v1/` 内 | v2 allowed-files 与 forbidden-files 中均不列 `audits/**`（既非 allowed 也非 forbidden；禁止作为 evidence root 引用 / 不得写入） | CLOSED |

### 2.2 In scope

- 本轮 7 个新文件（见 §0.2）；
- gen2 outcome chain 设计接口（见 §0.3），仅在 phase 文件中以"设计接口/交付清单"形式陈述；
- 双环境矩阵在 plan 文件中显式展开。

### 2.3 Out of scope

- 修改 `blueprints/INDEX.md`、`documents/INDEX.md`（blocker）；
- 修改 frozen predecessor 任何文件（`plans/task-lens-m1/**`、`plans/task-lens-outcome-v1/**`、`audits/task-lens-m1/**`、`blueprints/blueprint-task-lens-m1.md`、`blueprints/blueprint-task-lens-outcome-v1.md`）；
- 创建 `plans/task-lens-outcome-v2/` 下任何文件（gen2 chain 沿用 v1 同目录）；
- 创建 `runs/outcome-run-result.gitbash.json` 自创模型；
- 复制 v1 ledger 文件内容到 gen2 ledger；
- 伪造 gen2 approval / ledger event / run-result / receipts / any "已通过" 表述；
- 容忍 `bun run typecheck` exit ≠ 0；
- 引用 `validate-audit.ts` 任何变体与 P-01..P-07 v2.1 audit 模板；
- 禁止作为 evidence root 引用 / 不得写入 legacy `audits/**`（仅允许 historical input Read frozen LATEST.md）；
- 修改 `package.json`、`bun.lock`、`scripts/lib/workspace-paths.ts`；
- 修改 `scripts/task-lens/**` 现有文件（v2 实施阶段在独立 session 落盘）；
- 修改 `scripts/_b1_live.ts`（predecessor 范围，predecessor 状态分裂不再裁决）；
- 裁决 predecessor PHASE-05 LATEST ACCEPTED vs plan-index NOT_STARTED vs handoff BLOCKED 状态分裂（DEC-V2-009）。

### 2.4 Open / blocking items

- **BLK-V2-001**：INDEX sync deferred（v2 蓝图审批后由独立 session 处理）。
- **BLK-V2-002**：gen2 outcome 目录骨架本轮不创建（待 v2 蓝图审批 + contract 草稿 human-approved）；gen2 文件落盘到 `plans/task-lens-outcome-v1/` 同目录。

### 2.5 Negative evidence semantics

- FOUND / NOT_FOUND / UNAVAILABLE；只有 readable + query success + NOT_FOUND 才计 negative PASS。
- 双环境 acceptance summary 各自区分 FOUND/NOT_FOUND/UNAVAILABLE；不得合并 verdict。

### 2.6 Current vs historical evidence

- 历史 evidence（v1 outcome 4/4 PASS、PHASE-05 55-pass v2.1 ACCEPT）只证明历史；
- gen2 success 必须基于 gen2 plan 实施后新采集的 evidence root；不得引用 v1 evidence root 路径作为 gen2 PASS；
- 55-pass predecessor claim 是 component-level 历史声明，与 v1 4-case frozen outcome scope 严格区分；不可外推。

## 3. 跨平台 acceptance matrix（强制两套独立 evidence）

| 维度 | WSL Ubuntu-24.04 native FS（POSIX） | Windows Git Bash（MINGW64_NT） |
|---|---|---|
| 工作目录 | `<WORKTREE>` POSIX 路径 | `<WORKTREE>` Win32 路径；Git Bash 看到 POSIX-like mount（MSYS） |
| bun | `bun 1.3.14` | `bun 1.3.14`（PATH 命中） |
| mkdir lock | 原子创建 + fsync 通常成功 | Win32 directory handle；语义不等价 |
| symlink (TL-C-103) | ✅ 创建 | ❌ EPERM（已实测，handoff §2） |
| fsync (TL-ATOMIC) | ✅ 成功 | ❌ 部分失败 EPERM（已实测） |
| SQLite readonly path | POSIX path-replace ✅ | 反斜杠路径倍增（已实测） |
| Validator regex `runs/receipt/...` | ✅ forward-slash 命中 | ❌ backslash 不命中（已实测） |
| Real-target out root | `${HOME}/.local/state/qoderwork/task-lens/m1-validation/PHASE-06` | `%LOCALAPPDATA%\qoderwork\task-lens\m1-validation\PHASE-06` |
| Acceptance out root | `${HOME}/.local/state/qoderwork/task-lens/m1-acceptance` | `%LOCALAPPDATA%\qoderwork\task-lens\m1-acceptance` |
| mkdir 路径契约 | `mkdir -p <anchor>` | `mkdir -p "$LOCALAPPDATA/qoderwork/task-lens/..."` 或 `mkdir -p "$(cygpath -u "$LOCALAPPDATA")/qoderwork/task-lens/..."`；**禁止 PowerShell** |
| Test command prefix | `bun test scripts/task-lens` | 同（进程模型不同） |
| Validator USAGE | `bun run scripts/validate-outcome-governance.ts <dir> --repository-root <repo>` | 同 |
| outcome case per REQ | 1 case（WSL） | 1 case（Git Bash） |
| Verdict 合并 | run-result.case_results 包含两端 case；任一 FAIL = 整体 FAIL | 同 |

**强制约束**：
- 两环境 evidence root 路径不同，禁止 path 翻译层共用；
- 两环境各自的 `bun test` exit code 独立判定；不得合并；
- 两环境各自的 validator 调用必须以各环境 native path 启动；WSL-only 命令标 `WSL only`；Git Bash only 命令标 `Git Bash only`；
- 双环境 verdict 写入同一 canonical run-result；不允许 outcome-run-result.gitbash.json 自创模型。

## 4. 端到端 traceability

| Requirement | Phase | File/symbol | Check name | Evidence source | Happy fixture | Single mutation | Test ID | Level | Env |
|---|---|---|---|---|---|---|---|---|---|
| REQ-011v2 WSL | 05-v2 | `scripts/task-lens/metrics.ts` (future) | TL-LOCK / TL-JSONL / TL-GENERATED / TL-RECOVERY / TL-FEEDBACK / TL-SUMMARY / TL-CLI-FLOW | `metrics.jsonl` + concurrent subprocess | two-process lock | truncate last JSON line | TL-C-401-v2-WSL | component | WSL |
| REQ-011v2 GitBash | 05-v2 | 同上 | 同上 | 同上 | 同上 | 同上 | TL-C-401-v2-GITBASH | component | Git Bash |
| REQ-012v2 WSL | 05-v2 | test registry | TL-NEGATIVE | all-pass + single mutation | valid metrics | inject precreate lock | TL-C-402-v2-WSL | component | WSL |
| REQ-012v2 GitBash | 05-v2 | 同上 | 同上 | 同上 | 同上 | 同上 | TL-C-402-v2-GITBASH | component | Git Bash |
| REQ-013v2 WSL | 06-v2 | `__tests__/integration.test.ts` (future) | TL-INT-WT / TL-INT-COMMIT / TL-INT-DELETED / TL-INT-COVERAGE / TL-INT-SAFETY / TL-WORK-ONE / TL-QODERWORK / TL-ZERO-WRITE | fixtures + dual real-target | all-pass fixture | write sentinel | TL-I-501-v2-WSL | integration | WSL |
| REQ-013v2 GitBash | 06-v2 | 同上 | 同上 | 同上 | 同上 | 同上 | TL-I-501-v2-GITBASH | integration | Git Bash |
| REQ-014v2 WSL | 07-v2 | acceptance root | TL-10TASK / TL-7OF10 / TL-SENSITIVE / TL-ALL-TESTS / TL-TYPECHECK / TL-TARGET-PURITY / TL-AUDIT / TL-DOC-STATE | 10-task metrics + temp mutation | 10 pairs | remove 1 feedback | TL-M-601-v2-WSL | manual | WSL |
| REQ-014v2 GitBash | 07-v2 | 同上 | 同上 | 同上 | 同上 | 同上 | TL-M-601-v2-GITBASH | manual | Git Bash |
| REQ-CROSS-ENV | ALL-v2 | single canonical run-result | dual case_results | gen2 outcome-run-result-v2.json | 双端全 PASS | 一端 FAIL | TL-X-001 | structural | n/a |

## 5. 文件变更清单

| Phase | Exact paths | Change | Notes |
|---|---|---|---|
| 00 | `plans/task-lens-m1-completion-v2/00-plan-index.md` | add | 本文件 |
| 00 | `plans/task-lens-m1-completion-v2/README.md` | add | 范围说明 |
| 05-v2 | `plans/task-lens-m1-completion-v2/05-phase-metrics-feedback.md` | add | successor PHASE-05 |
| 06-v2 | `plans/task-lens-m1-completion-v2/06-phase-integration-zero-write.md` | add | successor PHASE-06 |
| 07-v2 | `plans/task-lens-m1-completion-v2/07-phase-acceptance-closure.md` | add | successor PHASE-07 |
| 99 | `plans/task-lens-m1-completion-v2/99-final-verification.md` | add | 最终验证 |
| n/a | `blueprints/blueprint-task-lens-m1-completion-v2.md` | add | 蓝图（草稿/待审批） |

### 5.1 Globally forbidden changes（本轮）

- 任何 `blueprints/INDEX.md`、`documents/INDEX.md`、`plans/task-lens-m1/**`、`plans/task-lens-outcome-v1/**`、`audits/**`（v2 禁止作为 evidence root 引用 / 不得写入 legacy audits；仅允许 historical input Read frozen LATEST.md — DEC-V2-010）、`blueprints/blueprint-task-lens-m1.md`、`blueprints/blueprint-task-lens-outcome-v1.md`、`scripts/**`、`package.json`、`bun.lock`、`tsconfig.json`、`MEMORY.md`、`AGENTS.md`、`RULES.md`、`e2e/**`、`e2e-evidence/**`、`handoff/**`、`logs/**` 的修改。
- 注意：`audits/**` 既不在 allowed-files，也不在 forbidden-files 之外的隐含 allowed 范围；v2 plan 禁止作为 evidence root 引用 / 不得写入 legacy audits 文件。

### 5.2 INDEX 同步 blocker

v2 蓝图审批通过后，INDEX 同步需独立 session：
- `blueprints/INDEX.md` 活跃段添加 v2 蓝图条目（status: 草稿 → 待审批 → 已完成/已退役）；
- `documents/INDEX.md` 添加 `plans/task-lens-m1-completion-v2/00-plan-index.md` 路由条目。
本轮不修改 INDEX。

## 6. Phase manifest

| Order | Phase ID | File | Depends on | Status |
|---:|---|---|---|---|
| 1 | PHASE-05-v2 | `05-phase-metrics-feedback.md` | frozen PHASE-04 ACCEPTED | NOT_STARTED |
| 2 | PHASE-06-v2 | `06-phase-integration-zero-write.md` | PHASE-05-v2 ACCEPTED | BLOCKED |
| 3 | PHASE-07-v2 | `07-phase-acceptance-closure.md` | PHASE-06-v2 ACCEPTED | BLOCKED |
| 4 | FINAL-v2 | `99-final-verification.md` | PHASE-07-v2 ACCEPTED | BLOCKED |

### 6.1 阶段依赖与停止条件

- 任一 phase gate 未勾选 → 下一 phase 不得开始；
- 任一 phase 报告 BLOCKED → 主会话收到后停止派遣；
- 跨环境 evidence 任一端 FAIL → phase gate 整体 FAIL（除非 plan 显式声明降级，本轮不降级）；
- 任一端 case FAIL = 整体 verdict FAIL（不允许"两端合并 verdict"）。

## 7. 状态机与不可恢复行为

| 状态 | 触发 | 后续 |
|---|---|---|
| `DRAFT` | 本轮新建（默认） | 等 human approval 进入 READY-FOR-IMPLEMENTATION |
| `READY-FOR-IMPLEMENTATION` | human approval 落盘后由独立 session 改 | 可派遣 PHASE-05-v2 |
| `IN_PROGRESS` | PHASE-05-v2 Freeze Gate 通过 | 派遣后续 phase |
| `BLOCKED` | 任一 phase gate 失败 / frozen conflict / 双环境任一 FAIL | 停止；记录 blocker |
| `ACCEPTED` | FINAL-v2 全部 gate PASS + INDEX 同步 + gen2 outcome chain 创建 + 双端 verdict PASS | 写入 `plans/task-lens-outcome-v1/ledger/event-004-v2-run-recorded.json` |
| `WITHDRAWN` | human 显式撤销 | 删除本轮 7 文件 + 不修改 frozen |

**禁止**：
- 在 DRAFT 状态声称任何 phase ACCEPTED；
- 在 BLOCKED 状态跳到 ACCEPTED；
- 在 gen2 outcome 文件未创建前声称"gen2 outcome PASS"；
- 任一端 case FAIL 时合并为整体 PASS。

## 8. 命令契约（精确 argv + 路径可执行性预检）

### 8.1 validate-plan.ts argv 契约（已实测）

`scripts/validate-plan.ts` 不在 PATH；正确入口是 `.agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts`（已 `test -f` 验证）。

```bash
# USAGE: bun run <validator-path> <plan-dir> <governance-root>
test -f .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts
bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts plans/task-lens-m1-completion-v2 "$(pwd)"
```

USAGE 错误返回 exit 2 + `{"ok":false,"mode":"structural","errors":["USAGE"]}`。

### 8.2 validate-outcome-governance.ts argv 契约（已实测）

```bash
# USAGE: bun run scripts/validate-outcome-governance.ts <outcome-dir> --repository-root <repo>
test -f scripts/validate-outcome-governance.ts
bun run scripts/validate-outcome-governance.ts plans/task-lens-outcome-v1 --repository-root "$(pwd)"
```

`mode: "structural"`、`validation_kind: "review-separated"`（validator 第 15 行），**不证明真实执行**。

### 8.3 非现有文件的命令（v2 实施阶段才能运行）

```bash
# [POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT] — preflight gate
test -f scripts/task-lens/__tests__/metrics.test.ts || { echo BLOCKED; exit 1; }
bun test scripts/task-lens/__tests__/metrics.test.ts ...
```

## 9. Self-Check Gate（本文件级别）

- [x] 状态标为 DRAFT，不标"已完成"或"READY-FOR-IMPLEMENTATION"
- [x] 前驱 frozen 清单明确（§0.1）
- [x] successor 新建清单明确（§0.2）
- [x] gen2 outcome 设计接口列出但不创建（§0.3）
- [x] generation 2 通过 amendment 接入 v1（DEC-V2-007）；不新建 outcome_id
- [x] 禁止新建 `plans/task-lens-outcome-v2/`（§0.4）
- [x] 禁止新建 `outcome-run-result.gitbash.json`（§0.4 + DEC-V2-008）
- [x] Decision ledger 10 条 closed（§2.1）
- [x] In/Out of scope 明确（§2.2/§2.3）
- [x] Blocker 2 条明确（§2.4）
- [x] 双环境 acceptance matrix 列全（§3）
- [x] 端到端 traceability 表完整（§4）
- [x] 文件变更清单精确到 7 个（§5）
- [x] Globally forbidden changes 列全（§5.1）；`audits/**` 不在 allowed 也不在隐含 allowed（禁止作为 evidence root 引用 / 不得写入）
- [x] Phase manifest + 依赖 + 停止条件完整（§6 / §6.1）
- [x] 状态机 + 不可恢复行为明确（§7）
- [x] validate-plan.ts argv 契约已实测（§8.1）
- [x] validate-outcome-governance.ts argv 契约已实测（§8.2）
- [x] 非现有文件命令标 `[POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT]`+ preflight `test -f`（§8.3）
- [x] predecessor 状态分裂仅作为历史输入（DEC-V2-009）
- [x] 55-pass predecessor 历史 claim 与 v1 4-case frozen outcome 明确区分（§2.6 + §1 source ledger 行）