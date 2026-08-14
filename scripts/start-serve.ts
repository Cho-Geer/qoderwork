/**
 * start-serve.ts — Cross-platform opencode serve launcher (Windows + WSL/Linux)
 *
 * Features:
 *   1. Auto-loads qoderwork/scripts/.env
 *   2. Cleans opencode framework bun cache
 *   3. Starts `opencode serve --port 4096` from work-one directory
 *
 * Usage:
 *   bun run qoderwork/scripts/start-serve.ts
 *   bun run qoderwork/scripts/start-serve.ts --port 5000
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveWorkspacePaths, WorkspacePathsError } from "./lib/workspace-paths.ts";

// ── Config ──

const SCRIPT_DIR = resolve(import.meta.dir);
const ENV_FILE = join(SCRIPT_DIR, ".env");
const DEFAULT_PORT = "4096";
const PID_FILE = join(tmpdir(), "opencode-serve.pid");

// ── Parse CLI args ──

function parseArgs(): { port: string; workDir: string; noCache: boolean; stop: boolean } {
  const args = process.argv.slice(2);
  let port = DEFAULT_PORT;
  let workDir = "";
  let noCache = false;
  let stop = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" && args[i + 1]) {
      port = args[++i];
    } else if (args[i] === "--work-dir" && args[i + 1]) {
      workDir = args[++i];
    } else if (args[i] === "--no-cache") {
      noCache = true;
    } else if (args[i] === "--stop") {
      stop = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Usage: bun run start-serve.ts [options]

Options:
  --port <port>       Serve port (default: ${DEFAULT_PORT})
  --work-dir <path>   Work-one directory (auto-detected if omitted)
  --no-cache          Skip bun cache cleanup
  --stop              Stop the running serve daemon using stored PID
  -h, --help          Show this help
`);
      process.exit(0);
    }
  }

  return { port, workDir, noCache, stop };
}

// ── .env loader ──

function loadEnv(envFile: string): Record<string, string> {
  const loaded: Record<string, string> = {};

  if (!existsSync(envFile)) {
    console.warn(`[WARN] .env not found: ${envFile}`);
    return loaded;
  }

  const content = readFileSync(envFile, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    loaded[key] = value;
  }

  return loaded;
}

// ── Path resolution ──

function isWSL(): boolean {
  if (platform() !== "linux") return false;
  try {
    const release = readFileSync("/proc/version", "utf-8").toLowerCase();
    return release.includes("microsoft") || release.includes("wsl");
  } catch {
    return false;
  }
}

function resolveWorkDir(inputDir: string): string {
  // Explicit --work-dir wins over resolver-driven sources.
  try {
    const resolved = resolveWorkspacePaths({
      cliWorkOneRoot: inputDir || undefined,
    });
    return resolved.workOneRoot;
  } catch (error) {
    if (error instanceof WorkspacePathsError) {
      throw new Error(`${error.code}: ${error.message}`);
    }
    throw error;
  }
}

function resolveOpencodeBin(): string {
  const home = homedir();

  // ~/.opencode/bin/opencode
  const defaultBin = join(home, ".opencode", "bin", "opencode");
  if (existsSync(defaultBin)) return defaultBin;

  // Check PATH
  const pathDirs = (process.env.PATH || "").split(platform() === "win32" ? ";" : ":");
  for (const dir of pathDirs) {
    const candidate = join(dir, platform() === "win32" ? "opencode.exe" : "opencode");
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(
    "opencode binary not found. Install it or add to PATH."
  );
}

// ── Bun cache cleanup ──

function cleanBunCache(): void {
  const home = homedir();
  const cachePaths: string[] = [];

  if (platform() === "win32") {
    const localAppData = process.env.LOCALAPPDATA || join(home, "AppData", "Local");
    cachePaths.push(join(localAppData, "bun", "cache"));
  } else {
    // Linux / WSL / macOS
    cachePaths.push(join(home, ".bun", "install", "cache"));
    cachePaths.push(join(home, ".cache", "bun"));
    // XDG fallback
    const xdgCache = process.env.XDG_CACHE_HOME;
    if (xdgCache) cachePaths.push(join(xdgCache, "bun"));
  }

  let cleaned = false;
  for (const cachePath of cachePaths) {
    if (existsSync(cachePath)) {
      try {
        rmSync(cachePath, { recursive: true, force: true });
        console.log(`[OK] Cleared bun cache: ${cachePath}`);
        cleaned = true;
      } catch (e: any) {
        console.warn(`[WARN] Failed to clear ${cachePath}: ${e.message}`);
      }
    }
  }

  if (!cleaned) {
    console.log("[INFO] No bun cache found (nothing to clean)");
  }
}

// ── Stop daemon ──

function stopDaemon(): void {
  if (!existsSync(PID_FILE)) {
    // Fallback: detect orphan serve process via pkill + port check
    console.log("[INFO] No PID file found. Falling back to orphan-process detection...");
    stopOrphanServe();
    return;
  }

  const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10);
  if (isNaN(pid)) {
    console.error("[ERROR] Invalid PID in file");
    rmSync(PID_FILE, { force: true });
    stopOrphanServe();
    return;
  }

  console.log(`[INFO] Stopping serve daemon (PID: ${pid})...`);

  try {
    process.kill(pid, "SIGTERM");
    console.log("[OK] SIGTERM sent. Waiting for graceful shutdown...");

    // Wait up to 5 seconds for process to exit
    for (let i = 0; i < 10; i++) {
      try {
        process.kill(pid, 0); // Check if process exists
        // Process still running, wait a bit
        const waitUntil = Date.now() + 500;
        while (Date.now() < waitUntil) { /* busy wait */ }
      } catch {
        // Process no longer exists
        console.log("[OK] Serve daemon stopped successfully.");
        rmSync(PID_FILE, { force: true });
        // Cleanup any orphan that may have respawned or been started without PID file
        stopOrphanServe({ bestEffort: true });
        return;
      }
    }

    // Process still running after 5 seconds, force kill
    console.log("[WARN] Process did not exit gracefully. Sending SIGKILL...");
    try {
      process.kill(pid, "SIGKILL");
      console.log("[OK] SIGKILL sent.");
    } catch (e: any) {
      console.warn(`[WARN] SIGKILL failed: ${e.message}`);
    }
    rmSync(PID_FILE, { force: true });
    stopOrphanServe({ bestEffort: true });
  } catch (e: any) {
    if (e.code === "ESRCH") {
      console.log("[INFO] Process already stopped. Cleaning up PID file.");
    } else {
      console.error(`[ERROR] Failed to stop daemon: ${e.message}`);
    }
    rmSync(PID_FILE, { force: true });
    stopOrphanServe({ bestEffort: true });
  }
}

