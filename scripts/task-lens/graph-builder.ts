// scripts/task-lens/graph-builder.ts
// PHASE-03: buildGraph + filterEdges — calls-only bounded bidirectional BFS.

import type {
  FunctionRange,
  EdgeRef,
  CallEdge,
  GraphBudget,
  FunctionNode,
  Observation,
  SideEffect,
} from "./types.ts";
import { DEFAULT_GRAPH_BUDGET } from "./types.ts";
import type { StructureProvider } from "./codegraph-provider.ts";
import type { Seed } from "./seed-resolver.ts";

export interface GraphResult {
  readonly nodes: readonly FunctionNode[];
  readonly edges: readonly CallEdge[];
  readonly seeds: readonly string[];
  readonly truncation: readonly string[];
  readonly unverified: readonly string[];
}

/**
 * Filter edges with fixed order:
 * 1. kind calls only
 * 2. endpoint kinds (function/method)
 * 3. target file/range present
 * 4. remove self-loop
 * 5. stable dedup (from, to)
 * 6. metadata label: confidence < 0.8 = static-low
 */
export function filterEdges(
  edges: readonly EdgeRef[],
  ranges: readonly FunctionRange[],
): { edges: CallEdge[]; unverified: string[] } {
  const rangeMap = new Map<string, FunctionRange>();
  for (const r of ranges) rangeMap.set(r.id, r);

  const seen = new Set<string>();
  const filtered: CallEdge[] = [];
  const unverified: string[] = [];

  for (const edge of edges) {
    // 1. kind calls only (already filtered by provider, but double-check)
    if (edge.origin !== "codegraph-static") continue;

    // 3. target file/range present
    if (!rangeMap.has(edge.from) || !rangeMap.has(edge.to)) {
      unverified.push(`${edge.from}→${edge.to}`);
      continue;
    }

    // 4. remove self-loop
    if (edge.from === edge.to) continue;

    // 5. stable dedup (from, to)
    const key = `${edge.from}→${edge.to}`;
    if (seen.has(key)) continue;
    seen.add(key);

    filtered.push({
      from: edge.from,
      to: edge.to,
      origin: edge.origin,
      confidence: edge.confidence,
      resolvedBy: edge.resolvedBy,
    });

    // 6. metadata label: confidence < 0.8 = static-low (tracked in unverified)
    if (edge.confidence !== null && edge.confidence < 0.8) {
      unverified.push(key);
    }
  }

  return { edges: filtered, unverified };
}

/**
 * Build a bounded graph using bidirectional BFS from seeds.
 * - Per-node candidate edges sorted by to/from file, startLine, id.
 * - Fanout truncated at budget.maxFanout first, then global budget.
 * - Each truncation writes literal MAX_FANOUT / MAX_NODES / MAX_EDGES.
 */
export async function buildGraph(
  provider: StructureProvider,
  seeds: readonly Seed[],
  budget: GraphBudget = DEFAULT_GRAPH_BUDGET,
): Promise<GraphResult> {
  const seedIds = seeds.map((s) => s.id);
  if (seedIds.length === 0) {
    return { nodes: [], edges: [], seeds: [], truncation: [], unverified: [] };
  }

  // Collect all ranges for the seed files
  const seedFiles = [...new Set(seeds.map((s) => s.file))];
  const allRanges = await provider.getFunctionRanges(seedFiles);

  // BFS: collect nodes and edges
  const visited = new Set<string>();
  const allEdges: EdgeRef[] = [];
  const truncation: string[] = [];
  const queue: string[] = [...seedIds];

  // Track fanout per node
  const fanoutCount = new Map<string, number>();

  while (queue.length > 0 && visited.size < budget.maxNodes) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // Check global node budget
    if (visited.size > budget.maxNodes) {
      if (!truncation.includes("MAX_NODES")) truncation.push("MAX_NODES");
      break;
    }

    // Get callers and callees
    const [callers, callees] = await Promise.all([
      provider.getCallers([currentId], budget),
      provider.getCallees([currentId], budget),
    ]);

    // Sort candidate edges by to/from file, startLine, id
    const rangeMap = new Map(allRanges.map((r) => [r.id, r]));
    const sortEdges = (edges: EdgeRef[], isCaller: boolean): EdgeRef[] => {
      return [...edges].sort((a, b) => {
        const aId = isCaller ? a.from : a.to;
        const bId = isCaller ? b.from : b.to;
        const aRange = rangeMap.get(aId);
        const bRange = rangeMap.get(bId);
        if (aRange && bRange) {
          if (aRange.file !== bRange.file) return aRange.file.localeCompare(bRange.file);
          if (aRange.startLine !== bRange.startLine) return aRange.startLine - bRange.startLine;
        }
        return aId.localeCompare(bId);
      });
    };

    const sortedCallers = sortEdges(callers, true);
    const sortedCallees = sortEdges(callees, false);

    // Fanout truncation
    const currentFanout = (fanoutCount.get(currentId) ?? 0) + sortedCallers.length + sortedCallees.length;
    let callerEdges = sortedCallers;
    let calleeEdges = sortedCallees;

    if (currentFanout > budget.maxFanout) {
      const total = sortedCallers.length + sortedCallees.length;
      const excess = total - budget.maxFanout;
      // Truncate from the end of callees first, then callers
      if (calleeEdges.length > excess) {
        calleeEdges = calleeEdges.slice(0, calleeEdges.length - excess);
      } else {
        const remaining = excess - calleeEdges.length;
        calleeEdges = [];
        callerEdges = callerEdges.slice(0, callerEdges.length - remaining);
      }
      if (!truncation.includes("MAX_FANOUT")) truncation.push("MAX_FANOUT");
    }

    fanoutCount.set(currentId, callerEdges.length + calleeEdges.length);

    for (const edge of [...callerEdges, ...calleeEdges]) {
      if (allEdges.length >= budget.maxEdges) {
        if (!truncation.includes("MAX_EDGES")) truncation.push("MAX_EDGES");
        break;
      }
      allEdges.push(edge);
      // Enqueue unvisited endpoints
      if (!visited.has(edge.from)) queue.push(edge.from);
      if (!visited.has(edge.to)) queue.push(edge.to);
    }

    if (allEdges.length >= budget.maxEdges) break;
  }

  // Check node budget again after BFS
  if (visited.size >= budget.maxNodes) {
    if (!truncation.includes("MAX_NODES")) truncation.push("MAX_NODES");
  }

  // Filter edges and build nodes
  const { edges: filteredEdges, unverified } = filterEdges(allEdges, allRanges);

  // Collect all node IDs from visited + edges
  const nodeIds = new Set<string>(visited);
  for (const e of filteredEdges) {
    nodeIds.add(e.from);
    nodeIds.add(e.to);
  }

  // Build FunctionNode for each node
  const rangeMap = new Map(allRanges.map((r) => [r.id, r]));
  const nodes: FunctionNode[] = [];
  for (const id of nodeIds) {
    const range = rangeMap.get(id);
    if (!range) continue;
    nodes.push({
      ...range,
      sideEffects: [] as SideEffect[],
      observation: "unknown" as Observation,
    });
  }

  // Sort nodes by file, startLine, id
  nodes.sort((a, b) =>
    a.file === b.file
      ? a.startLine === b.startLine
        ? a.id.localeCompare(b.id)
        : a.startLine - b.startLine
      : a.file.localeCompare(b.file),
  );

  return {
    nodes,
    edges: filteredEdges,
    seeds: seedIds,
    truncation: [...new Set(truncation)].sort(),
    unverified: [...new Set(unverified)].sort(),
  };
}
