# Phase 1: Skill-First 能力层收口

> **版本**: 2.1.1  
> **日期**: 2026-07-11  
> **目标**: 角色行为进入 Skill，弱模型执行质量由 Skill、TodoWrite、quality signal、QoderWork watcher 共同兜底。

---

## 0. Live 审核状态（2026-07-11）

**结论**: Phase 1 主体已落地，关键词回归矩阵已有独立文件并具备 live LLM E2E；但 Findings（F1-F4、F6）仍未收敛，不能写成 full matrix。

| 检查项 | 状态 | 证据等级 | 证据 |
|---|---|---|---|
| Skill 清单 | ✅ 完成 | static/code | 18 个 `SKILL.md` |
| `skill-summary` | ✅ 完成 | **live LLM E2E** | 2026-07-11 真实 serve (4096) 24/24 session 命中 `SKILL-SUMMARY-INJECTED`（agent 解析为 Orchestrator） |
| 旧 preflight/preamble | ✅ active policy 已清 | static/code | active 搜索仅剩否定性 legacy 引用 |
| `preflight-lite` 工作流 | ✅ 已更新 | static/code | `SKILL.md` 当前 14 步 + framework maintenance write flow |
| MCP role filter | ✅ 已降级 | static/code | `mcp-role-filter.ts` 文件头标为 legacy/future；CodeGraph 只显示文件节点 |
| QoderWork watcher | 🟡 代码/契约已落地 | static/code | `documents/qoderwork-watcher-contract.md` + `scripts/qoder-watcher.ts`；框架侧四类 JSONL 有写入方 |
| 中英文关键词回归 | ✅ **live LLM E2E** | live serve (24 真实 session) | `e2e/skill-summary-keyword-regression.md` 已升级：12 意图 ×(CN+EN) 双语 + 2026-07-11 **真实 serve E2E** actual（SID 见文档明细）；发现 4 行 CN≠EN 不一致（F1-F4）+ live 捕获漂移（F6） |

---

## 1. 当前事实

| 项 | 当前状态 |
|---|---|
| Skill 数 | 18 |
| universal Skill | `preflight-lite` |
| system handler | `anti-bypass`, `skill-summary` |
| recent message bridge | `plugins/session.ts` 捕获文本，`skill-summary.ts` 读取 |
| Orchestrator cold start | `coldStartDbFallback(sessionID)` 兜底 |
| Skill audit | `skill-audit` after handler active |
| Skill warn | `skill-policy` before handler active |
| TodoWrite governance | `quality-contract` after handler active |
| active preamble | 已移除，不进入 `prompt-builder.ts` |
| legacy preamble | `.opencode/legacy/subagent-preamble.md` 只保留历史参考 |
| MCP role filter | `service/context/mcp-role-filter.ts` 当前无 active caller |

---

## 2. 固定实施步骤

### Step 1: 冻结 live Skill 清单

运行：

```bash
cd /home/zhaoge/workspace/opencode/work-one
find .opencode/skills -maxdepth 2 -name SKILL.md | sort
```

把输出写入阶段记录。Skill 数必须是 18。新增能力先进入 Skill，不新增自定义 agent prompt。

### Step 2: 建立关键词回归样例

已建立并维护 `e2e/skill-summary-keyword-regression.md`（2026-07-11 升级为**中英文双语** + live 回填，证据等级 **live LLM E2E**）。原 12 条意图如下（注意：live 实测发现部分意图未被 keyword 触发或有 CN≠EN 不一致，详见该文件 Findings 节 F1-F4）：

1. 需求不清澄清任务 -> `brainstorming`
2. 源码修改任务 -> `codegraph-first`
3. 框架 hook 任务 -> `customize-opencode` + `codegraph-first`
4. dispatch 子任务 -> `dispatch-protocol`
5. 交付验收任务 -> `deliverable-contract`
6. CI/CD 任务 -> `ci-cd-guardrails`
7. 数据库迁移任务 -> `cicd-database-seeding`
8. 外部 API 当前行为任务 -> `context7-first`
9. 复杂根因调查任务 -> `investigation-evidence`
10. 多源文档冲突任务 -> `explore` + `investigation-evidence` + `context7-first`
11. 框架维护写入任务 -> `preflight-lite` + `codegraph-first` + framework maintenance grant flow
12. trivial 问答任务 -> 只加载 `preflight-lite`

每条样例记录：prompt、expected skills、actual skills、runtime log path、结论等级。

### Step 3: 验证 `skill-summary`

运行真实 session 后检查日志：

```bash
cd /home/zhaoge/workspace/opencode/work-one
grep -R "SKILL-SUMMARY-INJECTED\|keywordGroups\|knowledge_freshness_decision\|todo_policy_decision\|scout_escalation_suggested" .task_temp/_logs | tail -80
```

完成门槛：
- `keywordGroups` 对 6 组任务非空。
- `skill-summary` 只注入最多 8 个摘要（当前 `topSkills.slice(0,8)`）。
- 日志包含命中原因和风险分类。
- Orchestrator 首轮请求先走 bridge，bridge 为空时走 DB fallback。

