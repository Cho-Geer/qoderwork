# Blueprint: v1 r7 Refreeze + 分级 Provenance 独立 Proposal

**创建日期**: 2026-08-01
**更新日期**: 2026-08-01
**状态**: 草稿
**相关蓝图**: 前置依赖 → blueprint-audit-governance-evidence-and-status-closure-v3.md
**版本**: v0.7 (第 7 轮:Part A.1 三次返工——N1 修正 L159/L185 矛盾为"不依赖跨 phase chain 但自产出 scope-lock";N2 修正阶段 0-α PRE_CHANGE 为 git HEAD informal + waiver;N3 新增 PHASE-00_COMPONENT_LEVEL_NO_FORMAL_PRE_CHANGE waiver;N4 显式记录 DEC-GR-007 张力)
**provenance_level**: blueprint-draft(非 plan-set artifact;主会话采纳前不需 v3 审批;被 INDEX.md 登记或被任何 phase 引用前需升级)

---

## 一、问题背景

### 1.1 问题描述

`plans/audit-governance-recovery-v1/` 是一个自包含的 v3 PLAN_SET,使命是修复损坏的 v3 审计状态机(14 个 REQ-GR)。它经历了 r1→r6 六代 freeze,当前状态 `BLOCKED` + `P1_R6_PENDING_REFREEZE`。

经过 4 轮 plan 设计 + 5 轮独立复审(GLM-5.2),发现 v1 存在**三个阻塞性 spec drift**,使它无法按当前 r6 状态推进:

1. **PENDING_R6_FREEZE 占位符未填**:`00-plan-index.md` L12/14/16 有 3 个 `PENDING_R6_FREEZE` 占位符,导致 `validate-plan.ts` L87-88 的 `compareSha256` 必然 FAIL。
2. **verify-final-* flag 无 phase 拥有**:canonical `final_gate_registry`(L1452-1510)的 10 个 GATE 引用 3 个 distinct flag:`--verify-final-gate` / `--verify-final-audit-inputs` / `--verify-final-audit-regression`,但 PHASE-01 step 6 的 11 个模式清单(L124-138)不含这些 flag,且没有任何 phase 的 allowed_files 拥有它们的实现。
3. **99-final-verification.md 的 generation 引用漂移**:99-final 有 8 处 r5 引用(L12 "9-r5 artifacts"、L20 `approved-plan-files-r5.sha256`、L21 `approved-plan-bytes-r5`、L22 `approval-decision-r5.json`、L23/L31 r5 引用),但当前 authoritative generation 是 r6,目标 generation 是 r7。此外 99-final L21/L30 引用 `approved-plan-bytes-r5`,而 canonical L1635/L1652 用 `approved-plan-bytes-r4`——存在跨文件命名漂移。

同时,9 轮讨论得出的"审计流程减重优化"结论(v3-lite 分级 / frozen_test_hashes / 复用 task-dispatch-router)不应整合进 v1(4 轮复审证明会破坏文件所有权边界),应作为独立 proposal。

### 1.2 根因分析

**直接原因**:r6 freeze 在 PENDING_R6_FREEZE 占位符未填的状态下就完成了 materialization(logs/2026-07-31-v1-r6-materialization-complete.md 确认 ok:true)。占位符的设计意图是"refreeze 时再填",但 refreeze 从未发生。

**根本原因**:v1 的 plan text 在 r1→r6 迭代过程中,canonical 的 `final_gate_registry` 和 PHASE-01 step 6 的模式清单**独立演进,未做交叉一致性校验**。这是 plan text 自身的设计缺陷,不是实施缺陷。

### 1.3 实测验证(VERIFIED)

以下均为本会话 + 4 轮复审中独立 Read/grep 核实的事实:

- Verified-by: `Read 00-plan-index.md L11-19` → L12/14/16 三处 `PENDING_R6_FREEZE` 占位符确认存在
- Verified-by: `Read validate-plan.ts L85-92` → L87 `compareSha256(canonicalHash, canonicalSource)` 会因占位符与真实 hash 不符而 FAIL
- Verified-by: `Read 01-phase-foundation-kernel.md L123-138` → step 6 的 11 个模式不含 `--verify-final-*`
- Verified-by: `grep -c "verify-final" validate-phase-progression.ts` → 0 命中(脚本零 flag 实现)
- Verified-by: `Read canonical-requirements-contract.yaml L18-19` → authority rule "is never rewritten, synchronized, or replaced in place"
- Verified-by: `Read canonical L21-27` → generation history 记录 r1→r6,每代"保留前代历史 + 升新一代 authoritative"
- Verified-by: `Read approval-decision-r6.json L81` → approval_effect "Any semantic plan-file change requires a new approval request and decision"(HUMAN 批准必须在 plan text 修改之前)
- Verified-by: `Read 99-final-verification.md L12-31` → 8 处 r5 引用(L12/L20/L21/L22/L23/L30/L31)+ L21/L30 引用 `approved-plan-bytes-r5` 但 canonical L1635 用 `approved-plan-bytes-r4`(跨文件命名漂移)
- Verified-by: `grep final_gate_registry distinct flags` → 3 个 distinct flag(--verify-final-gate / --verify-final-audit-inputs / --verify-final-audit-regression),非之前误记的 7 个

