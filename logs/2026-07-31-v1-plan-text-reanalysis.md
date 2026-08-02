# v1 plan-text 第三次分析：修正误读 + 确认真正问题（plan-vs-toolchain gap）

> **会话**：check-plan 本会话（接 2026-07-30 gap analysis）
> **触发点**：用户要求"确认问题点 + 给解决思路"，主会话逐条复核 2026-07-30 日志的 7 个问题
> **结论**：2026-07-30 日志 7 个问题中 **5 个是误读 / 2 个部分成立**；真正问题是 plan 引用了未实现的工具链（6 个脚本/测试文件 MISSING + validate-phase-progression CLI 接口不符）
> **状态**：需要用户决策——是先补齐工具链还是缩小 plan scope

## 1. 对 2026-07-30 日志的修正

### 1.1 误读的问题（5 个）

| 2026-07-30 问题 | 实际文档证据 | 结论 |
|---|---|---|
| 问题 1：r3 schema 未定义 | 00-index §1.5 step 4 (L53) 明确定义 `approval-decision-pending-r3.json`；canonical L1639 定义 `approval-decision-pending-r5.json`；canonical L1575-1586 定义 11 步 creation_order | **误读** — schema 已完整定义 |
| 问题 2：3 套 sha256 契约冲突 | canonical L333-334 明确说 approved-plan-files-r5.sha256 是 1 行（指向 object_set）；L325-331 定义 object_set schema；L1645 校验 entry_count=8 | **误读** — 契约自洽，是 r1 历史制品 vs r5 新契约的正常更替 |
| 问题 4：audit dir 文件名未对齐 | canonical L1628 "No old M1 receipt...is reused"；L1649-1650 把 r5 制品写入 worktree（0o444 immutable）；r1/r2 文件留在 check-plan 不影响 worktree | **误读** — r1/r2 是 check-plan 的历史归档，worktree 是全新创建 |
| 问题 5：P-04 BLOCKED 继承未定义 | v1 是 generation=1（首次审计），无上一代报告，P-04 不适用；canonical L1430-1429 已定义 PHASE-01 generation=1 起点 | **误读** — generation=1 无继承需求 |
| 问题 6：00-index §1.5 与 canonical 文件名错位 | 00-index L43-51 与 canonical L1639 文件名完全一致（9 个 r5 文件） | **误读** — 文件名一致 |

### 1.2 部分成立的问题（2 个）

**问题 3（部分成立）：4 轮审计没审查 admission 路径**
- 成立部分：4 轮 audit 确实只审 plan-text 内部一致性，没验证 referenced scripts/tests 是否存在
- 修正：这不是"admission 路径契约不完整"，而是"plan 引用了未实现的工具"——见下方真正问题

**问题 7（成立）：T1b 写错文件**
- 成立：`approved-plan-files-r4.sha256` 9 行直列 vs canonical L333 期望 1 行（指向 object_set）
- 但根因不是"契约不清"，而是我没读完 canonical L1628-1655 materialization_commands 就动手

## 2. 真正的问题（经今日逐条验证）

plan-text 内部契约是自洽的（materialization_commands 块是自包含的 TypeScript 脚本，定义了从 object_set → 1-line manifest → worktree 创建 → 87-file p0 freeze → p4 boundary → approval-request/decision → materialization-receipt 的完整链路）。**真正的问题是 plan 引用的外部依赖大面积缺失**：

### 真问题 A：validate-phase-progression.ts CLI 接口不符（致命）

- **canonical L1464 引用**：`validate-phase-progression.ts --verify-final-gate GATE-GR-FINAL-001 --canonical ... --plan-root ... --audit-root ... --output ...`
- **实际接口**（`--help` 验证）：`validate-phase-progression.ts <plan-dir> <next-phase-id>`
- **差距**：脚本完全不支持 `--verify-final-gate` / `--canonical` / `--plan-root` / `--audit-root` / `--output` 任何一个 flag
- **影响**：canonical L1448-1449（FINAL_AUDIT EV-001/EV-002）+ L1460-1469（GATE-GR-FINAL-001/002）+ 99-final-verification 全部无法执行
- **验证**：`grep -n "verify-final-gate\|verify-final-audit\|final-authority\|p4-admission\|materialization\|approved-plan-object-set" validate-phase-progression.ts` → 0 命中

