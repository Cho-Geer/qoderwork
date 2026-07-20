# P0-2 PHASE-03 Sentinel/Orchestrator 第五轮复审（re-audit of audit-5）

| 项 | 值 |
|---|---|
| 审计类型 | Re-audit (generation 6) |
| 复审目标 | `audits/p0-2/2026-07-19-phase-03-sentinel-orchestrator-audit-5.md` |
| 前序审计 SHA-256 | `e89402698eb525dc09ad28de14a9486eb4ecfdd1fd531ea67a111649dc5780a3` |
| 前序审计判定 | Accept（D1–D4 全部关闭；186/186 PASS + validator exit 0） |
| 关联 plan | `plans/隔离 serve 测试基建待办/p0-2/03-phase-sentinel-orchestrator.md` |
| 权威索引 | `plans/隔离 serve 测试基建待办/p0-2/00-plan-index.md` |
| 实施报告 | `logs/2026-07-19-p0-2-phase-03-rework-3.md` |
| 审计日期 | 2026-07-19 |
| 审计执行者 | QoderCN（pre-flight-enforcement + plan-audit-archiver 组合） |
| 归档路径 | `audits/p0-2/2026-07-19-phase-03-sentinel-orchestrator-audit-6.md` |
| 证据上限 | component；runtime-smoke / live-LLM-E2E NOT-RUN |
| 复审范围 | audit-5 的 D1–D4 关闭判定 + provenance 缺口；不扩展至 PHASE-04 或真实 runtime |

## 1. 复审结论

**判定：Accept（component 级，维持 audit-5 的 D1–D4 关闭判定）。**

本轮通过 pre-flight-enforcement + plan-audit-archiver 组合流程，对 audit-5 声明的 D1–D4 关闭项逐项用运行态命令复核，并补做 negative control 的 mutation 验证（plan-audit-archiver Step 4 要求）。结论：

- D1–D4 实质关闭判定 **成立**（代码层 + 测试层 + mutation 验证三者一致）。
- PHASE-03 component 级 DONE **维持**。
- **但 audit-5 未声明 provenance 缺口**：`audits/p0-2/` 下无 `scope-lock.json`、无 `evidence/` 目录，audit-5 缺 plan-audit-archiver v2.1 的 scope-lock / pre-change receipt / execution receipts，无法通过 `validate-audit.ts` 机器门。这与 audit-4 §10 "正式归档状态 BLOCKED" 一致，但 audit-5 §1 直接 Accept 未声明此缺口，属文档缺陷（NON_BLOCKING_DEBT）。
- 因此本复审区分两重判定：
  - **component 级 DONE**：Accept（D1–D4 关闭，证据充分，PHASE-03 维持 DONE）。
  - **plan-audit-archiver v2.1 正式 ACCEPT**：仍 BLOCKED（provenance 缺口；pre-change receipt 已无法重建，scope-lock 需 human approval）。

## 2. D1–D4 逐项复核（含 Verified-by 证据行）

| # | audit-4 退出条件 | audit-5 声明 | 本轮复核 | 结果 | Verified-by |
|---|---|---|---|:---:|---|
| D1 | failure boundary 反例 `failure→illegal cleanup-b→stop-a` 必被检出 | `assertNoBusinessAfterFailure` 改用最后一个 `failure` 标记为失败边界 | 代码层 `p02-sentinel.ts:88-94` 与 `p02-orchestrator.test.ts:419-437` 行号匹配；`P02-O-D1-FAILURE-BOUNDARY`（test.ts:630-638）+ `-OK`（test.ts:641-649）用例 pass；**mutation 验证**：buggy 实现（最后业务事件作边界）不 throw → 测试 FAIL，正确实现 throw → 测试 PASS | ✅ | `Verified-by: bun test --test-name-pattern "D1-FAILURE-BOUNDARY" → 3 pass / 0 fail；mutation 验证 /tmp/d1-negative-control-verify.ts EXIT=0（buggy 不 throw + correct throw）` |
| D2 | `stopSentinel` 非 ESRCH 信号错误必须 fail-closed | catch 仅吞 ESRCH，非 ESRCH 信号错误 fail-closed 传播 | `p02-sentinel.ts:88-94` catch 仅 ESRCH return，其余 throw；`P02-O-D2-SIGTERM-NONESRCH`（test.ts:652-681）pass；**mutation 验证**：buggy 实现（吞所有错误）swallowed → 测试 FAIL，正确实现 threw → 测试 PASS | ✅ | `Verified-by: bun test --test-name-pattern "D2-SIGTERM-NONESRCH" → 1 pass / 0 fail；mutation 验证 /tmp/d2-negative-control-verify.ts EXIT=0（buggy swallowed + correct threw）` |
| D3 | `validate-plan.ts` PLAN_SET exit 0 | exit 0 | `bun run validate-plan.ts plans/隔离 serve 测试基建待办/p0-2` → `{"ok":true,"mode":"PLAN_SET"}` EXIT=0（仅 PLAN_LENGTH_WARNING，非阻断） | ✅ | `Verified-by: bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts → EXIT=0` |
| D4 | 索引状态同步 | 00-plan-index 已同步 D1/D2/D3 关闭 | `00-plan-index.md:6` "Only implementation path: PHASE-03 DONE（audit-5 Accept）"；`:65` 186/0/4870 声明；`:112` PHASE-03=DONE per audit-5。PHASE-04 也=DONE（`:113`），但属 audit-5 之后的合法演进，不在复审范围 | ✅ | `Verified-by: sed -n '6p;65p;112p;113p' 00-plan-index.md → 状态声明一致` |

