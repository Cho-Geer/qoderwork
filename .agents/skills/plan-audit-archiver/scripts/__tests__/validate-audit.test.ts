import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateAuditSource } from "../validate-audit.ts";

type Control = {
  command: string;
  expected: string;
  observed: string;
  evidence: string;
  applicability?: string;
  method?: string;
};

type Requirement = {
  id: string;
  plan_item_id: string;
  kind: "BEHAVIORAL" | "STATIC";
  source: string;
  behavior: string;
  required_evidence_level: string;
  oracle_id: string;
  oracle: string;
  positive_control: Control;
  negative_control: Control;
  status: "PASS" | "FAIL" | "BLOCKED" | "INVALID";
};

type Finding = {
  id: string;
  requirement_ids: string[];
  classification: "BLOCKING" | "NON_BLOCKING_DEBT" | "OUT_OF_SCOPE" | "UNVERIFIED";
  origin: "PRE_EXISTING" | "REGRESSION" | "AUDIT_MISS" | "EVIDENCE_INVALIDATION";
  introduced_after_freeze: boolean;
  status: "OPEN" | "CLOSED" | "BLOCKED";
  summary: string;
  evidence: string;
  allowed_files: string[];
  forbidden_changes: string[];
  closure_conditions: string[];
  pre_fix_control?: Control;
  post_fix_control?: Control;
  closure_evidence?: string;
};

type ReworkItem = {
  finding_id: string;
  allowed_files: string[];
  forbidden_changes: string[];
  required_changes: string[];
  acceptance_commands: Array<{ command: string; expected: string }>;
};

type ReopenRecord = {
  finding_id: string;
  gate: string;
  origin: string;
  linked_rule: string;
  baseline_proof: string;
  causal_proof: string;
  miss_explanation: string;
  debt_rejection_reason: string;
  affected_requirement_ids: string[];
  resweep_evidence: string;
  approval_evidence: string;
  approved: boolean;
};

type EvidenceReceipt = {
  id: string;
  path: string;
  sha256: string;
  command: string;
  observed: "PASS" | "FAIL" | "BLOCKED" | "NOT_RUN";
  requirement_id: string;
  polarity: "POSITIVE" | "NEGATIVE" | "POST_FIX";
  oracle_id: string;
  fixture_id: string;
  evidence_level: string;
  repository_state_sha256: string;
  exit_code: number;
  cwd: string;
  artifacts: Array<{ path: string; sha256: string }>;
  completed_at: string;
};

type Contract = {
  schema_version: string;
  audit_id: string;
  generation: number;
  previous_audit: { path: string; sha256: string; audit_id: string } | null;
  scope_lock: { path: string; sha256: string; lock_id: string };
  baseline: {
    implementation_base_commit: string;
    commit: string;
    head_at_verdict: string;
    workspace_root: string;
    repository_root: string;
    dirty_surface: string;
    dirty_paths: string[];
    pre_change_receipt: { path: string; sha256: string } | null;
    verdict_state_receipt: { path: string; sha256: string } | null;
    plan_sources: Array<{ path: string; sha256: string }>;
    supplemental_sources: Array<{ path: string; sha256: string; role: string }>;
  };
  scope: {
    status: "FROZEN" | "UNFROZEN";
    provenance_level: string;
    frozen_at: string;
    in_scope: string[];
    out_of_scope: string[];
    assumptions: Array<{ statement: string; disproof: string }>;
    exit_criteria: string[];
  };
  requirements: Requirement[];
  evidence_receipts: EvidenceReceipt[];
  sweep: {
    status: "COMPLETE" | "INCOMPLETE";
    requirement_ids: string[];
    files_inspected: string[];
    commands: string[];
    completed_at: string;
  };
  findings: Finding[];
  rework_package: {
    status: "NONE" | "FROZEN";
    finding_ids: string[];
    items: ReworkItem[];
  };
  reopen_records: ReopenRecord[];
  inherited_blockers: Array<{ previous_audit_id: string; blocker_id: string; disposition: string; evidence: string; reason: string }>;
  downgrade_declaration: { reason: string; ceiling: string; unaffected_scope: string; affected_scope: string } | null;
  unclassified_findings: number;
  evidence_ceiling: string;
  verdict: "ACCEPT" | "REWORK" | "BLOCKED" | "INVALID";
  blocker_reason: string | null;
  invalid_reason: string | null;
};

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function baseContract(): Contract {
  return {
    schema_version: "2.1",
    audit_id: "AUDIT-20260719-001",
    generation: 1,
    previous_audit: null,
    scope_lock: { path: "audits/example/scope-lock.json", sha256: "e".repeat(64), lock_id: "LOCK-20260719-001" },
    baseline: {
      implementation_base_commit: "a".repeat(40),
      commit: "a".repeat(40),
      head_at_verdict: "a".repeat(40),
      workspace_root: "/workspace",
      repository_root: "/repo",
      dirty_surface: "Only the named implementation files changed",
      dirty_paths: [],
      pre_change_receipt: { path: "audits/example/evidence/pre-change.json", sha256: "4".repeat(64) },
      verdict_state_receipt: { path: "audits/example/evidence/verdict-state.json", sha256: "5".repeat(64) },
      plan_sources: [{ path: "plans/example/01-phase.md", sha256: "b".repeat(64) }],
      supplemental_sources: [{ path: "logs/2026-07-19-example.md", sha256: "c".repeat(64), role: "CLAIM" }],
    },
    scope: {
      status: "FROZEN",
      provenance_level: "v2.1-required",
      frozen_at: "2026-07-19T10:00:00+09:00",
      in_scope: ["REQ-001"],
      out_of_scope: ["Unrelated formatting refactors"],
      assumptions: [{ statement: "The fixture is isolated", disproof: "cd /repo && bun run check-isolation.ts" }],
      exit_criteria: ["REQ-001 is PASS with a failing negative control"],
    },
    requirements: [
      {
        id: "REQ-001",
        plan_item_id: "PLAN-REQ-001",
        kind: "BEHAVIORAL",
        source: "plans/example/01-phase.md#stop-once",
        behavior: "A stop attempt occurs exactly once when the first call throws",
        required_evidence_level: "component",
        oracle_id: "ORACLE-001",
        oracle: "An injected counter observed by the test boundary",
        positive_control: {
          command: "cd /repo && bun test stop-once.test.ts",
          expected: "PASS",
          observed: "PASS",
          evidence: "EV-001",
        },
        negative_control: {
          applicability: "REQUIRED",
          method: "test-only duplicate-stop mutation",
          command: "cd /repo && bun test stop-once-negative.test.ts",
          expected: "FAIL",
          observed: "FAIL",
          evidence: "EV-002",
        },
        status: "PASS",
      },
    ],
    evidence_receipts: [
      {
        id: "EV-001",
        path: "audits/example/evidence/positive-receipt.json",
        sha256: "1".repeat(64),
        command: "cd /repo && bun test stop-once.test.ts",
        observed: "PASS",
        requirement_id: "REQ-001",
        polarity: "POSITIVE",
        oracle_id: "ORACLE-001",
        fixture_id: "FIXTURE-GOOD-001",
        evidence_level: "component",
        repository_state_sha256: "5".repeat(64),
        exit_code: 0,
        cwd: "/repo",
        artifacts: [{ path: "audits/example/evidence/positive-output.txt", sha256: "6".repeat(64) }],
        completed_at: "2026-07-19T11:01:00+09:00",
      },
      {
        id: "EV-002",
        path: "audits/example/evidence/negative-receipt.json",
        sha256: "2".repeat(64),
        command: "cd /repo && bun test stop-once-negative.test.ts",
        observed: "FAIL",
        requirement_id: "REQ-001",
        polarity: "NEGATIVE",
        oracle_id: "ORACLE-001",
        fixture_id: "FIXTURE-BAD-001",
        evidence_level: "component",
        repository_state_sha256: "5".repeat(64),
        exit_code: 1,
        cwd: "/repo",
        artifacts: [{ path: "audits/example/evidence/negative-output.txt", sha256: "7".repeat(64) }],
        completed_at: "2026-07-19T11:02:00+09:00",
      },
    ],
    sweep: {
      status: "COMPLETE",
      requirement_ids: ["REQ-001"],
      files_inspected: ["src/stop.ts", "src/stop.test.ts"],
      commands: ["cd /repo && bun test stop-once.test.ts"],
      completed_at: "2026-07-19T11:00:00+09:00",
    },
    findings: [],
    rework_package: { status: "NONE", finding_ids: [], items: [] },
    reopen_records: [],
    inherited_blockers: [],
    downgrade_declaration: null,
    unclassified_findings: 0,
    evidence_ceiling: "integration",
    verdict: "ACCEPT",
    blocker_reason: null,
    invalid_reason: null,
  };
}

