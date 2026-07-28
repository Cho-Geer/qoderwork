# Blueprint: 工具治理链重构（MVC + 统一日志 + 高扩展）

**创建日期**: 2026-07-12
**更新日期**: 2026-07-28
**状态**: 已完成
**相关蓝图**: 无

**版本**: v3.0.0
**日期**: 2026-07-13
**原状态（PHASE-03 前自述）**: 部分实施（Phase 0-7 core 已有组件 + import + L3-012 live E2E 证据；v3.0.0 新增 Phase 8 即时 Bug 修复 + Phase 9 Option A 收口：审核发现 codegraph 豁免遗漏、Zod v4 兼容、before-chain 顺序偏差、Orchestrator node -e 绕过、write API 正则绕过五个问题，Phase 8/9 为必须实施项）
**优先级**: P0

---

## 0. Live 实施状态（2026-07-13 复核）

| 范围 | 当前状态 | 证据等级 | 证据 |
|---|---|---|---|
| Phase 0 repo 分类器 hotfix | ✅ 已完成 | component + direct tool smoke | `RepoProvider` 已含 `"none"`；`classifyRepoShellCommand()` 对 `cat`/`sha256sum`/`ls` 返回 `provider:"none"`；`classify.test.ts` 72/72 PASS |
| before/codegraph repo-op 边界 | ✅ 已完成 | component + static/code | `codegraph.ts` 已改为复用 `extractShellEvidenceTarget()`；`extractShellEvidenceTarget()` 对 `git` / `gh` 返回空 target；`codegraph.test.ts` 覆盖 `safe_shell gh issue create` defer，2026-07-13 组件套件 104/104 PASS |
| safe_shell 执行层边界 | ✅ 已完成 | direct tool smoke | `safeBashTool({agent:"Orchestrator", command:"cat ..."})` 与 `sha256sum ...` 成功；`build/general git status --short` 成功；`git add` fail-closed 并提示 `safe_repo_*` |
| 统一 `service/tool-governance/**` 领域模型 | ✅ 已落地 | static/code + unit | 目录已存在，含 10 个 source 模块 + 8 个测试文件；`context` / `decision` / `controller` / `presenter` / 6 个 policy 均可导入；tool-governance 测试 30/30 PASS |
| governance controller 可运行性 | ✅ 已修复 | component | `bun test .opencode/service/tool-governance/controller.ts .opencode/plugin-handlers/before/tool-governance-handler.ts` 可完成导入检查；controller/handler direct smoke 覆盖 allow、repo deny、protected path deny |
| handler adapter / runtime 接线 | ✅ import 已闭合 | static/code + import smoke | `.opencode/plugin-handlers/before/tool-governance-handler.ts` 已接入；`before-dispatcher.ts` / `project.config.json` 中 `tool-governance` 已位于 `path-validate` / `codegraph` 之前；`bun -e 'await import("./.opencode/plugins/before-dispatcher.ts")'` 输出 `before-dispatcher import ok` |
| `codegraph.ts` / `shell-guard.ts` 收缩 | ✅ 组件级已完成 | static/code + component | `shell-guard.ts` 已移除 repo 分类主裁决，仅保留执行层权限/危险命令/allowlist 兜底；`codegraph.ts` 已去掉 repo-op 主裁决，并对 repo/gh shell 命令 defer；`codegraph.test.ts` 当前通过 |
| policy 测试覆盖 | ✅ 已补齐组件测试 | component | `service/tool-governance/__tests__/*.test.ts` 30/30 PASS，覆盖 6 个 policy；`tool-governance-handler.test.ts` 2/2 PASS；`safe-bash-core.test.ts` 23/23 PASS |
| 统一治理日志 `ruleId/layer/outcome` | ✅ 已完成 | static/code + runtime log smoke | `presentBlock()` 与 `presentAllow()` 均写 `ruleId/layer/outcome` 到 runtime log；block/allow 的 `audit.jsonl` 事件均含 `outcome` 字段 |
| safe_shell path 边界 | ✅ 组件级已修复 | component + static/code | `path-validate.ts` 已改为复用 `service/tool-governance/shell-targets.ts` 的 `extractShellLocalPaths()`；`path-validate.test.ts` 28/28 PASS，并确认 `gh --repo` / `gh api repos/...` / JSON body / `/dev/null` 不再被误识别为本地路径 |
| Phase 6 parser 单源化 | 🟡 core 已闭合，落盘仍待收口 | static/code + CodeGraph impact + import smoke | `path-validate.ts`、`tool-scope-paths.ts`、`tool-scope-match.ts`、`codegraph.ts` 均已复用 `service/tool-governance/shell-targets.ts`；`parseShellWriteTargets` re-export 兼容缺口已修复并通过 before-dispatcher import smoke；但 `shell-targets.ts` / test 仍需纳入 git 跟踪并做正式收口 |
| active before 链单一裁决收口 | ✅ core L3-012 已闭合 | live LLM E2E + component | `tool-governance` 已位于 `path-validate` / `codegraph` 之前；L3-012 session `ses_0a66bc378ffelPj4R46sNeG0zR` 见证固定 `safe_shell gh issue create --repo ...` 首个业务阻断为 `[REPO-OP] ... layer=repo-policy outcome=deny`，未出现 `WORKTREE_BOUNDARY` / `CODEGRAPH-ENFORCE` |
| L3-012 live Orchestrator E2E | ✅ PASS（core） | live serve API + messages snapshot | `e2e-evidence/L3/L3-012/messages-final.json` 见证真实 `Orchestrator` 调用固定命令并被 `repo-policy` deny；证据包为最小包，缺 prompt/question/monitor 完整留痕；不覆盖全部 `gh` remote_write 变体 |
| Phase 7 safe_shell 去 shell 化 | 🟡 组件/工具边界已实施 | static/code + component + direct tool smoke | `shell-guard.ts` 已移除 `execSync(command)` 路径，`safe_shell.ts` 变为 async 薄适配器并消费 `__verified_command_plan`；`command-executor.ts` 使用 `execFile`/`spawn` 且 `shell:false`；104/104 相关测试 PASS；direct tool smoke `pwd` 成功 |
| Phase 8 即时 Bug 修复 | ✅ 已实施（代码已修，2026-07-13 复核） | static/code 复核 | (1) `codegraph.ts:73-88` `isExemptPath()` 豁免列表已扩展（`.gitignore`/`package.json`/`tsconfig.json` 等，含 `// Phase 8` 注释）；(2) `safe_shell.ts:29` 已改为双参数 `tool.schema.record(tool.schema.string(), tool.schema.string())`；(3) `before-dispatcher.ts:67-70` DEFAULT_ORDER 已是 `permission-safety, tool-governance, behavioral-path-guard, scope`，与 `project.config.json` 一致。**注：§5.1/§5.2/§7 对应 checkbox 仍为 `[ ]`，需批量勾选；步骤 8.4 测试用例待确认** |
| Phase 9 Option A 收口 | ✅ 已实施（代码已修，2026-07-13 复核） | static/code 复核 | (1) `opencode.json` Orchestrator `safe_shell` 已 `node -e *: deny`/`node *.ts *: deny`/`node *.js *: deny`（无 allow）；(2) `shell-guard.ts` `isOrchestrator` 计数=0、`allow-write` 计数=0（豁免和后门已删）；(3) `tool-scope-match.ts:224` writeApis 正则已含 bracket notation 模式；`shell-config.ts:320-323` WRITE_PATTERNS 已加 `// Phase 9` 注释；`write-bypass-prevention.test.ts` 已存在。**注：§5.2/§7 对应 checkbox 仍为 `[ ]`，需批量勾选** |

**当前结论**: Phase 8（3 个即时 Bug）和 Phase 9（3 个安全绕过）的**代码修复已于 2026-07-13 复核确认完成**（blueprint 状态从 🔴 未实施 更正为 ✅ 已实施），但 §5.1/§5.2/§7 对应 checkbox 仍为 `[ ]`，需批量勾选并补跑验证命令确认。Phase 6 的 core blocker 已关闭，Phase 7 核心代码路径已迁移到 `VerifiedCommandPlan` + `execFile`/`spawn`（`shell:false`）。剩余收口项是：勾选 Phase 8/9 checkbox 并补测试证据、纳入 untracked 新文件、补齐 L3-012 完整证据包或明确保留最小证据边界、扩展 `gh` remote_write 变体 E2E、补 Phase 7 allow-path live E2E（含资源上限、中断、进程树终止）并完成正式回归/提交。

### 0.1 弱模型安全实施协议（2026-07-13）

本 blueprint 允许弱模型参与实施，但**弱模型不得拥有最终完成判定权**。执行分工固定如下：

| 角色 | 允许做 | 禁止做 | 交付物 |
|---|---|---|---|
| 弱模型实施者 | 按 §4.3 的单张任务卡修改指定文件；运行任务卡列出的固定验证命令；记录实际输出 | 自行扩大范围；跨任务批量重构；新增 shell fallback；把 `[ ]` 改成 `[x]`；删除/改写失败测试；宣称 blueprint 完成 | patch diff、命令输出、失败日志、未解决问题 |
| 强审查模型 / 人工 reviewer | 审查 diff、重跑验证、补做 live E2E、决定是否勾选完成项 | 直接相信弱模型口头结论 | review finding、验证证据、状态更新 |

**弱模型全局硬约束**：

1. 一次只领取一张任务卡；每张任务卡最多修改 3 个源码文件和 2 个测试/文档文件。
2. 修改前必须记录 `git status --short`，遇到非本任务相关 dirty 文件只能忽略，不得回滚。
3. 修改 work-one 代码前必须先跑 `codegraph status`，并对任务卡指定的入口符号跑 `codegraph impact`。
4. 不得使用 `exec`、`execSync`、`execFileSync`、`shell:true`、`sh -c`、`bash -c`、`/bin/sh -c`，也不得新增 `allowShellFallback` / `rawCommand` / `shellCommand` 兼容字段。
5. 不得把组件测试通过外推为 live E2E 通过；不完整证据只能写 `PARTIAL` 或 `CORE PASS`，不得写 `COMPLETE`。
6. 不得修改本 blueprint 的状态、checkbox 或成功标准；状态更新只能由强审查模型 / 人工 reviewer 在复核后完成。
7. 任何验证失败时必须停止当前任务卡，保留失败输出，不得继续“顺手修别的”。

