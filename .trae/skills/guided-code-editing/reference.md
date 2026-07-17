# Reference: Debug Patterns and WSL Script Mode

## Log-First Debugging (from debug-environment-toolkit)

### Core Principle

Run code + read logs = find bug. Reading source code to guess the bug wastes time.

Source code tells you what the developer *intended*; logs tell you what the program *actually did*.

### The 4-Step Loop

1. **Form hypothesis** (< 2 min): "I suspect X is failing because Y."
2. **Insert targeted logs**: `[DEBUG-TMP]` markers at suspected failure points.
3. **Run and observe**: execute code, capture log output. Non-negotiable.
4. **Locate and conclude**: identify exact failure point from log evidence, fix, clean up temp logs.

### Time Budget Rule

If you've been reading source code for more than 2 minutes without inserting or examining logs, stop and switch to "insert logs and run."

## WSL Bun Script Mode

### When to Use

- Command contains `$()`, `$var`, shell variable expansion
- Nested quotes > 2 layers
- Contains `for/do/done`, `if/then/fi` control structures
- Logic > 5 lines of shell
- `bash -c` reports syntax error due to Windows PATH leaking parentheses

### Standard Flow

1. Write `.ts` script in workspace
2. Copy to WSL `/tmp` (if script needs source files, cp them too)
3. Execute with explicit PATH:

```bash
wsl -d Ubuntu-24.04 bash -c "export PATH='/home/zhaoge/.bun/bin:/usr/local/bin:/usr/bin:/bin' && cd /home/zhaoge/workspace/opencode/work-one && bun run /tmp/verify.ts"
```

### bun test Path Trap

`bun test .opencode/...` treats the argument as a filename filter, NOT a path.

```bash
# WRONG: "did not match any test files"
bun test .opencode/lib/__tests__/safe-bash-core.test.ts

# RIGHT: add ./ prefix
bun test ./.opencode/lib/__tests__/safe-bash-core.test.ts
```

### CRLF Trap (pipe-to-stdin mode)

Windows Write tool creates CRLF (`\r\n`) files. When piping `.sh`/`.ts` with Chinese comments to WSL, `\r` causes comment lines to swallow the next code line.

**Fix**: pipe-mode scripts use ASCII-only comments, or write script directly in WSL via heredoc.

## Common Verification Commands

### CodeGraph queries
```bash
codegraph callers "<symbol>"
codegraph impact "<symbol>"
codegraph callees "<symbol>"
codegraph status   # check if index is up to date
codegraph sync     # sync pending changes
```

### Grep for active callers
```bash
# Non-test, non-definition references
grep -rn "<symbol>(" --include="*.ts" .opencode/ | grep -v __tests__ | grep -v "export function" | grep -v "function <symbol>"
```

### Check if caller is in active handler order
```bash
# Read plugin_execution_order from project.config.json
python3 -c "
import json
c = json.load(open('.opencode/project.config.json'))
p = c.get('plugin_execution_order', {})
print('before:', p.get('before', []))
print('after:', p.get('after', []))
print('system:', p.get('system', []))
"
```

### Bun cache clear (before running tests after .ts changes)
```bash
rm -rf ~/.bun/install/cache ~/.cache/bun
```
