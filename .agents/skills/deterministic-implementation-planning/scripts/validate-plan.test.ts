import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function runValidator(path: string) {
  return Bun.spawnSync({
    cmd: [process.execPath, "run", join(import.meta.dir, "validate-plan.ts"), path],
    stdout: "pipe",
    stderr: "pipe",
  });
}

function runSingle(source: string) {
  const root = mkdtempSync(join(tmpdir(), "deterministic-plan-validator-"));
  roots.push(root);
  const planPath = join(root, "plan.md");
  writeFileSync(planPath, source);
  return runValidator(planPath);
}

function parse(result: ReturnType<typeof Bun.spawnSync>) {
  const stdout = result.stdout?.toString();
  if (!stdout) throw new Error(`validator emitted no JSON: ${result.stderr?.toString() ?? "no stderr"}`);
  return JSON.parse(stdout);
}

const phase = `### Phase 0: baseline [ANALYSIS → VERIFICATION]
#### Goal
#### Starting state and dependency
#### Local requirements
| Requirement | Contract |
|---|---|
| REQ-001 | fixed |
#### Allowed files
| Exact path | Change | Anchor |
|---|---|---|
| src/a.ts | modify | run |
#### Forbidden files and behaviors
#### Fixed contract
Exact failure result and failedChecks.
#### Implementation steps
#### Check Registry
| Check name | PASS |
|---|---|
| checkA | true |
#### All-pass Fixture
#### Single-failure Matrix
#### Fixed verification
\`\`\`bash
cd /repo
bun test
\`\`\`
component
#### Rollback/failure convergence
#### Phase completion gate
- [ ] gate
`;

const valid = `# Plan
**Plan mode**: \`SINGLE_FILE\`
**Status**: READY-FOR-IMPLEMENTATION
**Only implementation path**: fixed
**Evidence ceiling**: NOT-RUN
## 1. Input contract and source ledger
## 2. Decisions, scope, and non-goals
### Decision ledger
### Non-goals
### Open/blocking items
### Negative evidence semantics
FOUND / NOT_FOUND / UNAVAILABLE are N/A because this feature has no negative check.
### Current versus historical evidence
N/A — no lifecycle claim.
## 3. Verified current baseline
## 4. End-to-end traceability
| Requirement | Source | File/symbol | Check name | Evidence source | Happy fixture | Single mutation | Test ID | Level |
## 5. File change inventory
### Globally forbidden changes
## 6. Phase-by-phase implementation
${phase}
## 7. Global verification and evidence
### Evidence preservation
### Evidence ceiling rule
## 8. Risks, failure convergence, and rollback
## 9. Final completion gate
- [ ] final
`;

function padChars(source: string, target: number): string {
  const remaining = target - [...source].length;
  if (remaining < 0) throw new Error("fixture already exceeds target");
  return source + "x".repeat(remaining);
}

function padLines(source: string, target: number): string {
  let result = source.replace(/\n+$/, "");
  while (result.split(/\r?\n/).length < target) result += "\n";
  return result;
}

function phaseSetSource(id = "PHASE-01", dependency = "NONE") {
  return `# Phase ${id}: baseline [ANALYSIS → VERIFICATION]
**Phase ID**: \`${id}\`
**Depends on**: ${dependency}
**Outcome**: fixed result
**Evidence level**: component
## Goal
## Starting state and dependency
## Local requirements
| Requirement | Contract |
|---|---|
| REQ-001 | fixed |
## Allowed files
| Exact path | Change | Anchor |
|---|---|---|
| src/a.ts | modify | run |
## Forbidden files and behaviors
## Fixed contract
Exact failure result and failedChecks. FOUND / NOT_FOUND / UNAVAILABLE.
## Implementation steps
## Check Registry
| Check name | PASS |
|---|---|
| checkA | true |
## All-pass Fixture
## Single-failure Matrix
## Fixed verification
\`\`\`bash
cd /repo
bun test
\`\`\`
## Rollback/failure convergence
## Phase completion gate
- [ ] gate
`;
}

