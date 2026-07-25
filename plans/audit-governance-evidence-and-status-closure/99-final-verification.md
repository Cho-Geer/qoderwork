# 审计证据、状态与报告闭环 — Final Verification

**Plan ID**: `AUDIT-GOVERNANCE-CLOSURE-PLANSET-20260725`
**Current status**: `NOT-RUN`
**First executable Phase**: `PHASE-01`
**Evidence ceiling**: `integration`

## 7. Global verification and evidence

| Level | Command | Preconditions | Exact PASS condition | Artifacts | Current status |
|---|---|---|---|---|---|
| structural | plan validator | full PLAN_SET exists | errors empty | validator JSON | NOT-RUN |
| governance | Phase Freeze Gate | human approved scope-lock per phase | receipt, HEAD, admission match | locks and state receipts | NOT-RUN |
| component | direct script tests | PHASE-01 through PHASE-04 accepted in order | each test exits 0 | test output | NOT-RUN |
| integration | audit-governance fixture | PHASE-04 accepted | real temp Git/workspace report and pointer agree | fixture report and pointer | NOT-RUN |
| build | workspace typecheck | target test files exist | no new diagnostic | typecheck output | NOT-RUN |
| manual | policy wording review | generated documentation available | no manual publication or evidence promotion instruction | review receipt | NOT-RUN |

### Fixed global command

```bash
cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan
bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts plans/audit-governance-evidence-and-status-closure
bun test .agents/skills/deterministic-implementation-planning/scripts/validate-plan.test.ts
bun test .agents/skills/plan-audit-archiver/scripts/__tests__/pre-check-evidence.test.ts
bun test .agents/skills/plan-audit-archiver/scripts/__tests__/validate-audit.test.ts
bun test .agents/skills/plan-audit-archiver/scripts/__tests__/prepare-audit.test.ts
bun test .agents/skills/plan-audit-archiver/scripts/__tests__/finalize-audit.test.ts
bun test .agents/skills/plan-audit-archiver/scripts/__tests__/audit-governance-integration.test.ts
bun run typecheck
git diff --check
git diff --exit-code -- bun.lock
```

- Any nonzero exit, missing artifact, `NOT_FOUND`, or `UNAVAILABLE` blocks final acceptance.
- The plan validator only proves plan structure. Component tests do not prove integration. The integration fixture does not prove runtime-smoke or live-LLM-E2E.

### Evidence preservation

- Preserve approved scope-locks, pre-change receipts, contract JSON, listed receipts, validator output, immutable report, LATEST pointer, and test output.
- An unreferenced report created before a failed pointer transition is retained as an orphan candidate and is never reported as published.
- Preserve failed temporary fixture paths until their receipt records the failure boundary; do not delete or overwrite evidence to obtain a green retry.

### Evidence ceiling rule

- `ACCEPT` and `REWORK` require actual receipt and ceiling levels at or above every PASS or FAIL requirement.
- `BLOCKED` and `INVALID` may disclose a limitation but cannot promote lower evidence.
- `FOUND` is the only positive observation. `NOT_FOUND` and `UNAVAILABLE` are not absence proof or success.

### Cross-Phase traceability gate

| Requirement | Owning Phase | Required final evidence | Advance blocker |
|---|---|---|---|
| REQ-001 | PHASE-01 | status-local gate tests | gate parse or receipt mismatch |
| REQ-002 | PHASE-02 | contract-list pre-check tests | missing, outside, hash, level, or identity mismatch |
| REQ-003 | PHASE-03 | ceiling/verdict regression tests | lower evidence or declaration promoted to acceptance |
| REQ-004 | PHASE-04 | complete contract generation test | placeholder, default, or shallow receipt discovery |
| REQ-005 | PHASE-04 | report and hash-bound pointer tests | invalid report, report overwrite, or pointer conflict |
| REQ-006 | PHASE-05 | real Git/workspace integration and policy review | manual status path, log ownership conflict, or evidence inflation |

## 8. Risks, failure convergence, and rollback

| Risk | Trigger | Detection | Fixed convergence | Evidence retained |
|---|---|---|---|---|
| pre-check false pass | nested receipt ignored | AGC-C-201 | contract-list validator rejects | contract and nested receipt |
| level inflation | component evidence for integration requirement | AGC-C-301 | no ACCEPT or REWORK | validator issue output |
| partial publication | pointer conflict after report write | AGC-I-502 | old LATEST remains; new report is orphan candidate | old pointer and report hash |
| generated invalid input | omitted actual command or default value | AGC-C-401 | no contract write | generator diagnostics |
| manual status drift | prose changes LATEST | AGC-I-603 | policy test rejects | document scan output |
| log overwrite | foreign logs index edit | PHASE-05 precondition | BLOCKED; request owner decision | git diff evidence |
| fixture overclaims | test level mislabeled | final review | retain exact component/integration labels | test output |

### Rollback convergence

1. Revert only the active Phase allowlist after capturing its test and state evidence.
2. Never modify work-one, `bun.lock`, historical audit reports, or user-owned dirty files to reach a green result.
3. A publication conflict keeps the prior LATEST pointer authoritative; do not hand-edit it or delete an orphan candidate.
4. Re-run the active Phase verification and the full global command after any scoped revert.

## 9. Final completion gate

- [ ] Each Phase has human-approved scope-lock, nonempty pre-change receipt, signed ACCEPT audit, and valid progression receipt.
- [ ] REQ-001 through REQ-006 each have one passing all-pass fixture and one sensitive single mutation.
- [ ] Contract receipt discovery supports nested paths and cannot pass from a shallow-empty directory.
- [ ] Lower evidence cannot sign ACCEPT or REWORK; limitation declarations do not change that rule.
- [ ] prepare produces no placeholder/default contract; finalize produces immutable report plus hash-bound LATEST pointer.
- [ ] Pointer conflict keeps prior LATEST bytes unchanged and preserves an orphan candidate as unpublished.
- [ ] All fixed component and integration tests, plan validator, typecheck, and diff checks pass.
- [ ] Policy documentation, task log, and logs index are current without overwriting a user-owned dirty index.
- [ ] No component or integration result is reported as runtime-smoke or live-LLM-E2E.

**Final status rule**: Any unchecked item or missing required evidence leaves the PLAN_SET incomplete. `IMPLEMENTED-AND-GATE-PASS` is written only after every item is checked with current receipts.
