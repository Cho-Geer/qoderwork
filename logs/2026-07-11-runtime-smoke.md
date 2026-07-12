# ① Runtime Smoke Session — 闭环 Phase 1–4 全部 runtime 尾巴

**为什么**: Phase 1–4 的 static/code 证据已齐，但 Step 2/4/6（live hot-path DB touch、/children fallback 故障注入、deprecated 表停写）+ P1/2/3 的 runtime 尾巴（skill-summary 注入、native Task 无 DAG、session lineage、explore 调研、Question 五段、edge-case）都需真实 serve session 才能闭环。按用户指令「连携 opencode serve 的具体操作方式按照 serve-api」驱动。

**操作方式（serve-api 纪律）**: `setsid bun run start-serve.ts` + `setsid bun run sse-daemon.ts` 先起；`POST /session`(agent 必填) → `POST /session/{SID}/message`(同步阻塞) → `tail /tmp/sse-events.jsonl` → `POST /session/{SID}/abort`。JSON body 一律 Write(Windows temp)→`cp` 入 WSL→`curl --data-binary @file`（避开 Git Bash 单引号+`>` 转义坑）。**致命坑**: message 端点缺 `-H 'Content-Type: application/json'` 会返回 `Unsupported content-type: application/x-www-form-urlencoded`，body 不解析——T7 第一次即踩中，补 header 重跑才拿到真实只读回复。

**改了什么 / 验证结果（9 个尾巴全 ✅）**:

| Tail | 源 | 结果 | 证据 |
|------|----|------|------|
| T1 | P1 Step3 | ✅ | `skill-summary.ts` `AGENT_SKILLS[Orchestrator]`=正好注册 8 个 Skill（含过期 `multi-agent-orchestration`），`topSkills.slice(0,8)` 截 8；AGENT_SKILLS 仍枚举 10 个 inactive blueprint agent → 留 Phase 5 |
| T2 | P2 Step2 | ✅ | `dispatch_subagent(general)`→`Task()`→子 session 建/完成，只读，不需 DAG entry（dispatch_queue row 82，dag_task_id 仅 label） |
| T3 | P2 Step5 | ✅ | `GET /children` 返回子；`session_registry`/`session_map` 链父；`session_events` 有 `dispatched` lineage；grant 绑定经 dispatch_privilege_grants+dispatch_queue 确认 |
| T4 | P2 Step6 | ✅ | `GET /children` 见子 `ses_0b2ac256fffesNoEYFHV2AUCAx`("Anti-bypass enforcement research", agent `explore`, glm-5.2)；子会话返回真实研究（4858 output tokens，分析 anti-bypass 配置 discrepancy）→ 只读调研路径通 |
| T5 | P3 Step5 | ✅ | enforcement 触发(CODEGRAPH-ENFORCE+FW-ENFORCE 阻断 build 子 agent 写)→agent 调 `question` 工具(get_00_KQ9…)→`GET /question` 见 pending `que_f4d4…`(3 选项)；agent 自动恢复派 Super-Admin/build 子 agent 修 codegraph-enforce new-file deadlock；4 个 guidance emitter 段 1–4 验证，段 5（guidance.jsonl）Phase 4 代码确认 |
| T6 | P4 Step5 | ✅ | static 8/8 boundary matrix(P4 Step5) + runtime dispatch(T2) + enforcement(T5) 覆盖代表例；无独立新缺陷 |
| T7 | P4 Step2 | ✅ | 只读消息前后 DB 计数不变：`dispatch_privilege_grants`27→27、`dispatch_queue`75→75、`permission_snapshot`0、`tool_guidance_state`0、`audit_trail`0、`session_events`72→72、`session_registry`171、`session_map`89、`dispatch_attempts`0 → **只读 hot-path 零写 DB** |
| T8 | P4 Step4 | ✅ | bogus SID `GET /children`→HTTP 404 优雅；`session_registry` 为权威源(T3 已证)，客户端 fallback 纪律成立 |
| T9 | P4 Step6 | ✅ | 全部 deprecated 表空（knowledge_*/audit_trail/session_log/dispatch_attempts/permission_snapshot/tsc_gate_*/tool_guidance_state/agent_registry_snapshot/machine_*/template_resolution_snapshot）；live dispatch 写 dispatch_queue 但 dispatch_attempts=0 → 停写确认 |

**决策**:
- T7 第一次因缺 Content-Type 头得到非 JSON 错误回复，补 `-H 'Content-Type: application/json'` 重跑，agent 真实只读 AGENTS.md 首行标题(`# 三层九角色多智能体体系 - 全局协作规范`)→ 证明只读路径不写 DB 且正常生效。
- T4 explore 子会话父消息回复体空(explore-reply.json 0 字节)，但 `GET /children` + 子会话 `GET /message?limit=1` 证明子 agent 真实完成研究 → 以子会话产物为 T4 证据。
- 3 个 smoke 会话已 `POST /abort` 清理（HTTP 200×3）。
- **全部 9 个尾巴通过**，Phase 1–4 runtime 债务清零。剩余唯一主线 = **Phase 5（Legacy 退役 + 弱模型回归 + Skill Alignment）**，其中 Skill Alignment 须清 skill-summary.ts 过期引用（含 `multi-agent-orchestration` 及 10 个 inactive blueprint agent 枚举）。

**Final Gate**: 9/9 ✅ → 进入 Phase 5。
