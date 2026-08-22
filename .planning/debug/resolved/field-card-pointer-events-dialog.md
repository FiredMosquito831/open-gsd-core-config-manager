---
status: resolved
trigger: Field card (tabindex="-1") intercepts pointer events over dialogs, menus, and rail buttons — 12/24 e2e tests fail; unit + integration suites fully green.
created: 2026-08-22
updated: 2026-08-22
---

# Debug: field-card pointer-events dialog interception

## Symptoms

- **Expected:** Clicking a chapter tab renders `.gsd-chapter-view`; dialog buttons (Cancel), rail buttons, and the Add menu are clickable.
- **Actual:** After a tracked config is selected (which renders field cards into the editor), a `<div tabindex="-1" class="gsd-field-card" data-testid="field-capabilities.auto_update">` from the `main.gsd-app-shell__main` subtree **intercepts pointer events** meant for overlay elements (dialog Cancel, rail buttons, Add menu). Playwright retries 56× then times out.
- **Errors:** `element(s) not found` / `...intercepts pointer events` on `.gsd-chapter-view` and on `button:has-text("Cancel")`.
- **Timeline:** Present once a config loads and field cards render. Before the e2e `selectFirstReadyConfig` fix, no config loaded (editor showed "Choose a tracked config"), so zero field cards rendered and this bug was masked — which is why it only surfaced after the config-selection fix landed.
- **Reproduction:** Run `npx playwright test`. 12/24 fail (all chapter-navigation + dialog + menu tests). `npm test` (vitest unit + integration) is fully green (397 + 16 passed) — confirms the server/data layer is healthy and the defect is purely a client-side stacking/pointer-events issue.

## Evidence

- Playwright error-context (`test-results/.../error-context.md`) shows the intercepting element is `.gsd-field-card[tabindex="-1"]` inside `main.gsd-app-shell__main`.
- Field cards render with `tabindex="-1"` (FieldCard component). With many fields rendered, these focusable divs sit in the same stacking context as / above portaled overlays (Radix dialog menus) depending on z-index and DOM order.
- `smoke.test.ts` (2 tests) and 10 `comprehensive.test.ts` tests that don't require clicking an overlay over a populated chapter PASS — consistent with "only fails when a field card can intercept."

- Playwright error-context `comprehensive-...-24cf1-...-dialog-opens/error-context.md` confirms the mechanism: `page.click('button:has-text("Cancel")')` resolves to the Cancel button, but `<div tabindex="-1" class="gsd-field-card" data-testid="field-capabilities.auto_update">…</div> from <main aria-label="Editor" class="gsd-app-shell__main"> subtree intercepts pointer events` (retried 56x). Page snapshot shows the `[role="dialog"] "Create new config"` is nested **inside** `<complementary "Tracked configurations">` (the sidebar), NOT at body level — proving the overlay is rendered inline in the sidebar's stacking context.
- `web/src/components/ui/dialog.tsx` Radix `DialogContent` wraps content in `<DialogPortal>` (renders to body) — Radix dialogs are NOT affected. `RestoreDialogs.tsx` already uses `createPortal(..., document.body)` — also not affected.
- `CreateConfigDialog.tsx`, `PathEntryDialog.tsx`, `ScanReviewDialog.tsx` return a plain `<div className="gsd-dialog-overlay" role="dialog">` with **no portal**; they are children of `TrackedConfigSidebar` / `AddConfigMenu` (inside `.gsd-app-shell__middle`, `position: relative; z-index: 1`). This traps their `z-index: 50` overlay beneath `.gsd-app-shell__main` (`z-index: 1`, later DOM).
- CSS fact: `.gsd-app-shell__left, __middle, __main { position: relative; z-index: 1; }` (styles.css ~128-130). `.gsd-dialog-overlay { position: fixed; inset: 0; z-index: 50; }` (styles.css ~525-534). `gsd-field-card` has no position/z-index (static) — it does not itself create a stacking context; it wins purely because `main` paints above the sidebar.

## Current Focus

- **hypothesis (CONFIRMED):** The custom `.gsd-dialog-overlay` dialogs (`CreateConfigDialog`, `PathEntryDialog`, `ScanReviewDialog`) render inline as children of `.gsd-app-shell__middle` / sidebar, which is `position: relative; z-index: 1`. Their overlay `position: fixed; inset: 0; z-index: 50` is therefore trapped inside the sidebar's stacking context. `.gsd-app-shell__main` is also `z-index: 1` but later in DOM, so it paints on top of the entire sidebar context — meaning the field cards inside `main` are painted ABOVE the dialog overlay and intercept pointer events meant for the dialog (e.g. the Cancel button, whose centered screen position overlaps `main`).
- **fix:** Portal the three custom overlay dialogs to `document.body` via `createPortal` (already the pattern used by `RestoreDialogs` and Radix `DialogContent`), so `z-index: 50` competes at the root stacking context, above `main` (z-index 1).
- **next_action:** Apply `createPortal(..., document.body)` to CreateConfigDialog, PathEntryDialog, ScanReviewDialog; re-run playwright `Create new config - dialog opens`.

