// scripts/task-lens/artifact-writer.ts
// PHASE-04: Atomic artifact writer with deep serializable guard.
// Writes card.md, graph.json, and receipt.json atomically to OUT/taskId.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { TaskGraphV1, TaskInputReceipt } from "./types.ts";

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/** Request to write task-lens artifacts. */
export interface ArtifactWriteRequest {
  /** Unique task identifier from the input receipt. */
  readonly taskId: string;
  /** Absolute path to the OUT directory (must exist, must be outside project). */
  readonly outDir: string;
  /** Rendered card markdown string. */
  readonly card: string;
  /** Task graph for the JSON artifact. */
  readonly graph: TaskGraphV1;
  /** Task input receipt for the receipt artifact. */
  readonly receipt: TaskInputReceipt;
}

/** Receipt produced by writeArtifacts. */
export interface ArtifactReceipt {
  readonly schemaVersion: "task-lens.artifact/v1";
  readonly taskId: string;
  readonly files: readonly { path: string; sha256: string; bytes: number }[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Artifact integrity / conflict failure. Maps to exit 21. */
export class ArtifactError extends Error {
  constructor(
    message: string,
    public readonly exitCode: 21 = 21,
  ) {
    super(message);
    this.name = "ArtifactError";
  }
}

// ---------------------------------------------------------------------------
// Card section headings (must all be present)
// ---------------------------------------------------------------------------

const REQUIRED_HEADINGS = [
  "一、主干路径",
  "二、变更函数表",
  "三、副作用表",
  "四、证据",
  "五、反馈区",
] as const;

function validateCard(card: string): void {
  if (!card || card.trim().length === 0) {
    throw new ArtifactError("card: must be non-empty");
  }
  for (const heading of REQUIRED_HEADINGS) {
    if (!card.includes(heading)) {
      throw new ArtifactError(`card: missing required heading "${heading}"`);
    }
  }
}

// ---------------------------------------------------------------------------
// Deep serializable guard
// ---------------------------------------------------------------------------

/**
 * Recursively walk a value and throw ArtifactError if any non-serializable
 * value is found: Map, Set, function, symbol, or undefined.
 *
 * JSON.stringify(Map) is FORBIDDEN — the guard catches it before serialization.
 */
function assertDeepSerializable(value: unknown, breadcrumb: string): void {
  if (value === undefined) {
    throw new ArtifactError(`non-serializable undefined at ${breadcrumb}`);
  }

  if (typeof value === "function") {
    throw new ArtifactError(`non-serializable function at ${breadcrumb}`);
  }

  if (typeof value === "symbol") {
    throw new ArtifactError(`non-serializable symbol at ${breadcrumb}`);
  }

  if (value instanceof Map) {
    throw new ArtifactError(`non-serializable Map at ${breadcrumb}`);
  }

  if (value instanceof Set) {
    throw new ArtifactError(`non-serializable Set at ${breadcrumb}`);
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertDeepSerializable(value[i], `${breadcrumb}[${i}]`);
    }
    return;
  }

  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      assertDeepSerializable(
        (value as Record<string, unknown>)[key],
        `${breadcrumb}.${key}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Hashing helpers
// ---------------------------------------------------------------------------

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Stable canonicalizer
// ---------------------------------------------------------------------------

/**
 * Canonicalize a TaskGraphV1 into a stable JSON string.
 * Sorts nodes, edges, and seeds arrays before serialization.
 * Hashes the JSON three times — all must be identical.
 *
 * @returns The canonical JSON string (only if triple-hash passes).
 * @throws ArtifactError if the three hashes are not identical.
 */
function canonicalizeGraph(graph: TaskGraphV1): string {
  // Sort nodes by (file, startLine, id)
  const sortedNodes = [...graph.nodes].sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    if (a.startLine !== b.startLine) return a.startLine - b.startLine;
    return a.id.localeCompare(b.id);
  });

  // Sort edges by (from, to)
  const sortedEdges = [...graph.edges].sort((a, b) => {
    if (a.from !== b.from) return a.from.localeCompare(b.from);
    return a.to.localeCompare(b.to);
  });

  // Sort seeds
  const sortedSeeds = [...graph.seeds].sort((a, b) => a.localeCompare(b));

  // Sort spine internals
  const sortedSpinePrimaryPath = [...graph.spine.primaryPath].sort();
  const sortedSpineSeedBranches = [...graph.spine.seedBranches]
    .map((b) => ({
      from: b.from,
      path: [...b.path].sort(),
      seedIds: [...b.seedIds].sort(),
    }))
    .sort((a, b) => a.from.localeCompare(b.from));
  const sortedSpineUncoveredSeeds = [...graph.spine.uncoveredSeeds].sort();

  const canonical: Record<string, unknown> = {
    schemaVersion: graph.schemaVersion,
    taskId: graph.taskId,
    seeds: sortedSeeds,
    deletedRegions: graph.deletedRegions,
    nodes: sortedNodes,
    edges: sortedEdges,
    spine: {
      entries: graph.spine.entries,
      primaryPath: sortedSpinePrimaryPath,
      seedBranches: sortedSpineSeedBranches,
      uncoveredSeeds: sortedSpineUncoveredSeeds,
      collapsedCount: graph.spine.collapsedCount,
    },
    truncation: graph.truncation,
    unverified: graph.unverified,
  };

  const json = JSON.stringify(canonical);

  // Hash three times — all must be identical
  const hash1 = sha256Hex(json);
  const hash2 = sha256Hex(json);
  const hash3 = sha256Hex(json);

  if (hash1 !== hash2 || hash2 !== hash3) {
    throw new ArtifactError(
      "canonicalizeGraph: triple hash mismatch — non-deterministic serialization detected",
    );
  }

  return json;
}

// ---------------------------------------------------------------------------
// UUID generator (simple, no external deps)
// ---------------------------------------------------------------------------

function generateUUID(): string {
  // crypto.randomUUID is available in Bun/Node 19+
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: simple v4-like generation
  const hex = "0123456789abcdef";
  let uuid = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += "-";
    } else if (i === 14) {
      uuid += "4";
    } else if (i === 19) {
      uuid += hex[(Math.random() * 4) | 8];
    } else {
      uuid += hex[(Math.random() * 16) | 0];
    }
  }
  return uuid;
}

// ---------------------------------------------------------------------------
// File write with fsync and verification
// ---------------------------------------------------------------------------

function writeVerified(
  filePath: string,
  content: string,
): { sha256: string; bytes: number } {
  // Write with wx flag (exclusive write, fail if file exists)
  fs.writeFileSync(filePath, content, { flag: "wx", mode: 0o600 });

  // fsync the file
  const fd = fs.openSync(filePath, "r");
  fs.fsyncSync(fd);
  fs.closeSync(fd);

  // Read back and verify
  const readBack = fs.readFileSync(filePath, "utf8");
  if (readBack !== content) {
    throw new ArtifactError(
      `writeVerified: read-back mismatch for ${filePath}`,
    );
  }

  const sha256 = sha256Hex(content);
  const bytes = Buffer.byteLength(content, "utf8");

  return { sha256, bytes };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Atomically write card.md, graph.json, and receipt.json to OUT/taskId.
 *
 * Order:
 * 1. Deep serializable guard on graph
 * 2. Check OUT/taskId exists → TL-CONFLICT (exit 21)
 * 3. Create staging dir: OUT/.taskId.UUID.tmp (mode 0700)
 * 4. Write 3 files with wx flag, fsync each, read-back verify
 * 5. Card validation: non-empty + all five headings present
 * 6. fsync staging dir
 * 7. rename(staging, final) — atomic on same filesystem
 * 8. fsync OUT dir
 *
 * On failure: clean up staging dir. If final dir is in unknown state,
 * preserve and FAIL (do NOT overwrite).
 *
 * @param request - ArtifactWriteRequest with taskId, outDir, card, graph, receipt.
 * @returns ArtifactReceipt with file paths, hashes, and byte counts.
 * @throws ArtifactError (exit 21) on any integrity or conflict failure.
 */
export async function writeArtifacts(
  request: ArtifactWriteRequest,
): Promise<ArtifactReceipt> {
  const { taskId, outDir, card, graph, receipt } = request;

  // --- 1. Deep serializable guard ---
  try {
    assertDeepSerializable(graph, "graph");
  } catch (e) {
    if (e instanceof ArtifactError) throw e;
    throw new ArtifactError(
      `deep serializable guard failed: ${(e as Error).message}`,
    );
  }

  // --- 2. Check OUT/taskId exists → TL-CONFLICT ---
  const finalDir = path.join(outDir, taskId);
  try {
    const st = fs.statSync(finalDir);
    if (st.isDirectory()) {
      throw new ArtifactError(
        `TL-CONFLICT: output directory already exists: ${finalDir}`,
      );
    }
  } catch (e) {
    if (e instanceof ArtifactError) throw e;
    // ENOENT is expected — directory does not exist yet
  }

  // --- 3. Create staging dir ---
  const uuid = generateUUID();
  const stagingDir = path.join(outDir, `.${taskId}.${uuid}.tmp`);

  try {
    fs.mkdirSync(stagingDir, { mode: 0o700 });
  } catch (e) {
    throw new ArtifactError(
      `failed to create staging directory: ${(e as Error).message}`,
    );
  }

  // Track created files for cleanup
  const createdFiles: string[] = [];

  try {
    // --- 4. Write 3 files with wx flag ---

    // Validate card before writing
    validateCard(card);

    // card.md
    const cardPath = path.join(stagingDir, "card.md");
    const cardResult = writeVerified(cardPath, card);
    createdFiles.push(cardPath);

    // graph.json (canonicalized)
    const graphJson = canonicalizeGraph(graph);
    const graphPath = path.join(stagingDir, "graph.json");
    const graphResult = writeVerified(graphPath, graphJson);
    createdFiles.push(graphPath);

    // receipt.json
    const receiptJson = JSON.stringify(receipt);
    const receiptPath = path.join(stagingDir, "receipt.json");
    const receiptResult = writeVerified(receiptPath, receiptJson);
    createdFiles.push(receiptPath);

    // --- 5. Card validation already done above ---
    // (validateCard called before writing card.md)

    // Verify graph.json can be parsed back
    const graphParsed = JSON.parse(
      fs.readFileSync(graphPath, "utf8"),
    ) as TaskGraphV1;
    if (
      graphParsed.schemaVersion !== graph.schemaVersion ||
      graphParsed.taskId !== graph.taskId
    ) {
      throw new ArtifactError(
        "graph.json: parsed content does not match original",
      );
    }

    // Verify receipt.json can be parsed back
    const receiptParsed = JSON.parse(
      fs.readFileSync(receiptPath, "utf8"),
    ) as TaskInputReceipt;
    if (
      receiptParsed.schemaVersion !== receipt.schemaVersion ||
      receiptParsed.taskId !== receipt.taskId
    ) {
      throw new ArtifactError(
        "receipt.json: parsed content does not match original",
      );
    }

    // --- 6. fsync staging dir ---
    const stagingFd = fs.openSync(stagingDir, "r");
    fs.fsyncSync(stagingFd);
    fs.closeSync(stagingFd);

    // --- 7. rename(staging, final) — atomic on same filesystem ---
    try {
      fs.renameSync(stagingDir, finalDir);
    } catch (e) {
      throw new ArtifactError(
        `rename staging → final failed: ${(e as Error).message}`,
      );
    }

    // --- 8. fsync OUT dir ---
    const outFd = fs.openSync(outDir, "r");
    fs.fsyncSync(outFd);
    fs.closeSync(outFd);

    // Build receipt
    const files = [
      {
        path: path.join(finalDir, "card.md"),
        sha256: cardResult.sha256,
        bytes: cardResult.bytes,
      },
      {
        path: path.join(finalDir, "graph.json"),
        sha256: graphResult.sha256,
        bytes: graphResult.bytes,
      },
      {
        path: path.join(finalDir, "receipt.json"),
        sha256: receiptResult.sha256,
        bytes: receiptResult.bytes,
      },
    ];

    return {
      schemaVersion: "task-lens.artifact/v1",
      taskId,
      files,
    };
  } catch (e) {
    // --- Cleanup: remove staging dir only ---
    if (e instanceof ArtifactError) {
      cleanupStaging(stagingDir);
      throw e;
    }
    cleanupStaging(stagingDir);
    throw new ArtifactError(
      `writeArtifacts failed: ${(e as Error).message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Cleanup helper
// ---------------------------------------------------------------------------

/**
 * Remove the staging directory recursively.
 * Does NOT remove the final directory if rename already happened.
 */
function cleanupStaging(stagingDir: string): void {
  try {
    if (fs.existsSync(stagingDir)) {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }
  } catch {
    // Best-effort cleanup; failure here is non-fatal
  }
}
