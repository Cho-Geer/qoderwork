import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildLedgerEntry, buildRequirements, buildAuditContract, buildReportMarkdown, extractScope, loadEvidenceReceipts } from "../prepare-audit.ts";
import type { LoadedReceipt } from "../prepare-audit.ts";

// ─── 测试工具 ───

function makeReceipt(overrides: Record<string, unknown> = {}): LoadedReceipt {
  const parsed = {
    schema_version: "1.0",
    audit_id: "TEST-AUDIT-001",
    generation: 1,
    id: "EV-001",
    command: "cd /workspace && bun test",
    observed: "PASS",
    requirement_id: "REQ-001",
    polarity: "POSITIVE",
    oracle_id: "ORACLE-001",
    fixture_id: "FIXTURE-A",
    evidence_level: "component",
    repository_state_sha256: "a".repeat(64),
    exit_code: 0,
    cwd: "/workspace",
    artifacts: [{ path: "evidence/ev-001-output.txt", sha256: "b".repeat(64) }],
    completed_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
  return {
    absPath: "/workspace/evidence/ev-001-receipt.json",
    relPath: "evidence/ev-001-receipt.json",
    sha256: "c".repeat(64),
    parsed,
  };
}

function makeScopeLock(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "1.0",
    lock_id: "TEST-PHASE",
    created_at: "2026-01-01T00:00:00Z",
    plan_sources: [{ path: "plans/test-plan.md", sha256: "d".repeat(64) }],
    scope: {
      status: "FROZEN",
      provenance_level: "v2.1-required",
      frozen_at: "2026-01-01T00:00:00Z",
      in_scope: ["REQ-001"],
      out_of_scope: ["item-1"],
      assumptions: [{ statement: "assumption-1", disproof: "disproof-1" }],
      exit_criteria: ["criterion-1"],
    },
    requirements: [
      {
        id: "REQ-001",
        plan_item_id: "PLAN-REQ-001",
        kind: "BEHAVIORAL",
        source: "plans/test-plan.md#req-001",
        behavior: "test behavior",
        required_evidence_level: "component",
        oracle_id: "ORACLE-001",
        oracle: "test oracle",
      },
    ],
    plan_registry: [
      {
        plan_item_id: "PLAN-REQ-001",
        disposition: "IN_SCOPE",
        requirement_id: "REQ-001",
        source: "plans/test-plan.md#req-001",
        kind: "BEHAVIORAL",
        behavior: "test behavior",
        required_evidence_level: "component",
        oracle_id: "ORACLE-001",
        oracle: "test oracle",
      },
    ],
    repository_scope: { allowed_paths: ["src/"], forbidden_paths: [] },
    approval: { status: "APPROVED", actor_type: "HUMAN", approved_by: "tester", approved_at: "2026-01-01T00:00:00Z", evidence: "chat-link" },
    ...overrides,
  };
}

// ─── buildLedgerEntry 测试 ───

describe("buildLedgerEntry", () => {
  test("byte-exact: ledger entry minus path/sha256 equals receipt minus schema_version/audit_id/generation", () => {
    const receipt = makeReceipt();
    const entry = buildLedgerEntry(receipt);

    // 模拟 validator 的比较逻辑
    const expectedPayload = { ...entry };
    delete (expectedPayload as Record<string, unknown>).path;
    delete (expectedPayload as Record<string, unknown>).sha256;

    const actualPayload = { ...receipt.parsed };
    delete (actualPayload as Record<string, unknown>).schema_version;
    delete (actualPayload as Record<string, unknown>).audit_id;
    delete (actualPayload as Record<string, unknown>).generation;

    expect(JSON.stringify(actualPayload)).toBe(JSON.stringify(expectedPayload));
  });

  test("entry has path and sha256 from receipt metadata", () => {
    const receipt = makeReceipt();
    const entry = buildLedgerEntry(receipt);
    expect(entry.path).toBe("evidence/ev-001-receipt.json");
    expect(entry.sha256).toBe("c".repeat(64));
  });

  test("preserves key order from JSON.parse (rest-spread guarantee)", () => {
    // 构造一个特定 key order 的 receipt
    const jsonStr = '{"schema_version":"1.0","audit_id":"X","generation":1,"id":"EV-001","command":"cmd","observed":"PASS","requirement_id":"REQ-001","polarity":"POSITIVE","oracle_id":"O-001","fixture_id":"F-001","evidence_level":"component","repository_state_sha256":"aaa","exit_code":0,"cwd":"/w","artifacts":[],"completed_at":"2026-01-01T00:00:00Z"}';
    const parsed = JSON.parse(jsonStr);
    const receipt: LoadedReceipt = { absPath: "/w/e.json", relPath: "e.json", sha256: "fff", parsed };
    const entry = buildLedgerEntry(receipt);

    // entry 的 key order 应该是: path, sha256, id, command, observed, ...
    const keys = Object.keys(entry);
    expect(keys[0]).toBe("path");
    expect(keys[1]).toBe("sha256");
    expect(keys[2]).toBe("id");
    expect(keys[3]).toBe("command");
  });
});

