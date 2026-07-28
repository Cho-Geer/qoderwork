# Blueprint: TodoWrite 驱动的弱模型自治执行与强模型关键监督

**创建日期**: 2026-07-12
**更新日期**: 2026-07-28
**状态**: 已完成
**相关蓝图**: 无

> **版本**: v1.2.0
> **日期**: 2026-07-07
> **状态**: Phase 1/2/4 完成度提升；G5 smoke 7/7 PASS，Phase 3 可选增强未完成
> **优先级**: P1
> **适用项目**: `/home/zhaoge/workspace/qoderwork` + `/home/zhaoge/workspace/opencode/work-one`
> **核心目标**: 保留 OpenCode 弱模型的主导推理权和任务完成责任，同时让 QoderWork 强模型只在关键节点做把关、纠偏、干预和最终验收，控制 token 消耗并提高最终完成度。

---

## 0.1 2026-07-07 实施进度复核

本次复核结合了 qoderwork 脚本、`.qoder/skills` 文档、work-one TodoWrite/quality hook 代码，以及 `e2e/todowrite-supervision-e2e.md`。

总体结论：TodoWrite 驱动的弱模型自治 + 强模型关键监督闭环已经在 QoderWork 侧形成可用 MVP。`tree-watcher.ts` 能观察 session tree、SSE 与 `quality.jsonl`，输出 evidence capsule 与 L0-L4 干预建议；serve-api 与 pre-flight skill 文档已经补齐入口；D.1/D.2/D.3 E2E 记录为 PASS。仍未完成的是 work-one 可选质量信号增强、自动强模型 review 接口，以及对 dispatch privilege 的真实闭环验证。

| 阶段 | 当前状态 | 已完成 | 遗留任务 |
|------|----------|--------|----------|
| Phase 1 QoderWork-only watcher MVP | 完成 | `scripts/tree-watcher.ts` 已实现 tree 轮询、SSE tail、quality tail、pending question/tool failure 归集、evidence capsule、L0-L4 policy、`--suggest-guide` | 若后续要求无人值守干预，再增加 auto-guide；当前默认不自动发送是符合设计的 |
| Phase 2 skill 文档与强模型模板 | 完成 | `.qoder/skills/serve-api/SKILL.md` 已加入 §5；`reference.md` 已加入 D 组 E2E；`.qoder/skills/pre-flight-enforcement/SKILL.md` 已加入 Task Contract + Final Gate | 可把 E2E checkboxes 与最新 PASS 状态继续同步 |
| Phase 3 work-one 质量信号增强 | 部分完成/可选 | `quality-contract.ts` 已产生 `todo_write_observed/mismatch/missing/stale/failure_without_recovery`，保持 audit-only | `todo_write_observed` 仍只写 event/policy，未补 total/in_progress/blocked/completed；如 watcher 需要更高质量 capsule，可补 payload 和 smoke test |
| Phase 4 E2E 验证 | 基本完成 | `e2e/todowrite-supervision-e2e.md` 记录 D.1 正常观察、D.2 TodoWrite 信号检测、D.3 Final Gate 为 PASS | D.2 中关于 dispatch privilege 的 PASS 只能证明组件级实现，不能证明 dispatch privilege live E2E；该问题应回到 dispatch privilege blueprint 处理 |

**当前可用结论**:

1. 该 blueprint 的主目标已达到 MVP：强模型可以只看 capsule 和必要 diff/test evidence，在关键节点 guide/rework，而不是逐步接管弱模型。
2. TodoWrite 仍保持 soft-governance，没有升级成 hard gate 或 DB checklist，符合弱模型自治要求。
3. tree-watcher 第一阶段不自动 guide 是正确选择；自动干预应等待更多 E2E 和路由稳定性验证。
4. 需要避免把 D.2 的 dispatch privilege 组件级 PASS 误读为框架维护权限链路完成。

### 0.2 Smoke Test 复核补充（2026-07-07）

