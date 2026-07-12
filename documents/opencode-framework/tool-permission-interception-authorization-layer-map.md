# OpenCode 工具权限 / 拦截 / 授权责任分层图（当前运行态）

> 更新时间：2026-07-09
> 范围：`/home/zhaoge/workspace/opencode/work-one`
> 目的：梳理当前框架中“工具权限 / 拦截 / 授权”的完整责任链，明确每一层的权威来源、职责边界、主要文件、典型风险点，为后续重构提供统一基线。

---

## 1. 结论摘要

当前框架并不是“只有一层工具权限判断”，而是一个**多层串行治理链**：

1. **配置权限层**：`opencode.json` / `Orchestrator.md` 决定 agent 能看到什么、静态允许什么。
2. **调度编排层**：`before-dispatcher.ts` 负责把一次工具调用送入多个 before-handler 串行链。
3. **前置治理层**：`permission-safety`、`behavioral-path-guard`、`scope`、`codegraph`、`skill-policy`、`dispatch-signal` 等 handler 分别做不同维度的阻断。
4. **领域授权层**：`repo grants`、`dispatch privilege` 等 service 做一次性 / 会话级动态授权。
5. **工具自防护层**：`safe_shell`、`safe_framework_edit`、`safe_repo_*` 在工具内部再次做 allowlist、grant、path、backup、审计等兜底。
6. **后置审计层**：after hooks 和 `writeLog` / `writeJsonl` 负责记录结果、轨迹、软拒绝、状态推进。

这条链的优点是安全上偏 fail-closed，缺点是**决策逻辑分散、职责重叠、规则语义容易漂移**。`safe_shell` 被 `[FW-ENFORCE][REPO-OP]` 误拦截，就是这种分散设计暴露出的典型问题。

---

## 2. 当前权威源

### 2.1 权威源分工

| 层级 | 权威文件/模块 | 当前职责 | 备注 |
|---|---|---|---|
| 静态工具权限 | `opencode.json` | agent 是否允许使用某工具、某类路径权限 | 运行态第一权威 |
| Agent 能力声明 | `.opencode/agents/Orchestrator.md` | skills / mcp_tools / prompt 侧能力暴露 | 不是最终执行授权源 |
| 执行顺序 | `.opencode/project.config.json` | before/after/system 执行顺序、部分运行参数 | 只定义顺序与配置，不应承载安全决策本体 |
| Before 治理 | `.opencode/plugins/before-dispatcher.ts` + `plugin-handlers/before/*` | 前置阻断与审计 | 当前是主要热路径 |
| 动态授权 | `.opencode/service/repo/grants.ts` 等 | repo grant / dispatch privilege | 任务级授权 |
| 工具内防护 | `.opencode/tools/*` + `service/file-guard/*` | 最终执行前兜底 | 当前与 before 有一定重叠 |
| 日志权威 | `.opencode/lib/log-manager.ts` | 统一结构化日志与 flush 策略 | 统一日志根 |

### 2.2 当前不应误判为权威源的模块

| 模块 | 原因 |
|---|---|
| `framework-enforcer.ts` | 当前运行态不存在活跃同名插件文件，只剩历史测试桩与旧命名残留 |
| `legacy-agent-permissions` | 兼容兜底，不应继续扩展为主链权限源 |
| `project.config.json` 中的零散 allowlist | 适合作为参数化配置，不适合作为最终裁决器 |

---

## 3. 当前完整责任链

## 3.1 总体时序

```text
LLM 发起工具调用
  -> opencode.json / Agent 能力声明决定“可见/可调用”
  -> before-dispatcher 按顺序分发 before handlers
     -> permission-safety
     -> behavioral-path-guard
     -> scope
     -> codegraph
     -> skill-policy
     -> dispatch-signal
     -> ...
  -> 具体工具 execute()
     -> 工具内部 service 校验
     -> shell/repo/grant/path/allowlist 二次兜底
  -> after-dispatcher
     -> 审计 / 状态推进 / 软拒绝检测 / 读跟踪 / 缓存同步
  -> writeLog / writeJsonl 落盘
```

## 3.2 分层责任图

### L0. 能力暴露层

**职责**：让某 agent“看得见 / 能声明使用”某个工具或 skill。

**主要文件**：

- `opencode.json`
- `.opencode/agents/Orchestrator.md`

**问题**：

- 这一层只适合做“静态能力矩阵”，不适合承载复杂动态判定。
- 当前部分问题来自“静态权限已 deny，但下游又引入额外动态授权路径”，导致理解门槛高。

### L1. 静态访问控制层

**职责**：判断某 agent 对某工具、某路径模式是否天然允许。

**主要文件**：

- `.opencode/service/permission/reader.ts`
- `.opencode/service/permission/isolation.ts`

