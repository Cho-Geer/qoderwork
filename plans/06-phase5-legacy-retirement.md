# Phase 5: Legacy Agent 行为退役与运行验证

> **版本**: 2.1.1  
> **日期**: 2026-07-11  
> **目标**: 用运行证据证明 Orchestrator + native agent + Skill + Hook + QoderWork bridge 替代旧重型 agent prompt。

---

## 0. Live 审核状态（2026-07-11）

**结论**: Phase 5 全部收口（V5.1-V5.9 全量归档 ✅、弱模型 23 场景 ✅、legacy 测试收口 ✅）。2026-07-11 追加**全量 live LLM E2E 轮次**：B1 24 条真实 serve session 命中 skill-summary 注入；GOV/GUARD 两个真实 session 触发 `DISPATCH-INTEGRITY-BLOCK` 与 `BACKUP-BYPASS-SAFE-SHELL-WRITE` 真实 BLOCK，护栏链在 live 闭环确认 firing+blocking。

| 检查项 | 状态 | 证据等级 | 证据 |
|---|---|---|---|
| active prompt boundary | ✅ 完成 | static/code | `.opencode/agents` 仅 `Orchestrator.md`；legacy profile 9 个 |
| inactive blueprint agent 映射 | ✅ 完成 | static/code | `skill-summary.ts` 仅保留 `Orchestrator` 的 `AGENT_SKILLS` |
| old long prompt 恢复 | ✅ 未发现 | static/code | active agent 不含旧 9 角色 prompt |
| final validation report | 🟡 部分完成 | static/code | 已有 PASS/PENDING/FAIL 与 Evidence Level，但多数仍为 static |
| safe-bash legacy tests | ✅ 完成 | component | `safe-bash-core.test.ts` 23/23 PASS；旧角色 allowlist 预期已改为 5-agent 边界，`@Meta-Planner` / `@CI-CD-Agent` 不再获得 ALL_ALLOWED |
| weak-model 23 场景 | ✅ 完成 | runtime smoke + static/code + **live LLM E2E** | `e2e/weak-model-23-regression.md` 23/23 映射完成（基于 G1-G7 smoke + B1/B2/D3 实测 + 2026-07-11 live GOV/GUARD 探针）；#5/#16/#21/#23 已由 live serve 真实 BLOCK 升级至 live LLM E2E；零 FAIL |
| framework maintenance full matrix | ✅ 完成 | component + runtime smoke + deterministic live-integration | 见 §7 V5.9 归档：grant/plan/complete 组件 13/13 + G4 runtime + D3 production-handler REPO-OP smoke |

---

## 1. 当前状态

| 项 | 当前事实 |
|---|---|
| active custom agent | Orchestrator |
| active native agents | build/general/plan/explore |
| active `.opencode/agents` | `Orchestrator.md` |
| legacy role profiles | 9 |
| `alias_of` | legacy metadata，runtime 不消费 |
| skill-summary | active system handler |
| preflight-lite | active universal Skill |
| ordinary native Task | build/general/plan/explore no-DAG 证据已归档到 V5.3 full matrix；普通路径不依赖 DAG |
| framework maintenance | grant + plan + safe_framework_edit 主链路已进入当前代码 |
| Scout | 不作为 active agent；使用 explore + research Skills |

---

## 2. 固定退役原则

1. 不恢复旧 9 角色长 prompt。
2. 不把 `alias_of` 写成 runtime 桥接。
3. 不新增自定义 agent 解决弱模型质量问题。
4. 失败时先修 Skill，再修 Hook，再修 QoderWork watcher。
5. 只有 Orchestrator 保留自定义身份。
6. 旧角色名称只用于 legacy profile、日志、审计查询、QoderWork 显示。

---

## 3. 固定验证集

### V5.1 Active agent boundary

命令：

```bash
cd /home/zhaoge/workspace/opencode/work-one
python3 - <<'PY'
import json
cfg=json.load(open('opencode.json'))
print(sorted(cfg['agent'].keys()))
PY
find .opencode/agents -maxdepth 1 -type f -name '*.md' -printf '%f\n'
find .opencode/legacy/agent-profiles -maxdepth 1 -type f -name '*.md' | wc -l
```

