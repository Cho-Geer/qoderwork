# Blueprint: 权限模板驱动的行为型 Enforcement

**创建日期**: 2026-07-17
**更新日期**: 2026-07-28
**状态**: 已完成
**相关蓝图**: 无

**版本**: 1.6.1  
**日期**: 2026-07-15  
**原状态（PHASE-03 前自述）**: 返工中（00R2 已完成源码/dispatcher 集成修复复核；完整 integration 与 live 证据未齐，`BLOCK-PT-02/03` 未解除）  
**优先级**: P1  
**对应待办**: P1 #3（`getAgentShellAllowlist` 退役）+ P1 #5（`legacy-agent-permissions.ts` 退役）

---

## 一、问题背景

### 1.1 问题描述

当前 `safe_shell` 同时从 `opencode.json.agent.*.permission.safe_shell` 读取 per-agent 命令规则，并在 before-hook 与工具执行层重复判断。相同命令会经过身份型 deny/ask、身份型 allowlist、危险命令、可执行计划和脚本内容扫描等多层检查；`explore` 的 `safe_shell: "allow"` 还会产生 `ALL_ALLOWED`，而 `agent_dangerous_bypass` 可按 Agent 身份绕过危险命令规则。

这与框架简化路线的约束冲突：规则处置应由风险类型固定，不能由旧角色身份或 `advisory/strict/locked` 全局模式切换；危险 shell、protected path、CodeGraph 和 repo write 必须始终是不可调安全底线。

### 1.2 直接原因与根本原因

**直接原因**：

1. `getAgentShellAllowlist()` 有 3 个生产调用点：`permission-policy.ts`、`shell-config.ts#getAllowlist()`、`shell-guard.ts#safeBashTool()`。
2. `shell-policy.ts` 又通过 `getAllowlist(agent)` 重复执行身份型 allowlist。
3. `shell-guard.ts` 同时保留 per-agent deny/ask 与 allowlist final guard，before-hook 已判断后仍再次读取身份权限。
4. `_hasAgentDangerousBypass(agent, command)` 允许身份覆盖固定危险规则。
5. `legacy-agent-permissions.ts` 仍作为缺失 active agent 配置时的旧角色 fallback。
6. 原始 weak-model gap 中两份测试 Skill 未部署；00R 后 runtime 已发现两份 Skill 且 source/runtime SHA-256 一致，但 tamper 负向 gate 仍未实测。
7. 00R 曾将 `skill-policy.ts` 接入 DB attestation 并增加专用硬阻断，但 writer/validator 的 identity 权威源不一致；00R2 已改为共用 canonical resolver，仍待真实 root/child lifecycle 与 live session 验证。
8. `skill_read_state` 已包含 required-set/file hash 等字段并有 targeted tests；旧 root-session `dag_task_id` 缺失导致的正向死锁已在源码修复，但修复后的 `verified:true` root/child 正向路径尚未重跑。
9. 00R2 已经过真实 before-dispatcher 覆盖无认证 `safe_edit`/`safe_shell` 的专用阻断；但仍未执行完整工具矩阵、真实 executor/目标状态、fault、20 轮 concurrency 和 mutation，不能由 6/6 dispatcher 或 52/52 相关回归推导 T-PT-039–045 已完成。
10. 专用 `skill-read-attest-required` 为 `hard_block`；00R2 已将 active `.opencode/project.config.json` 调整为 `skill-policy` 在 `tool-governance` 前，并有 dispatcher 级支持证据。退役的 `phase0-enforce.ts`、legacy `checklist-validate.ts` 和源码 `DEFAULT_ORDER` 仍不能单独作为 live runtime 顺序证据。

**根本原因**：权限配置把三类不同责任混在一起：OpenCode 原生工具可见性、框架安全底线、Agent 工作便利度。结果是身份既决定“能否使用工具”，又决定“某个行为是否危险”，无法形成稳定、可审计的行为型 enforcement。

### 1.3 实测验证

| 类型 | 证据 | 结论 |
|---|---|---|
| `[ANALYSIS]` | CodeGraph `callers/impact getAgentShellAllowlist` | 3 个生产调用点；变更影响 15 个符号，覆盖 governance、file-guard 与测试链 |
| `[ANALYSIS]` | live 源码审查 | `safeBashTool()` 当前有 7 类检查，其中 per-agent deny/ask 与 allowlist 是待迁移身份判断；verified plan、dangerous pattern、script scan 是行为判断 |
| `[VERIFICATION]` | 2026-07-14 targeted Bun baseline | permission-policy、shell-policy、safe-bash-core、permission-equivalence 共 `52 pass / 0 fail` |
| `[VERIFICATION]` | serve API session `ses_0a1c52ebdffe98AUmnRzAdsMEh` | Orchestrator 调用 `safe_shell cat package.json` 完成；`audit.jsonl` 记录 `governance_allow`，证明 before governance 位于工具执行之前 |
| `[VERIFICATION]` | OpenCode 1.17.18 临时配置解析 | `agent.permission_template` 不出现在 resolved Agent；`agent.options.permission_template` 被完整保留 |
| `[VERIFICATION/HISTORICAL]` | 00R 前 `opencode debug skill` | 当时未发现两份测试 Skill；00R 后 discovery/hash artifact 已解除该部署前置 |
| `[ANALYSIS/HISTORICAL]` | 00R 前 `skill-policy.ts:62-91` | 当时只写 WARN；00R 后已存在 DB-backed 专用 hard-block，旧结论不得描述为当前实现 |
| `[ANALYSIS/HISTORICAL]` | 00R 后 active 链与状态契约审查 | 当时 writer/validator identity 来源不一致，project config active order 为 `tool-governance` 在 `skill-policy` 前；retired/legacy handler 不构成证据 |
| `[VERIFICATION/CURRENT]` | 00R2 源码、authoritative config 与真实 before-dispatcher 复跑 | shared identity resolver、`skill-policy < tool-governance`、专用 hard block 均成立；证据层级仅至 dispatcher integration，不能外推为 live E2E |
| `[VERIFICATION]` | `e2e-evidence/L3/permission-template-enforcement/t003-t004-attest-harness.json` | 真实 `recordRead + verifyRead + attestSkillRead` 隔离集成中，T-PT-003 得到 `verified:true`；T-PT-004 的认证半部得到 `verified:false` |
| `[VERIFICATION]` | `execution-report-t003-t004.md` + `t004-write-block-static-evidence.txt` | T-PT-004 的“写工具次数为 0”未成立；当前证据只能支持认证契约半部，不能支持弱模型写入硬门完成 |

**结论**：permission template 核心实现不因该 gap 自动失效，但“弱模型可以安全可靠交付”的完成声明必须冻结。返工必须保留 T-PT-004 的零写入 oracle，新增 DB-canonical Skill 读取硬门；不得把式样书降级为 WARN/audit-only 来迁就当前实现。迁移仍必须把 Agent 身份降级为“模板选择器”，把行为处置集中到 tool-governance；执行层只保留不可绕过的行为型 final guard。直接新增 `agent.permission_template` 不可靠，绑定必须放在 OpenCode 官方保留的 `agent.*.options` 容器。

### 1.4 PT-WM-00R 历史证据审核（2026-07-14）

审核输入为 `rework-pt-wm-00r/execution-report-reviewer-live-e2e.md`、对应原始 artifact、当前 SQLite 状态、active config、生产调用链和两组 targeted tests。Reviewer 不接受报告中的 `PARTIAL` 状态；执行结果只能使用 `PASS`、`FAIL`、`BLOCKED`、`NOT-RUN` 或 `INVALID`。

| 项目 | Reviewer 裁决 | 可接受边界 |
|---|---|---|
| T-PT-001 | `PASS`（runtime-smoke） | runtime 已发现两份测试 Skill，source/runtime SHA-256 一致；`BLOCK-PT-01` 已解除 |
| T-PT-002 | `NOT-RUN` | artifact 明示未制造 tamper；“没有 diff”不能替代删除/改写 runtime copy 的负向用例 |
| 11 个新增 Bun tests | supporting component evidence | Reviewer 重跑得到 `11 pass / 0 fail`；但不能替代 T-PT-039–045 的真实 DB、active dispatcher、fault、concurrency 和 mutation 用例 |
| T-PT-004 | `NOT-RUN` | live evidence 只证明 root `dispatch_subagent` 被阻断；没有按式样书经 active dispatcher 尝试 `safe_edit`，也没有完整 executor counter |
| T-PT-046 | `NOT-RUN` | DB artifact 查询失败，read/write response 均 aborted；未形成完整 allowlist、unknown tool、state 和零执行证据链 |
| T-PT-047 | `FAIL` | 认证状态为 `verified:true`，但 root session 的 canonical task scope 解析为空，正向 dispatch 被硬门阻断 |

**历史裁决：`REWORK`。** 原报告提出“解除 `BLOCK-PT-02`”不予接受；T-PT-004 的精确负向路径仍未执行。该审核发现 writer/validator identity 不一致，以及当时 authoritative active order 中 `tool-governance` 早于 `skill-policy`。这些是 00R2 的返工输入；其修复后的复核见下一节，历史 first-failure 不得删除或改写。

