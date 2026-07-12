#!/usr/bin/env bun
/**
 * tree-watcher.ts — Observe session tree + SSE + quality.jsonl, emit evidence capsule + intervention advice.
 *
 * Usage:
 *   bun run tree-watcher.ts <ROOT_SID> [--interval 5] [--timeout 600] [--capsule] [--suggest-guide]
 *
 * Output modes:
 *   default          : one status line per poll (like monitor-tree)
 *   --capsule        : print evidence capsule JSON every poll
 *   --suggest-guide  : when intervention >= L2, print copy-pasteable intervene.ts command
 *
 * Exit codes:
 *   0 : all-idle x2 rounds
 *   2 : session error
 *   3 : timeout
 */

import { readFileSync, statSync, existsSync } from "fs";
import { join } from "path";

const FETCH_TIMEOUT_MS = 5000;
const WORKING_WINDOW_MS = 15_000;
const IDLE_ROUNDS_TO_COMPLETE = 2;

// ── argv ──

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

function argvFlag(key: string): boolean {
  return process.argv.includes(`--${key}`);
}

const SERVE_URL = process.env.SERVE_URL || `http://localhost:${argvStr("port", "4096")}`;
const INTERVAL_MS = argvNum("interval", 5) * 1000;
const TIMEOUT_MS = argvNum("timeout", 600) * 1000;
const OPT_CAPSULE = argvFlag("capsule");
const OPT_SUGGEST = argvFlag("suggest-guide");

const WORK_ONE_ROOT = process.env.WORK_ONE_ROOT || "/home/zhaoge/workspace/opencode/work-one";
const FRAMEWORK_DB_PATH = `${WORK_ONE_ROOT}/.opencode/state/framework-state.db`;
const SSE_FILE = process.env.SSE_FILE || "/tmp/sse-events.jsonl";
const QUALITY_FILE = process.env.QUALITY_FILE || `${WORK_ONE_ROOT}/.task_temp/_logs/quality.jsonl`;

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

// ── DB fallback ──

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

// ── Tree ──

interface TNode {
  id: string;
  agent: string;
  parent: string | null;
  children: string[];
  title: string;
  updatedMs: number;
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

interface ClassifyResult {
  statuses: Record<string, Status>;
  pendingQuestions: Array<{ qid: string; sid: string }>;
}

async function classifyAll(nodes: Record<string, TNode>): Promise<ClassifyResult> {
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

  const pendingQuestions: Array<{ qid: string; sid: string }> = [];
  let pendingBySid: Record<string, number> = {};
  try {
    const qs = await serveGet("/question");
    if (Array.isArray(qs)) {
      for (const q of qs) {
        const sid = q?.sessionID;
        if (sid) {
          pendingBySid[sid] = (pendingBySid[sid] || 0) + 1;
          pendingQuestions.push({ qid: q.id, sid });
        }
      }
    }
  } catch { /* question endpoint optional */ }

  const now = Date.now();
  const statuses: Record<string, Status> = {};
  for (const [sid, updated, err] of refresh) {
    if (err) {
      statuses[sid] = "error";
    } else if ((pendingBySid[sid] || 0) > 0) {
      statuses[sid] = "question-pending";
    } else if (updated && now - updated < WORKING_WINDOW_MS) {
      statuses[sid] = "working";
    } else {
      statuses[sid] = "idle";
    }
  }
  return { statuses, pendingQuestions };
}

// ── JSONL tail reader ──

interface JsonlEntry {
  timestamp?: string;
  type?: string;
  sessionID?: string;
  event?: string;
  [key: string]: any;
}

function tailJsonl(filePath: string, offset: number, treeSids: Set<string>): { entries: JsonlEntry[]; newOffset: number } {
  const entries: JsonlEntry[] = [];
  if (!existsSync(filePath)) return { entries, newOffset: offset };
  try {
    const stat = statSync(filePath);
    if (stat.size < offset) offset = 0; // file rotated
    if (stat.size === offset) return { entries, newOffset: offset };

    const buf = readFileSync(filePath, "utf8");
    const newData = buf.slice(offset);
    const lines = newData.split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        const sid = obj.sessionID || obj.data?.sessionID;
        if (treeSids.size === 0 || (sid && treeSids.has(sid))) {
          entries.push(obj);
        }
      } catch { /* skip malformed lines */ }
    }
    return { entries, newOffset: buf.length };
  } catch {
    return { entries, newOffset: offset };
  }
}

