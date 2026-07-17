import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "bun:sqlite";
import { cleanupRun } from "../isolated-serve";
import { createRunContext, readRunManifest, releasePortReservation, setRunState } from "../run-context";

let tempRepo = "";
let tempCleanupRoot = "";

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  }).toString();
}

function createRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "p01a-repo-"));
  git(["init"], repo);
  git(["config", "user.email", "test@example.com"], repo);
  git(["config", "user.name", "Test"], repo);
  writeFileSync(join(repo, "initial.txt"), "initial content\n");
  git(["add", "."], repo);
  git(["commit", "-m", "initial"], repo);
  return repo;
}

function seedEvidence(paths: ReturnType<typeof createRunContext extends (...args: any[]) => Promise<infer R> ? () => R : never>["paths"], worktreeDir: string): void {
  mkdirSync(join(paths.dbDir), { recursive: true });
  const fwDb = new Database(paths.frameworkDbPath);
  fwDb.run("CREATE TABLE test_seed (id INTEGER PRIMARY KEY, label TEXT)");
  fwDb.run("INSERT INTO test_seed VALUES (1, 'framework-seed')");
  fwDb.close();

  const ocDb = new Database(paths.opencodeDbPath);
  ocDb.run("CREATE TABLE test_seed (id INTEGER PRIMARY KEY, label TEXT)");
  ocDb.run("INSERT INTO test_seed VALUES (1, 'opencode-seed')");
  ocDb.close();

  mkdirSync(paths.logsDir, { recursive: true });
  writeFileSync(paths.serveLogPath, "serve log line\n");
  writeFileSync(paths.sseLogPath, "sse log line\n");

  mkdirSync(paths.eventsDir, { recursive: true });
  writeFileSync(paths.eventFilePath, '{"event":"test"}\n');

  mkdirSync(paths.artifactsDir, { recursive: true });
  writeFileSync(join(paths.artifactsDir, "runtime-evidence.json"), '{"retained":true}\n');

  const taskLogs = join(worktreeDir, ".task_temp", "_logs");
  mkdirSync(taskLogs, { recursive: true });
  writeFileSync(join(taskLogs, "trace.log"), "framework trace line\n");
}

describe("cleanup integration", () => {
  test("integration: real git cleanup removes only worktree and retains evidence bundle", async () => {
    const repo = createRepo();
    const commit = git(["rev-parse", "HEAD"], repo).trim();

    const manifest = await createRunContext({
      primaryWorktree: repo,
      commit,
      port: 39111,
      testId: "P0-1A-CLEANUP",
    });

    await releasePortReservation(manifest.process.portReserverPid as number);
    manifest.process.portReserverPid = null;
    setRunState(manifest, "STOPPED");

    seedEvidence(manifest.paths, manifest.paths.worktreeDir);


    const result = await cleanupRun(manifest.paths.rootDir);

    // ---- A. cleanup 成功裁决 ----
    expect(result.ok).toBe(true);
    const after = readRunManifest(manifest.paths.rootDir);
    expect(after.status).toBe("CLEANED");
    expect(result.evidenceRoot).toBe(manifest.paths.rootDir);

    const report = JSON.parse(
      readFileSync(manifest.paths.cleanupReportPath, "utf8"),
    ) as { success: boolean; worktreeRemoved: boolean; evidenceRoot: string };
    expect(report.success).toBe(true);
    expect(report.worktreeRemoved).toBe(true);
    expect(report.evidenceRoot).toBe(manifest.paths.rootDir);

    // ---- B. 真实 Git worktree 已移除 ----
    expect(existsSync(manifest.paths.worktreeDir)).toBe(false);
    const worktreeList = git(["worktree", "list", "--porcelain"], repo);
    expect(worktreeList).not.toContain(manifest.paths.worktreeDir);

    // ---- C. evidence bundle 仍然存在且可读 ----
    expect(existsSync(manifest.paths.rootDir)).toBe(true);
    expect(existsSync(manifest.paths.manifestPath)).toBe(true);
    expect(existsSync(manifest.paths.cleanupReportPath)).toBe(true);
    expect(existsSync(manifest.paths.frameworkDbPath)).toBe(true);
    expect(existsSync(manifest.paths.opencodeDbPath)).toBe(true);
    expect(existsSync(manifest.paths.serveLogPath)).toBe(true);
    expect(existsSync(manifest.paths.sseLogPath)).toBe(true);
    expect(existsSync(manifest.paths.eventFilePath)).toBe(true);
    expect(existsSync(manifest.paths.artifactsDir)).toBe(true);
    expect(existsSync(join(manifest.paths.artifactsDir, "framework-logs", "trace.log"))).toBe(true);
    expect(existsSync(join(manifest.paths.artifactsDir, "runtime-evidence.json"))).toBe(true);

    // DB 可读且 seed 数据完整
    const fwRead = new Database(manifest.paths.frameworkDbPath, { readonly: true });
    const fwRow = fwRead.query("SELECT label FROM test_seed WHERE id = 1").get() as { label: string } | null;
    fwRead.close();
    expect(fwRow?.label).toBe("framework-seed");

    const ocRead = new Database(manifest.paths.opencodeDbPath, { readonly: true });
    const ocRow = ocRead.query("SELECT label FROM test_seed WHERE id = 1").get() as { label: string } | null;
    ocRead.close();
    expect(ocRow?.label).toBe("opencode-seed");

    // ---- D. 重复读取不改状态 ----
    const manifestMtimeAfterFirstRead = statSync(manifest.paths.manifestPath).mtimeMs;
    const reportMtimeAfterFirstRead = statSync(manifest.paths.cleanupReportPath).mtimeMs;

    const after2 = readRunManifest(manifest.paths.rootDir);
    expect(after2.status).toBe("CLEANED");

    const report2 = JSON.parse(readFileSync(manifest.paths.cleanupReportPath, "utf8"));
    expect(report2).toEqual(report);

    const manifestMtimeAfterSecondRead = statSync(manifest.paths.manifestPath).mtimeMs;
    const reportMtimeAfterSecondRead = statSync(manifest.paths.cleanupReportPath).mtimeMs;
    expect(manifestMtimeAfterSecondRead).toBe(manifestMtimeAfterFirstRead);
    expect(reportMtimeAfterSecondRead).toBe(reportMtimeAfterFirstRead);

    // DB 重复读取
    const fwRead2 = new Database(manifest.paths.frameworkDbPath, { readonly: true });
    const fwRow2 = fwRead2.query("SELECT label FROM test_seed WHERE id = 1").get() as { label: string } | null;
    fwRead2.close();
    expect(fwRow2?.label).toBe("framework-seed");

    // cleanup: remove temp repo
    rmSync(repo, { recursive: true, force: true });
  });
});