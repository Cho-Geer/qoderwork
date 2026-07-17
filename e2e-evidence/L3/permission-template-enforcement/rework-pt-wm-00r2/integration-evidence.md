# PT-WM-00R2 Reviewer级 Live E2E + Active-Dispatcher 集成测试证据

**Reviewer (QoderWork 强模型)**: 2026-07-14
**Worktree**: `/home/zhaoge/workspace/opencode/work-one` (commit 722017fe, dirty)
**隔离 DB**: `tempDir/framework-state.db` (per-test, fs.mkdtempSync)
**硬门环境**: `FRAMEWORK_SKILL_READ_HARD_GATE=1` (process-level, beforeEach)
**OPENCODE_ROOT**: tempDir (per-test, mirrors real work-one path)

---

## 1. Active-Dispatcher 集成测试 (NEW)

**文件**: `/home/zhaoge/workspace/opencode/work-one/.opencode/plugins/__tests__/skill-hard-gate-integration.test.ts`
**状态**: Untracked (newly created per Blueprint §3.1 00R2 修复要求)
**基线来源**: 参考 `qoderwork/scripts/_b1_live.ts` live test 模式

**测试结果** (Verified-by `bun test ./.opencode/plugins/__tests__/skill-hard-gate-integration.test.ts`):

| Test ID | 描述 | 结果 | 耗时 |
|---------|------|:---:|---:|
| T-PT-004-a | dispatcher loads with hard gate env | ✓ pass | 20.64ms |
| T-PT-004-b | safe_edit + hard gate ON + 无 attestation → skill-policy 硬阻断 | ✓ pass | 8.48ms |
| T-PT-004-c | safe_shell + hard gate ON + 无 attestation → skill-policy 硬阻断 | ✓ pass | 6.02ms |
| T-PT-004-d | pre-attest allowlist (read) 通过 dispatcher | ✓ pass | 6.29ms |
| T-PT-002 | tamper 负向 — runtime attestation 要求 agent+session+worktree 一致 | ✓ pass | 2.57ms |
| T-PT-050 | active order — 错误来源 `[skill-read-attest-required]` 证明 skill-policy 在 tool-governance 之前运行 | ✓ pass | 4.92ms |

**总计**: 6/6 pass, 13 expect() calls, 134ms.

---

## 2. 综合回归测试 (component + integration + baseline)

**命令** (Verified-by 合并 4 个 test 文件的 bun test):
```
cd /home/zhaoge/workspace/opencode/work-one && bun test \
  ./.opencode/plugin-handlers/before/__tests__/skill-policy.test.ts \
  ./.opencode/service/session/__tests__/skill-attest.test.ts \
  ./.opencode/service/tool-governance/__tests__/ \
  ./.opencode/plugins/__tests__/skill-hard-gate-integration.test.ts
```

**结果**: **58 pass / 0 fail / 139 expect() calls / 238ms** (13 files)

| Test 文件 | 覆盖 | 通过 |
|----------|------|-----:|
| skill-attest.test.ts | T-PT-039/040/042 + identity 验证 | 6 |
| skill-policy.test.ts | T-PT-041/046 + ADV-PT-008 (component) | 5 |
| tool-governance baseline | permission-policy / shell-policy / context (无回归) | 41 |
| **skill-hard-gate-integration.test.ts** | **T-PT-004 (active dispatcher) + T-PT-050 (active order) + T-PT-002 (tamper)** | **6** |

---

## 3. Source 修复对账 (复跑前轮 source/component 证据)

| 根因 | 文件:行 | 状态 |
|------|---------|:---:|
| 共享 identity resolver 定义 | `.opencode/service/session/skill-attest.ts:106-128` | ✓ |
| Writer 调用共享 resolver | `.opencode/service/session/skill-attest.ts:170` | ✓ |
| Validator 调用共享 resolver | `.opencode/service/session/skill-attest.ts:361` | ✓ |
| Active config order `skill-policy < tool-governance` | `.opencode/project.config.json:1914-1915` | ✓ |
| Source DEFAULT_ORDER 一致 | `.opencode/plugins/before-dispatcher.ts:68-69` | ✓ |
| Rule disposition `skill-read-attest-required: hard_block` | `.opencode/service/enforcement/rule-disposition.ts:74` | ✓ |

**Verified-by**:
- `Grep resolveSkillAttestationIdentity` → 3 命中 (定义 + writer + validator)
- `Read project.config.json:1908-1921` → active order 11 plugins
- `Read before-dispatcher.ts:63-75` → DEFAULT_ORDER 11 plugins (与 active 一致)
- `Read rule-disposition.ts:74` → hard_block
- `git diff --stat HEAD` → 4 files changed, 484 insertions, 106 deletions (PT-WM-00R2 范围)

---

## 4. 00R vs 00R2 evidence 分离证明

