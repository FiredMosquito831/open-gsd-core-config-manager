# Requirements: GSD Config Manager

**Defined:** 2026-07-11
**Core Value:** A user can open any GSD `config.json`, understand exactly what every setting and option means, and change it correctly and safely — without reading the gsd-core source or docs.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Launch & Distribution

- [x] **DIST-01**: User can launch the tool with a single command (`npx <package>`) with no separate server setup
- [x] **DIST-02**: The tool starts a local loopback (127.0.0.1) helper and automatically opens the UI in the user's browser
- [x] **DIST-03**: The tool is installable/shareable as a public npm package with the built UI bundled inside it
- [x] **DIST-04**: User can stop the tool cleanly (Ctrl-C) and the local helper shuts down without leaving orphaned processes or lock files

### Security (loopback trust model)

- [x] **SEC-01**: The local helper binds only to 127.0.0.1 and rejects requests whose Host header is not in an explicit allowlist (DNS-rebinding protection)
- [x] **SEC-02**: Mutating (write) requests require a per-launch random token embedded in the opened URL; requests without it are rejected
- [x] **SEC-03**: Integration/API-key config fields are masked in the UI by default and never logged

### Schema & Documentation

- [x] **SCHEMA-01**: The tool bundles a curated canonical schema (keys, types, options, defaults) covering every gsd-core config chapter
- [x] **SCHEMA-02**: Every config field displays a plain-language explanation of what it does, written for beginners
- [x] **SCHEMA-03**: Every enum/option value displays a plain-language explanation of what that specific choice means and its implications
- [x] **SCHEMA-04**: The schema-driven renderer covers all config chapters with no key omitted; adding a new bundled key requires no per-key hand-coding
- [x] **SCHEMA-05**: User can refresh/reconcile the canonical schema from the open-gsd/gsd-core repository, seeing added/changed/deprecated keys, without losing curated descriptions
- [x] **SCHEMA-06**: Unknown/future keys present in a loaded file that are not in the schema are surfaced to the user rather than hidden or dropped

### Config Discovery & Tracking

- [x] **DISC-01**: User can add an existing config file to the workspace via path entry or file picker
- [x] **DISC-02**: The tool remembers tracked config files in a persistent sidebar list across sessions
- [x] **DISC-03**: User can scan a chosen folder to discover `.planning/config.json` files and add them to the sidebar (respecting `node_modules`/`.git` boundaries)
- [x] **DISC-04**: User can create a brand-new config file initialized from defaults
- [x] **DISC-05**: Clicking a config in the sidebar loads its data into the editor for viewing and modifying
- [x] **DISC-06**: The tool locates and loads the applicable `defaults.json` (global `~/.gsd/defaults.json`) alongside a project config

### Editing UI

- [x] **EDIT-01**: The UI organizes config keys into category tabs ("chapters") derived from the canonical schema
- [x] **EDIT-02**: Each field indicates whether its value is a default or an explicit override, with a reset-to-default control
- [x] **EDIT-03**: Each field shows the effective value and its provenance across the resolution layers (canonical default → global defaults → project config)
- [x] **EDIT-04**: Enum-valued fields are edited via dropdown/radio controls, not free text
- [x] **EDIT-05**: User can search/filter settings by key or description across all chapters
- [x] **EDIT-06**: Fields show inline validation errors as the user edits (driven by the same schema used server-side)

### Pools (arrays & dynamic maps)

- [x] **POOL-01**: Array-valued and dynamic-map config keys are edited as "pools" where the user adds, configures, reorders, and removes entries through guided controls (no raw JSON)
- [x] **POOL-02**: Structured-object pools (e.g. `ship.pr_body_sections`, `review.reviewer_instances`) present per-field editors for each entry
- [x] **POOL-03**: Agent-keyed maps (e.g. `model_overrides`, `effort.agent_overrides`) are edited via an agent picker plus a value picker

### Model Profiles

- [x] **PROF-01**: User can view existing GSD model profiles and their per-agent/per-role tier assignments
- [x] **PROF-02**: User can edit an existing model profile
- [x] **PROF-03**: User can create a custom model profile per gsd-core docs
- [x] **PROF-04**: The model-profile editor surfaces when a change requires re-running `gsd install` to take effect (runtime-baked settings)

