# Phase 4: Minimal State 与 DB Hot-Path Slimming

> **版本**: 2.1.1  
> **日期**: 2026-07-11  
> **目标**: DB 保留恢复、桥接、安全关键状态；普通质量审计进入 JSONL。

---

## 0. Live 审核状态（2026-07-11）

**结论**: Phase 4 的代码/组件主体已完成：权威 DB 为 v37，JSONL 写入基础设施与 emitters 存在，hot-path DB touch 已有 runtime smoke。仍需注意：磁盘上存在惰性 DB 副本，`/children` fallback 只见 404 证据；`state-tiering.md` 已于 2026-07-11 重写为 v37 7-tier。

| 检查项 | 状态 | 证据等级 | 证据 |
|---|---|---|---|
| DB 权威源 | ✅ runtime authority 完成 | static/code | 运行时代码引用 `.opencode/state/framework-state.db`；schema v37 |
| 惰性 DB 副本 | ⚠️ 存在但归档/阻断 | static/code | `.trash-db/README.md`；`.opencode/state.db` 等路径在 policy 中 blocked |
| JSONL audit | ✅ 代码完成 | static/code | `jsonl-writer.ts` 支持 audit/quality/skill/guidance；各 handler 有 `writeJsonl(...)` 调用 |
| JSONL runtime artifact | 🟡 部分完成 | runtime artifact | 当前存在 audit/quality/skill；`guidance.jsonl` 为 guidance 触发后生成 |
| hot-path DB touch | ✅ 完成 | runtime smoke | runtime smoke T7：只读路径 DB 计数不变 |
| `/children` fallback | 🟡 部分完成 | runtime smoke + static/code | 404 graceful + DB fallback 代码存在；HTML/non-JSON 独立故障注入未见证据 |
| Critical 状态矩阵 | ✅ 完成 | component + runtime smoke | boundary matrix 8/8 + `framework-maintenance.test.ts` 13/13 |
| Deprecated 表停写 | ✅ 完成 | static/code | audit/deprecated candidate tables 为空或缺失；dispatch_attempts=0 |

---

## 1. 当前 DB 基线

| 项 | 当前值 |
|---|---|
| 主 DB | `.opencode/state/framework-state.db` |
| schema | v37 |
| tables | 49 business / 50 total |
| Critical grant table | `dispatch_privilege_grants` |
| Framework plan table | `framework_maintenance_plans` |
| Gate context table | `gate_call_context` |
| Session lineage | `session_registry`, `session_events`, `session_map` |
| Checklist tables | 存在，仅高风险任务使用 |
| Repo grant tables | `repo_operation_grants`, `repo_operation_events` |

---

## 2. 状态分层

| Tier | 状态 | 存储 |
|---|---|---|
| Critical | backup, dispatch privilege, framework maintenance plan, guidance, gate call context | DB |
| Bridge | session lineage, dispatch prompt refs, gate sessions, question/guidance | DB + JSONL mirror |
| Observable | skill usage, quality signal, route suggestion, tool audit | JSONL + sampled DB index |
| Ephemeral | TodoWrite active state | native session/tool state + JSONL |
| High-risk only | execution_checklist tables | DB |
| Cold | knowledge materialization, snapshots, compactor | background DB |
| Deprecated | old snapshot/index/drained tables | stop-write -> shadow-read -> delete |

---

## 3. 固定实施步骤

### Step 1: 固定 DB 权威源

运行：

```bash
cd /home/zhaoge/workspace/opencode/work-one
find .opencode -name '*.db' -o -name '*.db-wal' -o -name '*.db-shm' | sort
rg -n "framework-state.db|opencode.db|substate_kv.db|framework_state.db" .opencode scripts package.json
```

实施动作：
1. 运行时代码只读写 `.opencode/state/framework-state.db`。
2. `.opencode/state/framework-state.db-wal` 与 `.opencode/state/framework-state.db-shm` 记录为 SQLite 附件。
3. `.opencode/.trash-db/` 写入 README，声明历史归档。
4. 统计脚本排除 `.trash-db`。

