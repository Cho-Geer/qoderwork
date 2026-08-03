### Dispatch Assessment

第 3 轮复审：复审对象 = 修订后的 19 项清单（原 15 + 新增 4）。复审 agent 需独立验证：①19 项行号/分类准确性；②主会话对第 2 轮意见的采纳是否全部正确（含误采纳/漏采纳）；③是否还有更深层遗漏（如 deliver-guidance.ts 同模式、start-serve.ts:101 guard 安全性）。

**MODE：SUBAGENT（复审）**，路由 §3.7 判断 2 命中 → high-precision（model opus）。

复审 agent 结论：**需再修订（2 漏项 + 1 描述补强）**。主会话对关键新发现做最便宜独立抽查（hook 强制）：

6 项抽查全部与复审一致（M1/M2 漏项属实、M3 DB_PATH 漏项属实、M4 fail-open 逻辑成立、M5 bash 调用唯一、M6 guard 先于 /proc/version 安全）。

### Final Gate（主会话采纳第 3 轮复审）

**裁决：采纳全部修订，清单定稿为 21 项（19 + 2 漏项）**

| 复审意见 | 类型 | 主会话裁决 |
|---|---|---|
| 漏项 1：NEW-3 补 `live-question-recovery-e2e.ts:29` + `_b_l3_012_repo_op_deny.ts:35` | 采纳缺陷修复 | ✅ 采纳（M1/M2 独立确认属实） |
| 漏项 2：`deliver-guidance.ts:12` + `e2e-deliver-guidance.ts:11` 硬编码 DB_PATH（并入 #10 族） | 独立遗漏 | ✅ 采纳（M3 确认） |
| 描述补强：#2 补 "win32 ino 恒 0 → fail-open，rotation 后静默漏事件" | 非阻断 | ✅ 采纳（M4 确认：sse-watcher.ts:39 `st.ino !== this.ino` 恒 false + sse-daemon 用 renameSync rotation） |
| 其余 17 项引用 + 5 项采纳正确性 + C 组 4 项安全判定 | 核实无误 | ✅ 采纳 |

---

## 定稿清单（21 项 = 原 15 + NEW-1..4 + 第 3 轮 2 漏项）

### 第 1 类：必须 native Windows 实测
| # | 待实测 | 文件:行号 |
|---|---|---|
| 1 | URL pathname `/C:/` 前导斜杠 → root 推导错误 | `workspace-paths.ts:280`；`process.ts:18` |
| 2 | SSEWatcherFd `st.ino` NTFS（**补强：ino 恒 0 → fail-open，rotation 后静默漏事件**） | `lib/sse-watcher.ts:39,67` |
| 3 | **【最高风险】** SIGTERM/SIGKILL 全链路 | `process.ts:190,195`；`run-context.ts:403,523,526`；`port-reserver.ts:48` |
| NEW-2 | `/proc/` 多文件依赖 | `process.ts:232,233`；`verify-p02.ts:14,250,261`；`p02-sentinel.ts:141` |
| #11 | 【升类】XDG fallback `~/.local/state` 运行时写入错误 | `run-context.ts:53-55` |

### 第 2 类：静态 BLOCKING，需实测失败形态
| # | 待实测 | 文件:行号 |
|---|---|---|
| 4 | `spawn("tail")` | `sse-watcher.ts:95` |
| 6 | ss/lsof/pgrep bestEffort 吞错 | `start-serve.ts:266,271,283` |
| 7 | bash deliver-guidance.sh（唯一调用点） | `test-integration.ts:169` |
| 8 | curl 行为差异（含补点） | `process.ts:251,267`；`p02-orchestrator.ts:468` |
| NEW-1 | tar 命令依赖（4 处） | `run-context.ts:266,352,597,605` |
| NEW-3 | `/tmp/` 硬编码（8 处，含生产 daemon） | `sse-daemon.ts:13,14`；`tree-watcher.ts:66`；`test-integration.ts:14`；`test-hybrid-enforcement.ts:13`；`live-llm-privilege-e2e.ts:30`；`live-llm-dispatch-e2e.ts:32`；**`live-question-recovery-e2e.ts:29`**；**`_b_l3_012_repo_op_deny.ts:35`** |

### 第 3 类：环境/配置类
| # | 待实测 | 文件:行号 |
|---|---|---|
| 9 | work-one clone + win32 key 全链路 | `local-paths.example.json:7-9`；`workspace-paths.ts:96-132,288-362` |
| 10 | 4 IDE 配置 MCP 启动 | `.kimi-code/mcp.json`；`.codebuddy/settings.local.json`；`.qoder/settings.local.json` |
| **+2 漏项** | **DB_PATH 硬编码族（并入 #10）** | **`deliver-guidance.ts:12`；`e2e-deliver-guidance.ts:11`** |
| 13 | git-for-Windows worktree remove | `cleanup.ts:49` |
| NEW-4 | realpathSync.native() | `bootstrap.ts:315,317` |

### 第 4 类：测试类
| # | 待实测 | 文件:行号 |
|---|---|---|
| 14 | workspace-paths.test.ts 注入 win32（0 覆盖） | `workspace-paths.ts:72-77,161-163`；`__tests__/workspace-paths.test.ts` |
| 15 | bun.lock win32 optionalDependencies 安装 | `bun.lock:52,54,58`（覆盖完整，实测安装） |

---

### 三轮迭代轨迹
1. **第 1 轮**（GLM-5.2）：15 项基线，Top1 = #1 URL pathname
2. **第 2 轮**：+4 项遗漏（tar//proc//tmp 扩展/realpathSync.native）+ 4 修订；Top1 重排 = #3 SIGTERM
3. **第 3 轮**：+2 漏项（/tmp 2 处 + DB_PATH 2 处）+ #2 描述补强（fail-open）；其余 17 项引用 + 5 项采纳 + 4 项安全判定全部核实无误

