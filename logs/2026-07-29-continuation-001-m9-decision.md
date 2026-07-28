# 2026-07-29 — CONTINUATION-001 决策：M9 hook = audit-finalize

## 为什么

blueprints-governance plan COMPLETE 后，CONTINUATION-001（M9 停滞/唤醒扫描接线）的唯一未决项是 hook 选择。用户决策：audit-finalize。

## 决策

- **M9 hook**: `audit-finalize`（每次 `finalize-audit.ts` 发布 LATEST pointer 时触发停滞扫描）
- **理由**: 与治理流程天然绑定；频率适中；仅在有 audit 活动时触发
- **排除**: session-startup（频率过高，多数会话与 blueprints 无关）

## 后继 PLAN_SET 需做

1. 设计扫描算法（停滞判定：N 天无 git commit 且无 LATEST 引用）
2. 设计唤醒/退役流程（标记 `已暂停` + 触发 human review？自动退役？）
3. 在 `finalize-audit.ts` 中集成 M9 扫描调用
4. 实施 + 测试 + audit

## 状态

- 决策已做出，后继 PLAN_SET 可启动
- 本 log 为决策记录，非实施记录