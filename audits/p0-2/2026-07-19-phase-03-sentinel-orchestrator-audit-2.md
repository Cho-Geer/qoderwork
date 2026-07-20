# P0-2 PHASE-03 Sentinel/Orchestrator 返工实施复审

| 项 | 值 |
|---|---|
| 审计目标实施报告 | `logs/2026-07-19-p0-2-phase-03-sentinel-orchestrator.md` |
| 关联 plan | `plans/隔离 serve 测试基建待办/p0-2/03-phase-sentinel-orchestrator.md` |
| 审计日期 | 2026-07-19 |
| 审计执行者 | Codex |
| 归档路径 | `audits/p0-2/2026-07-19-phase-03-sentinel-orchestrator-audit-2.md` |
| QoderWork 基线 commit | `aa06fc827b978cfe6aa6237d55a2fa6929eb7a3a` + 当前未提交工作树 |
| work-one 基线 commit | `95405b6eb52750f5c5e84eef75a24bb63c6009d1` |
| 证据上限 | component；runtime-smoke / live-LLM-E2E NOT-RUN |

## 1. 审计结论

**判定：Rework。** 实施报告中的 `177 pass / 0 fail / 4975 expect()`、absolute-path 拒绝、显式 sentinel 三态、正常 stop 后晚期失败不重复 stop、失败结果返回 stage ledger 等主张已复现。但 PHASE-03 的固定 stop-once 合同仍未闭环：当 `stop-a`、`stop-b` 或 `stop-sentinel` 自身抛错时，正常 stage 未先置位 `stopped`，失败收敛会再次调用同一 stop；定向探针分别得到 `stopA=2`、`stopB=2`、`stopSentinel=2`。因此 PHASE-03 不应为 DONE，PHASE-04 应继续 BLOCKED。

## 2. 声明 vs 实际对照

