# QoderWork — AI Agent 协作工作区指南

本文件是 QoderWork 项目的全局指引，面向所有在此工作区执行任务的 AI Agent。QoderWork 是围绕 OpenCode 框架构建的本地协作工作区，目标项目为 `/home/zhaoge/workspace/opencode/work-one`（work-one）。本指引替代一切历史版本，并随工作区演进而更新。


## 1. 项目概述

### 1.1 QoderWork 是什么

QoderWork 是一个本地 AI Agent 协作工作区，位于 WSL Ubuntu-24.04 的 `/home/zhaoge/workspace/qoderwork/`。它不是独立的可部署应用，而是支撑 Agent 对 work-one 进行架构设计、代码修改、测试验证和文档维护的元项目与工具集合。

主要交付物：

- 结构化文档与蓝图（`blueprints/`、`documents/`、`plans/`、`e2e/`）
- 自动化测试脚本与测试基础设施（`scripts/`、`scripts/test-serve/`）
- 执行证据归档（`e2e-evidence/`、`logs/`）
- 项目级 Skill 定义（`.agents/skills/` 等）
- 变更日志与审计记录（`logs/`、`debt/`）

### 1.2 与 work-one 的关系

| 项目 | 路径 | 作用 |
|------|------|------|
| **QoderWork** | `/home/zhaoge/workspace/qoderwork/` | Agent 协作空间、测试框架、文档与记录 |
| **work-one** | `/home/zhaoge/workspace/opencode/work-one/` | 实际被开发维护的 OpenCode 多 Agent 框架 |

QoderWork 的所有操作最终指向 work-one。修改代码前，应先在 QoderWork 完成规划、验证与日志记录，再到 work-one 落地代码变更。

## 2. 技术栈与关键配置

语言约定：中文为文档与协作主语言；代码标识符、命令、API 名称、路径保留英文原样。以下运行态事实以 work-one 实测为准。

### 2.1 运行时与构建

| 工具 | 版本/位置 | 用途 |
|------|-----------|------|
| Bun | `1.3.14`（`/home/zhaoge/.bun/bin/bun`） | 脚本执行、测试运行、类型检查 |
| TypeScript | `^7.0.2`（devDependency） | 类型检查（`tsc --noEmit`） |
| Node.js 内置模块 | `node:fs`、`node:path`、`node:child_process` 等 | 文件、进程、网络操作 |
| Git | 系统 Git | worktree 隔离、版本控制 |
| CodeGraph CLI | `/home/zhaoge/.local/bin/codegraph` | 影响分析、符号查询（MCP server 双重可用，索引 work-one 源码，见 §9） |
| 测试框架 | `bun:test` | 组件/集成测试 |
| 目标框架 | OpenCode v2 原生 Agent + 自定义 Plugin/Tool/Skill | 被开发维护对象 |
| 目标数据库 | SQLite，schema 当前版本 v37 | 持久化（以 work-one 实测为准） |

### 2.2 关键配置文件

| 文件 | 说明 |
|------|------|
| `package.json` | 工作区统一开发依赖：`bun-types`、`typescript`；根目录唯一 package manifest |
| `tsconfig.json` | 工作区统一 TypeScript 配置；覆盖 `scripts/**/*.ts` 与 `.agents/skills/*/scripts/**/*.ts`，排除客户端镜像与 `.opencode` |
| `bun.lock` | 工作区唯一依赖锁定文件；由根目录 `bun install` 生成 |
| `.gitignore` | 忽略运行时状态、本地依赖、secret、工具本地状态 |
| `.vscode/extensions.json` | 推荐安装 `moonshot-ai.kimi-code` |
| `documents/INDEX.md` | 文档总索引，列出全部专题文档与阅读建议 |
| `MEMORY.md` | 精炼的长期参考知识 |
| `RULES.md` | 会话输出结构与验证标记的强制约束 |
| `.agents/skills/plan-audit-archiver/provenance-rules.md` | P-01~P-07 provenance 规则正本（原 §15 全文，见 §15） |
| `AGENTS.md` | 本文件，全局协作指引 |

