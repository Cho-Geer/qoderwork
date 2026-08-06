# Dual-Review Record — task-lens-m1 旧版 v2.1 在新框架下的过时性审计

**Date**: 2026-08-05
**Reviewers**: Main session (first) + high-precision subagent (second) + Main session re-verify
**Method**: SINGLE-mode 强制 + audit-separation §c 双层复审(`dual-review-template-for-stale-rule-audit`)
**Scope**: `plans/task-lens-m1/` 9 file plan-set, supporting audits, cross-section propagation, framework alignment

---

## 1. 用户问题与判定目标

- Q1: `plans/task-lens-m1/` 是否过时?
- Q2: 是否符合当前框架 (outcome-governance/v1 + provenance `v3-required`)?
- Q3: 是否需要更新?如需要,需要什么类型?

---

## 2. First Reviewer Findings (主会话, 独立跑命令)

| ID | Claim | Verified-by |
|---|---|---|
| F1 | plan-index L9 + L52 仍写 `provenance_level: v2.1-required`;7 个 scope-lock + 1 个 phase-freeze-gate doc 全部沿用 | `grep -n "v2.1-required\|v3-required" plans/task-lens-m1/*.md audits/task-lens-m1/*.json` → 9 hit, 全为 v2.1 |
| F2 | outcome-governance/v1 artifacts 完全 NOT_FOUND(contract/acceptance-spec/test-bundle 三件套) | `ls audits/task-lens-m1/{contract,acceptance-spec,test-bundle}.json` → 全 ENOENT |
| F3 | cross-section propagation 共 15+ 文件引用 task-lens-m1 | `grep -rln "task-lens-m1\|TASK-LENS-M1" documents/ blueprints/ logs/INDEX.md audits/ plans/` → 15 文件 |
| F4 | 99-final-verification.md L23 引用的 `bun run scripts/validate-plan.ts` 实际路径在 `.agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts` | `find . -name "validate-plan.ts" -not -path "*/node_modules/*"` → 仅 1 hit,实际为 skill 文件 |
| F5 | phase-progression schema 仍为 `phase-progression/v1`(legacy) | `grep -n "phase-progression\|progression schema" plans/task-lens-m1/00-plan-index.md` L6 |
| F6 | script 路径引用全部 fireable | 每个 `bun run scripts/...` 路径都先 `test -f` 验证 |

---

## 3. Second Reviewer Independent Findings (high-precision subagent)

完整 R1~R7 见 subagent 返回报告。关键产出:

- **STALE 总数: 11 条** (涉及 plan-index ×2、scope-lock ×5、phase ×1、audit ×1、LATEST ×1、handoff ×1、INDEX ×1)
- **可升级的字面位置 = 5 处** (AGENTS.md L531 豁免不可改写: 7 处)
- **Path B 推荐** (原位 v3 升级 + outcome-v1 后挂)
- **C-01~C-09 critical findings list** 完整

---

## 4. Main Session Cross-Check (audit-separation §c 强制)

独立验证 subagent 关键 claim(不直接采信),`grep/sed/wc/file` 重跑:

| Subagent claim | 独立验证 | Verdict |
|---|---|---|
| plan-index L9/L52 含 v2.1 | grep 命中 L9 + L52 (各 1 行, 总 2 行) | ✅ |
| 7 个 scope-lock 含 v2.1 | grep -c 6 文件含 1 处 (PHASE-05-G2.json 0 字节) | ✅ |
| PHASE-05-G2.json 空文件 | wc -c = 0 | ✅ |
| handoff L97 含 v2.1 | sed -n '95,100p' handoff/task-lens-resume.md → L97 字面命中 | ✅ |
| documents/INDEX.md L46 含 v2.1 | sed -n '44,52p' → L46 「v2.1-required Freeze Gate」 | ✅ |
| phase-05 audit L396 含 v2.1 | sed -n '395,410p' → 命中 "(component ceiling for v2.1-required plan)" | ✅ |
| AGENTS.md L529/L531 legacy 切割 | sed -n '525,540p' → L531「历史 audit、scope-lock、receipt 和报告不得为迁移而改写」 | ✅ |
| scope-lock-template.json schema v1 | head template → L2 "schema_version: "audit-scope-lock/v3"" | (实测与 subagent 不同: template 已经是 v3,不是 v1) |
| PHASE-06/07 status 不一致 | LATEST.md L3 「PHASE-06 (NOT_STARTED)」vs plan-index L132 「PHASE-06 ... BLOCKED」 | ✅(NON_BLOCKING_DEBT) |

