# OpenCode Plugin Hook 与 Skill 配合机制全解析
基于 OpenCode 官方文档与源码实现，Plugin Hook 与 Skill 系统遵循**「Skill 为内置工具、Hook 为全局中间件」**的核心设计：Skill 本身通过原生 `skill` 工具实现按需加载，没有独立的 Skill 专属 Hook，全部联动通过通用插件钩子体系在**配置、调用、权限、会话、消息**五个层面完成横切扩展。

---

## 一、核心配合原理
### 1.1 底层定位
- **Skill 层**：声明式业务能力单元，以 `SKILL.md` 为载体，定义 Agent「应该做什么、按什么规范做」，通过 `skill` 内置工具触发加载，属于标准工具调用范畴。
- **Plugin Hook 层**：过程式运行时扩展点，以 JS/TS 插件为载体，在系统全流程关键节点提供拦截、修改、监听能力，面向横切关注点（安全、审计、管控、增强）。
- **配合范式**：Skill 定义业务工作流，Plugin Hook 管控执行流程 —— Skill 解决「做什么」，Hook 解决「谁能做、什么时候做、执行前后做什么」。

### 1.2 全链路配合节点
Skill 从发现到生效的完整流程中，Plugin Hook 可介入的关键节点如下：
```
配置加载 → Skill 发现 → 会话启动 → 可见性过滤 → Agent 调用 skill 工具
   ↓         ↓          ↓          ↓                ↓
config Hook  —      session Hook  permission Hook  tool.execute.before
                                                          ↓
                                                  读取 SKILL.md 全文
                                                          ↓
                                                  tool.execute.after
                                                          ↓
                                                  注入会话上下文
                                                          ↓
                                                  message.* Hook
```

---

## 二、五大配合维度详解
### 2.1 配置加载阶段：`config` Hook
#### 作用时机
OpenCode 启动加载 `opencode.json` 配置时触发，是最早介入 Skill 体系的钩子。

#### 可操作能力
- 动态追加 Skill 搜索路径（`skills.paths`），实现按环境、按团队注入不同 Skill 集
- 动态修改 Skill 权限规则（`permission.skill`），替代静态配置实现动态权限
- 增删远程 Skill 仓库（`skills.urls`），实现中心化 Skill 分发
- 开关外部兼容模式（对应 `OPENCODE_DISABLE_EXTERNAL_SKILLS`）

#### 代码示例
```typescript
// .opencode/plugins/skill-config.ts
import type { Plugin } from "@opencode-ai/plugin"

export const SkillConfigPlugin: Plugin = async (ctx) => {
  return {
    config: async (config) => {
      // 动态追加企业内部 Skill 仓库
      if (!config.skills) config.skills = {}
      if (!config.skills.urls) config.skills.urls = []
      config.skills.urls.push("https://internal.company.com/skills")

      // 生产环境收紧 Skill 默认权限
      if (process.env.NODE_ENV === "production") {
        if (!config.permission) config.permission = {}
        config.permission.skill = {
          "*": "ask",
          "official-*": "allow",
          "experimental-*": "deny"
        }
      }
    }
  }
}
```

### 2.2 调用执行阶段：`tool.execute.before` / `tool.execute.after`
这是 Plugin 与 Skill 最核心、最常用的配合点。**`skill` 是标准内置工具**，其加载调用完全受工具执行钩子管控。

#### `tool.execute.before`：Skill 加载前拦截
触发于 Agent 调用 `skill({ name: "xxx" })` 之后、实际读取 `SKILL.md` 之前。

**可操作能力**：
- 校验 Skill 名称白名单，阻止未授权 Skill 加载
- 动态替换 Skill 名称，实现别名、版本路由
- 注入额外参数、追加上下文信息
- 记录 Skill 调用审计日志
- 抛出错误终止加载

**代码示例：Skill 白名单管控**
```typescript
export const SkillGuardPlugin: Plugin = async (ctx) => {
  const ALLOWED_SKILLS = new Set(["git-release", "code-review", "test-runner"])

  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool === "skill") {
        const skillName = input.args.name
        if (!ALLOWED_SKILLS.has(skillName)) {
          throw new Error(`Skill "${skillName}" is not allowed in this project.`)
        }
        // 可在此统一注入企业级前置说明
        console.log(`[Audit] Loading skill: ${skillName}`)
      }
    }
  }
}
```

#### `tool.execute.after`：Skill 加载后增强
触发于 `SKILL.md` 读取完成、即将注入会话上下文之前。

**可操作能力**：
- 修改 Skill 正文内容，追加企业规范、合规提示、内部链接
- 对敏感 Skill 内容做脱敏处理
- 包装 Skill 输出格式，统一指令风格
- 记录 Skill 完整内容审计

**代码示例：自动追加企业合规说明**
```typescript
export const SkillAugmentPlugin: Plugin = async (ctx) => {
  return {
    "tool.execute.after": async (input, output) => {
      if (input.tool === "skill") {
        const complianceNote = `
---
## 企业合规补充
- 所有操作必须符合公司数据安全规范
- 涉及生产环境变更必须提交审批单
- 禁止在 Skill 执行中泄露内部密钥
`
        // 在 Skill 原文末尾追加合规内容
        output.output = output.output + complianceNote
      }
    }
  }
}
```

### 2.3 权限管控阶段：`permission.asked` / `permission.replied`
当 Skill 的权限配置为 `ask` 时，加载前会触发用户确认流程，权限钩子可介入该流程。

