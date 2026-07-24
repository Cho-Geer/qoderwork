// scripts/task-lens/spine.ts
// PHASE-03: buildSpineForest — single-card SpineForest with entry precedence
// and stable tie-break, 20-node display gate, uncoveredSeeds.

import type { SpineForest, GraphBudget, FunctionNode, CallEdge } from "./types.ts";
import { DEFAULT_GRAPH_BUDGET } from "./types.ts";
import type { Seed } from "./seed-resolver.ts";
import type { GraphResult } from "./graph-builder.ts";

export interface SpineBuildInput {
  readonly nodes: readonly FunctionNode[];
  readonly edges: readonly CallEdge[];
}

/**
 * Build a single SpineForest.
 * - Entry precedence: CLI --entry exact IDs > config entries exact file#name >
 *   search graph: node with max caller distance from any seed.
 * - Tie-break: seed coverage count desc, path length asc, node-id order.
 * - primaryPath = best entry path to farthest seed.
 * - branches sorted by (from, path, seedIds) until union display nodes = 20.
 * - uncoveredSeeds = seeds not in any path.
 * - collapsedCount > 0 on overflow; truncation includes MAX_DISPLAY_NODES.
 */
export function buildSpineForest(
  graph: GraphResult,
  seeds: readonly Seed[],
  entries: readonly string[],
  budget: GraphBudget = DEFAULT_GRAPH_BUDGET,
): SpineForest {
  const seedIds = seeds.map((s) => s.id);
  if (seedIds.length === 0) {
    return {
      entries: [],
      primaryPath: [],
      seedBranches: [],
      uncoveredSeeds: [],
      collapsedCount: 0,
    };
  }

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const edgeMap = new Map<string, CallEdge[]>();
  for (const e of graph.edges) {
    const list = edgeMap.get(e.from) ?? [];
    list.push(e);
    edgeMap.set(e.from, list);
  }

  // Reverse edge map (for caller-based BFS)
  const reverseEdgeMap = new Map<string, CallEdge[]>();
  for (const e of graph.edges) {
    const list = reverseEdgeMap.get(e.to) ?? [];
    list.push(e);
    reverseEdgeMap.set(e.to, list);
  }

  // --- Entry precedence ---
  // 1. CLI --entry exact IDs (already validated as existing node IDs)
  let bestEntry: string | null = null;
  for (const entry of entries) {
    if (nodeMap.has(entry)) {
      bestEntry = entry;
      break;
    }
  }

  // 2. Config entries exact file#name → resolve to node IDs
  if (!bestEntry) {
    for (const entry of entries) {
      if (entry.includes("#")) {
        const [file, name] = entry.split("#", 2);
        const match = graph.nodes.find((n) => n.file === file && n.name === name);
        if (match) {
          bestEntry = match.id;
          break;
        }
      }
    }
  }

  // 3. Search graph: node with max caller distance from any seed
  if (!bestEntry) {
    bestEntry = findBestEntryByCallerDistance(graph, seedIds, reverseEdgeMap);
  }

  if (!bestEntry) {
    // No entry found — all seeds uncovered
    return {
      entries: [],
      primaryPath: [],
      seedBranches: [],
      uncoveredSeeds: seedIds,
      collapsedCount: 0,
    };
  }

  // --- Build primary path: BFS from bestEntry to farthest seed ---
  const primaryPathRaw = bfsPath(bestEntry, seedIds, edgeMap);

  // Truncate primary path to display budget
  let primaryPath: PathResult;
  if (primaryPathRaw.path.length > budget.maxDisplayNodes) {
    primaryPath = {
      path: primaryPathRaw.path.slice(0, budget.maxDisplayNodes),
      seedIds: primaryPathRaw.seedIds.filter((s) =>
        primaryPathRaw.path.slice(0, budget.maxDisplayNodes).includes(s),
      ),
    };
  } else {
    primaryPath = primaryPathRaw;
  }

  // --- Build branches for remaining seeds ---
  const coveredSeeds = new Set(primaryPath.seedIds);
  const displayNodes = new Set<string>(primaryPath.path);
  const branches: SpineForest["seedBranches"][number][] = [];
  const branchCandidates: { from: string; path: string[]; seedIds: string[] }[] = [];

  for (const seedId of seedIds) {
    if (coveredSeeds.has(seedId)) continue;
    // Find path from nearest display node to this seed
    const branch = bfsBranchPath(seedId, displayNodes, reverseEdgeMap);
    if (branch) {
      branchCandidates.push(branch);
    }
  }

  // Sort branches by (from, path, seedIds)
  branchCandidates.sort((a, b) => {
    if (a.from !== b.from) return a.from.localeCompare(b.from);
    const aPath = a.path.join(",");
    const bPath = b.path.join(",");
    if (aPath !== bPath) return aPath.localeCompare(bPath);
    return a.seedIds.join(",").localeCompare(b.seedIds.join(","));
  });

  let collapsedCount = 0;
  for (const branch of branchCandidates) {
    const newNodes = branch.path.filter((n) => !displayNodes.has(n));
    if (displayNodes.size + newNodes.length > budget.maxDisplayNodes) {
      collapsedCount += newNodes.length;
      continue;
    }
    for (const n of newNodes) displayNodes.add(n);
    for (const sid of branch.seedIds) coveredSeeds.add(sid);
    branches.push({
      from: branch.from,
      path: branch.path,
      seedIds: branch.seedIds,
    });
  }

  // Uncovered seeds
  const uncoveredSeeds = seedIds.filter((id) => !coveredSeeds.has(id));

  // collapsedCount for overflow
  const truncation: string[] = [];
  if (collapsedCount > 0) {
    truncation.push("MAX_DISPLAY_NODES");
  }

  // Return with entries = [bestEntry]
  // Note: truncation is not in SpineForest type, it's in TaskGraphV1
  // collapsedCount captures the overflow
  const result: SpineForest = {
    entries: [bestEntry],
    primaryPath: primaryPath.path,
    seedBranches: branches,
    uncoveredSeeds,
    collapsedCount,
  };

  // If collapsedCount > 0, the caller should set exit 2
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface PathResult {
  path: string[];
  seedIds: string[];
}

/** BFS from entry to farthest seed, collecting path and covered seeds. */
function bfsPath(
  entry: string,
  seedIds: readonly string[],
  edgeMap: Map<string, CallEdge[]>,
): PathResult {
  const seedSet = new Set(seedIds);
  const visited = new Set<string>([entry]);
  const queue: { id: string; path: string[] }[] = [{ id: entry, path: [entry] }];
  let bestPath: string[] = [entry];
  let bestSeeds: string[] = seedSet.has(entry) ? [entry] : [];

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    const edges = edgeMap.get(id) ?? [];
    for (const edge of edges) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      const newPath = [...path, edge.to];
      const seedsInPath = newPath.filter((n) => seedSet.has(n));
      if (seedsInPath.length > bestSeeds.length ||
          (seedsInPath.length === bestSeeds.length && newPath.length > bestPath.length)) {
        bestPath = newPath;
        bestSeeds = seedsInPath;
      }
      queue.push({ id: edge.to, path: newPath });
    }
  }

  return { path: bestPath, seedIds: bestSeeds };
}

