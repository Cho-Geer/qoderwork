---
name: plan-audit-archiver
description: "Audit plan implementation with frozen scope, falsifiable controls, one consolidated rework package, and deterministic closure, then archive the report under the plan-specific audits directory / 以冻结范围、可证伪控制、单一完整返工包和确定性退出规则审核 plan 落地并归档。Use when reviewing code after a plan, implementation report, or rework log, especially repeated audit-rework loops. Trigger: 审核 plans, 实施报告审核, 返工复审, plan audit, plan 落地验证, 审计闭合, 可证伪审计. Not for: generic PR style review, architecture selection, plan authoring, skill health audit, or evidence-free status summaries."
---

# Plan Audit Archiver

## Language / 语言

Follow the user's language. Preserve code, commands, paths, API names, IDs,
status labels, and quoted source text exactly.

## Purpose

Audit implementation against an approved plan as a **closed, falsifiable
acceptance protocol**, not as an open-ended search for improvements. Prevent
the loop `implement -> discover one more criterion -> rework` without hiding
real defects or lowering the evidence standard.

This skill cannot prove that no unknown defect exists. It must make the known
acceptance boundary stable, test sensitivity visible, and every later scope
change attributable and reviewable.

## Canonical provenance rules

The full P-01..P-07 provenance rules (four-element structure: 约束主体 + 触发条件
+ 违反判定 + 违反后果) live in `provenance-rules.md` (this directory) — migrated
from AGENTS.md §15 on 2026-07-25. Read them before any v2.1-required audit or
implementation Freeze Gate; AGENTS.md §15 keeps only the rule index and the
mandatory trigger.

## Non-negotiable invariants

1. **One authoritative root.** A plan or approved contract is required. Logs,
   implementation reports, handoffs, and prior audits are claim/evidence
   sources; they do not silently add requirements.
2. **Freeze before verdict.** Record baseline hashes, `IN-SCOPE`,
   `OUT-OF-SCOPE`, assumptions, evidence ceiling, and exit criteria before
   issuing `ACCEPT` or `REWORK`.
3. **Sweep before rework.** Continue the full in-scope review after the first
   failure. Never issue piecemeal rework from a partial sweep.
4. **Independent oracle.** Derive expected behavior from the approved contract,
   not from the current implementation or its existing tests.
5. **Prove test sensitivity.** Every behavioral requirement needs a positive
   control and a negative control that is observed to fail. A test that only
   turns green cannot close a requirement.
6. **One frozen rework package.** Every open blocking finding from the completed
   sweep appears exactly once in the package. No vague verbs such as "完善",
   "加强", or "同步" without exact targets and observables.
7. **No silent goalpost movement.** A finding created after package freeze must
   pass the reopen gate and record whether it is a patch regression, an audit
   miss, or evidence invalidation.
8. **Classification before action.** New observations are `BLOCKING`,
   `NON_BLOCKING_DEBT`, `OUT_OF_SCOPE`, or `UNVERIFIED`. Discovery alone does
   not make an item blocking.
9. **Fail closed.** An invalid audit contract produces `INVALID`; unavailable
   required evidence produces `BLOCKED`. Neither state may emit an actionable
   rework package or claim completion.
10. **Approved plan registry required.** Every normative plan item is listed
    exactly once in a human-approved scope lock as `IN_SCOPE` or `EXCLUDED`.
    The audit author may propose the registry but may not self-approve it.
11. **Pre-change provenance required.** `ACCEPT/REWORK` require immutable
    pre-change and verdict-state receipts. In a dirty legacy worktree without a
    pre-change receipt, return `BLOCKED`; do not guess which phase changed a file.
12. **Immutable execution receipts required.** Executed controls reference
    `EV-NNN` receipts bound to audit generation, requirement, polarity, oracle,
    fixture, Git state, evidence level, command, exit code, and hashed output.
13. **Machine gate required.** Validate every v2.1 report through the file CLI,
    which verifies real files, hashes, Git root/HEAD/state, scope lock, receipts,
    artifacts, and the previous-audit chain. In-memory structure validation and
    a green product suite alone are insufficient.

14. **Pre-change receipt precondition.** When `provenance_level = v2.1-required`
    (declared per provenance-rules.md rule P-01), Step 1 (Freeze) MUST verify that
    `evidence/pre-change-<PHASE-N>.json` exists and is non-empty before any
    implementation write. If the pre-change receipt is missing, the audit
    verdict MUST be `INVALID` (not `BLOCKED`), because the implementation
    process violated the audit contract first. Reconstructed audits for phases
    missing a pre-change receipt are MUST NOT.

15. **Execution receipt binding and capture-state.ts role.** Step 4 (Prove
    oracle sensitivity) execution receipts (EV-NNN) MUST be produced by a
    trusted runner and hashed immediately after creation. Each receipt MUST
    bind to a verdict-state receipt generated by `capture-state.ts` via the
    `repository_state_sha256` field. `capture-state.ts` generates repository
    state receipts (pre-change and verdict-state) only; it does not generate
    execution receipts. `Verified-by:` text evidence lines are human-readable
    summaries of receipts, not receipts themselves. Substituting text evidence
    lines for immutable receipts to sign v2.1 ACCEPT is MUST NOT.

16. **validate-audit.ts machine gate necessity.** Step 9 (Validate)
    `validate-audit.ts` `exit 0` is a necessary condition for signing `ACCEPT`
    or `REWORK`, not an optional check. On `exit 1`, the audit report MUST NOT
    be signed; it MUST be classified as `INVALID` (contract defect) or `BLOCKED`
    (missing authority/provenance/evidence) before any implementation
    instructions are given. Signing any verdict while `validate-audit.ts` has
    not run or exited non-zero is MUST NOT.

