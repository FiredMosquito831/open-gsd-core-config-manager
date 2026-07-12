---
status: testing
phase: 01-schema-foundation-data-layer-safety
source: [01-VERIFICATION.md]
started: 2026-07-12T11:56:35Z
updated: 2026-07-12T11:56:35Z
---

## Current Test

number: 1
name: Kill-mid-save atomicity — rename-boundary coverage
expected: |
  Running `node test/stress/kill-mid-save.mjs 60` (or higher) yields a genuine mix of
  "old" and "new" per-iteration outcomes — proving a real SIGKILL lands during or
  immediately after the write-file-atomic rename and the file still transitions atomically
  (never truncated/corrupted). Zero corrupted reads across all iterations.
awaiting: user response

## Tests

### 1. Kill-mid-save atomicity — rename-boundary coverage
expected: |
  The stress harness must actually exercise the rename-boundary risk window, not just the
  trivial "kill before any write started" case. Across the current 0-5ms kill-delay window,
  100% of 60 real iterations on this Windows machine resulted in "old" and 0% "new", so the
  strongest form of success criterion #4 (SAVE-02) — atomic transition proven under an
  interrupting kill at the rename boundary — has not yet been empirically observed.

  Human decision required:
  (a) Accept the passing-but-narrow evidence as sufficient — the underlying
      write-file-atomic temp+fsync+rename pattern plus the fault-injection-tested
      EPERM/EBUSY/EACCES retry wrapper already give strong independent assurance; OR
  (b) Widen/recalibrate the kill-delay window (e.g. instrument `writeWithRetry` with a
      test-only synchronization hook, increase payload size, or widen the delay range) so a
      genuine mix of old/new outcomes is observed before signing off this criterion.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
