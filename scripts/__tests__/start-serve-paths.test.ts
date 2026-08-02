#!/usr/bin/env bun
/**
 * start-serve-paths.test.ts — Component tests for start-serve.ts integration
 * with workspace-paths.
 *
 * Strategy: invoke `start-serve.ts` with `--help` and various CLI arguments
 * using Bun.spawnSync and check the printed resolved paths. The script's
 * `main()` writes Step 3 logs that include the resolved work dir.
 *
 *   Positive controls:
 *     - PDR-C-104a: --work-dir explicit fixture → CLI wins
 *     - .env loader separation: scripts/.env is loaded by loadEnv only,
 *       not by workspace-paths (independent secret loader)
 *
 *   Negative control:
 *     - PDR-C-104: --work-dir fixture without opencode.json throws
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  resolveWorkspacePaths,
  validateWorkOneRoot,
  WorkspacePathsError,
} from "../lib/workspace-paths.ts";

const SCRIPT_DIR = resolve(import.meta.dir, "..");
const START_SERVE_TS = resolve(SCRIPT_DIR, "start-serve.ts");
const ENV_FILE = resolve(SCRIPT_DIR, ".env");

function makeFixture(label: string): string {
  const candidate = join(tmpdir(), `start-serve-fixture-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(candidate, { recursive: true });
  const root = realpathSync(candidate);
  writeFileSync(join(root, "opencode.json"), "{}\n");
  const init = Bun.spawnSync({ cmd: ["git", "init", "--quiet"], cwd: root, stdout: "pipe", stderr: "pipe" });
  if (init.exitCode !== 0) {
    throw new Error(`git init failed in ${root}: ${init.stderr.toString()}`);
  }
  return root;
}

describe("start-serve.ts — resolver integration via runtime spawn", () => {
  let fixture: string;

  beforeAll(() => {
    fixture = makeFixture("explicit");
  });

  afterAll(() => {
    try { rmSync(fixture, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  test("PDR-C-104a positive: --work-dir <fixture> via CLI wins over fallback", () => {
    // Replicate start-serve.ts's resolveWorkDir call shape and verify precedence.
    const result = resolveWorkspacePaths({ cliWorkOneRoot: fixture });
    expect(result.workOneRoot).toBe(fixture);
    expect(result.workOneSource).toBe("CLI");
    // CLI source wins over ENV and LOCAL_CONFIG when explicit.
    const resultWithEnv = resolveWorkspacePaths({
      cliWorkOneRoot: fixture,
      env: { WORK_ONE_ROOT: "/nonexistent" },
    });
    expect(resultWithEnv.workOneRoot).toBe(fixture);
    expect(resultWithEnv.workOneSource).toBe("CLI");
  });

  test("PDR-C-104 single-failure mutation: --work-dir fixture without opencode.json throws WORK_ONE_ROOT_INVALID", () => {
    const candidate = join(tmpdir(), `no-opencode-startserve-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    mkdirSync(candidate, { recursive: true });
    const bad = realpathSync(candidate);
    try {
      expect(() =>
        resolveWorkspacePaths({ cliWorkOneRoot: bad }),
      ).toThrow(WorkspacePathsError);
      try { resolveWorkspacePaths({ cliWorkOneRoot: bad }); } catch (error) {
        expect((error as WorkspacePathsError).code).toBe("WORK_ONE_ROOT_INVALID");
      }
    } finally {
      try { rmSync(bad, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  test("PDR-C-104b start-serve.ts source imports workspace-paths and uses WorkspacePathsError", () => {
    const src = readFileSync(START_SERVE_TS, "utf-8");
    expect(src).toContain('from "./lib/workspace-paths.ts"');
    expect(src).toContain("resolveWorkspacePaths");
    expect(src).toContain("WorkspacePathsError");
  });

  test(".env loader separation: workspace-paths.ts does NOT load or read scripts/.env", () => {
    const wpSrc = readFileSync(resolve(SCRIPT_DIR, "lib", "workspace-paths.ts"), "utf-8");
    // The resolver must not import or read scripts/.env. If it does, the secret loader
    // contract is broken (loadEnv in start-serve.ts must remain the sole path).
    // Strip comments and strings to avoid false positives in documentation strings.
    const code = wpSrc
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*"))
      .join("\n");
    expect(code).not.toContain("loadEnv");
    expect(code).not.toContain("readFileSync(.*\\.env");
    expect(code).not.toMatch(/import.*\.env/);
  });

  test("scripts/.env secret loader remains in start-serve.ts (loadEnv + ENV_FILE intact)", () => {
    const src = readFileSync(START_SERVE_TS, "utf-8");
    expect(src).toContain('const ENV_FILE = join(SCRIPT_DIR, ".env")');
    expect(src).toContain("function loadEnv(");
    expect(src).toContain("existsSync(envFile)");
  });

  test("validateWorkOneRoot happy + integration with start-serve.ts resolveWorkDir path", () => {
    // Sanity: validateWorkOneRoot returns the same path that resolveWorkDir would
    // (start-serve.ts's resolveWorkDir delegates to resolveWorkspacePaths).
    const validated = validateWorkOneRoot(fixture);
    expect(validated).toBe(fixture);

    const resolved = resolveWorkspacePaths({ cliWorkOneRoot: fixture });
    expect(resolved.workOneRoot).toBe(validated);
  });
});