**关键职责**：

- 读取 `opencode.json`
- 提供 `getAgentPermission()`
- 提供 `isPathAllowedForAgent()`
- 提供 `getAgentShellAllowlist()`

**现状特点**：

- 已明确声明 `opencode.json` 是权威源。
- 但同一文件内同时存在“权威源逻辑”和“deprecated 过渡逻辑”。
- 仍保留 legacy fallback，说明链路还处于迁移期。

### L2. 前置治理调度层

**职责**：把单次工具调用送入一个配置化的 before-handler 串行链。

**主要文件**：

- `.opencode/plugins/before-dispatcher.ts`

**现状特点**：

- 以 `HANDLER_MAP + TOOL_FILTER + execution_order` 编排。
- 严格串行，前一个 throw 会终止后续 handler。
- 这是“系统 Controller”层，不应该再包含领域规则本体。

### L3. 前置阻断与策略层

**职责**：从不同角度判断“这次调用在当前上下文是否允许继续”。

**当前主要 handler**：

| Handler | 职责 | 当前问题 |
|---|---|---|
| `permission-safety` | 配置/危险 shell 相关保护 | 只是 delegate 容器，自身不具备独立领域模型 |
| `behavioral-path-guard` | 全局受保护框架路径防写 | 与 scope/path/grant 部分重叠 |
| `scope` | 写入范围、route、UC7、backup-bypass、config read attest | 逻辑过宽，承载了多种不相干责任 |
| `codegraph` | impact 证据门 + repo-op 阻断 | 同时处理源码修改与 repo 操作，语义混合 |
| `skill-policy` | skill 使用策略 | 相对独立 |
| `dispatch-signal` | dispatch 信号治理 | 相对独立 |

### L4. 领域级动态授权层

**职责**：处理“某次任务 / 某个子 session 临时允许做什么”。

**主要文件**：

- `.opencode/service/repo/grants.ts`
- `.opencode/service/repo/classify.ts`
- `.opencode/service/repo/audit.ts`
- `.opencode/service/dispatch/privilege.ts`

**现状特点**：

- repo 写入已经进入一等 grant 体系。
- grant 的状态流较清晰：`pending -> bound -> consumed/revoked`
- 但 grant 只覆盖部分领域（repo / dispatch privilege），没有统一抽象成一套通用治理决策模型。

### L5. 工具自防护层

**职责**：在最终执行前，做最后一层本地自防护与 fail-closed。

**主要文件**：

- `.opencode/tools/safe_shell.ts`
- `.opencode/service/file-guard/shell-guard.ts`
- `.opencode/tools/safe_framework_edit.ts`
- `.opencode/tools/safe_repo_*`
- `.opencode/tools/safe_hash.ts`

**现状特点**：

- 工具层承担了很多 service 层决策，导致“before 已经拦一次，tool 内部再拦一次”。
- 对 `safe_shell` 而言，最终执行仍是 `execSync(command)` 字符串 shell 路径，不符合“安全命令执行优先 `execFile/spawn`”的最佳实践。

### L6. 后置审计层

**职责**：记录轨迹、推进状态、识别软拒绝、补充审计。

**主要文件**：

- `.opencode/plugins/after-dispatcher.ts`
- `.opencode/plugin-handlers/after/*`
- `.opencode/lib/log-manager.ts`
- `.opencode/lib/jsonl-writer.ts`

**现状特点**：

- 主日志体系是统一的。
- 但局部模块仍使用 `writeLogSafe` 之类兼容封装，说明日志层尚未完全收敛。

---

## 4. MVC 映射（当前运行态）

虽然框架整体更接近 Pipes-and-Filters / Chain of Responsibility，但如果按 MVC 视角整理，可以得到以下映射。

### 4.1 Controller

| 文件 | 角色 |
|---|---|
| `.opencode/plugins/before-dispatcher.ts` | Before 控制器，负责顺序调度 handler |
| `.opencode/plugins/after-dispatcher.ts` | After 控制器，负责后置副作用执行 |
| `.opencode/plugins/system-dispatcher.ts` | System transform 控制器 |
| `.opencode/plugin-handlers/before/*` | 各子控制器 / 中间控制器 |

### 4.2 Model

| 文件/目录 | 角色 |
|---|---|
| `.opencode/service/permission/*` | 权限模型 |
| `.opencode/service/repo/*` | repo 操作分类、grant、审计模型 |
| `.opencode/service/dispatch/*` | dispatch privilege / queue / routing 模型 |
| `.opencode/service/gate/*` | gate、scope、状态管理模型 |
| `.opencode/lib/db-manager.ts` | DB 访问基础设施 |

### 4.3 View / Presentation