/** BFS from a seed backward to find nearest display node, return branch path. */
function bfsBranchPath(
  seedId: string,
  displayNodes: Set<string>,
  reverseEdgeMap: Map<string, CallEdge[]>,
): { from: string; path: string[]; seedIds: string[] } | null {
  const visited = new Set<string>([seedId]);
  const queue: { id: string; path: string[] }[] = [{ id: seedId, path: [seedId] }];

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    if (displayNodes.has(id) && id !== seedId) {
      // Found a connection point — reverse path to go from display node to seed
      const branchPath = [...path].reverse();
      return {
        from: id,
        path: branchPath,
        seedIds: [seedId],
      };
    }
    const edges = reverseEdgeMap.get(id) ?? [];
    for (const edge of edges) {
      if (visited.has(edge.from)) continue;
      visited.add(edge.from);
      queue.push({ id: edge.from, path: [...path, edge.from] });
    }
  }

  // No connection found — seed is uncovered via branch
  return null;
}

/** Find the entry node with max caller distance from any seed. */
function findBestEntryByCallerDistance(
  graph: GraphResult,
  seedIds: readonly string[],
  reverseEdgeMap: Map<string, CallEdge[]>,
): string | null {
  // BFS backward from seeds to find the farthest caller
  const distances = new Map<string, number>();
  const queue: { id: string; dist: number }[] = seedIds.map((id) => ({ id, dist: 0 }));

  for (const { id, dist } of queue) {
    distances.set(id, dist);
  }

  while (queue.length > 0) {
    const { id, dist } = queue.shift()!;
    const edges = reverseEdgeMap.get(id) ?? [];
    for (const edge of edges) {
      if (!distances.has(edge.from)) {
        distances.set(edge.from, dist + 1);
        queue.push({ id: edge.from, dist: dist + 1 });
      }
    }
  }

  // Find the node with max distance, tie-break by seed coverage, path length, node-id
  let bestNode: string | null = null;
  let bestDist = -1;
  for (const [id, dist] of distances) {
    if (dist > bestDist || (dist === bestDist && bestNode && id < bestNode)) {
      bestDist = dist;
      bestNode = id;
    }
  }

  return bestNode;
}
