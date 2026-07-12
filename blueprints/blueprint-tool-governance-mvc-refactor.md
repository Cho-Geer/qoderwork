# Blueprint: 工具治理链重构（MVC + 统一日志 + 高扩展）

**版本**: v2.3.2
**日期**: 2026-07-11
**状态**: 部分实施（Phase 0-4 已落地；治理日志字段已闭合；safe_shell protected-read 边界已修复；Phase 5 仅剩 live LLM E2E 待闭合）
**优先级**: P0

---

## 0. Live 实施状态（2026-07-11 再次交叉审核）

| 范围 | 当前状态 | 证据等级 | 证据 |
|---|---|---|---|
| Phase 0 repo 分类器 hotfix | ✅ 已完成 | component + direct tool smoke | `RepoProvider` 已含 `"none"`；`classifyRepoShellCommand()` 对 `cat`/`sha256sum`/`ls` 返回 `provider:"none"`；`classify.test.ts` 72/72 PASS |
| before/codegraph repo-op 边界 | ✅ 已完成 | component + static/code | `codegraph.ts` 已移除 `classifyRepoShellCommand` / `isRepoReadOperation` 依赖；`codegraph.test.ts` 5/5 PASS，并确认 `safe_shell git add a.ts` 不再被 codegraph 的 REPO-OP 裁决阻断（repo-op 已委让给 governance repo-policy） |
| safe_shell 执行层边界 | ✅ 已完成 | direct tool smoke | `safeBashTool({agent:"Orchestrator", command:"cat ..."})` 与 `sha256sum ...` 成功；`build/general git status --short` 成功；`git add` fail-closed 并提示 `safe_repo_*` |
| 统一 `service/tool-governance/**` 领域模型 | ✅ 已落地 | static/code + unit | 目录已存在，含 10 个 source 模块 + 8 个测试文件；`context` / `decision` / `controller` / `presenter` / 6 个 policy 均可导入；tool-governance 测试 30/30 PASS |
| governance controller 可运行性 | ✅ 已修复 | component | `bun test .opencode/service/tool-governance/controller.ts .opencode/plugin-handlers/before/tool-governance-handler.ts` 可完成导入检查；controller/handler direct smoke 覆盖 allow、repo deny、protected path deny |
| handler adapter / runtime 接线 | ✅ 已接入 | static/code | 新增 `.opencode/plugin-handlers/before/tool-governance-handler.ts`；`before-dispatcher.ts` 注册 `tool-governance`；`project.config.json.plugin_execution_order.before` 当前为 11 项，`tool-governance` 位于末位 |
| `codegraph.ts` / `shell-guard.ts` 收缩 | ✅ 已完成 | static/code + component | `shell-guard.ts` 已移除 repo 分类主裁决，仅保留执行层权限/危险命令/allowlist 兜底；`codegraph.ts` 已收敛为 CodeGraph evidence adapter，`classifyRepoShellCommand` impact 不再包含 `codegraph.ts` |
| policy 测试覆盖 | ✅ 已补齐组件测试 | component | `service/tool-governance/__tests__/*.test.ts` 30/30 PASS，覆盖 6 个 policy；`tool-governance-handler.test.ts` 2/2 PASS；`safe-bash-core.test.ts` 23/23 PASS |
| 统一治理日志 `ruleId/layer/outcome` | ✅ 已完成 | static/code + runtime log smoke | `presentBlock()` 与 `presentAllow()` 均写 `ruleId/layer/outcome` 到 runtime log；block/allow 的 `audit.jsonl` 事件均含 `outcome` 字段 |
| safe_shell path 边界 | ✅ 已修复 | component + direct handler smoke | `path-policy.ts` 的只读命令豁免正则已从错误控制字符修正为 `\\b` 单词边界；新增 `path-policy.test.ts` 回归用例；`safe_shell cat package.json` 与 `safe_shell cat .opencode/service/repo/types.ts` 现在都经 governance allow（direct `bun -e` 返回 `null`） |

**当前结论**: 本 blueprint 已推进到“统一治理域已接入 before 链、repo-op 主裁决已从 codegraph/shell-guard 收敛到 repo-policy、组件测试通过、治理日志字段闭合、protected-path read 回归已修复”。下一步重点是补真正的 Orchestrator -> build live LLM E2E。

---

## 一、问题背景

### 1.1 问题描述

当前 work-one 框架中的"工具权限 / 拦截 / 授权"逻辑已经形成了一条多层治理链，安全性总体偏向 fail-closed，但实现上存在以下突出问题：

1. **决策分散**：静态权限、repo grant、CodeGraph、scope、shell allowlist、behavioral path guard 分散在多个 handler、service、tool 中。
2. **职责重叠**：同一个语义在 before hook 和工具内部重复判断，或被不同模块重复实现。
3. **语义混合**：有的模块同时承担"权限判断 + 领域分类 + 审计输出 + 用户错误消息拼接"。
4. **修复前误拦截风险**：`safe_shell cat <file>` 曾被 `[FW-ENFORCE][REPO-OP]` 阻断，暴露出 repo 分类器和上层阻断器语义未对齐；当前 Phase 0 已修复该误拦截。
5. **维护成本高**：排查一次阻断经常需要同时跨 `before-dispatcher`、`scope-validate`、`codegraph`、`classify`、`shell-guard`、`safe_*` 工具文件。

### 1.2 根因分析

**修复前直接原因**（问题 4）：`classifyRepoShellCommand("cat foo.txt")` 返回 `provider: "git", kind: "unknown"`。上层 `codegraph.ts:163` 判断 `repoOp.provider === "git"` 成立且 `kind !== "read"`，直接抛出 `[FW-ENFORCE][REPO-OP]`。

修复前实测证据（2026-07-11 方案创建时 bun 执行）：

