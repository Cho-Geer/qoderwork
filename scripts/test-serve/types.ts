export const RUN_STATES = [
  "CREATED",
  "WORKTREE_READY",
  "READY",
  "BOOTSTRAPPED",
  "EXECUTED",
  "STOPPED",
  "CLEANED",
  "BLOCKED",
  "FAILED",
] as const;

export type GitWorktreeRemoveSpawnResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export interface CreateRunHooks {
  /** Called after git worktree add succeeds (and overlay applied) but before WORKTREE_READY. Throw to simulate failure. */
  afterWorktreeReady?: (paths: RunPaths) => void | Promise<void>;
  /** Test-only fault injection for a reserver that remains alive during create cleanup. */
  releasePortReservation?: (pid: number) => Promise<void>;
}

export type CleanupResult = {
  runId: string;
  archivedLogs: string | null;
  evidenceRoot: string;
  manifestPath: string;
  cleanupReportPath: string;
  artifactsDir: string;
} & (
  | { ok: true }
  | {
      ok: false;
      exitCode: number;
      stderr: string;
      stdout: string;
    }
);

export type ReadyResult = { ok: true } | { ok: false, reason: string, stderr: string };
export type RunState = (typeof RUN_STATES)[number];

export interface OverlayManifestFile {
  path: string;
  size: number;
  sha256: string;
}

export interface SourceOverlayManifest {
  createdAt: string;
  sourceCommit: string;
  sourceStatusPorcelainZ: string;
  patchSha256: string;
  tarSha256: string;
  untrackedFiles: OverlayManifestFile[];
}

export interface SourceOverlayMetadata {
  dir: string;
  manifestPath: string;
  patchPath: string;
  tarPath: string;
  manifestSha256: string;
  patchSha256: string;
  tarSha256: string;
}

export interface RunPaths {
  rootDir: string;
  manifestPath: string;
  worktreeDir: string;
  dbDir: string;
  frameworkDbPath: string;
  opencodeDbPath: string;
  logsDir: string;
  frameworkLogDir: string;
  serveLogPath: string;
  sseLogPath: string;
  eventsDir: string;
  eventFilePath: string;
  sseReadyPath: string;
  archiveDir: string;
  pidsDir: string;
  servePidPath: string;
  ssePidPath: string;
  artifactsDir: string;
  cleanupReportPath: string;
}

export interface StartChecks {
  health: boolean;
  serveIdentity: boolean;
  sseIdentity: boolean;
  sseReady: boolean;
}

export interface StartRunResult {
  manifest: RunManifest;
  checks: StartChecks;
}

export type P01bVerificationPhase = "runtime" | "cleanup";

export interface P01bVerificationResult {
  ok: boolean;
  phase: P01bVerificationPhase;
  checks: Record<string, boolean>;
  failedChecks: string[];
}       

export interface RunManifest {
  runId: string;
  testId: string;
  status: RunState;
  createdAt: string;
  updatedAt: string;
  primaryWorktree: string;
  commit: string;
  port: number;
  paths: RunPaths;
  env: Record<string, string>;
  sourceOverlay: SourceOverlayMetadata | null;
  sourceStatusPorcelainZ: string | null;
  rootSessionId: string | null;
  childSessionId: string | null;
  grantId: string | null;
  dispatchKey: string | null;
  allowedPaths: string[];
  bootstrapComplete: boolean;
  authorization: {
    h2Authorized: boolean;
    dryRun: boolean;
  };
  process: {
    servePid: number | null;
    ssePid: number | null;
    portReserverPid: number | null;
  };
  cleanup: {
    status: "pending" | "completed" | "blocked";
    notes: string[];
  };
}

export interface CreateRunInput {
  primaryWorktree: string;
  commit: string;
  port: number;
  testId: string;
  sourceOverlayDir?: string;
}

export interface SnapshotSourceInput {
  primaryWorktree: string;
  outputDir: string;
  allowDirtySource?: boolean;
}

export interface BootstrapInput {
  runDir: string;
  rootAgent: string;
  childAgent: string;
  allowedPaths: string[];
  reason: string;
}

export interface ExecuteInput {
  runDir: string;
  mode: "plan" | "live";
  runnerScript?: string;
  runnerArgs: string[];
}
