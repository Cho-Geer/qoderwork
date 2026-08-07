# 2026-08-08 — Windows Git Bash 5 个 task-lens 测试失败解决方案（双层审核终版决策记录）

## 为什么

v2 实施前置调查：`bun test scripts/task-lens/` 在 Windows Git Bash 上有 5 个失败（TL-ATOMIC / TL-CONFLICT / TL-C-103 / TL-PROBE / provider integration）。主会话启动双层独立审核（1st general-purpose 调查 → 2nd high-precision 复审 → 主会话独立复核），得出终版解决方案。本记录固化结论，作为 B1 环境决策与 v2 gen2 amendment 的输入。

## 双层审核结论

| 层 | 角色 | 结论 |
|----|------|------|
| 1st | general-purpose（调查） | 3 类根因 + 方案矩阵，含 fsync `"r"` 只读句柄 EPERM 新发现 |
| 2nd | high-precision（独立复审） | REWORK：1 BLOCKING（S7 数学错）+ 1 HIGH（WSL-only 误读 v2 意图）+ 4 LOW |
| 主会话 | 独立复核 | BLOCKING + HIGH 两项 claim 均 VERIFIED（dirname 数学 + v2 plan REQ-CROSS-ENV） |

## 根因与方案

### 组 1：TL-ATOMIC + TL-CONFLICT（fsync EPERM）— Windows 语义差异（可修，见修正记录）

- **根因**：`scripts/task-lens/artifact-writer.ts:241/380/394` 三处 fsync，句柄均为只读 `"r"`。实测：文件句柄 `"r"` fsync → EPERM；`"r+"`/`"a"` fsync → OK；目录句柄 fsync → 无条件 EPERM（Windows libuv 设计）。WSL 全 OK。
- **CORRECTION（业界标准解法，非 OS 能力上限）**：Windows fsync EPERM 是 Node/libuv 已知平台问题，有标准解法：
  - 文件 fsync 只读句柄 → 换可写句柄打开（`"r+"`/`"a"`）——**实测 OK**（probe：`"r"` FAIL / `"r+"` OK / `"a"` OK）；
  - 目录 fsync → Windows 无目录 fsync 语义（`FlushFileBuffers` 不支持目录句柄），标准做法 `try { fsyncSync } catch (EPERM) {}` 跳过（NTFS 目录项更新自动）。先例：Git `core.fsyncObjectFiles`、SQLite Windows `synchronous=FULL`、Node `write-file-atomic`（Windows 跳过 dir fsync）。
- **修正后方案矩阵**：S4' = L241 `openSync(filePath, "r")` → `"r+"`；S5' = L380/L394 目录 fsync 包 try/catch EPERM 跳过。均为 Windows-only 行为变更；WSL/POSIX 行为不变（POSIX `"r+"`≈`"r"`；catch 不影响 POSIX 目录 fsync）。
- **修正后归属**：触碰**生产代码** `artifact-writer.ts`。bundle `outcome-test-bundle.json` 只绑定测试文件 + fixtures + oracle_sources + runner_config + lockfiles（不含生产代码）；但 `outcome-contract.json:39` `baseline_tree_sha256: 29750437...` 绑定整树，当前树 `d9f25e14...` 已漂移（实测 6 提交）→ 生产代码变更必须走 v2 gen2 amendment 作为合法渠道。

### 组 2：TL-PROBE + provider integration（SQLite path-doubling）— 测试 fixture bug（唯一可修 bug）

- **根因**：`provider-graph.test.ts:81/:269` `dbPath.replace("/.codegraph/codegraph.db", "")` 正斜杠字面量；Windows 反斜杠路径下 replace 为 no-op → `codegraph-provider.ts:89` `join(dir, ".codegraph", "codegraph.db")` 二次拼接。生产代码正确，纯测试 fixture 问题。
- **方案（2nd 修正 S7 数学错误）**：~~S7 `path.dirname(dbPath)`~~ BLOCKING 已否决（只剥 1 段仍 double）；**S7' `path.dirname(path.dirname(dbPath))`** ✅（剥 2 段，主会话独立数学验证通过）；**S7'' 重构 fixture 返回 `{root, dbPath, cleanup}` 直传 root** ✅ 首选。
- **改动归属**：改 SHA-frozen 测试 → **必须走 v2 gen2 amendment**。

### 组 3：TL-C-103（symlink EPERM）— fixture 写法问题

- **根因**：`command-security.test.ts:240` `fs.symlinkSync(project, link)` 无 type → file-type symlink → 非管理员 Windows EPERM。
- **方案**：**S8 加 `"junction"` 参数** ✅ 已验证（junction 无需管理员；realpath 正确解析；`assertOutputOutsideProject` 正确抛 exit 10）；S9 test.skip ❌ 丢覆盖。junction 是目录链接的 Windows 形态，正是防护要测的攻击面，非 hack。
- **改动归属**：改 SHA-frozen 测试 → **必须走 v2 gen2 amendment**。

### 修正记录（2026-08-08）

- **修正日期**：2026-08-08（verify-before-concluding 复核首版结论后发现错误，同日修正）。
- **修正内容**：组 1 结论由「OS 能力上限，无 Windows 修复」改为「Windows 语义差异（可修：文件 r+ / 目录 catch EPERM）」；组 1 标题、方案矩阵、汇总表 TL-ATOMIC/TL-CONFLICT 行、关键区分句同步修正。
- **修正原因**：首版将「Windows 无目录 fsync 语义」误判为「不可修」。Windows fsync EPERM 是 Node/libuv 已知问题，业界标准解法明确（见组 1 CORRECTION）。修改前已重读本文件并核实 `artifact-writer.ts:241/380/394`（`openSync(...,"r")`）与 `outcome-contract.json:39`（baseline_tree_sha256 `29750437...`）等原始证据。
- **涉及行**：组 1 标题（原 L17）、组 1 方案行（原 L20）、汇总表 L38-39、关键区分 L44；新增本节。

