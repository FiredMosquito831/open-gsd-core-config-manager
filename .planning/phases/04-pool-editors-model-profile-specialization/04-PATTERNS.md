# Phase 4: Pool Editors & Model Profile Specialization - Pattern Map

**Mapped:** 2026-07-18  
**Files analyzed:** 27 likely new/modified files (including proposed tests)  
**Analogs found:** 27 / 27 (all have a usable role or integration analog; specialized focused editors are new behavior)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `web/src/components/chapters/ChapterNav.tsx` | component/navigation | request-response/UI state | existing `web/src/components/chapters/ChapterNav.tsx` | exact |
| `web/src/components/chapters/ChapterView.tsx` | component/router | request-response/UI state | existing `web/src/components/chapters/ChapterView.tsx` | exact |
| `web/src/components/editor/ConfigEditor.tsx` | editor/controller | request-response + CRUD draft | existing `web/src/components/editor/ConfigEditor.tsx` | exact |
| `web/src/components/editor/SaveBar.tsx` | component | request-response/save state | existing `web/src/components/editor/SaveBar.tsx` | exact |
| `web/src/state/uiStore.ts` | store | UI state/event-driven | existing `web/src/state/uiStore.ts` | exact |
| `web/src/schema/indexSchema.ts` | schema utility | transform/index | existing `web/src/schema/indexSchema.ts` | exact |
| `web/src/schema/effective.ts` | schema utility | transform/provenance lookup | existing `web/src/schema/effective.ts` | exact |
| `web/src/schema/patchProject.ts` | utility | CRUD/transform | existing `web/src/schema/patchProject.ts` | exact |
| `web/src/schema/validation.ts` | utility | transform/validation | existing `web/src/schema/validation.ts` | exact |
| `web/src/schema/specializedMetadata.ts` | schema utility | transform/catalog lookup | `web/src/schema/indexSchema.ts` | role-match |
| `packages/config-io/src/types.ts` | model/type contract | request-response/transform | existing `packages/config-io/src/types.ts` | exact |
| `packages/schema-data/bundled-schema.json` | config/schema metadata | transform/validation | existing `packages/schema-data/bundled-schema.json` | exact |
| `web/src/components/specialized/FocusedWorkspace.tsx` | component/controller | request-response + draft CRUD | `web/src/components/editor/ConfigEditor.tsx` | role-match |
| `web/src/components/specialized/PoolEntryList.tsx` | component | CRUD/UI state | `web/src/components/sidebar/TrackedConfigSidebar.tsx` | role-match |
| `web/src/components/specialized/LayerSummary.tsx` | component | read/transform | `web/src/components/fields/FieldCard.tsx` | role-match |
| `web/src/components/specialized/StructuredPoolEditor.tsx` | component/editor | CRUD/validation | `web/src/components/fields/FieldCard.tsx` | role-match |
| `web/src/components/specialized/AgentValueMapEditor.tsx` | component/editor | CRUD/validation | `web/src/components/fields/EnumCombobox.tsx` + `FieldCard.tsx` | role-match |
| `web/src/components/specialized/ProfileCards.tsx` | component | read/UI state | `web/src/components/chapters/ChapterNav.tsx` | role-match |
| `web/src/components/specialized/ProfileEditor.tsx` | component/editor | CRUD/validation | `web/src/components/editor/ConfigEditor.tsx` | role-match |
| `web/src/components/specialized/SecretField.tsx` | component | UI state/security | `web/src/components/fields/ScalarFieldControl.tsx` | role-match |
| `web/src/components/specialized/RuntimeInstallNotice.tsx` | component | request-response/UI state | `web/src/components/editor/SaveBar.tsx` | partial |
| `web/src/styles.css` | styling/config | UI state/presentation | existing style sections around lines 192-238, 593-899 | exact |
| `test/web/pool-editor.test.tsx` | component/integration test | CRUD/draft | `test/web/editor-save.test.tsx` | exact harness |
| `test/web/structured-pool-editor.test.tsx` | component test | validation/CRUD | `test/web/field-card.test.tsx` | exact harness |
| `test/web/agent-value-map-editor.test.tsx` | component/security test | validation/CRUD | `test/web/field-card.test.tsx` | exact harness |
| `test/web/profile-cards.test.tsx` | component test | read/UI state | `test/web/field-card.test.tsx` | harness-match |
| `test/web/profile-editor.test.tsx` | component/integration test | CRUD/draft | `test/web/editor-save.test.tsx` | exact harness |
| `test/web/profile-create.test.tsx` | component test | CRUD/validation | `test/web/editor-save.test.tsx` | harness-match |
| `test/web/secret-field.test.tsx` | component/security test | UI state/timer | `test/web/field-card.test.tsx` | harness-match |
| `test/web/layer-summary.test.tsx` | component test | read/transform | `test/web/field-card.test.tsx` | harness-match |
| `test/web/specialized-draft.test.tsx` | utility/integration test | CRUD/transform | `test/web/patch-project.test.ts` | exact |
| `test/web/runtime-install-notice.test.tsx` | integration test | request-response/save result | `test/web/editor-save.test.tsx` | exact harness |
| `test/web/security-redaction.test.ts` | security unit test | transform/error handling | `test/web/client-validation.test.ts` and server validation tests | role-match |
| `test/web/specialized-metadata.test.ts` | schema utility test | transform/index | `test/web/schema-index.test.ts` | exact harness |
| `test/web/accessible-responsive-specialized.test.tsx` | component/accessibility test | UI state/presentation | `test/web/app-shell-responsive.test.tsx` | role-match |

