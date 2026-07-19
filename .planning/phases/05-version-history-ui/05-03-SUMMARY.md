---
phase: 05-version-history-ui
plan: 03
subsystem: history-client-foundation
tags: [react, json-diff-kit, history, redaction, api-fetch]
requires:
  - plan: 05-01
    provides: structural-diff dependency and History UI contracts
  - plan: 05-02
    provides: guarded opaque-ID history routes and typed response payloads
provides:
  - Secret-safe Snapshot-to-Current comparison and exact change summary model
  - Deterministic local-date timeline grouping and snapshot timestamp formatting
  - Token-aware opaque-ID history list, detail, and restore API wrappers
affects: [history-workspace, SAVE-05, SAVE-06]
tech-stack:
  added: []
  patterns: [redact-before-diff, opaque-id-history-api, local-calendar-history-grouping]
key-files:
  created: [web/src/history/compare.ts, web/src/history/time.ts, test/web/history-comparison.test.ts]
  modified: [web/src/api/configs.ts, test/web/api-client.test.ts]
decisions:
  - "History comparison remains Snapshot → Current and operates only on persisted document inputs."
  - "Catalog-sensitive roots are deep-projected before structural comparison, summary extraction, or display values."
  - "History URLs encode opaque IDs and reject noncanonical sequences before apiFetch runs."
metrics:
  duration: 3h17min
  completed: 2026-07-19
  tasks: 2
  files: 5
status: complete
---

# Phase 05 Plan 03: History Comparison and API Foundation Summary

**Secret-safe Snapshot-to-Current structural comparison, deterministic local timeline grouping, and authenticated opaque history API wrappers.**

## Performance

- **Duration:** 3h 17min
- **Started:** 2026-07-19T09:47:08Z
- **Completed:** 2026-07-19T13:04:00Z
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- Added a non-mutating descriptor-driven history projection that masks sensitive roots before `json-diff-kit` receives either document, alongside a typed Snapshot → Current change tree and exact added/removed/changed paths.
- Added local-calendar grouping with Today/Yesterday/date labels, exact singular/plural relative time, invalid-timestamp fallback, and numeric sequence tie-breaking.
- Added list/detail/restore client wrappers that use `apiFetch`, encode opaque configuration IDs, constrain sequences to positive safe integers, and never accept a restore document.

## Task Commits

1. **Task 1: Implement secret-safe structural comparison and timeline grouping** — `ecb9c2e` (`feat`)
2. **Task 2: Add token-aware History endpoint wrappers** — `5cac42f` (`feat`)

## Files Created/Modified

- `web/src/history/compare.ts` — redacted structural comparison model, exact summary, and typed tree adaptation.
- `web/src/history/time.ts` — deterministic local-date grouping and timestamp grammar helpers.
- `test/web/history-comparison.test.ts` — focused comparison, redaction, and boundary contracts.
- `web/src/api/configs.ts` — token-aware opaque-ID history endpoint wrappers.
- `test/web/api-client.test.ts` — history wrapper URL, token, request-body, and `ApiError` contracts.

## Decisions Made

- `buildHistoryComparison()` projects both persisted inputs through the sensitive descriptor catalog before invoking the configured `Differ`, preventing raw sensitive values from entering history display models.
- API wrappers retain the server's opaque-ID-plus-sequence contract and construct all requests through the existing launch-token client boundary.

## Verification

- `npm test -- --run test/web/history-comparison.test.ts test/web/api-client.test.ts -t 'comparison|timeline|redact|group|count|history API|token|wrapper'` — passed: 14 tests, 4 skipped.
- `npm run typecheck` — attempted; blocked by pre-existing Phase 4 schema metadata/test typing diagnostics and the as-yet-unimplemented `HistoryWorkspace` contract import. The new task files produced no diagnostics in the focused compile filter.
- The plan-prescribed `test/web/history-workspace.test.tsx` selector run hangs before collection in the merged environment, matching the supplied known-gate context; it was not treated as a new functional failure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking test harness] Added isolated pure-history contracts outside the hanging workspace suite.**
- **Found during:** Task 1
- **Issue:** The prescribed workspace test file imports the unimplemented later-plan `HistoryWorkspace` and hangs before collection in the merged environment, so it cannot verify this pure foundation.
- **Fix:** Added a narrowly scoped pure comparison/time test module and extended the existing API client contract file; both exercise the planned foundation without depending on later workspace rendering.
- **Files modified:** `test/web/history-comparison.test.ts`, `test/web/api-client.test.ts`
- **Verification:** Focused test command passed with 14 tests.
- **Committed in:** `ecb9c2e`, `5cac42f`

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking test-harness workaround)
**Impact on plan:** Preserves the planned contracts while keeping later workspace implementation isolated; no feature scope expansion.

## Issues Encountered

- `npm ci` restored the lockfile's existing approved dependencies because this fresh worktree initially lacked `node_modules`; it did not change any tracked dependency files.
- Full project typecheck remains blocked by pre-existing Phase 4 and later History workspace diagnostics, as documented by prior phase summaries.

## Known Stubs

None. The history projection and endpoint wrappers use live catalog/API boundaries; no placeholder values flow to a UI.

## Threat Surface Scan

No new unplanned security surface. The comparison mitigates T-05-05 by projecting secrets before all diff work, and wrappers mitigate T-05-09/T-05-10 by using `apiFetch` without logging document payloads.

## Next Phase Readiness

- The History workspace can consume typed comparison, time grouping, and API wrapper seams without accessing snapshot paths or raw secret values.
- Later workspace rendering must consume this model and retain the documented Snapshot → Current orientation.

## Self-Check: PASSED

- `web/src/history/compare.ts`, `web/src/history/time.ts`, and `web/src/api/configs.ts` exist.
- Task commits `ecb9c2e` and `5cac42f` exist in git history.