/**
 * Fallback: detect and stop orphan `opencode serve` processes that don't have a PID file.
 * Strategy: pkill -f "bin/opencode serve" + port listening check (lsof or ss).
 * Uses SIGTERM first, escalates to SIGKILL after 3s if still running.
 *
 * Option semantics (two orthogonal flags):
 *   - silent (boolean, default false): suppress all log output.
 *     Use when caller does not want any diagnostic noise (e.g., after successful PID-based stop).
 *   - bestEffort (boolean, default false): do not throw / do not propagate errors.
 *     Use when caller wants cleanup attempted but does not want the process to abort on failure.
 *
 * These flags are independent. The legacy `silent: true` call-sites in this file
 * have been migrated to `bestEffort: true` (they wanted non-blocking cleanup, not silence).
 */
function stopOrphanServe(opts: { silent?: boolean; bestEffort?: boolean } = {}): void {
  const { execSync } = require("node:child_process");
  const log = (msg: string) => { if (!opts.silent) console.log(msg); };
  const warn = (msg: string) => { if (!opts.silent) console.warn(msg); };

  // Step 1: find serve PIDs bound to the configured port
  let servePids: number[] = [];
  try {
    const port = parseArgs().port || "4096";
    if (!/^\d+$/.test(port)) {
      throw new Error(`invalid port for shell lookup: ${port}`);
    }
    // Prefer `ss` (always available), fall back to `lsof`
    let out = "";
    try {
      out = execSync(`ss -tlnp 2>/dev/null | grep ':${port} ' || true`, { encoding: "utf8" });
      const m = out.match(/pid=(\d+)/g);
      if (m) servePids = m.map((s) => parseInt(s.replace("pid=", ""), 10)).filter(Boolean);
    } catch {
      try {
        out = execSync(`lsof -ti :${port} 2>/dev/null || true`, { encoding: "utf8" });
        servePids = out.trim().split(/\s+/).map((s) => parseInt(s, 10)).filter(Boolean);
      } catch {}
    }
  } catch (e: any) {
    if (!opts.bestEffort) throw e;
    warn(`[WARN] port detection failed (bestEffort): ${e.message}`);
  }

  // Step 2: also catch `opencode serve` by binary path (in case port isn't bound yet)
  // IMPORTANT: pattern must NOT match start-serve.ts itself (avoids self-SIGTERM)
  try {
    const pgrep = execSync(`pgrep -f "bin/opencode serve" 2>/dev/null || true`, { encoding: "utf8" });
    const selfPid = process.pid;
    for (const line of pgrep.trim().split(/\s+/)) {
      const p = parseInt(line, 10);
      if (p && p !== selfPid && !servePids.includes(p)) servePids.push(p);
    }
  } catch (e: any) {
    if (!opts.bestEffort) throw e;
    warn(`[WARN] pgrep failed (bestEffort): ${e.message}`);
  }

  if (servePids.length === 0) {
    log("[INFO] No orphan opencode serve processes found. Port is free.");
    return;
  }

  log(`[INFO] Found ${servePids.length} orphan serve process(es): ${servePids.join(", ")}`);
  for (const pid of servePids) {
    try {
      process.kill(pid, "SIGTERM");
      log(`[OK] SIGTERM sent to ${pid}`);
    } catch (e: any) {
      if (!opts.bestEffort) throw e;
    }
  }

  // Step 3: wait up to 3s for graceful exit
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const stillAlive = servePids.filter((pid) => {
      try { process.kill(pid, 0); return true; } catch { return false; }
    });
    if (stillAlive.length === 0) {
      log("[OK] All orphan serve processes exited gracefully.");
      return;
    }
    const waitUntil = Date.now() + 300;
    while (Date.now() < waitUntil) { /* busy wait */ }
  }

  // Step 4: SIGKILL survivors
  for (const pid of servePids) {
    try {
      process.kill(pid, 0);
      warn(`[WARN] Process ${pid} still alive — sending SIGKILL`);
      try { process.kill(pid, "SIGKILL"); } catch {}
    } catch {}
  }
  log("[OK] Orphan cleanup complete.");
}

