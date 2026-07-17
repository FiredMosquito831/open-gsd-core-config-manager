---
phase: 03-generic-schema-driven-ui-shell
plan: 04
subsystem: ui
tags: [react, vite, typescript, zustand, react-query, shell, sidebar, workspace]

requires:
  - phase: 03-generic-schema-driven-ui-shell
    plan: 03-03
    provides: Token-aware API wrappers, React Query client, Zustand UI store, workspace/config API wrappers

provides:
  - Responsive three-pane desktop workspace (sidebar, chapter nav, editor) with independent pane collapse and narrow-width rail/drawer behavior
  - Persistent tracked-config sidebar that lists, selects, loads, and recovers missing files
  - Add menu with file picker, absolute path, and scan chosen folder flows
  - Scan review dialog with preselected new candidates and explicit confirmation before tracking
  - Create config dialog with target-path preview, exists warning, and overwrite confirmation
  - Reusable absolute-path entry dialog shared across add, scan, and locate flows
  - Web tests covering DISC-01 through DISC-05 and EDIT-01 user flows

affects:
  - 03-05

tech-stack:
  added: []
  patterns:
    - "React Query useQuery/useMutation for workspace server state; Zustand for active selection/pane UI state"
    - "All filesystem-bound paths go through server-validated workspace APIs; browser never submits fake file-input paths"
    - "PathEntryDialog is a shared primitive: caller owns close behavior so scan can transition to review"

key-files:
  created:
    - web/src/components/ConfigEditor.tsx
    - web/src/components/sidebar/TrackedConfigSidebar.tsx
    - web/src/components/sidebar/MissingConfigActions.tsx
    - web/src/components/sidebar/AddConfigMenu.tsx
    - web/src/components/sidebar/ScanReviewDialog.tsx
    - web/src/components/sidebar/CreateConfigDialog.tsx
    - web/src/components/sidebar/PathEntryDialog.tsx
    - test/web/app-shell.test.tsx
    - test/web/sidebar-workspace.test.tsx
  modified:
    - web/src/App.tsx
    - web/src/components/AppShell.tsx
    - web/src/components/common/Button.tsx
    - web/src/components/common/EmptyState.tsx
    - web/src/styles.css
    - test/web/render-helpers.tsx
    - test/web/bootstrap.test.tsx

key-decisions:
  - "Created PathEntryDialog in Task 2 (for the missing-file locate flow) and reused it for Task 3 add/scan flows, rather than duplicating path-entry UI."
  - "PathEntryDialog no longer auto-closes on success; callers close it explicitly so the scan flow can keep the modal open and transition to ScanReviewDialog."
  - "Missing config actions show Locate again and Remove buttons only; the problem text is rendered once in the sidebar status to avoid duplicate UI copy."
  - "The file picker menu item opens the same absolute-path entry dialog with an explanatory banner, because browsers cannot expose server-usable absolute paths from <input type='file'>."

patterns-established:
  - "Sidebar server state: listWorkspaceConfigs via React Query, mutations invalidate ['workspace', 'configs'] and clear active selection when the active config is removed."
  - "Missing-file recovery: status is surfaced from the workspace API; Locate uses the additive locate route; Remove uses the additive delete route and never touches the filesystem."
  - "Dialog overlays are simple div-based modals with role='dialog' and aria-modal, avoiding a new Radix dependency."

requirements-completed: [DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, EDIT-01]

