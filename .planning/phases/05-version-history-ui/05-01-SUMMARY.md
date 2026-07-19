---
phase: 05-version-history-ui
plan: 01
subsystem: testing
tags: [vitest, fastify, react, json-diff-kit, snapshot-history]
requires:
  - phase: 02-local-loopback-server-cli-security-hardening
    provides: guarded config API and saveWithSnapshot snapshot pipeline
  - phase: 04-pool-editors-model-profile-specialization
    provides: sensitive-value display conventions
provides:
  - Exact structural JSON diff dependency and inspected public API contract
  - Fail-first server/store history and restore safety contracts
  - Fail-first History workspace accessibility and draft lifecycle contracts
affects: [05-version-history-ui, history-api, history-workspace]
tech-stack:
  added: [json-diff-kit@1.0.35]
  patterns: [trusted opaque-id plus canonical-sequence snapshot lookup, Snapshot-to-Current structural diff tests]
key-files:
  created: [test/server/history-routes.test.ts, test/web/history-workspace.test.tsx]
  modified: [package.json, package-lock.json, test/server/snapshot-store.test.ts]
key-decisions:
  - "Use json-diff-kit's Differ with showModifications and LCS arrays; its DiffResult is a readonly tuple of before/after line arrays."
  - "Treat positive canonical safe-integer sequence handling and recovery snapshots as executable security contracts before route implementation."
patterns-established:
  - "History tests exercise real Fastify guards, registry, temporary files, and snapshot roots rather than mocks."
  - "History UI tests assert Snapshot → Current orientation and redact sensitive values before all rendered surfaces."
requirements-completed: [SAVE-05, SAVE-06]
coverage:
  - id: D1
    description: "Audited structural JSON differ dependency with nested/object/array change fixture."
    requirement: SAVE-05
    verification:
      - kind: unit
        ref: "node Differ fixture; npm ls json-diff-kit --depth=0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fail-first guarded per-config history, trusted lookup, and restore-through-save pipeline contract."
    requirement: SAVE-05
    verification:
      - kind: integration
        ref: "test/server/history-routes.test.ts; test/server/snapshot-store.test.ts"
        status: fail
    human_judgment: true
    rationale: "Tests intentionally remain RED until subsequent Phase 5 implementation adds the missing routes and trusted reader."
  - id: D3
    description: "Fail-first History workspace, diff, draft-choice, restore-dialog, and responsive UI contract."
    requirement: SAVE-06
    verification:
      - kind: automated_ui
        ref: "test/web/history-workspace.test.tsx"
        status: fail
    human_judgment: true
    rationale: "Tests intentionally remain RED until subsequent Phase 5 implementation adds the missing History components."
duration: 22min
completed: 2026-07-19
status: complete
---

# Phase 05 Plan 01: History Contracts and Structural Differ Summary

**Pinned structural object diff tooling plus fail-first security, restore, accessibility, and draft-lifecycle contracts for config version history.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-19T11:20:00Z
- **Completed:** 2026-07-19T11:42:00Z
- **Tasks:** 3/3
- **Files modified:** 5

## Accomplishments

- Installed exact `json-diff-kit@1.0.35`; inspected `Differ`, `DiffResult`, and `Viewer` public types, and proved the configured differ produces nested object, array, add, remove, and modification output.
- Added RED server/store contracts for newest-first opaque-ID history, canonical safe sequences, guard enforcement, tamper-safe storage reads, recovery snapshots, and concurrent restore serialization.
- Added RED UI contracts for the dedicated History workspace, Snapshot → Current structural comparison, descriptor-safe redaction, draft resolution, modal keyboard behavior, and responsive states.

## Task Commits

1. **Task 1: Install and inspect the approved structural differ** - `8a2bfc7`, `7a25917` (chore, fix)
2. **Task 2: Author fail-first server and snapshot-store history contracts** - `dc59970` (test)
3. **Task 3: Author fail-first History workspace and restore interaction contracts** - `2d5a401` (test)

## Files Created/Modified

- `package.json` - Pins the approved runtime structural differ exactly.
- `package-lock.json` - Locks the audited `json-diff-kit@1.0.35` dependency graph.
- `test/server/history-routes.test.ts` - API, security, sequence, restore, and concurrency RED contracts.
- `test/server/snapshot-store.test.ts` - Trusted snapshot reader RED contract.
- `test/web/history-workspace.test.tsx` - History UI, diff, redaction, draft, dialog, and responsive RED contract.

## Decisions Made

- Installed `json-diff-kit` as the sole structural comparison dependency. Its `Differ.diff()` returns a readonly `[DiffResult[], DiffResult[]]` tuple with `type`, `text`, and nesting metadata suitable for a project-owned accessible renderer.
- Tests deliberately assert missing Phase 5 symbols and routes, establishing a genuine RED baseline without introducing a text-diff fallback.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Dependency pin] Corrected npm's default caret range to an exact package pin.**
- **Found during:** Task 1
- **Issue:** `npm install json-diff-kit@1.0.35` wrote `^1.0.35`, which violated the plan's explicit exact-pin acceptance criterion.
- **Fix:** Ran `npm install --save-exact json-diff-kit@1.0.35` and committed the lock/package correction.
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `npm ls json-diff-kit --depth=0` reports exactly one `1.0.35` install.
- **Committed in:** `7a25917`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 dependency correction)
**Impact on plan:** Required to meet the exact-version safety requirement; no scope expansion.

## Issues Encountered

- Repository-wide `npm run typecheck` remains pre-existingly red on schema metadata type incompatibilities in Phase 4 source and tests. The dependency import fixture itself succeeds; the issue is outside this plan's files.
- The targeted RED suites fail as intended because Phase 5 routes, trusted reader exports, and History UI components do not exist yet.

## Known Stubs

None. The new files are intentional fail-first test contracts; no production UI or data-source stub was introduced.

## Next Phase Readiness

- Subsequent Phase 5 plans can implement the trusted snapshot reader and guarded history routes against concrete RED server contracts.
- Subsequent UI plans can implement `HistoryWorkspace` and its API wrappers against the specified draft, restore, redaction, and accessibility behavior.

## Self-Check: PASSED

- Required summary and all task commits exist.
