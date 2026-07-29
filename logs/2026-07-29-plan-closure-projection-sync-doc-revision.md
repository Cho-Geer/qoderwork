# 2026-07-29 — plan-closure-projection-sync 文档补正（doc-revision）

## 为什么
原日志 `2026-07-29-plan-closure-projection-sync.md` 只声明 R3+R4 两文件改动与 R5 决策；审计（仅读验证）发现同顺带实际触发了 2 项额外合规变更未在"更新文档"中列出，违反 AGENTS.md §11.1「更新文档」完整性。补正而不追溯改写原日志。

## 改了什么
- A1 `plans/blueprints-governance/formal-plan-set/00-plan-index.md` L11：原"内嵌长描述（decision_id + APPROVED + 时间 + 多 sha 绑定）"拆为 pointer 行 + 独立 `**Approval decision SHA-256**: dab207ce…` 行，结构与 closure-v3 plan-index L11-12 完全一致；**恰好修复原日志 L13 标注的 `ERR_APPROVAL_MISSING×2`**。
- A2 `logs/INDEX.md` 头部 Last-updated 标题从"M9 停滞扫描实施"改写为本次主题；2026-07-29 计数 2→3；新增 plan-closure-projection-sync 条目。
- A3 `logs/` 新增本日志（doc-revision 本身）。

## 决策
- **不追溯改写**原日志（fail-closed：原日志是审计真相源，追溯改写会破坏 §11.5 冻结语义）。
- 仅追加"修订日志"声明额外变更来源，符合 §11.1「写决策」。
- A1 修复未触碰 §11.5 冻结事实文件（`audits/blueprints-governance/approval-decision.json` SHA 仍 `dab207ce…`，未变）。
- 范围限定：仅治理收尾期状态投影同步；未触及任何 `audits/` 冻结记录。

## 更新文档
- `plans/blueprints-governance/formal-plan-set/00-plan-index.md`（声明 + SHA 拆字段）
- `logs/INDEX.md`（Last-updated + 新条目）
- `logs/2026-07-29-plan-closure-projection-sync-doc-revision.md`（本日志，新增）