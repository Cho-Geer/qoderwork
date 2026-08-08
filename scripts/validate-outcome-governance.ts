#!/usr/bin/env bun
/** Read-only structural validator. It is review-separated, never an admission decision. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import {
  deriveCurrentContractHead, deriveLifecycle, parseOutcomeDocument, sameReference,
  validateAcceptanceSpec, validateOutcomeAmendment, validateOutcomeApproval, validateOutcomeContract,
  validateOutcomeLedger, validateOutcomeRunReceipt, validateOutcomeRunResult, validateTestBundle,
  type ArtifactHash, type ArtifactReference, type OutcomeApprovalV1, type OutcomeContractV1,
  type OutcomeDocumentV1, type OutcomeLedgerEventV1, type OutcomeRunResultV1, type OutcomeTestBundleV1,
} from "./lib/outcome-governance-v1.ts";

export type OutcomeCliResult = { ok: boolean; mode: "structural"; validation_kind: "review-separated"; lifecycle: "ACTIVE" | "RETIRED" | "INVALID"; errors: string[] };
type Item = { path: string; bytes: Buffer; doc: OutcomeDocumentV1 };
const sha = (bytes: string | Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const bad = (...errors: string[]): OutcomeCliResult => ({ ok: false, mode: "structural", validation_kind: "review-separated", lifecycle: "INVALID", errors: [...new Set(errors)].sort() });
const uniqueStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0) && new Set(value).size === value.length;
const sameSet = (left: string[], right: string[]): boolean => uniqueStrings(left) && uniqueStrings(right)
  && left.length === right.length && left.every((item) => right.includes(item));
const auxiliaryRunArtifact = (path: string): boolean => /^runs[\/\\](?:receipt|env|out|err)(?:[-.][\/\\]?|[\/\\])/.test(path);

function safeBelow(root: string, path: string): string | null {
  if (!path || isAbsolute(path) || path.includes("\0")) return null;
  try { const target = realpathSync(resolve(root, path)); const suffix = relative(root, target); return suffix && suffix !== ".." && !suffix.startsWith("../") ? target : null; } catch { return null; }
}
function jsonFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (directory: string): void => { for (const entry of readdirSync(directory, { withFileTypes: true })) { const path = resolve(directory, entry.name); if (entry.isDirectory()) walk(path); else if (entry.isFile() && entry.name.endsWith(".json")) found.push(path); } };
  walk(root); return found.sort();
}
function artifact(root: string, value: ArtifactHash, errors: string[], label: string): Buffer | null {
  const path = safeBelow(root, value.path);
  try {
    if (!path || !statSync(path).isFile()) { errors.push(`${label}_MISSING_OR_ESCAPE:${value.path}`); return null; }
    const bytes = readFileSync(path); if (sha(bytes) !== value.sha256) errors.push(`${label}_HASH_MISMATCH:${value.path}`); return bytes;
  } catch { errors.push(`${label}_MISSING_OR_ESCAPE:${value.path}`); return null; }
}
function documentIdentity(item: Item): { id: string; generation: number; outcomeId: string | undefined } | null {
  const doc = item.doc as Record<string, unknown>;
  const idKey = item.doc.document_kind === "outcome-contract" ? "contract_id"
    : item.doc.document_kind === "acceptance-spec" ? "spec_id"
    : item.doc.document_kind === "outcome-test-bundle" ? "bundle_id"
    : item.doc.document_kind === "outcome-amendment" ? "amendment_id"
    : item.doc.document_kind === "outcome-approval" ? "approval_id"
    : item.doc.document_kind === "outcome-run-result" ? "run_id"
    : item.doc.document_kind === "outcome-ledger-event" ? "event_id" : null;
  const generation = item.doc.document_kind === "outcome-ledger-event" ? doc.sequence : item.doc.document_kind === "outcome-run-result" ? (doc.outcome_contract as Record<string, unknown> | undefined)?.generation : doc.generation;
  const outcomeId = item.doc.document_kind === "outcome-run-result" ? undefined : doc.outcome_id;
  return typeof idKey === "string" && typeof doc[idKey] === "string" && typeof generation === "number" && Number.isInteger(generation) && (outcomeId === undefined || typeof outcomeId === "string")
    ? { id: doc[idKey], generation, outcomeId } : null;
}
function itemReference(item: Item): ArtifactReference | null {
  const identity = documentIdentity(item);
  return identity ? { id: identity.id, path: item.path, generation: identity.generation, sha256: sha(item.bytes) } : null;
}
function documentReference(index: Map<string, Item>, root: string, reference: ArtifactReference, errors: string[], expectedKind: OutcomeDocumentV1["document_kind"], outcomeId: string | undefined, label: string): Item | null {
  const absolute = safeBelow(root, reference.path);
  if (!absolute) { errors.push(`REFERENCE_ESCAPE_OR_MISSING:${reference.path}`); return null; }
  const item = index.get(relative(root, absolute).split("\\").join("/"));
  if (!item) { errors.push(`REFERENCE_MISSING:${reference.path}`); return null; }
  if (sha(item.bytes) !== reference.sha256) errors.push(`REFERENCE_HASH_MISMATCH:${reference.path}`);
  const identity = documentIdentity(item);
  if (item.doc.document_kind !== expectedKind || !identity || identity.id !== reference.id || identity.generation !== reference.generation || (outcomeId !== undefined && identity.outcomeId !== undefined && identity.outcomeId !== outcomeId)) errors.push(`REFERENCE_IDENTITY_MISMATCH:${label}`);
  return item;
}
function resultReference(item: Item): ArtifactReference | null {
  if (item.doc.document_kind !== "outcome-run-result") return null;
  return { id: item.doc.run_id, path: item.path, generation: item.doc.outcome_contract.generation, sha256: sha(item.bytes) };
}
function deriveRunVerdict(run: OutcomeRunResultV1, spec: { cases: Array<{ id: string; expected: "PASS" | "FAIL" }> }): OutcomeRunResultV1["verdict"] {
  if (run.case_results.some((result) => result.execution_status === "INVALID")) return "INVALID";
  if (run.case_results.some((result) => result.execution_status === "BLOCKED")) return "BLOCKED";
  if (run.case_results.some((result) => result.execution_status === "NOT_RUN")) return "NOT_RUN";
  return run.case_results.every((result) => spec.cases.find((item) => item.id === result.case_id)?.expected === result.execution_status) ? "PASS" : "FAIL";
}
function amendmentSubjects(index: Map<string, Item>, root: string, contractRef: ArtifactReference, outcomeId: string, errors: string[]) {
  const contractItem = documentReference(index, root, contractRef, errors, "outcome-contract", outcomeId, "amendment.contract");
  if (!contractItem || contractItem.doc.document_kind !== "outcome-contract") return undefined;
  const specItem = index.get(contractItem.doc.acceptance_spec.path);
  if (!specItem || specItem.doc.document_kind !== "acceptance-spec") return undefined;
  const bundleItem = documentReference(index, root, specItem.doc.test_bundle, errors, "outcome-test-bundle", outcomeId, "amendment.bundle");
  if (!bundleItem || bundleItem.doc.document_kind !== "outcome-test-bundle") return undefined;
  return { contract: contractItem.doc, contractRef: { id: contractItem.doc.contract_id, path: contractItem.path, generation: contractItem.doc.generation, sha256: sha(contractItem.bytes) }, spec: specItem.doc, bundle: bundleItem.doc, specRef: { id: specItem.doc.spec_id, path: specItem.path, generation: specItem.doc.generation, sha256: sha(specItem.bytes) } };
}
function validateAmendments(index: Map<string, Item>, root: string, ledger: OutcomeLedgerEventV1[], errors: string[]): void {
  const supersedeEvents = new Map<string, OutcomeLedgerEventV1>();
  let currentHead: ArtifactReference | null = null;
  for (const event of ledger) {
    if (event.event_type === "CONTRACT_APPROVED") currentHead = event.contract_ref;
    if (event.event_type !== "CONTRACT_SUPERSEDED") continue;
    const amendmentKey = `${event.amendment_ref!.id}:${event.amendment_ref!.path}:${event.amendment_ref!.generation}:${event.amendment_ref!.sha256}`;
    if (!currentHead || supersedeEvents.has(amendmentKey)) errors.push(`AMENDMENT_LEDGER_HEAD_INVALID:${event.event_id}`);
    supersedeEvents.set(amendmentKey, event);
    currentHead = event.contract_ref;
  }
  for (const item of index.values()) {
    if (item.doc.document_kind !== "outcome-amendment") continue;
    const amendment = item.doc;
    const ownRef = { id: amendment.amendment_id, path: item.path, generation: amendment.generation, sha256: sha(item.bytes) };
    const event = supersedeEvents.get(`${ownRef.id}:${ownRef.path}:${ownRef.generation}:${ownRef.sha256}`);
    if (!event) { errors.push(`AMENDMENT_LEDGER_EVENT_MISSING:${amendment.amendment_id}`); continue; }
    const earlier = ledger.find((candidate) => candidate.sequence === event.sequence - 1);
    if (!earlier || !sameReference(amendment.from_contract, earlier.contract_ref) || !sameReference(amendment.to_contract, event.contract_ref)) {
      errors.push(`AMENDMENT_LEDGER_HEAD_INVALID:${amendment.amendment_id}`);
      continue;
    }
    const approval = documentReference(index, root, event.approval_anchor, errors, "outcome-approval", amendment.outcome_id, "amendment.approval");
    const failures = [...index.values()].filter((candidate) => {
      if (candidate.doc.document_kind !== "outcome-run-result" || candidate.doc.verdict !== "FAIL" || !validateOutcomeRunResult(candidate.doc).ok || !sameReference(candidate.doc.outcome_contract, amendment.from_contract)) return false;
      const reference = resultReference(candidate);
      return reference !== null && ledger.some((entry) => entry.sequence < event.sequence && entry.event_type === "RUN_RECORDED" && entry.run_ref !== null && sameReference(entry.run_ref, reference) && sameReference(entry.contract_ref, amendment.from_contract));
    }).map(resultReference).filter((value): value is ArtifactReference => value !== null);
    const from = amendmentSubjects(index, root, amendment.from_contract, amendment.outcome_id, errors);
    const to = amendmentSubjects(index, root, amendment.to_contract, amendment.outcome_id, errors);
    const validated = validateOutcomeAmendment(amendment, from, to, failures, approval?.doc.document_kind === "outcome-approval" ? { approval: approval.doc, amendmentRef: ownRef } : undefined);
    if (!validated.ok) errors.push(...validated.errors.map((error) => `AMENDMENT:${amendment.amendment_id}:${error}`));
    if (!approval || approval.doc.document_kind !== "outcome-approval" || !sameReference(approval.doc.contract, amendment.to_contract) || !sameReference(approval.doc.amendment ?? amendment.to_contract, ownRef)) errors.push(`AMENDMENT_APPROVAL_ANCHOR_INVALID:${amendment.amendment_id}`);
  }
}
function validateApproval(item: Item, index: Map<string, Item>, root: string, errors: string[]): void {
  const approval = item.doc as OutcomeApprovalV1;
  const contract = documentReference(index, root, approval.contract, errors, "outcome-contract", approval.outcome_id, "approval.contract");
  const spec = documentReference(index, root, approval.acceptance_spec, errors, "acceptance-spec", approval.outcome_id, "approval.spec");
  const bundle = documentReference(index, root, approval.test_bundle, errors, "outcome-test-bundle", approval.outcome_id, "approval.bundle");
  const amendment = approval.amendment ? documentReference(index, root, approval.amendment, errors, "outcome-amendment", approval.outcome_id, "approval.amendment") : null;
  const parsed = validateOutcomeApproval(approval);
  if (!parsed.ok) errors.push(...parsed.errors.map((error) => `APPROVAL:${approval.approval_id}:${error}`));
  if (!contract || contract.doc.document_kind !== "outcome-contract" || !spec || spec.doc.document_kind !== "acceptance-spec" || !bundle || bundle.doc.document_kind !== "outcome-test-bundle"
    || contract.doc.outcome_id !== approval.outcome_id || spec.doc.outcome_id !== approval.outcome_id || bundle.doc.outcome_id !== approval.outcome_id
    || spec.doc.contract.id !== approval.contract.id || spec.doc.test_bundle.id !== approval.test_bundle.id) errors.push(`APPROVAL_BINDING_INVALID:${approval.approval_id}`);
  if (approval.generation > 1 && !amendment) errors.push(`APPROVAL_AMENDMENT_BINDING_INVALID:${approval.approval_id}`);
  if (amendment) {
    if (amendment.doc.document_kind !== "outcome-amendment" || !sameReference(amendment.doc.to_contract, approval.contract)
      || (amendment.doc.change_class === "WEAKENING" && (!approval.weakening_approval || approval.weakening_approval.trust_domain === approval.approval.trust_domain))) errors.push(`APPROVAL_AMENDMENT_BINDING_INVALID:${approval.approval_id}`);
  }
}
function validateReceipt(root: string, run: OutcomeRunResultV1, result: OutcomeRunResultV1["case_results"][number], errors: string[]): void {
  const receiptBytes = artifact(root, result.receipt, errors, "RECEIPT");
  if (!receiptBytes) return;
  let raw: unknown; try { raw = JSON.parse(receiptBytes.toString("utf8")); } catch { errors.push(`RECEIPT_JSON_INVALID:${result.receipt.path}`); return; }
  const receipt = validateOutcomeRunReceipt(raw);
  if (!receipt.ok) { errors.push(`RECEIPT_BINDING_MISMATCH:${result.case_id}`); return; }
  const values = receipt.value;
  if (values.run_id !== run.run_id || values.case_id !== result.case_id || values.test_id !== result.test_id || values.execution_id !== result.execution_id
    || values.execution_status !== result.execution_status || values.oracle_observation !== result.oracle_observation || !sameReference(values.contract, run.outcome_contract)
    || !sameReference(values.acceptance_spec, run.acceptance_spec) || !sameReference(values.test_bundle, run.test_bundle)
    || !sameReference(values.approval_anchor, run.approval_anchor) || values.candidate_tree_sha256 !== run.candidate_tree_sha256 || values.environment_hash !== run.environment_hash) { errors.push(`RECEIPT_BINDING_MISMATCH:${result.case_id}`); return; }
  artifact(root, values.environment_manifest, errors, "RECEIPT_ENVIRONMENT");
  artifact(root, values.stdout, errors, "RECEIPT_STDOUT");
  artifact(root, values.stderr, errors, "RECEIPT_STDERR");
}
function validateRun(item: Item, index: Map<string, Item>, root: string, gitTree: string, ledger: OutcomeLedgerEventV1[] | undefined, errors: string[]): void {
  const run = item.doc as OutcomeRunResultV1;
  const contract = documentReference(index, root, run.outcome_contract, errors, "outcome-contract", undefined, "run.contract");
  const outcomeId = contract?.doc.document_kind === "outcome-contract" ? contract.doc.outcome_id : undefined;
  const spec = documentReference(index, root, run.acceptance_spec, errors, "acceptance-spec", outcomeId, "run.spec");
  const bundle = documentReference(index, root, run.test_bundle, errors, "outcome-test-bundle", outcomeId, "run.bundle");
  const approval = documentReference(index, root, run.approval_anchor, errors, "outcome-approval", outcomeId, "run.approval");
  const parsed = validateOutcomeRunResult(run);
  if (!parsed.ok) errors.push(...parsed.errors.map((error) => `RUN:${run.run_id}:${error}`));
  artifact(root, run.environment_manifest, errors, "ENV_MANIFEST");
  const ownRef = resultReference(item);
  const event = ownRef && ledger?.find((candidate) => candidate.event_type === "RUN_RECORDED" && candidate.run_ref !== null && sameReference(candidate.run_ref, ownRef));
  if (!contract || contract.doc.document_kind !== "outcome-contract" || !spec || spec.doc.document_kind !== "acceptance-spec" || !bundle || bundle.doc.document_kind !== "outcome-test-bundle" || !approval || approval.doc.document_kind !== "outcome-approval"
    || !event || !sameReference(event.contract_ref, run.outcome_contract) || !sameReference(event.approval_anchor, run.approval_anchor) || !sameReference(approval.doc.contract, run.outcome_contract) || !sameReference(approval.doc.acceptance_spec, run.acceptance_spec) || !sameReference(approval.doc.test_bundle, run.test_bundle)) errors.push(`RUN_APPROVAL_OR_LEDGER_BINDING_INVALID:${run.run_id}`);
  const expectedTests = bundle?.doc.document_kind === "outcome-test-bundle" ? bundle.doc.expected_test_ids : [];
  const expectedCases = spec?.doc.document_kind === "acceptance-spec" ? spec.doc.cases.map((caseItem) => caseItem.id) : [];
  const acceptedSpec = spec?.doc.document_kind === "acceptance-spec" ? spec.doc : undefined;
  if (!sameSet(run.case_results.map((result) => result.test_id), expectedTests) || !sameSet(run.case_results.map((result) => result.case_id), expectedCases)
    || !sameSet(run.inventory.discovered_test_ids, expectedTests) || !sameSet(run.inventory.executed_test_ids, expectedTests)
    || run.inventory.skipped_test_ids.length !== 0 || run.inventory.filtered_test_ids.length !== 0 || !acceptedSpec || run.case_results.some((result) => acceptedSpec.cases.find((candidate) => candidate.id === result.case_id)?.test_id !== result.test_id) || run.verdict !== deriveRunVerdict(run, acceptedSpec)) errors.push(`RUN_INVENTORY_OR_VERDICT_INVALID:${run.run_id}`);
  const runContractBaseline = contract?.doc.document_kind === "outcome-contract" ? contract.doc.baseline.baseline_tree_sha256 : undefined;
  const expectedTree = runContractBaseline ?? gitTree;
  if (run.candidate_tree_sha256 !== expectedTree) errors.push(`RUN_GIT_TREE_MISMATCH:${run.run_id}`);
  for (const result of run.case_results) validateReceipt(root, run, result, errors);
}
function validateLedgerReferences(events: OutcomeLedgerEventV1[], index: Map<string, Item>, root: string, errors: string[]): void {
  for (const [position, event] of events.entries()) {
    const approval = documentReference(index, root, event.approval_anchor, errors, "outcome-approval", event.outcome_id, "ledger.approval");
    const contract = documentReference(index, root, event.contract_ref, errors, "outcome-contract", event.outcome_id, "ledger.contract");
    const amendment = event.amendment_ref ? documentReference(index, root, event.amendment_ref, errors, "outcome-amendment", event.outcome_id, "ledger.amendment") : null;
    const run = event.run_ref ? documentReference(index, root, event.run_ref, errors, "outcome-run-result", event.outcome_id, "ledger.run") : null;
    const previous = event.previous_event ? documentReference(index, root, event.previous_event, errors, "outcome-ledger-event", event.outcome_id, "ledger.previous") : null;
    if (!approval || approval.doc.document_kind !== "outcome-approval" || !contract || contract.doc.document_kind !== "outcome-contract" || contract.doc.outcome_id !== event.outcome_id
      || !sameReference(approval.doc.contract, event.contract_ref) || (amendment && amendment.doc.document_kind !== "outcome-amendment") || (run && run.doc.document_kind !== "outcome-run-result")
      || (previous && previous.doc.document_kind !== "outcome-ledger-event")) errors.push(`LEDGER_REFERENCE_KIND_OR_OUTCOME_INVALID:${event.event_id}`);
    if (position > 0) {
      const previousItem = [...index.values()].find((candidate) => candidate.doc.document_kind === "outcome-ledger-event" && candidate.doc.event_id === events[position - 1]!.event_id && candidate.doc.sequence === events[position - 1]!.sequence);
      const actualPrevious = previousItem ? itemReference(previousItem) : null;
      if (!actualPrevious || !event.previous_event || !sameReference(event.previous_event, actualPrevious)) errors.push(`LEDGER_PREDECESSOR_RAW_REFERENCE_INVALID:${event.event_id}`);
    }
    if (event.event_type === "CONTRACT_SUPERSEDED") {
      const prior = events[position - 1];
      const priorApproval = prior ? documentReference(index, root, prior.approval_anchor, errors, "outcome-approval", event.outcome_id, "ledger.predecessor-approval") : null;
      if (!prior || !priorApproval || priorApproval.doc.document_kind !== "outcome-approval" || !approval || approval.doc.document_kind !== "outcome-approval" || !amendment || amendment.doc.document_kind !== "outcome-amendment" || !contract || contract.doc.document_kind !== "outcome-contract"
        || sameReference(event.approval_anchor, prior.approval_anchor) || !sameReference(priorApproval.doc.contract, prior.contract_ref) || !sameReference(approval.doc.contract, event.contract_ref) || !sameReference(approval.doc.amendment ?? event.amendment_ref!, event.amendment_ref!)
        || !sameReference(contract.doc.supersedes ?? event.contract_ref, prior.contract_ref) || !sameReference(amendment.doc.from_contract, prior.contract_ref)
        || !sameReference(amendment.doc.to_contract, event.contract_ref)) errors.push(`LEDGER_SUPERSESSION_BINDING_INVALID:${event.event_id}`);
    }
    if (event.event_type === "RUN_RECORDED" && run?.doc.document_kind === "outcome-run-result") {
      const runContract = documentReference(index, root, run.doc.outcome_contract, errors, "outcome-contract", event.outcome_id, "ledger.run.contract");
      if (!runContract || !sameReference(run.doc.outcome_contract, event.contract_ref) || !sameReference(run.doc.approval_anchor, event.approval_anchor)) errors.push(`LEDGER_RUN_BINDING_INVALID:${event.event_id}`);
    }
  }
}

export function validateOutcomeDirectory(outcomeDirectory: string, repositoryRoot: string): OutcomeCliResult {
  try {
    if (!existsSync(outcomeDirectory) || !existsSync(repositoryRoot) || !statSync(outcomeDirectory).isDirectory() || !statSync(repositoryRoot).isDirectory()) return bad("ROOT_MISSING");
    const root = realpathSync(outcomeDirectory); const repository = realpathSync(repositoryRoot);
    const gitTree = execFileSync("git", ["-C", repository, "rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
    if (!/^[a-f0-9]{40,64}$/i.test(gitTree)) return bad("GIT_TREE_INVALID");
    const errors: string[] = []; const index = new Map<string, Item>();
    for (const absolute of jsonFiles(root)) {
      const bytes = readFileSync(absolute); const path = relative(root, absolute).split("\\").join("/"); let raw: unknown;
      try { raw = JSON.parse(bytes.toString("utf8")); } catch { errors.push(`JSON_INVALID:${path}`); continue; }
      const parsed = parseOutcomeDocument(raw);
      if (!parsed.ok) { if (!auxiliaryRunArtifact(path)) errors.push(`DOCUMENT_INVALID:${path}`); continue; }
      index.set(path, { path, bytes, doc: parsed.value });
    }
    for (const item of index.values()) if (item.doc.document_kind === "outcome-contract") { const contract = item.doc; const result = validateOutcomeContract(contract); if (!result.ok) errors.push(...result.errors.map((error) => `CONTRACT:${contract.contract_id}:${error}`)); }
    for (const item of index.values()) if (item.doc.document_kind === "acceptance-spec") {
      const spec = item.doc; const contract = documentReference(index, root, spec.contract, errors, "outcome-contract", spec.outcome_id, "spec.contract"); const bundle = documentReference(index, root, spec.test_bundle, errors, "outcome-test-bundle", spec.outcome_id, "spec.bundle");
      const result = validateAcceptanceSpec(spec, bundle?.doc.document_kind === "outcome-test-bundle" ? bundle.doc : undefined, bundle?.bytes);
      if (!result.ok) errors.push(...result.errors.map((error) => `SPEC:${spec.spec_id}:${error}`));
      if (!contract || contract.doc.document_kind !== "outcome-contract" || contract.doc.outcome_id !== spec.outcome_id || contract.doc.acceptance_spec.id !== spec.spec_id || contract.doc.acceptance_spec.path !== item.path || contract.doc.acceptance_spec.generation !== spec.generation) errors.push(`SPEC_CONTRACT_BINDING_MISMATCH:${spec.spec_id}`);
    }
    for (const item of index.values()) if (item.doc.document_kind === "outcome-approval") validateApproval(item, index, root, errors);
    const ledgerItems = [...index.values()].filter((item) => item.doc.document_kind === "outcome-ledger-event");
    const ledger = validateOutcomeLedger(ledgerItems.map((item) => item.doc));
    if (!ledger.ok) errors.push(...ledger.errors); else validateLedgerReferences(ledger.value, index, root, errors);
    if (ledger.ok) validateAmendments(index, root, ledger.value, errors);
    const activeBundleId = ledger.ok ? (() => {
      const currentHead = deriveCurrentContractHead(ledger.value);
      if (!currentHead) return undefined;
      const contractItem = documentReference(index, root, currentHead, errors, "outcome-contract", undefined, "head.contract");
      if (!contractItem || contractItem.doc.document_kind !== "outcome-contract") return undefined;
      const specItem = index.get(contractItem.doc.acceptance_spec.path.split("\\").join("/"));
      if (!specItem || specItem.doc.document_kind !== "acceptance-spec" || specItem.doc.spec_id !== contractItem.doc.acceptance_spec.id || specItem.doc.generation !== contractItem.doc.acceptance_spec.generation) return undefined;
      return specItem.doc.test_bundle.id;
    })() : undefined;
    for (const item of index.values()) if (item.doc.document_kind === "outcome-test-bundle" && ledger.ok && activeBundleId !== undefined && item.doc.bundle_id === activeBundleId) {
      const bundle = item.doc as OutcomeTestBundleV1; const sources: Record<string, Buffer> = {};
      for (const source of [bundle.tests, bundle.fixtures, bundle.oracle_sources, bundle.runner_config, bundle.lockfiles].flat()) { const bytes = artifact(repository, source, errors, "SOURCE"); if (bytes) sources[source.path] = bytes; }
      const result = validateTestBundle(bundle, sources); if (!result.ok) errors.push(...result.errors.map((error) => `BUNDLE:${bundle.bundle_id}:${error}`));
    }
    for (const item of index.values()) if (item.doc.document_kind === "outcome-run-result") validateRun(item, index, root, gitTree, ledger.ok ? ledger.value : undefined, errors);
    return errors.length > 0 ? bad(...errors) : { ok: true, mode: "structural", validation_kind: "review-separated", lifecycle: ledger.ok ? deriveLifecycle(ledger.value) : "INVALID", errors: [] };
  } catch { return bad("OUTCOME_TREE_UNREADABLE"); }
}
if (import.meta.main) {
  const [directory, flag, repository] = process.argv.slice(2);
  if (!directory || flag !== "--repository-root" || !repository || process.argv.length !== 5) { console.log(JSON.stringify(bad("USAGE"))); process.exit(2); }
  const result = validateOutcomeDirectory(directory, repository); console.log(JSON.stringify(result)); process.exit(result.ok ? 0 : 1);
}
