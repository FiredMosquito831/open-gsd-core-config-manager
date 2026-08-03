---
phase: 05-version-history-ui
reviewed: 2026-07-19T16:45:00Z
depth: deep
files_reviewed: 27
files_reviewed_list:
  - package.json
  - packages/server/src/api-types.ts
  - packages/server/src/app.ts
  - packages/server/src/routes/history.ts
  - packages/server/src/snapshot-store/index.ts
  - packages/server/src/snapshot-store/save-with-snapshot.ts
  - test/server/helpers/snapshot-record-worker.ts
  - test/server/history-routes.test.ts
  - test/server/snapshot-store.test.ts
  - test/web/api-client.test.ts
  - test/web/app-shell.test.tsx
  - test/web/history-comparison.test.ts
  - test/web/history-workspace.test.tsx
  - web/src/App.tsx
  - web/src/api/configs.ts
  - web/src/components/AppShell.tsx
  - web/src/components/editor/ConfigEditor.tsx
  - web/src/components/history/HistoryDiffTree.tsx
  - web/src/components/history/HistoryWorkspace.tsx
  - web/src/components/history/RestoreDialogs.tsx
  - web/src/components/history/SnapshotDiff.tsx
  - web/src/components/history/SnapshotTimeline.tsx
  - web/src/editor/useConfigDraft.ts
  - web/src/history/compare.ts
  - web/src/history/time.ts
  - web/src/state/uiStore.ts
  - web/src/styles.css
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-07-19T16:45:00Z
**Depth:** deep
**Files Reviewed:** 27
**Status:** issues_found

## Summary

This final deep review confirms the previously reported transaction, index durability, recovery-dialog portal/inert, restore-success mock, live-draft production integration, and single-main-landmark defects have been addressed in the reviewed implementation. In particular, `saveWithSnapshot` now holds a cross-process transaction lock across prior-byte capture, the atomic config write, and snapshot recording; the dialog is portaled outside the inert app root; and production history is embedded in AppShell's sole main landmark.

However, the claimed LCS alignment remains incorrect for arrays with repeated values, causing misleading history changes. The live-draft integration also still bypasses TypeScript at its most important cross-component boundary, and the timeline duplicates less robust date grouping logic that fails across DST transitions.

## Critical Issues

### CR-01 [BLOCKER]: Array comparison is not actually LCS-aligned for repeated values

**File:** `web/src/history/compare.ts:73-99`

**Issue:** `alignArrays` builds a boolean “some common subsequence exists” matrix instead of an LCS-length matrix. Its greedy tie-breaking can discard an alignable element where arrays contain duplicate values. This produces false additions/removals/changes in the version-history UI, rather than preserving all unchanged elements as LCS alignment requires.

For example, comparing `['a', 'b', 'a']` to `['b', 'a', 'c']` has an LCS of `['b', 'a']` (length 2). The current traversal preserves only one unchanged item and reports the other match as part of a replacement. Users are consequently shown an inaccurate restore comparison.

**Fix:** Store LCS lengths in the dynamic-programming matrix and choose the traversal direction based on the larger remaining LCS length. Preserve a deterministic tie-breaker only when both directions have equal lengths. Add duplicate-value test coverage.

```ts
// In a mismatch, retain the side that can still produce the longer LCS.
if (lcs[beforeIndex + 1][currentIndex] >= lcs[beforeIndex][currentIndex + 1]) {
  alignment.push({ before: before[beforeIndex++] });
} else {
  alignment.push({ current: current[currentIndex++] });
}
```

Add a case such as:

```ts
buildHistoryComparison(
  { agents: ['a', 'b', 'a'] },
  { agents: ['b', 'a', 'c'] },
);
```

and assert two unchanged aligned entries, one removal, and one addition.

## Warnings

### WR-01 [WARNING]: Live draft/history boundary disables TypeScript verification

**File:** `web/src/components/editor/ConfigEditor.tsx:46`; `web/src/components/history/HistoryWorkspace.tsx:20,76,87,102`

**Issue:** `EditorContents` accepts every prop as `any`, and `HistoryWorkspace.draft` accepts `Partial<DraftController> | object | null`. The explicit `object` union makes the boundary effectively untyped, then repeated assertions force that object into the controller shape. An incorrectly supplied `saveDraft` or `resetFromServer` implementation will compile and can fail only during a destructive history flow. This regresses the intended Phase 5 type-safety improvement at the live draft integration point.

**Fix:** Give `EditorContents` a real props interface and expose only the required controller members through a typed workspace prop.

```ts
type HistoryDraftController = Pick<
  ConfigDraftController,
  'isDirty' | 'saveDraft' | 'resetFromServer'
>;

interface HistoryWorkspaceProps {
  // ...
  draft?: HistoryDraftController | null;
}
```

Remove `object` and the type assertions, and type `EditorContents` using its actual inputs.

### WR-02 [WARNING]: Timeline labels “Yesterday” using a fixed 24-hour duration

**File:** `web/src/components/history/SnapshotTimeline.tsx:30-38`

**Issue:** `dateGroup` computes yesterday as `startToday - 86_400_000`. Local calendar days are not reliably 24 hours at daylight-saving transitions. A snapshot from the preceding local calendar day can therefore be placed under a formatted date rather than “Yesterday.” The phase already includes DST-safe component-independent grouping logic in `web/src/history/time.ts`, but the displayed timeline does not use it.

**Fix:** Refactor `SnapshotTimeline` to use `groupSnapshotsByLocalDate` and `formatSnapshotTime` from `web/src/history/time.ts`, which compare local calendar date parts rather than fixed millisecond intervals. Add a test using a DST-observing timezone on a spring/fall transition.

---

_Reviewed: 2026-07-19T16:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
