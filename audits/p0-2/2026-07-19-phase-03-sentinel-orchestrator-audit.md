# P0-2 PHASE-03 Sentinel/Orchestrator — 实施文档与代码交叉审计

| 项 | 值 |
|---|---|
| 审计目标 plan | `plans/隔离 serve 测试基建待办/p0-2/03-phase-sentinel-orchestrator.md` |
| 审计日期 | 2026-07-19 |
| 审计执行者 | Codex |
| 归档路径 | `audits/p0-2/2026-07-19-phase-03-sentinel-orchestrator-audit.md` |
| 依赖基线 | PHASE-02 audit：DONE；PHASE-03：READY |
| 证据上限 | component；runtime-smoke / live-LLM-E2E NOT-RUN |

## 1. 审计结论

**判定：Rework。** 目标测试 `169 pass / 0 fail` 与固定 16-stage 顺序属实，但 absolute-path 输入合同、sentinel 三态合同和 stop-once 合同未满足；现有测试对“后续业务调用为 0”和“每对象最多 stop 一次”的断言不足。PHASE-03 不应标记 DONE，PHASE-04 必须继续 BLOCKED。

## 2. 声明 vs 实际对照

| # | 实施报告/plan 声明 | 实际核实 | 结果 | 证据等级 | Verified-by |
|---|---|---|:---:|---|---|
| C1 | PHASE-02 前置已完成 | 前序审计为 PHASE-02=DONE、PHASE-03=READY | ✅ | manual/component | `Verified-by: audits/p0-2/2026-07-19-phase-02-lifecycle-audit.md:75-78 -> PHASE-02 DONE` |
| C2 | `P02_STAGES` 精确 16 项固定顺序 | 常量与 plan line 44 完全一致 | ✅ | static/code | `Verified-by: types.ts:233-250 + p02-orchestrator.test.ts:390-409 -> 16 项 literal compare` |
| C3 | 16 个 stage 都有 failure case | 动态生成 16 case，均只断言 `result.ok=false` 与 `firstFailure.stage` | 🟡 | component | `Verified-by: p02-orchestrator.test.ts:412-422 -> 未断言 later business calls=0` |
| C4 | firstFailure 后停止业务 stage | 主循环在首次 catch 后 break，现场 16 failure case 均通过 | ✅ | static/component | `Verified-by: p02-orchestrator.ts:95-96,302-315 + target bun test -> 24/24 orchestrator cases PASS` |
| C5 | cleanup-a 后 B 五项仍真 | 实现检查 serve/sse/health/B marker/sentinel；单一 bServeAlive=false case 通过 | ✅ | static/component | `Verified-by: p02-orchestrator.ts:231-254 + P02-O-CLEANUP -> PASS` |
| C6 | sentinel marker + `/proc` identity 三态验证 | 实现返回 boolean，把 NOT_FOUND 与 UNAVAILABLE 都压成 false | ❌ | static/code | `Verified-by: p02-sentinel.ts:98-127 + types.ts:317 -> return type boolean` |
| C7 | 每对象最多 stop 一次 | 正常 stop 不更新 `stopped`；cleanup-a 失败后调用序列 A→B→A | ❌ | component probe | `Verified-by: bun /tmp/p02-contract-probe.ts -> aStopCount=2, bStopCount=1` |
| C8 | `P02-O-STOP` 证明 stop-once | 该 case 只覆盖首次业务 stop 之前失败，并只断言总 stop<=2 | ❌ | static/code | `Verified-by: p02-orchestrator.test.ts:454-469 -> 无 per-object/late-failure assertion` |
| C9 | 输入只接受 absolute `primaryWorktree/mainFrameworkDbPath` | `validateInput` 仅检查非空；相对路径进入 create-a | ❌ | component probe | `Verified-by: bun /tmp/p02-contract-probe.ts -> relativeCreateCalled=true` |
| C10 | target component command 0 fail | 本轮无 tail/grep 复跑为 169 pass / 0 fail / 4748 expect | ✅ | component | `Verified-by: bun test verify-p02.test.ts p02-orchestrator.test.ts -> exit 0, 169 pass, 0 fail` |
| C11 | 更广泛套件仅 1 个前置失败 | 当前受管环境复跑为 260 pass / 10 fail；9 项与本地 bind 受限相关，另 1 项缺 `P0_1B_PORT` | ⚠️不可复现 | component/integration | `Verified-by: bun test scripts/test-serve/__tests__ -> exit 1, 260 pass, 10 fail` |
| C12 | typecheck 对 4 个文件无错误 | 无直接命中 PHASE-03 路径的诊断，但完整 typecheck exit 1 | 🟡 | static/typecheck | `Verified-by: bun run typecheck -> exit 1; filtered PHASE-03 path diagnostics -> 0 lines` |
| C13 | `git diff --check` 通过 | 固定 4 文件命令 exit 0 | ✅ | static | `Verified-by: git diff --check -- <4 allowed files> -> GIT_DIFF_CHECK_EXIT=0` |
| C14 | 仅 PHASE-03 允许的 4 文件 | 3 个新增文件 + `types.ts` 修改；forbidden 文件 diff 为空；但 `RunManifest.rootDir?` 超出 types 的 stage/result anchor | 🟡 | static/code | `Verified-by: git status scoped -> 3 untracked + types.ts M; forbidden diff empty; types.ts:114-124 contains RunManifest.rootDir?` |
| C15 | 文档无需更新 | plan index 仍写 coordinator 不存在、PHASE-03=READY；无 PHASE-03 实施日志 | ❌ | manual | `Verified-by: 00-plan-index.md:74,112 + rg logs -> no PHASE-03 implementation log` |

