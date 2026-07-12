# opencode-framework-dev skill current-code refresh

**为什么**: work-one 和 qoderwork 近期变更较大，`.qoder/skills/opencode-framework-dev` 仍含旧多自定义 Agent、旧 plugin 数量、ACP 默认验证和 `read_skill` 等过时假设。

**改了什么**:
- `.qoder/skills/opencode-framework-dev/SKILL.md` — 重写为 v2.1.0，新增 2026-07-07 current truth snapshot、证据等级、dispatch privilege、question guidance、serve API 和 blueprint audit 规则
- `.qoder/skills/opencode-framework-dev/reference.md` — 新增 current truth overlay，修正旧 Agent 权限矩阵脚本、`.md` 能力声明脚本和 ACP token 章节

**决策**: 以 `.qoder/skills` 为 canonical；`.agents`/`.workbuddy` 同步因当前权限策略拒绝，未强行绕过。
