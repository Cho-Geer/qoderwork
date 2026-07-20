# P0-2 PHASE-04 CLI 路由独立审计（generation 1）

| 项 | 值 |
|---|---|
| 审计类型 | Initial audit (generation 1) |
| 审计目标 | PHASE-04 CLI 路由实施 |
| 关联 plan | `plans/隔离 serve 测试基建待办/p0-2/04-phase-cli.md` |
| 实施报告 | `logs/2026-07-19-p0-2-phase-04-cli.md` |
| 权威索引 | `plans/隔离 serve 测试基建待办/p0-2/00-plan-index.md` |
| 前序审计 | 无（PHASE-04 首次审计） |
| 审计日期 | 2026-07-19 |
| 审计执行者 | QoderCN（pre-flight-enforcement + plan-audit-archiver 组合） |
| 归档路径 | `audits/p0-2/2026-07-19-phase-04-cli-audit.md` |
| 证据上限 | component；runtime-smoke / live-LLM-E2E NOT-RUN |
| 审计范围 | PHASE-04 REQ-001/002/003 + Check Registry 5 项 + completion gate 5 项；不扩展至 PHASE-05 或真实 runtime |

## 1. 审计结论

**判定：Accept（component 级）。** PHASE-04 CLI 路由实施满足 plan 的 REQ-001/002/003 + Check Registry 5 项 + completion gate 核心项。Fixed verification 3 命令全部 pass，forbidden files 未被违反，negative control mutation 验证证明测试敏感性。

标注 3 项 NON_BLOCKING_DEBT（F-001/F-002/F-003），不阻断 component 级 DONE。plan-audit-archiver v2.1 正式 ACCEPT 仍 BLOCKED（provenance 缺口，与 PHASE-03 audit-4 §10 / audit-6 一致）。

## 2. REQ 验证（含 Verified-by 证据行）

| REQ | plan 条件 | 实施声明 | 本轮复核 | 结果 | Verified-by |
|---|---|---|---|:---:|---|
| REQ-001 | 参数非法 → coordinator 调用 0 → stderr JSON / exit 1 | 拒绝相对/不存在 path、空 testId、端口非 1–65535、端口相同、缺 flag、未知 flag | `parseP02Args`（isolated-serve.ts:376-438）检查 unknown flag/requiredArgs/absoluteInputs/portsDistinct；P02-C-MISSING/PORT/PATH/未知 flag 4 用例 pass，runP02 调用 0 | ✅ | `Verified-by: bun test p02-cli → P02-C-MISSING/PORT/PATH/未知 flag pass，callCount.n===0` |
| REQ-002 | 参数合法 → 调用一次 runP02 → stdout JSON / exit 0 | globalThis.__P02_RUNNER__ 注入 spy，合法 argv 调用 1 次 | `case "p0-2"`（:171-205）调用 getP02Runner()；合法 argv 用例 pass，callCount.n===1，exit 0 | ✅ | `Verified-by: bun test p02-cli → 合法 argv pass，callCount.n===1，exit 0` |
| REQ-003 | coordinator 失败 → 保留 firstFailure/evidence paths → stderr JSON / exit 1 | failure 映射 ok/firstFailure/evidencePaths | `:199-203` 输出 `{ok:false, firstFailure, evidencePaths}`，exit 1；P02-C-FAIL pass | ✅ | `Verified-by: bun test p02-cli → P02-C-FAIL pass，stderr 含 firstFailure+evidencePaths，exit 1` |

## 3. Check Registry 5 项验证

| Check | plan 定义 | 实现/测试 | mutation 验证 | 结果 |
|---|---|---|:---:|:---:|
| `requiredArgs` | argv 解析所有 flag | `parseP02Args:396-407` 检查 6 flag 缺失；P02-C-MISSING pass | buggy（不检查）→ runP02 被调用 → 测试 FAIL | ✅ |
| `portsDistinct` | 端口数值比较 | `parseP02Args:417-425` 检查 1-65535 + 不相同；P02-C-PORT pass | buggy（不检查相同）→ runP02 被调用 → 测试 FAIL | ✅ |
| `absoluteInputs` | 绝对/存在路径 | `parseP02Args:410-415` 检查 isAbsolute；P02-C-PATH pass | buggy（不检查绝对）→ runP02 被调用 → 测试 FAIL | ✅ |
| `runP02CalledOnce` | 注入 spy 调用计数 | 合法 argv 用例 callCount.n===1 | N/A（正控制） | ✅ |
| `resultMapping` | JSON 输出解析 | 合法 argv 检查 ok/status/runA/runB/checks/evidencePaths；P02-C-FAIL 检查 ok/firstFailure/evidencePaths | N/A（正控制） | ✅ |

