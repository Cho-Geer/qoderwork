# OpenCode Agent Skill 全链路机制：发现 / 加载 / 调用（主Agent + 子Agent 整合版）
本文基于 OpenCode 官方文档与源码实现，完整梳理 OpenCode Agent 系统中 Skill 的**发现、加载、调用**全链路机制，并明确主 Agent 与子 Agent（Subagent）在各环节的共享规则与隔离边界。

OpenCode Skill 系统核心设计原则：**全局统一发现 + 按 Agent 权限过滤 + 会话级按需加载**。主 Agent 与子 Agent 共享底层 Skill 发现池，但在可见性、上下文继承与生命周期上有明确的隔离规则。

---

## 一、Skill 发现机制（Discovery）
### 1.1 全局统一发现规则（主/子 Agent 共享底层）
所有 Skill 由 OpenCode 进程启动时统一扫描发现，形成全局 Skill 元数据池，主 Agent 与所有子 Agent 共用同一个发现来源，子 Agent 不会单独执行目录扫描。

#### 六大搜索路径
OpenCode 会在以下位置自动扫描 `SKILL.md` 定义文件，每个 skill 对应一个独立文件夹，文件夹名必须与 `SKILL.md` 中 `name` 字段完全一致。

| 层级 | 路径 | 说明 |
|---|---|---|
| 项目级 | `.opencode/skills/<name>/SKILL.md` | OpenCode 原生项目目录 |
| 全局级 | `~/.config/opencode/skills/<name>/SKILL.md` | OpenCode 原生全局目录 |
| 项目级 | `.claude/skills/<name>/SKILL.md` | Claude Code 兼容路径 |
| 全局级 | `~/.claude/skills/<name>/SKILL.md` | Claude Code 兼容全局 |
| 项目级 | `.agents/skills/<name>/SKILL.md` | Agent 规范兼容路径 |
| 全局级 | `~/.agents/skills/<name>/SKILL.md` | Agent 规范兼容全局 |

#### 发现顺序与覆盖规则
Skill 按以下优先级顺序发现，**后发现的同名 skill 会覆盖先发现的**：
1. 全局外部 skill（`~/.claude/skills/`、`~/.agents/skills/`）
2. 项目外部 skill（从当前目录向上遍历至 git worktree）
3. OpenCode 原生 skill（`.opencode/skills/` 目录）
4. 额外配置路径（`opencode.json` 中 `skills.paths`）
5. 远程 skill 仓库（`opencode.json` 中 `skills.urls`）

#### 目录遍历机制
对于项目本地路径，OpenCode 从**当前工作目录**开始，**逐级向上遍历**直到抵达 git worktree 根目录。沿途所有匹配的 `skills/*/SKILL.md` 都会被加载。

#### 源码实现（skill/skill.ts）
```typescript
export const state = Instance.state(async () => {
  const skills: Record<string, Info> = {}
  const dirs = new Set<string>()

  // 1. 扫描外部兼容目录 (.claude/skills/, .agents/skills/)
  if (!Flag.OPENCODE_DISABLE_EXTERNAL_SKILLS) {
    // 全局优先
    for (const dir of EXTERNAL_DIRS) {
      const root = path.join(Global.Path.home, dir)
      await scanExternal(root, "global")
    }
    // 项目级（向上遍历目录树）
    for await (const root of Filesystem.up({
      targets: EXTERNAL_DIRS,
      start: Instance.directory,
      stop: Instance.worktree,
    })) {
      await scanExternal(root, "project")
    }
  }

  // 2. 扫描 .opencode/skills/ 目录
  for (const dir of await Config.directories()) {
    const matches = await Glob.scan(OPENCODE_SKILL_PATTERN, { cwd: dir })
    for (const match of matches) await addSkill(match)
  }

  // 3. 扫描配置中的额外路径
  for (const skillPath of config.skills?.paths ?? []) {
    const resolved = resolveSkillPath(skillPath)
    const matches = await Glob.scan(SKILL_PATTERN, { cwd: resolved })
    for (const match of matches) await addSkill(match)
  }

  // 4. 从远程 URL 下载并加载
  for (const url of config.skills?.urls ?? []) {
    const list = await Discovery.pull(url)
    for (const dir of list) {
      const matches = await Glob.scan(SKILL_PATTERN, { cwd: dir })
      for (const match of matches) await addSkill(match)
    }
  }

  return { skills, dirs }
})
```

### 1.2 子 Agent 视角的发现规则
- **无专属发现路径**：不存在 `.opencode/agents/<name>/skills/` 这类子 Agent 专属 Skill 目录，所有 Skill 全局共享，通过权限规则做可见性隔离。
- **按权限过滤可见性**：每个子 Agent 在 `skill` 工具描述中看到的 `<available_skills>` 列表，是全局 Skill 池经过该 Agent 权限规则过滤后的结果：
  - `deny`：Skill 完全从工具描述中移除，子 Agent 感知不到该 Skill 的存在
  - `ask`：Skill 可见，但调用加载前会弹出用户确认
  - `allow`：Skill 直接可见，可自主调用加载
