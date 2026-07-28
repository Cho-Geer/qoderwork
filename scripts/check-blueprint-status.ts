#!/usr/bin/env bun
// check-blueprint-status.ts — blueprints/ 目录漂移 lint（M8，BP §2.2.8）
//
// 只读检查：扫描 blueprints/ 根目录与 archive/ 子目录的 .md 文件以及 INDEX.md，
// 运行 9 项漂移检查，聚合为 { ok, failedChecks }。exit 0 = 零漂移，非零 = 漂移清单。
//
// 9 项检查（BP §2.2.8）：
//   1. four_field_existence   四字段存在性（创建日期/更新日期/状态/相关蓝图）
//   2. status_enum            状态值 ∈ 七值词汇表
//   3. pause_requires_cause   已暂停 ⇒ 暂停于边非空
//   4. edge_target_exists     边目标文件存在
//   5. pause_chain_acyclic    暂停链无环
//   6. update_date_vs_git     更新日期 vs git log -1（豁免文件跳过）
//   7. index_reverse_view     INDEX 反向派生视图与单边边一致
//   8. index_coverage         INDEX 三段登记（+豁免清单）与实际目录文件集合一致
//   9. archived_not_referenced 归档文件不被活跃 plans//audits/ 新引用
//
// 设计原则：纯读取 + 报告；不写任何文件，不修改 blueprints/，不引入 npm 依赖。
// 仅用 node:fs / node:path / node:child_process。
//
// 用法：
//   bun run scripts/check-blueprint-status.ts            # 检查 ./blueprints
//   bun run scripts/check-blueprint-status.ts <dir>       # 检查指定 blueprints 目录
//
// 模块导出：checkBlueprintStatus(options?) 供组件测试导入。

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

// ─── 公共类型 ───

export type CheckResult = { pass: boolean; failures: string[] };

export type LintOptions = {
  /** blueprints/ 目录绝对或相对路径；默认 <cwd>/blueprints */
  blueprintsDir?: string;
};

export type LintResult = {
  ok: boolean;
  failedChecks: string[];
  /** 每项检查的明细（检查名 → 结果），用于诊断与测试 */
  details: Record<string, CheckResult>;
};

// ─── 常量 ───

/** 七值状态词汇表（BP §2.2.3） */
export const STATUS_VALUES = [
  "草稿",
  "待审批",
  "待实施",
  "实施中",
  "已暂停",
  "已完成",
  "已退役",
] as const;

/** 四字段名（BP §2.2.2） */
export const FOUR_FIELDS = ["创建日期", "更新日期", "状态", "相关蓝图"] as const;

/** 稳定检查名（failedChecks 使用） */
export const CHECK_NAMES = [
  "four_field_existence",
  "status_enum",
  "pause_requires_cause",
  "edge_target_exists",
  "pause_chain_acyclic",
  "update_date_vs_git",
  "index_reverse_view",
  "index_coverage",
  "archived_not_referenced",
] as const;

export type CheckName = (typeof CHECK_NAMES)[number];

/** 因果边关系词汇表（BP §2.2.4）。注意：被取代（机制吸收） 必须先于 被取代 匹配。 */
const EDGE_RELATIONS = ["被取代（机制吸收）", "被取代", "前置依赖", "暂停于"] as const;

/**
 * check 9 排除的治理 provenance 子目录（相对 workspace 根）。
 * blueprints-governance 计划/审计链是执行归档操作本身的冻结 provenance 记录，
 * 其内部对归档文件的引用属于历史记录，不视为“活跃计划新引用”。
 */
const GOVERNANCE_PROVENANCE_PREFIXES = [
  join("plans", "blueprints-governance"),
  join("audits", "blueprints-governance"),
];

// ─── 解析后的蓝图模型 ───

type BlueprintFile = {
  /** 相对 blueprintsDir 的文件名（根目录 basename） */
  name: string;
  absPath: string;
  content: string;
  /** 四字段值（缺失为 null） */
  fields: Record<(typeof FOUR_FIELDS)[number], string | null>;
  /** 解析出的因果边 */
  edges: Edge[];
};

type Edge = {
  relation: string;
  arrow: "←" | "→";
  target: string;
};

type ArchiveFile = {
  /** 相对 blueprintsDir 的路径，如 archive/2026-07/x.md */
  relPath: string;
  absPath: string;
  name: string;
};

type IndexModel = {
  /** 各登记段抽取的文件 key（相对 blueprintsDir） */
  active: string[];
  closed: string[];
  archived: string[];
  exempt: string[];
  /** 反向边视图行：(subject, dependent) 对 */
  reversePairs: Array<{ subject: string; dependent: string }>;
  raw: string;
};

