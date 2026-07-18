import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { readRunManifest, releasePortReservation, setRunState, spawnPortReserver, writeRunManifest } from "./run-context";
import net from "node:net";
import type { RunManifest, StartChecks, StartRunResult } from "./types";

const SSE_DAEMON_PATH = "/home/zhaoge/workspace/qoderwork/scripts/sse-daemon.ts";

export interface StartRunProcessesDependencies {
  waitForHealth?: (port: number, timeoutMs: number) => Promise<boolean>;
  validateRunProcess?: (pid: number | null, runId: string, commandFragment: string) => boolean;
  readSseReadyMarker?: (manifest: RunManifest) => boolean;
  stopRunProcesses?: (runDir: string) => Promise<RunManifest>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  spawnProcesses?: (manifest: RunManifest) => RunManifest;
}

export async function startRunProcesses(
  runDir: string,
  dependencies: StartRunProcessesDependencies = {},
): Promise<StartRunResult> {
  const waitForHealthForRun = dependencies.waitForHealth ?? waitForHealth;
  const validateRunProcessForRun = dependencies.validateRunProcess ?? validateRunProcess;
  const readSseReadyMarkerForRun = dependencies.readSseReadyMarker ?? readValidSseReadyMarker;
  const stopRunProcessesForRun = dependencies.stopRunProcesses ?? stopRunProcesses;
  const sleepForRun = dependencies.sleep ?? sleep;
  const nowForRun = dependencies.now ?? Date.now;

  const manifest = readRunManifest(runDir);
  if (!["WORKTREE_READY", "STOPPED"].includes(manifest.status)) {
    throw new Error(`cannot start run from state ${manifest.status}`);
  }

  if (manifest.status === "STOPPED") {
    try {
      manifest.process.portReserverPid = await spawnPortReserver(manifest.port);
      writeRunManifest(manifest);
    } catch (err) {
      manifest.status = "BLOCKED";
      manifest.cleanup.notes.push(`restart blocked: ${err instanceof Error ? err.message : String(err)}`);
      writeRunManifest(manifest);
      throw err;
    }
  }

  if (manifest.process.portReserverPid) {
    await releasePortReservation(manifest.process.portReserverPid);
    manifest.process.portReserverPid = null;
  }

  if (dependencies.spawnProcesses) {
    const updated = dependencies.spawnProcesses(manifest);
    manifest.process.servePid = updated.process.servePid;
    manifest.process.ssePid = updated.process.ssePid;
    writeRunManifest(manifest);
  } else {
    const opencodeBin = resolveOpencodeBin();
    const bunBin = process.execPath;

    const serveFd = openSync(manifest.paths.serveLogPath, "a");
    const sseFd = openSync(manifest.paths.sseLogPath, "a");
    const env = { ...process.env, ...manifest.env };

    const serve = spawn(opencodeBin, ["serve", "--port", String(manifest.port)], {
      cwd: manifest.paths.worktreeDir,
      env,
      detached: true,
      stdio: ["ignore", serveFd, serveFd],
    });
    serve.unref();
    manifest.process.servePid = serve.pid ?? null;
    if (serve.pid) writeFileSync(manifest.paths.servePidPath, `${serve.pid}\n`);

    const sse = spawn(bunBin, ["run", SSE_DAEMON_PATH], {
      cwd: manifest.paths.worktreeDir,
      env,
      detached: true,
      stdio: ["ignore", sseFd, sseFd],
    });
    sse.unref();
    manifest.process.ssePid = sse.pid ?? null;
    if (sse.pid) writeFileSync(manifest.paths.ssePidPath, `${sse.pid}\n`);
    writeRunManifest(manifest);
  }

  const deadline = nowForRun() + 30_000;
  let checks: StartChecks = {
    health: false,
    serveIdentity: false,
    sseIdentity: false,
    sseReady: false,
  };

  while (nowForRun() < deadline) {
    checks = {
      health: await waitForHealthForRun(manifest.port, 0),
      serveIdentity: validateRunProcessForRun(manifest.process.servePid, manifest.runId, "serve"),
      sseIdentity: validateRunProcessForRun(manifest.process.ssePid, manifest.runId, "sse-daemon.ts"),
      sseReady: readSseReadyMarkerForRun(manifest),
    };
    if (checks.health && checks.serveIdentity && checks.sseIdentity && checks.sseReady) {
      return { manifest: setRunState(manifest, "READY"), checks };
    }
    await sleepForRun(100);
  }

  // Deadline expired — fail closed
  try {
    await stopRunProcessesForRun(runDir);
  } catch (stopError) {
    manifest.cleanup.notes.push(`stop after start failure also failed: ${stopError instanceof Error ? stopError.message : String(stopError)}`);
  }
  const freshManifest = readRunManifest(runDir);
  const failedChecks = Object.entries(checks)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  freshManifest.status = "BLOCKED";
  freshManifest.cleanup.notes.push(`start BLOCKED: ${failedChecks.join(", ")}`);
  writeRunManifest(freshManifest);
  throw new Error(`start failed for run ${manifest.runId}:${failedChecks.join(", ")}`);
}

