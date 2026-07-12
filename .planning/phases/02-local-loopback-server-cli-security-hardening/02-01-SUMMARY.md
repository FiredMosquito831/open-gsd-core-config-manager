---
phase: 02-local-loopback-server-cli-security-hardening
plan: 01
subsystem: infra
tags: [fastify, commander, tsup, tsx, vitest, npm-dependencies, spawn-cli]

# Dependency graph
requires:
  - phase: 01-schema-foundation-data-layer-safety
    provides: packages/config-io (existing exact-pin package.json convention, test house style)
provides:
  - Phase 2 runtime dependency set installed at exact pinned versions (fastify, @fastify/static, @fastify/cors, commander, open, env-paths)
  - tsup devDependency for the CLI/server build step
  - test:server npm script (vitest run test/server --reporter=dot)
  - Reusable spawnCli() + parseBannerUrl() test harness for spawned-process CLI testing
affects: [02-local-loopback-server-cli-security-hardening plans 02-07 (server app, CLI entry, security guards, snapshot store, packaging)]

# Tech tracking
tech-stack:
  added: [fastify@5.10.0, "@fastify/static@10.1.0", "@fastify/cors@11.3.0", commander@15.0.0, open@11.0.0, env-paths@4.0.0, tsup@8.5.1]
  patterns: ["exact-pin only (no ^/~) package.json convention extended from Phase 1", "spawn CLI from source via tsx (no build dependency) for integration tests"]

key-files:
  created: [test/server/helpers/spawn-cli.ts, test/server/helpers/spawn-cli.test.ts]
  modified: [package.json, package-lock.json]

key-decisions:
  - "Human legitimacy checkpoint (Task 1, gate=blocking-human) for fastify/@fastify/static/@fastify/cors was approved by the human before any install command ran"
  - "spawnCli() resolves tsx's ESM CLI entry via node_modules/tsx/dist/cli.mjs run through process.execPath, avoiding shell:true and the Windows .cmd shim entirely"

patterns-established:
  - "spawnCli()/parseBannerUrl() split: parseBannerUrl is a pure function tested without spawning any process, so the harness itself is unit-testable before the CLI it targets exists"

requirements-completed: [DIST-01, DIST-03]

coverage:
  - id: D1
    description: "Phase 2 dependency set (fastify, @fastify/static, @fastify/cors, commander, open, env-paths, tsup) installed at exact pinned versions with no caret/tilde ranges anywhere in package.json"
    requirement: "DIST-01"
    verification:
      - kind: unit
        ref: "node -e pins-ok/no-ranges acceptance script (Task 2 acceptance_criteria)"
        status: pass
      - kind: integration
        ref: "npm test (Phase 1 suite, 61/61 passed post-install)"
        status: pass
    human_judgment: false
  - id: D2
    description: "write-file-atomic remains pinned at exactly 7.0.1 (never floated to ^8) after the Phase 2 install"
    requirement: "DIST-01"
    verification:
      - kind: unit
        ref: "node -e pins-ok acceptance script asserting write-file-atomic===7.0.1"
        status: pass
    human_judgment: false
  - id: D3
    description: "test:server npm script added (vitest run test/server --reporter=dot) per 02-VALIDATION.md quick-run command"
    requirement: "DIST-01"
    verification:
      - kind: unit
        ref: "node -e script-ok acceptance check"
        status: pass
    human_judgment: false
  - id: D4
    description: "spawnCli()/parseBannerUrl() test harness exists, spawns the CLI from source via tsx (no build dependency), and its pure banner parser is unit-tested green"
    requirement: "DIST-03"
    verification:
      - kind: unit
        ref: "test/server/helpers/spawn-cli.test.ts (4 passing assertions)"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit (exit 0)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Human explicitly approved the three legitimacy-flagged (SUS) fastify packages by name, version, and source repo before Task 2's install ran"
    verification: []
    human_judgment: true
    rationale: "This is an inherently human judgment gate (package supply-chain legitimacy review) — the orchestrator already presented it and recorded the human's 'approved' response before this executor ran; no automated check can substitute for that sign-off."

duration: 12min
completed: 2026-07-12
status: complete
---

# Phase 02 Plan 01: Dependency Install & spawnCli Harness Summary

**Installed Fastify 5 + Commander 15 + tsup at exact CLAUDE.md-pinned versions under a human supply-chain gate, and built a Windows-safe spawnCli() test harness that spawns the (not-yet-existing) CLI from source via tsx.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-12T20:37:42Z
- **Tasks:** 3 (1 human-verify checkpoint, already approved by the orchestrator/human before this executor ran; 2 auto tasks executed by this executor)
- **Files modified:** 4 (package.json, package-lock.json, test/server/helpers/spawn-cli.ts, test/server/helpers/spawn-cli.test.ts)

## Accomplishments

