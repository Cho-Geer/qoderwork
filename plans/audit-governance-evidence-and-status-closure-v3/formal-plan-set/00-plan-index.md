# 审计治理证据与状态闭环 v3 — v3 PLAN_SET

**Plan mode**: `PLAN_SET`
**Schema version**: `audit-plan-set/v3`
**Document kind**: `plan-set-index`
**Status**: `COMPLETE`
**Progression schema**: `phase-progression/v1`
**Provenance level**: `v3-required`
**Canonical contract**: `plans/audit-governance-evidence-and-status-closure-v3/canonical-requirements-contract.yaml`
**Canonical contract SHA-256**: `dd58ef590956c85c7ce96743589b1e25aa956e7a1030f0502ecbde59f6afd748`
**Approval decision**: `audits/audit-governance-evidence-and-status-closure-v3/approval-decision-bootstrap-amendment.json`
**Approval decision SHA-256**: `d6b35ae702648a488402a8b62f1327aa0c115681074ee947653080c189809350`

## 1. Input contract and source ledger

| Source | Exact path | SHA-256 | Authority |
|---|---|---|---|
| Canonical | `plans/audit-governance-evidence-and-status-closure-v3/canonical-requirements-contract.yaml` | `dd58ef590956c85c7ce96743589b1e25aa956e7a1030f0502ecbde59f6afd748` | semantic source |
| Approval | `audits/audit-governance-evidence-and-status-closure-v3/approval-decision-bootstrap-amendment.json` | `d6b35ae702648a488402a8b62f1327aa0c115681074ee947653080c189809350` | HUMAN_USER binding |

## 2. Decisions, scope, and non-goals

- In scope: complete the v3 audit-governance evidence and status closure chain (surface, conformance, projection/receipt, audit, publication) under one shared parser.
- Non-goal: any pre-v3 profile, compatibility entry, generic bypass, phase ACCEPT, report, or LATEST publication before each phase independently satisfies P-02/P-02A and P-03 to P-07.

## 3. Verified current baseline

| Claim | Command | Result |
|---|---|---|
| shared v3 parser exists | `cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-v3 && test -s scripts/lib/audit-governance-schema-v3.ts` | FOUND |
| v3 PLAN_SET admission exists | `cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-v3 && test -s .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts` | FOUND |
| canonical contract present | `cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-v3 && sha256sum plans/audit-governance-evidence-and-status-closure-v3/canonical-requirements-contract.yaml` | FOUND |

## 4. End-to-end traceability

| REQ | DC | Fixture | Oracle | Owning phase | Evidence level |
|---|---|---|---|---|---|
| REQ-006 | DC-012 | FX-012 | ORACLE-012 | PHASE-01 | file-integration |
| REQ-006 | DC-013 | FX-013 | ORACLE-013 | PHASE-01 | file-integration |
| REQ-007 | DC-014 | FX-014 | ORACLE-014 | PHASE-01 | file-integration |
| REQ-007 | DC-015 | FX-015 | ORACLE-015 | PHASE-01 | file-integration |
| REQ-005 | DC-010 | FX-010 | ORACLE-010 | PHASE-04 | file-integration |
| REQ-005 | DC-011 | FX-011 | ORACLE-011 | PHASE-05 | file-integration |

## 5. File change inventory

| Exact path | Change | Phase |
|---|---|---|
| `scripts/lib/audit-governance-schema-v3.ts` | consume only, no change here | PHASE-01 |
| surface manifest/validator (paths frozen in PHASE-01 scope lock) | add | PHASE-01 |
| conformance corpus/runner (paths frozen in PHASE-01 scope lock) | add | PHASE-01 |

## 6. Phase manifest

| Order | Phase ID | File | Depends on | Status |
|---|---|---|---|---|
| 1 | PHASE-01 | `01-phase-surface-conformance.md` | NONE | ACCEPTED |
| 2 | PHASE-02 | `02-phase-progression-v3.md` | PHASE-01 | ACCEPTED |
| 3 | PHASE-03 | `03-phase-receipt-projection-precheck.md` | PHASE-02 | ACCEPTED |
| 4 | PHASE-04 | `04-phase-audit-chain-v3.md` | PHASE-03 | ACCEPTED |
| 5 | PHASE-05 | `05-phase-finalize-publication-v3.md` | PHASE-04 | ACCEPTED |

> **Closure projection (2026-07-29)**: 顶层 `Status: COMPLETE` 与 manifest 各 phase `ACCEPTED` 均为投影；唯一真相源为 `audits/audit-governance-evidence-and-status-closure-v3/LATEST.md` → `2026-07-27-audit-accept-v2.md`（`audit_id AGV3-AUDIT-20260727`，`verdict ACCEPT`，`invalid_reason null`，settle canonical `dd58ef59...` + scope-lock `02cb4604...`）。本 plan 集经**单一整体 ACCEPT 报告**闭环（非逐 phase 独立 ACCEPT 报告）；各 phase 的 P-02 冻结门证据（scope-lock / approval / pre-change-capture / evidence）见 `audits/audit-governance-evidence-and-status-closure-v3/phase-0N-*`。
