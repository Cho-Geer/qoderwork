# v1 r5→r6 Revision + Phase B/C 完成 — materialization 成功

> 日期: 2026-07-31
> 会话: check-plan
> 状态: Phase B（decision-r6 v2）+ Phase C（materialization r6 v2）COMPLETE

## 为什么（Why）

r5 admission 流程在 materialization 阶段暴露 canonical 命令 3 个执行缺陷，无法完成：

1. **L1650 重复 hash EEXIST**：87-entry freeze manifest 有 6 个重复 content-addressed 路径（78 unique），exclusive-write `put`（wx）第二次写同一路径必然失败。
2. **L1651/L1653 live 部署 EEXIST**：`put(e.logical_path)` 与 `put(p.index)` 用 wx 写 live 路径，但 `git worktree add 51d95db` 已检出这些 tracked plan 文件。
3. 前置缺陷：Phase A 从未 populate source store（87 个 m1 文件缺失于 `objects/sha256/`），先补 populate 才暴露 1/2。

## 改了什么（What）

- **canonical L1650**：幂等 put——目标已存在且内容 hash 一致 → skip；不一致 → `EXISTING_MISMATCH` 失败；不存在 → wx 写。
- **canonical L1651/L1653**：live 路径部署改覆盖语义（`writeFileSync` 默认覆盖）；store 对象与 mirror 仍 exclusive wx。
- **generation r5 → r6**（参照 r4→r5 先例）：canonical generation history 加 r6；全部 `*-r5.*` 引用 → `*-r6.*`；00-index admission state → `P1_R6_PENDING_REFREEZE`。
- **r6 制品链重生成**：object-set（`6cba7a81…`）→ plan-files（`276d9462…`）→ freeze-manifest（gen 5→6，`dc5ea01f…`）→ p4-boundary（复制）→ index-baseline（`3660b1e2…`）→ pending-r6 → request-r6（`02ed3092…`）。
- **decision-r6 v2**（用户批准，approved_at=2026-07-31T12:33:33Z，hash `072bf26c…`）：canonical 二次修订后连锁更新 + acyclicity_note 行号修正（L1603→L1604, L1628→L1629）。
- **materialization r6 v2 成功**：`{"ok":true,"materialization":"…/approved-plan-materialization-r6.json","semantic_entries":8,"live_paths":9}`。

## 决策（Decisions）

- 用户选 **Q2**（canonical revision）而非执行层 hack；子决策：幂等 put + 升 r6 + 清理保留 r5 历史。
- 发现第三缺陷（live 部署 wx 撞 tracked 文件）后用户批准覆盖语义修复（合入 r6，不升 r7）。
- 子 agent 复审（deepseek-v4-flash，GLM-5.2 不可用）：7/7 hash + 5 硬闸门 + L1650-53 修复全部 PASS；acyclicity_note 行号过时已修。
- 遗留：prewrite 命令 L1672/L1674 读 request 顶层 `canonical_contract`/`waiver_ids`，但 request-r6 只有嵌套 `approved_artifacts`/`exact_waiver_ids` —— Phase D 前必须解决（canonical revision 或 request 重生成）。

## 更新了什么文档

- 修改：`plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml`（L1650-1653 + generation history + r5→r6 引用）
- 修改：`plans/audit-governance-recovery-v1/formal-plan-set/00-plan-index.md`（P1_R6 + r6 引用）
- 新建：`audits/audit-governance-recovery-v1/approved-plan-object-set-r6.json`、`approved-plan-files-r6.sha256`、`bootstrap/m1-p0-freeze-manifest-r6.json`、`bootstrap/p4-boundary-r6.json`、`bootstrap/approved-index-baseline-r6.md`、`approval-decision-pending-r6.json`、`approval-request-r6.json`、`approval-decision-r6.json`、`bootstrap/approved-plan-materialization-r6.json`（均落在 target worktree `audit-governance-recovery-v1-bootstrap`）
- 保留：全部 `*-r5.*` 制品（历史参考）
- 本文：`logs/2026-07-31-v1-r6-materialization-complete.md`
