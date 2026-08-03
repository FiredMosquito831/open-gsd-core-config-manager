---
phase: 02-local-loopback-server-cli-security-hardening
plan: 02
subsystem: infra
tags: [snapshot-store, env-paths, sha256, saveConfig, proper-lockfile, vitest]

# Dependency graph
requires:
  - phase: 01-schema-foundation-data-layer-safety
    provides: "packages/config-io's frozen saveConfig/ValidationError/types (saved-config pipeline this plan composes, never modifies)"
  - phase: 02-local-loopback-server-cli-security-hardening
    provides: "02-01: Phase 2 dependency set installed (env-paths@4.0.0) at exact pinned versions"
provides:
  - "packages/server/src/snapshot-store/{paths,index,save-with-snapshot}.ts — the complete SAVE-04 mechanism"
  - "On-disk snapshot format (index.json seq/timestamp/contentHash + <seq>.json full-content files) that Phase 5's version-history UI will consume"
  - "saveWithSnapshot() as the frozen server-layer save envelope Plan 05's PUT /api/configs/:id route returns directly, and Phase 5's revert re-enters through"
affects: ["02-local-loopback-server-cli-security-hardening plan 05 (REST routes call saveWithSnapshot)", "Phase 5 (version-history browse/diff/revert builds on the index.json format frozen here)"]

# Tech tracking
tech-stack:
  added: []
  patterns: ["injectable app-data root parameter (mirrors discovery.ts's injectable env) instead of mocking env-paths", "one clearly-scoped try/catch per concern (saveConfig failure propagates, recordSnapshot failure is swallowed into a warning) mirroring atomic-write.ts's lock/finally isolation"]

key-files:
  created:
    - packages/server/src/snapshot-store/paths.ts
    - packages/server/src/snapshot-store/index.ts
    - packages/server/src/snapshot-store/save-with-snapshot.ts
    - test/server/snapshot-store.test.ts
  modified: []

key-decisions:
  - "D-07/D-08/D-09 implemented exactly as researched: env-paths({suffix:''}).data root, sha256(resolve(configPath)) path-hashed subfolder, full-JSON <seq>.json snapshots, index.json entries carrying seq+timestamp+contentHash+file"
  - "D-10/D-11/D-12 implemented exactly as researched: saveWithSnapshot reads prior content -> calls frozen saveConfig -> records snapshot in an isolated try/catch that degrades to a non-fatal warning on failure, using the exact 02-UI-SPEC.md warning copy"
  - "[Rule 3 - blocking issue, scoped to save-with-snapshot.ts only] proper-lockfile's lock() (called inside the frozen saveConfig) defaults to realpath:true and therefore requires the target file to already exist before it can create the sibling .lock directory — it cannot lock a brand-new, never-written path. Fixed by pre-touching an empty stub file (fs.writeFile with flag:'wx') strictly AFTER priorContent has already been captured as null, so D-11's snapshot-skip guarantee is unaffected and saveConfig's own validate->write pipeline still runs unmodified against the real target path. packages/config-io/ was not touched."
  - "Fixed the Task 1 test's own import path during Task 2: snapshotDirFor is exported from paths.ts (per the plan's own export split), not index.ts as the test first (incorrectly) imported it from — corrected before Task 2's implementation"

patterns-established:
  - "Snapshot-store service pattern: pure path-resolution (paths.ts) separated from index-file I/O (index.ts) separated from orchestration (save-with-snapshot.ts) — each independently testable, later phases (Phase 5 revert) reuse the same three-file seam"

requirements-completed: [SAVE-04]

