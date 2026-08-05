#!/usr/bin/env bun
/**
 * project-audit-verdict.ts — Project audits/STATUS.md verdict to plan doc fields (dry-run by default).
 *
 * Single-purpose tool: identifies what would change in plan docs to reflect audits/STATUS.md verdict.
 * Does NOT auto-write. Emits JSON diff for main session approval.
 *
 * Audit-separation rule: this tool only READS (audits/<plan>/STATUS.md, plans/<plan>/*, receipts)
 * and reports the diff. It contains no writeFileSync and never mutates plan/audit files; the main
 * session owns any actual status write.
 *
 * Usage (run from repository root):
 *   bun run scripts/project-audit-verdict.ts --plan-dir plans/cross-platform-universality-m1
 *   bun run scripts/project-audit-verdict.ts --plan-dir plans/cross-platform-universality-m1 --apply
 *
 * Behavior:
 *   - Parses `| Verdict（PHASE-NN 实施） | **...** |` rows from audits/<plan-name>/STATUS.md.
 *   - Maps verdict text to a phase-progression/v1 target status:
 *       Accept(ed) -> ACCEPTED | Not Started -> NOT_STARTED | In progress -> IN_PROGRESS
 *       Blocked -> BLOCKED | Invalid -> INVALID | Partial* -> IN_PROGRESS
 *         (Partial = in-scope work done but acceptance incomplete, e.g. a gate FAIL whose
 *          residual was transferred to a later phase by plan mutation; not an ACCEPT.)
 *   - Reads plans/<plan-name>/00-plan-index.md §6 Phase manifest (current manifest status)
 *     and plans/<plan-name>/0?-phase-*.md (Progression status, completion gate, receipt line).
 *   - Checks audits/<plan-name>/receipts/phase-NN.json existence and SHA bindings:
 *       plan_index_sha256, phase_file_sha256, approval_decision_sha256 are bound to files;
 *       audit_report_sha256 is bound via receipt.audit_report_path (plan-dir-relative);
 *       validator_output_sha256 has no file binding (validator stdout snapshot) and is noted.
 *   - `--apply` still only computes the diff; write logic is intentionally not implemented
 *     (exit 1). Main session approval is required before any plan doc mutation.
 *
 * Output: JSON array (4-space indent, stable field order), one report per manifest phase:
 *   phase_id, phase_file, current_status, manifest_status, target_status, status_changed,
 *   verdict_raw, gate_header_ok, gate_header_validator_pattern, gate_boxes, gate_checked,
 *   receipt_exists, receipt_path, receipt_declared_in_phase_doc, sha_bindings_ok,
 *   sha_binding_errors, notes.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

export const PROGRESSION_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "ACCEPTED",
  "BLOCKED",
  "INVALID",
] as const;

export type ProgressionStatus = (typeof PROGRESSION_STATUSES)[number];

export interface PhaseReport {
  phase_id: string;
  phase_file: string;
  current_status: string;
  manifest_status: string;
  target_status: ProgressionStatus;
  status_changed: boolean;
  verdict_raw: string | null;
  gate_header_ok: boolean;
  gate_header_validator_pattern: boolean;
  gate_boxes: number;
  gate_checked: number;
  receipt_exists: boolean;
  receipt_path: string | null;
  receipt_declared_in_phase_doc: string | null;
  sha_bindings_ok: boolean;
  sha_binding_errors: string[];
  notes: string[];
}

interface ManifestRow {
  order: number;
  id: string;
  file: string;
  status: string | null;
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function sha256Text(source: string): string {
  return createHash("sha256").update(source, "utf8").digest("hex");
}

/** Normalize path separators for stable cross-platform JSON output. */
function displayPath(path: string): string {
  return path.replaceAll("\\", "/");
}

function isProgressionStatus(value: string | null | undefined): value is ProgressionStatus {
  return value !== null && value !== undefined && (PROGRESSION_STATUSES as readonly string[]).includes(value);
}

