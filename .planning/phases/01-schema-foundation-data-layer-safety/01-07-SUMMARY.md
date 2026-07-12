---
phase: 01-schema-foundation-data-layer-safety
plan: 07
subsystem: infra
tags: [typescript, vitest, ajv, config-io, round-trip, schema-bridge]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Frozen ValidationResult/SchemaEntry contracts in packages/config-io/src/types.ts"
  - phase: 01-02
    provides: "packages/schema-data/bundled-schema.json — the flat dot-path-keyed canonical schema artifact (158 keys)"
  - phase: 01-03
    provides: "createValidator(schema)/formatErrors(errors) — the Ajv 2020-12 save-blocking validator"
  - phase: 01-05
    provides: "load(projectConfigPath) — the layered read side producing LoadResult (raw/effective/unknown/meta)"
  - phase: 01-06
    provides: "saveConfig(path, obj, validate) — the lock -> validate-block -> atomic-write -> unlock save pipeline"
provides:
  - "packages/config-io/src/index.ts — the frozen public config-io API barrel Phase 2/3 import from"
  - "packages/config-io/src/schema-convert.ts — buildAjvSchema(flatSchema), converting the flat bundled-schema.json into a nested, Ajv-2020-12-compilable JSON Schema tree"
  - "test/config-io/round-trip-identity.test.ts — the SAVE-03 / success-criterion-#1 end-to-end fidelity gate, exercised against the REAL validator"
affects: [phase-2, phase-3]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "schema-convert.ts bridges the flat, dot-path-keyed bundled-schema.json (a metadata catalog, not itself an Ajv-compilable document) into a nested JSON Schema tree, relativizing each dynamic-map container's full-dot-path patternProperties regex to the local key-name pattern Ajv evaluates inside that nested object"
    - "index.ts barrel is import-only (no logic), re-exporting the full Phase 2/3 surface plus the schema-convert bridge needed to actually construct a working real-schema validator"

key-files:
  created:
    - packages/config-io/src/index.ts
    - packages/config-io/src/schema-convert.ts
    - test/config-io/round-trip-identity.test.ts
  modified:
    - packages/config-io/src/validate.ts
    - packages/config-io/src/types.ts

key-decisions:
  - "Added schema-convert.ts's buildAjvSchema() (not in the plan's files_modified) because bundled-schema.json's own flat dot-path shape (Plan 02's deliberate design for known-keys.ts/load.ts) cannot be passed directly to createValidator()/ajv.compile() — its top-level keys are dot-paths, not JSON Schema keywords, and Ajv's strict mode rejects them as unknown keywords immediately. Exported from index.ts alongside createValidator since Phase 2's server needs the identical conversion to build a working real-schema validator."
  - "Widened SchemaEntry.type (types.ts) from a bare string to string | string[] — several real bundled-schema.json entries (nullable dynamic-map containers) declare type: ['object', 'null'], which the original frozen contract's string-only field didn't accurately model."
  - "Added allowUnionTypes: true and allowMatchingProperties: true to validate.ts's Ajv2020 constructor options — both required for the REAL bundled schema to compile under Ajv strict mode (union type: ['object','null'] entries, and named children like features.thinking_partner that legitimately also match their own container's catch-all patternProperties pattern). Neither loosens actual validation semantics; both are standard JSON Schema shapes Ajv's strict mode merely flags as possible authoring mistakes by default."

patterns-established:
  - "Pattern: when a frozen Plan N artifact's flat/metadata shape doesn't match what a downstream library (Ajv) needs, build a dedicated, pure conversion module (schema-convert.ts) rather than reshaping the original artifact or its existing consumers — known-keys.ts/load.ts keep consuming the flat map unchanged."

requirements-completed: [SAVE-03]