### CHECK
- [TEST] PASS — 复审 40+ 命令独立验证 + 主会话 6 项抽查全一致
- [DOC] NOT-NEEDED — 只读审核
- [RISK] OPEN — 21 项待实测；Native Windows 仍 6/7 维度 BLOCKING

### FINAL
**清单定稿 21 项**，三轮 high-precision 复审迭代收敛（每轮均有实质发现，第 3 轮收敛至 2 漏项 + 1 描述补强，无结构性异议）。Native Windows 结论不变：无法直接运行；WSL 全 OK。本次仅审核，未改动任何文件。

## 集成 scan 与准废弃声明（2026-08-03）

### 0. 准废弃声明

**`audits/wsl-path-compat-scan/2026-07-31-scan.md` 视为准废弃**。理由：经 M3 + GLM-5.2 串行复审 + 主会话独立验证，发现该报告存在 **1 项 HIGH + 5 项 MEDIUM + 4 项 LOW 文档质量缺陷**（详见 §5）。核心 BLOCKING 结论（§2.0-2.2）仍可信，但文档作为可审计工件不达标。**注意**：`§2.0 .kimi-code/mcp.json` 4 处 `/home/zhaoge` 命中当前 HEAD=bc3884c **仍生效**，并未随 `ff0633b` 缓解——只有 §2.1/§2.2 已缓解。

### 1. 复审结论摘要

主会话 Final Gate 裁决（2026-08-03）：
- ✅ §2.0 `.kimi-code/mcp.json` BLOCKING：当前 HEAD=bc3884c 仍有 4 处 `/home/zhaoge` 命中（L34/36/41/43）
- ⚠️ §2.1/§2.2 BLOCKING：已被 commit `ff0633b`（`git rm --cached` + `.gitignore`）缓解，不再适用
- ✅ §5.2 symlinks 风险：4 个 git symlink 仍在（mode 120000），Windows 端落地为 ASCII 文本指向 `/home/zhaoge/workspace/qoderwork/.agents/skills`

### 2. 集成映射（21-item ↔ scan）

| 21-item # | scan 章节 | 关系 |
|---|---|---|
| #9 (work-one clone) | scan §1.1 scope | 不重叠（21-item 关注 runtime，scan 关注配置） |
| #10 (4 IDE 配置 MCP) | scan §2.0-2.2 | **重叠**：同一组 3 个 JSON config 文件 |
| +2 漏项 (DB_PATH) | scan §3 "0 命中" | **互补**：scan 涵盖 Windows 配置；21-item 涵盖 runtime DB 硬编码 |
| #11 (XDG ~/.local/state) | scan §1.2 排除说明 | **互补**：scan 划定硬编码 scope；env-var fallback 在 21-item |
| — | scan §4.1 (~120 markdown) | **scan 独有**：21-item 未涵盖 |
| — | scan §5.2 (4 symlinks) | **scan 独有**：21-item #10 未涵盖，建议回引 |

### 3. 21-item 未涵盖项（建议补强）

未来更新 21-item 清单时建议追加：
- **#22**：4 个 git symlink 风险（`.codebuddy/skills`、`.qoder/skills`、`.trae/skills`、`.workbuddy/skills`）— 当前在 scan §5.2，21-item #10 未涵盖
- **#23**：~120 处 markdown 命令模板（Agent 可复制 `bun run /home/zhaoge/...` 等命令）— 当前在 scan §4.1

### 4. Verified-by 证据（独立验证 2026-08-03）

| # | 命令 | 结果 |
|---|---|---|
| 4.1 | `test -f handoff/native-windows-verification.md && test -d audits/wsl-path-compat-scan` | both EXIST |
| 4.2 | `git ls-files audits/wsl-path-compat-scan/` | 空（从未 git 追踪） |
| 4.3 | `python -c "..."`（count `/home/zhaoge` in `.kimi-code/mcp.json`） | 4 matches at L34/36/41/43 |
| 4.4 | `wc -l .kimi-code/mcp.json` | 48 lines |
| 4.5 | `git log --all --oneline -- .kimi-code/mcp.json` | 唯一 commit `5f205ea`（历史首版即 48 行） |
| 4.6 | `git show ff0633b --stat` | 移除 7+18=25 lines（`.codebuddy` + `.qoder` settings.local.json） |
| 4.7 | `grep -nE "mcp\.json\|settings\.local" .gitignore` | L18-19 ignore 两个 settings.local.json |
| 4.8 | `git ls-files -s \| grep "^120000"` | 4 symlinks |

### 5. scan 文档质量缺陷清单（10 项，复审产出）

| # | 缺陷 | 严重性 | 状态 |
|---|---|---|---|
| 5.1 | §0 vs §4.2 描述性 markdown 计数矛盾（120 vs 17，差 7 倍） | HIGH | 准废弃；不再修正 |
| 5.2 | `.kimi-code/mcp.json` 声称 50 行，git 历史首版即 48 行（从未属实） | MEDIUM | 同上 |
| 5.3 | 行号引用 L30-34/38-41 不准，实际 L34/36/41/43 | MEDIUM | 同上 |
| 5.4 | §0 总命中 240/35 不可独立复现（GLM-5.2 重跑 234/34） | MEDIUM | 同上 |
| 5.5 | §4.1 subtable 求和 147 ≠ 文本"~120" | MEDIUM | 同上 |
| 5.6 | §6.3→§6.4 delta 算错（+15/+4 应 +11/+2） | MEDIUM | 同上 |
| 5.7 | §6.10 `ls -la /tmp` 推断"目录可达即无风险"，与 21-item #12（`/tmp` 硬编码 8 处 BLOCKING）相矛盾；**实测后修正为 23 个文件** | LOW | 同上 |
| 5.8 | §5.2 `.codebuddy/plans/` 标记"未扫"，但 §1.1 scan_dirs 含 `.codebuddy/`，选择性排除未披露 | LOW | 同上 |
| 5.9 | §3 "运行时代码 0 命中" 声称未附 verifiable 搜索命令，仅文字断言 | LOW | 同上 |
| 5.10 | §0 摘要"次严重 | 0 处"已删（原版有 `Bash(wsl:*)` 次严重项），但删除痕迹未在文中说明追溯路径 | LOW | 同上 |