### 1.5 PT-WM-00R2 源码与 dispatcher 集成复核（2026-07-14）

审核重读 `rework-pt-wm-00r2/integration-evidence.md`、00R/00R2 日志、当前源码及配置，并由 Reviewer 在当前工作树复跑：

- `bun test ./.opencode/plugins/__tests__/skill-hard-gate-integration.test.ts`：`6 pass / 0 fail`。
- `bun test ./.opencode/service/session/__tests__/skill-attest.test.ts ./.opencode/plugin-handlers/before/__tests__/skill-policy.test.ts ./.opencode/service/tool-governance/__tests__/`：`52 pass / 0 fail`。
- 当前源码中 `resolveSkillAttestationIdentity()` 同时被 writer 和 validator 调用；root 使用 `session:<sessionID>`，child 使用 `task:<dag_task_id>`；caller `task_id` 仅保留为审计字段。
- authoritative `.opencode/project.config.json` 与 dispatcher `DEFAULT_ORDER` 均为 `skill-policy < tool-governance`；`skill-read-attest-required` 为 `hard_block`。

**可接受结论**：00R2 已在源码和真实 before-dispatcher（临时 DB/worktree）层修复旧 identity/order 缺陷，并支持无认证 `safe_edit`、`safe_shell` 被专用 rule 阻断。该测试直接调用 before hook，未启动隔离 serve 或真实 LLM session；也没有“少读/截断读→attest:false→真实 executor counter=0→目标状态不变”、root/child 认证后正向、fault、20 轮 concurrency、mutation 或 live E2E 的原始证据。因此：

- `BLOCK-PT-02`：保持 `BLOCKED`。00R2 已有 supporting integration evidence；本轮 live 运行实际证明首个未认证写入在 dispatcher 被拒绝且目标不变，但没有发生所要求的 `attest:false` 工具调用，完整 T-PT-004 oracle 失败。
- `BLOCK-PT-03`：保持 `BLOCKED`，旧源码缺陷已修复，但规定的 lifecycle/live/replay/fault/concurrency/mutation 证据未完成。
- `T-PT-047`：保留历史 `FAIL` first-failure；本轮 live 尝试再次未调用 `skill_read_attest`，故也不能证明修复后的 root/child 正向路径；不可用源码或 component 绿替代。
- `L3-012`：历史 core artifact `L3/L3-012/` 可复查到 `safe_shell gh issue create` 被 `[REPO-OP]` / `repo-policy` 拒绝，维持其历史 repo-policy PASS。空的 `L3-012-repo-op-deny/` 是未见证尝试；有 `execution.json` 的 `L3-012-repo-op-deny-rerun/` 则只命中 `skill-read-attest-required`，未触达 `remote_repo_write` grant。三者必须分列，rerun 不得作为 grant 验证或替代 core 结论。

### 1.6 G1 live failure 复核（2026-07-14）

审核 `logs/2026-07-14-pt-wm-00r2-failure-record-g1.md`、`rework-pt-wm-00r2/live-e2e/session-evidence.json`、当前 active dispatcher/config/source 以及 `.task_temp/_logs/` 后，得到以下可复查结论：

| 项目 | 当前裁决 | 证据与边界 |
|---|---|---|
| T-PT-004 live 的初始拒绝 | `PASS`（子断言） | real Orchestrator session `ses_09f152df1ffeVBFZAFaxJg2D3b` 的 `dispatch_subagent` 在约 2ms 内以 `skill-read-attest-required` 失败；当前 config 与 dispatcher 代码均令 `skill-policy < tool-governance`。 |
| T-PT-004 live 的 `attest:false` 断言 | `FAIL` | toolCalls 中没有 `skill_read_attest`；因此没有可观察的 `verified:false` response，不能把“未调用”写成“显式拒绝”。 |
| T-PT-004 live 零执行/副作用 | `PASS`（子断言） | 所有 tool call 均为 error，目标文件内容与 hash 保持原值；但这不是 executor boundary counter，不能取代完整 integration oracle。 |
| T-PT-047 LLM 合规子断言 | `FAIL` | LLM 只加载 `preflight-lite`，随后 `task` 命中独立的 `DISPATCH-INTEGRITY` 缺 token 门；未调用 `skill_read_attest`，并在 90 秒 timeout。 |
| 实现层结论 | 未被该失败推翻 | `attestSkillRead()` 的未读分支明确返回 `verified:false`；00R2 active-dispatcher 集成也直接覆盖此分支。live prompt 却要求“不要调用其他工具”，与期待 LLM 主动 attest 的断言冲突，故这是 live test 驱动/覆盖失败，不能据此断言未读分支不存在。 |

**固定修正**：T-PT-004 拆为两个不可互相替代的执行观察。确定性 integration 子用例必须由 reviewer 直接执行"少读或截断读 → `skill_read_attest` 返回 `verified:false` → active dispatcher 拒绝 → executor counter=0 → target 不变"；live 子用例只断言真实 LLM 已发生的未认证写入拒绝、零副作用与 session 收敛。认证后的 root/child 正向行为继续由 T-PT-051 与重跑 T-PT-047 验证。任何 `DISPATCH-INTEGRITY` 错误均须与 skill-policy 拒绝分开记录。

### 1.7 G2-G4 测试脚本落地（2026-07-14/15）

12 个测试脚本（T-PT-039/040/041/042、T-PT-048/049/050/051/052、ADV-PT-008/009/010）以 `DRY_RUN=true` 代码骨架形式落盘，共 4551 行，全部 `bun parse OK`，统一 import `./lib/serve-api-client`（§1.1/§4 全条款封装），头部均含 9-10 个 `[x] §X.Y` preflight-enforcement 注释。12 个 evidence 目录全部创建，含 `evidence.json` + `checklist.md`。

**当前状态**：全部 `READY (not executed)`。不真跑 mutation，不修改 work-one 任何源码。真跑前置条件：reviewer 启动隔离 serve + H2 授权 + `FRAMEWORK_SKILL_READ_HARD_GATE=1`。T-PT-051 额外需 `DRY_RUN=false` + `H2_AUTHORIZED=true` + `FRAMEWORK_SKILL_READ_HARD_GATE=1` 三重条件。

**G1 live failure 后续发现**：T004 实际触发了**两个不同硬门**（① `dispatch_subagent` 命中 `skill-read-attest-required`，③ `task` 命中 `DISPATCH-INTEGRITY` 缺 token 门），handoff E.1 未区分。该发现已记录于 `logs/2026-07-14-pt-wm-00r2-failure-record-g1.md`。

**opencode 4097 question**：QID `que_f613576b9001D3ig6qA8KxMCMU`（SID `ses_09f2775faffed6eHx306EeEIJo`）的“请求 guidance token”是 2026-07-14 的历史记录。2026-07-15 审核时 4097 端口无法连接，故其当前 pending/closed 状态**未经验证**；不得把历史“仍挂起”写成当前事实。不构成对 work-one 代码的修改。

**`BLOCK-PT-02/03` 均保持。§7.1 账本不变；本节仅记录脚本落盘事实，不改变任何 test ID 的执行状态。**

### 1.8 G5 脚本与证据复核（2026-07-15）

本轮逐项确认 12 个 G2–G4 目录均含对应 `*-evidence.json` 与 `*-checklist.md`（ADV-PT-009 另有 schedule），12 个脚本合计 4551 行。脚本在默认环境实际进入 `DRY_RUN=true` 分支并写出计划 artifact。除 T-PT-048 的 4 个静态 fixture-shape 断言为 true 外，其余 artifact 的实际观察值为 `null` 或 placeholder，且没有完整 test/charter oracle 的 PASS。T-PT-048 自身也明确要求后续真实 `attestSkillRead`、DB/session-map 与 mismatch 验证，因此这只构成静态 supporting evidence。结论仍是：计划生成器可运行，不证明任何 T-PT 或 ADV-PT 已完成。

本轮同时复核了 T-PT-042 runner 修复日志与再生成 artifact。早先审核曾发现 `_b_pt_wm_00r2_g2_t042.ts` 错把 `list` 与 `skill_read_state` 列为未认证 allowlist，并遗漏源码固定 allowlist 中的 `config_read_attest` 与 `rule_read_attest`；当前已按 `skill-policy.ts` 的权威集合 `read`、`glob`、`grep`、`question`、`skill`、`config_read_attest`、`skill_read_attest`、`rule_read_attest` 修正。重新生成的 `t042-evidence.json` 与 `t042-checklist.md` 仍标记 `dryRun:true`，allowlist 已不再含 `list`/`skill_read_state`。因此 T-PT-042 的 **runner 实例已不再是 INVALID**，但 **T-PT-042 执行裁决仍为 BLOCKED**，因为 dry-run 只证明计划 artifact 与源码集合一致，不改变任何 live/integration verdict。

