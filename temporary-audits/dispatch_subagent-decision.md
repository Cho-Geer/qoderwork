# 决策文档：dispatch_subagent 退役边界

> **状态**: 已决策（2026-07-11）
> **分类**: C1 — 非阻塞清理 / 决策固化
> **关联计划**: `plans/03-phase2-native-agent-dag.md` §Step 5；`blueprint-opencode-framework-simplification-roadmap.md` §6.2

---

## 1. 决策结论

**`dispatch_subagent` 仅保留为 framework maintenance 的 trusted compat path；普通任务派遣改用 OpenCode 原生 `Task()`（native agent），不再要求 wrapper / DAG entry / DISPATCH_TOKEN。**

这是「收缩而非重写」原则下的边界决策，不是完全物理删除。

---

## 2. 决策依据

### 2.1 运行时事实（2026-07-11 验证）

| 事实 | 证据 |
|------|------|
| active agent = Orchestrator / build / general / plan / explore（5 个） | `opencode.json` agent 键（V5.1 静态检查） |
| 普通 native Task 无 DAG / 无 token 通过 | G2 (6/6) + T2（no-DAG smoke） |
| `dispatch_subagent` 仍存在并在普通路径被 smoke 用作兼容 dispatch | `plans/03` §Step 5 / G4 smoke |
| `dispatch_subagent` 的 `dispatch_privilege=framework_maintenance` 路径仍可信 | G4 (grant lifecycle) + D3 (REPO-OP live) |

### 2.2 设计动因

- 弱模型「不遵从」问题不靠更多自定义 Agent 解决（blueprint §2.3）。
- 原生 `Task()` 由 OpenCode 官方持续验证，稳定度高于自写 wrapper。
- 普通任务不需要 DISPATCH_TOKEN / P0 protocol 包装；P0 约束应下沉到 safe tool / Hook。
- framework maintenance 是高权限可信路径，保留 `dispatch_subagent` 的 grant 绑定（queue / token / prompt-ref / lineage）作为兼容层，避免破坏已验证的 grant 主链路。

---

## 3. 责任边界

| 路径 | dispatch_subagent | 原生 Task |
|------|------------------|-----------|
| 普通任务（build/general/plan/explore 子任务） | ❌ 不要求 | ✅ 默认 |
| framework maintenance 可信派遣 | ✅ 保留（trusted compat） | — |
| DAG entry 要求 | 仅非 DAG-exempt agent（legacy）；当前已无 active 强制 | ❌ 不需要 |
| DISPATCH_TOKEN / P0 protocol | 仅 framework maintenance 路径内嵌 | ❌ 不需要 |
| grant 绑定（queue/token/lineage） | ✅ framework maintenance 路径 | 由 native 元数据替代 |

---

## 4. 退出条件（物理退场判据）

`dispatch_subagent` 可完全删除当且仅当：

1. framework maintenance 的 grant 主链路改由 `safe_framework_edit` + `framework_maintenance_plan` 的 Hook 路径完整承载（不依赖 wrapper 写 `_dispatch` / queue / token）。
2. 所有 framework maintenance 文档、Skill、Orchestrator 调度提示不再引用 `dispatch_subagent`。
3. 当前 `router.ts` 对 `_dispatch` 文件 + queue + grant 的单点依赖（EROFS 风险，见 `plans/session-persist-fail`）被 Hook 路径取代。

当前（2026-07-11）上述 3 条**未全部满足**，故保留 compat path。

---

## 5. 回滚与监督

- 若原生 Task 在弱模型下出现 lineage / 权限问题，按 roadmap §6 回滚顺序：先调 Skill 摘要 → 调 Hook disposition → 调 QoderWork watcher → 缩小 native 派发范围 → 临时恢复旧 prompt 仅用于故障隔离（同任务内删除）。
- `dispatch_subagent` 文案（`tools/dispatch_subagent.ts` description）已明确「仅 framework maintenance trusted compat」，避免弱模型误用为普通派遣。
