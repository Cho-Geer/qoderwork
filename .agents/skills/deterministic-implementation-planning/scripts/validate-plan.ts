#!/usr/bin/env bun

/** v3-only PLAN_SET admission. Schema interpretation is delegated to the shared parser. */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  compareSha256,
  guardRelativePath,
  parseAuditGovernanceV3Document,
  type GovernanceErrorCode,
} from "../../../../scripts/lib/audit-governance-schema-v3.ts";

type Finding = { code: string; message: string };
type Metadata = Record<string, string>;

const inputPath = process.argv[2];
const governanceRoot = process.argv[3];
const errors: Finding[] = [];

function finding(code: string, message: string) {
  errors.push({ code, message });
}

function metadata(source: string): Metadata {
  const result: Metadata = {};
  for (const match of source.matchAll(/^\*\*([^*]+)\*\*:\s*`?([^`\n]+)`?\s*$/gm)) result[match[1].trim()] = match[2].trim();
  return result;
}

function requireMetadata(values: Metadata, key: string): string | undefined {
  const value = values[key];
  if (!value) finding("ERR_APPROVAL_MISSING", `00-plan-index.md: ${key}`);
  return value;
}

function parseFile(path: string): unknown | undefined {
  try {
    return Bun.YAML.parse(readFileSync(path, "utf8"));
  } catch {
    finding("ERR_SCHEMA_DISCRIMINATOR", `cannot parse ${path}`);
    return undefined;
  }
}

function parseV3Document(input: unknown, label: string) {
  const parsed = parseAuditGovernanceV3Document(input);
  if (!parsed.ok) finding(parsed.error, `${label}: ${parsed.message}`);
  return parsed.ok ? parsed.value : undefined;
}

function resolveInput(root: string, candidate: string, label: string): string | undefined {
  const guarded = guardRelativePath(root, candidate);
  if (!guarded.ok) finding(guarded.error, `${label}: ${guarded.message}`);
  return guarded.ok ? guarded.value : undefined;
}

function validatePlanSet(root: string, authorityRoot: string) {
  const indexPath = join(root, "00-plan-index.md");
  const finalPath = join(root, "99-final-verification.md");
  if (!existsSync(indexPath)) finding("ERR_PLAN_SCHEMA_UNSUPPORTED", "00-plan-index.md is required");
  if (!existsSync(finalPath)) finding("ERR_PLAN_SCHEMA_UNSUPPORTED", "99-final-verification.md is required");
  if (!existsSync(indexPath) || !existsSync(finalPath)) return;

  const index = metadata(readFileSync(indexPath, "utf8"));
  if (index["Plan mode"] !== "PLAN_SET") finding("ERR_PLAN_SCHEMA_UNSUPPORTED", "00-plan-index.md: Plan mode must be PLAN_SET");
  const indexDocument = parseV3Document({ schema_version: index["Schema version"], document_kind: index["Document kind"] }, "00-plan-index.md");
  if (!indexDocument || indexDocument.schema_version !== "audit-plan-set/v3" || indexDocument.document_kind !== "plan-set-index") {
    finding("ERR_PLAN_SCHEMA_UNSUPPORTED", "00-plan-index.md must declare audit-plan-set/v3::plan-set-index");
    return;
  }

  const canonicalPathText = requireMetadata(index, "Canonical contract");
  const canonicalHash = requireMetadata(index, "Canonical contract SHA-256");
  const approvalPathText = requireMetadata(index, "Approval decision");
  const approvalHash = requireMetadata(index, "Approval decision SHA-256");
  if (!canonicalPathText || !canonicalHash || !approvalPathText || !approvalHash) return;

  const canonicalPath = resolveInput(authorityRoot, canonicalPathText, "Canonical contract");
  const approvalPath = resolveInput(authorityRoot, approvalPathText, "Approval decision");
  if (!canonicalPath || !approvalPath || !existsSync(canonicalPath) || !existsSync(approvalPath)) {
    if (canonicalPath && !existsSync(canonicalPath)) finding("ERR_APPROVAL_BINDING", `canonical contract not found: ${canonicalPathText}`);
    if (approvalPath && !existsSync(approvalPath)) finding("ERR_APPROVAL_MISSING", `approval decision not found: ${approvalPathText}`);
    return;
  }

  const canonicalSource = readFileSync(canonicalPath);
  const canonicalIdentity = compareSha256(canonicalHash, canonicalSource);
  if (!canonicalIdentity.ok) finding(canonicalIdentity.error, `Canonical contract: ${canonicalIdentity.message}`);
  const canonical = parseV3Document(parseFile(canonicalPath), canonicalPathText);
  if (!canonical || canonical.schema_version !== "audit-governance/v3" || canonical.document_kind !== "canonical-requirements") {
    finding("ERR_PLAN_SCHEMA_UNSUPPORTED", `Canonical contract must be audit-governance/v3::canonical-requirements`);
  }

  const approvalSource = readFileSync(approvalPath);
  const approvalIdentity = compareSha256(approvalHash, approvalSource);
  if (!approvalIdentity.ok) finding(approvalIdentity.error, `Approval decision: ${approvalIdentity.message}`);
  const approval = parseV3Document(parseFile(approvalPath), approvalPathText);
  if (!approval || approval.schema_version !== "audit-governance-approval/v3" || approval.document_kind !== "approval-decision") {
    finding("ERR_APPROVAL_MISSING", "Approval decision must be audit-governance-approval/v3::approval-decision");
    return;
  }
  if (approval.decision !== "APPROVED" || approval.approved_by !== "HUMAN_USER") {
    finding("ERR_APPROVAL_MISSING", "Approval decision must be HUMAN_USER APPROVED");
    return;
  }
  const artifacts = approval.approved_artifacts;
  if (!artifacts || typeof artifacts !== "object" || Array.isArray(artifacts)) {
    finding("ERR_APPROVAL_MISSING", "Approval decision has no approved_artifacts");
    return;
  }
  const artifactValues = Object.values(artifacts as Record<string, unknown>);
  const bindsCanonical = artifactValues.some((artifact) => {
    if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) return false;
    const value = artifact as Record<string, unknown>;
    return value.path === canonicalPathText && value.sha256 === canonicalHash;
  });
  if (!bindsCanonical || !canonicalIdentity.ok || !approvalIdentity.ok) finding("ERR_APPROVAL_BINDING", "approval does not bind the exact canonical path and hash");
}

try {
  if (!inputPath || !existsSync(inputPath) || !statSync(inputPath).isDirectory()) {
    finding("ERR_PLAN_SCHEMA_UNSUPPORTED", "input must be a v3 PLAN_SET directory");
  } else if (!governanceRoot || !existsSync(governanceRoot) || !statSync(governanceRoot).isDirectory()) {
    finding("ERR_PLAN_SCHEMA_UNSUPPORTED", "governanceRoot must be an existing qoderwork worktree directory (the plan-containing worktree, not work-one; see SKILL.md rule 12a)");
  } else {
    validatePlanSet(inputPath, governanceRoot);
  }
} catch (error) {
  finding("ERR_PLAN_SCHEMA_UNSUPPORTED", error instanceof Error ? error.message : String(error));
}

console.log(JSON.stringify({ ok: errors.length === 0, mode: "PLAN_SET", planPath: inputPath ?? null, errors }, null, 2));
process.exit(errors.length === 0 ? 0 : 1);
