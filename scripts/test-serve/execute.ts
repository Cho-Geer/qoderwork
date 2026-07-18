import { openSync } from "node:fs";
import { spawn } from "node:child_process";
import { readRunManifest, setRunState } from "./run-context";
import type { ExecuteInput, RunManifest } from "./types";

export async function executeRun(input: ExecuteInput): Promise<{
  outcome: "EXECUTED" | "NOT-RUN";
  artifactPath: string;
}> {
  const manifest = readRunManifest(input.runDir);
  const artifactPath = input.mode === "plan"
    ? `${manifest.paths.artifactsDir}/plan-result.json`
    : `${manifest.paths.artifactsDir}/execute-${Date.now()}.json`;
  if (input.mode === "plan") {
    await Bun.write(
      artifactPath,
      JSON.stringify(
        {
          runId: manifest.runId,
          mode: input.mode,
          status: "NOT-RUN",
          reason: "plan mode only writes artifact and never spawns runner",
        },
        null,
        2,
      ) + "\n",
    );
    return { outcome: "NOT-RUN", artifactPath };
  }
  const gatingFailure =
    process.env.H2_AUTHORIZED !== "true" ||
    process.env.DRY_RUN !== "false" ||
    !manifest.bootstrapComplete ||
    !["READY", "BOOTSTRAPPED"].includes(manifest.status);

  if (gatingFailure || !input.runnerScript) {
    await Bun.write(
      artifactPath,
      JSON.stringify(
        {
          runId: manifest.runId,
          mode: input.mode,
          status: "NOT-RUN",
          reason: gatingFailure
            ? "missing H2_AUTHORIZED=true, DRY_RUN=false, READY/BOOTSTRAPPED state or bootstrap_complete"
            : "runner script omitted",
        },
        null,
        2,
      ) + "\n",
    );
    return { outcome: "NOT-RUN", artifactPath };
  }

  const outputFd = openSync(artifactPath, "a");
  const child = spawn(
    process.execPath,
    ["run", input.runnerScript, "--run-dir", manifest.paths.rootDir, ...input.runnerArgs],
    {
      cwd: manifest.paths.worktreeDir,
      env: { ...process.env, ...manifest.env },
      stdio: ["ignore", outputFd, outputFd],
    },
  );

  const exitCode: number = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
  if (exitCode !== 0) {
    throw new Error(`runner failed with exit code ${exitCode}`);
  }
  setRunState(manifest, "EXECUTED");
  return { outcome: "EXECUTED", artifactPath };
}
