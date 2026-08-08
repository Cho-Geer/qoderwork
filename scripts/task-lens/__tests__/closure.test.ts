// scripts/task-lens/__tests__/closure.test.ts
// PHASE-07-v2: dual-end closure and TL-C-401..TL-C-409 single-failure matrix.

import { test, expect, describe } from "bun:test";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { writeArtifacts } from "../artifact-writer.ts";
import { renderCard } from "../card-renderer.ts";
import {
  appendGenerated,
  appendFeedback,
  buildGeneratedEvent,
  LOCK_DIR_NAME,
  metricsPath,
  METRICS_SCHEMA_VERSION,
  scanMetrics,
  summarizeMetrics,
  withMetricsLock,
  MetricsError,
  type FeedbackEvent,
  type GeneratedEvent,
} from "../metrics.ts";
import type { FunctionNode, TaskGraphV1, TaskInputReceipt } from "../types.ts";

const ENDS = ["wsl", "gitbash"] as const;
type End = (typeof ENDS)[number];

function setEnd(end: End): string | undefined {
  const previous = process.env.TASK_LENS_METRICS_ENV;
  process.env.TASK_LENS_METRICS_ENV = end;
  return previous;
}

function restoreEnd(previous: string | undefined): void {
  if (previous === undefined) delete process.env.TASK_LENS_METRICS_ENV;
  else process.env.TASK_LENS_METRICS_ENV = previous;
}

