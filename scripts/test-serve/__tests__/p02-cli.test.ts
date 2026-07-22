// P0-2 单命令 CLI component test
//
// 覆盖 PHASE-04 contract 的 Check Registry 与 Single-failure Matrix：
//   - requiredArgs：缺任一固定 flag → exit 1，且 runP02 调用 0 次
//   - portsDistinct：两端口相同 → exit 1，runP02 0 次
//   - absoluteInputs：相对 path → exit 1，runP02 0 次
//   - runP02CalledOnce：合法 argv → runP02 恰好 1 次
//   - resultMapping：成功映射 ok/status/runA/runB/checks/evidencePaths；失败映射 ok/firstFailure/evidencePaths（exit 1）
//
// 通过 globalThis.__P02_RUNNER__ 注入 spy，避免真实启动 coordinator（component 级，不触 runtime）。

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { P02Result } from "../types";
import { runCliP02 } from "./p02-cli-harness";

type P02Runner = (input: {
  primaryWorktree: string;
  mainFrameworkDbPath: string;
  commit: string;
  portA: number;
  portB: number;
  testId: string;
}) => Promise<P02Result>;

const g = globalThis as Record<string, unknown>;

// 真实临时路径（每次 beforeEach 重建），满足 isolated-serve.ts absoluteInputs 的 existsSync 检查。
let primaryWorktree = "";
let mainFrameworkDb = "";

const BASE_ARGS: string[] = [
  "p0-2",
  "--primary-worktree", primaryWorktree,
  "--commit", "deadbeef",
  "--port-a", "41001",
  "--port-b", "41002",
  "--test-id", "P02-CLI-TEST",
  "--main-framework-db", mainFrameworkDb,
];

let tempRoot = "";

function makePassResult(): P02Result {
  return {
    ok: true,
    status: "PASS",
    runDirA: "/fake/run-a",
    runDirB: "/fake/run-b",
    checks: {
      reservations: { ok: true, phase: "reservations", checks: {}, failedChecks: [] },
      coexistence: { ok: true, phase: "coexistence", checks: {}, failedChecks: [] },
      attribution: { ok: true, phase: "attribution", checks: {}, failedChecks: [] },
      "after-stop-a": { ok: true, phase: "after-stop-a", checks: {}, failedChecks: [] },
      cleanup: { ok: true, phase: "cleanup", checks: {}, failedChecks: [] },
    },
    evidencePaths: {
      manifestA: "/fake/run-a/manifest.json",
      manifestB: "/fake/run-b/manifest.json",
      artifactsDirA: "/fake/run-a/artifacts",
      stageResults: "/fake/run-a/artifacts/p0-2-stage-results.json",
    },
  };
}

function makeFailResult(): P02Result {
  return {
    ok: false,
    runDirA: null,
    runDirB: null,
    failedCheck: "",
    firstFailure: { stage: "start-a", error: "injected coordinator failure" },
    stages: [{ stage: "start-a", startedAt: "t", finishedAt: "t", status: "failed", error: "x" }],
    convergenceErrors: [],
    evidencePaths: { stageResults: "/fake/run-a/artifacts/p0-2-stage-results.json" },
  };
}

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "p02-cli-test-"));
  primaryWorktree = tempRoot;
  mainFrameworkDb = join(tempRoot, "framework-state.db");
  writeFileSync(mainFrameworkDb, "");
  // BASE_ARGS 引用上面的变量，重建数组以确保使用本次 beforeEach 的真实路径。
  BASE_ARGS.length = 0;
  BASE_ARGS.push(
    "p0-2",
    "--primary-worktree", primaryWorktree,
    "--commit", "deadbeef",
    "--port-a", "41001",
    "--port-b", "41002",
    "--test-id", "P02-CLI-TEST",
    "--main-framework-db", mainFrameworkDb,
  );
});

afterEach(() => {
  delete g.__P02_RUNNER__;
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
});

