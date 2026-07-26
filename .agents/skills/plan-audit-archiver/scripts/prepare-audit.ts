#!/usr/bin/env bun
// prepare-audit.ts — v2.1 审计报告合同生成器
//
// 用途: 从 scope-lock、EV receipts、pre-change/verdict-state receipts 自动生成
//       byte-exact 的 AUDIT_CONTRACT JSON + 21-section 报告骨架。
//       编辑性字段输出为 REPLACE_* 占位符，由审计者手动填写后再过 validate-audit.ts。
//
// 设计原则: 只复制 receipt 字节 + 确定性 join，不伪造证据。
//           byte-match 保证依赖 JSON.parse 保持 key order + rest-spread 剥离。
//
// 用法:
//   bun run prepare-audit.ts \
//     --workspace-root /abs/path \
//     --scope-lock audits/<plan>/scope-lock.json \
//     --pre-change audits/<plan>/evidence/pre-change-<PHASE>.json \
//     --verdict-state audits/<plan>/evidence/verdict-state-<PHASE>.json \
//     --evidence-dir audits/<plan>/evidence \
//     --output audits/<plan>/<YYYY-MM-DD>-audit.md \
//     [--verdict ACCEPT|REWORK|BLOCKED|INVALID] \
//     [--evidence-ceiling component] \
//     [--supplemental path=logs/x.md,role=CLAIM]
//
// 退出码:
//   0 = 生成成功
//   1 = 参数错误或输入不一致

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

// ─── 类型定义 ───

type JsonObject = Record<string, unknown>;

export type LoadedReceipt = {
  absPath: string;
  relPath: string;
  sha256: string;
  parsed: JsonObject;
};

type StateReceipt = {
  head: string;
  repository_realpath: string;
  captured_at: string;
  status_entries: Array<{ path: string; status: string }>;
  scope_lock_sha256: string;
  phase_id: string;
};

type ContractOptions = {
  workspaceRoot: string;
  scopeLock: JsonObject;
  scopeLockRelPath: string;
  scopeLockSha256: string;
  preChange: StateReceipt;
  preChangeRelPath: string;
  preChangeSha256: string;
  verdictState: StateReceipt;
  verdictStateRelPath: string;
  verdictStateSha256: string;
  receipts: LoadedReceipt[];
  verdict: string;
  evidenceCeiling: string;
  supplementalSources: Array<{ path: string; sha256: string; role: string }>;
  boundaryMatrix?: { path: string; sha256: string };
  boundaryPrecheckInputs?: { scope_lock_sha256: string; contract_sha256: string };
  boundaryContractVersion?: string;
};

// ─── 工具函数 ───

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  return value;
}

function requiredArgument(name: string): string {
  const value = argument(name);
  if (value === undefined || value.trim().length === 0) fail(`missing required argument ${name}`);
  return value.trim();
}

