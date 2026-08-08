# Handoff — Task Lens M1 Completion v2 / PHASE-08 WSL Continuation

**Date**: 2026-08-08
**From-session**: 主会话（Windows Git Bash，PHASE-07 完整实施 + 3 问题修复 + CLI Windows 路径修复 + push 完成）
**Next-session**: WSL Ubuntu-24.04 环境下继续 PHASE-08（WSL 端独立 evidence 采集 + 真实 reviewer 验证 + 文档收尾）
**Git branch**: `check-plan`（HEAD = `2cf4f1e`，**已 push 到 origin，remote 同步**）

---

## 1. 项目背景（Task Lens M1 是什么）

`Task Lens M1` = "任务透镜：AI 任务的函数级理解收据生成器"。目标：把 AI 任务维度的 codegraph + coverage + diff + 审计数据聚合为 4 件 artifact（card.md / task-graph.json / input-receipt.json / metrics.jsonl），让人类 reviewer 一屏看完"该主要审查什么"（注意力分配）。闸门：10 真实任务 ≥7/10 useful+load_reduced。

**V2 实施**：通过 `blueprints/blueprint-task-lens-m1-completion-v2.md`（status=`实施中`）走 successor 路径 + outcome-governance/v1 amendment 通道（gen=2）。

---

## 2. 当前状态（2026-08-08 主会话结束时 verified）

### Git 状态
```
HEAD       = 2cf4f1e6cd891c51b2e5d8f1043a78ed975ddf8e
Remote     = origin/check-plan = 2cf4f1e（已同步，0 ahead / 0 behind）
Working    = 干净（0 uncommitted）
Branch     = check-plan
Repository = https://github.com/Cho-Geer/qoderwork.git
```

### 测试基线（Windows Git Bash 实测）
```
bun test scripts/task-lens                        → 156 pass / 0 fail / 485 expect / RC=0
bun test scripts/task-lens/__tests__/closure.test.ts → 11 pass / 0 fail
bun test scripts/__tests__/validate-outcome-governance.test.ts → 14 pass / 1 fail
  （1 fail = rejects symlink artifact escapes，Windows EPERM 环境限制；WSL 下应全绿）
bun run typecheck                                 → RC=0
bun run scripts/validate-outcome-governance.ts plans/task-lens-outcome-v1 --repository-root $(pwd)
                                                  → {"ok":true,"lifecycle":"ACTIVE","errors":[]} RC=0
```

### Outcome chain 关键 SHAs（WSL session 验证时参照）
```
outcome-contract-v2.json     = 8445729975c37c0a0ac82a61e173d6b7f05440b838c160b590b91c732f36c001
outcome-amendment-v2.json    = 5d0bbef247f8c2046917860c21c83ceacbfa5b644f49df8b5b0adea63f4ee2b1
outcome-run-result-v2.json   = fbc936e84ed7640a73ca01f6ce1c7c7af507c0888164077deb267cf5dafe979f
v1 contract (frozen)         = 8009501276e739b9a7cd309af3d5d653a74b67ca2f5934f27cdab70fdb7f0db9
```

---

## 3. 已完成 commits（本 session 3 个新 commit，共 push 31）

| SHA | 内容 |
|------|------|
| `2cf4f1e` | **fix(task-lens-cli)**: isAbsolutePath 接受 Windows-style 绝对路径（node:path.isAbsolute + 5-case test）|
| `7c9a00b` | **fix(task-lens-m1-completion-v2)**: validator per-generation scoping (1A+1B) + honest receipts（10→0 errors）|
| `ff96426` | feat(task-lens-m1-completion-v2): PHASE-07 fail-closed closure（verdict=FAIL→BLOCKED + WSL cases BLOCKED）|
| `49b844a` | feat(task-lens-integration): PHASE-06-v2 dual real-target integration + zero-write |
| `f36fe1c` / `ff80258` | fix(workspace-paths): Windows file URL double-drive-letter + path normalization |
| `a452a42` | feat(task-lens-metrics): PHASE-05-v2 metrics/feedback + TL-ATOMIC/CONFLICT fsync fix |
| `0389aa5` + 更早 | blueprint approval + plan-set + validator regex fix 等 |

---