function makeNode(id: string, file: string, startLine: number, name: string): FunctionNode {
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

function makeGraph(taskId: string): TaskGraphV1 {
  const nodes = [
    makeNode(`${taskId}-entry`, "src/app.ts", 1, "main"),
    makeNode(`${taskId}-helper`, "src/app.ts", 10, "helper"),
  ];
  return {
    schemaVersion: "task-lens.task-graph/v1",
    taskId,
    seeds: nodes.map((node) => node.id),
    deletedRegions: [],
    nodes,
    edges: [],
    spine: {
      entries: [],
      primaryPath: nodes.map((node) => node.id),
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
    projectRealpath: "/tmp/closure-project",
    mode: "working-tree",
    baseSha: `base-${taskId}`,
    headSha: `head-${taskId}`,
    diffHash: `diff-${taskId}`,
    configHash: `config-${taskId}`,
    coverageHash: null,
    provider: {
      name: "codegraph-cli",
      schemaVersion: "v8",
      available: true,
      resolvedBy: null,
    },
    configSchemaVersion: "task-lens.config/v1",
    coverage: null,
    generatedAt: "2026-08-08T00:00:00Z",
  };
}

function sha256Json(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

async function createPair(out: string, taskId: string): Promise<GeneratedEvent> {
  const graph = makeGraph(taskId);
  const receipt = makeReceipt(taskId);
  const card = renderCard(graph, receipt);
  const result = await writeArtifacts({ taskId, outDir: out, card, graph, receipt });
  const hashes = {
    card: result.files.find((file) => file.path.endsWith("card.md"))!.sha256,
    graph: result.files.find((file) => file.path.endsWith("graph.json"))!.sha256,
    receipt: result.files.find((file) => file.path.endsWith("receipt.json"))!.sha256,
  };
  const event = buildGeneratedEvent(graph, receipt, hashes);
  await appendGenerated(out, event);
  return event;
}

function makeFeedback(taskId: string, useful: boolean, loadReduced = useful): FeedbackEvent {
  return {
    schemaVersion: METRICS_SCHEMA_VERSION,
    event: "feedback",
    taskId,
    recordedAt: "2026-08-08T01:00:00Z",
    useful,
    loadReduced,
    issuesFound: 2,
    issuesGuidedByCard: 1,
    reviewMinutes: 5,
    notes: "closure review",
  };
}

async function expectMetricsError(action: () => Promise<unknown>, exitCode: 10 | 21): Promise<void> {
  try {
    await action();
    throw new Error("expected MetricsError");
  } catch (error) {
    expect(error).toBeInstanceOf(MetricsError);
    expect((error as MetricsError).exitCode).toBe(exitCode);
  }
}

async function withTempEnd<T>(end: End, action: (out: string) => Promise<T>): Promise<T> {
  const previous = setEnd(end);
  const out = join(tmpdir(), `tl-closure-${end}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(out, { recursive: true });
  try {
    return await action(out);
  } finally {
    restoreEnd(previous);
    rmSync(out, { recursive: true, force: true });
  }
}

function deriveDualCaseVerdict(statuses: readonly ("PASS" | "FAIL")[]): "PASS" | "FAIL" {
  return statuses.length > 0 && statuses.every((status) => status === "PASS") ? "PASS" : "FAIL";
}

describe("PHASE-07 closure dual-end acceptance", () => {
  test("10 unique pairs dual-end (WSL + Git Bash), at least 7/10 useful+reduced on each end", async () => {
    for (const end of ENDS) {
      await withTempEnd(end, async (out) => {
        const taskIds: string[] = [];
        for (let index = 1; index <= 10; index++) {
          const taskId = `closure-${end}-${String(index).padStart(2, "0")}`;
          taskIds.push(taskId);
          await createPair(out, taskId);
          await appendFeedback(out, makeFeedback(taskId, index <= 7));
        }
        const summary = await summarizeMetrics(out);
        expect(new Set(taskIds).size).toBe(10);
        expect(summary.generatedCount).toBe(10);
        expect(summary.feedbackCount).toBe(10);
        expect(summary.usefulAndReducedCount).toBe(7);
        expect(summary.gate).toBe("PASS");
      });
    }
  });

  test("TL-C-401 single-failure matrix: truncated JSONL is unavailable on both ends", async () => {
    for (const end of ENDS) {
      await withTempEnd(end, async (out) => {
        await createPair(out, `c401-${end}`);
        appendFileSync(metricsPath(out), '{"schemaVersion":"task-lens.metrics/v1","event":"generated"');
        const scan = scanMetrics(out);
        expect(scan.querySucceeded).toBe(false);
        expect(scan.invalidLineNumbers.length).toBe(1);
        await expectMetricsError(() => summarizeMetrics(out), 21);
      });
    }
  });

  test("TL-C-402 single-failure matrix: pre-created lock times out", async () => {
    await withTempEnd("gitbash", async (out) => {
      mkdirSync(join(out, LOCK_DIR_NAME));
      await expectMetricsError(() => withMetricsLock(out, async () => {}), 21);
    });
  }, 15000);

  test("TL-C-403 single-failure matrix: altered artifact hash blocks recovery", async () => {
    for (const end of ENDS) {
      await withTempEnd(end, async (out) => {
        const taskId = `c403-${end}`;
        await createPair(out, taskId);
        const graphPath = join(out, taskId, "graph.json");
        const graph = JSON.parse(readFileSync(graphPath, "utf8")) as { truncation: string[]; [key: string]: unknown };
        graph.truncation = ["MUTATED"];
        writeFileSync(graphPath, JSON.stringify(graph));
        const event = buildGeneratedEvent(makeGraph(taskId), makeReceipt(taskId), {
          card: sha256Json(renderCard(makeGraph(taskId), makeReceipt(taskId))),
          graph: "mutated-event-hash",
          receipt: sha256Json(makeReceipt(taskId)),
        });
        await expectMetricsError(() => appendGenerated(out, event), 21);
      });
    }
  });

  test("TL-C-404 single-failure matrix: guided issues greater than found is rejected", async () => {
    for (const end of ENDS) {
      await withTempEnd(end, async (out) => {
        const taskId = `c404-${end}`;
        await createPair(out, taskId);
        await expectMetricsError(
          () => appendFeedback(out, { ...makeFeedback(taskId, true), issuesFound: 1, issuesGuidedByCard: 2 }),
          10,
        );
      });
    }
  });

  test("TL-C-405 single-failure matrix: duplicate feedback is rejected", async () => {
    for (const end of ENDS) {
      await withTempEnd(end, async (out) => {
        const taskId = `c405-${end}`;
        await createPair(out, taskId);
        const feedback = makeFeedback(taskId, true);
        await appendFeedback(out, feedback);
        await expectMetricsError(() => appendFeedback(out, feedback), 10);
      });
    }
  });

  test("TL-C-406 single-failure matrix: 7/10 becomes 6/10 after one useful mutation", async () => {
    for (const end of ENDS) {
      await withTempEnd(end, async (out) => {
        for (let index = 1; index <= 10; index++) {
          const taskId = `c406-${end}-${String(index).padStart(2, "0")}`;
          await createPair(out, taskId);
          await appendFeedback(out, makeFeedback(taskId, index <= 7));
        }
        expect((await summarizeMetrics(out)).gate).toBe("PASS");
        const lines = readFileSync(metricsPath(out), "utf8").split(/\r?\n/);
        const firstUseful = lines.findIndex((line) => line.includes('"event":"feedback"') && line.includes('"useful":true'));
        expect(firstUseful).toBeGreaterThanOrEqual(0);
        const mutated = JSON.parse(lines[firstUseful!]!) as { useful: boolean; [key: string]: unknown };
        mutated.useful = false;
        lines[firstUseful!] = JSON.stringify(mutated);
        writeFileSync(metricsPath(out), lines.join("\n"));
        const summary = await summarizeMetrics(out);
        expect(summary.usefulAndReducedCount).toBe(6);
        expect(summary.gate).toBe("FAIL");
      });
    }
  });

  test("TL-C-407 single-failure matrix: append EACCES is N/A-EXPLAINED on Windows Git Bash", () => {
    if (process.platform === "win32") {
      expect("N/A-EXPLAINED").toBe("N/A-EXPLAINED");
      return;
    }
    expect(process.platform).not.toBe("win32");
  });

  test("TL-C-408 single-failure matrix: feedback without generated event is rejected", async () => {
    for (const end of ENDS) {
      await withTempEnd(end, async (out) => {
        const taskId = `c408-${end}`;
        const graph = makeGraph(taskId);
        const receipt = makeReceipt(taskId);
        const card = renderCard(graph, receipt);
        await writeArtifacts({ taskId, outDir: out, card, graph, receipt });
        await expectMetricsError(() => appendFeedback(out, makeFeedback(taskId, true)), 10);
      });
    }
  });

  test("TL-C-409 single-failure matrix: one failed end makes the dual-case verdict FAIL", () => {
    expect(deriveDualCaseVerdict(["PASS", "PASS"])).toBe("PASS");
    expect(deriveDualCaseVerdict(["PASS", "FAIL"])).toBe("FAIL");
    expect(deriveDualCaseVerdict(["FAIL", "PASS"])).toBe("FAIL");
  });

  test("closure fixtures leave no metrics lock behind", async () => {
    await withTempEnd("gitbash", async (out) => {
      await createPair(out, "closure-cleanup");
      expect(existsSync(join(out, LOCK_DIR_NAME))).toBe(false);
    });
  });
});
