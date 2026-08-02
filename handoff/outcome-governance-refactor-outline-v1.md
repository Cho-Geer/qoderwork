### ID

- [ID] outcome-governance-refactor-outline-v1

### TASK

- [REQ] 给出治理框架重构的设计大纲、删除文件清单、更新文件清单。
- [SCOPE] 以 bootstrap `287b745` 为事实基线；本轮只设计，不修改文件。
- [MODE] SINGLE

### PLAN

- [S1][DONE] 定义新治理模型。
- [S2][DONE] 盘点旧 skill、模板、脚本和引用方。
- [S3][DONE] 形成删除、更新、新增和历史保留清单。

## 一、设计大纲

### 1. 核心原则

新流程只严格控制两端：

```text
设计合同
  目标 + 边界 + 验收测试
          ↓
实施过程
  模型自由探索、修改、回退、重构
          ↓
验收
  固定测试 + 独立 oracle + 真实执行证据
```

只有三类情况需要暂停：

- 要改变目标、边界或验收测试；
- 要执行生产数据、secret、权限、不可逆操作；
- 验收规格存在矛盾，无法判断正确结果。

普通编译失败、测试失败、路径发现错误、实现方案失败，都由模型自行修复，不需要 human approval。

### 2. 四种权威制品

#### `design-contract.yaml`

只包含：

- `contract_id`、`version`；
- 目标与非目标；
- 安全/业务边界；
- atomic requirement；
- 对应 test ID；
- test specification 路径和 SHA；
- amendment parent。

不包含：

- 实施步骤；
- 文件修改顺序；
- `allowed_paths`；
- materialization 命令；
- phase 状态；
- pre-change Git 状态；
- receipt payload；
- publication 流程。

建议硬限制：单份不超过 300 行。超过则按独立业务目标拆成多个合同，禁止通过把内容移到大量互相复制字段的 projection 文件来规避。

#### `amendment.yaml`

只在合同变化时产生：

- 父合同 ID、版本和 SHA；
- 修改原因；
- 修改的 requirement/test ID；
- 不受影响 requirement；
- 受影响依赖闭包；
- 必须重验的 test ID；
- 人类批准引用。

建议不超过 100 行。

#### `contract-approval.json`

只保存：

- 批准的 contract/amendment SHA；
- 批准人和时间；
- 决策；
- 备注。

不再复制 canonical、plan object set、manifest、waiver 和 artifact 列表。

#### `test-run.json`

完全由测试 runner 生成：

- contract version；
- test ID；
- commit/runtime/environment；
- command/request；
- oracle；
- observed result；
- PASS/FAIL/BLOCKED；
- artifact hash。

它不包含实施过程是否合规的判断。

### 3. 阶段状态

不再维护 plan index、phase 文件、progression receipt、LATEST 等多套状态。

阶段状态由最新合同版本的测试结果派生：

```text
没有 test-run             → NOT_TESTED
存在 FAIL                 → REWORK
存在 BLOCKED              → BLOCKED
全部必需测试 PASS          → ACCEPTED
合同被 amendment 影响      → SUPERSEDED / REVALIDATION_REQUIRED
```

下一阶段准入只检查：

- 当前合同版本已批准；
- 所有直接、传递依赖的必需测试已 PASS；
- 没有尚未处理的 amendment 影响这些依赖。

### 4. 测试规则

继续严格保留：

- 独立 oracle；
- 正向、负向、边界和对抗测试；
- component/integration/runtime/live-E2E 分层；
- 禁止用低层测试冒充高层；
- 测试失败必须回到实施；
- 禁止实施模型静默修改测试；
- 测试需要改变时，先创建 amendment。

### 5. 历史兼容

以下内容不删除、不原地修改：

- `audits/**` 历史证据；
- 已批准 canonical；
- 已冻结 blueprint；
- 旧 plan 和 receipt。

它们在索引中标记为 `SUPERSEDED_BY_OUTCOME_GOVERNANCE_V1`。如需重放旧 validator，使用 Git tag/commit `287b745`，不要求新框架继续携带旧运行代码。

## 二、删除文件清单

以下删除发生在新框架全部测试通过、试点完成之后。

### A. 删除旧 deterministic implementation skill

删除整个 `.agents/skills/deterministic-implementation-planning/`，具体包括：

