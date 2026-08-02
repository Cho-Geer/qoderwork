import { createHash, randomUUID } from "node:crypto";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import {
  cpSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import net from "node:net";
import { resolveWorkspacePaths, WorkspacePathsError } from "../lib/workspace-paths.ts";
import type {
  CreateRunInput,
  RunManifest,
  RunPaths,
  ReadyResult,
  RunState,
  SnapshotSourceInput,
  SourceOverlayManifest,
  SourceOverlayMetadata,
  CreateRunHooks,
} from "./types";

const PORT_RESERVER_PATH = join(__dirname, "port-reserver.ts");
const DENIED_UNTRACKED_PREFIXES = [
  ".env",
  ".opencode/state/",
  ".task_temp/",
  "node_modules/",
];

export function getDefaultPrimaryWorktree(): string {
  // Delegate to validated workspace-paths resolver (no caller-supplied path).
  // The resolver enforces CLI > ENV > LOCAL_CONFIG > DEPRECATED_DEFAULT precedence
  // and validates the candidate via validateWorkOneRoot (absolute realpath, git top level, opencode.json present).
  try {
    return resolveWorkspacePaths({}).workOneRoot;
  } catch (error) {
    if (error instanceof WorkspacePathsError) {
      throw new Error(`${error.code}: ${error.message}`);
    }
    throw error;
  }
}

export function getStateRoot(): string {
  return process.env.XDG_STATE_HOME
    ? join(process.env.XDG_STATE_HOME, "qoderwork", "test-runs")
    : join(homedir(), ".local", "state", "qoderwork", "test-runs");
}

export function createRunPaths(runId: string): RunPaths {
  const rootDir = join(getStateRoot(), runId);
  return {
    rootDir,
    manifestPath: join(rootDir, "manifest.json"),
    worktreeDir: join(rootDir, "worktree"),
    dbDir: join(rootDir, "db"),
    frameworkDbPath: join(rootDir, "db", "framework-state.db"),
    opencodeDbPath: join(rootDir, "db", "opencode.db"),
    logsDir: join(rootDir, "logs"),
    frameworkLogDir: join(rootDir, "logs", "framework"),
    serveLogPath: join(rootDir, "logs", "serve.log"),
    sseLogPath: join(rootDir, "logs", "sse.log"),
    eventsDir: join(rootDir, "events"),
    eventFilePath: join(rootDir, "events", "events.jsonl"),
    sseReadyPath: join(rootDir, "events", "sse-ready.json"),
    archiveDir: join(rootDir, "events", "archive"),
    pidsDir: join(rootDir, "pids"),
    servePidPath: join(rootDir, "pids", "serve.pid"),
    ssePidPath: join(rootDir, "pids", "sse.pid"),
    artifactsDir: join(rootDir, "artifacts"),
    cleanupReportPath: join(rootDir, "cleanup-report.json"),
  };
}

export function makeRunId(testId: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${stamp}-${sanitizeSlug(testId)}-${randomUUID().slice(0, 8)}`;
}

export function ensureRunDirectories(paths: RunPaths): void {
  [
    paths.rootDir,
    paths.dbDir,
    paths.logsDir,
    paths.frameworkLogDir,
    paths.eventsDir,
    paths.archiveDir,
    paths.pidsDir,
    paths.artifactsDir,
  ].forEach((dir) => mkdirSync(dir, { recursive: true }));
}

export function readRunManifest(runDirOrManifestPath: string): RunManifest {
  const manifestPath = runDirOrManifestPath.endsWith(".json")
    ? runDirOrManifestPath
    : join(runDirOrManifestPath, "manifest.json");
  return JSON.parse(readFileSync(manifestPath, "utf8")) as RunManifest;
}

export function writeRunManifest(manifest: RunManifest): void {
  manifest.updatedAt = new Date().toISOString();
  const tmp = `${manifest.paths.manifestPath}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(manifest, null, 2)}\n`);
  renameSync(tmp, manifest.paths.manifestPath);
}

const TRANSITION_TABLE: Record<RunState, RunState[]> = {
  CREATED: ["WORKTREE_READY", "BLOCKED", "FAILED"],
  WORKTREE_READY: ["READY", "STOPPED", "BLOCKED", "FAILED"],
  READY: ["BOOTSTRAPPED", "STOPPED", "BLOCKED", "FAILED"],
  BOOTSTRAPPED: ["EXECUTED", "STOPPED", "BLOCKED", "FAILED"],
  EXECUTED: ["STOPPED", "BLOCKED", "FAILED"],
  STOPPED: ["CLEANED", "READY", "BLOCKED", "FAILED"],
  CLEANED: [],
  BLOCKED: ["CLEANED"],
  FAILED: [],
};

export function setRunState(manifest: RunManifest, status: RunState): RunManifest {
  const allowed = TRANSITION_TABLE[manifest.status];
  if (!allowed.includes(status)) {
    throw new Error(`illegal run state transition: ${manifest.status} -> ${status}`);
  }
  manifest.status = status;
  writeRunManifest(manifest);
  return manifest;
}

export async function createRunContext(input: CreateRunInput, hooks?: CreateRunHooks): Promise<RunManifest> {
  const primaryWorktree = resolveRequiredDir(input.primaryWorktree, "primary worktree");
  ensureGitCommit(primaryWorktree, input.commit);
  // Validate local source material before reserving a shared port. Validation
  // failure has no process to release; git/DB work remains behind reservation.
  const overlay = input.sourceOverlayDir
    ? validateSourceOverlay(resolveRequiredDir(input.sourceOverlayDir, "source overlay"))
    : null;

  // Derive run ID and paths BEFORE port reservation so duplicate detection
  // cannot leak a reserved port.
  const runId = hooks?.makeRunId ? hooks.makeRunId(input.testId) : makeRunId(input.testId);
  const paths = createRunPaths(runId);
  if (existsSync(paths.rootDir)) {
    throw new Error(`run id already exists: ${runId}`);
  }

  // Physically reserve the port BEFORE any git/DB work, so create-phase is atomic.
  const portReserverPid = await spawnPortReserver(input.port);
  ensureRunDirectories(paths);

  const manifest: RunManifest = {
    runId,
    testId: input.testId,
    status: "CREATED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    primaryWorktree,
    commit: input.commit,
    port: input.port,
    rootDir: paths.rootDir,
    paths,
    env: buildRunEnvironment(paths, input.port),
    sourceOverlay: overlay,
    sourceStatusPorcelainZ: overlay ? readOverlayManifest(overlay.manifestPath).sourceStatusPorcelainZ : null,
    rootSessionId: null,
    childSessionId: null,
    grantId: null,
    dispatchKey: null,
    allowedPaths: [],
    bootstrapComplete: false,
    authorization: {
      h2Authorized: process.env.H2_AUTHORIZED === "true",
      dryRun: process.env.DRY_RUN !== "false",
    },
    process: {
      servePid: null,
      ssePid: null,
      portReserverPid,
    },
    cleanup: {
      status: "pending",
      notes: [],
    },
  };

  try {
    writeRunManifest(manifest);
    git(["worktree", "add", "--detach", paths.worktreeDir, input.commit], primaryWorktree);
    if (overlay) {
      applySourceOverlay(paths.worktreeDir, overlay);
    }
    if (hooks?.afterWorktreeReady) {
      await hooks.afterWorktreeReady(paths);
    }
    setRunState(manifest, "WORKTREE_READY");
    return manifest;
  } catch (error) {
    const createFailure = error instanceof Error ? error.message : String(error);
    const release = hooks?.releasePortReservation ?? releasePortReservation;
    let releaseFailure: string | null = null;

    try {
      await release(portReserverPid);
      manifest.process.portReserverPid = null;
    } catch (releaseError) {
      releaseFailure = releaseError instanceof Error
        ? releaseError.message
        : String(releaseError);
    }

    manifest.status = "BLOCKED";
    manifest.cleanup.notes.push(`create failed: ${createFailure}`);

    if (releaseFailure) {
      manifest.cleanup.notes.push(
        `port reserver release failed: ${releaseFailure}; pid retained: ${portReserverPid}; worktree retained`,
      );
      writeRunManifest(manifest);
      throw new Error(
        `create failed: ${createFailure}; port reserver release failed: ${releaseFailure}`,
      );
    }

    writeRunManifest(manifest);
    cleanupFailedCreate(primaryWorktree, paths);
    throw error;
  }
}

export function snapshotSourceOverlay(input: SnapshotSourceInput): SourceOverlayMetadata {
  const primaryWorktree = resolveRequiredDir(input.primaryWorktree, "primary worktree");
  const outputDir = resolve(input.outputDir);
  if (!isAbsolute(outputDir)) {
    throw new Error("overlay output dir must be absolute");
  }
  mkdirSync(outputDir, { recursive: true });

  const statusPorcelainZ = git(["status", "--porcelain=v1", "-z"], primaryWorktree);
  if (statusPorcelainZ && !input.allowDirtySource) {
    throw new Error("dirty source requires explicit --allow-dirty-source");
  }
  if (!statusPorcelainZ) {
    throw new Error("snapshot-source requires at least one tracked or untracked change");
  }

  const patchPath = join(outputDir, "tracked.patch");
  const tarPath = join(outputDir, "untracked.tar");
  const manifestPath = join(outputDir, "source-manifest.json");

  writeFileSync(patchPath, git(["diff", "--binary", "HEAD"], primaryWorktree));

  const untrackedRaw = git(["ls-files", "--others", "--exclude-standard", "-z"], primaryWorktree);
  const untrackedFiles = untrackedRaw.split("\0").filter(Boolean);
  for (const relPath of untrackedFiles) {
    ensureAllowedOverlayPath(relPath);
  }

  if (untrackedFiles.length > 0) {
    execFileSync("tar", ["-cf", tarPath, ...untrackedFiles], {
      cwd: primaryWorktree,
      stdio: "pipe",
    });
  } else {
    writeFileSync(tarPath, "");
  }

  const manifest: SourceOverlayManifest = {
    createdAt: new Date().toISOString(),
    sourceCommit: git(["rev-parse", "HEAD"], primaryWorktree).trim(),
    sourceStatusPorcelainZ: statusPorcelainZ,
    patchSha256: sha256File(patchPath),
    tarSha256: sha256File(tarPath),
    untrackedFiles: untrackedFiles.map((relPath) => {
      const absPath = join(primaryWorktree, relPath);
      return {
        path: relPath,
        size: statSync(absPath).size,
        sha256: sha256File(absPath),
      };
    }),
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return validateSourceOverlay(outputDir);
}

export function validateSourceOverlay(overlayDir: string): SourceOverlayMetadata {
  const dir = resolveRequiredDir(overlayDir, "source overlay");
  const manifestPath = join(dir, "source-manifest.json");
  const patchPath = join(dir, "tracked.patch");
  const tarPath = join(dir, "untracked.tar");
  [manifestPath, patchPath, tarPath].forEach((path) => {
    if (!existsSync(path)) {
      throw new Error(`overlay missing required file: ${path}`);
    }
  });

  const manifest = readOverlayManifest(manifestPath);
  if (manifest.patchSha256 !== sha256File(patchPath)) {
    throw new Error("overlay patch sha256 mismatch");
  }
  if (manifest.tarSha256 !== sha256File(tarPath)) {
    throw new Error("overlay tar sha256 mismatch");
  }
  const tarEntries = statSync(tarPath).size === 0 ? [] : readTarEntries(tarPath);
  const manifestPaths = manifest.untrackedFiles.map((entry) => entry.path).sort();
  if (JSON.stringify(tarEntries) !== JSON.stringify(manifestPaths)) {
    throw new Error("overlay tar entries mismatch");
  }
  manifest.untrackedFiles.forEach((entry) => {
    ensureAllowedOverlayPath(entry.path);
    const extracted = readTarEntry(tarPath, entry.path);
    if (extracted.length !== entry.size) {
      throw new Error(`overlay entry size mismatch: ${entry.path}`);
    }
    const extractedSha = createHash("sha256").update(extracted).digest("hex");
    if (extractedSha !== entry.sha256) {
      throw new Error(`overlay entry sha256 mismatch: ${entry.path}`);
    }
  });

  return {
    dir,
    manifestPath,
    patchPath,
    tarPath,
    manifestSha256: sha256File(manifestPath),
    patchSha256: manifest.patchSha256,
    tarSha256: manifest.tarSha256,
  };
}

export function applySourceOverlay(worktreeDir: string, overlay: SourceOverlayMetadata): void {
  const overlayManifest = readOverlayManifest(overlay.manifestPath);
  if (statSync(overlay.patchPath).size > 0) {
    const patchTarget = join(worktreeDir, "tracked.patch");
    copyFileSync(overlay.patchPath, patchTarget);
    try {
      git(["apply", "--index", patchTarget], worktreeDir);
    } finally {
      rmSync(patchTarget, { force: true });
    }
  }

  if (overlayManifest.untrackedFiles.length > 0 && statSync(overlay.tarPath).size > 0) {
    execFileSync("tar", ["-xf", overlay.tarPath, "-C", worktreeDir], { stdio: "pipe" });
  }
}

function buildRunEnvironment(paths: RunPaths, port: number): Record<string, string> {
  return {
    OPENCODE_ROOT: paths.worktreeDir,
    FRAMEWORK_DB_PATH: paths.frameworkDbPath,
    OPENCODE_DB: paths.opencodeDbPath,
    OPENCODE_LOG_DIR: paths.frameworkLogDir,
    QODERWORK_TEST_RUN_ID: dirname(paths.manifestPath).split("/").at(-1) || "",
    FRAMEWORK_SKILL_READ_HARD_GATE: "1",
    SERVE_URL: `http://127.0.0.1:${port}`,
    EVENT_FILE: paths.eventFilePath,
    SSE_READY_FILE: paths.sseReadyPath,
    ARCHIVE_DIR: paths.archiveDir,
  };
}

