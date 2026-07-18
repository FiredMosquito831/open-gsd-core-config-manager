# Phase 4: Pool Editors & Model Profile Specialization - Research

**Researched:** 2026-07-18  
**Domain:** React/TypeScript schema-guided editors for layered GSD configuration pools, model profiles, secrets, and runtime-aware model resolution  
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Selecting a specialized array, structured object, or dynamic-map field opens a **dedicated focused panel** that replaces the main editor surface and provides a clear Back action to the originating chapter.
- **D-02:** The focused pool workspace uses a **selectable entry list plus detail editor**: the list contains add/reorder/remove actions and entry status; selecting an entry opens its complete guided per-field controls in the detail area.
- **D-03:** Ordered arrays provide both accessible **Move up / Move down** controls and optional drag-and-drop as a pointer shortcut. Dragging must never be the only way to reorder.
- **D-04:** Add creates a guided blank entry, prefilled with schema defaults where available, selects it immediately, and guides completion of required fields. Do not offer templates or cloning.
- **D-05:** Agent-keyed maps use a schema-informed agent picker that excludes keys already present. The accompanying value picker must limit choices to supported tiers/models; do not accept arbitrary free-text agent names.
- **D-06:** Removing a pool entry or agent override requires a confirmation that identifies the entry. Reordering takes effect immediately in the unsaved draft.
- **D-07:** Show inline errors on invalid entry fields, visibly badge invalid entries in the entry list, preserve the draft, and block the overall config save until all errors are corrected.
- **D-08:** Do not provide per-entry duplication. New entries always follow the guided schema-default initialization path to avoid accidental copied identities, agent keys, or secrets.
- **D-09:** Add a dedicated **Profiles** chapter to the middle navigation rather than burying profiles in generic model settings or a utility menu.
- **D-10:** The Profiles chapter presents profiles as compact cards with name, short description, and a readable per-agent/per-role tier-assignment summary. Opening a card leads to its focused editor.
- **D-11:** Creating a custom profile starts by copying a built-in or existing profile, then giving the copy a new name and editing its assignments. Empty-profile creation is not part of the primary flow.
- **D-12:** When saving a profile or override changes a runtime-baked setting, show a persistent post-save notice naming the changed setting and the required `gsd install` command. Keep it visible until dismissal or loading another config.
- **D-13:** Each focused pool/profile editor has an always-visible compact three-layer summary for canonical default → global default → project override. It identifies the effective source and allows each layer’s value to be expanded for inspection.
- **D-14:** Editing an inherited complex value creates a project-level copy/override and explains that scope change before opening guided changes; source layers remain inspectable.
- **D-15:** Sensitive integration/API-key fields are masked by default. A deliberate per-field Reveal control exposes a value temporarily; sensitive values must never be included in UI logs, diagnostics, or normal copy flows.
- **D-16:** Revealed sensitive values hide again on field blur and after a short inactivity timeout, requiring a new deliberate Reveal to expose them again.

### Claude's Discretion
- Exact panel/list widths, breakpoint behavior, drag-and-drop library and affordances, confirmation copy, timeout length, profile-card visual treatment, and the exact definition/list of runtime-baked settings are open to research and planning, provided the locked interactions and safety behavior above are preserved.
- Exact schema metadata extensions and additive API/client-state shapes are open, but the frozen Phase 2 HTTP security/envelope contracts and Phase 3 schema-driven/edit-save patterns must remain intact.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-03 | Mask integration/API-key fields by default and never log them | Secret-field design, safe error handling, clipboard/logging rules, and ASVS controls below. |
| EDIT-03 | Show effective value and provenance across canonical/global/project layers | Reuse `LoadResult.effective`, `EffectiveNode`, `Provenance`, and `getEffectiveLeaf`; add a complex-value layer summary without changing save semantics. |
| POOL-01 | Edit arrays and dynamic maps as guided pools | Focused list/detail workspace, schema metadata, draft mutation, and RHF array patterns. |
| POOL-02 | Edit structured-object pools per field | Add a field-shape metadata contract for known object-array/map entries and render local guided controls. |
| POOL-03 | Edit agent-keyed maps with agent and value pickers | Reuse one agent-map editor for `model_overrides`, `effort.agent_overrides`, and `fast_mode.agent_overrides`; restrict both key and value choices. |
| PROF-01 | View existing profiles and per-agent/per-role assignments | Add Profiles chapter, profile catalog metadata, cards, and readable assignment summary. |
| PROF-02 | Edit an existing profile | Focused profile editor writes a project-level profile/override draft through existing save pipeline. |
| PROF-03 | Create a custom profile per gsd-core shape | Copy built-in/existing profile, require a new name, then edit assignments; do not create arbitrary empty profile data. |
| PROF-04 | Surface `gsd install` requirement for runtime-baked settings | Detect runtime-sensitive changed paths from explicit metadata and current runtime; emit persistent post-save notice from save result/change set. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Use React + Vite + TypeScript frontend and Node-based CLI/local helper; this is the project’s assumed stack. [VERIFIED: `.claude/CLAUDE.md`]
- Keep the architecture local-only with a loopback helper; do not introduce a hosted server. [VERIFIED: `.claude/CLAUDE.md`]
- Preserve validate → atomic write → snapshot history/revert data-safety flow. [VERIFIED: `.claude/CLAUDE.md`]
- Represent and document every canonical config key; unknown/future keys must not be silently dropped. [VERIFIED: `.claude/CLAUDE.md`]
- Track evolving gsd-core schema through the bundled/reconcile strategy; Phase 4 must not implement live reconciliation. [VERIFIED: `.claude/CLAUDE.md`]
- Follow the manual CSS design system and native accessible controls; the approved UI contract says no component library or icon registry is initialized. [VERIFIED: `04-UI-SPEC.md`]
- Do not directly rebuild or serialize an effective form tree as the save payload; mutate a project-object copy and submit it through the existing API. [VERIFIED: `04-CONTEXT.md`; `packages/config-io/src/types.ts`]
- Do not add raw JSON editing, version-history UI, or live schema reconciliation in this phase. [VERIFIED: `04-CONTEXT.md`]

## Summary

