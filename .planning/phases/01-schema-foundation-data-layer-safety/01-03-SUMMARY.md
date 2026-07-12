---
phase: 01-schema-foundation-data-layer-safety
plan: 03
subsystem: infra
tags: [typescript, vitest, ajv, ajv-formats, validation, security, config-io]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Buildable Node/TypeScript scaffold and the frozen ValidationResult contract in packages/config-io/src/types.ts"
provides:
  - "createValidator(schema) / validate(data) / formatErrors(errors) — the Ajv 2020-12 save-blocking validation layer (SAVE-01)"
  - "safeSet(obj, dotPath, value) — the prototype-pollution-safe patch-in-place primitive with a FORBIDDEN_SEGMENTS denylist"
  - "A documented, working NodeNext import-equals-require pattern for ajv/ajv-formats that satisfies both tsc --noEmit and Node ESM runtime resolution"
affects: [01-06, 01-07, phase-2, phase-3]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TS `import x = require('pkg')` (compiles to a NodeNext createRequire call) used instead of ESM default imports for CJS packages (ajv, ajv-formats) whose .d.ts uses ESM export-default syntax but whose package.json declares no 'exports' map — the plain ESM default-import form type-checks incorrectly under moduleResolution: NodeNext even though it runs fine under vitest/esbuild."
    - "Ajv vendor keywords (x-category, x-description, x-provenance, x-options, x-dynamic-key-hint) registered individually via ajv.addKeyword({ keyword }) as metadata-only no-ops, never via a global strict: false."
    - "Prototype-pollution denylist (FORBIDDEN_SEGMENTS) kept as a small, auditable inline Set rather than delegated to a general-purpose deep-set library."

key-files:
  created:
    - packages/config-io/src/validate.ts
    - packages/config-io/src/patch.ts
    - test/config-io/validate.test.ts
    - test/config-io/patch.test.ts
  modified: []

key-decisions:
  - "Used `import ajv2020Module = require('ajv/dist/2020.js')` / `import ajvFormatsModule = require('ajv-formats')` (TS import-equals-require) instead of the plain `import Ajv2020 from 'ajv/dist/2020'` / `import addFormats from 'ajv-formats'` shown literally in 01-RESEARCH.md's code sample — the plain ESM default-import form produces `tsc --noEmit` errors ('Cannot find module ajv/dist/2020 or its corresponding type declarations' and 'This expression is not callable/constructable') under this project's `moduleResolution: NodeNext` + `\"type\": \"module\"` combination, because ajv/ajv-formats are CJS packages with no `exports` map whose .d.ts files use ESM `export default` syntax — a documented ecosystem interop gap, not a bug in this code. The import-equals-require form (which NodeNext compiles to a `createRequire` call) resolves both the module-not-found and not-callable errors while remaining runtime-correct under plain Node ESM (verified directly with `node` against a compiled output, not just vitest/esbuild). The runtime import target (`ajv/dist/2020`, additionalProperties left open, vendor-keyword registration) is otherwise implemented exactly per RESEARCH's Decision: Ajv Setup."
  - "safeSet(), formatErrors(), and createValidator() are implemented exactly per RESEARCH's inline code samples (Decision: Atomic-Write Mechanics → Safe patch-by-path guard; Decision: Ajv Setup) with no other structural deviation."

patterns-established:
  - "Pattern: when a CJS-with-ESM-.d.ts package fights NodeNext's default-import type resolution, reach for `import x = require('pkg')` rather than casting through `unknown` or relaxing tsconfig — it type-checks correctly and is runtime-equivalent to the plain default import under Node's ESM loader."

requirements-completed: [SAVE-01]

