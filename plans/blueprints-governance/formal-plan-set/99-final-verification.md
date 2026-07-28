# blueprints/ 目录治理与生命周期管理 — Final Verification

## 7. Global verification and evidence

| Command | PASS condition | Evidence level |
|---|---|---|
| `cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan && find blueprints -name '*.md' \| sort` | set equals `blueprints/INDEX.md` registration set (19 root active + 11 archived) | component |
| `cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan && rg --fixed-strings <archived-basename> audits/ plans/` | zero path-form refs for each of the 11 archived files (post-archive) | component |
| `cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan && sha256sum blueprints/blueprint-audit-governance-evidence-and-status-closure-v3.md` | `a510b7a8677c03e7ea1561e48620b95acec8611c88ff7ad2ddc558e0aa930d66` (frozen-bound file untouched) | component |
| `cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan && bun run scripts/check-blueprint-status.ts` | exit 0, zero drift | component |
| `cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan && bun run typecheck` | exit 0 | component |
| `cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan && git diff --quiet bun.lock` | unchanged (no new dependency) | component |
| `cd /home/zhaoge/workspace/qoderwork/.worktrees/check-plan && rg -l 'blueprints-governance' logs/` | P0/P1/P2 batch logs + one retirement decision record per archived file present | component |

## 8. Risks, failure convergence, and rollback

| Trigger | Convergence |
|---|---|
| move-ban non-zero ref or UNAVAILABLE | BLOCKED; file stays in root marked `已退役`; preserve pre-change capture + move/skip manifest |
| modification-ban frozen-bound file edited | BLOCKED; `git checkout` the file, register in INDEX exemption, preserve capture |
| v3 tooling incompatibility (validate-audit/validate-phase-progression nonzero) | BLOCKED; this plan is the first real post-merge v3 plan — surface to human; do not bypass (§4.0) |
| hash drift or nonzero validator at phase audit | BLOCKED; preserve evidence, retain prior LATEST pointer |
| INDEX/directory drift after M8 lint | BLOCKED; fix INDEX to match directory, re-run lint |

### Rollback

P0/P1/P2 are independent git-revertable batches (pure docs + one new lint script). Archive moves are reversible (`mv` back + INDEX rollback). The lint script is a pure addition (delete to roll back). No work-one runtime rollback needed.

## 9. Final completion gate

- [ ] Every phase has a HUMAN_USER-approved scope lock + pre-change capture + ACCEPTED audit with retained EV receipts (P-02/P-03).
- [ ] INDEX registers all 30 files (19 root + 11 archived) with status + truth-source + date basis; reverse-edge view + exemption list consistent.
- [ ] 18 non-exempt root files four-field complete; closure v3 untouched + INDEX-exempt; 3 causal edges + reverse view consistent; 3 stale headers corrected.
- [ ] Lint passes all-pass fixture + 9 single-failure mutations; tsc + bun test pass; bun.lock unchanged.
- [ ] Each retirement has a `logs/` decision record; P0/P1/P2 batch logs present; documents/INDEX.md + AGENTS.md synced.
- [ ] No forbidden publication occurred; `validate-audit.ts` exit 0; LATEST pointer published.
- [ ] CONTINUATION-001 (M9 wiring) explicitly deferred to a successor PLAN_SET — not closed here.
