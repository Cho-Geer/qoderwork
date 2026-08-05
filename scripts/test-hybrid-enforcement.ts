#!/usr/bin/env bun
/**
 * Unit tests for Question Hybrid Enforcement
 * Tests blueprint §6.1: checkThreshold, rewardReport, clearGuidance, getGuidanceStatus
 *
 * Usage: OPENCODE_ROOT=/tmp/test-hybrid-enforcement bun run test-hybrid-enforcement.ts
 */
import { Database } from "bun:sqlite";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { resolveWorkspacePaths } from "./lib/workspace-paths";
const { workOneRoot } = resolveWorkspacePaths({ env: process.env });

// ── Setup test DB ──
const TEST_ROOT = "/tmp/test-hybrid-enforcement";
const DB_DIR = join(TEST_ROOT, ".opencode", "state");
const DB_PATH = join(DB_DIR, "framework-state.db");

// Clean slate
if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
mkdirSync(DB_DIR, { recursive: true });

process.env.OPENCODE_ROOT = TEST_ROOT;

// Create schema
const db = new Database(DB_PATH);
db.run("PRAGMA journal_mode = WAL");
db.run(`
  CREATE TABLE IF NOT EXISTS tool_enforcement (
    session_id TEXT PRIMARY KEY,
    agent TEXT DEFAULT '',
    consecutive_failures INTEGER DEFAULT 0,
    last_failure_at INTEGER DEFAULT 0,
    total_failures INTEGER DEFAULT 0,
    total_blocks INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT 0,
    stop_injected INTEGER DEFAULT 0,
    compliance_blocks INTEGER DEFAULT 0,
    last_before_at INTEGER DEFAULT 0,
    last_after_at INTEGER DEFAULT 0,
    awaiting_guidance INTEGER DEFAULT 0,
    guidance_token TEXT DEFAULT '',
    guidance_requested_at INTEGER DEFAULT 0,
    guidance_text TEXT DEFAULT '',
    last_failure_tool TEXT DEFAULT '',
    last_failure_type TEXT DEFAULT '',
    last_failure_error TEXT DEFAULT ''
  )
`);

// Import after OPENCODE_ROOT is set
const {
  checkThreshold,
  rewardReport,
  clearGuidance,
  getGuidanceStatus,
  getFailureSummary,
  recordResult,
  setConfig,
  closeDb,
} = await (async () => {
  const target = pathToFileURL(resolve(workOneRoot, '.opencode/service/enforcement/tool-tracker.ts')).href;
  return await import(target);
})();

// Ensure config uses test thresholds
setConfig({ softThreshold: 2, hardThreshold: 4, totalLimit: 15, complianceThreshold: 3, ttlMs: 3600_000 });

const TEST_SESSION = "ses_test_hybrid_001";
const TEST_AGENT = "test-agent";

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

function resetSession() {
  db.run("DELETE FROM tool_enforcement WHERE session_id = ?", [TEST_SESSION]);
  db.run(
    `INSERT INTO tool_enforcement (session_id, agent, consecutive_failures, last_failure_at, total_failures, total_blocks, created_at, updated_at, stop_injected, compliance_blocks, last_before_at, last_after_at, awaiting_guidance, guidance_token, guidance_requested_at, guidance_text, last_failure_tool, last_failure_type, last_failure_error)
     VALUES (?, ?, 0, 0, 0, 0, ?, ?, 0, 0, 0, 0, 0, '', 0, '', '', '', '')`,
    [TEST_SESSION, TEST_AGENT, Date.now(), Date.now()]
  );
  // Close and reopen DB connection in tool-tracker so it picks up fresh data
  closeDb();
}

// ═══════════════════════════════════════════════════════════════
console.log("\n═══ Test 1: checkThreshold() at consecutive_failures=2 ═══");
resetSession();

