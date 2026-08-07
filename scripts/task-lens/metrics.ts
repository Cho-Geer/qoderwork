// scripts/task-lens/metrics.ts
// PHASE-05-v2: metrics/feedback module.
// mkdir-lock + JSONL append + fsync + verified generated recovery + feedback
// + summary (INCOMPLETE|PASS|FAIL). Rejections carry a numeric exitCode:
// 21 = integrity / conflict / metrics unavailable, 10 = missing/duplicate
// feedback input. Lock protocol: mkdir-atomic lock dir, owner.json written by
// the lock owner only, no PID guessing, no stale-lock auto-delete.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { TaskGraphV1, TaskInputReceipt, SpineForest } from "./types.ts";

// ---------------------------------------------------------------------------
// Schema literals
// ---------------------------------------------------------------------------

export const METRICS_SCHEMA_VERSION = "task-lens.metrics/v1" as const;
export const SUMMARY_SCHEMA_VERSION = "task-lens.summary/v1" as const;
export const LOCK_DIR_NAME = ".task-lens-metrics.lock" as const;
export const METRICS_FILE_NAME = "metrics.jsonl" as const;
export const METRICS_ENV_VAR = "TASK_LENS_METRICS_ENV" as const;
export const LOCK_INTERVAL_MS = 50 as const;
export const LOCK_TIMEOUT_MS = 5000 as const;

/** Card section headings that a valid card.md must contain (recovery check). */
const REQUIRED_CARD_HEADINGS = [
  "一、主干路径",
  "二、变更函数表",
  "三、副作用表",
  "四、证据",
  "五、反馈区",
] as const;

// ---------------------------------------------------------------------------
// Event / summary types (v1 frozen schema, owned by this module)
// ---------------------------------------------------------------------------

export interface GeneratedEvent {
  readonly schemaVersion: typeof METRICS_SCHEMA_VERSION;
  readonly event: "generated";
  readonly taskId: string;
  /** input-receipt.generatedAt */
  readonly recordedAt: string;
  readonly seedCount: number;
  readonly edgeCount: number;
  readonly displayNodeCount: number;
  readonly coverage: {
    readonly observed: number;
    readonly notObserved: number;
    readonly unknown: number;
  };
  readonly truncation: readonly string[];
  readonly exitCode: 0 | 2;
  readonly artifactHashes: {
    readonly card: string;
    readonly graph: string;
    readonly receipt: string;
  };
}

export interface FeedbackEvent {
  readonly schemaVersion: typeof METRICS_SCHEMA_VERSION;
  readonly event: "feedback";
  readonly taskId: string;
  readonly recordedAt: string;
  readonly useful: boolean;
  readonly loadReduced: boolean;
  readonly issuesFound: number;
  readonly issuesGuidedByCard: number;
  readonly reviewMinutes: number;
  readonly notes: string;
}

export type MetricsEvent = GeneratedEvent | FeedbackEvent;

export type SummaryGate = "INCOMPLETE" | "PASS" | "FAIL";

