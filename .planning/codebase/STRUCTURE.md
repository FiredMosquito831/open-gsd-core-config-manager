# Codebase Structure

**Analysis Date:** 2026-07-31

## Directory Layout

```
gsd-config-manager/
├── package.json            # npm package: bin aliases, engines, scripts, deps
├── tsconfig.json           # Node scope (packages/**, test/**, root *.ts) — NodeNext
├── tsconfig.web.json       # Web scope (web/src/**, test/web/**) — Bundler resolution
├── tsup.config.ts          # Bundles cli.ts → dist/cli.js (single ESM file)
├── vite.config.ts          # Frontend build: root web → dist/client
├── vitest.config.ts        # Test runner config (vmThreads, 60s timeouts)
├── packages/               # Source packages (plain relative imports, no workspaces)
│   ├── cli/                #   CLI entry + process lifecycle
│   ├── config-io/          #   Frozen config file I/O data layer
│   ├── schema-data/        #   Canonical schema artifacts + reconciler
│   └── server/             #   Fastify loopback helper + persistence
├── web/                    # React SPA (Vite root)
│   ├── index.html
│   └── src/
├── scripts/                # Dev/test helper scripts (client copy, launch probes)
├── test/                   # Vitest suites + fixtures + helpers
├── dist/                   # Build output: dist/cli.js + dist/client/**
├── .planning/              # GSD project artifacts (PROJECT.md, ROADMAP.md, phases…)
└── .claude/                # Project CLAUDE.md, worktrees, skills
```

## Directory Purposes

**`packages/cli/`:**
- Purpose: The npm `bin` entry point and process lifecycle.
- Contains: `src/cli.ts` (shim), `src/cli-main.ts` (Commander), `src/bootstrap.ts` (lifecycle), `src/output.ts` (terminal output).
- Key files: `src/cli.ts`, `src/bootstrap.ts`

**`packages/config-io/`:**
- Purpose: Frozen, schema-agnostic config file I/O — read/load, atomic save, Ajv validation, layered merge, prototype-safe patch.
- Contains: `src/index.ts` (public barrel), `load.ts`, `atomic-write.ts`, `validate.ts`, `schema-convert.ts`, `merge.ts`, `known-keys.ts`, `patch.ts`, `discovery.ts`, `types.ts`, `write-file-atomic.d.ts`.
- Key files: `src/index.ts`, `src/atomic-write.ts`, `src/load.ts`

**`packages/schema-data/`:**
- Purpose: The canonical flat dot-path schema, its provenance metadata, curated docs, specialized catalog, and the reconciliation logic that builds them.
- Contains: `bundled-schema.json`, `bundled-schema-meta.json`, `curated-docs.json`, `specialized-catalog.json`, `src/source-types.ts`, `src/reconcile.ts`, `scripts/build-schema.ts`.
- Key files: `bundled-schema.json`, `src/reconcile.ts`, `scripts/build-schema.ts`

**`packages/server/`:**
- Purpose: The local loopback HTTP helper — composes the Fastify app, defines all `/api` routes, owns registry/workspace/snapshot/schema persistence, native OS pickers, and the gsd-core schema-refresh flow.
- Contains: `src/app.ts`, `src/context.ts`, `src/registry.ts`, `src/workspace-store.ts`, `src/active-schema-manager.ts`, `src/schema-refresh-service.ts`, `src/schema-persistence.ts`, `src/schema.ts`, `src/api-types.ts`, `src/picker.ts`, `src/upstream-archive.ts`, `src/capability-registry-parser.ts`, `src/documentation-evidence-parser.ts`, `src/plugins/`, `src/routes/`, `src/snapshot-store/`, `src/static/`.
- Key files: `src/app.ts`, `src/registry.ts`, `src/workspace-store.ts`, `src/routes/configs.ts`, `src/snapshot-store/save-with-snapshot.ts`

**`web/src/`:**
- Purpose: The React SPA — schema-driven config editor, version history, schema maintenance.
- Contains: `main.tsx`, `App.tsx`, `api/`, `bootstrap/`, `state/`, `editor/`, `schema/`, `history/`, `components/`, `styles.css`.
- Key files: `main.tsx`, `api/client.ts`, `editor/useConfigDraft.ts`, `state/uiStore.ts`

**`test/`:**
- Purpose: Vitest suites mirroring the source layout.
- Contains: `config-io/`, `server/`, `web/`, `schema-data/`, `packaging/`, `scripts/`, `stress/`, `helpers/`, `fixtures/`.
- Key files: `server/cli-launch.test.ts`, `server/api-routes.test.ts`, `server/security.test.ts`, `web/editor-save.test.tsx`, `packaging/tarball-contents.test.ts`

**`scripts/`:**
- Purpose: Dev/test helper scripts not part of the shipped package.
- Contains: `build-client.mjs` (copy web → dist/client with extension allowlist), `probe-launch.ts`, `dump-url.ts`, `launch-pty.py`.
- Key files: `build-client.mjs`

