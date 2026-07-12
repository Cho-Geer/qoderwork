# Live LLM E2E — Case Status Matrix (已跑/未跑/判定)

> Generated: 2026-07-12 00:38 (re-baselined after L1-001 post-fix rerun; canonical baseline = ses_0ae3*)
> Source case list: `e2e/opencode-framework-simplification-e2e-integration-plan.md`
> Evidence basis: `RESULT-SHEET.md`, `OPEN-GAPS.md` (this `_summary/` dir), per-case bundles under `../L1`…`../L7`/`../probe`, and DB direct-query of rerun SIDs.
> Serve: `http://127.0.0.1:4096` (OpenCode 1.17.18). LLM: deepseek-v4-flash (parent), glm-5.2 (explore subagents).
> DB authority: `.opencode/state/framework-state.db` (50 tables, schema v37).

## Status legend

| 执行 (Exec) | 判定 (Verdict) | Meaning |
|---|---|---|
| 已跑 | ✅ LIVE PASS | real Orchestrator/child session + expected behavior witnessed |
| 已跑 | 🟡 LIVE PARTIAL | real session, expected behavior only partially met / deviation |
| 已跑 | ⚪ NOT WITNESSED | ran, but expected behavior NOT observed (LLM avoided the path / no live witness) |
| 已跑 | 🔴 DEVIATION | ran, runtime behaves contrary to plan expectation |
| 未跑 | — | not executed this session |

---

## P0 — Pre-Run Gates

| Case | 断言 | 执行 | 判定 | 证据 / 备注 |
|---|---|---|---|---|
| P0-A | Baseline freeze (CodeGraph clean, TS counts, DB authority) | 已跑 | ✅ PASS | `codegraph status`: 419 files / 4304 nodes, no pending; DB 50 tables v37 |
| P0-B | Runtime harness sanity (serve healthy, `/message` needs JSON) | 已跑 | ✅ PASS | `GET /` → HTTP 200; `/message` requires `Content-Type: application/json` |
| P0-C | Isolation (disposable write paths, read/write separated) | 已跑 | ✅ PASS | write cases targeted disposable probe paths; serialized to avoid saturation |

---

## L1 — Skill-First & Prompt Shaping

| Case | 断言 | 执行 | 判定 | 证据 / 备注 |
|---|---|---|---|---|
| L1-001 | 12 intent × CN/EN skill-summary boost (24 sessions) — **capture-reliability closure** | 已跑 | ✅ PASS | `../L1/L1-001-skill-summary/`；**post-fix canonical baseline（ses_0ae3*，2026-07-12）**。本 case 验证目标 = 捕获可靠性：24/24 注入事件、`resolveAgent`=Orchestrator、24/24 经 `messageSource=bridge` 捕获、0 静默 `none` 丢失、0 `db-fallback` → 原 🔴 DEVIATION 已闭合。关键词语义质量**不属本 case 范围**，历史快照差异已拆为 L1-001A/B/C（见下）。详见 `../L1/L1-001-skill-summary/RESULTS.md` |
| L1-001A | CN/EN 同一意图产出一致 keyword boost（双语语义对齐，F1） | 已跑 | 🟡 LIVE PARTIAL | `../L1/L1-001A-evidence.md`；12 session（A1–A6 × CN/EN），11/12 对齐；A4-CN=architecture/brainstorming vs A4-EN=cicd（EN "build" 多义误命中）→ 双语关键词不一致 OPEN GAP |
| L1-001B | 英文子串误命中修复与回归（F2） | 已跑 | ✅ LIVE PASS | `../L1/L1-001B-evidence.md`；B1–B4；`API`→none（无误命中）、`base`→database（正确路由），子串假阳缺陷已闭合、无回归 |
| L1-001C | library/context7 类意图覆盖（F4） | 已跑 | ✅ LIVE PASS | `../L1/L1-001C-evidence.md`；C1–C4 全 library-dep/context7-first，dependency-library + context7-first 触发完整覆盖 |
| L1-002 | 琐碎任务不注入重型 prompt | 已跑 | ✅ LIVE PASS | `../L1/L1-002-rerun-evidence.md`；real Orchestrator session（EN/CN 两个 trivial 任务），`assessTask`=trivial → TodoWrite/Freshness/Preflight=optional，directive 明确「No legacy preamble or DAG gate」；琐碎任务未注入重型/全量 prompt |
| L1-003 | 高风险模糊任务触发 preflight-lite + 风险澄清 | 未跑 | — | — |
| L1-004 | 缺失推荐 skill 产生可观察 warn 缺口 | 未跑 | — | — |
| *(probe-trivial)* | *L1-family 连通性 sanity* | 已跑 | ✅ LIVE PASS | `../probe/probe-trivial/`；LLM 回 "PONG"，real Orchestrator session 确认 |

