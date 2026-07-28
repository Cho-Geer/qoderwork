# 审计治理 v3 Genesis Bootstrap Admission 契约修订

- 原因：隔离 v3 probe 被当前 `validate-plan.ts` 拒绝，形成“先准入才可实现准入器”的自举循环。
- 变更：Blueprint v3.2 与 canonical 新增一次性 Genesis Bootstrap Admission、scope-lock、receipt、状态机和 REQ-008/DC-016~019。
- 控制：保留冻结范围、人类批准、pre-change capture、固定正负例、独立审计、后验 v3 验证与正式 PLAN_SET 再准入；不产生 phase ACCEPT、report 或 `LATEST.md`。
- 禁止：pre-v3 输入、兼容层、通用 bypass、第二次 bootstrap，以及未获新 SHA 批准前的任何代码写入。
- 历史批准：原 approval decision 只读保留；本修订请求新的 hash-bound 决定。
- 文档：更新 Blueprint、canonical requirements contract、approval request、logs/INDEX.md。
