# Provenance 流程约定（P-01 ~ P-07）

> **定位**：本文件是 QoderWork 工作区审计与实施 provenance 规则的**唯一正本**，2026-07-25 自 `AGENTS.md` §15 迁移至此（`AGENTS.md` §15 现仅存规则索引与强制触发语）。
> **强制触发**：实施或审计任何 plan 的任何 phase 前，必须先阅读本文件；未读即开始视为流程违规。

本文件规则适用于 QoderWork 工作区内所有 plan 的所有 phase 实施与审计，无例外。规则采用四要素结构：约束主体 + 触发条件 + 违反判定 + 违反后果。强约束关键词遵循 RFC 2119 语义：必须（MUST）、禁止（MUST NOT）、当且仅当（IF AND ONLY IF）、不得（MUST NOT）。

**2026-07-28 v3 升级注**：原 `v2.1-required` 已升级为 `v3-required`，原 `boundary-contract/v1` 已迁移至 `audit-boundary-matrix/v3`（详见 `phase-04-scope-lock.yaml`、`phase-05-scope-lock.yaml` 的 `v3-required` 声明）。本文件中 `v2.1` 字面保留作为历史引用，但实际生效集合为 `{v3-required, component-only}`。

## 规则 P-01：Provenance 级别声明（前置条件）

- **约束主体**：每个 plan 的索引文件（`00-plan-index.md` 或等价文件）
- **触发条件**：plan 创建时
- **规则**：plan 索引必须声明 `provenance_level`，取值限定为 `v3-required` 或 `component-only`，二者必居其一。未声明的 plan，实施禁止开始。
- **违反判定**：plan 索引中无 `provenance_level` 字段，或取值不在 `{v3-required, component-only}` 集合内
- **违反后果**：实施者必须暂停，补声明后方可继续

## 规则 P-02：Pre-Implementation Freeze Gate（实施前冻结）

- **约束主体**：实施者（任何开始 phase 实施的 agent）
- **触发条件**：`provenance_level = v3-required` 的 plan 的任何 phase，在实施代码写入之前
- **规则**：实施者必须按以下顺序完成 Freeze Gate，且禁止跳步：
  1. 审计者填写 `scope-lock.json`（覆盖本 phase 的 REQ/Check Registry/oracle）
  1.5. **Pre-Audit Knowledge Required（v1 PHASE-01 implementer MUST）**：在 v1 PHASE-01 实施者写入任何 audit-report / scope-lock / EV receipt 内容之前，agent **MUST** 完整读取以下 5 个文件，把每个文件的 path、line count、sha256、读取时间戳记录到 `logs/<YYYY-MM-DD>-pre-audit-read-<implementer-task-id>.md`：
     - `.agents/skills/plan-audit-archiver/scripts/validate-audit.ts`（acceptance oracle）
     - `.agents/skills/plan-audit-archiver/scripts/pre-check-evidence.ts`（gate-1 pre-check oracle）
     - `.agents/skills/plan-audit-archiver/templates/scope-lock-template.json`（canonical scope-lock 字段 shape）
     - `.agents/skills/plan-audit-archiver/templates/audit-report-template.md`（canonical report shape）
     - `.agents/skills/plan-audit-archiver/templates/evidence-receipt-template.json`（canonical receipt shape）
     把前序 phase 的 scope-lock 或 audit-report 当作模板替代读取 = 流程违规。读取必须发生在第一次 audit-report 写入**之前**（一次性，不可后补）。SKILL.md L149-173 的 `Pre-Audit Knowledge Required [ANALYSIS]` 段是唯一权威描述。
  2. Human reviewer 批准 `scope-lock.json`（agent 不得自批准）
  3. 运行 `capture-state.ts` 捕获 pre-change receipt，输出到 `audits/<plan-name>/evidence/pre-change-<PHASE-N>.json`；`--repository-root` 必须按 P-07 取干净锚点仓库（work-one），禁止填审计工作区或当前 worktree
  4. 验证 receipt 存在且非空（`test -s` + 内容断言）
- **违反判定**：实施已开始但 `evidence/pre-change-<PHASE-N>.json` 不存在或为空；或 v1 PHASE-01 实施者未按 step 1.5 完成 Pre-Audit Knowledge 读取 + 留痕
- **违反后果**：审计必须判定为 `INVALID`（不是 BLOCKED），因为实施流程违规导致审计合同无效

## 规则 P-02A：依赖 phase progression admission

- **约束主体**：实施者与 Freeze Gate 审批前检查者
- **触发条件**：`provenance_level = v3-required` 的 plan 准备为下一个 phase 填写或提交 `scope-lock.json` 进行 human approval
- **规则**：必须先运行 `validate-phase-progression.ts <plan-dir> <next-phase-id>`。validator 必须确认所有直接与传递依赖 phase 的签署 `ACCEPT` audit、phase ID、可读 progression receipt 与其哈希、completion checkbox、phase `Progression status`、manifest `Status`、顶层派生 `Status` 以及 next phase 的 `Starting state and dependency` 一致。exit 0 是提交 human approval 的前置条件。
- **违反判定**：任一状态缺失/非法/重复、receipt 缺失或哈希不匹配、audit 非 `ACCEPT`、completion gate 与状态不一致、依赖未 `ACCEPTED` 或顶层状态无法由 manifest 派生
- **违反后果**：Freeze Gate 判为 `INVALID`，禁止进入 human approval；不得使用 `--force`、手工 `ACCEPTED` 或只更新 manifest 的旁路。`pre-flight-enforcement` 只能约束本次步骤顺序，不替代该 admission validator 或写入跨 phase 状态。

