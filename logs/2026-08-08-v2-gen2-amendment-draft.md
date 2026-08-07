# 2026-08-08 — v2 gen2 amendment 草案（TASK-LENS-AMENDMENT-V2）

> **状态：DRAFT（设计文档）**。最终文件 `plans/task-lens-outcome-v1/outcome-amendment-v2.json` 是 PHASE-07 输出，本轮**不创建**。所有 `[PENDING-...]` / `[PENDING-COMPUTED]` 为显式设计占位，非遗漏。

## 为什么 / 背景

- successor 蓝图 `blueprints/blueprint-task-lens-m1-completion-v2.md`（§3.1/§3.3/§3.4）批准 gen2 接入方案；`plans/task-lens-m1-completion-v2/00-plan-index.md` 为实施前置。
- gen2 通过 amendment 接入 v1 chain：与 v1 同 `outcome_id: "TASK-LENS-OUTCOME-V1"`，**不新建 outcome_id**、不新建 `plans/task-lens-outcome-v2/` 目录（validator 单目录调用 + 同 outcome_id 跨 generation 约束，lib L317/333）。
- **范围扩张**：v1 component-only（4 case，CASE-001..004）→ gen2 integration + manual verification（PHASE-05/06/07 产品实施 + Windows 修复）。
- **触发变更**（Windows Git Bash 5 失败方案，见 `logs/2026-08-08-windows-git-bash-5-test-failures-solutions.md`）：TL-PROBE/C-103 改 frozen 测试文件（触发 bundle SHA）；TL-ATOMIC/CONFLICT 改生产代码 `scripts/task-lens/artifact-writer.ts`（触发 `baseline_tree_sha256`）。

## Amendment 内容（按 lib schema 15 字段）

`validateOutcomeAmendment`（`scripts/lib/outcome-governance-v1.ts:239`）要求 **EXACTLY 15 键**（L243，不多不少），约束见 L244-268。

```json
{
  "schema_version": "outcome-governance/v1",
  "document_kind": "outcome-amendment",
  "amendment_id": "TASK-LENS-AMENDMENT-V2",
  "outcome_id": "TASK-LENS-OUTCOME-V1",
  "generation": 2,
  "from_contract": {
    "id": "TASK-LENS-OUTCOME-CONTRACT-V1",
    "path": "outcome-contract.json",
    "generation": 1,
    "sha256": "8009501276e739b9a7cd309af3d5d653a74b67ca2f5934f27cdab70fdb7f0db9"
  },
  "to_contract": {
    "id": "TASK-LENS-OUTCOME-CONTRACT-V2",
    "path": "outcome-contract-v2.json",
    "generation": 2,
    "sha256": "[PENDING — computed after outcome-contract-v2.json is created in PHASE-07]"
  },
  "reason": "[PENDING — PHASE-07 定稿：v1 component-only → gen2 integration+manual verification 范围扩张；metrics write contract 继承 v1 冻结（unchanged）；metrics feedback acceptance（REQ-011v2/012v2）为 amendment-expansion；Windows 修复（测试 + 生产代码）纳入 gen2 in_scope]",
  "affected_case_ids": [
    "TL-C-401-v2-WSL", "TL-C-401-v2-GITBASH",
    "TL-C-402-v2-WSL", "TL-C-402-v2-GITBASH",
    "TL-I-501-v2-WSL", "TL-I-501-v2-GITBASH",
    "TL-M-601-v2-WSL", "TL-M-601-v2-GITBASH",
    "TL-X-001"
  ],
  "unaffected_case_ids": ["CASE-001", "CASE-002", "CASE-003", "CASE-004"],
  "affected_requirement_ids": ["REQ-011v2", "REQ-012v2", "REQ-013v2", "REQ-014v2", "REQ-CROSS-ENV"],
  "unaffected_requirement_ids": ["REQ-001", "REQ-002", "REQ-003", "REQ-004"],
  "change_class": "NORMAL",
  "prior_failures": [],
  "frozen_diff": {
    "spec_changed": "[PENDING-COMPUTED]",
    "changed_case_ids": "[PENDING-COMPUTED]",
    "changed_requirement_ids": "[PENDING-COMPUTED]",
    "changed_oracle_ids": "[PENDING-COMPUTED]",
    "test_bundle_changed_fields": "[PENDING-COMPUTED]",
    "test_bundle_source_changes": "[PENDING-COMPUTED]"
  }
}
```