17. **Evidence pre-check gate required.** After creating or modifying any
    EV-NNN receipt file, `pre-check-evidence.ts` MUST run before
    `validate-audit.ts`. Skipping `pre-check-evidence.ts` is a process
    violation; the audit report MUST NOT be signed `ACCEPT`. The sole source
    of truth for pre-check rules is the `pre-check-evidence.ts` code logic.
    Check rule lists MUST NOT be copied into this file or any other document.
    New rules are added only by modifying `pre-check-evidence.ts` code; this
    file is not edited when rules change.

## Inputs and paths

| Input/artifact | Rule |
|---|---|
| Authoritative plan | At least one file under `plans/` or an explicitly approved equivalent |
| Supplemental claims | Named logs, implementation reports, handoffs, and prior audits |
| Current truth | Live code/config/DB/logs and tests at the frozen baseline |
| Report template | `templates/audit-report-template.md` |
| Scope-lock template | `templates/scope-lock-template.json` |
| Evidence-receipt schema | `templates/evidence-receipt-template.json` (runner output shape; do not self-attest) |
| State capture | `scripts/capture-state.ts` |
| Contract generator | `scripts/prepare-audit.ts` — assembles byte-exact contract + report skeleton from scope-lock, EV receipts, pre-change and verdict-state receipts |
| Pre-check (gate 1) | `scripts/pre-check-evidence.ts` |
| Validator (gate 2) | `scripts/validate-audit.ts` |
| Formal archive | `audits/<plan-name>/<YYYY-MM-DD>-audit[-N].md` |
| Latest pointer | `audits/<plan-name>/LATEST.md` |
| One-off investigation | `temporary-audits/`; do not use this skill's closure verdict |

Map a plan file to its filename without `.md`; map a plan directory to its
directory name; replace spaces with `-`. Never overwrite a historical audit.

## Verdict state machine

Use only these verdicts:

| Verdict | Meaning | May emit rework? |
|---|---|:---:|
| `ACCEPT` | Every in-scope requirement is closed with required evidence | No |
| `REWORK` | Full sweep complete; one frozen package covers every open blocker | Yes |
| `BLOCKED` | Required environment, authority, source, or evidence is unavailable | No |
| `INVALID` | Audit contract, oracle, scope, or report structure is defective | No |

`PASS`, progress percentages, and "基本完成" are not audit verdicts.

## Pre-Audit Knowledge Required `[ANALYSIS]`

Before writing any audit report content, the agent MUST read the validator
source code in full to extract the acceptance contract. The audit report is
the artifact under test; `validate-audit.ts` is the acceptance oracle. Writing
the report without reading the oracle first is a process violation and will
produce `INVALID` verdicts.

### Mandatory reads before drafting the report

1. `.agents/skills/plan-audit-archiver/scripts/validate-audit.ts` — read it
   completely. Extract every `issue(errors, ...)` call site as a rule. Each
   `code` string is an ERROR_CODE the report must not trigger.
2. `.agents/skills/plan-audit-archiver/scripts/pre-check-evidence.ts` — read it
   completely. This script is gate 1 of the two-gate validation; its rules are
   the sole source of truth for evidence-file pre-checks and MUST NOT be
   paraphrased elsewhere.
3. `templates/scope-lock-template.json` — the canonical field shape. Any
   scope-lock file the agent proposes MUST match this shape field-for-field.
4. `templates/audit-report-template.md` and `templates/evidence-receipt-template.json`
   — the canonical report and receipt shapes.

> **合理化检测**: 如果你发现自己在想「参考前序 phase 的 scope-lock 或 audit report 作为模板就够了，不需要读 validator」——停下来，这是跳步信号。前序 phase 可能本身就不合规；唯一权威是 validator 代码与官方模板。

> **合理化检测**: 如果你发现自己在手动复制 receipt 字段到 contract ledger——停下来，这是 `EVIDENCE_RECEIPT_PAYLOAD_MISMATCH` 的首要原因。运行 `prepare-audit.ts` 自动生成 byte-exact contract，然后只编辑 `REPLACE_*` 占位符。

### Scope-lock 字段速查表

The word `status` appears in two distinct locations with distinct meanings.
Confusing them is the most common cause of `INVALID` verdicts.

| 字段位置 | 字段名 | 合法值 | 说明 |
|---------|--------|--------|------|
| scope-lock 文件顶层 `scope.status` | `scope.status` | `FROZEN` \| `UNFROZEN` | 表示冻结状态。`APPROVED` 不是合法值 |
| scope-lock 文件顶层 `approval.status` | `approval.status` | `APPROVED` \| `PENDING` | 表示人类审批状态。`FROZEN` 不是合法值 |
| audit contract 内 `scope.status` | `scope.status` | `FROZEN` \| `UNFROZEN` | 与 scope-lock 文件的 `scope.status` 同语义，但字段位于 audit report JSON contract 中 |
| audit contract 内 `scope.provenance_level` | `scope.provenance_level` | `v2.1-required` \| `component-only` | 必须与 scope-lock 文件的 `scope.provenance_level` 一致 |

**scope-lock 文件必填顶层字段**（缺任一项触发 `PLAN_REGISTRY_MISSING` / `INVALID_PLAN_ITEM_ID` 等）：