// ── SSE event filter ──

const SSE_RELEVANT_TYPES = new Set([
  "session.created", "session.idle", "session.error",
  "question.asked", "question.replied",
  "session.next.tool.failed",
  "file.edited", "session.diff",
]);

function filterSseEvents(raw: JsonlEntry[]): JsonlEntry[] {
  return raw.filter((e) => SSE_RELEVANT_TYPES.has(e.type || ""));
}

// ── Quality signal filter ──

const TODO_EVENTS = new Set([
  "todo_write_observed",
  "todo_write_mismatch",
  "todo_missing_for_nontrivial",
  "todo_stale_after_tools",
  "todo_failure_without_recovery",
  "todo_write_invalid_status",
]);

function filterTodoSignals(raw: JsonlEntry[]): JsonlEntry[] {
  return raw.filter((e) => TODO_EVENTS.has(e.event || ""));
}

// ── Evidence Capsule ──

interface EvidenceCapsule {
  rootSessionId: string;
  timestamp: string;
  round: number;
  tree: Array<{ id: string; agent: string; status: Status; title: string }>;
  todoSignals: Array<{
    sessionID: string;
    event: string;
    tool?: string;
    actions_since_update?: number;
    blocked?: number;
    total?: number;
    in_progress?: number;
  }>;
  sseEvents: Array<{ type: string; sessionID: string }>;
  pendingQuestions: Array<{ qid: string; sid: string }>;
  toolFailures: Array<{ sessionID: string; type: string }>;
  changedFiles: string[];
  intervention: {
    level: "L0" | "L1" | "L2" | "L3" | "L4";
    name: string;
    targetSid: string | null;
    reason: string;
  };
}

function buildCapsule(
  rootId: string,
  round: number,
  nodes: Record<string, TNode>,
  statuses: Record<string, Status>,
  pendingQuestions: Array<{ qid: string; sid: string }>,
  todoSignals: JsonlEntry[],
  sseEvents: JsonlEntry[],
): EvidenceCapsule {
  const tree = Object.values(nodes).map((n) => ({
    id: n.id,
    agent: n.agent,
    status: statuses[n.id] || "idle",
    title: n.title,
  }));

  const todoSigs = todoSignals.map((e) => ({
    sessionID: e.sessionID || "",
    event: e.event || "",
    tool: e.tool,
    actions_since_update: e.actions_since_update,
    blocked: e.blocked,
    total: e.total,
    in_progress: e.in_progress,
  }));

  const sseSum = sseEvents.map((e) => ({
    type: e.type || "",
    sessionID: e.sessionID || e.data?.sessionID || "",
  }));

  const toolFailures = sseEvents
    .filter((e): e is typeof e & { type: string } => e.type === "session.next.tool.failed")
    .map((e) => ({
      sessionID: String(e.sessionID || e.data?.sessionID || ""),
      type: e.type,
    }));

  const changedFiles: string[] = [];
  for (const e of sseEvents) {
    if (e.type === "file.edited" || e.type === "session.diff") {
      const files = e.data?.files || e.data?.paths || [];
      if (Array.isArray(files)) changedFiles.push(...files.map(String));
    }
  }

  const intervention = assessIntervention(statuses, pendingQuestions, todoSignals, sseEvents);

  return {
    rootSessionId: rootId,
    timestamp: new Date().toISOString(),
    round,
    tree,
    todoSignals: todoSigs,
    sseEvents: sseSum,
    pendingQuestions,
    toolFailures,
    changedFiles: [...new Set(changedFiles)],
    intervention,
  };
}

// ── Intervention Policy ──

