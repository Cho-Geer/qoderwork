# Phase 3 第七批：pre-commit 单一策略收敛

**为什么**: `hook-layers.ts` 还残留一批真正参与执行的 `advisory/strict/locked` 分支，导致 Phase 3 的 single-policy 方向只完成了一半，质量信号和关键安全检查仍然混在一起。

**改了什么**:
- `/home/zhaoge/workspace/opencode/work-one/.opencode/hooks/lib/hook-layers.ts` — 去掉 pre-commit 活路径上的 mode 分支；`gate armed` / `gate lifecycle` / `state format` 统一 hard block，`TDD` / `UC7KS docs` / `Keystone` 统一 warn/audit，`critical infrastructure files` 改为仅告警。
- `/home/zhaoge/workspace/qoderwork/implementation-plans/phase3-implementation-plan.md` — 补记第七批实施结果、验证结论和剩余事项。

**决策**: pre-commit 只保留机器可验证且高风险的阻断，把 TDD、文档索引、Keystone 这类质量信号从“模式驱动的全局门禁”改为“可观察的软治理”，这样更符合这次重构的 lightweight + active hook 方针。
