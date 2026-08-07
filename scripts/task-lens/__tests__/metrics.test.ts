// scripts/task-lens/__tests__/metrics.test.ts
// PHASE-05-v2: metrics/feedback module tests.
// Checks: TL-LOCK-v2, TL-JSONL-v2, TL-GENERATED-v2, TL-RECOVERY-v2,
// TL-FEEDBACK-v2, TL-SUMMARY-v2, TL-NEGATIVE-v2.
// Single-mutations covered: TL-C-401, TL-C-402, TL-C-403, TL-C-404, TL-C-405,
// TL-C-406 (TL-C-407 is WSL-only: EACCES injection on append is N/A on Windows
// Git Bash because EACCES semantics are not equivalent — skipped there).
// At least one test exercises a real two-subprocess lock contention
// (no FAKE-INJECTION of the filesystem).

import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  appendFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { writeArtifacts } from "../artifact-writer.ts";
import { renderCard } from "../card-renderer.ts";
import {
  appendGenerated,
  appendFeedback,
  summarizeMetrics,
  withMetricsLock,
  buildGeneratedEvent,
  scanMetrics,
  MetricsError,
  METRICS_SCHEMA_VERSION,
  METRICS_FILE_NAME,
  LOCK_DIR_NAME,
  LOCK_TIMEOUT_MS,
  type GeneratedEvent,
  type FeedbackEvent,
} from "../metrics.ts";
import type {
  FunctionNode,
  TaskGraphV1,
  TaskInputReceipt,
} from "../types.ts";

// ---------------------------------------------------------------------------
// Platform helpers
// ---------------------------------------------------------------------------

