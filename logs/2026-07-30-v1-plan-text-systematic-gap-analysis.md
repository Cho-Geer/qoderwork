# v1 plan-text 二次发现系统性问题 — admission 路径契约不完整

> **会话**：check-plan 本会话
> **触发点**：用户指示"启动 T1（worktree 创建 + r4 制品生成）"，主会话执行 T1a/T1b 后到 T1c 时发现 plan-text 修订仍存在系统性问题
> **结论**：plan document 必须二次修订（v5.1）才能进入 admission 阶段；当前 plan-text 修订（4 轮 audit ACCEPT）只覆盖了 plan 文本内部一致性，遗漏了 admission 路径契约完整性
> **状态**：发现 7 个系统性问题 + 1 个 skill 债务 + 已执行 T1a/T1b 部分错位产物

## 1. 为什么做这次分析

用户推进 v1 admission 实施时，dispatch todo list 中 T1c（生成 r4 manifest 制品）触发 schema gap：
- canonical L12 指向 `approval-decision-r5.json`，但 r3 命名空间完全未定义
- canonical L25 说 r4 frozen 已被 r5 取代，但 r4→r5 转换步骤未写
- 我刚写的 `approved-plan-files-r4.sha256` 与 canonical L333 期望的 `approved-plan-object-set-r5.json` 冲突

用户问"是不是 plan document 还是有问题"，主会话同意并系统列出 7 个问题。

## 2. 7 个系统性问题

### 问题 1：admission 路径契约不完整（致命）

canonical L11-26 的 generation history 命名空间不完整：
- L11 指向 `approval-request-r5.json`
- L12 指向 `approval-decision-r5.json`
- L24 说 "r3: would require a fresh manifest SHA freeze; not yet produced" —— **未给 r3 schema**
- L25 说 "r4: frozen 2026-07-30, superseded by 2026-07-30 plan-text revision" —— **未说 r4 是删除/归档/冻结保留**
- L26 说 "r5: post-revision generation; this is the only authoritative generation" —— **未说 r4→r5 转换步骤**

→ T1c 必须自创 r3 schema，违反 P-02（"无新发明"）。audit dir 现只有 r1 + r2 rejection 文件，r3/r4 文件名都不知道。

### 问题 2：approved-plan-files sha256 契约有 3 套（冲突）

- canonical L333-334 期望：`approved-plan-object-set-r5.json` + 1 行 sha256（指向 object_set.sha256）
- r1 历史制品：`approved-plan-files.sha256` + 8 行（旧文件名 `01-phase-artifact-dag-and-scope-lock.md` 等）
- 主会话刚写的：`approved-plan-files-r4.sha256` + 9 行（新文件名）

→ 3 套契约全冲突。**T1b 已写错文件**，必须删除并按 canonical L333-334 重做。

### 问题 3：plan-text 修订的 4 轮审计没审查 admission 路径

4 轮 plan-text audit 共发现 15 项 finding + 3 项 NF，全部针对 plan 文本（M1-M14）。**没有人审查"plan text 修订完后，admission 流程是否能跑通"**：
- r3 manifest schema 是什么？
- approval-request-r5.json 怎么从 r1 approval-request.json 派生？
- r4 frozen state 如何处理（保留/归档/删除）？

→ plan-text audit 盲点。本会话未触发 admission-readiness audit。

### 问题 4：worktree 命名已对齐但 audit dir 文件名未对齐

- canonical L31 worktree 路径：`audit-governance-recovery-v1-bootstrap`（NF-001 已修，对齐 ✓）
- audit dir 现保留 `approval-decision-pending-r2.json` 等历史文件名（r5 admission 会用 `approval-decision-r5.json` / `approval-request-r5.json`）
- **r2 pending 拒绝标记保留会让 acyclic check 困惑**

→ P0 preflight 没显式要求"删除 r1/r2 历史制品"或"标注 archived"。

### 问题 5：P-04 BLOCKED 继承未定义 r5 起点

`provenance-rules.md` P-04 要求 `inherited_blockers` 列出上一份报告所有 BLOCKED 项。但 v1 generation=1（首次审计），**未定义 generation=1 audit report 的 scope-lock 应引用什么**：
- 引用 r1 `approval-request.json`（已有）？
- 引用 r5 `approval-request-r5.json`（待生成）？
- 只引用 canonical + scope-lock.json 自洽？

→ `templates/scope-lock-template.json` 的 `plan_sources` 字段只有 1 个示例，**未说 9 个 plan files 都必须列入还是只列 canonical**。

### 问题 6：00-plan-index §1.5 P0 preflight 与 canonical 文件名错位

- 00-index §1.5 说 "9-r4 artifacts present: `approved-plan-files-r5.sha256` 等 9 个文件"
- canonical L333 说 `approved-plan-object-set-r5.json` + 1 行 sha256

→ 同一 plan 内部文件名不一致。

### 问题 7：T1a/T1b 已写部分制品但契约错配

