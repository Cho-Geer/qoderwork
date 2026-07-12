#!/usr/bin/env bun
/**
 * session-tree.ts — Recursively build a session tree from OpenCode serve API.
 *
 * Usage:
 *   bun run session-tree.ts <ROOT_SID> [--json] [--depth N] [--port 4096]
 *
 * Output (default): human-readable tree
 *   ses_0c9798a78ffe4r46ZvYSXZyBWL | Orchestrator | root | sub-session direct messaging test
 *   └─ ses_0c9792cbaffeVQhM1254ZgYpqR | Orchestrator | child | Read SKILL.md first 20 lines
 *
 * Output (--json):
 *   { root, nodes, allIds, leafIds }
 *
 * Exit codes:
 *   0 = ok
 *   1 = bad args / root not found
 *   2 = network error
 */

const MAX_DEPTH_DEFAULT = 5;
const FETCH_TIMEOUT_MS = 5000;

// ── argv helpers (must be declared before SERVE_URL) ──
// Support both `--key value` and `--key=value` forms.

function argv(key: string): string | undefined {
  const prefix = `--${key}=`;
  for (const a of process.argv) {
    if (a.startsWith(prefix)) return a.slice(prefix.length);
  }
  const i = process.argv.indexOf(`--${key}`);
  if (i < 0) return undefined;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const SERVE_URL = process.env.SERVE_URL || `http://localhost:${argv("port") || "4096"}`;

interface SessionNode {
  id: string;
  agent: string;
  parent: string | null;
  children: string[];
  title: string;
  depth: number;
  raw?: any;
}

interface SessionTree {
  root: string;
  nodes: Record<string, SessionNode>;
  allIds: string[];
  leafIds: string[];
}

// ── HTTP ──

const WORK_ONE_ROOT = process.env.WORK_ONE_ROOT || "/home/zhaoge/workspace/opencode/work-one";
const FRAMEWORK_DB_PATH = `${WORK_ONE_ROOT}/.opencode/state/framework-state.db`;

async function serveGet(path: string): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${SERVE_URL}${path}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${path}`);
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Non-JSON response from ${path}: ${text.slice(0, 120)}`);
    }
  } catch (e: any) {
    clearTimeout(timer);
    throw e;
  }
}

/**
 * F2: DB fallback when /session/{sid}/children returns HTML/404/non-JSON.
 * Queries session_registry.parent_session_id in the framework SQLite DB.
 */
function dbFallbackChildren(parentSid: string): any[] {
  try {
    const { Database } = require("bun:sqlite");
    const db = new Database(FRAMEWORK_DB_PATH, { readonly: true });
    const rows = db
      .query("SELECT session_id, agent FROM session_registry WHERE parent_session_id = ?")
      .all(parentSid);
    db.close();
    return rows.map((r: any) => ({ id: r.session_id, agent: r.agent }));
  } catch {
    return [];
  }
}

// ── Tree builder ──

async function buildTree(rootId: string, maxDepth: number): Promise<SessionTree> {
  const nodes: Record<string, SessionNode> = {};
  const allIds: string[] = [];

  async function visit(sid: string, parent: string | null, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    if (nodes[sid]) return; // cycle / duplicate guard

    let info: any;
    try {
      info = await serveGet(`/session/${sid}`);
    } catch (e: any) {
      // Non-fatal: record a placeholder node and continue
      nodes[sid] = {
        id: sid, agent: "?error", parent, children: [],
        title: `ERR: ${e.message?.slice(0, 80)}`, depth,
      };
      allIds.push(sid);
      return;
    }

    const node: SessionNode = {
      id: sid,
      agent: info?.agent || "?",
      parent,
      children: [],
      title: (info?.title || "").slice(0, 80),
      depth,
      raw: info,
    };
    nodes[sid] = node;
    allIds.push(sid);

    let children: any[] = [];
    try {
      const c = await serveGet(`/session/${sid}/children`);
      if (Array.isArray(c)) {
        children = c;
      } else {
        // Non-array response — try DB fallback
        children = dbFallbackChildren(sid);
      }
    } catch {
      // /children endpoint failed — try DB fallback
      children = dbFallbackChildren(sid);
    }

    for (const child of children) {
      const cid = child?.id;
      if (!cid || nodes[cid]) continue;
      node.children.push(cid);
      await visit(cid, sid, depth + 1);
    }
  }

  await visit(rootId, null, 0);

  const leafIds = allIds.filter(id => nodes[id].children.length === 0);
  return { root: rootId, nodes, allIds, leafIds };
}

// ── Rendering ──

function renderTree(tree: SessionTree): string {
  const lines: string[] = [];
  function walk(sid: string, prefix: string, isLast: boolean, isRoot: boolean) {
    const n = tree.nodes[sid];
    if (!n) return;
    const branch = isRoot ? "" : (isLast ? "└─ " : "├─ ");
    const role = isRoot ? "root" : "child";
    lines.push(`${prefix}${branch}${n.id} | ${n.agent} | ${role} | ${n.title}`);
    const childPrefix = prefix + (isRoot ? "" : (isLast ? "   " : "│  "));
    n.children.forEach((cid, i) => {
      walk(cid, childPrefix, i === n.children.length - 1, false);
    });
  }
  walk(tree.root, "", true, true);
  return lines.join("\n");
}

// ── main ──

async function main() {
  const rootId = process.argv.find(a => a.startsWith("ses_")) || process.argv[2];
  if (!rootId || rootId.startsWith("--")) {
    console.error("Usage: bun run session-tree.ts <ROOT_SID> [--json] [--depth N] [--port 4096]");
    process.exit(1);
  }

  const maxDepth = parseInt(argv("depth") || `${MAX_DEPTH_DEFAULT}`, 10);
  const jsonOut = flag("json");

  try {
    const tree = await buildTree(rootId, maxDepth);

    // F3: Root query failure → exit 2 (network/connectivity error)
    const rootNode = tree.nodes[rootId];
    if (rootNode?.agent === "?error") {
      console.error(`ERROR: Cannot reach root session ${rootId}: ${rootNode.title}`);
      process.exit(2);
    }

    if (jsonOut) {
      // Strip raw to keep output compact
      const compact: SessionTree = {
        root: tree.root,
        nodes: Object.fromEntries(
          Object.entries(tree.nodes).map(([k, v]) => [k, { ...v, raw: undefined }])
        ),
        allIds: tree.allIds,
        leafIds: tree.leafIds,
      };
      console.log(JSON.stringify(compact, null, 2));
    } else {
      console.log(renderTree(tree));
    }
  } catch (e: any) {
    console.error(`ERROR: ${e.message}`);
    process.exit(2);
  }
}

main();
