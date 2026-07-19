---
phase: 05-version-history-ui
plan: 07
subsystem: history-ui
tags: [react, tanstack-query, version-history, retries, accessibility]
requires:
  - phase: 05-08
    provides: Redacted Snapshot-to-Current comparison authority
  - phase: 05-05
    provides: History workspace and timeline UI
provides:
  - Bounded progressive exact-count loading for every returned snapshot
  - Terminal per-row retry state after deterministic detail retry exhaustion
affects: [history-ui, save-restore]
tech-stack:
  added: []
  patterns: [bounded background detail queue, generation-safe timer cleanup, per-row retry]
key-files:
  created: [web/src/history/useProgressiveHistoryCounts.ts]
  modified: [web/src/components/history/HistoryWorkspace.tsx, web/src/components/history/SnapshotTimeline.tsx, test/web/history-workspace.test.tsx]
key-decisions:
  - "Background count loading is capped at two groups while the selected useQuery remains outside the queue."
  - "All row counts derive only from buildHistoryComparison(snapshot.document, current).summary."
patterns-established:
  - "Progressive history workers clear timers and ignore obsolete generations on config or list replacement."
requirements-completed: [SAVE-05, SAVE-06]
coverage:
  - id: D1
    description: Every returned timeline row resolves an exact Snapshot-to-Current changed-key count under bounded background concurrency.
    requirement: SAVE-05
    verification:
      - kind: integration
        ref: test/web/history-workspace.test.tsx#progressive counts settle every returned row without truncating complete history
        status: pass
    human_judgment: false
  - id: D2
    description: Detail failures retry at 250ms and 500ms, then offer an accessible row-scoped Retry without blocking later work.
    requirement: SAVE-05
    verification:
      - kind: integration
        ref: test/web/history-workspace.test.tsx#retries count detail twice at 250ms and 500ms then exposes an accessible row Retry
        status: pass
    human_judgment: false
  - id: D3
    description: Existing restore and draft flows remain intact while progressive counting is added.
    requirement: SAVE-06
    verification:
      - kind: integration
        ref: npm test -- --run test/web/history-workspace.test.tsx test/web/history-comparison.test.ts test/web/editor-save.test.tsx
        status: pass
    human_judgment: false
duration: 25min
completed: 2026-07-19
status: complete
---

# Phase 05 Plan 07: Progressive History Counts Summary

**Every saved snapshot now resolves an exact redacted Snapshot-to-Current count through a two-worker queue with terminal accessible recovery.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-19T18:54:00Z
- **Completed:** 2026-07-19T19:10:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added generation-scoped progressive detail loading for every timeline entry, using the canonical comparison summary as the only count source.
- Kept selected detail independent of the bounded two-request background queue and reused exact TanStack Query detail keys.
- Added deterministic automatic retries at 250ms and 500ms, terminal row errors, and accessible row-scoped Retry actions.
- Preserved existing history comparison, draft, and restore behavior with focused regression coverage.

## Task Commits

1. **Task 1: Specify all-row completion, bounded concurrency, and selected priority** - `527982b` (test)
2. **Task 2: Implement the bounded progressive count loader** - `86b4207` (feat)

## Files Created/Modified

- `web/src/history/useProgressiveHistoryCounts.ts` - Bounded, stale-safe detail scheduler and retry controller.
- `web/src/components/history/HistoryWorkspace.tsx` - Connects timeline count state to the progressive loader.
- `web/src/components/history/SnapshotTimeline.tsx` - Renders terminal comparison-load errors and accessible retries.
- `test/web/history-workspace.test.tsx` - Regression coverage for all-row settlement, priority, bounded work, retries, and query identity.

## Decisions Made

- Selected snapshot loading remains handled by its existing `useQuery`, so it is never queued behind timeline background work.
- Retry exhaustion is represented as an explicit row error rather than an inferred zero or an indefinite calculating label.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial implementation exposed two Phase 5 type errors in nullable config identity and possibly undefined query data. These were corrected before verification; the canonical typecheck baseline gate then passed with only its permitted Phase 4 diagnostics.

## Verification

- Passed: `npm test -- --run test/web/history-workspace.test.tsx test/web/history-comparison.test.ts test/web/editor-save.test.tsx` (28 tests).
- Passed: `npm run build` (with the pre-existing Vite chunk-size advisory).
- Passed: canonical typecheck baseline parser; no diagnostics outside the four documented Phase 4 paths.

## Known Stubs

None.

## Next Phase Readiness

- Complete-history count resolution, selected priority, and row failure recovery are available to the phase verifier.
- No new server, schema, API, or trust-boundary surface was introduced.

## Self-Check: PASSED

- Found: `web/src/history/useProgressiveHistoryCounts.ts`
- Found task commits: `527982b`, `86b4207`

---
*Phase: 05-version-history-ui*
*Completed: 2026-07-19*
