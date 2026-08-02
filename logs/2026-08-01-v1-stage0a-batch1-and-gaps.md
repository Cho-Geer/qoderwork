# v1 Stage 0-α Batch 1 + G1-G5 Gap Report

> **Session**: check-plan
> **Date**: 2026-08-01
> **Scope**: PHASE-00 Stage 0-α continuation — marker stub upgrade Batch 1 + gap discovery

## 1. 为什么

PHASE-00 Stage 0-β self-bootstrap 需要 14-mode 工具链产出真实 artifacts。当前 10 个 marker stub modes 只 emit `STAGE_0α_NOT_INSTALLED`。本会话开始升级 stubs 为真实实现。

## 2. 改了什么

### Batch 1 实施（2 modes → real implementations）

| Mode | Schema | Status |
|------|--------|--------|
| `--create-session-manifest` | `audit-session-role-manifest/v1` | ✅ real impl + test rewrite |
| `--create-phase-approval-request` | `audit-phase-approval-request/v1` | ✅ real impl + test rewrite |

**改动文件**（bootstrap worktree `audit-governance-recovery-v1-bootstrap`）：
- `.agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts` (+~140 lines)
- `.agents/skills/deterministic-implementation-planning/scripts/__tests__/validate-phase-progression-14-modes.test.ts` (DC-MODE-001/003 rewritten)

**验证**: 145 pass / 0 fail, typecheck exit 0, diff-check exit 0, CLI smoke 3/3 PASS。

### 三层 Accept 链
| Layer | Agent | Verdict |
|---|---|---|
| Execute | M3 (agent_7296eb36) | Self-Pass: 2 modes + test rewrite |
| Independent verify | main session | 145 test rerun + CLI smoke + scope check |
| Independent audit | GLM-5.2 (agent_25907635) | ACCEPT with conditions (I1-I6, all Stage 0-β deferred) |

## 3. 决策

- **Batch 策略**: 按 GLM-5.2 推荐修正版分批（Batch 1 = 2 producer modes 先做）
- **Scope 发现 G1/G2**: `prepare-audit.ts --bootstrap-activate-and-close` 缺失是 PHASE-01 Stage 0-β hard blocker，但不在 Batch 1 scope 内，记录为 plan-text defect

## 4. 更新了什么文档

- 本日志（新建）
- 无其他文档更新（代码改动在 bootstrap worktree，非 check-plan worktree）

## 5. GLM-5.2 发现的 Gaps（供后续 session 跟进）

| Gap | 描述 | Severity | Owner |
|-----|------|----------|-------|
| G1 | PHASE-01 L111 引用 `validate-phase-progression.ts --bootstrap-activate-and-close`，但该 mode 归属于 `prepare-audit.ts`（contract L1095）| plan-text defect | next session |
| G2 | `prepare-audit.ts` 也未实现 `--bootstrap-activate-and-close` | PHASE-01 hard blocker | Batch 1.5 or Batch 2 |
| G3 | 升级 mode 时必须同步重写 DC-MODE-NNN-P 测试（marker→schema assertion）| required work | per-batch |
| G4 | DC-MODE-ARG-GUARD-P 测试名与行为反转 | test quality | when argv guard touched |
| G5 | `--stage-status` 在每个 PHASE-01..06 closure 关键路径上，不应延迟 | batching correction | Batch 2 |
| I1 | `phase-approval-request` 缺 `qoderwork_baseline` ref edge（DAG L1038 要求）| Stage 0-β deferred | Stage 0-β |
| I2 | `*_sha256` scalar vs `{path, sha256}` ref tuple 不一致 | Stage 0-β deferred | Stage 0-β |
| I3 | missing task ID 应返回 `SESSION_ROLE_MISSING` code | NON-BLOCKING | Stage 0-β |
| I4 | DC-MODE-003 缺少负测试 | NON-BLOCKING | test improvement |

## 6. 剩余 Batches

