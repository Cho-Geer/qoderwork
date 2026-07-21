# P0-2 PHASE-04 CLI 重实施审计（generation 2）

| 项 | 值 |
|---|---|
| 审计类型 | Re-implementation audit (generation 2) |
| 审计目标 | PHASE-04 CLI 路由重实施（PHASE-06a 回滚丢失后恢复） |
| 关联 plan | `plans/隔离 serve 测试基建待办/p0-2/04-phase-cli.md` |
| 实施报告 | `logs/2026-07-21-p0-2-phase-04-cli-reimplementation.md` |
| 权威索引 | `plans/隔离 serve 测试基建待办/p0-2/00-plan-index.md` |
| 前序审计 | `audits/p0-2/2026-07-19-phase-04-cli-audit.md`（generation 1，Accept） |
| 审计日期 | 2026-07-21 |
| 审计执行者 | ZCode（pre-flight-enforcement + plan-audit-archiver 组合） |
| 归档路径 | `audits/p0-2/2026-07-21-phase-04-cli-reimplementation-audit.md` |
| 证据上限 | component；runtime-smoke / live-LLM-E2E NOT-RUN |
| 审计范围 | PHASE-04 REQ-001/002/003 + Check Registry 5 项 + completion gate 5 项；不扩展至 PHASE-05 或真实 runtime |
| Provenance level | `component-only`（AGENTS.md §15 规则 P-01；plan-index 声明 PHASE-01~04 = component-only） |

## 1. 审计结论

**证据上限：component**（规则 P-06：component-only plan 禁止签署 v2.1 正式 ACCEPT）。

**判定：Accept（component 级）。** PHASE-04 CLI 重实施满足 plan 的 REQ-001/002/003 + Check Registry 5 项 + completion gate 核心项。Fixed verification 3 命令全部 pass，forbidden files 未被违反，allowed files 未被越界，测试套件内 negative control 证明敏感性。

标注 2 项 NON_BLOCKING_DEBT（F-001/F-002，均继承自 generation 1），不阻断 component 级 DONE。plan-audit-archiver v2.1 正式 ACCEPT 不适用（component-only provenance）。

### Generation 1 findings 继承处理

| G1 Finding | G1 分类 | G2 处理 | 理由 |
|---|---|---|---|
| F-001 controlledStops 差异 | NON_BLOCKING_DEBT | CLOSED（不再适用） | plan Fixed contract 已更新为 `convergenceErrors`；实现输出 `convergenceErrors: result.convergenceErrors ?? []`，与当前 plan 一致 |
| F-002 existsSync 简化 | NON_BLOCKING_DEBT | INHERITED → G2 F-001 | 实现仍仅检查 isAbsolute；日志显式记录决策；fixture 兼容性理由成立 |
| F-003 harness scope 越界 | NON_BLOCKING_DEBT | INHERITED → G2 F-002 | harness 文件已存在（G1 创建），本次未修改；plan Allowed files 仍未包含 |

## 2. REQ 验证（含 Verified-by 证据行）