## Failure Classification (12 unique failing tests, each retried 2x)

Only 1 of 12 is the pointer-events stacking/interception bug. The rest are test-authoring issues.

- **(a) STACKING/INTERCEPTION bug — `Create new config - dialog opens` (24cf1):** Confirmed `gsd-field-card[tabindex="-1"]` from `main` intercepts pointer events on `button:has-text("Cancel")`. Fixed by portaling dialog to body.
- **(b) TEST-AUTHORING — `Schema Workspace - accessible from rail button` (9656a):** `text=Active schema` strict-mode violation (matches `<h2>Active schema` AND `<p>Loading active schema…`). Page rendered fine.
- **(b) TEST-AUTHORING — `Field editing - enum combobox is visible` (5a9b3):** `.gsd-field-card:has-text("mode")` strict-mode violation (resolved to 9 elements).
- **(b) TEST-AUTHORING — `Add existing config - dialog opens` (89387):** menu item label is `Absolute path`, not `Add existing config`; `text=Add existing config` not found (TimeoutError). Menu opened fine.
- **(b) TEST-AUTHORING — `Resize - sidebar collapse/expand` (06830):** `.gsd-sidebar__heading` strict-mode violation (matches `Tracked configs` + `Chapters`).
- **(b/?) `Model & Routing - model_overrides agent-map editor` (09e15), `models runtime-tier-map editor` (0182b), `Planning - granularities runtime-tier-map editor` (0c96c), `Review - review.models runtime-tier-map editor` (3ee60), `Effort - effort.routing_tier_defaults runtime-tier-map editor` (4cb49), `Review - review.max_prompt_tokens_per_reviewer runtime-tier-map editor` (d3305):** `expect(.gsd-pool-list__row).toBeVisible` / `text=<field>` failed — `element(s) not found` (not interception, not strict-mode). Separate, possibly genuine focused-workspace issue; out of scope for this bug.
- **(b/?) `History Workspace - accessible from View history button` (b5a32):** `expect(.gsd-history-workspace).toBeVisible` failed — separate, out of scope.

## Resolution

root_cause: Custom `.gsd-dialog-overlay` dialogs (CreateConfigDialog, PathEntryDialog, ScanReviewDialog) render inline inside `.gsd-app-shell__middle` (the sidebar pane, `position: relative; z-index: 1`), so their `position: fixed; inset: 0; z-index: 50` overlay is trapped in the sidebar's stacking context. `.gsd-app-shell__main` (`z-index: 1`, later in DOM) paints above the whole sidebar context, so field cards in `main` are painted over the dialog overlay and intercept pointer events meant for it (e.g. the Cancel button, whose centered position overlaps `main`). Confirmed via Playwright error-context 24cf1 (field card intercepts Cancel click, 56 retries) and by the snapshot showing the dialog nested inside the sidebar `<complementary>`, not portaled to body. Radix dialogs and RestoreDialogs already portal to body and are unaffected.
fix: Wrap the three custom overlay dialogs in `createPortal(..., document.body)` (import from `react-dom`), matching the existing `RestoreDialogs` / Radix `DialogContent` pattern, so `z-index: 50` competes at the root stacking context above `main` (z-index 1). No z-index change needed.
verification: VERIFIED (re-confirmed by exhaustive audit 2026-08-22). (1) Portal fix intact by code inspection: all 3 dialogs return `createPortal(..., document.body)` (CreateConfigDialog.tsx:59-110, PathEntryDialog.tsx:81-117, ScanReviewDialog.tsx:32-70). (2) Full unfiltered `npx playwright test` → 24/24 passed, exit 0, 19.6s (8 workers); a second unfiltered run also 24/24. (3) The interception test `Create new config - dialog opens` passes; no new regressions. NOTE: the prior "13 passed / 11 failed" claim was stale — it predated test-authoring fixes (`.first()`, scoped selectors, corrected menu/heading labels) that were already merged; the suite is now fully green. Web `tsc -p tsconfig.web.json --noEmit` passes.
files_changed: [web/src/components/sidebar/CreateConfigDialog.tsx, web/src/components/sidebar/PathEntryDialog.tsx, web/src/components/sidebar/ScanReviewDialog.tsx]
