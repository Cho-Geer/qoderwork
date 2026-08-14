# Phase PHASE-07-v2: 10 任务业务验收、gen2 outcome chain 与状态关闭（双环境）

**Phase ID**: `PHASE-07-v2`
**Depends on**: PHASE-06-v2 ACCEPTED（双端）
**Outcome**: 双端各 10 个真实任务形成可信 feedback 数据；M1 v2 completion 按 metrics/test/typecheck=0（v2 严格）/双目标 evidence/gen2 outcome chain 准确关闭或保持未解锁；gen2 outcome chain 通过 amendment 接入 v1（不伪造 approval/receipt/run PASS）
**Evidence level**: integration + manual verification（双端各一份）
**Progression status**: `BLOCKED`（等 PHASE-06-v2 ACCEPTED 后由独立 session 派遣）

> 本 phase 不是 `plans/task-lens-m1/07-phase-acceptance-closure.md` 的修改或替代品。两份文件并存；predecessor 状态分裂不裁决（DEC-V2-009）；v2 显式新增双环境 + gen2 outcome chain 接入 + typecheck exit 0 硬约束。

## 1. Goal

- 实现 REQ-014v2：双端各 10 unique pairs + ≥7/10 双 yes + 全测试 + **双端 typecheck exit 0**（v2 严格）+ 双目标 receipts 全 PASS；
- gen2 outcome chain 设计：gen2 文件置于 `plans/task-lens-outcome-v1/` 同目录（与 v1 frozen 共存；validator 单目录调用）；本 phase 不创建 gen2 文件，只写 contract/spec/bundle/amendment/approval/ledger event-003+004/runs/run-result 设计接口与交付清单，禁伪造 approval/receipt/run PASS；
- 双 case per REQ 汇总到单一 canonical `outcome-run-result-v2.json`（禁 `outcome-run-result.gitbash.json` 自创模型）；双 case verdict 独立，任一 FAIL = 整体 FAIL。

## 2. Starting state and dependency

- Required status: PHASE-06-v2 双端 completion gate 全勾选 + 两 real-target receipts/manual reviews PASS（双端各两份）；
- Required evidence（v2 实施阶段采集）：双端 human-approved scope-lock 各一份（落盘到 gen2 evidence root — DEC-V2-010）；
- If absent: `BLOCKED`, do not continue。

## 3. 双环境 acceptance matrix

| 维度 | WSL Ubuntu-24.04 native FS | Windows Git Bash |
|---|---|---|
| Acceptance root | `${HOME}/.local/state/qoderwork/task-lens/m1-acceptance` | `%LOCALAPPDATA%\qoderwork\task-lens\m1-acceptance` |
| mkdir 路径契约 | `mkdir -p <anchor>` | `mkdir -p "$LOCALAPPDATA/qoderwork/task-lens/m1-acceptance"` 或 cygpath 转换；**禁止 PowerShell** |
| Metrics.jsonl | 双端各自独立 | 同 |
| Reviewer 凭证 | 双端各自 human review；不共用 reviewer | 同 |
| Sensitivity control | 复制 acceptance root 到新 temp out，只把一个 yes/yes feedback 改为 useful=false；summary 必须 PASS→FAIL | 同 |
| `bun run task-lens metrics summarize --out <root> --json` exit | 0=PASS / 2=INCOMPLETE / 1=FAIL / 21=UNAVAILABLE | 同 |
| typecheck exit | **0**（v2 严格；predecessor 容忍 exit=1 已删除 — DEC-V2-006） | **0**（v2 严格） |
| Validator | `bun run scripts/validate-outcome-governance.ts plans/task-lens-outcome-v1 --repository-root "$(pwd)"` exit 0 才可签署 gen2 ACCEPT | 同 |
| gen2 outcome chain | `plans/task-lens-outcome-v1/runs/outcome-run-result-v2.json` 汇总双 case | 同 |

## 4. Local requirements

