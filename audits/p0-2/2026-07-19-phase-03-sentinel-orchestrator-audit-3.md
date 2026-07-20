# P0-2 PHASE-03 Sentinel/Orchestrator 第二轮返工代码复审

| 项 | 值 |
|---|---|
| 审计目标实施报告 | `logs/2026-07-19-p0-2-phase-03-rework-2.md` |
| 关联 plan | `plans/隔离 serve 测试基建待办/p0-2/03-phase-sentinel-orchestrator.md` |
| 上一轮审计 | `audits/p0-2/2026-07-19-phase-03-sentinel-orchestrator-audit-2.md` |
| 审计日期 | 2026-07-19 |
| 审计执行者 | Codex |
| 归档路径 | `audits/p0-2/2026-07-19-phase-03-sentinel-orchestrator-audit-3.md` |
| QoderWork 基线 commit | `aa06fc827b978cfe6aa6237d55a2fa6929eb7a3a` + 当前未提交工作树 |
| work-one 基线 commit | `95405b6eb52750f5c5e84eef75a24bb63c6009d1` |
| 证据上限 | component；runtime-smoke / live-LLM-E2E NOT-RUN |

## 1. 审计结论

**判定：Rework。** 第二轮返工已修复 stop stage 自身 throw 时的重复 stop、显式返回 convergence errors、ESRCH/EPERM 三态区分，并复现 `183 pass / 0 fail / 4867 expect()`。但报告声称的“精确调用事件 ledger”并未成立：断言先寻找最后一个业务事件，再检查其后的 suffix，自定义义上无法发现非法的后续业务事件；反例中 firstFailure 后存在 `cleanup-b`，断言仍通过。另一个 fail-closed 缺口是默认 `stopSentinel` 继续静默吞掉 SIGTERM 错误，实际进程仍存活却按成功返回。PLAN_SET validator 也因 PHASE-03 completion gate 全部勾选而 exit 1。因此 PHASE-03 不能升为 DONE，PHASE-04 必须继续 BLOCKED。

## 2. 声明 vs 实际对照

| # | 实施报告/plan 声明 | 实际核实 | 结果 | 证据等级 | Verified-by |
|---|---|---|:---:|---|---|
| C1 | target component command 为 183 pass / 0 fail / 4867 expect | 本轮完整复跑与报告一致 | ✅ | component | `Verified-by: bun test verify-p02.test.ts p02-orchestrator.test.ts -> exit 0, 183 pass, 0 fail, 4867 expect()` |
| C2 | stop-a/b/sentinel 自身 throw 时仍 exact-once | 三个新增 case 均逐对象断言 `===1` 并通过；主循环在调用前置位 stopped | ✅ | static/component | `Verified-by: p02-orchestrator.ts:210-216,260-263,277-281 + tests:544-557 -> PASS` |
| C3 | convergence stop 错误不再静默吞掉 | `safeConvergeFailure` 捕获 sentinel/B/A 错误并返回 `convergenceErrors`；三错误 case 通过 | ✅ | static/component | `Verified-by: p02-orchestrator.ts:389-420 + tests:559-574 -> 3 objects captured` |
| C4 | 默认 sentinel stop 错误也可追溯 | `stopSentinel` 仍对 `process.kill(SIGTERM)` 使用空 catch，错误不会进入 firstFailure 或 convergenceErrors | ❌ | component probe | `Verified-by: simulated EACCES with real lightweight sentinel -> resolvedWithoutError=true, sentinelAliveAfterFailedSignal=true` |
| C5 | ESRCH 返回 NOT_FOUND，其他 pid probe 错误返回 UNAVAILABLE | 实现按 error code 分支，ESRCH/EPERM 注入 case 均通过，注释已同步 | ✅ | static/component | `Verified-by: p02-sentinel.ts:99-136 + tests:592-610 -> PASS` |
| C6 | 用精确事件 ledger 证明 firstFailure 后业务调用为 0 | helper 没有 failure boundary；它寻找最后一个业务事件，因此任何非法后续业务事件都会被吸收到 prefix | ❌ | static/logic probe | `Verified-by: tests:374-394 + counterexample -> illegalAfterFailure=true, currentAssertionWouldPass=true` |
| C7 | 16 个 stage failure case 均调用 ledger 断言 | 16 个 case 确实调用 helper 且通过，但 C6 证明该 helper 缺乏检测能力 | 🟡 | component | `Verified-by: tests:466-482 + target suite -> 16 cases PASS; helper counterexample PASS` |
| C8 | `P02Result` 失败分支新增 convergenceErrors | 类型与实际失败返回均包含该字段 | ✅ | static/component | `Verified-by: types.ts:346-359 + p02-orchestrator.ts:323-339` |
| C9 | tracked/untracked whitespace 均已检查 | tracked 文件 exit 0；三个 untracked 文件 no-index 均无 whitespace diagnostics | ✅ | static/tool | `Verified-by: git diff --check tracked -> exit 0; no-index --check 3 files -> empty diagnostics` |
| C10 | typecheck 32 条均为 PHASE-03 范围外债务 | 完整命令 exit 1；27 条在 work-one、5 条在 legacy script，PHASE-03 四路径 0 | ✅（但全局 FAIL） | static/typecheck | `Verified-by: bun run typecheck -> exit 1; TOTAL=32, WORK_ONE=27, LEGACY=5, PHASE03=0` |
| C11 | PHASE-03 五项 completion gate 全部勾选完成文档闭环 | 全勾选导致 PLAN_SET validator 报 NO_COMPLETION_CHECKBOX | ❌ | component/tool | `Verified-by: validate-plan.ts plans/.../p0-2 -> exit 1, NO_COMPLETION_CHECKBOX for PHASE-03` |
| C12 | index baseline/evidence/status 已同步 | coordinator、183 tests、REWORK/PHASE-04 BLOCKED 已更新；但 only path 仍指向 PHASE-01，current evidence 仍写 44/0/83 和 45/0/65，且“精确 ledger”结论不实 | 🟡 | manual | `Verified-by: 00-plan-index.md:6-7,65,72,74,112-113` |
| C13 | forbidden PHASE-03 文件未修改 | `process.ts`、`run-context.ts`、`bootstrap.ts`、`verify-p01b.ts`、`oracle.ts` 无 scoped diff | ✅ | static/tool | `Verified-by: git diff --name-only -- <forbidden files> -> empty` |
| C14 | runtime-smoke / live-LLM-E2E NOT-RUN | 本轮未启动真实 serve，报告未越级声称 runtime/live PASS | ✅ | manual | `Verified-by: implementation report:27 + audit command ledger -> no runtime/live command` |

