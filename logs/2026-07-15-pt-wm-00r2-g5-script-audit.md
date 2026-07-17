# PT-WM-00R2 G5 脚本证据复核

**为什么**: 审核“测试完成”声明，区分 12 个 DRY_RUN 计划 artifact 与实际 oracle 执行，并验证 4097 question 的当前可访问性。

**改了什么**:
- `blueprints/blueprint-permission-template-driven-enforcement.md` — 升级 v1.6.0；记录 G5 dry-run 边界、T-PT-042 runner 偏差和 4097 状态未验证。
- `e2e/permission-template-enforcement-test-spec.md` — 升级 v1.5.0；将 12 个计划 artifact 保持为不改变执行裁决，并把 T-PT-042 runner 标为 INVALID。

**决策**: 12 个脚本和 evidence/checklist 目录存在，且均为 `dryRun:true`；仅 T-PT-048 有 4 个静态 fixture-shape 支持断言，其真实 oracle 仍未执行，不能升级 test ID。先修 T-PT-042 的固定 allowlist，再申请隔离 serve 真跑；不修改 work-one 代码。
