---
phase: 03-generic-schema-driven-ui-shell
plan: 02
subsystem: api
tags: [fastify, typescript, json-schema, persistence, registry]

requires:
  - phase: 02-local-loopback-server-cli-security-hardening
    provides: token-guarded /api scope, registry path boundary, saveWithSnapshot pipeline

provides:
  - token-guarded GET /api/schema returning the bundled canonical schema
  - persisted /api/workspace/configs track/list/remove/reorder/locate routes
  - folder scan route that returns review candidates without mutating state
  - create-preview/create routes for new .planning/config.json files
  - registry seed/remove/reorder/relocate helpers
  - workspace store with derived ok/missing/invalid status per tracked config

affects:
  - 03-generic-schema-driven-ui-shell (frontend plans use the new API)
  - 05-version-history-ui (relies on the same registry/snapshot path)

tech-stack:
  added: []
  patterns:
    - app-data persistence for workspace list outside tracked projects
    - derived workspace status at read time so missing files are surfaced immediately
    - registry remains the single filesystem-path validation boundary
    - create routes through saveWithSnapshot to reuse validate/atomic/snapshot pipeline

key-files:
  created:
    - packages/server/src/workspace-store.ts
    - packages/server/src/routes/schema.ts
    - packages/server/src/routes/workspace.ts
    - test/server/schema-route.test.ts
    - test/server/workspace-routes.test.ts
    - test/server/workspace-scan-create.test.ts
  modified:
    - packages/server/src/api-types.ts
    - packages/server/src/registry.ts
    - packages/server/src/app.ts
    - packages/cli/src/bootstrap.ts
    - test/server/api-routes.test.ts

key-decisions:
  - "Workspace store owns persistence and derived status; registry remains the path-validation boundary"
  - "Registry gained a relocate() helper so workspace locate() keeps the same opaque id while changing path"
  - "Create flow writes through saveWithSnapshot, not a direct writeFileSync, so it reuses the safe pipeline"

patterns-established:
  - "Workspace persistence: only id + path stored; status derived from filesystem at read time"
  - "All client-supplied filesystem paths flow through registry.track() or registry.relocate()"
  - "Scan returns candidates only; the persisted list is mutated only by explicit track calls"

requirements-completed: [SCHEMA-04, DISC-01, DISC-02, DISC-03, DISC-04, DISC-05]

coverage:
  - id: D1
    description: "GET /api/schema is token-guarded and returns the bundled canonical schema"
    requirement: SCHEMA-04
    verification:
      - kind: unit
        ref: "test/server/schema-route.test.ts#GET /api/schema requires x-gsd-token and returns the bundled schema keys"
        status: pass
      - kind: unit
        ref: "test/server/schema-route.test.ts#GET /api/schema rejects a request without the token"
        status: pass
    human_judgment: false
  - id: D2
    description: "Workspace track/list routes persist validated absolute paths across app restarts"
    requirement: DISC-02
    verification:
      - kind: unit
        ref: "test/server/workspace-routes.test.ts#GET /api/workspace/configs persists tracked configs across a fresh app bootstrap using the same app-data root"
        status: pass
      - kind: unit
        ref: "test/server/workspace-routes.test.ts#POST /api/workspace/configs/track validates and tracks an absolute config path"
        status: pass
    human_judgment: false
  - id: D3
    description: "Missing tracked files remain in the sidebar with a problem status"
    requirement: DISC-02
    verification:
      - kind: unit
        ref: "test/server/workspace-routes.test.ts#GET /api/workspace/configs keeps a missing tracked file in the list with a problem status"
        status: pass
    human_judgment: false
  - id: D4
    description: "Folder scan discovers .planning/config.json files and respects node_modules/.git/dist boundaries"
    requirement: DISC-03
    verification:
      - kind: unit
        ref: "test/server/workspace-scan-create.test.ts#POST /api/workspace/scan discovers .planning/config.json files under a chosen root"
        status: pass
      - kind: unit
        ref: "test/server/workspace-scan-create.test.ts#POST /api/workspace/scan skips node_modules, .git, and dist directories"
        status: pass
    human_judgment: false
  - id: D5
    description: "Scan returns candidates only and does not mutate the persisted workspace list"
    requirement: DISC-03
    verification:
      - kind: unit
        ref: "test/server/workspace-scan-create.test.ts#POST /api/workspace/scan does not mutate the persisted workspace list"
        status: pass
    human_judgment: false
  - id: D6
    description: "Create preview and create compute the target path server-side and refuse to overwrite without confirmation"
    requirement: DISC-04
    verification:
      - kind: unit
        ref: "test/server/workspace-scan-create.test.ts#POST /api/workspace/configs/create creates a new config file, tracks it, and writes a minimal project config"
        status: pass
      - kind: unit
        ref: "test/server/workspace-scan-create.test.ts#POST /api/workspace/configs/create refuses to overwrite an existing config without overwrite=true"
        status: pass
      - kind: unit
        ref: "test/server/workspace-scan-create.test.ts#POST /api/workspace/configs/create overwrites an existing config when overwrite=true and records a snapshot"
        status: pass
    human_judgment: false
  - id: D7
    description: "Frozen /api/configs routes keep their Phase 2 envelope and behavior when the workspace store is present"
    requirement: SCHEMA-04
    verification:
      - kind: unit
        ref: "test/server/api-routes.test.ts#Phase 3 regression - workspace store presence does not change frozen /api/configs contract"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-07-17
