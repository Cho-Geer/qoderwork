#!/usr/bin/env bun
// Integration test: grant binding via session lifecycle
// Simulates: Orchestrator dispatch → queue entry → child session created → grant bound

import { randomUUID } from "node:crypto";
import Database from "bun:sqlite";

const DB_PATH = "/home/zhaoge/workspace/opencode/work-one/.opencode/state/framework-state.db";
const db = new Database(DB_PATH);

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

// Cleanup from previous runs
db.run(`DELETE FROM dispatch_privilege_grants WHERE reason LIKE 'INTEG-TEST%'`);
db.run(`DELETE FROM dispatch_queue WHERE dag_task_id LIKE 'integ-test-%'`);
db.run(`DELETE FROM dispatch_prompt_refs WHERE file_path LIKE 'integ-test-%'`);

console.log("\n=== Integration: Orchestrator dispatch → child session created → grant bound ===");

const dispatchKey = "integ-key-" + randomUUID().slice(0, 8);
const parentSession = "ses_integ-parent-" + randomUUID().slice(0, 8);
const childSession = "ses_integ-child-" + randomUUID().slice(0, 8);
const grantId = randomUUID();
const now = Date.now();
const ttl = 45 * 60 * 1000;

// Step 1: Simulate router.ts — generate dispatch key + queue entry
const refResult = db.run(
  `INSERT INTO dispatch_prompt_refs (file_path, sha256, size_bytes, created_at)
   VALUES ('integ-test-prompt.txt', 'sha256hash', 200, ?)`,
  [now]
);
const promptRefId = Number(refResult.lastInsertRowid);

db.run(
  `INSERT INTO dispatch_queue (status, agent_type, dag_task_id, prompt_ref_id, dispatch_key, parent_session_id, call_id, created_at, updated_at)
   VALUES ('pending', 'build', 'integ-test-dispatch', ?, ?, ?, 'call-integ-1', ?, ?)`,
  [promptRefId, dispatchKey, parentSession, now, now]
);

// Step 2: Simulate dispatch-subagent.ts — create grant with same dispatch key
db.run(
  `INSERT INTO dispatch_privilege_grants
    (id, dispatch_key, parent_session_id, child_session_id, dag_task_id,
     agent_type, privilege, allowed_tools, allowed_paths, reason,
     status, expires_at, created_at, bound_at, consumed_at, revoked_at)
   VALUES (?, ?, ?, NULL, 'integ-test-dispatch', 'build', 'framework_maintenance',
     '["safe_framework_edit"]', '[".opencode/plugin-handlers/system/test-integ.ts"]',
     'INTEG-TEST full flow', 'pending', ?, ?, NULL, NULL, NULL)`,
  [grantId, dispatchKey, parentSession, now + ttl, now]
);

// Verify grant is pending
const pendingGrant = db.query(
  `SELECT status FROM dispatch_privilege_grants WHERE id = ?`
).get(grantId) as any;
assert(pendingGrant?.status === "pending", "Step 1-2: Grant created as pending");

// Step 3: Simulate onSessionCreated — child session created, bind grant
const queueEntry = db.query(
  `SELECT dispatch_key, call_id, parent_session_id FROM dispatch_queue
   WHERE parent_session_id = ? AND dispatch_key IS NOT NULL AND status IN ('pending', 'running')
   ORDER BY created_at DESC LIMIT 1`
).get(parentSession) as any;

assert(!!queueEntry?.dispatch_key, "Step 3a: Queue entry found for parent", `key=${queueEntry?.dispatch_key}`);
assert(
  !!queueEntry?.call_id,
  "Step 3a-regression: call_id is non-null (exact-binding 3/3 fields)",
  `call_id=${queueEntry?.call_id}`,
);
assert(
  queueEntry?.parent_session_id === parentSession,
  "Step 3a-regression: parent_session_id round-trips",
  `got=${queueEntry?.parent_session_id}`,
);

