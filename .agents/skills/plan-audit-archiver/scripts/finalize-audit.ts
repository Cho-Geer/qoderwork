#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { parseAuditGovernanceV3Document } from "../../../../scripts/lib/audit-governance-schema-v3.ts";
import { validateAuditFile } from "./validate-audit.ts";

type AuditValidator = (reportPath: string) => { valid: boolean };

export type FinalizeOptions = {
  /** Caller-supplied semantic validator. Fail-closed: AUDIT_VALIDATION_FAILED when invalid. */
  validate?: AuditValidator;
  /** Declared report sha256. When provided it MUST match the computed file hash (REPORT_HASH_DRIFT). */
  reportSha256?: string;
  /** Canonical requirements contract sha256 this publication settles. Required. */
  canonicalSha256?: string;
  /** Phase scope-lock sha256 this publication settles. Required. */
  scopeLockSha256?: string;
};

/** Recursively sort object keys (arrays preserved order-wise) for deterministic rendering. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) sorted[key] = sortKeys(source[key]);
    return sorted;
  }
  return value;
}

/** Stable JSON rendering (sorted keys) for immutable, hash-addressable v3 documents. */
function stableStringify(obj: Record<string, unknown>): string {
  return JSON.stringify(sortKeys(obj));
}

/**
 * Build the immutable report CONTENT as a parseable audit-governance-report/v3::audit-report
 * JSON document (hash-stable). The caller may write this to the report file so the report
 * itself is a valid v3 doc rather than arbitrary markdown.
 */
export function buildAuditReportDocument(input: {
  reportFilename: string;
  reportSha256: string;
  canonicalSha256?: string;
  scopeLockSha256?: string;
}): string {
  const doc = {
    schema_version: "audit-governance-report/v3",
    document_kind: "audit-report",
    report_filename: input.reportFilename,
    report_sha256: input.reportSha256,
    settles: {
      canonical_contract_sha256: input.canonicalSha256 ?? null,
      scope_lock_sha256: input.scopeLockSha256 ?? null,
    },
  };
  return stableStringify(doc);
}

/**
 * Build the LATEST pointer CONTENT as a parseable audit-governance-latest/v3::latest-pointer
 * YAML document (hash-stable), binding the report filename + report sha256 + the
 * canonical/scope-lock hashes it settles.
 */
export function buildLatestPointerDocument(input: {
  reportFilename: string;
  reportSha256: string;
  canonicalSha256: string;
  scopeLockSha256: string;
}): string {
  return [
    `schema_version: audit-governance-latest/v3`,
    `document_kind: latest-pointer`,
    `report_filename: ${input.reportFilename}`,
    `report_sha256: ${input.reportSha256}`,
    `settles:`,
    `  canonical_contract_sha256: ${input.canonicalSha256}`,
    `  scope_lock_sha256: ${input.scopeLockSha256}`,
  ].join("\n") + "\n";
}

/**
 * Finalize an audit: validate the markdown report, then atomically publish a CAS
 * LATEST pointer bound to a hash-stable v3 audit-report document derived from the
 * embedded AUDIT_CONTRACT block, plus the settled canonical/scope-lock hashes.
 *
 * v3 design:
 *   - reportPath is a markdown audit.md file containing `<!-- AUDIT_CONTRACT_START --> ... ```json ... ``` <!-- AUDIT_CONTRACT_END -->`
 *   - We extract the embedded JSON contract (audit-governance-audit/v3::audit-contract).
 *   - We build a hash-stable audit-report/v3::audit-report document via buildAuditReportDocument
 *     and write it to `<basename>-report.json` next to the markdown.
 *   - The LATEST pointer binds to that JSON report filename (NOT the markdown), so the
 *     publication address is a parseable v3 doc.
 *
 * Fail-closed: no publish on validator failure (AUDIT_VALIDATION_FAILED), missing
 * contract block (CONTRACT_BLOCK_MISSING), bad contract JSON (CONTRACT_JSON_INVALID),
 * hash drift (REPORT_HASH_DRIFT), missing binding (REPORT_BINDING_MISSING), or
 * existing pointer (LATEST_POINTER_CONFLICT).
 */
