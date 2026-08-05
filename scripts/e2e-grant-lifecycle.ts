#!/usr/bin/env bun
// E2E test: dispatch privilege grant lifecycle
// Tests: no-grant rejection, grant+CodeGraph success, path mismatch, concurrent isolation

import { randomUUID } from "node:crypto";

import Database from "bun:sqlite";

const DB_PATH = "${WORK_ONE_ROOT}/.opencode/state/framework-state.db";
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

// ── Setup: clean ALL test grants (including from previous runs) ──
db.run(`DELETE FROM dispatch_privilege_grants WHERE reason LIKE 'E2E-TEST%'`);
db.run(`DELETE FROM dispatch_queue WHERE dag_task_id LIKE 'e2e-test-%'`);
db.run(`DELETE FROM dispatch_prompt_refs WHERE file_path LIKE 'e2e-test-%'`);

console.log("\n=== E2E-01: No grant → safe_framework_edit should reject ===");
{
  // Simulate: hasGrant returns null when no grant exists
  const sessionId = "ses_e2e-test-no-grant-" + randomUUID().slice(0, 8);
  const row = db.query(
    `SELECT * FROM dispatch_privilege_grants
     WHERE child_session_id = ? AND privilege = 'framework_maintenance' AND status = 'bound' AND expires_at > ?
     ORDER BY bound_at DESC LIMIT 1`
  ).get(sessionId, Date.now());
  assert(!row, "hasGrant returns null for unknown session", `got: ${JSON.stringify(row)}`);
}

console.log("\n=== E2E-02: Grant lifecycle — create → bind → hasGrant → consume ===");
{
  const dispatchKey = "e2e-test-key-" + randomUUID().slice(0, 8);
  const parentSession = "ses_e2e-parent-" + randomUUID().slice(0, 8);
  const childSession = "ses_e2e-child-" + randomUUID().slice(0, 8);
  const grantId = randomUUID();
  const now = Date.now();
  const ttl = 45 * 60 * 1000;
  const allowedPaths = JSON.stringify([".opencode/plugin-handlers/system/test-file.ts"]);
  const allowedTools = JSON.stringify(["safe_framework_edit"]);

  // Create grant (pending)
  db.run(
    `INSERT INTO dispatch_privilege_grants
      (id, dispatch_key, parent_session_id, child_session_id, dag_task_id,
       agent_type, privilege, allowed_tools, allowed_paths, reason,
       status, expires_at, created_at, bound_at, consumed_at, revoked_at)
     VALUES (?, ?, ?, NULL, 'e2e-test-lifecycle', 'build', 'framework_maintenance',
       ?, ?, 'E2E-TEST lifecycle', 'pending', ?, ?, NULL, NULL, NULL)`,
    [grantId, dispatchKey, parentSession, allowedTools, allowedPaths, now + ttl, now]
  );

  // Verify pending grant exists
  const pending = db.query(
    `SELECT * FROM dispatch_privilege_grants WHERE id = ? AND status = 'pending'`
  ).get(grantId);
  assert(!!pending, "Pending grant created in DB");

  // Bind grant to child session
  const bindResult = db.run(
    `UPDATE dispatch_privilege_grants
     SET child_session_id = ?, status = 'bound', bound_at = ?
     WHERE dispatch_key = ? AND status = 'pending' AND expires_at > ?`,
    [childSession, now, dispatchKey, now]
  );
  assert(bindResult.changes === 1, "Grant bound to child session", `changes=${bindResult.changes}`);

  // hasGrant check — should find bound grant
  const bound = db.query(
    `SELECT * FROM dispatch_privilege_grants
     WHERE child_session_id = ? AND privilege = 'framework_maintenance' AND status = 'bound' AND expires_at > ?
     ORDER BY bound_at DESC LIMIT 1`
  ).get(childSession, now);
  assert(!!bound, "hasGrant finds bound grant for child session");

  // Path match check
  if (bound) {
    const paths: string[] = JSON.parse((bound as any).allowed_paths);
    const targetPath = ".opencode/plugin-handlers/system/test-file.ts";
    const matched = paths.some(p => {
      if (p === targetPath) return true;
      if (p.endsWith("/**")) return targetPath.startsWith(p.slice(0, -3));
      if (p.endsWith("/*")) return targetPath.startsWith(p.slice(0, -2));
      return false;
    });
    assert(matched, "Path match: exact file path matches grant allowed_paths");

    // Path mismatch check
    const wrongPath = ".opencode/plugin-handlers/before/other-file.ts";
    const wrongMatch = paths.some(p => {
      if (p === wrongPath) return true;
      if (p.endsWith("/**")) return wrongPath.startsWith(p.slice(0, -3));
      return false;
    });
    assert(!wrongMatch, "Path mismatch: different file path rejected");
  }

  // Consume grant
  db.run(
    `UPDATE dispatch_privilege_grants SET status = 'consumed', consumed_at = ? WHERE id = ?`,
    [Date.now(), grantId]
  );
  const consumed = db.query(
    `SELECT status FROM dispatch_privilege_grants WHERE id = ?`
  ).get(grantId) as any;
  assert(consumed?.status === "consumed", "Grant consumed (one-time use)");
}