`e2e/smoke-test-results-20260707.md` 的 G5 Skill/TodoWrite Regression 为 **7/7 PASS**，可以提升本 blueprint 的运行证据级别：

- `preflight-lite` 默认加载 PASS。
- `skill-summary` 关键词匹配 PASS。
- standard 任务创建 TodoWrite PASS。
- trivial 任务不创建 TodoWrite PASS。
- 工具失败后更新 TodoWrite 并创建恢复任务 PASS。
- 写操作与 `in_progress` todo 关联 PASS。
- skill-policy 未加载 Skill 时 warn PASS。

仍保留的遗留项：

1. 高风险任务是否稳定创建 5-8 个 todo，并覆盖 rollback/handoff，仍需专项 smoke。
2. `quality-contract.ts` 的 `todo_write_observed` payload 仍未补 total/in_progress/blocked/completed；当前不是 MVP 阻断项。
3. G6 证明 REST `/session/{SID}/guide|reply` 端点不存在；本 blueprint 的 watcher `--suggest-guide` 应继续输出 `intervene.ts --mode=guide`，其底层是 `prompt_async`，不是不存在的 guide endpoint。

---

## 0. 当前代码事实

本蓝图基于 2026-07-06 当前本地代码复核，以下能力已经存在，方案优先复用而非重建：

| 能力 | 当前事实 | 设计含义 |
|---|---|---|
| 弱模型 preflight | `.opencode/skills/preflight-lite/SKILL.md` 已要求任务开始前分类风险、选择 skill、按风险决定 TodoWrite 深度 | 可作为弱模型自治执行入口 |
| TodoWrite 工作记忆 | `.opencode/skills/preflight-lite/FULL.md` 明确 TodoWrite 是 weak model short-term execution state machine，不是 compliance gate | TodoWrite 应做状态机，不应升级为硬门禁 |
| TodoWrite 质量信号 | `.opencode/plugin-handlers/after/quality-contract.ts` 已 audit-only 记录 `todo_missing_for_nontrivial`、`todo_stale_after_tools`、`todo_failure_without_recovery`、`todo_write_mismatch` 等事件 | 可作为 QoderWork watcher 的低成本触发信号 |
| 风险提示注入 | `.opencode/plugin-handlers/system/skill-summary.ts` 已按任务风险提示 TodoWrite required/optional | 不必额外常驻长 prompt |
| dispatch prompt | `.opencode/service/dispatch/prompt-builder.ts` 已注入 `preflight-lite`、TodoWrite one in_progress、failure recovery intent | legacy dispatch 路径已有基本协议 |
| serve API 操作 | `qoderwork/scripts/session-tree.ts`、`monitor-tree.ts`、`guide.ts`、`intervene.ts` 已存在 | 可作为监督和干预通道 |
| tree-watcher | `qoderwork/scripts/tree-watcher.ts` 已实现 session tree + SSE + quality.jsonl 观察、evidence capsule、L0-L4 policy、`--suggest-guide` | QoderWork 侧监督闭环 MVP 已可运行 |
| SSE 事件 | `qoderwork/scripts/sse-daemon.ts` 写 `/tmp/sse-events.jsonl` | 可作为实时观察源 |
| JSONL audit | `writeJsonl("quality")` 写 `.task_temp/_logs/quality.jsonl` | 可作为 TodoWrite/quality 观察源 |

2026-07-07 更新：上述工具已经组成 QoderWork 侧 MVP 闭环。当前缺口收敛为三类：work-one 可选质量信号 payload 增强、自动强模型 review 接口、以及与 dispatch privilege 等高风险框架修改链路的专门 E2E。

---

## 一、问题背景

### 1.1 问题描述

QoderWork 强模型指导 OpenCode 弱模型时，如果强模型过度参与执行，会带来三个问题：

1. 强模型 token 消耗过高，变成事实上的主执行者。
2. 弱模型失去自治推理权，只机械执行短指令，无法形成持续上下文判断。
3. 强模型容易被迫阅读大量低价值 transcript，真正关键的风险、偏航和证据不足反而被噪声淹没。