coverage:
  - id: D1
    description: "packages/config-io/src/index.ts re-exports the full Phase 2/3 public API surface (load, saveConfig, writeWithRetry, ValidationError, createValidator, formatErrors, buildAjvSchema, safeSet, resolveGlobalDefaultsPath, readGlobalDefaults, resolveLeaf, buildEffectiveTree, and all frozen contract types) and type-checks"
    requirement: "SAVE-03"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit"
        status: pass
      - kind: unit
        ref: "test/config-io/round-trip-identity.test.ts (imports all symbols under test from packages/config-io/src/index.ts)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A no-op load -> save -> load cycle on the fabricated-unknown-key fixture preserves unknown[] and raw.project with 100% fidelity, using the REAL createValidator(buildAjvSchema(bundledSchema)) pipeline"
    requirement: "SAVE-03"
    verification:
      - kind: unit
        ref: "test/config-io/round-trip-identity.test.ts#Test A: a no-op save on the fabricated-unknown fixture preserves unknown[] and raw.project with 100% fidelity"
        status: pass
    human_judgment: false
  - id: D3
    description: "A no-op load -> save -> load cycle on the real project-config.json fixture preserves raw.project with 100% fidelity, including gates.*/safety.* drift keys"
    requirement: "SAVE-03"
    verification:
      - kind: unit
        ref: "test/config-io/round-trip-identity.test.ts#Test B: a no-op save on the real project-config.json fixture preserves raw.project with 100% fidelity, including gates.*/safety.* drift keys"
        status: pass
    human_judgment: false
  - id: D4
    description: "The V8 integer-like-string-key ascending-numeric ordering behavior is asserted explicitly (both on the numeric-string-key fixture and on an insertion-order-independent scrambled object), documenting rather than silently surprising"
    requirement: "SAVE-03"
    verification:
      - kind: unit
        ref: "test/config-io/round-trip-identity.test.ts#Test C: integer-like string keys are serialized in ascending numeric order"
        status: pass
    human_judgment: false
  - id: D5
    description: "All committed fixtures under test/fixtures/ remain byte-identical after the full round-trip-identity test run (every save() call in the file targets a temp copy only)"
    requirement: "SAVE-03"
    verification:
      - kind: unit
        ref: "test/config-io/round-trip-identity.test.ts#committed fixtures are byte-unchanged after the full test run"
        status: pass
    human_judgment: false
  - id: D6
    description: "Full project test suite and typecheck remain green after the barrel + schema-bridge additions; the Windows kill-mid-save stress harness (phase-gate item from Plan 06) is confirmed passing on the actual Windows target machine"
    requirement: "SAVE-02"
    verification:
      - kind: unit
        ref: "npx vitest run (61 tests, 8 files, all pass)"
        status: pass
      - kind: other
        ref: "node test/stress/kill-mid-save.mjs 20 (20/20 passed, exit 0, this session's Windows machine)"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-07-12
status: complete
---

# Phase 1 Plan 7: Round-Trip Identity Gate & Frozen config-io Public API Summary

**`packages/config-io/src/index.ts` public API barrel plus a new `schema-convert.ts` bridge (`buildAjvSchema`) that converts the flat dot-path `bundled-schema.json` into an Ajv-2020-12-compilable nested schema, proven by a round-trip-identity test that saves real+fabricated fixtures through the REAL validator with zero key/value loss.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-12T14:35:00+03:00
- **Completed:** 2026-07-12T14:57:00+03:00
- **Tasks:** 2 completed
- **Files modified:** 3 created (index.ts, schema-convert.ts, round-trip-identity.test.ts), 2 modified (validate.ts, types.ts)