| Batch | Modes | Timing |
|-------|-------|--------|
| Batch 1.5 | `--emit-producer-release` (+ independent_oracle test harness) | 独立并行 |
| Batch 2 | `--closed-phase`, `--stage-status`, `--stage-final-status`, `--final-readiness`, `--final` | after Batch 1 |
| Batch 3 | `--verify-final-gate`, `--verify-final-audit-inputs`, `--verify-final-audit-regression` | PHASE-99 only |

## 7. Batch 1.5 实施（--emit-producer-release）

### 改了什么

`--emit-producer-release` marker stub → 真实实现（9 步算法）：
1. 解析 canonical YAML `producer_release_registry`（line-scan parser，提取 case-set add_paths + inherit chain）
2. Path normalization（repo-relative POSIX, reject absolute/`..`）
3. Static TS import traversal（3 regexes: import-from / bare import / export-from; visited set; relative resolution）
4. Content-addressed object 写入（sha256 of raw bytes → objects/sha256/<hash>，openSync "wx" + EEXIST no-op）
5. Registry projection（6 keys: case_set, inheritance_chain, explicit_paths, recursive_roots, governance_profile, producer_version）
6. Hash chain: release_id = sha256([canonical_sha256, projection_sha256, source_set_sha256, commit, producer_version])
7. Manifest 写入（14 top-level keys, entries sorted, bytes = {sha256} object）

**改动文件**（3 files, bootstrap worktree）：
- `phase-progression.ts` — 新增 5 helpers: `sha256Bytes`, `normalizeRegistryPath`, `parseProducerRegistry`, `resolveProducerCaseSet`, types
- `validate-phase-progression.ts` — `--emit-producer-release` block 替换为真实实现
- `__tests__/validate-phase-progression-14-modes.test.ts` — DC-MODE-004-P/N 重写

### 验证

- 146 pass / 0 fail / 493 expect() calls
- typecheck exit 0, diff-check exit 0
- CLI smoke with REAL canonical contract + PHASE-01: exit 0, 8 tool_sources + 2 transitive_deps, manifest schema valid
- 负测试 unknown case-set → exit 2 + PRODUCER_RELEASE_CASE_SET_NOT_FOUND

### 三层 Accept 链

| Layer | Agent | Verdict |
|---|---|---|
| Execute | M3 (agent_651280c4) | Self-Pass: full 9-step algorithm + test rewrite |
| Independent verify | main session | 146 test rerun + CLI smoke with real canonical + schema validation |
| Independent audit | GLM-5.2 (agent_67ec124c) | Rework: Issue 1 BLOCKING (parser bogus case-sets) + Issues 2-6 NON-BLOCKING |
| Fix | M3 (agent_75462e83) | Fixed Issue 1 (whitelist case-set ids) + Issue 2 (fail-closed inherit) + Issue 3 (.tsx ext) |
| Final Gate | main session | ACCEPT after fix verification |

### GLM-5.2 发现的问题

| Issue | Severity | Status |
|-------|----------|--------|
| I1: parser 创建 bogus case-sets (manifest_schema 等) | **BLOCKING** | ✅ Fixed (whitelist `/^[A-Z][A-Z0-9_-]*$/`) |
| I2: missing inherit ancestor silently tolerated | NON-BLOCKING | ✅ Fixed (fail-closed return null) |
| I3: manifest write 非 exclusive | NON-BLOCKING | Stage 0-β deferred |
| I4: ensureTsExtension mangles .cts/.mts/.tsx | NON-BLOCKING | ✅ Fixed (check all TS extensions) |
| I5: symlink/out-of-root/case-fold detection | NON-BLOCKING | Stage 0-β deferred |
| I6: canonical_contract in release_id ambiguous | NON-BLOCKING | documentation only |
| independent_oracle 第二遍历 + 8 failure fixtures | required by canonical | Stage 0-β deferred |

### 更新了什么文档

- 本日志（追加 §7）

### 当前 Stage 0-α 进度

