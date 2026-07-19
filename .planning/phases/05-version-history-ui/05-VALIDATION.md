---
phase: 5
slug: version-history-ui
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-19
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 + React Testing Library 16.3.2 + jsdom 29.1.1 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run test/server/history-routes.test.ts test/web/history-workspace.test.tsx` |
| **Full suite command** | `npm test && npm run typecheck && npm run build` |
| **Estimated runtime** | Measure during Wave 0; maximum feedback latency target is 120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the targeted Vitest file(s) named by the task plus `npm run typecheck`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** `npm test && npm run typecheck && npm run build` must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-W0-01 | TBD | 0 | SAVE-05 | T-05-01, T-05-02, T-05-04 | Opaque config IDs and canonical sequence lookup prevent arbitrary or cross-config snapshot reads; existing API guards remain active | server integration/security | `npm test -- --run test/server/history-routes.test.ts test/server/snapshot-store.test.ts` | ❌ W0 | ⬜ pending |
| 05-W0-02 | TBD | 0 | SAVE-05 | T-05-05 | Structural Snapshot → Current diff masks sensitive historical values | unit + React integration | `npm test -- --run test/web/history-workspace.test.tsx` | ❌ W0 | ⬜ pending |
| 05-W0-03 | TBD | 0 | SAVE-06 | T-05-03, T-05-06 | Restore reuses validation, locking, current-state snapshot, and atomic write; pending controls prevent duplicate submission | server + React integration | `npm test -- --run test/server/history-routes.test.ts test/server/snapshot-store.test.ts test/web/history-workspace.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/server/history-routes.test.ts` — list/detail/restore envelopes, empty history, opaque-ID enforcement, tampered sequence/index rejection, cross-config isolation, validation, atomic write, and recovery snapshot coverage for SAVE-05/SAVE-06
- [ ] `test/web/history-workspace.test.tsx` — timeline grouping, diff orientation and summary, redaction, dirty-draft decisions, restore success/failure, query refresh, and keyboard dialog behavior
- [ ] `test/server/snapshot-store.test.ts` additions — trusted read-by-sequence behavior and canonical filename validation

---

## Manual-Only Verifications

All phase behaviors have automated verification planned. Final UAT should still inspect the history timeline, diff readability, focus handling, and restore notice in the running application.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