### 2.3 TypeScript 配置

`tsconfig.json` 核心设置：

- `target: "ESNext"`
- `module: "ESNext"`，`moduleResolution: "bundler"`
- `strict: true`
- `noEmit: true`（仅类型检查，不输出）
- `allowImportingTsExtensions: true`（允许 `.ts` 扩展名导入）
- 包含 `scripts/**/*.ts` 与 `.agents/skills/*/scripts/**/*.ts`
- 排除 `.qoder/`、`.trae/`、`.workbuddy/` 镜像和 `.opencode/`，避免重复编译独立运行时


## 3. 目录结构与代码组织

```text
qoderwork/
├── .agents/                  # 项目级 Skill（供 Kimi Code / Trae 等使用）
├── .opencode/                # OpenCode 框架运行时依赖与插件（含 node_modules）
├── .qoder/                   # QoderCLI 项目级配置（含 .qoder/skills）
├── .trae/                    # Trae 项目级配置（含 .trae/skills）
├── .workbuddy/               # WorkBuddy 项目级配置
├── .vscode/                  # VS Code 配置
├── blueprints/               # 框架级变更蓝图与实施方案
│   ├── INDEX.md              # 蓝图总索引（活跃/已闭环/已归档 三段看板 + 反向边视图 + 豁免清单）
│   └── archive/              # 已退役蓝图归档层（按写作月 YYYY-MM/ 归档）
├── debt/                     # 技术债务记录
├── documents/                # 专题文档与知识库
├── e2e/                      # E2E 测试规格书
├── e2e-evidence/             # E2E 执行证据（按 L1-L7 分层）
├── handoff/                  # 跨 Agent 任务交接
├── audits/                   # plans 实施进度审计归档（按 plan 名分子目录）
├── issues/                   # Bug 报告与跟踪
├── logs/                     # 每次协作的详细变更日志（强制），含 INDEX.md 与 archive/ 归档
├── plans/                    # 分阶段实施计划
├── scripts/                  # TypeScript 脚本与测试基础设施
│   ├── lib/                  # 通用库（serve-api-client、sse-watcher 等）
│   ├── test-serve/           # 隔离 serve 测试运行单元
│   │   ├── __tests__/        # 组件测试
│   │   ├── isolated-serve.ts # CLI 入口
│   │   ├── run-context.ts    # manifest / 路径 / 状态管理
│   │   ├── process.ts        # 进程生命周期
│   │   └── ...
│   └── *.ts                  # 各类 E2E、诊断、清理脚本
├── team-elevation/           # 团队技术提升资料
├── temporary-audits/         # 临时审计记录
├── AGENTS.md                 # 本文件
├── MEMORY.md                 # 长期记忆
└── RULES.md                  # 输出与验证约束
```

### 3.1 主要模块说明

- **`scripts/test-serve/`**：通过 `test-serve` CLI 管理 `create → start → bootstrap → execute → stop → cleanup` 完整生命周期，保证 runtime/live E2E 不污染主 worktree。
- **`scripts/lib/`**：`serve-api-client.ts` 封装 serve API 身份保留、question 轮询、idle 等待等协议细节；`sse-watcher.ts` 处理 SSE 事件。
- **`documents/`**：框架认知地图、子系统报告、DB 设计、SSE 事件参考、工具权限矩阵等深度文档。
- **`blueprints/`**：完整实施方案，含问题背景、根因、方案对比、实施清单、验证计划与风险。
- **`blueprints/INDEX.md`**：蓝图总索引（活跃/已闭环/已归档 三段看板 + 反向边视图 + 豁免清单），新建蓝图或状态变更后同步。
- **`blueprints/archive/`**：已退役蓝图归档层，按写作月 `archive/YYYY-MM/` 归档；被 `audits/`、活跃 `plans/` 引用的文件不归档（fail-closed，原位标记已退役）。


## 4. 开发约定与输出规范

### 4.0 阻断响应（元规则，优先于本节所有其他规则）

