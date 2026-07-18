---
phase: 04-pool-editors-model-profile-specialization
plan: 04
subsystem: ui
tags: [react, typescript, zustand, vitest, profiles, safe-save]
requires:
  - phase: 04-pool-editors-model-profile-specialization
    provides: focused specialized workspace and constrained editor primitives
provides:
  - dedicated Profiles chapter with five catalogued built-in selectors
  - copy-first project model configuration editor with local-only session label
  - value-free Codex/OpenCode post-save install guidance
affects: [config-editor, profile-specialization, pool-editors]
tech-stack:
  added: []
  patterns:
    - profile editing remains callback-driven through ConfigEditor full-candidate save
    - runtime notices derive only from confirmed model-resolution paths
key-files:
  created:
    - web/src/components/specialized/ProfileCards.tsx
    - web/src/components/specialized/ProfileEditor.tsx
    - web/src/components/specialized/RuntimeInstallNotice.tsx
    - test/web/profile-cards.test.tsx
    - test/web/profile-editor.test.tsx
    - test/web/profile-create.test.tsx
    - test/web/runtime-install-notice.test.tsx
  modified:
    - web/src/components/chapters/ChapterNav.tsx
    - web/src/components/chapters/ChapterView.tsx
    - web/src/components/editor/ConfigEditor.tsx
    - web/src/state/uiStore.ts
    - web/src/styles.css
decisions:
  - "Profiles is additive middle navigation and uses ordinary project fields rather than a profile persistence model."
  - "The optional session label is Zustand-only and never enters the save candidate."
  - "Only exact Codex/OpenCode model-resolution tier paths produce install guidance after confirmed save success."
metrics:
  duration: 30min
  completed: 2026-07-19
status: complete
---

# Phase 04 Plan 04 Summary

**Copy-first Profiles navigation and project model editing now use the existing validated save boundary, with truthful value-free runtime install guidance for Codex and OpenCode.**

## Accomplishments

- Added a dedicated Profiles chapter in middle navigation showing the five source-confirmed built-in selectors with descriptions and project-configuration copy guidance.
- Added a focused project model configuration editor for constrained agent assignments. The optional session label is explicitly local-only and does not participate in serialization, reload, validation, or `model_profile` changes.
- Added persistent dismissible runtime guidance after successful saves to exact Codex/OpenCode model-resolution tier paths. Notices name settings and exact commands only; unrelated paths and unsupported runtimes remain silent.
- Preserved the existing ConfigEditor mutation lifecycle, project candidate construction, validation, refresh, and API boundary without introducing a profile endpoint or durable profile registry.

## Task Commits

1. **Task 1: Add dedicated profile navigation, cards, and copy-first editor flow** — `da82367`
2. **Task 2: Integrate runtime-baked notices with normal safe save and reload** — `081708b`

## Verification

- `npm exec vitest run test/web/profile-cards.test.tsx test/web/profile-editor.test.tsx test/web/profile-create.test.tsx test/web/runtime-install-notice.test.tsx test/web/editor-save.test.tsx --environment jsdom --reporter=dot` — 5 files, 10 tests passed.
- `npm run build` — passed; CLI and Vite client production bundles generated successfully.
- `npm run typecheck` — known baseline failure in `test/web/phase4-catalog-evidence.test.ts` because the repository lacks Node type declarations. The production build and focused tests pass; no unrelated typecheck changes were made.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected focused notice test cleanup**
- **Found during:** Task 2 verification
- **Issue:** The isolated notice test left the first rendered notice mounted, causing the second query to find two dismissal buttons.
- **Fix:** Added Testing Library cleanup after each test.
- **Files modified:** `test/web/runtime-install-notice.test.tsx`
- **Commit:** `081708b`

### Scope Notes

- The plan's requested `04-UI-SPEC.md` amendment was already present in the inherited artifact, so no documentation edit was necessary.
- Per isolated executor instructions, `.planning/STATE.md` and `.planning/ROADMAP.md` were not modified.

## Known Stubs

None that block the plan goal. The built-in assignment summaries are intentionally catalog-backed UI copy; durable assignment editing remains limited to supported ordinary project fields.

## Threat Surface Review

No new endpoint, authentication path, filesystem access pattern, or schema trust boundary was introduced. Profile changes use the existing ConfigEditor candidate, validation, tokenized API, atomic write, snapshot, and reload flow. Runtime notices contain only catalog/path labels and static install commands.

## Self-Check: PASSED

- All created implementation and focused test files exist.
- Task commits `da82367` and `081708b` exist in git history.
- Focused tests and production build pass.
- Shared tracking artifacts remain unchanged.
