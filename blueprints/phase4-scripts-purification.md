## Phase 4 — Scripts Purification 实施方案

### 背景

`.opencode/scripts/` 目录下 63 个文件（~27K 行非测试代码），虽然全部基于 TypeScript + Bun，但存在严重的架构违规：零个脚本从 `service/` 导入，28 个直接绕过 Service 层读写底层状态。最大的 MCP Tool `compliance-gate.ts`（3898L）内联了整个 gate 业务逻辑，与已建成的 `service/gate/` 形成双源。

### 框架调用链路（现状 vs 目标）

```
现状（违规）:
  Agent → MCP Tool (compliance-gate.ts) ──直接──→ lib/db-manager, lib/substate-manager
  Agent → Command Tool (dispatch-subagent.ts) ──直接──→ lib/db-state-manager, lib/gate-core

目标（MVC 合规）:
  Agent → MCP Tool (薄壳) → service/gate/* → lib/* → DB
  Agent → Command Tool (薄壳) → service/dispatch/* → lib/* → DB
  cron/shell → Script → service/* → lib/* → DB    （离线路径也可选走 service）
```

---

### 子系统对齐矩阵

每个 Phase 步骤与框架子系统的对应关系：

| 子系统 | 本 Phase 涉及的工作 |
|--------|-------------------|
| **MVC Architecture** | MCP Tool / Command Tool 瘦身为薄 Controller，业务逻辑下沉到 Service |
| **DB-only & DB-canonical** | 消除脚本中的文件 I/O 状态读写（gate-state.json），统一走 DB-first service 函数 |
| **Permission Matrix** | compliance-gate 中的 caller identity / SA bypass 逻辑下沉到 `service/gate/enforcement.ts`，与 opencode.json permission 矩阵对齐 |
| **Session/Concurrency Safe** | dispatch-subagent 中的 session_map 写入下沉到 `service/session/`，复用已有的 `writeSessionMapWithConstraint` 并发安全机制 |
| **Hardened Enforcement** | approve 权限校验、retry 权限校验、critical file bypass 全部集中到 `service/gate/enforcement.ts` |
| **Framework Harness** | framework-doctor / framework-self-test / state-reconciliation 的 lib 直接访问改为调 service，保持 harness 脚本的独立运行能力 |
| **Multi-Agent** | dispatch-subagent 的 prompt 构建逻辑（Agent skills、context7 docs、deliverables templates）下沉到 `service/dispatch/prompt-builder.ts` |
| **Log Central Management** | 所有脚本的 `writeLog` 调用从 `lib/log-manager` 改为通过 service 层间接调用（service 内部使用 log-manager） |
| **DB-canonical Management** | compliance-gate 中 `readJson`/`writeJson` 的文件 I/O 路径全部替换为 `loadGateStore()`/`saveGateStore()` 的 DB-first 调用 |
| **Templatization & Parameterization** | dispatch-subagent 中的 prompt 模板（P0 protocol、skill injection、deliverables markdown）统一为 `service/dispatch/prompt-builder.ts` 的参数化函数 |
| **TypeScript + Bun Runtime** | 统一 CJS require() → ESM import；统一 shebang 规范；清理 deprecated 文件 |

---

### Phase 4A — compliance-gate.ts 瘦身（P0，3898L → ≤200L）

**这是最大的收益点。** compliance-gate.ts 是运行时 MCP Tool，Agent 每次确认任务都会调用。

#### 4A-1: 新增 Service 函数（下沉到 service/gate/）

| 新文件 | 行数估计 | 来源（compliance-gate.ts 行号） | 功能 |
|--------|---------|-------------------------------|------|
| `service/gate/mcp-check.ts` | ~300L | runGateCheck (850-1400) | `checkGateCompliance()` — 编排 dispatch integrity + rule/skill check + UC7KS + enforcement + session creation，返回结构化 `CheckResult` |
| `service/gate/dispatch-integrity.ts` | ~120L | runGateCheck 内 860-1020 | `validateDispatchTaskIntegrity()` — session_map 查询、ctx 扫描、task_id 验证、fabrication 检测 |
| `service/gate/mcp-confirm.ts` | ~180L | runGateConfirm (1400-1700) | `confirmGateSession()` — deliverables 解析+交叉验证+universal append+checklist wire，返回 `ConfirmResult` |
| `service/gate/mcp-complete.ts` | ~200L | runGateComplete (1700-2100) | `completeGateWithRetry()` — eslint pre-clear + TSC check + artifact retry/recoverable + compactor archive |
| `service/gate/mcp-deliverables.ts` | ~200L | submit+approve (2100-2950) | `submitDeliverablesWithCrossCheck()` + `approveDeliverablesWithAudit()` — 增强版 submit/approve，含 evidence cross-check、SHA-256 proof、findings parse、read-before-approve |
| `service/gate/mcp-bulk.ts` | ~80L | bulk review (2950-3150) | `bulkReviewDeliverables()` — 批量 approve/reject，原子 DB 更新 |
| `service/gate/mcp-retry.ts` | ~100L | retry confirm (3400-3475) | `retryConfirmGateSession()` — 权限分级重试（any agent recoverable / SA-Orch failed / fail_history track） |

