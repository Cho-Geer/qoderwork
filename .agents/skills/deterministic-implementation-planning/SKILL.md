---
name: deterministic-implementation-planning
description: "Transforms approved blueprints, requirements, test specs, and audit reports into a deterministic, phase-by-phase implementation plan weak models can execute and verify / 将已批准的蓝图、需求、测试规格与审计报告转化为弱模型可执行可验证的确定性分阶段实施计划。Use when converting upstream documents into copy-pasteable steps. Trigger: 根据蓝图制定实施方案、详细实施步骤、弱模型实施、phase by phase. Not for: unresolved architecture choices, implementing code, or claiming runtime PASS without execution evidence."
---

# Deterministic Implementation Planning

## Language / 语言

Follow the user's language. Preserve paths, symbols, commands, API names, IDs,
status labels, and quoted source text exactly.

## Purpose

Produce an **implementation contract**, not a narrative summary. The output must
combine an exact specification, an operation manual, and an acceptance program.
A weak implementer reading only one Phase must know:

1. what it may and may not change;
2. the exact symbols, fields, states, and error semantics;
3. the only permitted implementation sequence;
4. the complete evidence fixture and negative matrix;
5. the commands and evidence required to advance.

Before authoring, read [PLAN-TEMPLATE.md](PLAN-TEMPLATE.md) and
[QUALITY-GATES.md](QUALITY-GATES.md) completely. Read
[PLAN-SET-TEMPLATE.md](PLAN-SET-TEMPLATE.md) completely only when the sizing
gate selects `PLAN_SET`. Use `scripts/validate-plan.ts` after writing the plan.

## Boundary with other skills

- Use `blueprint-creation` first when architecture choices remain open.
- Use this skill after the upstream design is approved or the user has selected
  one option.
- Use `requirements-to-test-specification` when the deliverable is only a test
  specification rather than an implementation plan.
- Use `guided-code-editing` after this plan exists and the user wants manual
  implementation guidance.
- Reference `plan-audit-archiver` for v2.1 provenance rules: any Fixed
  verification command containing `capture-state.ts --repository-root` must
  follow AGENTS.md §15 P-07 (repository_root = clean anchor work-one, never
  the audit workspace or current worktree).
- This skill does not implement code and does not mark product behavior PASS.

## Non-negotiable rules

1. **One path only.** Remove recommendations, alternatives, and convenience
   branches. Deterministic conditionals are allowed only when every branch and
   expected result is fixed by the upstream contract.
2. **No invented decisions.** Record unresolved decisions as
   `BLOCKED-BY-DECISION`; obtain a decision before producing a
   `READY-FOR-IMPLEMENTATION` plan.
3. **Current-code truth.** Verify live file paths, symbols, types, callers,
   commands, and environment facts. Historical documents cannot override cheap
   current evidence.
4. **Phase-local completeness.** Repeat every constraint needed by a Phase in
   that Phase. Do not require a weak model to merge distant sections or memory.
5. **Exact nouns.** Replace “all paths”, “valid marker”, “correct identity”, and
   similar abstractions with exact field lists and algorithms.
6. **Three-state negatives.** Distinguish `FOUND`, `NOT_FOUND`, and
   `UNAVAILABLE`. Negative success requires readable evidence, a successful
   query, and `NOT_FOUND`; `UNAVAILABLE` is always FAIL.
7. **Current versus historical evidence.** Requirements containing “current”,
   “still”, “continues”, or “after” must name a new observation command/API.
   Historical snapshots cannot satisfy them.
8. **Independent verification.** Tests must derive from upstream requirements,
   not from the implementation's current behavior.
9. **No evidence inflation.** `component`, `integration`, `runtime-smoke`, and
   `live-E2E` are separate. Never promote a lower-level PASS.
10. **Hard advancement gates.** An incomplete Phase blocks every dependent
    Phase. Passing the implementation's own tests is insufficient when the
    traceability or evidence gate fails.
11. **Bounded execution context.** Never trade Phase-local completeness for one
    oversized document. Use the sizing gate below; exceeding any hard limit is
    blocking and requires semantic Phase splitting.
12. **repository_root clean anchor.** Any Fixed verification command containing
    `capture-state.ts --repository-root` or `generate-evidence-receipt.ts
    --repository-root` must set it to the clean anchor repository (work-one:
    `/home/zhaoge/workspace/opencode/work-one`), never the audit workspace
    (qoderwork main repo or any `.worktrees/*` worktree). See AGENTS.md §15
    P-07. Violation makes the pre-change receipt fail `validate-audit.ts`
    (`DIRTY_PATH_OUTSIDE_SCOPE`), rendering the audit `INVALID`.

## Output sizing contract

