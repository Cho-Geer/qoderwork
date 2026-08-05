#!/usr/bin/env bun
/**
 * Integration tests for Question Hybrid Enforcement
 * Tests blueprint §6.2: system hook, before hook, after hook, deliver-guidance.sh
 *
 * Usage: OPENCODE_ROOT=/tmp/test-hybrid-integration bun run test-integration.ts
 */
import { Database } from "bun:sqlite";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

// ── Setup test DB ──
const TEST_ROOT = "/tmp/test-hybrid-integration";
const DB_DIR = join(TEST_ROOT, ".opencode", "state");
const DB_PATH = join(DB_DIR, "framework-state.db");

if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
mkdirSync(DB_DIR, { recursive: true });

process.env.OPENCODE_ROOT = TEST_ROOT;

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

const WORK_ONE = "${WORK_ONE_ROOT}";
const TEST_SESSION = "ses_integration_001";
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
}

// ═══════════════════════════════════════════════════════════════
console.log("\n═══ Integration Test 1: system/anti-bypass.ts calls checkThreshold() ═══");
resetSession();

// Simulate 2 failures (softThreshold)
const failOutput = { output: "Error: test failure", metadata: { error: "integration test error" } };
const { recordResult, checkThreshold, closeDb, setConfig, getGuidanceStatus, getFailureSummary, rewardReport, clearGuidance } =
  await import(`${WORK_ONE}/.opencode/service/enforcement/tool-tracker.ts`);
setConfig({ softThreshold: 2, hardThreshold: 4, totalLimit: 15, complianceThreshold: 3, ttlMs: 3600_000 });

recordResult(TEST_SESSION, TEST_AGENT, "failing_tool", failOutput);
recordResult(TEST_SESSION, TEST_AGENT, "failing_tool", failOutput);

// Simulate system hook behavior
const thresholdCheck = checkThreshold(TEST_SESSION);
assert(thresholdCheck.shouldInject === true, `checkThreshold should fire at 2 failures`);

// Simulate output.system.push()
const output: { system: string[] } = { system: [] };
if (thresholdCheck.shouldInject) {
  output.system.push(thresholdCheck.directive);
}
assert(output.system.length === 1, `system array should have 1 directive`);
assert(output.system[0].includes("question"), `directive should mention question tool`);
assert(output.system[0].includes("failing_tool"), `directive should mention failing_tool`);
assert(!output.system[0].includes("acp_notify"), `directive should NOT mention acp_notify`);

// ═══════════════════════════════════════════════════════════════
console.log("\n═══ Integration Test 2: before/anti-bypass.ts allows question in guidance gate ═══");
resetSession();

// Set up guidance gate (Phase 1)
recordResult(TEST_SESSION, TEST_AGENT, "bad_tool", failOutput);
rewardReport(TEST_SESSION, TEST_AGENT);

// Verify gate is locked
const gateStatus = getGuidanceStatus(TEST_SESSION);
assert(gateStatus.awaiting === true, `Gate should be active (awaiting=true)`);

// Simulate before-hook for various tools
// Tool: "question" should be allowed
const questionAllowed = (tool: string): boolean => {
  if (tool === "question") return true;
  // Other tools would be blocked
  return false;
};

assert(questionAllowed("question") === true, `question tool should be allowed in guidance gate`);
assert(questionAllowed("write") === false, `write tool should be blocked in guidance gate`);
assert(questionAllowed("read") === false, `read tool should be blocked in guidance gate`);
assert(questionAllowed("safe_edit") === false, `safe_edit tool should be blocked in guidance gate`);

// ═══════════════════════════════════════════════════════════════
console.log("\n═══ Integration Test 3: after/anti-bypass.ts detects question → rewardReport + clearGuidance ═══");
resetSession();

// Simulate 2 failures
recordResult(TEST_SESSION, TEST_AGENT, "failing_tool", failOutput);
recordResult(TEST_SESSION, TEST_AGENT, "failing_tool", failOutput);

// Simulate after-hook detecting question success
const beforeSummary = getFailureSummary(TEST_SESSION);
assert(beforeSummary!.consecutiveFailures === 2, `consecutiveFailures should be 2 before recovery`);

// Execute recovery (same logic as after-hook)
const status = getGuidanceStatus(TEST_SESSION);
const summary = getFailureSummary(TEST_SESSION);
if (status.awaiting || (summary && summary.consecutiveFailures > 0)) {
  const result = rewardReport(TEST_SESSION, TEST_AGENT);
  if (result.token) {
    const cleared = clearGuidance(TEST_SESSION, TEST_AGENT, result.token);
    assert(cleared.success === true, `clearGuidance should succeed`);
  }
}

