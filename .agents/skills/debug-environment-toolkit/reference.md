# Debug & Environment Toolkit — Reference

Detailed reference material extracted from the merged skill. See SKILL.md for core methodology.

## VM Error Recovery — Full Reference

### Category A: Simple Retry

These errors are typically transient. Guide the user with simple, non-technical retry steps.

---

#### A1: Startup Timed Out or Stuck

**Error keys:** `hcs_timeout`, `hcs_service_timeout`, `hcs_unexpected`, `hcs_unknown`, `channels_ready_timeout`, `health_check_timeout`

**What to tell the user:**

> Your secure workspace took too long to start, likely because the system is busy.
>
> 1. Close other programs that may be using a lot of resources (games, video editors, multiple browser tabs, etc.)
> 2. Restart QoderWork and try again
> 3. If it happens again, restart your computer and then try

---

#### A2: Insufficient System Resources

**Error keys:** `hcs_insufficient_resources`

**What to tell the user:**

> Your computer does not have enough available memory to start the secure workspace.
>
> 1. Close memory-heavy programs — browsers with many tabs, large apps, etc.
> 2. Restart QoderWork and try again
> 3. If this keeps happening, your computer may not have enough memory for this feature. Consider upgrading your memory (the secure workspace needs at least 2 GB of free memory on Windows, 4 GB on macOS).

---

#### A3: Startup Unexpectedly Interrupted

**Error keys:** `guest_init_failed`, `hvkit_exit_unexpected`, `vm_start_failed`, `vm_process_exited`

**What to tell the user:**

> The secure workspace startup was unexpectedly interrupted.
>
> 1. Restart QoderWork and try again
> 2. If it happens repeatedly, restart your computer and then try
> 3. If it still fails after restarting, click the feedback button (top-right corner) to report the issue

---

#### A4: Network or Download Issues

**Error keys:** `manifest_network_error`, `download_network_error`, `download_timeout`, `download_http_error`, `download_aborted`, `download_wait_timeout`, `download_unknown`

**What to tell the user:**

> The download failed due to a network issue.
>
> 1. Check that your internet connection is working (try opening a website in your browser)
> 2. If you are using a VPN or proxy, try disabling it temporarily
> 3. Make sure QoderWork stays open and your network stays connected, then try again

---

#### A5: Server Resource Temporarily Unavailable

**Error keys:** `download_resource_not_found`

**What to tell the user:**

> The required resource is temporarily unavailable on the server.
>
> 1. Wait a few minutes and try again
> 2. If the problem persists after several attempts, click the feedback button (top-right corner) to report the issue

---

#### A6: Download File Verification Failed

**Error keys:** `download_checksum_mismatch`

**What to tell the user:**

> The downloaded file appears to be corrupted during transfer. This is usually a one-time issue.
>
> 1. Try downloading again — it will usually succeed on the next attempt
> 2. If it fails repeatedly, check your network connection or try a different network

---

#### A7: Insufficient Permissions (Windows)

**Error keys:** `hcs_access_denied`

**What to tell the user:**

> QoderWork needs administrator privileges to start the secure workspace.
>
> 1. Close QoderWork
> 2. Right-click the QoderWork icon and select **"Run as administrator"**
> 3. Try again

---

### Category B: Specific Actions Required

These errors require the user to perform specific operations (settings changes, commands, or disk cleanup).

---

#### B1: Workspace Files Missing or Corrupted

**Error keys:** `image_not_found`, `disk_not_found`, `path_validate_failed`, `vf_start_failed`, `resource_detect_failed`, `hvkit_permission_denied`

**What to tell the user:**

> Some required secure workspace files are missing or damaged.
>
> 1. Open **Settings** > **Secure Workspace** tab
> 2. Click **"Clean Workspace"** and confirm
> 3. Wait for the files to re-download automatically
> 4. Try starting the secure workspace again

**Connector shortcut:** Use the Connector to open the VM settings page directly.

---

#### B2: Not Enough Disk Space

**Error keys:** `download_disk_full`

**What to tell the user:**

> There is not enough disk space to download the required files. The secure workspace needs about 20 GB of free space.
>
> 1. Free up disk space by deleting unnecessary files, emptying the Recycle Bin / Trash, or uninstalling unused programs
> 2. Make sure you have at least **20 GB** of free space
> 3. Try again

---

#### B3: Security Software Blocking

**Error keys:** `download_extract_failed`

**What to tell the user:**

