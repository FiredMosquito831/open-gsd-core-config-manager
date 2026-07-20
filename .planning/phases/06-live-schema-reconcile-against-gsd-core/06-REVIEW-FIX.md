---
phase: 06
fixed_at: 2026-07-21T02:20:00Z
review_path: .planning/phases/06-live-schema-reconcile-against-gsd-core/06-REVIEW.md
iteration: 3
findings_in_scope: 12
fixed: 12
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-07-21T02:20:00Z
**Source review:** `.planning/phases/06-live-schema-reconcile-against-gsd-core/06-REVIEW.md`
**Iteration:** 3

**Summary:**
- Findings in scope: 12
- Fixed: 12
- Skipped: 0

## Fixed Issues

### BL-01: Production refresh drops curated documentation and specialized-editor metadata

**Files modified:** `packages/server/src/schema-refresh-service.ts`, `test/server/schema-refresh.test.ts`
**Commit:** c8df249, 43ddc43
**Applied fix:** Production refresh now loads shipped curated documentation and derives specialized metadata only from object-valued `x-specialized` entries in the bundled schema. Catalog-wide arrays and other non-descriptor values are ignored.

### BL-02: Documentation drift can never be detected in the real refresh flow

**Files modified:** `packages/schema-data/src/source-types.ts`, `packages/server/src/schema-refresh-service.ts`
**Commit:** c8df249
**Applied fix:** Activated refreshed metadata persists upstream documentation fingerprints and each subsequent refresh compares its parsed fingerprints with the active generation before reporting documentation drift.

### BL-03: Archive resource limits are applied only after unbounded memory allocation

**Files modified:** `packages/server/src/schema-refresh-service.ts`, `packages/server/src/upstream-archive.ts`
**Commit:** c8df249
**Applied fix:** Archive downloads now count compressed bytes while reading the response stream and cancel above the cap; gzip inflation uses a bounded output limit.

### BL-04: Schema activation/reset/refresh lifecycle operations race and can violate the user’s final action

**Files modified:** `packages/server/src/active-schema-manager.ts`, `packages/server/src/app.ts`, `packages/server/src/routes/schema.ts`, `packages/server/src/schema-refresh-service.ts`
**Commit:** c8df249
**Applied fix:** Lifecycle mutations are serialized, proposals record their active-schema generation, and activation rejects stale proposals.

### WR-01: A server-retained proposal becomes unreviewable after remount or navigation

**Files modified:** `web/src/api/schema.ts`, `web/src/components/schema/SchemaWorkspace.tsx`
**Commit:** c8df249, 43ddc43
**Applied fix:** Status retrieval retains proposal data and the workspace hydrates its local proposal state from the server-retained proposal on query/remount.

### WR-02: Schema workspace renders a nested `main` landmark

**Files modified:** `web/src/components/schema/SchemaWorkspace.tsx`
**Commit:** c8df249
**Applied fix:** The schema workspace now uses a semantic section, leaving the app shell as the sole main landmark.

### WR-03: Bundled schema status cannot provide the required accepted/generated date

**Files modified:** `packages/server/src/active-schema-manager.ts`, `packages/server/src/api-types.ts`, `web/src/components/schema/SchemaWorkspace.tsx`
**Commit:** c8df249
**Applied fix:** Bundled schema status exposes validated build-generation time separately from refreshed activation time, and the workspace renders the appropriate source date.

### WR-05: Failed proposal activation consumed the retryable proposal

**Files modified:** `packages/server/src/routes/schema.ts`, `test/server/schema-route.test.ts`
**Commit:** 4dada5a
**Applied fix:** Proposal consumption now occurs only after durable activation succeeds while the lifecycle queue remains held; a failing-store route integration test verifies that the same proposal can retry successfully.

### WR-06: Reset left a retained schema proposal stale

**Files modified:** `packages/server/src/routes/schema.ts`, `test/server/schema-route.test.ts`
**Commit:** 4dada5a
**Applied fix:** Successful reset cancels any retained proposal inside the serialized lifecycle operation; the route test verifies status hides it and activation returns unavailable.

---

_Fixed: 2026-07-21T02:20:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
