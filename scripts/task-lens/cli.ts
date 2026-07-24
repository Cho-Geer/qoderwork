// scripts/task-lens/cli.ts
// REQ-004-B — CLI grammar (generate/feedback/metrics) + main orchestrator.
// PHASE-02: generate captures the input stage (config + diff + receipt) and
// returns NOT_IMPLEMENTED_AFTER_INPUT; no graph/card/artifact is produced.

import {
  type CliRequest,
  type Clock,
  type CommandRunner,
  type GenerateRequest,
  type FeedbackRequest,
  type MetricsRequest,
  type NotImplementedAfterInput,
  CliError,
  PROVIDER_PLACEHOLDER,
  ProcessFailure,
} from "./types.ts";
import { ConfigError, resolveConfig, assertOutputOutsideProject } from "./config.ts";
import { extractDiff, createInputReceipt, EmptyDiffError, DiffInputError } from "./diff-extractor.ts";
import { runCommand } from "./command-runner.ts";

// ---------------------------------------------------------------------------
// parseCli
// ---------------------------------------------------------------------------

const FULL_SHA_RE = /^[0-9a-f]{40}$/;

function parsePairs(tokens: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    if (!tok.startsWith("--")) {
      throw new CliError(`unexpected positional argument: "${tok}"`);
    }
    let key: string;
    let value: string | undefined;
    const eq = tok.indexOf("=");
    if (eq >= 0) {
      key = tok.slice(2, eq);
      value = tok.slice(eq + 1);
    } else {
      key = tok.slice(2);
      if (i + 1 < tokens.length) {
        value = tokens[++i];
      }
    }
    if (value === undefined) {
      throw new CliError(`flag --${key} requires a value`);
    }
    if (map.has(key)) {
      throw new CliError(`flag --${key} repeated`);
    }
    map.set(key, value);
  }
  return map;
}

function required(map: Map<string, string>, key: string): string {
  const v = map.get(key);
  if (v === undefined) throw new CliError(`missing required flag --${key}`);
  return v;
}

function parseGenerate(tokens: string[]): GenerateRequest {
  const m = parsePairs(tokens);
  const project = required(m, "project");
  const mode = required(m, "mode");
  const out = required(m, "out");
  const config = m.get("config");
  const coverage = m.get("coverage");
  const base = m.get("base");
  const entry = m.get("entry");
  // Reject unknown flags.
  const known = new Set(["project", "mode", "out", "config", "coverage", "base", "entry"]);
  for (const k of m.keys()) {
    if (!known.has(k)) throw new CliError(`unknown flag --${k}`);
  }
  if (mode !== "working-tree" && mode !== "commit") {
    throw new CliError(`--mode must be working-tree|commit, got "${mode}"`);
  }
  if (!isAbsolutePath(project)) throw new CliError(`--project must be absolute: "${project}"`);
  if (!isAbsolutePath(out)) throw new CliError(`--out must be absolute: "${out}"`);
  if (config !== undefined && !isAbsolutePath(config)) {
    throw new CliError(`--config must be absolute: "${config}"`);
  }
  if (coverage !== undefined && !isAbsolutePath(coverage)) {
    throw new CliError(`--coverage must be absolute: "${coverage}"`);
  }
  if (mode === "working-tree") {
    if (base !== undefined) {
      throw new CliError("--base is only valid with --mode commit");
    }
  } else {
    // commit mode requires a full SHA base that does not start with `-`.
    if (base === undefined) {
      throw new CliError("--mode commit requires --base <full-sha>");
    }
    if (base.startsWith("-")) {
      throw new CliError(`--base must not start with '-': "${base}"`);
    }
    if (!FULL_SHA_RE.test(base)) {
      throw new CliError(`--base must be a 40-hex full SHA: "${base}"`);
    }
  }
  return { subcommand: "generate", project, mode, out, config, coverage, base, entry };
}