**本轮裁决**：确认 `logs/2026-07-15-pt-wm-00r2-t042-runner-fix.md` 与当前 runner、artifact、`skill-policy.ts` 一致；不修改 work-one 代码，不改变 `BLOCK-PT-02/03`，也不将 G2–G4 的任何 test ID 改为 PASS。后续真跑顺序先完成 T-PT-048/049/050 的真实前置，再执行 T-PT-039–042、T-PT-051/052 和 ADV-PT-008–010。

---

## 二、解决方案

### 2.1 方案对比

| 维度 | A. 全局单 allowlist | B. per-agent 权限继续精简 | C. 命名模板 + 行为型 enforcement |
|---|---|---|---|
| 核心思路 | 所有 Agent 使用同一命令集合 | 保留每个 Agent 的命令 map，仅删除重复 caller | Agent 只绑定 `default/confirm/trusted`，规则按行为评估 |
| 安全边界 | 简单但无法表达工作负载差异 | 身份继续决定危险行为 | 固定安全内核不可覆盖，模板只调非底线项 |
| 维护成本 | 低 | 高，配置重复 | 中，模板单源、绑定轻量 |
| 迁移风险 | 容易过宽或过窄 | 小，但不解决根因 | 可通过两阶段 rollout 控制 |
| P1 #3/#5 闭环 | 仅部分 | 否 | 是 |

**选择 C**。它保留 active agent 的最小差异，但差异只能来自命名模板；危险 shell、protected path、CodeGraph、repo write 的 disposition 不进入模板，从结构上禁止降级。

**否决记录**：

- A：会把 `plan`、`explore`、`build` 的工作负载差异压成一个过宽或过窄集合。
- B：只减少重复代码，不消除 `getAgentShellAllowlist` 与 legacy role fallback。
- 直接使用 `agent.permission_template`：OpenCode 1.17.18 resolved config 实测会丢失该未知字段。
- 新建 DB 权限模板表：模板是静态部署配置，不需要事务、恢复或跨 session 状态；引入 DB 会制造第二权威源。

### 2.2 设计边界

#### 2.2.1 三层权威源

| 层 | 权威源 | 责任 |
|---|---|---|
| 原生工具访问 | `opencode.json.agent.*.permission` | 工具级 allow/deny；例如 `plan.safe_shell = deny` |
| 模板与绑定 | `.opencode/project.config.json.permission_templates` + `opencode.json.agent.*.options.permission_template` | 选择非底线行为策略 |
| 固定安全内核 | tool-governance policies + file-guard final guard | 危险命令、protected path、CodeGraph、repo write、verified plan、script write scan |

模板不得授予原生层已 deny 的工具，也不得覆盖固定安全内核。Agent 身份只用于解析模板名，不直接参与规则分支。

#### 2.2.2 配置模型

```jsonc
// .opencode/project.config.json
{
  "permission_templates": {
    "default_template": "default",
    "shell_allowlists": {
      "default": ["cat *", "ls *", "grep *", "find *", "git status*", "git diff*"],
      "extended": ["npm run *", "npx tsc *", "npx eslint *", "bun *", "node *"]
    },
    "templates": {
      "default": {
        "shell_allowlist": "default",
        "unknown_command": "deny",
        "repo_read": "allow"
      },
      "trusted": {
        "shell_allowlist": ["default", "extended"],
        "unknown_command": "allow",
        "repo_read": "allow"
      },
      "confirm": {
        "shell_allowlist": "default",
        "unknown_command": "ask",
        "repo_read": "ask"
      }
    }
  }
}
```

```jsonc
// opencode.json
{
  "agent": {
    "Orchestrator": { "options": { "permission_template": "default" } },
    "build":        { "options": { "permission_template": "trusted" } },
    "general":      { "options": { "permission_template": "trusted" } },
    "plan":         { "options": { "permission_template": "default" } },
    "explore":      { "options": { "permission_template": "default" } }
  }
}
```

`shell_allowlist` 只接受已声明集合名或集合名数组；`ALL_ALLOWED` 仅作为显式模板值，含义是“跳过普通 allowlist”，仍必须经过固定安全内核。未知 Agent、缺失绑定、未知模板、配置解析失败统一回退到内置 fail-closed `default`（`unknown_command=deny`），并写结构化审计日志。

#### 2.2.3 类型与解析器

新增 `service/permission/templates.ts`：

```ts
type TemplateDisposition = "allow" | "deny" | "ask";

interface PermissionTemplate {
  name: string;
  shellAllowlist: string[] | "ALL_ALLOWED";
  unknownCommand: TemplateDisposition;
  repoRead: TemplateDisposition;
}

resolvePermissionTemplate(agent: string): PermissionTemplate;
```

解析器只负责：读取/校验配置、解析 `agent.*.options.permission_template`、合并命名 allowlist、生成不可变 effective template。它不做命令分类、路径判断或 grant 判断。

#### 2.2.4 Governance 热路径

```text
tool-governance-handler
  -> permission-policy: resolve template once, attach ctx.permissionTemplate
  -> path-policy: protected path fixed disposition
  -> repo-policy: repo write fixed deny; repo read uses template disposition
  -> evidence/grant policies: fixed disposition
  -> shell-policy:
       buildVerifiedCommandPlan (fixed deny)
       dangerous pattern (fixed deny, no agent bypass)
       template allowlist match
       unknown_command disposition
  -> inject VerifiedCommandPlan
  -> safeBashTool final guard:
       validate/internally build VerifiedCommandPlan
       dangerous pattern fixed deny
       script/eval write scan fixed deny
       execute
```

`permission-policy` 不再调用 `getAgentShellAllowlist()`；`shell-policy` 不再调用 `getAllowlist(agent)` 或 `_hasAgentDangerousBypass()`。`safeBashTool` 删除 per-agent deny/ask 和普通 allowlist final guard，但保留 verified plan、dangerous pattern 与 script/eval scan 作为 defense-in-depth。

#### 2.2.5 ask 语义

模板中的 `ask` 沿用治理域 `ToolGovernanceDecision.outcome = "ask"`：**阻断当前工具调用**，输出 ruleId、原因、拟执行行为及“调用 `question` 请求 QoderWork 决策”的下一步。它不是隐式允许，也不因模型重试自动放行。

Phase 2 若要实现“回答后一次性重试放行”，必须复用或扩展现有 grant 生命周期，增加 session/call/command-hash 绑定和 consume-once；在该证据存在前，`confirm` 只能宣称“ask-and-block”，不能宣称“interactive approval completed”。

#### 2.2.6 弱模型受控交付协议

本协议适用于 P1 #3/#5 的所有代码变更 task card。这里的“弱模型”是**受约束实施者角色**，不是靠 runtime 猜测模型名称；同一协议也适用于任何需要更强保障的实施 session。

| 方案 | 机制 | 结论 |
|---|---|---|
| A. 仅在 prompt 中提醒测试 | 依赖模型自觉读取/执行 | 否决：无法证明读取、覆盖或结果真实性 |
| B. 通用任务卡 + reviewer | 限制范围，但没有测试设计/执行闭环 | 否决：易把 unit green 当作正确性 |
| C. runtime Skill + 测试式样书 + 受限任务卡 + 独立 gate | 将“设计、执行、证据、完成权”拆开 | **唯一实施路径** |

**固定执行序列**（不得跳步、不得调序）：

1. **Skill 部署与发现**：将 QoderWork 中的 `requirements-to-test-specification` 与 `test-specification-execution` 原样同步到 `work-one/.opencode/skills/<name>/`，连同各自模板文件；记录两处 `SKILL.md` 的 SHA-256。必须用 `opencode debug skill` 看到两个 name，缺失即 `BLOCKED`，不得开始代码修改。
2. **读取认证**：本 Phase 临时把 `preflight-lite`、`codegraph-first`、`requirements-to-test-specification`、`test-specification-execution` 列入 `template_resolution.required_skill_reads`。实施者完整读取四份 Skill 后调用 `skill_read_attest(task_id)`；`verified:false` 时只允许继续读取/提问，不允许进入写入 task card。
3. **测试式样书先行**：实施者先在 `qoderwork/e2e/permission-template-enforcement-test-spec.md` 生成测试式样书。它必须有 REQ→TEST traceability、独立 oracle、happy/negative/boundary/state/security 覆盖和 critical/high 对抗性 charter。式样书状态只能是 `DESIGNED`、`OPEN`、`BLOCKED`，不得写 PASS。
4. **窄范围实施**：实施者一次只执行一张本 blueprint 指定的 task card；只能修改其允许路径。修改前运行 `git status --short`、`codegraph status` 和指定 symbol 的 `codegraph impact`；框架路径写入仍走现有 grant + `safe_framework_edit` 流程。
5. **按式样书执行测试**：实施者使用 `test-specification-execution` 执行固定 test ID。每个结果必须是 `PASS`、`FAIL`、`BLOCKED`、`NOT-RUN` 或 `INVALID`，并带命令/request、环境 identity、独立 oracle 观察和 artifact。Mock 仅限不可控外部边界，内部业务协作使用真实实现、临时真实依赖或 contract-tested fake。
6. **对抗性和 live 验证**：对 permission template 的 critical/high 行为必须覆盖：未知/坏模板 fail-closed、危险命令不可被 trusted 绕过、protected path/CodeGraph/repo write 不可降级、重复/并发调用不扩大授权、before policy 与 final guard 双层拒绝。组件测试、runtime smoke、live LLM E2E 分开记录；只有真实 Orchestrator/child 调用闭合相应 live case。
7. **独立完成判定**：实施者只提交 patch、测试式样书、执行报告、首次失败证据和未解决问题。强审查模型/人工 reviewer 重跑关键命令、检查 diff 范围和 live 证据后，才可更新本 blueprint checkbox、P1 状态或“完成”结论。

