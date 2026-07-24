import { createHash } from "node:crypto";

/** Machine-readable progression states. `DONE` is intentionally not accepted. */
export const PROGRESSION_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "ACCEPTED",
  "BLOCKED",
  "INVALID",
] as const;

export type ProgressionStatus = (typeof PROGRESSION_STATUSES)[number];

export const TOP_LEVEL_STATUSES = [
  "COMPLETE",
  "IN-PROGRESS",
  "BLOCKED",
  "READY-FOR-IMPLEMENTATION",
] as const;

export type TopLevelStatus = (typeof TOP_LEVEL_STATUSES)[number];

export const PROGRESSION_SCHEMA = "phase-progression/v1" as const;
export const LEGACY_PROGRESSION_SCHEMA = "legacy" as const;

export type ProgressionDiagnostic = { code: string; message: string };

export interface ManifestRow {
  order: number;
  id: string;
  file: string;
  dependencies: string[];
  status: string | null;
}

export interface ManifestParseResult {
  rows: ManifestRow[];
  diagnostics: ProgressionDiagnostic[];
}

export interface ProgressionReceipt {
  schema_version: string;
  plan_index_sha256: string;
  phase_file_sha256: string;
  audit_report_sha256: string;
  validator_output_sha256: string;
  phase_id: string;
  previous_status: ProgressionStatus;
  new_status: ProgressionStatus;
  [key: string]: unknown;
}

const HASH_PATTERN = /^[a-f0-9]{64}$/;

export function isProgressionSchema(source: string): boolean {
  return /(?:progression_schema|Progression schema)\*{0,2}\s*[:：]\s*(?:`phase-progression\/v1`|phase-progression\/v1)/i.test(source);
}

