---
phase: 03-generic-schema-driven-ui-shell
plan: 01
subsystem: web-foundation
status: complete
requires: []
provides:
  - Vite React browser build emitting dist/client
  - token-safe SPA bootstrap with in-memory launch token
  - jsdom web test harness
requirements_completed: [SCHEMA-04, EDIT-06]
---

# Plan 03-01 Summary

## What changed

- Installed exact-pinned React, Vite, React Hook Form, Zustand, React Query, jsdom, and React Testing Library dependencies after the user approved the audited recent packages.
- Added a separate browser TypeScript configuration and Vite build rooted at `web/`, emitting only to `dist/client`.
- Replaced the placeholder static page with a minimal React shell.
- Moved launch-token handling into typed bootstrap code: it consumes `?t=` once, immediately removes it from the URL, and retains the token only in module memory for future `x-gsd-token` requests.
- Added jsdom regression coverage for visible shell rendering, URL stripping, and no storage writes.

## Verification

- `npm ls react react-dom react-hook-form @hookform/resolvers zustand @tanstack/react-query vite @vitejs/plugin-react @testing-library/react jsdom @types/react @types/react-dom`
- `npx vitest run test/web/bootstrap.test.tsx --reporter=dot` (1 passed)
- `npm run build:client` (emits `dist/client/index.html`)
- `npm run typecheck` (passed)
- Confirmed existing `dist/cli.js` remains after the client build.

## Decisions

- Browser-only TypeScript is isolated in `tsconfig.web.json`; existing NodeNext source typing remains unchanged.
- Vitest web tests use the per-file jsdom pragma, keeping all existing server/config tests in Node.

## Deviations

- Rule 3: Vitest 4 does not support the planned `environmentMatchGlobs` option; switched to the supported per-file `// @vitest-environment jsdom` pragma.
- The Windows restricted-token sandbox blocks Vite's child-process startup (`spawn EPERM`), so web verification was rerun successfully outside that sandbox.

## Commits

- `b49c723` feat(03-01): establish Vite React foundation
- `de5fc28` feat(03-01): add token-safe React bootstrap