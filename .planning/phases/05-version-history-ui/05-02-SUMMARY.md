---
phase: 05-version-history-ui
plan: 02
subsystem: server-history-api
tags: [fastify, snapshot-store, restore, sha256, security]
requires:
  - phase: 02-local-loopback-server-cli-security-hardening
    provides: opaque config registry, guarded API scope, and safe snapshot write pipeline
  - plan: 05-01
    provides: RED history and trusted-reader contracts
provides:
  - Verified sequence-based snapshot reader with safe metadata projection
  - Guarded per-config history list, detail, and recoverable restore endpoints
  - Restore through the existing validation, locking, atomic-write, and snapshot pipeline
affects: [history-api, version-history-ui, SAVE-05, SAVE-06]
tech-stack:
  added: []
  patterns: [opaque-id-plus-canonical-sequence, validated-index-and-hash-read, restore-as-normal-save]
key-files:
  created: [packages/server/src/routes/history.ts]
  modified: [packages/server/src/snapshot-store/index.ts, packages/server/src/api-types.ts, packages/server/src/app.ts, test/server/history-routes.test.ts]
decisions:
  - "History selection accepts only positive safe-integer canonical decimal sequences and derives snapshot locations from resolved tracked config paths."
  - "History detail returns parsed persisted project documents; restore retains raw parsed content only at the saveWithSnapshot boundary."
  - "Malformed index metadata and hash or JSON failures return static path-free errors rather than exposing storage details."
metrics:
  duration: 17min
  completed: 2026-07-19
  tasks: 2
  files: 5
status: complete
---

# Phase 05 Plan 02: Trusted History API Summary

**Secure opaque-ID history browsing and recoverable restore backed by hash-verified indexed snapshots and the ordinary safe-save pipeline.**

## Performance

- **Duration:** 17 min
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- Added a trusted `readSnapshotBySequence()` reader that validates every index entry, sequence, canonical filename, ISO timestamp, lowercase SHA-256 hash, and snapshot bytes before parsing JSON.
- Changed history listing to expose a defensive newest-first metadata projection with no on-disk snapshot filename or path.
- Added guarded list, detail, and restore routes inside the existing `/api` Host, Origin, and token protections.
- Kept restore recoverable by parsing the selected document and passing it exclusively to `saveWithSnapshot()`, which validates, serializes concurrent writes, atomically replaces content, and records the pre-restore recovery snapshot.

## Task Commits

1. **Task 1: Implement trusted sequence-based snapshot access** — `9e6769a` (`feat`)
2. **Task 2: Add guarded list, detail, and restore routes** — `861c7dd` (`feat`)

## Files Created/Modified

- `packages/server/src/snapshot-store/index.ts` — trusted read-by-sequence, typed static failures, safe metadata projection, and hash verification.
- `packages/server/src/api-types.ts` — additive history metadata, detail, and restore result contracts.
- `packages/server/src/routes/history.ts` — opaque-ID guarded history list, detail, and restore handlers.
- `packages/server/src/app.ts` — registers history routes inside the guarded `/api` plugin.
- `test/server/history-routes.test.ts` — restores through the pretty-printing safe-save pipeline using semantic JSON assertions.

## Decisions Made

- Snapshot files are selected only by a canonical positive safe-integer sequence after server-side opaque-ID resolution; a browser cannot provide a filename or directory.
- Any malformed metadata, duplicate sequence, noncanonical filename, hash mismatch, invalid JSON, or inaccessible indexed snapshot is classified with a static response that reveals neither content nor filesystem location.
- Detail returns current on-disk parsed project JSON rather than merged effective configuration or editor draft data.

## Verification

- `npm test -- --run test/server/snapshot-store.test.ts` — passed (10 tests).
- `npm test -- --run test/server/history-routes.test.ts test/server/snapshot-store.test.ts test/server/security.test.ts` — passed (27 tests).
- `npx tsc --noEmit` — passed.
- `npm run typecheck` remains blocked by pre-existing Phase 4 schema type incompatibilities and the still-unimplemented Phase 5 History UI RED test module; the server source compile gate passes independently.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test contract] Corrected restore assertions to compare persisted JSON semantics rather than serialization whitespace.**
- **Found during:** Task 2
- **Issue:** `saveWithSnapshot()` uses the established atomic writer’s pretty-printed serialization, so a byte-for-byte assertion against a compact fixture falsely failed even though the restored persisted project document was exact.
- **Fix:** Changed the route contract to compare parsed JSON for both the restored document and recovery snapshot content.
- **Files modified:** `test/server/history-routes.test.ts`
- **Commit:** `861c7dd`

## Known Stubs

None. The raw snapshot document is deliberately retained only inside the server restore/detail execution path and is not a UI placeholder or unwired data source.

## Threat Surface Scan

No new unplanned security surface. The new endpoints are registered beneath the existing `/api` Host, Origin, and token guards; the plan’s filesystem, restore, and disclosure mitigations are implemented in the new reader and route layer.

## Self-Check: PASSED

- Required trusted-reader and guarded-route source files exist.
- Both task commits (`9e6769a`, `861c7dd`) exist in git history.
- The canonical summary file exists at the planned phase path.