The research lists these as a recommended decomposition, not a frozen file list. Keep the responsibilities and analog patterns even if the planner consolidates files.

## Pattern Assignments

### `web/src/components/chapters/ChapterView.tsx` (component/router, request-response/UI state)

**Analog:** existing `web/src/components/chapters/ChapterView.tsx`, lines 18-49.

Preserve the current category lookup and effective-leaf lookup. The existing specialized seam is deliberately small:

```tsx
const { activeChapter } = useUiStore();
const index = indexSchema(schema);
const fields = activeChapter ? index.fieldsByCategory.get(activeChapter) ?? [] : [];

{fields.map((field) => {
  const leaf = getEffectiveLeaf(loadResult.effective, field.path);
  if (field.isHandoff) {
    return <SpecializedHandoffCard key={field.path} field={field} />;
  }
  return <FieldCard key={field.path} field={field} leaf={leaf} ... />;
})}
```

Replace the handoff branch with focused-workspace navigation/rendering, while retaining a generic fallback for shapes with no specialized metadata. Pass the existing `loadResult`, schema, form/control, and draft mutation callbacks rather than making a second persistence path.

### `web/src/components/editor/ConfigEditor.tsx` (editor/controller, request-response + CRUD draft)

**Analog:** `web/src/components/editor/ConfigEditor.tsx`, lines 49-121 and 136-197.

This is the controlling pattern for all specialized edits:

```tsx
const [changes, setChanges] = useState<Record<string, unknown>>({});
const [resets, setResets] = useState<Set<string>>(() => new Set());
const changeList: ProjectChange[] = Object.entries(changes)
  .map(([path, value]) => ({ path, value }));
const candidate = buildProjectSaveCandidate(loadResult, changeList, Array.from(resets));
const clientResult = validator(candidate);
return saveConfig(activeConfigId, candidate);
```

Use `loadResult.raw.project` as the mutation base and submit the full candidate to the existing `saveConfig` API. Focused components should report path/value changes or use a shared specialized draft callback; they must not serialize `loadResult.effective`, write files, or add pool-specific routes. On success, clear draft state, preserve the snapshot result, reload the config, and update `['config', activeConfigId]` with `queryClient.setQueryData` (lines 106-115). Add runtime-notice derivation only from changed paths and bundled metadata; never include changed values.

The existing save gate also establishes the required behavior: client validation before mutation (lines 94-104), server `ApiError` normalization (lines 37-47, 116-120), and SaveBar disabled when `form.formState.errors` is nonempty (lines 136-137, 188-194).

### `web/src/components/specialized/FocusedWorkspace.tsx` (component/controller, request-response + draft CRUD)

