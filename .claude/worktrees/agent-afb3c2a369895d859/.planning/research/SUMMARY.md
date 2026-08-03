# Project Research Summary

**Project:** GSD Config Manager
**Domain:** npx-launched local-loopback config editor (Node CLI + bundled React/Vite/TS UI) for the `gsd-core` `.planning/config.json` schema
**Researched:** 2026-07-11
**Confidence:** MEDIUM-HIGH

## Executive Summary

This is a local-first developer tool: an `npx`-launched Node process that binds a Fastify server to `127.0.0.1`, serves a bundled React/Vite/TypeScript single-page app, and edits a large (~150+ key, 20+ namespace), deeply-nested, actively-evolving JSON config file (`gsd-core`'s `.planning/config.json`) through a schema-driven, beginner-friendly UI. Experts build this class of tool (Prisma Studio, Storybook, MCP Inspector, JSON-editor/MetaConfigurator-style settings UIs) as: a thin CLI launcher → a loopback HTTP service owning all file I/O → a single canonical JSON-Schema-plus-metadata descriptor that drives both server-side Ajv validation and a generic client-side form renderer → a snapshot-based local version-history store. The recommended stack (Fastify + Ajv + Commander on the backend; React 19 + Vite 8 + Zustand + TanStack Query + react-hook-form/Ajv-resolver + CodeMirror 6 + json-diff-kit on the frontend) is current, cross-checked directly against the npm registry, and deliberately avoids heavier alternatives (Monaco, Redux, RJSF-as-primary-renderer) that don't fit a config-only, beginner-polish, small-bundle tool.

The single biggest risk category is data-integrity/trust: because the tool has filesystem write access to a config file that every GSD command depends on, naive implementations will (a) silently drop unknown/future keys on save, (b) corrupt the file on a crash or Windows file-lock via non-atomic writes, and (c) let any open browser tab issue cross-origin requests against the loopback server (DNS rebinding) despite "it's just localhost" feeling safe. All three are foundational, not bolt-on, decisions — they must be architected correctly in the first (I/O and loopback-server) phase, verified with explicit round-trip/kill-mid-save/cross-origin tests, not discovered later. A second, GSD-specific risk is schema fidelity: `gsd-core`'s own schema has documented drift between its `gsd-tools.cjs` and `sdk/src/config-schema.ts` definitions, several ambiguous/duplicated keys (`model_overrides` vs `model_profile_overrides`, top-level vs `planning.*` aliases), and a runtime gotcha where editing `model_overrides` on Codex/OpenCode-style installs has zero effect until `gsd install` re-runs — the tool must never claim false precision or false immediacy about these.

The recommended approach: build backend-first in strict dependency order (schema model → discovery/config-I/O/validation → atomic-write + snapshot store → CLI/REST/SSE plumbing → generic schema-driven UI → pool/model-profile specializations → version-history UI → live schema-reconcile last). Treat the original parsed JSON object (not the schema-derived form model) as the write-payload source of truth at all times, keep the enforcement-layer validation schema open (never `additionalProperties: false`), and build bespoke editor components for the known polymorphic/pool shapes (`ship.pr_body_sections`, `review.reviewer_instances`, `agent_skills`, the agent-tier maps) rather than trusting a generic JSON-Schema-form library to handle them correctly.

## Key Findings

### Recommended Stack

Backend: Node ≥20.19 (dev on 22/24 LTS), TypeScript 5.9.3 (explicitly not the brand-new 7.0 "tsgo"), Fastify 5.10 + Ajv 8.20 (shared validation engine, avoids a second Ajv instance), Commander 15 for the CLI, `write-file-atomic@7` (not `@8`, which has too new a Node floor) + `proper-lockfile` for safe writes, `chokidar` for external-change detection. Frontend: React 19.2, Vite 8.1, Zustand 5 (UI state) + TanStack Query 5 (server state), `react-hook-form` + `@hookform/resolvers/ajv` (single schema drives both server validation and client form errors), CodeMirror 6 (raw-JSON escape hatch, explicitly not Monaco — 2-5MB bundle bloat inside every `npx` install), `json-diff-kit` (structural, not text, diffing for version history), Tailwind 4 + Radix/shadcn for polished, accessible UI chrome. Build tooling: `tsup` for the CLI bundle, `vite build` for the SPA, both combined into one `npm run build`.

**Core technologies:**
- Fastify + Ajv — local API server with built-in JSON-Schema validation, reusing the exact schema that's already the project's single source of truth
- React + Vite + TypeScript — bundled SPA served statically by the Node service, fast dev HMR
- `write-file-atomic` + `proper-lockfile` — the two complementary halves of "never corrupt the file" (atomicity + concurrency safety)
- `react-hook-form` + `@hookform/resolvers/ajv` — one schema instance driving both server-side gate and client-side live field errors
- `json-diff-kit` + CodeMirror 6 — structural diff viewer for version history, raw-JSON power-user fallback (not Monaco)

### Expected Features

The product is a schema-driven settings editor whose core differentiator is depth of beginner-facing explanation (per-key AND per-enum-option plain-language docs) plus purpose-built "pool" editors for GSD's specific array/map shapes — not a generic JSON editor.

**Must have (table stakes):**
- Schema-driven category-tabbed form (all ~21 config chapters, "omit nothing")
- Default-vs-overridden indicator, reset-to-default, inline validation errors
- Enum values as dropdown/radio, not free text
- Array/map "pool" editing without raw JSON (GSD has ~6 distinct pool shapes)
- Multi-config sidebar (manual add), load-existing-file, create-new-from-defaults
- Validate-before-save + atomic write, unknown-key preservation, save success/failure feedback

**Should have (competitive):**
- Beginner-plain-language docs for every key AND every enum option (the Core Value)
- Effective-value/precedence visualization (5-layer model resolution is genuinely confusing)
- Purpose-built Model Profile matrix editor (profiles × ~33 agents × tiers)
- Full version history with structural diff + one-click revert
- Live schema refresh/reconcile against the `gsd-core` GitHub repo
- API-key masking for the Integrations chapter (security-sensitive)

**Defer (v2+):**
- Cross-project bulk-edit across many tracked configs
- Scheduled/automatic schema-refresh with changelog prompts
- Tool-native shareable setting presets/bundles
- Anti-features to actively avoid: running/orchestrating GSD workflows from the tool, hosted sync/cloud backup, generic "edit any JSON" mode, unbounded background crawling, in-app AI "auto-configure" assistant, silently dropping unknown keys, deep git automation inside the tool

### Architecture Approach

CLI/Launcher (thin bootstrap: port/lock, browser open, lifecycle) → Local Node Service bound strictly to `127.0.0.1` (Discovery, Config I/O, Schema, Snapshot Store modules behind a REST+SSE API) → React/Vite/TS UI served statically by that same service. Key patterns: (1) local loopback service with per-launch random token + Host-header allowlisting (never trust loopback binding alone); (2) one canonical JSON-Schema-superset descriptor (draft 2020-12 + `x-*` vendor extensions for prose/category/provenance) driving both Ajv validation and a generic client-side renderer, so docs and validation never drift; (3) layered configuration resolution with provenance (canonical defaults → `~/.gsd/defaults.json` → project `config.json` → optional workstream config), each field showing which layer supplied its value; (4) full-snapshot (not diff-chain) version store, revert-as-write through the same validate→atomic-write→snapshot pipeline.

**Major components:**
1. CLI/Launcher — process bootstrap, port/lock management, browser open, SIGINT/SIGTERM handling
2. Local Node Service (Discovery, Config I/O, Schema, Snapshot Store submodules) — all file I/O, validation, and layered-merge logic; the browser never touches disk directly
3. Schema module — owns bundled canonical schema + optional live fetch/reconcile against `gsd-core`, AST-parses (never `eval`s) remote source
4. UI — generic schema-driven tab/field renderer as the core reusable engine; pool editor, Model Profile editor, and history/diff panel are specializations layered on top, not parallel bespoke systems

### Critical Pitfalls

1. **Naive read-modify-write silently drops unknown/future keys** — always patch the original parsed JSON object at the specific key path being changed; never reconstruct the write payload from schema/form state. Add a round-trip-identity test as an early automated gate.
2. **Non-atomic writes corrupt config.json on crash or Windows file lock** — write-temp-in-same-dir → fsync → rename, with explicit Windows EPERM/EBUSY/EACCES retry-with-backoff around the rename (the target user is on Windows 11, and `graceful-fs`'s built-in retry doesn't cover the common "overwrite existing file" case).
3. **Loopback binding alone doesn't stop DNS rebinding / cross-origin attacks** — validate the `Host` header against an explicit allowlist on every request, never wildcard CORS, add a per-launch random token for mutating calls. This is core to the "no server needed" trust model, not optional hardening.
4. **Generic schema-form libraries mishandle polymorphic/pool fields** — hand-build bespoke editors for `model_profile_overrides` (string-or-object union), `review.reviewer_instances`, `ship.pr_body_sections`, and the agent-tier maps; show effective resolved value alongside precedence layer rather than raw fields in isolation.
5. **Bundled schema drifts from the real evolving gsd-core schema** — never set `additionalProperties: false` at the enforcement/save-blocking layer (only for advisory linting); ship a visible "schema last refreshed" indicator and diff-based (not blind-overwrite) reconciliation.

Additional GSD-specific pitfalls worth flagging for the Model-Profile phase: model-override edits can appear to save successfully but require `gsd install` to take effect on some runtimes (must surface this explicitly), and some GSD settings (e.g. `worktree.baseRef`) live outside `.planning/config.json` entirely in `.claude/settings.local.json`.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Schema Foundation & Data-Layer Safety
**Rationale:** Every other component (validation, effective-value merge, every UI surface) depends on a concrete bundled schema shape and safe I/O primitives existing first; this is also where the highest-cost-to-fix-later pitfalls live (data-integrity, atomic writes).
**Delivers:** Curated bundled canonical schema (JSON Schema 2020-12 + `x-*` prose/category extensions) built from `gsd-core` docs + a real sample config; Discovery + Config I/O modules with layered effective-value merge; Ajv validation with `additionalProperties` open at the enforcement layer; atomic write (temp+fsync+rename+Windows retry) preserving the full original parsed object (never schema-reconstructed); round-trip-identity test with fabricated unknown keys as an automated gate.
**Addresses:** Bundled curated canonical schema, discovery of both project + global defaults, validate-before-save + atomic write, unknown-key preservation
**Avoids:** Pitfall 1 (silent key drop), Pitfall 2 (non-atomic writes), Pitfall 5 (over-strict/permissive validation), Pitfall 7 (delta-only writes vs. full materialization)

### Phase 2: Local Loopback Server, CLI, and Security Hardening
**Rationale:** Thin plumbing around Phase 1's modules; the loopback security model (Host-header allowlist, per-launch token) must be built in from day one, not retrofitted, since it's core to the "no server needed" trust story.
**Delivers:** Fastify server bound to `127.0.0.1` with Host/Origin validation and per-launch token middleware; REST + SSE API surface; CLI launcher (port/lock, browser open, lifecycle); Snapshot Store (full-snapshot-on-write, revert-as-write through the same pipeline).
**Uses:** Fastify, Ajv, Commander, `open`, `get-port`, `write-file-atomic`, `proper-lockfile`, `chokidar`
**Implements:** Local Node Service (Discovery/Config-I/O/Schema/Snapshot components), REST+SSE transport layer
**Avoids:** Pitfall 3 (DNS rebinding/CSRF) — verify explicitly with the manual cross-tab fetch test

### Phase 3: Generic Schema-Driven UI Shell
**Rationale:** The largest single component; needs Phase 1's schema shape and Phase 2's API contract frozen enough to build against (even a stub schema unblocks parallel frontend work).
**Delivers:** React/Vite/TS SPA shell; sidebar (tracked configs, manual add); generic schema-driven category-tabbed form renderer (one engine walking the merged schema tree, not per-namespace hand-coded forms); default-vs-overridden indicators, reset-to-default, inline Ajv-driven validation errors, search/filter across settings.
**Addresses:** Schema-driven category-tabbed form (all chapters), search/filter, field-level inline documentation, enum dropdowns, load-existing-file, create-new-from-defaults
**Avoids:** Anti-Pattern "hand-coded forms per namespace" (breaks "omit nothing" the instant gsd-core adds a key)

### Phase 4: Pool Editors & Model Profile Specialization
**Rationale:** Builds on Phase 3's generic renderer as targeted specializations, not a new subsystem; explicitly the highest engineering-risk UI surface per Pitfalls research (deep nesting, polymorphic fields, precedence chains).
**Delivers:** Bespoke pool editors for `ship.pr_body_sections`, `review.reviewer_instances`, `agent_skills`, `planning.sub_repos`; Model Profile matrix editor (profiles × ~33 agents × tiers) with effective-resolved-value display and "requires `gsd install`" notices for runtime-baked settings; API-key masking for the Integrations chapter.
**Addresses:** Array/map pool editing, purpose-built Model Profile matrix editor, effective-value/precedence visualization
**Avoids:** Pitfall 4 (schema-form oneOf/nesting bugs), Pitfall 6 (model-profile edits that silently don't take effect)

### Phase 5: Version History UI
**Rationale:** Depends on Phase 2's Snapshot Store + API and a basic Phase 3 shell to host the panel; comparatively mechanical once the schema-driven engine and snapshot backend exist.
**Delivers:** Snapshot list, structural diff view (`json-diff-kit`), one-click revert (reusing the validate→atomic-write→snapshot pipeline, never a special-case revert path).
**Addresses:** Full version history browser + diff (from FEATURES.md P2 list)

### Phase 6: Live Schema Reconcile Against gsd-core
**Rationale:** Lowest-risk to build last — the bundled schema alone already satisfies "beginner docs + validation" for a usable v1; this is a pure enhancement layer needing only the schema *format* from Phase 1, safe to descope/defer if time-constrained.
**Delivers:** On-demand fetch + AST-parse (never `eval`) of live `gsd-core` schema sources, diff against bundled schema (added/changed/deprecated), merge preserving curated prose, "schema last refreshed" indicator.
**Addresses:** Live schema refresh/reconcile (FEATURES.md P2), unknown-key surfacing enhancement
**Avoids:** Anti-Pattern "eval/require of fetched remote source" (supply-chain risk), Pitfall 5 (blind schema overwrite losing curated descriptions)

### Phase Ordering Rationale

- Backend-first, dependency-driven order matches ARCHITECTURE.md's explicit "Build Order" section almost exactly: schema model → I/O/validation → atomic write/snapshots → CLI/API plumbing → UI shell → pool/model-profile specialization → history UI → live reconcile.
- Data-integrity and security pitfalls (unknown-key drop, non-atomic writes, DNS rebinding) are architecturally foundational — PITFALLS.md is explicit that these must be addressed in the core I/O and loopback-server phases, not as later hardening passes, so they're placed first.
- Pool/Model-Profile editors are deliberately split into their own phase after the generic UI shell exists, because PITFALLS.md flags them as the highest-risk UI surface (deep nesting, oneOf/union handling, 5-layer precedence) — they need dedicated design time, not incidental generic-form output.
- Live schema reconcile is placed last because it's explicitly the safest to defer (FEATURES.md MVP definition puts it in "Add After Validation," ARCHITECTURE.md's build order calls it "lowest-risk to build last").

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Schema Foundation):** Known unresolved ambiguities in the real `gsd-core` schema (`model_overrides` vs `model_profile_overrides`, top-level vs `planning.*` duplicate keys, `granularities` purpose, full enumeration of `workflow.*` toggles) must be resolved against `sdk/src/config-schema.ts` (or equivalent canonical source) directly, not docs prose, before finalizing the bundled schema.
- **Phase 4 (Pool Editors & Model Profile):** Precedence/resolution logic (5 layers) and the `gsd install` runtime-baking gotcha on Codex/OpenCode need careful UX design; validate the exact field-level constraints for `ship.pr_body_sections` against real gsd-core source, not assumed generically.
- **Phase 6 (Live Reconcile):** Needs research into `gsd-core`'s actual exported shapes/paths at fetch time (repo structure may shift between versions) and a safe AST-extraction approach.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Loopback Server/CLI):** Well-documented, established patterns (Storybook/Prisma-Studio/MCP-Inspector precedent for loopback+token; Host-header allowlisting is a known, direct fix).
- **Phase 3 (Generic UI Shell):** Standard React/Vite/RHF/Zustand/TanStack-Query composition, no novel research needed.
- **Phase 5 (Version History UI):** `json-diff-kit` API and snapshot-diff-revert pattern are already fully specified in ARCHITECTURE.md.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Package versions verified directly against the npm registry; comparative/ecosystem-trend judgments (Fastify vs Express, Zustand vs Redux, etc.) cross-checked across multiple 2026 sources |
| Features | MEDIUM-HIGH | Generic config-editor UX patterns are well-established (HIGH); gsd-core-specific schema details sourced from docs + a real sampled config.json (MEDIUM on doc-derived specifics, HIGH on anything confirmed in the real file) |
| Architecture | MEDIUM-HIGH | Architectural patterns (loopback service, schema-driven forms, layered config, snapshot store) are HIGH confidence/well-established; gsd-core-specific schema facts sourced from official docs via web-fetch, classified MEDIUM pending re-verification against the pinned gsd-core version |
| Pitfalls | MEDIUM-HIGH | Grounded in gsd-core's actual CONFIGURATION.md plus cross-checked external sources (Node atomic-write patterns, DNS-rebinding CVEs, rjsf issue trackers) |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- `model_overrides` vs `model_profile_overrides` naming/scope ambiguity between gsd-core docs and a real sampled config file — must be resolved against canonical source code before Phase 1 schema-build finalizes.
- Duplicate top-level vs `planning.*`-nested keys (`commit_docs`, `search_gitignored`) — confirm deprecated-alias vs distinct-setting vs doc drift during Phase 1.
- `granularities` (plural, map) purpose is undocumented in fetched docs — confirm against source before writing beginner-facing copy.
- Full enumeration of all real files gsd-core reads settings from (confirmed: `.planning/config.json`, `~/.gsd/defaults.json`, `.claude/settings.local.json` for `worktree.baseRef`) — needs explicit research during Phase 1/schema-strategy to avoid the tool silently omitting settings that live outside `.planning/config.json`.
- `gsd-core`'s own `VALID_CONFIG_KEYS` has documented drift between `gsd-tools.cjs` and `sdk/src/config-schema.ts` (issue #3351) — the canonical source itself is a moving target; the "hybrid schema + live refresh + surface unknown keys" design is a direct mitigation, not optional polish.

