---
phase: 4
slug: pool-editors-model-profile-specialization
status: draft
shadcn_initialized: false
preset: none
created: 2026-07-18
---

# Phase 4 — UI Design Contract

> Visual and interaction contract for Pool Editors & Model Profile Specialization. Extends the Phase 3 documentation-first three-pane workspace with focused, schema-guided pool/profile workspaces.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — existing manual CSS design system |
| Preset | not applicable |
| Component library | none; preserve existing semantic React components and native accessible controls |
| Icon library | none currently installed; use existing text/character affordances or accessible inline SVG only when needed, never icon-only without an accessible label |
| Font | Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif (existing `web/src/styles.css`) |

Existing tokens and patterns are authoritative: `--gsd-bg`, `--gsd-surface`, `--gsd-surface-elevated`, `--gsd-surface-hover`, `--gsd-border`, `--gsd-text`, `--gsd-text-muted`, `--gsd-accent`, `--gsd-danger`, `--gsd-warning`, `--gsd-success`, `--gsd-radius`, and `--gsd-shadow`. The focused workspace must look like a deliberate extension of the Phase 3 shell, not a modal or separate application.

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-label gaps, status-dot gaps, compact inline padding |
| sm | 8px | Entry-row internal gaps, compact control spacing, badge padding |
| md | 16px | Field-card padding, default control gaps, list-row padding |
| lg | 24px | Focused-panel section padding, card groups, layer summary padding |
| xl | 32px | Detail/list column gap, panel header-to-content separation |
| 2xl | 48px | Major workspace section breaks and empty-state breathing room |
| 3xl | 64px | Page-level empty-state vertical spacing only |

Exceptions: icon-only controls and drag handles must have a minimum 44px by 44px hit target even when their visual glyph is smaller; use 4px multiples for surrounding padding. Do not use arbitrary 5px, 10px, 12px, 20px, or 40px layout values.

Focused pool workspace layout: retain the global shell rails, then use a two-column content surface with a 280px entry list and a flexible detail editor separated by 32px. Collapse to one column below 900px: entry list first, detail editor second; preserve Back and save actions at all widths.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 16px | 400 regular | 1.5 |
| Label / metadata | 14px | 400 regular | 1.5 |
| Heading | 20px | 600 semibold | 1.2 |
| Display / workspace title | 28px | 600 semibold | 1.2 |

Use only weights 400 and 600 in this phase. Entry names and profile names use 16px/600; paths, layer labels, helper text, and timestamps use 14px/400. Validation and safety copy must not be reduced below 14px. Long key paths wrap rather than truncate without a tooltip or accessible full text.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#ffffff` light / `#0f172a` dark (`--gsd-bg`) | Main focused-editor canvas and page background |
| Secondary (30%) | `#f8fafc` light / `#1e293b` dark (`--gsd-surface`) | Entry list, navigation surfaces, cards, layer-summary container, profile cards |
| Accent (10%) | `#2563eb` light / `#60a5fa` dark (`--gsd-accent`) | Active entry/profile selection, Back navigation emphasis, primary Add/Create/Save actions, focused form controls, effective-source marker, and install-notice link/action |
| Destructive | `#dc2626` light / `#f87171` dark (`--gsd-danger`) | Remove entry, discard/cancel destructive confirmation, invalid-entry badges, and unrecoverable save error only |

Accent reserved for: the selected entry row, selected profile card, primary `Add entry` and `Create custom profile` actions, `Save changes`, focused controls, the effective provenance source indicator, and the actionable `gsd install` remediation link/button. Do not use accent for every link, helper label, border, or decorative element.