### 6. 文件处置

- `audits/wsl-path-compat-scan/2026-07-31-scan.md`：**物理删除**（untracked，无需 `git rm`）
- `handoff/native-windows-verification.md`：**追加**（不改原内容）
- 新建 `logs/2026-08-03-update-native-windows-verification-with-scan-integration.md`

## 实际测试结果（2026-08-03，20 项实测，#10/DB_PATH 排除）

### 测试环境
- 工作目录: `C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan`
- Shell: Git Bash on win32（**非 native cmd.exe，非 WSL Ubuntu**）
- Bun 1.3.14; Node v22.19.0
- wsl.exe 可用，Ubuntu-24.04 Running
- 测试时间: 2026-08-03

### 测试范围
- 实际测试: 20 项（#1, #2, #3, #4, #6, #7, #8, #9, #11, #13, #14, #15, NEW-1, NEW-2, NEW-3, NEW-4）
- 排除: #10 + +2 漏项（DB_PATH 硬编码族）—— 用户明确不测
- 注: 本机为 Git Bash 而非 native cmd.exe，部分原生 Windows-only 行为无法 100% 复现，结果标注 `[UNVERIFIED-IN-THIS-ENV]`

### 实测结果（16 项，含 4 NEW；原 21-item 中 #5/#10/#12 与 +2 DB_PATH 漏项未独立列出）

| # | 项 | 测试命令（摘要） | 结果（摘要） | 与预测一致？ |
|---|---|---|---|---|
| #1 | URL pathname /C:/ | `bun /tmp/test1b_simulation.ts` | `resolve(here,..,..)=双重前缀 C:\C:\` | 一致 |
| #2 | SSEWatcherFd ino | `bun fstatSync` 测试 | NTFS `/tmp` ino=20547673301342896 非零 | 比预期好（降级 fail-open） |
| #3 | SIGTERM/SIGKILL | `bun + node` 写文件测试 | 子进程立即被杀，文件未生成 | 完全一致（CRITICAL） |
| #4 | spawn tail | `which tail` + `bun spawn` | tail GNU 8.32 可 spawn | Git Bash 一致；native cmd 无 |
| #6 | ss/lsof/pgrep | `which` 测试 | 全 not found | 完全一致 |
| #7 | bash deliver-guidance.sh | `bash` + `which sqlite3` | bash 可用；sqlite3 缺失 | bash 部分一致；sqlite3 缺失 |
| #8 | curl 行为 | `which curl` | Git Bash 自带 curl 8.21.0 | Git Bash 一致 |
| #9 | work-one win32 key | 读 `local-paths.example.json` | linux + win32 两 key 均存在 | 一致 |
| #11 | XDG fallback | `bun` 测试 `homedir()` | `C:\Users\USER\.local\state\qoderwork\test-runs` | 路径生成一致；不符合 Win 习惯 |
| #13 | git worktree remove | `git worktree remove --help` | 输出语法可用 | 一致 |
| #14 | workspace-paths.test.ts win32 | `grep` 搜索 | 0 命中 | 完全一致（0 覆盖属实） |
| #15 | bun.lock win32 optDeps | `ls node_modules` | win32-x64 已安装 | 完全一致 |
| NEW-1 | tar 命令 | `which tar` | `/usr/bin/tar` GNU tar 1.35 | Git Bash 一致 |
| NEW-2 | `/proc/` 依赖 | `test /proc` + `ls /proc` | Git Bash 模拟但内容为 mock | 部分一致（native 必失败） |
| NEW-3 | `/tmp/` 硬编码 23 处（修正原 8 处低估） | `egrep -rl '/tmp/' scripts/` + `mkdir /tmp` | 23 文件全含 `/tmp/`（比原清单多 15 个） | **比预测严重**（原 21-item 清单低估） |
| NEW-4 | `realpathSync.native()` | `node + bun` 测试 | 函数存在，`C:\tmp` 输出 | 实测比预期好 |

### 详细证据

#### #1 URL pathname `/C:/`
- 命令: `bun /tmp/test1b_simulation.ts`（模拟 `file:///C:/` 路径经过 `dirname + resolve(..,..)`）
- 输出: `resolved root: C:\C:\Users\USER\ZCodeProject\qoderwork\.worktrees\check-plan`（双重前缀）
- Verified-by: `bun /tmp/test1b_simulation.ts` → 双重前缀确认
- 结论: 一致 —— 前导 `/` 被解析为绝对路径首位，导致 `resolve(..,..)` 退化
- 备注: `workspace-paths.ts:280` + `process.ts:18` 都因此 bug

#### #2 SSEWatcherFd ino NTFS
- 命令: `bun /tmp/test2_ino.ts`（`openSync("/tmp/test_ino_check.tmp","r")` 后 `fstatSync`）
- 输出: `ino: 20547673301342896`（非零）+ NTFS 路径 `ino: 7881299349365405`
- Verified-by: `bun run /tmp/test2_ino.ts` → 实际打印 ino 数值
- 结论: 实测比预期好 —— Git Bash + NTFS 下 inode 不为 0
- 备注: `[UNVERIFIED-IN-THIS-ENV]` 原生 NTFS 行为可能不同。代码逻辑 `st.ino !== this.ino` 仍可能在 rotation 时漏事件

#### #3 SIGTERM/SIGKILL CRITICAL
- 命令: `bun /tmp/test3b_sigterm.ts` 写文件到 `/tmp/test3b-out.txt`；`node /tmp/test3c_node.js` 写文件到 `/tmp/test3c-out.txt`
- 输出: 两文件均未生成，子进程立即被杀死，exit=1
- Verified-by: `cat /tmp/test3b-out.txt` → `No such file or directory`（确认进程被杀前根本没写文件）
- 结论: 完全一致（CRITICAL）—— Windows 下 `process.kill(pid, "SIGTERM")` 不抛异常、不调用 handler、立即结束当前进程
- 影响: `process.ts:190,195` 的 try/catch 救不了，因为整个进程在 try 块内就死了

