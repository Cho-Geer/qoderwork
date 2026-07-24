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

### 1.3 实际运行态（以 work-one 实测为准）

- **运行语言**：中文为文档与协作主语言；代码标识符、命令、API 名称、路径保留英文原样。
- **运行时**：Bun 1.3.14（`/home/zhaoge/.bun/bin/bun`）。
- **代码语言**：TypeScript，模块为 `ESNext`，`moduleResolution` 为 `bundler`。
- **测试框架**：`bun:test`。
- **目标框架**：OpenCode v2 原生 Agent + 自定义 Plugin/Tool/Skill。
- **目标数据库**：SQLite，schema 当前版本 v37（以 work-one 实测为准）。
- **CodeGraph 索引**：`codegraph` CLI 与 MCP server 双重可用，索引 work-one 源码。


## 2. 技术栈与关键配置

### 2.1 运行时与构建

| 工具 | 版本/位置 | 用途 |
|------|-----------|------|
| Bun | `1.3.14`（`/home/zhaoge/.bun/bin/bun`） | 脚本执行、测试运行、类型检查 |
| TypeScript | `^7.0.2`（devDependency） | 类型检查（`tsc --noEmit`） |
| Node.js 内置模块 | `node:fs`、`node:path`、`node:child_process` 等 | 文件、进程、网络操作 |
| Git | 系统 Git | worktree 隔离、版本控制 |
| CodeGraph CLI | `/home/zhaoge/.local/bin/codegraph` | 影响分析、符号查询 |

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

- **`scripts/test-serve/`**：隔离测试运行单元。通过 `test-serve` CLI 管理 `create → start → bootstrap → execute → stop → cleanup` 完整生命周期，保证 runtime/live E2E 不污染主 worktree。
- **`scripts/lib/`**：通用客户端库。`serve-api-client.ts` 封装 serve API 身份保留、question 轮询、idle 等待等协议细节；`sse-watcher.ts` 处理 SSE 事件。
- **`documents/`**：框架认知地图、子系统报告、DB 设计、SSE 事件参考、工具权限矩阵等深度文档。
- **`e2e/`**：E2E 测试规格书，按 ID 命名并记录前置条件、步骤、预期与证据边界。
- **`logs/`**：变更日志，每次代码修改后必须新增 `YYYY-MM-DD-<主题>.md`。`logs/INDEX.md` 由 logs-governance skill 维护，旧日志按月归档到 `logs/archive/YYYY-MM/`。
- **`audits/`**：plans 实施进度审计归档，按 plan 名分子目录（`audits/<plan-name>/<YYYY-MM-DD>-audit.md` + `LATEST.md`），由 plan-audit-archiver skill 维护。与 `temporary-audits/`（一次性临时调查）区分。
- **`blueprints/`**：框架级变更的完整实施方案，包含问题背景、根因、方案对比、实施清单、验证计划与风险。


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

- 默认 `[MODE] SINGLE`。
- 仅当任务有清晰边界、专业能力需求或可独立验收交付物时，使用 `[MODE] SUBAGENT`。
- 仅当多个子任务低耦合、可独立验收、并行能显著提升速度/质量时，使用 `[MODE] MULTI-AGENT`。
- 禁止对极小任务、强顺序依赖任务、高频共享文件任务派遣子 Agent。


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

# 运行隔离 serve 测试运行单元
bun run test-serve/isolated-serve.ts --help
bun run test-serve/isolated-serve.ts create --commit <sha> --port <port> --test-id <id>
bun run test-serve/isolated-serve.ts start --run-dir <run-dir>
bun run test-serve/isolated-serve.ts bootstrap --run-dir <run-dir> --child-agent <agent> --allowed-paths <abs-paths>
bun run test-serve/isolated-serve.ts execute --run-dir <run-dir> --mode plan --runner <script>
bun run test-serve/isolated-serve.ts verify --run-dir <run-dir> --phase runtime
bun run test-serve/isolated-serve.ts p0-1b --primary-worktree <dir> --commit <sha> --port <port> --test-id <id>
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
| 区域探索 | `codegraph explore "<query>"` |
| 符号详情 | `codegraph node "<name>"` |
| 文件结构 | `codegraph files` |
| 索引状态 | `codegraph status` |
| 增量同步 | `codegraph sync` |

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