**T-PT-004 gap 裁决（2026-07-14，固定）**：

| 路径 | 结果 |
|---|---|
| 降低 ORA-PT-02，把 `verified:false` 后写入改成 WARN/audit-only | 否决；这会直接取消“弱模型未读要求时不能修改代码”的安全承诺 |
| 将通用 `checklist-incomplete` 全局改为 `hard_block` | 否决；会误伤无关质量检查，且不能解决 attestation 结果、状态绑定和异常吞噬问题 |
| 新增专用 `skill-read-attest-required` 硬门，读取 DB-canonical 认证状态 | **唯一返工路径** |

现有 T-PT-003/T-PT-004 harness 和 first-failure 证据必须保留；它们是返工输入，不得被覆盖、删除或改写为 PASS。返工完成后必须生成新的 artifact，旧证据不得冒充新实现结果。

**Task Contract（每张 task card 开始前必须写入交付物）**：

```text
Goal: <唯一目标>
Allowed paths: <精确路径列表>
Forbidden paths: <明确列表>
Requirement IDs: <REQ-*>
Test IDs: <T-* 与 ADV-*>
Acceptance: <可证伪条件>
Evidence required: <命令、日志、session、state query>
Stop triggers: <失败、越界、缺 Skill、缺 oracle 时停止>
```

任何缺少 Requirement IDs、Test IDs 或 Evidence required 的 task card 均为 `INVALID`，实施者必须停止并请求 reviewer 补全；不得自行猜测。

#### 2.2.7 Skill 读取硬门返工契约

本节只修复弱模型交付 gate，不改变 permission template 的业务语义。实现必须复用现有 `skill_read_attest`、`read_audit`、`skill_read_state` 和 active `before-dispatcher`；不得复活 `phase0-enforce.ts`，不得重新启用 legacy `checklist-validate.ts`，不得新建第二状态源。认证写入端与校验端必须调用同一个 `resolveSkillAttestationIdentity(sessionID)`；禁止一端信任工具参数、另一端独立调用 `resolveTaskId(sessionID)`。

**启用条件**：Reviewer 启动专用隔离 serve 时必须在进程环境设置 `FRAMEWORK_SKILL_READ_HARD_GATE=1`；该值不写入弱模型可编辑的 project config。`.opencode/project.config.json` 必须配置非空 `required_skill_reads`；环境变量为 `1` 而 required list 缺失/为空时必须 fail-closed。除精确值 `1` 外硬门不启用，但任何弱模型 task card 都不得在未提供 `FRAMEWORK_SKILL_READ_HARD_GATE=1` 的 serve 上开始。不得增加 `audit_only`、`warn`、身份豁免或自定义 allowlist 模式。

**DB-canonical 状态契约**：`skill_read_state.sessions[sessionID]` 必须至少包含：

```ts
interface SkillReadSessionState {
  session_id: string;
  agent: string;
  task_scope_id: string;
  requested_task_id: string | null;
  required_set_hash: string; // sorted [{path,file_hash}] 的 canonical JSON SHA-256
  files: Array<{ path: string; file_hash: string; read_at: string | null }>;
  verified: true;
  attested_at: string;
}
```

状态转换只能按以下顺序执行：

1. `resolveSkillAttestationIdentity(sessionID)` 从 runtime session 状态解析 canonical agent 与 task scope。已 dispatch child 使用 `task:<dag_task_id>`；没有 `dag_task_id` 的 root/manual session 使用 `session:<sessionID>`。调用者传入的 `task_id` 只保存为 `requested_task_id` 审计标签；child 的非空 caller hint 必须与 canonical `dag_task_id` 一致，不一致即拒绝。
2. `attestSkillRead()` 从当前 worktree config 解析 required list，使用真实 `verifyRead()` 验证每个文件并计算当前文件 hash；状态写入与后续 validator 使用同一个 canonical identity 结果。
3. 任一文件未读、文件不存在、canonical agent/session/task scope 缺失、child task hint 不匹配、required list 为空但硬门已启用，均返回 `verified:false`，并删除或明确失效该 session 的旧成功状态。
4. 全部验证通过后原子写入 DB；只有 `dbAtomicWriteSubState()` 返回成功才可返回 `verified:true, state_written:true`。DB 写失败必须返回 `verified:false`。
5. 每次受控工具调用前，`skill-policy` 只把 `sessionID` 交给 validator；validator 内部重新调用共享 identity resolver，并比对 DB 状态、当前 required set/hash 与文件 hash。任一缺失、不一致、过期或 DB 读取错误均 fail-closed。
6. 跨 session、跨 agent、跨 canonical task scope、required list 变化或 Skill 文件变化不得复用旧认证；重复认证必须幂等，并发认证不得产生部分成功状态。

**正向可达性不变量**：root Orchestrator 完整读取并认证后必须能进入 `dispatch_subagent` 的下一层；dispatched child 完整读取并认证后必须能让允许路径内的 `safe_edit` 到达后续 governance/executor。硬门不得制造“认证成功但同一 session 永远无法通过”的死锁。caller-supplied `requested_task_id` 不得成为授权 key，也不得用于把一个 session 的认证重放到另一个 session。

**未认证阶段固定 allowlist**：硬门启用且当前状态未通过时，只允许 `read`、`glob`、`grep`、`question`、`skill`、`config_read_attest`、`skill_read_attest`、`rule_read_attest`。其他工具一律按未知能力处理并阻断，包括 `safe_shell` 的只读命令、`dispatch_subagent`、`safe_framework_edit`、全部 repo/GitHub write 和未来新增工具。该 allowlist 固定在代码中，不从任务输入或 Agent 身份扩展。

**阻断路径**：新增 rule ID `skill-read-attest-required=hard_block`。`skill-policy` 必须写入包含 `sessionID/agent/task_scope_id/requested_task_id/tool/ruleId/reason` 的结构化拒绝事件后抛出异常；阻断异常不得被 handler 自身 catch。只允许把 DB/日志读取的非阻断辅助错误转换为结构化错误，任何无法证明已认证的错误都必须阻断。authoritative `.opencode/project.config.json.plugin_execution_order.before` 必须将 `skill-policy` 放在 `tool-governance` 之前，使未认证调用在授权和执行决策前失败；只修改 `before-dispatcher.ts` 的 `DEFAULT_ORDER` 或只做直接 handler test 均不算 active wiring 完成。

**Bootstrap 00R2 唯一例外**：当前硬门会误阻断已认证 root/child，弱模型只能执行 `PT-WM-00R2`。Reviewer 必须在隔离 worktree 中先用真实 DB/harness 确认该 session 的四份 Skill `verified:true`，再发放一次性、精确路径绑定的 `safe_framework_edit` grant。该 grant 只覆盖 `PT-WM-00R2` 允许文件；不得覆盖 Blueprint、测试式样书、permission template 核心实现或其他配置。实现后立即清 Bun cache、重启隔离 serve；从此取消 bootstrap 例外，后续 task card 必须由修复后的硬门自动约束。

#### 2.2.8 不可调安全底线

以下规则不得出现在 `permission_templates` 的可覆盖字段中：

1. dangerous shell / command composition / executable validation；
2. protected path 与框架关键配置写入；
3. 源码写入前 CodeGraph impact；
4. repo local/remote write 必须使用 first-class `safe_repo_*` + grant；
5. script/eval file-write scan；
6. guidance active 时的允许工具集合。

同时删除 `safe_shell.agent_dangerous_bypass`、`_hasAgentDangerousBypass()` 及其导出/测试。不存在 `trusted` 绕过安全底线的例外。

### 2.3 子系统合规审计