interface InterventionResult {
  level: "L0" | "L1" | "L2" | "L3" | "L4";
  name: string;
  targetSid: string | null;
  reason: string;
}

let consecutiveL3 = 0;

function assessIntervention(
  statuses: Record<string, Status>,
  pendingQuestions: Array<{ qid: string; sid: string }>,
  todoSignals: JsonlEntry[],
  sseEvents: JsonlEntry[],
): InterventionResult {
  // L4: session error
  for (const [sid, st] of Object.entries(statuses)) {
    if (st === "error") {
      return { level: "L4", name: "stop-gate", targetSid: sid, reason: "Session returned HTTP error" };
    }
  }

  // L4: tool failure cascade
  const toolFailures = sseEvents.filter((e) => e.type === "session.next.tool.failed");
  if (toolFailures.length >= 3) {
    const sid = toolFailures[0]?.sessionID || toolFailures[0]?.data?.sessionID || null;
    return { level: "L4", name: "stop-gate", targetSid: sid ?? null, reason: `${toolFailures.length} tool failures detected` };
  }

  // L3: failure without recovery (blocked >= 2)
  for (const sig of todoSignals) {
    if (sig.event === "todo_failure_without_recovery" && (sig.blocked || 0) >= 2) {
      consecutiveL3++;
      if (consecutiveL3 >= 2) {
        return { level: "L4", name: "stop-gate", targetSid: sig.sessionID ?? null, reason: "Persistent blocked state without recovery (2+ rounds)" };
      }
      return { level: "L3", name: "redirect", targetSid: sig.sessionID ?? null, reason: `Blocked=${sig.blocked} with no recovery intent` };
    }
  }

  // L1: pending question
  if (pendingQuestions.length > 0) {
    const q = pendingQuestions[0];
    return { level: "L1", name: "ask", targetSid: q.sid, reason: `Pending question ${q.qid}` };
  }

  // L2: todo signals
  for (const sig of todoSignals) {
    if (sig.event === "todo_missing_for_nontrivial") {
      return { level: "L2", name: "guide", targetSid: sig.sessionID ?? null, reason: `Non-trivial tool ${sig.tool} used before TodoWrite` };
    }
    if (sig.event === "todo_stale_after_tools" && (sig.actions_since_update || 0) >= 3) {
      return { level: "L2", name: "guide", targetSid: sig.sessionID ?? null, reason: `TodoWrite stale for ${sig.actions_since_update} tool calls` };
    }
    if (sig.event === "todo_write_mismatch") {
      return { level: "L2", name: "guide", targetSid: sig.sessionID ?? null, reason: `TodoWrite mismatch: in_progress=${sig.in_progress}, total=${sig.total}` };
    }
  }

  // L0: observe
  consecutiveL3 = 0;
  return { level: "L0", name: "observe", targetSid: null, reason: "Normal progress" };
}

// ── Suggest guide ──

function suggestGuideCommand(capsule: EvidenceCapsule): string | null {
  const iv = capsule.intervention;
  if (!iv.targetSid || iv.level === "L0" || iv.level === "L1") return null;

  const scriptsDir = join(import.meta.dir || ".", ".");
  let text: string;
  switch (iv.level) {
    case "L2":
      text = `[L2] ${iv.reason}. Update your TodoWrite with current evidence before proceeding.`;
      break;
    case "L3":
      text = `[L3] ${iv.reason}. Stop current path and reassess your approach.`;
      break;
    case "L4":
      text = `[L4] ${iv.reason}. Do not continue — wait for guidance.`;
      break;
    default:
      return null;
  }

  return `bun run intervene.ts ${iv.targetSid} --mode=guide --text="${text}"`;
}

// ── Formatting ──

