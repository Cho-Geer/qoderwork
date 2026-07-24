// scripts/task-lens/diff-extractor.ts
// REQ-002 — frozen working-tree / commit diff extraction with rename/delete
// preservation, plus REQ-004 canonical receipt/taskId computation.

import {
  type CommandRequest,
  type CommandResult,
  type CommandRunner,
  type DeletedRegion,
  type DiffHunk,
  type DiffHunkKind,
  type DiffInput,
  type DiffMode,
  type DiffModel,
  type ProviderMetadata,
  type RenameEntry,
  type ReceiptInput,
  type TaskInputReceipt,
  type Clock,
  INPUT_SCHEMA_VERSION,
  CONFIG_SCHEMA_VERSION,
  PROVIDER_PLACEHOLDER,
  ProcessFailure,
} from "./types.ts";
import { sha256Hex } from "./config.ts";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Empty diff — maps to exit 13. */
export class EmptyDiffError extends Error {
  constructor(message = "diff is empty") {
    super(message);
    this.name = "EmptyDiffError";
    this.exitCode = 13 as const;
  }
  readonly exitCode = 13;
}

/** Input/param error from diff extraction — maps to exit 10. */
export class DiffInputError extends Error {
  constructor(
    message: string,
    public readonly exitCode: 10 = 10,
  ) {
    super(message);
    this.name = "DiffInputError";
  }
}

const FULL_SHA_RE = /^[0-9a-f]{40}$/;

// ---------------------------------------------------------------------------
// Git command builders (fixed argv, `--` terminates options)
// ---------------------------------------------------------------------------

function revParseHead(): CommandRequest {
  // `HEAD^{commit}` is a literal ref (never user-supplied), so no `--` is
  // needed; rev-parse treats args after `--` as pathspecs, not revisions.
  return {
    executable: "git",
    args: ["rev-parse", "--verify", "HEAD^{commit}"],
    cwd: "",
  };
}

function revParseRef(ref: string): CommandRequest {
  // `ref` is already validated as a 40-hex full SHA (cannot start with `-`).
  return {
    executable: "git",
    args: ["rev-parse", "--verify", `${ref}^{commit}`],
    cwd: "",
  };
}

function statusPorcelain(): CommandRequest {
  return {
    executable: "git",
    args: ["status", "--porcelain", "-z"],
    cwd: "",
  };
}

function diffWorkingTree(): CommandRequest {
  return {
    executable: "git",
    args: [
      "diff",
      "--find-renames",
      "--no-ext-diff",
      "--no-color",
      "--unified=0",
      "HEAD",
      "--",
    ],
    cwd: "",
  };
}

function diffCommit(baseSha: string, headSha: string): CommandRequest {
  return {
    executable: "git",
    args: [
      "diff",
      "--find-renames",
      "--no-ext-diff",
      "--no-color",
      "--unified=0",
      `${baseSha}..${headSha}`,
      "--",
    ],
    cwd: "",
  };
}

function lsFilesUntracked(): CommandRequest {
  return {
    executable: "git",
    args: ["ls-files", "--others", "--exclude-standard", "-z", "--"],
    cwd: "",
  };
}

function withCwd(req: CommandRequest, cwd: string): CommandRequest {
  return { ...req, cwd };
}

// ---------------------------------------------------------------------------
// Diff parsing
// ---------------------------------------------------------------------------

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function stripPathMarker(line: string, marker: "a" | "b"): string {
  // `--- a/<path>` / `+++ b/<path>` ; `/dev/null` → ""
  const prefix = marker === "a" ? "--- a/" : "+++ b/";
  if (line === "--- /dev/null" || line === "+++ /dev/null") return "";
  if (line.startsWith(prefix)) return line.slice(prefix.length);
  return "";
}

interface ParsedSection {
  oldPath: string;
  newPath: string;
  kind: DiffHunkKind | undefined;
  similarity: number;
  hasRename: boolean;
  hunks: Array<{
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    removed: string[];
  }>;
}

interface ParsedDiff {
  hunks: DiffHunk[];
  renames: RenameEntry[];
  deletedRegions: DeletedRegion[];
}