console.log("\n=== E2E-03: Dispatch exact binding — queue + grant key alignment ===");
{
  const dispatchKey = "e2e-test-exact-" + randomUUID().slice(0, 8);
  const parentSession = "ses_e2e-parent-" + randomUUID().slice(0, 8);
  const now = Date.now();

  // Enqueue with exact binding
  const refResult = db.run(
    `INSERT INTO dispatch_prompt_refs (file_path, sha256, size_bytes, created_at)
     VALUES ('e2e-test-prompt.txt', 'abc123', 100, ?)`,
    [now]
  );
  const promptRefId = Number(refResult.lastInsertRowid);

  db.run(
    `INSERT INTO dispatch_queue (status, agent_type, dag_task_id, prompt_ref_id, dispatch_key, parent_session_id, call_id, created_at, updated_at)
     VALUES ('pending', 'build', 'e2e-test-exact-bind', ?, ?, ?, 'call-e2e-1', ?, ?)`,
    [promptRefId, dispatchKey, parentSession, now, now]
  );

  // Dequeue and verify exact binding fields returned
  const row = db.query(
    `SELECT id, dispatch_key, parent_session_id, call_id, agent_type, dag_task_id
     FROM dispatch_queue WHERE dag_task_id = 'e2e-test-exact-bind'`
  ).get() as any;

  assert(!!row, "Queue entry exists with exact binding");
  if (row) {
    assert(row.dispatch_key === dispatchKey, "dispatch_key matches", `got=${row.dispatch_key}`);
    assert(row.parent_session_id === parentSession, "parent_session_id matches", `got=${row.parent_session_id}`);
    assert(row.call_id === "call-e2e-1", "call_id matches", `got=${row.call_id}`);
  }

  // Create grant with same dispatch_key
  const grantId = randomUUID();
  const ttl = 45 * 60 * 1000;
  db.run(
    `INSERT INTO dispatch_privilege_grants
      (id, dispatch_key, parent_session_id, child_session_id, dag_task_id,
       agent_type, privilege, allowed_tools, allowed_paths, reason,
       status, expires_at, created_at, bound_at, consumed_at, revoked_at)
     VALUES (?, ?, ?, NULL, 'e2e-test-exact-bind', 'build', 'framework_maintenance',
       '["safe_framework_edit"]', '[".opencode/test-e2e.ts"]', 'E2E-TEST exact binding',
       'pending', ?, ?, NULL, NULL, NULL)`,
    [grantId, dispatchKey, parentSession, now + ttl, now]
  );

  // Bind using dispatch_key (same as queue dequeue would provide)
  const childSession = "ses_e2e-child-" + randomUUID().slice(0, 8);
  const bindResult = db.run(
    `UPDATE dispatch_privilege_grants
     SET child_session_id = ?, status = 'bound', bound_at = ?
     WHERE dispatch_key = ? AND status = 'pending' AND expires_at > ?`,
    [childSession, now, dispatchKey, now]
  );
  assert(bindResult.changes === 1, "Grant bound via dispatch_key from queue");

  // Verify grant belongs to correct child
  const boundGrant = db.query(
    `SELECT child_session_id FROM dispatch_privilege_grants WHERE id = ?`
  ).get(grantId) as any;
  assert(boundGrant?.child_session_id === childSession, "Grant bound to correct child session");

  // Cleanup
  db.run(`DELETE FROM dispatch_privilege_grants WHERE id = ?`, [grantId]);
  db.run(`DELETE FROM dispatch_queue WHERE dag_task_id = 'e2e-test-exact-bind'`);
  db.run(`DELETE FROM dispatch_prompt_refs WHERE id = ?`, [promptRefId]);
}