function optionalArgument(name: string): string | undefined {
  const value = argument(name);
  if (value === undefined) return undefined;
  if (value.trim().length === 0) return undefined;
  return value.trim();
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function sha256String(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function readJson(filePath: string): JsonObject {
  const content = readFileSync(filePath, "utf8");
  const parsed: unknown = JSON.parse(content);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    fail(`${filePath} is not a JSON object`);
  }
  return parsed as JsonObject;
}

// ─── 核心纯函数 ───

/**
 * 构建 ledger entry：byte-exact 复制 receipt 字段（剥离 schema_version/audit_id/generation），
 * 前置 path + sha256。依赖 JSON.parse 保持 key order + rest-spread 保证字节一致。
 */
export function buildLedgerEntry(receipt: LoadedReceipt): JsonObject {
  const { schema_version: _sv, audit_id: _ai, generation: _gen, ...rest } = receipt.parsed;
  return { path: receipt.relPath, sha256: receipt.sha256, ...rest };
}

/**
 * 从 scope-lock 提取 scope 段（verbatim copy）。
 */
export function extractScope(scopeLock: JsonObject): JsonObject {
  const scope = scopeLock.scope;
  if (typeof scope !== "object" || scope === null || Array.isArray(scope)) {
    fail("scope-lock missing scope object");
  }
  const s = scope as JsonObject;
  return {
    status: s.status,
    provenance_level: s.provenance_level,
    frozen_at: s.frozen_at,
    in_scope: s.in_scope,
    out_of_scope: s.out_of_scope,
    assumptions: s.assumptions,
    exit_criteria: s.exit_criteria,
  };
}

/**
 * 从 scope-lock requirements 构建 contract requirements（含 control join）。
 */
export function buildRequirements(
  scopeLock: JsonObject,
  receiptsByControl: Map<string, { POSITIVE?: LoadedReceipt; NEGATIVE?: LoadedReceipt }>,
): JsonObject[] {
  const requirements = Array.isArray(scopeLock.requirements) ? scopeLock.requirements : [];
  return requirements.map((raw) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw as JsonObject;
    const req = raw as JsonObject;
    const id = String(req.id ?? "");
    const kind = String(req.kind ?? "BEHAVIORAL");
    const controls = receiptsByControl.get(id) ?? {};

    const pos = controls.POSITIVE;
    const neg = controls.NEGATIVE;

    const positiveControl: JsonObject = pos
      ? { command: pos.parsed.command, expected: "PASS", observed: pos.parsed.observed, evidence: pos.parsed.id }
      : { command: "REPLACE_POSITIVE_COMMAND", expected: "PASS", observed: "REPLACE_POSITIVE_OBSERVED", evidence: "REPLACE_POSITIVE_EV" };

    let negativeControl: JsonObject;
    if (kind === "STATIC") {
      negativeControl = { applicability: "NOT_APPLICABLE_STATIC", method: "N/A", command: "N/A", expected: "N/A", observed: "N/A", evidence: "N/A" };
    } else if (neg) {
      negativeControl = { applicability: "REQUIRED", method: "REPLACE_NEGATIVE_METHOD", command: neg.parsed.command, expected: "FAIL", observed: neg.parsed.observed, evidence: neg.parsed.id };
    } else {
      negativeControl = { applicability: "REQUIRED", method: "REPLACE_NEGATIVE_METHOD", command: "REPLACE_NEGATIVE_COMMAND", expected: "FAIL", observed: "REPLACE_NEGATIVE_OBSERVED", evidence: "REPLACE_NEGATIVE_EV" };
    }

    // 推导 status
    let status: string;
    if (kind === "STATIC") {
      status = pos && pos.parsed.observed === "PASS" ? "PASS" : "REPLACE_STATUS";
    } else if (pos && neg) {
      const posOk = pos.parsed.observed === "PASS";
      const negOk = neg.parsed.observed === "FAIL";
      status = posOk && negOk ? "PASS" : posOk ? "REPLACE_STATUS" : "FAIL";
    } else {
      status = "REPLACE_STATUS";
    }

    return {
      id: req.id,
      plan_item_id: req.plan_item_id,
      kind: req.kind,
      source: req.source,
      behavior: req.behavior,
      required_evidence_level: req.required_evidence_level,
      oracle_id: req.oracle_id,
      oracle: req.oracle,
      positive_control: positiveControl,
      negative_control: negativeControl,
      status,
    };
  });
}

/**
 * 组装完整 contract JSON。
 */
