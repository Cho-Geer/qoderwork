# Tasks

- [x] Task 1: RC-4 仓库身份修复（5 错误）
  - [x] 1.1 确认 work-one 仓库当前 HEAD
  - [x] 1.2 确认 work-one 仓库 dirty paths
  - [x] 1.3 修改审计报告 baseline
  - [x] 1.4 确认 pre-change receipt 与 baseline 一致

- [x] Task 2: RC-1 scope-lock 合同重写（6 错误）
  - [x] 2.1 重写 scope-lock：status 改为 FROZEN
  - [x] 2.2 补 approval 对象
  - [x] 2.3 补 plan_registry 数组
  - [x] 2.4 确保 scopeLockProjection 与 frozenProjection 一致
  - [x] 2.5 计算新 scope-lock sha256，更新审计报告
  - [x] 2.6 需 reviewer 批准（spec 已 approval）

- [x] Task 3: RC-2 STATIC negative_control 格式修复（12 错误）
  - [x] 3.1 REQ-001 negative_control 修复
  - [x] 3.2 REQ-002 negative_control 修复
  - [x] 3.3 REQ-004 negative_control 修复

- [x] Task 4: RC-3 plan_item_id 格式修复（4 错误）
  - [x] 4.1 修改审计报告 4 个 REQ 的 plan_item_id

- [x] Task 5: RC-5 evidence_receipts payload 一致性修复（2 错误）
  - [x] 5.1 EV-003 command 恢复 2>&1 | tail -5
  - [x] 5.2 EV-004 command 恢复 > /tmp/neg-out.txt 2>&1

- [x] Task 6: RC-6a 降级声明补充（1 错误）
  - [x] 6.1 补 downgrade_declaration 含 4 字段

- [x] Task 7: RC-6b 时间顺序修复（2 错误）
  - [x] 7.1 修正 scope.frozen_at
  - [x] 7.2 重新生成 verdict-state receipt
  - [x] 7.3 更新 verdict_state_receipt sha256
  - [x] 7.4 重新生成 5 个 EV-NNN receipt 并同步 ledger

- [x] Task 8: 最终验证
  - [x] 8.1 pre-check-evidence.ts 通过（0 problems, exit 0）
  - [x] 8.2 validate-audit.ts 通过（valid=true, exit 0, 0 errors）
  - [x] 8.3 更新审计报告 §11 Validator Evidence
  - [x] 8.4 签署 ACCEPT verdict

# Task Dependencies

所有依赖已满足。