### Step 4: 清理旧 preflight 与 preamble 引用

运行：

```bash
cd /home/zhaoge/workspace/opencode/work-one
rg -n "execution-preflight-check|subagent-preamble|P0 Protocol|Step 0d|Step 0e|compliance gate.*must|Task.DAG.*must" .opencode AGENTS.md opencode.json
```

处理规则：
1. active prompt、active Skill、active rule 中的旧 hard gate 语义全部删除。
2. legacy 文档保留时在文件头写明 `Legacy reference, not active policy`。
3. `prompt-builder.ts` 保持不读取 preamble。
4. `preflight-lite/FULL.md` 保持 reference 文档定位，普通任务不强制读取全文。

### Step 5: 固定 `preflight-lite` 工作流

`preflight-lite/SKILL.md` 当前固定包含 14 步，并追加 framework maintenance 写入流程：

1. 一句话复述目标。
2. 标注 risk：trivial / standard / high-risk / blocked。
3. standard 创建 3-5 个行动 todo。
4. high-risk 创建 5-8 个行动 todo，包含 evidence、rollback、validation、handover。
5. blocked 创建 blocked todo 并调用 `question`。
6. 调查/审计/调试类任务至少交叉检查代码、日志、状态源。
7. 框架/agent/plugin/permission 任务先读权威配置文件。
8. 每次写入和验证都对应当前 `in_progress` todo。
9. 工具失败后先更新 todo recovery intent。
10. 结论前收集最小本地证据。
11. 需求不清或风险高时先调用 `question` / QoderWork。
12. 写入前依赖 active hook 做 scope / CodeGraph / permission，不绕过。
13. 需要 Scout/research 时直接用 native Task，不依赖 legacy preamble 或 `dispatch_subagent` wrapper。
14. 小型安全任务不进入 DAG / gate / checklist。

框架维护写入额外固定流程：grant + CodeGraph query/impact + `framework_maintenance_plan` + `safe_framework_edit` + `framework_maintenance_complete`。

### Step 6: 废弃未接线 MCP role filter 能力声明

当前 `service/context/mcp-role-filter.ts` 无 active caller。执行：

```bash
cd /home/zhaoge/workspace/opencode/work-one
rg -n "mcp-role-filter|filterMcp|role filter" .opencode
```

实施动作：
1. 文档中删除“已接线 MCP role filter”表述。
2. 将该文件标注为 legacy/future 代码，不计入当前能力。
3. `tool-def-trimmer.ts` 继续只声明 schema slimming 职责。
4. 验收前不得把 MCP role filter 写成 PASS。

### Step 7: 落地 QoderWork watcher 事件契约

框架侧统一写四类 JSONL：

| 文件 | 事件 |
|---|---|
| `.task_temp/_logs/audit.jsonl` | tool result、path、grant、backup |
| `.task_temp/_logs/quality.jsonl` | skipped skill、todo stale、verification missing |
| `.task_temp/_logs/skill.jsonl` | loaded skill、attestation |
| `.task_temp/_logs/guidance.jsonl` | question、prompt_async guidance、abort |

QoderWork 侧实现 R1-R7：

| 规则 | 触发 |
|---|---|
| R1 repeated_failure | 30 分钟内同 session 3 次 tool error |
| R2 skipped_brainstorming | 含糊任务直接写入 |
| R3 skipped_skill | 写入前缺任务匹配 Skill |
| R4 todo_stall | 10 分钟无 todo 更新 |
| R5 no_verification | 编辑后没有验证事件 |
| R6 break_glass_usage | 出现 break-glass 事件 |
| R7 quality_degradation | R1/R2/R3 任意两项同 session 出现 |

介入通道固定为：
- 普通指导：`POST /session/{SID}/prompt_async`，body 带当前 agent。
- question 回复：`POST /question/{QID}/reply`。
- 止损：`POST /session/{SID}/abort`。

---

## 3. Phase 1 完成门槛

- [x] 12 条中英文关键词回归已记录 expected/actual（bilingual + live 回填，runtime smoke；详见 `e2e/skill-summary-keyword-regression.md` 的 F1-F4 发现）
- [x] `skill-summary` 6 组关键词 matcher 已在代码中，且运行注入有 runtime smoke 证据。
- [x] 旧 `execution-preflight-check` 引用从 active policy 删除。
- [x] 旧 preamble 引用从 active prompt、active Skill、active rule 删除。
- [x] `preflight-lite` 14 步工作流进入 `SKILL.md`。
- [x] `mcp-role-filter` 不再被文档写成已生效能力。
- [x] R1-R7 watcher 事件能从 JSONL 触发。（code-level；`guidance.jsonl` 文件为事件触发后生成）
- [x] TodoWrite 保持 soft-governance，不写 DB checklist，不生成 DAG。
- [x] 框架维护 Skill 提示包含 grant + CodeGraph + plan + write + complete。
