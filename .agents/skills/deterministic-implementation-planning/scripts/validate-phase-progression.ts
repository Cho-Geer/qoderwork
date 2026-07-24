#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  deriveTopLevelStatus,
  isProgressionSchema,
  isProgressionStatus,
  parseManifest,
  parseProgressionStatus,
  sha256Text,
  validateManifestRows,
  validateReceiptContract,
  type ManifestRow,
  type ProgressionStatus,
} from "./phase-progression.ts";

type Finding = { code: string; message: string };

const planDir = process.argv[2];
const targetPhaseId = process.argv[3];
if (!planDir || !targetPhaseId) {
  console.error("usage: bun run validate-phase-progression.ts <plan-dir> <next-phase-id>");
  process.exit(2);
}

const errors: Finding[] = [];
function fail(code: string, message: string): void {
  errors.push({ code, message });
}
function read(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}
function declaredStatus(source: string): string {
  return source.match(/^\*\*Status\*\*:\s*`?([^`\n]+)`?/m)?.[1].trim() ?? "";
}
function phaseStatus(source: string): ProgressionStatus | null {
  return parseProgressionStatus(source.match(/^\*\*Progression status\*\*:\s*`?([^`\n]+)`?/m)?.[1].trim());
}
function phaseDependencies(source: string): string[] {
  const value = source.match(/^\*\*Depends on\*\*:\s*(.+)$/m)?.[1].replaceAll("`", "").trim() ?? "NONE";
  return value.split(",").map((item) => item.trim()).filter((item) => item && item !== "NONE");
}
function completionGate(source: string): { boxes: number; checked: number } {
  const section = source.match(/^(?:####|##) Phase completion gate\s*\n([\s\S]*?)(?=^#{1,4}\s|$)/m)?.[1] ?? "";
  const boxes = section.match(/- \[([ xX])\]/g) ?? [];
  return { boxes: boxes.length, checked: boxes.filter((box) => /\[[xX]\]/.test(box)).length };
}
function receiptPath(source: string): string | null {
  const value = source.match(/^\*\*Completion receipt\*\*:\s*(.+)$/m)?.[1].trim() ?? "";
  if (!value || value === "NONE" || value === "N/A") return null;
  return value.replaceAll("`", "");
}
function parseReceipt(path: string, indexSource: string, phaseSource: string, phaseId: string): void {
  const receiptSource = read(path);
  if (receiptSource === null) {
    fail("PHASE_RECEIPT_MISSING", `${phaseId}: ${path}`);
    return;
  }
  let value: unknown;
  try {
    value = JSON.parse(receiptSource);
  } catch {
    fail("PHASE_RECEIPT_INVALID", `${phaseId}: invalid JSON ${path}`);
    return;
  }
  const receipt = value as Record<string, unknown>;
  const diagnostics = validateReceiptContract(value, {
    phase_id: phaseId,
    plan_index_sha256: sha256Text(indexSource),
    phase_file_sha256: sha256Text(phaseSource),
  });
  for (const diagnostic of diagnostics) fail(diagnostic.code, `${phaseId}: ${diagnostic.message}`);
  if (typeof receipt.audit_report_path !== "string" || !receipt.audit_report_path) {
    fail("PHASE_AUDIT_ACCEPT_MISSING", `${phaseId}: receipt.audit_report_path`);
  } else {
    // Receipt paths are plan-dir-relative; never resolve them from the caller cwd.
    const auditPath = resolve(planDir, receipt.audit_report_path);
    const auditSource = read(auditPath);
    if (auditSource === null) fail("PHASE_AUDIT_ACCEPT_MISSING", `${phaseId}: ${auditPath}`);
    else {
      if (receipt.audit_verdict !== "ACCEPT" || receipt.audit_exit_code !== 0) {
        fail("PHASE_AUDIT_ACCEPT_MISSING", `${phaseId}: audit verdict/exit is not ACCEPT/0`);
      }
      if (receipt.audit_report_sha256 !== sha256Text(auditSource)) {
        fail("PHASE_RECEIPT_HASH_MISMATCH", `${phaseId}: audit_report_sha256`);
      }
    }
  }
}
function checkPhase(row: ManifestRow, indexSource: string, phaseSource: string, requireAccepted: boolean): void {
  const status = parseProgressionStatus(row.status);
  if (!status || !isProgressionStatus(row.status)) {
    fail("PHASE_STATUS_INVALID", `${row.id}: manifest Status=${row.status ?? "<missing>"}`);
    return;
  }
  const fileStatus = phaseStatus(phaseSource);
  if (!fileStatus) fail("PHASE_STATUS_MISSING", `${row.id}: phase Progression status`);
  else if (fileStatus !== status) fail("PHASE_STATUS_MISMATCH", `${row.id}: manifest=${status}, phase=${fileStatus}`);
  const gate = completionGate(phaseSource);
  if (status === "ACCEPTED") {
    if (gate.boxes === 0 || gate.checked !== gate.boxes) fail("PHASE_COMPLETION_GATE_MISMATCH", `${row.id}: ACCEPTED gate is not fully checked`);
    const path = receiptPath(phaseSource);
    if (!path) fail("PHASE_RECEIPT_MISSING", `${row.id}: Completion receipt`);
    else parseReceipt(resolve(planDir, path), indexSource, phaseSource, row.id);
  } else if (gate.checked > 0) {
    fail("PHASE_COMPLETION_GATE_MISMATCH", `${row.id}: ${status} cannot have checked completion gate`);
  }
  if (requireAccepted && status !== "ACCEPTED") fail("PROGRESSION_DEPENDENCY_NOT_ACCEPTED", `${row.id}: status=${status}`);
}

const indexPath = join(planDir, "00-plan-index.md");
const indexSource = read(indexPath);
if (indexSource === null) {
  fail("MISSING_PLAN_INDEX", indexPath);
} else if (!isProgressionSchema(indexSource)) {
  fail("PROGRESSION_SCHEMA_REQUIRED", "index must declare progression_schema phase-progression/v1");
} else {
  const parsed = parseManifest(indexSource);
  if (parsed.rows.length === 0) fail("EMPTY_PHASE_MANIFEST", "00-plan-index.md has no phase rows");
  for (const diagnostic of [...parsed.diagnostics, ...validateManifestRows(parsed.rows)]) fail(diagnostic.code, diagnostic.message);
  const byId = new Map(parsed.rows.map((row) => [row.id, row]));
  const declared = declaredStatus(indexSource);
  const derived = deriveTopLevelStatus(parsed.rows.map((row) => parseProgressionStatus(row.status)));
  if (declared !== derived) fail("TOP_LEVEL_STATUS_MISMATCH", `declared=${declared}, derived=${derived}`);
  const target = byId.get(targetPhaseId);
  if (!target) fail("UNKNOWN_TARGET_PHASE", targetPhaseId);
  else {
    const targetPath = join(planDir, target.file);
    const targetSource = read(targetPath);
    if (targetSource === null) fail("MISSING_PHASE_FILE", target.file);
    else {
      const targetDeps = phaseDependencies(targetSource);
      if (targetDeps.join(",") !== target.dependencies.join(",")) fail("PHASE_STARTING_STATE_MISMATCH", `${target.id}: file=${targetDeps.join(",") || "NONE"}, manifest=${target.dependencies.join(",") || "NONE"}`);
      const targetStatus = parseProgressionStatus(target.status);
      if (targetStatus !== "NOT_STARTED") fail("NEXT_PHASE_STATE_INVALID", `${target.id}: expected NOT_STARTED, got ${target.status ?? "<missing>"}`);
      checkPhase(target, indexSource, targetSource, false);
    }
    const visited = new Set<string>();
    const visit = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);
      const row = byId.get(id);
      if (!row) return;
      for (const dependency of row.dependencies) visit(dependency);
      const source = read(join(planDir, row.file));
      if (source === null) fail("MISSING_PHASE_FILE", row.file);
      else checkPhase(row, indexSource, source, id !== targetPhaseId);
    };
    for (const dependency of target.dependencies) visit(dependency);
  }
}

const result = { ok: errors.length === 0, planPath: planDir, phaseId: targetPhaseId, errors };
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
