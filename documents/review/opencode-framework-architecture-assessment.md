# OpenCode 框架架构深度评估报告

> **日期**: 2026-07-04（2026-07-10 数据校准）
> **评估范围**: work-one 项目 `.opencode/` 框架代码（308 .ts 文件，65,151 行）
> **对比基准**: OpenCode 原生架构（5 内置 Agent + Skill + Plugin Hook）
> **数据来源**: 13 篇框架文档 + 代码实测验证
>
> **2026-07-10 校准注记**: 自本报告初版以来，代码已演进——自定义工具 22→37、Schema v32→v37、DB 表 41→50（54 CREATE - 4 DROP）、Plugin handler 29→39。下方"代码实测"列已同步更新；分析结论（七维度评估）基于初版数据，数量增长进一步加剧了维护性/轻量性方面的担忧。

---

## 一、评估方法与实测数据

### 1.1 评估维度

轻量性、复用性、高效性、稳定性、可靠性、维护性、健壮性，共七个维度。

### 1.2 代码实测验证数据

| 指标 | 文档声明 | 代码实测 | 差异 |
|------|---------|---------|------|
| .ts 文件总数 | "469+ 文件，~200 自定义" | **308 .ts / 65,151 行** | 文档偏高（含非 .ts） |
| before/after 插件 | "13+13" 或 "14+14" | **20+19** | 代码已增长（新增 anti-bypass、question-policy、guidance-bridge 等） |
| 自定义工具 | 22 个 | **37 个** | 代码已增长（新增 Git/Repo 安全包装 12 + 框架维护 2 + safe_framework_edit 1） |
| MCP Server | "11-12 个" | **6 个活跃** | 文档偏高（含已弃用） |
| DB 表数量 | "41 表 (v32)" | **54 个 CREATE TABLE，50 表（v37）** | 差异来自 4 个 DROP TABLE + 9 个新增表 |
| Agent 配置 | 10 个 | **10 个** | 一致 |
| dispatch_subagent.ts | "~870 行，最复杂工具" | **49 行** | 已重构为 thin shell |
| db-state-manager.ts | "~1,470 行" | **1,947 行** | 文档偏低 32% |
| tool-tracker.ts | "~875 行" | **892 行** | 基本一致 |
| Task.DAG.json | — | **存在，156 KB** | — |

### 1.3 关键发现：dispatch_subagent.ts 仅 49 行

文档称"~870 行，最复杂的工具"，实测仅 49 行。说明已发生 thin shell 重构：业务逻辑抽取到 `service/dispatch/` 层，工具本身退化为薄控制器。这印证了框架的 MVC 分层设计已落地，但也暴露了文档与代码的脱节。

---

## 二、多智能体模式分析

### 2.1 规模对比

| 维度 | OpenCode 原生 | work-one 框架 | 倍数 |
|------|-------------|--------------|------|
| Agent 数量 | 4（Plan/Build/General/Explore，原 Scout 在 v2 已废弃） | 10（Orchestrator/Super-Admin/Meta-Planner/Architect/Coder-BE/Coder-FE/Guardian/Arbiter/CI-CD-Agent/Knowledge-Curator） | 2.5x |
| 分发路由 | 无（用户手动选择或 LLM 自主判断） | L0-L4 五层路由链 + PLAN-FIRST 三层强制 | — |
| Session ID 类型 | 1 种（`ses_*`） | 5 种（OpenCode Session / Gate Session / DAG Task ID / Agent 身份 / Session Namespace） | 5x |
| Session 追踪表 | 0（上游 SDK 管理） | 4 张表（session_map / session_log / dispatch_queue / dispatch_failed_log） | — |
| Agent 间通信 | 无原生支持 | ACP + request_review + deliver_guidance + acp_notify | — |

### 2.2 七维度评估

**轻量性 — 不合格。** 10 个自定义 Agent 各有独立的 .md 配置文件，Orchestrator 作为唯一 primary Agent 承担全部分发职责。每层子 Agent 派发创建新 session，通过 5 种 ID 交叉关联。session_map 表需要 COALESCE 保护的 agent 身份绑定、dag_task_id 关联、domain_id 映射、parent_id 层级——这是在 SQLite 里重建了一个分布式追踪系统。原生 OpenCode 用零张表实现了同样的"父派发子、子返回结果"语义。