// ─── buildRequirements 测试 ───

describe("buildRequirements", () => {
  test("BEHAVIORAL with POSITIVE+NEGATIVE receipts derives status PASS", () => {
    const scopeLock = makeScopeLock();
    const posReceipt = makeReceipt({ id: "EV-001", polarity: "POSITIVE", observed: "PASS" });
    const negReceipt = makeReceipt({ id: "EV-002", polarity: "NEGATIVE", observed: "FAIL", fixture_id: "FIXTURE-B", command: "cd /workspace && bun test --bad" });
    const controls = new Map([["REQ-001", { POSITIVE: posReceipt, NEGATIVE: negReceipt }]]);

    const reqs = buildRequirements(scopeLock as never, controls);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].status).toBe("PASS");
    expect((reqs[0].positive_control as Record<string, unknown>).observed).toBe("PASS");
    expect((reqs[0].positive_control as Record<string, unknown>).evidence).toBe("EV-001");
    expect((reqs[0].negative_control as Record<string, unknown>).observed).toBe("FAIL");
    expect((reqs[0].negative_control as Record<string, unknown>).evidence).toBe("EV-002");
    expect((reqs[0].negative_control as Record<string, unknown>).applicability).toBe("REQUIRED");
  });

  test("STATIC requirement gets NOT_APPLICABLE_STATIC negative control", () => {
    const scopeLock = makeScopeLock();
    (scopeLock.requirements as Array<Record<string, unknown>>)[0].kind = "STATIC";
    const posReceipt = makeReceipt({ id: "EV-001", polarity: "POSITIVE", observed: "PASS" });
    const controls = new Map([["REQ-001", { POSITIVE: posReceipt }]]);

    const reqs = buildRequirements(scopeLock as never, controls);
    expect(reqs[0].status).toBe("PASS");
    const neg = reqs[0].negative_control as Record<string, unknown>;
    expect(neg.applicability).toBe("NOT_APPLICABLE_STATIC");
    expect(neg.command).toBe("N/A");
    expect(neg.method).toBe("N/A");
    expect(neg.observed).toBe("N/A");
  });

  test("missing receipts produce REPLACE_ placeholders", () => {
    const scopeLock = makeScopeLock();
    const controls = new Map<string, { POSITIVE?: LoadedReceipt; NEGATIVE?: LoadedReceipt }>();

    const reqs = buildRequirements(scopeLock as never, controls);
    expect(reqs[0].status).toBe("REPLACE_STATUS");
    expect((reqs[0].positive_control as Record<string, unknown>).command).toBe("REPLACE_POSITIVE_COMMAND");
  });
});

// ─── buildAuditContract 测试 ───

