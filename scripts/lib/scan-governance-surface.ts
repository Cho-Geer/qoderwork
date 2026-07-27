#!/usr/bin/env bun
/**
 * scan-governance-surface.ts — Findings-first governance surface scanner.
 *
 * Reads the governance surface manifest, executes ALL declared checks to
 * completion (never stops at first mismatch), and retains every discovered
 * mismatch as a stable finding. Exits nonzero when blocking findings exist,
 * but only after reporting the complete finding set.
 *
 * Uses the shared parser (parseAuditGovernanceV3Document) for schema validation.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { parseAuditGovernanceV3Document, SCHEMA_PAIRS } from "./audit-governance-schema-v3.ts";

export type FindingClassification = "BLOCKING" | "OPEN" | "CLOSED";

export type Finding = {
  finding_id: string;
  classification: FindingClassification;
  evidence_location: string;
  reason: string;
};

export type ScanResult = {
  manifest_path: string;
  entries_checked: number;
  checks_executed: string[];
  findings: Finding[];
  status: "NO_OPEN_FINDINGS" | "HAS_OPEN_FINDINGS" | "HAS_BLOCKING_FINDINGS";
};

type ManifestEntry = {
  path: string;
  sha256: string | null;
  owner: string;
  classification: string;
  consumers: string[];
  allowed_references: string[];
  forbidden_references: string[];
};

type Manifest = {
  schema_version: string;
  document_kind: string;
  manifest_id: string;
  entries: ManifestEntry[];
};

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

/**
 * Validate the manifest itself through the shared parser.
 */
function validateManifestSchema(manifest: unknown): Finding[] {
  const findings: Finding[] = [];
  const result = parseAuditGovernanceV3Document(manifest);
  if (!result.ok) {
    findings.push({
      finding_id: "F-MANIFEST-SCHEMA-INVALID",
      classification: "BLOCKING",
      evidence_location: "governance-surface-manifest.yaml",
      reason: `manifest failed shared parser validation: ${result.error} — ${result.message}`,
    });
  }
  return findings;
}

/**
 * Check hash integrity for every ACTIVE entry with a non-null sha256.
 */
function checkHashIntegrity(entries: ManifestEntry[], root: string): Finding[] {
  const findings: Finding[] = [];
  for (const entry of entries) {
    if (entry.classification !== "ACTIVE") continue;
    if (entry.sha256 === null) continue;
    const fullPath = resolve(root, entry.path);
    if (!existsSync(fullPath)) {
      findings.push({
        finding_id: `F-HASH-DRIFT:${entry.path}`,
        classification: "BLOCKING",
        evidence_location: entry.path,
        reason: `file not found at expected path`,
      });
      continue;
    }
    const actual = sha256File(fullPath);
    if (actual !== entry.sha256) {
      findings.push({
        finding_id: `F-HASH-DRIFT:${entry.path}`,
        classification: "BLOCKING",
        evidence_location: entry.path,
        reason: `sha256 mismatch: manifest=${entry.sha256} actual=${actual}`,
      });
    }
  }
  return findings;
}

/**
 * Check for duplicate entries in the manifest.
 */
function checkDuplicateEntries(entries: ManifestEntry[]): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.path)) {
      findings.push({
        finding_id: `F-DUPLICATE-ENTRY:${entry.path}`,
        classification: "BLOCKING",
        evidence_location: entry.path,
        reason: `duplicate manifest entry for path`,
      });
    }
    seen.add(entry.path);
  }
  return findings;
}

/**
 * Check forbidden references are not present in active assets.
 */
function checkForbiddenReferences(entries: ManifestEntry[], root: string): Finding[] {
  const findings: Finding[] = [];
  for (const entry of entries) {
    if (entry.classification !== "ACTIVE") continue;
    if (!entry.forbidden_references || entry.forbidden_references.length === 0) continue;
    const fullPath = resolve(root, entry.path);
    if (!existsSync(fullPath)) continue;
    const content = readFileSync(fullPath, "utf8");
    for (const forbidden of entry.forbidden_references) {
      if (content.includes(forbidden)) {
        findings.push({
          finding_id: `F-ILLEGAL-REFERENCE:${entry.path}:${forbidden}`,
          classification: "BLOCKING",
          evidence_location: entry.path,
          reason: `forbidden reference "${forbidden}" found in content`,
        });
      }
    }
  }
  return findings;
}