type LintContext = {
  blueprintsDir: string;
  workspaceRoot: string;
  blueprints: BlueprintFile[];
  /** 根目录全部 .md（含 INDEX 与豁免），basename 集合 */
  rootAllNames: string[];
  archiveFiles: ArchiveFile[];
  index: IndexModel;
  exemptSet: Set<string>;
  indexContent: string;
};

// ─── 底层工具 ───

function isFile(p: string): boolean {
  return existsSync(p) && statSync(p).isFile();
}

function isDir(p: string): boolean {
  return existsSync(p) && statSync(p).isDirectory();
}

function readText(p: string): string {
  return readFileSync(p, "utf8");
}

/** 提取头部字段值：`**字段**: 值`（兼容全角冒号），缺失返回 null。 */
function parseField(content: string, field: string): string | null {
  const re = new RegExp(`^\\*\\*${field}\\*\\*\\s*[:：]\\s*(.*?)\\s*$`, "m");
  const m = content.match(re);
  if (!m) return null;
  const value = m[1].trim();
  return value.length > 0 ? value : null;
}

/** 从一段文本中解析因果边列表。 */
function parseEdges(relValue: string | null): Edge[] {
  if (!relValue) return [];
  const trimmed = relValue.trim();
  if (trimmed === "无" || trimmed === "") return [];
  const edges: Edge[] = [];
  const relationAlt = EDGE_RELATIONS.map((r) => r.replace(/（/g, "\\（").replace(/）/g, "\\）")).join("|");
  const re = new RegExp(`(${relationAlt})\\s*([←→])\\s*([A-Za-z0-9][A-Za-z0-9._-]*\\.md)`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(relValue)) !== null) {
    edges.push({ relation: m[1], arrow: m[2] as "←" | "→", target: m[3] });
  }
  return edges;
}

/** 列出目录下（递归）指定扩展名的文件绝对路径。 */
function walkFiles(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  if (!isDir(dir)) return out;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const abs = join(current, entry);
      if (isDir(abs)) {
        stack.push(abs);
      } else if (isFile(abs) && exts.some((e) => entry.endsWith(e))) {
        out.push(abs);
      }
    }
  }
  return out.sort();
}

// ─── INDEX 解析 ───

/** 抽取某个 `## 段名` 区块的正文（到下一个 `## ` 或文件尾）。 */
function extractSection(markdown: string, title: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let inside = false;
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      inside = line.replace(/^##\s*/, "").trim().startsWith(title);
      continue;
    }
    if (inside) out.push(line);
  }
  return out.join("\n");
}

/** 从表格段正文中抽取数据行第一列的文件 key（相对 blueprintsDir）。 */
function parseSectionFileKeys(sectionBody: string): string[] {
  const keys: string[] = [];
  for (const line of sectionBody.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const cells = trimmed.split("|").map((c) => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length);
    if (cells.length === 0) continue;
    const first = cells[0];
    // 跳过表头与分隔行
    if (/^[-: ]+$/.test(first)) continue;
    if (/^(文件|主体)/.test(first)) continue;
    // 第一列可能形如 blueprint-a.md 或 archive/2026-06/x.md（可能带 markdown 链接/反引号）
    const m = first.match(/((?:archive\/)?[A-Za-z0-9][A-Za-z0-9._\/-]*\.md)/);
    if (m) keys.push(m[1]);
  }
  return keys;
}

/** 解析 INDEX 反向边视图行为 (subject, dependent) 对。 */
function parseReversePairs(sectionBody: string): Array<{ subject: string; dependent: string }> {
  const pairs: Array<{ subject: string; dependent: string }> = [];
  for (const line of sectionBody.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const rawCells = trimmed.split("|");
    const cells = rawCells.map((c) => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length);
    if (cells.length < 3) continue;
    if (/^[-: ]+$/.test(cells[0])) continue;
    if (/^(主体|文件)/.test(cells[0])) continue;
    const subjectMatch = cells[0].match(/([A-Za-z0-9][A-Za-z0-9._-]*\.md)/);
    const dependentMatch = cells[2].match(/([A-Za-z0-9][A-Za-z0-9._-]*\.md)/);
    if (subjectMatch && dependentMatch) {
      pairs.push({ subject: subjectMatch[1], dependent: dependentMatch[1] });
    }
  }
  return pairs;
}