| # | 子系统 | 状态 | 检查结果 |
|---|---|---|---|
| 1 | MVC Architecture | ✅ | config reader/模板解析在 permission service；决策在 policy；handler 仍为薄适配层 |
| 2 | DB-only & DB-canonical | ⚠️ | 静态模板仍不入 DB；Skill 硬门必须只复用 `skill_read_state`，禁止内存 `Set/Map` 成为授权权威或新增文件状态源 |
| 3 | Permission Matrix | ⚠️ | 必须同步 5 个 active agent 的原生 tool permission 与 template binding |
| 4 | Concurrency Safe | ⚠️ | template resolver 保持 immutable；Skill 认证必须原子写入、失败失效旧状态，并覆盖重复/并发认证和跨 session/task 重放 |
| 5 | Hardened Enforcement | ⚠️ | 删除身份判断时必须保留 fixed kernel；新增专用 Skill hard gate，阻断异常必须传播到 active dispatcher |
| 6 | Framework Harness | ✅ | 保留现有 handler/controller 入口，不增加新 plugin |
| 7 | Central State Management | ⚠️ | template 定义单源在 project config，绑定单源在 OpenCode agent options；Skill 授权状态单源在 SQLite `skill_read_state` |
| 8 | Multi-Agent | ⚠️ | unknown/native agent 必须 fail-closed default；不能回退 legacy role profile |
| 9 | Log Central Management | ✅ | resolver/policy 事件统一走 `writeLog()` |
| 10 | DB-canonical Management | ✅ | 无 schema 变更、无迁移 |
| 11 | Templatization & Parameterization | ✅ | 命名模板替代重复 per-agent 命令 map |
| 12 | TypeScript + Bun Runtime | ⚠️ | 新 resolver 独立文件，避免继续膨胀 `reader.ts`/`shell-config.ts`；禁用新 npm 依赖 |

---

## 三、实施清单

### 3.1 文件变更列表

| 文件 | 变更 | Phase |
|---|---|---|
| `.opencode/project.config.json` | 新增 `permission_templates`；删除 `agent_dangerous_bypass` | 1 |
| `opencode.json` | 5 个 active agent 在 `options.permission_template` 绑定；允许使用 shell 的 Agent 将命令 map 收敛为工具级 allow，`plan` 保持 deny | 1/2 |
| `.opencode/service/permission/templates.ts` | 新增模板类型、校验、缓存与 fail-closed resolver | 1 |
| `.opencode/service/permission/index.ts` | 导出模板 API | 1 |
| `.opencode/service/tool-governance/context.ts` | 增加 effective template 字段 | 1 |
| `.opencode/service/tool-governance/policies/permission-policy.ts` | 解析模板，不再读 per-agent shell map | 1 |
| `.opencode/service/tool-governance/policies/shell-policy.ts` | 模板 allowlist/unknown disposition；固定 dangerous/plan 检查 | 1 |
| `.opencode/service/tool-governance/policies/repo-policy.ts` | repo read 使用模板处置；repo write 保持 fixed deny | 2 |
| `.opencode/service/file-guard/shell-guard.ts` | 删除 per-agent deny/ask 与普通 allowlist；保留 fixed final guard | 1 |
| `.opencode/service/file-guard/shell-config.ts` | 删除 `getAllowlist()`、`_hasAgentDangerousBypass()` 和 legacy agent allowlist 路径 | 1 |
| `.opencode/service/file-guard/index.ts`, `.opencode/lib/safe-bash-core.ts` | 清理旧导出 | 1 |
| `.opencode/service/permission/reader.ts`, `.opencode/lib/permission-reader.ts` | 删除 `getAgentShellAllowlist` 与仅为其服务的类型/兼容逻辑 | 1 |
| `.opencode/service/permission/legacy-agent-permissions.ts` | caller 清零并验证后删除 | 2 |
| `**/__tests__/permission-templates.test.ts` | resolver、fallback、绑定和配置错误测试 | 1 |
| `permission-policy.test.ts`, `shell-policy.test.ts`, `repo-policy.test.ts` | 模板决策矩阵 | 1/2 |
| `safe-bash-core.test.ts`, `permission-equivalence.test.ts`, `safe-bash-execution.test.ts` | 删除身份等价叙事，补 fixed kernel 回归 | 1/2 |
| `.opencode/skills/requirements-to-test-specification/**` | 新建 runtime 同步副本（含 `TEST-SPEC-TEMPLATE.md`） | 0 |
| `.opencode/skills/test-specification-execution/**` | 新建 runtime 同步副本（含 `EXECUTION-REPORT-TEMPLATE.md`） | 0 |
| `.opencode/project.config.json` | Phase 0 临时追加四个 required skill reads，并把 `skill-policy` 移到 `tool-governance` 前；硬门开关不得写入该文件 | 0R/0/2 |
| `.opencode/service/state/substate-types.ts` | 扩展 `SkillReadState` 的 session/agent/task/required-set/file-hash 类型契约 | 0R |
| `.opencode/service/session/skill-attest.ts` | 成功状态原子写入、失败失效旧状态、DB 写失败 fail-closed；导出硬门状态校验 | 0R |
| `.opencode/service/enforcement/rule-disposition.ts` | 新增 `skill-read-attest-required=hard_block`，不改变通用 checklist disposition | 0R |
| `.opencode/plugin-handlers/before/skill-policy.ts` | 删除内存状态授权语义；使用 DB 状态、固定未认证 allowlist 和可传播阻断异常 | 0R |
| `.opencode/service/session/__tests__/skill-attest.test.ts` | 新增真实临时 DB/worktree 的状态、失效、故障和并发测试 | 0R |
| `.opencode/plugin-handlers/before/__tests__/skill-policy.test.ts` | 新增 active handler hard-block、allowlist、未知工具与异常传播测试 | 0R |
| `.opencode/plugins/__tests__/skill-hard-gate-integration.test.ts` | 新增真实 active before dispatcher、root/child canonical identity 与 executor boundary 集成测试 | 0R2 |
| `e2e/permission-template-enforcement-test-spec.md` | 新建 P1 #3/#5 的需求追溯测试式样书 | 0 |
| `e2e-evidence/L3/permission-template-enforcement/rework-pt-wm-00r/**` | 新建返工执行报告、命令输出、first-failure、runtime 与 live evidence；禁止覆盖旧 T-PT-003/004 证据 | 0R |
| `e2e-evidence/L3/permission-template-enforcement/rework-pt-wm-00r2/**` | 新建 reviewer 二次返工证据；禁止改写 00R 与更早 artifact | 0R2 |
| `e2e-evidence/L3/permission-template-enforcement/**` | 新建执行报告、命令输出、first-failure 与 live evidence | 1/2 |
| qoderwork blueprint / log / todo 状态文档 | 记录实施证据并更新 P1 #3/#5 | 1/2 |

### 3.2 Phase 0R：T-PT-004 首轮硬门返工（已实施，Reviewer 未验收）

以下 1–7 是 PT-WM-00R 的历史执行契约，仅用于解释已有 diff/evidence，不再作为执行入口。弱模型不得重新执行或补写 00R 目录；当前唯一入口是 §3.2.1 `PT-WM-00R2`。

1. Reviewer 创建隔离 worktree、独立 `FRAMEWORK_DB_PATH`、新 session 和 `PT-WM-00R` Task Contract；以 `FRAMEWORK_SKILL_READ_HARD_GATE=1` 启动隔离 serve，并保存进程环境证据、返工前 commit、dirty 状态与现有 first-failure 路径。
2. 弱模型完整读取四份 required Skill 并运行 `skill_read_attest(task_id)`；Reviewer 独立查询 DB/harness，确认 `verified:true` 与 files_verified 一一对应后，才发放精确 allowed paths 的一次性 bootstrap grant。
3. 弱模型只修改 §3.1 标为 `0R` 的生产/测试/config 文件；不得修改 permission template 核心业务文件、Blueprint、测试式样书或旧 evidence。
4. 先实现 DB 状态契约，再实现 handler hard-block，再调整 active order；不得先把 WARN 改成 throw 后宣称完成。
5. 执行 T-PT-039–T-PT-045 和 ADV-PT-008/009；任一失败立即停止，保存 first failure，不得进入 runtime。
6. 清 Bun cache、重启隔离 serve，使用新 session 执行 T-PT-003、T-PT-004、T-PT-046、T-PT-047。只有新 artifact 同时证明 `verified:false`、专用 rule 拒绝、executor entry=0、目标无变化，才解除 `BLOCK-PT-02`。
7. Reviewer 重跑关键测试、核对允许路径和旧证据未被覆盖后，才能允许原 PT-WM-01–03 的既有实现继续验收；弱模型不得自行更新完成状态。

#### 3.2.1 Phase 0R2：Reviewer 审核后唯一返工路径（立即执行）

1. 先实现共享 `resolveSkillAttestationIdentity(sessionID)`，再让 attest writer 和 validator 同时使用它；不得通过放宽 task 比对、伪造 `dag_task_id` 或给 root session 写任意 task label 绕过。
2. 将状态授权 key 改为 canonical `task_scope_id`，将工具参数保留为不参与授权的 `requested_task_id`；为既有旧状态提供 fail-closed 读取，不得把缺字段旧状态自动升级为有效。
3. 修改 authoritative `.opencode/project.config.json.plugin_execution_order.before`，明确 `skill-policy` 在 `tool-governance` 之前；运行时保存实际 handler 顺序与拒绝/放行 trace。
4. 先执行 T-PT-048–T-PT-050，证明 resolver、真实 DB lifecycle 和 active wiring；再补执行未闭合的 T-PT-002、T-PT-004、T-PT-039–T-PT-045 与 ADV-PT-008–010。
5. 清 Bun cache、以 `FRAMEWORK_SKILL_READ_HARD_GATE=1` 重启隔离 serve，再执行 T-PT-046、T-PT-051、T-PT-052，最后重跑 T-PT-047。
6. 任一正向 root/child 路径被硬门拒绝、任一负向路径进入 executor、active order 仍错误、或 fault/concurrency/mutation 仅由普通 unit test 替代，立即停止并保留 first failure。
7. 只有 Reviewer 接受全部精确 case 的原始证据后，才可同时解除 `BLOCK-PT-02` 与 `BLOCK-PT-03`；不得按“部分通过”解除其中任何一个。