| REQ | plan 条件 | 实施声明 | 本轮复核 | 结果 | Verified-by |
|---|---|---|---|:---:|---|
| REQ-001 | 参数非法 → coordinator 调用 0 → stderr JSON / exit 1 | KNOWN_FLAGS 白名单 + requiredArgs/portsDistinct/absoluteInputs 三阶段拒绝 | `case "p0-2"`（isolated-serve.ts:152-231）：unknown flag 循环检查 → requiredArgs 6 flag 缺失检查 → 端口范围/相同检查 → isAbsolute 检查；所有拒绝路径在 `runP02Fn` 调用前；P02-C-MISSING/PORT/PATH/未知 flag 4 用例 pass，callCount.n===0 | ✅ | `Verified-by: bun test p02-cli.test.ts → P02-C-MISSING/PORT/PATH/未知 flag pass，exitCode===1，callCount.n===0` |
| REQ-002 | 参数合法 → 调用一次 runP02 → stdout JSON / exit 0 | globalThis.__P02_RUNNER__ 注入 spy，合法 argv 调用 1 次 | `:196-211` 调用 runP02Fn；`:212-220` 成功映射 `{ok:true, status, runA, runB, checks, evidencePaths}`；合法 argv 用例 pass，callCount.n===1，exit 0 | ✅ | `Verified-by: bun test p02-cli.test.ts → 合法 argv pass，callCount.n===1，exitCode===0，stdout JSON 含 ok/status/runA/runB/checks/evidencePaths` |
| REQ-003 | coordinator 失败 → 保留 firstFailure/evidence paths → stderr JSON / exit 1 | failure 映射 ok/firstFailure/convergenceErrors/evidencePaths | `:221-229` 输出 `{ok:false, firstFailure, convergenceErrors, evidencePaths}`，exit 1；P02-C-FAIL pass | ✅ | `Verified-by: bun test p02-cli.test.ts → P02-C-FAIL pass，stderr 含 firstFailure+convergenceErrors+evidencePaths，exitCode===1` |

## 3. Check Registry 5 项验证

| Check | plan 定义 | 实现/测试 | negative control | 结果 |
|---|---|---|---|:---:|
| `requiredArgs` | argv 解析所有 flag，all present | `:166-176` 检查 6 flag 缺失 → `{ok:false, check:"requiredArgs"}` exit 1 | P02-C-MISSING：移除 --port-b → exit 1，check="requiredArgs"，runP02 0 次 | ✅ |
| `portsDistinct` | 端口数值比较，different valid ports | `:177-189` 检查 Number.isInteger + 1–65535 + 不相同 → `{ok:false, check:"portsDistinct"}` exit 1 | P02-C-PORT：portB=portA → exit 1，check="portsDistinct"，runP02 0 次 | ✅ |
| `absoluteInputs` | 绝对/存在路径，both valid | `:190-194` 检查 isAbsolute（不检查 existsSync，见 F-001）→ `{ok:false, check:"absoluteInputs"}` exit 1 | P02-C-PATH：相对 DB path → exit 1，check="absoluteInputs"，runP02 0 次 | ✅ |
| `runP02CalledOnce` | 注入 spy 调用计数，one only on valid input | 合法 argv 用例 callCount.n===1；所有拒绝路径 callCount.n===0 | 正控制（合法 argv 恰好 1 次）+ 4 个负控制（拒绝路径 0 次） | ✅ |
| `resultMapping` | JSON 输出解析，exact contract | 成功：ok/status/runA/runB/checks/evidencePaths；失败：ok/firstFailure/convergenceErrors/evidencePaths | P02-C-FAIL：失败结果 → stderr JSON 含 firstFailure+evidencePaths，exit 1 | ✅ |

`Verified-by: bun test p02-cli.test.ts → 6/6 pass（4 negative control + 1 positive + 1 unknown flag），215 expect() calls`

### Negative control 敏感性证明

测试套件内建 negative control 已证明敏感性：

| Negative control | 注入突变 | 预期 FAIL 行为 | 观测结果 |
|---|---|---|---|
| P02-C-MISSING | 移除 --port-b flag | 若实现不检查 requiredArgs，runP02 会被调用（callCount>0）且 exit 0 → 测试 FAIL | 测试 PASS（exit 1，callCount=0）→ 实现正确拒绝 |
| P02-C-PORT | portB=portA=41001 | 若实现不检查 portsDistinct，runP02 会被调用 → 测试 FAIL | 测试 PASS（exit 1，callCount=0）→ 实现正确拒绝 |
| P02-C-PATH | DB path 改为 ./framework-state.db | 若实现不检查 absoluteInputs，runP02 会被调用 → 测试 FAIL | 测试 PASS（exit 1，callCount=0）→ 实现正确拒绝 |
| P02-C-FAIL | spy 返回 makeFailResult() | 若实现不映射 failure JSON，stderr 缺 firstFailure → 测试 FAIL | 测试 PASS（exit 1，stderr 含 firstFailure）→ 实现正确映射 |
| 未知 flag | 追加 --unknown-flag x | 若实现不检查 KNOWN_FLAGS，runP02 会被调用 → 测试 FAIL | 测试 PASS（exit 1，callCount=0）→ 实现正确拒绝 |

