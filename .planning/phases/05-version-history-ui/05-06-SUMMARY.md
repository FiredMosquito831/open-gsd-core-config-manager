---
phase: 05-version-history-ui
plan: 06
subsystem: ui
tags: [react, tanstack-query, zustand, accessibility, version-history, restore]
requires:
  - phase: 05-version-history-ui
    provides: History comparison UI, trusted restore endpoint, and editor draft lifecycle
provides:
  - Accessible informed restore confirmation and dirty-draft decision flow
  - Authoritative config/history refresh and truthful restore outcome notices
affects: [history-ui, config-editor, save-safety]
tech-stack:
  added: []
  patterns: [project-owned alert dialog focus management, restore mutation cache reconciliation]
key-files:
  created: [web/src/components/history/RestoreDialogs.tsx]
  modified: [web/src/components/history/HistoryWorkspace.tsx, web/src/components/history/SnapshotDiff.tsx, web/src/components/editor/ConfigEditor.tsx, web/src/state/uiStore.ts, web/src/styles.css, test/web/history-workspace.test.tsx]
key-decisions:
  - "Restores require a review dialog and one explicit final action; a dirty draft is handled only after review through the exact three-choice decision."
  - "Authoritative loadConfig data resets the draft only after server restore success, while failed restores retain the selected comparison and draft."
patterns-established:
  - "Restore dialog: inert root, focus trap, Escape cancellation, Cancel initial focus, and invoking-button focus return."
requirements-completed: [SAVE-06]
coverage:
  - id: D1
    description: Accessible review and dirty-draft restore dialog workflow
    requirement: SAVE-06
    verification:
      - kind: automated_ui
        ref: test/web/history-workspace.test.tsx#requires explicit dirty-draft restore choices
        status: pass
      - kind: automated_ui
        ref: test/web/history-workspace.test.tsx#gives the restore review dialog modal keyboard behavior
        status: pass
    human_judgment: false
  - id: D2
    description: Restore state reconciliation and post-restore notice presentation
    requirement: SAVE-06
    verification:
      - kind: automated_ui
        ref: npm test -- --run test/web/history-workspace.test.tsx test/web/editor-save.test.tsx
        status: pass
      - kind: other
        ref: npm run build
        status: pass
    human_judgment: true
    rationale: Visual responsive layout and real-browser notice readability require final UAT.
duration: 29min
completed: 2026-07-19
status: complete
---

# Phase 05 Plan 06: Restore Workflow Summary

**Accessible, deliberate snapshot recovery with dirty-draft preservation, authoritative cache refresh, and truthful success or warning notices.**

## Performance

- **Duration:** 29 min
- **Started:** 2026-07-19T14:07:00Z
- **Completed:** 2026-07-19T14:36:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added a project-owned alert dialog that keeps background content inert, traps keyboard focus, starts at Cancel, supports Escape, and returns focus to the triggering restore action.
- Added a deliberate restore review followed by the required dirty-draft Save / Discard / Cancel decision path, with pending-action duplicate prevention.
- Reloaded restored server authority, invalidated history/config data, preserved safe retry messaging, and surfaced success or recovery-snapshot warning notices in the editor.
- Activated all three SAVE-06 History workspace tests; the contract file now reports all 10 tests passing with zero skips.

## Task Commits

1. **Task 1: Implement accessible restore review and dirty-draft decisions** — `1e107da` (feat)
2. **Task 2: Complete restore success, warning, and blocking-failure state transitions** — `98bc34d` (feat)
3. **Task 3: Finish dialog/notice responsive styling and run phase gate** — `b2639e5` (style)

## Files Created/Modified

- `web/src/components/history/RestoreDialogs.tsx` — reusable accessible review and dirty-draft dialogs.
- `web/src/components/history/HistoryWorkspace.tsx` — restore mutation orchestration, safe failures, and cache refreshes.
- `web/src/components/history/SnapshotDiff.tsx` — enables the reviewed Restore action only after loaded comparison data.
- `web/src/components/editor/ConfigEditor.tsx` — renders persistent restore success and recovery-warning notices.
- `web/src/state/uiStore.ts` — carries recovery warning state with restore notices.
- `web/src/styles.css` — responsive token-based dialog and notice styles.
- `test/web/history-workspace.test.tsx` — SAVE-06 review/dialog contract tests are active.

## Decisions Made

- Used a project-owned dialog helper rather than adding a modal dependency, preserving the existing token system and making focus/inert behavior explicit.
- A dirty draft remains intact until restore succeeds and authoritative data is loaded; saving the draft first dismisses the dialog and requires a fresh restore review.
- Server exception detail is classified into safe copy only; local paths, snapshot contents, secrets, and stacks are not presented.

## Verification

- Passed: `npm test -- --run test/web/history-workspace.test.tsx` — 10/10 tests, 0 skips.
- Passed: `npm test -- --run test/web/history-workspace.test.tsx test/web/editor-save.test.tsx` — 15/15 tests.
- Passed: `npm run build`.
- Known pre-existing gate failure: `npm run typecheck` fails in Phase 4 evidence/schema tests and `npm test` fails in unrelated schema-evidence, server-launch, and jsdom-suite tests. The relevant History test suite and build pass; these failures were not caused by this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced non-portable assertion matcher in the activated contract test**
- **Found during:** Task 1
- **Issue:** The Vitest setup does not register `toHaveTextContent`, causing the new keyboard-focus test to fail despite correct focus behavior.
- **Fix:** Asserted `document.activeElement?.textContent` using the configured matcher set.
- **Files modified:** `test/web/history-workspace.test.tsx`
- **Verification:** History workspace suite passes 10/10.
- **Committed in:** `1e107da`

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Required only to make the added test compatible with existing infrastructure.

## Known Stubs

None.

## Threat Flags

None. The plan adds no endpoint, file-access pattern, auth flow, or schema boundary; it consumes the already-secured restore route.

## Next Phase Readiness

- SAVE-06 has its automated History workspace contract coverage and production build evidence.
- Final UAT should inspect light/dark dialog readability, keyboard focus, long labels, and warning/success notices in the running app.

## Self-Check: PASSED

- Found: `web/src/components/history/RestoreDialogs.tsx`
- Found commits: `1e107da`, `98bc34d`, `b2639e5`
