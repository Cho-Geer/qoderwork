// scripts/test-serve/__tests__/oracle.test.ts
// P0-2 Phase 1: shared read-only oracle verification.
// 覆盖：正样本、文件缺失/表缺失/空 id 负样本、跨 DB 负样本、查询前后 DB SHA-256 不变。
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { Database } from "bun:sqlite";
import {
  findSessionEvent,
  sdkSessionExists,
  sessionMapExists,
  grantExists,
  grantBoundTo,
} from "../oracle";

let tempRoot = "";

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "oracle-test-"));
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

function sha256(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function seedDb(dbPath: string, fn: (db: Database) => void): void {
  mkdirSync(join(dbPath, ".."), { recursive: true });
  const db = new Database(dbPath);
  try {
    fn(db);
  } finally {
    db.close();
  }
}

describe("oracle (read-only)", () => {
  test("sdkSessionExists: positive, negative and empty id", () => {
    const p = join(tempRoot, "db", "opencode.db");
    seedDb(p, (db) => {
      db.exec("CREATE TABLE session (id TEXT PRIMARY KEY, parent_id TEXT)");
      db.run("INSERT INTO session (id, parent_id) VALUES (?, ?)", ["s1", null]);
    });
    expect(sdkSessionExists(p, "s1")).toBe(true);
    expect(sdkSessionExists(p, "missing")).toBe(false);
    expect(sdkSessionExists(p, "")).toBe(false);
  });

  test("sdkSessionExists: missing file => false", () => {
    expect(sdkSessionExists(join(tempRoot, "nope.db"), "s1")).toBe(false);
  });

  test("sessionMapExists / grantExists / grantBoundTo: positive", () => {
    const p = join(tempRoot, "db", "framework-state.db");
    seedDb(p, (db) => {
      db.exec("CREATE TABLE session_map (session_id TEXT PRIMARY KEY)");
      db.exec(
        "CREATE TABLE dispatch_privilege_grants (id TEXT PRIMARY KEY, status TEXT, child_session_id TEXT)",
      );
      db.run("INSERT INTO session_map (session_id) VALUES (?)", ["s1"]);
      db.run(
        "INSERT INTO dispatch_privilege_grants (id, status, child_session_id) VALUES (?, ?, ?)",
        ["g1", "bound", "c1"],
      );
    });
    expect(sessionMapExists(p, "s1")).toBe(true);
    expect(grantExists(p, "g1")).toBe(true);
    expect(grantBoundTo(p, "g1", "c1")).toBe(true);
    expect(grantBoundTo(p, "g1", "other")).toBe(false);
  });

  test("missing table => false (no throw)", () => {
    const p = join(tempRoot, "db", "framework-state.db");
    seedDb(p, (db) => {
      db.exec("CREATE TABLE unrelated (id TEXT)");
    });
    expect(sessionMapExists(p, "s1")).toBe(false);
    expect(grantBoundTo(p, "g1", "c1")).toBe(false);
  });

  test("cross-DB negative: session in A's SDK db not visible from B", () => {
    const a = join(tempRoot, "a", "db", "opencode.db");
    const b = join(tempRoot, "b", "db", "opencode.db");
    seedDb(a, (db) => {
      db.exec("CREATE TABLE session (id TEXT PRIMARY KEY, parent_id TEXT)");
      db.run("INSERT INTO session (id, parent_id) VALUES (?, ?)", ["s1", null]);
    });
    seedDb(b, (db) => {
      db.exec("CREATE TABLE session (id TEXT PRIMARY KEY, parent_id TEXT)");
    });
    expect(sdkSessionExists(a, "s1")).toBe(true);
    expect(sdkSessionExists(b, "s1")).toBe(false);
  });

  test("findSessionEvent: positive, negative and missing file", () => {
    const ev = join(tempRoot, "events.jsonl");
    writeFileSync(
      ev,
      JSON.stringify({ type: "session.created", sessionID: "s1" }) + "\n" +
        JSON.stringify({ type: "session.created", sessionID: "s2" }) + "\n",
    );
    expect(findSessionEvent(ev, "s1")).toBe(true);
    expect(findSessionEvent(ev, "s2")).toBe(true);
    expect(findSessionEvent(ev, "s3")).toBe(false);
    expect(findSessionEvent(join(tempRoot, "missing.jsonl"), "s1")).toBe(false);
  });

  test("read-only: DB file SHA-256 unchanged after queries", () => {
    const p = join(tempRoot, "db", "framework-state.db");
    seedDb(p, (db) => {
      db.exec("CREATE TABLE session_map (session_id TEXT PRIMARY KEY)");
      db.exec(
        "CREATE TABLE dispatch_privilege_grants (id TEXT PRIMARY KEY, status TEXT, child_session_id TEXT)",
      );
      db.run("INSERT INTO session_map (session_id) VALUES (?)", ["s1"]);
      db.run(
        "INSERT INTO dispatch_privilege_grants (id, status, child_session_id) VALUES (?, ?, ?)",
        ["g1", "bound", "c1"],
      );
    });
    const before = sha256(p);
    expect(sessionMapExists(p, "s1")).toBe(true);
    expect(grantBoundTo(p, "g1", "c1")).toBe(true);
    expect(grantExists(p, "g1")).toBe(true);
    const after = sha256(p);
    expect(after).toBe(before);
  });
});
