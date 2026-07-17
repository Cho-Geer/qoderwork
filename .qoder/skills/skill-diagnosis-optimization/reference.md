# skill-diagnosis-optimization reference

## Local fallback workflow

When QoderWork Connector or Feishu is unavailable, use this local fallback:

1. Read every `SKILL.md` under `.agents/skills/`
2. Parse frontmatter and check description length, trigger wording, and negative boundary
3. Check local links, `.bak` residue, and obviously stale serve wording
4. Repair deterministic issues first
5. Save a local audit report instead of blocking on connector-only notification

## Non-blocking issues

- Body length above the preferred threshold
- Potential overlap that would require semantic merging
- Connector-only steps that cannot be exercised in the current runtime

These should be reported, not silently rewritten, unless the user explicitly asks for structural consolidation.