### Save Safety & Version History

- [x] **SAVE-01**: Every save validates the config against the schema before writing, blocking invalid writes with clear errors
- [x] **SAVE-02**: Saves write atomically (temp file + fsync + rename) with Windows lock/permission retry, so a crash never corrupts the file
- [x] **SAVE-03**: Saving preserves the full original parsed document, including unknown/future keys, comments-tolerant formatting, and key order where feasible (patch-in-place, never rebuilt from form state)
- [x] **SAVE-04**: Every save creates a version snapshot stored outside the tracked project directory
- [x] **SAVE-05**: User can browse a per-config snapshot history and view a structural diff between any snapshot and the current file
- [x] **SAVE-06**: User can revert to a previous snapshot with one click, routed through the same validate→atomic-write→snapshot pipeline

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Bulk & Presets

- **BULK-01**: User can apply an edit across multiple tracked configs at once
- **BULK-02**: User can save and reuse named setting presets/bundles

### Automation

- **AUTO-01**: Scheduled/automatic schema refresh with changelog prompts
- **AUTO-02**: Editing the global `~/.gsd/defaults.json` and workstream-level config overrides as first-class surfaces

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Hosted/multi-user server or cloud sync | Local-only by design ("no server needed") |
| Editing arbitrary non-GSD JSON files | Scope is GSD config/defaults/model profiles only |
| Running or orchestrating GSD workflows from the tool | This manages configuration; it does not execute phases |
| Unbounded automatic filesystem-wide crawling on launch | Discovery is explicit (manual add + chosen-folder scan) to stay predictable and safe |
| In-app AI "auto-configure" assistant | Tool teaches and edits; it does not decide settings for the user in v1 |
| Deep git automation inside the tool | Snapshots live in app-data; the tool does not manage the user's project git |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | Phase 1 | Complete |
| DISC-06 | Phase 1 | Complete |
| SAVE-01 | Phase 1 | Complete |
| SAVE-02 | Phase 1 | Complete |
| SAVE-03 | Phase 1 | Complete |
| DIST-01 | Phase 2 | Complete |
| DIST-02 | Phase 2 | Complete |
| DIST-03 | Phase 2 | Complete |
| DIST-04 | Phase 2 | Complete |
| SEC-01 | Phase 2 | Complete |
| SEC-02 | Phase 2 | Complete |
| SAVE-04 | Phase 2 | Complete |
| SCHEMA-02 | Phase 3 | Complete |
| SCHEMA-03 | Phase 3 | Complete |
| SCHEMA-04 | Phase 3 | Complete |
| SCHEMA-06 | Phase 3 | Complete |
| DISC-01 | Phase 3 | Complete |
| DISC-02 | Phase 3 | Complete |
| DISC-03 | Phase 3 | Complete |
| DISC-04 | Phase 3 | Complete |
| DISC-05 | Phase 3 | Complete |
| EDIT-01 | Phase 3 | Complete |
| EDIT-02 | Phase 3 | Complete |
| EDIT-04 | Phase 3 | Complete |
| EDIT-05 | Phase 3 | Complete |
| EDIT-06 | Phase 3 | Complete |
| SEC-03 | Phase 4 | Complete |
| EDIT-03 | Phase 4 | Complete |
| POOL-01 | Phase 4 | Complete |
| POOL-02 | Phase 4 | Complete |
| POOL-03 | Phase 4 | Complete |
| PROF-01 | Phase 4 | Complete |
| PROF-02 | Phase 4 | Complete |
| PROF-03 | Phase 4 | Complete |
| PROF-04 | Phase 4 | Complete |
| SAVE-05 | Phase 5 | Complete |
| SAVE-06 | Phase 5 | Complete |
| SCHEMA-05 | Phase 6 | Complete |

**Coverage:**

- v1 requirements: 38 total (corrected from a stale "34" count in the initial requirements draft — the enumerated list above has always contained 38 items)
- Mapped to phases: 38/38
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-11*
*Last updated: 2026-08-22 — Phase 4 marked complete (5/5 plans); schema refreshed to gsd-core v1.11.0*
