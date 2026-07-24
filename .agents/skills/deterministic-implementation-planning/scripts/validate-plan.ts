#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import {
  deriveTopLevelStatus,
  isProgressionSchema,
  isProgressionStatus,
  parseManifest,
  parseProgressionStatus,
  validateManifestRows,
} from "./phase-progression.ts";

type Finding = { code: string; message: string };
type Metrics = { unicodeChars: number; lines: number; phases: number; checkboxes: number };

const LIMITS = {
  single: { unicodeChars: 20_000, lines: 450, phases: 2 },
  index: { unicodeChars: 8_000, lines: 160 },
  phase: { unicodeChars: 14_000, lines: 320, requirements: 10, files: 8, checks: 12 },
  final: { unicodeChars: 8_000, lines: 160 },
  planSetPhases: 8,
} as const;

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("usage: bun run validate-plan.ts <plan-file-or-directory>");
  process.exit(2);
}

const errors: Finding[] = [];
const warnings: Finding[] = [];

function finding(target: Finding[], code: string, message: string) {
  target.push({ code, message });
}

function read(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    throw new Error(`cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function metrics(source: string): Metrics {
  return {
    unicodeChars: [...source].length,
    lines: source.split(/\r?\n/).length,
    phases: (source.match(/^### Phase\s+[^\n]+$/gm) ?? []).length,
    checkboxes: (source.match(/- \[ \]/g) ?? []).length,
  };
}

function enforceBudget(
  source: string,
  label: string,
  limits: { unicodeChars: number; lines: number },
  errorCode: string,
) {
  const value = metrics(source);
  if (value.unicodeChars > limits.unicodeChars || value.lines > limits.lines) {
    finding(
      errors,
      errorCode,
      `${label}: chars=${value.unicodeChars}/${limits.unicodeChars}, lines=${value.lines}/${limits.lines}`,
    );
    return;
  }
  if (value.unicodeChars >= limits.unicodeChars * 0.8 || value.lines >= limits.lines * 0.8) {
    finding(
      warnings,
      "PLAN_LENGTH_WARNING",
      `${label}: chars=${value.unicodeChars}/${limits.unicodeChars}, lines=${value.lines}/${limits.lines}`,
    );
  }
}

function requireTokens(source: string, tokens: string[], code: string, label: string) {
  for (const token of tokens) {
    if (!source.includes(token)) finding(errors, code, `${label}: ${token}`);
  }
}

function checkUnresolvedAndAmbiguous(source: string, label: string) {
  const patterns: Array<[string, RegExp]> = [
    ["UNRESOLVED_TBD", /\bTBD\b/gi],
    ["UNRESOLVED_TODO", /\bTODO\b/gi],
    ["UNRESOLVED_CHINESE", /待定|二选一/g],
    ["OPTION_BRANCH", /方案\s*[A-ZＡ-Ｚ]|推荐方案|可选方案/g],
    ["PLACEHOLDER", /<[^>\n]+>/g],
    ["VAGUE_ALL", /所有相关|全部相关|all relevant/gi],
    ["VAGUE_DISCRETION", /视情况|酌情|适当处理|必要时|if convenient|as appropriate/gi],
    ["WEAK_RECOMMENDATION", /可以考虑|建议选择|recommended option/gi],
  ];
  for (const [code, pattern] of patterns) {
    const matches = source.match(pattern) ?? [];
    if (matches.length > 0) {
      finding(errors, code, `${label}: ${matches.length} occurrence(s): ${[...new Set(matches)].slice(0, 5).join(", ")}`);
    }
  }
}

function countTableRows(source: string, heading: string): number {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) return 0;
  const tableLines: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,4}\s/.test(line)) break;
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) tableLines.push(trimmed);
  }
  const data = tableLines.filter((line) => !/^\|[\s:|-]+\|$/.test(line));
  return Math.max(0, data.length - 1);
}

function checkPhaseComplexity(source: string, label: string, headings: { requirements: string; files: string; checks: string }) {
  const counts = {
    requirements: countTableRows(source, headings.requirements),
    files: countTableRows(source, headings.files),
    checks: countTableRows(source, headings.checks),
  };
  for (const [kind, count] of Object.entries(counts)) {
    const limit = LIMITS.phase[kind as keyof typeof counts];
    if (count > limit) finding(errors, "PHASE_COMPLEXITY_EXCEEDED", `${label}: ${kind}=${count}/${limit}`);
  }
}

function checkEvidenceContracts(source: string, label: string) {
  if (!source.includes("failedChecks") && !source.includes("Exact failure result")) {
    finding(errors, "NO_DIAGNOSTIC_CONTRACT", `${label}: no explicit failure diagnostic contract found`);
  }
  const hasNegativeClaim = /negative|absence|isolation|不存在|不得存在|隔离/i.test(source);
  if (hasNegativeClaim && !["FOUND", "NOT_FOUND", "UNAVAILABLE"].every((token) => source.includes(token))) {
    finding(errors, "NEGATIVE_THREE_STATE_MISSING", `${label}: negative claims require FOUND / NOT_FOUND / UNAVAILABLE`);
  }
  if (!/component|integration|runtime-smoke|live-E2E/.test(source)) {
    finding(errors, "NO_EVIDENCE_LEVEL", `${label}: no explicit evidence level found`);
  }
  if (!source.includes("cd ")) finding(errors, "COMMAND_CWD_MISSING", `${label}: verification commands must specify cwd`);
  if (!source.includes("- [ ]")) finding(errors, "NO_COMPLETION_CHECKBOX", `${label}: completion gate requires unchecked boxes`);
}

const singleTopLevel = [
  "## 1. Input contract and source ledger",
  "## 2. Decisions, scope, and non-goals",
  "## 3. Verified current baseline",
  "## 4. End-to-end traceability",
  "## 5. File change inventory",
  "## 6. Phase-by-phase implementation",
  "## 7. Global verification and evidence",
  "## 8. Risks, failure convergence, and rollback",
  "## 9. Final completion gate",
];

const globalTokens = [
  "**Status**:",
  "**Only implementation path**:",
  "**Evidence ceiling**:",
  "### Decision ledger",
  "### Non-goals",
  "### Open/blocking items",
  "### Negative evidence semantics",
  "### Current versus historical evidence",
  "### Globally forbidden changes",
  "### Evidence preservation",
  "### Evidence ceiling rule",
  "| Requirement | Source | File/symbol | Check name | Evidence source | Happy fixture | Single mutation | Test ID | Level |",
];

const singlePhaseTokens = [
  "#### Goal",
  "#### Starting state and dependency",
  "#### Local requirements",
  "#### Allowed files",
  "#### Forbidden files and behaviors",
  "#### Fixed contract",
  "#### Implementation steps",
  "#### Check Registry",
  "#### All-pass Fixture",
  "#### Single-failure Matrix",
  "#### Fixed verification",
  "#### Rollback/failure convergence",
  "#### Phase completion gate",
];

function validateSingle(path: string) {
  const source = read(path);
  enforceBudget(source, basename(path), LIMITS.single, "PLAN_SPLIT_REQUIRED");
  requireTokens(source, ["**Plan mode**: `SINGLE_FILE`", ...singleTopLevel, ...globalTokens], "MISSING_GLOBAL_CONTRACT", basename(path));
  for (let index = 1; index < singleTopLevel.length; index += 1) {
    const previous = source.indexOf(singleTopLevel[index - 1]);
    const current = source.indexOf(singleTopLevel[index]);
    if (previous >= 0 && current >= 0 && current < previous) finding(errors, "SECTION_ORDER", singleTopLevel[index]);
  }

  const matches = [...source.matchAll(/^### Phase\s+[^\n]+$/gm)];
  if (matches.length === 0) finding(errors, "NO_PHASE", "at least one ### Phase section is required");
  if (matches.length > LIMITS.single.phases) {
    finding(errors, "PLAN_SPLIT_REQUIRED", `phases=${matches.length}/${LIMITS.single.phases}`);
  }
  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index ?? 0;
    const end = matches[index + 1]?.index ?? source.indexOf("## 7. Global verification", start);
    const phase = source.slice(start, end > start ? end : source.length);
    const name = matches[index][0];
    if (!/\[(ANALYSIS|VERIFICATION|OBSERVATION)(\s*→\s*(ANALYSIS|VERIFICATION|OBSERVATION))*\]/.test(name)) {
      finding(errors, "PHASE_TYPE_MISSING", name);
    }
    requireTokens(phase, singlePhaseTokens, "PHASE_CONTRACT_MISSING", name);
    enforceBudget(phase, name, LIMITS.phase, "PHASE_LENGTH_EXCEEDED");
    checkPhaseComplexity(phase, name, {
      requirements: "#### Local requirements",
      files: "#### Allowed files",
      checks: "#### Check Registry",
    });
  }
  checkUnresolvedAndAmbiguous(source, basename(path));
  checkEvidenceContracts(source, basename(path));
  return metrics(source);
}

function validatePlanSet(directory: string) {
  const indexPath = join(directory, "00-plan-index.md");
  const finalPath = join(directory, "99-final-verification.md");
  if (!existsSync(indexPath)) finding(errors, "MISSING_PLAN_INDEX", "00-plan-index.md");
  if (!existsSync(finalPath)) finding(errors, "MISSING_FINAL_VERIFICATION", "99-final-verification.md");
  if (!existsSync(indexPath) || !existsSync(finalPath)) {
    return { index: null, phases: {}, final: null };
  }
  const indexSource = read(indexPath);
  const finalSource = read(finalPath);
  enforceBudget(indexSource, "00-plan-index.md", LIMITS.index, "PLAN_INDEX_LENGTH_EXCEEDED");
  enforceBudget(finalSource, "99-final-verification.md", LIMITS.final, "FINAL_VERIFICATION_LENGTH_EXCEEDED");
  requireTokens(indexSource, [
    "**Plan mode**: `PLAN_SET`",
    "**Status**:",
    "**Only implementation path**:",
    "**Evidence ceiling**:",
    "## 1. Input contract and source ledger",
    "## 2. Decisions, scope, and non-goals",
    "## 3. Verified current baseline",
    "## 4. End-to-end traceability",
    "## 5. File change inventory",
    "## 6. Phase manifest",
  ], "MISSING_PLAN_SET_INDEX_CONTRACT", "00-plan-index.md");
  requireTokens(finalSource, [
    "## 7. Global verification and evidence",
    "## 8. Risks, failure convergence, and rollback",
    "## 9. Final completion gate",
  ], "MISSING_FINAL_CONTRACT", "99-final-verification.md");

  const progressionEnabled = isProgressionSchema(indexSource);
  const parsedManifest = parseManifest(indexSource);
  const manifest = parsedManifest.rows;
  if (manifest.length === 0) finding(errors, "EMPTY_PHASE_MANIFEST", "00-plan-index.md has no phase rows");
  if (manifest.length > LIMITS.planSetPhases) {
    finding(errors, "PLAN_SET_TOO_MANY_PHASES", `phases=${manifest.length}/${LIMITS.planSetPhases}`);
  }
  if (progressionEnabled) {
    for (const diagnostic of parsedManifest.diagnostics) finding(errors, diagnostic.code, diagnostic.message);
    for (const diagnostic of validateManifestRows(manifest)) finding(errors, diagnostic.code, diagnostic.message);
    const derived = deriveTopLevelStatus(manifest.map((row) => parseProgressionStatus(row.status)));
    const declared = indexSource.match(/^\*\*Status\*\*:\s*`?([^`\n]+)`?/m)?.[1].trim() ?? "";
    if (declared !== derived) finding(errors, "TOP_LEVEL_STATUS_MISMATCH", `declared=${declared}, derived=${derived}`);
  }
  const ids = new Set<string>();
  const files = new Set<string>();
  for (const [index, row] of manifest.entries()) {
    if (row.order !== index + 1) finding(errors, "PHASE_ORDER_INVALID", `${row.id}: order=${row.order}, expected=${index + 1}`);
    if (ids.has(row.id)) finding(errors, "DUPLICATE_PHASE_ID", row.id);
    if (files.has(row.file)) finding(errors, "DUPLICATE_PHASE_FILE", row.file);
    ids.add(row.id);
    files.add(row.file);
    for (const dependency of row.dependencies) {
      const dependencyIndex = manifest.findIndex((item) => item.id === dependency);
      if (dependencyIndex < 0) finding(errors, "UNKNOWN_PHASE_DEPENDENCY", `${row.id}: ${dependency}`);
      else if (dependencyIndex >= index) finding(errors, "PHASE_DEPENDENCY_ORDER", `${row.id}: ${dependency}`);
    }
  }

  const actualPhaseFiles = readdirSync(directory).filter((file) => /^\d{2}-phase-.+\.md$/.test(file)).sort();
  for (const file of files) {
    if (!actualPhaseFiles.includes(file)) finding(errors, "MISSING_PHASE_FILE", file);
  }
  for (const file of actualPhaseFiles) {
    if (!files.has(file)) finding(errors, "UNREGISTERED_PHASE_FILE", file);
  }

  const phaseMetrics: Record<string, Metrics> = {};
  for (const row of manifest) {
    if (!actualPhaseFiles.includes(row.file)) continue;
    const source = read(join(directory, row.file));
    enforceBudget(source, row.file, LIMITS.phase, "PHASE_LENGTH_EXCEEDED");
    requireTokens(source, [
      `**Phase ID**: \`${row.id}\``,
      "**Depends on**:",
      "**Outcome**:",
      "**Evidence level**:",
      "## Goal",
      "## Starting state and dependency",
      "## Local requirements",
      "## Allowed files",
      "## Forbidden files and behaviors",
      "## Fixed contract",
      "## Implementation steps",
      "## Check Registry",
      "## All-pass Fixture",
      "## Single-failure Matrix",
      "## Fixed verification",
      "## Rollback/failure convergence",
      "## Phase completion gate",
    ], "PHASE_CONTRACT_MISSING", row.file);
    if (!new RegExp(`^# Phase ${row.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: .+\\[(ANALYSIS|VERIFICATION|OBSERVATION)`).test(source)) {
      finding(errors, "PHASE_HEADER_INVALID", row.file);
    }
    const declaredDependency = source.match(/^\*\*Depends on\*\*:\s*(.+)$/m)?.[1].replaceAll("`", "").trim() ?? "";
    const expectedDependency = row.dependencies.length === 0 ? "NONE" : row.dependencies.join(", ");
    if (declaredDependency !== expectedDependency) {
      finding(errors, "PHASE_DEPENDENCY_MISMATCH", `${row.file}: declared=${declaredDependency}, manifest=${expectedDependency}`);
    }
    if (progressionEnabled) {
      const manifestStatus = parseProgressionStatus(row.status);
      if (!manifestStatus) {
        finding(errors, "PHASE_STATUS_INVALID", `${row.id}: manifest Status=${row.status ?? "<missing>"}`);
      }
      const phaseStatusRaw = source.match(/^\*\*Progression status\*\*:\s*`?([^`\n]+)`?/m)?.[1].trim() ?? "";
      const phaseStatus = parseProgressionStatus(phaseStatusRaw);
      if (!phaseStatus) finding(errors, "PHASE_STATUS_MISSING", `${row.file}: **Progression status**`);
      else if (manifestStatus && phaseStatus !== manifestStatus) finding(errors, "PHASE_STATUS_MISMATCH", `${row.id}: manifest=${manifestStatus}, phase=${phaseStatus}`);
      const gateMatch = source.match(/^(?:####|##) Phase completion gate\s*\n([\s\S]*?)(?=^#{1,4}\s|$)/m);
      const gateText = gateMatch?.[1] ?? "";
      const gateBoxes = gateText.match(/- \[([ xX])\]/g) ?? [];
      const checked = gateBoxes.filter((box) => /\[[xX]\]/.test(box)).length;
      if (manifestStatus === "ACCEPTED" && gateBoxes.length > 0 && checked !== gateBoxes.length) {
        finding(errors, "PHASE_COMPLETION_GATE_MISMATCH", `${row.id}: ACCEPTED requires every completion gate checkbox checked`);
      }
      if (manifestStatus && manifestStatus !== "ACCEPTED" && checked > 0) {
        finding(errors, "PHASE_COMPLETION_GATE_MISMATCH", `${row.id}: ${manifestStatus} cannot have checked completion gate`);
      }
      if (manifestStatus === "ACCEPTED") {
        const receipt = source.match(/^\*\*Completion receipt\*\*:\s*(.+)$/m)?.[1].trim() ?? "";
        if (!receipt || receipt === "NONE" || receipt === "N/A") finding(errors, "PHASE_RECEIPT_MISSING", `${row.id}: Completion receipt`);
      }
    }
    checkPhaseComplexity(source, row.file, {
      requirements: "## Local requirements",
      files: "## Allowed files",
      checks: "## Check Registry",
    });
    checkUnresolvedAndAmbiguous(source, row.file);
    checkEvidenceContracts(source, row.file);
    phaseMetrics[row.file] = metrics(source);
  }
  checkUnresolvedAndAmbiguous(indexSource, "00-plan-index.md");
  checkUnresolvedAndAmbiguous(finalSource, "99-final-verification.md");
  if (!finalSource.includes("- [ ]")) finding(errors, "NO_COMPLETION_CHECKBOX", "99-final-verification.md");
  return {
    index: metrics(indexSource),
    phases: phaseMetrics,
    final: metrics(finalSource),
  };
}

let mode: "SINGLE_FILE" | "PLAN_SET";
let resultMetrics: unknown;
try {
  if (statSync(inputPath).isDirectory()) {
    mode = "PLAN_SET";
    resultMetrics = validatePlanSet(inputPath);
  } else {
    mode = "SINGLE_FILE";
    resultMetrics = validateSingle(inputPath);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

const result = { ok: errors.length === 0, mode, planPath: inputPath, metrics: resultMetrics, errors, warnings };
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
