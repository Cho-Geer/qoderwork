# blueprints/ INDEX Board

> PHASE-01 治理看板：三段式登记（活跃 / 已闭环 / 已归档）+ 反向边视图 + 豁免清单。
> 治理依据：[blueprint-blueprints-governance.md](./blueprint-blueprints-governance.md) v1.0.1 (sha256 `3051a5df...`)。
> 本 INDEX 由 PHASE-01 首次创建；PHASE-02 已归档 11 文件（5 → `archive/2026-06/`、6 → `archive/2026-07/`）；PHASE-03 已写入 3 条因果边（单边记录于依赖方）+ 反向边视图 + 18 非豁免 root 文件四字段头部回填 + 3 处过期头部纠正。
> 注册总数：34（活跃 22 + 已归档 11 + 豁免 1；2026-08-10 新增 v2 successor blueprint）。

## 活跃

| 文件 | 状态（七值） | truth-source pointer | 日期依据 | 备注 |
|------|------------|--------------------|---------|------|
| 2026-07-12-framework-deprecated-content-audit-blueprint.md | 已完成 | `audits/framework-deprecated-content-audit/LATEST.md`（如存在）或 头部自述-未独立验证 | 2026-07-12（自述） | 治理审计蓝图 |
| blueprint-agent-read-enforcement.md | 已完成 | `audits/agent-read-enforcement/LATEST.md` 或 头部自述-未独立验证 | 2026-07-28（PHASE-03 头部纠正） | PHASE-03 边已写入（被取代·机制吸收 ← blueprint-permission-template-driven-enforcement.md）；头部状态 待实施 → 已完成 |
| blueprint-audit-governance-evidence-and-status-closure.md | 已退役 | `audits/audit-governance-evidence-and-status-closure/LATEST.md` | 2026-07-26（v3 ACCEPT） | v1 closure；PHASE-03 边已写入（被取代 ← v3）；modification-ban 检查 6 命中均为治理提及（无 sha256 绑定）→ 可编辑 |
| blueprint-audit-governance-recovery-v1-r7-and-tiered-provenance.md | 草稿 | 头部自述-未独立验证 | 2026-08-01（3 轮 high-precision 复审 PASS） | v1 r7 generation(修 3 个 spec drift)+ 分级 provenance 独立 proposal；前置依赖 → v3 closure；provenance_level: blueprint-draft；2026-08-02 SUPERSEDED_BY_OUTCOME_GOVERNANCE_V1（6 病灶在新框架已消除，plan 归档） |
| blueprint-cognitive-defense-skill-alignment.md | 已完成 | `audits/cognitive-defense-skill-alignment/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-dispatch-db-canonical.md | 已完成 | `audits/dispatch-db-canonical/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-dispatch-scope-privilege.md | 已完成 | `audits/dispatch-scope-privilege/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-dynamic-path-resolution-outcome-v1.md | 待实施 | plans/path-dynamic-resolution-outcome-v1/outcome-contract.json（结构校验 exit 0） | 2026-08-03 | 路径动态化 outcome v1 重建（M1 成果冻结为验收基线）；取代 blueprint-dynamic-path-resolution.md |
| blueprint-dynamic-path-resolution.md | 待实施 | 头部自述-未独立验证 | 2026-07-25（设计审计） | 设计经 2026-07-25 审计 + 2026-07-26 复核；M1 plan `plans/path-dynamic-resolution-m1/` READY-FOR-IMPLEMENTATION，4 phase 全 NOT_STARTED；PHASE-03 曾误标为已完成，2026-07-29 纠正回待实施；2026-08-03 SUPERSEDED_BY_OUTCOME_GOVERNANCE_V1（outcome 重建） |
| blueprint-impact-analysis-framework.md | 已完成 | `audits/impact-analysis-framework/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-isolated-serve-test-infrastructure.md | 已完成 | `audits/isolated-serve-test-infrastructure/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-opencode-framework-simplification-roadmap.md | 已完成 | `audits/opencode-framework-simplification/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-permission-template-driven-enforcement.md | 已完成 | `audits/permission-template-driven-enforcement/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | PHASE-03 反向边主体（机制吸收 → agent-read）；单边记录于依赖方，本文件 相关蓝图=无 |
| blueprint-phase-progression-audit-gate.md | 已完成 | `audits/phase-progression-audit-gate/LATEST.md` 或 头部自述-未独立验证 | 2026-07-28（PHASE-03 头部纠正） | PHASE-03 边已写入（前置依赖 → v3 closure，2026-07-28 已满足）；头部状态 待实施 → 已完成 |
| blueprint-question-hybrid-enforcement.md | 已完成 | `audits/question-hybrid-enforcement/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-serve-api-session-tree-optimization.md | 已完成 | `audits/serve-api-session-tree-optimization/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-task-lens-m1.md | 已退役 | `audits/task-lens-m1/LATEST.md` | 2026-07-28（PHASE-03 头部纠正）→ 2026-08-06（outcome-v1 退役标记 + m1 头文件同步更新） | PHASE-03 过期头部已纠正（实施中；依 audits/task-lens-m1/LATEST.md PHASE-05 ACCEPTED）；2026-08-06 SUPERSEDED_BY_OUTCOME_GOVERNANCE_V1（outcome 重建；新蓝图 blueprint-task-lens-outcome-v1.md 取代） |
| blueprint-task-lens-outcome-v1.md | 已完成 | `audits/task-lens-outcome-v1/LATEST.md` | 2026-08-05（创建）→ 2026-08-06（outcome-governance v1 ACCEPT, 90/90 tests pass） | 新框架 outcome-v1 重建（参照 blueprint-task-lens-m1.md）；取代 blueprint-task-lens-m1.md；状态投影自 audits/task-lens-outcome-v1/LATEST.md (audit ACCEPT 签发事件) |
| blueprint-task-lens-m1-completion-v2.md | 草稿 | `plans/task-lens-m1-completion-v2/00-plan-index.md`（header Status: DRAFT） | 2026-08-08（创建）→ 2026-08-10（§6 manifest 回退；99-final 头部改 BLOCKED；INDEX sync pending（Group F，logs/ + handoff/ 旁证待补）） | successor 实施 plan；PHASE-05-v2 NOT_STARTED / PHASE-06-v2 BLOCKED / PHASE-07-v2 BLOCKED / FINAL-v2 BLOCKED；gen2 数据层落盘（run-result-v2 13/13 case PASS + 8 文件 + SHA 一致）但 validator 实跑 INVALID（BUNDLE_HASH_MISMATCH + SPEC_INVALID，因 CLI line 252-253 sources 未归一化）；§6 Final completion gate 0/19 未勾；BLK-V2-001 INDEX sync pending（Group F，logs/ + handoff/ 旁证待补）（2026-08-10 snapshot；current state 2026-08-14：Group D CRLF 归一化修复落地后 validator Git Bash 实跑 EXIT=0/ACTIVE，§6 gate 13/19 — 见 plans/task-lens-m1-completion-v2/00-plan-index.md） |
| blueprint-todowrite-driven-weak-agent-supervision.md | 已完成 | `audits/todowrite-driven-weak-agent-supervision/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-tool-governance-mvc-refactor.md | 已完成 | `audits/tool-governance-mvc-refactor/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-blueprints-governance.md | 已完成 | `audits/blueprints-governance/LATEST.md` | 2026-07-28（PHASE-05 ACCEPTED） | 本 plan 自身蓝图；PHASE-01~05 全部 ACCEPTED、plan COMPLETE（依 LATEST.md → 2026-07-28-audit-phase-05.md，verdict ACCEPT，invalid_reason null）；按看板规约已完成 blueprint 仍登记于活跃段 |
| target-structure.md | 草稿 | 头部自述-未独立验证 | 2026-07（自述） | 待后续 PHASE 细化 |
| blueprint-cross-platform-universality.md | 已闭环 | 头部自述-未独立验证 | 2026-08-05（迭代 9/10 双重复审 + user re-sign;5/5 phases ACCEPTED） | 跨平台通用化蓝图：Windows Git Bash + WSL Ubuntu 双兼容；anchor 在 WORK_ONE_ROOT + QODERWORK_ROOT 既有合约；不再发明 QW_ROOT；不引入 tree-kill（实测不需要）；outcome-contract 不需 gen-2 amendment |

## 已闭环

（PHASE-01 时为空；PHASE-03 未移动任何行——已完成/已退役 blueprint 仍登记于活跃段，待后续 PHASE 判定闭环后移入。）

## 已归档

PHASE-02（2026-07-28）归档 11 文件：5 → `archive/2026-06/`、6 → `archive/2026-07/`。每文件 move-ban 检查（`rg --fixed-strings` 路径形引用 audits//plans/ 零命中）PASS 后 mv；退役决策记录见 `logs/2026-07-28-blueprints-governance-archive-<basename>.md`。

| 文件 | 状态（七值） | truth-source pointer | 日期依据 | 备注 |
|------|------------|--------------------|---------|------|
| archive/2026-06/session-context-2026-06-28.md | 已退役 | 头部自述-未独立验证 | 2026-06-28（写作月） | 临时 session 交接摘要；无继任 |
| archive/2026-06/acp-integration-direction.md | 已退役 | 头部自述-未独立验证 | 2026-06-28（写作月） | ACP 早期方向；被 acp-bridge-design 取代（ACP 线已终止） |
| archive/2026-06/acp-protocol-verified.md | 已退役 | 头部自述-未独立验证 | 2026-06-28（写作月） | ACP 验证报告；结论并入 acp-bridge-design（ACP 线已终止） |
| archive/2026-06/context-lazy-loading-plan.md | 已退役 | 头部自述-未独立验证 | 2026-06-29（写作月） | 被 blueprint-opencode-framework-simplification-roadmap.md 取代；`.agents/skills/opencode-framework-dev/reference.md` 存非阻断引用 |
| archive/2026-06/phase4-scripts-purification.md | 已退役 | 头部自述-未独立验证 | 入库月（无自述日期） | 并入统一方案后被 simplification-roadmap 取代 |
| archive/2026-07/acp-bridge-design.md | 已退役 | 头部自述-未独立验证 | 入库月（无自述日期） | v2 设计被方案 C serve-api 取代（ACP 线已终止） |
| archive/2026-07/acp-bridge-serve-api-redesign.md | 已退役 | 头部自述-未独立验证 | 入库月（无自述日期） | 方案 C 改造设计；ACP 线退役，无继任 |
| archive/2026-07/blueprint-acp-bidirectional.md | 已退役 | 头部自述-未独立验证 | 2026-07-01（写作月） | Part A 已实装；B/C/D 取消（ACP 线已终止） |
| archive/2026-07/blueprint-acp-bridge-optimization-roadmap.md | 已退役 | 头部自述-未独立验证 | 2026-07-02（写作月） | ACP bridge 优化路线图；线退役取消 |
| archive/2026-07/blueprint-acp-bridge-sse-events.md | 已退役 | 头部自述-未独立验证 | 2026-07-02（写作月） | SSE 事件方案；线退役未实装 |
| archive/2026-07/blueprint-permission-template-refactor.md | 已退役 | 头部自述-未独立验证 | 2026-07-17（写作月） | 占位文件；被 blueprint-permission-template-driven-enforcement.md 取代（文件内自述）；`logs/2026-07-14-permission-template-enforcement-blueprint.md` 存非阻断引用 |

## 反向边视图

PHASE-03（2026-07-28）写入 3 条因果边，单边记录于依赖方文件的 `相关蓝图` 字段；本段为 INDEX 派生的反向视图（信息性引用不进入字段，仅在此呈现）：

| 主体（反向） | 反向关系 | 依赖方（原边记录处） | 日期依据 |
|------|---------|------------------|---------|
| blueprint-audit-governance-evidence-and-status-closure-v3.md | 取代 → | blueprint-audit-governance-evidence-and-status-closure.md（`被取代 ← v3`；已退役） | 2026-07-28 |
| blueprint-audit-governance-evidence-and-status-closure-v3.md | 被依赖 ← | blueprint-phase-progression-audit-gate.md（`前置依赖 → v3`，2026-07-28 已满足；已完成） | 2026-07-28 |
| blueprint-permission-template-driven-enforcement.md | 取代（机制吸收） → | blueprint-agent-read-enforcement.md（`被取代（机制吸收） ← driven-enforcement`；已完成） | 2026-07-28 |

## 豁免清单

| 文件 | SHA-256 | 豁免理由 |
|------|---------|---------|
| blueprint-audit-governance-evidence-and-status-closure-v3.md | `a510b7a8677c03e7ea1561e48620b95acec8611c88ff7ad2ddc558e0aa930d66` | hash-frozen by `audits/audit-governance-evidence-and-status-closure-v3/phase-01-scope-lock.yaml:40-42`（v3 audit chain 锚定）；PHASE-03 不得编辑此文件，仅在 INDEX 维护元数据 |

## PHASE-01 完成闸

- [x] INDEX 注册全部 31 个 .md 文件（30 pre-existing + 1 新登记）
- [x] 三段（活跃 / 已闭环 / 已归档）+ 两段预留（反向边视图 / 豁免清单）
- [x] 所有 status 字段 ∈ {草稿, 待审批, 待实施, 实施中, 已暂停, 已完成, 已退役, 待归档}
- [x] 所有行含 truth-source pointer（`头部自述-未独立验证` 或 `audits/.../LATEST.md`）
- [x] 豁免清单包含 v3 blueprint（含 SHA-256 与绑定依据）
- [x] **PHASE-02 完成**：归档 11 个待归档文件到 `blueprints/archive/YYYY-MM/`（5 → 2026-06、6 → 2026-07；root 活跃 = 19）
- [x] **PHASE-03 完成**：18 非豁免 root 文件四字段头部回填（逐文件 modification-ban 检查，0 sha256 绑定）+ 3 条因果边单边写入（v1 被取代 ← v3、phase-progression 前置依赖 → v3、agent-read 被取代·机制吸收 ← driven-enforcement）+ 反向边视图 3 行派生 + 3 处过期头部纠正（task-lens-m1 → 实施中、phase-progression → 已完成、agent-read → 已完成）；v3 豁免未动（sha256 `a510b7a8...`）
- [ ] **PHASE-04 后续**：spec sync（blueprint-creation skill / AGENTS.md / documents/INDEX.md）