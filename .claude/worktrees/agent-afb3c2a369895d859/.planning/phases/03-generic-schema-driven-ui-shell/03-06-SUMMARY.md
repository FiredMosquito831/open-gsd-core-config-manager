---
phase: 03-generic-schema-driven-ui-shell
plan: 06
subsystem: ui
tags: [react, vite, typescript, search, unknown-keys, packaging, responsive]
requires:
  - phase: 03-generic-schema-driven-ui-shell
    plan: 03-03
    provides: Browser data layer, schema index, effective values, patch builder, UI store
  - phase: 03-generic-schema-driven-ui-shell
    plan: 03-04
    provides: Responsive AppShell and tracked-config sidebar
  - phase: 03-generic-schema-driven-ui-shell
    plan: 03-05
    provides: Schema-driven chapter editor and save flow
provides:
  - Dedicated grouped global search results view over schema key/title/description/enum-option meanings
  - Result navigation back to focused/highlighted field cards while preserving the query
  - Read-only Unrecognized chapter for unknown/future config keys
  - Bounded, React-text-only unknown value preview
  - Responsive AppShell regression coverage and polished search/unknown surfaces
  - Packaging regression coverage proving Vite SPA HTML plus JS/CSS assets ship in the npm tarball
  - Automated local launch smoke evidence for built CLI serving tokenized SPA and API health
affects: [phase-4-pool-editors, phase-5-snapshot-history, phase-6-schema-refresh]
tech-stack:
  added: []
  patterns:
    - Search corpus excludes current values by default; values are display-only context
    - Search and unknown-value highlights/previews are rendered by React text nodes, never HTML insertion
    - Unknown keys remain preserved by raw.project patch/save candidate flow
    - Worktree node_modules symlink is a local test-environment aid only and was not committed
key-files:
  created:
    - web/src/components/search/SearchView.tsx
    - web/src/components/search/searchIndex.ts
    - web/src/components/unknown/UnknownChapter.tsx
    - web/src/components/unknown/SafeValuePreview.tsx
    - test/web/search-unknown.test.tsx
    - test/web/app-shell-responsive.test.tsx
  modified:
    - web/src/App.tsx
    - web/src/components/AppShell.tsx
    - web/src/components/editor/ConfigEditor.tsx
    - web/src/components/fields/FieldCard.tsx
    - web/src/components/chapters/ChapterNav.tsx
    - web/src/components/chapters/ChapterView.tsx
    - web/src/state/uiStore.ts
    - web/src/styles.css
    - test/web/app-shell.test.tsx
    - test/web/schema-renderer.test.tsx
    - test/web/field-card.test.tsx
    - test/web/editor-save.test.tsx
    - test/packaging/tarball-contents.test.ts
key-decisions:
  - "Keep searchQuery after result selection but close the search results view with a separate searchOpen flag, so users can preserve/return to the query while inspecting the selected field."
  - "Unknown values are read-only and rendered through bounded React text/pre blocks rather than raw HTML or editing controls."
  - "Treat full npm test timeout as an environment/concurrency issue because the timed-out CLI launch and teardown suites passed when rerun in isolation."
requirements-completed: [SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-06, EDIT-05, DISC-05]
coverage:
  - id: D15
    description: "Global search replaces the chapter editor with grouped results."
    requirement: EDIT-05
    verification:
      - kind: unit
        ref: "test/web/search-unknown.test.tsx#global search"
        status: pass
    human_judgment: false
  - id: D16
    description: "Search matches key paths, titles, field explanations, and enum-option meanings while excluding current values by default."
    requirement: EDIT-05
    verification:
      - kind: unit
        ref: "test/web/search-unknown.test.tsx#matches enum option meanings but not current values by default"
        status: pass
    human_judgment: false
  - id: D17
    description: "Selecting a search result restores the chapter view, focuses/highlights the field, and retains the query."
    requirement: EDIT-05
    verification:
      - kind: unit
        ref: "test/web/search-unknown.test.tsx#selecting a result restores the chapter"
        status: pass
    human_judgment: false
  - id: D18
    description: "Unknown keys render in a read-only Unrecognized chapter and survive known-key saves."
    requirement: SCHEMA-06
    verification:
      - kind: unit
        ref: "test/web/search-unknown.test.tsx#unknown key chapter"
        status: pass
    human_judgment: false
  - id: D19
    description: "The packaged npm artifact ships Vite SPA HTML plus JS/CSS assets and no placeholder-only contract."
    requirement: DIST-03
    verification:
      - kind: packaging
        ref: "test/packaging/tarball-contents.test.ts#contains the built Vite UI shell and assets"
        status: pass
    human_judgment: false
  - id: D20
    description: "End-of-phase browser smoke verifies built CLI launch, token bootstrap, shell rendering, fixture loading, search, unknown keys, and validation blocking."
    requirement: Phase 3 ROADMAP success criteria
    verification:
      - kind: browser-smoke
        ref: "Playwright launch smoke against built dist/cli.js tokenized URL"
        status: pass
    human_judgment: false