执行任何任务时，遇到阻断（代码报错、环境异常、前置条件不满足、流程步骤无法完成），**禁止自行决定绕过、跳过或"先做后补"**。唯一合法响应：

1. **停下来**：立即停止当前执行流。
2. **报告**：向用户输出阻断事实（什么阻断了、在哪一步、错误信息）。
3. **等待**：等用户给出指示后再继续。

禁止的行为：
- 自行判定"这个阻断不属于当前流程"然后绕过
- 自行判定"修复是必要的"然后未经审批动手
- 以"技术合理性"替代"流程授权"
- 先执行、后补流程步骤

违反本条等同于任务失败，不接受事后补救作为完成。

### 4.1 默认输出结构（强制）

每次任务或回答必须包含以下结构，小任务可压缩 `PLAN / EVIDENCE / RESULT`，但不得省略 `ID / TASK / CHECK / FINAL`：

```markdown
### ID
- [ID] <unique-string>

### TASK
- [REQ] 当前需求
- [SCOPE] 处理范围
- [GOAL] 目标结果
- [MODE] SINGLE / SUBAGENT / MULTI-AGENT

### PLAN
- [S1][TODO/DOING/DONE/BLOCKED] 子任务1
- [S2][TODO/DOING/DONE/BLOCKED] 子任务2

### EVIDENCE
- [E1][VERIFIED/UNVERIFIED] 证据1
- [E2][VERIFIED/UNVERIFIED] 证据2

### RESULT
- [R1] 关键结果1
- [R2] 关键结果2

### CHECK
- [TEST] PASS / FAIL / NOT-RUN / N/A
- [DOC] UPDATED / NOT-NEEDED / PENDING
- [RISK] NONE / OPEN: <summary>

### FINAL
- 最终结论
```

### 4.2 验证标记

任何可能出错的断言必须显式标记：

- `[VERIFIED]`：已通过可复现检验
- `[UNVERIFIED]`：无法低成本验证，必须说明原因
- `[BLOCKED]`：被外部条件阻断
- `[RISK]`：存在已知风险

### 4.3 验证层级

| 层级 | 含义 | 适用场景 |
|------|------|----------|
| `unit` | 单一函数/模块 | 工具函数、类型转换 |
| `component` | 本地组件 | `bun:test` 测试、CLI 命令 |
| `integration` | 多组件/进程 | 双 DB、worktree、serve 启动 |
| `runtime-smoke` | 真实进程运行 | `test-serve` 完整生命周期 |
| `live-LLM-E2E` | 真实 LLM 会话 | Orchestrator/build 端到端 |
| `manual verification` | 人工审查 | 文档、架构、视觉检查 |

低层级成功不得冒充高层级结论。例如，组件 PASS 不能写成 runtime PASS。

### 4.4 任务执行模式

**涉及代码/文件任务时，必须先通过 `task-dispatch-router` skill 评估 MODE（SINGLE / SUBAGENT / MULTI-AGENT），再执行；不评估直接执行视为流程违规。** MODE 定义、角色分工与禁止派遣场景详见 §12。


## 5. 会话启动例行检查

每次新会话开始时，如果当前工作目录是 `/home/zhaoge/workspace/qoderwork/`，按以下顺序执行：

1. **读取 `RULES.md`**：遵守输出结构、验证标记、派遣规则等强制约束。
2. **检查上轮遗漏日志**：
   - 在 work-one 目录执行 `git diff --stat` 和 `git log --oneline -5`。
   - 对比 `logs/` 目录已有日志。
   - 发现未记录的代码修改时，先补写日志再继续当前任务。
3. **读取 `documents/INDEX.md`**：了解可用文档清单与阅读建议。
4. **按需读取专题文档**：根据任务主题读取 `documents/` 下相关文件，不要一次性全部加载。
5. **涉及架构/Plugin/Tool/Session 时**：优先参考 `documents/opencode-framework/` 与 `documents/native-opencode/`。
6. **涉及代码/文件任务时**：加载 `task-dispatch-router` skill，在执行前输出 Dispatch Assessment（MODE + 角色）。