---

## L2 — Native Task, No DAG, No Legacy Preamble

| Case | 断言 | 执行 | 判定 | 证据 / 备注 |
|---|---|---|---|---|
| L2-001 | build child 无 DAG 运行 | 已跑 | 🟡 PARTIAL | `../L2/L2-001-build-child/` SID `ses_0af91d39bffesLJgHMT1QcZzsY`；无 DAG 派发成立，但路由到 **explore**（非 build），目标文件未生成 (`files:0`) |
| L2-002 | general child 无 DAG | 未跑 | — | — |
| L2-003 | plan child 无 DAG | 未跑 | — | — |
| L2-004 | explore child 无 DAG + evidence bundle | 未跑 | — | — |
| L2-005 | 缺失 DISPATCH_TOKEN 仅审计/非硬阻断 | 未跑 | — | — |
| L2-006 | 并发 child 不冲突 | 未跑 | — | — |
| L2-007 | child prompt 无 legacy preamble / 无强制 DAG | 未跑 | — | — |
| L2-008 | session tree + DB lineage 可见 | 未跑 | — | — |

---

## L3 — Enforcement, Tool Governance, Hard Boundaries

| Case | 断言 | 执行 | 判定 | 证据 / 备注 |
|---|---|---|---|---|
| L3-001 | 原生 edit 被阻断 | 未跑 | — | — |
| L3-002 | 原生 bash 被阻断 | 未跑 | — | — |
| L3-003 | 错误路径写触发 scope/protected-path 阻断 | 未跑 | — | — |
| L3-004 | 无 CodeGraph 源码编辑被阻断 | 未跑 | — | — |
| L3-005 | 危险 shell / 备份绕过写被阻断 | 未跑 | — | — |
| L3-006 | 阻断态 question pass-through | 未跑 | — | — |
| L3-007 | 路由不匹配仅审计 | 未跑 | — | — |
| L3-008 | `safe_shell cat package.json` 放行 | 已跑 | ⚪ NOT WITNESSED | `../L3/L3-008-009-010-safe-shell-allow/`；LLM 推理要求 safe_shell 先过 CodeGraph，改用 `read`/`safe_repo_status`，**从未调用 safe_shell** |
| L3-009 | `safe_shell cat .opencode/service/...` 放行 | 已跑 | ⚪ NOT WITNESSED | 同上（合并运行） |
| L3-010 | `safe_shell git status` 放行 | 已跑 | ⚪ NOT WITNESSED | 同上（合并运行） |
| L3-011 | `safe_shell git add ...` 拒绝 + 重定向 safe_repo_* | 已跑 | ⚪ NOT WITNESSED | `../L3/L3-011-safe-shell-gitadd-deny/` SID `ses_0af91d551ffepNMgbl0k3RAd25`；`tool_enforcement`/`soft_rejections` 0 行，LLM 未尝试该工具 |
| L3-012 ★ | 真实 LLM 会话中 gh 写被 REPO-OP 拒绝 | 已跑 | 🟡 PARTIAL + 🔴 DEVIATION | `../L3/L3-012-repo-op-deny/` SID `ses_0af91d3b4ffeycTapv6j4N7yE9`→child `ses_0af8d95d4ffejR7ucISK8CbwJz`；子 agent 加载**完整 legacy 重型 checklist DAG** 后未达 push；`repo_operation_events` 全库空 → REPO-OP deny 未触及（强制开放项未满足） |

---

## L4 — QoderWork Bridge & Intervention

| Case | 断言 | 执行 | 判定 | 证据 / 备注 |
|---|---|---|---|---|
| L4-001 | 受阻/不确定任务发出 question | 已跑 | ⚪ NOT WITNESSED | `../L4/L4-question-reply/` + `../L4/L4-rerun/` SID `ses_0af77f6dbffe3eV3qnGgQSzQqh`；`notifications` 中 `question` 类型 = 0，未发 question |
| L4-002 | `POST /question/{QID}/reply` 恢复流程 | 已跑 (间接) | ⚪ NOT WITNESSED | 无 QID 产出 → reply 链路未测 |
| L4-003 | `prompt_async` 带保留 agent 进入下一轮 | 未跑 | — | — |
| L4-004 | `abort` 立即停止 live session | 未跑 | — | — |
| L4-005 ★ | watcher R1–R7 evidence capsule | 未跑 | — | 强制开放项 |
| L4-006 | 不使用不存在的 `/session/{SID}/guide|reply|interrupt` | 已跑 | ✅ PASS | 执行笔记全程仅用 `/message` / `/children` / `/question/{QID}/reply` 合法通道（计划 §2.3 纪律遵守） |

