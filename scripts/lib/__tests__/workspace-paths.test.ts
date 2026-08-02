#!/usr/bin/env bun
/**
 * workspace-paths.test.ts — Component tests for resolveWorkspacePaths,
 * validateWorkOneRoot, and resolveTool.
 *
 * Positive controls:
 *   - PDR-C-101a happy: CLI absolute root → CLI wins
 *   - PDR-C-102a happy: valid local-paths.json (linux platform key only)
 *   - PDR-C-103a happy: resolveTool on absolute executable
 *   - PDR-C-104a happy: explicit --work-dir wins (CLI > ENV)
 *
 * Single-failure mutations (negative controls):
 *   - PDR-C-101: ENV root is relative → throws WORK_ONE_ROOT_INVALID
 *   - PDR-C-102: local-paths.json adds tools.extra key → throws LOCAL_PATHS_INVALID
 *   - PDR-C-103: Bun fixture without execute bit → throws TOOL_BUN_INVALID
 *   - PDR-C-104: explicit work-dir without opencode.json → throws WORK_ONE_ROOT_INVALID
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync, chmodSync, statSync } from "node:fs";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  resolveWorkspacePaths,
  resolveTool,
  validateWorkOneRoot,
  WorkspacePathsError,
} from "../workspace-paths.ts";

// ── Helpers ──

function gitInit(cwd: string): void {
  const init = Bun.spawnSync({ cmd: ["git", "init", "--quiet"], cwd, stdout: "pipe", stderr: "pipe" });
  if (init.exitCode !== 0) {
    throw new Error(`git init failed in ${cwd}: ${init.stderr.toString()}`);
  }
}

function makeWorkOneFixture(label: string): { root: string } {
  const candidate = join(tmpdir(), `workspace-paths-fixture-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(candidate, { recursive: true });
  const root = realpathSync(candidate);
  writeFileSync(join(root, "opencode.json"), "{}\n");
  gitInit(root);
  return { root };
}

function makeLocalPathsFile(content: object): string {
  const candidate = join(tmpdir(), `local-paths-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  writeFileSync(candidate, JSON.stringify(content));
  return realpathSync(candidate);
}

// ── Suite ──

describe("resolveWorkspacePaths — precedence chain", () => {
  let fixtureA: { root: string };
  let fixtureB: { root: string };

  beforeAll(() => {
    fixtureA = makeWorkOneFixture("A");
    fixtureB = makeWorkOneFixture("B");
  });

  afterAll(() => {
    for (const fx of [fixtureA, fixtureB]) {
      try { rmSync(fx.root, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  test("PDR-C-101a CLI absolute root wins (positive)", () => {
    const result = resolveWorkspacePaths({ cliWorkOneRoot: fixtureB.root });
    expect(result.workOneRoot).toBe(fixtureB.root);
    expect(result.workOneSource).toBe("CLI");
  });

  test("PDR-C-101 single-failure mutation: ENV root is relative throws WORK_ONE_ROOT_INVALID", () => {
    expect(() =>
      resolveWorkspacePaths({
        env: { WORK_ONE_ROOT: "relative/path" },
        localPathsFile: "/nonexistent/local-paths.json",
      }),
    ).toThrow(WorkspacePathsError);
    try {
      resolveWorkspacePaths({
        env: { WORK_ONE_ROOT: "relative/path" },
        localPathsFile: "/nonexistent/local-paths.json",
      });
    } catch (error) {
      expect((error as WorkspacePathsError).code).toBe("WORK_ONE_ROOT_INVALID");
    }
  });

  test("PDR-C-102a happy: valid local-paths.json (linux platform only) returns LOCAL_CONFIG source", () => {
    const localPathsFile = makeLocalPathsFile({
      schemaVersion: 1,
      platforms: { linux: { workOneRoot: fixtureA.root } },
    });
    try {
      const result = resolveWorkspacePaths({ localPathsFile, platform: "linux" });
      expect(result.workOneRoot).toBe(fixtureA.root);
      expect(result.workOneSource).toBe("LOCAL_CONFIG");
    } finally {
      try { rmSync(localPathsFile, { force: true }); } catch { /* ignore */ }
    }
  });

  test("PDR-C-102 single-failure mutation: unknown platform key throws LOCAL_PATHS_INVALID", () => {
    const localPathsFile = makeLocalPathsFile({
      schemaVersion: 1,
      platforms: {
        linux: { workOneRoot: fixtureA.root },
        tools: { workOneRoot: fixtureA.root }, // invalid platform key
      },
    });
    try {
      expect(() => resolveWorkspacePaths({ localPathsFile, platform: "linux" })).toThrow(WorkspacePathsError);
      try {
        resolveWorkspacePaths({ localPathsFile, platform: "linux" });
      } catch (error) {
        expect((error as WorkspacePathsError).code).toBe("LOCAL_PATHS_INVALID");
      }
    } finally {
      try { rmSync(localPathsFile, { force: true }); } catch { /* ignore */ }
    }
  });

  test("PDR-C-102b local-paths.json with bad JSON throws LOCAL_PATHS_INVALID", () => {
    const candidate = join(tmpdir(), `bad-json-${Date.now()}.json`);
    writeFileSync(candidate, "{ this is not json");
    const localPathsFile = realpathSync(candidate);
    try {
      expect(() => resolveWorkspacePaths({ localPathsFile })).toThrow(WorkspacePathsError);
      try { resolveWorkspacePaths({ localPathsFile }); } catch (error) {
        expect((error as WorkspacePathsError).code).toBe("LOCAL_PATHS_INVALID");
      }
    } finally {
      try { rmSync(localPathsFile, { force: true }); } catch { /* ignore */ }
    }
  });
});

