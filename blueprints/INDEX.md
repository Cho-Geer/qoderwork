# blueprints/ INDEX Board

> PHASE-01 治理看板：三段式登记（活跃 / 已闭环 / 已归档）+ 反向边视图 + 豁免清单。
> 治理依据：[blueprint-blueprints-governance.md](./blueprint-blueprints-governance.md) v1.0.1 (sha256 `3051a5df...`)。
> 本 INDEX 由 PHASE-01 首次创建；PHASE-02/03 后续填充反向边视图与豁免清单细节。
> 注册总数：31（30 pre-existing + 1 新登记 `blueprint-blueprints-governance.md`）。

## 活跃

| 文件 | 状态（七值） | truth-source pointer | 日期依据 | 备注 |
|------|------------|--------------------|---------|------|
| 2026-07-12-framework-deprecated-content-audit-blueprint.md | 已完成 | `audits/framework-deprecated-content-audit/LATEST.md`（如存在）或 头部自述-未独立验证 | 2026-07-12（自述） | 治理审计蓝图 |
| acp-bridge-design.md | 待归档 | 头部自述-未独立验证 | 入库月（无自述日期） | PHASE-02 候选 |
| acp-bridge-serve-api-redesign.md | 待归档 | 头部自述-未独立验证 | 入库月（无自述日期） | PHASE-02 候选 |
| acp-integration-direction.md | 待归档 | 头部自述-未独立验证 | 2026-06-28（写作月） | PHASE-02 候选 |
| acp-protocol-verified.md | 待归档 | 头部自述-未独立验证 | 2026-06-28（写作月） | PHASE-02 候选 |
| blueprint-acp-bidirectional.md | 待归档 | 头部自述-未独立验证 | 2026-07-01（写作月） | PHASE-02 候选 |
| blueprint-acp-bridge-optimization-roadmap.md | 待归档 | 头部自述-未独立验证 | 2026-07-02（写作月） | PHASE-02 候选 |
| blueprint-acp-bridge-sse-events.md | 待归档 | 头部自述-未独立验证 | 2026-07-02（写作月） | PHASE-02 候选 |
| blueprint-agent-read-enforcement.md | 已完成 | `audits/agent-read-enforcement/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | PHASE-03 边纠正候选（被取代·机制吸收 ← blueprint-permission-template-driven-enforcement.md） |
| blueprint-audit-governance-evidence-and-status-closure.md | 已退役 | `audits/audit-governance-evidence-and-status-closure/LATEST.md` | 2026-07-26（v3 ACCEPT） | v1 closure；PHASE-03 边写入（被取代 ← v3） |
| blueprint-cognitive-defense-skill-alignment.md | 已完成 | `audits/cognitive-defense-skill-alignment/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-dispatch-db-canonical.md | 已完成 | `audits/dispatch-db-canonical/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-dispatch-scope-privilege.md | 已完成 | `audits/dispatch-scope-privilege/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-dynamic-path-resolution.md | 已完成 | `audits/dynamic-path-resolution/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-impact-analysis-framework.md | 已完成 | `audits/impact-analysis-framework/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-isolated-serve-test-infrastructure.md | 已完成 | `audits/isolated-serve-test-infrastructure/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-opencode-framework-simplification-roadmap.md | 已完成 | `audits/opencode-framework-simplification/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-permission-template-driven-enforcement.md | 已完成 | `audits/permission-template-driven-enforcement/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | PHASE-03 边写入（被取代·机制吸收 → agent-read） |
| blueprint-permission-template-refactor.md | 待归档 | 头部自述-未独立验证 | 2026-07-17（写作月） | PHASE-02 候选 |
| blueprint-phase-progression-audit-gate.md | 已完成 | `audits/phase-progression-audit-gate/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | PHASE-03 边写入（前置依赖 → v3 closure） |
| blueprint-question-hybrid-enforcement.md | 已完成 | `audits/question-hybrid-enforcement/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-serve-api-session-tree-optimization.md | 已完成 | `audits/serve-api-session-tree-optimization/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-task-lens-m1.md | 实施中 | `audits/task-lens-m1/LATEST.md` | 2026-07（自述） | PHASE-03 过期头部纠正候选 |
| blueprint-todowrite-driven-weak-agent-supervision.md | 已完成 | `audits/todowrite-driven-weak-agent-supervision/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-tool-governance-mvc-refactor.md | 已完成 | `audits/tool-governance-mvc-refactor/LATEST.md` 或 头部自述-未独立验证 | 2026-07（自述） | |
| blueprint-blueprints-governance.md | 待实施 | 头部自述-未独立验证 | 2026-07-28（写作月） | 本 plan 自身蓝图；PHASE-01 ~ 05 实施后状态待定 |
| context-lazy-loading-plan.md | 待归档 | 头部自述-未独立验证 | 2026-06-29（写作月） | PHASE-02 候选 |
| phase4-scripts-purification.md | 待归档 | 头部自述-未独立验证 | 入库月（无自述日期） | PHASE-02 候选 |
| session-context-2026-06-28.md | 待归档 | 头部自述-未独立验证 | 2026-06-28（写作月） | PHASE-02 候选 |
| target-structure.md | 草稿 | 头部自述-未独立验证 | 2026-07（自述） | 待后续 PHASE 细化 |

## 已闭环

（PHASE-01 时为空；PHASE-03 完成后闭环的 blueprint 移入此段。）

## 已归档

（PHASE-01 时为空；PHASE-02 归档 11 文件后填充此段。）

## 反向边视图

（PHASE-01 时为空；PHASE-03 完成 3 条因果边（v1 被取代 ← v3、phase-progression 前置依赖 → v3、agent-read 被取代·机制吸收 ← driven-enforcement）后由 INDEX 派生反向视图。）

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
- [ ] **PHASE-02 后续**：归档 11 个待归档文件到 `blueprints/archive/YYYY-MM/`
- [ ] **PHASE-03 后续**：写入 3 条因果边 + 反向视图填充 + 3 处过期头部纠正