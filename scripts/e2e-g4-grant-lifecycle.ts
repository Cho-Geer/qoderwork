/**
 * G4 E2E: Grant Lifecycle Local Commit
 * Tests: grant create → bind → stage → commit → consumed
 */
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

const WORK_ONE = "/home/zhaoge/workspace/opencode/work-one";
const FIXTURE_DIR = path.join(WORK_ONE, "src", "_e2e_test_fixture");
const FIXTURE_FILE = path.join(FIXTURE_DIR, "test-fixture.txt");

// Use work-one modules
process.chdir(WORK_ONE);

const { getDb } = require(path.join(WORK_ONE, ".opencode/lib/db-manager"));
const { createRepoGrant, bindRepoGrant, hasRepoGrant, consumeRepoGrant, toRepoRelativePath, assertNoRuntimeStatePaths } = require(path.join(WORK_ONE, ".opencode/service/repo/grants"));
const { repoStage, repoUnstage, repoCommit, getStagedFiles } = require(path.join(WORK_ONE, ".opencode/service/repo/git"));
const { classifyGitArgv, classifyGhArgv, classifyRepoShellCommand, classifyRepoOperation } = require(path.join(WORK_ONE, ".opencode/service/repo/classify"));

const results: string[] = [];
function pass(name: string) { results.push(`PASS: ${name}`); console.log(`  ✓ ${name}`); }
function fail(name: string, detail: string) { results.push(`FAIL: ${name} — ${detail}`); console.log(`  ✗ ${name}: ${detail}`); }

console.log("\n═══ G4 E2E: Grant Lifecycle Local Commit ═══\n");

// ── Step 1: Create test fixture ──
console.log("Step 1: Create test fixture");
fs.mkdirSync(FIXTURE_DIR, { recursive: true });
fs.writeFileSync(FIXTURE_FILE, `E2E test fixture created at ${new Date().toISOString()}\n`);
const fixtureRelPath = toRepoRelativePath(FIXTURE_FILE, WORK_ONE);
console.log(`  Fixture: ${FIXTURE_FILE}`);
console.log(`  Relative: ${fixtureRelPath}`);
pass("Test fixture created");

// ── Step 2: Create repo_maintenance grant ──
console.log("\nStep 2: Create repo_maintenance grant");
const dispatchKey = randomUUID();
const parentSessionId = randomUUID();
const childSessionId = randomUUID();

const grant = createRepoGrant({
  dispatch_key: dispatchKey,
  parent_session_id: parentSessionId,
  agent_type: "build",
  privilege: "repo_maintenance",
  allowed_tools: ["safe_repo_stage", "safe_repo_unstage", "safe_repo_commit"],
  allowed_paths: [fixtureRelPath],
  reason: "G4 E2E test",
  ttl_ms: 30 * 60 * 1000,
});

if (grant && grant.status === "pending") {
  pass(`Grant created: id=${grant.id}, status=${grant.status}`);
} else {
  fail("Grant creation", JSON.stringify(grant));
  process.exit(1);
}

// ── Step 3: Bind grant to child session ──
console.log("\nStep 3: Bind grant to child session");
const bound = bindRepoGrant(dispatchKey, childSessionId);
if (bound && bound.status === "bound" && bound.child_session_id === childSessionId) {
  pass(`Grant bound: status=${bound.status}, child_session_id=${bound.child_session_id}`);
} else {
  fail("Grant binding", JSON.stringify(bound));
  process.exit(1);
}

// ── Step 4: Verify hasRepoGrant ──
console.log("\nStep 4: Verify hasRepoGrant");
const activeGrant = hasRepoGrant(childSessionId, "repo_maintenance", "safe_repo_stage", [fixtureRelPath]);
if (activeGrant) {
  pass(`hasRepoGrant: found grant id=${activeGrant.id}`);
} else {
  fail("hasRepoGrant", "grant not found");
}

// ── Step 5: Negative test — wrong session ──
console.log("\nStep 5: Negative test — wrong session ID");
const wrongSession = randomUUID();
const noGrant = hasRepoGrant(wrongSession, "repo_maintenance", "safe_repo_stage", [fixtureRelPath]);
if (!noGrant) {
  pass("hasRepoGrant returns null for wrong session");
} else {
  fail("Wrong session test", "should have returned null");
}

// ── Step 6: Negative test — wrong path ──
console.log("\nStep 6: Negative test — path not in allowlist");
const noGrantPath = hasRepoGrant(childSessionId, "repo_maintenance", "safe_repo_stage", ["src/wrong-file.ts"]);
if (!noGrantPath) {
  pass("hasRepoGrant returns null for non-allowed path");
} else {
  fail("Wrong path test", "should have returned null");
}

