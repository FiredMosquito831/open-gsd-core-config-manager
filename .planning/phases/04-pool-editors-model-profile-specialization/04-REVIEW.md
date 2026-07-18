---
phase: 04-pool-editors-model-profile-specialization
reviewed: 2026-07-19T00:00:00Z
depth: deep
files_reviewed: 28
files_reviewed_list:
  - packages/config-io/src/types.ts
  - packages/schema-data/bundled-schema.json
  - packages/schema-data/specialized-catalog.json
  - test/scripts/verify-phase4-source-evidence.mjs
  - test/web/accessible-responsive-specialized.test.tsx
  - test/web/agent-value-map-editor.test.tsx
  - test/web/layer-summary.test.tsx
  - test/web/phase4-catalog-evidence.test.ts
  - test/web/pool-editor.test.tsx
  - test/web/profile-cards.test.tsx
  - test/web/profile-create.test.tsx
  - test/web/profile-editor.test.tsx
  - test/web/runtime-install-notice.test.tsx
  - test/web/secret-field.test.tsx
  - test/web/security-redaction.test.ts
  - test/web/specialized-draft.test.ts
  - test/web/specialized-metadata.test.ts
  - test/web/structured-pool-editor.test.tsx
  - web/src/components/chapters/ChapterNav.tsx
  - web/src/components/chapters/ChapterView.tsx
  - web/src/components/editor/ConfigEditor.tsx
  - web/src/components/specialized/AgentValueMapEditor.tsx
  - web/src/components/specialized/FocusedWorkspace.tsx
  - web/src/components/specialized/LayerSummary.tsx
  - web/src/components/specialized/PoolEntryList.tsx
  - web/src/components/specialized/ProfileCards.tsx
  - web/src/components/specialized/ProfileEditor.tsx
  - web/src/components/specialized/RuntimeInstallNotice.tsx
  - web/src/components/specialized/SecretField.tsx
  - web/src/components/specialized/StructuredPoolEditor.tsx
  - web/src/schema/effective.ts
  - web/src/schema/indexSchema.ts
  - web/src/schema/specializedMetadata.ts
  - web/src/schema/validation.ts
  - web/src/state/uiStore.ts
  - web/src/styles.css
findings:
  critical: 5
  warning: 3
  info: 0
  total: 8
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-07-19
**Depth:** deep
**Files Reviewed:** 28
**Status:** issues_found

## Summary

The specialized editor has several end-to-end correctness failures. In particular, map editors are routed through array-only workspace state, the generated Ajv schema does not validate the nested runtime-tier shape that the editor produces, and edits made in focused editors are not reflected in the form's source of truth. The profile UI also hardcodes a five-agent subset despite the source catalog containing 34 agents, causing incomplete custom configurations.

## Critical Issues

### CR-01: Runtime-tier and agent-map editors cannot display or edit existing map entries

**File:** `web/src/components/specialized/FocusedWorkspace.tsx:18-25,65-83`
**Issue:** `asEntries()` returns an array only for arrays and returns `[]` for the object maps used by `agent-map` and `runtime-tier-map`. Consequently, existing map entries render as an empty pool, `selectedIndex` starts as `null`, and the detail editor is never reachable. `addEntry()` creates an object for non-structured editors, but does not select an entry for them, so even a newly added map entry still leaves the detail pane at “Choose an entry.” The specialized editors advertised for `model_overrides`, `effort.agent_overrides`, `fast_mode.agent_overrides`, `model_profile_overrides`, and `model_policy.runtime_tiers` are therefore nonfunctional.
**Fix:** Use separate state/rendering paths for arrays and keyed maps. For maps, derive a list of keys, select a key (not an array index), render the selected key's value, and update/remove that key while preserving all other keys. Do not pass map containers through `PoolEntryList`'s array-index API.

### CR-02: Specialized edits are discarded from the displayed draft and can be overwritten by later edits

**File:** `web/src/components/editor/ConfigEditor.tsx:75-88,168-193`; `web/src/components/chapters/ChapterView.tsx:35-55`
**Issue:** Focused editors report changes through the `changes` state, but `ChapterView` computes their `value` from `watchedValues[path] ?? effectiveValue`. The RHF form is initialized with `defaultValues` and is never updated when a specialized `onFieldChange` fires. Because `watchedValues[path]` remains the old effective value, a rerender after editing supplies the old value back to `FocusedWorkspace`. For map/structured editors this makes edits appear to revert, and a subsequent edit can be based on stale data and overwrite the previous change. The save candidate happens to use `changes`, but the interactive draft shown to the user is not the candidate being saved.
**Fix:** Make one draft source of truth. Either call `form.setValue(path, value, ...)` for every specialized change and read that value, or derive focused `currentValue` from `changes[path]` before RHF/effective values. Also update/reset focused state when the active config changes or after save.

### CR-03: The generated Ajv schema rejects the nested runtime-tier objects produced by the editor

