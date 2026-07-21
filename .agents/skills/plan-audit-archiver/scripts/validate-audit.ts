#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

type AuditIssue = { code: string; message: string };
type JsonObject = Record<string, unknown>;

export type AuditValidationResult = {
  valid: boolean;
  schemaVersion: string | null;
  auditId: string | null;
  verdict: string | null;
  counts: {
    requirements: number;
    findings: number;
    openBlockers: number;
    reopenRecords: number;
  };
  errors: AuditIssue[];
  warnings: AuditIssue[];
};

const REQUIRED_HEADINGS = [
  "## 0. Machine-Readable Audit Contract",
  "## 1. Audit Identity and Source Ledger",
  "## 2. Frozen Scope and Exit Contract",
  "### 2.1 IN-SCOPE",
  "### 2.2 OUT-OF-SCOPE",
  "### 2.3 Assumptions and disproof",
  "### 2.4 Deterministic exit criteria",
  "## 3. Requirement, Oracle, and Falsification Matrix",
  "## 4. Full In-Scope Sweep",
  "## 5. Classified Findings",
  "### 5.1 BLOCKING",
  "### 5.2 NON_BLOCKING_DEBT",
  "### 5.3 OUT_OF_SCOPE",
  "### 5.4 UNVERIFIED",
  "## 6. Falsification Evidence",
  "## 7. Frozen Rework Package",
  "## 8. Reopen Records",
  "## 9. Closure Matrix",
  "## 10. Verdict",
  "## 11. Validator Evidence",
  "## 12. Anti-Loop Answers",
] as const;

const VERDICTS = new Set(["ACCEPT", "REWORK", "BLOCKED", "INVALID"]);
const REQUIREMENT_STATUSES = new Set(["PASS", "FAIL", "BLOCKED", "INVALID"]);
const FINDING_CLASSES = new Set(["BLOCKING", "NON_BLOCKING_DEBT", "OUT_OF_SCOPE", "UNVERIFIED"]);
const FINDING_ORIGINS = new Set(["PRE_EXISTING", "REGRESSION", "AUDIT_MISS", "EVIDENCE_INVALIDATION"]);
const FINDING_STATUSES = new Set(["OPEN", "CLOSED", "BLOCKED"]);
const REOPEN_GATES = new Set(["IN_SCOPE_REGRESSION", "SAFETY_OR_DATA_LOSS", "EVIDENCE_INVALIDATION", "AUDIT_MISS"]);
const OBSERVED = new Set(["PASS", "FAIL", "BLOCKED", "NOT_RUN", "N/A"]);
const PROVENANCE_LEVELS = new Set(["v2.1-required", "component-only"]);
const INHERITED_DISPOSITIONS = new Set(["CLOSED", "INHERITED", "REOPENED"]);
const EVIDENCE_LEVELS = new Map([
  ["NOT-RUN", -1],
  ["static", 0],
  ["manual", 0],
  ["component", 1],
  ["integration", 2],
  ["runtime-smoke", 3],
  ["live-LLM-E2E", 4],
]);