- Task 1 (package legitimacy checkpoint for `fastify`, `@fastify/static`, `@fastify/cors`) was approved by the human via the orchestrator before this executor began — no install ran before that approval.
- Installed and exactly pinned all six Phase 2 runtime dependencies (`fastify@5.10.0`, `@fastify/static@10.1.0`, `@fastify/cors@11.3.0`, `commander@15.0.0`, `open@11.0.0`, `env-paths@4.0.0`) plus `tsup@8.5.1` as a devDependency, with zero caret/tilde ranges anywhere in `package.json`. Confirmed `write-file-atomic` is still exactly `7.0.1`.
- Added the `test:server` npm script per 02-VALIDATION.md's declared quick-run command.
- Built `test/server/helpers/spawn-cli.ts` exporting the pure `parseBannerUrl()` banner parser and the async `spawnCli()` process-spawning harness (spawns via `tsx`'s ESM CLI entry against `packages/cli/src/cli.ts`, forces `NO_COLOR=1` for deterministic plain-ASCII output, resolves on banner match, rejects on premature exit or timeout).
- `test/server/helpers/spawn-cli.test.ts` unit-tests `parseBannerUrl()` only (4 passing assertions) — the CLI itself doesn't exist yet (built in a later plan), so this file stays green from the moment it's written.

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy gate** — no commit (checkpoint only; human approval recorded by the orchestrator before this executor was spawned)
2. **Task 2: Install and exactly pin the Phase 2 dependency set** - `e21d541` (feat)
3. **Task 3: Build the spawnCli() test harness and unit-test its banner parser** - `7f792bf` (feat)

_No plan-metadata commit yet — see Next Phase Readiness; STATE.md/ROADMAP.md updates follow this SUMMARY per the execution workflow's `<final_commit>` step._

## Files Created/Modified

- `package.json` - Added 6 Phase 2 runtime deps + `tsup` devDependency (all exact pins), added `test:server` script
- `package-lock.json` - Regenerated to match the new exact-pinned dependency tree
- `test/server/helpers/spawn-cli.ts` - Exports `parseBannerUrl()` (pure banner-URL parser) and `spawnCli()` (async tsx-spawned CLI harness) plus the `SpawnedCli`/`SpawnCliOptions` types
- `test/server/helpers/spawn-cli.test.ts` - Unit tests for `parseBannerUrl()` (multi-line banner match, unrelated-noise null, non-loopback-host null, malformed-token null)

## Decisions Made

- The Task 1 human legitimacy checkpoint (`gate="blocking-human"`) was resolved by the orchestrator before this executor was spawned — the human responded "approved" after confirming all three packages' npmjs.com listings (repo links, versions, no deprecation, exact spelling). This executor did not re-present the checkpoint and proceeded directly to Task 2's install per its explicit instructions.
- `spawnCli()` resolves `tsx`'s ESM CLI entry (`node_modules/tsx/dist/cli.mjs`) and runs it via `process.execPath` directly, rather than spawning the `tsx`/`tsx.cmd` shim with `shell: true` — this avoids Windows shell-quoting/injection surface entirely while staying cross-platform.
- Removed a literal `dist/cli.js` string from the module's header comment (kept only in prose form, "built/packaged CLI artifact") so the file textually contains zero reference to the built artifact path, matching the plan's acceptance criterion literally as well as in spirit.

## Deviations from Plan

None - plan executed exactly as written. The one adjustment (rewording the header comment to avoid a literal `dist/cli.js` substring) was a same-task correction to more precisely satisfy Task 3's own acceptance criterion, not a scope change — no separate deviation rule applies.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. (The only human-facing step, the package-legitimacy checkpoint, was already handled by the orchestrator before this executor ran.)

## Next Phase Readiness

- Phase 2 Plans 02-07 (server app composition, security guards, CLI entry, snapshot store, packaging) can now import `fastify`, `@fastify/static`, `@fastify/cors`, `commander`, `open`, `env-paths` and build with `tsup` — all present in `node_modules` at the exact pinned versions.
- Plan 06 (CLI launch) and Plan 07 (packaging smoke) can import `spawnCli`/`parseBannerUrl` from `test/server/helpers/spawn-cli.ts` directly — the harness is complete and does not require the CLI to exist to be imported (only to be *spawned*).
- No blockers. `packages/cli/src/cli.ts` does not exist yet — `spawnCli()` will fail loudly (spawn error / ENOENT-style failure surfaced through the rejected promise) if invoked before that file exists, which is expected and will resolve once a later Phase 2 plan creates it.

---
*Phase: 02-local-loopback-server-cli-security-hardening*
*Completed: 2026-07-12*

## Self-Check: PASSED

- FOUND: test/server/helpers/spawn-cli.ts
- FOUND: test/server/helpers/spawn-cli.test.ts
- FOUND: package.json
- FOUND: .planning/phases/02-local-loopback-server-cli-security-hardening/02-01-SUMMARY.md
- FOUND commit: e21d541
- FOUND commit: 7f792bf