- T1a：创建 worktree `.worktrees/audit-governance-recovery-v1-bootstrap`（correct，anchored to 51d95db）
- T1b：写 `audits/audit-governance-recovery-v1/approved-plan-files-r4.sha256`（**错误**，canonical 期望 `approved-plan-object-set-r5.json`，且内容应是 object_set 的 sha256 而非 9 文件直列）
- 都未提交到 git（worktree 内 untracked 状态）

→ 必须在 plan document 修复后回滚 T1b，重新生成。

## 3. 根本原因

plan-text 修订的 4 轮审计只审了 plan-text 自身内部一致性（NF-001~004, F-NEW-1~6, M1-M14），**没有一轮审了"plan-text 与 admission 路径工具链（skill scripts）的一致性"**：

1. **canonical L11-12 vs skill scripts**：`approval-request-r5.json` schema 在 `approval-request.json` 模板中**没有对应**，现有 r1 schema 假设 `approved_artifacts: {canonical_contract, approved_plan_files}`，**未说 r5 是否还要加 `phase_01_bootstrap_scope` 或 r3 manifest 字段**

2. **canonical L25 vs skill scripts**：r4 frozen 状态应如何表达——`audit-boundary-precheck.ts` 只输出 `READY_FOR_LLM_REVIEW` / `BLOCKED`，**未说 frozen state 是否需要单独产物**

3. **canonical L333-334 vs skill scripts**：`approved-plan-object-set-r5.json` 这个文件名**完全没在 templates 里出现过**——既不在 `scope-lock-template.json`，也不在 `evidence-receipt-template.json`，也没在 `audit-report-template.md`

→ templates/scripts **没跟上 r5 schema 升级**。这是 plan-audit-archiver skill 本身的债务。

## 4. 决策建议（待用户决策）

| 选项 | 内容 | 风险 |
|---|---|---|
| A | 立即回滚 T1b + 启动 v5.1 plan-text 修订（补 admission 路径契约 + 触发第 5 轮 audit） | 高：v5.1 修订面广，可能 1-2 天 |
| B | 仅回滚 T1b，v5.1 修订等单独决策 | 中：保留现状但 admission 阻塞 |
| C | 不回滚，按 canonical L333 直接重写 T1b 产物为 `approved-plan-object-set-r5.json` | 中：绕开 plan-text 修订，但未解决 r3 schema 等其他 6 个问题 |
| D | 暂缓整个 v1 admission，回到 blueprint 阶段重做 plan | 高：2 周+ 工作量 |

主会话已推荐 **A**。

## 5. 执行证据

### 5.1 T1a 执行成功

```
$ cd /home/zhaoge/workspace/qoderwork && git worktree add .worktrees/audit-governance-recovery-v1-bootstrap 51d95db -b audit-governance-recovery-v1-bootstrap
Preparing worktree (new branch 'audit-governance-recovery-v1-bootstrap')
HEAD is now at 51d95db docs(governance): v1 plan-text revision final log (4 rounds, 4 commits, ACCEPT)
exit 0

$ git worktree list
/home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-recovery-v1-bootstrap  51d95db [audit-governance-recovery-v1-bootstrap]
```

### 5.2 T1b 执行但契约错配

```
$ sha256sum plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml plans/audit-governance-recovery-v1/formal-plan-set/*.md > audits/audit-governance-recovery-v1/approved-plan-files-r4.sha256
$ wc -l audits/audit-governance-recovery-v1/approved-plan-files-r4.sha256
9

$ head -n 1 audits/audit-governance-recovery-v1/approved-plan-files-r4.sha256
7d4b71f443c8db1d958a486134fcb61cf44eb5a8a2778ae110fe4c55459f9b3a  plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml
```

→ 文件存在 + 9 行 + canonical hash 正确，但**文件名错 + 内容形态错**（canonical L333 期望 `approved-plan-object-set-r5.json` 1 行）。

### 5.3 T1c 阻断

加载 plan-audit-archiver templates 后发现：
- `scope-lock-template.json` plan_sources 只有 1 个示例（NF-005 风险）
- `audit-report-template.md` 没引用 `approved-plan-object-set-r5.json`
- `prepare-audit.ts` / `capture-state.ts` 拒绝 `REPLACE_*` 占位符（必须填真实 UTC 时间戳）

→ T1c 不能直接复用 r1 schema，必须先解决 7 个系统性问题。

## 6. 用户决策点（仍待指示）

请确认以下 5 选 1：
1. 立即回滚 T1b + 启动 v5.1 plan-text 修订（推荐 A）
2. 仅回滚 T1b，v5.1 修订等单独决策（B）
3. 按 canonical L333 直接重写 T1b 产物，暂不改 plan（C）
4. 暂缓整个 v1 admission（D）
5. 其他（请说明）

## 7. 更新了什么文档

- 新建：`logs/2026-07-30-v1-plan-text-systematic-gap-analysis.md`（本文）

未修改其他文档（避免在用户决策前扩大范围）。