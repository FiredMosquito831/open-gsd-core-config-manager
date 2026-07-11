
# Architecture Research

**Domain:** Local-first (loopback) npx-launched config editor — React+Vite+TS UI over a Node file/IO service, for open-gsd/gsd-core `.planning/config.json`
**Researched:** 2026-07-11
**Confidence:** MEDIUM-HIGH — gsd-core schema facts sourced from official docs (github.com/open-gsd/gsd-core, opengsd.net) via generic web-fetch (classified LOW-tier by the provider-confidence seam even though the source is primary/official; treat schema *specifics* as directionally correct but re-verify against the pinned gsd-core version during Phase 1 build, which is exactly what the "reconcile" feature is for). Architectural patterns (local-service-over-loopback, layered config merge, JSON-Schema-driven forms, snapshot-on-write) are HIGH confidence — well-established for this class of tool.

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  CLI / LAUNCHER  (npx entry point, thin bootstrap)                    │
│  - parse args (--port, --open, --dir)                                 │
│  - single-instance lock, pick free loopback port                      │
│  - start Local Node Service, open browser, handle SIGINT/SIGTERM      │
└───────────────────────────────┬────────────────────────────────────--┘
                                 │ spawns / imports
┌────────────────────────────────▼───────────────────────────────────--┐
│  LOCAL NODE SERVICE  (Express/Fastify, bound to 127.0.0.1 only)       │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────┐ │
│  │  Discovery     │ │  Config I/O    │ │  Schema        │ │ Snapshot  │ │
│  │  (tracked list,│ │  (read/merge/  │ │  (bundled +    │ │ Store     │ │
│  │  folder scan)  │ │  validate/     │ │  fetch/        │ │ (version  │ │
│  │                │ │  atomic write) │ │  reconcile)    │ │ history)  │ │
│  └───────┬───────┘ └───────┬───────┘ └───────┬───────┘ └─────┬─────┘ │
│          └─────────────────┴─────────────────┴───────────────┘       │
│                            REST + SSE API layer                       │
└───────────────────────────────┬──────────────────────────────────---─┘
                                 │ HTTP(S) over loopback, localhost:PORT
┌────────────────────────────────▼───────────────────────────────────--┐
│  UI  (React + Vite + TS, served as static build by the Node service)  │
│  Sidebar (tracked configs) │ Schema-driven Tab/Form Renderer          │
│  Pool Editor (arrays/maps) │ Model Profile Editor │ History/Diff Panel│
└──────────────────────────────────────────────────────────────────---─┘
                                 │ reads/writes
┌────────────────────────────────▼───────────────────────────────────--┐
│  DISK                                                                  │
│  • User's projects: <proj>/.planning/config.json  (write target)      │
│  • User's machine: ~/.gsd/defaults.json (read-only reference layer)   │
│  • gsd-core install: sdk/shared/configuration.cjs (canonical defaults,│
│    read-only, informs bundled schema; also fetched live from GitHub)  │
│  • This app's own data dir: ~/.gsd-config-manager/ (tracked list,     │
│    schema cache, snapshot history) — NEVER inside a tracked project   │
└──────────────────────────────────────────────────────────────────---─┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| CLI/Launcher | Process bootstrap, port/lock management, browser open, lifecycle | Minimal Node script (no heavy CLI framework), `bin` entry in `package.json` |
| Local Node Service — Discovery | Manual add, remembered list persistence, bounded folder scan for `.planning/config.json` | Node `fs`/`fast-glob` with exclude list (`node_modules`, `.git`, `dist`, etc.), JSON list file |
| Local Node Service — Config I/O | Read raw project config, compute layered effective values, validate, atomic write | `fs.readFile` + `ajv` (JSON Schema validator) + temp-file-then-`fs.rename` |
| Local Node Service — Schema | Own the bundled schema; fetch/parse live gsd-core repo; merge deltas | Curated JSON checked into package + build-time generator script; runtime fetch via GitHub raw content API + safe AST extraction (no `eval`/`require` of remote code) |
| Local Node Service — Snapshot Store | Full-content versioned history per tracked config, diff, revert | Content-addressed-ish flat files per config (keyed by hashed path) + JSON index |
| Transport | UI ↔ service contract | REST (JSON over HTTP) for all CRUD; SSE for two async push notifications (schema refresh progress, external file-change detection) |
| UI | Render schema-driven tabs/forms, pools, model profile editor, sidebar, history/diff | React + Vite + TS; generic schema-driven renderer, not hand-coded per key |

