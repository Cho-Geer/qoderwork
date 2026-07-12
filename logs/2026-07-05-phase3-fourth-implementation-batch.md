# Phase 3 第四批 legacy-adjacent 收敛

**为什么**: 前三批已经把 active runtime 和主要配置拉回 single-policy / skill-first 方向，这一批继续清理仍可能误导执行心智或保留旧模式入口的 legacy 邻接层。

**改了什么**:
- `opencode/work-one/.opencode/scripts/pre-execution-gate.ts` — 本地 compat mode fallback 不再读取 `ENFORCEMENT_MODE`；最外层错误输出改为统一 blocking 语义
- `opencode/work-one/.opencode/scripts/enforcement-mode-check.sh` — 改成 single-policy compatibility helper，不再接受环境变量覆盖；`--json` 输出 compat metadata
- `opencode/work-one/.opencode/skills/dispatch-protocol/SKILL.md` — 描述改为 native `Task` first，`dispatch_subagent` 仅 legacy compat
- `opencode/work-one/.opencode/skills/dispatch-protocol/FULL.md` — protocol 内容从 wrapper-first 改成 native Task first，保留 wrapper 兼容说明
- `opencode/work-one/.opencode/plugin-handlers/after/quality-contract.ts` — 新增 `todo_failure_without_recovery`
- `qoderwork/implementation-plans/phase3-implementation-plan.md` — 记录第四批实施进度

**决策**: 不把这批扩大成“全仓库模式词汇消灭战”，而是优先改运行/指导边界最近的脚本和技能。这样能继续削弱旧心智模型的牵引，但不会一次性引爆 doctor、hook、测试和历史文档的全面回归。
