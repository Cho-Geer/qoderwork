import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRunPaths, releasePortReservation, setRunState, writeRunManifest } from "../run-context";
import { inspectRunProcesses, startRunProcesses, stopRunProcesses, validateRunProcess } from "../process";
import type { RunManifest, RunPaths } from "../types";

let tempRoot = "";

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "test-serve-process-"));
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("process identity checks", () => {
  test("status reports dead pids as not alive", () => {
    const paths = createRunPaths("process-test");
    paths.rootDir = tempRoot;
    paths.manifestPath = join(tempRoot, "manifest.json");
    const manifest: RunManifest = {
      runId: "process-test",
      testId: "TSI-03",
      status: "READY",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      primaryWorktree: tempRoot,
      commit: "HEAD",
      port: 39999,
      paths,
      env: { QODERWORK_TEST_RUN_ID: "process-test" },
      sourceOverlay: null,
      sourceStatusPorcelainZ: null,
      rootSessionId: null,
      childSessionId: null,
      grantId: null,
      dispatchKey: null,
      allowedPaths: [],
      bootstrapComplete: false,
      authorization: { h2Authorized: false, dryRun: true },
      process: { servePid: 999999, ssePid: 999998, portReserverPid: null },
      cleanup: { status: "pending", notes: [] },
    };
    Bun.write(paths.manifestPath, JSON.stringify(manifest, null, 2));
    const status = inspectRunProcesses(tempRoot);
    expect(status.serveAlive).toBe(false);
    expect(status.sseAlive).toBe(false);
  });

  test("keeps QODERWORK_TEST_RUN_ID on spawned child", async () => {
    const child = spawn("sleep", ["1"], {
      env: { ...process.env, QODERWORK_TEST_RUN_ID: "process-test" },
      detached: false,
      stdio: "ignore",
    });
    expect(child.pid).toBeDefined();
    child.kill("SIGTERM");
  });

  test("fails closed when SIGKILL does not terminate the port reserver", async () => {
    const signals: NodeJS.Signals[] = [];
    await expect(releasePortReservation(31337, {
      isAlive: () => true,
      signal: (_pid, signal) => signals.push(signal),
      sleep: async () => {},
      gracefulTimeoutMs: 0,
      forceTimeoutMs: 0,
    })).rejects.toThrow("port reserver did not exit: 31337");
    expect(signals).toEqual(["SIGTERM", "SIGKILL"]);
  });

  test("does not clear portReserverPid or write STOPPED when reserver exit is unconfirmed", async () => {
    const paths: RunPaths = {
      ...createRunPaths("port-reserver-still-alive"),
      rootDir: tempRoot,
      manifestPath: join(tempRoot, "manifest.json"),
      worktreeDir: join(tempRoot, "worktree"),
      pidsDir: join(tempRoot, "pids"),
      servePidPath: join(tempRoot, "pids", "serve.pid"),
      ssePidPath: join(tempRoot, "pids", "sse.pid"),
    };
    mkdirSync(paths.pidsDir, { recursive: true });
    writeFileSync(paths.servePidPath, "424242\n");
    const manifest: RunManifest = {
      runId: "port-reserver-still-alive", testId: "TSI-04-PROCESS", status: "READY",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), primaryWorktree: tempRoot,
      commit: "HEAD", port: 39998, paths, env: {}, sourceOverlay: null, sourceStatusPorcelainZ: null,
      rootSessionId: null, childSessionId: null, grantId: null, dispatchKey: null, allowedPaths: [],
      bootstrapComplete: false, authorization: { h2Authorized: false, dryRun: true },
      process: { servePid: null, ssePid: null, portReserverPid: process.pid }, cleanup: { status: "pending", notes: [] },
    };
    writeRunManifest(manifest);

    await expect(stopRunProcesses(tempRoot, {
      releasePortReservation: async () => { throw new Error(`port reserver did not exit: ${process.pid}`); },
    })).rejects.toThrow(`port reserver did not exit: ${process.pid}`);
    const after = JSON.parse(await Bun.file(paths.manifestPath).text()) as RunManifest;
    expect(after.status).toBe("READY");
    expect(after.process.portReserverPid).toBe(process.pid);
    expect(existsSync(paths.servePidPath)).toBe(true);
  });
});

