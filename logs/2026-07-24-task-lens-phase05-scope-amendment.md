# Task Lens PHASE-05 scope amendment

- Why: 用户明确授权 `scripts/task-lens/__tests__/input-diff.test.ts` 作为 `parseCli` caller test 纳入 PHASE-05。
- Changed: PHASE-05 Allowed files 增加该文件；新建 amendment scope-lock，允许路径增加、禁止路径移除。
- Decision: 保留旧 frozen lock、旧 receipt 与无效审计，不覆盖历史哈希链。
- Status: 新 lock 已记录 human approval；仍未生成新的 pre-change receipt，PHASE-05 不得据此标记 ACCEPTED。
- Documents: `plans/task-lens-m1/05-phase-metrics-feedback.md`、`audits/task-lens-m1/scope-lock-PHASE-05-amendment-20260725.json`、本日志。
