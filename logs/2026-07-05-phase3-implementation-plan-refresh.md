# Phase 3 implementation plan 对齐最新 blueprint/plans

**为什么**: `implementation-plans/phase3-implementation-plan.md` 仍停留在早期 behavioral-path-guard + per-agent 删除方案，未吸收最新 single policy、prompt-level cleanup、native Task、Context7/Scout/TodoWrite 软治理边界。

**改了什么**:
- `implementation-plans/phase3-implementation-plan.md` — 重写为 Phase 3 enforcement 热路径瘦身与行为型治理实施方案
- `implementation-plans/phase3-implementation-plan.md` — 将旧 allow-all 表述改为 permission reader legacy neutral/fail-open，不允许绕过硬安全链
- `implementation-plans/phase3-implementation-plan.md` — 增加 prompt-level enforcement、dispatch token native compatibility、Context7/Scout/TodoWrite warn/audit 规则和 smoke test

**决策**: Phase 3 不只删除 per-agent 检查，还必须收敛全局模式、清理旧 prompt 门禁、兼容原生 Task，并把质量类机制统一降级为可观察 warn/audit。