# Metrics
duration: 2h37m
completed: 2026-07-17
status: complete
---

# Phase 3 Plan 6: Generic Schema-Driven UI Shell - Search, Unknown Keys, Packaging Summary

**Global schema search with safe result highlighting, read-only unknown-key surfacing, responsive shell polish, and package/runtime proof that the Vite SPA ships through the npm tarball.**

## Performance

- **Duration:** 2h37m
- **Started:** 2026-07-17T20:59Z
- **Completed:** 2026-07-17T23:46Z
- **Tasks:** 3/3 implemented or verified
- **Files modified:** 19 source/test/summary files

## Accomplishments

- Built `searchIndex` and `SearchView` for deterministic global search over key paths, titles, schema descriptions, and enum-option meanings.
- Added a global search input to the main editor pane; non-empty searches replace the chapter editor with grouped chapter results.
- Result cards show chapter, key path, description, current value summary, and provenance while excluding current values from the default search corpus.
- Selecting a result restores the normal chapter view, focuses and briefly highlights the matching field card, and preserves the query in the search input.
- Added `UnknownChapter` and `SafeValuePreview` so unknown/future keys render in a dedicated read-only `Unrecognized` chapter with source layer, type, and bounded text-only value preview.
- Proved unknown project keys survive known-key saves at the UI integration layer.
- Added responsive AppShell coverage for independent pane controls and retained editor search affordance.
- Updated packaging tests so the tarball must include Vite SPA HTML plus hashed JS/CSS assets and must not regress to placeholder-only HTML.
- Ran automated local launch smoke against the built CLI: tokenized URL printed, `/` returned 200 with asset HTML, and `/api/health` returned 200 with `x-gsd-token`.

## Task Commits

1. **Task 1 RED: Search behavior tests** - `dd0bd7e`
2. **Task 1 GREEN: Global schema search** - `aee5b79`
3. **Task 2 RED: Unknown chapter tests** - `096491e`
4. **Task 2 GREEN: Read-only unknown key surfacing** - `6182728`
5. **Task 3: Responsive search/unknown polish** - `1d8f710`
6. **Task 3: Packaged Vite SPA asset regression** - `023b76e`

## Files Created/Modified

- `web/src/components/search/SearchView.tsx` - grouped search results and safe React text highlighting.
- `web/src/components/search/searchIndex.ts` - ranked search over key/title/description/option meanings.
- `web/src/components/unknown/UnknownChapter.tsx` - dedicated read-only unknown-key chapter.
- `web/src/components/unknown/SafeValuePreview.tsx` - bounded string/array/object formatting rendered as React text.
- `web/src/App.tsx` - wires global search state into AppShell.
- `web/src/components/AppShell.tsx` - adds global search input in the editor pane.
- `web/src/components/editor/ConfigEditor.tsx` - switches between SearchView and ChapterView and handles result navigation.
- `web/src/components/fields/FieldCard.tsx` - supports focused/highlighted field navigation.
- `web/src/components/chapters/ChapterNav.tsx` - adds Unrecognized tab when unknown keys are present.
- `web/src/components/chapters/ChapterView.tsx` - renders UnknownChapter for the Unrecognized chapter.
- `web/src/state/uiStore.ts` - adds `searchOpen` to preserve query while returning to chapter view.
- `web/src/styles.css` - polished search, highlight, unknown card, and safe value preview styles; removed stray CSS that blocked production minification.
- `test/web/search-unknown.test.tsx` - search and unknown-key UI coverage.
- `test/web/app-shell-responsive.test.tsx` - responsive shell regression coverage.
- `test/packaging/tarball-contents.test.ts` - Vite asset and placeholder-retirement packaging assertions.
- Existing web tests updated only for the new `searchOpen` store field / AppShell search props.

## Decisions Made

- Preserved search query separately from whether the result view is open, using `searchOpen`; this satisfies the requirement that result selection returns to normal chapter view while retaining the query for return navigation.
- Kept search result highlighting as React text segmentation with `<mark>`, not `dangerouslySetInnerHTML`, to mitigate query-driven highlight injection.
- Kept unknown values strictly read-only and escaped through React text/pre rendering; no unknown editing controls were added in Phase 3.
- Did not modify `STATE.md` or `ROADMAP.md`; the orchestrator owns those writes for this execution mode.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing Task 3 responsive regression file**
- **Found during:** Task 3 automated verification.
- **Issue:** The plan required `test/web/app-shell-responsive.test.tsx`, but the file did not exist; the requested vitest command silently ran only the existing search/unknown test file.
- **Fix:** Added responsive tests for independent pane rail controls and the editor-pane search affordance.
- **Files modified:** `test/web/app-shell-responsive.test.tsx`
- **Commit:** `1d8f710`

**2. [Rule 3 - Blocking] Removed stray CSS that broke Vite production minification**
- **Found during:** `npm run build`.
- **Issue:** `web/src/styles.css` contained an orphan `color: var(--gsd-warning); }` declaration from earlier work; Lightning CSS rejected it during production minification.
- **Fix:** Removed the stray declaration while adding the Plan 03-06 search/unknown polish styles.
- **Files modified:** `web/src/styles.css`
- **Commit:** `1d8f710`