// ── Port conflict check ──

function checkPortConflict(port: string): boolean {
  try {
    const { execSync } = require("node:child_process");
    if (!/^\d+$/.test(port)) {
      throw new Error(`invalid port for conflict check: ${port}`);
    }
    if (platform() === "win32") {
      const result = execSync(`netstat -ano | findstr ":${port}"`, { encoding: "utf-8" });
      return result.trim().length > 0;
    } else {
      const result = execSync(`ss -tlnp 2>/dev/null | grep ":${port}" || lsof -i :${port} 2>/dev/null`, { encoding: "utf-8" });
      return result.trim().length > 0;
    }
  } catch {
    return false; // Command failed = no conflict
  }
}

// ── Main ──

async function main() {
  const { port, workDir: inputWorkDir, noCache, stop } = parseArgs();

  // Handle --stop option
  if (stop) {
    console.log("=".repeat(60));
    console.log("  OpenCode Serve Stopper");
    console.log("=".repeat(60));
    stopDaemon();
    return;
  }

  console.log("=".repeat(60));
  console.log("  OpenCode Serve Launcher");
  console.log("=".repeat(60));
  console.log(`Platform: ${platform()} ${isWSL() ? "(WSL)" : ""}`);
  console.log(`Node:     ${process.version}`);
  console.log(`Bun:      ${typeof Bun !== "undefined" ? Bun.version : "N/A"}`);
  console.log();

  // Step 1: Load .env
  console.log(`[1/4] Loading .env from: ${ENV_FILE}`);
  const envVars = loadEnv(ENV_FILE);
  const envKeys = Object.keys(envVars);
  if (envKeys.length > 0) {
    console.log(`  Loaded ${envKeys.length} vars: ${envKeys.join(", ")}`);
    // Merge into process.env (don't override existing)
    for (const [k, v] of Object.entries(envVars)) {
      if (!process.env[k]) {
        process.env[k] = v;
      }
    }
  } else {
    console.log("  No env vars loaded");
  }
  console.log();

  // Step 2: Clean bun cache
  if (noCache) {
    console.log("[2/4] Skipping bun cache cleanup (--no-cache)");
  } else {
    console.log("[2/4] Cleaning opencode framework bun cache...");
    cleanBunCache();
  }
  console.log();

  // Step 3: Resolve paths
  console.log("[3/4] Resolving paths...");
  const workDir = resolveWorkDir(inputWorkDir);
  const opencodeBin = resolveOpencodeBin();
  console.log(`  Work dir:    ${workDir}`);
  console.log(`  Binary:      ${opencodeBin}`);
  console.log(`  Port:        ${port}`);
  console.log();

  // Step 3.5: Check port conflict
  if (checkPortConflict(port)) {
    console.log(`[WARN] Port ${port} appears to be in use.`);
    console.log("  Kill existing process or use --port to specify a different port.");
    console.log("  Continuing anyway (opencode serve will report the error)...");
    console.log();
  }

  // Step 4: Start opencode serve
  console.log(`[4/4] Starting opencode serve on port ${port}...`);
  console.log("-".repeat(60));

  const child = spawn(opencodeBin, ["serve", "--port", port], {
    cwd: workDir,
    env: { ...process.env },
    stdio: "inherit",
    detached: false,
  });

  // Write PID file
  writeFileSync(PID_FILE, String(child.pid));
  console.log(`[OK] Serve daemon started (PID: ${child.pid})`);
  console.log(`[OK] PID file: ${PID_FILE}`);
  console.log();

  // Handle graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`\n[INFO] Received ${signal}, shutting down...`);
    child.kill("SIGTERM");
    setTimeout(() => {
      try { rmSync(PID_FILE, { force: true }); } catch {}
      process.exit(0);
    }, 3000);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  child.on("exit", (code, signal) => {
    console.log(`\n[INFO] Serve daemon exited (code: ${code}, signal: ${signal})`);
    try { rmSync(PID_FILE, { force: true }); } catch {}
    process.exit(code ?? 0);
  });

  child.on("error", (err) => {
    console.error(`[ERROR] Failed to start serve daemon: ${err.message}`);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error(`[FATAL] ${err.message}`);
  process.exit(1);
});
