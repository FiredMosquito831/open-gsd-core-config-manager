# Phase 3: Generic Schema-Driven UI Shell - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 replaces the placeholder page with a polished React/Vite/TypeScript workspace for discovering, tracking, loading, understanding, searching, editing, validating, and saving GSD config files. The UI is generated from the bundled canonical schema, covers every chapter and known key without per-key forms, documents fields and enum choices for beginners, preserves and visibly surfaces unknown keys, and persists the tracked-file sidebar.

Specialized array/dynamic-map pool editors and model-profile workflows remain Phase 4. Snapshot history remains Phase 5, and live schema reconciliation remains Phase 6.

</domain>

<decisions>
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

### Agent's Discretion
- Exact pane widths, collapse breakpoints, iconography, spacing tokens, theme palette, animation, combobox library, search-ranking weights, and minor copy are open to design/research, provided the locked interaction model above is preserved.
- Exact persistent-registry storage format and additive API route names are open, but the frozen Phase 2 envelopes, security rules, opaque-id boundary, and existing route shapes must not be broken.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` — Phase 3 goal, requirements, five success criteria, and boundaries with Phases 4-6.
- `.planning/REQUIREMENTS.md` — exact wording for SCHEMA-02/03/04/06, DISC-01..05, and EDIT-01/02/04/05/06.
- `.planning/PROJECT.md` — core value, locked React/Vite/TypeScript stack, hybrid schema strategy, and project-wide constraints.

### Frozen upstream decisions and contracts
- `.planning/phases/01-schema-foundation-data-layer-safety/01-CONTEXT.md` — schema-driven renderer contract, unknown-key preservation, and effective-value provenance decisions.
- `.planning/phases/02-local-loopback-server-cli-security-hardening/02-CONTEXT.md` — loopback security, packaging, API, registry, and snapshot integration decisions carried into the UI.
- `.planning/phases/02-local-loopback-server-cli-security-hardening/02-API-CONTRACT.md` — FROZEN REST envelopes, authentication, routes, status codes, and explicit Phase 3 extension points.

### Source-level contracts
- `packages/config-io/src/types.ts` — FROZEN `LoadResult`, `EffectiveNode`, `Provenance`, `UnknownKeyEntry`, and `SchemaEntry` shapes the generic renderer consumes.
- `packages/schema-data/bundled-schema.json` — complete flattened schema descriptors, categories, defaults, current descriptions, enum values, patterns, and Phase 3 `x-options` extension slot.
- `packages/server/src/api-types.ts` — FROZEN `ApiOk`, `ApiErr`, and `TrackedConfig` client types.
- `packages/server/src/routes/configs.ts` — existing secured list/track/load/save behavior that Phase 3 extends without bypassing registry validation.
- `packages/server/src/registry.ts` — opaque-id path boundary and in-memory registry factory designed to accept Phase 3 persistence.
- `packages/server/src/static/serve.ts` — SPA serving and `/api` not-found boundary into which the built client integrates.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/schema-data/bundled-schema.json`: generic renderer input with category, title, type, enum, default, description, dynamic-pattern, and option-description slots.
- `packages/config-io/src/load.ts` and `packages/config-io/src/types.ts`: raw project data, layered effective tree, provenance, and flat unknown-key bucket already exist.
- `packages/server/src/routes/configs.ts`: secured list, track, load, and save routes already return the frozen envelopes the client needs.
- `packages/server/src/registry.ts`: validates filesystem targets, de-duplicates paths, mints opaque ids, and was deliberately structured for persisted seeding.

### Established Patterns
- The server owns filesystem access; the browser uses opaque ids after the single validated tracking boundary.
- Every `/api` request, including reads, carries the per-launch token extracted once from the opened URL. Static SPA assets remain token-free.
- Save submits a full candidate project object through the existing validate -> atomic write -> snapshot wrapper. Unknown keys must originate from and remain in a copy of `raw.project`, never from schema-only form reconstruction.
- No production React client or component system exists yet; Phase 3 establishes the frontend structure and design system while retaining the existing `dist/client` packaging contract.

### Integration Points
- Extend the registry/API additively for persistence, removal/relinking, folder scan, file/folder selection support, and create-from-defaults. All discovered or selected paths still pass through registry validation.
- Replace the placeholder static client with the built Vite SPA under `dist/client` without changing the server's SPA fallback or `/api` JSON boundary.
- Use the same schema semantics client-side for controls and inline validation, while treating server validation as authoritative at save time.

</code_context>

<specifics>
## Specific Ideas

- The product should feel like a polished modern developer settings tool, not a raw schema form or a playful onboarding wizard.
- Search must work equally well for exact keys and beginner concepts, such as finding `workflow.tdd_mode` from prose about testing before implementation.
- Missing tracked files are recoverable workspace items, not stale records to delete silently.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 4 pool editor direction:** arrays open a dedicated editor window with a listbox of entries, add/reorder/remove controls, and a schema-restricted dropdown/combobox for each enum-valued array element. Structured objects receive guided per-field controls rather than raw JSON.
- Full editing for unknown/future keys is not part of Phase 3; they are visible, read-only, and preserved until a safe schema-aware approach is explicitly scoped.

</deferred>

---

*Phase: 3-Generic Schema-Driven UI Shell*
*Context gathered: 2026-07-15*