**实施步骤**：
1. 逐个创建上述 service 文件，每个文件内纯函数 + DB 操作
2. 在 `service/gate/index.ts` 添加 export
3. compliance-gate.ts 中对应的 run* 函数改为调 service 函数
4. 每改一个 handler，跑 `bun -e "await import('./scripts/mcp-tools/compliance-gate.ts')"` 验证加载
5. 全部完成后跑 `bun test` 验证

#### 4A-2: compliance-gate.ts 最终结构（目标 ≤200L）

```
compliance-gate.ts（瘦身后的薄壳）
├── MCP Server bootstrap (~30L)
│   ├── Server 创建、StdioServerTransport
│   ├── SIGINT handler
│   └── connect()
├── ListToolsRequestSchema handler (~100L)
│   └── 9 个 tool 的 JSON Schema 定义
└── CallToolRequestSchema handler (~70L)
    └── switch(name) → 调 service/gate/mcp-*.ts 的函数
```

---

### Phase 4B — dispatch-subagent.ts 瘦身（P1，1258L → ≤80L）

#### 4B-1: 新增 Service 函数

| 新文件 | 行数估计 | 功能 |
|--------|---------|------|
| `service/dispatch/prompt-builder.ts` | ~350L | `buildDispatchPrompt()` — 编排 P0 protocol + agent skills + context7 docs + deliverables templates + UC7KS context 为一个完整的 prompt markdown |
| `service/dispatch/prompt-sections.ts` | ~250L | 各个 prompt section 的生成函数：`buildP0ProtocolSection()`、`buildAgentSkillsSection()`、`buildDeliverablesSection()`、`buildContext7Section()` |

#### 4B-2: command-tools/dispatch-subagent.ts 最终结构

```
dispatch-subagent.ts（瘦身后的 CLI 入口）
├── CLI arg 解析 (~15L)
├── 调 service/dispatch/prompt-builder.ts (~10L)
├── 写 prompt 文件到 stdout (~10L)
└── 错误处理 (~5L)
```

**注意**：dispatch-subagent.ts 通过 `execFileSync("bun", [...])` 从 `service/dispatch/router.ts` 调用。瘦身后它只是一个 CLI wrapper，所有 prompt 构建逻辑在 service 层。

---

### Phase 4C — eslint-audit.ts + code-quality-lib.ts 瘦身（P2）

#### 4C-1: eslint-audit.ts (424L → ≤60L)

| 新文件 | 行数估计 | 功能 |
|--------|---------|------|
| `service/file-guard/eslint-audit.ts` | ~280L | `runEslintAudit()` — ESLint 执行、结果解析、dirty_modules 管理、state 写入 |

瘦身后的 eslint-audit.ts 只保留 MCP server bootstrap + tool schema + 调 service。

#### 4C-2: code-quality-lib.ts (1064L → ≤100L lib + service)

| 新文件 | 行数估计 | 功能 |
|--------|---------|------|
| `service/file-guard/code-quality.ts` | ~400L | `runFullCodeQualityScan()` — ESLint merged rules + prettier + depcruise + scope check + TDD check 编排 |
| `service/file-guard/eslint-runner.ts` | ~250L | `runEslintWithMergedRules()` — 11 框架规则 + 5 项目规则的 merge、执行、结果解析 |
| `service/file-guard/quality-checks.ts` | ~200L | `runPrettierCheck()` + `runDepcruiseCheck()` + `runScopeCheck()` + `runTddCheck()` |

code-quality-check.ts（110L）的 MCP bootstrap 不变，handler 改为调 service。
code-quality-lib.ts 瘦身为纯 re-export bridge → service/file-guard/code-quality.ts。

---

### Phase 4D — 清理 deprecated / orphan 文件（P3）

| 文件 | 操作 | 理由 |
|------|------|------|
| `knowledge/scout-trigger.ts` | 删除 | 已标记 deprecated，CodeGraph MCP 替代 |
| `mcp-tools/reconciliation-validate.ts` | 删除 | 用了 MCP SDK 但未注册到 opencode.json，疑似废弃 |
| `mcp-tools/baseline-diagnostic.ts` | 评估 | 仅被 code-quality-lib.ts import，不是独立 MCP server。逻辑移入 service 后此文件可删除 |

---

### Phase 4E — 运维脚本 service 化（P4）

这些是离线脚本，不在 Agent 请求热路径上。优先级较低但仍有架构价值。

#### 4E-1: nightly-compaction.ts (508L)

将 `lib/state-utils`、`lib/db-manager`、`lib/uc7ks-schema` 的直接调用改为：
- 状态压缩 → `service/state/compactor.ts`（如果不存在则创建）
- UC7KS 修剪 → `service/knowledge/maintenance.ts`（已存在 `pruneSessionAccess`）
- 日志轮转 → `service/session/cleanup.ts`