反过来，如果完全放任弱模型执行，只在最后看结果，也会带来三个问题：

1. 弱模型可能跳过 preflight、skill、CodeGraph、验证或 evidence collection。
2. 弱模型可能长时间卡住、反复试错、误判完成状态。
3. 最终返工成本高，甚至产生错误代码、错误文档或不可恢复修改。

因此需要一套中间设计：弱模型仍是任务主要完成方，强模型只在关键节点按证据做监督、纠偏和验收。

### 1.2 根因分析

**直接原因**: 当前 TodoWrite、preflight-lite、quality-contract、serve-api 脚本、qoderwork skills 都已存在，但职责分散，没有形成“弱模型 TodoWrite 状态 -> watcher 观察 -> evidence capsule -> 强模型干预 -> 弱模型继续执行 -> 强模型 final gate”的闭环。

**根本原因**: 框架还没有把“强模型控制面”和“弱模型执行面”的权责边界写成可执行协议。TodoWrite 被弱模型使用时只是局部计划工具；QoderWork 观察到 session 时也缺少标准化判断依据和干预等级。

### 1.3 实测与代码验证

本蓝图不基于抽象假设，已通过代码审查确认：

1. `preflight-lite` 已具备 TodoWrite 分级规则：trivial 不需要 TodoWrite，standard 创建 3-5 条，high-risk 创建 5-8 条，blocked 创建 blocked todo 并提问。
2. `preflight-lite/FULL.md` 明确禁止将 TodoWrite 同步为 DB checklist/DAG，也禁止把 TodoWrite 当 compliance gate。
3. `quality-contract.ts` 当前是 audit-only，不阻断弱模型，这符合“弱模型自治优先”的方向。
4. `skill-summary.ts` 已有风险判断和 TodoWrite required/optional 提示，可作为系统提示层轻量入口。
5. `prompt-builder.ts` 已在 dispatch prompt 中要求加载 `preflight-lite` 并使用 TodoWrite 作为 external working memory。
6. `serve-api` skill v1.3 及 qoderwork scripts 已提供 session tree、monitor、guide、intervene 基础能力。

**结论**: 最佳改造方向仍不是新增重型 gate，而是复用现有 TodoWrite 和 skill 机制。QoderWork 侧 watcher、evidence capsule、intervention policy 和 final gate 已完成 MVP；后续应增强证据质量和自动化，而不是把 TodoWrite 改成硬门禁。

---

## 二、解决方案

### 2.1 方案对比

| 维度 | 方案 A: 强模型主控逐步指挥 | 方案 B: TodoWrite 弱模型自治 + 强模型关键监督 | 方案 C: TodoWrite 硬门禁 | 方案 D: 只做最终审查 |
|---|---|---|---|---|
| 核心思路 | 强模型拆到步骤级，弱模型逐条执行 | 弱模型用 TodoWrite 自治执行，强模型只看证据和关键节点 | 每个非平凡动作强制 TodoWrite 合规，否则阻断 | 弱模型全程自由执行，强模型最后验收 |
| 弱模型自治 | 低 | 高 | 中低 | 高 |
| 强模型 token | 高 | 中低 | 中 | 低 |
| 质量提升 | 中高，但成本高 | 高 | 中，容易卡死 | 低到中 |
| 死循环风险 | 中 | 低 | 高 | 低 |
| 现有机制复用 | 中 | 高 | 中 | 低 |
| 推荐程度 | 不推荐默认使用 | 推荐 | 不推荐默认使用 | 仅适合简单任务 |

### 2.2 选择结论

选择 **方案 B: TodoWrite 弱模型自治 + 强模型关键监督**。

理由：

