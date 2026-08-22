# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## phases-ignored-user-preferences-2 — Deep audit revealed 10 critical gaps between locked-stack requirements and implementation
- **Date:** 2026-08-03
- **Error patterns:** tailwind css unused, radix ui missing, chokidar not integrated, playwright e2e failing, project.md unchecked, schema-05 traceability, accessible keyboard reorder, sensitive field masking, schema refresh e2e, snapshot pruning ui
- **Root cause(s):** All 10 gaps were real implementation omissions vs. locked-stack requirements in .claude/CLAUDE.md and phase CONTEXT decisions. Each gap was independently fixed and verified.
- **Fix:** Systematically implemented missing pieces across all 10 gap categories (Tailwind, Radix, chokidar, Playwright, PROJECT.md, SCHEMA-05, D-03, D-15/D-16, schema refresh E2E, snapshot pruning deferral)
- **Files changed:** vite.config.ts, web/src/styles.css, web/src/lib/utils.ts, web/src/components/ui/*.tsx (11 new Radix/Tailwind base components), packages/server/src/workspace-store.ts, packages/cli/src/bootstrap.ts, packages/cli/src/cli-main.ts, packages/server/src/context.ts, test/e2e/smoke.test.ts, playwright.config.ts, package.json
- **Why not caught:** No single gate — these were systematic audit findings across the whole stack, not a single bug class. The audit process itself (cross-referencing CONTEXT.md, ROADMAP.md, REQUIREMENTS.md, CLAUDE.md) is the guard against such omissions.
- **Recurrence guard:** KB pattern — when auditing completeness, check: tailwind usage across components, radix presence in package.json and imports, chokidar in workspace-store, playwright tests passing, PROJECT.md sync with ROADMAP, schema-x traceability in REQUIREMENTS.md

---

## field-card-pointer-events-dialog — Custom overlay dialogs rendered inline in sidebar stacking context, so field cards in `main` painted above them and intercepted pointer events
- **Date:** 2026-08-22
- **Error patterns:** intercepts pointer events, element intercepting, gsd-field-card tabindex=-1, Cancel click timeout, 56 retries, dialog nested inside complementary sidebar
- **Root cause(s):** Custom `.gsd-dialog-overlay` dialogs (CreateConfigDialog, PathEntryDialog, ScanReviewDialog) rendered inline as children of `.gsd-app-shell__middle` (sidebar pane, `position: relative; z-index: 1`), trapping their `position: fixed; z-index: 50` overlay inside the sidebar's stacking context; `.gsd-app-shell__main` (`z-index: 1`, later in DOM) painted above the whole sidebar context, so field cards in `main` were painted over the dialog overlay and intercepted pointer events meant for it (e.g. the Cancel button, whose centered position overlaps `main`).
- **Fix:** Wrapped the three custom overlay dialogs in `createPortal(..., document.body)` (import from `react-dom`), matching the existing `RestoreDialogs` / Radix `DialogContent` pattern, so `z-index: 50` competes at the root stacking context above `main` (z-index 1). No z-index change needed.
- **Files changed:** web/src/components/sidebar/CreateConfigDialog.tsx, web/src/components/sidebar/PathEntryDialog.tsx, web/src/components/sidebar/ScanReviewDialog.tsx
- **Why not caught:** No gate existed for this class — it is a client-side stacking-context/pointer-events issue that only manifests once a tracked config loads and field cards render into `main`. Before the e2e `selectFirstReadyConfig` helper was fixed, no config loaded (editor showed "Choose a tracked config"), so zero field cards rendered and the bug was masked in the suite. Unit/integration tests (vitest, jsdom) do not exercise real stacking/pointer-events, so they stayed green.
- **Recurrence guard:** The regression test `Create new config - dialog opens` (test/e2e/comprehensive.test.ts:175) now passes only because the dialog portals above `main`; re-inlining any of the 3 dialogs fails it with interception. Code-structural guard: all 3 dialogs return `createPortal(..., document.body)` (CreateConfigDialog.tsx:59-110, PathEntryDialog.tsx:81-117, ScanReviewDialog.tsx:32-70).

---

## exhaustive-verification-audit — E2e verification state was contradictory (stale failure classification + misread on-disk artifacts); full suite is actually 24/24 green
- **Date:** 2026-08-22
- **Error patterns:** contradictory pass/fail claims, stale test classification, 13 passed 11 failed vs status passed failedTests empty, playwright-report unparseable
- **Root cause(s):** A stale failure classification in the field-card debug ("13 passed / 11 failed") was written against a pre-rewrite `comprehensive.test.ts`; after test-authoring fixes (`.first()`, scoped selectors, corrected menu/heading labels) were merged, the suite went fully green, but the classification was never updated. Meanwhile `test-results/.last-run.json` (`status: passed, failedTests: []`) was in fact correct all along, and `playwright-report/index.html` was never a parseable pass/fail source (the html reporter was bypassed by later `--reporter=list` runs, leaving it stale).
- **Fix:** No app code change. Established ground truth empirically by running the full unfiltered Playwright suite twice (`npx playwright test`, no `-g`) → 24/24 passed, exit 0, ~19.5s, 8 workers, both runs. Re-verified the field-card portal fix intact by code inspection and moved that session to `resolved`.
- **Files changed:** [] (verification-only audit; no source changes — the field-card fix was already committed at 5dee6ea)
- **Why not caught:** No gate existed for this class — it is a *process* failure (a stale written classification taken as ground truth instead of re-running), not a code bug. The verify step relied on a prior session's documented count rather than re-running the unfiltered suite.
- **Recurrence guard:** KB pattern — whenever a pass/fail claim (from a prior session, `.last-run.json`, or a report) is to be trusted, re-run the FULL unfiltered suite (`npx playwright test`, no `-g`) and treat that as the only authoritative baseline; never trust a filtered run, a stale session count, or the html report as a pass/fail source. `.last-run.json` is authoritative only when its generating invocation is known to be unfiltered.

---