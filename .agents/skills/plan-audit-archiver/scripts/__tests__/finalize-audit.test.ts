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

function writeV3Report(root: string, name: string, opts: { kind?: string } = {}): { path: string; sha256: string } {
  const content = buildAuditReportDocument({
    reportFilename: name,
    reportSha256: "deadbeef",
    canonicalSha256: CANONICAL,
    scopeLockSha256: SCOPE_LOCK,
  });
  // Re-emit with the actual file sha256 bound in, and optionally a wrong kind.
  const doc = JSON.parse(content);
  doc.report_sha256 = hashOf(JSON.stringify(doc, Object.keys(doc).sort()));
  if (opts.kind) doc.document_kind = opts.kind;
  const final = JSON.stringify(doc, Object.keys(doc).sort());
  const path = join(root, name);
  writeFileSync(path, final);
  const sha256 = hashOf(final);
  return { path, sha256 };
}

const happyOptions = (reportSha256: string): FinalizeOptions => ({ validate: () => ({ valid: true }), reportSha256, canonicalSha256: CANONICAL, scopeLockSha256: SCOPE_LOCK });

test("publishes a hash-bound LATEST pointer only after a valid audit", () => {
  const root = mkdtempSync(join(tmpdir(), "finalize-")), latest = join(root, "LATEST.md");
  const { path: report, sha256 } = writeV3Report(root, "audit.md");
  const result = finalizeAudit(report, latest, happyOptions(sha256));
  expect(result.sha256).toBe(sha256);
  const pointer = readFileSync(latest, "utf8");
  expect(pointer).toContain(sha256);
  expect(pointer).toContain("audit.md");
  rmSync(root, { recursive: true, force: true });
});

test("does not publish when the audit validator fails", () => {
  const root = mkdtempSync(join(tmpdir(), "finalize-")), latest = join(root, "LATEST.md");
  const { path: report } = writeV3Report(root, "audit.md");
  expect(() => finalizeAudit(report, latest, { ...happyOptions("x"), validate: () => ({ valid: false }) })).toThrow("AUDIT_VALIDATION_FAILED");
  expect(() => readFileSync(latest, "utf8")).toThrow();
  rmSync(root, { recursive: true, force: true });
});

test("does not overwrite an existing LATEST pointer", () => {
  const root = mkdtempSync(join(tmpdir(), "finalize-")), latest = join(root, "LATEST.md");
  const { path: report, sha256 } = writeV3Report(root, "audit.md");
  writeFileSync(latest, "old pointer");
  expect(() => finalizeAudit(report, latest, happyOptions(sha256))).toThrow("LATEST_POINTER_CONFLICT");
  expect(readFileSync(latest, "utf8")).toBe("old pointer");
  rmSync(root, { recursive: true, force: true });
});

test("published LATEST pointer parses as audit-governance-latest/v3::latest-pointer and binds report sha256", () => {
  const root = mkdtempSync(join(tmpdir(), "finalize-")), latest = join(root, "LATEST.md");
  const { path: report, sha256 } = writeV3Report(root, "audit.md");
  finalizeAudit(report, latest, happyOptions(sha256));
  const parsed = parseAuditGovernanceV3Document(Bun.YAML.parse(readFileSync(latest, "utf8")));
  if (!parsed.ok) throw new Error("pointer did not parse as v3");
  expect(parsed.value.schema_version).toBe("audit-governance-latest/v3");
  expect(parsed.value.document_kind).toBe("latest-pointer");
  expect((parsed.value as Record<string, unknown>).report_sha256).toBe(sha256);
  rmSync(root, { recursive: true, force: true });
});

test("produced report parses as audit-governance-report/v3::audit-report", () => {
  const root = mkdtempSync(join(tmpdir(), "finalize-")), latest = join(root, "LATEST.md");
  const { path: report, sha256 } = writeV3Report(root, "audit.md");
  finalizeAudit(report, latest, happyOptions(sha256));
  const parsed = parseAuditGovernanceV3Document(JSON.parse(readFileSync(report, "utf8")));
  if (!parsed.ok) throw new Error("report did not parse as v3");
  expect(parsed.value.schema_version).toBe("audit-governance-report/v3");
  expect(parsed.value.document_kind).toBe("audit-report");
  rmSync(root, { recursive: true, force: true });
});

test("failure-mutation matrix: every mutation blocks publication and preserves any prior pointer", () => {
  // Prior pointer present.
  const root = mkdtempSync(join(tmpdir(), "finalize-")), latest = join(root, "LATEST.md");
  writeFileSync(latest, "prior pointer");

  // (a) report hash drift vs declared
  const drift = writeV3Report(root, "drift.md");
  expect(() => finalizeAudit(drift.path, latest, happyOptions("nomatch"))).toThrow("REPORT_HASH_DRIFT");

  // (b) wrong schema kind (valid JSON, wrong document_kind)
  const wrongKind = writeV3Report(root, "wrong.md", { kind: "canonical-requirements" });
  expect(() => finalizeAudit(wrongKind.path, latest, happyOptions(wrongKind.sha256))).toThrow("REPORT_SCHEMA_INVALID");

  // (c) missing canonical/scope binding
  const unbinds = writeV3Report(root, "unbound.md");
  expect(() => finalizeAudit(unbinds.path, latest, { validate: () => ({ valid: true }), reportSha256: unbinds.sha256 })).toThrow("REPORT_BINDING_MISSING");

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
