---
phase: 05-version-history-ui
reviewed: 2026-07-19T13:15:29Z
depth: deep
files_reviewed: 25
files_reviewed_list:
  - package.json
  - packages/server/src/api-types.ts
  - packages/server/src/app.ts
  - packages/server/src/routes/history.ts
  - packages/server/src/snapshot-store/index.ts
  - test/server/helpers/snapshot-record-worker.ts
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
  critical: 2
  warning: 2
  info: 0
  total: 4
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-07-19T13:15:29Z
**Depth:** deep
**Files Reviewed:** 25
**Status:** issues_found

## Summary

The original draft-lifecycle fix is effective: `ConfigEditor` stays mounted across workspace modes and supplies its live draft controller to `HistoryWorkspace`. The direct snapshot-index lock and atomic index replacement also resolve the narrowly scoped duplicate-sequence/index-corruption defects, and the comparison now uses LCS alignment. The restore test now mocks the exports actually called and exercises the success path.

However, the production restore dialog makes its own ancestor inert, rendering the dialog non-interactive in browsers. Separately, history can still lose an intermediate state when two independent helpers save the same config: the new advisory lock protects only the snapshot index, not the required read-current → write-config → record-snapshot transaction. The focused suites passed (49 tests), but `npm run typecheck` fails, including a new Phase 5 test type error.

## Critical Issues

### CR-01 [BLOCKER]: Restore dialog is made inert along with the entire application

**File:** `web/src/components/history/RestoreDialogs.tsx:29-35,55-74`

**Issue:** The dialog is rendered inside `#root`, then the effect sets `inert` on `#root`. Because `inert` applies to every descendant, it disables the dialog itself as well as the intended background. In a browser, the call at line 32 cannot focus Cancel and the review/dirty dialog controls cannot receive normal pointer or keyboard interaction. This blocks the destructive restore confirmation flow and violates the required modal keyboard/accessibility contract; jsdom does not implement `inert`, so the added test gives a false pass.

**Fix:** Render the dialog into a portal that is a sibling of the inert application subtree, or inert only the application content behind the dialog rather than `#root`. Add a browser-level accessibility test that opens the dialog and verifies its Cancel/Restore controls receive focus and can be activated.

```tsx
// Keep the portal outside the element made inert.
return createPortal(dialog, document.body);

// Inert only the application content, never an ancestor of `dialog`.
appContentRef.current?.setAttribute('inert', '');
```

### CR-02 [BLOCKER]: Separate helpers can still drop an intermediate config version

**File:** `packages/server/src/snapshot-store/save-with-snapshot.ts:122-125,137-199`; `packages/server/src/snapshot-store/index.ts:35-43`

**Issue:** The new `withIndexLock` correctly serializes `recordSnapshot` index allocation across processes, but `saveWithSnapshot` serializes the full read-prior-content → write-config → snapshot sequence only with its process-local `pathLocks` map. Two local-helper processes can both read `{"a":0}` before either writes; after their independently locked writes, each records that same stale prior content. The final file contains one new value, both history entries contain the original value, and the other committed value is unrecoverably absent from history. This is the cross-helper data-safety failure identified by the original CR-02, merely moved outside the newly locked index section.

**Fix:** Acquire a process-shared lock keyed to the resolved config path before reading the prior bytes, keep it through `saveConfig` and `recordSnapshot`, and release it only after the history index has committed. Use a distinct lock file outside the target config path if necessary, and retain the in-process queue only as an optimization. Add a child-process test that calls `saveWithSnapshot` (not `recordSnapshot` directly) concurrently and asserts original, intermediate, and final states are all represented.

```ts
await withConfigTransactionLock(configPath, async () => {
  const priorContent = await readPriorContent(configPath);
  await saveConfig(configPath, nextConfig, validate);
  await recordSnapshot(configPath, priorContent, deps.root);
});
```

## Warnings

### WR-01 [WARNING]: The new restore-success test prevents the TypeScript validation gate from passing

**File:** `test/web/history-workspace.test.tsx:50`

**Issue:** `restoreConfigSnapshot` resolves to `{ ok: true }`, but `HistoryRestoreResult` contains only optional `snapshotId` and `warning`; it does not have an `ok` member. Consequently `npm run typecheck` fails with TS2353 in this Phase 5 test. A failing project typecheck makes the declared test contract unreliable and can hide real regressions among the existing diagnostics.

**Fix:** Make the mock conform to the wrapper's actual return type, such as `vi.mocked(restoreConfigSnapshot).mockResolvedValue({})`, and keep the test assertions focused on the subsequent reload/reset behavior.

### WR-02 [WARNING]: Production markup contains nested `main` landmarks in history mode

**File:** `web/src/components/AppShell.tsx:95-112`; `web/src/components/history/HistoryWorkspace.tsx:110-130`

**Issue:** `AppShell` always renders a `main` element, and the history workspace renders another `main` inside it. Nested main landmarks are invalid landmark structure and leave assistive technology with an ambiguous primary-content region. The direct component test only sees the inner landmark, so it does not catch the production composition.

**Fix:** Have `HistoryWorkspace` render a `section`/`div` when hosted by `AppShell`, or let it own the sole history `main` while `AppShell` uses a non-landmark container in history mode. Add an App-level test asserting exactly one `main` landmark in both editor and history modes.

---

_Reviewed: 2026-07-19T13:15:29Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
