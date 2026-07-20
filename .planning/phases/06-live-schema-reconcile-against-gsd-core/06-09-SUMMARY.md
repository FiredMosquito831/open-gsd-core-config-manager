---
phase: 06-live-schema-reconcile-against-gsd-core
plan: 09
subsystem: schema-refresh-verification
tags: [vitest, npm-pack, schema-refresh, security, accessibility]
requires:
  - phase: 06-08
    provides: fixture-backed schema workspace and lifecycle UI
provides:
  - Opt-in, non-activating latest-stable compatibility coverage
  - Extracted-tarball proof for bundled schema and identity metadata
  - Explicit held-out UI approval record for the schema workspace
affects: [schema-refresh, npm-distribution, schema-workspace]
tech-stack:
  added: []
  patterns: [opt-in-live-check, extracted-package-smoke, inert-refresh-verification]
key-files:
  created:
    - test/server/schema-refresh-live.test.ts
  modified:
    - test/packaging/tarball-contents.test.ts
    - package.json
    - package-lock.json
key-decisions:
  - "Live latest-stable compatibility remains explicitly opt-in through GSD_LIVE_SCHEMA_COMPAT=1 and has no activation path."
  - "TypeScript is a runtime dependency because the shipped constrained AST parser imports it during helper startup."
requirements-completed: [SCHEMA-05]
coverage:
  - id: D1
    description: "Current latest-stable gsd-core is parsed and compiled only through an opt-in inert compatibility check."
    requirement: SCHEMA-05
    verification:
      - kind: integration
        ref: "GSD_LIVE_SCHEMA_COMPAT=1 npx vitest run test/server/schema-refresh-live.test.ts --pool=vmThreads --maxWorkers=1 --no-file-parallelism --hookTimeout=60000 --testTimeout=60000"
        status: pass
    human_judgment: false
  - id: D2
    description: "The extracted npm package serves the bundled schema and safe source identity without source-tree lookup."
    requirement: SCHEMA-05
    verification:
      - kind: integration
        ref: "npx vitest run test/packaging/tarball-contents.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism"
        status: pass
    human_judgment: false
  - id: D3
    description: "Schema workspace desktop, many-key, compact-width, keyboard, lifecycle, theme, and reduced-motion backstops are approved."
    requirement: SCHEMA-05
    verification:
      - kind: manual_procedural
        ref: "Task 2 held-out UI gate explicit user approval"
        status: pass
    human_judgment: true
    rationale: "Visual hierarchy, wrapping, touch targets, focus behavior, and theme fidelity require reviewer judgment."
metrics:
  duration: "~3h 35m"
  completed_date: "2026-07-21"
status: complete
---

# Phase 06 Plan 09: Live Compatibility and Release Verification Summary

An inert latest-stable compatibility check, extracted npm-package smoke coverage, and explicit held-out UI approval close the schema-refresh verification boundary without activating live content or touching tracked configurations.

## Performance

- **Started:** 2026-07-20T20:44:11Z
- **Completed:** 2026-07-21T00:15:00Z
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- Added `GSD_LIVE_SCHEMA_COMPAT=1`-guarded coverage that resolves the fixed latest-stable release, validates its immutable identity, parses/reconciles/compiles only inert data, and proves it cannot activate a schema.
- Extended the existing extracted-tarball smoke test to exercise `/api/schema` and `/api/schema/status` from outside the source tree, proving bundled canonical fallback and client-safe identity metadata survive publication.
- Corrected the published package runtime contract by moving TypeScript to dependencies; the production inert AST parser imports it at helper startup.
- Recorded explicit user approval of the deterministic fixture-backed desktop, many-key, 320px, keyboard, lifecycle, theme, and reduced-motion backstops. Per instruction, no further browser/MCP work was performed.

## Task Commits

1. **Task 1: Add non-activating live compatibility and assembled transaction gates** — `a65f892` (test)
2. **Task 2: Verify the approved workspace and three visual backstops** — explicit user approval; no code commit required.

## Verification

