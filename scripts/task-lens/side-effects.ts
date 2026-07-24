// scripts/task-lens/side-effects.ts
// PHASE-04: Literal side-effect detector.
// Scans function source text for builtin and config-supplied literal tokens.

import type { SideEffectKind, SideEffectToken, TaskLensConfigV1 } from "./types.ts";

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/** A detected side effect with provenance information. */
export interface DetectedSideEffect {
  readonly kind: SideEffectKind;
  readonly token: string;
  /** Whether this token came from builtins or user config. */
  readonly source: "builtin" | "config";
  /** Always true for literal-scan detection. */
  readonly heuristic: true;
}

// ---------------------------------------------------------------------------
// Builtin literal tokens
// ---------------------------------------------------------------------------

interface BuiltinToken {
  kind: SideEffectKind;
  token: string;
}

const BUILTIN_TOKENS: readonly BuiltinToken[] = [
  // DB
  { kind: "DB", token: "bun:sqlite" },
  // FS
  { kind: "FS", token: "node:fs" },
  { kind: "FS", token: "Bun.file(" },
  { kind: "FS", token: "Bun.write(" },
  // NET
  { kind: "NET", token: "fetch(" },
  { kind: "NET", token: "Bun.serve(" },
  // PROC
  { kind: "PROC", token: "Bun.spawn(" },
  { kind: "PROC", token: "Bun.spawnSync(" },
  { kind: "PROC", token: "node:child_process" },
  { kind: "PROC", token: "process.env" },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect side effects in source code by scanning for literal tokens.
 *
 * Builtin tokens (DB, FS, NET, PROC) are always checked. Config-supplied
 * tokens are appended (they do NOT replace builtins). Detection is pure
 * text search — no regex, no AST.
 *
 * Results are sorted by (kind, token, source) and deduplicated.
 *
 * @param source - The source text of a function (e.g. FunctionNode.source).
 * @param config - TaskLensConfigV1 with optional sideEffectTokens.
 * @returns Deduplicated, sorted list of detected side effects.
 */
export function detectSideEffects(
  source: string,
  config: TaskLensConfigV1,
): DetectedSideEffect[] {
  const results: DetectedSideEffect[] = [];

  // Collect all tokens: builtins first, then config tokens
  const allTokens: { kind: SideEffectKind; token: string; source: "builtin" | "config" }[] = [];

  for (const bt of BUILTIN_TOKENS) {
    allTokens.push({ kind: bt.kind, token: bt.token, source: "builtin" });
  }

  for (const ct of config.sideEffectTokens) {
    // Only append config tokens; do NOT replace builtins
    allTokens.push({ kind: ct.kind, token: ct.token, source: "config" });
  }

  // Scan source for each token
  for (const entry of allTokens) {
    if (source.includes(entry.token)) {
      results.push({
        kind: entry.kind,
        token: entry.token,
        source: entry.source,
        heuristic: true,
      });
    }
  }

  // Deduplicate by (kind, token)
  const seen = new Set<string>();
  const deduped: DetectedSideEffect[] = [];
  for (const r of results) {
    const key = `${r.kind}:${r.token}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(r);
    }
  }

  // Sort by kind → token → source
  deduped.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    if (a.token !== b.token) return a.token.localeCompare(b.token);
    return a.source.localeCompare(b.source);
  });

  return deduped;
}
