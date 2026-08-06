# task-lens-m1 plan + blueprint 合规更新 Inventory(只调查,无 verdict)

**Date**: 2026-08-05
**Mode**: 双重独立审核(只调查,不出 verdict,不写源文件)
**Reviewer 1**: high-precision subagent(`agent_c182793b-...`)— 深度字段表 + 模板对齐
**Reviewer 2**: 主会话(原计划派遣 general-purpose,因 rate-limit 由主会话顶替)— 广度 cross-section sweep
**Scope**: `plans/task-lens-m1/00-plan-index.md` + `blueprints/blueprint-task-lens-m1.md` + 跨章节引用 + 规则/模板/validator 源码

**严格边界**:本记录**只列举事实和字段表**,不对"如何走"作推荐。所有"期望合规值"列给出可选值集合,不构成路径选择。所有"是否冲突"标注意基于字面值差异,不判定哪一方正确。实际执行前必须由主会话或用户裁决具体路径。

---

## 1. 实测 plan-index 字段清单(当前)

Verified-by: `sed -n '1,20p' plans/task-lens-m1/00-plan-index.md` + `grep -n "Schema version\|Document kind\|Canonical\|Approval" plans/task-lens-m1/00-plan-index.md`(空)

| # | 字段 | 当前值 | 行号 | 来源 |
|---|---|---|---|---|
| 1 | `Plan mode` | `PLAN_SET` | L3 | 现有 |
| 2 | `ID` | `TASK-LENS-M1-PLANSET-20260723` | L4 | 现有 |
| 3 | `Status` | `READY-FOR-IMPLEMENTATION` | L5 | 现有 |
| 4 | `Progression schema` | `phase-progression/v1` | L6 | 现有 |
| 5 | `Only implementation path` | 按 PHASE-01 至 PHASE-07 顺序;gate 失败即停止 | L7 | 现有 |
| 6 | `Evidence ceiling` | `component` | L8 | 现有 |
| 7 | `Provenance level` | `v2.1-required` | L9 | 现有 |
| 8 | `Schema version` | (缺失) | — | 缺失 |
| 9 | `Document kind` | (缺失) | — | 缺失 |
| 10 | `Canonical contract` | (缺失) | — | 缺失 |
| 11 | `Canonical contract SHA-256` | (缺失) | — | 缺失 |
| 12 | `Approval decision` | (缺失) | — | 缺失 |
| 13 | `Approval decision SHA-256` | (缺失) | — | 缺失 |

---

## 2. v3 PLAN_SET 必需字段(从 validator 源码反推)

Verified-by: `sed -n '1,200p' .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts`

| v3 必需字段 | 期望值/枚举 | validator 拒绝条件 | plan-index 当前是否满足 |
|---|---|---|---|
| `Plan mode` | `PLAN_SET` | L65 ERR_PLAN_SCHEMA_UNSUPPORTED | ✓ |
| `Schema version` | `audit-plan-set/v3` | L66-70 ERR_PLAN_SCHEMA_UNSUPPORTED via parseV3Document | ✗(缺失) |
| `Document kind` | `plan-set-index` | 同上 | ✗(缺失) |
| `Canonical contract` | 相对路径 | L72 ERR_APPROVAL_MISSING;L83 ERR_APPROVAL_BINDING(file-not-found) | ✗(缺失 + 文件不存在) |
| `Canonical contract SHA-256` | 64-hex | L80-81 ERR_APPROVAL_BINDING(hash mismatch) | ✗(缺失) |
| `Approval decision` | 相对路径 | L74/L84 ERR_APPROVAL_MISSING | ✗(缺失 + 文件不存在) |
| `Approval decision SHA-256` | 64-hex | L82 ERR_APPROVAL_BINDING | ✗(缺失) |
| `approval.decision` | `APPROVED` | L99 ERR_APPROVAL_MISSING | ✗(approval 文件不存在) |
| `approval.approved_by` | `HUMAN_USER` | L99 ERR_APPROVAL_MISSING | ✗(同) |
| `approval.schema_version` | `audit-governance-approval/v3` | L96-97 ERR_APPROVAL_MISSING | ✗(同) |
| `approval.document_kind` | `approval-decision` | 同上 | ✗(同) |
| `approval.approved_artifacts` | 绑定 canonical path+hash | L104-111 ERR_APPROVAL_BINDING | ✗(同) |
| `canonical.schema_version` | `audit-governance/v3` | L87-88 ERR_PLAN_SCHEMA_UNSUPPORTED | ✗(canonical 文件不存在) |
| `canonical.document_kind` | `canonical-requirements` | 同上 | ✗(同) |
| `99-final-verification.md` | 文件存在 | L58 ERR_PLAN_SCHEMA_UNSUPPORTED | ✓ |

