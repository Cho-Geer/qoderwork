import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "bun:test";
import { validateOutcomeDirectory } from "../validate-outcome-governance.ts";

const sha = (x: string | Buffer) => createHash("sha256").update(x).digest("hex");
const roots: string[] = [];
const json = (path: string, value: unknown) => { const bytes = `${JSON.stringify(value, null, 2)}\n`; mkdirSync(join(path, ".."), { recursive: true }); writeFileSync(path, bytes); return { bytes, sha256: sha(bytes) }; };
const file = (path: string, value: string) => { mkdirSync(join(path, ".."), { recursive: true }); writeFileSync(path, value); return { path, sha256: sha(value) }; };
const ref = (id: string, path: string, generation: number, bytes: string) => ({ id, path, generation, sha256: sha(bytes) });

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "outcome-v2-")); roots.push(root); const repo = join(root, "repo"), outcome = join(root, "outcome"); mkdirSync(repo); mkdirSync(outcome);
  execFileSync("git", ["init", "-q", repo]); execFileSync("git", ["-C", repo, "config", "user.email", "test@example.invalid"]); execFileSync("git", ["-C", repo, "config", "user.name", "test"]);
  const source = file(join(repo, "src/test.ts"), "export const answer = 42;\n"); const fixtureFile = file(join(repo, "fixtures/input.json"), "{}\n"); const oracle = file(join(repo, "oracle.ts"), "export {};\n"); const runner = file(join(repo, "runner.json"), "{}\n"); const lock = file(join(repo, "bun.lock"), "lock\n");
  execFileSync("git", ["-C", repo, "add", "."]); execFileSync("git", ["-C", repo, "commit", "-qm", "fixture"]); const tree = execFileSync("git", ["-C", repo, "rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
  const bundle = { schema_version: "outcome-test-bundle/v1", document_kind: "outcome-test-bundle", bundle_id: "bundle-1", outcome_id: "out-1", generation: 1, tests: [{ ...source, path: "src/test.ts" }], fixtures: [{ ...fixtureFile, path: "fixtures/input.json" }], oracle_sources: [{ ...oracle, path: "oracle.ts" }], runner_config: [{ ...runner, path: "runner.json" }], lockfiles: [{ ...lock, path: "bun.lock" }], expected_test_ids: ["t-1"], expected_test_count: 1 }; const bundleOut = json(join(outcome, "bundle.json"), bundle);
  const contract = { schema_version: "outcome-governance/v1", document_kind: "outcome-contract", contract_id: "contract-1", outcome_id: "out-1", generation: 1, created_at: "2026-08-02T00:00:00Z", target: [{ document_kind: "source-file", id: "target", generation: 1, outcome_id: "out-1", description: "value" }], boundary: { in_scope: ["src"], out_of_scope: ["deploy"] }, baseline: { repository_id: "fixture", baseline_tree_sha256: tree, configuration_sha256: "b".repeat(64) }, side_effect_boundary: { allowed: [], prohibited: ["network"] }, acceptance_strategy: { objective: "correct", boundary: "structural", acceptance: "review" }, acceptance_spec: { id: "spec-1", path: "spec.json", generation: 1 }, supersedes: null }; const contractOut = json(join(outcome, "contract.json"), contract);
  const spec = { schema_version: "outcome-governance/v1", document_kind: "acceptance-spec", spec_id: "spec-1", outcome_id: "out-1", generation: 1, contract: ref("contract-1", "contract.json", 1, contractOut.bytes), requirements: [{ id: "req-1", behavior: "works", oracle_id: "oracle-1" }], oracles: [{ id: "oracle-1", description: "observation" }], cases: [{ id: "case-1", test_id: "t-1", requirement_ids: ["req-1"], oracle_id: "oracle-1", level: "component", command: "bun test", expected: "PASS" }], test_bundle: ref("bundle-1", "bundle.json", 1, bundleOut.bytes) }; const specOut = json(join(outcome, "spec.json"), spec);
  const human = { status: "APPROVED", actor_type: "HUMAN", approved_by: "reviewer", principal_id: "human-1", trust_domain: "governance", approved_at: "2026-08-02T00:00:00Z", evidence: "review" };
  const approval = { schema_version: "outcome-governance/v1", document_kind: "outcome-approval", approval_id: "approval-1", outcome_id: "out-1", generation: 1, contract: ref("contract-1", "contract.json", 1, contractOut.bytes), acceptance_spec: ref("spec-1", "spec.json", 1, specOut.bytes), test_bundle: ref("bundle-1", "bundle.json", 1, bundleOut.bytes), amendment: null, approval: human, weakening_approval: null }; const approvalOut = json(join(outcome, "approval.json"), approval); const approvalRef = ref("approval-1", "approval.json", 1, approvalOut.bytes);
  const environment = json(join(outcome, "runs/env.json"), { os: "linux" }); const stdout = file(join(outcome, "runs/out.log"), "PASS\n"); const stderr = file(join(outcome, "runs/err.log"), "");
  const receipt = { schema_version: "outcome-run-receipt/v1", document_kind: "outcome-run-receipt", run_id: "run-1", case_id: "case-1", test_id: "t-1", execution_id: "exec-1", contract: approval.contract, acceptance_spec: approval.acceptance_spec, test_bundle: approval.test_bundle, approval_anchor: approvalRef, candidate_tree_sha256: tree, environment_manifest: { path: "runs/env.json", sha256: environment.sha256 }, environment_hash: environment.sha256, argv: ["bun", "test"], cwd: repo, exit_code: 0, signal: null, timed_out: false, execution_status: "PASS", oracle_observation: "passed", stdout: { path: "runs/out.log", sha256: stdout.sha256 }, stderr: { path: "runs/err.log", sha256: stderr.sha256 }, runner: { principal_id: "ci", trust_domain: "test" } }; const receiptOut = json(join(outcome, "runs/receipt.json"), receipt);
  const run = { schema_version: "outcome-governance/v1", document_kind: "outcome-run-result", run_id: "run-1", outcome_contract: approval.contract, acceptance_spec: approval.acceptance_spec, test_bundle: approval.test_bundle, approval_anchor: approvalRef, candidate_tree_sha256: tree, environment_hash: environment.sha256, code_revision: "HEAD", environment: "test", environment_manifest: { path: "runs/env.json", sha256: environment.sha256 }, inventory: { discovered_test_ids: ["t-1"], executed_test_ids: ["t-1"], skipped_test_ids: [], filtered_test_ids: [] }, case_results: [{ case_id: "case-1", test_id: "t-1", execution_id: "exec-1", execution_status: "PASS", oracle_observation: "passed", receipt: { path: "runs/receipt.json", sha256: receiptOut.sha256 } }], verdict: "PASS" }; const runOut = json(join(outcome, "runs/run.json"), run);
  const ledger = { schema_version: "outcome-governance/v1", document_kind: "outcome-ledger-event", event_id: "event-1", sequence: 1, recorded_at: "2026-08-02T00:00:00Z", outcome_id: "out-1", event_type: "CONTRACT_APPROVED", approval_anchor: approvalRef, contract_ref: approval.contract, amendment_ref: null, run_ref: null, previous_event: null }; const ledgerOut = json(join(outcome, "ledger/1.json"), ledger);
  json(join(outcome, "ledger/2.json"), { ...ledger, event_id: "event-2", sequence: 2, event_type: "RUN_RECORDED", run_ref: ref("run-1", "runs/run.json", 1, runOut.bytes), previous_event: ref("event-1", "ledger/1.json", 1, ledgerOut.bytes) });
  return { root, repo, outcome, contract, spec, run, paths: { contract: join(outcome, "contract.json"), spec: join(outcome, "spec.json"), run: join(outcome, "runs/run.json"), receipt: join(outcome, "runs/receipt.json"), source: join(repo, "src/test.ts"), ledger: join(outcome, "ledger/1.json") } };
}

function supersededFixture() {
  const f = fixture();
  const contract1Bytes = readFileSync(f.paths.contract, "utf8");
  const spec1Bytes = readFileSync(f.paths.spec, "utf8");
  const bundle1 = JSON.parse(readFileSync(join(f.outcome, "bundle.json"), "utf8"));
  const approval1Bytes = readFileSync(join(f.outcome, "approval.json"), "utf8");
  const approval1Ref = ref("approval-1", "approval.json", 1, approval1Bytes);
  const receipt = JSON.parse(readFileSync(f.paths.receipt, "utf8"));
  receipt.exit_code = 1; receipt.execution_status = "FAIL"; receipt.oracle_observation = "failed";
  const receiptOut = json(f.paths.receipt, receipt);
  const historicalRun = JSON.parse(readFileSync(f.paths.run, "utf8"));
  historicalRun.case_results[0].execution_status = "FAIL"; historicalRun.case_results[0].oracle_observation = "failed"; historicalRun.case_results[0].receipt.sha256 = receiptOut.sha256; historicalRun.verdict = "FAIL";
  const historicalRunOut = json(f.paths.run, historicalRun);
  const ledger1Bytes = readFileSync(f.paths.ledger, "utf8");
  const ledger2 = { schema_version: "outcome-governance/v1", document_kind: "outcome-ledger-event", event_id: "event-2", sequence: 2, recorded_at: "2026-08-02T00:01:00Z", outcome_id: "out-1", event_type: "RUN_RECORDED", approval_anchor: approval1Ref, contract_ref: ref("contract-1", "contract.json", 1, contract1Bytes), amendment_ref: null, run_ref: ref("run-1", "runs/run.json", 1, historicalRunOut.bytes), previous_event: ref("event-1", "ledger/1.json", 1, ledger1Bytes) };
  const ledger2Out = json(join(f.outcome, "ledger/2.json"), ledger2);
  const bundle2 = { ...bundle1, bundle_id: "bundle-2", generation: 2 };
  const bundle2Out = json(join(f.outcome, "bundle-2.json"), bundle2);
  const contract1 = JSON.parse(contract1Bytes);
  const contract2 = { ...contract1, contract_id: "contract-2", generation: 2, target: contract1.target.map((target: Record<string, unknown>) => ({ ...target, generation: 2 })), acceptance_spec: { id: "spec-2", path: "spec-2.json", generation: 2 }, supersedes: ref("contract-1", "contract.json", 1, contract1Bytes) };
  const contract2Out = json(join(f.outcome, "contract-2.json"), contract2);
  const spec1 = JSON.parse(spec1Bytes);
  const spec2 = { ...spec1, spec_id: "spec-2", generation: 2, contract: ref("contract-2", "contract-2.json", 2, contract2Out.bytes), test_bundle: ref("bundle-2", "bundle-2.json", 2, bundle2Out.bytes) };
  const spec2Out = json(join(f.outcome, "spec-2.json"), spec2);
  const amendment = { schema_version: "outcome-governance/v1", document_kind: "outcome-amendment", amendment_id: "amendment-2", outcome_id: "out-1", generation: 2, from_contract: ref("contract-1", "contract.json", 1, contract1Bytes), to_contract: ref("contract-2", "contract-2.json", 2, contract2Out.bytes), reason: "new generation", affected_case_ids: [], unaffected_case_ids: ["case-1"], affected_requirement_ids: [], unaffected_requirement_ids: ["req-1"], change_class: "NORMAL", prior_failures: [ref("run-1", "runs/run.json", 1, historicalRunOut.bytes)], frozen_diff: { spec_changed: true, changed_case_ids: [], changed_requirement_ids: [], changed_oracle_ids: [], test_bundle_changed_fields: [], test_bundle_source_changes: [] } };
  const amendmentOut = json(join(f.outcome, "amendment-2.json"), amendment);
  const human = { status: "APPROVED", actor_type: "HUMAN", approved_by: "reviewer-2", principal_id: "human-2", trust_domain: "governance-2", approved_at: "2026-08-02T00:02:00Z", evidence: "review" };
  const approval2 = { schema_version: "outcome-governance/v1", document_kind: "outcome-approval", approval_id: "approval-2", outcome_id: "out-1", generation: 2, contract: ref("contract-2", "contract-2.json", 2, contract2Out.bytes), acceptance_spec: ref("spec-2", "spec-2.json", 2, spec2Out.bytes), test_bundle: ref("bundle-2", "bundle-2.json", 2, bundle2Out.bytes), amendment: ref("amendment-2", "amendment-2.json", 2, amendmentOut.bytes), approval: human, weakening_approval: null };
  const approval2Out = json(join(f.outcome, "approval-2.json"), approval2);
  json(join(f.outcome, "ledger/3.json"), { schema_version: "outcome-governance/v1", document_kind: "outcome-ledger-event", event_id: "event-3", sequence: 3, recorded_at: "2026-08-02T00:03:00Z", outcome_id: "out-1", event_type: "CONTRACT_SUPERSEDED", approval_anchor: ref("approval-2", "approval-2.json", 2, approval2Out.bytes), contract_ref: ref("contract-2", "contract-2.json", 2, contract2Out.bytes), amendment_ref: ref("amendment-2", "amendment-2.json", 2, amendmentOut.bytes), run_ref: null, previous_event: ref("event-2", "ledger/2.json", 2, ledger2Out.bytes) });
  return { ...f, paths: { ...f.paths, ledger2: join(f.outcome, "ledger/2.json"), ledger3: join(f.outcome, "ledger/3.json") } };
}

function supersededBundleDriftFixture() {
  const f = supersededFixture();
  const source = "mutated\n";
  writeFileSync(f.paths.source, source);
  const bundlePath = join(f.outcome, "bundle-2.json");
  const bundle2 = JSON.parse(readFileSync(bundlePath, "utf8"));
  const predecessorSourceSha = bundle2.tests.find((item: { path: string }) => item.path === "src/test.ts").sha256;
  bundle2.tests = bundle2.tests.map((item: { path: string; sha256: string }) => item.path === "src/test.ts" ? { ...item, sha256: sha(source) } : item);
  const bundle2Out = json(bundlePath, bundle2);
  const specPath = join(f.outcome, "spec-2.json");
  const spec2 = JSON.parse(readFileSync(specPath, "utf8"));
  spec2.test_bundle = ref("bundle-2", "bundle-2.json", 2, bundle2Out.bytes);
  const spec2Out = json(specPath, spec2);
  const amendmentPath = join(f.outcome, "amendment-2.json");
  const amendment = JSON.parse(readFileSync(amendmentPath, "utf8"));
  amendment.frozen_diff.test_bundle_changed_fields = ["tests"];
  amendment.frozen_diff.test_bundle_source_changes = [{ path: "src/test.ts", from_sha256: predecessorSourceSha, to_sha256: sha(source) }];
  const amendmentOut = json(amendmentPath, amendment);
  const approvalPath = join(f.outcome, "approval-2.json");
  const approval2 = JSON.parse(readFileSync(approvalPath, "utf8"));
  approval2.acceptance_spec = ref("spec-2", "spec-2.json", 2, spec2Out.bytes);
  approval2.test_bundle = ref("bundle-2", "bundle-2.json", 2, bundle2Out.bytes);
  approval2.amendment = ref("amendment-2", "amendment-2.json", 2, amendmentOut.bytes);
  const approval2Out = json(approvalPath, approval2);
  const ledger3Path = f.paths.ledger3;
  const ledger3 = JSON.parse(readFileSync(ledger3Path, "utf8"));
  ledger3.approval_anchor = ref("approval-2", "approval-2.json", 2, approval2Out.bytes);
  json(ledger3Path, ledger3);
  return f;
}
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }); });

