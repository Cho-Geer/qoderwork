import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupRun } from "../isolated-serve";
import { readRunManifest } from "../run-context";
import type { RunManifest, RunPaths } from "../types";

let tempRoot = "";

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "test-serve-cleanup-"));
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("cleanupRun", () => {
  test("fail-closed: when git worktree remove exits non-zero, status=BLOCKED, report has stderr, worktree preserved", async () => {
    const runId = "cleanup-fail-test";
    const rootDir = join(tempRoot, runId);
    const worktreeDir = join(rootDir, "worktree");
    const artifactsDir = join(rootDir, "artifacts");

    // 构造最小 run 目录骨架（不创建真实 git worktree，spawn 会被注入替换）
    mkdirSync(worktreeDir, { recursive: true });
    mkdirSync(artifactsDir, { recursive: true });

    const paths: RunPaths = {
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
      artifactsDir,
      cleanupReportPath: join(rootDir, "cleanup-report.json"),
    };

    // 在 worktree 里放一个哨兵文件，验证"保留现场"真的保住了目录内容
    const sentinel = join(worktreeDir, "sentinel.txt");
    writeFileSync(sentinel, "do-not-delete\n");

    // primaryWorktree 指向一个不存在的路径也没关系——因为 spawn 被注入，git 不会真的被调用
    const manifest: RunManifest = {
      runId,
      testId: "cleanup-fail-closed",
      status: "STOPPED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      primaryWorktree: join(tempRoot, "does-not-need-to-exist"),
      commit: "0000000000000000000000000000000000000000",
      port: 39099,
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
      process: { servePid: null, ssePid: null, portReserverPid: null },
      cleanup: { status: "pending", notes: [] },
    };
    writeFileSync(paths.manifestPath, JSON.stringify(manifest, null, 2) + "\n");

    const fakeStderr = "fatal: failed to remove worktree: simulated failure";
    const result = await cleanupRun(rootDir, {
      spawnGitWorktreeRemove: () => ({
        exitCode: 128,
        stdout: "",
        stderr: fakeStderr,
      }),
    });

    // 1) 返回值标记失败
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.exitCode).toBe(128);
      expect(result.stderr).toBe(fakeStderr);
    }

    // 2) manifest 状态是 BLOCKED，不是 CLEANED
    const after = readRunManifest(rootDir);
    expect(after.status).toBe("BLOCKED");
    expect(after.cleanup.status).toBe("blocked");
    expect(after.cleanup.notes.some((n) => n.includes("git worktree remove failed"))).toBe(true);

    // 3) cleanup-report.json 记录了失败细节
    const report = JSON.parse(await Bun.file(paths.cleanupReportPath).text()) as {
      worktreeRemoved: boolean, 
      evidenceRoot: string, 
      success: boolean, 
      exitCode: number, 
      stderr: string, 
      stdout: string };

    expect(report.success).toBe(false);
    expect(report.exitCode).toBe(128);
    expect(report.stderr).toBe(fakeStderr);
    expect(report.evidenceRoot).toBe(rootDir);
    expect(report.worktreeRemoved).toBe(false);

    // 4) 现场保留：worktree 目录和哨兵文件都还在
    expect(existsSync(worktreeDir)).toBe(true);
    expect(existsSync(sentinel)).toBe(true);
    expect(existsSync(rootDir)).toBe(true);
    expect(existsSync(paths.manifestPath)).toBe(true);
    expect(existsSync(paths.cleanupReportPath)).toBe(true);
    expect(result.evidenceRoot).toBe(rootDir);
  });

  test("success path: when git worktree remove exits 0, status=CLEANED, worktree removed", async () => {
    const runId = "cleanup-ok-test";
    const rootDir = join(tempRoot, runId);
    const worktreeDir = join(rootDir, "worktree");
    const artifactsDir = join(rootDir, "artifacts");

    mkdirSync(worktreeDir, { recursive: true });
    mkdirSync(artifactsDir, { recursive: true });
    const retainedArtifact = join(artifactsDir, "runtime-evidence.json");
    writeFileSync(retainedArtifact, '{"retained":true}\n');

    const paths: RunPaths = {
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
      artifactsDir,
      cleanupReportPath: join(rootDir, "cleanup-report.json"),
    };
    writeFileSync(join(worktreeDir, "sentinel.txt"), "should-be-cleaned\n");

    const manifest: RunManifest = {
      runId,
      testId: "cleanup-success",
      status: "STOPPED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      primaryWorktree: join(tempRoot, "does-not-need-to-exist"),
      commit: "0000000000000000000000000000000000000000",
      port: 39098,
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
      process: { servePid: null, ssePid: null, portReserverPid: null },
      cleanup: { status: "pending", notes: [] },
    };
    writeFileSync(paths.manifestPath, JSON.stringify(manifest, null, 2) + "\n");

    const result = await cleanupRun(rootDir, {
      spawnGitWorktreeRemove: () => ({ exitCode: 0, stdout: "", stderr: "" }),
    });

    // 成功路径
    expect(result.ok).toBe(true);
    const after = readRunManifest(rootDir);
    expect(after.status).toBe("CLEANED");
    expect(after.cleanup.status).toBe("completed");

    const report = JSON.parse(
      await Bun.file(paths.cleanupReportPath).text(),
    ) as {
      success: boolean;
      evidenceRoot: string;
      manifestPath: string;
      cleanupReportPath: string;
      artifactsDir: string;
      worktreeDir: string;
      worktreeRemoved: boolean;
    };

    expect(report.success).toBe(true);
    expect(report.evidenceRoot).toBe(rootDir);
    expect(report.manifestPath).toBe(paths.manifestPath);
    expect(report.cleanupReportPath).toBe(paths.cleanupReportPath);
    expect(report.artifactsDir).toBe(paths.artifactsDir);
    expect(report.worktreeDir).toBe(paths.worktreeDir);
    expect(report.worktreeRemoved).toBe(true);

    // 成功后 worktree 应被删除（fail-closed 的对称断言）
    expect(existsSync(worktreeDir)).toBe(false);
    expect(existsSync(rootDir)).toBe(true);
    expect(existsSync(paths.manifestPath)).toBe(true);
    expect(existsSync(paths.cleanupReportPath)).toBe(true);
    expect(existsSync(paths.artifactsDir)).toBe(true);
    expect(existsSync(retainedArtifact)).toBe(true);
    expect(result.evidenceRoot).toBe(rootDir);
    expect(result.manifestPath).toBe(paths.manifestPath);
    expect(result.cleanupReportPath).toBe(paths.cleanupReportPath);
    expect(result.artifactsDir).toBe(paths.artifactsDir);
  });

  test("rejects cleanup when manifest is not in STOPPED state", async () => {
    const runId = "cleanup-bad-state";
    const rootDir = join(tempRoot, runId);
    mkdirSync(rootDir, { recursive: true });

    const paths: RunPaths = {
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

    const manifest: RunManifest = {
      runId,
      testId: "cleanup-bad-state",
      status: "READY", // 故意不是 STOPPED
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      primaryWorktree: tempRoot,
      commit: "0000000000000000000000000000000000000000",
      port: 39097,
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
      process: { servePid: null, ssePid: null, portReserverPid: null },
      cleanup: { status: "pending", notes: [] },
    };
    writeFileSync(paths.manifestPath, JSON.stringify(manifest, null, 2) + "\n");

    await expect(cleanupRun(rootDir)).rejects.toThrow("cleanup requires STOPPED state");
  });

  test("fail-closed: when git worktree remove succeeds but local rm fails, status=BLOCKED with stage=local-rm", async () => {
    const runId = "cleanup-local-rm-fail";
    const rootDir = join(tempRoot, runId);
    const worktreeDir = join(rootDir, "worktree");
    const artifactsDir = join(rootDir, "artifacts");

    mkdirSync(worktreeDir, { recursive: true });
    mkdirSync(artifactsDir, { recursive: true });
    const sentinel = join(worktreeDir, "sentinel.txt");
    writeFileSync(sentinel, "preserve-me\n");

    const paths: RunPaths = {
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
      artifactsDir,
      cleanupReportPath: join(rootDir, "cleanup-report.json"),
    };

    const manifest: RunManifest = {
      runId,
      testId: "cleanup-local-rm-fail",
      status: "STOPPED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      primaryWorktree: join(tempRoot, "does-not-need-to-exist"),
      commit: "0000000000000000000000000000000000000000",
      port: 39096,
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
      process: { servePid: null, ssePid: null, portReserverPid: null },
      cleanup: { status: "pending", notes: [] },
    };
    writeFileSync(paths.manifestPath, JSON.stringify(manifest, null, 2) + "\n");

    // git 成功（exitCode=0），但本地 rm 抛错
    const rmFailMsg = "simulated local rm failure: EBUSY";
    const result = await cleanupRun(rootDir, {
      spawnGitWorktreeRemove: () => ({ exitCode: 0, stdout: "", stderr: "" }),
      removeWorktreeDir: () => {
        throw new Error(rmFailMsg);
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.exitCode).toBe(-2);
      expect(result.stderr).toContain("simulated local rm failure");
    }

    const after = readRunManifest(rootDir);
    expect(after.status).toBe("BLOCKED");
    expect(after.cleanup.status).toBe("blocked");
    expect(after.cleanup.notes.some((n) => n.includes("local worktree rm failed"))).toBe(true);

    const report = JSON.parse(
      await Bun.file(paths.cleanupReportPath).text(),
    ) as {
      worktreeRemoved: boolean,
      evidenceRoot: string,
      success: boolean, 
      stage: string, 
      rmError: string, 
      exitCode: number };
      
    expect(report.success).toBe(false);
    expect(report.stage).toBe("local-rm");
    expect(report.exitCode).toBe(0); // git 那步是成功的
    expect(report.rmError).toContain(rmFailMsg);
    expect(report.evidenceRoot).toBe(rootDir);
    expect(report.worktreeRemoved).toBe(false);

    // 现场保留
    expect(existsSync(worktreeDir)).toBe(true);
    expect(existsSync(sentinel)).toBe(true);
    expect(existsSync(rootDir)).toBe(true);
    expect(existsSync(paths.manifestPath)).toBe(true);
    expect(existsSync(paths.cleanupReportPath)).toBe(true);
    expect(result.evidenceRoot).toBe(rootDir);
  });
});