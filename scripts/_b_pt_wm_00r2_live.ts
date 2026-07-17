#!/usr/bin/env bun
/**
 * _b_pt_wm_00r2_live.ts — Deprecated shim over test-serve
 *
 * 唯一职责：保留旧入口名，但实际生命周期全部转交 `scripts/test-serve/isolated-serve.ts`。
 * 禁止再在这里维护固定端口、mkdtemp、主 work-one、固定临时 SSE 文件等旧逻辑。
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getDefaultPrimaryWorktree, getStateRoot, readRunManifest } from "./test-serve/run-context";

const CLI = "/home/zhaoge/workspace/qoderwork/scripts/test-serve/isolated-serve.ts";

main();

function main(): void {
  const args = process.argv.slice(2);
  const runDir = getFlagValue("--run-dir");

  if (args.includes("--stop")) {
    const targetRunDir = runDir || findLatestRunDir();
    if (!targetRunDir) {
      throw new Error("no PT-WM-00R2 run found; pass --run-dir explicitly");
    }
    runCli(["stop", "--run-dir", targetRunDir]);
    return;
  }

  if (runDir) {
    runCli(["start", "--run-dir", runDir]);
    return;
  }

  const commit = git(["rev-parse", "HEAD"], getDefaultPrimaryWorktree()).trim();
  const create = runCliJson([
    "create",
    "--commit",
    commit,
    "--port",
    requiredCreatePort(),
    "--test-id",
    "PT-WM-00R2-LIVE",
    "--primary-worktree",
    getDefaultPrimaryWorktree(),
  ]);
  runCli(["start", "--run-dir", create.runDir]);
  console.log(`[PT-WM-00R2-live] runDir=${create.runDir}`);
  console.log(`[PT-WM-00R2-live] Verified-by: test-serve create/start → manifest=${join(create.runDir, "manifest.json")}`);
}

function findLatestRunDir(): string | null {
  const root = getStateRoot();
  if (!existsSync(root)) return null;
  const candidates = readdirSync(root)
    .map((entry) => join(root, entry))
    .filter((dir) => existsSync(join(dir, "manifest.json")))
    .map((dir) => ({ dir, manifest: readRunManifest(dir) }))
    .filter((item) => item.manifest.testId === "PT-WM-00R2-LIVE")
    .sort((a, b) => a.manifest.createdAt.localeCompare(b.manifest.createdAt));
  return candidates.at(-1)?.dir || null;
}

function runCli(args: string[]): void {
  const result = spawnSync(process.execPath, ["run", CLI, ...args], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runCliJson(args: string[]): { runDir: string } {
  const result = spawnSync(process.execPath, ["run", CLI, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || "");
    process.exit(result.status ?? 1);
  }
  process.stdout.write(result.stdout || "");
  return JSON.parse(result.stdout || "{}") as { runDir: string };
}

function git(args: string[], cwd: string): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || "git command failed");
  }
  return result.stdout;
}

function getFlagValue(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function requiredCreatePort(): string {
  const port = getFlagValue("--port");
  if (!port) {
    throw new Error("create path requires explicit --port <port>");
  }
  return port;
}