```json
{"command":"cat foo.txt","provider":"git","kind":"unknown","reason":"not a git or gh command: cat"}
{"command":"sha256sum foo.txt","provider":"git","kind":"unknown","reason":"not a git or gh command: sha256sum"}
{"command":"ls -la","provider":"git","kind":"unknown","reason":"not a git or gh command: ls"}
```

当前复核（2026-07-11 交叉审核）：`classifyRepoShellCommand()` 已对 `cat` / `sha256sum` / `ls` 返回 `provider: "none"`；`classify.test.ts` 72/72 PASS；`codegraph.test.ts` 5/5 PASS；`safeBashTool` 直接执行 `cat` / `sha256sum` 成功；`build` / `general` 执行 `git status --short` 成功，`git add` 仍 fail-closed。

**根本原因**：框架缺少一个统一的 **Tool Governance Domain Model**。系统没有把"静态访问控制 / 运行时策略判断 / 动态任务授权 / 工具执行器 / 审计与展示"明确分层，导致控制器层、领域服务层、工具执行层之间发生长期耦合。

修复前三处阻断点的代码位置：

| 阻断点 | 文件 | 修复前位置 | 修复前逻辑缺陷 | 当前复核 |
|---|---|---|---|---|
| 分类器 | `.opencode/service/repo/classify.ts` | 580-581 | 非 git/gh 命令返回 `provider: "git"` | 已改为 `provider: "none"` |
| before hook | `.opencode/plugin-handlers/before/codegraph.ts` | 163 | `provider === "git"` 即进入 repo-op 阻断 | repo-op / GitHub write 裁决已移入 `service/tool-governance/policies/repo-policy.ts`；`codegraph.ts` 仅保留 evidence gate |
| 工具内 guard | `.opencode/service/file-guard/shell-guard.ts` | 216 | 同上，重复裁决 | repo 分类主裁决已移除；仍保留执行层危险命令/allowlist 兜底 |

### 1.3 修复前实测验证

1. bun 直接调用 `classifyRepoShellCommand()` 确认 `cat`/`sha256sum`/`ls` 均返回 `provider: "git", kind: "unknown"`。
2. `codegraph.ts:159-183` 代码审查确认：`tool === "safe_shell"` 时调用 `classifyRepoShellCommand(command)`，然后 `if (repoOp.provider === "git" || repoOp.provider === "gh")` 进入分支，`kind !== "read"` 即 throw。
3. `shell-guard.ts:214-231` 代码审查确认：同样的 `provider === "git" || "gh"` + `kind !== "read"` 模式，工具内再次阻断。
4. `tool-scope-match.ts:173` 已有独立的 `classifyShellCommand()` 正确识别 `cat`/`sha256sum` 为 `read_only`，但 `codegraph.ts` 和 `shell-guard.ts` 没有使用它，而是直接调 `classifyRepoShellCommand()`。
5. 现有测试 `classify.test.ts:398-402` 断言 `classifyRepoShellCommand("ls -la")` 返回 `kind: "unknown", decision: "block"`，这个断言本身就在固化错误语义。

### 1.4 当前复核证据（2026-07-11）

1. CodeGraph 已同步到 419 files / 377 TypeScript / 30 JavaScript / 12 YAML，`service/tool-governance/**` 与 `plugin-handlers/before/tool-governance-handler.ts` 节点可查询。
2. `bun test .opencode/service/repo/__tests__/classify.test.ts`：72/72 PASS。
3. `bun test .opencode/plugin-handlers/before/__tests__/codegraph.test.ts`：5/5 PASS。
4. `bun test .opencode/service/tool-governance/__tests__/*.test.ts`：30/30 PASS，覆盖 `context` / `decision` / 6 个 policy。
5. `bun test .opencode/plugin-handlers/before/__tests__/tool-governance-handler.test.ts`：2/2 PASS，覆盖 GitHub MCP read/write 委让到 governance。
6. `bun test .opencode/lib/__tests__/safe-bash-core.test.ts`：23/23 PASS，旧角色 allowlist 期望已修正为 5-agent 边界。
7. 直接调用治理 handler：`cat package.json` allow；`git add a.ts` 触发 `repo-policy` deny；`github_create_issue` 触发 `repo-policy` deny；修复 `path-policy.ts` 正则后，`cat .opencode/service/repo/types.ts` 也按只读命令豁免返回 allow。
8. 直接调用 `codegraph.handle()`：`safe_shell git add a.ts` 不再触发 REPO-OP；若缺少 CodeGraph impact，会先被 `CODEGRAPH-ENFORCE` evidence gate 阻断。
9. 直接调用 `safeBashTool()`：`cat` / `sha256sum` 成功，`build/general git status --short` 成功，`build/general git add a.ts` 在 dry-run 下 fail-closed；当前阻断来自执行层 allowlist 兜底，不再是 `shell-guard.ts` 的 repo-op 分类主裁决。

**结论**：问题 4 的原始根因是 `classifyRepoShellCommand()` 对非 git/gh 命令返回了 `provider: "git"`，导致上层 `provider === "git"` 条件误命中。当前 Phase 0 hotfix 已修复；Tool Governance Domain 已建模并接入 before 链；`codegraph.ts` / `shell-guard.ts` 的 repo-op 主裁决已收敛；`path-policy.ts` 的 protected-read 回归也已修复。剩余重点是 live LLM E2E。

---

## 二、解决方案

### 2.1 方案对比

