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

### 1.3 实际运行态（2026-07-17 校准）

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
| `scripts/package.json` | 测试脚本包依赖：`bun-types`、`typescript`；`private: true` |
| `scripts/tsconfig.json` | TypeScript 配置：`strict: true`、`noEmit: true`、`allowImportingTsExtensions: true` |
| `.gitignore` | 忽略运行时状态、本地依赖、secret、工具本地状态 |
| `.vscode/extensions.json` | 推荐安装 `moonshot-ai.kimi-code` |
| `documents/INDEX.md` | 文档总索引，列出全部专题文档与阅读建议 |
| `MEMORY.md` | 精炼的长期参考知识 |
| `RULES.md` | 会话输出结构与验证标记的强制约束 |
| `AGENTS.md` | 本文件，全局协作指引 |

### 2.3 TypeScript 配置

`scripts/tsconfig.json` 核心设置：

- `target: "ESNext"`
- `module: "ESNext"`，`moduleResolution: "bundler"`
- `strict: true`
- `noEmit: true`（仅类型检查，不输出）
- `allowImportingTsExtensions: true`（允许 `.ts` 扩展名导入）
- 包含 `.`、`lib/**/*.ts`、`test-serve/**/*.ts`


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
├── issues/                   # Bug 报告与跟踪
├── logs/                     # 每次协作的详细变更日志（强制）
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
├── RULES.md                  # 输出与验证约束
└── serve-api-before-chain-verification.md
└── tool-governance-before-chain-verification.md
```

### 3.1 主要模块说明

- **`scripts/test-serve/`**：隔离测试运行单元。通过 `test-serve` CLI 管理 `create → start → bootstrap → execute → stop → cleanup` 完整生命周期，保证 runtime/live E2E 不污染主 worktree。
- **`scripts/lib/`**：通用客户端库。`serve-api-client.ts` 封装 serve API 身份保留、question 轮询、idle 等待等协议细节；`sse-watcher.ts` 处理 SSE 事件。
- **`documents/`**：框架认知地图、子系统报告、DB 设计、SSE 事件参考、工具权限矩阵等深度文档。
- **`e2e/`**：E2E 测试规格书，按 ID 命名并记录前置条件、步骤、预期与证据边界。
- **`logs/`**：变更日志，每次代码修改后必须新增 `YYYY-MM-DD-<主题>.md`。
- **`blueprints/`**：框架级变更的完整实施方案，包含问题背景、根因、方案对比、实施清单、验证计划与风险。


## 4. 开发约定与输出规范

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
# 进入脚本目录
cd /home/zhaoge/workspace/qoderwork/scripts

# 类型检查（noEmit，strict 模式）
bunx tsc --noEmit

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
bun run test-serve/isolated-serve.ts stop --run-dir <run-dir>
bun run test-serve/isolated-serve.ts cleanup --run-dir <run-dir>

# 清理 OpenCode 残留 session
bun run clean-sessions.ts
```

### 6.2 测试运行说明

- `bun test scripts/test-serve/__tests__` 在 qoderwork 根目录下运行，会执行 `scripts/test-serve/__tests__/*.test.ts` 组件测试。2026-07-17 实测：93 个测试中 92 个 PASS，1 个（`p01b-runtime.test.ts`）因未设置 `P0_1B_PORT` 环境变量而快速失败，该失败属于预期配置缺失而非代码回归。从 `scripts/` 目录运行同一命令会因 `p01b-orchestrator.test.ts` 中相对模块路径不匹配而出现额外失败。
- `tsc --noEmit` 要求 `strict: true`，类型债务会阻断合并。
- 完整 runtime smoke 和 live LLM E2E 必须通过 `test-serve` 运行单元执行，禁止直接启动裸 `opencode serve` 或固定端口 `4097`。


## 7. 代码风格指南

### 7.1 一般原则

- 优先保证 `correctness`、`readability`、`maintainability`、`traceability`。
- 注释按需添加，禁止机械逐行注释。
- JSON 文档可以逐字段注释。
- 修改代码后同步更新受影响文档，不得无差别重写全部文档。
- 不要修改无关文件、不要进行机会主义重构。
- 新代码应与周围代码保持风格一致。

### 7.2 注释优先级

1. File-level comment（说明文件职责、版本、修改历史）
2. Class/module-level comment
3. Function/method-level comment
4. 关键非显然逻辑的 inline comment

### 7.3 TypeScript 规范

- 使用 `node:` 前缀导入 Node.js 内置模块。
- 优先使用 `ESNext` 模块与 `bundler` 模块解析。
- 文件扩展名：脚本使用 `.ts`；可执行 CLI 使用 `#!/usr/bin/env bun` shebang。
- 类型定义优先放在 `types.ts` 中；跨模块共享的类型导出供 runner 使用。
- 错误处理优先 `fail-closed`（默认失败），禁止静默 `catch {}`。

### 7.4 命名与文件组织

- 脚本文件名：有意义的小写短横线命名，如 `clean-sessions.ts`、`live-llm-dispatch-e2e.ts`。
- 测试文件：`*.test.ts`，与实现文件放在同一目录的 `__tests__/` 下。
- 常量与配置提取到 `types.ts` 或 `run-context.ts` 等集中位置。
- 避免在 runner 中硬编码端口、路径、SSE 文件位置；应通过 `readRunManifest` 从 manifest 读取。


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


## 9. CodeGraph 使用规则

### 9.1 强制规则

**分析或修改 work-one 代码前，必须先用 CodeGraph CLI 查询影响范围。**

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
- 内容控制在 20 行以内，记录：为什么、改了什么、决策。
- 不记流水账：git diff 能看到的内容不重复写。

### 11.2 文档索引

新增或修改文档后，应同步更新 `documents/INDEX.md`，确保索引、摘要、行数与阅读建议准确。

### 11.3 Memory 管理

- `MEMORY.md`：只放精炼的长期参考知识，写结论不写过程。
- 发现新环境事实、用户纠正、完成重要任务后提炼结论时写入。
- 不写临时状态、显而易见信息或可直接从代码读取的内容。
- 使用前缀标签：`work-one 规则:`、`work-one 架构:`、`work-one 约定:`。


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

---

**最后更新**：2026-07-17
**维护者**：QoderWork Agent 协作链
**变更方式**：本文件被完整覆盖时，旧版本内容不再生效；所有更新必须基于当前工作区实际状态。
