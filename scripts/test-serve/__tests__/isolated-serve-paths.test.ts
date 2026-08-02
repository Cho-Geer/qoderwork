#!/usr/bin/env bun
/**
 * isolated-serve-paths.test.ts — Component tests for the PHASE-03
 * argument-resolution seam exported from isolated-serve.ts.
 *
 * The seam (`resolvePrimaryWorktreeFromArgs`) is a pure CLI-parsing helper
 * that does NOT spawn a child, write a manifest, or call any authorization
 * API. It returns the explicit CLI value when present, otherwise the
 * workspace-paths resolver default.
 *
 * Positive controls:
 *   - PDR-C-203a happy: --primary-worktree <fixture> wins over default
 *   - PDR-C-204a happy: --from <fixture> wins over default
 *   - PHASE-03 contract: explicit path preserves absolute form
 *
 * Negative / mutation control:
 *   - PDR-C-203 single-failure: bad CLI flag (not in flags[]) does not
 *     match; falls through to resolver
 *   - PDR-C-204 single-failure: --from with no value (last token) is
 *     ignored, falls through to resolver
 */

import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { resolvePrimaryWorktreeFromArgs } from "../isolated-serve";

let fixtureRoot = "";

beforeAll(() => {
  const candidate = join(tmpdir(), "isolated-serve-fixture-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8));
  mkdirSync(candidate, { recursive: true });
  fixtureRoot = candidate;
  writeFileSync(join(candidate, "opencode.json"), "{}\n");
  const init = Bun.spawnSync({ cmd: ["git", "init", "--quiet"], cwd: candidate, stdout: "pipe", stderr: "pipe" });
  if (init.exitCode !== 0) {
    throw new Error(`git init failed: ${init.stderr.toString()}`);
  }
});

afterEach(() => {
  // nothing per-test cleanup; fixture is shared across describe
});

describe("resolvePrimaryWorktreeFromArgs — argument-resolution seam", () => {
  test("PDR-C-203a happy: --primary-worktree <fixture> wins over resolver default", () => {
    const result = resolvePrimaryWorktreeFromArgs(["--primary-worktree", fixtureRoot], ["--primary-worktree"]);
    expect(result).toBe(fixtureRoot);
  });

  test("PDR-C-204a happy: --from <fixture> wins over resolver default", () => {
    const result = resolvePrimaryWorktreeFromArgs(["--from", fixtureRoot, "--output", "/tmp/out"], ["--from"]);
    expect(result).toBe(fixtureRoot);
  });

  test("PHASE-03 contract: explicit path is preserved verbatim (no mutation, no normalization)", () => {
    const result = resolvePrimaryWorktreeFromArgs(["--primary-worktree", fixtureRoot], ["--primary-worktree"]);
    expect(result).toBe(fixtureRoot);
    expect(result.startsWith("/")).toBe(true);
  });

  test("PDR-C-203 single-failure: unknown flag not in flags[] falls through to resolver default", () => {
    // The seam checks only the flags[] passed in. If a caller passes ["--unknown"],
    // it is ignored and the resolver default wins. The default comes from
    // workspace-paths.ts resolveWorkspacePaths({}).
    // In the test environment the resolver has no work-one candidate, so it throws
    // WORK_ONE_ROOT_INVALID — the seam rethrows. Either way, the result is NOT fixtureRoot.
    try {
      const result = resolvePrimaryWorktreeFromArgs(["--unknown", fixtureRoot], ["--primary-worktree"]);
      expect(result).not.toBe(fixtureRoot);
    } catch (e) {
      expect((e as Error).message).toMatch(/WORK_ONE_ROOT_INVALID|unknown|fallthrough/);
    }
  });

  test("PDR-C-204 single-failure: --from with no following value falls through to resolver default", () => {
    // "--from" is the last token; argv[index + 1] is undefined → ignored.
    // The seam falls through to resolver default (which throws in test env).
    try {
      const result = resolvePrimaryWorktreeFromArgs(["--from"], ["--from"]);
      expect(result).not.toBe(fixtureRoot);
    } catch (e) {
      expect((e as Error).message).toMatch(/WORK_ONE_ROOT_INVALID/);
    }
  });

  test("empty argv: when no CLI flag matches, seam throws WORK_ONE_ROOT_INVALID (resolver has no env in test)", () => {
    // With empty argv, the seam calls resolveWorkspacePaths({}).workOneRoot which
    // requires a usable work-one root. In this test environment we do not provide
    // CLI/ENV/LOCAL_CONFIG; the legacy default (`resolve(qoderworkRoot, "..", "opencode",
    // "work-one")`) does not exist. The seam rethrows with the WORK_ONE_ROOT_INVALID code.
    expect(() => resolvePrimaryWorktreeFromArgs([], ["--primary-worktree", "--from"])).toThrow(/WORK_ONE_ROOT_INVALID/);
  });

  test("PHASE-03 contract: seam does not perform spawn, write manifest, or call authorization API", () => {
    // Static source-level guard: the seam is pure argv parsing.
    // It must not import or invoke startRunProcesses, bootstrapRun, runP01b, runP02, verifyP01b, etc.
    const src = readFileSync(join(dirname(new URL(import.meta.url).pathname), "..", "isolated-serve.ts"), "utf-8");
    // Extract just the resolvePrimaryWorktreeFromArgs function body
    const match = src.match(/export function resolvePrimaryWorktreeFromArgs[\s\S]*?\n\}\n/);
    expect(match).not.toBeNull();
    if (match) {
      const body = match[0];
      // The seam body must not reference any heavy machinery.
      expect(body).not.toContain("spawn");
      expect(body).not.toContain("writeRunManifest");
      expect(body).not.toContain("bootstrapRun");
      expect(body).not.toContain("startRunProcesses");
      expect(body).not.toContain("runP01b");
      expect(body).not.toContain("runP02");
      expect(body).not.toContain("verifyP01b");
      // The seam body must use getDefaultPrimaryWorktree (the only side-effect).
      expect(body).toContain("getDefaultPrimaryWorktree");
    }
  });
});