function blockingFinding(origin: Finding["origin"] = "PRE_EXISTING", introducedAfterFreeze = false): Finding {
  return {
    id: "F-001",
    requirement_ids: ["REQ-001"],
    classification: "BLOCKING",
    origin,
    introduced_after_freeze: introducedAfterFreeze,
    status: "OPEN",
    summary: "The stop call can execute twice",
    evidence: "EV-003",
    allowed_files: ["src/stop.ts", "src/stop.test.ts"],
    forbidden_changes: ["Do not change unrelated lifecycle stages"],
    closure_conditions: ["The positive control passes and the duplicate-stop negative control fails"],
    pre_fix_control: {
      command: "cd /repo && bun test stop-once.test.ts",
      expected: "FAIL",
      observed: "FAIL",
      evidence: "EV-003",
    },
  };
}

function frozenReworkItem(requiredChange = "Move the stop-attempt marker before the exact stop call"): ReworkItem {
  return {
    finding_id: "F-001",
    allowed_files: ["src/stop.ts", "src/stop.test.ts"],
    forbidden_changes: ["Do not change unrelated lifecycle stages"],
    required_changes: [requiredChange],
    acceptance_commands: [
      {
        command: "cd /repo && bun test stop-once.test.ts",
        expected: "exit 0 and the duplicate-stop negative control is observed FAIL",
      },
    ],
  };
}

function makeRework(contract: Contract) {
  contract.verdict = "REWORK";
  contract.requirements[0].status = "FAIL";
  contract.requirements[0].positive_control.observed = "FAIL";
  contract.findings = [blockingFinding()];
  contract.evidence_receipts.push({
    id: "EV-003",
    path: "audits/example/evidence/positive-failure-receipt.json",
    sha256: "3".repeat(64),
    command: "cd /repo && bun test stop-once.test.ts",
    observed: "FAIL",
    requirement_id: "REQ-001",
    polarity: "POSITIVE",
    oracle_id: "ORACLE-001",
    fixture_id: "FIXTURE-GOOD-001",
    evidence_level: "component",
    repository_state_sha256: contract.baseline.verdict_state_receipt?.sha256 ?? "5".repeat(64),
    exit_code: 1,
    cwd: "/repo",
    artifacts: [{ path: "audits/example/evidence/positive-failure-output.txt", sha256: "8".repeat(64) }],
    completed_at: "2026-07-19T11:01:00+09:00",
  });
  contract.requirements[0].positive_control.evidence = "EV-003";
  contract.rework_package = {
    status: "FROZEN",
    finding_ids: ["F-001"],
    items: [frozenReworkItem()],
  };
}

