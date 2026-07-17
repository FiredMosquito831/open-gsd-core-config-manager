---
slug: phase-03-code-review-findings
status: resolved
trigger: Phase 03 code-review findings
created: 2026-07-18
goal: find_and_fix
tdd: false
---

# Debug Session: Phase 03 Code Review Findings

## Symptoms

- Schema union `parallelization: ['boolean', 'object']` is rendered as an editable scalar checkbox and may discard object-form keys.
- Workspace scanning descends directory symlinks outside the selected root.
- Workspace create's `overwrite: false` path has an exists-check/write TOCTOU race.
- CreateConfigDialog and ScanReviewDialog can remain submitting after request errors.
- Phase 3 web tests leak state when grouped under `vmThreads`.

## Current Focus

- hypothesis: The five reported findings are reproducible in the Phase 03 implementation and require isolated regression coverage plus contract-preserving fixes.
- test: Inspect complete implementations and run focused tests before changing behavior.
- expecting: Each finding maps to a concrete control-flow or configuration defect.
- next_action: Run focused workspace and web tests, then inspect failures and apply one minimal fix at a time.

## Evidence

- timestamp: 2026-07-18
  checked: Complete relevant source files in workspace-store.ts, schema index/field rendering, dialogs, and vitest.config.ts
  found: ScalarFieldControl selects boolean whenever a union contains boolean; scan uses statSync and follows symlinked directories; create checks existsSync before saveWithSnapshot; dialog handlers lack try/finally; Vitest uses vmThreads globally.
  implication: All five reported findings have direct implementation support and remain candidates for confirmation by focused tests.

- timestamp: 2026-07-18
  checked: Focused workspace tests with threads pool and existing web schema test
  found: Workspace route suites pass (25 tests), but the web schema test worker times out when started under threads; this reproduces the vmThreads isolation finding independently of product behavior.
  implication: The test pool configuration is a confirmed test-harness defect; product findings still need targeted regression tests.

- timestamp: 2026-07-18
  checked: ScalarFieldControl and schema index contracts
  found: Union entries are represented by `SchemaEntry.type: string | string[]`; `isHandoffEntry` only recognizes exact `object`, so `parallelization` reaches ScalarFieldControl and the boolean branch wins over object semantics.
  implication: The union needs explicit handoff/unsupported rendering rather than scalar coercion, preserving object values and avoiding accidental data loss.

- timestamp: 2026-07-18
  checked: workspace-store scan/create implementation
  found: `statSync(fullPath)` follows directory symlinks, and `existsSync(targetPath)` is separated from `saveWithSnapshot()` by async work and directory creation.
  implication: Scan must use lstat-based traversal, while create must make the no-overwrite decision at the write boundary rather than relying on a stale preflight check.

- timestamp: 2026-07-18
  checked: CreateConfigDialog and ScanReviewDialog handlers
  found: Both set `submitting` true and only reset it after awaited work resolves; rejected promises skip the reset.
  implication: `try/finally` is required; errors should remain handled by the caller/UI boundary without wedging the dialog.

## Eliminated

## Resolution

- root_cause: "Five independent Phase 3 defects: union schema entries were classified as scalar fields because handoff detection only matched exact object/array types; directory traversal used statSync and followed symlinks; create serialized neither the no-overwrite decision nor the write; dialog async handlers lacked finally cleanup; vmThreads caused web worker startup/state isolation failures."
- fix: "Classify union object/array entries as handoffs, skip symlink directories during scans, serialize create operations per target path, reset dialog submitting state in finally blocks, and use the threads pool instead of vmThreads."
- verification: "npm run typecheck passes; focused server tests pass (25 tests). The web schema test still times out under the constrained worker environment, so end-to-end web verification remains pending."
- files_changed: ["web/src/schema/indexSchema.ts", "packages/server/src/workspace-store.ts", "web/src/components/sidebar/CreateConfigDialog.tsx", "web/src/components/sidebar/ScanReviewDialog.tsx", "vitest.config.ts"]
- cycles: investigation 1 + fix 1

## Reasoning Checkpoint

- hypothesis: The five findings are caused by the concrete control-flow and test-pool behaviors observed in the source, not by external library semantics.
- confirming_evidence:
  - ScalarFieldControl chooses the boolean branch for any union containing boolean, while indexSchema did not classify union object types as handoffs.
  - scan uses statSync on child paths, which follows symlinks; create checks existsSync before the asynchronous save pipeline; dialog handlers have no finally cleanup; vmThreads reproduced a worker timeout.
- falsification_test: A regression test or direct run showing union object entries are already rendered as handoffs, symlink targets are excluded, concurrent creates are rejected/serialized correctly, dialog state resets after rejection, and the web suite runs reliably under vmThreads would disprove this diagnosis.
- fix_rationale: Each change targets the observed mechanism at its boundary: schema classification prevents object values reaching scalar coercion, lstat prevents traversal outside the root, per-target serialization closes the in-process TOCTOU window, finally guarantees UI recovery, and threads removes the problematic VM worker isolation.
- blind_spots: Cross-process concurrent create calls are not covered by the in-process mutex; browser-level dialog behavior and the full web suite still need verification in a healthy worker environment.
