---
phase: 06-live-schema-reconcile-against-gsd-core
plan: 02
subsystem: schema-data
tags: [typescript, schema-reconciliation, semantic-diff, trusted-local]
requires:
  - phase: 01-schema-foundation-data-layer-safety
    provides: bundled canonical descriptors and curated schema data
provides:
  - Pure, deterministic canonical schema reconciliation and semantic-diff contracts
  - Stable bundled gsd-core identity metadata and isolated trusted-local builder adapter
affects: [06-03, 06-06, schema-refresh, server-schema-manager]
tech-stack:
  added: []
  patterns: [pure parsed-data reconciler, curation-last overlay precedence, semantic projections for review evidence]
key-files:
  created:
    - packages/schema-data/src/source-types.ts
    - packages/schema-data/src/reconcile.ts
    - packages/schema-data/bundled-schema-meta.json
    - test/schema-data/reconcile.test.ts
  modified:
    - packages/schema-data/scripts/build-schema.ts
key-decisions:
  - "The reconciler consumes parsed inert data only; the sole createRequire call remains in the maintainer adapter."
  - "Removed upstream keys are retained as source-evidenced deprecated descriptors, while curated prose and specialized metadata remain authoritative."
  - "Bundled identity records the researched stable v1.7.0 tag and commit without inventing an unavailable archive digest."
patterns-established:
  - "Semantic diff compares normalized structural projections rather than descriptor serialization."
  - "Curation and specialized editor metadata overlay structural extraction last."
requirements-completed: [SCHEMA-05]
coverage:
  - id: D1
    description: Pure deterministic reconciliation preserves curation, excludes runtime state, retains removed keys as deprecated, and rejects unsafe paths.
    requirement: SCHEMA-05
    verification:
      - kind: unit
        ref: test/schema-data/reconcile.test.ts
        status: pass
      - kind: other
        ref: npx tsc --noEmit
        status: pass
    human_judgment: false
  - id: D2
    description: Semantic schema change evidence is order-insensitive and distinguishes structural change from upstream documentation drift.
    requirement: SCHEMA-05
    verification:
      - kind: unit
        ref: test/schema-data/reconcile.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: The trusted-local builder adapter validates bundled identity metadata and delegates descriptor construction to the pure reconciler.
    requirement: SCHEMA-05
    verification:
      - kind: unit
        ref: test/schema-data/reconcile.test.ts
        status: pass
      - kind: unit
        ref: test/schema-data/completeness.test.ts
        status: pass
    human_judgment: false
duration: 24 min
completed: 2026-07-20
status: complete
---

# Phase 06 Plan 02: Reconciliation Core Summary

**Pure parsed-data reconciliation now produces deterministic canonical descriptors, preserves curated guidance, and emits review-ready semantic change evidence without executing remote inputs.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-07-20T14:48:58Z
- **Completed:** 2026-07-20T15:13:03Z
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- Defined typed source identity, descriptor lifecycle, and change-set contracts for inert schema proposals.
- Extracted deterministic structural reconciliation with runtime-state exclusion, curation/specialization precedence, source-evidenced deprecation retention, and prototype-safe paths.
- Added normalized semantic-diff evidence that ignores key/enum ordering while flagging structural and documentation-fingerprint changes independently.
- Refactored the maintainer builder into a trusted-local adapter and added stable v1.7.0 bundled provenance metadata.

## Task Commits

1. **Task 1: Freeze reconciliation and semantic-diff behavior** — `d7705fc` (test), `e3acda9` (feat)
2. **Task 2: Adapt the trusted-local builder and record bundled identity** — `293afc1` (feat)

## Files Created/Modified

- `packages/schema-data/src/source-types.ts` — parsed-source, descriptor lifecycle, provenance, and proposal change contracts.
- `packages/schema-data/src/reconcile.ts` — pure deterministic reconciliation, projections, diffing, and metadata validation.
- `packages/schema-data/scripts/build-schema.ts` — isolated trusted-local adapter delegating to the pure reconciler.
- `packages/schema-data/bundled-schema-meta.json` — checked-in stable baseline identity metadata.
- `test/schema-data/reconcile.test.ts` — curation, deprecation, semantic-noise, documentation drift, unsafe-path, and metadata fixtures.

## Verification

- PASS — `npx vitest run test/schema-data/reconcile.test.ts test/schema-data/completeness.test.ts` (15 tests)
- PASS — `npx tsc --noEmit`
- PASS — static import audit confirms `reconcile.ts` contains no `node:fs`, `node:module`, `createRequire`, or `require`; the local adapter contains the sole capability registry load.
- NOTE — The plan's literal `-x` Vitest flag is unsupported by Vitest 4.1.10; equivalent focused test commands were run without it.
- NOTE — `npm run typecheck` is pre-existingly blocked in `tsconfig.web.json` by `test/web/phase4-catalog-evidence.test.ts` lacking Node types. The repository TypeScript program (`npx tsc --noEmit`) passed for this plan's implementation.

## Decisions Made

- Kept reconciliation source-independent and free of filesystem/module-loading imports so future remote refreshes can only supply parsed inert data.
- Used stable semantic projections for diff evidence, deliberately excluding curated prose and specialized metadata from structural comparisons.
- Stored only provenance verified by Phase 6 research: v1.7.0, tag, commit, and generation timestamp; archive digest remains absent rather than fabricated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced an unsupported Array helper in dynamic container parsing**
- **Found during:** Task 1
- **Issue:** `Array.prototype.takeWhile` is not a JavaScript runtime API, causing reconciliation tests to fail.
- **Fix:** Replaced it with a bounded explicit loop that stops at the first nonliteral regex segment.
- **Files modified:** `packages/schema-data/src/reconcile.ts`
- **Verification:** Focused reconciliation suite passed.
- **Committed in:** `e3acda9`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary correctness repair; no scope expansion.

## Issues Encountered

- The planned `-x` option is not recognized by installed Vitest 4.1.10, so focused tests were executed without it.
- The full web TypeScript program has a pre-existing Node type configuration failure outside this task's files; the server/schema TypeScript program passed.

## Known Stubs

None.

## Next Phase Readiness

- Plans 06-03 and 06-06 can consume the typed canonical schema metadata and pure reconciler without gaining access to trusted-local loading.
- The bundle identity is ready for active-schema precedence and same-version immutable-provenance checks.

## Self-Check: PASSED

- Confirmed source contracts, reconciler, bundled metadata, and tests exist.
- Confirmed task commits `d7705fc`, `e3acda9`, and `293afc1` exist in git history.

---
*Phase: 06-live-schema-reconcile-against-gsd-core*
*Completed: 2026-07-20*
