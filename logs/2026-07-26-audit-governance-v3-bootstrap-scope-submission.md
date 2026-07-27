# 审计治理 v3 Genesis Bootstrap scope-lock 提交

- 记录 v3.2 设计批准后的 Genesis Admission 与冻结 scope-lock；二者均不授权代码写入。
- Admission 内嵌并哈希绑定当前 v3-only 拒绝 probe；复核发现 `|-` 会改变两个 fixture 的末尾换行及 SHA，已改为准确保留内容的 block-scalar 编码并重新验证三份嵌入内容哈希。
- scope-lock 的 allowlist 限为 shared parser、其单元测试、PLAN_SET validator 与测试、PLAN_SET template 五项；固定检查逐项映射 REQ/DC/oracle，CodeGraph 影响摘要提供可复算规范化 JSON 与哈希；其余 A–D 基建仍留给后续正式 v3 PLAN_SET phases。
- scope-lock 当前为 `FROZEN_PENDING_HUMAN_APPROVAL`，pre-change capture 为 `NOT_CREATED`；未创建 receipt、report 或 LATEST，未改动任何 `.ts` 文件。
- 后续唯一安全动作：人类批准 scope-lock 精确 SHA-256，生成独立 scope approval 后再创建 pre-change capture。

## 更新文档

- `audits/audit-governance-evidence-and-status-closure-v3/genesis-bootstrap-admission.yaml`
- `audits/audit-governance-evidence-and-status-closure-v3/genesis-bootstrap-scope-lock.yaml`
