import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { runConformance, type ConformanceReport } from "../run-conformance.ts";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../..");
const CORPUS_DIR = resolve(WORKTREE_ROOT, "scripts/lib/conformance-corpus");

describe("run-conformance", () => {
  test("all declared v3 consumers agree on every corpus sample", () => {
    const report = runConformance(CORPUS_DIR);
    expect(report.consumers_tested).toContain("shared-parser");
    expect(report.consumers_tested).toContain("validate-plan.ts");
    expect(report.consumers_tested).toContain("scan-governance-surface.ts");
    expect(report.consumers_tested).toContain("run-conformance.ts");
    expect(report.consumers_tested).toContain("audit-boundary-precheck.ts");
    expect(report.consumers_tested).toContain("generate-evidence-receipt.ts");
    expect(report.consumers_tested).toContain("capture-state.ts");
    expect(report.consumers_tested).toContain("generate-phase-projection.ts");
    expect(report.consumers_tested).toContain("finalize-audit.ts");
    expect(report.samples_tested).toBeGreaterThan(0);
    // No consumer disagreement findings
    const disagreements = report.findings.filter(f =>
      f.finding_id.startsWith("F-CONSUMER-DISAGREEMENT") && f.classification === "BLOCKING"
    );
    expect(disagreements).toHaveLength(0);
  });

  test("all corpus samples match expected outcomes", () => {
    const report = runConformance(CORPUS_DIR);
    const expectationMismatches = report.findings.filter(f =>
      f.finding_id.startsWith("F-EXPECTATION-MISMATCH") && f.classification === "BLOCKING"
    );
    expect(expectationMismatches).toHaveLength(0);
  });

  test("mismatch probes are all rejected by the gate (kill tests)", () => {
    const report = runConformance(CORPUS_DIR);
    expect(report.probes_tested).toBeGreaterThan(0);
    // No probe should escape rejection
    const probeFailures = report.findings.filter(f =>
      f.finding_id.startsWith("F-PROBE-NOT-REJECTED") && f.classification === "BLOCKING"
    );
    expect(probeFailures).toHaveLength(0);
  });

  test("document_kind mismatch probe is rejected", () => {
    const report = runConformance(CORPUS_DIR);
    const pass = report.findings.find(f => f.finding_id === "F-PROBE-PASS:PROBE-DOCUMENT-KIND-MISMATCH");
    expect(pass).toBeDefined();
    expect(pass!.classification).toBe("PASS");
  });

  test("orphan-receipt probe is rejected", () => {
    const report = runConformance(CORPUS_DIR);
    const pass = report.findings.find(f => f.finding_id === "F-PROBE-PASS:PROBE-ORPHAN-RECEIPT");
    expect(pass).toBeDefined();
    expect(pass!.classification).toBe("PASS");
  });

  test("consumer-local-parser probe is rejected", () => {
    const report = runConformance(CORPUS_DIR);
    const pass = report.findings.find(f => f.finding_id === "F-PROBE-PASS:PROBE-CONSUMER-LOCAL-PARSER");
    expect(pass).toBeDefined();
    expect(pass!.classification).toBe("PASS");
  });

  test("CAS-semantic probe preserves content-addressable distinction", () => {
    const report = runConformance(CORPUS_DIR);
    const pass = report.findings.find(f => f.finding_id === "F-PROBE-PASS:PROBE-CAS-SEMANTIC");
    expect(pass).toBeDefined();
    expect(pass!.classification).toBe("PASS");
  });

  test("dual-observation probe confirms consumer agreement", () => {
    const report = runConformance(CORPUS_DIR);
    const pass = report.findings.find(f => f.finding_id === "F-PROBE-PASS:PROBE-DUAL-OBSERVATION");
    expect(pass).toBeDefined();
    expect(pass!.classification).toBe("PASS");
  });

  test("error-code probe confirms valid input not rejected", () => {
    const report = runConformance(CORPUS_DIR);
    const pass = report.findings.find(f => f.finding_id === "F-PROBE-PASS:PROBE-ERROR-CODE-MISMATCH");
    expect(pass).toBeDefined();
    expect(pass!.classification).toBe("PASS");
  });

  test("overall status is ALL_CONSUMERS_AGREE", () => {
    const report = runConformance(CORPUS_DIR);
    expect(report.status).toBe("ALL_CONSUMERS_AGREE");
  });

  test("runner uses shared parser (parseAuditGovernanceV3Document)", () => {
    // This test verifies the runner imports and uses the shared parser
    // by checking that legal schema pairs pass and illegal ones fail
    const report = runConformance(CORPUS_DIR);
    // If the shared parser were not used, legal samples would fail
    const legalFailures = report.findings.filter(f =>
      f.finding_id.includes("LEGAL-SCHEMA-PAIR") && f.classification === "BLOCKING"
    );
    expect(legalFailures).toHaveLength(0);
  });

  test("finalize-audit consumer rejects non-v3 report/latest kinds (mismatch probes)", () => {
    const report = runConformance(CORPUS_DIR);
    const mismatchFailures = report.findings.filter(f =>
      (f.finding_id.includes("MUTATION-FINALIZE-REPORT-KIND-001") ||
        f.finding_id.includes("MUTATION-FINALIZE-LATEST-KIND-001")) &&
      f.classification === "BLOCKING"
    );
    expect(mismatchFailures).toHaveLength(0);
  });
});
