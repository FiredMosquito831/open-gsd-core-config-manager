---
phase: 06-live-schema-reconcile-against-gsd-core
plan: 06
subsystem: server-schema-refresh
tags: [typescript, github-api, sha256, inert-parsing, schema-reconciliation]
requires:
  - phase: 06-02
    provides: Pure canonical schema reconciliation and semantic diff contracts
  - phase: 06-05
    provides: Bounded archive inspection and inert source/documentation parsers
provides:
  - Fixed latest-stable release acquisition resolved to a commit-pinned archive
  - Compiled, opaque, expiring server-held schema proposals with cancellation and no-op status
  - Static fail-closed refresh results with no active schema activation path
affects: [06-07, schema-routes, schema-workspace]
tech-stack:
  added: []
  patterns: [fixed-upstream transaction, inert proposal-before-activation, release-on-cancel-or-supersession]
key-files:
  created:
    - packages/server/src/schema-refresh-service.ts
    - test/server/schema-refresh.test.ts
  modified: []
key-decisions:
  - "Refresh hardcodes open-gsd/gsd-core latest-stable, tag, and commit-pinned archive endpoints; callers cannot select source identity."
  - "Only successfully reconciled and compiled candidates are retained as five-minute opaque proposals; this service never invokes activation."
  - "Documentation fingerprints and unavailable diagnostics remain evidence only, preserving curated descriptor prose."
patterns-established:
  - "A refresh stage returns only proposal, no-change, or static safe failure; source bytes are not retained beyond parsed proposal evidence."
requirements-completed: [SCHEMA-05]
coverage:
  - id: D1
    description: Fixed latest-stable acquisition resolves release tags through bounded immutable commit dereference and fetches a commit-pinned archive.
    requirement: SCHEMA-05
    verification:
      - kind: unit
        ref: test/server/schema-refresh.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Archive, parser, identity, reconciliation, and compile failures are fail-closed and leave no retained proposal or active-schema mutation.
    requirement: SCHEMA-05
    verification:
      - kind: unit
        ref: test/server/schema-refresh.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Documentation fingerprints and unavailable diagnostics reach proposal evidence without replacing curated descriptions.
    requirement: SCHEMA-05
    verification:
      - kind: unit
        ref: test/server/schema-refresh.test.ts
        status: pass
    human_judgment: false
metrics:
  duration: "16 min"
  completed_date: "2026-07-20"
status: complete
---

# Phase 06 Plan 06: Fixed Latest-Stable Proposal Transaction Summary

Fixed-source GitHub acquisition now prepares commit-pinned, SHA-256-traceable, inert schema proposals from bounded parsed evidence without any remote-code execution or active-schema mutation.

## Performance

- **Duration:** 16 min
- **Started:** 2026-07-20T21:44:00Z
- **Completed:** 2026-07-20T22:00:00Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- Added a single-flight staged refresh service that owns official latest-release/tag/commit/archive paths and validates stable release identity before content acquisition.
- Wired the Plan 06-05 archive, AST registry, and documentation-evidence boundaries into Plan 06-02 reconciliation and Ajv compilation.
- Added opaque five-minute proposals, no-change last-checked results, matching-ID cancellation, supersession, expiry, source-byte disposal, and static client-safe failure mapping.
- Proved release, tag, parser, archive, identity conflict, compile, documentation, no-op, cancellation, and expiry behavior using entirely frozen fixtures.

## Task Commits

1. **Task 1: Freeze fixed acquisition, documentation wiring, and proposal lifecycle** — `5595e30` (test)
2. **Task 2: Implement the fixed latest-stable proposal transaction** — `f5fee9d` (feat)

## Files Created/Modified

- `packages/server/src/schema-refresh-service.ts` — fixed upstream acquisition, inert parsing/reconciliation transaction, safe results, and proposal lifecycle.
- `test/server/schema-refresh.test.ts` — fixture-backed transaction tests covering pinned identity, failure closure, documentation evidence, and lifecycle behavior.

## Verification

- PASS — `npx vitest run test/server/schema-refresh.test.ts test/server/upstream-archive.test.ts test/server/capability-registry-parser.test.ts test/server/documentation-evidence-parser.test.ts test/schema-data/reconcile.test.ts` (54 tests)
- PASS — `npx tsc --noEmit`
- BLOCKED (pre-existing) — `npm run typecheck` reaches the pre-existing `test/web/phase4-catalog-evidence.test.ts` Node typings errors in `tsconfig.web.json`; server/schema typecheck passed.

## Decisions Made

- Release identity is accepted only from GitHub's fixed latest endpoint when it is a stable semver tag, then resolved to a bounded immutable commit before archive retrieval.
- Equal version text with different active immutable commit is a safe identity failure rather than a candidate proposal.
- Proposals are deliberately inert; later guarded route work must explicitly consume the retained proposal and call the active manager.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The plan's `-x` Vitest option is unsupported by installed Vitest 4.1.10, so equivalent focused commands ran without it.
- `npm run typecheck` remains blocked by unrelated pre-existing web test Node typing configuration, as recorded by prior Phase 6 summaries.

## Known Stubs

None.

## Next Phase Readiness

- Plan 06-07 can expose this service only through the existing guarded API boundary, providing active-manager snapshots and immutable local overlays through dependency injection.
- Activation remains intentionally absent here, preserving the D-09 review-before-activation boundary.

## Self-Check: PASSED

- Confirmed `packages/server/src/schema-refresh-service.ts` and `test/server/schema-refresh.test.ts` exist.
- Confirmed task commits `5595e30` and `f5fee9d` exist in git history.

---
*Phase: 06-live-schema-reconcile-against-gsd-core*
*Completed: 2026-07-20*
