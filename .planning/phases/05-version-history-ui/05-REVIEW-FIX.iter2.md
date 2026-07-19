---
phase: 05
fixed_at: 2026-07-19T15:59:00Z
review_path: .planning/phases/05-version-history-ui/05-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-07-19T15:59:00Z  
**Source review:** `.planning/phases/05-version-history-ui/05-REVIEW.md`  
**Iteration:** 1

## Summary

- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Restore bypasses the actual editor draft and leaves it able to overwrite the restored file

**Files modified:** `web/src/App.tsx`, `web/src/components/editor/ConfigEditor.tsx`  
**Commit:** `4b2d155`  
**Applied fix:** Retained the editor's draft owner across editor/history workspace changes and passed its live controller to History so successful restoration resets the server-authoritative draft.

### CR-02: Snapshot index updates can lose history across concurrently running helpers

**Files modified:** `packages/server/src/snapshot-store/index.ts`, `test/server/snapshot-store.test.ts`, `test/server/helpers/snapshot-record-worker.ts`  
**Commit:** `2dbd4ce`, `d70932c`, `5add9df`  
**Applied fix:** Added process-shared advisory index serialization and independent child-process contention coverage. The worker path is decoded using `fileURLToPath`, making the test work from repository paths containing spaces.

### CR-03: A crash during direct index write can make all version history unavailable

**Files modified:** `packages/server/src/snapshot-store/index.ts`, `test/server/snapshot-store.test.ts`  
**Commit:** `2dbd4ce`, `d70932c`  
**Applied fix:** Replaced direct index writes with fsynced atomic writes and added failure coverage proving an existing index remains valid and a newly written unindexed snapshot is removed after an index replacement failure.

### WR-01: Array comparisons ignore structural alignment after insertions/reorders

**Files modified:** `web/src/history/compare.ts`, `test/web/history-comparison.test.ts`  
**Commit:** `21d3788`, `45db91b`  
**Applied fix:** Implemented LCS-based array alignment and regression coverage for head insertion, middle deletion, and reordering.

### WR-02: Restore tests mock the wrong API exports and never test destructive success

**Files modified:** `test/web/history-workspace.test.tsx`  
**Commit:** `3a631fe`, `3267fba`  
**Applied fix:** Mocked the exact restore/load exports and tested the destructive success flow, authoritative reload, live draft reset, and return to the editor with a correct nested payload assertion.

---

_Fixed: 2026-07-19T15:59:00Z_  
_Fixer: Claude (gsd-code-fixer)_  
_Iteration: 1_
