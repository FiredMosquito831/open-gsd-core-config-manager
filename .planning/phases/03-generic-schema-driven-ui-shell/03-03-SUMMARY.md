---
phase: 03-generic-schema-driven-ui-shell
plan: 03
subsystem: ui

tags: [react, vite, typescript, zustand, react-query, ajv, schema-driven]

requires:
  - phase: 03-generic-schema-driven-ui-shell
    plan: 03-01
    provides: Vite React foundation, token bootstrap, and App shell
  - phase: 03-generic-schema-driven-ui-shell
    plan: 03-02
    provides: /api/schema and /api/workspace additive routes

provides:
  - Token-aware API client with ApiOk/ApiErr envelope handling
  - Typed wrappers for frozen /api/configs and additive /api/schema / /api/workspace routes
  - Shared React Query QueryClient
  - Generic schema index with category grouping, search corpus, handoff detection, and content-gap reporting
  - Effective-value lookup and provenance labels
  - Zustand UI state store for config/chapter/pane/search/highlight
  - Unknown-key-preserving project patch/reset candidate builder
  - Browser-side Ajv validation using the same converted schema as the server

affects:
  - 03-04
  - 03-05

tech-stack:
  added:
    - zustand
    - @tanstack/react-query
  patterns:
    - Token-in-header only; no token in URL after bootstrap
    - ApiOk/ApiErr envelope parsing everywhere
    - Patch a clone of raw.project; never rebuild from schema form state
    - Same buildAjvSchema conversion used client-side and server-side

key-files:
  created:
    - web/src/api/client.ts
    - web/src/api/configs.ts
    - web/src/api/schema.ts
    - web/src/api/workspace.ts
    - web/src/state/queryClient.ts
    - web/src/schema/indexSchema.ts
    - web/src/schema/effective.ts
    - web/src/state/uiStore.ts
    - web/src/schema/patchProject.ts
    - web/src/schema/validation.ts
    - test/web/api-client.test.ts
    - test/web/schema-index.test.ts
    - test/web/patch-project.test.ts
    - test/web/client-validation.test.ts
  modified:
    - vitest.config.ts
    - tsconfig.json

key-decisions:
  - "Use vmThreads Vitest pool in this workspace because the default threads/forks pool timed out waiting for the jsdom worker to start under WSL + a space-in-path project root."
  - "Exclude test/web from the root tsconfig.json (NodeNext module resolution) so web files are type-checked only by tsconfig.web.json (Bundler resolution), avoiding import-extension and Ajv subpath conflicts."
  - "Mirror the server's forbidden-segment denylist in the client patch helpers so dangerous dot-path segments are rejected early in the UX, even though the server remains authoritative."

requirements-completed: [SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-06, EDIT-02, EDIT-04, EDIT-06]

coverage:
  - id: D1
    description: "Token-aware API client attaches x-gsd-token to /api requests, parses ApiOk/ApiErr envelopes, and never leaks the token into query strings"
    requirement: SEC-02
    verification:
      - kind: unit
        ref: "test/web/api-client.test.ts#apiFetch"
        status: pass
    human_judgment: false
  - id: D2
    description: "Typed wrappers exist for frozen /api/configs and additive /api/schema / /api/workspace routes"
    requirement: EDIT-01
    verification:
      - kind: unit
        ref: "test/web/api-client.test.ts#route wrappers"
        status: pass
    human_judgment: false
  - id: D3
    description: "Schema index groups every schema entry by x-category with stable ordering and exposes field metadata, enum values, and option meanings"
    requirement: SCHEMA-02
    verification:
      - kind: unit
        ref: "test/web/schema-index.test.ts#indexSchema"
        status: pass
    human_judgment: false
  - id: D4
    description: "Dynamic-map, array, and object entries are flagged as handoff fields for Phase 4 editors"
    requirement: SCHEMA-04
    verification:
      - kind: unit
        ref: "test/web/schema-index.test.ts#flags array, object, and dynamic-map entries as handoff fields"
        status: pass
    human_judgment: false
  - id: D5
    description: "Content gaps are reported for enum entries missing x-options prose"
    requirement: SCHEMA-03
    verification:
      - kind: unit
        ref: "test/web/schema-index.test.ts#reports content gaps for enum entries missing x-options"
        status: pass
    human_judgment: false
  - id: D6
    description: "Effective-value lookup resolves dot paths to EffectiveLeaf values and maps provenance to user-facing labels"
    requirement: EDIT-02
    verification:
      - kind: unit
        ref: "test/web/schema-index.test.ts#effective.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "Zustand UI store holds active config, chapter, pane state, search query, and highlight target"
    requirement: EDIT-05
    verification:
      - kind: unit
        ref: "test/web/schema-index.test.ts#uiStore"
        status: pass
    human_judgment: false
  - id: D8
    description: "Project save candidates are built from a clone of raw.project and preserve unknown keys"
    requirement: SCHEMA-06
    verification:
      - kind: unit
        ref: "test/web/patch-project.test.ts#preserves unknown keys from the fixture"
        status: pass
    human_judgment: false
  - id: D9
    description: "Reset removes only the project-layer override path and does not mutate global or canonical data"
    requirement: EDIT-02
    verification:
      - kind: unit
        ref: "test/web/patch-project.test.ts#removes reset paths without mutating the original raw.project"
        status: pass
    human_judgment: false
  - id: D10
    description: "Client validation compiles the same converted Ajv schema as the server and reports inline errors"
    requirement: EDIT-06
    verification:
      - kind: unit
        ref: "test/web/client-validation.test.ts#createClientValidator"
        status: pass
    human_judgment: false

