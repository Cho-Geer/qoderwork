# Blueprint: 审计证据、状态与报告闭环

**版本**: v0.1.0
**日期**: 2026-07-25
**状态**: 已批准为实施计划输入
**优先级**: P0（治理可信度）
**范围**: QoderWork 的审计归档脚本、计划校验器、审计模板与治理说明；不修改 work-one 产品代码、不回填历史审计。

---

## 一、问题与证据

### 1.1 观察到的失败模式

实施完成后的审计经常经历多轮“格式已补、仍不通过”。问题不是审计要求独立证据这一原则，而是同一事实被分散写入 scope-lock、证据 receipt、报告正文、报告 contract、`LATEST.md`、计划 manifest、completion gate 与 pre-flight 输出；其中一处由人工修改，其他位置不会自动同步。

本工作树的只读检查确认以下当前事实：

1. `validate-audit.ts` 有大量独立错误分支，结构要求、证据级别、命令 cwd、身份字段和正文重复字段混在同一个签署判定中。
2. `pre-check-evidence.ts` 只枚举 `audits/plan/evidence/` 的第一层 `ev-*.json`，不会发现报告实际引用的嵌套 receipt；因此可出现“无证据文件，预检通过”的假阳性。
3. `prepare-audit.ts` 会生成 `REPLACE_EXACT_FILE`、`REPLACE_COMMAND` 等已知不满足 validator 的占位内容，并允许默认 verdict 文本流入人工修补流程。
4. `validate-plan.ts` 同时要求整份 phase 文档存在未勾选框，并要求 `ACCEPTED` phase 的 completion gate 全勾选；这迫使已完成 phase 保留与完成无关的未勾选框。
5. Task Lens PHASE-05 的报告已被 validator 判为证据级别不足、ceiling 不足和 cwd 缺失，但 `LATEST.md` 仍可人工显示“ACCEPTED”。

这些事实说明当前流程的重不是来自“证据充分”，而是来自无权威源的重复声明与不能覆盖真实输入的预检。

### 1.2 根因

| 根因 | 造成的结果 | 必须保留或移除 |
|---|---|---|
| receipt 发现以目录浅扫描为准 | 深层或显式引用证据未被检查 | 移除目录发现作为通过依据 |
| verdict、证据 ceiling、身份和状态在多份文档手写 | 文本可互相矛盾 | 保留事实字段，移除手工重复录入 |
| 生成器产出必然无效的草稿 | 弱模型只能反复猜测修补 | 移除无效默认值和占位符 |
| validator 把编辑提示当成完成条件 | 已验收 phase 被迫保留假任务 | 将 checkbox 只解释为本 phase gate |
| 降级文字与 `ACCEPT` 同时存在 | 低级证据被误解为可签署接受 | 降级仅记录限制，不能签署 `ACCEPT` |

### 1.3 不变的实质控制

下列控制有直接治理价值，必须保留并自动化，而不是简化掉：human-approved scope-lock、pre-change receipt、正反控制、对每项 requirement 的可定位 evidence、`validate-audit.ts` 的签署前 gate、前序 BLOCKED 项的显式闭环，以及证据层级不可上浮。

---

## 二、目标与边界

### 2.1 目标

建立一条唯一、可重复的审计闭环：明确 contract 列出的 receipt 是唯一待检对象；contract 是事实的唯一机器输入；报告与 `LATEST.md` 只在校验成功后从该输入渲染；计划状态只接受已签署且同证据级别的审计结果。

### 2.2 完成定义

1. 计划 validator 对 `NOT_STARTED`、`IN_PROGRESS`、`BLOCKED`、`INVALID` phase 只允许未勾选 completion gate，对 `ACCEPTED` phase 要求至少一个 gate 且全勾选；不再检查整份文档的任意未勾选框。
2. evidence pre-check 按 audit contract 的显式 receipt path 校验，支持嵌套路径，拒绝缺失、路径越界、hash 不符、identity 不符和行为性 requirement 的空 receipt 集。
3. required evidence level 高于实际 receipt level 时，任何 `ACCEPT` 均不可签署；限制说明只能随 `BLOCKED`、`REWORK` 或 `INVALID` 结果保存。
4. `audit-contract.json` 是唯一可编辑的机器事实；报告与 `LATEST.md` 由同一渲染命令产生，未通过 pre-check 或 validator 时二者均不得写入。
5. 所有新控制具有 all-pass、单一变异和零写入失败测试；证据上限止于 component 与文件级 integration，不声称 runtime-smoke 或 live-LLM-E2E。

### 2.3 非目标

