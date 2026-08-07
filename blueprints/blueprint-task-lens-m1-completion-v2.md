# Blueprint: Task Lens M1 完工作业 v2 — successor PHASE-05/06/07 + Outcome generation 2

**创建日期**: 2026-08-06
**更新日期**: 2026-08-07
**状态**: 待实施（草稿已批准 2026-08-07；INDEX 同步 deferred 至 v2 contract APPROVED 阶段 — §5.3）
**蓝图分类**: 产品实施蓝图（successor，非冻结）
**版本**: v2.0.0-draft（v1 后的 1 代 increment；不与 v1 同 ID 起步 — v2 通过 outcome-governance/v1 amendment 走 generation=2 通道）
**治理框架**: outcome-governance/v1（通过 amendment + CONTRACT_SUPERSEDED ledger event 走 generation 2；非新 outcome_id）
**对应文件集（本轮仅新建/修改，不修改旧 frozen 链路）**:
- `plans/task-lens-m1-completion-v2/00-plan-index.md`
- `plans/task-lens-m1-completion-v2/05-phase-metrics-feedback.md`
- `plans/task-lens-m1-completion-v2/06-phase-integration-zero-write.md`
- `plans/task-lens-m1-completion-v2/07-phase-acceptance-closure.md`
- `plans/task-lens-m1-completion-v2/99-final-verification.md`
- `plans/task-lens-m1-completion-v2/README.md`（说明此为产品实施 plan，不是 gen2 outcome receipts）

**前驱（已冻结/已接受，不在本轮编辑范围）**:
- `blueprints/blueprint-task-lens-m1.md`（v0.1.5，已退役；仅引用，不修改）
- `blueprints/blueprint-task-lens-outcome-v1.md`（v1.0.0，已完成；gen2 通过 amendment 接入，不破坏 v1）
- `plans/task-lens-m1/`（PHASE-01~04 已 ACCEPTED，PHASE-05/06/07 frozen-NOT_STARTED/BLOCKED；本轮不修改）
- `plans/task-lens-outcome-v1/`（gen-1 PASS，4/4 outcome cases PASS；contract/approval/ledger frozen；本轮不修改）

---

## 〇、读图提示与适用范围

- 第一次接触本蓝图：先看「〇、读图提示」与「一、问题与根因」，再看「三、核心设计」与「四、12 子系统合规审计」，最后看「五、实施清单 + 六、验证计划 + 七、风险与回滚 + 八、成功标准」。
- 本蓝图是 **successor（接续实施）** 蓝图，不是 audit 蓝图：它**约束目标/边界/固定验收/文件清单**，但**不假装已有代码或测试已存在**；任何"已实现"、"已通过"的措辞仅指向 frozen predecessor 的事实，本轮新建代码与测试在文件落地前均视为不存在。
- 本蓝图显式 out_of_scope：`plans/task-lens-outcome-v1/` 中已冻结的 contract/approval/ledger/receipts；`plans/task-lens-m1/` 中旧 phase 文件本体；`blueprints/INDEX.md`、`documents/INDEX.md`、旧 `audits/` 历史。

## 一、问题与根因

### 1.1 问题描述

Task Lens M1 解析契约已通过 `plans/task-lens-outcome-v1/`（generation 1）冻结为 **4/4 outcome cases PASS**（T-001..T-004，对应 input-diff / command-security / provider-graph+spine / coverage-render+artifact-writer 四个 acceptance-spec `cases[].id`），gen-1 run-result `RUN-TASK-LENS-OUTCOME-V1-GEN1-001` verdict=PASS。但 **M1 的产品实施只完成了解析管线部分**，其余三个关键缺口尚未在 v1 outcome 中体现：

1. **PHASE-05 metrics/feedback（REQ-011/012）**：v1 outcome contract `out_of_scope` 显式排除 metrics/feedback；predecessor phase 文件本体状态分裂（plan-index NOT_STARTED vs LATEST ACCEPTED vs handoff BLOCKED）。
2. **PHASE-06 双目标集成（REQ-013）**：v1 outcome `out_of_scope` 显式排除。
3. **PHASE-07 10 任务业务验收（REQ-014）**：v1 outcome `out_of_scope` 显式排除。

### 1.2 根因分析

- **直接原因**：outcome-governance/v1 把 M1 已交付的解析契约冻结为 component-only 边界；v1 contract 用 `out_of_scope` 把 PHASE-05/06/07 显式排除，避免扩大验收边界导致 regression 风险。这是有意设计。
- **根本原因**：outcome-governance/v1 区分"已通过 assertion 的契约"（outcome）与"未实施或部分实施的实施细节"（plan）。v1 outcome 没有义务容纳 PHASE-05+；需要 successor 显式接管。
- **附加根因（环境相关）**：handoff `2026-08-06-task-lens-outcome-v1-attempt-1-wsl-canonical.md` 已记录 WSL Ubuntu-24.04 与 Windows Git Bash 在 EPERM symlink/fsync、validator path-regex、TL-C-103、TL-ATOMIC、TL-PROBE 等行为上的差异。successor 必须在 WSL 原生 FS（POSIX 语义）与 Windows Git Bash（Win32 + Cygwin/MSYS 混合）双环境分别定义 acceptance 矩阵，禁止把一端 evidence 外推到另一端。

### 1.3 实测验证（仅指向已记录事实，不外推未实施项）