**Analog:** `ConfigEditor.tsx` lines 139-197 for the shell/save integration, and `ChapterView.tsx` lines 23-49 for routing.

Build a focused surface, not a modal or separate app. It should receive the selected schema field/path, effective complex value, raw layer values, draft callbacks, and a Back callback. Keep Back as navigation only so the draft is not discarded. Compose `LayerSummary`, `PoolEntryList`, and one detail editor. Loading/error states should retain a labeled Back action and use the UI-spec copy; no partial controls should render before metadata/value are ready.

### `web/src/components/specialized/PoolEntryList.tsx` (component, CRUD/UI state)

**Analog:** the list/button structure in `web/src/components/chapters/ChapterNav.tsx`, lines 36-58, plus existing `Button` conventions in `web/src/components/common/Button.tsx`, lines 8-28.

Use semantic list markup, buttons with accessible names, selected state, and stable entry identity. Add `Add entry`; for ordered arrays expose `Move up` and `Move down` buttons regardless of whether optional pointer drag is added. Disable irrelevant direction at boundaries. Remove must invoke a confirmation identifying the entry and use specific actions (`Keep entry` / `Remove entry`). Never implement reorder using array index as the React key; use RHF `field.id` or an equivalent ephemeral stable ID.

### `web/src/components/specialized/StructuredPoolEditor.tsx` (component/editor, CRUD/validation)

**Analog:** `web/src/components/fields/FieldCard.tsx`, lines 17-45 and 78-111.

Reuse the field-control/provenance/error conventions: `useController`, a schema-derived label/id, `controllerField.onChange`, parent `onFieldChange`, and inline `role="alert"` errors only after interaction. Render schema metadata descriptors, not arbitrary JSON or hard-coded free-form field text. For ordered arrays, use RHF `useFieldArray` semantics (`append`, `remove`, `move`) and render rows with `field.id` rather than the index. Synthetic IDs must never enter the saved object.

```tsx
const { field: controllerField, fieldState } = useController({ name, control });
const displayValue = controllerField.value !== undefined ? controllerField.value : effectiveValue;
{fieldState.error && fieldState.isTouched && (
  <div className="gsd-field-card__error" role="alert">{fieldState.error.message}</div>
)}
```

Add should construct a schema-defaulted blank entry, select it immediately, and preserve an invalid incomplete draft. Validate all entries against the full candidate so non-selected invalid rows receive an `Invalid` badge and save remains blocked.

### `web/src/components/specialized/AgentValueMapEditor.tsx` (component/editor, CRUD/validation)

**Analog:** `web/src/components/fields/EnumCombobox.tsx` and `FieldCard.tsx`, lines 78-103.

Use native/select-like schema-restricted controls already established for enums; do not accept arbitrary agent or tier/model strings. Compute agent choices as supported agents minus present keys, disable add when exhausted, and show the exact duplicate-key error from the UI contract. Preserve unsupported/future map children read-only rather than deleting them. Reuse the same primitive for `model_overrides`, `effort.agent_overrides`, `fast_mode.agent_overrides`, and profile assignment maps, with metadata determining scalar/boolean/tier/object value control.

### `web/src/components/specialized/ProfileCards.tsx` (component, read/UI state)

**Analog:** `web/src/components/chapters/ChapterNav.tsx`, lines 18-30 and 36-58.

Derive cards from bundled/additive profile metadata and the current effective/project values. Use semantic buttons/cards with selected state, name, description, and readable per-agent/per-role assignments. The Profiles chapter must be a first-class navigation category, not a utility menu. Empty state must guide copy-from-built-in/existing rather than offer an empty profile.

### `web/src/components/specialized/ProfileEditor.tsx` (component/editor, CRUD/validation)

**Analog:** `ConfigEditor.tsx`, lines 73-115, and `FieldCard.tsx`, lines 27-45.

