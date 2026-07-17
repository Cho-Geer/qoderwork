# work-one tool-governance MVC Refactor — 未实施部分清单 + 手动修改指引

**复核方法**: 不信任蓝图 checkbox（弱模型禁止勾选），而是交叉比对蓝图 §5.1-5.5 / §7 的 `[ ]` 项与 work-one 工作树真实状态（git status 46 文件 + 源码阅读）。
**复核日**: 2026-07-13
**工作树基线**: WSL `/home/zhaoge/workspace/opencode/work-one/`（46 文件已改，Phase 0-7 + 8/9 主体）

---

## 一、结论速览（按"能否手动改代码"分四类）

| 类别 | 含义 | 是否需你手动改 |
|---|---|---|
| **A. 开放代码任务** | 文件从未改过、蓝图标 `[ ]`、确为代码缺口 | ✅ 是（本文重点） |
| **B. Live E2E 运行** | 需起 serve + 真实 LLM 跑（reviewer 执行，规则 #5/#6） | ❌ 否（给命令） |
| **C. Reviewer 审计** | 纯检查/巡检，无代码改动 | ❌ 否（列清单） |
| **D. 代码已完成** | 工作树已落地，checkbox 仍 `[ ]` 仅因弱模型不得勾选 | ❌ 否（待 reviewer 勾） |

---

## 二、A 类 — 开放代码任务（你手动改，附文件 + 函数 + 切入点）

### A1. §7 line 1449 — `scope-validate.ts` 拆分（单一职责）

**文件**: `.opencode/service/gate/scope-validate.ts`
**入口函数**: `validateWriteScope(input, output): { blocked, message? }`（行 34，约 200 行单体函数）
**现状**: 一个函数内聚 8 类无关职责（文件头注释 1-5 行已自述）。
**拆分 seam（按现有注释行定位）**:

| 职责 | 行号 | 建议抽出的模块 |
|---|---|---|
| modify-tool 闸门 | 43-50 | `scope-modify-gate.ts`（`isModifyTool` + `getModifyPath`） |
| 多路径 scope + 不可解析 shell | 61-102（read_only@71 / trusted@84 / unparseable-block@100） | `scope-shell-parsing.ts` |
| BACKUP-BYPASS 防写 | 104-123 | `scope-backup-bypass.ts` |
| 逐路径检查入口 | 125 | `scope-per-path.ts`（编排） |
| ROUTE-MISMATCH | 131 | `scope-route-mismatch.ts` |
| KC scope / write permission / config-read attest | 125 段内联 | `scope-kc.ts` / `scope-write-permission.ts` / `scope-config-read.ts` |
| UC7KS | 177-178（调 `lib/uc7ks-utils`） | 复用 `lib/uc7ks-utils`，不重实现 |

**做法**: 每个抽出模块导出纯函数 `checkX(input, output): { blocked, message?, ruleId }`；`validateWriteScope` 改为顺序编排这些函数（`scope.ts` handler 不动，仍只调 `validateWriteScope`）。
**配套测试**: 新增 `.opencode/service/gate/__tests__/scope-validate.test.ts`，覆盖 ROUTE-MISMATCH / backup-bypass / UC7KS 三路径（蓝图 §5.2 line 1337 的回归项）。
**风险**: §6.2 要求独立 commit；拆分后必须跑 `bun test ./.opencode/service/gate/__tests__/*.test.ts` + before-dispatcher import smoke。

### A2. §5.2 line 1344 + §7 line 1453 — before 链统一日志 `ruleId/layer/outcome`

**现状（已验证）**: 20 个 before handler 全调 `writeLog`，但大小写敏感搜 `ruleId|layer=|outcome=` **仅 `anti-bypass.ts` 命中**。其余 handler 的 `writeLog` 缺标准三字段。
**模板（照搬）**: `.opencode/plugin-handlers/before/anti-bypass.ts` 行 120-128：
```ts
writeLog("plugin-anti-bypass", "ERROR", {
  event: "ANTI-BYPASS-BLOCK",
  agent, sessionId, tool, isReadOnly,
  ruleId: "ANTI-BYPASS-MUST-REPORT",   // ← 新增
  layer: "enforcement",                 // ← 新增
  outcome: "deny",                      // ← 新增
});
// 阻断消息用 buildStopMessage({ pluginName, ruleId, blockedTool, agentName, reason, remediation })
```
**需补齐的 handler 与决策函数（按治理重要性排序）**:

| 文件 | 决策函数 | 当前日志位置 |
|---|---|---|
| `service/gate/scope-validate.ts` | `validateWriteScope` | 行 38/45/54/72/85/95-99/117-121（多处置 ERROR 缺字段） |
| `plugin-handlers/before/path-validate.ts` | `handle` | 其 BLOCKED writeLog |
| `plugin-handlers/before/codegraph.ts` | `handle` / `isExemptPath` | 其 `[FW-ENFORCE][CODEGRAPH-ENFORCE]` 日志 |
| `plugin-handlers/before/tool-governance-handler.ts` | `handle` | 其 REPO-OP 日志 |
| `plugin-handlers/before/behavioral-path-guard.ts` | `handle` | 7 处 writeLog |
| `plugin-handlers/before/permission-safety.ts` | `handle` | 3 处 |
| `plugin-handlers/before/git-guard.ts` | `handle` | 4 处 |
| `plugin-handlers/before/json-validate.ts` | `handle` | 5 处 |
| `plugin-handlers/before/config-guard.ts` | `handle` | 7 处 |
| `plugin-handlers/before/task.ts` | `handle` | 4 处 |
| `plugin-handlers/before/uc7ks.ts` | `handle` | 4 处 |
| `plugin-handlers/before/tdd.ts` | `handle` | 2 处 |
| `plugin-handlers/before/question-policy.ts` | `handle` | 4 处 |
| `plugin-handlers/before/phase0-enforce.ts` | `handle` | 8 处 |
| `plugin-handlers/before/dispatch-signal.ts` | `handle` | 2 处 |
| `plugin-handlers/before/skill-policy.ts` | `handle` | 4 处 |

**做法**: 在每个 handler 的 "BLOCKED/ALLOW" `writeLog` 调用里补 `ruleId`（该 handler 的裁决规则 id，如 `CODEGRAPH-ENFORCE` / `REPO-OP` / `PATH-SCOPE`）、`layer`（如 `enforcement` / `path` / `repo-policy`）、`outcome`（`allow`/`deny`）。**不要**在 allow 路径也强行加——只在有语义裁决的日志点加，避免噪声。
**注意**: 这是"整条 before 链"（蓝图原话），工作量较大；建议先改 4 个治理核心 handler（scope-validate / path-validate / codegraph / tool-governance-handler），其余按同模板批量补。

### A3. §5.2 line 1347 — 复合命令迁移到一等工具 / 固定 hash 受审脚本

**含义**: 现有复合命令（含 `;` / `|` / `>` / `$()` 的 shell）应迁到一等工具或固定 hash 的受审脚本。
**现状**: 蓝图未给出完整清单；属宽泛重构。
**评估**: 涉及面大、需先枚举 allowlist/测试/日志中的复合命令，**建议先作为独立任务枚举清单再动手**，不在本轮随手改。列为 A 类但标"大型/需前置枚举"。

---

## 三、B 类 — Live E2E 运行（serve-api，reviewer 执行，非代码改动）

均来自 §5.3（line 1353-1367）+ §7（1459/1460）。每个需 `opencode serve` + 真实 LLM，用 serve-api skill 驱动。给出代表项与期望：

- `safe_shell cat <file>` 成功、不再 `[FW-ENFORCE][REPO-OP]`（1355）
- `safe_shell git status` 成功（1356）
- `safe_shell git add a.ts` 被引导至 `safe_repo_stage`（1357）
- 无 grant 调 `safe_repo_stage` 报 grant 缺失（1359）
- 有 grant 且 impact 完成 `safe_repo_stage` 成功（1360）
- 未做 CodeGraph 的源码写操作仍被阻断（1361）
- `safe_hash` 在 safe_shell 不可用仍可只读 hash（1362）
- 含 `;`/`|`/`>`/`$()` 稳定返回 `SHELL-COMPOSITION-DENY` 且无子进程（1363）
- 长输出达上限子进程树终止、session 可续（1364）
- `safe_edit .gitignore` 不被 CODEGRAPH-ENFORCE 阻断（1365，Phase 8）
- `node -e "require('fs')['write'+'FileSync'](...)"` 被阻断（1366，Phase 9）
- Orchestrator session 启动不报 `TypeError: ...evaluating 'r._zod'`（1367，Phase 8 Zod v4）
- §7 1459 buffered/stream 超时/取消/超限/进程树终止 live
- §7 1460 allow-path live Orchestrator E2E