## 规则 P-03：工具链强制（审计执行）

- **约束主体**：审计者（使用 plan-audit-archiver skill 的 agent）
- **触发条件**：`provenance_level = v3-required` 的 plan 的审计执行
- **规则**：
  1. 每个 `[VERIFICATION]` 步骤必须调用 `capture-state.ts` 生成 immutable receipt（EV-NNN），receipt 必须绑定 `audit_id`/`requirement_id`/`polarity`/`oracle_id`/`fixture_id`/`command`/`exit_code`/`observed_result`/`artifact_hashes`
  2. `Verified-by:` 文字证据行仅作为 receipt 的人类可读摘要，禁止替代 receipt
  3. 审计报告签署前必须运行 `validate-audit.ts`，`exit 0` 是签署 `ACCEPT` 或 `REWORK` 的必要条件
- **违反判定**：审计报告声明 v3 ACCEPT 但无对应 EV-NNN receipt；或 `validate-audit.ts` 未运行；或 `validate-audit.ts` exit 非 0
- **违反后果**：审计报告不可签署；已签署的判定为 `INVALID`

## 规则 P-04：BLOCKED 继承（审计连续性）

- **约束主体**：审计者
- **触发条件**：前序审计报告中存在 `BLOCKED` 项
- **规则**：后续审计必须对每个前序 `BLOCKED` 项显式处理，处理方式限定为三种之一：
  - `CLOSED`：已解决，附 receipt 证据
  - `INHERITED`：继承，附继承理由与计划解决时机
  - `REOPENED`：重新打开，附新证据
- **违反判定**：后续审计报告中未出现对前序 `BLOCKED` 项的显式处理记录
- **违反后果**：审计报告判定为 `INVALID`（静默绕过 = 审计合同无效）

## 规则 P-05：降级声明（标准一致性）

- **约束主体**：审计者
- **触发条件**：审计者选择的证据标准低于 plan 声明的 `provenance_level`（如 plan 声明 `v3-required` 但审计者用 component 级证据签署）
- **规则**：审计者必须在审计报告 §1 开头显式声明降级，声明内容必须包含以下 4 项，缺一不可：
  1. 降级理由（具体、可验证）
  2. 降级后的证据上限
  3. 降级不影响的结论范围
  4. 降级影响的结论范围（如有）
- **违反判定**：审计报告用低于 plan 声明标准的证据签署 ACCEPT，但 §1 无降级声明，或降级声明缺少上述 4 项中的任一项
- **违反后果**：审计报告判定为 `INVALID`

## 规则 P-06：component-only plan 的证据标注

- **约束主体**：审计者
- **触发条件**：`provenance_level = component-only` 的 plan 的审计
- **规则**：审计报告必须在 §1 显式标注「证据上限：component」，且禁止签署 v3 正式 ACCEPT
- **违反判定**：component-only plan 的审计报告签署 v3 ACCEPT，或未标注证据上限
- **违反后果**：审计报告判定为 `INVALID`

## 规则 P-07：repository_root 干净锚点（worktree 感知）

- **约束主体**：计划作者 + 实施者
- **触发条件**：任何 plan 的 Fixed verification 命令含 `capture-state.ts --repository-root` 或 `generate-evidence-receipt.ts --repository-root`
- **规则**：`--repository-root` 必须（MUST）指向干净锚点仓库（默认 work-one：`${WORK_ONE_ROOT}`）；禁止（MUST NOT）指向审计工作区（qoderwork 主仓 `${QODERWORK_ROOT}` 或其任何 `.worktrees/*` worktree）。原因：validator（`validate-audit.ts` L1190-1197）将 pre-change receipt 的 `status_entries` 与审计时 `repository_root` 的实时 git status 做对称差，差集中不在 `repository_scope.allowed_paths` 内的路径触发 `DIRTY_PATH_OUTSIDE_SCOPE`；validator 对 `audits/`、`logs/`、`evidence/` 等审计基建路径无豁免。若 `repository_root` 指向审计工作区，审计基建文件（报告、EV receipts、verdict-state、LATEST.md、日志）全部落入差集，审计不可行。实施范围由 scope-lock 的 `repository_scope.allowed_paths` / `forbidden_paths` 控制，与 `repository_root` 职责不同。在 qoderwork worktree（如 `.worktrees/check-plan`）中实施 qoderwork 工具代码时，`workspace_root` 是该 worktree 路径，`repository_root` 仍是 work-one。
- **违反判定**：plan 的 Fixed verification 中 `--repository-root` 指向 qoderwork 主仓或其 worktree
- **违反后果**：pre-change receipt 无法通过 `validate-audit.ts`，审计判定为 `INVALID`