Open the current project model configuration in the same focused-workspace shell. Per D-11 and the approved UI-SPEC amendment, `Create custom project configuration` copies a selected built-in assignment set into ordinary supported project fields and then permits constrained assignment edits. An optional session label is local UI state only: it is not serialized, reloaded, or uniquely validated as profile identity, and it cannot affect `model_profile`. Use the shared agent/value map primitive, preserve the documented runtime-resolution precedence separately from file-layer provenance, and save through the normal full-candidate mutation. Do not make a second profile API, serialize named-profile metadata, create durable profile naming, or write an empty arbitrary object.

### `web/src/components/specialized/LayerSummary.tsx` (component, read/transform)

**Analog:** `web/src/components/fields/FieldCard.tsx`, lines 60-76, 113-163, and `web/src/schema/effective.ts`, lines 2-37.

Extend the existing provenance vocabulary rather than replacing it. The compact always-visible summary must show canonical, global, and project values, mark the effective source, and allow each value to expand for inspection. `provenanceLabel` currently maps exactly as follows:

```ts
canonical: 'Canonical default',
global: 'Global default',
project: 'Project override',
```

For an inherited complex value, the first edit must materialize a project copy from the effective value and retain read-only inspection of source layers. Do not imply expansion mutates a layer. For profiles, render a separate runtime-resolution explanation; file provenance and gsd-core semantic resolution are different chains.

### `web/src/components/specialized/SecretField.tsx` (component, UI state/security)

**Analog:** `web/src/components/fields/ScalarFieldControl.tsx` for input wiring and `FieldCard.tsx`, lines 107-111, for safe inline error presentation.

Implement explicit masked/revealed state with a deliberate `Reveal value` button. Mask by default; re-mask on blur and after a short inactivity timeout, clear timers/effects on unmount/config change, and do not provide normal copy behavior. Never log or stringify the secret. Errors must contain only static/path-oriented text and must not echo values.

Timer cleanup should follow the research pattern:

```tsx
useEffect(() => {
  if (!revealed) return;
  const timeout = window.setTimeout(() => setRevealed(false), REVEAL_TIMEOUT_MS);
  return () => window.clearTimeout(timeout);
}, [revealed, valueVersion]);
```

### `web/src/components/specialized/RuntimeInstallNotice.tsx` (component, request-response/UI state)

**Analog:** `web/src/components/editor/SaveBar.tsx`, lines 10-33, for compact save-status presentation.

Render only after a successful save when explicit runtime-baked metadata and changed paths match. For Codex render the setting name plus exact `gsd install codex`; for OpenCode render the setting name plus exact `gsd install opencode`; never include values. Claude Code, other/unset/unknown runtimes, unrelated paths, and near misses must render no notice. Keep a positive notice persistent until dismissal or loading another config. Use warning tokens and wrapping copy from `04-UI-SPEC.md`.

### `web/src/schema/specializedMetadata.ts` (schema utility, transform/catalog lookup)

**Analog:** `web/src/schema/indexSchema.ts`, lines 2-12 and 29-62.

Define a discriminated, additive metadata contract (`structured-array`, `keyed-object`, `agent-map`, `profile`, secret/runtime flags, field descriptors, allowed catalogs). Keep base `SchemaEntry` type/default/enum validation authoritative and use metadata only to describe safe UI behavior. Centralize classification so JSX does not infer behavior from `Array.isArray` or display labels. Unknown/future keys remain visible/read-only and are never silently reconstructed.

### `web/src/schema/indexSchema.ts` (schema utility, transform/index)

**Analog:** current `indexSchema.ts`, lines 64-115.

Extend the index result additively with specialized metadata lookup while preserving category/search ordering, `fieldsByPath`, `isHandoff`, and `handoffReason`. Existing tests rely on stable sorted categories/fields and searchable text. A specialized field with no metadata must continue to receive the generic handoff/fallback behavior.

### `web/src/schema/effective.ts` (schema utility, transform/provenance lookup)

**Analog:** current `effective.ts`, lines 2-29.

Reuse the defensive dot-path traversal and null behavior for complex lookup helpers. Do not create a second merge engine. Server `LoadResult.effective` and provenance remain authoritative; client helpers should only locate/format values and layer summaries.

### `web/src/schema/patchProject.ts` (utility, CRUD/transform)

