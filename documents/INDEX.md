# Documents 索引

> 本文件由 QoderWork Session Startup 自动扫描。新增文档时请同步更新此索引。
>
> **最近更新**: 2026-07-23 - Task Lens M1 蓝图完成 v0.1.5 设计返工：冻结输入/差异/可序列化图模型/DA coverage/反馈写回/安全与 provenance 合同；方向可行，下一步必须先创建 v2.1-required 实施计划并通过 Freeze Gate。
>
> **历史更新**: 2026-07-22 - 隔离 Serve 蓝图与当前代码交叉审核：TSI-02 patch-apply 失败 component 回归已验证；TSI-01 仍缺状态迁移/重复 run ID 拒绝；T-PT-051/052 runner 仍含执行 stub。已创建 P0-3 六阶段实施计划并通过结构校验；reviewer live 证据与旧 launcher 删除仍未执行。
>
> **历史更新**: 2026-07-21 — 新增 diagrams/ 下 3 份复用基础设施文档（函数清单 + 分层调用拓扑 + 全局调用拓扑），覆盖 lib/test-serve/通用 CLI/sse-daemon 全部函数与调用链，并修正"lib 仅被排除脚本消费、in-scope 不形成单一三层链"的结构事实。
>
> **历史更新**: 2026-07-18 — 交叉审核 P0-1 当前代码、实施计划与证据包：非 runtime 回归 92/92 PASS；P0-1B 已由 2026-07-17 CLI-only smoke 与 2026-07-18 runtime-test 两个全新 run 证明，后者为 1/1 PASS。同步补入 3 份漏索引文档。P0-2、TSI-05 run-mode 与 live LLM E2E 仍未执行。
>
> **历史更新**: 2026-07-17 — P0-1B 首次通过 CLI-only runtime smoke，run `2026-07-17T15-39-11-311Z-p0-1b-runtime-smoke-5e5ffb6d`，完整保留 manifest/双 DB/SSE/log/artifact/cleanup evidence。
>
> **历史更新**: 2026-07-15 — 隔离 Serve 测试基建 P0 修复复审：新增 Blueprint 与 `test-serve` CLI，当时端口竞争、cleanup 失败处理与 runner 迁移仍为 P0。
>
> **历史更新**: 2026-07-13 — 收敛 Node.js 子进程安全执行规范：固定 execFile/spawn 路由、参数注入、资源上限、进程终止与 fail-closed 契约。
>
> **历史更新**: 2026-07-12 — 新增框架废弃内容审计 blueprint，并修正 native-opencode integration 的 Scout 漂移。
>
> **历史更新**: 2026-07-09 — 新增 tool-permission-interception-authorization-layer-map.md + session-id-acquisition-matrix.md