## 6. 构建与测试命令

### 6.1 常用命令

```bash
# 工作区统一类型检查（noEmit，strict 模式）
cd /home/zhaoge/workspace/qoderwork
bun run typecheck

# 运行隔离 serve 测试运行单元（从 qoderwork 根目录运行组件测试，见下方说明）
cd /home/zhaoge/workspace/qoderwork
bun test scripts/test-serve/__tests__

# 或进入脚本目录后单独运行非 cwd 敏感子集
cd /home/zhaoge/workspace/qoderwork/scripts
bun test

# 运行隔离 serve 测试运行单元（完整子命令见 --help）
bun run test-serve/isolated-serve.ts --help
bun run test-serve/isolated-serve.ts create --commit <sha> --port <port> --test-id <id>
bun run test-serve/isolated-serve.ts execute --run-dir <run-dir> --mode plan --runner <script>
bun run test-serve/isolated-serve.ts stop --run-dir <run-dir>
bun run test-serve/isolated-serve.ts cleanup --run-dir <run-dir>

# 清理 OpenCode 残留 session
bun run clean-sessions.ts
```

### 6.2 测试运行说明

- `bun test scripts/test-serve/__tests__` 必须在 qoderwork 根目录下运行，执行 component + integration + 需显式端口的 runtime 混合测试集。runtime 测试必须显式提供 `P0_1B_PORT`，否则被前置拒绝。从 `scripts/` 目录运行同一命令会因 `p01b-orchestrator.test.ts` 相对模块路径不匹配而失败，禁止从该目录运行。
- `tsc --noEmit` 要求 `strict: true`，类型债务必须阻断合并。
- 完整 runtime smoke 和 live LLM E2E 必须通过 `test-serve` 运行单元执行，禁止直接启动裸 `opencode serve` 或固定端口 `4097`。
- 历史测试基线快照见 `logs/` 对应日期日志（如 `logs/2026-07-18-test-baseline.md`），不在本文件记录具体 PASS 数字。


## 7. 代码风格指南

### 7.1 一般原则

- 必须优先保证 `correctness`、`readability`、`maintainability`、`traceability`。
- 注释按需添加，禁止机械逐行注释。
- JSON 文档允许逐字段注释。
- 修改代码后必须同步更新受影响文档，不得无差别重写全部文档。
- 禁止修改无关文件、禁止机会主义重构。
- 新代码必须与周围代码保持风格一致。

### 7.2 注释优先级

1. File-level comment（说明文件职责、版本、修改历史）
2. Class/module-level comment
3. Function/method-level comment
4. 关键非显然逻辑的 inline comment

### 7.3 TypeScript 规范

- 必须使用 `node:` 前缀导入 Node.js 内置模块。
- 必须使用 `ESNext` 模块与 `bundler` 模块解析。
- 文件扩展名：脚本使用 `.ts`；可执行 CLI 使用 `#!/usr/bin/env bun` shebang。
- 类型定义必须优先放在 `types.ts` 中；跨模块共享的类型必须导出供 runner 使用。
- 错误处理必须 `fail-closed`（默认失败），禁止静默 `catch {}`。

### 7.4 命名与文件组织

- 脚本文件名：必须使用有意义的小写短横线命名，如 `clean-sessions.ts`、`live-llm-dispatch-e2e.ts`。
- 测试文件：`*.test.ts`，必须与实现文件放在同一目录的 `__tests__/` 下。
- 常量与配置必须提取到 `types.ts` 或 `run-context.ts` 等集中位置。
- 禁止在 runner 中硬编码端口、路径、SSE 文件位置；必须通过 `readRunManifest` 从 manifest 读取。


## 8. 测试策略

### 8.1 测试分层