describe("buildAuditContract", () => {
  test("derives audit_id and generation from receipts", () => {
    const receipt = makeReceipt({ audit_id: "MY-AUDIT", generation: 2 });
    const contract = buildAuditContract({
      workspaceRoot: "/workspace",
      scopeLock: makeScopeLock() as never,
      scopeLockRelPath: "audits/scope-lock.json",
      scopeLockSha256: "e".repeat(64),
      preChange: { head: "h1", repository_realpath: "/repo", captured_at: "2026-01-01T00:00:00Z", status_entries: [], scope_lock_sha256: "e".repeat(64), phase_id: "TEST-PHASE" },
      preChangeRelPath: "evidence/pre-change.json",
      preChangeSha256: "f".repeat(64),
      verdictState: { head: "h2", repository_realpath: "/repo", captured_at: "2026-01-01T01:00:00Z", status_entries: [], scope_lock_sha256: "e".repeat(64), phase_id: "TEST-PHASE" },
      verdictStateRelPath: "evidence/verdict-state.json",
      verdictStateSha256: "a".repeat(64),
      receipts: [receipt],
      verdict: "ACCEPT",
      evidenceCeiling: "component",
      supplementalSources: [],
    });

    expect(contract.audit_id).toBe("MY-AUDIT");
    expect(contract.generation).toBe(2);
  });

  test("baseline.commit equals verdict-state head", () => {
    const contract = buildAuditContract({
      workspaceRoot: "/workspace",
      scopeLock: makeScopeLock() as never,
      scopeLockRelPath: "audits/scope-lock.json",
      scopeLockSha256: "e".repeat(64),
      preChange: { head: "pre-head", repository_realpath: "/repo", captured_at: "2026-01-01T00:00:00Z", status_entries: [], scope_lock_sha256: "e".repeat(64), phase_id: "TEST-PHASE" },
      preChangeRelPath: "evidence/pre-change.json",
      preChangeSha256: "f".repeat(64),
      verdictState: { head: "verdict-head", repository_realpath: "/repo", captured_at: "2026-01-01T01:00:00Z", status_entries: [], scope_lock_sha256: "e".repeat(64), phase_id: "TEST-PHASE" },
      verdictStateRelPath: "evidence/verdict-state.json",
      verdictStateSha256: "a".repeat(64),
      receipts: [],
      verdict: "ACCEPT",
      evidenceCeiling: "component",
      supplementalSources: [],
    });

    const baseline = contract.baseline as Record<string, unknown>;
    expect(baseline.commit).toBe("verdict-head");
    expect(baseline.head_at_verdict).toBe("verdict-head");
    expect(baseline.implementation_base_commit).toBe("pre-head");
  });
});

// ─── buildReportMarkdown 测试 ───

