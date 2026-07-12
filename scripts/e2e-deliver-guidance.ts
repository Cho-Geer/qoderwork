#!/usr/bin/env bun
/**
 * E2E test 3: Simulate QoderWork delivering guidance via direct DB write
 * This is the equivalent of deliver-guidance.sh but using bun:sqlite
 * Usage: bun run e2e-deliver-guidance.ts <session_id> <guidance_text>
 */
import { Database } from "bun:sqlite";

const DB_PATH = "/home/zhaoge/workspace/opencode/work-one/.opencode/state/framework-state.db";
const sessionId = process.argv[2] || "";
const guidanceText = process.argv[3] || "Default guidance from QoderWork";

if (!sessionId) {
  console.error("Usage: bun run e2e-deliver-guidance.ts <session_id> <guidance_text>");
  process.exit(1);
}

const db = new Database(DB_PATH);
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA busy_timeout = 5000");

const now = Date.now();
db.run(
  `UPDATE tool_enforcement SET 
     guidance_text = ?,
     guidance_requested_at = ?,
     awaiting_guidance = 1,
     updated_at = ?
   WHERE session_id = ?`,
  [guidanceText, now, now, sessionId]
);

console.log("Guidance delivered to session:", sessionId);
console.log("Guidance text:", guidanceText);

// Verify
const row = db.query("SELECT session_id, awaiting_guidance, guidance_requested_at, guidance_text FROM tool_enforcement WHERE session_id = ?").get(sessionId) as any;
console.log("DB state:", JSON.stringify(row, null, 2));

db.close();
