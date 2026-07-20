---
name: plugin-creator
description: "Create, customize, and install QoderWork or QoderWork CN expert plugins / 创建、定制与安装 QoderWork 或 QoderWork CN 专家插件。Use for role-oriented plugin packages, plugin skills or commands, plugin manifests, connector planning, existing-plugin customization. Trigger: create plugin, 创建插件, customize plugin, edit plugin, plugin skills, plugin commands, expert plugin. Not for: standalone skill, raw MCP-server setup, general QoderWork settings."
---

# QoderWork Plugin Creator

## Language / 语言

Follow the user's language: reply in Chinese for Chinese requests and English for English requests. Provide both only when requested; preserve code, commands, paths, API names, identifiers, and quoted source text exactly.

A plugin is a role-oriented toolkit containing multiple skills. Keep user-facing names and text in the user's language, but use a stable English kebab-case identifier for `plugin.json`.

## Choose The Path

| Request | Path |
|---|---|
| New role or industry toolkit | Create and install |
| Built-in plugin derivative | Customize existing plugin |
| One existing skill or command | Edit only that item |

Read detailed formats only when needed:

- Draft and final-plan templates: [prd-template.md](references/prd-template.md)
- Build review: [review-checklist.md](references/review-checklist.md)
- Manifest schemas, connector rules, plugin modes, and examples: [legacy-complete-guide.md](references/legacy-complete-guide.md)

## Create And Install

1. Collect the user's role or concrete workflow. Reuse information already provided; ask only for missing decisions.
2. Draft the plugin scope: target users, 3-7 independently useful skills, required inputs, expected outputs, and external tools the user actually uses.
3. Ask for reference materials relevant to each skill. If none exist, state that general guidance will be used.
4. Present the complete build plan and wait for confirmation before creating files.
5. Build the plugin in a writable staging directory using `.qoder-plugin/plugin.json`, `skills/`, and optional `README.md`/`CONNECTORS.md`.
6. Make each skill standalone. Place templates, examples, and domain knowledge under that skill's `references/` directory.
7. Add `.mcp.json` only for confirmed third-party guided setups. Product-native connectors belong in `CONNECTORS.md`, not `.mcp.json`.
8. Install through `qoderwork.settings.plugins.install_from_path`; do not manually copy plugin contents into product data directories.
9. Query `qoderwork.settings.plugins` or `qoderwork.settings.skills` after installation to confirm registration.

`[VERIFICATION]` Record `Verified-by: qw_query result contains <plugin-name>` after the registration query. A successful install call alone is not proof that the plugin is active.

> **合理化检测**: Do not infer a plugin is valid from its directory shape. Check the manifest, all declared relative paths, and the post-install query.

## Customize Or Edit

For customization, read the source manifest first, preserve existing capability unless removal is requested, give the derivative its own `name` and `displayName`, and set `customizedFrom` only for an actual built-in-plugin derivative.

For one skill or command, change only the requested file and its directly affected references. Validate frontmatter and any manifest path that points to it.

## Completion Evidence

Report the staging path, installed plugin name, changed skills, connector decisions, and the registration-query result. If user materials or connector credentials are missing, state the resulting limitation explicitly.