实测:`ls plans/task-lens-m1/*.yaml` → No such file;`ls plans/task-lens-m1/canonical-requirements-contract.yaml` → No such file;`ls audits/task-lens-m1/approval-decision.json` → No such file。

先例参照:`plans/path-dynamic-resolution-m1/canonical-requirements-contract.yaml` 存在;`audits/path-dynamic-resolution-m1/approval-decision.json` 存在。

---

## 3. outcome-governance/v1 合同模板字段(全 9 模板)

Verified-by: `ls .agents/skills/outcome-governance/templates/` + `cat .agents/skills/outcome-governance/templates/*.json`

模板目录有 9 个 JSON 模板:`contract.json` / `acceptance-spec.json` / `test-bundle.json` / `approval.json` / `amendment.json` / `ledger-event.json` / `run-receipt.json` / `run-result.json` / `environment-manifest.json`。

### 3.1 contract.json 关键字段

- `schema_version`: `outcome-governance/v1`
- `document_kind`: `outcome-contract`
- `contract_id` / `outcome_id` / `generation`(≥1)/ `created_at`
- `target[]` / `boundary.in_scope[]` / `boundary.out_of_scope[]`
- `baseline.repository_id` / `baseline.baseline_tree_sha256` / `baseline.configuration_sha256`
- `side_effect_boundary.allowed[]` / `side_effect_boundary.prohibited[]`
- `acceptance_strategy.objective/boundary/acceptance`
- `acceptance_spec.{id, path, generation}`
- `supersedes`(object 或 null)

### 3.2 acceptance-spec.json 关键字段

- `schema_version: outcome-governance/v1` / `document_kind: acceptance-spec`
- `spec_id` / `outcome_id` / `generation`
- `contract` / `requirements[]` / `oracles[]` / `cases[]`(每 case 含固定 `test_id`)
- `test_bundle.{id, path, generation, sha256}`

### 3.3 test-bundle.json 关键字段

- `schema_version: outcome-test-bundle/v1` / `document_kind: outcome-test-bundle`
- `bundle_id` / `outcome_id` / `generation`
- `tests[]` / `fixtures[]` / `oracle_sources[]` / `runner_config[]` / `lockfiles[]`(均 `{path, sha256}[]`)
- `expected_test_ids[]` / `expected_test_count`

### 3.4 approval.json 关键字段

- `schema_version: outcome-governance/v1` / `document_kind: outcome-approval`
- `approval_id` / `outcome_id` / `generation`
- `contract` / `acceptance_spec` / `test_bundle`(各 `{id, path, sha256, generation}`)
- `amendment`(object 或 null)
- `approval.{status: APPROVED, actor_type: HUMAN, approved_by, principal_id, trust_domain, approved_at, evidence}`
- `weakening_approval`(object 或 null)

先例参照:`plans/path-dynamic-resolution-outcome-v1/` 下 4 件套全存在,`outcome-approval.json` 显示 ChoGeer 2026-08-03 APPROVED。

---

## 4. blueprint 自身四字段元数据

Verified-by: `sed -n '1,20p' blueprints/blueprint-task-lens-m1.md` + blueprint-creation SKILL.md L264-267/L329-331/L333

| 字段 | 当前值 | 行号 | 规则要求 |
|---|---|---|---|
| `创建日期` | 2026-07-23 | L2 | 强制(头部自述写作日) |
| `更新日期` | 2026-07-28 | L3 | 强制(头部/内容最后变更日) |
| `状态` | 实施中 | L5 | 强制(七值之一) |
| `相关蓝图` | 无 | L6 | 强制(无因果边写 `无`) |
| `版本` | 0.1.5 | L7 | 项目惯例 |
| `日期` | 2026-07-23 | L8 | 项目惯例(冗余于 创建日期) |
| `原状态(PHASE-03 前自述)` | 设计返工已收口,待实施计划冻结 | L9 | 项目惯例 |
| `优先级` | P1 | L10 | 项目惯例 |

