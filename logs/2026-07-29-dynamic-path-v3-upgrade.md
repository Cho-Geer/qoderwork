# 2026-07-29 — 路径动态化 blueprint + M1 plan v3 前置修复

## 为什么
审阅发现 blueprint 头部状态失实（`已完成` 但 plan 从未实施）+ plan provenance 过期（`v2.1-required` 已被 v3 取代）+ plan 缺 v3 必填字段，导致 `validate-plan.ts` 无法通过。直接实施会违反 P-01，审计判 INVALID。

## 改了什么
- B1 `blueprints/blueprint-dynamic-path-resolution.md` L5：`已完成` → `待实施`（设计已审计但实施未开始；PHASE-03 批量回填误标纠正）。
- B2 `blueprints/INDEX.md` L18：状态同步 `待实施`，备注更新，与 `documents/INDEX.md` L39 一致。
- P2 `plans/path-dynamic-resolution-m1/00-plan-index.md` 头部：`v2.1-required` → `v3-required`；新增 `Schema version` / `Document kind` / `Canonical contract`+SHA / `Approval decision`+SHA（pending）共 7 个 v3 字段。
- P4 新建 `plans/path-dynamic-resolution-m1/canonical-requirements-contract.yaml`（5 REQ + 5 DEC + non-goals），SHA `0c939357...` 回填 plan-index。

## 决策
- Approval SHA 标记 `PENDING-HUMAN-APPROVAL`：plan 尚未获 human approval，`approval-decision.json` 不存在是预期；P-02 禁止 agent 自批准。validator 在 pending 状态下仍报错——正确的 fail-closed。
- 不追溯改写 blueprint 设计内容（§1-§6 经审计未过时）。
- 不修改 plan phase 内容（01-04+99 无冲突且合理）。
- Batch B 阻塞项：human reviewer 批准 → 创建 approval-decision.json → 回填 SHA → validate-plan exit 0 → 方可进入 PHASE-01。

## 更新文档
- blueprint-dynamic-path-resolution.md（状态纠正）、blueprints/INDEX.md（行同步）、00-plan-index.md（v3 头部升级）、canonical-requirements-contract.yaml（新建）、本日志、logs/INDEX.md（同步）
- `logs/INDEX.md`（同步）