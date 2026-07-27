# 裁决记录：repository_root 取值（Phase 0.1）

> **裁决日期**：2026-07-27
> **裁决人**：人类用户
> **裁决事项**：独立审计 \udit-governance-evidence-and-status-closure-v3\ 的 epository_root\ 应填哪个仓库
> **裁决结果**：**repository_root = \/home/zhaoge/workspace/opencode/work-one\（产品锚点）**

---

## 1. 裁决依据

### 1.1 规则依据

- **P-07 规则**（\provenance-rules.md\）：\--repository-root\ 必须指向干净锚点仓库（默认 work-one），禁止指向审计工作区（qoderwork 主仓或其任何 \.worktrees/*\ worktree）。
- **plan-audit-archiver skill**「仓库身份字段使用规范表」与「repository_root 选择规则（强制）」节：无论审计对象是 work-one 本身还是 qoderwork 自身的工具代码，epository_root\ 恒为干净锚点。其唯一作用是提供审计期间不变的 git 基线，证明被审计目标仓库无意外变更。
- **validator 代码逻辑**（\alidate-audit.ts\ L1159-1198）：\deltaPaths\ 为 pre-change receipt \status_entries\ 与实时 \git status\ 的对称差，差集路径必须在 epository_scope.allowed_paths\ 内；对 \udits/\、\logs/\、\evidence/\ 等审计基建路径无豁免。若 epository_root\ 指向审计工作区，审计产物会触发 \DIRTY_PATH_OUTSIDE_SCOPE\ 连环错误。

### 1.2 事实依据

- 被审计代码（治理层 \.agents/skills/plan-audit-archiver/\、\scripts/lib/\）只存在于 qoderwork 仓库的 audit-governance-v3 worktree，work-one 中不存在这些文件。
- 本次审计的性质是「补审计」（retrospective audit）：Phase 1-5 实施早已完成，pre-change receipt 的「实施前」时点已不存在，无法在 qoderwork worktree 上诚实补捕。
- 工具链原生设计（\prepare-audit.ts\ L258）即「epository_root\ 从 pre-change receipt 自动派生」，支持双根模型（\workspace_root\=qoderwork worktree + epository_root\=work-one）。
- EV receipt 的 \cwd\ 校验允许命令在 \workspace_root\（qoderwork worktree）内执行，证据链不受影响。

### 1.3 语义说明

选择 work-one 作为 epository_root\，其语义为：**「本次治理层实施未触碰产品仓库」**。这一语义为真且具有边界意义；治理侧改动由 freeze-gate 的 \llowlist_modified_path_hashes\ 逐文件 sha256 与 human scope-approval 锚定，不由 validator 的 git dirty 检查锚定。

---

## 2. 被否决的替代路径

| 路径 | 否决理由 |
|------|----------|
| **B. repository_root = qoderwork worktree + 豁免 P-07** | ① 违反 P-07 字面，需额外豁免；② pre-change 无法诚实补捕（实施已过去），delta 检查恒为空、沦为虚假检查；③ 报告写作本身改变 dirty 集，\VERDICT_STATE_MISMATCH\/\DIRTY_PATH_SET_MISMATCH\ 无法稳定闭合 |
| **C. 修改 P-07 / validator 支持治理层自审** | 对本次审计不必要（路径 A 已合规）；可作为后续可选的规则澄清，由规则维护者另行决定，不阻塞本次签署 |
| **A（镜像）. 把治理层代码 mirror 到 work-one** | 逻辑割裂，receipt 的 \status_entries\ 无法反映真实改动，且引入不必要的跨仓同步风险 |

---

## 3. 对后续执行的影响

1. \capture-state.ts --repository-root\ 必须传 \/home/zhaoge/workspace/opencode/work-one\。
2. \generate-evidence-receipt.ts --repository-root\ 必须传 \/home/zhaoge/workspace/opencode/work-one\。
3. \aseline.commit\ / \aseline.head_at_verdict\ 填 work-one HEAD（当前为 4df828d56611ac121baccfaf666f147980aec85\，以执行时 \git -C work-one rev-parse HEAD\ 实测为准）。
4. \aseline.dirty_paths\ 填 work-one 的 \git status --porcelain\ 输出（当前为空）。
5. \implementation_base_commit\ 填 work-one HEAD（自身为祖先，自反性满足 \merge-base --is-ancestor\）。
6. 治理侧改动路径（如 \.agents/skills/plan-audit-archiver/\、\scripts/lib/\）写入 scope lock 的 epository_scope.allowed_paths\，供 freeze-gate 追踪；这些路径在 work-one 中不存在，因此不会出现在 validator 的 dirty path 差集中。

---

## 4. 可选后续行动（不阻塞本次审计）

- 由规则维护者评估是否在 \provenance-rules.md\ 增补追溯场景条款，将本裁决的语义固化为规则明文，避免未来 agent 再次面对解释真空。

---

**裁决状态**：已生效
**关联文档**：\handoff/2026-07-27-audit-fix-todo-list.md\（执行 todo list）