### 1.4 非目标

- **不**在 v1 内引入 v3-lite / frozen_test_hashes / 分级减重(4 轮复审证明会破坏文件所有权)
- **不**改 task-dispatch-router 的决策矩阵(留给独立 proposal)
- **不**改 AGENTS.md §12.3 禁止场景和 §4.0 阻断规则
- **不**修复历史 M1 artifacts(v1 的 P0 boundary 明确"this plan repairs no M1 source or artifact")

---

## 二、解决方案

### 2.1 方案对比

| 方案 | 描述 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A. 新增 PHASE-07 | 在 v1 内加 phase 做减重 | 单 plan 完成 | 6/8 allowed_files 与 PHASE-01/03/05 所有权冲突(复审 R1 证伪) | ❌ 否决 |
| B. CLI flag 补齐 + r7 refreeze | 在 PHASE-01 step 6 补 flag + refreeze | 不加 phase | authority rule 禁止重写 r6 decision(复审 R2 证伪) | ❌ 否决 |
| C. 不改 plan text,按原设计推进 | spec drift 在 PHASE-01 实施中关闭 | 零修改 | validate-plan.ts 必然 FAIL + verify-final-* 无 phase 拥有(复审 R4 证伪) | ❌ 否决 |
| **D. r7 generation + 减重独立 proposal** | r7 按 r5→r6 先例修 spec drift;减重独立 plan | 遵循既定 generation 先例;scope 清晰 | r7 需重走 P0 preflight + HUMAN 批准 | ✅ 选择 |

### 2.2 核心设计

#### Part A:v1 r7 generation(修复 spec drift)

r7 遵循 r5→r6 的既定 generation 先例(canonical L21-27):

- **r6 decision 文件不被改写**(authority rule L18-19 "is never rewritten")
- **r6 保留为历史 generation**(与 r1-r5 同等地位)
- **r7 成为新的 authoritative generation**

**合法性依据**:不仅是 authority rule L18-19 的字面解释,更根本的是 **r6 decision 自身的 approval_effect 子句**(approval-decision-r6.json L81)明确授权:"Any semantic plan-file change requires a new approval request and decision." 这意味着 r6 decision 预见了后续 plan-text 变更的可能性,并规定了正确路径:新建 r7 approval-request → HUMAN 批准 → r7 decision 成为 authoritative。

r7 需修复三个 spec drift:

**Drift 1:PENDING_R6_FREEZE 占位符 → 填真实 hash**

在 `00-plan-index.md` 中:
- L12 `Canonical contract SHA-256`: `PENDING_R6_FREEZE` → 填 canonical 文件的实际 SHA-256
- L14 `Approved plan files SHA-256`: `PENDING_R6_FREEZE` → 填 approved-plan-files-r7.sha256 的实际 SHA-256
- L16 `Approved index baseline SHA-256`: `PENDING_R6_FREEZE` → 填 approved-index-baseline-r7.md 的实际 SHA-256

路径中的 `r6` 全部更新为 `r7`(approved-plan-files-r7 / approved-plan-object-set-r7 / approval-request-r7 / approval-decision-r7 等)。

**Drift 2:verify-final-* flag 补入 PHASE-01 step 6**

在 `01-phase-foundation-kernel.md` step 6 的模式清单(L124-138)中,补充 final-gate verification 系列模式(3 个 distinct flag):

```text
--verify-final-gate <GATE_ID> --canonical <path> --plan-root <path> --audit-root <path> --output <path>
--verify-final-audit-inputs --canonical <path> --plan-root <path> --audit-root <path> --output <path>
--verify-final-audit-regression --canonical <path> --plan-root <path> --audit-root <path> --output <path>
```

同时在 PHASE-01 的 allowed_files 中确认 `validate-phase-progression.ts` 的拥有权(当前已在 step 6 拥有,无需新增 allowed_files 条目)。

**双接口设计要求**:现有 11 个模式混合了 positional(如 `PLAN_ROOT PHASE-02`)和命名(如 `--create-scope-lock --phase ...`)。新增的 3 个 verify-final-* 模式全用命名 flag 且不含 positional 参数。现有脚本 L20-25 的 argv entry guard 强制 `argv[2]=planDir` + `argv[3]=targetPhaseId`,缺失则 `process.exit(2)`。因此脚本 argv parser 必须**重构**:先检测首个参数是否为命名 flag(如 `--verify-final-gate`),是则走 final-gate 路径(不需要 positional);否则 fallback 到现有 positional 路径。这不是简单追加,是对 entry guard 的结构性修改。

**Drift 3:跨文件 generation 引用漂移(3 个文件,不只 99-final)**

r5 引用横跨 3 个文件,不仅是 99-final:

