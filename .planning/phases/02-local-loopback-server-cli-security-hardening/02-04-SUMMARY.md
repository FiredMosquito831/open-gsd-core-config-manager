---
phase: 02-local-loopback-server-cli-security-hardening
plan: 04
subsystem: security
tags: [fastify, host-guard, origin-guard, token-guard, cors, dns-rebinding, spa-fallback]

# Dependency graph
requires:
  - phase: 02-local-loopback-server-cli-security-hardening
    provides: "02-01: Phase 2 dependency set (fastify, @fastify/static, @fastify/cors) installed at exact pinned versions"
  - phase: 02-local-loopback-server-cli-security-hardening
    provides: "02-03: web/index.html placeholder implementing the client half of the D-05 token flow (?t= read once, x-gsd-token header on /api calls); dist/client output contract via scripts/build-client.mjs"
provides:
  - "packages/server/src/context.ts — LaunchContext + createLaunchContext()/sealLaunchContext(), the mutable per-launch security state every guard reads at request time"
  - "packages/server/src/plugins/{host-guard,origin-guard,token-guard,cors}.ts — the four independent, layered defenses (Host allowlist, real-403 Origin guard, constant-time token guard, exact-string CORS lock)"
  - "packages/server/src/static/serve.ts — @fastify/static + SPA setNotFoundHandler fallback, dev-nudge fallback when dist/client doesn't exist yet, /api/* 404s stay JSON"
  - "packages/server/src/routes/health.ts — GET /api/health (token-guarded), the route the placeholder page and future CLI-launch tests authenticate against"
  - "packages/server/src/app.ts — buildApp(opts): Promise<FastifyInstance>, the frozen composition root Plan 06's CLI bootstrap will call, never listen()s itself"
  - "test/server/security.test.ts — the complete SEC-01/SEC-02/D-04 regression suite (8 behaviors), closing 02-VALIDATION.md's Wave 0 gap for this file"
affects: ["02-local-loopback-server-cli-security-hardening plan 05 (REST routes register inside the same /api plugin scope buildApp() composes)", "02-local-loopback-server-cli-security-hardening plan 06 (CLI bootstrap calls buildApp(), then listen(), then sealLaunchContext(ctx, port))", "02-local-loopback-server-cli-security-hardening plan 07 (packaging smoke test hits GET /api/health through the built artifact)"]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Fastify encapsulated-plugin hook scoping: root-scope Host guard covers static assets, /api-scoped Origin+token guards never touch them (02-RESEARCH.md Pattern 1)", "mutable LaunchContext read at request time, sealed once after listen() resolves the ephemeral port — avoids a build-time-vs-runtime origin/host mismatch", "real server-side 403 for cross-origin requests via a dedicated onRequest hook, since @fastify/cors alone only omits a header (a browser-only enforcement gap fastify.inject() cannot exercise)"]

key-files:
  created:
    - packages/server/src/context.ts
    - packages/server/src/plugins/host-guard.ts
    - packages/server/src/plugins/origin-guard.ts
    - packages/server/src/plugins/token-guard.ts
    - packages/server/src/plugins/cors.ts
    - packages/server/src/static/serve.ts
    - packages/server/src/routes/health.ts
    - packages/server/src/app.ts
    - test/server/security.test.ts
  modified: []

key-decisions:
  - "Implemented the <cors_correction> exactly as the plan mandates: @fastify/cors alone cannot make the SERVER reject a cross-origin request (it only omits Access-Control-Allow-Origin, a browser-enforced no-op against fastify.inject()) — a separate origin-guard.ts onRequest hook returns the real 403 that success criterion 2 requires"
  - "LaunchContext is deliberately mutable and read at request time (not captured at hook-registration time) because the ephemeral port — and therefore allowedHosts/corsOrigin — isn't known until listen() resolves, which happens after hooks are registered; sealLaunchContext() is the single place that derives host/origin strings from the port"
  - "An unsealed context (corsOrigin === null, allowedHosts empty) fails CLOSED in every guard — origin-guard rejects any present Origin, host-guard rejects every Host, cors.ts's origin callback never returns true — rather than accidentally failing open before sealLaunchContext runs"
  - "static/serve.ts skips @fastify/static entirely and serves an inline dev-nudge HTML page when dist/client/index.html doesn't exist yet, so buildApp() never crashes in development before npm run build:client has run"
  - "All four guard rejection bodies use fixed, static messages with zero request-value interpolation (verified by a comment-filtered source grep) — mirrors config-io's ValidationError, which never carries the config body"