| # | 实施报告/plan 声明 | 实际核实 | 结果 | 证据等级 | Verified-by |
|---|---|---|:---:|---|---|
| C1 | PHASE-02 evidence 已附 | 前序 PHASE-02 audit 存在并判定 DONE | ✅ | manual/component | `Verified-by: audits/p0-2/2026-07-19-phase-02-lifecycle-audit.md:75-78 -> PHASE-02 DONE` |
| C2 | `P02_STAGES` 固定 16 项且逐 stage failure | 常量顺序与 plan 一致；16 个动态 failure case 全部通过 | ✅ | static/component | `Verified-by: types.ts:233-250 + target bun test -> 16 stage cases PASS` |
| C3 | target component command 0 fail | 本轮结果与实施报告完全一致 | ✅ | component | `Verified-by: bun test verify-p02.test.ts p02-orchestrator.test.ts -> exit 0, 177 pass, 0 fail, 4975 expect()` |
| C4 | 两个路径仅接受 absolute path，拒绝前 dependency call=0 | `isAbsolute` 校验在依赖解析/调用前执行；两个 negative case 通过 | ✅ | static/component | `Verified-by: p02-orchestrator.ts:51-68,414-420 + p02-orchestrator.test.ts:532-539 -> PASS` |
| C5 | sentinel identity 返回 `FOUND/NOT_FOUND/UNAVAILABLE`，仅 FOUND 可 stop | 类型、实现和真实轻量 sentinel 用例已覆盖报告列举的 pid 缺失、environ mismatch、marker 缺失/损坏及 FOUND | ✅（列举场景） | static/component | `Verified-by: types.ts:263-264 + p02-sentinel.ts:80-128 + target bun test -> three-state cases PASS` |
| C6 | stop-once 合同通过 | 正常 stop 成功后置位可防晚期重复 stop；但 stop 自身 throw 时在失败收敛中再次调用 | ❌ | component probe | `Verified-by: injected stop-throw matrix -> stop-a stopA=2; stop-b stopB=2; stop-sentinel stopSentinel=2` |
| C7 | cleanup-a / cleanup-b / verify-cleanup 晚期失败逐对象 stop-once | 三个 late-failure case 均通过，覆盖“正常 stop 已成功”的分支 | ✅ | component | `Verified-by: p02-orchestrator.test.ts:518-529 + target bun test -> 3 cases PASS` |
| C8 | 16-stage 后续业务调用为 0 的独立 ledger 已闭环 | stage 前缀和 11 个聚合 counter ceiling 已增加；但使用 `<=` 总量上限且排除 stop，不是逐调用/逐 stage ledger，可能漏掉“失败调用未计数、后续同类调用补位” | 🟡 | static/component | `Verified-by: p02-orchestrator.test.ts:443-469 -> aggregate ceilings; stop counters explicitly excluded` |
| C9 | 失败 `P02Result` 返回 `stages` | 类型与失败返回均存在，16-stage cases 核对 prefix ledger | ✅ | static/component | `Verified-by: types.ts:346-354 + p02-orchestrator.ts:321-336 + target bun test -> PASS` |
| C10 | D8 `RunManifest.rootDir?` 已纳入 PHASE-03 anchor | plan allowed-files anchor 已显式加入该字段 | ✅ | static/manual | `Verified-by: 03-phase-sentinel-orchestrator.md:28-35 + types.ts:114-124` |
| C11 | `git diff --check` 验证 4 个 PHASE-03 文件 | 原命令 exit 0，但 3 个新增文件为 untracked，实际只检查 tracked `types.ts` | ❌表述不实 | static/tool | `Verified-by: git status --short <4 files> -> 1 tracked M + 3 untracked; original git diff --check -> exit 0` |
| C12 | 3 个新增文件无 whitespace diagnostics | 用 no-index 方式逐文件补查，输出均为空 | ✅ | static/tool | `Verified-by: git diff --no-index --check /dev/null <each untracked file> -> empty diagnostics; exit 1 denotes content diff` |
| C13 | typecheck 为 32 条范围外债务，四文件 0 诊断 | 本轮完整命令 exit 1；计数与路径过滤和报告一致 | ✅（但全局 FAIL） | static/typecheck | `Verified-by: bun run typecheck -> exit 1; awk -> TOTAL_TS_ERRORS=32, PHASE03_PATH_DIAGNOSTICS=0` |
| C14 | plan index 已同步为 PHASE-03 DONE、PHASE-04 BLOCKED | 两个状态已写入，但 index 仍称 component 未达、coordinator 不存在；PHASE-03 五个 completion checkbox 全未勾选 | ❌ | manual | `Verified-by: 00-plan-index.md:7,74,112-113 + 03-phase-sentinel-orchestrator.md:107-111` |
| C15 | runtime-smoke / live-LLM-E2E NOT-RUN | 本轮未启动真实 serve，报告未越级声称 runtime/live PASS | ✅ | manual | `Verified-by: implementation report:23 + audit command ledger -> no runtime/live command` |

## 3. 差异清单

| # | 差异 | 影响 | 返工要求 |
|---|---|---|---|
| D1 | stop stage 自身 throw 时，对象尚未置位 `stopped`，失败收敛再次 stop | 🔴 固定 stop-once 合同失败；三个对象均可重复调用 | 将 stop-attempt ledger 在调用前置位，保留首个 stop 错误；补 `stop-a`、`stop-b`、`stop-sentinel` throw 后各对象 `===1` 测试 |
| D2 | D4 使用聚合 `<= ceiling`，不是逐 stage dependency-call ledger | 🟠 mutation sensitivity 不足；失败调用未计数时，非法后续同类调用可能补位而不失败 | 记录带 stage/dependency/object 的调用序列，断言 firstFailure 后除固定 convergence stop 外无事件 |
| D3 | `git diff --check -- <4 files>` 未覆盖 3 个 untracked 文件 | 🟠 报告把未执行的覆盖范围写成已验证 | 在文件仍 untracked 时使用 no-index whitespace diagnostics；提交/intent-to-add 后才可用普通 scoped diff check |
| D4 | plan index 的 baseline/evidence ceiling 与 DONE 状态冲突，phase gate checkbox 未更新 | 🟠 弱模型会同时读到“coordinator 不存在”和“PHASE-03 DONE” | 返工通过后同步 current baseline、evidence ceiling、phase status 和 completion checkbox；PHASE-04 在复审 Accept 前保持 BLOCKED |
| D5 | `validateSentinelIdentity` 对 `process.kill(pid, 0)` 的任意异常都返回 NOT_FOUND，且源码注释仍写三态为 true/false | 🟡 EPERM 等证据不可用场景可能被误判为不存在；注释漂移 | 仅 ESRCH 返回 NOT_FOUND，其他 probe 错误返回 UNAVAILABLE；增加可注入/可复现用例并修正注释 |