**Analog:** current `patchProject.ts`, lines 2-14 and 54-75.

All specialized mutations must pass through this boundary or a helper with identical safety guarantees:

```ts
const candidate = structuredClone(loadResult.raw.project) as Record<string, unknown>;
for (const change of changes) setDotPath(candidate, change.path, change.value);
for (const reset of resets) deleteDotPath(candidate, reset);
return candidate;
```

Retain forbidden-segment checks for `__proto__`, `constructor`, and `prototype`. Pool array/map changes should be represented as project-path changes, and inherited edits should write a project-level copy only.

### `web/src/schema/validation.ts` (utility, transform/validation)

**Analog:** current `validation.ts`, lines 16-49.

Keep one Ajv client validator built from `buildAjvSchema`; extend vendor keywords only for additive metadata. Validate the full candidate with `allErrors: true` and map `instancePath` to selected field/entry errors. Do not create per-component validators that diverge from server Ajv. Existing server 422 errors remain authoritative and should be normalized without candidate values.

### `web/src/components/editor/SaveBar.tsx` (component, request-response/save state)

**Analog:** current `SaveBar.tsx`, lines 10-33.

Keep the `Save changes` CTA and existing dirty/saving/snapshot status. Specialized invalid-entry state must contribute to the same disabled condition used by ConfigEditor; do not create a pool-specific save button or bypass the normal bar.

### `web/src/components/chapters/ChapterNav.tsx` (component/navigation, request-response/UI state)

**Analog:** current `ChapterNav.tsx`, lines 7-30 and 36-58.

Add `Profiles` through the same `categories`/tablist pattern, preserving active-chapter fallback and unknown `Unrecognized` handling. Do not break schema category sorting or search behavior. If Profiles is metadata-backed rather than a schema key, append it deliberately and test active-chapter restoration.

### `web/src/state/uiStore.ts` (store, UI state/event-driven)

**Analog:** current `uiStore.ts`, lines 2-35.

Add focused workspace/profile selection and originating chapter state as explicit Zustand fields/actions. Keep config identity, navigation, search, and highlight state in this store; keep server data in TanStack Query and draft/config values in ConfigEditor/form state. Back should restore the originating chapter without clearing unsaved changes; loading another config clears focused/notice state.

### `packages/config-io/src/types.ts` (model/type contract, request-response/transform)

**Analog:** current frozen contracts, lines 17-24, 31-37, 59-80, and 96-124.

Extend types additively. Preserve `LoadResult.raw.project`, `raw.global`, `effective`, `unknown`, and `SchemaEntry` compatibility. Specialized metadata may be represented with optional `x-*` fields or a separate typed catalog; do not alter provenance semantics or unknown-key representation without treating it as an architectural change.

### `packages/schema-data/bundled-schema.json` (config/schema metadata, transform/validation)

**Analog:** existing flattened schema artifact and `SchemaEntry` contract.

Add only additive, versioned specialized metadata for canonical shapes and profile/runtime catalog information confirmed by the immutable `next` SHA `36a311c5bb5fa1a475cfbb685a845cd2d5bf88fe` evidence gate. Keep defaults/enums/descriptions in the canonical artifact and test metadata completeness. For `review.reviewer_instances`, require both source-confirmed entry constraints and a matching bundled validation shape before enabling an editable descriptor; otherwise preserve it as visible/read-only. No live reconciliation belongs in Phase 4.

### `web/src/styles.css` (styling/config, UI presentation)

**Analog:** existing manual CSS, especially `web/src/styles.css` lines 192-238 (buttons), 593-654 (navigation), 654-818 (field cards/provenance/errors), and 843-899 (handoff cards).

Use existing `--gsd-*` tokens, semantic class naming, native controls, and the existing responsive system. The focused workspace should be a deliberate shell extension: 280px entry list, flexible detail, 32px gap, collapse below 900px, list first/detail second. Use 4px spacing multiples, minimum 44px control hit targets, wrap long paths/names, and do not initialize shadcn or an icon registry. Replace/retire handoff visual copy while retaining an unknown-shape fallback.

## Shared Patterns

