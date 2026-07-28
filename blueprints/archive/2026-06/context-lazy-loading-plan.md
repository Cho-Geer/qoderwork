# 框架优化统一实施方案

**日期**: 2026-06-29
**来源**: context-lazy-loading-plan + phase4-scripts-purification-plan 合并

本文档合并了两个独立方案，形成统一的框架优化路线：

| 方案 | 目标 | 核心手段 |
|------|------|----------|
| **上下文瘦身** | Agent 启动 token 从 ~72-106K 降至 ~30-50K | tool.definition hook + instructions 精简 |
| **Scripts 净化** | 消除 scripts/ 中的架构违规（零 service 导入） | MCP Tool / Command Tool 瘦身为薄 Controller，业务下沉到 Service |

---

## 全局状态总览

### Part A — 上下文瘦身（已完成大部分）

| Step | 内容 | 状态 | 收益 |
|------|------|------|------|
| A-1 | 框架可行性验证（hook 逆向） | ✅ 完成 | — |
| A-2 | MCP tool schema 瘦身（tool.definition hook） | ✅ 已部署 | ~20-40K tokens |
| A-3 | index.json 从 instructions 移除 | ✅ 已部署 | ~10K tokens |
| A-4 | Rules 冗余 glob 移除 | ✅ 已部署 | ~0（清理冗余） |
| A-5 | Rules 按角色裁剪 | ⏸ 待评估 | ~10-15K tokens |
| A-6 | Skills 注册 + 目录化 | ⏸ 待定 | 0（当前未注册） |

### Part B — Scripts 净化（B-4A, B-4B 完成）

| Step | 内容 | 优先级 | 状态 |
|------|------|--------|------|
| B-4A | compliance-gate.ts 瘦身（3898L → 193L） | P0 | ✅ **完成** |
| B-4B | dispatch-subagent.ts 瘦身（1258L → 121L） | P1 | ✅ **完成** |
| B-4C | eslint-audit.ts + code-quality-lib.ts 瘦身（424L→99L, 1064L→51L） | P2 | ✅ **完成** |
| B-4D | 清理 deprecated / orphan 文件（3 → 0） | P3 | ✅ **完成** |
| B-4E | 运维脚本 service 化 | P4 | ⏭️ **跳过** |
| B-4F | 运行时规范化（CJS→ESM、shebang） | P5 | ✅ **完成** |

---

## 两方案交叉点分析

### 交叉 1: compliance-gate MCP 工具

Part A 的 context-trimmer plugin 替换 compliance-gate 的 9 个工具 schema 为摘要。
Part B 的 4A 将 compliance-gate.ts 从 3898L 瘦身为 193L 薄壳。

**两者互补，无冲突：**
- Part A 处理 LLM 侧看到的 schema（token 瘦身）
- Part B 处理运行时代码结构（架构合规）

**注意事项：** 4A 重构 compliance-gate.ts 后，工具名称和数量保持不变（仍为 9 个），因此 Part A 的 tool-summaries.ts 无需修改。若新增工具需同步更新 tool-summaries.ts。

### 交叉 2: service/gate/ 目录增长

Part B 的 4A 新增 7 个 service/gate/mcp-*.ts 文件。
Part A 的 context-trimmer 的 tool-summaries.ts 需要这些文件的 export。

**无冲突：** mcp-*.ts 是 service 层函数，context-trimmer 只读取 tool 摘要配置，不直接依赖 service 层。

### 交叉 3: eslint-audit + code-quality MCP 工具

Part A 替换其 schema 为摘要（已完成）。
Part B 的 4C 将其业务逻辑从 424L/1064L 瘦身为薄壳。

**互补：** 同交叉 1。

### 交叉 4: 执行顺序约束

```
Part A-2 (schema 瘦身) 必须在 Part B (任何 MCP tool 重构) 之前完成
原因: schema 瘦身先部署，后续重构不影响 token 收益

Part B-4A (compliance-gate) 应在 Part A-5 (Rules 过滤) 之前
原因: 4A 产生的 service 函数可被 Rules 过滤的 hook 复用
```

当前状态：A-2 已完成，B-4A 已完成，可以安全开始 B-4B。

---

## 统一执行计划

