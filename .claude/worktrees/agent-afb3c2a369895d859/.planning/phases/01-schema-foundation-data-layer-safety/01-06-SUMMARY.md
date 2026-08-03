---
phase: 01-schema-foundation-data-layer-safety
plan: 06
subsystem: infra
tags: [typescript, vitest, write-file-atomic, proper-lockfile, atomic-write, config-io, node]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Buildable Node/TypeScript scaffold and the frozen ValidationResult contract in packages/config-io/src/types.ts"
  - phase: 01-03
    provides: "createValidator(schema)/validate(data) — the save-blocking Ajv validator this plan's saveConfig() is dependency-injected with"
provides:
  - "saveConfig(path, obj, validate) — the lock -> validate-block -> atomic-write -> unlock save pipeline (SAVE-01, SAVE-02)"
  - "writeWithRetry(path, content) — write-file-atomic@7 wrapped in an outer EPERM/EBUSY/EACCES Windows retry-with-backoff"
  - "ValidationError — thrown by saveConfig on validation failure, carrying field-level errors, never the config body"
  - "test/stress/kill-mid-save.mjs — standalone repeated-kill atomicity proof, the Windows phase-gate harness"
affects: [01-07, phase-2, phase-3]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ambient .d.ts module declaration (packages/config-io/src/write-file-atomic.d.ts) for a CJS dependency that ships no type declarations at all and has no @types package — narrower and more auditable than a blanket `declare module '*'` or relaxing tsconfig's strict mode"
    - "vi.hoisted() + vi.mock() to intercept a default-exported CJS function (write-file-atomic) for fault injection, rather than wrapping/parameterizing the production function signature just for testability"
    - "Standalone .mjs stress harness that re-invokes itself as a child process via `node --import tsx <self>` (env-var-flagged child-mode branch) so a single file can both orchestrate the kill loop and run the real TypeScript write pipeline with no separate build step"
    - "Stdout marker handshake (child prints a sentinel line immediately before the operation under test) so a parent process's randomized kill-delay timing starts at 'about to do the real work', excluding child-process/loader startup overhead from the timing window"

key-files:
  created:
    - packages/config-io/src/atomic-write.ts
    - packages/config-io/src/write-file-atomic.d.ts
    - test/config-io/atomic-write.test.ts
    - test/stress/kill-mid-save.mjs
  modified: []

key-decisions:
  - "Added packages/config-io/src/write-file-atomic.d.ts, an ambient module declaration not listed in the plan's files_modified — write-file-atomic@7.0.1 ships zero .d.ts files and has no published @types/write-file-atomic package, so a plain `import writeFileAtomic from 'write-file-atomic'` fails `tsc --noEmit` with TS7016 under this project's `strict: true` config (confirmed via isolated repro before writing the real module). Typed narrowly to the actual call surface (default export + .sync, options: fsync/encoding/mode/chown/tmpfileCreated) rather than a blanket `declare module 'write-file-atomic';` any-typed escape hatch."
  - "saveConfig's `validate` parameter is dependency-injected (a `(data: unknown) => ValidationResult` closure) rather than importing Plan 03's createValidator/validate directly — matches the plan's own <action> instruction exactly, keeps atomic-write.ts decoupled from which schema is being enforced, and lets the fault-injection test suite supply pass/fail stubs without compiling a real Ajv schema."
  - "kill-mid-save.mjs uses a stdout marker handshake (child writes 'GSDCM_WRITE_STARTING' immediately before calling saveConfig; parent waits for it before starting the randomized 0-5ms kill-delay countdown) instead of timing the delay from child-process spawn. Benchmarked separately: `node --import tsx` startup + tsx's on-the-fly TS transform of the atomic-write module chain takes on the order of 100s of ms, which would otherwise consume the entire kill-delay window and make every kill land before the child even begins the write — defeating the harness's purpose."