describe("buildReportMarkdown", () => {
  test("contains all 21 required headings", () => {
    const receipt = makeReceipt();
    const contract = buildAuditContract({
      workspaceRoot: "/workspace",
      scopeLock: makeScopeLock() as never,
      scopeLockRelPath: "audits/scope-lock.json",
      scopeLockSha256: "e".repeat(64),
      preChange: { head: "h1", repository_realpath: "/repo", captured_at: "2026-01-01T00:00:00Z", status_entries: [], scope_lock_sha256: "e".repeat(64), phase_id: "TEST-PHASE" },
      preChangeRelPath: "evidence/pre-change.json",
      preChangeSha256: "f".repeat(64),
      verdictState: { head: "h1", repository_realpath: "/repo", captured_at: "2026-01-01T01:00:00Z", status_entries: [], scope_lock_sha256: "e".repeat(64), phase_id: "TEST-PHASE" },
      verdictStateRelPath: "evidence/verdict-state.json",
      verdictStateSha256: "a".repeat(64),
      receipts: [receipt],
      verdict: "ACCEPT",
      evidenceCeiling: "component",
      supplementalSources: [],
    });
    const md = buildReportMarkdown(contract);

    const REQUIRED_HEADINGS = [
      "## 0. Machine-Readable Audit Contract",
      "## 1. Audit Identity and Source Ledger",
      "## 2. Frozen Scope and Exit Contract",
      "### 2.1 IN-SCOPE",
      "### 2.2 OUT-OF-SCOPE",
      "### 2.3 Assumptions and disproof",
      "### 2.4 Deterministic exit criteria",
      "## 3. Requirement, Oracle, and Falsification Matrix",
      "## 4. Full In-Scope Sweep",
      "## 5. Classified Findings",
      "### 5.1 BLOCKING",
      "### 5.2 NON_BLOCKING_DEBT",
      "### 5.3 OUT_OF_SCOPE",
      "### 5.4 UNVERIFIED",
      "## 6. Falsification Evidence",
      "## 7. Frozen Rework Package",
      "## 8. Reopen Records",
      "## 9. Closure Matrix",
      "## 10. Verdict",
      "## 11. Validator Evidence",
      "## 12. Anti-Loop Answers",
    ];
    for (const heading of REQUIRED_HEADINGS) {
      expect(md).toContain(heading);
    }
  });

  test("body verdict line matches contract verdict", () => {
    const contract = buildAuditContract({
      workspaceRoot: "/workspace",
      scopeLock: makeScopeLock() as never,
      scopeLockRelPath: "audits/scope-lock.json",
      scopeLockSha256: "e".repeat(64),
      preChange: { head: "h1", repository_realpath: "/repo", captured_at: "2026-01-01T00:00:00Z", status_entries: [], scope_lock_sha256: "e".repeat(64), phase_id: "TEST-PHASE" },
      preChangeRelPath: "evidence/pre-change.json",
      preChangeSha256: "f".repeat(64),
      verdictState: { head: "h1", repository_realpath: "/repo", captured_at: "2026-01-01T01:00:00Z", status_entries: [], scope_lock_sha256: "e".repeat(64), phase_id: "TEST-PHASE" },
      verdictStateRelPath: "evidence/verdict-state.json",
      verdictStateSha256: "a".repeat(64),
      receipts: [],
      verdict: "ACCEPT",
      evidenceCeiling: "component",
      supplementalSources: [],
    });
    const md = buildReportMarkdown(contract);

    const matches = [...md.matchAll(/^\*\*Verdict\*\*:\s*`(ACCEPT|REWORK|BLOCKED|INVALID)`\s*$/gm)];
    expect(matches.length).toBe(1);
    expect(matches[0][1]).toBe("ACCEPT");
  });

  test("narrative body contains audit_id, commit, and REQ ids", () => {
    const receipt = makeReceipt();
    const contract = buildAuditContract({
      workspaceRoot: "/workspace",
      scopeLock: makeScopeLock() as never,
      scopeLockRelPath: "audits/scope-lock.json",
      scopeLockSha256: "e".repeat(64),
      preChange: { head: "h1", repository_realpath: "/repo", captured_at: "2026-01-01T00:00:00Z", status_entries: [], scope_lock_sha256: "e".repeat(64), phase_id: "TEST-PHASE" },
      preChangeRelPath: "evidence/pre-change.json",
      preChangeSha256: "f".repeat(64),
      verdictState: { head: "abc123", repository_realpath: "/repo", captured_at: "2026-01-01T01:00:00Z", status_entries: [], scope_lock_sha256: "e".repeat(64), phase_id: "TEST-PHASE" },
      verdictStateRelPath: "evidence/verdict-state.json",
      verdictStateSha256: "a".repeat(64),
      receipts: [receipt],
      verdict: "ACCEPT",
      evidenceCeiling: "component",
      supplementalSources: [],
    });
    const md = buildReportMarkdown(contract);
    // 去掉 contract block 后检查 narrative
    const narrative = md.replace(/<!-- AUDIT_CONTRACT_START -->[\s\S]*?<!-- AUDIT_CONTRACT_END -->/, "");
    expect(narrative).toContain("TEST-AUDIT-001");
    expect(narrative).toContain("abc123");
    expect(narrative).toContain("REQ-001");
  });

  test("contract block is parseable JSON", () => {
    const contract = buildAuditContract({
      workspaceRoot: "/workspace",
      scopeLock: makeScopeLock() as never,
      scopeLockRelPath: "audits/scope-lock.json",
      scopeLockSha256: "e".repeat(64),
      preChange: { head: "h1", repository_realpath: "/repo", captured_at: "2026-01-01T00:00:00Z", status_entries: [], scope_lock_sha256: "e".repeat(64), phase_id: "TEST-PHASE" },
      preChangeRelPath: "evidence/pre-change.json",
      preChangeSha256: "f".repeat(64),
      verdictState: { head: "h1", repository_realpath: "/repo", captured_at: "2026-01-01T01:00:00Z", status_entries: [], scope_lock_sha256: "e".repeat(64), phase_id: "TEST-PHASE" },
      verdictStateRelPath: "evidence/verdict-state.json",
      verdictStateSha256: "a".repeat(64),
      receipts: [],
      verdict: "ACCEPT",
      evidenceCeiling: "component",
      supplementalSources: [],
    });
    const md = buildReportMarkdown(contract);
    const match = md.match(/<!-- AUDIT_CONTRACT_START -->\s*```json\n([\s\S]*?)\n```\s*<!-- AUDIT_CONTRACT_END -->/);
    expect(match).not.toBeNull();
    const parsed = JSON.parse(match![1]);
    expect(parsed.schema_version).toBe("2.1");
  });
});