// Simulate 2 failures
const failOutput1 = { output: "Error: something went wrong", metadata: { error: "test error 1" } };
const failOutput2 = { output: "Error: another failure", metadata: { error: "test error 2" } };
recordResult(TEST_SESSION, TEST_AGENT, "test_tool", failOutput1);
recordResult(TEST_SESSION, TEST_AGENT, "test_tool", failOutput2);

const thresholdResult = checkThreshold(TEST_SESSION);
assert(thresholdResult.shouldInject === true, `shouldInject should be true (got ${thresholdResult.shouldInject})`);
assert(thresholdResult.count === 2, `count should be 2 (got ${thresholdResult.count})`);
assert(thresholdResult.directive.includes("question"), `directive should mention "question" tool`);
assert(thresholdResult.directive.includes("test_tool"), `directive should mention failed tool name`);
assert(!thresholdResult.directive.includes("acp_notify"), `directive should NOT mention acp_notify`);

// ═══════════════════════════════════════════════════════════════
console.log("\n═══ Test 2: rewardReport() generates token when failures > 0 ═══");
resetSession();

// Simulate 1 failure (enough for rewardReport to work, needs > 0)
const failOutput = { output: "Error: test failure", metadata: { error: "test error" } };
recordResult(TEST_SESSION, TEST_AGENT, "test_tool", failOutput);

const reportResult = rewardReport(TEST_SESSION, TEST_AGENT);
assert(reportResult.token.length === 32, `token should be 32 chars hex (got ${reportResult.token.length})`);
assert(reportResult.previousCount > 0, `previousCount should be > 0 (got ${reportResult.previousCount})`);

// Verify DB state
const row1 = db.query("SELECT awaiting_guidance, stop_injected, guidance_token FROM tool_enforcement WHERE session_id = ?").get(TEST_SESSION) as any;
assert(row1.awaiting_guidance === 1, `awaiting_guidance should be 1 (got ${row1.awaiting_guidance})`);
assert(row1.stop_injected === 1, `stop_injected should be 1 (got ${row1.stop_injected})`);
assert(row1.guidance_token === reportResult.token, `DB token should match returned token`);

// ═══════════════════════════════════════════════════════════════
console.log("\n═══ Test 3: clearGuidance() with valid token resets counters ═══");
// Continue from Test 2 state (awaiting_guidance=1, token set)
const clearResult = clearGuidance(TEST_SESSION, TEST_AGENT, reportResult.token);
assert(clearResult.success === true, `clearGuidance should succeed with valid token`);

const row2 = db.query("SELECT consecutive_failures, compliance_blocks, awaiting_guidance, stop_injected, guidance_token FROM tool_enforcement WHERE session_id = ?").get(TEST_SESSION) as any;
assert(row2.consecutive_failures === 0, `consecutive_failures should be 0 (got ${row2.consecutive_failures})`);
assert(row2.compliance_blocks === 0, `compliance_blocks should be 0 (got ${row2.compliance_blocks})`);
assert(row2.awaiting_guidance === 0, `awaiting_guidance should be 0 (got ${row2.awaiting_guidance})`);
assert(row2.stop_injected === 0, `stop_injected should be 0 (got ${row2.stop_injected})`);
assert(row2.guidance_token === "", `guidance_token should be empty after clear`);

// ═══════════════════════════════════════════════════════════════
console.log("\n═══ Test 4: clearGuidance() with invalid token returns success=false ═══");
resetSession();

// Set up awaiting state
recordResult(TEST_SESSION, TEST_AGENT, "test_tool", failOutput);
rewardReport(TEST_SESSION, TEST_AGENT);

const invalidResult = clearGuidance(TEST_SESSION, TEST_AGENT, "invalid_token_12345");
assert(invalidResult.success === false, `clearGuidance should fail with invalid token`);
assert(!!invalidResult.error&&invalidResult.error.includes("Invalid"), `error should mention invalid token (got: ${invalidResult.error})`);

