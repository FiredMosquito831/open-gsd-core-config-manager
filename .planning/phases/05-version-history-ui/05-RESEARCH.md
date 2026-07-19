# Phase 5: Version History UI - Research

**Researched:** 2026-07-19
**Domain:** Secure local snapshot-history API and React structural-diff workspace
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** History is a dedicated, config-specific workspace mode entered from the selected tracked config. It replaces the normal chapter/editor area and provides a clear Back to editor action; it is not a schema chapter or overlay drawer.
- **D-02:** Keep the tracked-config sidebar visible so users retain file context and can switch configs. Hide the chapter-navigation pane because chapters do not navigate history. The history header identifies the active config and exposes Back to editor.
- **D-03:** Use a persistent split layout inside History: a narrow snapshot list beside a large comparison pane. Selecting a snapshot updates the comparison immediately rather than navigating to another page.
- **D-04:** Opening History never discards or forces resolution of an unsaved editor draft. Preserve the draft in memory and restore it exactly on return, but label every history comparison as snapshot versus the **current saved file on disk**, never versus the draft.
- **D-05:** Order snapshots newest first and group them under `Today`, `Yesterday`, then explicit calendar dates. Preserve access to the complete per-config history.
- **D-06:** Each snapshot row shows relative time, exact local date/time, snapshot sequence, and a computed count such as “4 keys changed from current.” Do not invent actors, commit messages, or semantic save labels that the store does not record.
- **D-07:** Selecting a row drives the adjacent diff pane. Changed-key counts may be computed lazily, but the final UX must make every row understandable before restore.
- **D-08:** When no snapshots exist, show a calm explanatory empty state: history begins after an existing config is successfully changed and saved. Do not synthesize the current file as a fake restorable version. Provide a route back to editing.
- **D-09:** The comparison pane starts with a concise change summary (added, removed, changed counts and changed key paths) followed by the complete expandable structural object diff. The summary improves orientation but never replaces exhaustive detail.
- **D-10:** Use one stable orientation everywhere: **Snapshot → Current**. Label the selected past state as `Snapshot`/`Before` and the latest saved file as `Current`; additions and removals describe how the config evolved since that snapshot.
- **D-11:** Show every changed branch with sufficient parent context. Collapse unchanged branches by default, with controls to expand them; never omit a changed node.
- **D-12:** Present scalar and short-value changes inline as explicit `before → current` values. Use expanded blocks for long or nested values. Add/remove/change meaning must be conveyed by text or icons as well as color.
- **D-13:** Compare parsed persisted project JSON, not the canonical/global/project merged effective tree. Existing sensitive-field descriptors and temporary reveal safeguards apply to snapshot summaries and diffs so History cannot expose secrets more freely than the editor.
- **D-14:** `Restore` opens a deliberate review confirmation rather than writing immediately. The dialog names the config and selected snapshot time, summarizes the changed-key counts, and explains that the current saved state will be snapshotted first so the operation remains recoverable. One final Restore action performs the write; typed confirmation is unnecessary.
- **D-15:** If an unsaved draft exists when restore is confirmed, require an explicit choice: `Save draft first`, `Discard draft and restore`, or `Cancel`. Never silently discard the draft and never retain a stale draft after disk content has been restored.
- **D-16:** A successful restore returns to the normal editor, reloads the restored config from the server, clears stale draft state, and refreshes both current-config and history data. Show a persistent success notice naming the restored timestamp with a `View history` action.
- **D-17:** A failed restore stays in History with the selected snapshot and diff intact. Show an actionable, classified error and state explicitly whether the config remained unchanged. Validation or atomic-write failure is blocking; history-recording failure remains the same non-blocking warning used by normal saves.
- **D-18:** Revert is implemented as a normal write through the existing `saveWithSnapshot()` boundary after securely loading and parsing the selected full-JSON snapshot. It must not directly copy, rename, or write snapshot files over the tracked config.

### Claude's Discretion
- Exact spacing, widths, responsive breakpoint behavior, icons, timestamp formatting, loading skeletons, changed-count caching strategy, diff library/component, summary wording, and confirmation copy are open to research and planning.
- The exact additive endpoint names and client query keys are open, provided they retain the opaque tracked-config ID boundary, frozen API envelopes, existing launch security guards, and the decisions above.