coverage:
  - id: D1
    description: "Every successful save of an existing config writes a full-JSON pre-write snapshot plus a seq/timestamp/contentHash index.json entry into the OS app-data directory"
    requirement: "SAVE-04"
    verification:
      - kind: unit
        ref: "test/server/snapshot-store.test.ts#records snapshot before overwrite"
        status: pass
      - kind: unit
        ref: "test/server/snapshot-store.test.ts#second save increments seq"
        status: pass
    human_judgment: false
  - id: D2
    description: "The snapshot directory is never inside the tracked project directory or its .git — resolved exclusively under env-paths' app-data root, keyed by sha256 of the config's absolute path"
    requirement: "SAVE-04"
    verification:
      - kind: unit
        ref: "test/server/snapshot-store.test.ts#snapshot is stored outside the tracked project directory"
        status: pass
    human_judgment: false
  - id: D3
    description: "The first-ever save of a brand-new config file records no snapshot and creates no phantom index entry — the save still succeeds"
    requirement: "SAVE-04"
    verification:
      - kind: unit
        ref: "test/server/snapshot-store.test.ts#skips snapshot on first save"
        status: pass
    human_judgment: false
  - id: D4
    description: "A snapshot-recording failure never fails the save: the write commits, saveWithSnapshot returns ok with a warning, and the warning text never contains config content"
    requirement: "SAVE-04"
    verification:
      - kind: unit
        ref: "test/server/snapshot-store.test.ts#save succeeds even if snapshot recording fails"
        status: pass
    human_judgment: false
  - id: D5
    description: "Phase 1's packages/config-io is composed, never modified — saveWithSnapshot imports saveConfig unchanged, and a validation failure still blocks the write and records no snapshot"
    requirement: "SAVE-04"
    verification:
      - kind: unit
        ref: "test/server/snapshot-store.test.ts#validation failure blocks the write and records no snapshot"
        status: pass
      - kind: other
        ref: "git diff --name-only -- packages/config-io/ (empty output)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-12
status: complete
---

# Phase 02 Plan 02: Snapshot Store & saveWithSnapshot Summary

**Filesystem snapshot store (app-data-rooted, sha256 path-hashed, seq/timestamp/contentHash index) plus a `saveWithSnapshot()` wrapper that composes Phase 1's frozen `saveConfig` — the complete SAVE-04 mechanism, all six behaviors green.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-12T20:45:53Z
- **Tasks:** 3 (1 TDD-style RED test task, 2 implementation tasks)
- **Files modified:** 4 (3 created source files, 1 created test file)

## Accomplishments

- Built `packages/server/src/snapshot-store/paths.ts`: `appDataRoot()` (env-paths with empty suffix) and `snapshotDirFor(configPath, root?)` (sha256 of the absolute config path, injectable app-data root).
- Built `packages/server/src/snapshot-store/index.ts`: `SnapshotIndexEntry`/`SnapshotIndex` types, `readIndex` (empty on ENOENT, throws on malformed JSON rather than silently resetting history), `recordSnapshot` (D-11 skip on null prior content; full-JSON `<seq>.json` + `index.json` append on success), `listSnapshots`.
- Built `packages/server/src/snapshot-store/save-with-snapshot.ts`: `saveWithSnapshot()` orchestrating read-prior-content -> frozen `saveConfig` -> best-effort snapshot record, with the D-12 non-fatal-warning path using the exact 02-UI-SPEC.md copy ("Saved successfully, but history was not recorded...").
- Wrote `test/server/snapshot-store.test.ts` covering all six SAVE-04 behaviors named in the plan verbatim, against real temp-dir filesystems and the real Phase 1 `saveConfig` — no `env-paths` mocking, app-data root redirected purely via the injectable `root` parameter.
- All six behaviors pass; `npm test` reports 71/71 (Phase 1's 65 plus this plan's 6 new); `npx tsc --noEmit` exits 0; `git diff --name-only -- packages/config-io/` is empty.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the failing snapshot-store test suite (SAVE-04 / D-10 / D-11 / D-12)** - `bb273c2` (test)
2. **Task 2: Implement the snapshot store — app-data path resolution and the seq/timestamp/hash index (D-07, D-08, D-09)** - `7853f81` (feat)
3. **Task 3: Implement saveWithSnapshot() — compose the frozen saveConfig, pre-write snapshot, non-fatal history (D-10, D-11, D-12)** - `f052d90` (feat)

_TDD note: Task 1 produced a genuine RED state (import errors — modules under test did not exist); Tasks 2-3 are the GREEN implementation, verified by the full six-behavior passing suite in Task 3's commit._

## Files Created/Modified

- `test/server/snapshot-store.test.ts` - Six-behavior SAVE-04 test suite (pre-write snapshot, first-save skip, non-fatal recorder failure, project-directory isolation, seq increment, validation-blocks-write)
- `packages/server/src/snapshot-store/paths.ts` - `appDataRoot()`, `snapshotDirFor(configPath, root?)`
- `packages/server/src/snapshot-store/index.ts` - `SnapshotIndexEntry`, `SnapshotIndex`, `readIndex`, `recordSnapshot`, `listSnapshots`
- `packages/server/src/snapshot-store/save-with-snapshot.ts` - `SaveResult`, `SaveDeps`, `saveWithSnapshot`