patterns-established:
  - "Registration order in app.ts is the enforced contract: root Host guard -> static (outside /api) -> encapsulated /api plugin (cors -> origin-guard -> token-guard -> routes) — any future route addition must register inside the same /api plugin to inherit both guards"

requirements-completed: [SEC-01, SEC-02]

coverage:
  - id: D1
    description: "Root-scope Host-header allowlist rejects any request (including static assets) whose Host isn't 127.0.0.1:<port> or localhost:<port>, with a fixed non-echoing 403 body"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "test/server/security.test.ts#rejects bad Host header"
        status: pass
      - kind: unit
        ref: "test/server/security.test.ts#rejects bad Host header on static assets too"
        status: pass
    human_judgment: false
  - id: D2
    description: "An /api request carrying a mismatched Origin header is rejected with a real 403 from the server itself (not merely a missing CORS header), per the <cors_correction> deviation"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "test/server/security.test.ts#rejects cross-origin"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every /api request — reads included — without a valid x-gsd-token is rejected 403 via constant-time comparison; a correct token on an allowlisted host is accepted"
    requirement: "SEC-02"
    verification:
      - kind: unit
        ref: "test/server/security.test.ts#rejects missing token on reads"
        status: pass
      - kind: unit
        ref: "test/server/security.test.ts#rejects wrong token"
        status: pass
      - kind: unit
        ref: "test/server/security.test.ts#accepts a valid token on an allowlisted host"
        status: pass
    human_judgment: false
  - id: D4
    description: "Static assets (/, /index.html) load with no token so the SPA can bootstrap, while an unmatched non-API route falls back to the SPA shell instead of a 404 JSON body"
    requirement: "SEC-02"
    verification:
      - kind: unit
        ref: "test/server/security.test.ts#serves static assets without a token"
        status: pass
      - kind: unit
        ref: "test/server/security.test.ts#unknown non-API path falls back to the SPA shell"
        status: pass
    human_judgment: false
  - id: D5
    description: "No 403 response body ever echoes the received Host, Origin, or token value back to the caller; buildApp() never calls listen() itself; full repo test suite and typecheck stay green"
    verification:
      - kind: unit
        ref: "test/server/security.test.ts (every 403 test asserts the rejected value is absent from res.body)"
        status: pass
      - kind: other
        ref: "grep -vE comment-filtered source scan for RegExp/.test( in cors.ts and template-literal message interpolation across plugins/*.ts (both return 0)"
        status: pass
      - kind: integration
        ref: "npm test (79/79 passed) and npx tsc --noEmit (exit 0)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-07-12
status: complete
---

# Phase 02 Plan 04: Security Guards & buildApp() Composition Summary

**Root-scoped Host allowlist + `/api`-scoped Origin guard, constant-time token guard, and exact-string CORS lock composed into `buildApp()`, with static SPA serving unguarded by token but still protected by the Host check — the complete SEC-01/SEC-02 layered defense, all eight regression behaviors green.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-12T21:00:03Z
- **Tasks:** 3 (1 TDD-style RED test task, 2 implementation tasks)
- **Files modified:** 9 (all created)

## Accomplishments

