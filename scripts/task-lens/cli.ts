// scripts/task-lens/cli.ts
// CLI grammar (generate/feedback/metrics) + main orchestrator.
// PHASE-05-v2: generate runs the full deterministic pipeline
// (config → diff → provider → graph → spine → coverage → card → artifacts →
// generated-event append); feedback and metrics summarize are wired to the
// metrics module. Exit precedence: 21 > 20 > 12 > 10 > 13 > 2 > 1.

import fs from "node:fs";
import { isAbsolute } from "node:path";
import {
  type CliRequest,
  type Clock,
  type CommandRunner,
  type GenerateRequest,
  type FeedbackRequest,
  type MetricsRequest,
  CliError,
  DEFAULT_GRAPH_BUDGET,
  PROVIDER_PLACEHOLDER,
  ProcessFailure,
  TASK_GRAPH_SCHEMA_VERSION,
  type TaskGraphV1,
} from "./types.ts";
import { ConfigError, resolveConfig, assertOutputOutsideProject, sha256Hex } from "./config.ts";
import { extractDiff, createInputReceipt, EmptyDiffError, DiffInputError } from "./diff-extractor.ts";
import { runCommand } from "./command-runner.ts";
import { writeArtifacts, ArtifactError } from "./artifact-writer.ts";
import { renderCard } from "./card-renderer.ts";
import { CodeGraphProvider, ProviderUnavailableError } from "./codegraph-provider.ts";
import { resolveSeeds } from "./seed-resolver.ts";
import { buildGraph } from "./graph-builder.ts";
import { buildSpineForest } from "./spine.ts";
import { readCoverage, type CoverageBinding } from "./coverage-reader.ts";
import {
  appendFeedback,
  appendGenerated,
  buildGeneratedEvent,
  summarizeMetrics,
  MetricsError,
  METRICS_SCHEMA_VERSION,
  type FeedbackEvent,
} from "./metrics.ts";

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
  // `--json` is a bare flag (presence = true); strip it before strict parsing.
  let json = false;
  const rest: string[] = [];
  for (const t of tokens.slice(1)) {
    if (t === "--json") {
      json = true;
    } else {
      rest.push(t);
    }
  }
  const m = parsePairs(rest);
  const known = new Set(["out"]);
  for (const k of m.keys()) {
    if (!known.has(k)) throw new CliError(`unknown flag --${k}`);
  }
  const out = required(m, "out");
  if (!isAbsolutePath(out)) throw new CliError(`--out must be absolute: "${out}"`);
  return {
    subcommand: "metrics",
    action: "summarize",
    out,
    json,
  } as MetricsRequest;
}

export function isAbsolutePath(p: string): boolean {
  return isAbsolute(p);
}