- **Verified-by**: `plans/task-lens-outcome-v1/runs/outcome-run-result.json` — gen-1 RUN `RUN-TASK-LENS-OUTCOME-V1-GEN1-001` verdict=PASS，**4/4 outcome cases PASS**（T-001..T-004）；case_results[] 包含 4 项 entry；`inventory.discovered_test_ids/executed_test_ids` 长度=4。结论：v1 contract frozen & binding；case-count 表达。
- **Verified-by**: `handoff/2026-08-06-task-lens-outcome-v1-attempt-1-wsl-canonical.md` §2 — WSL 与 Git Bash 在 symlink/fsync/validator regex 上的差异已实测登记。结论：successor 必须在两环境分别采集 acceptance evidence。
- **Verified-by**: 本 worktree HEAD `bun run typecheck` 实测 `EXIT=0`（无任何 TS2307 残留；BASELINE-TS-001 已清零）。
- **Verified-by**: `blueprints/blueprint-cross-platform-universality.md` §1.2 + §2.1 — 现有 `WORK_ONE_ROOT` + `QODERWORK_ROOT` 4 级优先级契约；successor 复用，不发明新锚点。
- **Verified-by**: `plans/task-lens-outcome-v1/ledger/event-002-run-recorded.json` — gen-1 ledger sequence=2 RUN_RECORDED，previous_event=event-001。结论：gen2 接入 v1 chain 必须新 CONTRACT_SUPERSEDED event，previous_event 指向 v1 event-002（hash-only reference）；不修改 v1 ledger。
- **Verified-by**: `scripts/lib/outcome-governance-v1.ts` validator schema（355 行已读）：
  - `validateOutcomeLedger` 第 338 行：sequence=1 必须 `previous_event === null` 且 `event_type === CONTRACT_APPROVED`；
  - 第 327 行：`CONTRACT_SUPERSEDED` 必须 `amendment_ref !== null`；
  - 第 280 行：generation>1 approval 必须 `amendment !== null`；
  - 第 152 行：generation>1 contract 必须 `supersedes !== null`；
  - 第 317 行：ledger 单 array 校验，不支持跨目录合并；
- **Verified-by**: `scripts/validate-outcome-governance.ts`：
  - 第 15 行 `mode: "structural"`、`validation_kind: "review-separated"`；**structural-only，不证真实执行**；
  - 第 22 行 `auxiliaryRunArtifact` 正则仅 forward-slash，不跨平台安全；
  - 第 207 行 `validateOutcomeDirectory(directory, repositoryRoot)` 单目录调用，**不支持跨目录 ledger continuation**；
  - 第 244 行 USAGE：`directory --repository-root repository` 共 2 个 flag-arg。
- **Verified-by**: `audits/task-lens-m1/LATEST.md` — predecessor PHASE-05 v2.1-required ACCEPT 仅是 **55 pass / 0 fail across 4 suites** 的 component-level 历史声明（test_id 不等于 outcome case_id；不构成 v1 outcome evidence）。v1 outcome evidence 只来自 `plans/task-lens-outcome-v1/runs/outcome-run-result.json`。55-pass 不可外推到 v1 4-case frozen scope。
- **UNVERIFIED（gen2 必须重跑）**: PHASE-05 metrics lock 多进程真实验证；PHASE-06 real-target before/after hash 比较；PHASE-07 10-task 真实 reviewer feedback。

**结论**：M1 完工作业 v2 的根因是"已冻结的解析契约 ≠ 已完成的产品实施"；解法是 successor 蓝图 + 4 phase 文件 + 通过 amendment 走 generation 2 outcome chain（contract gen=2、supersedes v1、CONTRACT_SUPERSEDED ledger event、RUN_RECORDED 指向 gen=2 run-result），不修改任何 frozen predecessor。

## 二、方案对比与裁决

### 2.1 候选方案

| 维度 | 方案A successor 蓝图 + 4 phase + gen2 amendment（选择） | 方案B 在 predecessor outcome-v1 内做 in-place edit | 方案C 完全新 outcome（不同 outcome_id） |
|---|---|---|---|
| 框架一致性 | 高（沿用 outcome-governance/v1 amendment 流程） | 低（v1 frozen immutable 禁止 in-place edit） | 中（与 outcome-governance/v1 validator 不对齐 — validator schema 通过同 `outcome_id` 跨 generation） |
| 旧文件冻结 | 完全保持不动 | 违反 v1 frozen | 完全保持不动 |
| 跨环境矩阵 | 蓝图与 plan 显式两套 | 受限于 amendment 行数与 ledger 完整性 | 与方案 A 同 |
| 实施复杂度 | 中（4 phase 文件 + 1 README + 1 blueprint + gen2 amendment + gen2 contract + gen2 ledger events） | 低（仅 amendment + ledger 增量；但违反冻结） | 高（需重建 outcome 目录骨架与新 outcome_id，与 validator 不对齐） |
| 风险 | amendment 字段错位（v3 校验严） | 违反 outcome-governance/v1 frozen 原则 | validator 不识别新 outcome_id 的 ledger continuation |

### 2.2 裁决

选择 **方案 A**：successor 蓝图 + 4 phase + gen2 amendment + gen2 contract/supersedes + CONTRACT_SUPERSEDED ledger event。本轮只写蓝图、plan、gen2 outcome chain 设计接口与交付清单；**不伪造**任何 gen2 approval/receipt/run PASS。

### 2.3 否决理由

- **方案 B**：violates outcome-governance/v1 frozen-immutable 原则（v1 contract immutable；amendment 用于澄清而非在原位编辑）。
- **方案 C**：`scripts/lib/outcome-governance-v1.ts` 第 333 行要求 ledger `outcome_id` 一致（同 outcome_id 跨 generation），新 outcome_id 不能与 v1 共享 chain；与 outcome-governance/v1 框架不兼容。

## 三、核心设计

### 3.1 generation 2 outcome chain 接入 v1（合法 continuation）

**事实证据**（已 Read `scripts/lib/outcome-governance-v1.ts` 全文）：
- v1 ledger event-001 sequence=1 `CONTRACT_APPROVED`、`previous_event: null`；
- v1 ledger event-002 sequence=2 `RUN_RECORDED`、`previous_event` 引用 event-001；
- gen2 接入必须在同一 `outcome_id: "TASK-LENS-OUTCOME-V1"` 下继续 chain，**不允许**新 outcome_id；
- gen2 ledger sequence=3 必须是 `CONTRACT_SUPERSEDED` event：
  - `event_type: "CONTRACT_SUPERSEDED"`（validator 第 327 行要求 `amendment_ref !== null`）；
  - `amendment_ref`: 引用 gen2 amendment 文件（gen2 amendment 必须存在）；
  - `previous_event`: hash-only 引用 v1 ledger event-002（`{id: "LEDGER-TASK-LENS-OUTCOME-V1-002", path: "plans/task-lens-outcome-v1/ledger/event-002-run-recorded.json", generation: 2, sha256: <v1 event-002 sha>}`）；
  - `approval_anchor`: 引用 gen2 approval（含 `amendment` 引用同 amendment 文件，generation=2）；
  - `contract_ref`: 引用 gen2 contract（`supersedes` 字段引用 v1 contract hash）；
