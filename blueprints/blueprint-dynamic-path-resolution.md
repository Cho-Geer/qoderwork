# Blueprint: 路径动态化与跨平台配置收敛

**版本**: v1.1.0
**日期**: 2026-07-25
**状态**: 待审批（设计已审计，尚未实施）
**优先级**: P1

---

## 一、问题背景与已验证边界

### 1.1 问题描述

QoderWork 当前存在大量 `/home/zhaoge/...` 绝对路径。它们出现在可执行脚本、测试、IDE 配置、Agent 指引、文档和历史证据中。把运行时路径固定为单一 WSL 用户目录，会使迁移到另一台机器、另一个 WSL 用户、Windows 原生 IDE 或不同 worktree 时失败或产生错误的工作目录。

问题本身属实；但“所有匹配都应迁移”不成立。必须先区分活跃运行路径、测试夹具、用户本地配置、说明性文本与不可变历史证据。

### 1.2 2026-07-25 现状快照

以下统计在本 worktree 执行，排除本蓝图自身和 `.git/`，因此是一次可复现快照而非永久常数：

```bash
rg --hidden -n -F '/home/zhaoge/' \
  -g '!blueprints/blueprint-dynamic-path-resolution.md' -g '!.git/**' | wc -l
rg --hidden -l -F '/home/zhaoge/' \
  -g '!blueprints/blueprint-dynamic-path-resolution.md' -g '!.git/**' | wc -l
```

| 类别 | 文件数 | 匹配数 | 审计结论 |
|---|---:|---:|---|
| 运行时配置 | 3 | 10 | 是迁移候选；当前均为 Git 已跟踪文件。 |
| `scripts/` 中 `.ts` / `.js` / `.sh` | 52 | 80 | 是迁移候选，但须逐文件分类，不能按目录批量替换。 |
| `AGENTS.md`、`RULES.md`、`.agents/skills/` | 18 | 163 | 是说明性候选；只有活动指引可改，示例和历史引用须保留语义。 |
| `documents/`、`plans/`、`blueprints/`、`e2e/` | 69 | 245 | 仅在仍被执行的内容中处理。 |
| `audits/`、`e2e-evidence/`、`logs/` | 291 | 1,212 | 历史/provenance 证据，永久排除。 |
| 其余 | 21 | 48 | 逐项判定。 |
| **合计** | **451** | **1,758** | 取代旧版“998 处、250+ 文件”的失实统计。 |

已确认的活跃热点包括：

- `scripts/test-serve/run-context.ts#getDefaultPrimaryWorktree()` 固定返回 work-one 绝对路径；被 `isolated-serve.ts` 和 `_b_pt_wm_00r2_live.ts` 调用。
- `scripts/test-serve/process.ts` 固定 `SSE_DAEMON_PATH`；这条路径必须保持与 test-serve 自身所在 QoderWork worktree 一致，不能从被隔离的 work-one worktree 推导。
- 多个诊断、E2E 和测试脚本使用静态绝对 import；旧版只列 3 个文件，实际扫描还发现 `diag-handover-path.ts`、`test-hybrid-enforcement.ts`、`_d3_live.ts` 等候选，必须先建清单。
- `.codebuddy/settings.local.json`、`.kimi-code/mcp.json`、`.qoder/settings.local.json` 都是已跟踪配置；仅把路径加入 `.gitignore` 不会停止 Git 跟踪。

### 1.3 根因分析

**直接原因**：运行时根目录、工具可执行文件、MCP `cwd` 和脚本 import 路径各自写死，缺少带优先级、校验和平台语义的解析契约。
**根本原因**：把“当前机器上的路径示例”当成跨平台配置协议；且没有把 IDE 的配置能力逐客户端验证。
**已验证事实**：Bun 1.3.14 在临时 cwd 自动加载 `.env`；`await import(join(...))` 可在当前 Linux/Bun 载入 TypeScript 模块；`bootstrap-import-source.test.ts` 2/2 通过。它们只证明当前 Bun 组件行为，不能证明 Windows、shell、Agent 文本或任意 IDE 的变量展开能力。

### 1.4 非目标

