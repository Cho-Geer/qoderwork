# OpenCode 框架简化实施计划 — 总览

> **版本**: 2.1.2  
> **日期**: 2026-07-11  
> **目标项目**: `/home/zhaoge/workspace/opencode/work-one`  
> **依据**: 当前工作树、CodeGraph status、`blueprints/blueprint-opencode-framework-simplification-roadmap.md`

---

## 0. Live 实施状态（2026-07-11 交叉审核）

| 范围 | 当前状态 | 证据等级 | 代码/日志证据 | 仍需跟进 |
|---|---|---|---|---|
| Phase 0 基线冻结 | ✅ 已完成 | static/code | CodeGraph up to date；DB schema v37；active order before 11 / after 7 / system 2 | `work-one/.opencode/docs/state-tiering.md` 已重写为 v37 7-tier（2026-07-11，Phase 0 尾项已闭合） |
| Phase 1 Skill-first | 🟡 主体完成 | live LLM E2E + static/code | `preflight-lite` 14 步 + framework maintenance flow；`skill-summary` active；`e2e/skill-summary-keyword-regression.md` 已存在并回填 24 条真实 serve 结果 | 中英文关键词仍有 4 处 CN≠EN 不一致（F1-F4）+ live 捕获漂移（F6） |
| Phase 2 Native Agent / DAG | 🟡 主体完成 | runtime smoke + static/code | active agent 5 个；无 active `scout`；runtime smoke T2/T3/T4 记录 native/no-DAG/lineage/explore | `dispatch_subagent` 仍保留兼容 wrapper，普通路径退场未物理完成 |
| Phase 3 Enforcement | 🟡 主体完成 | runtime smoke + component | rule-disposition active；dispatcher map 与 order 对齐；`tool-governance` 已接入 before 链；`codegraph.ts` repo-op 主裁决已移入治理域；question recovery smoke 已跑；`safe_shell` protected-path read 只读豁免已修复 | `isWriteAllowed` / `getAgentShellAllowlist` 等 per-agent caller 仍需收口；**`plan: "Meta-Planner"` 映射使 plan 权限走 legacy fallback（2026-07-13 发现，P0）** |
| Phase 4 Minimal State | 🟡 主体完成 | runtime smoke + component | JSONL writer + audit/quality/skill/guidance emitters；Critical matrix 组件测试通过；只读 hot-path 零 DB 写 | `/children` HTML/non-JSON 故障注入未见独立证据；磁盘仍有惰性 DB 副本 |
| Phase 5 Legacy 退役 | ✅ 已完成 | live LLM E2E + static/code + component | active prompt 只有 `Orchestrator.md`；`skill-summary` 已清 9 个 inactive blueprint agent 映射；V5.1-V5.9 全量矩阵已归档 | `final-validation-report` 仍以 static 证据为主，属于后续文档补强项 |
| Tool Governance MVC | 🟡 Phase 0-4 已落地，Phase 5 部分完成 | component + direct tool smoke + static/code | `service/tool-governance/**` 已创建并接入 `tool-governance` before handler；tool-governance 测试 30/30 PASS；`path-validate` 已进入 active before 链并有 10/10 测试；block/allow JSONL 均含 `outcome`；protected-path read direct smoke 已通过 | 真正 Orchestrator -> build live LLM E2E 待补 |

---

## 1. 当前代码基线

本计划以 2026-07-11 当前工作树为准，不沿用 2026-07-07 的旧数字。

| 项 | 当前值 | 采样口径 |
|---|---:|---|
| CodeGraph | 419 files / 377 TS / 30 JS / 12 YAML | `codegraph status` |
| `.opencode` TS 文件 | 388 | `rg --files .opencode -g '*.ts'`（2026-07-13 重采样，原 372） |
| `.opencode` TS 行数 | 77,728 | `rg --files .opencode -g '*.ts' -0 \| xargs -0 wc -l`（原 75,563） |
| active agent | 5 | `opencode.json.agent`: Orchestrator/build/general/plan/explore |
| active custom agent prompt | 1 | `.opencode/agents/Orchestrator.md` |
| legacy role profile | 9 | `.opencode/legacy/agent-profiles/*.md` |
| plugin 入口 | 5 | before/after/system/session/tool-def-trimmer |
| active before chain | 11 | gate-call-context + 10 个治理 handler（含 `path-validate`、`tool-governance`） |
| active after chain | 7 | gate-call-context + 6 个审计 handler |
| active system chain | 2 | anti-bypass, skill-summary |
| plugin-handler 源文件 | 44 | 排除 `__tests__` |
| custom tool | 39 | `.opencode/tools/*.ts`（2026-07-13，原 37） |
| Skill | 18 | `.opencode/skills/*/SKILL.md` |
| MCP server | 12 | `opencode.json.mcp` |
| DB schema | v37 | `.opencode/state/framework-state.db` |
| DB 表 | 49 business / 50 total | total 含 `sqlite_sequence` |

