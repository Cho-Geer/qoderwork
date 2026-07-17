#!/usr/bin/env bun
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { bootstrapRun } from "./bootstrap";
import { executeRun } from "./execute";
import {
  archiveFrameworkLogs,
  createRunContext,
  getDefaultPrimaryWorktree,
  readRunManifest,
  setRunState,
  snapshotSourceOverlay,
  writeRunManifest,
} from "./run-context";
import { inspectRunProcesses, startRunProcesses, stopRunProcesses } from "./process";
import { runP01b } from "./p01b-orchestrator";
import { verifyP01b } from "./verify-p01b";
import type { P01bVerificationPhase, GitWorktreeRemoveSpawnResult, CleanupResult } from "./types";


type Command = "snapshot-source" | "create" | "start" | "status" | "bootstrap" | "execute" | "stop" | "cleanup" | "verify" | "p0-1b" | "help";

const command = (process.argv[2] || "help") as Command;
const args = process.argv.slice(3);

if (import.meta.main) {
  main().catch((error) => {
    console.error(`[test-serve] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}

async function main(): Promise<void> {
  switch (command) {
    case "snapshot-source": {
      const primaryWorktree = getArg("--from") || getDefaultPrimaryWorktree();
      const outputDir = requiredArg("--output");
      const overlay = snapshotSourceOverlay({
        primaryWorktree,
        outputDir,
        allowDirtySource: hasFlag("--allow-dirty-source"),
      });
      console.log(JSON.stringify(overlay, null, 2));
      return;
    }
    case "create": {
      const manifest =  await createRunContext({
        primaryWorktree: getArg("--primary-worktree") || getDefaultPrimaryWorktree(),
        commit: requiredArg("--commit"),
        port: Number(requiredArg("--port")),
        testId: requiredArg("--test-id"),
        sourceOverlayDir: getArg("--source-overlay"),
      });
      console.log(JSON.stringify({ runDir: manifest.paths.rootDir, manifest: manifest.paths.manifestPath }, null, 2));
      return;
    }
    case "start": {
      const result = await startRunProcesses(requiredArg("--run-dir"));
      console.log(JSON.stringify({
        runId: result.manifest.runId,
        status: result.manifest.status,
        checks: result.checks,
      }, null, 2));
      return;
    }
    case "status": {
      console.log(JSON.stringify(inspectRunProcesses(requiredArg("--run-dir")), null, 2));
      return;
    }
    case "bootstrap": {
      const manifest = await bootstrapRun({
        runDir: requiredArg("--run-dir"),
        rootAgent: getArg("--root-agent") || "build",
        childAgent: requiredArg("--child-agent"),
        allowedPaths: requiredArg("--allowed-paths").split(",").map((value) => resolve(value)),
        reason: getArg("--reason") || "isolated test bootstrap",
      });
      console.log(JSON.stringify({ runId: manifest.runId, grantId: manifest.grantId }, null, 2));
      return;
    }
    case "execute": {
      const result = await executeRun({
        runDir: requiredArg("--run-dir"),
        mode: (getArg("--mode") as "plan" | "live") || "plan",
        runnerScript: getArg("--runner"),
        runnerArgs: collectTailArgs("--"),
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "stop": {
      const manifest = await stopRunProcesses(requiredArg("--run-dir"));
      console.log(JSON.stringify({ runId: manifest.runId, status: manifest.status }, null, 2));
      return;
    }
    case "cleanup": {
      const runDir = requiredArg("--run-dir");
      const result = await cleanupRun(runDir);
      if (result.ok) {
        console.log(
          JSON.stringify(
            {
              runId: result.runId,
              status: "CLEANED",
              evidenceRoot: result.evidenceRoot,
              manifestPath: result.manifestPath,
              cleanupReportPath: result.cleanupReportPath,
              artifactsDir: result.artifactsDir,
            },
            null,
            2,
          ),
        );
      } else {
        console.error(JSON.stringify(
            {
              runId: result.runId,
              status: "BLOCKED",
              exitCode: result.exitCode,
              stderr: result.stderr,
              evidenceRoot: result.evidenceRoot,
              manifestPath: result.manifestPath,
              cleanupReportPath: result.cleanupReportPath,
              artifactsDir: result.artifactsDir,
            }, null, 2));
        process.exit(1);
      }
      return;
    }
    case "verify": {
      const result = verifyP01b(
        requiredArg("--run-dir"),
        requiredArg("--phase") as P01bVerificationPhase,
      );
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) {
        process.exit(1);
      }
      return;
    }
    case "p0-1b": {
      const result = await runP01b({
        primaryWorktree: requiredArg("--primary-worktree"),
        commit: requiredArg("--commit"),
        port: Number(requiredArg("--port")),
        testId: requiredArg("--test-id"),
      }, {
        createRunContext,
        startRunProcesses,
        bootstrapRun,
        executeRun,
        verifyP01b,
        stopRunProcesses,
        cleanupRun,
      });
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) {
        process.exit(1);
      }
      return;
    }
    case "help":
    default:
      printHelp();
  }
}

export async function cleanupRun(
  runDir: string,
  opts?: {
    spawnGitWorktreeRemove?: () => GitWorktreeRemoveSpawnResult,
    removeWorktreeDir?: (dirPath: string) => void
   },
): Promise<CleanupResult> {
  const manifest = readRunManifest(runDir);
  if (manifest.status !== "STOPPED") {
    // 精确例外：bootstrap 失败后的 BLOCKED run，无进程残留时可清理
    const isBlockedBootstrapFailure =
      manifest.status === "BLOCKED" &&
      manifest.bootstrapComplete === false &&
      manifest.process.servePid === null &&
      manifest.process.ssePid === null &&
      manifest.process.portReserverPid === null &&
      !existsSync(manifest.paths.servePidPath) &&
      !existsSync(manifest.paths.ssePidPath);
    if (!isBlockedBootstrapFailure) {
      throw new Error("cleanup requires STOPPED state");
    }
  }

  const archivedLogs = archiveFrameworkLogs(manifest.paths.worktreeDir, manifest.paths.artifactsDir);
  const evidence = {
    evidenceRoot: manifest.paths.rootDir,
    manifestPath: manifest.paths.manifestPath,
    cleanupReportPath: manifest.paths.cleanupReportPath,
    artifactsDir: manifest.paths.artifactsDir,
  };

  // git worktree remove 的返回值是唯一裁决点；默认走 Bun.spawnSync，允许测试注入。
  const spawner = opts?.spawnGitWorktreeRemove ?? (() => {
    const proc = Bun.spawnSync(["git", "worktree", "remove", "--force", manifest.paths.worktreeDir], {
      cwd: manifest.primaryWorktree,
      stderr: "pipe",
      stdout: "pipe",
    });
    return {
      exitCode: proc.exitCode ?? -1,
      stdout: proc.stdout ? new TextDecoder().decode(proc.stdout).trimEnd() : "",
      stderr: proc.stderr ? new TextDecoder().decode(proc.stderr).trimEnd() : "",
    } satisfies GitWorktreeRemoveSpawnResult;
  });

  let spawnResult: GitWorktreeRemoveSpawnResult;
  try {
    spawnResult = spawner();
  } catch (error) {
    // spawn 本身抛出（例如 git 二进制不存在、cwd 不存在等）视作失败。
    spawnResult = {
      exitCode: -1,
      stdout: "",
      stderr: `spawn failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const cleanedAt = new Date().toISOString();
  const worktreeRoot = manifest.paths.worktreeDir;
  // ---- Phase 1：执行所有清理动作，先不写任何终态 ----
  let rmError: string | null = null;
  if (spawnResult.exitCode === 0 && existsSync(worktreeRoot)) {
    // git worktree remove 成功后通常已删目录；rmSync 是清理残留（未跟踪文件、空目录等）的最后一道关。
    const remover = opts?.removeWorktreeDir ?? ((p: string) => rmSync(p, { recursive: true, force: true }));
    try {
      remover(worktreeRoot);
    } catch (error) {
      rmError = `local worktree rm failed after git worktree remove succeeded: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  const worktreeRemoved = !existsSync(manifest.paths.worktreeDir);
  const reportBase = {
    schemaVersion: 1,
    runId: manifest.runId,
    cleanedAt,
    ...evidence,
    worktreeDir: manifest.paths.worktreeDir,
    worktreeRemoved,
    archivedLogs,
  };

  // ---- Phase 2：终态裁决：git remove 和本地 rm 都成功才 CLEANED；任一失败都 BLOCKED ----
  const notes: string[] = [];
  if (archivedLogs) {
    notes.push(`framework logs archived to ${archivedLogs}`);
  }

  if (spawnResult.exitCode === 0 && rmError === null) {
    // ----- 成功路径：两个动作都完成 -----
    writeFileSync(
      manifest.paths.cleanupReportPath,
      JSON.stringify({ ...reportBase, success: true }, null, 2 ) + "\n");
    manifest.cleanup.status = "completed";
    manifest.cleanup.notes.push(...notes);
    setRunState(manifest, "CLEANED");
    return { ok: true, runId: manifest.runId, archivedLogs, ...evidence };;
  }

  // ----- 失败路径 (fail-closed)：git 失败 / rm 失败都走这里，保留现场 -----
  const gitFailed = spawnResult.exitCode !== 0;
  const failureReason = gitFailed
    ? `git worktree remove failed (exitCode=${spawnResult.exitCode}): ${spawnResult.stderr || "<no stderr>"}`
    : (rmError ?? "unknown cleanup failure");
  notes.push(failureReason);

  writeFileSync(
    manifest.paths.cleanupReportPath,
    JSON.stringify({
          ...reportBase,
          success: false,
          stage: gitFailed ? "git-worktree-remove" : "local-rm",
          exitCode: spawnResult.exitCode,
          command: ["git", "worktree", "remove", "--force", manifest.paths.worktreeDir],
          cwd: manifest.primaryWorktree,
          stdout: spawnResult.stdout,
          stderr: spawnResult.stderr,
          rmError}, null, 2) + "\n");
  manifest.cleanup.status = "blocked";
  manifest.cleanup.notes.push(...notes);
  writeRunManifest(manifest);
  setRunState(manifest, "BLOCKED");
  // 保留现场：不删 worktree/ 目录，不写 CLEANED。
  return {
    ok: false,
    runId: manifest.runId,
    exitCode: gitFailed ? spawnResult.exitCode : -2,
    stderr: gitFailed ? spawnResult.stderr : (rmError ?? ""),
    stdout: spawnResult.stdout,
    archivedLogs,
    ...evidence,
  };
}

function requiredArg(flag: string): string {
  const value = getArg(flag);
  if (!value) throw new Error(`missing required arg ${flag}`);
  return value;
}

function getArg(flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

function collectTailArgs(separator: string): string[] {
  const index = args.indexOf(separator);
  return index >= 0 ? args.slice(index + 1) : [];
}

function printHelp(): void {
  console.log(`Usage: test-serve <command> [options]

Commands:
  test-serve snapshot-source --from <primary-worktree> --output <overlay-dir> [--allow-dirty-source]
  test-serve create --commit <sha> --port <port> --test-id <id> [--primary-worktree <dir>] [--source-overlay <dir>]
  test-serve start --run-dir <run-dir>
  test-serve status --run-dir <run-dir>
  test-serve bootstrap --run-dir <run-dir> --root-agent <agent> --child-agent <agent> --allowed-paths <abs-path[,abs-path...]>
  test-serve execute --run-dir <run-dir> [--mode plan|live] [--runner <script>] [-- <runner args>]
  test-serve stop --run-dir <run-dir>
  test-serve cleanup --run-dir <run-dir>
  test-serve verify --run-dir <run-dir> --phase runtime|cleanup
  test-serve p0-1b --primary-worktree <dir> --commit <sha> --port <port> --test-id <id>`);
}
