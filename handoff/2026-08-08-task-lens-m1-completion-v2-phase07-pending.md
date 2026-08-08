# Handoff — Task Lens M1 Completion v2 / PHASE-07 Pending

**Date**: 2026-08-08
**Worktree**: `C:/Users/USER/ZCodeProject/qoderwork/.worktrees/check-plan`
**Branch**: `check-plan` (HEAD = `49b844a`, 24 commits ahead of `origin/check-plan`)
**From-session**: 主会话（已通过 series of dual-review + standalone fixes + commits）
**Next-session**: 继续 PHASE-07 实施 + 双端 evidence + 收尾

---

## 1. 项目背景

`Task Lens M1` 是 OpenCode 框架的 AI 任务函数级理解收据生成器。v1 形态已通过 `plans/task-lens-outcome-v1/` (gen-1 outcome chain, 4/4 cases PASS, 90/90 tests) 冻结。

**V2 实施**：通过 `blueprints/blueprint-task-lens-m1-completion-v2.md`（已批准，status=`待实施`）走 successor 路径：
- 沿用 outcome-governance/v1 + amendment 通道
- gen2 文件置于 `plans/task-lens-outcome-v1/` 同目录（不新建 v2 目录）
- 三个新 phase（PHASE-05/06/07）+ 双端 evidence + 10 任务人工 review

**Windows Git Bash** 是当前 canonical execution env（per memory `Task-Lens-Outcome-V1 WSL-Canonical Precedent` 的更新认知；本会话确认 Windows Git Bash 上 5 frozen-test 失败可独立修复，无需切 WSL）。

---

## 2. 已完成 commits（24 ahead of origin）

| SHA | 内容 |
|------|------|
| `49b844a` | **feat(task-lens-integration)**: PHASE-06-v2 dual real-target integration + zero-write |
| `f36fe1c` | fix(workspace-paths): Windows file URL double-drive-letter in deriveQoderworkRoot |
| `ff80258` | fix(workspace-paths): Windows Git Bash path-separator normalization (validateWorkOneRoot) |
| `a452a42` | feat(task-lens-metrics): PHASE-05-v2 metrics/feedback + TL-ATOMIC/CONFLICT fsync fix + dual-env README |
| `0389aa5` | docs(task-lens-m1-completion-v2): blueprint approval + 6 plan files |
| `e0c0b98` | docs(logs): 2026-08-08 v2 gen2 amendment draft + 5-test-failures solutions + validator X4 fix |
| `3583369` | docs(logs): 2026-08-07 blueprint approval + v2 plan gap-fix + validator schema-gap decision + regex fix |
| `e7d67a3` | fix(validate-outcome-governance): Windows regex + X4 path normalization |
| (更早 16 commits) | 先前 session 产物 |

**Working tree 状态**：完全干净（无 untracked / modified / staged 任何文件）

---

## 3. 当前状态量化

### PHASE-06 完成（commit `49b844a`）

| 验证项 | 结果 | 证据 |
|--------|------|------|
| integration.test.ts 隔离 | 22/0 PASS, rc=0 | `bun test scripts/task-lens/__tests__/integration.test.ts` |
| 完整 task-lens 套件 | **140 pass / 3 fail** | `bun test scripts/task-lens`（baseline 恢复） |
| 3 pre-existing fail | TL-C-103 symlink EPERM / TL-PROBE / Real provider chain | Windows Git Bash 已知 OS 限制 |
| EMFILE | 0 | fd-leak 修复（`createReadStream` 死代码删除） |
| typecheck | rc=0 | `bun run typecheck` |
| 6 frozen test SHAs | 不变 | 与 `outcome-test-bundle.json` SHA-binding 一致 |
| Work-one + qoderwork-main purity | 无写入 | `git status --porcelain` 均为空 |

### PHASE-07 待办

**还需要做的完整工作清单**：

1. **TL-PROBE 修复**（`scripts/task-lens/__tests__/provider-graph.test.ts` L81/L269）
   - 根因：`dbPath.replace("/.codegraph/codegraph.db", "")` 前向斜杠字面量；Windows 反斜杠路径下 replace 为 no-op → 二次拼接
   - 方案：`path.dirname(path.dirname(dbPath))` 剥 2 段，或 refactor fixture 传 root
   - 归属：frozen test 修复 → **需要 gen2 amendment**（SHA 绑定解除）

