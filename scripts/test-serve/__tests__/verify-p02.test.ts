import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { verifyP02, RUN_PATH_FIELDS } from "../verify-p02";
import { createRunPaths, writeRunManifest } from "../run-context";
import type { RunManifest, RunPaths, P02ProcessState, P02MarkerState, P02VerifyInput } from "../types";

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
    rootDir,
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

// 生命周期通用输入：reservation PID 用不存在的伪 PID(已退出)，可注入 process/marker reader 与 after-stop 旧 PID 证据。
const baseInput = (
  a: RunManifest, b: RunManifest, sentinelPath: string,
  pa = 999999, pb = 999999,
  readers?: { processReader?: (m: RunManifest) => P02ProcessState; markerReader?: (m: RunManifest) => P02MarkerState },
  extra?: Partial<P02VerifyInput>,
): P02VerifyInput => ({
  runDirA: a.paths.rootDir, runDirB: b.paths.rootDir,
  mainFrameworkDbPath: join(rootB, "main-framework.db"),
  sentinelMarkerPath: sentinelPath,
  reservationPidA: pa, reservationPidB: pb,
  readers, ...extra,
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
  writeFileSync(a.paths.sseReadyPath, JSON.stringify({
    runId: a.runId, serveUrl: `http://127.0.0.1:${a.port}`, eventFile: a.paths.eventFilePath, connectedAt: new Date().toISOString(),
  }));
  writeFileSync(b.paths.sseReadyPath, JSON.stringify({
    runId: b.runId, serveUrl: `http://127.0.0.1:${b.port}`, eventFile: b.paths.eventFilePath, connectedAt: new Date().toISOString(),
  }));
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
  // artifact readability：每个 run 创建 framework DB / SDK DB / serve log / sse log / framework log dir / events。
  for (const m of [a, b]) {
    const fw = new Database(m.paths.frameworkDbPath);
    fw.run("CREATE TABLE session_map (session_id TEXT PRIMARY KEY)"); fw.close();
    const sdk = new Database(m.paths.opencodeDbPath);
    sdk.run("CREATE TABLE session (id TEXT PRIMARY KEY)"); sdk.close();
    writeFileSync(m.paths.serveLogPath, "serve log");
    writeFileSync(m.paths.sseLogPath, "sse log");
    mkdirSync(m.paths.frameworkLogDir, { recursive: true });
    writeFileSync(m.paths.eventFilePath, JSON.stringify({ type: "session.created", sessionID: "x" }) + "\n");
  }
  // sentinel marker 可读且 PID 已退出（sentinelExited PASS）。coordinator 残留 marker 必须可读。
  writeFileSync(sentinelPathFor(a), JSON.stringify({
    sentinelId: "sentinel", pid: 999999, runId: a.runId,
    serveUrl: `http://127.0.0.1:${a.port}`, eventFile: a.paths.eventFilePath, readyAt: new Date().toISOString(),
  }));
}

describe("verifyP02", () => {
  // ================= P0-2 Phase 1: fail-closed 隔离 verifier 单失败矩阵 (88 case) =================
  // 所有 case 从同一个 all-pass fixture (setupP02V) 起步，只施加一个 mutation，断言 exact failedChecks。
  type Ctx = ReturnType<typeof setupP02V>;
  const freshCtx = (): Ctx => setupP02V();

  // attribution 固定顺序（REQ-003）：每一步失败立即 return，failedChecks 仅该 check，后续 key 不出现。
  const ATTRIBUTION_ORDER = [
    "aRootNonEmpty", "aChildNonEmpty", "aGrantNonEmpty",
    "aSdkEvidenceAvailable", "aSdkPositive",
    "aFrameworkEvidenceAvailable", "aFrameworkPositive",
    "aEventsEvidenceAvailable", "aEventsPositive",
    "bSdkEvidenceAvailable", "bSdkNegative",
    "bFrameworkEvidenceAvailable", "bFrameworkNegative",
    "bEventsEvidenceAvailable", "bEventsNegative",
    "mainFrameworkEvidenceAvailable", "mainFrameworkNegative",
    "aGrantBound",
  ] as const;

  const RESERVATION_CHECKS = [
    "runIdDistinct", "portDistinct",
    ...RUN_PATH_FIELDS.map((f) => `pathDistinct.${f}`),
    ...RUN_PATH_FIELDS.map((f) => `pathContainedA.${f}`),
    ...RUN_PATH_FIELDS.map((f) => `pathContainedB.${f}`),
    "reservationPidDistinct", "reservationPidAAlive", "reservationPidBAlive", "reservationPortAOwned",
  ] as const;

  // 6 个 reservation identity/PID case
  const RESERVATION_CASES: Array<{ id: string; expect: string; mutate: (c: Ctx) => void }> = [
    { id: "P02-V-R-RUN-ID", expect: "runIdDistinct", mutate: (c) => { c.b.runId = c.a.runId; writeRunManifest(c.b); } },
    { id: "P02-V-R-PORT", expect: "portDistinct", mutate: (c) => { c.b.port = c.a.port; writeRunManifest(c.b); } },
    { id: "P02-V-R-PID-DISTINCT", expect: "reservationPidDistinct", mutate: (c) => { c.input.reservationPidB = c.input.reservationPidA; } },
    { id: "P02-V-R-PID-A-DEAD", expect: "reservationPidAAlive", mutate: (c) => { c.input.reservationPidA = 999999; c.input.readers = { portOwnerReader: (p) => (p === c.a.port ? 999999 : NaN) }; } },
    { id: "P02-V-R-PID-B-DEAD", expect: "reservationPidBAlive", mutate: (c) => { c.input.reservationPidB = 999999; } },
    { id: "P02-V-R-PORT-OWNER", expect: "reservationPortAOwned", mutate: (c) => { c.input.readers = { portOwnerReader: () => 999777 }; } },
  ];

  // 57 个 field case：每字段 F 生成 pathDistinct.F / pathContainedA.F / pathContainedB.F
  // 字段 mutation 直接把 manifest 写回 canonical 路径（rootDir/manifest.json），
  // 避免 writeRunManifest 用被改写的 paths.manifestPath 写错/覆盖位置（尤其 manifestPath 字段本身）。
  const writeManifestCanonical = (m: RunManifest): void => {
    writeFileSync(join(m.rootDir ?? "", "manifest.json"), JSON.stringify(m, null, 2));
  };

  const FIELD_CASES: Array<{ id: string; expect: string; mutate: (c: Ctx) => void }> = [];
  for (const f of RUN_PATH_FIELDS) {
    FIELD_CASES.push({ id: `P02-V-R-D-${f}`, expect: `pathDistinct.${f}`, mutate: (c) => { c.b.paths[f] = c.a.paths[f]; writeManifestCanonical(c.b); } });
    FIELD_CASES.push({ id: `P02-V-R-A-${f}`, expect: `pathContainedA.${f}`, mutate: (c) => { const esc = mkdtempSync(join(tmpdir(), "esc-")); c.a.paths[f] = esc; writeManifestCanonical(c.a); } });
    FIELD_CASES.push({ id: `P02-V-R-B-${f}`, expect: `pathContainedB.${f}`, mutate: (c) => { const esc = mkdtempSync(join(tmpdir(), "esc-")); c.b.paths[f] = esc; writeManifestCanonical(c.b); } });
  }

  // 25 个 attribution chain case
  const ATTRIBUTION_CASES: Array<{ id: string; expect: string; mutate: (c: Ctx) => void }> = [
    { id: "P02-V-A-ROOT", expect: "aRootNonEmpty", mutate: (c) => { c.a.rootSessionId = null; writeRunManifest(c.a); } },
    { id: "P02-V-A-CHILD", expect: "aChildNonEmpty", mutate: (c) => { c.a.childSessionId = null; writeRunManifest(c.a); } },
    { id: "P02-V-A-GRANT", expect: "aGrantNonEmpty", mutate: (c) => { c.a.grantId = null; writeRunManifest(c.a); } },
    { id: "P02-V-A-SDK-MISSING", expect: "aSdkEvidenceAvailable", mutate: (c) => { rmSync(c.a.paths.opencodeDbPath); } },
    { id: "P02-V-A-SDK-TABLE", expect: "aSdkEvidenceAvailable", mutate: (c) => { const d = new Database(c.a.paths.opencodeDbPath); d.run("DROP TABLE session"); d.close(); } },
    { id: "P02-V-A-SDK-POSITIVE", expect: "aSdkPositive", mutate: (c) => { const d = new Database(c.a.paths.opencodeDbPath); d.run("DELETE FROM session WHERE id = ?", [c.a.childSessionId!]); d.close(); } },
    { id: "P02-V-A-FW-MISSING", expect: "aFrameworkEvidenceAvailable", mutate: (c) => { rmSync(c.a.paths.frameworkDbPath); } },
    { id: "P02-V-A-FW-TABLE", expect: "aFrameworkEvidenceAvailable", mutate: (c) => { const d = new Database(c.a.paths.frameworkDbPath); d.run("DROP TABLE session_map"); d.close(); } },
    { id: "P02-V-A-FW-POSITIVE", expect: "aFrameworkPositive", mutate: (c) => { const d = new Database(c.a.paths.frameworkDbPath); d.run("DELETE FROM session_map WHERE session_id = ?", [c.a.childSessionId!]); d.close(); } },
    { id: "P02-V-A-EVENT-MISSING", expect: "aEventsEvidenceAvailable", mutate: (c) => { rmSync(c.a.paths.eventFilePath); } },
    { id: "P02-V-A-EVENT-MALFORMED", expect: "aEventsEvidenceAvailable", mutate: (c) => { writeFileSync(c.a.paths.eventFilePath, JSON.stringify({ type: "session.created", sessionID: c.a.rootSessionId }) + "\n" + "{not-json\n"); } },
    { id: "P02-V-A-EVENT-POSITIVE", expect: "aEventsPositive", mutate: (c) => { writeFileSync(c.a.paths.eventFilePath, JSON.stringify({ type: "session.created", sessionID: c.a.rootSessionId }) + "\n"); } },
    { id: "P02-V-B-SDK-MISSING", expect: "bSdkEvidenceAvailable", mutate: (c) => { rmSync(c.b.paths.opencodeDbPath); } },
    { id: "P02-V-B-SDK-TABLE", expect: "bSdkEvidenceAvailable", mutate: (c) => { const d = new Database(c.b.paths.opencodeDbPath); d.run("DROP TABLE session"); d.close(); } },
    { id: "P02-V-B-SDK-FOUND", expect: "bSdkNegative", mutate: (c) => { const d = new Database(c.b.paths.opencodeDbPath); d.run("INSERT INTO session (id, parent_id) VALUES (?, ?)", [c.a.rootSessionId!, null]); d.close(); } },
    { id: "P02-V-B-FW-MISSING", expect: "bFrameworkEvidenceAvailable", mutate: (c) => { rmSync(c.b.paths.frameworkDbPath); } },
    { id: "P02-V-B-FW-TABLE", expect: "bFrameworkEvidenceAvailable", mutate: (c) => { const d = new Database(c.b.paths.frameworkDbPath); d.run("DROP TABLE session_map"); d.close(); } },
    { id: "P02-V-B-FW-FOUND", expect: "bFrameworkNegative", mutate: (c) => { const d = new Database(c.b.paths.frameworkDbPath); d.run("INSERT INTO session_map (session_id) VALUES (?)", [c.a.rootSessionId!]); d.close(); } },
    { id: "P02-V-B-EVENT-MISSING", expect: "bEventsEvidenceAvailable", mutate: (c) => { rmSync(c.b.paths.eventFilePath); } },
    { id: "P02-V-B-EVENT-MALFORMED", expect: "bEventsEvidenceAvailable", mutate: (c) => { writeFileSync(c.b.paths.eventFilePath, JSON.stringify({ type: "session.created", sessionID: "other-session" }) + "\n" + "{not-json\n"); } },
    { id: "P02-V-B-EVENT-FOUND", expect: "bEventsNegative", mutate: (c) => { writeFileSync(c.b.paths.eventFilePath, readFileSync(c.b.paths.eventFilePath, "utf8") + JSON.stringify({ type: "session.created", sessionID: c.a.rootSessionId }) + "\n"); } },
    { id: "P02-V-MAIN-MISSING", expect: "mainFrameworkEvidenceAvailable", mutate: (c) => { rmSync(c.mainPath); } },
    { id: "P02-V-MAIN-TABLE", expect: "mainFrameworkEvidenceAvailable", mutate: (c) => { const d = new Database(c.mainPath); d.run("DROP TABLE session_map"); d.close(); } },
    { id: "P02-V-MAIN-FOUND", expect: "mainFrameworkNegative", mutate: (c) => { const d = new Database(c.mainPath); d.run("INSERT INTO session_map (session_id) VALUES (?)", [c.a.rootSessionId!]); d.close(); } },
    { id: "P02-V-GRANT-WRONG", expect: "aGrantBound", mutate: (c) => { const d = new Database(c.a.paths.frameworkDbPath); d.run("UPDATE dispatch_privilege_grants SET child_session_id = ?, status = ? WHERE id = ?", ["child-other", "bound", c.a.grantId!]); d.close(); } },
  ];

  test("P02-V-COUNT: 19 fields, 57 field cases, 88 total, unique IDs", () => {
    expect(RUN_PATH_FIELDS.length).toBe(19);
    expect(FIELD_CASES.length).toBe(57);
    const allIds = [...RESERVATION_CASES, ...FIELD_CASES, ...ATTRIBUTION_CASES].map((c) => c.id);
    expect(allIds.length).toBe(88);
    expect(new Set(allIds).size).toBe(88);
  });

  test("P02-V-ALL-PASS: reservations + attribution all checks true", () => {
    const { a, b, input } = setupP02V();
    const resR = verifyP02(input, "reservations");
    const resA = verifyP02(input, "attribution");
    expect(resR.ok).toBe(true);
    expect(resR.failedChecks).toEqual([]);
    expect(resA.ok).toBe(true);
    expect(resA.failedChecks).toEqual([]);
    for (const name of RESERVATION_CHECKS) expect(resR.checks[name]).toBe(true);
    for (const name of ATTRIBUTION_ORDER) expect(resA.checks[name]).toBe(true);
  });

  for (const tc of RESERVATION_CASES) {
    test(`${tc.id} -> ${tc.expect}`, () => {
      const c = freshCtx();
      tc.mutate(c);
      const res = verifyP02(c.input, "reservations");
      expect(res.ok).toBe(false);
      expect(res.failedChecks).toEqual([tc.expect]);
      for (const name of RESERVATION_CHECKS) {
        if (name !== tc.expect) expect(res.checks[name]).toBe(true);
      }
    });
  }

  for (const tc of FIELD_CASES) {
    test(`${tc.id} -> ${tc.expect}`, () => {
      const c = freshCtx();
      tc.mutate(c);
      const res = verifyP02(c.input, "reservations");
      expect(res.ok).toBe(false);
      expect(res.failedChecks).toEqual([tc.expect]);
      for (const name of RESERVATION_CHECKS) {
        if (name !== tc.expect) expect(res.checks[name]).toBe(true);
      }
    });
  }

  for (const tc of ATTRIBUTION_CASES) {
    test(`${tc.id} -> ${tc.expect}`, () => {
      const c = freshCtx();
      tc.mutate(c);
      const res = verifyP02(c.input, "attribution");
      expect(res.ok).toBe(false);
      expect(res.failedChecks).toEqual([tc.expect]);
      const idx = ATTRIBUTION_ORDER.indexOf(tc.expect as (typeof ATTRIBUTION_ORDER)[number]);
      for (let i = 0; i < idx; i++) expect(res.checks[ATTRIBUTION_ORDER[i]]).toBe(true);
      for (let i = idx + 1; i < ATTRIBUTION_ORDER.length; i++) expect(res.checks[ATTRIBUTION_ORDER[i]]).toBeUndefined();
    });
  }

  // ================= P0-2 Phase 2: current observation 生命周期与 cleanup 检查 (fail-closed) =================
  // 所有生命周期检查从同一个 all-pass fixture 起步，仅施加一个 mutation，断言 exact failedChecks。
  // processReader / markerReader 注入以摆脱宿主伪 PID，保证 component 证据可复现、宿主无关。

  const aliveProc = (health = true): P02ProcessState => ({ serveAlive: true, sseAlive: true, healthOk: health });
  const okMarker = (m: RunManifest): P02MarkerState => ({
    readable: true, alive: true, sentinelId: "sentinel",
    runId: m.runId, serveUrl: `http://127.0.0.1:${m.port}`, eventFile: m.paths.eventFilePath, sentinelPid: process.pid,
  });
  const mismatchMarker = (m: RunManifest): P02MarkerState => ({
    readable: true, alive: true, sentinelId: "sentinel",
    runId: "wrong-run-id", serveUrl: `http://127.0.0.1:${m.port}`, eventFile: m.paths.eventFilePath, sentinelPid: process.pid,
  });
  const exitedMarker = (m: RunManifest): P02MarkerState => ({
    readable: true, alive: false, sentinelId: "sentinel",
    runId: m.runId, serveUrl: `http://127.0.0.1:${m.port}`, eventFile: m.paths.eventFilePath, sentinelPid: 999999,
  });
  const procReader = (aState: P02ProcessState, bState: P02ProcessState) => ({
    processReader: (m: RunManifest) => (m.runId === "run-a" ? aState : bState),
  });
  const markReader = (factory: (m: RunManifest) => P02MarkerState) => ({ markerReader: factory });
  const lifecycleReaders = (pa: P02ProcessState, pb: P02ProcessState, mk: (m: RunManifest) => P02MarkerState) => ({
    ...procReader(pa, pb), ...markReader(mk),
  });
  const cleanupReaders = (a: RunManifest) => lifecycleReaders(aliveProc(), aliveProc(), (m) => exitedMarker(a));

  // ---- coexistence: 每个 check 单独失败（含 current observation） ----
  test("coexistence: all pass", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999,
      lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(m))), "coexistence");
    expect(res.ok).toBe(true);
    expect(res.failedChecks).toEqual([]);
  });
  test("coexistence: a not READY fails aReady", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    a.status = "STOPPED"; writeRunManifest(a);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999,
      lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(m))), "coexistence");
    expect(res.failedChecks).toEqual(["aReady"]);
  });
  test("coexistence: b not READY fails bReady", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    b.status = "STOPPED"; writeRunManifest(b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999,
      lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(m))), "coexistence");
    expect(res.failedChecks).toEqual(["bReady"]);
  });
  test("coexistence: start-a checks false fails aStartChecks", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    seedStageChecks(a, "start-a", false);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999,
      lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(m))), "coexistence");
    expect(res.failedChecks).toEqual(["aStartChecks"]);
  });
  test("coexistence: start-b checks false fails bStartChecks", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    seedStageChecks(b, "start-b", false);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999,
      lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(m))), "coexistence");
    expect(res.failedChecks).toEqual(["bStartChecks"]);
  });
  test("coexistence: reserver A alive fails reserverAExited", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), process.pid, 999999,
      lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(m))), "coexistence");
    expect(res.failedChecks).toEqual(["reserverAExited"]);
  });
  test("coexistence: reserver B alive fails reserverBExited", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, process.pid,
      lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(m))), "coexistence");
    expect(res.failedChecks).toEqual(["reserverBExited"]);
  });
  test("coexistence: manifest reserver not null fails manifestReserverNull", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    a.process.portReserverPid = 123; writeRunManifest(a);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999,
      lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(m))), "coexistence");
    expect(res.failedChecks).toEqual(["manifestReserverNull"]);
  });
  test("coexistence: serve/sse pid collision fails serveSsePidDistinct", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    b.process.servePid = a.process.servePid; writeRunManifest(b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999,
      lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(m))), "coexistence");
    expect(res.failedChecks).toEqual(["serveSsePidDistinct"]);
  });
  // current observation：A/B 各自当前 process/health 与 marker identity。
  test("P02-L-B-HEALTH: B health false fails bHealthCurrent", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999,
      lifecycleReaders(aliveProc(true), aliveProc(false), (m) => okMarker(m))), "coexistence");
    expect(res.ok).toBe(false);
    expect(res.failedChecks).toEqual(["bHealthCurrent"]);
    expect(res.checks["bHealthCurrent"]).toBe(false);
  });
  test("coexistence: A serve not alive fails aServeAliveCurrent", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999,
      lifecycleReaders({ serveAlive: false, sseAlive: true, healthOk: true }, aliveProc(), (m) => okMarker(m))), "coexistence");
    expect(res.failedChecks).toEqual(["aServeAliveCurrent"]);
  });
  test("coexistence: A sse not alive fails aSseAliveCurrent", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999,
      lifecycleReaders({ serveAlive: true, sseAlive: false, healthOk: true }, aliveProc(), (m) => okMarker(m))), "coexistence");
    expect(res.failedChecks).toEqual(["aSseAliveCurrent"]);
  });
  test("coexistence: A health false fails aHealthCurrent", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999,
      lifecycleReaders(aliveProc(false), aliveProc(), (m) => okMarker(m))), "coexistence");
    expect(res.failedChecks).toEqual(["aHealthCurrent"]);
  });
  test("coexistence: B serve not alive fails bServeAliveCurrent", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999,
      lifecycleReaders(aliveProc(), { serveAlive: false, sseAlive: true, healthOk: true }, (m) => okMarker(m))), "coexistence");
    expect(res.failedChecks).toEqual(["bServeAliveCurrent"]);
  });
  test("coexistence: B sse not alive fails bSseAliveCurrent", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999,
      lifecycleReaders(aliveProc(), { serveAlive: true, sseAlive: false, healthOk: true }, (m) => okMarker(m))), "coexistence");
    expect(res.failedChecks).toEqual(["bSseAliveCurrent"]);
  });
  test("coexistence: A sse-ready missing fails aSseReadyValid", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    rmSync(a.paths.sseReadyPath);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999,
      lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(m))), "coexistence");
    expect(res.failedChecks).toEqual(["aSseReadyValid"]);
  });
  test("coexistence: B sse-ready missing fails bSseReadyValid", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    rmSync(b.paths.sseReadyPath);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999,
      lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(m))), "coexistence");
    expect(res.failedChecks).toEqual(["bSseReadyValid"]);
  });
  test("P02-L-SENTINEL: sentinel marker id mismatch fails sentinelAliveIdentity", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCoexistence(a, b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999,
      lifecycleReaders(aliveProc(), aliveProc(), (m) => mismatchMarker(m))), "coexistence");
    expect(res.ok).toBe(false);
    expect(res.failedChecks).toEqual(["sentinelAliveIdentity"]);
    expect(res.checks["sentinelAliveIdentity"]).toBe(false);
  });

  // ---- after-stop-a: 每个 check 单独失败（含 old PID 证据 + current observation） ----
  const afterStopInput = (a: RunManifest, b: RunManifest, readers: ReturnType<typeof lifecycleReaders>, extra?: Partial<P02VerifyInput>) =>
    baseInput(a, b, sentinelPathFor(a), 999999, 999999, readers,
      { stoppedServePidA: 999999, stoppedSsePidA: 999999, ...extra });

  test("after-stop-a: all pass", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    const res = verifyP02(afterStopInput(a, b, lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(m))), "after-stop-a");
    expect(res.ok).toBe(true);
    expect(res.failedChecks).toEqual([]);
  });
  test("after-stop-a: a not STOPPED fails aStopped", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    a.status = "READY"; writeRunManifest(a);
    const res = verifyP02(afterStopInput(a, b, lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(m))), "after-stop-a");
    expect(res.failedChecks).toEqual(["aStopped"]);
  });
  test("after-stop-a: a serve pid not null fails aServePidNull", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    a.process.servePid = 5; writeRunManifest(a);
    const res = verifyP02(afterStopInput(a, b, lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(m))), "after-stop-a");
    expect(res.failedChecks).toEqual(["aServePidNull"]);
  });
  test("after-stop-a: a sse pid not null fails aSsePidNull", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    a.process.ssePid = 6; writeRunManifest(a);
    const res = verifyP02(afterStopInput(a, b, lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(m))), "after-stop-a");
    expect(res.failedChecks).toEqual(["aSsePidNull"]);
  });
  test("after-stop-a: b not READY fails bReady", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    b.status = "STOPPED"; writeRunManifest(b);
    const res = verifyP02(afterStopInput(a, b, lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(m))), "after-stop-a");
    expect(res.failedChecks).toEqual(["bReady"]);
  });
  test("after-stop-a: b sse ready missing fails bSseReadyValid", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    rmSync(b.paths.sseReadyPath);
    const res = verifyP02(afterStopInput(a, b, lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(m))), "after-stop-a");
    expect(res.failedChecks).toEqual(["bSseReadyValid"]);
  });
  test("P02-L-OLD-PID: A old serve PID alive fails aOldServeExited", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    const res = verifyP02(afterStopInput(a, b, lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(m)),
      { stoppedServePidA: process.pid, stoppedSsePidA: 999999 }), "after-stop-a");
    expect(res.ok).toBe(false);
    expect(res.failedChecks).toEqual(["aOldServeExited"]);
    expect(res.checks["aOldServeExited"]).toBe(false);
  });
  test("after-stop-a: A old sse PID alive fails aOldSseExited", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    const res = verifyP02(afterStopInput(a, b, lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(m)),
      { stoppedServePidA: 999999, stoppedSsePidA: process.pid }), "after-stop-a");
    expect(res.failedChecks).toEqual(["aOldSseExited"]);
  });
  test("after-stop-a: old PID evidence missing fails aOldPidEvidenceAvailable", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    const res = verifyP02(afterStopInput(a, b, lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(m)),
      { stoppedServePidA: null, stoppedSsePidA: null }), "after-stop-a");
    expect(res.failedChecks).toEqual(["aOldPidEvidenceAvailable"]);
  });
  test("after-stop-a: B serve not alive fails bServeAliveCurrent", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    const res = verifyP02(afterStopInput(a, b, lifecycleReaders(aliveProc(), { serveAlive: false, sseAlive: true, healthOk: true }, (m) => okMarker(m))), "after-stop-a");
    expect(res.failedChecks).toEqual(["bServeAliveCurrent"]);
  });
  test("after-stop-a: B sse not alive fails bSseAliveCurrent", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    const res = verifyP02(afterStopInput(a, b, lifecycleReaders(aliveProc(), { serveAlive: true, sseAlive: false, healthOk: true }, (m) => okMarker(m))), "after-stop-a");
    expect(res.failedChecks).toEqual(["bSseAliveCurrent"]);
  });
  test("after-stop-a: B health false fails bHealthCurrent", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    const res = verifyP02(afterStopInput(a, b, lifecycleReaders(aliveProc(), aliveProc(false), (m) => okMarker(m))), "after-stop-a");
    expect(res.failedChecks).toEqual(["bHealthCurrent"]);
  });
  test("P02-L-SENTINEL-after: sentinel marker id mismatch fails sentinelAliveIdentity", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupAfterStopA(a, b);
    const res = verifyP02(afterStopInput(a, b, lifecycleReaders(aliveProc(), aliveProc(), (m) => mismatchMarker(m))), "after-stop-a");
    expect(res.failedChecks).toEqual(["sentinelAliveIdentity"]);
  });

  // ---- cleanup: 每个 check 单独失败（artifact readability + report 语义 + sentinel exited） ----
  test("cleanup: all pass", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.ok).toBe(true);
    expect(res.failedChecks).toEqual([]);
  });
  test("cleanup: a not CLEANED fails aCleaned", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    a.status = "READY"; writeRunManifest(a);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["aCleaned"]);
  });
  test("cleanup: b not CLEANED fails bCleaned", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    b.status = "READY"; writeRunManifest(b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["bCleaned"]);
  });
  test("cleanup: a worktree exists fails aWorktreeRemoved", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    mkdirSync(a.paths.worktreeDir, { recursive: true });
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["aWorktreeRemoved"]);
  });
  test("cleanup: b worktree exists fails bWorktreeRemoved", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    mkdirSync(b.paths.worktreeDir, { recursive: true });
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["bWorktreeRemoved"]);
  });
  test("cleanup: a manifest missing fails aManifestReadable", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    rmSync(a.paths.manifestPath);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["aManifestReadable"]);
  });
  test("cleanup: b manifest missing fails bManifestReadable", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    rmSync(b.paths.manifestPath);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["bManifestReadable"]);
  });
  test("cleanup: a framework DB missing fails aFrameworkDbReadable", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    rmSync(a.paths.frameworkDbPath);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["aFrameworkDbReadable"]);
  });
  test("cleanup: a SDK DB missing fails aSdkDbReadable", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    rmSync(a.paths.opencodeDbPath);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["aSdkDbReadable"]);
  });
  test("cleanup: a serve log missing fails aServeLogReadable", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    rmSync(a.paths.serveLogPath);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["aServeLogReadable"]);
  });
  test("cleanup: a sse log missing fails aSseLogReadable", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    rmSync(a.paths.sseLogPath);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["aSseLogReadable"]);
  });
  test("cleanup: a framework log dir missing fails aFrameworkLogDirReadable", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    rmSync(a.paths.frameworkLogDir, { recursive: true, force: true });
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["aFrameworkLogDirReadable"]);
  });
  test("cleanup: a events missing fails aEventsReadable", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    rmSync(a.paths.eventFilePath);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["aEventsReadable"]);
  });
  test("cleanup: a cleanup report malformed fails aCleanupReportReadable", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    writeFileSync(a.paths.cleanupReportPath, "{not-json");
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["aCleanupReportReadable"]);
  });
  test("cleanup: a cleanup report not success fails aCleanupReportSuccess", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    writeCleanupReport(a, false);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["aCleanupReportSuccess"]);
  });
  test("cleanup: b framework DB missing fails bFrameworkDbReadable", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    rmSync(b.paths.frameworkDbPath);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["bFrameworkDbReadable"]);
  });
  test("cleanup: b SDK DB missing fails bSdkDbReadable", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    rmSync(b.paths.opencodeDbPath);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["bSdkDbReadable"]);
  });
  test("cleanup: b serve log missing fails bServeLogReadable", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    rmSync(b.paths.serveLogPath);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["bServeLogReadable"]);
  });
  test("cleanup: b sse log missing fails bSseLogReadable", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    rmSync(b.paths.sseLogPath);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["bSseLogReadable"]);
  });
  test("cleanup: b framework log dir missing fails bFrameworkLogDirReadable", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    rmSync(b.paths.frameworkLogDir, { recursive: true, force: true });
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["bFrameworkLogDirReadable"]);
  });
  test("cleanup: b events missing fails bEventsReadable", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    rmSync(b.paths.eventFilePath);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["bEventsReadable"]);
  });
  test("P02-L-REPORT: B report malformed fails bCleanupReportReadable", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    writeFileSync(b.paths.cleanupReportPath, "{not-json");
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.ok).toBe(false);
    expect(res.failedChecks).toEqual(["bCleanupReportReadable"]);
    expect(res.checks["bCleanupReportReadable"]).toBe(false);
  });
  test("cleanup: b cleanup report not success fails bCleanupReportSuccess", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    writeCleanupReport(b, false);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999, cleanupReaders(a)), "cleanup");
    expect(res.failedChecks).toEqual(["bCleanupReportSuccess"]);
  });
  test("cleanup: sentinel still alive fails sentinelExited", () => {
    const a = makeRun(rootA, "run-a", 41010);
    const b = makeRun(rootB, "run-b", 41011);
    setupCleanup(a, b);
    const res = verifyP02(baseInput(a, b, sentinelPathFor(a), 999999, 999999,
      lifecycleReaders(aliveProc(), aliveProc(), (m) => okMarker(a))), "cleanup");
    expect(res.failedChecks).toEqual(["sentinelExited"]);
  });
});