## 3. 整体测试基线复核

```text
cd /home/zhaoge/workspace/qoderwork
/home/zhaoge/.bun/bin/bun test scripts/test-serve/__tests__/verify-p02.test.ts scripts/test-serve/__tests__/p02-orchestrator.test.ts
→ 186 pass / 0 fail / 4870 expect() calls
Ran 186 tests across 2 files. [11.37s]
```

- 与 audit-5 声明（186 pass / 0 fail / 4870 expect）**完全一致**。
- PHASE-04 测试文件（`p02-cli.test.ts`、`p02-cli-harness.ts`）存在，但不在 PHASE-03 测试范围，不影响 186 pass 基线。
- PHASE-03 三个文件（`p02-sentinel.ts`、`p02-orchestrator.ts`、`p02-orchestrator.test.ts`）git status 为 untracked，`types.ts` 为 modified，**无 PHASE-04 改动污染**。

## 4. negative control mutation 验证（plan-audit-archiver Step 4 补强）

audit-5 运行了 D1/D2 反例用例并 pass（正控制），但未做 mutation 验证（负控制敏感性）。本轮补做：

### D1 mutation 验证

- **buggy 实现**（audit-4 D1 OPEN 的 bug：用"最后一个业务事件"作失败边界）：
  - 对 D1-FAILURE-BOUNDARY 的 eventLog `[create-a, create-b, failure, cleanup-b(非法), stop-a]`，最后一个业务事件是 cleanup-b（index 3），suffix=[stop-a]，stop-a 非 BUSINESS_KINDS → **不 throw**。
  - 结论：buggy 实现下 `expect().toThrow()` 失败 → 测试 FAIL。negative control 敏感性已证明。
- **正确实现**（audit-5 fix：用"最后一个 failure 标记"作边界）：
  - 最后一个 failure 是 index 2，suffix=[cleanup-b, stop-a]，cleanup-b 是 BUSINESS_KINDS → **throw**。
  - 结论：正确实现下测试 PASS。positive control 成立。

### D2 mutation 验证

- **buggy 实现**（audit-4 D2 OPEN 的 bug：`catch {}` 吞所有信号错误）：
  - 对 EACCES 信号错误，buggy 实现 swallowed → `expect(threw=true)` 失败 → 测试 FAIL。negative control 敏感性已证明。
- **正确实现**（audit-5 fix：仅吞 ESRCH，非 ESRCH throw）：
  - 对 EACCES，correct 实现 threw → 测试 PASS。positive control 成立。
  - 对照：对 ESRCH，correct 实现 swallowed（ESRCH 可忽略）。

## 5. provenance 缺口分析（audit-5 未声明）

| 项 | audit-4 §10 | audit-5 §1 | 本轮复核 |
|---|---|---|---|
| scope-lock.json | 缺失 → 正式归档 BLOCKED | 未提及 | `audits/p0-2/scope-lock.json` 不存在 [VERIFIED] |
| evidence/ 目录 | 缺失 → 正式归档 BLOCKED | 未提及 | `audits/p0-2/evidence/` 不存在 [VERIFIED] |
| pre-change receipt | 缺失 → 正式归档 BLOCKED | 未提及 | 无法重建（实施已完成） |
| execution receipts (EV-NNN) | 缺失 → 正式归档 BLOCKED | 未提及 | audit-5 用 `Verified-by` 文字证据行，非 immutable receipt |
| `validate-audit.ts` 机器门 | 未运行 | 未运行 | audit-5 无 v2.1 JSON contract，无法通过机器门 [VERIFIED] |

**分歧判定**：
- audit-4 §10 明确"正式归档状态 BLOCKED：缺已批准 scope-lock、pre-change receipt 与不可变执行回执"。
- audit-5 §1 直接 Accept，未声明此 provenance 缺口，与 audit-4 §10 矛盾。
- 按 plan-audit-archiver invariant 11-13（Pre-change provenance required / Immutable execution receipts required / Machine gate required），audit-5 的 Accept 不能签署为 v2.1 正式 ACCEPT。
- 但在 component 级证据上限内，audit-5 的 D1–D4 运行态验证是充分的。provenance 缺口阻断的是 v2.1 正式签署，不阻断 component 级 DONE 判定。

## 6. 非阻断发现（NON_BLOCKING_DEBT）

### F-001: plan 文档 completion gate box 全部未勾选（项目约定，非缺陷）