**99-final-verification.md**(8 处):
- L12 标题 "9-r5 artifacts" → "9-r7 artifacts"
- L20 `approved-plan-files-r5.sha256` → `approved-plan-files-r7.sha256`
- L21 `approved-plan-bytes-r5` → `approved-plan-bytes-r7`
- L22 `approval-decision-r5.json` → `approval-decision-r7.json`
- L23/L31 `approved-plan-files-r5.sha256` → r7
- L30 `approved-plan-bytes-r5` → r7
- L137 `exact r5 plan/PHASE-01 decisions` → r7

**00-plan-index.md**(3 处):
- L173 章节标题 `### 8.2 r5 generation marker` → `### 8.2 r7 generation marker`
- L175 "the r5 freeze is the new authoritative generation" → r7(当前 r5 已不是 authoritative,这是 stale 文档)
- L177 追加 r6→r7 转换段("All *-r6.* path references are now *-r7.* because...")

**01-phase-foundation-kernel.md**(1 处):
- L154 `--plan-decision audits/.../approval-decision-r5.json` → `approval-decision-r7.json`(PHASE-01 bootstrap 命令引用的 decision 文件)

同时解决跨文件 bytes-mirror 命名漂移:canonical L1635/L1652 用 `approved-plan-bytes-r4`,99-final 用 `approved-plan-bytes-r5`。r7 统一新建 `approved-plan-bytes-r7` 目录(叠加,不覆盖历史 r4/r5 目录)。

#### Part A.1:PHASE-01 bootstrap 循环依赖解决方案(r7 generation 后发现)

**发现时机**:Part A 实施完成(r7 generation + materialization + 4 轮复审 ACCEPT)后,尝试启动 PHASE-01 admission 时发现。

**问题描述**:PHASE-01 是自指(self-referential)bootstrap phase——它实现自己使用的审计工具,但这些工具的第一个产出物(scope-lock)又需要用这些尚未实现的工具来机械生成。具体循环:

```
scope-lock 生成 → 需要 validate-phase-progression.ts --create-scope-lock 模式
                → 该模式由 PHASE-01 allowed-files step 6 负责实现(当前 160 行,仅支持 positional entry check)
                → Implementer B 需要 scope-lock 才能通过 prewrite_verification_command
                → scope-lock 无法机械生成 → 循环
```

**实测验证(VERIFIED)**:
- Verified-by: `bun run validate-phase-progression.ts --create-scope-lock` → exit code 2 + usage string `usage: bun run validate-phase-progression.ts <plan-dir> <next-phase-id>`(argv guard L21-23 因 targetPhaseId 缺失而拒绝;`--create-scope-lock` 被当作 planDir 但无第二参数)
- Verified-by: `validate-phase-progression.ts` 当前 argv guard L21-23 `if (!planDir || !targetPhaseId) { console.error("usage: ..."); process.exit(2); }` 强制 positional 接口;脚本动态解析 phase manifest(通过 `parseManifest(indexSource)` 从 00-plan-index.md 表格读取,**无 PHASE-01..06 硬编码**),但模式分派逻辑完全缺失
- Verified-by: canonical prewrite_verification_command L12 `await R(DP.approved_index_baseline,p.b)` 等校验要求 scope-lock + phase-approval 已存在
- Verified-by: canonical DEC-GR-006 "manual cryptographic binding or SHA synchronization is forbidden"(禁止手动构造 scope-lock)

**根因分析**:canonical 设计 PHASE-01 为 self-bootstrapping phase,但未解决"如何用尚未实现的工具生成第一个 scope-lock"的冷启动问题(cold-start)。`PHASE-01_P02A_ENTRY_WHILE_INDEX_BLOCKED` waiver 授权"entry while index blocked",但 prewrite_verification_command 仍要求 scope-lock 存在——waiver 未穿透到 prewrite 层。

**候选解决方案**:

| 方案 | 描述 | 优点 | 缺点 |
|---|---|---|---|
| **A1a. 先实现工具再生成 artifact** | Auditor 临时承担工具实现(打破严格角色分离),先实现 `--create-scope-lock` / `--create-session-manifest` / `--emit-producer-release` / `--create-phase-approval-request` 模式,再用这些工具机械生成 artifact | 不改 canonical 结构;工具实现后正式 Implementer B 接管后续 | 违反 DEC-GR-002 角色分离;Auditor 实现的代码需独立审计 |
| **A1b. 拆分 PHASE-01 为 PHASE-00 + PHASE-01** | PHASE-00:工具实现(allowed-files = 6 源文件 + 2 测试文件;无 scope-lock/prewrite 要求)。PHASE-01:审计流程(scope-lock/session-manifest/phase-approval/prewrite/EV/audit/adoption) | 彻底解除循环;每 phase 职责单一 | 需 r8 generation(plan text 结构变更);canonical 需重写 phase manifest |
| **A1c. 修改 prewrite 豁免 bootstrap scope-lock** | prewrite_verification_command 在 PHASE-01 bootstrap 阶段豁免 scope-lock 存在性校验(waiver 穿透) | 最小改动;不拆 phase | prewrite 语义弱化;需定义"何时不再是 bootstrap 阶段" |