## Sources

### Primary (HIGH confidence)
- `registry.npmjs.org` direct API queries (2026-07-11) — package versions/engines for the full stack
- `.planning/config.json` — a real, in-use gsd-core project configuration file read directly from disk, used to confirm actual field names/nesting and catch doc discrepancies
- `docs/CONFIGURATION.md` and `docs/COMMANDS.md` at `open-gsd/gsd-core` — primary schema and command-grouping reference

### Secondary (MEDIUM confidence)
- Web search (cross-checked across multiple 2026 sources) — architecture pattern precedent (MCP Inspector, Prisma Studio, Storybook), Fastify vs Express, Zustand vs Redux vs Jotai, Ajv vs Zod vs Valibot, Monaco vs CodeMirror
- Published gsd-core docs site — defaults-file location confirmation
- gsd-core issue trackers (#3351, #3210, #2256) — direct evidence of schema drift and the model-override "requires gsd install" gotcha
- DNS-rebinding sources: GitHub Security Lab, Vite CVE GHSA-vg6x-rcgg-rjx6, webpack-dev-server/parcel issue history
- react-jsonschema-form issue tracker (#4476, #4399, #2296, #4918, #3383) — oneOf/anyOf default-handling bugs informing Pitfall 4

### Tertiary (LOW confidence)
- Secondary blog summary of the model-profile system, used only as corroboration
- TypeScript 7.0 GA coverage — used only to justify pinning TS 5.9.3 over the just-GA'd 7.0

---
*Research completed: 2026-07-11*
*Ready for roadmap: yes*