function parseFeedback(tokens: string[]): FeedbackRequest {
  const m = parsePairs(tokens);
  const known = new Set([
    "out",
    "task-id",
    "useful",
    "load-reduced",
    "issues-found",
    "issues-guided-by-card",
    "review-minutes",
    "notes",
  ]);
  for (const k of m.keys()) {
    if (!known.has(k)) throw new CliError(`unknown flag --${k}`);
  }
  const out = required(m, "out");
  const taskId = required(m, "task-id");
  if (!isAbsolutePath(out)) throw new CliError(`--out must be absolute: "${out}"`);
  const useful = parseBool(required(m, "useful"), "useful");
  const loadReduced = parseBool(required(m, "load-reduced"), "load-reduced");
  const issuesFound = parseInt(required(m, "issues-found"), 10);
  const issuesGuidedByCard = parseInt(required(m, "issues-guided-by-card"), 10);
  const reviewMinutes = parseInt(required(m, "review-minutes"), 10);
  const notes = m.get("notes");
  if (!Number.isFinite(issuesFound) || issuesFound < 0) {
    throw new CliError("--issues-found must be a non-negative integer");
  }
  if (!Number.isFinite(issuesGuidedByCard) || issuesGuidedByCard < 0) {
    throw new CliError("--issues-guided-by-card must be a non-negative integer");
  }
  if (issuesGuidedByCard > issuesFound) {
    throw new CliError("--issues-guided-by-card must be <= --issues-found");
  }
  if (!Number.isFinite(reviewMinutes) || reviewMinutes < 0) {
    throw new CliError("--review-minutes must be a non-negative integer");
  }
  return {
    subcommand: "feedback",
    out,
    taskId,
    useful,
    loadReduced,
    issuesFound,
    issuesGuidedByCard,
    reviewMinutes,
    notes,
  };
}

function parseMetrics(tokens: string[]): MetricsRequest {
  if (tokens.length === 0) throw new CliError("metrics requires an action");
  const action = tokens[0]!;
  if (action !== "summarize") {
    throw new CliError(`unknown metrics action: "${action}"`);
  }
  const m = parsePairs(tokens.slice(1));
  const known = new Set(["out"]);
  for (const k of m.keys()) {
    if (!known.has(k)) throw new CliError(`unknown flag --${k}`);
  }
  const out = required(m, "out");
  if (!isAbsolutePath(out)) throw new CliError(`--out must be absolute: "${out}"`);
  return { subcommand: "metrics", action: "summarize", out };
}

function isAbsolutePath(p: string): boolean {
  return p.startsWith("/");
}

function parseBool(v: string, label: string): boolean {
  if (v === "true") return true;
  if (v === "false") return false;
  throw new CliError(`--${label} must be true|false, got "${v}"`);
}

/** Parse argv (excluding the script name) into a CliRequest or throw CliError. */
export function parseCli(argv: string[]): CliRequest {
  if (argv.length === 0) throw new CliError("missing subcommand");
  const sub = argv[0]!;
  const rest = argv.slice(1);
  if (sub === "generate") return parseGenerate(rest);
  if (sub === "feedback") return parseFeedback(rest);
  if (sub === "metrics") return parseMetrics(rest);
  throw new CliError(`unknown subcommand: "${sub}"`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function runGenerate(
  req: GenerateRequest,
  runner: CommandRunner,
  clock: Clock,
): Promise<{ result: NotImplementedAfterInput; exit: number }> {
  const { config: _config, projectRealpath, hash: configHash } = await resolveConfig(
    req.project,
    req.config,
  );
  assertOutputOutsideProject(req.out, projectRealpath);
  const diff = await extractDiff(
    { projectRealpath, mode: req.mode, baseSha: req.base },
    runner,
  );
  const receipt = createInputReceipt(
    {
      projectRealpath,
      mode: diff.mode,
      baseSha: diff.baseSha,
      headSha: diff.headSha,
      diffHash: diff.diffHash,
      configHash,
      coverageHash: null,
      provider: PROVIDER_PLACEHOLDER,
    },
    clock,
  );
  return {
    result: { status: "NOT_IMPLEMENTED_AFTER_INPUT", receipt },
    exit: 2,
  };
}

/**
 * Entry point. Returns the exit code. generate captures input then returns
 * NOT_IMPLEMENTED_AFTER_INPUT (exit 2); feedback/metrics are recognized grammar
 * but not implemented in PHASE-02 (exit 2).
 */
export async function main(argv: string[]): Promise<number> {
  let req: CliRequest;
  try {
    req = parseCli(argv);
  } catch (e) {
    if (e instanceof CliError) {
      console.error(e.message);
      return e.exitCode;
    }
    console.error(String(e));
    return 1;
  }
  try {
    if (req.subcommand === "generate") {
      const clock: Clock = () => new Date().toISOString();
      const { result } = await runGenerate(req, runCommand, clock);
      console.error(`NOT_IMPLEMENTED_AFTER_INPUT taskId=${result.receipt.taskId}`);
      return 2;
    }
    console.error(`NOT_IMPLEMENTED: ${req.subcommand}`);
    return 2;
  } catch (e) {
    if (e instanceof ConfigError || e instanceof DiffInputError) {
      console.error(e.message);
      return e.exitCode;
    }
    if (e instanceof EmptyDiffError) {
      console.error(e.message);
      return e.exitCode;
    }
    if (e instanceof ProcessFailure) {
      console.error(e.message);
      return 20;
    }
    console.error(String(e));
    return 1;
  }
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  main(argv).then((code) => process.exit(code));
}