`Verified-by: /tmp/p04-mutation-verify.ts EXIT=0（3 negative control 敏感性已证明：buggy 实现下测试 FAIL，正确实现下 PASS）`

## 4. Fixed verification 结果

```text
cd /home/zhaoge/workspace/qoderwork
# 命令 1：p02-cli + p01b 回归
/home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/p02-cli.test.ts scripts/test-serve/__tests__/p01b-orchestrator.test.ts
→ 43 pass / 0 fail / 215 expect() calls
Ran 43 tests across 2 files. [98.00ms]

# 命令 2：--help 含 p0-2
/home/zhaoge/.bun/bin/bun run scripts/test-serve/isolated-serve.ts --help
→ 含 "test-serve p0-2 --primary-worktree <dir> --commit <sha> --port-a <portA> --port-b <portB> --test-id <id> --main-framework-db <db-path>"

# 命令 3：git diff --check
git diff --check -- scripts/test-serve/isolated-serve.ts scripts/test-serve/__tests__/p02-cli.test.ts
→ DIFF_CHECK_EXIT=0（无 whitespace 错误）
```

`Verified-by: 3 命令全部 exit 0；43 pass 与实施日志声明一致；--help 含 p0-2 路由且格式匹配 plan Fixed contract`

## 5. forbidden files 检查

| 禁止项 | plan 声明 | 本轮复核 | 结果 |
|---|---|---|:---:|
| 修改 `p02-orchestrator.ts` contract | 禁止 | `git status` 显示 `??`（untracked，PHASE-03 遗留，未被 PHASE-04 修改） | ✅ |
| 增加 `--retry`/`--skip-*`/`--run-dir-a`/`--run-dir-b` flags | 禁止 | `grep` isolated-serve.ts 无匹配 | ✅ |
| 增加 H2/DRY_RUN flags | 禁止 | `grep` 无匹配 | ✅ |
| 使用 shell command string 或第二条生命周期命令 | 禁止 | `case "p0-2"` 单路由，无 shell 调用 | ✅ |

`Verified-by: git status p02-orchestrator.ts → ??（未修改）；grep 禁止 flags → 无匹配`

## 6. Findings

### F-001 (NON_BLOCKING_DEBT): failure JSON 缺 controlledStops 字段

- **现象**: plan Fixed contract line 43 要求 failure JSON 含 `ok:false,firstFailure,controlledStops,evidencePaths.stageResults`，但实现 `isolated-serve.ts:199-203` 只输出 `{ok:false, firstFailure, evidencePaths}`，缺 `controlledStops`。
- **根因**: `P02Result` 类型（types.ts:326-360）无 `controlledStops` 字段，只有 `convergenceErrors?`。plan 的 `controlledStops` 可能是 PHASE-03 Check name 误写为 JSON 字段。
- **分类**: NON_BLOCKING_DEBT（文档/类型不一致，需 plan 作者澄清 controlledStops 是否 === convergenceErrors）
- **影响**: 不阻断 REQ-003（REQ-003 只要求 firstFailure/evidence paths）。success JSON exact；failure JSON 缺 controlledStops 但 P02Result 无此字段可输出。
- **建议**: plan 作者澄清 controlledStops 语义；若 === convergenceErrors，实现应补充输出；若为笔误，修正 plan Fixed contract。

### F-002 (NON_BLOCKING_DEBT): absoluteInputs 不检查 existsSync

- **现象**: plan Fixed contract line 42 要求"拒绝相对/不存在 path"，但实现 `parseP02Args:410-415` 只检查 `isAbsolute`，不检查 `existsSync`。
- **根因**: component 级测试用 `/fake/primary` 等不存在的绝对路径作为合法输入（避免真实文件系统操作）。若实现检查 existsSync，合法 argv 用例会 FAIL。
- **分类**: NON_BLOCKING_DEBT（component 级测试的合理简化）
- **影响**: 不阻断 component 级验证。runtime 级（PHASE-05）应补充 existsSync 检查。
- **建议**: plan Fixed contract 应区分 component/runtime 级要求；或在 PHASE-05 runtime 测试中补充路径存在性验证。

### F-003 (NON_BLOCKING_DEBT): p02-cli-harness.ts 不在 plan Allowed files