### 3.3 Phase 0：弱模型交付准备（必须先完成）

1. 原样同步两份测试 Skill 及模板到 `work-one/.opencode/skills/`；对 source 和 runtime copy 计算 SHA-256，必须逐文件相同。
2. `opencode debug skill` 必须发现两个 Skill；记录输出到 `e2e-evidence/L3/permission-template-enforcement/skill-discovery.txt`。
3. 将四个 required skill reads 写入 Phase 临时配置，实施者完整读取后运行 `skill_read_attest(task_id)`；保存 `verified:true` 结果。
4. 由实施者根据本 blueprint 和 current code 创建 `e2e/permission-template-enforcement-test-spec.md`；reviewer 先检查该文档的 coverage gate，未通过不得进入 Phase 1。
5. 为每张 Phase 1/2 task card 填写 Task Contract；缺任何字段即标记 `INVALID`。

### 3.4 Phase 1：核心迁移（default + trusted）

1. 执行 `PT-WM-01`，新增 resolver 与两个模板；`confirm` 只保留 schema/测试占位，不绑定 active agent。
2. 使用 `agent.*.options.permission_template` 绑定 5 个 active agent。
3. governance context 在一次调用中只解析一次 effective template。
4. 执行 `PT-WM-02`，迁移 `permission-policy`、`shell-policy`；删除 `getAgentShellAllowlist` 的 3 个生产调用点。
5. 删除 execution 层 per-agent deny/ask 与普通 allowlist；保留 fixed final guard。
6. 删除 dangerous bypass 配置与代码。
7. CodeGraph callers 确认 `getAgentShellAllowlist/getAllowlist/_hasAgentDangerousBypass` 生产 caller 为 0 后删除符号。
8. 实施者按测试式样书完成单元/集成/runtime allow+deny、negative 和 adversarial cases；reviewer 重跑后才可关闭 P1 #3。

### 3.5 Phase 2：模板扩展与 legacy 退役

1. 启用 `confirm`，明确 `ask-and-block` 文案与 question 恢复路径。
2. `repo-policy` 接入 `repo_read` 模板处置，repo write 仍固定阻断。
3. 审计所有 active agent binding，移除 `opencode.json` 内重复 shell command map。
4. 删除 `legacy-agent-permissions.ts`、legacy role permission tests 和 fallback 日志。
5. 若实施一次性确认，扩展现有 grant service，绑定 session + command hash + expiry + consume-once；否则不得把 confirm 标为 interactive approval。
6. 实施者执行 `PT-WM-03` 的 legacy fallback/confirm/repo-read 回归与 live LLM E2E；reviewer 完成 Final Gate 和文档状态同步后关闭 P1 #5。

### 3.6 弱模型唯一允许的任务卡

| Task card | 唯一目标 | 允许修改 | 禁止事项 | 必须交付 |
|---|---|---|---|---|
| `PT-WM-00R`（历史，只读） | 首轮 Skill 硬门返工；当前不得重跑 | `rework-pt-wm-00r/**` 只读审计 | 不得修改 00R 代码归因或旧 evidence，不得作为新执行入口 | 仅供 00R2 对照 |
| `PT-WM-00R2` | 修复 canonical identity 死锁、active order 漂移并补齐被过度声明的测试 | `project.config.json`、`substate-types.ts`、`skill-attest.ts`、`skill-policy.ts`、两份现有测试、一份 active-dispatcher 集成测试、00R2 evidence | 不改 permission template/file guard/tool-governance；不放宽 allowlist；不以 caller task label 授权；不改旧 evidence | T-PT-002、004、039–052，ADV-PT-008–010；root/child 正向、负向零执行、active order、fault/concurrency/mutation 原始证据 |
| `PT-WM-00` | Skill 部署、读取认证、测试式样书 | 两个 runtime Skill 副本、临时 config、`e2e/permission-template-enforcement-test-spec.md`、evidence | 不改 permission service/policy；不写 PASS | SHA-256、`debug skill`、`skill_read_attest`、coverage gate |
| `PT-WM-01` | resolver/config/context | project config、templates service/index/context、对应测试（最多 3 源码 + 2 测试） | 不改 shell final guard；不删 legacy；不改 blueprint 状态 | diff、CodeGraph evidence、T/ADV 结果、执行报告 |
| `PT-WM-02` | policy/execution层迁移 | permission/shell policy、shell guard/config、对应测试（最多 3 源码 + 2 测试） | 不新增 bypass、shell fallback 或全局 allow；不扩大路径 | diff、negative/mutation/fault 结果、first failure |
| `PT-WM-03` | confirm/repo-read/legacy 退役与 live 验证 | Phase 2 精确文件和 evidence（最多 3 源码 + 2 测试/文档） | 不把 ask 写成批准；不删除失败证据；不勾 checkbox | live session ID、messages/log/state query、执行报告 |

所有 task card 共同禁止：扩大范围、回滚无关 dirty 文件、修改本 blueprint checkbox/status、删除或弱化测试、将 `BLOCKED`/`NOT-RUN` 写成 PASS、以 mocked internal helper 替代真实业务协作。`PT-WM-00R2` 未经 reviewer 同时解除 `BLOCK-PT-02` 与 `BLOCK-PT-03` 前，其他 task card 即使已有代码或局部测试结果，也只能保持“待重新验收”，不得宣称完成。

**PT-WM-00R 历史 Task Contract（只读，不得作为当前执行入口）**：

```text
Goal: 关闭 T-PT-004 的 Skill 读取硬门 gap；不改变 permission template 业务行为。
Allowed paths:
  - .opencode/project.config.json
  - .opencode/service/state/substate-types.ts
  - .opencode/service/session/skill-attest.ts
  - .opencode/service/enforcement/rule-disposition.ts
  - .opencode/plugin-handlers/before/skill-policy.ts
  - .opencode/service/session/__tests__/skill-attest.test.ts
  - .opencode/plugin-handlers/before/__tests__/skill-policy.test.ts
  - e2e-evidence/L3/permission-template-enforcement/rework-pt-wm-00r/**
Forbidden paths:
  - blueprints/**
  - e2e/permission-template-enforcement-test-spec.md
  - .opencode/service/permission/**
  - .opencode/service/tool-governance/**
  - .opencode/service/file-guard/**
  - 既有 e2e-evidence/L3/permission-template-enforcement 根目录文件
Requirement IDs: REQ-PT-002, REQ-PT-015, REQ-PT-016
Test IDs: T-PT-004, T-PT-039–T-PT-047, ADV-PT-008, ADV-PT-009
Acceptance: 新 active runtime 中，verified:false 后任一非固定 allowlist 工具均由 skill-read-attest-required 阻断；executor entry=0；目标状态不变。verified:true 只在 DB 原子写成功且 session/agent/task/required-set/file-hash 全匹配时成立。
Evidence required: reviewer-controlled FRAMEWORK_SKILL_READ_HARD_GATE=1 进程环境、bootstrap attest/grant、git/worktree identity、CodeGraph query+impact、测试命令与原始输出、DB before/after、handler/dispatcher trace、executor counter、runtime/live session、目标 hash/mtime、first failure。
Stop triggers: serve 未由 reviewer 以硬门环境启动；任一 allowed path 外 diff；无法取得 task_id；DB 不是独立测试 DB；需要扩大 allowlist/豁免；拟复活 retired/legacy handler；任一测试 FAIL/INVALID；旧 evidence 被修改；无法证明 executor entry=0。
```

**PT-WM-00R2 固定 Task Contract（不得改写）**：

```text
Goal: 修复 Skill 硬门的 canonical identity 死锁与 active before order 漂移，并补齐 00R 报告未实际执行的测试；不改变 permission template 业务行为。
Allowed paths:
  - .opencode/project.config.json
  - .opencode/service/state/substate-types.ts
  - .opencode/service/session/skill-attest.ts
  - .opencode/plugin-handlers/before/skill-policy.ts
  - .opencode/service/session/__tests__/skill-attest.test.ts
  - .opencode/plugin-handlers/before/__tests__/skill-policy.test.ts
  - .opencode/plugins/__tests__/skill-hard-gate-integration.test.ts
  - e2e-evidence/L3/permission-template-enforcement/rework-pt-wm-00r2/**
Forbidden paths:
  - blueprints/**
  - e2e/permission-template-enforcement-test-spec.md
  - .opencode/service/permission/**
  - .opencode/service/tool-governance/**
  - .opencode/service/file-guard/**
  - e2e-evidence/L3/permission-template-enforcement/rework-pt-wm-00r/**
  - 既有 e2e-evidence/L3/permission-template-enforcement 根目录文件
Requirement IDs: REQ-PT-001, REQ-PT-002, REQ-PT-013–REQ-PT-017
Test IDs: T-PT-002, T-PT-004, T-PT-039–T-PT-052, ADV-PT-008–ADV-PT-010
Acceptance: writer 与 validator 使用同一 canonical identity；root scope=session:<sessionID>，child scope=task:<dag_task_id>；caller task label 不参与授权。project.config active order 中 skill-policy 位于 tool-governance 前。root dispatch 与 child allowed-path safe_edit 正向可达；全部负向、重放、故障和未知工具路径 executor entry=0。
Evidence required: reviewer-controlled hard-gate 进程环境、git/worktree identity、CodeGraph query+impact、active config 顺序、真实 DB state before/after、root/child session map、targeted/integration/fault/concurrency/mutation 原始输出、handler/dispatcher/executor trace、live session/messages/audit、目标 hash/mtime、first failure。
Stop triggers: active order 未更正；writer/validator identity 来源不同；caller label 仍是授权 key；root 或 child 正向路径被硬门拒绝；任一负向进入 executor；fault/concurrency/mutation 未实际运行；任一 allowed path 外 diff；旧 evidence 被修改；任一测试 FAIL/INVALID。
```

