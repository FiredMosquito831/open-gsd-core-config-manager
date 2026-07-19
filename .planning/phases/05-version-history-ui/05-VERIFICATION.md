---
phase: 05-version-history-ui
verified: 2026-07-19T19:35:00Z
status: gaps_found
score: 6/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/8
  gaps_closed: []
  gaps_remaining:
    - "Every snapshot row eventually presents an exact changed-key count while the complete per-config history remains browsable."
    - "The structural comparison is derived from the approved json-diff-kit result rather than a separate project comparison algorithm."
  regressions:
    - "Valid container-to-scalar comparison streams fail closed as unavailable."
    - "A selected terminal-error timeline row cannot be recovered through its own Retry action."
    - "Valid JSON object keys can collide in the adapter's dot/bracket path identity."
gaps:
  - truth: "User can view a structural diff between any past snapshot and the current file, showing exactly which keys changed."
    status: failed
    reason: "The DiffResult adapter rejects valid json-diff-kit streams for object/array-to-scalar and scalar-to-container replacements, and its raw dot/bracket path identity collides for valid JSON object keys. These ordinary persisted config documents show 'History comparison unavailable' instead of an exhaustive diff."
    artifacts:
      - path: "web/src/history/compare.ts"
        issue: "Blank modify alignment rows emitted by json-diff-kit are rejected at lines 124-127; joinPath at lines 81-82 is non-injective and the duplicate-path guard at lines 194-196 rejects valid dotted/bracket keys."
    missing:
      - "Adapt documented blank modify alignment rows with strict container context for object/array-to-scalar and scalar-to-object/array replacements."
      - "Use an injective internal path identity (for example RFC 6901 JSON Pointer) and separately escaped display paths; cover dots, brackets, quotes, nested-key collisions, and array-key collisions."
  - truth: "Every snapshot returned for the active config eventually changes from Calculating changes… to an exact count or an accessible recoverable error state."
    status: partial
    reason: "The bounded loader resolves normal rows and exposes Retry after exhaustion, but a selected terminal-error row's Retry callback starts a generation that deliberately excludes that selected sequence from its queue and never refetches the selected-detail query. That valid recovery flow remains terminal forever."
    artifacts:
      - path: "web/src/history/useProgressiveHistoryCounts.ts"
        issue: "Lines 107-109 only enqueue retryNow when it differs from selectedSeq; the row callback has no connection to selectedDetail.refetch()."
      - path: "web/src/components/history/HistoryWorkspace.tsx"
        issue: "The timeline receives only retryCount, while selectedDetail.refetch is wired exclusively to SnapshotDiff."
    missing:
      - "When retrying the selected sequence, refetch the selected-detail owner or enqueue it under the same bounded scheduler without duplicate ownership."
      - "Add an integration regression that exhausts a row, selects it, activates its timeline Retry, resolves the fresh detail request, and observes the exact count replacing the error."
---

# Phase 05: Version History UI Verification Report

