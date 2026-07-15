---
phase: 3
slug: generic-schema-driven-ui-shell
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-15
---

# Phase 3 — Validation Strategy

> Per-phase validation contract derived from 03-RESEARCH.md and the six Phase 3 plans.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 with React Testing Library and jsdom |
| Config file | vitest.config.ts |
| Quick run command | npx vitest run test/web test/server --reporter=dot |
| Full suite command | npm test |

## Sampling Rate

- After every task commit: run the narrowest affected Vitest file or test name.
- After every plan wave: run npx vitest run test/web test/server.
- Before verify-work: run npm test, build the client/package, and perform manual checks.

## Per-Requirement Verification Map

| Requirement | Behavior | Test Type | Automated Command |
|-------------|----------|-----------|-------------------|
| SCHEMA-02, SCHEMA-03 | Field and enum documentation renders, with safe fallback for missing prose | component | npx vitest run test/web/schema-renderer.test.tsx |
| SCHEMA-04, EDIT-01 | Chapters and fields derive from schema without hand-coded key lists | unit/component | npx vitest run test/web/schema-index.test.ts test/web/schema-renderer.test.tsx |
| SCHEMA-06 | Unknown keys render read-only and survive save candidate round trips | unit/integration | npx vitest run test/web/unknown-keys.test.ts test/server/configs.test.ts |
| DISC-01..05 | Track, persist, relink/remove, scan/review, create, and load flows work through secured routes | server integration | npx vitest run test/server/registry-persistence.test.ts test/server/discovery.test.ts |
| EDIT-02, EDIT-04 | Provenance/reset and schema-restricted enum controls work without premature errors | component | npx vitest run test/web/field-controls.test.tsx |
| EDIT-05 | Search matches key/title/descriptions/options and navigates to highlighted fields | unit/component | npx vitest run test/web/search.test.tsx |
| EDIT-06 | Touched/blurred fields show live validation and invalid saves are blocked | component/integration | npx vitest run test/web/validation.test.tsx test/server/configs.test.ts |

## Wave 0 Requirements

- [ ] Install and verify audited React/Vite/RHF dependencies, with human checks for packages flagged as newly published.
- [ ] Add test/web setup, jsdom config, render helpers, and API fixtures.
- [ ] Add enum-option coverage tests and server fixtures for persistence, scan exclusions, missing files, and create-from-defaults.
- [ ] Add a client build assertion for the dist/client packaging contract.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|-----------|-------------------|
| Three-pane responsive workspace | EDIT-01, DISC-02 | Visual behavior | Run packaged client at desktop and narrow widths; verify both navigation panes collapse independently. |
| Documentation readability | SCHEMA-02, SCHEMA-03 | Human judgment | Inspect representative field cards and expanded enum implications. |
| End-to-end local launch | DISC-01..05 | Real launcher integration | Run packaged CLI, add/scan/create/relink configs, reload, and confirm ordered sidebar persistence. |

## Validation Sign-Off

- [x] Requirements map covers all 14 Phase 3 requirements.
- [x] Every plan task has automated verification or an explicit Wave 0 dependency.
- [x] No watch-mode flags are used.
- [x] nyquist_compliant true is set in frontmatter.

**Approval:** approved for checker rerun after artifact correction.
