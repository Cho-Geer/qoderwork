#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { validateAuditFile } from "./validate-audit.ts";

type AuditValidator = (reportPath: string) => { valid: boolean };

export function finalizeAudit(reportPath: string, latestPath: string, validate: AuditValidator = validateAuditFile) {
  if (!existsSync(reportPath) || !statSync(reportPath).isFile() || statSync(reportPath).size === 0) throw new Error("REPORT_UNAVAILABLE");
  if (!validate(reportPath).valid) throw new Error("AUDIT_VALIDATION_FAILED");
  if (existsSync(latestPath)) throw new Error("LATEST_POINTER_CONFLICT");
  const sha256 = createHash("sha256").update(readFileSync(reportPath)).digest("hex");
  const content = `# Latest Audit\n\n- Report: \`${basename(reportPath)}\`\n- SHA-256: \`${sha256}\`\n`;
  const temp = join(dirname(latestPath), `.${basename(latestPath)}.${process.pid}.tmp`);
  writeFileSync(temp, content, { flag: "wx" }); renameSync(temp, latestPath);
  return { report: basename(reportPath), sha256 };
}
if (import.meta.main) { const [report, latest] = process.argv.slice(2); if (!report || !latest) { console.error("usage: finalize-audit.ts <report.md> <LATEST.md>"); process.exit(2); } try { console.log(JSON.stringify(finalizeAudit(resolve(report), resolve(latest)))); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); } }