export function buildAuditContract(opts: ContractOptions): JsonObject {
  const { scopeLock, receipts, preChange, verdictState } = opts;

  // 从 receipts 派生 audit_id / generation
  let auditId = "REPLACE_AUDIT_ID";
  let generation = 1;
  if (receipts.length > 0) {
    const first = receipts[0].parsed;
    auditId = String(first.audit_id ?? auditId);
    generation = Number(first.generation ?? 1);
  }

  // 按 requirement_id + polarity 索引 receipts
  const receiptsByControl = new Map<string, { POSITIVE?: LoadedReceipt; NEGATIVE?: LoadedReceipt }>();
  for (const receipt of receipts) {
    const reqId = String(receipt.parsed.requirement_id ?? "");
    const polarity = String(receipt.parsed.polarity ?? "");
    if (!reqId) continue;
    const entry = receiptsByControl.get(reqId) ?? {};
    if (polarity === "POSITIVE") entry.POSITIVE = receipt;
    else if (polarity === "NEGATIVE") entry.NEGATIVE = receipt;
    receiptsByControl.set(reqId, entry);
  }

  const scope = extractScope(scopeLock);
  const inScope = Array.isArray(scope.in_scope) ? scope.in_scope : [];
  const requirements = buildRequirements(scopeLock, receiptsByControl);
  const evidenceReceipts = receipts.map(buildLedgerEntry);

  const dirtyPaths = verdictState.status_entries.map((entry) => entry.path);
  const repoBasename = basename(preChange.repository_realpath);
  const dirtySurface = dirtyPaths.length === 0 ? `${repoBasename} clean` : `${dirtyPaths.length} dirty path(s)`;

  return {
    schema_version: "2.1",
    audit_id: auditId,
    generation,
    previous_audit: null,
    scope_lock: {
      path: opts.scopeLockRelPath,
      sha256: opts.scopeLockSha256,
      lock_id: scopeLock.lock_id,
    },
    baseline: {
      implementation_base_commit: preChange.head,
      commit: verdictState.head,
      head_at_verdict: verdictState.head,
      workspace_root: opts.workspaceRoot,
      repository_root: preChange.repository_realpath,
      dirty_surface: dirtySurface,
      dirty_paths: dirtyPaths,
      pre_change_receipt: { path: opts.preChangeRelPath, sha256: opts.preChangeSha256 },
      verdict_state_receipt: { path: opts.verdictStateRelPath, sha256: opts.verdictStateSha256 },
      plan_sources: scopeLock.plan_sources,
      supplemental_sources: opts.supplementalSources,
    },
    scope,
    requirements,
    evidence_receipts: evidenceReceipts,
    audit_boundary_matrix: opts.boundaryMatrix ?? null,
    boundary_precheck_inputs: opts.boundaryPrecheckInputs ?? null,
    boundary_contract_version: opts.boundaryContractVersion,
    model_review: opts.boundaryContractVersion === "boundary-contract/v1" ? { approved_boundary: "REPLACE_MODEL_APPROVED_BOUNDARY", observed_equivalence: "REPLACE_MODEL_OBSERVED_EQUIVALENCE", exceptions: "REPLACE_MODEL_EXCEPTIONS", classification: "REPLACE_MODEL_VERDICT" } : undefined,
    sweep: {
      status: "COMPLETE",
      requirement_ids: inScope,
      files_inspected: ["REPLACE_EXACT_FILE"],
      commands: ["REPLACE_COMMAND"],
      completed_at: new Date().toISOString(),
    },
    findings: [],
    rework_package: { status: "NONE", finding_ids: [], items: [] },
    reopen_records: [],
    inherited_blockers: [],
    downgrade_declaration: (scope.provenance_level === "v2.1-required" && opts.evidenceCeiling === "component")
      ? { reason: "REPLACE_DOWNGRADE_REASON", ceiling: opts.evidenceCeiling, unaffected_scope: "REPLACE_UNAFFECTED_SCOPE", affected_scope: "REPLACE_AFFECTED_SCOPE" }
      : null,
    unclassified_findings: 0,
    evidence_ceiling: opts.evidenceCeiling,
    verdict: opts.verdict,
    blocker_reason: null,
    invalid_reason: null,
  };
}

/**
 * 生成完整 21-section 报告 markdown。
 */