function parseIndex(indexAbsPath: string): IndexModel {
  const raw = isFile(indexAbsPath) ? readText(indexAbsPath) : "";
  return {
    active: parseSectionFileKeys(extractSection(raw, "活跃")),
    closed: parseSectionFileKeys(extractSection(raw, "已闭环")),
    archived: parseSectionFileKeys(extractSection(raw, "已归档")),
    exempt: parseSectionFileKeys(extractSection(raw, "豁免清单")),
    reversePairs: parseReversePairs(extractSection(raw, "反向边视图")),
    raw,
  };
}

// ─── 上下文构建 ───

function buildContext(options?: LintOptions): LintContext {
  const cwd = process.cwd();
  const blueprintsDir = resolve(cwd, options?.blueprintsDir ?? join(cwd, "blueprints"));
  if (!isDir(blueprintsDir)) {
    throw new Error(`blueprintsDir not found: ${blueprintsDir}`);
  }
  const workspaceRoot = dirname(blueprintsDir);

  const index = parseIndex(join(blueprintsDir, "INDEX.md"));
  const exemptSet = new Set(index.exempt.map((k) => basename(k)));

  // 根目录 .md（maxdepth 1）
  const rootAllNames = readdirSync(blueprintsDir)
    .filter((n) => n.endsWith(".md") && isFile(join(blueprintsDir, n)))
    .sort();

  const blueprints: BlueprintFile[] = [];
  for (const name of rootAllNames) {
    if (name === "INDEX.md") continue;
    if (exemptSet.has(name)) continue; // 豁免文件跳过 checks 1-6
    const absPath = join(blueprintsDir, name);
    const content = readText(absPath);
    const fields = {
      创建日期: parseField(content, "创建日期"),
      更新日期: parseField(content, "更新日期"),
      状态: parseField(content, "状态"),
      相关蓝图: parseField(content, "相关蓝图"),
    };
    blueprints.push({ name, absPath, content, fields, edges: parseEdges(fields.相关蓝图) });
  }

  // archive/ 下全部 .md
  const archiveFiles: ArchiveFile[] = walkFiles(join(blueprintsDir, "archive"), [".md"]).map((absPath) => ({
    absPath,
    relPath: relative(blueprintsDir, absPath).split("\\").join("/"),
    name: basename(absPath),
  }));

  return {
    blueprintsDir,
    workspaceRoot,
    blueprints,
    rootAllNames,
    archiveFiles,
    index,
    exemptSet,
    indexContent: index.raw,
  };
}

// ─── 9 项检查 ───

/** 1. 四字段存在性。 */
export function checkFourFieldExistence(ctx: LintContext): CheckResult {
  const failures: string[] = [];
  for (const bp of ctx.blueprints) {
    for (const field of FOUR_FIELDS) {
      if (bp.fields[field] === null) {
        failures.push(`${bp.name}: missing field ${field}`);
      }
    }
  }
  return { pass: failures.length === 0, failures };
}

/** 2. 状态值 ∈ 七值词汇表。 */
export function checkStatusEnum(ctx: LintContext): CheckResult {
  const failures: string[] = [];
  const allowed = new Set<string>(STATUS_VALUES);
  for (const bp of ctx.blueprints) {
    const status = bp.fields.状态;
    if (status === null) continue; // 缺失由 check 1 报告
    if (!allowed.has(status)) {
      failures.push(`${bp.name}: status "${status}" not in seven-value vocabulary`);
    }
  }
  return { pass: failures.length === 0, failures };
}

/** 3. 已暂停 ⇒ 暂停于边非空。 */
export function checkPauseRequiresCause(ctx: LintContext): CheckResult {
  const failures: string[] = [];
  for (const bp of ctx.blueprints) {
    if (bp.fields.状态 !== "已暂停") continue;
    const rel = bp.fields.相关蓝图 ?? "";
    if (!rel.includes("暂停于")) {
      failures.push(`${bp.name}: status 已暂停 requires a non-empty 暂停于 edge`);
    }
  }
  return { pass: failures.length === 0, failures };
}

/** 边目标是否存在于 root 或 archive。 */
function edgeTargetExists(ctx: LintContext, target: string): boolean {
  if (isFile(join(ctx.blueprintsDir, target))) return true;
  return ctx.archiveFiles.some((a) => a.name === target);
}

/** 4. 边目标文件存在。 */
export function checkEdgeTargetExists(ctx: LintContext): CheckResult {
  const failures: string[] = [];
  for (const bp of ctx.blueprints) {
    for (const edge of bp.edges) {
      if (!edgeTargetExists(ctx, edge.target)) {
        failures.push(`${bp.name}: edge target "${edge.target}" does not exist`);
      }
    }
  }
  return { pass: failures.length === 0, failures };
}

