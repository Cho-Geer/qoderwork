// scripts/task-lens/__tests__/coverage-render.test.ts
// PHASE-04: coverage lcov parsing, side-effects detection, and card rendering tests.

import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { readCoverage, type CoverageBinding } from "../coverage-reader.ts";
import { detectSideEffects } from "../side-effects.ts";
import { renderCard } from "../card-renderer.ts";
import type { FunctionNode, TaskGraphV1, TaskInputReceipt } from "../types.ts";
import { DEFAULT_GRAPH_BUDGET } from "../types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function makeNode(
  id: string,
  file: string,
  startLine: number,
  endLine: number,
  name: string,
): FunctionNode {
  return {
    id,
    name,
    file,
    startLine,
    endLine,
    signature: `${name}()`,
    sideEffects: [],
    observation: "unknown",
  };
}

function makeGraph(
  nodes: FunctionNode[],
  edges: { from: string; to: string; confidence?: number | null }[] = [],
  extra: Partial<TaskGraphV1> = {},
): TaskGraphV1 {
  const callEdges = edges.map((e) => ({
    from: e.from,
    to: e.to,
    origin: "codegraph-static" as const,
    confidence: e.confidence ?? null,
    resolvedBy: null as string | null,
  }));
  return {
    schemaVersion: "task-lens.task-graph/v1",
    taskId: "test-task-id",
    seeds: nodes.map((n) => n.id),
    deletedRegions: [],
    nodes,
    edges: callEdges,
    spine: {
      entries: [],
      primaryPath: nodes.map((n) => n.id),
      seedBranches: [],
      uncoveredSeeds: [],
      collapsedCount: 0,
    },
    truncation: [],
    unverified: [],
    ...extra,
  };
}