### Draft mutation and save boundary
**Sources:** `web/src/components/editor/ConfigEditor.tsx` lines 52-115; `web/src/schema/patchProject.ts` lines 54-75; `packages/server/src/routes/configs.ts` lines 95-123.  
**Apply to:** all pool/profile editors, metadata-driven mutations, runtime notices.

1. Keep changes in the browser draft.
2. Clone `loadResult.raw.project`.
3. Apply safe project-path changes/resets.
4. Validate the full candidate with client Ajv.
5. Submit only through `saveConfig(activeConfigId, candidate)`.
6. Let the existing secured `PUT /configs/:id` route call `saveWithSnapshot`; no specialized filesystem/API route.
7. Refresh the config query after success.

The route itself resolves only an opaque id and reads only `req.body.config` (lines 99-114), so Phase 4 must not introduce raw filesystem paths or alternate writes.

### Validation and error formatting
**Sources:** `web/src/schema/validation.ts` lines 24-49; `ConfigEditor.tsx` lines 29-47, 94-104, 116-120; `FieldCard.tsx` lines 107-111.  
**Apply to:** every guided field and pool entry.

Use Ajv `instancePath`/keyword errors, show inline errors after interaction, maintain an invalid-row projection for non-selected entries, and block the shared SaveBar while any error remains. Server 422 errors go to the existing validation summary. Never serialize the full candidate in diagnostics or error text.

### Layer/provenance behavior
**Sources:** `packages/config-io/src/types.ts` lines 17-37, 59-80; `web/src/schema/effective.ts` lines 2-37; `FieldCard.tsx` lines 23-45.  
**Apply to:** focused pools and profiles.

Canonical/global/project is file provenance. Mark the effective source, allow inspection, and materialize inherited edits into project scope. For profiles, explain runtime resolution separately; do not label a file-layer source as proof that an installed runtime is active.

### Accessible controls and styles
**Sources:** `web/src/components/common/Button.tsx` lines 8-28; `ChapterNav.tsx` lines 39-55; `styles.css` lines 192-238.  
**Apply to:** list actions, profile cards, Back, confirmations, reveal controls.

Use real buttons, explicit labels, `aria-selected`/`aria-expanded` where applicable, and the existing `gsd-button` variants. Move buttons are mandatory even if drag-and-drop is added. Do not use icon-only controls or generic destructive labels.

### React Query and test harness
**Sources:** `ConfigEditor.tsx` lines 57-65 and 106-115; `test/web/render-helpers.tsx` lines 4-19.  
**Apply to:** integration tests and post-save notice behavior.

Use query keys `['schema']` and `['config', activeConfigId]`; mock API modules with `vi.mock`, render through `renderWeb`, disable retries, and await query-driven UI with `waitFor`. Reset `useUiStore` and call `cleanup()` after every test.

### Secret non-disclosure
**Sources:** Phase 4 UI contract; `web/src/schema/validation.ts` lines 39-49; `test/web/editor-save.test.tsx` lines 163-187 for value-free server error assertions.  
**Apply to:** `SecretField`, profile/integration editors, validation/security tests.

Mask the DOM value by default, omit clipboard/copy flows, do not log candidate/value objects, and ensure errors/logs/diagnostics contain paths and static messages only. Add sentinel-secret assertions across rendered text, logs, thrown errors, and clipboard payloads.

## Test Pattern Assignments

### Existing test structure to copy

`test/web/editor-save.test.tsx` lines 1-47 establishes the standard jsdom imports, `renderWeb`, API module mocks, and Zustand reset. Its helper at lines 91-106 configures mocked workspace/schema/config APIs and selects a tracked config through the real `App`. New editor integration tests should use this rather than shallow-rendering a component that bypasses the shell.

`test/web/field-card.test.tsx` lines 141-229 demonstrates semantic assertions against titles/descriptions, provenance, reset behavior, validation controls, and the requirement that handoff fields do not render raw JSON textareas.

`test/web/schema-index.test.ts` lines 62-137 tests stable indexing/classification, and lines 140-179 tests effective lookup/provenance/store behavior. Specialized metadata tests should extend this style with minimal fixtures plus the real bundled schema.