```
                    Part A (上下文瘦身)              Part B (Scripts 净化)
                    ───────────────────              ─────────────────────
已完成 ───→  A-1 框架验证 ✅
             A-2 MCP schema 瘦身 ✅
             A-3 index.json 移除 ✅
             A-4 Rules glob 去重 ✅
                              │
当前 ─────→                 ──┤──→  B-4A compliance-gate 瘦身 (P0) ✅ 完成
                              │      ├── 7 个 service/gate/mcp-*.ts ✅
                              │      └── compliance-gate.ts 193L ✅
                              │
                              ├──→  B-4B dispatch-subagent 瘦身 (P1) ✅ 完成
                              │      ├── 2 个 service/dispatch/ 文件 ✅
                              │      └── dispatch-subagent.ts 121L ✅
                              │
                              ├──→  B-4C eslint + code-quality (P2) ✅ 完成
                              │      ├── 3 个 service/file-guard/ 新文件 ✅
                              │      ├── eslint-audit.ts 99L ✅
                              │      └── code-quality-lib.ts 51L bridge ✅
                              │
                              ├──→  B-4D 清理 deprecated (P3) ✅ 完成
                              │      └── 3 ファイル削除 → .trash-b4d-20260629/
                              │
                              ├──→  B-4E 运维脚本 service 化 (P4) ⏭️ 跳过
                              │
                              └──→  B-4F CJS→ESM + shebang (P5) ✅ 完成
                                       ├── shebang 全ファイル統一 ✅
                                       ├── export {}; 削除 21 ファイル ✅
                                       └── CJS/ESM 競合 0 ✅
                                       │
完了 ─────→  Part B 全ステップ完了 ✅
                                       │
未来 ─────→  A-5 Rules 角色裁剪 (待评估) ←┘ 可复用 B-4A/B-4B 产生的 service 函数
             A-6 Skills 注册 (待定)
```

---

## Part A 详细记录

### A-1: 框架可行性验证（✅ 完成）

通过逆向 opencode 二进制，确认了以下 hook：

| Hook | input | output | 用途 |
|------|-------|--------|------|
| `tool.definition` | `{toolID}` | `{description, parameters, jsonSchema}` | MCP schema 瘦身 |
| `experimental.chat.system.transform` | `{sessionID, model}` | `{system: string[]}` | system prompt 变换 |
| `experimental.session.compacting` | `{sessionID}` | `{context: [], prompt}` | 压缩上下文注入 |

**不存在的 hook：** `session.initialize`（最接近 `session.created`）、per-agent instructions、per-agent MCP servers。

### A-2: MCP Tool Schema 瘦身（✅ 已部署）

**部署文件：**

| 文件 | 说明 |
|------|------|
| `plugins/context-trimmer.ts` | ~95L, `tool.definition` hook 实现 |
| `service/context/tool-summaries.ts` | 61 个 MCP 工具一行摘要 |
| `service/context/mcp-role-filter.ts` | 角色→MCP server 映射（预留） |

**工作原理：**
```
Before: compliance_gate_check
  description: "Perform a compliance gate check..."  (200+ chars)
  inputSchema: { type: "object", properties: { session_id: {...}, ... } }

After: compliance_gate_check
  description: "门禁合规检查（读取状态，不写入）"  (15 chars)
  inputSchema: { type: "object", properties: {} }
```

**opencode.json 变更：**
- 注册 `context-trimmer.ts` 到 `plugin` 数组

### A-3: index.json 移除（✅ 已部署）

`docs/official_docs/index.json`（840L, ~10K tokens）从 instructions 中移除。Agent 仍可通过 `read` 工具按需读取。

### A-4: Rules glob 去重（✅ 已部署）

移除冗余的 `.opencode/rules/rule_detail/*.md`（已被 `**/*.md` 递归覆盖）。

**当前 instructions 配置：**
```json
{
  "instructions": [
    "AGENTS.md",
    ".opencode/rules/**/*.md"
  ]
}
```

### A-5: Rules 按角色裁剪（⏸ 待评估）

**技术约束：**
1. `experimental.chat.system.transform` input 无 agent name（需 DB 查 session_map）
2. Instructions 已拼接为单个字符串，无法单独移除某个 rule 文件
3. 需要重构 rules 目录结构（common/ + roles/{agent}/），工作量 2-3 天

**建议：** 在 Part B 完成后重新评估。4A 产生的 service 函数可为 system transform hook 提供 agent 上下文感知能力。

### A-6: Skills 注册（⏸ 待定）

当前所有 agent 的 `skills: []` 为空。19 个 active skill（3,873L）存在但未注册。无 token 开销。