- `schema_version`、`lock_id`、`created_at`、`plan_sources`
- `scope`（含 `status`、`provenance_level`、`frozen_at`、`in_scope`、`out_of_scope`、`assumptions`、`exit_criteria`）
- `requirements`（数组，每项含 `id`、`plan_item_id`、`kind`、`source`、`behavior`、`required_evidence_level`、`oracle_id`、`oracle`）
- `plan_registry`（非空数组，每项含 `plan_item_id`、`disposition`、`requirement_id`、`source`；`kind`/`behavior`/`required_evidence_level`/`oracle_id`/`oracle` 不再重复，由 `requirements[]` 派生）
- `repository_scope`（含 `allowed_paths`、`forbidden_paths`）
- `approval`（含 `status`、`actor_type`、`approved_by`、`approved_at`、`evidence`）

### ID 命名规范表

所有 ID 必须使用 3 位数字（无 phase 前缀）。带 phase 前缀（如 `PLAN-REQ-06A-001`）是非法的。

| ID 类型 | 正则 | 示例（合法） | 示例（非法） |
|---------|------|-------------|-------------|
| requirement_id | `^REQ-\d{3}$` | `REQ-001` | `REQ-06A-001` |
| plan_item_id | `^PLAN-REQ-\d{3}$` | `PLAN-REQ-001` | `PLAN-REQ-06A-001` |
| oracle_id | `^ORACLE-\d{3}$` | `ORACLE-001` | `ORACLE-06A-001` |
| evidence_receipt id | `^EV-\d{3}$` | `EV-001` | `EV-06A-001` |
| finding_id | `^F-\d{3}$` | `F-001` | `F-06A-001` |

### negative_control 格式规范表

`applicability` 字段必须是枚举值，不是任意字符串。`"N/A"` 字符串非法。

| requirement kind | `applicability` 合法值 | `command` / `method` / `expected` / `observed` 要求 |
|---|---|---|
| `BEHAVIORAL` | `REQUIRED` | 必须是具体非空字符串；`expected` 必须为 `PASS` 或 `FAIL`；`observed` 必须与 `exit_code` 一致（0→PASS，非零→FAIL） |
| `STATIC` | `NOT_APPLICABLE_STATIC` | 必须全为字符串 `"N/A"`（仅此一种字符串合法） |

> **注意**: `STATIC` 的 `applicability` 是 `NOT_APPLICABLE_STATIC`（枚举值），不是 `"N/A"`（任意字符串）。validator 逐字段检查 `command === "N/A" && method === "N/A" && expected === "N/A" && observed === "N/A"`，任一非 "N/A" 触发 `STATIC_NEGATIVE_CONTRACT`。

### 仓库身份字段使用规范表

`baseline` 内两个字段决定仓库身份，禁止混用：

| 字段 | 含义 | 取值要求 |
|------|------|---------|
| `baseline.workspace_root` | 审计工作区绝对路径 | qoderwork 主仓或其 worktree（如 `/home/zhaoge/workspace/qoderwork` 或 `/home/zhaoge/workspace/qoderwork/.worktrees/<branch>`） |
| `baseline.repository_root` | 干净锚点仓库绝对路径 | 默认 work-one（`/home/zhaoge/workspace/opencode/work-one`）；不能是接收 `audits/`、`plans/`、`evidence/` 写入的工作区本身 |
| `baseline.commit` | 被审计仓库的 HEAD commit | 必须等于 `git -C <repository_root> rev-parse HEAD` |
| `baseline.head_at_verdict` | verdict 时点的被审计仓库 HEAD | 必须等于 `baseline.commit` |
| `baseline.dirty_paths` | 被审计仓库的 git status 路径 | 必须等于 `git -C <repository_root> status --porcelain` 输出，不是 workspace_root 的 |

`capture-state.ts --repository-root <X>` 生成 receipt 时，receipt 内的 `head` 与 `repository_realpath` 字段都对应 X 仓库。audit contract 的 `baseline.commit` 必须与 verdict-state receipt 的 `head` 一致。

> **合理化检测**: 如果你发现自己在想「我在 qoderwork 目录跑 `git rev-parse HEAD` 拿到 commit 填进 baseline」——停下来，这是跳步信号。validator 用 `repository_root` 校验 commit，必须填 work-one 的 HEAD，不是 qoderwork 的 HEAD。

### repository_root 选择规则（强制）

`repository_root` 必须（MUST）设为干净锚点仓库（默认 work-one：`/home/zhaoge/workspace/opencode/work-one`）；禁止（MUST NOT）设为审计工作区（qoderwork 主仓 `/home/zhaoge/workspace/qoderwork` 或其任何 `.worktrees/*` worktree）。无论审计对象是 work-one 本身还是 qoderwork 自身的工具代码（如 `scripts/task-lens/**`），`repository_root` 恒为干净锚点——它的唯一作用是提供一个审计期间不变的 git 基线，证明被审计目标仓库无意外变更。

**worktree 场景**：当在 qoderwork worktree（如 `.worktrees/check-plan`）中实施时，`workspace_root` 是该 worktree 路径，`repository_root` 仍是 work-one。git 在 linked worktree 中 `rev-parse --show-toplevel` 返回 worktree 自身路径，`capture-state.ts` 的 toplevel 校验（L73-75）对 worktree 天然兼容；但 worktree 是接收 `audits/`、`plans/`、`evidence/` 写入的工作区，其 git status 会随审计推进变脏，因此不能作 `repository_root`。

**原因链**（validator 代码逻辑，非约定）：