| Mode | Status |
|------|--------|
| `--create-scope-lock` | ✅ real (pre-existing) |
| `--create-session-manifest` | ✅ real (Batch 1) |
| `--create-phase-approval-request` | ✅ real (Batch 1) |
| `--emit-producer-release` | ✅ real (Batch 1.5) |
| `--closed-phase` | ✅ real (Batch 2) |
| `--final-readiness` | ✅ real (Batch 2) |
| `--final` | ✅ real (Batch 2) |
| `--stage-status` | ✅ real (Batch 2) |
| `--stage-final-status` | ✅ real (Batch 2) |
| `--verify-final-gate` | ⬜ marker stub (Batch 3) |
| `--verify-final-audit-inputs` | ⬜ marker stub (Batch 3) |
| `--verify-final-audit-regression` | ⬜ marker stub (Batch 3) |

**9/14 modes real, 3 marker stubs remaining** (Batch 3 scope only).

## 8. Batch 2 实施（5 progression/status modes）

### 改了什么

5 个 marker stub modes → 真实实现：
- `--closed-phase`: 检查 overlay 存在性，fail-closed `CLOSED_PHASE_OVERLAY_MISSING`
- `--final-readiness`: 读 phase manifest，报告 `phases_declared` count
- `--final` / `--final --overlay-root`: 写 `audit-plan-final-progression/v1` receipt，含 PLAN_INDEX_MISSING guard + output try/catch
- `--stage-status`: 写 `audit-status-publication/v1` receipt 到 transaction-dir，fail-closed `STATUS_PUBLICATION_UNAUTHORIZED`
- `--stage-final-status`: 写 final variant status-publication-receipt（scope: "final"）

**改动文件**（2 files, bootstrap worktree）：
- `validate-phase-progression.ts` — 5 mode blocks 替换 + BLOCKING fix（--final existsSync guard + output try/catch）
- `__tests__/validate-phase-progression-14-modes.test.ts` — DC-MODE-006~011 重写 + DC-MODE-008-N 新增

### 验证

- 154 pass / 0 fail / 558 expect() calls
- typecheck exit 0, diff-check exit 0
- CLI smoke: 5 modes 全部 exit 0，on-disk schemas 正确
- 负测试: CLOSED_PHASE_OVERLAY_MISSING, STATUS_PUBLICATION_UNAUTHORIZED, PLAN_INDEX_MISSING 全部 exit 2

### 三层 Accept 链

| Layer | Agent | Verdict |
|---|---|---|
| Execute | M3 (agent_537e819f) | Self-Pass: 5 modes + test rewrite |
| Independent verify | main session | 154 test rerun + CLI smoke 7 个 |
| Independent audit (R1) | GLM-5.2 (agent_9e92375b) | Rework: 1 BLOCKING (--final uncaught ENOENT) + 6 NON-BLOCKING |
| Fix | M3 (agent_b266a86f) | Fixed existsSync guard + try/catch + DC-MODE-008-N |
| Independent audit (R2) | GLM-5.2 (agent_32c4427d) | ACCEPT — fix verified, no regressions, no new BLOCKING |
| Final Gate | main session | ACCEPT |

### GLM-5.2 发现的问题（Batch 2）

| Issue | Severity | Status |
|-------|----------|--------|
| --final uncaught ENOENT (exit 1 not 2) | **BLOCKING** | ✅ Fixed (existsSync guard + try/catch + DC-MODE-008-N) |
| --stage-status path-injection via --phase | NON-BLOCKING | Stage 0-β deferred |
| --closed-phase accepts file as overlay | NON-BLOCKING | Stage 0-β deferred |
| --final-readiness phases_declared:0 ok:true | NON-BLOCKING | Stage 0-β deferred |
| schema_version strings not in canonical | NON-BLOCKING | Stage 0-β deferred |
| field-name drift (before_projections vs _sha256) | NON-BLOCKING | Stage 0-β deferred |

## 9. G1/G2 实施（prepare-audit.ts --bootstrap-activate-and-close）

