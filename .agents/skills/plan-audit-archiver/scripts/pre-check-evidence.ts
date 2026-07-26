#!/usr/bin/env bun
/** First mechanical audit gate: validate the frozen contract's receipt ledger. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

type JsonObject = Record<string, unknown>;
const EVIDENCE_LEVELS = new Map([
  ["static", 0], ["manual", 0], ["component", 1], ["integration", 2],
  ["runtime-smoke", 3], ["live-LLM-E2E", 4],
]);

function asObject(value: unknown): JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function isWithin(root: string, path: string): boolean {
  const pathRelative = relative(root, path);
  return pathRelative !== "" && !pathRelative.startsWith("..") && !pathRelative.includes("../");
}

function allJsonFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { recursive: true })) {
    const file = join(root, String(entry));
    if (file.endsWith(".json") && statSync(file).isFile()) files.push(file);
  }
  return files;
}

/**
 * Checks only hash-bound receipt entries in a generated AUDIT_CONTRACT.
 * It never declares audit acceptance; callers must run validate-audit.ts next.
 */
export function precheckContract(contractPath: string): { issues: string[]; warnings: string[] } {
  const issues: string[] = [];
  const warnings: string[] = [];
  const root = resolve(contractPath, "..");
  let contract: JsonObject;
  try {
    contract = asObject(JSON.parse(readFileSync(contractPath, "utf8")));
  } catch {
    return { issues: ["CONTRACT_UNAVAILABLE"], warnings };
  }

  const ledger = Array.isArray(contract.evidence_receipts) ? contract.evidence_receipts.map(asObject) : [];
  const requirements = Array.isArray(contract.requirements) ? contract.requirements.map(asObject) : [];
  const receiptIds = new Set<string>();
  const receiptLevels = new Map<string, string>();
  const listedPaths = new Set<string>();

  for (const entry of ledger) {
    const receiptPath = String(entry.path ?? "");
    const absolutePath = resolve(root, receiptPath);
    const id = String(entry.id ?? "");
    listedPaths.add(receiptPath);
    if (!receiptPath || !isWithin(root, absolutePath)) {
      issues.push("EVIDENCE_RECEIPT_PATH_OUTSIDE_AUDIT");
      continue;
    }
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      issues.push("EVIDENCE_RECEIPT_NOT_FOUND");
      continue;
    }
    if (sha256(absolutePath) !== entry.sha256) {
      issues.push("EVIDENCE_HASH_MISMATCH");
      continue;
    }
    let receipt: JsonObject;
    try {
      receipt = asObject(JSON.parse(readFileSync(absolutePath, "utf8")));
    } catch {
      issues.push("EVIDENCE_RECEIPT_NOT_FOUND");
      continue;
    }
    if (receipt.id !== id || receipt.audit_id !== contract.audit_id || receipt.generation !== contract.generation) {
      issues.push("EVIDENCE_RECEIPT_AUDIT_MISMATCH");
    }
    const { path: _path, sha256: _hash, audit_id: _audit, generation: _generation, ...ledgerPayload } = entry;
    const { schema_version: _schema, audit_id: _receiptAudit, generation: _receiptGeneration, ...receiptPayload } = receipt;
    if (JSON.stringify(ledgerPayload) !== JSON.stringify(receiptPayload)) issues.push("EVIDENCE_RECEIPT_PAYLOAD_MISMATCH");
    if (receiptIds.has(id)) issues.push("DUPLICATE_ID");
    receiptIds.add(id);
    receiptLevels.set(id, String(entry.evidence_level ?? ""));
  }

  for (const requirement of requirements.filter((item) => item.kind === "BEHAVIORAL")) {
    const controls = [asObject(requirement.positive_control), asObject(requirement.negative_control)];
    const evidenceIds = controls.map((control) => String(control.evidence ?? "")).filter(Boolean);
    if (!evidenceIds.length || !evidenceIds.every((id) => receiptIds.has(id))) issues.push("EVIDENCE_RECEIPT_NOT_FOUND");
    const requiredLevel = EVIDENCE_LEVELS.get(String(requirement.required_evidence_level ?? ""));
    if (requiredLevel !== undefined && evidenceIds.some((id) => (EVIDENCE_LEVELS.get(receiptLevels.get(id) ?? "") ?? -1) < requiredLevel)) {
      issues.push("EVIDENCE_RECEIPT_LEVEL_TOO_LOW");
    }
  }

  for (const file of allJsonFiles(root)) {
    try {
      const receipt = asObject(JSON.parse(readFileSync(file, "utf8")));
      const pathRelative = relative(root, file);
      if (/^EV-\d+$/.test(String(receipt.id ?? "")) && !listedPaths.has(pathRelative)) warnings.push(`ORPHAN_RECEIPT_WARNING:${pathRelative}`);
    } catch { /* malformed unlisted JSON is not a receipt claim */ }
  }
  return { issues: [...new Set(issues)], warnings: [...new Set(warnings)] };
}

function main(): void {
  if (process.argv[2] !== "--contract" || !process.argv[3] || process.argv.length !== 4) {
    console.error("PRECHECK_ARGUMENT_INVALID");
    process.exitCode = 2;
    return;
  }
  const result = precheckContract(resolve(process.argv[3]!));
  console.log(JSON.stringify(result));
  process.exitCode = result.issues.length === 0 ? 0 : 1;
}

if (import.meta.main) main();