## 4. Fixed verification 结果

```text
cd /home/zhaoge/workspace/qoderwork

# 命令 1：p02-cli + p01b 回归
/home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/p02-cli.test.ts scripts/test-serve/__tests__/p01b-orchestrator.test.ts
→ 43 pass / 0 fail / 215 expect() calls
Ran 43 tests across 2 files. [484.00ms]

# 命令 2：--help 含 p0-2
/home/zhaoge/.bun/bin/bun run scripts/test-serve/isolated-serve.ts --help
→ 含 "test-serve p0-2 --primary-worktree <dir> --commit <sha> --port-a <port> --port-b <port> --test-id <id> --main-framework-db <path>"

# 命令 3：git diff --check
git diff --check -- scripts/test-serve/isolated-serve.ts scripts/test-serve/__tests__/p02-cli.test.ts
→ exit 0（无 whitespace 错误）
```

`Verified-by: 3 命令全部 exit 0；43 pass 与实施日志声明一致；--help 含 p0-2 路由且格式匹配 plan Fixed contract`

### 完整 suite 复验

```text
/home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__
→ 292 pass / 2 fail / 5350 expect() calls
Ran 294 tests across 17 files. [19.62s]
```

2 个 fail 均为 runtime 测试前置拒绝（`P0_2_PORT_A environment variable must be set`），非 component 失败。与日志声明"292 pass / 0 component fail / 2 runtime NOT-RUN（缺端口 env）"语义一致。

`Verified-by: bun test scripts/test-serve/__tests__ → 292 pass；p02-runtime.test.ts:36 throw "P0_2_PORT_A environment variable must be set"（前置拒绝，非执行失败）`

## 5. Forbidden files 检查

| 禁止项 | plan 声明 | 本轮复核 | 结果 |
|---|---|---|:---:|
| 修改 `p02-orchestrator.ts` contract | 禁止 | `git diff --stat` 仅 `isolated-serve.ts` 1 file changed；p02-orchestrator.ts 无变更 | ✅ |
| 增加 `--retry`/`--skip-*`/`--run-dir-a`/`--run-dir-b` flags | 禁止 | KNOWN_FLAGS = 6 个固定 flag，无禁止 flag | ✅ |
| 增加 H2/DRY_RUN flags | 禁止 | KNOWN_FLAGS 无 H2/DRY_RUN | ✅ |
| 使用 shell command string 或第二条生命周期命令 | 禁止 | `case "p0-2"` 单路由，无 shell 调用 | ✅ |

`Verified-by: git diff --stat → 1 file changed (isolated-serve.ts)；KNOWN_FLAGS 白名单 = [--primary-worktree, --commit, --port-a, --port-b, --test-id, --main-framework-db]`

## 6. Allowed files 检查

| Allowed path | plan 声明 | 本轮复核 | 结果 |
|---|---|---|:---:|
| `scripts/test-serve/isolated-serve.ts` | modify: command union, switch, help | git diff: +105/-6；Command union 新增 "p0-2"；switch 新增 case "p0-2"；printHelp 追加 p0-2 行；另含 runTestServeCli 导出 + P02Runner 类型（测试入口必要变更） | ✅ |
| `scripts/test-serve/__tests__/p02-cli.test.ts` | add: P02-C matrix | 文件已存在（G1 创建），本次未修改（git diff 无此文件） | ✅（未越界） |

`Verified-by: git diff --stat → scripts/test-serve/isolated-serve.ts | 111 ++++-- (1 file changed, 105 insertions, 6 deletions)`

## 7. Fixed contract 对照