脚本只保留 CLI 解析 + 编排调用 + 输出汇总。

#### 4E-2: knowledge/janitor.ts (858L)

将 `lib/state-utils`、`lib/substate-manager` 调用改为：
- 缓存清理 → `service/knowledge/maintenance.ts`
- 索引维护 → `service/knowledge/indexer.ts`（如不存在则在 service 层创建）

#### 4E-3: state-reconciliation.ts (1826L)

这是最大的运维脚本。建议拆分为：
- `service/state/reconciliation.ts` — 对账逻辑（DB vs 文件 state 比对）
- `service/state/canonicalize.ts` — state 规范化
- 脚本保留 CLI 入口 + 报告输出

#### 4E-4: framework-doctor.ts (1684L) + framework-self-test.ts (6143L)

这两个是框架健康检查工具。建议：
- 将检查逻辑拆到 `service/framework/health-checks.ts`（按子系统组织检查函数）
- 脚本只保留 CLI + 报告格式化
- framework-self-test.ts 的 6143L 中大量是内联测试用例，应移到 `__tests__/` 或独立的 `.spec.ts`

---

### Phase 4F — 运行时规范化（P5）

#### 4F-1: 统一 CJS → ESM

| 范围 | 操作 |
|------|------|
| `scripts/mcp-tools/*.ts` | `require("@modelcontextprotocol/sdk/...")` → `import { ... } from "@modelcontextprotocol/sdk/..."` |
| `scripts/knowledge/*.ts` | `require("../../lib/...")` → `import { ... } from "../../lib/..."` |
| `scripts/*.ts` 根目录 | 同上 |
| `code-quality-lib.ts` | 显式注释说不能用 ESM（会破坏 CJS 消费者）。需要先确认所有消费者都支持 ESM |

**注意**：Bun 对 CJS/ESM 混用有良好的兼容性，但长期维护应统一为 ESM。渐进式推进，每次改一个文件并验证。

#### 4F-2: 统一 shebang 规范

所有可独立执行的 `.ts` 文件统一添加 `#!/usr/bin/env bun` shebang。
被其他文件 import 的库文件（如 `code-quality-lib.ts`）不加 shebang。

---

### 实施顺序与风险控制

```
Phase 4A (compliance-gate) ────────────────────── P0, 收益最大, 风险最高
  ├── 4A-1: 新增 7 个 service/gate/mcp-*.ts
  ├── 4A-2: 逐个替换 compliance-gate.ts handler
  └── 4A-3: 每步验证: plugin load + bun test + 手动 MCP 调用
           ↓
Phase 4B (dispatch-subagent) ───────────────────── P1, 收益中等, 风险中等
  ├── 4B-1: 新增 service/dispatch/prompt-builder.ts
  └── 4B-2: 瘦身 command-tools/dispatch-subagent.ts
           ↓
Phase 4C (eslint + code-quality) ────────────────── P2, 收益中等, 风险低
  ├── 4C-1: eslint-audit.ts → service
  └── 4C-2: code-quality-lib.ts → service
           ↓
Phase 4D (cleanup) ──────────────────────────────── P3, 收益低, 风险最低
  └── 删除 3 个废弃文件
           ↓
Phase 4E (运维脚本) ────────────────────────────── P4, 收益低, 风险低
  ├── 4E-1 ~ 4E-4: 逐个 service 化
  └── 每个脚本独立推进，可跳过
           ↓
Phase 4F (规范化) ──────────────────────────────── P5, 纯工程规范
  ├── 4F-1: CJS → ESM
  └── 4F-2: shebang 统一
```

### 验证策略

每个 Phase 步骤完成后必须通过：

1. **Plugin load test**: `bun -e "await import('./scripts/mcp-tools/compliance-gate.ts')"` — 确认无 import 断裂
2. **Unit test**: `bun test` — 确认 6/6 safe-bash 测试通过
3. **MCP spawn test**: 重启 opencode server，确认 MCP server 正常启动（`ps aux | grep compliance-gate`）
4. **Functional test**: 在 TUI 中向 Orchestrator 发送 `hello`，确认无 "Unexpected server error"
5. **Gate flow test**: 手动执行 compliance_gate_check → confirm → complete 全流程

### 预期成果

| 指标 | 现状 | 目标 |
|------|------|------|
| compliance-gate.ts | 3898L | ≤200L |
| dispatch-subagent.ts | 1258L | ≤80L |
| eslint-audit.ts | 424L | ≤60L |
| code-quality-lib.ts | 1064L | ≤100L (bridge) |
| scripts/ 中从 service/ 导入的文件 | 0 | ≥10 |
| scripts/ 中直接从 lib/ DB 操作的文件 | 28 | ≤10 (仅迁移脚本) |
| deprecated/orphan 文件 | 3 | 0 |
| CJS/ESM 混用 | 普遍 | 统一 ESM |
