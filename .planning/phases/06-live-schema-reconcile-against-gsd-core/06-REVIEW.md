---
phase: 06-live-schema-reconcile-against-gsd-core
reviewed: 2026-07-21T00:00:00Z
depth: deep
files_reviewed: 31
files_reviewed_list:
  - packages/schema-data/bundled-schema-meta.json
  - packages/schema-data/scripts/build-schema.ts
  - packages/schema-data/src/reconcile.ts
  - packages/schema-data/src/source-types.ts
  - packages/server/src/active-schema-manager.ts
  - packages/server/src/api-types.ts
  - packages/server/src/app.ts
  - packages/server/src/capability-registry-parser.ts
  - packages/server/src/documentation-evidence-parser.ts
  - packages/server/src/routes/configs.ts
  - packages/server/src/routes/history.ts
  - packages/server/src/routes/schema.ts
  - packages/server/src/schema-persistence.ts
  - packages/server/src/schema-refresh-service.ts
  - packages/server/src/schema.ts
  - packages/server/src/upstream-archive.ts
  - packages/server/src/workspace-store.ts
  - test/packaging/tarball-contents.test.ts
  - test/schema-data/reconcile.test.ts
  - test/server/active-schema-manager.test.ts
  - test/server/capability-registry-parser.test.ts
  - test/server/documentation-evidence-parser.test.ts
  - test/server/schema-refresh-live.test.ts
  - test/server/schema-refresh.test.ts
  - test/server/schema-route.test.ts
  - test/server/upstream-archive.test.ts
  - test/web/app-shell.test.tsx
  - test/web/schema-workspace.test.tsx
  - web/src/api/schema.ts
  - web/src/components/AppShell.tsx
  - web/src/components/editor/ConfigEditor.tsx
  - web/src/components/schema/SchemaChangeSummary.tsx
  - web/src/components/schema/SchemaStatusControl.tsx
  - web/src/components/schema/SchemaWorkspace.tsx
  - web/src/state/uiStore.ts
  - web/src/styles.css
findings:
  critical: 4
  blocker: 4
  warning: 3
  info: 0
  total: 7
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-07-21T00:00:00Z
**Depth:** deep
**Files Reviewed:** 31
**Status:** issues_found

## Summary

Deep review covered the schema reconciliation pipeline, pinned archive acquisition and parsing, active-schema persistence and lifecycle routes, editor/cache integration, packaged-runtime coverage, and schema-maintenance UI. The review found four blockers affecting curation preservation, documentation-drift behavior, resource safety, and lifecycle concurrency, plus three UI/API robustness and accessibility warnings.

## Narrative Findings (AI reviewer)

## Critical Issues

### BL-01: Production refresh drops curated documentation and specialized-editor metadata

**File:** `packages/server/src/schema-refresh-service.ts:202`; `packages/schema-data/src/reconcile.ts:156-171`; `packages/server/src/app.ts:85-90`

**Issue:** `defaultRefreshDependencies()` supplies empty `curated` and `specialized` overlays. The production `buildApp()` path uses those defaults unchanged. `reconcileSchemaSources()` only preserves curated descriptions/categories/options and specialized editor metadata through those overlays, so every still-upstream-present key is rebuilt from structural evidence and loses the bundled schema’s beginner documentation and specialized metadata on activation.

The tests conceal this because `test/server/schema-refresh.test.ts:43-48` explicitly synthesizes curated overlays from `getBundledSchema()`, unlike production.

**Fix:** Build authoritative overlays from the shipped local curated/specialized artifacts, or derive them from the active bundled descriptor before reconciliation. Inject that implementation through `buildApp`, and add an integration test that uses actual `defaultRefreshDependencies()`/`buildApp()` and asserts activated schema entries retain `x-description`, `x-category`, `x-options`, and `x-specialized`.

### BL-02: Documentation drift can never be detected in the real refresh flow

**File:** `packages/server/src/schema-refresh-service.ts:154-157`; `packages/schema-data/src/reconcile.ts:182-200`

**Issue:** The service passes `previous: Object.create(null)` to `diff()`, so `diffCanonicalSchemas()` has no prior documentation fingerprints to compare. The candidate does not persist documentation fingerprints either. Consequently, the `documentation-drift` branch at `reconcile.ts:198-200` is unreachable in production, despite the UI and product contract presenting it as a first-class review category.

The unit test manufactures a previous fingerprint by overriding the `diff` dependency (`test/server/schema-refresh.test.ts:120-124`), so it does not validate the real call chain.

**Fix:** Persist per-key upstream documentation fingerprints as part of the activated schema envelope/metadata (or additive descriptor metadata), retrieve them from the active snapshot, and pass them as `previous` on each refresh. Add an end-to-end refresh/activate/refresh test demonstrating that a prose-only upstream edit produces a documentation-drift proposal without replacing curated text.

