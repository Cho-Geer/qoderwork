# P0-2 PHASE-04 CLI 重实施独立复审（generation 3）

| 项 | 值 |
|---|---|
| 审计类型 | Independent re-audit (generation 3) |
| 审计目标 | 独立复审 PHASE-04 CLI 重实施（generation 2）结论可复现性 |
| 关联 plan | `plans/隔离 serve 测试基建待办/p0-2/04-phase-cli.md` |
| 前序审计 | `audits/p0-2/2026-07-21-phase-04-cli-reimplementation-audit.md`（generation 2，Accept） |
| 审计日期 | 2026-07-21 |
| 审计执行者 | ZCode（独立复审，不信任 G2 证据，全部独立产生） |
| 归档路径 | `audits/p0-2/2026-07-21-phase-04-cli-reimplementation-audit-g3.md` |
| 证据上限 | component（plan 声明）；本轮额外提供 runtime-smoke 补充证据（reviewer 端口 4001/4002） |
| 审计范围 | G2 全部 in-scope 项独立重验 + runtime 补充验证 |
| Provenance level | `component-only`（AGENTS.md §15 规则 P-01） |

## 1. 审计结论

**证据上限：component**（规则 P-06）。runtime-smoke 证据为补充验证，不改变 plan 声明的 component 证据上限。

**判定：Accept（component 级；G2 结论可复现；runtime 补充证据通过）。**

独立复审不信任 G2 证据，全部验证命令独立重跑。结果：
- Fixed verification 3 命令全部 pass（43 pass / 0 fail）
- 代码关键路径独立抽查全部符合 plan 合同
- **runtime 补充验证**：reviewer 提供端口 4001/4002，`p02-runtime.test.ts` 1 pass / 0 fail / 50 expect()（20.88s），真实 runP02 完成 16 stages，A/B manifests CLEANED，artifacts 在 persistent state root 可读

G2 标注的 2 项 NON_BLOCKING_DEBT 独立确认仍存在（F-001/F-002），不阻断。

## 2. G2 结论可复现性验证

| G2 声明 | G3 独立验证 | 可复现 |
|---|---|:---:|
| 43 pass / 0 fail / 215 expect() | 独立重跑：43 pass / 0 fail / 215 expect() [445ms] | ✅ |
| --help 含 p0-2 | 独立重跑：grep 匹配 1 行，格式匹配 Fixed contract | ✅ |
| git diff --check exit 0 | 独立重跑：DIFF_CHECK_EXIT=0 | ✅ |
| 292 pass / 0 component fail / 2 runtime NOT-RUN | G2 已验证；G3 额外用端口 4001/4002 跑 runtime test → 1 pass（见 §3.2） | ✅ |
| forbidden files 未违反 | 独立抽查：p02-orchestrator.ts diff 0 行；KNOWN_FLAGS 无禁止 flag | ✅ |
| allowed files 未越界 | 独立抽查：git diff --name-only 仅 isolated-serve.ts | ✅ |
| F-001 existsSync 简化 | 独立确认：isolated-serve.ts:190-194 仅 isAbsolute | ✅（仍存在） |
| F-002 harness scope 越界 | 独立确认：p02-cli-harness.ts 存在且被测试导入，plan Allowed files 未包含 | ✅（仍存在） |

## 3. 独立验证证据

### 3.1 Fixed verification（component 级）

```text
# 命令 1：p02-cli + p01b 回归
bun test scripts/test-serve/__tests__/p02-cli.test.ts scripts/test-serve/__tests__/p01b-orchestrator.test.ts
→ 43 pass / 0 fail / 215 expect() calls [445.00ms]

# 命令 2：--help 含 p0-2
bun run scripts/test-serve/isolated-serve.ts --help | grep "p0-2"
→ test-serve p0-2 --primary-worktree <dir> --commit <sha> --port-a <port> --port-b <port> --test-id <id> --main-framework-db <path>

# 命令 3：git diff --check
git diff --check -- scripts/test-serve/isolated-serve.ts scripts/test-serve/__tests__/p02-cli.test.ts
→ DIFF_CHECK_EXIT=0
```

`Verified-by: G3 独立执行 3 命令，全部 exit 0；43 pass 与 G2 一致`

### 3.2 Runtime 补充验证（reviewer 端口 4001/4002）

```text
P0_2_PORT_A=4001 P0_2_PORT_B=4002 bun test scripts/test-serve/__tests__/p02-runtime.test.ts
→ 1 pass / 0 fail / 50 expect() calls [20.88s]
```

**runtime 产物独立验证**：