export interface MetricsSummary {
  readonly schemaVersion: typeof SUMMARY_SCHEMA_VERSION;
  readonly generatedCount: number;
  readonly feedbackCount: number;
  readonly usefulAndReducedCount: number;
  readonly missingFeedbackTaskIds: readonly string[];
  readonly duplicateTaskIds: readonly string[];
  readonly invalidLineNumbers: readonly number[];
  readonly gate: SummaryGate;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Metrics integrity / input failure. exitCode 21 = integrity/conflict/metrics
 * unavailable; exitCode 10 = missing task/generated or duplicate feedback.
 */
export class MetricsError extends Error {
  constructor(
    message: string,
    public readonly exitCode: 21 | 10 = 21,
  ) {
    super(message);
    this.name = "MetricsError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

/**
 * env field for owner.json. The caller injects the value via
 * TASK_LENS_METRICS_ENV; the module NEVER auto-detects the platform.
 * Unset defaults to "wsl" (canonical environment).
 */
export function resolveMetricsEnv(): "wsl" | "gitbash" {
  return process.env[METRICS_ENV_VAR] === "gitbash" ? "gitbash" : "wsl";
}

/** Number of nodes actually displayed on the card (≤ 20 by spine budget). */
export function computeDisplayNodeCount(spine: SpineForest): number {
  const display = new Set<string>(spine.primaryPath);
  for (const branch of spine.seedBranches) {
    for (const n of branch.path) display.add(n);
  }
  return display.size;
}

/**
 * Deterministic exit code for a generated task, derived ONLY from the
 * committed graph.json contents so recovery can recompute the exact event.
 * Degraded (2) when: truncation, no live seeds (only-deletion), collapsed
 * spine display, or coverage was unavailable (COVERAGE_* in unverified).
 */
export function computeGeneratedExitCode(graph: TaskGraphV1): 0 | 2 {
  if (graph.truncation.length > 0) return 2;
  if (graph.seeds.length === 0) return 2;
  if (graph.spine.collapsedCount > 0) return 2;
  if (graph.unverified.some((u) => u.startsWith("COVERAGE_"))) return 2;
  return 0;
}

/**
 * Build the exact GeneratedEvent from committed graph/receipt content plus the
 * three artifact hashes. Used both by the generate pipeline and by recovery,
 * so a rebuilt event is byte-identical to the original append.
 */
export function buildGeneratedEvent(
  graph: TaskGraphV1,
  receipt: TaskInputReceipt,
  artifactHashes: { card: string; graph: string; receipt: string },
): GeneratedEvent {
  return {
    schemaVersion: METRICS_SCHEMA_VERSION,
    event: "generated",
    taskId: receipt.taskId,
    recordedAt: receipt.generatedAt,
    seedCount: graph.seeds.length,
    edgeCount: graph.edges.length,
    displayNodeCount: computeDisplayNodeCount(graph.spine),
    coverage: {
      observed: graph.nodes.filter((n) => n.observation === "observed").length,
      notObserved: graph.nodes.filter((n) => n.observation === "not-observed")
        .length,
      unknown: graph.nodes.filter((n) => n.observation === "unknown").length,
    },
    truncation: [...graph.truncation].sort(),
    exitCode: computeGeneratedExitCode(graph),
    artifactHashes,
  };
}

// ---------------------------------------------------------------------------
// Event validation (fields and value ranges)
// ---------------------------------------------------------------------------

function validateGeneratedEvent(e: unknown): e is GeneratedEvent {
  if (typeof e !== "object" || e === null) return false;
  const o = e as Record<string, unknown>;
  if (o.schemaVersion !== METRICS_SCHEMA_VERSION) return false;
  if (o.event !== "generated") return false;
  if (typeof o.taskId !== "string" || o.taskId.length === 0) return false;
  if (typeof o.recordedAt !== "string" || o.recordedAt.length === 0) {
    return false;
  }
  if (!isNonNegativeInt(o.seedCount)) return false;
  if (!isNonNegativeInt(o.edgeCount)) return false;
  if (!isNonNegativeInt(o.displayNodeCount) || o.displayNodeCount > 20) {
    return false;
  }
  const cov = o.coverage;
  if (typeof cov !== "object" || cov === null) return false;
  const c = cov as Record<string, unknown>;
  if (
    !isNonNegativeInt(c.observed) ||
    !isNonNegativeInt(c.notObserved) ||
    !isNonNegativeInt(c.unknown)
  ) {
    return false;
  }
  if (
    !Array.isArray(o.truncation) ||
    o.truncation.some((t) => typeof t !== "string")
  ) {
    return false;
  }
  if (o.exitCode !== 0 && o.exitCode !== 2) return false;
  const hashes = o.artifactHashes;
  if (typeof hashes !== "object" || hashes === null) return false;
  const h = hashes as Record<string, unknown>;
  if (
    typeof h.card !== "string" ||
    typeof h.graph !== "string" ||
    typeof h.receipt !== "string"
  ) {
    return false;
  }
  return true;
}

function validateFeedbackEvent(e: unknown): e is FeedbackEvent {
  if (typeof e !== "object" || e === null) return false;
  const o = e as Record<string, unknown>;
  if (o.schemaVersion !== METRICS_SCHEMA_VERSION) return false;
  if (o.event !== "feedback") return false;
  if (typeof o.taskId !== "string" || o.taskId.length === 0) return false;
  if (typeof o.recordedAt !== "string" || o.recordedAt.length === 0) {
    return false;
  }
  if (typeof o.useful !== "boolean") return false;
  if (typeof o.loadReduced !== "boolean") return false;
  if (!isNonNegativeInt(o.issuesFound)) return false;
  if (!isNonNegativeInt(o.issuesGuidedByCard)) return false;
  if (o.issuesGuidedByCard > o.issuesFound) return false;
  if (
    typeof o.reviewMinutes !== "number" ||
    !Number.isFinite(o.reviewMinutes) ||
    o.reviewMinutes <= 0
  ) {
    return false;
  }
  if (typeof o.notes !== "string") return false;
  if (Array.from(o.notes).length > 2000) return false; // UTF-8 code points
  return true;
}

function isMetricsEvent(e: unknown): e is MetricsEvent {
  if (typeof e !== "object" || e === null) return false;
  const ev = (e as Record<string, unknown>).event;
  return ev === "generated" || ev === "feedback";
}

// ---------------------------------------------------------------------------
// JSONL scanner (strict: every line must parse and validate)
// ---------------------------------------------------------------------------

export interface MetricsScan {
  /** metrics.jsonl is readable (missing file counts as readable/empty). */
  readonly readable: boolean;
  /** every line parsed and validated. */
  readonly querySucceeded: boolean;
  readonly invalidLineNumbers: readonly number[];
  readonly generated: readonly GeneratedEvent[];
  readonly feedback: readonly FeedbackEvent[];
}

export function metricsPath(out: string): string {
  return path.join(out, METRICS_FILE_NAME);
}

export function scanMetrics(out: string): MetricsScan {
  const file = metricsPath(out);
  if (!fs.existsSync(file)) {
    return {
      readable: true,
      querySucceeded: true,
      invalidLineNumbers: [],
      generated: [],
      feedback: [],
    };
  }
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return {
      readable: false,
      querySucceeded: false,
      invalidLineNumbers: [],
      generated: [],
      feedback: [],
    };
  }
  // Normalize CRLF/LF before line splitting (Git Bash may produce CRLF).
  const lines = text.split(/\r?\n/);
  const generated: GeneratedEvent[] = [];
  const feedback: FeedbackEvent[] = [];
  const invalidLineNumbers: number[] = [];
  let querySucceeded = true;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    if (raw.trim() === "") continue; // blank / trailing newline
    const lineNo = i + 1;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      invalidLineNumbers.push(lineNo);
      querySucceeded = false;
      continue;
    }
    if (!isMetricsEvent(parsed)) {
      invalidLineNumbers.push(lineNo);
      querySucceeded = false;
      continue;
    }
    const ev = parsed as MetricsEvent;
    if (ev.event === "generated") {
      if (!validateGeneratedEvent(ev)) {
        invalidLineNumbers.push(lineNo);
        querySucceeded = false;
        continue;
      }
      generated.push(ev);
    } else {
      if (!validateFeedbackEvent(ev)) {
        invalidLineNumbers.push(lineNo);
        querySucceeded = false;
        continue;
      }
      feedback.push(ev);
    }
  }
  return {
    readable: true,
    querySucceeded,
    invalidLineNumbers,
    generated,
    feedback,
  };
}

