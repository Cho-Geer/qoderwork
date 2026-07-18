import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { verifyP02 } from "../verify-p02";
import { createRunPaths, writeRunManifest } from "../run-context";
import type { RunManifest, RunPaths } from "../types";

let rootA = "", rootB = "";
beforeEach(() => {
  rootA = mkdtempSync(join(tmpdir(), "p02-a-"));
  rootB = mkdtempSync(join(tmpdir(), "p02-b-"));
});
afterEach(() => {
  rmSync(rootA, { recursive: true, force: true });
  rmSync(rootB, { recursive: true, force: true });
});

function makeRun(rootDir: string, runId: string, port: number): RunManifest {
  const paths = createRunPaths(runId);
  Object.assign(paths, {
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
  });
  const m: RunManifest = {
    runId, testId: "P0-2", status: "READY",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    primaryWorktree: "/nonexistent", commit: "HEAD", port,
    paths, env: {}, sourceOverlay: null, sourceStatusPorcelainZ: null,
    rootSessionId: "root-1", childSessionId: "child-1", grantId: "grant-1",
    dispatchKey: "d", allowedPaths: [], bootstrapComplete: true,
    authorization: { h2Authorized: false, dryRun: true },
    process: { servePid: 1, ssePid: 2, portReserverPid: null },
    cleanup: { status: "pending", notes: [] },
  };
  Object.values({ d: paths.dbDir, e: paths.eventsDir, p: paths.pidsDir, a: paths.artifactsDir, l: paths.logsDir, f: paths.frameworkLogDir })
    .forEach((d) => mkdirSync(d as string, { recursive: true }));
  writeRunManifest(m);
  return m;
}

// 写入 run A 的正向数据（SDK/framework/events）+ stage results（含 start checks）+ sentinel marker
function seedRunA(rootDir: string, manifest: RunManifest, alivePid: number): void {
  writeFileSync(manifest.paths.sseReadyPath, JSON.stringify({ runId: manifest.runId, serveUrl: `http://127.0.0.1:${manifest.port}`, eventFile: manifest.paths.eventFilePath, connectedAt: new Date().toISOString() }));
  writeFileSync(manifest.paths.eventFilePath,
    JSON.stringify({ type: "session.created", sessionID: manifest.rootSessionId }) + "\n" +
    JSON.stringify({ type: "session.created", sessionID: manifest.childSessionId }) + "\n");
  const fw = new Database(manifest.paths.frameworkDbPath);
  fw.run("CREATE TABLE session_map (session_id TEXT PRIMARY KEY)");
  fw.run("CREATE TABLE dispatch_privilege_grants (id TEXT PRIMARY KEY, status TEXT, child_session_id TEXT)");
  fw.run("INSERT INTO session_map (session_id) VALUES (?)", [manifest.rootSessionId!]);
  fw.run("INSERT INTO session_map (session_id) VALUES (?)", [manifest.childSessionId!]);
  fw.run("INSERT INTO dispatch_privilege_grants (id, status, child_session_id) VALUES (?, ?, ?)", [manifest.grantId!, "bound", manifest.childSessionId!]);
  fw.close();
  const sdk = new Database(manifest.paths.opencodeDbPath);
  sdk.run("CREATE TABLE session (id TEXT PRIMARY KEY, parent_id TEXT)");
  sdk.run("INSERT INTO session (id, parent_id) VALUES (?, ?)", [manifest.rootSessionId!, null]);
  sdk.run("INSERT INTO session (id, parent_id) VALUES (?, ?)", [manifest.childSessionId!, manifest.rootSessionId!]);
  sdk.close();
  writeFileSync(join(manifest.paths.artifactsDir, "p0-2-stage-results.json"),
    JSON.stringify({ runId: manifest.runId, stages: [
      { stage: "start-a", checks: { health: true, serveIdentity: true, sseIdentity: true, sseReady: true } },
      { stage: "start-b", checks: { health: true, serveIdentity: true, sseIdentity: true, sseReady: true } },
    ] }));
  // sentinel marker 放 run A artifacts（测试用）
  writeFileSync(join(manifest.paths.artifactsDir, "sentinel-marker.json"),
    JSON.stringify({ sentinelId: "sentinel", pid: alivePid, readyAt: new Date().toISOString() }));
}