function makeReceipt(overrides: Partial<TaskInputReceipt> = {}): TaskInputReceipt {
  return {
    schemaVersion: "task-lens.input/v1",
    taskId: "test-task-id",
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// TL-COV-FN: FN/FNDA parsing
// ---------------------------------------------------------------------------

describe("TL-COV-FN: FN/FNDA coverage parsing", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync("/tmp/task-lens-cov-");
  });

  afterAll(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  test("positive: observed function with FNDA count > 0", async () => {
    // lcov resolves relative SF paths from the lcov file's directory
    const targetFile = join(tmpDir, "app.ts");
    writeFileSync(targetFile, "export function foo() { return 1; }\n", "utf8");

    const lcovContent = [
      "TN:",
      `SF:app.ts`,
      "FN:1,foo",
      "FNDA:5,foo",
      "end_of_record",
    ].join("\n");
    const lcovPath = join(tmpDir, "coverage.lcov");
    writeFileSync(lcovPath, lcovContent, "utf8");

    const lcovSha = sha256Hex(lcovContent);

    // Write companion
    const companion = {
      schemaVersion: "task-lens.coverage/v1",
      producer: "bun test",
      targetHeadSha: "HEAD",
      diffHash: "DH",
      lcovSha256: lcovSha,
    };
    writeFileSync(lcovPath + ".task-lens.json", JSON.stringify(companion), "utf8");

    const binding: CoverageBinding = {
      producer: "bun test",
      fileSha256: lcovSha,
      mtimeMs: 0,
      targetHeadSha: "HEAD",
      diffHash: "DH",
      proofState: "ALIGNED",
    };

    const nodes = [makeNode("n1", "app.ts", 1, 5, "foo")];
    const result = await readCoverage(lcovPath, binding, nodes);

    expect(result.alignment).toBe("ALIGNED");
    const key = `${nodes[0].file}:${nodes[0].name}:${nodes[0].startLine}:${nodes[0].endLine}`;
    expect(result.observations.get(key)).toBe("observed");
  });

  test("not-observed: FNDA count = 0", async () => {
    const targetFile = join(tmpDir, "app.ts");
    writeFileSync(targetFile, "export function bar() { return 1; }\n", "utf8");

    const lcovContent = [
      "TN:",
      `SF:app.ts`,
      "FN:1,bar",
      "FNDA:0,bar",
      "end_of_record",
    ].join("\n");
    const lcovPath = join(tmpDir, "coverage2.lcov");
    writeFileSync(lcovPath, lcovContent, "utf8");

    const lcovSha = sha256Hex(lcovContent);
    const companion = {
      schemaVersion: "task-lens.coverage/v1",
      producer: null,
      targetHeadSha: "HEAD",
      diffHash: "DH2",
      lcovSha256: lcovSha,
    };
    writeFileSync(lcovPath + ".task-lens.json", JSON.stringify(companion), "utf8");

    const binding: CoverageBinding = {
      producer: null,
      fileSha256: lcovSha,
      mtimeMs: 0,
      targetHeadSha: "HEAD",
      diffHash: "DH2",
      proofState: "ALIGNED",
    };

    const nodes = [makeNode("n2", "app.ts", 1, 5, "bar")];
    const result = await readCoverage(lcovPath, binding, nodes);

    expect(result.alignment).toBe("ALIGNED");
    const key = `${nodes[0].file}:${nodes[0].name}:${nodes[0].startLine}:${nodes[0].endLine}`;
    expect(result.observations.get(key)).toBe("not-observed");
  });

  // TL-C-301: duplicate FN (same name, different lines) → unknown
  test("TL-C-301: duplicate FN same name different lines → unknown", async () => {
    const targetFile = join(tmpDir, "app.ts");
    writeFileSync(targetFile, "function baz() {}\nfunction baz() {}\n", "utf8");

    const lcovContent = [
      "TN:",
      `SF:app.ts`,
      "FN:1,baz",
      "FN:2,baz",         // same name at different line → duplicate
      "FNDA:3,baz",
      "end_of_record",
    ].join("\n");
    const lcovPath = join(tmpDir, "coverage3.lcov");
    writeFileSync(lcovPath, lcovContent, "utf8");

    const lcovSha = sha256Hex(lcovContent);
    const companion = {
      schemaVersion: "task-lens.coverage/v1",
      producer: null,
      targetHeadSha: "HEAD",
      diffHash: "DH3",
      lcovSha256: lcovSha,
    };
    writeFileSync(lcovPath + ".task-lens.json", JSON.stringify(companion), "utf8");

    const binding: CoverageBinding = {
      producer: null,
      fileSha256: lcovSha,
      mtimeMs: 0,
      targetHeadSha: "HEAD",
      diffHash: "DH3",
      proofState: "ALIGNED",
    };

    const nodes = [makeNode("n3", "app.ts", 1, 10, "baz")];
    const result = await readCoverage(lcovPath, binding, nodes);

    const key = `${nodes[0].file}:${nodes[0].name}:${nodes[0].startLine}:${nodes[0].endLine}`;
    expect(result.observations.get(key)).toBe("unknown");
    expect(result.checks.some((c) => c.includes("DUPLICATE"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TL-COV-DA: DA line-level coverage fallback
// ---------------------------------------------------------------------------

describe("TL-COV-DA: DA line-level coverage fallback", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync("/tmp/task-lens-da-");
  });

  afterAll(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  test("observed: DA with count > 0 in function range", async () => {
    const lcovContent = [
      "TN:",
      `SF:mod.ts`,
      "DA:1,1",   // line 1, count 1 → >0
      "DA:2,0",
      "DA:3,2",
      "end_of_record",
    ].join("\n");
    const lcovPath = join(tmpDir, "coverage-da.lcov");
    writeFileSync(lcovPath, lcovContent, "utf8");

    const lcovSha = sha256Hex(lcovContent);
    const companion = {
      schemaVersion: "task-lens.coverage/v1",
      producer: null,
      targetHeadSha: "HEAD",
      diffHash: "DH-DA",
      lcovSha256: lcovSha,
    };
    writeFileSync(lcovPath + ".task-lens.json", JSON.stringify(companion), "utf8");

    const binding: CoverageBinding = {
      producer: null,
      fileSha256: lcovSha,
      mtimeMs: 0,
      targetHeadSha: "HEAD",
      diffHash: "DH-DA",
      proofState: "ALIGNED",
    };

    const nodes = [makeNode("n-da", "mod.ts", 1, 3, "modFn")];
    const result = await readCoverage(lcovPath, binding, nodes);

    const key = `${nodes[0].file}:${nodes[0].name}:${nodes[0].startLine}:${nodes[0].endLine}`;
    expect(result.observations.get(key)).toBe("observed");
    expect(result.alignment).toBe("ALIGNED");
  });

  test("not-observed: all DA counts = 0 in function range", async () => {
    // TL-C-302: all DA counts set to 0 → not-observed
    const lcovContent = [
      "TN:",
      `SF:empty.ts`,
      "DA:1,0",
      "DA:2,0",
      "DA:3,0",
      "end_of_record",
    ].join("\n");
    const lcovPath = join(tmpDir, "coverage-da-zero.lcov");
    writeFileSync(lcovPath, lcovContent, "utf8");

    const lcovSha = sha256Hex(lcovContent);
    const companion = {
      schemaVersion: "task-lens.coverage/v1",
      producer: null,
      targetHeadSha: "HEAD",
      diffHash: "DH-DA0",
      lcovSha256: lcovSha,
    };
    writeFileSync(lcovPath + ".task-lens.json", JSON.stringify(companion), "utf8");

    const binding: CoverageBinding = {
      producer: null,
      fileSha256: lcovSha,
      mtimeMs: 0,
      targetHeadSha: "HEAD",
      diffHash: "DH-DA0",
      proofState: "ALIGNED",
    };

    const nodes = [makeNode("n-da0", "empty.ts", 1, 3, "emptyFn")];
    const result = await readCoverage(lcovPath, binding, nodes);

    const key = `${nodes[0].file}:${nodes[0].name}:${nodes[0].startLine}:${nodes[0].endLine}`;
    expect(result.observations.get(key)).toBe("not-observed");
  });

  test("unknown: no DA in function range", async () => {
    const lcovContent = [
      "TN:",
      `SF:mod.ts`,
      "DA:10,5",   // line outside function [1-3]
      "end_of_record",
    ].join("\n");
    const lcovPath = join(tmpDir, "coverage-da-none.lcov");
    writeFileSync(lcovPath, lcovContent, "utf8");

    const lcovSha = sha256Hex(lcovContent);
    const companion = {
      schemaVersion: "task-lens.coverage/v1",
      producer: null,
      targetHeadSha: "HEAD",
      diffHash: "DH-DAN",
      lcovSha256: lcovSha,
    };
    writeFileSync(lcovPath + ".task-lens.json", JSON.stringify(companion), "utf8");

    const binding: CoverageBinding = {
      producer: null,
      fileSha256: lcovSha,
      mtimeMs: 0,
      targetHeadSha: "HEAD",
      diffHash: "DH-DAN",
      proofState: "ALIGNED",
    };

    const nodes = [makeNode("n-dan", "mod.ts", 1, 3, "uncoveredFn")];
    const result = await readCoverage(lcovPath, binding, nodes);

    const key = `${nodes[0].file}:${nodes[0].name}:${nodes[0].startLine}:${nodes[0].endLine}`;
    expect(result.observations.get(key)).toBe("unknown");
    expect(result.checks.some((c) => c === "COVERAGE_NO_DATA")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TL-COV-BIND: companion binding
// ---------------------------------------------------------------------------

describe("TL-COV-BIND: companion binding validation", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync("/tmp/task-lens-bind-");
  });

  afterAll(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  test("TL-C-303: diffHash mismatch → COVERAGE_UNALIGNED, all unknown", async () => {
    const lcovContent = ["TN:", `SF:src/app.ts`, "FN:1,foo", "FNDA:5,foo", "end_of_record"].join("\n");
    const lcovPath = join(tmpDir, "coverage-bind.lcov");
    writeFileSync(lcovPath, lcovContent, "utf8");

    const lcovSha = sha256Hex(lcovContent);

    // Companion with DIFFERENT diffHash
    const companion = {
      schemaVersion: "task-lens.coverage/v1",
      producer: null,
      targetHeadSha: "HEAD",
      diffHash: "WRONG-DIFF-HASH",
      lcovSha256: lcovSha,
    };
    writeFileSync(lcovPath + ".task-lens.json", JSON.stringify(companion), "utf8");

    const binding: CoverageBinding = {
      producer: null,
      fileSha256: lcovSha,
      mtimeMs: 0,
      targetHeadSha: "HEAD",
      diffHash: "CORRECT-DIFF-HASH", // mismatched
      proofState: "ALIGNED", // Binding itself claims alignment, but companion will disprove
    };

    const nodes = [makeNode("n-bind", "src/app.ts", 1, 5, "foo")];
    const result = await readCoverage(lcovPath, binding, nodes);

    expect(result.alignment).toBe("UNVERIFIED");
    expect(result.unverified).toContain("COVERAGE_COMPANION_DIFF_MISMATCH");
    const key = `${nodes[0].file}:${nodes[0].name}:${nodes[0].startLine}:${nodes[0].endLine}`;
    expect(result.observations.get(key)).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// TL-EFFECT: side-effect detection
// ---------------------------------------------------------------------------

describe("TL-EFFECT: side-effect detection", () => {
  test("detects builtin DB token", () => {
    const source = `import { Database } from "bun:sqlite"; const db = new Database(":memory:");`;
    const config = { schemaVersion: "task-lens.config/v1" as const, entries: [], sideEffectTokens: [] };
    const results = detectSideEffects(source, config);
    const dbEffects = results.filter((r) => r.kind === "DB");
    expect(dbEffects.length).toBe(1);
    expect(dbEffects[0].token).toBe("bun:sqlite");
    expect(dbEffects[0].source).toBe("builtin");
    expect(dbEffects[0].heuristic).toBe(true);
  });

  test("detects multiple builtin types", () => {
    const source = `
      import fs from "node:fs";
      const res = await fetch("https://example.com");
      const p = Bun.spawn(["ls"]);
      console.log(process.env.HOME);
    `;
    const config = { schemaVersion: "task-lens.config/v1" as const, entries: [], sideEffectTokens: [] };
    const results = detectSideEffects(source, config);

    const kinds = results.map((r) => r.kind);
    expect(kinds).toContain("FS");
    expect(kinds).toContain("NET");
    expect(kinds).toContain("PROC");
    // verify specific tokens
    expect(results.some((r) => r.token === "node:fs")).toBe(true);
    expect(results.some((r) => r.token === "fetch(")).toBe(true);
    expect(results.some((r) => r.token === "Bun.spawn(")).toBe(true);
    expect(results.some((r) => r.token === "process.env")).toBe(true);
  });

  test("detects config-side tokens", () => {
    const source = `import { custom } from "my-lib";`;
    const config = {
      schemaVersion: "task-lens.config/v1" as const,
      entries: [],
      sideEffectTokens: [{ kind: "NET" as const, token: "my-lib" }],
    };
    const results = detectSideEffects(source, config);
    const cfgEffects = results.filter((r) => r.source === "config");
    expect(cfgEffects.length).toBe(1);
    expect(cfgEffects[0].token).toBe("my-lib");
    expect(cfgEffects[0].kind).toBe("NET");
  });

  // TL-C-304: remove a token → effect absent
  test("TL-C-304: source without fetch token → no NET fetch effect", () => {
    const source = `const x = 1 + 1; return x;`;
    const config = { schemaVersion: "task-lens.config/v1" as const, entries: [], sideEffectTokens: [] };
    const results = detectSideEffects(source, config);
    const netEffects = results.filter((r) => r.kind === "NET");
    expect(netEffects.length).toBe(0);  // no fetch( or Bun.serve(
  });

  test("deduplicates identical tokens", () => {
    const source = `import fs from "node:fs"; import fs2 from "node:fs";`;
    const config = { schemaVersion: "task-lens.config/v1" as const, entries: [], sideEffectTokens: [] };
    const results = detectSideEffects(source, config);
    const fsEffects = results.filter((r) => r.token === "node:fs");
    expect(fsEffects.length).toBe(1);  // deduplicated
  });
});

// ---------------------------------------------------------------------------
// TL-CARD: card rendering
// ---------------------------------------------------------------------------

describe("TL-CARD: card rendering", () => {
  test("card has all five required Chinese headings", () => {
    const node = makeNode("n1", "src/app.ts", 1, 10, "myFunc");
    const graph = makeGraph([node]);
    const receipt = makeReceipt();
    const card = renderCard(graph, receipt);

    expect(card).toContain("## 一、主干路径");
    expect(card).toContain("## 二、变更函数表");
    expect(card).toContain("## 三、副作用表");
    expect(card).toContain("## 四、证据");
    expect(card).toContain("## 五、反馈区");
  });

  test("function row contains location, signature, observation", () => {
    const node: FunctionNode = {
      id: "n1",
      name: "myFunc",
      file: "src/app.ts",
      startLine: 10,
      endLine: 25,
      signature: "myFunc(): string",
      sideEffects: [],
      observation: "observed",
    };
    const graph = makeGraph([node]);
    const receipt = makeReceipt();
    const card = renderCard(graph, receipt);

    // Check section 二 content
    expect(card).toContain("src/app.ts:10-25");
    expect(card).toContain("myFunc(): string");
    expect(card).toContain("observed");
  });

  test("low confidence node (< 0.8) has static-low label", () => {
    const node = makeNode("n1", "src/app.ts", 1, 5, "lowFunc");
    const graph = makeGraph([node], [{ from: "n1", to: "n1", confidence: 0.6 }]);
    const receipt = makeReceipt();
    const card = renderCard(graph, receipt);

    expect(card).toContain("static-low");
  });

  test("uncovered seeds appear in section 三", () => {
    const node = makeNode("n1", "src/app.ts", 1, 5, "f1");
    const graph = makeGraph([node], [], {
      spine: {
        entries: [],
        primaryPath: [node.id],
        seedBranches: [],
        uncoveredSeeds: ["uncovered-seed-1", "uncovered-seed-2"],
        collapsedCount: 0,
      },
    });
    const receipt = makeReceipt();
    const card = renderCard(graph, receipt);

    expect(card).toContain("uncovered-seed-1");
    expect(card).toContain("uncovered-seed-2");
  });

  // TL-C-305: card still generates with empty graph (degraded but not failing)
  test("TL-C-305: empty graph generates card with placeholder text", () => {
    const graph = makeGraph([], []);
    const receipt = makeReceipt();
    const card = renderCard(graph, receipt);

    // Still has all five headings
    expect(card).toContain("## 一、主干路径");
    expect(card).toContain("## 二、变更函数表");
    expect(card).toContain("## 三、副作用表");
    expect(card).toContain("## 四、证据");
    expect(card).toContain("## 五、反馈区");
  });
});
