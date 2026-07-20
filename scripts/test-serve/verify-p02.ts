// P0-2 Phase 1: fail-closed cross-run isolation verifier (reservations + attribution).
// 三态 FOUND/NOT_FOUND/UNAVAILABLE：负向查询必须命中「NOT_FOUND」才算隔离，缺失/UNAVAILABLE 一律 FAIL。
// 只能读取：manifest、stage results、DB(readonly)、events、sentinel marker；绝不写。oracle.ts 保持只读布尔 API 不变。
import { existsSync, readFileSync, readdirSync, readlinkSync, realpathSync } from "node:fs";
import { join, relative, resolve, isAbsolute } from "node:path";
import { Database } from "bun:sqlite";
import { readRunManifest } from "./run-context";
import type { RunManifest, P02Phase, P02VerifyInput, P02VerificationResult, P02ProcessState, P02MarkerState } from "./types";
import { grantBoundTo } from "./oracle";

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

// cleanup report 可读性：文件存在且 JSON 可解析；不可解析/缺失一律 false（fail-closed）。
function reportReadable(reportPath: string): boolean {
  if (!existsSync(reportPath)) return false;
  try {
    JSON.parse(readFileSync(reportPath, "utf8"));
    return true;
  } catch {
    return false;
  }
}

// cleanup report 语义：success === true && worktreeRemoved === true；不可读直接 false。
function reportSuccess(reportPath: string): boolean {
  if (!reportReadable(reportPath)) return false;
  try {
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    return report.success === true && report.worktreeRemoved === true;
  } catch {
    return false;
  }
}

// sentinel marker 身份一致性：marker 可读、PID 存活、sentinelId 存在，且 runId/serveUrl/eventFile 与 run manifest 一致。
function markerIdentityOk(m: P02MarkerState, manifest: RunManifest): boolean {
  if (!m.readable || !m.alive || !m.sentinelId) return false;
  if (m.runId !== manifest.runId) return false;
  const expectedServeUrl = `http://127.0.0.1:${manifest.port}`;
  if (m.serveUrl !== expectedServeUrl) return false;
  if (m.eventFile !== manifest.paths.eventFilePath) return false;
  return true;
}

// 缺省 process reader：以 manifest 存储 PID 做 /proc 存活探测，health 取自 stage results（current observation）。
function defaultProcessReader(manifest: RunManifest): P02ProcessState {
  return {
    serveAlive: isProcessAlive(manifest.process.servePid),
    sseAlive: isProcessAlive(manifest.process.ssePid),
    healthOk: startChecksAllTrue(manifest, "start-a") || startChecksAllTrue(manifest, "start-b"),
  };
}

// 缺省 marker reader：读取 sentinel marker 文件，解析身份与存活。
function defaultMarkerReader(manifest: RunManifest, markerPath: string): P02MarkerState {
  if (!existsSync(markerPath)) return { readable: false, alive: false };
  try {
    const marker = JSON.parse(readFileSync(markerPath, "utf8")) as {
      sentinelId?: string; pid?: number; runId?: string; serveUrl?: string; eventFile?: string;
    };
    const pid = marker.pid ?? null;
    return {
      readable: true,
      alive: isProcessAlive(pid),
      runId: marker.runId,
      serveUrl: marker.serveUrl,
      eventFile: marker.eventFile,
      sentinelId: marker.sentinelId,
      sentinelPid: pid,
    };
  } catch {
    return { readable: false, alive: false };
  }
}

// 只读三态裁决：文件缺失/表缺失/查询失败 → UNAVAILABLE；命中 → FOUND；无命中 → NOT_FOUND。
type TriState = "FOUND" | "NOT_FOUND" | "UNAVAILABLE";

// 19 字段 literal ledger：reservations 据此生成 57 个 field case（pathDistinct/pathContainedA/pathContainedB 各 19）。
export const RUN_PATH_FIELDS = [
  "rootDir", "manifestPath", "worktreeDir", "dbDir", "frameworkDbPath",
  "opencodeDbPath", "logsDir", "frameworkLogDir", "serveLogPath", "sseLogPath",
  "eventsDir", "eventFilePath", "sseReadyPath", "archiveDir", "pidsDir",
  "servePidPath", "ssePidPath", "artifactsDir", "cleanupReportPath",
] as const;