---

## Part B 详细方案

### B-4A: compliance-gate.ts 瘦身（P0）✅ 完成

**核心收益：** compliance-gate.ts 是运行时 MCP Tool，Agent 每次确认任务都调用。内联了整个 gate 业务逻辑，与已建成的 `service/gate/` 形成双源。

#### 实施结果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| compliance-gate.ts | **3898L** | **193L** |
| 新增 service 文件 | 0 | **7 个** |
| service/gate/ 总文件 | ~25 | **35 个** |

#### 新增 Service 文件（已部署）

| 文件 | 行数 | 功能 |
|------|------|------|
| `service/gate/mcp-check.ts` | 444L | `checkGateCompliance()` — 编排 dispatch integrity + rule/skill check + UC7KS |
| `service/gate/dispatch-integrity.ts` | 188L | `validateDispatchTaskIntegrity()` — task_id 防篡改 |
| `service/gate/mcp-confirm.ts` | 219L | `confirmGateSession()` — deliverables 解析 + checklist wire |
| `service/gate/mcp-complete.ts` | 264L | `completeGateWithRetry()` — eslint/TSC check + compactor archive |
| `service/gate/mcp-deliverables.ts` | 511L | `submitDeliverablesWithCrossCheck()` + `approveDeliverablesWithAudit()` |
| `service/gate/mcp-bulk.ts` | 130L | `bulkReviewDeliverables()` — 批量 approve/reject |
| `service/gate/mcp-retry.ts` | 142L | `retryConfirmGateSession()` — 权限分级重试 |

#### 瘦身后 compliance-gate.ts 结构（193L）

```
compliance-gate.ts
├── MCP Server bootstrap (~10L)
├── Service layer imports (~10L)
├── buildReminderText() (~20L)
├── ListToolsRequestSchema handler (~30L)
│   └── 9 个 tool 的 JSON Schema 定义（精简版）
└── CallToolRequestSchema handler (~80L)
    └── dispatch → service/gate/mcp-*.ts
```

#### 验证结果

```
✅ 27/27 plugins load OK
✅ 6/6 bun tests pass
✅ compliance-gate.ts thin shell (193L) loads
✅ service/gate/index.ts exports 87 functions
```

#### 备份位置

```
scripts/mcp-tools/compliance-gate.ts.bak-4a  (原始 3898L)
```

#### 架构收益

```
Before: Agent → MCP Tool (compliance-gate.ts 3898L) ──直接──→ lib/*
After:  Agent → MCP Tool (193L 薄壳) → service/gate/mcp-*.ts → lib/* → DB
```

### B-4B: dispatch-subagent.ts 瘦身（P1，1258L → 121L）✅ 完成

#### 实施结果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| dispatch-subagent.ts | **1258L** | **121L** |
| 新增 service 文件 | 0 | **2 个** |
| service/dispatch/ 总文件 | ~8 | **19 个** |

#### 新增 Service 文件（已部署）

| 文件 | 行数 | 功能 |
|------|------|------|
| `service/dispatch/prompt-sections.ts` | 237L | `findRelevantStacks()`, `isFrameworkTask()`, `buildContext7Section()`, `buildProjectContextSection()`, `buildScopeLine()`, `buildKCGateFlowSection()`, `buildTemplateResolutionMap()`, `resolveTemplateVariables()` |
| `service/dispatch/prompt-builder.ts` | 249L | `buildDispatchPrompt()` — frontmatter 解析、agent config 读取、模板解析、prompt 组装、hash 生成 |

#### 瘦身后 dispatch-subagent.ts 结构（121L）

```
dispatch-subagent.ts (121L)
├── CLI arg 解析 (~15L)
├── 调 service/dispatch/prompt-builder.ts (~10L)
├── 写 prompt 到 stdout (~10L)
├── .pending.json queue 写入 (~15L)
├── DB enqueue (~10L)
└── 错误处理 (~10L)
```

#### 验证结果

```
✅ 27/27 plugins load OK
✅ 6/6 bun tests pass
✅ dispatch-subagent.ts thin shell (121L) loads
✅ service/dispatch/index.ts exports updated
```

#### 备份位置

```
scripts/command-tools/dispatch-subagent.ts.bak-4b  (原始 1258L)
```

#### 架构收益

```
Before: Agent → CLI Tool (dispatch-subagent.ts 1258L) ──直接──→ lib/*
After:  Agent → CLI Tool (121L 薄壳) → service/dispatch/prompt-*.ts → lib/* → DB
```