| 维度 | 方案 A：继续局部修补 | 方案 B：统一治理域服务重构 | 方案 C：把所有规则塞进工具内部 |
|---|---|---|---|
| 核心思路 | 在现有 handler 上继续修 bug | 建立统一 Tool Governance Domain，拆分 Controller / Model / Service / View | 弱化 before hooks，工具层自带全部治理 |
| 实现复杂度 | 低 | 中高 | 中 |
| 可维护性 | 低 | 高 | 低 |
| 安全性 | 中 | 高 | 中 |
| 扩展性 | 低 | 高 | 低 |
| MVC 一致性 | 差 | 好 | 差 |
| 日志一致性 | 继续分散 | 可统一收敛 | 工具各自实现，易漂移 |
| 对误拦截治理 | 临时可修 | 体系化修复 | 容易换一个地方重复出问题 |

### 2.2 选择结论

采用**方案 B：统一治理域服务重构**。引入一个统一的 Tool Governance Domain，把当前治理链拆成清晰的 MVC 分层。

理由：
1. 用户要求明确包含松耦合高内聚、高维护性、高安全性、高扩展性。
2. 用户要求符合 MVC 设计架构并正确集成日志系统。
3. 当前问题已不是“某几个 if 条件修一下”能长期解决，必须把治理决策从散落的 handler/tool 中抽出来。

### 2.3 否决理由

- **否决方案 A**：只能解决个别误拦截，但会继续累积“规则在 hook / tool / service 多处复制”的技术债。
- **否决方案 C**：看似集中，实则把 Controller / Policy / Execution 混成大工具，破坏 MVC 和可测试性，也不利于统一审计。

---

## 三、核心设计

### 3.1 MVC 分层

本框架的 MVC 约定与经典 Web MVC 不同，采用 **Pipes-and-Filters + MVC 概念映射**。工具执行请求按序流经拦截链，各层职责如下：

| 层 | 职责 | 对应文件 | 约束 |
|---|---|---|---|
| **Controller** | Plugin Hook 层，只做编排与 pass/fail 控制，不包含业务逻辑 | `plugins/before-dispatcher.ts`、`plugins/after-dispatcher.ts`、`plugins/system-dispatcher.ts` | 不写业务判断，不直接操作 DB，只串行调度 handler |
| **Model** | DB 状态机，负责数据持久化、状态转换、schema 迁移 | `lib/db-manager.ts`、`lib/db-state-manager.ts`、`service/gate/store-types.ts` | 只管数据读写与状态机，不含策略判断逻辑 |
| **Service** | 业务逻辑层，包含具体策略判断、DB 查阅与操作。plugin-handler 调用 service 层 | `plugin-handlers/before/*.ts`（handler 调用 service）+ `service/tool-governance/**/*.ts` + `service/permission/reader.ts` + `service/repo/*.ts` + `service/file-guard/*.ts` + `service/gate/scope-validate.ts` | handler 是薄入口，业务逻辑和 DB 操作集中在 service 层 |
| **View** | 统一错误视图与结构化审计输出 | `service/tool-governance/presenter.ts`、`lib/enforce-stop-message.ts` | 只做消息格式化与日志输出，不做策略判断 |
| **Infrastructure** | 日志、配置、生命周期包装等基础设施 | `lib/log-manager.ts`、`lib/jsonl-writer.ts`、`lib/hook-lifecycle.ts` | 供所有层调用的通用工具 |

**关键约束**：

1. **Controller 不含业务**：`before-dispatcher.ts` 只负责按配置顺序串行调度 handler，不内联策略判断。新增的 `service/tool-governance/controller.ts` 属于 Service 层，不是 Controller 层，它被 handler 调用。
2. **Model 只管 DB 状态机**：`db-manager.ts` 负责连接、CRUD、schema 迁移；`store-types.ts` 负责类型定义。策略判断逻辑不属于 Model 层。
3. **Service 层承载业务**：`plugin-handlers/before/*.ts` 是 handler 入口，调用 `service/**/*.ts` 完成具体业务。DB 的查阅和操作集中在 service 层，handler 不直接操作 DB。
4. **新增治理域属于 Service 层**：`service/tool-governance/policies/*.ts` 是策略判断模块，`service/tool-governance/controller.ts` 是策略聚合器，它们都在 Service 层，由 `plugin-handlers/before/` 中的 handler 调用。

### 3.2 核心对象

```typescript
// service/tool-governance/context.ts
export interface ToolGovernanceContext {
  sessionID: string;
  callID?: string;
  agent: string;
  tool: string;
  args: Record<string, unknown>;
  command?: string;
  targetPaths: string[];
  repoOperation?: RepoOperation | null;
}

// service/tool-governance/decision.ts
export interface ToolGovernanceDecision {
  outcome: "allow" | "deny" | "ask" | "audit_only";
  ruleId: string;
  layer:
    | "static-permission"
    | "path-protection"
    | "repo-policy"
    | "impact-evidence"
    | "grant"
    | "tool-final-guard";
  severity: "info" | "warn" | "error";
  message: string;
  details: Record<string, unknown>;
}
```

### 3.3 日志集成

所有治理策略模块统一使用 `log-manager.ts` 的 `writeLog()` 和 `jsonl-writer.ts` 的 `writeJsonl()`。每次治理决策必须记录以下字段：

- `sessionID`
- `callID`
- `agent`
- `tool`
- `ruleId`
- `layer`
- `outcome`
- `detail`

禁止使用 `process.stderr.write`、`console.log`、`writeLogSafe()` 风格的 ad-hoc 日志。

### 3.4 子系统合规审计