**推荐方案**:**A1b(拆分 PHASE-00 + PHASE-01)**。

理由:
1. PHASE-01 当前承担了两个正交职责:(a) 工具实现(8 个源/测试文件)和 (b) 审计 bootstrap(scope-lock/session-manifest/phase-approval/EV/audit/adoption)。这两个职责有明确的先后依赖:工具必须先实现,才能机械生成审计 artifact。
2. 拆分后 PHASE-00 是工具实现 phase,evidence_level = component。它**不依赖跨 phase 的 governance artifact chain**(不要求前序 phase 的 audit report/projection),但**自产出 scope-lock**(通过两阶段自举解决,见下方设计)。
3. PHASE-01 降级为纯审计 bootstrap phase,其 allowed-files 缩减为 0 个源文件(不实现源码),只运行已有的工具生成 artifact。**注意**:PHASE-01 的 allowed-files 表为空仅指"source implementation files = 0";artifact output destinations(scope-lock/session-manifest/phase-approval 等产出路径)仍由 scope-lock/phase-approval schema 治理,不归 allowed-files 表管辖。
4. 这需要 r8 generation(plan text 结构变更),遵循 r6→r7 先例。

**PHASE-00 两阶段内部自举设计**(真正解决循环依赖):

PHASE-00 的循环问题:scope-lock 需要 `validate-phase-progression.ts --create-scope-lock`(未实现),而该工具是 PHASE-00 的 allowed-file。解决方法是 PHASE-00 内部分为两个有序阶段:

**阶段 0-α(工具实现)**:Implementer B 按固定顺序实现全部 8 个 allowed-files,重点是:
- `validate-phase-progression.ts`:新增 `--create-scope-lock` / `--create-session-manifest` / `--emit-producer-release` / `--create-phase-approval-request` 模式
- `capture-state.ts`:增强 dual-repository + `--upgrade-bootstrap-pre-change` + `--state-kind VERDICT` 支持
- 其他 6 个文件的 v3 增强

阶段 0-α 完成后,Implementer B 返回输出并 stops。此时工具链已存在但尚未被审计验证。

**阶段 0-β(自举审计)**:Auditor A 用**刚实现的工具**机械生成 PHASE-00 自身的审计 artifact:
1. `validate-phase-progression.ts --create-scope-lock --phase PHASE-00` → 生成 `scope-lock-PHASE-00-g001.json`(绑定 8 个 allowed-files 路径)
2. `validate-phase-progression.ts --create-session-manifest` → 生成 `session-role-manifest.json`
3. `capture-state.ts`(增强版)→ PRE_CHANGE / VERDICT 状态捕获
4. `generate-evidence-receipt.ts` + `prepare-audit.ts` → EV + prepared report
5. `validate-audit.ts` → valid:true

**关键合规性**:
- 阶段 0-α 的工具实现由 Implementer B 完成(不违反 DEC-GR-002)
- 阶段 0-β 的 artifact 生成由 Auditor A 用**刚实现的工具**完成(不违反 DEC-GR-006,因为 SHA 绑定是机械的,非手动的)
- 审计验证的对象是"工具实现的正确性"(8 个文件的代码 + 测试),不是"工具产出的 artifact"(scope-lock 等是审计的副产品,不是被审计对象)
- PHASE-00 的 evidence_level = component(工具实现的单元/组件测试),不是 file-integration(不依赖跨 phase governance artifact chain;自产出 scope-lock 通过两阶段自举)
- **DEC-GR-007 张力(已知设计约束)**:DEC-GR-007(L92-97)声明"validation never compares an old receipt with mutable current tool bytes"。阶段 0-β 消费刚由阶段 0-α 写入的工具(同 phase 内,未经独立时间窗审计),存在"fresh-but-unverified tool bytes"的语义张力。**缓解**:阶段 0-α 的工具字节由 fixed verification(8 测试 + typecheck)验证正确性;阶段 0-β 的 artifact 生成是对工具的**功能调用**(非哈希比对),因此 DEC-GR-007 的"old receipt vs mutable bytes"场景不直接适用。但 blueprint 显式记录此张力,供 r8 generation 审计时复核。

**与原 PHASE-01 bootstrap 的区别**:原 PHASE-01 的 prewrite_verification_command 要求 scope-lock + phase-approval 在 Implementer 写代码**之前**存在——这是导致循环的根源。PHASE-00 颠倒了这个顺序:先写代码(阶段 0-α),后生成 scope-lock(阶段 0-β)。