function createPlanSet(options: { index?: string; phases?: Record<string, string>; final?: string } = {}) {
  const root = mkdtempSync(join(tmpdir(), "deterministic-plan-set-"));
  roots.push(root);
  const index = options.index ?? `# Plan index
**Plan mode**: \`PLAN_SET\`
**Status**: READY-FOR-IMPLEMENTATION
**Only implementation path**: fixed
**Evidence ceiling**: NOT-RUN
## 1. Input contract and source ledger
## 2. Decisions, scope, and non-goals
## 3. Verified current baseline
## 4. End-to-end traceability
## 5. File change inventory
## 6. Phase manifest
| Order | Phase ID | File | Depends on | Status |
|---|---|---|---|---|
| 1 | PHASE-01 | \`01-phase-baseline.md\` | NONE | READY |
`;
  const final = options.final ?? `# Final verification
## 7. Global verification and evidence
## 8. Risks, failure convergence, and rollback
## 9. Final completion gate
- [ ] final
`;
  writeFileSync(join(root, "00-plan-index.md"), index);
  writeFileSync(join(root, "99-final-verification.md"), final);
  for (const [file, source] of Object.entries(options.phases ?? { "01-phase-baseline.md": phaseSetSource() })) {
    writeFileSync(join(root, file), source);
  }
  return root;
}

describe("validate-plan single-file mode", () => {
  test("accepts a structurally complete closed-world plan", () => {
    const result = runSingle(valid);
    expect(result.exitCode).toBe(0);
    expect(parse(result).mode).toBe("SINGLE_FILE");
  });

  test("rejects placeholders, missing phase contracts, and missing cwd", () => {
    const result = runSingle(`# Plan\n## 6. Phase-by-phase implementation\n### Phase 0: <name>\nTBD\n`);
    expect(result.exitCode).toBe(1);
    const codes = parse(result).errors.map((item: { code: string }) => item.code);
    expect(codes).toContain("PLACEHOLDER");
    expect(codes).toContain("UNRESOLVED_TBD");
    expect(codes).toContain("COMMAND_CWD_MISSING");
  });

  test("rejects a negative claim without three-state evidence semantics", () => {
    const result = runSingle(valid.replace("FOUND / NOT_FOUND / UNAVAILABLE are N/A because this feature has no negative check.", "B 数据库不存在目标记录即通过 negative isolation。"));
    expect(parse(result).errors.map((item: { code: string }) => item.code)).toContain("NEGATIVE_THREE_STATE_MISSING");
  });

  test("accepts exactly 20000 Unicode characters and rejects 20001", () => {
    expect(runSingle(padChars(valid, 20_000)).exitCode).toBe(0);
    const tooLong = parse(runSingle(padChars(valid, 20_001)));
    expect(tooLong.errors.map((item: { code: string }) => item.code)).toContain("PLAN_SPLIT_REQUIRED");
  });

  test("accepts exactly 450 lines and rejects 451", () => {
    expect(runSingle(padLines(valid, 450)).exitCode).toBe(0);
    const tooLong = parse(runSingle(padLines(valid, 451)));
    expect(tooLong.errors.map((item: { code: string }) => item.code)).toContain("PLAN_SPLIT_REQUIRED");
  });

  test("requires PLAN_SET when a single file contains more than two phases", () => {
    const result = runSingle(valid.replace(phase, `${phase}${phase.replace("Phase 0", "Phase 1")}${phase.replace("Phase 0", "Phase 2")}`));
    expect(parse(result).errors.map((item: { code: string }) => item.code)).toContain("PLAN_SPLIT_REQUIRED");
  });
});

