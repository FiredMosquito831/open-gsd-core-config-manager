# Phase 3: Generic Schema-Driven UI Shell - Research

**Researched:** 2026-07-15  
**Domain:** React/Vite/TypeScript schema-driven local UI over the existing Fastify loopback config API  
**Confidence:** HIGH for codebase/API seams, MEDIUM for current frontend docs, LOW for npm confidence-tier classification where the GSD seam classifies registry-only evidence as LOW.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
## Implementation Decisions

### Workspace layout and visual direction
- **D-01:** Use a three-pane desktop workspace: tracked configs on the left, chapter navigation in a narrow middle pane, and the active chapter's fields in the main pane.
- **D-02:** Both navigation panes collapse independently into compact rails or temporary drawers at narrower widths; preserve the editor as the primary working surface.
- **D-03:** Use comfortable, documentation-first field cards rather than dense settings rows. The visual character is a polished modern developer tool with refined light and dark themes, restrained color, crisp typography, subtle depth, and clear status colors.

### Field documentation and controls
- **D-04:** Every field card always shows a concise beginner-friendly explanation. Deeper implications, examples, and edge cases are available through expansion on the same card.
- **D-05:** Every non-array enum uses a schema-restricted searchable combobox containing all valid schema-defined options. Typing filters the list but never creates an arbitrary value. Short lists may look like ordinary dropdowns while retaining the same behavior.
- **D-06:** Every enum option exposes its own plain-language meaning and implications in the selection UI; enum values are never entered as free text.
- **D-07:** Array/dynamic-map schema nodes are recognized and handed off as specialized controls, not rendered as ordinary text fields. Full pool editing belongs to Phase 4.

### Defaults, overrides, validation, and saving
- **D-08:** Show explicit provenance for each effective value: `Project override`, `Global default`, or `Canonical default`.
- **D-09:** Offer `Reset project override` only when a project override exists. Reset removes that override and reveals the inherited effective value; do not imply that global/canonical values are being mutated.
- **D-10:** Do not show premature errors on untouched fields. Once a user interacts with or leaves a field, show inline validation feedback and update it live until fixed. Block saving while validation errors remain.

### Adding, scanning, creating, and tracking configs
- **D-11:** The sidebar has one prominent Add action whose menu offers file picker, absolute path entry, and chosen-folder scan. `Create new config` remains a separate action because it creates rather than tracks an existing file.
- **D-12:** A folder scan opens a review-and-select screen listing discovered `.planning/config.json` files with project name and full path. Valid new results are preselected, already-tracked results are marked, and nothing is added until confirmation.
- **D-13:** Creating a config begins by choosing a project folder, targets `<project>/.planning/config.json`, previews the exact path, warns if it exists, and requires confirmation before creation.
- **D-14:** Persist the tracked list and its ordering across launches. If a tracked file becomes missing or inaccessible, keep it in place with a clear problem state, disable editing, and offer `Locate again` and `Remove from list`; never silently discard it.

### Search and unknown keys
- **D-15:** Global search replaces the chapter editor temporarily with a dedicated results view grouped by chapter. Each result shows chapter, key, description, current value, and provenance.
- **D-16:** Match key paths, titles, field explanations, and enum-option meanings. Highlight matched text and rank exact key/title matches before prose matches; current values are not part of the default search corpus.
- **D-17:** Selecting a result opens its normal chapter and field card, focuses and briefly highlights it, and retains the query so the user can return to the same results.
- **D-18:** Put unknown/future keys in a dedicated `Unrecognized` chapter. Each warning card shows the key, source layer, value type, and safely formatted value, explains that the schema cannot document or guide it, and is read-only in Phase 3. Unknown keys remain preserved on every save.

### the agent's Discretion
- Exact pane widths, collapse breakpoints, iconography, spacing tokens, theme palette, animation, combobox library, search-ranking weights, and minor copy are open to design/research, provided the locked interaction model above is preserved.
- Exact persistent-registry storage format and additive API route names are open, but the frozen Phase 2 envelopes, security rules, opaque-id boundary, and existing route shapes must not be broken.

### Deferred Ideas (OUT OF SCOPE)
- **Phase 4 pool editor direction:** arrays open a dedicated editor window with a listbox of entries, add/reorder/remove controls, and a schema-restricted dropdown/combobox for each enum-valued array element. Structured objects receive guided per-field controls rather than raw JSON.
- Full editing for unknown/future keys is not part of Phase 3; they are visible, read-only, and preserved until a safe schema-aware approach is explicitly scoped.
</user_constraints>

## Summary

Phase 3 should replace the placeholder `web/index.html` with a real React/Vite/TypeScript SPA, but it must keep Phase 2's static-serving and `/api` boundary intact: static assets are unguarded by token but covered by the root Host guard, while every `/api/*` request uses the `x-gsd-token` header and the frozen `ApiOk`/`ApiErr` envelopes. [VERIFIED: codebase grep]

