---
phase: 01-schema-foundation-data-layer-safety
verified: 2026-07-12T11:54:44Z
status: passed
score: 5/5 must-haves verified (presence + wiring), 1 behavior-unverified
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:

  - truth: "Killing the write process mid-save never leaves config.json truncated or corrupted on Windows — always fully old or fully new content (success criterion #4 / SAVE-02)."
    test: "Run `node test/stress/kill-mid-save.mjs 60` (or higher) and inspect the per-iteration outcome tally, not just the final pass/fail exit code."
    expected: "A genuine sample of iterations should land the SIGKILL during or immediately after the write-file-atomic rename, producing a mix of 'old' and 'new' outcomes — proving the file transitions atomically across the actual risk window."
    why_human: "The harness's own file-shape assertion (JSON.parse succeeds and deep-equals exactly old or new) cannot distinguish 'the kill landed before any write activity started' from 'the kill landed mid-write and the atomic rename protected us' — both produce an identical 'old' result. Across 60 real iterations run on this Windows machine during this verification (2x30/20/40 batches), 100% of outcomes were 'old' and 0% were 'new', meaning every single kill landed before the child's lock-acquire+stringify+write+fsync+rename sequence got anywhere near completion. This was already flagged as a known limitation in 01-06-SUMMARY.md's 'Issues Encountered' section. The literal per-iteration criterion still passes (no corruption ever observed), but the strongest form of success criterion #4 — that the rename-boundary transition itself is atomic under a real interrupting kill — has not yet been empirically exercised by this harness's current 0-5ms timing window on this machine. A human should decide whether to (a) accept the passing-but-narrow evidence as sufficient (the underlying write-file-atomic temp+fsync+rename pattern plus the fault-injection-tested EPERM/EBUSY/EACCES retry wrapper already give strong independent assurance), or (b) widen/recalibrate the kill-delay window (e.g. instrument writeWithRetry with a test-only synchronization hook, or increase payload size / delay range) so a mix of old/new outcomes is actually observed before signing off this criterion."
---

# Phase 1: Schema Foundation & Data-Layer Safety Verification Report