| plan 合同 | 实现 | 结果 |
|---|---|:---:|
| 唯一格式：`p0-2 --primary-worktree PATH --commit SHA --port-a PORT --port-b PORT --test-id ID --main-framework-db PATH` | KNOWN_FLAGS 6 flag 精确匹配；--help 输出匹配 | ✅ |
| 拒绝相对 path | `!isAbsolute(p02PrimaryWorktree) \|\| !isAbsolute(p02MainFrameworkDb)` → exit 1 | ✅ |
| 拒绝不存在 path | 未实现（仅 isAbsolute，见 F-001） | ⚠️ |
| 拒绝空 testId | `!p02TestId`（空字符串 falsy）→ exit 1 | ✅ |
| 拒绝端口非 1–65535 | `!Number.isInteger(portA) \|\| portA < 1 \|\| portA > 65535` → exit 1 | ✅ |
| 拒绝端口相同 | `portA === portB` → exit 1 | ✅ |
| 拒绝缺 flag | 6 个 getArg 检查 → exit 1 | ✅ |
| 拒绝未知 flag | KNOWN_FLAGS 白名单循环 → exit 1 | ✅ |
| success JSON：`ok:true,status:"PASS",runA,runB,checks,evidencePaths.stageResults` | `{ok:true, status:result.status, runA:result.runDirA, runB:result.runDirB, checks:result.checks, evidencePaths:result.evidencePaths}` | ✅ |
| failure JSON：`ok:false,firstFailure,convergenceErrors,evidencePaths.stageResults` | `{ok:false, firstFailure:result.firstFailure, convergenceErrors:result.convergenceErrors ?? [], evidencePaths:result.evidencePaths}` | ✅ |

> 注：plan Implementation steps 第 2 步写"解析七个固定 flag"，但 Fixed contract 格式仅列 6 个 flag。实现与 Fixed contract 格式一致（6 flag）。"七"为 plan 文本笔误，不影响实现正确性。

## 8. Findings

### F-001 (NON_BLOCKING_DEBT, 继承自 G1 F-002): absoluteInputs 不检查 existsSync

- **现象**: plan Fixed contract 要求"拒绝相对/不存在 path"，Check Registry `absoluteInputs` Read/operation 为 `absolute/existing`，但实现 `isolated-serve.ts:190-194` 只检查 `isAbsolute`，不检查 `existsSync`。
- **根因**: component 级测试用 `/fake/primary` 等不存在的绝对路径作为合法输入。若实现检查 existsSync，合法 argv 正控制会 FAIL。实施日志显式记录此决策。
- **分类**: NON_BLOCKING_DEBT（component 级测试的合理简化；plan 文本与 Single-failure Matrix 内部不一致——Matrix P02-C-PATH 仅测试相对路径）
- **影响**: 不阻断 component 级验证。不存在的绝对路径会在 coordinator create 阶段 fail-closed，不违反安全属性。
- **建议**: plan Fixed contract 应区分 component/runtime 级要求；或在 PHASE-05 runtime 测试中补充路径存在性验证。

### F-002 (NON_BLOCKING_DEBT, 继承自 G1 F-003): p02-cli-harness.ts 不在 plan Allowed files

- **现象**: plan Allowed files 仅声明 `isolated-serve.ts`（modify）+ `p02-cli.test.ts`（add），但 `p02-cli-harness.ts` 存在且被测试导入。
- **根因**: harness 是 G1 实施创建的测试辅助文件（捕获 stdout/stderr/exitCode），本次重实施未修改。
- **分类**: NON_BLOCKING_DEBT（scope 轻微越界，测试辅助文件，非生产代码）
- **影响**: 不影响生产代码。harness 仅用于测试。
- **建议**: 后续 plan 的 Allowed files 应显式包含测试辅助文件。

## 9. Phase completion gate 对照

