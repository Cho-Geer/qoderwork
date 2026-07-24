// scripts/task-lens/config.ts
// REQ-003-B — fixed YAML schema validation, literal side-effect tokens,
// project realpath boundary, and output-outside-project path gate.

import fs from "node:fs";
import path from "node:path";
import {
  CONFIG_SCHEMA_VERSION,
  type SideEffectKind,
  type SideEffectToken,
  type TaskLensConfigV1,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Config / path validation failure. Maps to exit 10. */
export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly exitCode: 10 = 10,
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

// ---------------------------------------------------------------------------
// Canonical hashing helper
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function canonicalConfigJson(config: TaskLensConfigV1): string {
  const entries = [...config.entries].sort();
  const tokens = [...config.sideEffectTokens]
    .map((t) => ({ kind: t.kind, token: t.token }))
    .sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.token < b.token ? -1 : a.token > b.token ? 1 : 0));
  return JSON.stringify({
    schemaVersion: config.schemaVersion,
    entries,
    sideEffectTokens: tokens,
  });
}

export function configHash(config: TaskLensConfigV1): string {
  return sha256Hex(canonicalConfigJson(config));
}

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

export function defaultConfig(): TaskLensConfigV1 {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    entries: [],
    sideEffectTokens: [],
  };
}

// ---------------------------------------------------------------------------
// Schema validation (exact-key; tokens are always literal)
// ---------------------------------------------------------------------------

const ALLOWED_KINDS: readonly SideEffectKind[] = ["DB", "FS", "NET", "PROC"];
const TOP_KEYS = new Set(["schemaVersion", "entries", "sideEffectTokens"]);
const TOKEN_KEYS = new Set(["kind", "token"]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateConfig(raw: unknown): TaskLensConfigV1 {
  if (!isPlainObject(raw)) {
    throw new ConfigError("config: root must be a mapping");
  }
  for (const key of Object.keys(raw)) {
    if (!TOP_KEYS.has(key)) {
      // Unknown top-level field (e.g. `regex`) is rejected; tokens themselves
      // are always treated as literals (see below).
      throw new ConfigError(`config: unknown field "${key}"`);
    }
  }
  const schemaVersion = raw.schemaVersion;
  if (schemaVersion !== CONFIG_SCHEMA_VERSION) {
    throw new ConfigError(
      `config: schemaVersion must be "${CONFIG_SCHEMA_VERSION}"`,
    );
  }
  const entriesRaw = raw.entries;
  if (!Array.isArray(entriesRaw)) {
    throw new ConfigError("config: entries must be a string array");
  }
  for (const e of entriesRaw) {
    if (typeof e !== "string") {
      throw new ConfigError("config: entries must contain only strings");
    }
  }
  const tokensRaw = raw.sideEffectTokens;
  if (!Array.isArray(tokensRaw)) {
    throw new ConfigError("config: sideEffectTokens must be an array");
  }
  const tokens: SideEffectToken[] = [];
  for (const item of tokensRaw) {
    if (!isPlainObject(item)) {
      throw new ConfigError("config: sideEffectToken must be a mapping");
    }
    for (const key of Object.keys(item)) {
      if (!TOKEN_KEYS.has(key)) {
        throw new ConfigError(`config: sideEffectToken unknown field "${key}"`);
      }
    }
    const kind = item.kind;
    if (typeof kind !== "string" || !ALLOWED_KINDS.includes(kind as SideEffectKind)) {
      throw new ConfigError(
        `config: sideEffectToken.kind must be one of ${ALLOWED_KINDS.join(",")}`,
      );
    }
    const token = item.token;
    if (typeof token !== "string") {
      throw new ConfigError("config: sideEffectToken.token must be a string");
    }
    // Duplicate / empty / regex-metachar tokens are kept as ordinary literals;
    // they are never compiled as regex and never rejected here.
    tokens.push({ kind: kind as SideEffectKind, token });
  }
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    entries: entriesRaw,
    sideEffectTokens: tokens,
  };
}

// ---------------------------------------------------------------------------
// Path boundary
// ---------------------------------------------------------------------------

/** Realpath a directory that must exist; throws ConfigError otherwise. */
function realpathDir(p: string, label: string): string {
  if (!path.isAbsolute(p)) {
    throw new ConfigError(`${label}: must be absolute ("${p}")`);
  }
  let real: string;
  try {
    real = fs.realpathSync(p);
  } catch {
    throw new ConfigError(`${label}: realpath failed ("${p}")`);
  }
  try {
    const st = fs.statSync(real);
    if (!st.isDirectory()) {
      throw new ConfigError(`${label}: not a directory ("${p}")`);
    }
  } catch (e) {
    if (e instanceof ConfigError) throw e;
    throw new ConfigError(`${label}: stat failed ("${p}")`);
  }
  return real;
}

/**
 * Assert `outPath` resolves strictly outside `projectRealpath`. Symlinks that
 * point back into the project are rejected via realpath. The out parent must
 * exist and be readable. Maps to exit 10 on any violation.
 */
export function assertOutputOutsideProject(
  outPath: string,
  projectRealpath: string,
): string {
  if (!path.isAbsolute(outPath)) {
    throw new ConfigError(`out: must be absolute ("${outPath}")`);
  }
  const projReal = realpathDir(projectRealpath, "project");
  // out itself may not exist yet (it is created at write time); resolve its
  // parent, which must exist.
  const outParent = path.dirname(outPath);
  let outParentReal: string;
  try {
    outParentReal = fs.realpathSync(outParent);
  } catch {
    throw new ConfigError(`out: parent must exist and be readable ("${outParent}")`);
  }
  // Resolve out as far as possible; if it exists, follow symlinks.
  let outReal: string;
  try {
    outReal = fs.realpathSync(outPath);
  } catch {
    outReal = path.join(outParentReal, path.basename(outPath));
  }
  if (outReal === projReal || outReal.startsWith(projReal + path.sep)) {
    throw new ConfigError(
      `out: must be strictly outside project ("${outReal}" inside "${projReal}")`,
    );
  }
  if (outParentReal === projReal || outParentReal.startsWith(projReal + path.sep)) {
    throw new ConfigError(
      `out: parent must be outside project ("${outParentReal}" inside "${projReal}")`,
    );
  }
  return outReal;
}

// ---------------------------------------------------------------------------
// resolveConfig
// ---------------------------------------------------------------------------

/**
 * Validate `projectRealpath` (absolute, existing dir) and optional YAML config.
 * Returns the canonical TaskLensConfigV1. Default config when configPath
 * omitted. Exact-key schema; tokens are literal. Maps to exit 10 on violation.
 */
export async function resolveConfig(
  projectRealpath: string,
  configPath?: string,
): Promise<{ config: TaskLensConfigV1; projectRealpath: string; hash: string }> {
  const projReal = realpathDir(projectRealpath, "project");
  let config: TaskLensConfigV1;
  if (configPath === undefined || configPath === null || configPath === "") {
    config = defaultConfig();
  } else {
    if (!path.isAbsolute(configPath)) {
      throw new ConfigError(`config: must be absolute ("${configPath}")`);
    }
    let text: string;
    try {
      text = await Bun.file(configPath).text();
    } catch {
      throw new ConfigError(`config: unreadable ("${configPath}")`);
    }
    let raw: unknown;
    try {
      raw = Bun.YAML.parse(text);
    } catch (e) {
      throw new ConfigError(`config: YAML parse failed ("${configPath}"): ${(e as Error).message}`);
    }
    config = validateConfig(raw);
  }
  const hash = configHash(config);
  return { config, projectRealpath: projReal, hash };
}