/** Same extraction rule as validate-phase-progression.ts (backtick-wrapped value up to first backtick/EOL). */
function parseProgressionField(source: string): string {
  return source.match(/^\*\*Progression status\*\*:\s*`?([^`\n]+)`?/m)?.[1].trim() ?? "";
}

/** Map a STATUS.md verdict string to a phase-progression/v1 target status. */
export function mapVerdictToStatus(raw: string): ProgressionStatus | null {
  const normalized = raw.trim().toLowerCase();
  if (/^accept(ed)?([\s(:（]|$)/.test(normalized)) return "ACCEPTED";
  if (/^not[\s_-]*started/.test(normalized)) return "NOT_STARTED";
  if (/^in[\s_-]*progress/.test(normalized)) return "IN_PROGRESS";
  if (/^blocked/.test(normalized)) return "BLOCKED";
  if (/^partial/.test(normalized)) return "IN_PROGRESS";
  if (/^invalid/.test(normalized)) return "INVALID";
  return null;
}

/** Parse `| Verdict（PHASE-NN 实施） | **...** |` rows from STATUS.md into a phase -> raw verdict map. */
export function parseStatusVerdicts(statusSource: string): Map<string, string> {
  const verdicts = new Map<string, string>();
  for (const line of statusSource.split(/\r?\n/)) {
    const label = line.match(/^\|\s*Verdict（\s*(PHASE-\d+)\s*实施\s*）\s*\|/);
    if (!label) continue;
    const cells = line.split("|").map((cell) => cell.trim());
    const valueCell = cells[2] ?? "";
    const bold = valueCell.match(/\*\*([^*]+)\*\*/)?.[1]?.trim();
    const verdict = (bold ?? valueCell).trim();
    if (verdict) verdicts.set(label[1], verdict);
  }
  return verdicts;
}

/** Parse the `## 6. Phase manifest` table (mirrors phase-progression.ts parseManifest, status column retained). */
export function parseManifest(source: string): ManifestRow[] {
  const lines = source.split(/\r?\n/);
  const heading = lines.findIndex((line) => line.trim() === "## 6. Phase manifest");
  if (heading < 0) return [];
  const rows: ManifestRow[] = [];
  for (const line of lines.slice(heading + 1)) {
    if (/^##\s/.test(line)) break;
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim().replaceAll("`", ""));
    if (!/^\d+$/.test(cells[0] ?? "")) continue;
    rows.push({
      order: Number(cells[0]),
      id: cells[1] ?? "",
      file: cells[2] ?? "",
      status: cells[4]?.trim() || null,
    });
  }
  return rows;
}

