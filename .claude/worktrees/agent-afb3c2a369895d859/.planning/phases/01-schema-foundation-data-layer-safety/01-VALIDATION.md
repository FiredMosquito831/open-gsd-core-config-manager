---
phase: 1
slug: schema-foundation-data-layer-safety
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-12
approved: 2026-07-12
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `01-RESEARCH.md` § Validation Architecture. Task IDs are assigned by the planner; rows below are keyed by requirement.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (locked by CLAUDE.md; not yet installed — Wave 0 gap) |
| **Config file** | none yet — `vitest.config.ts` created in Wave 0 |
| **Quick run command** | `npx vitest run test/config-io --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5–10s unit tier (kill-mid-save stress harness runs separately, not in default `vitest run`) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run test/config-io --reporter=dot` (fast unit tier; excludes the real-process kill-loop stress test)
- **After every plan wave:** Run `npx vitest run` (full suite: round-trip-identity + schema-completeness)
- **Before `/gsd-verify-work` (phase gate):** Full suite green **plus** at least one scripted run of the kill-mid-save stress harness on the actual Windows target
- **Max feedback latency:** ~10 seconds (unit tier)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-02-03 | 01-02 | 2 | SCHEMA-01 | ReDoS (patternProperties) | Bundled schema recognizes every real fixture leaf key with ZERO missing, after reconciling all 4 sources (manifest `validKeys` + `config-schema.cjs` + `capability-registry.cjs` configSchema + `config-defaults.manifest.json`); `gates.*`/`safety.*` INCLUDED as `x-provenance: fixture-observed` (NOT allowlisted away) | unit (completeness diff) | `npx vitest run test/schema-data/completeness.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-01 | 01-04 | 2 | DISC-06 | — | `load()` locates `~/.gsd/defaults.json` via `GSD_HOME \|\| os.homedir()` and merges it as the `'global'` layer | unit | `npx vitest run test/config-io/discovery.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-01 | 01-03 | 2 | SAVE-01 | input-validation + secret-in-logs | `validate()` blocks a structurally-invalid document with field-level Ajv errors; `saveConfig()` never calls `writeFileAtomic` when validation fails; `formatErrors` logs only `instancePath`/keyword, never secret-shaped values | unit | `npx vitest run test/config-io/validate.test.ts` | ❌ W0 | ⬜ pending |
| 01-06-01 | 01-06 | 3 | SAVE-02, SAVE-01 | atomic-write | Mocked `EPERM`/`EBUSY` fault injection never leaves a truncated/corrupt file; Windows retry-with-backoff wraps `write-file-atomic@7`; validation blocks before any write | unit (fault injection) | `npx vitest run test/config-io/atomic-write.test.ts` | ❌ W0 | ⬜ pending |
| 01-06-02 | 01-06 | 3 | SAVE-02 | atomic-write | Real spawn+`SIGKILL` stress loop: `config.json` always fully-parseable old-or-new content after each kill (criterion #4, Windows target) | stress (standalone) | `node test/stress/kill-mid-save.mjs` | ❌ W0 | ⬜ pending |
| 01-07-02 | 01-07 | 4 | SAVE-03 | key-drop | No-op load→save round-trip preserves every key (incl. fabricated structurally-novel unknown keys) and key order; patch-in-place of the original parsed object, never a schema-reconstructed rebuild | integration | `npx vitest run test/config-io/round-trip-identity.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-02 | 01-04 | 2 | SAVE-03 (provenance) | — | `EffectiveTree` tags `from: 'canonical' \| 'global' \| 'project'` per 3-layer precedence, for keys present at each layer combination | unit | `npx vitest run test/config-io/merge.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` + `tsconfig.json` + `vitest.config.ts` — no Node project scaffold exists yet in this repo
- [ ] `npm install -D vitest @types/node @types/proper-lockfile` — framework + types not installed
- [ ] `test/fixtures/*.json` — copies of the three real files (`.planning/config.json`, `~/.gsd/defaults.json`, `~/.gsd/defaults - claude api.json`) **plus** a fourth derived fixture with deliberately fabricated, structurally-novel unknown keys injected (e.g. top-level `x_gsdcm_test_future_key` + nested `workflow.x_test_unknown_toggle`) to exercise the genuinely-unrecognized-key passthrough path that success criterion #1 requires
- [ ] `test/schema-data/completeness.test.ts` — the flatten-and-diff completeness check (prototyped in research) checked in as a permanent test
- [ ] `test/stress/kill-mid-save.mjs` — standalone script (not part of default `vitest run`) that spawns a child doing repeated saves, `SIGKILL`s it mid-write N times, asserts the file is always fully-parseable old-or-new content

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Kill-mid-save atomicity on the real Windows target | SAVE-02 | Repeatedly spawning + `SIGKILL`ing child processes is slow and platform-sensitive; not suitable for the default per-commit unit tier | Run `node test/stress/kill-mid-save.mjs` on Windows before the phase gate; confirm every kill leaves `config.json` fully old-or-new content (parseable, no truncation) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plan 01-01 scaffolds package.json/tsconfig/vitest.config.ts + fixtures)
- [x] No watch-mode flags
- [x] Feedback latency < 10s (unit tier)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-12 (gsd-plan-checker verified every task carries an automated verify; sampling continuity holds)