// ─── loadEvidenceReceipts 测试 ───

describe("loadEvidenceReceipts", () => {
  test("filters by audit_id and prefix", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "prepare-audit-test-"));
    const evidenceDir = join(tmpDir, "evidence");
    mkdirSync(evidenceDir, { recursive: true });

    // 写入匹配的 receipt
    const matching = { schema_version: "1.0", audit_id: "AUDIT-A", generation: 1, id: "EV-001", command: "cmd", observed: "PASS", requirement_id: "REQ-001", polarity: "POSITIVE", oracle_id: "O-001", fixture_id: "F-001", evidence_level: "component", repository_state_sha256: "a".repeat(64), exit_code: 0, cwd: "/w", artifacts: [], completed_at: "2026-01-01T00:00:00Z" };
    writeFileSync(join(evidenceDir, "prefix-ev-001-receipt.json"), JSON.stringify(matching, null, 2));

    // 写入不匹配 audit_id 的 receipt
    const wrongAudit = { ...matching, audit_id: "AUDIT-B", id: "EV-002" };
    writeFileSync(join(evidenceDir, "prefix-ev-002-receipt.json"), JSON.stringify(wrongAudit, null, 2));

    // 写入不匹配 prefix 的 receipt
    const wrongPrefix = { ...matching, id: "EV-003" };
    writeFileSync(join(evidenceDir, "other-ev-003-receipt.json"), JSON.stringify(wrongPrefix, null, 2));

    // 写入 pre-change（应被跳过）
    writeFileSync(join(evidenceDir, "pre-change-PHASE.json"), JSON.stringify({ head: "x" }));

    const receipts = loadEvidenceReceipts(evidenceDir, tmpDir, "AUDIT-A", "prefix-");
    expect(receipts).toHaveLength(1);
    expect(receipts[0].parsed.id).toBe("EV-001");

    rmSync(tmpDir, { recursive: true, force: true });
  });
});

// ─── CLI spawn 测试 ───