- gen2 ledger sequence=4 可以是 `RUN_RECORDED`（指向 gen2 run-result）。

**validator 是否支持跨目录 ledger continuation**：**不支持**。`validateOutcomeDirectory(directory, repositoryRoot)`（`scripts/validate-outcome-governance.ts` 第 207 行）单目录调用，`validateOutcomeLedger` 第 317 行单 array 校验。

**计划**：gen2 outcome chain 全部文件置于 `plans/task-lens-outcome-v1/` 同目录下（gen2 文件与 v1 文件并存，单目录调用 validator）。gen1+gen2 ledger 通过 sequence 1..N 串接：

| sequence | event_type | contract_ref | amendment_ref | previous_event | 文件位置 |
|---|---|---|---|---|---|
| 1 | CONTRACT_APPROVED | v1 contract | null | null | `plans/task-lens-outcome-v1/ledger/event-001-contract-approved.json`（**不修改**） |
| 2 | RUN_RECORDED | v1 contract | null | event-001 | `plans/task-lens-outcome-v1/ledger/event-002-run-recorded.json`（**不修改**） |
| 3 | CONTRACT_SUPERSEDED | gen2 contract | gen2 amendment | event-002（hash-only ref） | `plans/task-lens-outcome-v1/ledger/event-003-v2-contract-superseded.json`（**新建**） |
| 4 | RUN_RECORDED | gen2 contract | null | event-003 | `plans/task-lens-outcome-v1/ledger/event-004-v2-run-recorded.json`（**新建**） |

**Raw-reference vs 复制**：gen2 ledger event-003 的 `previous_event` 字段是 **hash-only reference**（即 `{id, path, generation, sha256}` 四个字段的纯 hash 引用），**不复制 v1 ledger 内容**，**不修改 v1 ledger 文件**。validator 第 188-190 行 `LEDGER_PREDECESSOR_RAW_REFERENCE_INVALID` 通过 `index.values()` 查找 predecessor 实体：`index` 来自 `jsonFiles(root)` 对 outcome 目录的递归 `.json` 扫描（validator 第 214 行）；第 188 行在 `index.values()` 中按前一 sequence 的 `event_id` + `sequence` 匹配 predecessor ledger event，第 190 行将 `previous_event` 的 4 字段 reference 与该 predecessor 比对，**若 predecessor event 不在本次扫描目录内（`actualPrevious` 为 null），该检查直接失败**。因此 predecessor event 必须与 gen2 ledger 同目录共存且被 validator 同一次调用读到。**gen2 文件必须与 v1 frozen 文件并存于 `plans/task-lens-outcome-v1/`**，validator 单目录调用合并校验（v1 frozen 文件保持不动），**不能跨目录单独校验 gen2 ledger**。

**禁止**：
- 改 v1 ledger event-001/event-002 内容；
- 把 v1 ledger 文件 `git mv` 到 `plans/task-lens-outcome-v2/`；
- 把 v1 ledger 文件"raw-reference" 复制进 `plans/task-lens-outcome-v2/`（validator 在多目录下不能合并校验；这违反 outcome-governance/v1 框架）。

**目录选择**：gen2 outcome 目录**沿用** `plans/task-lens-outcome-v1/`（不新建 `plans/task-lens-outcome-v2/`）；因为：
- outcome-governance/v1 validator 不支持跨目录 ledger continuation；
- v1 frozen immutable；gen2 文件与 v1 文件并存同目录，validator 单目录调用可校验全部 sequence；
- hash-only reference 是 v1 → v2 chain 的合法延伸。

### 3.2 双环境矩阵（强制两套独立 evidence，但不伪造 outcome）

| 维度 | WSL Ubuntu-24.04 native FS（POSIX） | Windows Git Bash（MINGW64_NT） |
|---|---|---|
| 执行体 | `<WORKTREE>` POSIX 路径 | `<WORKTREE>` Win32 路径；Git Bash 看到 POSIX-like mount（MSYS） |
| bun | `bun 1.3.14` 同一二进制 | 同（PATH 命中 Git Bash 默认 bun） |
| bun:test 子进程 | 真实 fork+exec，可观测 PID 与 owner.json | Win32 CreateProcess，PID 跨域探测受限 |
| mkdir lock | `mkdir` 原子创建；`fsync` 通常成功 | Win32 directory handle；语义与 POSIX 不等价 |
| symlink (`TL-C-103`) | ✅ 创建成功 | ❌ `EPERM: operation not permitted, symlink`（已实测） |
| `fsync` (`TL-ATOMIC`) | ✅ 通常成功 | ❌ 部分失败 `EPERM`（已实测） |
| SQLite readonly path | POSIX path-replace 工作 | 反斜杠路径倍增（已实测） |
| Validator `runs/receipt/...` regex | ✅ forward-slash 路径匹配 | ❌ backslash 路径 regex 不命中（已实测） |
| outcome-run-result verdict | gen-1 PASS / gen-2 PENDING | 同 contract 上不同 verifier 实例（validator regex 失败）；不可外推到 PASS |
| Real-target out root | `${HOME}/.local/state/qoderwork/task-lens/m1-validation/PHASE-06` | `%LOCALAPPDATA%\qoderwork\task-lens\m1-validation\PHASE-06` |
| Git Bash mkdir 路径契约 | n/a | `mkdir -p "$LOCALAPPDATA/qoderwork/task-lens/..."` 或 `mkdir -p "$(cygpath -u "$LOCALAPPDATA")/qoderwork/task-lens/..."`；**禁止 PowerShell 命令**（PowerShell 不是 Git Bash 兼容 shell） |

**强制约束**：
- 两环境各自独立采集 evidence root；不得把 WSL 的 receipts/runs 复制到 Git Bash 路径下作为"Git Bash PASS"。
- 两环境的 acceptance summary 各出独立 verdict，禁止合并 verdict（参见 §3.5）。
- 两环境的 outcome-governance validator 运行（如果走 outcome-run 路径）必须使用各环境的 native FS 路径，不通过 WSL↔Windows 互译层。

