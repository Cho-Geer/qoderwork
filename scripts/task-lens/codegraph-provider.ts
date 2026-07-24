// scripts/task-lens/codegraph-provider.ts
// PHASE-03: StructureProvider interface, CodeGraphProvider (readonly SQLite),
// and CliStructureProvider (CLI fallback). Provider is always readonly;
// pending/mismatch never triggers sync/index/init.

import { Database } from "bun:sqlite";
import { join } from "node:path";
import type {
  FunctionRange,
  EdgeRef,
  GraphBudget,
  ProviderMetadata,
  CommandRunner,
  CommandResult,
} from "./types.ts";
import { runCommand } from "./command-runner.ts";

// ---------------------------------------------------------------------------
// StructureProvider interface (blueprint §G3, signature unchanged)
// ---------------------------------------------------------------------------

export interface StructureProvider {
  readonly metadata: ProviderMetadata;
  getFunctionRanges(files: string[]): Promise<FunctionRange[]>;
  getCallers(ids: string[], budget: GraphBudget): Promise<EdgeRef[]>;
  getCallees(ids: string[], budget: GraphBudget): Promise<EdgeRef[]>;
}

// ---------------------------------------------------------------------------
// Provider state types
// ---------------------------------------------------------------------------

export type ProviderState = "AVAILABLE" | "UNAVAILABLE";

export interface CapabilityReceipt {
  readonly provider: "codegraph-sqlite";
  readonly schemaVersions: number[];
  readonly indexedWithVersion: string | null;
  readonly extractionVersion: string | null;
  readonly capabilityHash: string;
}

export class ProviderUnavailableError extends Error {
  constructor(
    message: string,
    public readonly exitCode: 12 = 12,
  ) {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}

// ---------------------------------------------------------------------------
// Required schema definitions (probe targets)
// ---------------------------------------------------------------------------

const REQUIRED_TABLES = ["nodes", "edges", "schema_versions", "project_metadata"] as const;

const REQUIRED_NODE_COLUMNS = [
  "id", "kind", "name", "qualified_name", "file_path",
  "start_line", "end_line", "signature",
] as const;

const REQUIRED_EDGE_COLUMNS = ["source", "target", "kind", "metadata"] as const;

// ---------------------------------------------------------------------------
// CodeGraphProvider — readonly SQLite implementation
// ---------------------------------------------------------------------------

export class CodeGraphProvider implements StructureProvider {
  readonly metadata: ProviderMetadata;
  readonly receipt: CapabilityReceipt;

  private constructor(
    private readonly db: Database,
    metadata: ProviderMetadata,
    receipt: CapabilityReceipt,
  ) {
    this.metadata = metadata;
    this.receipt = receipt;
  }

