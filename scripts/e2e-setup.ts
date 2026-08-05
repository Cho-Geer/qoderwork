#!/usr/bin/env bun
/**
 * E2E test helper: set up tool_enforcement state for a session
 * Usage: bun run e2e-setup.ts <session_id> <consecutive_failures> <stop_injected> <last_failure_tool>
 */
import { Database } from "bun:sqlite";

const DB_PATH = "${WORK_ONE_ROOT}/.opencode/state/framework-state.db";
const sessionId = process.argv[2] || "";
const failures = parseInt(process.argv[3] || "0");
const stopInjected = parseInt(process.argv[4] || "0");
const lastTool = process.argv[5] || "test_tool";

if (!sessionId) {
  console.error("Usage: bun run e2e-setup.ts <session_id> <consecutive_failures> <stop_injected> <last_failure_tool>");
  process.exit(1);
}

const db = new Database(DB_PATH);
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA busy_timeout = 5000");

const now = Date.now();
db.run(
  `INSERT OR REPLACE INTO tool_enforcement 
   (session_id, agent, consecutive_failures, last_failure_at, total_failures, total_blocks, 
    created_at, updated_at, stop_injected, compliance_blocks, last_before_at, last_after_at, 
    awaiting_guidance, guidance_token, guidance_requested_at, guidance_text, 
    last_failure_tool, last_failure_type, last_failure_error)
   VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 0, 0, 0, 0, '', 0, '', ?, 'runtime_error', 'E2E simulated failure')`,
  [sessionId, "Orchestrator", failures, now, failures, now, now, stopInjected, lastTool]
);

const row = db.query("SELECT session_id, consecutive_failures, stop_injected, last_failure_tool, awaiting_guidance FROM tool_enforcement WHERE session_id = ?").get(sessionId) as any;
console.log(JSON.stringify(row, null, 2));
db.close();