function resolveRequiredDir(inputPath: string, label: string): string {
  if (!inputPath) throw new Error(`${label} is required`);
  const resolved = resolve(inputPath);
  if (!isAbsolute(resolved) || !existsSync(resolved)) {
    throw new Error(`${label} not found: ${resolved}`);
  }
  return resolved;
}

function ensurePortAvailable(port: number): void {
  if(!Number.isInteger(port) || port < 1024 || port > 65535){
    throw new Error(`invalid port: ${port}\n`);
  }
}

/**
 * Spawns a detached port-reserver daemon that physically binds the port
 * until releasePortReservation() is called. Returns the daemon PID.
 *
 * Throws if the port is already in use (detected via READY handshake).
 */
export async function spawnPortReserver(port: number): Promise<number> {
  ensurePortAvailable(port);

  const reserver = spawn(process.execPath, ["run", PORT_RESERVER_PATH, String(port)], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const ready = await waitForReadyLine(reserver, 3000);
  if(!ready.ok){
    try{
      reserver.kill("SIGKILL");
    }catch{}
    // EADDRINUSE is the most common case — give a clear message
    if(ready.stderr .includes("EADDRINUSE")){
      throw new Error(`port already in use: ${port}`);
    }
    throw new Error(`port reservation failed (port=${port}): ${ready.reason}${ready.stderr ? ` | stderr: ${ready.stderr}` : ""}`);
  }

  reserver.unref();
  if(!reserver.pid){
    throw new Error(`port reserver spawned without pid for port ${port}`);
  }
  return reserver.pid;
}

/**
 * Waits for the port-reserver child to either:
 *   - emit "READY\n" on stdout  → { ok: true }
 *   - exit with non-zero code   → { ok: false, reason, stderr }
 *   - emit an error             → { ok: false, reason, stderr }
 *   - exceed timeoutMs          → { ok: false, reason: "timeout", stderr }
 *
 * Accumulates stderr during the handshake window so failure reasons
 * (e.g. EADDRINUSE) are always surfaced — unlike the old busy-loop
 * implementation which blocked the event loop and starved the stderr reader.
 */
async function waitForReadyLine(child: ChildProcess, timeoutMs: number = 3000): Promise<ReadyResult> {
  return new Promise<ReadyResult>((resolve) => {
    let settled = false;
    let stdoutBuf = '';
    let stderrBuf = '';

    const timer = setTimeout(() => {
      finish({ ok: false, reason: "timeout", stderr: stderrBuf.trim() });
    }, timeoutMs);

    const onStdout = (chunk: Buffer): void => {
      if (settled) return;
      stdoutBuf += chunk.toString("utf8");
      const nl = stdoutBuf.indexOf("\n");
      if (nl >= 0) {
        const line = stdoutBuf.slice(0, nl).trim();
        if (line === "READY") {
          finish({ ok: true });
        } else {
          finish({ ok: false, reason: `unexpected handshake line: ${line}`, stderr: stderrBuf.trim() });
        }
      }
    };

    const onStderr = (chunk: Buffer): void => {
      if (settled) return;
      stderrBuf += chunk.toString("utf8");
    };

    const onError = (err: Error): void => {
      finish({ ok: false, reason: err.message, stderr: stderrBuf.trim() });
    };

    const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
      if (settled) return;
      // If we got a partial stdout line on exit, treat it as a reason.
      const tail = stdoutBuf.trim();
      const detail = tail ? `exited before READY (stdout=${tail})` : `exited before READY (code=${code}, signal=${signal})`;
      finish({ ok: false, reason: detail, stderr: stderrBuf.trim() });
    };

    const finish = (result: ReadyResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdout?.removeListener("data", onStdout);
      child.stderr?.removeListener("data", onStderr);
      child.removeListener("error", onError);
      child.removeListener("exit", onExit);
      resolve(result);
    };

    child.stdout?.on("data", onStdout);
    child.stderr?.on("data", onStderr);
    child.on("error", onError);
    child.on("exit", onExit);
  });
}

