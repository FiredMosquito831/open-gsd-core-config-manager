---
phase: 02-local-loopback-server-cli-security-hardening
plan: 03
subsystem: infra
tags: [dist-client, static-page, d-05-token-flow, build-pipeline, vite-seam]

# Dependency graph
requires:
  - phase: 02-local-loopback-server-cli-security-hardening
    provides: "02-01: Phase 2 dependency set installed (tsup, fastify, etc.) and repo build-script conventions"
provides:
  - "web/index.html — dependency-free bootstrap page implementing D-05's token flow end to end (read ?t= once, strip via history.replaceState, hold in memory, send x-gsd-token header on /api/health)"
  - "scripts/build-client.mjs — deterministic, idempotent, dist/client-scoped build step producing the frozen dist/client/index.html output contract"
  - "package.json build:client script"
affects: ["02-local-loopback-server-cli-security-hardening plan 04 (@fastify/static must serve dist/client at this exact path and check the same x-gsd-token header name)", "plan 07 (packaging pipeline wires build:client into the composite build and asserts dist/client/index.html in the tarball)", "Phase 3 (replaces the body of build-client.mjs, or the script itself, with a Vite build whose outDir is dist/client — output contract unchanged)"]

# Tech tracking
tech-stack:
  added: []
  patterns: ["dist/client/** output contract as the frozen seam between the client build (copy step today, Vite build in Phase 3) and both the server's static serving and the npm tarball", "narrow-scope clean (rmSync only the leaf dist/client dir) so a later composite build step that cleans all of dist/ (tsup) is never destructively raced by this script"]

key-files:
  created:
    - web/index.html
    - scripts/build-client.mjs
  modified:
    - package.json

key-decisions:
  - "Placeholder page kept fully dependency-free (no Vite/React/frameworks) per 02-CONTEXT.md's explicit Claude's-Discretion scope decision — Phase 3 owns the real frontend stack"
  - "Reworded an inline comment from 'never written to localStorage or sessionStorage' to 'never written to any browser storage API' — the acceptance script's regex greps for those literal words anywhere in the file including comments, so the prose had to avoid the literal substrings while preserving the same guarantee"
  - "build-client.mjs cleans only dist/client (rmSync with a leaf-scoped path), never dist/ itself — required because Plan 07's composite build runs tsup (which cleans all of dist/) before this script, and a broader clean here would race-delete tsup's freshly built dist/cli.js"

patterns-established:
  - "Client build step is a producer/consumer seam: the npm script name (build:client) and its output path (dist/client) are frozen; the implementation behind that script name can be swapped (copy step -> Vite build) without touching the server or packaging pipeline"

requirements-completed: [DIST-03]

coverage:
  - id: D1
    description: "npm run build:client produces dist/client/index.html — the exact path @fastify/static will serve and the exact path the npm tarball must contain"
    requirement: "DIST-03"
    verification:
      - kind: unit
        ref: "node scripts/build-client.mjs && node -e accessSync('dist/client/index.html') (Task 2 acceptance script)"
        status: pass
      - kind: unit
        ref: "npm run build:client (Task 2 acceptance script)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The served placeholder page implements the frozen D-05 token flow end to end: reads ?t= once, strips it from the address bar via history.replaceState, holds it only in memory, and sends it as an x-gsd-token header on /api/health — never as a query parameter"
    requirement: "DIST-03"
    verification:
      - kind: unit
        ref: "node -e token-flow-ok script asserting x-gsd-token, /api/health, history.replaceState present and no localStorage/sessionStorage (Task 1 acceptance script)"
        status: pass
      - kind: unit
        ref: "grep -E 'http://|https://' web/index.html exits non-zero (no external src/href)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The client build step is decoupled from the client's implementation: cleaning is scoped to dist/client only, so it never deletes a sibling dist/cli.js built by a separate (tsup) step, and Phase 3 can swap the producer for a Vite build without changing the output contract"
    requirement: "DIST-03"
    verification:
      - kind: unit
        ref: "node -e sentinel-preserved script: write dist/cli.js, run build-client.mjs, assert dist/cli.js and dist/client/index.html both still exist (Task 2 acceptance script / <verify> block)"
        status: pass
      - kind: unit
        ref: "node -e script-gate script asserting package.json has build:client but no build/prepublishOnly script yet (Task 2 acceptance script)"
        status: pass
      - kind: unit
        ref: "git check-ignore -v dist (dist/ confirmed git-ignored)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-07-12
