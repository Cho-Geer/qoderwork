# create-skill reference

## Recommended package skeleton

```text
<skill-name>/
├── SKILL.md
├── reference.md        # optional deep reference
├── examples.md         # optional concrete examples
└── STANDARDS.md        # optional quality checklist or team rules
```

## Frontmatter minimum

```yaml
---
name: <skill-name>
description: "<what + when + Trigger: ... + Not for: ...>"
version: 1.0.0
---
```

## Description checklist

- 150-500 characters
- Includes `Trigger:` or equivalent trigger wording
- Includes `Not for:` or equivalent negative boundary
- Prefer bilingual coverage when the workspace is bilingual

## Reference file policy

- `reference.md`: long explanations, command templates, decision tables
- `examples.md`: example user prompts and example outputs
- `STANDARDS.md`: review rubric, style constraints, or repo-specific quality bars