// ---------------------------------------------------------------------------
// Lock protocol (mkdir-atomic; owner-only cleanup; timeout → exit 21)
// ---------------------------------------------------------------------------

interface MetricsLockOwner {
  readonly taskId: string;
  readonly event: string;
  readonly env: "wsl" | "gitbash";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withMetricsLockInternal<T>(
  out: string,
  owner: MetricsLockOwner,
  operation: () => Promise<T>,
): Promise<T> {
  const lockDir = path.join(out, LOCK_DIR_NAME);
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  let acquired = false;
  for (;;) {
    try {
      fs.mkdirSync(lockDir, { mode: 0o700 });
      acquired = true;
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code !== "EEXIST") {
        throw new MetricsError(
          `lock: mkdir ${lockDir} failed: ${(e as Error).message}`,
          21,
        );
      }
      if (Date.now() >= deadline) {
        throw new MetricsError(
          `lock: timeout acquiring metrics lock after ${LOCK_TIMEOUT_MS}ms`,
          21,
        );
      }
      await sleep(LOCK_INTERVAL_MS);
    }
  }
  try {
    // owner.json written by the lock owner only, then fsynced.
    const ownerPayload = {
      pid: process.pid,
      createdAt: new Date().toISOString(),
      taskId: owner.taskId,
      event: owner.event,
      env: owner.env,
    };
    const ownerPath = path.join(lockDir, "owner.json");
    const fd = fs.openSync(ownerPath, "w");
    try {
      fs.writeSync(fd, JSON.stringify(ownerPayload));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    // Directory fsync: Windows libuv has no dir-fsync semantics (EPERM);
    // skip EPERM only, rethrow anything else. POSIX still fsyncs.
    const dirFd = fs.openSync(lockDir, "r");
    try {
      fs.fsyncSync(dirFd);
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== "EPERM") throw err;
    } finally {
      fs.closeSync(dirFd);
    }
    return await operation();
  } finally {
    if (acquired) {
      try {
        fs.rmSync(lockDir, { recursive: true, force: true });
      } catch {
        // Owner-only cleanup is best-effort; a leftover lock makes the next
        // attempt time out (BLOCKED) rather than being silently removed.
      }
    }
  }
}

