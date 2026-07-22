import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";
import {
  createRunContext,
  getStateRoot,
  readRunManifest,
  releasePortReservation,
  setRunState,
  snapshotSourceOverlay,
  spawnPortReserver,
  validateSourceOverlay,
} from "../run-context";
import { startRunProcesses } from "../process";
import { CreateRunHooks } from "../types";

let tempRoot = "";

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "test-serve-run-context-"));
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("run-context", () => {
  test("writes manifest and prepares detached worktree", async () => {
    const repo = createRepo();
    const commit = git(["rev-parse", "HEAD"], repo).trim();
    const manifest = await createRunContext({
      primaryWorktree: repo,
      commit,
      port: 39001,
      testId: "TSI-01",
    });

    expect(manifest.status).toBe("WORKTREE_READY");
    expect(existsSync(manifest.paths.worktreeDir)).toBe(true);
    expect(readRunManifest(manifest.paths.rootDir).commit).toBe(commit);

    await releasePortReservation(manifest.process.portReserverPid as number);
  });

  test("create fails with clear message when port is already in use", async () => {
    const repo = createRepo();
    const commit = git(["rev-parse", "HEAD"], repo).trim();
    const port = 39002;

    // Occupy the port externally first.
    const blocker = net.createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(port, "127.0.0.1", () => resolve());
    });

    try {
      await expect(
        createRunContext({
          primaryWorktree: repo,
          commit,
          port,
          testId: "TSI-EADDRINUSE",
        })
      ).rejects.toThrow(`port already in use: ${port}`);
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });

  test("spawnPortReserver holds the port until released", async () => {
    const port = 39003;

    // Probe: port should be free before reservation.
    expect(await isPortListening(port)).toBe(false);

    const pid = await spawnPortReserver(port);
    try {
      expect(await isPortListening(port)).toBe(true);
    } finally {
      await releasePortReservation(pid);
    }

    // After release, port should be free again (give the OS a brief moment).
    await new Promise((r) => setTimeout(r, 200));
    expect(await isPortListening(port)).toBe(false);
  });

  test("STOPPED -> start fails BLOCKED when port was stolen while stopped", async () => {
    const repo = createRepo();
    const commit = git(["rev-parse", "HEAD"], repo).trim();
    const port = 39004;

    // 1) Create the run (reserves port, leaves manifest in WORKTREE_READY).
    const manifest = await createRunContext({
      primaryWorktree: repo,
      commit,
      port,
      testId: "TSI-RESTART-RACE",
    });
    await releasePortReservation(manifest.process.portReserverPid as number);

    // 2) Simulate the post-stop state: no reservation, no serve/sse, status=STOPPED.
    // Walk the legal lifecycle to reach STOPPED.
    manifest.process.portReserverPid = null;
    manifest.process.servePid = null;
    manifest.process.ssePid = null;
    setRunState(manifest, "READY");
    setRunState(manifest, "BOOTSTRAPPED");
    setRunState(manifest, "EXECUTED");
    setRunState(manifest, "STOPPED");

    // 3) Steal the port externally.
    const blocker = net.createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(port, "127.0.0.1", () => resolve());
    });

    try {
      // 4) startRunProcesses must fail-closed BEFORE spawning serve.
      await expect(startRunProcesses(manifest.paths.rootDir)).rejects.toThrow(`port already in use: ${port}`);

      // 5) Manifest must be BLOCKED, not READY.
      const reloaded = readRunManifest(manifest.paths.rootDir);
      expect(reloaded.status).toBe("BLOCKED");
      expect(reloaded.cleanup.notes.join(" ")).toContain("restart blocked");
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });

  test("snapshot-source captures tracked and untracked overlay", () => {
    const repo = createRepo();
    writeFileSync(join(repo, "tracked.txt"), "changed\n");
    writeFileSync(join(repo, "new.txt"), "untracked\n");
    const overlayDir = join(tempRoot, "overlay");
    const overlay = snapshotSourceOverlay({
      primaryWorktree: repo,
      outputDir: overlayDir,
      allowDirtySource: true,
    });
    const validated = validateSourceOverlay(overlay.dir);
    expect(validated.patchSha256).toBe(overlay.patchSha256);
    expect(existsSync(validated.tarPath)).toBe(true);
  });

  test("snapshot-source rejects dirty source without explicit allow flag", () => {
    const repo = createRepo();
    writeFileSync(join(repo, "tracked.txt"), "changed\n");
    expect(() =>
      snapshotSourceOverlay({
        primaryWorktree: repo,
        outputDir: join(tempRoot, "overlay-no-allow"),
      }),
    ).toThrow("dirty source requires explicit --allow-dirty-source");
  });

  test("rejects denied overlay paths", () => {
    const repo = createRepo();
    writeFileSync(join(repo, ".env"), "SECRET=1\n");
    const overlayDir = join(tempRoot, "overlay");
    expect(() =>
      snapshotSourceOverlay({
        primaryWorktree: repo,
        outputDir: overlayDir,
        allowDirtySource: true,
      }),
    ).toThrow("overlay path denied");
  });

  test("overlay validation rejects tar content drift", () => {
    const repo = createRepo();
    writeFileSync(join(repo, "new.txt"), "untracked\n");
    const overlayDir = join(tempRoot, "overlay-drift");
    const overlay = snapshotSourceOverlay({
      primaryWorktree: repo,
      outputDir: overlayDir,
      allowDirtySource: true,
    });
    execFileSync("tar", ["-cf", overlay.tarPath, "--files-from", "/dev/null"], { stdio: "pipe" });
    expect(() => validateSourceOverlay(overlayDir)).toThrow("overlay tar sha256 mismatch");
  });

  test("create failure after worktree add removes partial worktree and marks BLOCKED (TSI-02)", async () => {
    const repo = createRepo();
    const commit = git(["rev-parse", "HEAD"], repo).trim();
    const port = 39010;

    const injectedMsg = "injected mid-create failure for TSI-02";
    let capturedPaths: { worktreeDir: string; rootDir: string } | null = null;
    const hooks: CreateRunHooks = {
      afterWorktreeReady: (paths) => {
        capturedPaths = { worktreeDir: paths.worktreeDir, rootDir: paths.rootDir };
        throw new Error(injectedMsg);
      },
    };

    await expect(
      createRunContext(
        { primaryWorktree: repo, commit, port, testId: "TSI-02-FAIL-CLEANUP" },
        hooks,
      ),
    ).rejects.toThrow(injectedMsg);

    // 必须回收：worktreeDir 不应残留
    expect(capturedPaths).not.toBeNull();
    expect(existsSync(capturedPaths!.worktreeDir)).toBe(false);

    // manifest 必须被写成 BLOCKED，记录失败原因
    const after = readRunManifest(capturedPaths!.rootDir);
    expect(after.status).toBe("BLOCKED");
    expect(after.cleanup.notes.some((n) => n.includes(injectedMsg))).toBe(true);

    // git worktree list 不应残留这条 worktree
    const list = git(["worktree", "list", "--porcelain"], repo);
    expect(list.includes(capturedPaths!.worktreeDir)).toBe(false);
  });

  test("legal state sequence writes expected manifest status (P03-S-01)", async () => {
    const repo = createRepo();
    const commit = git(["rev-parse", "HEAD"], repo).trim();
    const manifest = await createRunContext({
      primaryWorktree: repo,
      commit,
      port: 39020,
      testId: "P03-S-01",
    });
    expect(manifest.status).toBe("WORKTREE_READY");

    setRunState(manifest, "READY");
    expect(readRunManifest(manifest.paths.rootDir).status).toBe("READY");

    setRunState(manifest, "BOOTSTRAPPED");
    setRunState(manifest, "EXECUTED");
    setRunState(manifest, "STOPPED");
    setRunState(manifest, "CLEANED");
    expect(readRunManifest(manifest.paths.rootDir).status).toBe("CLEANED");

    await releasePortReservation(manifest.process.portReserverPid as number);
  });

  test("terminal or backward transition throws before write (P03-S-02)", async () => {
    const repo = createRepo();
    const commit = git(["rev-parse", "HEAD"], repo).trim();
    const manifest = await createRunContext({
      primaryWorktree: repo,
      commit,
      port: 39021,
      testId: "P03-S-02",
    });

    // Walk to CLEANED (terminal)
    setRunState(manifest, "READY");
    setRunState(manifest, "BOOTSTRAPPED");
    setRunState(manifest, "EXECUTED");
    setRunState(manifest, "STOPPED");
    setRunState(manifest, "CLEANED");

    // Terminal -> active must throw
    expect(() => setRunState(manifest, "READY")).toThrow("illegal run state transition: CLEANED -> READY");
    // Manifest retains prior status
    expect(readRunManifest(manifest.paths.rootDir).status).toBe("CLEANED");

    // Backward transition must throw
    const manifest2 = await createRunContext({
      primaryWorktree: repo,
      commit,
      port: 39022,
      testId: "P03-S-02-backward",
    });
    setRunState(manifest2, "READY");
    expect(() => setRunState(manifest2, "WORKTREE_READY")).toThrow("illegal run state transition: READY -> WORKTREE_READY");
    expect(readRunManifest(manifest2.paths.rootDir).status).toBe("READY");

    await releasePortReservation(manifest.process.portReserverPid as number);
    await releasePortReservation(manifest2.process.portReserverPid as number);
  });

  test("pre-created root rejects before reservation (P03-S-03)", async () => {
    const repo = createRepo();
    const commit = git(["rev-parse", "HEAD"], repo).trim();

    // Clean up any leftover run root from previous test runs (deterministic ID)
    const leftoverRoot = join(getStateRoot(), "deterministic-run-id-p03-s03");
    rmSync(leftoverRoot, { recursive: true, force: true });

    // First create succeeds
    const manifest1 = await createRunContext({
      primaryWorktree: repo,
      commit,
      port: 39023,
      testId: "P03-S-03",
    }, {
      makeRunId: () => "deterministic-run-id-p03-s03",
    });
    expect(manifest1.status).toBe("WORKTREE_READY");

    // Second create with same run ID must throw before port reservation
    await expect(
      createRunContext({
        primaryWorktree: repo,
        commit,
        port: 39024,
        testId: "P03-S-03-dup",
      }, {
        makeRunId: () => "deterministic-run-id-p03-s03",
      })
    ).rejects.toThrow("run id already exists: deterministic-run-id-p03-s03");

    await releasePortReservation(manifest1.process.portReserverPid as number);
  });

  test("manifest has port, patchSha256, and absolute paths (P03-S-04)", async () => {
    const repo = createRepo();
    const commit = git(["rev-parse", "HEAD"], repo).trim();
    const manifest = await createRunContext({
      primaryWorktree: repo,
      commit,
      port: 39025,
      testId: "P03-S-04",
    });

    expect(typeof manifest.port).toBe("number");
    expect(manifest.port).toBe(39025);
    // All path fields must be absolute
    expect(manifest.paths.rootDir.startsWith("/")).toBe(true);
    expect(manifest.paths.manifestPath.startsWith("/")).toBe(true);
    expect(manifest.paths.worktreeDir.startsWith("/")).toBe(true);
    expect(manifest.paths.frameworkDbPath.startsWith("/")).toBe(true);
    expect(manifest.paths.opencodeDbPath.startsWith("/")).toBe(true);

    await releasePortReservation(manifest.process.portReserverPid as number);
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

async function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}