## 4. PHASE-08 待办清单（WSL session 任务）

### 🔴 高优先级（PHASE-08 核心）

1. **WSL 端独立 evidence 采集**（plan §6.10 / REQ-CROSS-ENV）
   - WSL distro: `Ubuntu-24.04`（已确认存在）
   - 历史 WSL clone 路径：`/home/zhaoge/qoderwork-wsl/`（2026-08-06 时 HEAD=c01ed72；**需更新到 2cf4f1e**）
   - 方法：clone/pull Windows worktree 到 WSL native FS，在 WSL 跑 `bun test scripts/task-lens` + closure + validator
   - 产出：WSL 端 4 个 WSL cases（TL-C-401-v2-WSL, TL-C-402-v2-WSL, TL-I-501-v2-WSL, TL-M-601-v2-WSL）从 BLOCKED → PASS，更新 receipts + run-v2 verdict BLOCKED → PASS（若双端都 PASS）
   - 关键约束：**禁止把 Git Bash evidence 复制到 WSL 路径**；双端独立采集

2. **真实 reviewer "一屏看完" 验证**（M1 核心目标）
   - 在 WSL 或 Git Bash 选 10 个真实任务跑 `task-lens generate`
   - 自己作为 reviewer 打开 card.md，判断是否一屏看完 + 该审查什么清晰
   - 对每个任务跑 `task-lens feedback`（--useful yes/no --load-reduced yes/no）
   - `task-lens metrics summarize --json` 检查 ≥7/10 双 yes + gate=PASS

3. **WSL 下 governance test 全绿确认**
   - `bun test scripts/__tests__/validate-outcome-governance.test.ts` 在 WSL 应 15/15（Windows 的 1 EPERM fail 在 WSL 消失）
   - `bun test scripts/task-lens` 在 WSL 应全绿（TL-C-103 junction / TL-PROBE / TL-ATOMIC fsync 在 WSL 是原生 POSIX 语义）

### 🟡 中优先级（文档收尾）

4. **`99-final-verification.md`**：Current status PARTIAL → ACCEPTED（依赖 WSL evidence + reviewer 验证完成后）
5. **`blueprints/INDEX.md`** v2 条目补登记（独立 session 任务，handoff §7 #3 原定）
6. **`blueprint` header status** 实施中 → 已完成（依赖 #4+#5）
7. **logs/INDEX.md 更新 + 创建 2026-08-08 commit log**（本次 session 有 3 个 commit 未写 log）

### 🟢 低优先级

8. pre-existing Windows EPERM symlink test（WSL 下自然解决；无需单独处理）
9. GitHub "must be through PR" 规则提示：未来直接 push 可能被拦，需走 PR

---

## 5. WSL 环境设置（关键）

### WSL distro 确认
```bash
wsl.exe -l -q    # 显示 Ubuntu-24.04
```

### WSL native FS 路径（历史 precedent）
```
/home/zhaoge/qoderwork-wsl/   ← 2026-08-06 clone（HEAD c01ed72，已过期）
```
新 session 应：
```bash
cd /home/zhaoge/
git clone https://github.com/Cho-Geer/qoderwork.git qoderwork-wsl
cd qoderwork-wsl
git checkout check-plan    # 或 git fetch + checkout origin/check-plan
git log --oneline -1       # 期待 2cf4f1e
```

### WSL 内 env 需求
```bash
export WORK_ONE_ROOT=<WSL 路径的 work-one clone>   # 若需要 real-target 测试
export QODERWORK_ROOT=$(pwd)
# scripts/.env 与 scripts/local-paths.json 是 gitignored 的 Windows 路径文件——WSL 下需重新生成或依赖 env vars
```

### WSL 关键验证命令（PHASE-08 收尾标准）
```bash
bun run typecheck                              # RC=0
bun test scripts/task-lens                     # 全绿（156/0）
bun test scripts/__tests__/validate-outcome-governance.test.ts   # 15/15 期待
bun run scripts/validate-outcome-governance.ts plans/task-lens-outcome-v1 --repository-root "$(pwd)"
# 期待 {"ok":true,"lifecycle":"ACTIVE","errors":[]}
```

---

## 6. 关键决策记录（不需重做）

