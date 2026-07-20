---
phase: 6
slug: live-schema-reconcile-against-gsd-core
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-20
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:ordinary -- --run test/server/schema-route.test.ts test/schema-data/completeness.test.ts` |
| **Full suite command** | `npm test && npm run typecheck && npm run build && npm pack --dry-run` |
| **Estimated runtime** | To be measured during Wave 0 |

---

## Sampling Rate

- **After every task commit:** Run the focused Vitest file(s), plus `npm run typecheck` for contract changes
- **After every plan wave:** Run `npm run test:ordinary`
- **Before `/gsd-verify-work`:** `npm test && npm run typecheck && npm run build && npm pack --dry-run` must be green
- **Max feedback latency:** Focused tests should complete within 60 seconds; measure and revise in Wave 0

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | SCHEMA-05 | Remote source execution | Stable-release client rejects prerelease, draft, malformed, and tag-conflict responses without creating a proposal | unit | `npx vitest run test/server/schema-refresh.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | SCHEMA-05 | Archive traversal / resource exhaustion | Archive reader rejects traversal, links, duplicates, missing allowlist entries, cap violations, and timeouts without extracting files | unit/security | `npx vitest run test/server/upstream-archive.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | SCHEMA-05 | Remote code execution | Literal-only parser accepts supported registry data and rejects calls, spreads, computed keys, and identifier expressions | unit/security | `npx vitest run test/server/capability-registry-parser.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | SCHEMA-05 | Curated metadata loss | Reconciliation preserves curated fields, flags prose drift, retains removed keys as deprecated, and ignores ordering/format noise | unit | `npx vitest run test/schema-data/reconcile.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | SCHEMA-05 | Poisoned override persistence | Proposal compilation, atomic activation, corrupt override fallback, quarantine, and reset retain a usable bundled schema | integration | `npx vitest run test/server/schema-route.test.ts test/server/active-schema-manager.test.ts -x` | ⚠️ partial | ⬜ pending |
| 06-03-01 | 03 | 3 | SCHEMA-05 | Unauthorized activation / stale UI | Workspace shows source, version, date, review groups, no-op state, explicit activation, and reset | component | `npx vitest run test/web/schema-workspace.test.tsx -x` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 3 | SCHEMA-05 | Split schema generations | Activation updates schema rendering and server validation together | API/component integration | `npx vitest run test/server/schema-route.test.ts test/web/schema-workspace.test.tsx -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/server/schema-refresh.test.ts` — injected GitHub responses and deterministic lifecycle failures
- [ ] `test/server/upstream-archive.test.ts` — adversarial archive fixtures and hard-cap cases
- [ ] `test/server/capability-registry-parser.test.ts` — literal acceptance and prohibited-syntax rejection
- [ ] `test/schema-data/reconcile.test.ts` — curation, deprecation, and semantic-diff fixtures
- [ ] `test/server/active-schema-manager.test.ts` — persistence, compilation, version precedence, fallback, quarantine, and reset
- [ ] `test/web/schema-workspace.test.tsx` — staged UI, accessibility, status controls, and query invalidation
- [ ] `test/fixtures/schema-refresh/` — frozen valid and adversarial fixtures; ordinary tests must not call live GitHub

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual hierarchy and responsive clarity of the reconcile review workspace | SCHEMA-05 | Automated component tests cannot fully judge density, wrapping, or hierarchy | Launch the app at desktop and compact widths; trigger fixture-backed added/changed/deprecated/no-op proposals; confirm provenance and action states remain readable without clipping or overlap |
| Dependency legitimacy checkpoint for `tar@7.5.20`, if retained by the plan | SCHEMA-05 | Research returned a SUS legitimacy verdict requiring human approval | Review package provenance, current advisories, lockfile delta, and alternatives before installation; record approval or choose a dependency-free bounded parser strategy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s for focused checks
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