| # | 子系统 | 状态 | 检查要点 |
|---|---|---|---|
| 1 | MVC Architecture | ✅ | 重构目标把 Controller / Model / Service / View 责任切开：Controller 只做编排、Model 只管 DB 状态机、Service 承载业务逻辑、View 做输出 |
| 2 | DB-only & DB-canonical | ✅ | 动态授权仍以 DB grant 为主，不新增文件型状态源 |
| 3 | Permission Matrix | ✅ | 保留 `opencode.json` 为静态权限权威源 |
| 4 | Concurrency Safe | ⚠️ | 决策聚合器引入后，需确认 grant check / bind / consume 仍然原子 |
| 5 | Hardened Enforcement | ✅ | 仍保留多层 fail-closed，只是统一决策入口 |
| 6 | Framework Harness | ⚠️ | 旧 harness 和测试桩需要同步改名 |
| 7 | Central State Management | ✅ | 决策状态不落新文件，继续依赖现有 DB / 运行态上下文 |
| 8 | Multi-Agent | ✅ | context/decision 模型天然适合父子 session 与 native agent |
| 9 | Log Central Management | ✅ | 强制统一到 `log-manager` + `jsonl-writer` |
| 10 | DB-canonical Management | ✅ | repo grant / dispatch privilege 继续以现有表为主 |
| 11 | Templatization & Parameterization | ✅ | policy 模块参数化，配置从 `opencode.json` / `project.config.json` 注入 |
| 12 | TypeScript + Bun Runtime | ⚠️ | 需控制每个 policy 文件规模 ≤ 400 行 |

---

## 四、实施清单

### 4.0 当前实施进度（2026-07-11 再审）

| 阶段 | 当前状态 | 代码证据 | 阻塞 / 下一步 |
|---|---|---|---|
| Phase 0: 问题 4 立即修复 | ✅ 完成 | `types.ts` 增加 `"none"`；`classify.ts` fallback 改为 `"none"`；`classify.test.ts` 72/72 PASS | 无 |
| Phase 1: 统一领域模型 | ✅ 完成 | `service/tool-governance/` 下 10 个 source 模块 + 8 个测试文件；6 个 policy 文件存在；tool-governance 测试 30/30 PASS | 后续只需继续补 live 场景，不再是骨架阻塞 |
| Phase 2: Dispatcher 接线 | ✅ 完成 | `tool-governance-handler.ts` 已新增；`before-dispatcher.ts` 已注册；`project.config.json.plugin_execution_order.before` 已包含 `tool-governance` | 需要 live Orchestrator -> build 验证运行时顺序和错误展示 |
| Phase 3: `safe_shell` / `codegraph` 收缩 | ✅ 完成 | `shell-guard.ts` 已移除 repo 分类主裁决；`codegraph.ts` 已移除 repo-op/GitHub write 主裁决并收敛为 evidence adapter；repo-op 由 `repo-policy` 统一裁决 | 仍需注意 CodeGraph evidence gate 先于 governance：缺 impact 时 `safe_shell git add` 会先被 `CODEGRAPH-ENFORCE` 阻断 |
| Phase 4: 日志统一 | ✅ 完成 | `presenter.ts` 的 block/allow runtime log 均输出 `ruleId/layer/outcome`；block/allow JSONL 均含 `outcome`；runtime log smoke 可见 `GOVERNANCE-ALLOW` / `GOVERNANCE-BLOCK` | 旧 handler 日志未完全迁移 |
| Phase 5: 回归与 live E2E | 🟡 部分完成 | component tests、handler tests、direct smoke、D3 runtime log smoke 已有 | 需要真正 Orchestrator -> build live LLM E2E 覆盖 safe_shell/CodeGraph/grant |

### 4.1 文件变更列表

| 序号 | 文件 | 变更类型 | 说明 |
|---|---|---|---|
| 1 | `.opencode/service/repo/types.ts` | 修改 | `RepoProvider` 增加 `"none"` 值 |
| 2 | `.opencode/service/repo/classify.ts` | 修改 | 非 git/gh 命令返回 `provider: "none"` |
| 3 | `.opencode/service/repo/__tests__/classify.test.ts` | 修改 | 更新非 repo 命令断言 |
| 4 | `.opencode/plugin-handlers/before/__tests__/codegraph.test.ts` | 修改 | 增加 cat/sha256sum 不被阻断的测试 |
| 5 | `.opencode/service/tool-governance/context.ts` | 新建 | 统一治理上下文 |
| 6 | `.opencode/service/tool-governance/decision.ts` | 新建 | 统一治理决策对象 |
| 7 | `.opencode/service/tool-governance/controller.ts` | 新建 | 聚合策略执行器 |
| 8 | `.opencode/service/tool-governance/presenter.ts` | 新建 | 统一错误视图 / 日志输出 |
| 9 | `.opencode/service/tool-governance/policies/permission-policy.ts` | 新建 | 静态权限策略 |
| 10 | `.opencode/service/tool-governance/policies/path-policy.ts` | 新建 | 受保护路径 / 路径作用域策略 |
| 11 | `.opencode/service/tool-governance/policies/repo-policy.ts` | 新建 | repo-op 统一策略 |
| 12 | `.opencode/service/tool-governance/policies/evidence-policy.ts` | 新建 | CodeGraph / attestation 证据策略 |
| 13 | `.opencode/service/tool-governance/policies/grant-policy.ts` | 新建 | repo grant / dispatch privilege 策略 |
| 14 | `.opencode/service/tool-governance/policies/shell-policy.ts` | 新建 | shell command allowlist / executor 语义策略 |
| 15 | `.opencode/plugins/before-dispatcher.ts` | 修改 | 接入统一治理控制器 |
| 16 | `.opencode/plugin-handlers/before/codegraph.ts` | 修改 | 收缩为 evidence adapter |
| 17 | `.opencode/plugin-handlers/before/permission-safety.ts` | 修改 | 去 delegate 化，改为 adapter |
| 18 | `.opencode/service/gate/scope-validate.ts` | 修改 | 迁出 route / UC7 / backup-bypass 子策略 |
| 19 | `.opencode/service/file-guard/shell-guard.ts` | 修改 | 去掉重复 repo 裁决，收缩为 executor |
| 20 | `.opencode/tools/safe_shell.ts` | 修改 | 改成薄工具层 |
| 21 | `.opencode/service/tool-governance/__tests__/*.ts` | 新建 | 新治理域单元测试 |

