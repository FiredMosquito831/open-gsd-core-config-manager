---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 04
current_phase_name: pool-editors-model-profile-specialization
status: verifying
stopped_at: Completed 05-09-PLAN.md
last_updated: "2026-07-19T17:30:13.815Z"
last_activity: 2026-07-18
last_activity_desc: Phase 04 execution resumed (wave continue)
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 34
  completed_plans: 34
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-11)

**Core value:** A user can open any GSD `config.json`, understand exactly what every setting and option means, and change it correctly and safely — without ever reading the gsd-core source or docs.
**Current focus:** Phase 04 — pool-editors-model-profile-specialization

## Current Position

Phase: 04 (pool-editors-model-profile-specialization) — EXECUTING
Plan: 5 of 5
Status: Phase complete — ready for verification
Last activity: 2026-07-18 — Phase 04 execution resumed (wave continue)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 20
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 7 | - | - |
| 02 | 7 | - | - |
| 03 | 6 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01-schema-foundation-data-layer-safety P01 | 8min | 3 tasks | 10 files |
| Phase 01 P02 | 30min | 3 tasks | 4 files |
| Phase 01 P03 | 10min | 2 tasks | 4 files |
| Phase 01 P04 | 12min | 2 tasks | 4 files |
| Phase 01-schema-foundation-data-layer-safety P05 | 10min | 2 tasks | 4 files |
| Phase 01 P06 | 9min | 2 tasks | 4 files |
| Phase 01-schema-foundation-data-layer-safety P07 | 22min | 2 tasks | 5 files |
| Phase 02 P01 | 12min | 3 tasks | 4 files |
| Phase 02 P02 | 15min | 3 tasks | 4 files |
| Phase 02 P03 | 8min | 2 tasks | 3 files |
| Phase 02 P04 | 20min | 3 tasks | 9 files |
| Phase 02 P05 | 20min | 3 tasks | 8 files |
| Phase 02 P06 | 20min | 3 tasks | 7 files |
| Phase 02 P07 | 25min | 4 tasks | 4 files |
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 04 P01 | 8min | 3 tasks | 5 files |
| Phase 05-version-history-ui P01 | 22min | 3 tasks | 5 files |
| Phase 05-version-history-ui P02 | 17min | 2 tasks | 5 files |
| Phase 05-version-history-ui P04 | 34min | 2 tasks | 3 files |
| Phase 05 P03 | 3h17min | 2 tasks | 5 files |
| Phase 05 P05 | 25min | 3 tasks | 7 files |
| Phase 05 P06 | 29min | 3 tasks | 7 files |
| Phase 05-version-history-ui P08 | 22min | 2 tasks | 2 files |
| Phase 05-version-history-ui P07 | 25min | 2 tasks | 4 files |
| Phase 05-version-history-ui P09 | 27min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase structure: backend-first horizontal layers (schema/data-safety → loopback server/CLI/security → generic UI shell → pool/model-profile editors → version-history UI → live schema reconcile), per research ARCHITECTURE.md build order.
- REQUIREMENTS.md's stated "34 total" v1 requirements count was stale/inaccurate — actual enumerated requirements total 38; ROADMAP.md and REQUIREMENTS.md traceability now use the corrected count.
- [Phase 01-01]: tsconfig.json include widened to also match root *.ts files so tsc --noEmit has an input before types.ts exists
- [Phase 01-01]: vitest.config.ts sets passWithNoTests: true so an empty Wave 0 suite exits 0
- [Phase ?]: [Phase 01-02]: gates.*/safety.* modeled as fixture-observed schema keys; parallelization.* (6 sub-keys) also discovered as an undocumented fixture-observed shape and added during Task 3
- [Phase ?]: [Phase 01-03]: Used TS import-equals-require for ajv/ajv-formats instead of plain ESM default imports to work around a NodeNext + CJS-package default-import typecheck gap
- [Phase 01-04]: readGlobalDefaults uses synchronous fs.readFileSync, matching the existing synchronous style of validate.ts/patch.ts in this package
- [Phase 01-04]: Non-ENOENT read errors in readGlobalDefaults are rethrown unmodified; only JSON.parse failures are wrapped with a path-only error message (T-01-InfoDisc-D mitigation)
- [Phase ?]: [Phase 01-05]: canonicalDefaultsFromSchema stays literal (only declared defaults); load.ts fills missing-default known keys with a null fallback so resolveLeaf never throws against realistic real-world fixtures
- [Phase ?]: [Phase 01-05]: unknown-key walk stops at the first node with zero known schema descendants and records the whole subtree as ONE unknown entry, matching the expected top-level fabricated-key path rather than exploding into per-leaf entries
- [Phase ?]: [Phase 01-06]: write-file-atomic ships no .d.ts and no @types package — added a narrowly-typed ambient declaration (write-file-atomic.d.ts) rather than a blanket any-typed escape hatch
- [Phase ?]: [Phase 01-06]: kill-mid-save.mjs uses a stdout marker handshake so the randomized kill delay is timed from 'about to write' rather than child-process spawn, since node --import tsx startup overhead otherwise swallows the whole kill window
- [Phase ?]: [Phase 01-07]: bundled-schema.json is a flat dot-path metadata map, not an Ajv-compilable JSON Schema -- added schema-convert.ts's buildAjvSchema() to bridge it into a nested schema tree for createValidator()
- [Phase ?]: [Phase 01-07]: added allowUnionTypes/allowMatchingProperties to Ajv2020 constructor options and widened SchemaEntry.type to string|string[] -- required for the real bundled schema to compile under Ajv strict mode
- [Phase 02]: [Phase 02-01]: Human legitimacy checkpoint for fastify/@fastify/static/@fastify/cors approved before install ran
- [Phase 02]: [Phase 02-01]: spawnCli() resolves tsx's ESM CLI entry via process.execPath (no shell:true) for Windows-safe spawning
- [Phase 02]: proper-lockfile's lock() defaults to realpath:true and cannot lock a nonexistent file — saveWithSnapshot pre-touches an empty stub file (after capturing priorContent as null) so brand-new config saves succeed through the frozen saveConfig pipeline
- [Phase ?]: [Phase 02-03]: Placeholder client page kept fully dependency-free (no Vite/React) per 02-CONTEXT.md discretion note
- [Phase ?]: [Phase 02-03]: scripts/build-client.mjs cleans only dist/client (never dist/) so a later tsup step that cleans dist/ cannot race-delete dist/cli.js
- [Phase 02]: [Phase 02-04]: Implemented the plan's <cors_correction> deviation exactly as specified -- @fastify/cors alone cannot produce a server-side 403 for a mismatched Origin (it only omits a response header, invisible to fastify.inject()); a separate origin-guard.ts onRequest hook returns the real 403
- [Phase 02]: [Phase 02-04]: LaunchContext is mutable by design, read at request time rather than captured at hook-registration time, because the ephemeral port (and allowedHosts/corsOrigin derived from it) is only known after listen() resolves; every guard fails closed against an unsealed context
- [Phase ?]: [Phase 02-05]: registry.ts's opaque id is sha256(resolve(path)).hex.slice(0,32), matching the snapshot store's own hashing scheme so an id and its snapshot dir are correlatable in Phase 5
- [Phase ?]: [Phase 02-05]: schema.ts imports bundled-schema.json as a JSON module (with { type: 'json' }) so the server never relies on config-io/load.ts's import.meta.url-relative default path, closing the T-02-26 packaging landmine before Plan 07's bundling
- [Phase ?]: [Phase 02-05]: BuildAppOptions gained registry?/snapshotRoot?/warn? as additive optional fields; the registry is exposed on the returned FastifyInstance via app.decorate('configRegistry', registry) rather than changing buildApp's return type
- [Phase ?]: [Phase 02-06]: Split cli.ts into a require-shim + dynamically-imported cli-main.ts to avoid a Node/tsx module-format-ambiguity error interacting with config-io's frozen import-equals require() syntax
- [Phase ?]: [Phase 02-06]: registerSignalHandlers() gained an additive IPC 'SIGINT'/'SIGTERM' message fallback (inert for real npx launches) since Windows child_process.kill() unconditionally hard-terminates regardless of signal name in this sandboxed shell with no attached console
- [Phase ?]: [Phase 02-07]: tsup needs splitting:false — cli.ts's dynamic import('./cli-main.js') (02-06's require-shim ordering trick) is otherwise emitted as a separate hashed chunk, breaking the single-dist/cli.js contract
- [Phase ?]: [Phase 02-07]: No noExternal in tsup.config.ts — no npm workspaces and no @gsd-config-manager/* package names exist; packages/** are relative imports esbuild inlines automatically (02-RESEARCH.md Pitfall 4 is moot here)
- [Phase ?]: [Phase 02-07]: Build order is a safety invariant — build:cli (tsup, cleans all of dist/) MUST run before build:client (cleans only dist/client); reversing them ships a blank page to every npx user
- [Phase ?]: [Phase 02-07]: Rule-1 fix — bootstrap.ts's defaultClientRoot() used from-source __dirname math (3 levels up), which misresolves once tsup inlines it into dist/cli.js (__dirname is then dist/, dist/client a direct sibling); invisible to every from-source test, caught only by the extracted-tarball smoke run
- [Phase ?]: [Phase 02-07]: DIST-04 real-Ctrl-C ground truth closed by human checkpoint sign-off, retiring the outstanding human-verification item 02-06's IPC-fallback deviation left open
- [Phase ?]: Live source equality is required for every evidence gate mode; cached evidence cannot bypass source drift.
- [Phase ?]: Reviewer instances remain source-backed but read-only when the bundled validation schema lacks a matching shape.
- [Phase ?]: Copy-first custom model configuration persists ordinary project fields without a profile entity.
- [Phase ?]: History uses json-diff-kit Differ with modification detection and LCS arrays; DiffResult is a before/after line tuple suitable for a project-owned renderer.
- [Phase ?]: Phase 5 treats canonical positive safe-integer sequences and restore recovery snapshots as executable security contracts.
- [Phase ?]: History selection accepts only positive safe-integer canonical decimal sequences and derives snapshot locations from resolved tracked config paths.
- [Phase ?]: History detail returns parsed persisted project documents; restore retains raw parsed content only at the saveWithSnapshot boundary.
- [Phase ?]: Malformed index metadata and hash or JSON failures return static path-free errors rather than exposing storage details.
- [Phase ?]: Draft records are keyed by opaque active configuration ID and remain independent across editor/history navigation.
- [Phase ?]: History mode, selected snapshot sequence, and restore notices are UI-only Zustand state.
- [Phase ?]: History comparison remains Snapshot → Current and projects descriptor-sensitive roots before structural diff, summaries, or display values.
- [Phase ?]: History API wrappers accept only opaque IDs and positive safe-integer sequences through apiFetch.
- [Phase ?]: History uses opaque config-and-sequence query keys and only renders the established redacted comparison model.
- [Phase ?]: Restore review uses a project-owned inert focus-trapping alert dialog with Cancel as initial focus.
- [Phase ?]: Restore clears drafts only after authoritative server reload; save-first requires fresh confirmation.
- [Phase ?]: History comparisons now derive tree nodes and summary counts solely from redacted json-diff-kit DiffResult streams, failing closed on malformed rows.
- [Phase ?]: Background history counts are capped at two workers while the selected detail query remains immediate.
- [Phase ?]: Timeline counts derive solely from the redacted Snapshot-to-Current comparison summary and terminal failures require explicit row retry.
- [Phase ?]: History adapter uses typed object/array identity with display paths kept presentation-only.
- [Phase ?]: Selected timeline retry dispatches to selectedDetail.refetch while nonselected work stays bounded.

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1 (schema build) must resolve known gsd-core schema ambiguities (`model_overrides` vs `model_profile_overrides`, top-level vs `planning.*` duplicate keys, `granularities` purpose) against canonical source, not docs prose — flagged by research as needing deeper research during planning.
- Phase 4 (pool/model-profile editors) needs careful UX design for the 5-layer model-resolution precedence and the `gsd install` runtime-baking gotcha on Codex/OpenCode installs.
- Phase 6 (live reconcile) needs research into gsd-core's actual exported shapes/paths at fetch time, since repo structure may shift between versions.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-07-19T17:30:13.754Z
Stopped at: Completed 05-09-PLAN.md
Resume file: None