1. 符合用户目标：弱模型拥有自己的推理权和执行主责。
2. 符合当前代码事实：TodoWrite 已被定义为弱模型外部工作记忆，`quality-contract.ts` 已是 audit-only。
3. token 成本可控：强模型只消费 evidence capsule，不读取完整 transcript。
4. 风险可控：遇到 TodoWrite 缺失、陈旧、阻塞、测试失败、证据不足时再介入。
5. 可渐进实施：第一阶段主要在 qoderwork 侧新增 watcher，不需要先大改 work-one。

### 2.3 否决理由

方案 A 否决原因：强模型会变成实际执行者，长期 token 成本不可控，也会削弱弱模型的任务主责。

方案 C 否决原因：TodoWrite 本质是工作记忆，不是 DB checklist 或 compliance gate。硬阻断会制造新的 enforcement death loop，并违背 `preflight-lite/FULL.md` 的既有边界。

方案 D 否决原因：只能发现最终错误，不能及时纠偏；对长任务、多 agent 任务、框架修改任务的返工成本过高。

---

## 三、核心设计

### 3.1 总体架构

```text
QoderWork 强模型控制面
  |
  | 1. Task Contract: 目标、范围、约束、验收标准
  v
OpenCode Orchestrator / native child agents 弱模型执行面
  |
  | 2. preflight-lite + TodoWrite 自治执行
  v
Hook / SSE / JSONL 观察层
  |
  | 3. tree-watcher 生成 evidence capsule
  v
QoderWork 强模型关键监督
  |
  | 4. observe / ask / guide / redirect / stop-gate
  v
OpenCode 弱模型继续执行
  |
  | 5. artifact map + test/log evidence
  v
QoderWork final gate
```

### 3.2 Task Contract

强模型在任务开始只输出 contract，不输出逐步实现细节。

建议格式：

```markdown
## Task Contract

Goal: [一句话目标]
Scope: [允许修改/读取的路径或模块]
Non-goals: [明确不做什么]
Required skills: [preflight-lite, codegraph-first, ...]
Acceptance criteria:
- [可验证标准 1]
- [可验证标准 2]
Evidence required:
- [必须提供的日志/测试/diff/文档]
Risk notes:
- [高风险点]
Escalation triggers:
- [何时必须询问或等待指导]
```

设计原则：

1. Contract 只定义边界和验收，不剥夺弱模型内部推理空间。
2. Contract 控制在 300-800 token，避免把强模型输出变成长 prompt。
3. Contract 必须包含 evidence required，否则最终验收会退化为听弱模型自述。

### 3.3 弱模型 TodoWrite 自治协议

弱模型在 `preflight-lite` 后创建 TodoWrite，并负责维护。

标准任务建议 TodoWrite 覆盖：

1. Evidence: 读取代码、配置、日志、文档。
2. Plan: 明确执行路径和关键风险。
3. Implement: 实施变更或产出文档。
4. Validate: 测试、构建、日志验证或 E2E。
5. Report: 输出 artifact map、剩余风险和完成状态。

高风险任务建议增加：

1. Impact: CodeGraph impact / callers / callees。
2. Rollback: 回滚或恢复策略。
3. Handoff: 长任务 handover 或 final audit package。

约束：

1. Exactly one `in_progress`。
2. 每个 write、validation、Scout/Task action 必须映射到当前 `in_progress`。
3. tool failure 后，先更新 todo 为 recovery intent，再重试。
4. blocked todo 代表需要 question/QoderWork，不代表继续盲目尝试。
5. 不把 TodoWrite 同步为 DB checklist，不作为 hard compliance gate。

### 3.4 QoderWork watcher

新增 `qoderwork/scripts/tree-watcher.ts`，作为强模型控制面的自动观察器。

输入源：

1. `qoderwork/scripts/session-tree.ts <ROOT_SID> --json`
2. `/tmp/sse-events.jsonl`
3. `/home/zhaoge/workspace/opencode/work-one/.task_temp/_logs/quality.jsonl`
4. `GET /question`
5. `GET /session/{SID}/message?limit=N`

输出：

1. human-readable 状态摘要。
2. machine-readable evidence capsule。
3. 可选自动 intervention 建议。