| 层级 | 工具 | 职责 |
|------|------|------|
| 组件测试 | `bun:test` | 验证 `test-serve` 各模块行为（create、cleanup、process、SSE、verify） |
| 集成测试 | `test-serve` + 真实 Git worktree | 验证 worktree、双 DB、进程、SSE 的隔离与生命周期 |
| Runtime smoke | `test-serve` 完整生命周期 | 真实 serve 启动、health、bootstrap、plan-only 执行、stop/cleanup |
| Live LLM E2E | `test-serve --mode live` + 真实 LLM | Orchestrator/build 真实会话，验证权限、阻断、grant 生命周期 |
| 静态审计 | `git diff --check`、Bun parse、CodeGraph impact | 代码变更前的影响分析与格式检查 |

### 8.2 测试证据要求

每次测试运行必须保留可追溯证据：

- `run_id` 与 `manifest.json`
- 隔离 worktree 路径与双 DB 路径
- serve/SSE log、events.jsonl
- PID 记录与 cleanup report
- plan-only artifact 或 live E2E 证据包
- 任何失败必须保留现场（`BLOCKED` 状态），不得删除或伪造状态。

### 8.3 禁止事项

- 不得直接运行 `opencode serve` 作为测试启动方式。
- 不得使用固定端口 `4097`、固定 `/tmp/sse-events.jsonl` 或固定主 worktree 路径。
- 不得在未设置 `H2_AUTHORIZED=true` 和 `DRY_RUN=false` 的情况下执行 live LLM E2E。
- 弱模型不得自行设置、转发或伪造 `H2_AUTHORIZED`。
- 不得把组件/集成测试结果写成 runtime smoke 或 live E2E PASS。

### 8.4 共享函数验证覆盖规则

当 scope-lock 的 `impact_analysis.shared_functions` 非空时，plan 的 Fixed verification 命令必须包含 `impact_analysis.caller_tests` 中列出的每一个测试文件。

验证方法：将 Fixed verification 命令中的测试文件列表与 `impact_analysis.caller_tests` 做集合比较。如果 `caller_tests` 中有文件不在验证命令中，验证不通过。

例外：如果 `caller_tests` 中的某个测试文件需要特殊环境（如 `P0_1B_PORT`），在 plan 中标注并说明原因，可豁免该文件。

### 8.5 共享函数测试覆盖策略

**fake 注入标注**：

当测试通过依赖注入（dependency injection）替换真实函数实现时（如 `stopRunProcesses: async () => { return mockManifest; }`），必须在该测试上方添加注释：

```typescript
// FAKE-INJECTION: stopRunProcesses replaced, real setRunState not exercised
```

**真实路径覆盖**：

对于 scope-lock `impact_analysis.shared_functions` 中的每个共享函数，至少 1 个测试必须调用该函数的真实实现（不通过 fake/mock 替换）。如果现有测试全部使用 fake 注入，实施者必须新增至少 1 个非-fake 测试。

**审计检查**：

审计者在 Step 5（Complete the full in-scope sweep）中，对每个共享函数执行以下检查：
1. `rg -n "FAKE-INJECTION" <caller_test_file>` 列出所有 fake 注入点。
2. 确认至少 1 个测试不包含 `FAKE-INJECTION` 注释且调用了该共享函数的真实路径。
3. 如果全部测试都是 fake 注入，标记为 BLOCKING finding。


## 9. CodeGraph 使用规则

### 9.1 强制规则

**分析或修改 work-one 代码或 qoderwork `scripts/` 下的共享函数前，必须先用 CodeGraph CLI 查询影响范围。**

"共享函数"定义：被 2 个以上文件调用的函数。判断方法：`codegraph callers <函数名>` 返回的 `file` 级别调用方 ≥ 2 个文件时，该函数为共享函数。

查询结果必须记录到 plan 的 scope-lock `impact_analysis` 字段中。如果 CodeGraph 未索引目标文件，用 `rg -n "函数名" scripts/` 作为替代。

常用命令：

| 用途 | 命令 |
|------|------|
| 搜索符号 | `codegraph query "<symbol>"` |
| 影响分析 | `codegraph impact "<symbol>"` |
| 调用者 | `codegraph callers "<symbol>"` |
| 被调用者 | `codegraph callees "<symbol>"` |
| 索引状态/同步 | `codegraph status` / `codegraph sync` |