- 不修改 `audits/`、`e2e-evidence/`、`logs/` 或已冻结证据中的历史路径。
- 不在本蓝图实施阶段修改 work-one 业务代码、启动裸 `opencode serve`，或宣称 runtime/live-LLM-E2E 已通过。
- 不把 `$WORK_ONE_ROOT` 写进自然语言后假设 Agent、IDE 或 shell 会自动展开。
- 不以未验证的 IDE 占位符语法作为共享配置格式。

---

## 二、方案设计

### 2.1 方案对比

| 方案 | 核心思路 | 优点 | 致命缺陷 |
|---|---|---|---|
| A. 根目录 `.env` + 全量文本替换 | 以环境变量替代所有绝对路径 | 上手快 | 与既有 `scripts/.env` 的机密配置职责冲突；cwd 依赖；shell/IDE/Agent 不共享自动加载语义；无法处理已跟踪 MCP 文件。 |
| B. 解析契约 + 机器本地路径清单 + 客户端适配器 | 代码从受校验解析器取值；每种 IDE 由适配器生成或管理本地配置 | 可测试、可回滚、能分别处理 Windows 与 WSL | 首期需要冻结清单和每客户端验收。 |
| C. 保留绝对路径 | 仅修复眼前失败点 | 改动最少 | 不解决移植性，新的硬编码会继续累积。 |

**选择结论**：选 B。A 只可作为 Bun 的兼容输入渠道，不能成为跨平台单一真相源；C 不满足目标。

### 2.2 路径解析契约

新增 `scripts/lib/workspace-paths.ts`，并以测试先行固定以下契约：

1. `QODERWORK_ROOT` 由模块位置向上解析并验证 Git 根目录；不得从 `$HOME/workspace/qoderwork` 猜测，因此 worktree 可正确工作。
2. `WORK_ONE_ROOT` 的优先级固定为：显式 CLI 参数 > 显式进程环境 `WORK_ONE_ROOT` > 已校验的机器本地路径清单 > 受弃用警告保护的旧默认值。新环境缺少配置时 fail-closed，不静默猜测 Windows/WSL 路径。
3. `BUN_BIN` 与 `CODEGRAPH_BIN` 是可选覆盖项；使用前必须校验为可执行文件或可解析命令，不把 `process.execPath` 误当成任意运行时均可用的 Bun。
4. 派生路径（framework DB、日志、SSE daemon）必须用 `node:path` 从已解析根目录计算。动态 import 使用 `pathToFileURL(resolvedPath).href`，避免把平台路径当作模块 specifier。
5. 本地配置采用受版本控制的示例与被忽略的 JSON 数据文件，例如 `scripts/local-paths.example.json` 与 `scripts/local-paths.json`；JSON schema 只允许预定义键和绝对目录。不得让 shell 直接 `source` 一份可执行的通用 `.env`。
6. 现有 `scripts/.env` 是 `start-serve.ts` 的机密/运行配置，保持独立。若兼容 Bun `.env`，必须明确 loader、覆盖顺序和是否允许自动加载，不能混入路径清单。

建议的数据形态（路径值由每个运行 OS 填写；Windows host 调 WSL 时应生成 WSL launcher，而不是混用两种路径）：

```json
{
  "schemaVersion": 1,
  "platforms": {
    "linux": { "workOneRoot": "/path/to/work-one" },
    "win32": { "workOneRoot": "C:\\path\\to\\work-one" }
  },
  "tools": { "bunBin": "", "codegraphBin": "" }
}
```

### 2.3 MCP 与 IDE 适配原则

客户端适配器的输出只能写入已确认的本地目标；先处理“已跟踪文件如何迁移为模板/本地文件”的 Git 变更，再添加 ignore 规则。禁止用 `.gitignore` 假装已使已跟踪文件变成本地文件。