function parseDiff(output: string): ParsedDiff {
  const lines = output.split("\n");
  const hunks: DiffHunk[] = [];
  const renames: RenameEntry[] = [];
  const deletedRegions: DeletedRegion[] = [];

  let section: ParsedSection | null = null;
  let curHunk: ParsedSection["hunks"][number] | null = null;

  const finalizeSection = () => {
    if (!section) return;
    if (section.hasRename) {
      renames.push({
        oldPath: section.oldPath,
        newPath: section.newPath,
        similarity: section.similarity,
      });
    }
    for (const h of section.hunks) {
      const kind: DiffHunkKind =
        section.kind ?? (section.hasRename ? "rename" : "modify");
      hunks.push({
        oldPath: section.oldPath,
        newPath: section.newPath,
        oldStart: h.oldStart,
        oldLines: h.oldLines,
        newStart: h.newStart,
        newLines: h.newLines,
        kind,
      });
      // DeletedRegion: any hunk that removed preimage lines (full delete or
      // partial removal). provenance is preimage-only — we never synthesize a
      // live seed from removed content.
      if (h.oldLines > 0 && h.removed.length > 0) {
        const startLine = h.oldStart;
        const endLine = h.oldStart + h.oldLines - 1;
        const excerpt = h.removed.join("\n");
        deletedRegions.push({
          oldPath: section.oldPath,
          startLine,
          endLine,
          excerptHash: sha256Hex(excerpt),
          provenance: "preimage-only",
        });
      }
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("diff --git ")) {
      finalizeSection();
      section = {
        oldPath: "",
        newPath: "",
        kind: undefined,
        similarity: 100,
        hasRename: false,
        hunks: [],
      };
      curHunk = null;
      // Fallback parse of a/old b/new (authoritative paths come from ---/+++).
      const m = line.match(/^diff --git a\/(.*) b\/(.*)$/);
      if (m) {
        section.oldPath = m[1]!;
        section.newPath = m[2]!;
      }
      continue;
    }
    if (!section) continue;
    if (line.startsWith("new file mode")) {
      section.kind = "add";
    } else if (line.startsWith("deleted file mode")) {
      section.kind = "delete";
    } else if (line.startsWith("rename from ")) {
      section.hasRename = true;
      section.oldPath = line.slice("rename from ".length);
    } else if (line.startsWith("rename to ")) {
      section.hasRename = true;
      section.newPath = line.slice("rename to ".length);
      if (section.kind === undefined) section.kind = "rename";
    } else if (line.startsWith("similarity index ")) {
      const pct = parseInt(line.slice("similarity index ".length), 10);
      if (Number.isFinite(pct)) section.similarity = pct;
    } else if (line.startsWith("--- ")) {
      const p = stripPathMarker(line, "a");
      if (p !== "") section.oldPath = p;
    } else if (line.startsWith("+++ ")) {
      const p = stripPathMarker(line, "b");
      if (p !== "") section.newPath = p;
    } else if (line.startsWith("@@ ")) {
      const m = line.match(HUNK_RE);
      if (m) {
        curHunk = {
          oldStart: parseInt(m[1]!, 10),
          oldLines: m[2] !== undefined ? parseInt(m[2], 10) : 1,
          newStart: parseInt(m[3]!, 10),
          newLines: m[4] !== undefined ? parseInt(m[4], 10) : 1,
          removed: [],
        };
        section.hunks.push(curHunk);
      }
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      if (curHunk) curHunk.removed.push(line.slice(1));
    } else if (line.startsWith("\\ No newline")) {
      // skip
    }
  }
  finalizeSection();

  return { hunks, renames, deletedRegions };
}

function parseUntracked(output: string): string[] {
  const paths = output.split("\0").filter((p) => p.length > 0);
  return paths;
}

// ---------------------------------------------------------------------------
// Canonical sorting + diffHash
// ---------------------------------------------------------------------------

function sortHunks(hunks: readonly DiffHunk[]): DiffHunk[] {
  return [...hunks].sort((a, b) => {
    if (a.oldPath !== b.oldPath) return a.oldPath < b.oldPath ? -1 : 1;
    if (a.newPath !== b.newPath) return a.newPath < b.newPath ? -1 : 1;
    if (a.oldStart !== b.oldStart) return a.oldStart - b.oldStart;
    return a.newStart - b.newStart;
  });
}

function sortRenames(renames: readonly RenameEntry[]): RenameEntry[] {
  return [...renames].sort((a, b) => {
    if (a.oldPath !== b.oldPath) return a.oldPath < b.oldPath ? -1 : 1;
    return a.newPath < b.newPath ? -1 : a.newPath > b.newPath ? 1 : 0;
  });
}

function sortDeleted(regions: readonly DeletedRegion[]): DeletedRegion[] {
  return [...regions].sort((a, b) => {
    if (a.oldPath !== b.oldPath) return a.oldPath < b.oldPath ? -1 : 1;
    return a.startLine - b.startLine;
  });
}

