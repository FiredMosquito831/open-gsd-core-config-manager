# Technology Stack

**Analysis Date:** 2026-07-31

## Languages

**Primary:**
- TypeScript 5.9.3 - Entire application: CLI (`packages/cli/`), data I/O layer (`packages/config-io/`), schema data (`packages/schema-data/`), loopback server (`packages/server/`), and React SPA (`web/src/`). Pinned to `5.9.3` (NOT `latest`/7.x) per project conventions.

**Secondary:**
- JavaScript (ESM) - Dev/test helper scripts: `scripts/build-client.mjs`, `scripts/probe-launch.ts` (tsx), `test/stress/kill-mid-save.mjs`, `test/scripts/verify-phase4-source-evidence.mjs`
- Python 3 - `scripts/launch-pty.py` (launches the bundled CLI in a real PTY to capture the launch URL; test/dev tooling only)
- JSON - Schema data artifacts under `packages/schema-data/*.json`; test fixtures under `test/fixtures/`

## Runtime

**Environment:**
- Node.js `>=20.19` (declared in `package.json` `engines`). Built output targets `node20` (`tsup.config.ts`).
- ESM everywhere: `package.json` sets `"type": "module"`; all imports use `.js` extensions in source; tsup emits a single ESM bundle.

**Package Manager:**
- npm (lockfile: `package-lock.json` present at repo root, no npm workspaces — the `packages/*` sources are plain relative imports inlined by tsup, not workspace packages)

## Frameworks

**Core:**
- React 19.2.7 + react-dom 19.2.7 - SPA UI (`web/src/`), rendered via `createRoot` in `web/src/main.tsx`
- Fastify 5.10.0 - Local loopback HTTP helper. Composition root is `buildApp()` in `packages/server/src/app.ts`. Encapsulated `/api` plugin scope for all API routes; static SPA serving at root scope.

**Testing:**
- vitest 4.1.10 - Unit + integration tests for both server and web; config in `vitest.config.ts`
- jsdom 29.1.1 - DOM environment for React component tests (`test/web/*.tsx`)
- @testing-library/react 16.3.2 - React component test utilities

**Build/Dev:**
- Vite 8.1.4 - Frontend dev server + production build (`vite.config.ts`, root `web`, outDir `../dist/client`)
- tsup 8.5.1 - Bundles the Node CLI/server into `dist/cli.js` (single ESM file, no code splitting)
- @vitejs/plugin-react 6.0.3 - React JSX + Fast Refresh for Vite
- tsx 4.23.0 - Runs TypeScript scripts directly (`npm run build:schema`, `scripts/probe-launch.ts`)

## Key Dependencies

**Critical:**
- Ajv 8.20.0 + ajv-formats 3.0.1 - JSON Schema 2020-12 validation. Single validation source of truth. Uses `Ajv2020` from `ajv/dist/2020.js` (draft-07 default would silently mis-validate). See `packages/config-io/src/validate.ts`.
- react-hook-form 7.81.0 + @hookform/resolvers 5.4.0 - Form state orchestration for the schema-driven config editor; `useForm`, `useController`, `useWatch` in `web/src/editor/useConfigDraft.ts`, `web/src/components/fields/FieldCard.tsx`.
- @tanstack/react-query 5.101.2 - Server-state layer for the local REST API (`web/src/state/queryClient.ts`, `web/src/api/*`).
- zustand 5.0.14 - Client UI state (`web/src/state/uiStore.ts`).
- json-diff-kit 1.0.35 - Structural JSON diff engine for version-history diff view (`web/src/history/compare.ts`).
- Commander 15.0.0 - CLI argument parsing (`packages/cli/src/cli-main.ts`: `--port`, `--no-open`).

**Infrastructure:**
- write-file-atomic 7.0.1 (pinned — NOT 8.x, which raises the Node engines floor) - Atomic file writes (temp + fsync + rename). See `packages/config-io/src/atomic-write.ts`.
- proper-lockfile 4.1.2 - Advisory file locking for concurrent-writer protection (`atomic-write.ts`, `workspace-store.ts`, `snapshot-store/index.ts`, `save-with-snapshot.ts`).
- env-paths 4.0.0 - OS app-data directory resolution for snapshots/workspace/schema persistence (`packages/server/src/snapshot-store/paths.ts`).
- open 11.0.0 - Auto-opens the user's browser after the loopback server binds (`packages/cli/src/bootstrap.ts`).
- @fastify/cors 11.3.0 - CORS lock on the local API (`packages/server/src/plugins/cors.ts`).
- @fastify/static 10.1.0 - Serves the built SPA `dist/client` (`packages/server/src/static/serve.ts`).

## Configuration

