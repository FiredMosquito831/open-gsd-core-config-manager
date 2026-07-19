# Phase 5: Version History UI - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 adds a per-config history workspace on top of the existing app-data snapshot store. Users can browse every recorded pre-save snapshot, compare one snapshot structurally with the current saved project config, and restore it through the same validate → lock → atomic write → snapshot pipeline as a normal save.

This phase does not add snapshot naming, pruning, filtering, cloud synchronization, git integration, arbitrary snapshot-file access, or comparison against merged effective defaults. It delivers SAVE-05 and SAVE-06 only.

</domain>

<decisions>
## Implementation Decisions

### History workspace
- **D-01:** History is a dedicated, config-specific workspace mode entered from the selected tracked config. It replaces the normal chapter/editor area and provides a clear Back to editor action; it is not a schema chapter or overlay drawer.
- **D-02:** Keep the tracked-config sidebar visible so users retain file context and can switch configs. Hide the chapter-navigation pane because chapters do not navigate history. The history header identifies the active config and exposes Back to editor.
- **D-03:** Use a persistent split layout inside History: a narrow snapshot list beside a large comparison pane. Selecting a snapshot updates the comparison immediately rather than navigating to another page.
- **D-04:** Opening History never discards or forces resolution of an unsaved editor draft. Preserve the draft in memory and restore it exactly on return, but label every history comparison as snapshot versus the **current saved file on disk**, never versus the draft.

### Snapshot timeline
- **D-05:** Order snapshots newest first and group them under `Today`, `Yesterday`, then explicit calendar dates. Preserve access to the complete per-config history.
- **D-06:** Each snapshot row shows relative time, exact local date/time, snapshot sequence, and a computed count such as “4 keys changed from current.” Do not invent actors, commit messages, or semantic save labels that the store does not record.
- **D-07:** Selecting a row drives the adjacent diff pane. Changed-key counts may be computed lazily, but the final UX must make every row understandable before restore.
- **D-08:** When no snapshots exist, show a calm explanatory empty state: history begins after an existing config is successfully changed and saved. Do not synthesize the current file as a fake restorable version. Provide a route back to editing.

### Structural diff
- **D-09:** The comparison pane starts with a concise change summary (added, removed, changed counts and changed key paths) followed by the complete expandable structural object diff. The summary improves orientation but never replaces exhaustive detail.
- **D-10:** Use one stable orientation everywhere: **Snapshot → Current**. Label the selected past state as `Snapshot`/`Before` and the latest saved file as `Current`; additions and removals describe how the config evolved since that snapshot.
- **D-11:** Show every changed branch with sufficient parent context. Collapse unchanged branches by default, with controls to expand them; never omit a changed node.
- **D-12:** Present scalar and short-value changes inline as explicit `before → current` values. Use expanded blocks for long or nested values. Add/remove/change meaning must be conveyed by text or icons as well as color.
- **D-13:** Compare parsed persisted project JSON, not the canonical/global/project merged effective tree. Existing sensitive-field descriptors and temporary reveal safeguards apply to snapshot summaries and diffs so History cannot expose secrets more freely than the editor.

### Safe revert flow
- **D-14:** `Restore` opens a deliberate review confirmation rather than writing immediately. The dialog names the config and selected snapshot time, summarizes the changed-key counts, and explains that the current saved state will be snapshotted first so the operation remains recoverable. One final Restore action performs the write; typed confirmation is unnecessary.
- **D-15:** If an unsaved draft exists when restore is confirmed, require an explicit choice: `Save draft first`, `Discard draft and restore`, or `Cancel`. Never silently discard the draft and never retain a stale draft after disk content has been restored.
- **D-16:** A successful restore returns to the normal editor, reloads the restored config from the server, clears stale draft state, and refreshes both current-config and history data. Show a persistent success notice naming the restored timestamp with a `View history` action.
- **D-17:** A failed restore stays in History with the selected snapshot and diff intact. Show an actionable, classified error and state explicitly whether the config remained unchanged. Validation or atomic-write failure is blocking; history-recording failure remains the same non-blocking warning used by normal saves.
- **D-18:** Revert is implemented as a normal write through the existing `saveWithSnapshot()` boundary after securely loading and parsing the selected full-JSON snapshot. It must not directly copy, rename, or write snapshot files over the tracked config.