describe("PHASE-04 p0-2 CLI contract", () => {
  test("P02-C-MISSING: 缺失一个 flag → exit 1，runP02 调用 0 次", async () => {
    const callCount = { n: 0 };
    g.__P02_RUNNER__ = (async () => { callCount.n++; return makePassResult(); }) as P02Runner;

    const missing = BASE_ARGS.filter((_, i) => i !== BASE_ARGS.indexOf("--port-b") && i !== BASE_ARGS.indexOf("--port-b") + 1);
    // 实际移除 --port-b 及其值
    const argv = BASE_ARGS.filter((a) => a !== "--port-b" && a !== "41002");

    const { exitCode, stdout, stderr } = await runCliP02(argv);
    expect(exitCode).toBe(1);
    expect(callCount.n).toBe(0);
    expect(stdout).toBe("");
    const err = JSON.parse(stderr);
    expect(err.ok).toBe(false);
    expect(err.check).toBe("requiredArgs");
  });

  test("P02-C-PORT: 两端口相同 → exit 1，runP02 调用 0 次", async () => {
    const callCount = { n: 0 };
    g.__P02_RUNNER__ = (async () => { callCount.n++; return makePassResult(); }) as P02Runner;

    const argv = BASE_ARGS.map((a) => (a === "41002" ? "41001" : a));

    const { exitCode, stdout, stderr } = await runCliP02(argv);
    expect(exitCode).toBe(1);
    expect(callCount.n).toBe(0);
    expect(stdout).toBe("");
    const err = JSON.parse(stderr);
    expect(err.ok).toBe(false);
    expect(err.check).toBe("portsDistinct");
  });

  test("P02-C-PATH: 相对 DB path → exit 1，runP02 调用 0 次", async () => {
    const callCount = { n: 0 };
    g.__P02_RUNNER__ = (async () => { callCount.n++; return makePassResult(); }) as P02Runner;

    const argv = BASE_ARGS.map((a) => (a === mainFrameworkDb ? "./framework-state.db" : a));

    const { exitCode, stdout, stderr } = await runCliP02(argv);
    expect(exitCode).toBe(1);
    expect(callCount.n).toBe(0);
    expect(stdout).toBe("");
    const err = JSON.parse(stderr);
    expect(err.ok).toBe(false);
    expect(err.check).toBe("absoluteInputs");
  });

  test("P02-C-PATH-EXIST: 不存在的绝对 DB path → exit 1，runP02 调用 0 次", async () => {
    const callCount = { n: 0 };
    g.__P02_RUNNER__ = (async () => { callCount.n++; return makePassResult(); }) as P02Runner;

    const nonexistentDb = join(tempRoot, "does-not-exist.db");
    const argv = BASE_ARGS.map((a) => (a === mainFrameworkDb ? nonexistentDb : a));

    const { exitCode, stdout, stderr } = await runCliP02(argv);
    expect(exitCode).toBe(1);
    expect(callCount.n).toBe(0);
    expect(stdout).toBe("");
    const err = JSON.parse(stderr);
    expect(err.ok).toBe(false);
    expect(err.check).toBe("absoluteInputs");
  });

  test("合法 argv → runP02 恰好 1 次，成功映射 ok/status/runA/runB/checks/evidencePaths", async () => {
    let captured: unknown = null;
    const callCount = { n: 0 };
    g.__P02_RUNNER__ = (async (input) => {
      captured = input;
      callCount.n++;
      return makePassResult();
    }) as P02Runner;

    const { exitCode, stdout, stderr } = await runCliP02(BASE_ARGS);
    expect(exitCode).toBe(0);
    expect(callCount.n).toBe(1);
    expect(stderr).toBe("");

    const out = JSON.parse(stdout);
    expect(out.ok).toBe(true);
    expect(out.status).toBe("PASS");
    expect(out.runA).toBe("/fake/run-a");
    expect(out.runB).toBe("/fake/run-b");
    expect(Object.keys(out.checks).sort()).toEqual(
      ["after-stop-a", "attribution", "cleanup", "coexistence", "reservations"].sort(),
    );
    expect(out.evidencePaths.stageResults).toBe("/fake/run-a/artifacts/p0-2-stage-results.json");

    // runP02CalledOnce 且参数被精确传递
    expect(captured).toMatchObject({
      primaryWorktree,
      mainFrameworkDbPath: mainFrameworkDb,
      commit: "deadbeef",
      portA: 41001,
      portB: 41002,
      testId: "P02-CLI-TEST",
    });
  });

  test("P02-C-FAIL: PASS stub 改为失败结果 → exit 1，映射 ok/firstFailure/evidencePaths", async () => {
    const callCount = { n: 0 };
    g.__P02_RUNNER__ = (async () => { callCount.n++; return makeFailResult(); }) as P02Runner;

    const { exitCode, stdout, stderr } = await runCliP02(BASE_ARGS);
    expect(exitCode).toBe(1);
    expect(callCount.n).toBe(1);
    expect(stdout).toBe("");

    const err = JSON.parse(stderr);
    expect(err.ok).toBe(false);
    expect(err.firstFailure).toEqual({ stage: "start-a", error: "injected coordinator failure" });
    expect(err.evidencePaths.stageResults).toBe("/fake/run-a/artifacts/p0-2-stage-results.json");
  });

  test("未知 flag → exit 1，runP02 调用 0 次", async () => {
    const callCount = { n: 0 };
    g.__P02_RUNNER__ = (async () => { callCount.n++; return makePassResult(); }) as P02Runner;

    const argv = [...BASE_ARGS, "--unknown-flag", "x"];

    const { exitCode, stdout } = await runCliP02(argv);
    expect(exitCode).toBe(1);
    expect(callCount.n).toBe(0);
    expect(stdout).toBe("");
  });
});
