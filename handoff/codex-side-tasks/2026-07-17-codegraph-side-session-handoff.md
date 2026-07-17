# CodeGraph Side Session Handoff

## Meta

- Date: 2026-07-17
- Scope: Codex side conversation only
- Workspace: `/home/zhaoge/workspace/qoderwork`
- Session type: side task, not main thread

## User Goal

Persist enough context so this side session can continue after a Codex restart.

## What Was Asked In This Side Session

1. Research token consumption differences between ChatGPT 5.6, 5.5, 5.4, then recommend a model/tier for installing CodeGraph MCP.
2. Install `colbymchenry/codegraph` MCP into Codex.
3. Make the installation compatible with both Windows and WSL.
4. Explain whether CodeGraph auto-syncs its index after code changes.
5. Save this side-session handoff for restart continuity.

## Completed Work

### 1. CodeGraph MCP installation for Windows and WSL

- WSL CodeGraph was installed and upgraded to `1.4.1`.
- Windows CodeGraph was installed to:
  - `C:\Users\USER\AppData\Local\codegraph\current\bin\codegraph.cmd`
- Both Codex global configs were updated with:

```toml
[mcp_servers.codegraph]
command = "codegraph"
args = ["serve", "--mcp"]
```

- Verified config files:
  - WSL: `/home/zhaoge/.codex/config.toml`
  - Windows: `/mnt/c/Users/USER/.codex/config.toml`

### 2. Version verification

- WSL CLI version verified: `1.4.1`
- Windows CLI version verified: `1.4.1`

### 3. Cleanup

- Temporary installer zip removed:
  - `C:\Users\USER\AppData\Local\Temp\codegraph-win32-x64-v1.4.1.zip`

## Important Non-Actions

- `codegraph init` was NOT run in any project.
- No repo-local `.codegraph/` index was created.
- No project source files were changed in this side session before this handoff file.

## Verified Findings About Auto-Sync

### Conclusion

CodeGraph auto-syncs after file changes only when all of these are true:

1. The target project has already been initialized with `codegraph init`.
2. The MCP/serve process started with file watching enabled.
3. The watcher is active and not degraded or disabled.

### Verified Evidence

- CLI supports disabling watch explicitly:
  - `/home/zhaoge/.codegraph/versions/v1.4.1/lib/dist/bin/codegraph.js:1572`
  - `/home/zhaoge/.codegraph/versions/v1.4.1/lib/dist/bin/codegraph.js:1576`
- MCP engine explicitly states auto-sync behavior:
  - `/home/zhaoge/.codegraph/versions/v1.4.1/lib/dist/mcp/engine.js:270`
  - `/home/zhaoge/.codegraph/versions/v1.4.1/lib/dist/mcp/engine.js:274`
  - `/home/zhaoge/.codegraph/versions/v1.4.1/lib/dist/mcp/engine.js:291`
- MCP engine explicitly states the fallback when watch is disabled:
  - `/home/zhaoge/.codegraph/versions/v1.4.1/lib/dist/mcp/engine.js:255`
  - `/home/zhaoge/.codegraph/versions/v1.4.1/lib/dist/mcp/engine.js:257`

## Current State Of This Workspace

- `codegraph status /home/zhaoge/workspace/qoderwork` returned `Not initialized`.
- Therefore this workspace currently has no local CodeGraph index here.
- Because of that, auto-sync for this specific workspace cannot be live-demonstrated until `codegraph init` is run here or in another target repo.

## Constraints For Continuation

- This is a side conversation. Do not continue any inherited main-thread tasks unless the user explicitly re-asks.
- Avoid modifying repo-tracked files unless the user explicitly requests mutation.
- Do not run `codegraph init` unless the user explicitly asks for it, because it mutates the target repo by creating `.codegraph/`.

## Best Restart Resume Prompt

After restart, reopen this thread if possible and continue from this handoff. If the thread is missing, use a prompt like:

> 继续 side session。读取 `/home/zhaoge/workspace/qoderwork/handoff/codex-side-tasks/2026-07-17-codegraph-side-session-handoff.md`，基于其中上下文继续，不要恢复主线程任务。

## Suggested Next Steps If User Continues

1. If the user wants actual CodeGraph usage in a repo, first run `codegraph status <repo>`.
2. If that repo is not initialized, ask whether to run `codegraph init`.
3. If initialized, verify watcher state and demonstrate whether auto-sync is active.
4. If the user wants Codex to use CodeGraph immediately, remind them to restart Codex Desktop or open a new session so MCP config is reloaded.
