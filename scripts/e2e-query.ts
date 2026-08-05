#!/usr/bin/env bun
/**
 * E2E test helper: query tool_enforcement state for a session
 * Usage: bun run e2e-query.ts <session_id>
 */
import { Database } from "bun:sqlite";

const DB_PATH = "${WORK_ONE_ROOT}/.opencode/state/framework-state.db";
const sessionId = process.argv[2] || "";

if (!sessionId) {
  console.error("Usage: bun run e2e-query.ts <session_id>");
  process.exit(1);
}

const db = new Database(DB_PATH);
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA busy_timeout = 5000");

const row = db.query(
  `SELECT session_id, agent, consecutive_failures, total_failures, total_blocks,
          stop_injected, compliance_blocks, awaiting_guidance, guidance_token,
          guidance_requested_at, guidance_text, last_failure_tool, last_failure_type, 
          last_failure_error, last_before_at, last_after_at
   FROM tool_enforcement WHERE session_id = ?`
).get(sessionId) as any;

if (!row) {
  console.log(JSON.stringify({ error: "Session not found", sessionId }, null, 2));
} else {
  console.log(JSON.stringify(row, null, 2));
}
db.close();