其余命令（`explore`/`node`/`files` 等）见 `codegraph --help`。

### 9.2 索引机制

CodeGraph 的 `serve --mcp` 内置 file watcher，代码文件变更后自动增量重索引。daemon 300 秒空闲退出，重启时 catch up 积压变更。如 `codegraph status` 显示 Pending Changes，运行 `codegraph sync`。


## 10. 安全与隔离考虑

### 10.1 授权闸门

- `H2_AUTHORIZED`：人类 reviewer 在测试 runner 环境显式提供的 live E2E 授权闸门，弱模型不得自行设置或伪造。
- `DRY_RUN`：默认 `true`；只有 reviewer 授权后才允许 `DRY_RUN=false` 的真实变更。
- `FRAMEWORK_SKILL_READ_HARD_GATE=1`：serve 进程环境开关，控制 skill-read 硬 gate。

### 10.2 隔离要求

- 测试运行必须使用 `test-serve` 创建的隔离 worktree，不得直接修改主 worktree。
- 测试使用隔离 framework DB（`FRAMEWORK_DB_PATH`）和隔离 SDK DB（`OPENCODE_DB`）。
- 每个 run 拥有唯一 `run_id`、唯一端口、独立 PID、独立日志与事件目录。
- 清理（cleanup）遵循 `fail-closed`：无法确认退出或 worktree 移除失败时，状态为 `BLOCKED` 并保留现场。

### 10.3 失败处理

- 优先 `fail-closed`：不确定时拒绝、保留状态、不继续下一步。
- 禁止静默 `catch {}`，所有错误必须记录并传播到相应状态字段。
- 不得删除未确认退出的进程或误杀其他运行单元。


## 11. 文档与日志规范

### 11.1 变更日志（强制）

每次完成涉及代码/配置/脚本/API/架构的变更后，必须在 `logs/` 创建对应日志文件：

- 命名：`YYYY-MM-DD-<简短主题>.md`
- 内容控制在 20 行以内，记录：为什么、改了什么、决策、更新了什么文档。
- 更新了什么文档：用列表展示本次任务更新/新建/删除的所有文档。
- 不记流水账：git diff 能看到的内容不重复写。

#### 文本产物写入完整性闸门（强制）

适用于新建或覆盖 `logs/`、`plans/`、`documents/`、`blueprints/`、`audits/`、`.agents/skills/` 下的非空文本文件：

1. 同一任务内的文本写入必须串行执行；前一个目标文件通过完整性验证前，不得发起下一个文本写入。
2. 每次写入后必须立即执行并记录：`test -s <path>`、`wc -l <path>`，以及至少一个内容断言（`head -n 1 <path>` 或 `rg -n '<required heading>' <path>`）。
3. 工具回执“成功”不构成完成证据；全部校验通过后，才可报告 `DOC: UPDATED` 或任务完成。
4. 任一校验失败时必须 fail-closed：停止后续文本写入，标记 `[BLOCKED]`，以串行方式恢复目标文件并重新验证。
5. 禁止将空文件、仅文件名存在、或未通过内容断言的文件列为已完成交付。

### 11.2 文档索引

新增或修改文档后，必须同步更新 `documents/INDEX.md`，确保索引、摘要、行数与阅读建议准确。

### 11.3 Memory 管理

- `MEMORY.md`：只放精炼的长期参考知识，写结论不写过程。
- 发现新环境事实、用户纠正、完成重要任务后提炼结论时写入。
- 不写临时状态、显而易见信息或可直接从代码读取的内容。
- 使用前缀标签：`work-one 规则:`、`work-one 架构:`、`work-one 约定:`。

### 11.4 日志索引与归档

`logs/` 文件数量增长后，使用 logs-governance skill 维护索引与归档：

