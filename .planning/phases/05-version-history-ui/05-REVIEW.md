---
phase: 05-version-history-ui
reviewed: 2026-07-19T19:20:00Z
depth: deep
files_reviewed: 7
files_reviewed_list:
  - web/src/history/compare.ts
  - web/src/history/useProgressiveHistoryCounts.ts
  - web/src/components/history/HistoryWorkspace.tsx
  - web/src/components/history/SnapshotTimeline.tsx
  - test/web/history-comparison.test.ts
  - test/web/history-workspace.test.tsx
  - web/src/api/configs.ts
findings:
  critical: 3
  warning: 1
  info: 0
  total: 4
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-07-19T19:20:00Z
**Depth:** deep
**Files Reviewed:** 7
**Status:** issues_found

## Summary

The Phase 5 gap-closure implementation was reviewed at deep depth, including the comparison adapter, progressive TanStack Query scheduler, React workspace/timeline integration, API wrappers, and focused tests. The focused history suites pass, but valid json-diff-kit streams and an explicit Retry path can leave comparisons unavailable or permanently failed. The path encoding also cannot represent all valid JSON object keys without collisions.

## Critical Issues

### CR-01: Valid container-to-scalar comparisons are rejected as malformed

**File:** `web/src/history/compare.ts:124-127`

**Issue:** The adapter treats every blank stream row as an alignment placeholder only when its type is `equal`. Real `json-diff-kit` output for a valid replacement of an object/array with a scalar includes blank `modify` rows on the scalar side. For example, `{ "x": { "a": 1 } }` → `{ "x": 2 }` emits a `modify` container and its child/close rows in one stream, with `modify` blanks in the other. `parseStream()` throws `History comparison unavailable` at line 124 rather than rendering the change. Users therefore cannot inspect or restore-review a legitimate persisted config difference.

**Evidence:** Direct inspection of `new Differ({ showModifications: true, arrayDiffMethod: 'lcs' }).diff({ x: { a: 1 } }, { x: 2 })` shows the second stream includes `{ level: 1, type: 'modify', text: '' }` alignment rows. The production parser rejects that row before it can adapt the tuple.

**Fix:** Model documented blank `modify` alignment rows as structural counterparts to a modified container, with strict level/context validation. Do not treat them as scalar members or increment array positions unless the library semantics require it. Add real-Differ integration cases for object-to-scalar, scalar-to-object, array-to-scalar, and scalar-to-array replacements.

### CR-02: A selected terminal-error row cannot be retried from its timeline control

**File:** `web/src/history/useProgressiveHistoryCounts.ts:107-109, 119-127`

**Issue:** `retry()` starts a new effect generation, but the effect deliberately refuses to place `retryNow` into its queue when that sequence is selected (`retryNow !== selectedSeq`). The row Retry UI calls only this hook callback; it does not call the separately-owned selected-detail query's `refetch()`. Thus, after a row reaches terminal error, selecting that same row and pressing its accessible timeline Retry leaves it terminal forever even when the next detail request would succeed.

**Fix:** Make row retry start the selected detail query when the target is selected, or enqueue that retry under the same bounded scheduler instead of excluding it. Preserve one owner per request/key to avoid duplicate work. Add an integration test that exhausts a row, selects it, activates timeline Retry, resolves the next request, and asserts the error becomes the exact count.

### CR-03: Dot/bracket path construction collides for valid object keys

**File:** `web/src/history/compare.ts:80, 193-195`

**Issue:** `joinPath()` concatenates raw object keys with `.` and raw array positions with brackets, then uses the resulting string as the unique map key. JSON permits keys containing dots, brackets, quotes, and numeric-looking fragments. `{ "a.b": 1, "a": { "b": 2 } }` produces `a.b` for two different leaves; `{ "agents[0]": 1, "agents": [2] }` likewise collides. The duplicate-path guard throws, so valid documents fail comparison. Even where a collision does not trigger, the UI path cannot faithfully identify the changed key.

**Fix:** Use an injective internal identity such as RFC 6901 JSON Pointer segments, and independently render escaped display labels. If retaining dot notation, quote/escape every non-identifier object key and escape brackets/backslashes. Add tests covering dotted keys, bracket-containing keys, quoted keys, and collisions with nested and array paths.

## Warnings

### WR-01: Priority and retry lifecycle contracts are not actually covered by the focused tests

**File:** `test/web/history-workspace.test.tsx:215-253`

**Issue:** The selected-priority test clicks Snapshot #5 only after the scheduler has had an opportunity to start it as ordinary background work, so `deferred.has(5)` does not prove a newly selected, previously queued sequence starts immediately while two other background requests occupy the limit. The retry test proves exhaustion only; it never activates Retry and verifies a successful fresh group. The required stale completion/list replacement/backoff cancellation cases are also absent. These gaps allowed CR-02 to ship.

**Fix:** Hold two known nonselected detail requests in flight, keep a third sequence queued, select that queued sequence, and assert its selected query begins before either background promise resolves. Add tests for explicit retry success, cache reselection without duplicate calls, list/config replacement during backoff, and late completion rejection.

---

_Reviewed: 2026-07-19T19:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
