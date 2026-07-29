# 2026-07-29 — 路径动态化 blueprint + plan 复审修正

## 为什么
复审发现 3 处失实/过时：(1) PHASE-04/99 两处 `validate-plan.ts` 命令缺 governanceRoot 参数（SKILL rule 12a 要求，否则命令按字面执行会失败）；(2) 99 final verification 状态列"run while authoring"过时（v3 升级后实测为 ERR_APPROVAL_MISSING）；(3) blueprint §1.2 历史快照漏记 `.codebuddy/settings.json`——`git ls-files` 实测已跟踪 IDE 配置为 4 个（与 plan "four tracked" 一致）。

## 改了什么
- U1 `04-phase-runtime-handoff.md` L99：validate-plan.ts 命令补 governanceRoot 参数（check-plan worktree 路径）。
- U2 `99-final-verification.md` L7：命令补 `<governanceRoot>` 占位 + 前置条件注 SKILL rule 12a；状态列由"run while authoring"更正为"FAIL ERR_APPROVAL_MISSING（pending human approval）；v3 schema + governanceRoot + canonical contract PASS"。
- U3 `blueprint-dynamic-path-resolution.md` §6.1 追加 2026-07-29 复审段（扫描漂移 2500/610、IDE 4 个更正、状态/provenance 纠正记录）；更新日期 → 2026-07-29。不回改 §1.2 历史快照（fail-closed：标注日期快照保持原样，更正记入 §6.1）。

## 决策
- 历史快照不回改：§1.2 是"2026-07-25 现状快照"，显式标注"可复现快照而非永久常数"；更正追加到 §6.1 审计记录段，保持追溯链完整。
- IDE 计数以 `git ls-files` 实测为准（4 个），plan 的"four tracked"正确，blueprint §1.2 的 3 个为快照漏记。
- validate-plan.ts 命令文本中 governanceRoot 用 worktree 绝对路径（check-plan），因 plan 在此 worktree 编写且将在此实施；rule 12a 要求 governanceRoot = plan 所在 qoderwork worktree。

## 更新文档
- 04-phase-runtime-handoff.md、99-final-verification.md、blueprint-dynamic-path-resolution.md、本日志、logs/INDEX.md（同步）