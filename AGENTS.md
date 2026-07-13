# QoderWork — OpenCode 框架协作指南

本文件是 QoderWork 协助用户开发和维护 OpenCode 多 Agent 框架（work-one 项目）的专属指引。随着协作深入持续更新。


## Session Startup

每次新会话开始时，如果当前工作台是 /home/zhaoge/workspace/qoderwork/，执行以下步骤：

1. **检查上轮遗漏日志**：用 `git diff --stat` 或 `git log --oneline -5`（在 work-one 目录）查看最近的代码变更，对比 `logs/` 目录下已有日志。如果发现未记录的代码修改，先补写日志再继续当前任务
2. 读取 `documents/INDEX.md`，了解可用文档清单和摘要
3. 根据当前任务主题，按需读取相关文档（不要一次性全部加载）
4. 如果任务涉及框架架构、Plugin、Tool、Session 等概念，优先参考 documents/ 下的专题文档

文档路径：`/home/zhaoge/workspace/qoderwork/documents/`

---

## 1. 项目概况

**work-one** 是基于 OpenCode 平台构建的多智能体框架，位于 WSL Ubuntu-24.04 的 `/home/zhaoge/workspace/opencode/work-one/`。

> **设计 vs 实际（2026-07-08 校准）**：原始设计是"三层十角色"，但当前运行态已精简。下方"实际运行态"为 `opencode.json` 实测值，"设计蓝图"为历史架构描述。判断配置时以**实际运行态**为准。

### 实际运行态（opencode.json 实测，2026-07-08）

- **5 个 Agent**（`opencode.json` 的 `agent` 对象）：Orchestrator（自定义，prompt 指向 `.opencode/agents/Orchestrator.md`）+ 4 个 native（build / general / plan / explore，平台内置无 .md）
- **5 个 Plugin 入口**（`opencode.json` 的 `plugin` 数组）：`.opencode/plugins/*.ts`
- **37 个自定义 Tool**：`.opencode/tools/*.ts`（safe_edit、safe_delete、safe_restore、safe_shell 等）
- **12 个 MCP Server**（`opencode.json` 的 `mcp` 对象）：compliance-gate、codegraph、notify-server 等
- **18 个 Skill**：`.opencode/skills/{name}/SKILL.md` 自动发现
- **DB**：SQLite 单一数据源（DB-canonical 设计），schema 已到 v35（repo_operation_grants 表）

> **配置键名**：`opencode.json` 顶层是单数 `plugin` / `agent` / `mcp`，不是复数。

### 设计蓝图（历史架构，非当前运行态）