### 真问题 B：6 个 referenced scripts/tests 完全缺失（致命）

canonical evidence_case_registry 引用的测试文件，全部 MISSING：

| canonical 引用位置 | 引用路径 | 存在性 |
|---|---|---|
| L1420 (EV-017/018) | `.agents/skills/plan-audit-archiver/scripts/__tests__/foundation-kernel.test.ts` | **MISSING** |
| L1432 (EV-001/002) | `.agents/skills/plan-audit-archiver/scripts/__tests__/close-audit-phase.test.ts` | **MISSING** |
| L1434-1437 (EV-003-006) | `scripts/lib/__tests__/artifact-reference-graph.test.ts` | **MISSING** |
| L1439-1440 (EV-001/002) | `scripts/__tests__/check-audit-governance-recovery-conformance.test.ts` | **MISSING** |
| L1442-1443 (EV-001/002) | `scripts/check-audit-governance-recovery-conformance.ts` | **MISSING** |
| L1434 (支撑) | `scripts/lib/artifact-reference-graph.ts` | **MISSING** |

- **影响**：PHASE-01 的 2 个 EV、PHASE-02 的 2 个 EV、PHASE-03 的 4 个 EV、PHASE-04/05/06 的 4 个 EV 全部无法执行；10/16 evidence case 会因 file-not-found 失败
- **性质**：这些是 PHASE-01..06 的**实施产物**（由各 phase 的 implementer 创建），plan 现在引用它们是因为 plan 把"未来要创建的测试"当成了"已存在的验证命令"
- **验证**：6 个 `test -f` 全部返回 MISSING

### 真问题 C：materialization_commands 依赖 HUMAN approval 先存在（时序悖论）

- canonical L1631-1655 materialization_commands 第一步是 `test ! -e "$AUDIT_RECOVERY_TARGET_ROOT"`（worktree 不存在才继续）
- L1642 校验 `DP.decision==="APPROVED" && DP.approved_by==="HUMAN_USER"` —— 但 `approval-decision-r5.json` 此时尚未存在（它是 creation_order L1584 STOP_FOR_EXPLICIT_HUMAN_PLAN_DECISION 之后的产物）
- L1647 `git worktree add --detach tgt 2a8b15a` —— 但 worktree 已在 T1a 创建（anchored to 51d95db，不是 2a8b15a）
- **影响**：materialization_commands 脚本会在 L1635 `test ! -e` 处失败（worktree 已存在），或 L1642 处失败（decision 不存在）
- **性质**：这是 plan 设计的"先有 approval 再 materialize"时序 vs 我已创建 worktree 的现实冲突

### 真问题 D：T1a worktree base commit 不匹配

- canonical L1647 + L29: worktree base = `2a8b15ac2c7bfe237cdde0473564d9320b024edc`（check-plan 的某个祖先）
- T1a 实际创建：anchored to `51d95db`（check-plan HEAD，含 5 个 v1 plan-text 修订 commit）
- **影响**：materialization_commands L1647 `git worktree add --detach tgt 2a8b15a` 会因 worktree 已存在而失败
- **性质**：plan 的 base commit 是 r1 freeze 时点的，没更新到 r5 plan-text 修订后的 HEAD

## 3. 根本原因（修正版）

2026-07-30 日志的根因分析（"templates/scripts 没跟上 r5 schema 升级"）**方向对但具体错**：

- **不是 templates 没跟上**：scope-lock-template / evidence-receipt-template / audit-report-template 是通用的，r5 没要求改它们
- **是 plan 引用了 PHASE-01..06 的实施产物作为 pre-existing 验证命令**：canonical evidence_case_registry 假设 `foundation-kernel.test.ts` 等已存在，但这些正是各 phase implementer 要创建的
- **是 validate-phase-progression.ts 没实现 r5 需要的 final-gate/final-audit 接口**：plan 假设了工具升级，但工具没升级