## Recommended Project Structure

```
gsd-config-manager/
├── packages/                       # (or a flat src/ if a monorepo is overkill for v1)
│   ├── cli/                        # thin launcher — bin entry
│   │   └── src/index.ts
│   ├── server/                     # local Node service
│   │   └── src/
│   │       ├── discovery/          # tracked list, manual add, folder scan
│   │       ├── config-io/          # read, layered merge, validate, atomic write
│   │       ├── schema/             # bundled schema loader, fetch/reconcile, merge
│   │       ├── snapshots/          # snapshot store, diff, revert
│   │       ├── routes/             # REST + SSE route handlers (thin, delegate to modules above)
│   │       └── app-data.ts         # resolves ~/.gsd-config-manager/ paths, cross-platform
│   └── schema-data/                # bundled canonical schema (checked-in JSON) + generator script
│       ├── bundled-schema.json     # shipped in the npm package
│       └── scripts/generate.ts     # maintainer tool: rebuild bundled schema from gsd-core docs
├── web/                            # React + Vite + TS UI
│   └── src/
│       ├── api/                    # typed REST client (generated or hand-written from schema types)
│       ├── components/
│       │   ├── sidebar/
│       │   ├── schema-form/        # generic key/tab/option renderer (the core reusable engine)
│       │   ├── pool-editor/        # generic array/map pool editing widget
│       │   ├── model-profile/      # specialized view built on schema-form + pool-editor
│       │   └── history/            # snapshot list, diff view, revert
│       └── state/                  # client-side store (config cache, dirty tracking)
└── shared/                          # types shared between server and web (schema types, API DTOs)
    └── src/schema-types.ts
```

### Structure Rationale

- **`schema-data/` as its own package:** the bundled schema is a build-time artifact (curated docs + defaults extracted from gsd-core), not runtime logic. Isolating it lets the "reconcile" feature diff against it cleanly and lets a maintainer regenerate it independent of app code changes.
- **`server/schema/` separate from `server/config-io/`:** config I/O only needs to *consume* a merged schema (for validation + effective-value computation); it must not know how that schema was assembled. This boundary is what lets "bundled-only, offline" and "bundled+fetched, online" be interchangeable without touching I/O code.
- **`shared/` types:** the schema shape, config DTOs, and API contracts are used by both server and UI. A single source of truth for these types prevents drift between what the server validates and what the UI renders — critical given "omit nothing" is a hard requirement.
- **`components/schema-form/` as the core reusable engine:** because the config tree is large (20+ namespaces, deeply nested, some dynamic-key maps), the UI must be schema-driven (one generic renderer walking the merged schema tree), not hand-built per field. Model-profile and pool editors are specializations layered on top of this engine, not separate systems.

## Architectural Patterns

### Pattern 1: Local Loopback Service (no hosted backend)

**What:** The Node process started by the CLI binds an HTTP server strictly to `127.0.0.1` (never `0.0.0.0`), serves the built Vite static assets, and exposes a REST+SSE API consumed by the browser tab it opens. All file I/O happens server-side; the browser never touches the filesystem directly.
**When to use:** Any "no server needed" desktop-grade tool distributed as an `npx` package that still needs real disk access and a rich UI (same pattern as Storybook, Prisma Studio, `npx serve`, local dev-tool UIs).
**Trade-offs:** + trivial to install/share, no auth/hosting concerns, full Node fs access. − must actively defend against other local processes/pages hitting the port (mitigate with a per-launch random token required on all API calls, checked in middleware) and must handle port collisions gracefully (probe/increment or let the OS assign an ephemeral port and print the URL).