**关键约束**(blueprint-creation SKILL.md L331 + L373):蓝图**进入首个 plan 冻结契约后,头部四字段冻结**;状态/边变更**只投影到 INDEX,不回写文件**;违反 modification-ban 会破坏冻结 provenance 链,审计判定 `INVALID`。

实测 blueprint-task-lens-m1 已被 PHASE-01 scope-lock 锁定(audits/task-lens-m1/scope-lock-PHASE-01.json 实测存在且 FROZEN)→ **头部四字段已冻结**。

---

## 5. blueprint INDEX 状态字段

Verified-by: `sed -n '25,35p' blueprints/INDEX.md`

`blueprints/INDEX.md` L28:
- 状态: `实施中`
- truth-source pointer: `audits/task-lens-m1/LATEST.md`
- 日期依据: `2026-07-28(PHASE-03 头部纠正)`
- 备注: `PHASE-03 过期头部已纠正(实施中;依 audits/task-lens-m1/LATEST.md PHASE-05 ACCEPTED)`

---

## 6. plan-index vs blueprint 字段不一致清单(只列不判)

| 概念 | plan-index(行号) | blueprint(行号) | 状态 |
|---|---|---|---|
| 顶层 Status | `READY-FOR-IMPLEMENTATION`(L5) | `实施中`(L5) | 表述不一致(英文枚举 vs 七值中文);语义上 PHASE-01~05 ACCEPTED + PHASE-06/07 未完成,`实施中` 更贴近现状 |
| Provenance level | `v2.1-required`(L9) | (正文 L302/L394 教学) | 一致(均 v2.1),均与 provenance-rules L13-14 升级声明冲突 |
| 阶段进度 | plan-index L131 PHASE-05=`NOT_STARTED`,L132 PHASE-06=`BLOCKED` | blueprint L5 `实施中`(不细到 phase) | 不直接冲突,但 plan-index L131 与 LATEST.md L3 冲突(见 §10) |
| Evidence ceiling | `component`(plan-index L8) | (blueprint L394 教学) | 表述不一致:plan-index 实际值 `component` 与 blueprint L394 "M1 以 integration 为硬闸门"不同 |
| 顶层/正文 status 隔离 | plan-index L5 顶层 | blueprint 头部 L5 已被冻结(§4 约束) | 不同治理路径:plan-index 顶层可改;blueprint 头部**禁止**改写(只投影 INDEX) |

---

## 7. 跨章节引用图谱(广度 sweep)

Verified-by: `grep -rln "task-lens-m1\|TASK-LENS-M1\|blueprint-task-lens"` 2>/dev/null | sort -u | wc -l → **94 文件**

### 7.1 引用类别分组

| 类别 | 文件数 | 示例 |
|---|---|---|
| INDEX/总览类 | 3 | `blueprints/INDEX.md` L28;`documents/INDEX.md` L46/L49/L50/L84;`logs/INDEX.md` L22/L23/L49/L51/L65/L67/L68 |
| handoff 交接 | 2 | `handoff/2026-07-25-task-lens-phase05-g2-blocked.md`(15+ 行);`handoff/task-lens-resume.md` L5/L97 |
| 其他 plan 引用 | 3 | `plans/audit-governance-evidence-and-status-closure/00-plan-index.md`;`plans/audit-governance-evidence-and-status-closure/01-phase-plan-gate-semantics.md`;`plans/blueprints-governance/formal-plan-set/03-phase-header-backfill.md` |
| audits 引用 | 大量(>50) | `audits/task-lens-m1/...` 自身 + 跨 audit 引用(closure/blueprints-governance/path-dynamic-resolution 等) |
| evidence/sha256 锁定 | 2 | `audits/audit-governance-recovery-v1/objects/sha256/978e2ee0...`;`.../a8e55e23...` |
| skill 内部 | 1 | `.agents/skills/deterministic-implementation-planning/legacy-boundary-contract-exemptions.json` |
| task-lens 自身 | 9 | `plans/task-lens-m1/*.md` + 自身 LATEST + 5 个 audit + evidence/PHASE-XX-G1/ |