function sortUntracked(paths: readonly string[]): string[] {
  return [...paths].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function canonicalDiffJson(model: Omit<DiffModel, "diffHash">): string {
  return JSON.stringify({
    mode: model.mode,
    baseSha: model.baseSha,
    headSha: model.headSha,
    hunks: model.hunks.map((h) => ({
      oldPath: h.oldPath,
      newPath: h.newPath,
      oldStart: h.oldStart,
      oldLines: h.oldLines,
      newStart: h.newStart,
      newLines: h.newLines,
      kind: h.kind,
    })),
    untrackedFiles: [...model.untrackedFiles],
    renames: model.renames.map((r) => ({
      oldPath: r.oldPath,
      newPath: r.newPath,
      similarity: r.similarity,
    })),
    deletedRegions: model.deletedRegions.map((d) => ({
      oldPath: d.oldPath,
      startLine: d.startLine,
      endLine: d.endLine,
      excerptHash: d.excerptHash,
      provenance: d.provenance,
    })),
  });
}

// ---------------------------------------------------------------------------
// extractDiff
// ---------------------------------------------------------------------------

async function run(runner: CommandRunner, req: CommandRequest, cwd: string): Promise<CommandResult> {
  return runner(withCwd(req, cwd));
}

/**
 * Extract a frozen DiffModel from `input` using `runner` for all Git access.
 * working-tree: base=HEAD, tracked diff + untracked list.
 * commit: base=full SHA, head=current HEAD, worktree must be clean.
 * Throws DiffInputError (exit 10) / EmptyDiffError (exit 13) / ProcessFailure
 * (exit 20) appropriately.
 */
export async function extractDiff(
  input: DiffInput,
  runner: CommandRunner,
): Promise<DiffModel> {
  const project = input.projectRealpath;

  // Resolve current HEAD (full SHA).
  const headRes = await run(runner, revParseHead(), project);
  const headSha = headRes.stdout.trim();
  if (!FULL_SHA_RE.test(headSha)) {
    throw new DiffInputError(`headSha not a full SHA: "${headSha}"`);
  }

  let baseSha: string;
  let diffReq: CommandRequest;
  let untrackedReq: CommandRequest | null;

  if (input.mode === "commit") {
    if (!input.baseSha) {
      throw new DiffInputError("commit mode requires --base <full-sha>");
    }
    if (input.baseSha.startsWith("-") || !FULL_SHA_RE.test(input.baseSha)) {
      throw new DiffInputError(`--base must be a full 40-hex SHA: "${input.baseSha}"`);
    }
    // Resolve base to full SHA (rejects non-existent refs as ProcessFailure→20).
    const baseRes = await run(runner, revParseRef(input.baseSha), project);
    baseSha = baseRes.stdout.trim();
    if (!FULL_SHA_RE.test(baseSha)) {
      throw new DiffInputError(`baseSha not a full SHA: "${baseSha}"`);
    }
    // Worktree must be clean.
    const statusRes = await run(runner, statusPorcelain(), project);
    if (statusRes.stdout.length > 0) {
      throw new DiffInputError("commit mode requires a clean worktree");
    }
    diffReq = diffCommit(baseSha, headSha);
    untrackedReq = null;
  } else {
    baseSha = headSha;
    diffReq = diffWorkingTree();
    untrackedReq = lsFilesUntracked();
  }

  const diffRes = await run(runner, diffReq, project);
  const parsed = parseDiff(diffRes.stdout);

  let untracked: string[] = [];
  if (untrackedReq) {
    const untrackedRes = await run(runner, untrackedReq, project);
    untracked = parseUntracked(untrackedRes.stdout);
  }

  const hunks = sortHunks(parsed.hunks);
  const renames = sortRenames(parsed.renames);
  const deletedRegions = sortDeleted(parsed.deletedRegions);
  const untrackedFiles = sortUntracked(untracked);

  const modelWithoutHash: Omit<DiffModel, "diffHash"> = {
    mode: input.mode,
    baseSha,
    headSha,
    hunks,
    untrackedFiles,
    renames,
    deletedRegions,
  };
  const diffHash = sha256Hex(canonicalDiffJson(modelWithoutHash));

  if (
    hunks.length === 0 &&
    untrackedFiles.length === 0 &&
    renames.length === 0 &&
    deletedRegions.length === 0
  ) {
    throw new EmptyDiffError();
  }

  return { ...modelWithoutHash, diffHash };
}

// ---------------------------------------------------------------------------
// createInputReceipt (REQ-004)
// ---------------------------------------------------------------------------

function canonicalTaskIdJson(input: ReceiptInput, provider: ProviderMetadata): string {
  // Fixed field order; generatedAt excluded; taskId computed first as "".
  return JSON.stringify({
    schemaVersion: INPUT_SCHEMA_VERSION,
    projectRealpath: input.projectRealpath,
    mode: input.mode,
    baseSha: input.baseSha,
    headSha: input.headSha,
    diffHash: input.diffHash,
    configHash: input.configHash,
    coverageHash: input.coverageHash,
    provider: {
      name: provider.name,
      schemaVersion: provider.schemaVersion,
      available: provider.available,
      resolvedBy: provider.resolvedBy,
    },
  });
}

/**
 * Build a versioned TaskInputReceipt. `taskId` is SHA-256 of the canonical
 * JSON over the fixed input fields (excluding generatedAt). `clock` only fills
 * `generatedAt` and does NOT affect taskId.
 */
export function createInputReceipt(input: ReceiptInput, clock: Clock): TaskInputReceipt {
  const provider = input.provider ?? PROVIDER_PLACEHOLDER;
  const taskId = sha256Hex(canonicalTaskIdJson(input, provider));
  return {
    schemaVersion: INPUT_SCHEMA_VERSION,
    taskId,
    projectRealpath: input.projectRealpath,
    mode: input.mode,
    baseSha: input.baseSha,
    headSha: input.headSha,
    diffHash: input.diffHash,
    configHash: input.configHash,
    coverageHash: input.coverageHash,
    provider,
    configSchemaVersion: CONFIG_SCHEMA_VERSION,
    coverage: null,
    generatedAt: clock(),
  };
}

// Re-export ProcessFailure for callers that catch command failures.
export { ProcessFailure };