coverage:
  - id: D1
    description: "Responsive three-pane workspace with left/middle collapse and narrow-width rail/drawer behavior"
    requirement: EDIT-01
    verification:
      - kind: unit
        ref: "test/web/app-shell.test.tsx#AppShell renders three pane landmarks and toggle controls"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tracked config sidebar lists persisted configs in saved order and loads selected configs via GET /api/configs/:id"
    requirement: DISC-02
    verification:
      - kind: unit
        ref: "test/web/sidebar-workspace.test.tsx#sidebar lists persisted configs in saved order"
        status: pass
      - kind: unit
        ref: "test/web/sidebar-workspace.test.tsx#sidebar sets active config and loads data when clicking a ready config"
        status: pass
    human_judgment: false
  - id: D3
    description: "Missing or inaccessible tracked configs remain visible, disable editing, and expose Locate again and Remove actions"
    requirement: DISC-02
    verification:
      - kind: unit
        ref: "test/web/sidebar-workspace.test.tsx#sidebar disables editing for missing entries and shows recovery actions"
        status: pass
      - kind: unit
        ref: "test/web/sidebar-workspace.test.tsx#sidebar locate again calls the locate workspace route with a new path"
        status: pass
      - kind: unit
        ref: "test/web/sidebar-workspace.test.tsx#sidebar remove only deletes the tracked-list entry, not the filesystem file"
        status: pass
    human_judgment: false
  - id: D4
    description: "Add menu offers File picker, Absolute path, and Scan chosen folder; Create new config is a separate action"
    requirement: DISC-01
    verification:
      - kind: unit
        ref: "test/web/sidebar-workspace.test.tsx#add menu offers file picker, absolute path, and scan options; create is separate"
        status: pass
    human_judgment: false
  - id: D5
    description: "File picker affordance never submits fake browser paths; it explains the limitation and routes to server-validated absolute path entry"
    requirement: DISC-01
    verification:
      - kind: unit
        ref: "test/web/sidebar-workspace.test.tsx#add menu never submits fake browser paths; routes to path entry"
        status: pass
    human_judgment: false
  - id: D6
    description: "Scan chosen folder calls the server scan route and only tracks confirmed selections after review"
    requirement: DISC-03
    verification:
      - kind: unit
        ref: "test/web/sidebar-workspace.test.tsx#scan shows scan review dialog with candidates and only tracks confirmed selections"
        status: pass
    human_judgment: false
  - id: D7
    description: "Create new config previews the target path, warns if it exists, and requires explicit overwrite confirmation"
    requirement: DISC-04
    verification:
      - kind: unit
        ref: "test/web/sidebar-workspace.test.tsx#create previews target path, warns if exists, and requires confirmation"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-07-17
status: complete
---

# Phase 3 Plan 4: Generic Schema-Driven UI Shell - Workspace Surface Summary

**Desktop workspace shell with tracked-config sidebar, add/scan/create flows, and missing-file recovery, all routed through the server-side workspace API.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-17T18:53:08Z
- **Completed:** 2026-07-17T19:14:01Z
- **Tasks:** 3 (Task 1 non-TDD; Tasks 2 and 3 TDD with RED/GREEN commits)
- **Files modified:** 16

## Accomplishments

- Built a polished three-pane responsive workspace with a collapsible left sidebar, middle chapter navigation placeholder, and main editor surface, including light/dark CSS tokens and narrow-width rail/drawer behavior.
- Implemented a persistent tracked-config sidebar that lists workspace configs, loads the selected config via the existing GET /api/configs/:id route, and surfaces missing/problem states with Locate again and Remove recovery actions.
- Added an Add menu with File picker, Absolute path, and Scan chosen folder options, keeping Create new config as a separate action per D-11.
- Built a Scan review dialog that displays discovered `.planning/config.json` candidates, preselects new ones, marks already-tracked ones, and only tracks confirmed selections.
- Built a Create config dialog that chooses a project folder, previews `<project>/.planning/config.json`, warns if it exists, and requires explicit overwrite confirmation before creating.
- Created a reusable absolute-path entry dialog shared across add, scan, and locate flows; it does not auto-close on success so the scan flow can transition to review.
- Covered DISC-01 through DISC-05 and EDIT-01 flows with web tests for the shell and sidebar.

## Task Commits

Each task was committed atomically (Task 2 and Task 3 followed TDD RED/GREEN):

1. **Task 1: Build responsive three-pane AppShell and shared primitives** - `3af91fc` (feat)
2. **Task 2: Persistent tracked-config sidebar and selection load flow** - `fd545a9` (test), `79ba995` (feat)
3. **Task 3: Add menu, scan review, and create config dialogs** - `fb48245` (test), `cb358f5` (feat)

## Files Created/Modified

- `web/src/App.tsx` - Wires AppShell, TrackedConfigSidebar, and ConfigEditor.
- `web/src/components/AppShell.tsx` - Three-pane layout with rail toggle controls and responsive collapse.
- `web/src/components/common/Button.tsx` - Shared button primitive with variant/size props.
- `web/src/components/common/EmptyState.tsx` - Empty-state placeholder component.
- `web/src/components/ConfigEditor.tsx` - Loads and displays the active config via React Query.
- `web/src/components/sidebar/TrackedConfigSidebar.tsx` - Workspace config list, selection, and recovery UI.
- `web/src/components/sidebar/MissingConfigActions.tsx` - Locate again / Remove buttons for problem entries.
- `web/src/components/sidebar/AddConfigMenu.tsx` - Add menu and dialog orchestration.
- `web/src/components/sidebar/ScanReviewDialog.tsx` - Review-and-select scan results.
- `web/src/components/sidebar/CreateConfigDialog.tsx` - Create config preview, warning, and confirmation.
- `web/src/components/sidebar/PathEntryDialog.tsx` - Reusable absolute-path input dialog.
- `web/src/styles.css` - Full theme tokens, shell layout, sidebar, and dialog styles.
- `test/web/app-shell.test.tsx` - Tests for pane landmarks, collapse controls, and empty-state rendering.
- `test/web/sidebar-workspace.test.tsx` - Tests for sidebar, add menu, scan, and create flows.
- `test/web/render-helpers.tsx` - Updated to provide QueryClientProvider for React Query UI tests.
- `test/web/bootstrap.test.tsx` - Updated assertion to match the new shell/empty-state rendering.