/**
 * Generic lock primitive. Serializes the operation under the metrics lock;
 * owner.json carries pid/createdAt plus the caller-injected env.
 * @throws MetricsError (exit21) on lock acquisition failure or timeout.
 */
export async function withMetricsLock<T>(
  out: string,
  operation: () => Promise<T>,
): Promise<T> {
  return withMetricsLockInternal(
    out,
    { taskId: "operation", event: "operation", env: resolveMetricsEnv() },
    operation,
  );
}

// ---------------------------------------------------------------------------
// Append with fsync (inside the lock)
// ---------------------------------------------------------------------------

function appendLine(out: string, line: string): void {
  const file = metricsPath(out);
  const fd = fs.openSync(file, "a");
  try {
    fs.writeSync(fd, line + "\n");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  // fsync out dir — Windows: skip EPERM (no dir-fsync semantics).
  const dirFd = fs.openSync(out, "r");
  try {
    fs.fsyncSync(dirFd);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "EPERM") throw err;
  } finally {
    fs.closeSync(dirFd);
  }
}

// ---------------------------------------------------------------------------
// appendGenerated — verified recovery (§6.6)
// ---------------------------------------------------------------------------

/**
 * Record a generated event AFTER artifacts are fully committed. Always runs
 * the verified recovery path:
 *  1. task dir must exist with valid receipt/graph/card (schema/taskId/hash/
 *     card headings) matching event.artifactHashes → else exit21.
 *  2. metrics query must be readable + parse + success → else exit21.
 *  3. generated event for taskId FOUND → exit21 conflict;
 *     UNAVAILABLE → exit21; NOT_FOUND → rebuild exact GeneratedEvent from the
 *     committed artifacts and append.
 * @throws MetricsError (exit21) on any integrity/conflict/unavailable state.
 */