当前新增的 v36/v37 事实必须进入所有阶段计划：
- `dispatch_privilege_grants` 已扩展 `max_writes/writes_used/completed_at`。
- `framework_maintenance_plans` 已存在，`safe_framework_edit` 写入前必须存在 active plan。
- `gate_call_context` 已存在，before/after `gate-call-context` 已进入 active order。
- active `.opencode/agents/` 只剩 `Orchestrator.md`，没有 active `build.md` stub 文件。

---

## 2. 单一路线

目标架构固定为：

```text
QoderWork / User
  -> Orchestrator
  -> native Task: build / general / plan / explore
  -> preflight-lite + task-matched Skills
  -> behavior-based Hook governance
  -> safe tools
  -> minimal DB state + JSONL audit + QoderWork guidance
```

执行边界固定如下：

1. Orchestrator 是唯一实质自定义 agent。
2. 普通执行交给 build/general/plan/explore 原生 agent。
3. 旧 9 个角色只保留为 legacy profile 与审计 metadata。
4. 角色行为进入 Skill，不再进入长 agent prompt。
5. Hook 只处理机器可验证边界：权限、路径、危险 shell、备份、CodeGraph、grant、gate context、审计。
6. 流程质量进入 Skill、TodoWrite、quality signal、QoderWork watcher。
7. DB 保留 Critical/Bridge 状态；普通质量审计写 JSONL。

---

## 3. 全局硬约束

所有阶段必须遵守：

1. 分析和修改 `work-one` 代码前运行 `codegraph status`，修改源码前运行对应 `codegraph query/impact`。
2. 原生 `edit`、原生 `bash` 不作为框架写入通道。
3. 普通文件写入使用 safe 工具；框架路径写入使用 `safe_framework_edit`。
4. 框架维护写入固定顺序：
   1. Orchestrator dispatch 时创建 `dispatch_privilege=framework_maintenance`。
   2. child session 运行 CodeGraph query/impact。
   3. child session 调用 `framework_maintenance_plan`，写入 planned paths 与 CodeGraph targets。
   4. child session 调用 `safe_framework_edit`。
   5. child session 调用 `framework_maintenance_complete`。
5. `safe_framework_edit` 同时需要 active grant、active plan、allowed path、write budget、CodeGraph evidence。
6. `question` 是 guidance 恢复的最低可用通道；普通 guidance 使用 `prompt_async + agent`；止损使用 abort。
7. TodoWrite 不同步到 DB checklist，不转换成 DAG。
8. 不恢复 `advisory/strict/locked` 运行模式；每条规则固定 disposition。

---

## 4. 固定执行顺序

1. Phase 0: 冻结 live metric、DB schema、active handler、agent/skill/tool/mcp 数字。
2. Phase 1: 完成 Skill-first 收口，清理旧 preflight/preamble 叙事，建立中文关键词与 watcher 回归。
3. Phase 2: 固化 native Task 默认路径，隔离 legacy dispatch validator，补 lineage 和 Scout-equivalent 证据。
4. Phase 3: 完成 behavior-based enforcement，替换 per-agent caller，补 question full-runtime 和 grant edge-case。
5. Phase 4: 实测 DB hot-path，落地 JSONL audit，补 DB fallback 与 Critical 状态故障注入。
6. Phase 5: 用运行证据关闭 legacy agent 行为退役，不恢复旧长 prompt。

---

## 5. 分阶段文档

| 阶段 | 文档 | 固定交付 |
|---|---|---|
| Phase 0 | [01-phase0-baseline-freeze.md](./01-phase0-baseline-freeze.md) | 当前事实基线、采样命令、证据等级 |
| Phase 1 | [02-phase1-skill-first.md](./02-phase1-skill-first.md) | Skill 回归、stale 引用清理、QoderWork watcher |
| Phase 2 | [03-phase2-native-agent-dag.md](./03-phase2-native-agent-dag.md) | native Task、lineage、legacy dispatch 隔离 |
| Phase 3 | [04-phase3-enforcement-slimming.md](./04-phase3-enforcement-slimming.md) | rule disposition、per-agent 替换、grant gate |
| Phase 4 | [05-phase4-minimal-state.md](./05-phase4-minimal-state.md) | DB hot-path、JSONL audit、fallback fault injection |
| Phase 5 | [06-phase5-legacy-retirement.md](./06-phase5-legacy-retirement.md) | weak-model regression、legacy prompt 退役证据 |

---

## 6. 总体验收

- [x] `plans/` 内所有当前事实与 2026-07-11 live code 一致。
- [x] 所有阶段都包含命令、文件、完成门槛。
- [x] 所有阶段都不把旧 10 agent 当 active runtime。
- [x] 所有阶段都把 framework maintenance 写入写成 grant + plan + CodeGraph + safe_framework_edit + complete。
- [x] 所有阶段都不把 Scout 写成当前 active `opencode.json.agent`。
- [x] 所有阶段都不把 TodoWrite 写成 DB checklist/DAG 前置。
- [x] 所有阶段都区分 static/code、component、runtime smoke、live LLM E2E、full matrix。
