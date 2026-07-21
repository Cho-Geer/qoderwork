#!/usr/bin/env bun
import { resolve } from "node:path";
import { bootstrapRun } from "./bootstrap";
import { cleanupRun } from "./cleanup";
import { executeRun } from "./execute";
import {
  createRunContext,
  getDefaultPrimaryWorktree,
  snapshotSourceOverlay,
} from "./run-context";
import { inspectRunProcesses, startRunProcesses, stopRunProcesses } from "./process";
import { runP01b } from "./p01b-orchestrator";
import { verifyP01b } from "./verify-p01b";
import type { P01bVerificationPhase } from "./types";


type Command = "snapshot-source" | "create" | "start" | "status" | "bootstrap" | "execute" | "stop" | "cleanup" | "verify" | "p0-1b" | "help";

const command = (process.argv[2] || "help") as Command;
const args = process.argv.slice(3);

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

export { cleanupRun } from "./cleanup";

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

// PHASE-06a: import.meta.main 移到文件末尾，确保其在所有模块级 const 初始化之后执行，
// 修复恢复 p0-2 路由（PHASE-04）后 P02_KNOWN_FLAGS 的 TDZ 风险。
if (import.meta.main) {
  main().catch((error) => {
    console.error(`[test-serve] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
