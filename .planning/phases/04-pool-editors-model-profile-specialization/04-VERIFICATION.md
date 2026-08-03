---
phase: 04-pool-editors-model-profile-specialization
verified: 2026-08-03T00:00:00Z
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
  critical: 0
  warning: 3
  info: 0
  total: 3
status: all_critical_verified_fixed
---

# Phase 04: Verification Report (Re-verification of 04-REVIEW critical fixes)

**Verified:** 2026-08-03
**Depth:** deep
**Files Reviewed:** 28
**Status:** all_critical_verified_fixed

## Summary

Re-verified all 5 critical issues from 04-REVIEW.md (2026-07-19) against CURRENT post-fix code. All 5 critical defects are **genuinely fixed** in the current implementation. The 3 warnings from the original review remain as known minor issues (tracked below).

---

## Critical Issues — All Verified Fixed

### CR-01: Runtime-tier and agent-map editors cannot display or edit existing map entries
**Status: FIXED**

**Evidence in current code (`web/src/components/specialized/FocusedWorkspace.tsx`):**
- Lines 20-26: Separate `asEntries()` (array path) and `asMap()` (map/object path) helpers
- Lines 48-55: `entries`, `map`, `mapKeys`, `isArray` derived correctly from descriptor.editor type
- Lines 54-55: `selectedIndex` for arrays, `selectedKey` for maps — separate state
- Lines 63-76: `addEntry()` handles both array push and map key insertion via `nextMapKey()`
- Lines 78-89: `removeEntry()` handles both array filter and map key deletion
- Lines 99-101: `updateMapValue(selectedKey, next)` updates only the selected map entry
- Lines 102-103: `mapEntries` derived from `mapKeys` with values
- Line 128: Map path renders dedicated `<section>` with listbox of keys

**Verification:** Map editors now have independent render/state paths from arrays; existing entries display and are editable.

---

### CR-02: Specialized edits are discarded from the displayed draft
**Status: FIXED**

**Evidence in current code:**
- `web/src/components/editor/ConfigEditor.tsx`: `useConfigDraft` hook manages `changes` state; `onFieldChange` calls `form.setValue` (RHF controlled)
- `web/src/components/chapters/ChapterView.tsx:45`: `focusedValue = useWatch({ control, ... })` reads the live RHF value
- Line 46: `currentValue = focusedValue ?? getEffectiveLeaf(...)` — prefers the watched RHF value over effective
- `onChange` from focused editors propagates to `useConfigDraft` which updates both `form.setValue` and local `changes` state

**Verification:** Single source of truth (RHF form + `changes` state); focused editors read live value, preventing stale-data overwrite.

---

### CR-03: Generated Ajv schema rejects nested runtime-tier objects
**Status: FIXED**

**Evidence in current code:**
- `packages/schema-data/bundled-schema.json` (rebuilt): `model_policy.runtime_tiers.patternProperties` entry is now `type: "object"` with properties `model` (required string) and `reasoning_effort` (optional string)
- `descriptor` in `web/src/components/specialized/StructuredPoolEditor.tsx` (runtime-tier-map) passes the nested object; `fields` array defines both `model` and `reasoning_effort` as string fields
- Validation test: saving a runtime-tier entry with `{ model: "opus", reasoning_effort: "high" }` passes client + server validation

**Verification:** Schema pattern entry is now nested object, matching descriptor fields and editor output. No more string-vs-object mismatch.

---

### CR-04: Custom profile creation silently omits most catalogued agents
**Status: FIXED**

**Evidence in current code:**
- `web/src/components/specialized/ProfileEditor.tsx:6`: `const AGENTS = getAgentCatalog()` — full 34-agent catalog
- Lines 32-38: Renders ALL agents from `assignments` (Object.entries), not hardcoded subset
- Lines 40-43: `available = AGENTS.filter(agent => !(agent in assignments))` — presents all remaining agents to add
- `web/src/components/specialized/ProfileCards.tsx:12`: `profiles` sourced from `SPECIALIZED_METADATA` via `specializedCatalog.profiles`
- `web/src/schema/specializedMetadata.ts`: `specializedCatalog.agents` is 34 agents (matches evidence catalog)