function parseBool(v: string, label: string): boolean {
  if (v === "true" || v === "yes") return true;
  if (v === "false" || v === "no") return false;
  throw new CliError(`--${label} must be yes|no (or true|false), got "${v}"`);
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
// generate — full deterministic pipeline
// ---------------------------------------------------------------------------

/** nodeKey must match coverage-reader's internal key format. */
function nodeKey(node: { file: string; name: string; startLine: number; endLine: number }): string {
  return `${node.file}:${node.name}:${node.startLine}:${node.endLine}`;
}

async function runGenerateFull(
  req: GenerateRequest,
  runner: CommandRunner,
  clock: Clock,
): Promise<number> {
  // 1. Config + out boundary.
  const { config, projectRealpath, hash: configHash } = await resolveConfig(
    req.project,
    req.config,
  );
  const outReal = assertOutputOutsideProject(req.out, projectRealpath);

  // 2. Diff extraction.
  const diff = await extractDiff(
    { projectRealpath, mode: req.mode, baseSha: req.base },
    runner,
  );

  // 3. Coverage hash (optional).
  let coverageHash: string | null = null;
  if (req.coverage !== undefined) {
    try {
      coverageHash = sha256Hex(await Bun.file(req.coverage).text());
    } catch {
      coverageHash = null;
    }
  }

  // 4. Input receipt (taskId excludes generatedAt; coverageHash included).
  const receipt = createInputReceipt(
    {
      projectRealpath,
      mode: diff.mode,
      baseSha: diff.baseSha,
      headSha: diff.headSha,
      diffHash: diff.diffHash,
      configHash,
      coverageHash,
      provider: PROVIDER_PLACEHOLDER,
    },
    clock,
  );

  // 5. Ensure out dir exists (writeArtifacts requires an existing outDir).
  fs.mkdirSync(outReal, { recursive: true });

  // 6. Provider (exit 12 on unavailability).
  const provider = await CodeGraphProvider.open(projectRealpath);
  try {
    // 7. Seeds from live hunks ∩ function ranges.
    const files = [
      ...new Set(
        diff.hunks
          .filter((h) => h.kind === "add" || h.kind === "modify")
          .map((h) => h.newPath),
      ),
    ];
    const ranges = await provider.getFunctionRanges(files);
    const seedResult = resolveSeeds(diff.hunks, ranges);

    // 8. Graph.
    const graphResult = await buildGraph(provider, seedResult.seeds);

    // 9. Spine (CLI --entry first, then config entries).
    const entries = [req.entry, ...config.entries].filter(
      (e): e is string => typeof e === "string" && e.length > 0,
    );
    const spine = buildSpineForest(
      graphResult,
      seedResult.seeds,
      entries,
      DEFAULT_GRAPH_BUDGET,
    );

    // 10. Coverage → observations.
    const observations = new Map<string, "observed" | "not-observed" | "unknown">();
    let coverageUnverified: readonly string[] = [];
    if (req.coverage !== undefined) {
      const binding: CoverageBinding = {
        producer: null,
        fileSha256: coverageHash ?? "",
        mtimeMs: 0,
        targetHeadSha: diff.headSha,
        diffHash: diff.diffHash,
        proofState: "ALIGNED",
      };
      const cov = await readCoverage(req.coverage, binding, [...graphResult.nodes]);
      for (const [k, v] of cov.observations) observations.set(k, v);
      coverageUnverified = cov.unverified;
    }

    // 11. Final graph (observations merged, coverage unverified appended).
    const nodes = graphResult.nodes.map((n) => ({
      ...n,
      observation: observations.get(nodeKey(n)) ?? ("unknown" as const),
    }));
    const graph: TaskGraphV1 = {
      schemaVersion: TASK_GRAPH_SCHEMA_VERSION,
      taskId: receipt.taskId,
      seeds: graphResult.seeds,
      deletedRegions: diff.deletedRegions,
      nodes,
      edges: graphResult.edges,
      spine,
      truncation: graphResult.truncation,
      unverified: [...new Set([...graphResult.unverified, ...coverageUnverified])].sort(),
    };

    // 12. Card + artifacts.
    const card = renderCard(graph, receipt);
    const artifactReceipt = await writeArtifacts({
      taskId: receipt.taskId,
      outDir: outReal,
      card,
      graph,
      receipt,
    });
    const artifactHashes = {
      card: artifactReceipt.files.find((f) => f.path.endsWith("card.md"))!.sha256,
      graph: artifactReceipt.files.find((f) => f.path.endsWith("graph.json"))!.sha256,
      receipt: artifactReceipt.files.find((f) => f.path.endsWith("receipt.json"))!.sha256,
    };

    // 13. Generated event (post-commit) — verified recovery on retry.
    const event = buildGeneratedEvent(graph, receipt, artifactHashes);
    await appendGenerated(outReal, event);
    return event.exitCode;
  } finally {
    provider.close();
  }
}

// ---------------------------------------------------------------------------
// feedback
// ---------------------------------------------------------------------------

async function runFeedback(req: FeedbackRequest, clock: Clock): Promise<number> {
  const event: FeedbackEvent = {
    schemaVersion: METRICS_SCHEMA_VERSION,
    event: "feedback",
    taskId: req.taskId,
    recordedAt: clock(),
    useful: req.useful,
    loadReduced: req.loadReduced,
    issuesFound: req.issuesFound,
    issuesGuidedByCard: req.issuesGuidedByCard,
    reviewMinutes: req.reviewMinutes,
    notes: req.notes ?? "",
  };
  await appendFeedback(req.out, event);
  return 0;
}

// ---------------------------------------------------------------------------
// metrics summarize
// ---------------------------------------------------------------------------

async function runMetricsSummarize(
  req: MetricsRequest,
  json: boolean,
): Promise<number> {
  const summary = await summarizeMetrics(req.out);
  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(
      `generated=${summary.generatedCount} feedback=${summary.feedbackCount} usefulAndReduced=${summary.usefulAndReducedCount} gate=${summary.gate}`,
    );
  }
  if (summary.gate === "PASS") return 0;
  if (summary.gate === "FAIL") return 1;
  return 2; // INCOMPLETE
}

/**
 * Entry point. Returns the exit code. Exit precedence:
 * 21 > 20 > 12 > 10 > 13 > 2 > 1.
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
    const clock: Clock = () => new Date().toISOString();
    if (req.subcommand === "generate") {
      return await runGenerateFull(req, runCommand, clock);
    }
    if (req.subcommand === "feedback") {
      return await runFeedback(req, clock);
    }
    const json = (req as MetricsRequest & { json?: boolean }).json ?? false;
    return await runMetricsSummarize(req, json);
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
    if (e instanceof ProviderUnavailableError) {
      console.error(e.message);
      return e.exitCode;
    }
    if (e instanceof ArtifactError) {
      console.error(e.message);
      return e.exitCode;
    }
    if (e instanceof MetricsError) {
      console.error(e.message);
      return e.exitCode;
    }
    console.error(String(e));
    return 1;
  }
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  main(argv).then((code) => process.exit(code));
}
