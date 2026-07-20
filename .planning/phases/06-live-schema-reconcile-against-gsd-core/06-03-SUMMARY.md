---
phase: 06-live-schema-reconcile-against-gsd-core
plan: 03
subsystem: server-schema-authority
tags: [typescript, ajv, atomic-write, schema-persistence, recovery]
requires:
  - phase: 06-live-schema-reconcile-against-gsd-core
    provides: bundled schema identity metadata and reconciled canonical descriptors
provides:
  - Immutable compiled active-schema snapshots with durable activation and reset
  - Versioned one-envelope app-data override persistence with safe bundled recovery
  - Bundle-safe metadata baseline accessors for schema lifecycle consumers
affects: [06-06, schema-routes, config-validation, schema-workspace]
tech-stack:
  added: []
  patterns: [compile-before-persist, persist-before-reference-swap, one-envelope-override, safe-startup-fallback]
key-files:
  created:
    - packages/server/src/active-schema-manager.ts
    - packages/server/src/schema-persistence.ts
    - test/server/active-schema-manager.test.ts
  modified:
    - packages/server/src/schema.ts
    - vitest.config.ts
key-decisions:
  - "An active schema generation is one immutable snapshot containing descriptors, validator, provenance, and client-safe status."
  - "Equal semantic versions with mismatched immutable identity fail closed to the bundled baseline."
  - "Override persistence must succeed before the single active snapshot reference is replaced; reset reverses that ordering."
patterns-established:
  - "Persisted schema override data is one versioned JSON envelope, compiled again during startup before use."
  - "Fallback warnings are static and path-free for clients, while injected warning sinks can receive raw diagnostics."
requirements-completed: [SCHEMA-05]
coverage:
  - id: D1
    description: Active schema manager compiles and exposes one immutable bundled or refreshed generation.
    requirement: SCHEMA-05
    verification:
      - kind: integration
        ref: test/server/active-schema-manager.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Activation, startup recovery, precedence, conflict fallback, and reset preserve safe durable ordering.
    requirement: SCHEMA-05
    verification:
      - kind: integration
        ref: test/server/active-schema-manager.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Existing schema API continues to return the bundled inlined artifact.
    requirement: SCHEMA-05
    verification:
      - kind: integration
        ref: test/server/schema-route.test.ts
        status: pass
    human_judgment: false
duration: 20 min
completed: 2026-07-20
status: complete
---

# Phase 06 Plan 03: Active Schema Authority Summary

**A compiled, immutable active-schema manager now atomically persists refreshed schema generations, safely selects them by stable provenance, and always recovers to the inlined bundled baseline.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-20T15:50:00Z
- **Completed:** 2026-07-20T16:10:46Z
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- Added a one-envelope `SchemaOverrideStore` that keeps schema, provenance, activation time, and envelope version together under app data using the established atomic-write retry convention.
- Added `ActiveSchemaManager`, whose single frozen snapshot keeps descriptors, compiled Ajv validator, provenance, and client-safe status generation-consistent through activation, startup, and reset.
- Enforced compile-before-persist and persist/delete-before-swap ordering, stable semantic-version precedence, fail-closed same-version identity conflicts, and path-free persistent fallback warnings.
- Retained `schema.ts` as a bundle-safe baseline compatibility facade and exposed shipped provenance without runtime source-tree reads.

## Task Commits

1. **Task 1: Freeze active-snapshot persistence and recovery behavior** — `6df1130` (test)
2. **Task 2: Implement the one-envelope manager and bundle-safe baseline** — `4942cf2` (feat)
3. **Verification reliability correction** — `3934ca8` (fix)

## Files Created/Modified

- `packages/server/src/schema-persistence.ts` — versioned, one-file app-data override persistence with injected I/O seams.
- `packages/server/src/active-schema-manager.ts` — compiled active snapshot lifecycle, precedence, recovery, activation, and reset authority.
- `packages/server/src/schema.ts` — bundle-safe baseline schema/provenance accessors and compatibility validator.
- `test/server/active-schema-manager.test.ts` — lifecycle and ordering contract coverage for D-10 through D-14.
- `vitest.config.ts` — 60-second hook/test ceilings needed for slow WSL cold imports.

## Verification

- PASS — `npx vitest run test/server/active-schema-manager.test.ts test/server/schema-route.test.ts --reporter=dot` (13 tests)
- PASS — `npx tsc --noEmit`
- BLOCKED OUTSIDE TASK SCOPE — `npm run typecheck` reaches the pre-existing web-program error in `test/web/phase4-catalog-evidence.test.ts`, where Node built-ins are absent from `tsconfig.web.json` types. The server/project TypeScript program for this plan passes.

## Decisions Made

- A same-semver override with different immutable commit/archive provenance never wins selection, avoiding ambiguity in a purportedly equal release.
- Invalid persisted envelopes are ignored rather than blocking startup; users receive a static warning while a server warning sink can retain diagnostics.
- Baseline schema and metadata stay JSON-module imports so extracted npm packages retain no source-tree dependency.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Raised Vitest lifecycle timeouts for slow WSL cold imports**
- **Found during:** Task 2 verification
- **Issue:** `schema-route.test.ts` setup exceeded Vitest's default 10-second hook timeout before application construction completed, despite passing behavior once started.
- **Fix:** Set 60-second hook and test timeouts in the shared Vitest configuration, matching the phase's known WSL execution constraint.
- **Files modified:** `vitest.config.ts`
- **Verification:** Focused manager and schema-route suite passed.
- **Committed in:** `3934ca8`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Reliability-only test runner correction; runtime product scope unchanged.

## Issues Encountered

- Vitest 4.1.10 does not recognize the plan's literal `-x` option; the equivalent focused commands were run without it.
- The web TypeScript subproject has a pre-existing Node type configuration failure outside this plan. The authoritative server/project typecheck passed with `npx tsc --noEmit`.

## Known Stubs

None.

## Next Phase Readiness

- Future route, refresh-service, config-save, and restore integrations can consume `ActiveSchemaManager.snapshot()` to receive one validator/schema generation.
- The active manager is intentionally standalone until the later Phase 6 integration plan injects it into all authoritative consumers.

## Self-Check: PASSED

- Confirmed active manager, persistence store, baseline facade, and lifecycle tests exist.
- Confirmed task commits `6df1130`, `4942cf2`, and `3934ca8` exist in git history.

---
*Phase: 06-live-schema-reconcile-against-gsd-core*
*Completed: 2026-07-20*
