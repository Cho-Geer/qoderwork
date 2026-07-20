# QoderWork 长期记忆

精炼的跨会话参考知识。写结论不写过程。使用前缀标签分类。

## work-one 约定: Provenance 流程约定（2026-07-19 落地）

- **AGENTS.md §15** 定义通用规则 P-01~P-06，适用于所有 plan 的所有 phase 实施与审计：
  - P-01: plan 索引必须声明 `provenance_level`（`v2.1-required` 或 `component-only`），未声明禁止开始实施
  - P-02: `v2.1-required` plan 实施前必须完成 Pre-Implementation Freeze Gate（scope-lock → human approval → capture-state.ts pre-change receipt → 验证非空）；违反则审计判 INVALID
  - P-03: v2.1 审计每个 VERIFICATION 步骤必须用 capture-state.ts 生成 receipt；Verified-by 文字行不可替代；validate-audit.ts exit 0 是签署 ACCEPT/REWORK 的必要条件
  - P-04: 前序审计的 BLOCKED 必须在后续审计显式处理（CLOSED/INHERITED/REOPENED）；禁止静默绕过
  - P-05: 审计降级必须在 §1 显式声明（理由+证据上限+不影响范围+影响范围 4 项缺一不可）
  - P-06: component-only plan 审计必须标注「证据上限：component」，禁止签署 v2.1 ACCEPT
- **plan-audit-archiver/SKILL.md** Invariant 14-16 强化执行约束：pre-change receipt 前置验证 + capture-state.ts 唯一合法性 + validate-audit.ts 机器门必要性
- **根因**：provenance 缺口源于实施流程（先实施后审计）与审计规范（先冻结再实施）的时序冲突
- **历史债务**：PHASE-01~04 pre-change receipt 无法重建，接受 component 级证据上限

## work-one 约定: p0-2 plan provenance 级别

- PHASE-01~04: `component-only`（历史 phase，pre-change 不可重建）
- PHASE-05~08: `v2.1-required`（实施前必须走 Pre-Implementation Freeze Gate）

## work-one 约定: completion gate box 全 [ ] 是项目约定

- DONE phase 的 completion gate box 维持 `[ ]` 合同形态（非缺陷），满足 PLAN_SET validator 要求 ≥1 未勾选 box
- DONE 状态由 `00-plan-index.md` 承载，box 文字中可添加 "closed per audit-X" 引用
- 依据：`04-phase-cli.md:106` 声明"全 [ ] 模式一致"

## work-one 架构: p0-2 plan 状态（截至 2026-07-19）

- PHASE-01~04: DONE（component 级，已审计）
- PHASE-05~08: BLOCKED（PHASE-05 需 reviewer 提供端口 P0_2_PORT_A/P0_2_PORT_B；PHASE-07/08 需根 typecheck 修复，当前 exit 2）
- 审计历史：PHASE-03 经 6 轮审计（audit~audit-6），PHASE-04 经 1 轮（phase-04-cli-audit）
- v2.1 正式 ACCEPT：全 plan BLOCKED（provenance 缺口），PHASE-05~08 实施后可建立