1. validator 用 `git -C <repository_root> status --porcelain` 计算 `actualStatus`（validate-audit.ts 第 1159 行 `gitStatusEntryMap`）
2. `deltaPaths` = pre-change receipt 的 `status_entries` 与 `actualStatus` 的对称差（第 1190 行）
3. `deltaPaths` 中不在 `repository_scope.allowed_paths` 内的路径触发 `DIRTY_PATH_OUTSIDE_SCOPE`（第 1197 行）
4. validator 对 `audits/`、`logs/`、`evidence/` 等审计基建路径**无任何豁免逻辑**（第 1191-1198 行循环中无前置路径过滤）
5. 审计基建文件（报告、EV receipts、verdict-state、LATEST.md、日志）全部在 workspace_root（qoderwork）中产生
6. 若 `repository_root = workspace_root`，所有审计基建文件出现在 `deltaPaths` 中，全部触发 `DIRTY_PATH_OUTSIDE_SCOPE`
7. 若 `repository_root = work-one`（审计过程中保持 clean，`status_entries = []`），`deltaPaths` 为空，审计基建文件不影响验证

**操作要求**：

- `capture-state.ts --repository-root` 必须（MUST）传入 work-one 路径
- `generate-evidence-receipt.ts --repository-root` 必须（MUST）传入 work-one 路径
- `baseline.commit` / `baseline.head_at_verdict` 填 work-one 的 HEAD（`git -C /home/zhaoge/workspace/opencode/work-one rev-parse HEAD`）
- 实施范围由 scope-lock 的 `repository_scope.allowed_paths` / `forbidden_paths` 控制，不由 `repository_root` 的 dirty path 检查控制

> **合理化检测**: 如果你发现自己在想「这个 phase 改的是 qoderwork 的测试文件，所以 repository_root 应该填 qoderwork」——停下来，这是跳步信号。`repository_root` 的唯一作用是提供一个 clean 的 git 基线，证明被审计目标仓库无意外变更。实施文件的范围约束由 scope-lock 的 `repository_scope` 字段承担，两者职责不同。
>
> **合理化检测（worktree）**: 如果你发现自己在想「我在 `.worktrees/check-plan` worktree 里实施，所以 repository_root 应该填这个 worktree」——停下来，这是跳步信号。worktree 是接收 `audits/`、`evidence/` 写入的工作区，其 git status 会变脏；`repository_root` 必须填 work-one（干净锚点），不是当前 worktree。

### 时间依赖关系图

下列三条时间约束必须同时满足，任一倒挂触发对应 ERROR_CODE：

```
pre_change_receipt.captured_at ≤ sweep.completed_at                  (PRE_CHANGE_TIME_INVALID)
scope.frozen_at               ≤ sweep.completed_at                  (FREEZE_AFTER_SWEEP)
sweep.completed_at            ≤ verdict_state_receipt.captured_at   (VERDICT_STATE_TIME_INVALID)
```

**含义**：
- pre-change receipt 必须在 sweep 完成前捕获（实施前快照先于验证）
- scope 必须在 sweep 完成前冻结（人类审批先于验证）
- verdict-state receipt 必须在 sweep 完成后捕获（实施后快照后于验证）
- pre-change 与 frozen_at 之间无顺序约束：两者都在 sweep 前完成即可。`capture-state.ts --freeze <ISO8601>` 可在同一原子操作中设置 `scope.frozen_at`/`scope.status` 并捕获 pre-change receipt，消除循环依赖。

verdict-state receipt 必须在 sweep 完成后捕获，因为 `repository_state_sha256` 字段要绑定到 verdict-state，证明所有 EV-NNN receipt 与最终仓库状态一致。

### 不可变 receipt 转录原则

audit contract 内 `evidence_receipts[]` 数组中每个对象的字段必须与对应 receipt 文件 `EV-NNN-*.json` 逐字符一致。validator 用 `JSON.stringify(actualPayload) !== JSON.stringify(expectedPayload)` 对比，任何字符差异（包括空格、重定向、管道）触发 `EVIDENCE_RECEIPT_PAYLOAD_MISMATCH`。

**禁止行为**：
- 清理 receipt command 中的 `2>&1 | tail -5`、`> /tmp/xxx 2>&1` 等重定向
- 修剪 command 文本中的空格或引号
- 替换 `observed` 字段值（必须与 receipt 一致）
- 调整 `exit_code`、`cwd`、`artifacts` 任何字段

**合法行为**：
- 从 receipt 文件复制完整字段到 contract ledger
- 对 contract ledger 添加 SHA-256 等 meta 字段（receipt 文件没有的字段）

## Required workflow

### Step 0: Admit the audit `[ANALYSIS]`

Read the plan completely. Reject the audit as `INVALID` when there is no
authoritative source, unresolved architecture choice, observable acceptance
criterion, or complete machine-readable plan registry. A legacy plan may use a
one-time `scope-lock-template.json` sidecar, but a human reviewer must approve
its complete registry before it becomes authoritative.

Record every supplemental source separately and hash all source files. Capture
the implementation base commit, current commit, canonical repository root, and
exact dirty paths. A log remains a claim even when hashed.

Do not treat an implementation log's claim as proof. Do not add a log-only
requirement unless the user explicitly approves it into scope.

### Step 1: Freeze the audit capsule `[ANALYSIS]`

Before implementation begins, assign atomic `PLAN-REQ-NNN`, `REQ-NNN`, and
`ORACLE-NNN` IDs and write:

- baseline commit and source SHA-256 values;
- exact in-scope requirement IDs;
- explicit out-of-scope items and non-goals;
- assumptions and how each can be disproved;
- required evidence level per requirement;
- deterministic exit criteria;
- exact allowed and forbidden repository paths;
- `scope.status = FROZEN` and freeze timestamp.

