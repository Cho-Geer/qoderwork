import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function digest(source: string) {
  return createHash("sha256").update(source).digest("hex");
}

function runValidator(planSetDir: string, governanceRoot: string) {
  return Bun.spawnSync({
    cmd: [process.execPath, "run", join(import.meta.dir, "validate-plan.ts"), planSetDir, governanceRoot],
    stdout: "pipe",
    stderr: "pipe",
  });
}

function resultCodes(result: ReturnType<typeof Bun.spawnSync>): string[] {
  const output = result.stdout?.toString() ?? "";
  if (!output) throw new Error(result.stderr?.toString() ?? "validator emitted no output");
  return JSON.parse(output).errors.map((finding: { code: string }) => finding.code);
}

// A path is only written as a real authority file when it is a plain relative
// path inside the governance root. Absolute or escaping candidates are left
// unwritten on purpose: the validator must reject them at the path guard before
// any filesystem lookup.
function isSafeRelative(candidate: string) {
  return !candidate.includes("\0") && !candidate.startsWith("/") && !candidate.startsWith("..");
}

function writeWithParents(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

type PlanSetOptions = {
  indexSchema?: string;
  canonicalSchema?: string;
  canonicalHash?: string;
  canonicalPath?: string;
  approvalPath?: string;
  omitApproval?: boolean;
};

function createPlanSet(options: PlanSetOptions = {}) {
  const governanceRoot = mkdtempSync(join(tmpdir(), "audit-governance-v3-gov-"));
  roots.push(governanceRoot);
  // PLAN_SET directory lives inside the governance root but is distinct from the
  // authority documents, mirroring the real formal-plan-set layout.
  const planSetDir = join(governanceRoot, "plans", "plan-set");
  mkdirSync(planSetDir, { recursive: true });

  const canonicalPathText = options.canonicalPath ?? "authority/canonical.yaml";
  const approvalPathText = options.approvalPath ?? "authority/approval.json";

  const canonical = JSON.stringify({
    schema_version: options.canonicalSchema ?? "audit-governance/v3",
    document_kind: "canonical-requirements",
    contract_id: "canonical",
  });
  const canonicalHash = options.canonicalHash ?? digest(canonical);
  const approval = JSON.stringify({
    schema_version: "audit-governance-approval/v3",
    document_kind: "approval-decision",
    decision: "APPROVED",
    approved_by: "HUMAN_USER",
    approved_artifacts: { canonical_contract: { path: canonicalPathText, sha256: canonicalHash } },
  });

  const lines = [
    "# v3 Plan set",
    "**Plan mode**: `PLAN_SET`",
    `**Schema version**: \`${options.indexSchema ?? "audit-plan-set/v3"}\``,
    "**Document kind**: `plan-set-index`",
    `**Canonical contract**: \`${canonicalPathText}\``,
    `**Canonical contract SHA-256**: \`${canonicalHash}\``,
  ];
  if (!options.omitApproval) lines.push(`**Approval decision**: \`${approvalPathText}\``, `**Approval decision SHA-256**: \`${digest(approval)}\``);
  writeFileSync(join(planSetDir, "00-plan-index.md"), `${lines.join("\n")}\n`);
  writeFileSync(join(planSetDir, "99-final-verification.md"), "# Final verification\n");

  if (isSafeRelative(canonicalPathText)) writeWithParents(join(governanceRoot, canonicalPathText), canonical);
  if (!options.omitApproval && isSafeRelative(approvalPathText)) writeWithParents(join(governanceRoot, approvalPathText), approval);

  return { governanceRoot, planSetDir };
}

describe("validate-plan v3 PLAN_SET admission", () => {
  test("GPOS-001 admits an exact v3 PLAN_SET without lifecycle side effects", () => {
    const { governanceRoot, planSetDir } = createPlanSet();
    const result = runValidator(planSetDir, governanceRoot);
    expect(result.exitCode).toBe(0);
    expect(resultCodes(result)).toEqual([]);
  });

  test("GPOS-002 admits authority documents outside the PLAN_SET dir but inside governanceRoot", () => {
    const { governanceRoot, planSetDir } = createPlanSet({
      canonicalPath: "shared/governance/canonical-requirements-contract.yaml",
      approvalPath: "shared/governance/approval-decision.json",
    });
    const result = runValidator(planSetDir, governanceRoot);
    expect(result.exitCode).toBe(0);
    expect(resultCodes(result)).toEqual([]);
  });

  test("GNEG-001 rejects a non-v3 plan schema before admission", () => {
    const { governanceRoot, planSetDir } = createPlanSet({ indexSchema: "audit-plan-set/v2" });
    const result = runValidator(planSetDir, governanceRoot);
    expect(result.exitCode).toBe(1);
    expect(resultCodes(result)).toContain("ERR_PLAN_SCHEMA_UNSUPPORTED");
  });

  test("GNEG-002 rejects canonical hash drift", () => {
    const { governanceRoot, planSetDir } = createPlanSet({ canonicalHash: "0".repeat(64) });
    const result = runValidator(planSetDir, governanceRoot);
    expect(result.exitCode).toBe(1);
    expect(resultCodes(result)).toContain("ERR_APPROVAL_BINDING");
  });

  test("GNEG-003 rejects a missing approval binding", () => {
    const { governanceRoot, planSetDir } = createPlanSet({ omitApproval: true });
    const result = runValidator(planSetDir, governanceRoot);
    expect(result.exitCode).toBe(1);
    expect(resultCodes(result)).toContain("ERR_APPROVAL_MISSING");
  });

  test("GNEG-004 rejects a mismatched canonical discriminator", () => {
    const { governanceRoot, planSetDir } = createPlanSet({ canonicalSchema: "audit-phase-projection/v3" });
    const result = runValidator(planSetDir, governanceRoot);
    expect(result.exitCode).toBe(1);
    expect(resultCodes(result)).toContain("ERR_SCHEMA_DISCRIMINATOR");
  });

  test("GNEG-005 rejects an absolute authority path with ERR_PATH_GUARD", () => {
    const { governanceRoot, planSetDir } = createPlanSet({ canonicalPath: "/etc/passwd" });
    const result = runValidator(planSetDir, governanceRoot);
    expect(result.exitCode).toBe(1);
    expect(resultCodes(result)).toContain("ERR_PATH_GUARD");
  });

  test("GNEG-006 rejects an authority path escaping governanceRoot with ERR_PATH_GUARD", () => {
    const { governanceRoot, planSetDir } = createPlanSet({ canonicalPath: "../outside.yaml" });
    const result = runValidator(planSetDir, governanceRoot);
    expect(result.exitCode).toBe(1);
    expect(resultCodes(result)).toContain("ERR_PATH_GUARD");
  });
});
