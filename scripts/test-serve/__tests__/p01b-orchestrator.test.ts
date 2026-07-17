// P0-1B 编排器 component test
//
// 覆盖 plan §6.5.1 #7 的固定要求：
//   1. 逐阶段注入一次失败 → 后续 dep 调用计数为 0
//   2. firstFailure 匹配失败阶段
//   3. controlled stop 在 PID identity 可验证时尝试一次
//   4. 全成功路径 → ok:true status:"PASS"
//   5. stage-results.json 内容含 runId + 全部 stages

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawn as spawnChild } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import {
  P01B_STAGES,
  runP01b,
  type P01bDependencies,
  type P01bStageName,
  type P01bStageResultsFile,
  type P01bVerificationResult,
} from "../p01b-orchestrator";
import type {
  CleanupResult,
  RunManifest,
  StartChecks,
  StartRunResult,
} from "../types";

let tempRoot = "";

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "p01b-orch-test-"));
});

afterEach(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
});

const VALID_INPUT = {
  primaryWorktree: "/fake/primary",
  commit: "deadbeef",
  port: 39999,
  testId: "P01B-ORCH-TEST",
};

function makeFakeManifest(overrides: Partial<RunManifest> = {}): RunManifest {
  const runId = overrides.runId ?? "fake-run";
  const rootDir = join(tempRoot, runId);
  const paths = {
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
  return {
    runId,
    testId: "P01B-ORCH-TEST",
    status: "WORKTREE_READY",
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
    primaryWorktree: "/fake/primary",
    commit: "deadbeef",
    port: 39999,
    paths,
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
    process: { servePid: 12345, ssePid: 12346, portReserverPid: null },
    cleanup: { status: "pending", notes: [] },
    ...overrides,
  };
}

function makeCounters() {
  return {
    create: 0,
    start: 0,
    bootstrap: 0,
    execute: 0,
    verifyRuntime: 0,
    verifyCleanup: 0,
    stop: 0,
    cleanup: 0,
  };
}

function makeAllSuccessDeps(): {
  deps: P01bDependencies;
  counters: ReturnType<typeof makeCounters>;
  writeLog: { dir: string; payload: P01bStageResultsFile }[];
} {
  const counters = makeCounters();
  const writeLog: { dir: string; payload: P01bStageResultsFile }[] = [];

  const createManifest = makeFakeManifest({ status: "WORKTREE_READY" });
  const startedManifest = makeFakeManifest({ status: "READY" });
  const bootstrappedManifest = makeFakeManifest({ status: "BOOTSTRAPPED" });
  const stoppedManifest = makeFakeManifest({
    status: "STOPPED",
    process: { servePid: null, ssePid: null, portReserverPid: null },
  });

  const deps: P01bDependencies = {
    createRunContext: async () => {
      counters.create++;
      return createManifest;
    },
    startRunProcesses: async (): Promise<StartRunResult> => {
      counters.start++;
      return {
        manifest: startedManifest,
        checks: { health: true, serveIdentity: true, sseIdentity: true, sseReady: true } satisfies StartChecks,
      };
    },
    bootstrapRun: async () => {
      counters.bootstrap++;
      return bootstrappedManifest;
    },
    executeRun: async () => {
      counters.execute++;
      return { outcome: "NOT-RUN", artifactPath: join(createManifest.paths.artifactsDir, "execute-plan.json") };
    },
    verifyP01b: (_runDir, phase) => {
      if (phase === "runtime") {
        counters.verifyRuntime++;
        return { ok: true, phase, checks: { allGood: true }, failedChecks: [] };
      }
      counters.verifyCleanup++;
      return { ok: true, phase, checks: { allGood: true }, failedChecks: [] };
    },
    stopRunProcesses: async () => {
      counters.stop++;
      return stoppedManifest;
    },
    cleanupRun: async (): Promise<CleanupResult> => {
      counters.cleanup++;
      return {
        ok: true,
        runId: createManifest.runId,
        archivedLogs: null,
        evidenceRoot: createManifest.paths.rootDir,
        manifestPath: createManifest.paths.manifestPath,
        cleanupReportPath: createManifest.paths.cleanupReportPath,
        artifactsDir: createManifest.paths.artifactsDir,
      };
    },
    validateRunProcess: () => true,
    writeStageResults: (artifactsDir, payload) => {
      writeLog.push({ dir: artifactsDir, payload: JSON.parse(JSON.stringify(payload)) as P01bStageResultsFile });
    },
    now: () => "2026-07-17T00:00:00.000Z",
  };
  return { deps, counters, writeLog };
}

function makeFailAtStageDeps(
  failStage: P01bStageName,
  validateReturns: boolean = true,
): {
  deps: P01bDependencies;
  counters: ReturnType<typeof makeCounters>;
  writeLog: { dir: string; payload: P01bStageResultsFile }[];
} {
  const counters = makeCounters();
  const writeLog: { dir: string; payload: P01bStageResultsFile }[] = [];
  const errorMessage = `injected failure at ${failStage}`;
  const createManifest = makeFakeManifest({ status: "WORKTREE_READY" });
  const startedManifest = makeFakeManifest({ status: "READY" });
  const bootstrappedManifest = makeFakeManifest({ status: "BOOTSTRAPPED" });

  const deps: P01bDependencies = {
    createRunContext: async () => {
      counters.create++;
      if (failStage === "create") throw new Error(errorMessage);
      return createManifest;
    },
    startRunProcesses: async (): Promise<StartRunResult> => {
      counters.start++;
      if (failStage === "start") throw new Error(errorMessage);
      return {
        manifest: startedManifest,
        checks: { health: true, serveIdentity: true, sseIdentity: true, sseReady: true },
      };
    },
    bootstrapRun: async () => {
      counters.bootstrap++;
      if (failStage === "bootstrap") throw new Error(errorMessage);
      return bootstrappedManifest;
    },
    executeRun: async () => {
      counters.execute++;
      if (failStage === "execute-plan") throw new Error(errorMessage);
      return { outcome: "NOT-RUN", artifactPath: "/fake/execute-plan.json" };
    },
    verifyP01b: (_runDir, phase) => {
      if (phase === "runtime") {
        counters.verifyRuntime++;
        if (failStage === "verify-runtime") {
          // throw path: 让 firstFailure.error 携带 "injected failure at verify-runtime"。
          // ok:false 路径由 dedicated "controlled stop attempt > verify-runtime failure" 测试覆盖。
          throw new Error(errorMessage);
        }
        return { ok: true, phase, checks: { ok: true }, failedChecks: [] };
      }
      counters.verifyCleanup++;
      if (failStage === "verify-cleanup") {
        throw new Error(errorMessage);
      }
      return { ok: true, phase, checks: { ok: true }, failedChecks: [] };
    },
    stopRunProcesses: async () => {
      counters.stop++;
      if (failStage === "stop") throw new Error(errorMessage);
      return makeFakeManifest({
        status: "STOPPED",
        process: { servePid: null, ssePid: null, portReserverPid: null },
      });
    },
    cleanupRun: async (): Promise<CleanupResult> => {
      counters.cleanup++;
      if (failStage === "cleanup") {
        return {
          ok: false,
          runId: createManifest.runId,
          exitCode: 1,
          stderr: errorMessage,
          stdout: "",
          archivedLogs: null,
          evidenceRoot: createManifest.paths.rootDir,
          manifestPath: createManifest.paths.manifestPath,
          cleanupReportPath: createManifest.paths.cleanupReportPath,
          artifactsDir: createManifest.paths.artifactsDir,
        };
      }
      return {
        ok: true,
        runId: createManifest.runId,
        archivedLogs: null,
        evidenceRoot: createManifest.paths.rootDir,
        manifestPath: createManifest.paths.manifestPath,
        cleanupReportPath: createManifest.paths.cleanupReportPath,
        artifactsDir: createManifest.paths.artifactsDir,
      };
    },
    validateRunProcess: () => validateReturns,
    writeStageResults: (artifactsDir, payload) => {
      writeLog.push({ dir: artifactsDir, payload: JSON.parse(JSON.stringify(payload)) as P01bStageResultsFile });
    },
    now: () => "2026-07-17T00:00:00.000Z",
  };
  return { deps, counters, writeLog };
}

describe("P01B_STAGES constant", () => {
  test("fixed 8-stage order matches plan §6.5.1", () => {
    expect(P01B_STAGES).toEqual([
      "create",
      "start",
      "bootstrap",
      "execute-plan",
      "verify-runtime",
      "stop",
      "cleanup",
      "verify-cleanup",
    ]);
  });
});

describe("input validation", () => {
  test("rejects missing primaryWorktree", async () => {
    const { deps } = makeAllSuccessDeps();
    await expect(
      runP01b({ ...VALID_INPUT, primaryWorktree: "" }, deps),
    ).rejects.toThrow("primaryWorktree is required");
  });

  test("rejects missing commit", async () => {
    const { deps } = makeAllSuccessDeps();
    await expect(
      runP01b({ ...VALID_INPUT, commit: "" }, deps),
    ).rejects.toThrow("commit is required");
  });

  test("rejects port out of range", async () => {
    const { deps } = makeAllSuccessDeps();
    await expect(
      runP01b({ ...VALID_INPUT, port: 0 }, deps),
    ).rejects.toThrow("invalid port: 0");
    await expect(
      runP01b({ ...VALID_INPUT, port: 70000 }, deps),
    ).rejects.toThrow("invalid port");
  });

  test("rejects missing testId", async () => {
    const { deps } = makeAllSuccessDeps();
    await expect(
      runP01b({ ...VALID_INPUT, testId: "" }, deps),
    ).rejects.toThrow("testId is required");
  });
});

describe("all-success path", () => {
  test("returns ok:true status:PASS and each dep called once", async () => {
    const { deps, counters, writeLog } = makeAllSuccessDeps();
    const result = await runP01b(VALID_INPUT, deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.status).toBe("PASS");
    expect(result.runDir).toBe(join(tempRoot, "fake-run"));
    expect(result.checks.runtime.ok).toBe(true);
    expect(result.checks.cleanup.ok).toBe(true);
    expect(result.evidencePaths.manifest).toBe(join(tempRoot, "fake-run", "manifest.json"));
    expect(result.evidencePaths.stageResults).toBe(
      join(tempRoot, "fake-run", "artifacts", "p0-1b-stage-results.json"),
    );

    expect(counters.create).toBe(1);
    expect(counters.start).toBe(1);
    expect(counters.bootstrap).toBe(1);
    expect(counters.execute).toBe(1);
    expect(counters.verifyRuntime).toBe(1);
    expect(counters.verifyCleanup).toBe(1);
    expect(counters.stop).toBe(1);
    expect(counters.cleanup).toBe(1);

    // 8 stages × 1 write each = 8 writes
    expect(writeLog.length).toBe(8);
    const lastPayload = writeLog[writeLog.length - 1]!.payload;
    expect(lastPayload.runId).toBe("fake-run");
    expect(lastPayload.stages.map((s) => s.stage)).toEqual([...P01B_STAGES]);
    expect(lastPayload.stages.every((s) => s.status === "ok")).toBe(true);
    const executePlanStage = lastPayload.stages.find((s) => s.stage === "execute-plan");
    expect(executePlanStage?.artifactPath).toContain("execute-plan.json");
  });
});

describe("first-failure convergence at each stage", () => {
  for (const stage of P01B_STAGES) {
    test(`failure at ${stage} stops subsequent stages and records firstFailure`, async () => {
      const { deps, counters } = makeFailAtStageDeps(stage);
      const result = await runP01b(VALID_INPUT, deps);

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unreachable");
      expect(result.firstFailure.stage).toBe(stage);
      expect(result.firstFailure.error).toContain(`injected failure at ${stage}`);

      // 阶段索引: stages[0]=create … stages[7]=verify-cleanup
      const stageIndex = P01B_STAGES.indexOf(stage);
      // 后续业务阶段调用计数为 0。
      // 注意：controlled stop 是 loop 外的 post-failure 动作，不算"后续阶段"，
      // 其计数由 dedicated controlled-stop test 覆盖。
      for (let i = stageIndex + 1; i < P01B_STAGES.length; i++) {
        const later = P01B_STAGES[i]!;
        switch (later) {
          case "create": expect(counters.create).toBe(0); break;
          case "start": expect(counters.start).toBe(0); break;
          case "bootstrap": expect(counters.bootstrap).toBe(0); break;
          case "execute-plan": expect(counters.execute).toBe(0); break;
          case "verify-runtime": expect(counters.verifyRuntime).toBe(0); break;
          // stop 计数由 controlled stop 决定，此处不检
          case "cleanup": expect(counters.cleanup).toBe(0); break;
          case "verify-cleanup": expect(counters.verifyCleanup).toBe(0); break;
        }
      }
    });
  }
});

describe("controlled stop attempt", () => {
  test("create failure: no manifest exists, controlled stop is NOT called", async () => {
    const { deps, counters } = makeFailAtStageDeps("create", true);
    const result = await runP01b(VALID_INPUT, deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.runDir).toBeNull();
    expect(result.evidencePaths.stageResults).toBeNull();
    // create threw, no other dep called, no controlled stop
    expect(counters.stop).toBe(0);
  });

  test("start failure: create succeeded, controlled stop attempted once (manifest has PIDs, validate=true)", async () => {
    const { deps, counters } = makeFailAtStageDeps("start", true);
    const result = await runP01b(VALID_INPUT, deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.firstFailure.stage).toBe("start");
    expect(result.runDir).not.toBeNull();
    // start throws itself; orchestrator's controlled stop is the second call
    // Wait: the mock for startRunProcesses throws, so it never reaches the controlled-stop branch.
    // currentManifest is from create (PIDs set), validate returns true, so controlled stop IS called.
    expect(counters.start).toBe(1); // failed call
    expect(counters.stop).toBe(1); // controlled stop
  });

  test("execute-plan failure: controlled stop called once", async () => {
    const { deps, counters } = makeFailAtStageDeps("execute-plan", true);
    const result = await runP01b(VALID_INPUT, deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.firstFailure.stage).toBe("execute-plan");
    expect(counters.execute).toBe(1);
    expect(counters.stop).toBe(1);
    // All subsequent stages must have 0 calls
    expect(counters.verifyRuntime).toBe(0);
    expect(counters.stop).toBe(1);
    expect(counters.cleanup).toBe(0);
    expect(counters.verifyCleanup).toBe(0);
  });

  test("verify-runtime failure (verifier ok:false): controlled stop called once", async () => {
    // 此测试覆盖 verifier ok:false 路径，与 throw 路径分开。
    const { deps, counters } = makeAllSuccessDeps();
    deps.verifyP01b = (_runDir, phase): P01bVerificationResult => {
      counters.verifyRuntime++;
      if (phase === "runtime") {
        return {
          ok: false,
          phase,
          checks: { statusBootstrapped: false },
          failedChecks: ["statusBootstrapped"],
        };
      }
      counters.verifyCleanup++;
      return { ok: true, phase, checks: { ok: true }, failedChecks: [] };
    };

    const result = await runP01b(VALID_INPUT, deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.firstFailure.stage).toBe("verify-runtime");
    expect(result.firstFailure.error).toContain("statusBootstrapped");
    expect(counters.verifyRuntime).toBe(1);
    expect(counters.stop).toBe(1); // controlled stop
    expect(counters.cleanup).toBe(0);
    expect(counters.verifyCleanup).toBe(0);
  });

  test("stop failure: throws inside stop stage, controlled stop attempted (count=2 total: 1 fail + 1 controlled)", async () => {
    const { deps, counters } = makeFailAtStageDeps("stop", true);
    const result = await runP01b(VALID_INPUT, deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.firstFailure.stage).toBe("stop");
    // 1 from the failed stop-stage call + 1 from the controlled stop attempt
    expect(counters.stop).toBe(2);
    expect(counters.cleanup).toBe(0);
    expect(counters.verifyCleanup).toBe(0);
  });

  test("controlled stop swallow: stop stage + controlled stop both throw, runP01b still returns", async () => {
    const { deps, counters } = makeAllSuccessDeps();
    // Override stop to always throw
    deps.stopRunProcesses = async () => {
      counters.stop++;
      throw new Error("stop always fails");
    };
    deps.validateRunProcess = () => true;

    const result = await runP01b(VALID_INPUT, deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    // 1 from failed stop stage + 1 from controlled stop (swallowed)
    expect(counters.stop).toBe(2);
  });

  test("PID identity not verifiable: controlled stop NOT called even after failure", async () => {
    const { deps, counters } = makeFailAtStageDeps("execute-plan", /*validateReturns*/ false);
    const result = await runP01b(VALID_INPUT, deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.firstFailure.stage).toBe("execute-plan");
    expect(counters.execute).toBe(1);
    expect(counters.stop).toBe(0); // validate=false, no controlled stop
  });

  test("cleanup failure: PIDs nulled by stop, no controlled stop beyond regular stop stage", async () => {
    const { deps, counters } = makeFailAtStageDeps("cleanup", true);
    const result = await runP01b(VALID_INPUT, deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.firstFailure.stage).toBe("cleanup");
    expect(counters.cleanup).toBe(1);
    // 1 是 regular stop stage；controlled stop 因 PIDs 已 null 被跳过，无额外调用
    expect(counters.stop).toBe(1);
  });

  test("verify-cleanup failure: no controlled stop beyond regular stop stage", async () => {
    const { deps, counters } = makeFailAtStageDeps("verify-cleanup", true);
    const result = await runP01b(VALID_INPUT, deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.firstFailure.stage).toBe("verify-cleanup");
    expect(counters.verifyCleanup).toBe(1);
    // 1 是 regular stop stage；controlled stop 因 PIDs 已 null 被跳过
    expect(counters.stop).toBe(1);
  });
});

describe("stage-results file", () => {
  test("on success: writeStageResults called once per stage, final payload has all 8 stages", async () => {
    const { deps, writeLog } = makeAllSuccessDeps();
    await runP01b(VALID_INPUT, deps);

    expect(writeLog.length).toBe(8);
    for (let i = 0; i < P01B_STAGES.length; i++) {
      expect(writeLog[i]!.payload.stages.length).toBe(i + 1);
      expect(writeLog[i]!.payload.stages[i]!.stage).toBe(P01B_STAGES[i]);
      expect(writeLog[i]!.payload.stages[i]!.status).toBe("ok");
    }
    expect(writeLog[7]!.payload.stages[7]!.status).toBe("ok");
  });

  test("on failure: writeStageResults called for each reached stage + failed stage; failed stage has error", async () => {
    const { deps, writeLog } = makeFailAtStageDeps("execute-plan", true);
    await runP01b(VALID_INPUT, deps);

    // create + start + bootstrap → 3 ok writes; execute-plan fail → 1 write. Total = 4.
    expect(writeLog.length).toBe(4);
    const lastPayload = writeLog[writeLog.length - 1]!.payload;
    expect(lastPayload.stages.length).toBe(4);
    expect(lastPayload.stages[0]!.stage).toBe("create");
    expect(lastPayload.stages[0]!.status).toBe("ok");
    expect(lastPayload.stages[1]!.stage).toBe("start");
    expect(lastPayload.stages[2]!.stage).toBe("bootstrap");
    expect(lastPayload.stages[3]!.stage).toBe("execute-plan");
    expect(lastPayload.stages[3]!.status).toBe("failed");
    expect(lastPayload.stages[3]!.error).toContain("injected failure at execute-plan");
  });

  test("on create failure: writeStageResults is NOT called (no artifacts dir yet)", async () => {
    const { deps, writeLog } = makeFailAtStageDeps("create", true);
    const result = await runP01b(VALID_INPUT, deps);

    expect(result.ok).toBe(false);
    expect(writeLog.length).toBe(0);
  });

  test("default writeStageResults writes to ${artifactsDir}/p0-1b-stage-results.json atomically", async () => {
    const { deps } = makeAllSuccessDeps();
    // remove injected writeStageResults to exercise default impl
    delete (deps as { writeStageResults?: unknown }).writeStageResults;

    const result = await runP01b(VALID_INPUT, deps);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    const expected = join(tempRoot, "fake-run", "artifacts", "p0-1b-stage-results.json");
    expect(existsSync(expected)).toBe(true);
    const payload = JSON.parse(readFileSync(expected, "utf8")) as P01bStageResultsFile;
    expect(payload.runId).toBe("fake-run");
    expect(payload.stages.length).toBe(8);
    // 临时文件不应残留
    expect(existsSync(`${expected}.tmp`)).toBe(false);
    // 用于防止 unused 警告
    void writeFileSync;
  });
});

describe("isolated-serve CLI adapter", () => {
  function runCli(args: string[]): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawnChild(process.execPath, ["run", "scripts/test-serve/isolated-serve.ts", ...args], {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
      child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      child.on("error", reject);
      child.on("exit", (exitCode) => resolve({ exitCode, stdout, stderr }));
    });
  }

  function seedVerifyManifest(runDir: string): void {
    const paths = {
      rootDir: runDir,
      manifestPath: join(runDir, "manifest.json"),
      worktreeDir: join(runDir, "worktree"),
      dbDir: join(runDir, "db"),
      frameworkDbPath: join(runDir, "db", "framework-state.db"),
      opencodeDbPath: join(runDir, "db", "opencode.db"),
      logsDir: join(runDir, "logs"),
      frameworkLogDir: join(runDir, "logs", "framework"),
      serveLogPath: join(runDir, "logs", "serve.log"),
      sseLogPath: join(runDir, "logs", "sse.log"),
      eventsDir: join(runDir, "events"),
      eventFilePath: join(runDir, "events", "events.jsonl"),
      sseReadyPath: join(runDir, "events", "sse-ready.json"),
      archiveDir: join(runDir, "events", "archive"),
      pidsDir: join(runDir, "pids"),
      servePidPath: join(runDir, "pids", "serve.pid"),
      ssePidPath: join(runDir, "pids", "sse.pid"),
      artifactsDir: join(runDir, "artifacts"),
      cleanupReportPath: join(runDir, "cleanup-report.json"),
    };
    for (const dir of [runDir, paths.dbDir, paths.eventsDir, paths.pidsDir, paths.artifactsDir, paths.logsDir]) {
      mkdirSync(dir, { recursive: true });
    }
    const manifest: RunManifest = {
      runId: "verify-cli-test",
      testId: "VERIFY-CLI",
      status: "BOOTSTRAPPED",
      createdAt: "2026-07-17T00:00:00.000Z",
      updatedAt: "2026-07-17T00:00:00.000Z",
      primaryWorktree: "/fake",
      commit: "HEAD",
      port: 39999,
      paths,
      env: {},
      sourceOverlay: null,
      sourceStatusPorcelainZ: null,
      rootSessionId: "root-1",
      childSessionId: "child-1",
      grantId: "grant-1",
      dispatchKey: "dispatch-1",
      allowedPaths: [],
      bootstrapComplete: true,
      authorization: { h2Authorized: false, dryRun: true },
      process: { servePid: 100, ssePid: 200, portReserverPid: null },
      cleanup: { status: "pending", notes: [] },
    };
    writeFileSync(paths.manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    // SSE ready marker
    writeFileSync(paths.sseReadyPath, JSON.stringify({
      runId: manifest.runId,
      serveUrl: `http://127.0.0.1:${manifest.port}`,
      eventFile: paths.eventFilePath,
    }));
    // events
    writeFileSync(paths.eventFilePath,
      JSON.stringify({ type: "session.created", sessionID: manifest.rootSessionId }) + "\n" +
      JSON.stringify({ type: "session.created", sessionID: manifest.childSessionId }) + "\n",
    );
    // DBs
    const fwDb = new Database(paths.frameworkDbPath);
    fwDb.run("CREATE TABLE IF NOT EXISTS session_map (session_id TEXT PRIMARY KEY, agent TEXT, created_at INTEGER, updated_at INTEGER)");
    fwDb.run("CREATE TABLE IF NOT EXISTS dispatch_privilege_grants (id TEXT PRIMARY KEY, status TEXT, child_session_id TEXT, parent_session_id TEXT, agent_type TEXT)");
    fwDb.run("INSERT INTO session_map (session_id, agent, created_at, updated_at) VALUES (?, ?, ?, ?)", [manifest.rootSessionId, "build", 1, 1]);
    fwDb.run("INSERT INTO session_map (session_id, agent, created_at, updated_at) VALUES (?, ?, ?, ?)", [manifest.childSessionId, "general", 1, 1]);
    fwDb.run("INSERT INTO dispatch_privilege_grants (id, status, child_session_id, parent_session_id, agent_type) VALUES (?, ?, ?, ?, ?)", [manifest.grantId, "bound", manifest.childSessionId, manifest.rootSessionId, "general"]);
    fwDb.close();
    const sdkDb = new Database(paths.opencodeDbPath);
    sdkDb.run("CREATE TABLE IF NOT EXISTS session (id TEXT PRIMARY KEY, parent_id TEXT)");
    sdkDb.run("INSERT INTO session (id, parent_id) VALUES (?, ?)", [manifest.rootSessionId, null]);
    sdkDb.run("INSERT INTO session (id, parent_id) VALUES (?, ?)", [manifest.childSessionId, manifest.rootSessionId]);
    sdkDb.close();
    // plan artifact
    writeFileSync(join(paths.artifactsDir, "plan-result.json"), JSON.stringify({ status: "NOT-RUN" }));
  }

  test("help shows verify and p0-1b", async () => {
    const { exitCode, stdout } = await runCli(["help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("test-serve verify --run-dir <run-dir> --phase runtime|cleanup");
    expect(stdout).toContain("test-serve p0-1b --primary-worktree <dir> --commit <sha> --port <port> --test-id <id>");
  });

  test("verify missing --run-dir exits 1", async () => {
    const { exitCode, stderr } = await runCli(["verify", "--phase", "runtime"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("missing required arg --run-dir");
  });

  test("verify missing --phase exits 1", async () => {
    const { exitCode, stderr } = await runCli(["verify", "--run-dir", tempRoot]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("missing required arg --phase");
  });

  test("verify invalid phase exits 1", async () => {
    const runDir = join(tempRoot, "verify-invalid");
    mkdtempSync(runDir);
    const { exitCode, stderr } = await runCli(["verify", "--run-dir", runDir, "--phase", "bad"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("invalid phase");
  });

  test("verify runtime CLI returns JSON and exit 0 with complete evidence", async () => {
    const runDir = join(tempRoot, "verify-runtime");
    seedVerifyManifest(runDir);
    const { exitCode, stdout, stderr } = await runCli(["verify", "--run-dir", runDir, "--phase", "runtime"]);
    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(result.phase).toBe("runtime");
  });

  test("p0-1b missing --primary-worktree exits 1", async () => {
    const { exitCode, stderr } = await runCli(["p0-1b", "--commit", "HEAD", "--port", "39999", "--test-id", "x"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("missing required arg --primary-worktree");
  });

  test("p0-1b missing --commit exits 1", async () => {
    const { exitCode, stderr } = await runCli(["p0-1b", "--primary-worktree", "/fake", "--port", "39999", "--test-id", "x"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("missing required arg --commit");
  });

  test("p0-1b missing --port exits 1", async () => {
    const { exitCode, stderr } = await runCli(["p0-1b", "--primary-worktree", "/fake", "--commit", "HEAD", "--test-id", "x"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("missing required arg --port");
  });

  test("p0-1b missing --test-id exits 1", async () => {
    const { exitCode, stderr } = await runCli(["p0-1b", "--primary-worktree", "/fake", "--commit", "HEAD", "--port", "39999"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("missing required arg --test-id");
  });

  test("p0-1b invalid --port exits 1", async () => {
    const { exitCode, stderr } = await runCli([
      "p0-1b",
      "--primary-worktree", "/fake",
      "--commit", "HEAD",
      "--port", "abc",
      "--test-id", "x",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("invalid port");
  });
});