patterns-established:
  - "Pattern: when a pinned CJS dependency ships no .d.ts at all (not even an interop gap like ajv/ajv-formats, but a total absence), add a narrowly-typed ambient .d.ts colocated with the consuming module rather than reaching for @types-package installation (none exists) or a blanket any-typed declare — keeps the exact call surface this project relies on visible and auditable."

requirements-completed: [SAVE-01, SAVE-02]

coverage:
  - id: D1
    description: "saveConfig validates before writing and NEVER calls writeFileAtomic when validation fails (SAVE-01) — no partial write on invalid input; the advisory lock is always released, even on failure"
    requirement: "SAVE-01"
    verification:
      - kind: unit
        ref: "test/config-io/atomic-write.test.ts#does NOT call writeFileAtomic when validation fails, and the on-disk file is byte-unchanged"
        status: pass
      - kind: unit
        ref: "test/config-io/atomic-write.test.ts#ValidationError carries the field-level errors from the validator"
        status: pass
      - kind: unit
        ref: "test/config-io/atomic-write.test.ts#releases the advisory lock on the validation-failure path (a subsequent save on the same path succeeds)"
        status: pass
      - kind: unit
        ref: "test/config-io/atomic-write.test.ts#releases the advisory lock even when writeWithRetry ultimately throws"
        status: pass
    human_judgment: false
  - id: D2
    description: "The write goes through write-file-atomic@7 (temp-in-same-dir -> fsync -> rename) wrapped in an outer EPERM/EBUSY/EACCES retry-with-backoff, filling write-file-atomic's known unpatched Windows gap (SAVE-02); non-retryable codes rethrow immediately and a successful write round-trips to the original object"
    requirement: "SAVE-02"
    verification:
      - kind: unit
        ref: "test/config-io/atomic-write.test.ts#retries transient EPERM/EBUSY/EACCES and eventually succeeds"
        status: pass
      - kind: unit
        ref: "test/config-io/atomic-write.test.ts#rethrows a non-retryable error code (e.g. EINVAL) immediately, with no retry"
        status: pass
      - kind: unit
        ref: "test/config-io/atomic-write.test.ts#gives up after MAX_ATTEMPTS retryable failures and rethrows the last error"
        status: pass
      - kind: unit
        ref: "test/config-io/atomic-write.test.ts#writes JSON.stringify(obj, null, 2) and the file round-trips to obj"
        status: pass
    human_judgment: false
  - id: D3
    description: "Killing the write process mid-save always leaves config.json fully old or fully new content — never truncated/corrupt (success criterion #4), proven by a repeated-kill stress harness"
    requirement: "SAVE-02"
    verification:
      - kind: other
        ref: "node test/stress/kill-mid-save.mjs 8 (8/8 passed, exit 0, this session's dev machine)"
        status: pass
    human_judgment: true
    rationale: "01-VALIDATION.md § Manual-Only Verifications explicitly designates this harness as a phase-gate item requiring a run on the actual Windows target before the phase gate, not just this execution session's dev-machine run — the harness itself is automated and green, but the requirement calls for a human-confirmed run on the real target platform."

duration: 9min
completed: 2026-07-12
status: complete
---

# Phase 1 Plan 6: Corruption-Proof Write Pipeline & Kill-Mid-Save Stress Harness Summary

