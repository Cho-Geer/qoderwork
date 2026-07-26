import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { precheckBoundary } from "../audit-boundary-precheck.ts";

const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "boundary-"));
  const evidence = join(root, "evidence");
  mkdirSync(evidence);
  const scope = join(root, "scope.json");
  writeFileSync(scope, "{}");
  const contract = join(root, "requirements-contract.yaml");
  writeFileSync(contract, `schema_version: boundary-contract/v1
scope_lock_sha256: ${sha(scope)}
requirements:
  - id: R-001
    decision_cases:
      - id: DC-001
        polarity: POSITIVE
        fixture: FX-GOOD
        oracle: ORACLE-001
        expected_result: SUCCESS
        must_not_happen: [later-call]
      - id: DC-002
        polarity: NEGATIVE
        fixture: FX-BAD
        oracle: ORACLE-001
        expected_result: ERROR
        expected_error_code: DENIED
        must_not_happen: [later-call]
`);
  for (const [id, fixtureId, result, code] of [["DC-001", "FX-GOOD", "SUCCESS", undefined], ["DC-002", "FX-BAD", "ERROR", "DENIED"]]) {
    writeFileSync(join(evidence, `${id}.json`), JSON.stringify({ id: `EV-${id}`, decision_case_id: id, fixture_id: fixtureId, oracle_id: "ORACLE-001", observed_result: result, error_code: code, must_not_happen: ["later-call"] }));
  }
  return { root, scope, contract, evidence };
}

describe("audit-boundary-precheck", () => {
  test("accepts complete positive/negative case evidence and records actual receipt hashes", () => {
    const state = fixture();
    const matrix = precheckBoundary(state.scope, state.contract, state.evidence);
    expect(matrix.status).toBe("READY_FOR_LLM_REVIEW");
    expect(matrix.rows[0].evidence_sha256).toBe(sha(join(state.evidence, "DC-001.json")));
    rmSync(state.root, { recursive: true, force: true });
  });

  test("blocks duplicate, mismatch, missing side-effect, and out-of-scope evidence", () => {
    const state = fixture();
    writeFileSync(join(state.evidence, "duplicate.json"), JSON.stringify({ decision_case_id: "DC-001" }));
    let matrix = precheckBoundary(state.scope, state.contract, state.evidence);
    expect(matrix.blockers).toContain("DUPLICATE_CASE_EVIDENCE:DC-001");
    rmSync(join(state.evidence, "duplicate.json"));
    writeFileSync(join(state.evidence, "DC-002.json"), JSON.stringify({ id: "EV-DC-002", decision_case_id: "DC-002", fixture_id: "FX-WRONG", oracle_id: "ORACLE-001", observed_result: "ERROR", error_code: "DENIED", must_not_happen: ["later-call"] }));
    matrix = precheckBoundary(state.scope, state.contract, state.evidence);
    expect(matrix.blockers).toContain("FIXTURE_OR_ORACLE_MISMATCH:DC-002");
    writeFileSync(join(state.evidence, "DC-002.json"), JSON.stringify({ id: "EV-DC-002", decision_case_id: "DC-002", fixture_id: "FX-BAD", oracle_id: "ORACLE-001", observed_result: "SUCCESS", error_code: "DENIED", must_not_happen: [] }));
    matrix = precheckBoundary(state.scope, state.contract, state.evidence);
    expect(matrix.blockers).toContain("OBSERVATION_MISMATCH:DC-002");
    writeFileSync(join(state.evidence, "DC-002.json"), JSON.stringify({ id: "EV-DC-002", decision_case_id: "DC-002", fixture_id: "FX-BAD", oracle_id: "ORACLE-001", observed_result: "ERROR", error_code: "DENIED", must_not_happen: [] }));
    matrix = precheckBoundary(state.scope, state.contract, state.evidence);
    expect(matrix.blockers).toContain("SIDE_EFFECT_EVIDENCE_MISMATCH:DC-002");
    writeFileSync(join(state.evidence, "outside.json"), JSON.stringify({ id: "EV-OUT", decision_case_id: "DC-999" }));
    matrix = precheckBoundary(state.scope, state.contract, state.evidence);
    expect(matrix.blockers).toContain("EVIDENCE_CASE_OUT_OF_SCOPE:DC-999");
    rmSync(state.root, { recursive: true, force: true });
  });
});