- **`logs/INDEX.md`**：日志总索引，分"当前活跃日志（近 14 天）"、"按主题聚类"、"历史归档"三段。session 启动或新增日志后同步。
- **`logs/archive/YYYY-MM/`**：按月归档旧日志（默认超 30 天且无引用）。归档遵循 fail-closed：被 `documents/INDEX.md`、`plans/`、`audits/` 引用的日志不归档；引用检查不确定时不归档。
- **`audits/<plan-name>/`**：plans 实施进度审计归档，每次审计生成 `<YYYY-MM-DD>-audit.md` 并更新 `LATEST.md` 指针。

### 11.5 蓝图索引与归档

- **`blueprints/INDEX.md`**：蓝图总索引，分"活跃 / 已闭环 / 已归档"三段 + 派生区段"反向边视图"与"豁免清单"。新建蓝图或状态/边变更后同步；有下游 plan/audit 的蓝图状态以 `audits/<plan>/LATEST.md` 为唯一真相源，INDEX 与头部均为投影。
- **`blueprints/archive/YYYY-MM/`**：按写作月归档已退役蓝图。移动/修改禁令（fail-closed）：被 `audits/` 冻结记录或活跃 `plans/` 以路径/SHA 引用的文件永不归档、不回写头部，元数据仅登记 INDEX 豁免清单；每次退役须有 `logs/` 决策记录。


## 12. 子 Agent 派遣政策

### 12.0 角色分工原则（优先于本节所有规则）

| 角色 | 职责 | 边界 |
|------|------|------|
| **主 Agent**（当前会话） | 推理、评估、规划、审核、决策 | 不写代码、不修 bug、不跑测试——这些是子 Agent 的工作 |
| **子 Agent** | 机械执行：实现、测试、git 操作、文档更新、格式化 | 只执行已规划的明确指令，不自行决策；多文件协调时可自行处理文件间依赖，但不得改变 plan 方向 |

主 Agent 每次面对实施任务时的标准流程：
1. 用 task-dispatch-router 评估 MODE
2. 分解为可独立验收的机械子任务
3. 按 MODE 派遣子 Agent
4. 收集交付物并审核

### 12.1 可用角色

- `Fullstack Engineer`：实现
- `Testing Expert`：验证与证据
- `Audit Expert`：独立审查与风险检查

### 12.2 派遣要求

派遣子 Agent 时必须显式定义：

- subtask goal
- scope boundary
- expected deliverable
- required evidence
- completion condition

### 12.3 禁止派遣场景

- 任务很小且需要判断（机械执行类小任务可委托子 agent）
- 强顺序依赖任务
- 高频共享同一批文件
- 需要单一路径连续实现
- 需要统一最终裁决的单一结论


## 13. 验证原则（强制）

下结论前必须问：**“这条断言如果是错的，我能用什么最低成本发现它错？”**

- 答得出 → 跑该检验，再下结论。
- 答不出 → 标注 `UNVERIFIED`，不得当事实陈述。
- 成本太高或会污染真实环境 → 先标注 `UNVERIFIED`，再申请授权。

### 13.1 常见断言的最便宜检验

| 断言类型 | 最便宜手段 |
|----------|-----------|
| git/shell 行为 | 在 `/tmp` 建临时 repo 最小复现 |
| 代码改动能跑通 | `bun test` / `tsc --noEmit` / 调一次函数 |
| 现有代码断言 | `Read` 工具 / `codegraph query` |
| 库/API 行为 | `bun -e` / `node -e` 最小片段 |
| 架构调用链 | `codegraph callers/callees` |
| 配置断言 | `Read` 工具直接读文件 |
| 任务已完成 | 重跑测试 / 检查产物 |
| 预测不影响 Y | `codegraph impact` + 实查 Y |


## 14. 常用资源速查

