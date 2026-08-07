#!/usr/bin/env bun
/**
 * workspace-paths.ts — Validated workspace path resolver
 *
 * Provides:
 *   - resolveWorkspacePaths(input): returns qoderworkRoot, workOneRoot, workOneSource, bunBin, codegraphBin
 *   - validateWorkOneRoot(candidate): validates an absolute path is a git top-level with opencode.json
 *   - resolveTool(value): accepts absolute executable file or PATH basename
 *
 * Precedence for workOneRoot:
 *   1. input.cliWorkOneRoot (--work-dir)
 *   2. input.env.WORK_ONE_ROOT
 *   3. scripts/local-paths.json platforms[process.platform].workOneRoot
 *   4. resolver-module-relative legacy candidate
 *   The first candidate that exists but fails validation throws.
 *   Unknown JSON keys, bad JSON, and unavailable tools fail closed.
 */

import { existsSync, realpathSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Normalize a filesystem path to forward-slash form for cross-platform comparison.
 * POSIX: identity. Windows: realpathSync returns backslash while git/spawnSync returns
 * forward-slash on MSYS — comparing directly is a false negative. Use this helper
 * before any path-equality check that mixes fs APIs with git/spawn outputs.
 */
const normalizePath = (p: string): string => p.replace(/\\/g, "/");

export type WorkOneSource = "CLI" | "ENV" | "LOCAL_CONFIG" | "DEPRECATED_DEFAULT";

export type ResolveInput = {
  cliWorkOneRoot?: string;
  env?: Record<string, string | undefined>;
  localPathsFile?: string;
  platform?: NodeJS.Platform;
};

export type ResolvedWorkspacePaths = {
  qoderworkRoot: string;
  workOneRoot: string;
  workOneSource: WorkOneSource;
  bunBin: string | undefined;
  codegraphBin: string | undefined;
};

const LOCAL_PATHS_SCHEMA_VERSION = 1;
const LOCAL_PATHS_PLATFORM_KEYS = new Set(["linux", "win32"]);
const LOCAL_PATHS_TOOL_KEYS = new Set(["bunBin", "codegraphBin"]);

export class WorkspacePathsError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "WorkspacePathsError";
  }
}

function gitTopLevel(candidate: string): string | null {
  if (!existsSync(candidate)) return null;
  try {
    const result = spawnSync("git", ["-C", candidate, "rev-parse", "--show-toplevel"], {
      encoding: "utf-8",
      timeout: 5000,
    });
    if (result.status !== 0) return null;
    const stdout = result.stdout.trim();
    if (!stdout) return null;
    return stdout;
  } catch {
    return null;
  }
}

function isExecutable(file: string): boolean {
  try {
    const stat = statSync(file);
    if (!stat.isFile()) return false;
    // Check executable bit on POSIX; on Windows stat.mode can't be used the same way.
    if (process.platform !== "win32") {
      return (stat.mode & 0o111) !== 0;
    }
    // On Windows, any existing file with .exe suffix or on PATHEXT counts.
    return file.toLowerCase().endsWith(".exe") || file.toLowerCase().endsWith(".cmd") || file.toLowerCase().endsWith(".bat");
  } catch {
    return false;
  }
}

function looksLikeToolPath(value: string): boolean {
  // Acceptable absolute executable file or basename without path separators.
  if (value.includes("/") || value.includes("\\") || value.includes("..")) {
    return isAbsolute(value);
  }
  return true;
}

/**
 * Validate that a candidate absolute path is a usable work-one root:
 *   - absolute and resolves to a real path
 *   - git top-level (has a `.git` directory)
 *   - contains `opencode.json` at the root
 */
export function validateWorkOneRoot(candidate: string): string {
  if (!isAbsolute(candidate)) {
    throw new WorkspacePathsError(
      "WORK_ONE_ROOT_INVALID",
      `work-one candidate must be absolute: ${candidate}`,
    );
  }
  let real: string;
  try {
    real = realpathSync(candidate);
  } catch (error) {
    throw new WorkspacePathsError(
      "WORK_ONE_ROOT_INVALID",
      `work-one candidate cannot be resolved (realpath failed): ${candidate} (${(error as Error).message})`,
    );
  }
  if (!existsSync(real)) {
    throw new WorkspacePathsError(
      "WORK_ONE_ROOT_INVALID",
      `work-one candidate does not exist: ${real}`,
    );
  }
  const topLevel = gitTopLevel(real);
  if (topLevel !== null && normalizePath(topLevel) !== normalizePath(real)) {
    throw new WorkspacePathsError(
      "WORK_ONE_ROOT_INVALID",
      `work-one candidate is not a git top-level: ${real} (topLevel=${topLevel ?? "<unavailable>"})`,
    );
  }
  if (!existsSync(resolve(real, "opencode.json"))) {
    throw new WorkspacePathsError(
      "WORK_ONE_ROOT_INVALID",
      `work-one candidate missing opencode.json: ${real}`,
    );
  }
  return real;
}

