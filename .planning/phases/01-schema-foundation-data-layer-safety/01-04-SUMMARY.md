---
phase: 01-schema-foundation-data-layer-safety
plan: 04
subsystem: infra
tags: [typescript, vitest, config-io, discovery, merge, provenance]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Frozen EffectiveLeaf/EffectiveNode/Provenance/LoadResult data contracts in packages/config-io/src/types.ts"
provides:
  - "resolveGlobalDefaultsPath(env?) — GSD_HOME || os.homedir() + .gsd/defaults.json, matching gsd-core's own config-loader.cjs algorithm exactly (DISC-06)"
  - "readGlobalDefaults(absPath) — safe, never-throws-on-ENOENT read+parse of the global defaults file"
  - "getAtPath(obj, dotPath) — pure dot-path walker used by resolveLeaf"
  - "resolveLeaf(path, layers) — project>global>canonical provenance-tagged single-key resolution (SAVE-03 provenance / criterion #5)"
  - "buildEffectiveTree(knownKeyPaths, layers) — assembles a nested EffectiveNode tree from a flat list of known key-paths"
affects: [01-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "discovery.ts and merge.ts remain pure/schema-agnostic — no import of bundled schema data, consumed by Plan 05's load() as composable building blocks"
    - "Injectable env param (resolveGlobalDefaultsPath(env = process.env)) so tests never mutate real process.env or touch the real ~/.gsd"

key-files:
  created:
    - packages/config-io/src/discovery.ts
    - packages/config-io/src/merge.ts
    - test/config-io/discovery.test.ts
    - test/config-io/merge.test.ts
  modified: []

key-decisions:
  - "readGlobalDefaults is synchronous (fs.readFileSync), matching the existing synchronous style of validate.ts/patch.ts in this package; Plan 05's load() can wrap it in an async boundary if needed without changing this module's contract."
  - "Non-ENOENT read errors are rethrown as-is (unmodified) per the plan's explicit 'catch only ENOENT; rethrow other errors' instruction; only the JSON.parse failure path is wrapped with a path-only message, since JSON.parse errors could in principle differ in verbosity across Node versions and the plan's Information-Disclosure mitigation (T-01-InfoDisc-D) requires the message to never carry file body content."

patterns-established: []

requirements-completed: [DISC-06, SAVE-03]

coverage:
  - id: D1
    description: "resolveGlobalDefaultsPath() replicates gsd-core's own GSD_HOME || os.homedir() + .gsd/defaults.json algorithm exactly, with an injectable env for testing"
    requirement: "DISC-06"
    verification:
      - kind: unit
        ref: "test/config-io/discovery.test.ts#resolveGlobalDefaultsPath"
        status: pass
    human_judgment: false
  - id: D2
    description: "readGlobalDefaults() reads/parses an existing global-defaults file and never throws on an absent file"
    requirement: "DISC-06"
    verification:
      - kind: unit
        ref: "test/config-io/discovery.test.ts#readGlobalDefaults"
        status: pass
    human_judgment: false
  - id: D3
    description: "resolveLeaf() resolves a key to the highest-priority layer that defines it (project>global>canonical) and tags provenance with the supplying layer, throwing when no layer supplies a value"
    requirement: "SAVE-03"
    verification:
      - kind: unit
        ref: "test/config-io/merge.test.ts#resolveLeaf"
        status: pass
    human_judgment: false
  - id: D4
    description: "buildEffectiveTree() assembles a nested EffectiveNode tree with correctly-tagged leaves from a flat list of known key-paths; merge.ts imports no bundled schema"
    requirement: "SAVE-03"
    verification:
      - kind: unit
        ref: "test/config-io/merge.test.ts#buildEffectiveTree"
        status: pass
      - kind: unit
        ref: "test/config-io/merge.test.ts#merge.ts purity"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-12
status: complete
---

# Phase 1 Plan 4: Global-Defaults Discovery & Layered Provenance Merge Summary

**Pure, schema-agnostic `discovery.ts` (GSD_HOME-aware global-defaults path resolution matching gsd-core's own algorithm) and `merge.ts` (project>global>canonical provenance-tagged effective-value resolution) — the two building blocks Plan 05's `load()` composes.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-12T14:08:00Z
- **Completed:** 2026-07-12T14:09:55Z
- **Tasks:** 2 completed (each as TDD RED→GREEN pairs)
- **Files modified:** 4 created (discovery.ts, merge.ts, discovery.test.ts, merge.test.ts)

## Accomplishments
- `discovery.ts`: `resolveGlobalDefaultsPath(env?)` replicates gsd-core's own `config-loader.cjs` algorithm (`process.env['GSD_HOME'] || os.homedir()` joined with `.gsd/defaults.json`) exactly, with an injectable `env` parameter so tests never touch real `process.env`/`~/.gsd`; `readGlobalDefaults(absPath)` reads and parses the file, returning `{ found: false, data: null }` on `ENOENT` without throwing, and never leaks file body content in any thrown error message.
- `merge.ts`: `getAtPath`, `resolveLeaf`, and `buildEffectiveTree` implement the project>global>canonical provenance-tagged merge exactly as specified in 01-RESEARCH.md § Code Examples: Layered Merge — `resolveLeaf` throws a descriptive error when no layer supplies a path (signaling a schema-default gap), and `buildEffectiveTree` assembles a flat list of known key-paths into the nested `EffectiveNode` tree shape frozen in Plan 01's `types.ts`.
- Both modules remain pure and schema-agnostic (no import of bundled schema data), verified by an explicit purity test on `merge.ts`, so Plan 05's `load()` can compose them with any `canonical` layer/`knownKeyPaths` source.

## Task Commits

Each task followed the TDD RED→GREEN protocol (tdd="true"):

1. **Task 1: Global-defaults discovery — GSD_HOME || homedir (DISC-06)**
   - RED: `37b46b5` (test) — failing test asserting `resolveGlobalDefaultsPath`/`readGlobalDefaults` behavior before the module existed
   - GREEN: `75f77b9` (feat) — implementation, all 5 tests pass
2. **Task 2: Layered merge with provenance (canonical → global → project) (SAVE-03 provenance / criterion #5)**
   - RED: `14c6967` (test) — failing test asserting `getAtPath`/`resolveLeaf`/`buildEffectiveTree` behavior before the module existed
   - GREEN: `55e0162` (feat) — implementation, all 9 tests pass (includes a same-commit test-fixture fix — see Deviations)

**Plan metadata:** (final docs commit follows this summary)

## Files Created/Modified
- `packages/config-io/src/discovery.ts` - `resolveGlobalDefaultsPath(env?)`, `readGlobalDefaults(absPath)`
- `packages/config-io/src/merge.ts` - `getAtPath(obj, dotPath)`, `resolveLeaf(path, layers)`, `buildEffectiveTree(knownKeyPaths, layers)`, `MergeLayers` type
- `test/config-io/discovery.test.ts` - covers GSD_HOME override, homedir fallback, found/absent-file reads
- `test/config-io/merge.test.ts` - covers all three provenance outcomes, the no-layer error, tree assembly, and a purity check (no bundled-schema import)

## Decisions Made
- `readGlobalDefaults` uses synchronous `fs.readFileSync`, matching the existing synchronous style already established in this package's `validate.ts`/`patch.ts` (Plan 02/03) — Plan 05's `load()` can wrap this in whatever async boundary it needs without this module's own contract changing.
- Non-ENOENT read errors are rethrown unmodified (per the plan's explicit "catch only ENOENT; rethrow other errors" instruction); only the JSON.parse failure path is wrapped with a path-only error message, satisfying the T-01-InfoDisc-D mitigation (never leak file body content) without altering the semantics of genuine filesystem errors (permissions, etc.) that callers may need to inspect by `code`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect `buildEffectiveTree` multi-key test assertion**
- **Found during:** Task 2 GREEN verification
- **Issue:** The `buildEffectiveTree` test's `mode` key was placed only in the `global` and `canonical` layer fixtures, but the assertion expected `from: 'canonical', value: 'batch'` — since `mode` is actually present in the `global` layer too, correct project>global>canonical precedence resolves it to `from: 'global', value: 'interactive'`. This was a test-authoring bug, not an implementation bug (the implementation's precedence logic was correct).
- **Fix:** Corrected the assertion to expect `{ path: 'mode', value: 'interactive', from: 'global' }`, matching the fixture's actual layer contents.
- **Files modified:** test/config-io/merge.test.ts
- **Verification:** `npx vitest run test/config-io/merge.test.ts` — all 9 tests pass after the fix.
- **Committed in:** 55e0162 (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test-only fix; no change to implementation scope or the resolved contract. No scope creep.

## Issues Encountered
None beyond the test-fixture bug documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `discovery.ts` and `merge.ts` are both pure, schema-agnostic modules ready for Plan 05 (`load.ts`) to compose: `load()` will call `resolveGlobalDefaultsPath()` + `readGlobalDefaults()` for the global layer, then build `knownKeyPaths` from the bundled schema and call `buildEffectiveTree()` to produce `LoadResult.effective`.
- `npx vitest run test/config-io/discovery.test.ts test/config-io/merge.test.ts` and the full suite (`npx vitest run`) both exit 0; `npx tsc --noEmit` is clean.
- No blockers for Plan 05.

---
*Phase: 01-schema-foundation-data-layer-safety*
*Completed: 2026-07-12*
