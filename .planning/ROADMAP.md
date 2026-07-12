# Roadmap: GSD Config Manager

## Overview

This roadmap delivers a local-first, npx-launched GSD config editor in backend-first, dependency-driven order: first the data layer that guarantees no config is ever corrupted or silently stripped of unknown keys (Phase 1), then the secure local server and CLI that make the tool a single-command, trustworthy `npx` install with automatic save snapshots (Phase 2), then the generic schema-driven UI shell that renders every config chapter with beginner-friendly docs and manages tracked files (Phase 3), then the purpose-built pool and model-profile editors for GSD's hardest, highest-risk field shapes (Phase 4), then the version-history browsing/diff/revert UI on top of the snapshot store (Phase 5), and finally the live schema-reconcile feature that keeps the bundled schema current against the evolving gsd-core repository (Phase 6). Each phase is independently verifiable before the next begins, and the highest-cost-to-fix-later risks (data integrity, DNS-rebinding/loopback trust) are resolved first, not bolted on.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Schema Foundation & Data-Layer Safety** - Bundled canonical schema plus safe, layered, corruption-proof config read/write with zero data loss
- [ ] **Phase 2: Local Loopback Server, CLI & Security Hardening** - Single-command `npx` launch, secured local server, and automatic save snapshots
- [ ] **Phase 3: Generic Schema-Driven UI Shell** - Every config chapter rendered with plain-language docs, tracked-file sidebar, search, and inline validation
- [ ] **Phase 4: Pool Editors & Model Profile Specialization** - Guided editors for array/map pools and GSD model profiles, with effective-value/precedence display
- [ ] **Phase 5: Version History UI** - Browse, diff, and one-click revert of past config snapshots
- [ ] **Phase 6: Live Schema Reconcile Against gsd-core** - On-demand schema refresh from the live gsd-core repo without losing curated docs

## Phase Details

### Phase 1: Schema Foundation & Data-Layer Safety

**Goal**: The bundled canonical schema and safe read/write data layer exist, so any config file can be loaded with layered effective values and saved without ever losing data or corrupting the file.
**Depends on**: Nothing (first phase)
**Requirements**: SCHEMA-01, DISC-06, SAVE-01, SAVE-02, SAVE-03
**Success Criteria** (what must be TRUE):

  1. Loading a fixture config.json containing fabricated unknown keys and performing a no-op save round-trips with 100% key/value fidelity — nothing is dropped, reordered, or altered.
  2. Every documented gsd-core config chapter/key has a corresponding entry (keys, types, options, defaults) in the bundled schema, verified against a real gsd-core config.json with zero missing keys.
  3. Saving a config that fails schema validation is blocked with clear, field-level errors, and no partial write occurs.
  4. Killing the write process mid-save never leaves config.json truncated or corrupted on Windows — the file is always fully the old content or fully the new content, verified by repeated kill-mid-save testing.
  5. Loading a project config resolves effective values by merging canonical schema defaults with the global `~/.gsd/defaults.json` layer and the project's `config.json`, with each value traceable to the layer that supplied it.

**Plans**: 1/7 plans executed
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Project scaffold (locked pinned stack), frozen data contracts (types.ts), and real + fabricated-unknown test fixtures [wave 1]

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 01-02-PLAN.md — Bundled canonical schema via 4-source reconciliation + one-line docs + completeness gate (SCHEMA-01) [wave 2]
- [ ] 01-03-PLAN.md — Ajv 2020-12 validator (open additionalProperties) + prototype-pollution-safe safeSet (SAVE-01) [wave 2]
- [ ] 01-04-PLAN.md — Global-defaults discovery (DISC-06) + layered merge with provenance (SAVE-03) [wave 2]

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-05-PLAN.md — load(): raw + merge + provenance + unknown-key bucket (DISC-06, SAVE-03) [wave 3]
- [ ] 01-06-PLAN.md — Atomic write + Windows retry + validate-block + kill-mid-save stress harness (SAVE-02, SAVE-01) [wave 3]

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 01-07-PLAN.md — Round-trip identity gate (100% fidelity) + frozen config-io public API barrel (SAVE-03) [wave 4]

### Phase 2: Local Loopback Server, CLI & Security Hardening

**Goal**: Users can launch the entire tool with one `npx` command, reach a local server that only they can talk to, and have every save automatically protected by a snapshot.
**Depends on**: Phase 1
**Requirements**: DIST-01, DIST-02, DIST-03, DIST-04, SEC-01, SEC-02, SAVE-04
**Success Criteria** (what must be TRUE):

  1. Running `npx <package>` starts a local server bound to 127.0.0.1 and automatically opens the UI in the user's default browser, with no separate server setup.
  2. A request with a non-allowlisted Host header, or a cross-origin request from an unrelated site, is rejected by the server; a mutating request missing the per-launch token is rejected.
  3. Pressing Ctrl-C stops the tool cleanly — the port is released and no orphaned process or lock file remains.
  4. The tool is installable as a single public npm package with the built UI bundled inside it.
  5. Every successful save automatically creates a version snapshot stored outside the tracked project directory, with no extra user action required.