coverage:
  - id: D1
    description: "createValidator(schema) compiles an Ajv 2020-12 schema without throwing on x-category/x-description/x-provenance/x-options/x-dynamic-key-hint vendor keywords"
    requirement: "SAVE-01"
    verification:
      - kind: unit
        ref: "test/config-io/validate.test.ts#compiles the fixture schema without throwing on x-* vendor keywords"
        status: pass
    human_judgment: false
  - id: D2
    description: "validate() returns { valid: true, errors: [] } for valid data and { valid: false, errors: [...instancePath-keyed] } for structurally-invalid data, never throwing"
    requirement: "SAVE-01"
    verification:
      - kind: unit
        ref: "test/config-io/validate.test.ts#returns { valid: true, errors: [] } for valid data"
        status: pass
      - kind: unit
        ref: "test/config-io/validate.test.ts#returns { valid: false, errors: [...] } with instancePath for structurally-invalid data, never throwing"
        status: pass
    human_judgment: false
  - id: D3
    description: "A config carrying an unknown/future key still validates as { valid: true } — additionalProperties left open everywhere"
    requirement: "SAVE-01"
    verification:
      - kind: unit
        ref: "test/config-io/validate.test.ts#returns { valid: true } for data carrying an unknown/future key (additionalProperties open)"
        status: pass
    human_judgment: false
  - id: D4
    description: "formatErrors() renders only instancePath + keyword, never leaking a secret-shaped field value into logged error text"
    requirement: "SAVE-01"
    verification:
      - kind: unit
        ref: "test/config-io/validate.test.ts#formatErrors never includes the offending secret-shaped value in rendered error text"
        status: pass
    human_judgment: false
  - id: D5
    description: "safeSet() sets/overwrites nested values in place, creating intermediates as needed and leaving sibling keys untouched"
    requirement: "SAVE-01"
    verification:
      - kind: unit
        ref: "test/config-io/patch.test.ts#sets a nested value, creating intermediate objects as needed"
        status: pass
      - kind: unit
        ref: "test/config-io/patch.test.ts#overwrites only the target leaf and leaves sibling keys untouched (patch-in-place fidelity)"
        status: pass
    human_judgment: false
  - id: D6
    description: "safeSet() rejects __proto__/constructor/prototype path segments (intermediate or final) with a thrown Error and no global prototype pollution"
    requirement: "SAVE-01"
    verification:
      - kind: unit
        ref: "test/config-io/patch.test.ts#throws on a __proto__ path segment and causes no global prototype pollution"
        status: pass
      - kind: unit
        ref: "test/config-io/patch.test.ts#throws on a bare \"constructor\" final segment"
        status: pass
      - kind: unit
        ref: "test/config-io/patch.test.ts#throws on a \"prototype\" intermediate segment"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-07-12
status: complete
---

# Phase 1 Plan 3: Ajv 2020-12 Validation Layer & Prototype-Pollution-Safe Patch Summary

**Save-blocking Ajv 2020-12 validator (`ajv/dist/2020`, open `additionalProperties`, no-op vendor keywords, never-throws contract) and a hand-rolled `safeSet()` dot-path patch utility with a `__proto__`/`constructor`/`prototype` denylist — both proven by TDD unit tests, plus a documented workaround for a NodeNext + CJS-package default-import typecheck gap.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-12T13:56:00Z
- **Completed:** 2026-07-12T14:03:21Z
- **Tasks:** 2 completed
- **Files modified:** 4 created (validate.ts, patch.ts, validate.test.ts, patch.test.ts)

## Accomplishments
- Built `packages/config-io/src/validate.ts`: `createValidator(schema)` compiles a 2020-12 schema via the correct `Ajv2020` class (never the draft-07 default `Ajv` export), registers the five `x-*` vendor keywords as metadata-only no-ops so `ajv.compile()` doesn't crash on the bundled schema's own extensions, and returns a `validate(data)` closure that never throws and never sets `additionalProperties: false` anywhere. `formatErrors()` renders only `instancePath` + `keyword`, proven by a test that a fake secret value placed at a validated key never appears in rendered error text.
- Built `packages/config-io/src/patch.ts`: `safeSet(obj, dotPath, value)` mutates the original object in place, creating intermediate objects as needed, and throws `Error("Refusing to patch unsafe path segment: <seg>")` for any `__proto__`/`constructor`/`prototype` segment (intermediate or final) — proven by a test that a rejected `__proto__` payload leaves `({}).polluted` `undefined` (no global pollution).
- All 11 new unit tests pass (`test/config-io/validate.test.ts`: 5, `test/config-io/patch.test.ts`: 6); the full project suite (18 tests across 3 files) and `tsc --noEmit` both pass cleanly.
- Diagnosed and resolved a real `tsc --noEmit` failure caused by a NodeNext/CJS-package default-import interop gap (see Deviations) before either implementation could satisfy its own acceptance criteria.

## Task Commits

Each task followed the RED → GREEN TDD cycle with separate commits:

1. **Task 1: Ajv 2020-12 validator (test, RED)** - `e43be9a` (test)
2. **Task 1: Ajv 2020-12 validator (implementation, GREEN)** - `bf38e47` (feat)
3. **Task 2: safeSet patch utility (test, RED)** - `0a5d3eb` (test)
4. **Task 2: safeSet patch utility (implementation, GREEN)** - `27c39f4` (feat)

**Plan metadata:** (final docs commit follows this summary)

## Files Created/Modified
- `packages/config-io/src/validate.ts` - `createValidator(schema)`, `validate(data): ValidationResult`, `formatErrors(errors)` — Ajv 2020-12 save-blocking validator
- `packages/config-io/src/patch.ts` - `safeSet(obj, dotPath, value)`, `FORBIDDEN_SEGMENTS` — prototype-pollution-safe patch-in-place primitive
- `test/config-io/validate.test.ts` - 5 tests covering compile-without-throw, valid, invalid-with-instancePath, unknown-key-passthrough, no-secret-leak
- `test/config-io/patch.test.ts` - 6 tests covering nested set, sibling fidelity, `__proto__`/`constructor`/`prototype` rejection, denylist auditability