const IS_WINDOWS = process.platform === "win32";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** file:// URL for importing metrics.ts in a child `bun -e` process. */
function metricsModuleUrl(): string {
  const rel = join(import.meta.dir, "..", "metrics.ts");
  return `file:///${rel.replaceAll("\\", "/")}`;
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeNode(
  id: string,
  file: string,
  startLine: number,
  name: string,
): FunctionNode {
  return {
    id,
    name,
    file,
    startLine,
    endLine: startLine + 5,
    signature: `${name}()`,
    sideEffects: [],
    observation: "unknown",
  };
}

function makeGraph(nodes: FunctionNode[], taskId: string): TaskGraphV1 {
  return {
    schemaVersion: "task-lens.task-graph/v1",
    taskId,
    seeds: nodes.map((n) => n.id),
    deletedRegions: [],
    nodes,
    edges: [],
    spine: {
      entries: [],
      primaryPath: nodes.map((n) => n.id),
      seedBranches: [],
      uncoveredSeeds: [],
      collapsedCount: 0,
    },
    truncation: [],
    unverified: [],
  };
}

function makeReceipt(taskId: string): TaskInputReceipt {
  return {
    schemaVersion: "task-lens.input/v1",
    taskId,
    projectRealpath: "/tmp/test-project",
    mode: "working-tree",
    baseSha: "base-sha-test",
    headSha: "head-sha-test",
    diffHash: "diff-hash-test",
    configHash: "config-hash-test",
    coverageHash: null,
    provider: {
      name: "codegraph-cli",
      schemaVersion: "v8",
      available: true,
      resolvedBy: null,
    },
    configSchemaVersion: "task-lens.config/v1",
    coverage: null,
    generatedAt: "2026-07-24T00:00:00Z",
  };
}

/**
 * Write a complete task directory (card.md + graph.json + receipt.json) using
 * the REAL writeArtifacts writer, and return the exact artifact hashes plus
 * the canonical GeneratedEvent for that task.
 */
async function createCompleteTask(
  out: string,
  taskId: string,
): Promise<{ event: GeneratedEvent; hashes: { card: string; graph: string; receipt: string } }> {
  const nodes = [
    makeNode("n1", "src/app.ts", 1, "main"),
    makeNode("n2", "src/app.ts", 10, "helper"),
  ];
  const graph = makeGraph(nodes, taskId);
  const receipt = makeReceipt(taskId);
  const card = renderCard(graph, receipt);
  const result = await writeArtifacts({ taskId, outDir: out, card, graph, receipt });
  const hashes = {
    card: result.files.find((f) => f.path.endsWith("card.md"))!.sha256,
    graph: result.files.find((f) => f.path.endsWith("graph.json"))!.sha256,
    receipt: result.files.find((f) => f.path.endsWith("receipt.json"))!.sha256,
  };
  const event = buildGeneratedEvent(graph, receipt, hashes);
  return { event, hashes };
}

function metricsFile(out: string): string {
  return join(out, METRICS_FILE_NAME);
}

function readLines(out: string): string[] {
  const text = readFileSync(metricsFile(out), "utf8");
  return text.split(/\r?\n/).filter((l) => l.trim() !== "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// TL-LOCK-v2
// ---------------------------------------------------------------------------

describe("TL-LOCK-v2 lock serialization", () => {
  test("all-pass: real two-subprocess contention — second writer waits, both succeed, owner cleans up", async () => {
    const out = mkdtempSync("/tmp/tl-lock-");
    try {
      // Main process acquires the lock first and holds it for 900ms.
      const held = withMetricsLock(out, async () => {
        await sleep(900);
      });
      await sleep(150); // main acquires first

      // Child bun subprocess tries to acquire the same lock concurrently.
      // NOTE: async Bun.spawn (not spawnSync) so the main event loop keeps
      // running and the main holder can release the lock.
      const script = `
        const { withMetricsLock } = await import("${metricsModuleUrl()}");
        const out = ${JSON.stringify(out)};
        const t0 = Date.now();
        await withMetricsLock(out, async () => {});
        console.log("WAIT_MS=" + (Date.now() - t0));
      `;
      const proc = Bun.spawn({
        cmd: [process.execPath, "-e", script],
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const exit = await proc.exited;
      await held;

      expect(exit).toBe(0);
      const waitMs = parseInt(
        (stdout.match(/WAIT_MS=(\d+)/) ?? [])[1] ?? "0",
        10,
      );
      // Child must have waited for the main holder to release (~900ms).
      expect(waitMs).toBeGreaterThanOrEqual(500);
      expect(waitMs).toBeLessThan(LOCK_TIMEOUT_MS);
      expect(stderr).toBe("");
      // Owner cleanup: lock dir must be gone after both writers finish.
      expect(existsSync(join(out, LOCK_DIR_NAME))).toBe(false);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  test("TL-C-402 single-mutation: pre-created lock dir -> timeout exit 21", async () => {
    const out = mkdtempSync("/tmp/tl-lock-to-");
    try {
      const lockDir = join(out, LOCK_DIR_NAME);
      mkdirSync(lockDir, { recursive: true });
      const started = Date.now();
      try {
        await withMetricsLock(out, async () => {});
        throw new Error("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(MetricsError);
        if (e instanceof MetricsError) {
          expect(e.exitCode).toBe(21);
          expect(e.message).toContain("timeout");
        }
      }
      const elapsed = Date.now() - started;
      expect(elapsed).toBeGreaterThanOrEqual(LOCK_TIMEOUT_MS - 300);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 15000);

  test("owner.json records pid/createdAt/taskId/event/env", async () => {
    const out = mkdtempSync("/tmp/tl-lock-owner-");
    try {
      const script = `
        const { withMetricsLock } = await import("${metricsModuleUrl()}");
        const out = ${JSON.stringify(out)};
        const fs = await import("node:fs");
        await withMetricsLock(out, async () => {
          const owner = JSON.parse(fs.readFileSync(out + "/.task-lens-metrics.lock/owner.json", "utf8"));
          console.log("OWNER=" + JSON.stringify(owner));
        });
      `;
      const proc = Bun.spawn({
        cmd: [process.execPath, "-e", script],
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const exit = await proc.exited;
      expect(exit).toBe(0);
      expect(stderr).toBe("");
      const ownerRaw = (stdout.match(/OWNER=(\{.*\})/) ?? [])[1];
      expect(ownerRaw).toBeDefined();
      const owner = JSON.parse(ownerRaw!);
      expect(typeof owner.pid).toBe("number");
      expect(typeof owner.createdAt).toBe("string");
      expect(typeof owner.taskId).toBe("string");
      expect(typeof owner.event).toBe("string");
      expect(["wsl", "gitbash"]).toContain(owner.env);
      // Owner cleanup on success.
      expect(existsSync(join(out, LOCK_DIR_NAME))).toBe(false);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// TL-JSONL-v2
// ---------------------------------------------------------------------------

describe("TL-JSONL-v2 strict line scanner", () => {
  let out: string;

  beforeAll(() => {
    out = mkdtempSync("/tmp/tl-jsonl-");
  });

  afterAll(() => {
    if (existsSync(out)) rmSync(out, { recursive: true, force: true });
  });

  function makeGenerated(taskId: string, extra: Partial<GeneratedEvent> = {}): GeneratedEvent {
    return {
      schemaVersion: METRICS_SCHEMA_VERSION,
      event: "generated",
      taskId,
      recordedAt: "2026-07-24T00:00:00Z",
      seedCount: 1,
      edgeCount: 0,
      displayNodeCount: 1,
      coverage: { observed: 0, notObserved: 0, unknown: 1 },
      truncation: [],
      exitCode: 0,
      artifactHashes: { card: "a", graph: "b", receipt: "c" },
      ...extra,
    };
  }

  test("all-pass: every line parses and validates", () => {
    const gen = makeGenerated("t1");
    const fb: FeedbackEvent = {
      schemaVersion: METRICS_SCHEMA_VERSION,
      event: "feedback",
      taskId: "t1",
      recordedAt: "2026-07-24T01:00:00Z",
      useful: true,
      loadReduced: false,
      issuesFound: 2,
      issuesGuidedByCard: 1,
      reviewMinutes: 10,
      notes: "ok",
    };
    writeFileSync(metricsFile(out), JSON.stringify(gen) + "\n" + JSON.stringify(fb) + "\n");
    const scan = scanMetrics(out);
    expect(scan.readable).toBe(true);
    expect(scan.querySucceeded).toBe(true);
    expect(scan.invalidLineNumbers).toEqual([]);
    expect(scan.generated).toHaveLength(1);
    expect(scan.feedback).toHaveLength(1);
  });

  test("TL-C-401 single-mutation: truncated last JSON line -> UNAVAILABLE", () => {
    writeFileSync(
      metricsFile(out),
      JSON.stringify(makeGenerated("t1")) + "\n" + '{"schemaVersion":"task-lens.metrics/v1","event":"generated","taskId":"bad',
    );
    const scan = scanMetrics(out);
    expect(scan.querySucceeded).toBe(false);
    expect(scan.invalidLineNumbers).toEqual([2]);
  });

  test("TL-C-401 summary on corrupt JSONL rejects with exit 21", async () => {
    try {
      await summarizeMetrics(out);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(MetricsError);
      if (e instanceof MetricsError) {
        expect(e.exitCode).toBe(21);
        expect(e.message).toContain("metrics unavailable");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// TL-GENERATED-v2 + TL-RECOVERY-v2
// ---------------------------------------------------------------------------

describe("TL-GENERATED-v2 / TL-RECOVERY-v2 verified generated events", () => {
  test("all-pass: artifact commit -> generated event appended once (exact rebuild)", async () => {
    const out = mkdtempSync("/tmp/tl-gen-");
    try {
      const { event, hashes } = await createCompleteTask(out, "gen-task-001");
      await appendGenerated(out, event);
      const lines = readLines(out);
      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0]!) as GeneratedEvent;
      expect(parsed.event).toBe("generated");
      expect(parsed.taskId).toBe("gen-task-001");
      // appended line must equal the exact rebuilt event
      expect(JSON.stringify(parsed)).toBe(JSON.stringify(event));
      // artifact hashes round-trip
      expect(parsed.artifactHashes).toEqual(hashes);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  test("TL-RECOVERY NOT_FOUND: missing generated event is rebuilt from artifacts", async () => {
    const out = mkdtempSync("/tmp/tl-recover-");
    try {
      const { event } = await createCompleteTask(out, "gen-task-002");
      // metrics.jsonl does not exist yet → NOT_FOUND → rebuild + append
      await appendGenerated(out, event);
      const lines = readLines(out);
      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0]!) as GeneratedEvent;
      expect(parsed.taskId).toBe("gen-task-002");
      expect(JSON.stringify(parsed)).toBe(JSON.stringify(event));
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  test("TL-RECOVERY FOUND: duplicate generated -> exit 21 conflict", async () => {
    const out = mkdtempSync("/tmp/tl-gen-dup-");
    try {
      const { event } = await createCompleteTask(out, "gen-task-003");
      await appendGenerated(out, event);
      // Second attempt: same task already has a generated event → conflict.
      try {
        await appendGenerated(out, event);
        throw new Error("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(MetricsError);
        if (e instanceof MetricsError) {
          expect(e.exitCode).toBe(21);
          expect(e.message).toContain("conflict");
        }
      }
      // metrics.jsonl must still hold exactly one generated line for this task.
      expect(readLines(out).filter((l) => JSON.parse(l).event === "generated")).toHaveLength(1);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  test("TL-RECOVERY UNAVAILABLE: corrupt metrics -> exit 21", async () => {
    const out = mkdtempSync("/tmp/tl-recover-unavail-");
    try {
      const { event } = await createCompleteTask(out, "gen-task-004");
      writeFileSync(metricsFile(out), "not-json\n");
      try {
        await appendGenerated(out, event);
        throw new Error("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(MetricsError);
        if (e instanceof MetricsError) {
          expect(e.exitCode).toBe(21);
          expect(e.message).toContain("metrics unavailable");
        }
      }
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  test("TL-C-403 single-mutation: altered artifact hash -> recovery refused exit 21", async () => {
    const out = mkdtempSync("/tmp/tl-recover-hash-");
    try {
      const { event } = await createCompleteTask(out, "gen-task-005");
      // Mutate graph.json so its hash no longer matches the caller event.
      const graphPath = join(out, "gen-task-005", "graph.json");
      const graph = JSON.parse(readFileSync(graphPath, "utf8"));
      graph.truncation = ["MAX_NODES"];
      writeFileSync(graphPath, JSON.stringify(graph), "utf8");
      try {
        await appendGenerated(out, event);
        throw new Error("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(MetricsError);
        if (e instanceof MetricsError) {
          expect(e.exitCode).toBe(21);
          expect(e.message).toContain("hash mismatch");
        }
      }
      // Nothing appended.
      expect(existsSync(metricsFile(out))).toBe(false);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  test("TL-C-407 (WSL-only): append failure leaves artifact retained — skipped on Git Bash", async () => {
    if (IS_WINDOWS) {
      // Windows Git Bash: EACCES injection semantics are not equivalent to
      // POSIX; this case is N/A-EXPLAINED on this environment (plan §10).
      return;
    }
    // On WSL this would inject an append failure and assert the artifact is
    // retained and the failure maps to exit 21.
    const out = mkdtempSync("/tmp/tl-gen-eacces-");
    try {
      const { event } = await createCompleteTask(out, "gen-task-006");
      await appendGenerated(out, event);
      const lines = readLines(out);
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0]!).taskId).toBe("gen-task-006");
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  test("generated with a mismatched caller event is refused (exit 21)", async () => {
    const out = mkdtempSync("/tmp/tl-gen-mismatch-");
    try {
      const { event } = await createCompleteTask(out, "gen-task-007");
      // Distort the caller event: different seedCount than the artifacts imply.
      const bad = { ...event, seedCount: event.seedCount + 1 };
      try {
        await appendGenerated(out, bad);
        throw new Error("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(MetricsError);
        if (e instanceof MetricsError) {
          expect(e.exitCode).toBe(21);
          expect(e.message).toContain("does not match artifacts");
        }
      }
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// TL-FEEDBACK-v2
// ---------------------------------------------------------------------------

describe("TL-FEEDBACK-v2 one feedback per task", () => {
  let out: string;

  beforeAll(async () => {
    out = mkdtempSync("/tmp/tl-fb-");
    const { event } = await createCompleteTask(out, "fb-task-001");
    await appendGenerated(out, event);
  });

  afterAll(() => {
    if (existsSync(out)) rmSync(out, { recursive: true, force: true });
  });

  function makeFeedback(taskId: string, extra: Partial<FeedbackEvent> = {}): FeedbackEvent {
    return {
      schemaVersion: METRICS_SCHEMA_VERSION,
      event: "feedback",
      taskId,
      recordedAt: "2026-07-24T02:00:00Z",
      useful: true,
      loadReduced: true,
      issuesFound: 3,
      issuesGuidedByCard: 2,
      reviewMinutes: 15,
      notes: "",
      ...extra,
    };
  }

  test("all-pass: valid feedback appended once", async () => {
    const ev = makeFeedback("fb-task-001");
    await appendFeedback(out, ev);
    const fbs = readLines(out)
      .map((l) => JSON.parse(l))
      .filter((e) => e.event === "feedback");
    expect(fbs).toHaveLength(1);
    expect(fbs[0]).toMatchObject({ taskId: "fb-task-001", useful: true, loadReduced: true });
  });

  test("TL-C-405 single-mutation: duplicate feedback -> exit 10", async () => {
    const ev = makeFeedback("fb-task-001");
    try {
      await appendFeedback(out, ev);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(MetricsError);
      if (e instanceof MetricsError) {
        expect(e.exitCode).toBe(10);
        expect(e.message).toContain("duplicate");
      }
    }
  });

  test("TL-C-404 single-mutation: issuesGuidedByCard > issuesFound -> exit 10", async () => {
    const ev = makeFeedback("fb-task-001", { issuesFound: 1, issuesGuidedByCard: 2 });
    try {
      await appendFeedback(out, ev);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(MetricsError);
      if (e instanceof MetricsError) {
        expect(e.exitCode).toBe(10);
      }
    }
  });

  test("missing task dir -> exit 10", async () => {
    const ev = makeFeedback("no-such-task", { recordedAt: "2026-07-24T03:00:00Z" });
    try {
      await appendFeedback(out, ev);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(MetricsError);
      if (e instanceof MetricsError) {
        expect(e.exitCode).toBe(10);
        expect(e.message).toContain("task dir not found");
      }
    }
  });

  test("missing generated event -> exit 10", async () => {
    const out2 = mkdtempSync("/tmp/tl-fb-nogen-");
    try {
      // Task dir exists but no generated event was ever appended.
      const { event } = await createCompleteTask(out2, "fb-task-002");
      void event;
      const ev = makeFeedback("fb-task-002");
      try {
        await appendFeedback(out2, ev);
        throw new Error("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(MetricsError);
        if (e instanceof MetricsError) {
          expect(e.exitCode).toBe(10);
          expect(e.message).toContain("no generated event");
        }
      }
    } finally {
      rmSync(out2, { recursive: true, force: true });
    }
  });

  test("feedback on corrupt metrics -> exit 21 (metrics unavailable)", async () => {
    const out2 = mkdtempSync("/tmp/tl-fb-corrupt-");
    try {
      const { event } = await createCompleteTask(out2, "fb-task-003");
      await appendGenerated(out2, event);
      appendFileSync(metricsFile(out2), "broken\n", "utf8");
      const ev = makeFeedback("fb-task-003", { recordedAt: "2026-07-24T04:00:00Z" });
      try {
        await appendFeedback(out2, ev);
        throw new Error("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(MetricsError);
        if (e instanceof MetricsError) {
          expect(e.exitCode).toBe(21);
        }
      }
    } finally {
      rmSync(out2, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// TL-SUMMARY-v2
// ---------------------------------------------------------------------------

describe("TL-SUMMARY-v2 aggregate + gate", () => {
  let out: string;

  beforeAll(() => {
    out = mkdtempSync("/tmp/tl-sum-");
  });

  afterAll(() => {
    if (existsSync(out)) rmSync(out, { recursive: true, force: true });
  });

  function gen(taskId: string, usefulAndReduced: boolean): string {
    const e: GeneratedEvent = {
      schemaVersion: METRICS_SCHEMA_VERSION,
      event: "generated",
      taskId,
      recordedAt: "2026-07-24T00:00:00Z",
      seedCount: 1,
      edgeCount: 0,
      displayNodeCount: 1,
      coverage: { observed: 0, notObserved: 0, unknown: 1 },
      truncation: [],
      exitCode: 0,
      artifactHashes: { card: "a", graph: "b", receipt: "c" },
    };
    const f: FeedbackEvent = {
      schemaVersion: METRICS_SCHEMA_VERSION,
      event: "feedback",
      taskId,
      recordedAt: "2026-07-24T01:00:00Z",
      useful: usefulAndReduced,
      loadReduced: usefulAndReduced,
      issuesFound: 1,
      issuesGuidedByCard: 0,
      reviewMinutes: 5,
      notes: "",
    };
    return JSON.stringify(e) + "\n" + JSON.stringify(f) + "\n";
  }

  test("all-pass: 10 pairs with 7 yes/yes -> PASS", async () => {
    let text = "";
    for (let i = 0; i < 10; i++) {
      text += gen(`sum-task-${i}`, i < 7);
    }
    writeFileSync(metricsFile(out), text, "utf8");
    const summary = await summarizeMetrics(out);
    expect(summary.schemaVersion).toBe("task-lens.summary/v1");
    expect(summary.generatedCount).toBe(10);
    expect(summary.feedbackCount).toBe(10);
    expect(summary.usefulAndReducedCount).toBe(7);
    expect(summary.missingFeedbackTaskIds).toEqual([]);
    expect(summary.duplicateTaskIds).toEqual([]);
    expect(summary.gate).toBe("PASS");
  });

  test("TL-C-406 single-mutation: one useful changed to no -> FAIL gate", async () => {
    let text = "";
    for (let i = 0; i < 10; i++) {
      // task 6 becomes useful=false, loadReduced=false → only 6 yes/yes.
      text += gen(`sum-task-${i}`, i < 6);
    }
    writeFileSync(metricsFile(out), text, "utf8");
    const summary = await summarizeMetrics(out);
    expect(summary.generatedCount).toBe(10);
    expect(summary.feedbackCount).toBe(10);
    expect(summary.usefulAndReducedCount).toBe(6);
    expect(summary.gate).toBe("FAIL");
  });

  test("fewer than 10 tasks -> INCOMPLETE", async () => {
    let text = "";
    for (let i = 0; i < 3; i++) {
      text += gen(`incomplete-task-${i}`, true);
    }
    writeFileSync(metricsFile(out), text, "utf8");
    const summary = await summarizeMetrics(out);
    expect(summary.gate).toBe("INCOMPLETE");
  });

  test("missing feedback for a generated task -> INCOMPLETE with missing list", async () => {
    let text = "";
    for (let i = 0; i < 10; i++) {
      text += gen(`missing-fb-${i}`, true);
    }
    const genOnly: GeneratedEvent = {
      schemaVersion: METRICS_SCHEMA_VERSION,
      event: "generated",
      taskId: "missing-fb-orphan",
      recordedAt: "2026-07-24T00:00:00Z",
      seedCount: 1,
      edgeCount: 0,
      displayNodeCount: 1,
      coverage: { observed: 0, notObserved: 0, unknown: 1 },
      truncation: [],
      exitCode: 0,
      artifactHashes: { card: "a", graph: "b", receipt: "c" },
    };
    text += JSON.stringify(genOnly) + "\n";
    writeFileSync(metricsFile(out), text, "utf8");
    const summary = await summarizeMetrics(out);
    expect(summary.gate).toBe("INCOMPLETE");
    expect(summary.missingFeedbackTaskIds).toEqual(["missing-fb-orphan"]);
  });

  test("duplicate events -> UNAVAILABLE exit 21", async () => {
    let text = "";
    for (let i = 0; i < 10; i++) {
      text += gen(`dup-task-${i}`, true);
    }
    text += gen("dup-task-0", true); // duplicate generated+feedback pair
    writeFileSync(metricsFile(out), text, "utf8");
    try {
      await summarizeMetrics(out);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(MetricsError);
      if (e instanceof MetricsError) {
        expect(e.exitCode).toBe(21);
        expect(e.message).toContain("duplicate");
      }
    }
  });
});