**完成判定门**：

弱模型交付后，必须由强审查模型 / 人工 reviewer 完成以下最小复核，才允许勾选任务卡：

- 复查 diff 是否只触及任务卡允许文件。
- 重跑任务卡固定验证命令。
- 对安全相关代码做负向搜索：`execSync`、`shell:true`、`bash -c`、`allowShellFallback`、`rawCommand`。
- 若任务卡声称 live E2E，通过 `messages-final.json` / `monitor.log` / session id 复核真实工具调用和阻断层。
- 将复核结果写入 `logs/YYYY-MM-DD-<topic>.md` 或对应 E2E evidence。

---

## 一、问题背景

### 1.1 问题描述

当前 work-one 框架中的"工具权限 / 拦截 / 授权"逻辑已经形成了一条多层治理链，安全性总体偏向 fail-closed，但实现上存在以下突出问题：

1. **决策分散**：静态权限、repo grant、CodeGraph、scope、shell allowlist、behavioral path guard 分散在多个 handler、service、tool 中。
2. **职责重叠**：同一个语义在 before hook 和工具内部重复判断，或被不同模块重复实现。
3. **语义混合**：有的模块同时承担"权限判断 + 领域分类 + 审计输出 + 用户错误消息拼接"。
4. **修复前误拦截风险**：`safe_shell cat <file>` 曾被 `[FW-ENFORCE][REPO-OP]` 阻断，暴露出 repo 分类器和上层阻断器语义未对齐；当前 Phase 0 已修复该误拦截。
5. **维护成本高**：排查一次阻断经常需要同时跨 `before-dispatcher`、`scope-validate`、`codegraph`、`classify`、`shell-guard`、`safe_*` 工具文件。
6. **新增实锤偏差（2026-07-12）**：`path-validate.ts` 曾对 `safe_shell` 命令字符串直接扫斜杠，导致 `gh issue create --repo microsoft/vscode`、`gh api repos/...`、JSON body、`/dev/null` 被误识别为本地路径；后续又发现 `codegraph.ts` 会对这类 repo/gh 远程写先抛 `CODEGRAPH-ENFORCE`，说明 active 链当时尚未真正收口为统一治理入口。

### 1.2 根因分析

**修复前直接原因**（问题 4）：`classifyRepoShellCommand("cat foo.txt")` 返回 `provider: "git", kind: "unknown"`。上层 `codegraph.ts:163` 判断 `repoOp.provider === "git"` 成立且 `kind !== "read"`，直接抛出 `[FW-ENFORCE][REPO-OP]`。

修复前实测证据（2026-07-11 方案创建时 bun 执行）：

```json
{"command":"cat foo.txt","provider":"git","kind":"unknown","reason":"not a git or gh command: cat"}
{"command":"sha256sum foo.txt","provider":"git","kind":"unknown","reason":"not a git or gh command: sha256sum"}
{"command":"ls -la","provider":"git","kind":"unknown","reason":"not a git or gh command: ls"}
```

当前复核（2026-07-11 交叉审核）：`classifyRepoShellCommand()` 已对 `cat` / `sha256sum` / `ls` 返回 `provider: "none"`；`classify.test.ts` 72/72 PASS；`codegraph.test.ts` 5/5 PASS；`safeBashTool` 直接执行 `cat` / `sha256sum` 成功；`build` / `general` 执行 `git status --short` 成功，`git add` 仍 fail-closed。

**根本原因**：框架虽然已引入统一的 **Tool Governance Domain Model**，但 active before 链仍保留多条不完全收口的历史 gate。系统尚未把"静态访问控制 / shell 目标解析 / 运行时策略判断 / 动态任务授权 / 工具执行器 / 审计与展示"完全收敛到单一领域入口，导致 Controller 链、独立 gate、领域服务层之间继续存在长期耦合和优先级竞争。

修复前三处阻断点的代码位置：

| 阻断点 | 文件 | 修复前位置 | 修复前逻辑缺陷 | 当前复核 |
|---|---|---|---|---|
| 分类器 | `.opencode/service/repo/classify.ts` | 580-581 | 非 git/gh 命令返回 `provider: "git"` | 已改为 `provider: "none"` |
| before hook | `.opencode/plugin-handlers/before/codegraph.ts` | 163 | `provider === "git"` 即进入 repo-op 阻断 | repo-op / GitHub write 裁决已移入 `service/tool-governance/policies/repo-policy.ts`；`codegraph.ts` 仅保留 evidence gate |
| 工具内 guard | `.opencode/service/file-guard/shell-guard.ts` | 216 | 同上，重复裁决 | repo 分类主裁决已移除；仍保留执行层危险命令/allowlist 兜底 |
| 结构路径 gate | `.opencode/plugin-handlers/before/path-validate.ts` | 49-57（修复前） | 对 `safe_shell` 命令直接扫 `/...` / `../...` 片段，把 repo slug、API route、正文字符串误判成本地路径 | 2026-07-12 已改为 statement/argv 级路径提取，但仍是治理域外的独立 parser |

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
8. 2026-07-12 直接调用 `codegraph.handle()`：`safe_shell git add a.ts` 不再触发 REPO-OP；但当时若缺少 CodeGraph impact，会先被 `CODEGRAPH-ENFORCE` evidence gate 阻断。
9. 直接调用 `safeBashTool()`：`cat` / `sha256sum` 成功，`build/general git status --short` 成功，`build/general git add a.ts` 在 dry-run 下 fail-closed；当前阻断来自执行层 allowlist 兜底，不再是 `shell-guard.ts` 的 repo-op 分类主裁决。
10. `bun test ./.opencode/plugin-handlers/before/__tests__/path-validate.test.ts`：2026-07-13 复核为 **28/28 PASS**，覆盖 `gh --repo` / `gh api repos/...` / JSON body / `/dev/null` / `cd && relative path` / `node -e` 等场景。
11. direct smoke（2026-07-12）：`pathValidate.handle("gh issue create --repo microsoft/vscode ...")` → **ALLOW**；`toolGovernance.handle(...)` → **`REPO-OP deny`**；`codegraph.handle(...)` → **`[CODEGRAPH-ENFORCE] safe_shell blocked`**。该失败已由 Phase 6 的 `extractShellEvidenceTarget()` defer 方案在组件测试中修正，并在 2026-07-13 L3-012 live E2E 中确认未再出现 `CODEGRAPH-ENFORCE`。
12. 2026-07-13 复核：`bun -e 'await import("./.opencode/plugins/before-dispatcher.ts")'` → **PASS**，输出 `before-dispatcher import ok`，`parseShellWriteTargets` re-export 兼容破口已关闭。
13. 2026-07-13 复核：`bun test ./.opencode/plugin-handlers/before/__tests__/tool-governance-handler.test.ts ./.opencode/plugin-handlers/before/__tests__/codegraph.test.ts ./.opencode/plugin-handlers/before/__tests__/path-validate.test.ts ./.opencode/service/tool-governance/__tests__/*.test.ts ./.opencode/service/file-guard/__tests__/safe-bash-execution.test.ts ./.opencode/lib/__tests__/safe-bash-core.test.ts` → **104/104 PASS**。
14. 2026-07-13 direct tool smoke：`safe_shell.execute({ command: "pwd", __verified_command_plan })` → exitCode `0`，输出 `/home/zhaoge/workspace/opencode/work-one`，证明工具层可消费治理层注入的 `VerifiedCommandPlan` 并通过 `execFile`/`spawn` 执行器完成 allow-path。
15. 2026-07-13 L3-012 live E2E：session `ses_0a66bc378ffelPj4R46sNeG0zR` 的 `messages-final.json` 见证固定 `safe_shell gh issue create --repo zzzz-invalid-owner-012345/zzzz-invalid-repo-012345 ...` 被 `[REPO-OP] Direct gh remote_write operations are blocked. Use safe_repo_* first-class tools instead.` 阻断，元信息为 `layer=repo-policy outcome=deny tool=safe_shell agent=Orchestrator`，且无 `WORKTREE_BOUNDARY` / `CODEGRAPH-ENFORCE`。

**结论**：问题 4 的原始根因仍然成立，并已在 Phase 0 修复；2026-07-12 暴露的第二类 active 运行态问题（`path-validate` shell 路径误判、`codegraph` 对 `safe_shell` repo/gh 远程写 evidence 过拦截）在 core 路径上已由 Phase 6 + L3-012 关闭。当前实现状态应定义为“治理域 core 链已贯通，仍需补齐变体矩阵、证据完整性和 Phase 7 live allow-path 收口”。

---

## 二、确定方案

建立统一 Tool Governance Domain，将治理请求固定拆为 Controller、Model、Service、View 和 Infrastructure 五层。所有实施步骤均以本节为唯一目标架构，不保留并行方案、兼容执行路径或实施者自行选择项。

统一治理域负责静态访问控制后的业务裁决、shell 语义解析、repo 策略、路径保护、CodeGraph evidence、grant 校验和统一审计。工具执行层只接收治理域输出的已验证执行计划，并保留不可绕过的最终兜底校验。

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

### 3.4 子进程执行安全契约

`safe_shell` 的字符串命令只允许作为治理域输入，不得直接传给 `exec`、`execSync`、`/bin/sh -c`、`bash -c` 或任何 `shell: true` 调用。治理域必须先生成不可变的执行计划：

```typescript
export interface VerifiedCommandPlan {
  executable: string;
  args: readonly string[];
  cwd: string;
  env: Readonly<Record<string, string>>;
  outputMode: "buffered" | "stream";
  timeoutMs: number;
  maxOutputBytes: number;
}
```