## Decisions Made

- Implemented D-07 through D-12 exactly per 02-CONTEXT.md and 02-RESEARCH.md § Pattern 6/7 — no deviation from the researched design for the snapshot format or orchestration order.
- [Rule 3 — blocking issue] Discovered that Phase 1's frozen `saveConfig` cannot lock a path that has never been written: `proper-lockfile`'s `lock()` defaults to `realpath: true`, which `lstat`s/resolves the target file before it can create the sibling `.lock` directory, so it throws `ENOENT` on a genuinely new file. Fixed entirely within `save-with-snapshot.ts` (not `config-io`) by pre-touching an empty stub file via `fs.writeFile(configPath, '', { flag: 'wx' })` immediately after `priorContent` is captured as `null` on the initial read — this preserves D-11's snapshot-skip guarantee (the prior-content variable was already `null` before the stub existed) while letting `saveConfig`'s own validate -> atomic-write pipeline run completely unmodified against the real target path.
- Corrected an authoring mistake in Task 1's own test file during Task 2: `snapshotDirFor` is exported from `paths.ts` per the plan's own file/export split, not `index.ts` — the test's import was fixed before Task 2's acceptance criteria were checked (this is a same-plan correction of a self-authored test, not a scope change).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] proper-lockfile cannot lock a nonexistent file — brand-new config saves would otherwise fail entirely**
- **Found during:** Task 3 (implementing `saveWithSnapshot`)
- **Issue:** Calling the frozen `saveConfig` against a path that has never been written throws `ENOENT` from `proper-lockfile`'s `lock()` (it `lstat`s/resolves the target before creating the `.lock` sibling directory) — the "skips snapshot on first save" behavior could not otherwise succeed, since `saveConfig` itself would reject the brand-new-file case.
- **Fix:** In `save-with-snapshot.ts` only, after the initial `readFile` throws `ENOENT` and `priorContent` is set to `null`, pre-touch an empty stub file with `fs.writeFile(configPath, '', { flag: 'wx' })` (ignoring a racing `EEXIST`) before calling `saveConfig`. `packages/config-io/` is untouched — verified by `git diff --name-only -- packages/config-io/` being empty.
- **Files modified:** `packages/server/src/snapshot-store/save-with-snapshot.ts`
- **Verification:** `test/server/snapshot-store.test.ts#skips snapshot on first save` passes; full suite green; `npx tsc --noEmit` exits 0.
- **Committed in:** `f052d90` (part of Task 3's commit)

---

**Total deviations:** 1 auto-fixed (Rule 3, blocking issue)
**Impact on plan:** Necessary for correctness — without this fix the D-11 "first-ever save skips gracefully" requirement (an explicit must-have truth in the plan frontmatter) could not be satisfied at all, since the frozen `saveConfig` has no path for creating a file that doesn't yet exist. No scope creep: the fix is fully contained inside the new wrapper file and does not touch, extend, or reinterpret the frozen `config-io` contract.

## Issues Encountered

None beyond the Rule 3 fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05 (REST API routes) can import `saveWithSnapshot` from `packages/server/src/snapshot-store/save-with-snapshot.js` directly and return its `SaveResult` as the `PUT /api/configs/:id` response envelope unchanged.
- Plan 05 can also import `listSnapshots` for a read-only `GET /api/snapshots/:configId` route (Phase 2 scope per the plan: list only, no HTTP route added in this plan).
- Phase 5's version-history UI (browse/diff/revert) can build directly against the frozen `index.json` format (`seq`, `timestamp`, `contentHash`, `file`) and must re-enter through this same `saveWithSnapshot` for revert (D-10: revert-as-write, no special-case path).
- No blockers. `packages/server/src/snapshot-store/` is otherwise self-contained; no other Phase 2 plan's files were touched.

---
*Phase: 02-local-loopback-server-cli-security-hardening*
*Completed: 2026-07-12*

## Self-Check: PASSED

- FOUND: packages/server/src/snapshot-store/paths.ts
- FOUND: packages/server/src/snapshot-store/index.ts
- FOUND: packages/server/src/snapshot-store/save-with-snapshot.ts
- FOUND: test/server/snapshot-store.test.ts
- FOUND: .planning/phases/02-local-loopback-server-cli-security-hardening/02-02-SUMMARY.md
- FOUND commit: bb273c2
- FOUND commit: 7853f81
- FOUND commit: f052d90
- FOUND commit: 0b180a8