**阶段 0-α 的 PRE_CHANGE 处理**(修正 N2:现有 capture-state.ts 无 PRE_CHANGE 能力):
- 现有 156 行 capture-state.ts **不具备** PRE_CHANGE/VERDICT/state-kind 支持(grep 零命中)。因此阶段 0-α **不产生正式 PRE_CHANGE receipt**。
- 阶段 0-α 的变更前状态由 **git HEAD 快照**替代:Implementer B 开始前,Auditor A 记录当前 HEAD commit SHA + `git status --porcelain` 作为 informal pre-change baseline(写入 `logs/<date>-phase-00-pre-change-informal.md`)。这不是正式 governance receipt,是 component-level 审计的 informal 辅助。
- 阶段 0-β 的 VERDICT 用**增强版** capture-state.ts(阶段 0-α 已实现 dual-repo + state-kind + VERDICT),捕获变更后状态。PRE_CHANGE→VERDICT 的 delta 由 git HEAD diff + informal pre-change baseline 计算。
- **waiver**:PHASE-00 使用新 waiver `PHASE-00_COMPONENT_LEVEL_NO_FORMAL_PRE_CHANGE`,授权 component-level 审计省略正式 PRE_CHANGE receipt(git HEAD diff 替代)。此 waiver 需在 canonical `exact_waiver_ids` 和 `prewrite_verification_command` 中显式声明 PHASE-00 例外分支(phase=PHASE-00 时跳过 scope-lock 存在性校验)。

**A1b 实施步骤(r8 generation)**:

1. [ANALYSIS] 设计 PHASE-00 的 allowed-files(= 原 PHASE-01 step 1-8 的 8 个文件)+ completion gate(= fixed verification 8 测试 + typecheck + diff)+ 审计流程(component-level:scope-lock + capture-state PRE_CHANGE/VERDICT,无 prewrite)
2. [ANALYSIS] 设计 PHASE-01 的新角色(= 纯审计 bootstrap:0 源文件 allowed-files;运行已实现工具生成 scope-lock/session-manifest/phase-approval/EV/audit/adoption)
3. [GENERATE] 生成 approval-request-r8.json(包含 plan-text diff 摘要)
4. [GATE] HUMAN 批准 r8
5. [EDIT] 落盘 plan text 变更(见下方完整文件清单)
6. [VERIFY] validate-plan.ts exit 0(新 phase 结构)
7. [GENERATE] 生成 r8 artifacts(object-set / plan-files / baseline / request / decision)
8. [MATERIALIZE] r8 overlay 到 bootstrap worktree

**风险**:
- r8 拆分改变了 phase 结构,需重新审计 phase manifest 一致性
- PHASE-00 作为纯实现 phase,其 evidence_level = component(不要求 governance artifact chain)
- canonical 中多处引用 phase 数量(6→7)和 phase projection 编号(01..06 → 00..06),需逐一更新(见实施清单)
- final_gate_registry GATE-GR-FINAL-003 marker `ACCEPTED_CHAINS=6` 和 GATE-GR-FINAL-007 "six projections" 需更新为 7

#### Part B:减重独立 proposal(v1 r8 ACCEPT 后)

新 plan `plans/audit-governance-tiered-provenance-v1/`:

- provenance_level: `v3-required`(用 v3-required 审批自身,不循环授权)
- 在 v1 r8 final ACCEPT 后启动(届时工具链稳定可用,PHASE-00 已完成)

必须解决 6 个问题:

| # | 问题 | 设计要求 |
|---|---|---|
| 1 | v3-lite 判据 | "本地可逆+≤3文件+无外部副作用"写成 P-01 强制条件 + 错误码 `PROVENANCE_LEVEL_TIER_ABUSE` + 定义由谁校验 |
| 2 | v3-lite 审计者身份 | 不能是 Implementer 自签(违反 DEC-GR-002);候选:Auditor Session A / 强模型子 agent / 仅最终验收保留 human |
| 3 | delta 替代机制 | 免 pre-change 后 validate-audit.ts L1261 deltaPaths 退化;二选一:(a) v3-lite 保留 pre-change 只免 human approval + EV;(b) 实现基于 git HEAD diff 的替代 |
| 4 | frozen_test_hashes 完整覆盖 | 覆盖测试文件+被测源+配置(tsconfig/bunfig/package.json);conformance 禁止 `NODE_ENV==='test'` 分支;5 条伪造路径逐条封堵 |
| 5 | 迁移成本 | 23 个现有 scope-lock 实例 + 历史 audit reports 的处理(optional 字段 / 回填 / 版本区分) |
| 6 | verify-final-* flag ownership | 新 plan 不继承 v1 的 spec drift;在 PHASE-04 或独立 PHASE 显式拥有 final-gate 模式的 allowed_files |

### 2.3 子系统合规审计