/**
 * Authoritative v3 schema-family discriminators (the schema_version side of every
 * SCHEMA_PAIR) plus the known pre-v3 stand-ins that a consumer might still interpret
 * locally for schema-document discrimination. The legitimate plan-index progression
 * marker `phase-progression/v1` (consumed only by isProgressionSchema / the P-02A
 * gate) is deliberately NOT a member, so it is never flagged as consumer-local.
 */
const V3_SCHEMA_DISCRIMINATORS: readonly string[] = [...new Set(SCHEMA_PAIRS.map(([schemaVersion]) => schemaVersion))];
const PRE_V3_SCHEMA_STAND_INS = ["2.1", "1.0", "audit-boundary-matrix/v1", "boundary-contract/v1"] as const;

/**
 * Return the first v3 schema-family discriminator (or pre-v3 stand-in) that `content`
 * interprets consumer-locally, matched as a quoted string literal. Returns null when
 * the file delegates schema discrimination to the shared parser (or only carries the
 * legitimate plan-index progression marker).
 */
function consumerLocalDiscriminator(content: string): string | null {
  for (const discriminator of [...V3_SCHEMA_DISCRIMINATORS, ...PRE_V3_SCHEMA_STAND_INS]) {
    if (content.includes(`"${discriminator}"`) || content.includes(`'${discriminator}'`)) {
      return discriminator;
    }
  }
  return null;
}

/**
 * Detect consumer-local schema interpretations that bypass the shared parser.
 * These are OPEN findings inherited by later phases — never closed in PHASE-01.
 */
