// P0-2 双 run 确定性隔离 runtime test（PHASE-05）
//
// 真实调用 runP02（不 mock 任何生产生命周期），验证：
//   REQ-001: 真实 worktree/DB/serve/SSE → A/B manifests 可读
//   REQ-002: 16 stage 与 verifier checks → ok:true, status:"PASS"
//   REQ-003: 证据位于 persistent state root → DB/log/event/report 可读
//
// 环境变量：
//   P0_2_PORT_A / P0_2_PORT_B — reviewer 提供的两个不同未占用端口（≥1024）
//   XDG_STATE_HOME — 持久状态根（默认 ${HOME}/.local/state/qoderwork）
//
// 失败时保留 run 目录，不 cleanup/retry。

import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runP02 } from "../p02-orchestrator";
import { P02_STAGES } from "../types";
import type { P02StageResultsFile } from "../types";
import { readRunManifest } from "../run-context";

const WORK_ONE = "${WORK_ONE_ROOT}";
const MAIN_FRAMEWORK_DB = join(WORK_ONE, ".opencode/state/framework-state.db");

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  }).toString().trim();
}

function requirePort(name: string): number {
  const raw = process.env[name];
  if (!raw) throw new Error(`${name} environment variable must be set`);
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`${name} must be an integer in [1024, 65535], got: ${raw}`);
  }
  return port;
}

describe("P0-2 dual-run runtime isolation (PHASE-05)", () => {
  test(
    "real runP02 completes 16 stages with A/B isolation evidence",
    async () => {
      // --- 前置验证 ---
      const portA = requirePort("P0_2_PORT_A");
      const portB = requirePort("P0_2_PORT_B");
      if (portA === portB) throw new Error("P0_2_PORT_A and P0_2_PORT_B must differ");
      if (!existsSync(MAIN_FRAMEWORK_DB)) {
        throw new Error(`mainFrameworkDbPath not found: ${MAIN_FRAMEWORK_DB}`);
      }

      const commit = git(["rev-parse", "HEAD"], WORK_ONE);

      // --- 执行 runP02（真实生产生命周期，不 mock） ---
      const result = await runP02({
        primaryWorktree: WORK_ONE,
        mainFrameworkDbPath: MAIN_FRAMEWORK_DB,
        commit,
        portA,
        portB,
        testId: "P02-RUNTIME",
      });

      // --- 失败时输出 run paths，不删除现场 ---
      if (!result.ok) {
        console.error("[P02-RUNTIME FAIL]", JSON.stringify({
          runDirA: result.runDirA,
          runDirB: result.runDirB,
          firstFailure: result.firstFailure,
          convergenceErrors: result.convergenceErrors,
        }, null, 2));
      }

      // --- REQ-001 + REQ-002: overall outcome ---
      expect(result.ok).toBe(true);
      if (!result.ok) return; // type narrowing（上面已 fail）

      expect(result.status).toBe("PASS");
      expect(result.runDirA).toBeTruthy();
      expect(result.runDirB).toBeTruthy();

      // --- REQ-002: 五组 checks 全真 ---
      const checkNames = ["reservations", "coexistence", "attribution", "after-stop-a", "cleanup"] as const;
      for (const name of checkNames) {
        const check = result.checks[name];
        expect(check.ok).toBe(true);
        expect(check.failedChecks).toHaveLength(0);
      }

      // --- REQ-002: 16 stages 全 ok ---
      const stageResultsPath = result.evidencePaths.stageResults;
      expect(existsSync(stageResultsPath)).toBe(true);
      const stageResults = JSON.parse(readFileSync(stageResultsPath, "utf8")) as P02StageResultsFile;
      expect(stageResults.runIdA).toBeTruthy();
      expect(stageResults.runIdB).toBeTruthy();
      expect(stageResults.stages).toHaveLength(P02_STAGES.length); // 16
      for (const stage of stageResults.stages) {
        expect(stage.status).toBe("ok");
      }

      // --- REQ-001: A/B manifests 可读 ---
      expect(existsSync(result.evidencePaths.manifestA)).toBe(true);
      expect(existsSync(result.evidencePaths.manifestB)).toBe(true);
      const manifestA = readRunManifest(result.runDirA);
      const manifestB = readRunManifest(result.runDirB);
      expect(manifestA.status).toBe("CLEANED");
      expect(manifestB.status).toBe("CLEANED");

      // --- REQ-003: persistent artifacts 可读 ---
      // A: rootDir retained, worktree removed, cleanup report exists
      expect(existsSync(manifestA.paths.rootDir)).toBe(true);
      expect(existsSync(manifestA.paths.worktreeDir)).toBe(false);
      expect(existsSync(manifestA.paths.manifestPath)).toBe(true);
      expect(existsSync(manifestA.paths.cleanupReportPath)).toBe(true);
      // B: same retention
      expect(existsSync(manifestB.paths.rootDir)).toBe(true);
      expect(existsSync(manifestB.paths.worktreeDir)).toBe(false);
      expect(existsSync(manifestB.paths.manifestPath)).toBe(true);
      expect(existsSync(manifestB.paths.cleanupReportPath)).toBe(true);

      // --- REQ-003: DB/log/event 可读（A 侧） ---
      expect(existsSync(manifestA.paths.frameworkDbPath)).toBe(true);
      expect(existsSync(manifestA.paths.serveLogPath)).toBe(true);
      expect(existsSync(manifestA.paths.eventFilePath)).toBe(true);

      // --- artifactsDirA 存在 ---
      expect(existsSync(result.evidencePaths.artifactsDirA)).toBe(true);
    },
    { timeout: 600_000 }, // 10 min：双 run 含 worktree 创建、serve 启动、bootstrap、cleanup
  );
});