/**
 * Resolve an executable tool: either an absolute executable file or a basename
 * found on PATH. Throws with TOOL_<KEY>_INVALID on failure.
 */
export function resolveTool(
  value: string | undefined,
  key: "bunBin" | "codegraphBin",
  env: NodeJS.ProcessEnv = process.env,
  platformName: NodeJS.Platform = process.platform,
): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (!looksLikeToolPath(value)) {
    throw new WorkspacePathsError(
      key === "bunBin" ? "TOOL_BUN_INVALID" : "TOOL_CODEGRAPH_INVALID",
      `${key} contains path separators or '..' but is not absolute: ${value}`,
    );
  }
  if (isAbsolute(value)) {
    if (!existsSync(value) || !isExecutable(value)) {
      throw new WorkspacePathsError(
        key === "bunBin" ? "TOOL_BUN_INVALID" : "TOOL_CODEGRAPH_INVALID",
        `${key} absolute path is missing or not executable: ${value}`,
      );
    }
    return realpathSync(value);
  }
  // Basename: lookup PATH
  const separator = platformName === "win32" ? ";" : ":";
  const pathDirs = (env.PATH || "").split(separator);
  const extensions = platformName === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const dir of pathDirs) {
    if (!dir) continue;
    for (const ext of extensions) {
      const candidate = resolve(dir, value + ext);
      if (existsSync(candidate) && isExecutable(candidate)) {
        try {
          return realpathSync(candidate);
        } catch {
          return candidate;
        }
      }
    }
  }
  throw new WorkspacePathsError(
    key === "bunBin" ? "TOOL_BUN_INVALID" : "TOOL_CODEGRAPH_INVALID",
    `${key} basename not found on PATH: ${value}`,
  );
}

type LocalPathsJson = {
  schemaVersion: number;
  platforms?: Record<string, { workOneRoot?: string }>;
  tools?: Record<string, string>;
};

