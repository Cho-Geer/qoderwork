import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runP02, P02_STAGES } from "../p02-orchestrator";
import { startSentinel, stopSentinel, validateSentinelIdentity } from "../p02-sentinel";
import type {
  P02Dependencies,
  P02Input,
  P02VerificationResult,
  RunManifest,
  StartChecks,
  StartRunResult,
} from "../types";

// ==================== Test helpers ====================

function makeManifest(overrides: Partial<RunManifest> & { runId: string; port: number; rootDir: string }): RunManifest {
  const paths = {
    rootDir: overrides.rootDir,
    manifestPath: join(overrides.rootDir, "manifest.json"),
    worktreeDir: join(overrides.rootDir, "worktree"),
    dbDir: join(overrides.rootDir, "db"),
    frameworkDbPath: join(overrides.rootDir, "db", "framework-state.db"),
    opencodeDbPath: join(overrides.rootDir, "db", "opencode.db"),
    logsDir: join(overrides.rootDir, "logs"),
    frameworkLogDir: join(overrides.rootDir, "logs", "framework"),
    serveLogPath: join(overrides.rootDir, "logs", "serve.log"),
    sseLogPath: join(overrides.rootDir, "logs", "sse.log"),
    eventsDir: join(overrides.rootDir, "events"),
    eventFilePath: join(overrides.rootDir, "events", "events.jsonl"),
    sseReadyPath: join(overrides.rootDir, "events", "sse-ready.json"),
    archiveDir: join(overrides.rootDir, "events", "archive"),
    pidsDir: join(overrides.rootDir, "pids"),
    servePidPath: join(overrides.rootDir, "pids", "serve.pid"),
    ssePidPath: join(overrides.rootDir, "pids", "sse.pid"),
    artifactsDir: join(overrides.rootDir, "artifacts"),
    cleanupReportPath: join(overrides.rootDir, "cleanup-report.json"),
  };
  return {
    testId: overrides.testId ?? "P0-2-test",
    status: "CREATED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    primaryWorktree: "/tmp/primary",
    commit: "abc123",
    paths,
    env: {},
    sourceOverlay: null,
    sourceStatusPorcelainZ: null,
    rootSessionId: "root-1",
    childSessionId: "child-1",
    grantId: "grant-1",
    dispatchKey: "d",
    allowedPaths: [],
    bootstrapComplete: false,
    authorization: { h2Authorized: false, dryRun: true },
    process: { servePid: null, ssePid: null, portReserverPid: null },
    cleanup: { status: "pending", notes: [] },
    ...overrides,
  };
}

interface Counters {
  create: number;
  start: number;
  bootstrap: number;
  stop: number;
  stopA: number;
  stopB: number;
  cleanup: number;
  verify: Record<string, number>;
  startSentinel: number;
  stopSentinel: number;
  observeB: number;
  /** D2: 精确调用事件 ledger（按调用顺序记录 kind+object），替代聚合 <= ceiling。 */
  eventLog: Array<{ kind: string; object?: "a" | "b" | "sentinel" | string }>;
}

function makeCounters(): Counters {
  return {
    create: 0,
    start: 0,
    bootstrap: 0,
    stop: 0,
    cleanup: 0,
    verify: {},
    startSentinel: 0,
    stopSentinel: 0,
    stopA: 0,
    stopB: 0,
    observeB: 0,
    eventLog: [],
  };
}

const allTrueChecks: StartChecks = { health: true, serveIdentity: true, sseIdentity: true, sseReady: true };

function passVerify(): P02VerificationResult {
  return { ok: true, phase: "reservations", checks: {}, failedChecks: [] };
}

function failVerify(...checks: string[]): P02VerificationResult {
  const c: Record<string, boolean> = {};
  for (const ch of checks) c[ch] = false;
  return { ok: false, phase: "reservations", checks: c, failedChecks: checks };
}

/**
 * Build all-success dependencies. Every service returns a valid result, verify passes all phases.
 */