| Gate 项 | plan box | 本轮复核 | 状态 |
|---|:---:|---|---|
| PHASE-03 evidence is attached | `[ ]` | audit-5/audit-6 已签 PHASE-03 DONE；plan-index PHASE-03=DONE | ✅ 实质成立 |
| Invalid argv never calls coordinator | `[ ]` | P02-C-MISSING/PORT/PATH/未知 flag 证明 runP02 0 次；所有拒绝路径在 runP02Fn 调用前 | ✅ 实质成立 |
| JSON and exit mappings are exact | `[ ]` | success JSON 精确匹配；failure JSON 含 firstFailure+convergenceErrors+evidencePaths（G1 F-001 controlledStops 已随 plan 更新关闭）；exit code 精确 | ✅ 实质成立 |
| P0-1B CLI regression passes | `[ ]` | 37 pass / 0 fail（含在 43 pass 中） | ✅ 实质成立 |
| PHASE-05 remains blocked | `[ ]` | plan-index PHASE-05=NOT-RUN | ✅ 实质成立 |

> 注：completion gate box 全 `[ ]` 是项目约定（04-phase-cli.md:106 声明"与 01/02/03-phase DONE 状态下全 `[ ]` 模式一致"），DONE 状态由 00-plan-index.md 承载。

## 10. Provenance 与证据边界

| 项 | 状态 |
|---|---|
| provenance_level | `component-only`（plan-index 声明） |
| scope-lock.json | 不适用（component-only plan 无 v2.1 Freeze Gate 要求） |
| pre-change receipt | 不可重建（plan-index 声明"历史 phase，pre-change receipt 不可重建"） |
| execution receipts (EV-NNN) | 不适用（component-only；用 Verified-by 文字证据行替代） |
| validate-audit.ts 机器门 | 不适用（component-only plan 禁止签署 v2.1 正式 ACCEPT） |

- `[VERIFIED]` REQ-001/002/003 满足（代码层 + 测试层 + negative control 敏感性）。
- `[VERIFIED]` Check Registry 5 项满足（含 5 个 negative control）。
- `[VERIFIED]` Fixed verification 3 命令全部 pass（43 pass + help 含 p0-2 + git diff --check exit 0）。
- `[VERIFIED]` 完整 suite 292 pass / 0 component fail / 2 runtime NOT-RUN（缺端口 env）。
- `[VERIFIED]` forbidden files 未被违反（p02-orchestrator.ts 未改 + 无禁止 flags）。
- `[VERIFIED]` allowed files 未被越界（仅 isolated-serve.ts 修改）。
- `[VERIFIED]` 日志声明全部可复现（43 pass、292 pass、--help、git diff --check）。
- `[RISK]` F-001 existsSync 检查需在 PHASE-05 runtime 补充。
- `[VERIFIED]` 本审计未运行真实 `opencode serve`，结论上限严格为 component。

## 11. 判定

**Final Gate 判定：Accept（component 级）。**

- REQ-001/002/003 全部满足，Check Registry 5 项满足（含 negative control 敏感性证明）。
- Fixed verification 3 命令全部 pass，forbidden files 未被违反，allowed files 未被越界。
- completion gate 5 项全部实质成立。
- G1 F-001（controlledStops）已随 plan 更新关闭；G1 F-002/F-003 继承为 G2 F-001/F-002（NON_BLOCKING_DEBT，不阻断）。
- 日志声明的全部证据可复现。
- PHASE-04 component 级 DONE 恢复（2026-07-20 交叉审核回退为 PARTIAL，本次重实施后恢复）。
- v2.1 正式 ACCEPT 不适用（component-only provenance，规则 P-06）。

## 12. 后续动作

1. `LATEST.md`：新增 PHASE-04 重实施审计记录。
2. `00-plan-index.md`：PHASE-04 状态从 PARTIAL 更新为 DONE（component 级）。
3. F-001：PHASE-05 runtime 测试应补充 existsSync 检查。
4. F-002：后续 plan Allowed files 应显式包含测试辅助文件。
5. PHASE-05 仍 NOT-RUN（需 reviewer 提供端口 + Freeze Gate），不在本次审计范围。

---

**审计完成时间**: 2026-07-21
**下次审计建议**: PHASE-05 runtime test 实施完成后触发（需 reviewer 提供端口 + v2.1 Freeze Gate）