describe("validate-plan PLAN_SET mode", () => {
  test("accepts a complete one-phase plan set", () => {
    const result = runValidator(createPlanSet());
    expect(result.exitCode).toBe(0);
    expect(parse(result).mode).toBe("PLAN_SET");
  });

  test("rejects a missing phase file", () => {
    const root = createPlanSet({ phases: {} });
    const codes = parse(runValidator(root)).errors.map((item: { code: string }) => item.code);
    expect(codes).toContain("MISSING_PHASE_FILE");
  });

  test("reports stable errors for a missing index or final file", () => {
    const missingIndex = createPlanSet();
    unlinkSync(join(missingIndex, "00-plan-index.md"));
    expect(parse(runValidator(missingIndex)).errors.map((item: { code: string }) => item.code)).toContain("MISSING_PLAN_INDEX");

    const missingFinal = createPlanSet();
    unlinkSync(join(missingFinal, "99-final-verification.md"));
    expect(parse(runValidator(missingFinal)).errors.map((item: { code: string }) => item.code)).toContain("MISSING_FINAL_VERIFICATION");
  });

  test("rejects duplicate phase IDs and files", () => {
    const index = `# Plan index
**Plan mode**: \`PLAN_SET\`
**Status**: READY-FOR-IMPLEMENTATION
**Only implementation path**: fixed
**Evidence ceiling**: NOT-RUN
## 1. Input contract and source ledger
## 2. Decisions, scope, and non-goals
## 3. Verified current baseline
## 4. End-to-end traceability
## 5. File change inventory
## 6. Phase manifest
| Order | Phase ID | File | Depends on | Status |
|---|---|---|---|---|
| 1 | PHASE-01 | \`01-phase-baseline.md\` | NONE | READY |
| 2 | PHASE-01 | \`01-phase-baseline.md\` | PHASE-01 | READY |
`;
    const codes = parse(runValidator(createPlanSet({ index }))).errors.map((item: { code: string }) => item.code);
    expect(codes).toContain("DUPLICATE_PHASE_ID");
    expect(codes).toContain("DUPLICATE_PHASE_FILE");
  });

  test("rejects unknown and forward dependencies", () => {
    const index = `# Plan index
**Plan mode**: \`PLAN_SET\`
**Status**: READY-FOR-IMPLEMENTATION
**Only implementation path**: fixed
**Evidence ceiling**: NOT-RUN
## 1. Input contract and source ledger
## 2. Decisions, scope, and non-goals
## 3. Verified current baseline
## 4. End-to-end traceability
## 5. File change inventory
## 6. Phase manifest
| Order | Phase ID | File | Depends on | Status |
|---|---|---|---|---|
| 1 | PHASE-01 | \`01-phase-baseline.md\` | PHASE-02 | READY |
| 2 | PHASE-02 | \`02-phase-next.md\` | PHASE-99 | READY |
`;
    const phases = {
      "01-phase-baseline.md": phaseSetSource("PHASE-01", "PHASE-02"),
      "02-phase-next.md": phaseSetSource("PHASE-02", "PHASE-99"),
    };
    const codes = parse(runValidator(createPlanSet({ index, phases }))).errors.map((item: { code: string }) => item.code);
    expect(codes).toContain("PHASE_DEPENDENCY_ORDER");
    expect(codes).toContain("UNKNOWN_PHASE_DEPENDENCY");
  });

  test("rejects a phase with more than twelve registered checks", () => {
    const rows = Array.from({ length: 13 }, (_, index) => `| check${index + 1} | true |`).join("\n");
    const source = phaseSetSource().replace("| checkA | true |", rows);
    const codes = parse(runValidator(createPlanSet({ phases: { "01-phase-baseline.md": source } }))).errors.map((item: { code: string }) => item.code);
    expect(codes).toContain("PHASE_COMPLEXITY_EXCEEDED");
  });

  test("rejects a phase above the requirement and file complexity limits", () => {
    const requirementRows = Array.from({ length: 11 }, (_, index) => `| REQ-${String(index + 1).padStart(3, "0")} | fixed |`).join("\n");
    const fileRows = Array.from({ length: 9 }, (_, index) => `| src/${index + 1}.ts | modify | run |`).join("\n");
    const source = phaseSetSource()
      .replace("| REQ-001 | fixed |", requirementRows)
      .replace("| src/a.ts | modify | run |", fileRows);
    const findings = parse(runValidator(createPlanSet({ phases: { "01-phase-baseline.md": source } }))).errors;
    const complexity = findings.filter((item: { code: string }) => item.code === "PHASE_COMPLEXITY_EXCEEDED");
    expect(complexity).toHaveLength(2);
  });

  test("rejects an unregistered phase and a dependency mismatch", () => {
    const phases = {
      "01-phase-baseline.md": phaseSetSource("PHASE-01", "PHASE-99"),
      "02-phase-unregistered.md": phaseSetSource("PHASE-02"),
    };
    const codes = parse(runValidator(createPlanSet({ phases }))).errors.map((item: { code: string }) => item.code);
    expect(codes).toContain("UNREGISTERED_PHASE_FILE");
    expect(codes).toContain("PHASE_DEPENDENCY_MISMATCH");
  });

  test("rejects an index above 8000 Unicode characters", () => {
    const root = createPlanSet();
    const path = join(root, "00-plan-index.md");
    const source = Bun.file(path).text();
    return source.then((value) => {
      writeFileSync(path, padChars(value, 8_001));
      const codes = parse(runValidator(root)).errors.map((item: { code: string }) => item.code);
      expect(codes).toContain("PLAN_INDEX_LENGTH_EXCEEDED");
    });
  });

  test("validates progression status fields when the schema is enabled", () => {
    const index = `# Plan index
**Plan mode**: \`PLAN_SET\`
**Status**: READY-FOR-IMPLEMENTATION
**Progression schema**: \`phase-progression/v1\`
**Only implementation path**: fixed
**Evidence ceiling**: NOT-RUN
## 1. Input contract and source ledger
## 2. Decisions, scope, and non-goals
## 3. Verified current baseline
## 4. End-to-end traceability
## 5. File change inventory
## 6. Phase manifest
| Order | Phase ID | File | Depends on | Status |
|---|---|---|---|---|
| 1 | PHASE-01 | \`01-phase-baseline.md\` | NONE | NOT_STARTED |
`;
    const phase = phaseSetSource().replace(
      "**Phase ID**: \`PHASE-01\`",
      "**Phase ID**: \`PHASE-01\`\n**Progression status**: \`NOT_STARTED\`\n**Completion receipt**: NONE",
    );
    const codes = parse(runValidator(createPlanSet({ index, phases: { "01-phase-baseline.md": phase } }))).errors.map((item: { code: string }) => item.code);
    expect(codes).not.toContain("PHASE_STATUS_MISMATCH");
    expect(codes).not.toContain("TOP_LEVEL_STATUS_MISMATCH");
  });

  test("rejects progression status drift and ACCEPTED without a receipt", () => {
    const index = `# Plan index
**Plan mode**: \`PLAN_SET\`
**Status**: READY-FOR-IMPLEMENTATION
**Progression schema**: \`phase-progression/v1\`
**Only implementation path**: fixed
**Evidence ceiling**: NOT-RUN
## 1. Input contract and source ledger
## 2. Decisions, scope, and non-goals
## 3. Verified current baseline
## 4. End-to-end traceability
## 5. File change inventory
## 6. Phase manifest
| Order | Phase ID | File | Depends on | Status |
|---|---|---|---|---|
| 1 | PHASE-01 | \`01-phase-baseline.md\` | NONE | ACCEPTED |
`;
    const phase = phaseSetSource().replace(
      "**Phase ID**: \`PHASE-01\`",
      "**Phase ID**: \`PHASE-01\`\n**Progression status**: \`IN_PROGRESS\`\n**Completion receipt**: NONE",
    );
    const codes = parse(runValidator(createPlanSet({ index, phases: { "01-phase-baseline.md": phase } }))).errors.map((item: { code: string }) => item.code);
    expect(codes).toContain("PHASE_STATUS_MISMATCH");
    expect(codes).toContain("PHASE_RECEIPT_MISSING");
    expect(codes).toContain("TOP_LEVEL_STATUS_MISMATCH");
  });
});