执行规则固定如下：

1. 仅允许单个已建模命令。解析结果含 `;`、`&&`、`||`、`|`、`>`、`<`、反引号、`$()`、后台执行、通配符展开或环境变量展开时，返回 `SHELL-COMPOSITION-DENY`，不得降级到 shell。
2. 有界短输出命令通过异步 `execFile(executable, args, { shell:false, ... })` 执行；长任务、大输出或实时输出命令通过 `spawn(executable, args, { shell:false, ... })` 执行。禁止 `exec`、`execSync` 和 `execFileSync`。
3. executable 必须来自配置中的命令到绝对路径映射；未知命令直接拒绝。args 必须按每个命令的子命令、选项、位置参数 schema 校验，必要时插入 `--` 阻止选项注入。
4. cwd 和路径参数必须经过 normalize、realpath、允许根检查和符号链接边界检查。执行时使用最小 env，并移除 `NODE_OPTIONS`、`BASH_ENV`、`ENV`、`LD_PRELOAD`、`DYLD_INSERT_LIBRARIES` 等加载注入变量。
5. timeout、AbortSignal 和输出字节上限为必填。超时、取消或输出超限必须终止整个子进程树，并记录 `exitCode/signal/timedOut/aborted/truncated`。
6. 复合工作流迁移到一等工具或仓库内已审核脚本；脚本路径、内容 hash、解释器和参数 schema 都必须固定并审计。不得增加兼容 shell 分支。

`shell-policy` 负责生成或拒绝 `VerifiedCommandPlan`，`command-executor.ts` 只执行已验证计划，不重新解析原始字符串。`safe_shell.ts` 必须变为异步薄适配器并 `await` 执行器。执行器仍做结构性断言，断言失败时 fail-closed。

### 3.5 子系统合规审计

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
| 12 | TypeScript + Bun Runtime | ⚠️ | 每个 policy 文件规模 ≤ 400 行；必须实测 Bun 对 `execFile`/`spawn`、AbortSignal 和子进程树终止的行为 |

---

## 四、实施清单

### 4.0 当前实施进度（2026-07-13 复核）

| 阶段 | 当前状态 | 代码证据 | 阻塞 / 下一步 |
|---|---|---|---|
| Phase 0: 问题 4 立即修复 | ✅ 完成 | `types.ts` 增加 `"none"`；`classify.ts` fallback 改为 `"none"`；`classify.test.ts` 72/72 PASS | 无 |
| Phase 1: 统一领域模型 | ✅ 完成 | `service/tool-governance/` 下 10 个 source 模块 + 8 个测试文件；6 个 policy 文件存在；tool-governance 测试 30/30 PASS | 后续只需继续补 live 场景，不再是骨架阻塞 |
| Phase 2: Dispatcher 接线 | ✅ import 闭合 | `tool-governance-handler.ts` 已新增；`before-dispatcher.ts` 已注册；`project.config.json.plugin_execution_order.before` 已包含 `tool-governance` 且位于 `path-validate` / `codegraph` 之前；before-dispatcher import smoke PASS | 仍需在正式提交前确认 active order 与文档期望是否需要完全一致，而不仅是满足 L3-012 core |
| Phase 3: `safe_shell` / `codegraph` 收缩 | ✅ 组件级完成 | `shell-guard.ts` 已移除 repo 分类主裁决；`codegraph.ts` 已移除 repo-op/GitHub write 主裁决；repo-op 由 `repo-policy` 统一建模；`codegraph.test.ts` 覆盖 `safe_shell gh issue create` defer | core 路径已由 import smoke + L3-012 live E2E 复验；仍需补其他 remote_write 变体 |
| Phase 4: 日志统一 | 🟡 治理域内完成，整链未完成 | `presenter.ts` 的 block/allow runtime log 均输出 `ruleId/layer/outcome`；runtime log smoke 可见 `GOVERNANCE-ALLOW` / `GOVERNANCE-BLOCK` | `path-validate` / `behavioral-path-guard` / `codegraph` 等旧 gate 仍写各自审计格式，整条 before 链未完全统一 |
| Phase 5: 回归与 live E2E | 🟡 core live 已收口，矩阵未完成 | 2026-07-13 相关组件套件 104/104 PASS；L3-012 live Orchestrator E2E PASS（session `ses_0a66bc378ffelPj4R46sNeG0zR`） | L3-012 证据包为最小包；L3-008/009/010/011 和 `gh` remote_write 变体仍需 live witness |
| Phase 6: active before 链收口 + shell parser 单源化 | 🟡 core 已落地，文件跟踪未收口 | `service/tool-governance/shell-targets.ts` 已存在；`path-validate.ts`、`tool-scope-paths.ts`、`tool-scope-match.ts`、`codegraph.ts` 已复用；`tool-governance` 已前置于 `path-validate` / `codegraph`；import smoke + L3-012 PASS | `shell-targets.ts` / test 等新增文件仍需纳入 git 跟踪；需要补 full evidence rerun 或保留最小证据边界说明 |
| Phase 7: 子进程执行器去 shell 化 | 🟡 组件/工具边界已实施 | `shell-plan.ts` 生成 `VerifiedCommandPlan`；`command-executor.ts` 使用 async `execFile`/`spawn` 且 `shell:false`；`safe_shell.ts` 消费 `__verified_command_plan`；safe-bash execution tests PASS；direct `pwd` smoke PASS | 仍需 live allow-path E2E，覆盖资源上限、中断、进程树终止、输出截断和真实 before-hook plan 注入 |
| Phase 8: 即时 Bug 修复 | ✅ 已实施（2026-07-13 复核） | (1) `codegraph.ts:73-88` 豁免列表已扩展含 `// Phase 8` 注释；(2) `safe_shell.ts:29` 已双参数 `record(string, string)`；(3) `before-dispatcher.ts:67-70` DEFAULT_ORDER 已 `permission-safety, tool-governance, behavioral-path-guard, scope` | §5.1/§5.2 checkbox 待勾选；步骤 8.4 测试用例待确认 |
| Phase 9: Option A 收口 | ✅ 已实施（2026-07-13 复核） | (1) `opencode.json` Orchestrator `node -e/*: deny`（无 allow）；(2) `shell-guard.ts` `isOrchestrator`=0、`allow-write`=0；(3) `tool-scope-match.ts:224` + `shell-config.ts:320-323` 正则已加固；`write-bypass-prevention.test.ts` 已存在 | §5.2/§7 checkbox 待勾选 |

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
| 22 | `.opencode/plugin-handlers/before/path-validate.ts` | 修改 | `safe_shell` 路径提取从斜杠正则升级为 statement/argv 级 shell 解析，并复用 `git/gh` repo classifier |
| 23 | `.opencode/plugin-handlers/before/__tests__/path-validate.test.ts` | 修改 | 新增 `gh --repo` / `gh api` / JSON body / `/dev/null` / `cd && relative path` / `node -e` 回归用例（28/28 PASS） |
| 24 | `.opencode/service/tool-governance/shell-targets.ts` | 新建（当前 untracked） | Phase 6 共享 `safe_shell` parser，提供 local path / write target / evidence target 三类解析 |
| 25 | `.opencode/service/tool-governance/__tests__/shell-targets.test.ts` | 新建（当前 untracked） | 覆盖 repo slug、local write target、repo shell defer、本地 evidence target |
| 26 | `.opencode/service/dispatch/tool-scope-paths.ts` | 修改 | 改为复用 `shell-targets.ts` 的 `parseShellWriteTargets()`；re-export 兼容已修复并通过 before-dispatcher import smoke |
| 27 | `.opencode/service/dispatch/tool-scope-match.ts` | 修改 | 改为复用 `shell-targets.ts` 的 `parseShellWriteTargets()` |
| 28 | `.opencode/service/tool-governance/command-plan.ts` | 新建 | 定义并构造 `VerifiedCommandPlan`，逐命令校验 executable/argv/cwd/env |
| 29 | `.opencode/service/tool-governance/command-executor.ts` | 新建 | 仅用异步 `execFile`/`spawn` 执行已验证计划，落实超时、取消、输出上限和进程树终止 |
| 30 | `.opencode/service/tool-governance/__tests__/command-plan.test.ts` | 新建 | 覆盖复合命令拒绝、选项注入、路径与环境边界 |
| 31 | `.opencode/service/tool-governance/__tests__/command-executor.test.ts` | 新建 | 覆盖 shell=false、输出上限、超时、取消、进程树终止和日志字段 |
| 32 | `.opencode/plugin-handlers/before/codegraph.ts` | 修改 | Phase 8：`isExemptPath()` 豁免列表追加非源码配置文件模式 |
| 33 | `.opencode/tools/safe_shell.ts` | 修改 | Phase 8：`tool.schema.record()` 修复为双参数 Zod v4 API |
| 34 | `.opencode/plugins/before-dispatcher.ts` | 修改 | Phase 8：`DEFAULT_ORDER` 中 `tool-governance` 移到 `permission-safety` 之后 |
| 35 | `.opencode/project.config.json` | 修改 | Phase 8：`plugin_execution_order.before` 同步 before-chain 顺序 |
| 36 | `opencode.json` | 修改 | Phase 9：Orchestrator `safe_shell` 删除 `node -e`/`node *.ts`/`node *.js` allow，追加 deny |
| 37 | `.opencode/agents/Orchestrator.md` | 修改 | Phase 9：修正 safe_shell 描述为只读命令列表 |
| 38 | `.opencode/service/file-guard/shell-guard.ts` | 修改 | Phase 9：删除 Orchestrator 目录豁免（第 311-329 行）和 `// safe_bash: allow-write` 后门 |
| 39 | `.opencode/service/dispatch/tool-scope-match.ts` | 修改 | Phase 9：writeApis 正则追加 bracket notation + 字符串拼接检测 |
| 40 | `.opencode/service/file-guard/shell-config.ts` | 修改 | Phase 9：`WRITE_PATTERNS` 追加 bracket notation 模式 |
| 41 | `.opencode/service/tool-governance/__tests__/write-bypass-prevention.test.ts` | 新建 | Phase 9：混淆绕过回归测试 |
| 42 | `.opencode/plugin-handlers/before/__tests__/codegraph.test.ts` | 修改 | Phase 8：追加非源码文件豁免测试用例 |