  /**
   * Opens the CodeGraph SQLite DB in readonly mode, probes schema capability,
   * and returns a provider if all required tables/columns are present.
   * Throws ProviderUnavailableError on any failure.
   */
  static async open(projectRealpath: string): Promise<CodeGraphProvider> {
    const dbPath = join(projectRealpath, ".codegraph", "codegraph.db");
    let db: Database;
    try {
      db = new Database(dbPath, { readonly: true, strict: true });
    } catch (err) {
      throw new ProviderUnavailableError(
        `Cannot open readonly DB at ${dbPath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Probe required tables
    for (const table of REQUIRED_TABLES) {
      const row = db.query(
        "SELECT name FROM sqlite_master WHERE type = ? AND name = ?",
      ).get("table", table) as { name: string } | null;
      if (!row) {
        db.close();
        throw new ProviderUnavailableError(`Missing required table: ${table}`);
      }
    }

    // Probe required columns
    for (const col of REQUIRED_NODE_COLUMNS) {
      const cols = db.query("PRAGMA table_info(nodes)").all() as { name: string }[];
      if (!cols.some((c) => c.name === col)) {
        db.close();
        throw new ProviderUnavailableError(`Missing required nodes column: ${col}`);
      }
    }
    for (const col of REQUIRED_EDGE_COLUMNS) {
      const cols = db.query("PRAGMA table_info(edges)").all() as { name: string }[];
      if (!cols.some((c) => c.name === col)) {
        db.close();
        throw new ProviderUnavailableError(`Missing required edges column: ${col}`);
      }
    }

    // Collect schema versions
    let schemaVersions: number[] = [];
    try {
      const rows = db.query("SELECT version FROM schema_versions ORDER BY version").all() as { version: number }[];
      schemaVersions = rows.map((r) => r.version);
    } catch {
      // schema_versions table exists but may be empty
    }

    // Collect project metadata
    let indexedWithVersion: string | null = null;
    let extractionVersion: string | null = null;
    try {
      const meta = db.query("SELECT key, value FROM project_metadata").all() as { key: string; value: string }[];
      for (const row of meta) {
        if (row.key === "indexed_with_version") indexedWithVersion = row.value;
        if (row.key === "extraction_version") extractionVersion = row.value;
      }
    } catch {
      // project_metadata may be empty
    }

    // Compute capability hash from sorted table/column names
    const capabilityInput = JSON.stringify({
      tables: [...REQUIRED_TABLES].sort(),
      nodeColumns: [...REQUIRED_NODE_COLUMNS].sort(),
      edgeColumns: [...REQUIRED_EDGE_COLUMNS].sort(),
    });
    const capabilityHash = Bun.hash(capabilityInput).toString(16).padStart(16, "0");

    const receipt: CapabilityReceipt = {
      provider: "codegraph-sqlite",
      schemaVersions,
      indexedWithVersion,
      extractionVersion,
      capabilityHash,
    };

    const metadata: ProviderMetadata = {
      name: "codegraph-sqlite",
      schemaVersion: schemaVersions.length > 0 ? String(schemaVersions[schemaVersions.length - 1]) : null,
      available: true,
      resolvedBy: "codegraph-sqlite",
    };

    return new CodeGraphProvider(db, metadata, receipt);
  }

  /** Get function/method ranges for the given files using parameterized queries. */
  async getFunctionRanges(files: string[]): Promise<FunctionRange[]> {
    if (files.length === 0) return [];
    const placeholders = files.map(() => "?").join(",");
    const rows = this.db.query(
      `SELECT id, kind, name, qualified_name, file_path, start_line, end_line, signature
       FROM nodes
       WHERE file_path IN (${placeholders}) AND kind IN ('function', 'method')
       ORDER BY file_path, start_line, id`,
    ).all(...files) as NodeRow[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      file: r.file_path,
      startLine: r.start_line,
      endLine: r.end_line,
      signature: r.signature,
    }));
  }

  /** Get caller edges (who calls the given node IDs). */
  async getCallers(ids: string[], budget: GraphBudget): Promise<EdgeRef[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(",");
    const rows = this.db.query(
      `SELECT e.source, e.target, e.kind, e.metadata
       FROM edges e
       WHERE e.target IN (${placeholders}) AND e.kind = 'calls'
       LIMIT ?`,
    ).all(...ids, budget.maxEdges) as EdgeRow[];

    return rows.map((r) => parseEdgeRow(r, "caller"));
  }

  /** Get callee edges (who the given node IDs call). */
  async getCallees(ids: string[], budget: GraphBudget): Promise<EdgeRef[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(",");
    const rows = this.db.query(
      `SELECT e.source, e.target, e.kind, e.metadata
       FROM edges e
       WHERE e.source IN (${placeholders}) AND e.kind = 'calls'
       LIMIT ?`,
    ).all(...ids, budget.maxEdges) as EdgeRow[];

    return rows.map((r) => parseEdgeRow(r, "callee"));
  }

  close(): void {
    this.db.close();
  }
}

// ---------------------------------------------------------------------------
// CLI fallback provider
// ---------------------------------------------------------------------------

export class CliStructureProvider implements StructureProvider {
  readonly metadata: ProviderMetadata;

  private constructor(
    private readonly projectRealpath: string,
    private readonly runner: CommandRunner,
    metadata: ProviderMetadata,
  ) {
    this.metadata = metadata;
  }

  /**
   * Creates a CLI fallback provider. Verifies `codegraph status` is up-to-date.
   * Throws ProviderUnavailableError if status is not up-to-date or CLI fails.
   */
  static async open(
    projectRealpath: string,
    runner: CommandRunner = runCommand,
  ): Promise<CliStructureProvider> {
    // Step 1: codegraph status must be up-to-date
    let result: CommandResult;
    try {
      result = await runner({
        executable: "codegraph",
        args: ["status", "--path", projectRealpath],
        cwd: projectRealpath,
      });
    } catch {
      throw new ProviderUnavailableError("codegraph status command failed");
    }
    if (result.exitCode !== 0) {
      throw new ProviderUnavailableError(`codegraph status exit ${result.exitCode}`);
    }
    if (!result.stdout.includes("up-to-date")) {
      throw new ProviderUnavailableError("codegraph status is not up-to-date");
    }

    const metadata: ProviderMetadata = {
      name: "codegraph-cli",
      schemaVersion: null,
      available: true,
      resolvedBy: "codegraph-cli",
    };

    return new CliStructureProvider(projectRealpath, runner, metadata);
  }

  async getFunctionRanges(files: string[]): Promise<FunctionRange[]> {
    const ranges: FunctionRange[] = [];
    for (const file of files) {
      let result: CommandResult;
      try {
        result = await this.runner({
          executable: "codegraph",
          args: ["node", "--path", this.projectRealpath, "--file", file, "--symbols-only"],
          cwd: this.projectRealpath,
        });
      } catch {
        throw new ProviderUnavailableError(`codegraph node failed for ${file}`);
      }
      if (result.exitCode !== 0) {
        throw new ProviderUnavailableError(`codegraph node exit ${result.exitCode} for ${file}`);
      }
      // Parse exact grammar: each line is `kind|name|qualified_name|start_line|end_line|signature`
      for (const line of result.stdout.split("\n").filter(Boolean)) {
        const parts = line.split("|");
        if (parts.length < 6) {
          throw new ProviderUnavailableError(`codegraph node parse error: ${line}`);
        }
        const [kind, name, qualifiedName, startStr, endStr, signature] = parts;
        if (kind !== "function" && kind !== "method") continue;
        const startLine = parseInt(startStr, 10);
        const endLine = parseInt(endStr, 10);
        if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) {
          throw new ProviderUnavailableError(`codegraph node parse error: ${line}`);
        }
        // Query for exact unique row to get the id
        const id = await this.resolveExactId(name, file, kind);
        ranges.push({ id, name, file, startLine, endLine, signature });
      }
    }
    return ranges.sort((a, b) =>
      a.file === b.file
        ? a.startLine === b.startLine
          ? a.id.localeCompare(b.id)
          : a.startLine - b.startLine
        : a.file.localeCompare(b.file),
    );
  }

  async getCallers(ids: string[], budget: GraphBudget): Promise<EdgeRef[]> {
    const edges: EdgeRef[] = [];
    for (const id of ids) {
      const name = id.split("#").pop() ?? id;
      let result: CommandResult;
      try {
        result = await this.runner({
          executable: "codegraph",
          args: ["callers", "--path", this.projectRealpath, "--json", "--limit", "50", name],
          cwd: this.projectRealpath,
        });
      } catch {
        throw new ProviderUnavailableError(`codegraph callers failed for ${name}`);
      }
      if (result.exitCode !== 0) continue;
      try {
        const parsed = JSON.parse(result.stdout);
        if (!Array.isArray(parsed)) {
          throw new ProviderUnavailableError("callers output not array");
        }
        for (const row of parsed) {
          if (!row.source || !row.target || !row.kind) {
            throw new ProviderUnavailableError("callers row missing fields");
          }
          if (row.kind !== "calls") continue;
          edges.push({
            from: row.source,
            to: row.target,
            origin: "codegraph-static",
            confidence: null,
            resolvedBy: "codegraph-cli",
          });
        }
      } catch (e) {
        if (e instanceof ProviderUnavailableError) throw e;
        throw new ProviderUnavailableError(`callers JSON parse error: ${e}`);
      }
    }
    return edges.slice(0, budget.maxEdges);
  }

  async getCallees(ids: string[], budget: GraphBudget): Promise<EdgeRef[]> {
    const edges: EdgeRef[] = [];
    for (const id of ids) {
      const name = id.split("#").pop() ?? id;
      let result: CommandResult;
      try {
        result = await this.runner({
          executable: "codegraph",
          args: ["callees", "--path", this.projectRealpath, "--json", "--limit", "50", name],
          cwd: this.projectRealpath,
        });
      } catch {
        throw new ProviderUnavailableError(`codegraph callees failed for ${name}`);
      }
      if (result.exitCode !== 0) continue;
      try {
        const parsed = JSON.parse(result.stdout);
        if (!Array.isArray(parsed)) {
          throw new ProviderUnavailableError("callees output not array");
        }
        for (const row of parsed) {
          if (!row.source || !row.target || !row.kind) {
            throw new ProviderUnavailableError("callees row missing fields");
          }
          if (row.kind !== "calls") continue;
          edges.push({
            from: row.source,
            to: row.target,
            origin: "codegraph-static",
            confidence: null,
            resolvedBy: "codegraph-cli",
          });
        }
      } catch (e) {
        if (e instanceof ProviderUnavailableError) throw e;
        throw new ProviderUnavailableError(`callees JSON parse error: ${e}`);
      }
    }
    return edges.slice(0, budget.maxEdges);
  }

  private async resolveExactId(name: string, file: string, kind: string): Promise<string> {
    let result: CommandResult;
    try {
      result = await this.runner({
        executable: "codegraph",
        args: ["query", "--path", this.projectRealpath, "--json", "--limit", "100", name],
        cwd: this.projectRealpath,
      });
    } catch {
      throw new ProviderUnavailableError(`codegraph query failed for ${name}`);
    }
    if (result.exitCode !== 0) {
      throw new ProviderUnavailableError(`codegraph query exit ${result.exitCode} for ${name}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.stdout);
    } catch {
      throw new ProviderUnavailableError(`codegraph query JSON parse error for ${name}`);
    }
    if (!Array.isArray(parsed)) {
      throw new ProviderUnavailableError(`codegraph query output not array for ${name}`);
    }
    // Only accept exact name + filePath + kind with unique row
    const matches = (parsed as Record<string, string>[]).filter(
      (r) => r.name === name && r.file_path === file && r.kind === kind,
    );
    if (matches.length === 0) {
      throw new ProviderUnavailableError(`NOT_FOUND: ${name} in ${file}`);
    }
    if (matches.length > 1) {
      throw new ProviderUnavailableError(`AMBIGUOUS: ${name} in ${file} (${matches.length} rows)`);
    }
    return matches[0].id;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface NodeRow {
  id: string;
  kind: string;
  name: string;
  qualified_name: string;
  file_path: string;
  start_line: number;
  end_line: number;
  signature: string;
}

interface EdgeRow {
  source: string;
  target: string;
  kind: string;
  metadata: string | null;
}

function parseEdgeRow(row: EdgeRow, _direction: "caller" | "callee"): EdgeRef {
  let confidence: number | null = null;
  let resolvedBy: string | null = null;
  if (row.metadata) {
    try {
      const meta = JSON.parse(row.metadata) as { confidence?: number | null; resolvedBy?: string | null };
      confidence = typeof meta.confidence === "number" ? meta.confidence : null;
      resolvedBy = typeof meta.resolvedBy === "string" ? meta.resolvedBy : null;
    } catch {
      // metadata JSON parse failure — leave as null/null
    }
  }
  return {
    from: row.source,
    to: row.target,
    origin: "codegraph-static",
    confidence,
    resolvedBy,
  };
}