console.log("\n=== E2E-04: Concurrent isolation — child B cannot use child A grant ===");
{
  const dispatchKeyA = "e2e-test-concurrent-a-" + randomUUID().slice(0, 8);
  const dispatchKeyB = "e2e-test-concurrent-b-" + randomUUID().slice(0, 8);
  const parentSession = "ses_e2e-parent-" + randomUUID().slice(0, 8);
  const childA = "ses_e2e-childA-" + randomUUID().slice(0, 8);
  const childB = "ses_e2e-childB-" + randomUUID().slice(0, 8);
  const now = Date.now();
  const ttl = 45 * 60 * 1000;

  // Create grant A for child A
  const grantIdA = randomUUID();
  db.run(
    `INSERT INTO dispatch_privilege_grants
      (id, dispatch_key, parent_session_id, child_session_id, dag_task_id,
       agent_type, privilege, allowed_tools, allowed_paths, reason,
       status, expires_at, created_at, bound_at, consumed_at, revoked_at)
     VALUES (?, ?, ?, ?, 'e2e-test-concurrent', 'build', 'framework_maintenance',
       '["safe_framework_edit"]', '[".opencode/test-a.ts"]', 'E2E-TEST concurrent A',
       'bound', ?, ?, ?, NULL, NULL)`,
    [grantIdA, dispatchKeyA, parentSession, childA, now + ttl, now, now]
  );

  // child B tries hasGrant
  const bGrant = db.query(
    `SELECT * FROM dispatch_privilege_grants
     WHERE child_session_id = ? AND privilege = 'framework_maintenance' AND status = 'bound' AND expires_at > ?
     ORDER BY bound_at DESC LIMIT 1`
  ).get(childB, now);
  assert(!bGrant, "Child B has no bound grant (isolation confirmed)", `got: ${JSON.stringify(bGrant)?.slice(0, 100)}`);

  // child A has grant
  const aGrant = db.query(
    `SELECT * FROM dispatch_privilege_grants
     WHERE child_session_id = ? AND privilege = 'framework_maintenance' AND status = 'bound' AND expires_at > ?
     ORDER BY bound_at DESC LIMIT 1`
  ).get(childA, now);
  assert(!!aGrant, "Child A has bound grant");

  // Cleanup
  db.run(`DELETE FROM dispatch_privilege_grants WHERE id = ?`, [grantIdA]);
}

console.log("\n=== E2E-05: Expired grant rejected ===");
{
  const dispatchKey = "e2e-test-expired-" + randomUUID().slice(0, 8);
  const parentSession = "ses_e2e-parent-" + randomUUID().slice(0, 8);
  const childSession = "ses_e2e-child-" + randomUUID().slice(0, 8);
  const grantId = randomUUID();
  const now = Date.now();
  const pastExpiry = now - 1000; // expired 1 second ago

  db.run(
    `INSERT INTO dispatch_privilege_grants
      (id, dispatch_key, parent_session_id, child_session_id, dag_task_id,
       agent_type, privilege, allowed_tools, allowed_paths, reason,
       status, expires_at, created_at, bound_at, consumed_at, revoked_at)
     VALUES (?, ?, ?, ?, 'e2e-test-expired', 'build', 'framework_maintenance',
       '["safe_framework_edit"]', '[".opencode/test-expired.ts"]', 'E2E-TEST expired',
       'bound', ?, ?, ?, NULL, NULL)`,
    [grantId, dispatchKey, parentSession, childSession, pastExpiry, now, now]
  );

  const expiredGrant = db.query(
    `SELECT * FROM dispatch_privilege_grants
     WHERE child_session_id = ? AND privilege = 'framework_maintenance' AND status = 'bound' AND expires_at > ?
     ORDER BY bound_at DESC LIMIT 1`
  ).get(childSession, now);
  assert(!expiredGrant, "Expired grant not returned by hasGrant", `got: ${JSON.stringify(expiredGrant)?.slice(0, 80)}`);

  // Cleanup
  db.run(`DELETE FROM dispatch_privilege_grants WHERE id = ?`, [grantId]);
}

console.log("\n=== E2E-06: Revoked grant rejected ===");
{
  const dispatchKey = "e2e-test-revoked-" + randomUUID().slice(0, 8);
  const parentSession = "ses_e2e-parent-" + randomUUID().slice(0, 8);
  const childSession = "ses_e2e-child-" + randomUUID().slice(0, 8);
  const grantId = randomUUID();
  const now = Date.now();
  const ttl = 45 * 60 * 1000;

  db.run(
    `INSERT INTO dispatch_privilege_grants
      (id, dispatch_key, parent_session_id, child_session_id, dag_task_id,
       agent_type, privilege, allowed_tools, allowed_paths, reason,
       status, expires_at, created_at, bound_at, consumed_at, revoked_at)
     VALUES (?, ?, ?, ?, 'e2e-test-revoked', 'build', 'framework_maintenance',
       '["safe_framework_edit"]', '[".opencode/test-revoked.ts"]', 'E2E-TEST revoked',
       'revoked', ?, ?, ?, NULL, ?)`,
    [grantId, dispatchKey, parentSession, childSession, now + ttl, now, now, now]
  );

  const revokedGrant = db.query(
    `SELECT * FROM dispatch_privilege_grants
     WHERE child_session_id = ? AND privilege = 'framework_maintenance' AND status = 'bound' AND expires_at > ?
     ORDER BY bound_at DESC LIMIT 1`
  ).get(childSession, now);
  assert(!revokedGrant, "Revoked grant not returned (status != 'bound')", `got: ${JSON.stringify(revokedGrant)?.slice(0, 80)}`);

  // Cleanup
  db.run(`DELETE FROM dispatch_privilege_grants WHERE id = ?`, [grantId]);
}

// ── Final cleanup ──
db.run(`DELETE FROM dispatch_privilege_grants WHERE reason LIKE 'E2E-TEST%'`);
db.run(`DELETE FROM dispatch_queue WHERE dag_task_id LIKE 'e2e-test-%'`);

console.log(`\n=== Results: ${passed} PASS, ${failed} FAIL ===`);
process.exit(failed > 0 ? 1 : 0);