### 7.2 关键引用位置

| 文件:行 | 当前表述 | 类别 |
|---|---|---|
| `documents/INDEX.md` L46 | 「v2.1-required Freeze Gate...尚未实施」 | 描述 |
| `documents/INDEX.md` L49 | handoff 描述 | 描述 |
| `documents/INDEX.md` L50 | plan-index 描述 | 描述 |
| `documents/INDEX.md` L84 | 阅读路径 | 索引 |
| `blueprints/INDEX.md` L28 | 状态=实施中,truth-source=LATEST.md | 看板登记 |
| `blueprints/INDEX.md` L81 | PHASE-03 完成清单中"task-lens-m1 → 实施中" | 历史决策 |
| `blueprints/blueprint-task-lens-m1.md` L302/L394 | 教学段「声明 `provenance_level: v2.1-required`」 | 蓝图正文 |
| `handoff/task-lens-resume.md` L97 | 续接指令「声明 `provenance_level: v2.1-required`」 | active 指引 |
| `handoff/2026-07-25-task-lens-phase05-g2-blocked.md` 全文 | PHASE-05 G2 BLOCKED 交接 | 治理层权威 |
| `audits/task-lens-m1/LATEST.md` L3/L6/L7/L9/L11 | 唯一真相源 | 状态真相 |
| `plans/task-lens-m1/00-plan-index.md` L11-L13 | 来源 ledger | plan 来源 |
| `plans/task-lens-m1/05-phase-metrics-feedback.md` L13 | 引用 G2 scope-lock(0 bytes) | plan 内部 |

---

## 8. 模板对齐表

| 模板 | 路径 | task-lens-m1 实测 | 先例 path-dynamic-resolution-m1 |
|---|---|---|---|
| scope-lock v3 模板 | `.agents/skills/plan-audit-archiver/templates/scope-lock-template.json`(`schema_version: audit-scope-lock/v3`) | 6 个 scope-lock 全部 `schema_version: 1.0`,`provenance_level: v2.1-required` | 同样 1.0/v2.1 |
| outcome-contract 模板 | `.agents/skills/outcome-governance/templates/contract.json` | `audits/task-lens-m1/contract.json` 不存在 | `plans/path-dynamic-resolution-outcome-v1/outcome-contract.json` 存在 |
| acceptance-spec 模板 | `.agents/skills/outcome-governance/templates/acceptance-spec.json` | `audits/task-lens-m1/acceptance-spec.json` 不存在 | `plans/path-dynamic-resolution-outcome-v1/acceptance-spec.json` 存在 |
| test-bundle 模板 | `.agents/skills/outcome-governance/templates/test-bundle.json` | `audits/task-lens-m1/test-bundle.json` 不存在 | `plans/path-dynamic-resolution-outcome-v1/outcome-test-bundle.json` 存在 |
| approval 模板 | `.agents/skills/outcome-governance/templates/approval.json` | `audits/task-lens-m1/approval-decision.json` 不存在 | `plans/path-dynamic-resolution-outcome-v1/outcome-approval.json` 存在 |
| canonical 合同(v3) | (路径隐含) | `plans/task-lens-m1/canonical-requirements-contract.yaml` 不存在 | `plans/path-dynamic-resolution-m1/canonical-requirements-contract.yaml` 存在 |
| approval-decision(v3) | (路径隐含) | `audits/task-lens-m1/approval-decision.json` 不存在 | `audits/path-dynamic-resolution-m1/approval-decision.json` 存在 |

---

## 9. AGENTS.md L531 保护范围(不可改)清单

Verified-by: `sed -n '515,550p' AGENTS.md` L531 原文:"P-01~P-07 规则全文已迁移至 `.agents/skills/plan-audit-archiver/provenance-rules.md`(唯一正本),仅约束上述 legacy plan,**历史 audit、scope-lock、receipt 和报告不得为迁移而改写**。"