function makeAllSuccessDeps(rootDirA: string, rootDirB: string, counters: Counters): P02Dependencies {
  let seq = 0;
  const now = () => `2026-01-01T00:00:${String(seq++).padStart(2, "0")}.000Z`;

  return {
    now,
    createRunContext: async (input) => {
      counters.create++;
      const isA = input.testId.endsWith("-a");
      counters.eventLog.push({ kind: "create", object: isA ? "a" : "b" });
      const root = isA ? rootDirA : rootDirB;
      mkdirSync(join(root, "artifacts"), { recursive: true });
      mkdirSync(join(root, "events"), { recursive: true });
      // Write sse-ready marker
      writeFileSync(join(root, "events", "sse-ready.json"), JSON.stringify({
        runId: input.testId.replace("-a", "").replace("-b", ""),
        serveUrl: `http://127.0.0.1:${input.port}`,
        eventFile: join(root, "events", "events.jsonl"),
      }));
      return makeManifest({
        runId: `run-${input.testId}`,
        port: input.port,
        rootDir: root,
        testId: input.testId,
        status: "WORKTREE_READY",
        process: { servePid: null, ssePid: null, portReserverPid: isA ? 100 : 200 },
      });
    },
    startRunProcesses: async (runDir) => {
      counters.start++;
      counters.eventLog.push({ kind: "start", object: runDir === rootDirA ? "a" : "b" });
      // Read existing manifest
      const m = makeManifest({
        runId: runDir === rootDirA ? "run-P0-2-test-a" : "run-P0-2-test-b",
        port: runDir === rootDirA ? 41010 : 41011,
        rootDir: runDir,
        status: "READY",
        process: {
          servePid: runDir === rootDirA ? 1001 : 2001,
          ssePid: runDir === rootDirA ? 1002 : 2002,
          portReserverPid: null,
        },
      });
      // Write stage results with start checks
      const stageResultsPath = join(rootDirA, "artifacts", "p0-2-stage-results.json");
      const stageName = runDir === rootDirA ? "start-a" : "start-b";
      let stages: Array<Record<string, unknown>> = [];
      if (stageName === "start-b" && existsSync(stageResultsPath)) {
        try {
          const prev = JSON.parse(readFileSync(stageResultsPath, "utf8")) as { stages?: Array<Record<string, unknown>> };
          stages = prev.stages ?? [];
        } catch { /* ignore */ }
      }
      stages.push({ stage: stageName, checks: allTrueChecks, startedAt: now(), finishedAt: now(), status: "ok" });
      mkdirSync(join(rootDirA, "artifacts"), { recursive: true });
      writeFileSync(stageResultsPath, JSON.stringify({ runIdA: "run-P0-2-test-a", runIdB: stageName === "start-b" ? "run-P0-2-test-b" : null, sentinelId: "sentinel-1", stages }, null, 2));
      return { manifest: m, checks: allTrueChecks };
    },
    bootstrapRun: async ({ runDir }) => {
      counters.bootstrap++;
      counters.eventLog.push({ kind: "bootstrap", object: "a" });
      return makeManifest({
        runId: runDir === rootDirA ? "run-P0-2-test-a" : "run-P0-2-test-b",
        port: runDir === rootDirA ? 41010 : 41011,
        rootDir: runDir,
        status: "BOOTSTRAPPED",
        process: { servePid: 1001, ssePid: 1002, portReserverPid: null },
        rootSessionId: "root-1", childSessionId: "child-1", grantId: "grant-1",
        bootstrapComplete: true,
      });
    },
    stopRunProcesses: async (runDir) => {
      counters.stop++;
      counters.eventLog.push({ kind: "stop", object: runDir === rootDirA ? "a" : "b" });
      if (runDir === rootDirA) counters.stopA++;
      else if (runDir === rootDirB) counters.stopB++;
      return makeManifest({
        runId: runDir === rootDirA ? "run-P0-2-test-a" : "run-P0-2-test-b",
        port: runDir === rootDirA ? 41010 : 41011,
        rootDir: runDir,
        status: "STOPPED",
        process: { servePid: null, ssePid: null, portReserverPid: null },
      });
    },
    cleanupRun: async (runDir) => {
      counters.cleanup++;
      counters.eventLog.push({ kind: "cleanup", object: runDir === rootDirA ? "a" : "b" });
      const cleanupPath = join(runDir, "cleanup-report.json");
      writeFileSync(cleanupPath, JSON.stringify({ success: true, worktreeRemoved: true }));
      return {
        ok: true as const,
        runId: runDir === rootDirA ? "run-P0-2-test-a" : "run-P0-2-test-b",
        archivedLogs: null,
        evidenceRoot: runDir,
        manifestPath: join(runDir, "manifest.json"),
        cleanupReportPath: cleanupPath,
        artifactsDir: join(runDir, "artifacts"),
      };
    },
    verifyP02: (_input, phase) => {
      counters.verify[phase] = (counters.verify[phase] || 0) + 1;
      counters.eventLog.push({ kind: "verify", object: phase });
      return { ...passVerify(), phase } as P02VerificationResult;
    },
    startSentinel: async (markerPath, sentinelId) => {
      counters.startSentinel++;
      counters.eventLog.push({ kind: "startSentinel", object: "sentinel" });
      mkdirSync(join(rootDirA, "artifacts"), { recursive: true });
      writeFileSync(markerPath, JSON.stringify({ sentinelId, pid: 5000, readyAt: now() }));
      return { sentinelId, pid: 5000, markerPath };
    },
    stopSentinel: async () => {
      counters.stopSentinel++;
      counters.eventLog.push({ kind: "stopSentinel", object: "sentinel" });
    },
    validateSentinelIdentity: () => "FOUND",
    observeCleanupB: () => {
      counters.observeB++;
      counters.eventLog.push({ kind: "observeB", object: "b" });
      return { bServeAlive: true, bSseAlive: true, bHealthOk: true, bMarkerReadable: true, sentinelAlive: true };
    },
  };
}

