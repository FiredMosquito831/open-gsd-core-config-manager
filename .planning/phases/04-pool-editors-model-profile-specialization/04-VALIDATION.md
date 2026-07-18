---
phase: 4
slug: pool-editors-model-profile-specialization
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-18
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 + Testing Library React + jsdom |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run test/web --reporter=dot` |
| **Full suite command** | `npm test && npm run typecheck` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the focused `npx vitest run <affected test files> --reporter=dot` command.
- **After every plan wave:** Run `npx vitest run test/web --reporter=dot`.
- **Before `/gsd-verify-work`:** `npm test && npm run typecheck` must be green.
- **Max feedback latency:** 60 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | POOL-01, POOL-02, POOL-03 | T-04-01 | Guided pools preserve drafts, restrict agent/value choices, and block invalid saves. | unit/component | `npx vitest run test/web/pool-editor.test.tsx test/web/structured-pool-editor.test.tsx test/web/agent-value-map-editor.test.tsx --reporter=dot` | ❌ Wave 0 | ⬜ pending |
| 04-02-01 | 02 | 2 | EDIT-03, SEC-03 | T-04-02 | Layer provenance is accurately represented; secret values remain masked and are never emitted to logs/errors/copy flows. | component/security | `npx vitest run test/web/layer-summary.test.tsx test/web/secret-field.test.tsx test/web/security-redaction.test.ts --reporter=dot` | ❌ Wave 0 | ⬜ pending |
| 04-03-01 | 03 | 3 | PROF-01, PROF-02, PROF-03, PROF-04 | T-04-03 | Profile edits use the safe save pipeline; install notices reveal only setting names and are shown only when required. | component/integration | `npx vitest run test/web/profile-cards.test.tsx test/web/profile-editor.test.tsx test/web/profile-create.test.tsx test/web/runtime-install-notice.test.tsx --reporter=dot` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/web/pool-editor.test.tsx`, `test/web/structured-pool-editor.test.tsx`, and `test/web/agent-value-map-editor.test.tsx` — fixtures and guided pool coverage.
- [ ] `test/web/layer-summary.test.tsx` and `test/web/specialized-draft.test.tsx` — effective-layer and project-override coverage.
- [ ] `test/web/secret-field.test.tsx` and `test/web/security-redaction.test.ts` — sentinel-secret masking, blur/timer re-masking, error/log/clipboard protection.
- [ ] `test/web/profile-cards.test.tsx`, `test/web/profile-editor.test.tsx`, `test/web/profile-create.test.tsx`, and `test/web/runtime-install-notice.test.tsx` — profile and install-notice behavior.
- [ ] Shared fixtures for structured pools, agent maps, profiles, inherited layers, unsupported entries, and secret-shaped fields.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Responsive focused workspace | POOL-01, PROF-01 | jsdom does not fully verify visual wrapping and no-clipping behavior. | Inspect the focused workspace at desktop width and below 900px; confirm Back/save actions remain available, list/detail stack correctly, and long layer values retain their effective-source marker. |
| Runtime-specific installation requirement | PROF-04 | The applicable Codex/OpenCode runtime matrix depends on installed runtime state. | Save a documented runtime-baked setting for each supported runtime and confirm a persistent notice names the setting and shows `gsd install`; save an unrelated setting and confirm no notice appears. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