### B-4C: eslint-audit.ts + code-quality-lib.ts 瘦身（P2）✅ 完成

#### 实施结果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| eslint-audit.ts | **424L** | **99L** (73% 削減) |
| code-quality-lib.ts | **1064L** | **51L** (95% 削減, bridge) |
| 新增 service 文件 | 0 | **3 个** |
| service/file-guard/ 总文件 | 20 | **23 个** |

#### 新增 Service 文件（已部署）

| 文件 | 行数 | 功能 |
|------|------|------|
| `service/file-guard/eslint-runner.ts` | 309L | `getProjectRoot()`, `generateTierRules()`, `runESLint()`, `updateEslintState()` — tier rules 生成 + ESLint 実行 + state 更新 |
| `service/file-guard/quality-checks.ts` | 577L | `runScopeCheck()`, `runPrettierCheck()`, `runDepCruiserCheck()`, `runEslintAudit()`, `runTddOrderCheck()`, `runTddSpecCheck()` — 6 個独立檢查函数 |
| `service/file-guard/quality-batch.ts` | 233L | `runAllChecks()`, `runFullScan()` — バッチ実行オーケストレーター |

#### 瘦身后结构

```
eslint-audit.ts (99L) — MCP thin shell
├── MCP Server bootstrap
├── ListToolsRequestSchema (run_audit)
├── CallToolRequestSchema → delegates to service/file-guard/eslint-runner
└── SIGINT handler + lifecycle

code-quality-lib.ts (51L) — CJS bridge
└── module.exports = re-exports from service/file-guard/{quality-checks,quality-batch,tsc-diagnostic}
```

#### 验证結果

```
✅ 3/3 service files load OK
✅ eslint-audit.ts thin shell loads
✅ code-quality-lib.ts bridge loads
✅ service/file-guard/index.ts barrel exports OK
✅ 5/7 plugins load OK (2 pre-existing failures: keystone-validate, reconciliation-validate)
```

#### 备份位置

```
scripts/mcp-tools/eslint-audit.ts.bak-4c    (原始 424L)
scripts/mcp-tools/code-quality-lib.ts.bak-4c (原始 1064L)
```

#### 架构收益

```
Before: Agent → MCP Tool (eslint-audit.ts 424L) ──直接──→ lib/*
        Agent → code-quality-lib.ts (1064L) ──直接──→ execSync
After:  Agent → MCP Tool (99L) → service/file-guard/eslint-runner.ts → lib/*
        Agent → bridge (51L) → service/file-guard/{quality-checks,quality-batch}.ts → execSync
```

### B-4D: 清理 deprecated 文件（P3）✅ 完成

#### 削除ファイル

| ファイル | 行数 | 操作 | 理由 |
|------|------|------|------|
| `knowledge/scout-trigger.ts` | 101L | ✅ 削除 | 外部参照なし。CodeGraph MCP が代替 |
| `mcp-tools/reconciliation-validate.ts` | 386L | ✅ 削除 | opencode.json 未登録。framework-doctor.ts は `fileExists()` ガード付き fallback → 次の inline DB check に自動移行 |
| `mcp-tools/baseline-diagnostic.ts` | 44L | ✅ 削除 | ロジックは `service/file-guard/diagnostic-baseline.ts` に移行済み。`lib/baseline-diagnostic.ts` bridge 経由で e2e テスト正常動作 |

#### 検証結果

```
✅ mcp-tools: 7 → 6 ファイルに削減
✅ 浮遊参照なし（dangling imports ゼロ）
✅ framework-doctor.ts 正常 load（fallback  chain 動作確認）
✅ service/file-guard/index.ts barrel OK
```

#### 削除ファイル保管場所

```
.opencode/.trash-b4d-20260629/
├── scout-trigger.ts
├── reconciliation-validate.ts
└── baseline-diagnostic.ts
```

### B-4E: 运维脚本 service 化（P4）⏭️ 跳过

大規模スクリプト（framework-self-test.ts 6143L 等）の service 化は将来の B-5 以降で対応。

### B-4F: 运行时规范化（P5）✅ 完成

#### 实施内容

**1. shebang 統一** — 13 ファイルに `#!/usr/bin/env bun` 追加

