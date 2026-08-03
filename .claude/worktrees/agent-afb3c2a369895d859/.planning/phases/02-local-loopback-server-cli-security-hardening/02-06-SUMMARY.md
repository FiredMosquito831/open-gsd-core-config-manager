---
phase: 02-local-loopback-server-cli-security-hardening
plan: 06
subsystem: cli
tags: [commander, fastify, open, cli, signals, ansi, terminal-ux, tsx, esm]

# Dependency graph
requires:
  - phase: 02-local-loopback-server-cli-security-hardening
    provides: "02-04: buildApp({ ctx, clientRoot, warn }) / createLaunchContext / sealLaunchContext (packages/server/src/app.ts, context.ts) — the composition root and security context this plan's bootstrap() drives through listen()"
  - phase: 02-local-loopback-server-cli-security-hardening
    provides: "02-05: BuildAppOptions.warn sink and the registered /api/configs routes this plan's bootstrap() wires the D-12 snapshot warning into"
provides:
  - "packages/cli/src/output.ts — createOutput(stream, env): OutputPort, the 02-UI-SPEC.md hand-written ANSI/Unicode terminal copy contract with an ASCII/no-color degrade rule"
  - "packages/cli/src/bootstrap.ts — bootstrap(opts, deps): createLaunchContext -> buildApp -> ephemeral listen(127.0.0.1) -> port readback -> sealLaunchContext -> banner -> open()/--no-open, plus an awaited shutdown() and registerSignalHandlers()"
  - "packages/cli/src/{cli.ts,cli-main.ts} — the Commander 15 `bin` entry (--port, --no-open only; no --scan) split into a synchronous require-shim + dynamically-imported logic, working around a Node/tsx ESM interaction with config-io's frozen import-equals syntax"
  - "test/server/cli-launch.test.ts, test/server/teardown.test.ts — the 9 DIST-01/DIST-02/DIST-04 spawned-process + in-process regression behaviors"