### Claude's Discretion
- Exact spacing, widths, responsive breakpoint behavior, icons, timestamp formatting, loading skeletons, changed-count caching strategy, diff library/component, summary wording, and confirmation copy are open to research and planning.
- The exact additive endpoint names and client query keys are open, provided they retain the opaque tracked-config ID boundary, frozen API envelopes, existing launch security guards, and the decisions above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` — Phase 5 goal, SAVE-05/SAVE-06 mapping, and three success criteria.
- `.planning/REQUIREMENTS.md` — exact browse/diff/revert requirement wording and exclusions.
- `.planning/PROJECT.md` — core value, local-only architecture, data-safety constraint, and version-history product commitment.

### Locked upstream decisions and API contracts
- `.planning/phases/02-local-loopback-server-cli-security-hardening/02-CONTEXT.md` — full-snapshot store, index metadata, pre-write snapshots, non-fatal snapshot warnings, and mandatory revert-as-write decision.
- `.planning/phases/02-local-loopback-server-cli-security-hardening/02-API-CONTRACT.md` — frozen REST envelopes, token/authentication rules, opaque config IDs, and additive extension constraints.
- `.planning/phases/03-generic-schema-driven-ui-shell/03-CONTEXT.md` — three-pane workspace, tracked-config sidebar, documentation-first visual direction, persisted project versus effective data semantics, and unknown-key preservation.
- `.planning/phases/04-pool-editors-model-profile-specialization/04-CONTEXT.md` — focused-workspace navigation pattern, unsaved draft integration, and sensitive-value masking/reveal requirements that History must preserve.

### Snapshot and safe-write implementation
- `packages/server/src/snapshot-store/index.ts` — snapshot metadata and existing per-config listing operation reserved for Phase 5.
- `packages/server/src/snapshot-store/paths.ts` — app-data root and deterministic config-path hashing; browser inputs must never bypass this derivation.
- `packages/server/src/snapshot-store/save-with-snapshot.ts` — mandatory normal-save/revert integration boundary and per-path serialization.
- `packages/config-io/src/atomic-write.ts` — validation, advisory locking, atomic replacement, and Windows retry behavior preserved during revert.
- `packages/server/src/registry.ts` — opaque tracked-config ID to validated filesystem path boundary.
- `packages/server/src/routes/configs.ts` — secured route conventions, registry resolution, validation errors, and existing save pipeline invocation.
- `packages/server/src/api-types.ts` — frozen success/error envelopes and client-facing tracked-config types.
- `packages/server/src/app.ts` — `/api` registration behind Host/Origin/token guards and injectable snapshot root used by tests.
- `test/server/snapshot-store.test.ts` — executable guarantees for prior-state capture, validation blocking, and concurrent history integrity.

### Client integration
- `web/src/components/AppShell.tsx` — three-pane shell where History becomes a dedicated selected-config workspace.
- `web/src/components/chapters/ChapterNav.tsx` — chapter pane hidden while History is active.
- `web/src/components/editor/ConfigEditor.tsx` — current draft/save/query behavior and post-restore refresh integration.
- `web/src/state/uiStore.ts` — selected config and focused-workspace/modal state conventions.
- `web/src/api/client.ts` — token-aware API boundary all history calls must reuse.
- `web/src/api/configs.ts` — thin endpoint-wrapper pattern for new history APIs.
- `web/src/components/sidebar/CreateConfigDialog.tsx` — existing accessible confirmation-dialog pattern to reuse or generalize.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/server/src/snapshot-store/index.ts`: already writes and lists full snapshots with `seq`, `timestamp`, `contentHash`, and relative filename; Phase 5 needs safe single-snapshot content access and comparison/revert orchestration, not a new storage model.
- `packages/server/src/snapshot-store/save-with-snapshot.ts`: already serializes same-path saves and snapshots the current state before replacement; restoring through it automatically creates the undo point required by the UX.
- `packages/server/src/registry.ts` and `packages/server/src/routes/configs.ts`: existing opaque-ID resolution and secure route conventions prevent the browser from choosing arbitrary local paths.
- `web/src/components/AppShell.tsx`, `web/src/state/uiStore.ts`, and Phase 4 focused-workspace conventions: natural seam for a dedicated History mode that preserves the tracked-config sidebar.
- `web/src/components/editor/ConfigEditor.tsx`: owns current config query, draft state, save mutation, and query invalidation behavior needed to safely enter/leave History and reload after restore.
- `web/src/components/sidebar/CreateConfigDialog.tsx`: accessible dialog semantics and visual treatment suitable for restore confirmation.

### Established Patterns
- Every `/api` request uses the per-launch token and existing Host/Origin defenses; history reads and restore writes stay inside that guarded API scope.
- Browser code deals in opaque tracked-config IDs. The server resolves the path and derives the snapshot directory; no client-supplied snapshot path or filename is trusted.
- The saved project object is distinct from merged effective values. History compares recorded project documents with current on-disk project content to avoid reporting inherited defaults as file changes.
- Client-side state may preserve an unsaved draft, but the server remains authoritative for current disk content and every restore.
- Sensitive values are descriptor-driven and masked by default; the same rules must cover summary values, diff rendering, errors, and diagnostics.
- No structural diff dependency or component is installed yet. Research must confirm a React 19/Vite 8-compatible option and ensure large nested objects, arrays, accessibility, and secret masking meet this context.

### Integration Points
- Add guarded history list/read/revert routes within the existing `/api` registration and frozen response envelopes. Resolve the tracked config via `registry.resolve(id)` before touching snapshot storage.
- Snapshot content reads must constrain index entries to their derived per-config directory and expected snapshot filename shape; a tampered `index.json` must not become arbitrary file read.
- Revert parses the selected snapshot, validates it, then calls `saveWithSnapshot()`; direct filesystem replacement is forbidden.
- Add thin token-aware client wrappers and TanStack Query keys for history metadata and selected-snapshot comparison. After restore, refresh both history and current-config queries.
- Extend workspace state so History can preserve the current draft while browsing, then require a draft decision before restore and clear/reload state after successful restore.

</code_context>

<specifics>
## Specific Ideas

- History should feel like a deliberate time-machine workspace for one config, not another schema chapter and not a raw JSON utility.
- The UI must distinguish `current saved file` from `unsaved draft` everywhere; opening History may preserve a draft, but the comparison never silently switches targets.
- Snapshot metadata stays truthful: show recorded time and sequence plus computed facts, never invented messages or actors.
- Recovery confidence is central: before restore, explain that the current state becomes an undo snapshot; after restore, return users to the familiar editor with clear confirmation.

</specifics>

<deferred>
## Deferred Ideas

- Snapshot naming, notes, actors, and manually created milestones.
- Snapshot pruning/retention controls, storage quotas, deletion, and de-duplication UI.
- Search/filtering across history, comparing arbitrary snapshot-to-snapshot pairs, or per-field restore.
- Cloud synchronization, collaboration, and project-git integration.

These are separate capabilities and are not part of SAVE-05 or SAVE-06.

</deferred>

---

*Phase: 5-Version History UI*
*Context gathered: 2026-07-19*