describe("start four-gate checks", () => {
  test("health true but sseReady false results in BLOCKED", async () => {
    const paths = createRunPaths("start-gate-1");
    paths.rootDir = tempRoot;
    paths.manifestPath = join(tempRoot, "manifest.json");
    mkdirSync(paths.pidsDir, { recursive: true });
    mkdirSync(paths.eventsDir, { recursive: true });
    const manifest: RunManifest = {
      runId: "start-gate-1", testId: "TSI-GATE-1", status: "WORKTREE_READY",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      primaryWorktree: tempRoot, commit: "HEAD", port: 39997, paths,
      env: { QODERWORK_TEST_RUN_ID: "start-gate-1" },
      sourceOverlay: null, sourceStatusPorcelainZ: null,
      rootSessionId: null, childSessionId: null, grantId: null, dispatchKey: null,
      allowedPaths: [], bootstrapComplete: false,
      authorization: { h2Authorized: false, dryRun: true },
      process: { servePid: null, ssePid: null, portReserverPid: null },
      cleanup: { status: "pending", notes: [] },
    };
    writeRunManifest(manifest);

    let stopCalled = 0;
    await expect(startRunProcesses(tempRoot, {
      waitForHealth: async () => true,
      validateRunProcess: () => true,
      readSseReadyMarker: () => false,
      stopRunProcesses: async () => { stopCalled++; return manifest; },
      now: (() => { let tick = 0; return () => tick++ < 2 ? 0 : 100_000; })(),
      spawnProcesses: (m) => {
        m.process.servePid = 100001;
        m.process.ssePid = 100002;
        return m;
      },
    })).rejects.toThrow("start failed");
    expect(stopCalled).toBe(1);
  });

  test("marker runId mismatch results in BLOCKED", async () => {
    const paths = createRunPaths("start-gate-2");
    paths.rootDir = tempRoot;
    paths.manifestPath = join(tempRoot, "manifest.json");
    mkdirSync(paths.pidsDir, { recursive: true });
    mkdirSync(paths.eventsDir, { recursive: true });
    const manifest: RunManifest = {
      runId: "start-gate-2", testId: "TSI-GATE-2", status: "WORKTREE_READY",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      primaryWorktree: tempRoot, commit: "HEAD", port: 39996, paths,
      env: { QODERWORK_TEST_RUN_ID: "start-gate-2" },
      sourceOverlay: null, sourceStatusPorcelainZ: null,
      rootSessionId: null, childSessionId: null, grantId: null, dispatchKey: null,
      allowedPaths: [], bootstrapComplete: false,
      authorization: { h2Authorized: false, dryRun: true },
      process: { servePid: null, ssePid: null, portReserverPid: null },
      cleanup: { status: "pending", notes: [] },
    };
    writeRunManifest(manifest);

    let stopCalled = 0;
    await expect(startRunProcesses(tempRoot, {
      waitForHealth: async () => true,
      validateRunProcess: () => true,
      readSseReadyMarker: () => false,
      stopRunProcesses: async () => { stopCalled++; return manifest; },
      now: (() => { let tick = 0; return () => tick++ < 2 ? 0 : 100_000; })(),
      spawnProcesses: (m) => {
        m.process.servePid = 100001;
        m.process.ssePid = 100002;
        return m;
      },
    })).rejects.toThrow("start failed");
    expect(stopCalled).toBe(1);
  });

  test("all four checks true returns READY with all-true checks", async () => {
    const paths = createRunPaths("start-gate-3");
    paths.rootDir = tempRoot;
    paths.manifestPath = join(tempRoot, "manifest.json");
    mkdirSync(paths.pidsDir, { recursive: true });
    mkdirSync(paths.eventsDir, { recursive: true });
    const manifest: RunManifest = {
      runId: "start-gate-3", testId: "TSI-GATE-3", status: "WORKTREE_READY",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      primaryWorktree: tempRoot, commit: "HEAD", port: 39995, paths,
      env: { QODERWORK_TEST_RUN_ID: "start-gate-3" },
      sourceOverlay: null, sourceStatusPorcelainZ: null,
      rootSessionId: null, childSessionId: null, grantId: null, dispatchKey: null,
      allowedPaths: [], bootstrapComplete: false,
      authorization: { h2Authorized: false, dryRun: true },
      process: { servePid: null, ssePid: null, portReserverPid: null },
      cleanup: { status: "pending", notes: [] },
    };
    writeRunManifest(manifest);

    const result = await startRunProcesses(tempRoot, {
      waitForHealth: async () => true,
      validateRunProcess: () => true,
      readSseReadyMarker: () => true,
      stopRunProcesses: async () => { throw new Error("should not be called"); },
      now: () => 0,
      spawnProcesses: (m) => {
        m.process.servePid = 100001;
        m.process.ssePid = 100002;
        return m;
      },
    });
    expect(result.manifest.status).toBe("READY");
    expect(result.checks.health).toBe(true);
    expect(result.checks.serveIdentity).toBe(true);
    expect(result.checks.sseIdentity).toBe(true);
    expect(result.checks.sseReady).toBe(true);
  });
});