**3. [Rule 3 - Blocking] Linked dependencies for isolated worktree test execution**
- **Found during:** `npm test` in the isolated worktree.
- **Issue:** CLI smoke tests initially failed because the isolated worktree had an empty generated `node_modules` directory, shadowing dependencies installed in the parent checkout.
- **Fix:** Replaced the generated worktree-local dependency directory with a temporary symlink to the parent checkout's `node_modules` for verification, then removed the symlink before committing/summary.
- **Files modified:** none committed.
- **Commit:** none.

**4. [Rule 3 - Blocking] Packaging contract needed Vite asset assertions**
- **Found during:** Task 3 packaging review.
- **Issue:** Existing packaging test asserted `dist/client/index.html` shipped and was served, but did not explicitly assert hashed Vite JS/CSS assets or that the placeholder-only contract was retired.
- **Fix:** Added assertions for `dist/client/assets/index-*.js`, `dist/client/assets/index-*.css`, `/assets/` in built HTML, and no placeholder text.
- **Files modified:** `test/packaging/tarball-contents.test.ts`
- **Commit:** `023b76e`

## Issues Encountered

- `npm test` failed as a single full-suite run after dependency linking because `test/server/cli-launch.test.ts` and `test/server/teardown.test.ts` timed out under concurrent full-suite load. Both suites passed when rerun individually, and all plan-specific gates passed. This is documented as an environment/concurrency issue rather than a product regression.

## Verification

- `npx vitest run test/web/search-unknown.test.tsx -t search --reporter=dot` - passed.
- `npx vitest run test/web/search-unknown.test.tsx -t unknown --reporter=dot` - passed.
- `npx vitest run test/web/app-shell-responsive.test.tsx test/web/search-unknown.test.tsx --reporter=dot` - passed (2 files, 7 tests).
- `npm run build` - passed after CSS minification fix.
- `npm run typecheck` - passed.
- `npx vitest run test/packaging/tarball-contents.test.ts --reporter=dot` - passed (5 tests).
- `npx vitest run test/server/cli-launch.test.ts --reporter=dot` - passed in isolation.
- `npx vitest run test/server/teardown.test.ts --reporter=dot` - passed in isolation.
- `npm test` - failed as a full concurrent run due to CLI/teardown smoke test timeouts; rerun subsets above passed.
- Automated local launch smoke - passed: built `dist/cli.js --no-open` printed tokenized URL, root SPA returned HTTP 200 with `/assets/` HTML, and token-authenticated `/api/health` returned HTTP 200.

## Browser Launch Smoke Checkpoint Status

The orchestrator performed the requested browser smoke with Playwright after Chrome DevTools MCP failed with `Target.setDiscoverTargets: Target closed`.

- Initial smoke found a real runtime bug: the built SPA rendered blank with `No QueryClient set, use QueryClientProvider to set one`.
- Fixed in follow-up commit `3e5b8a3` by wrapping `<App />` in `QueryClientProvider` at `web/src/main.tsx`, then rebuilding `dist/client`.
- Re-ran the built CLI (`node dist/cli.js --no-open --port 4179`) and opened the tokenized URL in Chromium.
- Verified token bootstrap strips `?t=` to `/` with no browser errors.
- Verified the three-pane UI renders with tracked configs, chapter navigation, search, and editor surface.
- Tracked and loaded `test/fixtures/project-config-with-fabricated-unknown-keys.json`.
- Verified field cards render, global search finds `workflow.tdd_mode`, and the dedicated `Unrecognized` chapter renders unknown project keys read-only with safe previews.
- Verified invalid numeric edit feedback: clearing `workflow.subagent_timeout` shows `must be number` and disables Save.

Smoke artifacts captured locally: `/tmp/phase3-smoke-after-fix.png`, `/tmp/phase3-smoke-selected.png`, and `/tmp/phase3-smoke-interactions-2.png`.

## Auth Gates

None.

## Known Stubs

None that block this plan. Unknown/future key editing remains intentionally deferred to a future schema-aware phase; Phase 3 renders unknown keys read-only and preserves them on save.

## Threat Flags

None beyond the plan threat model. The new trust-boundary surfaces are exactly those planned: search highlight rendering, unknown value display, and packaged SPA asset verification.

## Self-Check: PASSED

- Created files exist: `SearchView.tsx`, `searchIndex.ts`, `UnknownChapter.tsx`, `SafeValuePreview.tsx`, `search-unknown.test.tsx`, `app-shell-responsive.test.tsx`, and this summary.
- Required commits exist in history: `dd0bd7e`, `aee5b79`, `096491e`, `6182728`, `1d8f710`, `023b76e`.
- Required automated gates passed except full `npm test`, whose failing server smoke suites passed in isolation as documented above.
- `STATE.md` and `ROADMAP.md` were not modified by this executor.

---
*Phase: 03-generic-schema-driven-ui-shell*
*Completed: 2026-07-17*