### Deferred Ideas (OUT OF SCOPE)
- Snapshot naming, notes, actors, and manually created milestones.
- Snapshot pruning/retention controls, storage quotas, deletion, and de-duplication UI.
- Search/filtering across history, comparing arbitrary snapshot-to-snapshot pairs, or per-field restore.
- Cloud synchronization, collaboration, and project-git integration.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SAVE-05 | User can browse a per-config snapshot history and view a structural diff between any snapshot and the current file. | Add guarded list/detail routes; use `json-diff-kit` with summary extraction and secret-safe projection; render History as a config-specific workspace. [VERIFIED: codebase grep] |
| SAVE-06 | User can revert to a previous snapshot with one click, routed through the same validate→atomic-write→snapshot pipeline. | Resolve opaque config ID, securely load selected indexed snapshot, parse it, and pass it to `saveWithSnapshot()`; never replace files directly. [VERIFIED: codebase grep] |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Use the existing React + Vite + TypeScript frontend and Node/Fastify loopback helper; do not introduce a hosted service. [VERIFIED: codebase grep]
- Preserve the data-safety sequence: validate → atomic write → snapshot history/revert. [VERIFIED: codebase grep]
- Retain the per-launch token plus Host/Origin protections on every history read and restore request by registering routes inside the existing `/api` scope. [VERIFIED: codebase grep]
- Keep sensitive config values masked by default and never log them. [VERIFIED: codebase grep]
- Use Ajv/JSON Schema as the single validator; do not add Zod/Valibot. [VERIFIED: codebase grep]
- Do not bind the helper to `0.0.0.0`; retain loopback-only architecture. [VERIFIED: codebase grep]
- Use `write-file-atomic@7.0.1` through the existing save boundary; locking does not replace atomic writes. [VERIFIED: codebase grep]
- Use Vitest for unit/integration tests; keep TypeScript at 5.9.3. [VERIFIED: codebase grep]

## Summary

Phase 5 should extend, rather than replace, the existing Phase 2 snapshot system. The store already persists complete prior JSON documents outside the tracked project, with monotonic sequence numbers, timestamps, hashes, and a per-path serialization boundary. The missing work is a secure selected-snapshot reader plus additive guarded API routes and a History workspace that consumes those APIs. A restore must parse the stored document and call `saveWithSnapshot()` so validation, locking, atomic replacement, the new recovery snapshot, and the existing non-fatal snapshot-recording warning behavior remain identical to ordinary save behavior. [VERIFIED: codebase grep]

