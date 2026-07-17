// P0-1B 单进程编排器
//
// 按 plan §6.5.1 的固定要求，在一个进程内按顺序执行：
//   create → start → bootstrap → execute(plan) → verify(runtime) → stop → cleanup → verify(cleanup)
//
// 设计约束（来自 plan §6.5.1）：
//   1. input 仅允许 primaryWorktree / commit / port / testId
//   2. dependencies 覆盖 7 个核心 service，使 unit test 不启动真实进程
//   3. stages 是常量数组，循环外不得有可跳过阶段的条件分支
//   4. 每个成功阶段后原子覆盖 ${artifactsDir}/p0-1b-stage-results.json
//   5. 任一阶段 throw 或 verifier 返回 ok:false 即记录 firstFailure
//      并停止后续业务阶段；若 PID identity 可验证则尝试一次受控 stop
//   6. 失败：{ ok:false, runDir, firstFailure, evidencePaths }
//      成功：{ ok:true, status:"PASS", runDir, checks:{runtime,cleanup}, evidencePaths }
//
// 禁止：spawn / Bun.$ / shell 字符串 / 递归调用 CLI / 重试 / 跳过阶段

import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bootstrapRun } from "./bootstrap";
import { executeRun } from "./execute";
import { cleanupRun } from "./isolated-serve";
import { createRunContext } from "./run-context";
import { startRunProcesses, stopRunProcesses } from "./process";
import { verifyP01b } from "./verify-p01b";
import type {
  BootstrapInput,
  CleanupResult,
  CreateRunInput,
  ExecuteInput,
  P01bVerificationPhase,
  P01bVerificationResult,
  RunManifest,
  StartChecks,
  StartRunResult,
} from "./types";

export const P01B_STAGES = [
  "create",
  "start",
  "bootstrap",
  "execute-plan",
  "verify-runtime",
  "stop",
  "cleanup",
  "verify-cleanup",
] as const;

export type P01bStageName = (typeof P01B_STAGES)[number];

export interface P01bInput {
  primaryWorktree: string;
  commit: string;
  port: number;
  testId: string;
}

export interface P01bStageResult {
  stage: P01bStageName;
  startedAt: string;
  finishedAt: string;
  status: "ok" | "failed";
  artifactPath?: string;
  error?: string;
}

export interface P01bStageResultsFile {
  runId: string | null;
  stages: P01bStageResult[];
}

export type ExecuteResult = { outcome: "EXECUTED" | "NOT-RUN"; artifactPath: string };

export interface P01bDependencies {
  createRunContext: (input: CreateRunInput) => Promise<RunManifest>;
  startRunProcesses: (runDir: string) => Promise<StartRunResult>;
  bootstrapRun: (input: BootstrapInput) => Promise<RunManifest>;
  executeRun: (input: ExecuteInput) => Promise<ExecuteResult>;
  verifyP01b: (runDir: string, phase: P01bVerificationPhase) => P01bVerificationResult;
  stopRunProcesses: (runDir: string) => Promise<RunManifest>;
  cleanupRun: (runDir: string) => Promise<CleanupResult>;
  /** 默认使用 /proc 检查 PID 存活。测试可注入以控制 controlled stop 决策。 */
  validateRunProcess?: (pid: number | null, runId: string, commandFragment: string) => boolean;
  /** 默认原子写 ${artifactsDir}/p0-1b-stage-results.json。测试可注入以记录调用。 */
  writeStageResults?: (artifactsDir: string, payload: P01bStageResultsFile) => void;
  /** 默认 new Date().toISOString()。测试可注入以固定时间。 */
  now?: () => string;
}

export type P01bResult =
  | {
      ok: true;
      status: "PASS";
      runDir: string;
      checks: { runtime: P01bVerificationResult; cleanup: P01bVerificationResult };
      evidencePaths: {
        manifest: string;
        cleanupReport: string;
        artifactsDir: string;
        stageResults: string;
      };
    }
  | {
      ok: false;
      runDir: string | null;
      firstFailure: { stage: P01bStageName; error: string };
      evidencePaths: { stageResults: string | null };
    };