**Cross-check 偏差 → Escalate**: 4 处偏差,1 处是 subagent 我自己对 schema_version 表述不精确(内容方向对的,template 确实是 v3 schema_version),其余 subagent 主判断与 main session 一致。

---

## 5. Final Verdict — 三个用户问题的明确回答

### Q1: 任务透镜 M1 是否过时?
**部分过时**。
- `provenance_level` 字段值违规 P-01(`v2.1-required` 不在 `{v3-required, component-only}` 有效集合内)
- 跨章节文字引用部分滞后(documents/INDEX.md L46, handoff L97)
- plan-index 第 §6 phase manifest 写 PHASE-05 「NOT_STARTED」、PHASE-06/07 「BLOCKED」 与 LATEST.md「PHASE-05 ACCEPTED」「PHASE-06 (NOT_STARTED)」严重不一致(**NON-BLOCKING debt**,同等语义,但必须统一)
- PHASE-01..05 evidence 不需回溯

### Q2: 是否符合当前 outcome-governance/v1 框架?
**N/A — 不接管**。
- outcome-governance/SKILL.md L51 + AGENTS.md L529/L531 显式切割: legacy plan 不被 outcome-governance 接管;outcome-governance/v1 是新工作的默认入口,不追溯。
- 不强制 task-lens-m1 重建 outcome-contract。

### Q3: 是否需要更新?需要什么类型?
**推荐 Path B: 最小字面升级**(5 处文字改动 + LATEST.md 加注批注 + PHASE-06/07 v3 schema scope-lock)。

理由:
1. 5 处文字修改,不动任何已签字 audit/scope-lock/receipt(符合 AGENTS.md L531)
2. PHASE-06/07 在 v3 schema 下可直接继续(用 `audits/blueprints-governance/phase-04-scope-lock.yaml` 模板)
3. outcome-v1 重建可后挂到 PHASE-06/07 完成后或 M2 启动时(避免浪费已有 evidence)
4. 保留 path-dynamic-resolution-m1 先例的"先完成 v3 实施再 outcome 冻结"语义

---

## 6. 立即可执行的更新清单(Path B 具体步骤)

下游实施 agent 接到此记录后,按以下顺序执行(均为单文件文字修改,无跨章节依赖):

| # | 文件 | 当前 | 目标 | 行号 |
|---|---|---|---|---|
| 1 | `plans/task-lens-m1/00-plan-index.md` | L9 `Provenance level`: `v2.1-required` | `v3-required` | L9 |
| 2 | `plans/task-lens-m1/00-plan-index.md` | L52 DEC-006 ledger `v2.1-required` | `v3-required` | L52 |
| 3 | `plans/task-lens-m1/01-phase-freeze-gate.md` | L48 引用 `scope.provenance_level="v2.1-required"` | `v3-required` | L48 |
| 4 | `handoff/task-lens-resume.md` | L97 「声明 `provenance_level: v2.1-required`」 | `v3-required` | L97 |
| 5 | `documents/INDEX.md` | L46 蓝图描述「v2.1-required Freeze Gate」 | `v3-required Freeze Gate` | L46 |

加上 (非强制但建议):

| # | 文件 | 加注内容 |
|---|---|---|
| 6 | `audits/task-lens-m1/LATEST.md` | 在 L3 后加注一行: `> Note (2026-08-05): plan upgraded to v3-required per provenance-rules.md 2026-07-28 migration; PHASE-01..05 scope-locks/reports remain historical at v2.1 schema per AGENTS.md L531 grandfather clause.` |
| 7 | `audits/task-lens-m1/2026-07-24-phase-05-audit.md` | L396–L407 改 `(component ceiling for v3-required plan)` (措辞修正,内容语义不变) |

**严禁改写**(AGENTS.md L531 grandfather):
- 6 个历史 scope-lock JSONs(`PHASE-01..05` + `PHASE-05-amendment`;`PHASE-05-G2.json` 0 字节空文件单独处理)
- PHASE-01..05 五份 audit 报告(除上述措辞微调外)
- 5 套 evidence receipts (`pre-change-PHASE-XX.json` + `verdict-state-PHASE-XX.json` + `progression-receipt-PHASE-XX.json` 等)
- `audits/task-lens-m1/LATEST.md` 的 verdict 字段

