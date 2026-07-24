// scripts/task-lens/seed-resolver.ts
// PHASE-03: resolveSeeds — live hunks ∩ function/method ranges → stable seeds.

import type { DiffHunk, FunctionRange } from "./types.ts";

export interface Seed {
  readonly id: string;
  readonly file: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly hunkIds: readonly string[];
}

export interface SeedResolution {
  readonly seeds: readonly Seed[];
  readonly state: "FOUND" | "NOT_FOUND";
}

/**
 * Resolve live seeds by intersecting diff hunks with function/method ranges.
 * - add/modify hunks use [newStart, newStart+newLines-1] inclusive range.
 * - newLines=0 produces no live seed.
 * - delete-only hunks do not produce seeds (DeletedRegion handled downstream).
 * - Seeds are deduplicated by (file, startLine, endLine) and sorted by
 *   (file, startLine, endLine, id).
 */
export function resolveSeeds(
  hunks: readonly DiffHunk[],
  ranges: readonly FunctionRange[],
): SeedResolution {
  const seeds: Seed[] = [];
  const seen = new Set<string>();

  for (const hunk of hunks) {
    // Only add and modify hunks can produce live seeds
    if (hunk.kind !== "add" && hunk.kind !== "modify") continue;
    // newLines=0 does not produce a live seed
    if (hunk.newLines === 0) continue;

    const hunkStart = hunk.newStart;
    const hunkEnd = hunk.newStart + hunk.newLines - 1;

    // Find intersecting ranges for this hunk's file
    for (const range of ranges) {
      if (range.file !== hunk.newPath) continue;
      // Inclusive intersection
      if (range.startLine <= hunkEnd && range.endLine >= hunkStart) {
        const hunkId = `${hunk.newPath}:${hunk.newStart}`;
        const seedKey = `${range.file}:${range.startLine}:${range.endLine}:${range.id}`;
        if (seen.has(seedKey)) {
          // Merge hunkIds into existing seed
          const existing = seeds.find((s) => `${s.file}:${s.startLine}:${s.endLine}:${s.id}` === seedKey);
          if (existing && !existing.hunkIds.includes(hunkId)) {
            const idx = seeds.indexOf(existing);
            seeds[idx] = {
              ...existing,
              hunkIds: [...existing.hunkIds, hunkId].sort(),
            };
          }
        } else {
          seen.add(seedKey);
          seeds.push({
            id: range.id,
            file: range.file,
            startLine: range.startLine,
            endLine: range.endLine,
            hunkIds: [hunkId],
          });
        }
      }
    }
  }

  // Sort by file, startLine, endLine, id
  seeds.sort((a, b) =>
    a.file === b.file
      ? a.startLine === b.startLine
        ? a.endLine === b.endLine
          ? a.id.localeCompare(b.id)
          : a.endLine - b.endLine
        : a.startLine - b.startLine
      : a.file.localeCompare(b.file),
  );

  return {
    seeds,
    state: seeds.length > 0 ? "FOUND" : "NOT_FOUND",
  };
}