**id 集合约束（推导自 lib L260-266）**：`affected ∪ unaffected`（case / requirement 分别）必须**恰等于** to-spec（`acceptance-spec-v2.json`）的 `cases[].id` / `requirements[].id` 集合。因此 gen2 acceptance-spec 的 `cases[]` 必须同时包含 v1 继承 case（CASE-001..004，test_id T-001..004）与 v2 新增 case（9 个）；`requirements[]` 必须同时包含 REQ-001..004 与 REQ-011v2..014v2 + REQ-CROSS-ENV（共 9 个）。

## affected / unaffected id 对齐表

| 类别 | ids | 依据 |
|---|---|---|
| affected_requirement_ids | REQ-011v2、REQ-012v2、REQ-013v2、REQ-014v2、REQ-CROSS-ENV（5） | v2 `plans/task-lens-m1-completion-v2/00-plan-index.md` L93-97 |
| unaffected_requirement_ids | REQ-001、REQ-002、REQ-003、REQ-004 | v1 `plans/task-lens-outcome-v1/acceptance-spec.json` requirements[] |
| affected_case_ids | TL-C-401-v2-WSL/GITBASH、TL-C-402-v2-WSL/GITBASH、TL-I-501-v2-WSL/GITBASH、TL-M-601-v2-WSL/GITBASH、TL-X-001（9） | v2 00-plan-index L183-191；**最终须与 `acceptance-spec-v2.json` cases[].id 逐一相等** |
| unaffected_case_ids | CASE-001、CASE-002、CASE-003、CASE-004 | v1 acceptance-spec.json cases[]（`test_id` 为 T-001..T-004） |

## 模糊点澄清（蓝图 §3.4 强制）

v1 contract `in_scope[5]`（metrics 写入契约）与 `out_of_scope[2]`（PHASE-05 metrics/feedback）存在字面歧义 → gen2 amendment 在 `reason` + `affected_requirement_ids` 中区分：

- **"metrics write contract"** = in-scope frozen（继承 v1，unchanged）→ 对应 REQ-004（unaffected，保持 v1 冻结）。
- **"metrics feedback acceptance（PHASE-05 v2 / REQ-011v2/012v2）"** = gen2 in_scope，amendment-expansion → 对应 REQ-011v2/012v2（affected，新增）。

gen2 contract `in_scope` 必须显式列出 REQ-011v2/012v2/013v2/014v2 + REQ-CROSS-ENV 共 5 项；`out_of_scope` 显式列出 M1.5/M2/M3、`audits/task-lens-m1/**` 历史路径、live-LLM-E2E。

## frozen_diff 计算规则 + [PENDING-COMPUTED]

`expectedFrozenDiff(from, to)`（lib L199-220）在**验证时计算**（L258-259 `AMENDMENT_FROZEN_DIFF_INVALID` 比对），草案阶段无法手工正确生成（to.spec/to.bundle 未落盘）：

- `spec_changed` = `!sameReference(from.specRef, to.specRef)`（L213）；
- `changed_case_ids` / `changed_requirement_ids` / `changed_oracle_ids` = 左右 spec 同 id 条目 stable JSON 比较，取并集、去重、排序（L200-204）；
- `test_bundle_changed_fields` = `tests/fixtures/oracle_sources/runner_config/lockfiles/expected_test_ids/expected_test_count` 中 stable 值变化者（L210-211）；
- `test_bundle_source_changes` = 左右 bundle artifact 路径并集中 sha256 变化者（L205-209），含 `from_sha256`/`to_sha256`（单侧缺失为 null）；
- 校验（L263-266）：`affected_*` 必须 sameSet 对应 changed 列表；`unaffected_*` 不得出现在 changed 列表。