// ── Step 7: Stage the fixture ──
console.log("\nStep 7: Stage fixture file");
const stageResult = repoStage([fixtureRelPath]);
if (stageResult.ok) {
  pass(`Staged: ${fixtureRelPath}`);
} else {
  fail("Stage", stageResult.stderr);
}

// ── Step 8: Verify staged files ──
console.log("\nStep 8: Verify staged files match expectedPaths");
const staged = getStagedFiles();
console.log(`  Staged files: ${JSON.stringify(staged)}`);
if (staged.includes(fixtureRelPath)) {
  pass("Staged files include fixture");
} else {
  fail("Staged files check", `expected ${fixtureRelPath} in ${JSON.stringify(staged)}`);
}

// ── Step 9: Negative test — assertNoRuntimeStatePaths ──
console.log("\nStep 9: Negative test — runtime state path rejection");
try {
  assertNoRuntimeStatePaths([".opencode/state.db"]);
  fail("Runtime path check", "should have thrown for .opencode/state.db");
} catch (e: any) {
  if (e.message.includes("REPO-RUNTIME-PATH-BLOCKED")) {
    pass("Runtime state path correctly blocked");
  } else {
    fail("Runtime path check", e.message);
  }
}

// ── Step 10: Commit ──
console.log("\nStep 10: Commit with grant");
const commitResult = repoCommit("test: G4 E2E grant lifecycle fixture");
if (commitResult.ok && commitResult.commitSha) {
  pass(`Commit success: sha=${commitResult.commitSha}`);
} else {
  fail("Commit", commitResult.stderr || "no commit sha");
}

// ── Step 11: Consume grant ──
console.log("\nStep 11: Consume grant after successful commit");
consumeRepoGrant(grant.id);
const db = getDb();
const consumedRow = db.query("SELECT status, consumed_at FROM repo_operation_grants WHERE id = ?").get(grant.id) as any;
if (consumedRow && consumedRow.status === "consumed" && consumedRow.consumed_at) {
  pass(`Grant consumed: status=${consumedRow.status}, consumed_at=${consumedRow.consumed_at}`);
} else {
  fail("Grant consumption", JSON.stringify(consumedRow));
}

// ── Step 12: Verify classifier coverage ──
console.log("\nStep 12: Verify classifier coverage for G0 acceptance matrix");
const g0Cases = [
  { input: ["git", "status", "--short"], expected: "read" },
  { input: ["git", "add", "file.ts"], expected: "local_write" },
  { input: ["git", "commit", "--no-verify", "-m", "x"], expected: "hook_bypass" },
  { input: ["git", "reset", "--hard", "HEAD"], expected: "destructive" },
  { input: ["gh", "pr", "view", "1"], expected: "read" },
  { input: ["gh", "pr", "comment", "1", "-b", "x"], expected: "remote_write" },
  { input: ["gh", "api", "-X", "PATCH", "repos/a/b/issues/1"], expected: "remote_write" },
];
let classifierPass = 0;
for (const c of g0Cases) {
  const op = classifyRepoOperation({ argv: c.input });
  if (op.kind === c.expected) {
    classifierPass++;
  } else {
    fail(`G0 classifier: ${c.input.join(" ")}`, `expected ${c.expected}, got ${op.kind}`);
  }
}
if (classifierPass === g0Cases.length) {
  pass(`G0 classifier: ${classifierPass}/${g0Cases.length} cases correct`);
}

// ── Summary ──
console.log("\n═══ G4 E2E Summary ═══");
const passed = results.filter((r) => r.startsWith("PASS")).length;
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`Results: ${passed} PASS, ${failed} FAIL`);
console.log("\nEvidence:");
console.log(`  Parent session: ${parentSessionId}`);
console.log(`  Child session: ${childSessionId}`);
console.log(`  Dispatch key: ${dispatchKey}`);
console.log(`  Grant ID: ${grant.id}`);
console.log(`  Commit SHA: ${commitResult.commitSha || "N/A"}`);
console.log(`  Fixture path: ${fixtureRelPath}`);
console.log(`  DB schema: v35`);

// Cleanup fixture
fs.unlinkSync(FIXTURE_FILE);
try { fs.rmdirSync(FIXTURE_DIR); } catch {}

if (failed > 0) {
  console.log("\n⚠ G4 E2E has failures — review above");
  process.exit(1);
} else {
  console.log("\n✓ G4 E2E ALL PASS");
}