function checkConsumerLocalParsers(entries: ManifestEntry[], root: string): Finding[] {
  const findings: Finding[] = [];

  // F-PHASE01-TEMPLATE-PROGRESSION-MARKER: PLAN-SET-TEMPLATE.md lacks progression marker
  const templatePath = ".agents/skills/deterministic-implementation-planning/PLAN-SET-TEMPLATE.md";
  const templateFull = resolve(root, templatePath);
  if (existsSync(templateFull)) {
    const content = readFileSync(templateFull, "utf8");
    if (!content.includes("**Progression schema**") && !content.includes("Progression status")) {
      findings.push({
        finding_id: "F-PHASE01-TEMPLATE-PROGRESSION-MARKER",
        classification: "OPEN",
        evidence_location: templatePath,
        reason: "v3 PLAN-SET-TEMPLATE.md omits the progression marker field",
      });
    }
  }

  // phase-progression.ts: the receipt discrimination now delegates to the shared v3
  // parser. The residual "phase-progression/v1" literal is the legitimate plan-index
  // progression marker (isProgressionSchema / P-02A gate) and is NOT a v3 schema-family
  // discriminator, so it must not be flagged. Only a consumer-local interpretation of a
  // v3 schema-family discriminator (or pre-v3 stand-in) is a finding here.
  const phaseProgressionPath = ".agents/skills/deterministic-implementation-planning/scripts/phase-progression.ts";
  const phaseProgressionFull = resolve(root, phaseProgressionPath);
  if (existsSync(phaseProgressionFull)) {
    const content = readFileSync(phaseProgressionFull, "utf8");
    const discriminator = consumerLocalDiscriminator(content);
    if (discriminator) {
      findings.push({
        finding_id: `F-CONSUMER-LOCAL:phase-progression.ts:${discriminator}`,
        classification: "OPEN",
        evidence_location: phaseProgressionPath,
        reason: `consumer-local ${discriminator} schema interpretation instead of shared v3 parser`,
      });
    }
  }

  // validate-audit.ts consumer-local 2.1 and audit-boundary-matrix/v1
  const validateAuditPath = ".agents/skills/plan-audit-archiver/scripts/validate-audit.ts";
  const validateAuditFull = resolve(root, validateAuditPath);
  if (existsSync(validateAuditFull)) {
    const content = readFileSync(validateAuditFull, "utf8");
    if (content.includes(`"2.1"`) || content.includes(`'2.1'`)) {
      findings.push({
        finding_id: "F-CONSUMER-LOCAL:validate-audit.ts:schema_version-2.1",
        classification: "OPEN",
        evidence_location: validateAuditPath,
        reason: "consumer-local schema_version 2.1 interpretation instead of shared v3 parser",
      });
    }
    if (content.includes(`"audit-boundary-matrix/v1"`) || content.includes(`'audit-boundary-matrix/v1'`)) {
      findings.push({
        finding_id: "F-CONSUMER-LOCAL:validate-audit.ts:audit-boundary-matrix/v1",
        classification: "OPEN",
        evidence_location: validateAuditPath,
        reason: "consumer-local audit-boundary-matrix/v1 interpretation instead of shared v3 parser",
      });
    }
  }

  // audit-boundary-precheck.ts consumer-local boundary-contract/v1
  const precheckPath = ".agents/skills/plan-audit-archiver/scripts/audit-boundary-precheck.ts";
  const precheckFull = resolve(root, precheckPath);
  if (existsSync(precheckFull)) {
    const content = readFileSync(precheckFull, "utf8");
    if (content.includes(`"boundary-contract/v1"`) || content.includes(`'boundary-contract/v1'`)) {
      findings.push({
        finding_id: "F-CONSUMER-LOCAL:audit-boundary-precheck.ts:boundary-contract/v1",
        classification: "OPEN",
        evidence_location: precheckPath,
        reason: "consumer-local boundary-contract/v1 interpretation instead of shared v3 parser",
      });
    }
  }

  // capture-state.ts / prepare-audit.ts / generate-evidence-receipt.ts / pre-check-evidence.ts consumer-local schema_version
  const consumerLocalScripts = [
    ".agents/skills/plan-audit-archiver/scripts/capture-state.ts",
    ".agents/skills/plan-audit-archiver/scripts/prepare-audit.ts",
    ".agents/skills/plan-audit-archiver/scripts/generate-evidence-receipt.ts",
    ".agents/skills/plan-audit-archiver/scripts/pre-check-evidence.ts",
  ];
  for (const scriptPath of consumerLocalScripts) {
    const fullPath = resolve(root, scriptPath);
    if (!existsSync(fullPath)) continue;
    const content = readFileSync(fullPath, "utf8");
    // Detect consumer-local schema_version declarations or local envelope stripping
    const hasLocalDeclaration = content.includes(`schema_version: "1.0"`) || content.includes(`schema_version: "2.1"`) || content.includes(`"schema_version": "1.0"`);
    const hasLocalStripping = content.includes(`schema_version: _schema`) || content.includes(`schema_version: _sv`);
    if (hasLocalDeclaration || hasLocalStripping) {
      const fileName = scriptPath.split("/").pop() ?? scriptPath;
      findings.push({
        finding_id: `F-CONSUMER-LOCAL:${fileName}:schema_version`,
        classification: "OPEN",
        evidence_location: scriptPath,
        reason: "consumer-local schema_version interpretation instead of shared v3 parser",
      });
    }
  }

  // scope-lock-template.json and evidence-receipt-template.json pre-v3 schema_version and provenance exposure
  const templateFiles = [
    ".agents/skills/plan-audit-archiver/templates/scope-lock-template.json",
    ".agents/skills/plan-audit-archiver/templates/evidence-receipt-template.json",
  ];
  for (const tplPath of templateFiles) {
    const fullPath = resolve(root, tplPath);
    if (!existsSync(fullPath)) continue;
    const content = readFileSync(fullPath, "utf8");
    const fileName = tplPath.split("/").pop() ?? tplPath;
    if (content.includes(`"schema_version": "1.0"`)) {
      findings.push({
        finding_id: `F-CONSUMER-LOCAL:${fileName}:pre-v3-schema_version`,
        classification: "OPEN",
        evidence_location: tplPath,
        reason: "pre-v3 schema_version 1.0 exposed in active template",
      });
    }
    if (content.includes(`"provenance_level": "v2.1-required"`)) {
      findings.push({
        finding_id: `F-CONSUMER-LOCAL:${fileName}:provenance-exposure`,
        classification: "OPEN",
        evidence_location: tplPath,
        reason: "pre-v3 provenance_level v2.1-required exposed in active template",
      });
    }
  }

  return findings;
}