export function buildReportMarkdown(contract: JsonObject): string {
  const auditId = String(contract.audit_id ?? "");
  const baseline = contract.baseline as JsonObject;
  const commit = String(baseline?.commit ?? "");
  const scopeLock = contract.scope_lock as JsonObject;
  const scope = contract.scope as JsonObject;
  const requirements = Array.isArray(contract.requirements) ? contract.requirements as JsonObject[] : [];
  const evidenceReceipts = Array.isArray(contract.evidence_receipts) ? contract.evidence_receipts as JsonObject[] : [];
  const verdict = String(contract.verdict ?? "REPLACE_VERDICT");
  const preChangeReceipt = baseline?.pre_change_receipt as JsonObject | undefined;
  const verdictStateReceipt = baseline?.verdict_state_receipt as JsonObject | undefined;
  const planSources = Array.isArray(baseline?.plan_sources) ? baseline.plan_sources as JsonObject[] : [];
  const supplementalSources = Array.isArray(baseline?.supplemental_sources) ? baseline.supplemental_sources as JsonObject[] : [];
  const inScope = Array.isArray(scope?.in_scope) ? scope.in_scope as string[] : [];
  const outOfScope = Array.isArray(scope?.out_of_scope) ? scope.out_of_scope as string[] : [];
  const assumptions = Array.isArray(scope?.assumptions) ? scope.assumptions as JsonObject[] : [];
  const exitCriteria = Array.isArray(scope?.exit_criteria) ? scope.exit_criteria as string[] : [];

  const contractJson = JSON.stringify(contract, null, 2);

  const lines: string[] = [];
  lines.push(`# Audit Report: ${auditId}`);
  lines.push("");

  // Section 0
  lines.push("## 0. Machine-Readable Audit Contract");
  lines.push("");
  lines.push("<!-- AUDIT_CONTRACT_START -->");
  lines.push("```json");
  lines.push(contractJson);
  lines.push("```");
  lines.push("<!-- AUDIT_CONTRACT_END -->");
  lines.push("");

  // Section 1
  lines.push("## 1. Audit Identity and Source Ledger");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|---|---|");
  lines.push(`| audit_id | ${auditId} |`);
  lines.push(`| baseline.commit | ${commit} |`);
  lines.push(`| scope_lock | ${String(scopeLock?.path ?? "")} (sha256: ${String(scopeLock?.sha256 ?? "").slice(0, 12)}...) |`);
  lines.push(`| pre_change_receipt | ${String(preChangeReceipt?.path ?? "")} (sha256: ${String(preChangeReceipt?.sha256 ?? "").slice(0, 12)}...) |`);
  lines.push(`| verdict_state_receipt | ${String(verdictStateReceipt?.path ?? "")} (sha256: ${String(verdictStateReceipt?.sha256 ?? "").slice(0, 12)}...) |`);
  for (const ps of planSources) {
    lines.push(`| plan_source | ${String(ps.path ?? "")} (sha256: ${String(ps.sha256 ?? "").slice(0, 12)}...) |`);
  }
  for (const ss of supplementalSources) {
    lines.push(`| supplemental (${String(ss.role ?? "")}) | ${String(ss.path ?? "")} (sha256: ${String(ss.sha256 ?? "").slice(0, 12)}...) |`);
  }
  lines.push(`| evidence_ceiling | ${String(contract.evidence_ceiling ?? "")} |`);
  lines.push("");

  // Section 2
  lines.push("## 2. Frozen Scope and Exit Contract");
  lines.push("");
  lines.push("### 2.1 IN-SCOPE");
  lines.push("");
  lines.push("| REQ | Behavior | Source |");
  lines.push("|---|---|---|");
  for (const req of requirements) {
    lines.push(`| ${String(req.id ?? "")} | ${String(req.behavior ?? "").slice(0, 60)} | ${String(req.source ?? "")} |`);
  }
  lines.push("");
  lines.push("### 2.2 OUT-OF-SCOPE");
  lines.push("");
  lines.push("| Item | Why excluded | Destination |");
  lines.push("|---|---|---|");
  for (const item of outOfScope) {
    lines.push(`| ${String(item)} | REPLACE_EXCLUSION_REASON | REPLACE_DESTINATION |`);
  }
  lines.push("");
  lines.push("### 2.3 Assumptions and disproof");
  lines.push("");
  lines.push("| Assumption | Disproof | Observed result |");
  lines.push("|---|---|---|");
  for (const a of assumptions) {
    lines.push(`| ${String(a.statement ?? "")} | ${String(a.disproof ?? "")} | REPLACE_OBSERVED_RESULT |`);
  }
  lines.push("");
  lines.push("### 2.4 Deterministic exit criteria");
  lines.push("");
  for (const ec of exitCriteria) {
    lines.push(`- ${String(ec)}`);
  }
  lines.push("");

  // Section 3
  lines.push("## 3. Requirement, Oracle, and Falsification Matrix");
  lines.push("");
  lines.push("| REQ | Kind | Oracle | Positive (obs/EV) | Negative (obs/EV) | Level | Status |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const req of requirements) {
    const pos = req.positive_control as JsonObject | undefined;
    const neg = req.negative_control as JsonObject | undefined;
    lines.push(`| ${String(req.id ?? "")} | ${String(req.kind ?? "")} | ${String(req.oracle_id ?? "")} | ${String(pos?.observed ?? "")}/${String(pos?.evidence ?? "")} | ${String(neg?.observed ?? "")}/${String(neg?.evidence ?? "")} | ${String(req.required_evidence_level ?? "")} | ${String(req.status ?? "")} |`);
  }
  lines.push("");

  // Section 4
  lines.push("## 4. Full In-Scope Sweep");
  lines.push("");
  lines.push("| REQ | Symbols/paths inspected | Commands | Result |");
  lines.push("|---|---|---|---|");
  for (const id of inScope) {
    lines.push(`| ${String(id)} | REPLACE_SYMBOLS_INSPECTED | REPLACE_SWEEP_COMMAND | REPLACE_RESULT |`);
  }
  lines.push("");
  lines.push(`Sweep requirement set {${inScope.join(", ")}} equals frozen in_scope set. Sweep status: COMPLETE.`);
  lines.push("");

  // Section 5
  lines.push("## 5. Classified Findings");
  lines.push("");
  lines.push("### 5.1 BLOCKING");
  lines.push("");
  lines.push("NONE");
  lines.push("");
  lines.push("### 5.2 NON_BLOCKING_DEBT");
  lines.push("");
  lines.push("NONE");
  lines.push("");
  lines.push("### 5.3 OUT_OF_SCOPE");
  lines.push("");
  lines.push("NONE");
  lines.push("");
  lines.push("### 5.4 UNVERIFIED");
  lines.push("");
  lines.push("NONE");
  lines.push("");

  // Section 6
  lines.push("## 6. Falsification Evidence");
  lines.push("");
  lines.push("| REQ | Positive command | Positive result | Negative method | Negative result | Sensitivity |");
  lines.push("|---|---|---|---|---|---|");
  for (const req of requirements) {
    const pos = req.positive_control as JsonObject | undefined;
    const neg = req.negative_control as JsonObject | undefined;
    const sensitive = neg && neg.observed === "FAIL" ? "SENSITIVE" : "REPLACE_SENSITIVITY";
    lines.push(`| ${String(req.id ?? "")} | ${String(pos?.command ?? "").slice(0, 50)} | ${String(pos?.observed ?? "")} (${String(pos?.evidence ?? "")}) | ${String(neg?.method ?? "")} | ${String(neg?.observed ?? "")} (${String(neg?.evidence ?? "")}) | ${sensitive} |`);
  }
  lines.push("");

  // Section 7
  lines.push("## 7. Frozen Rework Package");
  lines.push("");
  lines.push("NONE (verdict is not REWORK)");
  lines.push("");

  // Section 8
  lines.push("## 8. Reopen Records");
  lines.push("");
  lines.push("NONE");
  lines.push("");

  // Section 9
  lines.push("## 9. Closure Matrix");
  lines.push("");
  lines.push("| REQ | Status | Blocking findings | Positive proof | Negative sensitivity | Exit gate |");
  lines.push("|---|---|---|---|---|---|");
  for (const req of requirements) {
    const pos = req.positive_control as JsonObject | undefined;
    const neg = req.negative_control as JsonObject | undefined;
    lines.push(`| ${String(req.id ?? "")} | ${String(req.status ?? "")} | none | ${String(pos?.evidence ?? "")} | ${String(neg?.evidence ?? "")} | CLOSED |`);
  }
  lines.push("");

  // Section 10
  lines.push("## 10. Verdict");
  lines.push("");
  lines.push(`**Verdict**: \`${verdict}\``);
  lines.push("");
  lines.push(`Audit ${auditId} covers ${requirements.length} requirement(s): ${requirements.map((r) => String(r.id ?? "")).join(", ")}. ` +
    `Baseline commit: ${commit}. ` +
    `Evidence ceiling: ${String(contract.evidence_ceiling ?? "")}. ` +
    `REPLACE_VERDICT_PROSE`);
  lines.push("");

  // Section 11
  lines.push("## 11. Validator Evidence");
  lines.push("");
  lines.push("## MODEL_REVIEW");
  lines.push("");
  lines.push("- Approved boundary correctly expressed: REPLACE_MODEL_BOUNDARY_EXPRESSION");
  lines.push("- Observed boundary equals approved boundary: REPLACE_MODEL_BOUNDARY_EQUIVALENCE");
  lines.push("- Exceptions are in scope: REPLACE_MODEL_EXCEPTION_REVIEW");
  lines.push("- Model classification: REPLACE_MODEL_VERDICT");
  lines.push("");
  lines.push("```");
  lines.push("bun run .agents/skills/plan-audit-archiver/scripts/validate-audit.ts REPLACE_THIS_FILE_PATH");
  lines.push("REPLACE_VALIDATOR_OUTPUT");
  lines.push("```");
  lines.push("");

  // Section 12
  lines.push("## 12. Anti-Loop Answers");
  lines.push("");
  lines.push("1. All in-scope requirements satisfied? REPLACE_ANSWER_1");
  lines.push(`2. Negative control EV ids: ${requirements.map((r) => String((r.negative_control as JsonObject | undefined)?.evidence ?? "")).filter((e) => e.startsWith("EV-")).join(", ") || "REPLACE_NEGATIVE_EVS"}`);
  lines.push("3. Rework package status: NONE");
  lines.push("4. Exit criteria changed since freeze? No (frozen_at preserved)");
  lines.push("5. Open findings count: 0");
  lines.push("6. Exit condition met: REPLACE_ANSWER_6");
  lines.push("7. Validator result: REPLACE_VALIDATOR_RESULT");
  lines.push("");

  return lines.join("\n");
}