### 改了什么

在 `prepare-audit.ts` 新增 `--bootstrap-activate-and-close` CLI mode（+174 lines）：
- 解析 phase ID + 6 flags（--plan-root, --prepared-report, --plan-decision, --phase-decision, --producer-release, --transaction-dir）
- 验证所有输入存在 + JSON 可解析（fail-closed exit 1）
- 计算 5 个 sha256（plan-decision, phase-decision, producer-release, prepared-report, plan-index）
- 写入 4 个 transaction artifacts:
  - `activation-receipt.json`（schema: `audit-bootstrap-activation/v1`）
  - `publication-receipt.json`（schema: `audit-bootstrap-publication/v1`）
  - `progression-receipt.json`（schema: `audit-bootstrap-progression/v1`, prev=NOT_STARTED → new=ACCEPTED）
  - `published/audit-report.md`（prepared report 的字节精确复制）
- Stage 0-α scope: artifact generation only。原子状态变更 + waiver consumed 逻辑 deferred to Stage 0-β

**改动文件**（1 file, bootstrap worktree）：
- `prepare-audit.ts` — 新增 `runBootstrapActivateAndClose()` 函数 + `main()` 顶部 dispatch

### 验证

- 154 pass / 0 fail / 558 expect() calls（现有测试不受影响）
- typecheck exit 0, diff-check exit 0
- CLI smoke: exit 0, 4 artifacts schemas 正确, sha256 fields 完整
- 负测试: missing phase ID exit 1, missing file exit 1

### 三层 Accept 链

| Layer | Agent | Verdict |
|---|---|---|
| Execute | M3 (agent_fc10b769) | Self-Pass: +174 lines, 4 artifacts, CLI smoke pass |
| Independent verify | main session | 154 test rerun + CLI smoke + 负测试 exit code |
| Independent audit | GLM-5.2 (agent_d0ea1030) | ACCEPT with documentation follow-ups (5 NON-BLOCKING) |
| Final Gate | main session | ACCEPT |

### GLM-5.2 发现的问题

| Issue | Severity | Status |
|-------|----------|--------|
| published/ vs prepared/ 目录名差异 | NON-BLOCKING | Stage 0-β alignment |
| auditor-findings.md 未生成 | NON-BLOCKING | 正确行为（Auditor A 手写，非 producer 工具） |
| 无 wx 保护（重跑覆盖） | NON-BLOCKING | Stage 0-β wx guard |
| 无 workspace containment 检查 | NON-BLOCKING | Stage 0-β path guard |
| 无新测试文件 | NON-BLOCKING | Stage 0-β test coverage |

### G1 plan-text inconsistency 状态

PHASE-01 L111 仍引用 `validate-phase-progression.ts --bootstrap-activate-and-close`（错误），canonical L1095 归属 `prepare-audit.ts`（正确）。**G1 plan-text fix 未执行**（修改 plan file 不在当前 code 实施 scope 中）——记录为后续 plan-text revision item。

### 当前 Stage 0-α 完整进度

| Mode/Feature | Status |
|------|--------|
| `--create-scope-lock` | ✅ real |
| `--create-session-manifest` | ✅ real (Batch 1) |
| `--create-phase-approval-request` | ✅ real (Batch 1) |
| `--emit-producer-release` | ✅ real (Batch 1.5) |
| `--closed-phase` | ✅ real (Batch 2) |
| `--final-readiness` | ✅ real (Batch 2) |
| `--final` | ✅ real (Batch 2) |
| `--stage-status` | ✅ real (Batch 2) |
| `--stage-final-status` | ✅ real (Batch 2) |
| `--verify-final-gate` | ⬜ Batch 3 (PHASE-99 only) |
| `--verify-final-audit-inputs` | ⬜ Batch 3 (PHASE-99 only) |
| `--verify-final-audit-regression` | ⬜ Batch 3 (PHASE-99 only) |
| `prepare-audit.ts --bootstrap-activate-and-close` | ✅ real (G1/G2) |