**Phase Goal:** The bundled canonical schema and safe read/write data layer exist, so any config file can be loaded with layered effective values and saved without ever losing data or corrupting the file.
**Verified:** 2026-07-12T11:54:44Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Loading a fixture config.json containing fabricated unknown keys and performing a no-op save round-trips with 100% key/value fidelity — nothing dropped, reordered, or altered. | ✓ VERIFIED | `npx vitest run test/config-io/round-trip-identity.test.ts` — 4/4 tests pass, exercised end-to-end through the REAL Ajv validator (`createValidator(buildAjvSchema(bundledSchema))`), not a stub. Test A: fabricated-unknown fixture — `after.unknown` deep-equals `before.unknown`, `after.raw.project` deep-equals `before.raw.project`. Test B: real `project-config.json` (incl. `gates.*`/`safety.*` drift keys) round-trips identically. Test C: V8 integer-like-string-key ordering asserted explicitly. Committed fixtures confirmed byte-unchanged after the run. |
| 2 | Every documented gsd-core config chapter/key has a corresponding entry (keys, types, options, defaults) in the bundled schema, verified against a real gsd-core config.json with zero missing keys. | ✓ VERIFIED | `npx vitest run test/schema-data/completeness.test.ts` — 7/7 tests pass. Test reads the REAL, installed gsd-core sources at `~/.claude/gsd-core/bin/shared/config-schema.manifest.json`, `capability-registry.cjs`, `config-defaults.manifest.json` (all confirmed present on disk) plus the three real fixture files, and asserts zero undocumented unknown leaves. `bundled-schema.json` regenerates deterministically (`npm run build:schema` produces byte-identical output on a second run) — 158 keys, every key has non-empty `x-description`/`x-category`, `gates.*`/`safety.*` tagged `x-provenance: fixture-observed`. |
| 3 | Saving a config that fails schema validation is blocked with clear, field-level errors, and no partial write occurs. | ✓ VERIFIED | `npx vitest run test/config-io/atomic-write.test.ts` — proves `writeFileAtomic` is NOT called when validation fails and the on-disk file is byte-unchanged; `ValidationError` carries field-level Ajv errors; advisory lock is released on the validation-failure path. `validate.ts` uses `ajv/dist/2020` (2020-12, not draft-07), keeps `additionalProperties` open everywhere (unknown/future keys never block a save — tested), and `formatErrors` never leaks secret-shaped values (tested). |
| 4 | Killing the write process mid-save never leaves config.json truncated or corrupted on Windows — the file is always fully the old content or fully the new content, verified by repeated kill-mid-save testing. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Harness exists (`test/stress/kill-mid-save.mjs`), is wired to the real `saveConfig()` pipeline (not a mock), and passes its own literal per-iteration criterion with 0 failures across 60 real SIGKILL iterations run during this verification on this Windows machine. **However, 100% of the 60 outcomes were "old" — never "new"** — meaning every kill landed before the write pipeline (lock-acquire → stringify → write-file-atomic temp-write → fsync → rename) got anywhere close to completing. The harness has therefore never actually captured a kill during or immediately after the atomic rename, so the strongest form of this criterion (the rename-boundary transition itself proven atomic under a real interrupt) remains behaviorally unexercised. See `behavior_unverified_items` above and Human Verification below. |
| 5 | Loading a project config resolves effective values by merging canonical schema defaults with the global `~/.gsd/defaults.json` layer and the project's config.json, with each value traceable to the layer that supplied it. | ✓ VERIFIED | `npx vitest run test/config-io/discovery.test.ts test/config-io/merge.test.ts test/config-io/load.test.ts` — all pass. `resolveGlobalDefaultsPath()` replicates gsd-core's own `GSD_HOME \|\| os.homedir()` + `.gsd/defaults.json` algorithm exactly (matches `config-loader.cjs`). `resolveLeaf()`/`buildEffectiveTree()` produce correct project>global>canonical provenance for every layer combination, tested against inline layers and the real fixtures. `load()` composes both into `LoadResult.effective` with per-leaf `from` tags, verified for `project` and `canonical` provenance on a real fixture. |