### 4.2 实施步骤

#### Phase 0: 问题 4 立即修复（0.5 天）

此阶段只修复 `safe_shell cat <file>` 被 `[FW-ENFORCE][REPO-OP]` 误拦截的问题，不涉及架构重构。完成后 `cat`、`sha256sum`、`ls` 等普通只读命令不再被 repo-op 误拦截。

**步骤 0.1：修改 `RepoProvider` 类型**

文件：`.opencode/service/repo/types.ts`

将第 1 行：

```typescript
export type RepoProvider = "git" | "gh" | "github_mcp";
```

改为：

```typescript
export type RepoProvider = "git" | "gh" | "github_mcp" | "none";
```

**步骤 0.2：修改 `classifyRepoShellCommand()` 非 repo 命令返回值**

文件：`.opencode/service/repo/classify.ts`

将第 580-581 行：

```typescript
    return makeOperation("git", command, argv, "", "unknown", [], [],
      `not a git or gh command: ${cmd}`);
```

改为：

```typescript
    return makeOperation("none", command, argv, "", "unknown", [], [],
      `not a git or gh command: ${cmd}`);
```

**步骤 0.3：修改 `classifyRepoShellCommand()` 多命令返回值**

文件：`.opencode/service/repo/classify.ts`

将第 564 行：

```typescript
      return makeOperation("git", command, [], "", "unknown", [], [],
        "multi-command or shell operators detected");
```

改为：

```typescript
      return makeOperation("none", command, [], "", "unknown", [], [],
        "multi-command or shell operators detected");
```

**步骤 0.4：修改 `classifyRepoShellCommand()` 空命令返回值**

文件：`.opencode/service/repo/classify.ts`

将第 569 行：

```typescript
      return makeOperation("git", command, argv, "", "unknown", [], [], "empty command");
```

改为：

```typescript
      return makeOperation("none", command, argv, "", "unknown", [], [], "empty command");
```

**步骤 0.5：修改 `classifyRepoOperation()` fallback provider**

文件：`.opencode/service/repo/classify.ts`

将第 599-608 行的 fallback 语句中 `input.provider || "git"` 改为 `input.provider || "none"`：

```typescript
    return makeOperation(
      input.provider || "none",
      input.command || "",
      input.argv || [],
      "",
      "unknown",
      [],
      [],
      "insufficient input for classification",
    );
```

**步骤 0.6：确认 `codegraph.ts` 无需修改**

文件：`.opencode/plugin-handlers/before/codegraph.ts`

第 163 行当前逻辑：

```typescript
        if (repoOp.provider === "git" || repoOp.provider === "gh") {
```

步骤 0.2 完成后，`cat`/`sha256sum`/`ls` 等命令返回 `provider: "none"`，此条件不再命中，命令继续向下走到 allowlist 校验。此文件不修改。

**步骤 0.7：确认 `shell-guard.ts` 无需修改**

文件：`.opencode/service/file-guard/shell-guard.ts`

第 216 行当前逻辑：

```typescript
    if (repoOp.provider === "git" || repoOp.provider === "gh") {
```

步骤 0.2 完成后，非 repo 命令不再命中此条件。此文件不修改。

**步骤 0.8：更新现有测试断言**

文件：`.opencode/service/repo/__tests__/classify.test.ts`

将第 398-402 行：

```typescript
    test("not a git/gh command => unknown/block", () => {
      const op = classifyRepoShellCommand("ls -la");
      expect(op.kind).toBe("unknown");
      expect(op.decision).toBe("block");
    });
```

改为：

```typescript
    test("not a git/gh command => provider=none, not a repo operation", () => {
      const op = classifyRepoShellCommand("ls -la");
      expect(op.provider).toBe("none");
      expect(op.kind).toBe("unknown");
      expect(op.decision).toBe("block");
    });

    test("cat command => provider=none", () => {
      const op = classifyRepoShellCommand("cat foo.txt");
      expect(op.provider).toBe("none");
    });

    test("sha256sum command => provider=none", () => {
      const op = classifyRepoShellCommand("sha256sum foo.txt");
      expect(op.provider).toBe("none");
    });
```

**步骤 0.9：增加 codegraph hook 测试**

文件：`.opencode/plugin-handlers/before/__tests__/codegraph.test.ts`

在文件末尾的 `describe` 块内新增以下测试用例：

```typescript
    test("safe_shell cat <file> => not blocked by REPO-OP", async () => {
      const input = { tool: "safe_shell", args: { command: "cat foo.txt" }, sessionID: "test-sid" };
      const output = { args: { command: "cat foo.txt" } };
      await expect(codegraph.handle(input, output)).resolves.toBeUndefined();
    });

    test("safe_shell sha256sum <file> => not blocked by REPO-OP", async () => {
      const input = { tool: "safe_shell", args: { command: "sha256sum foo.txt" }, sessionID: "test-sid" };
      const output = { args: { command: "sha256sum foo.txt" } };
      await expect(codegraph.handle(input, output)).resolves.toBeUndefined();
    });

    test("safe_shell git add a.ts => still blocked by REPO-OP", async () => {
      const input = { tool: "safe_shell", args: { command: "git add a.ts" }, sessionID: "test-sid" };
      const output = { args: { command: "git add a.ts" } };
      await expect(codegraph.handle(input, output)).rejects.toThrow(/REPO-OP/);
    });
```

**步骤 0.10：清 bun 缓存并运行测试**

执行以下命令：

```bash
rm -rf /home/zhaoge/.cache/bun
cd /home/zhaoge/workspace/opencode/work-one
bun test .opencode/service/repo/__tests__/classify.test.ts
bun test .opencode/plugin-handlers/before/__tests__/codegraph.test.ts
```

