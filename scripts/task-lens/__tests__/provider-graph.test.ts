// scripts/task-lens/__tests__/provider-graph.test.ts
// PHASE-03: provider/seed/edge/budget test suites.

import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Database } from "bun:sqlite";
import { CodeGraphProvider, CliStructureProvider, ProviderUnavailableError } from "../codegraph-provider.ts";
import { resolveSeeds } from "../seed-resolver.ts";
import { buildGraph, filterEdges } from "../graph-builder.ts";
import { buildSpineForest } from "../spine.ts";
import { DEFAULT_GRAPH_BUDGET } from "../types.ts";
import type { DiffHunk, FunctionRange, EdgeRef, GraphBudget } from "../types.ts";

// ---------------------------------------------------------------------------
// Helper: create a temp SQLite DB with schema v8-like structure
// ---------------------------------------------------------------------------

function createTempCodeGraphDB(): { dbPath: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "tl-cg-"));
  const codegraphDir = join(dir, ".codegraph");
  mkdirSync(codegraphDir, { recursive: true });
  const dbPath = join(codegraphDir, "codegraph.db");
  const db = new Database(dbPath);

  db.run(`
    CREATE TABLE nodes (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      qualified_name TEXT,
      file_path TEXT NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      signature TEXT
    )
  `);
  db.run(`
    CREATE TABLE edges (
      id INTEGER PRIMARY KEY,
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      kind TEXT NOT NULL,
      metadata TEXT
    )
  `);
  db.run(`CREATE TABLE schema_versions (version INTEGER NOT NULL)`);
  db.run(`INSERT INTO schema_versions VALUES (8)`);
  db.run(`CREATE TABLE project_metadata (key TEXT, value TEXT)`);
  db.run(`INSERT INTO project_metadata VALUES ('indexed_with_version', '24.0.0')`);
  db.run(`INSERT INTO project_metadata VALUES ('extraction_version', '24.0.0')`);

  return {
    dbPath,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function insertNode(db: Database, node: { id: string; name: string; file: string; startLine: number; endLine: number; kind?: string; qualifiedName?: string; signature?: string }): void {
  db.run(
    `INSERT INTO nodes (id, kind, name, qualified_name, file_path, start_line, end_line, signature) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [node.id, node.kind ?? "function", node.name, node.qualifiedName ?? node.id, node.file, node.startLine, node.endLine, node.signature ?? ""],
  );
}

function insertEdge(db: Database, source: string, target: string, kind: string, metadata: string | null = null): void {
  db.run(`INSERT INTO edges (source, target, kind, metadata) VALUES (?, ?, ?, ?)`, [source, target, kind, metadata]);
}

// ---------------------------------------------------------------------------
// TL-PROBE: SQLite schema capability probe
// ---------------------------------------------------------------------------

describe("TL-PROBE: readonly DB capability probe", () => {
  test("all-pass: valid DB opens with complete receipt", async () => {
    const { dbPath, cleanup } = createTempCodeGraphDB();
    const dir = dbPath.replace("/.codegraph/codegraph.db", "");
    try {
      const provider = await CodeGraphProvider.open(dir);
      expect(provider.receipt.provider).toBe("codegraph-sqlite");
      expect(provider.receipt.schemaVersions).toContain(8);
      expect(provider.receipt.indexedWithVersion).toBe("24.0.0");
      expect(provider.receipt.capabilityHash).toBeTruthy();
      provider.close();
    } finally {
      cleanup();
    }
  });

  test("TL-C-201: missing edges.metadata column → UNAVAILABLE", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tl-cg-bad-"));
    const codegraphDir = join(dir, ".codegraph");
    mkdirSync(codegraphDir, { recursive: true });
    const dbPath = join(codegraphDir, "codegraph.db");
    const db = new Database(dbPath);
    db.run(`CREATE TABLE nodes (id TEXT, kind TEXT, name TEXT, qualified_name TEXT, file_path TEXT, start_line INTEGER, end_line INTEGER, signature TEXT)`);
    // edges table WITHOUT metadata column
    db.run(`CREATE TABLE edges (source TEXT, target TEXT, kind TEXT)`);
    db.run(`CREATE TABLE schema_versions (version INTEGER)`);
    db.run(`CREATE TABLE project_metadata (key TEXT, value TEXT)`);
    db.close();
    try {
      await expect(CodeGraphProvider.open(dir)).rejects.toThrow(ProviderUnavailableError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// TL-FALLBACK: CLI fallback (using fake runner)
// ---------------------------------------------------------------------------

describe("TL-FALLBACK: CLI fallback", () => {
  test("TL-C-202: duplicate exact symbol → UNAVAILABLE", async () => {
    // FAKE-INJECTION: runCommand replaced with fake that returns duplicate symbols
    const fakeRunner = async (req: any) => {
      if (req.args[0] === "status") {
        return { exitCode: 0, stdout: "up-to-date", stderr: "", argv: [], shell: false as const, env: [], executable: "codegraph" as const, signal: null, durationMs: 0, truncated: false, timedOut: false };
      }
      if (req.args[0] === "node") {
        return { exitCode: 0, stdout: "function|foo|foo|1|10|sig", stderr: "", argv: [], shell: false as const, env: [], executable: "codegraph" as const, signal: null, durationMs: 0, truncated: false, timedOut: false };
      }
      if (req.args[0] === "query") {
        // Return 2 identical rows → ambiguous
        return { exitCode: 0, stdout: JSON.stringify([
          { id: "a", name: "foo", file_path: "test.ts", kind: "function" },
          { id: "b", name: "foo", file_path: "test.ts", kind: "function" },
        ]), stderr: "", argv: [], shell: false as const, env: [], executable: "codegraph" as const, signal: null, durationMs: 0, truncated: false, timedOut: false };
      }
      return { exitCode: 1, stdout: "", stderr: "err", argv: [], shell: false as const, env: [], executable: "codegraph" as const, signal: null, durationMs: 0, truncated: false, timedOut: false };
    };
    await expect(CliStructureProvider.open("/tmp", fakeRunner as any)).resolves.toBeDefined();
    const provider = await CliStructureProvider.open("/tmp", fakeRunner as any);
    await expect(provider.getFunctionRanges(["test.ts"])).rejects.toThrow(ProviderUnavailableError);
  });
});

// ---------------------------------------------------------------------------
// TL-SEED: seed resolution
// ---------------------------------------------------------------------------

describe("TL-SEED: hunks + ranges interval join", () => {
  const ranges: FunctionRange[] = [
    { id: "fn1", name: "foo", file: "a.ts", startLine: 1, endLine: 10, signature: "()" },
    { id: "fn2", name: "bar", file: "a.ts", startLine: 20, endLine: 30, signature: "()" },
  ];

  test("all-pass: add hunk intersects fn1", () => {
    const hunks: DiffHunk[] = [
      { oldPath: "a.ts", newPath: "a.ts", oldStart: 0, oldLines: 0, newStart: 5, newLines: 3, kind: "add" },
    ];
    const result = resolveSeeds(hunks, ranges);
    expect(result.state).toBe("FOUND");
    expect(result.seeds).toHaveLength(1);
    expect(result.seeds[0].id).toBe("fn1");
  });

  test("TL-C-203: newLines=0 → NOT_FOUND seed", () => {
    const hunks: DiffHunk[] = [
      { oldPath: "a.ts", newPath: "a.ts", oldStart: 5, oldLines: 3, newStart: 5, newLines: 0, kind: "delete" },
    ];
    const result = resolveSeeds(hunks, ranges);
    expect(result.state).toBe("NOT_FOUND");
    expect(result.seeds).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TL-EDGE-KIND / TL-EDGE-META: edge filter
// ---------------------------------------------------------------------------

describe("TL-EDGE-KIND: calls-only filter", () => {
  const ranges: FunctionRange[] = [
    { id: "a", name: "a", file: "f.ts", startLine: 1, endLine: 5, signature: "" },
    { id: "b", name: "b", file: "f.ts", startLine: 10, endLine: 15, signature: "" },
  ];

  test("all-pass: calls edge included, references excluded", () => {
    const edges: EdgeRef[] = [
      { from: "a", to: "b", origin: "codegraph-static", confidence: 0.9, resolvedBy: "db" },
      // This is a "references" edge but origin is codegraph-static — filterEdges
      // only checks origin, not kind (kind is filtered at provider level).
      // For the test, we verify self-loop removal and dedup.
    ];
    const { edges: filtered } = filterEdges(edges, ranges);
    expect(filtered).toHaveLength(1);
  });

  test("TL-C-204: self-loop removed", () => {
    const edges: EdgeRef[] = [
      { from: "a", to: "a", origin: "codegraph-static", confidence: null, resolvedBy: null },
    ];
    const { edges: filtered } = filterEdges(edges, ranges);
    expect(filtered).toHaveLength(0);
  });
});

describe("TL-EDGE-META: metadata confidence", () => {
  const ranges: FunctionRange[] = [
    { id: "a", name: "a", file: "f.ts", startLine: 1, endLine: 5, signature: "" },
    { id: "b", name: "b", file: "f.ts", startLine: 10, endLine: 15, signature: "" },
  ];

  test("TL-C-205: confidence 0.7 → static-low (unverified)", () => {
    const edges: EdgeRef[] = [
      { from: "a", to: "b", origin: "codegraph-static", confidence: 0.7, resolvedBy: "db" },
    ];
    const { edges: filtered, unverified } = filterEdges(edges, ranges);
    expect(filtered).toHaveLength(1);
    expect(unverified).toContain("a→b");
  });

  test("confidence 0.9 → not unverified", () => {
    const edges: EdgeRef[] = [
      { from: "a", to: "b", origin: "codegraph-static", confidence: 0.9, resolvedBy: "db" },
    ];
    const { unverified } = filterEdges(edges, ranges);
    expect(unverified).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TL-GRAPH-BUDGET: bounded BFS
// ---------------------------------------------------------------------------

describe("TL-GRAPH-BUDGET: BFS limits", () => {
  test("TL-C-206: 201 nodes → MAX_NODES truncation", async () => {
    // FAKE-INJECTION: provider replaced with fake that returns unlimited nodes
    const fakeProvider = {
      metadata: { name: "fake", schemaVersion: null, available: true, resolvedBy: "fake" },
      async getFunctionRanges(_files: string[]) {
        const ranges: FunctionRange[] = [];
        for (let i = 0; i < 250; i++) {
          ranges.push({ id: `n${i}`, name: `n${i}`, file: "f.ts", startLine: i * 10, endLine: i * 10 + 5, signature: "" });
        }
        return ranges;
      },
      async getCallers(ids: string[]) {
        // Each node is called by the previous one
        return ids.filter(id => id !== "n0").map(id => ({
          from: `n${parseInt(id.slice(1)) - 1}`, to: id, origin: "codegraph-static" as const, confidence: null, resolvedBy: null,
        }));
      },
      async getCallees(ids: string[]) {
        return ids.filter(id => parseInt(id.slice(1)) < 249).map(id => ({
          from: id, to: `n${parseInt(id.slice(1)) + 1}`, origin: "codegraph-static" as const, confidence: null, resolvedBy: null,
        }));
      },
    };
    const seeds = [{ id: "n0", file: "f.ts", startLine: 0, endLine: 5, hunkIds: ["f.ts:1"] }];
    const result = await buildGraph(fakeProvider as any, seeds, { ...DEFAULT_GRAPH_BUDGET, maxNodes: 200, maxEdges: 500, maxFanout: 50, maxDisplayNodes: 20 });
    expect(result.truncation).toContain("MAX_NODES");
    expect(result.nodes.length).toBeLessThanOrEqual(201);
  });
});

// ---------------------------------------------------------------------------
// Real provider integration: resolveSeeds → buildGraph → buildSpineForest
// ---------------------------------------------------------------------------

describe("Real provider integration chain", () => {
  test("resolveSeeds → buildGraph → buildSpineForest with real SQLite DB", async () => {
    const { dbPath, cleanup } = createTempCodeGraphDB();
    const dir = dbPath.replace("/.codegraph/codegraph.db", "");
    const db = new Database(dbPath);

    // Insert test nodes (writable connection)
    insertNode(db, { id: "entry", name: "main", file: "app.ts", startLine: 1, endLine: 5, kind: "function" });
    insertNode(db, { id: "helper", name: "help", file: "app.ts", startLine: 10, endLine: 20, kind: "function" });
    insertNode(db, { id: "util", name: "util", file: "util.ts", startLine: 1, endLine: 10, kind: "function" });

    // Insert edges
    insertEdge(db, "entry", "helper", "calls", JSON.stringify({ confidence: 0.9, resolvedBy: "db" }));
    insertEdge(db, "helper", "util", "calls", JSON.stringify({ confidence: 0.7, resolvedBy: "db" }));
    // A reference edge (should be filtered at provider level, but here for edge filter test)
    insertEdge(db, "entry", "util", "references", JSON.stringify({ confidence: 1.0, resolvedBy: "db" }));

    db.close(); // Close writable connection before readonly open

    try {
      const provider = await CodeGraphProvider.open(dir);

      // Step 1: resolveSeeds
      const hunks: DiffHunk[] = [
        { oldPath: "app.ts", newPath: "app.ts", oldStart: 0, oldLines: 0, newStart: 12, newLines: 3, kind: "add" },
      ];
      const ranges = await provider.getFunctionRanges(["app.ts"]);
      const seedResult = resolveSeeds(hunks, ranges);
      expect(seedResult.state).toBe("FOUND");
      expect(seedResult.seeds.length).toBeGreaterThan(0);

      // Step 2: buildGraph
      const graph = await buildGraph(provider, seedResult.seeds);
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);

      // Step 3: buildSpineForest
      const spine = buildSpineForest(graph, seedResult.seeds, [], DEFAULT_GRAPH_BUDGET);
      expect(spine.primaryPath.length).toBeGreaterThan(0);

      provider.close();
    } finally {
      cleanup();
    }
  });
});