## 汇总表

| 失败 | 根因类型 | 推荐方案 | 对 v1 门控 | 对 v2 验收 | 改动归属 |
|------|---------|---------|-----------|-----------|---------|
| TL-ATOMIC | Windows 语义差异（可修：文件 r+ / 目录 catch EPERM） | S4'（L241 `"r"`→`"r+"`）+ S5'（L380/L394 dir fsync catch EPERM） | ✅ WSL-only 合法 | ✅ 可修（改生产代码需 gen2 amendment） | v2 gen2 amendment |
| TL-CONFLICT | 同上（级联） | 同上 | ✅ | ✅ 可修（同上） | v2 gen2 amendment |
| TL-C-103 | fixture 写法（file-type symlink） | S8 junction 参数 | ✅ WSL-only 合法 | ✅ junction 可过 | v2 gen2 amendment |
| TL-PROBE | 测试 fixture bug（正斜杠 replace） | S7'（dirname×2）或 S7''（refactor 传 root） | ✅ WSL-only 合法 | ✅ 可修 | v2 gen2 amendment |
| provider integration | 同上（同源） | 同上 | ✅ | ✅ | v2 gen2 amendment |

**关键区分（修正后）**：TL-ATOMIC/CONFLICT 是 **Windows 语义差异（可修）**——文件 fsync 换 `"r+"` 句柄 + 目录 fsync catch EPERM（业界标准解法，见组 1 与修正记录）；TL-PROBE/C-103 是可修 fixture bug（Windows 症状跨平台根因）。5 个失败均无跨平台逻辑 bug，但 TL-ATOMIC/CONFLICT 修复触碰生产代码 `artifact-writer.ts`，必须经 v2 gen2 amendment。

## 决策

- **decision**: RECORDED（双层审核终版结论固化；不实施任何修复）
- **approved_by**: 主会话（Final Gate 独立复核）
- **approved_at**: 2026-08-08
- **未授权项**: 任何修复未执行——TL-PROBE/C-103 改 frozen 测试需 v2 gen2 amendment；TL-ATOMIC/CONFLICT 需 v2 gen2 契约决策；全部属 v2 实施阶段产物

## Verified-by（主会话独立复核关键证据）

- `bun test scripts/task-lens/__tests__/...` → 5 fail（fsync EPERM ×2 / symlink EPERM / SQLite path-doubling ×2），bun:test rc=1（实测：`bun test ... > /tmp/out 2>&1 ; rc=$?` → rc=1；方法论：读真实 exit code 非仅 stdout）
- fsync 探测 → `"r"` FAIL / `"r+"` OK / `"a"` OK / dir FAIL（bun 1.3.14 + node 22 双验）
- junction 探测 → 创建 OK（非管理员）；realpath 解析到 project；`assertOutputOutsideProject` 抛 ConfigError exit 10
- dirname 数学 → once `C:\tmp\tl-cg-123\.codegraph` 仍 double；twice `C:\tmp\tl-cg-123` 正确
- frozen SHA → artifact-writer.test.ts `8625f9...` / command-security.test.ts `bb058c...` / provider-graph.test.ts `2b6e2f...` 均与 outcome-test-bundle.json 匹配（注：`8625f921` 是 **test file** SHA 且在 bundle `tests[]`；production `artifact-writer.ts` SHA=`f9e18989...` **不在 bundle**，仅触发 `baseline_tree_sha256`）
- v2 plan → 00-plan-index.md:97 REQ-CROSS-ENV「任一 FAIL = 整体 FAIL」+ L170 同 + L188 双 case 行
- v1 contract → outcome-contract.json:34 `"Windows/其他 OS 实机行为"` 在 out_of_scope

## 风险与后续

- **v2 gen2 amendment 前置**：TL-PROBE/C-103 修复需 gen2 amendment 覆盖 frozen 测试变更（SHA 绑定解除）
- **v2 gen2 契约决策**：TL-ATOMIC/CONFLICT 的 Windows 端 fsync 降级需契约变更，属 PHASE-07 验收范围
- **B1 环境决策输入**：本记录是 B1（WSL canonical vs Windows Git Bash vs hybrid）的实证依据——Windows 端测试全绿需上述 v2 gen2 变更，当前 canonical 仍是 WSL
- **X4 前置排序（新增）**：validator `relative()` 路径归一化修复（standalone，见 `logs/2026-08-08-validate-outcome-governance-relative-path-windows-fix.md`）必须先于 PHASE-07 gen2 ledger event-003/004 落盘；否则 gen2 链在 Git Bash 上验证级联 REFERENCE_MISSING 阻塞 PHASE-07
- **13-case 分解（新增）**：gen2 acceptance-spec-v2 `cases[]` = 9 affected（TL-C-401/402/I-501/M-601 × WSL/GITBASH + TL-X-001）+ 4 unaffected（CASE-001..004）= 13；requirements = 5 affected（REQ-011v2..014v2 + REQ-CROSS-ENV）+ 4 unaffected（REQ-001..004）= 9；符合 lib L261-262 sameSet union
- **WSL no-op UNVERIFIED（新增）**：X4 归一化在 POSIX `path.sep === "/"` 下恒等（逻辑成立），但当前环境无 WSL bun 实证；WSL 对照跑留待 v2 实施阶段补
- **未碰**: scripts/（生产代码与测试均未改）、plans/task-lens-m1-completion-v2/、plans/task-lens-outcome-v1/、blueprints/INDEX.md、audits/