// 三态查询：缺 DB、空 identifier、readonly 打开失败、表缺失、SQL 错误均 → UNAVAILABLE。
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

// 证据可用性 probe：对目标表做 readonly 探测；缺 DB 或表缺失或任何错误 → UNAVAILABLE。
// 用于 *EvidenceAvailable 检查：UNAVAILABLE 时必须立即短路，不再跑同 store 的 positive/negative。
function tableAvailable(dbPath: string, table: string): TriState {
  if (!existsSync(dbPath)) return "UNAVAILABLE";
  let db: Database | null = null;
  try {
    db = new Database(dbPath, { readonly: true, create: false });
    db.query(`SELECT 1 FROM ${table} LIMIT 1`).get();
    return "FOUND";
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

// 事件文件可读性：缺文件/读错误/任意 nonblank malformed line → false(UNAVAILABLE)；否则 true。
function eventsReadable(eventFilePath: string): boolean {
  if (!existsSync(eventFilePath)) return false;
  try {
    const content = readFileSync(eventFilePath, "utf8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        JSON.parse(line);
      } catch {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

// 直接逐行解析 JSONL（不委托布尔 findSessionEvent）：
// 缺文件/读错误/空 identifier/任意 nonblank malformed line → UNAVAILABLE；命中目标 session → FOUND；否则 NOT_FOUND。
function eventSessionState(eventFilePath: string, sessionId: string): TriState {
  if (!sessionId) return "UNAVAILABLE";
  if (!existsSync(eventFilePath)) return "UNAVAILABLE";
  try {
    const content = readFileSync(eventFilePath, "utf8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      let evt: unknown;
      try {
        evt = JSON.parse(line);
      } catch {
        return "UNAVAILABLE";
      }
      const obj = evt as { type?: string; event?: string; sessionID?: string; properties?: { sessionID?: string } };
      const type = obj.type || obj.event || "";
      const sid = obj.sessionID || obj.properties?.sessionID || "";
      if (type === "session.created" && sid === sessionId) return "FOUND";
    }
    return "NOT_FOUND";
  } catch {
    return "UNAVAILABLE";
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
  // current observation reader：缺省读取真实进程/文件；测试注入以摆脱宿主伪 PID。
  const processReader = input.readers?.processReader ?? defaultProcessReader;
  const markerReader = input.readers?.markerReader ?? ((m: RunManifest) => defaultMarkerReader(m, input.sentinelMarkerPath));
  if (phase === "reservations") {
    const pa = mfa.paths, pb = mfb.paths;
    // 容器用 manifest 顶层 rootDir（run 根），paths.rootDir 只是 19 个被包含路径之一；
    // 这样对 rootDir/manifestPath 等字段做 escape 或等值 mutation 才不会级联污染其他 containment。
    const rootA = mfa.rootDir, rootB = mfb.rootDir;
    const asStr = pa as unknown as Record<string, string>;
    const bsStr = pb as unknown as Record<string, string>;
    check("runIdDistinct", () => mfa.runId !== mfb.runId);
    check("portDistinct", () => mfa.port !== mfb.port);
    for (const f of RUN_PATH_FIELDS) {
      check(`pathDistinct.${f}`, () => asStr[f] !== bsStr[f]);
    }
    for (const f of RUN_PATH_FIELDS) {
      check(`pathContainedA.${f}`, () => pathContained(rootA ?? "", asStr[f]));
    }
    for (const f of RUN_PATH_FIELDS) {
      check(`pathContainedB.${f}`, () => pathContained(rootB ?? "", bsStr[f]));
    }
    check("reservationPidDistinct", () => pidA !== pidB);
    check("reservationPidAAlive", () => isProcessAlive(pidA));
    check("reservationPidBAlive", () => isProcessAlive(pidB));
    // 端口归属三态：A reservation 必须真实持有 portA；UNAVAILABLE(null) → FAIL。
    check("reservationPortAOwned", () => portOwnerReader(mfa.port) === pidA);
  } else if (phase === "coexistence") {
    const pa = processReader(mfa);
    const pb = processReader(mfb);
    const mk = markerReader(mfa);
    // 固定顺序 singleton checks：每端独立读取 process/health/marker 当前态。
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
    check("aServeAliveCurrent", () => pa.serveAlive);
    check("aSseAliveCurrent", () => pa.sseAlive);
    check("aHealthCurrent", () => pa.healthOk);
    check("bServeAliveCurrent", () => pb.serveAlive);
    check("bSseAliveCurrent", () => pb.sseAlive);
    check("bHealthCurrent", () => pb.healthOk);
    check("aSseReadyValid", () => existsSync(mfa.paths.sseReadyPath));
    check("bSseReadyValid", () => existsSync(mfb.paths.sseReadyPath));
    check("sentinelAliveIdentity", () => markerIdentityOk(mk, mfa));
  } else if (phase === "attribution") {
    // 固定顺序短路：首个失败立即 return；failedChecks 仅为该 check，后续 check key 不出现。
    const a = mfa, b = mfb;
    const root = a.rootSessionId ?? "";
    const child = a.childSessionId ?? "";
    const grant = a.grantId ?? "";
    const main = input.mainFrameworkDbPath;
    const attChecks: Record<string, boolean> = {};
    const attFailed: string[] = [];
    const result = (): P02VerificationResult => ({
      ok: attFailed.length === 0, phase, checks: attChecks, failedChecks: attFailed,
    });
    const req = (name: string, fn: () => boolean): boolean => {
      if (fn()) { attChecks[name] = true; return true; }
      attChecks[name] = false;
      attFailed.push(name);
      return false;
    };
    if (!req("aRootNonEmpty", () => root !== "")) return result();
    if (!req("aChildNonEmpty", () => child !== "")) return result();
    if (!req("aGrantNonEmpty", () => grant !== "")) return result();
    if (!req("aSdkEvidenceAvailable", () => tableAvailable(a.paths.opencodeDbPath, "session") === "FOUND")) return result();
    if (!req("aSdkPositive", () =>
      sdkSessionState(a.paths.opencodeDbPath, root) === "FOUND" &&
      sdkSessionState(a.paths.opencodeDbPath, child) === "FOUND")) return result();
    if (!req("aFrameworkEvidenceAvailable", () => tableAvailable(a.paths.frameworkDbPath, "session_map") === "FOUND")) return result();
    if (!req("aFrameworkPositive", () =>
      sessionMapState(a.paths.frameworkDbPath, root) === "FOUND" &&
      sessionMapState(a.paths.frameworkDbPath, child) === "FOUND")) return result();
    if (!req("aEventsEvidenceAvailable", () => eventsReadable(a.paths.eventFilePath))) return result();
    if (!req("aEventsPositive", () =>
      eventSessionState(a.paths.eventFilePath, root) === "FOUND" &&
      eventSessionState(a.paths.eventFilePath, child) === "FOUND")) return result();
    if (!req("bSdkEvidenceAvailable", () => tableAvailable(b.paths.opencodeDbPath, "session") === "FOUND")) return result();
    if (!req("bSdkNegative", () =>
      sdkSessionState(b.paths.opencodeDbPath, root) === "NOT_FOUND" &&
      sdkSessionState(b.paths.opencodeDbPath, child) === "NOT_FOUND")) return result();
    if (!req("bFrameworkEvidenceAvailable", () => tableAvailable(b.paths.frameworkDbPath, "session_map") === "FOUND")) return result();
    if (!req("bFrameworkNegative", () =>
      sessionMapState(b.paths.frameworkDbPath, root) === "NOT_FOUND" &&
      sessionMapState(b.paths.frameworkDbPath, child) === "NOT_FOUND")) return result();
    if (!req("bEventsEvidenceAvailable", () => eventsReadable(b.paths.eventFilePath))) return result();
    if (!req("bEventsNegative", () =>
      eventSessionState(b.paths.eventFilePath, root) === "NOT_FOUND" &&
      eventSessionState(b.paths.eventFilePath, child) === "NOT_FOUND")) return result();
    if (!req("mainFrameworkEvidenceAvailable", () => tableAvailable(main, "session_map") === "FOUND")) return result();
    if (!req("mainFrameworkNegative", () =>
      sessionMapState(main, root) === "NOT_FOUND" &&
      sessionMapState(main, child) === "NOT_FOUND" &&
      grantState(main, grant) === "NOT_FOUND")) return result();
    if (!req("aGrantBound", () => grantBoundTo(a.paths.frameworkDbPath, grant, child))) return result();
    return result();
  } else if (phase === "after-stop-a") {
    const a = mfa, b = mfb;
    const pb = processReader(b);
    const mk = markerReader(a);
    // 固定顺序：A stopped/null PID → old PID 证据/退出 → B ready/current process/current marker/sentinel identity。
    check("aStopped", () => a.status === "STOPPED");
    check("aServePidNull", () => a.process.servePid === null);
    check("aSsePidNull", () => a.process.ssePid === null);
    // 固定契约：after-stop-a 必须提供 A 停止前的 serve/sse PID 证据；任一缺失即 FAIL，且不误报 exit 检查。
    const oldPidEvidence = input.stoppedServePidA != null && input.stoppedSsePidA != null;
    check("aOldPidEvidenceAvailable", () => oldPidEvidence);
    if (oldPidEvidence) {
      check("aOldServeExited", () => !isProcessAlive(input.stoppedServePidA));
      check("aOldSseExited", () => !isProcessAlive(input.stoppedSsePidA));
    }
    check("bReady", () => b.status === "READY");
    check("bServeAliveCurrent", () => pb.serveAlive);
    check("bSseAliveCurrent", () => pb.sseAlive);
    check("bHealthCurrent", () => pb.healthOk);
    check("bSseReadyValid", () => existsSync(b.paths.sseReadyPath));
    check("sentinelAliveIdentity", () => markerIdentityOk(mk, a));
  } else if (phase === "cleanup") {
    check("aManifestReadable", () => readA.readable);
    check("bManifestReadable", () => readB.readable);
    // manifest 缺失时只报告 readable 失败，跳过依赖 manifest 内容的检查（无法计算即不误判）。
    if (manifestA) {
      const p = manifestA.paths;
      check("aCleaned", () => manifestA.status === "CLEANED");
      check("aWorktreeRemoved", () => !existsSync(p.worktreeDir));
      check("aFrameworkDbReadable", () => existsSync(p.frameworkDbPath));
      check("aSdkDbReadable", () => existsSync(p.opencodeDbPath));
      check("aServeLogReadable", () => existsSync(p.serveLogPath));
      check("aSseLogReadable", () => existsSync(p.sseLogPath));
      check("aFrameworkLogDirReadable", () => existsSync(p.frameworkLogDir));
      check("aEventsReadable", () => eventsReadable(p.eventFilePath));
      const aReportReadable = reportReadable(p.cleanupReportPath);
      check("aCleanupReportReadable", () => aReportReadable);
      // report 不可读时跳过语义检查（不误报为 PASS/FAIL）；可读时校验 success && worktreeRemoved。
      if (aReportReadable) check("aCleanupReportSuccess", () => reportSuccess(p.cleanupReportPath));
    }
    if (manifestB) {
      const p = manifestB.paths;
      check("bCleaned", () => manifestB.status === "CLEANED");
      check("bWorktreeRemoved", () => !existsSync(p.worktreeDir));
      check("bFrameworkDbReadable", () => existsSync(p.frameworkDbPath));
      check("bSdkDbReadable", () => existsSync(p.opencodeDbPath));
      check("bServeLogReadable", () => existsSync(p.serveLogPath));
      check("bSseLogReadable", () => existsSync(p.sseLogPath));
      check("bFrameworkLogDirReadable", () => existsSync(p.frameworkLogDir));
      check("bEventsReadable", () => eventsReadable(p.eventFilePath));
      const bReportReadable = reportReadable(p.cleanupReportPath);
      check("bCleanupReportReadable", () => bReportReadable);
      if (bReportReadable) check("bCleanupReportSuccess", () => reportSuccess(p.cleanupReportPath));
    }
    // sentinel 必须可读且 PID 已退出；marker 缺失/不可解析/仍存活均 FAIL（fail-closed，不解释为 target absent）。
    const sentinel = markerReader((manifestA ?? manifestB) as RunManifest);
    check("sentinelExited", () => sentinel.readable && !sentinel.alive);
  }

  return { ok: failedChecks.length === 0, phase, checks, failedChecks };
}
