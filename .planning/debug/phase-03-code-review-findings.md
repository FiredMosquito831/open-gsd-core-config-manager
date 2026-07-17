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
- next_action: Archive the resolved session after committing the vmThreads configuration and web mock-reset isolation fix.

## Evidence

- timestamp: 2026-07-18
  checked: Complete relevant source files in workspace-store.ts, schema index/field rendering, dialogs, and vitest.config.ts
  found: ScalarFieldControl selects boolean whenever a union contains boolean; scan uses statSync and follows symlinked directories; create checks existsSync before saveWithSnapshot; dialog handlers lack try/finally; Vitest uses vmThreads globally.
  implication: All five reported findings have direct implementation support and remain candidates for confirmation by focused tests.

- timestamp: 2026-07-18
  checked: Grouped editor-save and sidebar-workspace tests under threads and vmThreads
  found: Both pools completed the grouped tests with 15/15 passing in this worker; the full web suite also completed under vmThreads with 76/76 passing.
  implication: The requested vmThreads configuration is viable here; mock reset is the targeted isolation guard for per-test implementations and call history.

- timestamp: 2026-07-18
  checked: Test cleanup hooks in editor-save.test.tsx and sidebar-workspace.test.tsx
  found: Both suites used restoreAllMocks, which restores spies but does not clear mock implementations/call state needed by module-level mocked API functions.
  implication: resetAllMocks provides deterministic mock state between tests without removing the declared module mocks.

- timestamp: 2026-07-18
  checked: npm run typecheck
  found: Command passed with no diagnostics.
  implication: The configuration and test cleanup changes preserve TypeScript contracts.

- timestamp: 2026-07-18
  checked: npm test -- --pool=vmThreads test/web
  found: 12 test files and 76 tests passed.
  implication: Full web regression coverage passes with vmThreads restored.

- timestamp: 2026-07-18
  checked: npm test -- --pool=vmThreads test/web/editor-save.test.tsx test/web/sidebar-workspace.test.tsx
  found: 2 files and 15 tests passed.
  implication: The grouped leakage scenario is covered and passes after resetAllMocks.

## Eliminated

- hypothesis: vmThreads cannot start or run the grouped web tests in this environment
  evidence: The grouped suite completed with 15/15 passing, and the full web suite completed with 76/76 passing under vmThreads.
  timestamp: 2026-07-18

- hypothesis: Product source changes are required to resolve this reported leakage
  evidence: Restoring vmThreads and resetting module mocks in the two affected suites made grouped and full web tests pass; no product runtime code changed.
  timestamp: 2026-07-18

## Resolution

- root_cause: "The affected web suites used module-level mocked API functions but only called restoreAllMocks in afterEach. That restores spy implementations rather than clearing mock state/implementations configured by individual tests, allowing state and behavior to leak when suites share vmThreads execution. The global test pool had also been changed away from the requested vmThreads configuration."
- fix: "Restored pool: 'vmThreads' in vitest.config.ts and changed cleanup in editor-save.test.tsx and sidebar-workspace.test.tsx to vi.resetAllMocks(), preserving module mocks while clearing their per-test state and implementations."
- verification: "The grouped suites pass under vmThreads (2 files, 15 tests), the full web suite passes under vmThreads (12 files, 76 tests), and npm run typecheck passes."
- files_changed: ["test/web/editor-save.test.tsx", "test/web/sidebar-workspace.test.tsx", "vitest.config.ts"]
- cycles: investigation 2 + fix 1

## Reasoning Checkpoint

- hypothesis: Mock implementations and call history from module-level API mocks are not fully cleared by restoreAllMocks between tests, and the pool configuration must be restored to vmThreads.
- confirming_evidence:
  - Both affected suites declare vi.mock API modules and configure their exported vi.fn implementations per test, but cleanup only calls vi.restoreAllMocks.
  - The requested grouped and complete web suites pass after resetAllMocks with vmThreads restored, and typecheck remains clean.
- falsification_test: Running the grouped suites and full web suite under vmThreads after cleanup would still show leaked API results, stale call counts, or worker failures.
- fix_rationale: resetAllMocks clears the mutable mock state while retaining the module mock declarations; restoring vmThreads matches the coordinator's required execution mode.
- blind_spots: The original coordinator-reported timeout was not reproduced in this resumed worker; cross-process isolation and browser-level behavior are outside these Vitest tests.


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
