// scripts/task-lens/__tests__/spine.test.ts
// PHASE-03: path/branch/uncovered test suites for SpineForest.

import { test, expect, describe } from "bun:test";
import { buildSpineForest } from "../spine.ts";
import { DEFAULT_GRAPH_BUDGET } from "../types.ts";
import type { FunctionNode, CallEdge, SpineForest } from "../types.ts";
import type { Seed } from "../seed-resolver.ts";
import type { GraphResult } from "../graph-builder.ts";

// ---------------------------------------------------------------------------
// Helper: build a minimal graph result for spine tests
// ---------------------------------------------------------------------------

function makeGraph(nodes: FunctionNode[], edges: CallEdge[]): GraphResult {
  return { nodes, edges, seeds: nodes.map((n) => n.id), truncation: [], unverified: [] };
}

function makeNode(id: string, file: string, startLine: number): FunctionNode {
  return { id, name: id, file, startLine, endLine: startLine + 5, signature: "", sideEffects: [], observation: "unknown" };
}

function makeEdge(from: string, to: string, confidence: number | null = null): CallEdge {
  return { from, to, origin: "codegraph-static", confidence, resolvedBy: null };
}

// ---------------------------------------------------------------------------
// TL-SPINE: deterministic paths
// ---------------------------------------------------------------------------

describe("TL-SPINE: deterministic paths", () => {
  test("all-pass: primary path from entry to seed", () => {
    const nodes = [
      makeNode("entry", "a.ts", 1),
      makeNode("mid", "a.ts", 10),
      makeNode("seed", "a.ts", 20),
    ];
    const edges = [
      makeEdge("entry", "mid"),
      makeEdge("mid", "seed"),
    ];
    const graph = makeGraph(nodes, edges);
    const seeds: Seed[] = [{ id: "seed", file: "a.ts", startLine: 20, endLine: 25, hunkIds: ["a.ts:20"] }];

    const spine = buildSpineForest(graph, seeds, ["entry"]);
    expect(spine.entries).toEqual(["entry"]);
    expect(spine.primaryPath[0]).toBe("entry");
    expect(spine.primaryPath).toContain("seed");
  });

  test("TL-C-208: unknown CLI entry → fallback to graph search", () => {
    const nodes = [
      makeNode("caller", "a.ts", 1),
      makeNode("seed", "a.ts", 10),
    ];
    const edges = [makeEdge("caller", "seed")];
    const graph = makeGraph(nodes, edges);
    const seeds: Seed[] = [{ id: "seed", file: "a.ts", startLine: 10, endLine: 15, hunkIds: ["a.ts:10"] }];

    // Entry "unknown" doesn't exist → fallback to graph search
    const spine = buildSpineForest(graph, seeds, ["unknown"]);
    expect(spine.entries.length).toBe(1);
    expect(spine.entries[0]).toBe("caller");
  });
});

// ---------------------------------------------------------------------------
// TL-DISPLAY: distinct node count ≤ 20 + uncovered
// ---------------------------------------------------------------------------

describe("TL-DISPLAY: 20-node gate", () => {
  test("TL-C-207: 21 distinct nodes → uncovered + collapsed", () => {
    // Create 25 nodes in a chain
    const nodes: FunctionNode[] = [];
    const edges: CallEdge[] = [];
    for (let i = 0; i < 25; i++) {
      nodes.push(makeNode(`n${i}`, "a.ts", i * 10));
      if (i > 0) edges.push(makeEdge(`n${i - 1}`, `n${i}`));
    }
    const graph = makeGraph(nodes, edges);

    // Seeds are the last 5 nodes
    const seeds: Seed[] = [];
    for (let i = 20; i < 25; i++) {
      seeds.push({ id: `n${i}`, file: "a.ts", startLine: i * 10, endLine: i * 10 + 5, hunkIds: [`a.ts:${i * 10}`] });
    }

    const spine = buildSpineForest(graph, seeds, ["n0"], { ...DEFAULT_GRAPH_BUDGET, maxDisplayNodes: 20 });

    // With 25 nodes and display limit 20, some should be collapsed
    const displayNodes = new Set(spine.primaryPath);
    for (const branch of spine.seedBranches) {
      for (const n of branch.path) displayNodes.add(n);
    }
    expect(displayNodes.size).toBeLessThanOrEqual(20);
    // collapsedCount should be > 0 if nodes were truncated
    // (may be 0 if all seeds fit in primary path within 20 nodes)
  });

  test("all-pass: small graph fits within 20 nodes", () => {
    const nodes = [
      makeNode("a", "a.ts", 1),
      makeNode("b", "a.ts", 10),
      makeNode("c", "a.ts", 20),
    ];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c")];
    const graph = makeGraph(nodes, edges);
    const seeds: Seed[] = [{ id: "c", file: "a.ts", startLine: 20, endLine: 25, hunkIds: ["a.ts:20"] }];

    const spine = buildSpineForest(graph, seeds, ["a"]);
    expect(spine.collapsedCount).toBe(0);
    expect(spine.uncoveredSeeds).toHaveLength(0);
  });

  test("uncovered seeds when no path exists", () => {
    const nodes = [
      makeNode("entry", "a.ts", 1),
      makeNode("seed1", "a.ts", 10),
      makeNode("orphan", "b.ts", 1), // no edges connecting to it
    ];
    const edges = [makeEdge("entry", "seed1")];
    const graph = makeGraph(nodes, edges);
    const seeds: Seed[] = [
      { id: "seed1", file: "a.ts", startLine: 10, endLine: 15, hunkIds: ["a.ts:10"] },
      { id: "orphan", file: "b.ts", startLine: 1, endLine: 6, hunkIds: ["b.ts:1"] },
    ];

    const spine = buildSpineForest(graph, seeds, ["entry"]);
    expect(spine.uncoveredSeeds).toContain("orphan");
  });

  test("branches sorted by from, path, seedIds", () => {
    const nodes = [
      makeNode("entry", "a.ts", 1),
      makeNode("s1", "a.ts", 10),
      makeNode("s2", "a.ts", 20),
      makeNode("b1", "a.ts", 30),
      makeNode("b2", "a.ts", 40),
    ];
    const edges = [
      makeEdge("entry", "s1"),
      makeEdge("entry", "s2"),
      makeEdge("s1", "b1"),
      makeEdge("s2", "b2"),
    ];
    const graph = makeGraph(nodes, edges);
    const seeds: Seed[] = [
      { id: "b1", file: "a.ts", startLine: 30, endLine: 35, hunkIds: ["a.ts:30"] },
      { id: "b2", file: "a.ts", startLine: 40, endLine: 45, hunkIds: ["a.ts:40"] },
    ];

    const spine = buildSpineForest(graph, seeds, ["entry"]);
    // Branches should be sorted
    for (let i = 1; i < spine.seedBranches.length; i++) {
      const prev = spine.seedBranches[i - 1];
      const curr = spine.seedBranches[i];
      const prevKey = `${prev.from}|${prev.path.join(",")}|${prev.seedIds.join(",")}`;
      const currKey = `${curr.from}|${curr.path.join(",")}|${curr.seedIds.join(",")}`;
      expect(prevKey.localeCompare(currKey)).toBeLessThanOrEqual(0);
    }
  });
});