| 文件/目录 | 角色 |
|---|---|
| `throw new Error("[FW-ENFORCE]...")` 消息格式 | 面向 LLM / 用户的错误视图 |
| `.opencode/lib/log-manager.ts` | 结构化运行视图 |
| `.opencode/lib/jsonl-writer.ts` | 诊断视图 / 轨迹视图 |

### 4.4 当前 MVC 违和点

1. `Controller` 层过胖：`scope-validate.ts` 实际像“控制器 + 业务规则 + 一部分审计器”的混合体。
2. `Model` 未完全收敛：repo grant、dispatch privilege、shell allowlist 各自有模型，但没有统一“工具治理决策模型”。
3. `View` 分散：错误消息和审计日志的格式虽然有统一趋势，但仍由多个模块各自拼接。

---

## 5. 当前主要代码责任点

## 5.1 静态权限

**文件**：`.opencode/service/permission/reader.ts`

**关键职责**：

- `readOpencodeConfig()`
- `getAgentPermission()`
- `isPathAllowedForAgent()`
- `getAgentShellAllowlist()`

**问题特征**：

- 文件头部声明 `opencode.json` 权威，但函数体仍混合 legacy fallback 与 deprecated 迁移说明。
- `deny-first` 与 OpenCode 全局 `last matching wins` 语义并存，需要长期统一。

## 5.2 Before 编排

**文件**：`.opencode/plugins/before-dispatcher.ts`

**关键职责**：

- `HANDLER_MAP`
- `TOOL_FILTER`
- `DEFAULT_ORDER`
- `shouldRun()`

**问题特征**：

- 这里已经是非常明确的“控制器层”，适合保留。
- 但由于下游 handler 职责分割不清，导致 dispatcher 的维护成本随 handler 扩张上升。

## 5.3 scope 复合治理

**文件**：`.opencode/service/gate/scope-validate.ts`

**承担职责**：

- modify tool 判断
- path 提取
- unparseable shell 分类
- backup-bypass 阻断
- route mismatch 审计
- config read attest 审计
- UC7 规则
- knowledge cache 大小限制

**结论**：

这是当前最明显的“高耦合复合治理器”之一。

## 5.4 repo grant

**文件**：`.opencode/service/repo/grants.ts`

**优点**：

- 生命周期清晰
- path / tool / remote 三类约束比较完整
- 日志事件明确

**问题**：

- 该模块本身较清晰，但与 `codegraph`、`safe_shell`、`safe_repo_*` 的组合方式还不够收敛。

## 5.5 safe_shell

**文件**：

- `.opencode/tools/safe_shell.ts`
- `.opencode/service/file-guard/shell-guard.ts`
- `.opencode/service/repo/classify.ts`

**当前语义**：

- 既是“shell allowlist 执行器”
- 又承载“repo 命令阻断”
- 又承载“脚本写入扫描”
- 又承载“eval 写入阻断”

**结论**：

`safe_shell` 当前职责过重，是多个问题的汇合点。

---

## 6. 当前重复判断 / 职责混乱 / 容易误拦截点

## 6.1 重复判断点一：repo-op 在 before 和 tool 内部双重判断

**位置**：

- `.opencode/plugin-handlers/before/codegraph.ts`
- `.opencode/service/file-guard/shell-guard.ts`

**现象**：

- `codegraph` 里对 `safe_shell/bash` 的 `git/gh` 先做一轮 repo-op 判断。
- `shell-guard` 里又对同一命令再做一轮 `classifyRepoShellCommand()` 判断。

**后果**：

- 规则重复实现。
- 错误消息可能不一致。
- 修 bug 需要改两处。

## 6.2 重复判断点二：git bypass 在 `config-guard` 与 `git-guard` 两处维护

**位置**：

- `.opencode/plugin-handlers/before/config-guard.ts`
- `.opencode/plugin-handlers/before/git-guard.ts`
- `.opencode/plugin-handlers/before/permission-safety.ts`

**现象**：

- `permission-safety` 只是把两个 legacy handler 包起来。
- 两个子 handler 都在维护 shell/git 相关危险模式。

**后果**：

- 规则散落，命名不统一。
- active path 看起来只有一个 handler，实际背后仍是双实现。

## 6.3 职责混乱点一：`scope-validate.ts` 承载过多不相关责任

**位置**：

- `.opencode/service/gate/scope-validate.ts`

**现象**：

- 同时做 path scope、shell 解析、route mismatch、UC7、config read attest、knowledge cache size。

**后果**：

- 违反高内聚。
- 任一领域变更都可能影响整个 scope 校验器。
- 很难单独测试某个规则模块。

## 6.4 职责混乱点二：`codegraph.ts` 同时处理源码 impact 门和 repo-op 门

