---
phase: 05-version-history-ui
reviewed: 2026-07-19T11:59:52Z
depth: deep
files_reviewed: 25
files_reviewed_list:
  - package.json
  - packages/server/src/api-types.ts
  - packages/server/src/app.ts
  - packages/server/src/routes/history.ts
  - packages/server/src/snapshot-store/index.ts
  - test/server/history-routes.test.ts
  - test/server/snapshot-store.test.ts
  - test/web/api-client.test.ts
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
  critical: 3
  warning: 2
  info: 0
  total: 5
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-07-19T11:59:52Z
**Depth:** deep
**Files Reviewed:** 25
**Status:** issues_found

## Summary

The history route and UI have broadly sensible token/opaque-ID boundaries, but the restore flow is not connected to the live editor draft and the persistence layer is only serialized inside one server process. Those flaws can overwrite a restored config later or lose history under concurrent helpers. The comparison implementation also does not use its declared structural differ result, producing incorrect array change summaries.

Focused history tests passed (36 tests), but they do not exercise a real successful restore. The full suite and typecheck fail for additional repository issues; those results do not validate this phase.

## Critical Issues

### CR-01: Restore bypasses the actual editor draft and leaves it able to overwrite the restored file

**File:** `web/src/App.tsx:33`, `web/src/components/history/HistoryWorkspace.tsx:20-21,72-84`

**Issue:** Entering history replaces (and unmounts) `ConfigEditor` with `HistoryWorkspace`; no `ConfigDraftController` is passed. Consequently `draft` is always `undefined` in the production call chain. The dirty-draft branch at line 72 is never reached, and successful restore cannot call `resetFromServer` at line 83. The global `useConfigDraft` entry therefore retains the previous unsaved changes. On returning to the editor, those stale changes can be saved and silently overwrite the just-restored snapshot.

**Fix:** Lift the draft lifecycle above the editor/history mode switch, or expose a store-backed controller that `HistoryWorkspace` receives in production. Do not permit restore while that controller is dirty until the user explicitly saves or discards it, and always reset it from the reloaded config after a restore.

```tsx
// App-level owner must retain the same controller across workspace modes.
<HistoryWorkspace draft={draft} />

// After restore:
draft.resetFromServer(reloaded);
```

### CR-02: Snapshot index updates can lose history across concurrently running helpers

**File:** `packages/server/src/snapshot-store/index.ts:167-178`, `packages/server/src/routes/history.ts:97-100`

**Issue:** `recordSnapshot` performs an unlocked read-modify-write of `index.json`. The mutex used by `saveWithSnapshot` is explicitly in-process only, while two independently launched local helpers can address the same tracked config and snapshot root. Each process can read the same index/sequence, write the same `<seq>.json`, then write competing index contents. One pre-write state and/or index entry is lost, defeating the required version-history data-safety guarantee. The overlapping-restore test only uses one Fastify instance, so it cannot detect this inter-process race.

**Fix:** Use an advisory lock shared by processes which covers the entire read-current-content → atomic config write → snapshot file/index update transaction, or at minimum lock the snapshot directory/index around sequence allocation and atomic index replacement. Re-read the index while holding that lock and use atomic write+rename for `index.json`.

### CR-03: A crash during direct index write can make all version history unavailable

**File:** `packages/server/src/snapshot-store/index.ts:175-178`

**Issue:** The snapshot document and then `index.json` are written with ordinary `writeFile`. A process/device failure while replacing `index.json` can leave it partial or empty. `readIndex` deliberately treats malformed indexes as unavailable, so every historical snapshot becomes inaccessible even when all `<seq>.json` files remain intact. This violates the project's atomic-write/snapshot-history data-safety constraint.

**Fix:** Write a fully fsynced temporary index in the same directory and atomically rename it over `index.json` (using the project's atomic-write mechanism or equivalent). Only consider the snapshot committed after that replacement succeeds; optionally remove an orphaned snapshot file on index-write failure.

## Warnings

### WR-01: Array comparisons ignore the structural diff engine and report incorrect changes after insertions/reorders

**File:** `web/src/history/compare.ts:81-87,107-112`

**Issue:** `Differ` is called at line 110 but its output is discarded. The rendered tree instead compares arrays by numeric index. For example, changing `['a', 'b']` to `['x', 'a', 'b']` is reported as two changed values plus one addition, rather than one added item. This makes the timeline counts and restore review summary materially misleading for pool-style config arrays; it contradicts the structural/LCS comparison intent.

**Fix:** Adapt and render the `Differ(...).diff(before, after)` result, including its LCS array alignment, or implement equivalent LCS alignment before calling `buildNodes`. Add tests for insertion at the head, deletion in the middle, and reordering.

### WR-02: Restore tests mock the wrong API exports and never test the destructive success path

**File:** `test/web/history-workspace.test.tsx:9-15,144-146`

**Issue:** The component imports `restoreConfigSnapshot` and `loadConfig`, but the mock exports `restoreHistorySnapshot` and no `loadConfig`. The only purported restore-state test merely asserts that a mock function exists. Thus confirmation, reload, draft reset, query invalidation, navigation, and failure recovery are all untested; the missing production draft integration in CR-01 was not caught.

**Fix:** Mock the exact exported names, provide a resolved `loadConfig`, click through the review/dirty dialogs, and assert the restore request arguments, reset/discard behavior, cache updates, history invalidation, and return to editor. Add a production-level App test proving the live draft is passed through.

---

_Reviewed: 2026-07-19T11:59:52Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