**Example:**
```typescript
const token = crypto.randomUUID();
app.use((req, res, next) => {
  if (req.headers['x-gsd-token'] !== token) return res.status(403).end();
  next();
});
const server = app.listen(0, '127.0.0.1', () => {
  const { port } = server.address() as AddressInfo;
  open(`http://127.0.0.1:${port}/?t=${token}`);
});
```

### Pattern 2: Schema-Driven UI over a JSON-Schema-superset descriptor

**What:** One canonical "GSD Schema Descriptor" (JSON Schema draft 2020-12 + `x-*` vendor extensions for beginner prose, category/tab, provenance, dynamic-key pattern info) drives both server-side validation (via `ajv`) and client-side rendering (generic tab/field/pool components walking the same tree). Docs and validation never drift because they're the same artifact.
**When to use:** Any domain with a large, evolving, nested config surface that must be both documented for beginners and safely validated — exactly this project's core requirement.
**Trade-offs:** + single source of truth, new schema keys automatically get a render surface and a validator, no per-key UI code. − requires investment in a genuinely generic renderer up front (cannot shortcut with hand-coded forms per tab without losing the "omit nothing" guarantee as gsd-core evolves).

**Example:**
```json
{
  "workflow.tdd_mode": {
    "type": "boolean",
    "default": false,
    "title": "TDD Mode",
    "x-doc": "When enabled, debug sessions require a failing test to be written and verified before any fix is applied (red → green → done).",
    "x-category": "Workflow",
    "x-provenance": "bundled"
  }
}
```

### Pattern 3: Layered Configuration Resolution (cascade with provenance)

**What:** Effective value for any key = the highest-priority layer that defines it, computed at read time: `canonical defaults (bundled/fetched schema) → ~/.gsd/defaults.json (global, read-only reference) → .planning/config.json (project, the write target) → (optional) active workstream config.json`. Each rendered field shows which layer supplied its current value ("default", "from your global defaults", "set in this project").
**When to use:** Any tool surfacing a cascading config system (same family as ESLint config resolution, VS Code user/workspace settings). Directly matches how gsd-core itself resolves config.
**Trade-offs:** + matches the real mental model gsd-core users already have, makes "why is this value X" answerable in the UI, keeps writes scoped and predictable. − requires the merge/provenance computation to be correct and tested against gsd-core's actual precedence rules (canonical → global → project → workstream), including its dynamic-key validation patterns (`features.<name>`, `model_overrides.<agent>`, `review.models.<cli>`).

**Example:**
```typescript
type Provenance = 'canonical' | 'global' | 'project' | 'workstream';
function resolve(key: string, layers: Record<Provenance, unknown>): { value: unknown; from: Provenance } {
  for (const layer of ['workstream', 'project', 'global', 'canonical'] as const) {
    if (has(layers[layer], key)) return { value: get(layers[layer], key), from: layer };
  }
}
```

### Pattern 4: Full-Snapshot Version Store with Revert-as-Write

**What:** On every successful validated write, capture a full JSON snapshot (not a diff) of the pre-write project config into an app-owned, path-hashed history directory. Diffs are computed on-demand between any two snapshots (or a snapshot and current disk state). Revert is implemented as writing the chosen snapshot's content back through the *same* validate → atomic-write → snapshot pipeline — never a special-case code path.
**When to use:** Small config files (KB-scale JSON) where full snapshots are cheap and diff-on-demand is simpler/safer than maintaining a diff-chain (no reconstruction risk, no chain corruption).
**Trade-offs:** + trivially correct reverts, simple format, easy to reason about. − history directory grows unbounded over time (fine at config-file scale; note as a future pruning concern, not a v1 blocker).

**Example:**
```typescript
async function writeConfig(configPath: string, next: object) {
  const prev = await readRaw(configPath);
  validate(next); // throws on schema violation — write never proceeds
  await snapshotStore.record(configPath, prev); // snapshot BEFORE overwrite
  await atomicWrite(configPath, next);
}
async function revert(configPath: string, snapshotId: string) {
  const content = await snapshotStore.read(configPath, snapshotId);
  return writeConfig(configPath, content); // reuses the same pipeline
}
```

## Data Flow

### Request Flow — Load a tracked config

```
[User clicks sidebar item]
    ↓
[UI] GET /api/configs/:id
    ↓