**`.planning/`:**
- Purpose: GSD workflow artifacts — `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `codebase/` (these maps), `phases/`, `research/`, `forensics/`, `intel/`, `debug/`, `quick/`.
- Note: `.planning/config.json` is itself the canonical GSD config file the tool edits.

## Key File Locations

**Entry Points:**
- `packages/cli/src/cli.ts`: npm `bin` shim (shebang, `globalThis.require`, dynamic import).
- `packages/server/src/app.ts`: server composition root — `buildApp()`.
- `web/src/main.tsx`: SPA bootstrap (token consumption + React render).

**Configuration:**
- `package.json`: scripts, `bin`, `files`, `engines`, pinned dependencies.
- `tsup.config.ts`: CLI bundle (single ESM `dist/cli.js`, no splitting).
- `vite.config.ts`: frontend build (`root: 'web'`, outDir `../dist/client`).
- `tsconfig.json` / `tsconfig.web.json`: dual TypeScript scopes (Node vs Bundler resolution).
- `vitest.config.ts`: test runner.

**Core Logic:**
- `packages/config-io/src/atomic-write.ts`: lock → validate → atomic-write save pipeline.
- `packages/config-io/src/load.ts`: layered load with provenance + unknown-key bucket.
- `packages/server/src/routes/configs.ts`: read/write config REST routes.
- `packages/server/src/snapshot-store/save-with-snapshot.ts`: save + snapshot orchestration (conflict detection).
- `packages/server/src/active-schema-manager.ts`: authoritative active schema.
- `packages/schema-data/src/reconcile.ts`: canonical schema reconciliation/diff.
- `web/src/editor/useConfigDraft.ts`: form draft lifecycle + client validation + save.
- `web/src/schema/indexSchema.ts`: schema → categories/fields/search index.

**Testing:**
- `test/config-io/`, `test/server/`, `test/web/`: unit/integration/component suites.
- `test/helpers/spawn-cli.ts`: spawns the real CLI from source for integration tests.
- `test/fixtures/`: JSON config fixtures, schema-refresh fixtures, fake-home `.gsd` layout.

## Naming Conventions

**Files:**
- Node packages (`packages/**`): kebab-case — `atomic-write.ts`, `schema-convert.ts`, `active-schema-manager.ts`, `routes/configs.ts`.
- React components (`web/src/components/**`): PascalCase — `FieldCard.tsx`, `AppShell.tsx`, `HistoryWorkspace.tsx`.
- Frontend pure-logic modules (`web/src/schema`, `web/src/history`, `web/src/api`): lowercase — `effective.ts`, `compare.ts`, `client.ts`, `configs.ts`, `indexSchema.ts`, `patchProject.ts`.
- Tests: `<module>.test.ts(x)` mirroring the module under test.
- Route plugins: `routes/<name>.ts` exporting `<name>Routes`.
- Guard plugins: `plugins/<name>.ts` exporting `register<Name>Guard` (or `buildCorsOptions`).
- Schema JSON: `bundled-schema.json`, `bundled-schema-meta.json`, `curated-docs.json`, `specialized-catalog.json`.

**Directories:**
- `packages/<pkg>/src/` holds source; `src/routes/`, `src/plugins/`, `src/snapshot-store/`, `src/static/` are server sub-domains.
- `web/src/components/<feature>/` groups UI by feature (`sidebar`, `chapters`, `fields`, `editor`, `history`, `schema`, `search`, `specialized`, `unknown`, `common`).
- `test/<area>/` mirrors the source area (`config-io`, `server`, `web`, `schema-data`).

## Where to Add New Code

**New Feature:**
- Primary code: put server logic in `packages/server/src/` (routes in `src/routes/`, persistence in `src/` or `src/snapshot-store/`, new plugin guards in `src/plugins/`); put UI in `web/src/components/<feature>/`.
- Tests: `test/server/` for route/integration, `test/web/` for components, `test/config-io/` for data-layer logic.

**New API Endpoint:**
- Add a `<name>Routes` FastifyPluginAsync in `packages/server/src/routes/<name>.ts`, register it inside the `/api` plugin in `packages/server/src/app.ts` (after the guards), add the client wrapper in `web/src/api/<name>.ts`, and extend the frozen types in `packages/server/src/api-types.ts` if a new envelope shape is needed.

**New Field/Editor in the Schema-Driven UI:**
- Schema metadata lives in `packages/schema-data/bundled-schema.json` (regenerated by `npm run build:schema` from a local gsd-core install).
- Specialized editors are declared in `web/src/schema/specializedMetadata.ts` (`SPECIALIZED_METADATA` descriptors) with backing components in `web/src/components/specialized/`.
- Field rendering for scalar/enum fields lives in `web/src/components/fields/`.

**New Validation Rule:**
- Server + client share the same Ajv path: `packages/config-io/src/schema-convert.ts` (`buildAjvSchema`) and `packages/config-io/src/validate.ts` (server), mirrored by `web/src/schema/validation.ts` (client). Keep the client mirror in sync.

**Utilities / shared helpers:**
- Data-layer helpers that must stay frozen: `packages/config-io/src/`.
- Server-only helpers: `packages/server/src/`.
- Frontend pure logic (no JSX): `web/src/schema/` or `web/src/history/`.

## Special Directories

**`dist/`:**
- Purpose: Build output — `dist/cli.js` (tsup) + `dist/client/**` (Vite).
- Generated: Yes (by `npm run build`; `tsup` cleans `dist/`, Vite cleans `dist/client`).
- Committed: No (gitignored).

**`node_modules/`:**
- Purpose: Dependencies.
- Generated: Yes (`npm install`).
- Committed: No.

**`.planning/`:**
- Purpose: GSD workflow state and planning artifacts, including `config.json` (the tool's own config file).
- Generated: Maintained by GSD commands (not build-generated).
- Committed: Yes.

**`test/fixtures/`:**
- Purpose: Static test data — config fixtures, `fake-home/.gsd` layout, `schema-refresh/` fixtures (including a committed `official-github-archive.tar.gz`).
- Generated: No (checked in).
- Committed: Yes.

**`scripts/`:**
- Purpose: Dev/test-only helpers; not shipped in the npm tarball (`package.json` `files` allowlists only `dist/cli.js` + `dist/client/**`).
- Generated: No.
- Committed: Yes.

---

*Structure analysis: 2026-07-31*