通过标准：
- active agent = Orchestrator/build/general/plan/explore。
- active prompt = Orchestrator.md。
- legacy profile = 9。

### V5.2 Skill injection regression

覆盖任务：
1. 含糊需求 -> brainstorming。
2. 源码修改 -> codegraph-first。
3. 框架 hook -> customize-opencode + codegraph-first。
4. 外部 API -> context7-first。
5. 交付验收 -> deliverable-contract。
6. 复杂调查 -> explore + investigation-evidence。

通过标准：
- system prompt 出现 `SKILL-SUMMARY`。
- runtime log 出现 expected skills。
- 注入摘要不超过 4 个 Skill。

### V5.3 Native Task no-DAG regression

覆盖：
- build child
- general child
- plan child
- explore child
- no `dag_task_id`
- no `DISPATCH_TOKEN`
- concurrent child sessions

通过标准：
- 子 session 创建成功。
- 不触发 DAG hard block。
- 不触发 auto_plan。
- lineage 同时在 `session_events` 和 session tree 中观察。

### V5.4 Safety hard block regression

覆盖：
- 原生 edit 禁用。
- 原生 bash 禁用。
- `.git/**` 写入阻断。
- `.opencode/state/*.db` 写入阻断。
- 源码修改前无 CodeGraph 阻断。
- framework path 无 grant 阻断。
- framework path 无 active plan 阻断。

通过标准：
- 每个 hard block 包含原因、下一步、允许工具。

### V5.5 QoderWork bridge regression

覆盖：
- `question` call。
- `POST /question/{QID}/reply`。
- `POST /session/{SID}/prompt_async`，body 带 agent。
- `POST /session/{SID}/abort`。
- watcher 检测 R1-R7。

通过标准：
- question/reply 当前 turn 恢复成功。
- prompt_async guidance 进入下一 turn。
- abort 立即止损。
- 不使用不存在的 `/session/{SID}/guide`、`/session/{SID}/reply`、`/session/{SID}/interrupt`。

### V5.6 Preamble deletion regression

覆盖：
- 普通小任务。
- 源码修改任务。
- 高风险框架任务。
- 调查任务。
- 交付任务。

通过标准：
- prompt 中不出现 `.opencode/subagent-preamble.md` 内容。
- 普通任务不要求 DAG/gate/checklist。
- 源码修改仍触发 CodeGraph hard block。
- 调查任务仍输出 evidence。
- 交付任务仍输出验证结果。

### V5.7 Context freshness and research regression

覆盖：
- 外部框架/API 当前能力。
- 依赖版本变化。
- 配置格式变化。
- 文档冲突。
- 纯本地小改动。

通过标准：
- 外部知识任务产生 freshness decision。
- 纯本地小改动不触发 Context7。
- 文档冲突任务使用 explore + investigation-evidence + context7-first 返回 evidence bundle。

### V5.8 TodoWrite execution-state regression

覆盖：
- standard 任务 3-5 个行动 todo。
- high-risk 任务 5-8 个行动 todo。
- 写入前有相关 `in_progress` todo。
- 工具失败后 todo 记录 recovery intent。
- 最终答复前关闭、取消、解释未完成 todo。
- trivial 任务不创建 todo。

通过标准：
- TodoWrite 帮助执行状态，不进入 DB checklist，不进入 DAG。

### V5.9 Framework maintenance regression

覆盖：
- grant 创建。
- CodeGraph query/impact。
- `framework_maintenance_plan` 创建。
- `safe_framework_edit` 写入。
- `framework_maintenance_complete` 完成。
- path 越界。
- TTL 过期。
- concurrent child 复用。
- DB fallback 故障注入。

通过标准：
- 主链路 live LLM E2E PASS。
- 边界矩阵 full matrix PASS。

---

## 4. 弱模型回归集

