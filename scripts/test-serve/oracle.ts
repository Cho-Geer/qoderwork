// P0-2 shared READ-ONLY query oracle.
// 每个 DB 访问必须先 existsSync，再 { readonly: true } 打开，finally 中 close。
// 禁止 CREATE/INSERT/UPDATE/DELETE/PRAGMA journal_mode。
import { existsSync, readFileSync } from "node:fs";
import { Database } from "bun:sqlite";

function openReadonly(dbPath: string): Database | null {
  if (!dbPath || !existsSync(dbPath)) return null;
  return new Database(dbPath, { readonly: true });
}

export function findSessionEvent(eventFilePath: string, sessionId: string): boolean {
  if (!sessionId) return false;
  if (!existsSync(eventFilePath)) return false;
  try {
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

export function sdkSessionExists(dbPath: string, sessionId: string): boolean {
  if (!sessionId) return false;
  const db = openReadonly(dbPath);
  if (!db) return false;
  try {
    return db.query("SELECT id FROM session WHERE id = ?").get(sessionId) != null;
  } catch {
    return false;
  } finally {
    db.close();
  }
}

export function sessionMapExists(dbPath: string, sessionId: string): boolean {
  if (!sessionId) return false;
  const db = openReadonly(dbPath);
  if (!db) return false;
  try {
    return db.query("SELECT session_id FROM session_map WHERE session_id = ?").get(sessionId) != null;
  } catch {
    return false;
  } finally {
    db.close();
  }
}

export function grantExists(dbPath: string, grantId: string): boolean {
  if (!grantId) return false;
  const db = openReadonly(dbPath);
  if (!db) return false;
  try {
    return db.query("SELECT id FROM dispatch_privilege_grants WHERE id = ?").get(grantId) != null;
  } catch {
    return false;
  } finally {
    db.close();
  }
}

export function grantBoundTo(dbPath: string, grantId: string, childSessionId: string): boolean {
  if (!grantId || !childSessionId) return false;
  const db = openReadonly(dbPath);
  if (!db) return false;
  try {
    const row = db.query(
      "SELECT status, child_session_id FROM dispatch_privilege_grants WHERE id = ? LIMIT 1",
    ).get(grantId) as { status: string; child_session_id: string } | undefined;
    return row?.status === "bound" && row?.child_session_id === childSessionId;
  } catch {
    return false;
  } finally {
    db.close();
  }
}