**9/14 validate-phase-progression modes real + 1 prepare-audit mode real = 10/15 total real**

## 10. Step 6 实施（capture-state.ts --state-kind VERDICT）

### 改了什么

在 `capture-state.ts` 新增 `--state-kind VERDICT` dual-repository 捕获 mode（+101 lines）：
- 解析 7 flags（--qoderwork-root, --work-one-root, --scope-lock, --phase-approval, --session-roles, --producer-release, --output）
- 调用现有 `captureRepositoryState()` 两次（qoderwork + work-one），共享 capturedAt 时间戳
- 不 mutate scope-lock（canonical L225 要求；freezeAt 不传入）
- 产出 `audit-workspace-state/v1` / `workspace-state-receipt` / `kind: VERDICT` receipt
- 包含 dual repo HEAD + status_entries + 4 个 sha256 input fields
- `flag: "wx"` 写保护 + 完整性检查

**改动文件**（1 file, bootstrap worktree）：
- `capture-state.ts` — VERDICT 分支（L122-211），现有单 repo 逻辑不变

### 验证

- 154 pass / 0 fail / 558 expect() calls
- typecheck exit 0, diff-check exit 0
- CLI smoke: qoderwork 193 entries + work-one 0 entries, dual HEAD 40-char, schema valid
- 单 repo regression: 仍正常工作（canonical_sha256 输出不变）
- 负测试: missing --output exit 1, relative root exit 1

### 三层 Accept 链

| Layer | Agent | Verdict |
|---|---|---|
| Execute | M3 (agent_be87d46c) | Self-Pass: +101 lines, dual-repo capture |
| Independent verify | main session | 154 test rerun + CLI smoke + regression + negative |
| Independent audit | GLM-5.2 (agent_3a0e603c) | ACCEPT with tracked follow-ups (6 NON-BLOCKING) |
| Final Gate | main session | ACCEPT |

### GLM-5.2 发现的问题

| Issue | Severity | Status |
|-------|----------|--------|
| VERDICT schema 未注册到 v3 SCHEMA_PAIRS | NON-BLOCKING | Stage 0-β register |
| 无 same-repo guard（qoderwork == work-one 不报错） | NON-BLOCKING | Stage 0-β guard |
| stdout 缺 canonical_sha256 | NON-BLOCKING | polish |
| 内部 receipt phase_id="VERDICT" 与 lock_id 不匹配 | NON-BLOCKING | transient, not persisted |
| argv indexOf first-wins | NON-BLOCKING | consistent with file convention |
| --state-kind=VERDICT equals-form 不支持 | NON-BLOCKING | consistent with file convention |

### PHASE-01 bootstrap 依赖链完整状态

| Step | Tool | Status |
|------|------|--------|
| 1 | --create-session-manifest | ✅ real (Batch 1) |
| 2 | --create-scope-lock | ✅ real (pre-existing) |
| 3 | --create-phase-approval-request | ✅ real (Batch 1) |
| 4 | --emit-producer-release | ✅ real (Batch 1.5) |
| 5 | capture-state --upgrade-bootstrap-pre-change | ✅ real (pre-existing) |
| 6 | capture-state --state-kind VERDICT | ✅ real (Step 6) |
| 7-8 | prepare-audit --bootstrap-activate-and-close | ✅ real (G1/G2) |

**PHASE-01 bootstrap 依赖链全部 8 步工具就绪。** 可进入 Stage 0-β self-bootstrap 试跑。

### Stage 0-α 最终完整进度

| Feature | Status |
|---------|--------|
| validate-phase-progression modes | 9/12 real (3 verify-final = Batch 3) |
| prepare-audit --bootstrap-activate-and-close | ✅ real |
| capture-state --state-kind VERDICT | ✅ real |
| capture-state --upgrade-bootstrap-pre-change | ✅ real (pre-existing) |
| **总计** | **11/15 real** |
