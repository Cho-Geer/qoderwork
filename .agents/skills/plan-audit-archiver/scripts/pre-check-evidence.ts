#!/usr/bin/env bun
// pre-check-evidence.ts — 证据文件预检脚本（第一道闸门）
//
// 用途: 在创建/修改 EV-NNN 证据文件后、运行 validate-audit.ts 之前进行快速检查。
// 设计原则: 检查规则的唯一真相来源是本脚本的代码逻辑。
//          禁止在其他文档（SKILL.md、reference.md、记忆）中复制检查规则列表。
//          新增检查规则时，只修改本脚本代码。
//
// 用法:
//   bun run .agents/skills/plan-audit-archiver/scripts/pre-check-evidence.ts <audit-dir>
//   <audit-dir> = 审计目录路径（如 audits/p0-2/）
//
// 退出码:
//   0 = 全部检查通过，可以继续运行 validate-audit.ts
//   1 = 发现问题，必须修复后才能继续

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, basename } from "node:path";

// ─── 类型定义 ───

type Issue = {
  rule: string;
  file: string;
  field: string;
  message: string;
  fix: string;
};

type EvidenceReceipt = {
  file: string;
  id: string;
  audit_id: string;
  generation: number;
  command: string;
  observed: string;
  polarity: string;
  exit_code: number;
  cwd: string;
  artifacts: unknown[];
  requirement_id: string;
};

// ─── 检查规则常量 ───

const ALLOWED_POLARITIES = ["POSITIVE", "NEGATIVE", "POST_FIX"] as const;

// ─── 工具函数 ───

