# 框架简化路线 — 方案文档 vs 当前代码 交叉审核

**日期**: 2026-07-10
**方法**: debug-investigation-coach（不轻信文档叙述，用命令实测证据核对每个“当前事实”）
**目标项目**: /home/zhaoge/workspace/opencode/work-one
**依据文档**: blueprint-opencode-framework-simplification-roadmap.md + plans/00~06

---

## 1. 基线事实核验（Phase 0 §1 / overview §1）

| 计划声称 | 实测 | 结论 |
|---|---|---|
| CodeGraph 395 files / 355 TS | 395 files / 节点 4174 | 准确 |
| .opencode TS 文件 350 | 354 | 漂移 +4（live 方差，计划本身要求记录采样命令） |
| .opencode TS 行数 74,665 | 74,667 | 准确 |
| active agent 5（Orchestrator/build/general/plan/explore） | 完全一致 | 准确 |
| active prompt 仅 Orchestrator.md | 仅 Orchestrator.md | 准确 |
| legacy role profile 9 | 9 | 准确 |
| before 9 / after 7 / system 2（含名字） | 与三个 dispatcher 的 HANDLER_MAP 完全一致 | 准确 |
| plugin-handler 源文件 42 | 42 | 准确 |
| custom tool 37 | 37 | 准确 |
| Skill 18 | 18 | 准确 |
| MCP server 12 | opencode.json 声明 12 | 准确（配置声称，未逐个枚举） |
| DB schema v37 / 49 business / 50 total | v37 / 49 / 50 | 准确 |
| dispatch_privilege_grants 含 max_writes/writes_used/completed_at | 含三列 | 准确 |
| framework_maintenance_plans 存在 | 存在（grant_id/planned_paths/codegraph_targets...） | 准确 |
| gate_call_context 存在且 active | 存在且进入 before/after active order | 准确 |

**结论：基线文档基本准确，可作为实施起点。仅有 TS 文件数 4 个漂移，属 live 方差。**

---

## 2. 关键结构核验

- **before-dispatcher HANDLER_MAP = 恰好 9 个**（gate-call-context, codegraph, scope, guidance-bridge, permission-safety, dispatch-signal, skill-policy, behavioral-path-guard, task），与 `plugin_execution_order.before` 完全一致。
- **after-dispatcher = 7 个**，system-dispatcher = 2 个，名字一致。
- `before/` 目录有 20 个 .ts，但**只有 9 个被 import 进 HANDLER_MAP**；其余（checklist / phase0-enforce / dispatch / json-validate / uc7ks / tdd / git-guard / config-guard / question-policy / anti-bypass）**未接入 map → 运行时已休眠**。计划里“legacy 隔离”目标在运行时**已达成**，只是文件未标注 legacy。
- `safe_framework_edit.ts:26` 明确要求 “an active framework_maintenance_plan, and the target path must be listed in the plan” → 计划“先 plan 再 write”叙述准确。
- `skill-summary.ts` 含 `recentMessageBridge` + `coldStartDbFallback` + `knowledge_freshness_decision` → 计划 §0.1 #3 准确。
- `preflight-lite/SKILL.md` 含 risk 分类（trivial/standard/high-risk/blocked）、TodoWrite 计数（3-5 / 5-8）、codegraph-first、customize-opencode、Context7 freshness、evidence、question → 计划 Phase1 Step5 11 步内容基本到位。

---

## 3. 发现的问题（Gap）

| # | 等级 | 问题 | 计划对应 | 处置 |
|---|---|---|---|---|
| G1 | 轻微 | TS 文件数 354 vs 计划 350 | Phase 0 §1 | 重跑采样命令，更新基线数字（live 方差，非阻塞） |
| G2 | 卫生 | `before/anti-bypass.ts` 是 active `system/anti-bypass.ts` 的孤儿副本（不在任何 map） | — | 确认意图后删除孤儿文件 |
| G3 | 进行中（预期） | `dispatch_subagent` 仍被非框架维护的 legacy 文件引用（permission/legacy-agent-permissions.ts、knowledge/enforcement.ts、gate/checklist-validate.ts、service/dispatch/* 等） | Phase 2 Step5 | 收窄到仅 framework maintenance compat path，尚未完成 |
| G4 | 文档/卫生 | before/ & after/ 目录的 legacy handler 文件未标注 `Legacy handler, not active order` | Phase 3 Step4 | 加文件头注释，降低误启用风险 |
| G5 | 已验证 | skill-summary bridge / preflight-lite 11 步已到位 | Phase1 | 无需动作，已确认 |
| G6 | 文档 | mcp-role-filter 仍可能被误写成“已接线” | Phase1 Step6 | 标注 legacy/future，文档删除“已生效”表述 |

---

## 4. 总体结论

- 文档基线**准确且可实施**，无结构性阻塞可阻止启动 Phase 0/1。
- “legacy 隔离”在运行时**已实质达成**（未接入 HANDLER_MAP），剩余是文件标注 + 文档叙述 + 收窄 dispatch_subagent 引用（G3/G4）。
- 计划评分等级（static/code、component、runtime smoke、live LLM E2E、full matrix）的纪律在后续实施中必须严格遵守，避免把 static 写成 runtime。

---

## 5. 实施起点建议（遵循 overview §4 固定顺序）

1. **Phase 0 收尾**：重采样 TS 漂移（G1）+ 把 Phase 0 §3/§4 叙述替换表应用到 stale docs。纯文档，低风险。
2. **Phase 1**：结构已基本就位。剩余：12 条中文关键词回归样例 doc、旧 preflight/preamble 清理、mcp-role-filter 标注（G6）、QoderWork watcher JSONL 事件契约（R1-R7）。
3. **Phase 2**：native Task 无 DAG smoke（按 07-10 基线重跑）、隔离 legacy dispatch validator（G4）、收窄 dispatch_subagent（G3）、Scout-equivalent 走 explore+investigation-evidence+context7-first。
4. **Phase 3/4/5**：在 Phase 0-2 稳定基线之上推进 enforcement 行为化、DB hot-path、legacy 退役验证。

---

## 6. 立即下一步（一个具体动作）

重基线 TS 文件数漂移，让 Phase 0 冻结数字与 2026-07-10 工作树一致：

```bash
cd /home/zhaoge/workspace/opencode/work-one
rg --files .opencode -g '*.ts' | wc -l
rg --files .opencode -g '*.ts' -0 | xargs -0 wc -l | tail -1
codegraph status
```

然后把得到的数字回填 plans/00-overview.md §1 与 plans/01-phase0-baseline-freeze.md §1 的对应行，再进入 Phase 1 Step 1（冻结 live Skill 清单）。
