---
phase: 01-schema-foundation-data-layer-safety
plan: 01
subsystem: infra
tags: [typescript, vitest, ajv, write-file-atomic, proper-lockfile, node, config-io]

# Dependency graph
requires: []
provides:
  - "Buildable Node/TypeScript project scaffold (package.json, tsconfig.json, vitest.config.ts, .gitignore)"
  - "Locked, exact-pinned dependency versions: ajv@8.20.0, ajv-formats@3.0.1, write-file-atomic@7.0.1, proper-lockfile@4.1.2"
  - "Frozen Phase 2/3 data contracts in packages/config-io/src/types.ts (Provenance, EffectiveLeaf, EffectiveNode, UnknownKeyEntry, LoadResult, ValidationResult, SchemaEntry)"
  - "Five test fixtures under test/fixtures/ for SAVE-03 round-trip and unknown-key-passthrough tests"
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, phase-2, phase-3]

# Tech tracking
tech-stack:
  added: [typescript@5.9.3, vitest@4.1.10, ajv@8.20.0, ajv-formats@3.0.1, write-file-atomic@7.0.1, proper-lockfile@4.1.2, tsx@4.23.0]
  patterns:
    - "Exact-pinned dependencies via --save-exact (no ^/~ ranges) for the four core packages"
    - "Types-only contract module (packages/config-io/src/types.ts) with no runtime code, importable by all downstream plans"
    - "Flat unknown[] bucket (not inline isKnown-tagged tree) for unrecognized config keys"

key-files:
  created:
    - package.json
    - tsconfig.json
    - vitest.config.ts
    - .gitignore
    - packages/config-io/src/types.ts
    - test/fixtures/project-config.json
    - test/fixtures/global-defaults.json
    - test/fixtures/global-defaults-claude-api.json
    - test/fixtures/project-config-with-fabricated-unknown-keys.json
    - test/fixtures/numeric-string-key.json
  modified: []

key-decisions:
  - "tsconfig.json include list widened to also match root *.ts files (not just packages/**/*.ts and test/**/*.ts) so `tsc --noEmit` has at least one input file before Task 2's types.ts exists — avoids TS18003 'No inputs were found' on a bare Wave 0 scaffold."
  - "vitest.config.ts sets passWithNoTests: true so an empty test suite exits 0 rather than vitest's default exit-1-on-zero-tests behavior, matching the plan's acceptance criterion ('zero tests found is acceptable at this point')."

patterns-established:
  - "Pattern 1: Frozen data contracts live in a dedicated types.ts with no runtime code, so every downstream plan/phase can import types without pulling in logic — established for packages/config-io/src/types.ts, expected to repeat for future contract modules."

requirements-completed: [SAVE-03]

coverage:
  - id: D1
    description: "Repo builds and runs an (empty) Vitest suite with the locked, pinned dependency versions installed"
    requirement: "SAVE-03"
    verification:
      - kind: unit
        ref: "npm ls ajv ajv-formats write-file-atomic proper-lockfile"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit"
        status: pass
      - kind: unit
        ref: "npx vitest run"
        status: pass
    human_judgment: false
  - id: D2
    description: "Frozen EffectiveTree/unknown[]/LoadResult data contracts exist as exported TypeScript types"
    requirement: "SAVE-03"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (packages/config-io/src/types.ts compiles, exports Provenance, EffectiveLeaf, EffectiveNode, UnknownKeyEntry, LoadResult, ValidationResult, SchemaEntry)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Real, messy, hand-edited config fixtures plus a fabricated-unknown-key fixture exist for the SAVE-03 round-trip and unknown-key-passthrough tests"
    requirement: "SAVE-03"
    verification:
      - kind: unit
        ref: "node -e fixture-parse-and-shape-check script (all 5 fixtures parse; fabricated fixture carries x_gsdcm_test_future_key and workflow.x_test_unknown_toggle)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-07-12
status: complete
---

# Phase 1 Plan 1: Project Scaffold, Frozen Data Contracts & Test Fixtures Summary

**Greenfield Node/TypeScript scaffold with exact-pinned ajv/write-file-atomic/proper-lockfile stack, frozen `LoadResult`/`EffectiveNode`/`UnknownKeyEntry` contracts in `types.ts`, and five real+fabricated config fixtures for SAVE-03 round-trip testing.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-12T10:15:00Z
- **Completed:** 2026-07-12T10:23:05Z
- **Tasks:** 3 completed
- **Files modified:** 10 created (package.json, tsconfig.json, vitest.config.ts, .gitignore, types.ts, 5 fixtures) + package-lock.json

