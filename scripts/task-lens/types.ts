// scripts/task-lens/types.ts
// Task Lens M1 — shared type contracts (types only, no I/O).
// Defines all M1 interfaces used by PHASE-02..07. No runtime values except
// fixed schema-version string literals and the immutable GraphBudget default.

// ---------------------------------------------------------------------------
// Schema version literals
// ---------------------------------------------------------------------------

export const INPUT_SCHEMA_VERSION = "task-lens.input/v1" as const;
export const CONFIG_SCHEMA_VERSION = "task-lens.config/v1" as const;
export const TASK_GRAPH_SCHEMA_VERSION = "task-lens.task-graph/v1" as const;

// ---------------------------------------------------------------------------
// Exit codes (fail-closed). See blueprint §2.4.7.
// ---------------------------------------------------------------------------

export type TaskLensExitCode =
  | 0 // success
  | 1 // unclassified exception
  | 2 // degraded (coverage missing / truncation / only-deletion)
  | 10 // param / config / path invalid
  | 12 // provider unavailable
  | 13 // empty diff
  | 20 // subprocess failure / timeout / signal / truncation
  | 21; // artifact integrity failure

// ---------------------------------------------------------------------------
// Command runner contract (REQ-003-A)
// ---------------------------------------------------------------------------

/** Only these executables may ever be spawned. Anything else is a security failure. */
export type Executable = "git" | "codegraph";

/** Env keys retained from process.env; everything else is dropped. */
export const ENV_ALLOWLIST = ["PATH", "HOME", "USER", "LANG", "LC_ALL", "TMPDIR"] as const;

/** Env keys that must be removed even if they appear (loader-injection vectors). */
export const ENV_DENYLIST = [
  "NODE_OPTIONS",
  "BASH_ENV",
  "ENV",
  "LD_PRELOAD",
  "DYLD_INSERT_LIBRARIES",
  "BUN_OPTIONS",
] as const;

export const DEFAULT_TIMEOUT_MS = 30000;
export const MAX_TIMEOUT_MS = 30000;
export const DEFAULT_MAX_STDOUT_BYTES = 5242880; // 5 MiB
export const DEFAULT_MAX_STDERR_BYTES = 5242880; // 5 MiB
export const MAX_STDOUT_BYTES = 5242880;
export const MAX_STDERR_BYTES = 5242880;

/**
 * Fixed argv request. `args` is a readonly tuple passed verbatim to Bun.spawn
 * with `shell` omitted (Bun never spawns a shell). No user string is ever
 * concatenated into argv. `--` terminators are part of `args` where needed.
 */
export interface CommandRequest {
  readonly executable: Executable;
  readonly args: readonly string[];
  /** Absolute realpath used as cwd. */
  readonly cwd: string;
  /** 0 < timeoutMs <= 30000. Default/Max 30000. */
  readonly timeoutMs?: number;
  /** 0 < maxStdoutBytes <= 5242880. Default/Max 5 MiB. */
  readonly maxStdoutBytes?: number;
  /** 0 < maxStderrBytes <= 5242880. Default/Max 5 MiB. */
  readonly maxStderrBytes?: number;
  /** External cancellation signal; aborting terminates the process tree. */
  readonly signal?: AbortSignal | null;
  /** Optional stdin payload. A held-open ReadableStream makes the child block. */
  readonly stdin?: Blob | ReadableStream<Uint8Array> | null;
}

/** Receipt produced for every spawn — success or failure. Inspectable by tests. */
export interface CommandReceipt {
  readonly executable: Executable;
  /** The exact argv passed to Bun.spawn ([executable, ...args]). */
  readonly argv: readonly string[];
  /** Always false. Bun.spawn is invoked without `shell`. */
  readonly shell: false;
  /** Env keys actually supplied to the child (always the allowlist subset). */
  readonly env: readonly string[];
}

export interface CommandResult extends CommandReceipt {
  readonly exitCode: number;
  readonly signal: string | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly truncated: boolean;
  readonly timedOut: boolean;
}

export type CommandFailureKind =
  | "DISALLOWED_EXECUTABLE"
  | "NONZERO_EXIT"
  | "TIMEOUT"
  | "SIGNAL"
  | "TRUNCATED";

