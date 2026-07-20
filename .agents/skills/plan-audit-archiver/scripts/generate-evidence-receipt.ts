#!/usr/bin/env bun
// generate-evidence-receipt.ts — EV-NNN execution receipt 生成器
//
// 用途: 真实执行一条验证命令，捕获 stdout/stderr/exitCode，按 evidence-receipt-template.json
// schema 生成 immutable receipt JSON + artifact 文件。observed 由 exit_code 推导，
// 不接受手动覆盖为 PASS/FAIL，杜绝"模拟执行"蒙混。
//
// 设计原则:
//   1. command 真实执行（Bun.spawnSync），exit_code/observed/artifact 均来自真实运行
//   2. observed 仅由 exit_code 推导（0→PASS, 非0→FAIL）；--observed-override 仅限 BLOCKED/NOT_RUN/N/A
//   3. artifact 内容 = 真实 stdout + stderr 合并，不接受手动提供
//   4. flag "wx" 禁止覆盖已有 receipt/artifact 文件
//   5. 写前全参数校验；写入失败时回滚（删除已写文件）
//   6. cwd 必须在 workspace-root 或 repository-root 之内
//
// 用法:
//   bun run .agents/skills/plan-audit-archiver/scripts/generate-evidence-receipt.ts \
//     --audit-id <string> --generation <number> --receipt-id EV-001 \
//     --requirement-id REQ-001 --polarity POSITIVE --oracle-id ORACLE-001 \
//     --fixture-id FIXTURE-GOOD-001 --evidence-level component \
//     --verdict-state-sha256 <64hex> \
//     --cwd <absolute-path> --command "cd <cwd> && <cmd>" \
//     --receipt-path <path> --artifact-path <path> \
//     --workspace-root <path> --repository-root <path> \
//     [--observed-override BLOCKED|NOT_RUN|N/A] [--timeout <ms>]
//
// 退出码:
//   0 = 成功，输出单行 JSON {receipt_path, receipt_sha256, artifact_path, artifact_sha256, observed, exit_code}
//   1 = 失败（参数校验/执行/写入错误）

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

const ALLOWED_POLARITIES = new Set(["POSITIVE", "NEGATIVE", "POST_FIX"]);
const ALLOWED_OBSERVED_OVERRIDE = new Set(["BLOCKED", "NOT_RUN", "N/A"]);
const ALLOWED_EVIDENCE_LEVELS = new Set(["static", "manual", "component", "integration", "runtime-smoke", "live-LLM-E2E"]);
const RECEIPT_ID_RE = /^EV-\d{3}$/;
const ORACLE_ID_RE = /^ORACLE-\d{3}$/;
const SHA256_RE = /^[a-f0-9]{64}$/i;
const TRIVIAL_COMMAND_RE = /&&\s*(?:true|false|:)\s*$/i;

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function fail(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  return value;
}

function requiredArgument(name: string): string {
  const value = argument(name);
  if (value === undefined || value.trim().length === 0) fail(`missing required argument ${name}`);
  return value.trim();
}

function optionalArgument(name: string): string | undefined {
  const value = argument(name);
  if (value === undefined) return undefined;
  if (value.trim().length === 0) return undefined;
  return value.trim();
}

type ValidatedArgs = {
  auditId: string;
  generation: number;
  receiptId: string;
  requirementId: string;
  polarity: string;
  oracleId: string;
  fixtureId: string;
  evidenceLevel: string;
  verdictStateSha256: string;
  cwd: string;
  command: string;
  receiptPath: string;
  artifactPath: string;
  workspaceRoot: string;
  repositoryRoot: string;
  observedOverride: string | null;
  timeoutMs: number | null;
};

