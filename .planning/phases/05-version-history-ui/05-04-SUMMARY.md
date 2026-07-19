---
phase: 05-version-history-ui
plan: 04
subsystem: editor-history-state
tags: [react, react-hook-form, tanstack-query, zustand, drafts]
requires:
  - plan: 05-01
    provides: History workspace draft contracts
provides:
  - Per-config draft controller and ordinary-save lifecycle seam
  - UI-only History workspace selection and restore notice state
affects: [SAVE-05, SAVE-06, history-workspace, config-editor]
tech-stack:
  added: []
  patterns: [opaque-config-keyed-draft-cache, query-data-versus-ui-workspace-state]
key-files:
  created: [web/src/editor/useConfigDraft.ts]
  modified: [web/src/components/editor/ConfigEditor.tsx, web/src/state/uiStore.ts]
decisions:
  - "Draft records are keyed by opaque active configuration ID and remain independent across editor/history navigation."
  - "History mode, selected snapshot sequence, and restore notices are UI-only Zustand state."
metrics:
  duration: 34min
  completed: 2026-07-19
  tasks: 2
  files: 3
status: complete
---

# Phase 05 Plan 04: Draft Lifecycle and History State Summary

**Centralized per-config draft saving and reset seams while adding UI-only navigation state for the forthcoming History workspace.**

## Accomplishments

- Added `useConfigDraft`, an authoritative draft controller that retains field changes, resets, form state, validation failures, snapshot feedback, and runtime notices per opaque configuration ID.
- Moved the editor's existing validate → `saveConfig` → reload lifecycle into the controller, returning explicit `saved` or `blocked` outcomes without a History-specific write path.
- Refactored `ConfigEditor` to use the controller and expose a secondary `View history` action plus a persistent, dismissible restore notice with a History action.
- Extended Zustand UI state with `workspaceMode`, selected History sequence, and restore notice actions; changing configs while in History preserves mode but resets the stale selection.

## Task Commits

1. **Task 1: Extract per-config draft and ordinary-save lifecycle** — `7110729` (`feat`)
2. **Task 2: Add History workspace state and editor entry action** — `686e974` (`feat`)

## Verification

- `npm test -- --run test/web/editor-save.test.tsx` — passed (5 tests).
- `npm run typecheck` was attempted. It remains blocked by pre-existing Phase 4 schema metadata/test typing errors; no task-file diagnostics were reported by the project typecheck.
- The existing History workspace contract remains intentionally RED because its later History components have not been implemented in this plan/wave.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security/state isolation] Kept draft state in a module-level opaque-ID map rather than component-local state.**
- **Found during:** Task 1
- **Issue:** Conditional History workspace replacement would unmount a component-local controller and lose unsaved work.
- **Fix:** Added the keyed controller record cache and explicit reset/discard methods.
- **Files modified:** `web/src/editor/useConfigDraft.ts`
- **Commit:** `7110729`

## Known Stubs

None. History rendering and restore orchestration are intentionally deferred to the later Phase 5 workspace plans; this plan provides their state/controller seams.

## Threat Surface Scan

No new network, authentication, filesystem, or schema trust boundary was introduced. The controller reuses the existing guarded `saveConfig` API and client validation helpers.

## Self-Check: PASSED

- `web/src/editor/useConfigDraft.ts` exists.
- Task commits `7110729` and `686e974` exist in git history.
