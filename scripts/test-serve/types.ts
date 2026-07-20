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
  /** Run 根目录（与 paths.rootDir 相同，顶层冗余字段供 verifier 直接访问）。 */
  rootDir?: string;
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
export type P02Phase =
  | "reservations"
  | "coexistence"
  | "attribution"
  | "after-stop-a"
  | "cleanup";

// 某 run 的当前 process 状态（current inspection，而非 start-time 快照）。
export interface P02ProcessState {
  serveAlive: boolean;
  sseAlive: boolean;
  healthOk: boolean;
}

// sentinel marker 的可读性与身份字段（current inspection）。
export interface P02MarkerState {
  readable: boolean;
  alive: boolean;
  runId?: string;
  serveUrl?: string;
  eventFile?: string;
  sentinelId?: string;
  sentinelPid?: number | null;
}

export interface P02VerifyInput {
  runDirA: string;
  runDirB: string;
  mainFrameworkDbPath: string;
  sentinelMarkerPath: string;
  reservationPidA?: number | null;
  reservationPidB?: number | null;
  /** after-stop-a 必须提供 A 停止前的 serve/sse PID 证据；任一缺失为 aOldPidEvidenceAvailable FAIL。 */
  stoppedServePidA?: number | null;
  stoppedSsePidA?: number | null;
  /** 可选只读依赖注入；缺省时读取真实文件/进程。测试显式注入以摆脱宿主伪 PID。 */
  readers?: {
    /** 返回占用某端口的 PID；不可得（UNAVAILABLE）时返回 null。 */
    portOwnerReader?: (port: number) => number | null;
    /** 返回某 run 的当前 process 状态（serve/sse 存活 + 当前 health）。 */
    processReader?: (manifest: RunManifest) => P02ProcessState;
    /** 返回 sentinel marker 的可读性与身份字段。 */
    markerReader?: (manifest: RunManifest) => P02MarkerState;
  };
}

export interface P02VerificationResult {
  ok: boolean;
  phase: P02Phase;
  checks: Record<string, boolean>;
  failedChecks: string[];
}

// ====== P02 orchestrator types ======

export const P02_STAGES = [
  "create-a",
  "create-b",
  "verify-reservations",
  "start-sentinel",
  "start-a",
  "start-b",
  "verify-coexistence",
  "bootstrap-a",
  "verify-attribution",
  "stop-a",
  "verify-after-stop-a",
  "cleanup-a",
  "stop-b",
  "cleanup-b",
  "stop-sentinel",
  "verify-cleanup",
] as const;

export type P02StageName = (typeof P02_STAGES)[number];

export interface P02Input {
  primaryWorktree: string;
  mainFrameworkDbPath: string;
  commit: string;
  portA: number;
  portB: number;
  testId: string;
}

/** Sentinel identity 三态：FOUND=本 run 所有；NOT_FOUND=目标不存在/不匹配；UNAVAILABLE=证据不可读无法判定。 */
export type SentinelIdentityState = "FOUND" | "NOT_FOUND" | "UNAVAILABLE";

export interface P02SentinelMarker {
  sentinelId: string;
  pid: number;
  readyAt: string;
}

export interface P02StageResult {
  stage: P02StageName;
  startedAt: string;
  finishedAt: string;
  status: "ok" | "failed";
  /** start-a/start-b 阶段写入 StartChecks 供 verifyP02 读取。 */
  checks?: StartChecks;
  artifactPath?: string;
  error?: string;
}

export interface P02StageResultsFile {
  runIdA: string | null;
  runIdB: string | null;
  sentinelId: string | null;
  stages: P02StageResult[];
}

export interface SentinelStartResult {
  sentinelId: string;
  pid: number;
  markerPath: string;
}

/** cleanup-a 后对 B 的五项隔离观测。 */
export interface P02CleanupBObservation {
  bServeAlive: boolean;
  bSseAlive: boolean;
  bHealthOk: boolean;
  bMarkerReadable: boolean;
  sentinelAlive: boolean;
}

export interface P02Dependencies {
  // Run lifecycle (A/B)
  createRunContext?: (input: CreateRunInput) => Promise<RunManifest>;
  startRunProcesses?: (runDir: string) => Promise<StartRunResult>;
  bootstrapRun?: (input: BootstrapInput) => Promise<RunManifest>;
  stopRunProcesses?: (runDir: string) => Promise<RunManifest>;
  cleanupRun?: (runDir: string) => Promise<CleanupResult>;
  // Verifier
  verifyP02?: (input: P02VerifyInput, phase: P02Phase) => P02VerificationResult;
  // Sentinel
  startSentinel?: (markerPath: string, sentinelId: string, runA: RunManifest) => Promise<SentinelStartResult>;
  stopSentinel?: (pid: number, sentinelId: string, markerPath: string) => Promise<void>;
  // Cleanup-a B observation（默认读取真实进程/marker）
  observeCleanupB?: (runB: RunManifest, sentinelMarkerPath: string) => P02CleanupBObservation;
  // Sentinel identity validation: returns explicit tri-state (marker + /proc environ).
  validateSentinelIdentity?: (pid: number, sentinelId: string, markerPath: string) => SentinelIdentityState;
  // Utilities
  writeStageResults?: (artifactsDir: string, payload: P02StageResultsFile) => void;
  ensureFrameworkDb?: (dbPath: string) => void;
  now?: () => string;
}

export type P02Result =
  | {
      ok: true;
      status: "PASS";
      runDirA: string;
      runDirB: string;
      checks: {
        reservations: P02VerificationResult;
        coexistence: P02VerificationResult;
        attribution: P02VerificationResult;
        "after-stop-a": P02VerificationResult;
        cleanup: P02VerificationResult;
      };
      evidencePaths: {
        manifestA: string;
        manifestB: string;
        artifactsDirA: string;
        stageResults: string;
      };
    }
  | {
      ok: false;
      runDirA: string | null;
      runDirB: string | null;
      failedCheck: string;
      firstFailure: { stage: P02StageName; error: string };
      /** 已执行 stage 的 ledger，用于断言「失败 stage 后所有业务调用为 0」。 */
      stages: P02StageResult[];
      /**
       * 收敛 stop 阶段捕获的错误。主循环 stop 自身 throw 已计入 firstFailure；
       * 此处仅记录 safeConvergeFailure 对未停止对象尝试 stop 时的错误，保证可追溯（不静默吞掉）。
       */
      convergenceErrors?: Array<{ object: "sentinel" | "a" | "b"; error: string }>;
      evidencePaths: { stageResults: string | null };
    };