describe("prepare-audit CLI", () => {
  const SCRIPT = join(import.meta.dir, "..", "prepare-audit.ts");

  test("missing required arg exits 1", () => {
    const result = Bun.spawnSync({ cmd: [process.execPath, "run", SCRIPT], stdout: "pipe", stderr: "pipe" });
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("missing required argument");
  });

  test("wx protection: existing output exits 1", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "prepare-audit-cli-"));
    const outputFile = join(tmpDir, "output.md");
    writeFileSync(outputFile, "existing");

    // 创建最小输入
    const scopeLock = join(tmpDir, "scope-lock.json");
    writeFileSync(scopeLock, JSON.stringify(makeScopeLock()));
    const preChange = join(tmpDir, "pre-change.json");
    writeFileSync(preChange, JSON.stringify({ head: "h", repository_realpath: tmpDir, captured_at: "2026-01-01T00:00:00Z", status_entries: [], scope_lock_sha256: "x", phase_id: "P" }));
    const verdictState = join(tmpDir, "verdict-state.json");
    writeFileSync(verdictState, JSON.stringify({ head: "h", repository_realpath: tmpDir, captured_at: "2026-01-01T01:00:00Z", status_entries: [], scope_lock_sha256: "x", phase_id: "P" }));
    mkdirSync(join(tmpDir, "evidence"), { recursive: true });

    const result = Bun.spawnSync({
      cmd: [process.execPath, "run", SCRIPT,
        "--workspace-root", tmpDir,
        "--scope-lock", scopeLock,
        "--pre-change", preChange,
        "--verdict-state", verdictState,
        "--evidence-dir", join(tmpDir, "evidence"),
        "--output", outputFile,
      ],
      stdout: "pipe", stderr: "pipe",
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("already exists");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("generates valid output with real structure", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "prepare-audit-cli-"));
    const evidenceDir = join(tmpDir, "evidence");
    mkdirSync(evidenceDir, { recursive: true });

    // 写入 scope-lock
    const scopeLock = join(tmpDir, "scope-lock.json");
    writeFileSync(scopeLock, JSON.stringify(makeScopeLock(), null, 2));

    // 写入 state receipts
    const preChange = join(tmpDir, "pre-change.json");
    writeFileSync(preChange, JSON.stringify({ head: "abc", repository_realpath: tmpDir, captured_at: "2026-01-01T00:00:00Z", status_entries: [], scope_lock_sha256: "x", phase_id: "TEST-PHASE" }, null, 2));
    const verdictState = join(tmpDir, "verdict-state.json");
    writeFileSync(verdictState, JSON.stringify({ head: "abc", repository_realpath: tmpDir, captured_at: "2026-01-01T01:00:00Z", status_entries: [], scope_lock_sha256: "x", phase_id: "TEST-PHASE" }, null, 2));

    // 写入 EV receipt
    const evReceipt = { schema_version: "1.0", audit_id: "TEST-AUDIT", generation: 1, id: "EV-001", command: `cd ${tmpDir} && bun test`, observed: "PASS", requirement_id: "REQ-001", polarity: "POSITIVE", oracle_id: "ORACLE-001", fixture_id: "FIX-A", evidence_level: "component", repository_state_sha256: "y".repeat(64), exit_code: 0, cwd: tmpDir, artifacts: [{ path: "evidence/out.txt", sha256: "z".repeat(64) }], completed_at: "2026-01-01T00:30:00Z" };
    writeFileSync(join(evidenceDir, "ev-001-receipt.json"), JSON.stringify(evReceipt, null, 2));

    const outputFile = join(tmpDir, "audit-report.md");
    const result = Bun.spawnSync({
      cmd: [process.execPath, "run", SCRIPT,
        "--workspace-root", tmpDir,
        "--scope-lock", scopeLock,
        "--pre-change", preChange,
        "--verdict-state", verdictState,
        "--evidence-dir", evidenceDir,
        "--output", outputFile,
        "--verdict", "ACCEPT",
        "--evidence-ceiling", "component",
      ],
      stdout: "pipe", stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);
    const summary = JSON.parse(result.stdout.toString());
    expect(summary.audit_id).toBe("TEST-AUDIT");
    expect(summary.generation).toBe(1);
    expect(summary.requirements).toBe(1);
    expect(summary.evidence_receipts).toBe(1);

    // 验证输出文件存在且 contract 可解析
    const content = readFileSync(outputFile, "utf8");
    const match = content.match(/<!-- AUDIT_CONTRACT_START -->\s*```json\n([\s\S]*?)\n```\s*<!-- AUDIT_CONTRACT_END -->/);
    expect(match).not.toBeNull();
    const contract = JSON.parse(match![1]);
    expect(contract.schema_version).toBe("2.1");
    expect(contract.audit_id).toBe("TEST-AUDIT");

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
