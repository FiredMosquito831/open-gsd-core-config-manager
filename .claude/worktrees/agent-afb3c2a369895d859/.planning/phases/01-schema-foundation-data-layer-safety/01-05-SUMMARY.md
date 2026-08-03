---
phase: 01-schema-foundation-data-layer-safety
plan: 05
subsystem: infra
tags: [typescript, vitest, config-io, load, discovery, merge, schema, provenance, unknown-keys]

# Dependency graph
requires:
  - phase: 01-02
    provides: "packages/schema-data/bundled-schema.json — the flat dot-path-keyed canonical schema artifact (158 keys) with exact keys + patternProperties for dynamic-map containers"
  - phase: 01-04
    provides: "discovery.ts (resolveGlobalDefaultsPath/readGlobalDefaults) and merge.ts (getAtPath/resolveLeaf/buildEffectiveTree) — the composable building blocks load() assembles"
provides:
  - "packages/config-io/src/known-keys.ts — buildKnownKeySet(schema), isKnownKey(dotPath, knownSet), canonicalDefaultsFromSchema(schema)"
  - "packages/config-io/src/load.ts — load(projectConfigPath, opts?): Promise<LoadResult>, the single Phase 2 server entry point for reading a config"
  - "test/fixtures/fake-home/.gsd/defaults.json — hermetic fake-$HOME fixture for DISC-06 discovery tests"