**PHASE-06/07 新文件**(独立,不影响历史):
- `audits/task-lens-m1/scope-lock-PHASE-06.json`(用 `.agents/skills/plan-audit-archiver/templates/scope-lock-template.json` + `audits/blueprints-governance/phase-04-scope-lock.yaml` 模板,`provenance_level: v3-required`,`schema_version: audit-scope-lock/v3`)
- `audits/task-lens-m1/evidence/pre-change-PHASE-06.json`(由 `.agents/skills/plan-audit-archiver/scripts/capture-state.ts` 生成)
- PHASE-07 同理

---

## 7. 关键判定节点

- **Path A (SUPERSEDED + 重建)**: 不推荐。会强制历史 PHASE-01..05 证据退化为 historical,浪费已签字 verdict。
- **Path C (不变)**: 不可。违反 P-01 取值规则,PHASE-06/07 永久不可启动。
- **Path B (原位升级)**: 推荐。最小变更 + 最高兼容性。

---

## 8. Follow-up 显式记录(per [[post-final-gate-suggestion-recording]])

下一步如用户同意 Path B:
1. 创建 `plans/task-lens-m1/00-plan-index.md` 的 v3 升级 patch(或 Edit 逐行)
2. 同编辑 `01-phase-freeze-gate.md` L48, `handoff/task-lens-resume.md` L97, `documents/INDEX.md` L46
3. `audits/task-lens-m1/LATEST.md` 加注 (不删/不改 verdict)
4. `logs/2026-08-05-task-lens-m1-v3-provenance-upgrade.md` 写入完整 patch + diff
5. `bun run scripts/validate-plan.ts plans/task-lens-m1` 跑结构校验(确认升级后无回归)
6. `git status --short` + `git log origin..HEAD` 双层 git 验证(per [[git-persistence-gap-circular-validation]])
7. **可选**:新建 `plans/task-lens-outcome-v1/` 作为 M2/acceptance-side outcome-governance 重建(M1 不动,仅作前瞻路径)

不强制,但可考虑:
- 修 `audits/task-lens-m1/scope-lock-PHASE-05-G2.json` 0 字节空文件(补占位符 [NOT-STARTED],或删除引用)— 需用户裁决,因为它处于 grandfathered 与非 grandfathered 边界

---

## 9. Related 路径参考

- 模板范例: `audits/blueprints-governance/phase-04-scope-lock.yaml` (v3 schema 实活)
- v3 schema template: `.agents/skills/plan-audit-archiver/templates/scope-lock-template.json`
- 先例 (不要照搬 SUPERSEDED): `plans/path-dynamic-resolution-m1/00-plan-index.md` L7-9
- outcome-v1 重建例子: `plans/path-dynamic-resolution-outcome-v1/outcome-contract.json`

---

**双层复审结果(v1)**:两个 reviewer(main-session first + general-purpose second)同意 Path B。该结论 **已在 v2 复审中被 high-precision 推翻**,详见 §10。

---

## 10. High-Precision 复审(v2)— 推翻 Path B 推荐

**触发**:用户指出第一次派遣的是 `subagent_type: general-purpose`,而非 task-execution-framework §3.7 判断 3 要求的 `high-precision` 复审角色。重新派遣 high-precision 做独立对抗性审查。

### 10.1 关键 Verified-by 证据(主会话独立 cross-check)