function fmtStatusLine(
  nodes: Record<string, TNode>,
  statuses: Record<string, Status>,
  pending: number,
  intervention: InterventionResult,
): string {
  const hhmmss = new Date().toISOString().slice(11, 19);
  const parts: string[] = [];
  for (const sid of Object.keys(nodes)) {
    const n = nodes[sid];
    const role = n.parent === null ? "root" : "child";
    parts.push(`${role}=${n.agent}(${statuses[sid]})`);
  }
  const ivTag = intervention.level !== "L0" ? ` | ${intervention.level}:${intervention.name}(${intervention.targetSid?.slice(0, 12) || "-"})` : "";
  return `[${hhmmss}] ${parts.join(" | ")} | pending=${pending}${ivTag}`;
}

// ── Main ──

async function main() {
  const rootId = process.argv.find((a) => a.startsWith("ses_")) || process.argv[2];
  if (!rootId || rootId.startsWith("--")) {
    console.error("Usage: bun run tree-watcher.ts <ROOT_SID> [--interval 5] [--timeout 600] [--capsule] [--suggest-guide]");
    process.exit(1);
  }

  const startedAt = Date.now();
  let idleStreak = 0;
  let prevIds: string[] = [];
  let sseOffset = 0;
  let qualityOffset = 0;
  let round = 0;

  // Skip to end of SSE/quality files on startup (only watch new events)
  if (existsSync(SSE_FILE)) sseOffset = statSync(SSE_FILE).size;
  if (existsSync(QUALITY_FILE)) qualityOffset = statSync(QUALITY_FILE).size;

  while (Date.now() - startedAt < TIMEOUT_MS) {
    round++;
    const nodes = await buildTree(rootId);
    const ids = Object.keys(nodes);
    const treeSids = new Set(ids);

    // Tree growth detection
    if (ids.length !== prevIds.length || !ids.every((id, i) => id === prevIds[i])) {
      if (prevIds.length > 0) {
        const newOnes = ids.filter((id) => !prevIds.includes(id));
        console.log(`  [tree-growth] detected ${newOnes.length} new session(s): ${newOnes.join(", ")}`);
      }
      prevIds = ids;
    }

    // Classify
    const { statuses, pendingQuestions } = await classifyAll(nodes);
    const pendingTotal = Object.values(statuses).filter((s) => s === "question-pending").length;

    // Tail SSE
    const { entries: sseRaw, newOffset: newSseOff } = tailJsonl(SSE_FILE, sseOffset, treeSids);
    sseOffset = newSseOff;
    const sseEvents = filterSseEvents(sseRaw);

    // Tail quality JSONL
    const { entries: qualityRaw, newOffset: newQualOff } = tailJsonl(QUALITY_FILE, qualityOffset, treeSids);
    qualityOffset = newQualOff;
    const todoSignals = filterTodoSignals(qualityRaw);

    // Build capsule
    const capsule = buildCapsule(rootId, round, nodes, statuses, pendingQuestions, todoSignals, sseEvents);

    // Output
    if (OPT_CAPSULE) {
      console.log(JSON.stringify(capsule, null, 2));
    } else {
      console.log(fmtStatusLine(nodes, statuses, pendingTotal, capsule.intervention));
    }

    if (OPT_SUGGEST) {
      const cmd = suggestGuideCommand(capsule);
      if (cmd) console.log(`  ⚡ ${cmd}`);
    }

    // Error short-circuit
    if (Object.values(statuses).includes("error")) {
      console.error(`  [error] session error detected, aborting`);
      process.exit(2);
    }

    // All-idle completion
    const allIdle = Object.values(statuses).every((s) => s === "idle");
    if (allIdle) {
      idleStreak++;
      if (idleStreak >= IDLE_ROUNDS_TO_COMPLETE) {
        const hhmmss = new Date().toISOString().slice(11, 19);
        console.log(`[${hhmmss}] ✓ all idle x${IDLE_ROUNDS_TO_COMPLETE} rounds, tree completed`);
        if (OPT_CAPSULE) {
          console.log(JSON.stringify(capsule, null, 2));
        }
        process.exit(0);
      }
    } else {
      idleStreak = 0;
    }

    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }

  console.error(`[timeout] --timeout ${TIMEOUT_MS / 1000}s reached without tree completion`);
  process.exit(3);
}

main();
