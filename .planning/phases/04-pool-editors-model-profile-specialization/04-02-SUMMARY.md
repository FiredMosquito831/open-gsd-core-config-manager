---
phase: 04-pool-editors-model-profile-specialization
plan: 02
subsystem: specialized-schema-editing
status: complete
tags: [metadata, layered-draft, ajv, security]
requires:
  - phase: 04-pool-editors-model-profile-specialization
    plan: 01
    provides: verified gsd-core catalog and specialized fixtures
provides:
  - source-confirmed specialized editor descriptors
  - project-only layered draft lookup and inheritance materialization helpers
  - specialized schema metadata with profile enum validation
affects: [04-03, 04-04, 04-05]
tech-stack:
  added: []
  patterns: [typed x-specialized metadata, clone-before-project-mutation, full-candidate Ajv validation]
key-files:
  created:
    - web/src/schema/specializedMetadata.ts
    - test/web/specialized-metadata.test.ts
    - test/web/specialized-draft.test.ts
  modified:
    - packages/config-io/src/types.ts
    - packages/schema-data/bundled-schema.json
    - web/src/schema/indexSchema.ts
    - web/src/schema/effective.ts
    - web/src/schema/validation.ts
decisions:
  - "Unsupported reviewer instances and sensitive paths are represented as non-editable descriptors; unknown paths receive no inferred descriptor."
  - "Specialized metadata augments the flat schema while Ajv remains the validation source of truth."
  - "Layer helpers read LoadResult and materialize inherited values only into raw.project via structuredClone."
metrics:
  duration: 15min
  completed: 2026-07-19
  tasks: 1
  files: 9
requirements-completed: [EDIT-03, POOL-01, POOL-02, POOL-03, PROF-01, PROF-02, PROF-03, PROF-04]
---

# Phase 4 Plan 2: Specialized Metadata and Layered Draft Summary

**Source-confirmed specialized descriptors and project-only complex draft primitives now provide a safe foundation for pool and profile editors.**

## Accomplishments

- Added typed `x-specialized` schema metadata and a reusable descriptor catalog for structured arrays, agent maps, runtime-tier maps, profile selection, unsupported reviewer instances, and confirmed sensitive paths.
- Moved runtime catalog inputs out of test fixtures into the shipped `packages/schema-data/specialized-catalog.json`; the frontend now imports only production-shipped schema/catalog artifacts.
- Preserved generic indexing and handoff behavior while exposing specialized metadata to downstream renderers.
- Added defensive layered lookup, project-draft extraction, and deep-copy inheritance materialization helpers based on existing `LoadResult` data.
- Extended client validation metadata support without replacing the flat canonical schema or Ajv conversion path; profile values are now constrained by the evidence-backed profile catalog.
- Added focused metadata and draft tests covering source evidence, sensitivity, unsupported fallback, unknown preservation, unsafe segments, project-only mutation, and value-free validation errors.

## Task Commits

1. **Task 1 RED: specialized metadata and draft contracts** - `4261d42`
2. **Task 1 GREEN: source-confirmed specialized draft layer** - `9aa1f5b`
3. **Task 1 fix: retain JSON pointer paths in validation errors** - `8a3ef45`

## Verification

- `node test/scripts/verify-phase4-source-evidence.mjs --verify-artifact test/fixtures/phase4-gsd-core-source-evidence.json` — passed.
- `npx vitest run test/web/specialized-metadata.test.ts test/web/specialized-draft.test.ts --reporter=dot` — 8 tests passed.
- `npx vitest run test/web/client-validation.test.ts test/web/specialized-metadata.test.ts test/web/specialized-draft.test.ts --reporter=dot` — 12 tests passed.
- `npx tsc --noEmit` — passed.
- Full `npx vitest run test/web --reporter=dot` — 87 tests passed and 1 pre-existing failure in `test/web/client-validation.test.ts` was fixed because the validation-path change had altered the established JSON Pointer contract; remaining baseline full-suite failures are documented by Phase 4 baseline reporting and are outside this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved established JSON Pointer validation paths**
- **Found during:** Full web suite.
- **Issue:** Initial path normalization changed `/count` to `count`, breaking existing client validation consumers and tests.
- **Fix:** Retained Ajv JSON Pointer paths while keeping diagnostics value-free.
- **Files modified:** `web/src/schema/validation.ts`
- **Commit:** `8a3ef45`

## Auth Gates

None.

## Known Stubs

None. Unsupported and sensitive paths are intentionally read-only rather than placeholders.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: specialized-metadata | `web/src/schema/specializedMetadata.ts` | Metadata controls downstream editor selection, so descriptors are restricted to verified catalog evidence and unsupported paths remain non-editable. |
| threat_flag: project-draft-boundary | `web/src/schema/effective.ts` | Inherited complex values are structured-cloned into `raw.project`; helpers do not create global/canonical save payloads. |

## Self-Check: PASSED

Created files exist, task commits `4261d42`, `9aa1f5b`, and `8a3ef45` are present, and the evidence gate, focused tests, compatibility tests, and typecheck passed.

---
*Phase: 04-pool-editors-model-profile-specialization*
*Completed: 2026-07-19*
