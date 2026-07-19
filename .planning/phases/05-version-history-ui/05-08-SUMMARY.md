---
phase: 05-version-history-ui
plan: 08
subsystem: ui
tags: [react, json-diff-kit, version-history, redaction, vitest]
requires:
  - phase: 05-version-history-ui
    provides: History workspace, snapshot retrieval, and restore workflow
provides:
  - Redaction-first adapter from json-diff-kit DiffResult streams to HistoryComparison
  - Tuple-authoritative history tree paths, states, and summary counts
  - Fail-closed malformed comparison handling with static secret-safe errors
affects: [history UI, snapshot diff tree, restore summaries, timeline counts]
tech-stack:
  added: []
  patterns: [two-stream DiffResult adaptation, fail-closed structural parsing]
key-files:
  created: []
  modified:
    - web/src/history/compare.ts
    - test/web/history-comparison.test.ts
key-decisions:
  - "History comparisons now derive tree nodes and summary counts solely from redacted json-diff-kit DiffResult streams, failing closed on malformed rows."
patterns-established:
  - "Project render models adapt library structural rows rather than recomputing document differences."
requirements-completed: [SAVE-05, SAVE-06]
coverage:
  - id: D1
    description: Structural Snapshot-to-Current comparison derives paths, states, and summary counts from json-diff-kit DiffResult streams.
    requirement: SAVE-05
    verification:
      - kind: unit
        ref: test/web/history-comparison.test.ts
        status: pass
      - kind: integration
        ref: npm test -- --run test/web/history-comparison.test.ts test/web/history-workspace.test.tsx test/web/editor-save.test.tsx
        status: pass
    human_judgment: false
  - id: D2
    description: Sensitive history roots are projected before third-party diffing and malformed rows fail closed without source disclosure.
    requirement: SAVE-05
    verification:
      - kind: unit
        ref: test/web/history-comparison.test.ts#redacts before Differ
        status: pass
    human_judgment: false
  - id: D3
    description: Existing restore and editor-save consumers remain compatible with the tuple-derived HistoryComparison contract.
    requirement: SAVE-06
    verification:
      - kind: integration
        ref: test/web/history-workspace.test.tsx and test/web/editor-save.test.tsx
        status: pass
    human_judgment: false
duration: 22min
completed: 2026-07-19
status: complete
---

# Phase 05 Plan 08: DiffResult Authority Summary

**Redaction-first json-diff-kit DiffResult streams now exclusively drive history tree states, paths, and Snapshot-to-Current summary counts.**

## Performance

- **Duration:** 22 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added tuple-authoritative adaptation from json-diff-kit's public two-stream `DiffResult` shape to the existing `HistoryComparison` renderer contract.
- Removed handwritten value equality, LCS alignment, and recursive source-document comparison authority.
- Added controlled tuple, redaction-ordering, malformed-stream, nested object, and array regression coverage.
- Kept all comparison failures secret-safe with one static `History comparison unavailable` error.

## Task Commits

1. **Task 1: Specify DiffResult authority and exact object/array adaptation** — `2091c05` (test)
2. **Task 2: Replace handwritten comparison authority with the DiffResult adapter** — `063561a` (feat)

## Files Created/Modified

- `web/src/history/compare.ts` — Projects sensitive roots, captures one library diff tuple, validates/adapts the tuple, and derives renderer nodes and summaries.
- `test/web/history-comparison.test.ts` — Verifies tuple authority, redaction-before-diff, malformed failure safety, and exact structural regressions.

## Verification

- Passed: `npm test -- --run test/web/history-comparison.test.ts test/web/history-workspace.test.tsx test/web/editor-save.test.tsx` — 3 files, 24 tests.
- Passed: `npm run build`.
- Passed baseline-only typecheck diagnostic gate: nonzero canonical typecheck output contained only the four documented Phase 4 baseline paths.
- Passed source authority gate: no legacy `sameValue`, `alignArrays`, `buildNodes`, `ArrayAlignment`, or discarded `Differ.diff` invocation remains.

## Decisions Made

- The adapter consumes only validated public DiffResult row fields and derives all displayed structural facts from those rows.
- Array paths intentionally follow source-side row positions emitted by the library, including LCS placeholders and repeated values.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Issues Encountered

- The installed library emits blank equal rows as one-sided alignment placeholders. The adapter treats these as structural placeholders, preserving emitted source-side indexes without introducing an independent array alignment algorithm.

## Next Phase Readiness

- SAVE-05 comparison authority is wired for the existing history workspace and restore-summary consumers.
- Visual UAT remains appropriate for long history timelines and rendered diff readability.

## Self-Check: PASSED

- Found task commits `2091c05` and `063561a`.
- Found modified comparison implementation and regression test files.
