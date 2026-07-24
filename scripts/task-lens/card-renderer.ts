// scripts/task-lens/card-renderer.ts
// PHASE-04: Five-section card renderer.
// Renders a human-readable markdown card from TaskGraphV1 and TaskInputReceipt.

import type { TaskGraphV1, TaskInputReceipt, CallEdge, FunctionNode } from "./types.ts";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a five-section review card in markdown format.
 *
 * Sections:
 * 一、主干路径 (Main Path)
 * 二、变更函数表 (Changed Functions)
 * 三、副作用表 (Side Effects)
 * 四、证据 (Evidence)
 * 五、反馈区 (Feedback)
 *
 * @param graph - The task graph with nodes, edges, spine, truncation, and unverified info.
 * @param receipt - The task input receipt with metadata.
 * @returns Markdown string with all five sections.
 */
export function renderCard(
  graph: TaskGraphV1,
  receipt: TaskInputReceipt,
): string {
  const lines: string[] = [];

  // -----------------------------------------------------------------------
  // Section 一：主干路径 (Main Path)
  // -----------------------------------------------------------------------
  lines.push("## 一、主干路径 (Main Path)");
  lines.push("");

  if (graph.spine.primaryPath.length > 0) {
    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
    lines.push("| # | Function | Location |");
    lines.push("| --- | --- | --- |");
    for (let i = 0; i < graph.spine.primaryPath.length; i++) {
      const nodeId = graph.spine.primaryPath[i];
      const node = nodeMap.get(nodeId);
      if (node) {
        lines.push(
          `| ${i + 1} | \`${escapePipe(node.signature)}\` | \`${escapePipe(node.file)}:${node.startLine}-${node.endLine}\` |`,
        );
      } else {
        lines.push(`| ${i + 1} | \`${escapePipe(nodeId)}\` | (not in graph) |`);
      }
    }
    lines.push("");

    // Seed branches
    if (graph.spine.seedBranches.length > 0) {
      lines.push("**分支路径 (Seed Branches):**");
      lines.push("");
      for (const branch of graph.spine.seedBranches) {
        const branchNodes = branch.path
          .map((id) => {
            const n = nodeMap.get(id);
            return n ? `\`${n.signature}\`` : `\`${id}\``;
          })
          .join(" → ");
        lines.push(`- from \`${escapePipe(branch.from)}\`: ${branchNodes}`);
      }
      lines.push("");
    }

    // Uncovered seeds
    if (graph.spine.uncoveredSeeds.length > 0) {
      lines.push(
        `**未覆盖种子:** ${graph.spine.uncoveredSeeds.map((s) => `\`${escapePipe(s)}\``).join(", ")}`,
      );
      lines.push("");
    }
  } else {
    lines.push("(无主干路径)");
    lines.push("");
  }

  // -----------------------------------------------------------------------
  // Section 二：变更函数表 (Changed Functions)
  // -----------------------------------------------------------------------
  lines.push("## 二、变更函数表 (Changed Functions)");
  lines.push("");

  if (graph.nodes.length > 0) {
    lines.push(
      "| # | Location | Signature | Side Effects | Observation | Confidence |",
    );
    lines.push(
      "| --- | --- | --- | --- | --- | --- |",
    );

    // Build per-node confidence from edges
    const nodeConfidence = computeNodeConfidence(graph.nodes, graph.edges);

    for (let i = 0; i < graph.nodes.length; i++) {
      const node = graph.nodes[i];
      const location = `${escapePipe(node.file)}:${node.startLine}-${node.endLine}`;
      const signature = escapePipe(node.signature);

      // Side effects: [kind] token comma-separated
      const sideEffectsStr =
        node.sideEffects.length > 0
          ? node.sideEffects
              .map((se) => `[${se.kind}] ${escapePipe(se.token)}`)
              .join(", ")
          : "-";

      // Observation
      const observation = node.observation;

      // Confidence
      const conf = nodeConfidence.get(node.id);
      let confidenceStr: string;
      if (conf !== undefined && conf !== null) {
        const confRounded = conf.toFixed(2);
        confidenceStr =
          conf < 0.8 ? `${confRounded} (static-low)` : confRounded;
      } else {
        confidenceStr = "-";
      }

      lines.push(
        `| ${i + 1} | ${location} | ${signature} | ${sideEffectsStr} | ${observation} | ${confidenceStr} |`,
      );
    }
  } else {
    lines.push("(无变更函数)");
  }
  lines.push("");

  // -----------------------------------------------------------------------
  // Section 三：副作用表 (Side Effects)
  // -----------------------------------------------------------------------
  lines.push("## 三、副作用表 (Side Effects)");
  lines.push("");

  // Collect all side effects across all nodes
  const allSideEffects = new Map<string, { kind: string; token: string; nodes: string[] }>();
  for (const node of graph.nodes) {
    for (const se of node.sideEffects) {
      const key = `${se.kind}:${se.token}`;
      const existing = allSideEffects.get(key);
      if (existing) {
        if (!existing.nodes.includes(node.signature)) {
          existing.nodes.push(node.signature);
        }
      } else {
        allSideEffects.set(key, {
          kind: se.kind,
          token: se.token,
          nodes: [node.signature],
        });
      }
    }
  }

  if (allSideEffects.size > 0) {
    lines.push("| Kind | Token | Affected Functions |");
    lines.push("| --- | --- | --- |");
    for (const [, entry] of [...allSideEffects.entries()].sort((a, b) => {
      if (a[1].kind !== b[1].kind) return a[1].kind.localeCompare(b[1].kind);
      return a[1].token.localeCompare(b[1].token);
    })) {
      const affected = entry.nodes.map((n) => `\`${escapePipe(n)}\``).join(", ");
      lines.push(`| ${entry.kind} | \`${escapePipe(entry.token)}\` | ${affected} |`);
    }
    lines.push("");
  } else {
    lines.push("(未检测到副作用)");
    lines.push("");
  }

  // Uncovered seeds
  if (graph.spine.uncoveredSeeds.length > 0) {
    lines.push("**未覆盖种子 (Uncovered Seeds):**");
    lines.push("");
    for (const seed of graph.spine.uncoveredSeeds) {
      lines.push(`- \`${escapePipe(seed)}\``);
    }
    lines.push("");
  }

  // Truncation info
  if (graph.truncation.length > 0) {
    lines.push("**截断信息 (Truncation):**");
    lines.push("");
    for (const t of graph.truncation) {
      lines.push(`- ${escapePipe(t)}`);
    }
    lines.push("");
  }

  // Unverified edges
  if (graph.unverified.length > 0) {
    lines.push("**未验证边 (Unverified Edges):**");
    lines.push("");
    // Limit display to first 20
    const displayUnverified = graph.unverified.slice(0, 20);
    for (const uv of displayUnverified) {
      lines.push(`- \`${escapePipe(uv)}\``);
    }
    if (graph.unverified.length > 20) {
      lines.push(`- ... 及其他 ${graph.unverified.length - 20} 条`);
    }
    lines.push("");
  }

  // Deleted regions
  if (graph.deletedRegions.length > 0) {
    lines.push("**删除区域 (Deleted Regions):**");
    lines.push("");
    for (const dr of graph.deletedRegions) {
      lines.push(
        `- \`${escapePipe(dr.oldPath)}\`:${dr.startLine}-${dr.endLine} (${dr.provenance})`,
      );
    }
    lines.push("");
  }

  // -----------------------------------------------------------------------
  // Section 四：证据 (Evidence)
  // -----------------------------------------------------------------------
  lines.push("## 四、证据 (Evidence)");
  lines.push("");

  lines.push("| Field | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Task ID | \`${escapePipe(receipt.taskId)}\` |`);
  lines.push(`| Project | \`${escapePipe(receipt.projectRealpath)}\` |`);
  lines.push(`| Mode | ${receipt.mode} |`);
  lines.push(`| Base SHA | \`${escapePipe(receipt.baseSha)}\` |`);
  lines.push(`| Head SHA | \`${escapePipe(receipt.headSha)}\` |`);
  lines.push(`| Diff Hash | \`${escapePipe(receipt.diffHash)}\` |`);
  lines.push(`| Config Hash | \`${escapePipe(receipt.configHash)}\` |`);
  lines.push(
    `| Coverage Hash | ${receipt.coverageHash ? `\`${escapePipe(receipt.coverageHash)}\`` : "N/A"} |`,
  );
  lines.push(
    `| Provider | ${receipt.provider.name} (${receipt.provider.available ? "available" : "unavailable"}) |`,
  );
  lines.push(`| Generated At | ${receipt.generatedAt} |`);
  lines.push(`| Graph Schema | \`${escapePipe(graph.schemaVersion)}\` |`);
  lines.push(`| Node Count | ${graph.nodes.length} |`);
  lines.push(`| Edge Count | ${graph.edges.length} |`);
  lines.push(`| Seed Count | ${graph.seeds.length} |`);
  lines.push(`| Spine Entry | ${graph.spine.entries.length > 0 ? `\`${escapePipe(graph.spine.entries.join(", "))}\`` : "N/A"} |`);
  lines.push("");

  // -----------------------------------------------------------------------
  // Section 五：反馈区 (Feedback)
  // -----------------------------------------------------------------------
  lines.push("## 五、反馈区 (Feedback)");
  lines.push("");
  lines.push("> 请在此记录审查反馈：");
  lines.push(">");
  lines.push("> - **卡片是否有用？** (是/否)");
  lines.push("> - **认知负荷是否降低？** (是/否)");
  lines.push("> - **发现的问题数：** ");
  lines.push("> - **由卡片引导发现的问题数：** ");
  lines.push("> - **审查耗时（分钟）：** ");
  lines.push("> - **备注：** ");
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape pipe characters in table cells. */
function escapePipe(s: string): string {
  return s.replace(/\|/g, "\\|");
}

/**
 * Compute per-node confidence from edges.
 * Returns a Map of nodeId -> minimum confidence from all connected edges.
 */
function computeNodeConfidence(
  nodes: readonly FunctionNode[],
  edges: readonly CallEdge[],
): Map<string, number | null> {
  const confMap = new Map<string, number | null>();

  // Initialize all nodes with null (no edges)
  for (const node of nodes) {
    confMap.set(node.id, null);
  }

  // Collect confidence values per node from edges
  const nodeConfs = new Map<string, number[]>();
  for (const edge of edges) {
    if (edge.confidence !== null) {
      // From node
      let arr = nodeConfs.get(edge.from);
      if (!arr) {
        arr = [];
        nodeConfs.set(edge.from, arr);
      }
      arr.push(edge.confidence);

      // To node
      arr = nodeConfs.get(edge.to);
      if (!arr) {
        arr = [];
        nodeConfs.set(edge.to, arr);
      }
      arr.push(edge.confidence);
    }
  }

  // Compute min confidence per node
  for (const [nodeId, confs] of nodeConfs) {
    if (confs.length > 0) {
      confMap.set(nodeId, Math.min(...confs));
    }
  }

  return confMap;
}