affects: [01-06, 01-07, phase-2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "known-keys.ts stays pure (schema object in, classification/defaults out) — no file I/O, matching discovery.ts/merge.ts's Plan 04 pattern; load.ts alone does file reads"
    - "Unknown-key walk descends into a container only if it has known prefixes matching the schema, and captures a genuinely-foreign subtree as ONE unknown entry with its full nested value rather than exploding it into synthetic per-leaf entries"
    - "Canonical-layer completeness fallback: any known schema key with no declared default is filled with a null sentinel in load()'s local canonical object before merge.ts's resolveLeaf runs, so a frozen 'throw when no layer supplies a value' contract never fires against realistic real-world fixtures"

key-files:
  created:
    - packages/config-io/src/known-keys.ts
    - packages/config-io/src/load.ts
    - test/config-io/load.test.ts
    - test/fixtures/fake-home/.gsd/defaults.json
  modified: []

key-decisions:
  - "canonicalDefaultsFromSchema(schema) only maps schema keys that declare an explicit `default` (per the plan's literal Task 1 contract) — it does NOT synthesize fallback values itself. The fallback-filling for keys with no declared default lives entirely in load.ts (fillMissingCanonicalDefaults), keeping Task 1's function pure/predictable while load() remains crash-safe."
  - "Unknown-key detection stops descending at the first node whose own dot-path has no known schema descendants at all (bare foreign namespace) and records ONE unknown entry carrying the whole subtree value, rather than flattening every leaf unconditionally — matches the plan's literal expected test path (`x_gsdcm_test_future_key`, not `x_gsdcm_test_future_key.nested`) and avoids exploding an unrecognized future namespace into many synthetic sub-paths."
  - "Created test/fixtures/fake-home/.gsd/defaults.json (a copy of the existing global-defaults.json fixture under a self-contained fake-home directory) so the DISC-06 found=true path can be tested end-to-end through load()+discovery.ts without ever touching the real machine's ~/.gsd — mirrors the injectable-env hermetic-testing pattern discovery.test.ts already established in Plan 04."

patterns-established: []

requirements-completed: [DISC-06, SAVE-03]

coverage:
  - id: D1
    description: "known-keys.ts classifies exact schema keys, dynamic-pattern keys (model_overrides.<agent>), and fixture-observed keys (gates.confirm_plan) as known, and fabricated future keys (top-level and nested) as unknown, against the real bundled-schema.json"
    requirement: "SAVE-03"
    verification:
      - kind: unit
        ref: "test/config-io/load.test.ts#buildKnownKeySet / isKnownKey (real bundled-schema.json)"
        status: pass
    human_judgment: false
  - id: D2
    description: "canonicalDefaultsFromSchema produces a nested canonical-layer object matching the schema's declared defaults, omitting keys with no default"
    requirement: "SAVE-03"
    verification:
      - kind: unit
        ref: "test/config-io/load.test.ts#canonicalDefaultsFromSchema (real bundled-schema.json)"
        status: pass
    human_judgment: false
  - id: D3
    description: "load() returns the original unmutated raw.project object across repeated loads"
    requirement: "SAVE-03"
    verification:
      - kind: unit
        ref: "test/config-io/load.test.ts#load() (DISC-06, SAVE-03) — raw.project deep-equal + unmutated across loads"
        status: pass
    human_judgment: false
  - id: D4
    description: "load() resolves and reads the global defaults layer via discovery.ts, setting meta.globalDefaultsFound/globalDefaultsPath correctly for both found and absent cases (DISC-06)"
    requirement: "DISC-06"
    verification:
      - kind: unit
        ref: "test/config-io/load.test.ts#load() (DISC-06, SAVE-03) — meta.globalDefaultsFound found/absent"
        status: pass
    human_judgment: false
  - id: D5
    description: "load() on the fabricated-unknown fixture surfaces x_gsdcm_test_future_key and workflow.x_test_unknown_toggle in unknown[]; gates.*/safety.* resolve as known and never leak into unknown[] for a real fixture"
    requirement: "SAVE-03"
    verification:
      - kind: unit
        ref: "test/config-io/load.test.ts#load() (DISC-06, SAVE-03) — fabricated-unknown fixture + gates/safety-known assertions"
        status: pass
    human_judgment: false
  - id: D6
    description: "load()'s effective tree carries per-leaf provenance (project/global/canonical) correctly, e.g. workflow.tdd_mode resolves from the project layer"
    requirement: "DISC-06"
    verification:
      - kind: unit
        ref: "test/config-io/load.test.ts#load() (DISC-06, SAVE-03) — effective tree provenance"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-07-12
status: complete
---

# Phase 1 Plan 5: load() — Layered Config Read with Provenance and Unknown-Key Bucket Summary

**`load(projectConfigPath)` composing Plan 02's bundled schema and Plan 04's discovery/merge into the frozen `LoadResult`: unmutated raw project object, DISC-06 global-defaults layer, provenance-tagged effective tree, and a flat SAVE-03 unknown-key bucket that surfaces fabricated future keys without exploding foreign subtrees into synthetic leaves.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-12T14:12:34+03:00
- **Completed:** 2026-07-12T14:21:55+03:00
- **Tasks:** 2 completed
- **Files modified:** 4 created (known-keys.ts, load.ts, load.test.ts, fake-home/.gsd/defaults.json)

## Accomplishments
- `known-keys.ts`: `buildKnownKeySet(schema)` compiles the bundled schema's 158 exact dot-path keys, every dynamic-map `patternProperties` regex (reused verbatim, never re-authored), and every proper dot-path prefix of each exact key (so intermediate namespaces like `workflow` — never themselves an exact schema key, only their children are — are recognized as "has known descendants" during the unknown-key walk). `isKnownKey` and `canonicalDefaultsFromSchema` complete the pure classification/defaults API Task 2 composes.
- `load.ts`: reads the project config's ORIGINAL parsed object (never cloned/normalized), resolves + reads the global defaults layer via Plan 04's `discovery.ts` (DISC-06), builds the provenance-tagged effective tree via Plan 04's `buildEffectiveTree`, and produces the flat `unknown[]` bucket by recursively walking both raw layers against the known-key set — merging `presentIn` across project/global for the same path. Genuinely-unrecognized fabricated keys (`x_gsdcm_test_future_key`, `workflow.x_test_unknown_toggle`) surface individually; `gates.*`/`safety.*` resolve as known (fixture-observed) and never leak into `unknown[]`.
- Extended `test/config-io/load.test.ts` (created in Task 1, extended in Task 2) with 15 tests total, all run against the real `bundled-schema.json` and real project/global fixtures — no mock schema data.

## Task Commits

Each task was committed atomically:

1. **Task 1: Known-key classifier + canonical defaults from the bundled schema** - `e5a1799` (test)
2. **Task 2: load() — raw + merge + provenance + unknown bucket (DISC-06, SAVE-03)** - `28960df` (feat)

**Plan metadata:** (final docs commit follows this summary)

## Files Created/Modified
- `packages/config-io/src/known-keys.ts` - `buildKnownKeySet`, `isKnownKey`, `canonicalDefaultsFromSchema` — pure, schema-object-in classification/defaults API
- `packages/config-io/src/load.ts` - `load(projectConfigPath, opts?)`, the frozen `LoadResult`-producing entry point; also `fillMissingCanonicalDefaults` (private) and the recursive `collectUnknownPaths` unknown-key walker
- `test/config-io/load.test.ts` - 15 tests: 6 known-key-classification cases, 2 canonical-defaults cases, 7 `load()` end-to-end cases (raw immutability, DISC-06 found/absent, fabricated-unknown-fixture unknown[] assertions, gates/safety-known, effective-tree provenance)
- `test/fixtures/fake-home/.gsd/defaults.json` - hermetic fake-$HOME fixture (copy of `global-defaults.json`) so DISC-06 discovery tests never touch the real machine's `~/.gsd`

## Decisions Made
- `canonicalDefaultsFromSchema` stays literal to its Task 1 contract (maps only keys with a declared `default`); the completeness fallback for keys lacking a default lives entirely in `load.ts`, keeping Task 1's function predictable and independently testable.
- The unknown-key walk stops descending at the first node with zero known schema descendants and records ONE unknown entry carrying the whole subtree's value — this matches the plan's literal expected test path (`x_gsdcm_test_future_key`, not a decomposed `x_gsdcm_test_future_key.nested`) and is the more useful representation for a genuinely-foreign future namespace (patch-in-place doesn't need it pre-decomposed).
- Added a self-contained `test/fixtures/fake-home/.gsd/` fixture directory rather than pointing tests at the real machine's `~/.gsd` — hermetic, matches the injectable-`env` pattern `discovery.test.ts` already established in Plan 04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added a canonical-layer completeness fallback in load.ts**
- **Found during:** Task 2 (writing `load()`'s effective-tree assembly and running it against the real project/global fixtures)
- **Issue:** 25 of the 158 `bundled-schema.json` keys declare no `default` (mostly dynamic-map containers and rarely-set optional overrides like `review.llama_cpp_host`, `manager.flags.*`, `workflow.worktree_skip_hooks`). Cross-checking against all three real fixtures showed at least 14 of those 25 keys are absent from EVERY layer (project fixture + both global-defaults fixtures) as well. Plan 04's `merge.ts#resolveLeaf` (a frozen, intentional contract — "throws a descriptive error when no layer supplies the path... signals a schema-default gap upstream") would throw for any of these 14+ keys the instant `load()` tried to build the full 158-key effective tree against a real fixture — meaning `load()` would crash on realistic real-world configs that simply never set an obscure optional key, not just on contrived test data.
- **Fix:** Added `fillMissingCanonicalDefaults(canonical, schema)` in `load.ts`: on a fresh deep copy of `canonicalDefaultsFromSchema`'s output, fills any known schema key not already present with a `null` sentinel, guaranteeing every one of the 158 known keys resolves to project > global > canonical without ever hitting `resolveLeaf`'s throw path. `canonicalDefaultsFromSchema`'s own contract (Task 1: maps only keys that declare a schema `default`) is unchanged — the fallback is a load.ts-local augmentation, not a change to Task 1's function.
- **Files modified:** `packages/config-io/src/load.ts`
- **Verification:** `npx vitest run test/config-io/load.test.ts` — all 15 tests pass, including the full-effective-tree assertions against the real `project-config.json` fixture (which is missing several of the 14 always-absent keys). `npx tsc --noEmit` clean.
- **Committed in:** `28960df` (Task 2 commit, documented inline in the commit message)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical functionality)
**Impact on plan:** Directly required for `load()` to function against realistic configs rather than only contrived complete-coverage test data; no scope creep — the fix is entirely internal to `load.ts` and does not alter any frozen Plan 01/04 contract's observable behavior for the paths those contracts do cover.

## Issues Encountered
None beyond the canonical-defaults gap documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `load(projectConfigPath, opts?)` is the single Phase 2 (loopback server) entry point for reading a config, ready to be called with no further wiring: it composes Plan 02's bundled schema, Plan 04's discovery.ts/merge.ts, and this plan's known-keys.ts internally.
- `npx vitest run` (full suite, 47 tests) and `npx tsc --noEmit` both exit clean.
- The `unknown[]` bucket's detection is stable and complete against real fixtures — ready for Plan 07's round-trip-identity gate to diff before/after a no-op save.
- No blockers for Plan 06 (atomic-write save path, `depends_on: [01-01, 01-05]` per the phase's wave structure) or Plan 07 (round-trip-identity tests).

---
*Phase: 01-schema-foundation-data-layer-safety*
*Completed: 2026-07-12*

## Self-Check: PASSED

All 4 created source/test/fixture files verified present on disk. Both commit hashes (e5a1799, 28960df) verified present in git log.
