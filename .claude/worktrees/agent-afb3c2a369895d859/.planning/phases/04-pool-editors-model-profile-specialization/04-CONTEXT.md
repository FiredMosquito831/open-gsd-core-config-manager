# Phase 4: Pool Editors & Model Profile Specialization - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 replaces Phase 3's specialized-value handoff placeholders with guided, purpose-built editors for GSD array pools, structured-object pools, agent-keyed maps, and model profiles. It makes each complex value's canonical → global → project resolution explicit, prevents unsafe or invalid pool mutations, masks sensitive integration/API-key fields, and tells users when a saved runtime-baked setting requires `gsd install` to take effect.

This phase builds on the schema-driven workspace and safe save pipeline; it does not introduce raw JSON editing, version-history UI (Phase 5), or live schema reconciliation (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Pool workspace and editing model
- **D-01:** Selecting a specialized array, structured object, or dynamic-map field opens a **dedicated focused panel** that replaces the main editor surface and provides a clear Back action to the originating chapter.
- **D-02:** The focused pool workspace uses a **selectable entry list plus detail editor**: the list contains add/reorder/remove actions and entry status; selecting an entry opens its complete guided per-field controls in the detail area.
- **D-03:** Ordered arrays provide both accessible **Move up / Move down** controls and optional drag-and-drop as a pointer shortcut. Dragging must never be the only way to reorder.
- **D-04:** Add creates a guided blank entry, prefilled with schema defaults where available, selects it immediately, and guides completion of required fields. Do not offer templates or cloning.

### Entry integrity and validation
- **D-05:** Agent-keyed maps use a schema-informed agent picker that excludes keys already present. The accompanying value picker must limit choices to supported tiers/models; do not accept arbitrary free-text agent names.
- **D-06:** Removing a pool entry or agent override requires a confirmation that identifies the entry. Reordering takes effect immediately in the unsaved draft.
- **D-07:** Show inline errors on invalid entry fields, visibly badge invalid entries in the entry list, preserve the draft, and block the overall config save until all errors are corrected.
- **D-08:** Do not provide per-entry duplication. New entries always follow the guided schema-default initialization path to avoid accidental copied identities, agent keys, or secrets.

### Model profile experience
- **D-09:** Add a dedicated **Profiles** chapter to the middle navigation rather than burying profiles in generic model settings or a utility menu.
- **D-10:** The Profiles chapter presents profiles as compact cards with name, short description, and a readable per-agent/per-role tier-assignment summary. Opening a card leads to its focused editor.
- **D-11:** Creating a custom profile starts by copying a built-in or existing profile, then giving the copy a new name and editing its assignments. Empty-profile creation is not part of the primary flow.
- **D-12:** When saving a profile or override changes a runtime-baked setting, show a persistent post-save notice naming the changed setting and the required `gsd install` command. Keep it visible until dismissal or loading another config.

### Resolution layers and sensitive values
- **D-13:** Each focused pool/profile editor has an always-visible compact three-layer summary for canonical default → global default → project override. It identifies the effective source and allows each layer's value to be expanded for inspection.
- **D-14:** Editing an inherited complex value creates a project-level copy/override and explains that scope change before opening guided changes; source layers remain inspectable.
- **D-15:** Sensitive integration/API-key fields are masked by default. A deliberate per-field Reveal control exposes a value temporarily; sensitive values must never be included in UI logs, diagnostics, or normal copy flows.
- **D-16:** Revealed sensitive values hide again on field blur and after a short inactivity timeout, requiring a new deliberate Reveal to expose them again.

### Claude's Discretion
- Exact panel/list widths, breakpoint behavior, drag-and-drop library and affordances, confirmation copy, timeout length, profile-card visual treatment, and the exact definition/list of runtime-baked settings are open to research and planning, provided the locked interactions and safety behavior above are preserved.
- Exact schema metadata extensions and additive API/client-state shapes are open, but the frozen Phase 2 HTTP security/envelope contracts and Phase 3 schema-driven/edit-save patterns must remain intact.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope, requirements, and inherited decisions
- `.planning/ROADMAP.md` — Phase 4 goal, requirements, success criteria, examples, and boundaries with Phases 3, 5, and 6.
- `.planning/REQUIREMENTS.md` — exact wording for SEC-03, EDIT-03, POOL-01..03, and PROF-01..04.
- `.planning/PROJECT.md` — core value, local-only constraints, exhaustive schema requirement, and locked stack.
- `.planning/phases/03-generic-schema-driven-ui-shell/03-CONTEXT.md` — documentation-first three-pane workspace, specialized-value handoff contract, provenance/reset behavior, and field-validation decisions being extended here.
- `.planning/phases/02-local-loopback-server-cli-security-hardening/02-CONTEXT.md` — security model, save/snapshot invariants, and constraints on extending the local server.
- `.planning/phases/02-local-loopback-server-cli-security-hardening/02-API-CONTRACT.md` — frozen REST envelopes, token/authentication rules, routes, and explicit extension points.

### Schema and data-layer contracts
- `packages/schema-data/bundled-schema.json` — flattened canonical metadata, dynamic key patterns, categories, enums, descriptions, defaults, and field shapes that determine specialized editors.
- `packages/config-io/src/types.ts` — frozen `LoadResult`, `EffectiveNode`, `Provenance`, `SchemaEntry`, and unknown-key contracts for layer display and schema-driven controls.
- `packages/config-io/src/load.ts` — source of raw project data, merged effective tree, layer provenance, and unknown-key preservation.
- `packages/config-io/src/merge.ts` — resolution semantics for canonical, global, and project layers.
- `packages/config-io/src/patch.ts` — patch-in-place editing behavior that must preserve unknown data and avoid schema-only reconstruction.

### Existing client/server integration surfaces
- `web/src/components/fields/SpecializedHandoffCard.tsx` — Phase 3 placeholder that Phase 4 replaces for array/object/dynamic-map fields.
- `web/src/components/chapters/ChapterView.tsx` — current handoff routing point for specialized fields.
- `web/src/components/fields/FieldCard.tsx` — existing provenance badge and reset-to-project-default interaction to preserve/extend.
- `web/src/schema/effective.ts` — current effective-leaf lookup and provenance labels.
- `web/src/schema/patchProject.ts` — client-side project-object mutation boundary.
- `web/src/schema/validation.ts` — shared client validation behavior that must support specialized-entry feedback.
- `web/src/components/editor/ConfigEditor.tsx` — active editing/save state and integration point for focused editors plus persistent install notices.
- `web/src/state/uiStore.ts` — UI-state integration point for navigation/panel state.
- `packages/server/src/api-types.ts` — frozen response types consumed by the client.
- `packages/server/src/routes/configs.ts` — secured opaque-id config load/save path that Phase 4 must reuse.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/src/components/fields/SpecializedHandoffCard.tsx` and `web/src/components/chapters/ChapterView.tsx`: existing specialized-shape detection and rendering seam, ready to route into the focused pool workspace.
- `web/src/components/fields/FieldCard.tsx` and `web/src/schema/effective.ts`: established provenance labels and reset semantics for showing effective source data.
- `web/src/schema/indexSchema.ts`, `web/src/schema/patchProject.ts`, and `web/src/schema/validation.ts`: schema indexing, project-draft mutation, and live validation foundations for guided entry editors.
- `packages/config-io/src/load.ts`, `packages/config-io/src/merge.ts`, and `packages/config-io/src/types.ts`: existing layered data, effective values, and provenance rather than a new resolution engine.
- `packages/schema-data/bundled-schema.json`: current canonical source for categories, types, enum choices, descriptions, defaults, and dynamic map patterns.

### Established Patterns
- The React UI is a polished, documentation-first three-pane desktop workspace; focused specialized editors must preserve the main editor as the primary surface rather than introduce raw forms.
- All browser filesystem work stays behind the local server's secured opaque-id API. Save must continue submitting a full project candidate through the existing validate → atomic write → snapshot wrapper.
- Phase 3 only shows `Project override`, `Global default`, or `Canonical default` per leaf; Phase 4 extends this to a full inspectable three-layer complex-value summary.
- Unknown/future keys are read-only, visible, and preserved; pool/profile editing must only mutate known guided fields in the project draft.
- Client-side validation supports immediate field feedback while server validation remains authoritative for every save.

### Integration Points
- Replace specialized handoff cards with navigation to a focused pool editor that coordinates draft changes with the current `ConfigEditor` and normal save bar.
- Add a dedicated Profiles navigation chapter without breaking normal schema chapter navigation/search behavior.
- Extend the client schema/indexing metadata only as needed to identify pool entry shapes, agent map key/value restrictions, sensitive fields, profile fields, and runtime-baked settings.
- Reuse the existing config load/save routes and tokenized API client; any route/type changes must be additive and respect the Phase 2 API contract.

</code_context>

<specifics>
## Specific Ideas

- Pool editing should feel like a focused configuration workspace, not an oversized inline form: users select an entry from a list and work through its guided detail fields.
- New entries are deliberately safe and explicit: start from valid schema defaults, never silently clone an existing entry, and confirm destructive removal.
- Profiles should be discoverable as their own workspace chapter and understandable at a glance through compact cards that summarize role assignments.
- Inheritance must be explained, not hidden: complex inherited values become a visible project copy before editing, while all source layers remain available for comparison.
- Casual exposure of secrets is unacceptable: default masking, deliberate temporary reveal, no diagnostic/logging/copy leakage, and automatic re-hiding are required.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-Pool Editors & Model Profile Specialization*
*Context gathered: 2026-07-18*
