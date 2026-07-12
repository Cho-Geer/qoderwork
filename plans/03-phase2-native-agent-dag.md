# Phase 2: Native Agent 与 DAG 解耦

> **版本**: 2.1.0  
> **日期**: 2026-07-11  
> **目标**: 普通任务走 native Task；DAG 只做大型任务 artifact、resume trace、QoderWork metadata。

---

## 0. Live 审核状态（2026-07-11）

**结论**: active agent 边界、no-DAG native path、session lineage、legacy dispatch validator 隔离均已通过代码/运行证据；`dispatch_subagent` 仍保留兼容 wrapper，未物理退场。

| 检查项 | 状态 | 证据等级 | 证据 |
|---|---|---|---|
| active agent boundary | ✅ 完成 | static/code | `opencode.json.agent` = Orchestrator/build/general/plan/explore；`.opencode/agents` 仅 `Orchestrator.md` |
| native Task no-DAG | ✅ 完成 | runtime smoke | runtime smoke T2 |
| session lineage | ✅ 完成 | runtime smoke | runtime smoke T3；`session_registry` / `session_events` 存在 |
| legacy dispatch validator | ✅ 完成 | static/code | `dispatch-validate.ts` 与 `before/dispatch.ts` 文件头标 legacy；active before order 不含 `dispatch` |
| `dispatch-sa-repair` | ✅ 完成 | static/code | `.opencode` 内无 `dispatch-sa-repair` 引用 |
| Scout-equivalent | ✅ 完成 | runtime smoke | runtime smoke T4；无 active `scout` agent，使用 `explore` + research skills |
| `dispatch_subagent` 退场 | 🟡 部分完成 | runtime smoke | 普通路径不再要求 wrapper，但工具仍存在并在 smoke 中用于兼容 dispatch |

---

## 1. 当前事实

| 项 | 当前状态 |
|---|---|
| active agent | Orchestrator/build/general/plan/explore |
| active custom prompt | Orchestrator only |
| legacy role profile | 9 |
| `alias_of` | legacy metadata，runtime 不消费 |
| `dispatch_policy.require_dag_entry` | false |
| `dispatch_policy.auto_plan_enabled` | false |
| `before/task.ts` | active，只处理 Task marker、QUEUE_ID、canonical prompt |
| `dispatch_subagent` | ordinary path 退场中，framework maintenance compat path 仍使用 |
| framework maintenance | grant + CodeGraph + `framework_maintenance_plan` + `safe_framework_edit` + complete |
| Scout | 当前没有 active `scout` agent 配置 |

---

## 2. 固定执行路径

普通任务：

```text
Orchestrator
  -> native Task(build/general/plan/explore)
  -> preflight-lite
  -> task-matched Skills
  -> safe tools
  -> session_events / JSONL audit
```

框架维护任务：

```text
Orchestrator
  -> dispatch_subagent with dispatch_privilege=framework_maintenance
  -> child build session
  -> CodeGraph query/impact
  -> framework_maintenance_plan
  -> safe_framework_edit
  -> framework_maintenance_complete
```

复杂调研任务：

```text
Orchestrator
  -> native Task(explore)
  -> investigation-evidence + context7-first
  -> evidence bundle
  -> parent agent adopts evidence
```

---

## 3. 固定实施步骤

### Step 1: 固化 active agent 边界

执行：

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

完成门槛：
- active agent 只有 5 个。
- active prompt 只有 `Orchestrator.md`。
- 9 个旧角色只在 legacy profile 中出现。
- 文档不再写 `alias_of` 可桥接 runtime。

### Step 2: 固化 native Task 无 DAG 路径

运行 serve API smoke，覆盖 build/general/plan/explore：

1. 创建 Orchestrator session。
2. 让 Orchestrator 派发 4 个普通子任务。
3. 每个子任务不提供 `dag_task_id`。
4. 检查 child session 创建、agent 类型、Skill 可见性、结果返回。
5. 检查日志中没有 DAG hard block、auto_plan 等待、preamble 注入。