// B/main 负向 store：表存在但无任何 A 标识（root/child/grant），用于证明「NOT_FOUND」而非「缺失」。
function seedNegativeStore(b: RunManifest, mainPath: string): void {
  const bsdk = new Database(b.paths.opencodeDbPath);
  bsdk.run("CREATE TABLE session (id TEXT PRIMARY KEY, parent_id TEXT)");
  bsdk.close();
  const bfw = new Database(b.paths.frameworkDbPath);
  bfw.run("CREATE TABLE session_map (session_id TEXT PRIMARY KEY)");
  bfw.run("CREATE TABLE dispatch_privilege_grants (id TEXT PRIMARY KEY, status TEXT, child_session_id TEXT)");
  bfw.close();
  writeFileSync(b.paths.eventFilePath, JSON.stringify({ type: "session.created", sessionID: "other-session" }) + "\n");
  const mfw = new Database(mainPath);
  mfw.run("CREATE TABLE session_map (session_id TEXT PRIMARY KEY)");
  mfw.run("CREATE TABLE dispatch_privilege_grants (id TEXT PRIMARY KEY, status TEXT, child_session_id TEXT)");
  mfw.close();
}

// P0-2 Phase 1 隔离 fixture：rootA 嵌套在 rootB 内，使 containment 对两侧均成立；
// A 持正向数据，B/main 持可读但无 A 标识的负向 store；端口归属注入以摆脱宿主伪 PID。
function setupP02V() {
  const rootB = mkdtempSync(join(tmpdir(), "p02-b-"));
  const rootA = mkdtempSync(join(rootB, "a-"));
  const a = makeRun(rootA, "run-a", 41010);
  const b = makeRun(rootB, "run-b", 41011);
  const mainPath = join(rootB, "main-framework.db");
  seedRunA(rootB, a, 1);
  seedNegativeStore(b, mainPath);
  const input = {
    runDirA: a.paths.rootDir, runDirB: b.paths.rootDir,
    mainFrameworkDbPath: mainPath,
    sentinelMarkerPath: join(rootA, "artifacts", "sentinel-marker.json"),
    reservationPidA: process.pid, reservationPidB: process.ppid,
    readers: { portOwnerReader: (p: number) => (p === a.port ? process.pid : process.ppid) },
  };
  return { rootA, rootB, a, b, mainPath, input };
}

const baseInput = (a: RunManifest, b: RunManifest, sentinelPath: string, pa: number, pb: number, readers?: { portOwnerReader?: (port: number) => number | null }) => ({
  runDirA: a.paths.rootDir, runDirB: b.paths.rootDir,
  mainFrameworkDbPath: join(rootB, "main-framework.db"),
  sentinelMarkerPath: sentinelPath, reservationPidA: pa, reservationPidB: pb,
  readers,
});

const sentinelPathFor = (a: RunManifest) => join(a.paths.artifactsDir, "sentinel-marker.json");

function writeSentinel(a: RunManifest, alive: boolean): void {
  writeFileSync(sentinelPathFor(a), JSON.stringify({
    sentinelId: "sentinel",
    pid: alive ? process.pid : 999999,
    readyAt: new Date().toISOString(),
  }));
}

function seedStageChecks(a: RunManifest, stage: "start-a" | "start-b", allTrue: boolean): void {
  const checks = allTrue
    ? { health: true, serveIdentity: true, sseIdentity: true, sseReady: true }
    : { health: false, serveIdentity: true, sseIdentity: true, sseReady: true };
  writeFileSync(join(a.paths.artifactsDir, "p0-2-stage-results.json"),
    JSON.stringify({ runId: a.runId, stages: [{ stage, checks }] }));
}