| 客户端 | 当前证据 | 本蓝图要求 |
|---|---|---|
| Qoder CLI | 本机 `qodercli mcp add --help` 支持 `-e KEY=value`、`user/local/project` scope，项目选择记录提及 `.mcp.json`。 | 用 CLI 或已验证 JSON schema 管理；不得假设 `{env:VAR}` 或 `.opencode/.env` 语法。以 `mcp get/list` 验收最终配置。 |
| Kimi Code | 官方文档确认项目 `.kimi-code/mcp.json`，并支持 `command`、`args`、`env`、`cwd`；未在审计中证实字符串插值。 | 适配器生成静态、已校验的 `command/cwd/env`；以 `kimi doctor` 与真实 stdio server 启动验收。 |
| ZCode | 官方文档确认工作区 `.zcode/config.json` 或 `.agents/mcp.json`，且可为 MCP 设置环境变量；`.zcode` 优先于 `.agents`。 | 不再写“无变量支持”；先选一个单一作用域并验证优先级，再生成配置。 |
| CodeBuddy | 本机 CLI 支持 `--mcp-config`；`${VAR}` 展开尚未验证。 | 将变量展开列为阻塞验收项；未通过时用适配器输出静态本地配置。 |
| Trae | 本机 WSL shim 明确要求改由 Windows 安装运行。 | 必须在 Windows host 实机验证配置位置、`${workspaceFolder}` 与启动行为；未完成前不得在共享方案中声明支持。 |

### 2.4 子系统合规审计

| 子系统 | 状态 | 设计约束 |
|---|---|---|
| MVC Architecture | ✅ | 解析、CLI 适配和调用点分层，调用点不自行读取配置。 |
| DB-only & DB-canonical | N/A | 无 schema 或持久化业务状态变更。 |
| Permission Matrix | ⚠️ | IDE 配置会启动本地 MCP；迁移前后必须复核允许目录与 command/cwd。 |
| Concurrency Safe | ⚠️ | 生成本地配置须原子写入，禁止两个生成进程覆盖同一文件。 |
| Hardened Enforcement | ✅ | 不放宽 H2、DRY_RUN、isolated-serve 或 CodeGraph gate。 |
| Framework Harness | ⚠️ | `test-serve` 的 primary worktree、SSE daemon 来源和 manifest 环境须有回归覆盖。 |
| Central State Management | ✅ | 路径值只来自一个解析模块，不写入 framework DB。 |
| Multi-Agent | ⚠️ | worktree 根由模块位置/显式参数确定，禁止 Agent 从说明文本猜路径。 |
| Log Central Management | ✅ | 不改历史日志；失败记录仍走现有日志路径。 |
| DB-canonical Management | N/A | 无 DB 迁移。 |
| Templatization & Parameterization | ✅ | 示例、schema、适配器和每客户端验收矩阵可复用。 |
| TypeScript + Bun Runtime | ⚠️ | 仅使用 `node:` 内置模块，`bun run typecheck` 和 Linux/Windows 兼容测试必须通过。 |

---

## 三、实施清单

### Phase 0：冻结清单与迁移边界（阻塞后续）

1. 用本节 1.2 的命令生成带 `path`、`match kind`、`owner`、`active/historical`、`migration disposition` 的清单。
2. 将每个匹配标为 `MIGRATE`、`TEST_FIXTURE`、`LOCAL_CONFIG`、`DOC_EXAMPLE` 或 `PRESERVE_HISTORY`；未经分类的文件不得替换。
3. 对所有已跟踪的本地配置完成模板迁移方案和 `git ls-files` 验收，再修改 `.gitignore`。
4. 对每一个共享函数先运行 CodeGraph caller/impact；若索引不属于当前 worktree，记录限制并以当前 worktree 的受限 `rg` 搜索补证。

### Phase 1：解析器与安全配置

| 文件 | 操作 | 完成条件 |
|---|---|---|
| `scripts/lib/workspace-paths.ts` | 新建 | 实现 2.2 的优先级、schema、路径与可执行性验证。 |
| `scripts/lib/__tests__/workspace-paths.test.ts` | 新建 | 覆盖 Linux/Windows 样例、缺值、相对路径、坏 JSON、非法工具路径和 precedence。 |
| `scripts/local-paths.example.json` | 新建 | 仅含占位符和 schema 说明。 |
| `scripts/local-paths.json` | 新建（本地） | 不提交；仅由 schema 解析，不含 secret。 |
| `.gitignore` | 修改 | 只在完成 tracked→template 迁移后忽略本地文件。 |
| `scripts/start-serve.ts` | 修改（如需要） | 明确其 `scripts/.env` 与路径清单的职责、加载顺序和错误信息。 |

### Phase 2：test-serve 与活动脚本

