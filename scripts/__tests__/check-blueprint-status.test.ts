// check-blueprint-status.test.ts — PHASE-05 漂移 lint 组件测试（bun:test）
//
// 覆盖：
//   1. all_pass_zero_drift      当前真实 blueprints/ 零漂移（ok=true, failedChecks=[]）
//   2. single_failure_per_check 9 个单失败突变，每个恰好失败一项检查（其余 8 项通过）
//   3. cli_exit_zero            `bun run scripts/check-blueprint-status.ts` exit 0
//
// 突变夹具写入操作系统临时目录（绝不触碰真实 blueprints/）；lint 为只读。
// check 6（更新日期 vs git）的突变使用临时 git 仓库以控制提交日期。

import { afterAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { checkBlueprintStatus, CHECK_NAMES } from "../check-blueprint-status.ts";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");

// ─── 临时夹具管理 ───

const createdDirs: string[] = [];

function newTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "bp-lint-"));
  createdDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of createdDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  }
});

/** 写入一组相对路径文件到 base 目录。 */
function writeFiles(base: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(base, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf8");
  }
}

// ─── INDEX / blueprint 生成器 ───

type IndexSpec = {
  active?: string[];
  closed?: string[];
  archived?: string[];
  exempt?: string[];
  /** 反向边视图行：[subject, dependent] */
  reverse?: Array<[string, string]>;
};

function buildIndex(spec: IndexSpec): string {
  const lines: string[] = ["# blueprints/ INDEX Board", ""];
  const table = (title: string, rows: string[][], header: string) => {
    lines.push(`## ${title}`, "");
    lines.push(header);
    lines.push("|------|------|");
    for (const row of rows) lines.push(`| ${row.join(" | ")} |`);
    lines.push("");
  };
  table(
    "活跃",
    (spec.active ?? []).map((f) => [f, "已完成", "头部自述", "2026-07-28", ""]),
    "| 文件 | 状态 | truth | 日期 | 备注 |",
  );
  table("已闭环", (spec.closed ?? []).map((f) => [f, "已完成", "x", "2026-07-28", ""]), "| 文件 | 状态 | truth | 日期 | 备注 |");
  table(
    "已归档",
    (spec.archived ?? []).map((f) => [f, "已退役", "x", "2026-07-28", ""]),
    "| 文件 | 状态 | truth | 日期 | 备注 |",
  );
  lines.push("## 反向边视图", "");
  lines.push("| 主体 | 反向关系 | 依赖方 | 日期 |");
  lines.push("|------|---------|--------|------|");
  for (const [subject, dependent] of spec.reverse ?? []) {
    lines.push(`| ${subject} | 反向 | ${dependent} | 2026-07-28 |`);
  }
  lines.push("");
  table("豁免清单", (spec.exempt ?? []).map((f) => [f, "sha", "frozen"]), "| 文件 | SHA | 理由 |");
  return lines.join("\n") + "\n";
}

function buildBlueprint(opts: {
  title?: string;
  created?: string;
  updated?: string;
  status?: string;
  related?: string;
  /** 设为 true 则省略对应字段（用于 check 1 突变） */
  omit?: Array<"创建日期" | "更新日期" | "状态" | "相关蓝图">;
}): string {
  const omit = new Set(opts.omit ?? []);
  const lines = [`# Blueprint: ${opts.title ?? "Test"}`, ""];
  if (!omit.has("创建日期")) lines.push(`**创建日期**: ${opts.created ?? "2026-07-28"}`);
  if (!omit.has("更新日期")) lines.push(`**更新日期**: ${opts.updated ?? "2026-07-28"}`);
  if (!omit.has("状态")) lines.push(`**状态**: ${opts.status ?? "已完成"}`);
  if (!omit.has("相关蓝图")) lines.push(`**相关蓝图**: ${opts.related ?? "无"}`);
  lines.push("", "正文。", "");
  return lines.join("\n");
}

type Fixture = {
  index: IndexSpec;
  /** 根目录 blueprint 文件：basename -> 内容 */
  root: Record<string, string>;
  /** 归档文件：相对 blueprints/ 路径（archive/...） -> 内容 */
  archive: Record<string, string>;
  /** plans/ 文件：相对 workspace 路径 -> 内容 */
  plans: Record<string, string>;
  /** audits/ 文件：相对 workspace 路径 -> 内容 */
  audits: Record<string, string>;
};

