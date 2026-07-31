# Coding Conventions

**Analysis Date:** 2026-07-31

## Naming Patterns

**Files:**
- Node packages (`packages/**`) use kebab-case: `atomic-write.ts`, `schema-convert.ts`, `active-schema-manager.ts`, `snapshot-store/paths.ts`, `routes/configs.ts`.
- React components (`web/src/components/**`) use PascalCase: `FieldCard.tsx`, `AppShell.tsx`, `HistoryWorkspace.tsx`, `SnapshotTimeline.tsx`.
- Frontend pure-logic modules (`web/src/schema`, `web/src/history`, `web/src/api`) use lowercase: `effective.ts`, `compare.ts`, `time.ts`, `client.ts`, `configs.ts`, `indexSchema.ts`, `patchProject.ts`.
- Test files use `<module>.test.ts` / `<module>.test.tsx` matching the module under test (e.g. `packages/config-io/src/atomic-write.ts` → `test/config-io/atomic-write.test.ts`).
- Data files (JSON) use kebab-case: `bundled-schema.json`, `bundled-schema-meta.json`, `curated-docs.json`, `specialized-catalog.json`.
- Config files: `tsconfig.json` (Node scope), `tsconfig.web.json` (web scope), `vitest.config.ts`, `vite.config.ts`, `tsup.config.ts`.

**Functions:**
- `camelCase`, verb-first: `saveConfig`, `writeWithRetry`, `buildApp`, `loadConfig`, `indexSchema`, `trackConfig`, `listConfigs`.
- Factory functions use `create` prefix: `createValidator` (`packages/config-io/src/validate.ts`), `createRegistry` (`packages/server/src/registry.ts`), `createWorkspaceStore` (`packages/server/src/workspace-store.ts`), `createLaunchContext` (`packages/server/src/context.ts`), `createClientValidator` (`web/src/schema/validation.ts`), `createOutput` (`packages/cli/src/output.ts`).
- Server route/plugin registration uses `register` prefix: `registerHostGuard`, `registerOriginGuard`, `registerTokenGuard` (`packages/server/src/plugins/*`), `registerStatic` (`packages/server/src/static/serve.ts`).
- Fastify plugin factories are named `*Routes` (one per route file): `configRoutes`, `healthRoutes`, `historyRoutes`, `schemaRoutes`, `workspaceRoutes`, `pickerRoutes` in `packages/server/src/routes/*.ts`.
- Pure helpers extracted for unit testing are exported on their own: `parseBannerUrl` in `test/server/helpers/spawn-cli.ts`, `snapshotDirFor` in `packages/server/src/snapshot-store/paths.ts`.

**Variables:**
- `camelCase`. Local throwaway state uses short names: `app`, `opts`, `req`, `reply`, `err`, `ctx`.
- Module-level constants use `UPPER_SNAKE_CASE`: `RETRYABLE_CODES`, `MAX_ATTEMPTS`, `BASE_DELAY_MS` (`packages/config-io/src/atomic-write.ts`), `VENDOR_KEYWORDS` (`packages/config-io/src/validate.ts`), `HASH_PATTERN` (`packages/server/src/snapshot-store/index.ts`).
- Test-local constants use `UPPER_SNAKE_CASE` at module top: `FAKE_PORT`, `TOKEN`, `HOST`, `CORS_ORIGIN` (`test/server/api-routes.test.ts`).

**Types:**
- Interfaces and type aliases use `PascalCase`: `LoadResult`, `ValidationResult`, `EffectiveLeaf`, `EffectiveNode`, `UnknownKeyEntry` (`packages/config-io/src/types.ts`), `LaunchContext` (`packages/server/src/context.ts`), `BuildAppOptions` (`packages/server/src/app.ts`).
- Data-transfer shapes shared with the UI live in `packages/server/src/api-types.ts`: `ApiOk`, `ApiErr`, `TrackedConfig`, `HistorySnapshotMeta`.
- Options objects are named `*Options` and passed last: `LoadOptions`, `BuildAppOptions`, `ConfigRoutesOptions`, `SpawnCliOptions`.
- Error subclasses are `PascalCase` ending in `Error`: `ValidationError`, `ApiError`, `SnapshotReadError`, `RegistryError`.

