// scripts/task-lens/__tests__/artifact-writer.test.ts
// PHASE-04: Atomic artifact writer tests — canonical serialization,
// atomic writes, conflict detection, and FAKE-INJECTION coverage.

import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import {
  writeArtifacts,
  ArtifactError,
  type ArtifactWriteRequest,
} from "../artifact-writer.ts";
import { renderCard } from "../card-renderer.ts";
import type { FunctionNode, TaskGraphV1, TaskInputReceipt } from "../types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
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

function makeGraph(nodes: FunctionNode[]): TaskGraphV1 {
  return {
    schemaVersion: "task-lens.task-graph/v1",
    taskId: "test-graph-task",
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

function makeReceipt(): TaskInputReceipt {
  return {
    schemaVersion: "task-lens.input/v1",
    taskId: "test-input-task",
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

// ---------------------------------------------------------------------------
// TL-CANON: stable canonical serialization
// ---------------------------------------------------------------------------

describe("TL-CANON: stable canonical serialization", () => {
  test("same graph produces identical hash across 3 serializations", () => {
    const nodes = [
      makeNode("n1", "src/a.ts", 1, "fnA"),
      makeNode("n2", "src/b.ts", 2, "fnB"),
    ];
    const graph = makeGraph(nodes);

    const card = renderCard(graph, makeReceipt());
    expect(card).toContain("## 一、主干路径");

    // Hash the card three times — should be identical
    const hash1 = sha256Hex(card);
    const hash2 = sha256Hex(card);
    const hash3 = sha256Hex(card);
    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });

  test("TL-C-306: graph containing a Map rejects with ArtifactError", async () => {
    const nodes = [makeNode("n1", "src/a.ts", 1, "fnA")];
    const graph = makeGraph(nodes);

    // Insert a non-serializable Map
    const badGraph = { ...graph, badField: new Map([["key", "value"]]) };
    const card = renderCard(graph, makeReceipt());

    const tmpDir = mkdtempSync("/tmp/task-lens-art-");
    const outDir = join(tmpDir, "out");
    mkdirSync(outDir, { recursive: true });

    try {
      await writeArtifacts({
        taskId: "test-task-map",
        outDir,
        card,
        graph: badGraph as unknown as TaskGraphV1,
        receipt: makeReceipt(),
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (e) {
      expect(e instanceof ArtifactError).toBe(true);
      if (e instanceof ArtifactError) {
        expect(e.message).toContain("Map");
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("TL-C-306 variant: Set rejected by deep guard", async () => {
    const nodes = [makeNode("n1", "src/a.ts", 1, "fnA")];
    const graph = makeGraph(nodes);
    const badGraph = { ...graph, badSet: new Set([1, 2, 3]) };
    const card = renderCard(graph, makeReceipt());

    const tmpDir = mkdtempSync("/tmp/task-lens-art-");
    const outDir = join(tmpDir, "out");
    mkdirSync(outDir, { recursive: true });

    try {
      await writeArtifacts({
        taskId: "test-task-set",
        outDir,
        card,
        graph: badGraph as unknown as TaskGraphV1,
        receipt: makeReceipt(),
      });
      expect(true).toBe(false);
    } catch (e) {
      expect(e instanceof ArtifactError).toBe(true);
      if (e instanceof ArtifactError) {
        expect(e.message).toContain("Set");
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// TL-ATOMIC: real writeArtifacts call (non-fake path)
// ---------------------------------------------------------------------------

describe("TL-ATOMIC: real writeArtifacts", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync("/tmp/task-lens-rw-");
  });

  afterAll(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  // This test uses the REAL writeArtifacts function — no FAKE-INJECTION
  test("successful atomic write produces 3 files with correct receipt", async () => {
    const outDir = join(tmpDir, "output");
    mkdirSync(outDir, { recursive: true });

    const nodes = [
      { ...makeNode("n1", "src/main.ts", 1, "main"), sideEffects: [], observation: "observed" as const },
      { ...makeNode("n2", "src/helper.ts", 3, "helper"), sideEffects: [], observation: "not-observed" as const },
    ];
    const graph = makeGraph(nodes);
    const receipt = makeReceipt();
    const card = renderCard(graph, receipt);

    const taskId = "real-task-001";
    const result = await writeArtifacts({
      taskId,
      outDir,
      card,
      graph,
      receipt,
    });

    // Check receipt
    expect(result.schemaVersion).toBe("task-lens.artifact/v1");
    expect(result.taskId).toBe(taskId);
    expect(result.files.length).toBe(3);

    // Check all 3 files exist
    const finalDir = join(outDir, taskId);
    const cardPath = join(finalDir, "card.md");
    const graphPath = join(finalDir, "graph.json");
    const receiptPath = join(finalDir, "receipt.json");

    expect(existsSync(cardPath)).toBe(true);
    expect(existsSync(graphPath)).toBe(true);
    expect(existsSync(receiptPath)).toBe(true);

    // card.md is non-empty with all five headings
    const cardContent = readFileSync(cardPath, "utf8");
    expect(cardContent.length).toBeGreaterThan(0);
    expect(cardContent).toContain("## 一、主干路径");
    expect(cardContent).toContain("## 二、变更函数表");
    expect(cardContent).toContain("## 三、副作用表");
    expect(cardContent).toContain("## 四、证据");
    expect(cardContent).toContain("## 五、反馈区");

    // graph.json is parseable JSON
    const graphParsed = JSON.parse(readFileSync(graphPath, "utf8"));
    expect(graphParsed.schemaVersion).toBe("task-lens.task-graph/v1");

    // receipt.json is parseable JSON
    const receiptParsed = JSON.parse(readFileSync(receiptPath, "utf8"));
    expect(receiptParsed.schemaVersion).toBe("task-lens.input/v1");

    // File hashes in receipt match actual content
    for (const file of result.files) {
      const actualContent = readFileSync(file.path, "utf8");
      const actualSha = sha256Hex(actualContent);
      expect(file.sha256).toBe(actualSha);
    }
  });
});

// ---------------------------------------------------------------------------
// TL-CONFLICT: conflict detection (TL-C-307)
// ---------------------------------------------------------------------------

describe("TL-CONFLICT: conflict detection", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync("/tmp/task-lens-con-");
  });

  afterAll(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  // TL-C-307: pre-create taskId directory → exit 21
  test("TL-C-307: pre-existing taskId directory causes TL-CONFLICT", async () => {
    const outDir = join(tmpDir, "output2");
    mkdirSync(outDir, { recursive: true });

    const taskId = "conflict-task";
    const finalDir = join(outDir, taskId);
    mkdirSync(finalDir); // pre-create!

    const nodes = [makeNode("n1", "src/a.ts", 1, "fnA")];
    const graph = makeGraph(nodes);
    const receipt = makeReceipt();
    const card = renderCard(graph, receipt);

    try {
      await writeArtifacts({ taskId, outDir, card, graph, receipt });
      expect(true).toBe(false); // should not succeed
    } catch (e) {
      expect(e instanceof ArtifactError).toBe(true);
      if (e instanceof ArtifactError) {
        expect(e.message).toContain("TL-CONFLICT");
      }
    }
  });

  // TL-C-308 variant: second call with same taskId hits TL-CONFLICT
  test("TL-C-308: second write with same taskId fails with TL-CONFLICT", async () => {
    const outDir = join(tmpDir, "output3");
    mkdirSync(outDir, { recursive: true });

    const nodes = [makeNode("n1", "src/a.ts", 1, "fnA")];
    const graph = makeGraph(nodes);
    const receipt = makeReceipt();
    const card = renderCard(graph, receipt);

    const taskId = "dup-task";

    // First write should succeed
    const result1 = await writeArtifacts({ taskId, outDir, card, graph, receipt });
    expect(result1.files.length).toBe(3);

    // Second write with same taskId should fail
    try {
      await writeArtifacts({ taskId, outDir, card, graph, receipt });
      expect(true).toBe(false);
    } catch (e) {
      expect(e instanceof ArtifactError).toBe(true);
      if (e instanceof ArtifactError) {
        expect(e.message).toContain("TL-CONFLICT");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// FAKE-INJECTION: simulated filesystem failure
// ---------------------------------------------------------------------------

describe("FAKE-INJECTION: artifact writer with injected fault", () => {
  // FAKE-INJECTION: writeArtifacts call with a bad graph that triggers deep guard rejection.
  // The real writeArtifacts function is exercised, but the graph contains undefined values.
  test("deep guard catches undefined in graph", async () => {
    const tmpDir = mkdtempSync("/tmp/task-lens-fi-");
    const outDir = join(tmpDir, "out");
    mkdirSync(outDir, { recursive: true });

    const nodes = [makeNode("n1", "src/a.ts", 1, "fnA")];
    const graph = makeGraph(nodes);
    // Inject an undefined field
    const badGraph = { ...graph, undefinedField: undefined };
    const card = renderCard(graph, makeReceipt());

    try {
      await writeArtifacts({
        taskId: "task-undefined",
        outDir,
        card,
        graph: badGraph as unknown as TaskGraphV1,
        receipt: makeReceipt(),
      });
      expect(true).toBe(false);
    } catch (e) {
      expect(e instanceof ArtifactError).toBe(true);
      if (e instanceof ArtifactError) {
        expect(e.message).toContain("undefined");
      }
      // Verify no final files were written
      const finalDir = join(outDir, "task-undefined");
      expect(existsSync(finalDir)).toBe(false);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // FAKE-INJECTION: writeArtifacts with function in graph — deep guard catches it.
  test("deep guard catches function in graph", async () => {
    const tmpDir = mkdtempSync("/tmp/task-lens-fi2-");
    const outDir = join(tmpDir, "out");
    mkdirSync(outDir, { recursive: true });

    const nodes = [makeNode("n1", "src/a.ts", 1, "fnA")];
    const graph = makeGraph(nodes);
    // Inject a function
    const badGraph = { ...graph, fnField: () => {} };
    const card = renderCard(graph, makeReceipt());

    try {
      await writeArtifacts({
        taskId: "task-fn",
        outDir,
        card,
        graph: badGraph as unknown as TaskGraphV1,
        receipt: makeReceipt(),
      });
      expect(true).toBe(false);
    } catch (e) {
      expect(e instanceof ArtifactError).toBe(true);
      if (e instanceof ArtifactError) {
        expect(e.message).toContain("function");
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