1. **validator 1A/1B 修复**（commit 7c9a00b）：
   - 1A: bundle source-hash check 只对 active bundle 执行（superseded 跳过）；bundle loop 移到 ledger validation 之后
   - 1B: run.candidate_tree_sha256 与 contract baseline.baseline_tree_sha256 比较（非 live HEAD）
   - 3 个新 test fixtures：superseded drift tolerated / candidate!=baseline rejected
2. **coverage-reader.ts**：删 3 个 `process.exitCode = 2`（library 不污染 process；CLI 经 computeGeneratedExitCode 处理 exit code）
3. **CLI isAbsolutePath**（commit 2cf4f1e）：`node:path.isAbsolute`（同时接受 POSIX + Windows-style）
4. **PHASE-07 fail-closed**：WSL 4 cases BLOCKED（Windows session 无 WSL 环境），verdict=BLOCKED；PHASE-08 在 WSL 完成后改 PASS
5. **Push 授权**：2026-08-08 用户授权 push；token 补 `workflow` scope 后解除 GH013 阻断；31 commits 全部推送到 origin/check-plan

---

## 7. Memory 关键教训（不重蹈覆辙）

- `Dual-Review Exit Code Capture Mandatory`：用 `cmd ; rc=$? ; echo $rc`；Windows Git Bash 上 `bash -c 'echo EXIT=$?'` 会重置 `$?` 为 0。**WSL 是 POSIX bash，无此问题，但仍统一用前者**
- `MSYS Path Conversion Gotcha`：Windows Git Bash 上 `rg -E` 会因 MSYS path-translation 报 `unknown encoding`；用 `rg --no-config --no-filename -F`。**WSL 无 MSYS 问题**
- `Edit Tool Not Python for Markdown`：subagent 用 Edit 工具改 markdown，不用 Python/sed
- `First-Reviewer Fabricated Specific Numbers`：reviewer 的每个数字必须来自真实命令
- `Verify-before-concluding`：完成前跑最便宜验证（ls/test -f/grep -c）
- `Dual-Review Third Reviewer Catches 1st 2nd Bias`：分类/调查任务 2 层 review 可能同向偏差，必要时加第 3 层
- `Iterate-Until-Pass Round Cascade`：dual-review 多轮迭代可能产生 3-5 轮 low-severity findings；stop at 0 findings
- `Task-Lens-Outcome-V1 WSL-Canonical Precedent`：outcome-governance 工作 canonical env 是 WSL Ubuntu-24.04 native FS；Windows Git Bash 上有 5 个 frozen-test 失败（EPERM symlink/fsync/SQLite path-doubling），但 **PHASE-07 已修复其中 3 个**（junction + dirname + coverage-reader），WSL 下应全绿
- `Block On Uncertain V2 Implementation Start`：用户给高层指令但 scope/env/path 不明时先 BLOCK 列 blocker 再问

---

## 8. 已知未解决 / 风险

1. **WSL evidence 未采集**（本 session 无 WSL 环境）→ PHASE-08 核心
2. **真实 reviewer 验证未做**（M1 核心目标"一屏看完"只验证了代码层，未验证人使用层）
3. GitHub "must be through PR" 规则：未来直接 push 可能被拦
4. `scripts/.env` 与 `scripts/local-paths.json` 是 Windows 路径（gitignored）；WSL 下需重生成或改用 env vars
5. `logs/` 缺本次 session 的 commit log（3 个 commit 未记录）

---

## 9. 上下文接收 checklist（WSL session 启动时验证）

- [ ] `git log --oneline -1` = `2cf4f1e`
- [ ] `git status --porcelain` 为空
- [ ] `bun run typecheck` RC=0
- [ ] `bun test scripts/task-lens` = 156/0
- [ ] `bun test scripts/__tests__/validate-outcome-governance.test.ts` = 15/15（WSL 期待全绿，Windows 有 1 EPERM fail）
- [ ] validator e2e = `{"ok":true,"lifecycle":"ACTIVE","errors":[]}`
- [ ] WSL clone 存在且 HEAD = 2cf4f1e

如果以上全 PASS，直接进入 PHASE-08 实施（§4 清单）。

---

**End of handoff**