Every plan item must appear once in `plan_registry`. `IN_SCOPE` items map
one-to-one to audit requirements. `EXCLUDED` items require a reason and hashed
human approval receipt. Hash the approved scope lock, then capture the
pre-change state before any implementation write:

```bash
# cd 到审计工作区（qoderwork 主仓或其 worktree，如 .worktrees/<branch>）
cd /home/zhaoge/workspace/qoderwork

# 推荐：--freeze 原子操作（设置 scope.frozen_at + scope.status=FROZEN，然后捕获 pre-change receipt）
# scope_lock_sha256 绑定到 frozen_at 写入后的最终版本，消除循环依赖
# --repository-root 必须是干净锚点（work-one），不是当前 worktree（见 provenance-rules.md P-07）
# --phase-id 必须与 scope-lock 的 lock_id 字段完全相同（validator L1175 校验 phase_id == lock_id）
bun run .agents/skills/plan-audit-archiver/scripts/capture-state.ts \
  --repository-root /home/zhaoge/workspace/opencode/work-one \
  --scope-lock /absolute/path/to/audits/plan-name/scope-lock.json \
  --phase-id LOCK-ID \
  --freeze 2026-07-21T12:00:00Z \
  --output /absolute/path/to/audits/plan-name/evidence/pre-change.json

# 兼容：不带 --freeze（scope-lock 必须已含 frozen_at 和 status=FROZEN）
# --phase-id 同样必须等于 scope-lock 的 lock_id
bun run .agents/skills/plan-audit-archiver/scripts/capture-state.ts \
  --repository-root /home/zhaoge/workspace/opencode/work-one \
  --scope-lock /absolute/path/to/audits/plan-name/scope-lock.json \
  --phase-id LOCK-ID \
  --output /absolute/path/to/audits/plan-name/evidence/pre-change.json
```

The capture tool refuses to overwrite an existing receipt. If scope cannot be
frozen, stop with `INVALID`. If a valid scope is awaiting human approval or a
required pre-change state no longer exists, stop with `BLOCKED`. Do not begin a
rolling or reconstructed audit.

### Step 1.5: Impact analysis for shared functions `[ANALYSIS]`

If the plan modifies any function body (not just imports or type definitions),
identify shared functions and record their callers:

1. List all functions whose body will be modified in `impact_analysis.modified_functions`.
2. For each, run `codegraph callers <函数名>` (or `rg -n "函数名" scripts/` if not indexed).
3. If the returned `file`-level callers span ≥ 2 files, add the function to
   `impact_analysis.shared_functions`.
4. Record all caller files in `impact_analysis.caller_files`.
5. For each caller file, determine its test file path:
   - `scripts/foo.ts` -> `scripts/__tests__/foo.test.ts` (or `scripts/test-serve/__tests__/foo.test.ts`)
   - If the test file does not exist, omit it.
6. Record test files in `impact_analysis.caller_tests`.
7. Hash the scan output and record in `impact_analysis.scan_output_sha256`.
8. The plan's Fixed verification command MUST include every file in
   `impact_analysis.caller_tests`. If it does not, the scope-lock is INVALID.

### Step 2: Build the oracle and falsification matrix `[ANALYSIS]`

For every `REQ-NNN`, record one observable behavior and one implementation-
independent oracle. Classify it as `BEHAVIORAL` or `STATIC`.

For `BEHAVIORAL`, define before execution:

- positive control: correct behavior must produce `PASS`;
- negative control: one deliberate mutation/fault/bad fixture must produce
  `FAIL` through the same oracle;
- the same `oracle_id`, different `fixture_id` values, and distinct receipts;
- boundary/error case;
- exact command, cwd, environment, expected result, and evidence artifact.

For `STATIC`, record the exact read/query, expected value, and why a behavioral
negative control is not applicable. Absence checks must distinguish `FOUND`,
`NOT_FOUND`, and `UNAVAILABLE`; only `NOT_FOUND` can satisfy absence.

### Step 3: Verify the current baseline `[VERIFICATION]`

Follow repository instructions. Use CodeGraph before code text search when the
repository is indexed. Verify current source, callers, config, DB, tests, and
runtime at the evidence level required by each requirement.

Record after every execution:

`Verified-by: <cwd + command/request> -> <observable result + artifact>`

Static inspection proves only code shape. Component, integration,
`runtime-smoke`, and `live-LLM-E2E` remain distinct.

### Step 4: Prove oracle sensitivity `[VERIFICATION]`

Run both controls for every behavioral requirement. Prefer an isolated fixture,
dependency fault injection, or test-only mutation; do not corrupt production
state. Record `positive.observed` and `negative.observed` independently. Each
execution must produce a JSON receipt plus at least one hashed output artifact;
the receipt is immutable after hashing and is registered as `EV-NNN`.

The receipt must bind `audit_id`, `generation`, `requirement_id`, `polarity`,
`oracle_id`, `fixture_id`, full command/cwd, verdict-state SHA-256, exit code,
observed result, evidence level, artifact hashes, and completion time. Do not
hand-author a receipt to simulate execution. Use the receipt generator
(`scripts/generate-evidence-receipt.ts`) to execute the command, capture real
stdout/stderr/exitCode, and produce an immutable receipt + artifact with
correct sha256. The generator derives `observed` from `exit_code` (0→PASS,
non-zero→FAIL) and does not accept manual `PASS`/`FAIL` override, preventing
simulated execution. For adversarial/mutation/property/fuzz/live-path
execution, use `test-specification-execution` as the trusted runner and
preserve its raw output.

