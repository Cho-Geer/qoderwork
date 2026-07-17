import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import type { P01bVerificationPhase, P01bVerificationResult, RunManifest } from "./types";
import { readRunManifest } from "./run-context";

export function verifyP01b(
  runDir: string,
  phase: P01bVerificationPhase,
): P01bVerificationResult {
  if (!runDir || !phase) {
    throw new Error("runDir and phase are required");
  }
  if (phase !== "runtime" && phase !== "cleanup") {
    throw new Error(`invalid phase: ${phase}`);
  }

  const manifest = readRunManifest(runDir);
  const checks: Record<string, boolean> = {};
  const failedChecks: string[] = [];

  const check = (name: string, fn: () => boolean) => {
    try {
      const ok = fn();
      checks[name] = ok;
      if (!ok) failedChecks.push(name);
    } catch {
      checks[name] = false;
      failedChecks.push(name);
    }
  };

  if (phase === "runtime") {
    checkRuntimeChecks(manifest, check);
  } else {
    checkCleanupChecks(manifest, check);
  }

  return {
    ok: failedChecks.length === 0,
    phase,
    checks,
    failedChecks,
  };
}

function checkRuntimeChecks(
  manifest: RunManifest,
  check: (name: string, fn: () => boolean) => void,
): void {
  check("statusBootstrapped", () => manifest.status === "BOOTSTRAPPED");
  check("pidFieldsPresent", () =>
    manifest.process.servePid !== null && manifest.process.ssePid !== null,
  );
  check("sseReadyValid", () => {
    if (!existsSync(manifest.paths.sseReadyPath)) return false;
    const content = JSON.parse(readFileSync(manifest.paths.sseReadyPath, "utf8"));
    return content.runId === manifest.runId
      && content.serveUrl === `http://127.0.0.1:${manifest.port}`
      && content.eventFile === manifest.paths.eventFilePath;
  });
  check("rootInSdkDb", () => querySdkDb(manifest, manifest.rootSessionId));
  check("childInSdkDb", () => querySdkDb(manifest, manifest.childSessionId));
  check("rootEventPresent", () =>
    findEventInJsonl(manifest.paths.eventFilePath, manifest.rootSessionId),
  );
  check("childEventPresent", () =>
    findEventInJsonl(manifest.paths.eventFilePath, manifest.childSessionId),
  );
  check("rootSessionMapPresent", () =>
    querySessionMap(manifest.paths.frameworkDbPath, manifest.rootSessionId),
  );
  check("childSessionMapPresent", () =>
    querySessionMap(manifest.paths.frameworkDbPath, manifest.childSessionId),
  );
  check("childParentMatchesRoot", () => {
    if (!manifest.childSessionId || !manifest.rootSessionId) return false;
    return querySdkDbParent(manifest.paths.opencodeDbPath, manifest.childSessionId, manifest.rootSessionId);
  });
  check("grantBound", () =>
    queryGrantBound(manifest.paths.frameworkDbPath, manifest.grantId, manifest.childSessionId),
  );
  check("planArtifactNotRun", () => {
    const planPath = join(manifest.paths.artifactsDir, "plan-result.json");
    if (!existsSync(planPath)) return false;
    const content = JSON.parse(readFileSync(planPath, "utf8"));
    return content.status === "NOT-RUN";
  });
}

function checkCleanupChecks(
  manifest: RunManifest,
  check: (name: string, fn: () => boolean) => void,
): void {
  check("statusCleaned", () => manifest.status === "CLEANED");
  check("worktreeRemoved", () => !existsSync(manifest.paths.worktreeDir));
  check("manifestReadable", () => existsSync(manifest.paths.manifestPath));
  check("cleanupReportReadable", () => existsSync(manifest.paths.cleanupReportPath));
  check("frameworkDbReadable", () => existsSync(manifest.paths.frameworkDbPath));
  check("opencodeDbReadable", () => existsSync(manifest.paths.opencodeDbPath));
  check("serveLogReadable", () => existsSync(manifest.paths.serveLogPath));
  check("sseLogReadable", () => existsSync(manifest.paths.sseLogPath));
  check("eventsNonEmpty", () => {
    if (!existsSync(manifest.paths.eventFilePath)) return false;
    return readFileSync(manifest.paths.eventFilePath, "utf8").trim().length > 0;
  });
  check("sseReadyReadable", () => existsSync(manifest.paths.sseReadyPath));
  check("planArtifactReadable", () =>
    existsSync(join(manifest.paths.artifactsDir, "plan-result.json")),
  );
  check("artifactsReadable", () => existsSync(manifest.paths.artifactsDir));
  check("cleanupReportSuccess", () => {
    if (!existsSync(manifest.paths.cleanupReportPath)) return false;
    const report = JSON.parse(readFileSync(manifest.paths.cleanupReportPath, "utf8"));
    return report.success === true;
  });
  check("cleanupReportWorktreeRemoved", () => {
    if (!existsSync(manifest.paths.cleanupReportPath)) return false;
    const report = JSON.parse(readFileSync(manifest.paths.cleanupReportPath, "utf8"));
    return report.worktreeRemoved === true;
  });
}

function querySdkDb(manifest: RunManifest, sessionId: string | null): boolean {
  if (!sessionId) return false;
  let db: InstanceType<typeof Database> | null = null;
  try {
    if (!existsSync(manifest.paths.opencodeDbPath)) return false;
    db = new Database(manifest.paths.opencodeDbPath, { readonly: true });
    const row = db.query("SELECT id FROM session WHERE id = ?").get(sessionId);
    return row != null;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

function querySessionMap(frameworkDbPath: string, sessionId: string | null): boolean {
  if (!sessionId) return false;
  let db: InstanceType<typeof Database> | null = null;
  try {
    if (!existsSync(frameworkDbPath)) return false;
    db = new Database(frameworkDbPath, { readonly: true });
    const row = db.query("SELECT session_id FROM session_map WHERE session_id = ?").get(sessionId);
    return row != null;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

function querySdkDbParent(opencodeDbPath: string, childId: string, parentId: string): boolean {
  let db: InstanceType<typeof Database> | null = null;
  try {
    if (!existsSync(opencodeDbPath)) return false;
    db = new Database(opencodeDbPath, { readonly: true });
    const row = db.query("SELECT parent_id FROM session WHERE id = ?").get(childId) as { parent_id: string } | undefined;
    return row?.parent_id === parentId;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

function queryGrantBound(frameworkDbPath: string, grantId: string | null, childSessionId: string | null): boolean {
  if (!grantId || !childSessionId) return false;
  let db: InstanceType<typeof Database> | null = null;
  try {
    if (!existsSync(frameworkDbPath)) return false;
    db = new Database(frameworkDbPath, { readonly: true });
    const row = db.query(
      "SELECT status, child_session_id FROM dispatch_privilege_grants WHERE id = ? LIMIT 1",
    ).get(grantId) as { status: string; child_session_id: string } | undefined;
    return row?.status === "bound" && row?.child_session_id === childSessionId;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

function findEventInJsonl(eventFilePath: string, sessionId: string | null): boolean {
  if (!sessionId) return false;
  try {
    if (!existsSync(eventFilePath)) return false;
    const content = readFileSync(eventFilePath, "utf8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        const evt = JSON.parse(line);
        const type = evt.type || evt.event || "";
        const sid = evt.sessionID || evt.properties?.sessionID || "";
        if (type === "session.created" && sid === sessionId) return true;
      } catch { /* malformed line */ }
    }
    return false;
  } catch {
    return false;
  }
}