function loadLocalPaths(filePath: string): LocalPathsJson | null {
  if (!existsSync(filePath)) return null;
  let raw: string;
  try {
    raw = require("node:fs").readFileSync(filePath, "utf-8");
  } catch {
    throw new WorkspacePathsError(
      "LOCAL_PATHS_INVALID",
      `cannot read local-paths.json: ${filePath}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new WorkspacePathsError(
      "LOCAL_PATHS_INVALID",
      `local-paths.json is not valid JSON: ${filePath} (${(error as Error).message})`,
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new WorkspacePathsError(
      "LOCAL_PATHS_INVALID",
      `local-paths.json must be a JSON object: ${filePath}`,
    );
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.schemaVersion !== LOCAL_PATHS_SCHEMA_VERSION) {
    throw new WorkspacePathsError(
      "LOCAL_PATHS_INVALID",
      `local-paths.json schemaVersion must be ${LOCAL_PATHS_SCHEMA_VERSION}: got ${String(obj.schemaVersion)}`,
    );
  }
  if (obj.platforms !== undefined) {
    if (typeof obj.platforms !== "object" || obj.platforms === null || Array.isArray(obj.platforms)) {
      throw new WorkspacePathsError(
        "LOCAL_PATHS_INVALID",
        `local-paths.json platforms must be an object`,
      );
    }
    for (const key of Object.keys(obj.platforms)) {
      if (!LOCAL_PATHS_PLATFORM_KEYS.has(key)) {
        throw new WorkspacePathsError(
          "LOCAL_PATHS_INVALID",
          `local-paths.json has unknown platform key: ${key}`,
        );
      }
      const entry = (obj.platforms as Record<string, unknown>)[key];
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        throw new WorkspacePathsError(
          "LOCAL_PATHS_INVALID",
          `local-paths.json platforms.${key} must be an object`,
        );
      }
      const workOneRoot = (entry as Record<string, unknown>).workOneRoot;
      if (workOneRoot !== undefined && typeof workOneRoot !== "string") {
        throw new WorkspacePathsError(
          "LOCAL_PATHS_INVALID",
          `local-paths.json platforms.${key}.workOneRoot must be a string`,
        );
      }
    }
  }
  if (obj.tools !== undefined) {
    if (typeof obj.tools !== "object" || obj.tools === null || Array.isArray(obj.tools)) {
      throw new WorkspacePathsError(
        "LOCAL_PATHS_INVALID",
        `local-paths.json tools must be an object`,
      );
    }
    for (const key of Object.keys(obj.tools)) {
      if (!LOCAL_PATHS_TOOL_KEYS.has(key)) {
        throw new WorkspacePathsError(
          "LOCAL_PATHS_INVALID",
          `local-paths.json has unknown tool key: ${key}`,
        );
      }
      const val = (obj.tools as Record<string, unknown>)[key];
      if (val !== undefined && typeof val !== "string") {
        throw new WorkspacePathsError(
          "LOCAL_PATHS_INVALID",
          `local-paths.json tools.${key} must be a string`,
        );
      }
    }
  }
  return obj as LocalPathsJson;
}

function deriveQoderworkRoot(): string {
  // workspace-paths.ts lives in scripts/lib/; the qoderwork root is its parent's parent.
  // Use fileURLToPath to correctly handle Windows file:///C:/... URL→path conversion
  // (new URL(...).pathname returns "/C:/..." which on Windows resolves to "C:\C:\..." via
  // path.resolve due to the leading slash being treated as absolute path on the C: drive).
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..");
}

/**
 * Resolve all workspace paths. The first candidate that exists but fails
 * validation throws; it does not fall through to a less-preferred source.
 */
export function resolveWorkspacePaths(input: ResolveInput = {}): ResolvedWorkspacePaths {
  const qoderworkRoot = deriveQoderworkRoot();
  const platformName = input.platform ?? process.platform;
  const env = input.env ?? (process.env as Record<string, string | undefined>);
  const localPathsFile = input.localPathsFile ?? resolve(qoderworkRoot, "scripts", "local-paths.json");

  // Precedence chain
  const candidates: Array<{ value: string; source: WorkOneSource }> = [];
  if (input.cliWorkOneRoot) {
    candidates.push({ value: input.cliWorkOneRoot, source: "CLI" });
  }
  const envRoot = env.WORK_ONE_ROOT;
  if (envRoot) {
    candidates.push({ value: envRoot, source: "ENV" });
  }
  const localPaths = (() => {
    try {
      return loadLocalPaths(localPathsFile);
    } catch (error) {
      if (error instanceof WorkspacePathsError) throw error;
      throw error;
    }
  })();
  if (localPaths && localPaths.platforms) {
    const entry = localPaths.platforms[platformName];
    if (entry && entry.workOneRoot) {
      candidates.push({ value: entry.workOneRoot, source: "LOCAL_CONFIG" });
    }
  }
  // Deprecated default: resolver-module-relative legacy candidate
  const legacyDefault = resolve(qoderworkRoot, "..", "opencode", "work-one");
  candidates.push({ value: legacyDefault, source: "DEPRECATED_DEFAULT" });

  let workOneRoot: string | undefined;
  let workOneSource: WorkOneSource | undefined;
  for (const { value, source } of candidates) {
    if (!isAbsolute(value)) {
      // Non-absolute values are skipped silently for legacy/default; CLI/ENV/LOCAL_CONFIG must be absolute.
      if (source === "DEPRECATED_DEFAULT") continue;
      throw new WorkspacePathsError(
        "WORK_ONE_ROOT_INVALID",
        `${source} work-one root must be absolute: ${value}`,
      );
    }
    if (!existsSync(value)) {
      if (source === "DEPRECATED_DEFAULT") continue;
      continue; // env or local-config pointing to a missing path: try next.
    }
    // Exists → must validate; first invalid candidate throws.
    workOneRoot = validateWorkOneRoot(value);
    workOneSource = source;
    break;
  }

  if (!workOneRoot || !workOneSource) {
    throw new WorkspacePathsError(
      "WORK_ONE_ROOT_INVALID",
      `no usable work-one root found (checked ${candidates.length} sources)`,
    );
  }

  // Tools: optional via local-paths.json
  const bunOverride = localPaths?.tools?.bunBin;
  const codegraphOverride = localPaths?.tools?.codegraphBin;
  const bunBin = resolveTool(bunOverride, "bunBin", process.env, platformName);
  const codegraphBin = resolveTool(codegraphOverride, "codegraphBin", process.env, platformName);

  return {
    qoderworkRoot,
    workOneRoot,
    workOneSource,
    bunBin,
    codegraphBin,
  };
}

// Test/CLI hook (not part of normal use)
if (import.meta.main) {
  try {
    const cliRoot = process.argv.find((a, i) => process.argv[i - 1] === "--work-dir");
    const result = resolveWorkspacePaths({ cliWorkOneRoot: cliRoot });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof WorkspacePathsError) {
      console.error(`${error.code}: ${error.message}`);
      process.exit(2);
    }
    throw error;
  }
}

// Avoid unused-import warning on sep under bun
void sep;