describe("validate outcome governance v2", () => {
  test("validates complete raw fixture structurally, never as admission", () => { const f = fixture(); expect(validateOutcomeDirectory(f.outcome, f.repo)).toEqual({ ok: true, mode: "structural", validation_kind: "review-separated", lifecycle: "ACTIVE", errors: [] }); });
  test("keeps a historical FAIL run while superseding to a distinct new approval and active head", () => { const f = supersededFixture(); expect(validateOutcomeDirectory(f.outcome, f.repo)).toEqual({ ok: true, mode: "structural", validation_kind: "review-separated", lifecycle: "ACTIVE", errors: [] }); });
  test("accepts superseded v1 bundle drift recorded by the amendment", () => { const f = supersededBundleDriftFixture(); const r = validateOutcomeDirectory(f.outcome, f.repo); expect(r.errors.some((x) => x.includes("SOURCE_HASH_MISMATCH") || x.includes("BUNDLE:TASK-LENS-TEST-BUNDLE-V1"))).toBe(false); });
  test("rejects a candidate tree that differs from its contract baseline", () => { const f = fixture(); const run = JSON.parse(readFileSync(f.paths.run, "utf8")); run.candidate_tree_sha256 = "0".repeat(40); json(f.paths.run, run); const r = validateOutcomeDirectory(f.outcome, f.repo); expect(r.errors).toContain("RUN_GIT_TREE_MISMATCH:run-1"); });
  test("rejects reusing the predecessor approval for a supersede event", () => { const f = supersededFixture(); const event = JSON.parse(readFileSync(f.paths.ledger3, "utf8")); event.approval_anchor = JSON.parse(readFileSync(f.paths.ledger2, "utf8")).approval_anchor; json(f.paths.ledger3, event); const r = validateOutcomeDirectory(f.outcome, f.repo); expect(r.ok).toBe(false); expect(r.errors).toContain("LEDGER_SUPERSESSION_BINDING_INVALID:event-3"); });
  test("detects independent candidate tree and immutable bundle source drift", () => { const f = fixture(); writeFileSync(f.paths.source, "mutated\n"); const r = validateOutcomeDirectory(f.outcome, f.repo); expect(r.ok).toBe(false); expect(r.errors.some((x) => x.startsWith("SOURCE_HASH_MISMATCH"))).toBe(true); });
  test("rejects malformed run JSON instead of skipping it", () => { const f = fixture(); writeFileSync(f.paths.run, "{broken"); const r = validateOutcomeDirectory(f.outcome, f.repo); expect(r.ok).toBe(false); expect(r.errors).toContain("JSON_INVALID:runs/run.json"); });
  test("rejects receipt environment/tree binding changes", () => { const f = fixture(); const receipt = JSON.parse(readFileSync(f.paths.receipt, "utf8")); receipt.environment_hash = "0".repeat(64); json(f.paths.receipt, receipt); const r = validateOutcomeDirectory(f.outcome, f.repo); expect(r.ok).toBe(false); expect(r.errors.some((x) => x.includes("RECEIPT_BINDING_MISMATCH"))).toBe(true); });
  test("rejects a FAIL case with a stored PASS verdict", () => { const f = fixture(); const run = JSON.parse(readFileSync(f.paths.run, "utf8")); run.case_results[0].execution_status = "FAIL"; json(f.paths.run, run); const r = validateOutcomeDirectory(f.outcome, f.repo); expect(r.ok).toBe(false); expect(r.errors).toContain("RUN_INVENTORY_OR_VERDICT_INVALID:run-1"); });
  test("rejects lifecycle in contract and inline acceptance hash", () => { const f = fixture(); const contract = JSON.parse(readFileSync(f.paths.contract, "utf8")); contract.lifecycle_status = "ACTIVE"; json(f.paths.contract, contract); expect(validateOutcomeDirectory(f.outcome, f.repo).ok).toBe(false); });
  test("fails closed on a ledger previous-event raw-reference mismatch", () => { const f = fixture(); const ledger = JSON.parse(readFileSync(f.paths.ledger, "utf8")); ledger.previous_event = ref("x", "ledger/0.json", 1, "no"); ledger.sequence = 2; json(f.paths.ledger, ledger); const r = validateOutcomeDirectory(f.outcome, f.repo); expect(r.ok).toBe(false); expect(r.errors).toContain("LEDGER_CHAIN_INVALID"); });
  test("rejects identity laundering in a run artifact reference", () => { const f = fixture(); const ledger = JSON.parse(readFileSync(join(f.outcome, "ledger/2.json"), "utf8")); ledger.run_ref.id = "other-run"; json(join(f.outcome, "ledger/2.json"), ledger); const r = validateOutcomeDirectory(f.outcome, f.repo); expect(r.ok).toBe(false); expect(r.errors).toContain("REFERENCE_IDENTITY_MISMATCH:ledger.run"); });
  test("rejects a copied predecessor field when its raw hash is changed", () => { const f = fixture(); const ledger = JSON.parse(readFileSync(join(f.outcome, "ledger/2.json"), "utf8")); ledger.previous_event.sha256 = "0".repeat(64); json(join(f.outcome, "ledger/2.json"), ledger); const r = validateOutcomeDirectory(f.outcome, f.repo); expect(r.ok).toBe(false); expect(r.errors).toContain("LEDGER_PREDECESSOR_RAW_REFERENCE_INVALID:event-2"); });
  test("rejects a run result whose case uses a different designated test", () => { const f = fixture(); const run = JSON.parse(readFileSync(f.paths.run, "utf8")); run.case_results[0].test_id = "other-test"; json(f.paths.run, run); const r = validateOutcomeDirectory(f.outcome, f.repo); expect(r.ok).toBe(false); expect(r.errors).toContain("RUN_INVENTORY_OR_VERDICT_INVALID:run-1"); });
  test("rejects symlink artifact escapes", () => { const f = fixture(); const outside = join(f.root, "outside"); writeFileSync(outside, "x"); rmSync(f.paths.receipt); symlinkSync(outside, f.paths.receipt); expect(validateOutcomeDirectory(f.outcome, f.repo).ok).toBe(false); });
});
