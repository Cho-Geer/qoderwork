# OpenCode 扫描路径实证 + Agent 数量校准

**为什么**: 用户问"启动时自动扫描哪些目录、skill/mcp/agent 放哪"。排查中发现 AGENTS.md §1 声称"10 个 agent"与 opencode.json 实测（5 个）严重不符，且顶层配置键名（单数 plugin/agent）被旧文档误写为复数。需用平台二进制证据校准。

**改了什么**:
- `AGENTS.md` §1 — 拆分为"实际运行态"（opencode.json 实测）+ "设计蓝图"（历史架构），标注配置键单数、agent 实际 5 个、tool 实际 37 个、skill 实际 18 个
- `MEMORY.md` — 新增两条结论性知识：(1) OpenCode 平台扫描路径表（skill/agent/command 目录扫描，plugin 半自动，mcp 纯配置）；(2) opencode.json 键名单数 + agent 实际 5 个

**决策**:
- 不删除"设计蓝图"段落，保留为历史参考，但明确标注"非当前运行态"
- 证据来源：从 `/home/zhaoge/.opencode/bin/opencode` 二进制 strings 提取到字面量 `.opencode/skills/my-skill/SKILL.md`、`.opencode/agents/my-reviewer.md`、`~/.agents/skills/<name>/SKILL.md` 等，确认扫描机制
- 配置现状来源：python json 解析 opencode.json，顶层键 `plugin`(list) / `agent`(dict, 5 keys) / `mcp`(dict, 12 keys)
- 纠正 2（10→5 agent）不在本轮展开排查"为何精简"，只记录事实差异，避免范围蔓延

**证据要点**:
- Skill/Agent/Command = 目录扫描自动发现（约定优于配置）
- Plugin = 半自动（目录 + opencode.json `plugin:[]` 显式声明）
- MCP = 纯配置注册（无文件扫描）
- work-one/.opencode/agents/ 只有 Orchestrator.md；build/general/plan/explore 是 native（平台内置，无 .md）
