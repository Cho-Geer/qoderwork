// P0-2 双 run 编排器
//
// 按 PHASE-03 蓝图的固定要求，在一个进程内串行执行 16 个 stage：
//   create-a → create-b → verify-reservations → start-sentinel → start-a → start-b →
//   verify-coexistence → bootstrap-a → verify-attribution → stop-a → verify-after-stop-a →
//   cleanup-a → stop-b → cleanup-b → stop-sentinel → verify-cleanup
//
// 设计约束：
//   1. input 仅允许 primaryWorktree / mainFrameworkDbPath / commit / portA / portB / testId
//   2. dependencies 覆盖所有核心 service 与 sentinel/observer/validator，unit test 完全不启动真实进程
//   3. stages 是常量数组，循环外不得有可跳过阶段的条件分支
//   4. 每个成功阶段后原子覆盖 ${artifactsDirA}/p0-2-stage-results.json
//   5. 任一阶段 throw 或 verifier 返回 ok:false 即记录 firstFailure 并停止后续业务阶段
//   6. 失败收敛：先验证 marker + /proc identity 后 stop sentinel；再 stop B、stop A；每对象最多一次；不 cleanup
//   7. cleanup-a 后重新观测 B process/health/marker 和 sentinel 五项，任一 false 失败于 cleanup-a
//   8. 成功返回 5 个 phase 的 checks，失败返回 firstFailure
//
// 禁止：spawn/Bun.$/shell字符串/递归调用CLI/重试/跳过阶段/sleep假定ready
// 负向结论三态：FOUND/NOT_FOUND/UNAVAILABLE；仅 NOT_FOUND 可证明目标不存在

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { isAbsolute, join, dirname } from "node:path";
import { Database } from "bun:sqlite";
import { P02_STAGES } from "./types";
import { startSentinel, stopSentinel, validateSentinelIdentity, finalizeSentinelMarker } from "./p02-sentinel";
import { createRunContext } from "./run-context";
import { startRunProcesses, stopRunProcesses } from "./process";
import { bootstrapRun } from "./bootstrap";
import { cleanupRun } from "./cleanup";
import { verifyP02 } from "./verify-p02";
import type {
  BootstrapInput,
  CleanupResult,
  CreateRunInput,
  P02Dependencies,
  P02Input,
  P02Phase,
  P02CleanupBObservation,
  P02StageName,
  P02StageResult,
  P02StageResultsFile,
  P02VerificationResult,
  RunManifest,
  SentinelStartResult,
  StartChecks,
  StartRunResult,
} from "./types";

export { P02_STAGES } from "./types";
export type { P02StageName, P02Input, P02Result, P02Dependencies } from "./types";