## 4. 实施进度评估

| 维度 | 评估 | 依据 |
|---|:---:|---|
| 总体进度 | 82% | 旧审计 8 项返工的大部分已落实，但核心 stop-once 仍有 3 个对称失败分支，文档闭环未完成 |
| 代码完成度 | 🟡 | 主流程、absolute path、三态、stage ledger 均存在；stop attempt 记账仍不完整 |
| 测试覆盖 | 🟡 | 177/177 PASS，但缺 stop stage 自身 throw 的 per-object exact-once case，D4 ledger 仍为聚合上限 |
| 文档同步 | ❌ | index baseline、evidence ceiling、PHASE-03 checkbox 与 DONE 状态冲突 |
| 证据强度 | component | runtime-smoke / live-LLM-E2E NOT-RUN；本阶段不要求提升证据等级 |

## 5. Phase completion gate

- [x] PHASE-02 evidence 已附。
- [~] Exact 16-stage order and every stage failure are tested：16 个 failure case PASS，但 D4 的“后续调用为 0”ledger 仍不够精确。
- [ ] Sentinel identity and stop-once contracts pass：报告列举的三态 case PASS；stop-once 在三个 stop-throw 分支 FAIL。
- [x] Component command is 0 fail：177/177 PASS。
- [x] PHASE-04 remains blocked：当前 index 仍为 BLOCKED。

**Final Gate 判定：Rework。**

## 6. 风险与证据边界

- `[RISK]` `safeConvergeFailure` 仍静默吞掉三个 stop 错误，失败结果不会记录 convergence failure；该风险未被实施报告闭环。
- `[RISK]` 默认 `stopSentinel` 也静默吞掉实际 `SIGTERM` 失败，stage 可能被记录为成功但进程仍存活；应由后续 verifier 发现，但错误来源不可追溯。
- `[VERIFIED]` 根 typecheck 仍 exit 1；四个 PHASE-03 路径 0 诊断不能表述为全局 typecheck PASS。
- `[VERIFIED]` 本审计未运行真实 `opencode serve`、runtime smoke 或 live LLM E2E，结论上限严格为 component。

## 7. 最小返工包

1. 把 A/B/sentinel 的 stop-attempt 标志移到对应 stop 调用之前，并保留/返回 stop 与 convergence 错误。
2. 新增三个 stop stage 自身 throw 用例，逐对象断言 `=== 1`，不要只断言 `<= 1`。
3. 把 D4 改为带 stage 与对象的调用事件 ledger，精确断言 firstFailure 后的允许事件集合。
4. 区分 process probe 的 ESRCH 与其他错误，补 UNAVAILABLE 用例并修正三态注释。
5. 复跑 177 个 component tests、完整 typecheck、tracked/untracked 各自正确的 whitespace 检查。
6. 通过后同步 index baseline/evidence ceiling、PHASE-03 completion checkbox；再复审决定是否将 PHASE-03 标为 DONE、解锁 PHASE-04。

---

**审计完成时间**: 2026-07-19 16:43 JST
**下次审计建议**: 完成最小返工包后立即复审