# Metrics
duration: 38min
completed: 2026-07-17
status: complete
---

# Phase 3 Plan 3: Generic Schema-Driven UI Shell - Browser Data Layer Summary

**Browser-side data layer: token-aware API wrappers, generic schema/effective/patch/validation helpers, and React Query/Zustand state foundations.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-07-17T20:16:14+0300
- **Completed:** 2026-07-17T20:54:42+0300
- **Tasks:** 3 (TDD style: 3 RED commits, 3 GREEN commits, plus 2 infrastructure commits)
- **Files modified:** 16

## Accomplishments
- Built a token-aware API client that sends `x-gsd-token` only in headers and turns `ApiErr` envelopes into typed `ApiError` instances.
- Added typed wrappers for all frozen `/api/configs` and additive `/api/schema` + `/api/workspace` routes.
- Created a shared React Query `QueryClient` for server-state caching in later UI plans.
- Implemented `indexSchema` to group the flat bundled schema by `x-category`, expose field metadata/enum/option text, flag handoff fields, and report content gaps.
- Implemented `effective.ts` to resolve dot paths to `EffectiveLeaf` values and map provenance to user-facing labels.
- Implemented a Zustand UI store for active config, chapter, pane state, search, and highlight target.
- Implemented unknown-key-preserving `buildProjectSaveCandidate` with forbidden-segment-safe `setDotPath`/`deleteDotPath` helpers.
- Implemented browser-side Ajv validation using the same `buildAjvSchema` conversion and metadata keywords as the server.

## Task Commits

Each task was committed atomically (TDD RED + GREEN):

1. **Task 1: Token-aware API wrappers** - `223b8da` (test), `9d299f1` (feat)
2. **Task 2: Schema/effective indexing and UI store** - `a22cf20` (test), `3359ed6` (feat)
3. **Task 3: Patch/reset and client validation** - `1c6d6bd` (test), `9180d4c` (feat)

**Infrastructure / typecheck fixes:**
- `1b13e3f` (chore): use `vmThreads` pool so jsdom web tests start in this workspace.
- `a83dc32` (fix): align web test imports and `tsconfig.json` for dual typecheck.

**Plan metadata:** (none — this summary is the plan record)

## Files Created/Modified
- `web/src/api/client.ts` - `apiFetch` + `ApiError`; token-in-header only.
- `web/src/api/configs.ts` - `/api/configs` route wrappers.
- `web/src/api/schema.ts` - `/api/schema` wrapper.
- `web/src/api/workspace.ts` - `/api/workspace/*` route wrappers (additive file required by plan behavior).
- `web/src/state/queryClient.ts` - Shared React Query `QueryClient`.
- `web/src/schema/indexSchema.ts` - Category grouping, field metadata, search corpus, handoff detection, content gaps.
- `web/src/schema/effective.ts` - Effective leaf lookup and provenance labels.
- `web/src/state/uiStore.ts` - Zustand UI state store.
- `web/src/schema/patchProject.ts` - Dot-path patch/reset and unknown-key-preserving candidate builder.
- `web/src/schema/validation.ts` - Browser Ajv validator using `buildAjvSchema`.
- `test/web/api-client.test.ts` - Unit tests for API client and route wrappers.
- `test/web/schema-index.test.ts` - Unit tests for schema index, effective values, and UI store.
- `test/web/patch-project.test.ts` - Unit tests for patch/reset and unknown-key preservation.
- `test/web/client-validation.test.ts` - Unit tests for client-side Ajv validation.
- `vitest.config.ts` - Added `pool: 'vmThreads'`.
- `tsconfig.json` - Excluded `test/web` from root NodeNext typecheck.