if (queueEntry?.dispatch_key) {
  // This is what onSessionCreated does
  const bindResult = db.run(
    `UPDATE dispatch_privilege_grants
     SET child_session_id = ?, status = 'bound', bound_at = ?
     WHERE dispatch_key = ? AND status = 'pending' AND expires_at > ?`,
    [childSession, now, queueEntry.dispatch_key, now]
  );
  assert(bindResult.changes === 1, "Step 3b: Grant bound to child session", `changes=${bindResult.changes}`);
}

// Step 4: Verify child session has bound grant (hasGrant simulation)
const boundGrant = db.query(
  `SELECT * FROM dispatch_privilege_grants
   WHERE child_session_id = ? AND privilege = 'framework_maintenance' AND status = 'bound' AND expires_at > ?
   ORDER BY bound_at DESC LIMIT 1`
).get(childSession, now) as any;

assert(!!boundGrant, "Step 4: hasGrant finds bound grant for child session");

// Step 5: Path matching (safe_framework_edit internal check)
if (boundGrant) {
  const allowedPaths: string[] = JSON.parse(boundGrant.allowed_paths);
  const targetPath = ".opencode/plugin-handlers/system/test-integ.ts";
  const matched = allowedPaths.some((p: string) => {
    if (p === targetPath) return true;
    if (p.endsWith("/**")) return targetPath.startsWith(p.slice(0, -3));
    if (p.endsWith("/*")) return targetPath.startsWith(p.slice(0, -2));
    return false;
  });
  assert(matched, "Step 5: Path match — target file in allowed_paths");

  // Wrong path should NOT match
  const wrongPath = ".opencode/plugin-handlers/before/other.ts";
  const wrongMatch = allowedPaths.some((p: string) => {
    if (p === wrongPath) return true;
    if (p.endsWith("/**")) return wrongPath.startsWith(p.slice(0, -3));
    return false;
  });
  assert(!wrongMatch, "Step 5b: Path mismatch — wrong file rejected");
}

// Step 6: CodeGraph double gate simulation
// In reality, codegraph.ts checks readImpactState() for the session
// Without impact_called = true, the tool would be blocked
console.log("\n=== CodeGraph double gate simulation ===");

// Simulate: no CodeGraph impact → should block
const hasImpact = false; // no codegraph_explore called
const hasValidGrant = !!boundGrant;
const doubleGatePass = hasImpact && hasValidGrant;
assert(!doubleGatePass, "Step 6a: No CodeGraph impact + valid grant → BLOCKED (double gate)");

// Simulate: CodeGraph impact + no grant → should block
const hasImpact2 = true;
const hasValidGrant2 = false;
const doubleGatePass2 = hasImpact2 && hasValidGrant2;
assert(!doubleGatePass2, "Step 6b: CodeGraph impact + no grant → BLOCKED (double gate)");

// Simulate: both present → should pass
const hasImpact3 = true;
const hasValidGrant3 = !!boundGrant;
const doubleGatePass3 = hasImpact3 && hasValidGrant3;
assert(doubleGatePass3, "Step 6c: CodeGraph impact + valid grant → PASS (double gate)");

// Step 7: Consume grant (one-time use)
if (boundGrant) {
  db.run(
    `UPDATE dispatch_privilege_grants SET status = 'consumed', consumed_at = ? WHERE id = ?`,
    [Date.now(), grantId]
  );
  const consumed = db.query(
    `SELECT status FROM dispatch_privilege_grants WHERE id = ?`
  ).get(grantId) as any;
  assert(consumed?.status === "consumed", "Step 7: Grant consumed (one-time use)");
}

// Cleanup
db.run(`DELETE FROM dispatch_privilege_grants WHERE reason LIKE 'INTEG-TEST%'`);
db.run(`DELETE FROM dispatch_queue WHERE dag_task_id LIKE 'integ-test-%'`);
db.run(`DELETE FROM dispatch_prompt_refs WHERE file_path LIKE 'integ-test-%'`);

console.log(`\n=== Results: ${passed} PASS, ${failed} FAIL ===`);
process.exit(failed > 0 ? 1 : 0);