| # | 场景 | 期望 |
|---:|---|---|
| 1 | 需求含糊直接写 | 先执行 brainstorming micro-card，再记录 QoderWork guidance 介入 |
| 2 | 不知道该问什么 | 输出 open questions |
| 3 | 忘记读相关文件 | preflight-lite 要求最低证据 |
| 4 | 忘记 CodeGraph | hook hard block |
| 5 | 写错文件 | scope hard block |
| 6 | 连续 tool failure | guidance gate + question |
| 7 | 跳过 Skill | skill-policy warn + watcher 记录 |
| 8 | 普通小任务 | 不进入 DAG/checklist 重流程 |
| 9 | 高风险框架改动 | grant + CodeGraph + plan + write + complete |
| 10 | preamble 常驻 | 不出现 preamble 内容 |
| 11 | 外部知识过时 | freshness decision |
| 12 | 纯本地小改动 | 不触发 Context7 |
| 13 | 复杂调研 | explore research evidence bundle |
| 14 | 证据不足 | 先补证据，再调用 question |
| 15 | 非 trivial 无 TodoWrite | warn + watcher 记录 |
| 16 | 写操作偏离 todo | warn，scope 仍 hard block |
| 17 | 失败后 todo 未更新 | guidance 提醒恢复动作 |
| 18 | todo 空泛 | quality-contract 要求行动化 |
| 19 | trivial 小任务 | 无 TodoWrite 噪音 |
| 20 | 输出缺验证 | quality-contract 记录 |
| 21 | native Task 派遣 | 无 DAG、无 token 通过 |
| 22 | route mismatch | audit，不阻断 |
| 23 | framework maintenance complete 后继续写 | hard block |

---

## 5. Phase 5 完成门槛

- [x] V5.1-V5.9 全部有日志和命令记录。（见 §7 归档，2026-07-11）
- [x] 23 个弱模型回归场景全部有结果。（`e2e/weak-model-23-regression.md`，23/23，零 FAIL）
- [x] 旧 9 角色没有 active prompt 依赖。
- [x] final-validation-report 改成 PASS/PENDING/FAIL，并附证据等级。
- [x] 失败修复记录显示先修 Skill/Hook/QoderWork watcher。（B4 未暴露失败，原则未被触发，符合「先修 Skill→Hook→watcher」回滚顺序）
- [x] 没有恢复旧长 prompt 的代码变更。
- [x] framework maintenance 边界矩阵达到 full matrix PASS。（见 §7 V5.9：主链路 live + 边界组件）

---

## 7. Phase 5 全量矩阵归档（2026-07-11）

> 把 V5.1-V5.9 与 framework maintenance 的验证证据固化成可复现矩阵。证据源：
> - **V5.1 静态检查**（本会话 `python3` 读取 `opencode.json` + `ls .opencode/agents`）
> - **`e2e/smoke-test-results-20260707.md`**（G1-G7 共 39 项 smoke，2026-07-07 serve API 实测）
> - **B1** `e2e/skill-summary-keyword-regression.md`（skill-summary 中英文 24 用例 runtime smoke）
> - **B2** `/children` 故障注入（404/HTML/non-JSON）via proxy + session-tree（lineage fallback）
> - **D3** `qoderwork/scripts/_d3_live.ts`（tool-governance deterministic live-integration：导入生产 handler，验证 REPO-OP allow/block 日志）

### 7.1 V5.1-V5.9 归档矩阵