- PASS — ordinary live-test invocation skips its network body by default.
- PASS — `GSD_LIVE_SCHEMA_COMPAT=1 npx vitest run test/server/schema-refresh-live.test.ts --pool=vmThreads --maxWorkers=1 --no-file-parallelism --hookTimeout=60000 --testTimeout=60000`.
- PASS — focused schema route/workspace/live run: 15 passed, 1 intentional opt-in skip.
- PASS — `npm run build && npm pack --dry-run && npx vitest run test/packaging/tarball-contents.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism` (5 tests).
- PASS — `npm run typecheck` completed after the focused schema test run.
- PARTIAL — the unmodified broad `npm test` command completed its ordinary suite with 357 passed and 1 opt-in skip, including pre-existing static-source-evidence warnings, then its integration subprocess did not finish before the 10-minute execution timeout. The required extracted-tarball integration command was independently rerun and passed.
- APPROVED — user explicitly approved the held-out fixture-backed UI gate and directed the executor to stop Chrome DevTools testing.

## Files Created/Modified

- `test/server/schema-refresh-live.test.ts` — opt-in current-latest-stable compatibility check with no manager, persistence, or activation behavior.
- `test/packaging/tarball-contents.test.ts` — platform-safe dependency resolution and external package assertions for bundled schema/status identity.
- `package.json` — declares TypeScript as the runtime dependency required by the deployed AST parser.
- `package-lock.json` — records the runtime dependency classification.

## Decisions Made

- Latest-stable network compatibility is intentionally separated from ordinary suites and only runs when `GSD_LIVE_SCHEMA_COMPAT=1` is supplied.
- Release smoke must start the actual packed CLI outside the repository, because in-repository tests cannot prove it avoids source-tree fallback imports.
- The parser's runtime TypeScript import is treated as a package correctness requirement rather than relying on developer-only dependencies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed extracted-package runtime dependency classification**
- **Found during:** Task 1 packaging smoke.
- **Issue:** The packed CLI failed before launch because `capability-registry-parser.ts` imports TypeScript at runtime, but `typescript` was listed only in `devDependencies`.
- **Fix:** Moved pinned `typescript@5.9.3` to `dependencies` and refreshed the lockfile.
- **Files modified:** `package.json`, `package-lock.json`.
- **Verification:** Extracted-tarball CLI smoke passed after rebuild.
- **Committed in:** `a65f892`.

**2. [Rule 1 - Bug] Made extracted-package dependency linking portable to the worktree environment**
- **Found during:** Task 1 packaging smoke.
- **Issue:** The existing test assumed `node_modules` lived directly under every worktree and used a Windows junction type on POSIX, causing clean extracted startup to fail before it could test the package.
- **Fix:** Derived the installed dependency root through `@fastify/static` resolution and use a POSIX directory link outside Windows.
- **Files modified:** `test/packaging/tarball-contents.test.ts`.
- **Verification:** Required extracted-tarball smoke passed.
- **Committed in:** `a65f892`.

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs).
**Impact on plan:** Both corrections were required to make the planned published-package proof executable; neither expands live refresh capability or changes tracked configuration data.

## Known Stubs

None.

## Threat Flags

None. The live test remains opt-in and uses only fixed production endpoints; it neither activates nor persists a proposal. Package assertions expose only existing client-safe schema/status envelopes.

## Issues Encountered

- The broad `npm test` process exceeded the WSL execution timeout after the ordinary suite passed and integration began. Its mandatory extracted-package gate was subsequently run directly and passed.
- The broad ordinary suite prints pre-existing static-source-evidence warnings in this worktree, but completed with 357 passing tests and one intended live-test skip.

## Next Phase Readiness

- SCHEMA-05 has deterministic package and lifecycle coverage plus explicit human UI approval.
- The flagged spec-less edge probe remains unclassified/unresolved; this plan closes the concrete Phase 06 CONTEXT/RESEARCH/VALIDATION/UI-SPEC contract and does not claim the broader probe was resolved.

## Self-Check: PASSED

- Confirmed `test/server/schema-refresh-live.test.ts` and `test/packaging/tarball-contents.test.ts` exist.
- Confirmed task commit `a65f892` exists in git history.
- Confirmed the explicit user approval is recorded above.