/**
 * Check that historical/quarantined entries are never opened by the scanner.
 * This is a self-check: the scanner must NOT read content of HISTORICAL entries.
 */
function checkHistoricalNotOpened(entries: ManifestEntry[]): Finding[] {
  const findings: Finding[] = [];
  for (const entry of entries) {
    if (entry.classification === "HISTORICAL" || entry.classification === "QUARANTINED") {
      if (entry.sha256 !== null) {
        findings.push({
          finding_id: `F-HISTORICAL-HASH-EXPOSED:${entry.path}`,
          classification: "BLOCKING",
          evidence_location: entry.path,
          reason: "historical/quarantined entry must not have sha256 (path-only classification)",
        });
      }
    }
  }
  return findings;
}

/**
 * Main scan: runs ALL checks to completion, collects all findings.
 */
export function scanGovernanceSurface(manifestPath: string): ScanResult {
  const root = resolve(dirname(manifestPath), "../..");
  const checksExecuted: string[] = [];
  let allFindings: Finding[] = [];

  // Parse manifest YAML
  let manifest: Manifest;
  try {
    const raw = readFileSync(manifestPath, "utf8");
    manifest = Bun.YAML.parse(raw) as Manifest;
  } catch (err) {
    return {
      manifest_path: manifestPath,
      entries_checked: 0,
      checks_executed: ["manifest_parse"],
      findings: [{
        finding_id: "F-MANIFEST-PARSE-ERROR",
        classification: "BLOCKING",
        evidence_location: manifestPath,
        reason: `failed to parse manifest: ${err}`,
      }],
      status: "HAS_BLOCKING_FINDINGS",
    };
  }

  const entries = manifest.entries ?? [];

  // Check 1: manifest schema validation via shared parser
  checksExecuted.push("manifest_schema_validation");
  allFindings.push(...validateManifestSchema(manifest));

  // Check 2: hash integrity
  checksExecuted.push("hash_integrity");
  allFindings.push(...checkHashIntegrity(entries, root));

  // Check 3: duplicate entries
  checksExecuted.push("duplicate_entries");
  allFindings.push(...checkDuplicateEntries(entries));

  // Check 4: forbidden references
  checksExecuted.push("forbidden_references");
  allFindings.push(...checkForbiddenReferences(entries, root));

  // Check 5: consumer-local parser detection
  checksExecuted.push("consumer_local_parsers");
  allFindings.push(...checkConsumerLocalParsers(entries, root));

  // Check 6: historical entries not opened
  checksExecuted.push("historical_not_opened");
  allFindings.push(...checkHistoricalNotOpened(entries));

  // Determine status
  const hasBlocking = allFindings.some(f => f.classification === "BLOCKING");
  const hasOpen = allFindings.some(f => f.classification === "OPEN");
  let status: ScanResult["status"];
  if (hasBlocking) {
    status = "HAS_BLOCKING_FINDINGS";
  } else if (hasOpen) {
    status = "HAS_OPEN_FINDINGS";
  } else {
    status = "NO_OPEN_FINDINGS";
  }

  return {
    manifest_path: manifestPath,
    entries_checked: entries.length,
    checks_executed: checksExecuted,
    findings: allFindings,
    status,
  };
}

// CLI entry point
if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("usage: scan-governance-surface.ts <manifest.yaml>");
    process.exit(2);
  }
  const manifestPath = resolve(args[0]);
  if (!existsSync(manifestPath)) {
    console.error(`manifest not found: ${manifestPath}`);
    process.exit(2);
  }

  const result = scanGovernanceSurface(manifestPath);

  // Report complete finding set
  console.log(JSON.stringify(result, null, 2));

  // Exit nonzero if blocking findings exist
  if (result.status === "HAS_BLOCKING_FINDINGS") {
    process.exit(1);
  }
  // OPEN findings do NOT cause nonzero exit (they are inherited, not blocking)
  process.exit(0);
}
