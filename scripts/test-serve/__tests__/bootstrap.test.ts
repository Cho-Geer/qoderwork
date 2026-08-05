import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawn as spawnChild } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Database } from "bun:sqlite";
import { bootstrapRun, loadPrivilegeService } from "../bootstrap";
import { cleanupRun } from "../isolated-serve";
import { createRunPaths, readRunManifest, validateSourceOverlay } from "../run-context";
import type { BootstrapInput, RunManifest, RunPaths } from "../types";

let tempRoot = "";

function writeReadyManifest(runId: string, port: number = 1): { rootDir: string; worktreeDir: string; manifest: RunManifest } {
  const rootDir = join(tempRoot, runId);
  const worktreeDir = join(rootDir, "worktree");
  const paths = createRunPaths(runId);
  Object.assign(paths, {
    rootDir,
    manifestPath: join(rootDir, "manifest.json"),
    worktreeDir,
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
  });
  [rootDir, worktreeDir, paths.dbDir, paths.pidsDir, paths.artifactsDir].forEach((dir) => mkdirSync(dir, { recursive: true }));
  const manifest: RunManifest = {
    runId, testId: runId, status: "READY", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    primaryWorktree: "/nonexistent", commit: "HEAD", port, paths, env: {}, sourceOverlay: null, sourceStatusPorcelainZ: null,
    rootSessionId: null, childSessionId: null, grantId: null, dispatchKey: null, allowedPaths: [], bootstrapComplete: false,
    authorization: { h2Authorized: false, dryRun: true }, process: { servePid: null, ssePid: null, portReserverPid: null },
    cleanup: { status: "pending", notes: [] },
  };
  writeFileSync(paths.manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  return { rootDir, worktreeDir, manifest };
}

function runCli(args: string[]): Promise<{ exitCode: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawnChild(process.execPath, ["run", "scripts/test-serve/isolated-serve.ts", ...args], {
      cwd: process.cwd(), stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("exit", (exitCode) => resolve({ exitCode, stderr }));
  });
}

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "test-serve-bootstrap-"));
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("bootstrap preconditions", () => {
  test("overlay validation rejects missing triple", () => {
    const overlayDir = join(tempRoot, "overlay");
    Bun.write(join(overlayDir, "tracked.patch"), "");
    expect(() => validateSourceOverlay(overlayDir)).toThrow("missing required file");
  });

  test("run paths layout is nested under run root", () => {
    const paths = createRunPaths("bootstrap-test");
    expect(paths.frameworkDbPath.startsWith(paths.rootDir)).toBe(true);
    expect(paths.opencodeDbPath.startsWith(paths.rootDir)).toBe(true);
    expect(paths.eventFilePath.startsWith(paths.rootDir)).toBe(true);
  });

  test("writes simple overlay manifest fixture", () => {
    const overlayDir = join(tempRoot, "overlay");
    Bun.write(join(overlayDir, "tracked.patch"), "");
    Bun.write(join(overlayDir, "untracked.tar"), "");
    writeFileSync(
      join(overlayDir, "source-manifest.json"),
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          sourceCommit: "HEAD",
          sourceStatusPorcelainZ: "",
          patchSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          tarSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          untrackedFiles: [],
        },
        null,
        2,
      ),
    );
    const overlay = validateSourceOverlay(overlayDir);
    expect(overlay.dir).toBe(overlayDir);
  });
});

