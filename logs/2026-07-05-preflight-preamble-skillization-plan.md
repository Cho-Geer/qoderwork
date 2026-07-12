# Preflight and subagent preamble skillization plan

**为什么**: `execution-preflight-check` 与 `subagent-preamble.md` 仍保留旧硬门禁文本，可能在代码层瘦身后继续通过 prompt 让弱模型执行 DAG/checklist/gate 前置流程。

**改了什么**:
- `plans/00-overview.md` — 增加 preflight 分级化和 preamble skill 化为 P0 收口项。
- `plans/02-phase1-skill-first.md` — 新增 T1.6/T1.7，要求把 preflight 改成风险分级 micro Skill，并把 preamble 拆成最小 runtime preamble + 按需 Skill。
- `plans/03-phase2-native-agent-dag.md` — 增加 dispatch prompt preamble 瘦身验证，避免 prompt 文案复活 DAG 前置。
- `plans/04-phase3-enforcement-slimming.md` — 新增 prompt-level enforcement 清理任务。
- `plans/06-phase5-legacy-retirement.md` — 增加 preflight/preamble 回归验证集。

**决策**: 不建议把 `subagent-preamble.md` 原文整体变成一个 Skill；应按 progressive disclosure 拆成 `investigation-evidence`、`deliverable-contract` 扩展和状态/attestation reference。
