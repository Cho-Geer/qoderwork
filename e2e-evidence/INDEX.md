# E2E Evidence — Directory Index

**Reorganized**: 2026-07-12. Each phase's test-result bundles now live under a phase folder; cross-phase rollups in `_summary/`; old raw serve transcripts in `_archives/`. This file is the structure map — start here.

```
e2e-evidence/
├── INDEX.md              # this file (structure map)
├── _summary/             # cross-phase rollups
│   ├── CASE-STATUS-MATRIX.md
│   ├── RESULT-SHEET.md
│   ├── COVERAGE-LEDGER.md
│   ├── OPEN-GAPS.md
│   ├── METHODOLOGY.md
│   └── 2026-07-11-runtime-smoke.md
├── L1/                   # Skill-First & Prompt Shaping
│   ├── L1-001-skill-summary/                  # capture-reliability closure (✅ PASS)
│   └── skill-summary-keyword-regression.md     # historical flawed-capture snapshot (deprecated primary)
├── L2/  L2-001-build-child/
├── L3/  L3-008-009-010-safe-shell-allow/  L3-011-safe-shell-gitadd-deny/  L3-012-repo-op-deny/
├── L4/  L4-question-reply/  L4-rerun/
├── L5/  L5-002-safe-edit-hotpath/  L5-002-rerun/
├── L7/  L7-framework-maint-chain/  L7-rerun/
├── probe/  probe-trivial/          # L1-family connectivity sanity
└── _archives/            # old raw serve transcripts (2026-07-08): G7/G8/G9 repo-grant JSON + audit logs + DB snapshot
```

> Note: `skill-summary-keyword-regression.md` exists in BOTH `L1/` (this evidence copy, downgraded to "historical flawed capture snapshot") and `e2e/` (canonical, referenced by plans). `weak-model-23-regression.md` canonical copy is `e2e/weak-model-23-regression.md`; the former `_archives/` duplicate was deleted 2026-07-12 (byte-identical to canonical).

## Git Write Grant — Session Transcripts (serve API JSON) — now in `_archives/`

| File | Test | Description |
|------|------|-------------|
| _archives/g9-001-orchestrator-explore-dispatch.json | G9-001 | Orchestrator dispatches explore, uses 5 read tools directly |
| _archives/g9-002-orchestrator-no-grant.json | G9-002 | Orchestrator dispatches build without grant, write blocked |
| _archives/g9-003-orchestrator-grant-lifecycle.json | G9-003 | Orchestrator dispatches build with repo_maintenance grant |
| _archives/g9-003-build-child-session.json | G9-003 | Build child: stage + commit success (SHA e02a561a) |
| _archives/g7-build-remote-write-block.json | G7 neg | Build: safe_repo_push + safe_gh_pr_create blocked |
| _archives/g8-explore-read-only.json | G8 | Explore: read allowed, write permission denied |
| _archives/g8-general-read-only.json | G8 | General: read allowed, stage grant-missing |

## Audit Logs — now in `_archives/`

| File | Lines | Content |
|------|-------|---------|
| _archives/audit-repo-operations.log | 42 | REPO-READ-ALLOWED, REPO-WRITE-STAGED, REPO-COMMIT-SUCCESS, REPO-REMOTE-WRITE-BLOCKED |
| _archives/audit-repo-grants.log | 31 | REPO-GRANT-CREATED, BOUND, CONSUMED, MISSING, PATH-MISMATCH |

## DB Records — now in `_archives/`

| File | Content |
|------|---------|
| _archives/db-repo-grants.json | All repo_operation_grants rows (grant lifecycle states) |

## E2E Scripts

| File | Test | Result |
|------|------|--------|
| ../scripts/e2e-g4-grant-lifecycle.ts | G4 script-level | 12/12 PASS |
| ../scripts/e2e-g7-remote-write-positive.ts | G7 positive path | 9/9 PASS |
