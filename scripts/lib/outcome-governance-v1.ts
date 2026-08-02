/**
 * Pure, fail-closed outcome-governance contracts.
 *
 * This module validates supplied data only. It does not authenticate a runner
 * or make the directory that stores the data tamper resistant.
 */
import { createHash } from "node:crypto";

export const OUTCOME_SCHEMA_VERSION = "outcome-governance/v1" as const;
export const TEST_BUNDLE_SCHEMA_VERSION = "outcome-test-bundle/v1" as const;

export type ExecutionStatus = "PASS" | "FAIL" | "BLOCKED" | "NOT_RUN" | "INVALID";
export type OutcomeVerdict = ExecutionStatus;
export type ArtifactHash = { path: string; sha256: string };
export type ArtifactReference = ArtifactHash & { id: string; generation: number };
export type ArtifactIdentity = Omit<ArtifactReference, "sha256">;
export type Approval = {
  status: "APPROVED"; actor_type: "HUMAN"; approved_by: string;
  principal_id: string; trust_domain: string; approved_at: string; evidence: string;
};
export type TargetDocument = {
  document_kind: string; id: string; generation: number; outcome_id: string; description: string;
};
export type OutcomeContractV1 = {
  schema_version: typeof OUTCOME_SCHEMA_VERSION; document_kind: "outcome-contract";
  contract_id: string; outcome_id: string; generation: number; created_at: string;
  target: TargetDocument[];
  boundary: { in_scope: string[]; out_of_scope: string[] };
  baseline: { repository_id: string; baseline_tree_sha256: string; configuration_sha256: string };
  side_effect_boundary: { allowed: string[]; prohibited: string[] };
  acceptance_strategy: { objective: string; boundary: string; acceptance: string };
  acceptance_spec: ArtifactIdentity; supersedes: ArtifactReference | null;
};
export type AcceptanceSpecV1 = {
  schema_version: typeof OUTCOME_SCHEMA_VERSION; document_kind: "acceptance-spec";
  spec_id: string; outcome_id: string; generation: number; contract: ArtifactReference;
  requirements: Array<{ id: string; behavior: string; oracle_id: string }>;
  oracles: Array<{ id: string; description: string }>;
  cases: Array<{ id: string; test_id: string; requirement_ids: string[]; oracle_id: string; level: string; command: string; expected: "PASS" | "FAIL" }>;
  test_bundle: ArtifactReference;
};
export type OutcomeTestBundleV1 = {
  schema_version: typeof TEST_BUNDLE_SCHEMA_VERSION; document_kind: "outcome-test-bundle";
  bundle_id: string; outcome_id: string; generation: number;
  tests: ArtifactHash[]; fixtures: ArtifactHash[]; oracle_sources: ArtifactHash[];
  runner_config: ArtifactHash[]; lockfiles: ArtifactHash[];
  expected_test_ids: string[]; expected_test_count: number;
};
export type FrozenDiff = {
  spec_changed: boolean;
  changed_case_ids: string[]; changed_requirement_ids: string[]; changed_oracle_ids: string[];
  test_bundle_changed_fields: string[];
  test_bundle_source_changes: Array<{ path: string; from_sha256: string | null; to_sha256: string | null }>;
};
export type OutcomeAmendmentV1 = {
  schema_version: typeof OUTCOME_SCHEMA_VERSION; document_kind: "outcome-amendment";
  amendment_id: string; outcome_id: string; generation: number;
  from_contract: ArtifactReference; to_contract: ArtifactReference;
  reason: string; affected_case_ids: string[]; unaffected_case_ids: string[];
  affected_requirement_ids: string[]; unaffected_requirement_ids: string[];
  change_class: "NORMAL" | "WEAKENING"; prior_failures: ArtifactReference[]; frozen_diff: FrozenDiff;
};
export type OutcomeApprovalV1 = {
  schema_version: typeof OUTCOME_SCHEMA_VERSION; document_kind: "outcome-approval";
  approval_id: string; outcome_id: string; generation: number;
  contract: ArtifactReference; acceptance_spec: ArtifactReference; test_bundle: ArtifactReference;
  amendment: ArtifactReference | null; approval: Approval; weakening_approval: Approval | null;
};
export type OutcomeRunReceiptV1 = {
  schema_version: "outcome-run-receipt/v1"; document_kind: "outcome-run-receipt";
  run_id: string; case_id: string; test_id: string; execution_id: string;
  contract: ArtifactReference; acceptance_spec: ArtifactReference; test_bundle: ArtifactReference; approval_anchor: ArtifactReference;
  candidate_tree_sha256: string; environment_manifest: ArtifactHash; environment_hash: string;
  argv: string[]; cwd: string; exit_code: number | null; signal: string | null; timed_out: boolean;
  execution_status: ExecutionStatus; oracle_observation: string; stdout: ArtifactHash; stderr: ArtifactHash;
  runner: { principal_id: string; trust_domain: string };
};
export type OutcomeRunResultV1 = {
  schema_version: typeof OUTCOME_SCHEMA_VERSION; document_kind: "outcome-run-result";
  run_id: string; outcome_contract: ArtifactReference; acceptance_spec: ArtifactReference;
  test_bundle: ArtifactReference; approval_anchor: ArtifactReference; candidate_tree_sha256: string;
  environment_hash: string; code_revision: string; environment: string; environment_manifest: ArtifactHash;
  inventory: { discovered_test_ids: string[]; executed_test_ids: string[]; skipped_test_ids: string[]; filtered_test_ids: string[] };
  case_results: Array<{ case_id: string; test_id: string; execution_id: string; execution_status: ExecutionStatus; oracle_observation: string; receipt: ArtifactHash }>;
  verdict: OutcomeVerdict;
};
export type OutcomeLedgerEventV1 = {
  schema_version: typeof OUTCOME_SCHEMA_VERSION; document_kind: "outcome-ledger-event";
  event_id: string; sequence: number; recorded_at: string; outcome_id: string;
  event_type: "CONTRACT_APPROVED" | "CONTRACT_SUPERSEDED" | "OUTCOME_RETIRED" | "RUN_RECORDED";
  approval_anchor: ArtifactReference; contract_ref: ArtifactReference;
  amendment_ref: ArtifactReference | null; run_ref: ArtifactReference | null; previous_event: ArtifactReference | null;
};
export type OutcomeDocumentV1 = OutcomeContractV1 | AcceptanceSpecV1 | OutcomeTestBundleV1 | OutcomeAmendmentV1 | OutcomeApprovalV1 | OutcomeRunResultV1 | OutcomeLedgerEventV1;
export type OutcomeValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };
export type SourceBytes = Readonly<Record<string, string | Uint8Array>>;