**Evidence 子目录约定**：每轮审计的 EV receipts 和 artifacts 应放在独立子目录中，避免不同审计的文件混放导致 `pre-check-evidence.ts` 误报：

```
audits/<plan>/evidence/<PHASE>-<generation>/
  ev-001-receipt.json
  ev-001-output.txt
  ev-002-receipt.json
  ev-002-output.txt
  ...
```

示例：`audits/p0-2/evidence/PHASE-04a-F5/ev-001-receipt.json`。`prepare-audit.ts --evidence-dir` 指向该子目录即可，`--receipt-prefix` 过滤变为可选。

The requirement cannot be `PASS` when:

- the positive control did not run or did not pass;
- the negative control did not run or did not fail;
- both controls use different or implementation-derived oracles;
- evidence is missing, stale, or below the required level.

**负控制命令区分规则（validator 强制检查）**:

validator 对每个 `BEHAVIORAL` requirement 检查 `positive_control.command !== negative_control.command`（字符串严格不等，validate-audit.ts 第 357 行）。若两个 `command` 字段完全相同，触发 `CONTROL_COMMAND_NOT_DISCRIMINATING`，审计不可签署。

设计负控制时，必须（MUST）确保 `negative_control.command` 字符串与 `positive_control.command` 存在可观测差异。合法方式：

- 变更环境变量值（如 `P0_2_PORT_A=70000` 替代 `P0_2_PORT_A=4001`）
- 变更命令行参数（如 `--port 9999` 替代 `--port 4001`）
- 变更输入文件路径（如指向不存在的 fixture）

禁止（MUST NOT）仅依赖外部进程注入（如后台启动 python 监听器占用端口）而保持 `command` 字符串与正控制完全不变——validator 只比较 `command` 字段文本，不感知外部进程状态。

Use `test-specification-execution` for adversarial, mutation, property, fuzz,
or live-path execution when those levels are required.

### Step 5: Complete the full in-scope sweep `[ANALYSIS -> VERIFICATION]`

Do not stop at the first failure. For every `REQ-NNN`:

1. trace the exact implementation symbols and callers;
2. inspect every planned success, error, cleanup, retry, and cancellation path;
3. run its registered controls;
4. record `PASS`, `FAIL`, `BLOCKED`, or `INVALID`;
5. classify every observation before continuing.

Set `sweep.status = COMPLETE` only when its requirement set equals the frozen
`IN-SCOPE` set. Otherwise the audit is `INVALID`, not `REWORK`.

### Step 6: Create immutable findings `[OBSERVATION]`

Each `F-NNN` must contain:

- linked requirement IDs and exact source evidence;
- classification and origin (`PRE_EXISTING`, `REGRESSION`, `AUDIT_MISS`, or
  `EVIDENCE_INVALIDATION`);
- reproducible bad behavior and independent oracle;
- allowed files, forbidden changes, and non-goals;
- one pre-fix failing control and exact expected failure;
- closure conditions and required reruns;
- status `OPEN`, `CLOSED`, or `BLOCKED`.

Only an in-scope requirement violation may normally be `BLOCKING`. A genuine
safety/data-loss issue may reopen scope through Step 8. Keep ordinary unrelated
defects as debt or out of scope.

### Step 7: Freeze one rework package `[OBSERVATION]`

After the sweep, compute the set of open `BLOCKING` finding IDs. For `REWORK`,
the package must contain exactly that set: no missing IDs, duplicates, debt, or
unverified suggestions.

For every package item specify exact files/symbols, required behavior, forbidden
changes, failing control, acceptance commands, expected output, and evidence
level. Set `rework_package.status = FROZEN`. Once frozen, do not edit it in
place; a legitimate change requires a reopen record and a new audit file.

### Step 8: Apply the reopen gate during re-audit `[OBSERVATION]`

Re-audit the frozen finding IDs first. A newly observed blocker is allowed only
when all fields below are recorded:

1. linked frozen requirement or explicit safety/evidence-invalidating rule;
2. reproducible evidence at the current baseline;
3. origin classification;
4. proof of regression causality when origin is `REGRESSION`;
5. explanation of the original audit miss when origin is `AUDIT_MISS`;
6. reason it cannot be debt or a later phase;
7. complete resweep of every affected requirement;
8. an approved reopen record in a new audit report.

Never blame the implementer for satisfying the previous frozen package when a
pre-existing condition is later classified as `AUDIT_MISS`. Expose the audit
defect and its added cost explicitly.

For `generation > 1`, reference the immediately preceding report by path,
SHA-256, and audit ID. The validator requires adjacent generations, identical
frozen plan/scope/requirement projections, and preservation of every prior open
blocker and its immutable contract. A prior blocker may remain `OPEN`, become
`CLOSED` with a current post-fix receipt, or become `BLOCKED`; it may not vanish.
Any new blocker needs a reopen record even if `introduced_after_freeze` was
mislabelled.

### Step 9: Validate, archive, and decide `[VERIFICATION -> OBSERVATION]`

**强制流程顺序**（禁止跳步）：