**File:** `packages/config-io/src/schema-convert.ts:71-76,90-105`; `packages/schema-data/bundled-schema.json:790-806`
**Issue:** The flat schema describes `model_policy.runtime_tiers.<runtime>.<tier>` as a pattern entry whose type is `string`, but the fixture and specialized metadata use the actual nested shape `{ runtime: { tier: { model, reasoning_effort } } }`. `buildAjvSchema()` places the relativized pattern directly on the `runtime_tiers` object, so a key such as `opencode` is validated against a string schema rather than an object containing `sonnet`. The editor's `model_policy.runtime_tiers` fields (`model` and `reasoning_effort`) can therefore never produce a candidate accepted by the client/server validator. The same flat-pattern conversion issue also applies to the runtime-tier map shape used by `model_profile_overrides`.
**Fix:** Define/convert nested dynamic maps at the correct depth: `runtime_tiers` should pattern-match runtime keys to an object schema, whose tier keys pattern-match to the documented tier object schema. Alternatively, represent and patch the canonical flat-key format consistently, but make the schema, fixture, editor, and save candidate agree and add a validation test for a real nested runtime-tier object.

### CR-04: Custom profile creation silently omits most catalogued agents

**File:** `web/src/components/chapters/ChapterView.tsx:17-22,47`; `web/src/components/specialized/ProfileEditor.tsx:4,16-40`
**Issue:** The source evidence gate requires and records 34 agents, but the profile creation flow hardcodes only five (`gsd-planner`, `gsd-executor`, `gsd-verifier`, `gsd-researcher`, and `gsd-code-reviewer`). Clicking “Create custom project configuration” copies only those five assignments, and the editor can add only the same five. A user who customizes a built-in profile therefore saves an incomplete `model_overrides` map, silently losing the catalogued assignments for the other 29 agents and changing their model resolution behavior.
**Fix:** Load the verified agent catalog from the catalog/evidence data (or expose it through the schema metadata) and generate profile assignments/editor options from that catalog. Preserve all catalogued assignments when copying a profile, and explicitly handle agents for which a profile has no assignment rather than silently omitting them.

### CR-05: Runtime-tier map changes are saved with the wrong shape and cannot pass the validation contract

**File:** `web/src/components/specialized/FocusedWorkspace.tsx:31-49,76-83`; `web/src/components/specialized/StructuredPoolEditor.tsx:10-18`
**Issue:** Non-array editors use `addEntry()` to create `{ "entry-N": entry }`, while `moveEntry()` and `removeEntry()` always operate on `entries`, which is `[]` for objects. For `runtime-tier-map`, the detail editor is given the entire map (`value`) rather than a selected runtime/tier entry, and `StructuredPoolEditor` updates a top-level field such as `model` on that entire map. The resulting candidate is neither a valid runtime-tier map nor a faithful update of the selected entry. This is independent of the visibility problem in CR-01 and means a direct invocation or future UI fix still has a corrupt patching path.
**Fix:** Model runtime maps as nested key selections (`runtime`, then `tier`), pass only the selected entry to `StructuredPoolEditor`, and write back with a safe nested map update. Validate the resulting candidate against the same nested schema before exposing it as a saveable draft.

## Warnings

### WR-01: Resetting a nested/dynamic field deletes only a literal dotted property

**File:** `web/src/schema/patchProject.ts:37-52`; `web/src/components/editor/ConfigEditor.tsx:187-191`
**Issue:** `deleteDotPath()` traverses `model_overrides.gsd-executor` as nested properties. If raw config uses the flat dotted-key representation supported by the bundled schema/dynamic patterns, reset does not remove the actual key. Conversely, if a container is nested, the current implementation may leave empty intermediate objects and does not distinguish deleting a whole specialized container from deleting a dynamic member. This makes the UI's reset action unreliable at schema boundaries where this phase specializes editing.
**Fix:** Establish one canonical raw representation and use the same path resolver for read, set, delete, effective lookup, and validation. If both flat and nested forms must be supported, detect and patch the existing representation rather than assuming nested objects.

### WR-02: Sensitive values can be rendered unmasked in the read-only fallback

**File:** `web/src/components/specialized/StructuredPoolEditor.tsx:20-21`
**Issue:** The read-only branch renders `JSON.stringify(value, null, 2)` directly in a `<pre>`. `StructuredPoolEditor` is also used for descriptors that may contain sensitive fields, and unsupported/sensitive values are deliberately included in the raw load result. Although React text rendering prevents HTML execution, this still exposes API keys or other secret-bearing values in the UI, defeating the redaction requirement whenever an unsupported sensitive value reaches this fallback.
**Fix:** Apply path/descriptor-aware redaction before rendering read-only values (for example, replace sensitive strings with a masked marker and recursively redact secret/token/key fields). Keep the raw value available only to the save/patch path, not to a display component.

### WR-03: The evidence verification script writes artifacts non-atomically and accepts arbitrary output paths

**File:** `test/scripts/verify-phase4-source-evidence.mjs:116-123`
**Issue:** `--write-artifact` writes directly with `writeFile`, so an interrupted process can leave a truncated evidence artifact that subsequent verification may reject. More importantly, this script is used as the source-evidence gate and accepts any caller-provided path, including a path outside the repository, without constraining or confirming it. That makes an accidental invocation capable of overwriting an arbitrary user-writable file. This is a test/tooling boundary rather than a web exploit, but it is avoidable data-loss risk in a script that performs writes.
**Fix:** Restrict artifact output to the expected fixture/artifact directory (resolve and verify it is beneath the repository root), refuse existing unrelated files unless explicitly requested, and write via a temporary file followed by an atomic rename.

---

_Reviewed: 2026-07-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
