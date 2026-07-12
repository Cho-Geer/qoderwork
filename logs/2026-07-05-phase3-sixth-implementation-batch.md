# Phase 3 第六批 hook 入口收敛

**为什么**: 前五批已经清到 runtime、配置、脚本和命令层，这一批继续削弱 commit hook 入口对旧 `advisory/strict/locked` 心智的依赖，并把非安全关键的 commit-msg 门槛降级为 warn/audit。

**改了什么**:
- `opencode/work-one/.opencode/hooks/lib/hook-layers.ts` — `ENFORCEMENT_MODE` downgrade 改为 ignored notice + warn log，不再阻断提交
- `opencode/work-one/.opencode/hooks/lib/hook-commit-msg.ts` — `ENFORCEMENT_MODE` downgrade 改为 ignored notice；INFRA marker/TDD marker/前序 TDD 阶段缺失从 hard block 收敛为 warn/audit
- `qoderwork/implementation-plans/phase3-implementation-plan.md` — 记录第六批实施进度与验证限制

**决策**: 这一批只降级非安全关键的 commit-msg 门槛，继续保留 mixed infra/business 和 business+uncommitted-infra 这两类真正影响审计清晰度和变更边界的 hard block。Hook 真实 smoke 因沙箱写 `.task_temp/_logs/` 命中 `EROFS`，本轮只记录为验证限制，不改运行时日志路径策略。