**Score:** 5/5 truths present, wired, and (for 4/5) behaviorally proven; 1/5 (#4) present + wired but behaviorally unexercised at the specific rename-boundary the criterion names.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` | Pinned scaffold | ✓ VERIFIED | Exact-pinned deps confirmed (`ajv@8.20.0`, `ajv-formats@3.0.1`, `write-file-atomic@7.0.1`, `proper-lockfile@4.1.2`, no `^`/`~`); `engines.node: >=20.19`; `npx tsc --noEmit` exits 0; `npx vitest run` exits 0 (61/61 tests). |
| `packages/config-io/src/types.ts` | Frozen contracts | ✓ VERIFIED | Compiles; `LoadResult`, `EffectiveNode`, `UnknownKeyEntry`, `Provenance`, `ValidationResult`, `SchemaEntry` present and consumed by every downstream module. |
| `test/fixtures/*.json` (5 files) | Real + fabricated fixtures | ✓ VERIFIED | All 5 parse; `project-config.json` byte-identical to `.planning/config.json`; fabricated fixture carries both `x_gsdcm_test_future_key` and `workflow.x_test_unknown_toggle`. |
| `packages/schema-data/bundled-schema.json` + `build-schema.ts` + `curated-docs.json` | Reconciled canonical schema | ✓ VERIFIED | 158 keys; regenerates byte-identically; `commit_docs`/`planning.commit_docs` and `model_overrides`/`model_profile_overrides` modeled as distinct keys; `gates.*`/`safety.*` present and tagged `fixture-observed`; every key has `x-description`+`x-category`. |
| `packages/config-io/src/validate.ts`, `patch.ts` | Ajv validator + safe patch | ✓ VERIFIED | `ajv/dist/2020` import confirmed; `safeSet` rejects `__proto__`/`constructor`/`prototype` (tested, no global pollution). |
| `packages/config-io/src/discovery.ts`, `merge.ts` | DISC-06 + provenance merge | ✓ VERIFIED | Pure, schema-agnostic, tested against inline layers and real fixtures. |
| `packages/config-io/src/known-keys.ts`, `load.ts` | Known-key classifier + load() | ✓ VERIFIED | `isKnownKey` correctly classifies exact/dynamic-pattern/fixture-observed keys as known and fabricated future keys as unknown; `load()` never mutates `raw.project`. |
| `packages/config-io/src/atomic-write.ts` | Corruption-proof write pipeline | ✓ VERIFIED (unit level) / ⚠️ see truth #4 | Lock→validate-block→writeWithRetry→unlock implemented exactly per design; fault-injection tests (mocked EPERM/EBUSY/EACCES) pass; real-process kill harness passes its literal criterion but is behaviorally narrow (see above). |
| `test/stress/kill-mid-save.mjs` | Kill-mid-save stress harness | ⚠️ ORPHANED-EVIDENCE | File exists, is wired to the real pipeline, runs, exits 0 — but see behavior-unverified note; the harness's evidentiary strength for the specific rename-boundary claim is weaker than the roadmap language implies. |
| `packages/config-io/src/index.ts` | Frozen public API barrel | ✓ VERIFIED | Re-exports `load`, `saveConfig`, `writeWithRetry`, `ValidationError`, `createValidator`, `formatErrors`, `buildAjvSchema`, `safeSet`, `resolveGlobalDefaultsPath`, `readGlobalDefaults`, `resolveLeaf`, `buildEffectiveTree`, all contract types. Import-only, no logic. `npx tsc --noEmit` clean. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `round-trip-identity.test.ts` | `createValidator`/`buildAjvSchema` | real `bundled-schema.json` compiled through Ajv | ✓ WIRED | Confirmed via source read: imports `buildAjvSchema`, `createValidator`, loads `packages/schema-data/bundled-schema.json` directly (not a mock). |
| `atomic-write.ts` (`saveConfig`) | `validate.ts` (`createValidator`-produced closure) | dependency injection | ✓ WIRED | `validate` param typed `(data: unknown) => ValidationResult`; unit tests exercise both pass/fail paths. |
| `load.ts` | `discovery.ts`, `merge.ts`, `known-keys.ts`, `patch.ts` | direct imports | ✓ WIRED | Confirmed via source read (`import { readGlobalDefaults, resolveGlobalDefaultsPath } from './discovery.js'` etc.). |
| `index.ts` | all config-io modules | re-export barrel | ✓ WIRED | Confirmed via source read — all expected symbols exported. |
| `bundled-schema.json` | `known-keys.ts` / `load.ts` | flat dot-path classification | ✓ WIRED | `isKnownKey` tested against the real schema for exact, dynamic-pattern, and fixture-observed keys. |

### Behavioral Spot-Checks / Full Test Run

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite | `npx vitest run` | 8 files, 61 tests, all pass | ✓ PASS |
| Typecheck | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Schema regeneration determinism | `npm run build:schema` (run twice, diffed) | byte-identical output | ✓ PASS |
| Kill-mid-save stress harness | `node test/stress/kill-mid-save.mjs 20` then `40` (60 total, this session) | 60/60 "OK", 0/60 "new" outcome | ⚠️ PASS-BUT-NARROW (see truth #4) |
| Live gsd-core source presence | `ls ~/.claude/gsd-core/bin/{shared,lib}/*` | all 4 reconciliation sources present | ✓ PASS |
| Fixture-to-source byte identity | `diff .planning/config.json test/fixtures/project-config.json` | identical | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SCHEMA-01 | 01-02 | Bundled curated canonical schema covering every gsd-core config chapter | ✓ SATISFIED | completeness.test.ts (7/7), 158-key deterministic schema |
| DISC-06 | 01-04, 01-05 | Locates and loads applicable global `~/.gsd/defaults.json` | ✓ SATISFIED | discovery.test.ts, load.test.ts |
| SAVE-01 | 01-03, 01-06 | Every save validates before writing, blocking invalid writes | ✓ SATISFIED | validate.test.ts, atomic-write.test.ts |
| SAVE-02 | 01-06 | Atomic writes with Windows lock/permission retry, crash never corrupts | ⚠️ SATISFIED-WITH-CAVEAT | atomic-write.test.ts fault injection passes; kill-mid-save.mjs passes but narrowly (see truth #4) |
| SAVE-03 | 01-01, 01-04, 01-05, 01-07 | Preserves full original document incl. unknown/future keys, patch-in-place | ✓ SATISFIED | round-trip-identity.test.ts (4/4) |

No orphaned requirements: all 5 phase requirement IDs declared in ROADMAP.md (SCHEMA-01, DISC-06, SAVE-01, SAVE-02, SAVE-03) are claimed by at least one plan's frontmatter, and REQUIREMENTS.md's traceability table marks all 5 "Complete" under Phase 1 — consistent with plan declarations.

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` across `packages/` and `test/` (excluding `node_modules`) returned zero matches. Grep for stub-shaped `return null|return {}|return []|=> {}` in non-test source files returned zero matches.

### Human Verification Required

#### 1. Kill-mid-save atomicity — rename-boundary coverage

**Test:** Run `node test/stress/kill-mid-save.mjs 60` (or more) several times and inspect the per-iteration "old"/"new" tally printed to stdout, not just the final exit code.
**Expected:** At least some iterations should show `OK (file is fully "new")`, proving the harness actually lands kills during/after the write-file-atomic rename and that the file transitions atomically across that boundary.
**Why human:** This verification session ran the harness for 60 real SIGKILL iterations on the actual Windows machine and observed 100% "old" outcomes — the harness's 0-5ms post-marker kill-delay window never captures the write in flight on this machine's current lock-acquire+stringify+write+fsync+rename timing profile (a limitation already self-reported in 01-06-SUMMARY.md's "Issues Encountered"). The literal per-iteration safety assertion (parseable, matches old-or-new) still holds with zero corruption across all 60 trials, and the underlying mechanism (write-file-atomic's temp+fsync+rename pattern, independently fault-injection-tested for the Windows-specific EPERM/EBUSY/EACCES retry wrapper) provides real independent assurance. But the roadmap's literal success criterion #4 language ("verified by repeated kill-mid-save testing") implies the mid-write/rename-boundary scenario itself is exercised, and that specific claim is not yet empirically substantiated by any run observed so far. A human should decide whether the current evidence (passing-but-narrow harness + independently-tested atomic-write library + fault-injected retry wrapper) is sufficient to close this criterion, or whether the harness's timing calibration should be widened/instrumented before Phase 1 is considered fully gated.

### Gaps Summary

No hard gaps (nothing FAILED, no artifact MISSING/STUB, no key link NOT_WIRED, no debt markers, no orphaned requirements). All 61 automated tests pass, `tsc --noEmit` is clean, the bundled schema regenerates deterministically against the real installed gsd-core sources, and 4 of 5 roadmap success criteria are both present/wired AND behaviorally proven by passing tests that exercise the real end-to-end pipeline (not stubs).

The one open item is criterion #4 (kill-mid-save atomicity): the stress harness exists, is wired to the real save pipeline, and passes its own literal assertion with zero corruption across 60 real-world iterations run during this verification — but every single outcome landed pre-write ("old"), so the harness has not yet demonstrated the specific rename-boundary transition the roadmap language names. This is a verification-strength gap, not a demonstrated code defect (the underlying atomic-write mechanism and its Windows retry wrapper are independently unit-tested via fault injection). Routed to human verification per the decision tree rather than either a hard fail or a silent pass.

---

*Verified: 2026-07-12T11:54:44Z*
*Verifier: Claude (gsd-verifier)*