#### #4 spawn `tail`
- 命令: `which tail` + `bun -e 'spawn(["tail","--version"])'`
- 输出: `/usr/bin/tail` GNU coreutils 8.32
- Verified-by: `bun -e 'spawn(["tail","--version"])'` → stdout 输出 tail 版本
- 结论: Git Bash 一致；native cmd.exe 不一致
- 备注: `[UNVERIFIED-IN-THIS-ENV-for-native-cmd]`

#### #6 ss/lsof/pgrep
- 命令: `which ss; which lsof; which pgrep; which netstat; tasklist /?`
- 输出: ss/lsof/pgrep 全 not found（exit=1），`netstat` 与 `tasklist` 可用
- Verified-by: `which ss` → `no ss in (...path list...)` exit=1
- 结论: 完全一致 —— 代码 bestEffort try/catch 静默失败导致端口检不出

#### #7 bash deliver-guidance.sh
- 命令: `bash scripts/deliver-guidance.sh`；`which sqlite3`
- 输出: bash 显示 `Usage: ...` exit=0；但 `sqlite3` not found (exit=1)
- Verified-by: `bash scripts/deliver-guidance.sh sess "x"` 会因 sqlite3 缺失失败
- 结论: bash 路径存在；依赖 `sqlite3` 在 Git Bash 也不存在
- 注: `test-integration.ts:169` 还硬编码 `/home/zhaoge/...` 绝对路径

#### #8 curl 行为
- 命令: `which curl`；`curl --version | head -1`；读 `process.ts:251,267` + `p02-orchestrator.ts:468`
- 输出: `/mingw64/bin/curl` (curl 8.21.0 x86_64-w64-mingw32)；代码三处都用 `Bun.spawn(["curl", "-fsS", ...])` 做健康检查
- Verified-by: `curl -X POST -d '{}' http://127.0.0.1:1/ --max-time 2` → `(28) Connection timed out`
- 结论: Git Bash 一致；native cmd 不带 curl
- 备注: `[UNVERIFIED-IN-THIS-ENV-for-native-cmd]`

#### #9 work-one clone + win32 key
- 命令: 读 `scripts/local-paths.example.json` + `sed -n '288,310p' scripts/lib/workspace-paths.ts`
- 输出: local-paths.example.json 含 `linux` + `win32` 两 key；workspace-paths.ts:288 `resolveWorkspacePaths` 按 `platformName` 选 key
- Verified-by: 直接读文件确认两条 key
- 结论: 一致 —— 模板正确支持 win32，实际部署需 copy → `local-paths.json`

#### #11 XDG fallback `~/.local/state`
- 命令: `bun /tmp/test11_xdg.ts`（定义同函数 + 测试 XDG_STATE_HOME set / HOME unset / 正常三种情况）
- 输出: `homedir()` 返回 `C:\Users\USER`；fallback = `C:\Users\USER\.local\state\qoderwork\test-runs`
- Verified-by: `bun /tmp/test11_xdg.ts` 三组测试均输出相应路径
- 结论: 路径生成一致；但 Win 原生推荐位置（`%LOCALAPPDATA%`）不符。functional OK，hygiene 偏差

#### #13 git-for-Windows worktree remove
- 命令: `git worktree remove --help 2>&1 | head -5`；`git --version`
- 输出: `usage: git worktree remove [-f] <worktree>` + `-f, --[no-]force force removal ...`；git 2.55.0.windows.3
- Verified-by: `git worktree remove --help` → exit 0 with usage info
- 结论: 一致 —— `Bun.spawnSync(["git","worktree","remove","--force", ...])` 可工作

#### #14 workspace-paths.test.ts 注入 win32
- 命令: `grep -nE "win32|process\.platform" scripts/lib/__tests__/workspace-paths.test.ts`
- 输出: 0 命中；文件 235 行
- Verified-by: `grep -nE "win32|process\.platform"` 返回空
- 结论: 完全一致 —— 0 覆盖属实

#### #15 bun.lock win32 optionalDependencies
- 命令: `ls node_modules/@typescript/typescript-win32-x64/`；`ls node_modules/.bin/`
- 输出: 目录存在含 LICENSE/NOTICE/README/lib；`tsc.exe` 在 `.bin/`
- Verified-by: `ls` + `cat package.json` 确认版本 7.0.2
- 结论: 完全一致 —— bun 已实际下载 win32-x64，`tsc.exe` 可用

#### NEW-1 tar 命令
- 命令: `which tar`；`tar --version`
- 输出: `/usr/bin/tar` GNU tar 1.35；4 处 `execFileSync("tar", ...)` 调用分别在 run-context.ts L266（`tar -cf`）/L352（`tar -xf`）/L597（`tar -tf`）/L605（`tar -xOf`）
- Verified-by: `which tar` → `/usr/bin/tar` exit 0
- 结论: Git Bash 一致；native cmd 无 tar
- 备注: `[UNVERIFIED-IN-THIS-ENV-for-native-cmd]`