export async function runP02(
  input: P02Input,
  dependencies: P02Dependencies = {},
): Promise<import("./types").P02Result> {
  validateInput(input);

  const nowFn = dependencies.now ?? (() => new Date().toISOString());
  const writeFn = dependencies.writeStageResults ?? defaultWriteStageResults;
  const createRunContextFn = dependencies.createRunContext ?? createRunContext;
  const startRunProcessesFn = dependencies.startRunProcesses ?? startRunProcesses;
  const bootstrapRunFn = dependencies.bootstrapRun ?? bootstrapRun;
  const stopRunProcessesFn = dependencies.stopRunProcesses ?? stopRunProcesses;
  const cleanupRunFn = dependencies.cleanupRun ?? cleanupRun;
  const verifyP02Fn = dependencies.verifyP02 ?? verifyP02;
  const startSentinelFn = dependencies.startSentinel ?? startSentinel;
  const stopSentinelFn = dependencies.stopSentinel ?? stopSentinel;
  const validateSentinelIdentityFn = dependencies.validateSentinelIdentity ?? validateSentinelIdentity;
  const observeCleanupBFn = dependencies.observeCleanupB ?? defaultObserveCleanupB;
  const ensureFrameworkDbFn = dependencies.ensureFrameworkDb ?? ensureFrameworkDb;

  const results: P02StageResultsFile = { runIdA: null, runIdB: null, sentinelId: null, stages: [] };
  let runDirA: string | null = null;
  let runDirB: string | null = null;
  let artifactsDirA: string | null = null;
  let artifactsDirB: string | null = null;
  let sentinelMarkerPath: string | null = null;
  let manifestA: RunManifest | null = null;
  let manifestB: RunManifest | null = null;
  let sentinelInfo: SentinelStartResult | null = null;
  let stoppedServePidA: number | null = null;
  let stoppedSsePidA: number | null = null;
  let reservationPidA: number | null = null;
  let reservationPidB: number | null = null;
  let firstFailure: { stage: P02StageName; error: string } | null = null;
  let failedCheck = "";
  const phaseChecks: Record<P02Phase, P02VerificationResult | null> = {
    reservations: null,
    coexistence: null,
    attribution: null,
    "after-stop-a": null,
    cleanup: null,
  };

  // stop-once tracking
  const stopped = { sentinel: false, a: false, b: false };
  // convergence error capture（主循环 stop 自身 throw 已计入 firstFailure；此处记录收敛尝试错误，不静默吞掉）
  const convergenceErrors: Array<{ object: "sentinel" | "a" | "b"; error: string }> = [];

  for (const stage of P02_STAGES) {
    if (firstFailure) break;

    const startedAt = nowFn();
    let artifactPath: string | undefined;
    let stageChecks: StartChecks | undefined;

    try {
      switch (stage) {
        case "create-a": {
          const m = await createRunContextFn({
            primaryWorktree: input.primaryWorktree,
            commit: input.commit,
            port: input.portA,
            testId: `${input.testId}-a`,
          });
          manifestA = m;
          // 确保 rootDir 顶层字段存在
          if (!manifestA.rootDir) manifestA.rootDir = m.paths.rootDir;
          results.runIdA = m.runId;
          runDirA = m.paths.rootDir;
          artifactsDirA = m.paths.artifactsDir;
          sentinelMarkerPath = join(m.paths.artifactsDir, "sentinel-marker.json");
          reservationPidA = m.process.portReserverPid;
          break;
        }
        case "create-b": {
          if (!manifestA) throw new Error("internal: create-b before create-a");
          const m = await createRunContextFn({
            primaryWorktree: input.primaryWorktree,
            commit: input.commit,
            port: input.portB,
            testId: `${input.testId}-b`,
          });
          manifestB = m;
          if (!manifestB.rootDir) manifestB.rootDir = m.paths.rootDir;
          results.runIdB = m.runId;
          runDirB = m.paths.rootDir;
          artifactsDirB = m.paths.artifactsDir;
          reservationPidB = m.process.portReserverPid;
          break;
        }
        case "verify-reservations": {
          if (!runDirA || !runDirB) throw new Error("internal: verify-reservations before create");
          const r = verifyP02Fn(makeVerifyInput(), "reservations");
          if (!r.ok) {
            failedCheck = r.failedChecks[0] || "reservations";
            throw new Error(`reservations verifier failed: ${r.failedChecks.join(", ")}`);
          }
          phaseChecks.reservations = r;
          break;
        }
        case "start-sentinel": {
          if (!manifestA || !sentinelMarkerPath) throw new Error("internal: start-sentinel before create-a");
          const sentinelId = `p02-${input.testId}-${Date.now().toString(36)}`;
          const info = await startSentinelFn(sentinelMarkerPath, sentinelId, manifestA);
          sentinelInfo = info;
          results.sentinelId = sentinelId;
          artifactPath = sentinelMarkerPath;
          break;
        }
        case "start-a": {
          if (!runDirA || !manifestA) throw new Error("internal: start-a before create-a");
          const r: StartRunResult = await startRunProcessesFn(runDirA);
          manifestA = r.manifest;
          if (!manifestA.rootDir) manifestA.rootDir = manifestA.paths.rootDir;
          stageChecks = r.checks;
          // 补全 sentinel marker 的 identity 字段
          if (sentinelInfo) {
            finalizeSentinelMarker(sentinelInfo.markerPath, manifestA);
          }
          break;
        }
        case "start-b": {
          if (!runDirB || !manifestB) throw new Error("internal: start-b before create-b");
          const r = await startRunProcessesFn(runDirB);
          manifestB = r.manifest;
          if (!manifestB.rootDir) manifestB.rootDir = manifestB.paths.rootDir;
          stageChecks = r.checks;
          // 确保 B 的 framework DB 存在（serve 延迟创建；attribution 负向验证需 session_map 表可读）
          ensureFrameworkDbFn(manifestB.paths.frameworkDbPath);
          break;
        }
        case "verify-coexistence": {
          if (!runDirA || !runDirB) throw new Error("internal: verify-coexistence before create");
          const r = verifyP02Fn(makeVerifyInput(), "coexistence");
          if (!r.ok) {
            failedCheck = r.failedChecks[0] || "coexistence";
            throw new Error(`coexistence verifier failed: ${r.failedChecks.join(", ")}`);
          }
          phaseChecks.coexistence = r;
          break;
        }
        case "bootstrap-a": {
          if (!runDirA || !manifestA) throw new Error("internal: bootstrap-a without runDirA");
          const m = await bootstrapRunFn({
            runDir: runDirA,
            rootAgent: "build",
            childAgent: "general",
            allowedPaths: [manifestA.paths.worktreeDir],
            reason: "P0-2 orchestrator",
          });
          manifestA = m;
          if (!manifestA.rootDir) manifestA.rootDir = m.paths.rootDir;
          break;
        }
        case "verify-attribution": {
          if (!runDirA || !runDirB) throw new Error("internal: verify-attribution before create");
          const r = verifyP02Fn(makeVerifyInput(), "attribution");
          if (!r.ok) {
            failedCheck = r.failedChecks[0] || "attribution";
            throw new Error(`attribution verifier failed: ${r.failedChecks.join(", ")}`);
          }
          phaseChecks.attribution = r;
          break;
        }
        case "stop-a": {
          if (!runDirA || !manifestA) throw new Error("internal: stop-a before create-a");
          // 保存 A 停止前的 serve/SSE PID 供 after-stop-a 验证
          stoppedServePidA = manifestA.process.servePid;
          stoppedSsePidA = manifestA.process.ssePid;
          stopped.a = true; // stop-once：调用前即记账，避免 stop 自身 throw 后收敛重复 stop
          const m = await stopRunProcessesFn(runDirA);
          manifestA = m;
          if (!manifestA.rootDir) manifestA.rootDir = m.paths.rootDir;
          break;
        }
        case "verify-after-stop-a": {
          if (!runDirA || !runDirB) throw new Error("internal: verify-after-stop-a before create");
          const r = verifyP02Fn(
            makeVerifyInput({ stoppedServePidA, stoppedSsePidA }),
            "after-stop-a",
          );
          if (!r.ok) {
            failedCheck = r.failedChecks[0] || "after-stop-a";
            throw new Error(`after-stop-a verifier failed: ${r.failedChecks.join(", ")}`);
          }
          phaseChecks["after-stop-a"] = r;
          break;
        }
        case "cleanup-a": {
          if (!runDirA) throw new Error("internal: cleanup-a before create-a");
          const r = await cleanupRunFn(runDirA);
          if (!r.ok) {
            throw new Error(`cleanup-a failed: ${r.stderr || "<no stderr>"}`);
          }
          artifactPath = r.cleanupReportPath;
          // REQ-004: cleanup-a 后验证 B 当前五项仍真（process/health/marker + sentinel alive）
          if (manifestB && sentinelMarkerPath) {
            const obs = observeCleanupBFn(manifestB, sentinelMarkerPath);
            const five = [
              obs.bServeAlive,
              obs.bSseAlive,
              obs.bHealthOk,
              obs.bMarkerReadable,
              obs.sentinelAlive,
            ];
            if (five.some((v) => !v)) {
              failedCheck = "cleanup-a";
              throw new Error("cleanup-a B isolation violated: "
                + `serveAlive=${obs.bServeAlive}, sseAlive=${obs.bSseAlive}, health=${obs.bHealthOk}, `
                + `markerReadable=${obs.bMarkerReadable}, sentinelAlive=${obs.sentinelAlive}`);
            }
          }
          break;
        }
        case "stop-b": {
          if (!runDirB) throw new Error("internal: stop-b before create-b");
          stopped.b = true; // stop-once：调用前即记账，避免 stop 自身 throw 后收敛重复 stop
          const m = await stopRunProcessesFn(runDirB);
          manifestB = m;
          if (!manifestB.rootDir) manifestB.rootDir = m.paths.rootDir;
          break;
        }
        case "cleanup-b": {
          if (!runDirB) throw new Error("internal: cleanup-b before create-b");
          const r = await cleanupRunFn(runDirB);
          if (!r.ok) {
            throw new Error(`cleanup-b failed: ${r.stderr || "<no stderr>"}`);
          }
          artifactPath = r.cleanupReportPath;
          break;
        }
        case "stop-sentinel": {
          // 验证 sentinel identity 后 stop（仅 FOUND）；identity 不匹配时不 stop（不归本 run 所有）
          if (sentinelInfo && validateSentinelIdentityFn(sentinelInfo.pid, sentinelInfo.sentinelId, sentinelInfo.markerPath) === "FOUND") {
            stopped.sentinel = true; // stop-once：调用前即记账，避免 stop 自身 throw 后收敛重复 stop
            await stopSentinelFn(sentinelInfo.pid, sentinelInfo.sentinelId, sentinelInfo.markerPath);
          }
          break;
        }
        case "verify-cleanup": {
          if (!runDirA || !runDirB) throw new Error("internal: verify-cleanup before create");
          const r = verifyP02Fn(makeVerifyInput(), "cleanup");
          if (!r.ok) {
            failedCheck = r.failedChecks[0] || "cleanup";
            throw new Error(`cleanup verifier failed: ${r.failedChecks.join(", ")}`);
          }
          phaseChecks.cleanup = r;
          break;
        }
      }

      const stageResult: P02StageResult = {
        stage,
        startedAt,
        finishedAt: nowFn(),
        status: "ok",
      };
      if (stageChecks) stageResult.checks = stageChecks;
      if (artifactPath) stageResult.artifactPath = artifactPath;
      results.stages.push(stageResult);
      if (artifactsDirA) writeFn(artifactsDirA, results);
      if (artifactsDirB) writeFn(artifactsDirB, results);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      firstFailure = { stage, error: message };
      const stageResult: P02StageResult = {
        stage,
        startedAt,
        finishedAt: nowFn(),
        status: "failed",
        error: message,
      };
      results.stages.push(stageResult);
      if (artifactsDirA) writeFn(artifactsDirA, results);
      if (artifactsDirB) writeFn(artifactsDirB, results);
      break;
    }
  }

  if (firstFailure) {
    // 固定失败收敛：验证 marker + /proc identity 后 stop sentinel；再 stop B、stop A；每对象最多一次；不 cleanup。
    await safeConvergeFailure();
    return {
      ok: false,
      runDirA,
      runDirB,
      failedCheck: failedCheck || firstFailure.stage,
      firstFailure,
      stages: results.stages,
      convergenceErrors,
      evidencePaths: {
        stageResults: artifactsDirA
          ? join(artifactsDirA, "p0-2-stage-results.json")
          : null,
      },
    };
  }

  // 所有 stage 成功
  const allChecks = Object.values(phaseChecks);
  if (allChecks.some((c) => c === null) || !manifestA || !manifestB || !runDirA || !runDirB || !artifactsDirA) {
    throw new Error("internal: stages completed but terminal state missing");
  }

  return {
    ok: true,
    status: "PASS",
    runDirA,
    runDirB,
    checks: {
      reservations: phaseChecks.reservations!,
      coexistence: phaseChecks.coexistence!,
      attribution: phaseChecks.attribution!,
      "after-stop-a": phaseChecks["after-stop-a"]!,
      cleanup: phaseChecks.cleanup!,
    },
    evidencePaths: {
      manifestA: manifestA.paths.manifestPath,
      manifestB: manifestB.paths.manifestPath,
      artifactsDirA,
      stageResults: join(artifactsDirA, "p0-2-stage-results.json"),
    },
  };

  // ====== Internal helpers ======

  function makeVerifyInput(overrides: {
    stoppedServePidA?: number | null;
    stoppedSsePidA?: number | null;
  } = {}): import("./types").P02VerifyInput {
    if (!runDirA || !runDirB || !sentinelMarkerPath) {
      throw new Error("internal: verify input called before prerequisites met");
    }
    return {
      runDirA,
      runDirB,
      mainFrameworkDbPath: input.mainFrameworkDbPath,
      sentinelMarkerPath,
      reservationPidA,
      reservationPidB,
      stoppedServePidA: overrides.stoppedServePidA ?? null,
      stoppedSsePidA: overrides.stoppedSsePidA ?? null,
    };
  }

  async function safeConvergeFailure(): Promise<void> {
    // 固定顺序：sentinel（需 identity 验证）→ B → A；每对象最多一次。
    // 调用前置位 stopped.X，保证 stop 自身 throw 时不再重复调用；
    // 错误捕获到 convergenceErrors，不静默吞掉，保证失败结果可追溯。
    if (!stopped.sentinel && sentinelInfo) {
      stopped.sentinel = true;
      try {
        if (validateSentinelIdentityFn(sentinelInfo.pid, sentinelInfo.sentinelId, sentinelInfo.markerPath) === "FOUND") {
          await stopSentinelFn(sentinelInfo.pid, sentinelInfo.sentinelId, sentinelInfo.markerPath);
        }
      } catch (e) {
        convergenceErrors.push({ object: "sentinel", error: e instanceof Error ? e.message : String(e) });
      }
    }

    if (!stopped.b && runDirB && manifestB) {
      stopped.b = true;
      try {
        await stopRunProcessesFn(runDirB);
      } catch (e) {
        convergenceErrors.push({ object: "b", error: e instanceof Error ? e.message : String(e) });
      }
    }

    if (!stopped.a && runDirA && manifestA) {
      stopped.a = true;
      try {
        await stopRunProcessesFn(runDirA);
      } catch (e) {
        convergenceErrors.push({ object: "a", error: e instanceof Error ? e.message : String(e) });
      }
    }
    // 不调用 cleanupRun
  }
}