Use `json-diff-kit@1.0.35` as the structural object differ/viewer already chosen by project architecture. Compute the selected `Snapshot → Current` diff from parsed persisted project objects, memoize it, derive a separate exhaustive changed-path/count summary, and project sensitive values to masked placeholders before either summary or viewer receives them. The library supplies structural diff computation and React rendering; the product must own domain semantics: stable orientation, redaction, changed-path summary, snapshot grouping, draft-resolution flow, error classification, and restore orchestration. [VERIFIED: npm registry] [CITED: https://github.com/rexskz/json-diff-kit/blob/main/README.md]

**Primary recommendation:** Add a `history` workspace mode and three guarded opaque-ID routes (list, selected snapshot/current comparison payload, restore), centralizing trusted snapshot-file resolution in the snapshot store; render the result with a redacted `json-diff-kit` diff and restore only through `saveWithSnapshot()`. [VERIFIED: codebase grep]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Snapshot metadata list and selected snapshot load | API / Backend | Database / Storage | The server alone resolves opaque config IDs and the app-data snapshot directory; the browser must never select a filesystem path. [VERIFIED: codebase grep] |
| Snapshot-to-current parsed project comparison | API / Backend | Browser / Client | The API should return trusted parsed documents/current saved state; the client can calculate/display a UI-only diff after redaction. [VERIFIED: codebase grep] |
| Timeline grouping, selection, and workspace layout | Browser / Client | — | These are presentational state over server-provided snapshot metadata. [VERIFIED: codebase grep] |
| Restore validation, serialization, atomic replacement, and undo snapshot | API / Backend | Database / Storage | `saveWithSnapshot()` already owns this operation sequence and path-level serialization. [VERIFIED: codebase grep] |
| Draft preservation and draft-choice prompt | Browser / Client | API / Backend | The editor owns unsaved changes; the server remains authoritative for the restored disk state. [VERIFIED: codebase grep] |
| Sensitive-value masking in summary/diff | Browser / Client | API / Backend | Both API errors/logs and client rendering must avoid disclosure; redaction must occur before values reach diff/UI data. [VERIFIED: codebase grep] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `json-diff-kit` | `1.0.35` | Structural JavaScript-object diff plus React `Viewer` | Its official API provides `Differ.diff(before, after)` and a React viewer, avoiding a text diff that confuses key reordering with semantic changes. [VERIFIED: npm registry] [CITED: https://github.com/rexskz/json-diff-kit/blob/main/README.md] |
| `@tanstack/react-query` | `5.101.2` (installed) | Fetch/cache/invalidate history metadata and restore results | Existing editor calls already use query keys and `useMutation`; History should follow that client boundary. [VERIFIED: codebase grep] |
| Fastify | `5.10.0` (installed) | Guarded additive REST routes | Route generics and JSON Schema route validation match the existing API conventions. [VERIFIED: codebase grep] [CITED: https://github.com/fastify/fastify/blob/main/docs/Reference/TypeScript.md] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React | `19.2.7` (installed) | Preserve editor draft while showing a History sibling/workspace | Keep editor draft state mounted or lifted above the History switch; clear it deliberately after successful restore/reload. [VERIFIED: codebase grep] [CITED: https://github.com/react/react/blob/v19.2.7/packages/react-dom/src/__tests__/ReactMultiChildReconcile-test.js] |
| Zustand | `5.0.14` (installed) | UI-only active workspace, selected snapshot ID, and success notice state | Extend `uiStore.ts`; do not duplicate server snapshot/cache state there. [VERIFIED: codebase grep] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `json-diff-kit` | Hand-written recursive differ and renderer | Do not use: arrays, nested modifications, tree expansion, and inline text differences are edge-case-heavy; custom code would still need a viewer. [VERIFIED: codebase grep] |
| `json-diff-kit` structural diff | Pretty-printed text diff | Do not use: key-order-only changes become misleading line changes and violate the structural-diff requirement. [VERIFIED: codebase grep] |
| Existing `CreateConfigDialog` semantics generalized into restore dialogs | Native ad-hoc overlay | Do not use: a restore confirmation requires modal/focus behavior; build on the current accessible dialog pattern and close its known focus-trap gap. [CITED: https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/] |

**Installation:**
```bash
npm install json-diff-kit@1.0.35
```

**Version verification:** `npm view json-diff-kit version time --json` returned `1.0.35`, published 2026-03-03. `npm view json-diff-kit scripts.postinstall` returned no postinstall script. [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `json-diff-kit` | npm | 4+ years; current version published 2026-03-03 | 63,816/week at audit | github.com/RexSkz/json-diff-kit | OK | Approved [VERIFIED: npm registry] |

**Packages removed due to [SLOP] verdict:** none.

**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```text
Tracked-config sidebar
        │ open History for opaque config ID
        ▼
Browser History workspace ── token-aware API client ───────────┐
  │ list / select / restore                                     │
  │ preserve editor draft in parent/editor state                 ▼
  │                                                Fastify /api guarded scope
  │                                                    │ registry.resolve(id)
  │                                                    ▼
  │                                            Snapshot-store trusted reader
  │                                            (derived dir + index entry +
  │                                             canonical seq filename only)
  │                                                    │
  │                   current saved project JSON ◄─────┼────► selected snapshot JSON
  │                                                    │
  ▼                                                    ▼
Redact sensitive paths → Differ.diff(Snapshot, Current)     restore payload
  │                                                    │ parse + validate
  ▼                                                    ▼
summary + expandable Viewer                         saveWithSnapshot()
                                                     │ lock → atomic write
                                                     │ → snapshot prior current
                                                     ▼
                                              refreshed config/history queries
```

### Recommended Project Structure

```text
packages/server/src/
├── snapshot-store/
│   ├── index.ts                 # add trusted read-by-sequence/content helper
│   └── save-with-snapshot.ts    # unchanged mandatory restore boundary
├── routes/
│   └── configs.ts or history.ts # additive guarded history routes
└── api-types.ts                 # additive metadata/detail response types

web/src/
├── api/configs.ts               # thin list/detail/restore wrappers
├── state/uiStore.ts             # workspace/selection/notice UI state only
├── components/history/
│   ├── HistoryWorkspace.tsx
│   ├── SnapshotTimeline.tsx
│   ├── SnapshotDiff.tsx
│   └── RestoreDialogs.tsx
└── components/editor/ConfigEditor.tsx # explicit draft handoff/reset seam

test/
├── server/history-routes.test.ts
├── server/snapshot-store.test.ts
└── web/history-workspace.test.tsx
```

### Pattern 1: Trusted selected-snapshot access

**What:** Treat a selected snapshot as `(opaque config ID, numeric sequence)` rather than a browser-provided filename, path, or snapshot ID string. Resolve the config through `registry.resolve(id)`, derive its directory with `snapshotDirFor()`, read its index, find the entry by exact sequence, reject invalid/missing entries, verify the filename is the canonical `${seq}.json`, then read and JSON-parse only that derived path. [VERIFIED: codebase grep]

**When to use:** For comparison data and restore input. Never let client data enter `join()` as a snapshot filename. [VERIFIED: codebase grep]

**Example:**
```ts
// Source: existing snapshot-store path derivation and registry boundary
const tracked = registry.resolve(request.params.id);
if (!tracked) return reply.code(404).send(errBody('Unknown tracked config id'));

const snapshot = await readSnapshotBySequence(tracked.path, request.params.seq, snapshotRoot);
// readSnapshotBySequence derives snapshotDirFor(tracked.path), validates index entry,
// parses JSON, and never accepts a client filename/path.
```

### Pattern 2: Restore as ordinary save

**What:** The restore route loads one parsed snapshot object, invokes `saveWithSnapshot(tracked.path, snapshot, getValidator(), { root, warn })`, and maps its existing validation/error/snapshot-warning result into the frozen API envelope. [VERIFIED: codebase grep]

**When to use:** Every restore, including after the user resolves a dirty draft. Do not fork Phase 1 atomic-write code or copy a snapshot file directly. [VERIFIED: codebase grep]

**Example:**
```ts
// Source: packages/server/src/routes/configs.ts and save-with-snapshot.ts
const result = await saveWithSnapshot(tracked.path, snapshotConfig, getValidator(), {
  root: snapshotRoot,
  warn,
});

if (!result.ok) return reply.code(422).send({ ok: false, errors: result.errors });
return { ok: true, snapshotId: result.snapshotId, warning: result.warning };
```

### Pattern 3: Redact before diffing and summarizing

**What:** Build a deep, non-mutating presentation projection of both parsed project objects using the same descriptor-driven sensitive paths used by the editor. Replace a sensitive leaf with a fixed opaque marker before calculating summary counts, changed paths, or viewer diff; never send/display raw sensitive scalar values in History. [VERIFIED: codebase grep]

**When to use:** Every history response/UI flow, including restore confirmation summaries and error diagnostics. Keep the raw parsed snapshot only at the server restore boundary. [VERIFIED: codebase grep]

**Example:**
```tsx
// Source: json-diff-kit official README
const diff = useMemo(() => {
  const differ = new Differ({ showModifications: true, arrayDiffMethod: 'lcs' });
  return differ.diff(redactedSnapshot, redactedCurrent);
}, [redactedSnapshot, redactedCurrent]);

return <Viewer diff={diff} indent={2} highlightInlineDiff inlineDiffOptions={{ mode: 'word', wordSeparator: ' ' }} />;
```
[CITED: https://github.com/rexskz/json-diff-kit/blob/main/README.md]

### Pattern 4: Preserve draft across History, then explicitly invalidate after restore

**What:** History navigation must not unmount/reset the state that represents the editor draft. Make the parent editor/workspace controller own draft state, or keep the editor mounted while hiding its editor surface. After a successful restore, reset changes/resets/form to server-reloaded values and invalidate `['config', id]` plus the history key. [VERIFIED: codebase grep]

**When to use:** Entering/leaving History and the three-option dirty-draft restore decision. React resets state when a component is removed and re-added, so conditional replacement of the only draft owner is unsafe. [CITED: https://github.com/react/react/blob/v19.2.7/packages/react-dom/src/__tests__/ReactMultiChildReconcile-test.js]

### Anti-Patterns to Avoid

- **Direct snapshot-file restore:** Never use `copyFile`, `rename`, or `writeFile(snapshotContent, configPath)` for restore; it bypasses validation, locking, atomic replacement, and the recovery snapshot. [VERIFIED: codebase grep]
- **Path/filename from the browser:** Never accept snapshot paths, relative filenames, or `index.json` fields unvalidated; a tampered index must not become arbitrary file read. [VERIFIED: codebase grep]
- **Diffing effective values or editor draft:** History is persisted snapshot versus current persisted project JSON only. [VERIFIED: codebase grep]
- **Masking only the viewer:** Redact before summary/count/path extraction as well; confirmation text and errors must not leak secrets. [VERIFIED: codebase grep]
- **Using color alone for diff semantics:** Include text/icons for added, removed, and changed states. [VERIFIED: codebase grep]
- **Discarding dirty draft on History entry/restore:** Preserve it on entry; require Save draft first / Discard draft and restore / Cancel before restore. [VERIFIED: codebase grep]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structural JSON comparison | Recursive object/array diff algorithm | `json-diff-kit` `Differ` | Handles modifications, nested object differences, and configurable LCS array diffing. [CITED: https://github.com/rexskz/json-diff-kit/blob/main/README.md] |
| Expandable JSON diff presentation | Custom tree renderer with ad-hoc inline diff logic | `json-diff-kit` React `Viewer`, wrapped with product summary/redaction | The official viewer consumes `Differ` output and supports indentation, line numbers, and inline word highlighting. [CITED: https://github.com/rexskz/json-diff-kit/blob/main/README.md] |
| Atomic/locked restore | New restoration write routine | Existing `saveWithSnapshot()` → Phase 1 `saveConfig` | It already serializes same-path writes, validates first, atomically writes, and snapshots previous on-disk state. [VERIFIED: codebase grep] |
| Client API authentication | New `fetch` helper | Existing `apiFetch` | Existing wrappers use the launch token; all history calls must remain within that contract. [VERIFIED: codebase grep] |
| Confirmation modal semantics | Bare `role="dialog"` overlay | Reuse/generalize existing dialog component and implement APG modal behavior | A destructive action needs focus trap, Escape close, focus return, and least-destructive initial focus. [CITED: https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/] |

**Key insight:** Structural-diff rendering is reusable library territory; safe snapshot identity, restore semantics, and secret masking are product/security responsibilities that must remain in this codebase. [VERIFIED: codebase grep]

## Common Pitfalls

### Pitfall 1: Snapshot index traversal becomes arbitrary file read
**What goes wrong:** A route accepts `file`, a raw snapshot ID, or unvalidated `index.json` filename and reads outside app-data. [VERIFIED: codebase grep]

**Why it happens:** Snapshot metadata contains a relative `file` field, but the Phase 2 store intentionally did not expose it to a browser. [VERIFIED: codebase grep]

**How to avoid:** Browser supplies only config opaque ID plus numeric sequence. Server derives directory, validates index shape/entry and canonical filename, then parses JSON. Add tampered-index and traversal test cases. [VERIFIED: codebase grep]

**Warning signs:** Tests can retrieve another config's snapshot or a `../`-shaped filename reaches filesystem APIs. [VERIFIED: codebase grep]

### Pitfall 2: Restore skips recovery snapshot
**What goes wrong:** Restore appears to work but destroys the prior current state, making a restore itself irreversible. [VERIFIED: codebase grep]

**Why it happens:** Direct copying feels simpler than calling the normal save handler. [VERIFIED: codebase grep]

**How to avoid:** Unit-test that restore produces a new snapshot containing the pre-restore current bytes, and ensure the route calls `saveWithSnapshot()`. [VERIFIED: codebase grep]

**Warning signs:** Restore route imports `writeFile`, `copyFile`, `rename`, or `saveConfig` directly instead of `saveWithSnapshot()`. [VERIFIED: codebase grep]

### Pitfall 3: Dirty editor draft is lost or stale after restore
**What goes wrong:** Entering history resets local changes, or restore leaves form state showing values no longer on disk. [VERIFIED: codebase grep]

**Why it happens:** The current `ConfigEditor` owns `changes`, `resets`, and `useForm` state, while History replaces its surface. [VERIFIED: codebase grep]

**How to avoid:** Extract/lift draft controller state before adding the mode switch; explicit three-way choice before restore; on success reload server state and reset the controller. [VERIFIED: codebase grep]

**Warning signs:** Conditional rendering unmounts the sole `ConfigEditor`, or a successful restore does not invalidate/reload `['config', id]`. [VERIFIED: codebase grep]

### Pitfall 4: Secret values leak through diff metadata
**What goes wrong:** Viewer is masked but counts, changed paths, inline summary values, modal text, thrown errors, or dev diagnostics expose integration credentials. [VERIFIED: codebase grep]

**Why it happens:** Redaction is treated as a visual concern after values were already used in multiple computations. [VERIFIED: codebase grep]

**How to avoid:** Construct one redacted display model before all history comparison operations; preserve raw snapshot object only in the server-scoped restore execution. Test rendered DOM and route failures for secret absence. [VERIFIED: codebase grep]

**Warning signs:** `JSON.stringify(snapshot)` in logs/errors, or summary code operates on raw objects. [VERIFIED: codebase grep]

### Pitfall 5: Confirmation dialog is visually modal but keyboard-inaccessible
**What goes wrong:** Focus escapes to the page, Enter immediately activates Restore, or close leaves focus lost. [CITED: https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/]

**Why it happens:** The existing create dialog has basic `role="dialog"`/`aria-modal` markup but no visible focus-management implementation. [VERIFIED: codebase grep]

**How to avoid:** Use an alert dialog for restore review, make background inert, trap Tab/Shift+Tab, allow Escape to cancel, focus Cancel/least destructive choice initially, and return focus to the invoking Restore button. [CITED: https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/]

**Warning signs:** Keyboard test tabs into sidebar or main content while dialog is open. [CITED: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/]

## Code Examples

### Structural comparison and viewer

```tsx
// Source: https://github.com/rexskz/json-diff-kit/blob/main/README.md
import { Differ, Viewer } from 'json-diff-kit';
import 'json-diff-kit/dist/viewer.css';

const diff = useMemo(() => new Differ({
  showModifications: true,
  arrayDiffMethod: 'lcs',
}).diff(snapshotDisplayObject, currentDisplayObject), [snapshotDisplayObject, currentDisplayObject]);

return <Viewer diff={diff} indent={2} highlightInlineDiff inlineDiffOptions={{ mode: 'word', wordSeparator: ' ' }} />;
```
[CITED: https://github.com/rexskz/json-diff-kit/blob/main/README.md]

### Additive Fastify route shape

```ts
// Source: existing packages/server/src/routes/configs.ts convention
app.get<{ Params: { id: string } }>(
  '/configs/:id/history',
  async (req, reply) => {
    const tracked = registry.resolve(req.params.id);
    if (!tracked) return reply.code(404).send(errBody('Unknown tracked config id'));
    return { ok: true, snapshots: await listSnapshots(tracked.path, snapshotRoot) };
  },
);
```
[CITED: https://github.com/fastify/fastify/blob/main/docs/Reference/TypeScript.md]

### Restore completion client flow

```ts
await restoreSnapshot(activeConfigId, selectedSequence);
await Promise.all([
  queryClient.invalidateQueries({ queryKey: ['config', activeConfigId] }),
  queryClient.invalidateQueries({ queryKey: ['history', activeConfigId] }),
]);
resetDraftFromReloadedServerConfig();
setWorkspaceMode('editor');
showRestoreNotice(selectedSnapshot.timestamp);
```
[VERIFIED: codebase grep]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Text/line diff for JSON | Structural object diff with `Differ` plus React `Viewer` | Current project stack decision | Avoids false changes caused solely by JSON key formatting/order. [VERIFIED: codebase grep] |
| Direct restore file copy | Restore through the ordinary validated atomic save pipeline | Locked Phase 2/5 decision | Restore creates a recovery snapshot and retains safety guarantees. [VERIFIED: codebase grep] |
| Browser-selected filesystem target | Opaque tracked-config ID resolved server-side | Existing Phase 2 API contract | Prevents History routes from becoming arbitrary local-file APIs. [VERIFIED: codebase grep] |

**Deprecated/outdated:**
- Direct snapshot file replacement: prohibited for this project because it bypasses the required save safety pipeline. [VERIFIED: codebase grep]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | None. | — | All implementation-critical claims were verified against code, Context7, W3C APG, or the npm registry. |

## Open Questions

1. **Where should draft-controller ownership move?**
   - What we know: `ConfigEditor` currently owns `changes`, `resets`, and form state; History must preserve that state. [VERIFIED: codebase grep]
   - What's unclear: Whether planner should keep `ConfigEditor` mounted or extract a controller hook/parent workspace component.
   - Recommendation: Plan an explicit refactor task first; favor a reusable `useConfigDraft`/workspace controller so History, restore dialogs, and editor use one authoritative draft lifecycle. [VERIFIED: codebase grep]

2. **What is the precise `json-diff-kit` expansion-control API?**
   - What we know: Official docs confirm `Differ` configuration and `Viewer` rendering, but the Context7 excerpt does not document a controlled expanded-node API. [CITED: https://github.com/rexskz/json-diff-kit/blob/main/README.md]
   - What's unclear: Whether the viewer itself can initialize unchanged nodes collapsed while retaining changed context.
   - Recommendation: Before implementation, inspect installed package types/source. If it cannot satisfy D-11, use its `Differ` output with a small accessible project-owned tree wrapper; do not substitute a custom diff algorithm. [CITED: https://github.com/rexskz/json-diff-kit/blob/main/README.md]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Fastify server, Vite, package install | ✓ | v22.22.0 | — [VERIFIED: codebase grep] |
| npm | dependency installation and test scripts | ✓ | 10.9.4 | — [VERIFIED: codebase grep] |
| `json-diff-kit` | Structural History diff viewer | ✗ (not installed) | audited target 1.0.35 | Install approved package in first implementation task. [VERIFIED: npm registry] |

**Missing dependencies with no fallback:** none. [VERIFIED: codebase grep]

**Missing dependencies with fallback:** none; `json-diff-kit` is an approved planned package installation. [VERIFIED: npm registry]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.10` with React Testing Library `16.3.2` and jsdom `29.1.1`. [VERIFIED: codebase grep] |
| Config file | `vitest.config.ts`. [VERIFIED: codebase grep] |
| Quick run command | `npm test -- --run test/server/history-routes.test.ts test/web/history-workspace.test.tsx`. [VERIFIED: codebase grep] |
| Full suite command | `npm test && npm run typecheck && npm run build`. [VERIFIED: codebase grep] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAVE-05 | Authorized client receives a newest-first per-config snapshot list; no history returns empty list. | server integration | `npm test -- --run test/server/history-routes.test.ts` | ❌ Wave 0 |
| SAVE-05 | Selected snapshot is compared against current saved project JSON with stable Snapshot → Current orientation, exhaustive changed paths, and masked sensitive values. | unit + React | `npm test -- --run test/web/history-workspace.test.tsx` | ❌ Wave 0 |
| SAVE-05 | Invalid ID, sequence, index tampering, and cross-config access do not expose arbitrary files. | server security integration | `npm test -- --run test/server/history-routes.test.ts` | ❌ Wave 0 |
| SAVE-06 | Restore validates and snapshots current state before atomically writing selected parsed snapshot. | server integration | `npm test -- --run test/server/history-routes.test.ts test/server/snapshot-store.test.ts` | ❌ Wave 0 |
| SAVE-06 | Dirty draft requires Save draft first / Discard draft and restore / Cancel; success clears/reloads draft and refreshes history/config queries. | React integration | `npm test -- --run test/web/history-workspace.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** targeted Vitest file(s) plus `npm run typecheck`. [VERIFIED: codebase grep]
- **Per wave merge:** `npm test`. [VERIFIED: codebase grep]
- **Phase gate:** `npm test && npm run typecheck && npm run build` green before `/gsd-verify-work`. [VERIFIED: codebase grep]

### Wave 0 Gaps
- [ ] `test/server/history-routes.test.ts` — list/detail/restore envelope, opaque-ID, tampered-index, validation, atomic/recovery-snapshot behavior for SAVE-05/SAVE-06.
- [ ] `test/web/history-workspace.test.tsx` — timeline grouping, diff orientation/summary, redaction, draft decision, restore success/failure, and keyboard dialog behavior.
- [ ] Existing `test/server/snapshot-store.test.ts` additions — trusted read-by-sequence canonical filename validation.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Retain per-launch token guard on every `/api` history request. [VERIFIED: codebase grep] |
| V3 Session Management | yes | Retain launch-scoped token and origin/host authorization context. [VERIFIED: codebase grep] |
| V4 Access Control | yes | Opaque config ID resolution; derive snapshot storage from resolved path; never accept filesystem path/filename from browser. [VERIFIED: codebase grep] |
| V5 Input Validation | yes | Fastify parameter/body schema plus numeric sequence validation; parse snapshot JSON and validate it through `saveWithSnapshot()` before writing. [VERIFIED: codebase grep] [CITED: https://github.com/fastify/fastify/blob/main/docs/Reference/TypeScript.md] |
| V6 Cryptography | no new cryptography | Reuse SHA-256 content hashes only as existing metadata; do not hand-roll cryptography. [VERIFIED: codebase grep] |
| V7 Error Handling and Logging | yes | Return frozen error envelopes and avoid values/contents in snapshot parsing errors or diagnostics. [VERIFIED: codebase grep] |
| V8 Data Protection | yes | Descriptor-driven masking before summary/diff/modal display; no secret logging. [VERIFIED: codebase grep] |

### Known Threat Patterns for History stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Arbitrary local-file read via snapshot filename/index tampering | Information Disclosure / Elevation | Resolve opaque ID server-side, derive directory, validate exact numeric sequence and canonical filename, reject malformed index. [VERIFIED: codebase grep] |
| Cross-config snapshot access | Elevation of Privilege | Never make snapshot directory/key a client identifier; resolve tracked config and lookup only its derived store. [VERIFIED: codebase grep] |
| Restore bypasses validation/atomic write | Tampering | Only invoke `saveWithSnapshot()` after secure load/parse. [VERIFIED: codebase grep] |
| History endpoint bypasses loopback defenses | Spoofing / CSRF | Register beneath existing guarded `/api` plugin; do not create a static/public route. [VERIFIED: codebase grep] |
| Sensitive historical secret exposed in UI/errors | Information Disclosure | Apply same sensitive descriptors/reveal policy to every display model and never log raw snapshots. [VERIFIED: codebase grep] |
| Double-click/concurrent restore race | Tampering / Reliability | Disable pending restore control client-side; rely on `saveWithSnapshot()` same-path serialization server-side. [VERIFIED: codebase grep] |

## Sources

### Primary (HIGH confidence)
- `packages/server/src/snapshot-store/index.ts`, `save-with-snapshot.ts`, `paths.ts`, `routes/configs.ts`, `api-types.ts`, and `registry.ts` — existing snapshot, safe-write, opaque-ID, and envelope contracts. [VERIFIED: codebase grep]
- `web/src/components/editor/ConfigEditor.tsx`, `AppShell.tsx`, `state/uiStore.ts`, `api/configs.ts`, and `CreateConfigDialog.tsx` — current draft, workspace, query, and dialog seams. [VERIFIED: codebase grep]
- npm registry — `json-diff-kit@1.0.35` version, publication date, no postinstall result; legitimacy audit verdict OK. [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- [JSON Diff Kit README](https://github.com/rexskz/json-diff-kit/blob/main/README.md) — `Differ` options and React `Viewer` usage. [CITED: https://github.com/rexskz/json-diff-kit/blob/main/README.md]
- [Fastify TypeScript documentation](https://github.com/fastify/fastify/blob/main/docs/Reference/TypeScript.md) — typed route and schema conventions. [CITED: https://github.com/fastify/fastify/blob/main/docs/Reference/TypeScript.md]
- [React reconciliation tests, v19.2.7](https://github.com/react/react/blob/v19.2.7/packages/react-dom/src/__tests__/ReactMultiChildReconcile-test.js) — component removal/reset and identity behavior. [CITED: https://github.com/react/react/blob/v19.2.7/packages/react-dom/src/__tests__/ReactMultiChildReconcile-test.js]

### Tertiary (LOW confidence)
- [W3C APG alert dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/) and [modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) — confirmation-dialog focus and keyboard guidance. [CITED: https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package version/legitimacy confirmed; official API usage retrieved. [VERIFIED: npm registry]
- Architecture: HIGH — Phase 2/3/4 seams and locked Phase 5 decisions are explicit in the checked-out code/context. [VERIFIED: codebase grep]
- Pitfalls: HIGH — derived from existing security/snapshot invariants, with dialog keyboard details cited from W3C. [VERIFIED: codebase grep]

**Research date:** 2026-07-19
**Valid until:** 2026-08-18 for stable server/client architecture; verify `json-diff-kit` Viewer expansion API immediately before implementation.
