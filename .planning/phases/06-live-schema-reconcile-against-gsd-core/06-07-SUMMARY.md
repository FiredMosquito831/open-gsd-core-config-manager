---
phase: 06-live-schema-reconcile-against-gsd-core
plan: 07
subsystem: server-schema-lifecycle
tags: [fastify, schema-authority, guarded-api, ajv, atomic-activation]
requires:
  - phase: 06-03
    provides: active schema manager with durable atomic activation and reset
  - phase: 06-06
    provides: fixed-source inert refresh proposals
provides:
  - Guarded server-owned schema lifecycle routes with opaque proposal transitions
  - One injected active schema authority for rendering and validation consumers
  - Additive review-safe schema lifecycle API DTOs
affects: [06-08, schema-workspace, config-routes, history-restore]
tech-stack:
  added: []
  patterns: [guarded-lifecycle-routes, server-held-proposals, snapshot-per-operation, persist-before-swap]
key-files:
  created: []
  modified:
    - packages/server/src/api-types.ts
    - packages/server/src/app.ts
    - packages/server/src/routes/schema.ts
    - packages/server/src/routes/configs.ts
    - packages/server/src/routes/history.ts
    - packages/server/src/workspace-store.ts
    - test/server/schema-route.test.ts
key-decisions:
  - "Lifecycle APIs expose only review-safe status and evidence; candidate schema content and upstream selectors remain server-held."
  - "Every schema-sensitive transaction captures an ActiveSchemaManager snapshot at operation start."
metrics:
  duration: "22 min"
  completed_date: "2026-07-20"
status: complete
---

# Phase 06 Plan 07: Guarded Schema Lifecycle Authority Summary

Guarded local API lifecycle transitions now activate, reset, and expose an authoritative compiled schema generation without accepting browser-selected sources or schema content.

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-20T19:05:58Z
- **Completed:** 2026-07-20T19:27:58Z
- **Tasks:** 2/2
- **Files modified:** 7

## Accomplishments

- Added client-safe DTOs and guarded `/api/schema/status`, refresh, activate, cancel, and reset endpoints inside the existing Host/Origin/token-protected plugin scope.
- Ensured refresh has an empty body contract; activation consumes only a server-held opaque proposal ID, and cancellation/reset cannot accept source, ref, path, or schema selectors.
- Composed one `ActiveSchemaManager` and `SchemaRefreshService` at app startup, injecting both into lifecycle routes and the manager into config, history, and workspace creation consumers.
- Migrated GET schema, config load/save, history restore, and new-config creation away from bundled/global validation accessors and onto one captured manager snapshot per operation.
- Retained failed activation proposals for retry; only successful persistence-and-swap invalidates the proposal. Reset leaves the active snapshot unchanged when persistence removal fails.

## Task Commits

1. **Task 1: Freeze guarded schema lifecycle route contracts** — `cd8af9c` (test)
2. **Task 2: Add lifecycle APIs and one injected schema authority** — `22adb62` (feat)

## Verification

- PASS — `npx vitest run test/server/schema-route.test.ts test/server/active-schema-manager.test.ts test/server/schema-refresh.test.ts test/server/config-routes.test.ts test/server/history-route.test.ts --reporter=dot` (29 tests)
- PASS — `npx tsc --noEmit`
- BLOCKED (pre-existing) — `npm run typecheck` passes the server program then fails the unrelated web test Node-type configuration in `test/web/phase4-catalog-evidence.test.ts`.

## Decisions Made

- Lifecycle status returns bounded identity prefixes and persistent safe warnings, never local paths, archive paths, source bytes, URLs, or raw exception text.
- The manager snapshot is read once at the beginning of each schema-sensitive load/save/create/restore operation to prevent renderer-validator generation splits.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. All newly exposed lifecycle routes are registered exclusively beneath the existing guarded `/api` plugin and accept no upstream identity or schema-content inputs.

## Self-Check: PASSED

- Confirmed lifecycle API and authority-wiring files exist.
- Confirmed task commits `cd8af9c` and `22adb62` exist in git history.

---
*Phase: 06-live-schema-reconcile-against-gsd-core*
*Completed: 2026-07-20*