- `SKILL.md`
- `PLAN-TEMPLATE.md`
- `PLAN-SET-TEMPLATE.md`
- `QUALITY-GATES.md`
- `legacy-boundary-contract-exemptions.json`
- `scripts/validate-plan.ts`
- `scripts/validate-plan.test.ts`
- `scripts/phase-progression.ts`
- `scripts/phase-progression.test.ts`
- `scripts/validate-phase-progression.ts`
- `scripts/validate-phase-progression.test.ts`
- `scripts/foundation-kernel.test.ts`
- `scripts/__tests__/validate-phase-progression-14-modes.test.ts`

原因：该 skill 的核心目标是固定“唯一允许的实施顺序”，与新制度直接冲突。

### B. 删除旧 plan audit skill

删除整个 `.agents/skills/plan-audit-archiver/`，具体包括：

- `SKILL.md`
- `provenance-rules.md`

模板：

- `templates/scope-lock-template.json`
- `templates/phase-projection-template.json`
- `templates/evidence-receipt-template.json`
- `templates/audit-report-template.md`

脚本：

- `scripts/audit-boundary-precheck.ts`
- `scripts/capture-state.ts`
- `scripts/close-audit-phase.ts`
- `scripts/finalize-audit.ts`
- `scripts/generate-evidence-receipt.ts`
- `scripts/generate-phase-projection.ts`
- `scripts/pre-check-evidence.ts`
- `scripts/prepare-audit.ts`
- `scripts/validate-audit.ts`

对应测试：

- `scripts/__tests__/audit-boundary-precheck.test.ts`
- `scripts/__tests__/capture-state.test.ts`
- `scripts/__tests__/close-audit-phase.test.ts`
- `scripts/__tests__/finalize-audit.test.ts`
- `scripts/__tests__/foundation-kernel.test.ts`
- `scripts/__tests__/generate-evidence-receipt.test.ts`
- `scripts/__tests__/generate-phase-projection.test.ts`
- `scripts/__tests__/pre-check-evidence.test.ts`
- `scripts/__tests__/prepare-audit.test.ts`
- `scripts/__tests__/validate-audit.test.ts`

可复用的 runner/hash 逻辑迁入新 skill，不能复制旧 schema 和流程状态机。

### C. 删除旧共享 schema

在新 schema 切换后删除：

- `scripts/lib/audit-governance-schema-v3.ts`
- `scripts/lib/__tests__/audit-governance-schema-v3.test.ts`

## 三、新增文件清单

新增 `.agents/skills/outcome-governance/`：

```text
.agents/skills/outcome-governance/
├── SKILL.md
├── templates/
│   ├── design-contract-template.yaml
│   ├── amendment-template.yaml
│   ├── contract-approval-template.json
│   └── test-run-template.json
└── scripts/
    ├── validate-design-contract.ts
    ├── validate-amendment.ts
    ├── validate-contract-approval.ts
    ├── run-acceptance-tests.ts
    ├── validate-test-run.ts
    ├── derive-phase-status.ts
    └── __tests__/
        ├── validate-design-contract.test.ts
        ├── validate-amendment.test.ts
        ├── validate-contract-approval.test.ts
        ├── run-acceptance-tests.test.ts
        ├── validate-test-run.test.ts
        └── derive-phase-status.test.ts
```

新增架构与迁移文档：

- `blueprints/blueprint-outcome-based-plan-and-acceptance-governance.md`
- `plans/outcome-governance-v1/design-contract.yaml`
- `plans/outcome-governance-v1/test-specification.md`
- `plans/outcome-governance-v1/contract-approval.json`
- `logs/<date>-outcome-governance-migration.md`

新增共享 schema：

- `scripts/lib/outcome-governance-schema-v1.ts`
- `scripts/lib/__tests__/outcome-governance-schema-v1.test.ts`

## 四、更新文件清单

### 全局规则

- [AGENTS.md](/home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap/AGENTS.md)
  - 删除 P-01～P-07 实施 provenance。
  - 删除“主 Agent 不写代码、子 Agent 只机械执行”。
  - 普通实施阻断允许模型自行修复。
  - 保留安全、权限、不可逆操作闸门。
  - 新增 outcome governance 规则索引。

- [RULES.md](/home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap/RULES.md)
  - 删除默认 SUBAGENT/MULTI-AGENT。
  - 输出结构不再属于产品验收条件。
  - 保留验证标记和证据层级。

### 设计与实施 skill

