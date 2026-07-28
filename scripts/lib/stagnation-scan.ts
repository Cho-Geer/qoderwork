#!/usr/bin/env bun
/**
 * stagnation-scan.ts — M9 read-only stagnation scanner for active blueprints.
 *
 * Wired to the `audit-finalize` hook: after finalize-audit.ts publishes a LATEST
 * pointer it invokes this scan and embeds the result in its output. The scan is
 * strictly informational — it NEVER mutates any blueprint and NEVER blocks
 * publication (callers are expected to fail-open on scan errors).
 *
 * A blueprint is "stagnant" when ALL of the following hold:
 *   1. Its last git commit (author date) is older than `thresholdDays` (default 90).
 *   2. Its basename is NOT referenced by any active LATEST pointer (audits/*\/LATEST.md).
 *   3. It is NOT exempt (INDEX.md, the frozen v3 blueprint, or archived-by-location —
 *      archived blueprints live under blueprints/archive/ and are never scanned because
 *      only the blueprints/ root is enumerated).
 *
 * Uses only node:fs, node:path, and node:child_process. No external dependencies.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

export type StagnantFile = {
  /** Repo-relative path, e.g. "blueprints/foo.md". */
  path: string;
  /** Last commit author date as YYYY-MM-DD (from `git log --format=%aI`). */
  last_update: string;
  /** Whole days elapsed since the last commit author date. */
  days_since: number;
};

export type StagnationScanResult = {
  scanned_at: string;
  threshold_days: number;
  total_active: number;
  stagnant_count: number;
  stagnant_files: StagnantFile[];
};

export type StagnationScanOptions = {
  /**
   * Blueprints directory to scan (only its root is enumerated, not recursively).
   * Defaults to `<repoRoot>/blueprints` where repoRoot is derived from this module's
   * location. The repo root is taken as the parent of this directory, which also fixes
   * the git cwd and the `audits/` location used for the LATEST-reference check.
   */
  blueprintsDir?: string;
  /** Stagnation threshold in whole days. Defaults to 90. */
  thresholdDays?: number;
};

const DEFAULT_THRESHOLD_DAYS = 90;
const MS_PER_DAY = 86_400_000;

/**
 * Basenames exempt from stagnation scanning. The frozen v3 blueprint is immutable by
 * design; INDEX.md is an index, not a blueprint. Archived blueprints are exempt by
 * location (they live under blueprints/archive/, which is never enumerated).
 */
const EXEMPT_BASENAMES: ReadonlySet<string> = new Set([
  "INDEX.md",
  "blueprint-audit-governance-evidence-and-status-closure-v3.md",
]);

/**
 * Return the last commit author date (ISO 8601) touching `relPath`, or null when the
 * file has no git history (e.g. untracked) or git fails. Fail-open: a missing date is
 * never treated as stagnant.
 */
function lastCommitIso(repoRoot: string, relPath: string): string | null {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%aI", "--", relPath], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const iso = out.trim();
    return iso.length > 0 ? iso : null;
  } catch {
    return null;
  }
}

/**
 * Concatenate every active LATEST pointer (audits/*\/LATEST.md) into a single corpus
 * used for the reference-exemption check. Fail-open: a missing/unreadable audits dir or
 * pointer contributes nothing.
 */
function loadLatestCorpus(auditsDir: string): string {
  if (!existsSync(auditsDir)) return "";
  let corpus = "";
  let entries: string[];
  try {
    entries = readdirSync(auditsDir);
  } catch {
    return "";
  }
  for (const entry of entries) {
    const latestPath = join(auditsDir, entry, "LATEST.md");
    try {
      if (!statSync(latestPath).isFile()) continue;
      corpus += `\n${readFileSync(latestPath, "utf8")}`;
    } catch {
      // skip missing/unreadable pointer
    }
  }
  return corpus;
}

/**
 * Scan active blueprints for stagnation. Read-only and fail-open per file: any blueprint
 * whose last-commit date cannot be resolved is skipped (never flagged).
 */
export function scanStagnantBlueprints(options: StagnationScanOptions = {}): StagnationScanResult {
  const thresholdDays = options.thresholdDays ?? DEFAULT_THRESHOLD_DAYS;
  const blueprintsDir = options.blueprintsDir
    ? resolve(options.blueprintsDir)
    : resolve(import.meta.dir, "../..", "blueprints");
  const repoRoot = resolve(blueprintsDir, "..");
  const auditsDir = join(repoRoot, "audits");

  const scannedAt = new Date().toISOString();
  const now = Date.now();
  const latestCorpus = loadLatestCorpus(auditsDir);

  let rootEntries: string[];
  try {
    rootEntries = readdirSync(blueprintsDir);
  } catch {
    rootEntries = [];
  }

  const activeFiles = rootEntries
    .filter((name) => name.endsWith(".md"))
    .filter((name) => !EXEMPT_BASENAMES.has(name))
    .filter((name) => {
      try {
        return statSync(join(blueprintsDir, name)).isFile();
      } catch {
        return false;
      }
    })
    .sort();

  const stagnantFiles: StagnantFile[] = [];
  for (const name of activeFiles) {
    const relPath = relative(repoRoot, join(blueprintsDir, name)).split(sep).join("/");
    const iso = lastCommitIso(repoRoot, relPath);
    if (!iso) continue; // no resolvable git history → not stagnant (fail-open)
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) continue;
    const daysSince = Math.floor((now - ts) / MS_PER_DAY);
    if (daysSince <= thresholdDays) continue; // fresh enough (boundary: == threshold is NOT stagnant)
    if (latestCorpus.includes(name)) continue; // referenced by an active LATEST pointer
    stagnantFiles.push({
      path: relPath,
      last_update: iso.slice(0, 10),
      days_since: daysSince,
    });
  }

  return {
    scanned_at: scannedAt,
    threshold_days: thresholdDays,
    total_active: activeFiles.length,
    stagnant_count: stagnantFiles.length,
    stagnant_files: stagnantFiles,
  };
}

// CLI entry point: `bun run scripts/lib/stagnation-scan.ts [--threshold-days=N] [--blueprints-dir=PATH]`
if (import.meta.main) {
  const args = process.argv.slice(2);
  const opts: StagnationScanOptions = {};
  for (const arg of args) {
    const threshold = arg.match(/^--threshold-days=(\d+)$/);
    if (threshold) opts.thresholdDays = Number(threshold[1]);
    const dir = arg.match(/^--blueprints-dir=(.+)$/);
    if (dir) opts.blueprintsDir = dir[1];
  }
  console.log(JSON.stringify(scanStagnantBlueprints(opts), null, 2));
}