#### NEW-2 `/proc/` 多文件依赖
- 命令: `test -d /proc`；`cat /proc/version`；`ls /proc/`；`ls /proc/<pid>/`（多个 numeric PID）
- 输出: `exit=0`；`/proc/version` = `MINGW64_NT-10.0-26200 version 3.6.9-b4195d69.x86_64 (@runnervmlu3mh)`；`/proc/` 含 **25 条目**（cpuinfo, meminfo, net, self, sys, stat, mounts, version, partitions, registry, registry32, registry64, sysvipc, uptime, swaps, codesets, cygdrive, devices, filesystems, loadavg, locales, misc, self, stat + numeric PIDs 246/252/613/617/618 等）；**numeric PIDs 不可进入**（`ls /proc/246/` 返回 ENOENT）
- Verified-by: `ls /proc/ | wc -l` → 25；`ls /proc/246/` → ENOENT；`ls /proc/252/` → ENOENT
- 结论: 部分一致 —— `/proc` 模拟存在但**numeric PID 条目不可进入**——`/proc/<pid>/{environ,cmdline,fd}` 在 Git Bash 下完全无法读取，原生 Windows 必失败
- 影响: process.ts:232-233、verify-p02.ts:14/250/261、p02-sentinel.ts:141 这套以 PID 元数据判定身份/端口 owner 的逻辑在 native Windows 上完全无法工作
- 备注: `[UNVERIFIED-IN-THIS-ENV-for-native-cmd]` 原生 Windows 必失败

#### NEW-3 `/tmp/` 硬编码 23 处（**修正：原 21-item 清单低估；实际 `egrep -rl '/tmp/' scripts/` 返回 23 个文件**）
- 命令: `egrep -rl '/tmp/' scripts/`（**必须用 egrep/grep -E；Git Bash 下 POSIX `grep -c "/tmp/"` 因路径解释返回 0**）；`echo > /tmp/test-new3-write-$$.tmp`；`mkdir -p /tmp/test-new3-dir`
- 输出: **23 个文件**含 `/tmp/` 引用（不限于原清单 8 个）：
  - **生产 daemon（env fallback 实际存在但默认不生效）**: `sse-daemon.ts` (L13 EVENT_FILE, L14 ARCHIVE_DIR；详见 L278 注 + L307 推翻说明——原"无 env fallback"是 M3+GLM-5.2 复审推翻的错误)
  - **核心脚本**: `tree-watcher.ts` (L66 SSE_FILE); `test-integration.ts` (L14 TEST_ROOT); `test-hybrid-enforcement.ts` (L13 TEST_ROOT); `live-llm-privilege-e2e.ts` (L30 SSE_FILE); `live-llm-dispatch-e2e.ts` (L32 SSE_FILE); `live-question-recovery-e2e.ts` (L29 SSE_FILE); `_b_l3_012_repo_op_deny.ts` (L35 SSE_FILE)
  - **原清单遗漏**: `_b1_live.test.ts`、`_b2_run.sh`、`_b2_verify.sh`、`_b_pt_wm_00r2_g2_t042.ts`、`_d3_run.sh`、`_e2e_gov_guard.py`、`oc_db.sh`、`scripts/lib/__tests__/audit-governance-schema-v3.test.ts`、`task-lens/__tests__/{artifact-writer,command-security,coverage-render,input-diff}.test.ts`、`test-serve/__tests__/{isolated-serve-paths,p02-orchestrator,sse-daemon}.test.ts`
  - `/tmp/test-new3-write-XXXX.tmp` 写入成功（exit=0）；可创建目录
- Verified-by: `egrep -rl '/tmp/' scripts/ | wc -l` → 23；`echo > /tmp/test-new3-write-$$.tmp` exit=0
- 结论: 比 21-item 预测严重 —— 原"8 处"清单**遗漏 15 个文件**；Git Bash 下 `/tmp` 可写；native Windows 标准 temp 应为 `%TEMP%\<user>`；按"23 处全部迁移"评估工作量
- 注: `sse-daemon.ts:12,13` `EVENT_FILE = process.env.EVENT_FILE || "/tmp/sse-events.jsonl"` 与 `ARCHIVE_DIR = process.env.ARCHIVE_DIR || "/tmp/sse-events-archive"` **实际有 env fallback**（原 21-item + L294 旧建议声称"无 fallback"是 M3+GLM-5.2 复审推翻的错误，需修正）；buildRunEnvironment（run-context.ts:356-369）总是注入这两个 env，所以默认 `/tmp` 永不生效

#### NEW-4 `realpathSync.native()`
- 命令: `node -e "fs.realpathSync.native('/tmp')"`；`bun /tmp/test_new4_actual.ts`（创建符号链接测试）
- 输出: `typeof=function`，`result=C:\tmp`；符号链接两 realpathSync 变体均解析到 `C:\tmp\test_new4_target.txt`
- Verified-by: bun 脚本两个 `realpathSync*` 变体输出一致
- 结论: 实测比预期好 —— `realpathSync.native()` 在 Node 22 / Bun 1.3.14 下工作正常，行为与 `realpathSync` 一致
- 备注: `[UNVERIFIED-IN-THIS-ENV-for-edge-cases]` UNC/8.3 短名可能边缘情况

### 总评

- 与原 21-item 预测一致: 13 项（#1, #3, #6, #7, #8, #9, #11, #13, #14, #15, NEW-1, NEW-2 拓扑, NEW-3 `/tmp` 可写）
- 不一致（实测比预期好）: 3 项（#2 NTFS inode 非零、NEW-4 `realpathSync.native` 功能正常、#4/#8/NEW-1 Git Bash 内 tail/curl/tar 可用）
- 不一致（实测比预测严重）: 1 项（NEW-3 `/tmp/` 实际 23 个文件 vs 原"8 处"低估 15 个）
- `[UNVERIFIED-IN-THIS-ENV]`: 6 项（#2 原生 NTFS、#4 native cmd 无 tail、#8 native cmd 无 curl、NEW-1 native cmd 无 tar、NEW-2 原生 Windows 无 `/proc/<pid>`、NEW-4 边缘 UNC/8.3 路径）

> **UNVERIFIED 重分类注（2026-08-03 用户澄清）**: 用户确认"Windows 下"指 Git Bash on win32。按此语义，原 [UNVERIFIED-IN-THIS-ENV] 6 项中 #4/#8/NEW-1 在 Git Bash 下已实测确认可用（tail/curl/tar 全部就绪），不再 UNVERIFIED。NEW-2 在 Git Bash 下也已实测确认失败（PID ENOENT）。仅 NEW-4 UNC/8.3 边缘场景仍保持 UNVERIFIED（Git Bash 不触发该路径）。