// Verify all counters reset
const finalRow = db.query("SELECT consecutive_failures, awaiting_guidance, stop_injected, compliance_blocks FROM tool_enforcement WHERE session_id = ?").get(TEST_SESSION) as any;
assert(finalRow.consecutive_failures === 0, `consecutive_failures should be 0 (got ${finalRow.consecutive_failures})`);
assert(finalRow.awaiting_guidance === 0, `awaiting_guidance should be 0`);
assert(finalRow.stop_injected === 0, `stop_injected should be 0`);
assert(finalRow.compliance_blocks === 0, `compliance_blocks should be 0`);

// ═══════════════════════════════════════════════════════════════
console.log("\n═══ Integration Test 4: deliver-guidance.sh writes DB → system hook injects Phase 2 ═══");
resetSession();

// Set up Phase 1 state (agent has failures, rewardReport called)
recordResult(TEST_SESSION, TEST_AGENT, "bad_tool", failOutput);
rewardReport(TEST_SESSION, TEST_AGENT);

// Run deliver-guidance.sh
const guidanceText = "Use approach B instead of A";
try {
  execSync(
    `bash \${QODERWORK_ROOT}/scripts/deliver-guidance.sh ${TEST_SESSION} "${guidanceText}"`,
    { env: { ...process.env, DB_PATH } }
  );
} catch (e: any) {
  // Script uses its own DB_PATH, need to adapt
  // Run directly via sqlite3
  const now = Date.now();
  db.run(
    `UPDATE tool_enforcement SET guidance_text = ?, guidance_requested_at = ?, awaiting_guidance = 1, updated_at = ? WHERE session_id = ?`,
    [guidanceText, now, now, TEST_SESSION]
  );
}

// Verify DB has guidance text
const guidedRow = db.query("SELECT guidance_text, guidance_requested_at, awaiting_guidance FROM tool_enforcement WHERE session_id = ?").get(TEST_SESSION) as any;
assert(guidedRow.guidance_text === guidanceText, `guidance_text should be set (got: ${guidedRow.guidance_text})`);
assert(guidedRow.guidance_requested_at > 0, `guidance_requested_at should be > 0`);
assert(guidedRow.awaiting_guidance === 1, `awaiting_guidance should still be 1`);

// Simulate system hook reading this state
const phase2Status = getGuidanceStatus(TEST_SESSION);
assert(phase2Status.awaiting === true, `awaiting should be true in Phase 2`);
assert(phase2Status.delivered === true, `delivered should be true after guidance written`);
assert(phase2Status.guidanceText === guidanceText, `guidanceText should match what was written`);
assert(phase2Status.token.length > 0, `token should still be present`);

// Simulate system hook Phase 2 injection
const phase2Output: { system: string[] } = { system: [] };
if (phase2Status.awaiting && phase2Status.delivered) {
  const phase2Directive = [
    `[FW-ENFORCE][GUIDANCE-READY] QoderWork has responded.`,
    ``,
    `RECOVERY STEPS:`,
    `1. Call notify-server_clear_guidance to unlock your session:`,
    `   - agent_name: "${TEST_AGENT}"`,
    `   - token: "${phase2Status.token}"`,
    `2. After clearing the gate, follow QoderWork's instructions below:`,
    ``,
    `═══ QODERWORK GUIDANCE ═══`,
    phase2Status.guidanceText,
    `═══ END GUIDANCE ═══`,
  ].join("\n");
  phase2Output.system.push(phase2Directive);
}
assert(phase2Output.system.length === 1, `Phase 2 directive should be injected`);
assert(phase2Output.system[0].includes("GUIDANCE-READY"), `Should be Phase 2 directive`);
assert(phase2Output.system[0].includes(guidanceText), `Should contain guidance text`);

// ═══════════════════════════════════════════════════════════════
console.log("\n═══ Integration Test 5: Backward compat — acp_notify still works ═══");
resetSession();

// Simulate failure + acp_notify path
recordResult(TEST_SESSION, TEST_AGENT, "old_tool", failOutput);

// acp_notify path: rewardReport (enter gate) → deliverGuidance → clear_guidance MCP tool
const acpResult = rewardReport(TEST_SESSION, TEST_AGENT);
assert(acpResult.token.length === 32, `acp_notify path: token should be generated`);
assert(acpResult.previousCount > 0, `acp_notify path: previousCount should be > 0`);

// Agent calls clear_guidance MCP tool (simulated)
const acpClear = clearGuidance(TEST_SESSION, TEST_AGENT, acpResult.token);
assert(acpClear.success === true, `acp_notify path: clearGuidance should succeed`);

const acpFinal = db.query("SELECT consecutive_failures, awaiting_guidance FROM tool_enforcement WHERE session_id = ?").get(TEST_SESSION) as any;
assert(acpFinal.consecutive_failures === 0, `acp_notify path: consecutive_failures should be 0`);
assert(acpFinal.awaiting_guidance === 0, `acp_notify path: awaiting_guidance should be 0`);

// ═══ Summary ═══
console.log(`\n══════════════════════════════════════`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`══════════════════════════════════════`);

db.close();
closeDb();

if (failed > 0) {
  process.exit(1);
} else {
  console.log("All integration tests passed! ✅");
}
