#!/usr/bin/env bun
/**
 * audit-boundary-precheck.ts — Projection-driven mechanical boundary precheck.
 *
 * Consumes a v3 phase projection that declares explicit receipt paths.
 * Validates each declared receipt:
 * - path nested within approved evidence root (rejects path escape and symlink escape)
 * - exists (ERR_RECEIPT_NOT_FOUND)
 * - hash/REQ-DC identity/fixture/oracle/dual observation/forbidden-side-effect match
 *
 * Emits a v3 boundary matrix (audit-boundary-matrix/v3::boundary-matrix).
 * Outputs ONLY READY_FOR_LLM_REVIEW or BLOCKED. Never issues an audit verdict.
 *
 * Uses the shared parser (parseAuditGovernanceV3Document).
 */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { parseAuditGovernanceV3Document } from "../../../../scripts/lib/audit-governance-schema-v3.ts";

type Obj = Record<string, unknown>;

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sha256Content(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export type PrecheckErrorCode =
  | "ERR_PROJECTION_INVALID"
  | "ERR_PROJECTION_HASH"
  | "ERR_RECEIPT_PATH"
  | "ERR_RECEIPT_NOT_FOUND"
  | "ERR_RECEIPT_IDENTITY"
  | "ERR_RECEIPT_OBSERVATION";

export type MatrixRow = {
  requirement_id: string;
  decision_case_id: string;
  expected_result: string;
  expected_error_code: string | null;
  fixture_id: string;
  oracle_id: string;
  must_not_happen: string[];
  receipt_path: string | null;
  receipt_sha256: string | null;
  observed_execution: string | null;
  observed_domain_result: string | null;
  observed_domain_error_code: string | null;
  forbidden_side_effects_observed: string[] | null;
  coverage: "COVERED" | "BLOCKED";
  blocker_reason: string | null;
};

export type BoundaryMatrix = {
  schema_version: "audit-boundary-matrix/v3";
  document_kind: "boundary-matrix";
  status: "READY_FOR_LLM_REVIEW" | "BLOCKED";
  projection_path: string;
  projection_sha256: string;
  rows: MatrixRow[];
  blockers: string[];
};

/**
 * Check if a path is safely nested within the evidence root.
 * Rejects path escape (../) and symlink escape.
 */
function isPathNestedWithinRoot(evidenceRoot: string, candidatePath: string): { ok: boolean; reason?: string } {
  const resolvedRoot = resolve(evidenceRoot);
  const resolvedCandidate = resolve(resolvedRoot, candidatePath);

  // Check textual containment first
  const rel = relative(resolvedRoot, resolvedCandidate);
  if (rel === "" || rel === ".." || rel.startsWith("../") || isAbsolute(rel)) {
    return { ok: false, reason: `path escapes evidence root: ${candidatePath}` };
  }

  // Check for symlink escape: resolve the real path and verify containment
  if (existsSync(resolvedCandidate)) {
    try {
      const realRoot = realpathSync(resolvedRoot);
      const realCandidate = realpathSync(resolvedCandidate);
      const realRel = relative(realRoot, realCandidate);
      if (realRel === "" || realRel === ".." || realRel.startsWith("../") || isAbsolute(realRel)) {
        return { ok: false, reason: `symlink escapes evidence root: ${candidatePath}` };
      }
    } catch {
      return { ok: false, reason: `cannot resolve real path: ${candidatePath}` };
    }
  }

  // Also reject if any component is a symlink pointing outside
  if (existsSync(resolvedCandidate)) {
    const lstat = lstatSync(resolvedCandidate);
    if (lstat.isSymbolicLink()) {
      const realTarget = realpathSync(resolvedCandidate);
      const realRoot = realpathSync(resolvedRoot);
      const targetRel = relative(realRoot, realTarget);
      if (targetRel.startsWith("../") || isAbsolute(targetRel)) {
        return { ok: false, reason: `symlink target escapes evidence root: ${candidatePath}` };
      }
    }
  }

  return { ok: true };
}

/**
 * Main precheck: consumes a v3 phase projection with explicit receipt declarations.
 */
export function precheckBoundary(projectionPath: string, evidenceRoot: string): BoundaryMatrix {
  const blockers: string[] = [];
  const resolvedProjection = resolve(projectionPath);
  const resolvedEvidenceRoot = resolve(evidenceRoot);

  // Load and validate projection
  if (!existsSync(resolvedProjection)) {
    return {
      schema_version: "audit-boundary-matrix/v3",
      document_kind: "boundary-matrix",
      status: "BLOCKED",
      projection_path: resolvedProjection,
      projection_sha256: "",
      rows: [],
      blockers: ["ERR_PROJECTION_INVALID:projection file not found"],
    };
  }

  const projectionContent = readFileSync(resolvedProjection, "utf8");
  const projectionSha256 = sha256Content(projectionContent);
  let projectionRaw: unknown;
  try {
    projectionRaw = JSON.parse(projectionContent);
  } catch {
    return {
      schema_version: "audit-boundary-matrix/v3",
      document_kind: "boundary-matrix",
      status: "BLOCKED",
      projection_path: resolvedProjection,
      projection_sha256: projectionSha256,
      rows: [],
      blockers: ["ERR_PROJECTION_INVALID:projection is not valid JSON"],
    };
  }

  // Validate projection through shared parser
  const parsed = parseAuditGovernanceV3Document(projectionRaw);
  if (!parsed.ok) {
    return {
      schema_version: "audit-boundary-matrix/v3",
      document_kind: "boundary-matrix",
      status: "BLOCKED",
      projection_path: resolvedProjection,
      projection_sha256: projectionSha256,
      rows: [],
      blockers: [`ERR_PROJECTION_INVALID:${parsed.error} — ${parsed.message}`],
    };
  }

  const projection = projectionRaw as Obj;
  const selectedCases = Array.isArray(projection.selected_cases) ? projection.selected_cases as Obj[] : [];
  const receiptDeclarations = Array.isArray(projection.receipt_declarations) ? projection.receipt_declarations as Obj[] : [];

  // Build a map from decision_case_id to receipt declaration
  const declarationMap = new Map<string, string>();
  for (const decl of receiptDeclarations) {
    const dcId = String(decl.decision_case_id ?? "");
    const receiptPath = String(decl.receipt_path ?? "");
    if (dcId && receiptPath) {
      declarationMap.set(dcId, receiptPath);
    }
  }

  // Process each selected case
  const rows: MatrixRow[] = [];
  for (const caseEntry of selectedCases) {
    const requirementId = String(caseEntry.requirement_id ?? "");
    const decisionCaseId = String(caseEntry.decision_case_id ?? "");
    const expected_result = String(caseEntry.expected_result ?? "");
    const expected_error_code = caseEntry.expected_error_code != null ? String(caseEntry.expected_error_code) : null;
    const fixture_id = String(caseEntry.fixture_id ?? "");
    const oracle_id = String(caseEntry.oracle_id ?? "");
    const must_not_happen = Array.isArray(caseEntry.must_not_happen) ? caseEntry.must_not_happen as string[] : [];

    const row: MatrixRow = {
      requirement_id: requirementId,
      decision_case_id: decisionCaseId,
      expected_result,
      expected_error_code,
      fixture_id,
      oracle_id,
      must_not_happen,
      receipt_path: null,
      receipt_sha256: null,
      observed_execution: null,
      observed_domain_result: null,
      observed_domain_error_code: null,
      forbidden_side_effects_observed: null,
      coverage: "BLOCKED",
      blocker_reason: null,
    };

    // Find the declared receipt path
    const declaredPath = declarationMap.get(decisionCaseId);
    if (!declaredPath) {
      row.blocker_reason = "ERR_RECEIPT_NOT_FOUND:no receipt declared for this case";
      blockers.push(`${row.blocker_reason}:${decisionCaseId}`);
      rows.push(row);
      continue;
    }

    // Check path nesting (reject escape and symlink escape)
    const nestCheck = isPathNestedWithinRoot(resolvedEvidenceRoot, declaredPath);
    if (!nestCheck.ok) {
      row.blocker_reason = `ERR_RECEIPT_PATH:${nestCheck.reason}`;
      blockers.push(`ERR_RECEIPT_PATH:${decisionCaseId}`);
      rows.push(row);
      continue;
    }

    const fullReceiptPath = resolve(resolvedEvidenceRoot, declaredPath);
    row.receipt_path = declaredPath;

    // Check existence
    if (!existsSync(fullReceiptPath)) {
      row.blocker_reason = "ERR_RECEIPT_NOT_FOUND:declared receipt does not exist";
      blockers.push(`ERR_RECEIPT_NOT_FOUND:${decisionCaseId}`);
      rows.push(row);
      continue;
    }

    // Read and parse receipt
    const receiptSha256 = sha256File(fullReceiptPath);
    row.receipt_sha256 = receiptSha256;

    let receipt: Obj;
    try {
      receipt = JSON.parse(readFileSync(fullReceiptPath, "utf8")) as Obj;
    } catch {
      row.blocker_reason = "ERR_RECEIPT_NOT_FOUND:receipt is not valid JSON";
      blockers.push(`ERR_RECEIPT_NOT_FOUND:${decisionCaseId}`);
      rows.push(row);
      continue;
    }

    // Validate receipt identity: decision_case_id must match
    const receiptDcId = String(receipt.decision_case_id ?? "");
    if (receiptDcId !== decisionCaseId) {
      row.blocker_reason = `ERR_RECEIPT_IDENTITY:decision_case_id mismatch expected=${decisionCaseId} actual=${receiptDcId}`;
      blockers.push(`ERR_RECEIPT_IDENTITY:${decisionCaseId}`);
      rows.push(row);
      continue;
    }

    // Validate fixture and oracle
    const receiptFixture = String(receipt.fixture_id ?? "");
    const receiptOracle = String(receipt.oracle_id ?? "");
    if (receiptFixture !== fixture_id || receiptOracle !== oracle_id) {
      row.blocker_reason = `ERR_RECEIPT_IDENTITY:fixture/oracle mismatch`;
      blockers.push(`ERR_RECEIPT_IDENTITY:${decisionCaseId}`);
      rows.push(row);
      continue;
    }

    // Validate dual observation: execution.observed
    const execution = receipt.execution as Obj | undefined;
    const executionObserved = execution ? String(execution.observed ?? "") : "";
    row.observed_execution = executionObserved || null;

    // Validate domain_observation.result
    const domainObs = receipt.domain_observation as Obj | undefined;
    const domainResult = domainObs ? String(domainObs.result ?? "") : "";
    const domainErrorCode = domainObs && domainObs.error_code != null ? String(domainObs.error_code) : null;
    row.observed_domain_result = domainResult || null;
    row.observed_domain_error_code = domainErrorCode;

    // Check execution observation matches expected
    // For expected_result SUCCESS → execution.observed should be PASS
    // For expected_result ERROR → execution.observed should be FAIL
    const expectedExecutionObserved = expected_result === "SUCCESS" ? "PASS" : "FAIL";
    if (executionObserved !== expectedExecutionObserved) {
      row.blocker_reason = `ERR_RECEIPT_OBSERVATION:execution.observed mismatch expected=${expectedExecutionObserved} actual=${executionObserved}`;
      blockers.push(`ERR_RECEIPT_OBSERVATION:${decisionCaseId}`);
      rows.push(row);
      continue;
    }

    // Check domain observation result matches expected_result
    if (domainResult !== expected_result) {
      row.blocker_reason = `ERR_RECEIPT_OBSERVATION:domain_observation.result mismatch expected=${expected_result} actual=${domainResult}`;
      blockers.push(`ERR_RECEIPT_OBSERVATION:${decisionCaseId}`);
      rows.push(row);
      continue;
    }

    // Check error code if expected
    if (expected_error_code !== null && domainErrorCode !== expected_error_code) {
      row.blocker_reason = `ERR_RECEIPT_OBSERVATION:domain_observation.error_code mismatch expected=${expected_error_code} actual=${domainErrorCode}`;
      blockers.push(`ERR_RECEIPT_OBSERVATION:${decisionCaseId}`);
      rows.push(row);
      continue;
    }

    // Validate forbidden side effects
    const forbiddenObserved = Array.isArray(receipt.forbidden_side_effects_observed)
      ? receipt.forbidden_side_effects_observed as string[]
      : [];
    row.forbidden_side_effects_observed = forbiddenObserved;

    if (JSON.stringify(forbiddenObserved.sort()) !== JSON.stringify([...must_not_happen].sort())) {
      row.blocker_reason = "ERR_RECEIPT_OBSERVATION:forbidden_side_effects_observed mismatch";
      blockers.push(`ERR_RECEIPT_OBSERVATION:${decisionCaseId}`);
      rows.push(row);
      continue;
    }

    // All checks passed for this row
    row.coverage = "COVERED";
    rows.push(row);
  }

  const status = blockers.length === 0 ? "READY_FOR_LLM_REVIEW" : "BLOCKED";

  return {
    schema_version: "audit-boundary-matrix/v3",
    document_kind: "boundary-matrix",
    status,
    projection_path: resolvedProjection,
    projection_sha256: projectionSha256,
    rows,
    blockers: [...new Set(blockers)],
  };
}

// CLI entry point
function main() {
  const args = process.argv.slice(2);
  const get = (name: string) => { const idx = args.indexOf(name); return idx >= 0 ? args[idx + 1] : undefined; };

  const projectionPath = get("--projection");
  const evidenceRoot = get("--evidence-root");
  const output = get("--output");

  if (!projectionPath || !evidenceRoot || !output) {
    console.error("usage: audit-boundary-precheck.ts --projection <file> --evidence-root <dir> --output <matrix.json>");
    process.exit(2);
  }

  if (existsSync(resolve(output))) {
    console.error("OUTPUT_ALREADY_EXISTS");
    process.exit(2);
  }

  const matrix = precheckBoundary(resolve(projectionPath), resolve(evidenceRoot));
  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(resolve(output), `${JSON.stringify(matrix, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify(matrix, null, 2));
  process.exit(matrix.status === "READY_FOR_LLM_REVIEW" ? 0 : 1);
}

if (import.meta.main) main();