function report(contract: Contract): string {
  return `# Implementation Audit: Stop once

## 0. Machine-Readable Audit Contract
<!-- AUDIT_CONTRACT_START -->
\`\`\`json
${JSON.stringify(contract, null, 2)}
\`\`\`
<!-- AUDIT_CONTRACT_END -->

## 1. Audit Identity and Source Ledger
${contract.audit_id} at baseline ${contract.baseline.commit}; exact sources and hashes are recorded in the contract.
## 2. Frozen Scope and Exit Contract
### 2.1 IN-SCOPE
REQ-001
### 2.2 OUT-OF-SCOPE
Unrelated formatting refactors
### 2.3 Assumptions and disproof
The isolation command disproves contamination.
### 2.4 Deterministic exit criteria
REQ-001 closes only with both controls.
## 3. Requirement, Oracle, and Falsification Matrix
REQ-001 uses the injected counter oracle.
## 4. Full In-Scope Sweep
The sweep set exactly equals the frozen scope set.
## 5. Classified Findings
### 5.1 BLOCKING
${contract.findings.length ? contract.findings.map((item) => item.id).join(", ") : "NONE"}
### 5.2 NON_BLOCKING_DEBT
NONE
### 5.3 OUT_OF_SCOPE
NONE
### 5.4 UNVERIFIED
NONE
## 6. Falsification Evidence
The bad fixture is observed FAIL through the same counter oracle.
## 7. Frozen Rework Package
${contract.rework_package.status}
## 8. Reopen Records
${contract.reopen_records.length ? contract.reopen_records.map((item) => item.finding_id).join(", ") : "NONE"}
## 9. Closure Matrix
REQ-001 has an explicit gate.
## 10. Verdict
**Verdict**: \`${contract.verdict}\`
## 11. Validator Evidence
The validator command is recorded after execution.
## 12. Anti-Loop Answers
The full scope, bad fixture, exact blocker set, reopen records, origin, and exit condition are recorded.
`;
}

