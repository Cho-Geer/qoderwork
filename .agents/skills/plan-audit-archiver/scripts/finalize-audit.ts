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

/** Stable JSON rendering (sorted keys) for immutable, hash-addressable v3 documents. */
function stableStringify(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
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
 * Finalize an audit: validate the report parses as audit-governance-report/v3, then atomically
 * publish a CAS LATEST pointer bound to the report + settled canonical/scope-lock hashes.
 * Fail-closed: no publish on validator failure (AUDIT_VALIDATION_FAILED), schema rejection
 * (REPORT_SCHEMA_INVALID), hash drift (REPORT_HASH_DRIFT), missing binding (REPORT_BINDING_MISSING),
 * or existing pointer (LATEST_POINTER_CONFLICT).
 */
export function finalizeAudit(
  reportPath: string,
  latestPath: string,
  options: FinalizeOptions = {},
): { report: string; sha256: string; latestPointer: string } {
  const { validate = validateAuditFile, reportSha256, canonicalSha256, scopeLockSha256 } = options;
  if (!existsSync(reportPath) || !statSync(reportPath).isFile() || statSync(reportPath).size === 0) throw new Error("REPORT_UNAVAILABLE");

  // Fail-closed gate 1: caller semantic validator must pass.
  if (!validate(reportPath).valid) throw new Error("AUDIT_VALIDATION_FAILED");

  // Report must parse as a v3 audit-report document.
  let reportDoc: unknown;
  try {
    reportDoc = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch {
    throw new Error("REPORT_SCHEMA_INVALID");
  }
  const reportResult = parseAuditGovernanceV3Document(reportDoc);
  if (!reportResult.ok || reportResult.value.schema_version !== "audit-governance-report/v3" || reportResult.value.document_kind !== "audit-report") {
    throw new Error("REPORT_SCHEMA_INVALID");
  }

  const content = readFileSync(reportPath);
  const sha256 = createHash("sha256").update(content).digest("hex");

  // Fail-closed: declared report hash must match computed file hash.
  if (reportSha256 !== undefined && reportSha256 !== sha256) throw new Error("REPORT_HASH_DRIFT");

  // Fail-closed: required settlement bindings must be present.
  if (!canonicalSha256 || !scopeLockSha256) throw new Error("REPORT_BINDING_MISSING");

  // Fail-closed gate 2: never overwrite an existing pointer.
  if (existsSync(latestPath)) throw new Error("LATEST_POINTER_CONFLICT");

  const latestDoc = buildLatestPointerDocument({
    reportFilename: basename(reportPath),
    reportSha256: sha256,
    canonicalSha256,
    scopeLockSha256,
  });

  // Atomic CAS: temp write + rename.
  const temp = join(dirname(latestPath), `.${basename(latestPath)}.${process.pid}.tmp`);
  writeFileSync(temp, latestDoc, { flag: "wx" });
  renameSync(temp, latestPath);
  return { report: basename(reportPath), sha256, latestPointer: latestDoc };
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