| 文件 | 主题 | 摘要 | 行数 |
|------|------|------|------|
| **opencode-framework/opencode-cognitive-map.md** | **框架认知地图（全景架构）** | **四层架构总览（元认知→编排执行→验证→运维）、39 Plugin / 70+ Tool / 51 Lib / 12 MCP Server 全景、Agent 角色定义、数据流图、故障排查手册。是理解整体设计的第一入口。** | **~694** |
| **blueprints/2026-07-12-framework-deprecated-content-audit-blueprint.md** | **框架废弃内容审计与清理蓝图** | **严格审计 work-one 中过时/废弃/兼容尾巴：AGENTS 启动文档漂移、Scout 残留、legacy role 与 permission fallback、旧 DAG/pre-execution 脚本、handler 状态混乱、enforcement mode 兼容 shim、dispatch_context stub，并给出分阶段清理计划。** | **~403** |
| **blueprints/blueprint-isolated-serve-test-infrastructure.md** | **隔离 Serve 测试基建与测试专用 Skill** | **定义测试运行单元的 worktree、显式脏改动 overlay、framework/SDK 双 DB、SSE、进程生命周期、grant bootstrap、H2 授权、scripts 收口与证据契约；P0-3 六阶段计划负责状态机、真实 runner、reviewer live 证据与旧 launcher 收口。** | **~380** |
| **blueprints/blueprint-task-lens-m1.md** | **Task Lens M1 确定性任务透镜蓝图** | **定义项目外只读输入、working-tree/commit 差异语义、TaskGraphV1/SpineForest、DA coverage、反馈闭环、安全边界、12 子系统审计与 v2.1-required Freeze Gate；v0.1.5 已完成设计返工，尚未实施。** | **~487** |
| **handoff/task-lens-resume.md** | **Task Lens 跨 session 续接纪要** | **固化 M1 已决策项、现状证据、v0.1.5 已关闭缺口、M2/M3 未验证边界与下一步固定顺序，防止后续 session 将路线图能力误写成已实现。** | **~104** |
| opencode-framework/opencode-db-canonical-design.md | DB-only & DB-Canonical 设计 | DB-only 和 DB-canonical 设计理念、50 个数据表全景架构（54 CREATE - 4 DROP）、9 大类数据模型详解、实体关系图、表关系与业务关联、DB-canonical 设计证据、数据库迁移机制（v1-v37）、关键代码索引。 | ~802 |
| opencode-framework/opencode-cli-acp-integration.md | CLI 命令 & ACP 协议集成 | OpenCode CLI 全命令参考（run/serve/web/acp）、ACP 协议 stdio JSON-RPC 2.0 交互流程、session 生命周期管理、QoderWork↔OpenCode 双向通道设计。面向 ACP 桥接开发调试。 | ~270 |
| opencode-framework/opencode-enforcement-exemption-matrix.md | Enforcement & 豁免机制完整矩阵 | advisory/strict/locked 三模式完整矩阵：37 个工具 Before/After Hook 链、豁免机制（Agent/路径/工具类别）、阻断/警告行为、Agent 权限级别、Guidance Gate 两阶段协议。面向 enforcement 调试和权限排查。 | ~659 |
| native-opencode/native-opencode-sse-events.md | SSE 事件完整参考 | OpenCode SSE 事件全景：59 个事件跨 10 大类（Session V1/Next/Status/Server/Workspace/MCP/LSP/VCS/Worktree/Legacy），3 个 SSE 端点。面向 ACP 桥接和事件驱动开发。 | ~347 |
| opencode-framework/opencode-subsystems-report.md | 11 子系统深度分析报告 | 从源码级深度分析 11 个核心子系统：MVC 架构、DB-canonical 设计、Permission Matrix、并发安全、Hardened Enforcement、Framework Harness、Multi-Agent、Log Central、DB 管理、Templatization、TS+Bun Runtime。 | ~873 |
| opencode-framework/opencode-tool-reference.md | Tool 详细参考（70+ 工具） | 三大类工具完整清单：11 个内置工具、37 个自定义工具（safe_* 系列 + Git/Repo 安全包装 + Read Attestation）、25+ MCP 工具。每个工具的权限配置、拦截 Hook、框架用途。 | ~629 |
| opencode-framework/tool-permission-interception-authorization-layer-map.md | 工具权限 / 拦截 / 授权责任分层图 | 梳理当前运行态的多层工具治理链：静态权限、before/after hook、动态授权、工具自防护、日志审计的责任边界，并点出重复判断、职责混乱、误拦截热点。面向框架治理重构与权限链排查。 | ~514 |
| **opencode-framework/工具调用失败链与返回方式.md** | **工具调用失败链与返回格式（完整版）** | **三层阻断链路、返回格式标准体系（MCP/Custom/Built-in）、37 个自定义工具返回格式详解、25+ MCP 工具返回格式、detectFailure/detectSoftRejection 逻辑、4 种计数器与阈值、7 种失败类型矩阵。** | **~838** |
| opencode-framework/session-concepts-complete.md | Session 概念完整体系 | 五种 ID 辨析（Session/Gate/DAG/Agent/Namespace）、Session 生命周期、session_map 三层存储、状态机、与 SDK session 表的关系。面向 Session 相关 Bug 排查和架构理解。 | ~356 |
| opencode-framework/session-id-acquisition-matrix.md | OpenCode Session ID 获取对照表 | 汇总主 Agent、ACP、`opencode run`、`/new`、`--continue`、`dispatch_subagent` 等路径的 session 创建/复用行为，明确哪些场景能直接拿 `input.sessionID/context.sessionID`，哪些不能依赖 `OPENCODE_SESSION_ID`。 | ~154 |
| native-opencode/native-opencode-skill.md | Skill 全链路机制 | Skill 发现/加载/调用全链路：6 大搜索路径、发现优先级覆盖规则、权限过滤、会话级按需加载、主 Agent 与子 Agent 共享与隔离机制。面向 Skill 开发和调试。 | ~337 |
| native-opencode/native-opencode-skill-hook.md | Plugin Hook 与 Skill 配合机制 | Skill 为内置工具、Hook 为全局中间件：配置/调用/权限/会话/消息五大配合维度，全链路拦截点详解。面向 Plugin 开发者。 | ~230 |
| native-opencode/native-opencode-agent-communication.md | Agent 双向通信机制 | 官方确认原生不支持双向通信，父子 Agent 单向委派模式，通过 Plugin Hook 扩展双向协作能力。面向多 Agent 协作设计。 | ~82 |
| native-opencode/native-opencode-integration-recommendation.md | 集成建议与三层架构 | 历史集成建议文档（基于 pre-v2 假设）：原生 Agent + Skill + Hook 三层落地架构。⚠️ 当前 OpenCode v2 **无内置 Scout**；只读调查请使用原生 `explore`，应以 build/general/plan/explore 与本次废弃内容审计为准。 | ~132 |
| native-opencode/native-opencode-worktree.md | Worktree 活用机制 | Git Worktree 天然兼容、CWD 边界会话隔离、多 Agent 并行开发与分支隔离。面向多任务并行研发流程。 | ~168 |
| review/opencode-framework-architecture-assessment.md | 框架架构深度评估 | 七维度评估（轻量/复用/高效/稳定/可靠/维护/健壮）、代码实测 vs 文档声明对比（2026-07-10 校准：37 工具/50 表/v37/39 handler）、308 .ts / 65,151 行验证数据。 | ~249 |
| review/skill-audit-report.md | Skill 诊断与优化报告 | 历史 22 个 user skill 审计 + 2026-07-17 项目级 23 skill 健康检查；当前入口均 ≤600 行，报告固定存放于此。 | ~173 |
| qoderwork-watcher-contract.md | QoderWork Watcher JSONL 契约 | 定义 audit/quality/skill/guidance JSONL 事件流、R1–R7 检测规则与介入通道。面向 watcher 实现与运维。 | ~63 |
| review/serve-api-before-chain-verification.md | Serve API before 链真实验证 | 记录 explore agent 经真实 serve 触发 `safe_shell gh issue create` 并首先被 tool-governance 拒绝的 runtime 证据。 | ~92 |
| review/tool-governance-before-chain-verification.md | Tool-governance before 链顺序验证 | 记录 esbuild 加载真实 dispatcher 的 handler 顺序、短路证据与测试层级局限。 | ~74 |
| review/exec-execFile-spawn.md | 子进程 API 安全路由 | 固定 execFile/spawn 路由、禁用 shell 与资源边界。面向安全执行层实施。 | ~52 |
| review/execFile-usage.md | execFile 安全规范 | 规定 file/argv/cwd/env 校验、拒绝条件与错误处理。面向 safe_shell 实施。 | ~53 |
| diagrams/functions-reference.md | 复用基础设施函数清单 | scripts 可复用核心基础设施（lib/test-serve/通用 CLI/sse-daemon）逐函数清单：名称、描述、参数、返回值，含类型叶子说明与关键结构修正。面向源码阅读与调用链分析。 | ~257 |
| diagrams/callgraph-layered.md | 分层调用链拓扑图 | 按子系统/层级分组的 Mermaid 拓扑：入口/编排/生命周期/基础三层 + lib + 独立叶子；实线直接、虚线间接。面向架构理解与链路追踪。 | ~211 |
| diagrams/callgraph-global.md | 单一全局调用链拓扑图 | 全部可复用函数置于一张 Mermaid 图，连通所有调用链（直接/间接），附跨组关键链路摘要。面向全局依赖审计。 | ~273 |