完成门槛：
- 4 个 native agent smoke 全部 runtime PASS。
- 无 `DISPATCH_TOKEN` 普通路径记录 audit，不 hard block。
- `session_events` 记录 parent/child metadata。

### Step 3: 隔离 legacy dispatch validator

处理文件：
- `.opencode/service/dispatch/dispatch-validate.ts`
- `.opencode/plugin-handlers/before/dispatch.ts`
- `.opencode/service/dispatch/index.ts`

实施动作：
1. 在 `dispatch-validate.ts` 文件头写入 `Legacy validator, not active order`。
2. 在 `before/dispatch.ts` 文件头写入 `Legacy handler, not active order`。
3. 从 active docs 中删除旧 L0-L4 hard-block 叙述。
4. 清理 `service/dispatch/index.ts` 中让维护者误认为 active 的 re-export。
5. `dispatch-sa-repair` rule id 写入 rule table，缺失时删除 caller 分支。

完成门槛：
- `project.config.json.plugin_execution_order.before` 不包含 `dispatch`。
- `before-dispatcher.ts` active `HANDLER_MAP` 不运行旧 dispatch validator。
- `rg "dispatch-sa-repair"` 只显示已注册 rule 和测试。

### Step 4: 保持 DAG 定位

DAG 只写入三类场景：
1. 用户明确要求大型规划 artifact。
2. 长任务 resume/trace。
3. QoderWork 需要跨 session metadata。

实施动作：
- `dispatch_policy.require_dag_entry=false` 保持不变。
- `auto_plan_enabled=false` 保持不变。
- 普通 Task prompt 不要求生成 `Task.DAG.json`。
- 文档中删除“普通 dispatch 依赖 DAG 合法性”的表述。

### Step 5: 迁移 `dispatch_subagent` 责任

按顺序实施：

1. 保持 `dispatch_subagent` 只服务 framework maintenance compat path。
2. 在 Task after/session lifecycle 中写 parent-child lineage 到 `session_events`。
3. 将普通 native Task 的 lineage 读取切到 `session_events`。
4. 为 framework maintenance 增加 native metadata grant binding 测试。
5. 通过测试后，普通任务文档和 Skill 不再提示 `dispatch_subagent`。
6. `dispatch_subagent` 权限保留给 Orchestrator 的 framework maintenance 调度。

完成门槛：
- 普通任务不需要 wrapper。
- framework maintenance compat path 继续 live LLM E2E PASS。
- native metadata 替代 grant binding 有 runtime smoke。

### Step 6: 固化 Scout-equivalent 路径

当前没有 active `scout` agent。复杂调研统一用：

```text
native Task(explore) + investigation-evidence + context7-first
```

输出契约：
- `question`
- `sources_checked`
- `evidence_summary`
- `decision`
- `risks_open_questions`

完成门槛：
- 不向 `opencode.json.agent` 增加 `scout`。
- 复杂调研通过 `explore` 返回 evidence bundle。
- 父 agent 能采纳、拒绝、补问。

---

## 4. Phase 2 完成门槛

- [x] build/general/plan/explore 无 DAG smoke 记录完整。
- [x] 普通 native Task lineage 写入 `session_events`。
- [x] `dispatch-validate.ts` 和 `before/dispatch.ts` 已显式 legacy。
- [x] `dispatch-sa-repair` caller 与 rule table 对齐。
- [x] `Task.DAG.json` 不再是普通 dispatch 前置。
- [ ] `dispatch_subagent` 只保留 framework maintenance compat 责任。（部分完成：普通路径不再要求 wrapper，但工具仍存在且可用于兼容 dispatch）
- [x] `explore + investigation-evidence + context7-first` 复杂调研 smoke 通过。
- [x] framework maintenance native metadata grant binding 有 smoke 证据。