| 资源 | 路径/命令 |
|------|-----------|
| 全局指引 | `AGENTS.md`（本文件） |
| 输出约束 | `RULES.md` |
| 长期记忆 | `MEMORY.md` |
| 文档索引 | `documents/INDEX.md` |
| 脚本入口 | `scripts/` |
| 隔离测试 CLI | `bun run scripts/test-serve/isolated-serve.ts` |
| 清理残留 session | `bun run scripts/clean-sessions.ts` |
| work-one 目标目录 | `/home/zhaoge/workspace/opencode/work-one/` |
| Bun 路径 | `/home/zhaoge/.bun/bin/bun` |
| CodeGraph CLI | `/home/zhaoge/.local/bin/codegraph` |


## 15. 审计与实施 provenance 流程约定

### 15.1 Legacy provenance 与新工作 outcome governance

- `boundary-contract/v1`（已被 v3 取代：`audit-boundary-matrix/v3`）及本节其余 legacy 要求，只适用于明确声明 legacy `provenance_level: v3-required` 的 plan，或已有 legacy audit trail（scope-lock、audit report、receipt 或 `LATEST.md`）的 plan。
- `audit-boundary-precheck.ts` 只可输出 `READY_FOR_LLM_REVIEW` 或 `BLOCKED`，不得输出 `ACCEPT`、推导需求满足，或以测试绿灯代替边界裁决。
- 脚本负责契约/范围哈希、fixture、oracle、观察值、禁止副作用和 case 覆盖的机械校验；`MODEL_REVIEW` 只判断批准边界表达、实际边界等价和例外越界。
- 任何矩阵 `BLOCKED`、矩阵哈希漂移或 `validate-audit.ts` 非零均不可由模型解释或豁免；`ACCEPT` 还必须有完整 `MODEL_REVIEW`。

新工作默认使用 `.agents/skills/outcome-governance/SKILL.md`：冻结 outcome、boundary 与 fixed acceptance；以 amendment 处理变更；以独立执行的测试验证接受条件。实现机制不由 outcome governance 或 P-01..P-07 规定。其 structural validation 是 `review-separated`，不证明运行态 admission、真实命令执行或不可篡改性。

P-01~P-07 规则全文已迁移至 `.agents/skills/plan-audit-archiver/provenance-rules.md`（唯一正本），仅约束上述 legacy plan，历史 audit、scope-lock、receipt 和报告不得为迁移而改写。

**强制触发**：仅实施或审计适用 legacy plan 的 phase 前，必须先 Read 上述文件；未读即开始视为流程违规（legacy 审计判定 `INVALID`）。新工作读取 outcome-governance skill，不被要求采用 legacy `provenance_level`、boundary contract 或 `validate-audit.ts`。

规则索引（每条规则均为四要素结构：约束主体 + 触发条件 + 违反判定 + 违反后果）。**2026-07-28 更新**：原 `v2.1-required` 已升级为 `v3-required`，`boundary-contract/v1` 已迁移至 `audit-boundary-matrix/v3`：

| 规则 | 主题 | 约束主体 |
|------|------|----------|
| P-01 | `provenance_level` 声明（`v3-required` / `component-only`） | plan 索引文件 |
| P-02 | Pre-Implementation Freeze Gate（scope-lock → human approval → pre-change receipt） | 实施者 |
| P-02A | 依赖 phase progression admission（`validate-phase-progression.ts` exit 0 前置） | 实施者 / 审批前检查者 |
| P-03 | 审计工具链强制（EV-NNN receipt + `validate-audit.ts` exit 0） | 审计者 |
| P-04 | BLOCKED 继承（`CLOSED` / `INHERITED` / `REOPENED`） | 审计者 |
| P-05 | 降级声明（4 项缺一不可） | 审计者 |
| P-06 | component-only 证据标注，禁止 `v3` schema 被误标为 `ACCEPT` | 审计者 |
| P-07 | `--repository-root` 干净锚点（work-one），禁止指向审计工作区 | 计划作者 + 实施者 |

---

**最后更新**：2026-07-28（v3 升级：boundary-contract/v1 → audit-boundary-matrix/v3；v2.1-required → v3-required）
**维护者**：QoderWork Agent 协作链
**变更方式**：本文件被完整覆盖时，旧版本内容不再生效；所有更新必须基于当前工作区实际状态。