- `.agents/skills/blueprint-creation/SKILL.md`
  - blueprint 只负责问题、目标、边界、验收和风险。
  - 文件清单改为“预期影响”，不作为实施硬范围。
  - 删除精确实施步骤的强制要求。
  - 新增 contract/amendment 版本规则和大小限制。

- `.agents/skills/pre-flight-enforcement/SKILL.md`
  - 不再强制实施步骤顺序。
  - 只约束安全、授权和测试执行。
  - 普通失败允许 agent 重试和调整。

- `.agents/skills/task-dispatch-router/SKILL.md`
  - 子 agent 不再限定为机械执行。
  - 允许实施 agent 在合同内自行决策。
  - 统一裁决仍由主 agent 完成。

### 测试 skill

- `.agents/skills/requirements-to-test-specification/SKILL.md`
- `.agents/skills/requirements-to-test-specification/TEST-SPEC-TEMPLATE.md`
  - 每个 test ID 绑定 contract version。
  - 修改 oracle/expected result 必须引用 amendment。
  - 禁止实现过程字段进入测试合同。

- `.agents/skills/test-specification-execution/SKILL.md`
- `.agents/skills/test-specification-execution/EXECUTION-REPORT-TEMPLATE.md`
  - 输出统一 `test-run.json`。
  - 保留第一失败证据。
  - 每次修复只重跑受影响测试闭包。
  - 不判断实施过程是否合规。

### 共享扫描与状态代码

- `scripts/lib/artifact-reference-graph.ts`
- `scripts/lib/__tests__/artifact-reference-graph.test.ts`
  - 从全 artifact DAG 改成简单的 contract → amendment → test-run 引用链。

- `scripts/lib/scan-governance-surface.ts`
- `scripts/lib/__tests__/scan-governance-surface.test.ts`
- `scripts/lib/governance-surface-manifest.yaml`
  - 删除旧 scope-lock、P-02A、close-audit-phase、status publication 检查。
  - 增加 contract/amendment/test-run 检查。

- `scripts/lib/run-conformance.ts`
- `scripts/lib/__tests__/run-conformance.test.ts`
- `scripts/lib/conformance-corpus/corpus.json`
- `scripts/lib/conformance-mismatch-probes/probes.json`
  - 将 conformance 目标改为合同版本、测试不可篡改和 amendment 影响闭包。

- `scripts/lib/stagnation-scan.ts`
- `scripts/lib/__tests__/stagnation-scan.test.ts`
  - 状态从 acceptance test-run 派生，不读旧 LATEST/progression 投影。

### 索引与状态文档

- `blueprints/INDEX.md`
- `documents/INDEX.md`
- `logs/INDEX.md`

更新内容：

- 登记新 blueprint 和新 skill；
- 将旧 phase-progression、audit-governance blueprint 标为被新机制取代；
- 历史文件保持原位，不回写被冻结内容。

## 五、实施顺序

1. 为 `287b745` 创建 legacy tag，确保旧审计工具可重放。
2. 新增 outcome-governance skill、schema 和测试，不接管现有流程。
3. 用 PHASE-04 问题创建第一个真实 amendment 试点。
4. 验证只重验受影响需求，不重跑 PHASE-00～03。
5. 切换 AGENTS、RULES 和相关 skill 到新机制。
6. 全量运行 component、integration、runtime-smoke 治理测试。
7. 删除旧两个 skill 和旧 schema。
8. 更新索引，将旧制度标为历史机制。

### CHECK

- [TEST] NOT-RUN：本轮为设计与文件清单，不实施代码。
- [DOC] N/A：未修改文件。
- [RISK] OPEN：旧 skill 不能在新机制验证完成前删除；否则历史流程失去可重放入口。

### Post-Execution Audit

- [x] 使用了 `blueprint-creation` 要求的问题、方案、文件、验证和回滚结构。
- [x] 以最新 clean bootstrap `287b745` 核实文件存在。
- [x] 删除清单覆盖脚本、模板及对应测试。
- [x] 明确历史 audit/plan/blueprint 不删除。
- [x] 最终 `git status --short` 为空，本轮无文件写入。

### FINAL

建议采用 clean replacement：新增 `outcome-governance`，完成 PHASE-04 amendment 试点并通过测试后，整体退役 `deterministic-implementation-planning` 和 `plan-audit-archiver`。

关键不是把旧 schema 修得更复杂，而是彻底取消“实施过程必须可证明合规”，只保留“合同变化必须可追踪、验收结果必须可证明”。