| 子系统 | 影响 | 评估 |
|---|---|---|
| provenance-rules | Part B 扩展 P-01 取值集 + 新增 P-08 | ⚠️ Part B 触及 |
| scope-lock schema | Part B 新增 frozen_test_hashes + v3-lite 字段 | ⚠️ Part B 触及 |
| validate-audit.ts | Part B 增强(delta 替代 + frozen 校验) | ⚠️ Part B 触及 |
| validate-phase-progression.ts | Part A 补 final-gate flag;Part A.1 可能拆分 PHASE-00/01 | ⚠️ Part A + A.1 触及 |
| task-dispatch-router | Part B 交叉引用(不改决策矩阵) | ✅ 仅文档 |
| AGENTS.md | 不改 §12.3/§4.0 | ✅ 不触及 |
| 00-plan-index.md | Part A 填占位符 + r6→r7 路径更新;Part A.1 phase manifest 拆分 | ⚠️ Part A + A.1 触及 |
| canonical contract | Part A 恢复 generation history;Part A.1 phase ownership 重构 | ⚠️ Part A + A.1 触及 |
| PHASE-01 phase file | Part A.1 可能拆分为 PHASE-00 + PHASE-01 | ⚠️ Part A.1 触及 |

---

## 三、实施清单

### Part A:v1 r7 generation

| 序号 | 文件 | 变更类型 | 说明 |
|---|---|---|---|
| A1 | `formal-plan-set/00-plan-index.md` | 修改 | 填 3 个 PENDING_R6_FREEZE 占位符为真实 hash;r6→r7 路径更新;L7 admission state 更新;**L173 章节标题 r5→r7;L175 authoritative 叙述更新;L177 追加 r6→r7 段** |
| A2 | `formal-plan-set/01-phase-foundation-kernel.md` | 修改 | step 6 模式清单补充 3 个 verify-final-* 模式(含 4 个共享辅助 flag);描述段落补充 final-gate verification 说明;标注 argv entry guard 重构需求;**L154 approval-decision-r5→r7** |
| A3 | `formal-plan-set/99-final-verification.md` | 修改 | 8 处 r5 引用更新为 r7;bytes-mirror 目录名统一为 approved-plan-bytes-r7 |
| A4 | `canonical-requirements-contract.yaml` | 修改 | authority.generation history 新增 r7 条目;approval_freeze_registry 路径 r6→r7;**新增 materialization_commands r7 段(不改 L1636 原段,遵守 authority rule L18-19);新段跳过 worktree 存在性检查并用 -r7 文件名避开 put:wx 冲突(L1649)** |
| A5 | `audits/audit-governance-recovery-v1/` (9 artifacts) | 新建 | 生成 r7 版本的 9 个 artifacts |

### Part A.1:PHASE-01 bootstrap 循环依赖解决(r8 generation,Part A ACCEPT 后)

**状态**:设计阶段(待复审 + HUMAN 批准 r8)

| 序号 | 文件 | 变更类型 | 说明 |
|---|---|---|---|
| A1.1-a | `formal-plan-set/00-phase-toolchain-implementation.md` | 新建 | PHASE-00:纯工具实现 phase。allowed-files = 原 PHASE-01 step 1-8 的 8 个文件;completion gate = fixed verification(8 测试 + typecheck + diff);component-level 审计(scope-lock + capture-state PRE_CHANGE/VERDICT,无 prewrite) |
| A1.1-b | `formal-plan-set/01-phase-foundation-kernel.md` | 修改 | PHASE-01 降级为纯审计 bootstrap phase:移除 allowed-files 表(source = 0)和 fixed-verification(移至 PHASE-00);保留 bootstrap transaction 流程(scope-lock/session-manifest/phase-approval/EV/audit/adoption);depends on 改为 PHASE-00 |
| A1.1-c | `formal-plan-set/00-plan-index.md` | 修改 | phase manifest 从 6 phases(PHASE-01..06)改为 7 phases(PHASE-00..06);§5 requirement ownership REQ-GR-001/004-010 拆分(PHASE-00 拥有实现;PHASE-01 拥有 bootstrap);§6 allowed-file inventory 新增 PHASE-00 行 |
| A1.1-d | `formal-plan-set/02-phase-single-closure-entrypoint.md` | 修改 | L14 引用 "PHASE-01's allowed-step #6" → "PHASE-00's allowed-step #6"(工具来源迁移);depends on 不变(仍为 PHASE-01) |
| A1.1-e | `formal-plan-set/99-final-verification.md` | 修改 | L10 "PHASE-01..06 ACCEPTED" → "PHASE-00..06 ACCEPTED";L137 "exact r7 plan/PHASE-01 decisions" → 厘清(工具实现移至 PHASE-00,PHASE-01 仅 bootstrap) |
| A1.1-f | `canonical-requirements-contract.yaml`(authority + artifact_dag) | 修改 | (1) `approved_plan_object_set` 约束 entry_count 8→9 + "PHASE-01..06" → "PHASE-00..06";(2) artifact_dag 的 `phase_projection_01..06` → `phase_projection_00..06`(12+ 处引用:typed_edge_fixture nodes L1037-1043、contract_final/evidence_final L1015-1017、auditor_semantic_decision L1011 等);(3) `forbidden_edges` L974 "legacy-bootstrap -> any phase other than PHASE-01" 保持(PHASE-00 不解析 legacy receipt) |
| A1.1-g | `canonical-requirements-contract.yaml`(dataflow_pipeline) | 修改 | dataflow_pipeline 前 3 行 phase=PHASE-01 的工具实现 producer → phase=PHASE-00;PHASE-01 的 consumer_gate 改为"receives PHASE-00 implemented tools" |
| A1.1-h | `canonical-requirements-contract.yaml`(final_gate_registry) | 修改 | GATE-GR-FINAL-003 oracle marker `ACCEPTED_CHAINS=6` → `ACCEPTED_CHAINS=7`;GATE-GR-FINAL-007 "six projections" → "seven projections";GATE-GR-FINAL-003 "PHASE-01 through PHASE-06" → "PHASE-00 through PHASE-06" |
| A1.1-i | `canonical-requirements-contract.yaml`(phase_01_release_command + bootstrap) | 修改 | `phase_01_release_command` → `phase_00_release_command`(或保留名称但注释归属 PHASE-00);PHASE-01 bootstrap 流程更新(引用 PHASE-00 已实现的工具) |
| A1.1-j | `canonical-requirements-contract.yaml`(approval_freeze_registry) | 修改 | semantic_logical_paths 新增 `00-phase-toolchain-implementation.md`(9 个文件);object-set entry_count 8→9 |
| A1.2 | `audits/audit-governance-recovery-v1/` (r8 artifacts) | 新建 | 生成 r8 版本的 9 个 artifacts(canonical/plan-files/object-set/baseline/request/decision/pending/m1-manifest/p4-boundary) |

