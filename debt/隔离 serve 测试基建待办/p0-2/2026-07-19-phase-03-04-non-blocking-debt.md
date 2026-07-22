# P0-2 PHASE-03/04 NON_BLOCKING_DEBT 清单

**日期**: 2026-07-19

**来源**:
- PHASE-03: `audits/p0-2/2026-07-19-phase-03-sentinel-orchestrator-audit-6.md`（第五轮复审）
- PHASE-04: `audits/p0-2/2026-07-19-phase-04-cli-audit.md`（首次独立审计）

## 结论

PHASE-03 与 PHASE-04 审计共识别 5 项发现：1 项项目约定（非缺陷，F-03-001 已修正分类）、4 项 NON_BLOCKING_DEBT。均不阻断 component 级 DONE。plan-audit-archiver v2.1 正式 ACCEPT 仍 BLOCKED（provenance 缺口，跨 phase 共性，单列 F-COMMON-001）。

## 当前状态（2026-07-22 复核）

本清单按当前代码、计划索引、PHASE-04a/05/06/08 审计与 runtime artifact 复核后更新。当前仍保留的仅是 **F-COMMON-001 历史 provenance 限制**；PHASE-01~04 已在 `00-plan-index.md` 明确降级为 `component-only`，不再声称具备 v2.1 正式 ACCEPT 资格。

| ID | 当前状态 | 处理结论 |
|---|---|---|
| F-03-001 | CLOSED-AS-CONVENTION | 项目约定，非缺陷，无需处理。 |
| F-03-002 | CLOSED-AS-GOVERNANCE-LIMIT | 历史 audit-5 文本未补 provenance 声明；当前 plan index 已将 PHASE-01~04 标为 `component-only`，该限制不再阻断现行 P0-2 closure。 |
| F-04-001 | CLOSED | `controlledStops` 笔误已改为 `convergenceErrors`。 |
| F-04-002 | CLOSED | PHASE-04a 已加入 `existsSync`，P02-C-PATH-EXIST 与现有 CLI 测试通过；PHASE-05/06 runtime-smoke 亦已完成。 |
| F-04-003 | CLOSED-AS-SCOPE-GOVERNANCE | harness 已纳入当前测试基础设施范围并被 Git 跟踪；生产路径不受影响。 |
| F-COMMON-001 | RETAINED-HISTORICAL-LIMITATION | PHASE-01~04 的 pre-change receipt 无法回建；仅在未来要求这些历史 phase 重新签署 v2.1 时需要重新实施取证。 |

**当前 debt 数量**: 1 项历史限制（F-COMMON-001）；0 项待修复代码 debt；0 项阻断 P0-2 DONE 的 debt。

## PHASE-03 发现（audit-6）

### F-03-001: plan completion gate box 全 `[ ]`（项目约定，非缺陷）

- **来源**: audit-6 §6 F-001
- **现象**: `03-phase-sentinel-orchestrator.md:107-112` 的 6 个 completion gate box 全部 `[ ]`，包括 D1/D2 closed 的 box。括号文字声明"D1 closed per audit-5"等。
- **分类**: ~~原 NON_BLOCKING_DEBT（文档一致性）~~ → **项目约定（非缺陷）**。audit-6 已于 2026-07-19 修正分类。
- **依据**: `04-phase-cli.md:106` 明确声明"全 `[ ]` 模式一致"是项目约定——DONE 状态由 `00-plan-index.md` 承载，completion gate box 维持 `[ ]` 合同形态以满足 PLAN_SET validator 要求 ≥1 未勾选 box。
- **rework-3 log 措辞澄清**: "勾选 D1/D2 完成框"应理解为"在 box 文字中添加 closed 引用"，而非 `[ ]` → `[x]`。
- **处理**: 无需处理（项目约定）。后续 plan 文档可统一在 completion gate 旁注明"box 维持 [ ] 合同形态"以避免歧义。

### F-03-002: audit-5 未声明 provenance 缺口

- **来源**: audit-6 §6 F-002
- **现象**: audit-5 §1 直接 Accept，未声明 plan-audit-archiver v2.1 provenance 缺口（scope-lock / pre-change receipt / execution receipts / validate-audit.ts 机器门）。与 audit-4 §10 "正式归档状态 BLOCKED" 矛盾。
- **分类**: NON_BLOCKING_DEBT（文档完整性）
- **影响**: 不阻断 component 级 DONE。provenance 缺口阻断 v2.1 正式 ACCEPT 签署。
- **处理**: 见 F-COMMON-001（跨 phase 共性 provenance 缺口）。

## PHASE-04 发现（phase-04-cli-audit）