/**
 * Thrown by runCommand for every classified subprocess failure. Carries the
 * same receipt fields as a success so security checks (argv/shell) still work.
 * Maps to exit code 20.
 */
export class ProcessFailure extends Error implements CommandReceipt {
  public readonly argv: readonly string[];
  public readonly shell: false = false;
  public readonly env: readonly string[];
  constructor(
    public readonly kind: CommandFailureKind,
    public readonly executable: Executable,
    args: readonly string[],
    env: readonly string[],
    public readonly exitCode: number | null,
    public readonly signal: string | null,
    public readonly durationMs: number,
    public readonly truncated: boolean,
    public readonly timedOut: boolean,
    stderrSummary: string,
  ) {
    super(
      `ProcessFailure kind=${kind} executable=${executable} exit=${exitCode ?? "null"} signal=${signal ?? "null"} truncated=${truncated} timedOut=${timedOut} stderr=${stderrSummary.slice(0, 200)}`,
    );
    this.name = "ProcessFailure";
    this.argv = [executable, ...args];
    this.env = env;
  }
}

/** Function signature of runCommand; used for dependency injection in tests. */
export type CommandRunner = (request: CommandRequest) => Promise<CommandResult>;

// ---------------------------------------------------------------------------
// Config contract (REQ-003-B)
// ---------------------------------------------------------------------------

export type SideEffectKind = "DB" | "FS" | "NET" | "PROC";

export interface SideEffectToken {
  readonly kind: SideEffectKind;
  /** Literal string token — never compiled as regex, even if it contains metachars. */
  readonly token: string;
}

export interface TaskLensConfigV1 {
  readonly schemaVersion: typeof CONFIG_SCHEMA_VERSION;
  readonly entries: readonly string[];
  readonly sideEffectTokens: readonly SideEffectToken[];
}

/** Fixed graph search/display budget. YAML may not enlarge it. */
export interface GraphBudget {
  readonly maxNodes: 200;
  readonly maxEdges: 500;
  readonly maxFanout: 50;
  readonly maxDisplayNodes: 20;
}

export const DEFAULT_GRAPH_BUDGET: GraphBudget = {
  maxNodes: 200,
  maxEdges: 500,
  maxFanout: 50,
  maxDisplayNodes: 20,
};

// ---------------------------------------------------------------------------
// Diff contract (REQ-002)
// ---------------------------------------------------------------------------

export type DiffMode = "working-tree" | "commit";

export interface DiffInput {
  readonly projectRealpath: string;
  readonly mode: DiffMode;
  /** Required for mode="commit"; must be a full SHA, not starting with `-`. */
  readonly baseSha?: string;
}

export type DiffHunkKind = "add" | "modify" | "delete" | "rename";

export interface DiffHunk {
  readonly oldPath: string;
  readonly newPath: string;
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly kind: DiffHunkKind;
}

export interface RenameEntry {
  readonly oldPath: string;
  readonly newPath: string;
  readonly similarity: number;
}

export interface DeletedRegion {
  readonly oldPath: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly excerptHash: string;
  readonly provenance: "preimage-only";
}

export interface DiffModel {
  readonly mode: DiffMode;
  readonly baseSha: string;
  readonly headSha: string;
  /** Stable-sorted by (oldPath, newPath, oldStart, newStart). */
  readonly hunks: readonly DiffHunk[];
  /** Stable-sorted by path. */
  readonly untrackedFiles: readonly string[];
  /** Stable-sorted by (oldPath, newPath). */
  readonly renames: readonly RenameEntry[];
  /** Stable-sorted by (oldPath, startLine). */
  readonly deletedRegions: readonly DeletedRegion[];
  /** SHA-256 lowercase hex of the canonical diff representation. */
  readonly diffHash: string;
}

// ---------------------------------------------------------------------------
// Provider / graph contracts (used by PHASE-03+; defined here as the M1 spine)
// ---------------------------------------------------------------------------

export interface ProviderMetadata {
  readonly name: string;
  readonly schemaVersion: string | null;
  readonly available: boolean;
  readonly resolvedBy: string | null;
}

/** Placeholder provider for PHASE-02 (provider implemented in PHASE-03). */
export const PROVIDER_PLACEHOLDER: ProviderMetadata = {
  name: "unresolved",
  schemaVersion: null,
  available: false,
  resolvedBy: null,
};

export type Observation = "observed" | "not-observed" | "unknown";