| 受保护 | 路径 | 数量 |
|---|---|---|
| 5 份 audit 报告 | `audits/task-lens-m1/2026-07-24-phase-{01,02,03,04,05}-*.md` | 5 |
| 6 份 scope-lock | `audits/task-lens-m1/scope-lock-PHASE-{01,02,03,04,05}{,-amendment-20260725}.json` | 6 |
| 1 份空文件 scope-lock | `audits/task-lens-m1/scope-lock-PHASE-05-G2.json`(0 bytes,**边界情况**:不算"已签字历史",需用户裁决) | 1 |
| 多份 pre-change/verdict-state/EV receipts | `audits/task-lens-m1/evidence/**/*.json` | >10 |
| 1 份 LATEST.md(边界) | `audits/task-lens-m1/LATEST.md` | 1(L531 未明确列举,需主会话裁决) |

---

## 10. PHASE-05 状态分裂事实清单(只列不判)

| 文件:行 | 字面值 | 是否与 LATEST.md 一致 |
|---|---|---|
| `plans/task-lens-m1/00-plan-index.md` L131 | PHASE-05=`NOT_STARTED` | ✗(LATEST 说 ACCEPTED) |
| `plans/task-lens-m1/00-plan-index.md` L132 | PHASE-06=`BLOCKED` | ✗(LATEST 说 NOT_STARTED) |
| `plans/task-lens-m1/05-phase-metrics-feedback.md` L7 | Progression status=`NOT_STARTED` | ✗(LATEST 说 ACCEPTED) |
| `audits/task-lens-m1/LATEST.md` L3 | PHASE-05 ACCEPTED → PHASE-06 NOT_STARTED | (真相源声明) |
| `audits/task-lens-m1/LATEST.md` L11 | Verdict: ACCEPT(v2.1-required) | (真相源声明) |
| `audits/task-lens-m1/2026-07-24-phase-05-audit.md` L266/L388 | verdict=ACCEPT | ✗(与 plan-index L131 冲突) |
| `audits/task-lens-m1/2026-07-24-phase-05-audit.md` L396 | validate-audit valid=false(降级声明) | 降级 ACCEPT |
| `plans/task-lens-m1/99-final-verification.md` L4 | Current status=`NOT-RUN` | ✗(LATEST 主体进程已到 PHASE-05 ACCEPTED) |
| `plans/task-lens-m1/99-final-verification.md` L14 | integration level Current status=`NOT-RUN` | 同上 |
| `handoff/2026-07-25-task-lens-phase05-g2-blocked.md` L90 | G1 audit/LATEST 不可信;G2 未创建 | ✗(与 LATEST ACCEPTED 冲突) |
| `handoff/2026-07-25-task-lens-phase05-g2-blocked.md` L91 | 不得将 LATEST 当放行依据 | (治理层权威) |
| `audits/task-lens-m1/scope-lock-PHASE-05-G2.json` | 0 bytes 空文件 | ✗(PHASE-05 L13 要求) |

---

## 11. 合规更新 inventory(只列字段,不选路径)

> 表中"期望值"列给可选值集合,不构成路径选择。

