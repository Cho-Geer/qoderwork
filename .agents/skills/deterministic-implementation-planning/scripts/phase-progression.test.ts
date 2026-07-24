import { describe, expect, test } from "bun:test";
import {
  PROGRESSION_SCHEMA,
  PROGRESSION_STATUSES,
  deriveTopLevelStatus,
  isProgressionStatus,
  parseManifest,
  sha256Text,
  validateManifestRows,
  validateReceiptContract,
} from "./phase-progression.ts";

describe("phase progression contract", () => {
  test("locks the machine status enum and rejects historical DONE", () => {
    expect(PROGRESSION_STATUSES).toEqual(["NOT_STARTED", "IN_PROGRESS", "ACCEPTED", "BLOCKED", "INVALID"]);
    expect(isProgressionStatus("DONE")).toBe(false);
    expect(isProgressionStatus("ACCEPTED")).toBe(true);
  });

  test("derives the top-level status deterministically", () => {
    expect(deriveTopLevelStatus(["ACCEPTED", "ACCEPTED"])).toBe("COMPLETE");
    expect(deriveTopLevelStatus(["ACCEPTED", "IN_PROGRESS"])).toBe("IN-PROGRESS");
    expect(deriveTopLevelStatus(["ACCEPTED", "BLOCKED"])).toBe("BLOCKED");
    expect(deriveTopLevelStatus(["NOT_STARTED", "NOT_STARTED"])).toBe("READY-FOR-IMPLEMENTATION");
  });

  test("preserves manifest Status and diagnoses invalid values", () => {
    const result = parseManifest(`## 6. Phase manifest
| Order | Phase ID | File | Depends on | Status |
|---|---|---|---|---|
| 1 | PHASE-01 | \`01-phase-one.md\` | NONE | ACCEPTED |
| 2 | PHASE-02 | \`02-phase-two.md\` | PHASE-01 | DONE |
`);
    expect(result.rows.map((row) => row.status)).toEqual(["ACCEPTED", "DONE"]);
    expect(result.diagnostics.map((item) => item.code)).toContain("PHASE_STATUS_INVALID");
  });

  test("reports duplicate, order, and dependency diagnostics", () => {
    const result = validateManifestRows([
      { order: 2, id: "PHASE-01", file: "01-phase.md", dependencies: ["PHASE-02"], status: "NOT_STARTED" },
      { order: 2, id: "PHASE-01", file: "01-phase.md", dependencies: ["PHASE-99"], status: "NOT_STARTED" },
      { order: 3, id: "PHASE-02", file: "02-phase.md", dependencies: [], status: "NOT_STARTED" },
    ]);
    expect(result.map((item) => item.code)).toEqual(expect.arrayContaining([
      "PHASE_ORDER_INVALID",
      "DUPLICATE_PHASE_ID",
      "DUPLICATE_PHASE_FILE",
      "PHASE_DEPENDENCY_ORDER",
      "UNKNOWN_PHASE_DEPENDENCY",
    ]));
  });

  test("accepts a complete receipt contract", () => {
    const hash = sha256Text("fixture");
    const receipt = {
      schema_version: PROGRESSION_SCHEMA,
      plan_index_sha256: hash,
      phase_file_sha256: hash,
      audit_report_sha256: hash,
      validator_output_sha256: hash,
      phase_id: "PHASE-01",
      previous_status: "IN_PROGRESS",
      new_status: "ACCEPTED",
    };
    expect(validateReceiptContract(receipt, {
      phase_id: "PHASE-01",
      previous_status: "IN_PROGRESS",
      new_status: "ACCEPTED",
      plan_index_sha256: hash,
      phase_file_sha256: hash,
      audit_report_sha256: hash,
      validator_output_sha256: hash,
    })).toEqual([]);
  });

  test("fails closed on each receipt hash mutation", () => {
    const hash = sha256Text("fixture");
    const receipt = {
      schema_version: PROGRESSION_SCHEMA,
      plan_index_sha256: hash,
      phase_file_sha256: hash,
      audit_report_sha256: hash,
      validator_output_sha256: hash,
      phase_id: "PHASE-01",
      previous_status: "IN_PROGRESS",
      new_status: "ACCEPTED",
    };
    for (const field of ["plan_index_sha256", "phase_file_sha256", "audit_report_sha256", "validator_output_sha256"] as const) {
      const mutated = { ...receipt, [field]: sha256Text(`${field}-mutated`) };
      const diagnostics = validateReceiptContract(mutated, { [field]: hash });
      expect(diagnostics.map((item) => item.code)).toContain("PHASE_RECEIPT_HASH_MISMATCH");
    }
  });
});
