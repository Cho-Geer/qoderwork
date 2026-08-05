#!/usr/bin/env bun
/**
 * Clean up E2E test sessions from the DB
 */
import { Database } from "bun:sqlite";

const DB_PATH = "${WORK_ONE_ROOT}/.opencode/state/framework-state.db";
const db = new Database(DB_PATH);
db.run("PRAGMA journal_mode = WAL");

// Delete all E2E test sessions
const result = db.run("DELETE FROM tool_enforcement WHERE session_id LIKE 'ses_0d3%'");
console.log("Deleted rows:", result.changes);

// Verify
const remaining = db.query("SELECT session_id FROM tool_enforcement").all();
console.log("Remaining sessions:", remaining.length);

db.close();