describe("bootstrapRun fail-closed (TSI-04)", () => {
  test("rejects empty child agent before any HTTP request", () => {
    const runId = "tsi-04-no-child";
    const rootDir = join(tempRoot, runId);
    mkdirSync(rootDir, { recursive: true });

    const paths = createRunPaths(runId);
    paths.manifestPath = join(rootDir, "manifest.json");
    const worktreeDir = join(rootDir, "worktree");
    mkdirSync(worktreeDir, { recursive: true });

    const manifest: RunManifest = {
      runId,
      testId: "TSI-04-NO-CHILD",
      status: "READY",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      primaryWorktree: "/nonexistent",
      commit: "HEAD",
      port: 1,
      paths: { ...paths, worktreeDir },
      env: {},
      sourceOverlay: null,
      sourceStatusPorcelainZ: null,
      rootSessionId: null,
      childSessionId: null,
      grantId: null,
      dispatchKey: null,
      allowedPaths: [worktreeDir],
      bootstrapComplete: false,
      authorization: { h2Authorized: false, dryRun: true },
      process: { servePid: null, ssePid: null, portReserverPid: null },
      cleanup: { status: "pending", notes: [] },
    };
    mkdirSync(dirname(paths.manifestPath), { recursive: true });
    writeFileSync(paths.manifestPath, JSON.stringify(manifest, null, 2) + "\n");

    const input: BootstrapInput = {
      runDir: rootDir,
      rootAgent: "build",
      childAgent: "",
      allowedPaths: [worktreeDir],
      reason: "test",
    };

    expect(bootstrapRun(input)).rejects.toThrow("bootstrap child agent is required");
  });

  test("sets BLOCKED when bindGrant returns null", async () => {
    const runId = "tsi-04-bind-null";
    const rootDir = join(tempRoot, runId);
    mkdirSync(rootDir, { recursive: true });

    const worktreeDir = join(rootDir, "worktree");
    const dispatchDir = join(worktreeDir, ".opencode", "service", "dispatch");
    mkdirSync(dispatchDir, { recursive: true });
    // bindGrant 返回 null 模拟
    writeFileSync(
      join(dispatchDir, "privilege.ts"),
      [
        'export function createGrant() {',
        '  return { id: "g1" };',
        '}',
        'export function bindGrant() {',
        '  return null;',
        '}',
      ].join("\n"),
    );

    // 需要 framework DB 让 assertGrantBound 不会在 bindGrant 之前失败
    const dbDir = join(rootDir, "db");
    mkdirSync(dbDir, { recursive: true });

    const paths: RunPaths = {
      rootDir,
      manifestPath: join(rootDir, "manifest.json"),
      worktreeDir,
      dbDir: join(rootDir, "db"),
      frameworkDbPath: join(rootDir, "db", "framework-state.db"),
    } as RunPaths;

    const manifest: RunManifest = {
      runId,
      testId: "TSI-04-BIND-NULL",
      status: "READY",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      primaryWorktree: "/nonexistent",
      commit: "HEAD",
      port: 1,
      paths: { ...paths, worktreeDir },
      env: {},
      sourceOverlay: null,
      sourceStatusPorcelainZ: null,
      rootSessionId: null,
      childSessionId: null,
      grantId: null,
      dispatchKey: null,
      allowedPaths: [worktreeDir],
      bootstrapComplete: false,
      authorization: { h2Authorized: false, dryRun: true },
      process: { servePid: null, ssePid: null, portReserverPid: null },
      cleanup: { status: "pending", notes: [] },
    };
    mkdirSync(dirname(paths.manifestPath), { recursive: true });
    writeFileSync(paths.manifestPath, JSON.stringify(manifest, null, 2) + "\n");

    const input: BootstrapInput = {
      runDir: rootDir,
      rootAgent: "build",
      childAgent: "general",
      allowedPaths: [worktreeDir],
      reason: "test",
    };

    const sessionBodies: Record<string, unknown>[] = [];
    await expect(bootstrapRun(input, {
      createSession: async (_manifest, body) => {
        sessionBodies.push(body);
        return { id: sessionBodies.length === 1 ? "root-1" : "child-1" };
      },
      loadPrivilegeService: async () => ({
        createGrant: () => ({ id: "grant-1" }),
        bindGrant: () => null,
      }),
      stopRunProcesses: async () => readRunManifest(rootDir),
      waitForSessionBarrier: async () => {},
    })).rejects.toThrow("bootstrap failed at bind-grant: bindGrant returned null");

    const after = readRunManifest(rootDir);
    expect(sessionBodies).toHaveLength(2);
    expect(sessionBodies[1]?.parentID).toBe("root-1");
    expect(after.status).toBe("BLOCKED");
    expect(after.bootstrapComplete).toBe(false);
    expect(after.rootSessionId).toBe("root-1");
    expect(after.childSessionId).toBe("child-1");
    expect(after.grantId).toBe("grant-1");
    expect(after.dispatchKey).toStartWith("dispatch-");
  });

  test("sets BLOCKED when the bound-grant DB oracle rejects the row", async () => {
    const runId = "tsi-04-oracle-mismatch";
    const rootDir = join(tempRoot, runId);
    const worktreeDir = join(rootDir, "worktree");
    mkdirSync(worktreeDir, { recursive: true });
    const paths = createRunPaths(runId);
    paths.manifestPath = join(rootDir, "manifest.json");
    const manifest: RunManifest = {
      runId,
      testId: "TSI-04-ORACLE-MISMATCH",
      status: "READY",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      primaryWorktree: "/nonexistent",
      commit: "HEAD",
      port: 1,
      paths: { ...paths, worktreeDir },
      env: {},
      sourceOverlay: null,
      sourceStatusPorcelainZ: null,
      rootSessionId: null,
      childSessionId: null,
      grantId: null,
      dispatchKey: null,
      allowedPaths: [],
      bootstrapComplete: false,
      authorization: { h2Authorized: false, dryRun: true },
      process: { servePid: null, ssePid: null, portReserverPid: null },
      cleanup: { status: "pending", notes: [] },
    };
    writeFileSync(paths.manifestPath, JSON.stringify(manifest, null, 2) + "\n");

    await expect(bootstrapRun({
      runDir: rootDir,
      rootAgent: "build",
      childAgent: "general",
      allowedPaths: [worktreeDir],
      reason: "test",
    }, {
      createSession: async (_manifest, body) => ({ id: body.parentID ? "child-1" : "root-1" }),
      loadPrivilegeService: async () => ({
        createGrant: () => ({ id: "grant-1" }),
        bindGrant: () => ({ id: "grant-1" }),
      }),
      assertGrantBound: () => { throw new Error("grant row not bound in framework DB"); },
      stopRunProcesses: async () => readRunManifest(rootDir),
      waitForSessionBarrier: async () => {},
    })).rejects.toThrow("bootstrap failed at db-oracle: grant row not bound in framework DB");

    const after = readRunManifest(rootDir);
    expect(after.status).toBe("BLOCKED");
    expect(after.bootstrapComplete).toBe(false);
    expect(after.rootSessionId).toBe("root-1");
    expect(after.childSessionId).toBe("child-1");
    expect(after.grantId).toBe("grant-1");
  });

  test("persists BLOCKED when child session creation fails", async () => {
    const { rootDir, worktreeDir } = writeReadyManifest("tsi-04-child-session-failure");
    let calls = 0;
    await expect(bootstrapRun({ runDir: rootDir, rootAgent: "build", childAgent: "general", allowedPaths: [worktreeDir], reason: "test" }, {
      createSession: async () => {
        calls += 1;
        if (calls === 1) return { id: "root-1" };
        throw new Error("child session create failed");
      },
      loadPrivilegeService: async () => ({ createGrant: () => ({ id: "grant-1" }), bindGrant: () => ({ id: "grant-1" }) }),
      stopRunProcesses: async () => readRunManifest(rootDir),
      waitForSessionBarrier: async () => {},
    })).rejects.toThrow("bootstrap failed at create-child-session: child session create failed");
    const after = readRunManifest(rootDir);
    expect(after.status).toBe("BLOCKED");
    expect(after.rootSessionId).toBe("root-1");
    expect(after.childSessionId).toBeNull();
    expect(after.grantId).toBe("grant-1");
  });

  test("persists BLOCKED when the production privilege import fails", async () => {
    const { rootDir, worktreeDir } = writeReadyManifest("tsi-04-production-import-failure");
    await expect(bootstrapRun({ runDir: rootDir, rootAgent: "build", childAgent: "general", allowedPaths: [worktreeDir], reason: "test" }, {
      createSession: async () => ({ id: "root-1" }),
      stopRunProcesses: async () => readRunManifest(rootDir),
      waitForSessionBarrier: async () => {},
    })).rejects.toThrow("bootstrap failed at load-privilege-service");
    const after = readRunManifest(rootDir);
    expect(after.status).toBe("BLOCKED");
    expect(after.rootSessionId).toBe("root-1");
    expect(after.grantId).toBeNull();
  });

  test("bind-null CLI exits 1 after persisting BLOCKED", async () => {
    const server = Bun.serve({
      port: 0,
      async fetch() {
        return Response.json({ id: "session" });
      },
    });
    const { rootDir, worktreeDir } = writeReadyManifest("tsi-04-bind-null-cli", server.port);
    const dispatchDir = join(worktreeDir, ".opencode", "service", "dispatch");
    mkdirSync(dispatchDir, { recursive: true });
    writeFileSync(join(dispatchDir, "privilege.ts"), [
      'export function createGrant() { return { id: "grant-cli" }; }',
      'export function bindGrant() { return null; }',
    ].join("\n"));
    mkdirSync(join(rootDir, "events"), { recursive: true });
    writeFileSync(join(rootDir, "events", "events.jsonl"), JSON.stringify({ type: "session.created", sessionID: "session" }) + "\n");
    const dbDir2 = join(rootDir, "db");
    mkdirSync(dbDir2, { recursive: true });
    
    const fwDb = new Database(join(dbDir2, "framework-state.db"));
    fwDb.run("CREATE TABLE IF NOT EXISTS session_map (session_id TEXT PRIMARY KEY, agent TEXT, created_at INTEGER, updated_at INTEGER)");
    fwDb.run("INSERT OR IGNORE INTO session_map (session_id, agent, created_at, updated_at) VALUES (?, ?, ?, ?)", ["session", "build", Date.now(), Date.now()]);
    fwDb.close();

    const sdkDb = new Database(join(dbDir2, "opencode.db"));
    sdkDb.run("CREATE TABLE IF NOT EXISTS session (id TEXT PRIMARY KEY, parent_id TEXT)");
    sdkDb.run("INSERT OR IGNORE INTO session (id, parent_id) VALUES (?, ?)", ["session", "session"]);
    sdkDb.close();

    try {
      const result = await runCli([
        "bootstrap", "--run-dir", rootDir, "--root-agent", "build", "--child-agent", "general",
        "--allowed-paths", worktreeDir,
      ]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("bootstrap failed at bind-grant: bindGrant returned null");
      const after = readRunManifest(rootDir);
      expect(after.status).toBe("BLOCKED");
      expect(after.bootstrapComplete).toBe(false);
      expect(after.grantId).toBe("grant-cli");
    } finally {
      server.stop(true);
    }
  });

  test("creates and binds a production grant in the isolated worktree DB", async () => {
    const runId = "tsi-04-production-success";
    const rootDir = join(tempRoot, runId);
    const worktreeDir = join(rootDir, "worktree");
    const dbDir = join(rootDir, "db");
    const logsDir = join(rootDir, "logs", "framework");
    const paths: RunPaths = {
      rootDir,
      manifestPath: join(rootDir, "manifest.json"),
      worktreeDir,
      dbDir,
      frameworkDbPath: join(dbDir, "framework-state.db"),
      opencodeDbPath: join(dbDir, "opencode.db"),
      logsDir: join(rootDir, "logs"),
      frameworkLogDir: logsDir,
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
    [rootDir, dbDir, logsDir, paths.pidsDir, paths.artifactsDir].forEach((dir) => mkdirSync(dir, { recursive: true }));
    cpSync("${WORK_ONE_ROOT}/.opencode", join(worktreeDir, ".opencode"), {
      recursive: true,
      filter: (source) => !source.includes("/.opencode/state"),
    });

    const requests: Record<string, unknown>[] = [];
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        expect(new URL(request.url).pathname).toBe("/session");
        const body = await request.json() as Record<string, unknown>;
        requests.push(body);
        if (requests.length === 1) return Response.json({ id: "root-1" });
        expect(body.parentID).toBe("root-1");
        return Response.json({ id: "child-1" });
      },
    });
    try {
      const manifest: RunManifest = {
        runId,
        testId: "TSI-04-PRODUCTION-SUCCESS",
        status: "READY",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        primaryWorktree: "/nonexistent",
        commit: "HEAD",
        port: server.port as number,
        paths,
        env: {
          OPENCODE_ROOT: worktreeDir,
          FRAMEWORK_DB_PATH: paths.frameworkDbPath,
          OPENCODE_LOG_DIR: paths.frameworkLogDir,
          QODERWORK_TEST_RUN_ID: runId,
        },
        sourceOverlay: null,
        sourceStatusPorcelainZ: null,
        rootSessionId: null,
        childSessionId: null,
        grantId: null,
        dispatchKey: null,
        allowedPaths: [],
        bootstrapComplete: false,
        authorization: { h2Authorized: false, dryRun: true },
        process: { servePid: null, ssePid: null, portReserverPid: null },
        cleanup: { status: "pending", notes: [] },
      };
      writeFileSync(paths.manifestPath, JSON.stringify(manifest, null, 2) + "\n");

      const result = await bootstrapRun({
        runDir: rootDir,
        rootAgent: "build",
        childAgent: "general",
        allowedPaths: [join(worktreeDir, ".opencode")],
        reason: "production integration test",
      }, {
        waitForSessionBarrier: async () => {},
      });
      expect(result.status).toBe("BOOTSTRAPPED");
      expect(result.bootstrapComplete).toBe(true);
      expect(result.rootSessionId).toBe("root-1");
      expect(result.childSessionId).toBe("child-1");
      expect(result.grantId).not.toBeNull();
      expect(requests).toHaveLength(2);

      const db = new Database(paths.frameworkDbPath, { readonly: true });
      try {
        const row = db.query(
          "SELECT id, status, child_session_id, parent_session_id, agent_type FROM dispatch_privilege_grants WHERE id = ?",
        ).get(result.grantId!) as Record<string, string>;
        expect(row.id).toBe(result.grantId as string);
        expect(row.status).toBe("bound");
        expect(row.child_session_id).toBe("child-1");
        expect(row.parent_session_id).toBe("root-1");
        expect(row.agent_type).toBe("general");
      } finally {
        db.close();
      }
    } finally {
      server.stop(true);
    }
  });

  test("rejects a normalized path traversal before any session request", async () => {
    const runId = "tsi-04-path-traversal";
    const rootDir = join(tempRoot, runId);
    const worktreeDir = join(rootDir, "worktree");
    const outsideDir = join(rootDir, "outside");
    mkdirSync(worktreeDir, { recursive: true });
    mkdirSync(outsideDir, { recursive: true });
    const paths = createRunPaths(runId);
    paths.manifestPath = join(rootDir, "manifest.json");
    const manifest: RunManifest = {
      runId, testId: "TSI-04-PATH", status: "READY", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      primaryWorktree: "/nonexistent", commit: "HEAD", port: 1, paths: { ...paths, worktreeDir }, env: {}, sourceOverlay: null,
      sourceStatusPorcelainZ: null, rootSessionId: null, childSessionId: null, grantId: null, dispatchKey: null, allowedPaths: [],
      bootstrapComplete: false, authorization: { h2Authorized: false, dryRun: true }, process: { servePid: null, ssePid: null, portReserverPid: null }, cleanup: { status: "pending", notes: [] },
    };
    writeFileSync(paths.manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    let sessions = 0;
    await expect(bootstrapRun({ runDir: rootDir, rootAgent: "build", childAgent: "general", allowedPaths: [join(worktreeDir, "..", "outside")], reason: "test" }, {
      createSession: async () => { sessions += 1; return { id: "unexpected" }; },
    })).rejects.toThrow("allowed path outside worktree");
    expect(sessions).toBe(0);
    expect(readRunManifest(rootDir).status).toBe("READY");

    const escapedLink = join(worktreeDir, "escaped-link");
    symlinkSync(outsideDir, escapedLink);
    await expect(bootstrapRun({ runDir: rootDir, rootAgent: "build", childAgent: "general", allowedPaths: [escapedLink], reason: "test" }, {
      createSession: async () => { sessions += 1; return { id: "unexpected" }; },
    })).rejects.toThrow("allowed path outside worktree");
    expect(sessions).toBe(0);
  });

  test("rejects BLOCKED cleanup while a bootstrap PID file remains", async () => {
    const runId = "tsi-04-blocked-pid-file";
    const rootDir = join(tempRoot, runId);
    const worktreeDir = join(rootDir, "worktree");
    const paths = createRunPaths(runId);
    Object.assign(paths, {
      rootDir,
      manifestPath: join(rootDir, "manifest.json"),
      worktreeDir,
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
    });
    [worktreeDir, paths.pidsDir, paths.artifactsDir].forEach((dir) => mkdirSync(dir, { recursive: true }));
    writeFileSync(paths.servePidPath, "12345\n");
    const manifest: RunManifest = {
      runId, testId: "TSI-04-BLOCKED-PID", status: "BLOCKED", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      primaryWorktree: "/nonexistent", commit: "HEAD", port: 1, paths, env: {}, sourceOverlay: null, sourceStatusPorcelainZ: null,
      rootSessionId: "root-1", childSessionId: "child-1", grantId: "grant-1", dispatchKey: "dispatch-1", allowedPaths: [worktreeDir],
      bootstrapComplete: false, authorization: { h2Authorized: false, dryRun: true }, process: { servePid: null, ssePid: null, portReserverPid: null }, cleanup: { status: "pending", notes: [] },
    };
    writeFileSync(paths.manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    await expect(cleanupRun(rootDir)).rejects.toThrow("cleanup requires STOPPED state");
  });
});

describe("bootstrapRun import source regression (TSI-04)", () => {
  // 保留原有 import-source 测试，确保动态导入不回退到主 work-one
  test("loads privilege service from the isolated worktree, NOT from primary work-one", async () => {
    const fakeWorktree = join(tempRoot, "fake-worktree");
    const dispatchDir = join(fakeWorktree, ".opencode", "service", "dispatch");
    mkdirSync(dispatchDir, { recursive: true });
    writeFileSync(
      join(dispatchDir, "privilege.ts"),
      [
        'export function createGrant() {',
        '  return { id: "grant-FROM_FAKE_WORKTREE-marker" };',
        '}',
        'export function bindGrant() {',
        '  return { id: "bind-FROM_FAKE_WORKTREE-marker" };',
        '}',
      ].join("\n"),
    );

    const paths = createRunPaths("tsi-04-import-source")

    const manifest: RunManifest = {
      runId: "tsi-04",
      testId: "TSI-04-ABS_IMPORT",
      status: "READY",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      primaryWorktree: "/nonexistent-should-not-be-used",
      commit: "HEAD",
      port: 1,
      paths: { ...paths, worktreeDir: fakeWorktree },
      env: {},
      sourceOverlay: null,
      sourceStatusPorcelainZ: null,
      rootSessionId: null,
      childSessionId: null,
      grantId: null,
      dispatchKey: null,
      allowedPaths: [],
      bootstrapComplete: false,
      authorization: { h2Authorized: false, dryRun: true },
      process: { servePid: null, ssePid: null, portReserverPid: null },
      cleanup: { status: "pending", notes: [] },
    };

    const service = await loadPrivilegeService(manifest);
    const grant = service.createGrant({
      dispatch_key: "k",
      parent_session_id: "s",
      agent_type: "general",
      privilege: "p",
      allowed_tools: [],
      reason: "r",
    });
    const bound = service.bindGrant("k", "child");

    expect(grant?.id).toContain("FROM_FAKE_WORKTREE");
    expect(bound?.id).toContain("FROM_FAKE_WORKTREE");
  });
});

describe("bootstrapRun SSE/DB barrier (P0-1B)", () => {
  test("root barrier not completed: createGrant call count is 0", async () => {
    const runId = "p01b-root-barrier-pending";
    const rootDir = join(tempRoot, runId);
    const worktreeDir = join(rootDir, "worktree");
    mkdirSync(worktreeDir, { recursive: true });
    const paths = createRunPaths(runId);
    paths.manifestPath = join(rootDir, "manifest.json");
    const manifest: RunManifest = {
      runId, testId: "P01B-ROOT-BARRIER", status: "READY",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      primaryWorktree: "/nonexistent", commit: "HEAD", port: 1, paths: { ...paths, worktreeDir },
      env: {}, sourceOverlay: null, sourceStatusPorcelainZ: null,
      rootSessionId: null, childSessionId: null, grantId: null, dispatchKey: null, allowedPaths: [worktreeDir],
      bootstrapComplete: false, authorization: { h2Authorized: false, dryRun: true },
      process: { servePid: null, ssePid: null, portReserverPid: null },
      cleanup: { status: "pending", notes: [] },
    };
    mkdirSync(dirname(paths.manifestPath), { recursive: true });
    writeFileSync(paths.manifestPath, JSON.stringify(manifest, null, 2) + "\n");

    let grantCalls = 0;
    await expect(bootstrapRun({
      runDir: rootDir, rootAgent: "build", childAgent: "general", allowedPaths: [worktreeDir], reason: "test",
    }, {
      createSession: async () => ({ id: "root-1" }),
      waitForSessionBarrier: async () => { throw new Error("session barrier timeout for root-1"); },
      loadPrivilegeService: async () => ({
        createGrant: () => { grantCalls++; return { id: "g1" }; },
        bindGrant: () => ({ id: "g1" }),
      }),
      stopRunProcesses: async () => readRunManifest(rootDir),
    })).rejects.toThrow("bootstrap failed at root-barrier");
    expect(grantCalls).toBe(0);
  });

  test("child barrier not completed: bindGrant call count is 0", async () => {
    const runId = "p01b-child-barrier-pending";
    const rootDir = join(tempRoot, runId);
    const worktreeDir = join(rootDir, "worktree");
    mkdirSync(worktreeDir, { recursive: true });
    const paths = createRunPaths(runId);
    paths.manifestPath = join(rootDir, "manifest.json");
    const manifest: RunManifest = {
      runId, testId: "P01B-CHILD-BARRIER", status: "READY",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      primaryWorktree: "/nonexistent", commit: "HEAD", port: 1, paths: { ...paths, worktreeDir },
      env: {}, sourceOverlay: null, sourceStatusPorcelainZ: null,
      rootSessionId: null, childSessionId: null, grantId: null, dispatchKey: null, allowedPaths: [worktreeDir],
      bootstrapComplete: false, authorization: { h2Authorized: false, dryRun: true },
      process: { servePid: null, ssePid: null, portReserverPid: null },
      cleanup: { status: "pending", notes: [] },
    };
    mkdirSync(dirname(paths.manifestPath), { recursive: true });
    writeFileSync(paths.manifestPath, JSON.stringify(manifest, null, 2) + "\n");

    let bindCalls = 0;
    let childBarrierCallCount = 0;
    await expect(bootstrapRun({
      runDir: rootDir, rootAgent: "build", childAgent: "general", allowedPaths: [worktreeDir], reason: "test",
    }, {
      createSession: async (_m, body) => ({ id: body.parentID ? "child-1" : "root-1" }),
      waitForSessionBarrier: async (input) => {
        if (input.parentSessionId === null) return;
        childBarrierCallCount++;
        throw new Error("session barrier timeout for child-1");
      },
      loadPrivilegeService: async () => ({
        createGrant: () => ({ id: "g1" }),
        bindGrant: () => { bindCalls++; return { id: "g1" }; },
      }),
      stopRunProcesses: async () => readRunManifest(rootDir),
    })).rejects.toThrow("bootstrap failed at child-barrier");
    expect(bindCalls).toBe(0);
    expect(childBarrierCallCount).toBe(1);
  });

  test("SQLITE_BUSY during createGrant results in BLOCKED and second bootstrap rejected", async () => {
    const runId = "p01b-sqlite-busy";
    const rootDir = join(tempRoot, runId);
    const worktreeDir = join(rootDir, "worktree");
    mkdirSync(worktreeDir, { recursive: true });
    const paths = createRunPaths(runId);
    paths.manifestPath = join(rootDir, "manifest.json");
    const manifest: RunManifest = {
      runId, testId: "P01B-SQLITE-BUSY", status: "READY",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      primaryWorktree: "/nonexistent", commit: "HEAD", port: 1, paths: { ...paths, worktreeDir },
      env: {}, sourceOverlay: null, sourceStatusPorcelainZ: null,
      rootSessionId: null, childSessionId: null, grantId: null, dispatchKey: null, allowedPaths: [worktreeDir],
      bootstrapComplete: false, authorization: { h2Authorized: false, dryRun: true },
      process: { servePid: null, ssePid: null, portReserverPid: null },
      cleanup: { status: "pending", notes: [] },
    };
    mkdirSync(dirname(paths.manifestPath), { recursive: true });
    writeFileSync(paths.manifestPath, JSON.stringify(manifest, null, 2) + "\n");

    await expect(bootstrapRun({
      runDir: rootDir, rootAgent: "build", childAgent: "general", allowedPaths: [worktreeDir], reason: "test",
    }, {
      createSession: async () => ({ id: "root-1" }),
      waitForSessionBarrier: async () => {},
      loadPrivilegeService: async () => ({
        createGrant: () => { throw new Error("SQLITE_BUSY: database is locked"); },
        bindGrant: () => ({ id: "g1" }),
      }),
      stopRunProcesses: async () => readRunManifest(rootDir),
    })).rejects.toThrow("bootstrap failed at create-grant: SQLITE_BUSY");

    const after = readRunManifest(rootDir);
    expect(after.status).toBe("BLOCKED");
    expect(after.bootstrapComplete).toBe(false);

    await expect(bootstrapRun({
      runDir: rootDir, rootAgent: "build", childAgent: "general", allowedPaths: [worktreeDir], reason: "test",
    }, {
      createSession: async () => ({ id: "root-1" }),
    })).rejects.toThrow("bootstrap requires READY state");
  });

  test("root/child barrier and bound oracle all pass: BOOTSTRAPPED", async () => {
    const runId = "p01b-barrier-success";
    const rootDir = join(tempRoot, runId);
    const worktreeDir = join(rootDir, "worktree");
    mkdirSync(worktreeDir, { recursive: true });
    const paths = createRunPaths(runId);
    paths.manifestPath = join(rootDir, "manifest.json");
    const manifest: RunManifest = {
      runId, testId: "P01B-BARRIER-SUCCESS", status: "READY",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      primaryWorktree: "/nonexistent", commit: "HEAD", port: 1, paths: { ...paths, worktreeDir },
      env: {}, sourceOverlay: null, sourceStatusPorcelainZ: null,
      rootSessionId: null, childSessionId: null, grantId: null, dispatchKey: null, allowedPaths: [worktreeDir],
      bootstrapComplete: false, authorization: { h2Authorized: false, dryRun: true },
      process: { servePid: null, ssePid: null, portReserverPid: null },
      cleanup: { status: "pending", notes: [] },
    };
    mkdirSync(dirname(paths.manifestPath), { recursive: true });
    writeFileSync(paths.manifestPath, JSON.stringify(manifest, null, 2) + "\n");

    const result = await bootstrapRun({
      runDir: rootDir, rootAgent: "build", childAgent: "general", allowedPaths: [worktreeDir], reason: "test",
    }, {
      createSession: async (_m, body) => ({ id: body.parentID ? "child-1" : "root-1" }),
      waitForSessionBarrier: async () => {},
      loadPrivilegeService: async () => ({
        createGrant: () => ({ id: "grant-1" }),
        bindGrant: () => ({ id: "grant-1" }),
      }),
      assertGrantBound: () => {},
      stopRunProcesses: async () => readRunManifest(rootDir),
    });
    expect(result.status).toBe("BOOTSTRAPPED");
    expect(result.bootstrapComplete).toBe(true);
    expect(result.rootSessionId).toBe("root-1");
    expect(result.childSessionId).toBe("child-1");
    expect(result.grantId).toBe("grant-1");
  });
});