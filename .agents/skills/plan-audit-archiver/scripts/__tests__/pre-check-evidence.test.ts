import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { precheckContract } from "../pre-check-evidence.ts";
const sha = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
describe("pre-check-evidence contract input", () => test("accepts one nested listed receipt and blocks a missing receipt", () => {
  const root = mkdtempSync(join(tmpdir(), "precheck-")); const receiptPath = join(root, "evidence", "nested", "ev.json"); mkdirSync(join(root, "evidence", "nested"), { recursive: true });
  const receipt = { id: "EV-001", audit_id: "audit-001", generation: 1 }; writeFileSync(receiptPath, JSON.stringify(receipt));
  const contractPath = join(root, "contract.json"); writeFileSync(contractPath, JSON.stringify({ audit_id: "audit-001", generation: 1, requirements: [{ kind: "BEHAVIORAL", positive_control: { evidence: "EV-001" } }], evidence_receipts: [{ ...receipt, path: "evidence/nested/ev.json", sha256: sha(receiptPath) }] }));
  expect(precheckContract(contractPath).issues).toEqual([]);
  const contract = JSON.parse(readFileSync(contractPath, "utf8")); contract.evidence_receipts[0].sha256 = "0".repeat(64); writeFileSync(contractPath, JSON.stringify(contract));
  expect(precheckContract(contractPath).issues).toContain("EVIDENCE_HASH_MISMATCH");
  contract.evidence_receipts[0].sha256 = sha(receiptPath); contract.evidence_receipts[0].path = "../outside.json"; writeFileSync(contractPath, JSON.stringify(contract));
  expect(precheckContract(contractPath).issues).toContain("EVIDENCE_RECEIPT_PATH_OUTSIDE_AUDIT");
  contract.evidence_receipts[0].path = "evidence/nested/ev.json"; writeFileSync(contractPath, JSON.stringify(contract)); rmSync(receiptPath); expect(precheckContract(contractPath).issues).toContain("EVIDENCE_RECEIPT_NOT_FOUND"); rmSync(root, { recursive: true, force: true });
}));

test("precheck rejects a ledger payload mutation and duplicate receipt id", () => {
  const root = mkdtempSync(join(tmpdir(), "precheck-")); const file = join(root, "ev.json"), receipt = { id: "EV-001", audit_id: "audit-002", generation: 1, command: "cd /x && bun test" }; writeFileSync(file, JSON.stringify(receipt));
  const contractPath = join(root, "contract.json"); const entry = { ...receipt, path: "ev.json", sha256: sha(file) }; writeFileSync(contractPath, JSON.stringify({ audit_id: "audit-002", generation: 1, requirements: [], evidence_receipts: [entry] }));
  let contract = JSON.parse(readFileSync(contractPath, "utf8")); contract.evidence_receipts[0].command = "cd /x && bun test changed"; writeFileSync(contractPath, JSON.stringify(contract)); expect(precheckContract(contractPath).issues).toContain("EVIDENCE_RECEIPT_PAYLOAD_MISMATCH");
  contract.evidence_receipts = [entry, { ...entry, path: "ev.json" }]; writeFileSync(contractPath, JSON.stringify(contract)); expect(precheckContract(contractPath).issues).toContain("DUPLICATE_ID"); rmSync(root, { recursive: true, force: true });
});

test("orphan receipt is reported as a warning only", () => {
  const root = mkdtempSync(join(tmpdir(), "precheck-")); const contractPath = join(root, "contract.json"); writeFileSync(contractPath, JSON.stringify({ audit_id: "audit-003", generation: 1, requirements: [], evidence_receipts: [] })); writeFileSync(join(root, "orphan.json"), JSON.stringify({ id: "EV-999" }));
  expect(precheckContract(contractPath).warnings.join(" ")).toContain("ORPHAN_RECEIPT_WARNING"); rmSync(root, { recursive: true, force: true });
});

test("behavior evidence below its required level is blocked", () => {
  const root = mkdtempSync(join(tmpdir(), "precheck-")); const file = join(root, "ev.json"), receipt = { id: "EV-001", audit_id: "audit-004", generation: 1, evidence_level: "component" }; writeFileSync(file, JSON.stringify(receipt)); const contractPath = join(root, "contract.json"); writeFileSync(contractPath, JSON.stringify({ audit_id: "audit-004", generation: 1, requirements: [{ kind: "BEHAVIORAL", required_evidence_level: "integration", positive_control: { evidence: "EV-001" } }], evidence_receipts: [{ ...receipt, path: "ev.json", sha256: sha(file) }] })); expect(precheckContract(contractPath).issues).toContain("EVIDENCE_RECEIPT_LEVEL_TOO_LOW"); rmSync(root, { recursive: true, force: true });
});