### BL-03: Archive resource limits are applied only after unbounded memory allocation

**File:** `packages/server/src/schema-refresh-service.ts:187-193`; `packages/server/src/upstream-archive.ts:78-84`

**Issue:** `fetchBytes()` calls `response.arrayBuffer()` before enforcing `maxCompressedBytes`, allowing an arbitrarily large HTTP response to be fully buffered in the helper process. Separately, `gunzipSync()` fully expands the archive before `maxDecompressedBytes` is checked. A compressed tar bomb can therefore exhaust process memory before either advertised limit is evaluated.

This violates the phase’s fail-closed bounded-resource contract and enables a remote-response denial of service.

**Fix:** Read `response.body` incrementally, maintain a compressed-byte counter, and cancel/throw immediately above the cap. Replace synchronous whole-buffer decompression with a bounded streaming gzip reader or otherwise enforce an output-byte cap during decompression, not after it. Add adversarial tests for an over-limit streaming response and a highly compressible gzip payload whose expanded content exceeds the decompression cap.

### BL-04: Schema activation/reset/refresh lifecycle operations race and can violate the user’s final action

**File:** `packages/server/src/routes/schema.ts:62-89`; `packages/server/src/schema-refresh-service.ts:111-128`; `packages/server/src/active-schema-manager.ts:129-151`

**Issue:** Refresh requests are deduplicated, but activation and reset are not serialized with each other or with refresh. For example:

1. An activate request captures proposal A.
2. A refresh begins and clears A at `schema-refresh-service.ts:128`, then prepares proposal B against the old active schema.
3. Activation of A writes/swaps the active snapshot.
4. `cancelProposal(A.id)` fails because B is retained, leaving B based on the obsolete snapshot available for activation.

Likewise, a reset and activation can run concurrently; reset can remove the override and select bundled state, then a still-running activation can persist and switch back to the old proposal. This breaks all-or-nothing lifecycle semantics and makes “Reset to bundled schema” non-authoritative.

**Fix:** Put proposal consumption, activation, reset, and refresh-start state transitions behind one lifecycle mutex/queue. Atomically consume a proposal before persistence; reject activation when the proposal is no longer current or the active generation it was based on has changed. Add concurrency tests for refresh-versus-activate and reset-versus-activate interleavings.

## Warnings

### WR-01: A server-retained proposal becomes unreviewable after remount or navigation

**File:** `web/src/api/schema.ts:11-13`; `web/src/components/schema/SchemaWorkspace.tsx:24-28`; `packages/server/src/routes/schema.ts:50`

**Issue:** `GET /api/schema/status` correctly includes a retained proposal, but `getSchemaStatus()` discards it and returns only `response.status`. `SchemaWorkspace` initializes `proposal` to `null` and never hydrates it from status data. If the user leaves schema maintenance, refreshes the page, or remounts within the five-minute proposal lifetime, the server still holds the proposal but the UI cannot display, activate, or cancel it. Starting another refresh silently discards it.

**Fix:** Return `{ status, proposal }` from the status client call and hydrate/update workspace proposal state from the query result. Alternatively use a status query whose data model includes the proposal. Add a component/API integration test that creates a proposal, remounts the workspace, and verifies it can still be reviewed and cancelled/activated.

### WR-02: Schema workspace renders a nested `main` landmark

**File:** `web/src/components/AppShell.tsx:97-114`; `web/src/components/schema/SchemaWorkspace.tsx:33`

**Issue:** `AppShell` always provides the application’s `<main aria-label="Schema maintenance">`; `SchemaWorkspace` returns another `<main>` inside it. Nested `main` landmarks are invalid document structure and create duplicate landmark navigation for assistive technologies. Existing landmark tests cover editor/history but not schema mode (`test/web/app-shell.test.tsx:104-113`).

**Fix:** Make `SchemaWorkspace` return a semantic non-landmark container (for example `<section>` or `<div>`) and leave `AppShell` as the sole main landmark. Add a schema-mode assertion that exactly one `main` exists.

### WR-03: Bundled schema status cannot provide the required accepted/generated date

**File:** `packages/server/src/active-schema-manager.ts:8-13,74-80`; `web/src/components/schema/SchemaStatusControl.tsx:21-25`

**Issue:** Bundled metadata contains `generatedAt`, but bundled `SchemaStatus` does not expose an accepted/generated timestamp. The persistent control therefore announces `date unavailable` for the normal bundled baseline. This fails the stated indicator contract to communicate active source, gsd-core version, and relevant accepted/refreshed date.

**Fix:** Add a safe bundled timestamp field to `SchemaStatus`/`SchemaStatusDto`, sourced from validated bundled metadata, and render it in the control/source card. Keep it distinct from a refreshed schema’s `activatedAt`. Add a test for the accessible bundled-control label including a real date.

---

_Reviewed: 2026-07-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
