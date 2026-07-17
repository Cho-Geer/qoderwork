import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { verifyP01b } from "../verify-p01b";
import { createRunPaths, writeRunManifest } from "../run-context";
import type { RunManifest, RunPaths } from "../types";

let tempRoot = "";

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "verify-p01b-test-"));
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

function makeMinimalManifest(overrides: Partial<RunManifest> = {}): RunManifest {
  const runId = overrides.runId ?? "verify-test";
  const paths = createRunPaths(runId);
  Object.assign(paths, {
    rootDir: tempRoot,
    manifestPath: join(tempRoot, "manifest.json"),
    worktreeDir: join(tempRoot, "worktree"),
    dbDir: join(tempRoot, "db"),
    frameworkDbPath: join(tempRoot, "db", "framework-state.db"),
    opencodeDbPath: join(tempRoot, "db", "opencode.db"),
    logsDir: join(tempRoot, "logs"),
    frameworkLogDir: join(tempRoot, "logs", "framework"),
    serveLogPath: join(tempRoot, "logs", "serve.log"),
    sseLogPath: join(tempRoot, "logs", "sse.log"),
    eventsDir: join(tempRoot, "events"),
    eventFilePath: join(tempRoot, "events", "events.jsonl"),
    sseReadyPath: join(tempRoot, "events", "sse-ready.json"),
    archiveDir: join(tempRoot, "events", "archive"),
    pidsDir: join(tempRoot, "pids"),
    servePidPath: join(tempRoot, "pids", "serve.pid"),
    ssePidPath: join(tempRoot, "pids", "sse.pid"),
    artifactsDir: join(tempRoot, "artifacts"),
    cleanupReportPath: join(tempRoot, "cleanup-report.json"),
  });
  const manifest: RunManifest = {
    runId, testId: "VERIFY-TEST", status: "BOOTSTRAPPED",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    primaryWorktree: "/nonexistent", commit: "HEAD", port: 39999, paths,
    env: {}, sourceOverlay: null, sourceStatusPorcelainZ: null,
    rootSessionId: "root-1", childSessionId: "child-1", grantId: "grant-1",
    dispatchKey: "dispatch-1", allowedPaths: [],
    bootstrapComplete: true,
    authorization: { h2Authorized: false, dryRun: true },
    process: { servePid: 100, ssePid: 200, portReserverPid: null },
    cleanup: { status: "pending", notes: [] },
    ...overrides,
  };
  [paths.dbDir, paths.eventsDir, paths.pidsDir, paths.artifactsDir, paths.logsDir, paths.frameworkLogDir].forEach(
    (dir) => mkdirSync(dir, { recursive: true }),
  );
  writeRunManifest(manifest);
  return manifest;
}

function seedRuntimeData(manifest: RunManifest): void {
  writeFileSync(manifest.paths.sseReadyPath, JSON.stringify({
    runId: manifest.runId,
    serveUrl: `http://127.0.0.1:${manifest.port}`,
    eventFile: manifest.paths.eventFilePath,
    connectedAt: new Date().toISOString(),
  }));

  writeFileSync(manifest.paths.eventFilePath,
    JSON.stringify({ type: "session.created", sessionID: manifest.rootSessionId }) + "\n" +
    JSON.stringify({ type: "session.created", sessionID: manifest.childSessionId }) + "\n",
  );

  const fwDb = new Database(manifest.paths.frameworkDbPath);
  fwDb.run("CREATE TABLE IF NOT EXISTS session_map (session_id TEXT PRIMARY KEY, agent TEXT, created_at INTEGER, updated_at INTEGER)");
  fwDb.run("CREATE TABLE IF NOT EXISTS dispatch_privilege_grants (id TEXT PRIMARY KEY, status TEXT, child_session_id TEXT, parent_session_id TEXT, agent_type TEXT)");
  fwDb.run("INSERT INTO session_map (session_id, agent, created_at, updated_at) VALUES (?, ?, ?, ?)", [manifest.rootSessionId!, "build", Date.now(), Date.now()]);
  fwDb.run("INSERT INTO session_map (session_id, agent, created_at, updated_at) VALUES (?, ?, ?, ?)", [manifest.childSessionId!, "general", Date.now(), Date.now()]);
  fwDb.run("INSERT INTO dispatch_privilege_grants (id, status, child_session_id, parent_session_id, agent_type) VALUES (?, ?, ?, ?, ?)", [manifest.grantId!, "bound", manifest.childSessionId!, manifest.rootSessionId!, "general"]);
  fwDb.close();

  const sdkDb = new Database(manifest.paths.opencodeDbPath);
  sdkDb.exec("CREATE TABLE IF NOT EXISTS session (id TEXT PRIMARY KEY, parent_id TEXT)");
  sdkDb.run("INSERT INTO session (id, parent_id) VALUES (?, ?)", [manifest.rootSessionId!, null]);
  sdkDb.run("INSERT INTO session (id, parent_id) VALUES (?, ?)", [manifest.childSessionId!, manifest.rootSessionId!]);
  sdkDb.close();

  mkdirSync(manifest.paths.artifactsDir, { recursive: true });
  writeFileSync(join(manifest.paths.artifactsDir, "plan-result.json"), JSON.stringify({ status: "NOT-RUN" }));
}