- **V1 — validate-plan.ts 是 v3-only**:`sed -n '50,145p' .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts` → L67-71 硬要求 `Schema version: audit-plan-set/v3` + `Document kind: plan-set-index`;L73-78 硬要求 `Canonical contract` + SHA-256 + `Approval decision` + SHA-256;**缺任一即 `ERR_PLAN_SCHEMA_UNSUPPORTED` 并 return,不进入 phase manifest 检查**。task-lens-m1 00-plan-index.md `grep "Schema version\|Document kind\|Canonical contract\|Approval decision"` 空。
- **V2 — plan 调用签名错误**:`99-final-verification.md` L24 写 `bun run validate-plan.ts plans/task-lens-m1`(1-arg);脚本实际是 2-arg `(inputPath, governanceRoot)`,1-arg 会 fail with `governanceRoot must be an existing qoderwork worktree directory`。
- **V3 — prior "5 处文字升级"漏报**:`grep -n "v2.1" plans/task-lens-m1/*.md` 实际 9 处 plan 目录内 v2.1 字面(00=2, 01=1, **07=6**)。07-phase-acceptance-closure.md L11/40/70/91/118/177 全漏。另有 blueprint-task-lens-m1.md L302/L394 也漏。
- **V4 — /home/zhaoge 路径硬编码 24 处**:`grep -rc "home/zhaoge" plans/task-lens-m1/*.md` → 8 文件(01=6,02=1,03=1,04=1,05=1,**06=7**,07=4,99=3)。当前 win32 环境全失效。这是独立于 provenance 的第二过时维度。
- **V5 — PHASE-05 状态分裂 critical**:`handoff/2026-07-25-task-lens-phase05-g2-blocked.md` L90 明确说「旧 PHASE-05 G1 audit/LATEST 不可信...不得将 LATEST 当放行依据」;L94 G2 未创建;G2.json 0 字节;handoff 状态 BLOCKED;但 LATEST.md 仍写 PHASE-05 ACCEPTED → 三处冲突,且 handoff 是治理层权威说法。
- **V6 — Path A "浪费 evidence" 理由不成立**:`grep -n "SUPERSEDED\|ACCEPTED" plans/path-dynamic-resolution-m1/00-plan-index.md` L7 SUPERSEDED + L136-139 PHASE-01..04 全 ACCEPTED;先例证明 SUPERSEDED 保留 4 个 ACCEPTED phase evidence 不删除。
- **V7 — documents/INDEX.md L9 vs L46 内部矛盾**:`sed -n '9p;46p' documents/INDEX.md` → L9 已声明"v2.1-required 已升级为 v3-required",L46 蓝图描述仍写"v2.1-required Freeze Gate...尚未实施",同文件内自相矛盾。
- **V8 — PHASE-05-G2.json 0 字节**:`ls -la audits/task-lens-m1/scope-lock-PHASE-05-G2.json` → 0 bytes;plan/05 L141 `test -s` 会 fail;handoff L57 明确"不是 scope lock,不能批准、不能引用"。

### 10.2 Path B 为什么不可行(纠正)

先前 Path B 推荐基于三个错误前提:

1. **错误前提 1**:改 `provenance_level` v2.1→v3 能让 validate-plan.ts 通过。  
   **事实**:validator 根本不检查 `Provenance level` 字段;它要求 v3 PLAN_SET 结构(Schema version/Document kind/Canonical contract/Approval decision),task-lens-m1 完全没有这些字段,改 5 处字面 validator 仍然 fail at ERR_PLAN_SCHEMA_UNSUPPORTED。

2. **错误前提 2**:PHASE-05 ACCEPTED 是已知事实,Path B 只需继续 PHASE-06/07。  
   **事实**:2026-07-25 handoff 明确说 G1 ACCEPT 不可信、LATEST.md 不可作为放行依据、G2 未创建且 BLOCKED。PHASE-05 真实状态需先裁决。

3. **错误前提 3**:Path A (SUPERSEDED) 会"浪费"5 份已签字 ACCEPT evidence。  
   **事实**:path-dynamic-resolution-m1 先例证明 SUPERSEDED 是改 plan-index Status 字段,历史 evidence 全部保留在 audits/ 下作为 historical reference,不删除、不浪费。prior 把"不再作为 active admission 依据"误等同于"删除"。

### 10.3 最终推荐(v2)— Path A 改良版,前置 PHASE-05 状态裁决

**推荐:先裁决 PHASE-05 状态分裂,然后将 task-lens-m1 标记 SUPERSEDED_BY_OUTCOME_GOVERNANCE_V1,在 plans/task-lens-outcome-v1/ 重建 outcome 三件套。**