1. 先迁移 `getDefaultPrimaryWorktree()`；保留 `--from` 和 `--primary-worktree` 的最高优先级。
2. 再将 `SSE_DAEMON_PATH` 改为从 test-serve 模块位置推导的 QoderWork 资产路径，禁止从隔离 worktree 读取。
3. 只迁移 Phase 0 标记为 `MIGRATE` 的脚本；静态 import、运行时 DB 路径、CLI 提示字符串和测试夹具分别处理。
4. 每个动态 import 改动必须有同一文件的临时 worktree fixture；不得只测试主 worktree 成功。

### Phase 3：客户端配置与指引

1. 以每个 IDE 的“配置位置、schema、变量语义、启动命令、验证命令”建立适配器表。
2. 先生成临时文件并做 JSON parse、路径存在性、command 可执行性和覆盖保护；成功后再原子替换本地目标。
3. 在 AGENTS/Skills 中只记录“如何调用路径解析器”的确定命令，不以 `$VAR` 文本替代可执行解析。
4. Windows/WSL 配置分别生成；Windows host 到 WSL 的配置必须明确 launcher、distro 与 WSL 内 `cwd`。

### Phase 4：文档与收口

1. 更新仍活动的文档、Skill 和测试规格；历史证据不动。
2. 重新运行全量扫描，将结果与 Phase 0 清单比对；剩余绝对路径须全部有 `PRESERVE_HISTORY`、`DOC_EXAMPLE` 或明确豁免理由。
3. 记录每客户端实际验证版本、OS、配置路径和日志；不能验证的客户端保持 `BLOCKED`，不降低标准。

---

## 四、验证计划

### 4.1 单元与组件

- [ ] `workspace-paths`：环境、CLI、配置、旧默认值的优先级和缺失值 fail-closed。
- [ ] 相对路径、符号链接逃逸、Windows 盘符、无效 JSON、非可执行 Bun/CodeGraph 路径被拒绝。
- [ ] `bun test scripts/test-serve/__tests__/run-context.test.ts scripts/test-serve/__tests__/process.test.ts scripts/test-serve/__tests__/bootstrap-import-source.test.ts`。
- [ ] 受影响的每个静态 import 脚本都在临时路径 fixture 中执行；不得访问主 work-one。
- [ ] `bun run typecheck`。

### 4.2 集成与配置生成

- [ ] 在临时 Git repo 创建 worktree，确认 `--primary-worktree` 覆盖配置值，且 manifest 仍保存正确根目录。
- [ ] 在 WSL 和 Windows 各执行一次路径解析器；同一逻辑输入得到该 OS 可访问的绝对路径。
- [ ] 每个生成器测试：缺少本地配置、目标已存在、JSON 无效、路径不存在、原子替换失败；失败时目标文件内容不变。
- [ ] `qodercli mcp get/list`、`kimi doctor`、ZCode 实机设置页、CodeBuddy MCP 加载和 Trae Windows host 各自验证成功，记录输出。 |

### 4.3 Runtime smoke 与 live-LLM-E2E

- [ ] 仅在现有 `test-serve` 生命周期中运行一次 plan-mode runtime smoke；保留 manifest、双 DB、SSE、PID、cleanup artifact。
- [ ] 该 smoke 只验证路径解析和启动，不等同 live-LLM-E2E。
- [ ] 如需 live 模式，必须由 reviewer 独立提供 `H2_AUTHORIZED=true` 和 `DRY_RUN=false`；本蓝图不授权设置或转发这两个变量。

### 4.4 负例矩阵

| 场景 | 预期 |
|---|---|
| 未配置 `WORK_ONE_ROOT` 且不存在兼容默认值 | 明确报错，不猜测 `$HOME`。 |
| `WORK_ONE_ROOT` 是相对路径、非 Git 根或不存在 | 拒绝，且不启动子进程。 |
| `BUN_BIN` / `CODEGRAPH_BIN` 不可执行 | 拒绝并指出键名。 |
| IDE 不支持待用插值语法 | 适配器拒绝生成共享配置，改走该客户端的已验证静态本地配置。 |
| 生成中断或写入校验失败 | 保留旧配置，不留下半写文件。 |
| 路径扫描命中历史证据 | 记录 `PRESERVE_HISTORY`，不修改证据。 |
| test-serve 隔离 worktree 与 QoderWork 源根不同 | SSE daemon 仍从调用它的 QoderWork 模块位置解析。 |

