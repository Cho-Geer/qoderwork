/** Shared fail-closed schema and bootstrap guards for active audit governance v3. */
import { createHash } from "node:crypto";
import { resolve, relative } from "node:path";

export type GovernanceErrorCode =
  | "ERR_SCHEMA_DISCRIMINATOR"
  | "ERR_PLAN_SCHEMA_UNSUPPORTED"
  | "ERR_APPROVAL_MISSING"
  | "ERR_APPROVAL_BINDING"
  | "ERR_PATH_GUARD"
  | "ERR_BOOTSTRAP_REUSE"
  | "ERR_BOOTSTRAP_PRECONDITION"
  | "ERR_BOOTSTRAP_APPROVAL"
  | "ERR_BOOTSTRAP_POSTHOC_VALIDATION";

export type GovernanceResult<T> = { ok: true; value: T } | { ok: false; error: GovernanceErrorCode; message: string };
export type GovernanceDocument = Record<string, unknown> & { schema_version: string; document_kind: string };

export const SCHEMA_PAIRS = [
  ["audit-governance/v3", "canonical-requirements"],
  ["audit-phase-projection/v3", "phase-projection"],
  ["audit-evidence-receipt/v3", "evidence-receipt"],
  ["audit-boundary-matrix/v3", "boundary-matrix"],
  ["audit-governance-approval/v3", "approval-decision"],
  ["audit-governance-approval-request/v3", "approval-request"],
  ["audit-scope-lock/v3", "phase-scope-lock"],
  ["audit-plan-set/v3", "plan-set-index"],
  ["audit-phase-progression/v3", "phase-progression-receipt"],
  ["audit-governance-audit/v3", "audit-contract"],
  ["audit-governance-report/v3", "audit-report"],
  ["audit-governance-latest/v3", "latest-pointer"],
  ["audit-governance-surface/v3", "governance-surface-manifest"],
  ["audit-governance-conformance/v3", "contract-conformance-report"],
  ["audit-governance-bootstrap/v3", "genesis-bootstrap-admission"],
  ["audit-governance-bootstrap/v3", "genesis-bootstrap-scope-lock"],
  ["audit-governance-bootstrap/v3", "genesis-bootstrap-receipt"],
] as const;

const schemaPairs = new Set(SCHEMA_PAIRS.map(([schemaVersion, documentKind]) => `${schemaVersion}::${documentKind}`));
const evidenceLevelRank = new Map(["unit", "component", "file-integration", "integration", "runtime-smoke", "live-LLM-E2E"].map((value, index) => [value, index]));

function failure(error: GovernanceErrorCode, message: string): GovernanceResult<never> {
  return { ok: false, error, message };
}

export function parseAuditGovernanceV3Document(input: unknown): GovernanceResult<GovernanceDocument> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return failure("ERR_SCHEMA_DISCRIMINATOR", "document must be an object");
  const document = input as Record<string, unknown>;
  const schemaVersion = document.schema_version;
  const documentKind = document.document_kind;
  if (typeof schemaVersion !== "string" || typeof documentKind !== "string") {
    return failure("ERR_SCHEMA_DISCRIMINATOR", "schema_version and document_kind are required strings");
  }
  if (!schemaPairs.has(`${schemaVersion}::${documentKind}`)) {
    return failure("ERR_SCHEMA_DISCRIMINATOR", `unsupported discriminator ${schemaVersion}::${documentKind}`);
  }
  return { ok: true, value: document as GovernanceDocument };
}

export function guardRelativePath(root: string, candidate: string): GovernanceResult<string> {
  if (!candidate || candidate.includes("\0")) return failure("ERR_PATH_GUARD", "path is empty or contains NUL");
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(resolvedRoot, candidate);
  const relation = relative(resolvedRoot, resolvedCandidate);
  if (relation === "" || relation === ".." || relation.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || resolve(candidate) === candidate) {
    return failure("ERR_PATH_GUARD", candidate);
  }
  return { ok: true, value: resolvedCandidate };
}

export function sha256Identity(source: string | Uint8Array): string {
  return createHash("sha256").update(source).digest("hex");
}

export function compareSha256(expected: string, source: string | Uint8Array): GovernanceResult<string> {
  const actual = sha256Identity(source);
  return expected === actual ? { ok: true, value: actual } : failure("ERR_APPROVAL_BINDING", `sha256 mismatch expected=${expected} actual=${actual}`);
}

export function compareEvidenceLevel(actual: string, minimum: string): GovernanceResult<number> {
  const actualRank = evidenceLevelRank.get(actual);
  const minimumRank = evidenceLevelRank.get(minimum);
  if (actualRank === undefined || minimumRank === undefined || actualRank < minimumRank) {
    return failure("ERR_APPROVAL_BINDING", `evidence level actual=${actual} minimum=${minimum}`);
  }
  return { ok: true, value: actualRank };
}

export function guardGenesisIdentity(existingIdentity: string | undefined, requestedIdentity: string): GovernanceResult<string> {
  if (!requestedIdentity || existingIdentity) return failure("ERR_BOOTSTRAP_REUSE", "genesis identity must be first and unique");
  return { ok: true, value: requestedIdentity };
}

export function guardGenesisPreconditions(scopeApproved: boolean, preChangeCaptured: boolean): GovernanceResult<true> {
  return scopeApproved && preChangeCaptured ? { ok: true, value: true } : failure("ERR_BOOTSTRAP_PRECONDITION", "approved scope and pre-change capture are both required");
}

export function guardGenesisScopeApproval(expectedScopeSha256: string, approvedScopeSha256: string): GovernanceResult<true> {
  return expectedScopeSha256 === approvedScopeSha256 ? { ok: true, value: true } : failure("ERR_BOOTSTRAP_APPROVAL", "scope approval hash does not bind the frozen scope lock");
}

export function guardGenesisPosthocValidation(formalPlanSetAdmitted: boolean): GovernanceResult<true> {
  return formalPlanSetAdmitted ? { ok: true, value: true } : failure("ERR_BOOTSTRAP_POSTHOC_VALIDATION", "fresh formal v3 PLAN_SET admission is required before closure");
}
