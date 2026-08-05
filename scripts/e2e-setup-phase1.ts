#!/usr/bin/env bun
/**
 * E2E test 3: Set up Phase 1 state (awaiting_guidance=1, token set, no guidance text)
 * Then simulate QoderWork delivering guidance via direct DB write
 * Usage: bun run e2e-setup-phase1.ts <session_id>
 */
import { Database } from "bun:sqlite";
import { randomBytes } from "crypto";

const DB_PATH = "${WORK_ONE_ROOT}/.opencode/state/framework-state.db";
const sessionId = process.argv[2] || "";

if (!sessionId) {
  console.error("Usage: bun run e2e-setup-phase1.ts <session_id>");
  process.exit(1);
}

const db = new Database(DB_PATH);
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA busy_timeout = 5000");

const now = Date.now();
const token = randomBytes(16).toString("hex");

// Set up Phase 1 state: awaiting_guidance=1, token set, guidance_text empty
db.run(
  `INSERT OR REPLACE INTO tool_enforcement 
   (session_id, agent, consecutive_failures, last_failure_at, total_failures, total_blocks, 
    created_at, updated_at, stop_injected, compliance_blocks, last_before_at, last_after_at, 
    awaiting_guidance, guidance_token, guidance_requested_at, guidance_text, 
    last_failure_tool, last_failure_type, last_failure_error)
   VALUES (?, 'Orchestrator', 2, ?, 2, 0, ?, ?, 1, 0, 0, 0, 1, ?, 0, '', 'test_tool', 'runtime_error', 'Phase 1 setup')`,
  [sessionId, now, now, now, token]
);

console.log("Phase 1 state set up. Token:", token);
console.log("Session:", sessionId);

// Verify
const row = db.query("SELECT session_id, consecutive_failures, awaiting_guidance, guidance_token, guidance_requested_at, guidance_text, stop_injected FROM tool_enforcement WHERE session_id = ?").get(sessionId) as any;
console.log("DB state:", JSON.stringify(row, null, 2));

db.close();
