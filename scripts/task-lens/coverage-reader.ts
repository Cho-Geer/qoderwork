// scripts/task-lens/coverage-reader.ts
// PHASE-04: Strict lcov parser with companion binding.
// Reads lcov coverage data and maps observations onto FunctionNodes.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { FunctionNode, Observation } from "./types.ts";

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/** Companion binding that proves the lcov file is aligned with the diff. */
export interface CoverageBinding {
  /** Producer tool name (e.g. "bun test --coverage"), or null if unknown. */
  readonly producer: string | null;
  /** SHA-256 of the raw lcov file. */
  readonly fileSha256: string;
  /** mtime of the lcov file in milliseconds. */
  readonly mtimeMs: number;
  /** HEAD commit SHA the coverage was collected against. */
  readonly targetHeadSha: string;
  /** Diff hash from the DiffModel.diffHash. */
  readonly diffHash: string;
  /** Proof state: ALIGNED if companion matches, UNVERIFIED otherwise. */
  readonly proofState: "ALIGNED" | "UNVERIFIED";
}

/** Result of coverage reading — maps FunctionNode identifiers to observations. */
export interface CoverageResult {
  /** Observations keyed by normalized function identifier. */
  readonly observations: Map<string, Observation>;
  /** Reasons for unknown / unverified observations. */
  readonly unverified: readonly string[];
  /** Check codes that fired during parsing. */
  readonly checks: readonly string[];
  /** Overall alignment status. */
  readonly alignment: "ALIGNED" | "UNVERIFIED" | "UNBOUND";
}

// ---------------------------------------------------------------------------
// Companion file schema
// ---------------------------------------------------------------------------

const COMPANION_SCHEMA = "task-lens.coverage/v1" as const;

interface CompanionPayload {
  schemaVersion: string;
  producer: string | null;
  targetHeadSha: string | null;
  diffHash: string | null;
  lcovSha256: string | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Normalize file path for comparison: resolve, strip trailing slashes. */
function normalizeFilePath(p: string, baseDir: string): string {
  if (path.isAbsolute(p)) return path.normalize(p);
  return path.normalize(path.join(baseDir, p));
}

/**
 * Check whether a resolved path stays within the project boundary.
 * Simple check: the resolved path must start with the project root.
 */
function isWithinProject(resolved: string, projectRoot: string): boolean {
  const norm = path.normalize(projectRoot);
  return resolved === norm || resolved.startsWith(norm + path.sep);
}

/**
 * Normalize a function identifier for observation key.
 * Uses "file:name:startLine:endLine" as the key format.
 */
function nodeKey(node: FunctionNode): string {
  return `${node.file}:${node.name}:${node.startLine}:${node.endLine}`;
}

// ---------------------------------------------------------------------------
// Companion binding validation
// ---------------------------------------------------------------------------

async function readCompanion(
  companionPath: string,
  binding: CoverageBinding,
): Promise<{ aligned: boolean; reason?: string }> {
  let raw: string;
  try {
    raw = await Bun.file(companionPath).text();
  } catch {
    return { aligned: false, reason: "COVERAGE_COMPANION_MISSING" };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { aligned: false, reason: "COVERAGE_COMPANION_CORRUPT" };
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return { aligned: false, reason: "COVERAGE_COMPANION_CORRUPT" };
  }

  const obj = payload as Record<string, unknown>;

  if (obj.schemaVersion !== COMPANION_SCHEMA) {
    return { aligned: false, reason: "COVERAGE_COMPANION_SCHEMA_MISMATCH" };
  }

  // All four fields must match (null is acceptable for producer/targetHeadSha/diffHash/lcovSha256)
  const cProducer = typeof obj.producer === "string" ? obj.producer : null;
  const cTargetHeadSha =
    typeof obj.targetHeadSha === "string" ? obj.targetHeadSha : null;
  const cDiffHash =
    typeof obj.diffHash === "string" ? obj.diffHash : null;
  const cLcovSha256 =
    typeof obj.lcovSha256 === "string" ? obj.lcovSha256 : null;

  // Compare with binding
  if (cProducer !== binding.producer) {
    return { aligned: false, reason: "COVERAGE_COMPANION_PRODUCER_MISMATCH" };
  }
  if (cTargetHeadSha !== binding.targetHeadSha) {
    return { aligned: false, reason: "COVERAGE_COMPANION_HEAD_MISMATCH" };
  }
  if (cDiffHash !== binding.diffHash) {
    return { aligned: false, reason: "COVERAGE_COMPANION_DIFF_MISMATCH" };
  }
  if (cLcovSha256 !== binding.fileSha256) {
    return { aligned: false, reason: "COVERAGE_COMPANION_HASH_MISMATCH" };
  }

  return { aligned: true };
}

// ---------------------------------------------------------------------------
// LCOV record parser
// ---------------------------------------------------------------------------

interface LcovSfRecord {
  sf: string; // source file path (as written in lcov)
  fnLines: Map<number, string>; // line -> function name
  fnda: Map<string, number>; // function name -> execution count
  da: Map<number, number>; // line -> execution count
}

/**
 * Parse a single lcov text into structured records.
 * Records are delimited by SF/end_of_record.
 */
function parseLcov(text: string): LcovSfRecord[] {
  const records: LcovSfRecord[] = [];
  let current: LcovSfRecord | null = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();

    if (line === "end_of_record") {
      if (current) {
        records.push(current);
        current = null;
      }
      continue;
    }

    // Empty lines are skipped
    if (line.length === 0) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue; // malformed line

    const tag = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);