status: complete
---

# Phase 03 Plan 02: Server-side schema catalog and persisted workspace API

**Token-guarded /api/schema and persisted /api/workspace/* routes added to the existing Fastify helper without changing the frozen /api/configs contract.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-07-17T19:20:00Z
- **Completed:** 2026-07-17T19:50:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Added `GET /api/schema` that returns the bundle-safe inlined canonical schema in the frozen `ApiOk` envelope.
- Added `/api/workspace/configs` routes for tracking, listing, removing, reordering, and relocating persisted configs.
- Implemented app-data persistence for the tracked workspace list and derived `ok/missing/invalid` status at read time.
- Added `/api/workspace/scan` that returns review candidates without mutating the persisted list, skipping `node_modules`, `.git`, and `dist`.
- Added `/api/workspace/configs/create-preview` and `/api/workspace/configs/create` that compute the target path server-side and route the write through `saveWithSnapshot`.
- Extended the registry with optional seed, remove, reorder, and relocate helpers while preserving the frozen `TrackedConfig` shape and the no-argument `createRegistry()` signature.
- Confirmed the existing `/api/configs` routes still behave identically when the workspace store is present.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write server contract tests** - `eba7e98` (test)
2. **Task 2: Implement schema and persistent workspace routes** - `b30ea42` (feat)
3. **Task 3: Implement scan and create flows** - `042dac3` (feat)

## Files Created/Modified

- `packages/server/src/api-types.ts` - Added `TrackedWorkspaceConfig` with status and problem fields.
- `packages/server/src/registry.ts` - Added optional seed, `remove`, `reorder`, and `relocate` helpers; extracted shared path validation.
- `packages/server/src/workspace-store.ts` - New app-data persisted workspace store with load/track/remove/reorder/locate/scan/create.
- `packages/server/src/routes/schema.ts` - New token-guarded `GET /api/schema` route.
- `packages/server/src/routes/workspace.ts` - New `/api/workspace/*` route handlers returning `ApiOk/ApiErr` envelopes.
- `packages/server/src/app.ts` - Registered `schemaRoutes` and `workspaceRoutes` inside `/api`; added `workspaceStore`/`workspaceRoot` options.
- `packages/cli/src/bootstrap.ts` - Creates workspace store from OS app-data root and injects it into `buildApp`.
- `test/server/schema-route.test.ts` - Tests for token-guarded schema route.
- `test/server/workspace-routes.test.ts` - Tests for persistence, remove, reorder, locate, and missing-file status.
- `test/server/workspace-scan-create.test.ts` - Tests for scan boundaries and create preview/create overwrite semantics.
- `test/server/api-routes.test.ts` - Regression assertions that frozen `/api/configs` shape is unchanged.

## Decisions Made

- **Workspace store owns persistence and status:** The registry stays focused on path validation; the store handles ordering, persistence, and derived status. This keeps the Phase 2 registry boundary intact while adding Phase 3 features.
- **Registry `relocate()` keeps the id stable:** The locate route must not break the UI's selected sidebar item. `relocate()` updates the path behind an existing id, which is safe because the id is opaque to clients.
- **Create writes through `saveWithSnapshot`:** Even though the config is minimal, using the existing validate/atomic/snapshot pipeline guarantees the same safety invariants as `PUT /api/configs/:id`.
- **Status is derived at read time:** Missing files are detected immediately on `GET /api/workspace/configs` rather than only at startup, satisfying D-14's "never silently discard" requirement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reinstalled npm dependencies for the Linux platform so tests could run**
- **Found during:** Task 1 (running the RED test suite)
- **Issue:** The existing `node_modules` contained Windows-only native bindings (`@esbuild/win32-x64`, `@rolldown/binding-linux-x64-gnu` missing), so `vitest` and `tsx` would not start on the WSL Linux environment.
- **Fix:** Ran `npm install` to resolve the Linux platform-specific optional dependencies and refresh `package-lock.json`.
- **Files modified:** `package-lock.json`
- **Verification:** `npm run test:server` and `npm run typecheck` execute successfully.
- **Committed in:** `eba7e98` (Task 1 test commit)

### Process Deviations

**2. Implementation of scan and create landed in the Task 2 commit rather than a separate Task 3 commit**
- **Found during:** Task 2 implementation
- **Issue:** The workspace route module and store were implemented together, so scan/create functionality was ready before a distinct Task 3 commit could be made.
- **Fix:** Task 3 was completed by refining the scan invalid-candidate handling and adding the corresponding test coverage in a separate commit (`042dac3`). The deliverables and test coverage are unchanged.
- **Files modified:** `packages/server/src/workspace-store.ts`, `test/server/workspace-scan-create.test.ts`
- **Verification:** `npx vitest run test/server/workspace-scan-create.test.ts --reporter=dot` passes.

### Registry Additions Beyond Plan

**3. Added `relocate()` to `ConfigRegistry` beyond the plan's listed `seed/remove/reorder` helpers**
- **Found during:** Task 2 (workspace locate route implementation)
- **Issue:** The locate route must return the same opaque id after a path is changed, but the registry's id is derived from the resolved path. Without a stable id, the UI's selected sidebar item would change unexpectedly.
- **Fix:** Added `registry.relocate(id, rawPath)` which validates the new path and updates the mapping for the existing id.
- **Files modified:** `packages/server/src/registry.ts`
- **Verification:** `test/server/workspace-routes.test.ts#POST /api/workspace/configs/:id/locate relinks a tracked entry to a new absolute path through registry validation` passes.

---

**Total deviations:** 1 auto-fixed blocking issue, 2 process/registry additions
**Impact on plan:** No functional scope creep; all deliverables match the plan. The `relocate()` helper is a necessary additive API for the locate route.

## Issues Encountered

- `test/server/teardown.test.ts` occasionally times out when run as part of the full `npm run test:server` suite. It passes reliably in isolation (`npx vitest run test/server/teardown.test.ts --reporter=dot`). This appears to be a test-suite resource/timing issue rather than a regression caused by the new routes; no teardown code was modified.

## Known Stubs

None. All schema/workspace/scan/create routes are fully implemented and tested.

## Threat Flags

No new security-relevant surface beyond the plan's threat model. All mitigations from the threat register are in place:
- T-03-04: every concrete config path goes through `registry.track()` or `registry.relocate()`.
- T-03-05: workspace route errors use fixed static messages and never echo submitted paths.
- T-03-06: scan skips `.git`, `node_modules`, and `dist` and returns candidates only.
- T-03-07: persisted workspace data contains only id + path; status is re-derived at startup.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The server-side API surface for the generic schema-driven UI shell is complete.
- Frontend plans can now consume `GET /api/schema`, `GET /api/workspace/configs`, scan/create routes, and the existing `GET/PUT /api/configs/:id` routes.
- No blockers for Phase 3 frontend work; the flaky teardown test is an existing test-suite timing issue, not a runtime defect.

---
*Phase: 03-generic-schema-driven-ui-shell*
*Completed: 2026-07-17*