function makeFailAtStageDeps(
  failStage: string,
  rootDirA: string,
  rootDirB: string,
  counters: Counters,
  failError = "injected failure",
): P02Dependencies {
  const deps = makeAllSuccessDeps(rootDirA, rootDirB, counters);
  const origCreate = deps.createRunContext!;
  const origStart = deps.startRunProcesses!;
  const origBootstrap = deps.bootstrapRun!;
  const origStop = deps.stopRunProcesses!;
  const origCleanup = deps.cleanupRun!;
  const origVerify = deps.verifyP02!;
  const origStartSentinel = deps.startSentinel!;
  const origStopSentinel = deps.stopSentinel!;
  const origObserve = deps.observeCleanupB!;

  // D1 fix：每个失败分支在 throw / 返回 ok:false 之前 push 一个 `failure` 事件标记，
  // 使 assertNoBusinessAfterFailure 能以此作为失败边界（失败后出现业务调用即非法）。
  switch (failStage) {
    case "create-a":
      deps.createRunContext = async (input) => {
        if (input.testId.endsWith("-a")) {
          counters.eventLog.push({ kind: "failure", object: "create-a" });
          throw new Error(failError);
        }
        return origCreate(input);
      };
      break;
    case "create-b":
      deps.createRunContext = async (input) => {
        if (input.testId.endsWith("-b")) {
          counters.eventLog.push({ kind: "failure", object: "create-b" });
          throw new Error(failError);
        }
        return origCreate(input);
      };
      break;
    case "verify-reservations":
      deps.verifyP02 = (input, phase) => {
        if (phase === "reservations") {
          counters.eventLog.push({ kind: "failure", object: "verify-reservations" });
          return failVerify("stageOrder");
        }
        return origVerify(input, phase);
      };
      break;
    case "start-sentinel":
      deps.startSentinel = async (...args) => {
        counters.eventLog.push({ kind: "failure", object: "start-sentinel" });
        throw new Error(failError);
      };
      break;
    case "start-a":
      deps.startRunProcesses = async (runDir) => {
        if (runDir === rootDirA) {
          counters.eventLog.push({ kind: "failure", object: "start-a" });
          throw new Error(failError);
        }
        return origStart(runDir);
      };
      break;
    case "start-b":
      deps.startRunProcesses = async (runDir) => {
        if (runDir === rootDirB) {
          counters.eventLog.push({ kind: "failure", object: "start-b" });
          throw new Error(failError);
        }
        return origStart(runDir);
      };
      break;
    case "verify-coexistence":
      deps.verifyP02 = (input, phase) => {
        if (phase === "coexistence") {
          counters.eventLog.push({ kind: "failure", object: "verify-coexistence" });
          return failVerify("aReady");
        }
        return origVerify(input, phase);
      };
      break;
    case "bootstrap-a":
      deps.bootstrapRun = async (...args) => {
        counters.eventLog.push({ kind: "failure", object: "bootstrap-a" });
        throw new Error(failError);
      };
      break;
    case "verify-attribution":
      deps.verifyP02 = (input, phase) => {
        if (phase === "attribution") {
          counters.eventLog.push({ kind: "failure", object: "verify-attribution" });
          return failVerify("aSdkPositive");
        }
        return origVerify(input, phase);
      };
      break;
    case "stop-a":
      deps.stopRunProcesses = async (runDir) => {
        if (runDir === rootDirA) {
          // 计数须在 throw 前完成，否则失败调用未计数（审计 D2 陷阱）
          counters.stop++;
          counters.stopA++;
          counters.eventLog.push({ kind: "stop", object: "a" });
          counters.eventLog.push({ kind: "failure", object: "stop-a" });
          throw new Error(failError);
        }
        return origStop(runDir);
      };
      break;
    case "verify-after-stop-a":
      deps.verifyP02 = (input, phase) => {
        if (phase === "after-stop-a") {
          counters.eventLog.push({ kind: "failure", object: "verify-after-stop-a" });
          return failVerify("aOldServeExited");
        }
        return origVerify(input, phase);
      };
      break;
    case "cleanup-a":
      deps.cleanupRun = async (runDir) => {
        if (runDir === rootDirA) {
          counters.eventLog.push({ kind: "failure", object: "cleanup-a" });
          return {
            ok: false as const, runId: "run-P0-2-test-a", archivedLogs: null, evidenceRoot: runDir,
            manifestPath: join(runDir, "manifest.json"), cleanupReportPath: "", artifactsDir: "",
            exitCode: 1, stderr: failError, stdout: "",
          };
        }
        return origCleanup(runDir);
      };
      break;
    case "stop-b":
      deps.stopRunProcesses = async (runDir) => {
        if (runDir === rootDirB) {
          counters.stop++;
          counters.stopB++;
          counters.eventLog.push({ kind: "stop", object: "b" });
          counters.eventLog.push({ kind: "failure", object: "stop-b" });
          throw new Error(failError);
        }
        return origStop(runDir);
      };
      break;
    case "cleanup-b":
      deps.cleanupRun = async (runDir) => {
        if (runDir === rootDirB) {
          counters.eventLog.push({ kind: "failure", object: "cleanup-b" });
          return {
            ok: false as const, runId: "run-P0-2-test-b", archivedLogs: null, evidenceRoot: runDir,
            manifestPath: join(runDir, "manifest.json"), cleanupReportPath: "", artifactsDir: "",
            exitCode: 1, stderr: failError, stdout: "",
          };
        }
        return origCleanup(runDir);
      };
      break;
    case "stop-sentinel":
      deps.validateSentinelIdentity = () => "FOUND";
      deps.stopSentinel = async () => {
        counters.stopSentinel++;
        counters.eventLog.push({ kind: "stopSentinel", object: "sentinel" });
        counters.eventLog.push({ kind: "failure", object: "stop-sentinel" });
        throw new Error(failError);
      };
      break;
    case "verify-cleanup":
      deps.verifyP02 = (input, phase) => {
        if (phase === "cleanup") {
          counters.eventLog.push({ kind: "failure", object: "verify-cleanup" });
          return failVerify("aCleaned");
        }
        return origVerify(input, phase);
      };
      break;
  }
  return deps;
}