[REST route] → [Discovery: resolve tracked path] → [Config I/O: read raw project config]
                                                    → [Config I/O: read ~/.gsd/defaults.json if present]
                                                    → [Schema: get active merged schema]
                                                    → [Config I/O: compute layered effective values + provenance]
    ↓
[Response: { raw, effective, schema, unknownKeys[] }]
    ↓
[UI] Schema-driven renderer walks `schema` tree, fills each field from `effective`,
     tags unknown top-level keys not present in schema into an "Unrecognized keys" panel
     (surfaced, never dropped), tags provenance per field for the "reset to default" affordance.
```

### Request Flow — Save

```
[User edits field(s), clicks Save]
    ↓
[UI] builds full next-config object from current form state (project layer only)
    ↓
PUT /api/configs/:id  { nextConfig }
    ↓
[Config I/O] validate(nextConfig, schema)  — ajv, blocks on failure, returns field-level errors
    ↓ (valid)
[Snapshot Store] record pre-write snapshot of current on-disk content
    ↓
[Config I/O] atomic write: write to temp file in same dir → fsync → rename over target
    ↓
[Response: { ok: true, snapshotId }]  or  { ok: false, errors: [...] }
    ↓
[UI] shows success/error; on success, refetches effective values (in case other layers shifted)
```

### Request Flow — Schema refresh/reconcile (async, user-initiated)

```
[User clicks "Refresh schema"]
    ↓
POST /api/schema/refresh → 202 Accepted { jobId }
    ↓ (background)
[Schema module] fetch configuration.cjs + config-schema.cjs (raw GitHub content) + CONFIGURATION.md
    ↓
[Schema module] AST-extract exported defaults/VALID_CONFIG_KEYS (no eval/require of remote code)
    ↓
[Schema module] diff against bundled schema → { added[], changed[], deprecated[] }
    ↓
[Schema module] merge: fetched wins on structural facts (keys/types/defaults/enums);
                bundled prose wins where present; added keys get placeholder doc + needsDocs flag
    ↓
[Schema module] cache merged schema to ~/.gsd-config-manager/schema-cache/, becomes active
    ↓
SSE /api/schema/events → { jobId, status: 'done', summary: { added: n, changed: n, deprecated: n } }
    ↓
