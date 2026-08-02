# v1 plan 状态字段更新 — TOOLCHAIN_MISSING blocker 显式标记

> **会话**：check-plan 本会话
> **触发点**：用户接受"方案 1：先补工具链 + 新建 toolchain-bootstrap-m1 plan"执行顺序，主会话执行第 1 步（更新 v1 文档状态）
> **结论**：v1 plan 的 00-plan-index 与 canonical 已显式标记 toolchain 阻塞；plan text 内部契约不动（保持 4 轮 audit ACCEPT 的自洽性）
> **后续**：需 blueprint + toolchain-bootstrap-m1 plan，不在本轮 scope

## 1. 为什么改

2026-07-31 主会话逐条复核 v1 plan 后发现：plan text 内部契约自洽（4 轮 audit ACCEPT），但 referenced toolchain 大面积缺失（6 个 scripts/tests MISSING + validate-phase-progression CLI 不符）。未更新状态前，下一个 agent 读 plan 会误以为只需 r5 refreeze 就能推进。

本次更新把阻塞原因显式标记到 plan 头部状态字段，让后续 agent 一眼看到"必须先补工具链"。

## 2. 改了什么

| 文件 | 位置 | 改动 | 行数变化 |
|---|---|---|---|
| `formal-plan-set/00-plan-index.md` | L8（新增） | 加 `**Blocker (identified 2026-07-31)**: TOOLCHAIN_MISSING` 段，列出 6 个 MISSING 文件 + validate-phase-progression CLI 缺失的 3 个 flag + 前置依赖 `toolchain-bootstrap-m1` | 175 → 176 |
| `canonical-requirements-contract.yaml` | L29-33（新增注释） | 在 `qoderwork_base_commit` 上方加 5 行注释，说明该值是 r1-freeze anchor，toolchain-bootstrap-m1 ACCEPT 后需更新到 toolchain-complete HEAD | 1719 → 1724 |

## 3. 决策

- **不改 evidence_case_registry**（canonical L1420-1449）：这些路径是目标态正确描述（描述实施完成后的世界），工具补齐后即成立。改它们 = 否定 4 轮 audit 的结论。
- **不改 materialization_commands**（canonical L1630-1655）：同理，是目标态契约。其 base_commit 引用通过 L29 注释标记待更新，而非直接改值。
- **不删 T1a 创建的 worktree**：worktree 存在不影响 plan text，待 toolchain-bootstrap-m1 完成后重新按正确 base 创建即可（删了再建成本相同）。
- **不删 T1b 错写的 `approved-plan-files-r4.sha256`**：该文件在 worktree 内（不在 check-plan 主 worktree），不影响 check-plan 的 git 状态；toolchain-bootstrap-m1 完成后会按 canonical materialization_commands 重新生成正确文件。

## 4. 执行顺序（用户已接受）

1. ✅ **本轮完成**：更新 v1 plan index 状态字段 + canonical base_commit 标记 + 本 log
2. ⏳ **下一步**：写 `blueprints/blueprint-v1-toolchain-bootstrap.md`（需 plan mode）
3. ⏳ **之后**：实施 `plans/v1-toolchain-bootstrap-m1/`（需 plan + audit 全流程）
4. ⏳ **最终**：toolchain ACCEPT 后，更新 v1 canonical base_commit，走 v1 admission

## 5. 更新了什么文档

- 修改：`plans/audit-governance-recovery-v1/formal-plan-set/00-plan-index.md`（L8 新增 blocker 标记）
- 修改：`plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml`（L29-33 新增注释）
- 新建：`logs/2026-07-31-v1-toolchain-blocker-status-update.md`（本文）