const HASH = /^[a-f0-9]{64}$/i;
const TREE = /^[a-f0-9]{40,64}$/i;
const STATUSES: readonly ExecutionStatus[] = ["PASS", "FAIL", "BLOCKED", "NOT_RUN", "INVALID"];

export const sha256 = (bytes: string | Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const positiveInteger = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;
const unique = (values: string[]): boolean => new Set(values).size === values.length;
const uniqueStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every(nonEmpty) && unique(value);
const fail = <T = never>(...errors: string[]): OutcomeValidationResult<T> => ({ ok: false, errors: [...new Set(errors)] });
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => object(value) && Object.keys(value).length === keys.length && keys.every((key) => key in value);
const sameSet = (left: string[], right: string[]): boolean => uniqueStrings(left) && uniqueStrings(right)
  && left.length === right.length && left.every((value) => right.includes(value));
export const sameReference = (left: ArtifactReference, right: ArtifactReference): boolean => left.id === right.id && left.path === right.path && left.generation === right.generation && left.sha256 === right.sha256;

const isArtifact = (value: unknown): value is ArtifactHash => exact(value, ["path", "sha256"]) && nonEmpty(value.path) && nonEmpty(value.sha256) && HASH.test(value.sha256);
const isReference = (value: unknown): value is ArtifactReference => exact(value, ["id", "path", "generation", "sha256"]) && nonEmpty(value.id) && positiveInteger(value.generation) && isArtifact({ path: value.path, sha256: value.sha256 });
const isIdentity = (value: unknown): value is ArtifactIdentity => exact(value, ["id", "path", "generation"]) && nonEmpty(value.id) && nonEmpty(value.path) && positiveInteger(value.generation);
const isApproval = (value: unknown): value is Approval => exact(value, ["status", "actor_type", "approved_by", "principal_id", "trust_domain", "approved_at", "evidence"]) && value.status === "APPROVED" && value.actor_type === "HUMAN" && [value.approved_by, value.principal_id, value.trust_domain, value.approved_at, value.evidence].every(nonEmpty);

export function parseOutcomeDocument(value: unknown): OutcomeValidationResult<OutcomeDocumentV1> {
  if (!object(value)) return fail("SCHEMA_DISCRIMINATOR_INVALID");
  const kind = `${value.schema_version}:${value.document_kind}`;
  const known = new Set([
    "outcome-governance/v1:outcome-contract", "outcome-governance/v1:acceptance-spec",
    "outcome-test-bundle/v1:outcome-test-bundle", "outcome-governance/v1:outcome-amendment",
    "outcome-governance/v1:outcome-approval", "outcome-governance/v1:outcome-run-result",
    "outcome-governance/v1:outcome-ledger-event",
  ]);
  return known.has(kind) ? { ok: true, value: value as OutcomeDocumentV1 } : fail("SCHEMA_DISCRIMINATOR_INVALID");
}

export function validateOutcomeContract(value: unknown): OutcomeValidationResult<OutcomeContractV1> {
  const parsed = parseOutcomeDocument(value);
  if (!parsed.ok || parsed.value.document_kind !== "outcome-contract") return fail("CONTRACT_INVALID");
  const contract = parsed.value;
  const validTarget = (target: unknown): target is TargetDocument => exact(target, ["document_kind", "id", "generation", "outcome_id", "description"])
    && [target.document_kind, target.id, target.outcome_id, target.description].every(nonEmpty) && positiveInteger(target.generation)
    && target.outcome_id === contract.outcome_id && target.generation === contract.generation;
  const boundaryValid = exact(contract.boundary, ["in_scope", "out_of_scope"])
    && uniqueStrings(contract.boundary.in_scope) && contract.boundary.in_scope.length > 0
    && uniqueStrings(contract.boundary.out_of_scope) && unique([...contract.boundary.in_scope, ...contract.boundary.out_of_scope]);
  const baselineValid = exact(contract.baseline, ["repository_id", "baseline_tree_sha256", "configuration_sha256"])
    && nonEmpty(contract.baseline.repository_id) && TREE.test(contract.baseline.baseline_tree_sha256) && HASH.test(contract.baseline.configuration_sha256);
  const sideEffectsValid = exact(contract.side_effect_boundary, ["allowed", "prohibited"])
    && uniqueStrings(contract.side_effect_boundary.allowed) && uniqueStrings(contract.side_effect_boundary.prohibited) && contract.side_effect_boundary.prohibited.length > 0;
  const strategyValid = exact(contract.acceptance_strategy, ["objective", "boundary", "acceptance"])
    && [contract.acceptance_strategy.objective, contract.acceptance_strategy.boundary, contract.acceptance_strategy.acceptance].every(nonEmpty);
  const keys = ["schema_version", "document_kind", "contract_id", "outcome_id", "generation", "created_at", "target", "boundary", "baseline", "side_effect_boundary", "acceptance_strategy", "acceptance_spec", "supersedes"];
  if (!exact(contract, keys) || ![contract.contract_id, contract.outcome_id, contract.created_at].every(nonEmpty) || !positiveInteger(contract.generation)
    || !Array.isArray(contract.target) || contract.target.length === 0 || !contract.target.every(validTarget)
    || !unique(contract.target.map((target) => target.id))
    || !boundaryValid || !baselineValid || !sideEffectsValid || !strategyValid || !isIdentity(contract.acceptance_spec)
    || (contract.generation === 1 ? contract.supersedes !== null : !isReference(contract.supersedes))) return fail("CONTRACT_INVALID");
  return { ok: true, value: contract };
}

export function validateTestBundle(value: unknown, sources: SourceBytes = {}): OutcomeValidationResult<OutcomeTestBundleV1> {
  const parsed = parseOutcomeDocument(value);
  if (!parsed.ok || parsed.value.document_kind !== "outcome-test-bundle") return fail("TEST_BUNDLE_INVALID");
  const bundle = parsed.value;
  const groups = [bundle.tests, bundle.fixtures, bundle.oracle_sources, bundle.runner_config, bundle.lockfiles];
  const allArtifacts = groups.flat();
  const validArtifacts = allArtifacts.every(isArtifact) && unique(allArtifacts.map((artifact) => artifact.path));
  const validSources = validArtifacts && allArtifacts.every((artifact) => sources[artifact.path] !== undefined && sha256(sources[artifact.path]!) === artifact.sha256);
  const keys = ["schema_version", "document_kind", "bundle_id", "outcome_id", "generation", "tests", "fixtures", "oracle_sources", "runner_config", "lockfiles", "expected_test_ids", "expected_test_count"];
  if (!exact(bundle, keys) || ![bundle.bundle_id, bundle.outcome_id].every(nonEmpty) || !positiveInteger(bundle.generation)
    || groups.some((group) => !Array.isArray(group) || group.length === 0) || !validArtifacts
    || !uniqueStrings(bundle.expected_test_ids) || bundle.expected_test_ids.length === 0
    || bundle.expected_test_count !== bundle.expected_test_ids.length || !validSources) return fail("TEST_BUNDLE_HASH_MISMATCH");
  return { ok: true, value: bundle };
}

export function validateAcceptanceSpec(value: unknown, bundle?: OutcomeTestBundleV1, bundleBytes?: string | Uint8Array): OutcomeValidationResult<AcceptanceSpecV1> {
  const parsed = parseOutcomeDocument(value);
  if (!parsed.ok || parsed.value.document_kind !== "acceptance-spec") return fail("SPEC_INVALID");
  const spec = parsed.value;
  const validOracle = (oracle: unknown): oracle is { id: string; description: string } => object(oracle) && exact(oracle, ["id", "description"]) && [oracle.id, oracle.description].every(nonEmpty);
  const validRequirementShape = (requirement: unknown): requirement is { id: string; behavior: string; oracle_id: string } => object(requirement) && exact(requirement, ["id", "behavior", "oracle_id"]) && [requirement.id, requirement.behavior, requirement.oracle_id].every(nonEmpty);
  const validCaseShape = (item: unknown): item is { id: string; test_id: string; requirement_ids: string[]; oracle_id: string; level: string; command: string; expected: "PASS" | "FAIL" } => object(item) && exact(item, ["id", "test_id", "requirement_ids", "oracle_id", "level", "command", "expected"]) && nonEmpty(item.id) && nonEmpty(item.test_id) && uniqueStrings(item.requirement_ids) && item.requirement_ids.length > 0 && [item.oracle_id, item.level, item.command].every(nonEmpty) && (item.expected === "PASS" || item.expected === "FAIL");
  const keys = ["schema_version", "document_kind", "spec_id", "outcome_id", "generation", "contract", "requirements", "oracles", "cases", "test_bundle"];
  if (!exact(spec, keys) || ![spec.spec_id, spec.outcome_id].every(nonEmpty) || !positiveInteger(spec.generation)
    || !isReference(spec.contract) || !isReference(spec.test_bundle) || !Array.isArray(spec.requirements) || !Array.isArray(spec.oracles) || !Array.isArray(spec.cases)
    || spec.requirements.length === 0 || spec.oracles.length === 0 || spec.cases.length === 0) return fail("SPEC_INVALID");
  if (!spec.oracles.every(validOracle) || !spec.requirements.every(validRequirementShape) || !spec.cases.every(validCaseShape)) return fail("SPEC_INVALID");
  if (!unique(spec.requirements.map((item) => item.id)) || !unique(spec.oracles.map((item) => item.id)) || !unique(spec.cases.map((item) => item.id)) || !unique(spec.cases.map((item) => item.test_id))
    || spec.requirements.some((requirement) => !spec.oracles.some((oracle) => oracle.id === requirement.oracle_id))
    || spec.cases.some((item) => item.requirement_ids.some((id) => !spec.requirements.some((requirement) => requirement.id === id)) || !spec.oracles.some((oracle) => oracle.id === item.oracle_id))
    || spec.requirements.some((requirement) => !spec.cases.some((item) => item.requirement_ids.includes(requirement.id)))
    || !bundle || bundle.bundle_id !== spec.test_bundle.id || bundle.outcome_id !== spec.outcome_id || bundle.generation !== spec.test_bundle.generation || !sameSet(spec.cases.map((item) => item.test_id), bundle.expected_test_ids)
    || !bundleBytes || sha256(bundleBytes) !== spec.test_bundle.sha256) return fail("SPEC_INVALID");
  return { ok: true, value: spec };
}

type AmendmentSubjects = { contract: OutcomeContractV1; contractRef: ArtifactReference; spec: AcceptanceSpecV1; bundle: OutcomeTestBundleV1; specRef: ArtifactReference };
export type AmendmentApprovalContext = { approval: OutcomeApprovalV1; amendmentRef: ArtifactReference };
const entryMap = <T extends { id: string }>(entries: T[]): Map<string, T> => new Map(entries.map((entry) => [entry.id, entry]));
const stable = (value: unknown): string => JSON.stringify(value);
const artifactMap = (bundle: OutcomeTestBundleV1): Map<string, ArtifactHash> => new Map([bundle.tests, bundle.fixtures, bundle.oracle_sources, bundle.runner_config, bundle.lockfiles].flat().map((item) => [item.path, item]));

function expectedFrozenDiff(from: AmendmentSubjects, to: AmendmentSubjects): FrozenDiff {
  const changedIds = <T extends { id: string }>(left: T[], right: T[]): string[] => {
    const all = new Set([...left.map((item) => item.id), ...right.map((item) => item.id)]);
    const leftMap = entryMap(left); const rightMap = entryMap(right);
    return [...all].filter((id) => stable(leftMap.get(id)) !== stable(rightMap.get(id))).sort();
  };
  const oldSources = artifactMap(from.bundle); const newSources = artifactMap(to.bundle);
  const sourcePaths = new Set([...oldSources.keys(), ...newSources.keys()]);
  const sourceChanges = [...sourcePaths].filter((path) => oldSources.get(path)?.sha256 !== newSources.get(path)?.sha256).sort().map((path) => ({
    path, from_sha256: oldSources.get(path)?.sha256 ?? null, to_sha256: newSources.get(path)?.sha256 ?? null,
  }));
  const bundleFields = ["tests", "fixtures", "oracle_sources", "runner_config", "lockfiles", "expected_test_ids", "expected_test_count"] as const;
  const changedBundleFields = bundleFields.filter((field) => stable(from.bundle[field]) !== stable(to.bundle[field]));
  return {
    spec_changed: !sameReference(from.specRef, to.specRef),
    changed_case_ids: changedIds(from.spec.cases, to.spec.cases),
    changed_requirement_ids: changedIds(from.spec.requirements, to.spec.requirements),
    changed_oracle_ids: changedIds(from.spec.oracles, to.spec.oracles),
    test_bundle_changed_fields: changedBundleFields,
    test_bundle_source_changes: sourceChanges,
  };
}

function validFrozenDiff(value: unknown): value is FrozenDiff {
  if (!exact(value, ["spec_changed", "changed_case_ids", "changed_requirement_ids", "changed_oracle_ids", "test_bundle_changed_fields", "test_bundle_source_changes"]) || typeof value.spec_changed !== "boolean") return false;
  const idLists = [value.changed_case_ids, value.changed_requirement_ids, value.changed_oracle_ids, value.test_bundle_changed_fields];
  return idLists.every(uniqueStrings)
    && Array.isArray(value.test_bundle_source_changes) && value.test_bundle_source_changes.every((change) => exact(change, ["path", "from_sha256", "to_sha256"])
      && nonEmpty(change.path) && (change.from_sha256 === null || (nonEmpty(change.from_sha256) && HASH.test(change.from_sha256)))
      && (change.to_sha256 === null || (nonEmpty(change.to_sha256) && HASH.test(change.to_sha256))) && change.from_sha256 !== change.to_sha256);
}

function isWeakening(from: AmendmentSubjects, to: AmendmentSubjects): boolean {
  const next = entryMap(to.spec.cases);
  const fromIds = new Set(from.bundle.expected_test_ids);
  const toIds = new Set(to.bundle.expected_test_ids);
  return from.spec.cases.some((item) => !next.has(item.id) || (item.expected === "PASS" && next.get(item.id)?.expected === "FAIL"))
    || [...fromIds].some((id) => !toIds.has(id));
}

export function validateOutcomeAmendment(value: unknown, from?: AmendmentSubjects, to?: AmendmentSubjects, priorFailures: ArtifactReference[] = [], approvalContext?: AmendmentApprovalContext): OutcomeValidationResult<OutcomeAmendmentV1> {
  const parsed = parseOutcomeDocument(value);
  if (!parsed.ok || parsed.value.document_kind !== "outcome-amendment") return fail("AMENDMENT_INVALID");
  const amendment = parsed.value;
  const keys = ["schema_version", "document_kind", "amendment_id", "outcome_id", "generation", "from_contract", "to_contract", "reason", "affected_case_ids", "unaffected_case_ids", "affected_requirement_ids", "unaffected_requirement_ids", "change_class", "prior_failures", "frozen_diff"];
  const fieldsValid = exact(amendment, keys) && [amendment.amendment_id, amendment.outcome_id, amendment.reason].every(nonEmpty) && positiveInteger(amendment.generation)
    && isReference(amendment.from_contract) && isReference(amendment.to_contract)
    && [amendment.affected_case_ids, amendment.unaffected_case_ids, amendment.affected_requirement_ids, amendment.unaffected_requirement_ids].every(uniqueStrings)
    && unique([...amendment.affected_case_ids, ...amendment.unaffected_case_ids]) && unique([...amendment.affected_requirement_ids, ...amendment.unaffected_requirement_ids])
    && (amendment.change_class === "NORMAL" || amendment.change_class === "WEAKENING") && Array.isArray(amendment.prior_failures)
    && amendment.prior_failures.every(isReference) && unique(amendment.prior_failures.map((item) => `${item.id}:${item.path}:${item.generation}:${item.sha256}`)) && validFrozenDiff(amendment.frozen_diff);
  if (!fieldsValid || !from || !to) return fail("AMENDMENT_INVALID");
  if (amendment.outcome_id !== from.contract.outcome_id || amendment.outcome_id !== to.contract.outcome_id || amendment.generation !== to.contract.generation
    || !sameReference(amendment.from_contract, from.contractRef) || !sameReference(amendment.to_contract, to.contractRef)) return fail("AMENDMENT_BINDING_INVALID");
  if (approvalContext && (approvalContext.approval.outcome_id !== amendment.outcome_id || approvalContext.approval.generation !== amendment.generation
    || !sameReference(approvalContext.approval.contract, amendment.to_contract) || !sameReference(approvalContext.approval.amendment ?? amendment.to_contract, approvalContext.amendmentRef))) return fail("AMENDMENT_APPROVAL_BINDING_INVALID");
  const actualFailureKeys = priorFailures.map((item) => `${item.id}:${item.path}:${item.generation}:${item.sha256}`).sort();
  const statedFailureKeys = amendment.prior_failures.map((item) => `${item.id}:${item.path}:${item.generation}:${item.sha256}`).sort();
  if (!sameSet(actualFailureKeys, statedFailureKeys)) return fail("AMENDMENT_FAILURE_HISTORY_INVALID");
  const expected = expectedFrozenDiff(from, to);
  if (stable(expected) !== stable(amendment.frozen_diff)) return fail("AMENDMENT_FROZEN_DIFF_INVALID");
  const toCaseIds = to.spec.cases.map((item) => item.id); const toRequirementIds = to.spec.requirements.map((item) => item.id);
  if (!sameSet([...amendment.affected_case_ids, ...amendment.unaffected_case_ids], toCaseIds)
    || !sameSet([...amendment.affected_requirement_ids, ...amendment.unaffected_requirement_ids], toRequirementIds)
    || !sameSet(amendment.affected_case_ids, amendment.frozen_diff.changed_case_ids)
    || !sameSet(amendment.affected_requirement_ids, amendment.frozen_diff.changed_requirement_ids)
    || amendment.unaffected_case_ids.some((id) => amendment.frozen_diff.changed_case_ids.includes(id))
    || amendment.unaffected_requirement_ids.some((id) => amendment.frozen_diff.changed_requirement_ids.includes(id))) return fail("AMENDMENT_SCOPE_INVALID");
  const weakening = isWeakening(from, to);
  if ((weakening && amendment.change_class !== "WEAKENING") || (!weakening && amendment.change_class !== "NORMAL")) return fail("AMENDMENT_WEAKENING_INVALID");
  return { ok: true, value: amendment };
}

export function validateOutcomeApproval(value: unknown): OutcomeValidationResult<OutcomeApprovalV1> {
  const parsed = parseOutcomeDocument(value);
  if (!parsed.ok || parsed.value.document_kind !== "outcome-approval") return fail("APPROVAL_INVALID");
  const approval = parsed.value;
  const keys = ["schema_version", "document_kind", "approval_id", "outcome_id", "generation", "contract", "acceptance_spec", "test_bundle", "amendment", "approval", "weakening_approval"];
  if (!exact(approval, keys) || ![approval.approval_id, approval.outcome_id].every(nonEmpty) || !positiveInteger(approval.generation)
    || !isReference(approval.contract) || !isReference(approval.acceptance_spec) || !isReference(approval.test_bundle)
    || approval.contract.generation !== approval.generation || approval.acceptance_spec.generation !== approval.generation || approval.test_bundle.generation !== approval.generation
    || (approval.generation === 1 ? approval.amendment !== null : !isReference(approval.amendment)) || !isApproval(approval.approval)
    || (approval.weakening_approval !== null && (!isApproval(approval.weakening_approval) || approval.weakening_approval.trust_domain === approval.approval.trust_domain))) return fail("APPROVAL_INVALID");
  return { ok: true, value: approval };
}

export function validateOutcomeRunReceipt(value: unknown): OutcomeValidationResult<OutcomeRunReceiptV1> {
  if (!object(value)) return fail("RUN_INVALID");
  const keys = ["schema_version", "document_kind", "run_id", "case_id", "test_id", "execution_id", "contract", "acceptance_spec", "test_bundle", "approval_anchor", "candidate_tree_sha256", "environment_manifest", "environment_hash", "argv", "cwd", "exit_code", "signal", "timed_out", "execution_status", "oracle_observation", "stdout", "stderr", "runner"];
  if (!exact(value, keys)) return fail("RUN_INVALID");
  const runner = value.runner;
  const passProcess = value.execution_status !== "PASS" || (value.exit_code === 0 && value.signal === null && value.timed_out === false);
  if (value.schema_version !== "outcome-run-receipt/v1" || value.document_kind !== "outcome-run-receipt"
    || ![value.run_id, value.case_id, value.test_id, value.execution_id, value.cwd, value.oracle_observation].every(nonEmpty)
    || !isReference(value.contract) || !isReference(value.acceptance_spec) || !isReference(value.test_bundle) || !isReference(value.approval_anchor)
    || !TREE.test(String(value.candidate_tree_sha256)) || !isArtifact(value.environment_manifest) || value.environment_hash !== value.environment_manifest.sha256
    || !uniqueStrings(value.argv) || value.argv.length === 0 || (value.exit_code !== null && !Number.isInteger(value.exit_code))
    || (value.signal !== null && !nonEmpty(value.signal)) || typeof value.timed_out !== "boolean" || !STATUSES.includes(value.execution_status as ExecutionStatus)
    || !isArtifact(value.stdout) || !isArtifact(value.stderr) || !exact(runner, ["principal_id", "trust_domain"])
    || !nonEmpty(runner.principal_id) || !nonEmpty(runner.trust_domain) || !passProcess) return fail("RUN_INVALID");
  return { ok: true, value: value as OutcomeRunReceiptV1 };
}

export function validateOutcomeRunResult(value: unknown): OutcomeValidationResult<OutcomeRunResultV1> {
  const parsed = parseOutcomeDocument(value);
  if (!parsed.ok || parsed.value.document_kind !== "outcome-run-result") return fail("RUN_INVALID");
  const run = parsed.value;
  const validCaseResult = (item: unknown): boolean => object(item) && exact(item, ["case_id", "test_id", "execution_id", "execution_status", "oracle_observation", "receipt"])
    && [item.case_id, item.test_id, item.execution_id, item.oracle_observation].every(nonEmpty) && STATUSES.includes(item.execution_status as ExecutionStatus) && isArtifact(item.receipt);
  const keys = ["schema_version", "document_kind", "run_id", "outcome_contract", "acceptance_spec", "test_bundle", "approval_anchor", "candidate_tree_sha256", "environment_hash", "code_revision", "environment", "environment_manifest", "inventory", "case_results", "verdict"];
  if (!exact(run, keys) || ![run.run_id, run.code_revision, run.environment].every(nonEmpty) || !isReference(run.outcome_contract) || !isReference(run.acceptance_spec)
    || !isReference(run.test_bundle) || !isReference(run.approval_anchor) || !TREE.test(run.candidate_tree_sha256) || !HASH.test(run.environment_hash)
    || !isArtifact(run.environment_manifest) || run.environment_hash !== run.environment_manifest.sha256 || !exact(run.inventory, ["discovered_test_ids", "executed_test_ids", "skipped_test_ids", "filtered_test_ids"])
    || !Object.values(run.inventory).every(uniqueStrings) || !Array.isArray(run.case_results) || !run.case_results.every(validCaseResult)) return fail("RUN_INVALID");
  if (!unique(run.case_results.map((item) => item.case_id)) || !unique(run.case_results.map((item) => item.test_id)) || !unique(run.case_results.map((item) => item.execution_id)) || !STATUSES.includes(run.verdict)) return fail("RUN_INVALID");
  return { ok: true, value: run };
}

export function validateOutcomeLedger(events: unknown[]): OutcomeValidationResult<OutcomeLedgerEventV1[]> {
  const values: OutcomeLedgerEventV1[] = [];
  for (const value of events) {
    if (!object(value)) return fail("LEDGER_INVALID");
    const keys = ["schema_version", "document_kind", "event_id", "sequence", "recorded_at", "outcome_id", "event_type", "approval_anchor", "contract_ref", "amendment_ref", "run_ref", "previous_event"];
    if (!exact(value, keys) || value.schema_version !== OUTCOME_SCHEMA_VERSION || value.document_kind !== "outcome-ledger-event"
      || ![value.event_id, value.recorded_at, value.outcome_id].every(nonEmpty) || !positiveInteger(value.sequence)
      || !["CONTRACT_APPROVED", "CONTRACT_SUPERSEDED", "OUTCOME_RETIRED", "RUN_RECORDED"].includes(String(value.event_type))
      || !isReference(value.approval_anchor) || !isReference(value.contract_ref) || (value.amendment_ref !== null && !isReference(value.amendment_ref))
      || (value.run_ref !== null && !isReference(value.run_ref)) || (value.previous_event !== null && !isReference(value.previous_event))) return fail("LEDGER_INVALID");
    const amendmentRequired = value.event_type === "CONTRACT_SUPERSEDED";
    const runRequired = value.event_type === "RUN_RECORDED";
    if ((value.amendment_ref !== null) !== amendmentRequired || (value.run_ref !== null) !== runRequired) return fail("LEDGER_EVENT_REFERENCE_INVALID");
    values.push(value as OutcomeLedgerEventV1);
  }
  const ordered = [...values].sort((left, right) => left.sequence - right.sequence);
  if (ordered.length === 0 || !unique(ordered.map((event) => event.event_id)) || new Set(ordered.map((event) => event.outcome_id)).size !== 1) return fail("LEDGER_INVALID");
  let head: ArtifactReference | null = null;
  let retired = false;
  for (const [index, event] of ordered.entries()) {
    const previous = ordered[index - 1];
    if (event.sequence !== index + 1 || (index === 0 ? event.previous_event !== null || event.event_type !== "CONTRACT_APPROVED" : !event.previous_event || !sameReference(event.previous_event, { ...previous, id: previous.event_id, path: event.previous_event.path, generation: previous.sequence, sha256: event.previous_event.sha256 }))) return fail("LEDGER_CHAIN_INVALID");
    if (retired) return fail("LEDGER_TERMINAL_TRANSITION");
    if (event.event_type === "CONTRACT_APPROVED") { if (index !== 0) return fail("LEDGER_TRANSITION_INVALID"); head = event.contract_ref; continue; }
    if (!head) return fail("LEDGER_TRANSITION_INVALID");
    if (event.event_type === "RUN_RECORDED" && !sameReference(event.contract_ref, head)) return fail("LEDGER_HEAD_INVALID");
    if (event.event_type === "CONTRACT_SUPERSEDED") { if (sameReference(event.contract_ref, head)) return fail("LEDGER_HEAD_INVALID"); head = event.contract_ref; }
    if (event.event_type === "OUTCOME_RETIRED") { if (!sameReference(event.contract_ref, head)) return fail("LEDGER_HEAD_INVALID"); retired = true; }
  }
  return { ok: true, value: ordered };
}

export function deriveLifecycle(events: OutcomeLedgerEventV1[]): "ACTIVE" | "RETIRED" {
  return events.at(-1)?.event_type === "OUTCOME_RETIRED" ? "RETIRED" : "ACTIVE";
}

export function deriveCurrentContractHead(events: OutcomeLedgerEventV1[]): ArtifactReference | null {
  return deriveLifecycle(events) === "RETIRED" ? null : events.at(-1)?.contract_ref ?? null;
}
