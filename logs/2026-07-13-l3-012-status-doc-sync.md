# L3-012 状态收口同步

**为什么**: L3-012 已有 live Orchestrator 证据证明 `safe_shell gh issue create --repo ...` 被 `repo-policy` 首裁决阻断，原文档仍写成未见证/未实施状态。

**改了什么**:
- `e2e/L3-012-safe-shell-gh-remote-write-e2e.md` — 标记 core PASS，记录 session、证据目录、缺失证据包边界和 remote_write 变体缺口
- `e2e/opencode-framework-simplification-e2e-integration-plan.md` — 将 L3-012 从 mandatory open 移出，统计更新为已跑 28 / 未跑 60
- `blueprints/blueprint-tool-governance-mvc-refactor.md` — 校准 Phase 6 core 已闭合、Phase 7 组件/工具边界已实施但 live allow-path 未收口
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md` — 同步 v1.14.5 高层状态与剩余 E2E 边界

**决策**: 只将 L3-012 标为 core PASS，不外推为全部 `gh` remote_write 变体或 Phase 7 live allow-path 完成。