---

## L5 — Minimal State & Observability

| Case | 断言 | 执行 | 判定 | 证据 / 备注 |
|---|---|---|---|---|
| L5-001 | 只读任务零关键 DB 写 | 未跑 | — | — |
| L5-002 ★ | `safe_edit` 热路径仅触碰预期 DB/log 面 | 已跑 | ⚪ NOT WITNESSED | `../L5/L5-002-safe-edit-hotpath/` + `../L5/L5-002-rerun/` SID `ses_0af800da2ffeuL45N0fv1Hr9DD`；DB `read_audit`=0 / `tool_enforcement`=0 → safe_edit 未被真正调用 |
| L5-003 | 普通任务不创建 checklist 行 | 未跑 | — | — |
| L5-004 ★ | 高风险任务仅适机创建 checklist | 未跑 | — | 强制开放项 |
| L5-005 ★ | audit/quality/skill/guidance.jsonl 均被覆盖 | 未跑 | — | 强制开放项 |
| L5-006 | `/children` 404 fallback | 已跑 | 🔴 DEVIATION | `GET /session/nonexistent/children` → **HTTP 500**（`UnknownError`），非计划预期 404；并发饱和时还出现 HTTP 000 |
| L5-007 ★ | `/children` HTML fallback | 已跑 | 🔴 DEVIATION | 探针饱和期返回 500/000，HTML fallback 未确证；需非饱和 serve 重探 |
| L5-008 ★ | `/children` 非 JSON fallback | 已跑 | 🔴 DEVIATION | 同上，未确证 |

---

## L6 — Weak-Model Quality Floor

| Case | 断言 | 执行 | 判定 | 证据 / 备注 |
|---|---|---|---|---|
| L6-001 | 歧义处理不跳跃到不安全编辑 | 未跑 | — | — |
| L6-002 | 行动前证据优先 | 未跑 | — | — |
| L6-003 | TodoWrite 纪律 | 未跑 | — | — |
| L6-004 | freshness 决策仅对外部/当前任务 | 未跑 | — | — |
| L6-005 | 研究升级返回 evidence bundle | 未跑 | — | — |
| L6-006 | 最终答案含验证纪律 | 未跑 | — | — |

---

## L7 — Framework Maintenance Privileged Write Chain

| Case | 断言 | 执行 | 判定 | 证据 / 备注 |
|---|---|---|---|---|
| L7-001 | Orchestrator 请求 `dispatch_privilege=framework_maintenance` | 未跑 | — | 计划 §3 记有 partial live，本轮未重跑 |
| L7-002 | dispatch queue 含精确绑定字段 | 未跑 | — | 计划 §3 记有 live partial，本轮未重跑 |
| L7-003 ★ | child 真实创建且 grant 绑定 child | 已跑 | ⚪ NOT WITNESSED | `../L7/L7-framework-maint-chain/` + `../L7/L7-rerun/` SID `ses_0af7c9e5effeSAyC4AmRWT26s2`；`session_events`=2 但 `framework_maintenance_plans`=0 / 无 child grant → 链路未建立 |
| L7-004 ★ | child 写前执行 CodeGraph impact | 已跑 | ⚪ NOT WITNESSED | 同上（合并运行） |
| L7-005 ★ | child 创建 `framework_maintenance_plan` | 已跑 | ⚪ NOT WITNESSED | 同上；plan 表 = 0 |
| L7-006 ★ | `safe_framework_edit` 在允许路径成功 | 已跑 | ⚪ NOT WITNESSED | 同上；未触达写步骤 |
| L7-007 ★ | `framework_maintenance_complete` 收尾 | 已跑 | ⚪ NOT WITNESSED | 同上；未收尾 |
| L7-008 | 无 grant ⇒ 阻断 | 未跑 | — | — |
| L7-009 | 无 plan ⇒ 阻断 | 未跑 | — | — |
| L7-010 | 无 CodeGraph 证据 ⇒ 阻断 | 未跑 | — | — |
| L7-011 | 路径超出 plan ⇒ 阻断 | 未跑 | — | — |
| L7-012 | 路径超出 allowlist ⇒ 阻断 | 未跑 | — | — |
| L7-013 | TTL 过期 ⇒ 阻断 | 未跑 | — | — |
| L7-014 ★ | 写预算耗尽 ⇒ 阻断 | 未跑 | — | 强制开放项 |
| L7-015 ★ | complete 后写 ⇒ 阻断 | 未跑 | — | 强制开放项 |