function codes(contract: Contract): string[] {
  return validateAuditSource(report(contract)).errors.map((item) => item.code);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function scopeLockPayload(contract: Contract) {
  return {
    schema_version: "1.0",
    lock_id: contract.scope_lock.lock_id,
    created_at: contract.scope.frozen_at,
    plan_sources: contract.baseline.plan_sources,
    scope: contract.scope,
    requirements: contract.requirements.map(({ id, plan_item_id, kind, source, behavior, required_evidence_level, oracle_id, oracle }) => ({
      id,
      plan_item_id,
      kind,
      source,
      behavior,
      required_evidence_level,
      oracle_id,
      oracle,
    })),
    plan_registry: contract.requirements.map(({ id, plan_item_id, kind, source, behavior, required_evidence_level, oracle_id, oracle }) => ({
      plan_item_id,
      disposition: "IN_SCOPE",
      requirement_id: id,
      source,
      kind,
      behavior,
      required_evidence_level,
      oracle_id,
      oracle,
    })),
    repository_scope: {
      allowed_paths: ["src/stop.ts", "src/stop.test.ts"],
      forbidden_paths: ["src/unrelated.ts"],
    },
    approval: {
      status: "APPROVED",
      actor_type: "HUMAN",
      approved_by: "test-reviewer",
      approved_at: contract.scope.frozen_at,
      evidence: "test fixture approval",
    },
  };
}

function materializeEvidenceReceipts(root: string, contract: Contract) {
  for (const receipt of contract.evidence_receipts) {
    receipt.repository_state_sha256 = contract.baseline.verdict_state_receipt!.sha256;
    for (const artifact of receipt.artifacts) {
      const artifactContent = `${receipt.id} ${receipt.observed} output\n`;
      writeFileSync(join(root, artifact.path), artifactContent);
      artifact.sha256 = sha256(artifactContent);
    }
    const { path: _path, sha256: _sha256, ...payload } = receipt;
    const content = `${JSON.stringify({ schema_version: "1.0", audit_id: contract.audit_id, generation: contract.generation, ...payload }, null, 2)}\n`;
    writeFileSync(join(root, receipt.path), content);
    receipt.sha256 = sha256(content);
  }
}

function replacePlaceholderCwd(value: unknown, repositoryRoot: string): void {
  if (Array.isArray(value)) {
    value.forEach((item) => replacePlaceholderCwd(item, repositoryRoot));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") (value as Record<string, unknown>)[key] = item.replaceAll("/repo", repositoryRoot);
    else replacePlaceholderCwd(item, repositoryRoot);
  }
}

function materializeExternalBaseline(root: string, contract: Contract) {
  const plan = "# Plan\n\n## stop-once\nThe stop attempt occurs exactly once.\n";
  const log = "# Implementation log\n\nThe implementation claims stop-once support.\n";
  mkdirSync(join(root, "plans", "example"), { recursive: true });
  mkdirSync(join(root, "logs"), { recursive: true });
  mkdirSync(join(root, "audits", "example", "evidence"), { recursive: true });
  writeFileSync(join(root, "plans", "example", "01-phase.md"), plan);
  writeFileSync(join(root, "logs", "2026-07-19-example.md"), log);
  const repositoryRoot = join(root, "repository");
  mkdirSync(join(repositoryRoot, "src"), { recursive: true });
  writeFileSync(join(repositoryRoot, "src", "stop.ts"), "export const stop = () => true;\n");
  writeFileSync(join(repositoryRoot, "src", "stop.test.ts"), "// fixture\n");
  const init = Bun.spawnSync({ cmd: ["git", "init", "-q", repositoryRoot], stdout: "pipe", stderr: "pipe" });
  expect(init.exitCode).toBe(0);
  const commit = Bun.spawnSync({
    cmd: ["git", "-C", repositoryRoot, "-c", "user.name=Audit Test", "-c", "user.email=audit@example.invalid", "add", "src"],
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(commit.exitCode).toBe(0);
  const committed = Bun.spawnSync({
    cmd: ["git", "-C", repositoryRoot, "-c", "user.name=Audit Test", "-c", "user.email=audit@example.invalid", "commit", "-qm", "fixture"],
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(committed.exitCode).toBe(0);
  const head = Bun.spawnSync({ cmd: ["git", "-C", repositoryRoot, "rev-parse", "HEAD"], stdout: "pipe", stderr: "pipe" }).stdout.toString().trim();
  replacePlaceholderCwd(contract, repositoryRoot);
  contract.baseline.workspace_root = root;
  contract.baseline.repository_root = repositoryRoot;
  contract.baseline.implementation_base_commit = head;
  contract.baseline.commit = head;
  contract.baseline.head_at_verdict = head;
  contract.baseline.dirty_paths = [];
  contract.baseline.plan_sources[0].sha256 = sha256(plan);
  contract.baseline.supplemental_sources[0].sha256 = sha256(log);
  const lock = `${JSON.stringify(scopeLockPayload(contract), null, 2)}\n`;
  writeFileSync(join(root, contract.scope_lock.path), lock);
  contract.scope_lock.sha256 = sha256(lock);
  const stateBase = {
    schema_version: "1.0",
    repository_realpath: repositoryRoot,
    phase_id: contract.scope_lock.lock_id,
    head,
    scope_lock_sha256: contract.scope_lock.sha256,
    status_entries: [],
  };
  const preState = `${JSON.stringify({ ...stateBase, captured_at: "2026-07-19T09:30:00+09:00" }, null, 2)}\n`;
  const verdictState = `${JSON.stringify({ ...stateBase, captured_at: "2026-07-19T11:05:00+09:00" }, null, 2)}\n`;
  writeFileSync(join(root, contract.baseline.pre_change_receipt!.path), preState);
  writeFileSync(join(root, contract.baseline.verdict_state_receipt!.path), verdictState);
  contract.baseline.pre_change_receipt!.sha256 = sha256(preState);
  contract.baseline.verdict_state_receipt!.sha256 = sha256(verdictState);
  materializeEvidenceReceipts(root, contract);
}

describe("validate-audit closure and falsifiability", () => {
  test("accepts a closed ACCEPT contract with positive and failing negative controls", () => {
    const result = validateAuditSource(report(baseContract()));
    expect(result.valid).toBeTrue();
    expect(result.verdict).toBe("ACCEPT");
    expect(result.counts.openBlockers).toBe(0);
  });

  test("rejects a green-only behavioral test whose bad fixture also passes", () => {
    const contract = baseContract();
    contract.requirements[0].negative_control.observed = "PASS";
    expect(codes(contract)).toContain("NEGATIVE_CONTROL_NOT_SENSITIVE");
  });

  test("rejects controls that claim execution with N/A commands or NOT-RUN evidence", () => {
    const contract = baseContract();
    contract.requirements[0].positive_control.command = "N/A";
    contract.requirements[0].positive_control.evidence = "NOT-RUN";
    const resultCodes = codes(contract);
    expect(resultCodes).toContain("CONTROL_COMMAND_NOT_EXECUTABLE");
    expect(resultCodes).toContain("CONTROL_EVIDENCE_NOT_EXECUTED");
  });

  test("rejects trivial true/false commands posing as executed controls", () => {
    const contract = baseContract();
    contract.requirements[0].positive_control.command = "cd /repo && true";
    contract.requirements[0].negative_control.command = "cd /repo && false";
    expect(codes(contract)).toContain("TRIVIAL_CONTROL_COMMAND");
  });

  test("rejects positive and negative controls that are only relabeled copies", () => {
    const contract = baseContract();
    contract.requirements[0].negative_control.command = contract.requirements[0].positive_control.command;
    contract.requirements[0].negative_control.evidence = contract.requirements[0].positive_control.evidence;
    const resultCodes = codes(contract);
    expect(resultCodes).toContain("CONTROL_COMMAND_NOT_DISCRIMINATING");
    expect(resultCodes).toContain("CONTROL_EVIDENCE_NOT_INDEPENDENT");
  });

  test("rejects executed controls without a registered immutable evidence receipt", () => {
    const contract = baseContract();
    contract.requirements[0].positive_control.evidence = "artifact/positive.txt";
    expect(codes(contract)).toContain("EVIDENCE_RECEIPT_REFERENCE_REQUIRED");
  });

  test("rejects a receipt whose producer command or observation disagrees with its control", () => {
    const contract = baseContract();
    contract.evidence_receipts[0].command = "cd /repo && bun test some-other.test.ts";
    contract.evidence_receipts[0].observed = "FAIL";
    const resultCodes = codes(contract);
    expect(resultCodes).toContain("EVIDENCE_RECEIPT_COMMAND_MISMATCH");
    expect(resultCodes).toContain("EVIDENCE_RECEIPT_OBSERVED_MISMATCH");
  });

  test("rejects a receipt bound to the wrong requirement, polarity, oracle, fixture, or baseline", () => {
    const contract = baseContract();
    const receipt = contract.evidence_receipts[0];
    receipt.requirement_id = "REQ-999";
    receipt.polarity = "NEGATIVE";
    receipt.oracle_id = "ORACLE-999";
    receipt.fixture_id = contract.evidence_receipts[1].fixture_id;
    receipt.repository_state_sha256 = "f".repeat(64);
    const resultCodes = codes(contract);
    expect(resultCodes).toContain("EVIDENCE_RECEIPT_REQUIREMENT_MISMATCH");
    expect(resultCodes).toContain("EVIDENCE_RECEIPT_POLARITY_MISMATCH");
    expect(resultCodes).toContain("EVIDENCE_RECEIPT_ORACLE_MISMATCH");
    expect(resultCodes).toContain("CONTROL_FIXTURE_NOT_DISCRIMINATING");
    expect(resultCodes).toContain("EVIDENCE_RECEIPT_BASELINE_MISMATCH");
  });

  test("rejects ACCEPT or REWORK without both pre-change and verdict state receipts", () => {
    const contract = baseContract();
    contract.baseline.pre_change_receipt = null;
    contract.baseline.verdict_state_receipt = null;
    const resultCodes = codes(contract);
    expect(resultCodes).toContain("PRE_CHANGE_RECEIPT_REQUIRED");
    expect(resultCodes).toContain("VERDICT_STATE_RECEIPT_REQUIRED");
  });

  test("allows BLOCKED to preserve NOT_RUN controls when required provenance is unavailable", () => {
    const contract = baseContract();
    contract.verdict = "BLOCKED";
    contract.blocker_reason = "The implementation pre-change receipt is unavailable";
    contract.baseline.pre_change_receipt = null;
    contract.baseline.verdict_state_receipt = null;
    contract.evidence_receipts = [];
    contract.requirements[0].status = "BLOCKED";
    contract.requirements[0].positive_control.observed = "NOT_RUN";
    contract.requirements[0].positive_control.evidence = "NOT-RUN";
    contract.requirements[0].negative_control.observed = "NOT_RUN";
    contract.requirements[0].negative_control.evidence = "NOT-RUN";
    expect(validateAuditSource(report(contract)).valid).toBeTrue();
  });

  test("accepts one frozen REWORK package that exactly equals all open blockers", () => {
    const contract = baseContract();
    makeRework(contract);
    const result = validateAuditSource(report(contract));
    expect(result.valid).toBeTrue();
    expect(result.counts.openBlockers).toBe(1);
  });

  test("rejects a piecemeal rework package that omits an open blocker", () => {
    const contract = baseContract();
    makeRework(contract);
    contract.rework_package.finding_ids = [];
    contract.rework_package.items = [];
    const resultCodes = codes(contract);
    expect(resultCodes).toContain("REWORK_FINDING_SET_MISMATCH");
    expect(resultCodes).toContain("REWORK_ITEM_SET_MISMATCH");
  });

  test("rejects REWORK when a failed requirement is absent from the blocker package", () => {
    const contract = baseContract();
    makeRework(contract);
    const second = structuredClone(contract.requirements[0]);
    second.id = "REQ-002";
    second.source = "plans/example/01-phase.md#cleanup-once";
    second.behavior = "Cleanup runs once after a stage failure";
    second.positive_control.command = "cd /repo && bun test cleanup-once.test.ts";
    second.positive_control.evidence = "artifact/cleanup-positive-failure.txt";
    second.negative_control.command = "cd /repo && bun test cleanup-once-negative.test.ts";
    second.negative_control.evidence = "artifact/cleanup-negative.txt";
    contract.requirements.push(second);
    contract.scope.in_scope.push("REQ-002");
    contract.sweep.requirement_ids.push("REQ-002");
    expect(codes(contract)).toContain("FAILED_REQUIREMENT_WITHOUT_BLOCKER");
  });

  test("rejects REWORK while an in-scope requirement remains BLOCKED", () => {
    const contract = baseContract();
    makeRework(contract);
    contract.requirements[0].status = "BLOCKED";
    contract.requirements[0].positive_control.observed = "BLOCKED";
    expect(codes(contract)).toContain("REWORK_WITH_NONFINAL_REQUIREMENT");
  });

  test("rejects ACCEPT or REWORK whose required evidence level is NOT-RUN", () => {
    const contract = baseContract();
    makeRework(contract);
    contract.requirements[0].required_evidence_level = "NOT-RUN";
    contract.evidence_ceiling = "NOT-RUN";
    const resultCodes = codes(contract);
    expect(resultCodes).toContain("REQUIRED_LEVEL_NOT_EXECUTABLE");
    expect(resultCodes).toContain("EVIDENCE_CEILING_NOT_EXECUTABLE");
  });

  test("rejects vague rework language even when the blocker set matches", () => {
    const contract = baseContract();
    makeRework(contract);
    contract.rework_package.items = [frozenReworkItem("加强相关文件并视情况处理")];
    expect(codes(contract)).toContain("VAGUE_REWORK_INSTRUCTION");
  });

  test("rejects rework forbidden-scope drift and non-observable acceptance text", () => {
    const contract = baseContract();
    makeRework(contract);
    contract.rework_package.items[0].forbidden_changes = ["A different prohibition"];
    contract.rework_package.items[0].acceptance_commands[0].expected = "looks good";
    const resultCodes = codes(contract);
    expect(resultCodes).toContain("REWORK_FORBIDDEN_CHANGES_DRIFT");
    expect(resultCodes).toContain("ACCEPTANCE_EXPECTATION_NOT_OBSERVABLE");
  });

  test("rejects a blocker introduced after freeze without a reopen record", () => {
    const contract = baseContract();
    makeRework(contract);
    contract.findings = [blockingFinding("REGRESSION", true)];
    expect(codes(contract)).toContain("POST_FREEZE_BLOCKER_WITHOUT_REOPEN");
  });

  test("rejects an open in-scope violation relabeled as non-blocking debt", () => {
    const contract = baseContract();
    const finding = blockingFinding();
    finding.classification = "NON_BLOCKING_DEBT";
    contract.findings = [finding];
    expect(codes(contract)).toContain("NONBLOCKER_LINKS_FROZEN_REQUIREMENT");
  });

  test("accepts an approved regression reopen with causal proof and affected resweep", () => {
    const contract = baseContract();
    contract.generation = 2;
    contract.previous_audit = { path: "audits/example/2026-07-18-audit.md", sha256: "d".repeat(64), audit_id: "AUDIT-20260718-001" };
    makeRework(contract);
    contract.findings = [blockingFinding("REGRESSION", true)];
    contract.reopen_records = [
      {
        finding_id: "F-001",
        gate: "IN_SCOPE_REGRESSION",
        origin: "REGRESSION",
        linked_rule: "REQ-001",
        baseline_proof: "The new baseline reproduces the duplicate call",
        causal_proof: "The implementation diff moves the marker after the throwing call",
        miss_explanation: "N/A",
        debt_rejection_reason: "The duplicate call violates the frozen stop-once exit criterion",
        affected_requirement_ids: ["REQ-001"],
        resweep_evidence: "REQ-001 success and failure paths were rerun",
        approval_evidence: "Existing-scope authority from REQ-001",
        approved: true,
      },
    ];
    expect(validateAuditSource(report(contract)).valid).toBeTrue();
  });

  test("rejects reopen records in generation one without an immutable predecessor", () => {
    const contract = baseContract();
    makeRework(contract);
    contract.findings = [blockingFinding("REGRESSION", true)];
    contract.reopen_records = [
      {
        finding_id: "F-001",
        gate: "IN_SCOPE_REGRESSION",
        origin: "REGRESSION",
        linked_rule: "REQ-001",
        baseline_proof: "The new baseline reproduces a failure",
        causal_proof: "The implementation diff introduces the duplicate call",
        miss_explanation: "N/A",
        debt_rejection_reason: "The behavior directly blocks REQ-001",
        affected_requirement_ids: ["REQ-001"],
        resweep_evidence: "REQ-001 was rerun",
        approval_evidence: "Existing-scope authority from REQ-001",
        approved: true,
      },
    ];
    expect(codes(contract)).toContain("REOPEN_WITHOUT_PRIOR_GENERATION");
  });

  test("rejects an orphan reopen record and regression approval without causal proof", () => {
    const contract = baseContract();
    contract.reopen_records = [
      {
        finding_id: "F-999",
        gate: "IN_SCOPE_REGRESSION",
        origin: "REGRESSION",
        linked_rule: "REQ-001",
        baseline_proof: "The new baseline reproduces a failure",
        causal_proof: "N/A",
        miss_explanation: "N/A",
        debt_rejection_reason: "The behavior would violate REQ-001",
        affected_requirement_ids: ["REQ-001"],
        resweep_evidence: "REQ-001 was rerun",
        approval_evidence: "Existing-scope authority from REQ-001",
        approved: true,
      },
    ];
    const resultCodes = codes(contract);
    expect(resultCodes).toContain("ORPHAN_REOPEN_RECORD");
    expect(resultCodes).toContain("REGRESSION_CAUSAL_PROOF_MISSING");
  });

  test("rejects a reopen linked_rule that is not a frozen requirement", () => {
    const contract = baseContract();
    makeRework(contract);
    contract.findings = [blockingFinding("REGRESSION", true)];
    contract.reopen_records = [
      {
        finding_id: "F-001",
        gate: "IN_SCOPE_REGRESSION",
        origin: "REGRESSION",
        linked_rule: "REQ-999",
        baseline_proof: "The new baseline reproduces a failure",
        causal_proof: "The implementation diff introduces the duplicate call",
        miss_explanation: "N/A",
        debt_rejection_reason: "The behavior directly blocks REQ-001",
        affected_requirement_ids: ["REQ-001"],
        resweep_evidence: "REQ-001 was rerun",
        approval_evidence: "Existing-scope authority from REQ-001",
        approved: true,
      },
    ];
    expect(codes(contract)).toContain("REOPEN_LINKED_RULE_UNKNOWN");
  });

  test("rejects ACCEPT when the audited baseline changed before verdict", () => {
    const contract = baseContract();
    contract.baseline.head_at_verdict = "d".repeat(40);
    expect(codes(contract)).toContain("BASELINE_DRIFT");
  });

  test("rejects a full sweep recorded before scope was frozen", () => {
    const contract = baseContract();
    contract.scope.frozen_at = "2026-07-19T12:00:00+09:00";
    contract.sweep.completed_at = "2026-07-19T11:00:00+09:00";
    expect(codes(contract)).toContain("FREEZE_AFTER_SWEEP");
  });

  test("rejects scope.frozen_at in the future (timezone mislabeling)", () => {
    const contract = baseContract();
    contract.scope.frozen_at = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
    expect(codes(contract)).toContain("TIMESTAMP_IN_FUTURE");
  });

  test("accepts scope.frozen_at within 5-minute tolerance", () => {
    const contract = baseContract();
    contract.scope.frozen_at = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    expect(codes(contract)).not.toContain("TIMESTAMP_IN_FUTURE");
  });

  test("rejects a requirement source that is absent from the authoritative plan ledger", () => {
    const contract = baseContract();
    contract.requirements[0].source = "logs/2026-07-19-example.md#invented-requirement";
    expect(codes(contract)).toContain("REQUIREMENT_SOURCE_NOT_AUTHORIZED");
  });

  test("rejects ACCEPT when a closed blocker has no post-fix closure proof", () => {
    const contract = baseContract();
    const finding = blockingFinding();
    finding.status = "CLOSED";
    contract.findings = [finding];
    expect(codes(contract)).toContain("CLOSED_BLOCKER_PROOF_MISSING");
  });

  test("rejects a closed blocker whose closure evidence is not its POST_FIX receipt", () => {
    const contract = baseContract();
    makeRework(contract);
    contract.verdict = "ACCEPT";
    contract.requirements[0].status = "PASS";
    contract.requirements[0].positive_control.observed = "PASS";
    contract.requirements[0].positive_control.evidence = "EV-001";
    contract.findings[0].status = "CLOSED";
    contract.findings[0].post_fix_control = {
      command: contract.requirements[0].positive_control.command,
      expected: "PASS",
      observed: "PASS",
      evidence: "EV-001",
    };
    contract.findings[0].closure_evidence = "EV-002";
    contract.rework_package = { status: "NONE", finding_ids: [], items: [] };
    const resultCodes = codes(contract);
    expect(resultCodes).toContain("CLOSURE_EVIDENCE_RECEIPT_MISMATCH");
    expect(resultCodes).toContain("POST_FIX_RECEIPT_POLARITY_MISMATCH");
  });

  test("accepts an explicit static observation without a fake mutation", () => {
    const contract = baseContract();
    contract.requirements[0] = {
      ...contract.requirements[0],
      kind: "STATIC",
      behavior: "The configured schema version equals 37",
      oracle: "Read-only SQLite PRAGMA user_version",
      positive_control: {
        command: "cd /repo && sqlite3 state.db 'PRAGMA user_version'",
        expected: "PASS",
        observed: "PASS",
        evidence: "EV-001",
      },
      negative_control: {
        applicability: "NOT_APPLICABLE_STATIC",
        method: "N/A",
        command: "N/A",
        expected: "N/A",
        observed: "N/A",
        evidence: "A read-only scalar observation has no behavioral execution path",
      },
    };
    contract.evidence_receipts[0].command = "cd /repo && sqlite3 state.db 'PRAGMA user_version'";
    const result = validateAuditSource(report(contract));
    expect(result.errors).toEqual([]);
    expect(result.valid).toBeTrue();
  });

  test("allows a structurally valid INVALID audit but forbids an actionable package", () => {
    const contract = baseContract();
    contract.verdict = "INVALID";
    contract.scope.status = "UNFROZEN";
    contract.sweep.status = "INCOMPLETE";
    contract.requirements[0].status = "INVALID";
    contract.invalid_reason = "The approved plan contains no observable acceptance criterion";
    expect(validateAuditSource(report(contract)).valid).toBeTrue();

    contract.rework_package = { status: "FROZEN", finding_ids: ["F-001"], items: [frozenReworkItem()] };
    expect(codes(contract)).toContain("INVALID_WITH_REWORK");
  });

  test("rejects unresolved template placeholders", () => {
    const contract = baseContract();
    const result = validateAuditSource(report(contract).replace("Stop once", "REPLACE_AUDIT_TITLE"));
    expect(result.errors.map((item) => item.code)).toContain("UNRESOLVED_REPLACE");
  });

  test("rejects a narrative body that omits the contract audit identity", () => {
    const contract = baseContract();
    const source = report(contract).replace(`${contract.audit_id} at baseline ${contract.baseline.commit}`, "Identity omitted");
    const resultCodes = validateAuditSource(source).errors.map((item) => item.code);
    expect(resultCodes).toContain("BODY_AUDIT_ID_MISSING");
    expect(resultCodes).toContain("BODY_BASELINE_MISSING");
  });

  test("CLI returns exit 0 for valid and exit 1 for falsifiability failure", () => {
    const root = mkdtempSync(join(tmpdir(), "audit-validator-"));
    roots.push(root);
    const validPath = join(root, "valid.md");
    const invalidPath = join(root, "invalid.md");
    const valid = baseContract();
    materializeExternalBaseline(root, valid);
    writeFileSync(validPath, report(valid));
    const invalid = structuredClone(valid);
    invalid.requirements[0].negative_control.observed = "PASS";
    writeFileSync(invalidPath, report(invalid));

    const validator = join(import.meta.dir, "..", "validate-audit.ts");
    const validRun = Bun.spawnSync({ cmd: [process.execPath, "run", validator, validPath], stdout: "pipe", stderr: "pipe" });
    const invalidRun = Bun.spawnSync({ cmd: [process.execPath, "run", validator, invalidPath], stdout: "pipe", stderr: "pipe" });
    expect(validRun.exitCode).toBe(0);
    expect(invalidRun.exitCode).toBe(1);
    expect(JSON.parse(invalidRun.stdout.toString()).errors.map((item: { code: string }) => item.code)).toContain("NEGATIVE_CONTROL_NOT_SENSITIVE");
  });

  test("CLI rejects a source-ledger hash that does not match the real file", () => {
    const root = mkdtempSync(join(tmpdir(), "audit-validator-hash-"));
    roots.push(root);
    const contract = baseContract();
    materializeExternalBaseline(root, contract);
    contract.baseline.plan_sources[0].sha256 = "f".repeat(64);
    const auditPath = join(root, "invalid-hash.md");
    writeFileSync(auditPath, report(contract));
    const validator = join(import.meta.dir, "..", "validate-audit.ts");
    const run = Bun.spawnSync({ cmd: [process.execPath, "run", validator, auditPath], cwd: root, stdout: "pipe", stderr: "pipe" });
    expect(run.exitCode).toBe(1);
    expect(JSON.parse(run.stdout.toString()).errors.map((item: { code: string }) => item.code)).toContain("SOURCE_HASH_MISMATCH");
  });

  test("CLI rejects an approved scope lock that omits a frozen requirement", () => {
    const root = mkdtempSync(join(tmpdir(), "audit-validator-lock-"));
    roots.push(root);
    const contract = baseContract();
    materializeExternalBaseline(root, contract);
    const lockPath = join(root, contract.scope_lock.path);
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    lock.requirements = [];
    const changedLock = `${JSON.stringify(lock, null, 2)}\n`;
    writeFileSync(lockPath, changedLock);
    contract.scope_lock.sha256 = sha256(changedLock);
    const auditPath = join(root, "invalid-lock.md");
    writeFileSync(auditPath, report(contract));
    const validator = join(import.meta.dir, "..", "validate-audit.ts");
    const run = Bun.spawnSync({ cmd: [process.execPath, "run", validator, auditPath], cwd: root, stdout: "pipe", stderr: "pipe" });
    expect(run.exitCode).toBe(1);
    expect(JSON.parse(run.stdout.toString()).errors.map((item: { code: string }) => item.code)).toContain("SCOPE_LOCK_CONTRACT_MISMATCH");
  });

  test("CLI rejects a plan registry whose full item set is not represented by the audit", () => {
    const root = mkdtempSync(join(tmpdir(), "audit-validator-registry-"));
    roots.push(root);
    const contract = baseContract();
    materializeExternalBaseline(root, contract);
    const lockPath = join(root, contract.scope_lock.path);
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    lock.plan_registry.push({
      ...lock.plan_registry[0],
      plan_item_id: "PLAN-REQ-002",
      requirement_id: "REQ-002",
      source: "plans/example/01-phase.md#another-required-behavior",
    });
    const changedLock = `${JSON.stringify(lock, null, 2)}\n`;
    writeFileSync(lockPath, changedLock);
    contract.scope_lock.sha256 = sha256(changedLock);
    const auditPath = join(root, "invalid-registry.md");
    writeFileSync(auditPath, report(contract));
    const validator = join(import.meta.dir, "..", "validate-audit.ts");
    const run = Bun.spawnSync({ cmd: [process.execPath, "run", validator, auditPath], cwd: root, stdout: "pipe", stderr: "pipe" });
    expect(run.exitCode).toBe(1);
    expect(JSON.parse(run.stdout.toString()).errors.map((item: { code: string }) => item.code)).toContain("PLAN_REGISTRY_COVERAGE_MISMATCH");
  });

  test("CLI rejects a missing or changed evidence artifact", () => {
    const root = mkdtempSync(join(tmpdir(), "audit-validator-evidence-"));
    roots.push(root);
    const contract = baseContract();
    materializeExternalBaseline(root, contract);
    contract.evidence_receipts[0].sha256 = "f".repeat(64);
    const auditPath = join(root, "invalid-evidence.md");
    writeFileSync(auditPath, report(contract));
    const validator = join(import.meta.dir, "..", "validate-audit.ts");
    const run = Bun.spawnSync({ cmd: [process.execPath, "run", validator, auditPath], cwd: root, stdout: "pipe", stderr: "pipe" });
    expect(run.exitCode).toBe(1);
    expect(JSON.parse(run.stdout.toString()).errors.map((item: { code: string }) => item.code)).toContain("EVIDENCE_HASH_MISMATCH");
  });

  test("CLI rejects an output artifact changed after its execution receipt was frozen", () => {
    const root = mkdtempSync(join(tmpdir(), "audit-validator-artifact-"));
    roots.push(root);
    const contract = baseContract();
    materializeExternalBaseline(root, contract);
    writeFileSync(join(root, contract.evidence_receipts[0].artifacts[0].path), "tampered output\n");
    const auditPath = join(root, "invalid-artifact.md");
    writeFileSync(auditPath, report(contract));
    const validator = join(import.meta.dir, "..", "validate-audit.ts");
    const run = Bun.spawnSync({ cmd: [process.execPath, "run", validator, auditPath], cwd: root, stdout: "pipe", stderr: "pipe" });
    expect(run.exitCode).toBe(1);
    expect(JSON.parse(run.stdout.toString()).errors.map((item: { code: string }) => item.code)).toContain("EVIDENCE_ARTIFACT_HASH_MISMATCH");
  });

  test("CLI rejects dirty repository paths forbidden by the approved scope lock", () => {
    const root = mkdtempSync(join(tmpdir(), "audit-validator-dirty-"));
    roots.push(root);
    const contract = baseContract();
    materializeExternalBaseline(root, contract);
    writeFileSync(join(contract.baseline.repository_root, "src", "unrelated.ts"), "export const unrelated = true;\n");
    contract.baseline.dirty_paths = ["src/unrelated.ts"];
    const auditPath = join(root, "invalid-dirty.md");
    writeFileSync(auditPath, report(contract));
    const validator = join(import.meta.dir, "..", "validate-audit.ts");
    const run = Bun.spawnSync({ cmd: [process.execPath, "run", validator, auditPath], cwd: root, stdout: "pipe", stderr: "pipe" });
    expect(run.exitCode).toBe(1);
    expect(JSON.parse(run.stdout.toString()).errors.map((item: { code: string }) => item.code)).toContain("DIRTY_FORBIDDEN_PATH");
  });

  test("CLI accepts generation two only after every previous blocker has current closure proof", () => {
    const root = mkdtempSync(join(tmpdir(), "audit-validator-close-chain-"));
    roots.push(root);
    const previous = baseContract();
    makeRework(previous);
    materializeExternalBaseline(root, previous);
    const previousPath = join(root, "audits", "example", "2026-07-18-audit.md");
    const previousSource = report(previous);
    writeFileSync(previousPath, previousSource);

    const current = structuredClone(previous);
    current.audit_id = "AUDIT-20260719-002";
    current.generation = 2;
    current.previous_audit = {
      path: "audits/example/2026-07-18-audit.md",
      sha256: sha256(previousSource),
      audit_id: previous.audit_id,
    };
    current.verdict = "ACCEPT";
    current.requirements[0].status = "PASS";
    current.requirements[0].positive_control.observed = "PASS";
    current.requirements[0].positive_control.evidence = "EV-001";
    current.evidence_receipts.push({
      id: "EV-004",
      path: "audits/example/evidence/post-fix-receipt.json",
      sha256: "9".repeat(64),
      command: current.requirements[0].positive_control.command,
      observed: "PASS",
      requirement_id: "REQ-001",
      polarity: "POST_FIX",
      oracle_id: "ORACLE-001",
      fixture_id: "FIXTURE-GOOD-POST-001",
      evidence_level: "component",
      repository_state_sha256: current.baseline.verdict_state_receipt!.sha256,
      exit_code: 0,
      cwd: current.baseline.repository_root,
      artifacts: [{ path: "audits/example/evidence/post-fix-output.txt", sha256: "a".repeat(64) }],
      completed_at: "2026-07-19T11:03:00+09:00",
    });
    current.findings[0].status = "CLOSED";
    current.findings[0].post_fix_control = {
      command: current.requirements[0].positive_control.command,
      expected: "PASS",
      observed: "PASS",
      evidence: "EV-004",
    };
    current.findings[0].closure_evidence = "EV-004";
    current.rework_package = { status: "NONE", finding_ids: [], items: [] };
    materializeEvidenceReceipts(root, current);
    const currentPath = join(root, "audits", "example", "2026-07-19-audit.md");
    writeFileSync(currentPath, report(current));

    const validator = join(import.meta.dir, "..", "validate-audit.ts");
    const run = Bun.spawnSync({ cmd: [process.execPath, "run", validator, currentPath], cwd: root, stdout: "pipe", stderr: "pipe" });
    expect(run.exitCode).toBe(0);
    expect(JSON.parse(run.stdout.toString()).valid).toBeTrue();
  });

  test("CLI rejects generation two when a previous open blocker silently disappears", () => {
    const root = mkdtempSync(join(tmpdir(), "audit-validator-chain-"));
    roots.push(root);
    const previous = baseContract();
    makeRework(previous);
    materializeExternalBaseline(root, previous);
    const previousPath = join(root, "audits", "example", "2026-07-18-audit.md");
    const previousSource = report(previous);
    writeFileSync(previousPath, previousSource);

    const current = structuredClone(previous);
    current.audit_id = "AUDIT-20260719-002";
    current.generation = 2;
    current.previous_audit = {
      path: "audits/example/2026-07-18-audit.md",
      sha256: sha256(previousSource),
      audit_id: previous.audit_id,
    };
    current.verdict = "ACCEPT";
    current.requirements[0].status = "PASS";
    current.requirements[0].positive_control.observed = "PASS";
    current.requirements[0].positive_control.evidence = "EV-001";
    current.findings = [];
    current.rework_package = { status: "NONE", finding_ids: [], items: [] };
    const currentPath = join(root, "audits", "example", "2026-07-19-audit.md");
    writeFileSync(currentPath, report(current));

    const validator = join(import.meta.dir, "..", "validate-audit.ts");
    const run = Bun.spawnSync({ cmd: [process.execPath, "run", validator, currentPath], cwd: root, stdout: "pipe", stderr: "pipe" });
    expect(run.exitCode).toBe(1);
    expect(JSON.parse(run.stdout.toString()).errors.map((item: { code: string }) => item.code)).toContain("PREVIOUS_BLOCKER_DROPPED");
  });
});