function seedCleanupData(manifest: RunManifest): void {
  seedRuntimeData(manifest);
  const updated = { ...manifest, status: "CLEANED" as const };
  writeRunManifest(updated);
  rmSync(manifest.paths.worktreeDir, { recursive: true, force: true });
  writeFileSync(manifest.paths.serveLogPath, "serve log\n");
  writeFileSync(manifest.paths.sseLogPath, "sse log\n");
  writeFileSync(manifest.paths.cleanupReportPath, JSON.stringify({
    success: true, worktreeRemoved: true, schemaVersion: 1, runId: manifest.runId,
  }));
}

describe("verifyP01b", () => {
  test("runtime: all checks pass with complete data", () => {
    const manifest = makeMinimalManifest();
    seedRuntimeData(manifest);
    const result = verifyP01b(tempRoot, "runtime");
    expect(result.ok).toBe(true);
    expect(result.phase).toBe("runtime");
    expect(result.failedChecks).toEqual([]);
    expect(result.checks.statusBootstrapped).toBe(true);
    expect(result.checks.pidFieldsPresent).toBe(true);
    expect(result.checks.sseReadyValid).toBe(true);
    expect(result.checks.rootInSdkDb).toBe(true);
    expect(result.checks.childInSdkDb).toBe(true);
    expect(result.checks.rootEventPresent).toBe(true);
    expect(result.checks.childEventPresent).toBe(true);
    expect(result.checks.rootSessionMapPresent).toBe(true);
    expect(result.checks.childSessionMapPresent).toBe(true);
    expect(result.checks.childParentMatchesRoot).toBe(true);
    expect(result.checks.grantBound).toBe(true);
    expect(result.checks.planArtifactNotRun).toBe(true);
  });

  test("runtime: missing child event fails", () => {
    const manifest = makeMinimalManifest();
    seedRuntimeData(manifest);
    writeFileSync(manifest.paths.eventFilePath,
      JSON.stringify({ type: "session.created", sessionID: manifest.rootSessionId }) + "\n",
    );
    const result = verifyP01b(tempRoot, "runtime");
    expect(result.ok).toBe(false);
    expect(result.failedChecks).toContain("childEventPresent");
  });

  test("cleanup: missing artifact fails", () => {
    const manifest = makeMinimalManifest({ status: "CLEANED" });
    seedCleanupData(manifest);
    rmSync(join(manifest.paths.artifactsDir, "plan-result.json"), { force: true });
    const result = verifyP01b(tempRoot, "cleanup");
    expect(result.ok).toBe(false);
    expect(result.failedChecks).toContain("planArtifactReadable");
  });

  test("verifier does not modify manifest", () => {
    const manifest = makeMinimalManifest();
    seedCleanupData(manifest);
    const before = readFileSync(manifest.paths.manifestPath, "utf8");
    verifyP01b(tempRoot, "cleanup");
    const after = readFileSync(manifest.paths.manifestPath, "utf8");
    expect(after).toBe(before);
  });

  test("throws for invalid phase", () => {
    expect(() => verifyP01b(tempRoot, "invalid" as any)).toThrow("invalid phase");
  });
});