- **现象**: `03-phase-sentinel-orchestrator.md:107-112` 的 6 个 completion gate box 全部为 `[ ]`，包括 D1/D2 closed 的 box。但括号文字声明"D1 closed per audit-5"、"D2 closed per audit-5"、"PHASE-03 DONE per audit-5"。
- **分类修正**: ~~原分类 NON_BLOCKING_DEBT（文档一致性）~~ → **项目约定（非缺陷）**。经 PHASE-04 审计确认，`04-phase-cli.md:106` 明确声明"全 `[ ]` 模式一致"是项目约定——DONE 状态由 `00-plan-index.md` 承载，completion gate box 维持 `[ ]` 合同形态以满足 PLAN_SET validator 要求 ≥1 未勾选 box。
- **rework-3 log 措辞澄清**: rework-3 log §"What" 声明"勾选 D1/D2 完成框"应理解为"在 box 文字中添加 D1/D2 closed per audit-5 引用"，而非 `[ ]` → `[x]` 勾选。
- **影响**: 不阻断 D1-D4 关闭。原"文档一致性"分类为误判，已修正为项目约定。
- **建议**: 无需处理（项目约定）。后续 plan 文档可统一在 completion gate 旁注明"box 维持 [ ] 合同形态"以避免歧义。

### F-002: audit-5 未声明 provenance 缺口

- **现象**: audit-5 §1 直接 Accept，未声明 plan-audit-archiver v2.1 provenance 缺口（scope-lock / pre-change receipt / execution receipts / validate-audit.ts 机器门）。
- **分类**: NON_BLOCKING_DEBT（文档完整性）
- **影响**: 不阻断 component 级 DONE，但 audit-5 应区分"component 级 Accept"与"v2.1 正式 ACCEPT"。
- **建议**: 后续审计如需 v2.1 正式签署，需 human approval scope-lock + 在实施前捕获 pre-change receipt。

## 7. Phase completion gate 对照

| Gate 项 | plan 文档 box | audit-5 §5 | 本轮复核 | 状态 |
|---|:---:|:---:|---|---|
| PHASE-02 evidence attached | `[ ]` | `[x]` | PHASE-02 已 DONE（00-plan-index:111） | 文档 box 未勾选但实质成立 |
| D1 failure boundary sensitive | `[ ]` (文字声明 closed) | `[x]` | mutation 验证 PASS | 实质关闭 |
| D2 sentinel fail-closed | `[ ]` (文字声明 closed) | `[x]` | mutation 验证 PASS | 实质关闭 |
| Component 0 fail | `[ ]` (文字声明 186 pass) | `[x]` | 186 pass / 0 fail | 实质成立 |
| PHASE-04 remains blocked | `[ ]` | `[ ]` | PHASE-04 已 DONE（audit-5 之后演进） | 不在复审范围 |
| P0-2 IN-PROGRESS | `[ ]` (文字声明 DONE per audit-5) | `[x]` | 00-plan-index:5 IN-PROGRESS | 实质成立 |

## 8. 证据边界

- `[VERIFIED]` D1–D4 实质关闭（代码层 + 测试层 + mutation 验证三者一致）。
- `[VERIFIED]` 测试基线 186 pass / 0 fail / 4870 expect，与 audit-5 声明一致。
- `[VERIFIED]` PHASE-03 文件无 PHASE-04 改动污染（git status untracked/modified，无后续 commit 改动）。
- `[VERIFIED]` provenance 缺口（scope-lock / evidence / validate-audit.ts 机器门均缺失）。
- `[RISK]` PHASE-04 已 DONE（00-plan-index:113），但不在本次复审范围；PHASE-04 的实施合法性需独立审计。
- `[VERIFIED]` 本审计未运行真实 `opencode serve`，结论上限严格为 component。

## 9. 判定

**Final Gate 判定：Accept（component 级，维持 audit-5 的 D1–D4 关闭判定）。**

- D1–D4 实质关闭，证据充分（含 mutation 验证）。
- PHASE-03 component 级 DONE 维持。
- 标注 1 项 NON_BLOCKING_DEBT（F-002 audit-5 未声明 provenance 缺口）+ 1 项项目约定（F-001 completion gate box 全 `[ ]`，经 PHASE-04 审计确认非缺陷），不阻断 component 级 DONE。
- plan-audit-archiver v2.1 正式 ACCEPT 仍 BLOCKED（provenance 缺口，需 human approval scope-lock + pre-change receipt 无法重建）。

## 10. 后续动作

1. `LATEST.md`：指针更新至 audit-6，记录"component 级 Accept 维持 + v2.1 正式 ACCEPT 仍 BLOCKED"。
2. `logs/`：新增本次复审归档日志。
3. F-002：NON_BLOCKING_DEBT（audit-5 未声明 provenance 缺口），后续 v2.1 正式签署时处理；F-001：项目约定（非缺陷），无需处理。
4. PHASE-04 已 DONE（00-plan-index:113），建议触发 PHASE-04 独立审计（不在本次复审范围）。

---

**审计完成时间**: 2026-07-19
**下次审计建议**: PHASE-04 独立审计（PHASE-04 实施合法性验证）