## Accomplishments
- Scaffolded a buildable Node/TypeScript project from nothing: `package.json` (`type: module`, `engines.node >=20.19`), `tsconfig.json` (ES2022/NodeNext, strict), `vitest.config.ts`, `.gitignore` — with all four core runtime dependencies installed at exact pinned versions (no `^`/`~` drift).
- Froze the Phase 2/3 data contracts in `packages/config-io/src/types.ts`: `Provenance`, `EffectiveLeaf`, `EffectiveNode`, `UnknownKeyEntry`, `LoadResult` (with a doc comment enforcing the SAVE-03 patch-in-place invariant on `raw.project`), plus `ValidationResult` and `SchemaEntry` for Plans 02/03/05.
- Created five test fixtures: three byte-identical copies of real hand-edited config files (this project's own `.planning/config.json`, `~/.gsd/defaults.json`, `~/.gsd/defaults - claude api.json`), one derived fixture with two fabricated structurally-novel unknown keys (`x_gsdcm_test_future_key` top-level, `workflow.x_test_unknown_toggle` nested) to exercise the unknown-key passthrough path once SCHEMA-01 closes the real gsd-core schema gap, and one minimal fixture with integer-like string object keys (`"0"`, `"10"`) for the V8 key-reordering edge case.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold the Node/TypeScript project with the locked, pinned stack** - `181bd62` (chore)
2. **Task 2: Freeze the effective-value / provenance / unknown-key data contracts (types.ts)** - `92dd515` (feat)
3. **Task 3: Create the real + fabricated-unknown-key test fixtures** - `3e1bf84` (test)

**Plan metadata:** (final docs commit follows this summary)

## Files Created/Modified
- `package.json` - private `gsd-config-manager` package, exact-pinned deps, test/typecheck/build scripts
- `tsconfig.json` - ES2022/NodeNext, strict mode, `noEmit: true`, includes `packages/**/*.ts`, `test/**/*.ts`, and root `*.ts`
- `vitest.config.ts` - `test.include: test/**/*.test.ts`, `environment: 'node'`, `watch: false`, `passWithNoTests: true`
- `.gitignore` - `node_modules/`, `dist/`, `*.tmp`, OS/editor cruft
- `packages/config-io/src/types.ts` - the seven frozen Phase 1 data contracts (types-only, no runtime code)
- `test/fixtures/project-config.json` - byte-identical copy of `.planning/config.json`
- `test/fixtures/global-defaults.json` - byte-identical copy of `~/.gsd/defaults.json`
- `test/fixtures/global-defaults-claude-api.json` - byte-identical copy of `~/.gsd/defaults - claude api.json`
- `test/fixtures/project-config-with-fabricated-unknown-keys.json` - derived fixture with two fabricated unknown keys
- `test/fixtures/numeric-string-key.json` - minimal fixture with integer-like string object keys

## Decisions Made
- Widened `tsconfig.json`'s `include` to also match root `*.ts` files, not just `packages/**/*.ts`/`test/**/*.ts` — needed so `npx tsc --noEmit` has at least one input and doesn't fail with TS18003 before Task 2's `types.ts` exists (satisfies Task 1's own acceptance criterion in isolation, and remains correct after Task 2 adds real source files).
- Set `passWithNoTests: true` in `vitest.config.ts` — vitest's default behavior is to exit 1 when zero test files are found, which would fail Task 1's stated acceptance criterion ("zero tests found is acceptable at this point"). This is a routine test-runner configuration choice, not a scope change.

## Deviations from Plan

None - plan executed exactly as written. The two items in "Decisions Made" above are implementation-detail choices needed to satisfy the plan's own stated acceptance criteria, not deviations from scope.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 0 scaffold is fully in place: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` all exist and verify green (`npm ls`, `tsc --noEmit`, `vitest run` all exit 0).
- The frozen `LoadResult`/`EffectiveNode`/`UnknownKeyEntry`/`ValidationResult`/`SchemaEntry` contracts in `packages/config-io/src/types.ts` are ready for Plans 02 (schema build), 03 (validate.ts), 04 (load.ts/merge.ts), 06 (atomic-write.ts), and 07 (round-trip-identity tests) to import.
- All five fixtures required by 01-VALIDATION.md's Wave 0 Requirements exist and parse; the fabricated-unknown-key fixture is specifically shaped to exercise this tool's own unknown-key passthrough path after SCHEMA-01 closes the real gsd-core manifest gap (per RESEARCH.md's two-part SAVE-03 fixture strategy).
- No blockers for Wave 1/2 plans (01-02 through 01-05, which `depends_on: [01-01]` or run in parallel per the phase's wave structure).

---
*Phase: 01-schema-foundation-data-layer-safety*
*Completed: 2026-07-12*
