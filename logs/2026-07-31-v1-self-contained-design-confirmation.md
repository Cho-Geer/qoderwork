# v1 plan 设计判断反转 — plan 是自包含的，不需要 toolchain-bootstrap-m1

> **会话**：check-plan 本会话
> **触发点**：执行第 2 步（写 blueprint-v1-toolchain-bootstrap.md）前，主会话按 blueprint-creation Phase 0 验证根因，发现前两份分析（2026-07-30 gap analysis + 2026-07-31 reanalysis）**均误判**
> **结论**：v1 plan 是自洽的自包含设计；PHASE-01 本身就是工具链 bootstrap；不需要独立的 toolchain-bootstrap-m1 plan 或 blueprint
> **影响**：撤销 2026-07-31 reanalysis 的"路径 1：先补工具链"建议；撤销 TOOLCHAIN_MISSING blocker 标记；v1 可以直接走 admission（但仍需先解决 base_commit + worktree 时序问题）

## 1. 误判了什么

### 1.1 前两份分析的核心主张（错误）

- **2026-07-30 gap analysis**：plan 引用 6 个 MISSING 文件 + validate-phase-progression CLI 不符 → "plan 引用了未实现的工具链"
- **2026-07-31 reanalysis**：同上，建议"路径 1：先补工具链，新建 toolchain-bootstrap-m1 plan"
- **2026-07-31 status update**：在 00-plan-index 标记 `TOOLCHAIN_MISSING` blocker + canonical 加 base_commit 待更新注释

### 1.2 实际证据（今日 blueprint-creation Phase 0 验证）

**证据 A — 6 个"MISSING"文件是 PHASE-01..04 的 allowed-files（实施产物）**：

canonical L1346-1377 `allowed_files` 块明确列出：

| Phase | allowed-files（add_paths） | 文件 |
|---|---|---|
| PHASE-01 | L1353-1354 | `foundation-kernel.test.ts`（plan-audit-archiver + deterministic-implementation-planning 各 1 个） |
| PHASE-02 | L1364-1365 | `close-audit-phase.ts` + `close-audit-phase.test.ts` |
| PHASE-03 | L1371-1372 | `artifact-reference-graph.ts` + 测试 |
| PHASE-04 | L1376-1377 | `check-audit-governance-recovery-conformance.ts` + 测试 |

→ 这些是各 phase implementer **要创建的产物**，不是 pre-existing 外部依赖。

**证据 B — validate-phase-progression CLI 扩展是 PHASE-01 step 6 的 allowed-edit**：

01-phase-foundation-kernel.md L47：
```
| 6 | validate-phase-progression.ts | add inputs/releases, admission/status/final, bootstrap close, PHASE-02 candidate adoption |
```

→ `--verify-final-gate` 等 flag 是 PHASE-01 implementer 要添加的扩展，不是 plan 错误引用了不存在的接口。

**证据 C — evidence_case_registry 引用测试名是正常的 phase 验证时序**：

canonical L1409-1418 的 EV 命令引用 `foundation-kernel.test.ts -t 'DC-GR1-001-P'`。时序是：
1. PHASE-01 implementer 创建 foundation-kernel.test.ts（step 7/8）
2. PHASE-01 implementer 跑 Fixed verification（L189-197）
3. PHASE-01 auditor 跑 evidence_case_registry 的 EV 命令验证

→ 这是标准 phase 实施流程，不是"admission freeze 时测试不存在"。

**证据 D — Fixed verification L189-197 明确 implementer 先创建文件再跑测试**：

```
cd .worktrees/audit-governance-recovery-v1-bootstrap
bun test ... foundation-kernel.test.ts ... validate-phase-progression.test.ts ... foundation-kernel.test.ts
bun run typecheck
git diff --check
```

→ implementer 按序实施 step 1-8（创建/修改 8 个文件），然后跑 Fixed verification。

## 2. 为什么之前误判