    if (tag === "SF") {
      // Start a new source file record (save previous if any)
      if (current) records.push(current);
      current = { sf: value, fnLines: new Map(), fnda: new Map(), da: new Map() };
      continue;
    }

    if (!current) continue; // no SF record yet

    if (tag === "FN") {
      // FN:<line>,<function name>
      const commaIdx = value.indexOf(",");
      if (commaIdx === -1) continue;
      const lineNum = parseInt(value.slice(0, commaIdx), 10);
      const fnName = value.slice(commaIdx + 1);
      if (!isNaN(lineNum) && fnName.length > 0) {
        current.fnLines.set(lineNum, fnName);
      }
    } else if (tag === "FNDA") {
      // FNDA:<count>,<function name>
      const commaIdx = value.indexOf(",");
      if (commaIdx === -1) continue;
      const count = parseInt(value.slice(0, commaIdx), 10);
      const fnName = value.slice(commaIdx + 1);
      if (!isNaN(count) && fnName.length > 0) {
        // Last FNDA for a function name wins (lcov convention)
        current.fnda.set(fnName, count);
      }
    } else if (tag === "DA") {
      // DA:<line>,<count>
      const commaIdx = value.indexOf(",");
      if (commaIdx === -1) continue;
      const lineNum = parseInt(value.slice(0, commaIdx), 10);
      const count = parseInt(value.slice(commaIdx + 1), 10);
      if (!isNaN(lineNum) && !isNaN(count)) {
        current.da.set(lineNum, count);
      }
    }
  }

  // Flush last record
  if (current) records.push(current);

  return records;
}

/**
 * For a given SF record and a FunctionNode, determine the observation.
 *
 * Rules:
 * - If FN/FNDA records exist: match by function name. Only when file+name+line
 *   is unique within the SF record → assign observation from FNDA count.
 *   Duplicate/missing count → unknown.
 * - If no FN/FNDA records → fall back to DA records: any count>0 in
 *   [startLine, endLine] → observed; all DA counts 0 → not-observed;
 *   no DA at all → unknown.
 */