**计算输入**：`from.spec` = v1 `acceptance-spec.json`、`from.bundle` = v1 `outcome-test-bundle.json`、`to.spec` = `acceptance-spec-v2.json`、`to.bundle` = `outcome-test-bundle-v2.json`（后两者相对 `plans/task-lens-outcome-v1/`）。待 PHASE-07 创建 to 侧文件后由 validator 计算并回填。

## 变更内容：Windows 修复纳入（本次决策记录修正）

全部纳入 gen2（改测试文件触发 bundle SHA；改生产代码触发 `baseline_tree_sha256`）：

| 修复 | 文件/行 | 变更 | 触发 |
|---|---|---|---|
| TL-ATOMIC | `scripts/task-lens/artifact-writer.ts` L241 | `openSync(filePath, "r")` → `"r+"` | 生产代码 → baseline_tree_sha256 |
| TL-CONFLICT | 同上 L380/L394 | 目录 fsync 包 `try { fsyncSync } catch (EPERM) {}` 跳过 | 生产代码 → baseline_tree_sha256 |
| TL-PROBE | `scripts/task-lens/__tests__/provider-graph.test.ts` L81/L269 | `path.dirname(path.dirname(dbPath))` ×2 或 refactor fixture 传 root | 测试 → bundle SHA |
| TL-C-103 | `scripts/task-lens/__tests__/command-security.test.ts` L240 | symlink 加 `"junction"` 参数 | 测试 → bundle SHA |

## 待办（PHASE-07 落盘前）

1. 创建 `outcome-contract-v2.json`（to_contract ref 的 sha256 填；`supersedes` 引用 v1 contract `80095012...`）。
2. 创建 `acceptance-spec-v2.json`（cases[].id = affected ∪ unaffected = 13；requirements = 9；oracles = O-002）。
3. 创建 `outcome-test-bundle-v2.json`（SHA 在文件实际写入后采集，不预先填）。
4. 由 validator 计算 `frozen_diff` 回填（见上）。
5. 创建 `outcome-approval-v2.json`（`approved_by: ChoGeer`、`principal_id: HUMAN:ChoGeer`、`trust_domain: human-primary`，见 v2 00-plan-index §0.3）。
6. ledger `event-003-v2-contract-superseded.json` / `event-004-v2-run-recorded.json`（previous_event 为 hash-only 引用）。
7. 创建 `runs/outcome-run-result-v2.json`（双端 case；任一 FAIL = 整体 FAIL）。

> 以上均为 PHASE-07 输出，**本轮（草案轮）不创建任何 gen2 outcome 文件**。

## Verified-by

| 事实 | 证据 |
|---|---|
| lib 15 字段 schema | `scripts/lib/outcome-governance-v1.ts:243`（keys 数组，exact 校验 L109） |
| lib 约束（union 相等 / change_class / prior_failures / frozen_diff 计算比对） | L244-268 |
| frozen_diff 计算逻辑 | L199-220 `expectedFrozenDiff` |
| from_contract v1 ref（SHA `80095012...`） | `plans/task-lens-outcome-v1/acceptance-spec.json` L7-12 contract.sha256（v1 contract `supersedes` 为 null，gen-1 无前驱，非绑定来源） |
| v1 unaffected ids（REQ-001..004 / CASE-001..004） | v1 acceptance-spec.json requirements[] / cases[]（test_id T-001..004） |
| v2 affected ids | v2 00-plan-index L93-97（REQ-011v2..014v2 + REQ-CROSS-ENV）、L183-191（9 case ids） |
| baseline_tree_sha256 | v1 `outcome-contract.json` L39 = `297504377ecd64ce01a8779b14fd9f2d28a595ac` = commit c01ed72 的 tree |
| 当前树漂移 | HEAD tree `d9f25e14c3825f25a61fe96c91401be7ef7653b3`（commit 050a988），与 baseline 间隔 6 提交 |
| fsync 生产代码行号 | `scripts/task-lens/artifact-writer.ts` L241/380/394（`openSync(...,"r")` + 后续 fsyncSync） |
| 测试 fixture 行号 | provider-graph.test.ts L81/L269（`replace("/.codegraph/codegraph.db", "")`）；command-security.test.ts L240（`symlinkSync(project, link)`） |