## 按场景推荐阅读

- **初次了解框架** → opencode-framework/opencode-cognitive-map.md → opencode-framework/opencode-subsystems-report.md
- **清理过时/废弃框架内容** → blueprints/2026-07-12-framework-deprecated-content-audit-blueprint.md
- **执行隔离 serve 的 runtime/live/mutation 测试** → blueprints/blueprint-isolated-serve-test-infrastructure.md
- **理解或实施 Task Lens M1** → blueprints/blueprint-task-lens-m1.md → handoff/task-lens-resume.md
- **理解 DB-only & DB-Canonical 设计** → opencode-framework/opencode-db-canonical-design.md
- **理解数据模型与表关系** → opencode-framework/opencode-db-canonical-design.md（§3-4）
- **调试 ACP 桥接** → opencode-framework/opencode-cli-acp-integration.md
- **排查 Session/Dispatch 问题** → opencode-framework/session-concepts-complete.md
- **确认某条链路能否拿到 OpenCode session id** → opencode-framework/session-id-acquisition-matrix.md
- **查某个 Tool 的权限和 Hook** → opencode-framework/opencode-tool-reference.md
- **梳理工具权限 / 拦截 / 授权分层** → opencode-framework/tool-permission-interception-authorization-layer-map.md
- **排查工具调用失败** → opencode-framework/工具调用失败链与返回方式.md
- **理解 Enforcement & 豁免机制** → opencode-framework/opencode-enforcement-exemption-matrix.md
- **了解 Vanilla OpenCode 平台机制** → opencode-framework/opencode-cognitive-map.md（§2）
- **查 SSE 事件类型** → native-opencode/native-opencode-sse-events.md
- **深度理解 11 子系统** → opencode-framework/opencode-subsystems-report.md
- **了解 Agent 双向通信** → native-opencode/native-opencode-agent-communication.md
- **理解 Skill 全链路机制** → native-opencode/native-opencode-skill.md
- **理解 Hook 与 Skill 配合** → native-opencode/native-opencode-skill-hook.md
- **多 Agent 并行开发隔离** → native-opencode/native-opencode-worktree.md
- **框架集成规划** → native-opencode/native-opencode-integration-recommendation.md
- **框架架构评估与审查** → review/opencode-framework-architecture-assessment.md
- **核对 tool-governance 在真实 before 链的拒绝顺序** → review/serve-api-before-chain-verification.md
- **查 QoderWork Watcher 事件与 R1–R7 规则** → qoderwork-watcher-contract.md
- **Skill 体系健康检查** → review/skill-audit-report.md
- **Node.js 子进程安全选型** → review/exec-execFile-spawn.md → review/execFile-usage.md
- **梳理 scripts 复用基础设施函数与调用链** → diagrams/functions-reference.md → diagrams/callgraph-global.md
- **理解 test-serve 隔离测试运行单元架构** → diagrams/callgraph-layered.md