## Decisions Made
- Replaced RESEARCH.md's literal `import Ajv2020 from 'ajv/dist/2020'` / `import addFormats from 'ajv-formats'` with TS's `import x = require('pkg')` form (`import ajv2020Module = require('ajv/dist/2020.js')`, `import ajvFormatsModule = require('ajv-formats')`, then destructuring `.default`). The plain ESM default-import form fails `tsc --noEmit` under this project's `moduleResolution: NodeNext` + `"type": "module"` combination — `ajv`/`ajv-formats` are CJS packages with no `"exports"` map whose `.d.ts` files use ESM `export default` syntax, which NodeNext's default-import resolution mistypes as the whole CJS module namespace (`This expression is not callable/constructable`) rather than the actual default export. This is a documented ecosystem interop gap (independently reproduced against a minimal repro outside this codebase), not a defect in the implementation logic. The `import = require` form both type-checks cleanly and was verified at runtime with a compiled-and-executed `node` smoke test (not just vitest/esbuild, which tolerates the plain form but wouldn't catch a real Node ESM runtime failure). The actual validation behavior (draft-2020-12 via `Ajv2020`, open `additionalProperties`, vendor-keyword registration via `addKeyword`) matches RESEARCH's Decision: Ajv Setup exactly — only the import mechanics changed.
- `patch.ts`'s `safeSet()` and denylist are implemented verbatim per RESEARCH's "Safe patch-by-path guard" code sample; no deviation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worked around a NodeNext + CJS-package default-import typecheck gap for `ajv`/`ajv-formats`**
- **Found during:** Task 1 (Ajv 2020-12 validator), while running `npx tsc --noEmit` per the plan's own acceptance criteria (the project's established `npm run typecheck` gate, per 01-01-SUMMARY.md)
- **Issue:** `import Ajv2020 from 'ajv/dist/2020'` (as shown literally in 01-RESEARCH.md's code sample) fails `tsc --noEmit` with `TS2307: Cannot find module 'ajv/dist/2020' or its corresponding type declarations` (needs an explicit `.js` extension under NodeNext's Node-ESM-strict resolution), and even with the extension added, `new Ajv2020(...)` / `addFormats(ajv)` fail with `TS2351/TS2349: ... has no construct/call signatures` because both packages are CJS with no `exports` map and ESM-syntax `.d.ts` files — a combination NodeNext's default-import interop does not resolve correctly to the actual default export type.
- **Fix:** Reproduced the failure in isolation outside the real source files to confirm it was an ecosystem interop issue and not a code-logic bug, then switched both imports to TS's `import x = require('pkg')` form (`ajv2020Module = require('ajv/dist/2020.js')`, `ajvFormatsModule = require('ajv-formats')`, destructuring `.default`), which NodeNext compiles to a `createRequire`-based call. Verified this form both type-checks with zero errors and is runtime-correct by compiling a standalone repro with the project's real `tsc` + real `node_modules` and executing the emitted JS directly with `node` (not just vitest/esbuild, which is more permissive about extensions/interop than plain Node ESM).
- **Files modified:** `packages/config-io/src/validate.ts`
- **Verification:** `npx tsc --noEmit` exits 0; `npx vitest run test/config-io/validate.test.ts` passes 5/5; standalone `node`-executed repro confirms runtime correctness of the import pattern independent of any test-runner transform.
- **Committed in:** `bf38e47` (Task 1 feat commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix is purely a TypeScript import-mechanics workaround for an upstream package/tsconfig interaction; the validator's actual behavior (2020-12 draft, open `additionalProperties`, vendor-keyword handling, never-throws contract) matches RESEARCH.md's design exactly. No scope creep.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `validate.ts` and `patch.ts` are ready for Plan 06 (atomic-write/save pipeline) to import: `validate()` is the save-blocking gate branching on `ValidationResult` (frozen in Plan 01's `types.ts`), and `safeSet()` is the sole sanctioned mutation path for `raw.project` before a write.
- The `import x = require('pkg')` workaround pattern for `ajv`/`ajv-formats` is documented inline in `validate.ts` and in this Summary's Decisions section — any future file importing these packages under this project's `moduleResolution: NodeNext` should use the same pattern rather than rediscovering the interop gap.
- Full project test suite (18 tests, 3 files) and `tsc --noEmit` both pass cleanly; no blockers for Plan 04, 05, 06, or 07.

---
*Phase: 01-schema-foundation-data-layer-safety*
*Completed: 2026-07-12*