> File extraction failed, possibly because security software (antivirus) is blocking it.
>
> 1. Add QoderWork to your security software's **trusted / allowed list**
> 2. Open **Settings** > **Secure Workspace** tab > click **"Clean Workspace"**
> 3. Wait for the files to re-download and try again

---

#### B4: Windows Virtualization Not Enabled

**Error keys:** `win_hyperv_not_enabled`

**What to tell the user:**

> The secure workspace requires a Windows feature called Hyper-V, which is not yet enabled on your computer.
>
> 1. Open **Control Panel** > **Programs** > **"Turn Windows features on or off"**
> 2. Find and check **Hyper-V** in the list
> 3. Click **OK** and **restart your computer**
>
> **Note:** Windows Home edition may not support Hyper-V. If you don't see Hyper-V in the list, your Windows edition may not be compatible. Click the feedback button (top-right corner) for further assistance.

**Error keys:** `hcs_not_found`, `hcs_dependency_missing`

For these two keys, the Hyper-V components are missing or damaged. Provide the same guidance as above, and additionally offer this command for advanced users:

> If the above steps don't work, you can try running this command as Administrator in **PowerShell**:
>
> ```
> dism.exe /Online /Enable-Feature /FeatureName:Microsoft-Hyper-V /All
> ```
>
> Then restart your computer.
>
> If the problem persists, try running this system repair command as well:
>
> ```
> sfc /scannow
> ```

---

#### B5: Required Windows Service Missing

**Error keys:** `hcs_service_not_installed`

**What to tell the user:**

> A required system service is missing. This usually means the installation was incomplete.
>
> 1. Uninstall QoderWork completely
> 2. Re-download and reinstall QoderWork **with administrator privileges**, and DO NOT change the default install path
> 3. If the issue persists after reinstalling, click the feedback button (top-right corner) to report the issue

---

#### B6: Unknown Startup Error

**Error keys:** `phase_error_unknown`

**What to tell the user:**

> An unexpected error occurred during startup.
>
> 1. Try restarting QoderWork
> 2. If that doesn't help, open **Settings** > **Secure Workspace** tab > click **"Clean Workspace"** and wait for re-download
> 3. If the problem persists, click the feedback button (top-right corner) to report the issue — please include a description of what happened

---

### Category C: Cannot Be Fixed by User

These errors require system upgrades or technical support.

---

#### C1: macOS Version Too Old

**Error keys:** `vf_create_failed`

**What to tell the user:**

> Your macOS version does not support this feature. **macOS 14 (Sonoma) or later** is required.
>
> - If your Mac supports it, upgrade to macOS 14 or later via **System Settings** > **General** > **Software Update**
> - If your Mac hardware does not support macOS 14, this feature unfortunately cannot be used on this machine
> - Click the feedback button (top-right corner) if you need further assistance

---

#### C2: Unrecognized Error

**Condition:** `errorKey` is not in any of the tables above, or `boot-state.json` contains an error not listed here.

**What to tell the user:**

> An unrecognized error occurred. Please report this issue so the team can investigate.

Then open the feedback dialog with context.

---

## WSL Bun Script Pattern — Full Examples

### 实例 1：批量文件迁移（.ts）

场景：将 18 个 SKILL.md 拆分为 stub + FULL.md。

```typescript
// skill-migrate.ts
#!/usr/bin/env bun
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const SKILLS_DIR = "${WORK_ONE_ROOT}/.opencode/skills";

for (const name of readdirSync(SKILLS_DIR)) {
  const dir = join(SKILLS_DIR, name);
  const skillPath = join(dir, "SKILL.md");
  if (!existsSync(skillPath)) continue;
  const content = readFileSync(skillPath, "utf-8");
  writeFileSync(join(dir, "FULL.md"), content);
  // ... 生成 stub
}
console.log("migration done");
```

执行：

```bash
wsl -d "${QW_WSL_DISTRO:-Ubuntu-24.04}" bash -c "cp /mnt/c/Users/USER/.qoderworkcn/workspace/{id}/skill-migrate.ts /tmp/skill-migrate.ts && export PATH='${HOME}/.bun/bin:/usr/local/bin:/usr/bin:/bin' && cd ${WORK_ONE_ROOT} && bun run /tmp/skill-migrate.ts"
```

### 实例 2：验证脚本（.sh）

场景：检查迁移结果，含 for 循环和变量展开。