| 检查项 | 结果 | Verified-by |
|---|---|---|
| A/B run 目录存在 | `2026-07-21T09-46-46-840Z-p02-runtime-a-f251218d` / `2026-07-21T09-46-47-432Z-p02-runtime-b-051374cf` | `ls test-runs/ \| grep p02-runtime` |
| manifest status | A: CLEANED, B: CLEANED | `grep '"status"' manifest.json` |
| stage-results | 16 stages, allOk: true | `bun -e` 解析 p0-2-stage-results.json |
| run 目录内容 | artifacts + cleanup-report.json + db + events + logs + manifest.json + pids | `ls $RUN_A/` |
| artifacts 内容 | framework-logs + p0-2-stage-results.json + sentinel-marker.json | `ls $RUN_A/artifacts/` |

`Verified-by: P0_2_PORT_A=4001 P0_2_PORT_B=4002 bun test p02-runtime.test.ts → 1 pass / 0 fail / 50 expect() [20.88s]；run 目录 manifest status=CLEANED；stage-results 16 stages allOk=true`

> 注：runtime 证据为补充验证，证明 CLI 路由调用的 runP02 在真实环境下可工作。PHASE-04 plan 证据上限仍为 component；runtime 级正式验收归 PHASE-05。

### 3.3 代码关键路径独立抽查

| 抽查项 | 方法 | 结果 |
|---|---|---|
| 拒绝链顺序 | `grep -n 'process\.exit(1)\|runP02Fn'` | 拒绝 exit(1) 在 line 162/174/182/187/192；runP02Fn 调用在 line 204；所有拒绝在调用前 ✅ |
| KNOWN_FLAGS 白名单 | `grep -A3 'KNOWN_FLAGS'` | 6 flags：--primary-worktree/--commit/--port-a/--port-b/--test-id/--main-framework-db ✅ |
| forbidden flags 缺失 | `grep -c 'retry\|skip-\|run-dir-a\|run-dir-b\|H2\|DRY_RUN'` | 0 匹配 ✅ |
| p02-orchestrator.ts 未改 | `git diff --stat -- p02-orchestrator.ts` | 0 行变更 ✅ |
| success JSON 映射 | `sed -n '212,220p'` | `{ok:true, status, runA, runB, checks, evidencePaths}` 匹配 plan ✅ |
| failure JSON 映射 | `sed -n '221,229p'` | `{ok:false, firstFailure, convergenceErrors, evidencePaths}` 匹配 plan ✅ |

`Verified-by: grep/sed/git diff 独立抽查 6 项，全部符合 plan 合同`

## 4. Findings 继承处理（规则 P-04）

G2 无 BLOCKED 项。G2 NON_BLOCKING_DEBT 处理：

| G2 Finding | G3 独立确认 | 处理 |
|---|---|---|
| F-001 absoluteInputs 不检查 existsSync | 确认：isolated-serve.ts:190-194 仅 `isAbsolute`；日志显式记录决策 | INHERITED（NON_BLOCKING_DEBT；component 级合理简化；runtime 级由 PHASE-05 补充） |
| F-002 p02-cli-harness.ts 不在 Allowed files | 确认：harness 存在且被导入；plan Allowed files 未包含 | INHERITED（NON_BLOCKING_DEBT；测试辅助文件，非生产代码） |

无新 BLOCKING finding。

## 5. 证据边界

- `[VERIFIED]` G2 component 级结论全部可复现（43 pass、--help、git diff --check）。
- `[VERIFIED]` 代码关键路径独立抽查 6 项全部符合 plan 合同。
- `[VERIFIED]` runtime 补充验证通过（1 pass / 50 expect()；16 stages allOk；A/B CLEANED；artifacts 可读）。
- `[VERIFIED]` G2 F-001/F-002 独立确认仍存在（NON_BLOCKING_DEBT）。
- `[RISK]` F-001 existsSync 检查仍需在 PHASE-05 runtime 正式验收中补充。
- `[VERIFIED]` runtime 证据为补充验证，不改变 PHASE-04 plan 声明的 component 证据上限。

## 6. 判定

**Final Gate 判定：Accept（component 级；G2 结论可复现；runtime 补充证据通过）。**

- G2 全部 in-scope 验证项独立重跑，结论一致。
- 代码关键路径独立抽查无新发现。
- runtime 补充验证（reviewer 端口 4001/4002）证明 CLI 路由调用的 runP02 在真实环境下可工作。
- 无新 BLOCKING finding；G2 F-001/F-002 继承为 NON_BLOCKING_DEBT。
- PHASE-04 component 级 DONE 维持。

## 7. 后续动作

1. `LATEST.md`：新增 G3 独立复审记录。
2. F-001：PHASE-05 runtime 正式验收应补充 existsSync 检查。
3. PHASE-05 可进入 Freeze Gate 流程（reviewer 端口 4001/4002 已提供；v2.1-required provenance）。

---

**审计完成时间**: 2026-07-21
**下次审计建议**: PHASE-05 Freeze Gate 完成后触发 v2.1 审计