默认不直接调用强模型 API。第一阶段先输出 evidence capsule，由 QoderWork 当前会话或人工触发强模型审查。后续如 QoderWork 提供稳定本地强模型调用接口，再接入自动 review。

### 3.5 Evidence Capsule

强模型每次介入只接收 capsule，不接收完整 transcript。

建议格式：

```json
{
  "rootSessionId": "ses_xxx",
  "taskContractHash": "sha256:...",
  "tree": [
    {"id": "ses_root", "agent": "Orchestrator", "status": "idle"},
    {"id": "ses_child", "agent": "build", "status": "working"}
  ],
  "todoSignals": [
    {"sessionID": "ses_child", "event": "todo_stale_after_tools", "actions_since_update": 3}
  ],
  "recentToolFailures": [],
  "pendingQuestions": [],
  "changedFiles": [],
  "validation": {
    "commandsRun": [],
    "failures": []
  },
  "openRisks": [],
  "recommendedIntervention": "observe"
}
```

生成原则：

1. 默认只保留最近 20-50 条相关事件。
2. 优先保留失败、阻塞、测试、写入、question、TodoWrite 异常。
3. 不复制完整 assistant message，只摘取最新状态和关键证据。
4. 每个 capsule 必须带时间戳、root session、相关 child session。

### 3.6 干预等级

| 等级 | 名称 | 触发条件 | 行为 |
|---|---|---|---|
| L0 | Observe | 正常推进，无明显偏航 | 不发消息 |
| L1 | Ask | 需求不清、assumption 未声明、存在 pending question | 提一个问题或要求弱模型澄清 |
| L2 | Guide | TodoWrite 陈旧、证据不足、验证缺失、轻微偏航 | 发短 guidance，让弱模型自行修正 |
| L3 | Redirect | 修改方向明显错误、scope 越界、反复失败 | 要求停止当前路径，回到指定验证点 |
| L4 | Stop Gate | 高风险越权、测试严重失败、身份/路由错乱、不可逆风险 | abort 或要求等待 QoderWork 决策 |

干预必须短，建议 100-300 token。禁止把完整任务重新解释一遍。

示例：

```text
Current issue: your TodoWrite has been stale for 3 non-trivial tool calls.
Next action: update TodoWrite with current evidence, then run the validation command already required by the task contract.
Do not modify additional files until validation output is captured.
```

### 3.7 Final Gate

弱模型完成后，强模型按 contract 做 final audit。

检查项：

1. TodoWrite 是否全部 completed/canceled/blocked-with-explanation。
2. 变更文件是否在 Scope 内。
3. Acceptance criteria 是否逐项有证据。
4. Evidence required 是否齐全。
5. 测试/构建/E2E 是否运行，失败是否解释。
6. 是否存在遗留风险、回滚说明或 handoff。
7. 弱模型是否把 assumption 当事实。

Final Gate 输出：

1. Accept: 任务可接受。
2. Rework: 给出具体返工包。
3. Stop: 风险未解除，需用户决策。

### 3.8 与 qoderwork skills 的关系

| qoderwork skill | 在本蓝图中的职责 |
|---|---|
| `.qoder/skills/serve-api` | session tree、SSE、guide、intervene、question reply 的操作手册 |
| `.qoder/skills/pre-flight-enforcement` | 强模型自身执行监督流程时的约束 skill，避免强模型跳过 contract/final audit |
| `.qoder/skills/opencode-framework-dev` | 框架调试、hook 验证、JSONL/log/DB 复核流程 |
| `.qoder/skills/log-first-debugging` | 当弱模型卡在 bug/root cause 时，要求先日志验证再结论 |
| `.qoder/skills/blueprint-creation` | 后续框架级改动继续按 blueprint 标准设计 |

### 3.9 子系统合规审计