/** Completion gate section: boxes/checked counts plus heading-convention detection. */
function completionGate(source: string): { headerOk: boolean; validatorPattern: boolean; boxes: number; checked: number } {
  const validatorPattern = /^(?:####|##) Phase completion gate\s*$/m.test(source);
  const planConvention = /^#{2,4}\s*\d+\.\s*Completion gate\s*$/m.test(source);
  const headingMatch = source.match(/^(?:#{2,4})\s*(?:\d+\.\s*)?(?:Phase completion gate|Completion gate)[^\n]*\n/m);
  let section = "";
  if (headingMatch && headingMatch.index !== undefined) {
    const after = source.slice(headingMatch.index + headingMatch[0].length);
    section = after.split(/\r?\n(?=#{1,4}\s)/)[0] ?? "";
  }
  const boxes = section.match(/- \[([ xX])\]/g) ?? [];
  return {
    headerOk: validatorPattern || planConvention,
    validatorPattern,
    boxes: boxes.length,
    checked: boxes.filter((box) => /\[[xX]\]/.test(box)).length,
  };
}

/** Completion receipt line from a phase doc (raw value; `<receipt-path>` etc. reported verbatim). */
function declaredReceipt(source: string): string | null {
  const value = source.match(/^\*\*Completion receipt\*\*:\s*(.+)$/m)?.[1].trim() ?? "";
  if (!value || value === "NONE" || value === "N/A") return null;
  return value.replaceAll("`", "");
}

/** Verify receipt SHA bindings against on-disk files. Null placeholders are notes, mismatches are errors. */
function checkReceiptBindings(
  receiptPath: string,
  planDir: string,
  indexSource: string | null,
  phaseSource: string | null,
  phaseId: string,
  errors: string[],
  notes: string[],
): boolean {
  const receiptSource = readText(receiptPath);
  if (receiptSource === null) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(receiptSource);
  } catch {
    errors.push(`receipt is not valid JSON: ${displayPath(receiptPath)}`);
    return false;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    errors.push("receipt is not a JSON object");
    return false;
  }
  const receipt = parsed as Record<string, unknown>;
  if (receipt.schema_version !== "audit-phase-progression/v3" || receipt.document_kind !== "phase-progression-receipt") {
    notes.push(`receipt discriminators absent/unexpected (schema_version=${String(receipt.schema_version)}, document_kind=${String(receipt.document_kind)})`);
  }
  if (typeof receipt.phase_id === "string" && receipt.phase_id !== phaseId) {
    errors.push(`receipt phase_id=${receipt.phase_id} does not match manifest ${phaseId}`);
  }
  const fileBindings: Array<[field: string, source: string | null, label: string]> = [
    ["plan_index_sha256", indexSource, join(planDir, "00-plan-index.md")],
    ["phase_file_sha256", phaseSource, join(planDir, "<phase file>")],
    ["approval_decision_sha256", readText(join(planDir, "approval-decision.json")), join(planDir, "approval-decision.json")],
  ];
  const auditReportPath = typeof receipt.audit_report_path === "string" && receipt.audit_report_path
    ? receipt.audit_report_path
    : null;
  if (auditReportPath !== null) {
    // Receipt paths are plan-dir-relative (validate-phase-progression.ts resolves against planDir).
    fileBindings.push(["audit_report_sha256", readText(resolve(planDir, auditReportPath)), resolve(planDir, auditReportPath)]);
  } else {
    notes.push("audit_report_sha256 has no audit_report_path binding (placeholder null)");
  }
  for (const [field, source, label] of fileBindings) {
    const value = receipt[field];
    if (value === null) {
      notes.push(`${field} is null (template placeholder; fail-closed until source exists)`);
      continue;
    }
    if (typeof value !== "string") {
      notes.push(`${field} missing (template placeholder)`);
      continue;
    }
    if (!/^[a-f0-9]{64}$/.test(value)) {
      errors.push(`${field} is not a sha256 hex string`);
      continue;
    }
    if (source === null) {
      errors.push(`${field} bound to unreadable file: ${label}`);
      continue;
    }
    const actual = sha256Text(source);
    if (actual !== value) errors.push(`${field} mismatch: receipt=${value} actual=${actual} (${label})`);
  }
  const validatorHash = receipt.validator_output_sha256;
  if (validatorHash === null) notes.push("validator_output_sha256 is null (template placeholder)");
  else if (typeof validatorHash === "string") notes.push("validator_output_sha256 has no file binding (validator stdout snapshot; verify by re-running validate-phase-progression.ts)");
  else notes.push("validator_output_sha256 missing");
  return true;
}

/**
 * Compute the per-phase diff between plan docs (current) and audits/<plan>/STATUS.md verdicts (target).
 * Read-only: never writes any file.
 */
export function projectVerdict(planDir: string): PhaseReport[] {
  const planName = basename(resolve(planDir));
  const auditDir = join("audits", planName);
  const notesPrefix: string[] = [];

  const statusSource = readText(join(auditDir, "STATUS.md"));
  const verdicts = statusSource === null ? new Map<string, string>() : parseStatusVerdicts(statusSource);
  if (statusSource === null) notesPrefix.push(`STATUS.md not found at ${join(auditDir, "STATUS.md")}; all verdicts null`);

  const indexPath = join(planDir, "00-plan-index.md");
  const indexSource = readText(indexPath);
  const manifest = indexSource === null ? [] : parseManifest(indexSource);
  if (indexSource === null) notesPrefix.push(`plan index not found: ${indexPath}`);
  else if (manifest.length === 0) notesPrefix.push("no rows parsed from 00-plan-index.md §6 Phase manifest");

  return manifest.map((row) => {
    const notes: string[] = [...notesPrefix];
    const shaBindingErrors: string[] = [];

    const phaseAbs = join(planDir, row.file);
    const phaseSource = readText(phaseAbs);
    if (phaseSource === null) notes.push(`phase file missing: ${phaseAbs}`);

    const currentRaw = phaseSource === null ? "" : parseProgressionField(phaseSource);
    const currentParsed = isProgressionStatus(currentRaw) ? currentRaw : null;
    if (phaseSource !== null && currentParsed === null) notes.push(`phase Progression status unparseable: "${currentRaw}"`);

    const manifestParsed = isProgressionStatus(row.status) ? row.status : null;
    if (row.status !== null && manifestParsed === null) notes.push(`manifest Status unparseable: "${row.status}"`);
    if (currentParsed !== null && manifestParsed !== null && currentParsed !== manifestParsed) {
      notes.push(`manifest/phase status mismatch: manifest=${manifestParsed}, phase=${currentParsed}`);
    }

    const verdictRaw = verdicts.get(row.id) ?? null;
    let target: ProgressionStatus;
    if (verdictRaw === null) {
      target = currentParsed ?? "INVALID";
      notes.push("no Verdict row in STATUS.md; target falls back to current status");
    } else {
      const mapped = mapVerdictToStatus(verdictRaw);
      if (mapped === null) {
        target = currentParsed ?? "INVALID";
        notes.push(`verdict "${verdictRaw}" has no status mapping; target falls back to current status`);
      } else {
        target = mapped;
        if (/^partial/i.test(verdictRaw.trim())) {
          notes.push("partial verdict mapped to IN_PROGRESS (work done; acceptance incomplete — not an ACCEPT)");
        }
      }
    }

    const gate = phaseSource === null
      ? { headerOk: false, validatorPattern: false, boxes: 0, checked: 0 }
      : completionGate(phaseSource);
    if (!gate.headerOk && phaseSource !== null) notes.push("no completion gate heading found (neither validator pattern nor '## N. Completion gate')");
    if (gate.headerOk && !gate.validatorPattern) {
      notes.push("gate heading uses plan convention ('N. Completion gate'); validate-phase-progression.ts expects 'Phase completion gate'");
    }
    if (target === "ACCEPTED") {
      if (gate.boxes === 0 || gate.checked !== gate.boxes) {
        notes.push(`target ACCEPTED but completion gate not fully checked (${gate.checked}/${gate.boxes})`);
      }
    } else if (gate.checked > 0) {
      notes.push(`target ${target} but completion gate has ${gate.checked} checked box(es)`);
    }

    const orderTag = String(row.order).padStart(2, "0");
    const receiptPath = join(auditDir, "receipts", `phase-${orderTag}.json`);
    const receiptExists = existsSync(receiptPath);
    const receiptDeclared = phaseSource === null ? null : declaredReceipt(phaseSource);
    const declaredIsPlaceholder = receiptDeclared !== null && /^<[^>]*>/.test(receiptDeclared);
    if (declaredIsPlaceholder) {
      notes.push(`phase doc Completion receipt is still a placeholder: ${receiptDeclared}`);
    }
    if (target === "ACCEPTED") {
      if (!receiptExists) notes.push(`target ACCEPTED but receipt missing: ${displayPath(receiptPath)}`);
      if (receiptDeclared === null || declaredIsPlaceholder) {
        notes.push("target ACCEPTED requires phase doc Completion receipt to point at the receipt file");
      }
    }

    let shaBindingsOk = false;
    if (receiptExists) {
      shaBindingsOk = checkReceiptBindings(receiptPath, planDir, indexSource, phaseSource, row.id, shaBindingErrors, notes)
        && shaBindingErrors.length === 0;
    } else {
      notes.push(`receipt not found: ${displayPath(receiptPath)}`);
    }

    return {
      phase_id: row.id,
      phase_file: row.file,
      current_status: currentRaw,
      manifest_status: row.status ?? "",
      target_status: target,
      status_changed: currentParsed !== target,
      verdict_raw: verdictRaw,
      gate_header_ok: gate.headerOk,
      gate_header_validator_pattern: gate.validatorPattern,
      gate_boxes: gate.boxes,
      gate_checked: gate.checked,
      receipt_exists: receiptExists,
      receipt_path: displayPath(receiptPath),
      receipt_declared_in_phase_doc: receiptDeclared,
      sha_bindings_ok: shaBindingsOk,
      sha_binding_errors: shaBindingErrors,
      notes,
    };
  });
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.error("usage: bun run scripts/project-audit-verdict.ts [--plan-dir <path>] [--apply]");
    console.error("  --plan-dir  plan directory (default: plans/cross-platform-universality-m1)");
    console.error("  --apply     compute diff only; write logic intentionally not implemented");
    process.exit(2);
  }
  let planDir = "plans/cross-platform-universality-m1";
  const flagEq = argv.find((a) => a.startsWith("--plan-dir="))?.split("=")[1];
  const flagIdx = argv.indexOf("--plan-dir");
  if (flagEq !== undefined) planDir = flagEq;
  else if (flagIdx >= 0 && argv[flagIdx + 1] !== undefined) planDir = argv[flagIdx + 1];
  const apply = argv.includes("--apply");

  if (!existsSync(planDir)) {
    console.error(`plan directory not found: ${planDir} (run from repository root)`);
    process.exit(2);
  }

  const reports = projectVerdict(planDir);
  console.log(JSON.stringify(reports, null, 4));
  if (apply) {
    console.error("--apply mode: write logic intentionally not implemented (main session approval required)");
    process.exit(1);
  }
}
