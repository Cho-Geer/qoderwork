import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generatePhaseProjection, type CaseSelection, type ReceiptDeclaration } from "../generate-phase-projection.ts";

const sha = (content: string) => createHash("sha256").update(content).digest("hex");

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), "proj-"));
  const canonicalContent = `schema_version: audit-governance/v3\ndocument_kind: canonical-requirements\ncontract_id: TEST\n`;
  const canonicalPath = join(root, "canonical.yaml");
  writeFileSync(canonicalPath, canonicalContent);
  const canonicalSha256 = sha(canonicalContent);

  const scopeLockContent = `schema_version: audit-scope-lock/v3\ndocument_kind: phase-scope-lock\nphase_id: PHASE-TEST\n`;
  const scopeLockPath = join(root, "scope-lock.yaml");
  writeFileSync(scopeLockPath, scopeLockContent);
  const scopeLockSha256 = sha(scopeLockContent);

  const cases: CaseSelection[] = [
    { requirement_id: "REQ-003", decision_case_id: "DC-005", fixture_id: "FX-005", oracle_id: "ORACLE-005", expected_result: "READY", expected_error_code: null, must_not_happen: ["future_scope_hash_in_canonical"] },
    { requirement_id: "REQ-003", decision_case_id: "DC-006", fixture_id: "FX-006", oracle_id: "ORACLE-006", expected_result: "BLOCKED", expected_error_code: "ERR_CASE_SELECTION", must_not_happen: ["receipt_acceptance"] },
  ];

  const receiptDeclarations: ReceiptDeclaration[] = [
    { decision_case_id: "DC-005", receipt_path: "receipts/dc-005.json" },
    { decision_case_id: "DC-006", receipt_path: "receipts/dc-006.json" },
  ];

  return { root, canonicalPath, canonicalSha256, scopeLockPath, scopeLockSha256, cases, receiptDeclarations };
}

describe("generate-phase-projection", () => {
  test("DC-005: generates READY projection with exact hash bindings and selections", () => {
    const fx = makeFixture();
    try {
      const result = generatePhaseProjection({
        canonicalPath: fx.canonicalPath,
        canonicalSha256: fx.canonicalSha256,
        scopeLockPath: fx.scopeLockPath,
        scopeLockSha256: fx.scopeLockSha256,
        phaseId: "PHASE-TEST",
        cases: fx.cases,
        receiptDeclarations: fx.receiptDeclarations,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const proj = result.projection;
      expect(proj.schema_version).toBe("audit-phase-projection/v3");
      expect(proj.document_kind).toBe("phase-projection");
      expect(proj.phase_id).toBe("PHASE-TEST");
      const cb = proj.canonical_binding as Record<string, unknown>;
      expect(cb.sha256).toBe(fx.canonicalSha256);
      const slb = proj.scope_lock_binding as Record<string, unknown>;
      expect(slb.sha256).toBe(fx.scopeLockSha256);
      const selectedCases = proj.selected_cases as unknown[];
      expect(selectedCases.length).toBe(2);
      const declarations = proj.receipt_declarations as unknown[];
      expect(declarations.length).toBe(2);
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test("DC-006: blocks on canonical hash drift", () => {
    const fx = makeFixture();
    try {
      const result = generatePhaseProjection({
        canonicalPath: fx.canonicalPath,
        canonicalSha256: "a".repeat(64),
        scopeLockPath: fx.scopeLockPath,
        scopeLockSha256: fx.scopeLockSha256,
        phaseId: "PHASE-TEST",
        cases: fx.cases,
        receiptDeclarations: fx.receiptDeclarations,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("ERR_CANONICAL_HASH");
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test("DC-006: blocks on scope-lock hash drift", () => {
    const fx = makeFixture();
    try {
      const result = generatePhaseProjection({
        canonicalPath: fx.canonicalPath,
        canonicalSha256: fx.canonicalSha256,
        scopeLockPath: fx.scopeLockPath,
        scopeLockSha256: "b".repeat(64),
        phaseId: "PHASE-TEST",
        cases: fx.cases,
        receiptDeclarations: fx.receiptDeclarations,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("ERR_SCOPE_LOCK_HASH");
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test("DC-006: blocks on duplicate case selection", () => {
    const fx = makeFixture();
    try {
      const dupCases = [...fx.cases, { ...fx.cases[0] }];
      const result = generatePhaseProjection({
        canonicalPath: fx.canonicalPath,
        canonicalSha256: fx.canonicalSha256,
        scopeLockPath: fx.scopeLockPath,
        scopeLockSha256: fx.scopeLockSha256,
        phaseId: "PHASE-TEST",
        cases: dupCases,
        receiptDeclarations: fx.receiptDeclarations,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("ERR_CASE_SELECTION");
      expect(result.message).toContain("duplicate");
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });

  test("DC-006: blocks on unselected case in receipt declaration", () => {
    const fx = makeFixture();
    try {
      const badDeclarations: ReceiptDeclaration[] = [
        { decision_case_id: "DC-999", receipt_path: "receipts/dc-999.json" },
      ];
      const result = generatePhaseProjection({
        canonicalPath: fx.canonicalPath,
        canonicalSha256: fx.canonicalSha256,
        scopeLockPath: fx.scopeLockPath,
        scopeLockSha256: fx.scopeLockSha256,
        phaseId: "PHASE-TEST",
        cases: fx.cases,
        receiptDeclarations: badDeclarations,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("ERR_CASE_SELECTION");
      expect(result.message).toContain("unselected");
    } finally {
      rmSync(fx.root, { recursive: true, force: true });
    }
  });
});
