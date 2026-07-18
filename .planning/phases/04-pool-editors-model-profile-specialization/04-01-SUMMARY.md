---
phase: 04-pool-editors-model-profile-specialization
plan: 01
subsystem: testing
status: complete
tags: [gsd-core, evidence, fixtures, vitest, security]
requires:
  - phase: 03-generic-schema-driven-ui-shell
    provides: bundled schema and project-draft test conventions
provides:
  - immutable gsd-core source evidence retrieval and verification gate
  - evidence-derived Phase 4 catalog and layered specialized-config fixtures
  - executable catalog, persistence, runtime-matrix, and secret non-disclosure contracts
affects: [04-02, 04-03, 04-04, 04-05]
tech-stack:
  added: []
  patterns: [live immutable-ref revalidation, source-digest manifests, evidence-backed descriptors, value-free sensitive-fixture assertions]
key-files:
  created:
    - test/scripts/verify-phase4-source-evidence.mjs
    - test/fixtures/phase4-gsd-core-source-evidence.json
    - test/fixtures/phase4-gsd-core-catalog.json
    - test/fixtures/phase4-specialized-config.json
    - test/web/phase4-catalog-evidence.test.ts
  modified: []
key-decisions:
  - "The pinned gsd-core next revision is re-fetched and checked in every gate mode; stored evidence never substitutes for live revision equality."
  - "Reviewer instances remain visible/preserved read-only because the bundled schema lacks a matching validation shape, despite source-confirmed cli/model/agent fields."
  - "Custom model configuration is persisted as ordinary project fields; profile entities and identity labels are forbidden from serialized drafts."
requirements-completed: [SEC-03, EDIT-03, POOL-01, POOL-02, POOL-03, PROF-01, PROF-02, PROF-03, PROF-04]
coverage:
  - id: D1
    description: Immutable gsd-core source retrieval, digest, anchor, catalog, descriptor, and matrix evidence gate
    requirement: EDIT-03
    verification:
      - kind: integration
        ref: node test/scripts/verify-phase4-source-evidence.mjs --verify-only
        status: pass
      - kind: integration
        ref: node test/scripts/verify-phase4-source-evidence.mjs --verify-artifact test/fixtures/phase4-gsd-core-source-evidence.json
        status: pass
    human_judgment: false
  - id: D2
    description: Evidence-derived catalog and layered project configuration fixtures
    requirement: PROF-03
    verification:
      - kind: unit
        ref: test/web/phase4-catalog-evidence.test.ts#records the complete source-confirmed profile, phase, and agent catalogs
        status: pass
    human_judgment: false
  - id: D3
    description: Executable runtime near-miss and sensitive sentinel non-disclosure contracts
    requirement: SEC-03
    verification:
      - kind: unit
        ref: test/web/phase4-catalog-evidence.test.ts#covers runtime positives and near misses without a value-bearing diagnostic
        status: pass
    human_judgment: false
metrics:
  duration: 8min
  completed: 2026-07-18
---

# Phase 4 Plan 1: Source Evidence and Catalog Contracts Summary

**Immutable gsd-core evidence gating now grounds Phase 4 catalog fixtures and executable runtime/profile persistence contracts.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-18T23:28:00Z
- **Completed:** 2026-07-18T23:36:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Added a mandatory gate that re-fetches the `next` ref, requires revision `36a311c5bb5fa1a475cfbb685a845cd2d5bf88fe`, retrieves all seven official files, checks SHA-256 digests and anchors, and verifies catalog/profile/runtime claims before accepting artifacts.
- Created source-traceable catalog and layered configuration fixtures, including the five profiles, six phase types, 34-agent catalog, precedence chain, sensitive paths, runtime install matrix, unsupported reviewer-instance disposition, and no-custom-profile-entity persistence contract.
- Added Vitest coverage for live evidence re-verification, descriptor provenance, unsupported-shape preservation, profile persistence, runtime positives/near misses, and secret sentinel non-disclosure.

## Task Commits

1. **Task 1: Retrieve and validate immutable gsd-core source evidence** - `a92f172` (test)
2. **Task 2: Create catalog and layered fixtures only from verified evidence** - `c127c36` (test)
3. **Task 3: Write executable catalog-evidence and runtime matrix contracts** - `34c6a71` (test)

## Files Created/Modified

- `test/scripts/verify-phase4-source-evidence.mjs` - live immutable source retrieval, digest/anchor/catalog validation, artifact writing, and artifact re-verification.
- `test/fixtures/phase4-gsd-core-source-evidence.json` - verified revision, source URL/digest/anchor manifest, descriptor references, and runtime matrix evidence.
- `test/fixtures/phase4-gsd-core-catalog.json` - evidence-derived profiles, phase types, agents, specialized descriptors, persistence shape, and runtime rules.
- `test/fixtures/phase4-specialized-config.json` - layered raw/effective/project-draft candidate with unsupported read-only values and a nonserialized secret sentinel.
- `test/web/phase4-catalog-evidence.test.ts` - executable catalog and evidence contract suite.

## Decisions Made

- Live source equality is required for `--verify-only`, `--write-artifact`, and `--verify-artifact`; cached evidence cannot bypass source drift.
- `review.reviewer_instances` is source-described but remains read-only in the fixture because the current bundled validation schema has no matching shape.
- Copy-first custom project configuration uses ordinary supported project fields and does not create a profile persistence entity.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The full `npm test -- --reporter=dot` suite exceeded the 120-second execution timeout while still running. The targeted Phase 4 evidence suite passed completely (4 tests), and all immutable gate commands passed. No code failure was observed in the partial full-suite output.

## Known Stubs

None. The fixtures intentionally preserve unsupported candidates as read-only evidence-backed data rather than using placeholder editable descriptors.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: source-integrity | `test/scripts/verify-phase4-source-evidence.mjs` | Live immutable revision, digest, and anchor checks prevent stale or fabricated catalog evidence from becoming accepted fixture input. |
| threat_flag: sensitive-fixture-disclosure | `test/web/phase4-catalog-evidence.test.ts` | Assertions explicitly prevent the sentinel API-key-shaped value from entering diagnostics or normal project-draft copy payloads. |

## Next Phase Readiness

Phase 4 downstream plans can consume `phase4-gsd-core-catalog.json` as the only specialized metadata source and use `phase4-specialized-config.json` for project-draft and unsupported-shape behavior. The evidence gate must remain the prerequisite before changing catalog fixtures.

## Self-Check: PASSED

All five plan deliverables and the summary exist, and commits `a92f172`, `c127c36`, `34c6a71`, and `d85afb7` are present in repository history. The targeted evidence suite and all immutable gate modes passed. The full suite reported 13 pre-existing failures unrelated to this plan: missing build artifacts, stale schema completeness entries, and unavailable `tsx` CLI path.

---
*Phase: 04-pool-editors-model-profile-specialization*
*Completed: 2026-07-18*