### 2.1 第一份（2026-07-30）的误判根因

T1c 阻断时，我没读完 canonical L1628-1655 materialization_commands 块，也没读 allowed_files 块（L1346-1377）。只看到 `test -f foundation-kernel.test.ts` 返回 MISSING 就下结论"plan 引用了不存在的文件"，没检查这些文件是否在 plan 的 allowed-files 里。

### 2.2 第二份（2026-07-31 reanalysis）的误判根因

我读了 materialization_commands，修正了"r3/r5 schema 未定义"的误读，但**仍然没读 allowed_files 块**。继续认为"6 个文件 MISSING 是 plan 的外部依赖问题"，没意识到它们是 phase 实施产物。

### 2.3 合理化检测（self-correction）

blueprint-creation skill 的"实测优先于推测"原则触发了本次纠正：写 blueprint 前必须验证根因，而验证 allowed_files 块后根因不成立。

## 3. 真正剩余的问题（缩小后的范围）

撤销"7 个问题/4 个真问题"后，真正剩余的只有 **2 个机械问题**：

### 问题 A：canonical base_commit 与 worktree base 不匹配（机械）

- canonical L29 `qoderwork_base_commit: 2a8b15a`
- materialization_commands L1647 `git worktree add --detach tgt 2a8b15a`
- T1a 实际创建 worktree anchored to `51d95db`
- **性质**：这不是 plan 设计问题，是 r5 plan-text 修订后 base_commit 未同步更新
- **修复**：把 canonical L29/L1647 的 `2a8b15a` 改成 `51d95db`（或 toolchain-complete 后的实际 HEAD）

### 问题 B：materialization_commands 时序（机械）

- canonical L1635 `test ! -e "$AUDIT_RECOVERY_TARGET_ROOT"`（worktree 不存在才继续）
- L1642 校验 `approval-decision-r5.json` 已 APPROVED
- 但 T1a 已创建 worktree（anchored to 51d95db）
- **性质**：materialization_commands 假设"从零创建 worktree"，而 T1a 已提前创建
- **修复**：删 T1a 创建的 worktree，让 materialization_commands 自己创建（它的 base 是 2a8b15a，需先修问题 A）

## 4. 决策建议（修正）

**撤销之前的"路径 1：先补工具链"建议**。新建议：

### 新路径 1（推荐）：直接走 v1 admission，修 2 个机械问题

1. 撤销 2026-07-31 status update 的改动：
   - 删 00-plan-index L8 的 `TOOLCHAIN_MISSING` blocker 标记
   - 删 canonical L29-33 的 base_commit 待更新注释
2. 修 canonical base_commit：`2a8b15a` → `51d95db`（L29 + L1647）
3. 删 T1a 创建的 worktree（让 materialization_commands 自己创建）
4. 删 T1b 错写的 `approved-plan-files-r4.sha256`
5. 走 r5 admission（materialization_commands → HUMAN approval → PHASE-01 实施）

**优点**：不需要新 blueprint/plan；v1 plan 本身就是自洽的
**风险**：base_commit 改动需重新验证 sha256 一致性

### 新路径 2：保持 status update，但修正 blocker 描述

如果用户认为 base_commit 不匹配值得标记，把 TOOLCHAIN_MISSING 改成 BASE_COMMIT_STALE（更准确的描述）。

## 5. 用户决策点

请确认：

1. **同意新路径 1**（撤销 status update + 修 base_commit + 删 worktree + 走 admission）？
2. **同意新路径 2**（修正 blocker 描述为 BASE_COMMIT_STALE）？
3. **不同意**，仍认为需要 toolchain-bootstrap-m1（请说明我哪里还误判了）？
4. **其他**（请说明）

## 6. 更新了什么文档

- 新建：`logs/2026-07-31-v1-self-contained-design-confirmation.md`（本文）
- 未修改其他文档（等待用户决策后再动 plan 文件）
