import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SCRIPT = join(import.meta.dir, "..", "generate-evidence-receipt.ts");
const BUN = process.execPath;

type RunResult = { exitCode: number; stdout: string; stderr: string };

function runScript(args: string[]): RunResult {
  const run = Bun.spawnSync({
    cmd: [BUN, "run", SCRIPT, ...args],
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: run.exitCode ?? 1,
    stdout: run.stdout?.toString() ?? "",
    stderr: run.stderr?.toString() ?? "",
  };
}

function baseArgs(root: string, receiptPath: string, artifactPath: string, command: string, opts: Partial<{ observedOverride: string; timeout: number; domainResult: string; domainErrorCode: string }> = {}): string[] {
  const args = [
    "--audit-id", "TEST-AUDIT-001",
    "--generation", "1",
    "--receipt-id", "EV-001",
    "--requirement-id", "REQ-001",
    "--decision-case-id", "DC-001",
    "--polarity", "POSITIVE",
    "--oracle-id", "ORACLE-001",
    "--fixture-id", "FIXTURE-GOOD-001",
    "--evidence-level", "component",
    "--verdict-state-sha256", "e".repeat(64),
    "--domain-result", opts.domainResult ?? "SUCCESS",
    "--domain-error-code", opts.domainErrorCode ?? "null",
    "--forbidden-side-effects", "[]",
    "--projection-sha256", "f".repeat(64),
    "--canonical-sha256", "a".repeat(64),
    "--cwd", root,
    "--command", `cd ${root} && ${command}`,
    "--receipt-path", receiptPath,
    "--artifact-path", artifactPath,
    "--workspace-root", root,
    "--repository-root", root,
  ];
  if (opts.observedOverride) args.push("--observed-override", opts.observedOverride);
  if (opts.timeout !== undefined) args.push("--timeout", String(opts.timeout));
  return args;
}

describe("generate-evidence-receipt", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "gen-receipt-"));
  });

  afterEach(() => {
    try { rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ }
  });

  test("normal positive: exit 0 → observed=PASS", () => {
    const receiptPath = join(root, "evidence", "ev-001.json");
    const artifactPath = join(root, "evidence", "ev-001-output.txt");
    const result = runScript(baseArgs(root, receiptPath, artifactPath, "echo hello"));
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.observed).toBe("PASS");
    expect(output.exit_code).toBe(0);
    expect(output.receipt_path).toBe(receiptPath);
    expect(existsSync(receiptPath)).toBe(true);
    expect(existsSync(artifactPath)).toBe(true);
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    expect(receipt.schema_version).toBe("audit-evidence-receipt/v3");
    expect(receipt.document_kind).toBe("evidence-receipt");
    expect(receipt.id).toBe("EV-001");
    expect(receipt.decision_case_id).toBe("DC-001");
    expect(receipt.execution.observed).toBe("PASS");
    expect(receipt.execution.exit_code).toBe(0);
    expect(receipt.domain_observation.result).toBe("SUCCESS");
    expect(receipt.domain_observation.error_code).toBeNull();
    expect(receipt.projection_sha256).toBe("f".repeat(64));
    expect(receipt.canonical_sha256).toBe("a".repeat(64));
    expect(receipt.forbidden_side_effects_observed).toEqual([]);
    expect(receipt.repository_state_sha256).toBe("e".repeat(64));
    const artifact = readFileSync(artifactPath, "utf8");
    expect(artifact).toContain("hello");
    expect(artifact).toContain("=== STDOUT ===");
    expect(artifact).toContain("=== EXIT_CODE ===");
  });

  test("normal negative: exit 1 → observed=FAIL", () => {
    const receiptPath = join(root, "ev-002.json");
    const artifactPath = join(root, "ev-002-output.txt");
    const result = runScript(baseArgs(root, receiptPath, artifactPath, "exit 1", { domainResult: "ERROR", domainErrorCode: "ERR_TEST" }));
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.observed).toBe("FAIL");
    expect(output.exit_code).toBe(1);
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    expect(receipt.execution.observed).toBe("FAIL");
    expect(receipt.execution.exit_code).toBe(1);
    expect(receipt.domain_observation.result).toBe("ERROR");
    expect(receipt.domain_observation.error_code).toBe("ERR_TEST");
  });

  test("observed-override BLOCKED is allowed", () => {
    const receiptPath = join(root, "ev-003.json");
    const artifactPath = join(root, "ev-003-output.txt");
    const result = runScript(baseArgs(root, receiptPath, artifactPath, "echo ok", { observedOverride: "BLOCKED" }));
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.observed).toBe("BLOCKED");
  });

  test("observed-override PASS is rejected (cannot fake PASS)", () => {
    const receiptPath = join(root, "ev-004.json");
    const artifactPath = join(root, "ev-004-output.txt");
    const result = runScript(baseArgs(root, receiptPath, artifactPath, "exit 1", { observedOverride: "PASS" }));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--observed-override");
    expect(existsSync(receiptPath)).toBe(false);
    expect(existsSync(artifactPath)).toBe(false);
  });

  test("command not starting with cd <cwd> is rejected", () => {
    const receiptPath = join(root, "ev-005.json");
    const artifactPath = join(root, "ev-005-output.txt");
    const args = baseArgs(root, receiptPath, artifactPath, "echo ok");
    const cdIdx = args.indexOf("--command") + 1;
    args[cdIdx] = "echo ok";
    const result = runScript(args);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--command must start with");
  });

  test("trivial command (&& true) is rejected", () => {
    const receiptPath = join(root, "ev-006.json");
    const artifactPath = join(root, "ev-006-output.txt");
    const result = runScript(baseArgs(root, receiptPath, artifactPath, "echo ok && true"));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("shell constant");
  });

  test("cwd outside roots is rejected", () => {
    const outsideRoot = mkdtempSync(join(tmpdir(), "outside-"));
    try {
      const receiptPath = join(root, "ev-007.json");
      const artifactPath = join(root, "ev-007-output.txt");
      const args = baseArgs(root, receiptPath, artifactPath, "echo ok");
      const cwdIdx = args.indexOf("--cwd") + 1;
      args[cwdIdx] = outsideRoot;
      const cmdIdx = args.indexOf("--command") + 1;
      args[cmdIdx] = `cd ${outsideRoot} && echo ok`;
      const result = runScript(args);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("outside workspace-root and repository-root");
    } finally {
      rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  test("receipt-id not matching EV-NNN is rejected", () => {
    const receiptPath = join(root, "ev-008.json");
    const artifactPath = join(root, "ev-008-output.txt");
    const args = baseArgs(root, receiptPath, artifactPath, "echo ok");
    const idIdx = args.indexOf("--receipt-id") + 1;
    args[idIdx] = "EV-9999";
    const result = runScript(args);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--receipt-id must match EV-NNN");
  });

  test("polarity not in whitelist is rejected", () => {
    const receiptPath = join(root, "ev-009.json");
    const artifactPath = join(root, "ev-009-output.txt");
    const args = baseArgs(root, receiptPath, artifactPath, "echo ok");
    const polIdx = args.indexOf("--polarity") + 1;
    args[polIdx] = "PRE_FIX";
    const result = runScript(args);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--polarity must be one of");
  });

  test("verdict-state-sha256 not 64 hex is rejected", () => {
    const receiptPath = join(root, "ev-010.json");
    const artifactPath = join(root, "ev-010-output.txt");
    const args = baseArgs(root, receiptPath, artifactPath, "echo ok");
    const shaIdx = args.indexOf("--verdict-state-sha256") + 1;
    args[shaIdx] = "short";
    const result = runScript(args);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--verdict-state-sha256 must be 64 hex chars");
  });

  test("wx protection: existing receipt file is rejected", () => {
    const receiptPath = join(root, "ev-011.json");
    const artifactPath = join(root, "ev-011-output.txt");
    mkdirSync(dirnameSafe(receiptPath), { recursive: true });
    writeFileSync(receiptPath, "pre-existing\n");
    const result = runScript(baseArgs(root, receiptPath, artifactPath, "echo ok"));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("already exists (wx protection)");
  });

  test("wx protection: existing artifact file is rejected", () => {
    const receiptPath = join(root, "ev-012.json");
    const artifactPath = join(root, "ev-012-output.txt");
    writeFileSync(artifactPath, "pre-existing\n");
    const result = runScript(baseArgs(root, receiptPath, artifactPath, "echo ok"));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("already exists (wx protection)");
  });

  test("artifact sha256 matches file content", () => {
    const receiptPath = join(root, "ev-013.json");
    const artifactPath = join(root, "ev-013-output.txt");
    const result = runScript(baseArgs(root, receiptPath, artifactPath, "echo hello"));
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    const { createHash } = require("node:crypto");
    const { readFileSync: rf } = require("node:fs");
    const expected = createHash("sha256").update(rf(artifactPath)).digest("hex");
    expect(output.artifact_sha256).toBe(expected);
  });

  test("receipt sha256 matches file content", () => {
    const receiptPath = join(root, "ev-014.json");
    const artifactPath = join(root, "ev-014-output.txt");
    const result = runScript(baseArgs(root, receiptPath, artifactPath, "echo hello"));
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    const { createHash } = require("node:crypto");
    const { readFileSync: rf } = require("node:fs");
    const expected = createHash("sha256").update(rf(receiptPath)).digest("hex");
    expect(output.receipt_sha256).toBe(expected);
  });

  test("timeout produces observed=BLOCKED and exit_code=124", () => {
    const receiptPath = join(root, "ev-015.json");
    const artifactPath = join(root, "ev-015-output.txt");
    const result = runScript(baseArgs(root, receiptPath, artifactPath, "sleep 10", { timeout: 500 }));
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.observed).toBe("BLOCKED");
    expect(output.exit_code).toBe(124);
  });
});

function dirnameSafe(p: string): string {
  const { dirname } = require("node:path");
  return dirname(p);
}
