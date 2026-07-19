---
phase: 05-version-history-ui
verified: 2026-07-19T14:34:56Z
status: gaps_found
score: 6/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Every snapshot row eventually presents an exact changed-key count while the complete per-config history remains browsable."
    status: partial
    reason: "Only the currently selected snapshot's detail query populates the count map. No query or bounded queue ever loads the remaining snapshot details, so all nonselected rows remain at 'Calculating changes…' indefinitely."
    artifacts:
      - path: "web/src/components/history/HistoryWorkspace.tsx"
        issue: "Lines 57-60 populate counts only from selectedDetail; no loop/queue fetches details for unselected rows."
      - path: "web/src/components/history/SnapshotTimeline.tsx"
        issue: "Lines 18-22 render the unresolved fallback whenever a row has no count."
    missing:
      - "Implement and test a bounded progressive detail/count loader for all returned history entries, preserving selected-detail priority."
  - truth: "The structural comparison is derived from the approved json-diff-kit result rather than a separate project comparison algorithm."
    status: partial
    reason: "The Differ result is discarded. A second handwritten JSON.stringify equality test, LCS aligner, and recursive tree/count builder determine all rendered paths and counts."
    artifacts:
      - path: "web/src/history/compare.ts"
        issue: "Line 161 invokes Differ.diff without using its return value; lines 68-152 independently calculate equality, LCS, and diff nodes."
    missing:
      - "Adapt the DiffResult returned by json-diff-kit into the project-owned tree and derive summary/counts from that adapted result, with regressions for paths and arrays."
---

# Phase 05: Version History UI Verification Report

**Phase Goal:** Users can browse complete per-config version history, inspect secret-safe structural Snapshot → Current saved-file differences, and deliberately restore a prior snapshot through the validated atomic save/snapshot pipeline without stale drafts or history corruption.
**Verified:** 2026-07-19T14:34:56Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | User can browse a per-config list of past save snapshots with timestamps. | VERIFIED | `historyRoutes` resolves the opaque config ID before `listSnapshots`; `listSnapshots` validates/index-projects every entry and sorts descending by sequence. `SnapshotTimeline` renders all returned entries with exact and relative timestamps. `history-routes.test.ts` passes list/no-history/newest-first cases. |
| 2 | User can view a structural diff between any past snapshot and the current saved file, showing exactly which keys changed. | FAILED (BLOCKER) | Snapshot/current retrieval and redaction are wired, but the approved structural differ's result is discarded. `compare.ts:161` calls `Differ.diff()` only for side effects, while `sameValue`, `alignArrays`, and `buildNodes` independently determine the rendered tree and summary. This violates the plan's single-differ contract and leaves the claimed library-derived structural result unproven. |
| 3 | User can revert to a previous snapshot with deliberate confirmation through the normal validate → atomic-write → snapshot pipeline. | VERIFIED | `RestoreDialogs` requires explicit confirmation; `historyRoutes.ts:98-103` re-reads a trusted snapshot and calls `saveWithSnapshot`, which holds in-process and cross-process transaction locks across read/write/snapshot. Server integration test proves the pre-restore bytes become the recovery snapshot; client test proves reload/reset/return-to-editor transition. |
| 4 | The timeline preserves access to all returned history rows and eventually gives each row an exact change count rather than an invented zero. | FAILED (BLOCKER) | Every row is rendered, but `HistoryWorkspace.tsx:57-60` sets `counts` only for the selected detail. `SnapshotTimeline.tsx:18-22` therefore leaves every never-selected row at `Calculating changes…` permanently; no bounded progressive queue exists. |
| 5 | History comparisons are Snapshot → Current saved-file comparisons, not drafts or merged effective values, and sensitive descriptor roots are redacted before presentation. | VERIFIED | Detail route reads persisted tracked-file JSON directly; `buildHistoryComparison(snapshot.document, current)` preserves orientation. `projectHistoryDocument` deep-clones and projects catalog sensitive roots before diff/tree creation. Focused tests pass and assert the secret sentinel is absent from DOM/model output. |
| 6 | A dirty draft is preserved while browsing, has an explicit Save draft first / Discard draft and restore / Cancel decision at restore, and cannot remain stale after successful restore. | VERIFIED | The per-config `entries` map in `useConfigDraft` retains drafts by opaque ID; `RestoreDialogs` implements the three actions; `HistoryWorkspace` reloads server authority then invokes `draft.resetFromServer`. Focused restore/draft tests pass. |
| 7 | Snapshot selection and restore access fail closed: only canonical positive safe-integer sequences in the server-derived per-config directory can be used, with static non-disclosing errors. | VERIFIED | `parseSequence`, `readSnapshotBySequence`, canonical filename/index/hash validation, and `/api` Host/Origin/token guard wiring are substantive. Passing server tests cover malformed sequences, cross-config lookup, index tampering, secret/path non-disclosure, and concurrent restores. |
| 8 | The dedicated history workspace retains tracked-config context while hiding chapter/search UI and returns safely to the editor. | VERIFIED | `AppShell` conditionally suppresses chapter rail/nav/search in `history` mode while retaining the sidebar. `ConfigEditor` owns the draft hook above its History workspace branch and renders `HistoryWorkspace` embedded in the sole main landmark. Focused workspace and AppShell tests pass. |