| ID | Condition | Required behavior | Observable result | 双端 case |
|---|---|---|---|---|
| REQ-014v2-A | 真实任务计数 | 双端各 10 unique taskId/generated/feedback 一一对应 | missing/duplicate/invalid 均非 PASS | REQ-014v2-{WSL,GITBASH} |
| REQ-014v2-B | 效果阈值 | 双端各 ≥7 同时 useful=yes / loadReduced=yes | summary gate PASS；<7 为 FAIL | 同上 |
| REQ-014v2-C | 技术门 | 双端各 full task-lens tests + 双端 typecheck **exit 0**（v2 严格） | component/integration 无失败；typecheck 必须为 0 | 同上 |
| REQ-014v2-D | 通用性门 | PHASE-06-v2 两目标 current receipts 双端均保持有效 | tracked/nonTool write NOT_FOUND | 同上 |
| REQ-014v2-E | provenance | 双端各 verification 有 EV receipt；**`validate-outcome-governance.ts` 双端 exit 0**（structural-only，review-separated） | verdict 与 evidence ceiling 一致 | 同上 |
| REQ-014v2-F | 文档关闭 | blueprint/index/log 四处同一状态；不把 FAIL/BLOCKED 写 DONE | INDEX 同步是 blocker；本 phase 不解决 | n/a |
| REQ-014v2-G | gen2 outcome chain | 在 `plans/task-lens-outcome-v1/` 同目录创建 contract-v2/spec-v2/bundle-v2/amendment-v2/approval-v2/ledger event-003+004/runs/outcome-run-result-v2.json；ledger event-002 hash-only ref v1 event-002；不伪造 approval/receipt/run PASS | chain 文件落盘 + validator exit 0 | n/a |
| REQ-014v2-H | dual case per REQ | 两端 case 各自 verdict；任一 FAIL = 整体 FAIL | 单 canonical run-result 汇总 | cross-case |

### 4.1 typecheck 必须为 0 的新约束（v2 vs predecessor）

predecessor PHASE-07 接受 `typecheck_exit=1`（BASELINE-TS-001 残留）。v2 acceptance 要求 typecheck exit 0（DEC-V2-006）。当前 HEAD 实测 `bun run typecheck` EXIT=0，确认约束可达。

**若 typecheck exit ≠ 0**：v2 acceptance FAIL；outcome verdict 整体 FAIL；chain 不创建 event-004；report residual，不绕过。

## 5. Allowed files（本 phase 实施阶段；本轮 plan 仅声明不修改）

| Exact path | Change | Exact symbol/anchor | 双端 |
|---|---|---|---|
| `plans/task-lens-m1-completion-v2/07-phase-acceptance-closure.md` | add（本轮新建） | 本文件 | n/a |
| `plans/task-lens-m1-completion-v2/99-final-verification.md` | add | sibling final | n/a |
| `plans/task-lens-m1-completion-v2/README.md` | add | sibling README | n/a |
| `blueprints/blueprint-task-lens-m1-completion-v2.md`（已 draft） | modify | version/status/implementation evidence only | n/a |
| gen2 outcome files（future, v2 实施阶段） | add | 全部置于 `plans/task-lens-outcome-v1/` 同目录 | n/a |

### 5.1 Frozen caller tests（只读回归，可运行不可修改 — H4）

同 §5.1 of `05-phase-metrics-feedback.md`；PHASE-07 不新增 test file；仅汇总 PHASE-05/06 的 case_results。

### 5.2 v2 allowed modified tests（本 phase 无新增）

无新增；v2 实施阶段 PHASE-07 只汇总既有 case_results。

### 5.3 Globally forbidden changes

frozen predecessor 文件（05-v2 清单）；本 phase 禁止改 `package.json`/`scripts/task-lens/**`/`scripts/_b1_live.ts`/work-one/metrics 原始事件；伪造 reviewer feedback、复制 taskId、删负面 feedback、编辑 metrics 凑阈值；typecheck exit≠0 签 ACCEPT；component/integration 升 live-E2E；跨端 evidence 复制（WSL↔Git Bash）；v2 chain 篡改 v1 ledger event-001/002 SHA；引用 `validate-audit.ts` 任何变体与 P-01..P-07 v2.1 audit 模板（改用 `validate-outcome-governance.ts`）；evidence root 引用 / 写入 legacy `audits/**`（DEC-V2-010）。

## 6. Fixed contract