2. **TL-C-103 修复**（`scripts/task-lens/__tests__/command-security.test.ts` L240）
   - 根因：`fs.symlinkSync(project, link)` 无 type 参数 → file-type symlink → Windows EPERM
   - 方案：加 `"junction"` 参数（junction 不需管理员；realpath 正确解析）
   - 归属：frozen test 修复 → **需要 gen2 amendment**

3. **closure.test.ts 新增**（PHASE-07 sensitivity control）
   - 蓝图 §6.7 双端各 10 unique pairs + ≥7/10 双 yes
   - TL-C-401 至 TL-C-409 单失败矩阵
   - 适用 `bun test scripts/task-lens/__tests__/closure.test.ts`（plan §6.2/§11.1 preflight 列表）

4. **gen2 outcome chain 8 文件创建**（`plans/task-lens-outcome-v1/` 同目录）
   - `outcome-contract-v2.json` (gen=2, supersedes v1)
   - `acceptance-spec-v2.json` (9 cases: 9 affected + 4 unaffected = 13)
   - `outcome-test-bundle-v2.json` (4 tests + 双端 runner/oracle 元数据)
   - `outcome-amendment-v2.json` (15 字段 lib schema per recent fix; affected: 9 cases + 5 reqs; unaffected: 4 cases + 4 reqs)
   - `outcome-approval-v2.json` (generates from v2)
   - `ledger/event-003-v2-contract-superseded.json` (CONTRACT_SUPERSEDED event)
   - `ledger/event-004-v2-run-recorded.json` (RUN_RECORDED event)
   - `runs/outcome-run-result-v2.json` (canonical single run-result; 双 case per REQ; verdict PASS iff both ends PASS)

5. **双端 evidence 采集**（per plan §6.10）
   - WSL: `${HOME}/.local/state/qoderwork/task-lens/m1-acceptance`
   - Git Bash: `%LOCALAPPDATA%\qoderwork\task-lens\m1-acceptance`
   - 每个 task dir: card.md + task-graph.json + input-receipt.json
   - 10 unique pairs + 7 yes + 双端独立 reviewer

6. **canonical run-result-v2.json 验证**
   - `validate-outcome-governance.ts plans/task-lens-outcome-v1 --repository-root $(pwd)` 必须双端 exit 0
   - 触发 validator `validateRun` + `validateLedgerReferences` + `validateOutcomeLedger` + `deriveRunVerdict`
   - workspace-paths Windows path-normalization 修复（已 commit `ff80258` + `f36fe1c`）是 v2 链通过 validator 的硬前置

7. **文档同步**（per plan §6.8）
   - `blueprints/blueprint-task-lens-m1-completion-v2.md` 状态：草稿/待实施 → 实施中 → 已完成
   - `blueprints/INDEX.md` v2 条目补登记（独立 session）
   - `plans/task-lens-m1-completion-v2/99-final-verification.md` 填充实测结果

---

## 4. 关键决策记录（不需重做）

### 4.1 环境设置
- `scripts/.env`（gitignored per `.gitignore:8`）含：
  - `WORK_ONE_ROOT=C:\Users\USER\ZCodeProject\opencode_framework`
  - `QODERWORK_ROOT=C:\Users\USER\ZCodeProject\qoderwork`
  - `CODEGRAPH_BIN=C:\Users\USER\AppData\Local\codegraph\current\bin\codegraph.cmd`
- `scripts/local-paths.json`（gitignored per `.gitignore:9`）含 win32 paths + codegraphBin
- 使用方式：`bun --env-file=scripts/.env <script>` 注入 env

