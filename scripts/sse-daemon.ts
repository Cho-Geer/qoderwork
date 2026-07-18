/**
 * SSE Daemon — Standalone event subscriber for OpenCode serve API.
 * NOT an MCP server. Runs as nohup background process.
 * Writes events to JSONL file for QoderWork to read via tail/Read.
 *
 * Usage: bun run sse-daemon.ts
 */
import fs from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";

const SERVE_URL = process.env.SERVE_URL || "http://localhost:4096";
const EVENT_FILE = process.env.EVENT_FILE || "/tmp/sse-events.jsonl";
const ARCHIVE_DIR = process.env.ARCHIVE_DIR || "/tmp/sse-events-archive";
const FRAMEWORK_DB_PATH = process.env.FRAMEWORK_DB_PATH;
const SSE_READY_FILE = process.env.SSE_READY_FILE;
const RUN_ID = process.env.QODERWORK_TEST_RUN_ID;
const MAX_FILE_SIZE = 10_000_000; // 10MB (fallback if no events for an hour)
const KEEP_LINES = 1000;

let currentHour = -1; // Track hour for hourly rotation

// Relevant event types (filter noise)
const RELEVANT_TYPES = new Set([
  // Question lifecycle
  "question.asked", "question.replied", "question.rejected",
  // Message lifecycle
  "message.updated", "message.part.updated",
  // Session status
  "session.created", "session.updated", "session.status",
  "session.idle", "session.error", "session.compacted",
  // Streaming text
  "message.part.delta",
  // File changes
  "file.edited", "session.diff",
  // Tool events
  "session.next.tool.failed",
  // Permission
  "permission.asked", "permission.replied",
]);

export function ensureEventFile(eventFile: string): void {
  fs.mkdirSync(path.dirname(eventFile), { recursive: true });
  fs.appendFileSync(eventFile, "");
}

