import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";

let tempRoot = "";

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "create-failure-cleanup-"));
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("create failure cleanup regression", () => {
  test("createRunContext removes worktree when applySourceOverlay fails", async () => {
    const repo = createRepo();
    const commit = git(["rev-parse", "HEAD"], repo).trim();
    
    const overlayDir = join(tempRoot, "bad-overlay");
    mkdirSync(overlayDir, { recursive: true });
    writeFileSync(join(overlayDir, "tracked.patch"), "invalid patch content");
    writeFileSync(join(overlayDir, "untracked.tar"), "");
    writeFileSync(
      join(overlayDir, "source-manifest.json"),
      JSON.stringify({
        createdAt: new Date().toISOString(),
        sourceCommit: commit,
        sourceStatusPorcelainZ: "",
        patchSha256: "f264616511370c020c9fa48fd445305d61202ea05beeb75943081008768803d7",
        tarSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        untrackedFiles: [],
      }, null, 2)
    );
    
    const { createRunContext, readRunManifest } = await import("../run-context");
    
    await expect(
      createRunContext({
        primaryWorktree: repo,
        commit,
        port: 39101,
        testId: "TSI-CLEANUP-01",
        sourceOverlayDir: overlayDir,
      })
    ).rejects.toThrow();
    
    const stateRoot = process.env.XDG_STATE_HOME 
      ? join(process.env.XDG_STATE_HOME, "qoderwork", "test-runs")
      : join(homedir(), ".local", "state", "qoderwork", "test-runs");
    
    if (existsSync(stateRoot)) {
      const runs = readdirSync(stateRoot).filter(name => name.includes("TSI-CLEANUP-01"));
      
      for (const runId of runs) {
        const runDir = join(stateRoot, runId);
        const manifest = readRunManifest(runDir);
        
        expect(manifest.status).toBe("BLOCKED");
        expect(existsSync(manifest.paths.worktreeDir)).toBe(false);
        
        const worktreeList = git(["worktree", "list"], repo);
        expect(worktreeList).not.toContain(manifest.paths.worktreeDir);
      }
    }
  });
  
  test("createRunContext cleans up port reservation on failure", async () => {
    const repo = createRepo();
    const commit = git(["rev-parse", "HEAD"], repo).trim();
    const port = 39102;
    
    const overlayDir = join(tempRoot, "bad-overlay-2");
    mkdirSync(overlayDir, { recursive: true });
    writeFileSync(join(overlayDir, "tracked.patch"), "");
    writeFileSync(join(overlayDir, "untracked.tar"), "");
    writeFileSync(
      join(overlayDir, "source-manifest.json"),
      JSON.stringify({
        createdAt: new Date().toISOString(),
        sourceCommit: commit,
        sourceStatusPorcelainZ: "",
        patchSha256: "wrong",
        tarSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        untrackedFiles: [],
      }, null, 2)
    );
    
    const { createRunContext } = await import("../run-context");
    
    await expect(
      createRunContext({
        primaryWorktree: repo,
        commit,
        port,
        testId: "TSI-CLEANUP-02",
        sourceOverlayDir: overlayDir,
      })
    ).rejects.toThrow();
    
    await new Promise(r => setTimeout(r, 500));
    
    const isPortFree = await new Promise<boolean>((resolve) => {
      const socket = require("net").connect({ host: "127.0.0.1", port }, () => {
        socket.end();
        resolve(false);
      });
      socket.on("error", () => resolve(true));
      socket.setTimeout(500, () => {
        socket.destroy();
        resolve(true);
      });
    });
    
    expect(isPortFree).toBe(true);
  });

  test("persists BLOCKED and retains the worktree when port reserver release fails", async () => {
    const repo = createRepo();
    const commit = git(["rev-parse", "HEAD"], repo).trim();
    const overlayDir = join(tempRoot, "release-failure-overlay");
    mkdirSync(overlayDir, { recursive: true });
    writeFileSync(join(overlayDir, "tracked.patch"), "invalid patch content");
    writeFileSync(join(overlayDir, "untracked.tar"), "");
    writeFileSync(join(overlayDir, "source-manifest.json"), JSON.stringify({
      createdAt: new Date().toISOString(),
      sourceCommit: commit,
      sourceStatusPorcelainZ: "",
      patchSha256: "f264616511370c020c9fa48fd445305d61202ea05beeb75943081008768803d7",
      tarSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      untrackedFiles: [],
    }, null, 2));

    const { createRunContext, readRunManifest, releasePortReservation } = await import("../run-context");
    const testId = `TSI-CLEANUP-RELEASE-FAIL-${Date.now()}`;
    const stateRoot = process.env.XDG_STATE_HOME
      ? join(process.env.XDG_STATE_HOME, "qoderwork", "test-runs")
      : join(homedir(), ".local", "state", "qoderwork", "test-runs");
    let capturedPid: number | null = null;
    let runDir: string | null = null;

    try {
      let rejection = "";
      try {
        await createRunContext({
          primaryWorktree: repo,
          commit,
          port: 39103,
          testId,
          sourceOverlayDir: overlayDir,
        }, {
          releasePortReservation: async (pid) => {
            capturedPid = pid;
            throw new Error("simulated reserver still alive");
          },
        });
      } catch (error) {
        rejection = error instanceof Error ? error.message : String(error);
      }
      expect(rejection).toContain("create failed:");
      expect(rejection).toContain("port reserver release failed: simulated reserver still alive");
      expect(capturedPid).not.toBeNull();

      const matches = readdirSync(stateRoot).filter((name) => name.includes(testId.toLowerCase()));
      expect(matches).toHaveLength(1);
      runDir = join(stateRoot, matches[0]!);
      const manifest = readRunManifest(runDir);
      expect(manifest.status).toBe("BLOCKED");
      expect(manifest.process.portReserverPid).toBe(capturedPid);
      expect(manifest.cleanup.notes.some((note) => note.startsWith("create failed:"))).toBe(true);
      expect(manifest.cleanup.notes.some((note) => note.includes("port reserver release failed: simulated reserver still alive"))).toBe(true);
      expect(existsSync(manifest.paths.worktreeDir)).toBe(true);
    } finally {
      if (capturedPid !== null) await releasePortReservation(capturedPid);
      if (runDir && existsSync(runDir)) {
        const manifest = readRunManifest(runDir);
        try { git(["worktree", "remove", "--force", manifest.paths.worktreeDir], repo); } catch {}
        rmSync(runDir, { recursive: true, force: true });
      }
    }
  });
});

function createRepo(): string {
  const repo = join(tempRoot, "repo");
  execFileSync("git", ["init", repo], { stdio: "pipe" });
  git(["config", "user.email", "test@example.com"], repo);
  git(["config", "user.name", "Test"], repo);
  writeFileSync(join(repo, "tracked.txt"), "base\n");
  git(["add", "."], repo);
  git(["commit", "-m", "init"], repo);
  return repo;
}

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).toString();
}