- **发现时机**：子 Agent 会话启动时，一次性计算并注入过滤后的 Skill 清单；运行中全局 Skill 池变更不会实时同步到已启动的子会话。

---

## 二、Skill 加载机制（Loading）
### 2.1 通用加载规则（主/子 Agent 通用）
#### 按需加载（On-Demand）
Skill **不会预先全部加载**。启动时仅解析每个 skill 的 YAML frontmatter，提取 `name` 和 `description` 元数据。完整的 `SKILL.md` 正文内容只有在 Agent 决定使用时才通过 `skill` 工具调用加载。这种设计避免了大量 skill 内容挤占上下文窗口。

#### SKILL.md 文件结构
每个 skill 由 YAML frontmatter + Markdown 正文组成：
```yaml
---
name: git-release           # 必需：技能名（1-64字符，小写+连字符）
description: Create consistent releases and changelogs  # 必需：1-1024字符
license: MIT                # 可选
compatibility: opencode     # 可选
metadata:                   # 可选：键值对元数据
  audience: maintainers
  workflow: github
---

## What I do
- Draft release notes from merged PRs
- Propose a version bump

## When to use me
Use this when you are preparing a tagged release.
```

#### 名称验证规则
`name` 字段必须满足正则 `^[a-z0-9]+(-[a-z0-9]+)*$`：
- 1–64 字符，小写字母 + 数字，单连字符分隔
- 不能以连字符开头或结尾，不能有连续连字符
- 必须与所在目录名完全一致

#### 全局权限控制基线
通过 `opencode.json` 中的模式匹配权限控制 skill 可见性与加载行为，支持通配符匹配：
```json
{
  "permission": {
    "skill": {
      "*": "allow",
      "pr-review": "allow",
      "internal-*": "deny",
      "experimental-*": "ask"
    }
  }
}
```

### 2.2 子 Agent 专属加载特性
#### 独立会话，不继承父上下文
子 Agent 通过 `task` 工具启动**独立会话**，拥有完全隔离的上下文窗口：
- 父 Agent 已经加载到自身上下文的 Skill，**不会自动传递**给子 Agent
- 子 Agent 必须主动调用 `skill({ name: "xxx" })` 工具，才能将对应 Skill 内容注入自己的会话
- 加载逻辑与主 Agent 完全一致：启动时仅注入元数据（名称+描述），调用时才读取 `SKILL.md` 全文

#### 加载生命周期
1. **会话创建**：子 Agent 启动时，注入权限过滤后的 `<available_skills>` 列表到工具描述
2. **按需触发**：子 Agent 自主判断任务相关性，调用 `skill` 工具触发加载
3. **上下文注入**：OpenCode 读取 Skill 全文，注入到当前子会话的上下文中
4. **会话销毁**：子 Agent 任务完成、会话结束后，已加载的 Skill 随会话一同销毁，不影响父 Agent 或其他子 Agent

#### 嵌套子 Agent 的加载规则
子 Agent 可以继续调用 `task` 工具生成下一级子 Agent（孙 Agent），每一级都独立执行：
- 独立的 Skill 可见性过滤
- 独立的按需加载
- Skill 不会沿调用链向下自动传递

---

## 三、Skill 调用机制（Calling）
### 3.1 通用调用流程（主/子 Agent 通用）
#### 工具描述注入
在每个 LLM 请求的 system prompt 中，`skill` 工具的描述里会附带所有可用 skill 的清单（XML 格式），Agent 通过阅读这些 `description` 来判断哪个 skill 与当前任务相关。
```xml
<available_skills>
  <skill>
    <name>git-release</name>
    <description>Create consistent releases and changelogs</description>
  </skill>
  <skill>
    <name>code-review</name>
    <description>Comprehensive code review with security checks</description>
  </skill>
</available_skills>
```

#### Agent 自主调用
当 Agent 判断需要使用某个 skill 时，调用原生 `skill` 工具：
```javascript
skill({ name: "git-release" })
```
调用后，`SKILL.md` 的完整正文内容会被**注入到当前会话上下文**中，Agent 即可按照 skill 定义的流程和规范执行任务。

#### 基础调用时序
```
用户提问
   ↓
LLM 分析任务 + 查看 <available_skills> 列表
   ↓
判断是否需要 skill → 不需要 → 直接回答
   ↓ 需要
调用 skill({ name: "xxx" }) 工具
   ↓
OpenCode 读取 SKILL.md 全文
   ↓
将 skill 内容注入对话上下文
   ↓
LLM 根据 skill 指令继续执行任务
```

### 3.2 主 Agent 调用特性
- **工具默认开启**：主 Agent 默认启用 `skill` 工具，可通过配置全局关闭。
- **权限基线**：以全局 `permission.skill` 规则作为默认可见性依据。
- **加载持久化**：已加载的 Skill 在整个主会话周期内持续生效，无需重复调用。

