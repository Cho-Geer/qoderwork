# 审计治理 v3 全域契约一致性门

- 原因：局部脚本测试绿灯不能证明模板、规则、Skill 与 consumer 对同一合同有相同解释，也不能证明发现已完整。
- 变更：v3 Blueprint 与 canonical 增加完整 schema family、`v3-required`、surface manifest、findings-first scan、共同 conformance corpus 与错位杀伤测试。
- 决策：历史对象仅以路径隔离，禁止读取其内容；“无开放问题”必须有完整资产覆盖、执行记录、finding 闭合与反例证据。
- 验证：Blueprint、canonical、approval request 已逐个通过非空、内容、格式与 JSON/YAML 解析检查；canonical 含 7 个 REQ、15 个 DC。
- 文档：更新 Blueprint、canonical contract、approval request；新增本日志；待新精确 SHA-256 的人类批准后才可创建 PLAN_SET。