**Score:** 6/8 truths verified (0 present, behavior-unverified).

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/server/src/snapshot-store/index.ts` | Trusted per-config selected-snapshot reader | VERIFIED | Exists, substantive validation/hash code, and used by guarded detail/restore routes. |
| `packages/server/src/routes/history.ts` | Guarded list/detail/restore API | VERIFIED | Registered inside guarded `/api` plugin; resolves registry before storage and restores only through `saveWithSnapshot`. |
| `web/src/history/compare.ts` | Redacted structural comparison model | PARTIAL — BLOCKER | Exists and is called by `SnapshotDiff`, but discards the `json-diff-kit` output and substitutes a separate recursive comparison implementation. |
| `web/src/history/time.ts` | Local-date grouping/time formatting | VERIFIED | `SnapshotTimeline` imports both helpers; focused DST boundary test passes. |
| `web/src/api/configs.ts` | Token-aware history wrappers | VERIFIED | All three opaque-ID/sequence wrappers use `apiFetch`; restore sends no document/body. |
| `web/src/editor/useConfigDraft.ts` | Per-config draft lifecycle | VERIFIED | Substantive map/controller, consumed by editor and History workspace via typed `HistoryDraftController`. |
| `web/src/components/history/HistoryWorkspace.tsx` | Complete history workspace and count loader | PARTIAL — BLOCKER | Query/data/restore wiring is substantive, but it only calculates selected-row counts; no nonselected count loader is implemented. |
| `web/src/components/history/{SnapshotTimeline,SnapshotDiff,HistoryDiffTree,RestoreDialogs}.tsx` | Timeline, diff, accessible restore UI | VERIFIED | Imported and rendered from `HistoryWorkspace`; no stub returns or debt markers found. |

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `history.ts` | `registry.ts` | `registry.resolve(id)` before snapshot access | WIRED | Present in all three handlers before reader/list access. |
| `history.ts` | `save-with-snapshot.ts` | restore selected document through safe ordinary save | WIRED | Direct import/call at line 100; route imports no direct write/copy/rename primitive. |
| `snapshot-store/index.ts` | `paths.ts` | server-derived `snapshotDirFor` | WIRED | Both list and trusted selected read derive the per-config directory internally. |
| `compare.ts` | `specializedMetadata.ts` | sensitive-root projection before comparison | WIRED | Catalog-derived roots are projected before the Differ invocation/tree construction. |
| `compare.ts` | `json-diff-kit` | Differ result drives comparison model | NOT WIRED — BLOCKER | `new Differ(...).diff(before, after)` is invoked but its return result is unused. |
| `HistoryWorkspace.tsx` | `configs.ts` | TanStack history list/detail/restore calls | WIRED | `listHistory`, `getHistorySnapshot`, `restoreConfigSnapshot`, and `loadConfig` are all invoked through query/mutation flow. |
| `HistoryWorkspace.tsx` | `useConfigDraft.ts` | save/reset lifecycle after restore | WIRED | Typed `HistoryDraftController` invokes `saveDraft` and `resetFromServer`. |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `HistoryWorkspace` timeline | `historyQuery.data` | `listHistory(id)` → guarded GET list → validated index | Yes | FLOWING |
| `SnapshotDiff` | `selectedDetail.data` | `getHistorySnapshot(id, seq)` → guarded GET detail → persisted snapshot/current JSON | Yes | FLOWING |
| `SnapshotTimeline` counts | `counts` map | Only selected `selectedDetail.data` effect | No, for nonselected rows | HOLLOW — BLOCKER |
| `HistoryDiffTree` | `buildHistoryComparison` output | Redacted documents from selected detail | Present but derived by separate hand-rolled algorithm | PARTIAL — BLOCKER |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Phase 5 server/UI/draft/API regression suite | `npm test -- --run test/server/history-routes.test.ts test/server/snapshot-store.test.ts test/web/history-workspace.test.tsx test/web/history-comparison.test.ts test/web/api-client.test.ts test/web/editor-save.test.tsx test/web/app-shell.test.tsx test/web/app-shell-responsive.test.tsx` | 8 files, 62 tests passed | PASS |
| Production build | `npm run build` | CLI and Vite production builds passed; 218 modules transformed | PASS |
| TypeScript workspace gate | `npm run typecheck` | Exit 2. All reported diagnostics are pre-existing Phase 4 files: `phase4-catalog-evidence.test.ts`, `schema-index.test.ts`, `specialized-draft.test.ts`, and `web/src/schema/specializedMetadata.ts`; no Phase 5 diagnostic is printed. | WARNING — external to Phase 5 |

## Probe Execution

Step 7c: SKIPPED. No Phase 5 probe path was declared by plans/summaries and no conventional `scripts/**/tests/probe-*.sh` was found.

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| SAVE-05 | 05-01, 05-02, 05-03, 05-04, 05-05 | Per-config snapshot browsing and structural snapshot-to-current diff | BLOCKED | List/detail/security/redaction are implemented and tested, but exact all-row counts never complete and the required json-diff-kit-derived comparison model is not actually wired. |
| SAVE-06 | 05-01, 05-02, 05-04, 05-06 | Restore selected snapshot through normal validate → atomic-write → snapshot pipeline | SATISFIED | Trusted server read plus `saveWithSnapshot`, recovery snapshot, explicit dialog, draft decision, authoritative reload/reset, and focused passing tests. |

No orphaned requirements: all Phase 5 requirements mapped in `REQUIREMENTS.md` (`SAVE-05`, `SAVE-06`) occur in plan frontmatter. `SAVE-05` is not marked satisfied because of the two implementation gaps above.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `web/src/history/compare.ts` | 161 | Invokes and discards `Differ.diff` result | BLOCKER | The approved structural comparison dependency is cosmetic; a second unapproved algorithm determines output. |
| `web/src/components/history/HistoryWorkspace.tsx` | 57-60 | Selected-only count population | BLOCKER | Nonselected complete-history rows never resolve their required exact change count. |
| Phase 5 source | — | `TBD`/`FIXME`/`XXX` debt markers | None | No unresolved debt marker found. |

## Human Verification Required

Automated coverage cannot establish the visual/readability portions of the approved UI contract. After the blocking gaps are fixed, inspect the running app in both themes: browse a long multi-date history, verify every row's count eventually resolves, inspect wrapped long paths/values, exercise keyboard focus trapping/return, and verify success and warning notices are readable at narrow widths.

The plan frontmatter also carried unverified negative constraints (no fabricated history metadata/current-file version, no unsaved-draft comparison target, no irreversible/silent restore, and no secret exposure). Source and focused tests provide strong evidence, but these remain appropriate end-to-end UAT checks rather than silent acceptance.

## Gaps Summary

The safe API and restore pipeline are real: trusted opaque-ID/sequence lookup, hash/index validation, guarded route registration, recovery snapshots, transaction serialization, draft reset, and dialog behavior are all implemented and exercised by focused tests. Build also succeeds.

However, the SAVE-05 browsing/diff claim is not fully delivered. The UI promises count resolution but only ever computes the active row, and its claimed `json-diff-kit` structural model is not connected to the data it renders. These are observable product-contract failures rather than test-only omissions; both block goal completion. The existing test suite passes because it asserts the selected row and separately proves the library can produce output, not that the application adapts that output or resolves all history rows.

The full typecheck remains red only on known Phase 4 diagnostics and is documented as a warning, not attributed to this phase. The supplied broader prior-phase regression result (202 passed / 14 failed) was not used as Phase 5 evidence: its reported schema-completeness, WSL packaging/CLI timeout, server-setup timeout, and Phase 4 handoff failures require their owning phases to resolve and no direct Phase 5 causal link was found in this verification.

---

_Verified: 2026-07-19T14:34:56Z_
_Verifier: Claude (gsd-verifier)_