#### 可操作能力
- 对可信 Skill 自动审批，无需用户手动确认
- 对高风险 Skill 强制二次校验（如追加验证码、审批流）
- 记录所有 Skill 权限决策，形成审计轨迹
- 按时间、环境、Agent 类型动态变更权限结果

#### 代码示例：可信 Skill 自动放行
```typescript
export const AutoApprovePlugin: Plugin = async (ctx) => {
  const TRUSTED_SKILLS = ["git-release", "dependency-check"]

  return {
    "permission.asked": async (input, output) => {
      if (input.permissionType === "skill" && TRUSTED_SKILLS.includes(input.target)) {
        // 自动同意，跳过用户确认
        output.result = "allow"
      }
    }
  }
}
```

### 2.4 会话生命周期：`session.*` 系列 Hook
Skill 的加载与生效与会话生命周期深度绑定，会话钩子可在宏观层面管理 Skill 行为。

| 钩子 | 触发时机 | 与 Skill 的配合场景 |
|---|---|---|
| `session.created` | 新会话（主/子 Agent）创建时 | 初始化会话级 Skill 统计、按会话类型动态注入 Skill 配置 |
| `session.idle` | 会话进入空闲状态 | 统计本次会话 Skill 使用频次、生成使用报告 |
| `session.compacted` | 上下文压缩时 | 控制已加载 Skill 内容的保留/裁剪策略，优先保留核心 Skill |
| `session.deleted` | 会话销毁时 | 清理临时 Skill 缓存、写入最终审计日志 |

> **子 Agent 说明**：子 Agent 通过 `task` 工具创建的独立会话同样会触发完整的会话生命周期钩子，插件可通过 `sessionID` 和 `agent` 信息区分主/子会话，实现差异化管控。

### 2.5 上下文注入阶段：`message.*` 系列 Hook
Skill 加载完成后，其内容以消息片段的形式注入会话上下文，消息类钩子可对该过程做细粒度监听与处理。

#### 可操作能力
- 监听 `message.part.updated`：感知 Skill 内容注入事件，触发后续自动化动作
- 监听 `message.part.removed`：感知 Skill 内容被上下文压缩移除，做持久化备份
- 对 Skill 注入的内容做关键词过滤、敏感信息脱敏
- 统一格式化 Skill 输出的 Markdown 结构

---

## 三、子 Agent 场景下的配合规则
子 Agent 的 Skill 体系完全继承上述配合机制，同时具备以下特性：
1. **统一拦截**：所有子 Agent 的 `skill` 工具调用都会触发 `tool.execute.before/after`，插件无需为子 Agent 做特殊适配。
2. **可区分粒度**：钩子的 `input` 对象包含 `sessionID`、`agent` 信息，可精准判断调用来自主 Agent 还是某类子 Agent。
3. **权限透传**：子 Agent 级别的 Skill 权限规则同样会经过 `permission.*` 钩子，插件可覆盖或增强配置中的权限逻辑。
4. **嵌套兼容**：多级嵌套子 Agent（孙 Agent）的 Skill 调用同样受钩子管控，拦截逻辑天然递归生效。

**示例：仅允许 General 子 Agent 加载调试类 Skill**
```typescript
export const SubagentSkillControlPlugin: Plugin = async (ctx) => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool === "skill" && input.args.name.startsWith("debug-")) {
        // 仅 general 子代理允许使用调试技能
        if (input.agent?.type !== "general") {
          throw new Error("Debug skills are only available for General subagents.")
        }
      }
    }
  }
}
```

---

## 四、典型配合场景汇总
| 场景 | 用到的 Hook | 价值 |
|---|---|---|
| 企业 Skill 统一分发 | `config` | 集中管理 Skill 仓库，无需每个项目单独配置 |
| Skill 调用安全审计 | `tool.execute.before` + `permission.replied` | 全链路记录谁、何时、加载了哪个 Skill |
| 合规内容自动注入 | `tool.execute.after` | 所有 Skill 自动追加企业规范，无需修改 Skill 源码 |
| 动态权限管控 | `permission.asked` | 可信 Skill 自动放行，提升体验；高风险 Skill 强管控 |
| 按 Agent 分级授权 | `tool.execute.before` | 不同子 Agent 授予不同 Skill 集，最小权限原则 |
| Skill 内容脱敏 | `tool.execute.after` + `message.part.updated` | 防止内部 Skill 中的敏感信息泄露到输出 |

---

## 五、Skill 与 Plugin Hook 定位边界
| 维度 | Skill | Plugin Hook |
|---|---|---|
| 载体 | Markdown 文档 | JS/TS 代码 |
| 面向对象 | Agent（LLM 读取执行） | 系统运行时（机器执行） |
| 核心能力 | 定义工作流、规范、最佳实践 | 拦截、监听、修改、增强 |
| 部署方式 | 文件目录即可分发 | 需要插件注册与运行环境 |
| 适用场景 | 业务逻辑、操作指南、审查清单 | 安全管控、审计日志、系统集成、横切逻辑 |
| 编写门槛 | 低，产品/运维可编写 | 高，需要开发能力 |

---

**官方信息源**
- 插件官方文档：https://open-code.ai/zh/docs/plugins
- Skill 官方文档：https://opencode.ai/docs/zh-cn/skills
- 源码参考：`packages/opencode/src/plugin/`、`packages/opencode/src/tool/skill.ts`、`packages/opencode/src/skill/skill.ts`