确认所有测试通过。如果 `codegraph.test.ts` 因为 mock 依赖失败，确认至少 `classify.test.ts` 全部通过。

**步骤 0.11：serve API smoke 验证**

启动 serve（如果未运行）：

```bash
cd /home/zhaoge/workspace/opencode/work-one && opencode serve &
```

创建测试 session 并调用 safe_shell：

```bash
SID=$(curl -s -X POST http://127.0.0.1:4096/session -H 'content-type: application/json' -d '{"title":"p4-smoke","agent":"Orchestrator"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
curl -s -X POST http://127.0.0.1:4096/session/$SID/prompt_async -H 'content-type: application/json' -d '{"parts":[{"type":"text","text":"use safe_shell to run: cat .opencode/service/repo/types.ts"}]}'
```

确认返回结果中不包含 `[FW-ENFORCE][REPO-OP]`。

#### Phase 1: 统一领域模型（2-3 天）

**步骤 1.1：新建治理域目录和类型文件**

创建文件：`.opencode/service/tool-governance/context.ts`

写入第三章 3.2 节定义的 `ToolGovernanceContext` 接口。

创建文件：`.opencode/service/tool-governance/decision.ts`

写入第三章 3.2 节定义的 `ToolGovernanceDecision` 接口。

**步骤 1.2：新建 presenter**

创建文件：`.opencode/service/tool-governance/presenter.ts`

实现以下函数：

```typescript
import { writeLog } from "../../lib/log-manager";
import { writeJsonl } from "../../lib/jsonl-writer";
import type { ToolGovernanceContext } from "./context";
import type { ToolGovernanceDecision } from "./decision";

export function presentBlock(ctx: ToolGovernanceContext, decision: ToolGovernanceDecision): Error {
  writeLog("tool-governance", "runtime", {
    sessionID: ctx.sessionID,
    callID: ctx.callID,
    agent: ctx.agent,
    tool: ctx.tool,
    level: decision.severity.toUpperCase(),
    event: "GOVERNANCE-BLOCK",
    detail: `ruleId=${decision.ruleId} layer=${decision.layer} outcome=${decision.outcome}`,
  });
  writeJsonl("audit", {
    event: "governance_block",
    ruleId: decision.ruleId,
    layer: decision.layer,
    tool: ctx.tool,
    agent: ctx.agent,
    sessionID: ctx.sessionID,
  }, { sessionID: ctx.sessionID, tool: ctx.tool });
  return new Error(decision.message);
}

export function presentAllow(ctx: ToolGovernanceContext, ruleId: string): void {
  writeLog("tool-governance", "runtime", {
    sessionID: ctx.sessionID,
    callID: ctx.callID,
    agent: ctx.agent,
    tool: ctx.tool,
    level: "INFO",
    event: "GOVERNANCE-ALLOW",
    detail: `ruleId=${ruleId}`,
  });
}
```

**步骤 1.3：新建 6 个 policy 文件**

依次创建以下文件，每个文件导出一个 `evaluate(ctx: ToolGovernanceContext): ToolGovernanceDecision | null` 函数。返回 `null` 表示该策略不适用，返回 `Decision` 表示该策略做出了裁决。

- `.opencode/service/tool-governance/policies/permission-policy.ts` — 调用 `getAgentPermission()` 和 `getAgentShellAllowlist()`，判断静态权限
- `.opencode/service/tool-governance/policies/path-policy.ts` — 迁移 `behavioral-path-guard.ts` 的受保护路径检查
- `.opencode/service/tool-governance/policies/repo-policy.ts` — 调用 `classifyRepoShellCommand()`，对 `provider !== "none"` 的 repo 写操作做阻断
- `.opencode/service/tool-governance/policies/evidence-policy.ts` — 迁移 `codegraph.ts` 的 impact evidence 门
- `.opencode/service/tool-governance/policies/grant-policy.ts` — 调用 `hasRepoGrant()` / `hasGrant()`
- `.opencode/service/tool-governance/policies/shell-policy.ts` — 迁移 `shell-guard.ts` 的 allowlist / dangerous pattern / eval 检查

**步骤 1.4：新建策略聚合器（Service 层）**

创建文件：`.opencode/service/tool-governance/controller.ts`

此文件属于 Service 层，不是 Controller 层。它被 `plugin-handlers/before/` 中的 handler 调用，聚合多个 policy 的判断结果。实现以下逻辑：

```typescript
import type { ToolGovernanceContext } from "./context";
import type { ToolGovernanceDecision } from "./decision";
import { presentBlock, presentAllow } from "./presenter";
import { evaluate as evalPermission } from "./policies/permission-policy";
import { evaluate as evalPath } from "./policies/path-policy";
import { evaluate as evalRepo } from "./policies/repo-policy";
import { evaluate as evalEvidence } from "./policies/evidence-policy";
import { evaluate as evalGrant } from "./policies/grant-policy";
import { evaluate as evalShell } from "./policies/shell-policy";

const POLICIES = [evalPermission, evalPath, evalRepo, evalEvidence, evalGrant, evalShell];

export function evaluate(ctx: ToolGovernanceContext): void {
  for (const policy of POLICIES) {
    const decision = policy(ctx);
    if (decision === null) continue;
    if (decision.outcome === "deny") {
      throw presentBlock(ctx, decision);
    }
    if (decision.outcome === "ask") {
      throw presentBlock(ctx, decision);
    }
  }
  presentAllow(ctx, "all-policies-passed");
}
```

**步骤 1.5：为每个 policy 建立最小单元测试**

在 `.opencode/service/tool-governance/__tests__/` 下为每个 policy 创建测试文件，覆盖 allow / deny / not-applicable 三种路径。