---

## 四、验证计划

### 4.0 弱模型交付 gate（先于所有代码验收）

- [ ] `PT-WM-00R2` 由 reviewer 以 `FRAMEWORK_SKILL_READ_HARD_GATE=1` 启动隔离 serve；bootstrap grant 只覆盖 00R2 allowed paths，且使用后已消费。
- [ ] authoritative project config 的 active before order 中 `skill-policy` 位于 `tool-governance` 前；`skill-read-attest-required` 为专用 `hard_block`，retired/legacy handler 未复活。
- [ ] T-PT-004 新证据同时包含 `verified:false`、结构化拒绝事件、真实 executor entry=0、目标文件/DB/repo 状态无变化；旧 evidence 未被覆盖。
- [ ] runtime Skill discovery：`opencode debug skill` 列出两个测试 Skill，且 source/runtime SHA-256 完全一致。
- [ ] `skill_read_attest(task_id)` 返回 `verified:true`，并保存 files_verified 证据。
- [ ] `e2e/permission-template-enforcement-test-spec.md` 的 REQ traceability=100%，critical/high adversarial coverage=100%，无缺 independent oracle 的 test ID。
- [ ] 每个 task card 含完整 Task Contract；缺项均标记 INVALID 并停止。
- [ ] 执行报告对每个 test ID 记录 status、命令/request、环境、oracle 和 artifact；无证据的 case 不得 PASS。

### 4.1 单元测试

- [ ] 硬门启用且 required list 为空、agent/session/task 缺失、任一文件未读时，attest 返回 `verified:false` 并失效旧状态。
- [ ] 只有 DB 原子写成功才返回 `verified:true, state_written:true`；DB 写失败不得留下可放行状态。
- [ ] writer 与 validator 共用 canonical identity resolver；root 使用 `session:<sessionID>`，child 使用 `task:<dag_task_id>`，并比对 session、agent、task scope、required set hash 和每个文件 hash。
- [ ] `requested_task_id` 只用于审计，不参与授权；root/child 正向路径均可达，跨 identity 重放仍拒绝。
- [ ] 未认证 allowlist 为固定精确集合；新工具、未知工具和所有非 allowlist 工具默认拒绝。
- [ ] `skill-policy` 的 block error 能离开 handler，到达 before dispatcher；测试必须杀死“throw 被 catch 吞掉”的 mutant。
- [ ] `resolvePermissionTemplate()` 正确解析 default/trusted/confirm。
- [ ] missing binding、unknown agent、unknown template、坏 JSON 均 fail-closed 到 default 并记录日志。
- [ ] `ALL_ALLOWED` 仍被 dangerous/plan/script scan 阻断。
- [ ] default/trusted 对 allowlisted 与 unknown command 产生预期 disposition。
- [ ] repo read obeys template；local/remote write 不受模板影响。
- [ ] `_hasAgentDangerousBypass/getAllowlist/getAgentShellAllowlist` 无测试或生产引用。
- [ ] 对每个安全关键 predicate 做 mutation/等效故障注入；permission template 的 deny、dangerous、CodeGraph、repo-write mutation 必须被测试杀死。

### 4.2 集成测试

- [ ] 使用真实临时 DB、临时 worktree config、真实 `verifyRead + attestSkillRead + skill-policy`；禁止 mock 内部 attestation/state helper。
- [ ] 未读/截断读后，`safe_edit`、`safe_shell`、`safe_framework_edit`、dispatch、repo/GitHub write 和未知工具均在 before 层阻断，真实 executor entry=0。
- [ ] 跨 session/agent/canonical task scope、required list 或 Skill 文件变更、失败后重试、并发 attestation 均不能复用或产生部分成功状态；caller task label 不参与授权。
- [ ] authoritative active before order 和 runtime trace 均证明 `skill-policy` 早于 `tool-governance`；源码 `DEFAULT_ORDER` 不得替代该证据。
- [ ] 完整认证后，普通允许写入可到达后续 governance；protected path、dangerous、CodeGraph、repo-write 等既有底线仍独立拒绝。
- [ ] handler 构造 context 后只解析一次模板，并把 `VerifiedCommandPlan` 注入工具参数。
- [ ] before governance deny 时 `safeBashTool` 不执行。
- [ ] before governance allow 时 execution final guard 仍拒绝 dangerous/script write。
- [ ] `plan.safe_shell=deny` 仍由 OpenCode 原生权限阻断，模板不能放行。
- [ ] unknown/legacy role 不读取 `LEGACY_AGENT_PERMISSIONS`。
- [ ] targeted Bun suite 全绿，且基线 `52 pass / 0 fail` 不退化。
- [ ] 同一 command 在 default/trusted/unknown agent 和重复/并发调用下不出现权限扩大；测试使用真实 resolver/policy，不 mock 内部业务 helper。

### 4.3 端到端测试

- [ ] runtime smoke：新 session 故意少读一份 Skill，attest 返回 false；read/question/attest 可继续，任一非 allowlist 工具返回 `skill-read-attest-required` 且零执行。
- [ ] live root positive：root Orchestrator 完整读取并 attest 后，`dispatch_subagent` 必须通过硬门并进入后续 handler。
- [ ] live weak-model rework：新受约束 child 完整读取并 attest 后，允许路径 `safe_edit` 必须通过硬门并到达后续 governance/executor；旧认证、跨 scope 认证和未认证写入均不能放行。
- [ ] live Orchestrator/default：`cat package.json` allow，审计含 template/rule/layer/outcome。
- [ ] live build/trusted：编译或测试命令 allow，并成功消费 VerifiedCommandPlan。
- [ ] live explore/default：过去 `safe_shell:"allow"` 可执行的 unknown command 现在按 default 阻断。
- [ ] live dangerous command：所有 active agent 均被 fixed kernel 阻断，无 bypass。
- [ ] live repo read：按模板 allow/ask；repo write 始终先被 repo-policy 阻断或转 first-class tool。
- [ ] live confirm：当前调用被 ask-and-block，消息明确要求 `question`；若声称一次性放行，必须有 reply + grant consume 证据。
- [ ] live Skill chain：受约束 build/general child 实际加载两个测试 Skill，完成 attest、按测试式样书执行后返回可复核 execution report；reviewer 从 session、logs、state query 确认而非相信文字摘要。

### 4.4 子系统专项验证

- [ ] Permission Matrix：`opencode debug agent` 复核 5 个 active agent 工具可见性未意外扩大。
- [ ] Hardened Enforcement：重跑 codegraph、path、write-bypass、shell-policy 与 safe-bash-execution suites。
- [ ] Multi-Agent：Orchestrator/build/general/plan/explore 各至少一个 runtime case。
- [ ] Log Central：所有模板解析/回退/决策事件均进入 `.task_temp/_logs/`，无 `stderr` 私有通道。
- [ ] TypeScript+Bun：定向 `bun test` + 受影响模块类型检查；新增文件目标不超过 400 行。

---