### 6.1 gen2 outcome chain 设计接口与交付清单（本 phase 不创建；只列契约）

- `plans/task-lens-outcome-v1/outcome-contract-v2.json`（**新文件名约定**：与 v1 contract 同目录共存；v1 contract `outcome-contract.json` 不修改）：
  - `schema_version: "outcome-governance/v1"`、`document_kind: "outcome-contract"`、`generation: 2`；
  - `outcome_id: "TASK-LENS-OUTCOME-V1"`、`generation: 2`（validator 第 333 行要求同 outcome_id 跨 generation）；
  - `contract_id: "TASK-LENS-OUTCOME-CONTRACT-V2"`（v2 自己的 ID，与 v1 contract `TASK-LENS-OUTCOME-CONTRACT-V1` 不同）；
  - `supersedes: { id: "TASK-LENS-OUTCOME-CONTRACT-V1", path: "outcome-contract.json", generation: 1, sha256: "8009501276e739b9a7cd309af3d5d653a74b67ca2f5934f27cdab70fdb7f0db9" }`（validator 第 152 行 generation>1 必须 supersedes）；
  - `target[0].id: "task-lens-m1-completion"`；
  - `target[0].evidence_ceiling: "integration + manual verification"`；
  - `boundary.out_of_scope`: 复用 v1 out_of_scope + `Windows/其他 OS 实机行为（Git Bash 与 WSL 各采独立 evidence，不互译）` + `M1.5/M2/M3` + `legacy audits/** 历史路径`；
  - `baseline.candidate_tree_sha256`: 本 phase 实施 HEAD；
  - `acceptance_strategy.boundary`: integration + manual verification；不冒充 component-only。
- `plans/task-lens-outcome-v1/acceptance-spec-v2.json`：`spec_id: "TASK-LENS-ACCEPTANCE-SPEC-V2"`、`generation: 2`；`requirements[]`: REQ-011v2/012v2/013v2/014v2/REQ-CROSS-ENV；`oracles[].O-002`: 双环境 integration + manual verification，verdict = 单一 canonical run-result-v2；`cases[]`: 每个 REQ 两个固定 case（WSL + Git Bash），至少 10 个 case。
- `plans/task-lens-outcome-v1/outcome-test-bundle-v2.json`：`bundle_id: "TASK-LENS-TEST-BUNDLE-V2"`、`generation: 2`；`tests[]`: metrics.test.ts / cli-integration.test.ts / integration.test.ts / closure.test.ts（PHASE-07 sensitivity control）；SHA 文件写入冻结后采集（**本轮 plan 不预填**）；同步冻结双端 runner/oracle 元数据 + `runner_config[]` + `lockfiles[]`。
- `plans/task-lens-outcome-v1/outcome-amendment-v2.json`（**新建**）：`amendment_id: "TASK-LENS-AMENDMENT-V2"`、`generation: 2`；`from_contract` 引用 v1，`to_contract` 引用 gen2；`reason`: 解释 v1 component-only → gen2 integration + manual verification 范围扩张，显式消除 v1 contract `in_scope[5]` metrics 写入契约与 `out_of_scope[2]` PHASE-05 收尾字面歧义；`affected_case_ids`: gen2 新增 case_id 列表（≥10）；`unaffected_case_ids`: v1 4 个 case_id（T-001..T-004）；`change_class: "NORMAL"`（默认范围扩张，非弱化）；`prior_failures`: 空数组；`frozen_diff`: validator `expectedFrozenDiff(from, to)` 三层 SHA 计算。
- `plans/task-lens-outcome-v1/outcome-approval-v2.json`：`approval_id: "TASK-LENS-APPROVAL-V2-GEN2"`、`generation: 2`；`contract/acceptance_spec/test_bundle` 引用 gen2 同代三件；`amendment` 引用同 `outcome-amendment-v2.json`（validator 第 280 行 generation>1 approval 必须 amendment）；`approval.approved_by: "ChoGeer"`、`principal_id: "HUMAN:ChoGeer"`、`trust_domain: "human-primary"`；`weakening_approval: null`（NORMAL change_class）。
- `plans/task-lens-outcome-v1/ledger/event-003-v2-contract-superseded.json`：`event_type: "CONTRACT_SUPERSEDED"`；`contract_ref/amendment_ref/approval_anchor` 引用 gen2；`previous_event`: hash-only 引用 v1 event-002（`{id: "LEDGER-TASK-LENS-OUTCOME-V1-002", path: "plans/task-lens-outcome-v1/ledger/event-002-run-recorded.json", generation: 2, sha256: <v1 event-002 sha>}`）。
- `plans/task-lens-outcome-v1/ledger/event-004-v2-run-recorded.json`：`event_type: "RUN_RECORDED"`；`contract_ref` 引用 gen2（与 v1 不同）；`previous_event`: hash-only 引用 event-003；`run_ref`: 引用 gen2 run-result。
- `plans/task-lens-outcome-v1/runs/outcome-run-result-v2.json`：`outcome_contract` 引用 gen2 contract；`case_results[]`: WSL + Git Bash 两个 case 子集（至少 10 entries）；`verdict`: PASS/FAIL/BLOCKED/INVALID/NOT_RUN；**整体 verdict 必须每个 REQ 的两端 case 都 PASS 才 PASS**（任一 case FAIL = 整体 FAIL）；validator `deriveRunVerdict`（`scripts/validate-outcome-governance.ts` 第 72 行）计算。