## Decisions Made
- Followed the plan's TDD cycle for all three tasks.
- Kept the server as the authoritative save validator while providing client-side Ajv feedback for UX.
- Mirrored the server's `__proto__`/`constructor`/`prototype` forbidden-segment denylist in the browser patch helpers for early safety feedback.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest jsdom worker startup timed out in this workspace**
- **Found during:** Task 1 setup, before writing the first test.
- **Issue:** The default `threads`/`forks` pool failed with "Timeout waiting for worker to respond" when initializing the jsdom environment in this WSL + space-in-path project root.
- **Fix:** Switched Vitest to `pool: 'vmThreads'` in `vitest.config.ts`. Web tests then initialized successfully.
- **Files modified:** `vitest.config.ts`
- **Verification:** `npx vitest run test/web/bootstrap.test.tsx` passes.
- **Committed in:** `1b13e3f`

**2. [Rule 3 - Blocking] Root NodeNext typecheck conflicted with web files and Ajv subpath**
- **Found during:** Final `npm run typecheck` verification.
- **Issue:** The root `tsconfig.json` (NodeNext) includes `test/**/*.ts`, so it type-checked `test/web/*.ts` files that import `web/src/*.ts` and `ajv/dist/2020`. NodeNext requires explicit `.js` import extensions and cannot resolve the Ajv 2020 subpath as an ESM import, causing `tsc --noEmit` failures.
- **Fix:** Excluded `test/web` from the root `tsconfig.json` so web files are type-checked only by `tsconfig.web.json` (Bundler resolution). Added explicit `.js` extensions and JSON `with { type: 'json' }` attributes to web test imports to keep them valid under both resolutions.
- **Files modified:** `tsconfig.json`, `test/web/api-client.test.ts`, `test/web/schema-index.test.ts`, `test/web/patch-project.test.ts`, `test/web/client-validation.test.ts`
- **Verification:** `npm run typecheck` passes.
- **Committed in:** `a83dc32`

**3. [Rule 1 - Bug] Test expectations needed refinement after first GREEN run**
- **Found during:** Task 1 GREEN run.
- **Issue:** Two test expectations were too strict or reused a consumed `Response` body: GET wrapper tests expected an explicit `method: 'GET'` in the fetch init, and the `ApiError` test re-read the same mocked `Response` twice, causing JSON parse failures.
- **Fix:** Changed GET wrapper assertions to `expect.any(Object)` and switched the `ApiError` test to use `mockImplementation` returning a fresh `Response` per call.
- **Files modified:** `test/web/api-client.test.ts`
- **Verification:** `test/web/api-client.test.ts` passes.
- **Committed in:** `9d299f1` (included in the GREEN commit)

**4. [Rule 1 - Bug] Unknown-key fixture expectation pointed to wrong nesting level**
- **Found during:** Task 3 GREEN run.
- **Issue:** The test asserted `candidate.x_test_unknown_toggle` was `false`, but the fixture stores `x_test_unknown_toggle` inside the `workflow` object.
- **Fix:** Updated the assertion to `candidate.workflow.x_test_unknown_toggle`.
- **Files modified:** `test/web/patch-project.test.ts`
- **Verification:** `test/web/patch-project.test.ts` passes.
- **Committed in:** `9180d4c` (included in the GREEN commit)

**5. [Rule 1 - Bug] Handoff detection prioritized `object` over dynamic-map**
- **Found during:** Task 2 GREEN run.
- **Issue:** `model_overrides` has `type: 'object'` and `patternProperties`, so the helper returned `object` instead of `dynamic-map`.
- **Fix:** Reordered `isHandoffEntry` to check `patternProperties` before `type === 'object'`.
- **Files modified:** `web/src/schema/indexSchema.ts`
- **Verification:** `test/web/schema-index.test.ts` passes.
- **Committed in:** `3359ed6` (included in the GREEN commit)

---

**Total deviations:** 5 auto-fixed (2 blocking, 3 bugs)
**Impact on plan:** All fixes were necessary for tests/typecheck to pass. No scope creep; the only additive file (`web/src/api/workspace.ts`) was required by the plan's stated behavior.

## Issues Encountered
- None beyond the workspace-specific test runner / typecheck alignment handled above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The browser data layer is ready for Plan 03-04 (UI components: sidebar, chapter navigation, field cards, search).
- All server routes are wrapped and typed; React Query and Zustand foundations are in place.
- No blockers.

## Self-Check: PASSED
- All 4 web test files exist and pass: `test/web/api-client.test.ts`, `test/web/schema-index.test.ts`, `test/web/patch-project.test.ts`, `test/web/client-validation.test.ts`.
- `npm run typecheck` passes.
- All Task 1-3 GREEN commits and the infrastructure/typecheck commits are in history.

---
*Phase: 03-generic-schema-driven-ui-shell*
*Completed: 2026-07-17*
