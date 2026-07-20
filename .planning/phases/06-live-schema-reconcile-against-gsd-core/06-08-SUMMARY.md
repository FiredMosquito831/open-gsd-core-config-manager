---
phase: 06-live-schema-reconcile-against-gsd-core
plan: 08
subsystem: schema-workspace-ui
tags: [react, zustand, tanstack-query, accessibility, schema-lifecycle]
requires:
  - phase: 06-07
    provides: guarded schema lifecycle API and active schema authority
provides:
  - Persistent schema status affordance and dedicated schema-maintenance workspace
  - Safe staged refresh, review, activation, cancellation, and reset interactions
  - Coherent schema/config cache refresh before editor resume
affects: [schema-editor, app-shell, schema-lifecycle]
tech-stack:
  added: []
  patterns: [server-normalized-evidence-only, opaque-proposal-lifecycle, project-owned-alertdialog]
key-files:
  created:
    - web/src/components/schema/SchemaStatusControl.tsx
    - web/src/components/schema/SchemaWorkspace.tsx
    - web/src/components/schema/SchemaChangeSummary.tsx
    - test/web/schema-workspace.test.tsx
  modified:
    - web/src/api/schema.ts
    - web/src/state/uiStore.ts
    - web/src/components/AppShell.tsx
    - web/src/components/editor/ConfigEditor.tsx
    - web/src/styles.css
    - test/web/app-shell.test.tsx
key-decisions:
  - "Lifecycle UI sends only opaque proposal identifiers; source selectors and remote schema content remain server-owned."
  - "Activation and reset invalidate schema and selected-config caches before announcing coherent editor data."
metrics:
  duration: "~35 min"
  completed_date: "2026-07-20"
status: complete
---

# Phase 06 Plan 08: Schema Maintenance Workspace Summary

A persistent, accessible schema-maintenance workspace now lets users inspect active schema freshness and explicitly review, activate, cancel, or reset normalized schema proposals without exposing remote or local source details.

## Accomplishments

- Added token-aware API lifecycle wrappers plus Zustand `schema` workspace mode that preserves the tracked-config sidebar even when no configuration is selected.
- Added a persistent Bundled/Refreshed status control with accessible source, version, date, busy, and warning semantics.
- Implemented the staged schema workspace: trusted source card, named check stages, no-change state, safe failures/retries, fixed grouped evidence, all-or-nothing activation, cancellation, and recovery reset dialog.
- Added responsive project-owned CSS for desktop review panes, compact stacking, 44px controls, bounded evidence-value overflow, focus outlines, and reduced-motion handling.
- Added component coverage for status affordance, lifecycle states, opaque activation, no-change behavior, cancellation, reset focus/Escape restoration, redaction, and visual-verification hooks.

## Task Commits

1. **Task 1: Freeze schema workspace states, accessibility, and cache switching** — `e4ae309` (test)
2. **Task 2: Implement typed lifecycle client and dedicated schema workspace** — `06ca8cf` (feat)

## Verification

- PASS — `npx vitest run test/web/schema-workspace.test.tsx --reporter=dot` (6 tests)
- PASS — `npx vitest run test/web/schema-workspace.test.tsx test/web/app-shell.test.tsx test/server/schema-route.test.ts --reporter=dot` (19 tests)
- BLOCKED (pre-existing) — `npm run typecheck` / web typecheck report missing Node typings in unrelated `test/web/phase4-catalog-evidence.test.ts`; no Plan 06-08 TypeScript errors remain.
- NOTE — Plan-specified `-x` Vitest switch is unsupported by the installed Vitest 4.1.10 CLI; verification ran without that obsolete option.

## Decisions Made

- Evidence rendering is restricted to server-normalized DTO fields and static UI copy; raw URLs, paths, archive names, and thrown error details are never interpolated.
- Schema mode short-circuits editor config loading so no selected config is required to inspect or recover the active schema.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated AppShell test mock for the persistent status query**
- **Found during:** Task 2 verification
- **Issue:** Existing AppShell tests mocked only `getSchema`; the newly persistent status control also requests `getSchemaStatus`.
- **Fix:** Added the status mock and stable test status fixture.
- **Files modified:** `test/web/app-shell.test.tsx`
- **Commit:** `e4ae309`

**2. [Rule 3 - Blocking] Adapted lifecycle wrappers to established server route shapes**
- **Found during:** Task 2 implementation
- **Issue:** The plan names lifecycle operations but server routes already use opaque proposal IDs in route params and empty bodies, not new body-bearing endpoint shapes.
- **Fix:** Client wrappers call existing guarded routes with an encoded opaque ID and no selector/schema payload.
- **Files modified:** `web/src/api/schema.ts`
- **Commit:** `06ca8cf`

## Known Stubs

None.

## Threat Flags

None. Lifecycle calls retain the existing guarded API boundary and expose only server-normalized status/evidence.

## Self-Check: PASSED

- Confirmed schema workspace components and component test file exist.
- Confirmed task commits `e4ae309` and `06ca8cf` exist in git history.