### 6.2 Acceptance root（双端独立）

- WSL: `${HOME}/.local/state/qoderwork/task-lens/m1-acceptance`
- Git Bash: `%LOCALAPPDATA%\qoderwork\task-lens\m1-acceptance`
- 每 task directory 必须可解析 `card.md/task-graph.json/input-receipt.json`；taskId unique；`diffHash` 或 `targetHeadSha` 至少一项与其他任务不同（证明非复制）；reviewer 实际审查 current change-set，非 fixture / 非人工复制 / 非同 input 重跑。

### 6.3 Feedback actor（双端）

Human reviewer 双端各自运行 feedback 命令或提供逐 task 可追溯输入；agent 可执行命令但不得替 reviewer 决定 yes/no/issues/minutes；双端 reviewer 凭证不共用。

### 6.4 Gate

- `TL-10TASK-v2`: generatedCount=10、feedbackCount=10、missing=[]、duplicate=[]、invalid=[]；
- `TL-7OF10-v2`: usefulAndReducedCount≥7；
- 多于 10 条 unique pairs 时，冻结并使用按 `generated.recordedAt` 升序、`taskId` 升序的前 10 条；该 selection 写入 audit receipt，不删除其他事件；
- 双端各自 PASS 独立判定。

### 6.5 Sensitivity control（双端）

复制 acceptance root 到新 temp out，只把一个 yes/yes feedback 改为 `useful=false`（7→6）；summary 必须 PASS→FAIL；原 metrics 只读；双端各自跑。

### 6.6 Technical gate（双端）

- `bun test scripts/task-lens` 双端各 exit 0；
- `bun run typecheck` 双端各 **exit 0**（v2 严格；predecessor exit=1 容忍已删除 — DEC-V2-006；当前 HEAD EXIT=0，约束可达）；
- `git diff --check` + `git diff --exit-code -- bun.lock` 双端各 exit 0；
- PHASE-06-v2 work-one/qoderwork 双端 receipts + human reviews 非空，hashes 对应 current accepted implementation HEAD。

### 6.7 Audit（双端；改用 validate-outcome-governance.ts）

- 双端各用 capture-state/EV receipts 完成 outcome chain；
- `validate-outcome-governance.ts plans/task-lens-outcome-v1 --repository-root "$(pwd)"`（USAGE: directory --repository-root repository，3 argv — 已实测）：双端各 exit 0 才签该端 ACCEPT；`mode: structural`、`validation_kind: review-separated`（structural-only，不证真实执行 — validator 第 15 行）；`lifecycle: ACTIVE` 表示 ledger 末端非 `OUTCOME_RETIRED`；禁与 v2.1 audit 框架混用；
- 不引用 `validate-audit.ts` 任何变体与 P-01..P-07 v2.1 audit 模板。

### 6.8 Blueprint status（v2）

