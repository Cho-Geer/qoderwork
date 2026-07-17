# 权限模板 Enforcement 测试式样书

**为什么**: P1 #3/#5 迁移涉及权限、执行与弱模型交付链；先定义独立 oracle 和对抗性测试，避免把局部单测当成正确性证明。

**改了什么**:
- `e2e/permission-template-enforcement-test-spec.md` — 新增 14 条原子需求、38 个设计态测试、7 个对抗性 charter、环境隔离与执行 gate。
- `logs/2026-07-14-permission-template-test-specification.md` — 记录本次设计交付的原因与边界。

**决策**: 将 runtime Skill 未部署、confirm 一次性授权、trusted unknown-command 矩阵显式保留为 BLOCKED/OPEN；不以已有 52 个基线测试或当前服务健康替代新方案证据。
