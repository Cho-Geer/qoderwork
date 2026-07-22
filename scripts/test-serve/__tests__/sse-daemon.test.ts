import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

// We test the exported pure-file helpers by importing the module with env set.
// Since the module reads env at import time, we set env BEFORE import.

const ORIGINAL_SSE_READY_FILE = process.env.SSE_READY_FILE;
const ORIGINAL_RUN_ID = process.env.QODERWORK_TEST_RUN_ID;

describe("sse-daemon helpers", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "sse-daemon-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    process.env.SSE_READY_FILE = ORIGINAL_SSE_READY_FILE;
    process.env.QODERWORK_TEST_RUN_ID = ORIGINAL_RUN_ID;
  });

  test("ensureEventFile creates empty event file", () => {
    process.env.SSE_READY_FILE = "";
    process.env.QODERWORK_TEST_RUN_ID = "";
    // Re-import to pick up env changes — but Bun caches modules.
    // Instead, call the function directly via a fresh require path.
    const eventFile = join(tempDir, "events", "events.jsonl");
    const { ensureEventFile } = require("../../sse-daemon.ts") as typeof import("../../sse-daemon.ts");
    ensureEventFile(eventFile);
    expect(existsSync(eventFile)).toBe(true);
    expect(readFileSync(eventFile, "utf8")).toBe("");
  });

  test("writeSseReadyMarker writes valid JSON with correct content", () => {
    const markerPath = join(tempDir, "events", "sse-ready.json");
    process.env.SSE_READY_FILE = markerPath;
    process.env.QODERWORK_TEST_RUN_ID = "test-run-123";

    const { writeSseReadyMarker } = require("../../sse-daemon.ts") as typeof import("../../sse-daemon.ts");
    writeSseReadyMarker({
      runId: "test-run-123",
      serveUrl: "http://127.0.0.1:39999",
      eventFile: join(tempDir, "events", "events.jsonl"),
      connectedAt: "2026-07-17T00:00:00.000Z",
    });

    expect(existsSync(markerPath)).toBe(true);
    const content = JSON.parse(readFileSync(markerPath, "utf8"));
    expect(content.runId).toBe("test-run-123");
    expect(content.serveUrl).toBe("http://127.0.0.1:39999");
    expect(content.connectedAt).toBe("2026-07-17T00:00:00.000Z");
  });

  test("writeSseReadyMarker overwrites with still-valid JSON", () => {
    const markerPath = join(tempDir, "events", "sse-ready.json");
    process.env.SSE_READY_FILE = markerPath;
    process.env.QODERWORK_TEST_RUN_ID = "test-run-456";

    const { writeSseReadyMarker } = require("../../sse-daemon.ts") as typeof import("../../sse-daemon.ts");
    writeSseReadyMarker({
      runId: "test-run-456",
      serveUrl: "http://127.0.0.1:39998",
      eventFile: join(tempDir, "events", "events.jsonl"),
      connectedAt: "2026-07-17T00:00:01.000Z",
    });
    writeSseReadyMarker({
      runId: "test-run-456",
      serveUrl: "http://127.0.0.1:39998",
      eventFile: join(tempDir, "events", "events.jsonl"),
      connectedAt: "2026-07-17T00:00:02.000Z",
    });

    const content = JSON.parse(readFileSync(markerPath, "utf8"));
    expect(content.connectedAt).toBe("2026-07-17T00:00:02.000Z");
  });

  test("writeSseReadyMarker throws when SSE_READY_FILE is missing", () => {
    process.env.SSE_READY_FILE = "";
    process.env.QODERWORK_TEST_RUN_ID = "test-run-789";

    const { writeSseReadyMarker } = require("../../sse-daemon.ts") as typeof import("../../sse-daemon.ts");
    expect(() =>
      writeSseReadyMarker({
        runId: "test-run-789",
        serveUrl: "http://127.0.0.1:39997",
        eventFile: "/tmp/events.jsonl",
        connectedAt: "2026-07-17T00:00:03.000Z",
      })
    ).toThrow("SSE_READY_FILE is required");
  });

  test("writeSseReadyMarker throws when RUN_ID is missing", () => {
    const markerPath = join(tempDir, "events", "sse-ready.json");
    process.env.SSE_READY_FILE = markerPath;
    delete process.env.QODERWORK_TEST_RUN_ID;

    const { writeSseReadyMarker } = require("../../sse-daemon.ts") as typeof import("../../sse-daemon.ts");
    expect(() =>
      writeSseReadyMarker({
        runId: "any",
        serveUrl: "http://127.0.0.1:39996",
        eventFile: "/tmp/events.jsonl",
        connectedAt: "2026-07-17T00:00:04.000Z",
      })
    ).toThrow("QODERWORK_TEST_RUN_ID is required");
  });

  test("sse-daemon throws when FRAMEWORK_DB_PATH missing (P03-S-06)", () => {
    // Run sse-daemon.ts as a child process without FRAMEWORK_DB_PATH.
    // The main() function checks FRAMEWORK_DB_PATH and throws when missing.
    // Since autoWriteSessionMap is not exported, we verify via the main entry point.
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined && k !== "FRAMEWORK_DB_PATH") env[k] = v;
    }
    const result = Bun.spawnSync({
      cmd: [process.execPath, "run", join(__dirname, "../../sse-daemon.ts")],
      env,
      stdout: "pipe",
      stderr: "pipe",
    });
    const stderr = result.stderr.toString();
    expect(result.exitCode).not.toBe(0);
    expect(stderr).toContain("FRAMEWORK_DB_PATH is required");
  });
});