# Audit Governance Recovery v1 — Plan-Text Revision (2026-07-30)

- session: 主 Agent (SINGLE)
- mode: plan-text revision only (no P-02 implementation, no audit dir artifacts, no worktree creation)
- scope: 10 files edited, 14 modifications, +215 lines net
- admission path: r4 → r5 (pending; will be activated by future session via §1.5 P0 preflight)

## 1. Why this revision

The 2026-07-29 M1 implementation review concluded that M1 was a "fake COMPLETE" — 4 audit-report `valid:false`, scope-lock 循环 SHA 依赖, 99-final-verification 8 gate 全 `[ ]`. The root cause was that the M1 implementer did NOT read `validate-audit.ts` in full before drafting the audit reports, instead relying on prior phase artifacts as a template (a process violation per SKILL.md L171 "Pre-Audit Knowledge Required").

The user clarified that v1 (`plans/audit-governance-recovery-v1/`) is the carrier of the root-cause fix — v1 must be designed to prevent the M1 failure from repeating. This revision embeds that fix as:

- **P-02 step 1.5 in `provenance-rules.md`**: Pre-Audit Knowledge Required is now a P-02 hard constraint, not just an SKILL.md advisory.
- **§Pre-audit read gate in `05-phase-rules-skills-and-templates.md`**: PHASE-01 implementer must read the 5 mandatory files and record the read in `logs/<YYYY-MM-DD>-pre-audit-read-<implementer-task-id>.md`.
- **0/99-final preflight envcheck**: any missing r5 artifact or missing worktree is now a hard-gate fail before verification commands run.

## 2. 14 modifications (M1–M14) across 10 files

| # | Finding | File | Content marker |
|---|---|---|---|
| M1 | #1 BLOCKING | 00-plan-index.md | `## 1.5 P0 preflight` (6 numbered steps) |
| M2 | #3 CRITICAL | canonical L9-19 + L1179-1186 | `approval-decision-r5.json` (r5 path) + generation history note |
| M3 | #4 CRITICAL | 06-phase L30-72 | `## Auditor implementation log (Auditor Session A only)` section + allowed-file row 2 removed |
| M4 | #6 BLOCKING | 04-phase L28-37 | `(CREATE)` prefix on both allowed-files + heading annotation |
| M5 | #7 BLOCKING | 99-final L8-30 | `### 0. Final preflight` (set -euo pipefail + 5 hard-gate checks) |
| M6 | #9 CRITICAL | 01-phase L140 + 02-phase L10 | Cross-reference statements (PHASE-01 enables / PHASE-02 invokes) |
| M7 | #10 MAJOR | provenance-rules.md P-02 + 05-phase L43-65 | P-02 step 1.5 + Pre-audit read gate section |
| M8 | #2 MAJOR | canonical L1133-1135 | `gate_text_normalization` already exists; documented in 00-index §8.1 |
| M9 | #5 MAJOR | canonical L1248-1269 | `phase_06_activation_additions` block + final_update trimmed |
| M10 | #8 MAJOR | canonical L24 + L1542 area | worktree path → `audit-governance-recovery-v1-bootstrap` |
| M11 | #11 MAJOR | 06-phase L30-37 | 06-phase allowed-files reduced from 3 to 2 (implementation-evidence log removed; documents/INDEX.md + logs/INDEX.md retained) + new `## Auditor implementation log` section marks the log as Auditor-only |
| M12 | #12 MAJOR | canonical L1055-1119 | `dataflow_pipeline` block (10 rows covering PHASE-01..99-final) |
| M13 | #14 MAJOR | canonical L1406-1414 | EV-017 / EV-018 in evidence_case_registry (pending→approved) |
| M14 | #15 MAJOR | 00-plan-index §8.1 | `gate_count` derivation rule + 8/9 difference explanation |

## 3. Line-count delta

| File | Before | After | Δ |
|---|---:|---:|---:|
| provenance-rules.md | 87 | 93 | +6 |
| canonical-requirements-contract.yaml | 1614 | 1705 | +91 |
| 00-plan-index.md | 129 | 175 | +46 |
| 01-phase-foundation-kernel.md | 211 | 213 | +2 |
| 02-phase-single-closure-entrypoint.md | 220 | 221 | +1 |
| 03-phase-artifact-dag-validation.md | 201 | 202 | +1 |
| 04-phase-conformance-enforcement.md | 188 | 190 | +2 |
| 05-phase-rules-skills-and-templates.md | 198 | 214 | +16 |
| 06-phase-documentation-and-final-handoff.md | 178 | 212 | +34 |
| 99-final-verification.md | 132 | 148 | +16 |
| **Total** | | | **+215** |

## 4. P-02 / P-01 compliance

- **P-01 provenance_level declaration**: still `v3-required` (00-index L9, canonical L7). No change.
- **P-02 Freeze Gate 4 件套**: still BLOCKED (this revision did not produce any audit dir artifact). Future admission must run §1.5 P0 preflight first.
- **P-07 repository_root anchor**: still `work-one` (`/home/zhaoge/workspace/opencode/work-one`). No change.

## 5. Next-step r5 admission procedure

1. Create target worktree: `git worktree add --detach .worktrees/audit-governance-recovery-v1-bootstrap 2a8b15ac2c7bfe237cdde0473564d9320b024edc`
2. Generate 9-r5 artifacts per §1.5 P0 preflight steps 1-4
3. Run `sha256sum --check audits/audit-governance-recovery-v1/approved-plan-files-r5.sha256` (per 99-final L26)
4. Submit `approval-request-r5.json` with full approved_artifacts set
5. HUMAN approves → `approval-decision-r5.json` (APPROVED)
6. Then P-02 Freeze Gate 4 件套 becomes unblocked

## 6. Updated documents

- `plans/audit-governance-recovery-v1/canonical-requirements-contract.yaml` (M2 + M8 + M9 + M10 + M12 + M13)
- `plans/audit-governance-recovery-v1/formal-plan-set/00-plan-index.md` (M1 + M12 + M14)
- `plans/audit-governance-recovery-v1/formal-plan-set/01-phase-foundation-kernel.md` (M6)
- `plans/audit-governance-recovery-v1/formal-plan-set/02-phase-single-closure-entrypoint.md` (M6)
- `plans/audit-governance-recovery-v1/formal-plan-set/03-phase-artifact-dag-validation.md` (M9)
- `plans/audit-governance-recovery-v1/formal-plan-set/04-phase-conformance-enforcement.md` (M4)
- `plans/audit-governance-recovery-v1/formal-plan-set/05-phase-rules-skills-and-templates.md` (M7 + M11)
- `plans/audit-governance-recovery-v1/formal-plan-set/06-phase-documentation-and-final-handoff.md` (M3 + M11)
- `plans/audit-governance-recovery-v1/formal-plan-set/99-final-verification.md` (M5)
- `.agents/skills/plan-audit-archiver/provenance-rules.md` (M7)
