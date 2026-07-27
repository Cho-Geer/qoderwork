import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { precheckBoundary } from "../audit-boundary-precheck.ts";

const sha = (content: string) => createHash("sha256").update(content).digest("hex");

/** Build a valid projection + evidence root with explicit receipt paths. */
function makeFixture(opts: { escapePath?: boolean; symlinkEscape?: boolean; missingReceipt?: boolean; identityDrift?: boolean; observationMismatch?: boolean; sideEffectMismatch?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), "precheck-"));
  const evidenceRoot = join(root, "evidence");
  mkdirSync(join(evidenceRoot, "receipts"), { recursive: true });

  const cases = [
    { requirement_id: "REQ-004", decision_case_id: "DC-007", fixture_id: "FX-007", oracle_id: "ORACLE-007", expected_result: "SUCCESS", expected_error_code: null, must_not_happen: ["directory_discovery_as_evidence"] },
    { requirement_id: "REQ-004", decision_case_id: "DC-008", fixture_id: "FX-008", oracle_id: "ORACLE-008", expected_result: "ERROR", expected_error_code: "ERR_RECEIPT_PATH", must_not_happen: ["model_review"] },
  ];

  // Build receipt declarations
  const receiptDeclarations = [
    { decision_case_id: "DC-007", receipt_path: opts.escapePath ? "../../escaped.json" : "receipts/dc-007.json" },
    { decision_case_id: "DC-008", receipt_path: opts.symlinkEscape ? "receipts/symlink-escape.json" : "receipts/dc-008.json" },
  ];

  const projection = {
    schema_version: "audit-phase-projection/v3",
    document_kind: "phase-projection",
    phase_id: "PHASE-TEST",
    canonical_binding: { path: "canonical.yaml", sha256: "c".repeat(64) },
    scope_lock_binding: { path: "scope-lock.yaml", sha256: "d".repeat(64) },
    selected_cases: cases,
    receipt_declarations: receiptDeclarations,
  };

  const projectionPath = join(root, "projection.json");
  writeFileSync(projectionPath, JSON.stringify(projection, null, 2) + "\n");

  // Write receipts unless testing missing/escape scenarios
  if (!opts.missingReceipt && !opts.escapePath) {
    const receipt007 = {
      schema_version: "audit-evidence-receipt/v3",
      document_kind: "evidence-receipt",
      decision_case_id: opts.identityDrift ? "DC-999" : "DC-007",
      fixture_id: "FX-007",
      oracle_id: "ORACLE-007",
      execution: { observed: opts.observationMismatch ? "FAIL" : "PASS", exit_code: opts.observationMismatch ? 1 : 0, timed_out: false },
      domain_observation: { result: opts.observationMismatch ? "ERROR" : "SUCCESS", error_code: null },
      forbidden_side_effects_observed: opts.sideEffectMismatch ? [] : ["directory_discovery_as_evidence"],
    };
    writeFileSync(join(evidenceRoot, "receipts", "dc-007.json"), JSON.stringify(receipt007, null, 2) + "\n");
  }

  if (!opts.symlinkEscape) {
    const receipt008 = {
      schema_version: "audit-evidence-receipt/v3",
      document_kind: "evidence-receipt",
      decision_case_id: "DC-008",
      fixture_id: "FX-008",
      oracle_id: "ORACLE-008",
      execution: { observed: "FAIL", exit_code: 1, timed_out: false },
      domain_observation: { result: "ERROR", error_code: "ERR_RECEIPT_PATH" },
      forbidden_side_effects_observed: ["model_review"],
    };
    writeFileSync(join(evidenceRoot, "receipts", "dc-008.json"), JSON.stringify(receipt008, null, 2) + "\n");
  } else {
    // Create a symlink that escapes the evidence root
    const outsideFile = join(root, "outside-receipt.json");
    writeFileSync(outsideFile, JSON.stringify({ decision_case_id: "DC-008" }) + "\n");
    symlinkSync(outsideFile, join(evidenceRoot, "receipts", "symlink-escape.json"));
  }

  return { root, evidenceRoot, projectionPath };
}