function writeCleanupReport(m: RunManifest, success: boolean): void {
  writeFileSync(m.paths.cleanupReportPath, JSON.stringify({ success, worktreeRemoved: true, runId: m.runId }));
}

// 各阶段 all-pass 基线（就地改 manifest 后必须回写磁盘，verifyP02 从磁盘读取）
function setupCoexistence(a: RunManifest, b: RunManifest): void {
  a.status = "READY"; b.status = "READY";
  a.process.servePid = 1; a.process.ssePid = 2;
  b.process.servePid = 3; b.process.ssePid = 4; // A/B PID 必须两两不同
  seedStageChecks(a, "start-a", true);
  seedStageChecks(b, "start-b", true);
  writeSentinel(a, true);
  writeRunManifest(a); writeRunManifest(b);
}

function setupAfterStopA(a: RunManifest, b: RunManifest): void {
  a.status = "STOPPED"; a.process.servePid = null; a.process.ssePid = null;
  b.status = "READY";
  seedStageChecks(b, "start-b", true);
  writeFileSync(b.paths.sseReadyPath, JSON.stringify({
    runId: b.runId, serveUrl: `http://127.0.0.1:${b.port}`, eventFile: b.paths.eventFilePath, connectedAt: new Date().toISOString(),
  }));
  writeSentinel(a, true);
  writeRunManifest(a); writeRunManifest(b);
}

function setupCleanup(a: RunManifest, b: RunManifest): void {
  a.status = "CLEANED"; b.status = "CLEANED";
  writeCleanupReport(a, true);
  writeCleanupReport(b, true);
  writeRunManifest(a); writeRunManifest(b);
  // 不写 sentinel marker → sentinelExited 通过
}

