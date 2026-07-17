# 权限模板驱动 Enforcement Blueprint

**为什么**: P1 #3 的 `getAgentShellAllowlist` 迁移不能只删除 caller，否则会把 per-agent 白名单静默改成全局黑名单；需要先固定模板边界、验证层级和 P1 #5 的 legacy 退役依赖。

**改了什么**:
- `blueprints/blueprint-permission-template-driven-enforcement.md` — 新建两阶段实施方案，定义 default/trusted/confirm、固定安全内核、文件清单、三层验证与回滚。
- `blueprints/blueprint-permission-template-refactor.md` — 将旧 placeholder 指向新 blueprint，避免双权威源。

**决策**: 采用 `project.config.json.permission_templates` + `opencode.json.agent.*.options.permission_template`；实测否决 direct `agent.permission_template`（OpenCode 1.17.18 resolved config 会丢弃）。dangerous shell/protected path/CodeGraph/repo write 不可被模板覆盖，`agent_dangerous_bypass` 必须退役。