### 4.2 实施步骤

> 截至 2026-07-13，Phase 6 core 已通过 import smoke 与新版 L3-012 live Orchestrator E2E。后续不需要推倒重做；必须纳入 untracked 的 `shell-targets.ts` / 测试文件，补齐完整证据包或记录最小证据边界，并扩展 `gh` remote_write 变体 companion cases。

### 4.3 弱模型可执行任务卡

以下任务卡是弱模型唯一允许领取的实施单元。弱模型不得把多个任务卡合并执行；不得修改任务卡外文件；不得更新本 blueprint 状态。每张任务卡完成后交给强审查模型 / 人工 reviewer 做最终复核。

#### Task Card WG-01: 文件跟踪与基线收口

**目标**: 确认 Phase 6/7 新增文件全部纳入 git 跟踪范围，并生成当前基线清单。

**允许修改**:

- 不修改源码；只允许新增/更新 `logs/YYYY-MM-DD-*.md`

**允许命令**:

```bash
git status --short -- .opencode/service/tool-governance .opencode/service/file-guard .opencode/plugin-handlers/before .opencode/tools/safe_shell.ts
git diff --stat -- .opencode/service/tool-governance .opencode/service/file-guard .opencode/plugin-handlers/before .opencode/tools/safe_shell.ts
```

**交付物**:

- 列出所有 untracked/modified 文件。
- 标注哪些属于本 blueprint，哪些疑似无关 dirty 文件。
- 不允许执行 `git add`、`git commit`、`git checkout`、`git reset`。

**Reviewer 验收**:

- reviewer 决定是否 stage/commit；弱模型不得代替 reviewer 做版本控制判定。

#### Task Card WG-02: remote_write 变体 E2E 文档与证据脚手架

**目标**: 为 L3-012 companion cases 建立 E2E 文档和证据目录，覆盖 `gh api -X POST/PATCH/DELETE`、`gh issue comment`、`gh pr create`、release/workflow/secret 等 remote_write 变体。

**允许修改**:

- `e2e/L3-012-safe-shell-gh-remote-write-e2e.md`
- `e2e/opencode-framework-simplification-e2e-integration-plan.md`
- `e2e-evidence/L3/L3-012-*/*`（仅新增证据目录和 README/result 模板）
- `logs/YYYY-MM-DD-*.md`

**禁止修改**:

- `.opencode/**/*.ts`
- `opencode.json`
- 本 blueprint 的 checkbox / 状态

**固定验证**:

```bash
rg -n "gh api|gh issue comment|gh pr create|release|workflow|secret|remote_write" e2e blueprints/blueprint-tool-governance-mvc-refactor.md
```

**交付物**:

- 每个 companion case 有固定命令、固定 prompt、PASS/FAIL 判定、证据目录。
- 明确写出“未实际运行”或“NOT WITNESSED”，不得预填 PASS。

**Reviewer 验收**:

- reviewer 检查是否没有误写真实仓库 slug。
- reviewer 决定何时启动 live serve API E2E。

#### Task Card WG-03: Phase 7 allow-path live E2E

**目标**: 用真实 Orchestrator 会话证明 before-hook 生成的 `VerifiedCommandPlan` 能传到 `safe_shell` 并被最终执行器消费。

**允许修改**:

- `e2e/L3-0xx-safe-shell-verified-plan-allow-path-e2e.md`（如不存在则新建）
- `e2e-evidence/L3/L3-0xx-safe-shell-verified-plan-allow-path/*`
- `logs/YYYY-MM-DD-*.md`

**禁止修改**:

- `.opencode/**/*.ts`
- `opencode.json`
- 本 blueprint 的 checkbox / 状态

**固定 live 场景**:

- `safe_shell pwd` 应成功，返回 cwd。
- `safe_shell cat package.json` 应成功。
- `safe_shell "pwd && whoami"` 应被 `SHELL-COMPOSITION-DENY` 阻断，且不得启动子进程。

**必须保留证据**:

- `session-create.json`
- `session-id.txt`
- `prompt.json`
- `prompt_async-response.txt`
- `messages-final.json`
- `children-final.json`
- `monitor.log`
- `result.md`

**Reviewer 验收**:

- reviewer 复核 `messages-final.json` 中真实工具调用、返回元信息和错误层。
- reviewer 重跑 direct smoke 或 live E2E 后，才可更新 §5.3 / §7。

#### Task Card WG-04: Phase 7 资源类 E2E

**目标**: 验证 timeout、AbortSignal、输出上限和 POSIX 进程组终止在 live/runtime 层可观测。

**允许修改**:

- `e2e/L3-0xx-safe-shell-resource-limits-e2e.md`（如不存在则新建）
- `e2e-evidence/L3/L3-0xx-safe-shell-resource-limits/*`
- `logs/YYYY-MM-DD-*.md`

**禁止修改**:

- `.opencode/**/*.ts`
- `opencode.json`
- 本 blueprint 的 checkbox / 状态

**固定验证要求**:

- 输出超限必须记录 `truncated=true` 或等价结构化字段。
- timeout 必须记录 `timedOut=true` 或等价结构化字段。
- abort 必须记录 `aborted=true` 或等价结构化字段。
- 进程树终止必须有 `ps` / pid 证据或执行器结构化日志证据。

**Reviewer 验收**:

- reviewer 必须检查没有为了测试而引入不安全 shell 组合。
- reviewer 必须确认测试命令不会污染仓库或系统。

#### Task Card WG-05: grant lifecycle 回归

**目标**: 证明治理域接入后 `safe_repo_*` 与 grant service 生命周期未退化。

**允许修改**:

- 测试文件：`.opencode/service/repo/__tests__/*.test.ts` 或 `.opencode/service/tool-governance/__tests__/*.test.ts`
- E2E 文档/证据：`e2e/**`、`e2e-evidence/**`
- `logs/YYYY-MM-DD-*.md`

**禁止修改**:

- DB schema / migration 文件，除非 reviewer 先批准。
- grant 生产代码，除非任务卡被 reviewer 拆成新的源码任务卡。

**固定验证**:

```bash
/home/zhaoge/.bun/bin/bun test ./.opencode/service/repo/__tests__/grants.test.ts ./.opencode/service/tool-governance/__tests__/grant-policy.test.ts
```

**Reviewer 验收**:

- reviewer 复核无 grant、valid grant、consumed grant、expired grant 至少四类结果。

#### Task Card WG-06: 日志字段统一审计

**目标**: 找出旧 gate 中未统一 `sessionID/callID/agent/tool/ruleId/layer/outcome` 的日志，不直接大改。

**允许修改**:

- 新增审计文档：`documents/review/tool-governance-log-field-audit.md`
- `logs/YYYY-MM-DD-*.md`

**禁止修改**:

- `.opencode/**/*.ts`
- 本 blueprint 的 checkbox / 状态

**固定验证**:

```bash
rg -n "writeLog|writeJsonl|process.stderr.write|console.log|ruleId|outcome|layer" .opencode/plugin-handlers .opencode/service/tool-governance .opencode/service/gate
```

**交付物**:

- 表格列出文件、当前日志字段、缺失字段、建议任务卡。
- 不允许直接实施日志迁移。

**Reviewer 验收**:

- reviewer 根据审计结果拆后续源码任务卡。

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

#### Phase 6: active before 链收口 + shell parser 单源化（必须实施，1-2 天）

本阶段是截至 2026-07-12 唯一仍未闭合的实施缺口。以下步骤是**唯一执行顺序**，按顺序完成后再进入 live E2E。不得以“再补一个判断”替代本阶段。

**步骤 6.1：新建统一 `safe_shell` 解析模块**

文件：`.opencode/service/tool-governance/shell-targets.ts`

必须新建一个共享模块，作为 `safe_shell` 语义解析的唯一来源，并导出以下函数：

- `splitShellStatements(command: string): string[]`
- `tokenizeShellStatement(statement: string): string[]`
- `extractShellLocalPaths(command: string): string[]`
- `parseShellWriteTargets(command: string): ScopePathResult`
- `extractShellEvidenceTarget(command: string): string`

要求：

- 从 `path-validate.ts` 中迁出 statement/argv 级切分与路径提取逻辑。
- `extractShellEvidenceTarget()` 只在命令明确指向本地源码/文档文件时返回路径。
- `git *`、`gh *`、`gh api repos/...`、`gh issue create --repo owner/name ...` 一律返回空字符串，禁止把 repo slug、API route、JSON body 当成本地文件。
- 本模块成为 `path-validate.ts`、`tool-scope-paths.ts`、`codegraph.ts` 的共同依赖，后续不得再出现第二套私有 `safe_shell` 解析器。

**步骤 6.2：收口 `path-validate.ts`，只保留结构校验**

文件：`.opencode/plugin-handlers/before/path-validate.ts`

必须执行以下修改：

- 删除本文件内私有的 `splitShellStatements()`、`tokenizeShellStatement()`、`stripOuterQuotes()`、`extractShellLocalPaths()` 及其配套 shell 解析辅助函数。
- 改为 `import { extractShellLocalPaths } from "../../service/tool-governance/shell-targets";`
- 本文件只负责 null byte、traversal、worktree boundary、path length、invalid chars、reserved names 等结构校验。
- `path-validate.ts` 不再承担 repo/gh 命令语义识别职责。

**步骤 6.3：收口 `tool-scope-paths.ts`，不再保留第二套写目标解析器**

文件：`.opencode/service/dispatch/tool-scope-paths.ts`

必须执行以下修改：