**关键时序约束**:与 Part A 相同,HUMAN 批准 r8 必须在 plan text 落盘之前(approval-decision-r7 L81 approval_effect)。

### Part B:减重独立 proposal(v1 r8 ACCEPT 后)

| 序号 | 文件 | 变更类型 | 说明 |
|---|---|---|---|
| B1 | `plans/audit-governance-tiered-provenance-v1/` | 新建 | 完整 plan-set(canonical + 00-index + phase files + 99-final) |
| B2 | `blueprints/INDEX.md` | 修改 | 新增本 blueprint 条目 |

### 实施步骤

**关键时序约束**:per approval-decision-r6.json L81 approval_effect,"Any semantic plan-file change requires a new approval request and decision." 因此 **HUMAN 批准 r7 必须在任何 plan text 落盘之前**。

**Part A(r7 generation)— 正确时序**:

1. [ANALYSIS] 计算 r7 plan text 变更后的 canonical/00-index/01-phase/99-final 预期 SHA-256(在草稿区/内存中,不落盘)
2. [GENERATE] 生成 `approval-request-r7.json`(包含 r7 的 plan-text diff 摘要 + 预期 SHA + 9 artifacts 清单)
3. **[GATE] HUMAN 批准 r7** → 生成 `approval-decision-r7.json`(此时 plan text 尚未落盘,批准的是"将要做的变更")
4. [EDIT] 落盘 plan text 修改:00-plan-index(A1)+ 01-phase(A2)+ 99-final(A3)+ canonical(A4,新增 r7 materialization 段,不改原段)
5. **[VERIFY-SHA] 重新计算步骤 4 落盘文件的实际 SHA-256,与步骤 2 approval-request-r7.json 中绑定的预期 SHA 逐字节比对。若不等则回滚步骤 4(草稿 SHA 与落盘字节不变量)**
6. [GENERATE] 生成 9 个 r7 artifacts(全部用 -r7 后缀,避开 L1649 put:wx 与 r6 同名文件冲突)
7. [WORKTREE] materialization 使用 A4 新增的 r7 段(跳过 `test ! -e` 检查),在已存在的 bootstrap worktree 上叠加写入 r7 文件。不清除旧 worktree(保留 r6 authoritative 物理证据)
8. [VERIFY] `validate-plan.ts` exit 0(占位符已填 + SHA 一致)
9. [VERIFY] PHASE-01 step 6 模式清单覆盖 final_gate_registry 的全部 flag(3 主 + 4 辅助 = 7 token)
10. [VERIFY] 99-final + 00-index + 01-phase 全部 r5 引用已更新为 r7(grep "r5" 在 formal-plan-set/ 零命中,排除 r5 历史叙述)

**Part B(独立 proposal)**:v1 r8 final ACCEPT 后启动(PHASE-00 工具链已实现),另立 plan,不在本 blueprint scope 内详述。

---

## 四、验证计划

### 4.1 单元与组件

- [ ] `validate-plan.ts plans/audit-governance-recovery-v1/formal-plan-set` exit 0
- [ ] `validate-phase-progression.ts plans/.../formal-plan-set <next-phase>` 能解析全部 flag
- [ ] PHASE-01 step 6 模式清单覆盖 final_gate_registry 全部 flag(3 主 + 4 辅助 = 7 token)

### 4.2 集成