// Verify gate still locked
const row3 = db.query("SELECT awaiting_guidance FROM tool_enforcement WHERE session_id = ?").get(TEST_SESSION) as any;
assert(row3.awaiting_guidance === 1, `awaiting_guidance should still be 1 (gate locked)`);

// ═══════════════════════════════════════════════════════════════
console.log("\n═══ Test 5: getGuidanceStatus() returns correct state ═══");
resetSession();

// 5a: Not in guidance gate
const status1 = getGuidanceStatus(TEST_SESSION);
assert(status1.awaiting === false, `awaiting should be false when not in gate`);
assert(status1.lastFailureTool === "", `lastFailureTool should be empty when no failures`);

// 5b: In Phase 1 (awaiting, not delivered)
recordResult(TEST_SESSION, TEST_AGENT, "test_tool", failOutput);
rewardReport(TEST_SESSION, TEST_AGENT);
const status2 = getGuidanceStatus(TEST_SESSION);
assert(status2.awaiting === true, `awaiting should be true after rewardReport`);
assert(status2.delivered === false, `delivered should be false (Phase 1, no guidance text yet)`);
assert(status2.lastFailureTool === "test_tool", `lastFailureTool should be "test_tool" (got: ${status2.lastFailureTool})`);

// 5c: In Phase 2 (guidance delivered via DB write)
const guidanceText = "Please use a different approach";
const now = Date.now();
db.run(
  `UPDATE tool_enforcement SET guidance_text = ?, guidance_requested_at = ? WHERE session_id = ?`,
  [guidanceText, now, TEST_SESSION]
);
const status3 = getGuidanceStatus(TEST_SESSION);
assert(status3.awaiting === true, `awaiting should still be true in Phase 2`);
assert(status3.delivered === true, `delivered should be true after guidance text set`);
assert(status3.guidanceText === guidanceText, `guidanceText should match (got: ${status3.guidanceText})`);

// ═══════════════════════════════════════════════════════════════
console.log("\n═══ Test 6: Full question recovery flow (rewardReport → clearGuidance) ═══");
resetSession();

// Simulate 2 failures (softThreshold)
recordResult(TEST_SESSION, TEST_AGENT, "failing_tool", failOutput);
recordResult(TEST_SESSION, TEST_AGENT, "failing_tool", failOutput);

// Simulate after-hook question detection — use getFailureSummary (not getGuidanceStatus)
// because getGuidanceStatus returns empty lastFailureTool when awaiting_guidance=0
const beforeSummary = getFailureSummary(TEST_SESSION);
assert(beforeSummary !== null, `getFailureSummary should return a result`);
assert(beforeSummary!.lastTool === "failing_tool", `lastTool should be "failing_tool" before recovery (got: ${beforeSummary!.lastTool})`);
assert(beforeSummary!.consecutiveFailures === 2, `consecutiveFailures should be 2 (got: ${beforeSummary!.consecutiveFailures})`);

const recoveryResult = rewardReport(TEST_SESSION, TEST_AGENT);
assert(recoveryResult.token.length > 0, `rewardReport should generate token`);

const clearResult2 = clearGuidance(TEST_SESSION, TEST_AGENT, recoveryResult.token);
assert(clearResult2.success === true, `clearGuidance should succeed`);

const finalRow = db.query("SELECT consecutive_failures, awaiting_guidance, stop_injected FROM tool_enforcement WHERE session_id = ?").get(TEST_SESSION) as any;
assert(finalRow.consecutive_failures === 0, `consecutive_failures should be 0 after recovery (got ${finalRow.consecutive_failures})`);
assert(finalRow.awaiting_guidance === 0, `awaiting_guidance should be 0 after recovery`);
assert(finalRow.stop_injected === 0, `stop_injected should be 0 after recovery`);

// ═══ Summary ═══
console.log(`\n══════════════════════════════════════`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`══════════════════════════════════════`);

db.close();
closeDb();

if (failed > 0) {
  process.exit(1);
} else {
  console.log("All tests passed! ✅");
}