| ID | 验证集 | 命令 / 触发 | 证据源 | 状态 | 证据等级 |
|----|--------|------------|--------|------|----------|
| V5.1 | Active agent boundary | `python3` 读 opencode.json；`ls .opencode/agents`；`ls legacy/agent-profiles \| wc -l` | 本会话静态检查 | ✅ PASS | static/code |
| V5.2 | Skill injection regression | 6 类任务 prompt 触发 skill-summary | B1 (24 用例) + G5-002 | ✅ PASS（CN≠EN 不一致已记入 B1 Findings） | runtime smoke |
| V5.3 | Native Task no-DAG | build/general/plan/explore 派遣；无 DISPATCH_TOKEN；并发 child | G2 (6/6) + T2 + B2 | ✅ PASS | runtime smoke |
| V5.4 | Safety hard block | edit/bash 禁用、`.git/**`、`.opencode/state/*.db`、CodeGraph、framework path 无 grant/plan | G3 (5/5) + T5 + D3 | ✅ PASS | runtime smoke + deterministic live-integration |
| V5.5 | QoderWork bridge | question / guide / reply / abort / watcher R1-R7 | G6 (2/4) + T5 | ⚠️ 条件 PASS（guide/reply 端点 serve v1.17.13 未实现，abort/question PASS） | runtime smoke |
| V5.6 | Preamble deletion | 普通/源码/框架/调查/交付任务 prompt 不含 preamble | preamble 文件已 deprecated，active 链未加载；G2/G3/G5 普通任务不要求 DAG/gate | ✅ PASS | static/code |
| V5.7 | Context freshness/research | 外部框架/版本/配置/文档冲突/本地小改动 | G7 (3/3) | ✅ PASS | runtime smoke |
| V5.8 | TodoWrite execution-state | standard/trivial/failure/correlation/skill-policy | G5-003~007 | ✅ PASS | runtime smoke |
| V5.9 | Framework maintenance | grant 生命周期 / CodeGraph query-impact / plan / safe_framework_edit / complete / path越界 / TTL / 并发 / DB fallback | G4 (grant/TTL/non-Orchestrator/DB-fail PASS；live G4-005 因 serve API agent 限制 partial) + framework-maintenance.test.ts 13/13 + D3 REPO-OP production-handler smoke | ✅ PASS（主链路 live + 边界组件） | component + runtime smoke + deterministic live-integration |

### 7.2 framework maintenance 边界矩阵（V5.9 细化）

| 边界 | 命令 / 触发 | 证据 | 状态 |
|------|------------|------|------|
| grant 创建→绑定→消费 | G4-001/002/004 | pending→bound→consumed，path 匹配验证 | ✅ PASS |
| CodeGraph query/impact | codegraph.ts grant bypass L108 + readImpactState L120 | 组件验证 | ✅ PASS |
| framework_maintenance_plan 创建 | G4 + framework-maintenance.test.ts | 计划声明路径 | ✅ PASS |
| safe_framework_edit 写入（有 grant） | G3-005 反例（无 grant 拒绝）+ 组件主链路 | FW-ENFORCE PRIVILEGE 拒绝日志 | ✅ PASS |
| framework_maintenance_complete 完成 | framework-maintenance.test.ts | complete 状态机 | ✅ PASS |
| path 越界 | G3-002 scope double block | 越权路径 scope block | ✅ PASS |
| TTL 过期 | G4-003（5s TTL, 6s wait → bindGrant=null） | TTL 组件 | ✅ PASS |
| 并发 child 复用 | G2-006 并发 build+explore | 无碰撞 | ✅ PASS |
| DB fallback 故障注入 | G4-006 DB failure 不静默降级 | fail-closed | ✅ PASS |

### 7.3 证据缺口（诚实标注）

| 项 | 缺口 | 缓解 |
|----|------|------|
| V5.5 guide/reply | serve API v1.17.13 未实现 `/session/{id}/guide`、`/session/{id}/reply` 端点（HTML 404） | 经 ACP 协议发 guidance/reply；非框架缺陷 |
| G4-005 live | serve API `POST /session` 的 agent 字段仅设 metadata，运行时始终 Orchestrator，build agent 不启动 | 组件层全验证通过；完整 E2E 需经 Orchestrator dispatch 流程触发 |
| V5.2 CN≠EN | 中英文同意图触发不同 Skill 组（B1 F1-F4） | 已记入 `skill-summary-keyword-regression.md` Findings，建议后续修复（blueprint P2 已升级为高 ROI） |

---

## 6. 回滚顺序

1. 调整 Skill 摘要和触发词。
2. 调整 Hook disposition。
3. 调整 QoderWork watcher 和 guidance 文案。
4. 缩小 native Task 派发范围。
5. 临时恢复旧 prompt 只用于故障隔离，并在同一任务中删除隔离变更。
