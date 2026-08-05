# Blueprint: 跨平台通用化（Windows Git Bash + WSL Ubuntu）

**创建日期**: 2026-08-03
**更新日期**: 2026-08-03
**状态**: 草稿
**来源**: M3+GLM-5.2 双重复审
**关联蓝图**: blueprint-dynamic-path-resolution.md + blueprint-dynamic-path-resolution-outcome-v1.md
**关联 outcome**: PATH-DYNAMIC-RESOLUTION-OUTCOME-CONTRACT-V1 gen-1

---

## 一、问题背景与已验证边界

### 1.1 问题描述

当前 QoderWork 体系存在两大致命缺陷：

1. **Windows 兼容性缺失**：所有运行时代码和技能文档以 WSL Ubuntu 为唯一目标平台，在 Windows Git Bash（`MINGW64_NT`）下存在加载时崩溃、路径不可达、信号处理失效等问题。
2. **硬编码路径泛滥**：技能文档和运行时代码中存在大量 `/home/zhaoge/...` 绝对路径，使项目无法迁移到另一台机器或另一 WSL 用户。

用户明确要求：框架同时支持 **Windows Git Bash**（`MINGW64_NT` 如当前 shell）**+ WSL Ubuntu**，且技能（skills）中不包含任何硬编码路径。

### 1.2 已验证的当前状态

以下结论源自 496 行的 `handoff/native-windows-verification.md` 及后续双重复审，全部经 Python 字节级验证：

**Runtime 代码修复（6 TS 文件 / 10 logical imports：9 静态 ESM + 1 动态 await-import）**：
- `cleanup-regress.ts:1`, `diag-handover-path.ts:4`, `diag-schema.ts:1`, `regress-parent-child.ts:4,12`, `test-hybrid-enforcement.ts:60`（await import）, `_d3_live.ts:15,16` — 这些行包含 `/home/zhaoge` 的静态 import，在 Windows Git Bash 下加载即 MODULE_NOT_FOUND，无法用 try/catch 捕获。

**Repo 扫描总量**：
- `scripts/` 中 51 文件含 `/home/zhaoge`（33 .ts + 18 .sh；SH 18 文件有 `cd /home/... || exit 1`）
- 用户面向：AGENTS.md（13 处）+ 18 skill .md 文件（168 处）= 181 处，在 19 个文件中
- 其他源码/配置（IDE 目录 + scripts + plans + e2e-evidence + logs + handoff + documents + blueprints + root .md）：~1,230 处，约 272 个文件
- `audits/`：491 文件 / 19,939 处（94.1% 总量）— **冻结 SHA-blob 历史，不修改**
- `.codegraph/codegraph.db`（14MB）：105 处 — **重新索引，不 sed**

**已确认不阻塞的问题**：
- `tree-kill` 包：**不需要**（M3 + GLM-5.2 独立验证：SIGTERM/SIGKILL 到 bun 父进程在 Git Bash 下会终止整个后代树，包括孙进程）
- 信号处理（`start-serve.ts:443-444`, `sse-daemon.ts:275-276`, `port-reserver.ts:48-49`, `p02-sentinel.ts:209-210`）：Win32 下是死代码（处理函数不触发，退出码=143）；硬杀时跳过的清理功能上无关紧要（4/4 位置下次启动有防御性处理或 OS 内核回收）
- `process.ts:232-233`, `verify-p02.ts`, `p02-sentinel.ts:141` 的 `/proc/<pid>/environ`：Git Bash 下部分失败（Cygwin PID 可读；bun 生成的纯 Win32 PID 不可见 — 已在 handoff NEW-2 记录）
- `process.kill(pid, "SIGTERM")` 立即终止进程，不调用处理函数（handoff #3）
- `process.kill(pid, 0)` 存在探测可工作（KILL0_OK）

**已有合约（不发明 QW_ROOT）**：
- `WORK_ONE_ROOT` 已在 10 个文件中存在；`scripts/lib/workspace-paths.ts` 实现了 4 级优先级（CLI > ENV > `scripts/local-paths.json` > 弃用默认值）；`validateWorkOneRoot` 是 fail-closed
- `QODERWORK_ROOT` 已在 `blueprints/blueprint-dynamic-path-resolution.md` 第 2.2.1 节第 82 行中定义（基于模块位置的解析）