### 3.3 gen2 outcome chain 设计接口（本轮不创建文件）

gen2 文件（本轮 plan 不创建；由 v2 实施阶段创建并落盘到 `plans/task-lens-outcome-v1/` 同目录）：

- `plans/task-lens-outcome-v1/outcome-contract-v2.json`（**新文件名约定**：v2 contract 与 v1 contract 同目录共存；v1 contract `outcome-contract.json` 不修改）：
  - `schema_version: "outcome-governance/v1"`、`document_kind: "outcome-contract"`；
  - `outcome_id: "TASK-LENS-OUTCOME-V1"`、`generation: 2`（validator 第 333 行要求同 outcome_id）；
  - `contract_id: "TASK-LENS-OUTCOME-CONTRACT-V2"`（v2 自己的 ID，与 v1 contract `TASK-LENS-OUTCOME-CONTRACT-V1` 不同）；
  - `supersedes: { id: "TASK-LENS-OUTCOME-CONTRACT-V1", path: "outcome-contract.json", generation: 1, sha256: "8009501276e739b9a7cd309af3d5d653a74b67ca2f5934f27cdab70fdb7f0db9" }`（validator 第 152 行 generation>1 必须 supersedes）；
  - `target[0].id: "task-lens-m1-completion"`，范围 = PHASE-05 metrics/feedback + PHASE-06 双目标集成 + PHASE-07 10 任务验收；evidence ceiling = `integration + manual verification`；
  - `boundary.in_scope` 与 `boundary.out_of_scope` 通过 amendment 显式登记（参见 §3.4 模糊点澄清）；
  - `acceptance_strategy.boundary`: `integration + manual verification`；不冒充 component-only。
- `plans/task-lens-outcome-v1/acceptance-spec-v2.json`：
  - `spec_id: "TASK-LENS-ACCEPTANCE-SPEC-V2"`、`generation: 2`；
  - `requirements[]`: REQ-011v2 / REQ-012v2 / REQ-013v2 / REQ-014v2 / REQ-CROSS-ENV；
  - `oracles[]`: O-002（双环境 integration + manual verification）；
  - `cases[]`: 每个 REQ 各有 WSL 与 Git Bash 两个 case（共 ≥10 个 case；每个 case_id 唯一，test_id 唯一）；
- `plans/task-lens-outcome-v1/outcome-test-bundle-v2.json`：
  - `bundle_id: "TASK-LENS-TEST-BUNDLE-V2"`、`generation: 2`；
  - `tests[]`: `scripts/task-lens/__tests__/metrics.test.ts`、`cli-integration.test.ts`、`integration.test.ts`、`closure.test.ts` 的 SHA-256 绑定，**SHA 在文件实际写入与冻结之后才能采集**；本轮不预先填 SHA；
  - 同时冻结双端 runner/oracle 元数据（环境、bun 版本、validator 调用参数）；
  - `runner_config[]` + `lockfiles[]`: 同步绑定。
- `plans/task-lens-outcome-v1/outcome-amendment-v2.json`（**新建**）：
  - `amendment_id: "TASK-LENS-AMENDMENT-V2"`、`generation: 2`；
  - `from_contract`: 引用 v1 contract；
  - `to_contract`: 引用 gen2 contract；
  - `reason`: 解释从 v1 component-only → gen2 integration + manual verification 的范围扩张；
  - `affected_case_ids`: gen2 新增的 case_id 列表；
  - `unaffected_case_ids`: v1 4 个 case_id（T-001..T-004）；
  - `change_class: "NORMAL"`（默认 gen2 是范围扩张，非弱化）；
  - `prior_failures`: 空数组（v1 4-case PASS 无失败历史）；
  - `frozen_diff`: 由 validator 函数 `expectedFrozenDiff(from, to)` 计算（合同/规范/bundle/source 三层 SHA 比对）；
- `plans/task-lens-outcome-v1/outcome-approval-v2.json`：
  - `approval_id: "TASK-LENS-APPROVAL-V2-GEN2"`、`generation: 2`；
  - `contract` / `acceptance_spec` / `test_bundle`: 引用 gen2 同代三件；
  - `amendment`: 引用同 `outcome-amendment-v2.json`（validator 第 280 行 generation>1 approval 必须 amendment）；
  - `approval.approved_by: "ChoGeer"`、`principal_id: "HUMAN:ChoGeer"`、`trust_domain: "human-primary"`；
  - `weakening_approval: null`（默认 NORMAL change_class）；
- `plans/task-lens-outcome-v1/ledger/event-003-v2-contract-superseded.json`：
  - `event_type: "CONTRACT_SUPERSEDED"`；
  - `contract_ref`: 引用 gen2 contract；
  - `amendment_ref`: 引用 gen2 amendment；
  - `approval_anchor`: 引用 gen2 approval；
  - `previous_event`: hash-only 引用 v1 event-002；
- `plans/task-lens-outcome-v1/ledger/event-004-v2-run-recorded.json`：
  - `event_type: "RUN_RECORDED"`；
  - `contract_ref`: 引用 gen2 contract（与 v1 不同，必须是 gen2）；
  - `previous_event`: hash-only 引用 event-003；
  - `run_ref`: 引用 gen2 run-result；
- `plans/task-lens-outcome-v1/runs/outcome-run-result-v2.json`：
  - `outcome_contract`: 引用 gen2 contract；
  - `case_results[]`: 包含 WSL 与 Git Bash 两个 case 子集（每个 case 一个 entry）；
  - `verdict`: PASS/FAIL/BLOCKED/INVALID/NOT_RUN；**整体 verdict 必须每个 REQ 的两端 case 都 PASS 才 PASS**。

**禁止**：新建 `plans/task-lens-outcome-v2/` 目录；新建 `outcome-run-result.gitbash.json` 自创模型（参见 §3.5）；复制 v1 ledger 文件内容到 gen2 ledger；任何"已通过"措辞。

### 3.4 outcome-contract in_scope metrics vs PHASE-05 out_of_scope 模糊点澄清

v1 contract `in_scope[5]` 字面含 `"artifact/metrics: canonical sort + temp+rename 拒绝覆盖、metrics lock+append+fsync 且绑定 taskId"`。这与 v1 contract `out_of_scope` 列表中"PHASE-05 metrics/feedback（REQ-011/012，状态分裂未裁决，不冻结）"存在字面歧义：

