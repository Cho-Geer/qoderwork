#!/usr/bin/env bun
/**
 * generate-phase-projection.ts — Phase projection generator.
 *
 * Generates an audit-phase-projection/v3::phase-projection document that binds:
 * - approved canonical path/hash
 * - its own phase scope-lock path/hash
 * - selected REQ/DC identities
 * - fixture/oracle IDs
 * - explicit receipt path declarations
 *
 * Failure semantics (REQ-003):
 * - canonical hash drift → ERR_CANONICAL_HASH
 * - scope-lock hash drift → ERR_SCOPE_LOCK_HASH
 * - REQ/DC missing/duplicate/unselected/mutated → ERR_CASE_SELECTION
 *
 * Uses the shared parser (parseAuditGovernanceV3Document).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseAuditGovernanceV3Document } from "../../../../scripts/lib/audit-governance-schema-v3.ts";

export type ProjectionErrorCode = "ERR_CANONICAL_HASH" | "ERR_SCOPE_LOCK_HASH" | "ERR_CASE_SELECTION";

export type ReceiptDeclaration = {
  decision_case_id: string;
  receipt_path: string;
};

export type CaseSelection = {
  requirement_id: string;
  decision_case_id: string;
  fixture_id: string;
  oracle_id: string;
  expected_result: string;
  expected_error_code: string | null;
  must_not_happen: string[];
};

export type ProjectionInput = {
  canonicalPath: string;
  canonicalSha256: string;
  scopeLockPath: string;
  scopeLockSha256: string;
  phaseId: string;
  cases: CaseSelection[];
  receiptDeclarations: ReceiptDeclaration[];
};

export type ProjectionResult =
  | { ok: true; projection: Record<string, unknown> }
  | { ok: false; error: ProjectionErrorCode; message: string };

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function generatePhaseProjection(input: ProjectionInput): ProjectionResult {
  // Validate canonical binding
  if (!existsSync(input.canonicalPath)) {
    return { ok: false, error: "ERR_CANONICAL_HASH", message: `canonical path not found: ${input.canonicalPath}` };
  }
  const actualCanonicalHash = sha256File(input.canonicalPath);
  if (actualCanonicalHash !== input.canonicalSha256) {
    return { ok: false, error: "ERR_CANONICAL_HASH", message: `canonical hash drift: expected=${input.canonicalSha256} actual=${actualCanonicalHash}` };
  }

  // Validate canonical is a valid v3 document via shared parser
  const canonicalContent = readFileSync(input.canonicalPath, "utf8");
  let canonicalDoc: unknown;
  try {
    canonicalDoc = Bun.YAML.parse(canonicalContent);
  } catch {
    return { ok: false, error: "ERR_CANONICAL_HASH", message: "canonical file is not valid YAML" };
  }
  const canonicalParsed = parseAuditGovernanceV3Document(canonicalDoc);
  if (!canonicalParsed.ok) {
    return { ok: false, error: "ERR_CANONICAL_HASH", message: `canonical failed shared parser: ${canonicalParsed.error}` };
  }

  // Validate scope-lock binding
  if (!existsSync(input.scopeLockPath)) {
    return { ok: false, error: "ERR_SCOPE_LOCK_HASH", message: `scope-lock path not found: ${input.scopeLockPath}` };
  }
  const actualScopeLockHash = sha256File(input.scopeLockPath);
  if (actualScopeLockHash !== input.scopeLockSha256) {
    return { ok: false, error: "ERR_SCOPE_LOCK_HASH", message: `scope-lock hash drift: expected=${input.scopeLockSha256} actual=${actualScopeLockHash}` };
  }

  // Validate case selections: no duplicates, no empty IDs
  const seenCases = new Set<string>();
  for (const c of input.cases) {
    if (!c.decision_case_id || !/^DC-\d+$/.test(c.decision_case_id)) {
      return { ok: false, error: "ERR_CASE_SELECTION", message: `invalid decision_case_id: ${c.decision_case_id}` };
    }
    if (!c.requirement_id || !/^REQ-\d+$/.test(c.requirement_id)) {
      return { ok: false, error: "ERR_CASE_SELECTION", message: `invalid requirement_id: ${c.requirement_id}` };
    }
    if (seenCases.has(c.decision_case_id)) {
      return { ok: false, error: "ERR_CASE_SELECTION", message: `duplicate decision_case_id: ${c.decision_case_id}` };
    }
    seenCases.add(c.decision_case_id);
    if (!c.fixture_id || !c.oracle_id) {
      return { ok: false, error: "ERR_CASE_SELECTION", message: `missing fixture_id or oracle_id for ${c.decision_case_id}` };
    }
    if (!c.expected_result) {
      return { ok: false, error: "ERR_CASE_SELECTION", message: `missing expected_result for ${c.decision_case_id}` };
    }
  }

  // Validate receipt declarations reference selected cases only
  for (const decl of input.receiptDeclarations) {
    if (!seenCases.has(decl.decision_case_id)) {
      return { ok: false, error: "ERR_CASE_SELECTION", message: `receipt declaration references unselected case: ${decl.decision_case_id}` };
    }
    if (!decl.receipt_path) {
      return { ok: false, error: "ERR_CASE_SELECTION", message: `empty receipt_path for ${decl.decision_case_id}` };
    }
  }

  // Build the projection document
  const projection = {
    schema_version: "audit-phase-projection/v3",
    document_kind: "phase-projection",
    phase_id: input.phaseId,
    canonical_binding: {
      path: input.canonicalPath,
      sha256: input.canonicalSha256,
    },
    scope_lock_binding: {
      path: input.scopeLockPath,
      sha256: input.scopeLockSha256,
    },
    selected_cases: input.cases.map(c => ({
      requirement_id: c.requirement_id,
      decision_case_id: c.decision_case_id,
      fixture_id: c.fixture_id,
      oracle_id: c.oracle_id,
      expected_result: c.expected_result,
      expected_error_code: c.expected_error_code,
      must_not_happen: c.must_not_happen,
    })),
    receipt_declarations: input.receiptDeclarations.map(d => ({
      decision_case_id: d.decision_case_id,
      receipt_path: d.receipt_path,
    })),
  };

  // Validate the generated projection through the shared parser
  const validation = parseAuditGovernanceV3Document(projection);
  if (!validation.ok) {
    return { ok: false, error: "ERR_CASE_SELECTION", message: `generated projection failed shared parser: ${validation.error}` };
  }

  return { ok: true, projection };
}

// CLI entry point
function main() {
  const args = process.argv.slice(2);
  const get = (name: string) => { const idx = args.indexOf(name); return idx >= 0 ? args[idx + 1] : undefined; };

  const canonicalPath = get("--canonical");
  const canonicalSha256 = get("--canonical-sha256");
  const scopeLockPath = get("--scope-lock");
  const scopeLockSha256 = get("--scope-lock-sha256");
  const phaseId = get("--phase-id");
  const casesFile = get("--cases");
  const output = get("--output");

  if (!canonicalPath || !canonicalSha256 || !scopeLockPath || !scopeLockSha256 || !phaseId || !casesFile || !output) {
    console.error("usage: generate-phase-projection.ts --canonical <path> --canonical-sha256 <hash> --scope-lock <path> --scope-lock-sha256 <hash> --phase-id <id> --cases <json> --output <path>");
    process.exit(2);
  }

  if (existsSync(resolve(output))) {
    console.error("OUTPUT_ALREADY_EXISTS");
    process.exit(2);
  }

  let cases: CaseSelection[];
  let receiptDeclarations: ReceiptDeclaration[];
  try {
    const casesRaw = JSON.parse(readFileSync(resolve(casesFile), "utf8"));
    cases = casesRaw.cases ?? [];
    receiptDeclarations = casesRaw.receipt_declarations ?? [];
  } catch (err) {
    console.error(`ERROR: failed to parse cases file: ${err}`);
    process.exit(1);
  }

  const result = generatePhaseProjection({
    canonicalPath: resolve(canonicalPath),
    canonicalSha256,
    scopeLockPath: resolve(scopeLockPath),
    scopeLockSha256,
    phaseId,
    cases,
    receiptDeclarations,
  });

  if (!result.ok) {
    console.error(`BLOCKED: ${result.error} — ${result.message}`);
    process.exit(1);
  }

  mkdirSync(dirname(resolve(output)), { recursive: true });
  const content = `${JSON.stringify(result.projection, null, 2)}\n`;
  writeFileSync(resolve(output), content, { flag: "wx" });
  if (!statSync(resolve(output)).isFile() || statSync(resolve(output)).size === 0) {
    console.error("ERROR: projection write integrity check failed");
    process.exit(1);
  }
  const sha = createHash("sha256").update(readFileSync(resolve(output))).digest("hex");
  console.log(JSON.stringify({ path: resolve(output), sha256: sha, status: "READY" }));
  process.exit(0);
}

if (import.meta.main) main();