/** 5. 暂停链无环（暂停于 边构成的有向图）。 */
export function checkPauseChainAcyclic(ctx: LintContext): CheckResult {
  const failures: string[] = [];
  // 邻接表：file -> [暂停于目标]
  const graph = new Map<string, string[]>();
  for (const bp of ctx.blueprints) {
    const targets = bp.edges.filter((e) => e.relation === "暂停于").map((e) => e.target);
    if (targets.length > 0) graph.set(bp.name, targets);
  }
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const nodes = new Set<string>([...graph.keys()]);
  for (const targets of graph.values()) for (const t of targets) nodes.add(t);
  for (const n of nodes) color.set(n, WHITE);

  const stack: string[] = [];
  const state: { cycle: string[] | null } = { cycle: null };

  function dfs(node: string): void {
    if (state.cycle) return;
    color.set(node, GRAY);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      const c = color.get(next) ?? WHITE;
      if (c === GRAY) {
        const start = stack.indexOf(next);
        state.cycle = [...stack.slice(start >= 0 ? start : 0), next];
        return;
      }
      if (c === WHITE) {
        dfs(next);
        if (state.cycle) return;
      }
    }
    stack.pop();
    color.set(node, BLACK);
  }

  for (const n of nodes) {
    if ((color.get(n) ?? WHITE) === WHITE) dfs(n);
    if (state.cycle) break;
  }

  if (state.cycle) {
    failures.push(`pause chain cycle detected: ${state.cycle.join(" -> ")}`);
  }
  return { pass: failures.length === 0, failures };
}