- 不改变 work-one、SQLite schema、serve 生命周期、LLM 权限或 `H2_AUTHORIZED`。
- 不修改或补签现存 Task Lens、P0-2 和其他历史 audit；它们只可作为只读回归夹具。
- 不删除现有审计证据，不把“目录中有文件”解释为 requirement 已验证。
- 不引入数据库、外部服务、npm 依赖、`--force` 或人工 `--status ACCEPTED` 旁路。

---

## 三、方案对比与决策

| 方案 | 做法 | 对重复填写的作用 | 对错误证据的作用 | 结论 |
|---|---|---|---|---|
| A：保留现有文件，补更多 checklist | 增加模板字段和人工复核 | 更重 | 仍以目录浅扫描为准 | 否决 |
| B：只修 validator 规则 | 修复 checkbox 与 level 判断 | 部分减轻 | `LATEST` 与报告仍可漂移 | 否决 |
| C：canonical contract 加受控渲染 | contract 驱动 pre-check、report、LATEST；validator 只判断事实和渲染一致性 | 消除重复权威字段 | 显式 receipt 集成为唯一输入 | 选定 |

选择 C。它保留审计实质，并把重复文本降为生成物。既有 `blueprints/blueprint-phase-progression-audit-gate.md` 的 phase progression 设计继续有效；本蓝图不改写其 P-02A 状态机，只提供它依赖的可信 audit 输入与状态来源。

---

## 四、核心设计

### 4.1 Canonical audit contract

每次新审计在 `audits/plan-name/audit-contract.json` 保存唯一机器输入。它至少包含：

- `schema_version`、`audit_id`、`plan_id`、`phase_id`、`generation`、`verdict`；
- `scope_lock_path` 与 hash、`repository_root`、commit identity、provenance/evidence ceiling；
- 每个 requirement 的 ID、polarity、oracle、fixture、command、observed result 和 receipt path；
- BLOCKED item 的 `CLOSED`、`INHERITED` 或 `REOPENED` 处理；
- 渲染所需的简短人工解释字段，但不复制可机器推导的 identity、verdict、receipt 或 status。

receipt path 必须相对 audit directory、规范化后仍在该目录内。一个行为性 requirement 没有 receipt 是失败；纯文档结构 requirement 必须明确标记为 `manual`，不能借此掩盖行为性验证。

### 4.2 Evidence pre-check

`pre-check-evidence.ts` 接受 `--contract` 参数并只读取 contract 的 receipt list。它逐项验证文件存在、非空、JSON 可解析、receipt identity 与 contract requirement 一致、artifact hash 可重算、实际 evidence level 满足 requirement level。它不以 `readdirSync(evidenceDir)` 的结果决定成功或失败；目录内的未引用文件仅报告为 orphan warning，不让它替代或补足 contract。

当 receipt path 无法读取，结果状态必须区分：`FOUND` 表示存在且一致，`NOT_FOUND` 表示已成功定位但不存在，`UNAVAILABLE` 表示权限或解析环境阻断。只有 `FOUND` 可以计入验收。

### 4.3 Evidence ceiling 与 verdict

审计 contract 的 required level 是下限，不是提示。`component` receipt 面对 `integration` requirement 时：

- verdict 为 `ACCEPT`：validator 返回固定错误并拒绝签署；
- verdict 为 `BLOCKED` 或 `INVALID`：可以记录降级事实、受影响 requirement 与下一步，但绝不称为通过；
- 任何 report 或 `LATEST.md` 不得以“expected downgrade errors”把非零 validator 转写为 accepted。

### 4.4 受控渲染与状态发布

新增 `finalize-audit.ts`，输入为已经完整填写的 contract。命令按固定顺序执行：

1. 解析并 schema-check contract；拒绝占位 token、默认 verdict、空 requirement identity、空 command 和无 cwd 的 shell command。
2. 运行 contract 驱动的 pre-check。
3. 调用可复用的 audit validation API；若 verdict 为 `ACCEPT`，所有验证必须 exit 0。
4. 以 `wx` 写入不可变 report 文件，对它运行渲染一致性检查；该 report 在被 `LATEST.md` 指向前不是已发布结论。
5. 渲染含 report 相对路径、report SHA-256、verdict 与 evidence ceiling 的临时 `LATEST.md`，校验后以单次原子 rename 切换该指针。

若任一步失败，保留原有 `LATEST.md`；未被指向的新 report 仅作为 orphan 候选，不代表发布。`prepare-audit.ts` 改为只协助创建 schema-complete contract，不再写 `REPLACE_*`、默认 `ACCEPT` 或已知无效的命令字段。

### 4.5 Plan checkbox 规则

`validate-plan.ts` 的 checkbox 检查只取 `## Phase completion gate` 区块。规则固定如下：

