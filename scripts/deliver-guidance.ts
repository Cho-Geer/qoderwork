#!/usr/bin/env bun
/**
 * deliver-guidance.ts — Deliver guidance to a session (DB write via bun:sqlite)
 *
 * Replaces deliver-guidance.sh (which required sqlite3 CLI, not installed).
 * Same logic: UPDATE tool_enforcement SET awaiting_guidance=1, guidance_text=...
 *
 * Usage: bun run deliver-guidance.ts <session_id> <guidance_text>
 */
import Database from "bun:sqlite";

const DB_PATH = "/home/zhaoge/workspace/opencode/work-one/.opencode/state/framework-state.db";
const sid = process.argv[2];
const text = process.argv[3];

if (!sid || !text) {
  console.error("Usage: bun run deliver-guidance.ts <session_id> <guidance_text>");
  process.exit(1);
}

const db = new Database(DB_PATH);
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA busy_timeout = 10000");

const now = Date.now();
const stmt = db.prepare(`
  UPDATE tool_enforcement SET
    guidance_text = ?,
    guidance_requested_at = ?,
    awaiting_guidance = 1,
    updated_at = ?
  WHERE session_id = ?
`);
const info = stmt.run(text, now, now, sid);
console.log(JSON.stringify({
  session_id: sid,
  changes: info.changes,
  awaiting_guidance: 1,
  guidance_text_len: text.length,
  timestamp: now,
}));