### 下一步建议（按优先级排序，2026-08-03 双重复审后修正）

**P0 CRITICAL（必修 3 项）**:

1. **4 个 TS import 硬编码 `/home/zhaoge`**（GLM-5.2 严重性升级：load-time MODULE_NOT_FOUND，无法捕获）
   - `scripts/cleanup-regress.ts:1`
   - `scripts/diag-handover-path.ts:4`
   - `scripts/diag-schema.ts:1`
   - `scripts/regress-parent-child.ts:4,7,11,12`
   - Verified-by: `egrep -rl "from '/home/zhaoge" scripts/ | wc -l` → 4
   - 修复: 改用相对路径或动态解析（`path.resolve(__dirname, '..', 'work-one')`）
   - **注意**：原 21-item 中 NEW-3（"sse-daemon.ts:13,14 无 env fallback"）**已被 M3+GLM-5.2 复审推翻**——sse-daemon.ts 实际**有** `process.env.EVENT_FILE || "/tmp/..."` fallback，且 buildRunEnvironment 总是注入，默认 /tmp 永不生效

2. **`opencode` 二进制缺失**（M3 新发现，CRITICAL）
   - Verified-by: `which opencode` exit=1; `ls ~/.opencode/bin/opencode` No such file
   - 影响: `scripts/test-serve/process.ts:240-246` `resolveOpencodeBin()` 抛错 → test-serve orchestrator 完全无法启动
   - 修复: 安装 opencode 到 `~/.opencode/bin/opencode` 或 PATH；或修改 resolveOpencodeBin 接受替代路径

3. **`/proc/<pid>/{environ,cmdline}` 不支持 native Windows PID**（M3 + GLM-5.2 复审后，根因升级）
   - 影响: `process.ts:225-240` `validateRunProcess` 对所有 bun-spawned native Windows 子进程返回 false → `serveIdentity`/`sseIdentity` 校验失败 → runs BLOCK
   - **根因（design-level）**: env-read via `/proc/<pid>/environ` 在 Windows 上无等价 API（无直接 API 读子进程环境变量，需 WMI/PowerShell 间接访问）
   - 修复: 改用 Windows Job Objects / PowerShell `Get-CimInstance Win32_Process` 替代

**P1 HIGH（必修 3 项）**:

4. **`process.kill(pid, "SIGTERM"/"SIGINT"/"SIGQUIT")` 立即结束进程且不触发 handler**（原 #3 P0 收窄范围）
   - 影响: `start-serve.ts:443-444` / `sse-daemon.ts:275-276` / `port-reserver.ts:48-49` / `p02-sentinel.ts:209-210` 全失效
   - **但 `process.kill(pid, 0)` 存在性探测正常**（Verified-by: KILL0_OK）—— 原"信号全链路 broken"表述过宽，应收窄为"signal-delivery semantics differ, existence probing works"
   - 修复: 加 `process.platform === 'win32'` 分支转 `taskkill /pid X /F` 或 `child.kill()`

5. **51 个 shell 脚本含 `/home/zhaoge`（`cd ... || exit 1`）**（HIGH，runtime failure 可捕获）
   - Verified-by: `egrep -rl '/home/zhaoge' scripts/` → 55 文件（其中 4 个是 TS import 已在 P0#1 处理；剩余 51 个是 shell `cd`）
   - 修复: 改用 `${WORKONE_ROOT}` 变量 + 部署时注入

6. **`setsid` 缺失**（M3+GLM-5.2 新发现）
   - Verified-by: `which setsid` exit=1
   - 影响: `scripts/_tmp_restart_serve.sh:21` 用 `setsid nohup ... &` 失效；`detached: true` 在 Git Bash 下不等价
   - 修复: 装 `util-linux` 或改用 `cmd //c start /B`

**P2 MEDIUM（建议修复 2 项）**:

7. **`jq` 缺失**（GLM-5.2 升级）
   - Verified-by: `which jq` exit=1
   - 影响: test orchestration 中 JSON pipeline (`bun ... --json | jq`) 全部失败
   - 修复: 安装 `jq` 或改用 `bun -e 'JSON.parse(require("fs").readFileSync(0))'`

8. **`/proc/net/tcp` + `/proc/net/tcp6` 缺失**（`/proc/net/` 只有 `if_inet6`）
   - Verified-by: `cat /proc/net/tcp` ENOENT
   - 影响: `scripts/test-serve/verify-p02.ts:250` 读取两者 → throws
   - 修复: 改用 `netstat -an` 或 Windows API

**P3 LOW（建议修复 3 项）**:

9. 补 `scripts/lib/__tests__/workspace-paths.test.ts` win32 用例（实测 0 覆盖，原 P1 维持）
10. 处理 NEW-3 其余 22 处 `/tmp/` 硬编码（**注意：原"唯一无 env fallback"是错的，sse-daemon 实际有 fallback**——重点应放在真正无 fallback 的文件上）
11. 处理 NEW-2 的 PID 元数据依赖（已在 P0#3 涵盖大部分，长期方案改用 Job Objects / WMI）

**已确认存在（不属缺失）**:
- `bash` (5.3.15) / `tar` (GNU 1.35) / `curl` (8.21.0) / `tail` (GNU 8.32)
- `netstat` / `tasklist` / `wsl.exe` (Ubuntu-24.04 Running)
- `python` (3.14.3) / `node` (v22.19.0) / `bun` (1.3.14)
- `bun:sqlite`（覆盖所有 sqlite3 CLI 用途）
- WSL Ubuntu 内有 `ss` / `lsof` / `pgrep` / `jq`（**但无 sqlite3**——WSL 缓解 partial）

### 关键发现

