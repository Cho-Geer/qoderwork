# Framework simplification plans refreshed

**为什么**: `plans/` 仍按 2026-07-07 旧基线和分支式措辞组织，未纳入 schema v37、gate-call-context、framework maintenance plan gate 等当前代码事实。

**改了什么**:
- `plans/opencode-framework-simplification-roadmap/00-overview.md` 到 `plans/opencode-framework-simplification-roadmap/06-phase5-legacy-retirement.md` — 重写为单一路线、固定步骤、明确验收门槛。
- `plans/*.md` — 更新 live 基线为 CodeGraph 395 files、active TS 350/74665、before/after/system 9/7/2、DB schema v37/50 total tables。

**决策**: 不保留选择项和推荐项；framework maintenance 固定为 grant -> CodeGraph -> framework_maintenance_plan -> safe_framework_edit -> framework_maintenance_complete。
