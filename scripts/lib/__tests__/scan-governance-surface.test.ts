import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { scanGovernanceSurface, type ScanResult } from "../scan-governance-surface.ts";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../..");
const MANIFEST_PATH = resolve(WORKTREE_ROOT, "scripts/lib/governance-surface-manifest.yaml");

describe("scan-governance-surface", () => {
  test("scanner runs all checks to completion and produces a complete finding set", () => {
    const result = scanGovernanceSurface(MANIFEST_PATH);
    // All checks must be executed
    expect(result.checks_executed).toContain("manifest_schema_validation");
    expect(result.checks_executed).toContain("hash_integrity");
    expect(result.checks_executed).toContain("duplicate_entries");
    expect(result.checks_executed).toContain("forbidden_references");
    expect(result.checks_executed).toContain("consumer_local_parsers");
    expect(result.checks_executed).toContain("historical_not_opened");
    // Entries were checked
    expect(result.entries_checked).toBeGreaterThan(0);
  });

  test("scanner reports F-PHASE01-TEMPLATE-PROGRESSION-MARKER as CLOSED after template repair", () => {
    const result = scanGovernanceSurface(MANIFEST_PATH);
    const finding = result.findings.find(f => f.finding_id === "F-PHASE01-TEMPLATE-PROGRESSION-MARKER");
    expect(finding).toBeUndefined();
  });

  test("scanner does NOT flag the legitimate plan-index progression marker in phase-progression.ts", () => {
    const result = scanGovernanceSurface(MANIFEST_PATH);
    const finding = result.findings.find(f => f.finding_id.includes("phase-progression.ts"));
    expect(finding).toBeUndefined();
  });

  test("scanner no longer flags validate-audit.ts after PHASE-04 v3 rewiring", () => {
    const result = scanGovernanceSurface(MANIFEST_PATH);
    const findings = result.findings.filter(f => f.finding_id.includes("validate-audit.ts"));
    expect(findings).toHaveLength(0);
  });

  test("scanner does NOT flag audit-boundary-precheck.ts after PHASE-03 v3 rewiring", () => {
    const result = scanGovernanceSurface(MANIFEST_PATH);
    const finding = result.findings.find(f => f.finding_id.includes("audit-boundary-precheck.ts"));
    expect(finding).toBeUndefined();
  });

  test("scanner surfaces no prepare-audit/pre-check-evidence consumer-local findings after PHASE-04 (capture-state and generate-evidence-receipt also CLOSED)", () => {
    const result = scanGovernanceSurface(MANIFEST_PATH);
    // capture-state.ts and generate-evidence-receipt.ts are v3 — no finding
    const closedFindings = result.findings.filter(f =>
      f.finding_id.includes("capture-state.ts") ||
      f.finding_id.includes("generate-evidence-receipt.ts") ||
      f.finding_id.includes("prepare-audit.ts") ||
      f.finding_id.includes("pre-check-evidence.ts")
    );
    expect(closedFindings).toHaveLength(0);
  });

  test("scanner surfaces NO scope-lock-template.json pre-v3 findings after PHASE-05 v3-ification", () => {
    const result = scanGovernanceSurface(MANIFEST_PATH);
    // evidence-receipt-template.json is v3 — no finding
    const receiptTemplateFinding = result.findings.find(f => f.finding_id.includes("evidence-receipt-template.json"));
    expect(receiptTemplateFinding).toBeUndefined();
    // scope-lock-template.json is now v3 (audit-scope-lock/v3 + v3-required) — both findings CLOSED
    const scopeTemplateFindings = result.findings.filter(f => f.finding_id.includes("scope-lock-template.json"));
    expect(scopeTemplateFindings).toHaveLength(0);
  });

  test("scanner does NOT stop at first finding — reports complete set", () => {
    const result = scanGovernanceSurface(MANIFEST_PATH);
    // After PHASE-05: all findings CLOSED, zero open findings remain
    expect(result.findings.length).toBe(0);
  });

  test("scanner reports NO_OPEN_FINDINGS status after PHASE-05", () => {
    const result = scanGovernanceSurface(MANIFEST_PATH);
    expect(result.status).toBe("NO_OPEN_FINDINGS");
  });

  test("scanner uses shared parser for manifest schema validation", () => {
    const result = scanGovernanceSurface(MANIFEST_PATH);
    // The manifest_schema_validation check ran without BLOCKING finding
    // (manifest is valid audit-governance-surface/v3::governance-surface-manifest)
    const manifestBlocking = result.findings.find(f => f.finding_id === "F-MANIFEST-SCHEMA-INVALID");
    expect(manifestBlocking).toBeUndefined();
  });

  test("historical entries are classified by path only and never opened", () => {
    const result = scanGovernanceSurface(MANIFEST_PATH);
    // No BLOCKING finding about historical hash exposure
    const historicalBlocking = result.findings.filter(f => f.finding_id.startsWith("F-HISTORICAL-HASH-EXPOSED"));
    expect(historicalBlocking).toHaveLength(0);
  });
});