| # | 文件 | 位置/字段 | 当前值 | 期望范围(可选) | 规则依据 |
|---|---|---|---|---|---|
| 1 | `plans/task-lens-m1/00-plan-index.md` | L9 `Provenance level` | `v2.1-required` | `v3-required` 或 `component-only` | `provenance-rules.md` L17-21(P-01);`AGENTS.md` L524/L527 |
| 2 | `plans/task-lens-m1/00-plan-index.md` | 头部缺 `Schema version` | 缺失 | `audit-plan-set/v3` | `validate-plan.ts` L66-70 |
| 3 | `plans/task-lens-m1/00-plan-index.md` | 头部缺 `Document kind` | 缺失 | `plan-set-index` | 同上 |
| 4 | `plans/task-lens-m1/00-plan-index.md` | 头部缺 `Canonical contract` | 缺失 | 相对路径 | `validate-plan.ts` L72 |
| 5 | `plans/task-lens-m1/00-plan-index.md` | 头部缺 `Canonical contract SHA-256` | 缺失 | 64-hex | L73 |
| 6 | `plans/task-lens-m1/00-plan-index.md` | 头部缺 `Approval decision` | 缺失 | 相对路径 | L74 |
| 7 | `plans/task-lens-m1/00-plan-index.md` | 头部缺 `Approval decision SHA-256` | 缺失 | 64-hex | L75 |
| 8 | `plans/task-lens-m1/canonical-requirements-contract.yaml` | 整个文件 | 缺失 | 需存在,`schema_version: audit-governance/v3`,`document_kind: canonical-requirements` | `validate-plan.ts` L87-88 |
| 9 | `audits/task-lens-m1/approval-decision.json` | 整个文件 | 缺失 | 需存在,`schema_version: audit-governance-approval/v3`,`document_kind: approval-decision`,`decision: APPROVED`,`approved_by: HUMAN_USER`,`approved_artifacts` 绑定 canonical | `validate-plan.ts` L96-111 |
| 10 | `plans/task-lens-m1/00-plan-index.md` | L131 PHASE-05 Status | `NOT_STARTED` | 与 LATEST/audit 实际 verdict 一致的可选值(由主会话裁决 LATEST vs handoff 哪个为准) | `provenance-rules.md` P-02A;`blueprint-creation SKILL.md` L333 |
| 11 | `plans/task-lens-m1/00-plan-index.md` | L132 PHASE-06 Status | `BLOCKED` | 若 PHASE-05 已 ACCEPTED,可选 `NOT_STARTED` 或保持 `BLOCKED`(由主会话裁决) | P-02A |
| 12 | `plans/task-lens-m1/05-phase-metrics-feedback.md` | L7 Progression status | `NOT_STARTED` | 与 LATEST/audit 实际 verdict 一致 | P-02A |
| 13 | `plans/task-lens-m1/00-plan-index.md` | L5 顶层 Status | `READY-FOR-IMPLEMENTATION` | 与 manifest 派生一致的可选值 | P-02A |
| 14 | `plans/task-lens-m1/99-final-verification.md` | L4 Current status | `NOT-RUN` | 与 manifest 派生一致的可选值 | P-02A |
| 15 | `blueprints/blueprint-task-lens-m1.md` | L302(正文)「声明 `provenance_level: v2.1-required`」 | v2.1-required | 与 plan-index 实际值一致 | `provenance-rules.md` L13-14 |
| 16 | `blueprints/blueprint-task-lens-m1.md` | L394(正文)「下游 plan 固定 `provenance_level: v2.1-required`」 | v2.1-required | 与 plan-index 实际值一致 | `provenance-rules.md` L13-14 |
| 17 | `audits/task-lens-m1/scope-lock-PHASE-05-G2.json` | 整个文件 | 0 bytes | 合法 JSON 或修正 PHASE-05 md L13 引用(由主会话裁决) | `provenance-rules.md` P-02 L29-31 |
| 18 | `blueprints/blueprint-task-lens-m1.md` | 头部 L2-L6 四字段 | (冻结) | **不得改写文件**(blueprint-creation SKILL.md L331 冻结快照规则);状态/边变更只投影 INDEX | `blueprint-creation SKILL.md` L331/L373 |
| 19 | `audits/task-lens-m1/scope-lock-PHASE-0{1..5}*.json` | 全部历史 scope-lock | `schema_version: 1.0`, `provenance_level: v2.1-required` | **不得改写**(AGENTS.md L531 历史保护) | `AGENTS.md` L531 |
| 20 | `audits/task-lens-m1/2026-07-24-phase-0{1..5}-*.md` | 5 份 audit 报告 | `schema_version: 2.1` | **不得改写**(AGENTS.md L531) | `AGENTS.md` L531 |
| 21 | `audits/task-lens-m1/evidence/**/*.json` | pre-change / verdict-state / EV receipts | (历史已签字) | **不得改写**(AGENTS.md L531) | `AGENTS.md` L531 |
| 22 | `audits/task-lens-m1/LATEST.md` | 整个文件 | 现状 | L531 未明确列举(需主会话裁决是否可改) | `AGENTS.md` L531 + `blueprint-creation SKILL.md` L333 |

---

## 12. 跨章节引用传播清单