/** 取文件最后 git 提交作者日（%ai 的日期部分）；无 git 数据返回 null。 */
function gitLastAuthorDate(workspaceRoot: string, relPath: string): string | null {
  try {
    const out = execFileSync("git", ["-C", workspaceRoot, "log", "-1", "--format=%ai", "--", relPath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (!out) return null;
    const datePart = out.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
  } catch {
    return null;
  }
}

function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = Date.UTC(ay, am - 1, ad);
  const db = Date.UTC(by, bm - 1, bd);
  return Math.abs(Math.round((da - db) / 86400000));
}

/** 6. 更新日期 vs git log -1（豁免文件已排除；±1 日容差以吸收时区差）。 */
export function checkUpdateDateVsGit(ctx: LintContext): CheckResult {
  const failures: string[] = [];
  for (const bp of ctx.blueprints) {
    const updated = bp.fields.更新日期;
    if (updated === null) continue; // 缺失由 check 1 报告
    if (!/^\d{4}-\d{2}-\d{2}$/.test(updated)) {
      failures.push(`${bp.name}: 更新日期 "${updated}" is not YYYY-MM-DD`);
      continue;
    }
    const relPath = relative(ctx.workspaceRoot, bp.absPath).split("\\").join("/");
    const gitDate = gitLastAuthorDate(ctx.workspaceRoot, relPath);
    if (gitDate === null) continue; // 无 git 数据（如临时夹具）→ 跳过
    if (dayDiff(updated, gitDate) > 1) {
      failures.push(`${bp.name}: 更新日期 ${updated} drifts from git last commit ${gitDate} (>1 day)`);
    }
  }
  return { pass: failures.length === 0, failures };
}

/** 7. INDEX 反向派生视图与单边边一致（比较 (subject, dependent) 对集合）。 */
export function checkIndexReverseView(ctx: LintContext): CheckResult {
  const failures: string[] = [];
  const derived = new Set<string>();
  for (const bp of ctx.blueprints) {
    for (const edge of bp.edges) {
      derived.add(`${edge.target}|${bp.name}`);
    }
  }
  const indexed = new Set<string>();
  for (const pair of ctx.index.reversePairs) {
    indexed.add(`${pair.subject}|${pair.dependent}`);
  }
  for (const key of derived) {
    if (!indexed.has(key)) {
      const [subject, dependent] = key.split("|");
      failures.push(`edge ${dependent} -> ${subject} missing from INDEX reverse view`);
    }
  }
  for (const key of indexed) {
    if (!derived.has(key)) {
      const [subject, dependent] = key.split("|");
      failures.push(`INDEX reverse view row ${subject} / ${dependent} has no matching single-side edge`);
    }
  }
  return { pass: failures.length === 0, failures };
}

/** 8. INDEX 三段登记（活跃+已闭环+已归档+豁免清单）与实际目录文件集合一致。 */
export function checkIndexCoverage(ctx: LintContext): CheckResult {
  const failures: string[] = [];
  const registered = new Set<string>([
    ...ctx.index.active,
    ...ctx.index.closed,
    ...ctx.index.archived,
    ...ctx.index.exempt,
  ]);
  const actual = new Set<string>();
  for (const name of ctx.rootAllNames) {
    if (name === "INDEX.md") continue;
    actual.add(name);
  }
  for (const a of ctx.archiveFiles) {
    actual.add(a.relPath);
  }
  for (const key of actual) {
    if (!registered.has(key)) {
      failures.push(`file ${key} present on disk but not registered in INDEX`);
    }
  }
  for (const key of registered) {
    if (!actual.has(key)) {
      failures.push(`INDEX registers ${key} but no such file exists on disk`);
    }
  }
  return { pass: failures.length === 0, failures };
}

const SCAN_EXTS = [".md", ".json", ".yaml", ".yml", ".txt"];

/** 9. 归档文件不被活跃 plans//audits/ 新引用（排除治理 provenance 子目录）。 */
export function checkArchivedNotReferenced(ctx: LintContext): CheckResult {
  const failures: string[] = [];
  if (ctx.archiveFiles.length === 0) return { pass: true, failures };

  const scanRoots = [join(ctx.workspaceRoot, "plans"), join(ctx.workspaceRoot, "audits")];
  const candidateFiles: string[] = [];
  for (const root of scanRoots) {
    for (const abs of walkFiles(root, SCAN_EXTS)) {
      const rel = relative(ctx.workspaceRoot, abs).split("\\").join("/");
      if (GOVERNANCE_PROVENANCE_PREFIXES.some((prefix) => rel === prefix || rel.startsWith(prefix.split("\\").join("/") + "/"))) {
        continue; // 治理 provenance 记录（归档操作本身的冻结证据）允许引用归档文件
      }
      candidateFiles.push(abs);
    }
  }

  // 预读候选文件内容
  const contents: Array<{ rel: string; text: string }> = [];
  for (const abs of candidateFiles) {
    try {
      contents.push({ rel: relative(ctx.workspaceRoot, abs).split("\\").join("/"), text: readText(abs) });
    } catch {
      // 忽略不可读文件
    }
  }

  for (const archived of ctx.archiveFiles) {
    const archivePath = `blueprints/${archived.relPath}`;
    for (const { rel, text } of contents) {
      if (text.includes(archived.name) || text.includes(archivePath)) {
        failures.push(`archived file ${archived.relPath} referenced by active record ${rel}`);
      }
    }
  }
  return { pass: failures.length === 0, failures };
}

// ─── 聚合 ───

const CHECK_FNS: Array<{ name: CheckName; fn: (ctx: LintContext) => CheckResult }> = [
  { name: "four_field_existence", fn: checkFourFieldExistence },
  { name: "status_enum", fn: checkStatusEnum },
  { name: "pause_requires_cause", fn: checkPauseRequiresCause },
  { name: "edge_target_exists", fn: checkEdgeTargetExists },
  { name: "pause_chain_acyclic", fn: checkPauseChainAcyclic },
  { name: "update_date_vs_git", fn: checkUpdateDateVsGit },
  { name: "index_reverse_view", fn: checkIndexReverseView },
  { name: "index_coverage", fn: checkIndexCoverage },
  { name: "archived_not_referenced", fn: checkArchivedNotReferenced },
];

/**
 * 运行全部 9 项漂移检查。
 * @returns ok=true 且 failedChecks=[] 表示零漂移；否则 failedChecks 列出失败的检查名。
 */
export function checkBlueprintStatus(options?: LintOptions): LintResult {
  const ctx = buildContext(options);
  const details: Record<string, CheckResult> = {};
  const failedChecks: string[] = [];
  for (const { name, fn } of CHECK_FNS) {
    const result = fn(ctx);
    details[name] = result;
    if (!result.pass) failedChecks.push(name);
  }
  return { ok: failedChecks.length === 0, failedChecks, details };
}

// ─── CLI ───

function main(): void {
  const argDir = process.argv[2];
  const blueprintsDir = argDir && argDir !== "." ? argDir : undefined;
  let result: LintResult;
  try {
    result = checkBlueprintStatus(blueprintsDir ? { blueprintsDir } : undefined);
  } catch (error) {
    console.error(`check-blueprint-status: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }

  if (result.ok) {
    console.log("check-blueprint-status: zero drift (9/9 checks passed)");
    process.exit(0);
  }

  console.log(`check-blueprint-status: DRIFT detected in ${result.failedChecks.length} check(s):`);
  for (const name of result.failedChecks) {
    console.log(`  - ${name}`);
    for (const failure of result.details[name].failures) {
      console.log(`      ${failure}`);
    }
  }
  process.exit(1);
}

if (import.meta.main) main();