/**
 * Kills the port reserver daemon and waits for it to exit.
 * The daemon closes its socket on SIGTERM, releasing the port for takeover.
 */
export interface ReleasePortReservationDependencies {
  isAlive?: (pid: number) => boolean;
  signal?: (pid: number, signal: NodeJS.Signals) => void;
  sleep?: (ms: number) => Promise<void>;
  gracefulTimeoutMs?: number;
  forceTimeoutMs?: number;
}

/**
 * Releases a port reserver only after confirming that its process has exited.
 * A timeout leaves the caller's PID metadata intact and fails closed.
 */
export async function releasePortReservation(
  pid: number,
  dependencies: ReleasePortReservationDependencies = {},
): Promise<void> {
  const isAlive = dependencies.isAlive ?? ((targetPid) => {
    try {
      process.kill(targetPid, 0);
      return true;
    } catch {
      return false;
    }
  });
  const signal = dependencies.signal ?? ((targetPid, signalName) => process.kill(targetPid, signalName));
  const sleep = dependencies.sleep ?? sleepAsync;
  const gracefulTimeoutMs = dependencies.gracefulTimeoutMs ?? 5_000;
  const forceTimeoutMs = dependencies.forceTimeoutMs ?? 5_000;

  if (!isAlive(pid)) return;
  try { signal(pid, "SIGTERM"); } catch { /* process may have exited between probe and signal */ }
  if (await waitForProcessExit(pid, gracefulTimeoutMs, isAlive, sleep)) return;

  try { signal(pid, "SIGKILL"); } catch { /* the final liveness probe decides the result */ }
  if (await waitForProcessExit(pid, forceTimeoutMs, isAlive, sleep)) return;

  throw new Error(`port reserver did not exit: ${pid}`);
}