- 全 gate PASS + 双端 verdict PASS → v2 blueprint=`IMPLEMENTED-AND-GATE-PASS`；
- 技术 PASS 但 TL-7OF10-v2 FAIL → `IMPLEMENTED-GATE-FAIL`；不解锁 M2，记录 M1.5 spec 触发；
- typecheck exit≠0 → 整体 FAIL；evidence 缺失/UNAVAILABLE → `BLOCKED`（保持未解锁）；
- INDEX 同步未完成 → status 不可写 DONE；保留 DRAFT 直到 INDEX sync session 完成。

### 6.9 Error/missing evidence behavior

任一 task artifact/metrics line/receipt/review/validator unavailable 使 audit BLOCKED/INVALID，不允许 0 替代；双端任一 UNAVAILABLE = 该端 FAIL = 整体 FAIL；不覆盖另一端 PASS。

### 6.10 Negative states

absence claim 仅 readable + query success + NOT_FOUND；write/evidence unavailable 必 FAIL。

### 6.11 Current vs historical source

final commands + acceptance receipts 必须在 v2 implementation HEAD 新执行；v2 phase 旧输出只作依赖，不替代新观察。

## 7. Implementation steps（v2 实施阶段；本轮 plan 仅设计）

```text
1. 完成 PHASE-07-v2 双端 scope-lock / Human approval / pre-change receipt；冻结 acceptance root（双端）与 PHASE-06-v2 receipts（双端）。
2. 双端各自对每个真实任务先 generate，再由 Human reviewer 审卡并提交一次 feedback；禁止批量猜测。
3. 双端每加入一个 feedback 后验证 metrics 最后一行可解析、taskId/hash 匹配；失败立即停止。
4. 双端各自达 10 unique pair 后运行 summary；保存 JSON、selected task IDs 与 artifact hashes。
5. 双端各自在复制的 temp root 执行 7→6 single mutation sensitivity control；原 root hash 前后相同。
6. 双端各自重跑全 task-lens tests、typecheck（exit 0 硬约束）、bun.lock/diff checks、双目标 receipt validation。
7. 双端各用 capture-state/EV receipts 完成 outcome chain；运行 validate-outcome-governance.ts；本端 exit 0 才可签署该端 ACCEPT。
8. 按 PASS/FAIL/BLOCKED 分支串行更新：blueprint → INDEX sync（独立 session, blocker）→ implementation log → logs index。
9. 创建 gen2 outcome chain（contract-v2/spec-v2/bundle-v2/amendment-v2/approval-v2/ledger event-003+004/runs/outcome-run-result-v2），gen2 文件置于 `plans/task-lens-outcome-v1/` 同目录；event-003.previous_event SHA 引用 v1 event-002（hash-only）；汇总双 case 到单一 canonical run-result。
10. audit report 写后立即三联门 + validate；最后写 LATEST + 三联门；不得越级措辞。
```

## 8. Check Registry

| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result | 双端 case 映射 |
|---|---|---|---|---|---|---|
| TL-10TASK-v2 | metrics+task dirs | full join | 10 unique complete pairs | unavailable FAIL | `["TL-10TASK-v2"]` | REQ-014v2-{WSL,GITBASH} |
| TL-7OF10-v2 | selected feedback | exact count | ≥7 | invalid FAIL | `["TL-7OF10-v2"]` | 同上 |
| TL-SENSITIVE-v2 | temp copy | 7→6 mutation | PASS→FAIL | source drift FAIL | `["TL-SENSITIVE-v2"]` | 同上 |
| TL-ALL-TESTS-v2 | Bun | full test | exit0 | output 缺 FAIL | `["TL-ALL-TESTS-v2"]` | 同上 |
| TL-TYPECHECK-v2 | root tsc | command | **exit0**（v2 严格；predecessor exit=1 容忍删除） | exit≠0 FAIL | `["TL-TYPECHECK-v2"]` | 同上 |
| TL-TARGET-PURITY-v2 | PHASE-06-v2 receipts | hash verify | two NOT_FOUND | unavailable FAIL | `["TL-TARGET-PURITY-v2"]` | 同上 |
| TL-AUDIT-v2 | gen2 outcome chain | validate-outcome-governance.ts | ok=true/errors0/lifecycle=ACTIVE | missing/mismatch INVALID | `["TL-AUDIT-v2"]` | 同上 |
| TL-DOC-STATE-v2 | four docs | exact status compare | all equal | missing/drift FAIL | `["TL-DOC-STATE-v2"]` | n/a |
| TL-V2-CHAIN-v2 | gen2 chain files | sha compare + ledger continuity | valid generation=2 + ledger event-002 hash-only ref | corrupt/missing FAIL | `["TL-V2-CHAIN-v2"]` | n/a |
| TL-DUAL-CASE-v2 | single canonical run-result | case_results[] 含两端 case | both PASS | one FAIL = 整体 FAIL | `["TL-DUAL-CASE-v2"]` | cross-case |