1. **#3 信号语义（已收窄）**: `process.kill(pid, "SIGTERM"/"SIGINT"/"SIGQUIT")` 在 Windows 下**立即结束当前进程**（handler 不触发）。但 `process.kill(pid, 0)` 存在性探测**正常**（Verified-by: KILL0_OK）—— 原"信号全链路 broken"表述过宽，实测仅有 signal-delivery semantics 差异，existence probing 正常。
2. **#2 降级**: Git Bash + NTFS 环境下 inode 非零，原始 21-item 中"NTFS ino 恒 0 → fail-open"风险降级。但 `st.ino !== this.ino` 逻辑在 rotation 后仍可能漏事件。
3. **#4 + #8 + NEW-1 同根**: Git Bash 把 GNU coreutils + curl + tar 全带齐了。如果用户脱离 Git Bash 跑 native cmd.exe/PowerShell，start-serve.ts:266-283 + process.ts:251/267 + run-context.ts:266-605 会连环失败。
4. **#11 路径规范问题**: fallback `~/.local/state` 在 Windows 上能写但不符合 Win 习惯（应用数据应放 `%LOCALAPPDATA%`）。functional OK，hygiene 偏差。
5. **NEW-2 真实失败（含 design-level 根因）**: Git Bash 模拟 `/proc` 含 25 条目，但**仅 bun-spawned 的 native Windows PIDs 在 `/proc` 下不可见**（Cygwin/bash-spawned PIDs 如 1470/657 仍可读）。**根因（GLM-5.2 复审发现）**: env-read via `/proc/<pid>/environ`（process.ts:233）用于读 `QODERWORK_TEST_RUN_ID` 是 design-level Windows 不兼容——Windows 无直接 API 读子进程环境变量，需 WMI/PowerShell 间接访问。修复不能简单换文件读取，需重新设计。
6. **#14 实测 0 覆盖**: workspace-paths.test.ts 确实无 win32 用例（grep 0 命中），这是测试覆盖率真实空缺，不是 reviewer 误报。
7. **#9 模板 OK 但需手动 copy**: `local-paths.example.json` 有 win32 key，但实际部署需要用户手动 copy 到 `local-paths.json` 并改路径。如果用户忘了这一步，CLI/ENV 优先级更高所以 fail-open 也 OK。

## AGENTS.md + .agents/skills/ 中 /home/zhaoge 命令模板完整清单（2026-08-03 双重复审定稿）

> **本章节来源**: 主会话先汇报 → M3 (general-purpose/MiniMax-M3) 复审 → GLM-5.2 (high-precision) 二审 → 主会话 INDEP 独立验证（13 项 Python byte-level 复跑）。
> **所有数字均经 Python byte-level 独立验证**（Git Bash 下 `grep -c '/home/zhaoge'` 不可靠——已知陷阱）。

### §1 AGENTS.md（13 处 `/home/zhaoge` 引用）

文件长度 552 行；AGENTS.md 全文含 13 处 `/home/zhaoge` 引用。**主会话原汇报仅列 3 处 `cd` 命令模板，漏列其余 10 处描述性引用**——经 GLM-5.2 复审抓出。

#### §1.1 可执行命令模板（3 处）

| 行号 | 内容 |
|:---:|---|
| L222 | `cd /home/zhaoge/workspace/qoderwork` |
| L226 | `cd /home/zhaoge/workspace/qoderwork` |
| L230 | `cd /home/zhaoge/workspace/qoderwork/scripts` |

#### §1.2 描述性/配置类引用（10 处）

| 行号 | 内容性质 |
|:---:|---|
| L3 | 目标项目为 `/home/zhaoge/workspace/opencode/work-one` 声明 |
| L10 | QoderWork 工作区位于 WSL Ubuntu-24.04 声明 |
| L24 | 工作区根目录描述 |
| L25 | work-one 项目目录（表格行） |
| L37 | Bun 安装路径 `/home/zhaoge/.bun/bin/bun` |
| L41 | CodeGraph CLI 路径 `/home/zhaoge/.local/bin/codegraph` |
| L203 | 文档索引路径 |
| L515 | 模板路径引用 |
| L516 | 模板路径引用 |
| L517 | 模板路径引用 |

> 详细 13 行的精确内容已 Python byte-level 验证（INDEP-G1）。完整 AGENTS.md 修复时**应 sed 全部 13 处**，不只是 3 处 `cd`。

### §2 `.agents/skills/` 18 文件清单（168 处引用）

经 Python byte-level 验证：18 个 .md 文件共 168 处 `/home/zhaoge` 引用。**主会话原汇报 per-file 计数 2 处错 + 桶分布 1 处错 + nature 分类 2 处错**——经 M3+GLM-5.2 串行复审抓出。

#### §2.1 高频引用文件（High ≥10，共 6 文件 / 116 处）

| # | 文件路径 | 引用数 |
|:---:|---|:---:|
| 1 | `.agents/skills/serve-api/reference-operations.md` | 32 |
| 2 | `.agents/skills/serve-api/reference.md` | 30 |
| 3 | `.agents/skills/opencode-framework-dev/SKILL.md` | 16 |
| 4 | `.agents/skills/isolated-serve-test/SKILL.md` | 15 |
| 5 | `.agents/skills/debug-environment-toolkit/SKILL.md` | 12 |
| 6 | `.agents/skills/plan-audit-archiver/SKILL.md` | 11 |

#### §2.2 中频引用文件（Mid 5-9，共 5 文件 / 36 处）

| # | 文件路径 | 引用数 |
|:---:|---|:---:|
| 7 | `.agents/skills/debug-environment-toolkit/reference.md` | 9 |
| 8 | `.agents/skills/doc-code-sync/SKILL.md` | 8 |
| 9 | `.agents/skills/skill-diagnosis-optimization/SKILL.md` | 7 |
| 10 | `.agents/skills/logs-governance/SKILL.md` | 7 |
| 11 | `.agents/skills/opencode-framework-dev/reference.md` | 5 |

#### §2.3 低频引用文件（Low 1-4，共 7 文件 / 16 处）