## 12. 子 Agent 派遣政策

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

- 任务很小
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

本节规则适用于 QoderWork 工作区内所有 plan 的所有 phase 实施与审计，无例外。规则采用四要素结构：约束主体 + 触发条件 + 违反判定 + 违反后果。强约束关键词遵循 RFC 2119 语义：必须（MUST）、禁止（MUST NOT）、当且仅当（IF AND ONLY IF）、不得（MUST NOT）。

### 规则 P-01：Provenance 级别声明（前置条件）

- **约束主体**：每个 plan 的索引文件（`00-plan-index.md` 或等价文件）
- **触发条件**：plan 创建时
- **规则**：plan 索引必须声明 `provenance_level`，取值限定为 `v2.1-required` 或 `component-only`，二者必居其一。未声明的 plan，实施禁止开始。
- **违反判定**：plan 索引中无 `provenance_level` 字段，或取值不在 `{v2.1-required, component-only}` 集合内
- **违反后果**：实施者必须暂停，补声明后方可继续

### 规则 P-02：Pre-Implementation Freeze Gate（实施前冻结）

- **约束主体**：实施者（任何开始 phase 实施的 agent）
- **触发条件**：`provenance_level = v2.1-required` 的 plan 的任何 phase，在实施代码写入之前
- **规则**：实施者必须按以下顺序完成 Freeze Gate，且禁止跳步：
  1. 审计者填写 `scope-lock.json`（覆盖本 phase 的 REQ/Check Registry/oracle）
  2. Human reviewer 批准 `scope-lock.json`（agent 不得自批准）
  3. 运行 `capture-state.ts` 捕获 pre-change receipt，输出到 `audits/<plan-name>/evidence/pre-change-<PHASE-N>.json`；`--repository-root` 必须按 P-07 取干净锚点仓库（work-one），禁止填审计工作区或当前 worktree
  4. 验证 receipt 存在且非空（`test -s` + 内容断言）
- **违反判定**：实施已开始但 `evidence/pre-change-<PHASE-N>.json` 不存在或为空
- **违反后果**：审计必须判定为 `INVALID`（不是 BLOCKED），因为实施流程违规导致审计合同无效

### 规则 P-02A：依赖 phase progression admission

- **约束主体**：实施者与 Freeze Gate 审批前检查者
- **触发条件**：`provenance_level = v2.1-required` 的 plan 准备为下一个 phase 填写或提交 `scope-lock.json` 进行 human approval
- **规则**：必须先运行 `validate-phase-progression.ts <plan-dir> <next-phase-id>`。validator 必须确认所有直接与传递依赖 phase 的签署 `ACCEPT` audit、phase ID、可读 progression receipt 与其哈希、completion checkbox、phase `Progression status`、manifest `Status`、顶层派生 `Status` 以及 next phase 的 `Starting state and dependency` 一致。exit 0 是提交 human approval 的前置条件。
- **违反判定**：任一状态缺失/非法/重复、receipt 缺失或哈希不匹配、audit 非 `ACCEPT`、completion gate 与状态不一致、依赖未 `ACCEPTED` 或顶层状态无法由 manifest 派生
- **违反后果**：Freeze Gate 判为 `INVALID`，禁止进入 human approval；不得使用 `--force`、手工 `ACCEPTED` 或只更新 manifest 的旁路。`pre-flight-enforcement` 只能约束本次步骤顺序，不替代该 admission validator 或写入跨 phase 状态。

### 规则 P-03：工具链强制（审计执行）

- **约束主体**：审计者（使用 plan-audit-archiver skill 的 agent）
- **触发条件**：`provenance_level = v2.1-required` 的 plan 的审计执行
- **规则**：
  1. 每个 `[VERIFICATION]` 步骤必须调用 `capture-state.ts` 生成 immutable receipt（EV-NNN），receipt 必须绑定 `audit_id`/`requirement_id`/`polarity`/`oracle_id`/`fixture_id`/`command`/`exit_code`/`observed_result`/`artifact_hashes`
  2. `Verified-by:` 文字证据行仅作为 receipt 的人类可读摘要，禁止替代 receipt
  3. 审计报告签署前必须运行 `validate-audit.ts`，`exit 0` 是签署 `ACCEPT` 或 `REWORK` 的必要条件