## 3. 差异清单

| # | 差异 | 影响 | 返工要求 |
|---|---|---|---|
| D1 | stop-once 状态只在 `safeConvergeFailure` 内更新，正常 `stop-a/stop-b/stop-sentinel` 不更新 | 🔴 合同失败；晚期失败会重复 stop 已停止对象 | 正常 stop 成功/已发起时同步更新 per-object 状态；增加 cleanup-a、cleanup-b、verify-cleanup 晚期失败的逐对象计数测试 |
| D2 | absolute path 只写在错误文本，没有 `isAbsolute` 校验 | 🔴 输入合同失败；相对路径可进入生命周期操作 | 对两个路径使用 `node:path.isAbsolute` fail-closed；为两字段分别增加 relative-path negative case，并断言 dependency call count=0 |
| D3 | sentinel identity 将 NOT_FOUND/UNAVAILABLE 合并为 boolean false | 🔴 与 plan 的三态负向语义不一致，无法审计“目标不存在”和“证据不可用” | 返回显式 `FOUND/NOT_FOUND/UNAVAILABLE`；stop 仅在 FOUND 时执行；分别覆盖 missing process、unreadable proc、missing/malformed marker、mismatch |
| D4 | 16-stage failure matrix 未检查“后续业务调用为 0” | 🟠 测试标题和实施报告高估覆盖 | 为每一 stage 建立按 dependency/stage 的调用 ledger，断言失败 stage 后所有业务调用为 0；收敛 stop 单独记账 |
| D5 | `P02-O-STOP` 只检查总次数且仅覆盖早期失败 | 🟠 无法发现 A stop 两次 | 改为按 A/B/sentinel 分桶，并覆盖正常 stop 后的晚期失败 |
| D6 | 全量回归与 typecheck 结论表达不准确 | 🟠 证据边界失真 | 保留真实 exit code；全量测试当前标 BLOCKED/UNVERIFIED，完整 typecheck 标 FAIL（既有债务），不得用 grep/tail 代替命令结论 |
| D7 | 缺少 PHASE-03 实施日志，plan index 仍是旧基线 | 🟡 不满足项目追溯要求 | 返工通过后新增 `logs/2026-07-19-p0-2-phase-03-sentinel-orchestrator.md`；更新 plan index 的基线与 phase 状态，但 runtime 仍 NOT-RUN |
| D8 | `RunManifest.rootDir?` 不在 PHASE-03 types 的 exact stage/result anchor | 🟡 范围偏差 | 说明其归属并回填相应 phase/plan；或将其移入明确允许该 anchor 的返工范围 |

## 4. 实施进度评估

| 维度 | 评估 | 依据 |
|---|:---:|---|
| 总体进度 | 65% | 16-stage、firstFailure、cleanup 五项、stage results 已实现；3 个固定合同失败，2 个关键测试盲区 |
| 代码完成度 | 🟡 | 主路径存在，但 absolute-path、三态、stop-once 未闭环 |
| 测试覆盖 | 🟡 | 目标 169/169 PASS；关键 late-failure/per-object assertions 缺失 |
| 文档同步 | ❌ | 无 PHASE-03 实施日志；plan index 仍是实施前基线 |
| 证据强度 | component | runtime-smoke/live LLM E2E 未运行，且本阶段不要求运行 |

## 5. Gate status

- [x] PHASE-02 evidence 已附：前序 audit 为 DONE。
- [ ] Exact 16-stage order and every stage failure are tested：顺序已测，但“后续业务调用为 0”未被断言。
- [ ] Sentinel identity and stop-once contracts pass：三态未实现；stop-once 探针失败。
- [x] 固定 target component command 为 0 fail：169/169 PASS。
- [x] PHASE-04 remains blocked：必须继续 BLOCKED。

**Final Gate 判定：Rework。**

## 6. 风险与证据边界

- `[RISK]` `safeConvergeFailure` 的三个 catch 静默吞掉 stop 错误，返回结果不记录 convergence failure；这与项目 fail-closed/可追溯原则存在张力。
- `[BLOCKED]` 全量 `scripts/test-serve/__tests__` 在当前受管环境无法建立本地监听端口，不能作为本轮无回归证明；失败现场已保留在命令输出。
- `[VERIFIED]` 本审计没有运行真实 `opencode serve`、runtime smoke 或 live LLM E2E，结论上限严格为 component。

## 7. 最小返工包

1. 修复 absolute-path 校验并补 dependency-call-count=0 测试。
2. 让 stop-once ledger 覆盖正常 stage 与失败收敛，补晚期失败逐对象测试。
3. 将 sentinel identity 改为显式三态并补全 unavailable/mismatch cases。
4. 强化 16-stage failure matrix 的“后续业务调用为 0”断言。
5. 复跑固定 169 tests、`git diff --check`、完整 typecheck（如仍为既有错误则如实记录），补实施日志并更新 plan index。

---

**审计完成时间**: 2026-07-19
**下次审计建议**: 完成最小返工包后立即复审