export async function appendGenerated(
  out: string,
  event: GeneratedEvent,
): Promise<void> {
  if (!validateGeneratedEvent(event)) {
    throw new MetricsError("generated: invalid GeneratedEvent payload", 21);
  }
  const taskDir = path.join(out, event.taskId);
  let st: fs.Stats;
  try {
    st = fs.statSync(taskDir);
  } catch {
    throw new MetricsError(
      `generated: final task dir not found: ${taskDir}`,
      21,
    );
  }
  if (!st.isDirectory()) {
    throw new MetricsError(
      `generated: final task dir is not a directory: ${taskDir}`,
      21,
    );
  }

  // Read-only verification of the three committed artifacts.
  let cardText: string;
  let graphRaw: unknown;
  let receiptRaw: unknown;
  try {
    cardText = fs.readFileSync(path.join(taskDir, "card.md"), "utf8");
    graphRaw = JSON.parse(
      fs.readFileSync(path.join(taskDir, "graph.json"), "utf8"),
    );
    receiptRaw = JSON.parse(
      fs.readFileSync(path.join(taskDir, "receipt.json"), "utf8"),
    );
  } catch (e) {
    throw new MetricsError(
      `generated: cannot read committed artifacts: ${(e as Error).message}`,
      21,
    );
  }
  const graph = graphRaw as TaskGraphV1;
  const receipt = receiptRaw as TaskInputReceipt;
  if (
    typeof graph !== "object" ||
    graph === null ||
    graph.schemaVersion !== "task-lens.task-graph/v1" ||
    graph.taskId !== event.taskId
  ) {
    throw new MetricsError("generated: graph.json schema/taskId mismatch", 21);
  }
  if (
    typeof receipt !== "object" ||
    receipt === null ||
    receipt.schemaVersion !== "task-lens.input/v1" ||
    receipt.taskId !== event.taskId
  ) {
    throw new MetricsError(
      "generated: receipt.json schema/taskId mismatch",
      21,
    );
  }
  for (const heading of REQUIRED_CARD_HEADINGS) {
    if (!cardText.includes(heading)) {
      throw new MetricsError(
        `generated: card.md missing required heading "${heading}"`,
        21,
      );
    }
  }
  const actualHashes = {
    card: sha256Hex(cardText),
    graph: sha256Hex(JSON.stringify(graph)),
    receipt: sha256Hex(JSON.stringify(receipt)),
  };
  if (
    actualHashes.card !== event.artifactHashes.card ||
    actualHashes.graph !== event.artifactHashes.graph ||
    actualHashes.receipt !== event.artifactHashes.receipt
  ) {
    throw new MetricsError(
      "generated: committed artifact hash mismatch (recovery refused)",
      21,
    );
  }

  // Rebuild the exact event from the committed artifacts.
  const rebuilt = buildGeneratedEvent(graph, receipt, actualHashes);
  if (JSON.stringify(rebuilt) !== JSON.stringify(event)) {
    throw new MetricsError(
      "generated: caller event does not match artifacts (recovery refused)",
      21,
    );
  }

  const env = resolveMetricsEnv();
  return withMetricsLockInternal(
    out,
    { taskId: event.taskId, event: "generated", env },
    async () => {
      const scan = scanMetrics(out);
      if (!scan.readable || !scan.querySucceeded) {
        throw new MetricsError(
          `generated: metrics unavailable (invalid lines: ${scan.invalidLineNumbers.join(",")})`,
          21,
        );
      }
      const found = scan.generated.some((g) => g.taskId === event.taskId);
      if (found) {
        throw new MetricsError(
          `generated: conflict — generated event already recorded for task ${event.taskId}`,
          21,
        );
      }
      appendLine(out, JSON.stringify(rebuilt));
    },
  );
}

// ---------------------------------------------------------------------------
// appendFeedback — one feedback per task (§6.7)
// ---------------------------------------------------------------------------

/**
 * Record a feedback event. task dir and generated event must be FOUND
 * (else exit10); duplicate feedback is exit10; metrics unavailable is exit21.
 * @throws MetricsError (exit10 | exit21).
 */