**Environment:**
- No `.env` files, no dotenv usage. Environment variables read directly:
  - `GSD_HOME` - Overrides the home dir for global defaults discovery (`packages/config-io/src/discovery.ts`) and the build-time schema source (`packages/schema-data/scripts/build-schema.ts`)
  - `NO_COLOR` - Stripped in `scripts/launch-pty.py` (test helper)
- No runtime configuration files. The server binds `127.0.0.1` with port `0` (OS-assigned) by default; `--port` overrides.

**Build:**
- `tsconfig.json` - Backend/server/node code: `module: NodeNext`, `moduleResolution: NodeNext`, target ES2022, `types: ["node"]`. Includes `packages/**/*.ts`, `test/**/*.ts`, root `*.ts`.
- `tsconfig.web.json` - Frontend code: `module: ESNext`, `moduleResolution: Bundler`, `jsx: react-jsx`, DOM libs, `types: ["node", "vitest/globals"]`. Includes `web/src/**` and `test/web/**`.
- `tsup.config.ts` - Entry `packages/cli/src/cli.ts`, ESM format, `platform: node`, `target: node20`, `clean: true`, `splitting: false` (single `dist/cli.js` output).
- `vite.config.ts` - `root: 'web'`, react plugin, `build.outDir: '../dist/client'`, `emptyOutDir: true`.
- `vitest.config.ts` - Includes `test/**/*.test.{ts,tsx}`, `environment: 'node'` (per-file `@vitest-environment jsdom` for web tests), `pool: vmThreads`, generous 60s timeouts for WSL cold imports.

**Scripts (`package.json`):**
- `test` = `test:ordinary` (excludes integration tests) + `test:integration` (fork pool, maxWorkers=1)
- `test:unit` = `vitest run test/config-io`, `test:server` = `vitest run test/server`
- `typecheck` = `tsc --noEmit` + `tsc -p tsconfig.web.json --noEmit`
- `build:schema` = `tsx packages/schema-data/scripts/build-schema.ts`
- `build:cli` = `tsup`; `build:client` = `vite build`; `build` = `build:cli && build:client`
- `prepublishOnly` = `npm run build`

## Platform Requirements

**Development:**
- Node.js `>=20.19` (Vite 8 floor), npm
- A local gsd-core installation at `$GSD_HOME || ~/.claude/gsd-core/bin` is required to regenerate the bundled canonical schema (`npm run build:schema`). The repo ships a prebuilt `packages/schema-data/bundled-schema.json` so normal dev/test/build does NOT require it.
- WSL2 note: dev/test environment is WSL2; several test helpers account for this (`scripts/launch-pty.py`, `test/server/helpers/spawn-cli.ts`, signal-handling fallback in `packages/cli/src/bootstrap.ts`).

**Production:**
- Published as npm package `gsd-config-manager` (`package.json` `name`), launched via `npx gsd-config-manager` or `npx gsd-config-editor` (both `bin` aliases point at `./dist/cli.js`).
- Package `files` allowlist: `dist/cli.js` + `dist/client/**`. The tarball ships the built SPA inside the package (no CDN).
- `engines.node >= 20.19`. No OS-specific native modules; all deps are pure JS (or use Node built-ins).

## Notable Architecture-Relevant Stack Decisions

- **No Tailwind / no component library**: Styling is hand-written CSS with CSS custom properties (`web/src/styles.css`), following a design-token system (`.gsd-*` classes, light/dark via `prefers-color-scheme`). The CLAUDE.md-recommended `tailwindcss`/`shadcn`/Radix/lucide-react stack is NOT installed.
- **No raw-JSON CodeMirror editor**: `web/src/components/specialized/GenericJsonEditor.tsx` uses a plain `<textarea>` + `JSON.parse` validation, not the CodeMirror 6 fallback the CLAUDE.md recommended.
- **No file watching**: `chokidar` (in CLAUDE.md recommendations) is NOT installed. Out-of-band change detection is instead handled via expected-revision (ETag-style) conflict checks on save (`save-with-snapshot.ts` `configRevision`, `expectedRevision`).
- **No separate E2E framework**: `playwright` is NOT installed. E2E-style coverage is done with vitest integration tests that spawn the real CLI (`test/server/cli-launch.test.ts`) and drive the built SPA via `fastify.inject()` + jsdom.
- **No linter/formatter configured**: No `.eslintrc*`, `.prettierrc*`, or `biome.json`. Code style is enforced by `tsc` strict mode only.
- **`globalThis.require` shim**: `packages/cli/src/cli.ts` shims `require` before dynamically importing `cli-main.js` — a documented workaround for the Ajv/ajv-formats CJS-interop typecheck gap under `moduleResolution: NodeNext`.

---

*Stack analysis: 2026-07-31*