**复用性 — 不合格。** 10 个 Agent 的角色边界是硬编码的：Coder-BE 不能改前端代码，Coder-FE 不能改后端代码，Guardian 不能改任何代码。这些约束通过 `agent_tool_scopes` 配置和 scope-before 插件的 12 步验证链强制执行。但原生 OpenCode 的 General 子代理可以通过 Skill 注入不同领域的知识，一个 Agent 覆盖多场景。框架的做法是"用 Agent 数量替代 Skill 灵活性"，与原生范式背道而驰。

**高效性 — 不合格。** 一次 `safe_edit` 调用要经过 10 个 before-hook + 工具执行 + 10 个 after-hook。dispatch_subagent 调用要经过 L0-L4 路由验证 + DAG 存在性验证 + 安全门控 + ctx 文件写入 + session_map DB 写入。每个工具调用都有 DB 读写开销（tool_enforcement 表的 recordAttempt + recordResult）。原生 OpenCode 的工具调用是直接的函数执行，零中间层。

**稳定性 — 存疑。** 框架的 session_map 有三条写入路径（chatMessageHook / dispatch_subagent / module_scope_declare），agent 身份解析有 4 层优先级（session_map DB → gate_sessions → dispatch:child:* 合成键 → ctx/*.json → FRAMEWORK_AGENT env）。多层解析意味着多层故障点。MEMORY.md 记录了大量身份断链问题：explore 特例无 .md config 导致死锁、COALESCE 锁死 unknown agent、cleanOrphan 误删零写入 session。这些都不是理论问题，是实测确认的运行时 bug。

**可靠性 — 存疑。** 框架依赖 SQLite WAL 模式作为唯一状态源，但 bun:sqlite 在 WSL 环境下有已知的缓存不可靠问题（MEMORY.md: "Bun 缓存不可靠→改代码后 rm -rf ~/.bun/install/cache"）。50 张表、37 次迁移、1,947 行 db-state-manager.ts——任何一次迁移失败都可能导致状态不一致。dbRegenerateGateFiles() 虽然提供了 DB→JSON 重建能力，但这个函数本身是 120 行的复杂逻辑，它自身的可靠性谁来保证？

**维护性 — 不合格。** 65,151 行 TypeScript 代码，308 个文件，39 个插件 handler，37 个自定义工具，50 张 DB 表。修改白名单须同步更三处（exemptions.ts + project.config.json + checklist-validate.ts）。Bun 不热加载，改代码后须重启 serve。文档与代码已脱节（dispatch_subagent.ts 从 870 行变为 49 行但文档未更新）。这种维护成本对单人或小团队来说不可持续。

**健壮性 — 矛盾。** 框架投入了大量精力构建防御性机制：TOCTOU 保护、原子备份、乐观锁、CAS、租约机制、orphan 检测。这些机制本身是好的。但 9 层 enforcement 链的层间交互产生了大量死锁场景：STOP directive 与 Phase-0 enforcement 冲突（MEMORY.md 实测确认）、codegraph_enforce 追踪不存在的 codegraph_impact 命令导致 safe_shell 永远无法通过、initial_read 阶段阻断 question 工具导致 STOP directive 死锁。健壮性的努力反而制造了不健壮的交互模式。

### 2.3 核心问题

多智能体模式的根本问题是**用 Agent 数量替代 Skill 灵活性**。原生 OpenCode 的设计哲学是"5 个标准化执行器 + N 个可插拔 Skill = 无限场景覆盖"。框架反其道而行，10 个固定角色 Agent + 空 skills 列表（MEMORY.md: "agent configs 的 skills:[] 均空，19 个 SKILL.md 未注入任何 agent"），将本应由 Skill 承载的领域知识硬编码进 Agent .md 配置和插件规则中。

---

## 三、DB-Canonical + 硬约束体系分析

### 3.1 规模对比

| 维度 | OpenCode 原生 | work-one 框架 |
|------|-------------|--------------|
| 状态管理 | 文件系统 + 内存 | SQLite WAL，50 张表，37 次迁移 |
| 工具安全 | permission 矩阵（allow/deny/ask） | 9 层 enforcement 链 + 20 before-hook + 4 计数器 |
| 失败处理 | 工具返回 error，LLM 自主重试 | Guidance Gate（token 锁）+ 累积计数器 + STOP 指令注入 |
| 审计 | 无原生审计 | 4 层审计追踪 + write_audit + audit_log + audit_trail |
| 执行模式 | 无 | advisory / strict / locked 三模式 |

### 3.2 七维度评估

**轻量性 — 严重不合格。** 50 张 DB 表管理一个代码 Agent 框架的状态。对比：OpenCode 上游 SDK 自身用 2 张表（session + message）管理全部会话数据。框架在 SDK 之上叠加了 48 张额外表。db-state-manager.ts 单文件 1,947 行，tool-tracker.ts 892 行。substate_kv 表用 JSON blob 存储子状态，每次读写都序列化/反序列化整个 blob——这是反模式，用关系数据库模拟文件系统。

**复用性 — 不合格。** 50 张表的模式与 work-one 项目深度耦合。gate_sessions 表有 30+ 列，包含 deliverables、approval、enforcement 等业务语义。这些表结构无法直接迁移到其他项目。原生 OpenCode 的状态管理是零配置的——SDK 自动管理 session，项目无需维护任何 DB。

**高效性 — 不合格。** 每次工具调用触发：before-hook 读 tool_enforcement 表 → 工具执行 → after-hook 写 tool_enforcement 表 + audit_log + write_audit_state。一次 safe_edit 调用至少 4 次 DB 读写。dispatch_subagent 调用涉及 session_map 写入 + dispatch_queue 入队 + ctx 文件写入。原生 OpenCode 的工具调用是纯函数执行，零 IO 开销。

**稳定性 — 存疑。** 37 次迁移意味着 schema 经历了 37 次变更。每次变更都使用 `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE` + 守卫逻辑。但 MEMORY.md 记录了多个迁移相关问题：dispatch_payload 继承三层全断、session_map COALESCE 不可变导致子 agent 身份被覆写、cleanOrphanSessionMaps 反馈循环。DB 作为唯一真相源的前提是 DB 本身不出错——但 SQLite 在 bun:sqlite 下的 WAL 模式在 WSL 环境中并不完全可靠。

**可靠性 — 存疑。** DB-canonical 的核心承诺是"JSON 文件可从 DB 重建"。但 dbRegenerateGateFiles() 自身是 120 行复杂逻辑，它的正确性谁来验证？framework-self-test.ts 有 33+ 检查项，framework-doctor.ts 有 13 项健康检查——这本身说明框架对自己的可靠性没有信心。原生 OpenCode 不需要 self-test 或 doctor，因为它的状态管理足够简单，不会出错。

**维护性 — 严重不合格。** 37 次迁移意味着每次框架升级都要处理 schema 变更。修改白名单须同步三处。Bun 不热加载须重启 serve。MEMORY.md 记录了大量 DB 相关 bug：SQLite 膨胀、session_map 对齐问题、death loop、O(n²) load-save 反馈循环。这些问题消耗的调试时间远超 DB 带来的便利。

**健壮性 — 矛盾。** 4 计数器系统（consecutive_failures / total_failures / compliance_blocks / soft_rejections）的设计意图是防止 Agent 绕过约束。但实测发现：consecutive_failures 不在工具成功后重置（有意设计），导致 Agent 一旦失败就只能等 clear_guidance 或 TTL 过期；Guidance Gate 的 token 锁机制要求 QoderWork 介入，但如果 QoderWork 不可用，Agent 就永久死锁。STOP directive 注入后 LLM 尝试调 question 工具但被 Phase-0 阻断——框架的两层约束互相矛盾，制造了不可恢复的死锁。

### 3.3 核心问题

DB-canonical + 硬约束体系的根本问题是**在代码 Agent 框架上叠加企业级合规基础设施**。50 张 DB 表、9 层 enforcement、4 计数器、token 锁——这些机制的设计目标是"防止 Agent 绕过约束"，但实测表明最大的约束来源不是 Agent 的"绕过意图"，而是框架自身的层间冲突。Agent 不需要绕过约束，因为约束自己就会死锁。

原生 OpenCode 用 permission 矩阵（allow/deny/ask）实现了等效的安全控制，零 DB 表、零 enforcement 链、零计数器。框架用 50 张表和 9 层 enforcement 追求的是"不可绕过的硬约束"，但实际效果是"不可恢复的死锁"。

---

## 四、DAG 任务体系分析

### 4.1 规模对比

| 维度 | OpenCode 原生 | work-one 框架 |
|------|-------------|--------------|
| 任务规划 | LLM 自主拆解，task 工具直接派发 | Task.DAG.json（156 KB）+ Meta-Planner 专门规划 |
| 分发控制 | 无（LLM 决定派发哪个子 Agent） | PLAN-FIRST 三层强制 + L0-L4 路由链 |
| 任务追踪 | 无（fire-and-forget） | dispatch_queue + 租约 + session_log + dispatch_failed_log |
| 自动规划 | 无 | auto_plan 机制（DAG 缺失时自动派发 Meta-Planner） |

### 4.2 七维度评估

**轻量性 — 不合格。** Task.DAG.json 是 156 KB 的 JSON 文件，包含所有任务的定义、依赖、状态。PLAN-FIRST 三层强制意味着每次 dispatch_subagent 调用都要：L1 before-hook 验证 DAG 条目存在 → L2 工具体验证 DAG 存在性 → L3 gate-before 防御深度审计。原生 OpenCode 的 task 工具是"调用即执行"，零前置条件。

**复用性 — 不合格。** Task.DAG.json 与项目深度耦合。DAG-exempt Agent（Orchestrator/Meta-Planner/Super-Admin/Knowledge-Curator）的划分是硬编码的。L0-L4 路由链的权重（scope 35% + perm 40% + domain 25%）是经验值，不可配置。这套体系无法迁移到其他项目。

**高效性 — 不合格。** auto_plan 机制在 DAG 条目缺失时自动派发 Meta-Planner，轮询 Task.DAG.json 每 1000ms 一次，超时 120s。这意味着一个简单的"让 Coder-BE 改一个 bug"的任务，如果 DAG 里没有对应条目，会先花最多 2 分钟等 Meta-Planner 规划。原生 OpenCode 直接让 Build Agent 改代码，零等待。

**稳定性 — 不合格。** MEMORY.md 记录了多个 DAG 相关问题：dbDequeueWithLease TOCTOU 导致并发双 UPDATE、dispatch_payload 继承三层全断、dispatch_subagent CLI 成功返文件路径但 Orchestrator 用 subagent_type="general" 致路由错误。这些都是运行时确认的 bug，不是理论推测。

**可靠性 — 存疑。** DAG 条目缺失时 auto_plan 自动派发 Meta-Planner，但如果 Meta-Planner 自身失败呢？框架没有定义 Meta-Planner 失败后的降级策略。dispatch_queue 的租约 TTL 是 60s，如果子 Agent 在 60s 内没完成（复杂任务很可能），租约过期，任务变 stale。

**维护性 — 不合格。** 156 KB 的 Task.DAG.json 需要人工或 Meta-Planner 维护。DAG 条目的 agent 字段必须与 scope_to_agent 规则匹配，否则 gate-before 的 P2-1 审计会阻断。这是一个脆弱的耦合：改 Agent 名字要改 DAG，改 DAG 要改 scope 规则。

**健壮性 — 不合格。** PLAN-FIRST 三层强制的本意是"确保每个任务都有规划"，但实际效果是"简单任务也被迫走规划流程"。DAG-exempt 的 4 个 Agent 说明框架自己也承认有些场景不需要 DAG——但非 exempt Agent 没有这个灵活性。

### 4.3 核心问题

DAG 任务体系的根本问题是**将 LLM 的自主判断能力替换为硬编码的路由规则**。原生 OpenCode 让 LLM 自己决定派发哪个子 Agent、如何拆解任务——LLM 的推理能力就是规划器。框架不信 LLM 的判断，用 L0-L4 加权路由（scope 35% + perm 40% + domain 25%）替代 LLM 的直觉。但这些权重是经验值，不是从数据中学习的——它们本身就是另一种形式的"人为判断"，只是被编码进了 TypeScript。

---

## 五、与主流 Skill 范式对比

### 5.1 范式对比

| 维度 | 主流范式（OpenCode 原生） | work-one 框架 |
|------|------------------------|--------------|
| 知识注入 | Skill（Markdown，按需加载，可组合） | Agent .md 配置（常驻 prompt）+ 插件规则（TS 代码） |
| 能力扩展 | Skill 正交组合，同一 Skill 可授权多个 Agent | Agent 角色硬编码，工具权限固定 |
| 流程治理 | Plugin Hook（轻量拦截，fail-open） | 9 层 enforcement + 4 计数器 + token 锁 |
| 状态管理 | 文件系统 + SDK 内置 | 50 张 DB 表 + 37 次迁移 |
| 任务规划 | LLM 自主拆解 | Task.DAG.json + L0-L4 路由 |
| 代码规模 | ~0 行框架代码（SDK 原生能力） | 65,151 行 TypeScript |

### 5.2 Skill 利用现状

MEMORY.md 明确记录："agent configs 的 skills:[] 均空，19 个 SKILL.md 未注入任何 agent"。read_skill 工具虽然存在但"未注册到任何 agent 的 mcp_tools→agent 无法调用"。

这意味着框架**有 Skill 系统但完全不用它**。领域知识被硬编码在：
- 10 个 Agent .md 配置文件中（常驻 prompt，消耗上下文窗口）
- 30 个插件 handler 的 TypeScript 代码中（不可组合，不可跨项目复用）
- project.config.json 的 1000+ 行配置中（agent_tool_scopes、agent_dispatch_allowed_tools 等）

### 5.3 与原生范式的偏离

native-opencode 文档的核心论点：

> "90% 以上的企业级开发、构建、部署、运维场景，都可以通过「原生 Agent + Skill 集 + Hook 治理」的方案完全覆盖，不需要自定义任何 Agent。"

> "Skill 是正交的能力单元，可以任意搭配给不同 Agent；自定义 Agent 往往是高度耦合的，加一项能力就要修改整套提示词。"

> "Skill 是按需加载的，不用就不占用上下文窗口；自定义 Agent 的长提示词是常驻的，Agent 越多、提示词越长，上下文浪费越严重。"

框架的做法与这三条原则全部矛盾：
- 自定义了 10 个 Agent（而非"不需要自定义任何 Agent"）
- Agent 角色硬编码，能力不可组合（而非"Skill 正交组合"）
- Agent .md 常驻 prompt + 空 skills 列表（而非"Skill 按需加载"）

---

## 六、综合评估

### 6.1 过度设计判定

| 体系 | 过度设计? | 依据 |
|------|---------|------|
| 多智能体模式 | **是** | 10 个自定义 Agent 替代 5 个原生 + Skill 组合。5 种 Session ID 追踪 4 张表管理"父派发子"语义。L0-L4 路由用硬编码权重替代 LLM 判断。 |
| DB-Canonical + 硬约束 | **是** | 50 张 DB 表管理代码 Agent 状态。9 层 enforcement 制造层间死锁。4 计数器系统 + token 锁追求"不可绕过"但实际"不可恢复"。 |
| DAG 任务体系 | **是** | 156 KB JSON + 三层强制 + auto_plan 轮询。将简单的"派发子 Agent"变为多步状态机。LLM 的规划能力被硬编码路由替代。 |

### 6.2 流于表面判定

硬约束体系的"流于表面"最为明显：9 层 enforcement 链看似严密，但层间交互产生了 STOP directive 死锁、codegraph_impact 追踪不存在命令、Phase-0 阻断 question 工具等问题。约束的"形式完整性"很高（14 个 before-hook + 14 个 after-hook + 4 计数器 + 3 种模式），但"实质有效性"存疑——最大的约束违反者不是 Agent，而是框架自己的层间冲突。

### 6.3 不符合主流 Skill 范式判定

框架有 Skill 基础设施（19 个 SKILL.md + read_skill 工具 + skill_read_attest 认证），但**完全不使用**：skills 列表为空，read_skill 未注册。这是对主流范式的直接偏离。原生 OpenCode 的 Skill 系统设计精良（全局发现 + 按需加载 + 权限过滤 + Hook 管控），框架选择不用它，转而用 74,667 行 TypeScript 代码重建了一套更重、更耦合、更难维护的体系。

### 6.4 规模量化

| 指标 | 原生 OpenCode | work-one 框架 | 膨胀倍数 |
|------|-------------|--------------|---------|
| 框架代码行 | ~0 | 65,151 | ∞ |
| Agent 数 | 5 | 10 | 2x |
| DB 表 | 0（SDK 管 2 张） | 50 | 25x |
| 插件 handler | 0 | 39 | ∞ |
| 自定义工具 | 0 | 37 | ∞ |
| Enforcement 层 | 0（permission 矩阵） | 9 | ∞ |
| 状态管理 | 文件系统 | SQLite + 50 表 + 37 迁移 | — |

---

## 七、改进方向建议

以下仅为方向性建议，不涉及具体实现：

1. **回归 Skill 范式**：将 Agent .md 中的领域知识抽取为 Skill，填充 skills 列表，注册 read_skill 工具。用 Skill 的可组合性替代 Agent 角色的硬编码。

2. **削减 Agent 数量**：评估是否真的需要 10 个 Agent。Orchestrator + General（配 Skill）+ Explore 可能覆盖 80% 场景。Coder-BE/Coder-FE 可合并为 Coder + Skill 区分前后端。

3. **简化 Enforcement**：9 层 → 2-3 层（permission 矩阵 + scope 检查 + 可选 audit）。移除 Guidance Gate token 锁和 STOP directive 注入（实测无效）。4 计数器 → 1 个简单的失败计数。

4. **去 DB 化**：50 张表 → 5-10 张核心表。session_map/session_log 可合并。knowledge_* 7 张表可用文件系统替代。gate_sessions 30+ 列可精简为 10 列以内。

5. **移除 DAG 强制**：Task.DAG.json 作为可选的规划辅助工具，而非 dispatch 的前置条件。让 LLM 自主决定是否需要 DAG 条目。

6. **文档与代码同步**：dispatch_subagent.ts 已从 870 行变为 49 行，文档未更新。建立文档审计机制。

---

## Post-Execution Audit

**Skill 选择评估**:
- [x] 选定的执行 skill（opencode-framework-dev）是最佳匹配——提供了框架九大能力的知识基线
- [x] 正确组合使用了约束 skill（pre-flight-enforcement）+ 参考 skill（opencode-framework-dev）
- [x] 无更优 skill 遗漏

**遵循情况**:
- [x] Skill 选择校验: 组合使用 pre-flight-enforcement + opencode-framework-dev
- [x] 步骤 1: 检查文档体积（6,244 行，13 篇），规划 5 批阅读
- [x] 步骤 2: 通读 native-opencode 5 篇（agent-communication / integration-recommendation / skill-hook / skill / sse-events）
- [x] 步骤 3: 通读 opencode-framework 8 篇（cli-acp-integration / cognitive-map / db-canonical-design / enforcement-exemption-matrix / subsystems-report / tool-reference / session-concepts / 工具调用失败链）
- [x] 步骤 4: 代码实测验证 12 项指标，发现 dispatch_subagent.ts 从 870 行变为 49 行等差异
- [x] 步骤 5: 七维度分析三大体系 + 对比主流 Skill 范式
- [x] 步骤 6: 输出评估报告

**偏差说明**: 无

**改进建议**: 下次类似分析任务可在 Phase -1 阶段考虑使用 Explore agent 并行读取文档，减少串行等待时间。

**总体评估**: 完全遵循