## Code Style

**Formatting:**
- No ESLint or Prettier config exists in the repo (`.eslintrc*`, `.prettierrc*`, `eslint.config.*`, `biome.json`, `.editorconfig` all absent). Style is enforced by convention and `tsc` typecheck only.
- Semicolons are used consistently across `packages/` and `web/src/` (all 105 source files use them).
- Single quotes for string literals.
- 2-space indentation.
- `"type": "module"` in `package.json` — ESM throughout.
- Trailing commas in multi-line object/array literals and function params (see `packages/server/src/app.ts`, `packages/config-io/src/index.ts`).

**Linting:**
- No lint tool is configured. The only static checks are `npm run typecheck` (`tsc --noEmit && tsc -p tsconfig.web.json --noEmit`) and the test suites.
- `tsconfig.json` sets `"strict": true` for the Node scope; `tsconfig.web.json` sets `"strict": true` for the web scope.

**Import/Export Style:**
- Named exports only — no default exports in library modules. Entry points use named exports too (`export function main(...)` in `packages/cli/src/cli-main.ts`; React components use `export function Xxx(...)`).
- `export type { ... }` for type-only re-exports (`packages/config-io/src/index.ts`).
- `import type { ... }` for type-only imports throughout.
- Extension rules follow moduleResolution:
  - Node scope (`packages/**`, most of `test/**`), compiled with `moduleResolution: NodeNext`, uses explicit `.js` extensions on relative imports: `import { load } from './load.js';` (`packages/config-io/src/index.ts`), `import { buildApp } from '../../packages/server/src/app.js';` (`test/server/api-routes.test.ts`).
  - Web scope (`web/src/**`), compiled with `moduleResolution: Bundler`, uses extensionless relative imports: `import { AppShell } from './components/AppShell';` (`web/src/App.tsx`), `import { useUiStore } from '../../state/uiStore';` (`web/src/components/fields/FieldCard.tsx`).
  - Test files under `test/web/` are compiled under both configs; they use `.js` extensions when importing source modules (`../../web/src/state/uiStore.js`) but extensionless for sibling test helpers (`./render-helpers`).

## Import Organization

**Order:**
1. Node builtins: `node:fs`, `node:path`, `node:crypto`, `node:child_process`, `node:os`, `node:url`, `node:module` (always first).
2. External packages: `fastify`, `ajv`, `commander`, `react`, `vitest`, `@testing-library/react`, `@tanstack/react-query`, `zustand`, `write-file-atomic`, `proper-lockfile`, `json-diff-kit`.
3. Internal relative imports, with cross-package before same-package, e.g. `packages/server/src/snapshot-store/index.ts` imports `../../../config-io/src/atomic-write.js` before `./paths.js`.

**Path Aliases:**
- None. All internal imports are relative. There are no `@/*` or `~/*` path aliases in either tsconfig. `packages/**` sources are plain relative imports inlined by tsup at bundle time (see `tsup.config.ts` header comment).

## Error Handling