[UI] toast/banner summarizing what changed; forms re-render against new merged schema
```

### Key Data Flows

1. **Discovery → tracked list persistence:** manual add and folder-scan results are only ever written to the app's own `~/.gsd-config-manager/tracked.json` — they never write into a user's `.planning/` directory (that directory is owned by gsd-core itself).
2. **Effective-value computation is read-only and re-derived every load** — never cached to disk as "the truth," since global defaults or canonical schema can change between sessions; only the raw project config and snapshots are durable state this app writes.
3. **Validation gates every write** — the schema (bundled, or bundled+fetched-merged) is the single authority both the UI (soft, inline hints) and the server (hard, blocking) consult; the server-side check is the one that actually protects the file, the UI check is UX sugar.

## Scaling Considerations

This is a single-user, local-only tool — "scaling to concurrent users" does not apply. The realistic scale axes are: number of tracked configs, size/depth of the gsd-core schema over time, and snapshot history growth per config.

| Scale | Architecture Adjustments |
|-------|---------------------------|
| 1–10 tracked configs, current gsd-core schema (~24 namespaces) | Baseline design as described is more than sufficient — in-memory schema, flat JSON tracked list, synchronous fs calls are fine. |
| 10–100 tracked configs, schema grows with gsd-core versions | Sidebar list should paginate/virtualize if it grows large; schema tree renderer should lazy-render inactive tabs (don't mount all 24 namespace forms at once); folder scan should stream results (SSE) rather than block on a full recursive walk. |
| 100+ tracked configs across many machines/projects, deep snapshot history | Snapshot index per config should support pruning/compaction (keep-last-N + keep-milestones) without changing on-disk format; tracked list may need a lightweight on-disk index instead of a single flat JSON file to avoid full-file rewrites on every add/remove. |

### Scaling Priorities

1. **First likely friction:** rendering the full nested schema (20+ namespaces, some deeply nested like `model_policy.runtime_tiers.<runtime>.<tier>`) performantly in React — mitigate with per-tab lazy mounting and memoized field components from day one, not as a later optimization.
2. **Second likely friction:** unbounded snapshot history directories over long project lifetimes — mitigate by designing the `index.json` format with pruning in mind up front (sequence numbers + timestamps + content hash for de-dupe), even if pruning UI ships later.

## Anti-Patterns

### Anti-Pattern 1: Hand-coded forms per config namespace

**What people do:** Build a bespoke React form component for `workflow`, another for `git`, another for `model_policy`, etc., each hard-coding field labels/inputs.
**Why it's wrong:** Directly violates "no config key is omitted" and "unknown/new keys surfaced" — every gsd-core release that adds a key requires an app code change and a redeploy, and drift between docs and validation becomes inevitable.
**Do this instead:** One generic schema-driven renderer (Pattern 2) that walks the merged schema tree; namespaces become tabs by iterating schema categories, not by writing per-namespace components.

### Anti-Pattern 2: `require()`/`eval()` of fetched remote gsd-core source

**What people do:** To "reconcile" the schema, `fetch()` the raw `configuration.cjs` from GitHub and `eval`/dynamic-`require` it to get the live defaults object.
**Why it's wrong:** Executes arbitrary remote code inside the local service process that also has filesystem write access to the user's projects — a supply-chain/compromise vector even though the source is normally trustworthy (a compromised branch, MITM, or GitHub outage serving unexpected content are all realistic failure modes for a tool that runs on developer machines with file-write privileges).
<br>**Do this instead:** Parse the fetched source as data — AST-parse (e.g. `@babel/parser` or a small regex/JSON-literal extractor scoped to the known export shape) to pull out the object literal, never execute it.

### Anti-Pattern 3: WebSocket for everything

**What people do:** Default to a WebSocket connection between UI and service "to be safe/real-time," including for simple CRUD like loading and saving a config.
**Why it's wrong:** Adds connection-lifecycle complexity (reconnect handling, message framing, request/response correlation) for interactions that are fundamentally request/response and low-frequency (user-initiated saves, not streaming data). This is a single browser tab talking to a service it spawned itself — there's no multi-client fan-out need to justify it.
**Do this instead:** REST for all CRUD; SSE (simple, HTTP-native, one-directional) for the two genuinely async/push cases — schema-refresh progress and optional external file-change notification.

### Anti-Pattern 4: Storing app state (tracked list, snapshots, schema cache) inside a tracked project's `.planning/`

**What people do:** Write the sidebar's remembered list, or snapshot history, into the user's own `.planning/` directory since "that's where GSD state lives."
**Why it's wrong:** Pollutes a directory the user commits to git and that gsd-core itself owns; also breaks cleanly tracking *multiple* projects (each project's `.planning/` can only hold its own history, not the cross-project tracked list) and risks collision/confusion with gsd-core's own `.planning/` file conventions.
**Do this instead:** All of this app's own state lives in a dedicated app-data directory (`~/.gsd-config-manager/`), keyed by hashed absolute path where per-project data is needed. The only thing this app ever writes inside a user's project is the `config.json` file itself, on explicit Save.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|----------------------|-------|
| github.com/open-gsd/gsd-core (raw file fetch) | On-demand `fetch()` of `sdk/shared/configuration.cjs`, `bin/lib/config-schema.cjs`, `docs/CONFIGURATION.md` via raw content URLs, triggered only by explicit "Refresh schema" action (never on every launch — keeps the tool predictable and offline-capable) | Rate limits are a non-issue at this call frequency; must handle repo restructuring gracefully (paths/exports may move between gsd-core versions — pin a known-good commit/tag in the bundled schema's provenance metadata and detect drift rather than assuming fixed paths forever) |
| Local filesystem (user's projects) | Direct Node `fs` access from the Local Node Service only; browser never touches disk | Path validation required before any read/write (must resolve to files the user explicitly added/scanned — never accept arbitrary absolute paths from the UI without normalizing/confirming) |
| `~/.gsd/defaults.json` (gsd-core's own global user file) | Read-only reference layer in the effective-value cascade | This app does not manage or version this file — it belongs to gsd-core's own global config system, not to this tool |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|----------------|-------|
| CLI ↔ Local Node Service | In-process function call (CLI imports and starts the service; not a separate process spoken to over IPC) | Keeps the launcher trivial and avoids a second process-management layer for a tool this small |
| UI ↔ Local Node Service | REST (JSON) for all CRUD; SSE for schema-refresh progress and file-change push | Every request carries a per-launch token (query param or header) checked by middleware; server binds to `127.0.0.1` only |
| Config I/O ↔ Schema module | Config I/O only consumes a fully-merged schema object; never talks to the network or knows about "bundled vs fetched" | Preserves testability — config I/O can be tested entirely against fixture schemas |
| Schema module ↔ Snapshot Store | No direct coupling — snapshot store only knows raw JSON content + a path key, never schema-aware | Keeps snapshot/revert correct even if the schema changes shape between saves |
| UI schema-form engine ↔ pool-editor / model-profile views | Pool-editor and model-profile are specializations that consume the same schema nodes (`type: array` / `type: map` with an entry sub-schema) as the generic renderer, not a parallel rendering path | Prevents the "arrays as pools" and "model profile editing" requirements from becoming bespoke one-off UIs disconnected from the schema |

## Build Order (dependency-driven)

1. **Schema/metadata model + bundled schema JSON.** Foundation for everything else — validation, effective-value merge, and every UI surface depend on a concrete schema shape existing first. Includes the build-time generator script that produces `bundled-schema.json` from a curated pass over gsd-core's `CONFIGURATION.md` + `configuration.cjs` + `config-schema.cjs`.
2. **Local Node Service core: Discovery + Config I/O + validation (ajv), against fixture files.** Can be built and unit-tested without any UI, using the schema from step 1 and sample `config.json` fixtures.
3. **Atomic write + Snapshot Store.** Depends on step 2 producing validated config content to snapshot; independently testable with fixtures before any UI exists.
4. **CLI/Launcher + REST/SSE API layer.** Thin plumbing around steps 2–3; can be scaffolded in parallel with step 2 once the module interfaces are agreed, since the launcher mostly needs "a server object to start."
5. **UI shell + generic schema-driven tab/field renderer.** The largest component; needs the schema shape (step 1) and API contract (step 4) frozen enough to build against — even a partial/stub schema unblocks parallel frontend work.
6. **Pool editor (arrays/dynamic-maps) + specialized Model Profile view.** Builds on step 5's generic renderer; model-profile editing is a targeted specialization, not a new subsystem.
7. **Version history UI (list, diff, revert).** Depends on step 3 (snapshot store) + step 4 (API) + a basic step 5 shell to host the panel.
8. **Schema fetch/reconcile against the live gsd-core repo.** Lowest-risk to build last — the bundled schema alone already satisfies "beginner docs + validation" for a usable v1; reconcile is a pure enhancement layer that only needs the schema *format* from step 1, not any other component's completion.

This ordering implies a natural phase split: **(1) schema foundation & validation → (2) local service + file safety (I/O, atomic write, snapshots) → (3) API + CLI → (4) generic schema-driven UI → (5) pools & model-profile specialization → (6) version history UI → (7) live-repo reconcile.** Phases 1–3 are almost entirely backend/data-model work and carry the highest "getting the contract wrong is expensive" risk — they warrant the most up-front design care; phases 4–6 are comparatively mechanical once the schema-driven engine exists; phase 7 is additive and low-risk to defer or descope if time-constrained.

## Sources

- [gsd-core Configuration docs — opengsd.net](https://www.opengsd.net/docs/v1/configuration)
- [gsd-core CONFIGURATION.md (github, `next` branch)](https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md)
- [gsd-core Architecture docs — opengsd.net](https://www.opengsd.net/docs/v1/architecture)
- [open-gsd/gsd-core repository](https://github.com/open-gsd/gsd-core)
- General patterns: JSON Schema (draft 2020-12) as a validation+metadata carrier; loopback-bound local dev-tool servers (Storybook, Prisma Studio, `npx serve` precedent); layered config cascade precedent (ESLint config resolution, VS Code user/workspace settings) — engineering-judgment synthesis, not a single cited source.

---
*Architecture research for: GSD Config Manager (local npx-launched config editor for open-gsd/gsd-core)*
*Researched: 2026-07-11*