步骤顺序:
1. **用户裁决 PHASE-05 真实 verdict**:LATEST.md ACCEPTED(声明) vs handoff BLOCKED(治理层) 哪个为准?如 handoff 为准则撤销 LATEST 错误声明;如 LATEST 为准则 handoff 已被后续工作推翻(但 2026-07-25 之后无后续 task-lens 日志,需用户确认)。
2. **plan-index Status 改为 SUPERSEDED_BY_OUTCOME_GOVERNANCE_V1**(参考 path-dynamic-resolution-m1 L7-9 字段头模板)。
3. **新建 plans/task-lens-outcome-v1/outcome-contract.json** + acceptance-spec + test-bundle + approval + ledger-event(参考 plans/path-dynamic-resolution-outcome-v1/ 结构)。
4. **历史 scope-lock/audit/receipts 全部保留不动**(AGENTS.md L531 豁免;不删、不改、不重写)。
5. **PHASE-06/07 不再走 phase-progression/v1**,改为 outcome-governance 的 run-receipt/run-result 链。
6. **跨章节同步**:documents/INDEX.md L46、blueprints/INDEX.md L28、handoff/task-lens-resume.md L97、blueprint-task-lens-m1.md L302/L394、07-phase 6 处 v2.1 引用 — 全部加 SUPERSEDED 注记或更新。

**拒绝 Path C(不变)**:P-01 字面禁止 v2.1 取值;provenance-rules grep "过渡|grandfather|transition" 空,无过渡条款。

### 10.4 Prior reviewer 漏点(供未来复审参考)

| 漏点 | 严重度 | 教训 |
|---|---|---|
| 误判 validate-plan.ts 检查对象(以为检查 provenance,实际检查 v3 PLAN_SET 结构) | CRITICAL | 必须 `head -150` validator 源码,不能从字段名推断 |
| 漏报 07-phase 6 处 v2.1 + blueprint 2 处 | HIGH | `grep -rc` 后必须逐文件 `grep -n` 列出行号 |
| 漏报 PHASE-05 状态分裂(LATEST vs handoff) | CRITICAL | 状态断言必须 `ls handoff/ | grep <plan>` 反向验证 |
| 漏报 /home/zhaoge 24 处 win32 失效 | HIGH | 过时性审计要包含"环境迁移"维度,不能只看规则版本 |
| 误判 Path A "浪费 evidence" | HIGH | SUPERSEDED 先例必须实测 evidence 是否被删除(`ls audits/path-dynamic-resolution-m1/`) |
| 漏报 validate-plan.ts 2-arg 签名 | MEDIUM | `bun run <script>` 路径必须 `head -50` 看 argv 解析 |
| 第一次派遣用了 general-purpose 而非 high-precision | HIGH | task-execution-framework §3.7 判断 3 明确要求 high-precision 复审;audit-separation §c 不允许用同推理深度角色自我复审 |

### 10.5 最终最终结论

- **Q1 是否过时**:是,**严重过时**。不仅 provenance_level v2.1→v3 字面问题,还包括(1)plan-index 缺 v3 PLAN_SET 结构字段,(2)validate-plan.ts 调用 1-arg 错误,(3)PHASE-05 状态三处分裂,(4)07-phase 6 处 + blueprint 2 处 v2.1 漏报,(5)/home/zhaoge 24 处 win32 失效,(6)documents/INDEX.md L9 vs L46 自相矛盾,(7)G2.json 0 字节空文件。
- **Q2 是否符合新框架**:**不符合**。validate-plan.ts(v3-only)对当前 plan-index 立即返回 ERR_PLAN_SCHEMA_UNSUPPORTED;不是"N/A 不接管",是"validator 直接拒绝"。
- **Q3 是否需要更新**:**是,Path A 改良版(SUPERSEDED + outcome-v1 重建)**;不是 Path B 原位升级;前置用户裁决 PHASE-05 状态。

### 10.6 Main-Session Self-Correction

我先前在 §5 给出 Path B 推荐是错的。错误根因:
1. 派遣时用了 `subagent_type: general-purpose` 而非 high-precision(违反 §3.7 判断 3);
2. 我作为 first reviewer 没有 `head -150 validate-plan.ts` 读 validator 源码,凭"v2.1→v3 字面升级"推断能过 validator(典型的合理化模式 — task-execution-framework §5.6 "代码已经清楚表明");
3. 我把 LATEST.md 的 PHASE-05 ACCEPTED 当真,没有 `ls handoff/ | grep task-lens` 反向验证(违反 verify-before-concluding);
4. 我引用 path-dynamic-resolution-m1 作为"不要照搬 SUPERSEDED"模板,但没有实测它 SUPERSEDED 后 evidence 是否保留,导致"Path A 浪费 evidence"的错误判断。

high-precision 复审 + 主会话 8 项独立 cross-check(V1~V8)确认这些错误全部成立。**§5 之前的 Path B 推荐作废,以 §10.3 为准**。
