# QoderCN Memory

精炼的长期参考知识。写"结论"不写"过程"。

## work-one 架构: OpenCode 平台扫描路径（2026-07-08 二进制 strings 验证）

| 类型 | 项目级（CWD） | 用户级 | 发现方式 |
|------|--------------|--------|---------|
| Skill | `.opencode/skills/<name>/SKILL.md` | `~/.agents/skills/`、`~/.claude/skills/` | 目录扫描自动发现 |
| Agent | `.opencode/agent(s)/<name>.md`（单复数两种都支持） | — | 目录扫描自动发现 |
| Command | `.opencode/command(s)/<name>.md` | — | 目录扫描自动发现 |
| Plugin | `.opencode/plugins/*.ts` | — | **半自动**：需在 `opencode.json` 的 `plugin` 数组显式声明路径 |
| MCP | 无文件扫描 | — | 纯配置：`opencode.json` 的 `mcp` 对象 |
| Tool | `.opencode/tools/*.ts` | — | 由 plugin 注册加载 |

## work-one 架构: opencode.json 配置键名与实际 agent 数

- 顶层键是**单数**：`plugin`（路径数组）、`agent`（对象）、`mcp`（对象）。AGENTS.md 旧版写的 `plugins`/`agents` 不准确，已校准。
- **实际运行 5 个 agent**：Orchestrator（自定义）+ build/general/plan/explore（native，无 .md）。设计蓝图的"10 角色"（Architect/Coder-BE/Coder-FE/Guardian/Arbiter/CI-CD/Super-Admin/Knowledge-Curator/Meta-Planner）**未在 opencode.json 注册**，仅存在于文档和 Orchestrator prompt 文本中。
- 判断 work-one 当前能力时，以 `opencode.json` 实测为准，不以文档描述的"三层十角色"为准。

## work-one 规则: 不确定时禁止下确定性结论

当对某个事实不确定时，必须先彻底排查（搜索所有可能的路径/配置），再给出结论。不要在排查不充分的情况下说"没有"或"不存在"。本次会话连续犯了 4 个错误（混淆身份路径、错误否定 Skill 扫描路径、搜错目录名、遗漏明显目标），全部源于此问题。

## work-one 约定: QoderCN 目录命名区分

- 用户级配置目录：`~/.qoder-cn/`（带 `-cn` 后缀）
- 项目级配置目录：`.qoder/`（不带后缀，与 QoderCLI 相同）
- 项目级 Skill 路径：`.qoder/skills/{name}/SKILL.md`
- 不要把两者命名搞混

## work-one 约定: QoderCN Skill 扫描路径

| 级别 | 路径 | 说明 |
|------|------|------|
| 内置 | 平台自带（11 个） | simplify, security-review, quest 等 |
| 用户级 | `~/.qoder-cn/skills/` | 当前不存在，需手动创建 |
| 项目级 | `.qoder/skills/` | 活跃，21 个 Skill + 12 个 .merged 备份 |
