# Phase 0: 基线冻结与事实修正

> **版本**: 2.1.1  
> **日期**: 2026-07-11  
> **目标**: 所有实施动作先绑定当前代码事实，禁止沿用旧评估叙述。

---

## 0. Live 审核状态（2026-07-11）

**结论**: Phase 0 对 `plans/` 的基线冻结已完成；当前工作树仍有历史/归档文档旧快照，但它们已列入修正文档范围，不阻塞本阶段计划继续推进。

| 检查项 | 状态 | 证据 |
|---|---|---|
| CodeGraph 索引 | ✅ up to date | `codegraph sync && codegraph status` |
| live 数字 | ✅ 已重采样 | `.opencode` TS 372 / 75,563 lines；CodeGraph 419 files |
| DB schema / 表 | ✅ v37 / 49 business / 50 total | 只读 SQLite 查询 |
| active handler order | ✅ before 11 / after 7 / system 2 | `.opencode/project.config.json` |
| active agent 边界 | ✅ 5 agent + 1 custom prompt | `opencode.json.agent` + `.opencode/agents` |
| stale work-one docs | ✅ state-tiering.md 已修正（2026-07-11 重写为 v37 7-tier） | 其余历史/归档快照按需清理 |

---

## 1. 当前冻结事实

| 项 | 当前事实 |
|---|---|
| CodeGraph | up to date，419 files / 377 TS / 30 JS / 12 YAML |
| active `.opencode` TS | 372 files / 75,563 lines |
| active agent | `Orchestrator`, `build`, `general`, `plan`, `explore` |
| active prompt | 只有 `.opencode/agents/Orchestrator.md` |
| legacy role profile | 9 个 `.opencode/legacy/agent-profiles/*.md` |
| plugin order | before 11 / after 7 / system 2 |
| before order | gate-call-context, guidance-bridge, task, permission-safety, behavioral-path-guard, scope, path-validate, codegraph, skill-policy, dispatch-signal, tool-governance |
| after order | gate-call-context, unified-audit, skill-audit, quality-contract, dispatch-trace, db-health, guidance-recovery |
| system order | anti-bypass, skill-summary |
| custom tool | 37 |
| Skill | 18 |
| MCP server | 12 |
| DB | schema v37，49 business tables / 50 total |
| framework maintenance | `dispatch_privilege_grants` + `framework_maintenance_plans` + `safe_framework_edit` |
| gate session propagation | `gate_call_context` + before/after `gate-call-context` |

---

## 2. 固定采样命令

在每次修改本计划和实施代码前运行：

```bash
cd /home/zhaoge/workspace/opencode/work-one
codegraph status
rg --files .opencode -g '*.ts' | wc -l
rg --files .opencode -g '*.ts' -0 | xargs -0 wc -l | tail -1
find .opencode/agents -maxdepth 1 -type f -name '*.md' -printf '%f\n'
find .opencode/legacy/agent-profiles -maxdepth 1 -type f -name '*.md' | wc -l
find .opencode/skills -maxdepth 2 -name SKILL.md | wc -l
find .opencode/tools -maxdepth 1 -type f -name '*.ts' | wc -l
find .opencode/plugin-handlers -type f -name '*.ts' ! -path '*/__tests__/*' | wc -l
```

DB 采样命令：

```bash
cd /home/zhaoge/workspace/opencode/work-one
python3 - <<'PY'
import sqlite3
db='.opencode/state/framework-state.db'
con=sqlite3.connect(f'file:{db}?mode=ro', uri=True)
cur=con.cursor()
print('schema', cur.execute('select max(version) from schema_version').fetchone()[0])
tables=[r[0] for r in cur.execute("select name from sqlite_master where type='table' order by name")]
print('tables_total', len(tables))
print('tables_business', len([t for t in tables if t!='sqlite_sequence']))
for t in ['dispatch_privilege_grants','framework_maintenance_plans','gate_call_context','session_registry','session_events']:
    cols=[r[1] for r in cur.execute(f'pragma table_info({t})')]
    print(t, ','.join(cols))
con.close()
PY
```

---

## 3. 必改文档范围

按当前事实更新以下文档中的旧数字和旧状态：

1. `qoderwork/plans/*.md`
2. `qoderwork/documents/opencode-framework/*.md`
3. `qoderwork/documents/review/opencode-framework-architecture-assessment.md`
4. `work-one/.opencode/docs/framework-metrics.md`
5. `work-one/.opencode/docs/final-validation-report.md`
6. `work-one/.opencode/docs/state-tiering.md`
7. `work-one/.opencode/docs/agent-alias-map.md`
8. `work-one/.opencode/rules/**` 中仍写旧 hard gate、旧 preamble、旧 mode 的文件

---

## 4. 叙述替换表

| 旧叙述 | 当前写法 |
|---|---|
| 14 before + 13 after | active order 是 before 11 / after 7 / system 2 |
| 65K 行、308 TS 文件 | `rg` 当前口径是 372 TS / 75,563 行 |
| active `build.md` stub | active `.opencode/agents/` 只有 `Orchestrator.md` |
| DB schema v34 / 45 表 | live DB 是 schema v37 / 49 business / 50 total |
| `safe_framework_edit` 只需要 grant + CodeGraph | 还必须先调用 `framework_maintenance_plan` |
| `question` 只有 static PASS | question/reply/recovery/guidance 已有 runtime smoke；Phase 5 仍需 full matrix 归档 |
| `alias_of` 可桥接 native agent | `alias_of` 是 legacy metadata，runtime 不消费 |
| Scout 是 active agent | 当前 `opencode.json.agent` 没有 `scout` |
| TodoWrite 可同步 DB checklist | TodoWrite 只做工作记忆和 soft-governance |
| MCP role filter 已生效 | 当前无 active caller，能力声明必须删除到 future/legacy 区域 |

---

## 5. 证据等级

所有 PASS 结论必须标注一个等级：

| 等级 | 含义 |
|---|---|
| static/code | 文件、配置、函数存在 |
| component | 单模块测试和脚本验证 |
| runtime smoke | serve API 驱动的真实 runtime 小矩阵通过 |
| live LLM E2E | 真实 Orchestrator/child agent 链路通过 |
| full matrix | 边界矩阵全部通过 |

禁止把 static/code 写成 runtime smoke，禁止把 runtime smoke 写成 full matrix。

---

## 6. Phase 0 完成门槛

- [x] 所有计划文件的当前数字已更新到 2026-07-11 基线。
- [x] 所有计划文件都记录 `gate-call-context` before/after active 状态。
- [x] 所有计划文件都记录 DB schema v37 和 `framework_maintenance_plans`。
- [x] 所有计划文件都删除 `safe_framework_edit` 无 plan 的旧流程。
- [x] 所有计划文件都不把 `scout` 写成 active agent。
- [x] 所有 PASS 结论都有证据等级。
- [x] `work-one` 内 stale docs 已列入修正文档范围。
