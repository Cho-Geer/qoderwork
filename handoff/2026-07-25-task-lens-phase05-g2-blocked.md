# Task Lens M1 — PHASE-05 G2 续接交接

**交接日期**：2026-07-25
**工作目录**：`/home/zhaoge/workspace/qoderwork/.worktrees/check-plan`
**状态**：`BLOCKED — 不得创建 G2 lock 或开始 PHASE-05 实施`
**用途**：供下一会话准确续接本 worktree 中 Task Lens M1 的 PHASE-05 治理修复与重新 Freeze Gate。

## 1. 一句话结论

PHASE-05 的七个代码/测试文件已经恢复到 PHASE-04 基线，PHASE-05 计划已改为要求新的 G2 lock/receipt；但计划结构 validator 仍失败，且历史 PHASE-01～04 的 audit 当前无法通过机器验证。因此 G2 不能创建，任何 PHASE-05 代码重新实施都必须等待新的明确授权。

## 2. 已完成且已验证的工作

### 2.1 PHASE-05 实现回退（可恢复）

- 已恢复到 `HEAD`：
  - `scripts/task-lens/cli.ts`
  - `scripts/task-lens/__tests__/input-diff.test.ts`
  - `scripts/task-lens/artifact-writer.ts` 已核验本来就与 `HEAD` 一致。
- 已从工作树移走、未删除的 PHASE-05 新增文件：
  - `scripts/task-lens/metrics.ts`
  - `scripts/task-lens/README.md`
  - `scripts/task-lens/__tests__/metrics.test.ts`
  - `scripts/task-lens/__tests__/cli-integration.test.ts`
- 这四个文件保存在可恢复备份：`/tmp/task-lens-phase05-restore-SkxkGQ/`。
- 备份 SHA-256：
  - `metrics.ts`: `84eea34a828c3acc3cbae4c05158a3d63b2f822f788b2438ed6cbacce22589b9`
  - `README.md`: `ac2a8e6ee477a88cd688d4dc04cf302a8fcc089e637e9d8df218313c858e9810`
  - `metrics.test.ts`: `3dc653672a70d469591055e9216272e0416f0c206980093db74db24d72213228`
  - `cli-integration.test.ts`: `8a0fe6c62e3729286342d45cf0e1096369576a1121325f5a36f1ef659e740184`
- 基线 component 测试已在恢复后运行：
  `bun test scripts/task-lens/__tests__/artifact-writer.test.ts scripts/task-lens/__tests__/input-diff.test.ts`
  ，结果 `31 pass / 0 fail`。这只是 component 证据，不能声称 integration/runtime/live 成功。

### 2.2 PHASE-05 计划已改为 G2 合同

`plans/task-lens-m1/05-phase-metrics-feedback.md` 当前为 `NOT_STARTED`，且：

- Allowed files 为 7 个，包含 `scripts/task-lens/__tests__/input-diff.test.ts`。
- Required evidence 改为：
  `scope-lock-PHASE-05-G2.json` 和 `pre-change-PHASE-05-G2.json`。
- Fixed verification 先检查 G2 lock/receipt，再运行 5 个 test files：
  `metrics.test.ts`、`cli-integration.test.ts`、`artifact-writer.test.ts`、`input-diff.test.ts`、`command-security.test.ts`。
- caller_tests 合同明确包含 `artifact-writer.test.ts`、`input-diff.test.ts`、`command-security.test.ts`。
- 文件已通过非空、内容断言和 `git diff --check`；这不是实施完成证据。

### 2.3 Amendment evidence 的边界

- `audits/task-lens-m1/scope-lock-PHASE-05-amendment-20260725.json` 非空，Human APPROVED，包含 `input-diff.test.ts`。
- `audits/task-lens-m1/evidence/pre-change-PHASE-05-amendment-20260725.json` 非空；其 `scope_lock_sha256` 与 amendment lock 匹配，锚点为干净的 work-one HEAD `e65e229521359992399bb7c22d2510e3fcee63b4`。
- 该 receipt 的 `captured_at` 为 `2026-07-24T16:10:58.015Z`，在旧 G1 实现/audit 之后；它不能追溯使旧实现或旧 `ACCEPT` 有效。

