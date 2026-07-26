# Phase PHASE-01: ready [ANALYSIS → VERIFICATION]
**Phase ID**: `PHASE-01`
**Progression status**: `NOT_STARTED`
**Completion receipt**: NONE
**Depends on**: NONE
**Outcome**: fixed result
**Evidence level**: component
## Goal
## Starting state and dependency
## Local requirements
| Requirement | Contract |
|---|---|
| REQ-001 | fixed |
## Allowed files
| Exact path | Change | Anchor |
|---|---|---|
| src/a.ts | modify | run |
## Forbidden files and behaviors
## Fixed contract
Exact failure result and failedChecks. FOUND / NOT_FOUND / UNAVAILABLE.
## Implementation steps
## Check Registry
| Check name | PASS |
|---|---|
| checkA | true |
## All-pass Fixture
## Single-failure Matrix
## Fixed verification
```bash
cd /repo
bun test
```
## Rollback/failure convergence
## Phase completion gate
- [x] ready-a
- [ ] ready-b