Count Unicode code points with `[...source].length`; do not use `wc -w` for a
Chinese or mixed-language plan. Count code blocks, tables, and commands because
they consume model context too. Token estimates may be reported as warnings but
must not replace the deterministic character and line gates.

Choose exactly one output mode before drafting:

| Mode | Use only when | Hard limits |
|---|---|---|
| `SINGLE_FILE` | The complete plan has at most two executable Phases | 20,000 Unicode characters, 450 lines, 2 Phases |
| `PLAN_SET` | Any single-file limit would be exceeded | index: 8,000 characters/160 lines; each Phase: 14,000 characters/320 lines; final verification: 8,000 characters/160 lines; at most 8 Phases |

Every Phase in either mode also has these hard complexity limits:

- at most 10 local atomic requirements;
- at most 8 allowed files;
- at most 12 registered checks;
- exactly one independently verifiable outcome and one primary evidence level.

Crossing 80% of a character or line limit requires a warning and an immediate
review for a smaller semantic boundary. Crossing 100%, exceeding a complexity
limit, or adding a third Phase to `SINGLE_FILE` requires `PLAN_SET`; do not
shorten by deleting contracts, fixtures, mutations, diagnostics, or gates.

Split only at independently verifiable dependency boundaries. Never create
arbitrary `part-1`/`part-2` documents. A `PLAN_SET` must use:

```text
<plan-directory>/
├── 00-plan-index.md
├── 01-phase-<semantic-name>.md
├── ...
└── 99-final-verification.md
```

The index owns global source, decision, traceability, inventory, and Phase
ordering. Each Phase repeats every local constraint needed for execution. The
final file owns cross-Phase verification, rollback convergence, and closure.
If more than eight Phases are required, split the work into milestone plan sets.

## Required workflow

### Step 1: Freeze the input contract `[ANALYSIS]`

Read project instructions and every named upstream document completely. Create
a source ledger containing:

- absolute or repository-relative path;
- document version/status and relevant section IDs;
- authoritative decisions;
- explicit non-goals;
- evidence claims and whether they are current or historical.

Assign atomic IDs (`REQ-001`, `DEC-001`, `CON-001`, `NOGOAL-001`). Each item
must contain one condition, one required behavior, and one observable result.
Do not merge unrelated requirements into one ID.

### Step 2: Verify the current baseline `[ANALYSIS → VERIFICATION]`

Inspect the live repository before prescribing edits:

1. read applicable `AGENTS.md`, rules, and build/test configuration;
2. use the repository's code graph/index before text search when required;
3. confirm every named file, symbol, type field, caller, and command;
4. inspect the dirty worktree and preserve unrelated user changes;
5. run the cheapest non-mutating baseline checks needed to verify assumptions.

Record every baseline claim as `VERIFIED`, `UNVERIFIED`, or `CONFLICT`.

Verified-by: `<command or inspection>` -> `<exact fact>`

> **注意**：document intent and current implementation are different evidence
> classes. A plan based on stale symbols is not executable even if its design is
> conceptually correct.

### Step 3: Close decisions and conflicts `[ANALYSIS]`

Create a decision ledger with exactly these columns:

| ID | Question | Upstream decision | Current-code constraint | Final contract | Status |
|---|---|---|---|---|---|

Apply this precedence:

1. explicit user decision;
2. approved architecture/Blueprint decision;
3. explicit requirement or acceptance criterion;
4. verified current-code constraint;
5. historical note.

If two higher-priority sources conflict, stop and request a decision. Do not
hide the conflict inside a Phase or leave `TBD` in a ready plan.

### Step 4: Build end-to-end traceability `[ANALYSIS]`

For every in-scope requirement, create one row:

| Requirement | Source | File/symbol | Check name | Evidence source | Happy fixture | Single mutation | Test ID | Level |
|---|---|---|---|---|---|---|---|---|

The gate fails when:

- a requirement has no implementation symbol;
- a behavioral requirement has no check or observable result;
- a check has no evidence source;
- a negative check has no evidence-availability check;
- a check has no all-pass fixture or single-failure mutation;
- a claimed test level has no command capable of producing that level.

### Step 5: Design the Phase graph `[ANALYSIS]`

Split work at independently verifiable boundaries. Every Phase must declare:

- exact dependency and starting state;
- one outcome and one evidence level;
- allowed and forbidden files;
- fixed APIs, schemas, field lists, check names, states, and error results;
- numbered edit steps with exact anchors;
- complete all-pass fixture;
- single-check mutation matrix;
- fixed commands with cwd and required environment;
- rollback/failure convergence;
- a checkbox completion gate and explicit next-Phase prohibition.

Do not use time estimates as a substitute for dependencies. A Phase may contain
`N/A — <exact reason>` sections, but it may not omit them.