export interface SideEffect {
  readonly kind: SideEffectKind;
  readonly token: string;
  readonly heuristic: "literal-source-scan";
}

export interface FunctionRange {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly signature: string;
}

export interface FunctionNode extends FunctionRange {
  readonly sideEffects: readonly SideEffect[];
  readonly observation: Observation;
}

export interface EdgeRef {
  readonly from: string;
  readonly to: string;
  readonly origin: "codegraph-static";
  readonly confidence: number | null;
  readonly resolvedBy: string | null;
}

export interface CallEdge extends EdgeRef {}

export interface SpineForest {
  readonly entries: readonly string[];
  readonly primaryPath: readonly string[];
  readonly seedBranches: readonly {
    readonly from: string;
    readonly path: readonly string[];
    readonly seedIds: readonly string[];
  }[];
  readonly uncoveredSeeds: readonly string[];
  readonly collapsedCount: number;
}

export interface TaskGraphV1 {
  readonly schemaVersion: typeof TASK_GRAPH_SCHEMA_VERSION;
  readonly taskId: string;
  readonly seeds: readonly string[];
  readonly deletedRegions: readonly DeletedRegion[];
  readonly nodes: readonly FunctionNode[];
  readonly edges: readonly CallEdge[];
  readonly spine: SpineForest;
  readonly truncation: readonly string[];
  readonly unverified: readonly string[];
}

// ---------------------------------------------------------------------------
// Input receipt contract (REQ-004)
// ---------------------------------------------------------------------------

export type Clock = () => string;

export interface ReceiptInput {
  readonly projectRealpath: string;
  readonly mode: DiffMode;
  readonly baseSha: string;
  readonly headSha: string;
  readonly diffHash: string;
  readonly configHash: string;
  readonly coverageHash: string | null;
  readonly provider: ProviderMetadata;
}

/**
 * Versioned input receipt. `taskId` is the SHA-256 of the canonical JSON over
 * {schemaVersion,projectRealpath,mode,baseSha,headSha,diffHash,configHash,
 * coverageHash,provider}. `generatedAt` (clock) is excluded from taskId so two
 * receipts with identical inputs share a taskId.
 */
export interface TaskInputReceipt {
  readonly schemaVersion: typeof INPUT_SCHEMA_VERSION;
  readonly taskId: string;
  readonly projectRealpath: string;
  readonly mode: DiffMode;
  readonly baseSha: string;
  readonly headSha: string;
  readonly diffHash: string;
  readonly configHash: string;
  readonly coverageHash: string | null;
  readonly provider: ProviderMetadata;
  readonly configSchemaVersion: typeof CONFIG_SCHEMA_VERSION;
  /** PHASE-02 always null; coverage is wired in PHASE-04. */
  readonly coverage: null;
  readonly generatedAt: string;
}

// ---------------------------------------------------------------------------
// CLI contract (REQ-004-B)
// ---------------------------------------------------------------------------

export type CliSubcommand = "generate" | "feedback" | "metrics";

export interface GenerateRequest {
  readonly subcommand: "generate";
  readonly project: string;
  readonly mode: DiffMode;
  readonly out: string;
  readonly config?: string;
  readonly coverage?: string;
  readonly base?: string;
  readonly entry?: string;
}

export interface FeedbackRequest {
  readonly subcommand: "feedback";
  readonly out: string;
  readonly taskId: string;
  readonly useful: boolean;
  readonly loadReduced: boolean;
  readonly issuesFound: number;
  readonly issuesGuidedByCard: number;
  readonly reviewMinutes: number;
  readonly notes?: string;
}

export interface MetricsRequest {
  readonly subcommand: "metrics";
  readonly action: "summarize";
  readonly out: string;
}

export type CliRequest = GenerateRequest | FeedbackRequest | MetricsRequest;

/** Thrown by parseCli for any grammar/param violation; maps to exit 10. */
export class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: 10 = 10,
  ) {
    super(message);
    this.name = "CliError";
  }
}

/** Internal result for `generate` when the input stage is captured but the
 * downstream graph/card pipeline is not yet implemented (PHASE-02). */
export interface NotImplementedAfterInput {
  readonly status: "NOT_IMPLEMENTED_AFTER_INPUT";
  readonly receipt: TaskInputReceipt;
}
