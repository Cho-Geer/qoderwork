---
name: outcome-governance
description: "Create and structurally validate immutable outcome-governance v1 artifacts."
---

# Outcome Governance v1

Use this skill to freeze an outcome, its boundary, and fixed independent
acceptance evidence. It preserves implementation freedom: it does not prescribe
code structure, algorithm, or a particular implementation sequence. If design
discovery changes a frozen acceptance decision, create an amendment before
continuing; do not edit an older contract.

## Artifact model

- `outcome-contract` is immutable and has no lifecycle or approval. It freezes
  target, boundary, baseline, side-effect boundary, acceptance strategy, and
  only the acceptance-spec identity (`id`, `path`, `generation`).
- `outcome-test-bundle` is an independent immutable document. It freezes raw
  source hashes for tests, fixtures, oracle sources, runner configuration, and
  lockfiles plus unique fixed `expected_test_ids` and count.
- `acceptance-spec` raw-references the contract and bundle. Every case has a
  mandatory fixed `test_id`; the case-to-test mapping, not merely two global
  sets, determines receipt and verdict validation.
- `outcome-amendment` has from/to raw contract references, exact frozen diff,
  affected/unaffected IDs, and valid historical failure references. It has no
  approval reference, avoiding a content-hash cycle.
- `outcome-approval` one-way raw-binds contract, spec, bundle, and (for a new
  generation) the amendment. A weakening amendment requires a second HUMAN
  approval in a distinct trust domain.
- `outcome-ledger-event` is the lifecycle authority. A `CONTRACT_SUPERSEDED`
  event raw-references the amendment and its distinct new/to-contract approval;
  its predecessor approval remains the old/from-contract approval. The new
  contract must raw-reference the prior head in `supersedes`.
- A run receipt carries raw contract/spec/bundle/approval references, case and
  fixed test ID, environment/stdout/stderr hashes, argv, cwd, process values,
  observation, and runner identity. A run result carries inventory, receipt
  hashes, per-case results, and its derived verdict.

Run the read-only validator as:

```bash
${HOME}/.bun/bin/bun run scripts/validate-outcome-governance.ts <outcome-dir> --repository-root <repository-root>
```

The result is always `mode: "structural"` and
`validation_kind: "review-separated"`. It is not an authenticated runner,
proof of real command execution, or tamper-proof storage. Do not execute a
command merely because it appears in an artifact.

Legacy P01-P07 provenance rules are not used for outcome contracts. Use the
templates only as exact field-shape scaffolding, then calculate every raw SHA-256
from final bytes and validate the complete directory.