Use existing semantic warning colors (`--gsd-warning` / `--gsd-warning-bg`) for runtime-baked notices and inherited-value scope-change explanations; use success colors only for saved/install-state confirmation. Preserve the existing light/dark theme mapping and maintain readable contrast for text, borders, focus rings, and status badges.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | `Save changes` |
| Pool add CTA | `Add entry` |
| Profile creation CTA | `Create custom profile` |
| Empty state heading | `No entries yet` |
| Empty state body | `Add an entry to configure this pool. New entries start with schema defaults and can be completed in the detail editor.` |
| Profiles empty state heading | `No custom profiles yet` |
| Profiles empty state body | `Choose a built-in or existing profile to copy, then give the copy a new name and adjust its assignments.` |
| Error state | `Some entries need attention. Fix the highlighted fields before saving.` |
| Load/error recovery | `This specialized editor could not load its current value. Go back and try again; your existing draft has not been discarded.` |
| Required-field error | `Enter a value for this required field.` |
| Agent-map duplicate error | `That agent already has an override. Choose another agent.` |
| Destructive confirmation | `Remove “{entry name}”? This removes the entry from the unsaved project draft. Keep entry / Remove entry` |
| Inherited-value scope notice | `This value comes from {source layer}. Editing it will create a project override; the inherited source remains unchanged.` |
| Runtime-baked notice | `Saved “{setting}”. This setting is baked into the installed GSD runtime; run `gsd install` for the change to take effect.` |
| Secret reveal control | `Reveal value` / `Hide value`; helper text: `Re-hides when this field loses focus or after a short period of inactivity.` |

Use specific nouns in all destructive confirmations: identify the entry key/name, agent, or profile name. Never use generic labels such as `Cancel`, `Confirm`, `Delete`, or `Continue` as an action; the non-destructive action is `Keep entry` (or an equally specific equivalent). The persistent runtime notice remains until dismissal or loading another config, per D-12.

---

## UI Considerations

The UI-consideration probe classifications were confirmed with the user: focused pool workspace = form, list collection, and interactive controls; Profiles = form and list collection; provenance summary = static content and interactive controls; secret field = form and interactive controls; runtime-baked notice = static content.