| Progression status | gate 规则 |
|---|---|
| `NOT_STARTED`、`IN_PROGRESS`、`BLOCKED`、`INVALID` | 至少一个 checkbox 且全部为 `[ ]` |
| `ACCEPTED` | 至少一个 checkbox 且全部为 `[x]`，并有非空 completion receipt |

整份 phase 文件不再要求出现与 gate 无关的 `[ ]`。这项变更与既有 progression blueprint 的 `ACCEPTED` 约束一致。

---

## 五、实施范围与阶段

| 阶段 | 唯一交付 | 主要文件 | 证据层级 |
|---|---|---|---|
| 01 | completion gate 语义与回归测试 | `validate-plan.ts`、其测试 | component |
| 02 | contract 驱动的 receipt pre-check | `pre-check-evidence.ts`、其测试 | component |
| 03 | ceiling/verdict 不可上浮规则 | `validate-audit.ts`、模板、skill、其测试 | component |
| 04 | canonical contract 到 report/LATEST 的原子渲染 | `prepare-audit.ts`、`finalize-audit.ts`、其测试 | component + file integration |
| 05 | 文档合同、端到端 fixture 与闭合验证 | 两个 skill、`AGENTS.md`、集成测试 | integration |

每个阶段开始前必须遵守该 plan 的 Freeze Gate。若 human-approved scope-lock 或 pre-change receipt 缺失，实施者必须标记 `BLOCKED`，不写代码，不修改下一阶段状态。

---

## 六、验证策略

### 6.1 All-pass fixtures

- 一个最小 PLAN_SET，含未开始 phase 和已接受 phase，各自使用正确 checkbox 与 receipt。
- 一个 audit directory，contract 显式引用顶层和嵌套 receipt；每个 receipt 含匹配 identity、hash 与 level。
- 一个 `integration` requirement 使用 `integration` receipt，contract verdict 为 `ACCEPT`。
- 一个已有有效 report 与 `LATEST.md`，用于验证 finalize 失败时的零写入。

### 6.2 单一变异矩阵

| 基线 | 唯一变异 | 预期固定结果 |
|---|---|---|
| 未开始 phase | 勾选一个 gate | `PHASE_COMPLETION_GATE_MISMATCH` |
| 已接受 phase | 去掉一个勾选 | `PHASE_COMPLETION_GATE_MISMATCH` |
| contract receipt | 将路径移到 audit directory 外 | path-boundary error |
| 嵌套 receipt | 删除该 receipt | `NOT_FOUND`，pre-check 非零 |
| integration requirement | receipt level 改为 component | evidence-level error，`ACCEPT` 非零 |
| 已有效发布物 | 令一个 receipt hash 错误 | finalize 非零，两个旧发布物 byte-for-byte 不变 |
| valid contract | 加 `REPLACE_COMMAND` | contract error，零写入 |

### 6.3 固定验证

所有命令从 `/home/zhaoge/workspace/qoderwork/.worktrees/check-plan` 运行：

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
bun test .agents/skills/deterministic-implementation-planning/scripts/validate-plan.test.ts
bun test .agents/skills/plan-audit-archiver/scripts/pre-check-evidence.test.ts
bun test .agents/skills/plan-audit-archiver/scripts/validate-audit.test.ts
bun test .agents/skills/plan-audit-archiver/scripts/finalize-audit.test.ts
bun test .agents/skills/plan-audit-archiver/scripts/audit-governance-integration.test.ts
bun run typecheck
git diff --check
```

通过上述测试只能证明 component 和文件级 integration 合同；不得把它描述为 runtime-smoke 或 live-LLM-E2E。

---

## 七、风险、回滚与发布

| 风险 | 防护 |
|---|---|
| 新 contract 造成历史审计不可读 | validator 保留 legacy read-only 模式；不迁移、不改写历史文件 |
| 渲染中覆盖协作者状态 | immutable report、报告 hash 绑定的 LATEST 单指针原子 rename、before-hash guard |
| 预检减少目录扫描后漏掉垃圾文件 | orphan 作为 warning 报告；contract receipt list 仍为签署唯一权威 |
| 测试只证明 mock 路径 | 在每个共享函数测试注明 `FAKE-INJECTION`；至少一例真实文件 I/O 路径 |
| 规则仍被文档绕过 | skill 和 `AGENTS.md` 固定 finalize 唯一路径；禁止手工更新 `LATEST.md` |

回滚只允许恢复本次变更的脚本、模板和说明；保留失败 contract、receipt、测试输出和已存在 audit。不得删除证据、倒签 verdict 或以人工编辑 `LATEST.md` 修复状态。

---

## 八、实施后的可审计结论

完成后，审计工作的实质证据仍然是 scope、oracle、fixture、命令和 receipt；报告与状态页是同一 contract 的可读投影。由此删除的是重复录入和浅扫描假阳性，不是独立验证、负例或 fail-closed gate。