| v1 contract 字段 | 字面含义 |
|---|---|
| `in_scope[5]` | metrics **写入契约**（canonical sort / temp+rename / lock+append+fsync / 绑定 taskId）：已 frozen |
| `out_of_scope[2]` | PHASE-05 metrics/feedback **实施收尾**（REQ-011/012 业务验收）：未 frozen |

**gen2 amendment 必须显式消除此歧义**：在 `reason` 字段与 `affected_requirement_ids` 字段中区分：
- "metrics write contract" = in-scope frozen (inherited from v1, unchanged)；
- "metrics feedback acceptance (PHASE-05 v2 / REQ-011v2/012v2)" = gen2 in_scope, amendment-expansion。

gen2 contract `in_scope` 必须显式列出 REQ-011v2/012v2/013v2/014v2 与 REQ-CROSS-ENV 共 5 项；`out_of_scope` 必须显式列出 M1.5/M2/M3、`audits/task-lens-m1/**` 历史路径、live-LLM-E2E。

### 3.5 双环境验收建模（修正 B5/B6）

**禁止**：
- 新建 `runs/outcome-run-result.gitbash.json` 自创模型（不在 outcome-governance/v1 schema 中）；
- 把 WSL 与 Git Bash 的 verdict 写在两个独立 run-result 中（validator schema 不识别）。

**要求**：
- 每个 REQ 必须有 **两个固定 case**（WSL case + Git Bash case），每个 case 独立 `case_id` + `test_id` + `command` + `level` + `expected: "PASS"`；
- 所有 case 汇总到 **同一个 canonical `outcome-run-result-v2.json`**（gen2 run-result）；
- 每个 case 有独立 receipt（`runs/receipt/case-{WSL-id}.json` 与 `runs/receipt/case-{GitBash-id}.json`）；
- bundle 同时冻结双端 runner/oracle 元数据（含 `environment: "WSL Ubuntu-24.04"` 与 `environment: "Windows Git Bash"`）；
- run-result 的 `verdict` 由 validator `deriveRunVerdict` 计算（`scripts/validate-outcome-governance.ts` 第 72 行）：validator 优先返回 INVALID / BLOCKED / NOT_RUN（第 73-75 行），仅当以上均不命中时才走 FAIL/PASS 路径；所有 case.execution_status 必须等于 spec.cases[].expected；任一 case FAIL = 整体 verdict FAIL；
- **两端都 PASS 才整体 PASS**（gen2 contract `acceptance` 字段必须显式声明此规则）。

### 3.6 范围边界（successor 与 frozen predecessor 的分界）

| 类别 | frozen predecessor（本轮不动） | gen2 successor（本轮设计） |
|---|---|---|
| 蓝图 | `blueprint-task-lens-m1.md`（已退役）、`blueprint-task-lens-outcome-v1.md`（已完成） | `blueprint-task-lens-m1-completion-v2.md`（本文件，**草稿/待审批**） |
| outcome contract | `plans/task-lens-outcome-v1/outcome-contract.json`（frozen gen=1） | `plans/task-lens-outcome-v1/outcome-contract-v2.json`（**同目录**新建，gen=2，supersedes v1） |
| outcome spec/bundle/amendment/approval | v1 各 1 个 frozen | gen2 各 1 个新建 |
| outcome ledger | v1 event-001/002 frozen | gen2 event-003/004 新建 |
| outcome run-result | v1 `runs/outcome-run-result.json` frozen | gen2 `runs/outcome-run-result-v2.json` 新建 |
| 索引 | `blueprints/INDEX.md`、`documents/INDEX.md` | 不动；本轮报告 blocker |
| 历史 audits | `audits/task-lens-m1/**` | **不动**；v2 phase 实施阶段禁止作为 evidence root 引用 / 不得写入 legacy `audits/**`；gen2 evidence 全部在 `plans/task-lens-outcome-v1/` 内（参见 §3.1） |

### 3.7 gen2 plan 与 v1 outcome / plans/task-lens-m1/ 的 precedence

1. v2 plan 中所有"必须保留"的 frozen 前置 = `plans/task-lens-m1/{01,02,03,04}-phase-*.md` 与 `plans/task-lens-outcome-v1/` 中所有 v1 frozen 文件；禁止修改。
2. v2 plan 的 phase 05/06/07 文件**不是** `plans/task-lens-m1/05/06/07-phase-*.md` 的修改或替代品；它们是 successor 路径下的新文件（`plans/task-lens-m1-completion-v2/05/06/07-phase-*.md`），与旧 phase 文件并存。
3. v2 plan 的实施步骤如果发现必须修改旧 frozen 文件才能继续，必须停止并写"BLOCKED — frozen conflict"到 phase 文件末尾，禁止 in-place edit。

### 3.8 通用性不变量（沿用 predecessor §G1-G5，不发明新约束）

| # | 不变量 | gen2 沿用说明 |
|---|--------|---------------|
| G1 | 只读语言级产物 | gen2 PHASE-06 real-target 仍只读 Git/CodeGraph/覆盖率；fixture 内允许创建文件用于测试 |
| G2 | 目标项目零侵入 | gen2 PHASE-06 `--out` 必须 realpath 严格在两个真实目标之外（独立 state root） |
| G3 | StructureProvider 接口隔离 | gen2 PHASE-06 双目标必须 DB capability probe PASS；CLI fallback 仅 fixture 允许 |
| G4 | 项目差异收敛到显式配置 | gen2 复用 `scripts/task-lens/presets/work-one.yaml`；不允许新增 target preset |
| G5 | 输入与收据契约版本化 | gen2 在 v1 frozen contract 基础上通过 amendment 扩展 |

## 四、12 子系统合规审计