| 引用位置(行号) | 当前表述 | 类别 |
|---|---|---|
| `documents/INDEX.md` L46 | 「v2.1-required Freeze Gate...尚未实施」 | 描述 |
| `handoff/task-lens-resume.md` L97 | 「声明 `provenance_level: v2.1-required`」 | active 指引 |
| `handoff/2026-07-25-task-lens-phase05-g2-blocked.md` L57 | G2 scope-lock 0 bytes 不合规 | 治理层权威 |
| `handoff/2026-07-25-task-lens-phase05-g2-blocked.md` L91 | LATEST 不可作放行依据 | 治理层权威 |
| `blueprints/blueprint-task-lens-m1.md` L302/L394 | 教学段 v2.1 声明 | 正文 |
| `blueprints/INDEX.md` L28 | 状态=实施中,truth-source=LATEST.md | 看板(投影源) |
| `logs/INDEX.md` L22/L23/L49/L51/L65/L67/L68 | 历史日志条目 | 历史记录 |
| `plans/audit-governance-evidence-and-status-closure/00-plan-index.md` L101 等 | forbidden 列表含 `audits/task-lens-m1/**` | 保护性引用 |
| `plans/audit-governance-evidence-and-status-closure/01-phase-plan-gate-semantics.md` L38 | Do not modify `plans/task-lens-m1` | 保护性引用 |
| `plans/blueprints-governance/formal-plan-set/03-phase-header-backfill.md` L6/L47 | stale-header corrections 含 task-lens-m1 | 治理记录 |

---

## 13. 模板与字段名同义/别名清单

| 概念 | plan-index 字段 | blueprint 字段 | 模板字段 | 别名/同义 |
|---|---|---|---|---|
| plan 状态 | `Status` | `状态` | (无对应,plan-set 模板) | `Status` / `状态` / `progression_status` |
| 阶段状态 | phase manifest `Status` 列 | (无) | (无) | `Status` / `Progression status` / `progression_status` |
| Provenance 等级 | `Provenance level` | (正文中描述) | `scope.provenance_level` | `provenance_level` / `Provenance level` |
| Schema 版本 | `Schema version`(缺失) | (无) | `schema_version: audit-plan-set/v3` | `schema_version` / `Schema version` |
| 文档类型 | `Document kind`(缺失) | (无) | `document_kind: plan-set-index` | 同上 |
| canonical 合同 | `Canonical contract` + `SHA-256`(缺失) | (无) | `audit-governance/v3::canonical-requirements` | — |
| approval 文件 | `Approval decision` + `SHA-256`(缺失) | (无) | `audit-governance-approval/v3::approval-decision` | — |
| 验收 | `Acceptance`(隐含) | (无) | `outcome-approval.json` / `acceptance-spec.json` | — |
| 真相源 | LATEST.md(隐含引用) | (INDEX 字段 `truth-source pointer`) | (无对应) | `LATEST.md` / `audits/<plan>/LATEST.md` |

---

## 14. blueprint-creation 状态词汇表(七值,SKILL L333)

`草稿 / 待审批 / 待实施 / 实施中 / 已暂停 / 已完成 / 已退役`

蓝图当前 `实施中`(L5)。`实施中` 含「部分实施/返工中」情形。

---

## 15. 路径 / 工作流前置条件汇总(只调查,无 verdict)

| 路径/路线 | 涉及文件 | 涉及规则 | 实测前置 |
|---|---|---|---|
| 走 v3 PLAN_SET 路线(添加 5 个头部字段 + canonical + approval) | `plans/task-lens-m1/00-plan-index.md` 头部 + 2 个新文件(canonical/approval) | validate-plan.ts L66-111 | 需 H2_AUTHORIZED 人类授权 + HUMAN_USER signature;`audits/task-lens-m1/approval-decision.json` 创建需独立 trust domain |
| 走 outcome-governance/v1 路线(在 plans/task-lens-outcome-v1/ 建 4 件套) | `plans/task-lens-outcome-v1/outcome-{contract,test-bundle}.json` + `acceptance-spec.json` + `outcome-approval.json` + `ledger/event-001-contract-approved.json` | outcome-governance/SKILL.md L1-50 | 需 supersedes 引用;先例 path-dynamic-resolution-outcome-v1 可参照 |
| 保持 legacy v2.1(原位修改) | `plans/task-lens-m1/00-plan-index.md` 5 处 + `handoff/task-lens-resume.md` L97 + `documents/INDEX.md` L46 + `blueprints/blueprint-task-lens-m1.md` L302/L394 | AGENTS.md L531 grandfather + provenance-rules.md P-01 | 不得触碰历史 evidence/scope-lock/audit(L531);可改 plan 顶层 + active 文档 + blueprint 正文(非头部) |
| SUPERSEDED + 重建(类比 path-dynamic-resolution-m1) | `plans/task-lens-m1/00-plan-index.md` 头部 Status 改 `SUPERSEDED_BY_OUTCOME_GOVERNANCE_V1` + 新建 outcome-v1 | provenance-rules.md + outcome-governance | 需先裁决 PHASE-05 状态分裂(§10) + 新 outcome-contract 接受新 verdict |