// D2: 精确调用事件 ledger。firstFailure 后不得有任何业务调用，仅允许收敛 stop（每对象 ≤ 1）。
// 替代旧的聚合 <= ceiling：后者无法发现"失败调用未计数、后续同类调用补位"。
const BUSINESS_KINDS = new Set(["create", "start", "bootstrap", "cleanup", "verify", "startSentinel", "observeB"]);
const STOP_KINDS = new Set(["stop", "stopSentinel"]);

function assertNoBusinessAfterFailure(counters: Counters): void {
  const events = counters.eventLog;
  // D1 fix：失败边界以最后一个 `failure` 标记为界（其前的业务调用是合法前置 stage，
  // 其后的事件只允许收敛 stop）。原实现误用「最后一个业务事件」作界，导致
  // `failure → illegal cleanup-b → stop-a` 这类反例漏检。
  // 全成功（无 failure 标记）则无需断言。
  let lastFailureIdx = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].kind === "failure") { lastFailureIdx = i; break; }
  }
  if (lastFailureIdx === -1) return;
  const suffix = events.slice(lastFailureIdx + 1);
  for (const ev of suffix) {
    expect(BUSINESS_KINDS.has(ev.kind)).toBe(false); // 失败边界后不得有任何业务调用
  }
  // 收敛 stop 每对象最多一次（D1 fix 后不再重复）
  const stopObjects = suffix.filter((e) => STOP_KINDS.has(e.kind)).map((e) => e.object);
  expect(new Set(stopObjects).size).toBe(stopObjects.length);
}