status: complete
---

# Phase 02 Plan 03: Placeholder Client Page & Build Contract Summary

**Dependency-free `web/index.html` proving the D-05 token flow end to end, plus `scripts/build-client.mjs` — a narrowly-scoped, idempotent copy step that freezes the `dist/client/index.html` output contract Plan 04's static serving and Plan 07's tarball both depend on.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-07-12T20:51:17Z
- **Tasks:** 2 (both auto)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- Built `web/index.html`: a single self-contained HTML file with inline CSS and an inline script, no external `src`/`href`, no CDN links, no framework. On load it reads `?t=` from the URL exactly once, immediately calls `history.replaceState` to strip it from the address bar, keeps it only in a closure-scoped variable, and calls `fetch('/api/health', { headers: { 'x-gsd-token': token } })` — the token travels as a header, never a query parameter on the API call. Renders connected/rejected/unreachable/no-token states without ever displaying or logging the token value.
- Built `scripts/build-client.mjs`: a dependency-free ESM Node script that removes only `dist/client` (never the whole `dist/` tree) and copies `web/` into it, exits non-zero with a clear message if `web/index.html` is missing, and prints the resolved output path on success. Verified idempotent (two consecutive runs both succeed) and verified it preserves a sibling `dist/cli.js` sentinel file untouched.
- Added the `build:client` npm script. Deliberately did not add `build`/`prepublishOnly` (Plan 07 owns the composite build and publishing fields).
- Confirmed `dist/` is already git-ignored (inherited from Phase 1's `.gitignore`) — no change needed there.

## Task Commits

Each task was committed atomically:

1. **Task 1: Placeholder client page implementing the frozen D-05 token flow** - `d965397` (feat)
2. **Task 2: Client build step producing the frozen dist/client output contract** - `be48009` (feat)

## Files Created/Modified

- `web/index.html` - Dependency-free bootstrap page: reads and strips the launch token, authenticates `/api/health` via the `x-gsd-token` header, renders connection status
- `scripts/build-client.mjs` - Idempotent, `dist/client`-scoped copy step (`web/` -> `dist/client/`); documented as the seam Phase 3 replaces with a Vite build
- `package.json` - Added the `build:client` script

## Decisions Made

- Kept the placeholder page fully dependency-free (no Vite/React) per 02-CONTEXT.md's explicit Claude's-Discretion note — installing the Phase 3 frontend stack solely to emit a placeholder would add dependencies Phase 3 immediately reconfigures.
- Reworded one inline comment (originally read "...never written to localStorage or sessionStorage") to "...never written to any browser storage API" because Task 1's own acceptance script regex-matches those literal words anywhere in the file, including prose comments — the same no-persistence guarantee is preserved, just phrased to avoid the literal substrings the acceptance grep flags.
- Confirmed via `git check-ignore -v dist` that `dist/` is already git-ignored from Phase 1 setup, so no `.gitignore` edit was needed (the plan's action item to "add `dist/` to `.gitignore` if not already ignored" was a no-op check, not a required change).

## Deviations from Plan

None - plan executed exactly as written. The one adjustment (rewording a comment to avoid literal `localStorage`/`sessionStorage` substrings) was a same-task correction to satisfy Task 1's own acceptance criterion precisely, not a scope change — no deviation rule applies.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04 (server app + static serving) can point `@fastify/static`'s `root` at `dist/client` and rely on `index.html` being present there after `npm run build:client`; the token guard it builds must check the same `x-gsd-token` header name this page sends.
- Plan 07 (packaging) can wire `build:client` into its composite `build`/`prepublishOnly` script and assert `dist/client/index.html` is present in `npm pack --dry-run --json` output — the script is idempotent and safe to run repeatedly in that pipeline.
- Phase 3 can replace `scripts/build-client.mjs`'s body (or the `build:client` script itself) with `vite build --outDir dist/client` without any downstream change, since the output contract (`dist/client/index.html`, `dist/client/**`) is frozen here.
- No blockers.

---
*Phase: 02-local-loopback-server-cli-security-hardening*
*Completed: 2026-07-12*

## Self-Check: PASSED

- FOUND: web/index.html
- FOUND: scripts/build-client.mjs
- FOUND: .planning/phases/02-local-loopback-server-cli-security-hardening/02-03-SUMMARY.md
- FOUND commit: d965397
- FOUND commit: be48009