export function isLegacyProgressionSchema(source: string): boolean {
  return /(?:progression_schema|Progression schema)\*{0,2}\s*[:：]\s*[`']?legacy[`']?/i.test(source);
}

export function isProgressionStatus(value: string | null | undefined): value is ProgressionStatus {
  return value !== null && value !== undefined && (PROGRESSION_STATUSES as readonly string[]).includes(value);
}

export function parseProgressionStatus(value: string | null | undefined): ProgressionStatus | null {
  if (!value) return null;
  const normalized = value.trim().replaceAll("`", "");
  return isProgressionStatus(normalized) ? normalized : null;
}

/** Parse the phase manifest without discarding its Status column. */
export function parseManifest(source: string): ManifestParseResult {
  const heading = source.split(/\r?\n/).findIndex((line) => line.trim() === "## 6. Phase manifest");
  if (heading < 0) return { rows: [], diagnostics: [] };

  const rows: ManifestRow[] = [];
  const diagnostics: ProgressionDiagnostic[] = [];
  const lines = source.split(/\r?\n/);
  for (const line of lines.slice(heading + 1)) {
    if (/^##\s/.test(line)) break;
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim().replaceAll("`", ""));
    if (!/^\d+$/.test(cells[0] ?? "")) continue;
    const status = cells[4]?.trim() || null;
    rows.push({
      order: Number(cells[0]),
      id: cells[1] ?? "",
      file: cells[2] ?? "",
      dependencies: (cells[3] ?? "").split(",").map((item) => item.trim()).filter((item) => item && item !== "NONE"),
      status,
    });
    if (status === null) diagnostics.push({ code: "PHASE_STATUS_MISSING", message: `${cells[1] ?? "<unknown>"}: manifest Status is missing` });
    else if (!isProgressionStatus(status)) diagnostics.push({ code: "PHASE_STATUS_INVALID", message: `${cells[1] ?? "<unknown>"}: manifest Status=${status}` });
  }
  return { rows, diagnostics };
}

export function validateManifestRows(rows: readonly ManifestRow[]): ProgressionDiagnostic[] {
  const diagnostics: ProgressionDiagnostic[] = [];
  const ids = new Set<string>();
  const files = new Set<string>();
  rows.forEach((row, index) => {
    if (row.order !== index + 1) diagnostics.push({ code: "PHASE_ORDER_INVALID", message: `${row.id}: order=${row.order}, expected=${index + 1}` });
    if (ids.has(row.id)) diagnostics.push({ code: "DUPLICATE_PHASE_ID", message: row.id });
    if (files.has(row.file)) diagnostics.push({ code: "DUPLICATE_PHASE_FILE", message: row.file });
    ids.add(row.id);
    files.add(row.file);
    for (const dependency of row.dependencies) {
      const dependencyIndex = rows.findIndex((candidate) => candidate.id === dependency);
      if (dependencyIndex < 0) diagnostics.push({ code: "UNKNOWN_PHASE_DEPENDENCY", message: `${row.id}: ${dependency}` });
      else if (dependencyIndex >= index) diagnostics.push({ code: "PHASE_DEPENDENCY_ORDER", message: `${row.id}: ${dependency}` });
    }
  });
  return diagnostics;
}

/** Derive the human-readable index status from ordered manifest states. */
export function deriveTopLevelStatus(statuses: readonly (ProgressionStatus | string | null)[]): TopLevelStatus {
  if (statuses.length > 0 && statuses.every((status) => status === "ACCEPTED")) return "COMPLETE";
  if (statuses.some((status) => status === "IN_PROGRESS")) return "IN-PROGRESS";
  const firstUnaccepted = statuses.find((status) => status !== "ACCEPTED");
  if (firstUnaccepted === "BLOCKED" || firstUnaccepted === "INVALID") return "BLOCKED";
  return "READY-FOR-IMPLEMENTATION";
}

export function sha256Text(source: string): string {
  return createHash("sha256").update(source, "utf8").digest("hex");
}

export function validateReceiptContract(
  receipt: unknown,
  expected: Partial<Pick<ProgressionReceipt, "phase_id" | "previous_status" | "new_status">> & {
    plan_index_sha256?: string;
    phase_file_sha256?: string;
    audit_report_sha256?: string;
    validator_output_sha256?: string;
  } = {},
): ProgressionDiagnostic[] {
  const diagnostics: ProgressionDiagnostic[] = [];
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return [{ code: "PHASE_RECEIPT_INVALID", message: "receipt must be a JSON object" }];
  }
  const value = receipt as Record<string, unknown>;
  const requiredHashes = ["plan_index_sha256", "phase_file_sha256", "audit_report_sha256", "validator_output_sha256"] as const;
  for (const field of requiredHashes) {
    if (typeof value[field] !== "string") diagnostics.push({ code: "PHASE_RECEIPT_MISSING", message: field });
    else if (!HASH_PATTERN.test(value[field] as string)) diagnostics.push({ code: "PHASE_RECEIPT_HASH_INVALID", message: field });
    else if (expected[field] && value[field] !== expected[field]) diagnostics.push({ code: "PHASE_RECEIPT_HASH_MISMATCH", message: field });
  }
  if (value.schema_version !== PROGRESSION_SCHEMA) diagnostics.push({ code: "PHASE_RECEIPT_SCHEMA_INVALID", message: `schema_version=${String(value.schema_version)}` });
  if (typeof value.phase_id !== "string" || !value.phase_id) diagnostics.push({ code: "PHASE_RECEIPT_MISSING", message: "phase_id" });
  else if (expected.phase_id && value.phase_id !== expected.phase_id) diagnostics.push({ code: "PHASE_RECEIPT_PHASE_MISMATCH", message: `phase_id=${value.phase_id}` });
  for (const field of ["previous_status", "new_status"] as const) {
    if (!isProgressionStatus(value[field] as string)) diagnostics.push({ code: "PHASE_RECEIPT_STATUS_INVALID", message: `${field}=${String(value[field])}` });
    else if (expected[field] && value[field] !== expected[field]) diagnostics.push({ code: "PHASE_RECEIPT_STATUS_MISMATCH", message: field });
  }
  return diagnostics;
}