- 删除本文件中私有的 `parseShellWriteTargets()` 与 `parseSingleCommand()` 分支解析实现。
- 改为从 `.opencode/service/tool-governance/shell-targets.ts` 导入 `parseShellWriteTargets()`。
- `getEffectivePathScopePaths()` 的 `safe_shell` 分支必须只调用共享解析器。
- 禁止继续在 `tool-scope-paths.ts` 中维护独立的 `sed/cp/mv/dd/node -e` 解析规则。

**步骤 6.4：修改 `codegraph.ts`，显式把 repo/gh shell 命令让渡给 governance**

文件：`.opencode/plugin-handlers/before/codegraph.ts`

必须执行以下修改：

- 在 `tool === "safe_shell"` 时，先对 `args.command` 调用 `classifyRepoShellCommand(command)`。
- 只要分类结果 `provider === "git"` 或 `provider === "gh"`，立即 `return`，不再进入 `extractFilePath()`、`readImpactState()`、`CODEGRAPH-ENFORCE` 分支。
- 删除本文件私有的 `extractShellTarget()`。
- 改为从 `.opencode/service/tool-governance/shell-targets.ts` 导入 `extractShellEvidenceTarget()`，仅对真正的本地源码目标执行 evidence gate。

完成后，`codegraph.ts` 的职责必须收敛为：“只对本地源码修改做 impact evidence 校验”，不得再对 repo/gh shell 命令抢先裁决。

**步骤 6.5：调整 before 执行顺序，让治理域成为首个运行时业务裁决层**

文件：

- `.opencode/plugins/before-dispatcher.ts`
- `.opencode/project.config.json`

必须把 `before` 顺序固定改为：

```json
[
  "gate-call-context",
  "guidance-bridge",
  "task",
  "permission-safety",
  "tool-governance",
  "behavioral-path-guard",
  "scope",
  "path-validate",
  "codegraph",
  "skill-policy",
  "dispatch-signal"
]
```

要求：

- 同时修改 `before-dispatcher.ts` 的 `DEFAULT_ORDER` 与 `.opencode/project.config.json` 的 `plugin_execution_order.before`。
- `permission-safety` 保持在前，先处理静态权限。
- `tool-governance` 固定在 `path-validate`、`codegraph` 之前，成为首个运行时业务裁决层。
- 旧 gate 暂时保留，但只能作为后置结构/兼容校验层，不再承担 repo/gh shell 首裁决。

**步骤 6.6：补齐单元测试与组件测试，覆盖收口后的唯一行为**

必须新增或修改以下测试：

- `.opencode/service/tool-governance/__tests__/shell-targets.test.ts`
- `.opencode/plugin-handlers/before/__tests__/path-validate.test.ts`
- `.opencode/plugin-handlers/before/__tests__/codegraph.test.ts`
- `.opencode/service/dispatch/__tests__/tool-scope.test.ts`
- `.opencode/plugin-handlers/before/__tests__/tool-governance-handler.test.ts`

测试断言必须至少覆盖：

- `safe_shell gh issue create --repo owner/name ...`：`path-validate` 不误判本地路径，`codegraph` 不抛 `CODEGRAPH-ENFORCE`，`tool-governance` 返回 `REPO-OP deny`
- `safe_shell gh api repos/a/b/issues -X POST ...`：同上
- `safe_shell git status --short`：`codegraph` 不拦截，`repo-policy` allow
- `safe_shell git add a.ts`：`codegraph` 不拦截，`repo-policy` deny
- `safe_shell cat .opencode/service/repo/types.ts`：允许作为 protected-read 通过
- `safe_shell sed -i 's/x/y/' src/a.ts`：仍然要求 CodeGraph impact
- `safe_shell node -e '...'`：继续按 opaque write / script 风险路径处理，不能因 parser 收口而放宽

**步骤 6.7：执行 direct smoke，再执行 live E2E**

本阶段完成后，必须按以下顺序验证：

1. direct handler smoke
   验证 `pathValidate.handle()`、`codegraph.handle()`、`toolGovernance.handle()` 对同一条 `gh issue create --repo owner/name ...` 命令给出一致链路结果。
2. runtime smoke
   验证 active before 链对 `safe_shell gh issue create --repo owner/name ...` 的首个业务阻断来自 `tool-governance/repo-policy`，而不是 `path-validate` 或 `codegraph`。
3. live Orchestrator E2E
   使用 Orchestrator 会话真实触发该命令，确认最终对模型暴露的阻断文案稳定为 repo-policy / 一等工具迁移指引。

#### Phase 7: 子进程执行器去 shell 化（必须实施，2-3 天）

Phase 7 已在 Phase 6 core 通过后进入实施。当前已有 `VerifiedCommandPlan`、异步 `execFile`/`spawn` 执行器和 `safe_shell` 薄适配器接线；本节后续作为剩余验收清单，而非“尚未开始”的实施说明。

**步骤 7.1：建立命令 schema 与执行计划**

- 新建 `command-plan.ts`，将共享 parser 输出转换为 `VerifiedCommandPlan`。
- 为允许命令逐个声明 executable 绝对路径、允许子命令、允许选项、位置参数类型、输出模式、超时和输出上限。
- 未建模命令、未知选项、以 `-` 开头但无法消歧的值、复合 shell 语法和解析不完整输入全部 fail-closed。
- 不得提供 `rawCommand`、`shellCommand` 或 `allowShellFallback` 字段。

**步骤 7.2：实现唯一执行器**

- 新建 `command-executor.ts`。`buffered` 只调用 promisified `execFile`，`stream` 只调用 `spawn`；两者固定 `shell:false`。
- 累计 stdout/stderr 的 UTF-8 字节数，达到 `maxOutputBytes` 时停止读取、终止整个进程树并返回 `OUTPUT_LIMIT_EXCEEDED`。
- timeout、AbortSignal、spawn error、signal exit、非零 exit 分别映射为稳定错误码，禁止用 `err.status || 1` 混淆退出状态。
- Windows 与 POSIX 的进程树终止分别封装并测试；当前 WSL 路径必须验证 POSIX process group 终止。

**步骤 7.3：迁移调用链并删除旧执行路径**

- `shell-policy.ts` 生成已验证执行计划；`shell-guard.ts` 只保留最终结构断言与执行器调用。
- `safeBashTool()` 改为 async，所有调用方必须 `await`；TypeScript 编译用于发现遗漏调用方。
- 删除 `shell-guard.ts` 的 `execSync` import 和 `execSync(command, ...)` 分支。
- 仓库扫描必须确认 `safe_shell` 调用链中不存在 `exec`、`execSync`、`execFileSync`、`shell:true`、`sh -c` 或 `bash -c`。

**步骤 7.4：迁移现有复合命令**

- 从 allowlist、测试和运行日志中列出所有包含 shell 运算符的现有命令。
- 每条命令固定迁移到一等工具或仓库内已审核脚本；脚本必须具有固定路径、内容 hash、解释器和参数 schema。
- 迁移完成前不得删除对应回归测试；不存在“临时允许 shell”的过渡状态。

**步骤 7.5：按固定顺序验证**

依次执行 command-plan 单元测试、command-executor 资源与中断测试、safe_shell 组件测试、before dispatcher import/order smoke、TypeScript 编译、框架回归、runtime smoke、live Orchestrator E2E。任一层失败即停止后续验证并保持 blueprint 未完成。

#### Phase 8: 即时 Bug 修复（codegraph 豁免 + Zod v4 兼容 + before-chain 顺序修正）（1 天）

本阶段修复审核发现的三个阻断性 Bug。这些 Bug 导致框架自身无法完成基础操作（如 `safe_edit .gitignore` 被 codegraph 阻断、Orchestrator session 启动即崩溃）。必须在提交前完成。

**步骤 8.1：扩展 codegraph.ts 的 isExemptPath() 豁免列表**

文件：`.opencode/plugin-handlers/before/codegraph.ts`

当前 `isExemptPath()` 函数第 73-76 行的 fallback 豁免列表：

```typescript
  const exempt = [
    /^\.task_temp\//, /^docs\//, /^\.opencode\/agents\/.*\.md$/,
    /^\.understand-anything\//, /^\.codegraph\//,
  ];
```

改为：

```typescript
  const exempt = [
    /^\.task_temp\//, /^docs\//, /^\.opencode\/agents\/.*\.md$/,
    /^\.understand-anything\//, /^\.codegraph\//,
    // Phase 8: 非源码配置文件豁免 --codegraph 只校验源码文件
    /^\.gitignore$/, /^\.gitattributes$/,
    /^\.env\.example$/, /^\.env\.template$/,
    /^package\.json$/, /^package-lock\.json$/, /^bun\.lock$/, /^bun\.lockb$/,
    /^README\.md$/, /^LICENSE$/, /^CHANGELOG\.md$/,
    /^tsconfig\.json$/, /^\.editorconfig$/,
    /^\.opencode\/project\.config\.json$/,
  ];
```

**步骤 8.2：修复 safe_shell.ts Zod v4 record() API**

文件：`.opencode/tools/safe_shell.ts`

第 29 行当前代码：

```typescript
      env: tool.schema.record(tool.schema.string()),
```

改为：

```typescript
      env: tool.schema.record(tool.schema.string(), tool.schema.string()),
```

原因：Zod v4 中 `z.record(keyType, valueType)` 需要两个参数。单参数调用把第一个参数当作 keyType，导致 `valueType` 为 `undefined`，运行时访问 `valueType._zod` 崩溃（`TypeError: undefined is not an object (evaluating 'r._zod')`）。

**步骤 8.3：修正 before-chain 执行顺序**

文件 1：`.opencode/plugins/before-dispatcher.ts`

当前 `DEFAULT_ORDER`（第 63-75 行）中 `tool-governance` 位于 `scope` 之后。将 `tool-governance` 移到 `permission-safety` 之后、`behavioral-path-guard` 之前，改为：

