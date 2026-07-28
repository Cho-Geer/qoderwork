#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { parseAuditGovernanceV3Document } from "../../../../scripts/lib/audit-governance-schema-v3.ts";

export type RepositoryStateEntry = {
  path: string;
  status: string;
  content_sha256: string;
};

export type RepositoryStateReceipt = {
  schema_version: "audit-evidence-receipt/v3";
  document_kind: "evidence-receipt";
  repository_realpath: string;
  phase_id: string;
  captured_at: string;
  head: string;
  scope_lock_sha256: string;
  status_entries: RepositoryStateEntry[];
};

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function git(repositoryRoot: string, args: string[]): string {
  const run = Bun.spawnSync({ cmd: ["git", "-C", repositoryRoot, ...args], stdout: "pipe", stderr: "pipe" });
  if (run.exitCode !== 0) throw new Error(run.stderr.toString().trim() || `git ${args.join(" ")} failed`);
  return run.stdout.toString();
}

function statusEntries(repositoryRoot: string): RepositoryStateEntry[] {
  const tokens = git(repositoryRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]).split("\0").filter(Boolean);
  const entries: RepositoryStateEntry[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const status = token.slice(0, 2);
    const paths = [token.slice(3)];
    if (/[RC]/.test(status) && tokens[index + 1]) paths.push(tokens[++index]);
    for (const path of paths.filter(Boolean)) {
      const absolute = resolve(repositoryRoot, path);
      entries.push({
        path,
        status,
        content_sha256: existsSync(absolute) && statSync(absolute).isFile() ? sha256File(absolute) : "MISSING",
      });
    }
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

export function captureRepositoryState(options: {
  repositoryRoot: string;
  scopeLockPath: string;
  phaseId: string;
  capturedAt?: string;
  freezeAt?: string;
}): RepositoryStateReceipt {
  if (!isAbsolute(options.repositoryRoot)) throw new Error("repositoryRoot must be absolute");
  if (!existsSync(options.scopeLockPath) || !statSync(options.scopeLockPath).isFile()) throw new Error("scopeLockPath must identify an existing file");
  if (options.freezeAt !== undefined) {
    if (Number.isNaN(Date.parse(options.freezeAt))) throw new Error("freezeAt must be ISO-8601");
    const lockContent: unknown = JSON.parse(readFileSync(options.scopeLockPath, "utf8"));
    if (typeof lockContent !== "object" || lockContent === null || typeof (lockContent as Record<string, unknown>).scope !== "object" || (lockContent as Record<string, unknown>).scope === null) {
      throw new Error("scope-lock must contain a scope object to use --freeze");
    }
    const scope = (lockContent as Record<string, unknown>).scope as Record<string, unknown>;
    scope.frozen_at = options.freezeAt;
    scope.status = "FROZEN";
    // Auto-fill created_at and approval.approved_at when they are still placeholders
    const lockObj = lockContent as Record<string, unknown>;
    if (typeof lockObj.created_at !== "string" || (lockObj.created_at as string).includes("REPLACE")) {
      lockObj.created_at = options.freezeAt;
    }
    const approval = lockObj.approval as Record<string, unknown> | undefined;
    if (approval && (typeof approval.approved_at !== "string" || (approval.approved_at as string).includes("REPLACE"))) {
      approval.approved_at = options.freezeAt;
    }
    writeFileSync(options.scopeLockPath, JSON.stringify(lockContent, null, 2) + "\n");
  }
  const repositoryRealpath = realpathSync(options.repositoryRoot);
  const gitRoot = realpathSync(git(repositoryRealpath, ["rev-parse", "--show-toplevel"]).trim());
  if (gitRoot !== repositoryRealpath) throw new Error(`repositoryRoot must equal git toplevel: ${gitRoot}`);
  const head = git(repositoryRealpath, ["rev-parse", "HEAD"]).trim();
  if (!/^[a-f0-9]{40}$/i.test(head)) throw new Error("git HEAD must be a full commit hash");
  const capturedAt = options.capturedAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(capturedAt))) throw new Error("capturedAt must be ISO-8601");
  if (!options.phaseId.trim()) throw new Error("phaseId must not be empty");
  const receipt = {
    schema_version: "audit-evidence-receipt/v3" as const,
    document_kind: "evidence-receipt" as const,
    repository_realpath: repositoryRealpath,
    phase_id: options.phaseId,
    captured_at: capturedAt,
    head,
    scope_lock_sha256: sha256File(options.scopeLockPath),
    status_entries: statusEntries(repositoryRealpath),
  };
  // Validate through shared parser to confirm v3 discriminator
  const validation = parseAuditGovernanceV3Document(receipt);
  if (!validation.ok) throw new Error(`state receipt failed shared parser: ${validation.error} — ${validation.message}`);
  return receipt;
}

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`missing ${name}`);
  return process.argv[index + 1];
}

function optionalArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) return undefined;
  return process.argv[index + 1];
}

function main() {
  try {
    const outputPath = argument("--output");
    const scopeLockPath = argument("--scope-lock");
    const phaseId = argument("--phase-id");
    // 防错警告：phase_id 应等于 scope-lock 的 lock_id（validator L1175 校验）
    try {
      const lockContent = JSON.parse(readFileSync(scopeLockPath, "utf8")) as Record<string, unknown>;
      const lockId = typeof lockContent.lock_id === "string" ? lockContent.lock_id : "";
      if (lockId && lockId !== phaseId) {
        console.error(`WARNING: --phase-id "${phaseId}" does not match scope-lock lock_id "${lockId}". validator will reject with PRE_CHANGE_PHASE_MISMATCH. Use --phase-id "${lockId}" to match.`);
      }
    } catch {
      // scope-lock 读取失败不阻断（可能尚未格式化好）
    }
    const receipt = captureRepositoryState({
      repositoryRoot: argument("--repository-root"),
      scopeLockPath,
      phaseId,
      freezeAt: optionalArgument("--freeze"),
    });
    mkdirSync(dirname(outputPath), { recursive: true });
    const text = `${JSON.stringify(receipt, null, 2)}\n`;
    writeFileSync(outputPath, text, { flag: "wx" });
    if (!statSync(outputPath).isFile() || statSync(outputPath).size === 0) throw new Error("state receipt write integrity check failed");
    JSON.parse(readFileSync(outputPath, "utf8"));
    const fileSha = sha256File(outputPath);
    const { captured_at, ...rest } = receipt;
    const canonicalSha = createHash("sha256").update(JSON.stringify(rest)).digest("hex");
    console.log(JSON.stringify({ path: outputPath, sha256: fileSha, canonical_sha256: canonicalSha, entries: receipt.status_entries.length }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (import.meta.main) main();
