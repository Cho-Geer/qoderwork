# 审计治理 v3 独立基线

- 原因：现有 active 基建存在 schema、receipt、预检与发布链的多重解释，且 legacy profile 会成为未来旁路。
- 变更：创建 v3 Blueprint、canonical requirements contract 与等待人类决策的 approval request。
- 决策：v3 不读取、不兼容、不迁移任何 pre-v3 Plan/profile；active 链只接受 v3 schema family。
- 设计：canonical、projection、receipt、matrix 与 approval 各有唯一 schema_version/document_kind，并由共享 parser 统一解释。
- 验证：在干净 v3 worktree 运行 validate-plan 24 pass/0 fail、boundary-precheck 2 pass/0 fail；新文本已完成非空、内容、格式与解析检查。
- 文档：新增 Blueprint、canonical contract、approval request；待人类按精确 SHA-256 批准后才可创建 PLAN_SET。
