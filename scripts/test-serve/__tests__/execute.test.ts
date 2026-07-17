import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeRun } from "../execute";
import { writeRunManifest } from "../run-context";
import type { RunManifest } from "../types";

let tempRoot = "";

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "test-serve-execute-"));
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("execute gating", () => {
  test("plan mode never spawns runner", async () => {
    const manifest = makeManifest();
    const result = await executeRun({
      runDir: tempRoot,
      mode: "plan",
      runnerScript: "/definitely/not/run.ts",
      runnerArgs: [],
    });
    expect(result.outcome).toBe("NOT-RUN");
    const payload = JSON.parse(await Bun.file(result.artifactPath).text()) as { reason: string };
    expect(payload.reason).toContain("plan mode");
  });

  test("live mode blocks when bootstrap is incomplete", async () => {
    const manifest = makeManifest();
    manifest.bootstrapComplete = false;
    writeRunManifest(manifest);
    const result = await executeRun({
      runDir: tempRoot,
      mode: "live",
      runnerScript: "/definitely/not/run.ts",
      runnerArgs: [],
    });
    expect(result.outcome).toBe("NOT-RUN");
  });
});

function makeManifest(): RunManifest {
  const manifest: RunManifest = {
    runId: "execute-test",
    testId: "TSI-05",
    status: "BOOTSTRAPPED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    primaryWorktree: tempRoot,
    commit: "HEAD",
    port: 39998,
    paths: {
      rootDir: tempRoot,
      manifestPath: join(tempRoot, "manifest.json"),
      worktreeDir: join(tempRoot, "worktree"),
      dbDir: join(tempRoot, "db"),
      frameworkDbPath: join(tempRoot, "db", "framework-state.db"),
      opencodeDbPath: join(tempRoot, "db", "opencode.db"),
      logsDir: join(tempRoot, "logs"),
      frameworkLogDir: join(tempRoot, "logs", "framework"),
      serveLogPath: join(tempRoot, "logs", "serve.log"),
      sseLogPath: join(tempRoot, "logs", "sse.log"),
      eventsDir: join(tempRoot, "events"),
      eventFilePath: join(tempRoot, "events", "events.jsonl"),
      sseReadyPath: join(tempRoot, "events", "sse-ready.json"),
      archiveDir: join(tempRoot, "events", "archive"),
      pidsDir: join(tempRoot, "pids"),
      servePidPath: join(tempRoot, "pids", "serve.pid"),
      ssePidPath: join(tempRoot, "pids", "sse.pid"),
      artifactsDir: join(tempRoot, "artifacts"),
      cleanupReportPath: join(tempRoot, "cleanup-report.json"),
    },
    env: {},
    sourceOverlay: null,
    sourceStatusPorcelainZ: null,
    rootSessionId: null,
    childSessionId: null,
    grantId: null,
    dispatchKey: null,
    allowedPaths: [],
    bootstrapComplete: true,
    authorization: { h2Authorized: false, dryRun: true },
    process: { servePid: null, ssePid: null, portReserverPid: null },
    cleanup: { status: "pending", notes: [] },
  };
  writeRunManifest(manifest);
  return manifest;
}