// ─── 加载函数 ───

export function loadStateReceipt(absPath: string, relPath: string): { state: StateReceipt; sha256: string } {
  const parsed = readJson(absPath);
  const sha256 = sha256File(absPath);
  const statusEntries = Array.isArray(parsed.status_entries)
    ? (parsed.status_entries as JsonObject[]).map((entry) => ({ path: String(entry.path ?? ""), status: String(entry.status ?? "") }))
    : [];
  return {
    state: {
      head: String(parsed.head ?? ""),
      repository_realpath: String(parsed.repository_realpath ?? ""),
      captured_at: String(parsed.captured_at ?? ""),
      status_entries: statusEntries,
      scope_lock_sha256: String(parsed.scope_lock_sha256 ?? ""),
      phase_id: String(parsed.phase_id ?? ""),
    },
    sha256,
  };
}

export function loadEvidenceReceipts(evidenceDir: string, workspaceRoot: string, filterAuditId?: string, filterPrefix?: string): LoadedReceipt[] {
  const absDir = resolve(workspaceRoot, evidenceDir);
  if (!existsSync(absDir) || !statSync(absDir).isDirectory()) {
    fail(`evidence-dir does not exist or is not a directory: ${absDir}`);
  }
  const files = readdirSync(absDir).filter((name) => name.endsWith(".json")).sort();
  const receipts: LoadedReceipt[] = [];
  for (const name of files) {
    // 跳过 pre-change 和 verdict-state receipts
    if (name.startsWith("pre-change-") || name.startsWith("verdict-state-")) continue;
    // 按文件名前缀过滤（如果指定）
    if (filterPrefix && !name.startsWith(filterPrefix)) continue;
    const absPath = join(absDir, name);
    let parsed: JsonObject;
    try {
      parsed = readJson(absPath);
    } catch {
      continue; // 非 JSON 或解析失败，跳过
    }
    // 只接受有 EV-NNN id 的 receipt
    const id = String(parsed.id ?? "");
    if (!/^EV-\d{3}$/.test(id)) continue;
    // 按 audit_id 过滤（如果指定）
    if (filterAuditId && String(parsed.audit_id ?? "") !== filterAuditId) continue;
    const relPath = relative(workspaceRoot, absPath);
    receipts.push({ absPath, relPath, sha256: sha256File(absPath), parsed });
  }
  // 按 id 排序保证确定性
  receipts.sort((a, b) => String(a.parsed.id ?? "").localeCompare(String(b.parsed.id ?? "")));
  return receipts;
}

