# Phase 3: Generic Schema-Driven UI Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 3-generic-schema-driven-ui-shell
**Areas discussed:** Overall workspace layout, Field editing experience, Add/scan/create workflows, Search and unknown keys

---

## Overall workspace layout

| Decision | Alternatives considered | Selected |
|----------|-------------------------|----------|
| Main structure | Three panes; sidebar + top tabs; unified sidebar | Three panes |
| Field density | Documentation-first cards; compact rows; progressive disclosure | Documentation-first cards |
| Visual character | Modern developer tool; friendly configurator; minimal utility | Modern developer tool |
| Narrow layout | Collapsible navigation; desktop minimum width; single-pane flow | Collapsible navigation |

**Notes:** Config navigation, chapter navigation, and editing remain distinct. Both navigation panes collapse independently.

## Field editing experience

| Decision | Alternatives considered | Selected |
|----------|-------------------------|----------|
| Documentation | Concise + expandable; everything visible; separate help panel | Concise + expandable |
| Enum input | Restricted searchable combobox; standard dropdown; radios for short lists | Restricted searchable combobox |
| Provenance | Three-layer badge + reset; simple default indicator; always compare values | Three-layer badge + reset |
| Validation timing | After interaction then live; always live; blur/save only | After interaction then live |

**Notes:** The user emphasized that every possible option must be present and enum input must never become arbitrary free text. Array values should later use a dedicated listbox/combobox editor.

## Add, scan, and create workflows

| Decision | Alternatives considered | Selected |
|----------|-------------------------|----------|
| Entry point | One Add menu + separate Create; four buttons; onboarding screen | One Add menu + separate Create |
| Scan results | Review/select; add all; add individually | Review/select |
| Create target | Choose project folder; choose full filename; manual project path | Choose project folder and target `.planning/config.json` |
| Missing tracked files | Keep with repair actions; auto-remove; blocking startup repair | Keep with repair actions |

**Notes:** Scan results preselect valid new configs and clearly mark duplicates. Tracking survives restarts and temporary filesystem problems.

## Search and unknown keys

| Decision | Alternatives considered | Selected |
|----------|-------------------------|----------|
| Results surface | Dedicated cross-chapter view; current-chapter filter; command palette | Dedicated cross-chapter view |
| Search corpus | Keys/titles/docs/options; keys/titles only; include current values | Keys, titles, docs, and option meanings |
| Unknown keys | Dedicated warning chapter; inferred chapters; compact expandable list | Dedicated warning chapter |
| Result navigation | Jump and retain query; edit in results; clear query | Jump and retain query |

**Notes:** Unknown keys remain read-only and preserved. Exact key/title matches rank before prose matches.

## Agent's Discretion

- Fine visual tokens, responsive breakpoints, component-library choices, search-ranking weights, and additive persistence/API implementation details.

## Deferred Ideas

- Phase 4 specialized pool editor: dedicated window, listbox entries, add/reorder/remove controls, and schema-restricted comboboxes for enum array elements.
- Editing unknown/future keys beyond read-only preservation requires separate safe behavior and is not part of Phase 3.
