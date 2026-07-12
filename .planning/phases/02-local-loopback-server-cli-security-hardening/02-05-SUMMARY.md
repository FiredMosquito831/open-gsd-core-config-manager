---
phase: 02-local-loopback-server-cli-security-hardening
plan: 05
subsystem: api
tags: [fastify, rest-api, registry, ajv, path-traversal, saveWithSnapshot, sha256, vitest]

# Dependency graph
requires:
  - phase: 02-local-loopback-server-cli-security-hardening
    provides: "02-02: saveWithSnapshot() (packages/server/src/snapshot-store/save-with-snapshot.ts) — the SAVE-04 mechanism the PUT route composes"
  - phase: 02-local-loopback-server-cli-security-hardening
    provides: "02-04: buildApp()/LaunchContext/guard plugins (packages/server/src/app.ts, context.ts) — the guarded /api plugin scope these routes register inside"
  - phase: 01-schema-foundation-data-layer-safety
    provides: "packages/config-io's frozen load()/createValidator()/buildAjvSchema()/LoadResult barrel — composed here, never modified"
provides:
  - "packages/server/src/{api-types,registry,schema}.ts — the frozen ApiOk/ApiErr/TrackedConfig envelope, the in-memory tracked-config registry (the single path-traversal boundary), and the bundle-safe inlined schema"
  - "packages/server/src/routes/configs.ts — GET /configs, POST /configs/track, GET/PUT /configs/:id, composed into app.ts's guarded /api scope"
  - "02-API-CONTRACT.md — the frozen REST contract Phase 3's UI and Phase 5's version-history UI build against"
affects: ["Phase 3 (schema-driven UI consumes GET/PUT /api/configs/:id and POST /api/configs/track exactly as frozen here)", "Phase 5 (version-history revert re-enters through PUT /api/configs/:id -> saveWithSnapshot, no special-case path)"]

# Tech tracking
tech-stack:
  added: []
  patterns: ["JSON module import (`with { type: 'json' }`) to inline a build-time-resolved data file into an esbuild/tsup bundle, avoiding an import.meta.url-relative runtime path resolution that breaks once bundled", "opaque-id registry as the sole path-traversal boundary: a client-supplied path is accepted and validated in exactly one place (track()), every other route resolves an id the server itself minted", "Fastify route-level JSON-Schema body validation (not Ajv called manually) for the two mutating routes, reusing Fastify's built-in Ajv rather than hand-rolling body checks"]

key-files:
  created:
    - packages/server/src/api-types.ts
    - packages/server/src/registry.ts
    - packages/server/src/schema.ts
    - packages/server/src/routes/configs.ts
    - test/server/api-routes.test.ts
    - .planning/phases/02-local-loopback-server-cli-security-hardening/02-API-CONTRACT.md
  modified:
    - packages/server/src/app.ts
    - test/server/security.test.ts

key-decisions:
  - "Implemented D-01 through D-12's downstream consumption exactly as researched: schema.ts imports packages/schema-data/bundled-schema.json as a JSON module (with { type: 'json' }) so tsup/esbuild inlines it at build time — the server never relies on config-io/load.ts's import.meta.url-relative default schema path, closing the T-02-26 packaging landmine before it could ever surface in Plan 07's packaged smoke test"
  - "registry.ts's track() is the ONLY code path in the whole API that accepts a client-supplied filesystem path; every other route resolves a server-minted opaque id. id = sha256(resolve(path)).hex.slice(0, 32), matching the snapshot store's own hashing scheme (paths.ts) so an id and its snapshot directory are trivially correlatable in Phase 5"
  - "RegistryError carries a fixed, static message per rejection reason and never interpolates the submitted path — verified by 'rejects a relative path on track' asserting the response body never contains the submitted string"
  - "PUT /api/configs/:id performs no filesystem write of its own — it calls saveWithSnapshot(tracked.path, req.body.config, getValidator(), { root: snapshotRoot, warn }) and maps SaveResult.ok === false onto HTTP 422 with the raw Ajv errors, never touching fs directly (verified by a comment-filtered grep for writeFile/writeFileSync/createWriteStream returning 0)"
  - "BuildAppOptions gained registry?/snapshotRoot?/warn? as additive optional fields (no breaking change to Plan 04's existing buildApp({ ctx, clientRoot }) call shape); the registry is exposed on the returned FastifyInstance via app.decorate('configRegistry', registry) plus a `declare module 'fastify'` augmentation, so the CLI (Plan 06) can reach the same registry instance without changing buildApp's return type"