// ─── CLI 入口 ───

function main() {
  const workspaceRootArg = requiredArgument("--workspace-root");
  const scopeLockArg = requiredArgument("--scope-lock");
  const preChangeArg = requiredArgument("--pre-change");
  const verdictStateArg = requiredArgument("--verdict-state");
  const evidenceDirArg = requiredArgument("--evidence-dir");
  const outputArg = requiredArgument("--output");
  const verdictArg = optionalArgument("--verdict") ?? "REPLACE_VERDICT";
  const evidenceCeilingArg = optionalArgument("--evidence-ceiling") ?? "REPLACE_EVIDENCE_CEILING";
  const supplementalArg = optionalArgument("--supplemental");
  const auditIdFilter = optionalArgument("--audit-id");
  const receiptPrefix = optionalArgument("--receipt-prefix");
  const boundaryMatrixArg = optionalArgument("--boundary-matrix");
  const boundaryContractVersionArg = optionalArgument("--boundary-contract-version");
  if (boundaryContractVersionArg && boundaryContractVersionArg !== "boundary-contract/v1") fail("--boundary-contract-version must be boundary-contract/v1");

  // 验证 workspace root
  if (!isAbsolute(workspaceRootArg)) fail("--workspace-root must be absolute");
  if (!existsSync(workspaceRootArg) || !statSync(workspaceRootArg).isDirectory()) fail(`--workspace-root does not exist: ${workspaceRootArg}`);
  const workspaceRoot = realpathSync(workspaceRootArg);

  // 验证 verdict
  const validVerdicts = new Set(["ACCEPT", "REWORK", "BLOCKED", "INVALID", "REPLACE_VERDICT"]);
  if (!validVerdicts.has(verdictArg)) fail(`--verdict must be one of ACCEPT|REWORK|BLOCKED|INVALID, got: ${verdictArg}`);

  // 解析路径（支持相对路径，相对于 workspace root）
  const resolvePath = (p: string): string => {
    const abs = isAbsolute(p) ? p : resolve(workspaceRoot, p);
    if (!existsSync(abs)) fail(`file does not exist: ${abs}`);
    return realpathSync(abs);
  };

  const scopeLockAbs = resolvePath(scopeLockArg);
  const preChangeAbs = resolvePath(preChangeArg);
  const verdictStateAbs = resolvePath(verdictStateArg);
  const outputAbs = isAbsolute(outputArg) ? outputArg : resolve(workspaceRoot, outputArg);

  // 验证 output 在 workspace 内且不存在
  const outputRel = relative(workspaceRoot, outputAbs);
  if (outputRel.startsWith("..") || isAbsolute(outputRel)) fail("--output must be inside workspace-root");
  if (existsSync(outputAbs)) fail(`--output already exists (wx protection): ${outputAbs}`);

  // 验证所有路径在 workspace 内
  const toRel = (abs: string, label: string): string => {
    const rel = relative(workspaceRoot, abs);
    if (rel.startsWith("..") || isAbsolute(rel)) fail(`${label} is outside workspace-root: ${abs}`);
    return rel;
  };
  const boundaryMatrix = boundaryMatrixArg ? (() => { const abs = resolvePath(boundaryMatrixArg); return { path: toRel(abs, "--boundary-matrix"), sha256: sha256File(abs) }; })() : undefined;
  const boundaryPrecheckInputs = boundaryMatrixArg ? (() => { const matrix = readJson(resolvePath(boundaryMatrixArg)); return { scope_lock_sha256: String(matrix.scope_lock_sha256 ?? ""), contract_sha256: String(matrix.contract_sha256 ?? "") }; })() : undefined;

  const scopeLockRelPath = toRel(scopeLockAbs, "--scope-lock");
  const preChangeRelPath = toRel(preChangeAbs, "--pre-change");
  const verdictStateRelPath = toRel(verdictStateAbs, "--verdict-state");

  // 加载输入
  const scopeLock = readJson(scopeLockAbs);
  const scopeLockSha256 = sha256File(scopeLockAbs);

  const { state: preChange, sha256: preChangeSha256 } = loadStateReceipt(preChangeAbs, preChangeRelPath);
  const { state: verdictState, sha256: verdictStateSha256 } = loadStateReceipt(verdictStateAbs, verdictStateRelPath);

  const receipts = loadEvidenceReceipts(evidenceDirArg, workspaceRoot, auditIdFilter, receiptPrefix);

  // 验证 receipt 一致性
  if (receipts.length > 0) {
    const auditIds = new Set(receipts.map((r) => String(r.parsed.audit_id ?? "")));
    const generations = new Set(receipts.map((r) => String(r.parsed.generation ?? "")));
    if (auditIds.size > 1) fail(`inconsistent audit_id across receipts: ${[...auditIds].join(", ")}`);
    if (generations.size > 1) fail(`inconsistent generation across receipts: ${[...generations].join(", ")}`);
  }

  // 解析 supplemental sources
  const supplementalSources: Array<{ path: string; sha256: string; role: string }> = [];
  if (supplementalArg) {
    for (const part of supplementalArg.split(";")) {
      const fields: Record<string, string> = {};
      for (const kv of part.split(",")) {
        const eqIndex = kv.indexOf("=");
        if (eqIndex > 0) fields[kv.slice(0, eqIndex).trim()] = kv.slice(eqIndex + 1).trim();
      }
      if (!fields.path || !fields.role) fail(`--supplemental entry needs path= and role=: ${part}`);
      const suppAbs = resolvePath(fields.path);
      const suppRel = toRel(suppAbs, "--supplemental path");
      supplementalSources.push({ path: suppRel, sha256: sha256File(suppAbs), role: fields.role });
    }
  }

  // 组装 contract
  const contract = buildAuditContract({
    workspaceRoot,
    scopeLock,
    scopeLockRelPath,
    scopeLockSha256,
    preChange,
    preChangeRelPath,
    preChangeSha256,
    verdictState,
    verdictStateRelPath,
    verdictStateSha256,
    receipts,
    verdict: verdictArg,
    evidenceCeiling: evidenceCeilingArg,
    supplementalSources,
    boundaryMatrix,
    boundaryPrecheckInputs,
    boundaryContractVersion: boundaryContractVersionArg,
  });

  // 生成报告
  const markdown = buildReportMarkdown(contract);

  // 写入（wx 保护）
  mkdirSync(dirname(outputAbs), { recursive: true });
  writeFileSync(outputAbs, markdown, { encoding: "utf8", flag: "wx" });

  // 完整性检查
  if (!existsSync(outputAbs) || !statSync(outputAbs).isFile() || statSync(outputAbs).size === 0) {
    fail("output file write failed integrity check");
  }
  // 验证 contract block 可解析
  const written = readFileSync(outputAbs, "utf8");
  const contractMatch = written.match(/<!-- AUDIT_CONTRACT_START -->\s*```json\n([\s\S]*?)\n```\s*<!-- AUDIT_CONTRACT_END -->/);
  if (!contractMatch) fail("output file missing parseable AUDIT_CONTRACT block");
  JSON.parse(contractMatch[1]); // 抛异常则 fail

  // 统计 REPLACE_ 数量
  const replaceCount = (written.match(/\bREPLACE_[A-Z0-9_]+\b/g) ?? []).length;

  console.log(JSON.stringify({
    output_path: outputRel,
    output_sha256: sha256String(written),
    audit_id: String(contract.audit_id ?? ""),
    generation: contract.generation,
    requirements: Array.isArray(contract.requirements) ? (contract.requirements as unknown[]).length : 0,
    evidence_receipts: receipts.length,
    replace_count: replaceCount,
  }));
}

if (import.meta.main) main();