export async function appendFeedback(
  out: string,
  event: FeedbackEvent,
): Promise<void> {
  if (!validateFeedbackEvent(event)) {
    throw new MetricsError("feedback: invalid FeedbackEvent payload", 10);
  }
  const env = resolveMetricsEnv();
  return withMetricsLockInternal(
    out,
    { taskId: event.taskId, event: "feedback", env },
    async () => {
      const scan = scanMetrics(out);
      if (!scan.readable || !scan.querySucceeded) {
        throw new MetricsError(
          `feedback: metrics unavailable (invalid lines: ${scan.invalidLineNumbers.join(",")})`,
          21,
        );
      }
      const taskDir = path.join(out, event.taskId);
      let dirOk = false;
      try {
        dirOk = fs.statSync(taskDir).isDirectory();
      } catch {
        dirOk = false;
      }
      if (!dirOk) {
        throw new MetricsError(
          `feedback: task dir not found: ${event.taskId}`,
          10,
        );
      }
      const generatedFound = scan.generated.some(
        (g) => g.taskId === event.taskId,
      );
      if (!generatedFound) {
        throw new MetricsError(
          `feedback: no generated event for task ${event.taskId}`,
          10,
        );
      }
      const duplicate = scan.feedback.some(
        (f) => f.taskId === event.taskId,
      );
      if (duplicate) {
        throw new MetricsError(
          `feedback: duplicate feedback for task ${event.taskId}`,
          10,
        );
      }
      appendLine(out, JSON.stringify(event));
    },
  );
}

// ---------------------------------------------------------------------------
// summarizeMetrics (§ REQ-011-E)
// ---------------------------------------------------------------------------

/**
 * Read-only aggregation of metrics.jsonl joined by taskId. Any corrupt line or
 * duplicate event makes the evidence UNAVAILABLE → throws exit21. Gate:
 * generated<10 || feedback<10 || missing non-empty → INCOMPLETE; else ≥7
 * useful+loadReduced pairs → PASS; else FAIL.
 * @throws MetricsError (exit21) on unreadable/corrupt/duplicate evidence.
 */
export async function summarizeMetrics(out: string): Promise<MetricsSummary> {
  const scan = scanMetrics(out);
  if (!scan.readable || !scan.querySucceeded) {
    throw new MetricsError(
      `summary: metrics unavailable (invalid lines: ${scan.invalidLineNumbers.join(",")})`,
      21,
    );
  }
  const generatedCount = scan.generated.length;
  const feedbackCount = scan.feedback.length;

  // Duplicate events make the evidence unavailable (fail-closed).
  const genIds = scan.generated.map((g) => g.taskId);
  const fbIds = scan.feedback.map((f) => f.taskId);
  const dupIds = new Set<string>();
  for (const id of new Set(genIds)) {
    if (genIds.filter((x) => x === id).length > 1) dupIds.add(id);
  }
  for (const id of new Set(fbIds)) {
    if (fbIds.filter((x) => x === id).length > 1) dupIds.add(id);
  }
  const duplicateTaskIds = [...dupIds].sort();
  if (duplicateTaskIds.length > 0) {
    throw new MetricsError(
      `summary: duplicate events for tasks: ${duplicateTaskIds.join(",")}`,
      21,
    );
  }

  const generatedTaskIds = new Set(genIds);
  const feedbackTaskIds = new Set(fbIds);
  const missingFeedbackTaskIds = [...generatedTaskIds]
    .filter((id) => !feedbackTaskIds.has(id))
    .sort();
  const usefulAndReducedCount = scan.feedback.filter(
    (f) => f.useful && f.loadReduced,
  ).length;

  let gate: SummaryGate;
  if (
    generatedCount < 10 ||
    feedbackCount < 10 ||
    missingFeedbackTaskIds.length > 0
  ) {
    gate = "INCOMPLETE";
  } else if (usefulAndReducedCount >= 7) {
    gate = "PASS";
  } else {
    gate = "FAIL";
  }

  return {
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    generatedCount,
    feedbackCount,
    usefulAndReducedCount,
    missingFeedbackTaskIds,
    duplicateTaskIds,
    invalidLineNumbers: [],
    gate,
  };
}