### Step 2: 实测 hot-path DB touch

为普通 safe_edit、safe_shell、TodoWrite、read-only tool 分别跑一次 runtime smoke。每次记录：

| 字段 | 记录内容 |
|---|---|
| tool | 工具名 |
| before handlers | 实际执行列表 |
| after handlers | 实际执行列表 |
| delegate checks | read-track/scope/codegraph/format/tdd |
| DB tables touched | 表名 |
| JSONL files touched | 文件名 |
| hard block | yes/no |
| runtime result | PASS/FAIL |

完成门槛：
- 普通 read-only tool 不写 DB。
- 普通 safe_edit 不写 dispatch_queue。
- TodoWrite 不写 execution_checklist tables。
- framework maintenance 写入只触碰 grant/plan/audit/backup 必要状态。

### Step 3: 落地统一 JSONL audit

固定文件：

```text
.task_temp/_logs/audit.jsonl
.task_temp/_logs/quality.jsonl
.task_temp/_logs/skill.jsonl
.task_temp/_logs/guidance.jsonl
```

统一字段：

```json
{"ts":0,"session_id":"","agent":"","tool":"","event":"","severity":"","path":"","rule_id":"","result":"","detail":""}
```

规则：
1. Critical DB 写失败时阻断。
2. Observable JSONL 写失败时写 runtime warning，不阻断普通任务。
3. High-risk checklist 写失败时阻断对应高风险任务。
4. 普通质量信号不写成 hard block。

### Step 4: 验证 `/children` fallback

固定故障注入：

1. 启动 minimal proxy，使 `/session/{sid}/children` 返回 404。
2. 运行 `session-tree.ts` 查询同一 root session。
3. 确认脚本 fallback 到 `session_registry.parent_session_id`。
4. 再注入 HTML 响应。
5. 再注入 non-JSON 响应。
6. 三次都输出同一棵 session tree。

完成门槛：
- 404、HTML、non-JSON 三种失败都有记录。
- fallback 查询只读 framework DB。

### Step 5: 验证 framework maintenance Critical 状态

边界矩阵：

| Case | 预期 |
|---|---|
| no grant | hard block |
| grant unbound | hard block |
| grant expired | hard block |
| grant revoked | hard block |
| grant consumed | hard block |
| no active plan | hard block |
| path outside plan | hard block |
| path outside grant allowlist | hard block |
| write budget exhausted | hard block |
| complete then write | hard block |
| grant + CodeGraph + plan + allowed path | write PASS |

记录表：
- `dispatch_privilege_grants`
- `framework_maintenance_plans`
- `backup_log`
- `audit_log`

### Step 6: 停止无效 DB 写

执行：

```bash
cd /home/zhaoge/workspace/opencode/work-one
rg -n "execution_checklist_runs|execution_checklist_items|execution_checklist_events|gate_audit_history|audit_trail|read_audit" .opencode
```

实施动作：
1. 普通任务不创建 checklist run。
2. TodoWrite 不创建 checklist item。
3. quality signal 写 JSONL。
4. read audit 保持 Observable。
5. deprecated 表先 stop-write，再 shadow-read，再删除。

---

## 4. Phase 4 完成门槛

- [x] DB 权威源只有 `.opencode/state/framework-state.db`。（runtime authority；磁盘惰性副本另列归档/阻断）
- [x] `.trash-db` 有 README，统计脚本已排除。
- [x] hot-path DB touch 表已记录。
- [x] 统一 JSONL audit 四文件可 tail/parse。（code-level；`guidance.jsonl` 需触发 guidance 后生成）
- [ ] `/children` fallback 三种故障注入通过。（已见 404 graceful；HTML/non-JSON 仍待补独立证据）
- [x] framework maintenance Critical 状态边界矩阵通过。
- [x] Critical/Bridge/Observable/Ephemeral/High-risk only/Cold/Deprecated 分层写入文档。（`state-tiering.md` 已于 2026-07-11 重写为 v37 7-tier 模型）
- [x] 表合并只处理 Deprecated 层，不删除 Critical 和 Bridge 状态。