1. 完成 Step 4-8（sweep 全部 in-scope requirement），得到 sweep.completed_at 时间戳
2. 用 `capture-state.ts` 捕获 verdict-state receipt 到新路径（`verdict-state-<PHASE>.json`）— 此时 `captured_at` 必须 ≥ `sweep.completed_at`
3. 哈希 verdict-state receipt，将每个 EV-NNN receipt 的 `repository_state_sha256` 字段绑定到该哈希
4. **推荐**：用 `prepare-audit.ts` 生成报告骨架（byte-exact contract + 21-section 结构），然后只编辑 `REPLACE_*` 占位符。手动转录 receipt 字段是 `EVIDENCE_RECEIPT_PAYLOAD_MISMATCH` 的首要原因。
   ```bash
   bun run .agents/skills/plan-audit-archiver/scripts/prepare-audit.ts \
     --workspace-root /home/zhaoge/workspace/qoderwork \
     --scope-lock audits/<plan>/scope-lock-<PHASE>.json \
     --pre-change audits/<plan>/evidence/pre-change-<PHASE>.json \
     --verdict-state audits/<plan>/evidence/verdict-state-<PHASE>.json \
     --evidence-dir audits/<plan>/evidence \
     --receipt-prefix <prefix> \
     --output audits/<plan>/<YYYY-MM-DD>-audit[-N].md \
     --verdict ACCEPT --evidence-ceiling component
   ```
5. 复制 `templates/audit-report-template.md` 并填写完整内容，包括 JSON contract（如未使用 prepare-audit.ts）
5. **在 contract 中写 `verdict: ACCEPT` 之前**，必须先完成 step 6-7 的两道闸门
6. **Gate 1**: 运行 `pre-check-evidence.ts` — exit 0 才能继续
7. **Gate 2**: 运行 `validate-audit.ts` — exit 0 才能继续
8. 两道闸门都 exit 0 后，才在 contract 中写 `verdict: ACCEPT`（或 `REWORK`）
9. 写 `LATEST.md`，记录 report link、baseline commit、verdict、open blocker count、evidence ceiling
10. 每个写入的文本文件立即用 `test -s`、`wc -l`、内容断言验证

> **合理化检测**: 如果你发现自己在想「先写 ACCEPT 再跑 validator 修正」——停下来，这是跳步信号。先签 ACCEPT 再跑 validator 会让 mindset 锁定在「找理由合理化 ACCEPT」，而非「客观验证」。正确顺序是先验证再签署。

> **注意**: validator 报错时，错误是 audit contract 本身的问题，不是 validator 的问题。修复方向是改 audit contract，不是绕过 validator。任何 `exit 1` 必须修复 contract 后重新跑两道闸门，禁止用 `--no-verify` 类似参数绕过。

```bash
cd /home/zhaoge/workspace/qoderwork

# Gate 1: pre-check evidence files (MUST exit 0 before proceeding)
bun run .agents/skills/plan-audit-archiver/scripts/pre-check-evidence.ts \
  audits/<plan-name>/

# Gate 2: final validation (MUST exit 0 to sign ACCEPT/REWORK)
bun run .agents/skills/plan-audit-archiver/scripts/validate-audit.ts \
  audits/<plan-name>/<YYYY-MM-DD>-audit[-N].md
```

Only this file-based CLI may authorize `ACCEPT/REWORK`; `validateAuditSource()`
is a structural unit-test helper and does not verify external truth. The command
must exit `0`. An exit `1` makes the report non-signable; classify the cause as
`INVALID` (bad contract) or `BLOCKED` (missing authority/provenance/evidence)
before giving implementation instructions. Then write `LATEST.md` with
the report link, baseline commit, verdict, open blocker count, and evidence
ceiling. Verify every written text file immediately with `test -s`, `wc -l`,
and a required-heading assertion.

### Validator ERROR_CODE 速查表

下表列出 validator 常见 ERROR_CODE 与对应修复方向。完整列表以 `validate-audit.ts` 代码为准，本表不替代代码阅读。