| # | 子系统 | gen2 successor 义务 | 禁止 |
|---|---|---|---|
| 1 | 文件契约 | 新建 7 个文件按 plan-index allowed-files 清单逐文件写入；每文件 `test -s` + `wc -l` + 内容断言 | 越界修改 frozen predecessor；创建未在清单内的辅助文件 |
| 2 | 命令契约 | plan 内固定 verification 命令必须先 `test -f` 验证路径可执行；非现有文件命令标 `[POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT]`（参见 §6） | 在命令不存在时声称"已 PASS" |
| 3 | 路径契约 | 真实目标 out 路径使用 anchor 变量（`${TL_OUT_WSL}` / `${TL_OUT_GITBASH}`），不写死 `/home/zhaoge` 或 `C:\Users\USER\...`；Git Bash 用 `mkdir -p "$LOCALAPPDATA/..."` 或 cygpath 转换；**禁止 PowerShell** | 硬编码 `/home/zhaoge` 进 plan 正文；写 PowerShell 命令 |
| 4 | 状态契约 | phase 文件 Progression status 初值 `NOT_STARTED`；gate checkbox 初值 `[ ]`；旧 predecessor phase 文件不动 | 篡改 predecessor phase 文件状态 |
| 5 | 实施清单 | plan 文件 §"Allowed files" + §"Implementation steps" 列出精确符号/锚点；不假装已存在 | 列出"已实现"文件符号但实际不存在 |
| 6 | 负例矩阵 | 每个 check 配 single-failure mutation；fail-closed 路径明确 | 只列 happy path |
| 7 | 跨环境矩阵 | WSL native FS 与 Windows Git Bash 各列独立命令、路径、exit code | 两环境命令混用 |
| 8 | 证据保留 | evidence root 两环境独立；禁止覆盖；禁止把 WSL evidence 复制到 Git Bash 路径下 | 跨环境 evidence 复制 |
| 9 | outcome-governance/v1 | gen2 chain 通过同 outcome_id amendment 接入 v1；不修改 v1 文件；gen2 文件与 v1 文件并存于 `plans/task-lens-outcome-v1/` | 改 v1 文件；新建 `outcome-run-result.gitbash.json` 自创模型；新建 `plans/task-lens-outcome-v2/` 目录 |
| 10 | typecheck | 当前 HEAD 实测 `bun run typecheck` exit 0；**v2 不允许 typecheck exit≠0**（修正 B2 与 predecessor `typecheck_exit=1` 容忍） | 容忍 TS 残留；删除 typecheck=0 硬约束 |
| 11 | rollback 语义 | v2 rollback 只回滚 v2 allowed files；保留 v1 evidence 与 v2 partial evidence | hard reset、删 evidence、删 acceptance root |
| 12 | Self-Check Gate | 每文件写入后 test -s/wc -l/head 断言；失败停止并报告 | 跳过写入完整性闸门 |

## 五、实施清单

### 5.1 本轮允许新建的文件（精确清单）

| # | 路径 | 类别 | 行数预算 |
|---|---|---|---|
| 1 | `blueprints/blueprint-task-lens-m1-completion-v2.md` | 蓝图（successor） | 350-450 |
| 2 | `plans/task-lens-m1-completion-v2/00-plan-index.md` | 计划索引 | 280-330 |
| 3 | `plans/task-lens-m1-completion-v2/05-phase-metrics-feedback.md` | successor phase 05 | 200-280 |
| 4 | `plans/task-lens-m1-completion-v2/06-phase-integration-zero-write.md` | successor phase 06 | 240-320 |
| 5 | `plans/task-lens-m1-completion-v2/07-phase-acceptance-closure.md` | successor phase 07 | 220-300 |
| 6 | `plans/task-lens-m1-completion-v2/99-final-verification.md` | 最终验证 | 120-180 |
| 7 | `plans/task-lens-m1-completion-v2/README.md` | 说明（产品实施 plan，非 gen2 receipts） | 60-100 |

### 5.2 禁止修改的文件

- `blueprints/INDEX.md`（v2 INDEX 同步是 blocker，非本轮）
- `documents/INDEX.md`（同上）
- `blueprints/blueprint-task-lens-m1.md`（已退役，frozen）
- `blueprints/blueprint-task-lens-outcome-v1.md`（已完成，frozen）
- `plans/task-lens-m1/**`（PHASE-01~04 ACCEPTED 文件本体；PHASE-05/06/07 frozen-NOT_STARTED 文件本体）
- `plans/task-lens-outcome-v1/**`（v1 全部 frozen）
- `audits/**`（历史 evidence 冻结；v2 phase 实施阶段禁止作为 evidence root 引用 / 不得写入 legacy `audits/**`；仅允许 historical input Read frozen LATEST.md — DEC-V2-010）
- `scripts/task-lens/**`、`scripts/lib/workspace-paths.ts`、`package.json`、`bun.lock`（v2 plan 不假定已有 v2 代码；实施阶段在独立 phase session 落盘）

### 5.3 INDEX 同步的 blocker 声明

本轮**不修改** `blueprints/INDEX.md` 与 `documents/INDEX.md`。理由：
- INDEX 同步依赖 blueprints-governance PHASE-01~05 流程（修改 index 需 plan+audit+INDEX.md 三向同步）；
- v2 蓝图当前状态为 **草稿/待审批**，未经 human-approved 之前不应登记到活跃段；
- 若 v2 进入实施阶段，索引同步将由独立 session 处理，本轮仅在最终 Self-Check 中报告 "BLOCKED — INDEX sync deferred until v2 contract APPROVED"。

## 六、验证计划（分层）

### 6.1 写入完整性闸门（每文件落地立即执行）

```bash
test -s <file> && wc -l <file> && head -n 5 <file> | rg -q '<expected heading>' && rg -q '<expected keyword>'
```

任一失败立即停止并报告。

### 6.2 命令可执行性预检（每 fixed verification 命令）

**新增 H1/H3 强制要求**：每个 `bun run <script>` / `bun test <file>` 命令前必须 `test -f <path>`；命令指向当前 worktree **不存在**的文件时，必须标 `[POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT]` 并加 preflight gate：