let tmpDirA = "";
let tmpDirB = "";
beforeEach(() => {
  tmpDirA = mkdtempSync(join(tmpdir(), "p02-orch-a-"));
  tmpDirB = mkdtempSync(join(tmpdir(), "p02-orch-b-"));
});
afterEach(() => {
  rmSync(tmpDirA, { recursive: true, force: true });
  rmSync(tmpDirB, { recursive: true, force: true });
});

const baseInput: P02Input = {
  primaryWorktree: "/tmp/primary",
  mainFrameworkDbPath: "/tmp/main-fw.db",
  commit: "abc123",
  portA: 41010,
  portB: 41011,
  testId: "P0-2-O",
};

// ==================== Tests ====================

describe("runP02", () => {
  test("P02-O-ALL-PASS: all 16 stages succeed, all 5 phases verified", async () => {
    const counters = makeCounters();
    const deps = makeAllSuccessDeps(tmpDirA, tmpDirB, counters);
    const result = await runP02(baseInput, deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.status).toBe("PASS");
    expect(result.runDirA).toBe(tmpDirA);
    expect(result.runDirB).toBe(tmpDirB);
    expect(counters.create).toBe(2); // a + b
    expect(counters.start).toBe(2); // a + b
    expect(counters.bootstrap).toBe(1); // only a
    expect(counters.stop).toBe(2); // a + b
    expect(counters.cleanup).toBe(2); // a + b
    expect(counters.verify["reservations"]).toBe(1);
    expect(counters.verify["coexistence"]).toBe(1);
    expect(counters.verify["attribution"]).toBe(1);
    expect(counters.verify["after-stop-a"]).toBe(1);
    expect(counters.verify["cleanup"]).toBe(1);
    expect(counters.startSentinel).toBe(1);
    expect(counters.stopSentinel).toBe(1);
    expect(counters.observeB).toBe(1);
  });

  test("P02-O-COUNT: P02_STAGES has exactly 16 stages in fixed order", () => {
    expect(P02_STAGES.length).toBe(16);
    expect(P02_STAGES).toEqual([
      "create-a",
      "create-b",
      "verify-reservations",
      "start-sentinel",
      "start-a",
      "start-b",
      "verify-coexistence",
      "bootstrap-a",
      "verify-attribution",
      "stop-a",
      "verify-after-stop-a",
      "cleanup-a",
      "stop-b",
      "cleanup-b",
      "stop-sentinel",
      "verify-cleanup",
    ]);
  });

  // P02-O-STAGE: each stage throws once, later calls are 0, firstFailure exact
  for (const stage of P02_STAGES) {
    test(`P02-O-STAGE-${stage}: fails at ${stage}, later stages not called`, async () => {
      const counters = makeCounters();
      const deps = makeFailAtStageDeps(stage, tmpDirA, tmpDirB, counters);
      const result = await runP02(baseInput, deps);

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected failure");
      expect(result.firstFailure.stage).toBe(stage);
      // D4: 失败 stage 后不得有任何后续业务 stage 被调用
      const idx = P02_STAGES.indexOf(stage);
      expect(result.stages.map((s) => s.stage)).toEqual(P02_STAGES.slice(0, idx + 1));
      expect(result.stages[result.stages.length - 1].status).toBe("failed");
      // D2: 精确调用事件 ledger —— firstFailure 后不得有任何业务调用，仅允许收敛 stop（每对象 ≤ 1）
      assertNoBusinessAfterFailure(counters);
    });
  }

  test("P02-O-CLEANUP: cleanup-a B isolation false fails at cleanup-a", async () => {
    const counters = makeCounters();
    const deps = makeAllSuccessDeps(tmpDirA, tmpDirB, counters);
    deps.observeCleanupB = () => ({
      bServeAlive: false, // B died
      bSseAlive: true,
      bHealthOk: true,
      bMarkerReadable: true,
      sentinelAlive: true,
    });
    const result = await runP02(baseInput, deps);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.firstFailure.stage).toBe("cleanup-a");
  });

  test("P02-O-ID: sentinel identity mismatch prevents sentinel stop", async () => {
    const counters = makeCounters();
    const deps = makeFailAtStageDeps("bootstrap-a", tmpDirA, tmpDirB, counters);
    deps.validateSentinelIdentity = () => "NOT_FOUND"; // identity mismatch
    const result = await runP02(baseInput, deps);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    // stopSentinel should NOT be called because identity validation returns false
    expect(counters.stopSentinel).toBe(0);
    // But B and A stops should still be attempted (convergence)
    expect(counters.stop).toBeGreaterThanOrEqual(1);
  });

  test("P02-O-STOP: controlled stops — each object stopped at most once", async () => {
    const counters = makeCounters();
    const deps = makeFailAtStageDeps("verify-coexistence", tmpDirA, tmpDirB, counters);
    // All identity validations pass (so convergence stops sentinel, then B, then A)
    deps.validateSentinelIdentity = () => "FOUND";
    await runP02(baseInput, deps);

    // At verify-coexistence failure: sentinel + A + B started; convergence should:
    //   stop sentinel once, stop B once, stop A once
    // create-a/create-b → verify-reservations → start-sentinel → start-a → start-b → verify-coexistence(FAIL)
    // So at failure: A started, B started, sentinel started.
    // Convergence: stop sentinel (FOUND) → stop B → stop A.
    expect(counters.stopA).toBeLessThanOrEqual(1);
    expect(counters.stopB).toBeLessThanOrEqual(1);
    expect(counters.stopSentinel).toBeLessThanOrEqual(1);
  });

  // D1/D5: 晚期失败（正常 stop 已在主循环执行）下仍不得重复 stop 同一对象
  for (const failStage of ["cleanup-a", "cleanup-b", "verify-cleanup"] as const) {
    test(`P02-O-STOP-LATE-${failStage}: failure after normal stops stops each object at most once`, async () => {
      const counters = makeCounters();
      const deps = makeFailAtStageDeps(failStage, tmpDirA, tmpDirB, counters);
      deps.validateSentinelIdentity = () => "FOUND";
      await runP02(baseInput, deps);
      expect(counters.stopA).toBeLessThanOrEqual(1);
      expect(counters.stopB).toBeLessThanOrEqual(1);
      expect(counters.stopSentinel).toBeLessThanOrEqual(1);
    });
  }

  // D1: stop stage 自身 throw 时，stop-once 仍保证每对象恰好调用一次（=== 1，不是 <= 1）。
  // 主循环 stop throw 后该对象已 pre-mark，收敛不再重复；其余对象由收敛各停一次。
  for (const stopThrowStage of ["stop-a", "stop-b", "stop-sentinel"] as const) {
    test(`P02-O-STOP-THROW-${stopThrowStage}: stop self-throw → each object stopped exactly once (=== 1)`, async () => {
      const counters = makeCounters();
      const deps = makeFailAtStageDeps(stopThrowStage, tmpDirA, tmpDirB, counters);
      deps.validateSentinelIdentity = () => "FOUND";
      const result = await runP02(baseInput, deps);
      expect(result.ok).toBe(false);
      expect(counters.stopA).toBe(1);
      expect(counters.stopB).toBe(1);
      expect(counters.stopSentinel).toBe(1);
    });
  }

  // D1: convergence stop 失败不可静默吞掉，须记录到 convergenceErrors 供追溯
  test("P02-O-CONVERGE-ERRORS: convergence stop failures are captured, not swallowed", async () => {
    const counters = makeCounters();
    const deps = makeFailAtStageDeps("verify-coexistence", tmpDirA, tmpDirB, counters);
    deps.validateSentinelIdentity = () => "FOUND";
    deps.stopSentinel = async () => { throw new Error("sentinel converge fail"); };
    deps.stopRunProcesses = async (runDir) => {
      throw new Error(`${runDir === tmpDirA ? "a" : "b"} converge fail`);
    };
    const result = await runP02(baseInput, deps);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.convergenceErrors).toBeDefined();
    expect(result.convergenceErrors!.length).toBe(3);
    expect(result.convergenceErrors!.map((e) => e.object).sort()).toEqual(["a", "b", "sentinel"]);
  });

  // D2: 相对路径必须被 isAbsolute 拒绝，且不得触发任何业务依赖
  test("P02-O-INPUT-ABSOLUTE: rejects relative paths without calling dependencies", async () => {
    const counters = makeCounters();
    const deps = makeAllSuccessDeps(tmpDirA, tmpDirB, counters);
    await expect(runP02({ ...baseInput, primaryWorktree: "relative/path" }, deps)).rejects.toThrow("absolute path");
    await expect(runP02({ ...baseInput, mainFrameworkDbPath: "./fw.db" }, deps)).rejects.toThrow("absolute path");
    expect(counters.create).toBe(0);
    expect(counters.start).toBe(0);
  });

  // D1: failure boundary 必须捕获失败后出现的非法业务调用（审计 D1 反例 failure→illegal cleanup-b→stop-a）
  test("P02-O-D1-FAILURE-BOUNDARY: illegal business call after failure is detected", () => {
    const counters = makeCounters();
    counters.eventLog.push({ kind: "create", object: "a" });
    counters.eventLog.push({ kind: "create", object: "b" });
    counters.eventLog.push({ kind: "failure", object: "stop-a" });
    counters.eventLog.push({ kind: "cleanup", object: "b" }); // 非法：失败边界后出现业务调用
    counters.eventLog.push({ kind: "stop", object: "a" });
    expect(() => assertNoBusinessAfterFailure(counters)).toThrow();
  });

  // D1: 失败后仅收敛 stop（每对象 ≤1）应通过
  test("P02-O-D1-FAILURE-BOUNDARY-OK: only convergence stops after failure pass", () => {
    const counters = makeCounters();
    counters.eventLog.push({ kind: "create", object: "a" });
    counters.eventLog.push({ kind: "failure", object: "verify-reservations" });
    counters.eventLog.push({ kind: "stopSentinel", object: "sentinel" });
    counters.eventLog.push({ kind: "stop", object: "b" });
    counters.eventLog.push({ kind: "stop", object: "a" });
    expect(() => assertNoBusinessAfterFailure(counters)).not.toThrow();
  });

  // D2: stopSentinel 对真实轻量 sentinel 注入非 ESRCH（EACCES）信号错误必须 fail-closed（不静默吞掉）
  test("P02-O-D2-SIGTERM-NONESRCH: non-ESRCH SIGTERM error is fail-closed (not swallowed)", async () => {
    const markerPath = join(tmpDirA, "sentinel-marker.json");
    const info = await startSentinel(markerPath, "sentinel-D2-test", makeManifest({
      runId: "run-d2", port: 41010, rootDir: tmpDirA,
    }));
    // mock process.kill：SIGTERM 抛 EACCES（非 ESRCH），其余信号走真实实现
    const origKill = process.kill.bind(process);
    (process as unknown as { kill: (p: number, sig: string | number) => void }).kill =
      ((p: number, sig: string | number) => {
        if (sig === "SIGTERM") {
          const e = new Error("EACCES") as NodeJS.ErrnoException;
          e.code = "EACCES";
          throw e;
        }
        return origKill(p, sig);
      }) as (p: number, sig: string | number) => void;
    let threw = false;
    try {
      await stopSentinel(info.pid, info.sentinelId, markerPath);
    } catch {
      threw = true;
    } finally {
      (process as unknown as { kill: typeof process.kill }).kill = origKill;
    }
    expect(threw).toBe(true); // fail-closed：非 ESRCH 信号错误必须传播
    // 信号未被送达，sentinel 仍 FOUND
    expect(validateSentinelIdentity(info.pid, info.sentinelId, markerPath)).toBe("FOUND");
    // 清理：真实终止 sentinel
    try { origKill(info.pid, "SIGTERM"); } catch { /* ignore */ }
  });

  // D3: sentinel identity 显式三态
  describe("validateSentinelIdentity three-state", () => {
    test("returns NOT_FOUND when pid does not exist", () => {
      expect(validateSentinelIdentity(999999, "nope", join(tmpDirA, "marker.json"))).toBe("NOT_FOUND");
    });

    // D5: 区分 pid probe 的 ESRCH 与其他错误（EPERM 等不可复现，用注入 probe 模拟）
    test("returns NOT_FOUND when pid probe throws ESRCH (process gone)", () => {
      const esrchProbe = (): void => {
        const e = new Error("ESRCH") as NodeJS.ErrnoException;
        e.code = "ESRCH";
        throw e;
      };
      expect(validateSentinelIdentity(999999, "nope", join(tmpDirA, "marker.json"), esrchProbe)).toBe("NOT_FOUND");
    });

    test("returns UNAVAILABLE when pid probe throws non-ESRCH error (e.g. EPERM)", () => {
      const epermProbe = (): void => {
        const e = new Error("EPERM") as NodeJS.ErrnoException;
        e.code = "EPERM";
        throw e;
      };
      // EPERM 表示进程存在但无权限探测 → 证据不可用，不能判为 NOT_FOUND
      expect(validateSentinelIdentity(1, "nope", join(tmpDirA, "marker.json"), epermProbe)).toBe("UNAVAILABLE");
    });

    test("returns NOT_FOUND when sentinelId mismatches (environ)", () => {
      // 当前进程存活但不携带该 sentinel env
      expect(validateSentinelIdentity(process.pid, "wrong-id", join(tmpDirA, "marker.json"))).toBe("NOT_FOUND");
    });

    test("returns UNAVAILABLE when marker missing/malformed (environ matches but marker unreadable)", async () => {
      const markerPath = join(tmpDirA, "sentinel-marker-u.json");
      const info = await startSentinel(markerPath, "sentinel-UNAVAIL-test", makeManifest({
        runId: "run-u",
        port: 41010,
        rootDir: tmpDirA,
      }));
      // environ 匹配（本 pid 即 sentinel 自身）→ 进入 marker 读取步骤；marker 缺失 → UNAVAILABLE
      expect(validateSentinelIdentity(info.pid, info.sentinelId, join(tmpDirA, "missing.json"))).toBe("UNAVAILABLE");
      // marker 损坏（JSON 解析失败）→ UNAVAILABLE
      writeFileSync(markerPath, "{not-json");
      expect(validateSentinelIdentity(info.pid, info.sentinelId, markerPath)).toBe("UNAVAILABLE");
      await stopSentinel(info.pid, info.sentinelId, markerPath);
    });

    test("returns FOUND for a real started sentinel", async () => {
      const markerPath = join(tmpDirA, "sentinel-marker.json");
      const info = await startSentinel(markerPath, "sentinel-FOUND-test", makeManifest({
        runId: "run-fo",
        port: 41010,
        rootDir: tmpDirA,
      }));
      expect(validateSentinelIdentity(info.pid, info.sentinelId, info.markerPath)).toBe("FOUND");
      await stopSentinel(info.pid, info.sentinelId, info.markerPath);
    });
  });

  test("P02-O-STOP-AFTER-CREATE-B: failure before start-sentinel does not call stopSentinel", async () => {
    const counters = makeCounters();
    const deps = makeFailAtStageDeps("verify-reservations", tmpDirA, tmpDirB, counters);
    const result = await runP02(baseInput, deps);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    // sentinel was never started, so stopSentinel should be 0
    expect(counters.startSentinel).toBe(0);
    expect(counters.stopSentinel).toBe(0);
  });

  test("P02-O-INPUT-VALIDATION: rejects invalid inputs", async () => {
    await expect(runP02({ ...baseInput, portA: 80 }, {})).rejects.toThrow("invalid portA");
    await expect(runP02({ ...baseInput, portB: 41010 }, {})).rejects.toThrow("portA and portB must differ");
    await expect(runP02({ ...baseInput, testId: "" }, {})).rejects.toThrow("testId is required");
    await expect(runP02({ ...baseInput, primaryWorktree: "" }, {})).rejects.toThrow("primaryWorktree");
  });

  test("P02-O-STAGE-RESULTS: writes atomic stage results after each stage", async () => {
    const counters = makeCounters();
    const deps = makeAllSuccessDeps(tmpDirA, tmpDirB, counters);
    const result = await runP02(baseInput, deps);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const stageResultsPath = result.evidencePaths.stageResults;
    expect(existsSync(stageResultsPath)).toBe(true);
    const data = JSON.parse(readFileSync(stageResultsPath, "utf8"));
    expect(data.runIdA).toBe("run-P0-2-O-a");
    expect(data.runIdB).toBe("run-P0-2-O-b");
    expect(data.stages.length).toBe(16);
    // Each stage should be ok
    for (const s of data.stages) {
      expect(s.status).toBe("ok");
    }
  });
});
