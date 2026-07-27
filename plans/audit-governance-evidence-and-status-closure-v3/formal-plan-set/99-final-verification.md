# 审计治理证据与状态闭环 v3 — Final Verification

## 7. Global verification and evidence

| Command | PASS condition | Evidence level |
|---|---|---|
| `cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-v3 && bun run .agents/skills/deterministic-implementation-planning/scripts/validate-plan.ts plans/audit-governance-evidence-and-status-closure-v3/formal-plan-set /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-v3` | exit 0 and stdout ok:true | component |
| `cd /home/zhaoge/workspace/qoderwork/.worktrees/audit-governance-v3 && bun run typecheck` | exit 0 | component |

## 8. Risks, failure convergence, and rollback

| Trigger | Convergence |
|---|---|
| hash drift or nonzero validator | BLOCKED; preserve evidence |
| pre-v3 input or compatibility entry observed | BLOCKED; reject before admission |
| phase ACCEPT, report, or LATEST publication before independent phase gate | BLOCKED; prohibited side effect |

## 9. Final completion gate

- [ ] Every phase has an approved scope lock and retained evidence before any write.
- [ ] No forbidden publication occurred.
- [ ] Genesis bootstrap closure is CLOSED and not reused as approval or waiver.
