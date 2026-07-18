# Quality Gates and Adversarial Review

Use this reference after drafting and before handing off an implementation plan.

## Contents

1. Ambiguity, negative evidence, and current-state gates
2. Exact-field, fixture, and single-failure gates
3. Scope, evidence-level, and diagnostic gates
4. Weak-model simulation
5. Context-budget gate
6. Cross-document integrity gate

## 1. Ambiguity gate

Search for these terms and replace them with exact contracts or an explicit
blocking decision:

```text
all / complete / correct / valid / appropriate / as needed / if convenient
所有 / 全部 / 正确 / 有效 / 完整 / 适当 / 必要时 / 酌情 / 可以考虑
推荐 / 可选 / 方案 A / 方案 B / 二选一 / TBD / TODO / 待定
```

Deterministic `if X, then Y, otherwise Z` is allowed only when X, Y, and Z are
fully specified and upstream-approved.

## 2. Negative evidence gate

For each absence, isolation, cleanup, or “must not exist” requirement, try these
adversarial inputs:

| Case | Required result |
|---|---|
| Evidence file missing | FAIL: evidence-readable check |
| File unreadable or malformed | FAIL: evidence-readable/parse check |
| DB opens but target table missing | FAIL: query-available check |
| Query succeeds and row is absent | PASS for the negative target check |
| Query succeeds and row is present | FAIL for the negative target check |

A boolean helper returning `false` for both “absent” and “unavailable” cannot be
negated safely without a separate evidence gate.

## 3. Current-state gate

Words such as “still”, “continues”, “after stop”, and “currently” require a new
observation after the state transition. Reject plans that use:

- a start-time health result to prove post-stop health;
- a stored PID without current identity validation;
- file existence without parsing and identity matching;
- a historical log to prove a current process or DB state.

## 4. Exact-field gate

When an upstream requirement says “all fields/paths/checks”:

1. open the current type/schema;
2. copy every field literally into the plan;
3. define comparison, containment, null, and missing behavior;
4. add a mutation test for every field or a table-driven test that reports the
   exact failing field;
5. add a meta-test comparing the registry with the live type when practical.

## 5. Fixture completeness gate

For every all-pass test, list each evidence object the verifier reads. The
fixture must create a valid instance before the verifier runs. A missing object
must never serve as evidence that contamination or side effects are absent.

Ask:

- Does every DB file exist?
- Does every required table exist even when it should contain no target row?
- Do markers contain every identity/provenance field?
- Are logs/events intentionally present and parseable?
- Are current-process checks backed by controlled live processes?
- Are post-cleanup artifacts intentionally preserved?

## 6. Single-failure gate

For each check `C`:

```text
start from the complete all-pass fixture
apply exactly one mutation
assert ok === false
assert checks[C] === false
assert failedChecks === [C]
assert every other registered check remains true
```

`toContain(C)` is insufficient because multiple accidental failures can hide a
bad fixture or coupled checks.

## 7. Scope and non-goal gate

Compare the planned file inventory with the allowed scope. Reject:

- opportunistic refactors;
- new shared APIs not named by the upstream decision;
- changing production behavior to make a verifier test easier;
- weakening an assertion or deleting a test;
- adding a fallback that converts a missing prerequisite into PASS;
- modifying a dependent Phase before the current gate is complete.

## 8. Evidence-level gate

| Evidence | May claim |
|---|---|
| Static inspection | analysis only |
| Unit/component test | component PASS only |
| Multi-component process test | integration PASS |
| Real isolated lifecycle | runtime-smoke PASS |
| Authorized real-model workflow | live-E2E PASS |

Commands, environment, run IDs, and retained artifacts must support the claimed
level. A historical higher-level PASS cannot automatically cover new code.

## 9. Diagnostic gate

Every failed prerequisite must have a stable diagnostic name. Reject:

- `ok:false` with an empty failure list;
- silent catch followed by PASS;
- skipped dependent checks with no explanation;
- one generic “verificationFailed” result for unrelated failures;
- exceptions whose expected result is not documented.

## 10. Weak-model simulation

Before handoff, deliberately take the narrowest literal interpretation of each
Phase. If that interpretation can omit a requirement and still pass the written
commands, the plan is not closed-world. Add exact fields, fixture objects,
mutations, commands, or gates until the shortcut becomes an explicit failure.

## 11. Context-budget gate

Measure Unicode code points and lines after the plan is complete. Include code
blocks, tables, and commands. Do not use whitespace-delimited word counts for
Chinese or mixed-language plans.

| Scope | Character limit | Line limit | Complexity limit |
|---|---:|---:|---|
| `SINGLE_FILE` plan | 20,000 | 450 | at most 2 Phases |
| `PLAN_SET` index | 8,000 | 160 | at most 8 manifest rows |
| one Phase | 14,000 | 320 | 10 requirements, 8 files, 12 checks |
| final verification | 8,000 | 160 | cross-Phase closure only |

At 80% of a size limit, review whether the document contains two independently
verifiable outcomes. Above any hard limit, reject the document and split by
dependency/outcome. Never make it pass by removing exact contracts, evidence
semantics, fixtures, mutation cases, commands, or completion gates.

## 12. Cross-document integrity gate

For a `PLAN_SET`, reject:

- a missing `00-plan-index.md` or `99-final-verification.md`;
- a manifest with non-contiguous order, duplicate IDs, or duplicate files;
- a dependency on an unknown, same, or later Phase;
- a registered Phase file that is missing;
- an unregistered `NN-phase-*.md` file;
- a Phase whose declared ID/dependency differs from the manifest;
- a Phase that depends on another Phase for its local execution contract;
- more than eight Phases in one plan set.

Read one Phase in isolation during weak-model simulation. If it cannot be
executed and verified without another Phase document or remembered context, the
split is invalid even when the directory validator passes.