function validateArguments(): ValidatedArgs {
  const auditId = requiredArgument("--audit-id");
  const generationRaw = requiredArgument("--generation");
  const generation = Number(generationRaw);
  if (!Number.isInteger(generation) || generation < 1) fail(`--generation must be a positive integer, got: ${generationRaw}`);

  const receiptId = requiredArgument("--receipt-id");
  if (!RECEIPT_ID_RE.test(receiptId)) fail(`--receipt-id must match EV-NNN, got: ${receiptId}`);

  const requirementId = requiredArgument("--requirement-id");
  if (requirementId.length === 0) fail("--requirement-id must not be empty");

  const polarity = requiredArgument("--polarity");
  if (!ALLOWED_POLARITIES.has(polarity)) fail(`--polarity must be one of ${[...ALLOWED_POLARITIES].join("/")}, got: ${polarity}`);

  const oracleId = requiredArgument("--oracle-id");
  if (!ORACLE_ID_RE.test(oracleId)) fail(`--oracle-id must match ORACLE-NNN, got: ${oracleId}`);

  const fixtureId = requiredArgument("--fixture-id");
  if (fixtureId.length === 0) fail("--fixture-id must not be empty");

  const evidenceLevel = requiredArgument("--evidence-level");
  if (!ALLOWED_EVIDENCE_LEVELS.has(evidenceLevel)) fail(`--evidence-level must be one of ${[...ALLOWED_EVIDENCE_LEVELS].join("/")}, got: ${evidenceLevel}`);

  const verdictStateSha256 = requiredArgument("--verdict-state-sha256");
  if (!SHA256_RE.test(verdictStateSha256)) fail(`--verdict-state-sha256 must be 64 hex chars, got: ${verdictStateSha256}`);

  const cwd = requiredArgument("--cwd");
  if (!isAbsolute(cwd)) fail(`--cwd must be absolute, got: ${cwd}`);
  if (!existsSync(cwd) || !statSync(cwd).isDirectory()) fail(`--cwd is not an available directory: ${cwd}`);

  const command = requiredArgument("--command");
  if (!command.startsWith(`cd ${cwd} && `)) fail(`--command must start with "cd ${cwd} && ", got: ${command.slice(0, 80)}...`);
  if (TRIVIAL_COMMAND_RE.test(command)) fail(`--command cannot use a shell constant (true/false/:) as audit evidence: ${command}`);

  const receiptPath = requiredArgument("--receipt-path");
  const artifactPath = requiredArgument("--artifact-path");
  if (/[<>{}*]|\.\.\./.test(receiptPath)) fail(`--receipt-path must not contain placeholders or globs: ${receiptPath}`);
  if (/[<>{}*]|\.\.\./.test(artifactPath)) fail(`--artifact-path must not contain placeholders or globs: ${artifactPath}`);
  if (existsSync(receiptPath)) fail(`--receipt-path already exists (wx protection): ${receiptPath}`);
  if (existsSync(artifactPath)) fail(`--artifact-path already exists (wx protection): ${artifactPath}`);

  const workspaceRoot = requiredArgument("--workspace-root");
  const repositoryRoot = requiredArgument("--repository-root");
  if (!isAbsolute(workspaceRoot)) fail(`--workspace-root must be absolute, got: ${workspaceRoot}`);
  if (!isAbsolute(repositoryRoot)) fail(`--repository-root must be absolute, got: ${repositoryRoot}`);
  if (!existsSync(workspaceRoot) || !statSync(workspaceRoot).isDirectory()) fail(`--workspace-root is not an available directory: ${workspaceRoot}`);
  if (!existsSync(repositoryRoot) || !statSync(repositoryRoot).isDirectory()) fail(`--repository-root is not an available directory: ${repositoryRoot}`);

  const realCwd = realpathSync(cwd);
  const realWorkspace = realpathSync(workspaceRoot);
  const realRepository = realpathSync(repositoryRoot);
  const inWorkspace = relative(realWorkspace, realCwd);
  const inRepository = relative(realRepository, realCwd);
  const cwdInWorkspace = inWorkspace === "" || (!inWorkspace.startsWith("..") && !isAbsolute(inWorkspace));
  const cwdInRepository = inRepository === "" || (!inRepository.startsWith("..") && !isAbsolute(inRepository));
  if (!cwdInWorkspace && !cwdInRepository) fail(`--cwd is outside workspace-root and repository-root: ${cwd}`);

  const observedOverrideRaw = optionalArgument("--observed-override");
  let observedOverride: string | null = null;
  if (observedOverrideRaw !== undefined) {
    if (!ALLOWED_OBSERVED_OVERRIDE.has(observedOverrideRaw)) fail(`--observed-override must be one of ${[...ALLOWED_OBSERVED_OVERRIDE].join("/")} (not PASS/FAIL), got: ${observedOverrideRaw}`);
    observedOverride = observedOverrideRaw;
  }

  const timeoutRaw = optionalArgument("--timeout");
  let timeoutMs: number | null = null;
  if (timeoutRaw !== undefined) {
    timeoutMs = Number(timeoutRaw);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1) fail(`--timeout must be a positive integer (ms), got: ${timeoutRaw}`);
  }

  return { auditId, generation, receiptId, requirementId, polarity, oracleId, fixtureId, evidenceLevel, verdictStateSha256, cwd, command, receiptPath, artifactPath, workspaceRoot, repositoryRoot, observedOverride, timeoutMs };
}

type ExecutionResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
};

function executeCommand(command: string, cwd: string, timeoutMs: number | null): ExecutionResult {
  try {
    const run = Bun.spawnSync({
      cmd: ["/bin/bash", "-c", command],
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      timeout: timeoutMs ?? undefined,
    });
    const stdout = run.stdout?.toString() ?? "";
    const stderr = run.stderr?.toString() ?? "";
    const timedOut = timeoutMs !== null && run.exitCode === null;
    const exitCode = run.exitCode ?? (timedOut ? 124 : 1);
    return { stdout, stderr, exitCode, timedOut };
  } catch (err) {
    return {
      stdout: "",
      stderr: err instanceof Error ? err.message : String(err),
      exitCode: 1,
      timedOut: false,
    };
  }
}

function deriveObserved(exitCode: number, observedOverride: string | null, timedOut: boolean): string {
  if (observedOverride !== null) return observedOverride;
  if (timedOut) return "BLOCKED";
  return exitCode === 0 ? "PASS" : "FAIL";
}

function ensureParentDir(path: string): void {
  const parent = dirname(path);
  if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
}

function writeArtifactAndReceipt(args: ValidatedArgs, result: ExecutionResult, observed: string): { receiptSha256: string; artifactSha256: string } {
  const artifactContent = `=== STDOUT ===\n${result.stdout}=== STDERR ===\n${result.stderr}=== EXIT_CODE ===\n${result.exitCode}\n=== TIMED_OUT ===\n${result.timedOut}\n`;
  let artifactWritten = false;
  let receiptWritten = false;

  try {
    ensureParentDir(args.artifactPath);
    writeFileSync(args.artifactPath, artifactContent, { flag: "wx" });
    artifactWritten = true;
    if (!statSync(args.artifactPath).isFile() || statSync(args.artifactPath).size === 0) {
      throw new Error("artifact write integrity check failed: empty or not a file");
    }
    const artifactSha256 = sha256File(args.artifactPath);

    const completedAt = new Date().toISOString();
    const receiptPayload = {
      schema_version: "1.0",
      audit_id: args.auditId,
      generation: args.generation,
      id: args.receiptId,
      command: args.command,
      observed,
      requirement_id: args.requirementId,
      polarity: args.polarity,
      oracle_id: args.oracleId,
      fixture_id: args.fixtureId,
      evidence_level: args.evidenceLevel,
      repository_state_sha256: args.verdictStateSha256,
      exit_code: result.exitCode,
      cwd: args.cwd,
      artifacts: [{ path: args.artifactPath, sha256: artifactSha256 }],
      completed_at: completedAt,
    };
    const receiptContent = `${JSON.stringify(receiptPayload, null, 2)}\n`;

    ensureParentDir(args.receiptPath);
    writeFileSync(args.receiptPath, receiptContent, { flag: "wx" });
    receiptWritten = true;
    if (!statSync(args.receiptPath).isFile() || statSync(args.receiptPath).size === 0) {
      throw new Error("receipt write integrity check failed: empty or not a file");
    }
    JSON.parse(readFileSync(args.receiptPath, "utf8"));
    const receiptSha256 = sha256File(args.receiptPath);

    return { receiptSha256, artifactSha256 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (receiptWritten) {
      try { rmSync(args.receiptPath, { force: true }); } catch { /* best effort */ }
    }
    if (artifactWritten) {
      try { rmSync(args.artifactPath, { force: true }); } catch { /* best effort */ }
    }
    fail(`atomic write failed, rolled back: ${msg}`);
  }
}

function main(): void {
  const args = validateArguments();
  const result = executeCommand(args.command, args.cwd, args.timeoutMs);
  const observed = deriveObserved(result.exitCode, args.observedOverride, result.timedOut);
  const { receiptSha256, artifactSha256 } = writeArtifactAndReceipt(args, result, observed);
  const output = {
    receipt_path: args.receiptPath,
    receipt_sha256: receiptSha256,
    artifact_path: args.artifactPath,
    artifact_sha256: artifactSha256,
    observed,
    exit_code: result.exitCode,
  };
  console.log(JSON.stringify(output));
}

if (import.meta.main) main();