/** 物化夹具到临时目录，返回 blueprintsDir 绝对路径。 */
function materialize(fixture: Fixture): string {
  const workspace = newTempDir();
  const blueprintsDir = join(workspace, "blueprints");
  const files: Record<string, string> = {};
  files["blueprints/INDEX.md"] = buildIndex(fixture.index);
  for (const [name, content] of Object.entries(fixture.root)) {
    files[`blueprints/${name}`] = content;
  }
  for (const [rel, content] of Object.entries(fixture.archive)) {
    files[`blueprints/${rel}`] = content;
  }
  for (const [rel, content] of Object.entries(fixture.plans)) {
    files[rel] = content;
  }
  for (const [rel, content] of Object.entries(fixture.audits)) {
    files[rel] = content;
  }
  writeFiles(workspace, files);
  return blueprintsDir;
}

/** 最小全通过夹具（无 git → check 6 跳过）。 */
function baseFixture(): Fixture {
  return {
    index: { active: ["blueprint-a.md"] },
    root: { "blueprint-a.md": buildBlueprint({ title: "A" }) },
    archive: {},
    plans: {},
    audits: {},
  };
}

/** 断言恰好失败一项检查。 */
function expectOnly(blueprintsDir: string, expected: string): void {
  const result = checkBlueprintStatus({ blueprintsDir });
  expect(result.ok).toBe(false);
  expect(result.failedChecks).toEqual([expected]);
}

// ─── 1. 全通过（当前真实状态） ───