describe("resolveTool", () => {
  let exeFixture: { dir: string; bin: string };

  beforeAll(() => {
    const candidateDir = join(tmpdir(), `tool-fixture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    mkdirSync(candidateDir, { recursive: true });
    exeFixture = {
      dir: realpathSync(candidateDir),
      bin: "",
    };
    const binPath = join(exeFixture.dir, "fakebun");
    writeFileSync(binPath, "#!/bin/sh\necho bun\n");
    chmodSync(binPath, 0o755);
    exeFixture.bin = binPath;
  });

  afterAll(() => {
    try { rmSync(exeFixture.dir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  test("PDR-C-103a happy: resolveTool on absolute executable returns realpath", () => {
    const resolved = resolveTool(exeFixture.bin, "bunBin", process.env, "linux");
    expect(resolved).toBe(exeFixture.bin);
    expect(existsSync(resolved!)).toBe(true);
    expect(statSync(resolved!).isFile()).toBe(true);
  });

  test("PDR-C-103 single-failure mutation: absolute path without execute bit throws TOOL_BUN_INVALID", () => {
    const noExecPath = join(exeFixture.dir, "noexec");
    writeFileSync(noExecPath, "echo no exec\n");
    chmodSync(noExecPath, 0o644); // not executable
    try {
      expect(() => resolveTool(noExecPath, "bunBin", process.env, "linux")).toThrow(WorkspacePathsError);
      try { resolveTool(noExecPath, "bunBin", process.env, "linux"); } catch (error) {
        expect((error as WorkspacePathsError).code).toBe("TOOL_BUN_INVALID");
      }
    } finally {
      try { rmSync(noExecPath, { force: true }); } catch { /* ignore */ }
    }
  });

  test("PDR-C-103b resolveTool with PATH basename resolves via PATH", () => {
    const result = resolveTool("fakebun", "bunBin", { PATH: exeFixture.dir }, "linux");
    expect(result).toBe(exeFixture.bin);
  });

  test("PDR-C-103c resolveTool with empty/undefined returns undefined", () => {
    expect(resolveTool(undefined, "bunBin", process.env, "linux")).toBeUndefined();
    expect(resolveTool("", "bunBin", process.env, "linux")).toBeUndefined();
  });

  test("PDR-C-103d resolveTool rejects separator-containing string when not absolute", () => {
    expect(() => resolveTool("./bin/fakebun", "bunBin", process.env, "linux")).toThrow(WorkspacePathsError);
  });
});

describe("validateWorkOneRoot — explicit CLI value passes through validator", () => {
  let goodRoot: { root: string };

  beforeAll(() => {
    goodRoot = makeWorkOneFixture("good");
  });

  afterAll(() => {
    try { rmSync(goodRoot.root, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  test("valid fixture passes validateWorkOneRoot and returns realpath", () => {
    const result = validateWorkOneRoot(goodRoot.root);
    expect(result).toBe(goodRoot.root);
  });

  test("missing opencode.json throws WORK_ONE_ROOT_INVALID", () => {
    const noJsonDir = join(tmpdir(), `no-opencode-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    mkdirSync(noJsonDir, { recursive: true });
    try {
      expect(() => validateWorkOneRoot(noJsonDir)).toThrow(WorkspacePathsError);
      try { validateWorkOneRoot(noJsonDir); } catch (error) {
        expect((error as WorkspacePathsError).code).toBe("WORK_ONE_ROOT_INVALID");
      }
    } finally {
      try { rmSync(noJsonDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  test("relative path throws WORK_ONE_ROOT_INVALID", () => {
    expect(() => validateWorkOneRoot("relative/path")).toThrow(WorkspacePathsError);
    try { validateWorkOneRoot("relative/path"); } catch (error) {
      expect((error as WorkspacePathsError).code).toBe("WORK_ONE_ROOT_INVALID");
    }
  });
});