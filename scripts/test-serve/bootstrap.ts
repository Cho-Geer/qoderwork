import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { Database } from "bun:sqlite";
import { readRunManifest, setRunState, writeRunManifest } from "./run-context";
import { stopRunProcesses } from "./process";
import type { BootstrapInput, RunManifest } from "./types";

interface PrivilegeService {
  createGrant: (input: {
    dispatch_key: string;
    parent_session_id: string;
    agent_type: string;
    privilege: string;
    allowed_tools: string[];
    allowed_paths?: string[];
    max_writes?: number;
    reason: string;
    dag_task_id?: string;
    ttl_ms?: number;
  }) => { id: string } | null;
  bindGrant: (dispatchKey: string, childSessionId: string) => { id: string } | null;
}

export interface BootstrapDependencies {
  createSession?: typeof createSession;
  loadPrivilegeService?: typeof loadPrivilegeService;
  assertGrantBound?: typeof assertGrantBound;
  stopRunProcesses?: typeof stopRunProcesses;
  waitForSessionBarrier?: typeof waitForSessionBarrier;
}

export interface WaitForSessionBarrierInput {
  manifest: RunManifest;
  sessionId: string;
  parentSessionId: string | null;
  timeoutMs?: number;
}

export interface WaitForSessionBarrierDependencies {
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export async function waitForSessionBarrier(
  input: WaitForSessionBarrierInput,
  dependencies: WaitForSessionBarrierDependencies = {},
): Promise<void> {
  const sleepFn = dependencies.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const nowFn = dependencies.now ?? Date.now;
  const timeoutMs = input.timeoutMs ?? 10_000;
  const deadline = nowFn() + timeoutMs;

  while (nowFn() < deadline) {
    const eventPresent = checkEventFile(input.manifest.paths.eventFilePath, input.sessionId);
    const sessionMapPresent = checkSessionMap(input.manifest.paths.frameworkDbPath, input.sessionId);
    const parentOk = input.parentSessionId === null
      || checkSdkDbParent(input.manifest.paths.opencodeDbPath, input.sessionId, input.parentSessionId);

    if (eventPresent && sessionMapPresent && parentOk) return;
    await sleepFn(200);
  }
  throw new Error(
    `session barrier timeout for ${input.sessionId}` +
    ` (parentSessionId=${input.parentSessionId})`,
  );
}

function checkEventFile(eventFilePath: string, sessionId: string): boolean {
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

function checkSessionMap(frameworkDbPath: string, sessionId: string): boolean {
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

function checkSdkDbParent(opencodeDbPath: string, sessionId: string, parentSessionId: string): boolean {
  let db: InstanceType<typeof Database> | null = null;
  try {
    if (!existsSync(opencodeDbPath)) return false;
    db = new Database(opencodeDbPath, { readonly: true });
    const row = db.query("SELECT parent_id FROM session WHERE id = ?").get(sessionId) as { parent_id: string } | undefined;
    return row?.parent_id === parentSessionId;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

export async function bootstrapRun(input: BootstrapInput, dependencies: BootstrapDependencies = {}): Promise<RunManifest> {
  const manifest = readRunManifest(input.runDir);
  if (manifest.status !== "READY") {
    throw new Error(`bootstrap requires READY state, got ${manifest.status}`);
  }
  if (!input.childAgent || input.childAgent.trim().length === 0) {
    throw new Error("bootstrap child agent is required");
  }
  if (!input.allowedPaths.length) {
    throw new Error("bootstrap allowed paths cannot be empty");
  }
  const allowedPaths = normalizeAllowedPaths(manifest.paths.worktreeDir, input.allowedPaths);
  const createSessionForRun = dependencies.createSession ?? createSession;
  const loadPrivilegeServiceForRun = dependencies.loadPrivilegeService ?? loadPrivilegeService;
  const assertGrantBoundForRun = dependencies.assertGrantBound ?? assertGrantBound;
  const stopRunProcessesForRun = dependencies.stopRunProcesses ?? stopRunProcesses;
  const waitForSessionBarrierForRun = dependencies.waitForSessionBarrier ?? waitForSessionBarrier;

  let rootSessionId: string | null = null;
  let childSessionId: string | null = null;
  let grantId: string | null = null;
  let dispatchKey: string | null = null;
  let failedStage = "";

  try {
    failedStage = "create-root-session";
    const rootSession = await createSessionForRun(manifest, {
      title: `[${manifest.testId}] root bootstrap`,
      agent: input.rootAgent,
    });
    rootSessionId = rootSession.id;

    failedStage = "root-barrier";
    await waitForSessionBarrierForRun({
      manifest,
      sessionId: rootSession.id,
      parentSessionId: null,
    });

    dispatchKey = `dispatch-${randomUUID()}`;
    failedStage = "load-privilege-service";
    const service = await loadPrivilegeServiceForRun(manifest);

    failedStage = "create-grant";
    const grant = withRunEnvironment(manifest, () =>
      service.createGrant({
        dispatch_key: dispatchKey!,
        parent_session_id: rootSession.id,
        agent_type: input.childAgent,
        privilege: "framework_maintenance",
        allowed_tools: ["safe_edit", "safe_shell", "dispatch_subagent"],
        allowed_paths: allowedPaths,
        reason: input.reason,
      }),
    );
    if (!grant) {
      failedStage = "create-grant";
      throw new Error("createGrant returned null");
    }
    grantId = grant.id;

    failedStage = "create-child-session";
    const childSession = await createSessionForRun(manifest, {
      title: `[${manifest.testId}] child bootstrap`,
      agent: input.childAgent,
      parentID: rootSessionId,
    });
    childSessionId = childSession.id;

    failedStage = "child-barrier";
    await waitForSessionBarrierForRun({
      manifest,
      sessionId: childSession.id,
      parentSessionId: rootSessionId,
    });

    failedStage = "bind-grant";
    const bound = withRunEnvironment(manifest, () => service.bindGrant(dispatchKey!, childSessionId!),);
    if (!bound) {
      throw new Error("bindGrant returned null");
    }
    failedStage = "db-oracle";
    assertGrantBoundForRun(manifest, bound.id, childSessionId!);

    // S2.4: 只有 DB oracle 通过后才写 bootstrapComplete=true
    manifest.rootSessionId = rootSessionId;
    manifest.childSessionId = childSessionId;
    manifest.grantId = grantId;
    manifest.dispatchKey = dispatchKey;
    manifest.allowedPaths = allowedPaths;
    manifest.bootstrapComplete = true;
    writeRunManifest(manifest);
    return setRunState(manifest, "BOOTSTRAPPED");
  } catch (error) {
    // S3.2-3: 保留已产生的 ID，设 bootstrapComplete=false，停进程，写 BLOCKED
    const message = error instanceof Error ? error.message : String(error);
    manifest.rootSessionId = rootSessionId;
    manifest.childSessionId = childSessionId;
    manifest.grantId = grantId;
    manifest.dispatchKey = dispatchKey;
    manifest.allowedPaths = allowedPaths;
    manifest.bootstrapComplete = false;
    manifest.cleanup.notes.push(
      `bootstrap failed at ${failedStage || "unknown stage"}: ${message}`,
    );

    writeRunManifest(manifest);

    // 停止本 run 的进程；停止失败时保留真实 PID，仍将 run 标记为 BLOCKED。
    let stopFailure: string | null = null;
    try {
      await stopRunProcessesForRun(input.runDir);
    } catch (stopError) {
      stopFailure = stopError instanceof Error ? stopError.message : String(stopError);
    }

    const blockedManifest = readRunManifest(input.runDir);
    if (stopFailure) {
      blockedManifest.cleanup.notes.push(`bootstrap process stop failed: ${stopFailure}`);
    }
    const pidFilesRemain = existsSync(blockedManifest.paths.servePidPath)
      || existsSync(blockedManifest.paths.ssePidPath);
    const pidsRemain = blockedManifest.process.servePid !== null
      || blockedManifest.process.ssePid !== null
      || blockedManifest.process.portReserverPid !== null;
    if (!stopFailure && (pidFilesRemain || pidsRemain)) {
      blockedManifest.cleanup.notes.push("bootstrap process stop failed: process metadata remains");
    }
    setRunState(blockedManifest, "BLOCKED");
    throw new Error(`bootstrap failed at ${failedStage || "unknown"}: ${message}`);
  }
}

async function createSession(
  manifest: RunManifest,
  body: Record<string, unknown>,
): Promise<{ id: string }> {
  const response = await fetch(`http://127.0.0.1:${manifest.port}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`session create failed: ${response.status} ${await response.text()}`);
  }
  const data = (await response.json()) as { id: string };
  if (!data?.id) throw new Error("session create returned no id");
  return data;
}

export async function loadPrivilegeService(manifest: RunManifest): Promise<PrivilegeService> {
  // Resolve the privilege module path from the isolated worktree's directory.
  // Use pathToFileURL().href so the dynamic import receives a valid file URL
  // (required for Windows paths and absolute paths).
  const resolvedPrivilegePath = resolve(
    manifest.paths.worktreeDir,
    ".opencode",
    "service",
    "dispatch",
    "privilege.ts",
  );
  const module = await import(pathToFileURL(resolvedPrivilegePath).href);
  return module as PrivilegeService;
}

function withRunEnvironment<T>(manifest: RunManifest, fn: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(manifest.env)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (typeof value === "undefined") delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function assertGrantBound(manifest: RunManifest, grantId: string, childSessionId: string): void {
  const db = new Database(manifest.paths.frameworkDbPath, { readonly: true });
  try {
    const row = db
      .query(
        "SELECT status, child_session_id FROM dispatch_privilege_grants WHERE id = ? LIMIT 1",
      )
      .get(grantId) as { status: string; child_session_id: string } | undefined;
    if (!row || row.status !== "bound" || row.child_session_id !== childSessionId) {
      throw new Error("grant row not bound in framework DB");
    }
  } finally {
    db.close();
  }
}

function normalizeAllowedPaths(worktreeDir: string, inputPaths: string[]): string[] {
  const root = realpathSync.native(resolve(worktreeDir));
  return inputPaths.map((inputPath) => {
    const candidate = realpathSync.native(resolve(inputPath));
    const rel = relative(root, candidate);
    const inside = rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
    if (!inside) throw new Error(`allowed path outside worktree: ${inputPath}`);
    return candidate;
  });
}