```bash
# preflight: confirm path exists before claiming current run
for f in scripts/task-lens/__tests__/metrics.test.ts \
         scripts/task-lens/__tests__/cli-integration.test.ts \
         scripts/task-lens/__tests__/integration.test.ts \
         scripts/task-lens/__tests__/closure.test.ts \
         plans/task-lens-outcome-v1/outcome-contract-v2.json \
         plans/task-lens-outcome-v1/acceptance-spec-v2.json \
         plans/task-lens-outcome-v1/outcome-test-bundle-v2.json \
         plans/task-lens-outcome-v1/outcome-amendment-v2.json \
         plans/task-lens-outcome-v1/outcome-approval-v2.json \
         plans/task-lens-outcome-v1/ledger/event-003-v2-contract-superseded.json \
         plans/task-lens-outcome-v1/ledger/event-004-v2-run-recorded.json \
         plans/task-lens-outcome-v1/runs/outcome-run-result-v2.json ; do
  test -f "$f" || { echo "BLOCKED: $f missing; command is [POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT]"; exit 1; }
done
# v2 phase scope-lock evidence 路径由 v2 实施阶段独立 session 决定，本轮不预定
```

`validate-plan.ts` argv 契约已验证（`scripts/validate-plan.ts` 第 16-17 行 `process.argv[2] = planDirectory`、`process.argv[3] = governanceRoot`；USAGE 错误 = exit 2）；调用形式：

```bash
# 必须 test -f preflight（已实测 .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts 存在）
test -f .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts
bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts plans/task-lens-m1-completion-v2 "$(pwd)"
```

**禁止**：使用 `bun run .agents/skills/plan-audit-archiver/scripts/validate-audit.ts`（H4）；使用 `validate-audit.ts` 任何变体；任何 P-01..P-07 audit governance v2.1 模板引用（v2 不沿用 v2.1 框架；改用 outcome-governance/v1 + validate-outcome-governance.ts）。

### 6.3 validate-outcome-governance.ts 调用契约（gen2 实施阶段）

```bash
# preflight
test -f scripts/validate-outcome-governance.ts
test -d plans/task-lens-outcome-v1
test -f plans/task-lens-outcome-v1/ledger/event-001-contract-approved.json  # v1 frozen
test -f plans/task-lens-outcome-v1/ledger/event-002-run-recorded.json      # v1 frozen
test -f plans/task-lens-outcome-v1/ledger/event-003-v2-contract-superseded.json  # [POST-IMPLEMENTATION]
test -f plans/task-lens-outcome-v1/ledger/event-004-v2-run-recorded.json          # [POST-IMPLEMENTATION]
# invoke
bun run scripts/validate-outcome-governance.ts plans/task-lens-outcome-v1 --repository-root "$(pwd)"
```

`validate-outcome-governance.ts` USAGE（`scripts/validate-outcome-governance.ts` 第 244 行）：`directory --repository-root repository`，3 个 process.argv 项（index 2/3/4）。

### 6.4 Self-Check Gate（全部 7 文件落地后）

- `test -s` 每个文件存在；
- `wc -l` 每个文件行数在预算范围；
- `head` 标题匹配 blueprint-creation 模板（问题/根因/实测验证 + 12 子系统合规审计 + 实施清单 + 分层验证 + 风险/回滚 + 成功标准）；
- `rg` 关键承诺词（"草稿"、"待审批"、"未实施"、"NOT_STARTED"、"BLOCKED"、"frozen predecessor 不动"、"两环境独立"）；
- `git diff --stat` 仅显示本轮 7 个新文件；
- 任何对旧文件的 `git diff` 命中 = blocker；
- `bun run typecheck` exit 0；
- 所有 `bun run <script>` 路径 `test -f` 通过。

### 6.5 Post-Execution Audit

- 本轮输出：文件清单、每文件完整性证据、git diff --stat、Self-Check Gate 结果、Post-Execution Audit 摘要；
- 不做最终 Accept；不签 blueprint 状态为"已完成"。

### 6.6 gen2 phase 实施后（不属于本轮；列在 99-final-verification）

以下结果均为 v2 实施阶段目标，本轮 plan 撰写阶段 NOT-RUN。

- PHASE-05-v2 实施后：双端 `bun test` 5/5 PASS；
- PHASE-06-v2 实施后：双端 `TASK_LENS_REAL_TARGETS=1 bun test integration.test.ts` PASS；
- PHASE-07-v2 实施后：双端各 10-task summary PASS；双端 `bun run validate-outcome-governance.ts plans/task-lens-outcome-v1 --repository-root "$(pwd)"` exit 0。

## 七、风险、回滚与成功标准

### 7.1 风险

| 风险 | 触发 | 检测 | 缓解 |
|---|---|---|---|
| 误改 frozen predecessor | git diff 命中 frozen 文件 | `git diff --stat` 与 allowed-files 比对 | 立即停止；revert 该文件；报告 blocker |
| INDEX 同步遗漏 | v2 蓝图通过审批后 INDEX 未登记 | `blueprints/INDEX.md` 不含 v2 条目 | 报告 blocker，由独立 session 补 INDEX 同步 |
| 跨环境证据外推 | 一端 evidence 被他端引用作为 PASS | evidence root path 比对 | 立即停止；删引用；重新采集 |
| v1 chain 篡改 | gen2 ledger event 覆盖 v1 ledger event | ledger SHA 比对 | 立即停止；恢复 v1 ledger；新建 gen2 chain from event-003 |
| 双环境命令不可移植 | plan 命令在另一端 exit 非预期 | 双环境 dry-run | 标注 `WSL only` 或 `Git Bash only`；不外推 |
| typecheck 引入 TS 残留 | v2 phase 修改 `_b1_live.ts` 或新增 TS 文件含错误 | git diff + `bun run typecheck` exit≠0 | 立即停止；由所有者独立处理；**禁止容忍 exit≠0** |
| 双端任一 FAIL | 双端验收 summary 任一端 verdict ≠ PASS | run-result.case_results | 整体 verdict FAIL；保留双端 evidence；不删除 fail 端 case |
| 自创 outcome-run-result.gitbash.json | 实施阶段误建 | validator structural check | validator 拒绝；立即停止；删除自创文件 |

### 7.2 回滚策略