Phase 4 should be implemented as a client-side specialization layer over the Phase 3 schema renderer, not as a second persistence system. The existing server already returns `LoadResult` with raw project/global objects, merged effective values, provenance, and unknown-key information, while `PUT /api/configs/:id` is the only write route and delegates to validation, atomic write, and snapshot creation. The safe plan is therefore: classify specialized schema entries, route them into focused local components, mutate only the project draft, and let the existing full-candidate save path remain authoritative. [VERIFIED: `packages/config-io/src/types.ts`; `packages/server/src/routes/configs.ts`; `web/src/components/editor/ConfigEditor.tsx`]

The difficult part is not generic array CRUD. It is preserving identity and validation for several different shapes: ordered arrays of objects, named maps of objects, agent-keyed scalar maps, polymorphic runtime-tier values, and profile assignments. The bundled schema currently describes many dynamic containers but does not contain enough entry-field metadata to render the required guided editors for every named example; Phase 4 needs additive metadata for known shapes, with tests proving that unknown keys remain visible/read-only and are not reconstructed away. The model UI must also distinguish the three config-file layers required by the product from gsd-core’s model-resolution chain, which has more than three semantic stages. [VERIFIED: `packages/schema-data/bundled-schema.json`; `04-CONTEXT.md`; [CITED: https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md]

**Primary recommendation:** Build a reusable focused-workspace shell plus three editor primitives—ordered structured pool, keyed object/map pool, and restricted agent/value map—and drive them from additive schema metadata and the existing project-draft patch boundary; implement profile cards/editor and runtime-baked notices on top of the same agent/value primitive.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Specialized pool/profile navigation and controls | Browser / Client | — | The browser owns list/detail interaction, touched state, masking, and responsive presentation. [VERIFIED: `04-CONTEXT.md`; `04-UI-SPEC.md`] |
| Effective three-layer summary | Browser / Client | API / Backend | The server already computes `effective` and provenance; the client renders and expands it without mutating source layers. [VERIFIED: `packages/config-io/src/load.ts`; `packages/config-io/src/types.ts`] |
| Project draft mutation | Browser / Client | — | Phase 3’s `patchProject.ts` is the established client mutation boundary. [VERIFIED: `web/src/schema/patchProject.ts`] |
| Authoritative validation and save | API / Backend | Database / Storage | Server-side Ajv validation and `saveWithSnapshot` remain the final gate before atomic disk write. [VERIFIED: `packages/server/src/routes/configs.ts`] |
| Profile/model catalog and runtime-baked classification | API / Backend or bundled schema metadata | Browser / Client | The classification must be based on authoritative gsd-core/runtime metadata, while the UI only presents the result and notice. Do not infer it from display labels. [CITED: https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md] |
| Secret masking and reveal state | Browser / Client | API / Backend | The current config must still be loaded for editing, but the browser must mask by default and keep values out of logs/copy flows. Server errors/logs must remain value-free. [VERIFIED: `packages/config-io/src/validate.ts`; `04-CONTEXT.md`] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | `19.2.7` | Focused panels, profile cards, field controls, reveal state | Already locked in the repository. [VERIFIED: `package.json`; npm registry] |
| TypeScript | `5.9.3` | Type-safe shape metadata, draft patches, and UI state | Already locked in the repository. [VERIFIED: `package.json`; npm registry] |
| React Hook Form | `7.81.0` | Local guided field state, touched/blur errors, and ordered array control | Already installed and Phase 3 uses it. Official docs provide `useFieldArray` append/remove patterns and stable `field.id` keys. [VERIFIED: `package.json`; [CITED: https://github.com/react-hook-form/documentation/blob/master/src/content/docs/usefieldarray.mdx] |
| Ajv | `8.20.0` | Shared authoritative schema validation and error paths | Already installed; Phase 1/3 use the converted schema and server validation. Ajv exposes structured `instancePath`/`keyword` errors and supports metadata keywords. [VERIFIED: `package.json`; [CITED: https://ajv.js.org/api.html] |
| TanStack Query | `5.101.2` | Load schema/config and refresh the config query after saves | Already installed; the current editor uses `useQuery`, `useMutation`, and `setQueryData`. [VERIFIED: `package.json`; [CITED: https://tanstack.com/query/v5/docs/framework/react/quick-start.md] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@hookform/resolvers` | `5.4.0` | Existing Ajv/RHF integration point | Use only if the specialized subtree can be cleanly represented by the existing resolver; otherwise call the project’s `createClientValidator` against the full project candidate as Phase 3 does. [VERIFIED: `package.json`; npm registry] |
| Native React timers/effects | React `19.2.7` | Blur and inactivity re-masking | Use `useEffect` cleanup to clear timeout/listener resources on unmount or field changes. [CITED: https://react.dev/learn/synchronizing-with-effects] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|------------|----------|
| Native accessible Move up/Move down buttons | Drag-and-drop library | Optional pointer shortcut, but adds dependency and keyboard/ARIA complexity; locked decisions require buttons regardless. [VERIFIED: `04-CONTEXT.md`; `04-UI-SPEC.md`] |
| Additive local schema metadata | Generic JSON-Schema form generator | Generic generation does not express the approved list/detail UX, profile-copy flow, identity-safe add behavior, or polymorphic runtime-tier controls. [VERIFIED: `04-CONTEXT.md`; `.planning/research/PITFALLS.md`] |
| Existing full-project save route | New pool/profile REST routes | New routes would duplicate draft, auth, validation, and snapshot semantics; the frozen API contract explicitly leaves the existing config save path as the integration surface. [VERIFIED: `04-CONTEXT.md`; `packages/server/src/routes/configs.ts`] |
| Fixed catalog metadata for Phase 4 | Live schema refresh/catalog sync | Live reconciliation is Phase 6; bundle the needed catalog/metadata now and leave refresh for later. [VERIFIED: `ROADMAP.md`; `04-CONTEXT.md`] |

**Installation:** No new package is required by the recommended plan. Existing dependencies are sufficient. [VERIFIED: `package.json`]

### Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@hookform/resolvers` | npm | Published 2026-05-21 | 44,649,230 weekly | github.com/react-hook-form/resolvers | OK | Approved; already installed. [VERIFIED: npm registry; legitimacy gate] |
| `@tanstack/react-query` | npm | Published 2026-06-27 | 55,527,783 weekly | github.com/TanStack/query | SUS — too-new signal | Already installed; do not upgrade or add a new version in this phase. If a new install becomes necessary, planner must add `checkpoint:human-verify` before installation. [VERIFIED: npm registry; legitimacy gate] |
| `ajv` | npm | Published 2026-04-24 | 314,629,264 weekly | github.com/ajv-validator/ajv | OK | Approved; already installed. [VERIFIED: npm registry; legitimacy gate] |

**Packages removed due to SLOP verdict:** none.  
**Packages flagged as suspicious [SUS]:** `@tanstack/react-query` — existing dependency, no install task recommended; human verification required before any new install/upgrade.  
**Postinstall check:** none of the three packages returned a postinstall script. [VERIFIED: npm registry]

## Architecture Patterns

### System Architecture Diagram

```text
Schema GET + config GET
        │
        ▼
Phase 3 ConfigEditor owns full project draft, changes, resets, RHF form, save bar
        │
        ├── scalar field ──► existing FieldCard / ScalarFieldControl
        │
        └── specialized field ──► FocusedWorkspace
                                  ├── sticky Back + three-layer summary
                                  ├── selectable entry list
                                  │    ├── Add (schema-default blank)
                                  │    ├── Move up/down (ordered arrays)
                                  │    └── Remove → named confirmation
                                  └── detail editor
                                       ├── structured fields
                                       ├── restricted agent/value picker
                                       ├── inline entry errors + Invalid badge
                                       └── secret field: masked → deliberate reveal → blur/timeout remask
                                                        │
                                                        ▼
                                      project draft patch (`patchProject.ts`)
                                                        │
                                                        ▼
                                      full candidate + client Ajv validation
                                                        │
                                      PUT /api/configs/:id + token/origin guards
                                                        │
                                      server Ajv → atomic write → snapshot
                                                        │
                                      response + refreshed LoadResult
                                                        │
                         changed runtime-baked path? ──┴──► persistent `gsd install` notice
```

The diagram’s save path is intentionally the existing path, not a specialized endpoint. [VERIFIED: `web/src/components/editor/ConfigEditor.tsx`; `packages/server/src/routes/configs.ts`]

### Recommended Project Structure

```text
web/src/
├── components/
│   ├── chapters/
│   │   ├── ChapterNav.tsx                 # Add Profiles chapter entry
│   │   └── ChapterView.tsx                # Route specialized fields to focused workspace
│   ├── specialized/
│   │   ├── FocusedWorkspace.tsx           # Shared Back/list/detail/layer shell
│   │   ├── PoolEntryList.tsx              # Selection, status, add/reorder/remove
│   │   ├── LayerSummary.tsx               # Canonical/global/project inspection
│   │   ├── StructuredPoolEditor.tsx       # Array/object entry field controls
│   │   ├── AgentValueMapEditor.tsx        # Restricted agent + tier/value maps
│   │   ├── ProfileCards.tsx                # Built-in/custom profile overview
│   │   ├── ProfileEditor.tsx               # Copy/edit assignment matrix
│   │   ├── SecretField.tsx                 # Mask/reveal/blur/timeout behavior
│   │   └── RuntimeInstallNotice.tsx        # Persistent post-save notice
│   └── editor/
│       └── ConfigEditor.tsx                # Integrate focused state and notice
├── schema/
│   ├── indexSchema.ts                      # Specialized metadata/indexing
│   ├── specializedMetadata.ts             # Shape/catalog/runtime classifiers
│   ├── effective.ts                        # Existing effective leaf lookup
│   └── patchProject.ts                     # Existing project-only mutation boundary
└── state/
    └── uiStore.ts                          # Focused panel/profile state
packages/schema-data/
└── bundled-schema.json                     # Additive shape metadata, not a new schema source
```

File names are a recommended decomposition; implementation should follow existing naming if the planner finds a closer seam. The important boundary is that specialized UI stays in the browser and project mutations flow through `patchProject.ts`. [VERIFIED: existing source tree and `04-CONTEXT.md`]

### Pattern 1: Specialized metadata separates validation shape from UI behavior

**What:** Keep the canonical field type/pattern/default in `SchemaEntry`, then add narrowly scoped `x-*` metadata for editor kind, entry fields, allowed agent/value catalogs, sensitive status, and runtime-baked paths. Do not encode UI-only assumptions into a new competing validation schema. [VERIFIED: `SchemaEntry` already uses additive `x-*` metadata; `packages/config-io/src/types.ts`]

**When to use:** For known structured pools and profiles whose per-entry controls cannot be derived safely from a flat container `patternProperties` entry alone. [VERIFIED: current `bundled-schema.json`; `.planning/research/PITFALLS.md`]

**Planning shape:** Define discriminated metadata such as `x-editor: "structured-array" | "keyed-object" | "agent-map" | "profile"`, then define field descriptors with path, type, enum/options, required, sensitive, and help text. Keep unknown/future keys open and visible rather than inventing a generic editor for them. [ASSUMED]

### Pattern 2: Stable identity for ordered entries

Use `useFieldArray` for the local ordered editor or mirror its stable identity behavior in the project’s draft model. Render each entry with RHF’s generated `field.id`, not array index; official RHF documentation warns that index keys cause re-render and field-state problems. Use `append`/`remove`/`move` semantics, and ensure Move up/down changes the unsaved draft immediately. [CITED: https://github.com/react-hook-form/documentation/blob/master/src/content/docs/usefieldarray.mdx]

Do not persist RHF’s synthetic `id` into config JSON. The saved value must contain only the schema-defined entry fields; stable UI identity is ephemeral. [ASSUMED]

### Pattern 3: Full-candidate validation for entry errors

On entry change, update the project draft at the specialized path, validate the full candidate with the existing client validator, and map Ajv `instancePath` errors back to the selected entry and field. Maintain a separate entry-status projection so invalid non-selected entries receive an `Invalid` badge without losing their draft. The server remains authoritative and can still return 422 errors. [VERIFIED: `web/src/components/editor/ConfigEditor.tsx`; `web/src/schema/validation.ts`; [CITED: https://ajv.js.org/api.html]

Do not use `JSON.stringify` of the full config for diagnostics or error copy. Existing Phase 1 formatting intentionally emits path/keyword-oriented errors without values, which is especially important for secret-shaped fields. [VERIFIED: `packages/config-io/src/validate.ts`; `test/config-io/validate.test.ts`]

### Pattern 4: Three config layers plus model-resolution explanation

The focused header must show the required three file layers—canonical, global, project—with the effective source marked. For model profiles, add a second explanatory area or per-assignment detail explaining semantic model resolution, because gsd-core documents a higher-to-lower chain involving `model_overrides`, runtime-aware profile/tier resolution, phase-level `models`, dynamic routing, and runtime defaults. Do not collapse the semantic chain into the three file-layer labels; one is file provenance and the other is runtime resolution. [VERIFIED: `04-CONTEXT.md`; `packages/config-io/src/types.ts`; [CITED: https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md]

When a complex value is inherited, the first edit must materialize a project-level copy from the effective value, mark the change as project scope, and retain source-layer inspection. Never mutate global/canonical values through a project config save. [VERIFIED: `04-CONTEXT.md`; `packages/config-io/src/patch.ts`]

### Pattern 5: Secret field as a state machine

Use explicit states: `masked`, `revealed`, and `editing` if editing needs a blank input. The default DOM value should be masked; Reveal must be a deliberate button with an accessible name; blur immediately masks; a short inactivity timer masks; unmount and config change clear reveal state. Use effect cleanup for timers/listeners. [CITED: https://react.dev/learn/synchronizing-with-effects]

A safer edit UX is to avoid pre-filling a secret into a normal text input when the user is merely inspecting it; require an explicit edit/reveal action and ensure cancellation restores the mask. This is a product-security recommendation rather than a verified gsd-core requirement. [ASSUMED]

### Pattern 6: Mutation success refresh and notice derivation

After a successful save, refresh or replace `['config', activeConfigId]` using the returned result/current load, clear changes/resets, and retain a notice derived from the changed paths. TanStack Query documents `invalidateQueries` and `setQueryData` in mutation `onSuccess`; the existing editor already refetches and sets the config query. [CITED: https://tanstack.com/query/v5/docs/framework/react/guides/invalidations-from-mutations.md; VERIFIED: `web/src/components/editor/ConfigEditor.tsx`]

Derive runtime notices from changed canonical paths plus active runtime metadata, not from a server warning string that might include user data. The notice should contain only the known setting label/path and literal `gsd install`, never the changed value. [ASSUMED]

### Anti-Patterns to Avoid

- **Treating every object/array as a generic text/JSON editor:** violates POOL requirements and loses field-specific identity/validation. Use known specialized metadata and focused controls. [VERIFIED: `04-CONTEXT.md`; `04-UI-SPEC.md`]
- **Rebuilding the project config from effective form state:** materializes inherited values and risks dropping unknown/future keys. Patch the original project object copy. [VERIFIED: `packages/config-io/src/types.ts`; `packages/config-io/src/patch.ts`]
- **Using array indexes as React/RHF keys:** corrupts field state after reorder/remove. Use stable `field.id`. [CITED: https://github.com/react-hook-form/documentation/blob/master/src/content/docs/usefieldarray.mdx]
- **Accepting free-text agent names or arbitrary tier values:** permits typos and violates D-05. Use schema/catalog-constrained pickers. [VERIFIED: `04-CONTEXT.md`]
- **Allowing an inherited edit to write back to global/canonical data:** scope is wrong and violates D-14. Materialize a project override. [VERIFIED: `04-CONTEXT.md`]
- **Showing full config values in logs, diagnostics, test failure helpers, or normal copy flows:** can leak API keys. Preserve path-only/static error messages and test that fake secrets never appear. [VERIFIED: `packages/config-io/src/validate.ts`; `04-CONTEXT.md`]
- **Assuming every model change is immediately active:** Codex/OpenCode-style installs may bake resolved model IDs into static agent frontmatter at install time. Emit the install notice when the documented runtime/path condition matches. [CITED: https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md]
- **Claiming a tier/model ID is valid merely because it is a string:** gsd-core permits model-ID strings in some override surfaces; picker restrictions should be explicit and unknown catalog values should produce a warning or read-only preservation policy, not silent deletion. [CITED: https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md; ASSUMED for warning UX]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ordered form-array lifecycle | Manual index-keyed arrays with ad hoc touched/error tracking | RHF `useFieldArray` or a wrapper preserving its stable IDs and move/remove semantics | RHF supplies append/remove/move-oriented field-array behavior and stable IDs. [CITED: https://github.com/react-hook-form/documentation/blob/master/src/content/docs/usefieldarray.mdx] |
| Schema validation | Per-component validators that drift from server rules | Existing Ajv-converted client validator plus server Ajv gate | The project already chose one schema source of truth and server validation is authoritative. [VERIFIED: `packages/config-io/src/validate.ts`; `web/src/schema/validation.ts`] |
| Layer merge/provenance | A second client resolution engine | `LoadResult.effective`, `EffectiveNode`, `getEffectiveLeaf`, and additive complex lookup helpers | Existing loader/merge code already computes canonical/global/project provenance. [VERIFIED: `packages/config-io/src/load.ts`; `merge.ts`; `web/src/schema/effective.ts`] |
| Safe persistence | Pool-specific filesystem writes or partial JSON replacement | Existing `PUT /api/configs/:id` → `saveWithSnapshot` | Preserves token/origin guards, validation, atomic write, unknown keys, and snapshots. [VERIFIED: `packages/server/src/routes/configs.ts`] |
| Model catalog and runtime-baked classification | Hand-maintained guessed list in each component | Bundled additive metadata sourced from gsd-core’s documented/catalog shape, with explicit runtime/path rules | Avoids duplicated assumptions and makes Phase 6 reconciliation possible. [CITED: https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md; ASSUMED that a bundled catalog is the Phase 4-compatible implementation]
| Secret redaction in errors | Regex replacement over arbitrary serialized config | Keep values out of error/log payload construction from the start | Redaction can miss alternate representations; Phase 1 already uses value-free formatting. [VERIFIED: `packages/config-io/src/validate.ts`]

**Key insight:** The project’s safety boundary is the original project document plus server-side save pipeline. Specialized editors should be views and controlled mutations over that boundary, never owners of persistence or an alternative effective-value model. [VERIFIED: `packages/config-io/src/types.ts`; `packages/server/src/routes/configs.ts`]

## Common Pitfalls

### Pitfall 1: Schema containers do not describe enough entry fields
**What goes wrong:** `ship.pr_body_sections` is currently just an array entry in the bundled schema, and dynamic maps expose a pattern child but not necessarily a complete object-field schema. A renderer can identify a handoff but cannot safely build the required guided controls from that metadata alone. [VERIFIED: `packages/schema-data/bundled-schema.json`]

**Why it happens:** The Phase 1 artifact is a flattened key metadata map designed for completeness and validation, not a complete UI form schema for nested specialized shapes. [VERIFIED: `packages/config-io/src/types.ts`; `.planning/research/FEATURES.md`]

**How to avoid:** Add a versioned, additive specialized metadata contract for the named pool/profile shapes and test its shape/default/enum completeness. Keep base schema open for unknown keys. [ASSUMED]

**Warning signs:** A component branches on `Array.isArray(value)` and renders arbitrary inputs, or hard-codes field rules in JSX without schema metadata/tests. [ASSUMED]

### Pitfall 2: Confusing file provenance with model resolution
**What goes wrong:** The UI shows “Project override” but a higher-priority agent override or runtime-baked install still determines the actual model. [CITED: https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md]

**Why it happens:** The product’s required three layers are canonical/global/project, while gsd-core’s runtime model resolution composes semantic stages above/below those file layers. [VERIFIED: `04-CONTEXT.md`; [CITED: https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md]

**How to avoid:** Show the three-layer summary for every complex value, then show effective resolved tier/model and a “why” chain for profiles/overrides. Use explicit labels such as “file source” versus “runtime resolution.” [ASSUMED]

**Warning signs:** Editing `model_profile` appears to do nothing because `model_overrides[agent]` wins, or the UI says “active” without checking runtime. [CITED: https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md]

### Pitfall 3: Incomplete entries disappear or block unrelated draft work
**What goes wrong:** Add creates an invalid blank entry, but the list hides it, loses its draft on navigation, or only validates the selected entry. [VERIFIED: `04-CONTEXT.md`; `04-UI-SPEC.md`]

**How to avoid:** Preserve the whole draft, show entry-level Invalid badge, validate all entries for save blocking, and keep Back as navigation rather than reset. [VERIFIED: `04-CONTEXT.md`; `04-UI-SPEC.md`]

### Pitfall 4: Reorder changes the wrong object or loses errors
**What goes wrong:** Index keys and closure-captured indexes cause field state/error mismatch after move/remove. [CITED: https://github.com/react-hook-form/documentation/blob/master/src/content/docs/usefieldarray.mdx]

**How to avoid:** Use stable IDs for rendering, derive current index at action time, and test reorder with dirty fields and an invalid non-selected entry. [ASSUMED]

### Pitfall 5: Dynamic-map duplicate/unknown key handling is unsafe
**What goes wrong:** A map editor permits duplicate agents, lets users invent unsupported agents, or silently drops existing unknown keys. [VERIFIED: `04-CONTEXT.md`; `packages/config-io/src/known-keys.ts`; `packages/config-io/src/load.ts`]

**How to avoid:** Picker options are `supportedAgents − presentKeys`; disable Add when exhausted; preserve unsupported/future raw map children read-only and explain why they cannot be edited. [VERIFIED: `04-CONTEXT.md`; ASSUMED for exact read-only presentation]

### Pitfall 6: Secrets leak through normal browser behavior
**What goes wrong:** A masked field still puts the real value in `value`, diagnostics, clipboard handlers, React error output, or test failure snapshots. [VERIFIED: `04-CONTEXT.md`; [CITED: https://docs.stripe.com/keys-best-practices]

**How to avoid:** Use a fixed mask, explicit reveal, blur/timeout re-mask, no copy button, no logging, and tests asserting the secret string is absent from rendered text, captured logs, API errors, and clipboard events. The UI-SPEC explicitly requires no normal copy flow. [VERIFIED: `04-UI-SPEC.md`; ASSUMED for exact implementation test surfaces]

### Pitfall 7: Runtime-baked rules are too broad or too narrow
**What goes wrong:** The app warns for every edit, making the notice meaningless, or fails to warn for a Codex/OpenCode model override that requires reinstall. [CITED: https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md]

**How to avoid:** Make runtime-baked classification explicit metadata with path patterns and runtime predicates; cover `model_overrides`, runtime-aware profile mappings, and other documented install-sensitive paths only after checking the current gsd-core docs/source. Keep the notice post-save and persistent until dismissal/config load. [CITED: https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md; VERIFIED: `04-CONTEXT.md`]

## Code Examples

Verified patterns from official sources:

### Ordered entry list with stable IDs

```tsx
const { fields, append, remove, move } = useFieldArray({
  control,
  name: 'entries',
});

return fields.map((field, index) => (
  <div key={field.id}>
    <input {...register(`entries.${index}.heading` as const)} />
    <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0}>
      Move up
    </button>
    <button type="button" onClick={() => move(index, index + 1)} disabled={index === fields.length - 1}>
      Move down
    </button>
    <button type="button" onClick={() => remove(index)}>Remove entry</button>
  </div>
));
```

This follows the official `useFieldArray` append/remove/stable-ID patterns; `move` is the planned operation for accessible reorder controls. [CITED: https://github.com/react-hook-form/documentation/blob/master/src/content/docs/usefieldarray.mdx]

### Refresh config query after save

```tsx
const queryClient = useQueryClient();
const saveMutation = useMutation({
  mutationFn: () => saveConfig(activeConfigId, candidate),
  onSuccess: async () => {
    const refreshed = await loadConfig(activeConfigId);
    queryClient.setQueryData(['config', activeConfigId], refreshed);
    // Or invalidate and refetch when the response is not sufficient.
  },
});
```

The existing editor already uses this exact refresh shape; TanStack Query documents `setQueryData` and `invalidateQueries` in mutation success callbacks. [VERIFIED: `web/src/components/editor/ConfigEditor.tsx`; [CITED: https://tanstack.com/query/v5/docs/framework/react/guides/updates-from-mutation-responses.md]

### Timer cleanup for re-masking

```tsx
useEffect(() => {
  if (!revealed) return;
  const timeout = window.setTimeout(() => setRevealed(false), REVEAL_TIMEOUT_MS);
  return () => window.clearTimeout(timeout);
}, [revealed, valueVersion]);
```

Use cleanup so navigation, config reload, or a new reveal cannot leave an old timer active. [CITED: https://react.dev/learn/synchronizing-with-effects]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 3 specialized values rendered as handoff placeholders | Focused list/detail editors with schema-guided controls | Phase 4 | Specialized values become editable without raw JSON while retaining the Phase 3 shell. [VERIFIED: `04-CONTEXT.md`; Phase 3 source] |
| Display only scalar provenance badges | Expandable complex-value canonical/global/project summary | Phase 4 | Users can inspect inherited pool/profile values and see effective source before editing. [VERIFIED: `04-CONTEXT.md`; `04-UI-SPEC.md`] |
| Generic model profile string/override fields | Profile cards plus assignment editor and runtime-aware explanation | Current gsd-core docs | Users can see per-agent/per-role assignments and understand install-time activation. [CITED: https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md] |
| Plaintext integration fields | Masked by default, deliberate temporary reveal | Phase 4 security requirement | Reduces casual exposure while preserving deliberate editing. [VERIFIED: `04-CONTEXT.md`; `REQUIREMENTS.md`]

**Deprecated/outdated:**
- Phase 3’s `SpecializedHandoffCard` is a transition seam, not the final editor. Replace its navigation behavior without deleting the generic fallback for truly unknown shapes. [VERIFIED: `web/src/components/fields/SpecializedHandoffCard.tsx`; `04-CONTEXT.md`]
- Raw JSON as the primary pool editor is explicitly out of scope and contradicts POOL-01/02/03. [VERIFIED: `REQUIREMENTS.md`]

## Common GSD Shapes to Plan Against

The current bundled schema and research artifacts identify these representative shapes. Each must be confirmed against the current gsd-core canonical source before locking field metadata; the bundled artifact itself is the project’s current structural source. [VERIFIED: `packages/schema-data/bundled-schema.json`; [CITED: https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md]

| Shape | Editor | Planning notes |
|------|--------|----------------|
| `ship.pr_body_sections` | Ordered structured array | Requires per-field controls for heading/enabled/source/template/fallback; source/template/fallback constraints must be checked against current gsd-core source rather than inferred from prose. [ASSUMED pending source verification] |
| `review.reviewer_instances` | Keyed structured-object map | Needs named-key add/remove and per-entry `cli`, `model`, `agent` controls; preserve unknown entries read-only if not catalogued. [ASSUMED pending source verification] |
| `model_overrides` | Agent-keyed value map | Agent picker plus supported tier/model picker; documented as highest agent-specific override. [CITED: https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md] |
| `effort.agent_overrides` | Agent-keyed restricted value map | Reuse agent picker; values must be supported effort levels from current metadata. [VERIFIED: bundled schema shape; ASSUMED catalog values pending source verification] |
| `fast_mode.agent_overrides` | Agent-keyed boolean map | Reuse agent picker with boolean value control. [VERIFIED: `packages/schema-data/bundled-schema.json`] |
| `model_profile_overrides` | Runtime + tier map | Runtime and tier are constrained key segments; value may be string or object with model/reasoning fields in current gsd-core docs. [CITED: https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md] |
| `agent_skills` | Agent-keyed array/map editor | May require a nested list of skill references; do not treat arbitrary unknown agent keys as editable supported agents. [VERIFIED: bundled schema shape; ASSUMED exact Phase 4 coverage must be decided in plan] |
| `planning.sub_repos` | Ordered scalar array | A straightforward pool candidate, but path-specific validation and unsafe path display need explicit tests. [VERIFIED: `.planning/research/FEATURES.md`; ASSUMED exact current schema constraints] |

## Runtime State Inventory

Not applicable: Phase 4 is a feature implementation phase, not a rename/refactor/migration phase. No runtime-state rename audit was required. [VERIFIED: phase scope]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | TypeScript/Vite/Vitest and existing CLI tests | ✓ | `v22.22.0` | — [VERIFIED: shell probe] |
| npm | Existing package scripts and registry verification | ✓ | `10.9.4` | — [VERIFIED: shell probe] |
| `gsd-tools` | Research cache and package legitimacy seam | ✓ | `/home/fgghk/.npm-global/bin/gsd-tools` | — [VERIFIED: shell probe] |
| Bundled gsd schema | Specialized metadata and validation | ✓ | `packages/schema-data/bundled-schema.json` | Use current bundled artifact; do not add live refresh in Phase 4. [VERIFIED: file read; `ROADMAP.md`] |
| Live gsd-core source/catalog | Confirm exact pool/profile shapes and runtime rules | Not verified in local repo | — | Use official `next` documentation/source during planning; if unavailable, mark exact shape metadata as a human checkpoint rather than inventing fields. [CITED: https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md] |
| Drag-and-drop library | Optional pointer shortcut | Not installed | — | Omit drag-and-drop; required Move up/Move down controls fully satisfy locked accessibility contract. [VERIFIED: `package.json`; `04-CONTEXT.md`] |

**Missing dependencies with no fallback:** none for the recommended implementation.  
**Missing dependencies with fallback:** live gsd-core source can be replaced by a planning-time official-doc/source checkpoint; drag-and-drop can be omitted.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.10` + Testing Library React `16.3.2` + jsdom `29.1.1` |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run test/web --reporter=dot` |
| Full suite command | `npm test` |

These versions/scripts are present in the repository. [VERIFIED: `package.json`; `vitest.config.ts`]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-03 | Secret field masked initially; reveal deliberate; blur and timer re-mask; value absent from logs/copy/errors | component + security unit | `npx vitest run test/web/secret-field.test.tsx test/web/security-redaction.test.ts --reporter=dot` | ❌ Wave 0 |
| EDIT-03 | Complex value shows canonical/global/project layers, effective marker, expansion, inherited edit creates project override | component | `npx vitest run test/web/layer-summary.test.tsx test/web/specialized-draft.test.tsx --reporter=dot` | ❌ Wave 0 |
| POOL-01 | Add defaulted entry, select, reorder by buttons, remove confirmation, save draft | component/integration | `npx vitest run test/web/pool-editor.test.tsx --reporter=dot` | ❌ Wave 0 |
| POOL-02 | Structured entries render field controls, field errors, invalid row badge, save blocked | component | `npx vitest run test/web/structured-pool-editor.test.tsx --reporter=dot` | ❌ Wave 0 |
| POOL-03 | Agent picker excludes existing keys; value picker restricts choices; duplicate blocked | component | `npx vitest run test/web/agent-value-map-editor.test.tsx --reporter=dot` | ❌ Wave 0 |
| PROF-01 | Profiles chapter/cards show names, descriptions, readable assignments | component | `npx vitest run test/web/profile-cards.test.tsx --reporter=dot` | ❌ Wave 0 |
| PROF-02 | Existing profile opens and edits assignments through project draft | component/integration | `npx vitest run test/web/profile-editor.test.tsx --reporter=dot` | ❌ Wave 0 |
| PROF-03 | Create custom profile copies source, requires new name, no empty/clone path | component | `npx vitest run test/web/profile-create.test.tsx --reporter=dot` | ❌ Wave 0 |
| PROF-04 | Successful runtime-sensitive save shows persistent named `gsd install` notice; unrelated save does not | integration | `npx vitest run test/web/runtime-install-notice.test.tsx test/server/api-routes.test.ts --reporter=dot` | ❌ Wave 0 |

Commands and filenames are proposed Wave 0 gaps; existing Phase 3 tests provide the rendering/mutation harness patterns. [VERIFIED: `test/web/*.test.tsx`; `04-UI-SPEC.md`; ASSUMED exact file split]

### Sampling Rate

- **Per task commit:** `npx vitest run <focused test file> --reporter=dot`
- **Per wave merge:** `npx vitest run test/web --reporter=dot`
- **Phase gate:** `npm test` and `npm run typecheck` green before `/gsd-verify-work`; run CLI/server subsets separately if the known concurrent smoke-test timeout recurs. [VERIFIED: Phase 3 summary]

### Wave 0 Gaps

- [ ] Add fixtures for structured pools, dynamic maps, profiles, inherited layers, unsupported/unknown entries, and secret-shaped fields. [ASSUMED]
- [ ] Add specialized metadata fixture and completeness test ensuring all supported editor fields have safe labels/types/defaults. [ASSUMED]
- [ ] Add focused component tests listed in the Phase Requirements → Test Map. [ASSUMED]
- [ ] Add a test helper that asserts rendered output, logs, thrown errors, and clipboard payloads do not contain a sentinel secret. [ASSUMED]
- [ ] Add a responsive/accessibility test for 280px list / flexible detail and single-column collapse below 900px, using the approved UI contract. [VERIFIED: `04-UI-SPEC.md`; test file is a gap]

## Security Domain

Security enforcement is enabled at ASVS level 3 in `.planning/config.json`. [VERIFIED: `.planning/config.json`]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes, inherited API boundary | Preserve Phase 2 token and Origin/Host guards; do not create an unguarded specialized route. [VERIFIED: `packages/server/src/app.ts`; `packages/server/src/routes/configs.ts`] |
| V3 Session Management | yes, limited local session | Keep per-launch token flow; do not persist reveal state or token in new UI state beyond existing bootstrap behavior. [VERIFIED: Phase 2 API contract; `web/src/bootstrap/token.ts`] |
| V4 Access Control | yes | Only opaque config IDs address saves; specialized UI cannot submit raw filesystem paths or bypass registry. [VERIFIED: `packages/server/src/registry.ts`; `packages/server/src/routes/configs.ts`] |
| V5 Input Validation | yes | Use restricted agent/value controls, client feedback, and server Ajv validation; preserve open unknown keys without accepting unsafe pool mutations. [VERIFIED: `packages/config-io/src/validate.ts`; `04-CONTEXT.md`] |
| V6 Cryptography | no new cryptography | Do not invent encryption/masking as storage security; this phase protects casual UI exposure, while on-disk config remains the user’s existing plaintext config. [VERIFIED: `04-CONTEXT.md`; Phase 2 research]

### Known Threat Patterns for React + local Fastify config editor

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-origin browser request to local API | Spoofing/Tampering | Keep all specialized saves on existing tokenized `/api/configs/:id` route and origin/host guards. [VERIFIED: Phase 2 contracts] |
| Secret in logs/errors/diagnostics | Information disclosure | Static/path-only errors; never stringify candidate or secret field; sentinel tests. [VERIFIED: `packages/config-io/src/validate.ts`; `04-CONTEXT.md`] |
| Secret exposed in DOM or clipboard | Information disclosure | Mask by default, no normal copy flow, deliberate reveal, blur and timeout re-mask. [VERIFIED: `04-CONTEXT.md`; `04-UI-SPEC.md`] |
| Prototype-pollution/key injection through dynamic map | Tampering/Elevation | Reuse existing safe path mutation and schema/key classification; reject dangerous path segments and arbitrary agent keys. [VERIFIED: `packages/config-io/src/patch.ts`; `packages/config-io/src/known-keys.ts`] |
| Invalid pool causes blocked/partial save | Tampering/availability | Validate full candidate, badge every invalid entry, block save, and leave disk untouched on failure. [VERIFIED: Phase 1 save pipeline; `04-CONTEXT.md`] |
| False “active” model setting | Information disclosure/integrity | Runtime-aware install notice based on documented conditions; distinguish saved-to-disk from active-at-runtime. [CITED: https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Additive `x-*` specialized metadata is the preferred Phase 4 schema extension shape. | Architecture Pattern 1 | Planner may need a separate metadata artifact or server-provided catalog; implementation shape changes. |
| A2 | Specialized editor values should use ephemeral RHF IDs and never persist synthetic IDs. | Architecture Pattern 2 | Persisting IDs could alter config shape and break gsd-core compatibility. |
| A3 | Exact `ship.pr_body_sections`, `review.reviewer_instances`, and effort/profile field constraints need current canonical-source confirmation. | Common GSD Shapes | Incorrect constraints could block valid existing configs or permit invalid ones. |
| A4 | Unknown supported-looking pool entries should be preserved read-only rather than deleted or free-edited. | Pitfall 5 | A different explicit UX policy may be needed for future keys. |
| A5 | Runtime-baked metadata can be represented as path patterns plus runtime predicates in the bundled artifact. | Pattern 6 / PROF-04 | Incorrect classification can produce misleading notices. |
| A6 | A fixed bundled model/agent catalog is acceptable until Phase 6. | Environment / Standard Stack | Profiles may be incomplete if gsd-core changes before Phase 6. |
| A7 | The exact secret-field test surfaces include DOM, logs, errors, and clipboard handlers. | Validation/Security | Tests may need to adapt to the final component/API boundaries. |
| A8 | `@tanstack/react-query` legitimacy gate’s “too-new” signal should not trigger a dependency change because it is already locked and installed. | Package audit | A new install/upgrade would require human verification. |

## Open Questions

1. **What is the authoritative current model/profile catalog and exact profile file shape?**
   - What we know: gsd-core docs describe `model_profile` tiers and runtime-aware mappings, and the repository’s research identifies a roughly 33-agent catalog. [CITED: https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md; `.planning/research/FEATURES.md`]
   - What’s unclear: exact shipped profile names/descriptions, every agent/role, and whether custom profile persistence is a config key or a runtime catalog concept. [ASSUMED]
   - Recommendation: make the first planning task inspect the current gsd-core source/catalog and add a human checkpoint if it cannot be fetched; do not lock JSX around the research roster.

2. **Which exact fields require `gsd install` for each runtime?**
   - What we know: official docs explicitly state resolved IDs are embedded at install time on Codex and OpenCode-style paths, and other runtimes consume resolution differently. [CITED: https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md]
   - What’s unclear: the complete path/runtime matrix for this current gsd-core version, including profile mappings and model policy fields. [ASSUMED]
   - Recommendation: encode an explicit tested matrix, starting with documented `model_overrides` behavior, and keep unknown runtime cases conservative (notice rather than false claim).

3. **Do all named pool examples exist in the current bundled schema?**
   - What we know: `ship.pr_body_sections`, `model_overrides`, `model_profile_overrides`, and `effort.agent_overrides` are present; `review.reviewer_instances` is referenced by requirements/research but was not found in the initial grep of the current bundled artifact. [VERIFIED: `packages/schema-data/bundled-schema.json`; `.planning/research/FEATURES.md`]
   - What’s unclear: whether the missing shape is a schema build gap, a version-specific key, or an intentionally deferred key. [ASSUMED]
   - Recommendation: resolve before implementation; do not fabricate metadata for an absent canonical key. Preserve it as unknown if encountered.

4. **Should optional drag-and-drop be included?**
   - What we know: buttons are mandatory and no DnD package is installed. [VERIFIED: `04-CONTEXT.md`; `package.json`]
   - What’s unclear: whether pointer DnD materially improves this release enough to justify a new dependency. [ASSUMED]
   - Recommendation: omit it in the first plan unless a native implementation can be tested without compromising keyboard behavior.

## Sources

### Primary (HIGH confidence)
- Existing codebase files: `packages/config-io/src/types.ts`, `load.ts`, `merge.ts`, `patch.ts`, `validate.ts`; `packages/server/src/routes/configs.ts`; `web/src/components/editor/ConfigEditor.tsx`; `web/src/schema/*`; `packages/schema-data/bundled-schema.json` — current contracts and implementation seams. [VERIFIED: codebase grep/read]
- npm registry queries for existing packages — `@hookform/resolvers@5.4.0`, `@tanstack/react-query@5.101.2`, `ajv@8.20.0`, publish metadata and postinstall checks. [VERIFIED: npm registry]
- React Hook Form official documentation — `useFieldArray`, append/remove, stable `field.id` keys. [CITED: https://github.com/react-hook-form/documentation/blob/master/src/content/docs/usefieldarray.mdx]
- Ajv official API documentation — structured validation errors and custom keyword API. [CITED: https://ajv.js.org/api.html]
- TanStack Query v5 official documentation — mutation success cache update/invalidation. [CITED: https://tanstack.com/query/v5/docs/framework/react/guides/invalidations-from-mutations.md]
- React official documentation — effect cleanup for timers/listeners. [CITED: https://react.dev/learn/synchronizing-with-effects]

### Secondary (MEDIUM confidence)
- open-gsd gsd-core configuration documentation, `next` branch — model profiles, precedence, runtime-aware mappings, and install-time baking. [CITED: https://github.com/open-gsd/gsd-core/blob/next/docs/CONFIGURATION.md]
- Phase 1–3 planning research and summaries — domain inventory, known pitfalls, and existing test patterns. [VERIFIED: `.planning/research/*.md`; `.planning/phases/03-generic-schema-driven-ui-shell/03-RESEARCH.md`]

### Tertiary (LOW confidence)
- Exa search results for accessible DnD and secret reveal patterns — used only as advisory context; locked project decisions and official/project contracts take precedence. [ASSUMED/CITED via search results]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages are already installed, registry-checked, and official docs were queried; one existing TanStack Query package received a “too-new” legitimacy signal. [VERIFIED: npm registry; legitimacy gate]
- Architecture: HIGH for reuse of existing project seams; MEDIUM for new specialized metadata/profile catalog shape. [VERIFIED: codebase; ASSUMED for additive metadata]
- GSD-specific model/runtime behavior: MEDIUM — official current docs were found, but the exact source/catalog matrix still needs planning-time confirmation. [CITED: gsd-core docs]
- Secret handling: MEDIUM — locked product contract and existing value-free error behavior are strong; exact browser-memory/DOM implementation remains a design choice. [VERIFIED: project contracts; ASSUMED implementation details]

**Research date:** 2026-07-18  
**Valid until:** 2026-07-25 for gsd-core model/runtime details; 2026-08-17 for stable React/Ajv/RHF patterns.