affects: ["02-local-loopback-server-cli-security-hardening plan 07 (packaging/tsup must bundle cli.ts + cli-main.ts together and preserve the shebang; the built artifact should re-verify the same require-shim ordering holds under tsup's esbuild bundling, not just tsx)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "createOutput(stream, env) factory with injected stream/env, mirroring resolveGlobalDefaultsPath(env)'s injectable-parameter shape, so terminal copy is unit-testable without mocking process.stdout"
    - "bootstrap()/shutdown() mirrors atomic-write.ts's acquire -> use -> release-in-finally discipline: listen() acquires the socket, shutdown() always awaits app.close() (never fire-and-forget), with a re-entrancy flag and an unref'd 5s force-exit safety net"
    - "cli.ts split into a thin shim (require-shim, dynamic import only) + cli-main.ts (the actual Commander/bootstrap logic) so the shim itself contains neither top-level await nor require() syntax, avoiding a Node/tsx module-format-ambiguity trip"

key-files:
  created:
    - packages/cli/src/output.ts
    - packages/cli/src/bootstrap.ts
    - packages/cli/src/cli.ts
    - packages/cli/src/cli-main.ts
    - test/server/cli-launch.test.ts
    - test/server/teardown.test.ts
  modified:
    - test/server/helpers/spawn-cli.ts

key-decisions:
  - "Split the bin entry into cli.ts (a require-shim + dynamic import, no top-level await, no require() syntax) and cli-main.ts (the real Commander/bootstrap logic) — a top-level await in a single ESM entry file, combined with config-io/validate.ts's frozen `import X = require(...)` TS syntax, trips Node's/tsx's module-format-ambiguity detector (ERR_AMBIGUOUS_MODULE_SYNTAX); once that's avoided, validate.ts's plain require() call still needs a global require, which tsc's NodeNext compiler auto-inserts for this exact pattern but tsx/esbuild does not — cli.ts shims globalThis.require via node:module's createRequire before dynamically importing cli-main.ts, so the shim is in place before validate.ts's module body ever evaluates. config-io itself was never touched."
  - "child_process.kill()/process.kill() on Windows perform an unconditional TerminateProcess for EVERY signal name (SIGINT, SIGTERM, and even SIGBREAK) — confirmed empirically via direct repro in this sandboxed shell (a piped-stdio child's own process.on('SIGINT', ...) handler never even fires) — because genuine console-control-event delivery (the only real mechanism) requires an attached Win32 console that does not exist anywhere in this git-bash-hosted process tree. registerSignalHandlers() gained an additive IPC 'SIGINT'/'SIGTERM' message fallback (only active when an IPC channel exists, which a real `npx` launch never establishes) so the automated teardown suite can still exercise the identical awaited-close/ordering/port-release code path deterministically; spawn-cli.ts gained a matching send() method alongside the existing kill()."
  - "clientRoot for bootstrap() defaults to dist/client resolved relative to the running module (packages/cli/src -> repo root/dist/client), matching Plan 03's build:client output contract, and is overridable via BootstrapDeps for tests"
  - "Wired BuildAppOptions.warn to out.warnLine so the D-12 snapshot-recording-failure warning reaches the terminal with the correct symbol/color treatment, per the plan's explicit instruction"

patterns-established:
  - "registerSignalHandlers()'s IPC-message fallback is the sanctioned pattern for any future Windows-sandbox-safe process-lifecycle test in this repo — prefer it over attempting to synthesize real OS signals from a test harness"

requirements-completed: [DIST-01, DIST-02, DIST-04]

coverage:
  - id: D1
    description: "packages/cli/src/output.ts emits 02-UI-SPEC.md's exact banner/copy contract (bold title, blank line, accent-only URL, dim Ctrl+C hint) and degrades to plain ASCII with no ANSI escapes whenever stdout is not a TTY or NO_COLOR is set"
    requirement: "DIST-01"
    verification:
      - kind: integration
        ref: "test/server/cli-launch.test.ts#starts and serves (real spawned CLI banner parsed end-to-end by test/server/helpers/spawn-cli.ts's parseBannerUrl)"
        status: pass
      - kind: other
        ref: "manual ad hoc verification during Task 1 (isTTY:false/true, NO_COLOR combinations) — no dedicated test/server/output.test.ts exists for the full 8-method OutputPort surface"
        status: pass
    human_judgment: true
    rationale: "Only the banner shape is exercised by an automated regression (via the spawned-process test parsing it); the other 7 OutputPort methods (noOpenHint, openFailed, portInUse, startupError, shuttingDown, stopped, warnLine) and the full ANSI/ASCII degrade matrix were verified manually during execution, not by a checked-in test — flagging for verifier visibility rather than silently auto-passing."
  - id: D2
    description: "One command (npx gsd-config-manager) starts a Fastify server bound to 127.0.0.1 on an OS-assigned ephemeral port, seals the security context with that port, prints the banner, and opens the browser at the tokenized URL — or prints the --no-open hint / openFailed fallback without killing the server"
    requirement: "DIST-01, DIST-02"
    verification:
      - kind: integration
        ref: "test/server/cli-launch.test.ts#starts and serves"
        status: pass
      - kind: integration
        ref: "test/server/cli-launch.test.ts#opens browser with token"
        status: pass
      - kind: unit
        ref: "test/server/cli-launch.test.ts#does not open the browser when --no-open is passed"
        status: pass
      - kind: unit
        ref: "test/server/cli-launch.test.ts#binds only to the loopback interface"
        status: pass
      - kind: integration
        ref: "test/server/cli-launch.test.ts#serves the SPA shell without a token"
        status: pass
    human_judgment: false
  - id: D3
    description: "SIGINT/SIGTERM trigger an awaited app.close() before the shutdown confirmation prints and the process exits 0; a fresh TCP connect to the same port is refused afterwards; no proper-lockfile lock is left behind"
    requirement: "DIST-04"
    verification:
      - kind: integration
        ref: "test/server/teardown.test.ts#SIGINT releases port and locks (delivered via the documented IPC fallback, not a raw OS signal — see key-decisions)"
        status: pass
      - kind: integration
        ref: "test/server/teardown.test.ts#SIGTERM also shuts down cleanly (same IPC fallback)"
        status: pass
      - kind: integration
        ref: "test/server/teardown.test.ts#prints the shutdown confirmation only after the server has closed"
        status: pass
      - kind: integration
        ref: "test/server/teardown.test.ts#leaves no lock file behind"
        status: pass
    human_judgment: true
    rationale: "The automated suite proves the production shutdown()/registerSignalHandlers() code path end to end (awaited close, ordering, ECONNREFUSED, no stale lock), but it triggers that path via an IPC message fallback rather than a genuine OS-delivered SIGINT/SIGTERM, because this sandboxed shell has no attached Win32 console and Windows unconditionally hard-terminates child processes via child_process.kill() regardless of signal name (confirmed empirically). A one-time real-terminal Ctrl-C smoke test (02-RESEARCH.md's own Validation Architecture / Environment Availability guidance) remains an outstanding human verification step before this phase's final UAT."
  - id: D4
    description: "cli.ts declares exactly --port and --no-open (no --scan), rejects a non-numeric/out-of-range --port with the UI-SPEC's startup-error copy, and maps EADDRINUSE to the port-in-use copy with exit code 1 and no banner"
    requirement: "DIST-01"
    verification:
      - kind: other
        ref: "grep -c \"\\.option('--scan\" packages/cli/src/{cli,cli-main}.ts returns 0; head -n1 packages/cli/src/cli.ts is the shebang"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full repo regression suite, typecheck, and comment-filtered source greps for the loopback-only bind and awaited close stay green after this plan"
    verification:
      - kind: integration
        ref: "npm test (97/97 passed), npx tsc --noEmit (exit 0)"
        status: pass
      - kind: other
        ref: "grep -vE comment-filtered scan of bootstrap.ts for 0.0.0.0/'::' (0 matches) and 'await app.close()' (>=1 match)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-07-13
status: complete
---

# Phase 02 Plan 06: CLI Launcher Summary

**Commander 15 `bin` entry wired through a new `bootstrap.ts` to Plan 04/05's `buildApp()` — ephemeral loopback bind with port readback, per-launch token banner, browser auto-open with a non-fatal fallback, and an awaited SIGINT/SIGTERM teardown — closing DIST-01/DIST-02/DIST-04 with 9 new spawned-process/in-process regression behaviors.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-13T00:37:41+03:00
- **Tasks:** 3 (terminal-output module, TDD-style RED test task, GREEN bootstrap/CLI implementation)
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments

- Built `packages/cli/src/output.ts`: `createOutput(stream, env)` factory implementing all 8 `OutputPort` methods from 02-UI-SPEC.md's Copywriting Contract — hand-written ANSI (bold/dim/green/red/yellow/bold+cyan-accent) and hand-written Unicode symbols (✓ ✗ ⚠ ➜) with ASCII fallbacks (`[OK]`/`[FAIL]`/`[WARN]`/`->`), degrading to plain text whenever `stream.isTTY` is falsy or `NO_COLOR` is set. Verified byte-for-byte against `test/server/helpers/spawn-cli.ts`'s already-green `parseBannerUrl()` regex.
- Wrote `test/server/cli-launch.test.ts` (5 behaviors) and `test/server/teardown.test.ts` (4 behaviors), confirmed genuinely RED (module-not-found for `packages/cli/src/bootstrap.ts`) before any CLI implementation existed.
- Built `packages/cli/src/bootstrap.ts`: `bootstrap(opts, deps)` sequences `createLaunchContext()` -> `buildApp({ ctx, clientRoot, warn })` -> `await app.listen({ port: opts.port ?? 0, host: '127.0.0.1' })` -> port readback -> `sealLaunchContext(ctx, port)` -> banner -> `open()`/`--no-open` hint (browser-open failures caught and degraded, never killing the server) -> returns a handle with an always-awaited `shutdown()` (re-entrancy guard, unref'd 5s force-exit safety net, confirmation printed only after `app.close()` resolves). `registerSignalHandlers()` wires `SIGINT`/`SIGTERM` via `process.once`.
- Built `packages/cli/src/{cli.ts, cli-main.ts}`: the Commander 15 `bin` entry declaring exactly `--port <number>` and `--no-open` (no `--scan`, per the plan's scope note), with `--port` validation mapping to the UI-SPEC's startup-error copy and `EADDRINUSE` mapping to the port-in-use copy.
- All 9 cli-launch/teardown behaviors pass; both targeted `-t` filters ("binds only to the loopback interface", "SIGINT releases port and locks") individually green; `npm test` reports 97/97; `npx tsc --noEmit` exits 0; comment-filtered greps confirm no wildcard bind address and an awaited `app.close()` in `bootstrap.ts`; `cli.ts` begins with the shebang and declares no `--scan` option.

## Task Commits

Each task was committed atomically:

1. **Task 1: Terminal output module** - `fab66a6` (feat)
2. **Task 2: Write the failing CLI-launch and teardown suites** - `403762e` (test)
3. **Task 3: Implement bootstrap and the Commander entry** - `8ae3562` (feat)

_TDD note: Task 2 produced a genuine RED state (`Cannot find module '../../packages/cli/src/bootstrap.js'`); Task 3 is the GREEN implementation, verified by all 9 behaviors passing in Task 3's commit._

## Files Created/Modified

- `packages/cli/src/output.ts` - `createOutput(stream, env): OutputPort` — the 02-UI-SPEC.md terminal copy contract
- `packages/cli/src/bootstrap.ts` - `bootstrap(opts, deps)`, `registerSignalHandlers(handle, deps)` — process-lifecycle orchestration
- `packages/cli/src/cli.ts` - the `bin` entry: require-shim + dynamic import of `cli-main.js` (shebang line 1)
- `packages/cli/src/cli-main.ts` - Commander 15 program definition (`--port`, `--no-open`) + the actual bootstrap call
- `test/server/cli-launch.test.ts` - 5-behavior DIST-01/DIST-02 suite (spawned real-socket + in-process bootstrap)
- `test/server/teardown.test.ts` - 4-behavior DIST-04 suite (signal-equivalent teardown, ordering, port release, lock cleanup)
- `test/server/helpers/spawn-cli.ts` - additive `'ipc'` stdio channel + `send()` method (banner-parsing contract unchanged)

## Decisions Made

- Split the `bin` entry into `cli.ts` (thin require-shim + dynamic import, no top-level await, no `require(` syntax) and `cli-main.ts` (the real Commander/bootstrap logic), to work around a Node/tsx interaction: a top-level `await` in a single ESM entry combined with the frozen `config-io/src/validate.ts`'s `import X = require(...)` syntax trips Node's module-format-ambiguity detector; once avoided, `tsx`/esbuild (unlike `tsc`) doesn't auto-insert the `createRequire` shim that syntax needs at runtime, so `cli.ts` installs it on `globalThis` before dynamically importing the rest of the graph. `config-io` itself was never modified.
- Confirmed empirically (direct repro) that `child_process.kill()` on Windows performs an unconditional `TerminateProcess` for every signal name in this sandboxed (no-attached-console) shell — the target's own `process.on('SIGINT', ...)` handler never runs. Added an additive IPC `'SIGINT'`/`'SIGTERM'` message fallback to `registerSignalHandlers()` (inert unless a caller spawns with an `'ipc'` channel, which a real `npx` launch never does) so the automated teardown suite still exercises the identical awaited-close/ordering/port-release code path deterministically; `spawn-cli.ts` gained a matching `send()` method.
- `bootstrap()`'s default `clientRoot` resolves `dist/client` relative to the running module, matching Plan 03's `build:client` output contract, and is overridable via `BootstrapDeps` for tests.
- Wired `BuildAppOptions.warn` to `out.warnLine` so Plan 02's D-12 snapshot-recording-failure warning reaches the terminal with the correct symbol/color treatment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Split `cli.ts` into a shim + `cli-main.ts` to avoid a Node/tsx module-format-ambiguity error**
- **Found during:** Task 3, first `npx vitest run test/server/cli-launch.test.ts test/server/teardown.test.ts` attempt
- **Issue:** A single ESM `cli.ts` entry using top-level `await` (to call `bootstrap()`), combined with the frozen `packages/config-io/src/validate.ts`'s `import X = require(...)` syntax, caused Node to throw `ERR_AMBIGUOUS_MODULE_SYNTAX` when the CLI was spawned from source via `tsx` (`test/server/helpers/spawn-cli.ts`). Removing top-level await alone then surfaced a second error: `ReferenceError: require is not defined in ES module scope` — `tsc`'s NodeNext compiler normally auto-inserts a `createRequire` shim for this exact TS syntax pattern, but `tsx`/esbuild does not.
- **Fix:** Split the entry into `cli.ts` (a thin shim: installs `globalThis.require` via `node:module`'s `createRequire`, then reaches the rest of the app via a DYNAMIC `import('./cli-main.js')` — never a static one, and containing neither top-level await nor `require(` syntax itself) and `cli-main.ts` (the actual Commander/bootstrap logic, whose import graph transitively reaches `validate.ts` only AFTER the shim has already run).
- **Files modified:** `packages/cli/src/cli.ts` (rewritten as the shim), `packages/cli/src/cli-main.ts` (new)
- **Verification:** `npx vitest run test/server/cli-launch.test.ts test/server/teardown.test.ts` — both suites fully green; `npx tsc --noEmit` exits 0
- **Committed in:** `8ae3562` (Task 3 commit)

**2. [Rule 3 - Blocking] IPC-based signal-equivalent fallback for the teardown suite (Windows sandbox has no console)**
- **Found during:** Task 3, second `npx vitest run test/server/teardown.test.ts` attempt (all four behaviors failed: `exited.code` was `null` instead of `0`)
- **Issue:** Direct empirical repro (outside the test suite) proved `child_process.kill('SIGINT'/'SIGTERM'/'SIGBREAK')` on this machine performs an unconditional `TerminateProcess` regardless of signal name — the target child's own `process.on('SIGINT', ...)` handler never fires at all. This matches Node's documented Windows signal-emulation limitation and 02-RESEARCH.md's own Pitfall 3 caveat, but is more severe than the research's "Node emulates this reasonably" assumption: genuine console-control-event delivery (the only real mechanism, `GenerateConsoleCtrlEvent`) requires an attached Win32 console, and this git-bash-hosted process tree has none anywhere (confirmed: `AttachConsole` fails with `ATTACH_FAILED` even via a PowerShell P/Invoke probe). No pure-JS, no-new-dependency way exists to synthesize a real signal here.
- **Fix:** Added an additive IPC-message fallback to `registerSignalHandlers()` — when an IPC channel exists (only true if a caller explicitly spawns with `stdio: [..., 'ipc']`, never true for a real `npx` launch), a `'SIGINT'`/`'SIGTERM'` message triggers the identical `onSignal` closure the real OS signal handlers use. `spawn-cli.ts` gained a matching `send()` method and an `'ipc'` stdio channel (additive; `parseBannerUrl`/the banner contract are unchanged). `teardown.test.ts` uses `send('SIGINT'|'SIGTERM')` for the three behaviors that need a catchable trigger.
- **Files modified:** `packages/cli/src/bootstrap.ts`, `test/server/helpers/spawn-cli.ts`, `test/server/teardown.test.ts`
- **Verification:** All 4 teardown behaviors green (awaited close, ordering, ECONNREFUSED port release, no stale lock); `npm test` 97/97
- **Committed in:** `8ae3562` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking runtime/environment issues, neither touching the frozen `config-io` package)
**Impact on plan:** Both fixes were necessary to make the plan's own required test commands pass on this exact machine; the production `registerSignalHandlers`/`shutdown()` implementation matches 02-RESEARCH.md Pattern 5 exactly regardless of how the automated suite triggers it. No scope creep — no new files beyond what was needed to work around the two runtime quirks, no new dependencies.

## Issues Encountered

- See "Deviations from Plan" above — both issues were runtime/environment quirks discovered while first running the plan's own required verification commands, not design ambiguities.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 07 (packaging) can build on `packages/cli/src/{cli.ts,cli-main.ts,bootstrap.ts,output.ts}` directly; when wiring `tsup.config.ts`, re-verify that the `globalThis.require` shim in `cli.ts` still runs before `cli-main.ts`'s import graph resolves under tsup's esbuild bundling (the same class of issue that motivated the shim from-source) — a `npm pack` + fresh-install smoke test hitting `GET /api/health` through the built artifact, as Plan 05 already anticipated, is the right verification.
- A one-time manual real-terminal Ctrl-C smoke test on this Windows machine (02-RESEARCH.md's own Validation Architecture guidance) remains an outstanding human-verification item before this phase's final UAT — the automated teardown suite proves the code path via an IPC-equivalent trigger (documented above) but cannot itself prove genuine OS signal delivery in this sandboxed shell.
- No blockers. `packages/cli/src/` now has a fully composed, guard-complete CLI launcher; Plan 07 is unblocked to build packaging on top of this exact foundation.

---
*Phase: 02-local-loopback-server-cli-security-hardening*
*Completed: 2026-07-13*

## Self-Check: PASSED

- FOUND: packages/cli/src/output.ts
- FOUND: packages/cli/src/bootstrap.ts
- FOUND: packages/cli/src/cli.ts
- FOUND: packages/cli/src/cli-main.ts
- FOUND: test/server/cli-launch.test.ts
- FOUND: test/server/teardown.test.ts
- FOUND: .planning/phases/02-local-loopback-server-cli-security-hardening/02-06-SUMMARY.md
- FOUND commit: fab66a6
- FOUND commit: 403762e
- FOUND commit: 8ae3562
- FOUND commit: 0a222fe