The generic renderer should treat `packages/schema-data/bundled-schema.json` as the render/navigation catalog and `LoadResult.raw.project` as the only safe save base. It should patch a copy of `raw.project`, never rebuild from schema-derived form state, because the existing Phase 1 data layer deliberately preserves unknown keys and validates with `additionalProperties` open. [VERIFIED: codebase grep]

**Primary recommendation:** Build a schema-indexed three-pane SPA with React + Vite + RHF custom controls; add only additive server routes for persisted registry/scan/create, and keep all existing `/api/configs*` semantics frozen. [VERIFIED: codebase grep] [CITED: Context7 React/RHF/Vite docs]

## Project Constraints (from AGENTS.md)

No repo-local `AGENTS.md` was found in the workspace root, and no `.codex/skills/` or `.agents/skills/` project skill directory was present. [VERIFIED: filesystem]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Token bootstrap and API auth | Browser / Client | API / Backend | The SPA extracts `?t=`, removes it from the URL, and sends `x-gsd-token`; the backend remains authoritative for rejection. [VERIFIED: web/index.html] [VERIFIED: codebase grep] |
| Static SPA serving | API / Backend | Browser / Client | Fastify serves `dist/client` and handles SPA fallback outside `/api`; the browser just loads the bundle. [VERIFIED: packages/server/src/static/serve.ts] |
| Tracked config path validation | API / Backend | Database / Storage | `POST /api/configs/track` is the only raw-path ingress and registry validation mints opaque ids. [VERIFIED: packages/server/src/registry.ts] |
| Tracked-list persistence | API / Backend | Database / Storage | Phase 2 registry is in-memory; Phase 3 should seed/persist it in app-data without changing opaque-id use. [VERIFIED: packages/server/src/registry.ts] |
| Folder scan | API / Backend | Browser / Client | Node owns filesystem traversal; the client displays review/select results and submits selected paths through the same track boundary. [VERIFIED: 03-CONTEXT.md] |
| Generic schema rendering | Browser / Client | API / Backend | The client renders schema entries and effective values; the server still supplies load data and authoritative save validation. [VERIFIED: packages/config-io/src/types.ts] |
| Inline validation | Browser / Client | API / Backend | The UI gives live feedback, but `PUT /api/configs/:id` still blocks invalid writes through `saveWithSnapshot` and Ajv. [VERIFIED: packages/server/src/routes/configs.ts] |
| Unknown-key surfacing | Browser / Client | API / Backend | `load()` returns a flat `unknown[]` bucket; Phase 3 owns the read-only `Unrecognized` chapter. [VERIFIED: packages/config-io/src/load.ts] |
| Save safety and snapshots | API / Backend | Database / Storage | Saves go through the existing validate → atomic write → snapshot wrapper; the UI must not write files directly. [VERIFIED: packages/server/src/routes/configs.ts] |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHEMA-02 | Every config field displays a plain-language explanation of what it does, written for beginners | `SchemaEntry.x-description` exists today; Phase 3 should render it on every field card and add richer expansion copy without changing schema shape. [VERIFIED: packages/config-io/src/types.ts] |
| SCHEMA-03 | Every enum/option value displays a plain-language explanation of what that specific choice means and its implications | `SchemaEntry.x-options` is the reserved per-option metadata slot; renderer must show it in the combobox/dropdown surface. [VERIFIED: packages/config-io/src/types.ts] |
| SCHEMA-04 | The schema-driven renderer covers all config chapters with no key omitted; adding a new bundled key requires no per-key hand-coding | Current bundled schema has 158 entries; renderer should group by `x-category` and iterate schema entries rather than hard-code chapters. [VERIFIED: node schema count] |
| SCHEMA-06 | Unknown/future keys present in a loaded file that are not in the schema are surfaced rather than hidden or dropped | `load()` already emits `unknown[]`; Phase 3 must render a read-only `Unrecognized` chapter and preserve values by saving a patched copy of `raw.project`. [VERIFIED: packages/config-io/src/load.ts] |
| DISC-01 | User can add an existing config file to the workspace via path entry or file picker | Absolute path entry can call existing `POST /api/configs/track`; browser file input cannot provide a real absolute path, so file-picker UX needs a server-compatible design. [VERIFIED: 02-API-CONTRACT.md] [CITED: MDN file input docs] |
| DISC-02 | The tool remembers tracked config files in a persistent sidebar list across sessions | `createRegistry()` is a factory and Phase 2 explicitly left persistence as a Phase 3 extension point. [VERIFIED: packages/server/src/registry.ts] |
| DISC-03 | User can scan a chosen folder to discover `.planning/config.json` files and add them to the sidebar | Implement scan in Node with exclusions, then feed confirmed paths through `registry.track()`; do not bypass existing validation. [VERIFIED: 02-API-CONTRACT.md] |
| DISC-04 | User can create a brand-new config file initialized from defaults | Registry currently permits missing `.json` paths; create flow can target `<project>/.planning/config.json`, preview, track, then `PUT` through `saveWithSnapshot`. [VERIFIED: packages/server/src/registry.ts] |
| DISC-05 | Clicking a config in the sidebar loads its data into the editor for viewing and modifying | Existing `GET /api/configs/:id` returns Phase 1 `LoadResult`; client should cache and render it. [VERIFIED: packages/server/src/routes/configs.ts] |
| EDIT-01 | The UI organizes config keys into category tabs derived from the canonical schema | `x-category` exists on schema entries; no hard-coded namespaces are needed. [VERIFIED: packages/schema-data/bundled-schema.json] |
| EDIT-02 | Each field indicates whether its value is a default or an explicit override, with a reset-to-default control | `EffectiveLeaf.from` is `canonical`, `global`, or `project`; reset should remove only project-layer value. [VERIFIED: packages/config-io/src/types.ts] |
| EDIT-04 | Enum-valued fields are edited via dropdown/radio controls, not free text | `SchemaEntry.enum` exists; renderer should create schema-restricted controls and never arbitrary enum strings. [VERIFIED: packages/config-io/src/types.ts] |
| EDIT-05 | User can search/filter settings by key or description across all chapters | Search can be built from schema key, title, `x-description`, and `x-options`; current values should not be default corpus per D-16. [VERIFIED: 03-CONTEXT.md] |
| EDIT-06 | Fields show inline validation errors as the user edits, driven by the same schema used server-side | Existing server validator is Ajv 2020-12 from `buildAjvSchema`; client should reuse the same converted schema via `@hookform/resolvers/ajv`. [VERIFIED: packages/config-io/src/schema-convert.ts] [CITED: React Hook Form docs] |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.7 | SPA component model | Locked by project constraints; official docs support local component state and controlled inputs for interactive UI. [VERIFIED: npm registry] [CITED: Context7 React docs] |
| React DOM | 19.2.7 | Browser rendering | Required React browser companion; registry source is `facebook/react`. [VERIFIED: npm registry] |
| Vite | 8.1.4 | Frontend build/dev server | Official docs support custom build root/output/base for static serving; emits the `dist/client` bundle Fastify serves. [VERIFIED: npm registry] [CITED: Context7 Vite docs] |
| @vitejs/plugin-react | 6.0.3 | React transform/Fast Refresh | Official Vite React companion package; flagged recent by legitimacy seam. [VERIFIED: npm registry] |
| TypeScript | 5.9.3 | Shared frontend/backend language | Already pinned in `package.json`; keep the existing compiler line. [VERIFIED: package.json] |
| react-hook-form | 7.81.0 | Form state for many fields/custom controls | RHF docs support `useForm`, `useController`, and `useFieldArray`; use custom controls instead of a black-box schema-form generator. [VERIFIED: npm registry] [CITED: React Hook Form docs] |
| @hookform/resolvers | 5.4.0 | Ajv resolver bridge | Lets client-side forms use the same Ajv schema family as server validation. [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand | 5.0.14 | Local UI state | Sidebar collapse, active chapter, search query, transient highlights. [VERIFIED: npm registry] |
| @tanstack/react-query | 5.101.2 | Server-state cache | `/api/configs`, load/save mutation, refetch after save, request status. [VERIFIED: npm registry] |
| @testing-library/react | 16.3.2 | Component tests | Required for renderer/field-card tests under Vitest. [VERIFIED: npm registry] |
| jsdom | 29.1.1 | DOM environment for Vitest | Needed for React component tests in Node. [VERIFIED: npm registry] |
| @types/react | 19.2.17 | React TS types | Dev dependency for TSX. [VERIFIED: npm registry] |
| @types/react-dom | 19.2.3 | React DOM TS types | Dev dependency for React DOM entrypoint. [VERIFIED: npm registry] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-built schema renderer + RHF | RJSF/JSONForms | Faster initial form generation, but conflicts with locked polished field cards, per-option explanations, unknown-key preservation, and Phase 4 handoff controls. [VERIFIED: 03-CONTEXT.md] |
| React Query + small API client | Raw `fetch` everywhere | Raw fetch is sufficient for the placeholder, but React Query reduces duplicated loading/error/cache code across list/load/save/search surfaces. [ASSUMED] |
| Browser file input for path selection | Absolute path entry + server scan/review flow | Browser file inputs intentionally hide real paths, so an ordinary HTML file picker cannot drive `POST /api/configs/track` by itself. [CITED: MDN file input docs] |

**Installation:**

```bash
npm install react@19.2.7 react-dom@19.2.7 react-hook-form@7.81.0 @hookform/resolvers@5.4.0 zustand@5.0.14 @tanstack/react-query@5.101.2
npm install -D vite@8.1.4 @vitejs/plugin-react@6.0.3 @testing-library/react@16.3.2 jsdom@29.1.1 @types/react@19.2.17 @types/react-dom@19.2.3
```

## Package Legitimacy Audit

| Package | Registry | Age / Published | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----------------|-----------|-------------|---------|-------------|
| react | npm | 2026-06-01 | 144,886,784/wk | github.com/facebook/react | OK | Approved |
| react-dom | npm | 2026-06-01 | 112,894,778/wk | github.com/facebook/react | OK | Approved |
| vite | npm | 2026-07-09 | 117,240,518/wk | github.com/vitejs/vite | SUS: too-new | Flagged — planner must add checkpoint before latest-version install |
| @vitejs/plugin-react | npm | 2026-06-23 | 55,251,023/wk | github.com/vitejs/vite-plugin-react | SUS: too-new | Flagged — planner must add checkpoint before latest-version install |
| react-hook-form | npm | 2026-07-05 | 53,300,330/wk | github.com/react-hook-form/react-hook-form | SUS: too-new | Flagged — planner must add checkpoint before latest-version install |
| @hookform/resolvers | npm | 2026-05-21 | 37,314,027/wk | github.com/react-hook-form/resolvers | OK | Approved |
| zustand | npm | 2026-05-28 | 34,940,026/wk | github.com/pmndrs/zustand | OK | Approved |
| @tanstack/react-query | npm | 2026-06-27 | 56,246,133/wk | github.com/TanStack/query | SUS: too-new | Flagged — planner must add checkpoint before latest-version install |
| @testing-library/react | npm | 2026-01-19 | 44,313,473/wk | github.com/testing-library/react-testing-library | OK | Approved |
| jsdom | npm | 2026-04-30 | 61,968,962/wk | github.com/jsdom/jsdom | OK | Approved |
| @types/react | npm | 2026-06-05 | 106,021,989/wk | github.com/DefinitelyTyped/DefinitelyTyped | OK | Approved |
| @types/react-dom | npm | 2025-11-12 | 86,602,196/wk | github.com/DefinitelyTyped/DefinitelyTyped | OK | Approved |

**Packages removed due to [SLOP] verdict:** none. [VERIFIED: package-legitimacy seam]  
**Packages flagged as suspicious [SUS]:** `vite`, `@vitejs/plugin-react`, `react-hook-form`, `@tanstack/react-query`; all were flagged for recent publish age only, with high downloads, source repos, no deprecation, and no postinstall script reported. [VERIFIED: package-legitimacy seam]  
**Postinstall check:** `npm view ... scripts.postinstall --json` returned no postinstall values for all audited packages. [VERIFIED: npm registry]

## Architecture Patterns

### System Architecture Diagram

```text
CLI opens http://127.0.0.1:<port>/?t=<token>
        |
        v
Static React/Vite SPA (dist/client)
  - reads token once, strips URL
  - stores token in memory only
  - renders tracked sidebar + schema chapters + editor
        |
        | x-gsd-token on every /api request
        v
Fastify /api scope
  Host guard -> CORS/origin guard -> token guard
        |
        +--> GET /api/configs              -> registry.list()
        +--> POST /api/configs/track       -> registry.track(path)
        +--> GET /api/configs/:id          -> load(path, { bundled schema })
        +--> PUT /api/configs/:id          -> saveWithSnapshot(path, config, validator)
        +--> Phase 3 additive routes       -> persisted registry / scan / create helpers
        |
        v
Filesystem + app-data
  - project .planning/config.json
  - global ~/.gsd/defaults.json
  - app-data tracked registry and snapshots
```

### Recommended Project Structure

```text
web/
├── index.html
├── package-entry-owned-by-root-build
└── src/
    ├── main.tsx
    ├── api/
    │   ├── client.ts          # x-gsd-token injection + ApiOk/ApiErr parsing
    │   └── configs.ts         # typed wrappers for frozen + additive routes
    ├── schema/
    │   ├── indexSchema.ts     # group by x-category, enum/options metadata
    │   ├── effective.ts       # EffectiveLeaf lookup helpers
    │   └── patchProject.ts    # safe client-side patch intent builder
    ├── state/
    │   ├── uiStore.ts         # pane/search/chapter state
    │   └── queryClient.ts
    ├── components/
    │   ├── AppShell.tsx
    │   ├── sidebar/
    │   ├── chapters/
    │   ├── fields/
    │   ├── search/
    │   └── unknown/
    └── test/
        └── render-helpers.tsx
packages/server/src/
└── routes/
    └── configs.ts             # keep frozen routes; add Phase 3 routes separately
test/web/
└── schema-renderer.test.tsx
```

### Pattern 1: Token-aware API client

**What:** Parse `?t=` at startup, immediately remove it from the URL, keep token in memory, and attach `x-gsd-token` on every `/api` request. [VERIFIED: web/index.html]  
**When to use:** All Phase 3 API calls. [VERIFIED: 02-API-CONTRACT.md]  
**Example:**

```ts
// Source: existing web/index.html token flow + 02-API-CONTRACT.md.
let launchToken = new URLSearchParams(location.search).get('t');
history.replaceState({}, '', location.pathname);

export async function apiFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(path, {
    ...init,
    headers: { ...init.headers, 'x-gsd-token': launchToken ?? '' },
  });
  const body = await res.json();
  if (!body.ok) throw body;
  return body;
}
```

### Pattern 2: Schema index, not hard-coded tabs

**What:** Derive navigation from `Object.entries(schema).groupBy(entry['x-category'])`; sort and render fields from schema metadata. [VERIFIED: packages/schema-data/bundled-schema.json]  
**When to use:** Chapter nav, field list, search corpus, enum option labels. [VERIFIED: 03-CONTEXT.md]  
**Example:**

```ts
// Source: SchemaEntry in packages/config-io/src/types.ts.
type SchemaMap = Record<string, SchemaEntry>;

export function indexByCategory(schema: SchemaMap) {
  const categories = new Map<string, Array<[string, SchemaEntry]>>();
  for (const item of Object.entries(schema)) {
    const category = item[1]['x-category'];
    if (!categories.has(category)) categories.set(category, []);
    categories.get(category)!.push(item);
  }
  return categories;
}
```

### Pattern 3: Patch a copy of `raw.project`, never materialize defaults

**What:** Start edits from `LoadResult.raw.project`, apply touched project-layer changes only, and send the candidate object to `PUT /api/configs/:id`. [VERIFIED: packages/config-io/src/types.ts]  
**When to use:** Save and reset-to-default. [VERIFIED: 03-CONTEXT.md]  
**Example:**

```ts
// Source: Phase 1 safeSet contract; client should mirror intent, server remains authoritative.
const candidate = structuredClone(loadResult.raw.project);
for (const change of dirtyProjectChanges) {
  setDotPath(candidate, change.path, change.value);
}
for (const reset of resetProjectOverridePaths) {
  deleteDotPath(candidate, reset.path);
}
await apiFetch(`/api/configs/${id}`, {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ config: candidate }),
});
```

### Pattern 4: Additive registry persistence and scan routes

**What:** Persist a list of validated tracked paths/ordering in app-data, seed `createRegistry()` on launch, and expose additive routes for remove/reorder/rescan/relink. [VERIFIED: packages/server/src/registry.ts]  
**When to use:** DISC-02, D-14 missing-file states, D-12 scan review. [VERIFIED: 03-CONTEXT.md]  
**Pitfall:** Do not accept a client-supplied path anywhere except existing `track()` or a new route that delegates to `track()` for every selected path. [VERIFIED: 02-API-CONTRACT.md]

### Anti-Patterns to Avoid

- **Replacing frozen envelopes:** Keep `{ ok: true, ... }` / `{ ok: false, errors }`; adding alternate client-specific error shapes breaks Phase 2 contract. [VERIFIED: packages/server/src/api-types.ts]
- **Token-protecting static HTML:** Static assets must remain token-free or the SPA cannot bootstrap. [VERIFIED: packages/server/src/app.ts]
- **Using browser file input as an absolute path picker:** MDN documents that file inputs expose `C:\fakepath\`, not the real path, for security. [CITED: MDN file input docs]
- **Rendering arrays/maps as JSON text boxes:** Phase 3 must recognize and hand off array/dynamic-map nodes; full editing is Phase 4. [VERIFIED: 03-CONTEXT.md]
- **Saving a full effective tree:** This would materialize inherited defaults and risk losing unknown keys; save a patched project object only. [VERIFIED: packages/config-io/src/types.ts]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server auth/security | A separate client auth scheme | Existing Host/Origin/token guards | Phase 2 already hardened and tested the trust model. [VERIFIED: packages/server/src/app.ts] |
| Validation engine | A second TS-only validator | Existing Ajv schema conversion + RHF resolver | One schema family prevents client/server drift. [VERIFIED: packages/config-io/src/schema-convert.ts] |
| Generic form generation | RJSF black-box renderer | Hand-built RHF controls over schema metadata | Required card UX, option meanings, and Phase 4 handoff need bespoke rendering. [VERIFIED: 03-CONTEXT.md] |
| Path validation | Client-side path checks | `registry.track()` | The server registry is the path-traversal boundary. [VERIFIED: packages/server/src/registry.ts] |
| Static asset serving | New web server/proxy | Existing `registerStatic()` and `scripts/build-client.mjs` contract | Packaging tests assert `dist/client/index.html` ships. [VERIFIED: test/packaging/tarball-contents.test.ts] |
| Unknown-key detection | Client re-walk of raw JSON as authority | Existing `unknown[]` from `load()` | Server/codebase already centralizes known-key and dynamic-pattern classification. [VERIFIED: packages/config-io/src/load.ts] |

**Key insight:** Phase 3 is a UI shell on top of already-frozen safety contracts, not a second config engine. [VERIFIED: 02-API-CONTRACT.md]

## Existing Frontend/Server Seams

| Seam | Current State | Phase 3 Implication |
|------|---------------|---------------------|
| `web/index.html` | Placeholder page, reads token, strips URL, calls `/api/health`. [VERIFIED: web/index.html] | Replace with Vite entrypoint but preserve token behavior. |
| `scripts/build-client.mjs` | Existing package script builds/copies client into `dist/client`. [VERIFIED: package.json] | Wire Vite output to same directory; do not change tarball file contract. |
| `packages/server/src/static/serve.ts` | Serves `dist/client`, fallback for non-API routes, JSON 404 for `/api/*`. [VERIFIED: codebase grep] | React Router/client routes may rely on fallback; API routes must stay JSON. |
| `packages/server/src/routes/configs.ts` | Current list/track/load/save routes. [VERIFIED: codebase grep] | Add persistence/scan/create routes without altering existing shapes. |
| `packages/config-io/src/types.ts` | Frozen `LoadResult`, `EffectiveLeaf`, `UnknownKeyEntry`, `SchemaEntry`. [VERIFIED: codebase grep] | Client types should import or mirror these exact shapes. |
| `packages/server/src/schema.ts` | Inlines bundled schema into bundle-safe server access. [VERIFIED: codebase grep] | Add a read-only schema API if client needs the schema; do not rely on runtime file path resolution. |

## Schema Shapes and Renderer Notes

- The bundled schema is a flat dot-path map, not a nested JSON Schema tree; client indexing should use flat keys directly for categories/search and call the existing converter only for Ajv validation. [VERIFIED: packages/config-io/src/schema-convert.ts]
- Dynamic maps are represented by container entries with `patternProperties` and `x-dynamic-key-hint`; Phase 3 should detect them as handoff cards rather than scalar controls. [VERIFIED: packages/config-io/src/types.ts]
- Existing category labels are not identical to the 21 chapters in older research; current artifact has 12 category labels across 158 entries, so planner should base Phase 3 navigation on the current artifact and only split subgroups inside categories where UX needs it. [VERIFIED: node schema count]
- `x-options` exists but is sparse; Phase 3 should display option descriptions when present and expose a content-gap test for enum entries missing option prose. [VERIFIED: packages/schema-data/bundled-schema.json]

## Common Pitfalls

| Pitfall | Why It Matters | Prevention |
|---------|----------------|------------|
| `GET /api/configs` starts empty every launch | Phase 2 registry is in-memory only. [VERIFIED: 02-API-CONTRACT.md] | Persist tracked list in app-data and seed registry on launch. |
| Browser file picker cannot provide raw absolute paths | File input `value` hides real paths as `C:\fakepath\`. [CITED: MDN file input docs] | Treat path entry and server-side scan as canonical; if offering a picker, design it as UX sugar that still resolves through server-supported paths. |
| Unknown keys disappear after save | Rebuilding config from form state drops keys outside schema. [VERIFIED: packages/config-io/src/types.ts] | Patch a copy of `raw.project`; include round-trip tests with fabricated unknown keys. |
| Inline validation diverges from server validation | Client accepts a value that server later rejects, or vice versa. [VERIFIED: packages/config-io/src/validate.ts] | Use same Ajv-converted schema and still treat server 422 as authoritative. |
| Static build path drift | Packaging tests require `dist/client/index.html`. [VERIFIED: test/packaging/tarball-contents.test.ts] | Configure Vite outDir to the existing contract and keep build order `build:cli && build:client`. |
| Premature validation errors | Violates D-10 and creates noisy beginner UX. [VERIFIED: 03-CONTEXT.md] | Use touched/blur state for display; compute validity separately for save blocking. |
| Treating missing tracked file as deletion | D-14 says keep it recoverable. [VERIFIED: 03-CONTEXT.md] | Persist entry with problem status; disable editing; offer locate/remove. |
| Writing scan results immediately | D-12 requires review-and-select before adding. [VERIFIED: 03-CONTEXT.md] | Scan route returns candidates only; confirm route/track call applies selected set. |

## Code Examples

### Build a searchable field corpus

```ts
// Source: 03-CONTEXT.md D-16 and SchemaEntry contract.
function searchableText(path: string, entry: SchemaEntry) {
  const optionText = Object.entries(entry['x-options'] ?? {})
    .map(([value, meta]) => `${value} ${meta['x-description']}`)
    .join(' ');
  return `${path} ${entry.title} ${entry['x-description']} ${optionText}`.toLowerCase();
}
```

### Map `EffectiveLeaf.from` to user copy

```ts
// Source: packages/config-io/src/types.ts Provenance.
const provenanceLabel = {
  project: 'Project override',
  global: 'Global default',
  canonical: 'Canonical default',
} satisfies Record<Provenance, string>;
```

### Recognize Phase 4 handoff fields

```ts
// Source: SchemaEntry dynamic pattern + D-07.
function needsSpecializedEditor(entry: SchemaEntry) {
  return entry.type === 'array' || entry.type === 'object' || Boolean(entry.patternProperties);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Placeholder static HTML | Vite-built React SPA served from `dist/client` | Phase 3 | Real UI replaces health-check page while preserving static/API boundary. [VERIFIED: web/index.html] |
| In-memory registry only | Persisted app-data registry seeded into `createRegistry()` | Phase 3 | Enables DISC-02 without breaking opaque id semantics. [VERIFIED: packages/server/src/registry.ts] |
| Raw form/object rebuild | Patch original project JSON copy | Phase 1+3 | Preserves unknown/future keys and avoids materializing inherited defaults. [VERIFIED: packages/config-io/src/types.ts] |
| Server-only validation feedback | Client inline Ajv feedback plus server authoritative 422 | Phase 3 | Meets D-10/EDIT-06 while preserving save safety. [VERIFIED: packages/server/src/routes/configs.ts] |

**Deprecated/outdated:** Browser file input as an absolute filesystem path picker is not viable for `track()` because browsers intentionally hide real paths. [CITED: MDN file input docs]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | React Query is worth installing rather than using a small raw-fetch wrapper for this phase. | Standard Stack | If overkill, planner can omit it and keep API client simpler. |
| A2 | The UI will receive or import schema metadata client-side; no schema-read route exists yet. | Architecture Patterns | Planner must choose either bundle/import schema into client or add a read-only schema endpoint. |

## Resolved Planning Decisions

1. **File-picker behavior:** Use absolute path entry and chosen-folder scan/review. Normal browser file inputs cannot provide a real absolute path; no Chromium-only File System Access API is required for Phase 3. [CITED: MDN file input docs]

2. **Schema delivery:** Consume a token-guarded GET /api/schema response using the existing API envelope. The server remains the source of truth. [VERIFIED: packages/server/src/schema.ts] [RESOLVED: 03-01-PLAN.md]

3. **Enum option prose coverage:** Add an automated coverage test for enum entries lacking x-options; render a safe documentation-unavailable state rather than inventing implications. [VERIFIED: packages/schema-data/bundled-schema.json] [RESOLVED: 03-02-PLAN.md]
## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Build/test/runtime | ✓ | v24.6.0 | Project engine floor remains `>=20.19`. [VERIFIED: shell] |
| npm | Install/build scripts | ✓ | 11.14.1 | — [VERIFIED: shell] |
| TypeScript | Typecheck | ✓ | 5.9.3 | — [VERIFIED: shell] |
| Vitest | Existing tests | ✓ | 4.1.10 | — [VERIFIED: shell] |
| React/Vite/RHF frontend deps | Phase 3 UI | ✗ | not installed | Install audited packages. [VERIFIED: npm ls] |
| Browser/E2E tool | Optional full UI smoke | ✗ | none in package.json | Use component tests first; add Playwright later only if Phase 3 UAT needs browser automation. [VERIFIED: package.json] |

**Missing dependencies with no fallback:**
- React/Vite/RHF frontend packages are not installed yet; Phase 3 cannot build the real SPA without adding them. [VERIFIED: npm ls]

**Missing dependencies with fallback:**
- Full E2E browser runner is absent; component tests plus existing Fastify inject/spawn tests can cover Wave 0, with browser UAT manual if necessary. [VERIFIED: test tree]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 [VERIFIED: shell] |
| Config file | Existing `vitest.config.ts` is implied by package scripts/tests; keep `npm test` and add web-specific tests. [VERIFIED: package.json] |
| Quick run command | `npm run test:server` for API changes; add `vitest run test/web --reporter=dot` for UI units. [VERIFIED: package.json] |
| Full suite command | `npm test` [VERIFIED: package.json] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| SCHEMA-02/03 | Field and enum option docs render | component | `vitest run test/web/schema-renderer.test.tsx -t docs` | ❌ Wave 0 |
| SCHEMA-04 | Every schema entry appears in a chapter or handoff card | unit/component | `vitest run test/web/schema-renderer.test.tsx -t coverage` | ❌ Wave 0 |
| SCHEMA-06 | Unknown keys render in `Unrecognized` and survive save candidate build | unit/component | `vitest run test/web/unknown-keys.test.tsx` | ❌ Wave 0 |
| DISC-01/02/05 | Track/list/load sidebar flow | server + component | `vitest run test/server test/web/sidebar.test.tsx` | ❌ Wave 0 for web |
| DISC-03 | Scan excludes `.git`/`node_modules` and requires confirmation | server | `vitest run test/server/scan.test.ts` | ❌ Wave 0 |
| DISC-04 | Create config targets `<project>/.planning/config.json` and uses PUT path | server | `vitest run test/server/create-config.test.ts` | ❌ Wave 0 |
| EDIT-01/05 | Category tabs + grouped search results | component | `vitest run test/web/search.test.tsx` | ❌ Wave 0 |
| EDIT-02/04/06 | Provenance badges, reset, schema enum controls, inline validation | component | `vitest run test/web/field-card.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** targeted `vitest run test/web/... --reporter=dot` or existing `npm run test:server` depending on touched seam. [VERIFIED: package.json]
- **Per wave merge:** `npm test` plus `npm run typecheck`. [VERIFIED: package.json]
- **Phase gate:** `npm run build`, `npm test`, `npm run typecheck`, and manual launch smoke against tokenized URL. [VERIFIED: package.json]

### Wave 0 Gaps

- [ ] `web/src/` React/Vite entrypoint and build config.
- [ ] `test/web/render-helpers.tsx` with React Testing Library setup.
- [ ] `test/web/schema-renderer.test.tsx` for schema coverage.
- [ ] `test/server/registry-persistence.test.ts` for DISC-02.
- [ ] `test/server/scan.test.ts` for DISC-03 exclusions and review model.
- [ ] `test/server/create-config.test.ts` for DISC-04 path/overwrite confirmation semantics.
- [ ] `vitest` DOM environment setup using `jsdom`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Existing per-launch token required on all `/api/*` requests. [VERIFIED: packages/server/src/plugins/token-guard.ts] |
| V3 Session Management | yes | Token stays in memory and is stripped from URL; no localStorage/sessionStorage. [VERIFIED: web/index.html] |
| V4 Access Control | yes | Opaque id registry resolves paths server-side; save route ignores client-supplied path. [VERIFIED: packages/server/src/routes/configs.ts] |
| V5 Input Validation | yes | Ajv 2020-12 validates saves; registry validates raw paths. [VERIFIED: packages/config-io/src/validate.ts] |
| V6 Cryptography | yes | Token minted with `crypto.randomUUID`; ids/snapshot keys use sha256. [VERIFIED: packages/server/src/context.ts] [VERIFIED: packages/server/src/registry.ts] |

### Known Threat Patterns for Phase 3

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS through rendered config values/descriptions | Tampering / Information Disclosure | Render values as text, not HTML; existing placeholder uses `textContent`. [VERIFIED: web/index.html] |
| Path traversal via new scan/create routes | Elevation of Privilege | Funnel every concrete config path through `registry.track()` or equivalent static-message validation. [VERIFIED: packages/server/src/registry.ts] |
| CSRF/DNS rebinding against local server | Spoofing / Tampering | Preserve root Host guard + `/api` Origin/token guards. [VERIFIED: packages/server/src/app.ts] |
| Secret leakage in validation/logs | Information Disclosure | Reuse static error messages and Ajv error rendering that omits offending values. [VERIFIED: packages/config-io/src/validate.ts] |
| Prototype pollution from dot-path patches | Tampering / Elevation of Privilege | Server-side `safeSet` denylist exists; client patch helper should mirror denylist for early UX but server remains authoritative. [VERIFIED: packages/config-io/src/patch.ts] |

## Sources

### Primary (HIGH confidence)

- `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` — project scope, phase mapping, and active state. [VERIFIED: filesystem]
- `.planning/phases/03-generic-schema-driven-ui-shell/03-CONTEXT.md` — locked Phase 3 decisions and boundaries. [VERIFIED: filesystem]
- `.planning/phases/02-local-loopback-server-cli-security-hardening/02-API-CONTRACT.md` — frozen REST envelopes/routes/statuses. [VERIFIED: filesystem]
- `packages/config-io/src/types.ts`, `load.ts`, `schema-convert.ts`, `validate.ts`, `patch.ts` — Phase 1 data contracts and validation behavior. [VERIFIED: codebase grep]
- `packages/server/src/app.ts`, `registry.ts`, `routes/configs.ts`, `schema.ts`, `static/serve.ts` — Phase 2 server/API seams. [VERIFIED: codebase grep]
- `test/` — existing Vitest coverage for schema completeness, unknown keys, save safety, API security, packaging. [VERIFIED: codebase grep]

### Secondary (MEDIUM confidence)

- Context7 `/reactjs/react.dev` — controlled inputs, local state, memoized derived views, effect-avoidance guidance. [CITED: Context7 React docs]
- Context7 `/vitejs/vite/v8.0.10` — production build configuration, `base`, `outDir`, custom/static serving. [CITED: Context7 Vite docs]
- Context7 `/react-hook-form/documentation` — `useForm`, `useController`, `useFieldArray`, resolver-oriented validation patterns. [CITED: Context7 React Hook Form docs]
- MDN `<input type="file">` — `C:\fakepath\` behavior and file input path security. [CITED: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file]

### Tertiary (LOW confidence)

- npm registry version/postinstall checks — current package versions and source repos; GSD confidence seam classifies registry provider as LOW despite direct registry verification. [VERIFIED: npm registry]
- GSD package-legitimacy seam — `OK`/`SUS` verdicts used for planner checkpoints. [VERIFIED: package-legitimacy seam]

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — package versions verified by npm and package names corroborated by official docs where queried; several latest packages require SUS checkpoints due recent publish age.
- Architecture: HIGH — based on frozen repo contracts and Phase 2 API/code.
- Pitfalls: HIGH for codebase/API pitfalls, MEDIUM for browser file-picker limitation due MDN source.
- Validation strategy: HIGH for existing test infrastructure, MEDIUM for proposed web test files.

**Research date:** 2026-07-15  
**Valid until:** 2026-07-22 for npm package latest-version recommendations; Phase 2/Phase 1 codebase contract findings remain valid until those files change.