function validateInput(input: P02Input): void {
  if (!input || typeof input !== "object") throw new Error("input is required");
  if (!input.primaryWorktree || typeof input.primaryWorktree !== "string" || !isAbsolute(input.primaryWorktree)) {
    throw new Error("primaryWorktree is required and must be an absolute path");
  }
  if (!input.mainFrameworkDbPath || typeof input.mainFrameworkDbPath !== "string" || !isAbsolute(input.mainFrameworkDbPath)) {
    throw new Error("mainFrameworkDbPath is required and must be an absolute path");
  }
  if (!input.commit || typeof input.commit !== "string") throw new Error("commit is required");
  if (!Number.isInteger(input.portA) || input.portA < 1024 || input.portA > 65535) {
    throw new Error(`invalid portA: ${input.portA}`);
  }
  if (!Number.isInteger(input.portB) || input.portB < 1024 || input.portB > 65535) {
    throw new Error(`invalid portB: ${input.portB}`);
  }
  if (input.portA === input.portB) throw new Error("portA and portB must differ");
  if (!input.testId || typeof input.testId !== "string") throw new Error("testId is required");
}

function defaultWriteStageResults(artifactsDir: string, payload: P02StageResultsFile): void {
  mkdirSync(artifactsDir, { recursive: true });
  const target = join(artifactsDir, "p0-2-stage-results.json");
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, JSON.stringify(payload, null, 2) + "\n");
  renameSync(tmp, target);
}