### 4.2 workspace-paths 修复（已 commit）
- `validateWorkOneRoot` 增加 `normalizePath` helper（`scripts/lib/workspace-paths.ts:29`），把 `\` → `/` 归一化
- `topLevel !== null && normalizePath(topLevel) !== normalizePath(real)` 比较
- `deriveQoderworkRoot` 改用 `fileURLToPath` 替代 `new URL(...).pathname`（避免 Windows `/C:/...` 双盘符）
- 2 个 resolveTool Windows execute-bit bugs（PDR-C-103a/b）**不修**（不在 scope；正交）

### 4.3 validator 修复（已 commit `e7d67a3`）
- `scripts/validate-outcome-governance.ts` `auxiliaryRunArtifact` regex 修复（`\/\\` 字符类）
- `validate-outcome-governance.ts` `relative()` 双 callsite 路径归一化（L61 + L215，添加 `.split("\\").join("/")`）
- 2 个 pre-existing frozen-test 失败（TL-C-103 symlink / TL-PROBE SQLite）将随 PHASE-07 修复

### 4.4 PHASE-06 关键设计决策
- `runRealTarget` 使用 **Windows junction**（`/tmp/tl-phase06/aliases/&lt;name&gt;` → 真实 Windows target）绕过 CLI `isAbsolutePath` POSIX-only 校验（`scripts/task-lens/cli.ts:211` frozen）
- Zero-write 验证：real-target 端 `git status --porcelain` 前后均为空
- FAKE-INJECTION 模式：fixture 端用 fake SQLite codegraph DB；real-target 端用真 CLI

### 4.5 文档修正记录
- `logs/2026-08-08-v2-gen2-amendment-draft.md` L12/L14/L118 "14 字段" → "15 字段"（lib 实际 15 字段）
- `logs/2026-08-08-windows-git-bash-5-test-failures-solutions.md` L66 删 "EXIT=0 陷阱"（实测 rc=1）；L70 补 SHA nuance（test file vs production file）
- validator 路径在 plan 99 §2.1/2.2 preflight 缺 `[PROVENANCE-MISMATCH]` 标记（D1 后续项）

---

## 5. 关键引用文件（绝对路径）

### 蓝图 + 计划（**禁止修改**）
- `C:/Users/USER/ZCodeProject/qoderwork/.worktrees/check-plan/blueprints/blueprint-task-lens-m1-completion-v2.md`（status=`待实施`）
- `C:/Users/USER/ZCodeProject/qoderwork/.worktrees/check-plan/plans/task-lens-m1-completion-v2/00-plan-index.md`
- `C:/Users/USER/ZCodeProject/qoderwork/.worktrees/check-plan/plans/task-lens-m1-completion-v2/05-phase-metrics-feedback.md`
- `C:/Users/USER/ZCodeProject/qoderwork/.worktrees/check-plan/plans/task-lens-m1-completion-v2/06-phase-integration-zero-write.md`
- `C:/Users/USER/ZCodeProject/qoderwork/.worktrees/check-plan/plans/task-lens-m1-completion-v2/07-phase-acceptance-closure.md`
- `C:/Users/USER/ZCodeProject/qoderwork/.worktrees/check-plan/plans/task-lens-m1-completion-v2/99-final-verification.md`
- `C:/Users/USER/ZCodeProject/qoderwork/.worktrees/check-plan/plans/task-lens-m1-completion-v2/README.md`

### v1 冻结（**禁止修改**）
- `C:/Users/USER/ZCodeProject/qoderwork/.worktrees/check-plan/plans/task-lens-outcome-v1/`（全部，含 `outcome-contract.json` SHA `8009501276e739b9a7cd309af3d5d653a74b67ca2f5934f27cdab70fdb7f0db9`）
- `C:/Users/USER/ZCodeProject/qoderwork/.worktrees/check-plan/plans/task-lens-m1/`（frozen PHASE-01~04）

### Frozen 测试文件（**禁止修改**；bundle SHA-binding）
- `scripts/task-lens/__tests__/artifact-writer.test.ts` SHA `8625f921b3127e323ab3ad2d51c68fb2a3059db2f1a3d1ad16bbe488faf6b268`
- `scripts/task-lens/__tests__/input-diff.test.ts` SHA `ed85646005060f082d28f7d4ff043637c0886d184047b83486583382431d6b7e`
- `scripts/task-lens/__tests__/command-security.test.ts` SHA `bb058c55736789d1cfff84fb0ef167e7e841132a06fcaa209a54c0ff87d07c74`
- `scripts/task-lens/__tests__/provider-graph.test.ts` SHA `2b6e2f76c98015707842d0d126778405c7b65d3837104f5dbea2e7b72d6ada66`
- `scripts/task-lens/__tests__/spine.test.ts` SHA `ee4b1777894a5cdb8a6a95714d46eaa4bb8280f78ee60428e3b2c2f40c8925ea`
- `scripts/task-lens/__tests__/coverage-render.test.ts` SHA `872248501fcb51d936a623ec5d91a7cd9937fd45fa91a777e987b1055ffb2796`

### 已 ACCEPT 代码（PHASE-05/06）
- `scripts/task-lens/metrics.ts`（PHASE-05 新增；metrics/feedback 模块）
- `scripts/task-lens/cli.ts`（PHASE-05 改；feedback + metrics summarize 子命令）
- `scripts/task-lens/artifact-writer.ts`（PHASE-05 改；TL-ATOMIC/CONFLICT fsync 修复）
- `scripts/task-lens/README.md`（PHASE-05 新增；60 行 CLI 契约）
- `scripts/task-lens/__tests__/metrics.test.ts`（PHASE-05 新增；24 tests）
- `scripts/task-lens/__tests__/cli-integration.test.ts`（PHASE-05 新增；7 tests）
- `scripts/task-lens/__tests__/integration.test.ts`（PHASE-06 新增；1392 lines；22 tests）

### 已修复代码（standalone 修复）
- `scripts/lib/workspace-paths.ts`（commit `ff80258` + `f36fe1c`；validateWorkOneRoot + deriveQoderworkRoot 修复）
- `scripts/validate-outcome-governance.ts`（commit `e7d67a3`；regex + X4）

### 关键决策 logs
- `C:/Users/USER/ZCodeProject/qoderwork/.worktrees/check-plan/logs/2026-08-07-blueprint-task-lens-m1-completion-v2-approval.md`
- `C:/Users/USER/ZCodeProject/qoderwork/.worktrees/check-plan/logs/2026-08-07-plans-task-lens-m1-completion-v2-gap-fix.md`
- `C:/Users/USER/ZCodeProject/qoderwork/.worktrees/check-plan/logs/2026-08-07-validate-plan-schema-gap-option-c.md`
- `C:/Users/USER/ZCodeProject/qoderwork/.worktrees/check-plan/logs/2026-08-07-validate-outcome-governance-regex-windows-fix.md`
- `C:/Users/USER/ZCodeProject/qoderwork/.worktrees/check-plan/logs/2026-08-08-v2-gen2-amendment-draft.md`
- `C:/Users/USER/ZCodeProject/qoderwork/.worktrees/check-plan/logs/2026-08-08-windows-git-bash-5-test-failures-solutions.md`
- `C:/Users/USER/ZCodeProject/qoderwork/.worktrees/check-plan/logs/2026-08-08-validate-outcome-governance-relative-path-windows-fix.md`

---

## 6. Memory 关键教训（不重蹈覆辙）

- `Multi-Review Missed Unfireable Command`：subagent 可能写不可执行的命令（如 `bun run scripts/task-lens/...` 但 `scripts/task-lens/` 不存在路径）→ 派遣 implementer 前 `test -f` 验证
- `M3 Doc-Review Misses Script Logic`：reviewer 验证表面 text，可能遗漏 script-logic gap → 独立跑命令验证
- `Multi-Review Mirror-Line Drift`：fix a值时枚举所有镜像位置 → 跨节 cross-reference
- `Memory verify-before-concluding`：完成前跑最便宜的验证（ls/test -f/grep -c）→ 不断言"path clear"或"preconditions met"无 Verified-by
- `Edit Tool Not Python for Markdown`：`Edit` 工具直接处理 markdown，不用 Python/sed/awk
- `Dual-Review Exit Code Capture Mandatory`：捕获真实 exit code（`cmd ; rc=$? ; echo $rc`），Windows Git Bash 上 `bash -c 'echo EXIT=$?'` 会重置 `$?` 为 0
- `MSYS Path Conversion Gotcha`：`rg --no-config` + `-F` 固定字符串，避免 MSYS regex 解析
- `Task-Lens-Outcome-V1 WSL-Canonical Precedent`（更新认知）：Windows Git Bash 上 5 frozen-test 失败可独立修复（fsync/symlink/SQLite 不外推）；Windows Git Bash 是 current canonical env

---

## 7. 启动新会话的最小 actionable 列表

按优先级：

1. **cheap-est pre-gate**：
   ```bash
   cd "C:/Users/USER/ZCodeProject/qoderwork/.worktrees/check-plan"
   git status --porcelain  # 期待空
   git log --oneline -3     # 期待 49b844a 顶部
   test -f scripts/task-lens/__tests__/integration.test.ts && echo "EXISTS"
   bun --env-file=scripts/.env -e 'import { resolveWorkspacePaths } from "./scripts/lib/workspace-paths.ts"; const r = resolveWorkspacePaths(); console.log(r.workOneRoot, r.qoderworkRoot);'  # 期待 4 条路径解析
   ```

2. **PHASE-07 实施启动**（按 §3 清单顺序）：
   - implementer 1: TL-PROBE + TL-C-103 + closure.test.ts（dual-review：1st reviewer + 2nd reviewer）
   - implementer 2: gen2 outcome 8 文件（按 blueprint §3.3 设计接口，参考 `logs/2026-08-08-v2-gen2-amendment-draft.md`）
   - 双端 evidence 采集（WSL + Git Bash）
   - main session 最终 validator 验证 + commit

3. **收尾**：
   - D1：plan preflight 补 `[PROVENANCE-MISMATCH]` 标记（在 99 §2.1/2.2 + plan-index §8.1）
   - D2：`blueprints/INDEX.md` v2 条目补登记（独立 session）
   - push 决策（24 commits 未 push）

---

## 8. 当前 confirmed 状态（用于接收会话验证）

```
HEAD = 49b844a
Working tree = clean (empty porcelain status)
Frozen test SHAs = 6 unchanged from baseline
PHASE-05 = ACCEPT (31/0 pass; frozen SHAs unchanged)
PHASE-06 = ACCEPT (140/3 pass; 3 pre-existing fails documented)
PHASE-07 = NOT STARTED (delegated to next session)
gen2 chain = NOT CREATED (8 files pending)
dual-end evidence = NOT COLLECTED
```

**关键 commit SHA 全部完整列表**（如需进一步参考）：
```
49b844a feat(task-lens-integration): PHASE-06-v2 dual real-target integration + zero-write verification
f36fe1c fix(workspace-paths): Windows file URL double-drive-letter in deriveQoderworkRoot
ff80258 fix(workspace-paths): Windows Git Bash path-separator normalization (validateWorkOneRoot)
a452a42 feat(task-lens-metrics): PHASE-05-v2 metrics/feedback module + TL-ATOMIC/CONFLICT fsync fix + dual-env README
0389aa5 docs(task-lens-m1-completion-v2): blueprint approval + plan-set files (7)
e0c0b98 docs(logs): 2026-08-08 v2 gen2 amendment draft + 5-test-failures solutions + validator X4 fix
3583369 docs(logs): 2026-08-07 blueprint approval + v2 plan gap-fix + validator schema-gap decision + regex fix
e7d67a3 fix(validate-outcome-governance): Windows relative() path normalization (X4) + run artifact regex
... (preceding 16 commits)
```

---

## 9. 上下文接收 checklist（session 启动时验证）

- [ ] `git status --porcelain` 为空
- [ ] `git log --oneline -1` 为 `49b844a`
- [ ] `scripts/.env` 与 `scripts/local-paths.json` 存在（gitignored；非 git 跟踪）
- [ ] `bun --env-file=scripts/.env` 验证 4 个 anchor 全部解析
- [ ] `bun run typecheck` rc=0
- [ ] `bun test scripts/task-lens` 显示 140/3 baseline
- [ ] workspace-paths validator 修复仍然生效（`validate-outcome-governance.ts plans/task-lens-outcome-v1 --repository-root $(pwd)` 抛错误但 errors 列表不含 PATH/JSON 错误）

如果以上全 PASS，可直接进入 PHASE-07 实施。如果任一 FAIL，按 memory `verify-before-concluding` 排查。

---

**End of handoff**