export async function runP01b(
  input: P01bInput,
  dependencies: P01bDependencies,
): Promise<P01bResult> {
  validateInput(input);

  const nowFn = dependencies.now ?? (() => new Date().toISOString());
  const writeFn = dependencies.writeStageResults ?? defaultWriteStageResults;
  const validateFn = dependencies.validateRunProcess ?? defaultValidateRunProcess;

  const results: P01bStageResultsFile = { runId: null, stages: [] };
  let artifactsDir: string | null = null;
  let runDir: string | null = null;
  let currentManifest: RunManifest | null = null;
  let firstFailure: { stage: P01bStageName; error: string } | null = null;
  let runtimeChecks: P01bVerificationResult | null = null;
  let cleanupChecks: P01bVerificationResult | null = null;

  for (const stage of P01B_STAGES) {
    if (firstFailure) break;

    const startedAt = nowFn();
    let artifactPath: string | undefined;

    try {
      switch (stage) {
        case "create": {
          const manifest = await dependencies.createRunContext({
            primaryWorktree: input.primaryWorktree,
            commit: input.commit,
            port: input.port,
            testId: input.testId,
          });
          currentManifest = manifest;
          results.runId = manifest.runId;
          runDir = manifest.paths.rootDir;
          artifactsDir = manifest.paths.artifactsDir;
          break;
        }
        case "start": {
          if (!runDir) throw new Error("internal: start before create");
          const result = await dependencies.startRunProcesses(runDir);
          currentManifest = result.manifest;
          break;
        }
        case "bootstrap": {
          if (!runDir || !currentManifest) {
            throw new Error("internal: bootstrap without runDir/manifest");
          }
          const manifest = await dependencies.bootstrapRun({
            runDir,
            rootAgent: "build",
            childAgent: "general",
            allowedPaths: [currentManifest.paths.worktreeDir],
            reason: "P0-1B orchestrator",
          });
          currentManifest = manifest;
          break;
        }
        case "execute-plan": {
          if (!runDir) throw new Error("internal: execute-plan before create");
          const r = await dependencies.executeRun({
            runDir,
            mode: "plan",
            runnerArgs: [],
          });
          artifactPath = r.artifactPath;
          break;
        }
        case "verify-runtime": {
          if (!runDir) throw new Error("internal: verify-runtime before create");
          const r = dependencies.verifyP01b(runDir, "runtime");
          if (!r.ok) {
            throw new Error(`runtime verifier failed: ${r.failedChecks.join(", ")}`);
          }
          runtimeChecks = r;
          break;
        }
        case "stop": {
          if (!runDir) throw new Error("internal: stop before create");
          const manifest = await dependencies.stopRunProcesses(runDir);
          currentManifest = manifest;
          break;
        }
        case "cleanup": {
          if (!runDir) throw new Error("internal: cleanup before create");
          const r = await dependencies.cleanupRun(runDir);
          if (!r.ok) {
            throw new Error(`cleanup failed: ${r.stderr || "<no stderr>"}`);
          }
          artifactPath = r.cleanupReportPath;
          break;
        }
        case "verify-cleanup": {
          if (!runDir) throw new Error("internal: verify-cleanup before create");
          const r = dependencies.verifyP01b(runDir, "cleanup");
          if (!r.ok) {
            throw new Error(`cleanup verifier failed: ${r.failedChecks.join(", ")}`);
          }
          cleanupChecks = r;
          break;
        }
      }

      const stageResult: P01bStageResult = {
        stage,
        startedAt,
        finishedAt: nowFn(),
        status: "ok",
      };
      if (artifactPath) stageResult.artifactPath = artifactPath;
      results.stages.push(stageResult);

      if (artifactsDir) {
        writeFn(artifactsDir, results);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      firstFailure = { stage, error: message };
      const stageResult: P01bStageResult = {
        stage,
        startedAt,
        finishedAt: nowFn(),
        status: "failed",
        error: message,
      };
      results.stages.push(stageResult);
      if (artifactsDir) {
        writeFn(artifactsDir, results);
      }
      break;
    }
  }

  if (firstFailure) {
    // §6.5.1 #5: 唯一受控 stop — 仅在 manifest 存在且 PID identity 可验证时尝试一次。
    // 失败必须被吞掉：不得修改 manifest 状态，不得重试。
    if (
      runDir
      && currentManifest
      && canVerifyRunProcesses(currentManifest, validateFn)
    ) {
      try {
        await dependencies.stopRunProcesses(runDir);
      } catch {
        // swallow; manifest not modified
      }
    }
    return {
      ok: false,
      runDir,
      firstFailure,
      evidencePaths: {
        stageResults: artifactsDir
          ? `${artifactsDir}/p0-1b-stage-results.json`
          : null,
      },
    };
  }

  if (!runtimeChecks || !cleanupChecks || !currentManifest || !runDir || !artifactsDir) {
    // 不应发生：stages 已全部成功却缺终态字段。
    throw new Error("internal: stages completed but terminal state missing");
  }

  return {
    ok: true,
    status: "PASS",
    runDir,
    checks: { runtime: runtimeChecks, cleanup: cleanupChecks },
    evidencePaths: {
      manifest: currentManifest.paths.manifestPath,
      cleanupReport: currentManifest.paths.cleanupReportPath,
      artifactsDir,
      stageResults: `${artifactsDir}/p0-1b-stage-results.json`,
    },
  };
}

function validateInput(input: P01bInput): void {
  if (!input || typeof input !== "object") {
    throw new Error("input is required");
  }
  if (!input.primaryWorktree || typeof input.primaryWorktree !== "string") {
    throw new Error("primaryWorktree is required");
  }
  if (!input.commit || typeof input.commit !== "string") {
    throw new Error("commit is required");
  }
  if (!Number.isInteger(input.port) || input.port < 1024 || input.port > 65535) {
    throw new Error(`invalid port: ${input.port}`);
  }
  if (!input.testId || typeof input.testId !== "string") {
    throw new Error("testId is required");
  }
}

function canVerifyRunProcesses(
  manifest: RunManifest,
  validate: (pid: number | null, runId: string, commandFragment: string) => boolean,
): boolean {
  return (
    (manifest.process.servePid !== null && validate(manifest.process.servePid, manifest.runId, "serve"))
    || (manifest.process.ssePid !== null && validate(manifest.process.ssePid, manifest.runId, "sse-daemon.ts"))
  );
}

function defaultWriteStageResults(artifactsDir: string, payload: P01bStageResultsFile): void {
  // 防御性：createRunContext 应已创建该目录，但默认实现不依赖于此。
  mkdirSync(artifactsDir, { recursive: true });
  const target = join(artifactsDir, "p0-1b-stage-results.json");
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, JSON.stringify(payload, null, 2) + "\n");
  renameSync(tmp, target);
}

function defaultValidateRunProcess(
  pid: number | null,
  _runId: string,
  _commandFragment: string,
): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Re-exports for type ergonomics in tests/CLI consumers
export type { StartChecks, StartRunResult, P01bVerificationPhase, P01bVerificationResult, RunManifest };