## 3. 当前阻断（不可绕过）

### 3.1 G2 尚不存在

`audits/task-lens-m1/scope-lock-PHASE-05-G2.json` 当前是 **0 bytes**。它不是 scope lock，不能批准、不能引用，也不能用于 `capture-state.ts`。`pre-change-PHASE-05-G2.json` 尚未创建。

### 3.2 PLAN_SET validator 失败

当前命令：

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts plans/task-lens-m1
```

当前结果为 exit 1：

1. `PLAN_INDEX_LENGTH_EXCEEDED`：`00-plan-index.md` 为 `8058/8000` Unicode characters。
2. PHASE-01～04 各有 `NO_COMPLETION_CHECKBOX`。

第二项是 validator 合同矛盾，不是四个 phase gate 未勾选：PHASE-01～04 的实际 `## Phase completion gate` 都已为 `[x]`，并且 manifest/status 为 `ACCEPTED`。但 `validate-plan.ts` 仅搜索 `- [ ]`；同一 validator 又要求 `ACCEPTED` phase 的 gate 不能有未勾选项。不得通过向已接受的 gate 加入假 `[ ]` 项来绕过。

### 3.3 PHASE-01～04 历史 evidence 不能作为当前机器有效性证明

两份只读证据日志：

- `/tmp/task-lens-phase01-02-completion-evidence-20260725.log`
- `/tmp/task-lens-phase03-04-completion-evidence-20260725.log`

它们显示：

- 所有 progression receipt 均非空、可解析，并与其引用 audit 的 hash 绑定一致；历史 audit 都声明 `ACCEPT/component`。
- 但当前运行 `validate-audit.ts` 时，PHASE-01～04 audit 都 exit 1；PHASE-01/02 还含 EV receipt baseline mismatch，PHASE-03/04 为 `SOURCE_HASH_MISMATCH`。
- 因此不得重新勾选、回填或重写这些 phase gate 来宣称“当前验证有效”。历史 receipt 不能被补造为实施前 provenance。

### 3.4 旧 PHASE-05 G1 audit/LATEST 不可信

- `audits/task-lens-m1/2026-07-24-phase-05-audit.md` 是未跟踪的 G1 报告，曾签 `ACCEPT`，但当前审计检查发现 receipt/evidence ceiling/plan-anchor/baseline/command cwd 等问题；负控制用了 `/bin/false`，不代表真实 mutation。
- `audits/task-lens-m1/LATEST.md` 仍声称 PHASE-05 `ACCEPTED` 和 PHASE-06 `NOT_STARTED`，与当前 PHASE-05 `NOT_STARTED`、G2 未创建、PHASE-06 `BLOCKED` 相冲突。不得将 LATEST 当放行依据。

## 4. 已授权范围与仍需的授权

用户已经授权：恢复 7 个 PHASE-05 code/test files、修正 PHASE-05 计划、以及检查/修复 `00-plan-index.md` 与 PHASE-01～04 completion gate。

这些授权不足以安全消除当前阻断。继续前必须获得明确授权，至少包括：

1. 修改 `.agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts` 及其测试，使“存在 completion checkbox”接受 `[x]`，同时保留 progression 对 `ACCEPTED` gate 全勾选的检查。
2. 对 PHASE-01～04 的历史 audit/source-hash 漂移采用明确治理策略。不得覆盖历史 audit、不得补造 pre-change receipt、不得把 component-only 历史声明写成新的 v2.1 `ACCEPT`。
3. 仅在上述策略使 `validate-plan.ts` exit 0、且 `validate-phase-progression.ts plans/task-lens-m1 PHASE-05` 仍 exit 0 后，才允许创建 G2 lock 和 G2 pre-change receipt。

## 5. 下一会话的安全执行顺序