async function waitForProcessExit(
  pid: number,
  timeoutMs: number,
  isAlive: (pid: number) => boolean,
  sleep: (ms: number) => Promise<void>,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  do {
    if (!isAlive(pid)) return true;
    if (Date.now() >= deadline) break;
    await sleep(Math.min(100, Math.max(1, deadline - Date.now())));
  } while (Date.now() < deadline);
  return !isAlive(pid);
}

function sleepAsync(ms: number): Promise<void>{
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureGitCommit(cwd: string, commit: string): void {
  git(["rev-parse", "--verify", commit], cwd);
}

function ensureAllowedOverlayPath(relPath: string): void {
  if (!relPath || relPath.startsWith("/") || relPath.includes("..")) {
    throw new Error(`overlay path outside worktree: ${relPath}`);
  }
  if (DENIED_UNTRACKED_PREFIXES.some((prefix) => relPath === prefix || relPath.startsWith(prefix))) {
    throw new Error(`overlay path denied: ${relPath}`);
  }
}

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  }).toString();
}

function readOverlayManifest(path: string): SourceOverlayManifest {
  return JSON.parse(readFileSync(path, "utf8")) as SourceOverlayManifest;
}

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function archiveFrameworkLogs(worktreeDir: string, artifactsDir: string): string | null {
  const sourceDir = join(worktreeDir, ".task_temp", "_logs");
  if (!existsSync(sourceDir)) return null;
  const targetDir = join(artifactsDir, "framework-logs");
  rmSync(targetDir, { recursive: true, force: true });
  cpSync(sourceDir, targetDir, { recursive: true });
  return targetDir;
}

function cleanupFailedCreate(primaryWorktree: string, paths: RunPaths): void {
  try {
    git(["worktree", "remove", "--force", paths.worktreeDir], primaryWorktree);
  } catch {}
  rmSync(paths.worktreeDir, { recursive: true, force: true });
}

function readTarEntries(tarPath: string): string[] {
  const output = execFileSync("tar", ["-tf", tarPath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).toString();
  return output.split("\n").filter(Boolean).sort();
}

function readTarEntry(tarPath: string, entryPath: string): Buffer {
  return execFileSync("tar", ["-xOf", tarPath, entryPath], {
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function sanitizeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "run";
}
