---
phase: 05-version-history-ui
reviewed: 2026-07-19T20:04:46Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - test/web/history-comparison.test.ts
  - test/web/history-workspace.test.tsx
  - web/src/components/history/HistoryWorkspace.tsx
  - web/src/history/compare.ts
  - web/src/history/useProgressiveHistoryCounts.ts
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-07-19T20:04:46Z
**Depth:** deep
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Deep review of the Phase 05 comparison adapter, progressive-history ownership, workspace integration, and focused regressions found one valid JSON shape that the `json-diff-kit` adapter rejects, one restore-dialog pending-state failure path, and missing regression coverage for the parser boundary. The focused history suites pass but do not cover the valid nested-array stream below.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Valid nested-array configurations make comparison unavailable

**File:** `web/src/history/compare.ts:104-110`

**Issue:** `parseStream()` rejects real `json-diff-kit` output when an array contains another array. Comparing the valid, unchanged document `{ x: [[]] }` to itself throws the static `History comparison unavailable` error. `Differ` emits the nested-array opening row as `"x": [`; because the current parent is an array, line 107 rejects the parsed member key instead of recognizing the library's nested-container representation. This breaks both the diff panel and progressive row count for valid persisted JSON, including unchanged snapshots, so users cannot inspect every historical snapshot.

**Fix:** Extend the strict `DiffResult` parser to accept and validate the actual nested-array container stream emitted by `json-diff-kit`, retaining typed array-index identity for the semantic node. Add real-library tests for unchanged nested arrays, nested-array additions/removals, and arrays containing nested arrays alongside scalars and objects.

## Warnings

### WR-01: Save-draft rejection can leave the restore workflow permanently pending

**File:** `web/src/components/history/HistoryWorkspace.tsx:98-107`

**Issue:** `saveDraftFirst()` sets `pending` to `true`, then awaits `draft.saveDraft()` without `try/finally` or `catch`. The normal implementation currently converts save failures to `'blocked'`, but the `HistoryDraftController` contract permits a rejected promise and this component accepts alternate controller implementations. A rejection leaves `pending` true, produces an unhandled rejection, and disables dialog cancellation/actions indefinitely.

**Fix:** Always clear `pending` in a `finally` block and present a recoverable error for rejected saves:

```ts
setPending(true);
try {
  const outcome = await draft.saveDraft();
  if (outcome === 'blocked') return;
  // invalidate and close dialog
} catch {
  setRestoreError('The draft could not be saved. Try again.');
} finally {
  setPending(false);
}
```

Add a regression test with a rejecting `saveDraft` controller.

### WR-02: Tests omit the valid nested-array parser boundary

**File:** `test/web/history-comparison.test.ts:155-185`

**Issue:** The replacement and adversarial-key tests cover object/scalar replacement, arrays of objects, and escaped keys, but not nested arrays. Consequently the valid `{ x: [[]] }` comparison failure in CR-01 passes all focused tests. This leaves a core persisted-config shape without regression protection.

**Fix:** Add focused tests driven by the installed real `Differ` for nested arrays: a no-op comparison, additions, removals, and replacement spans. Assert exact summaries and that `buildHistoryComparison()` does not throw.

---

_Reviewed: 2026-07-19T20:04:46Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