describe("all_pass_zero_drift", () => {
  test("current blueprints/ reports zero drift", () => {
    const result = checkBlueprintStatus({ blueprintsDir: join(REPO_ROOT, "blueprints") });
    expect(result.failedChecks).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test("minimal temp fixture reports zero drift", () => {
    const blueprintsDir = materialize(baseFixture());
    const result = checkBlueprintStatus({ blueprintsDir });
    expect(result.failedChecks).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test("all 9 check names are stable and present in details", () => {
    const blueprintsDir = materialize(baseFixture());
    const result = checkBlueprintStatus({ blueprintsDir });
    expect(Object.keys(result.details).sort()).toEqual([...CHECK_NAMES].sort());
  });
});

// ─── 2. 九项单失败突变 ───

describe("single_failure_per_check", () => {
  test("check 1: four_field_existence — missing 创建日期", () => {
    const fixture = baseFixture();
    fixture.root["blueprint-a.md"] = buildBlueprint({ title: "A", omit: ["创建日期"] });
    expectOnly(materialize(fixture), "four_field_existence");
  });

  test("check 2: status_enum — illegal status value", () => {
    const fixture = baseFixture();
    fixture.root["blueprint-a.md"] = buildBlueprint({ title: "A", status: "非法状态" });
    expectOnly(materialize(fixture), "status_enum");
  });

  test("check 3: pause_requires_cause — 已暂停 without 暂停于 edge", () => {
    const fixture = baseFixture();
    fixture.root["blueprint-a.md"] = buildBlueprint({ title: "A", status: "已暂停", related: "无" });
    expectOnly(materialize(fixture), "pause_requires_cause");
  });

  test("check 4: edge_target_exists — edge to missing file", () => {
    const fixture = baseFixture();
    fixture.root["blueprint-a.md"] = buildBlueprint({ title: "A", related: "前置依赖 → blueprint-missing.md" });
    // INDEX 反向视图登记该边，使 check 7 通过；目标文件不创建，使 check 4 失败。
    fixture.index.reverse = [["blueprint-missing.md", "blueprint-a.md"]];
    expectOnly(materialize(fixture), "edge_target_exists");
  });

  test("check 5: pause_chain_acyclic — two-node pause cycle", () => {
    const fixture: Fixture = {
      index: {
        active: ["blueprint-a.md", "blueprint-b.md"],
        reverse: [
          ["blueprint-b.md", "blueprint-a.md"],
          ["blueprint-a.md", "blueprint-b.md"],
        ],
      },
      root: {
        "blueprint-a.md": buildBlueprint({ title: "A", status: "已暂停", related: "暂停于 → blueprint-b.md" }),
        "blueprint-b.md": buildBlueprint({ title: "B", status: "已暂停", related: "暂停于 → blueprint-a.md" }),
      },
      archive: {},
      plans: {},
      audits: {},
    };
    expectOnly(materialize(fixture), "pause_chain_acyclic");
  });

  test("check 6: update_date_vs_git — 更新日期 drifts from git commit date", () => {
    const workspace = newTempDir();
    const blueprintsDir = join(workspace, "blueprints");
    writeFiles(workspace, {
      "blueprints/INDEX.md": buildIndex({ active: ["blueprint-a.md"] }),
      // 更新日期 设为远古日期，与提交日期（2026-07-28）相差超过 1 日。
      "blueprints/blueprint-a.md": buildBlueprint({ title: "A", updated: "2020-01-01" }),
    });
    const git = (args: string[], env?: Record<string, string>) =>
      execFileSync("git", ["-C", workspace, ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, ...env },
      });
    git(["init", "-q"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "test"]);
    git(["add", "-A"]);
    git(["commit", "-q", "-m", "fixture", "--date=2026-07-28T10:00:00+09:00"], {
      GIT_AUTHOR_DATE: "2026-07-28T10:00:00+09:00",
      GIT_COMMITTER_DATE: "2026-07-28T10:00:00+09:00",
    });
    expectOnly(blueprintsDir, "update_date_vs_git");
  });

  test("check 7: index_reverse_view — file edge missing from reverse view", () => {
    const fixture: Fixture = {
      index: { active: ["blueprint-a.md", "blueprint-b.md"], reverse: [] },
      root: {
        "blueprint-a.md": buildBlueprint({ title: "A", related: "前置依赖 → blueprint-b.md" }),
        "blueprint-b.md": buildBlueprint({ title: "B" }),
      },
      archive: {},
      plans: {},
      audits: {},
    };
    expectOnly(materialize(fixture), "index_reverse_view");
  });

  test("check 8: index_coverage — file on disk not registered in INDEX", () => {
    const fixture: Fixture = {
      index: { active: ["blueprint-a.md"] }, // blueprint-b.md 未登记
      root: {
        "blueprint-a.md": buildBlueprint({ title: "A" }),
        "blueprint-b.md": buildBlueprint({ title: "B" }),
      },
      archive: {},
      plans: {},
      audits: {},
    };
    expectOnly(materialize(fixture), "index_coverage");
  });

  test("check 9: archived_not_referenced — active plan references archived file", () => {
    const fixture: Fixture = {
      index: { active: ["blueprint-a.md"], archived: ["archive/2026-07/blueprint-old.md"] },
      root: { "blueprint-a.md": buildBlueprint({ title: "A" }) },
      archive: { "archive/2026-07/blueprint-old.md": buildBlueprint({ title: "Old", status: "已退役" }) },
      plans: { "plans/active-plan/00-plan-index.md": "see blueprint-old.md for context" },
      audits: {},
    };
    expectOnly(materialize(fixture), "archived_not_referenced");
  });

  test("check 9 negative: governance provenance reference is exempt", () => {
    const fixture: Fixture = {
      index: { active: ["blueprint-a.md"], archived: ["archive/2026-07/blueprint-old.md"] },
      root: { "blueprint-a.md": buildBlueprint({ title: "A" }) },
      archive: { "archive/2026-07/blueprint-old.md": buildBlueprint({ title: "Old", status: "已退役" }) },
      // 治理 provenance 子目录内的引用应被豁免 → 仍零漂移
      plans: { "plans/blueprints-governance/formal-plan-set/02-archive.md": "archived blueprint-old.md" },
      audits: { "audits/blueprints-governance/2026-07-28-audit.md": "blueprint-old.md retired" },
    };
    const result = checkBlueprintStatus({ blueprintsDir: materialize(fixture) });
    expect(result.failedChecks).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

// ─── 3. CLI ───

describe("cli_exit_zero", () => {
  test("bun run scripts/check-blueprint-status.ts exits 0 on current state", () => {
    const run = Bun.spawnSync({
      cmd: ["bun", "run", "scripts/check-blueprint-status.ts"],
      cwd: REPO_ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(run.exitCode).toBe(0);
    expect(run.stdout.toString()).toContain("zero drift");
  });
});