**Phase Goal:** Users can see the full save history of any tracked config and safely undo mistakes.
**Verified:** 2026-07-19T19:35:00Z
**Status:** gaps_found
**Re-verification:** Yes — after plans 05-07 and 05-08

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | User can browse a per-config list of past save snapshots with timestamps. | VERIFIED | `historyRoutes` resolves the opaque config ID then lists server-derived snapshots; `SnapshotTimeline` renders every returned entry grouped by local date with exact and relative timestamps. Phase suite test covers newest-first and complete rows. |
| 2 | User can view a structural diff between any past snapshot and the current file, showing exactly which keys changed. | FAILED — BLOCKER | `buildHistoryComparison` does use the captured `Differ.diff` tuple, but valid object/array-to-scalar streams and valid dotted/bracket object keys throw the static unavailable error. Direct runtime checks against the installed library reproduced both failures. |
| 3 | User can revert to a previous snapshot with one explicit action after review through the normal validate → atomic-write → snapshot pipeline. | VERIFIED | The guarded restore route loads the trusted snapshot and calls `saveWithSnapshot`; client dialogs require review/dirty-draft choice and then reload/reset authoritative editor state. Focused server and workspace tests pass. |
| 4 | Every returned timeline row progresses from a pending count to an exact count or an accessible terminal error, without truncating history. | PARTIAL — BLOCKER | Normal progressive loading is bounded and resolves five rows in the integration test, but retrying an exhausted selected row can never launch a new request, so an actionable user recovery flow is broken. |
| 5 | History comparisons are Snapshot → Current saved-file comparisons, not drafts/effective values, and catalog sensitive roots are redacted before presentation. | VERIFIED | The detail route reads the persisted tracked file; `buildHistoryComparison(snapshot, current)` projects both documents before `Differ.diff`; redaction tests assert that the sentinel is absent from differ inputs/model/DOM. |
| 6 | A dirty draft is retained while browsing and has explicit Save draft first / Discard draft and restore / Cancel choices; a successful restore cannot leave it stale. | VERIFIED | `useConfigDraft` keeps per-config draft state and `RestoreDialogs` implements the three decisions; success reloads and invokes `draft.resetFromServer`. Workspace test exercises the transition. |
| 7 | Snapshot selection and restore fail closed to canonical positive safe-integer sequences from a server-derived per-config directory. | VERIFIED | `parseSequence`, trusted snapshot read/index validation, registry resolution, and guarded API routes are substantive; focused server tests cover malformed sequences, cross-config access, index tampering, and recovery snapshots. |
| 8 | The dedicated History workspace retains tracked-config context, hides chapter/search navigation, and returns safely to the editor. | VERIFIED | `AppShell` and `ConfigEditor` use History mode while preserving the sidebar and editor-owned draft; `HistoryWorkspace` has the sole embedded main region and Back to editor action. App-shell/workspace tests pass. |

**Score:** 6/8 truths verified (0 present, behavior-unverified).

## Re-verification of Original Gaps