---

## 五、风险、回滚与成功标准

### 5.1 风险与缓解

| 风险 | 缓解 |
|---|---|
| 隐式 `.env` 自动加载污染子进程环境 | 使用显式路径清单；记录 loader 顺序；对 CI 用 `--no-env-file` 负例。 |
| 本地配置仍被 Git 跟踪 | 先验证 tracked→template 迁移，再加 ignore；检查 `git ls-files`。 |
| IDE 语法随版本变化 | 不共享未经实测的插值；以版本化适配器和每客户端 smoke gate 收口。 |
| 动态 import 破坏 TypeScript 或隔离来源 | 用 `pathToFileURL`、fixture 和组件测试；失败时保留原导入并停止该批次。 |
| 机械替换污染历史证据 | Phase 0 清单 + allowlist；历史目录硬禁止。 |

### 5.2 回滚方案

- Phase 1：移除新解析器调用，恢复单个已验证调用点；本地 JSON 不进入版本控制。
- Phase 2：按提交回滚一个 consumer；保留原 test-serve artifact，不能只回滚生产路径不回滚测试。
- Phase 3：恢复该客户端的已验证旧配置或模板；生成器失败时不覆盖目标。
- Phase 4：文档只回滚本次活动文档改动，历史 evidence 永不重写。

### 5.3 成功标准

- [ ] Phase 0 清单覆盖扫描得到的每一个匹配，且历史目录均为 `PRESERVE_HISTORY`。
- [ ] 所有运行时 consumer 使用受测试的解析器或有批准豁免，没有新的用户绝对路径。
- [ ] test-serve 组件、集成和 plan-mode runtime smoke 各自具备独立证据；不混写层级。
- [ ] 每个承诺支持的 IDE 都有对应 OS/版本/启动证据；无法验证的 IDE 不列为支持。
- [ ] Git 中不再跟踪机器本地 MCP/path 配置；共享模板不含机器绝对路径或 secret。
- [ ] 回滚步骤在至少一个 consumer 和一个配置适配器上演练通过。

---

## 六、审计记录与参考

### 6.1 本次依据

- 当前 worktree 的 `rg` 路径扫描、`git ls-files`、`git check-ignore`、CodeGraph 与源码读取。
- Bun 1.3.14 临时 `.env` 自动加载及绝对动态 import 实测；`bootstrap-import-source.test.ts` 组件测试 2/2 PASS。
- 本机 `qodercli mcp --help`、`qodercli mcp add --help`、`qodercli mcp add-json --help`、Kimi/CodeBuddy CLI help；Trae WSL shim 的 Windows-host 限制。
- [Bun 环境变量文档](https://bun.sh/docs/runtime/environment-variables)、[Kimi MCP 文档](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/mcp.html)、[Qoder MCP 文档](https://docs.qoder.com/en/cli/mcp-servers)、[ZCode MCP 文档](https://zcode.z.ai/en/docs/mcp-services)。
- 2026-07-26 复核：同一全量扫描得到 467 个文件、1,805 处匹配；分类表仍由 Phase 0 清单重建，不能只替换合计。`workspace-paths.ts` 及其 Phase 2 测试仍不存在，`getDefaultPrimaryWorktree()` 与 `SSE_DAEMON_PATH` 仍为固定路径；`bootstrap-import-source.test.ts` 重新运行 2/2 PASS。CodeGraph 当前索引属于本 worktree 且为最新：`getDefaultPrimaryWorktree()` 的函数调用方为 `isolated-serve.ts` 与 `_b_pt_wm_00r2_live.ts`，`SSE_DAEMON_PATH` 仅由 `startRunProcesses()` 使用；PHASE-02 admission 因 PHASE-01 `NOT_STARTED` 被拒绝。

### 6.2 证据等级

- 2026-07-25 的“当前路径分布”和“代码热点”是历史静态 source/CodeGraph 证据；2026-07-26 复核以当前 worktree 的 source/Git/Bun/CodeGraph 证据补强，调用图结论仅覆盖已查询的两个路径热点。
- Bun `.env` 与动态 import 是当前 Linux/Bun 的组件级运行证据。
- IDE 支持状态除上述本机 CLI/官方文档外，仍须逐客户端 runtime 验收；未执行的项不得标为完成。