| ERROR_CODE | 触发条件 | 修复方向 |
|-----------|---------|---------|
| `SCOPE_NOT_FROZEN` | ACCEPT/REWORK 时 `scope.status !== "FROZEN"` | 将 audit contract 的 `scope.status` 改为 `FROZEN`（不是 scope-lock 文件的 `scope.status`） |
| `FREEZE_AFTER_SWEEP` | `scope.frozen_at > sweep.completed_at` | 确保 freeze 在 sweep 之前完成；若时间戳写错，修正 `frozen_at` |
| `VERDICT_STATE_TIME_INVALID` | `verdict_state.captured_at < sweep.completed_at` | 重新捕获 verdict-state receipt，确保在 sweep 完成后 |
| `PRE_CHANGE_TIME_INVALID` | `pre_change.captured_at > sweep.completed_at` | 确保 pre-change receipt 在 sweep 完成前捕获；使用 `capture-state.ts --freeze` 可原子化设置 frozen_at 并捕获 pre-change |
| `STATIC_NEGATIVE_CONTRACT` | STATIC req 的 `applicability !== "NOT_APPLICABLE_STATIC"` 或 command/method/expected/observed 非 "N/A" | 改 `applicability` 为 `NOT_APPLICABLE_STATIC`，其他 4 字段全为 `"N/A"` |
| `INVALID_PLAN_ITEM_ID` | `plan_item_id` 不匹配 `^PLAN-REQ-\d{3}$` | 改为 `PLAN-REQ-001` 格式（3 位数字，无 phase 前缀） |
| `EVIDENCE_RECEIPT_PAYLOAD_MISMATCH` | contract ledger 与 receipt 文件 payload 不一致 | 从 receipt 文件逐字符复制所有字段到 contract ledger，禁止修剪重定向/空格 |
| `DOWNGRADE_DECLARATION_REQUIRED` | `provenance_level=v2.1-required` 且 `evidence_ceiling=component` 但 `downgrade_declaration=null` | 填写 `downgrade_declaration` 对象（含 4 项：降级理由、降级后上限、不影响范围、影响范围） |
| `GIT_HEAD_MISMATCH` | `baseline.commit` 与 `git -C <repository_root> rev-parse HEAD` 不一致 | 用 `repository_root` 仓库的 HEAD，不是 `workspace_root` 的 |
| `DIRTY_PATH_SET_MISMATCH` | `baseline.dirty_paths` 与 `git -C <repository_root> status --porcelain` 不一致 | 用 `repository_root` 仓库的 git status 输出 |
| `PLAN_REGISTRY_MISSING` | scope-lock 文件 `plan_registry` 为空或缺失 | 填写 `plan_registry` 数组，每项含 `plan_item_id`、`disposition`、`requirement_id`、`source` |
| `PLAN_REGISTRY_REQUIREMENT_MISMATCH` | plan_registry 的 `requirement_id` 或 `source` 与 `requirements[]` 对应项不一致 | 确保 plan_registry 的 `requirement_id` 和 `source` 与 requirements 对应项相同（kind/behavior 等不再重复） |
| `PRE_CHANGE_HEAD_MISMATCH` | pre-change receipt 的 `head` 与 `baseline.implementation_base_commit` 不一致 | 用 `capture-state.ts --repository-root <X>` 重新捕获，X 必须与 audit contract 的 `repository_root` 一致 |
| `PRE_CHANGE_PHASE_MISMATCH` | pre-change receipt 的 `phase_id` 与 `scope_lock.lock_id` 不一致 | `capture-state.ts --phase-id` 必须传 scope-lock 的 `lock_id` 值（不是 phase 简称），重做 receipt |
| `VERDICT_STATE_HEAD_MISMATCH` | verdict-state receipt 的 `head` 与 `baseline.commit` 不一致 | 同上 |
| `VERDICT_STATE_PHASE_MISMATCH` | verdict-state receipt 的 `phase_id` 与 `scope_lock.lock_id` 不一致 | 同 `PRE_CHANGE_PHASE_MISMATCH`，verdict-state 也用 `lock_id` 作 `--phase-id` |
| `SCOPE_LOCK_NOT_HUMAN_APPROVED` | scope-lock 文件 `approval.status !== "APPROVED"` 或 `actor_type !== "HUMAN"` | 填写 `approval` 对象，`status: "APPROVED"`、`actor_type: "HUMAN"` |
| `RECEIPT_EXIT_OBSERVATION_MISMATCH` | `observed: "PASS"` 但 `exit_code !== 0`，或 `observed: "FAIL"` 但 `exit_code === 0` | 检查 receipt 的 exit_code 与 observed 是否一致；若 command 实际 exit 0 但填了 FAIL，修正 observed 为 PASS |
| `REWORK_FINDING_SET_MISMATCH` | REWORK 时 `rework_package.finding_ids` 与 open blockers 不完全相等 | 将所有 open blocker 的 finding_id 列入 `rework_package.finding_ids`，不能多也不能少 |

## Deterministic closure rules

`ACCEPT` is legal only when all are true:

- baseline head at verdict equals the audited commit;
- scope is frozen and the full sweep is complete;
- every in-scope requirement is `PASS`;
- every behavioral negative control was observed `FAIL`;
- the approved registry covers every plan item exactly once;
- pre-change and verdict-state receipts prove the implementation delta contains
  only approved paths;
- every control receipt and output artifact exists, matches its hash, and is
  bound to the current verdict state;
- every blocking finding is `CLOSED`;
- unclassified finding count is zero;
- no unresolved required evidence remains;
- the validator exits `0`.

`REWORK` is legal only when the sweep is complete and the frozen package is an
exact set match for all open blocking findings. `BLOCKED` and `INVALID` must not
smuggle recommendations into an actionable package.

## Loop-breaker policy

Each generation has one terminal verdict. A `REWORK` is not permission for a
fresh audit scope: the next generation must first close or block every previous
finding. A newly discovered pre-existing defect is an `AUDIT_MISS`, requires
human-approved reopen evidence, and records the audit's added time/token cost.
Without that approval it remains debt/out of scope; it cannot silently become
another mandatory rework. Real patch regressions and safety/data-loss findings
may reopen scope, but must carry causal proof and a complete affected resweep.

This prevents automatic goalpost movement; it does not claim that unknown bugs
cannot exist or that a JSON receipt cryptographically proves who ran a command.
Human scope approval and trusted execution-runner provenance remain explicit
trust boundaries.

## Composition boundaries

| Skill | Use it for | Do not duplicate here |
|---|---|---|
| `pre-flight-enforcement` | execution order, evidence lines, text-write gate | generic process enforcement |
| `opencode-framework-dev` | work-one CodeGraph/DB/serve domain truth | framework snapshots and commands |
| `test-specification-execution` | adversarial and runtime test execution | fuzz/mutation engine details |
| `deterministic-implementation-planning` | turn an approved audit into implementation phases | plan authoring |
| `logs-governance` | maintain `logs/INDEX.md` | logs indexing |

## Anti-loop self-check

Before returning a verdict, answer with evidence:

1. Did I finish the whole frozen scope or stop after the first defect?
2. Which deliberately bad fixture proves each behavioral test can fail?
3. Does the rework package exactly equal all open blockers?
4. Did I add any criterion after implementation began without a reopen record?
5. Is a new item a regression, an audit miss, debt, or out of scope?
6. What exact condition ends this audit generation?
7. Do the external CLI checks prove registry coverage, state provenance,
   receipt/artifact hashes, and previous-blocker continuity?

If any answer is missing, the audit is `INVALID`.