## Accomplishments
- Built `packages/config-io/src/index.ts`, the frozen public config-io API barrel: re-exports `load`, `saveConfig`/`writeWithRetry`/`ValidationError`, `createValidator`/`formatErrors`, `safeSet`, `resolveGlobalDefaultsPath`/`readGlobalDefaults`, `resolveLeaf`/`buildEffectiveTree`, all seven frozen Plan 01 contract types, and (new) `buildAjvSchema` — the single import surface Phase 2's server and Phase 3's UI will build against.
- Discovered and fixed a real, blocking pipeline gap while wiring Task 2's round-trip test: `bundled-schema.json` (Plan 02) is a FLAT dot-path-keyed metadata map — its top-level keys are dot-paths like `"workflow.tdd_mode"`, not JSON Schema keywords — so `createValidator(bundledSchema)`, exactly as the plan's own Task 2 instruction specified, fails immediately under Ajv's strict mode ("unknown keyword: agent_skills"). Built `packages/config-io/src/schema-convert.ts`'s `buildAjvSchema(flatSchema)` to bridge the two shapes: every dot-path becomes a nested `properties` chain, and every dynamic-map container's own full-dot-path `patternProperties` regex is relativized to the local key-name pattern Ajv actually evaluates once nested (`^model_overrides\.[a-zA-Z0-9_-]+$` → `^[a-zA-Z0-9_-]+$`). `additionalProperties` is never set anywhere in the generated tree (Pitfall 5 compliance — unknown/future keys always validate).
- Two further Ajv strict-mode gaps surfaced compiling the REAL schema end-to-end (never exercised by validate.test.ts's minimal inline fixture): union `type: ["object", "null"]` entries, and named children (`features.thinking_partner`) that legitimately also match their own container's catch-all `patternProperties` pattern. Fixed by adding `allowUnionTypes: true` and `allowMatchingProperties: true` to `validate.ts`'s `Ajv2020` constructor options — both are standard, valid JSON Schema shapes; Ajv strict mode just flags them as possible authoring mistakes by default. Also widened the frozen `SchemaEntry.type` field (`types.ts`) from a bare `string` to `string | string[]` to accurately model the real artifact.
- Built `test/config-io/round-trip-identity.test.ts` (4 tests): Test A proves 100% fidelity of `unknown[]` and `raw.project` across a no-op save on the fabricated-unknown-key fixture; Test B proves the same on the real, hand-edited `project-config.json` (including its `gates.*`/`safety.*` fixture-observed drift keys); Test C asserts the documented V8 integer-like-string-key ascending-numeric ordering behavior both on the numeric-string-key fixture and via an insertion-order-independent scrambled-object sanity check; a final test confirms all three committed fixtures are byte-identical to a module-load-time baseline after the full run (every `saveConfig()` call targets a temp copy only, never the committed fixture path).
- Full project suite (61 tests, 8 files) and `tsc --noEmit` both pass cleanly. Additionally ran the Windows `kill-mid-save.mjs` stress harness (flagged `human_judgment: true` in 01-06-SUMMARY.md as a phase-gate item pending confirmation on the actual Windows target) on this session's real Windows machine: 20/20 iterations passed, closing that outstanding gate.

## Task Commits

Each task was committed atomically:

1. **Task 1: Public config-io API barrel (frozen Phase 2/3 surface)** - `587bdd3` (feat)
2. **Task 2: Round-trip identity gate — 100% fidelity across a no-op save (SAVE-03, criterion #1)** - `31f4941` (test)

**Plan metadata:** (final docs commit follows this summary)

## Files Created/Modified
- `packages/config-io/src/index.ts` - the frozen public config-io API barrel (import-only, no logic)
- `packages/config-io/src/schema-convert.ts` - `buildAjvSchema(flatSchema)`, converting the flat bundled-schema.json into a nested, Ajv-2020-12-compilable JSON Schema tree
- `test/config-io/round-trip-identity.test.ts` - the SAVE-03 / success-criterion-#1 end-to-end fidelity gate (Test A/B/C + fixtures-unchanged check)
- `packages/config-io/src/validate.ts` - added `allowUnionTypes: true` and `allowMatchingProperties: true` to the `Ajv2020` constructor options
- `packages/config-io/src/types.ts` - widened `SchemaEntry.type` from `string` to `string | string[]`

## Decisions Made
- See `key-decisions` in frontmatter: `buildAjvSchema()`'s creation and its inclusion in the frozen barrel, `SchemaEntry.type`'s widening, and the two Ajv strict-mode option additions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added `schema-convert.ts` (`buildAjvSchema`), not in the plan's `files_modified`**
- **Found during:** Task 2, while wiring `createValidator(bundledSchema)` exactly as the plan's own `<action>` text instructs
- **Issue:** `bundled-schema.json` is a flat, dot-path-keyed metadata catalog (Plan 02's deliberate design for `known-keys.ts`/`load.ts`'s known-key classification and canonical-defaults lookup), not a nested, Ajv-compilable JSON Schema document. Passing it directly to `createValidator()`/`ajv.compile()` fails immediately under Ajv's strict mode with `"strict mode: unknown keyword: agent_skills"` (and every other top-level dot-path key) — the real validator the plan calls for literally cannot be constructed without a conversion step. This blocks Task 2 entirely, not just a stylistic preference.
- **Fix:** Built `packages/config-io/src/schema-convert.ts`'s `buildAjvSchema(flatSchema)`: walks every flat dot-path into a nested `properties` chain, and relativizes each dynamic-map container's own full-dot-path `patternProperties` regex source to the local single-segment pattern Ajv evaluates once that regex lives inside the nested object (verified no dot-path in the real 158-key schema has both a container's own `patternProperties` AND separately-declared child flat keys that fall outside that pattern, so no ambiguous-merge case exists). `additionalProperties` is never set at any depth (Pitfall 5). Exported from `index.ts` alongside `createValidator` since Phase 2's server will need the identical bridge to construct a working validator from the real schema.
- **Files modified:** `packages/config-io/src/schema-convert.ts` (new), `packages/config-io/src/index.ts`
- **Verification:** Manually compiled the converted schema via a standalone `node -e` repro against all five real/fabricated fixtures (all validate `true`) before writing the TypeScript module; `npx tsc --noEmit` and the full round-trip test suite both pass.
- **Committed in:** `587bdd3` (Task 1 commit)

**2. [Rule 1 - Bug] Widened `SchemaEntry.type` (types.ts) from `string` to `string | string[]`**
- **Found during:** Task 1, writing `schema-convert.ts`'s leaf-node conversion against the real schema
- **Issue:** The frozen Plan 01 `SchemaEntry` contract declares `type: string`, but several real `bundled-schema.json` entries (nullable dynamic-map containers, e.g. `model_overrides`, `features`) declare `type: ["object", "null"]` — a genuine mismatch between the frozen TypeScript contract and the actual artifact's shape (invisible at compile time only because `load.ts`/`known-keys.ts` cast the parsed JSON with `as Record<string, SchemaEntry>` rather than validating it).
- **Fix:** Widened `SchemaEntry.type` to `string | string[]` — an additive, non-breaking change (`entry.type` was never narrowed/compared against a literal string anywhere in `known-keys.ts`/`load.ts`, so no downstream consumer's logic changes).
- **Files modified:** `packages/config-io/src/types.ts`
- **Verification:** `npx tsc --noEmit` clean across the whole project; full suite (61 tests) passes.
- **Committed in:** `587bdd3` (Task 1 commit)

**3. [Rule 3 - Blocking] Added `allowUnionTypes: true` and `allowMatchingProperties: true` to `validate.ts`'s `Ajv2020` constructor options**
- **Found during:** Task 1 (union types) and Task 2 (matching properties), while compiling the real converted schema through `createValidator`
- **Issue:** Ajv's strict mode rejects two genuinely valid, intentional shapes present in the real schema: (a) a `type` array (`["object", "null"]`) without `allowUnionTypes`, and (b) a named child property (`features.thinking_partner`) that also matches its own container's catch-all `patternProperties` regex, without `allowMatchingProperties`. Neither was ever exercised by `validate.test.ts`'s minimal inline fixture schema (Plan 03), so both gaps were invisible until this plan compiled the real artifact end-to-end.
- **Fix:** Added both options to the `Ajv2020` constructor in `createValidator()`. Both are opt-in relaxations of strict-mode's authoring-mistake heuristics only — neither loosens actual data-validation semantics (a union type still requires the value to match one of the listed types; overlapping `properties`/`patternProperties` schemas both still apply per JSON Schema spec).
- **Files modified:** `packages/config-io/src/validate.ts`
- **Verification:** `ajv.compile()` succeeds against the real converted schema; all five real/fabricated fixtures validate `true`; `npx vitest run test/config-io/validate.test.ts` (unaffected, still 5/5) and the full suite (61/61) pass.
- **Committed in:** `587bdd3` (Task 1 commit), option 2 refined in `31f4941` (Task 2 commit) once `allowMatchingProperties` was also discovered necessary.

---

**Total deviations:** 3 auto-fixed (1 missing critical functionality, 1 bug, 1 blocking)
**Impact on plan:** All three fixes were strictly necessary for the plan's own literal Task 2 instruction ("use `saveConfig` with the REAL validator built from the real `bundled-schema.json`") to be executable at all — without them, `createValidator(bundledSchema)` cannot compile under any circumstances, meaning Phase 2's server (which the frozen `index.ts` barrel is designed for) would hit the identical crash in production. No scope creep — the fixes are confined to the schema-compilation boundary; `known-keys.ts`/`load.ts`'s consumption of the flat schema shape is completely unchanged, and no runtime validation behavior became more permissive in an unsafe way.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `packages/config-io/src/index.ts` is the complete, frozen public API surface for Phase 2 (loopback server): `load`, `saveConfig`, `createValidator(buildAjvSchema(bundledSchema))` for the real-schema validator, `safeSet`, discovery/merge helpers, and every frozen contract type.
- The round-trip-identity gate (SAVE-03, success criterion #1) is green: a no-op save through the FULL real pipeline (load → saveConfig with the real Ajv-compiled schema → load) drops nothing, on both a fabricated-unknown-key fixture and this project's own real, messy `project-config.json`.
- The Windows `kill-mid-save.mjs` stress harness — flagged as an outstanding `human_judgment: true` phase-gate item in 01-06-SUMMARY.md pending a confirmed run on the actual Windows target — was run on this session's real Windows machine (20/20 passed) and is no longer an open gate.
- All 61 project tests and `tsc --noEmit` pass cleanly. This is the final Wave 4 plan; Phase 1 (Schema Foundation & Data-Layer Safety) is complete and ready for Phase 2 (loopback server, CLI, security) to build directly on `packages/config-io/src/index.ts`.
- No blockers.

---
*Phase: 01-schema-foundation-data-layer-safety*
*Completed: 2026-07-12*