## 9. All-pass Fixture（双端各一份）

| Evidence object | Creation method | Required fields/data | Why required |
|---|---|---|---|
| acceptance root | 10 real generate/feedback cycles | 10 unique pairs/artifacts + env tag | product value |
| selected-task receipt | deterministic selection | IDs/input hashes/artifact hashes | no duplicate inflation |
| negative temp root | copy then one field mutation | original hash + changed line | sensitivity |
| technical outputs | fresh commands | tests/typecheck/diff/bun.lock（exit 0 硬约束） | implementation |
| PHASE-06-v2 bundle | retained evidence | two targets/reviews/snapshots/env | generality |
| gen2 outcome chain | contract-v2/spec-v2/bundle-v2/amendment-v2/approval-v2/ledger event-003+004/runs/outcome-run-result-v2 | generation=2 + dual case per REQ | framework |

## 10. Single-failure Matrix

| Test ID | Baseline | Only mutation | Expected check | Exact failedChecks/error | 双端 |
|---|---|---|---|---|---|
| TL-M-601-v2-{WSL,GITBASH} | 10 pairs | remove one feedback in copy | TL-10TASK-v2 | singleton/INCOMPLETE | both |
| TL-M-602-v2-{WSL,GITBASH} | 7 yes/yes | set one useful=false | TL-7OF10-v2 | singleton/FAIL | both |
| TL-M-603-v2-{WSL,GITBASH} | valid task dir | corrupt graph JSON in copy | TL-10TASK-v2 | singleton/UNAVAILABLE | both |
| TL-M-604-v2-{WSL,GITBASH} | target receipt | change one after hash | TL-TARGET-PURITY-v2 | singleton/FOUND | both |
| TL-M-605-v2-{WSL,GITBASH} | valid gen2 chain | remove one EV receipt | TL-AUDIT-v2 | singleton/INVALID | both |
| TL-M-606-v2 | consistent docs copy | change blueprint status | TL-DOC-STATE-v2 | singleton | n/a |
| TL-M-607-v2-{WSL,GITBASH} | valid typecheck | inject TS error in v2 test file | TL-TYPECHECK-v2 | singleton/exit≠0 | both |
| TL-M-608-v2 | valid gen2 chain | corrupt gen2 ledger event-003 sha | TL-V2-CHAIN-v2 | singleton | n/a |
| TL-M-609-v2-{WSL,GITBASH} | dual cases per REQ | copy WSL case receipt to Git Bash case | TL-DUAL-CASE-v2 | 整体 FAIL（不允许单端 PASS） | cross-env |

## 11. Fixed verification

### 11.1 命令清单（含 preflight `[POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT]` 标注）