- [ ] 9 个 r7 artifacts 全部生成且 SHA 一致
- [ ] P0 preflight 6 个 hard-gate 全部 PASS
- [ ] formal-plan-set/ 全部 r5 引用已更新为 r7(grep "r5" 零命中,排除历史叙述段落)
- [ ] bytes-mirror 目录名跨文件一致(canonical 与 99-final 都指向 approved-plan-bytes-r7)
- [ ] materialization 在已存在 worktree 上叠加写入成功(不清 worktree)
- [ ] 草稿 SHA 与落盘字节一致(步骤 5 验证通过)

### 4.3 Runtime

- [ ] PHASE-01 实施后,validate-phase-progression.ts 支持 `--verify-final-gate GATE-GR-FINAL-001` 命令(命名接口)
- [ ] 99-final 的 `--final-readiness` / `--final` 命令仍可运行(positional 接口,双接口兼容)
- [ ] argv entry guard 重构:命名 flag 不要求 positional 参数

---

## 五、风险与缓解

| 风险 | 等级 | 缓解 |
|---|---|---|
| r7 generation 被误读为"重写 r6 decision"违反 authority rule | 高 | r7 遵循 r5→r6 先例 + r6 decision L81 approval_effect 明确授权;双重依据 |
| **HUMAN 批准时序违规** | 高 | **实施步骤已修正:HUMAN 批准在步骤 3,先于 plan text 落盘(步骤 4)**;依据 approval-decision-r6.json L81 |
| **materialization worktree 硬阻塞** | 高 | **步骤 7 使用 A4 新增 r7 段(跳过 test ! -e),叠加写入不清 worktree;保留 r6 物理证据** |
| **草稿 SHA 与落盘字节不一致** | 高 | **步骤 5 显式比对落盘 SHA 与 approval-request SHA,不等则回滚** |
| PHASE-01 双接口实现复杂(重构 argv entry guard) | 高 | **L20-25 entry guard 必须重构:先检测命名 flag → 走 final-gate 路径;否则 fallback positional**;需回归测试矩阵覆盖 11 现有 + 3 新模式 |
| **PHASE-01 bootstrap 循环依赖(scope-lock 冷启动)** | **高** | **Part A.1 方案 A1b:拆分 PHASE-00(工具实现)+ PHASE-01(审计 bootstrap);r8 generation 解决;PHASE-00 通过两阶段内部自举(0-α 工具实现 → 0-β 自举审计)打破循环;PHASE-00 evidence_level = component** |
| **r8 拆分改变 phase 结构** | 中 | **需重新审计 phase manifest 一致性;validate-phase-progression 动态解析 manifest(无硬编码),只需 00-index 表格新增 PHASE-00 行即可自动识别;canonical 多处 phase 数量/projection 编号引用需更新(见实施清单 A1.1-f~h);evidence_level 调整(PHASE-00 = component)** |
| Part B 6 个问题设计复杂 | 中 | 拆子 phase 逐个解决;启动时先做 impact analysis |
| 23 个现有 scope-lock 实例迁移 | 中 | frozen_test_hashes 做成 optional;历史不回填 |

### 回滚方案

- Part A 回滚:保留 r6 artifacts 不删除;r7 如果失败,回退到 r6 的 PENDING_REFREEZE 状态
- Part B 回滚:独立 plan,不影响 v1;失败则保持 v3-required 单一档

---

## 六、成功标准

- [x] v1 的 `validate-plan.ts` exit 0(占位符已填) — Part A 已完成(4 轮复审 ACCEPT)
- [x] PHASE-01 step 6 覆盖 final_gate_registry 全部 3 个 distinct flag — Part A 已完成
- [x] 99-final-verification.md 全部 r5 引用更新为 r7(grep "r5" 零命中) — Part A 已完成
- [x] HUMAN 批准 r7 在 plan text 落盘之前完成(时序合规) — Part A 已完成(用户授权)
- [x] materialization worktree 硬阻塞已处理 — Part A 已完成(r7 overlay)
- [x] r7 generation 的 9 个 artifacts 生成 — Part A 已完成
- [ ] **PHASE-01 bootstrap 循环依赖已解决** — Part A.1(拆分 PHASE-00 + PHASE-01,r8 generation)
- [ ] **PHASE-00 可独立实施(无 governance artifact 循环依赖)** — Part A.1
- [ ] **r8 generation 的 plan text + artifacts 生成** — Part A.1
- [ ] 减重独立 proposal 启动(v1 r8 ACCEPT 后,PHASE-00 工具链已实现) — Part B
- [x] 本 blueprint 在 blueprints/INDEX.md 登记 — 已完成

---

## 七、附录

### 相关文件

- `plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml`
- `plans/audit-governance-recovery-v1/formal-plan-set/00-plan-index.md`
- `plans/audit-governance-recovery-v1/formal-plan-set/01-phase-foundation-kernel.md`
- `.agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts`
- `.agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts`

### 参考资料

- 4 轮 plan 复审结论(本会话)
- `blueprint-audit-governance-evidence-and-status-closure-v3.md`(上游设计)
- `logs/2026-07-31-v1-r6-materialization-complete.md`(r6 materialization 记录)
