import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sha256Text } from "./phase-progression.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function run(root: string, phase = "PHASE-02") {
  return Bun.spawnSync({
    cmd: [process.execPath, "run", join(import.meta.dir, "validate-phase-progression.ts"), root, phase],
    stdout: "pipe",
    stderr: "pipe",
  });
}
function result(output: ReturnType<typeof Bun.spawnSync>) {
  const text = output.stdout?.toString();
  if (!text) throw new Error(output.stderr?.toString() ?? "validator emitted no JSON");
  return JSON.parse(text) as { ok: boolean; errors: Array<{ code: string }> };
}
function phase(id: string, status: string, dependency: string, receipt = "NONE", checked = status === "ACCEPTED") {
  const boxes = checked ? "- [x] gate" : "- [ ] gate";
  return `# Phase ${id}: fixture [ANALYSIS]
**Phase ID**: \`${id}\`
**Depends on**: ${dependency}
**Outcome**: fixture
**Evidence level**: component
**Progression status**: \`${status}\`
**Completion receipt**: ${receipt}
## Goal
## Starting state and dependency
## Local requirements
| Requirement | Condition | Required behavior | Observable result |
|---|---|---|---|
| REQ-001 | fixed | fixed | fixed |
## Allowed files
| Exact path | Change | Exact symbol/anchor |
|---|---|---|
| fixture.ts | modify | fixture |
## Forbidden files and behaviors
## Fixed contract
FOUND / NOT_FOUND / UNAVAILABLE
## Implementation steps
## Check Registry
| Check name | Source of truth | Read/operation | PASS | Missing/corrupt behavior | Exact failure result |
|---|---|---|---|---|---|
| check | fixture | read | true | fail | failedChecks |
## All-pass Fixture
## Single-failure Matrix
## Fixed verification
Verification command: cd /tmp; echo fixture
component
## Rollback/failure convergence
## Phase completion gate
${boxes}
`;
}
function createFixture(options: { topStatus?: string; dependencyStatus?: string } = {}) {
  const root = mkdtempSync(join(tmpdir(), "phase-progression-admission-"));
  roots.push(root);
  mkdirSync(join(root, "evidence"));
  const index = `# Plan index
**Plan mode**: \`PLAN_SET\`
**Status**: ${options.topStatus ?? "READY-FOR-IMPLEMENTATION"}
**Progression schema**: \`phase-progression/v1\`
**Only implementation path**: fixture
**Evidence ceiling**: component
## 1. Input contract and source ledger
## 2. Decisions, scope, and non-goals
## 3. Verified current baseline
## 4. End-to-end traceability
## 5. File change inventory
## 6. Phase manifest
| Order | Phase ID | File | Depends on | Status |
|---|---|---|---|---|
| 1 | PHASE-01 | \`01-phase.md\` | NONE | ${options.dependencyStatus ?? "ACCEPTED"} |
| 2 | PHASE-02 | \`02-phase.md\` | PHASE-01 | NOT_STARTED |
`;
  const phaseOne = phase("PHASE-01", options.dependencyStatus ?? "ACCEPTED", "NONE", "evidence/PHASE-01.json");
  const phaseTwo = phase("PHASE-02", "NOT_STARTED", "PHASE-01", "NONE", false);
  writeFileSync(join(root, "00-plan-index.md"), index);
  writeFileSync(join(root, "01-phase.md"), phaseOne);
  writeFileSync(join(root, "02-phase.md"), phaseTwo);
  const audit = "# Signed audit\nVerdict: ACCEPT\n";
  writeFileSync(join(root, "evidence/audit.md"), audit);
  const hash = sha256Text("validator output");
  writeFileSync(join(root, "evidence/PHASE-01.json"), JSON.stringify({
    schema_version: "phase-progression/v1",
    plan_index_sha256: sha256Text(index),
    phase_file_sha256: sha256Text(phaseOne),
    audit_report_sha256: sha256Text(audit),
    validator_output_sha256: hash,
    phase_id: "PHASE-01",
    previous_status: "IN_PROGRESS",
    new_status: "ACCEPTED",
    audit_report_path: "evidence/audit.md",
    audit_verdict: "ACCEPT",
    audit_exit_code: 0,
  }, null, 2));
  return root;
}

describe("validate-phase-progression CLI", () => {
  test("admits a next phase when accepted dependency and receipt chain are complete", () => {
    const output = run(createFixture());
    expect(output.exitCode).toBe(0);
    expect(result(output).ok).toBe(true);
  });

  test("rejects a legacy or missing progression schema", () => {
    const root = createFixture();
    const path = join(root, "00-plan-index.md");
    writeFileSync(path, readFileSync(path, "utf8").replace("**Progression schema**: `phase-progression/v1`", "**Progression schema**: `legacy`"));
    const parsed = result(run(root));
    expect(parsed.errors.map((item) => item.code)).toContain("PROGRESSION_SCHEMA_REQUIRED");
  });

  test("rejects dependency status, top-level status, and receipt hash drift", () => {
    const root = createFixture({ dependencyStatus: "ACCEPTED", topStatus: "COMPLETE" });
    const receiptPath = join(root, "evidence/PHASE-01.json");
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    receipt.phase_file_sha256 = sha256Text("tampered");
    writeFileSync(receiptPath, JSON.stringify(receipt));
    const parsed = result(run(root));
    const codes = parsed.errors.map((item) => item.code);
    expect(codes).toContain("TOP_LEVEL_STATUS_MISMATCH");
    expect(codes).toContain("PHASE_RECEIPT_HASH_MISMATCH");

    const blocked = result(run(createFixture({ dependencyStatus: "IN_PROGRESS", topStatus: "IN-PROGRESS" })));
    expect(blocked.errors.map((item) => item.code)).toContain("PROGRESSION_DEPENDENCY_NOT_ACCEPTED");
  });

  test("rejects a checked completion gate on the target next phase", () => {
    const root = createFixture();
    const targetPath = join(root, "02-phase.md");
    writeFileSync(targetPath, readFileSync(targetPath, "utf8").replace("- [ ] gate", "- [x] gate"));
    expect(result(run(root)).errors.map((item) => item.code)).toContain("PHASE_COMPLETION_GATE_MISMATCH");
  });
});
