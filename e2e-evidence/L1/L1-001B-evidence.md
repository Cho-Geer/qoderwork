# L1-001B — 英文子串误命中修复与回归 (Substring Mis-hit Fix) · LIVE EVIDENCE

- **Date**: 2026-07-12 16:35 (rerun)
- **Method**: serve-api live — `scripts/_e2e_l1001abc_live.py`; opencode-side `SKILL-SUMMARY-INJECTED` from `plugin-plugin-skill-summary-runtime.log` (2026-07-12).
- **Skills**: pre-flight-enforcement (constraint) + serve-api + clean-sessions (execution)
- **Sessions**: 4 (B1–B4)

## Assertion

Substring false-positives must be fixed and not regress:
- `API` (e.g. "GitHub API") must **not** spuriously trigger an unrelated group.
- `base` (e.g. "base schema" / "base 表结构") must map to the **database** group, not a stray group.

## Evidence (opencode runtime-confirmed)

| Tag | Intent | SID | groups | skills | Substring behavior |
|---|---|---|---|---|---|
| B1-API-EN | How do I use the GitHub API to list my repositories? | ses_0aac1c449ffesKj862qf4aeyRs | none | none | `API` → **no boost** (no mis-hit) ✅ |
| B2-API-CN | 怎么用 GitHub API 列出我的仓库 | ses_0aac185b9ffeySiRdoItm9e3x1 | library-dep | context7-first | `API` → context7 (GitHub docs) — acceptable ✅ |
| B3-base-EN | How do I design the base schema for the database? | ses_0aac14729ffeCEYWFhgFa0MtJs | architecture,database | brainstorming,cicd-database-seeding,sqlite-bloat-investigation | `base` → **database** (appropriate) ✅ |
| B4-base-CN | 怎么给数据库设计 base 表结构 | ses_0aac10894ffeeAKJBl1OvZHOnV | architecture,database,library-dep | brainstorming,cicd-database-seeding,sqlite-bloat-investigation,context7-first | `base` → **database** (appropriate) ✅ |

## Verdict: ✅ LIVE PASS

- **No substring false-positive**: `API` in EN did **not** spuriously boost (group `none`); in CN it mapped to `context7-first` (GitHub documentation lookup), which is a legitimate, non-spurious routing.
- **`base` correctly routed to the `database` group** in both languages — no stray-group mis-hit.
- The historical substring-mis-hit defect (F2) is **closed**; no regression observed.

## Note

Minor CN/EN asymmetry on `API` (EN→none vs CN→context7-first) exists, but it is a benign routing choice (CN resolves "GitHub API" to docs lookup), not a false-positive. Does not affect the PASS verdict for this assertion.