```bash
# WSL Ubuntu-24.04 native FS

# preflight: confirm files exist
for f in scripts/validate-outcome-governance.ts \
         scripts/task-lens/__tests__/metrics.test.ts \
         scripts/task-lens/__tests__/cli-integration.test.ts \
         scripts/task-lens/__tests__/integration.test.ts \
         scripts/task-lens/__tests__/closure.test.ts \
         plans/task-lens-outcome-v1/outcome-contract.json \
         plans/task-lens-outcome-v1/acceptance-spec.json \
         plans/task-lens-outcome-v1/outcome-test-bundle.json \
         plans/task-lens-outcome-v1/outcome-approval.json \
         plans/task-lens-outcome-v1/ledger/event-001-contract-approved.json \
         plans/task-lens-outcome-v1/ledger/event-002-run-recorded.json \
         plans/task-lens-outcome-v1/ledger/event-003-v2-contract-superseded.json \
         plans/task-lens-outcome-v1/ledger/event-004-v2-run-recorded.json \
         plans/task-lens-outcome-v1/runs/outcome-run-result.json \
         plans/task-lens-outcome-v1/outcome-contract-v2.json \
         plans/task-lens-outcome-v1/acceptance-spec-v2.json \
         plans/task-lens-outcome-v1/outcome-test-bundle-v2.json \
         plans/task-lens-outcome-v1/outcome-amendment-v2.json \
         plans/task-lens-outcome-v1/outcome-approval-v2.json \
         plans/task-lens-outcome-v1/runs/outcome-run-result-v2.json ; do
  test -f "$f" || { echo "BLOCKED: $f missing; [POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT]"; exit 1; }
done

# acceptance summary [POST-IMPLEMENTATION]
test -d "${HOME}/.local/state/qoderwork/task-lens/m1-acceptance" || { echo "BLOCKED: acceptance root missing"; exit 1; }
bun run task-lens metrics summarize --out "${HOME}/.local/state/qoderwork/task-lens/m1-acceptance" --json
bun test scripts/task-lens

# typecheck must exit 0 (v2 strict; DEC-V2-006)
set +e
bun run typecheck
typecheck_exit=$?
set -e
test "$typecheck_exit" -eq 0

git diff --check
git diff --exit-code -- bun.lock

# outcome-governance structural validator (gen2 阶段; validator only, no audit framework)
bun run scripts/validate-outcome-governance.ts plans/task-lens-outcome-v1 --repository-root "$(pwd)"
```

> 本轮 plan 不执行；执行前必须 gen2 contract human-approved + 双端 acceptance root 可读 + typecheck exit 0。

### 11.2 不可执行命令标注

- `bun run task-lens metrics summarize --out ...` 无 acceptance root；标 `[POST-IMPLEMENTATION; CURRENTLY NON-EXISTENT]`。
- `bun test scripts/task-lens` 部分文件不存在（metrics/cli-integration/integration/closure test 未创建）；同上标注。
- `bun run typecheck` 当前 EXIT=0；`validate-outcome-governance.ts` audit file 未创建，同上标注。
- INDEX 同步非本 phase 目标；禁 `validate-audit.ts` 任何变体 + P-01..P-07 v2.1 audit 模板。

## 12. Rollback / failure convergence

1. acceptance FAIL 不回滚实现或篡改 feedback；按状态分支保留原 metrics/receipts；
2. 文档同步失败只恢复本 phase 4 个文档到前一完整版本；audit/evidence 不删；
3. gen2 chain 创建后任何字段错位 → 撤销 gen2 chain 创建（仅删 gen2 文件），保留 v2 plan + v2 evidence；不修改 v1；
4. 双端任一 FAIL → 整体 verdict FAIL；不删 fail 端 case。

## 13. Phase completion gate

- [ ] PHASE-07-v2 双端 Freeze Gate 与 10-task selection receipt 完整；
- [x] TL-10TASK-v2、TL-7OF10-v2、TL-SENSITIVE-v2 双端全 PASS；
- [x] full tests、root typecheck（**exit 0**）、bun.lock/diff、双目标 purity 双端全 PASS；
- [x] gen2 outcome chain（contract-v2/spec-v2/bundle-v2/amendment-v2/approval-v2/ledger event-003+004/runs/outcome-run-result-v2）双端创建；ledger event-003.previous_event SHA 引用 v1 event-002；双 case 汇总到单一 canonical run-result；
- [ ] `validate-outcome-governance.ts` 双端 exit 0；`mode: structural`、`validation_kind: review-separated`、`lifecycle: ACTIVE`；structural-only，不证真实执行；
- [ ] blueprint/documents/log/log index 状态一致（INDEX 同步是 blocker，非本 phase 解决）；
- [x] 任一端 case FAIL = 整体 FAIL，不允许单端 PASS；
- [x] M1.5/M2 仅按 gate 规则描述，M2/M3 未被写成已实现；
- [x] 任一未勾选项则 M1 v2 不得关闭。