function issue(target: AuditIssue[], code: string, message: string) {
  target.push({ code, message });
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function objectAt(value: unknown, path: string, errors: AuditIssue[]): JsonObject {
  if (!isObject(value)) {
    issue(errors, "EXPECTED_OBJECT", `${path} must be an object`);
    return {};
  }
  return value;
}

function arrayAt(value: unknown, path: string, errors: AuditIssue[]): unknown[] {
  if (!Array.isArray(value)) {
    issue(errors, "EXPECTED_ARRAY", `${path} must be an array`);
    return [];
  }
  return value;
}

function stringAt(value: unknown, path: string, errors: AuditIssue[], allowNA = false): string {
  if (typeof value !== "string" || value.trim().length === 0 || (!allowNA && value.trim() === "N/A")) {
    issue(errors, "EXPECTED_NONEMPTY_STRING", `${path} must be a concrete non-empty string`);
    return "";
  }
  return value.trim();
}

function nullableStringAt(value: unknown, path: string, errors: AuditIssue[]): string | null {
  if (value === null) return null;
  return stringAt(value, path, errors);
}

function stringArrayAt(value: unknown, path: string, errors: AuditIssue[], requireNonEmpty = false): string[] {
  const values = arrayAt(value, path, errors);
  const result = values.map((item, index) => stringAt(item, `${path}[${index}]`, errors));
  if (requireNonEmpty && result.length === 0) issue(errors, "EMPTY_ARRAY", `${path} must not be empty`);
  return result;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function sameSet(left: string[], right: string[]): boolean {
  const a = unique(left).sort();
  const b = unique(right).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function requireUnique(values: string[], path: string, errors: AuditIssue[]) {
  if (unique(values).length !== values.length) issue(errors, "DUPLICATE_ID", `${path} contains duplicate values`);
}

function requireEnum(value: string, allowed: Set<string>, path: string, errors: AuditIssue[]) {
  if (value && !allowed.has(value)) issue(errors, "INVALID_ENUM", `${path} has invalid value ${value}`);
}

function requireIsoTimestamp(value: string, path: string, errors: AuditIssue[]) {
  if (value && Number.isNaN(Date.parse(value))) issue(errors, "INVALID_TIMESTAMP", `${path} must be an ISO-8601 timestamp`);
}

function requireSha256(value: string, path: string, errors: AuditIssue[]) {
  if (value && !/^[a-f0-9]{64}$/i.test(value)) issue(errors, "INVALID_SHA256", `${path} must be 64 hexadecimal characters`);
}

function requireCommit(value: string, path: string, errors: AuditIssue[]) {
  if (value && !/^[a-f0-9]{40}$/i.test(value)) issue(errors, "INVALID_COMMIT", `${path} must be a full 40-character commit`);
}

function requireCommand(value: string, path: string, errors: AuditIssue[]) {
  if (value && !/^cd\s+\S+\s+&&\s+\S+/.test(value)) {
    issue(errors, "COMMAND_CWD_MISSING", `${path} must start with an explicit 'cd <cwd> && <command>'`);
  }
}

function requireObservableExpectation(value: string, path: string, errors: AuditIssue[]) {
  if (value && !/\b(?:PASS|FAIL|BLOCKED)\b|exit(?:\s+code)?\s*[=:]?\s*\d+|\b\d+\s+(?:pass|fail|errors?)\b|\b(?:valid|success)\s*=\s*(?:true|false)\b/i.test(value)) {
    issue(errors, "ACCEPTANCE_EXPECTATION_NOT_OBSERVABLE", `${path} must name a machine-observable exit code, count, boolean, or PASS/FAIL/BLOCKED state`);
  }
}

function requireConcretePath(value: string, path: string, errors: AuditIssue[]) {
  if (/[<>{}*]|\.\.\./.test(value)) issue(errors, "NON_CONCRETE_PATH", `${path} must be an exact path without placeholders or globs`);
}

function checkFileReference(value: unknown, path: string, errors: AuditIssue[], allowNull = false): { path: string; sha256: string } | null {
  if (value === null && allowNull) return null;
  const reference = objectAt(value, path, errors);
  const referencePath = stringAt(reference.path, `${path}.path`, errors);
  requireConcretePath(referencePath, `${path}.path`, errors);
  const sha256 = stringAt(reference.sha256, `${path}.sha256`, errors);
  requireSha256(sha256, `${path}.sha256`, errors);
  return { path: referencePath, sha256 };
}

function parseContract(source: string, errors: AuditIssue[]): JsonObject {
  const starts = source.match(/<!-- AUDIT_CONTRACT_START -->/g) ?? [];
  const ends = source.match(/<!-- AUDIT_CONTRACT_END -->/g) ?? [];
  if (starts.length !== 1 || ends.length !== 1) {
    issue(errors, "CONTRACT_MARKER_COUNT", `expected exactly one contract marker pair; starts=${starts.length}, ends=${ends.length}`);
    return {};
  }
  const match = source.match(/<!-- AUDIT_CONTRACT_START -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- AUDIT_CONTRACT_END -->/);
  if (!match) {
    issue(errors, "CONTRACT_BLOCK_MISSING", "contract markers must wrap one fenced JSON object");
    return {};
  }
  try {
    return objectAt(JSON.parse(match[1]), "AUDIT_CONTRACT", errors);
  } catch (error) {
    issue(errors, "CONTRACT_JSON_INVALID", error instanceof Error ? error.message : String(error));
    return {};
  }
}

function checkSources(baseline: JsonObject, errors: AuditIssue[]) {
  const plans = arrayAt(baseline.plan_sources, "baseline.plan_sources", errors);
  const planPaths: string[] = [];
  for (const [index, item] of plans.entries()) {
    const source = objectAt(item, `baseline.plan_sources[${index}]`, errors);
    const path = stringAt(source.path, `baseline.plan_sources[${index}].path`, errors);
    if (path) {
      requireConcretePath(path, `baseline.plan_sources[${index}].path`, errors);
      if (!path.startsWith("plans/")) issue(errors, "PLAN_SOURCE_OUTSIDE_PLANS", `${path}: authoritative source must be under plans/`);
      planPaths.push(path);
    }
    requireSha256(stringAt(source.sha256, `baseline.plan_sources[${index}].sha256`, errors), `baseline.plan_sources[${index}].sha256`, errors);
  }
  const supplemental = arrayAt(baseline.supplemental_sources, "baseline.supplemental_sources", errors);
  for (const [index, item] of supplemental.entries()) {
    const source = objectAt(item, `baseline.supplemental_sources[${index}]`, errors);
    const path = stringAt(source.path, `baseline.supplemental_sources[${index}].path`, errors);
    if (path) requireConcretePath(path, `baseline.supplemental_sources[${index}].path`, errors);
    requireSha256(stringAt(source.sha256, `baseline.supplemental_sources[${index}].sha256`, errors), `baseline.supplemental_sources[${index}].sha256`, errors);
    const role = stringAt(source.role, `baseline.supplemental_sources[${index}].role`, errors);
    if (role && role !== "CLAIM" && role !== "EVIDENCE") issue(errors, "INVALID_SOURCE_ROLE", `supplemental source role must be CLAIM or EVIDENCE`);
  }
  return planPaths;
}

type RequirementSummary = { id: string; planItemId: string; kind: string; status: string; requiredLevel: string; oracleId: string; source: string };

type EvidenceReceiptSummary = {
  id: string;
  path: string;
  sha256: string;
  command: string;
  observed: string;
  requirementId: string;
  polarity: string;
  oracleId: string;
  fixtureId: string;
  evidenceLevel: string;
  repositoryStateSha256: string;
  exitCode: number | null;
};

function checkEvidenceReceipts(value: unknown, verdictStateSha256: string, errors: AuditIssue[]): Map<string, EvidenceReceiptSummary> {
  const entries = arrayAt(value, "evidence_receipts", errors);
  const result = new Map<string, EvidenceReceiptSummary>();
  for (const [index, item] of entries.entries()) {
    const path = `evidence_receipts[${index}]`;
    const receipt = objectAt(item, path, errors);
    const id = stringAt(receipt.id, `${path}.id`, errors);
    if (id && !/^EV-\d{3}$/.test(id)) issue(errors, "INVALID_EVIDENCE_RECEIPT_ID", `${path}.id must match EV-NNN`);
    const receiptPath = stringAt(receipt.path, `${path}.path`, errors);
    requireConcretePath(receiptPath, `${path}.path`, errors);
    const sha256 = stringAt(receipt.sha256, `${path}.sha256`, errors);
    requireSha256(sha256, `${path}.sha256`, errors);
    const command = stringAt(receipt.command, `${path}.command`, errors);
    requireCommand(command, `${path}.command`, errors);
    const observed = stringAt(receipt.observed, `${path}.observed`, errors);
    requireEnum(observed, OBSERVED, `${path}.observed`, errors);
    const requirementId = stringAt(receipt.requirement_id, `${path}.requirement_id`, errors);
    const polarity = stringAt(receipt.polarity, `${path}.polarity`, errors);
    if (polarity && !["POSITIVE", "NEGATIVE", "POST_FIX"].includes(polarity)) issue(errors, "INVALID_RECEIPT_POLARITY", `${path}.polarity=${polarity}`);
    const oracleId = stringAt(receipt.oracle_id, `${path}.oracle_id`, errors);
    const fixtureId = stringAt(receipt.fixture_id, `${path}.fixture_id`, errors);
    const evidenceLevel = stringAt(receipt.evidence_level, `${path}.evidence_level`, errors);
    if (evidenceLevel && !EVIDENCE_LEVELS.has(evidenceLevel)) issue(errors, "INVALID_EVIDENCE_LEVEL", `${path}.evidence_level=${evidenceLevel}`);
    const repositoryStateSha256 = stringAt(receipt.repository_state_sha256, `${path}.repository_state_sha256`, errors);
    requireSha256(repositoryStateSha256, `${path}.repository_state_sha256`, errors);
    if (verdictStateSha256 && repositoryStateSha256 !== verdictStateSha256) issue(errors, "EVIDENCE_RECEIPT_BASELINE_MISMATCH", `${id}: receipt is not bound to baseline.verdict_state_receipt`);
    const exitCode = Number.isInteger(receipt.exit_code) ? Number(receipt.exit_code) : null;
    if (exitCode === null) issue(errors, "INVALID_RECEIPT_EXIT_CODE", `${path}.exit_code must be an integer`);
    if (observed === "PASS" && exitCode !== 0) issue(errors, "RECEIPT_EXIT_OBSERVATION_MISMATCH", `${id}: PASS requires exit_code=0`);
    if (observed === "FAIL" && exitCode === 0) issue(errors, "RECEIPT_EXIT_OBSERVATION_MISMATCH", `${id}: FAIL requires non-zero exit_code`);
    const cwd = stringAt(receipt.cwd, `${path}.cwd`, errors);
    if (cwd && !cwd.startsWith("/")) issue(errors, "RECEIPT_CWD_NOT_ABSOLUTE", `${path}.cwd must be absolute`);
    if (cwd && command && !command.startsWith(`cd ${cwd} && `)) issue(errors, "RECEIPT_CWD_COMMAND_MISMATCH", `${id}: command must start with receipt cwd`);
    const artifacts = arrayAt(receipt.artifacts, `${path}.artifacts`, errors);
    if (artifacts.length === 0) issue(errors, "EMPTY_ARRAY", `${path}.artifacts must not be empty`);
    for (const [artifactIndex, artifactValue] of artifacts.entries()) {
      checkFileReference(artifactValue, `${path}.artifacts[${artifactIndex}]`, errors);
    }
    requireIsoTimestamp(stringAt(receipt.completed_at, `${path}.completed_at`, errors), `${path}.completed_at`, errors);
    if (id) {
      if (result.has(id)) issue(errors, "DUPLICATE_ID", `evidence_receipts[].id contains duplicate ${id}`);
      result.set(id, { id, path: receiptPath, sha256, command, observed, requirementId, polarity, oracleId, fixtureId, evidenceLevel, repositoryStateSha256, exitCode });
    }
  }
  return result;
}

function checkControl(
  value: unknown,
  path: string,
  errors: AuditIssue[],
  expected: "PASS" | "FAIL",
  receipts: Map<string, EvidenceReceiptSummary>,
  allowStaticNA = false,
  allowUnexecuted = false,
  binding?: { requirementId: string; polarity: "POSITIVE" | "NEGATIVE"; oracleId: string; requiredLevel: string },
) {
  const control = objectAt(value, path, errors);
  const command = stringAt(control.command, `${path}.command`, errors, true);
  const actualExpected = stringAt(control.expected, `${path}.expected`, errors, true);
  const observed = stringAt(control.observed, `${path}.observed`, errors, true);
  const evidence = stringAt(control.evidence, `${path}.evidence`, errors);
  if (command === "N/A" && !allowStaticNA) issue(errors, "CONTROL_COMMAND_NOT_EXECUTABLE", `${path}.command cannot be N/A for an executed control`);
  if (command !== "N/A") requireCommand(command, `${path}.command`, errors);
  if (/&&\s*(?:true|false|:)\s*$/i.test(command)) issue(errors, "TRIVIAL_CONTROL_COMMAND", `${path}.command cannot use a shell constant as audit evidence`);
  const isAllowedUnexecuted = allowUnexecuted && ["NOT_RUN", "BLOCKED"].includes(observed) && evidence.toUpperCase() === "NOT-RUN";
  if (["N/A", "NOT-RUN", "NONE"].includes(evidence.toUpperCase()) && !isAllowedUnexecuted) issue(errors, "CONTROL_EVIDENCE_NOT_EXECUTED", `${path}.evidence must identify executed evidence`);
  if (actualExpected && actualExpected !== expected && !(allowStaticNA && actualExpected === "N/A")) {
    issue(errors, "CONTROL_EXPECTATION", `${path}.expected must be ${expected}`);
  }
  requireEnum(observed, OBSERVED, `${path}.observed`, errors);
  if (command !== "N/A" && !isAllowedUnexecuted) {
    if (!/^EV-\d{3}$/.test(evidence)) issue(errors, "EVIDENCE_RECEIPT_REFERENCE_REQUIRED", `${path}.evidence must reference EV-NNN`);
    const receipt = receipts.get(evidence);
    if (!receipt) issue(errors, "EVIDENCE_RECEIPT_NOT_FOUND", `${path}.evidence references missing receipt ${evidence}`);
    else {
      if (receipt.command !== command) issue(errors, "EVIDENCE_RECEIPT_COMMAND_MISMATCH", `${path}: ${evidence} command differs from control`);
      if (receipt.observed !== observed) issue(errors, "EVIDENCE_RECEIPT_OBSERVED_MISMATCH", `${path}: ${evidence} observed differs from control`);
      if (binding) {
        if (receipt.requirementId !== binding.requirementId) issue(errors, "EVIDENCE_RECEIPT_REQUIREMENT_MISMATCH", `${path}: ${evidence} belongs to ${receipt.requirementId}`);
        if (receipt.polarity !== binding.polarity) issue(errors, "EVIDENCE_RECEIPT_POLARITY_MISMATCH", `${path}: ${evidence} polarity=${receipt.polarity}`);
        if (receipt.oracleId !== binding.oracleId) issue(errors, "EVIDENCE_RECEIPT_ORACLE_MISMATCH", `${path}: ${evidence} oracle=${receipt.oracleId}`);
        const receiptRank = EVIDENCE_LEVELS.get(receipt.evidenceLevel);
        const requiredRank = EVIDENCE_LEVELS.get(binding.requiredLevel);
        if (receiptRank !== undefined && requiredRank !== undefined && receiptRank < requiredRank) issue(errors, "EVIDENCE_RECEIPT_LEVEL_TOO_LOW", `${path}: ${receipt.evidenceLevel} below ${binding.requiredLevel}`);
      }
    }
  }
  return { control, command, observed, evidence, receipt: receipts.get(evidence) };
}

function checkRequirements(value: unknown, planPaths: string[], receipts: Map<string, EvidenceReceiptSummary>, errors: AuditIssue[]): RequirementSummary[] {
  const requirements = arrayAt(value, "requirements", errors);
  const result: RequirementSummary[] = [];
  for (const [index, item] of requirements.entries()) {
    const path = `requirements[${index}]`;
    const requirement = objectAt(item, path, errors);
    const id = stringAt(requirement.id, `${path}.id`, errors);
    if (id && !/^REQ-\d{3}$/.test(id)) issue(errors, "INVALID_REQUIREMENT_ID", `${path}.id must match REQ-NNN`);
    const planItemId = stringAt(requirement.plan_item_id, `${path}.plan_item_id`, errors);
    if (planItemId && !/^PLAN-REQ-\d{3}$/.test(planItemId)) issue(errors, "INVALID_PLAN_ITEM_ID", `${path}.plan_item_id must match PLAN-REQ-NNN`);
    const kind = stringAt(requirement.kind, `${path}.kind`, errors);
    if (kind && kind !== "BEHAVIORAL" && kind !== "STATIC") issue(errors, "INVALID_REQUIREMENT_KIND", `${path}.kind must be BEHAVIORAL or STATIC`);
    const source = stringAt(requirement.source, `${path}.source`, errors);
    const sourcePath = source.split("#", 1)[0];
    if (sourcePath && !planPaths.includes(sourcePath)) {
      issue(errors, "REQUIREMENT_SOURCE_NOT_AUTHORIZED", `${id}: source ${sourcePath} is absent from baseline.plan_sources`);
    }
    stringAt(requirement.behavior, `${path}.behavior`, errors);
    const requiredLevel = stringAt(requirement.required_evidence_level, `${path}.required_evidence_level`, errors);
    if (requiredLevel && !EVIDENCE_LEVELS.has(requiredLevel)) issue(errors, "INVALID_EVIDENCE_LEVEL", `${path}.required_evidence_level=${requiredLevel}`);
    if (requiredLevel === "NOT-RUN") issue(errors, "REQUIRED_LEVEL_NOT_EXECUTABLE", `${path}.required_evidence_level cannot be NOT-RUN`);
    const oracleId = stringAt(requirement.oracle_id, `${path}.oracle_id`, errors);
    if (oracleId && !/^ORACLE-\d{3}$/.test(oracleId)) issue(errors, "INVALID_ORACLE_ID", `${path}.oracle_id must match ORACLE-NNN`);
    stringAt(requirement.oracle, `${path}.oracle`, errors);
    const status = stringAt(requirement.status, `${path}.status`, errors);
    requireEnum(status, REQUIREMENT_STATUSES, `${path}.status`, errors);
    const positive = checkControl(requirement.positive_control, `${path}.positive_control`, errors, "PASS", receipts, false, status === "BLOCKED", { requirementId: id, polarity: "POSITIVE", oracleId, requiredLevel });
    const negative = checkControl(requirement.negative_control, `${path}.negative_control`, errors, "FAIL", receipts, kind === "STATIC", status === "BLOCKED", { requirementId: id, polarity: "NEGATIVE", oracleId, requiredLevel });
    const applicability = stringAt(negative.control.applicability, `${path}.negative_control.applicability`, errors);
    const method = stringAt(negative.control.method, `${path}.negative_control.method`, errors, true);
    if (kind === "BEHAVIORAL") {
      if (applicability !== "REQUIRED") issue(errors, "NEGATIVE_CONTROL_REQUIRED", `${id}: behavioral requirement needs REQUIRED negative control`);
      if (method === "N/A") issue(errors, "NEGATIVE_METHOD_MISSING", `${id}: behavioral negative method must be concrete`);
      if ((status === "PASS" || status === "FAIL") && negative.observed !== "FAIL") {
        issue(errors, "NEGATIVE_CONTROL_NOT_SENSITIVE", `${id}: ${status} requires negative control observed FAIL`);
      }
      if (positive.command === negative.command) {
        issue(errors, "CONTROL_COMMAND_NOT_DISCRIMINATING", `${id}: positive and negative controls must use observably different commands or fixtures`);
      }
      if ((status === "PASS" || status === "FAIL") && positive.evidence === negative.evidence) {
        issue(errors, "CONTROL_EVIDENCE_NOT_INDEPENDENT", `${id}: positive and negative controls must preserve distinct evidence`);
      }
      if (positive.receipt && negative.receipt && positive.receipt.fixtureId === negative.receipt.fixtureId) {
        issue(errors, "CONTROL_FIXTURE_NOT_DISCRIMINATING", `${id}: positive and negative controls require different fixture_id values`);
      }
    }
    if (kind === "STATIC") {
      if (applicability !== "NOT_APPLICABLE_STATIC") issue(errors, "STATIC_NEGATIVE_CONTRACT", `${id}: static requirement must use NOT_APPLICABLE_STATIC`);
      if (![negative.command, method, negative.control.expected, negative.observed].every((entry) => entry === "N/A")) {
        issue(errors, "STATIC_NEGATIVE_CONTRACT", `${id}: static negative control command/method/expected/observed must be N/A`);
      }
    }
    if (status === "PASS" && positive.observed !== "PASS") issue(errors, "POSITIVE_CONTROL_MISMATCH", `${id}: PASS requires positive observed PASS`);
    if (status === "FAIL" && positive.observed !== "FAIL") issue(errors, "POSITIVE_CONTROL_MISMATCH", `${id}: FAIL requires positive observed FAIL`);
    if (status === "BLOCKED" && !["BLOCKED", "NOT_RUN"].includes(positive.observed)) {
      issue(errors, "POSITIVE_CONTROL_MISMATCH", `${id}: BLOCKED requires positive observed BLOCKED or NOT_RUN`);
    }
    result.push({ id, planItemId, kind, status, requiredLevel, oracleId, source });
  }
  requireUnique(result.map((item) => item.id), "requirements[].id", errors);
  requireUnique(result.map((item) => item.planItemId), "requirements[].plan_item_id", errors);
  return result;
}

type FindingSummary = {
  id: string;
  classification: string;
  origin: string;
  status: string;
  introducedAfterFreeze: boolean;
  requirementIds: string[];
  allowedFiles: string[];
  forbiddenChanges: string[];
};

function checkFindings(value: unknown, inScope: string[], receipts: Map<string, EvidenceReceiptSummary>, errors: AuditIssue[]): FindingSummary[] {
  const findings = arrayAt(value, "findings", errors);
  const result: FindingSummary[] = [];
  for (const [index, item] of findings.entries()) {
    const path = `findings[${index}]`;
    const finding = objectAt(item, path, errors);
    const id = stringAt(finding.id, `${path}.id`, errors);
    if (id && !/^F-\d{3}$/.test(id)) issue(errors, "INVALID_FINDING_ID", `${path}.id must match F-NNN`);
    const requirementIds = stringArrayAt(finding.requirement_ids, `${path}.requirement_ids`, errors);
    const classification = stringAt(finding.classification, `${path}.classification`, errors);
    const origin = stringAt(finding.origin, `${path}.origin`, errors);
    const status = stringAt(finding.status, `${path}.status`, errors);
    requireEnum(classification, FINDING_CLASSES, `${path}.classification`, errors);
    requireEnum(origin, FINDING_ORIGINS, `${path}.origin`, errors);
    requireEnum(status, FINDING_STATUSES, `${path}.status`, errors);
    if (typeof finding.introduced_after_freeze !== "boolean") issue(errors, "EXPECTED_BOOLEAN", `${path}.introduced_after_freeze must be boolean`);
    const introducedAfterFreeze = finding.introduced_after_freeze === true;
    stringAt(finding.summary, `${path}.summary`, errors);
    stringAt(finding.evidence, `${path}.evidence`, errors);
    const allowedFiles = stringArrayAt(finding.allowed_files, `${path}.allowed_files`, errors, classification === "BLOCKING");
    allowedFiles.forEach((file, fileIndex) => requireConcretePath(file, `${path}.allowed_files[${fileIndex}]`, errors));
    const forbiddenChanges = stringArrayAt(finding.forbidden_changes, `${path}.forbidden_changes`, errors, classification === "BLOCKING");
    stringArrayAt(finding.closure_conditions, `${path}.closure_conditions`, errors, classification === "BLOCKING");
    if (classification === "BLOCKING") {
      if (requirementIds.length === 0 || requirementIds.some((req) => !inScope.includes(req))) {
        issue(errors, "BLOCKER_OUTSIDE_SCOPE", `${id}: blocking finding must link only frozen in-scope requirements`);
      }
      const preFix = checkControl(finding.pre_fix_control, `${path}.pre_fix_control`, errors, "FAIL", receipts);
      if (status === "OPEN" && preFix.observed !== "FAIL") issue(errors, "PREFX_CONTROL_NOT_FAILING", `${id}: open blocker needs observed pre-fix FAIL`);
      if (status === "CLOSED") {
        if (!isObject(finding.post_fix_control) || typeof finding.closure_evidence !== "string" || finding.closure_evidence.trim().length === 0) {
          issue(errors, "CLOSED_BLOCKER_PROOF_MISSING", `${id}: closed blocker requires post_fix_control and closure_evidence`);
        }
        const postFix = checkControl(finding.post_fix_control, `${path}.post_fix_control`, errors, "PASS", receipts);
        if (postFix.observed !== "PASS") issue(errors, "CLOSED_BLOCKER_PROOF_MISSING", `${id}: closed blocker needs post-fix observed PASS`);
        const closureEvidence = stringAt(finding.closure_evidence, `${path}.closure_evidence`, errors);
        if (closureEvidence && closureEvidence !== postFix.evidence) issue(errors, "CLOSURE_EVIDENCE_RECEIPT_MISMATCH", `${id}: closure_evidence must equal post_fix_control.evidence`);
        if (postFix.receipt && postFix.receipt.polarity !== "POST_FIX") issue(errors, "POST_FIX_RECEIPT_POLARITY_MISMATCH", `${id}: post-fix control must use a POST_FIX receipt`);
        if (postFix.receipt && !requirementIds.includes(postFix.receipt.requirementId)) issue(errors, "POST_FIX_RECEIPT_REQUIREMENT_MISMATCH", `${id}: post-fix receipt must belong to a linked requirement`);
      }
    }
    if ((classification === "NON_BLOCKING_DEBT" || classification === "OUT_OF_SCOPE") && requirementIds.some((req) => inScope.includes(req))) {
      issue(errors, "NONBLOCKER_LINKS_FROZEN_REQUIREMENT", `${id}: ${classification} must not link a frozen in-scope requirement`);
    }
    if (["REGRESSION", "AUDIT_MISS", "EVIDENCE_INVALIDATION"].includes(origin) && !introducedAfterFreeze) {
      issue(errors, "POST_FREEZE_ORIGIN_MISMATCH", `${id}: ${origin} must set introduced_after_freeze=true`);
    }
    result.push({ id, classification, origin, status, introducedAfterFreeze, requirementIds, allowedFiles, forbiddenChanges });
  }
  requireUnique(result.map((item) => item.id), "findings[].id", errors);
  return result;
}

type ReopenSummary = { findingId: string; gate: string; origin: string };

function checkReopens(value: unknown, inScope: string[], errors: AuditIssue[]): ReopenSummary[] {
  const records = arrayAt(value, "reopen_records", errors);
  const result: ReopenSummary[] = [];
  for (const [index, item] of records.entries()) {
    const path = `reopen_records[${index}]`;
    const record = objectAt(item, path, errors);
    const findingId = stringAt(record.finding_id, `${path}.finding_id`, errors);
    const gate = stringAt(record.gate, `${path}.gate`, errors);
    const origin = stringAt(record.origin, `${path}.origin`, errors);
    requireEnum(gate, REOPEN_GATES, `${path}.gate`, errors);
    requireEnum(origin, FINDING_ORIGINS, `${path}.origin`, errors);
    const linkedRule = stringAt(record.linked_rule, `${path}.linked_rule`, errors);
    if (linkedRule && !inScope.includes(linkedRule)) issue(errors, "REOPEN_LINKED_RULE_UNKNOWN", `${findingId}: linked_rule must identify one frozen in-scope requirement`);
    stringAt(record.baseline_proof, `${path}.baseline_proof`, errors);
    const causalProof = stringAt(record.causal_proof, `${path}.causal_proof`, errors, true);
    const missExplanation = stringAt(record.miss_explanation, `${path}.miss_explanation`, errors, true);
    stringAt(record.debt_rejection_reason, `${path}.debt_rejection_reason`, errors);
    const affected = stringArrayAt(record.affected_requirement_ids, `${path}.affected_requirement_ids`, errors, true);
    if (affected.some((id) => !inScope.includes(id))) issue(errors, "REOPEN_OUTSIDE_SCOPE", `${findingId}: affected requirements must be in frozen scope`);
    if (linkedRule && inScope.includes(linkedRule) && !affected.includes(linkedRule)) issue(errors, "REOPEN_LINKED_RULE_NOT_AFFECTED", `${findingId}: linked_rule must be included in affected_requirement_ids`);
    stringAt(record.resweep_evidence, `${path}.resweep_evidence`, errors);
    stringAt(record.approval_evidence, `${path}.approval_evidence`, errors);
    if (record.approved !== true) issue(errors, "REOPEN_NOT_APPROVED", `${findingId}: approved must be true`);
    const expectedGate = origin === "REGRESSION" ? "IN_SCOPE_REGRESSION" : origin === "AUDIT_MISS" ? "AUDIT_MISS" : origin === "EVIDENCE_INVALIDATION" ? "EVIDENCE_INVALIDATION" : null;
    if (expectedGate && gate !== expectedGate) issue(errors, "REOPEN_GATE_ORIGIN_MISMATCH", `${findingId}: ${origin} requires ${expectedGate}`);
    if (origin === "REGRESSION" && causalProof === "N/A") issue(errors, "REGRESSION_CAUSAL_PROOF_MISSING", `${findingId}: regression reopen requires causal_proof`);
    if (origin === "AUDIT_MISS" && missExplanation === "N/A") issue(errors, "AUDIT_MISS_EXPLANATION_MISSING", `${findingId}: audit-miss reopen requires miss_explanation`);
    result.push({ findingId, gate, origin });
  }
  requireUnique(result.map((item) => item.findingId), "reopen_records[].finding_id", errors);
  return result;
}

function checkInheritedBlockers(value: unknown, errors: AuditIssue[]): void {
  const arr = arrayAt(value, "inherited_blockers", errors);
  for (const [index, item] of arr.entries()) {
    const blocker = objectAt(item, `inherited_blockers[${index}]`, errors);
    stringAt(blocker.previous_audit_id, `inherited_blockers[${index}].previous_audit_id`, errors);
    stringAt(blocker.blocker_id, `inherited_blockers[${index}].blocker_id`, errors);
    const disposition = stringAt(blocker.disposition, `inherited_blockers[${index}].disposition`, errors);
    if (disposition && !INHERITED_DISPOSITIONS.has(disposition)) issue(errors, "INVALID_INHERITED_DISPOSITION", `inherited_blockers[${index}].disposition=${disposition}`);
    stringAt(blocker.evidence, `inherited_blockers[${index}].evidence`, errors);
    stringAt(blocker.reason, `inherited_blockers[${index}].reason`, errors);
  }
}

function checkDowngradeDeclaration(value: unknown, provenanceLevel: string | null, evidenceCeiling: string | null, errors: AuditIssue[]): void {
  if (provenanceLevel === "v2.1-required" && evidenceCeiling === "component") {
    if (value === null || value === undefined) {
      issue(errors, "DOWNGRADE_DECLARATION_REQUIRED", `provenance_level=v2.1-required with evidence_ceiling=component requires non-null downgrade_declaration (AGENTS.md §15 rule P-05)`);
      return;
    }
    const decl = objectAt(value, "downgrade_declaration", errors);
    stringAt(decl.reason, "downgrade_declaration.reason", errors);
    stringAt(decl.ceiling, "downgrade_declaration.ceiling", errors);
    stringAt(decl.unaffected_scope, "downgrade_declaration.unaffected_scope", errors);
    stringAt(decl.affected_scope, "downgrade_declaration.affected_scope", errors);
  }
}

function checkReworkPackage(value: unknown, openBlockers: FindingSummary[], errors: AuditIssue[]) {
  const pkg = objectAt(value, "rework_package", errors);
  const status = stringAt(pkg.status, "rework_package.status", errors);
  if (status && status !== "NONE" && status !== "FROZEN") issue(errors, "INVALID_REWORK_STATUS", `rework_package.status=${status}`);
  const findingIds = stringArrayAt(pkg.finding_ids, "rework_package.finding_ids", errors);
  requireUnique(findingIds, "rework_package.finding_ids", errors);
  const items = arrayAt(pkg.items, "rework_package.items", errors);
  const itemIds: string[] = [];
  for (const [index, item] of items.entries()) {
    const path = `rework_package.items[${index}]`;
    const entry = objectAt(item, path, errors);
    const findingId = stringAt(entry.finding_id, `${path}.finding_id`, errors);
    itemIds.push(findingId);
    const allowedFiles = stringArrayAt(entry.allowed_files, `${path}.allowed_files`, errors, true);
    allowedFiles.forEach((file, fileIndex) => requireConcretePath(file, `${path}.allowed_files[${fileIndex}]`, errors));
    const forbiddenChanges = stringArrayAt(entry.forbidden_changes, `${path}.forbidden_changes`, errors, true);
    const requiredChanges = stringArrayAt(entry.required_changes, `${path}.required_changes`, errors, true);
    for (const change of requiredChanges) {
      if (/完善|加强|同步|相关文件|视情况|适当处理|as needed|as appropriate/i.test(change)) {
        issue(errors, "VAGUE_REWORK_INSTRUCTION", `${findingId}: required change contains vague language: ${change}`);
      }
    }
    const commands = arrayAt(entry.acceptance_commands, `${path}.acceptance_commands`, errors);
    if (commands.length === 0) issue(errors, "EMPTY_ARRAY", `${path}.acceptance_commands must not be empty`);
    for (const [commandIndex, commandValue] of commands.entries()) {
      const commandPath = `${path}.acceptance_commands[${commandIndex}]`;
      const command = objectAt(commandValue, commandPath, errors);
      const commandText = stringAt(command.command, `${commandPath}.command`, errors);
      requireCommand(commandText, `${commandPath}.command`, errors);
      const expected = stringAt(command.expected, `${commandPath}.expected`, errors);
      requireObservableExpectation(expected, `${commandPath}.expected`, errors);
    }
    const finding = openBlockers.find((candidate) => candidate.id === findingId);
    if (finding && !sameSet(allowedFiles, finding.allowedFiles)) issue(errors, "REWORK_ALLOWED_FILES_DRIFT", `${findingId}: package allowed_files must equal finding allowed_files`);
    if (finding && !sameSet(forbiddenChanges, finding.forbiddenChanges)) issue(errors, "REWORK_FORBIDDEN_CHANGES_DRIFT", `${findingId}: package forbidden_changes must equal finding forbidden_changes`);
  }
  requireUnique(itemIds, "rework_package.items[].finding_id", errors);
  return { status, findingIds, itemIds };
}

function checkVerdictBody(source: string, verdict: string, errors: AuditIssue[]) {
  const matches = [...source.matchAll(/^\*\*Verdict\*\*:\s*`(ACCEPT|REWORK|BLOCKED|INVALID)`\s*$/gm)];
  if (matches.length !== 1) issue(errors, "BODY_VERDICT_COUNT", `expected one exact body verdict, found ${matches.length}`);
  else if (matches[0][1] !== verdict) issue(errors, "BODY_VERDICT_MISMATCH", `body=${matches[0][1]}, contract=${verdict}`);
}

function checkNarrativeIdentity(source: string, auditId: string | null, commit: string, requirementIds: string[], findingIds: string[], errors: AuditIssue[]) {
  const narrative = source.replace(/<!-- AUDIT_CONTRACT_START -->[\s\S]*?<!-- AUDIT_CONTRACT_END -->/, "");
  if (auditId && !narrative.includes(auditId)) issue(errors, "BODY_AUDIT_ID_MISSING", `narrative body must repeat audit_id ${auditId}`);
  if (commit && !narrative.includes(commit)) issue(errors, "BODY_BASELINE_MISSING", `narrative body must repeat baseline commit ${commit}`);
  for (const id of requirementIds) {
    if (!narrative.includes(id)) issue(errors, "BODY_REQUIREMENT_MISSING", `narrative body must cover ${id}`);
  }
  for (const id of findingIds) {
    if (!narrative.includes(id)) issue(errors, "BODY_FINDING_MISSING", `narrative body must cover ${id}`);
  }
}

export function validateAuditSource(source: string, label = "audit.md"): AuditValidationResult {
  const errors: AuditIssue[] = [];
  const warnings: AuditIssue[] = [];

  for (const heading of REQUIRED_HEADINGS) {
    if (!source.includes(heading)) issue(errors, "MISSING_SECTION", `${label}: ${heading}`);
  }
  const unresolvedPatterns: Array<[string, RegExp]> = [
    ["UNRESOLVED_REPLACE", /\bREPLACE_[A-Z0-9_]+\b/g],
    ["UNRESOLVED_TBD", /\bTBD\b/gi],
    ["UNRESOLVED_TODO", /\bTODO\b/gi],
    ["ANGLE_PLACEHOLDER", /<[A-Za-z][^>\n]*>/g],
  ];
  for (const [code, pattern] of unresolvedPatterns) {
    const matches = source.match(pattern) ?? [];
    if (matches.length > 0) issue(errors, code, `${label}: ${matches.length} unresolved placeholder(s)`);
  }

  const contract = parseContract(source, errors);
  const schemaVersion = typeof contract.schema_version === "string" ? contract.schema_version : null;
  const auditId = typeof contract.audit_id === "string" ? contract.audit_id : null;
  const verdict = typeof contract.verdict === "string" ? contract.verdict : null;
  if (schemaVersion !== "2.1") issue(errors, "SCHEMA_VERSION", `schema_version must be 2.1`);
  stringAt(contract.audit_id, "audit_id", errors);
  if (auditId && !/^[A-Za-z0-9][A-Za-z0-9._-]{4,}$/.test(auditId)) issue(errors, "INVALID_AUDIT_ID", `audit_id=${auditId}`);
  const generation = contract.generation;
  if (!Number.isInteger(generation) || (typeof generation === "number" && generation < 1)) issue(errors, "INVALID_GENERATION", `generation must be a positive integer`);
  const previousAudit = contract.previous_audit;
  if (generation === 1 && previousAudit !== null) issue(errors, "GENERATION_ONE_WITH_PREDECESSOR", `generation 1 requires previous_audit=null`);
  if (typeof generation === "number" && generation > 1) {
    const previous = objectAt(previousAudit, "previous_audit", errors);
    const previousPath = stringAt(previous.path, "previous_audit.path", errors);
    if (previousPath) {
      requireConcretePath(previousPath, "previous_audit.path", errors);
      if (!previousPath.startsWith("audits/")) issue(errors, "PREVIOUS_AUDIT_OUTSIDE_ARCHIVE", `previous_audit.path must be under audits/`);
    }
    requireSha256(stringAt(previous.sha256, "previous_audit.sha256", errors), "previous_audit.sha256", errors);
    stringAt(previous.audit_id, "previous_audit.audit_id", errors);
  }
  const scopeLock = objectAt(contract.scope_lock, "scope_lock", errors);
  const scopeLockPath = stringAt(scopeLock.path, "scope_lock.path", errors);
  if (scopeLockPath) {
    requireConcretePath(scopeLockPath, "scope_lock.path", errors);
    if (!scopeLockPath.startsWith("audits/")) issue(errors, "SCOPE_LOCK_OUTSIDE_ARCHIVE", `scope_lock.path must be under audits/`);
  }
  requireSha256(stringAt(scopeLock.sha256, "scope_lock.sha256", errors), "scope_lock.sha256", errors);
  stringAt(scopeLock.lock_id, "scope_lock.lock_id", errors);

  const baseline = objectAt(contract.baseline, "baseline", errors);
  const implementationBaseCommit = stringAt(baseline.implementation_base_commit, "baseline.implementation_base_commit", errors);
  const commit = stringAt(baseline.commit, "baseline.commit", errors);
  const headAtVerdict = stringAt(baseline.head_at_verdict, "baseline.head_at_verdict", errors);
  requireCommit(implementationBaseCommit, "baseline.implementation_base_commit", errors);
  requireCommit(commit, "baseline.commit", errors);
  requireCommit(headAtVerdict, "baseline.head_at_verdict", errors);
  const workspaceRoot = stringAt(baseline.workspace_root, "baseline.workspace_root", errors);
  if (workspaceRoot) {
    requireConcretePath(workspaceRoot, "baseline.workspace_root", errors);
    if (!workspaceRoot.startsWith("/")) issue(errors, "WORKSPACE_ROOT_NOT_ABSOLUTE", `baseline.workspace_root must be absolute`);
  }
  const repositoryRoot = stringAt(baseline.repository_root, "baseline.repository_root", errors);
  if (repositoryRoot) {
    requireConcretePath(repositoryRoot, "baseline.repository_root", errors);
    if (!repositoryRoot.startsWith("/")) issue(errors, "REPOSITORY_ROOT_NOT_ABSOLUTE", `baseline.repository_root must be absolute`);
  }
  stringAt(baseline.dirty_surface, "baseline.dirty_surface", errors);
  stringArrayAt(baseline.dirty_paths, "baseline.dirty_paths", errors).forEach((path, index) => requireConcretePath(path, `baseline.dirty_paths[${index}]`, errors));
  const preChangeReceipt = checkFileReference(baseline.pre_change_receipt, "baseline.pre_change_receipt", errors, true);
  const verdictStateReceipt = checkFileReference(baseline.verdict_state_receipt, "baseline.verdict_state_receipt", errors, true);
  const planPaths = checkSources(baseline, errors);

  const scope = objectAt(contract.scope, "scope", errors);
  const scopeStatus = stringAt(scope.status, "scope.status", errors);
  if (scopeStatus && scopeStatus !== "FROZEN" && scopeStatus !== "UNFROZEN") issue(errors, "INVALID_SCOPE_STATUS", `scope.status=${scopeStatus}`);
  const provenanceLevel = stringAt(scope.provenance_level, "scope.provenance_level", errors);
  if (provenanceLevel && !PROVENANCE_LEVELS.has(provenanceLevel)) issue(errors, "INVALID_PROVENANCE_LEVEL", `scope.provenance_level=${provenanceLevel} (AGENTS.md §15 rule P-01)`);
  const frozenAt = stringAt(scope.frozen_at, "scope.frozen_at", errors);
  requireIsoTimestamp(frozenAt, "scope.frozen_at", errors);
  const inScope = stringArrayAt(scope.in_scope, "scope.in_scope", errors, true);
  requireUnique(inScope, "scope.in_scope", errors);
  inScope.forEach((id) => {
    if (!/^REQ-\d{3}$/.test(id)) issue(errors, "INVALID_REQUIREMENT_ID", `scope.in_scope contains ${id}`);
  });
  stringArrayAt(scope.out_of_scope, "scope.out_of_scope", errors, true);
  const assumptions = arrayAt(scope.assumptions, "scope.assumptions", errors);
  for (const [index, item] of assumptions.entries()) {
    const assumption = objectAt(item, `scope.assumptions[${index}]`, errors);
    stringAt(assumption.statement, `scope.assumptions[${index}].statement`, errors);
    stringAt(assumption.disproof, `scope.assumptions[${index}].disproof`, errors);
  }
  stringArrayAt(scope.exit_criteria, "scope.exit_criteria", errors, true);

  const receipts = checkEvidenceReceipts(contract.evidence_receipts, verdictStateReceipt?.sha256 ?? "", errors);
  const requirements = checkRequirements(contract.requirements, planPaths, receipts, errors);
  const requirementIds = requirements.map((item) => item.id);
  if (!sameSet(inScope, requirementIds)) issue(errors, "SCOPE_REQUIREMENT_SET_MISMATCH", `scope.in_scope must exactly equal requirements[].id`);

  const sweep = objectAt(contract.sweep, "sweep", errors);
  const sweepStatus = stringAt(sweep.status, "sweep.status", errors);
  if (sweepStatus && sweepStatus !== "COMPLETE" && sweepStatus !== "INCOMPLETE") issue(errors, "INVALID_SWEEP_STATUS", `sweep.status=${sweepStatus}`);
  const sweepIds = stringArrayAt(sweep.requirement_ids, "sweep.requirement_ids", errors);
  requireUnique(sweepIds, "sweep.requirement_ids", errors);
  stringArrayAt(sweep.files_inspected, "sweep.files_inspected", errors, sweepStatus === "COMPLETE").forEach((file, index) => requireConcretePath(file, `sweep.files_inspected[${index}]`, errors));
  stringArrayAt(sweep.commands, "sweep.commands", errors, sweepStatus === "COMPLETE").forEach((command, index) => requireCommand(command, `sweep.commands[${index}]`, errors));
  const completedAt = stringAt(sweep.completed_at, "sweep.completed_at", errors);
  requireIsoTimestamp(completedAt, "sweep.completed_at", errors);
  if (frozenAt && completedAt && !Number.isNaN(Date.parse(frozenAt)) && !Number.isNaN(Date.parse(completedAt)) && Date.parse(frozenAt) > Date.parse(completedAt)) {
    issue(errors, "FREEZE_AFTER_SWEEP", `scope.frozen_at must be at or before sweep.completed_at`);
  }
  if (sweepStatus === "COMPLETE" && !sameSet(sweepIds, inScope)) issue(errors, "SWEEP_SCOPE_SET_MISMATCH", `complete sweep requirement_ids must equal frozen in_scope`);

  const findings = checkFindings(contract.findings, inScope, receipts, errors);
  const openBlockers = findings.filter((item) => item.classification === "BLOCKING" && item.status === "OPEN");
  const blockedBlockers = findings.filter((item) => item.classification === "BLOCKING" && item.status === "BLOCKED");
  const reopens = checkReopens(contract.reopen_records, inScope, errors);
  if (reopens.length > 0 && generation === 1) issue(errors, "REOPEN_WITHOUT_PRIOR_GENERATION", `reopen records require generation > 1 and an immutable previous_audit`);
  for (const finding of findings.filter((item) => item.classification === "BLOCKING" && item.introducedAfterFreeze)) {
    const reopen = reopens.find((record) => record.findingId === finding.id);
    if (!reopen) issue(errors, "POST_FREEZE_BLOCKER_WITHOUT_REOPEN", `${finding.id}: introduced-after-freeze blocker requires reopen record`);
    else if (reopen.origin !== finding.origin) issue(errors, "REOPEN_ORIGIN_MISMATCH", `${finding.id}: finding origin and reopen origin differ`);
  }
  for (const reopen of reopens) {
    const finding = findings.find((candidate) => candidate.id === reopen.findingId);
    if (!finding || finding.classification !== "BLOCKING" || !finding.introducedAfterFreeze) {
      issue(errors, "ORPHAN_REOPEN_RECORD", `${reopen.findingId}: reopen record must match one introduced-after-freeze blocking finding`);
    }
  }

  const rework = checkReworkPackage(contract.rework_package, openBlockers, errors);
  const unclassified = contract.unclassified_findings;
  if (!Number.isInteger(unclassified) || (typeof unclassified === "number" && unclassified < 0)) {
    issue(errors, "INVALID_UNCLASSIFIED_COUNT", `unclassified_findings must be a non-negative integer`);
  }
  const evidenceCeiling = stringAt(contract.evidence_ceiling, "evidence_ceiling", errors);
  if (evidenceCeiling && !EVIDENCE_LEVELS.has(evidenceCeiling)) issue(errors, "INVALID_EVIDENCE_LEVEL", `evidence_ceiling=${evidenceCeiling}`);
  checkInheritedBlockers(contract.inherited_blockers, errors);
  checkDowngradeDeclaration(contract.downgrade_declaration, provenanceLevel, evidenceCeiling, errors);
  const blockerReason = nullableStringAt(contract.blocker_reason, "blocker_reason", errors);
  const invalidReason = nullableStringAt(contract.invalid_reason, "invalid_reason", errors);
  const verdictValue = stringAt(contract.verdict, "verdict", errors);
  requireEnum(verdictValue, VERDICTS, "verdict", errors);
  checkVerdictBody(source, verdictValue, errors);
  checkNarrativeIdentity(source, auditId, commit, requirementIds, findings.map((item) => item.id), errors);

  if ((verdictValue === "ACCEPT" || verdictValue === "REWORK") && evidenceCeiling === "NOT-RUN") {
    issue(errors, "EVIDENCE_CEILING_NOT_EXECUTABLE", `${verdictValue} cannot use evidence_ceiling=NOT-RUN`);
  }
  if (verdictValue === "ACCEPT" && provenanceLevel === "component-only") {
    issue(errors, "COMPONENT_ONLY_ACCEPT_FORBIDDEN", `ACCEPT forbidden when scope.provenance_level=component-only (AGENTS.md §15 rule P-06)`);
  }
  if ((verdictValue === "ACCEPT" || verdictValue === "REWORK") && !preChangeReceipt) issue(errors, "PRE_CHANGE_RECEIPT_REQUIRED", `${verdictValue} requires baseline.pre_change_receipt`);
  if ((verdictValue === "ACCEPT" || verdictValue === "REWORK") && !verdictStateReceipt) issue(errors, "VERDICT_STATE_RECEIPT_REQUIRED", `${verdictValue} requires baseline.verdict_state_receipt`);

  if ((verdictValue === "ACCEPT" || verdictValue === "REWORK") && planPaths.length === 0) issue(errors, "AUTHORITATIVE_PLAN_MISSING", `${verdictValue} requires at least one plan source`);
  if ((verdictValue === "ACCEPT" || verdictValue === "REWORK") && scopeStatus !== "FROZEN") issue(errors, "SCOPE_NOT_FROZEN", `${verdictValue} requires scope.status=FROZEN`);
  if ((verdictValue === "ACCEPT" || verdictValue === "REWORK") && sweepStatus !== "COMPLETE") issue(errors, "SWEEP_NOT_COMPLETE", `${verdictValue} requires sweep.status=COMPLETE`);
  if ((verdictValue === "ACCEPT" || verdictValue === "REWORK") && commit !== headAtVerdict) issue(errors, "BASELINE_DRIFT", `${verdictValue} requires baseline commit == head_at_verdict`);
  if ((verdictValue === "ACCEPT" || verdictValue === "REWORK") && unclassified !== 0) issue(errors, "UNCLASSIFIED_FINDINGS", `${verdictValue} requires unclassified_findings=0`);

  if (verdictValue === "ACCEPT") {
    if (requirements.some((item) => item.status !== "PASS")) issue(errors, "ACCEPT_WITH_NONPASS_REQUIREMENT", `ACCEPT requires every requirement PASS`);
    if (openBlockers.length > 0 || blockedBlockers.length > 0) issue(errors, "ACCEPT_WITH_BLOCKER", `ACCEPT cannot contain OPEN/BLOCKED blocking findings`);
    if (findings.some((item) => item.classification === "UNVERIFIED" && item.status !== "CLOSED")) issue(errors, "ACCEPT_WITH_UNVERIFIED", `ACCEPT cannot contain unresolved UNVERIFIED findings`);
    if (rework.status !== "NONE" || rework.findingIds.length > 0 || rework.itemIds.length > 0) issue(errors, "ACCEPT_WITH_REWORK", `ACCEPT requires empty NONE rework package`);
    if (blockerReason !== null || invalidReason !== null) issue(errors, "ACCEPT_WITH_REASON", `ACCEPT requires blocker_reason and invalid_reason null`);
  }

  if (verdictValue === "REWORK") {
    const blockerIds = openBlockers.map((item) => item.id);
    const failedRequirementIds = requirements.filter((item) => item.status === "FAIL").map((item) => item.id);
    const blockerRequirementIds = unique(openBlockers.flatMap((item) => item.requirementIds));
    if (blockerIds.length === 0) issue(errors, "REWORK_WITHOUT_BLOCKER", `REWORK requires at least one open blocking finding`);
    if (requirements.some((item) => item.status === "BLOCKED" || item.status === "INVALID")) issue(errors, "REWORK_WITH_NONFINAL_REQUIREMENT", `REWORK permits only PASS or FAIL requirements`);
    if (!sameSet(failedRequirementIds, blockerRequirementIds)) issue(errors, "FAILED_REQUIREMENT_WITHOUT_BLOCKER", `failed requirements must exactly equal requirements linked by open blockers`);
    if (blockedBlockers.length > 0) issue(errors, "REWORK_WITH_BLOCKED_FINDING", `BLOCKED blocking findings require verdict BLOCKED`);
    if (rework.status !== "FROZEN") issue(errors, "REWORK_NOT_FROZEN", `REWORK requires rework_package.status=FROZEN`);
    if (!sameSet(rework.findingIds, blockerIds)) issue(errors, "REWORK_FINDING_SET_MISMATCH", `rework finding_ids must exactly equal open blockers`);
    if (!sameSet(rework.itemIds, blockerIds)) issue(errors, "REWORK_ITEM_SET_MISMATCH", `rework items must exactly equal open blockers`);
    if (blockerReason !== null || invalidReason !== null) issue(errors, "REWORK_WITH_REASON", `REWORK requires blocker_reason and invalid_reason null`);
  }

  if (verdictValue === "BLOCKED") {
    if (!blockerReason) issue(errors, "BLOCKER_REASON_MISSING", `BLOCKED requires blocker_reason`);
    if (invalidReason !== null) issue(errors, "BLOCKED_WITH_INVALID_REASON", `BLOCKED requires invalid_reason null`);
    if (rework.status !== "NONE" || rework.findingIds.length > 0 || rework.itemIds.length > 0) issue(errors, "BLOCKED_WITH_REWORK", `BLOCKED must not emit an actionable rework package`);
  }

  if (verdictValue === "INVALID") {
    if (!invalidReason) issue(errors, "INVALID_REASON_MISSING", `INVALID requires invalid_reason`);
    if (blockerReason !== null) issue(errors, "INVALID_WITH_BLOCKER_REASON", `INVALID requires blocker_reason null`);
    if (rework.status !== "NONE" || rework.findingIds.length > 0 || rework.itemIds.length > 0) issue(errors, "INVALID_WITH_REWORK", `INVALID must not emit an actionable rework package`);
  }

  const ceilingRank = EVIDENCE_LEVELS.get(evidenceCeiling);
  if ((verdictValue === "ACCEPT" || verdictValue === "REWORK") && ceilingRank !== undefined) {
    for (const requirement of requirements.filter((item) => item.status === "PASS" || item.status === "FAIL")) {
      const requiredRank = EVIDENCE_LEVELS.get(requirement.requiredLevel);
      if (requiredRank !== undefined && ceilingRank < requiredRank) issue(errors, "EVIDENCE_CEILING_TOO_LOW", `${requirement.id}: ceiling ${evidenceCeiling} below required ${requirement.requiredLevel}`);
    }
  }

  if (findings.some((item) => item.origin === "AUDIT_MISS")) {
    issue(warnings, "AUDIT_MISS_COST", "report contains AUDIT_MISS; disclose added implementation time/token cost and prior-package compliance");
  }

  return {
    valid: errors.length === 0,
    schemaVersion,
    auditId,
    verdict,
    counts: {
      requirements: requirements.length,
      findings: findings.length,
      openBlockers: openBlockers.length,
      reopenRecords: reopens.length,
    },
    errors,
    warnings,
  };
}

function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function resolveLedgerFile(root: string, ledgerPath: string, field: string, errors: AuditIssue[]): string | null {
  if (!root || !ledgerPath) return null;
  if (isAbsolute(ledgerPath)) {
    issue(errors, "SOURCE_PATH_NOT_RELATIVE", `${field} must be relative to baseline.workspace_root`);
    return null;
  }
  const candidate = resolve(root, ledgerPath);
  const relation = relative(root, candidate);
  if (relation.startsWith("..") || isAbsolute(relation)) {
    issue(errors, "SOURCE_PATH_ESCAPES_WORKSPACE", `${field} escapes baseline.workspace_root`);
    return null;
  }
  if (!existsSync(candidate)) {
    issue(errors, "SOURCE_FILE_MISSING", `${field}: ${candidate}`);
    return null;
  }
  if (!statSync(candidate).isFile()) {
    issue(errors, "SOURCE_NOT_FILE", `${field}: ${candidate}`);
    return null;
  }
  const realRoot = realpathSync(root);
  const realCandidate = realpathSync(candidate);
  const realRelation = relative(realRoot, realCandidate);
  if (realRelation.startsWith("..") || isAbsolute(realRelation)) {
    issue(errors, "SOURCE_REALPATH_ESCAPES_WORKSPACE", `${field}: ${realCandidate}`);
    return null;
  }
  return realCandidate;
}

function verifyLedgerEntries(entries: unknown, root: string, field: string, errors: AuditIssue[], mismatchCode = "SOURCE_HASH_MISMATCH") {
  if (!Array.isArray(entries)) return;
  for (const [index, value] of entries.entries()) {
    if (!isObject(value)) continue;
    const path = typeof value.path === "string" ? value.path : "";
    const expected = typeof value.sha256 === "string" ? value.sha256.toLowerCase() : "";
    const resolved = resolveLedgerFile(root, path, `${field}[${index}].path`, errors);
    if (resolved && expected && hashFile(resolved) !== expected) {
      issue(errors, mismatchCode, `${field}[${index}]: ${path}`);
    }
  }
}

function verifyJsonReference(root: string, reference: unknown, field: string, mismatchCode: string, errors: AuditIssue[]): JsonObject | null {
  if (!isObject(reference)) return null;
  const path = typeof reference.path === "string" ? reference.path : "";
  const expected = typeof reference.sha256 === "string" ? reference.sha256.toLowerCase() : "";
  const file = resolveLedgerFile(root, path, `${field}.path`, errors);
  if (!file) return null;
  if (expected && hashFile(file) !== expected) {
    issue(errors, mismatchCode, `${field}: ${path}`);
    return null;
  }
  try {
    return objectAt(JSON.parse(readFileSync(file, "utf8")), field, errors);
  } catch (error) {
    issue(errors, "REFERENCED_JSON_INVALID", `${field}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function scopeLockProjection(lock: JsonObject): unknown {
  const requirements = Array.isArray(lock.requirements) ? lock.requirements : [];
  return {
    plan_sources: lock.plan_sources,
    in_scope: isObject(lock.scope) ? lock.scope.in_scope : undefined,
    out_of_scope: isObject(lock.scope) ? lock.scope.out_of_scope : undefined,
    assumptions: isObject(lock.scope) ? lock.scope.assumptions : undefined,
    exit_criteria: isObject(lock.scope) ? lock.scope.exit_criteria : undefined,
    requirements: requirements.map((value) => {
      const requirement = isObject(value) ? value : {};
      return {
        id: requirement.id,
        plan_item_id: requirement.plan_item_id,
        kind: requirement.kind,
        source: requirement.source,
        behavior: requirement.behavior,
        required_evidence_level: requirement.required_evidence_level,
        oracle_id: requirement.oracle_id,
        oracle: requirement.oracle,
      };
    }),
  };
}

function gitStatusEntryMap(repositoryRoot: string, errors: AuditIssue[]): Map<string, string> {
  const run = Bun.spawnSync({ cmd: ["git", "-C", repositoryRoot, "status", "--porcelain=v1", "-z", "--untracked-files=all"], stdout: "pipe", stderr: "pipe" });
  const result = new Map<string, string>();
  if (run.exitCode !== 0) {
    issue(errors, "GIT_STATUS_UNAVAILABLE", run.stderr.toString().trim() || repositoryRoot);
    return result;
  }
  const tokens = run.stdout.toString().split("\0").filter(Boolean);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const status = token.slice(0, 2);
    const path = token.slice(3);
    if (path) {
      const absolute = resolve(repositoryRoot, path);
      const contentSha256 = existsSync(absolute) && statSync(absolute).isFile() ? hashFile(absolute) : "MISSING";
      result.set(path, JSON.stringify({ status, content_sha256: contentSha256 }));
    }
    if (/[RC]/.test(status) && tokens[index + 1]) {
      const otherPath = tokens[++index];
      const absolute = resolve(repositoryRoot, otherPath);
      const contentSha256 = existsSync(absolute) && statSync(absolute).isFile() ? hashFile(absolute) : "MISSING";
      result.set(otherPath, JSON.stringify({ status, content_sha256: contentSha256 }));
    }
  }
  return result;
}

function planAnchorExists(workspaceRoot: string, source: string): boolean {
  const [path, anchor] = source.split("#", 2);
  if (!path || !anchor) return false;
  const file = resolveLedgerFile(workspaceRoot, path, "plan_registry.source", []);
  if (!file) return false;
  const anchors = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((line) => /^#{1,6}\s+/.test(line))
    .map((line) => line.replace(/^#{1,6}\s+/, "").trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-").replace(/-+/g, "-"));
  return anchors.includes(anchor.toLowerCase());
}

function checkPlanRegistry(lock: JsonObject, contract: JsonObject, workspaceRoot: string, errors: AuditIssue[]) {
  const registry = Array.isArray(lock.plan_registry) ? lock.plan_registry : [];
  if (registry.length === 0) issue(errors, "PLAN_REGISTRY_MISSING", `approved scope lock requires a non-empty plan_registry`);
  const requirements = Array.isArray(contract.requirements) ? contract.requirements.filter(isObject) : [];
  const inScopeItems: JsonObject[] = [];
  const itemIds: string[] = [];
  for (const [index, value] of registry.entries()) {
    if (!isObject(value)) {
      issue(errors, "EXPECTED_OBJECT", `scope_lock.plan_registry[${index}] must be an object`);
      continue;
    }
    const itemId = typeof value.plan_item_id === "string" ? value.plan_item_id : "";
    if (!/^PLAN-REQ-\d{3}$/.test(itemId)) issue(errors, "INVALID_PLAN_ITEM_ID", `scope_lock.plan_registry[${index}].plan_item_id=${itemId}`);
    itemIds.push(itemId);
    const disposition = value.disposition;
    if (disposition === "IN_SCOPE") {
      inScopeItems.push(value);
      if (typeof value.requirement_id !== "string" || !/^REQ-\d{3}$/.test(value.requirement_id)) issue(errors, "PLAN_REGISTRY_REQUIREMENT_MISSING", `${itemId}: IN_SCOPE needs requirement_id`);
      if (typeof value.source !== "string" || !planAnchorExists(workspaceRoot, value.source)) issue(errors, "PLAN_REGISTRY_ANCHOR_MISSING", `${itemId}: source anchor is absent from the hashed plan`);
    } else if (disposition === "EXCLUDED") {
      if (typeof value.reason !== "string" || value.reason.trim().length === 0) issue(errors, "PLAN_EXCLUSION_REASON_MISSING", `${itemId}: EXCLUDED needs reason`);
      if (!isObject(value.approval_receipt)) issue(errors, "PLAN_EXCLUSION_APPROVAL_MISSING", `${itemId}: EXCLUDED needs approval_receipt`);
      else verifyJsonReference(workspaceRoot, value.approval_receipt, `scope_lock.plan_registry[${index}].approval_receipt`, "PLAN_EXCLUSION_APPROVAL_HASH_MISMATCH", errors);
    } else {
      issue(errors, "INVALID_PLAN_DISPOSITION", `${itemId}: disposition must be IN_SCOPE or EXCLUDED`);
    }
  }
  requireUnique(itemIds, "scope_lock.plan_registry[].plan_item_id", errors);
  const registeredIds = inScopeItems.map((item) => String(item.plan_item_id));
  const requirementPlanIds = requirements.map((item) => String(item.plan_item_id));
  if (!sameSet(registeredIds, requirementPlanIds)) issue(errors, "PLAN_REGISTRY_COVERAGE_MISMATCH", `all IN_SCOPE plan registry items must map exactly to audit requirements`);
  for (const item of inScopeItems) {
    const requirement = requirements.find((candidate) => candidate.plan_item_id === item.plan_item_id);
    if (!requirement) continue;
    const registryProjection = {
      id: item.requirement_id,
      plan_item_id: item.plan_item_id,
      kind: item.kind,
      source: item.source,
      behavior: item.behavior,
      required_evidence_level: item.required_evidence_level,
      oracle_id: item.oracle_id,
      oracle: item.oracle,
    };
    const requirementProjection = {
      id: requirement.id,
      plan_item_id: requirement.plan_item_id,
      kind: requirement.kind,
      source: requirement.source,
      behavior: requirement.behavior,
      required_evidence_level: requirement.required_evidence_level,
      oracle_id: requirement.oracle_id,
      oracle: requirement.oracle,
    };
    if (JSON.stringify(registryProjection) !== JSON.stringify(requirementProjection)) issue(errors, "PLAN_REGISTRY_REQUIREMENT_MISMATCH", `${String(item.plan_item_id)} differs from audit requirement`);
  }
}

function stateEntryMap(value: unknown): Map<string, string> {
  const result = new Map<string, string>();
  if (!Array.isArray(value)) return result;
  for (const item of value) {
    if (!isObject(item) || typeof item.path !== "string") continue;
    result.set(item.path, JSON.stringify({ status: item.status, content_sha256: item.content_sha256 }));
  }
  return result;
}

function frozenProjection(contract: JsonObject): unknown {
  const baseline = isObject(contract.baseline) ? contract.baseline : {};
  const scope = isObject(contract.scope) ? contract.scope : {};
  const requirements = Array.isArray(contract.requirements) ? contract.requirements : [];
  return {
    plan_sources: baseline.plan_sources,
    in_scope: scope.in_scope,
    out_of_scope: scope.out_of_scope,
    assumptions: scope.assumptions,
    exit_criteria: scope.exit_criteria,
    requirements: requirements.map((value) => {
      const requirement = isObject(value) ? value : {};
      return {
        id: requirement.id,
        plan_item_id: requirement.plan_item_id,
        kind: requirement.kind,
        source: requirement.source,
        behavior: requirement.behavior,
        required_evidence_level: requirement.required_evidence_level,
        oracle_id: requirement.oracle_id,
        oracle: requirement.oracle,
      };
    }),
  };
}

function verifyExternalTruth(source: string, inputPath: string, errors: AuditIssue[]) {
  const parseErrors: AuditIssue[] = [];
  const contract = parseContract(source, parseErrors);
  if (parseErrors.length > 0) return;
  const baseline = isObject(contract.baseline) ? contract.baseline : {};
  const workspaceRoot = typeof baseline.workspace_root === "string" ? baseline.workspace_root : "";
  const repositoryRoot = typeof baseline.repository_root === "string" ? baseline.repository_root : "";
  let verifiedLock: JsonObject | null = null;
  let preChangeState: JsonObject | null = null;
  let verdictState: JsonObject | null = null;

  if (!workspaceRoot || !isAbsolute(workspaceRoot) || !existsSync(workspaceRoot) || !statSync(workspaceRoot).isDirectory()) {
    issue(errors, "WORKSPACE_ROOT_UNAVAILABLE", `baseline.workspace_root is not an available absolute directory: ${workspaceRoot}`);
  } else {
    const canonicalWorkspace = realpathSync(workspaceRoot);
    if (resolve(workspaceRoot) !== canonicalWorkspace) issue(errors, "WORKSPACE_ROOT_NOT_CANONICAL", `baseline.workspace_root must equal its realpath: ${canonicalWorkspace}`);
    verifyLedgerEntries(baseline.plan_sources, canonicalWorkspace, "baseline.plan_sources", errors);
    verifyLedgerEntries(baseline.supplemental_sources, canonicalWorkspace, "baseline.supplemental_sources", errors);
    verifyLedgerEntries(contract.evidence_receipts, canonicalWorkspace, "evidence_receipts", errors, "EVIDENCE_HASH_MISMATCH");

    verifiedLock = verifyJsonReference(canonicalWorkspace, contract.scope_lock, "scope_lock", "SCOPE_LOCK_HASH_MISMATCH", errors);
    if (verifiedLock) {
      if (isObject(contract.scope_lock) && verifiedLock.lock_id !== contract.scope_lock.lock_id) issue(errors, "SCOPE_LOCK_ID_MISMATCH", `scope_lock.lock_id differs from referenced lock`);
      const approval = isObject(verifiedLock.approval) ? verifiedLock.approval : {};
      const requiresApproval = contract.verdict === "ACCEPT" || contract.verdict === "REWORK";
      if (requiresApproval && (approval.status !== "APPROVED" || approval.actor_type !== "HUMAN")) issue(errors, "SCOPE_LOCK_NOT_HUMAN_APPROVED", `${String(contract.verdict)} requires APPROVED HUMAN scope lock approval`);
      if (!requiresApproval && !["APPROVED", "PENDING"].includes(String(approval.status))) issue(errors, "SCOPE_LOCK_APPROVAL_STATE_INVALID", `non-signing verdict permits scope lock approval status APPROVED or PENDING`);
      if (approval.status === "APPROVED" && (typeof approval.approved_by !== "string" || approval.approved_by.trim().length === 0 || typeof approval.evidence !== "string" || approval.evidence.trim().length === 0)) {
        issue(errors, "SCOPE_LOCK_APPROVAL_INCOMPLETE", `scope lock approval requires approved_by and evidence`);
      }
      if (JSON.stringify(scopeLockProjection(verifiedLock)) !== JSON.stringify(frozenProjection(contract))) {
        issue(errors, "SCOPE_LOCK_CONTRACT_MISMATCH", `audit plan/scope/requirement contract differs from approved scope lock`);
      }
      checkPlanRegistry(verifiedLock, contract, canonicalWorkspace, errors);
    }

    preChangeState = verifyJsonReference(canonicalWorkspace, baseline.pre_change_receipt, "baseline.pre_change_receipt", "PRE_CHANGE_RECEIPT_HASH_MISMATCH", errors);
    verdictState = verifyJsonReference(canonicalWorkspace, baseline.verdict_state_receipt, "baseline.verdict_state_receipt", "VERDICT_STATE_RECEIPT_HASH_MISMATCH", errors);

    if (Array.isArray(contract.evidence_receipts)) {
      for (const [index, item] of contract.evidence_receipts.entries()) {
        if (!isObject(item)) continue;
        const field = `evidence_receipts[${index}]`;
        const receipt = verifyJsonReference(canonicalWorkspace, item, field, "EVIDENCE_HASH_MISMATCH", errors);
        if (!receipt) continue;
        const expectedPayload: JsonObject = { ...item };
        delete expectedPayload.path;
        delete expectedPayload.sha256;
        const actualPayload: JsonObject = { ...receipt };
        const receiptAuditId = actualPayload.audit_id;
        const receiptGeneration = actualPayload.generation;
        delete actualPayload.schema_version;
        delete actualPayload.audit_id;
        delete actualPayload.generation;
        if (receiptAuditId !== contract.audit_id || receiptGeneration !== contract.generation) issue(errors, "EVIDENCE_RECEIPT_AUDIT_MISMATCH", `${field} belongs to a different audit generation`);
        if (JSON.stringify(actualPayload) !== JSON.stringify(expectedPayload)) issue(errors, "EVIDENCE_RECEIPT_PAYLOAD_MISMATCH", `${field} ledger differs from immutable receipt`);
        const cwd = typeof item.cwd === "string" ? item.cwd : "";
        if (!cwd || !isAbsolute(cwd) || !existsSync(cwd) || !statSync(cwd).isDirectory()) {
          issue(errors, "EVIDENCE_RECEIPT_CWD_UNAVAILABLE", `${field}.cwd is not an available absolute directory: ${cwd}`);
        } else {
          const realCwd = realpathSync(cwd);
          const candidateRoots = [canonicalWorkspace];
          if (repositoryRoot && existsSync(repositoryRoot) && statSync(repositoryRoot).isDirectory()) candidateRoots.push(realpathSync(repositoryRoot));
          const inApprovedRoot = candidateRoots.some((root) => {
            const relation = relative(root, realCwd);
            return relation === "" || (!relation.startsWith("..") && !isAbsolute(relation));
          });
          if (!inApprovedRoot) issue(errors, "EVIDENCE_RECEIPT_CWD_OUTSIDE_ROOTS", `${field}.cwd is outside workspace and repository roots`);
        }
        verifyLedgerEntries(item.artifacts, canonicalWorkspace, `${field}.artifacts`, errors, "EVIDENCE_ARTIFACT_HASH_MISMATCH");
      }
    }

    const generation = contract.generation;
    if (typeof generation === "number" && generation > 1 && isObject(contract.previous_audit)) {
      const previousPath = typeof contract.previous_audit.path === "string" ? contract.previous_audit.path : "";
      const previousFile = resolveLedgerFile(canonicalWorkspace, previousPath, "previous_audit.path", errors);
      if (previousFile) {
        const expectedHash = typeof contract.previous_audit.sha256 === "string" ? contract.previous_audit.sha256.toLowerCase() : "";
        if (expectedHash && hashFile(previousFile) !== expectedHash) issue(errors, "PREVIOUS_AUDIT_HASH_MISMATCH", previousPath);
        const previousSource = readFileSync(previousFile, "utf8");
        const previousResult = validateAuditSource(previousSource, previousPath);
        if (!previousResult.valid) issue(errors, "PREVIOUS_AUDIT_INVALID", `${previousPath}: ${previousResult.errors.length} structural error(s)`);
        const previousParseErrors: AuditIssue[] = [];
        const previousContract = parseContract(previousSource, previousParseErrors);
        const expectedId = typeof contract.previous_audit.audit_id === "string" ? contract.previous_audit.audit_id : "";
        if (previousContract.audit_id !== expectedId) issue(errors, "PREVIOUS_AUDIT_ID_MISMATCH", `${previousPath}: expected ${expectedId}`);
        if (previousContract.generation !== generation - 1) issue(errors, "PREVIOUS_GENERATION_MISMATCH", `${previousPath}: expected generation ${generation - 1}`);
        if (JSON.stringify(frozenProjection(previousContract)) !== JSON.stringify(frozenProjection(contract))) {
          issue(errors, "FROZEN_CONTRACT_DRIFT", `${inputPath}: frozen plan/scope/requirement contract differs from previous audit`);
        }
        const previousFindings = Array.isArray(previousContract.findings) ? previousContract.findings.filter(isObject) : [];
        const currentFindings = Array.isArray(contract.findings) ? contract.findings.filter(isObject) : [];
        const previousOpenBlockers = previousFindings.filter((finding) => finding.classification === "BLOCKING" && finding.status === "OPEN");
        for (const previousFinding of previousOpenBlockers) {
          const id = typeof previousFinding.id === "string" ? previousFinding.id : "";
          const currentFinding = currentFindings.find((finding) => finding.id === id);
          if (!currentFinding) {
            issue(errors, "PREVIOUS_BLOCKER_DROPPED", `${id}: every previous open blocker must remain OPEN, become CLOSED, or become BLOCKED`);
            continue;
          }
          const immutablePrevious = {
            requirement_ids: previousFinding.requirement_ids,
            allowed_files: previousFinding.allowed_files,
            forbidden_changes: previousFinding.forbidden_changes,
            closure_conditions: previousFinding.closure_conditions,
          };
          const immutableCurrent = {
            requirement_ids: currentFinding.requirement_ids,
            allowed_files: currentFinding.allowed_files,
            forbidden_changes: currentFinding.forbidden_changes,
            closure_conditions: currentFinding.closure_conditions,
          };
          if (JSON.stringify(immutablePrevious) !== JSON.stringify(immutableCurrent)) issue(errors, "PREVIOUS_BLOCKER_CONTRACT_DRIFT", `${id}: immutable finding contract changed across generations`);
        }
        const previousFindingIds = new Set(previousFindings.map((finding) => finding.id));
        const reopenIds = new Set(Array.isArray(contract.reopen_records) ? contract.reopen_records.filter(isObject).map((record) => record.finding_id) : []);
        for (const finding of currentFindings.filter((candidate) => candidate.classification === "BLOCKING" && !previousFindingIds.has(candidate.id))) {
          if (!reopenIds.has(finding.id)) issue(errors, "NEW_BLOCKER_WITHOUT_REOPEN", `${String(finding.id)}: a new blocking finding requires a reopen record`);
        }
      }
    }
  }

  if (!repositoryRoot || !isAbsolute(repositoryRoot) || !existsSync(repositoryRoot) || !statSync(repositoryRoot).isDirectory()) {
    issue(errors, "REPOSITORY_ROOT_UNAVAILABLE", `baseline.repository_root is not an available absolute directory: ${repositoryRoot}`);
    return;
  }
  const canonicalRepository = realpathSync(repositoryRoot);
  if (resolve(repositoryRoot) !== canonicalRepository) issue(errors, "REPOSITORY_ROOT_NOT_CANONICAL", `baseline.repository_root must equal its realpath: ${canonicalRepository}`);
  const topRun = Bun.spawnSync({ cmd: ["git", "-C", canonicalRepository, "rev-parse", "--show-toplevel"], stdout: "pipe", stderr: "pipe" });
  if (topRun.exitCode !== 0 || realpathSync(topRun.stdout.toString().trim()) !== canonicalRepository) {
    issue(errors, "GIT_ROOT_MISMATCH", topRun.stderr.toString().trim() || `git root differs from ${canonicalRepository}`);
  }
  const headRun = Bun.spawnSync({ cmd: ["git", "-C", canonicalRepository, "rev-parse", "HEAD"], stdout: "pipe", stderr: "pipe" });
  if (headRun.exitCode !== 0) {
    issue(errors, "GIT_HEAD_UNAVAILABLE", headRun.stderr.toString().trim() || canonicalRepository);
    return;
  }
  const actualHead = headRun.stdout.toString().trim();
  if (baseline.head_at_verdict !== actualHead || baseline.commit !== actualHead) {
    issue(errors, "GIT_HEAD_MISMATCH", `actual=${actualHead}, commit=${String(baseline.commit)}, head_at_verdict=${String(baseline.head_at_verdict)}`);
  }
  const implementationBase = typeof baseline.implementation_base_commit === "string" ? baseline.implementation_base_commit : "";
  const ancestry = Bun.spawnSync({ cmd: ["git", "-C", canonicalRepository, "merge-base", "--is-ancestor", implementationBase, actualHead], stdout: "pipe", stderr: "pipe" });
  if (ancestry.exitCode !== 0) issue(errors, "IMPLEMENTATION_BASE_NOT_ANCESTOR", `implementation_base_commit is not an ancestor of audited HEAD`);

  const actualStatus = gitStatusEntryMap(canonicalRepository, errors);
  const actualDirty = [...actualStatus.keys()].sort();
  const declaredDirty = Array.isArray(baseline.dirty_paths) ? baseline.dirty_paths.filter((value): value is string => typeof value === "string").sort() : [];
  if (!sameSet(actualDirty, declaredDirty)) issue(errors, "DIRTY_PATH_SET_MISMATCH", `declared=${JSON.stringify(declaredDirty)}, actual=${JSON.stringify(actualDirty)}`);
  const repositoryScope = verifiedLock && isObject(verifiedLock.repository_scope) ? verifiedLock.repository_scope : {};
  const allowed = Array.isArray(repositoryScope.allowed_paths) ? repositoryScope.allowed_paths.filter((value): value is string => typeof value === "string") : [];
  const forbidden = Array.isArray(repositoryScope.forbidden_paths) ? repositoryScope.forbidden_paths.filter((value): value is string => typeof value === "string") : [];

  const scopeLockSha256 = isObject(contract.scope_lock) && typeof contract.scope_lock.sha256 === "string" ? contract.scope_lock.sha256 : "";
  const scopeLockId = isObject(contract.scope_lock) && typeof contract.scope_lock.lock_id === "string" ? contract.scope_lock.lock_id : "";
  const preMap = stateEntryMap(preChangeState?.status_entries);
  const verdictMap = stateEntryMap(verdictState?.status_entries);
  const sweepCompletedAt = isObject(contract.sweep) && typeof contract.sweep.completed_at === "string" ? Date.parse(contract.sweep.completed_at) : Number.NaN;
  if (preChangeState) {
    if (preChangeState.repository_realpath !== canonicalRepository) issue(errors, "PRE_CHANGE_REPOSITORY_MISMATCH", `pre-change receipt repository differs from baseline`);
    if (preChangeState.head !== implementationBase) issue(errors, "PRE_CHANGE_HEAD_MISMATCH", `pre-change receipt head must equal implementation_base_commit`);
    if (preChangeState.phase_id !== scopeLockId) issue(errors, "PRE_CHANGE_PHASE_MISMATCH", `pre-change receipt phase_id must equal scope_lock.lock_id`);
    if (preChangeState.scope_lock_sha256 !== scopeLockSha256) issue(errors, "PRE_CHANGE_SCOPE_LOCK_MISMATCH", `pre-change receipt is not bound to scope lock`);
    const preAt = typeof preChangeState.captured_at === "string" ? Date.parse(preChangeState.captured_at) : Number.NaN;
    if (Number.isNaN(preAt) || Number.isNaN(sweepCompletedAt) || preAt > sweepCompletedAt) issue(errors, "PRE_CHANGE_TIME_INVALID", `pre-change receipt must precede sweep completion`);
  }
  if (verdictState) {
    if (verdictState.repository_realpath !== canonicalRepository) issue(errors, "VERDICT_STATE_REPOSITORY_MISMATCH", `verdict-state receipt repository differs from baseline`);
    if (verdictState.head !== actualHead) issue(errors, "VERDICT_STATE_HEAD_MISMATCH", `verdict-state receipt head must equal actual HEAD`);
    if (verdictState.phase_id !== scopeLockId) issue(errors, "VERDICT_STATE_PHASE_MISMATCH", `verdict-state receipt phase_id must equal scope_lock.lock_id`);
    if (verdictState.scope_lock_sha256 !== scopeLockSha256) issue(errors, "VERDICT_STATE_SCOPE_LOCK_MISMATCH", `verdict-state receipt is not bound to scope lock`);
    if (JSON.stringify([...verdictMap.entries()].sort()) !== JSON.stringify([...actualStatus.entries()].sort())) issue(errors, "VERDICT_STATE_MISMATCH", `current git status differs from verdict-state receipt`);
    const verdictAt = typeof verdictState.captured_at === "string" ? Date.parse(verdictState.captured_at) : Number.NaN;
    if (Number.isNaN(verdictAt) || Number.isNaN(sweepCompletedAt) || verdictAt < sweepCompletedAt) issue(errors, "VERDICT_STATE_TIME_INVALID", `verdict-state receipt must be captured after sweep completion`);
  }

  const deltaPaths = unique([...preMap.keys(), ...actualStatus.keys()]).filter((path) => preMap.get(path) !== actualStatus.get(path));
  for (const path of deltaPaths) {
    if (forbidden.includes(path)) {
      issue(errors, "DIRTY_FORBIDDEN_PATH", `${path} is forbidden by the approved scope lock`);
      continue;
    }
    if (allowed.includes(path)) continue;
    issue(errors, "DIRTY_PATH_OUTSIDE_SCOPE", `${path} changed after the pre-change receipt but is outside approved repository scope`);
  }
}

export function validateAuditFile(inputPath: string): AuditValidationResult {
  let source: string;
  try {
    source = readFileSync(inputPath, "utf8");
  } catch (error) {
    return {
      valid: false,
      schemaVersion: null,
      auditId: null,
      verdict: null,
      counts: { requirements: 0, findings: 0, openBlockers: 0, reopenRecords: 0 },
      errors: [{ code: "READ_FAILED", message: error instanceof Error ? error.message : String(error) }],
      warnings: [],
    };
  }
  const result = validateAuditSource(source, inputPath);
  verifyExternalTruth(source, inputPath, result.errors);
  result.valid = result.errors.length === 0;
  return result;
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("usage: bun run validate-audit.ts <audit-report.md>");
    process.exit(2);
  }
  const result = validateAuditFile(inputPath);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.valid ? 0 : 1);
}

if (import.meta.main) main();
