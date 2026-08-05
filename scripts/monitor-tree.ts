#!/usr/bin/env bun
/**
 * monitor-tree.ts — Poll session tree + classify status + detect tree-complete.
 *
 * Usage:
 *   bun run monitor-tree.ts <ROOT_SID> [--interval 5] [--timeout 600] [--on-question url]
 *
 * Status classification (per node, every --interval seconds):
 *   question-pending : GET /question includes this sessionID
 *   working          : session.time.updated within last 15s (3 × interval)
 *   idle             : otherwise
 *   error            : /session/{sid} returns HTTP error
 *
 * Exit conditions:
 *   - All nodes idle for 2 consecutive rounds (10s at default interval) → exit 0
 *   - Any node returns HTTP error                                     → exit 2
 *   - --timeout reached                                                → exit 3
 *
 * Output: one line per poll, e.g.
 *   [08:25:00] root=Orchestrator(idle)    | child=build(working) | pending=0
 *   [08:25:05] root=Orchestrator(working) | child=build(idle)    | pending=1
 *   [08:25:10] ✓ all idle x2 rounds, tree completed
 */

const FETCH_TIMEOUT_MS = 5000;
const WORKING_WINDOW_MS = 15_000;
const IDLE_ROUNDS_TO_COMPLETE = 2;

// ── argv helpers ──
// Support both `--key value` and `--key=value` forms.

function argvNum(key: string, dflt: number): number {
  const prefix = `--${key}=`;
  for (const a of process.argv) {
    if (a.startsWith(prefix)) {
      const n = parseInt(a.slice(prefix.length), 10);
      return Number.isFinite(n) ? n : dflt;
    }
  }
  const i = process.argv.indexOf(`--${key}`);
  if (i < 0) return dflt;
  const v = process.argv[i + 1];
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : dflt;
}

function argvStr(key: string, dflt: string): string {
  const prefix = `--${key}=`;
  for (const a of process.argv) {
    if (a.startsWith(prefix)) return a.slice(prefix.length);
  }
  const i = process.argv.indexOf(`--${key}`);
  if (i < 0) return dflt;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : dflt;
}

const SERVE_URL = process.env.SERVE_URL || `http://localhost:${argvStr("port", "4096")}`;
const INTERVAL_MS = argvNum("interval", 5) * 1000;
const TIMEOUT_MS = argvNum("timeout", 600) * 1000;
const ON_QUESTION_URL = argvStr("on-question", "");

// ── HTTP ──

async function serveGet(path: string): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${SERVE_URL}${path}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return JSON.parse(await res.text());
  } catch (e: any) {
    clearTimeout(timer);
    throw e;
  }
}

const WORK_ONE_ROOT = process.env.WORK_ONE_ROOT || "${WORK_ONE_ROOT}";
const FRAMEWORK_DB_PATH = `${WORK_ONE_ROOT}/.opencode/state/framework-state.db`;