**Patterns:**
- Result-object contracts for expected failures rather than exceptions: validators return `{ valid: boolean; errors: object[] }` (`ValidationResult` in `packages/config-io/src/types.ts`); `load()` returns a `LoadResult`; the API uses `ApiOk`/`ApiErr` envelopes. Callers branch on `valid`/`ok`, never `try/catch` for ordinary validation failure.
- Custom `Error` subclasses for typed exceptional failures, each setting `this.name`: `ValidationError` (`packages/config-io/src/atomic-write.ts`), `ApiError` (`web/src/api/client.ts`), `SnapshotReadError` with a discriminated `code` union (`packages/server/src/snapshot-store/index.ts`).
- Server guards send HTTP responses directly (`reply.code(403).send({ ok: false, errors: [{ message }] })`) rather than throwing — see the comment in `packages/server/src/app.ts`.
- A single global error handler in `packages/server/src/app.ts` catches genuinely unexpected thrown errors, logs the real message server-side only (`warn(...)`), and always replies with a fixed static path-free `'Internal error'` message.
- The `errBody(message)` helper (`packages/server/src/routes/configs.ts`) builds the standard `{ ok: false, errors: [{ message }] }` envelope.
- Information Disclosure is a first-class concern: error messages never include config file contents or secret values. `formatErrors` (`packages/config-io/src/validate.ts`) emits only `instancePath` + `keyword` + static message. `load.ts` embeds only the file path in parse errors, never contents.
- Error objects are narrowed with `(err as NodeJS.ErrnoException).code` checks for filesystem error codes (ENOENT, EPERM, EBUSY, EACCES).

**Retry/backoff pattern:**
- `writeWithRetry` (`packages/config-io/src/atomic-write.ts`) retries transient Windows rename errors (EPERM/EBUSY/EACCES) with exponential backoff `BASE_DELAY_MS * 2 ** attempt` up to `MAX_ATTEMPTS`, rethrowing non-retryable codes immediately.

## Logging

**Framework:** No logging library. Fastify's logger defaults to OFF (`logger: opts.logger ?? false` in `packages/server/src/app.ts`) — a quiet-by-default choice documented in the module header. The CLI's own stdout banner (`packages/cli/src/output.ts`, `createOutput()`) is the user-facing channel.

**Patterns:**
- A `warn?: (message: string) => void` callback is dependency-injected into `buildApp` and `configRoutes`, defaulting to `console.warn` — used for non-fatal warnings (e.g. snapshot-record failure, unexpected server errors).
- Client-facing responses never include log detail; logs are server-side only.
- `console.error` is used in the CLI shim `packages/cli/src/cli.ts` for fatal bootstrap errors.

## Comments

**When to Comment:**
- Every module begins with a `/** */` header doc comment explaining the module's purpose, load-bearing invariants, and cross-references to design research docs (e.g. `02-RESEARCH.md § Decision: Atomic-Write Mechanics`, `SAVE-01`). See `packages/server/src/app.ts`, `packages/config-io/src/atomic-write.ts`, `packages/server/src/snapshot-store/index.ts`.
- Comments explain WHY and constraints, not WHAT the code does.
- Security mitigations are called out inline with the threat ID (e.g. `T-02-13`, `T-01-InfoDisc-W`) and in module headers.
- Inline comments flag invariants, e.g. the SAVE-03 "never mutate raw.project" invariant in `packages/config-io/src/load.ts`.
- Test files carry header comments describing the suite intent, the TDD/red state, and any load-bearing test-title references.
- "Deviation" comments document deliberate departures from plan contracts with the rule number, e.g. `fillMissingCanonicalDefaults` in `packages/config-io/src/load.ts`.

**JSDoc/TSDoc:**
- JSDoc-style `/** */` used on exported functions, interfaces, and non-obvious constants. Interface fields get `/** ... */` field docs (see `packages/config-io/src/types.ts`, `packages/server/src/api-types.ts`).
- No JSDoc for trivial/local functions.

## Function Design

**Size:** Functions are small and single-purpose. Large flows are decomposed into named helpers even when called once (see the numbered helpers in `packages/config-io/src/load.ts` and the test harness `test/server/helpers/spawn-cli.ts`).