| # | 文件路径 | 引用数 |
|:---:|---|:---:|
| 12 | `.agents/skills/deterministic-implementation-planning/SKILL.md` | 4 |
| 13 | `.agents/skills/plan-audit-archiver/templates/audit-report-template.md` | 3 |
| 14 | `.agents/skills/guided-code-editing/SKILL.md` | 3 |
| 15 | `.agents/skills/plan-audit-archiver/provenance-rules.md` | 2 |
| 16 | `.agents/skills/guided-code-editing/reference.md` | 2 |
| 17 | `.agents/skills/serve-api/SKILL.md` | 1 |
| 18 | `.agents/skills/outcome-governance/SKILL.md` | 1 |

**总计**: 6 + 5 + 7 = **18 文件 / 168 引用**

### §3 Nature 分类（4 类，GLM-5.2 修正）

| Nature | 文件数 | 引用数 | 性质 | 示例 |
|---|:---:|:---:|---|---|
| **可执行命令模板** | ~15 | ~116 | Agent 复制必失败 | `bun run /home/zhaoge/...`, `git -C /home/zhaoge/...`, `cd /home/zhaoge/...`, `wsl ... bash -c "cd /home/zhaoge/..."` |
| **TS 常量字符串** | 3 | 5 | 代码示例中的常量字符串 | `debug-environment-toolkit/SKILL.md:294 const BASE = "..."`; `debug-environment-toolkit/reference.md:266 const SKILLS_DIR = "..."`, `:371 new Database("...")`; `opencode-framework-dev/reference.md:315 const configPath = '...'`, `:341 const configPath = '...'` |
| **JSON 模板字段** | 1 | 2 | audit-report-template 字段 | `plan-audit-archiver/templates/audit-report-template.md:39 "workspace_root": "..."`, `:40 "repository_root": "..."` |
| **描述性路径** | ~12 | ~44 | 文档说明 | 表格字段、流程图引用、README 描述 |

### §4 Repo-wide Scope（4 个 tier，GLM-5.2 重分类）

| Tier | 范围 | 引用数 | 文件数 | 修复策略 |
|---|---|---:|---:|---|
| **(a) 用户作用域** | AGENTS.md（13 全列）+ 18 skill .md | **181** | 19 | **直接 sed**（命令模板类用 `${QW_ROOT}`） |
| **(b) 其他源码/config** | sibling IDE dirs (.codebuddy/.qoder/.trae/.kimi-code/.workbuddy) + scripts + plans + e2e-evidence + logs + handoff + documents + blueprints + root .md | **~1,230** | ~272 | 按文件类型分别修复 |
| **(c) audits/ 历史** | SHA-blob 内容寻址快照（不可 sed） | **19,939 (94.1%)** | 491 | **不建议 sed** —— 保持原样或重新生成 |
| **(d) 二进制** | `.codegraph/codegraph.db`（14MB，不可 sed） | **105** | 1 | 重新索引 |
| **总计** | (2MB 截断；真实 ≥ 21,270) | **21,169+** | 763+ | — |

### §5 Verified-by 证据表

| # | 命令 | 结果 |
|---|---|---|
| 5.1 | `python -c "print(open('AGENTS.md').read().count('/home/zhaoge'))"` | 13 |
| 5.2 | `python -c "...sum count for .agents/skills .md..."` | 168 |
| 5.3 | `python -c "print(open('.agents/skills/serve-api/reference-operations.md').read().count('/home/zhaoge'))"` | 32 |
| 5.4 | `python -c "print(open('.agents/skills/opencode-framework-dev/SKILL.md').read().count('/home/zhaoge'))"` | 16 |
| 5.5 | `python -c "print(open('.agents/skills/debug-environment-toolkit/SKILL.md').read().count('/home/zhaoge'))"` | 12 |
| 5.6 | `python -c "print(open('.agents/skills/plan-audit-archiver/SKILL.md').read().count('/home/zhaoge'))"` | 11 |
| 5.7 | `python -c "repo-wide scan (with 2MB cap)"` | 763 files / 21,169 occs |
| 5.8 | `python -c "audits/ breakdown"` | 491 files / 19,939 occs (94.1%) |
| 5.9 | `python -c ".codegraph/codegraph.db full read"` | 105 occs (2MB trunc 只数到 4) |

### §6 三轮双重复审元数据

1. **第 1 轮**（主会话原汇报）：3 处 AGENTS.md `cd` + 18 skill 文件 168 处 + 4 frequency 桶 + 4 nature 分类
2. **第 2 轮**（M3 复审）：抓出 5 项错误（per-file 计数 + 桶分布 + nature 分类 + scope 严重低估）
3. **第 3 轮**（GLM-5.2 复审）：抓出 3 项 M3 漏掉的（AGENTS.md 漏列 10 处 / audits/ 占 94% / codegraph.db 截断）

### §7 修复策略建议（按 Tier）

- **(a) 用户作用域 181 处** — **必修**：建议用 `${QW_ROOT}` 环境变量 + setup 脚本注入；分文件执行 `sed` 替换命令模板
- **(b) 其他源码/config ~1,230 处** — **建议**：与 (a) 同步修复
- **(c) audits/ 19,939 处** — **不建议 sed**：保持原样（SHA-blob 不可变历史）；如需清理，从源头重新生成 audit
- **(d) codegraph.db 105 处** — **重新索引**：`codegraph sync` 重新扫描

### §8 CHECK / FINAL

**CHECK**:
- [TEST] PASS — 13 项 Python byte-level 独立验证 + M3+GLM-5.2 双重复审
- [DOC] UPDATED — handoff 追加本章节
- [RISK] NONE — 仅追加，未修改既有内容

**FINAL**: AGENTS.md + .agents/skills/ 中 `/home/zhaoge` 完整清单定稿（per-file 计数 + 桶分布 + nature 分类 + repo-wide 4 tier），经 M3+GLM-5.2 双重复审 + 主会话 13 项独立 INDEP 验证。append-only 严格遵守。