### Required test coverage by planned file

- **`test/web/pool-editor.test.tsx`:** focused navigation/Back; add schema-defaulted entry and immediate selection; move up/down; named remove confirmation; draft survives Back; shared SaveBar receives the candidate.
- **`test/web/structured-pool-editor.test.tsx`:** per-field controls; required-field inline error; invalid non-selected row badge; all-entry validation blocks Save; no synthetic RHF id persisted.
- **`test/web/agent-value-map-editor.test.tsx`:** existing agent keys excluded; supported value choices only; duplicate prevented with `That agent already has an override. Choose another agent.`; unknown entries preserved/read-only.
- **`test/web/profile-cards.test.tsx`:** Profiles chapter, card name/description/assignment summary, selected/open behavior, and documented empty state.
- **`test/web/profile-editor.test.tsx`:** project model configuration edit uses only supported fields and normal save; file provenance and documented runtime precedence remain distinct.
- **`test/web/profile-create.test.tsx`:** copy a built-in assignment set, show the approved UI-SPEC project-configuration clarification, optionally session-label the local editing session without serializing, reloading, or uniquely validating it as profile identity, prove it cannot affect `model_profile` and no named-profile metadata serializes, reject empty arbitrary creation, then edit assignments and verify copied assignments survive reload.
- **`test/web/secret-field.test.tsx`:** masked initial DOM; deliberate reveal/hide; blur re-mask; fake-timer inactivity re-mask; focus returning does not expose without a new reveal.
- **`test/web/layer-summary.test.tsx` and `specialized-draft.test.tsx`:** three expandable layers/effective marker and inherited edit materializing only a project override while retaining source values.
- **`test/web/runtime-install-notice.test.tsx`:** a confirmed Codex path renders exact `gsd install codex`; an equivalent OpenCode path renders exact `gsd install opencode`; Claude Code, other/unset/unknown runtimes, unrelated paths, and near misses render no notice; dismissal and loading another config clear a positive notice; notices never disclose model or secret values.
- **`test/web/security-redaction.test.ts`:** sentinel secret absent from rendered output, logs, errors, diagnostics, and clipboard payloads. Assert path-only error formatting.
- **`test/web/specialized-metadata.test.ts`:** supported descriptors have safe labels/types/defaults; agent/value catalogs are constrained; unknown or unconfirmed shapes do not gain editable fabricated metadata.
- **`test/web/accessible-responsive-specialized.test.tsx`:** labeled list/detail regions, keyboard Move controls, 44px action targets where applicable, 280px list/flexible detail layout, and single-column behavior below 900px.

Run focused tests per task (`npx vitest run <file> --reporter=dot`), then `npx vitest run test/web --reporter=dot`, followed by `npm test` and `npm run typecheck` at the phase gate.

## No Analog Found

No exact analog exists for the new focused list/detail pool workspace, profile catalog/editor, layer summary, secret reveal state machine, or runtime-baked install notice. They should copy the integration, mutation, validation, accessibility, and styling seams above rather than invent persistence or server behavior.

The following domain decisions remain planning-time checkpoints rather than assumptions to encode in JSX:

| Area | Reason |
|---|---|
| Exact gsd-core profile names/assignments/catalog | Current local repository does not verify the authoritative roster or custom profile shape. |
| Exact runtime/path matrix requiring `gsd install` | Must be confirmed against current gsd-core source/docs; use explicit metadata and conservative behavior. |
| `review.reviewer_instances` metadata | Research notes it may be absent from the current bundled schema; do not fabricate it. |
| Optional drag-and-drop | No dependency is installed; accessible Move up/Move down controls are sufficient and should be the default plan. |

## Metadata

**Analog search scope:** `web/src/components`, `web/src/schema`, `web/src/state`, `packages/config-io/src`, `packages/schema-data`, `packages/server/src`, `test/web`, `test/server`, and `web/src/styles.css`.  
**Files scanned:** 20 source/UI/config files and 4 representative test/style surfaces in detail, plus repository file inventory.  
**Pattern extraction date:** 2026-07-18