- **违反判定**：审计报告声明 v2.1 ACCEPT 但无对应 EV-NNN receipt；或 `validate-audit.ts` 未运行；或 `validate-audit.ts` exit 非 0
- **违反后果**：审计报告不可签署；已签署的判定为 `INVALID`

### 规则 P-04：BLOCKED 继承（审计连续性）

- **约束主体**：审计者
- **触发条件**：前序审计报告中存在 `BLOCKED` 项
- **规则**：后续审计必须对每个前序 `BLOCKED` 项显式处理，处理方式限定为三种之一：
  - `CLOSED`：已解决，附 receipt 证据
  - `INHERITED`：继承，附继承理由与计划解决时机
  - `REOPENED`：重新打开，附新证据
- **违反判定**：后续审计报告中未出现对前序 `BLOCKED` 项的显式处理记录
- **违反后果**：审计报告判定为 `INVALID`（静默绕过 = 审计合同无效）

### 规则 P-05：降级声明（标准一致性）

- **约束主体**：审计者
- **触发条件**：审计者选择的证据标准低于 plan 声明的 `provenance_level`（如 plan 声明 `v2.1-required` 但审计者用 component 级证据签署）
- **规则**：审计者必须在审计报告 §1 开头显式声明降级，声明内容必须包含以下 4 项，缺一不可：
  1. 降级理由（具体、可验证）
  2. 降级后的证据上限
  3. 降级不影响的结论范围
  4. 降级影响的结论范围（如有）
- **违反判定**：审计报告用低于 plan 声明标准的证据签署 ACCEPT，但 §1 无降级声明，或降级声明缺少上述 4 项中的任一项
- **违反后果**：审计报告判定为 `INVALID`

### 规则 P-06：component-only plan 的证据标注

- **约束主体**：审计者
- **触发条件**：`provenance_level = component-only` 的 plan 的审计
- **规则**：审计报告必须在 §1 显式标注「证据上限：component」，且禁止签署 v2.1 正式 ACCEPT
- **违反判定**：component-only plan 的审计报告签署 v2.1 ACCEPT，或未标注证据上限
- **违反后果**：审计报告判定为 `INVALID`

### 规则 P-07：repository_root 干净锚点（worktree 感知）

- **约束主体**：计划作者 + 实施者
- **触发条件**：任何 plan 的 Fixed verification 命令含 `capture-state.ts --repository-root` 或 `generate-evidence-receipt.ts --repository-root`
- **规则**：`--repository-root` 必须（MUST）指向干净锚点仓库（默认 work-one：`/home/zhaoge/workspace/opencode/work-one`）；禁止（MUST NOT）指向审计工作区（qoderwork 主仓 `/home/zhaoge/workspace/qoderwork` 或其任何 `.worktrees/*` worktree）。原因：validator（`validate-audit.ts` L1190-1197）将 pre-change receipt 的 `status_entries` 与审计时 `repository_root` 的实时 git status 做对称差，差集中不在 `repository_scope.allowed_paths` 内的路径触发 `DIRTY_PATH_OUTSIDE_SCOPE`；validator 对 `audits/`、`logs/`、`evidence/` 等审计基建路径无豁免。若 `repository_root` 指向审计工作区，审计基建文件（报告、EV receipts、verdict-state、LATEST.md、日志）全部落入差集，审计不可行。实施范围由 scope-lock 的 `repository_scope.allowed_paths` / `forbidden_paths` 控制，与 `repository_root` 职责不同。在 qoderwork worktree（如 `.worktrees/check-plan`）中实施 qoderwork 工具代码时，`workspace_root` 是该 worktree 路径，`repository_root` 仍是 work-one。
- **违反判定**：plan 的 Fixed verification 中 `--repository-root` 指向 qoderwork 主仓或其 worktree
- **违反后果**：pre-change receipt 无法通过 `validate-audit.ts`，审计判定为 `INVALID`

---

**最后更新**：2026-07-23
**维护者**：QoderWork Agent 协作链
**变更方式**：本文件被完整覆盖时，旧版本内容不再生效；所有更新必须基于当前工作区实际状态。