### F-04-001: failure JSON 缺 controlledStops 字段

- **来源**: phase-04-cli-audit §6 F-001
- **现象**: plan Fixed contract line 43 要求 failure JSON 含 `ok:false,firstFailure,controlledStops,evidencePaths.stageResults`，但实现 `isolated-serve.ts:199-203` 只输出 `{ok:false, firstFailure, evidencePaths}`，缺 `controlledStops`。
- **根因**: `P02Result` 类型（types.ts:326-360）无 `controlledStops` 字段，只有 `convergenceErrors?`。plan 的 `controlledStops` 可能是 PHASE-03 Check name 误写为 JSON 字段。
- **分类**: NON_BLOCKING_DEBT（文档/类型不一致）
- **影响**: 不阻断 REQ-003（REQ-003 只要求 firstFailure/evidence paths）。success JSON exact；failure JSON 缺 controlledStops 但 P02Result 无此字段可输出。
- **处理**: ~~需 plan 作者澄清 controlledStops 语义~~ → **已解决（2026-07-20）**：plan 作者确认选项 A（笔误），`04-phase-cli.md:43` 已将 `controlledStops` 修正为 `convergenceErrors`。PHASE-03 Check Registry 中的 `controlledStops` 是检查名（验证 stop 调用次数），非 JSON 字段，无需修改。

### F-04-002: absoluteInputs 不检查 existsSync

- **来源**: phase-04-cli-audit §6 F-002
- **现象**: plan Fixed contract line 42 要求"拒绝相对/不存在 path"，但实现 `parseP02Args:410-415` 只检查 `isAbsolute`，不检查 `existsSync`。
- **根因**: component 级测试用 `/fake/primary` 等不存在的绝对路径作为合法输入（避免真实文件系统操作）。若实现检查 existsSync，合法 argv 用例会 FAIL。
- **分类**: NON_BLOCKING_DEBT（component 级测试的合理简化）
- **影响**: 不阻断 component 级验证。runtime 级（PHASE-05）应补充 existsSync 检查。
- **处理**: PHASE-05 runtime 测试中补充路径存在性验证；或 plan Fixed contract 应区分 component/runtime 级要求。

### F-04-003: p02-cli-harness.ts 不在 plan Allowed files

- **来源**: phase-04-cli-audit §6 F-003
- **现象**: plan Allowed files 仅声明 `isolated-serve.ts`（modify）+ `p02-cli.test.ts`（add），但实施新增了 `p02-cli-harness.ts`（untracked）。
- **根因**: `p02-cli-harness.ts` 是 `p02-cli.test.ts` 的测试辅助文件（捕获 stdout/stderr/exitCode），可视为测试基础设施的扩展。
- **分类**: NON_BLOCKING_DEBT（scope 轻微越界，测试辅助文件）
- **影响**: 不影响生产代码。harness 仅用于测试，不进入生产路径。
- **处理**: 后续 plan 的 Allowed files 应显式包含测试辅助文件，或声明"测试基础设施文件"类别。

## 跨 phase 共性

### F-COMMON-001: plan-audit-archiver v2.1 provenance 缺口

- **影响 phase**: PHASE-01/02/03/04 全部
- **现象**: `audits/p0-2/` 下无 `scope-lock.json`、无 `evidence/` 目录；所有审计均用 `Verified-by` 文字证据行替代 immutable execution receipts；`validate-audit.ts` 机器门无法通过（无 v2.1 JSON contract）。
- **分类**: NON_BLOCKING_DEBT（跨 phase 共性）
- **影响**: 不阻断 component 级 DONE。阻断 v2.1 正式 ACCEPT 签署。
- **处理**: 若需 v2.1 正式签署，需 human approval scope-lock + 在实施前捕获 pre-change receipt。当前 PHASE-01~04 实施已完成，pre-change receipt 无法重建，仅适用后续 PHASE-05~08。

## 处理优先级

| ID | 优先级 | 处理时机 | 阻断条件 |
|---|:---:|---|---|
| F-03-001 | - | 无需处理 | 无（项目约定） |
| F-03-002 | 低 | v2.1 正式签署时 | 见 F-COMMON-001 |
| F-04-001 | - | **已解决**（2026-07-20） | plan 笔误已修正 |
| F-04-002 | 低 | PHASE-05 runtime 实施时 | 需 reviewer 端口 |
| F-04-003 | 低 | 后续 plan 编写时 | 无 |
| F-COMMON-001 | 低 | 后续 phase v2.1 签署时 | 需 human approval scope-lock |

---

**记录日期**: 2026-07-19
**记录者**: QoderCN（pre-flight-enforcement + plan-audit-archiver 组合）
