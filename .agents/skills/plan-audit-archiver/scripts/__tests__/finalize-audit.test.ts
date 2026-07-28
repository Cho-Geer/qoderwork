import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseAuditGovernanceV3Document } from "../../../../../scripts/lib/audit-governance-schema-v3.ts";
import { finalizeAudit, buildAuditReportDocument, buildLatestPointerDocument, type FinalizeOptions } from "../finalize-audit.ts";

const CANONICAL = "dd58ef590956c85c7ce96743589b1e25aa956e7a1030f0502ecbde59f6afd748";
const SCOPE_LOCK = "1c5abfab73ace7a8c591991ecd13bf59d19af65389a26525dc974a746844700d";

function hashOf(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Write a markdown audit report with an embedded AUDIT_CONTRACT json block, matching
 * the v3 finalize-audit input contract. Returns the file path + its sha256 (the sha
 * finalize-audit binds as report_sha256 inside the derived audit-report document).
 */
function writeMarkdownAudit(
  root: string,
  name: string,
  opts: { contractSchema?: string; contractKind?: string; rawContract?: string } = {},
): { path: string; sha256: string } {
  const contract = opts.rawContract ?? JSON.stringify({
    schema_version: opts.contractSchema ?? "audit-governance-audit/v3",
    document_kind: opts.contractKind ?? "audit-contract",
    audit_id: "TEST-AUDIT-001",
  });
  const md = `# Audit\n\n<!-- AUDIT_CONTRACT_START -->\n\`\`\`json\n${contract}\n\`\`\`\n<!-- AUDIT_CONTRACT_END -->\n`;
  const path = join(root, name);
  writeFileSync(path, md);
  return { path, sha256: hashOf(md) };
}

const happyOptions = (reportSha256: string): FinalizeOptions => ({ validate: () => ({ valid: true }), reportSha256, canonicalSha256: CANONICAL, scopeLockSha256: SCOPE_LOCK });

test("publishes a hash-bound LATEST pointer to a derived audit-report.json only after a valid audit", () => {
  const root = mkdtempSync(join(tmpdir(), "finalize-")), latest = join(root, "LATEST.md");
  const { path: report, sha256 } = writeMarkdownAudit(root, "audit.md");
  const result = finalizeAudit(report, latest, happyOptions(sha256));

  // The publication address is the derived audit-report.json, not the markdown.
  expect(result.report).toBe("audit-report.json");
  const expectedDoc = buildAuditReportDocument({ reportFilename: "audit.md", reportSha256: sha256, canonicalSha256: CANONICAL, scopeLockSha256: SCOPE_LOCK });
  expect(result.auditReportDoc).toBe(expectedDoc);
  expect(result.sha256).toBe(hashOf(expectedDoc));

  // audit-report.json is written next to the markdown and its hash matches the pointer binding.
  const reportJsonPath = join(root, "audit-report.json");
  expect(readFileSync(reportJsonPath, "utf8")).toBe(expectedDoc);
  expect(hashOf(readFileSync(reportJsonPath, "utf8"))).toBe(result.sha256);

  // The derived report settles the canonical + scope-lock hashes (stableStringify must
  // preserve nested keys, not drop them).
  const parsedReport = JSON.parse(readFileSync(reportJsonPath, "utf8")) as Record<string, any>;
  expect(parsedReport.settles.canonical_contract_sha256).toBe(CANONICAL);
  expect(parsedReport.settles.scope_lock_sha256).toBe(SCOPE_LOCK);

  // LATEST pointer binds the JSON report filename + sha (not the markdown).
  const pointer = readFileSync(latest, "utf8");
  expect(pointer).toContain(result.sha256);
  expect(pointer).toContain("audit-report.json");
  rmSync(root, { recursive: true, force: true });
});

test("does not publish when the audit validator fails", () => {
  const root = mkdtempSync(join(tmpdir(), "finalize-")), latest = join(root, "LATEST.md");
  const { path: report } = writeMarkdownAudit(root, "audit.md");
  expect(() => finalizeAudit(report, latest, { ...happyOptions("x"), validate: () => ({ valid: false }) })).toThrow("AUDIT_VALIDATION_FAILED");
  expect(() => readFileSync(latest, "utf8")).toThrow();
  rmSync(root, { recursive: true, force: true });
});

test("does not overwrite an existing LATEST pointer", () => {
  const root = mkdtempSync(join(tmpdir(), "finalize-")), latest = join(root, "LATEST.md");
  const { path: report, sha256 } = writeMarkdownAudit(root, "audit.md");
  writeFileSync(latest, "old pointer");
  expect(() => finalizeAudit(report, latest, happyOptions(sha256))).toThrow("LATEST_POINTER_CONFLICT");
  expect(readFileSync(latest, "utf8")).toBe("old pointer");
  rmSync(root, { recursive: true, force: true });
});

test("published LATEST pointer parses as audit-governance-latest/v3::latest-pointer and binds the JSON report sha256", () => {
  const root = mkdtempSync(join(tmpdir(), "finalize-")), latest = join(root, "LATEST.md");
  const { path: report, sha256 } = writeMarkdownAudit(root, "audit.md");
  const result = finalizeAudit(report, latest, happyOptions(sha256));
  const parsed = parseAuditGovernanceV3Document(Bun.YAML.parse(readFileSync(latest, "utf8")));
  if (!parsed.ok) throw new Error("pointer did not parse as v3");
  expect(parsed.value.schema_version).toBe("audit-governance-latest/v3");
  expect(parsed.value.document_kind).toBe("latest-pointer");
  expect((parsed.value as Record<string, unknown>).report_sha256).toBe(result.sha256);
  expect((parsed.value as Record<string, unknown>).report_filename).toBe("audit-report.json");
  rmSync(root, { recursive: true, force: true });
});

test("derived audit-report.json parses as audit-governance-report/v3::audit-report", () => {
  const root = mkdtempSync(join(tmpdir(), "finalize-")), latest = join(root, "LATEST.md");
  const { path: report, sha256 } = writeMarkdownAudit(root, "audit.md");
  const result = finalizeAudit(report, latest, happyOptions(sha256));
  const parsed = parseAuditGovernanceV3Document(JSON.parse(readFileSync(join(root, result.report), "utf8")));
  if (!parsed.ok) throw new Error("report did not parse as v3");
  expect(parsed.value.schema_version).toBe("audit-governance-report/v3");
  expect(parsed.value.document_kind).toBe("audit-report");
  rmSync(root, { recursive: true, force: true });
});

test("failure-mutation matrix: every mutation blocks publication and preserves any prior pointer", () => {
  const root = mkdtempSync(join(tmpdir(), "finalize-")), latest = join(root, "LATEST.md");
  writeFileSync(latest, "prior pointer");

  // (a) report hash drift vs declared markdown sha
  const drift = writeMarkdownAudit(root, "drift.md");
  expect(() => finalizeAudit(drift.path, latest, happyOptions("nomatch"))).toThrow("REPORT_HASH_DRIFT");

  // (b) embedded contract is a valid v3 doc but not an audit-contract
  const wrongKind = writeMarkdownAudit(root, "wrong.md", { contractSchema: "audit-governance-report/v3", contractKind: "audit-report" });
  expect(() => finalizeAudit(wrongKind.path, latest, happyOptions(wrongKind.sha256))).toThrow("CONTRACT_SCHEMA_INVALID");

  // (c) missing canonical/scope binding
  const unbinds = writeMarkdownAudit(root, "unbound.md");
  expect(() => finalizeAudit(unbinds.path, latest, { validate: () => ({ valid: true }), reportSha256: unbinds.sha256 })).toThrow("REPORT_BINDING_MISSING");

  // (d) markdown without an AUDIT_CONTRACT block
  const noContractPath = join(root, "nocontract.md");
  const noContractMd = "# Audit\n\nno contract here\n";
  writeFileSync(noContractPath, noContractMd);
  expect(() => finalizeAudit(noContractPath, latest, happyOptions(hashOf(noContractMd)))).toThrow("CONTRACT_BLOCK_MISSING");

  // (e) contract block with invalid JSON
  const badJson = writeMarkdownAudit(root, "badjson.md", { rawContract: "{ not valid json" });
  expect(() => finalizeAudit(badJson.path, latest, happyOptions(badJson.sha256))).toThrow("CONTRACT_JSON_INVALID");

  // Prior pointer must be unchanged in all cases.
  expect(readFileSync(latest, "utf8")).toBe("prior pointer");
  rmSync(root, { recursive: true, force: true });
});

test("helper builds a parseable v3 latest-pointer document", () => {
  const doc = buildLatestPointerDocument({ reportFilename: "r.md", reportSha256: "abc", canonicalSha256: CANONICAL, scopeLockSha256: SCOPE_LOCK });
  const parsed = parseAuditGovernanceV3Document(Bun.YAML.parse(doc));
  if (!parsed.ok) throw new Error("pointer did not parse as v3");
  expect(parsed.value.schema_version).toBe("audit-governance-latest/v3");
  expect(parsed.value!.document_kind).toBe("latest-pointer");
});