## 五、风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 模板迁移后命令集合与现状不等价 | active agent 被误阻断或过度放行 | 先生成 old→new 行为矩阵；Phase 1 只绑定 default/trusted；逐 agent runtime smoke |
| `trusted.unknown_command=allow` 被误解为安全全放行 | 扩大 shell 风险 | fixed kernel 永远先于模板；`ALL_ALLOWED` 只跳普通 allowlist |
| 直接自定义 Agent 字段被 OpenCode 丢弃 | binding 静默失效 | 使用已实测保留的 `agent.*.options.permission_template` |
| 删除 execution allowlist 形成单点 | before-hook 未加载时普通未知命令可能进入执行层 | 启动自检必须确认 tool-governance active；execution 层保留 verified executable plan + dangerous + script scan；缺失 handler fail startup |
| ask 被误报为交互批准 | 用户以为回答后可自动执行 | Phase 2 明确 ask-and-block；没有 one-shot grant 证据不得宣称 interactive approval |
| legacy fallback 删除暴露旧测试依赖 | 测试或文档失败 | 先 CodeGraph caller=0，再删除；旧角色用 active native template mapping 或明确 unsupported |
| QoderWork Skill 误被当作 runtime Skill | 弱模型没有加载约束仍开始修改 | Phase 0 SHA-256 同步 + `opencode debug skill` + `skill_read_attest` 三重门；任何一项缺失即 BLOCKED |
| 仅把 WARN/disposition 改为 throw | handler 自身 catch 吞异常，或遗漏新的写工具 | 使用专用 rule + DB state validator + 未认证 allowlist；验证异常传播和未知工具默认拒绝 |
| writer/validator identity 不一致 | `verified:true` 后 root/child 正向路径仍被硬门永久阻断 | 共用 canonical identity resolver；root=`session:<sessionID>`、child=`task:<dag_task_id>`；caller label 仅审计；真实 DB lifecycle 验证 |
| active source default 与 project config 顺序漂移 | 未认证调用先进入 governance，测试只验证到非活跃顺序 | 以 project config 为权威；静态顺序和 runtime handler trace 双重断言；order mutation 必须被杀死 |
| 陈旧 attestation 被跨 session/scope/config/file 重放 | 弱模型不再满足读取条件却继续写入 | 状态绑定 session/agent/canonical task scope/required-set/file hash；失败失效旧状态；每次受控工具前重新比对 |
| DB 读写失败被当作已认证 | enforcement 在故障时失开 | `state_written:true` 是成功必要条件；任何 DB 错误 fail-closed，并做 fault injection |
| 为关闭 T-PT-004 全局 hard-block checklist | 无关工作流被误阻断且根因仍在 | 保留通用 disposition；只新增 `skill-read-attest-required` 专用硬门 |
| 硬门开关放在弱模型可编辑 config | 模型可在获得 project config 写权限时关闭自己的约束 | 启用权只来自 reviewer 控制的 serve 环境 `FRAMEWORK_SKILL_READ_HARD_GATE=1`；环境证据是 task card 前置条件 |
| 弱模型以 unit green 宣称正确 | 真实 wiring、失败/并发、安全绕过未验证 | 测试式样书先行；critical/high 必须 adversarial charter；E2E 只接受真实 session/log/state 证据 |
| 过度 mock 掩盖业务错误 | 测试与错误实现共用同一假设 | 只 mock 外部不可控边界；内部使用真实协作或 contract-tested fake；reviewer 检查 mock 边界 |

### 5.1 回滚方案

1. 保留 Phase 1 前的 old→new permission matrix 与 targeted baseline 输出。
2. 如 runtime 阻断率异常，先把 active agent binding 全部回退到 `default`，不恢复 dangerous bypass。
3. 如 resolver/handler 故障，恢复原 `opencode.json.safe_shell` 命令 map、`getAgentShellAllowlist` 三 caller 与对应测试。
4. 回滚不得恢复 `agent_dangerous_bypass`；确有运维命令需求时增加受行为约束的 first-class tool。
5. Phase 2 的 legacy 删除必须独立提交/变更片，可单独恢复，不与 Phase 1 核心 resolver 强绑定。
6. 弱模型交付协议回滚只撤回 runtime Skill 同步、临时 required skill reads 和 task card gate；不得撤回已存在的 fixed safety kernel 或用“恢复便利性”重新引入 bypass。
7. `PT-WM-00R2` 若失败，回滚其代码/config 变更但保留 00R 与 00R2 first-failure evidence；恢复后状态仍为 `BLOCKED`，不得回到“方案完成”。
8. 禁止通过移除 `FRAMEWORK_SKILL_READ_HARD_GATE=1`、删除 T-PT-004、降低 rule disposition 或扩大未认证 allowlist 来作为“回滚成功”；未启用硬门的 serve 不得承载弱模型 task card。

---

## 六、成功标准

- [ ] `getAgentShellAllowlist`、`getAllowlist(agent)`、`_hasAgentDangerousBypass` 生产 caller 均为 0，随后物理删除。
- [ ] `legacy-agent-permissions.ts` 在 Phase 2 caller=0 后删除。
- [ ] 5 个 active agent 均通过 `options.permission_template` 绑定，不存在 direct `permission_template` 未知字段。
- [ ] dangerous shell、protected path、CodeGraph、repo write 四类底线不能被任何模板降级。
- [ ] OpenCode 原生 tool deny 不能被模板覆盖。
- [ ] 单元、集成、live runtime 三层证据齐全；仅 live LLM case 可标记对应 E2E 完成。
- [ ] 两个测试 Skill 已被 runtime discovery，读取认证通过，且 source/runtime copy 的 SHA-256 一致。
- [ ] T-PT-002、T-PT-004、T-PT-039–T-PT-052 与 ADV-PT-008–010 已按精确层级重新执行；旧失败证据保留，`BLOCK-PT-02/03` 仅由 reviewer 同时解除。
- [ ] Skill 认证成功状态绑定 session/agent/canonical task scope/required-set/file hash；caller task label 不参与授权，DB/配置/文件故障和跨边界重放均 fail-closed。
- [ ] root Orchestrator 认证后可进入 dispatch，dispatched child 认证后允许路径写入可到达后续链；不存在“verified:true 但同 session 永远被硬门拒绝”的死锁。
- [ ] authoritative active before order 中 `skill-policy` 位于 `tool-governance` 前，且 runtime trace 与配置一致。
- [ ] 未认证阶段只有固定 read/question/attest allowlist 可运行；所有其他和未来未知工具均零执行，阻断异常到达 active dispatcher。
- [ ] 所有弱模型返工/runtime/live 证据均来自 reviewer 以 `FRAMEWORK_SKILL_READ_HARD_GATE=1` 启动的隔离 serve；project config 中不存在可由模型关闭硬门的字段。
- [ ] 每个 P1 #3/#5 task card 都有已审核的测试式样书和执行报告；critical/high test ID 均有独立 oracle 与对抗性证据或显式用户接受的风险。
- [ ] 弱模型未改 blueprint checkbox/status；强审查模型/人工 reviewer 已重跑关键验证、检查 live evidence，并独立决定完成状态。
- [ ] P1 #3 与 P1 #5 状态同步到 priority todo/log，且证据等级明确。

---

## 七、附录

### 7.1 当前关键事实

- active agent：Orchestrator、build、general、plan、explore。
- before order 中 `tool-governance` 位于 `path-validate` 和 `codegraph` 之前。
- `getAgentShellAllowlist` 当前 CodeGraph impact 为 15 个符号。
- 当前 targeted baseline：52 pass / 0 fail（2026-07-14）。
- OpenCode runtime：1.17.18。
- runtime 已发现两份测试 Skill 且 source/runtime SHA-256 一致；`BLOCK-PT-01` 已解除，但 T-PT-002 tamper 负向用例仍为 `NOT-RUN`。
- targeted hard-gate tests 经 reviewer 重跑为 `11 pass / 0 fail`，只构成 component supporting evidence，不能替代指定 integration/fault/concurrency/mutation/live cases。
- T-PT-004 的 00R live evidence只触发 root `dispatch_subagent`，未执行式样书指定的 active-dispatcher `safe_edit` 路径，裁决为 `NOT-RUN`；`BLOCK-PT-02` 保留。
- G1 的新 live session 补充了未认证 `dispatch_subagent` 专用拒绝与目标不变，但未发生 `skill_read_attest` 调用；因此完整 T-PT-004 现保留为 `FAIL`，需按式样书 A/B 子用例重跑。
- T-PT-047 的 DB 状态为 `verified:true`，但 root session 没有 `dag_task_id`，校验端解析空 task 后阻断正向 dispatch，裁决为 `FAIL`。
- 00R2 已将 current project config 与源码 `DEFAULT_ORDER` 同步为 `skill-policy` 在 `tool-governance` 前，并以真实 before-dispatcher 临时 DB/worktree 测试验证无认证拒绝来源；这不是 authoritative live serve/session trace，不能替代 T-PT-050、T-PT-051 或 T-PT-052 的完整 oracle。
- 当前 00R2 复跑结果：active-dispatcher suite `6 pass / 0 fail`，相关 attestation/skill-policy/tool-governance suite `52 pass / 0 fail`。它们是 source/component/integration supporting evidence，不能替代 fault、20 轮 concurrency、mutation、真实 executor/目标状态或 live E2E。
- `BLOCK-PT-02/03` 均保持；T-PT-047 的历史 first failure 保留，修复后的 live root/child 正向路径尚未重跑。

### 7.2 相关文件

- `blueprints/blueprint-opencode-framework-simplification-roadmap.md`（规则 disposition 固定约束）
- `blueprints/blueprint-tool-governance-mvc-refactor.md`（治理域与 runtime order）
- `logs/2026-07-13-priority-todo-execution.md`
- `logs/2026-07-14-session-context-handoff.md`
- `.agents/skills/requirements-to-test-specification/SKILL.md`（QoderWork authoring source）
- `.agents/skills/test-specification-execution/SKILL.md`（QoderWork authoring source）
- `logs/2026-07-14-ai-test-specification-skills.md`