### 1.3 非目标

- 不修改 `audits/`、`e2e-evidence/`、`logs/` 或任何已冻结的历史证据中的路径
- 不支持原生 cmd.exe（仅 Git Bash + WSL Ubuntu，均为 bash 派生）
- 不发明新的环境变量（`QW_ROOT` 不被引入）
- 不引入 `tree-kill` 包
- outcome-contract 不需 gen-2 修订（handoff L294 的语义澄清注（用户对 Git Bash 的重分类）已足够覆盖）

---

## 二、方案设计

### 2.1 五层架构

方案分 5 层，按依赖顺序实施：

#### A 层：架构对齐（anchor 合约）

复用既有 `WORK_ONE_ROOT` + `QODERWORK_ROOT` 作为根锚点。**明确禁止引入 `QW_ROOT`**。现有 `scripts/lib/workspace-paths.ts` 的 4 级优先级契约不变；新增加的跨平台入口只消费这两个锚点，不创建新锚点。

#### B 层：Runtime 修复（6 TS 文件 / 10 logical imports：9 静态 ESM + 1 动态 await-import）

6 个 TypeScript 文件中 10 logical imports（9 静态 ESM + 1 动态 await-import），在 Git Bash 下加载即 MODULE_NOT_FOUND。修复方式：将 import 路径替换为 `${WORK_ONE_ROOT}` / `${QODERWORK_ROOT}` 驱动的动态解析（通过 `pathToFileURL(resolvedPath).href`），保留原有业务逻辑不变。

#### C 层：Skill 通用化（3 桶分类法）

总共 18 个 skill .md 文件 / 168 处 `/home/zhaoge` 匹配（Python 字节级验证）。按 3 个桶处理：

- **桶 1（命令模板，约 87 处）**：替换为 `${WORK_ONE_ROOT}` / `${QODERWORK_ROOT}` 占位符
- **桶 2（10 处 `wsl -d` 与 `/home/zhaoge` 同线共现，分布在 6 个文件中；主要：`debug-environment-toolkit/reference.md`=3, `debug-environment-toolkit/SKILL.md`=2, `doc-code-sync/SKILL.md`=2）**：参数化为 `${QW_WSL_DISTRO:-Ubuntu-24.04}` shell 变量
- **桶 3（71 处散文 + TS 常量 + JSON）**：重写为通用表述（"你的 QoderWork workspace 根目录"）

**必修 N2 修复**：1 个 skill 描述（`clean-sessions/SKILL.md:77` "Windows 侧直连 UNC 路径常失败，走 WSL"）声称"WSL-only / Linux only / 走 WSL"，在 Git Bash 语义澄清后直接误导用户，必须修正为"Windows Git Bash + WSL Ubuntu 均支持"。

**必修 N3 修复**：`debug-environment-toolkit/SKILL.md` 包含 12 处硬编码 `/home/zhaoge` 路径（Python 字节级验证）— 不在 `scripts/` 或 `audits/` 中，因此被先前轮次遗漏。必须替换为通用占位符。

#### D 层：跨平台入口（可选）

当前没有入口脚本（已验证：0 个 `.cmd` 文件，无 `qoderwork.ts`/`.cmd`/`.sh`）。`.sh` 可以同时服务 Git Bash 和 WSL Ubuntu（均为 bash 派生）。决策：可选择添加 `scripts/qoderwork.ts` + `qoderwork.sh`，不是强制项。

#### E 层：CI 与文档

- 更新 AGENTS.md（13 处 `/home/zhaoge`：3 处 `cd` 命令在 L222/L226/L230 + 10 处描述性在 L3/L10/L24/L25/L37/L41/L203/L515/L516/L517）
- CI 矩阵增加 `os: [windows-latest, ubuntu-latest]`（仅验证 Git Bash + WSL Ubuntu）
- 文档中明确"跨平台兼容性：Windows Git Bash + WSL Ubuntu"

---

## 三、实施清单

### Phase 1：Runtime 修复（B 层）