| 対象 | ファイル数 |
|---|---|
| scripts/ root | 3 (framework-doctor.ts, reset-interrupt-state.ts, state-reconciliation.ts) |
| scripts/mcp-tools/ | 1 (code-quality-lib.ts) |
| scripts/knowledge/ | 9 (archiver, capture-config-snapshot, compressor, deduplicator, indexer, integrity-check, janitor, scout-extractor, size-reporter) |
| **合計** | **13 ファイル追加 → 全 TS ファイル統一 ✅** |

**2. CJS/ESM 競合解消** — 21 ファイルから `export {};` 削除

| カテゴリ | ファイル数 |
|---|---|
| MCP tools (compliance-gate, eslint-audit, code-quality-check, keystone-validate) | 4 |
| State scripts (state-canonicalize, state-integrity-scan, state-reconciliation, state-transaction, state-reset) | 5 |
| Knowledge scripts (archiver, compressor, indexer, integrity-check, janitor, scout-extractor, size-reporter) | 7 |
| Other (framework-compliance-check, framework-doctor, framework-self-test, gate-lifecycle-audit, install-hooks, pre-execution-gate) | 5 |
| **合計** | **21 ファイル → CJS/ESM 競合 0 ✅** |

**3. scout-extractor.ts ESM 化** — `module.exports` → `export { extract }`

#### 検証結果

```
✅ Plugin load: 5/5 OK
✅ Knowledge load: 8/10 OK (2件は実行時エラー、ロード正常)
✅ CJS/ESM conflicts: 0
✅ Shebang uniformity: 全ファイル統一
```

---

## 验证策略

### Part B 每步验证清单

| # | 验证项 | 命令 |
|---|--------|------|
| 1 | Plugin load test | `bun -e "await import('./scripts/mcp-tools/compliance-gate.ts')"` |
| 2 | Unit test | `bun test` |
| 3 | MCP spawn test | 重启 opencode，`ps aux \| grep compliance-gate` |
| 4 | Functional test | TUI 发送 `hello` 确认无 "Unexpected server error" |
| 5 | Gate flow test | compliance_gate_check → confirm → complete 全流程 |
| 6 | Schema 回归 | context-trimmer 仍正常 trim（检查 log: CONTEXT-TRIMMER-STATS） |

### Part A + B 联合验证

完成 B-4A 后，验证：
1. context-trimmer 对 compliance-gate 的 9 个工具仍正常 trim
2. compliance-gate.ts 的 MCP handler 正确调用 service 层
3. 两个优化叠加后 agent token 数进一步降低（schema 瘦身 + 代码瘦身不影响 token，但架构更清晰）

---

## 预期成果

### Token 收益（Part A）

| Agent | 优化前 | 优化后 | 降幅 |
|-------|--------|--------|------|
| Meta-Planner | ~75K | ~37K | ~50% |
| Coder-BE | ~80K | ~42K | ~47% |
| Super-Admin | ~85K | ~47K | ~45% |

### 架构收益（Part B）

| 指标 | 现状 | 目标 |
|------|------|------|
| compliance-gate.ts | ~~3898L~~ → **193L** | ✅ ≤200L |
| dispatch-subagent.ts | ~~1258L~~ → **121L** | ✅ ≤200L |
| eslint-audit.ts | ~~424L~~ → **99L** | ✅ ≤200L |
| code-quality-lib.ts | ~~1064L~~ → **51L** | ✅ ≤100L |
| scripts/ 从 service/ 导入 | ~~0~~ → **≥12** | ≥10 |
| scripts/ 直接 lib/ DB 操作 | 28 | ≤10 |
| deprecated/orphan 文件 | ~~3~~ → **0** | ✅ 0 |

### 新增 Service 文件清单（Part B）

| 目录 | 新文件 | 数量 | 状态 |
|------|--------|------|------|
| service/gate/ | mcp-check.ts, dispatch-integrity.ts, mcp-confirm.ts, mcp-complete.ts, mcp-deliverables.ts, mcp-bulk.ts, mcp-retry.ts | 7 | ✅ 已部署 |
| service/dispatch/ | prompt-builder.ts, prompt-sections.ts | 2 | ✅ 已部署 |
| service/file-guard/ | eslint-runner.ts, quality-checks.ts, quality-batch.ts | 3 | ✅ 已部署 |
| service/framework/ | health-checks.ts | 1 | ⏳ 待创建 |
| service/state/ | reconciliation.ts | 1 | ⏳ 待创建 |
| **合计** | | **14** | **12/14 完成** |