**`saveConfig()` lock->validate-block->atomic-write->unlock pipeline (write-file-atomic@7 + an outer Windows EPERM/EBUSY/EACCES retry-with-backoff wrapping the library's known-unpatched rename gap), proven by fault-injection unit tests and a standalone repeated-SIGKILL stress harness that never observed a truncated file.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-12T14:24:17+03:00
- **Completed:** 2026-07-12T14:33:28+03:00
- **Tasks:** 2 completed
- **Files modified:** 4 created (atomic-write.ts, write-file-atomic.d.ts, atomic-write.test.ts, kill-mid-save.mjs)

## Accomplishments
- Built `packages/config-io/src/atomic-write.ts`: `writeWithRetry(path, content)` wraps `write-file-atomic@7.0.1` in an outer retry loop (`MAX_ATTEMPTS=5`, `BASE_DELAY_MS=50`, exponential backoff) that retries only `EPERM`/`EBUSY`/`EACCES` and rethrows any other code immediately — filling a real, currently-open gap in the pinned dependency (GitHub issue #227, no built-in Windows rename retry). `saveConfig(path, obj, validate)` acquires a `proper-lockfile` advisory lock, calls the injected `validate(obj)`, throws `ValidationError` (never touching `writeFileAtomic`) when validation fails, otherwise writes `JSON.stringify(obj, null, 2)` via `writeWithRetry`, and always releases the lock in `finally`.
- Diagnosed and fixed a real `tsc --noEmit` blocker before either implementation could satisfy its own acceptance criteria: `write-file-atomic@7.0.1` ships zero `.d.ts` files and has no `@types` package, so the plain default import fails with TS7016 under this project's `strict: true` config — added a narrowly-typed ambient declaration (`packages/config-io/src/write-file-atomic.d.ts`) rather than a blanket any-typed escape hatch.
- Wrote 10 fault-injection/behavioral unit tests in `test/config-io/atomic-write.test.ts` (mocking `write-file-atomic`'s default export via `vi.hoisted`/`vi.mock`) covering: retry-then-succeed, immediate-rethrow-on-non-retryable-code, `MAX_ATTEMPTS` exhaustion, validation-blocks-write with byte-unchanged file, `ValidationError` field-error contents, lock release on both the validation-failure and write-failure paths, and a full write round-trip.
- Built `test/stress/kill-mid-save.mjs`, a standalone script (excluded from the default `vitest run` — `vitest.config.ts`'s `test.include` only matches `test/**/*.test.ts`) that repeats N times (default 20, `argv[2]`-overridable): seeds a temp target file with a known "old" JSON payload, spawns a child process (the same file re-invoked via `node --import tsx` so it can import the real TypeScript `saveConfig()` pipeline directly with no build step), waits for a stdout marker the child prints immediately before calling `saveConfig` on a large (~400KB) "new" payload, then `SIGKILL`s the child after a randomized 0-5ms delay and asserts the target file always `JSON.parse`s and deep-equals exactly the old or the new payload. Verified with `node test/stress/kill-mid-save.mjs 8`: 8/8 passed, exit 0.
- Full project suite (7 test files, 57 tests) and `tsc --noEmit` both pass cleanly after both tasks.

## Task Commits

Each task was committed atomically:

1. **Task 1: saveConfig — lock → validate-block → atomic write → Windows retry (SAVE-02, SAVE-01)** - `12ecca0` (feat)
2. **Task 2: Standalone kill-mid-save stress harness (SAVE-02, success criterion #4)** - `a68c753` (test)

**Plan metadata:** (final docs commit follows this summary)

## Files Created/Modified
- `packages/config-io/src/atomic-write.ts` - `writeWithRetry(path, content)`, `saveConfig(path, obj, validate)`, `ValidationError`, `RETRYABLE_CODES`, `MAX_ATTEMPTS`, `BASE_DELAY_MS` — the corruption-proof, validation-blocking write pipeline
- `packages/config-io/src/write-file-atomic.d.ts` - ambient module declaration for `write-file-atomic@7.0.1` (no bundled/published types exist), typed to the default export + `.sync` + the options actually used
- `test/config-io/atomic-write.test.ts` - 10 tests: retry/rethrow/exhaustion, validation-blocks-write, lock-release on both failure paths, successful round-trip
- `test/stress/kill-mid-save.mjs` - standalone repeated-`SIGKILL` atomicity harness (Windows phase-gate item per 01-VALIDATION.md)

## Decisions Made
- See `key-decisions` in frontmatter: the ambient `write-file-atomic.d.ts` type-checking fix, dependency-injecting `validate` into `saveConfig`, and the stdout-marker handshake used by the stress harness to time kills relative to the actual write rather than child-process spawn.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added an ambient `.d.ts` declaration for `write-file-atomic`, not listed in the plan's `files_modified`**
- **Found during:** Task 1, while confirming `npx tsc --noEmit` would pass per the plan's own acceptance criteria and this project's established typecheck gate (per 01-01-SUMMARY.md/01-03-SUMMARY.md precedent)
- **Issue:** `write-file-atomic@7.0.1` ships as plain CommonJS with zero `.d.ts` files anywhere in the package and has no published `@types/write-file-atomic` package (confirmed by inspecting `node_modules/write-file-atomic` directly — no `.d.ts` under `lib/`). A plain `import writeFileAtomic from 'write-file-atomic'` fails `tsc --noEmit` with `TS7016: Could not find a declaration file for module 'write-file-atomic'` under this project's `strict: true` tsconfig, reproduced in isolation before touching the real source file.
- **Fix:** Added `packages/config-io/src/write-file-atomic.d.ts`, a narrowly-typed ambient module declaration covering exactly the call surface this project uses (default export function signature with `fsync`/`encoding`/`mode`/`chown`/`tmpfileCreated` options, plus the `.sync` variant) — verified in isolation to both resolve `tsc --noEmit` cleanly and remain runtime-transparent (ambient `.d.ts` files have zero runtime effect).
- **Files modified:** `packages/config-io/src/write-file-atomic.d.ts` (new file)
- **Verification:** `npx tsc --noEmit` exits 0 across the whole project; `npx vitest run test/config-io/atomic-write.test.ts` passes 10/10.
- **Committed in:** `12ecca0` (Task 1 feat commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Purely a TypeScript declaration-file gap for a dependency that ships no types at all — the write pipeline's actual runtime behavior (lock → validate-block → write-file-atomic with fsync → outer Windows retry → unlock) matches 01-RESEARCH.md's Decision: Atomic-Write Mechanics exactly. No scope creep.

## Issues Encountered
- Initial 0-5ms kill-delay window (as specified in the plan's `<action>` text: "a randomized sub-millisecond-to-few-millisecond delay") mostly lands kills before the ~30ms real `saveConfig()` operation (lock acquire + `JSON.stringify` of a large payload + `writeFileAtomic` with `fsync` + release) completes, so most iterations observe the file as "old" rather than exercising a mix of "old"/"new" outcomes. Diagnosed via a throwaway widened-window copy of the script (not committed) confirming both "old" and "new" outcomes are reachable and no corruption occurs at any point in the operation — the shipped harness keeps the plan's literally-specified 0-5ms delay, which still meaningfully exercises the earliest/most-contended phase of the pipeline (lock acquisition through the start of the temp-file write) with zero corruption observed across all diagnostic and verification runs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `saveConfig()`/`writeWithRetry()`/`ValidationError` in `packages/config-io/src/atomic-write.ts` are ready for Plan 07 (round-trip-identity tests) and Phase 2 (loopback server) to import as the sole sanctioned write path — the server will pass Plan 03's real `createValidator(bundledSchema)`-produced closure as the `validate` argument.
- `test/stress/kill-mid-save.mjs` is checked in and green on this session's dev machine (`node test/stress/kill-mid-save.mjs 8`: 8/8 passed). Per 01-VALIDATION.md § Manual-Only Verifications, this harness still needs a confirmed run on the actual Windows phase-gate target before `/gsd-verify-work` signs off the phase — flagged as `human_judgment: true` in this summary's coverage block (D3) rather than silently auto-passed.
- No blockers for Plan 07 (round-trip-identity + schema-completeness tests, the final Wave 4 plan).

---
*Phase: 01-schema-foundation-data-layer-safety*
*Completed: 2026-07-12*

## Self-Check: PASSED

All 4 created files verified present on disk (atomic-write.ts, write-file-atomic.d.ts, atomic-write.test.ts, kill-mid-save.mjs). Both task commit hashes (12ecca0, a68c753) verified present in git log.