/**
 * F2: DB fallback when /children returns HTML/404/non-JSON.
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

// ── Tree builder (compact inline, mirrors session-tree.ts) ──

interface TNode {
  id: string;
  agent: string;
  parent: string | null;
  children: string[];
  title: string;
  updatedMs: number;   // session.time.updated
}

async function buildTree(rootId: string, maxDepth = 5): Promise<Record<string, TNode>> {
  const nodes: Record<string, TNode> = {};
  async function visit(sid: string, parent: string | null, depth: number) {
    if (depth > maxDepth || nodes[sid]) return;
    try {
      const s = await serveGet(`/session/${sid}`);
      nodes[sid] = {
        id: sid,
        agent: s?.agent || "?",
        parent,
        children: [],
        title: (s?.title || "").slice(0, 40),
        updatedMs: s?.time?.updated || 0,
      };
      let kids: any[];
      try {
        const c = await serveGet(`/session/${sid}/children`);
        kids = Array.isArray(c) ? c : dbFallbackChildren(sid);
      } catch {
        kids = dbFallbackChildren(sid);
      }
      if (Array.isArray(kids)) {
        for (const c of kids) {
          if (c?.id && !nodes[c.id]) {
            nodes[sid].children.push(c.id);
            await visit(c.id, sid, depth + 1);
          }
        }
      }
    } catch (e: any) {
      nodes[sid] = {
        id: sid, agent: "?error", parent, children: [],
        title: `ERR: ${e.message?.slice(0, 40)}`, updatedMs: 0,
      };
    }
  }
  await visit(rootId, null, 0);
  return nodes;
}

// ── Status classification ──

type Status = "idle" | "working" | "question-pending" | "error";

async function classifyAll(nodes: Record<string, TNode>): Promise<Record<string, Status>> {
  // Refresh updatedMs for each node (session.time.updated is our activity signal)
  const refresh = await Promise.all(
    Object.keys(nodes).map(async (sid) => {
      try {
        const s = await serveGet(`/session/${sid}`);
        return [sid, s?.time?.updated || 0, null] as const;
      } catch (e: any) {
        return [sid, 0, e] as const;
      }
    })
  );

  // Pending questions (one call covers all sessions)
  let pendingBySid: Record<string, number> = {};
  try {
    const qs = await serveGet("/question");
    if (Array.isArray(qs)) {
      for (const q of qs) {
        const sid = q?.sessionID;
        if (sid) pendingBySid[sid] = (pendingBySid[sid] || 0) + 1;
      }
    }
  } catch { /* question endpoint optional */ }

  const now = Date.now();
  const result: Record<string, Status> = {};
  for (const [sid, updated, err] of refresh) {
    if (err) {
      result[sid] = "error";
    } else if ((pendingBySid[sid] || 0) > 0) {
      result[sid] = "question-pending";
    } else if (updated && now - updated < WORKING_WINDOW_MS) {
      result[sid] = "working";
    } else {
      result[sid] = "idle";
    }
  }
  return result;
}

// ── Formatting ──

function fmtLine(nodes: Record<string, TNode>, statuses: Record<string, Status>, pending: number): string {
  const hhmmss = new Date().toISOString().slice(11, 19);
  const parts: string[] = [];
  for (const sid of Object.keys(nodes)) {
    const n = nodes[sid];
    const role = n.parent === null ? "root" : "child";
    parts.push(`${role}=${n.agent}(${statuses[sid]})`);
  }
  return `[${hhmmss}] ${parts.join(" | ")} | pending=${pending}`;
}

// ── Main loop ──

async function main() {
  const rootId = process.argv.find(a => a.startsWith("ses_")) || process.argv[2];
  if (!rootId || rootId.startsWith("--")) {
    console.error("Usage: bun run monitor-tree.ts <ROOT_SID> [--interval 5] [--timeout 600]");
    process.exit(1);
  }

  const startedAt = Date.now();
  let idleStreak = 0;
  let prevIds: string[] = [];

  while (Date.now() - startedAt < TIMEOUT_MS) {
    const nodes = await buildTree(rootId);
    const ids = Object.keys(nodes);

    if (ids.length !== prevIds.length || !ids.every((id, i) => id === prevIds[i])) {
      if (prevIds.length > 0) {
        const newOnes = ids.filter(id => !prevIds.includes(id));
        console.log(`  [tree-growth] detected ${newOnes.length} new session(s): ${newOnes.join(", ")}`);
      }
      prevIds = ids;
    }

    const statuses = await classifyAll(nodes);
    const pendingTotal = Object.values(statuses).filter(s => s === "question-pending").length;
    console.log(fmtLine(nodes, statuses, pendingTotal));

    // Optional webhook on question
    if (pendingTotal > 0 && ON_QUESTION_URL) {
      try {
        await fetch(ON_QUESTION_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rootId, pendingTotal, at: new Date().toISOString() }),
        }).catch(() => {});
      } catch { /* best-effort */ }
    }

    // Error short-circuit
    if (Object.values(statuses).includes("error")) {
      console.error(`  [error] at least one node returned HTTP error, aborting`);
      process.exit(2);
    }

    // All-idle completion
    const allIdle = Object.values(statuses).every(s => s === "idle");
    if (allIdle) {
      idleStreak++;
      if (idleStreak >= IDLE_ROUNDS_TO_COMPLETE) {
        const hhmmss = new Date().toISOString().slice(11, 19);
        console.log(`[${hhmmss}] ✓ all idle x${IDLE_ROUNDS_TO_COMPLETE} rounds, tree completed`);
        process.exit(0);
      }
    } else {
      idleStreak = 0;
    }

    await new Promise(r => setTimeout(r, INTERVAL_MS));
  }

  console.error(`[timeout] --timeout ${TIMEOUT_MS / 1000}s reached without tree completion`);
  process.exit(3);
}

main();
