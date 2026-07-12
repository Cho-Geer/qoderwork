# Build Super-Admin 方案审计启动记录

**为什么**: 新会话启动检查发现 work-one 有 3 个未提交框架更新，需要先记录范围再继续审计，避免后续 session 误判当前代码状态。

**改了什么**:
- `.opencode/plugin-handlers/before/codegraph.ts` — 当前 diff 增加 GitHub MCP 写阻断和 repo 操作分类调用。
- `.opencode/plugins/before-dispatcher.ts` — 当前 diff 增加 `github_*` 通配匹配，但仍需审计 `safe_framework_edit` 是否进入 codegraph filter。
- `opencode.json` — 当前 diff 将 `explore` model 从 `deepseek-v4-pro` 改回 `glm-5.2`。

**决策**: 本日志只记录启动发现，不代表接受这些改动正确性；本轮继续以 live code + CodeGraph + DB/日志为准输出 build/Super-Admin 详细实施方案。