**执行**: 经 serve-api skill：`POST /session` → `POST /session/{SID}/message` 驱动 Orchestrator 调对应工具 → 查 `audit.jsonl` 的 `ruleId/layer/outcome` + `messages-final.json` 留痕。每项需 session id + 证据包。

---

## 四、C 类 — Reviewer 审计（无代码改动，巡检即可）

§5.4（1369-1381，其中 1378-1381 四个 Hardened Enforcement 实为 D 类代码已完成，仅待勾）：
- MVC：dispatcher 不含业务逻辑（1371）
- MVC：shell 路径语义只由 `service/tool-governance/shell-targets.ts` 维护（1372）
- Concurrency Safe：grant bind/check/consume 无竞态（1373）
- Framework Harness：旧 harness 名不冲突（1374）
- Log Central：治理域日志统一走 `log-manager`（1375）
- policy 文件 ≤400 行（1376）
- Bun runtime 实测 execFile/spawn（1377）

§5.5（1383-1393）弱模型交付审查门：diff 范围 / 验证输出 / reviewer 重跑 / 安全负向搜索（`exec`/`execSync`/`shell:true`/`bash -c`/`allowShellFallback` 等）/ live 证据齐全 / checkbox 仅 reviewer 改。

§7（1455 repo grant↔dispatch 兼容；1456 unit/integration/E2E 闭环）亦属审计。

---

## 五、D 类 — 代码已完成，checkbox 仍 `[ ]`（仅待 reviewer 勾选，切勿重复改）

以下工作树**已落地并测试通过**，蓝图 checkbox 未勾仅因规则 #6 禁止弱模型改：

- §5.1：codegraph `isExemptPath` 非源码豁免（8.4，9/9 ✅）
- §5.1：safe_shell Zod v4 `record()` 双参（8.2 ✅）
- §5.1：write-bypass 三正则（9.3/9.4，5/5 ✅）
- §5.2：DEFAULT_ORDER tool-governance 位置（8.3 ✅）、node -e/*.ts/*.js deny（9.1 ✅）、isOrchestrator=0（9.2 ✅）、allow-write=0（9.2 ✅）
- §7：safe_edit .gitignore/package.json 不阻断（8.1 代码 ✅，live 待 B 类）、Zod record（8.2 ✅）、DEFAULT_ORDER + project.config 一致（8.3 ✅）、node deny（9.1 ✅）、isOrchestrator/allow-write 删除（9.2 ✅）、write API 正则三式（9.3 ✅）、write-bypass.test（9.4 ✅）
- §5.4 1378-1381 Hardened Enforcement 四项代码均 ✅

---

## 六、WSL 文件手动编辑方法（避免 UNC 拒绝 / 引号地狱）

work-one 源码在 WSL，Windows 侧 Write/Edit 工具对 `\\wsl.localhost\...` 路径会拒绝。手动改可选：

1. **直接进 WSL 用编辑器**：`wsl -d Ubuntu-24.04 -- vim /home/zhaoge/workspace/opencode/work-one/.opencode/service/gate/scope-validate.ts`（或 nano）。
2. **脚本化多文件改**（推荐批量/find-replace）：把 Python 编辑脚本写到 Windows `C:\Users\USER\AppData\Local\Temp\edit.py`，再：
   ```
   wsl -d Ubuntu-24.04 -- python3 /mnt/c/Users/USER/AppData/Local/Temp/edit.py
   ```
   脚本内一律用 `/home/zhaoge/workspace/opencode/work-one/...` 绝对路径 `read()/write()`。
3. **改完验证**：
   ```
   wsl -d Ubuntu-24.04 -- bash -c "export PATH='/home/zhaoge/.bun/bin:/usr/local/bin:/usr/bin:/bin' && cd /home/zhaoge/workspace/opencode/work-one && bun test ./.opencode/service/gate/__tests__/*.test.ts && bun test ./.opencode/plugin-handlers/before/__tests__/*.test.ts"
   ```
   （bun test 路径必须带 `./` 前缀，否则被当名称过滤）
4. **import smoke**：`bun /tmp/smoke_p8.ts`（内容 `await import('/home/zhaoge/workspace/opencode/work-one/.opencode/plugins/before-dispatcher.ts'); console.log('ok');`）。