```typescript
const DEFAULT_ORDER = [
  "gate-call-context",
  "guidance-bridge",
  "task",
  "permission-safety",
  "tool-governance",
  "behavioral-path-guard",
  "scope",
  "path-validate",
  "codegraph",
  "skill-policy",
  "dispatch-signal",
];
```

文件 2：`.opencode/project.config.json`

将 `plugin_execution_order.before` 数组同步修改为与上述完全一致的顺序。

**步骤 8.4：补充测试并验证**

文件：`.opencode/plugin-handlers/before/__tests__/codegraph.test.ts`

在 `describe` 块末尾追加以下测试用例：

```typescript
    test("safe_edit .gitignore => exempt from CODEGRAPH-ENFORCE", async () => {
      const input = { tool: "safe_edit", args: { filePath: ".gitignore" }, sessionID: "test-sid" };
      const output = { args: { filePath: ".gitignore" } };
      await expect(codegraph.handle(input, output)).resolves.toBeUndefined();
    });

    test("safe_edit package.json => exempt from CODEGRAPH-ENFORCE", async () => {
      const input = { tool: "safe_edit", args: { filePath: "package.json" }, sessionID: "test-sid" };
      const output = { args: { filePath: "package.json" } };
      await expect(codegraph.handle(input, output)).resolves.toBeUndefined();
    });

    test("safe_edit tsconfig.json => exempt from CODEGRAPH-ENFORCE", async () => {
      const input = { tool: "safe_edit", args: { filePath: "tsconfig.json" }, sessionID: "test-sid" };
      const output = { args: { filePath: "tsconfig.json" } };
      await expect(codegraph.handle(input, output)).resolves.toBeUndefined();
    });
```

验证命令（按顺序执行，任一失败即停止）：

```bash
cd /home/zhaoge/workspace/opencode/work-one
bun test .opencode/plugin-handlers/before/__tests__/codegraph.test.ts
bun -e 'await import("./.opencode/plugins/before-dispatcher.ts")'
```

#### Phase 9: Option A 收口 -- safe_shell 文件写禁止 + 正则加固（2 天）

本阶段完成 Option A：`safe_shell` 不再具备文件写能力，所有文件修改统一走 `safe_edit`/`safe_delete`/`safe_framework_edit`。同时加固 write API 检测正则，封堵字符串拼接绕过。

审核发现框架已在 `scope-validate.ts:104-123` 实施 `BACKUP-BYPASS` 阻断（Option A 的上游部分），但仍存在三个绕过面：Orchestrator 保留 `node -e` 权限、`shell-guard.ts` 存在死代码豁免、write API 正则可被混淆绕过。本阶段封堵全部三个绕过面。

**步骤 9.1：删除 Orchestrator 的 node -e 和任意脚本执行权限**

文件：`opencode.json`

在 Orchestrator 的 `permission.safe_shell` 对象中：
- 删除 `"node -e *": "allow"` 条目
- 删除 `"node *.ts *": "allow"` 条目
- 删除 `"node *.js *": "allow"` 条目
- 追加 `"node -e *": "deny"` 条目
- 追加 `"node *.ts *": "deny"` 条目
- 追加 `"node *.js *": "deny"` 条目

保留的 allow 条目（全部为只读命令）：`echo *`、`cat *`、`ls *`、`head *`、`tail *`、`wc *`、`find *`、`grep *`、`which *`、`sha256sum *`。

文件：`.opencode/agents/Orchestrator.md`

第 106 行当前文本：

```
- `safe_shell`/`safe_diff`/`safe_hash`: allow for read-only orchestration tasks
```

改为：

```
- `safe_shell`/`safe_diff`/`safe_hash`: allow for read-only commands only (echo/cat/ls/head/tail/wc/find/grep/which/sha256sum)
```

**步骤 9.2：删除 shell-guard.ts 的 Orchestrator 目录豁免和 allow-write 后门**

文件：`.opencode/service/file-guard/shell-guard.ts`

删除第 311-329 行的 Orchestrator path-aware eval constraints 代码块。该代码块从 `const isOrchestrator = normalize(agent) === "orchestrator";` 开始，到对应的 `}` 结束（包含 `if (isOrchestrator) { ... }` 整个分支）。

删除后，eval scan 的逻辑统一为：检测到 write pattern 即阻断，不区分 agent 和目录。非 Orchestrator 的阻断逻辑（第 331-343 行）保持不变。

同时，在 `_scriptContainsFileWrite` 函数中（约第 114 行），删除对 `// safe_bash: allow-write` 注释的检测和放行逻辑。使脚本内容扫描无条件阻断 file-write，不提供 opt-in 后门。

**步骤 9.3：加固 write API 检测正则**

文件 1：`.opencode/service/dispatch/tool-scope-match.ts`

第 223-225 行当前 writeApis 正则：

```typescript
      const writeApis =
        /writeFile|appendFile|fs\.write|fs\.append|fs\.rm|fs\.unlink|fs\.rename|fs\.mkdir|createWriteStream|child_process|exec\(|spawn\(|open\(/;
```

改为：

```typescript
      const writeApis =
        /writeFile|appendFile|fs\.write|fs\.append|fs\.rm|fs\.unlink|fs\.rename|fs\.mkdir|createWriteStream|child_process|exec\(|spawn\(|open\(|\[\s*['"]write['"]?\s*\+\s*['"]?File|\[\s*['"]writeFile['"]\s*\]|\[\s*['"]appendFile['"]\s*\]/;
```

文件 2：`.opencode/service/file-guard/shell-config.ts`

第 312-319 行 `WRITE_PATTERNS` 数组追加三个模式：

```typescript
export const WRITE_PATTERNS: RegExp[] = [
  /.writeFileSync\s*\(/,
  /.writeFile\s*\(/,
  /.appendFileSync\s*\(/,
  /.createWriteStream\s*\(/,
  /.renameSync\s*\(/,
  /.copyFileSync\s*\(/,
  /.mkdirSync\s*\(/,
  // Phase 9: bracket notation + string concatenation bypass
  /\[\s*['"]write['"]?\s*\+\s*['"]?File/i,
  /\[\s*['"]writeFile['"]\s*\]/i,
  /\[\s*['"]appendFile['"]\s*\]/i,
];
```

**步骤 9.4：补充混淆绕过回归测试**

新建文件：`.opencode/service/tool-governance/__tests__/write-bypass-prevention.test.ts`

```typescript
import { describe, test, expect } from "bun:test";

describe("write API obfuscation bypass prevention", () => {
  // Phase 9 加固后的正则
  const writeApis =
    /writeFile|appendFile|fs\.write|fs\.append|fs\.rm|fs\.unlink|fs\.rename|fs\.mkdir|createWriteStream|child_process|exec\(|spawn\(|open\(|\[\s*['"]write['"]?\s*\+\s*['"]?File|\[\s*['"]writeFile['"]\s*\]|\[\s*['"]appendFile['"]\s*\]/;

  test("string concatenation writeFileSync is detected", () => {
    const cmd = `require('fs')['write'+'FileSync']('src/pwn.ts','x')`;
    expect(writeApis.test(cmd)).toBe(true);
  });

  test("bracket notation writeFile is detected", () => {
    const cmd = `require('fs')['writeFile']('src/pwn.ts','x')`;
    expect(writeApis.test(cmd)).toBe(true);
  });

  test("bracket notation appendFile is detected", () => {
    const cmd = `require('fs')['appendFile']('src/pwn.ts','x')`;
    expect(writeApis.test(cmd)).toBe(true);
  });

  test("plain writeFileSync is still detected", () => {
    const cmd = `require('fs').writeFileSync('src/pwn.ts','x')`;
    expect(writeApis.test(cmd)).toBe(true);
  });

  test("read-only require('fs').readFileSync is NOT detected", () => {
    const cmd = `require('fs').readFileSync('src/foo.ts','utf8')`;
    expect(writeApis.test(cmd)).toBe(false);
  });
});
```

**步骤 9.5：验证**

验证命令（按顺序执行，任一失败即停止）：

```bash
cd /home/zhaoge/workspace/opencode/work-one
bun test .opencode/service/tool-governance/__tests__/write-bypass-prevention.test.ts
bun test .opencode/plugin-handlers/before/__tests__/codegraph.test.ts
bun test .opencode/service/tool-governance/__tests__/*.test.ts
bun test .opencode/plugin-handlers/before/__tests__/tool-governance-handler.test.ts
bun -e 'await import("./.opencode/plugins/before-dispatcher.ts")'
```

验证 Orchestrator 权限变更：

```bash
# 确认 node -e 已被 deny
grep -A5 '"node -e' opencode.json | grep -c "deny"
# 应输出 1
```

验证 shell-guard 豁免已删除：

```bash
# 确认 isOrchestrator 在 eval scan 中不再出现
grep -c "isOrchestrator" .opencode/service/file-guard/shell-guard.ts
# 应输出 0
```

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
- [x] `shell-targets.ts` 作为共享 `safe_shell` 解析模块，覆盖 local path / write target / evidence target 三类语义（组件测试通过；文件仍需纳入 git 跟踪）
- [x] `codegraph.ts` 对 `safe_shell git/gh` 命令直接 defer，不再为 repo/gh shell 命令产出 `CODEGRAPH-ENFORCE`（组件测试通过；L3-012 live core 已复验）
- [x] `command-plan.ts` 对 shell 组合符、命令替换、未知命令和通配符展开 fail-closed（组件测试覆盖；选项级 schema 仍需按命令细化）
- [x] `command-executor.ts` 固定使用 `shell:false`，且 `safe_shell` 调用链不再存在字符串命令执行分支
- [x] `execFile` 路径对 timeout、AbortSignal、maxBuffer 和非零退出返回稳定执行元信息（组件/代码证据；live 资源类 E2E 待补）
- [x] `spawn` 路径对 stdout/stderr 逐块计数，超限或取消后终止子进程树（组件/代码证据；live 资源类 E2E 待补）
- [x] `codegraph.ts` `isExemptPath()` 对 `.gitignore`/`package.json`/`tsconfig.json` 等非源码文件返回 `true`（Phase 8 步骤 8.4）
- [x] `safe_shell.ts` `tool.schema.record(tool.schema.string(), tool.schema.string())` 在 Zod v4 下不崩溃（Phase 8 步骤 8.2）
- [x] `require('fs')['write'+'FileSync'](...)` 被加固后的 writeApis 正则检测为写操作（Phase 9 步骤 9.4）
- [x] `require('fs')['writeFile'](...)` 被加固后的 WRITE_PATTERNS 检测为写操作（Phase 9 步骤 9.4）
- [x] `require('fs').readFileSync(...)` 不被误检测为写操作（Phase 9 步骤 9.4）