- Built `test/server/security.test.ts`: eight `fastify.inject()`-driven behaviors covering the Host allowlist (including a root-scope regression guard for static assets), the real-403 Origin guard, the constant-time token guard (reads and writes), the unguarded-static-asset Pitfall-1 regression guard, and the SPA not-found fallback — confirmed genuinely RED (import error) before any implementation existed.
- Built `packages/server/src/context.ts`: `LaunchContext` + `createLaunchContext()`/`sealLaunchContext(ctx, port)` — the mutable per-launch state (token, allowedHosts, corsOrigin) every guard reads at request time, since the ephemeral port isn't known until `listen()` resolves.
- Built the four security plugins: `host-guard.ts` (root-capable exact-Set Host allowlist), `origin-guard.ts` (the real server-side 403 for a mismatched Origin — implements the plan's `<cors_correction>` deviation from 02-RESEARCH.md), `token-guard.ts` (`crypto.timingSafeEqual` constant-time comparison, skips `OPTIONS` preflights, guards reads per D-04), and `cors.ts` (`@fastify/cors` options with an exact-string-only origin callback, no pattern matching).
- Built `packages/server/src/static/serve.ts` (`@fastify/static` + SPA fallback, dev-nudge page when `dist/client` doesn't exist yet, `/api/*` 404s stay JSON) and `packages/server/src/routes/health.ts` (`GET /api/health`, token-guarded, never echoes the token or a request header).
- Composed `packages/server/src/app.ts`'s `buildApp()`: root Host guard -> static serving (outside `/api`) -> encapsulated `/api` plugin (`@fastify/cors` -> origin-guard -> token-guard -> health route). Never calls `listen()`.
- All eight security behaviors pass; targeted `-t` filters for the Pitfall-1 regression guard, the root-scope Host guard, and the cross-origin real-403 case all individually green; `npm test` reports 79/79 (Phase 1's 65 + snapshot-store's 6 + this plan's 8); `npx tsc --noEmit` exits 0; comment-filtered source greps confirm no pattern-matching origin check and no request-value interpolation in any guard message.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the failing security test suite (SEC-01, SEC-02, D-04)** - `6183196` (test)
2. **Task 2: Launch context + the four security plugins** - `f0f5df5` (feat)
3. **Task 3: Compose buildApp() — static + SPA fallback, /api scope, health route** - `b895d08` (feat)

_TDD note: Task 1 produced a genuine RED state (module-not-found errors — `app.ts`/`context.ts` did not exist); Tasks 2-3 are the GREEN implementation, verified by the full eight-behavior passing suite in Task 3's commit._

## Files Created/Modified

- `test/server/security.test.ts` - Eight-behavior SEC-01/SEC-02/D-04 suite via `app.inject()`, `mkdtempSync` fixture `clientRoot`
- `packages/server/src/context.ts` - `LaunchContext`, `createLaunchContext()`, `sealLaunchContext(ctx, port)`
- `packages/server/src/plugins/host-guard.ts` - `registerHostGuard(app, ctx)` — root-scope Host allowlist
- `packages/server/src/plugins/origin-guard.ts` - `registerOriginGuard(app, ctx)` — real 403 for mismatched Origin
- `packages/server/src/plugins/token-guard.ts` - `registerTokenGuard(app, ctx)` — constant-time `x-gsd-token` guard
- `packages/server/src/plugins/cors.ts` - `buildCorsOptions(ctx)` — exact-string `@fastify/cors` options
- `packages/server/src/static/serve.ts` - `registerStatic(app, clientRoot)` — static + SPA fallback + dev-nudge
- `packages/server/src/routes/health.ts` - `healthRoutes` — `GET /api/health`
- `packages/server/src/app.ts` - `buildApp(opts)`, `BuildAppOptions` — the composition root

## Decisions Made

- Implemented the plan's `<cors_correction>` exactly as specified: `@fastify/cors`'s function-based `origin` callback alone cannot produce a server-side 403 (it only omits a response header, which `fastify.inject()` — having no browser — cannot observe as a rejection); `origin-guard.ts` is the hook that actually returns 403 for a mismatched Origin.
- Kept `LaunchContext` mutable by design and had every guard read `ctx.allowedHosts`/`ctx.corsOrigin` at request time rather than capturing them at hook-registration time, because the ephemeral port (and therefore the host/origin allowlist) is only known after `listen()` resolves, which happens strictly after hooks are registered.
- Made every guard fail CLOSED against an unsealed context (`corsOrigin === null`, `allowedHosts` empty): origin-guard rejects any present Origin, host-guard rejects every Host, and `cors.ts`'s origin callback never resolves `true`, so there is no window where a not-yet-sealed context could accidentally allow a request.
- `static/serve.ts` degrades to an inline dev-nudge HTML page (skipping `@fastify/static` registration) when `dist/client/index.html` doesn't exist yet, so `buildApp()` never crashes in a fresh dev environment before `npm run build:client` has run.

## Deviations from Plan

None - plan executed exactly as written, including the explicitly-authored `<cors_correction>` deviation from 02-RESEARCH.md, which the plan itself calls out as required and pre-approved.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05 (REST API routes) can register its route handlers inside the same `/api` plugin scope `buildApp()` composes (or add a sibling `app.register(routes, { prefix: '/api' })` call using the same `ctx`), inheriting both the Origin guard and the token guard automatically.
- Plan 06 (CLI bootstrap) can call `buildApp({ ctx, clientRoot })`, then `await app.listen({ port, host: '127.0.0.1' })`, then `sealLaunchContext(ctx, port)` immediately after `listen()` resolves — the exact sequencing this plan's design assumes and tests exercise via a fixed fake port.
- Plan 07 (packaging smoke test) can hit `GET /api/health` through the built artifact with the real launch token to prove the packaged CLI serves the same contract this plan's suite proves against source.
- No blockers. `packages/server/src/` now has a fully composed, guard-complete `buildApp()` with zero routes beyond `/api/health` — Plan 05 adds the config CRUD routes on top of this exact foundation.

---
*Phase: 02-local-loopback-server-cli-security-hardening*
*Completed: 2026-07-12*
