import { describe, expect, test } from "bun:test";
import {
  SCHEMA_PAIRS,
  compareEvidenceLevel,
  compareSha256,
  guardGenesisIdentity,
  guardGenesisPosthocValidation,
  guardGenesisPreconditions,
  guardGenesisScopeApproval,
  guardRelativePath,
  parseAuditGovernanceV3Document,
  sha256Identity,
} from "../audit-governance-schema-v3.ts";

describe("audit governance v3 shared schema parser", () => {
  test("GPOS-002 accepts every canonical schema pair through the shared parser", () => {
    expect(SCHEMA_PAIRS).toHaveLength(17);
    for (const [schema_version, document_kind] of SCHEMA_PAIRS) {
      const result = parseAuditGovernanceV3Document({ schema_version, document_kind });
      expect(result.ok).toBe(true);
    }
  });

  test("GNEG-004 rejects a mismatched discriminator without field-shape guessing", () => {
    const result = parseAuditGovernanceV3Document({ schema_version: "audit-governance/v3", document_kind: "phase-projection" });
    expect(result).toMatchObject({ ok: false, error: "ERR_SCHEMA_DISCRIMINATOR" });
  });

  test("path, hash, and evidence comparators fail closed", () => {
    expect(guardRelativePath("/tmp/root", "../escaped")).toMatchObject({ ok: false, error: "ERR_PATH_GUARD" });
    const source = "bound";
    expect(compareSha256(sha256Identity(source), source)).toMatchObject({ ok: true });
    expect(compareSha256("0".repeat(64), source)).toMatchObject({ ok: false, error: "ERR_APPROVAL_BINDING" });
    expect(compareEvidenceLevel("component", "unit")).toMatchObject({ ok: true });
    expect(compareEvidenceLevel("unit", "component")).toMatchObject({ ok: false, error: "ERR_APPROVAL_BINDING" });
  });

  test("GNEG-005 through GNEG-008 enforce bootstrap uniqueness, capture, scope hash, and posthoc admission", () => {
    expect(guardGenesisIdentity("already-recorded", "second")).toMatchObject({ ok: false, error: "ERR_BOOTSTRAP_REUSE" });
    expect(guardGenesisPreconditions(false, true)).toMatchObject({ ok: false, error: "ERR_BOOTSTRAP_PRECONDITION" });
    expect(guardGenesisScopeApproval("a", "b")).toMatchObject({ ok: false, error: "ERR_BOOTSTRAP_APPROVAL" });
    expect(guardGenesisPosthocValidation(false)).toMatchObject({ ok: false, error: "ERR_BOOTSTRAP_POSTHOC_VALIDATION" });
  });
});
