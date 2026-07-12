# work-one 启动检查发现未记录待提交差异

**为什么**: 新会话启动检查发现 work-one 存在大量未提交差异，现有 `2026-07-04-hybrid-enforcement-implementation.md` 只覆盖 hybrid enforcement 局部改动。先记录快照，避免后续任务误归因。

**改了什么**:
- `.opencode/plugins/*` / `.opencode/plugin-handlers/*` — 旧插件入口大量删除，新增 before/after/system dispatcher 与 handler 目录结构
- `.opencode/service/{enforcement,notification,permission,session,knowledge}/` — 新增或调整 enforcement、通知、权限隔离、session/rule/skill attest、knowledge 相关模块
- `docs/infrastructure/*` — 旧 infrastructure 文档删除，新增认知地图、ACP、DB-canonical、enforcement、tool reference、SSE 等专题文档
- `.opencode/agents/*` / `.opencode/skills/*` / `opencode.json` — Agent、Skill、权限和项目配置存在批量更新

**决策**: 这是启动阶段的观察性补记，不声明这些 work-one 变更由本轮产生；后续如需继续处理，应先基于当前 diff 和代码验证具体来源。
