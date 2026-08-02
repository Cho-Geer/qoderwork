import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { validateAcceptanceSpec, validateOutcomeAmendment, validateOutcomeApproval, validateOutcomeContract, validateOutcomeLedger, validateOutcomeRunReceipt, validateOutcomeRunResult, validateTestBundle } from "../outcome-governance-v1.ts";

const sha = (x: string) => createHash("sha256").update(x).digest("hex");
const h = (path: string, bytes = path) => ({ path, sha256: sha(bytes) });
const r = (id: string, path: string, generation = 1, bytes = path) => ({ id, path, generation, sha256: sha(bytes) });
const tree = "a".repeat(40);
const bundle = { schema_version: "outcome-test-bundle/v1" as const, document_kind: "outcome-test-bundle" as const, bundle_id: "bundle-1", outcome_id: "out-1", generation: 1, tests: [h("src/test.ts")], fixtures: [h("fixtures/input.json")], oracle_sources: [h("oracle.ts")], runner_config: [h("runner.json")], lockfiles: [h("bun.lock")], expected_test_ids: ["t-1"], expected_test_count: 1 };
const bundleBytes = JSON.stringify(bundle);
const contract = { schema_version: "outcome-governance/v1" as const, document_kind: "outcome-contract" as const, contract_id: "contract-1", outcome_id: "out-1", generation: 1, created_at: "2026-08-02T00:00:00Z", target: [{ document_kind: "source-file", id: "target", generation: 1, outcome_id: "out-1", description: "value" }], boundary: { in_scope: ["src"], out_of_scope: ["deploy"] }, baseline: { repository_id: "repo", baseline_tree_sha256: tree, configuration_sha256: "b".repeat(64) }, side_effect_boundary: { allowed: [], prohibited: ["network"] }, acceptance_strategy: { objective: "correct", boundary: "structural", acceptance: "review" }, acceptance_spec: { id: "spec-1", path: "spec.json", generation: 1 }, supersedes: null };
const spec = { schema_version: "outcome-governance/v1" as const, document_kind: "acceptance-spec" as const, spec_id: "spec-1", outcome_id: "out-1", generation: 1, contract: r("contract-1", "contract.json"), requirements: [{ id: "req-1", behavior: "works", oracle_id: "oracle-1" }], oracles: [{ id: "oracle-1", description: "observable" }], cases: [{ id: "case-1", test_id: "t-1", requirement_ids: ["req-1"], oracle_id: "oracle-1", level: "component", command: "bun test", expected: "PASS" as const }], test_bundle: r("bundle-1", "bundle.json", 1, bundleBytes) };
const approval = r("approval-1", "approval.json");

