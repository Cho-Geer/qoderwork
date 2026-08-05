import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runP01b, type P01bStageResultsFile } from "../p01b-orchestrator";
import { readRunManifest } from "../run-context";

const WORK_ONE = "${WORK_ONE_ROOT}";

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  }).toString();
}


describe("P0-1B runtime integration", () => {
  test(
    "real isolated serve completes create → start → bootstrap → execute-plan → verify-runtime → stop → cleanup → verify-cleanup",
    async () => {
      const port = Number(process.env.P0_1B_PORT);
      if (!port || port < 1024 || port > 65535) {
        throw new Error("P0_1B_PORT environment variable must be set to a valid port");
      }

      const commit = git(["rev-parse", "HEAD"], WORK_ONE).trim();

      const result = await runP01b({
        primaryWorktree: WORK_ONE,
        commit,
        port,
        testId: "P0-1B-RUNTIME-TEST",
      });

      // 1. overall outcome
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.status).toBe("PASS");
        expect(result.runDir).toBeTruthy();

        // 2. runtime checks passed
        expect(result.checks.runtime.ok).toBe(true);
        expect(result.checks.runtime.failedChecks).toHaveLength(0);

        // 3. cleanup checks passed
        expect(result.checks.cleanup.ok).toBe(true);
        expect(result.checks.cleanup.failedChecks).toHaveLength(0);

        // 4. stage results file exists and contains all stages
        const stageResultsPath = `${result.evidencePaths.artifactsDir}/p0-1b-stage-results.json`;
        expect(existsSync(stageResultsPath)).toBe(true);
        const stageResults = JSON.parse(readFileSync(stageResultsPath, "utf8")) as P01bStageResultsFile;
        expect(stageResults.runId).toBeTruthy();
        expect(stageResults.stages).toHaveLength(8);
        for (const stage of stageResults.stages) {
          expect(stage.status).toBe("ok");
        }

        // 5. manifest is CLEANED and worktree removed, evidence root retained
        const manifest = readRunManifest(result.runDir);
        expect(manifest.status).toBe("CLEANED");
        expect(existsSync(manifest.paths.worktreeDir)).toBe(false);
        expect(existsSync(manifest.paths.rootDir)).toBe(true);
        expect(existsSync(manifest.paths.manifestPath)).toBe(true);
        expect(existsSync(manifest.paths.cleanupReportPath)).toBe(true);
      }
    },
    { timeout: 300_000 },
  );
});
