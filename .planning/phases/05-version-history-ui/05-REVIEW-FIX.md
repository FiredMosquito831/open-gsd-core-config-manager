---
phase: 05
fixed_at: 2026-07-19T13:39:24Z
review_path: .planning/phases/05-version-history-ui/05-REVIEW.md
iteration: 2
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-07-19T13:39:24Z  
**Source review:** `.planning/phases/05-version-history-ui/05-REVIEW.md`  
**Iteration:** 2

## Summary

- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Restore dialog was nested inside its inert background

**Files modified:** `web/src/components/history/RestoreDialogs.tsx`, `test/web/history-workspace.test.tsx`  
**Commit:** `f397b97`  
**Applied fix:** Portaled restore dialogs to `document.body` while making only the application root inert. Browser-realistic tests now verify portal placement, inert containment, initial and wrapped focus, Escape, click cancellation, and focus return to the invoking action.

### CR-02: `saveWithSnapshot` was not serialized across local-helper processes

**Files modified:** `packages/server/src/snapshot-store/save-with-snapshot.ts`, `test/server/snapshot-store.test.ts`, `test/server/helpers/snapshot-record-worker.ts`  
**Commit:** `5223be0`  
**Applied fix:** Added a resolved-path advisory transaction lock that spans prior-byte read, the existing atomic config save, and committed snapshot indexing without nesting the config or index locks. A genuine concurrent child-process test proves original, intermediate, and final document states are retained.

### WR-02: Restore success test contained an invalid API response shape

**Files modified:** `test/web/history-workspace.test.tsx`  
**Commit:** `488f9a5`  
**Applied fix:** Replaced the invalid `{ ok: true }` mock with the actual restore-result shape while retaining the destructive restore assertions. This removes the Phase 5 test TypeScript diagnostic without weakening coverage.

### WR-03: Production history mode nested a second `main` landmark

**Files modified:** `web/src/components/history/HistoryWorkspace.tsx`, `web/src/components/editor/ConfigEditor.tsx`, `test/web/app-shell.test.tsx`  
**Commit:** `d69da79`  
**Applied fix:** Made HistoryWorkspace render as an embedded `div` in AppShell's production main landmark while preserving its standalone landmark for component tests. App-level tests verify exactly one `main` in both editor and history modes.

## Verification

- `npm run build` — passed.
- Focused Phase 5 tests — passed: 5 files, 38 tests.
- `npm run typecheck` — no new Phase 5 diagnostics. Existing unrelated diagnostics remain in `test/web/phase4-catalog-evidence.test.ts`, `test/web/schema-index.test.ts`, `test/web/specialized-draft.test.ts`, and `web/src/schema/specializedMetadata.ts`.

---

_Fixed: 2026-07-19T13:39:24Z_  
_Fixer: Claude (gsd-code-fixer)_  
_Iteration: 2_