**Verification:** All 34 agents available in profile editor; create custom profile copies full assignment set.

---

### CR-05: Runtime-tier map changes saved with wrong shape
**Status: FIXED**

**Evidence in current code:**
- `web/src/components/specialized/FocusedWorkspace.tsx`:
  - Line 103: `mapEditor` flag for agent-map | runtime-tier-map
  - Line 135: Map path renders `StructuredPoolEditor` with `selectedValue = selectedMapValue` (single entry)
  - `updateMapValue(next)` (line 99-101) updates only the selected key: `{ ...map, [selectedKey]: next }`
  - `StructuredPoolEditor` scalar-leaf branch (fields.length === 0) renders EnumCombobox for tier dropdowns
  - Nested object fields (model, reasoning_effort) handled by structured branch (fields.length > 0)
- Schema validation passes because schema pattern is now nested object (see CR-03 fix)

**Verification:** Runtime-tier maps are edited as individual nested entries; save candidate shape matches nested schema.

---

## Warnings — Still Present (Known Minor Issues)

### WR-01: Resetting a nested/dynamic field deletes only a literal dotted property
**Status: NOT FIXED — known limitation**

**Current state:** `web/src/schema/patchProject.ts` `deleteDotPath()` traverses nested properties. For flat dotted keys (e.g., `model_overrides.gsd-executor`), reset removes the literal property. For nested container representation, empty intermediate objects may remain. This reflects the dual flat/nested representation ambiguity in the bundled schema.

**Impact:** Low — affects only exact key representation when both forms coexist. Primary editor paths (map editors) work correctly.

---

### WR-02: Sensitive values can be rendered unmasked in the read-only fallback
**Status: PARTIALLY FIXED**

**Current state:** `web/src/components/specialized/StructuredPoolEditor.tsx` read-only branch (lines 49-56) applies `redact()` function that masks keys matching `token|secret|password|api[_-]?key|credential`. However, the redaction is case-sensitive and may miss some field names. Also applies only to this component, not a global sensitive display policy.

**Impact:** Low — read-only fallback only reached for unsupported complex shapes. All sensitive primitives (search API keys) use dedicated `SecretField` component which masks by default.

---

### WR-03: Evidence verification script writes artifacts non-atomically
**Status: NOT FIXED — tooling boundary**

**Current state:** `test/scripts/verify-phase4-source-evidence.mjs` writes directly without atomic temp+rename. Accepts arbitrary output path. This is a test-only script, not production code.

**Impact:** Very low — only affects CI artifact generation. No user data risk.

---

## Test Evidence

| Test Suite | Status |
|------------|--------|
| `test/web/specialized-metadata.test.ts` | 2 blocks pass (descriptor catalogs, allowedValues) |
| `test/web/structured-pool-editor.test.tsx` | 3 new tests pass (scalar-leaf, map entry, boolean round-trip) |
| `test/web/agent-value-map-editor.test.tsx` | Passes (agent picker, value picker, descriptions) |
| `test/web/profile-editor.test.tsx` | Passes (full catalog, create custom) |
| `test/web/phase4-catalog-evidence.test.ts` | Passes (34 agents verified) |
| `npm run typecheck` | PASS |
| `npm run build:schema` | PASS (180 keys, idempotent) |
| `npm run build:client` | PASS |

---

## Conclusion

All 5 critical review defects from 04-REVIEW.md are **genuinely fixed in the current codebase**. The runtime-tier schema mismatch (CR-03) was resolved by correcting the pattern entry in `bundled-schema.json` from flat `string` to nested `object` with `model`/`reasoning_effort` properties. The map-editor visibility/editing (CR-01, CR-05) was resolved by adding separate map state/rendering paths in `FocusedWorkspace`. The draft divergence (CR-02) was resolved by single-source-of-truth RHF `useWatch` + `form.setValue`. The profile agent catalog (CR-04) was resolved by sourcing from the verified 34-agent catalog.

The 3 original warnings remain as known limitations with low/no user impact. They are documented for future consideration but do not block the completeness bar.

**Verdict:** Phase 4 critical defects verified fixed. Ready for archive.