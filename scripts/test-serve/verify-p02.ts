// P0-2 Phase 1: fail-closed cross-run isolation verifier (reservations + attribution).
// 三态 FOUND/NOT_FOUND/UNAVAILABLE：负向查询必须命中「NOT_FOUND」才算隔离，缺失/UNAVAILABLE 一律 FAIL。
// 只能读取：manifest、stage results、DB(readonly)、events、sentinel marker；绝不写。oracle.ts 保持只读布尔 API 不变。
import { existsSync, readFileSync, readdirSync, readlinkSync, realpathSync } from "node:fs";
import { join, relative, resolve, isAbsolute } from "node:path";
import { Database } from "bun:sqlite";
import { readRunManifest } from "./run-context";
import type { RunManifest, P02Phase, P02VerifyInput, P02VerificationResult } from "./types";
import {
  findSessionEvent,
  grantBoundTo,
} from "./oracle";

function isProcessAlive(pid: number | null | undefined): boolean {
  if (pid == null) return false;
  try {
    return existsSync(`/proc/${pid}`);
  } catch {
    return false;
  }
}

function readSentinelAlive(sentinelMarkerPath: string): boolean {
  if (!existsSync(sentinelMarkerPath)) return false;
  try {
    const marker = JSON.parse(readFileSync(sentinelMarkerPath, "utf8")) as { pid?: number };
    return isProcessAlive(marker.pid);
  } catch {
    return false;
  }
}

// 假设 2：编排器在 start-a/start-b 的 stage results 中嵌入 checks（StartChecks）
function startChecksAllTrue(manifest: RunManifest, stage: string): boolean {
  const path = join(manifest.paths.artifactsDir, "p0-2-stage-results.json");
  if (!existsSync(path)) return false;
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as {
      stages?: Array<{ stage: string; checks?: Record<string, boolean> }>;
    };
    const found = data.stages?.find((s) => s.stage === stage);
    const c = found?.checks;
    return Boolean(c?.health && c?.serveIdentity && c?.sseIdentity && c?.sseReady);
  } catch {
    return false;
  }
}

// 缺失 manifest 是 fail-closed 的硬失败：返回 {readable:false} 而非抛出，
// 让 cleanup 阶段的 aManifestReadable/bManifestReadable 检查捕获，而不是让整个 verifyP02 崩溃。
function safeReadManifest(runDir: string): { manifest: RunManifest | null; readable: boolean } {
  try {
    return { manifest: readRunManifest(runDir), readable: true };
  } catch {
    return { manifest: null, readable: false };
  }
}

function cleanupReportSuccess(reportPath: string): boolean {
  if (!existsSync(reportPath)) return false;
  try {
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    return report.success === true;
  } catch {
    return false;
  }
}

// 只读三态裁决：文件缺失/表缺失/查询失败 → UNAVAILABLE；命中 → FOUND；无命中 → NOT_FOUND。
type TriState = "FOUND" | "NOT_FOUND" | "UNAVAILABLE";

const RUN_PATH_FIELDS = [
  "rootDir", "manifestPath", "worktreeDir", "dbDir", "frameworkDbPath",
  "opencodeDbPath", "logsDir", "frameworkLogDir", "serveLogPath", "sseLogPath",
  "eventsDir", "eventFilePath", "sseReadyPath", "archiveDir", "pidsDir",
  "servePidPath", "ssePidPath", "artifactsDir", "cleanupReportPath",
] as const;

function queryTriState(dbPath: string, sql: string, param: string): TriState {
  if (!param) return "UNAVAILABLE";
  if (!existsSync(dbPath)) return "UNAVAILABLE";
  let db: Database | null = null;
  try {
    db = new Database(dbPath, { readonly: true, create: false });
    const row = db.query(sql).get(param);
    return row ? "FOUND" : "NOT_FOUND";
  } catch {
    return "UNAVAILABLE";
  } finally {
    db?.close();
  }
}