| # | 子系统 | 状态 | 检查要点 |
|---|---|---|---|
| 1 | MVC Architecture | 合规 | QoderWork watcher、OpenCode hooks、skills 分层清晰，不把监督逻辑塞进 agent prompt |
| 2 | DB-only & DB-canonical | 合规 | 本方案不新增 DB 控制流，TodoWrite 不同步为 DB checklist/DAG |
| 3 | Permission Matrix | 合规 | 第一阶段不改 agent permission；后续如新增脚本只在 qoderwork 运行 |
| 4 | Concurrency Safe | 需注意 | watcher 只读 SSE/JSONL/REST，不写共享状态；若后续写 checkpoint 文件需 append-only |
| 5 | Hardened Enforcement | 合规 | 不绕过现有 scope/codegraph/permission hooks |
| 6 | Framework Harness | 需注意 | E2E 需验证 watcher 不影响 serve API session 生命周期 |
| 7 | Central State Management | 合规 | 状态来源为现有 session tree、SSE、quality.jsonl，不新建第二套任务状态中心 |
| 8 | Multi-Agent | 合规 | 以 session tree 为根模型，支持 Orchestrator + child agents |
| 9 | Log Central Management | 合规 | work-one 侧继续走 `writeJsonl` / `writeLog`；qoderwork 脚本独立输出 |
| 10 | DB-canonical Management | 合规 | 无 schema 变更；不新增 DB 表 |
| 11 | Templatization & Parameterization | 需注意 | watcher 阈值和路径必须 CLI 参数化，避免硬编码端口/路径 |
| 12 | TypeScript + Bun Runtime | 合规 | 新脚本使用 Bun/TS，无新增 npm 依赖，单文件目标控制在 400 行左右 |

---

## 四、实施清单

### 4.1 文件变更列表

| 序号 | 文件 | 状态 | 说明 |
|---|---|---|---|
| 1 | `qoderwork/scripts/tree-watcher.ts` | 完成 | 监听 session tree、SSE、quality.jsonl、question，输出 evidence capsule 和干预建议 |
| 2 | `qoderwork/scripts/evidence-capsule.ts` | 未拆分/暂不需要 | 当前 capsule 逻辑内聚在 `tree-watcher.ts`，MVP 可接受；只有脚本继续膨胀时再拆 |
| 3 | `qoderwork/.qoder/skills/serve-api/SKILL.md` | 完成 | 已增加 TodoWrite-driven supervision 使用入口和 watcher 命令 |
| 4 | `qoderwork/.qoder/skills/serve-api/reference.md` | 完成 | 已增加 D 组 E2E 场景；checkbox 状态可继续同步最新 PASS |
| 5 | `qoderwork/.qoder/skills/pre-flight-enforcement/SKILL.md` | 完成 | 已增加 Task Contract + Final Gate 检查模板 |
| 6 | `work-one/.opencode/plugin-handlers/after/quality-contract.ts` | 部分完成/可选 | 已有 TodoWrite 质量事件；`todo_write_observed` 尚未补 total/in_progress/blocked/completed |
| 7 | `work-one/.opencode/skills/preflight-lite/SKILL.md` | 待确认/低优先级 | 当前行为已满足 soft-governance；是否补短句取决于后续误用情况 |
| 8 | `e2e/todowrite-supervision-e2e.md` | 完成 | 已记录 D.1/D.2/D.3 端到端验证结果 |

### 4.2 实施步骤

**Phase 1: QoderWork-only 监督闭环 MVP（完成）**

1. 新建 `tree-watcher.ts`，复用 `session-tree.ts`、`monitor-tree.ts` 的树查询逻辑。
2. tail `/tmp/sse-events.jsonl` 和 `.task_temp/_logs/quality.jsonl`。
3. 识别 `todo_missing_for_nontrivial`、`todo_stale_after_tools`、`todo_failure_without_recovery`、`todo_write_mismatch`。
4. 输出 evidence capsule，不自动 abort。
5. 支持 `--suggest-guide` 输出可复制给 `intervene.ts guide` 的短 guidance。