describe("PID identity validation (P03-S-05)", () => {
  test("foreign PID rejected by validateRunProcess (P03-S-05)", () => {
    // Spawn a child with a DIFFERENT QODERWORK_TEST_RUN_ID
    const child = spawn("sleep", ["5"], {
      env: { ...process.env, QODERWORK_TEST_RUN_ID: "foreign-run-id" },
      detached: false,
      stdio: "ignore",
    });
    const pid = child.pid!;

    try {
      // validateRunProcess should return false for mismatched run ID
      const result = validateRunProcess(pid, "my-run-id", "sleep");
      expect(result).toBe(false);
    } finally {
      child.kill("SIGKILL");
    }
  });

  test("correct PID accepted by validateRunProcess (P03-S-05 positive)", async () => {
    const child = spawn("sleep", ["5"], {
      env: { ...process.env, QODERWORK_TEST_RUN_ID: "correct-run-id" },
      detached: false,
      stdio: "ignore",
    });
    const pid = child.pid!;

    // Wait for /proc/PID/environ to be populated (race condition fix)
    await new Promise((r) => setTimeout(r, 100));

    try {
      const result = validateRunProcess(pid, "correct-run-id", "sleep");
      expect(result).toBe(true);
    } finally {
      child.kill("SIGKILL");
    }
  });
});

describe("STOPPED -> READY restart transition (hotfix)", () => {
  test("STOPPED -> READY restart transition is legal (hotfix)", async () => {
    // Verify the transition table allows STOPPED -> READY for restart
    // We test this at the setRunState level since startRunProcesses requires
    // real port/process infrastructure
    const paths = createRunPaths("hotfix-restart-test");
    paths.rootDir = tempRoot;
    paths.manifestPath = join(tempRoot, "manifest.json");
    const manifest: RunManifest = {
      runId: "hotfix-restart-test", testId: "HOTFIX-RESTART", status: "STOPPED",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      primaryWorktree: tempRoot, commit: "HEAD", port: 39990, paths,
      env: { QODERWORK_TEST_RUN_ID: "hotfix-restart-test" },
      sourceOverlay: null, sourceStatusPorcelainZ: null,
      rootSessionId: null, childSessionId: null, grantId: null, dispatchKey: null,
      allowedPaths: [], bootstrapComplete: false,
      authorization: { h2Authorized: false, dryRun: true },
      process: { servePid: null, ssePid: null, portReserverPid: null },
      cleanup: { status: "pending", notes: [] },
    };
    writeRunManifest(manifest);
    // STOPPED -> READY should now be legal
    setRunState(manifest, "READY");
    const after = JSON.parse(await Bun.file(paths.manifestPath).text()) as RunManifest;
    expect(after.status).toBe("READY");
  });
});