const CONTRACT_BLOCK_RE = /<!-- AUDIT_CONTRACT_START -->\s*```json\n([\s\S]*?)\n```\s*<!-- AUDIT_CONTRACT_END -->/;

export function finalizeAudit(
  reportPath: string,
  latestPath: string,
  options: FinalizeOptions = {},
): { report: string; sha256: string; latestPointer: string; auditReportDoc: string } {
  const { validate = validateAuditFile, reportSha256, canonicalSha256, scopeLockSha256 } = options;
  if (!existsSync(reportPath) || !statSync(reportPath).isFile() || statSync(reportPath).size === 0) throw new Error("REPORT_UNAVAILABLE");

  // Fail-closed gate 1: caller semantic validator must pass against the markdown.
  if (!validate(reportPath).valid) throw new Error("AUDIT_VALIDATION_FAILED");

  // Extract the embedded audit-contract JSON block from the markdown.
  const markdown = readFileSync(reportPath, "utf8");
  const match = markdown.match(CONTRACT_BLOCK_RE);
  if (!match) throw new Error("CONTRACT_BLOCK_MISSING");
  let contract: unknown;
  try {
    contract = JSON.parse(match[1]);
  } catch (err) {
    throw new Error(`CONTRACT_JSON_INVALID: ${err instanceof Error ? err.message : String(err)}`);
  }
  const contractResult = parseAuditGovernanceV3Document(contract);
  if (!contractResult.ok || contractResult.value.schema_version !== "audit-governance-audit/v3" || contractResult.value.document_kind !== "audit-contract") {
    throw new Error("CONTRACT_SCHEMA_INVALID");
  }

  const content = readFileSync(reportPath);
  const sha256 = createHash("sha256").update(content).digest("hex");

  // Fail-closed: declared report hash must match computed file hash.
  if (reportSha256 !== undefined && reportSha256 !== sha256) throw new Error("REPORT_HASH_DRIFT");

  // Fail-closed: required settlement bindings must be present.
  if (!canonicalSha256 || !scopeLockSha256) throw new Error("REPORT_BINDING_MISSING");

  // Build the hash-stable v3 audit-report document and write it next to the markdown.
  const reportFilename = basename(reportPath);
  const auditReportFilename = `${basename(reportPath, ".md")}-report.json`;
  const auditReportPath = join(dirname(reportPath), auditReportFilename);
  const auditReportDoc = buildAuditReportDocument({
    reportFilename,
    reportSha256: sha256,
    canonicalSha256,
    scopeLockSha256,
  });
  if (existsSync(auditReportPath)) throw new Error("AUDIT_REPORT_DOC_CONFLICT");
  writeFileSync(auditReportPath, auditReportDoc, { flag: "wx" });

  // Compute audit-report.json sha256 for the LATEST pointer binding.
  const auditReportSha256 = createHash("sha256").update(auditReportDoc).digest("hex");

  // Fail-closed gate 2: never overwrite an existing pointer.
  if (existsSync(latestPath)) throw new Error("LATEST_POINTER_CONFLICT");

  const latestDoc = buildLatestPointerDocument({
    reportFilename: auditReportFilename,
    reportSha256: auditReportSha256,
    canonicalSha256,
    scopeLockSha256,
  });

  // Atomic CAS: temp write + rename.
  const temp = join(dirname(latestPath), `.${basename(latestPath)}.${process.pid}.tmp`);
  writeFileSync(temp, latestDoc, { flag: "wx" });
  renameSync(temp, latestPath);
  return { report: auditReportFilename, sha256: auditReportSha256, latestPointer: latestDoc, auditReportDoc };
}

if (import.meta.main) {
  const [report, latest, canonical, scope] = process.argv.slice(2);
  if (!report || !latest || !canonical || !scope) {
    console.error("usage: finalize-audit.ts <report.json> <LATEST.md> <canonicalSha256> <scopeLockSha256>");
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(finalizeAudit(resolve(report), resolve(latest), { canonicalSha256: canonical, scopeLockSha256: scope })));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