当前保留为建议模式，不自动调用 `intervene.ts`，以避免误判时削弱弱模型自治。

**Phase 2: 强模型干预模板与 qoderwork skill 文档（完成）**

1. 更新 `.qoder/skills/serve-api/SKILL.md`，加入 watcher 入口。
2. 更新 `.qoder/skills/pre-flight-enforcement/SKILL.md`，加入强模型 contract/final gate 模板。
3. 在 `reference.md` 增加 3 个监督场景。

**Phase 3: work-one 质量信号增强（部分完成，可选继续）**

1. 增强 `quality-contract.ts` 的 `todo_write_observed` payload。
2. 保持 `policy: "soft-governance"`，不改为 block。
3. 添加 smoke test 或 framework-self-test 检查 JSONL 字段。

当前 `quality-contract.ts` 已产生 watcher 所需事件，增强 payload 不是 MVP 阻断项。

**Phase 4: E2E 验证（基本完成）**

1. 启动 serve 和 SSE daemon。
2. 创建 Orchestrator session，触发 standard task。
3. 验证弱模型创建 TodoWrite 并自主推进。
4. 人为构造 stale todo 或 blocked todo，验证 watcher 输出 guide。
5. 通过 `intervene.ts guide` 注入短 guidance。
6. 验证弱模型继续执行并产出 final artifact map。
7. 强模型按 final gate 验收。

已完成 D.1 正常观察、D.2 TodoWrite 信号检测、D.3 Final Gate。注意：D.2 中 dispatch privilege 相关结论只作为组件级实现证据，不作为 dispatch privilege live E2E 通过证据。

---

## 五、验证计划

### 5.1 单元测试

- [x] `tree-watcher.ts` 能解析 session-tree JSON。
- [x] `tree-watcher.ts` 能解析 `/tmp/sse-events.jsonl` 最近事件。
- [x] `tree-watcher.ts` 能解析 `.task_temp/_logs/quality.jsonl` 中 TodoWrite 相关事件。
- [x] evidence capsule 生成结果包含 rootSessionId、tree、todoSignals、pendingQuestions、recommendedIntervention。
- [x] intervention policy 能把 missing/stale/blocked/mismatch 映射到 L1-L4。

### 5.2 集成测试

- [x] serve API running 时，watcher 能持续刷新 session tree。
- [x] Orchestrator 派生 child session 后，watcher 能同时覆盖 root 和 child。
- [x] `quality-contract.ts` 产生日志时，watcher 能在下一轮检测到。
- [x] `intervene.ts guide` 能对正确 session 发送身份保留 guidance。
- [x] question pending 时，watcher 使用 question.sessionID 作为路由依据。

### 5.3 端到端测试

- [x] 标准任务：弱模型创建 TodoWrite，执行、验证、报告完整。
- [ ] 高风险任务：弱模型创建 5-8 个 TodoWrite，包含 evidence、validation、rollback/handoff。
- [x] TodoWrite 缺失：非平凡 tool 先于 TodoWrite 时，watcher 输出 L2 guide 建议。
- [x] TodoWrite 陈旧：连续多个非平凡 tool 后未更新，watcher 输出 stale todo capsule。
- [x] blocked todo：弱模型进入 blocked 后继续动手，watcher 输出 redirect/stop-gate。
- [x] final gate：强模型能仅凭 capsule、diff、测试结果完成验收，不读取完整 transcript。

### 5.4 子系统合规验证

- [x] DB-canonical: 确认没有新增 DB 表，没有把 TodoWrite 写入 checklist/DAG。
- [x] Permission Matrix: 确认没有扩大 OpenCode agent tool permission。
- [x] Log Central: 确认 work-one 侧质量事件仍写 `.task_temp/_logs/quality.jsonl`。
- [x] Multi-Agent: 验证 root + child session 的 TodoWrite signal 能被正确归因。
- [x] TypeScript + Bun: `bun build scripts/tree-watcher.ts --target bun` 通过。

---

## 六、风险与缓解