patterns-established:
  - "Route-schema-driven body validation for mutating routes (POST /configs/track, PUT /configs/:id) via Fastify's own { schema: { body } } option, reusing the Ajv instance Fastify already carries rather than hand-validating request shape in the handler"

requirements-completed: [SAVE-04, SEC-02]

coverage:
  - id: D1
    description: "PUT /api/configs/:id without an x-gsd-token header is rejected 403 before the route ever resolves the id — the literal SEC-02 requirement, proven at the mutation route"
    requirement: "SEC-02"
    verification:
      - kind: unit
        ref: "test/server/security.test.ts#rejects missing token"
        status: pass
    human_judgment: false
  - id: D2
    description: "Saving through PUT /api/configs/:id records a pre-write snapshot via saveWithSnapshot and returns the snapshot id in the response envelope, end to end over HTTP, with no extra user action"
    requirement: "SAVE-04"
    verification:
      - kind: unit
        ref: "test/server/api-routes.test.ts#saves a tracked config and records a snapshot"
        status: pass
    human_judgment: false
  - id: D3
    description: "Read and write routes never accept a filesystem path from the client — only the opaque id resolves through the server-held registry; track() is the sole path-accepting entry point and rejects non-absolute, non-.json, and non-regular-file paths without ever echoing the rejected path"
    requirement: "SAVE-04"
    verification:
      - kind: unit
        ref: "test/server/api-routes.test.ts#rejects a relative path on track"
        status: pass
      - kind: unit
        ref: "test/server/api-routes.test.ts#rejects a traversal path on track"
        status: pass
      - kind: unit
        ref: "test/server/api-routes.test.ts#never accepts a filesystem path on the save route"
        status: pass
      - kind: unit
        ref: "test/server/api-routes.test.ts#rejects an unknown config id"
        status: pass
    human_judgment: false
  - id: D4
    description: "A validation failure on save returns 422 with the Ajv field errors and never writes; tracking and loading a config round-trips through Phase 1's frozen load()/LoadResult unchanged"
    requirement: "SAVE-04"
    verification:
      - kind: unit
        ref: "test/server/api-routes.test.ts#returns 422 with field errors when the saved config fails schema validation"
        status: pass
      - kind: unit
        ref: "test/server/api-routes.test.ts#loads a tracked config with effective values and provenance"
        status: pass
      - kind: unit
        ref: "test/server/api-routes.test.ts#tracks an absolute config path and returns a stable id"
        status: pass
    human_judgment: false
  - id: D5
    description: "The REST contract is written down as a frozen artifact (both envelope shapes, all five routes, the status-code map, and named Phase 3/5 extension points) that later phases build against"
    requirement: "SAVE-04"
    verification:
      - kind: other
        ref: ".planning/phases/02-local-loopback-server-cli-security-hardening/02-API-CONTRACT.md (manual review against the plan's frozen-routes list)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-07-13
status: complete
---

# Phase 02 Plan 05: Config REST API Summary

**Server-held tracked-config registry keyed by opaque sha256-derived ids, `GET/POST/PUT /api/configs*` routes wired through Phase 1's `load()` and Plan 02's `saveWithSnapshot()`, and a frozen `02-API-CONTRACT.md` — closing SEC-02 at the actual mutation route and making SAVE-04 reachable exactly as a user reaches it, through a save.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-13T00:11:08+03:00
- **Tasks:** 3 (1 contract/registry/schema task, 1 TDD-style RED test task, 1 GREEN implementation task)
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments

- Built `packages/server/src/api-types.ts`: the frozen `ApiOk<T>`/`ApiErr`/`TrackedConfig` response envelope Phase 3 and Phase 5 build against.
- Built `packages/server/src/registry.ts`: `createRegistry()` returning an in-memory `ConfigRegistry` (`track`/`list`/`resolve`) — the single path-traversal boundary in the whole API. `track()` rejects non-absolute paths, non-`.json` targets, and existing-but-non-regular files, resolves the path before use, and never echoes the rejected path in `RegistryError`'s fixed message. Opaque ids are `sha256(resolve(path)).hex.slice(0, 32)`, matching the snapshot store's own hashing scheme.
- Built `packages/server/src/schema.ts`: `getBundledSchema()`/`getValidator()`, importing `bundled-schema.json` as a JSON module (`with { type: 'json' }`) so the schema is inlined into the bundle at build time — closing the T-02-26 packaging landmine (the server never relies on `config-io/load.ts`'s `import.meta.url`-relative default path) before Plan 07 could ever hit it.
- Wrote `.planning/phases/02-local-loopback-server-cli-security-hardening/02-API-CONTRACT.md`: the frozen contract documenting both envelope shapes, the status-code map, all five routes (health, list, track, load, save) with request/response bodies, and a named Phase 3/Phase 5 extension-points section.
- Wrote `test/server/api-routes.test.ts` (8 behaviors: track-idempotency, relative-path rejection, traversal/non-json rejection, unknown-id 404, load-with-provenance, save-with-snapshot, 422-on-invalid-save, never-accepts-a-path-on-save) and appended `rejects missing token` (the literal SEC-02 case, on `PUT /api/configs/:id`) to `test/server/security.test.ts` — confirmed genuinely RED (404s from the not-yet-registered routes, or a 404 instead of the expected 403) before Task 3 landed.
- Implemented `packages/server/src/routes/configs.ts` (`configRoutes` Fastify plugin: `GET /configs`, `POST /configs/track`, `GET /configs/:id`, `PUT /configs/:id`) and extended `packages/server/src/app.ts`'s `BuildAppOptions` with `registry?`/`snapshotRoot?`/`warn?`, registering `configRoutes` inside the existing guarded `/api` plugin scope, after the token guard, without reordering any of Plan 04's existing registrations. The registry instance is exposed on the built `FastifyInstance` via `app.decorate('configRegistry', registry)`.
- All 17 security + api-routes behaviors pass; targeted `-t` filters for `rejects missing token` and `saves a tracked config and records a snapshot` both green individually; `npm test` reports 88/88 (Phase 1's 65 + snapshot-store's 6 + Plan 04's 9 + this plan's 8); `npx tsc --noEmit` exits 0; a comment-filtered grep for `writeFile`/`writeFileSync`/`createWriteStream` in `routes/configs.ts` returns 0; `git diff --name-only -- packages/config-io/` is empty throughout.

## Task Commits

Each task was committed atomically:

1. **Task 1: Freeze the API contract, the response envelope, the tracked-config registry, and the inlined schema** - `2551e3d` (feat)
2. **Task 2: Write the failing API-route test suite, and append the PUT-token case to the security suite** - `68662be` (test)
3. **Task 3: Implement the config routes and register them in the /api scope** - `96cca9c` (feat)

_TDD note: Task 2 produced a genuine RED state (404s in place of the expected 200/400/403/404/422 responses, since none of the four config routes existed yet); Task 3 is the GREEN implementation, verified by all 17 behaviors passing in Task 3's commit._

## Files Created/Modified

- `packages/server/src/api-types.ts` - `ApiOk<T>`, `ApiErr`, `TrackedConfig` (frozen envelope)
- `packages/server/src/registry.ts` - `createRegistry()`, `ConfigRegistry`, `RegistryError` — the path-traversal boundary
- `packages/server/src/schema.ts` - `getBundledSchema()`, `getValidator()` — bundle-safe inlined schema + memoized validator
- `packages/server/src/routes/configs.ts` - `configRoutes` Fastify plugin — the four config routes
- `packages/server/src/app.ts` - `BuildAppOptions` extended (`registry?`, `snapshotRoot?`, `warn?`), `configRoutes` registered inside the `/api` scope, registry exposed via `app.decorate`
- `test/server/api-routes.test.ts` - 8-behavior suite: track/list/load/save, path-traversal rejection, 422 validation gate
- `test/server/security.test.ts` - appended `rejects missing token` on `PUT /api/configs/:id` (literal SEC-02 case)
- `.planning/phases/02-local-loopback-server-cli-security-hardening/02-API-CONTRACT.md` - frozen REST contract for Phase 3/5

## Decisions Made

- Implemented D-01 through D-12's server-side consumption, plus the plan's `<bundled_schema_landmine>` fix, exactly per 02-CONTEXT.md/02-RESEARCH.md — no deviation from the researched design.
- `registry.ts`'s `id` scheme deliberately mirrors `snapshot-store/paths.ts`'s hashing (`sha256(resolve(path))`) so a tracked config's id and its snapshot directory key are derivable from the same input, aiding Phase 5's revert UI without adding a cross-reference table.
- Chose Fastify's built-in `{ schema: { body } }` route-level validation for `POST /configs/track` and `PUT /configs/:id` rather than hand-validating the request body in the handler, since Fastify already carries its own Ajv instance for exactly this purpose (matches the project's stated Fastify-over-Express rationale in STACK.md).
- Exposed the registry via `app.decorate('configRegistry', registry)` plus a `declare module 'fastify'` augmentation rather than changing `buildApp`'s return type — keeps `Promise<FastifyInstance>` stable for Plan 04's existing callers/tests while still giving Plan 06's CLI bootstrap a way to reach the same registry instance.

