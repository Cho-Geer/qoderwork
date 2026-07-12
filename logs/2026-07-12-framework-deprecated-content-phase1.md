# work-one 框架废弃内容审计 — Phase 1 实施

**为什么**: 按 blueprint `blueprints/2026-07-12-framework-deprecated-content-audit-blueprint.md` 清理 work-one 过时/废弃内容。蓝图推荐路径第一步=先修 prompt/documentation 漂移；本 turn 只做 doc/prompt 层修复，不碰框架运行时 .ts 代码。

**改了什么**:
- `work-one/AGENTS.md` — 移除 Scout（P0 执行入口规则 L39、子任务派遣规则 L49）；agent 模型表 5 个全部对齐 `opencode.json` 为 `deepseek/deepseek-v4-flash`（原 opencode-go/deepseek-v4-* + volcengine-plan/glm-5.2 均错）；修正 L82 `before-dispatcher` "未接入" 为 active `tool.execute.before` 调度器（其 HANDLER_MAP 与 plugin_execution_order 一致）；before handler 计数 10→11 并补 `path-validate`（L21/L84）；CodeGraph 414→421 files（L25）。
- `work-one/.opencode/legacy/agent-profiles/*.md`（7 文件：Meta-Planner/Super-Admin/Arbiter/Coder-FE/CI-CD-Agent/Coder-BE/Architect）— `Knowledge-Curator / Scout` → `Knowledge-Curator / explore`。
- `qoderwork/documents/native-opencode/{skill,worktree,integration-recommendation}.md` + `review/opencode-framework-architecture-assessment.md` — 标注 Scout 在 OpenCode v2 已废弃，外部调研改用 `explore`（P3）。
- `qoderwork/scripts/framework-inventory.sh` — 新增 Phase 0 证据冻结清单脚本（agents/models/plugins/handler-order + 废弃符号 grep）。

**决策**: 仅 doc/prompt 漂移（蓝图推荐首步）。work-one 工作树 dirty（99 文件，非本次引入），本次改动未提交——选择性 commit 需等工作树进入已知状态或用户确认，避免把他人未提交改动一并带入。Phase 2-5（handler 清单、enforcement mode shim、旧 DAG/pre-execution 脚本、compat API：isWriteAllowed/dbInsertDispatchContext）需 codegraph caller 核实 + serve API 冒烟，留待后续独立 commit。验证：`rg Scout` 在 active 路径仅剩 agent-target.ts 硬拒守卫 + docs/ 历史归档（UC7KS Scout layer，已 @deprecated）。