Applicable state considerations resolved: 21 covered, 1 backstop, 2 dismissed, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Focused pool workspace | ✅ covered | Render `No entries yet` with its documented guidance and a prominent `Add entry` action; never show a blank panel or raw-JSON fallback. |
| loading | Focused pool workspace | ✅ covered | Keep `Back to {chapter}` visible and show labeled loading regions for both the entry list and detail editor; do not expose partially initialized controls. |
| error | Focused pool workspace | ✅ covered | Show the documented recovery error, preserve the shared draft, and provide `Back` rather than silently resetting the value. |
| populated | Focused pool workspace | ✅ covered | Show a selectable row per entry with name/key, compact value summary, validity state, and contextual reorder/remove actions beside the validated detail editor. |
| partial | Focused pool workspace | ⊘ dismissed | Incomplete entries are an editable, invalid draft state with inline field errors and an `Invalid` row badge; no separate partial-data fallback is rendered. |
| overflow | Focused pool workspace | ✅ covered | Keep large entry lists independently scrollable, preserve selection and scroll position, wrap long names/paths, reserve action space, and never clip controls. |
| zero-one-many | Focused pool workspace | ✅ covered | Zero entries use the empty state; one entry disables the irrelevant reorder direction; many entries expose applicable Move up/Move down controls. Agent pickers exclude existing keys and disable Add with an explanation when all supported agents are assigned. |
| long-text | Focused pool workspace | ✅ covered | Long entry names, paths, descriptions, and control labels wrap rather than push actions off-screen; full text remains accessible. |
| empty | Profiles chapter | ✅ covered | Render `No custom profiles yet` with copy-from-built-in/existing guidance and `Create custom profile`. |
| loading | Profiles chapter | ✅ covered | Keep Back visible and show labeled loading state for cards and the assignment editor without partially initialized controls. |
| error | Profiles chapter | ✅ covered | Preserve the profile draft, state the recovery problem, and provide `Back` rather than resetting assignments. |
| populated | Profiles chapter | ✅ covered | Show profile cards with name, short description, and readable per-agent/per-role tier assignments; opening a card uses the focused-editor pattern. |
| partial | Profiles chapter | ⊘ dismissed | An incomplete custom profile stays in its dedicated editor with inline required-field errors and blocked save, not a separate partial-rendering fallback. |
| overflow | Profiles chapter | ✅ covered | Cards and the assignment editor wrap long names/descriptions, reserve action space, and remain independently scrollable where needed. |
| zero-one-many | Profiles chapter | ✅ covered | No custom profiles uses the empty state; one and many profiles retain readable card spacing and selection states. |
| long-text | Profiles chapter | ✅ covered | Long profile names, descriptions, role labels, and assignments wrap or reflow without clipping, with accessible full text. |
| overflow | Provenance summary | ✅ covered | The sticky canonical/global/project summary lets each layer expand for inspection; values wrap or scroll within the summary and never displace detail-editor actions. |
| long-text | Provenance summary | 🧪 backstop | Visual/component tests must cover expanded long layer values and descriptions without horizontal clipping, overlap, or loss of the effective-source marker. |
| empty | Sensitive secret field | ✅ covered | An absent integration/API-key value renders as an editable masked field with explanatory helper text, never as an exposed placeholder or missing control. |
| loading | Sensitive secret field | ✅ covered | Keep the field masked and its reveal control unavailable while its state loads; show a labeled in-place loading state. |
| error | Sensitive secret field | ✅ covered | Report validation/load errors without echoing the secret, preserve any safe draft state, and retain an editable masked control. |
| partial | Sensitive secret field | ✅ covered | A missing or incomplete secret is an editable masked field with inline validation; no partial-secret value is rendered or logged. |
| long-text | Sensitive secret field | ✅ covered | The masked control never expands or reveals secret length/value in ordinary UI; helper and validation text wraps accessibly. |
| overflow | Runtime-baked notice | ✅ covered | The persistent warning wraps a long setting name and exact `gsd install` command without clipping the remediation action. |
| long-text | Runtime-baked notice | ✅ covered | Long setting names and command arguments reflow within the notice while the message remains readable and dismissible. |

Interaction contract: selecting a specialized field replaces the main editor surface with a focused panel and a clear `Back to {chapter}` action. The panel contains an entry list and detail editor. Add initializes a schema-defaulted blank entry and selects it. Ordered arrays provide labeled Move up/Move down buttons plus optional drag-and-drop; drag handles are a shortcut, not the only mechanism. Remove always confirms. There is no cloning or per-entry duplication.

Profile contract: add a dedicated `Profiles` chapter in middle navigation. Profile cards show name, short description, and readable per-agent/per-role tier assignments. Opening a card enters the same focused-editor pattern. Creating a custom profile begins by copying a built-in or existing profile, then requires a new name before assignments can be edited; empty-profile creation is not the primary path.

Layer contract: the compact three-layer summary is sticky/always visible within the focused detail header or top section. Each layer can expand for inspection. Show the effective source distinctly, but do not imply that inspecting or expanding a layer mutates it. Reset/copy actions must state that the resulting edit is a project-level override.

Security interaction contract: integration/API-key values are masked by default. Reveal is per field, requires a deliberate `Reveal value` action, re-masks on blur and after a short inactivity timeout, and never enters logs, diagnostics, or normal copy flows. Tests must verify automatic re-masking after blur and inactivity timeout, including focus returning to the field.

Runtime-baked setting contract: after a successful save, show the documented persistent warning naming each affected setting and the exact `gsd install` command until the user dismisses it or loads another config.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not applicable — no shadcn or third-party registry is initialized |

No third-party component blocks are specified. The implementation must use existing project components and styles or hand-built local components; do not introduce registry code without a new safety review.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-07-18 after checker verification; UI consideration probe classifications and resolutions confirmed.