// 默认 cleanup-a B 观测：检查 B 的 serve/sse 存活、health 可达、sentinel marker 可读且 sentinel 存活。
function defaultObserveCleanupB(runB: RunManifest, sentinelMarkerPath: string): P02CleanupBObservation {
  const serveAlive = runB.process.servePid != null && isPidAlive(runB.process.servePid);
  const sseAlive = runB.process.ssePid != null && isPidAlive(runB.process.ssePid);
  // health 检查：serve 存活且能 reach health endpoint（同 process.ts canReachHealth）
  let healthOk = false;
  if (serveAlive) {
    try {
      const result = Bun.spawnSync(["curl", "-fsS", "--max-time", "2", `http://127.0.0.1:${runB.port}/session`], {
        stdout: "ignore",
        stderr: "ignore",
      });
      healthOk = result.exitCode === 0;
    } catch {
      healthOk = false;
    }
  }
  // B marker readable: sse-ready 文件存在且有效（通过 existsSync 快速检查）
  const bMarkerReadable = existsSync(runB.paths.sseReadyPath);
  // sentinel alive: marker 文件存在且 pid 存活
  let sentinelAlive = false;
  try {
    if (existsSync(sentinelMarkerPath)) {
      const marker = JSON.parse(readFileSync(sentinelMarkerPath, "utf8")) as { pid?: number };
      sentinelAlive = marker.pid != null && isPidAlive(marker.pid);
    }
  } catch {
    sentinelAlive = false;
  }
  return { bServeAlive: serveAlive, bSseAlive: sseAlive, bHealthOk: healthOk, bMarkerReadable, sentinelAlive };
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// 确保 framework DB 存在并含 session_map 表（serve 延迟创建 DB，attribution 负向验证需表可读）。
function ensureFrameworkDb(dbPath: string): void {
  if (existsSync(dbPath)) return;
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath, { create: true });
  try {
    db.run(`CREATE TABLE IF NOT EXISTS session_map (
      session_id TEXT PRIMARY KEY,
      agent TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      dag_task_id TEXT DEFAULT NULL,
      domain_id TEXT DEFAULT NULL,
      model_id TEXT DEFAULT NULL,
      parent_id TEXT DEFAULT ''
    )`);
  } finally {
    db.close();
  }
}