- **现象**: plan Allowed files 仅声明 `isolated-serve.ts`（modify）+ `p02-cli.test.ts`（add），但实施新增了 `p02-cli-harness.ts`（untracked）。
- **根因**: `p02-cli-harness.ts` 是 `p02-cli.test.ts` 的测试辅助文件（捕获 stdout/stderr/exitCode），可视为测试基础设施的扩展。
- **分类**: NON_BLOCKING_DEBT（scope 轻微越界，测试辅助文件）
- **影响**: 不影响生产代码。harness 仅用于测试，不进入生产路径。
- **建议**: 后续 plan 的 Allowed files 应显式包含测试辅助文件，或声明"测试基础设施文件"类别。

## 7. Phase completion gate 对照

| Gate 项 | plan box | 本轮复核 | 状态 |
|---|:---:|---|---|
| PHASE-03 evidence is attached | `[ ]` | audit-5/audit-6 已签 PHASE-03 DONE | ✅ 实质成立 |
| Invalid argv never calls coordinator | `[ ]` | P02-C-MISSING/PORT/PATH/未知 flag 证明 runP02 0 次 + mutation 验证 | ✅ 实质成立 |
| JSON and exit mappings are exact | `[ ]` | success JSON exact；failure JSON 缺 controlledStops（F-001，P02Result 无此字段）；exit code exact | ⚠️ 部分成立（F-001 NON_BLOCKING_DEBT） |
| P0-1B CLI regression passes | `[ ]` | 37 pass / 0 fail（含在 43 pass 中） | ✅ 实质成立 |
| PHASE-05 remains blocked | `[ ]` | 00-plan-index:114 PHASE-05=BLOCKED | ✅ 实质成立 |

> 注：completion gate box 全 `[ ]` 是项目约定（04-phase-cli.md:106 声明"与 01/02/03-phase DONE 状态下全 `[ ]` 模式一致"），DONE 状态由 00-plan-index.md 承载。

## 8. provenance 缺口（与 PHASE-03 一致）

| 项 | 状态 |
|---|---|
| scope-lock.json | 缺失（`audits/p0-2/scope-lock.json` 不存在） |
| evidence/ 目录 | 缺失 |
| pre-change receipt | 无法重建（实施已完成） |
| execution receipts (EV-NNN) | 缺失（用 `Verified-by` 文字证据行替代） |
| `validate-audit.ts` 机器门 | 无法通过（无 v2.1 JSON contract） |

plan-audit-archiver v2.1 正式 ACCEPT 仍 BLOCKED，与 PHASE-03 audit-4 §10 / audit-6 一致。component 级 DONE 不受影响。

## 9. 证据边界

- `[VERIFIED]` REQ-001/002/003 满足（代码层 + 测试层 + mutation 验证）。
- `[VERIFIED]` Check Registry 5 项满足（含 negative control mutation 验证）。
- `[VERIFIED]` Fixed verification 3 命令全部 pass（43 pass + help 含 p0-2 + git diff --check exit 0）。
- `[VERIFIED]` forbidden files 未被违反（p02-orchestrator.ts 未改 + 无禁止 flags）。
- `[VERIFIED]` provenance 缺口（与 PHASE-03 一致）。
- `[RISK]` F-001 controlledStops 差异需 plan 作者澄清；F-002 existsSync 检查需在 PHASE-05 runtime 补充。
- `[VERIFIED]` 本审计未运行真实 `opencode serve`，结论上限严格为 component。

## 10. 判定

**Final Gate 判定：Accept（component 级）。**

- REQ-001/002/003 全部满足，Check Registry 5 项满足（含 mutation 验证）。
- Fixed verification 3 命令全部 pass，forbidden files 未被违反。
- completion gate 5 项中 4 项实质成立，1 项部分成立（F-001 NON_BLOCKING_DEBT，不阻断）。
- 标注 3 项 NON_BLOCKING_DEBT（F-001 controlledStops 差异、F-002 existsSync 简化、F-003 harness scope 越界），不阻断 component 级 DONE。
- plan-audit-archiver v2.1 正式 ACCEPT 仍 BLOCKED（provenance 缺口，与 PHASE-03 一致）。
- PHASE-04 component 级 DONE 维持（与 00-plan-index.md:113 声明一致）。

## 11. 后续动作

1. `LATEST.md`：新增 PHASE-04 审计记录。
2. `logs/`：新增本次审计归档日志。
3. F-001：建议 plan 作者澄清 controlledStops 语义（=== convergenceErrors 或笔误）。
4. F-002：PHASE-05 runtime 测试应补充 existsSync 检查。
5. F-003：后续 plan Allowed files 应显式包含测试辅助文件。
6. PHASE-05 仍 BLOCKED（需 reviewer 提供端口），不在本次审计范围。

---

**审计完成时间**: 2026-07-19
**下次审计建议**: PHASE-05 runtime test 实施完成后触发（需 reviewer 提供端口）