### 6.1 风险

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| watcher 误判弱模型偏航 | 强模型过早干预，削弱弱模型自治 | 第一阶段只输出 suggestion，不自动 guide/abort |
| TodoWrite 被弱模型形式化维护 | 看似合规但没有真实证据 | final gate 必须检查 diff/test/log，不只看 TodoWrite |
| quality.jsonl 信息不足 | watcher 无法生成高质量 capsule | Phase 3 可选增强 `todo_write_observed` payload |
| session 归因错误 | guidance 发错 agent | watcher 必须依赖 session tree 和 question.sessionID，不靠猜测 |
| 强模型 token 再次膨胀 | 成本失控 | 强制 capsule 输入，不传完整 transcript |
| 干预变成逐步审批 | 弱模型失去主责 | 默认 L0 observe；只有触发条件满足才 L1-L4 |

### 6.2 回滚方案

1. 如果 `tree-watcher.ts` 误报或影响工作流，停止运行 watcher 即可，不影响 OpenCode serve。
2. 如果 qoderwork skill 文档更新造成误导，回滚 `.qoder/skills/serve-api` 和 `.qoder/skills/pre-flight-enforcement` 文档。
3. 如果可选的 `quality-contract.ts` 增强有问题，回滚到仅输出当前 audit-only 事件；不得引入 hard block。
4. 如果 E2E 发现 guidance 路由不稳，禁用自动 guide，仅保留 evidence capsule。

---

## 七、成功标准

- [x] 弱模型在 standard 任务中能主动使用 TodoWrite 并保持一个 `in_progress`。
- [ ] 高风险任务中稳定创建 5-8 个 TodoWrite，且包含 rollback/handoff。
- [x] QoderWork watcher 能在不读取完整 transcript 的情况下识别 TodoWrite 缺失、陈旧、阻塞、mismatch。
- [x] 强模型介入次数减少到关键节点，而不是每个执行步骤。
- [x] 强模型单次介入输入主要是 evidence capsule，token 成本可控。
- [x] 弱模型被 guide 后能继续自主执行，而不是等待逐步指令。
- [x] final gate 能基于 contract、diff、test/log evidence 判定 accept/rework/stop。
- [x] TodoWrite 仍保持 soft-governance，不变成新的硬门禁或 DB checklist。

---

## 八、后续扩展

### 8.1 自动强模型 review 接口

当 QoderWork 提供稳定本地强模型调用接口后，可让 watcher 在 L2-L4 触发时自动提交 evidence capsule，并把强模型输出转为 `intervene.ts guide`。

### 8.2 指标面板

可记录以下指标：

1. 每任务强模型 token。
2. 每任务干预次数。
3. 首次通过率。
4. 返工次数。
5. TodoWrite stale 次数。
6. blocked 后恢复时间。
7. final gate accept/rework/stop 分布。

### 8.3 Contract-aware TodoWrite

后续可让 watcher 检查 TodoWrite 是否覆盖 contract 的 acceptance criteria，但仍保持 soft-governance，只给出 guide，不做 hard block。

---

## 九、相关文件

### 9.1 work-one

- `.opencode/skills/preflight-lite/SKILL.md`
- `.opencode/skills/preflight-lite/FULL.md`
- `.opencode/plugin-handlers/after/quality-contract.ts`
- `.opencode/plugin-handlers/system/skill-summary.ts`
- `.opencode/service/dispatch/prompt-builder.ts`
- `.opencode/lib/jsonl-writer.ts`

### 9.2 qoderwork

- `scripts/session-tree.ts`
- `scripts/monitor-tree.ts`
- `scripts/guide.ts`
- `scripts/intervene.ts`
- `scripts/sse-daemon.ts`
- `.qoder/skills/serve-api/SKILL.md`
- `.qoder/skills/serve-api/reference.md`
- `.qoder/skills/pre-flight-enforcement/SKILL.md`
- `.qoder/skills/opencode-framework-dev/SKILL.md`