describe("audit-boundary-precheck (projection-driven)", () => {
  test("DC-007: READY_FOR_LLM_REVIEW with exact covered rows and explicit receipt paths", () => {
    const fx = makeFixture();
    try {
      const matrix = precheckBoundary(fx.projectionPath, fx.evidenceRoot);
      expect(matrix.schema_version).toBe("audit-boundary-matrix/v3");
      expect(matrix.document_kind).toBe("boundary-matrix");
      expect(matrix.status).toBe("READY_FOR_LLM_REVIEW");
      expect(matrix.rows.length).toBe(2);
      expect(matrix.rows[0].coverage).toBe("COVERED");
      expect(matrix.rows[0].receipt_path).toBe("receipts/dc-007.json");
      expect(matrix.rows[0].receipt_sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(matrix.rows[1].coverage).toBe("COVERED");
      expect(matrix.blockers).toHaveLength(0);
      // Projection binding
      expect(matrix.projection_sha256).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test("DC-008: rejects path escape (../ traversal)", () => {
    const fx = makeFixture({ escapePath: true });
    try {
      const matrix = precheckBoundary(fx.projectionPath, fx.evidenceRoot);
      expect(matrix.status).toBe("BLOCKED");
      const escapeRow = matrix.rows.find(r => r.decision_case_id === "DC-007");
      expect(escapeRow).toBeDefined();
      expect(escapeRow!.blocker_reason).toContain("ERR_RECEIPT_PATH");
      expect(matrix.blockers.some(b => b.includes("ERR_RECEIPT_PATH"))).toBe(true);
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test("DC-008: rejects symlink escape", () => {
    const fx = makeFixture({ symlinkEscape: true });
    try {
      const matrix = precheckBoundary(fx.projectionPath, fx.evidenceRoot);
      expect(matrix.status).toBe("BLOCKED");
      const symlinkRow = matrix.rows.find(r => r.decision_case_id === "DC-008");
      expect(symlinkRow).toBeDefined();
      expect(symlinkRow!.blocker_reason).toContain("ERR_RECEIPT_PATH");
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test("DC-009: rejects missing receipt (NOT_FOUND)", () => {
    const fx = makeFixture({ missingReceipt: true });
    try {
      const matrix = precheckBoundary(fx.projectionPath, fx.evidenceRoot);
      expect(matrix.status).toBe("BLOCKED");
      const missingRow = matrix.rows.find(r => r.decision_case_id === "DC-007");
      expect(missingRow).toBeDefined();
      expect(missingRow!.blocker_reason).toContain("ERR_RECEIPT_NOT_FOUND");
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test("DC-009: rejects identity drift (decision_case_id mismatch)", () => {
    const fx = makeFixture({ identityDrift: true });
    try {
      const matrix = precheckBoundary(fx.projectionPath, fx.evidenceRoot);
      expect(matrix.status).toBe("BLOCKED");
      const driftRow = matrix.rows.find(r => r.decision_case_id === "DC-007");
      expect(driftRow).toBeDefined();
      expect(driftRow!.blocker_reason).toContain("ERR_RECEIPT_IDENTITY");
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test("DC-009: rejects dual observation mismatch", () => {
    const fx = makeFixture({ observationMismatch: true });
    try {
      const matrix = precheckBoundary(fx.projectionPath, fx.evidenceRoot);
      expect(matrix.status).toBe("BLOCKED");
      const obsRow = matrix.rows.find(r => r.decision_case_id === "DC-007");
      expect(obsRow).toBeDefined();
      expect(obsRow!.blocker_reason).toContain("ERR_RECEIPT_OBSERVATION");
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test("DC-009: rejects forbidden side-effect mismatch", () => {
    const fx = makeFixture({ sideEffectMismatch: true });
    try {
      const matrix = precheckBoundary(fx.projectionPath, fx.evidenceRoot);
      expect(matrix.status).toBe("BLOCKED");
      const seRow = matrix.rows.find(r => r.decision_case_id === "DC-007");
      expect(seRow).toBeDefined();
      expect(seRow!.blocker_reason).toContain("ERR_RECEIPT_OBSERVATION");
      expect(seRow!.blocker_reason).toContain("forbidden_side_effects");
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test("matrix uses v3 discriminator (audit-boundary-matrix/v3::boundary-matrix)", () => {
    const fx = makeFixture();
    try {
      const matrix = precheckBoundary(fx.projectionPath, fx.evidenceRoot);
      expect(matrix.schema_version).toBe("audit-boundary-matrix/v3");
      expect(matrix.document_kind).toBe("boundary-matrix");
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test("precheck never issues a verdict (only READY_FOR_LLM_REVIEW or BLOCKED)", () => {
    const fx = makeFixture();
    try {
      const matrix = precheckBoundary(fx.projectionPath, fx.evidenceRoot);
      expect(["READY_FOR_LLM_REVIEW", "BLOCKED"]).toContain(matrix.status);
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });
});