---

## Appendix A — 23 Weak-Model Scenarios

| # | 场景 | 主 case | 执行 | 判定 | 备注 |
|--:|---|---|---|---|---|
| 1 | 歧义任务过早写 | L1-003 / L6-001 | 未跑 | — | 多为 static/hook 支撑 |
| 2 | 不知该问什么 | L6-001 / L4-001 | 未跑 | — | 需显式 live witness |
| 3 | 忘记读相关文件 | L6-002 | 未跑 | — | — |
| 4 | 忘记 CodeGraph | L3-004 | 未跑 | — | — |
| 5 | 写错文件 | L3-003 | 未跑 | — | — |
| 6 | 重复工具失败 | L4-001 / L4-002 | 未跑 | — | — |
| 7 | 跳过推荐 skill | L1-004 | 未跑 | — | — |
| 8 | 琐碎任务进入重型 DAG/checklist | L2-007 / L5-003 | 未跑 | — | — |
| 9 | 高风险框架任务跳过 grant/plan/写纪律 | L7-001..007 | 未跑 | — | — |
| 10 | preamble 回到活跃 child prompt | L2-007 | 未跑 | — | 需显式 live witness |
| 11 | 外部知识任务缺 freshness 决策 | L6-004 | 未跑 | — | — |
| 12 | 纯本地任务不必要触发 Context7 | L6-004 | 未跑 | — | — |
| 13 | 复杂研究未产出 evidence bundle | L2-004 / L6-005 | 未跑 | — | — |
| 14 | 证据不足仍继续 | L6-002 | 未跑 | — | 需显式 live witness |
| 15 | 非琐碎任务无 TodoWrite | L6-003 | 未跑 | — | — |
| 16 | 写动作偏离当前 todo | L6-003 + L3-003 | 未跑 | — | — |
| 17 | 失败不更新恢复 todo | L6-003 | 未跑 | — | — |
| 18 | todo 模糊不可执行 | L6-003 | 未跑 | — | 需显式 live witness |
| 19 | 琐碎任务产生 TodoWrite 噪音 | L6-003 | 未跑 | — | — |
| 20 | 最终输出缺验证证据 | L6-006 | 未跑 | — | 需显式 live witness |
| 21 | native Task 仍需 DAG/token | L2-001..006 | 未跑 | — | — |
| 22 | 路由不匹配变成意外硬阻断 | L3-006 | 未跑 | — | 需显式 live witness |
| 23 | `framework_maintenance_complete` 后仍写成功 | L7-015 | 未跑 | — | — |

---

## 汇总统计

| 维度 | 计数 |
|---|---|
| 测试目标总数（原主矩阵 P0×3 + L1–L7×59 + Appendix A×23 = **85**；另 **+3 衍生子项** L1-001A/B/C，见 L1 段） | **88** |
| **已跑** case（含 probe-trivial，共 27 个 case-ID） | **27** |
| **未跑** case（3 衍生子项 L1-001A/B/C 已本轮回合跑完） | **61** |
| 已跑判定分布 | ✅ LIVE PASS: 9（P0-A/B/C, L1-001, L1-002, probe-trivial, L4-006, L1-001B, L1-001C）· 🟡 PARTIAL: 3（L2-001, L3-012, L1-001A）· ⚪ NOT WITNESSED: 12 · 🔴 DEVIATION: 3（L5-006/007/008；L3-012 另含 DEVIATION 成分） |

### 强制开放项（§6）状态
| 强制项 | 状态 |
|---|---|
| L3-012 REPO-OP deny | 🟡 PARTIAL + DEVIATION（未满足） |
| L4-005 watcher capsule | 未跑 |
| L5-002 safe_edit 热路径 | ⚪ NOT WITNESSED |
| L5-004 高风险 checklist 可选性 | 未跑 |
| L5-007 / L5-008 /children fallback | 🔴 DEVIATION（未确证） |
| L7-003~007 正向特权链 | ⚪ NOT WITNESSED |
| L7-014 / L7-015 预算/complete 后拒绝 | 未跑 |
| Appendix A #2/#10/#14/#18/#20/#22 | 未跑 |

> 注：所有判定仅基于本会话真实 Live 证据；未将 runtime smoke / component / deterministic live-integration 冒充 full-live（遵循计划 Appendix B）。
