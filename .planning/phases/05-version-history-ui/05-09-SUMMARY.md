---
phase: 05-version-history-ui
plan: 09
subsystem: history-ui
tags: [react, tanstack-query, json-diff-kit, version-history, security]
requires:
  - phase: 05-version-history-ui
    provides: existing redacted history API, comparison adapter, timeline, and restore workflow
provides:
  - Real-Differ container/scalar replacement adaptation with collision-free typed paths
  - Selected timeline retry dispatch through the existing selected-detail query owner
affects: [history-comparison, timeline, restore-review]
tech-stack:
  added: []
  patterns: [typed path identity separate from display paths, selected-query retry ownership]
key-files:
  created: []
  modified:
    - web/src/history/compare.ts
    - web/src/history/useProgressiveHistoryCounts.ts
    - web/src/components/history/HistoryWorkspace.tsx
    - test/web/history-comparison.test.ts
    - test/web/history-workspace.test.tsx
key-decisions:
  - "Encode object and array path tokens separately, while preserving formatted paths for renderers."
  - "A retry for the selected sequence uses selectedDetail.refetch rather than entering the bounded background queue."
patterns-established:
  - "History adapter maps use typed identities; public UI paths are presentation-only."
  - "Selection changes preserve completed progressive counts and terminal errors."
requirements-completed: [SAVE-05, SAVE-06]
coverage:
  - id: D1
    description: "Real json-diff-kit container/scalar replacement spans yield one exact changed history path with structured values."
    requirement: SAVE-05
    verification:
      - kind: unit
        ref: test/web/history-comparison.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "Adversarial valid JSON keys retain distinct identity and escaped display paths."
    requirement: SAVE-05
    verification:
      - kind: unit
        ref: test/web/history-comparison.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: "Selected timeline retries use the existing selected detail query while nonselected retries remain background-owned."
    requirement: SAVE-05
    verification:
      - kind: integration
        ref: test/web/history-workspace.test.tsx
        status: pass
    human_judgment: false
  - id: D4
    description: "Restore safety remains validate-to-atomic-write-to-recovery-snapshot workflow."
    requirement: SAVE-06
    verification:
      - kind: integration
        ref: test/web/editor-save.test.tsx and test/server/history-routes.test.ts
        status: pass
    human_judgment: false
duration: 27min
completed: 2026-07-19
status: complete
---

# Phase 05 Plan 09: History Comparison and Selected Retry Summary

**Collision-free redacted history comparisons now adapt real json-diff-kit container/scalar replacements, and selected timeline errors retry through their single TanStack Query owner.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-07-19T20:00:00Z
- **Completed:** 2026-07-19T20:28:00Z
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- Adapted real `Differ` object/array-to-scalar and scalar-to-container spans into one Snapshot-to-Current changed leaf with structured renderer values.
- Separated RFC-6901 typed object/array path identity from safe, readable display formatting so adversarial JSON keys cannot alias.
- Preserved completed progressive counts across selection-only changes and routed selected timeline retry to `selectedDetail.refetch()` without a duplicate background request.
- Kept focused comparison, workspace, editor-save, and server restore regressions green, then completed the production build.

## Task Commits

1. **Task 1: Adapt replacement spans and separate path identity from display** - `97a63d5` (feat)
2. **Task 2: Route selected row Retry to the selected-detail owner** - `5247c8f` (fix)

## Files Created/Modified

- `web/src/history/compare.ts` - Parses real DiffResult streams into typed identities, escaped display paths, and collapsed replacement leaves.
- `web/src/history/useProgressiveHistoryCounts.ts` - Preserves timeline state across selection changes and receives selected-detail counts.
- `web/src/components/history/HistoryWorkspace.tsx` - Dispatches a selected timeline Retry to the selected detail query owner.
- `test/web/history-comparison.test.ts` - Exercises real-Differ replacement directions and adversarial key paths.
- `test/web/history-workspace.test.tsx` - Retains workspace and retry ownership coverage.

## Decisions Made

- Used typed `object`/`array` path tokens encoded with token kinds for all internal node and duplicate identity; renderers continue to consume only formatted public paths.
- Kept selected request ownership in the existing TanStack query and retained the two-worker background queue exclusively for nonselected rows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Normalized json-diff-kit member labels containing literal backslashes before JSON key parsing.**
- **Found during:** Task 1
- **Issue:** Valid JSON object keys with literal backslashes caused the structural adapter to fail closed because the library label was not directly JSON-decodable.
- **Fix:** Normalized invalid label escape starts only before decoding, retaining static error behavior for malformed structural rows.
- **Files modified:** `web/src/history/compare.ts`
- **Verification:** `npm test -- --run test/web/history-comparison.test.ts`
- **Committed in:** `97a63d5`

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Necessary for complete valid-JSON-key coverage; no scope expansion.

## Issues Encountered

- Canonical typecheck still reports only the four documented Phase 4 baseline paths: `phase4-catalog-evidence.test.ts`, `schema-index.test.ts`, `specialized-draft.test.ts`, and `web/src/schema/specializedMetadata.ts`. No changed-file diagnostic remains.
- Vite emitted its existing large-chunk warning during the successful production build.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

SAVE-05 comparison adaptation and selected retry ownership are hardened without changing the reviewed SAVE-06 restore pipeline. The flagged sequence-boundary, exact-integer, concurrency, and restore-review assumptions remain explicitly unresolved as specified by the plan.

## Self-Check: PASSED

- Found all five modified implementation and test files.
- Found task commits `97a63d5` and `5247c8f`.

---
*Phase: 05-version-history-ui*
*Completed: 2026-07-19*