| # | 文件 | 行 | 操作 |
|---|------|----|------|
| 1 | `cleanup-regress.ts` | 1 | 将静态 import 替换为基于 `WORK_ONE_ROOT` 的动态 import（`pathToFileURL`） |
| 2 | `diag-handover-path.ts` | 4 | 同上 |
| 3 | `diag-schema.ts` | 1 | 同上 |
| 4 | `regress-parent-child.ts` | 4, 12 | 同上 |
| 5 | `test-hybrid-enforcement.ts` | 60 | 同上（await import） |
| 6 | `_d3_live.ts` | 15, 16 | 同上 |

验收标准：`bun test` 在 Git Bash 下通过，无 MODULE_NOT_FOUND 错误。

### Phase 2：Skill 通用化（C 层）

按 3 桶分类法处理 18 个 skill .md 文件 / 168 处匹配：

| 桶 | 文件数 | 匹配数 | 替换策略 |
|----|--------|--------|----------|
| 桶 1（命令模板） | ~15 | ~87 | `${WORK_ONE_ROOT}` / `${QODERWORK_ROOT}` |
| 桶 2（wsl 包装） | 6 | 10 | `${QW_WSL_DISTRO:-Ubuntu-24.04}` |
| 桶 3（散文/常量/JSON） | ~18 | 71 | 通用重写 |

**必修 N2**：修正 1 skill（`clean-sessions/SKILL.md:77`）中的 "WSL-only" 表述
**必修 N3**：修复 `debug-environment-toolkit/SKILL.md` 中 12 处硬编码路径

验收标准：grep -r '/home/zhaoge' `.agents/skills/` | wc -l = 0。

### Phase 3：跨平台入口（D 层，可选）

- 评估是否创建 `scripts/qoderwork.sh`（可选）
- `.sh` 同时兼容 Git Bash 和 WSL Ubuntu

### Phase 4：CI 与文档更新（E 层）

- 更新 AGENTS.md（13 处）
- CI 矩阵增加 `os: [windows-latest, ubuntu-latest]`
- 更新 `blueprints/INDEX.md` 登记本蓝图
- 创建 `logs/2026-08-03-blueprint-cross-platform-universality.md` — 注：若 §1.3 "不修改 logs/" 仍然有效，则本行不生效；plan 端已通过 BLOCKED-BY-DECISION 跳过此步

---

## 四、验证计划

### XP-T-001：Git Bash runtime smoke
- 环境：`MINGW64_NT`（Windows Git Bash）
- 步骤：`bun test` 在 Git Bash 下运行，检查 6 个修复的 TS 文件无 MODULE_NOT_FOUND
- 预期：0 个加载时崩溃

### XP-T-002：WSL Ubuntu runtime smoke
- 环境：WSL Ubuntu-24.04
- 步骤：`bun test` 运行，验证回归
- 预期：与修复前行为一致

### XP-T-003：Skill 路径零硬编码
- 环境：任意
- 步骤：`python -c "..."` 字节级扫描 `.agents/skills/` 含 `/home/zhaoge` 的 .md 文件
- 预期：0（注意：Git Bash 下 `grep -r '/home/zhaoge'` 因编码返回 0 不可靠，必须用 Python 字节级）

### XP-T-004：Script 路径零硬编码
- 环境：任意
- 步骤：Python 字节级扫描 `scripts/` 下 .ts/.sh 中 `/home/zhaoge`（含 6 个 runtime 修复 + N3 新增 `debug-environment-toolkit/SKILL.md` 12 处）
- 预期：0

> **命名空间说明**：本蓝图测试 ID 加 `XP-` 前缀以区分 outcome-contract `PATH-DYNAMIC-RESOLUTION-OUTCOME-CONTRACT-V1` 中已存在的 T-001..T-004（其测试 workspace-paths / start-serve-paths / isolated-serve-paths / bootstrap-import-source）。

### CI 矩阵验证
- 新增 `os: [windows-latest, ubuntu-latest]` CI 矩阵
- Git Bash 下 `bun run typecheck` 通过
- WSL Ubuntu 下 `bun run typecheck` 通过

### 负例矩阵

| 场景 | 预期 |
|------|------|
| Git Bash 中 `WORK_ONE_ROOT` 未设置 | fail-closed 报错，不猜测路径 |
| Git Bash 中 `/proc/<pid>/environ` 不可读 | 降级日志警告，不阻断运行 |
| WSL Ubuntu 中 `wsl -d` 发行版名不同 | `${QW_WSL_DISTRO:-Ubuntu-24.04}` 可覆盖 |
| `tree-kill` 未安装 | 不需要（SIGTERM bun 父进程已杀整个树） |
| 信号处理在 Win32 下 | 死代码，退出码 143，不影响功能 |