## 3. 差异清单

| # | 差异 | 影响 | 返工要求 |
|---|---|---|---|
| D1 | `assertNoBusinessAfterFailure` 以最后一个业务事件作为边界，断言逻辑恒真 | 🔴 无法证明 REQ-003“firstFailure 后业务调用为 0”；非法补位调用不会让测试失败 | 在注入 failure 的瞬间记录明确 `failureEventIndex`/failure marker，从该边界之后检查只允许固定 convergence stop；增加 helper 反例测试 |
| D2 | 默认 `stopSentinel` 静默吞掉非 ESRCH 的 SIGTERM 错误 | 🔴 实际 stop 失败会被 stage 当作成功，错误不可追溯，违反 fail-closed | 为 signal sender 增加注入点；仅 ESRCH 可视为已退出，EPERM/EACCES/其他错误必须抛出并进入 firstFailure/convergenceErrors |
| D3 | completion gate 全勾选破坏 PLAN_SET validator | 🟠 计划集当前不是 validator PASS 状态 | 按 validator 合同恢复 phase card 的未完成 checkbox；实施状态由 index/audit 表达，或先正式修改 validator 设计再同步全部 phase |
| D4 | index 仍含旧 implementation path 与旧 current evidence，并声称“精确 ledger” | 🟠 文档当前真相自相矛盾，弱模型可能从 PHASE-01 重做或误判 D2 已完成 | 更新 line 6、65、72；D1 修复前删除“精确 ledger 已达成”措辞，PHASE-03 保持 REWORK |
| D5 | CodeGraph sync 后仍显示 232 removed pending changes | 🟡 依赖 absence/影响范围的索引结论可能不完整 | 修复索引 watcher/sync 状态后再跑 status；本轮相关文件用磁盘源码和测试兜底 |

## 4. 实施进度评估

| 维度 | 评估 | 依据 |
|---|:---:|---|
| 总体进度 | 86% | stop-once、convergenceErrors、ESRCH/EPERM 已完成；ledger、默认 sentinel fail-closed 与文档 validator 未闭环 |
| 代码完成度 | 🟡 | orchestrator 核心 stop-attempt 修复正确；默认 sentinel stop 仍吞错 |
| 测试覆盖 | 🟡 | 183/183 PASS，但关键 ledger helper 对反例无检测能力 |
| 文档同步 | ❌ | PLAN_SET validator FAIL，index 仍有三处旧/错误状态 |
| 证据强度 | component | runtime-smoke / live-LLM-E2E NOT-RUN；本阶段不要求提升证据等级 |

## 5. Phase completion gate

- [x] PHASE-02 evidence 已附。
- [ ] Exact 16-stage order and every stage failure are tested：顺序与 failure cases PASS，但 later-calls=0 的 ledger 断言无效。
- [~] Sentinel identity and stop-once contracts pass：exact-once 与三态 PASS；默认 sentinel signal failure 不 fail-closed。
- [x] Component command is 0 fail：183/183 PASS。
- [x] PHASE-04 remains blocked：index 仍为 BLOCKED。

**Final Gate 判定：Rework。**

## 6. 风险与证据边界

- `[RISK]` 绿测包含恒真 ledger assertion，不能作为 REQ-003 mutation-sensitive 证据。
- `[RISK]` sentinel SIGTERM 非 ESRCH 错误被静默吞掉；后续 cleanup verifier 可能发现进程仍活着，但 firstFailure 会错误地归因到更晚阶段。
- `[BLOCKED]` PLAN_SET validator 当前 exit 1；文档闭环不能标 PASS。
- `[VERIFIED]` 根 typecheck 仍 exit 1；PHASE-03 四路径 0 诊断不等于全局 typecheck PASS。
- `[VERIFIED]` 本审计没有运行真实 `opencode serve`、runtime smoke 或 live LLM E2E，结论上限严格为 component。

## 7. 最小返工包

1. 为测试 ledger 增加明确 failure boundary；对 `[verify-failure, stop-sentinel, illegal cleanup-b, stop-b]` 反例必须 FAIL。
2. 让默认 `stopSentinel` 传播非 ESRCH signal 错误，并补 EACCES/EPERM 注入测试及 firstFailure/convergenceErrors 断言。
3. 恢复/调整 PHASE-03 completion checkbox，使完整 PLAN_SET validator exit 0。
4. 清理 index 的 `Only implementation path`、44/0/83、45/0/65 与“精确 ledger”错误措辞；保持 PHASE-03=REWORK、PHASE-04=BLOCKED。
5. 复跑 183 tests、ledger 反例、signal-error probe、PLAN_SET validator、typecheck 与 tracked/untracked whitespace checks。
6. 修复 CodeGraph removed pending 状态后重新执行 status/explore，再申请第三轮复审。

---

**审计完成时间**: 2026-07-19 17:24 JST
**下次审计建议**: 完成最小返工包后立即复审
