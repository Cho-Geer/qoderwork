# Dispatch privilege plan sync

**为什么**: `blueprint-dispatch-scope-privilege.md` v2.0 引入 task-level framework maintenance grant，会影响现有 simplification roadmap 的 Phase 0-5 边界和验收口径。

**改了什么**:
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md` — 纳入 `dispatch_privilege` 作为行为型治理的受控例外。
- `plans/00-overview.md` / `plans/01-phase0-baseline-freeze.md` — 增加 exact binding schema 与 grant 表的 P0 基线。
- `plans/02-phase1-skill-first.md` 到 `plans/06-phase5-legacy-retirement.md` — 同步 Skill 提示、native Task 退役边界、enforcement gate、DB Critical 状态和 Super-Admin legacy 边界。

**决策**: 不把框架维护授权写成 CodeGraph exemption；普通任务仍走 native Task，框架维护 MVP 可短期保留 trusted `dispatch_subagent` path，直到 native Task metadata 能安全承载 grant。