**Parameters:**
- Options objects (`*Options` interfaces) are passed for multi-option configuration, always last.
- Dependency injection is the dominant seam pattern: `saveConfig(path, obj, validate)` injects the validator (`packages/config-io/src/atomic-write.ts`); `buildApp(opts)` injects `workspaceRoot`, `snapshotRoot`, `now`, `warn`, `activeSchemaManager`, `registry` (`packages/server/src/app.ts`); `recordSnapshot(..., deps.write)` injects the atomic write function (`packages/server/src/snapshot-store/index.ts`). This makes tests supply stubs/fixed clocks without mocking modules.

**Return Values:**
- Result objects for expected outcomes (`ValidationResult`, `LoadResult`, `SnapshotReadResult`); thrown `Error` subclasses for exceptional outcomes only.
- `Promise<T>` for all async I/O; `async`/`await` throughout (no `.then` chains in source except in `web/src/api/configs.ts` where small `apiFetch(...).then((r) => r.x)` unwraps the envelope).

## Module Design

**Exports:** Named exports only. A single barrel file `packages/config-io/src/index.ts` is the frozen public API for the config-io package; it is import-only (no logic), with each export grouped under a comment referencing the owning requirement (e.g. `// Read side (DISC-06, SAVE-03)`).

**Barrel Files:** Only `packages/config-io/src/index.ts`. Internal helpers are intentionally NOT re-exported.

**Type placement:** Types live either co-located with implementation (`web/src/schema/indexSchema.ts`, `packages/server/src/app.ts`) or in dedicated type modules: `packages/config-io/src/types.ts`, `packages/server/src/api-types.ts`, `packages/schema-data/src/source-types.ts`.

**Fastify structure:** Each route file exports a `FastifyPluginAsync` (`configRoutes`, `healthRoutes`, etc.); guards are `register*` functions in `packages/server/src/plugins/`. `packages/server/src/app.ts` is the composition root registering them in a load-bearing order (documented in its header).

**Entry points:** `packages/cli/src/cli.ts` is a deliberate thin shim (`#!/usr/bin/env node`) that shims `globalThis.require` then dynamically imports `./cli-main.js`; all Commander logic lives in `cli-main.ts`.

## React Component Conventions

- Function components with named `export function` declarations (no `export default`, no `React.FC`).
- Props typed via `interface XxxProps`.
- Hooks: `useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`, `useSyncExternalStore`. `react-hook-form`'s `useController`/`useForm` for form fields.
- `data-testid` attributes on field-level elements for tests: `data-testid={`field-${field.path}`}` (`web/src/components/fields/FieldCard.tsx`).
- BEM-flavored CSS classes with a `gsd-` prefix: block `gsd-field-card`, element `gsd-field-card__header`, modifier `gsd-field-card--highlighted` (`web/src/styles.css`). CSS custom properties use `--gsd-*` tokens defined on `:root` with a `prefers-color-scheme: dark` override.

## State Management

- UI state: a single Zustand store `useUiStore` (`web/src/state/uiStore.ts`) holding all sidebar/tab/workspace-mode/search state plus action setters.
- Server state: TanStack Query with a shared `QueryClient` in `web/src/state/queryClient.ts`.
- Draft editing state: module-level `Map`/`Set` plus `useSyncExternalStore` in `web/src/editor/useConfigDraft.ts` (module-level `entries` Map, `listeners` Set, `notify`/`subscribe`/`update` helpers).

## Security Conventions

- Per-session token guard, origin guard, and host allowlist are always registered inside the `/api` Fastify plugin scope (`packages/server/src/app.ts`); static assets are intentionally outside the token guard.
- Server responses never leak absolute filesystem paths; the global error handler and `load()` both scrub paths from client-facing messages (asserted in `test/server/api-routes.test.ts` and `test/server/security.test.ts`).
- `additionalProperties` is never set to `false` in compiled schemas so future gsd-core keys never block a save (`packages/config-io/src/validate.ts`).
- Secret-shaped fields are redacted from history diffs (`HISTORY_REDACTION_MARKER` in `web/src/history/compare.ts`).

---

*Convention analysis: 2026-07-31*
