<!-- refreshed: 2026-07-31 -->
# Architecture

**Analysis Date:** 2026-07-31

## System Overview

The application is a single npm package (`gsd-config-manager`) that launches a local loopback HTTP helper (Fastify) and serves a bundled React SPA from `dist/client`. There is no hosted server; the process is a CLI (`npx gsd-config-manager`) that binds `127.0.0.1:0` (OS-assigned ephemeral port), prints/opens a one-time-token URL, and serves both the SPA and a JSON API.

```text
┌─────────────────────────────────────────────────────────────────────┐
│                      CLI Layer  (packages/cli/src/)                  │
│   cli.ts (bin shim) ─▶ cli-main.ts (Commander) ─▶ bootstrap.ts       │
│        │   (createLaunchContext → buildApp → listen → seal → banner) │
└────────┼──────────────────────────────────────────────────────────────┘
         │ globalThis.require shim + dynamic import
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 Server Layer  (packages/server/src/)                 │
│  buildApp()  ── Host guard ── static serve (dist/client)             │
│  └── /api plugin: CORS → Origin guard → Token guard ──▶ routes       │
│      routes: health / configs / history / schema / workspace / picker│
│      registry.ts  (path-traversal boundary)                          │
│      workspace-store.ts  (persisted sidebar list)                    │
│      snapshot-store/  (full-JSON version history)                    │
│      active-schema-manager.ts  +  schema-refresh-service.ts          │
└────────┬──────────────────────────────────────────────────────────────┘
         │ config-io imports (load/save/validate/merge)
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│               Data Layer  (packages/config-io/src/)                  │
│  load.ts ─▶ discovery.ts / merge.ts / known-keys.ts                  │
│  atomic-write.ts ─▶ validate.ts (Ajv) / schema-convert.ts / patch.ts │
└────────┬──────────────────────────────────────────────────────────────┘
         │ inlined flat schema (JSON modules)
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Schema Data  (packages/schema-data/)                     │
│  bundled-schema.json (flat dot-path map) · reconcile.ts · build-     │
│  schema.ts (maintainer script)                                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                   Web / SPA  (web/src/)                              │
│  main.tsx (consume token) → App.tsx → AppShell (3-pane)             │
│  api/ (fetch + x-gsd-token) · state/ (zustand + react-query)        │
│  editor/useConfigDraft.ts · components/ (chapters, fields, history,  │
│  schema, search, sidebar, specialized, unknown)                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| CLI shim | Installs `globalThis.require`, dynamically imports `cli-main` | `packages/cli/src/cli.ts` |
| CLI main | Commander flag parsing (`--port`, `--no-open`), calls bootstrap | `packages/cli/src/cli-main.ts` |
| Bootstrap | Process lifecycle: token mint, listen, seal context, banner, open browser, shutdown | `packages/cli/src/bootstrap.ts` |
| Output | Terminal copywriting contract (ANSI, no deps) | `packages/cli/src/output.ts` |
| Server composition | `buildApp()` — registers guards, static, and `/api` plugin | `packages/server/src/app.ts` |
| Launch context | Mutable per-launch token + allowed hosts + CORS origin | `packages/server/src/context.ts` |
| Security plugins | Host allowlist, Origin check, token check, CORS lock | `packages/server/src/plugins/*.ts` |
| API routes | `configs`, `health`, `history`, `schema`, `workspace`, `picker` | `packages/server/src/routes/*.ts` |
| Config registry | Opaque-id ↔ filesystem-path mapping; the path-traversal boundary | `packages/server/src/registry.ts` |
| Workspace store | Persisted tracked-config list + scan + create | `packages/server/src/workspace-store.ts` |
| Snapshot store | Full-JSON version history + index.json per config | `packages/server/src/snapshot-store/` |
| Active schema | Authoritative active schema generation + override persistence | `packages/server/src/active-schema-manager.ts` |
| Schema refresh | GitHub gsd-core release fetch → parse → reconcile → diff → proposal | `packages/server/src/schema-refresh-service.ts` |
| Config I/O barrel | Frozen public API of the data layer | `packages/config-io/src/index.ts` |
| Load | Read project + global defaults → layered effective tree + unknown bucket | `packages/config-io/src/load.ts` |
| Atomic write | lock → validate → `write-file-atomic` → unlock pipeline | `packages/config-io/src/atomic-write.ts` |
| Validation | Ajv 2020-12 validator factory (flat-schema → Ajv via schema-convert) | `packages/config-io/src/validate.ts` |
| Schema data | Canonical flat schema + reconciliation + build script | `packages/schema-data/` |
| SPA bootstrap | Reads `?t=` launch token, strips it from URL | `web/src/bootstrap/token.ts` |
| SPA shell | 3-pane layout (sidebar / chapters / editor) | `web/src/components/AppShell.tsx` |
| Draft controller | Form state, client validation, save orchestration | `web/src/editor/useConfigDraft.ts` |
| API client | `fetch` wrapper adding `x-gsd-token` and decoding `ApiErr` | `web/src/api/client.ts` |

## Pattern Overview

**Overall:** Layered CLI + local-loopback server + bundled SPA monolith. The `packages/` directories are plain relative-import sources inlined by tsup — NOT npm workspaces. There is a deliberate "frozen" boundary at `packages/config-io/src/index.ts` that the server and UI build against.

**Key Characteristics:**
- Single validation source of truth (Ajv 2020-12) shared server-side (pre-write gate) and client-side (live form feedback) — the same flat `bundled-schema.json` converted to an Ajv schema by `buildAjvSchema()` (`packages/config-io/src/schema-convert.ts`).
- Security model: loopback binding + per-launch random token + Host allowlist + CORS exact-origin lock. Guards are registered in a load-bearing order in `app.ts`.
- Data-safety model: lock → validate → atomic-write → snapshot history → expected-revision conflict detection (no file watching).
- Everything is ESM; bundle-safe JSON module inlining (`with { type: 'json' }`) for schema artifacts so the bundled `dist/cli.js` needs no runtime file resolution.
- Server holds no cross-session state except OS app-data files: workspace metadata, snapshot history, schema override.

## Layers

**CLI Layer:**
- Purpose: Process entry, argument parsing, lifecycle orchestration, terminal output.
- Location: `packages/cli/src/`
- Contains: `cli.ts`, `cli-main.ts`, `bootstrap.ts`, `output.ts`
- Depends on: `packages/server/src/` (`buildApp`, `createLaunchContext`, `sealLaunchContext`, `createWorkspaceStore`, `appDataRoot`)
- Used by: `bin` entry in `package.json`; tests spawn it via `test/server/helpers/spawn-cli.ts`

**Server Layer:**
- Purpose: Local HTTP helper — serves the SPA, exposes the JSON API, owns all filesystem I/O and persistence.
- Location: `packages/server/src/`
- Contains: `app.ts` (composition root), `context.ts`, `plugins/`, `routes/`, `registry.ts`, `workspace-store.ts`, `snapshot-store/`, `active-schema-manager.ts`, `schema-refresh-service.ts`, `schema-persistence.ts`, `picker.ts`, `upstream-archive.ts`, `capability-registry-parser.ts`, `documentation-evidence-parser.ts`, `api-types.ts`, `static/serve.ts`
- Depends on: `packages/config-io/src/index.js` (load/save/validate), `packages/schema-data/` (schema JSON modules + reconcile)
- Used by: CLI layer

**Data Layer (config-io):**
- Purpose: Frozen, schema-agnostic config file I/O — read, write, validate, merge, patch.
- Location: `packages/config-io/src/`
- Contains: `index.ts` (barrel), `load.ts`, `atomic-write.ts`, `validate.ts`, `schema-convert.ts`, `merge.ts`, `known-keys.ts`, `patch.ts`, `discovery.ts`, `types.ts`
- Depends on: `packages/schema-data/src/source-types.js` (type only), Ajv
- Used by: Server layer (runtime), Web layer (types + `schema-convert`/`validation` re-implemented client-side)

**Schema Data Layer:**
- Purpose: The canonical flat schema artifact and its builder/reconciler.
- Location: `packages/schema-data/`
- Contains: `bundled-schema.json`, `bundled-schema-meta.json`, `curated-docs.json`, `specialized-catalog.json`, `src/reconcile.ts`, `src/source-types.ts`, `scripts/build-schema.ts`
- Depends on: local gsd-core install (`$GSD_HOME || ~/.claude/gsd-core/bin`) for regeneration only
- Used by: Server layer, config-io (types), Web layer (imports the JSON modules directly)

**Web / SPA Layer:**
- Purpose: React UI — schema-driven config editor, version history, schema maintenance.
- Location: `web/src/`
- Contains: `main.tsx`, `App.tsx`, `api/`, `bootstrap/`, `state/`, `editor/`, `schema/`, `history/`, `components/`
- Depends on: `packages/config-io/src/types` and `packages/server/src/api-types` (type-only), `packages/schema-data/*.json` (imported as JSON modules), the `/api` HTTP surface
- Used by: browser only

## Data Flow

### Primary Request Path (Load Config)

1. SPA mounts — `web/src/main.tsx` calls `consumeLaunchToken()` (`web/src/bootstrap/token.ts`), stripping `?t=` from the URL.
2. `TrackedConfigSidebar` (`web/src/components/sidebar/TrackedConfigSidebar.tsx`) queries `GET /api/workspace/configs` via `listWorkspaceConfigs()` (`web/src/api/workspace.ts`). The server returns `workspaceStore.list()` with derived per-file status (`packages/server/src/workspace-store.ts`).
3. User selects a config → `useUiStore.setActiveConfigId` (`web/src/state/uiStore.ts`) → `ConfigEditor` (`web/src/components/editor/ConfigEditor.tsx`) issues `loadConfig(id)`.
4. Server route `GET /api/configs/:id` (`packages/server/src/routes/configs.ts`): `registry.resolve(id)` maps the opaque id to a path, reads the file twice around `load()` to detect out-of-band changes, and returns `{ data: LoadResult, revision }`.
5. `load()` (`packages/config-io/src/load.ts`) composes discovery + known-keys + merge into `LoadResult` (raw project/global, provenance-tagged effective tree, unknown-key bucket).
6. `useConfigDraft` (`web/src/editor/useConfigDraft.ts`) builds form defaults from the effective tree and wires react-hook-form + client Ajv validation.

### Primary Request Path (Save Config)

1. User edits a field → `onFieldChange(path, value)` records a change in a per-config `DraftEntry` map and calls `form.setValue` (client-side validation via `web/src/schema/validation.ts`).
2. Save → `saveDraft()` (`web/src/editor/useConfigDraft.ts`): `buildProjectSaveCandidate(loadResult, changes, resets)` (`web/src/schema/patchProject.ts`) clones `loadResult.raw.project` and patches in changes — preserving unknown keys.
3. `saveConfig(id, candidate, baseRevision)` → `PUT /api/configs/:id` with `expectedRevision`.
4. Server route delegates to `saveWithSnapshot` (`packages/server/src/snapshot-store/save-with-snapshot.ts`): acquires per-path + cross-process transaction locks, reads prior content, computes `configRevision(prior)`, and compares against `expectedRevision` (conflict → 409).
5. `saveConfig()` (`packages/config-io/src/atomic-write.ts`): `proper-lockfile` lock → `validate(obj)` (blocking pre-write gate) → `writeWithRetry` (`write-file-atomic` with EPERM/EBUSY/EACCES backoff) → release lock.
6. `recordSnapshot()` (`packages/server/src/snapshot-store/index.ts`) writes the prior content as a full-JSON snapshot `<seq>.json` and appends to `index.json` (D-12: snapshot failure is non-fatal, surfaced as a warning).
7. Returns `SaveResult`; the SPA refreshes via `loadConfig`.

### Schema Refresh Flow

1. `SchemaWorkspace` (`web/src/components/schema/SchemaWorkspace.tsx`) POSTs `POST /api/schema/refresh` (`packages/server/src/routes/schema.ts`), serialized by a lifecycle-tail promise.
2. `SchemaRefreshService.refresh()` (`packages/server/src/schema-refresh-service.ts`): GitHub `releases/latest` → resolve commit → fetch tarball → `inspectPinnedArchive` (`packages/server/src/upstream-archive.ts`, bounded tar.gz parser) → `parseManifest`, `parseCapabilityRegistryLiteral` (`packages/server/src/capability-registry-parser.ts`), `extractDocumentationEvidence` (`packages/server/src/documentation-evidence-parser.ts`).
3. `reconcileSchemaSources` (`packages/schema-data/src/reconcile.ts`) builds a candidate canonical schema; `diffCanonicalSchemas` produces a `SchemaChangeSet`. If non-empty, a 5-minute-expiry proposal is retained in memory.
4. `POST /api/schema/proposals/:id/activate` → `ActiveSchemaManager.activateValidatedProposal` (`packages/server/src/active-schema-manager.ts`) persists the override via `SchemaOverrideStore` (`packages/server/src/schema-persistence.ts`) and bumps `generation` so stale proposals can't be activated.

### Workspace Scan Flow

1. `POST /api/workspace/scan` (`packages/server/src/routes/workspace.ts`) → `workspaceStore.scan()` (`packages/server/src/workspace-store.ts`).
2. Iterative async directory walk using `fs/promises.readdir`/`lstat` (yields the event loop), skipping an `EXCLUDED_DIR_NAMES` blocklist, with caps `MAX_SCAN_DIRS = 5000`, `MAX_SCAN_CANDIDATES = 200`, `MAX_SCAN_DEPTH = 8`.
3. Candidates are `.planning/config.json` files classified as `new` / `tracked` / `invalid`.

**State Management:**
- Server: in-memory `ConfigRegistry` (per-launch, seeded from persisted workspace metadata) + OS app-data files for workspace list, snapshot history, and schema override. No cross-request mutable state except the schema manager's `generation` and refresh service's retained proposal.
- Client: Zustand (`web/src/state/uiStore.ts`) owns UI state; TanStack Query (`web/src/state/queryClient.ts`) owns server-state cache. The config draft uses a module-level `Map<string, DraftEntry>` + `useSyncExternalStore` in `web/src/editor/useConfigDraft.ts` (survives across query refetches while the form stays mounted).

## Key Abstractions

**LaunchContext:**
- Purpose: Per-launch security state (token, allowed hosts, CORS origin) read by guard hooks at request time.
- Examples: `packages/server/src/context.ts`
- Pattern: Mutable context closed over by `registerHostGuard` / `registerOriginGuard` / `registerTokenGuard` / `buildCorsOptions`; fails closed until `sealLaunchContext` runs.

**ConfigRegistry:**
- Purpose: The single path-traversal boundary. `track()` is the only place a client-supplied filesystem path is accepted; everything else resolves an opaque `sha256(path).slice(0,32)` id.
- Examples: `packages/server/src/registry.ts`
- Pattern: Factory (`createRegistry`) — no module-level singleton.

**ActiveSchemaSnapshot:**
- Purpose: Immutable authoritative schema + validator + metadata + status shared by every schema-sensitive operation.
- Examples: `packages/server/src/active-schema-manager.ts`
- Pattern: `Object.freeze`d snapshot; `ActiveSchemaManager` swaps the active snapshot and increments a `generation` counter.

**SaveResult / LoadResult:**
- Purpose: Frozen contracts for the write and read sides of the config pipeline.
- Examples: `packages/server/src/snapshot-store/save-with-snapshot.ts` (`SaveResult`), `packages/config-io/src/types.ts` (`LoadResult`)
- Pattern: Discriminated unions (`{ ok: true } | { ok: false, errors } | { ok: false, conflict }`).

**ApiOk / ApiErr:**
- Purpose: Frozen REST envelope types — every `/api` response is exactly one of these.
- Examples: `packages/server/src/api-types.ts`
- Pattern: `{ ok: true } & T` success envelope; `{ ok: false, errors: [{ message, ... }] }` error envelope.

**CanonicalSchema / SchemaEntry:**
- Purpose: Flat dot-path-keyed metadata catalog (not a nested JSON-Schema tree). Each entry carries `type`, `enum`, `default`, `title`, and `x-*` vendor keys (`x-category`, `x-description`, `x-provenance`, `x-options`, `x-dynamic-key-hint`, `x-specialized`).
- Examples: `packages/schema-data/src/source-types.ts`, `packages/schema-data/bundled-schema.json`
- Pattern: Converted to an Ajv schema by `buildAjvSchema()` in `packages/config-io/src/schema-convert.ts`.

## Entry Points

**CLI Entry:**
- Location: `packages/cli/src/cli.ts`
- Triggers: `npx gsd-config-manager` / `npx gsd-config-editor` (`bin` in `package.json` both → `./dist/cli.js`); also spawned from source by tests via `test/server/helpers/spawn-cli.ts`
- Responsibilities: Install `globalThis.require`, dynamically import `cli-main.js`, forward `process.argv`.

**Server Composition:**
- Location: `packages/server/src/app.ts` — `buildApp(opts)`
- Triggers: called by `packages/cli/src/bootstrap.ts` (and by tests directly)
- Responsibilities: Create Fastify instance, register root-scope host guard + static serving, register the encapsulated `/api` plugin (CORS → origin guard → token guard → routes), install the global error handler.

**SPA Entry:**
- Location: `web/src/main.tsx`
- Triggers: browser load of `dist/client/index.html` (or dev-server)
- Responsibilities: Read the launch token from the URL, render `<App />` inside `QueryClientProvider`.

## Architectural Constraints

- **Loopback-only binding:** The server binds `127.0.0.1` and nothing else; port `0` (OS-assigned) by default, `--port` override allowed. No flag/env can change the host (`packages/cli/src/bootstrap.ts`).
- **Per-launch token:** `crypto.randomUUID()` minted at launch, embedded in the auto-opened URL (`?t=`), checked on every `/api` request via `x-gsd-token` header. Never logged, never echoed (`packages/server/src/context.ts`, `packages/server/src/plugins/token-guard.ts`).
- **Guard registration order is load-bearing:** host guard first at root scope → static serving at root scope (outside `/api` so the SPA can load to obtain the token) → `/api` plugin: CORS (for preflight short-circuit) → origin guard → token guard → routes (`packages/server/src/app.ts`).
- **Frozen config-io contract:** `packages/config-io/src/index.ts` is the single import surface; adding/renaming exports there is an expensive downstream change. Internal helpers are not re-exported.
- **Single validation source:** Ajv 2020-12 (`packages/config-io/src/validate.ts`) is used server-side; the client mirrors it with `web/src/schema/validation.ts` (same `buildAjvSchema`). No Zod/Valibot.
- **Bundle-safe schema inlining:** Schema JSON files are imported with `with { type: 'json' }` so tsup/esbuild inlines them into `dist/cli.js` — no runtime path resolution for the shipped artifact (`packages/server/src/schema.ts`).
- **Atomicity + locking:** Every write path uses `write-file-atomic` (temp + fsync + rename) and `proper-lockfile` advisory locks; cross-process save transactions are serialized via `tmpdir`-based lock files keyed by `sha256(resolved path)` (`packages/server/src/snapshot-store/save-with-snapshot.ts`).
- **No file watching:** Out-of-band changes are detected via `expectedRevision` conflict checks (ETag-style hash of the exact on-disk bytes), not `chokidar`.
- **Path validation centralization:** `registry.track()` / `registry.relocate()` / `workspaceStore.scan()` / `createPreview()` / `create()` are the only places absolute paths are validated; every rejection uses a fixed, static message that never echoes the rejected path (T-02-25).
- **Information-disclosure discipline:** Errors never include config content or user-supplied values; only static messages + file paths. Version-history diffs redact catalog-defined sensitive roots (`web/src/history/compare.ts` `projectHistoryDocument`).
- **Type-only cross-layer imports:** The web layer imports types from `packages/config-io/src/types.ts` and `packages/server/src/api-types.ts` without importing server runtime code.

## Anti-Patterns

### `globalThis.require` Shim

**What happens:** `packages/cli/src/cli.ts` mutates `globalThis.require` before dynamically importing the rest of the app, because `packages/config-io/src/validate.ts` uses TypeScript's `import X = require(...)` form (its own workaround for an Ajv/ajv-formats CJS-interop typecheck gap under NodeNext).
**Why it's wrong:** It is a documented, deliberate runtime mutation of a global, required only because a frozen module (validate.ts) uses a CJS-import form that `tsc` shims but tsx/esbuild do not. Any future refactor that statically imports `cli-main.js` before the shim breaks at runtime.
**Do this instead:** Keep the dynamic-import ordering intact; treat `cli.ts` as a frozen shim. If `validate.ts` is ever unfrozen, replace the import-equals with an ESM-compatible import and delete both workarounds.

### Module-Level Async Mutex Maps

**What happens:** `packages/server/src/snapshot-store/save-with-snapshot.ts` (module-level `pathLocks`) and `packages/server/src/workspace-store.ts` (module-level `createLocks`) keep `Map<string, Promise>` in-memory async mutexes keyed by resolved path.
**Why it's wrong:** These are process-local only; cross-process concurrency is still handled separately via `proper-lockfile` transaction locks in `tmpdir`. The two mechanisms overlap and must stay in sync — one handles in-process queueing, the other cross-process exclusion.
**Do this instead:** Keep both but document that the in-process map only serializes within one helper process; never rely on it as the sole concurrency control.

### Dual-Layout `__dirname` Walk

**What happens:** `packages/cli/src/bootstrap.ts#defaultClientRoot()` tries a bundled-sibling `dist/client` layout first, then falls back to a from-source three-levels-up walk — because `__dirname` means different things when running from source (tsx) versus the bundled `dist/cli.js`.
**Why it's wrong:** This runtime path walk is a landmine: the from-source math silently misses the shipped bundle if layout assumptions drift.
**Do this instead:** The schema artifacts already avoid this via JSON-module inlining; the client bundle cannot be inlined, so keep the try-bundled-then-source fallback but guard it with the `index.html` existence check (already present).

## Error Handling

**Strategy:** Three-tier — guards send direct `reply.code(403).send(...)` envelopes; a project-wide `setErrorHandler` (`packages/server/src/app.ts`) catches only genuinely unexpected thrown errors and always returns a fixed static `{ ok: false, errors: [{ message: 'Internal error' }] }` (never the real message, which may embed paths); `config-io` distinguishes `ValidationError` (soft, maps to 422) from genuine write failures (propagate).

**Patterns:**
- Validation failure: `{ ok: false, errors: result.errors }` → HTTP 422, file byte-unchanged.
- Stale revision: `{ ok: false, conflict: true }` → HTTP 409.
- Unknown id / deleted file: HTTP 404 with static "Unknown tracked config id".
- Snapshot failure: non-fatal, converted to a `warning` string (D-12), never fails the save.
- Client (`web/src/api/client.ts`): `ApiError` class; 409 → `isStale` draft flag; other errors → `serverErrors` list rendered by `ValidationSummary`.

## Cross-Cutting Concerns

**Logging:** Fastify logger defaults OFF (`buildApp` `logger: false`); the CLI stdout banner (`packages/cli/src/output.ts`) is the user channel. `warn` sinks are injected throughout for non-fatal warnings. Nothing logs request bodies or tokens.
**Validation:** Ajv 2020-12 is the single source; `buildAjvSchema` converts the flat canonical schema; `additionalProperties` is never set, so unknown/future keys always validate (never block a save).
**Authentication:** Loopback + per-launch `x-gsd-token` header; `@fastify/cors` exact-origin lock; Host allowlist against DNS rebinding.

---

*Architecture analysis: 2026-07-31*