> 本表只列路径的前置条件,不做路径推荐;实际选择由主会话/用户裁决。

---

## 16. 双重审核中两个 reviewer 的角度差异(透明声明)

| Reviewer | subagent_type | 角度 | 强项 | 局限 |
|---|---|---|---|---|
| R1(high-precision)| `agent_c182793b-...` | 深度:字段表 + 模板对齐 | v3 PLAN_SET 字段 / outcome 三件套 / scope-lock 模板对齐精细 | 广度弱(对 94 文件 cross-section 引用 sweep 不全) |
| R2(主会话顶替)| (rate-limit 后由主会话执行) | 广度:cross-section sweep | 94 文件引用图谱 + INDEX/board 状态字段 + handoff 引用 | 深度不及 high-precision 字段表详细 |

独立性保障:两 reviewer 互不读对方报告;R1 严格不读 logs/2026-08-05-task-lens-m1-stale-rule-dual-review.md;R2 由主会话顶替后立即执行独立命令,无 R1 信息输入。两者结论在 plan/blueprint 字段表 + 模板对齐 + 状态分裂 3 个核心维度上**结论一致**(即 plan-index 缺 5 个 v3 字段、PHASE-05 状态三处冲突、scope-lock 模板与现有不一致)。

---

## 17. 关键绝对路径

### 审查目标
- `C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\plans\task-lens-m1\00-plan-index.md`
- `C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\blueprints\blueprint-task-lens-m1.md`

### 规则/模板/validator
- `C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\AGENTS.md` L520-550
- `C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\.agents\skills\plan-audit-archiver\provenance-rules.md`
- `C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\.agents\skills\blueprint-creation\SKILL.md` L264-373
- `C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\.agents\skills\deterministic-implementation-planning\scripts\validate-plan.ts`
- `C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\.agents\skills\plan-audit-archiver\templates\scope-lock-template.json`
- `C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\.agents\skills\outcome-governance\templates\*.json` (9 模板)

### 先例
- `C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\plans\path-dynamic-resolution-m1\00-plan-index.md`
- `C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\plans\path-dynamic-resolution-m1\canonical-requirements-contract.yaml`
- `C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\audits\path-dynamic-resolution-m1\approval-decision.json`
- `C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\plans\path-dynamic-resolution-outcome-v1\*.json` (4 件套)

### 状态真相源 / 治理权威
- `C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\audits\task-lens-m1\LATEST.md`
- `C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\handoff\2026-07-25-task-lens-phase05-g2-blocked.md`

### 受保护历史(AGENTS.md L531)
- `C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\audits\task-lens-m1\2026-07-24-phase-{01..05}-*.md`(5 份)
- `C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\audits\task-lens-m1\scope-lock-PHASE-0{1..5}{,-amendment-20260725}.json`(6 份)
- `C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan\audits\task-lens-m1\evidence\**`(>10 份)

---

## 18. 自我边界声明

本记录是**只调查 inventory**,不是 verdict;不对"应走 v3 PLAN_SET 路线"还是"应转 outcome-governance 路线"还是"保持 legacy v2.1"还是"SUPERSEDED + 重建"作出推荐;不推荐 Path A/B/C/D 任一具体路径。§11"期望值"列给出的是各字段的可选值集合,不构成路径选择。§15"前置条件"表只列各路径的前置条件,不做选择。实际执行前必须由主会话或用户裁决具体路径,并对照规则文件原文复核每条规则依据的行号(本记录行号基于本次实测命令输出,主会话复核时以实际文件为准)。本记录未读 `logs/2026-08-05-task-lens-m1-stale-rule-dual-review.md` 之外的历史决策文档,所有引用基于实测 grep/sed/cat/ls 输出。