#### Phase 2: Dispatcher 接线（2 天）

**步骤 2.1：在 handler 中引入统一治理策略聚合器**

在 `plugin-handlers/before/` 中的 handler 里（如新建的 `tool-governance-handler.ts`）调用 `service/tool-governance/controller.ts` 的 `evaluate(ctx)`。`before-dispatcher.ts` 本身不修改，它只负责按顺序调度 handler。

**步骤 2.2：将现有 handler 改为薄 adapter**

- `permission-safety.ts` 改为调用 `permission-policy`
- `codegraph.ts` 改为调用 `evidence-policy`
- `scope.ts` 改为调用 `path-policy`
- `behavioral-path-guard.ts` 的逻辑迁入 `path-policy`

**步骤 2.3：确保 execution order 兼容**

确认 `project.config.json` 的 `plugin_execution_order.before` 需要添加新 handler（如 `tool-governance`）到执行顺序中。该 handler 调用 `service/tool-governance/controller.ts`，dispatcher 仍只做串行调度。

#### Phase 3: safe_shell 收缩（2-3 天）

**步骤 3.1：移除 `shell-guard.ts` 内重复 repo 策略裁决**

删除 `shell-guard.ts` 第 214-231 行的 repo classification 阻断块。repo 策略已由 `repo-policy` 在 before hook 层统一处理。

**步骤 3.2：让 `safe_shell` 只保留最终执行兜底**

`safe_shell.ts` 只负责：参数读取、调用 `safeBashTool()` 做执行、返回结果。不再重复 repo 裁决、allowlist 裁决（这些已由 policy 层处理）。

**步骤 3.3：确认 `classifyRepoShellCommand()` 语义正确**

Phase 0 已修复。此步骤确认所有调用方对 `provider: "none"` 的处理正确：跳过 repo 策略，继续走 shell allowlist。

#### Phase 4: 日志统一与错误视图统一（1-2 天）

**步骤 4.1：引入 governance logger facade**

所有 policy 模块统一使用 `presenter.ts` 的 `presentBlock()` / `presentAllow()`，不直接调用 `writeLog`。

**步骤 4.2：统一阻断 message 格式**

所有阻断消息格式统一为：

```
[FW-ENFORCE][<ruleId>] <message>
layer=<layer> outcome=<outcome> tool=<tool> agent=<agent>
```

**步骤 4.3：清理 ad-hoc 日志**

移除 `store-crud.ts` 中的 `writeLogSafe()` 风格调用，改为直接 `import { writeLog } from "../../lib/log-manager"`。

#### Phase 5: 回归与 live E2E（2-3 天）

**步骤 5.1：回归 repo grant 主链**

确认 `safe_repo_stage` / `safe_repo_commit` / `safe_repo_push` 的 grant lifecycle 不受影响。

**步骤 5.2：回归 CodeGraph impact 强制**

确认未做 CodeGraph 的源码写操作仍被阻断。

**步骤 5.3：专测 safe_shell 各场景**

- `safe_shell cat <file>` 成功
- `safe_shell git status` 成功
- `safe_shell git add a.ts` 被引导至 `safe_repo_stage`
- `safe_shell sha256sum <file>` 成功
- `safe_shell node script.ts` 走 script content scan

---

## 五、验证计划

### 5.1 单元测试

- [x] `classifyRepoShellCommand("cat foo.txt")` 返回 `provider: "none"`
- [x] `classifyRepoShellCommand("sha256sum foo.txt")` 返回 `provider: "none"`
- [x] `classifyRepoShellCommand("ls -la")` 返回 `provider: "none"`
- [x] `classifyRepoShellCommand("git status")` 返回 `provider: "git", kind: "read"`
- [x] `classifyRepoShellCommand("git add a.ts")` 返回 `provider: "git", kind: "local_write"`
- [x] `repo-policy` 对 `git status` 判定为 allow
- [x] `repo-policy` 对 `git add a.ts` 判定为 deny（引导至 safe_repo_*）
- [x] `repo-policy` 对 `cat foo.txt` 返回 null（不适用）
- [x] `permission-policy` 正确读取 `opencode.json` 并产出统一决策对象
- [x] `path-policy` 对受保护路径产出统一 deny decision
- [x] `evidence-policy` 对未做 CodeGraph 的写操作产出 deny decision（组件测试通过，live 链仍待 E2E）
- [x] `shell-policy` 可被导入并覆盖 dangerous / allowlist / bypass 场景
- [x] `controller.ts` 可被导入并聚合全部 policy
- [x] `presenter` runtime log 统一格式化错误/放行消息，包含 `ruleId/layer/outcome`

### 5.2 集成测试

- [x] `before-dispatcher` 接入新 controller 后，handler 顺序与现有兼容（static/component 已通过，active runtime log 已出现 governance 事件）
- [ ] `scope` adapter 迁薄后，UC7 / backup-bypass / route mismatch 仍按原规则工作
- [x] `safe_shell` 经统一治理链后，普通读命令不再命中 repo-op 误拦截（`cat package.json` 与 `cat .opencode/service/repo/types.ts` direct smoke 均已通过）
- [ ] `safe_repo_*` 与 grant service 仍保持原 lifecycle
- [ ] 日志事件统一包含 `sessionID/callID/agent/tool/ruleId/layer/outcome`（runtime log 已具备；block JSONL 缺 `outcome` 字段）

### 5.3 端到端测试