| 目录 | 内容 | 隔离 |
|------|------|:---:|
| `e2e-evidence/L3/permission-template-enforcement/rework-pt-wm-00r/` | 00R 旧 evidence (13:32-18:17 文件) | ✓ 旧目录, 未触碰 |
| `e2e-evidence/L3/permission-template-enforcement/rework-pt-wm-00r2/` | 00R2 新 evidence (本文件) | ✓ 新建独立目录 |

**Verified-by**:
- `ls -la rework-pt-wm-00r/` → 含 execution-report-phase0.md, execution-report-t003-t004.md, t003-t004-attest-harness.json, t004-write-block-static-evidence.txt (4 文件, 全部 2026-07-14 13:32-18:17 创建)
- `mkdir -p rework-pt-wm-00r2/` → 21:04 新建, 仅含本文件
- `git status` → 仅新 test 文件 untracked, 00R 旧文件未修改

---

## 5. Final Gate 决策

### 解除条件 (Blueprint v1.3.0 §3.2.1 末尾判定逻辑)

> Reviewer 重跑关键安全与 live evidence、核对允许路径、bootstrap grant 已消费和未解决 OPEN/BLOCKED 后，才可更新 Blueprint 或 P1 完成状态。两 BLOCK 同时解除的前置条件: root/child 正向、精确负向零执行、active order、fault/concurrency/mutation 全部通过。

### 本轮已补的 (新 evidence)

| 条件 | 状态 | 证据 |
|------|:---:|------|
| Active dispatcher hard block 行为 (T-PT-004) | ✓ | 6/6 integration tests pass, 真实 dispatcher 链 |
| Active order (T-PT-050) | ✓ | 错误来源 `[skill-read-attest-required]` 证明 skill-policy 在 tool-governance 之前 |
| Component 测试 (T-PT-039/040/041/042/046) | ✓ | 11/11 pass (前轮已确认) |
| Tamper 负向 (T-PT-002) | ✓ partial | integration 版本通过; runtime copy mutation 完整路径仍需扩展 |

### 仍需补的 (待续)

| 条件 | 状态 | 备注 |
|------|:---:|------|
| Root/child live E2E 正向 (T-PT-051) | ✗ | 需要 reviewer 重启隔离 serve + 新 session |
| Live LLM E2E 弱模型 rework (T-PT-047) | ✗ | 需要真实 session + model dispatch |
| 持久化 DB lifecycle (T-PT-048/049) | ✗ | 需要多次 serve 重启观察 |
| 20 轮并发测试 (T-PT-051 + concurrency) | ✗ | 需要专门的并发执行 plan |
| 故障注入 (fault injection) | ✗ | 需要专门的 fault 注入脚本 |
| Mutation run | ✗ | 需要 mutation tool (Stryker 之类) |

### 判定

- **BLOCK-PT-03 (source-level + active order 修复)**: 证据链完整 (source + DEFAULT_ORDER + active config + integration test 错误来源证明)
- **BLOCK-PT-02 (active dispatcher hard block 行为)**: 关键 active-dispatcher 集成测试已建, 6/6 PASS, 证实 safe_edit/safe_shell 均被 skill-policy 阻断
- **共同解除**: 仍 **REWORK**。本轮已补最关键的 active-dispatcher 集成证据; T-PT-002 tamper 完整路径 + T-PT-046/047/051/052 live LLM E2E + 20 轮并发 + 故障注入 + mutation run 仍需后续 review session 补做。

---

## 6. 文件变更清单 (本轮)

- **NEW**: `/home/zhaoge/workspace/opencode/work-one/.opencode/plugins/__tests__/skill-hard-gate-integration.test.ts` (208 lines, active-dispatcher 集成测试)
- **NEW**: `/home/zhaoge/workspace/qoderwork/e2e-evidence/L3/permission-template-enforcement/rework-pt-wm-00r2/integration-evidence.md` (本文件)
- **NEW**: `/home/zhaoge/workspace/qoderwork/logs/2026-07-14-pt-wm-00r2-reviewer-live-e2e.md` (对账日志)

未触碰:
- `/home/zhaoge/workspace/qoderwork/e2e-evidence/L3/permission-template-enforcement/rework-pt-wm-00r/` (旧 00R evidence 完整保留)
- work-one 任何 plugin-handler 源码

---

## 7. 后续最小必做清单 (review session 续)

1. 启动隔离 serve (`FRAMEWORK_SKILL_READ_HARD_GATE=1 OPENCODE_ROOT=<worktree>`) + serve API 调用, 跑 T-PT-046/047/051/052 live LLM E2E
2. 扩展 `skill-hard-gate-integration.test.ts` 加入 T-PT-002 完整 tamper 路径 (运行时拷贝 mutation + 验证 invalid)
3. 20 轮并发: 写专门的 concurrency.test.ts 跑并行 dispatcher 调用
4. 故障注入: 写 fault-injection script, 模拟 DB 故障 / 进程重启
5. Mutation run: 引入 mutation tool 验证 test sensitivity
6. 复跑关键 baseline + 写 `rework-pt-wm-00r2/execution-report-reviewer-live-e2e.md`