### 3.3 子 Agent 调用特性
#### 工具级粒度开关
子 Agent 的 `skill` 工具本身可被整体启用或禁用：
- **JSON 配置**：`agent.<name>.tools.skill: false` 完全关闭 Skill 系统
- **Markdown frontmatter**：在 Agent 定义文件中设置 `tools.skill: false`

禁用后，`<available_skills>` 区块从工具描述中彻底移除，子 Agent 无法感知 Skill 系统的存在。

#### 权限覆盖规则
权限遵循「全局基线 + Agent 级覆盖」的层级，子 Agent 完全适用：
1. 全局 `permission.skill` 为默认基线
2. 子 Agent 级 `permission.skill` 覆盖全局规则
3. 支持通配符匹配，**最后匹配的规则生效**

**配置示例：JSON 方式**
```json
{
  "agent": {
    "code-reviewer": {
      "mode": "subagent",
      "permission": {
        "skill": {
          "*": "deny",
          "code-review-*": "allow",
          "security-scan": "ask"
        }
      }
    }
  }
}
```

**配置示例：Markdown Agent frontmatter**
```yaml
---
mode: subagent
description: 专项代码审查代理
permission:
  skill:
    "*": deny
    "code-review-*": allow
    "security-scan": ask
---
```

#### 内置子 Agent 的默认状态
| 内置子 Agent | skill 工具默认状态 | 说明 |
|---|---|---|
| General | 开启 | 全功能工作代理，除 todo 外拥有完整工具权限 |
| Explore | 开启 | 只读代码探索代理，修改类 Skill 受文件权限限制 |
| Scout（已废弃） | 关闭 | 原外部调研代理；OpenCode v2 已不内置，外部调研请改用 `explore` |

#### 子 Agent 完整调用时序
```
父 Agent 调用 task({ subagent_type: "general", prompt: "..." })
   ↓
创建独立子 Agent 会话
   ↓
应用该子 Agent 的 permission.skill 规则，生成可见 Skill 列表
   ↓
将 <available_skills> 注入 skill 工具描述
   ↓
子 Agent 分析任务，判断是否需要 Skill
   ↓
需要 → 调用 skill({ name: "xxx" }) → 注入 Skill 全文 → 继续执行
   ↓
不需要 → 直接执行任务
   ↓
子 Agent 返回结果给父 Agent，子会话销毁
```

---

## 四、高级配置
### 4.1 额外 Skill 路径
可在 `opencode.json` 中指定自定义 Skill 目录，支持相对路径、绝对路径与家目录路径：
```json
{
  "skills": {
    "paths": [
      "~/shared-skills",
      "./team-skills",
      "/absolute/path/to/skills"
    ]
  }
}
```

### 4.2 远程 Skill 仓库
支持从 HTTP 端点拉取远程 Skill 集合，远程端点需提供 `index.json` 索引文件，Skill 内容下载缓存至 `~/.cache/opencode/skills/`：
```json
{
  "skills": {
    "urls": ["https://example.com/skills"]
  }
}
```

### 4.3 禁用外部兼容
设置环境变量后，不再扫描 `.claude/skills/` 和 `.agents/skills/` 兼容目录，仅使用 OpenCode 原生 Skill 体系：
```bash
export OPENCODE_DISABLE_EXTERNAL_SKILLS=1
```

---

## 五、核心机制对比
### 5.1 Skill vs Command vs Tool
| 维度 | Skill | Command | Tool |
|---|---|---|---|
| 加载方式 | 按需加载，LLM 自主决定 | `/cmd` 手动触发 | 始终可用 |
| 内容形式 | Markdown 指令文档 | 提示词模板 + 参数 | 可执行代码 |
| 适用场景 | 复杂工作流、最佳实践 | 快捷提示词模板 | 系统操作、外部交互 |
| 示例 | 代码审查规范清单 | `/test` 运行测试 | 数据库查询工具 |

### 5.2 主 Agent vs 子 Agent Skill 机制对比
| 维度 | 主 Agent（Primary） | 子 Agent（Subagent） |
|---|---|---|
| 发现范围 | 全局统一 Skill 池 | 全局统一 Skill 池 |
| 可见性过滤 | 全局 + Agent 级权限 | 全局 + Agent 级权限 |
| 上下文继承 | 会话内持久 | 独立会话，不继承父已加载 Skill |
| 工具默认状态 | 默认开启 | 多数内置子 Agent 默认开启，可手动关闭 |
| 加载生命周期 | 随主会话持续 | 随子会话创建/销毁 |
| 跨实例共享 | 无 | 各子会话完全隔离，互不影响 |

---

**官方信息源**
- Skill 官方文档：https://opencode.ai/docs/zh-cn/skills
- Agent 官方文档：https://opencode.ai/docs/agents/
- 源码参考：`packages/opencode/src/skill/skill.ts`、`packages/opencode/src/agent/agent.ts`、`packages/opencode/src/session/prompt.ts`、`packages/opencode/src/tool/skill.ts`