export function writeSseReadyMarker(input: {
  runId: string;
  serveUrl: string;
  eventFile: string;
  connectedAt: string;
}): void {
  const readyFile = process.env.SSE_READY_FILE;
  const runId = process.env.QODERWORK_TEST_RUN_ID;
  if (!readyFile) throw new Error("SSE_READY_FILE is required");
  if (!runId) throw new Error("QODERWORK_TEST_RUN_ID is required");
  const dir = path.dirname(readyFile);
  fs.mkdirSync(dir, { recursive: true });
  const content = JSON.stringify({
    runId: input.runId,
    serveUrl: input.serveUrl,
    eventFile: input.eventFile,
    connectedAt: input.connectedAt,
  });
  const tmp = `${readyFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, readyFile);
}

function log(msg: string) {
  const ts = new Date().toISOString();
  console.error(`[${ts}] ${msg}`);
}

function isRelevant(evt: any): boolean {
  const type = evt.type || evt.event || "";
  return RELEVANT_TYPES.has(type);
}

function archiveIfNeeded() {
  const now = new Date();
  const hour = now.getHours();

  if (currentHour !== -1 && hour !== currentHour) {
    // Hour changed — archive the current file
    try {
      fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
      const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 13); // YYYY-MM-DDTHH
      const archiveFile = path.join(ARCHIVE_DIR, `sse-events-${ts}.jsonl`);

      if (fs.existsSync(EVENT_FILE)) {
        const stat = fs.statSync(EVENT_FILE);
        if (stat.size > 0) {
          fs.renameSync(EVENT_FILE, archiveFile);
          log(`Archived → ${archiveFile} (${(stat.size / 1024).toFixed(1)}KB)`);
        }
      }
    } catch (e: any) {
      log(`Archive error: ${e.message}`);
    }
  }
  currentHour = hour;
}

// FW-SESSION-MAP-AUTO: Auto-write session_map for sessions created via serve API
// The session.created plugin hook doesn't fire for serve API sessions,
// so the SSE daemon writes the entry directly to framework-state.db
function autoWriteSessionMap(evt: any) {
  try {
    if (!FRAMEWORK_DB_PATH) {
      throw new Error("FRAMEWORK_DB_PATH is required");
    }

    const sessionID = evt.properties?.sessionID || evt.sessionID || "";
    const agent = evt.properties?.info?.agent || evt.properties?.agent || "";
    if (!sessionID) return;

    const db = new Database(FRAMEWORK_DB_PATH);
    db.run("PRAGMA busy_timeout=5000");
    try {
      db.run(
        `CREATE TABLE IF NOT EXISTS session_map (
          session_id TEXT PRIMARY KEY,
          agent TEXT,
          created_at INTEGER,
          updated_at INTEGER
        )`
      );

      // Check if entry already exists
      const existing = db.query("SELECT agent FROM session_map WHERE session_id = ?").get(sessionID) as any;
      if (existing) return;

      const now = Date.now();
      db.run(
        `INSERT OR IGNORE INTO session_map (session_id, agent, created_at, updated_at) VALUES (?, ?, ?, ?)`,
        [sessionID, agent || "unknown", now, now]
      );
      log(`Auto-wrote session_map: ${sessionID} → ${agent || "unknown"}`);
    } finally {
      db.close();
    }
  } catch (e: any) {
    log(`session_map auto-write failed: ${e.message}`);
  }
}

function appendEvent(evt: any) {
  const line = JSON.stringify({
    type: evt.type || evt.event,
    sessionID: evt.properties?.sessionID || evt.sessionID || "",
    timestamp: Date.now(),
    data: evt.properties || evt,
  }) + "\n";

  try {
    // Hourly archival
    archiveIfNeeded();

    // Size-based fallback (if file > 10MB between hourly rotations)
    try {
      const stat = fs.statSync(EVENT_FILE);
      if (stat.size > MAX_FILE_SIZE) {
        fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const archiveFile = path.join(ARCHIVE_DIR, `sse-events-overflow-${ts}.jsonl`);
        fs.renameSync(EVENT_FILE, archiveFile);
        log(`Size overflow archived → ${archiveFile}`);
      }
    } catch { /* file doesn't exist yet */ }

    fs.appendFileSync(EVENT_FILE, line);

    // Auto-write session_map for session.created events
    const eventType = evt.type || evt.event || "";
    if (eventType === "session.created") {
      autoWriteSessionMap(evt);
    }
  } catch (e: any) {
    log(`Write error: ${e.message}`);
  }
}

async function connectSSE(): Promise<void> {
  log(`Connecting to ${SERVE_URL}/event ...`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  let resp: Response;
  try {
    resp = await fetch(`${SERVE_URL}/event`, {
      headers: { Accept: "text/event-stream" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    throw new Error(`SSE connect failed: ${resp.status}`);
  }

  log("SSE connected");
  const reader = resp.body!.getReader();
  if (process.env.SSE_READY_FILE && process.env.QODERWORK_TEST_RUN_ID) {
    writeSseReadyMarker({
      runId: process.env.QODERWORK_TEST_RUN_ID,
      serveUrl: SERVE_URL,
      eventFile: EVENT_FILE,
      connectedAt: new Date().toISOString(),
    });
    log(`Wrote SSE ready marker: ${SSE_READY_FILE}`);
  }
  const decoder = new TextDecoder();
  let buffer = "";
  let eventCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      log("SSE stream ended");
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const evt = JSON.parse(line.slice(6));
          if (isRelevant(evt)) {
            appendEvent(evt);
            eventCount++;
            if (eventCount % 100 === 0) {
              log(`${eventCount} events written`);
            }
          }
        } catch {
          // Malformed JSON, skip
        }
      }
    }
  }
}

// Main loop with exponential backoff reconnect
async function main() {
  log("SSE Daemon starting");
  log(`Event file: ${EVENT_FILE}`);
  log(`Serve URL: ${SERVE_URL}`);
  if (!FRAMEWORK_DB_PATH) {
    throw new Error("FRAMEWORK_DB_PATH is required");
  }
  log(`Framework DB: ${FRAMEWORK_DB_PATH}`);
  ensureEventFile(EVENT_FILE);
  log(`Ensured event file exists: ${EVENT_FILE}`);

  let backoff = 1000;

  while (true) {
    try {
      await connectSSE();
      backoff = 1000; // Reset on successful connection
    } catch (e: any) {
      log(`Connection error: ${e.message}. Reconnecting in ${backoff}ms...`);
      await new Promise(r => setTimeout(r, backoff));
      backoff = Math.min(backoff * 2, 30000); // Max 30s
    }
  }
}

// Graceful shutdown
process.on("SIGINT", () => { log("SIGINT, exiting"); process.exit(0); });
process.on("SIGTERM", () => { log("SIGTERM, exiting"); process.exit(0); });

if (import.meta.main) {
  main();
}