## Decisions Made

- Reused PathEntryDialog for the locate flow in Task 2 even though the plan listed it under Task 3, avoiding a duplicate path-entry UI.
- Made PathEntryDialog leave close behavior to the caller so the scan flow can keep the modal open and transition to ScanReviewDialog.
- Rendered the missing-config problem text only in the sidebar status rather than duplicating it inside MissingConfigActions.
- Implemented the File picker menu item as an absolute-path entry dialog with an explanation banner, since browsers cannot expose real absolute paths from a file input.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated bootstrap test assertion to match the new App shell**
- **Found during:** Task 1 verification
- **Issue:** The existing `bootstrap.test.tsx` asserted on the old landing-page heading "GSD Config Manager"; replacing the landing page with the AppShell/empty-state broke that assertion.
- **Fix:** Changed the bootstrap test to assert the editor empty-state text and the shell landmarks instead.
- **Files modified:** `test/web/bootstrap.test.tsx`
- **Verification:** `npx vitest run test/web/bootstrap.test.tsx` passes.
- **Committed in:** `3af91fc` (Task 1 feat commit)

**2. [Rule 3 - Blocking] render-helpers needed QueryClientProvider for React Query UI tests**
- **Found during:** Task 2 RED test setup
- **Issue:** The shared render helper did not wrap components with a QueryClientProvider, so any component using `useQuery` would throw outside a provider context.
- **Fix:** Added a per-test QueryClient with retries disabled inside `renderWeb`.
- **Files modified:** `test/web/render-helpers.tsx`
- **Verification:** `test/web/sidebar-workspace.test.tsx` initializes and runs successfully.
- **Committed in:** `3af91fc` (Task 1 feat commit)

**3. [Rule 3 - Blocking] PathEntryDialog was needed in Task 2 for the missing-file locate flow**
- **Found during:** Task 2 implementation
- **Issue:** The plan lists PathEntryDialog under Task 3, but the missing-file "Locate again" action in Task 2 requires an absolute-path input dialog.
- **Fix:** Created PathEntryDialog in Task 2 and reused it for Task 3 add/scan flows.
- **Files modified:** `web/src/components/sidebar/PathEntryDialog.tsx`
- **Verification:** `test/web/sidebar-workspace.test.tsx#sidebar locate again calls the locate workspace route with a new path` passes.
- **Committed in:** `79ba995` (Task 2 GREEN commit)

**4. [Rule 1 - Bug] PathEntryDialog auto-closing on success broke the scan review transition**
- **Found during:** Task 3 GREEN test run
- **Issue:** The dialog called `onCancel()` after a successful submit, which cleared the scan candidates before the review dialog could render.
- **Fix:** Removed the auto-close from PathEntryDialog; callers now close explicitly (`closeMenu` for track flows, no close for scan until review is confirmed).
- **Files modified:** `web/src/components/sidebar/PathEntryDialog.tsx`, `web/src/components/sidebar/AddConfigMenu.tsx`
- **Verification:** `test/web/sidebar-workspace.test.tsx#scan` passes.
- **Committed in:** `cb358f5` (Task 3 GREEN commit)

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 bug)
**Impact on plan:** All fixes were necessary for the specified UI flows and tests to work. No scope creep; the only cross-task file movement was creating PathEntryDialog when first needed.

## Issues Encountered

- None beyond the workspace-specific test timing and dialog-state fixes documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The workspace shell is ready; the next plan (03-05) can build the schema-driven chapter navigation and field editor surfaces on top of the AppShell and ConfigEditor.
- All workspace API wrappers are already in place from 03-03; the sidebar consumes them correctly.
- No blockers.

## Self-Check: PASSED

- `test/web/app-shell.test.tsx` exists and passes.
- `test/web/sidebar-workspace.test.tsx` exists and passes.
- `npm run typecheck` passes.
- All Task 1-3 commits and the RED/GREEN gate commits are in history.

---
*Phase: 03-generic-schema-driven-ui-shell*
*Completed: 2026-07-17*