describe("outcome governance v2 core", () => {
  test("accepts raw independent bundle and rejects contract lifecycle/inline approval", () => {
    const sources = { "src/test.ts": "src/test.ts", "fixtures/input.json": "fixtures/input.json", "oracle.ts": "oracle.ts", "runner.json": "runner.json", "bun.lock": "bun.lock" };
    expect(validateTestBundle(bundle, sources).ok).toBe(true);
    expect(validateAcceptanceSpec(spec, bundle, bundleBytes).ok).toBe(true);
    expect(validateAcceptanceSpec({ ...spec, oracles: [null] }, bundle, bundleBytes).ok).toBe(false);
    expect(validateOutcomeContract(contract).ok).toBe(true);
    expect(validateOutcomeContract({ ...contract, lifecycle_status: "ACTIVE" }).ok).toBe(false);
    expect(validateOutcomeContract({ ...contract, acceptance_spec: { ...contract.acceptance_spec, sha256: "c".repeat(64) } }).ok).toBe(false);
  });

  test("fails closed on bundle source/hash and unknown schema keys", () => {
    expect(validateTestBundle(bundle, {}).ok).toBe(false);
    expect(validateAcceptanceSpec({ ...spec, required: true }, bundle, bundleBytes).ok).toBe(false);
    expect(validateAcceptanceSpec(spec, bundle, "changed").ok).toBe(false);
  });

  test("rejects duplicate test inventory and a case mapped to an undeclared test", () => {
    const duplicateBundle = { ...bundle, expected_test_ids: ["t-1", "t-1"], expected_test_count: 2 };
    expect(validateTestBundle(duplicateBundle, { "src/test.ts": "src/test.ts", "fixtures/input.json": "fixtures/input.json", "oracle.ts": "oracle.ts", "runner.json": "runner.json", "bun.lock": "bun.lock" }).ok).toBe(false);
    expect(validateAcceptanceSpec({ ...spec, cases: [{ ...spec.cases[0], test_id: "other" }] }, bundle, bundleBytes).ok).toBe(false);
  });

  test("never throws and rejects malformed nested string arrays", () => {
    expect(() => validateOutcomeContract({ ...contract, boundary: { in_scope: ["src", "src"], out_of_scope: [null] } })).not.toThrow();
    expect(validateOutcomeContract({ ...contract, boundary: { in_scope: ["src", "src"], out_of_scope: [null] } }).ok).toBe(false);
  });

  test("rejects weakening approval when the second approval reuses its trust domain", () => {
    const human = { status: "APPROVED" as const, actor_type: "HUMAN" as const, approved_by: "reviewer", principal_id: "human", trust_domain: "governance", approved_at: "2026-08-02T00:00:00Z", evidence: "review" };
    expect(validateOutcomeApproval({ schema_version: "outcome-governance/v1", document_kind: "outcome-approval", approval_id: "approval-1", outcome_id: "out-1", generation: 1, contract: r("contract-1", "contract.json"), acceptance_spec: r("spec-1", "spec.json"), test_bundle: r("bundle-1", "bundle.json", 1, bundleBytes), amendment: null, approval: human, weakening_approval: { ...human, principal_id: "human-2" } }).ok).toBe(false);
  });

  test("requires full structured receipt fields and raw environment hash", () => {
    const env = h("runs/env.json", "{\"os\":\"linux\"}");
    const receipt = { schema_version: "outcome-run-receipt/v1", document_kind: "outcome-run-receipt", run_id: "run-1", case_id: "case-1", test_id: "t-1", execution_id: "exec-1", contract: r("contract-1", "contract.json"), acceptance_spec: r("spec-1", "spec.json"), test_bundle: r("bundle-1", "bundle.json", 1, bundleBytes), approval_anchor: approval, candidate_tree_sha256: tree, environment_manifest: env, environment_hash: env.sha256, argv: ["bun", "test"], cwd: "/repo", exit_code: 0, signal: null, timed_out: false, execution_status: "PASS", oracle_observation: "passed", stdout: h("runs/out.log", "out"), stderr: h("runs/err.log", "err"), runner: { principal_id: "runner", trust_domain: "ci" } } as const;
    expect(validateOutcomeRunReceipt(receipt).ok).toBe(true);
    expect(validateOutcomeRunReceipt({ ...receipt, environment_hash: "0".repeat(64) }).ok).toBe(false);
    expect(validateOutcomeRunReceipt({ ...receipt, extra: true }).ok).toBe(false);
    expect(validateOutcomeRunReceipt({ ...receipt, exit_code: 1 }).ok).toBe(false);
  });

  test("binds every target to its kind, outcome, and generation", () => {
    expect(validateOutcomeContract(contract).ok).toBe(true);
    expect(validateOutcomeContract({ ...contract, target: [{ ...contract.target[0], outcome_id: "other" }] }).ok).toBe(false);
  });

  test("requires contiguous raw-reference ledger and derives lifecycle externally", () => {
    const first = { schema_version: "outcome-governance/v1", document_kind: "outcome-ledger-event", event_id: "event-1", sequence: 1, recorded_at: "2026-08-02T00:00:00Z", outcome_id: "out-1", event_type: "CONTRACT_APPROVED", approval_anchor: approval, contract_ref: r("contract-1", "contract.json"), amendment_ref: null, run_ref: null, previous_event: null } as const;
    const bytes = JSON.stringify(first);
    const second = { ...first, event_id: "event-2", sequence: 2, event_type: "OUTCOME_RETIRED", previous_event: r("event-1", "ledger/1.json", 1, bytes) } as const;
    expect(validateOutcomeLedger([first, second]).ok).toBe(true);
    expect(validateOutcomeLedger([first, { ...second, previous_event: r("wrong", "ledger/1.json", 1, bytes) }]).ok).toBe(false);
  });

  test("rejects unlisted affected bundle changes and weakening misclassification", () => {
    const from = { contract: { ...contract }, contractRef: r("contract-1", "contract.json"), spec: { ...spec }, bundle: { ...bundle }, specRef: r("spec-1", "spec.json", 1, JSON.stringify(spec)) };
    const changedBundle = { ...bundle, generation: 2, bundle_id: "bundle-2" };
    const toContract = { ...contract, contract_id: "contract-2", generation: 2, supersedes: r("contract-1", "contract.json") };
    const toSpec = { ...spec, generation: 2, contract: r("contract-2", "contract-2.json", 2), test_bundle: r("bundle-2", "bundle-2.json", 2, JSON.stringify(changedBundle)) };
    const amendment = { schema_version: "outcome-governance/v1", document_kind: "outcome-amendment", amendment_id: "amend-1", outcome_id: "out-1", generation: 2, from_contract: r("contract-1", "contract.json"), to_contract: r("contract-2", "contract-2.json", 2), reason: "update", affected_case_ids: [], unaffected_case_ids: ["case-1"], affected_requirement_ids: [], unaffected_requirement_ids: ["req-1"], change_class: "NORMAL", prior_failures: [] };
    expect(validateOutcomeAmendment(amendment, from, { contract: toContract, contractRef: r("contract-2", "contract-2.json", 2), spec: toSpec, bundle: changedBundle, specRef: r("spec-1", "spec-2.json", 2, JSON.stringify(toSpec)) }).ok).toBe(false);
  });

  test("requires a raw approval anchor and a complete frozen amendment diff", () => {
    const nextContract = { ...contract, contract_id: "contract-2", generation: 2, target: [{ ...contract.target[0], generation: 2 }], supersedes: r("contract-1", "contract.json") };
    const nextSpec = { ...spec, generation: 2, contract: r("contract-2", "contract-2.json", 2), test_bundle: r("bundle-1", "bundle.json", 1, bundleBytes) };
    const amendment = { schema_version: "outcome-governance/v1" as const, document_kind: "outcome-amendment" as const, amendment_id: "amend-1", outcome_id: "out-1", generation: 2, from_contract: r("contract-1", "contract.json"), to_contract: r("contract-2", "contract-2.json", 2), reason: "new generation", affected_case_ids: [], unaffected_case_ids: ["case-1"], affected_requirement_ids: [], unaffected_requirement_ids: ["req-1"], change_class: "NORMAL" as const, prior_failures: [], frozen_diff: { spec_changed: true, changed_case_ids: [], changed_requirement_ids: [], changed_oracle_ids: [], test_bundle_changed_fields: [], test_bundle_source_changes: [] } };
    const from = { contract, contractRef: r("contract-1", "contract.json"), spec, bundle, specRef: r("spec-1", "spec.json", 1, JSON.stringify(spec)) };
    const to = { contract: nextContract, contractRef: r("contract-2", "contract-2.json", 2), spec: nextSpec, bundle, specRef: r("spec-1", "spec-2.json", 2, JSON.stringify(nextSpec)) };
    expect(validateOutcomeAmendment(amendment, from, to).ok).toBe(true);
    expect(validateOutcomeAmendment({ ...amendment, frozen_diff: { ...amendment.frozen_diff, spec_changed: false } }, from, to).ok).toBe(false);
  });

  test("treats removed expected test ids as weakening even when cases remain", () => {
    const smallerBundle = { ...bundle, expected_test_ids: [], expected_test_count: 0 };
    const nextContract = { ...contract, contract_id: "contract-2", generation: 2, target: [{ ...contract.target[0], generation: 2 }], supersedes: r("contract-1", "contract.json") };
    const nextSpec = { ...spec, generation: 2, contract: r("contract-2", "contract-2.json", 2), test_bundle: r("bundle-1", "bundle.json", 1, bundleBytes) };
    const from = { contract, contractRef: r("contract-1", "contract.json"), spec, bundle, specRef: r("spec-1", "spec.json", 1, JSON.stringify(spec)) };
    const to = { contract: nextContract, contractRef: r("contract-2", "contract-2.json", 2), spec: nextSpec, bundle: smallerBundle, specRef: r("spec-1", "spec-2.json", 2, JSON.stringify(nextSpec)) };
    const amendment = { schema_version: "outcome-governance/v1" as const, document_kind: "outcome-amendment" as const, amendment_id: "amend-2", outcome_id: "out-1", generation: 2, from_contract: from.contractRef, to_contract: to.contractRef, reason: "remove test", affected_case_ids: [], unaffected_case_ids: ["case-1"], affected_requirement_ids: [], unaffected_requirement_ids: ["req-1"], change_class: "NORMAL" as const, prior_failures: [], frozen_diff: { spec_changed: true, changed_case_ids: [], changed_requirement_ids: [], changed_oracle_ids: [], test_bundle_changed_fields: ["expected_test_count", "expected_test_ids"], test_bundle_source_changes: [] } };
    expect(validateOutcomeAmendment(amendment, from, to).ok).toBe(false);
  });

  test("run result rejects malformed inventory and invented execution-manifest field", () => {
    const env = h("runs/env.json", "env");
    const run = { schema_version: "outcome-governance/v1", document_kind: "outcome-run-result", run_id: "run-1", outcome_contract: r("contract-1", "contract.json"), acceptance_spec: r("spec-1", "spec.json"), test_bundle: r("bundle-1", "bundle.json", 1, bundleBytes), approval_anchor: approval, candidate_tree_sha256: tree, environment_hash: env.sha256, code_revision: "head", environment: "test", environment_manifest: env, inventory: { discovered_test_ids: ["t-1"], executed_test_ids: ["t-1"], skipped_test_ids: [], filtered_test_ids: [] }, case_results: [{ case_id: "case-1", test_id: "t-1", execution_id: "exec-1", execution_status: "PASS", oracle_observation: "passed", receipt: h("runs/receipt.json", "receipt") }], verdict: "PASS" };
    expect(validateOutcomeRunResult(run).ok).toBe(true);
    expect(validateOutcomeRunResult({ ...run, execution_manifest: {} }).ok).toBe(false);
  });
});