**位置**：

- `.opencode/plugin-handlers/before/codegraph.ts`

**现象**：

- 文件名与心智模型都指向“CodeGraph impact enforcement”
- 但实现里同时处理：
  - GitHub MCP read/write 分流
  - `safe_shell` 的 repo read/write 分流
  - 传统 source edit impact 强制

**后果**：

- 模块名与真实职责不一致。
- repo 领域逻辑被塞进了 codegraph 领域控制器。

## 6.5 容易误拦截点一：非 repo 命令被分类成 `provider=git, kind=unknown`

**位置**：

- `.opencode/service/repo/classify.ts`

**现象**：

- `classifyRepoShellCommand()` 对非 `git/gh` 命令返回默认 `provider: "git", kind: "unknown"`。

**后果**：

- 上层只判断“provider 是 git/gh 且 kind 不是 read”时，`cat`、`sha256sum` 等普通命令会被误杀。

## 6.6 容易误拦截点二：`safe_shell` 同时受行为路径、scope、repo-op、allowlist 多层叠加

**位置**：

- `behavioral-path-guard`
- `scope-validate`
- `codegraph`
- `shell-guard`

**现象**：

- 一条 `safe_shell` 命令在 before 链与 tool 内部经历多次语义不同的判定。

**后果**：

- 用户看到的错误是最后抛出的那一个，但根因可能在更上游。
- 同一命令在不同 session / handler 顺序下的报错可能不同。

---

## 7. 当前日志系统集成现状

## 7.1 主链是统一的

**主权威文件**：`.opencode/lib/log-manager.ts`

当前优点：

- 统一 `writeLog(plugin, category, fields)`
- 有缓冲 flush 机制
- 有 level 过滤
- 支持结构化字段
- 支持集中归档

## 7.2 尚未完全收敛的地方

**典型例子**：

- `.opencode/service/gate/store-crud.ts` 中使用 `writeLogSafe()` 懒加载 log manager

**风险**：

- 说明还存在循环依赖压力。
- 日志虽然“最终仍落到主 logger”，但调用姿势不统一。

**结论**：

- 当前日志体系整体方向是对的。
- 后续重构应坚持“领域 service 不直接自己发明日志方案”，而是统一经由 log facade / logger adapter 注入。

---

## 8. 当前推荐的责任边界

为了让当前架构更容易演进，建议先统一以下边界定义。

| 层 | 应负责 | 不应负责 |
|---|---|---|
| L0 能力暴露 | 工具可见性、静态能力声明 | 运行时临时授权 |
| L1 静态权限 | agent 对 tool/path 的基线权限 | 复杂业务分类 |
| L2 Dispatcher | 调度顺序、错误边界、生命周期记录 | 具体安全规则实现 |
| L3 策略模块 | impact、path、grant、repo-op 等单一规则决策 | 彼此交叉代偿 |
| L4 动态授权 | grant 的创建、绑定、消费、撤销 | impact 证据门 / 静态权限源 |
| L5 工具层 | 参数校验、最终防护、执行器封装 | 重复实现上游完整规则 |
| L6 审计层 | 结构化记录、轨迹、状态推进 | 重新裁决业务权限 |

---

## 9. 当前最小阅读路径

如果要快速理解今天的运行态，建议按下面顺序阅读：

1. `opencode.json`
2. `.opencode/plugins/before-dispatcher.ts`
3. `.opencode/service/permission/reader.ts`
4. `.opencode/service/gate/scope-validate.ts`
5. `.opencode/plugin-handlers/before/codegraph.ts`
6. `.opencode/service/repo/classify.ts`
7. `.opencode/service/repo/grants.ts`
8. `.opencode/service/file-guard/shell-guard.ts`
9. `.opencode/lib/log-manager.ts`

---

## 10. 总结

当前框架的“工具权限 / 拦截 / 授权”体系并不是单一权限模块，而是一个多层治理流水线。

它的优势是：

- 防线多
- fail-closed
- 可插拔
- 动态授权能力已经局部落地

它的主要问题是：

- **权限源、策略源、授权源、工具内防护源没有完全分层**
- **多个 handler 与 service 同时在做 repo / shell / path 语义判断**
- **`safe_shell` 成为高耦合风险集中点**
- **部分 legacy delegate 和 active path 并存，增加理解成本**

因此，后续优化的关键不是“减少安全层数”，而是：

1. **保留多层防线**
2. **统一决策模型**
3. **把规则拆成高内聚单元**
4. **让 dispatcher 只做 controller，不再兼任业务规则容器**
5. **让日志与错误输出统一走标准接口**

下一步蓝图文档将基于本分层图，提出一套符合 MVC、统一日志、松耦合高内聚的重构方案。