| Original gap | Current result | Evidence |
|---|---|---|
| Exact counts for every complete-history row | PARTIALLY REMEDIATED — BLOCKER | 05-07 adds a real two-worker progressive loader and normal all-row completion test. The selected-row terminal Retry flow is still unsatisfiable because `retryNow !== selectedSeq` prevents scheduling and no selected query refetch is invoked. |
| json-diff-kit result is the structural authority | PARTIALLY REMEDIATED — BLOCKER | 05-08 removes the prior handwritten equality/LCS/tree authority and passes the captured `diffResult` to `adaptHistoryDiffResult`. However, the adapter rejects valid library output and aliases valid key paths, so it cannot be the reliable authority for all valid configurations. |

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/server/src/snapshot-store/index.ts` | Trusted per-config selected-snapshot reader | VERIFIED | Used by guarded detail/restore routes with canonical index/hash/directory checks. |
| `packages/server/src/routes/history.ts` | Guarded list/detail/restore API | VERIFIED | Resolves opaque ID before storage access and restores only via `saveWithSnapshot`. |
| `web/src/history/compare.ts` | Redaction-first `json-diff-kit` adapter/model | PARTIAL — BLOCKER | Library tuple is now genuinely consumed, but parser/path identity reject valid documents. |
| `web/src/history/useProgressiveHistoryCounts.ts` | Bounded selected-priority progressive count loader | PARTIAL — BLOCKER | Real bounded queue, retries, cancellation, and count source exist; selected terminal Retry is not wired to a request owner. |
| `web/src/components/history/HistoryWorkspace.tsx` | Complete history workspace and count/retry wiring | PARTIAL — BLOCKER | List/detail/restore data flow works, but it passes timeline retry only to the background scheduler, not selected-detail refetch. |
| `web/src/components/history/{SnapshotTimeline,SnapshotDiff,HistoryDiffTree,RestoreDialogs}.tsx` | Timeline, diff, accessible restore UI | VERIFIED | Imported and rendered from workspace; no placeholder returns or unresolved debt markers. |

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `history.ts` | `registry.ts` | `registry.resolve(id)` before snapshot access | WIRED | Present in list/detail/restore handlers. |
| `history.ts` | `save-with-snapshot.ts` | trusted selected document through ordinary safe save | WIRED | Direct `saveWithSnapshot` call; no direct snapshot-file replacement. |
| `compare.ts` | `json-diff-kit` | named `diffResult` passed to `adaptHistoryDiffResult` | WIRED, SEMANTICALLY BROKEN | The original cosmetic call is removed, but adapter acceptance/path semantics fail valid library results. |
| `useProgressiveHistoryCounts.ts` | `configs.ts` | exact TanStack Query detail key and `getHistorySnapshot` | WIRED | Uses cache then `fetchQuery` with `['history', configId, sequence]`. |
| `HistoryWorkspace.tsx` | `SnapshotTimeline.tsx` | completed count map, errors, retry callback | PARTIAL — BLOCKER | Counts/errors flow, but selected-row Retry cannot reach selected detail query ownership. |
| `HistoryWorkspace.tsx` | `useConfigDraft.ts` | save/reset lifecycle after restore | WIRED | Typed controller calls `saveDraft` and `resetFromServer`. |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `HistoryWorkspace` timeline | `historyQuery.data` | guarded `listHistory(id)` → validated snapshot index | Yes | FLOWING |
| `SnapshotDiff` | `selectedDetail.data` | guarded `getHistorySnapshot(id, seq)` → stored snapshot/current file | Yes, except valid adapter failures | PARTIAL — BLOCKER |
| `SnapshotTimeline` counts | `counts` | selected query plus bounded `getHistorySnapshot` workers | Yes for normal and nonselected retry paths | PARTIAL — selected retry disconnected |
| `HistoryDiffTree` | `buildHistoryComparison` output | projected snapshot/current passed through library tuple adapter | No for valid container/scalar and colliding-key cases | HOLLOW — BLOCKER |

## Deep Review Finding Disposition

| Finding | Status | Verification evidence |
|---|---|---|
| CR-01: container-to-scalar streams rejected | CONFIRMED — BLOCKER | Installed `Differ` emits blank `modify` rows for `{x:{a:1}} → {x:2}`; `parseStream` rejects them because it accepts blank rows only with `type === 'equal'`. Direct `buildHistoryComparison` throws. |
| CR-02: selected terminal Retry cannot recover | CONFIRMED — BLOCKER | `retry()` reruns the effect but lines 107-109 exclude the selected retry sequence from the queue; the timeline does not invoke `selectedDetail.refetch`. No focused test exercises recovery. |
| CR-03: raw display-path construction collides | CONFIRMED — BLOCKER | `{ "a.b": 1, "a": { "b": 2 } }` is valid JSON but produces duplicate `a.b` identity and throws at duplicate guard. Bracket-containing keys have the same defect. |
| WR-01: priority/retry lifecycle coverage incomplete | CONFIRMED — WARNING | Existing test selects #5 after background work may have already started it and never activates row Retry after exhaustion. This gap allowed CR-02. |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Phase 5 server/UI/draft/API regression suite | `npx vitest run test/server/history-routes.test.ts test/server/snapshot-store.test.ts test/web/history-workspace.test.tsx test/web/history-comparison.test.ts test/web/api-client.test.ts test/web/editor-save.test.tsx test/web/app-shell.test.tsx test/web/app-shell-responsive.test.tsx` | 8 files, 69 tests passed | PASS |
| Original gap focused comparison/workspace suite | `npm test -- --run test/web/history-comparison.test.ts test/web/history-workspace.test.tsx` | 2 files, 23 tests passed | PASS, INSUFFICIENT |
| Valid object-to-scalar comparison | `npx tsx -e "…buildHistoryComparison({x:{a:1}}, {x:2})…"` | Throws `History comparison unavailable` | FAIL — BLOCKER |
| Valid dotted-key comparison | `npx tsx -e "…buildHistoryComparison({'a.b':1,a:{b:2}}, {'a.b':3,a:{b:4}})…"` | Throws `History comparison unavailable` | FAIL — BLOCKER |
| Production build | Supplied orchestrator evidence | Passed | PASS (reported) |

## Probe Execution

Step 7c: SKIPPED. No Phase 5 probe path is declared in plans/summaries and no conventional `scripts/**/tests/probe-*.sh` exists.

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| SAVE-05 | 05-01, 05-02, 05-03, 05-04, 05-05, 05-07, 05-08 | Browse per-config snapshots and view a structural diff between any snapshot and current file | BLOCKED | Valid persisted documents can make comparison unavailable; selected terminal count Retry cannot recover. The word “any” is not achieved. |
| SAVE-06 | 05-01, 05-02, 05-04, 05-06 | Revert a previous snapshot through validate → atomic-write → snapshot pipeline | SATISFIED | Guarded trusted read, normal save pipeline, recovery snapshot, explicit dialogs/draft choice, authoritative reload/reset, and focused passing tests. |

No orphaned Phase 5 requirements: `SAVE-05` and `SAVE-06` appear in plan frontmatter and are mapped to Phase 5 in `REQUIREMENTS.md`.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `web/src/history/compare.ts` | 81-82, 124-127, 194-196 | Non-injective path identity and rejection of documented blank `modify` alignment rows | BLOCKER | Valid JSON/config differences cannot be shown. |
| `web/src/history/useProgressiveHistoryCounts.ts` | 107-109 | Selected explicit retry is excluded from every request owner | BLOCKER | A selected failed row remains terminal despite its Retry control. |
| `test/web/history-workspace.test.tsx` | 216-254 | Does not prove selected queued priority or a successful explicit retry | WARNING | Regression suite misses the shipped recovery failure. |
| Phase 5 reviewed source | — | `TBD`/`FIXME`/`XXX` debt markers | None | No unresolved debt marker found. |

## Human Verification Required After Gap Closure

1. **Long-history visual and keyboard flow**
   - **Test:** Browse a long multi-date history in light/dark and narrow/wide layouts; select rows, use dialog keyboard controls, and inspect wrapped paths/values.
   - **Expected:** All rows remain identifiable and readable, selection/focus is visible, and dialog focus traps/returns correctly.
   - **Why human:** Visual readability, contrast, and responsive interaction require a running browser.

2. **Negative safety flows**
   - **Test:** With a dirty draft, enter History, attempt restore, then choose each draft option; inspect a secret-bearing snapshot/current difference.
   - **Expected:** Draft is never silently lost, restore outcome remains truthful/recoverable, and no secret appears in UI or notices.
   - **Why human:** End-to-end UX and absence across rendered surfaces are not fully established by source inspection.

## Gaps Summary

Plans 05-07 and 05-08 fixed the two *mechanical* deficiencies identified in the prior verification: the application now consumes a named `json-diff-kit` result, and it now has a bounded progressive loader rather than selected-only counts. Those changes are substantive, not stubs.

They do not achieve the Phase 5 goal for valid configurations and recovery flows. The comparison adapter fails on ordinary container/scalar replacements and legal object-key spellings, meaning a user cannot inspect every past snapshot against the current file. Separately, an exhausted row displays a Retry affordance that cannot recover when it is selected. Both prevent SAVE-05 and therefore block declaring the phase goal achieved. Fix the three concrete remediation items in frontmatter, add the missing real-Differ and retry integration regressions, then re-verify.

---

_Verified: 2026-07-19T19:35:00Z_
_Verifier: Claude (gsd-verifier)_