function sdkSessionState(dbPath: string, sessionId: string): TriState {
  return queryTriState(dbPath, "SELECT id FROM session WHERE id = ?", sessionId);
}
function sessionMapState(dbPath: string, sessionId: string): TriState {
  return queryTriState(dbPath, "SELECT session_id FROM session_map WHERE session_id = ?", sessionId);
}
function grantState(dbPath: string, grantId: string): TriState {
  return queryTriState(dbPath, "SELECT id FROM dispatch_privilege_grants WHERE id = ?", grantId);
}
function eventState(eventFilePath: string, sessionId: string): TriState {
  if (!sessionId) return "UNAVAILABLE";
  if (!existsSync(eventFilePath)) return "UNAVAILABLE";
  try {
    return findSessionEvent(eventFilePath, sessionId) ? "FOUND" : "NOT_FOUND";
  } catch {
    return "UNAVAILABLE";
  }
}
// 证据可用性：文件存在且可 readonly 打开即视为可读；缺失 → false（UNAVAILABLE）。
function dbAvailable(dbPath: string): boolean {
  if (!existsSync(dbPath)) return false;
  let db: Database | null = null;
  try {
    db = new Database(dbPath, { readonly: true, create: false });
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

// 路径 containment：candidate 必须解析在 root 之内；逃逸(..)、绝对结果或真实路径(symlink)越界均失败。
function pathContained(root: string, candidate: string): boolean {
  if (!root || !candidate) return false;
  const rRoot = resolve(root);
  const rCand = resolve(candidate);
  const rel = relative(rRoot, rCand);
  if (rel === "") return true;
  if (rel.startsWith("..") || isAbsolute(rel)) return false;
  if (existsSync(rCand)) {
    try {
      const sub = relative(realpathSync(rRoot), realpathSync(rCand));
      if (sub.startsWith("..") || isAbsolute(sub)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

// 端口归属读取（默认读 /proc；测试注入以摆脱宿主伪 PID）。不可得 → null → 视为 UNAVAILABLE。
function defaultPortOwnerReader(port: number): number | null {
  try {
    const localHex = port.toString(16).padStart(4, "0").toUpperCase();
    const tcp = `${readFileSync("/proc/net/tcp", "utf8")}\n${readFileSync("/proc/net/tcp6", "utf8")}`;
    for (const line of tcp.split("\n").slice(1)) {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 10) continue;
      const [_, p] = cols[1].split(":");
      if (p !== localHex) continue;
      const inode = cols[9];
      for (const pidDir of readdirSync("/proc")) {
        if (!/^\d+$/.test(pidDir)) continue;
        try {
          for (const fd of readdirSync(join("/proc", pidDir, "fd"))) {
            if (readlinkSync(join("/proc", pidDir, "fd", fd)).includes(`socket:[${inode}]`)) {
              return Number(pidDir);
            }
          }
        } catch {
          /* 进程已退出或权限不足 */
        }
      }
    }
  } catch {
    /* /proc 不可用 */
  }
  return null;
}

export function verifyP02(input: P02VerifyInput, phase: P02Phase): P02VerificationResult {
  if (!input || !phase) throw new Error("input and phase are required");
  const valid: P02Phase[] = ["reservations", "coexistence", "attribution", "after-stop-a", "cleanup"];
  if (!valid.includes(phase)) throw new Error(`invalid phase: ${phase}`);

  const readA = safeReadManifest(input.runDirA);
  const readB = safeReadManifest(input.runDirB);
  const manifestA = readA.manifest;
  const manifestB = readB.manifest;
  const checks: Record<string, boolean> = {};
  const failedChecks: string[] = [];
  const check = (name: string, fn: () => boolean): boolean => {
    let ok = false;
    try {
      ok = fn();
    } catch {
      ok = false;
    }
    checks[name] = ok;
    if (!ok) failedChecks.push(name);
    return ok;
  };
  // cleanup 阶段自行用 readable 标志处理缺失 manifest；其余阶段以 manifest 为唯一真源，
  // 缺失时直接 fail-closed（不引入计划外的 check 名）。
  if (phase !== "cleanup" && (!manifestA || !manifestB)) {
    return { ok: false, phase, checks, failedChecks };
  }
  // 非 cleanup 阶段已保证 manifest 非空；用非 null 别名供 check 闭包捕获（闭包不继承外层窄化）。
  const mfa = manifestA!;
  const mfb = manifestB!;
  const pidA = input.reservationPidA ?? null;
  const pidB = input.reservationPidB ?? null;

  const portOwnerReader = input.readers?.portOwnerReader ?? defaultPortOwnerReader;
  if (phase === "reservations") {
    const pa = mfa.paths, pb = mfb.paths;
    const rootA = pa.rootDir, rootB = pb.rootDir;
    const asStr = pa as unknown as Record<string, string>;
    const bsStr = pb as unknown as Record<string, string>;
    check("runIdDistinct", () => mfa.runId !== mfb.runId);
    check("portDistinct", () => mfa.port !== mfb.port);
    for (const f of RUN_PATH_FIELDS) {
      check(`pathDistinct.${f}`, () => asStr[f] !== bsStr[f]);
    }
    for (const f of RUN_PATH_FIELDS) {
      check(`pathContainedA.${f}`, () => pathContained(rootA, asStr[f]));
    }
    for (const f of RUN_PATH_FIELDS) {
      check(`pathContainedB.${f}`, () => pathContained(rootB, bsStr[f]));
    }
    check("reservationPidDistinct", () => pidA !== pidB);
    check("reservationPidAAlive", () => isProcessAlive(pidA));
    check("reservationPidBAlive", () => isProcessAlive(pidB));
    // 端口归属三态：A reservation 必须真实持有 portA；UNAVAILABLE(null) → FAIL。
    check("reservationPortAOwned", () => portOwnerReader(mfa.port) === pidA);
  } else if (phase === "coexistence") {
    check("aReady", () => mfa.status === "READY");
    check("bReady", () => mfb.status === "READY");
    check("aStartChecks", () => startChecksAllTrue(mfa, "start-a"));
    check("bStartChecks", () => startChecksAllTrue(mfb, "start-b"));
    check("reserverAExited", () => !isProcessAlive(pidA));
    check("reserverBExited", () => !isProcessAlive(pidB));
    check("manifestReserverNull",
      () => mfa.process.portReserverPid === null && mfb.process.portReserverPid === null);
    check("serveSsePidDistinct", () => {
      const ids = [mfa.process.servePid, mfa.process.ssePid, mfb.process.servePid, mfb.process.ssePid];
      return ids.every((id) => id != null) && new Set(ids).size === ids.length;
    });
    check("sentinelAlive", () => readSentinelAlive(input.sentinelMarkerPath));
  } else if (phase === "attribution") {
    const a = mfa, b = mfb;
    const root = a.rootSessionId ?? "";
    const child = a.childSessionId ?? "";
    const grant = a.grantId ?? "";
    const main = input.mainFrameworkDbPath;
    // 顺序短路：A 标识非空 → A 证据可用 → A 正向 → B 证据可用 → B 负向 → 主库负向 → grant 绑定。
    check("aRootNonEmpty", () => root !== "");
    check("aChildNonEmpty", () => child !== "");
    check("aGrantNonEmpty", () => grant !== "");
    if (check("aSdkEvidenceAvailable", () => dbAvailable(a.paths.opencodeDbPath))) {
      check("aSdkPositive", () =>
        sdkSessionState(a.paths.opencodeDbPath, root) === "FOUND" &&
        sdkSessionState(a.paths.opencodeDbPath, child) === "FOUND");
    }
    if (check("aFrameworkEvidenceAvailable", () => dbAvailable(a.paths.frameworkDbPath))) {
      check("aFrameworkPositive", () =>
        sessionMapState(a.paths.frameworkDbPath, root) === "FOUND" &&
        sessionMapState(a.paths.frameworkDbPath, child) === "FOUND");
    }
    if (check("aEventsEvidenceAvailable", () => existsSync(a.paths.eventFilePath))) {
      check("aEventsPositive", () =>
        eventState(a.paths.eventFilePath, root) === "FOUND" &&
        eventState(a.paths.eventFilePath, child) === "FOUND");
    }
    // B 负向：store 必须可读（UNAVAILABLE → 失败，不视为不存在）且查询为 NOT_FOUND。
    if (check("bSdkEvidenceAvailable", () => dbAvailable(b.paths.opencodeDbPath))) {
      check("bSdkNegative", () =>
        sdkSessionState(b.paths.opencodeDbPath, root) === "NOT_FOUND" &&
        sdkSessionState(b.paths.opencodeDbPath, child) === "NOT_FOUND");
    }
    if (check("bFrameworkEvidenceAvailable", () => dbAvailable(b.paths.frameworkDbPath))) {
      check("bFrameworkNegative", () =>
        sessionMapState(b.paths.frameworkDbPath, root) === "NOT_FOUND" &&
        sessionMapState(b.paths.frameworkDbPath, child) === "NOT_FOUND");
    }
    if (check("bEventsEvidenceAvailable", () => existsSync(b.paths.eventFilePath))) {
      check("bEventsNegative", () =>
        eventState(b.paths.eventFilePath, root) === "NOT_FOUND" &&
        eventState(b.paths.eventFilePath, child) === "NOT_FOUND");
    }
    if (check("mainFrameworkEvidenceAvailable", () => dbAvailable(main))) {
      check("mainFrameworkNegative", () =>
        sessionMapState(main, root) === "NOT_FOUND" &&
        sessionMapState(main, child) === "NOT_FOUND" &&
        grantState(main, grant) === "NOT_FOUND");
    }
    // grant 必须绑定到 A 的 child session；缺失/错绑 → FAIL。
    check("aGrantBound",
      () => existsSync(a.paths.frameworkDbPath) && grantBoundTo(a.paths.frameworkDbPath, grant, child));
  } else if (phase === "after-stop-a") {
    const a = mfa, b = mfb;
    check("aStopped", () => a.status === "STOPPED");
    check("aServePidNull", () => a.process.servePid === null);
    check("aSsePidNull", () => a.process.ssePid === null);
    check("bReady", () => b.status === "READY");
    check("bStartChecks", () => startChecksAllTrue(b, "start-b"));
    check("bSseReadyValid", () => existsSync(b.paths.sseReadyPath));
    check("sentinelAlive", () => readSentinelAlive(input.sentinelMarkerPath));
  } else if (phase === "cleanup") {
    check("aManifestReadable", () => readA.readable);
    check("bManifestReadable", () => readB.readable);
    // manifest 缺失时只报告 readable 失败，跳过依赖 manifest 内容的检查（无法计算即不误判）。
    if (manifestA) {
      check("aCleaned", () => manifestA.status === "CLEANED");
      check("aWorktreeRemoved", () => !existsSync(manifestA.paths.worktreeDir));
      check("aCleanupReportSuccess", () => cleanupReportSuccess(manifestA.paths.cleanupReportPath));
    }
    if (manifestB) {
      check("bCleaned", () => manifestB.status === "CLEANED");
      check("bWorktreeRemoved", () => !existsSync(manifestB.paths.worktreeDir));
      check("bCleanupReportSuccess", () => cleanupReportSuccess(manifestB.paths.cleanupReportPath));
    }
    check("sentinelExited", () => !readSentinelAlive(input.sentinelMarkerPath));
  }

  return { ok: failedChecks.length === 0, phase, checks, failedChecks };
}