describe("verifyP02", () => {
  // ---- P0-2 Phase 1: fail-closed 隔离 verifier（reservations + attribution）----
  test("P02-V-ALL-PASS: reservations + attribution all pass", () => {
    const { a, b, input } = setupP02V();
    const resR = verifyP02(input, "reservations");
    const resA = verifyP02(input, "attribution");
    expect(resR.ok).toBe(true);
    expect(resR.failedChecks).toEqual([]);
    expect(resA.ok).toBe(true);
    expect(resA.failedChecks).toEqual([]);
  });

  test("P02-V-DB-MISSING: remove B SDK DB -> bSdkEvidenceAvailable", () => {
    const { b, input } = setupP02V();
    rmSync(b.paths.opencodeDbPath);
    const resA = verifyP02(input, "attribution");
    expect(resA.ok).toBe(false);
    expect(resA.failedChecks).toEqual(["bSdkEvidenceAvailable"]);
  });

  test("P02-V-NEG-FOUND: insert A root into B SDK DB -> bSdkNegative", () => {
    const { a, b, input } = setupP02V();
    const bsdk = new Database(b.paths.opencodeDbPath);
    bsdk.run("INSERT INTO session (id, parent_id) VALUES (?, ?)", [a.rootSessionId!, null]);
    bsdk.close();
    const resA = verifyP02(input, "attribution");
    expect(resA.failedChecks).toEqual(["bSdkNegative"]);
  });

  test("P02-V-A-SDK-MISSING: remove A SDK DB -> aSdkEvidenceAvailable", () => {
    const { a, input } = setupP02V();
    rmSync(a.paths.opencodeDbPath);
    const resA = verifyP02(input, "attribution");
    expect(resA.failedChecks).toEqual(["aSdkEvidenceAvailable"]);
  });

  test("P02-V-B-FW-FOUND: insert A root into B framework -> bFrameworkNegative", () => {
    const { a, b, input } = setupP02V();
    const bfw = new Database(b.paths.frameworkDbPath);
    bfw.run("INSERT INTO session_map (session_id) VALUES (?)", [a.rootSessionId!]);
    bfw.close();
    const resA = verifyP02(input, "attribution");
    expect(resA.failedChecks).toEqual(["bFrameworkNegative"]);
  });

  test("P02-V-MAIN-FOUND: insert A root into main framework -> mainFrameworkNegative", () => {
    const { a, mainPath, input } = setupP02V();
    const mfw = new Database(mainPath);
    mfw.run("INSERT INTO session_map (session_id) VALUES (?)", [a.rootSessionId!]);
    mfw.close();
    const resA = verifyP02(input, "attribution");
    expect(resA.failedChecks).toEqual(["mainFrameworkNegative"]);
  });

  test("P02-V-GRANT-WRONG: A grant bound to wrong child -> aGrantBound", () => {
    const { a, input } = setupP02V();
    const afw = new Database(a.paths.frameworkDbPath);
    afw.run("UPDATE dispatch_privilege_grants SET child_session_id = ?, status = ? WHERE id = ?",
      ["child-other", "bound", a.grantId!]);
    afw.close();
    const resA = verifyP02(input, "attribution");
    expect(resA.failedChecks).toEqual(["aGrantBound"]);
  });

  test("P02-V-PATH: B event path equals A path -> pathDistinct.eventFilePath", () => {
    const { a, b, input } = setupP02V();
    b.paths.eventFilePath = a.paths.eventFilePath;
    writeRunManifest(b);
    const resR = verifyP02(input, "reservations");
    expect(resR.failedChecks).toEqual(["pathDistinct.eventFilePath"]);
  });

  test("P02-V-CONTAINED-A-ESCAPE: A event path escapes A root -> pathContainedA.eventFilePath", () => {
    const { a, input } = setupP02V();
    a.paths.eventFilePath = join(tmpdir(), "escape-events.jsonl");
    writeRunManifest(a);
    const resR = verifyP02(input, "reservations");
    expect(resR.failedChecks).toEqual(["pathContainedA.eventFilePath"]);
  });

  test("P02-V-PORT: port owner PID differs -> reservationPortAOwned", () => {
    const { input } = setupP02V();
    const input2 = { ...input, readers: { portOwnerReader: () => 999777 } };
    const resR = verifyP02(input2, "reservations");
    expect(resR.failedChecks).toEqual(["reservationPortAOwned"]);
  });

  // ---- coexistence: 每个 check 单独失败 ----
  test("coexistence: all pass", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "coexistence");
    expect(res.ok).toBe(true);
    expect(res.failedChecks).toEqual([]);
  });
  test("coexistence: a not READY fails aReady", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    a.status = "STOPPED"; writeRunManifest(a);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "coexistence");
    expect(res.failedChecks).toEqual(["aReady"]);
  });
  test("coexistence: b not READY fails bReady", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    b.status = "STOPPED"; writeRunManifest(b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "coexistence");
    expect(res.failedChecks).toEqual(["bReady"]);
  });
  test("coexistence: start-a checks false fails aStartChecks", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    seedStageChecks(a, "start-a", false);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "coexistence");
    expect(res.failedChecks).toEqual(["aStartChecks"]);
  });
  test("coexistence: start-b checks false fails bStartChecks", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    seedStageChecks(b, "start-b", false);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "coexistence");
    expect(res.failedChecks).toEqual(["bStartChecks"]);
  });
  test("coexistence: reserver A alive fails reserverAExited", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), process.pid, 999999), "coexistence");
    expect(res.failedChecks).toEqual(["reserverAExited"]);
  });
  test("coexistence: reserver B alive fails reserverBExited", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, process.pid), "coexistence");
    expect(res.failedChecks).toEqual(["reserverBExited"]);
  });
  test("coexistence: manifest reserver not null fails manifestReserverNull", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    a.process.portReserverPid = 123; writeRunManifest(a);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "coexistence");
    expect(res.failedChecks).toEqual(["manifestReserverNull"]);
  });
  test("coexistence: serve/sse pid collision fails serveSsePidDistinct", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    b.process.servePid = a.process.servePid; writeRunManifest(b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "coexistence");
    expect(res.failedChecks).toEqual(["serveSsePidDistinct"]);
  });
  test("coexistence: sentinel dead fails sentinelAlive", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    writeSentinel(a, false);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "coexistence");
    expect(res.failedChecks).toEqual(["sentinelAlive"]);
  });

  // ---- after-stop-a: 每个 check 单独失败 ----
  test("after-stop-a: all pass", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "after-stop-a");
    expect(res.ok).toBe(true);
    expect(res.failedChecks).toEqual([]);
  });
  test("after-stop-a: a not STOPPED fails aStopped", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    a.status = "READY"; writeRunManifest(a);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "after-stop-a");
    expect(res.failedChecks).toEqual(["aStopped"]);
  });
  test("after-stop-a: a serve pid not null fails aServePidNull", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    a.process.servePid = 5; writeRunManifest(a);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "after-stop-a");
    expect(res.failedChecks).toEqual(["aServePidNull"]);
  });
  test("after-stop-a: a sse pid not null fails aSsePidNull", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    a.process.ssePid = 6; writeRunManifest(a);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "after-stop-a");
    expect(res.failedChecks).toEqual(["aSsePidNull"]);
  });
  test("after-stop-a: b not READY fails bReady", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    b.status = "STOPPED"; writeRunManifest(b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "after-stop-a");
    expect(res.failedChecks).toEqual(["bReady"]);
  });
  test("after-stop-a: start-b checks false fails bStartChecks", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    seedStageChecks(b, "start-b", false);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "after-stop-a");
    expect(res.failedChecks).toEqual(["bStartChecks"]);
  });
  test("after-stop-a: b sse ready missing fails bSseReadyValid", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    rmSync(b.paths.sseReadyPath);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "after-stop-a");
    expect(res.failedChecks).toEqual(["bSseReadyValid"]);
  });
  test("after-stop-a: sentinel dead fails sentinelAlive", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    writeSentinel(a, false);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "after-stop-a");
    expect(res.failedChecks).toEqual(["sentinelAlive"]);
  });

  // ---- cleanup: 每个 check 单独失败 ----
  test("cleanup: all pass", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "cleanup");
    expect(res.ok).toBe(true);
    expect(res.failedChecks).toEqual([]);
  });
  test("cleanup: a not CLEANED fails aCleaned", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    a.status = "READY"; writeRunManifest(a);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "cleanup");
    expect(res.failedChecks).toEqual(["aCleaned"]);
  });
  test("cleanup: b not CLEANED fails bCleaned", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    b.status = "READY"; writeRunManifest(b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "cleanup");
    expect(res.failedChecks).toEqual(["bCleaned"]);
  });
  test("cleanup: a worktree exists fails aWorktreeRemoved", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    mkdirSync(a.paths.worktreeDir, { recursive: true });
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "cleanup");
    expect(res.failedChecks).toEqual(["aWorktreeRemoved"]);
  });
  test("cleanup: b worktree exists fails bWorktreeRemoved", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    mkdirSync(b.paths.worktreeDir, { recursive: true });
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "cleanup");
    expect(res.failedChecks).toEqual(["bWorktreeRemoved"]);
  });
  test("cleanup: a manifest missing fails aManifestReadable", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    rmSync(a.paths.manifestPath);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "cleanup");
    expect(res.failedChecks).toEqual(["aManifestReadable"]);
  });
  test("cleanup: b manifest missing fails bManifestReadable", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    rmSync(b.paths.manifestPath);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "cleanup");
    expect(res.failedChecks).toEqual(["bManifestReadable"]);
  });
  test("cleanup: a cleanup report not success fails aCleanupReportSuccess", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    writeCleanupReport(a, false);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "cleanup");
    expect(res.failedChecks).toEqual(["aCleanupReportSuccess"]);
  });
  test("cleanup: b cleanup report not success fails bCleanupReportSuccess", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    writeCleanupReport(b, false);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "cleanup");
    expect(res.failedChecks).toEqual(["bCleanupReportSuccess"]);
  });
  test("cleanup: sentinel still alive fails sentinelExited", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    writeSentinel(a, true);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999), "cleanup");
    expect(res.failedChecks).toEqual(["sentinelExited"]);
  });
});