## Deviations from Plan

None - plan executed exactly as written, including the pre-authored `<bundled_schema_landmine>` fix, which the plan itself calls out as required and pre-approved (not a deviation from the plan's own instructions).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06 (CLI bootstrap) can call `buildApp({ ctx, clientRoot, snapshotRoot })`, read `app.configRegistry` to seed or inspect the tracked-config list, then `listen()` and `sealLaunchContext()` exactly as Plan 04's readiness note already described — this plan added no new sequencing requirement.
- Phase 3's UI can build directly against `02-API-CONTRACT.md`'s four config routes and the frozen `ApiOk`/`ApiErr`/`TrackedConfig` shapes; `POST /api/configs/track` is the integration point for both manual add and the future DISC-03 folder-scan (whatever discovers a path, it must still flow through `track()`'s validation).
- Phase 5's version-history revert must re-enter through `PUT /api/configs/:id` -> `saveWithSnapshot`, exactly as documented in the API contract's extension-points section — no direct-write shortcut exists to bypass.
- No blockers. `packages/server/src/` now has a fully composed, guard-complete `buildApp()` with health + the four config routes; Plan 06 is unblocked to build the CLI bootstrap on top of this exact foundation.

---
*Phase: 02-local-loopback-server-cli-security-hardening*
*Completed: 2026-07-13*

## Self-Check: PASSED

- FOUND: packages/server/src/api-types.ts
- FOUND: packages/server/src/registry.ts
- FOUND: packages/server/src/schema.ts
- FOUND: packages/server/src/routes/configs.ts
- FOUND: test/server/api-routes.test.ts
- FOUND: .planning/phases/02-local-loopback-server-cli-security-hardening/02-API-CONTRACT.md
- FOUND: .planning/phases/02-local-loopback-server-cli-security-hardening/02-05-SUMMARY.md
- FOUND commit: 2551e3d
- FOUND commit: 68662be
- FOUND commit: 96cca9c