export function inspectRunProcesses(runDir: string): {
  runId: string;
  status: string;
  servePid: number | null;
  ssePid: number | null;
  serveAlive: boolean;
  sseAlive: boolean;
  healthOk: boolean;
} {
  const manifest = readRunManifest(runDir);
  const serveAlive = validateRunProcess(manifest.process.servePid, manifest.runId, "serve");
  const sseAlive = validateRunProcess(manifest.process.ssePid, manifest.runId, "sse-daemon.ts");
  return {
    runId: manifest.runId,
    status: manifest.status,
    servePid: manifest.process.servePid,
    ssePid: manifest.process.ssePid,
    serveAlive,
    sseAlive,
    healthOk: serveAlive && sseAlive && canReachHealth(manifest.port),
  };
}

export interface StopRunProcessesDependencies {
  releasePortReservation?: typeof releasePortReservation;
}

export async function stopRunProcesses(
  runDir: string,
  dependencies: StopRunProcessesDependencies = {},
): Promise<RunManifest> {
  // Clean up any leftover port reserver if it somehow survived
  const manifest = readRunManifest(runDir);
  if (manifest.process.portReserverPid) {
    const release = dependencies.releasePortReservation ?? releasePortReservation;
    await release(manifest.process.portReserverPid);
    manifest.process.portReserverPid = null;
  }
  const targets: Array<[number | null, string, string]> = [
    [manifest.process.ssePid, "sse", manifest.paths.ssePidPath],
    [manifest.process.servePid, "serve", manifest.paths.servePidPath],
  ];

  for (const [pid, label] of targets) {
    if (!pid) continue;
    if (!validateRunProcess(pid, manifest.runId, label === "serve" ? "serve" : "sse-daemon.ts")) {
      throw new Error(`refuse to stop pid ${pid}: run identity mismatch`);
    }
    try {
      process.kill(pid, "SIGTERM");
    } catch {}
    const stopped = await waitForExit(pid, 10_000);
    if (!stopped) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {}
      const killed = await waitForExit(pid, 5_000);
      if (!killed) {
        throw new Error(`process did not exit: ${pid}`);
      }
    }
  }

  manifest.process.servePid = null;
  manifest.process.ssePid = null;
  rmSync(manifest.paths.servePidPath, { force: true });
  rmSync(manifest.paths.ssePidPath, { force: true });
  return setRunState(manifest, "STOPPED");
}

export function readValidSseReadyMarker(manifest: RunManifest): boolean {
  const markerPath = manifest.paths.sseReadyPath;
  if (!existsSync(markerPath)) return false;
  try {
    const content = JSON.parse(readFileSync(markerPath, "utf8"));
    if (content.runId !== manifest.runId) return false;
    if (content.serveUrl !== `http://127.0.0.1:${manifest.port}`) return false;
    if (content.eventFile !== manifest.paths.eventFilePath) return false;
    return true;
  } catch {
    return false;
  }
}

function validateRunProcess(pid: number | null, runId: string, commandFragment: string): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  const environPath = `/proc/${pid}/environ`;
  const cmdlinePath = `/proc/${pid}/cmdline`;
  if (!existsSync(environPath) || !existsSync(cmdlinePath)) return false;
  const envText = readFileSync(environPath).toString("utf8");
  const cmdline = readFileSync(cmdlinePath).toString("utf8");
  return envText.includes(`QODERWORK_TEST_RUN_ID=${runId}`) && cmdline.includes(commandFragment);
}

function resolveOpencodeBin(): string {
  const defaultBin = join(homedir(), ".opencode", "bin", "opencode");
  if (existsSync(defaultBin)) return defaultBin;
  const fromPath = Bun.which("opencode");
  if (fromPath) return fromPath;
  throw new Error("opencode binary not found");
}

async function waitForHealth(port: number, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now();
  do {
    const proc = Bun.spawn(["curl", "-fsS", "--max-time", "2", `http://127.0.0.1:${port}/session`], {
      stdout: "ignore",
      stderr: "ignore",
    });
    try {
      const exitCode = await proc.exited;
      if (exitCode === 0) return true;
    } catch {}
    if (Date.now() - startedAt < timeoutMs) {
      await sleep(500);
    }
  } while (Date.now() - startedAt < timeoutMs);
  return false;
}

function canReachHealth(port: number): boolean {
  const result = Bun.spawnSync(["curl", "-fsS", `http://127.0.0.1:${port}/session`], {
    stdout: "ignore",
    stderr: "ignore",
  });
  return result.exitCode === 0;
}

async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      process.kill(pid, 0);
      await sleep(200);
    } catch {
      return true;
    }
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isPortListening(port: number): Promise<boolean> {
  // Returns true if something is accepting TCP connections on 127.0.0.1:port.
  // Used after a failed serve health check to distinguish "port stolen" from "serve crashed".
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let settled = false;
    const finish = (result: boolean) => {
      if (!settled) {
        settled = true;
        sock.destroy();
        resolve(result);
      }
    };
    sock.setTimeout(1000, () => finish(false));
    sock.on("connect", () => finish(true));
    sock.on("error", () => finish(false));
    sock.connect(port, "127.0.0.1");
  });
}