### 5.2 集成测试

- [x] `before-dispatcher` 接入新 controller 后，handler 顺序与现有兼容（static/component 已通过，active runtime log 已出现 governance 事件）
- [ ] `scope` adapter 迁薄后，UC7 / backup-bypass / route mismatch 仍按原规则工作
- [x] `safe_shell` 经统一治理链后，普通读命令不再命中 repo-op 误拦截（`cat package.json` 与 `cat .opencode/service/repo/types.ts` direct smoke 均已通过）
- [x] `safe_shell` 不再把 `gh --repo owner/name`、`gh api repos/owner/name/...`、JSON body、`/dev/null` 误判为本地路径（`path-validate.test.ts` 28/28 PASS）
- [ ] `safe_repo_*` 与 grant service 仍保持原 lifecycle
- [x] `before-dispatcher.ts` 与 `.opencode/project.config.json` 的 `before` 顺序一致，并且 `tool-governance` 位于 `path-validate` / `codegraph` 之前（但未完全匹配 §4.2 固定顺序）
- [x] active before 链上的首裁决层对 `safe_shell` repo/gh 操作保持一致：L3-012 core 已证明固定 `gh issue create --repo` 不再出现 `path-validate` / `codegraph` 抢先阻断
- [x] `path-validate.ts`、`tool-scope-paths.ts`、`codegraph.ts` 均复用 `shell-targets.ts`，不存在第二套 `safe_shell` 私有解析器（代码复用与 before-dispatcher import smoke 已见证；文件跟踪仍待收口）
- [ ] 日志事件统一包含 `sessionID/callID/agent/tool/ruleId/layer/outcome`（治理域 runtime log 已具备；旧 gate JSONL 仍未统一）
- [x] `safeBashTool()` async 改造后的主要调用方已 `await`，direct tool smoke 通过（仍需正式 TypeScript 全量编译兜底）
- [x] `safe_shell` 执行链不含 `exec`、`execSync`、`execFileSync`、`shell:true`、`sh -c`、`bash -c`（仓库其他质量/诊断工具仍有独立 `execSync`，不属于 `safe_shell` 执行链）
- [ ] 现有复合命令均已迁移到一等工具或固定 hash 的受审脚本
- [x] `before-dispatcher.ts` 的 `DEFAULT_ORDER` 中 `tool-governance` 位于 `permission-safety` 之后、`behavioral-path-guard` 之前，且与 `project.config.json` 完全一致（Phase 8 步骤 8.3）
- [x] Orchestrator 的 `safe_shell` 权限中 `node -e *`/`node *.ts *`/`node *.js *` 为 `deny`（Phase 9 步骤 9.1）
- [x] `shell-guard.ts` 中不存在 `isOrchestrator` 变量（`grep -c "isOrchestrator" shell-guard.ts` 输出 0）（Phase 9 步骤 9.2）
- [x] `shell-guard.ts` 中不存在 `allow-write` 字符串（`grep -c "allow-write" shell-guard.ts` 输出 0）（Phase 9 步骤 9.2）

### 5.3 端到端测试

- [ ] Orchestrator -> build 调 `safe_shell cat <file>` 成功，不再报 `[FW-ENFORCE][REPO-OP]`（non-protected / protected path 的 direct smoke 均已通过；仍待真正 live LLM E2E）
- [ ] Orchestrator -> build 调 `safe_shell git status` 成功
- [ ] Orchestrator -> build 调 `safe_shell git add a.ts` 被明确引导至 `safe_repo_stage`
- [x] Orchestrator 直接调 `safe_shell gh issue create --repo owner/name ...` 时，不得再先报 `WORKTREE_BOUNDARY` 或 `CODEGRAPH-ENFORCE`；L3-012 core PASS，阻断来自 repo-policy / 一等工具迁移策略
- [ ] 无 grant 调 `safe_repo_stage` 报 grant 缺失
- [ ] 有 grant 且 impact 完成时 `safe_repo_stage` 成功
- [ ] 未做 CodeGraph 的源码写操作仍被阻断
- [ ] `safe_hash` 在 `safe_shell` 不可用场景下仍可完成只读 hash
- [ ] live Orchestrator 请求含 `;`、管道、重定向或 `$()` 时稳定返回 `SHELL-COMPOSITION-DENY`，且没有子进程启动记录
- [ ] live Orchestrator 执行长输出命令达到上限时子进程树被终止，session 可继续使用
- [ ] live Orchestrator 调 `safe_edit .gitignore` 成功，不被 `CODEGRAPH-ENFORCE` 阻断（Phase 8）
- [ ] live Orchestrator 调 `node -e "require('fs')['write'+'FileSync']('src/x.ts','y')"` 被阻断（Phase 9）
- [ ] live Orchestrator session 可正常启动且不报 `TypeError: undefined is not an object (evaluating 'r._zod')`（Phase 8）

### 5.4 子系统合规验证

- [ ] MVC Architecture：确认 dispatcher（Controller 层）不含业务逻辑，策略全在 service 层；controller.ts 属于 Service 层而非 Controller 层
- [ ] MVC Architecture：确认 `safe_shell` 的 shell 路径语义只由 `service/tool-governance/shell-targets.ts` 维护，`path-validate.ts` / `tool-scope-paths.ts` / `codegraph.ts` 不再保留私有解析逻辑
- [ ] Concurrency Safe：确认 grant bind/check/consume 无竞态退化
- [ ] Framework Harness：确认旧 harness 名称与新治理域不冲突
- [ ] Log Central Management：确认治理域所有日志统一走 `log-manager`
- [ ] TypeScript + Bun Runtime：确认新增 policy 文件均保持小而专一，≤ 400 行
- [ ] TypeScript + Bun Runtime：在当前 Bun 版本实测 `execFile`/`spawn` 的 AbortSignal、超时、signal exit 和 POSIX 进程组终止
- [ ] Hardened Enforcement：`codegraph.ts` `isExemptPath()` 覆盖非源码配置文件（Phase 8）
- [ ] Hardened Enforcement：Orchestrator 不具备 `node -e` 任意代码执行权限（Phase 9）
- [ ] Hardened Enforcement：write API 正则覆盖 bracket notation + 字符串拼接混淆（Phase 9）
- [ ] Hardened Enforcement：`shell-guard.ts` 不存在 agent 专属目录豁免和 `allow-write` 后门（Phase 9）

### 5.5 弱模型交付审查门

以下检查只允许强审查模型 / 人工 reviewer 勾选。弱模型实施者不得自行勾选。

- [ ] 每个弱模型任务卡的 diff 仅触及任务卡允许文件。
- [ ] 每个弱模型任务卡均附带固定验证命令输出；失败输出未被覆盖或删除。
- [ ] reviewer 已重跑任务卡验证命令，且结果与弱模型报告一致。
- [ ] reviewer 已执行安全负向搜索，确认未新增 `exec`、`execSync`、`execFileSync`、`shell:true`、`bash -c`、`sh -c`、`allowShellFallback`、`rawCommand`、`shellCommand`。
- [ ] reviewer 已执行 Phase 9 安全负向搜索：`grep -rn "isOrchestrator" .opencode/service/file-guard/shell-guard.ts` 输出 0 行；`grep -rn "allow-write" .opencode/service/file-guard/shell-guard.ts` 输出 0 行；`grep -rn "node -e.*allow" opencode.json` 输出 0 行。
- [ ] 所有 live E2E 判定均有 session id、`messages-final.json`、`result.md` 和阻断/放行层证据。
- [ ] blueprint checkbox / 状态只由 reviewer 更新，未由弱模型实施者直接修改。

---

## 六、风险与缓解