---

## 五、风险、回滚与成功标准

### 5.1 风险与缓解

| 风险 | 缓解 |
|------|------|
| 6 个 TS import 修复引入新回归 | 逐文件提交 + `bun test` 回归套件 |
| Skill 通用化遗漏某些 `/home/zhaoge` 实例 | 字节级验证 grep 确保 168 处全覆盖 |
| WSL 发行版名称差异导致 wsl 调用失败 | `${QW_WSL_DISTRO:-Ubuntu-24.04}` 变量化 |
| CI 矩阵增加 Windows 导致构建时间延长 | 拆分 CI 阶段，并行运行 |

### 5.2 回滚方案

- **Phase 1（Runtime 修复）**：逐文件回退单个 import 变更；保留原文件副本
- **Phase 2（Skill 通用化）**：按文件回退 git checkout；不涉及运行代码
- **Phase 3（入口脚本）**：删除新建的 `.sh` 文件
- **Phase 4（CI/文档）**：回退 AGENTS.md 和 CI 配置变更

### 5.3 成功标准

- [ ] Git Bash 下 `bun test` 全部通过，6 个修复 TS 文件无 MODULE_NOT_FOUND
- [ ] WSL Ubuntu 下 `bun test` 全部通过，无回归
- [ ] `.agents/skills/` 中零个 `/home/zhaoge`
- [ ] `scripts/` 中（含 `.ts` 和 `.sh`）零个 `/home/zhaoge`
- [ ] CI 矩阵包含 `windows-latest` 和 `ubuntu-latest`
- [ ] 跨平台入口脚本（如创建）在 Git Bash 和 WSL Ubuntu 均可运行

### 5.4 Outcome-contract 决策

**outcome-contract 不需 gen-2 amendment**：`PATH-DYNAMIC-RESOLUTION-OUTCOME-CONTRACT-V1`（generation=1）已交付。其 `out_of_scope[5]: "Windows/其他 OS 实机行为"` 在用户语义澄清后存在歧义，但 handoff L294 的语义澄清注（用户对 Git Bash 的重分类）已足够覆盖。不需要新建 gen-2 合同。

---

## 六、审计记录与参考

### 6.1 双重复审轮次

| 轮次 | 模型 | 日期 | 结论 |
|------|------|------|------|
| 第 1 轮 | M3 | 2026-08-02 | 初次分析，统计数字基本正确 |
| 第 2 轮（双重复审） | GLM-5.2 | 2026-08-02 | 发现 N2（WSL-only 表述）+ N3（debug-environment-toolkit 12 处遗漏）；修正统计 |
| 第 3 轮（用户语义澄清） | - | 2026-08-03 | 明确 Windows Git Bash + WSL Ubuntu 双兼容 |
| 第 4 轮（v3 定稿） | M3+GLM-5.2 | 2026-08-03 | v3 方案通过双重复审，所有数字经 Python 字节级验证 |

### 6.2 数字差异溯源

- **总 `/home/zhaoge` 匹配数**：`audits/` 占 94.1%（19,939/21,182），`audits/` 冻结不修改
- **Skill 文件 168 处**：Python 字节级 `rg -c` 逐文件加和，与桶分类合计一致
- **6 TS 文件 10 logical imports（9 静态 ESM + 1 动态 await-import）**：逐行 Python 字节级验证，非保守估计
- **54 处 `wsl -d Ubuntu-24.04`**：7 个文件中，Python 字节级验证

### 6.3 参考文档

- `handoff/native-windows-verification.md`（496 行，Windows 实机验证报告）
- `blueprints/blueprint-dynamic-path-resolution.md`（路径解析契约原蓝图）
- `blueprints/blueprint-dynamic-path-resolution-outcome-v1.md`（outcome v1 合同）
- `scripts/lib/workspace-paths.ts`（`WORK_ONE_ROOT` + `QODERWORK_ROOT` 解析器）
- `outcome-governance/v1` 治理框架