换言之：**plan 是"目标态"设计（描述了实施完成后世界应该长什么样），但把它当成了"当前态"可执行命令**。这是 plan-text 修订时引入的语义混淆——M1-M14 修订让 plan 内部自洽了，但扩大了 plan 与工具链的 gap。

## 4. 解决思路（3 条路径，按风险递增）

### 路径 1：先补工具链，再跑 admission（推荐）

**适用**：承认 plan 是目标态，先把工具链补到 plan 期望的水平

步骤：
1. 回滚 T1a（删 worktree）+ T1b（删错文件），回到干净状态
2. 新建 plan `toolchain-bootstrap-m1`，按 canonical 引用清单补齐 6 个缺失文件：
   - `scripts/lib/artifact-reference-graph.ts` + 测试（PHASE-03 依赖）
   - `scripts/check-audit-governance-recovery-conformance.ts` + 测试（PHASE-04/05/06 依赖）
   - `.agents/skills/plan-audit-archiver/scripts/__tests__/foundation-kernel.test.ts`（PHASE-01 EV-017/018 依赖）
   - `.agents/skills/plan-audit-archiver/scripts/__tests__/close-audit-phase.test.ts`（PHASE-02 依赖）
3. 升级 `validate-phase-progression.ts` 支持 `--verify-final-gate` / `--verify-final-audit-inputs` / `--verify-final-audit-regression` 接口
4. 更新 canonical L29 base_commit + L1647 worktree base 到 `51d95db`
5. 走 v1 admission（此时 plan 引用的命令都能执行）

**风险**：toolchain-bootstrap 本身是 2-5 天工作量；且它本身需要 plan+audit
**优点**：根本解决，v1 admission 能跑通

### 路径 2：缩小 v1 scope，推迟 final-gate 到 v2

**适用**：v1 只做 PHASE-01（foundation-kernel），final-gate 推迟到 v2

步骤：
1. 回滚 T1a/T1b
2. 修订 canonical：把 evidence_case_registry 中引用 MISSING 文件的 EV 标记为 `DEFERRED_TO_V2`
3. 把 final_gate_registry（L1451-1469）整体移到 `phase_99_activation_additions` 块，标记 v2 scope
4. v1 只验证 PHASE-01 的 foundation-kernel（只需补 foundation-kernel.test.ts 1 个文件）
5. 走 v1 admission（scope 缩小后工具链缺口从 6 个降到 1 个）

**风险**：v1 不再是"完整 governance recovery"，只是 foundation；需用户接受 scope 缩小
**优点**：2-3 天可交付 v1 PHASE-01

### 路径 3：plan 回退到 blueprint，重做设计

**适用**：认为当前 plan 目标态设计本身有问题

步骤：
1. 回滚 T1a/T1b
2. 把 v1 plan 降级回 blueprint（`blueprints/audit-governance-recovery-v1.md`）
3. 重新设计：先写工具链 → 再写 plan 引用 → 再 admission
4. 新 plan 用"当前态可执行命令"而非"目标态描述"

**风险**：2 周+ 工作量，前期投入沉没
**优点**：彻底解决 plan-vs-toolchain 语义混淆

## 5. 决策建议

**推荐路径 1（先补工具链）**，理由：
- plan-text 内部契约已自洽（4 轮 audit 验证）
- 真正缺口是机械实现（6 个文件 + 1 个 CLI 升级），有明确规格（canonical 已定义接口）
- 路径 2 缩小 scope 会丢失 governance recovery 的完整性
- 路径 3 回退代价过高

但路径 1 需要**新的 plan**（toolchain-bootstrap-m1），不能在 v1 plan 内部解决（否则循环依赖：v1 引用工具，工具又靠 v1 审计）。

## 6. 用户决策点

请确认：

1. **同意路径 1**（先补工具链，新建 toolchain-bootstrap-m1 plan）？
2. **同意路径 2**（缩小 v1 scope 到 PHASE-01 only）？
3. **同意路径 3**（回退到 blueprint 重做）？
4. **其他**（请说明）

## 7. 更新了什么文档

- 新建：`logs/2026-07-31-v1-plan-text-reanalysis.md`（本文）
- 修正：2026-07-30 日志的 5 个误读已在本文 §1 列出（未修改原日志，保留历史）