1. **本轮回滚**：删除本轮新建的 7 个文件；`git diff --stat` 归零；旧 frozen 文件 SHA 不变。
2. **v2 实施阶段回滚**（非本轮）：仅回滚 v2 allowed-files 清单内的文件；保留 v1 evidence + v2 partial evidence。
3. **gen2 outcome 启动回滚**：删除 gen2 草稿 contract-v2/spec-v2/bundle-v2/amendment-v2/approval-v2/ledger/event-003/004/runs/outcome-run-result-v2；不修改 v1 文件；不修改 v1 ledger。
4. **禁止**：hard reset 删除 v2 全部；删除 acceptance root；删除 v1 evidence；把 v1 ledger 文件复制到 gen2 目录。

### 7.3 成功标准

- [ ] 本轮 7 个新文件全部存在且通过 `test -s` + `wc -l` + `head` + `rg` 内容断言；
- [ ] `git diff --stat` 仅命中 7 个新文件，无 frozen predecessor；
- [ ] Self-Check Gate 与 Post-Execution Audit 全部 PASS；
- [ ] 蓝图状态保持"草稿/待审批"，不标"已完成"；
- [ ] INDEX 同步 blocker 显式记录；
- [ ] 双环境矩阵在 plan 文件中显式列出，且每环境命令/路径/exit code 独立；
- [ ] gen2 outcome 设计接口与交付清单列全（contract/supersedes/amendment/approval/ledger event-003/004/runs/run-result），本轮不伪造任何 approval/receipt/run PASS；
- [ ] 双环境验收模型：每个 REQ 两个固定 case（WSL + Git Bash），汇总到单一 canonical run-result；
- [ ] `bun run typecheck` exit 0；
- [ ] 所有 `bun run <script>` / `bun test <file>` 命令路径 `test -f` preflight 通过，或标 `[POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT]`；
- [ ] 55-pass predecessor 历史 claim 与 v1 4-case frozen outcome scope 明确区分；
- [ ] predecessor 状态分裂（plan-index NOT_STARTED vs LATEST ACCEPTED vs handoff BLOCKED）不再裁决，仅作为历史输入；successor 以当前树缺失 + v1 out_of_scope 为新工作起点。

## 八、相关文件

- **前驱 frozen（不动）**：
  - `blueprints/blueprint-task-lens-m1.md`
  - `blueprints/blueprint-task-lens-outcome-v1.md`
  - `plans/task-lens-m1/{00..99}-*.md`
  - `plans/task-lens-outcome-v1/{outcome-contract.json,acceptance-spec.json,outcome-test-bundle.json,outcome-approval.json,ledger/event-001-contract-approved.json,ledger/event-002-run-recorded.json,runs/outcome-run-result.json}`
  - `audits/task-lens-m1/**`
- **本轮新建**：
  - `blueprints/blueprint-task-lens-m1-completion-v2.md`（本文件）
  - `plans/task-lens-m1-completion-v2/00-plan-index.md`
  - `plans/task-lens-m1-completion-v2/05-phase-metrics-feedback.md`
  - `plans/task-lens-m1-completion-v2/06-phase-integration-zero-write.md`
  - `plans/task-lens-m1-completion-v2/07-phase-acceptance-closure.md`
  - `plans/task-lens-m1-completion-v2/99-final-verification.md`
  - `plans/task-lens-m1-completion-v2/README.md`
- **下一阶段待批/待建**（不在本轮范围；gen2 文件置于 `plans/task-lens-outcome-v1/` 同目录）：
  - `plans/task-lens-outcome-v1/outcome-contract-v2.json`（gen2 contract）
  - `plans/task-lens-outcome-v1/acceptance-spec-v2.json`
  - `plans/task-lens-outcome-v1/outcome-test-bundle-v2.json`
  - `plans/task-lens-outcome-v1/outcome-amendment-v2.json`
  - `plans/task-lens-outcome-v1/outcome-approval-v2.json`
  - `plans/task-lens-outcome-v1/ledger/event-003-v2-contract-superseded.json`
  - `plans/task-lens-outcome-v1/ledger/event-004-v2-run-recorded.json`
  - `plans/task-lens-outcome-v1/runs/{env,out,err,receipt}/`
  - `plans/task-lens-outcome-v1/runs/outcome-run-result-v2.json`
- **INDEX 同步（blocker，待 human approval）**：
  - `blueprints/INDEX.md`（v2 条目占位）
  - `documents/INDEX.md`（v2 plan 路由占位）

## 九、Self-Check Gate（草稿自检）

- [ ] 状态标为"草稿/待审批"，未标"已完成" ✓
- [ ] 12 子系统合规审计完整 ✓
- [ ] 双环境矩阵在核心设计中显式列出 ✓
- [ ] gen2 outcome 设计接口与交付清单列全且不伪造 ✓
- [ ] generation 2 通过 amendment 接入 v1（不新建 outcome_id；不修改 v1 frozen 文件） ✓
- [ ] 禁止修改清单明确 ✓
- [ ] 实施清单精确到 7 个文件 ✓
- [ ] 验证计划分层（写入闸门 / 命令可执行性预检 / validator 契约 / Self-Check / Post-Execution / 实施后） ✓
- [ ] 风险 + 回滚 + 成功标准三段齐 ✓
- [ ] 相关文件清单分 frozen/new/blocker 三类 ✓
- [ ] typecheck 实测 exit 0 已记录 ✓
- [ ] validate-plan.ts argv 契约已校验 ✓
- [ ] outcome-governance/v1 schema 已逐行验证 ✓
- [ ] 双环境验收建模：每 REQ 两 case，单一 canonical run-result，bundle 双端 runner 冻结 ✓
- [ ] 55-pass 历史与 v1 4-case frozen 明确区分 ✓
- [ ] predecessor 状态分裂仅作为历史输入 ✓
- [ ] outcome-contract in_scope metrics 与 PHASE-05 out_of_scope 模糊点由 gen2 amendment 显式消除 ✓
- [ ] `audits/**` 禁止作为 evidence root 引用 / 不得写入（v2 plan 不引用 legacy audits 作为 evidence root；仅允许 historical input Read frozen `audits/task-lens-m1/LATEST.md` 与 `audits/task-lens-outcome-v1/LATEST.md` — DEC-V2-010）✓
- [ ] 不可执行命令全部标 `[POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT]`+ preflight `test -f` ✓
- [ ] Git Bash mkdir 路径契约（`mkdir -p "$LOCALAPPDATA/..."` 或 cygpath 转换；禁 PowerShell）✓