function observeNode(
  rec: LcovSfRecord,
  node: FunctionNode,
  checks: string[],
): Observation {
  const hasFn = rec.fnLines.size > 0;

  if (hasFn) {
    // Try to match by function name
    // Find all FN entries that match this node's name within its line range
    const matchingLines: number[] = [];
    for (const [line, name] of rec.fnLines) {
      if (name === node.name && line >= node.startLine && line <= node.endLine) {
        matchingLines.push(line);
      }
    }

    if (matchingLines.length === 0) {
      // Function name not found in FN records
      checks.push("COVERAGE_FN_NOT_FOUND");
      return "unknown";
    }

    if (matchingLines.length > 1) {
      // Duplicate function name within SF — ambiguous
      checks.push("COVERAGE_FN_DUPLICATE");
      return "unknown";
    }

    // Unique match: check FNDA count
    const count = rec.fnda.get(node.name);
    if (count === undefined) {
      checks.push("COVERAGE_FNDA_MISSING");
      return "unknown";
    }

    return count > 0 ? "observed" : "not-observed";
  }

  // Fall back to DA records
  const hasDa = rec.da.size > 0;

  if (!hasDa) {
    checks.push("COVERAGE_NO_DATA");
    return "unknown";
  }

  let anyObserved = false;
  let anyLine = false;

  for (let line = node.startLine; line <= node.endLine; line++) {
    const count = rec.da.get(line);
    if (count !== undefined) {
      anyLine = true;
      if (count > 0) {
        anyObserved = true;
        break;
      }
    }
  }

  if (!anyLine) {
    checks.push("COVERAGE_NO_DATA");
    return "unknown";
  }

  return anyObserved ? "observed" : "not-observed";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read lcov coverage data and map observations onto FunctionNodes.
 *
 * @param coveragePath - Path to the lcov file, or undefined (no coverage available).
 * @param binding - CoverageBinding with file metadata and proof state.
 * @param nodes - FunctionNode array to assign observations to.
 * @returns CoverageResult with observations map, unverified reasons, checks, and alignment.
 */
export async function readCoverage(
  coveragePath: string | undefined,
  binding: CoverageBinding,
  nodes: FunctionNode[],
): Promise<CoverageResult> {
  const observations = new Map<string, Observation>();
  const unverified: string[] = [];
  const checks: string[] = [];

  // No coverage path → UNBOUND
  if (coveragePath === undefined || coveragePath === null) {
    for (const node of nodes) {
      observations.set(nodeKey(node), "unknown");
    }
    unverified.push("COVERAGE_UNBOUND");
    return {
      observations,
      unverified,
      checks,
      alignment: "UNBOUND",
    };
  }

  // Compute file hash and mtime
  let fileText: string;
  try {
    fileText = await Bun.file(coveragePath).text();
  } catch {
    for (const node of nodes) {
      observations.set(nodeKey(node), "unknown");
    }
    unverified.push("COVERAGE_UNREADABLE");
    return {
      observations,
      unverified,
      checks,
      alignment: "UNBOUND",
    };
  }

  const actualSha256 = sha256Hex(fileText);

  let actualMtimeMs: number;
  try {
    actualMtimeMs = fs.statSync(coveragePath).mtimeMs;
  } catch {
    actualMtimeMs = 0;
  }

  // If binding is already UNVERIFIED, short-circuit
  if (binding.proofState === "UNVERIFIED") {
    for (const node of nodes) {
      observations.set(nodeKey(node), "unknown");
    }
    unverified.push("COVERAGE_UNALIGNED");
    checks.push("COVERAGE_PROOF_UNVERIFIED");
    // Set exit code consideration per plan
    process.exitCode = 2;
    return {
      observations,
      unverified,
      checks,
      alignment: "UNVERIFIED",
    };
  }

  // Check companion file
  const companionPath = coveragePath + ".task-lens.json";
  const companionResult = await readCompanion(companionPath, binding);

  if (!companionResult.aligned) {
    for (const node of nodes) {
      observations.set(nodeKey(node), "unknown");
    }
    if (companionResult.reason) {
      unverified.push(companionResult.reason);
    }
    unverified.push("COVERAGE_UNALIGNED");
    process.exitCode = 2;
    return {
      observations,
      unverified,
      checks,
      alignment: "UNVERIFIED",
    };
  }

  // Verify file hash matches binding
  if (binding.fileSha256 !== actualSha256) {
    for (const node of nodes) {
      observations.set(nodeKey(node), "unknown");
    }
    unverified.push("COVERAGE_HASH_MISMATCH");
    unverified.push("COVERAGE_UNALIGNED");
    process.exitCode = 2;
    return {
      observations,
      unverified,
      checks,
      alignment: "UNVERIFIED",
    };
  }

  // Parse lcov
  const records = parseLcov(fileText);

  // Resolve project root from coverage path (its directory)
  const baseDir = path.dirname(path.resolve(coveragePath));

  // Build file→record lookup
  const recordByFile = new Map<string, LcovSfRecord>();

  for (const rec of records) {
    const resolved = normalizeFilePath(rec.sf, baseDir);
    if (isWithinProject(resolved, baseDir)) {
      recordByFile.set(resolved, rec);
    } else {
      checks.push(`COVERAGE_PATH_OUT_OF_BOUNDS:${rec.sf}`);
    }
  }

  // Map observations to nodes
  for (const node of nodes) {
    const nodePath = path.isAbsolute(node.file)
      ? path.normalize(node.file)
      : path.normalize(path.join(baseDir, node.file));

    const rec = recordByFile.get(nodePath);

    if (!rec) {
      observations.set(nodeKey(node), "unknown");
      checks.push("COVERAGE_NO_RECORD");
      continue;
    }

    const obs = observeNode(rec, node, checks);
    observations.set(nodeKey(node), obs);
  }

  const alignment: "ALIGNED" = "ALIGNED";

  return {
    observations,
    unverified,
    checks,
    alignment,
  };
}
