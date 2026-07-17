# 隔离 Serve 测试基建实施审计

**为什么**: 已实施 `scripts/test-serve/`，需要按 Blueprint 区分组件、runtime smoke 与 live LLM E2E，并据实更新状态。

**改了什么**:
- `blueprints/blueprint-isolated-serve-test-infrastructure.md` — 增加 2026-07-15 实施审计表、已执行证据、P0 修复顺序；状态改为部分实施。
- `documents/INDEX.md` — 标注基础 CLI 已落地但不可用于关闭 live LLM E2E。
- `logs/2026-07-15-isolated-serve-test-infrastructure-audit.md` — 记录审计边界。

**决策**: 保留 `test-serve` 的 8/8 component 与无 LLM lifecycle/bootstrap runtime smoke；不将其扩大为全量隔离完成。优先修复主 work-one privilege import、cleanup/log 归档和全 runner 迁移后，再申请 H2 live 测试。