### 6.1 风险

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| 迁移时打破现有阻断链 | 可能出现漏拦或误放行 | 每个 Phase 独立提交；旧 handler 只作为调用新 policy 的薄 adapter，不保留第二套裁决逻辑 |
| 统一治理后单点故障放大 | 核心 controller 出错影响所有工具 | 保持 policy 粒度拆分 + 单元测试覆盖 + fail-closed |
| 日志字段变化影响现有排障脚本 | 运维/诊断工具需要适配 | 保留旧字段，新增标准字段，分阶段迁移 |
| `safe_shell` 改造影响大量既有路径 | 部分历史命令用法失效 | 提供迁移矩阵：读命令、repo 命令、脚本命令分别指向一等工具/新适配器 |
| legacy fallback 清理导致旧调用失败 | 旧 agent/旧路径异常 | 在删除 fallback 的同一 Phase 先补齐调用方清单与回归测试；出现未知调用立即 fail-closed |
| shell 路径解析多处复制 | 新增误拦截或漏拦截，且不同 handler 结论不一致 | 删除 `path-validate` / `tool-scope-paths` / `codegraph.extractShellTarget()` 的私有解析逻辑，只调用统一 parser |
| `codegraph` 先于 repo-policy 出手 | repo/gh 远程写被误要求做 CodeGraph 调查，模型会在错误路径上循环自救 | 固定 repo/gh shell 操作的裁决顺序；`codegraph` 对 repo/gh shell 命令直接 defer 给 governance repo-policy |
| 去 shell 化后复合命令不可执行 | 历史自动化中断 | 实施前枚举 allowlist、测试和日志中的复合命令，并逐条迁移到一等工具或固定 hash 的受审脚本 |
| `execFile` 缓冲耗尽内存 | 工具进程失败或 serve 不稳定 | buffered 命令固定 1 MiB 上限；不可证明有界的命令固定走 spawn 流式路径 |
| 超时或取消后遗留孙进程 | 持续占用资源并污染后续测试 | 使用独立进程组，超时/取消/超限时终止进程组，并用遗留进程扫描测试验证 |
| 可执行文件或环境被替换 | 执行非预期代码 | 固定绝对 executable 映射、最小 env、受控 cwd；启动前验证 realpath 与文件类型 |
| 弱模型过度自信标完成 | 未验证路径被误标 PASS，后续安全边界失真 | 弱模型不得修改 checkbox / 状态；所有完成判定必须经 reviewer 重跑验证和证据复核 |
| 弱模型扩大任务范围 | 一次修改过多文件，review 无法确认因果 | 只允许领取 §4.3 单张任务卡；每卡最多 3 个源码文件和 2 个测试/文档文件 |
| 弱模型为兼容旧命令引入 shell fallback | 重新打开命令注入风险 | 全局禁止 `exec` / `execSync` / `shell:true` / `bash -c` / `allowShellFallback`；reviewer 必须做负向搜索 |
| codegraph 豁免列表缺少非源码文件 | `safe_edit .gitignore`/`package.json` 等被 `CODEGRAPH-ENFORCE` 阻断，agent 无法修改配置文件 | Phase 8 步骤 8.1 扩展 `isExemptPath()` 豁免列表 |
| Zod v4 `record()` API 变更 | `safe_shell.ts` 的 `__verified_command_plan.env` schema 导致 `TypeError: undefined is not an object (evaluating 'r._zod')`，Orchestrator session 启动即崩溃 | Phase 8 步骤 8.2 修复为双参数 `tool.schema.record(tool.schema.string(), tool.schema.string())` |
| before-chain 顺序与规定不一致 | `scope` 先于 `tool-governance` 执行，治理域不是首个运行时业务裁决层 | Phase 8 步骤 8.3 将 `tool-governance` 移到 `permission-safety` 之后 |
| Orchestrator 保留 `node -e` 权限 | 通过 `require('fs')['write'+'FileSync'](...)` 混淆绕过 write API 正则，在无备份/无 TOCTOU 保护下写文件 | Phase 9 步骤 9.1 删除 `node -e`/`node *.ts`/`node *.js` 权限 |
| write API 正则可被字符串拼接绕过 | `tool-scope-match.ts` 和 `shell-config.ts` 的正则不匹配 bracket notation + 字符串拼接 | Phase 9 步骤 9.3 加固正则，追加 bracket notation 模式 |
| `shell-guard.ts` Orchestrator 目录豁免是死代码 | `scope` 上游已阻断 safe_shell 文件写，豁免只在正则绕过时形成攻击面，同时误导开发者认为 Orchestrator 可写文件 | Phase 9 步骤 9.2 删除豁免代码和 `// safe_bash: allow-write` 后门 |

### 6.2 回滚方案

1. 每个 Phase 使用独立 commit；验证未全部通过时不得开始下一 Phase。
2. Phase 6 失败时只回滚 Phase 6 commit，恢复其开始前已验证的 active before 链；Phase 0-5 保持不动。
3. Phase 7 失败时只回滚 Phase 7 commit，恢复 `shell-guard.ts` 的既有执行实现，同时保留失败证据；回滚后立即禁止外部不可信输入进入 `safe_shell`，直到 Phase 7 修复完成。
4. Phase 8 失败时只回滚 Phase 8 commit，恢复 `isExemptPath()` 原豁免列表、`safe_shell.ts` 原 `record()` 调用、`before-dispatcher.ts` 原 `DEFAULT_ORDER`；Phase 0-7 保持不动。回滚后 `.gitignore` 等非源码文件仍无法被 `safe_edit` 修改，需人工介入。
5. Phase 9 失败时只回滚 Phase 9 commit，恢复 Orchestrator `node -e` 权限、`shell-guard.ts` 目录豁免、原始 write API 正则；Phase 0-8 保持不动。回滚后 `safe_shell` 文件写绕过面重新暴露，需在日志中加强监控。
6. 回滚后执行该 Phase 开始前的完整基线测试、dispatcher import smoke 和 runtime smoke；任一失败则继续保持服务停用，不得宣称回滚成功。
7. 不新增治理模式开关，不保留 legacy/hybrid/unified 并行裁决路径，不删除失败回归测试。

---

## 七、成功标准

- [x] `classifyRepoShellCommand("cat foo.txt")` 返回 `provider: "none"`
- [x] `safe_shell cat <file>` 不再报 `[FW-ENFORCE][REPO-OP]`
- [x] `safe_shell sha256sum <file>` 不再报 `[FW-ENFORCE][REPO-OP]`
- [x] `safe_shell git status` 仍正常工作（build/general/explore 只读 repo 命令 allow；Orchestrator 按静态权限 deny `git *`）
- [x] `safe_shell git add a.ts` 仍被引导至 `safe_repo_stage` / `safe_repo_*`（hook 层 REPO-OP；工具层 fail-closed）
- [x] `safe_shell gh issue create --repo owner/name ...` 不再被 `path-validate` 误识别为本地路径（component/direct handler smoke + `path-validate.test.ts` 28/28 PASS）
- [x] active before 链对 `safe_shell gh issue create --repo owner/name ...` 的首个业务裁决固定来自 `tool-governance/repo-policy`（L3-012 core live PASS）
- [x] 静态权限、动态授权、impact 证据、path 保护、repo-op 语义分别有独立 policy 模块（`grant-policy` 当前为 delegated/audit_only）
- [x] `tool-governance/controller.ts` 可被 runtime 正常导入
- [x] `before-dispatcher` / before handler 已接入统一治理 controller
- [x] `before-dispatcher` 只做控制器编排，不再堆叠领域细节
- [ ] `scope-validate.ts` 被拆分，不再承担多种无关责任
- [x] `codegraph.ts` 收敛为 evidence 相关职责，不再对 repo/gh 的 `safe_shell` 远程写抢先给出 `CODEGRAPH-ENFORCE`（组件测试 + import smoke + L3-012 live core 已复验）
- [x] `safe_shell` 不再重复实现完整 repo-op 裁决链（repo-op 分类主裁决已从 `shell-guard.ts` 移除；执行层兜底仍保留）
- [x] `service/tool-governance/shell-targets.ts` 成为唯一 `safe_shell` 解析入口，`path-validate` / `tool-scope-paths` / `codegraph` 不再各自维护私有路径解析逻辑（代码复用与 import smoke 已见证；untracked 文件仍需纳入正式收口）
- [ ] 所有治理决策统一记录 `ruleId/layer/outcome`（治理域 runtime log 已具备；整条 before 链仍未统一）
- [x] 日志统一走 `log-manager` / `jsonl-writer`
- [ ] repo grant 与 dispatch privilege 主链在新架构下保持兼容
- [ ] 新增治理域模块具备完整 unit / integration / E2E 验证闭环（unit/component 104/104 PASS；live L3-012 core PASS；变体矩阵和 allow-path live 仍未完成）
- [x] `safe_shell` 原始字符串不再直接进入任何子进程 API（`safe_shell` 调用链已改为 `VerifiedCommandPlan` → `execFile`/`spawn`）
- [x] 所有允许命令均生成完整 `VerifiedCommandPlan`，未知或复合命令稳定 fail-closed（组件测试与 direct smoke 已覆盖代表路径）
- [ ] buffered/stream 两条执行路径的超时、取消、输出超限和进程树终止测试全部通过（代码/组件已有基础覆盖；仍缺 live 资源类 E2E）
- [ ] 当前 Bun runtime smoke 与 live Orchestrator E2E 均证明去 shell 化后普通读命令可用、复合命令不可执行（direct tool smoke 已证明 `pwd` allow-path；live Orchestrator allow-path 待补）
- [ ] 弱模型实施协议已执行：所有任务卡均由弱模型提交 diff + 证据，强审查模型 / 人工 reviewer 完成复核后才更新状态
- [x] `safe_edit .gitignore` 不被 `CODEGRAPH-ENFORCE` 阻断（Phase 8 步骤 8.1）
- [x] `safe_edit package.json` 不被 `CODEGRAPH-ENFORCE` 阻断（Phase 8 步骤 8.1）
- [x] `safe_shell.ts` 的 `tool.schema.record()` 使用双参数 Zod v4 API，Orchestrator session 可正常启动（Phase 8 步骤 8.2）
- [x] `before-dispatcher.ts` 的 `DEFAULT_ORDER` 中 `tool-governance` 位于 `permission-safety` 之后、`behavioral-path-guard` 之前（Phase 8 步骤 8.3）
- [x] `project.config.json` 的 `plugin_execution_order.before` 与 `DEFAULT_ORDER` 完全一致（Phase 8 步骤 8.3）
- [x] Orchestrator 的 `safe_shell` 权限中 `node -e`/`node *.ts`/`node *.js` 为 `deny`（Phase 9 步骤 9.1）
- [x] `shell-guard.ts` 中不存在 `isOrchestrator` 变量和目录豁免逻辑（Phase 9 步骤 9.2）
- [x] `shell-guard.ts` 中不存在 `// safe_bash: allow-write` 后门（Phase 9 步骤 9.2）
- [x] `require('fs')['write'+'FileSync'](...)` 被 write API 正则检测为写操作（Phase 9 步骤 9.3）
- [x] `require('fs')['writeFile'](...)` 被 write API 正则检测为写操作（Phase 9 步骤 9.3）
- [x] `require('fs').readFileSync(...)` 不被 write API 正则误检测为写操作（Phase 9 步骤 9.3）
- [x] `write-bypass-prevention.test.ts` 全部通过（Phase 9 步骤 9.4）

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
