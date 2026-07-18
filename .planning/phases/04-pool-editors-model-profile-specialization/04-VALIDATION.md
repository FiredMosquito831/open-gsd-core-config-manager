---
phase: 4
slug: pool-editors-model-profile-specialization
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-18
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Phase 4 has no separate Wave 0: Plan 04-01 is Wave 1 and creates confirmed source fixtures plus the catalog-evidence suite. Every later task consumes its tests created by Plan 04-01, so no task uses MISSING/Wave-0 verification framing.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 + Testing Library React + jsdom |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run test/web --reporter=dot` |
| Full suite command | `npm test && npm run typecheck` |
| Estimated runtime | under 60 seconds |

## Sampling Rate

- After every task commit, run the task command below.
- After Wave 1, run catalog evidence plus the existing web suite; after Waves 2–5 run `npx vitest run test/web --reporter=dot`.
- Before `/gsd-verify-work`, run `npm test && npm run typecheck`.
- Maximum automated feedback latency: 60 seconds.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirements | Threat / ASVS Controls | Direct Automated Command | Verification Focus | Status |
|---|---:|---:|---|---|---|---|---|
| 04-01-01 | 01 | 1 | SEC-03, EDIT-03, POOL-01, POOL-02, POOL-03, PROF-01, PROF-02, PROF-03, PROF-04 | T-04-01; ASVS-04-01-V5/V7 | `node test/scripts/verify-phase4-source-evidence.mjs --verify-only` | Mandatory first gate: query official `next` ref, require SHA `50efae13ce74f02a5b0253ce0c205c5eac2a99e3`, download/inspect all five immutable paths, validate anchors/content, profile order, 33-agent catalog, per-descriptor references, persistence decision, and complete runtime-matrix input before any fixture exists. | pending |
| 04-01-02 | 01 | 1 | SEC-03, EDIT-03, POOL-01, POOL-02, POOL-03, PROF-01, PROF-02, PROF-03, PROF-04 | T-04-01, T-04-02; ASVS-04-01-V5/V7/V8 | `node test/scripts/verify-phase4-source-evidence.mjs --verify-artifact test/fixtures/phase4-gsd-core-source-evidence.json && node -e "const x=require('./test/fixtures/phase4-gsd-core-catalog.json'); if(x.source?.revision!=='50efae13ce74f02a5b0253ce0c205c5eac2a99e3'||!x.evidenceRefs?.length||!x.runtimeInstallMatrix?.length||!x.profilePersistenceShape||!x.descriptors||!Array.isArray(x.unsupported)) process.exit(1)"` | Evidence artifact first, then fixtures traceably derived from it: revision/date/references, profile persistence shape, descriptors, runtime matrix, unsupported list. | pending |
| 04-01-03 | 01 | 1 | SEC-03, EDIT-03, POOL-01, POOL-02, POOL-03, PROF-01, PROF-02, PROF-03, PROF-04 | T-04-01, T-04-02; ASVS-04-01-V5/V7/V8 | `node test/scripts/verify-phase4-source-evidence.mjs --verify-artifact test/fixtures/phase4-gsd-core-source-evidence.json && npx vitest run test/web/phase4-catalog-evidence.test.ts --reporter=dot` | Gate artifact integrity, catalog evidence, unsupported shapes, project-draft profile persistence, all runtime/path positive cases and unrelated/unsupported/near-miss negatives, sentinel-safe diagnostics/copy fixtures. | pending |
| 04-02-01 | 02 | 2 | EDIT-03, POOL-01, POOL-02, POOL-03, PROF-01, PROF-02, PROF-03, PROF-04, SEC-03 | T-04-04, T-04-05; ASVS-04-02-V4/V5/V7/V8 | `npx vitest run test/web/specialized-metadata.test.ts test/web/specialized-draft.test.ts --reporter=dot` | Evidence-derived descriptors, complete sensitive-path catalog, constrained catalogs, unsupported fallback, inherited project-only deep copy, forbidden paths, and value-free error mapping. | pending |
| 04-05-01 | 05 | 3 | SEC-03, EDIT-03 | T-04-06, T-04-14; ASVS-04-05-V3/V5/V7/V8 | `npx vitest run test/web/layer-summary.test.tsx test/web/secret-field.test.tsx test/web/security-redaction.test.ts --reporter=dot` | Layer provenance/effective marker; scope-copy explanation; reusable descriptor-compatible secret control with deliberate reveal, blur/timer remask, and no DOM/log/error/diagnostic/clipboard leak. | pending |
| 04-03-01 | 03 | 4 | EDIT-03, POOL-01 | T-04-07, T-04-13; ASVS-04-03-V4/V5/V13 | `npx vitest run test/web/pool-editor.test.tsx --reporter=dot` | Confirmed routing, Back retains draft, defaulted add/immediate select, move controls, named removal, ConfigEditor/SaveBar ownership. | pending |
| 04-03-02 | 03 | 4 | POOL-02, POOL-03, SEC-03 | T-04-07, T-04-08; ASVS-04-03-V5/V7/V8 | `npx vitest run test/web/structured-pool-editor.test.tsx test/web/agent-value-map-editor.test.tsx test/web/security-redaction.test.ts --reporter=dot` | Guided field controls, invalid selected/non-selected entries, safe full-candidate save block, restricted map pickers, unknown read-only preservation, and actual sensitive pool renderer mask/reveal/blur/timer/non-disclosure coverage. | pending |
| 04-03-03 | 03 | 4 | EDIT-03, POOL-01 | T-04-09; ASVS-04-03-V7 | `npx vitest run test/web/accessible-responsive-specialized.test.tsx test/web/pool-editor.test.tsx --reporter=dot` | Labeled regions, keyboard controls, 44px actions, 280px/flexible layout, sub-900px stack, long-value/provenance and all UI-SPEC states. | pending |
| 04-04-01 | 04 | 5 | PROF-01, PROF-02, PROF-03, EDIT-03, SEC-03 | T-04-10; ASVS-04-04-V4/V5/V7/V8 | `npx vitest run test/web/profile-cards.test.tsx test/web/profile-editor.test.tsx test/web/profile-create.test.tsx test/web/security-redaction.test.ts --reporter=dot` | Dedicated chapter/cards; copy-first unique profile creation; constrained assignments; actual sensitive profile renderer mask/reveal/blur/timer/non-disclosure coverage; normal project draft; validation/save block; long/state coverage. | pending |
| 04-04-02 | 04 | 5 | PROF-04, SEC-03, EDIT-03 | T-04-11, T-04-12; ASVS-04-04-V4/V7/V8/V13 | `npx vitest run test/web/runtime-install-notice.test.tsx test/web/editor-save.test.tsx test/web/security-redaction.test.ts --reporter=dot` | Each catalog runtime/path positive notice; unrelated/unsupported/near-miss no-notice; dismiss/load lifecycle; no changed/secret leakage; existing tokenized full-candidate safe save and unknown-key preservation. | pending |

## Dependency and Test-Creation Sequence

| Wave | Plan / Tasks | Tests Created or Extended | Dependency State |
|---:|---|---|---|
| 1 | 04-01-01, 04-01-02, 04-01-03 | Immutable retrieval/inspection gate and `phase4-gsd-core-source-evidence.json`, then catalog fixture, specialized config fixture, and `phase4-catalog-evidence.test.ts` | Source-confirmation-first: 04-01-01 blocks fixture/catalog creation; no separate Wave 0. |
| 2 | 04-02-01 | `specialized-metadata`, `specialized-draft` | Depends on the verified source artifact, source-confirmed fixtures, and catalog evidence; creates the sensitive descriptor-path catalog required by later renderers. |
| 3 | 04-05-01 | `layer-summary`, `secret-field`, `security-redaction` | Depends on metadata/effective helpers; can proceed in parallel with no pool/profile source-file overlap. |
| 4 | 04-03-01, 04-03-02, 04-03-03 | `pool-editor`, `structured-pool-editor`, `agent-value-map-editor`, `accessible-responsive-specialized` | Depends on metadata, draft, provenance, and secret primitives. |
| 5 | 04-04-01, 04-04-02 | `profile-cards`, `profile-editor`, `profile-create`, `runtime-install-notice`, `editor-save` extensions | Depends on focused workspace, shared editor primitives, and catalog runtime matrix. |

## ASVS Level 3 Security Verification

| Control Surface | Required Check | Automated Evidence | Manual Backstop |
|---|---|---|---|
| Input validation and unsafe path rejection | Only confirmed descriptors/choices mutate project draft; invalid entries block shared save. | 04-01-02, 04-02-01, 04-03-02 commands. | Inspect unsupported future children are visible/read-only. |
| Sensitive data | Sensitive descriptor catalog forces SecretField in actual pool/profile renderers; default masking, deliberate reveal, blur/timer re-mask, and no normal copy/log/error/diagnostic leak. | 04-02-01, 04-03-02, 04-04-01, and 04-04-02 commands. | Observe blur and timeout in both a real pool and a real profile editor interaction. |
| Access-control/save boundary | Specialized UI has no filesystem path/new route and uses existing opaque-id/token/origin-protected full-candidate save. | 04-03-01 and 04-04-02 commands. | Inspect network requests during a save: only existing config save endpoint is used. |
| Error handling | Validation/notice output remains path/static-label oriented, never candidate/server-error/secret echo. | 04-02-01, 04-04-02 commands. | Trigger an invalid field and visually inspect the rendered message. |
| Client assumptions/runtime notice | Notice comes from exact source-confirmed runtime/path predicates, not labels/server strings; all positive and near-miss cases are tested. | 04-01-02 and 04-04-02 commands. | For each documented installed runtime, perform a real save and confirm the notice condition. |

## Manual-Only Verifications

| Behavior | Requirements | Why Manual | Test Instructions |
|---|---|---|---|
| Responsive focused workspace | POOL-01, PROF-01, EDIT-03 | jsdom cannot prove real-browser wrapping, scroll behavior, and action reachability. | At desktop width and below 900px, verify list/detail stacking, Back and Save availability, independent list scroll, long paths/cards/notices wrapping, and expanded provenance retaining the effective marker. |
| Runtime-specific installation requirement | PROF-04 | Installed runtime state is external to jsdom; automated tests cover the metadata matrix. | For every catalog-documented runtime/path condition, save that setting and confirm the persistent named `gsd install` notice. Save an unrelated, unsupported-runtime, and near-miss path and confirm no notice. |
| Temporary secret visibility | SEC-03 | Browser focus and clipboard policies vary by runtime. | In both a sensitive pool field and a sensitive profile field, reveal the value, verify it masks on blur and inactivity, then inspect that ordinary copy actions/diagnostics do not expose it. |

## Validation Sign-Off

- [x] Every actual task has a direct `<automated>` command.
- [x] No task relies on nonexistent Wave-0/MISSING framing.
- [x] Every phase requirement maps to one or more actual tasks.
- [x] All ASVS Level 3 sensitive-surface controls map to executable checks, including actual pool/profile renderer paths.
- [x] Runtime matrix includes positive, negative, unsupported-runtime, and near-miss coverage.
- [ ] All task commands green after implementation.
- [ ] Manual responsive/runtime/secret checks completed.

**Approval:** validation strategy aligned to 04-01 through 04-04 task graph; implementation sign-off pending.