After drawing the graph, calculate the sizing and complexity metrics. Record
the selected `SINGLE_FILE` or `PLAN_SET` mode. If any limit is exceeded, split
the responsible Phase by outcome/dependency and calculate again. Do not proceed
to writing until every resulting document is within its hard limits.

### Step 6: Specify evidence semantics `[ANALYSIS]`

For each check, define:

```text
check name
source of truth
read/observation operation
PASS expression
FAIL expression
missing/corrupt/timeout behavior
failedChecks/error result
evidence level
```

For negative isolation or absence claims, always emit separate evidence gates:

```text
evidenceReadable === true
querySucceeded === true
targetExists === false
```

For lifecycle claims, name both provenance and time:

```text
historical start evidence  -> proves it started earlier
current inspection         -> proves it is still alive now
post-cleanup artifact read -> proves evidence survived cleanup
```

### Step 7: Write the plan `[ANALYSIS]`

For `SINGLE_FILE`, copy [PLAN-TEMPLATE.md](PLAN-TEMPLATE.md). For `PLAN_SET`,
copy [PLAN-SET-TEMPLATE.md](PLAN-SET-TEMPLATE.md) and create its exact directory
layout. Replace every placeholder. Keep the following logical section order
across the selected delivery mode:

1. Input contract and source ledger
2. Decisions, scope, and non-goals
3. Verified current baseline
4. End-to-end traceability
5. File change inventory
6. Phase-by-phase implementation
7. Global verification and evidence
8. Risks, failure convergence, and rollback
9. Final completion gate

The status may be `BLOCKED-BY-DECISION`, `READY-FOR-IMPLEMENTATION`,
`IN-PROGRESS`, or an evidence-qualified completion status. Never mark a plan
PASS merely because it was written.

### Step 8: Run the structural quality gate `[VERIFICATION]`

> **注意**：源码分析回答「代码意图是什么」，运行态验证回答「运行态实际是什么」。两者可能不一致——Step 1-7 写出的计划即使结构完整，也必须通过本步骤的实际运行结果来证实。

Run:

```bash
cd <repository-root>
bun run <skill-dir>/scripts/validate-plan.ts <plan-file-or-directory>
```

The command must exit 0. Treat every error as blocking. Review warnings and
either fix them or add an explicit, evidence-backed exception to the plan.

Verified-by: `validate-plan.ts <plan-file-or-directory>` -> `errors=0`

> **合理化检测**：如果你发现自己在想“计划内容已经很详细，不需要机械检查”，停下来。Detail does not prove completeness or internal consistency.

### Step 9: Perform adversarial reverse review `[OBSERVATION]`

Review from acceptance back to implementation, not from steps forward:

1. Can every requirement make one named check fail?
2. Can missing evidence accidentally satisfy a negative check?
3. Can stale evidence satisfy a current-state claim?
4. Can an all-pass fixture omit the object being verified?
5. Can one mutation fail multiple checks while the test still passes?
6. Can an implementation stay within tests but violate an upstream non-goal?
7. Can a lower-level command be reported as a higher-level PASS?
8. Can a Phase advance with empty diagnostics or unresolved decisions?

Use the adversarial cases in [QUALITY-GATES.md](QUALITY-GATES.md). Any “yes” is
a plan defect and must be repaired before handoff.

### Step 10: Produce the handoff `[OBSERVATION]`

Report:

- output plan path and status;
- source conflicts and decisions resolved;
- requirement/check/test counts;
- validation command and result;
- known `OPEN`/`BLOCKED` items;
- exact first executable Phase;
- evidence level not yet run.

Do not summarize away blockers. Do not instruct implementation to begin unless
the plan status is `READY-FOR-IMPLEMENTATION`.

## Quality gate

- [ ] Every named source was read and appears in the source ledger.
- [ ] Every live-code claim has current evidence or an `UNVERIFIED` marker.
- [ ] The ready plan contains no unresolved options, `TBD`, or placeholders.
- [ ] Every Phase is self-contained and uses exact paths/symbols/fields.
- [ ] The selected output mode and every document satisfy all hard sizing and
      complexity limits.
- [ ] A `PLAN_SET` has no missing, duplicate, unregistered, forward-dependent,
      or dependency-mismatched Phase.
- [ ] Every requirement maps to a symbol, check, fixture, mutation, and test.
- [ ] Negative checks separate absence from unavailable evidence.
- [ ] Current-state claims use a current observation.
- [ ] All-pass fixtures create every evidence object being asserted.
- [ ] Every check has an exact single-failure test and diagnostic result.
- [ ] Commands include cwd, environment, expected level, and stop condition.
- [ ] Phase gates block downstream work on any failure.
- [ ] Structural validator exits 0 and adversarial reverse review finds no gap.
