# OpenCode Agent 双向通信机制官方确认
## 核心结论
**OpenCode 官方原生不支持 Agent 之间的双向实时通信**。原生 Agent 体系采用「会话隔离 + 单向委派」的设计：父子 Agent 通过 `task` 工具实现「调用-一次性返回」的同步交互，主 Agent 之间为完全独立的会话，没有内置的消息传递、状态同步、中途交互能力。

所有双向通信能力均由社区第三方插件基于 Plugin Hook 机制扩展实现，这也恰好印证了你之前的判断：**原生 Agent + Skill + Plugin Hook 的组合，完全可以扩展出双向协作能力，无需专门自定义 Agent**。

---

## 一、官方原生 Agent 通信机制（无原生双向）
### 1.1 父子 Agent：单向委派 + 一次性返回
根据官方 Agent 文档与 `task` 工具源码实现，父子 Agent 的交互是标准的**同步调用、独立会话、结果一次性返回**模式：
1. 父 Agent 通过 `task` 工具发起调用，传入任务描述与子 Agent 类型
2. OpenCode 创建完全独立的子会话，子 Agent 在隔离上下文中执行任务
3. 执行过程中，父子 Agent 没有任何原生的消息交互通道，父 Agent 处于阻塞等待状态
4. 子 Agent 任务完成后，将最终结果一次性返回给父 Agent，子会话随即销毁

> 官方设计的核心目的是上下文隔离：子 Agent 不继承父会话上下文，父 Agent 也不会收到子 Agent 的中间状态，以此节省上下文窗口、避免逻辑污染。用户可以通过快捷键手动在父子会话之间导航查看，但这是用户层面的操作，不是 Agent 之间的主动通信。

### 1.2 主 Agent 之间（Plan / Build）：完全独立会话
两个内置主 Agent（Plan 规划代理、Build 执行代理）是完全平行的独立主会话：
- 二者通过 Tab 键手动切换，没有原生的自动消息同步、状态共享能力
- 它们共享项目文件系统，但会话上下文、历史记录、已加载 Skill 完全隔离
- 官方没有提供任何原生 API 让 Plan 主动给 Build 发消息，反之亦然

### 1.3 子 Agent 之间：无原生互通能力
多个并行的子 Agent 之间同样是完全隔离的独立会话，原生没有任何内置的消息总线、事件通知或协作机制，每个子 Agent 只和调用它的父 Agent 有单向返回关系。

---

## 二、双向通信的实现：基于 Plugin Hook 的社区扩展
所有 Agent 双向通信方案，都是基于 OpenCode 的 Plugin Hook 体系 + Server HTTP API 扩展实现的，核心原理是：**通过 Hook 拦截会话生命周期，调用 `/session/{id}/prompt_async` 接口向目标会话注入消息，模拟双向通信**。

### 2.1 主子 Agent 双向控制：`opencode-agent-intercom`
这是最典型的主子 Agent 双向通信插件，完全基于原生 Plugin 体系开发：
- **核心能力**：异步启动子 Agent（不阻塞父会话）、父 Agent 向运行中的子 Agent 注入消息、查询子 Agent 实时状态、中途中止子 Agent
- **实现原理**：通过 `session.*` Hook 管理子会话生命周期，封装 `task` 工具的异步调用，向父 Agent 暴露通信工具
- **设计目标**：解决原生 `task` 工具阻塞父会话、无法中途修正的问题，让小模型也能实现流式多 Agent 协作

### 2.2 跨会话/跨终端 Agent 消息总线
针对多个独立 OpenCode 实例（多终端、多进程）的双向通信，社区有三类典型实现：
1. **`oh-my-msgcode`**：基于本地消息通道，实现不同终端的 Agent 之间实时收发消息，支持请求-响应式交互
2. **`opencode-asl`（AgentSyncLayer）**：基于 Redis + SQLite 实现发布订阅消息总线，支持状态广播、文件编辑声明、多 Agent 协同防冲突
3. **`opencode-relay`**：基于 OpenCode Server HTTP API，实现多实例之间的消息广播与会话注入

### 2.3 扩展的底层依赖
这些插件全部不需要修改 OpenCode 源码，完全基于官方开放的两个能力构建：
- **Plugin Hook 体系**：`session.*`、`message.*`、`tool.execute.*` 钩子，用于监听会话状态、拦截工具调用、注入消息
- **Server HTTP API**：`/session/{id}/prompt_async` 等接口，用于向指定会话异步注入内容

---

## 三、结合 Skill + Hook 的双向协作落地方式
回到你提出的「原生 Agent + Skill + Hook 足够覆盖全流程」的架构思路，双向协作完全可以在这个框架内落地，不需要自定义 Agent：

### 方案一：轻量原生替代（无需额外插件）
如果不需要强实时双向交互，可以用「文件系统介质 + Skill 规范 + Hook 辅助」实现松耦合协作：
1. **Skill 定义协作协议**：在 Skill 中约定输出文件路径、状态标记格式、结果结构规范
2. **原生 Agent 执行**：子 Agent 按 Skill 规范将中间结果写入指定文件，父 Agent 按约定读取
3. **Hook 做状态通知**：通过 `message.*` Hook 监听子会话输出，关键节点主动通知用户或触发后续动作

### 方案二：插件增强双向通信
如果需要强实时、多 Agent 主动交互：
1. **Hook 层实现通信底座**：用 Plugin 开发消息通道、会话管理、消息注入能力，作为通用基础设施
2. **Skill 层定义协作规则**：用 Skill 约定消息格式、交互流程、异常处理、协作边界，Agent 按 Skill 规范进行通信
3. **原生 Agent 作为执行器**：General、Explore 等原生 Agent 作为通信节点，不需要修改 Agent 本身的人设与提示词

---

## 四、原生边界与扩展空间总结
| 通信场景 | 原生官方支持 | 扩展实现方式 |
|---|---|---|
| 父 Agent → 子 Agent 发起任务 | ✅ 原生 `task` 工具 | - |
| 子 Agent → 父 Agent 返回最终结果 | ✅ 一次性返回 | - |
| 父子 Agent 中途实时双向消息 | ❌ 不支持 | Plugin Hook + 会话消息注入 |
| 主 Agent 之间主动互通 | ❌ 不支持 | Server API + 跨会话消息插件 |
| 子 Agent 之间并行协作 | ❌ 不支持 | 消息总线插件 + Skill 协作规范 |

最终结论和你的判断完全一致：OpenCode 原生只提供了最基础的 Agent 执行器与单向调用能力，而真正的复杂协作、双向通信、流程治理，全部可以通过 **Skill 定义规则 + Hook 扩展能力** 的组合来实现，原生 Agent 作为标准化执行单元，完全不需要大量自定义 Agent。

**官方信息源**：
- 官方 Agent 文档：https://opencode.ai/docs/agents/ 、https://open-code.ai/zh/docs/agents
- Task 工具源码参考：`packages/opencode/src/tool/task.ts`
- 插件体系文档：https://opencode.ai/docs/plugins