- [ ] Orchestrator -> build 调 `safe_shell cat <file>` 成功，不再报 `[FW-ENFORCE][REPO-OP]`（non-protected / protected path 的 direct smoke 均已通过；仍待真正 live LLM E2E）
- [ ] Orchestrator -> build 调 `safe_shell git status` 成功
- [ ] Orchestrator -> build 调 `safe_shell git add a.ts` 被明确引导至 `safe_repo_stage`
- [ ] 无 grant 调 `safe_repo_stage` 报 grant 缺失
- [ ] 有 grant 且 impact 完成时 `safe_repo_stage` 成功
- [ ] 未做 CodeGraph 的源码写操作仍被阻断
- [ ] `safe_hash` 在 `safe_shell` 不可用场景下仍可完成只读 hash

### 5.4 子系统合规验证

- [ ] MVC Architecture：确认 dispatcher（Controller 层）不含业务逻辑，策略全在 service 层；controller.ts 属于 Service 层而非 Controller 层
- [ ] Concurrency Safe：确认 grant bind/check/consume 无竞态退化
- [ ] Framework Harness：确认旧 harness 名称与新治理域不冲突
- [ ] Log Central Management：确认治理域所有日志统一走 `log-manager`
- [ ] TypeScript + Bun Runtime：确认新增 policy 文件均保持小而专一，≤ 400 行

---

## 六、风险与缓解

### 6.1 风险

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| 迁移时打破现有阻断链 | 可能出现漏拦或误放行 | 保留双轨阶段：旧 handler 作为 adapter 调新 policy，逐步裁剪 |
| 统一治理后单点故障放大 | 核心 controller 出错影响所有工具 | 保持 policy 粒度拆分 + 单元测试覆盖 + fail-closed |
| 日志字段变化影响现有排障脚本 | 运维/诊断工具需要适配 | 保留旧字段，新增标准字段，分阶段迁移 |
| `safe_shell` 改造影响大量既有路径 | 部分历史命令用法失效 | 提供迁移矩阵：读命令、repo 命令、脚本命令分别指向一等工具/新适配器 |
| legacy fallback 清理过快 | 某些旧 agent/旧路径异常 | 先降级为告警，再移除 |

### 6.2 回滚方案

1. 保留原 before handlers 的 adapter 包装，统一治理 controller 作为可切换层引入。
2. 通过 `project.config.json` 增加治理模式开关：`legacy` / `hybrid` / `unified`。
3. 如果统一治理出现异常：切回 `hybrid`，保留新 policy 模块与测试，仅恢复旧 handler 的裁决权。
4. 回滚过程中不删除新测试，以便继续定位差异。
5. Phase 0 的修复（`provider: "none"`）独立于后续阶段，如果后续阶段出问题回滚，Phase 0 的修复保留不动。

---

## 七、成功标准

- [x] `classifyRepoShellCommand("cat foo.txt")` 返回 `provider: "none"`
- [x] `safe_shell cat <file>` 不再报 `[FW-ENFORCE][REPO-OP]`
- [x] `safe_shell sha256sum <file>` 不再报 `[FW-ENFORCE][REPO-OP]`
- [x] `safe_shell git status` 仍正常工作（build/general/explore 只读 repo 命令 allow；Orchestrator 按静态权限 deny `git *`）
- [x] `safe_shell git add a.ts` 仍被引导至 `safe_repo_stage` / `safe_repo_*`（hook 层 REPO-OP；工具层 fail-closed）
- [x] 静态权限、动态授权、impact 证据、path 保护、repo-op 语义分别有独立 policy 模块（`grant-policy` 当前为 delegated/audit_only）
- [x] `tool-governance/controller.ts` 可被 runtime 正常导入
- [x] `before-dispatcher` / before handler 已接入统一治理 controller
- [x] `before-dispatcher` 只做控制器编排，不再堆叠领域细节
- [ ] `scope-validate.ts` 被拆分，不再承担多种无关责任
- [x] `codegraph.ts` 收敛为 evidence 相关职责，不再混装 repo-op 主裁决
- [x] `safe_shell` 不再重复实现完整 repo-op 裁决链（repo-op 分类主裁决已从 `shell-guard.ts` 移除；执行层兜底仍保留）
- [ ] 所有治理决策统一记录 `ruleId/layer/outcome`（runtime log 已具备；block JSONL 缺 `outcome` 字段）
- [x] 日志统一走 `log-manager` / `jsonl-writer`
- [ ] repo grant 与 dispatch privilege 主链在新架构下保持兼容
- [ ] 新增治理域模块具备完整 unit / integration / E2E 验证闭环

---

## 八、附录

### 8.1 相关文件

- `/home/zhaoge/workspace/opencode/work-one/opencode.json`
- `/home/zhaoge/workspace/opencode/work-one/.opencode/plugins/before-dispatcher.ts`
- `/home/zhaoge/workspace/opencode/work-one/.opencode/plugin-handlers/before/codegraph.ts`
- `/home/zhaoge/workspace/opencode/work-one/.opencode/plugin-handlers/before/permission-safety.ts`
- `/home/zhaoge/workspace/opencode/work-one/.opencode/plugin-handlers/before/behavioral-path-guard.ts`
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/gate/scope-validate.ts`
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/permission/reader.ts`
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/repo/classify.ts`
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/repo/types.ts`
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/repo/grants.ts`
- `/home/zhaoge/workspace/opencode/work-one/.opencode/service/file-guard/shell-guard.ts`
- `/home/zhaoge/workspace/opencode/work-one/.opencode/tools/safe_shell.ts`
- `/home/zhaoge/workspace/opencode/work-one/.opencode/tools/safe_hash.ts`
- `/home/zhaoge/workspace/opencode/work-one/.opencode/lib/log-manager.ts`

### 8.2 参考资料

- `/home/zhaoge/workspace/qoderwork/documents/review/exec-execFile-spawn.md`
- `/home/zhaoge/workspace/qoderwork/documents/review/execFile-usage.md`
- `/home/zhaoge/workspace/qoderwork/documents/opencode-framework/tool-permission-interception-authorization-layer-map.md`