1. 先读本文件、`AGENTS.md`、`RULES.md`、PHASE-05 计划，以及 validator 源码和测试。
2. 重新核对 `git status --short`，不要触碰与本 PHASE-05-G2 任务无关的工作树脏文件。注：本行原列示例 `gen_*.py`、`*.svg`、`ops.txt`、`.workbuddy/memory/` 作为「未跟踪生成物」的前提已于 2026-07-25 失效（`gen_callgraph.py` 自 d3dd5d9（2026-07-24 21:23）已 tracked；其余 7 文件 gen_module_graph.py/gen_ops.py/module-graph.svg/module-ops.txt/ops.txt/task-lens-callgraph.svg/update-ops.txt 在 17b94b4（2026-07-25 12:18）与本 handoff 同批次 tracked）。其后续处理见 2026-08-02 清理裁决（参见 `logs/` 当日相关 handoff + 高精度复审 ACCEPT）。
3. 向用户取得第 4 节所列的额外授权；未授权时停在 BLOCKED。
4. 若获授权，先修 validator + test，再以最小语义改动将 index 压到不高于 8000 Unicode characters，并逐文件做文本完整性验证。
5. 运行完整 `validate-plan.ts`；任一非零即停止，不创建 G2。
6. 运行 `validate-phase-progression.ts plans/task-lens-m1 PHASE-05`；必须 exit 0。
7. 在 fresh human approval 后串行创建非空 G2 scope lock；其 plan_sources hash 必须匹配当时的 PHASE-05 plan。
8. 使用 `capture-state.ts`、`--repository-root /home/zhaoge/workspace/opencode/work-one`、`--phase-id <G2 lock_id>` 捕获新路径 `pre-change-PHASE-05-G2.json`。不得覆盖 receipt，且不得把 qoderwork worktree 作为 repository_root。
9. 验证 G2 lock/receipt 存在、非空、hash/phase-id/HEAD/plan hash 匹配后，才讨论重新实施 PHASE-05。

## 6. 不得执行的操作

- 不得从 `/tmp/task-lens-phase05-restore-SkxkGQ/` 自动移回 PHASE-05 文件；那将重新开始实施，必须在有效 G2 Freeze Gate 后另行授权。
- 不得删除 G1 audit、旧 locks、旧 receipts、0-byte G2 占位或 `/tmp` 备份。
- 不得把 `LATEST.md`、历史 audit 的 `ACCEPT`、amendment receipt 或 component 测试当作 G2 放行。
- 不得手工勾选/取消 PHASE-01～04 completion gate 来迎合 validator。
- 不得设置、转发或伪造 `H2_AUTHORIZED=true` 或 `DRY_RUN=false`。

## 7. 当前可复现检查

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
git status --short
stat -c '%n %s bytes' audits/task-lens-m1/scope-lock-PHASE-05-G2.json
bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts plans/task-lens-m1
bun run .agents/skills/deterministic-implementation-planning/scripts/validate-phase-progression.ts plans/task-lens-m1 PHASE-05
test -s audits/task-lens-m1/scope-lock-PHASE-05-amendment-20260725.json
test -s audits/task-lens-m1/evidence/pre-change-PHASE-05-amendment-20260725.json
```

预期：第三条当前非零；第四条当前为 exit 0；G2 文件仍为 0 bytes。

## 8. 本轮参考日志

- `/tmp/task-lens-phase05-restore-20260725.log`：恢复、备份和 31-pass component 基线。
- `/tmp/task-lens-phase05-plan-repair-20260725.log`：PHASE-05 G2 文本修订完整性。
- `/tmp/task-lens-phase01-02-completion-evidence-20260725.log`：PHASE-01/02 当前 audit/receipt sweep。
- `/tmp/task-lens-phase03-04-completion-evidence-20260725.log`：PHASE-03/04 当前 audit/receipt sweep。

这些 `/tmp` 日志可辅助定位，但本文件已保留了继续决策所需的结论；新会话必须重新验证任何仍需依赖的外部状态。