function fail(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function parseJsonFile(filePath: string): Record<string, unknown> {
  try {
    const content = readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    fail(`无法解析 JSON 文件 ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function findLatestAuditReport(auditDir: string): string | null {
  if (!existsSync(auditDir)) return null;
  // 优先读 LATEST.md 指针
  const latestPath = join(auditDir, "LATEST.md");
  if (existsSync(latestPath)) {
    const content = readFileSync(latestPath, "utf8");
    const match = content.match(/`([^`]+\.md)`/);
    if (match) {
      const candidate = join(auditDir, match[1]);
      if (existsSync(candidate)) return candidate;
    }
  }
  // 回退: 按修改时间降序取最新的审计报告
  const files = readdirSync(auditDir)
    .filter((f) => f.endsWith(".md") && f.match(/\d{4}-\d{2}-\d{2}-.*audit/) && !f.includes("LATEST"))
    .map((f) => ({ name: f, path: join(auditDir, f), mtime: statSync(join(auditDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length > 0 ? files[0].path : null;
}

function extractAuditContract(reportPath: string): { audit_id: string; generation: number } | null {
  const content = readFileSync(reportPath, "utf8");
  const startMarker = "<!-- AUDIT_CONTRACT_START -->";
  const endMarker = "<!-- AUDIT_CONTRACT_END -->";
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return null;
  const jsonBlock = content.slice(startIdx + startMarker.length, endIdx).trim();
  // 移除 ```json 和 ``` 包裹
  const cleaned = jsonBlock.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  try {
    const contract = JSON.parse(cleaned);
    return {
      audit_id: String(contract.audit_id ?? ""),
      generation: Number(contract.generation ?? 0),
    };
  } catch {
    return null;
  }
}

function findEvidenceFiles(auditDir: string): string[] {
  const evidenceDir = join(auditDir, "evidence");
  if (!existsSync(evidenceDir)) return [];
  return readdirSync(evidenceDir)
    .filter((f) => f.startsWith("ev-") && f.endsWith(".json"))
    .map((f) => join(evidenceDir, f))
    .sort();
}

// ─── 检查函数 ───

function checkCommandCd(receipt: EvidenceReceipt, issues: Issue[]): void {
  const { command, cwd, file, id } = receipt;
  if (!command) {
    issues.push({
      rule: "COMMAND_CWD_MISSING",
      file,
      field: "command",
      message: `${id}: command 字段为空`,
      fix: `请填写 command，格式: cd ${cwd || "<工作目录>"} && <实际命令>`,
    });
    return;
  }
  if (!command.startsWith("cd ")) {
    issues.push({
      rule: "COMMAND_CWD_MISSING",
      file,
      field: "command",
      message: `${id}: command 不以 "cd " 开头，当前值: "${command.slice(0, 50)}..."`,
      fix: `请改为: cd ${cwd || "<工作目录>"} && ${command}`,
    });
    return;
  }
  if (cwd && !command.startsWith(`cd ${cwd} && `)) {
    issues.push({
      rule: "COMMAND_CWD_MISMATCH",
      file,
      field: "command",
      message: `${id}: command 的 cd 路径与 cwd 不一致`,
      fix: `command 必须以 "cd ${cwd} && " 开头`,
    });
  }
}

function checkPolarityWhitelist(receipt: EvidenceReceipt, issues: Issue[]): void {
  const { polarity, file, id } = receipt;
  if (!polarity) {
    issues.push({
      rule: "POLARITY_MISSING",
      file,
      field: "polarity",
      message: `${id}: polarity 字段为空`,
      fix: `请填写 polarity，允许值: ${ALLOWED_POLARITIES.join(" / ")}`,
    });
    return;
  }
  if (!ALLOWED_POLARITIES.includes(polarity as (typeof ALLOWED_POLARITIES)[number])) {
    issues.push({
      rule: "INVALID_RECEIPT_POLARITY",
      file,
      field: "polarity",
      message: `${id}: polarity="${polarity}" 不在白名单中`,
      fix: `请改为: ${ALLOWED_POLARITIES.join(" / ")} 之一（注意: "PRE_FIX" 不被允许，请用 "NEGATIVE" 代替）`,
    });
  }
}

function checkExitObservedConsistency(receipt: EvidenceReceipt, issues: Issue[]): void {
  const { observed, exit_code, file, id } = receipt;
  if (observed === "PASS" && exit_code !== 0) {
    issues.push({
      rule: "RECEIPT_EXIT_OBSERVATION_MISMATCH",
      file,
      field: "exit_code",
      message: `${id}: observed=PASS 但 exit_code=${exit_code}（PASS 要求 exit_code=0）`,
      fix: `请将 exit_code 改为 0，或将 observed 改为 FAIL`,
    });
  }
  if (observed === "FAIL" && exit_code === 0) {
    issues.push({
      rule: "RECEIPT_EXIT_OBSERVATION_MISMATCH",
      file,
      field: "exit_code",
      message: `${id}: observed=FAIL 但 exit_code=0（FAIL 要求非零 exit_code）`,
      fix: `请将 exit_code 改为非零值（如 1），或将 observed 改为 PASS`,
    });
  }
}

function checkArtifactsNonempty(receipt: EvidenceReceipt, issues: Issue[]): void {
  const { artifacts, file, id } = receipt;
  if (!artifacts || artifacts.length === 0) {
    issues.push({
      rule: "EMPTY_ARRAY",
      file,
      field: "artifacts",
      message: `${id}: artifacts 数组为空`,
      fix: `请至少添加一个 artifact 文件（如 scope-lock.json 或测试输出文件）`,
    });
  }
}

function checkGenerationConsistency(
  receipt: EvidenceReceipt,
  expectedGeneration: number,
  expectedAuditId: string,
  issues: Issue[],
): void {
  const { generation, audit_id, file, id } = receipt;
  if (generation !== expectedGeneration) {
    issues.push({
      rule: "EVIDENCE_RECEIPT_AUDIT_MISMATCH",
      file,
      field: "generation",
      message: `${id}: generation=${generation} 但审计报告 generation=${expectedGeneration}`,
      fix: `请将 EV-NNN 文件的 generation 改为 ${expectedGeneration}`,
    });
  }
  if (audit_id !== expectedAuditId) {
    issues.push({
      rule: "EVIDENCE_RECEIPT_AUDIT_MISMATCH",
      file,
      field: "audit_id",
      message: `${id}: audit_id="${audit_id}" 但审计报告 audit_id="${expectedAuditId}"`,
      fix: `请将 EV-NNN 文件的 audit_id 改为 "${expectedAuditId}"`,
    });
  }
}

function checkIdUnique(receipts: EvidenceReceipt[], issues: Issue[]): void {
  const seen = new Map<string, string>();
  for (const r of receipts) {
    if (seen.has(r.id)) {
      issues.push({
        rule: "DUPLICATE_ID",
        file: r.file,
        field: "id",
        message: `${r.id}: id 与 ${basename(seen.get(r.id)!)} 重复`,
        fix: `请为每个 EV-NNN 分配唯一的 id`,
      });
    } else {
      seen.set(r.id, r.file);
    }
  }
}

// ─── 主流程 ───

function main(): void {
  const auditDir = process.argv[2];
  if (!auditDir) {
    fail("用法: pre-check-evidence.ts <audit-dir>");
  }

  const resolvedDir = resolve(auditDir);
  if (!existsSync(resolvedDir) || !statSync(resolvedDir).isDirectory()) {
    fail(`审计目录不存在或不是目录: ${resolvedDir}`);
  }

  console.log(`=== 证据文件预检（第一道闸门）===`);
  console.log(`审计目录: ${resolvedDir}`);
  console.log();

  // 1. 查找最新审计报告，提取 audit_id 和 generation
  const reportPath = findLatestAuditReport(resolvedDir);
  let expectedAuditId = "";
  let expectedGeneration = 0;

  if (reportPath) {
    console.log(`审计报告: ${basename(reportPath)}`);
    const contract = extractAuditContract(reportPath);
    if (contract) {
      expectedAuditId = contract.audit_id;
      expectedGeneration = contract.generation;
      console.log(`期望 audit_id="${expectedAuditId}", generation=${expectedGeneration}`);
    } else {
      console.log(`警告: 无法从审计报告提取 AUDIT_CONTRACT，跳过 generation/audit_id 一致性检查`);
    }
  } else {
    console.log(`警告: 未找到审计报告，跳过 generation/audit_id 一致性检查`);
  }
  console.log();

  // 2. 查找所有 EV-NNN 文件
  const evFiles = findEvidenceFiles(resolvedDir);
  if (evFiles.length === 0) {
    console.log("未找到 EV-NNN 证据文件，无需检查。");
    console.log("\n✅ 预检通过（无证据文件）");
    process.exit(0);
  }
  console.log(`发现 ${evFiles.length} 个 EV-NNN 文件:`);
  for (const f of evFiles) {
    console.log(`  ${basename(f)}`);
  }
  console.log();

  // 3. 解析所有 EV-NNN 文件
  const receipts: EvidenceReceipt[] = [];
  for (const filePath of evFiles) {
    const data = parseJsonFile(filePath);
    receipts.push({
      file: filePath,
      id: String(data.id ?? ""),
      audit_id: String(data.audit_id ?? ""),
      generation: Number(data.generation ?? 0),
      command: String(data.command ?? ""),
      observed: String(data.observed ?? ""),
      polarity: String(data.polarity ?? ""),
      exit_code: Number(data.exit_code ?? 0),
      cwd: String(data.cwd ?? ""),
      artifacts: Array.isArray(data.artifacts) ? data.artifacts : [],
      requirement_id: String(data.requirement_id ?? ""),
    });
  }

  // 4. 逐项检查
  const issues: Issue[] = [];

  // 检查 1: command 必须以 cd 开头
  for (const r of receipts) checkCommandCd(r, issues);

  // 检查 2: polarity 白名单
  for (const r of receipts) checkPolarityWhitelist(r, issues);

  // 检查 3: exit_code 与 observed 一致性
  for (const r of receipts) checkExitObservedConsistency(r, issues);

  // 检查 4: artifacts 非空
  for (const r of receipts) checkArtifactsNonempty(r, issues);

  // 检查 5: generation/audit_id 一致性（仅当有审计报告时）
  if (expectedAuditId && expectedGeneration > 0) {
    for (const r of receipts) {
      checkGenerationConsistency(r, expectedGeneration, expectedAuditId, issues);
    }
  }

  // 检查 6: id 唯一性
  checkIdUnique(receipts, issues);

  // 5. 输出结果
  if (issues.length === 0) {
    console.log("✅ 预检通过（0 个问题）");
    console.log("   可以继续运行 validate-audit.ts 进行最终验证。");
    process.exit(0);
  } else {
    console.log(`❌ 预检发现 ${issues.length} 个问题:`);
    console.log();
    for (const issue of issues) {
      console.log(`  [${issue.rule}] ${issue.message}`);
      console.log(`    文件: ${basename(issue.file)}`);
      console.log(`    字段: ${issue.field}`);
      console.log(`    修复: ${issue.fix}`);
      console.log();
    }
    console.log("请修复以上问题后重新运行预检。");
    console.log("禁止跳过预检直接运行 validate-audit.ts。");
    process.exit(1);
  }
}

main();