**Plans**: TBD

### Phase 3: Generic Schema-Driven UI Shell

**Goal**: Users can see, understand, and navigate every GSD config key in a rich, category-tabbed UI with plain-language explanations, and manage which config files they're tracking, all without touching raw JSON.
**Depends on**: Phase 2
**Requirements**: SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-06, DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, EDIT-01, EDIT-02, EDIT-04, EDIT-05, EDIT-06
**Success Criteria** (what must be TRUE):

  1. User can add a config file (path entry or file picker), scan a chosen folder to discover `.planning/config.json` files, or create a new config from defaults, and see it appear in a sidebar that persists across restarts.
  2. Clicking a tracked config in the sidebar loads its fields into a generic tab-per-chapter form covering every config chapter, with zero keys omitted and no namespace-specific hand-coded forms.
  3. Every field shows a plain-language explanation of what it does, and every enum/option shows what that specific choice means; enum-valued fields are edited via dropdown/radio, never free text.
  4. Fields the user hasn't overridden show a "using default" indicator with a one-click reset-to-default control; edits show inline validation errors as the user types, driven by the same schema used server-side.
  5. User can search/filter settings by key or description across all chapters, and any key present in a loaded file but not recognized by the schema is visibly surfaced rather than hidden or dropped.

**Plans**: TBD
**UI hint**: yes

### Phase 4: Pool Editors & Model Profile Specialization

**Goal**: Users can safely edit GSD's array/map "pool" fields and model profiles through guided, purpose-built controls, always seeing the effective resolved value and which layer set it, with secrets protected from casual exposure.
**Depends on**: Phase 3
**Requirements**: SEC-03, EDIT-03, POOL-01, POOL-02, POOL-03, PROF-01, PROF-02, PROF-03, PROF-04
**Success Criteria** (what must be TRUE):

  1. Array-valued and dynamic-map keys (e.g. `ship.pr_body_sections`, `review.reviewer_instances`, `model_overrides`, `effort.agent_overrides`) are added, configured, reordered, and removed through guided per-entry controls, never raw JSON.
  2. Agent-keyed maps are edited via an agent picker plus a value picker, and structured-object pools present a dedicated per-field editor for each entry matching their real validation constraints.
  3. Each field shows its effective resolved value and which resolution layer (canonical default → global defaults → project config) set it, not just the raw override in isolation.
  4. User can view existing GSD model profiles and their per-agent/per-role tier assignments, edit an existing profile, and create a new custom profile per gsd-core's documented shape.
  5. Saving a change to a runtime-baked setting (e.g. `model_overrides` on a Codex/OpenCode-style install) surfaces a clear "requires `gsd install` to take effect" notice; integration/API-key fields are masked by default in the UI and never logged.

**Plans**: TBD
**UI hint**: yes

### Phase 5: Version History UI

**Goal**: Users can see the full save history of any tracked config and safely undo mistakes.
**Depends on**: Phase 2
**Requirements**: SAVE-05, SAVE-06
**Success Criteria** (what must be TRUE):

  1. User can browse a per-config list of past save snapshots with timestamps.
  2. User can view a structural diff between any past snapshot and the current file, showing exactly which keys changed.
  3. User can revert to a previous snapshot with one click, and the revert is routed through the same validate → atomic-write → snapshot pipeline as a normal save, never a special-case path.

**Plans**: TBD
**UI hint**: yes

### Phase 6: Live Schema Reconcile Against gsd-core

**Goal**: The bundled schema can be refreshed against the live gsd-core repository so the tool stays current with new, changed, or deprecated config keys, without losing curated documentation or risking arbitrary code execution.
**Depends on**: Phase 3
**Requirements**: SCHEMA-05
**Success Criteria** (what must be TRUE):

  1. User can trigger a schema refresh; the tool fetches and safely parses (never `eval`/`require`) the live gsd-core schema sources.
  2. The refresh shows a clear summary of added, changed, and deprecated keys before merging into the active schema.
  3. Curated beginner-friendly descriptions for unchanged keys are preserved across a refresh — never blindly overwritten.
  4. A "schema last refreshed" indicator is visible so users always know how current their schema is.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Schema Foundation & Data-Layer Safety | 1/7 | In Progress|  |
| 2. Local Loopback Server, CLI & Security Hardening | 0/TBD | Not started | - |
| 3. Generic Schema-Driven UI Shell | 0/TBD | Not started | - |
| 4. Pool Editors & Model Profile Specialization | 0/TBD | Not started | - |
| 5. Version History UI | 0/TBD | Not started | - |
| 6. Live Schema Reconcile Against gsd-core | 0/TBD | Not started | - |