- **10 个 Agent**：分 4 层——元认知层（Meta-Planner）、编排/执行层（Orchestrator、Architect、Coder-BE、Coder-FE）、验证层（Guardian、Arbiter）、运维层（CI-CD-Agent、Super-Admin、Knowledge-Curator）。这些角色名仅在文档和 Orchestrator prompt 文本中出现，**未在 opencode.json 注册为独立 agent**。
- **29 个 Plugin Handler**：before 15 + after 14，通过 5 个 plugins/*.ts 入口分发，实现 tool.execute.before/after 拦截
- **CodeGraph 集成**：Phase 3 硬约束已完成，codegraph-enforce.ts 拦截 4 个文件修改工具

详细架构参见 work-one 目录下的 `AGENTS.md`（面向 OpenCode Agent 的全局规范，21KB）。

---

## 2. WSL 访问约定

QoderWork 运行在 Windows 上，work-one 文件在 WSL 中。所有文件操作通过 bash 命令执行：

```
wsl -d Ubuntu-24.04 bash -c "export PATH='/home/zhaoge/.local/bin:/usr/local/bin:/usr/bin:/bin:/home/zhaoge/.bun/bin' && cd /home/zhaoge/workspace/opencode/work-one && <command>"
```

注意事项：

- **不要**使用 UNC 路径（`\\wsl.localhost\...`）配合 Write/Edit 工具，会被拒绝
- **不要**直接在 bash -c 中写含模板字符串的脚本，先写到 /tmp 再执行
- Bun 运行时路径：`/home/zhaoge/.bun/bin/bun`
- CodeGraph CLI 路径：`/home/zhaoge/.local/bin/codegraph`
- Bun 缓存不可靠，修改 .ts 插件后可能需要 `rm -rf ~/.bun/install/cache` 强制重编译

---

## 3. CodeGraph 使用规则

**规则：分析或修改 work-one 代码前，必须先用 CodeGraph CLI 查询影响范围。**

CodeGraph 已集成到 work-one 框架中（MCP server + plugin + skill），同时 QoderWork 也可直接通过 CLI 调用。

### CLI 命令对照

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

### 使用场景

- **修改代码前**：先 `codegraph impact` 评估影响范围，确认不会遗漏关联更新
- **理解代码时**：用 `codegraph callers/callees` 理清调用关系，比 grep 更高效
- **调试问题时**：用 `codegraph query` 定位符号所在文件，再深入阅读源码
- **索引过期时**：`codegraph status` 显示 Pending Changes 时，运行 `codegraph sync`

### 索引机制

CodeGraph 的 `serve --mcp` 内置 file watcher，代码文件变更后自动增量重索引。三层过滤：扩展名白名单（仅 .ts/.js/.yml/.yaml 等源码）、目录黑名单（60+ 排除项）、.gitignore 遵循。daemon 300 秒空闲退出，重启时 catch up 积压变更。

---

## 4. Memory 管理规则

### 写入时机

- 发现新的环境事实（工具行为、路径约定、平台限制）
- 用户纠正了我的错误或表达了偏好
- 完成重要任务后，提炼结论性知识（不是流水账）

### 写入原则

- **MEMORY.md**：只放精炼的长期参考知识，控制大小。写"结论"不写"过程"
- **daily log**（memory/YYYY-MM-DD.md）：重要任务的变更摘要，包含改了哪些文件和关键决策
- **不写**：临时状态、显而易见的信息、可从代码直接读取的内容

### 格式偏好

用"前缀标签"提高检索命中率：
- `work-one 规则:` — 行为规则（如"分析代码前必须 codegraph impact"）
- `work-one 架构:` — 架构事实（如"codegraph-enforce 拦截 4 个工具"）
- `work-one 约定:` — 协作约定（如"Skill 需在 agent .md 的 skills: 字段注册"）

---

## 5. 框架配置权威源

| 配置项 | 权威位置 | 说明 |
|--------|---------|------|
| 工具权限（permission） | `opencode.json` | 控制 Agent 能否使用某工具 |
| 工具能力声明（mcp_tools） | `.opencode/agents/{name}.md` | Agent 可用的工具列表 |
| Skill 注册 | `.opencode/agents/{name}.md` 的 `skills:` 字段 | 新 Skill 必须在此显式列出 |
| Plugin 注册 | `opencode.json` 的 `plugins` 数组 | 按目录自动发现，需在此声明启用 |
| MCP Server 注册 | `opencode.json` 的 `mcp` 对象 | 当前 12 个 server |
| 两层权限模型 | opencode.json（访问控制）+ agent .md（能力声明） | 独立且各自权威 |

---

## 6. Session 管理

- 上下文使用率达到 60-70% 时建议切换新 session
- 新 session 自动加载本文件和 MEMORY.md
- 跨 session 连续性靠 memory 系统保障，不靠对话上下文
- 大型任务（如认知地图）应在新 session 中执行，避免上下文膨胀

---

## 7. 更新日志规范（强制）

### 目的

本目录（`logs/`）存放每次协作的详细变更日志。目的是让未来的 session 能够系统性地回溯历史决策、理解变更原因、追踪演进脉络。这是弥补 memory 系统"只记结论、不记过程"的关键补充。

### 目录结构

```
logs/
├── 2026-06-28-codegraph-phase3-enforcement.md
├── 2026-06-28-safe-restore-permissions.md
├── 2026-06-27-codegraph-mcp-integration.md
└── ...
```

命名规则：`YYYY-MM-DD-<简短主题>.md`，同一天多个任务则各自独立文件。

### 日志格式

每篇日志控制在 20 行以内，只记三件事：

```markdown
# <一句话标题>

**为什么**: <1-2 句，问题是什么/目标是什么>

**改了什么**:
- `path/to/file.ts` — <具体改了什么，函数名/配置项>
- `path/to/other.md` — <...>

**决策**: <选择了什么方案，为什么。如有被否决的替代方案也写在这里>
```

### 强制规则

1. **每次完成涉及代码修改的任务后**，必须在本目录创建对应的日志文件
2. **每次开始新任务前**，应先用 `ls logs/ | grep <关键词>` 查看相关历史
3. **记录被否决的方案**：避免未来 session 重复探索死胡同
4. **不记流水账**：git diff 能看到的东西不重复写，只写 diff 看不出的"为什么"

---

## 8. 验证原则（强制）

### 目的

任何"可能错"的经验性断言，下结论前必须先找到能证伪它的最便宜检验并执行；找不到便宜检验时，必须显式标注"未经验证"，不得当成既定事实输出。本规则区别"我验证过"与"我听起来觉得对"，是硬性流程，不依赖模型自觉。

### 判别问句

面对任何要输出的断言，先问：**"这条断言如果是错的，我能用什么最低成本发现它错？"**

- 答得出 → 跑那个检验，再下结论
- 答不出 → 标注"未经验证（原因）"，不得当事实陈述
- 成本太高/会动真实环境 → 先标注未验证，再申请授权，不得擅自执行

### 按任务类型的检验清单

| 断言类型 | 检验形式 | 最便宜手段 |
|---|---|---|
| git/shell 行为 | 沙箱最小复现 | `/tmp` 建临时 repo 跑一遍 |
| 代码改动"能跑通" | 真跑测试/类型检查/执行 | `bun test` / `tsc` / 调一次函数 |
| 关于现有代码的断言 | 读真实源码，不靠函数名猜 | Read 工具 / `codegraph query` |
| 库/API 行为 | 跑最小 snippet | `bun -e` / `node -e` |
| 架构推理"A 调用 B" | 追真实调用链 | `codegraph callers/callees` |
| 配置断言"json 有 X" | 读实际文件 | Read 工具 |
| "我已完成 X" | 出示证据 | 重跑测试 / 检查产物 |
| 预测"不影响 Y" | 找最便宜证伪器 | `codegraph impact` + 实查 Y |

### 校准（避免无差别验证）

以下情况不强制验证：

- **纯定义/同义反复**（逻辑推理、数学）：验证是浪费
- **纯偏好/观点**（命名好坏、风格选择）：无可证伪事实
- **用户明确要快**（"快速看一眼 X 在不在"）：给快速答案，但标注"未深查"
- **检验会污染真实环境**（在 work-one 真跑、发外部请求）：先标注未验证，再申请授权

### 强制规则

1. **已验证的结论**：可陈述为事实，附检验证据（命令输出/文件引用/行号）
2. **未验证的断言**：必须带"未经验证"标签和原因，不得与已验证结论混同
3. **验证失败的尝试**：如实展示，不得隐藏（失败本身是有效信息）
4. **不得用"应该""通常""一般来说"掩盖未验证的经验断言**：这些词若用来回避验证，视为违规

---

## 9. 协作日志摘要

记录重要的协作决策和变更，按时间倒序。详细日志见 `logs/` 目录。

### 2026-07-07

- **Git Write Grant 完整实施**：12 个一等 repo 工具（5 read + 4 local write + 3 remote write），git/gh/github_mcp 分类器（617行），DB-backed grant 生命周期（v35 schema: repo_operation_grants + repo_operation_events），57 files +3935/-169 lines
- **G9 Live LLM E2E 3/3 PASS**：通过 serve API 从 Orchestrator 发起完整 dispatch 链路验证——G9-001 read tools 直接调用成功，G9-002 无 grant 写操作被双重阻断，G9-003 grant create→bind→stage→commit→consume 全流程通过（commit `e02a561a`）
- **Serve API E2E 方法论确认**：POST /session + POST /session/{SID}/message 可直接驱动 Orchestrator→build 调度链，dispatch_subagent 工具正确传递 dispatch_privilege/allowed_paths，session plugin 自动绑定 grant
- **AGENTS.md 规则 8 写入**：每次改代码后必须清 bun 缓存→重启 serve→从 Orchestrator 入口触发→观察完整链路行为

### 2026-06-28

- **CodeGraph Phase 3 硬约束补齐**：codegraph-enforce.ts 从仅拦截 safe_edit 扩展到 4 个工具（safe_edit/safe_delete/safe_restore/safe_shell），新增 extractFilePath() 按工具类型提取目标文件路径
- **codegraph-first Skill v1.1.0**：更新触发条件覆盖全部文件修改工具，注册到全部 10 个 Agent 的 skills: 字段
- **Skill 注册约定确认**：新 Skill 必须在 agent .md 的 skills: 字段显式列出，不在 opencode.json 中注册
- **CodeGraph CLI 可用性确认**：QoderWork 可通过 WSL bash 直接调用 codegraph CLI，功能等同 MCP 工具
- **更新日志规范建立**：创建 logs/ 目录和日志模板，强制要求每次代码修改后写详细变更日志
- **QoderWork 专属工作目录**：创建 `/home/zhaoge/workspace/qoderwork/`，与 work-one 分离，存放 QoderWork 专属的 AGENTS.md 和协作日志
- **ACP 协议完整验证通过**：`opencode acp` (stdio JSON-RPC 2.0) 实现 QoderWork→OpenCode 双向实时通道。initialize→session/new→session/prompt→86个流式通知(thought_chunk/message_chunk/usage_update)→session/close。能看到 Agent 推理过程，支持多轮对话、会话恢复、分叉。对比 `opencode run`(fire-and-forget)，ACP 适合交互式协作