```bash
#!/bin/bash
cd ${WORK_ONE_ROOT}
echo "=== FULL.md check ==="
for d in .opencode/skills/*/; do
  name=$(basename "$d")
  if [ -f "$d/FULL.md" ]; then
    stub_lines=$(wc -l < "$d/SKILL.md")
    full_lines=$(wc -l < "$d/FULL.md")
    echo "  $name: stub=${stub_lines}L  full=${full_lines}L  OK"
  else
    echo "  $name: FULL.md MISSING!"
  fi
done
```

执行：

```bash
wsl -d "${QW_WSL_DISTRO:-Ubuntu-24.04}" bash -c "cp /mnt/c/Users/USER/.qoderworkcn/workspace/{id}/verify.sh /tmp/verify.sh && bash /tmp/verify.sh"
```

### 实例 3：长时间任务（.ts + 超时）

场景：启动 ACP session 并读取 token 数，需要等待 45 秒。

```typescript
// acp-verify-tokens.ts
#!/usr/bin/env bun
const agents = ["Meta-Planner", "Coder-BE", "Super-Admin"];
for (const agent of agents) {
  // ... 启动 session，等待响应，解析 token 数
  await new Promise(r => setTimeout(r, 45000));
  console.log(`${agent}: ${tokens} input tokens`);
}
```

执行（注意设置较长 timeout）：

```bash
wsl -d "${QW_WSL_DISTRO:-Ubuntu-24.04}" bash -c "cp /mnt/c/Users/USER/.qoderworkcn/workspace/{id}/acp-verify-tokens.ts /tmp/acp-verify-tokens.ts && export PATH='${HOME}/.bun/bin:/usr/local/bin:/usr/bin:/bin' && bun run /tmp/acp-verify-tokens.ts"
# Bash tool timeout: 300000
```

### 实例 4：cp-to-tmp — 脚本读取 Windows 侧源文件

场景：TS 脚本需要解析 workspace 中的 `opencode.json` 和若干 `.md` 文件，这些文件在 Windows 侧 workspace 中。

```typescript
// analyze-config.ts
#!/usr/bin/env bun
import { readFileSync } from "fs";

// 所有源文件已 cp 到 /tmp，用绝对路径读取
const config = JSON.parse(readFileSync("/tmp/opencode.json", "utf-8"));
const agentMd = readFileSync("/tmp/Coder-BE.md", "utf-8");

const mcpServers = Object.keys(config.mcp || {});
console.log(`MCP servers: ${mcpServers.length}`);
console.log(`Agent MD lines: ${agentMd.split("\n").length}`);
```

执行（脚本 + 源文件一起 cp 到 /tmp）：

```bash
wsl -d "${QW_WSL_DISTRO:-Ubuntu-24.04}" bash -c "cp /mnt/c/Users/USER/.qoderworkcn/workspace/{id}/analyze-config.ts /tmp/analyze-config.ts && cp /mnt/c/Users/USER/.qoderworkcn/workspace/{id}/opencode.json /tmp/opencode.json && cp /mnt/c/Users/USER/.qoderworkcn/workspace/{id}/Coder-BE.md /tmp/Coder-BE.md && export PATH='${HOME}/.bun/bin:/usr/local/bin:/usr/bin:/bin' && bun run /tmp/analyze-config.ts"
```

### 实例 5：pipe-to-stdin — 绕过 PATH 括号问题

场景：`bash -c` 因 Windows PATH 含括号报 syntax error，改用 pipe 模式。脚本内部需要设置 PATH 并调用 bun。

首先写一个 wrapper .sh 脚本（含 PATH 设置）：

```bash
#!/bin/bash
export HOME=${HOME}
export PATH=${HOME}/.bun/bin:/usr/local/bin:/usr/bin:/bin

echo "=== schema check ==="
bun -e '
const { Database } = require("bun:sqlite");
const db = new Database("${WORK_ONE_ROOT}/.opencode/service/opencode.db", { readonly: true });
const tables = db.query("SELECT name FROM sqlite_master WHERE type=\"table\"").all();
console.log("Tables:", tables.map(t => t.name).join(", "));
db.close();
'
```

通过 PowerShell pipe 到 WSL stdin 执行（无需 cp .sh 文件）：

```bash
powershell -Command "Get-Content 'C:\Users\USER\.qoderworkcn\workspace\{id}\check-schema.sh' -Raw | wsl -d "${QW_WSL_DISTRO:-Ubuntu-24.04}" bash"
```

注意：.sh 文件仍在 Windows 侧 workspace 中，但不需要 cp 到 /tmp — pipe 模式直接从 stdin 读入脚本内容。如果 .sh 中引用了 .ts 文件，那些 .ts 文件仍需 cp 到 /tmp。
