// cleanup.ts — cleanupRun 提取模块（PHASE-06a）
//
// 从 isolated-serve.ts 提取 cleanupRun 到独立模块，打破
// isolated-serve ↔ p02-orchestrator / p01b-orchestrator 的循环依赖。
// 逻辑与原始内联版本逐行一致（行为等价，REQ-003），仅移动位置、不改行为。

import { existsSync, rmSync, writeFileSync } from "node:fs";
import {
  archiveFrameworkLogs,
  readRunManifest,
  setRunState,
  writeRunManifest,
} from "./run-context";
import type { GitWorktreeRemoveSpawnResult, CleanupResult } from "./types";

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
  if (manifest.status !== "BLOCKED") {
    setRunState(manifest, "BLOCKED");
  }
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
