# Phase 1: Schema Foundation & Data-Layer Safety - Research

**Researched:** 2026-07-12
**Domain:** Bundled JSON-Schema descriptor + safe layered-config read/write data layer for `gsd-core`'s `.planning/config.json`
**Confidence:** MEDIUM-HIGH (stack/atomic-write mechanics: HIGH, directly verified against npm registry + library source + GitHub issue trackers; gsd-core schema completeness: HIGH for structure, MEDIUM for a few unresolved chapter-ownership questions flagged below as genuinely ambiguous even in gsd-core's own source)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Documentation depth in the Phase 1 schema**
- **D-01:** Ship the full structural schema now (keys, types, enums, defaults, category groupings) plus a one-line description per key. Per-enum-option beginner prose is deferred to Phase 3 when the UI surfaces it. The schema's `x-*` extension shape must be designed now to hold per-key and per-option prose later without a structural change. (Chosen: "Structure + stub key docs".)

**Canonical schema source & completeness verification**
- **D-02:** Build and verify the canonical schema by reconciling multiple sources, not a single one. The researcher must cross-reference all of:
  1. The installed machine-readable schema — `~/.claude/gsd-core/bin/shared/config-schema.manifest.json` (`validKeys`, `dynamicKeyPatterns`, `runtimeStateKeys`) and `~/.claude/gsd-core/bin/lib/config-schema.cjs` (runtime source of truth).
  2. The latest `open-gsd/gsd-core` repo schema sources (breadth + future/changed/deprecated keys) — noting the documented drift between `gsd-tools.cjs` and `sdk/src/config-schema.ts`.
  3. The user's partial (70–80%) hand-curated config at `~/.gsd/defaults - claude api.json` — a rich ~40-namespace real example, incomplete but a strong reference for realistic values.
  4. The user's global defaults `~/.gsd/defaults.json` and this project's `.planning/config.json` as real fixtures.
- **D-03:** The manifest `validKeys` list is the primary authority for "which keys exist" (success criterion #2, zero missing keys), because it is machine-readable and authoritative. Prose docs are secondary. `dynamicKeyPatterns` must be treated as the source of truth for the pool/agent-map key shapes (e.g. `model_overrides`, `effort.agent_overrides`).

> **RESEARCH FINDING that must inform how the planner applies D-03:** empirically, `validKeys` is demonstrably **incomplete** relative to real, working gsd-core config files — see "Critical Finding: Manifest `validKeys` Undercounts Real Keys" below. D-03's "primary authority" status is preserved (it IS authoritative for what it *does* list, and for the dynamic-map pattern shapes), but it cannot be the *sole* source for success criterion #2 the way D-03 anticipated. This is D-02's reconciliation mandate being empirically necessary, not optional — the plan must budget for a fourth source: the **capability-registry federated config schema** (see below), which resolves most of the gap.

### Claude's Discretion (resolved in this research — see corresponding sections below)

- **Save formatting fidelity (SAVE-03):** Decide the minimum fidelity that satisfies "comments-tolerant formatting, key order where feasible." → Resolved: **patch-in-place, standard 2-space pretty-print, no CST/JSONC.** See "Decision: SAVE-03 Save-Fidelity Strategy."
- **Unknown-key representation in the load API:** Decide the data shape (separate "unknown" bucket vs. inline `isKnown`-tagged tree nodes). → Resolved: **separate flat bucket.** See "Decision: Unknown-Key Representation."
- **Effective-value / provenance data shape:** Design the merge output so each resolved value is traceable to the layer that supplied it. → Resolved: **`EffectiveTree` + `Provenance` union, see "Decision: Effective-Value / Provenance Contract."**

### Deferred Ideas (OUT OF SCOPE for Phase 1)

- Live schema reconcile against gsd-core (fetch/AST-parse latest repo, diff added/changed/deprecated, preserve curated prose) → Phase 6 (SCHEMA-05). Phase 1 only needs the schema *format* to be forward-compatible with a later reconcile.
- Per-enum-option beginner prose → Phase 3 (SCHEMA-03), when the UI renders it. Phase 1 designs the `x-*` slot for it.
- Snapshot/version history on save → Phase 2 (SAVE-04) / Phase 5. Phase 1's atomic-write pipeline should be shaped so snapshot-on-write and revert-as-write can hook in without a special-case path.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHEMA-01 | The tool bundles a curated canonical schema (keys, types, options, defaults) covering every gsd-core config chapter | "Critical Finding: Manifest Undercounts Real Keys" + "Schema Reconciliation Method" give the exact 4-source union algorithm and the concrete unknown-key list to close; "Standard Stack" + "Code Examples" give the JSON Schema 2020-12 + `x-*` shape |
| DISC-06 | The tool locates and loads the applicable `defaults.json` (global `~/.gsd/defaults.json`) alongside a project config | "Verified: Global Defaults Discovery Algorithm" gives the exact `GSD_HOME \|\| os.homedir()` + `.gsd/defaults.json` path resolution, verified directly against `config-loader.cjs`; "Finding: gsd-core's Own Runtime Only Uses Global Defaults as a Bootstrap Fallback" flags a UX-honesty nuance for the provenance display |
| SAVE-01 | Every save validates the config against the schema before writing, blocking invalid writes with clear errors | "Decision: Ajv Setup" + "Code Examples: Ajv 2020-12 Setup with Vendor Keywords" |
| SAVE-02 | Saves write atomically (temp file + fsync + rename) with Windows lock/permission retry, so a crash never corrupts the file | "Verified: write-file-atomic Has No Built-In Windows Retry" + "Decision: Atomic-Write Mechanics" |
| SAVE-03 | Saving preserves the full original parsed document, including unknown/future keys, comments-tolerant formatting, and key order where feasible | "Decision: SAVE-03 Save-Fidelity Strategy" (empirically verified: no comments/trailing-commas in real files) + "Decision: Unknown-Key Representation" |

</phase_requirements>

## Summary

Phase 1 has no UI and no server — it is purely the schema descriptor plus a load/merge/validate/write data-layer module, built and tested against fixtures. The two hardest things to get right, per the project's own prior research (PITFALLS.md, ARCHITECTURE.md) and confirmed again by this session's direct reading of the installed gsd-core source, are (1) **schema completeness** — the installed `config-schema.manifest.json`'s `validKeys` list is measurably incomplete versus real, currently-functioning config files, undercounting by roughly 30 leaf key-paths per fixture — and (2) **write safety** — `write-file-atomic@7` (the pinned, correct version per CLAUDE.md) still has **no built-in Windows rename-retry** as of this research (confirmed via a still-open GitHub issue on the current published version), so the retry-with-backoff wrapper the project's own pitfalls research calls for is not optional scaffolding, it is filling a real, currently-unpatched gap in the chosen dependency.

This session cross-referenced four sources, not the two named in D-02/D-03, and found a previously-undocumented **third schema source inside the installed gsd-core**: `capability-registry.cjs` exports its own `configSchema` object (32 keys, each with `type`/`default`/`description` already authored) that is queried by `isValidConfigKey()` in parallel with the central manifest — this is where most of the `workflow.*` toggles missing from `validKeys` (`research`, `nyquist_validation`, `ui_phase`, `tdd_mode`, `code_review`, `security_enforcement`, etc.) actually live, federated per-capability rather than centrally declared. After including this third source, the remaining genuinely-undocumented gap narrows to two chapters (`gates.*`, `safety.*`) plus a handful of "bare dynamic-map container" keys (`model_overrides`, `dynamic_routing`, `granularities`, etc. when empty/null) that no schema source declares as a valid *container* key in isolation — both are real, structurally consistent findings this research surfaces concretely below with the exact key lists, not vague "there might be drift" language.

**Primary recommendation:** Build the bundled schema as the **union of four reconciled sources** (central manifest + capability-registry configSchema + config-defaults CONFIG_DEFAULTS shape + real fixture files), verified by an automated flatten-and-diff script (prototyped and run during this research — see "Schema Reconciliation Method") rather than trusting any single source's key list; implement the write pipeline exactly per ARCHITECTURE.md's Pattern 4 (patch-original-object-in-place, `write-file-atomic@7` + an explicit outer Windows EPERM/EBUSY/EACCES retry wrapper + `proper-lockfile` for concurrent-writer protection), and use `ajv/dist/2020`'s `Ajv2020` export (not the default `Ajv` export, which is draft-07) with `additionalProperties` left open everywhere and `x-*` vendor keywords registered via `ajv.addKeyword()` rather than disabling strict mode wholesale.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bundled canonical schema (descriptor + defaults + `x-*` prose slots) | Database/Storage (build-time data artifact, shipped in package) | — | It's a checked-in JSON artifact consumed at runtime, not executable logic; no server/UI exists yet in Phase 1 |
| Config discovery of file paths (project config, global defaults) | API/Backend (Config I/O module) | — | Path resolution is a pure Node `fs`/`path` concern; no browser tier exists yet — this becomes a server-tier module in Phase 2 |
| Layered effective-value merge + provenance computation | API/Backend (Config I/O module) | — | Read-only computation over parsed JSON; must live server-side because Phase 2's server is the only thing with `fs` access — Phase 1 builds it as a pure, injectable function so Phase 2 can call it without network involvement |
| Ajv schema validation (save-blocking) | API/Backend (Config I/O module) | Browser/Client (later, live field errors via `@hookform/resolvers/ajv`) | The server-side check is what actually protects the file (per ARCHITECTURE.md); Phase 1 only builds the server-tier validator — client-tier reuse is Phase 3 |
| Atomic write (temp+fsync+rename+retry) | API/Backend (Config I/O module) | — | Filesystem mutation is inherently server/Node-only; no tier ambiguity |
| Advisory file locking (`proper-lockfile`) | API/Backend (Config I/O module) | — | Concurrency safety is a server-process concern (guards against two Node processes/tabs racing on the same path) |
| Unknown-key surfacing (data shape only, not UI rendering) | API/Backend (Config I/O module, produces the `unknown[]` bucket) | Browser/Client (Phase 3 renders it — SCHEMA-06) | Phase 1 must produce the *data*, not the UI; the render is explicitly out of scope (deferred to Phase 3) |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ajv` | **8.20.0** [VERIFIED: npm registry] | JSON Schema 2020-12 validation engine, the single validation source of truth | Locked by `.claude/CLAUDE.md`; confirmed current on npm registry this session. Must be imported via `ajv/dist/2020` (the `Ajv2020` class) to get 2020-12 support — the default `Ajv` export is draft-07 only [VERIFIED: ajv.js.org official docs, cross-checked against a live GitHub issue confirming the same requirement] |
| `ajv-formats` | **3.0.1** [VERIFIED: npm registry] | Standard format validators (`date-time`, `uri`, etc.) for Ajv | Locked by CLAUDE.md; required companion package for any format-constrained string fields (e.g. `claude_md_path` as a relative path, `git.base_branch` as a non-empty string) |
| `write-file-atomic` | **7.0.1**, pinned — do NOT float to `^8` [VERIFIED: npm registry, engines confirmed `^20.17.0 \|\| >=22.9.0`] | Temp-file + fsync + rename atomic write primitive | Locked by CLAUDE.md. **Critical caveat found this session:** as of the currently-published version (2026-05-08), this library still has **no built-in Windows rename retry** — see "Verified: write-file-atomic Has No Built-In Windows Retry" below. The wrapper this phase must build is not optional polish, it closes a real, currently-open gap in the dependency itself |
| `proper-lockfile` | **4.1.2** [VERIFIED: npm registry, last published 2021] | Advisory mkdir-based file lock, prevents concurrent-writer races | Locked by CLAUDE.md. Maintenance-stale (no commits since 2021) but functionally simple/stable; re-evaluate only if a CVE or Node-incompatibility surfaces. **Locking is not a substitute for atomic writes** — it solves a different half of the safety problem (concurrent writers vs. crash-mid-write) and both are required together |
| `typescript` | **5.9.3** [VERIFIED: npm registry] | Language for the Config I/O module and schema types | Locked by CLAUDE.md; explicitly not the just-GA'd 7.0 "tsgo" |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | **4.1.10** [VERIFIED: npm registry] | Unit/integration tests for the Config I/O module | Native fit for the eventual Vite frontend build; required for the Validation Architecture section's test strategy below — no test framework currently exists in this greenfield repo (Wave 0 gap) |
| Node built-in `node:fs`, `node:path`, `node:os`, `node:crypto` | Node ≥20.19 (repo confirmed running **v24.6.0** — Active LTS) | File I/O, path joins, `os.homedir()` for global-defaults discovery, content hashing for snapshot keys (Phase 2, not this phase) | No third-party dependency needed for path/homedir resolution — `os.homedir()` combined with `process.env.GSD_HOME` (see DISC-06 algorithm below) is the exact mechanism gsd-core's own `config-loader.cjs` uses |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled safe-set-by-path (dot-path patch function) | `lodash.set` | `lodash.set` is a well-tested, zero-config option, but this project needs an explicit `__proto__`/`constructor`/`prototype` path-segment denylist for prototype-pollution safety (see Security Domain below) regardless of which primitive is used — a ~15-line hand-rolled function with the denylist built in avoids pulling in all of lodash for one function, and keeps the pollution guard visible/auditable in this project's own code rather than trusting an upstream patch cadence |
| `write-file-atomic`'s built-in retry (none) | Re-implement `graceful-fs`-style Windows retry manually, OR add `graceful-fs` as a dependency | This research recommends the manual wrapper (small, ~20 lines, already scoped in ARCHITECTURE.md/PITFALLS.md) over adding `graceful-fs` as a new dependency, since `graceful-fs` patches the global `fs` module (side-effecting monkeypatch) which is broader-blast-radius than a localized retry wrapper around one call site |

**Installation:**
```bash
npm install ajv ajv-formats write-file-atomic@7.0.1 proper-lockfile
npm install -D typescript@5.9.3 vitest @types/node @types/proper-lockfile
```

**Version verification performed this session:**
```
npm view ajv version                    → 8.20.0
npm view ajv-formats version             → 3.0.1
npm view write-file-atomic versions      → ...,"7.0.0","7.0.1","8.0.0" (7.0.1 confirmed latest of the 7.x line)
npm view write-file-atomic@7.0.1 engines → { node: '^20.17.0 || >=22.9.0' }
npm view proper-lockfile version         → 4.1.2 (time.modified: 2022-06-24 — confirms "no recent commits" caveat)
npm view typescript@5.9.3 version        → 5.9.3
npm view vitest version                  → 4.1.10
npm view ajv engines                     → { node: '^20.0.0 || ^22.0.0 || >=24.0.0' }
```
All match CLAUDE.md's locked stack exactly; no drift found between the project's own constraints doc and the live registry.

## Package Legitimacy Audit

Verified via the package-legitimacy seam (`gsd-tools query package-legitimacy check --ecosystem npm`) this session:

| Package | Registry | Age | Downloads (wk) | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------------|--------------|---------|-------------|
| `ajv` | npm | published 2026-04-24 (this version), package itself long-established | 272,010,696 | github.com/ajv-validator/ajv | OK | Approved |
| `ajv-formats` | npm | published 2024-03-30 | 102,677,290 | github.com/ajv-validator/ajv-formats | OK | Approved |
| `write-file-atomic` | npm | published 2026-05-08 (this version) | 76,201,337 | github.com/npm/write-file-atomic | OK | Approved |
| `proper-lockfile` | npm | published 2021-01-25 (this version) | 15,041,772 | github.com/moxystudio/node-proper-lockfile | OK | Approved (maintenance-stale, see caveat above — not a legitimacy concern, a longevity-risk note) |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none. No `postinstall` scripts detected on any of the four packages.

All four packages are `[VERIFIED: npm registry]` in the strict sense used by this document: they are named in `.claude/CLAUDE.md` (an authoritative, already-researched project artifact, not a fresh WebSearch/training-data guess this session) and confirmed `OK` by the package-legitimacy seam. No new/unresearched packages are being introduced by this phase's research beyond what CLAUDE.md already locked.

## Architecture Patterns

### System Architecture Diagram

Phase 1 builds only the bottom two rows of ARCHITECTURE.md's full system diagram — there is no server or UI yet. The diagram below shows the data flow that Phase 1's own automated tests will exercise directly (no HTTP involved):

```
┌─────────────────────────────────────────────────────────────────────┐
│  BUNDLED SCHEMA ARTIFACT (build-time, checked into the npm package)  │
│  bundled-schema.json — JSON Schema 2020-12 + x-* extensions,         │
│  built by reconciling 4 sources (see Schema Reconciliation Method)   │
└───────────────────────────────┬───────────────────────────────────--┘
                                 │ imported by
┌────────────────────────────────▼──────────────────────────────────--┐
│  CONFIG I/O MODULE (pure Node/TS, no HTTP, no fs-mocking needed —    │
│  every function takes explicit paths, testable via fixtures)         │
│                                                                        │
│  load(projectConfigPath) ─┬─→ read raw project config.json (fs)      │
│                            ├─→ locate + read ~/.gsd/defaults.json     │
│                            │   (GSD_HOME || os.homedir(), see DISC-06)│
│                            ├─→ load bundled schema (in-process import)│
│                            └─→ merge(canonical, global, project)      │
│                                  → EffectiveTree + unknown[] bucket   │
│                                                                        │
│  validate(nextRawObject) ──→ Ajv2020.compile(schema)(nextRawObject)   │
│                               → { valid, errors[] } (never throws)   │
│                                                                        │
│  save(path, patchedRawObject) ─┬─→ validate() — BLOCKS here on fail  │
│                                 ├─→ proper-lockfile.lock(path)        │
│                                 ├─→ writeFileAtomic(path, JSON.stringify(patchedRawObject, null, 2))
│                                 │     (internally: temp-in-same-dir → fsync → rename)
│                                 ├─→ OUTER retry wrapper around the    │
│                                 │   rename step: catch EPERM/EBUSY/   │
│                                 │   EACCES, backoff, retry (write-    │
│                                 │   file-atomic does NOT do this      │
│                                 │   itself — verified this session)  │
│                                 └─→ lockfile.unlock(path) (finally)   │
└──────────────────────────────────────────────────────────────────---─┘
                                 │ reads/writes
┌────────────────────────────────▼──────────────────────────────────--┐
│  DISK (fixtures in Phase 1's own test suite; real user paths later)  │
│  <project>/.planning/config.json  |  ~/.gsd/defaults.json            │
└──────────────────────────────────────────────────────────────────---┘
```

A reader can trace the primary use case end-to-end: bundled schema loads once → `load()` reads both raw files and produces a merged, provenance-tagged tree plus an unknown-key bucket → the caller mutates a copy of the *original* parsed project object at specific paths → `save()` validates the mutated object, locks, atomically writes with retry, and unlocks.

### Recommended Project Structure

```
packages/
├── schema-data/
│   ├── bundled-schema.json        # the shipped artifact — output of the reconciliation script
│   └── scripts/
│       └── build-schema.ts        # reconciliation script (see "Schema Reconciliation Method")
└── config-io/                     # this phase's main deliverable
    └── src/
        ├── load.ts                # load(): read raw + merge + provenance + unknown-key bucket
        ├── merge.ts                # pure layered-merge function (canonical/global/project → EffectiveTree)
        ├── validate.ts             # Ajv2020 instance setup + validate() wrapper
        ├── patch.ts                # safe-set-by-path (prototype-pollution-guarded), used by save() callers
        ├── atomic-write.ts         # writeConfig(): lock → validate → write-file-atomic → Windows retry → unlock
        ├── discovery.ts            # resolveGlobalDefaultsPath(): GSD_HOME || os.homedir() + '.gsd/defaults.json'
        └── types.ts                # EffectiveTree, Provenance, UnknownKeyEntry, LoadResult
test/
├── fixtures/
│   ├── project-config.json         # copy of this repo's own .planning/config.json
│   ├── global-defaults.json        # copy of ~/.gsd/defaults.json
│   ├── global-defaults-claude-api.json  # copy of ~/.gsd/defaults - claude api.json (richer, 40-namespace)
│   └── project-config-with-fabricated-unknown-keys.json  # SAVE-03 round-trip fixture, see Validation Architecture
└── config-io/
    ├── load.test.ts
    ├── merge.test.ts
    ├── validate.test.ts
    ├── atomic-write.test.ts
    └── round-trip-identity.test.ts
```

### Decision: Effective-Value / Provenance Contract

**What:** A recursive `EffectiveTree` keyed by the schema's own structure, where every leaf is `{ path, value, from }` and `from` is one of `'canonical' | 'global' | 'project'`. This is returned alongside — not merged into — a flat `unknown: UnknownKeyEntry[]` array.

```typescript
// packages/config-io/src/types.ts
export type Provenance = 'canonical' | 'global' | 'project';

export interface EffectiveLeaf {
  path: string;          // dot-path, e.g. "workflow.tdd_mode"
  value: unknown;
  from: Provenance;
}

export type EffectiveNode = EffectiveLeaf | { [key: string]: EffectiveNode };

export interface UnknownKeyEntry {
  path: string;                          // dot-path as found in the raw object
  value: unknown;                        // raw value, for optional read-only display later
  presentIn: Array<'project' | 'global'>; // which raw layer(s) contain this path
}

export interface LoadResult {
  raw: {
    project: Record<string, unknown>;    // the ORIGINAL parsed project object — never mutated in place by load()
    global: Record<string, unknown> | null;
  };
  effective: Record<string, EffectiveNode>;
  unknown: UnknownKeyEntry[];
  meta: {
    globalDefaultsPath: string;
    globalDefaultsFound: boolean;
  };
}
```

**Rationale (why this shape, not inline `isKnown`-tagged tree nodes):**
1. The schema descriptor drives the tree walk (Pattern 2 in ARCHITECTURE.md) — a generic renderer walks *schema* nodes, so a key with no schema node has nowhere to attach an inline `isKnown: false` tag without inventing a second, parallel ad-hoc tree anyway.
2. A flat array is trivially diffable for the round-trip-identity automated gate: `unknownBefore.length === unknownAfter.length && deepEqual(unknownBefore, unknownAfter)` is a one-line assertion; walking a mixed tree to extract "the unknown parts" for the same comparison is materially more test code for no benefit.
3. Detection is computed once, by flattening **every** leaf path in the raw object and checking each against the reconciled known-key set (exactly the algorithm prototyped and run in "Schema Reconciliation Method" below) — this correctly catches unknown keys nested *inside* an otherwise-recognized namespace (e.g., a brand-new `workflow.some_future_toggle` gsd-core adds after this tool's schema snapshot), not just unrecognized top-level namespaces.
4. Phase 3 (SCHEMA-06) can render `unknown[]` directly as an "Unrecognized keys" panel without touching the main schema-driven tree renderer at all — a clean separation of concerns across phases.

### Decision: Unknown-Key Representation

(Folded into the contract above — the `unknown: UnknownKeyEntry[]` bucket *is* the resolved decision. Restated explicitly since CONTEXT.md calls it out as a distinct discretion item: **separate bucket, not inline tagging**, for the reasons in point 1 above.)

### Decision: SAVE-03 Save-Fidelity Strategy

**Empirical finding (this session):** all three real fixture files (`.planning/config.json`, `~/.gsd/defaults.json`, `~/.gsd/defaults - claude api.json`) were checked directly for JS-style comments (`//`, `/* */`) and trailing commas. **None were found in any fixture** [VERIFIED: direct grep + `JSON.parse()` round-trip on all three files succeeded with zero errors, confirming strict-JSON validity]. The installed manifest's own `_comment` field (`config-schema.manifest.json`) is confirmed to be a **JSON key holding a string value**, not a JS comment syntax — exactly as CONTEXT.md's discretion note anticipated.

**Secondary observation:** the hand-curated `~/.gsd/defaults*.json` files have visibly irregular indentation in places (e.g. a 3-space-indented `"effort": {` block followed by 2-space-indented children) — clear evidence of manual hand-editing, not machine-generated output. This means byte-for-byte whitespace preservation is not actually achievable *or expected* even in real files today; "key order where feasible" (the requirement's actual wording) is satisfiable without any whitespace-preserving CST/JSONC layer.

**Decision:** patch the original parsed JS object in place at the specific changed key path(s), then re-serialize with `JSON.stringify(patchedObject, null, 2)` (standard 2-space pretty-print). Do **not** adopt a CST/JSONC round-trip library (`comment-json`, `node-jsonc-parser`) for Phase 1 — there is no real-file evidence justifying the added complexity, and CONTEXT.md explicitly says not to over-engineer this.

**One subtle gotcha flagged for the plan:** V8 (and the JS spec) reorders **integer-like string keys** (e.g. a key literally named `"0"` or `"42"`) to sort numerically *before* all other string keys, regardless of insertion order — this is spec-mandated `[[OwnPropertyKeys]]` ordering, not a bug, and no serialization library can prevent it because the reordering happens at the JS-object level before `JSON.stringify` ever runs. None of the real fixtures sampled this session contain such keys (agent names, enum values, and reviewer slugs are all non-numeric strings), so this is a low-probability edge case — but the round-trip-identity test (success criterion #1) should include one fixture variant with a purely-cosmetic numeric-string-shaped key (e.g. inside `review.max_prompt_tokens_per_reviewer`) to confirm the tool's behavior is at least *understood and asserted*, not silently surprising.

### Decision: Atomic-Write Mechanics

**What:** `proper-lockfile.lock(path)` → `validate()` (blocks before any write on failure) → `writeFileAtomic(path, content, { fsync: true })` (temp-in-same-directory, fsync, rename — built into the library) → an **outer** retry wrapper specifically around the failure modes `write-file-atomic` does not itself retry → `lockfile.unlock(path)` in a `finally` block so the lock is always released even on validation/write failure.

**Verified: `write-file-atomic` Has No Built-In Windows Retry**

A direct check of the currently-published `write-file-atomic` (7.0.1, and even the newer 8.0.0) confirms **GitHub issue #227** is open and unresolved: on Windows, `fs.rename(tmpfile, truename)` can fail with `EPERM`/`EACCES`/`EBUSY` when another process (Windows Defender, the search indexer, or a concurrent Node process) transiently holds a lock on the target file, and the library's `fs.rename` call has **no retry** — a fix (PR #228, proposing to reintroduce `graceful-fs`-style backoff) was still open at time of research [CITED: github.com/npm/write-file-atomic/issues/227, github.com/npm/write-file-atomic/pull/228]. This directly confirms — with a live, current source, not just training-data knowledge — the exact gap PITFALLS.md flagged: `graceful-fs`'s Windows retry patch does not apply here because `write-file-atomic` uses a bare `require('fs')`, and even if it did, `graceful-fs`'s own retry only fires when the destination file does *not* already exist — the opposite of this tool's primary case (overwriting an existing `config.json`).

**Consequence for the plan:** the outer retry wrapper is not a "nice to have hardening pass," it is filling a **currently real, open, unpatched gap** in the pinned dependency itself. Recommended shape:

```typescript
// packages/config-io/src/atomic-write.ts
import writeFileAtomic from 'write-file-atomic';
import lockfile from 'proper-lockfile';

const RETRYABLE_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 50;

async function writeWithRetry(path: string, content: string): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      await writeFileAtomic(path, content, { fsync: true, encoding: 'utf8' });
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (!code || !RETRYABLE_CODES.has(code)) throw err;
      lastErr = err;
      await new Promise((r) => setTimeout(r, BASE_DELAY_MS * 2 ** attempt));
    }
  }
  throw lastErr;
}

export async function saveConfig(path: string, validatedRawObject: object): Promise<void> {
  const release = await lockfile.lock(path, { retries: { retries: 5, factor: 1.3 }, stale: 10_000 });
  try {
    await writeWithRetry(path, JSON.stringify(validatedRawObject, null, 2));
  } finally {
    await release();
  }
}
```

Note `writeFileAtomic` is called with the temp file in the **same directory as `path`** by default (this is the library's own default behavior, not something the caller must configure) — this matters because a cross-device temp directory would make the final rename a non-atomic copy+delete and risk `EXDEV` [CITED: write-file-atomic README, cross-checked this session].

**Safe patch-by-path guard** (referenced by the write pipeline; belongs alongside, in `patch.ts`):

```typescript
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

export function safeSet(obj: Record<string, unknown>, dotPath: string, value: unknown): void {
  const segments = dotPath.split('.');
  let cursor: Record<string, unknown> = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (FORBIDDEN_SEGMENTS.has(seg)) throw new Error(`Refusing to patch unsafe path segment: ${seg}`);
    if (typeof cursor[seg] !== 'object' || cursor[seg] === null) cursor[seg] = {};
    cursor = cursor[seg] as Record<string, unknown>;
  }
  const last = segments[segments.length - 1];
  if (FORBIDDEN_SEGMENTS.has(last)) throw new Error(`Refusing to patch unsafe path segment: ${last}`);
  cursor[last] = value;
}
```

### Decision: Ajv Setup

**Draft version:** import `Ajv2020` from `ajv/dist/2020`, **not** the default `Ajv` export. [VERIFIED: ajv.js.org official docs — "To use draft-2020-12 schemas you need to import a different Ajv class"; cross-checked against a live GitHub issue (`ajv-validator/ajv#2335`) where the exact fix for "ajv not reading my schema" was switching to this import.] This is a concrete, easy-to-get-wrong implementation detail — using the plain `Ajv` export with a `"$schema": ".../2020-12/schema"` declared in the schema JSON does **not** activate 2020-12 keyword support; the class itself must be the 2020 variant.

**`additionalProperties`:** left **open (absent/undeclared)** at every object node in the enforcement schema — never `false`, per the locked constraint and PITFALLS.md Pitfall 5. This means Ajv will not error or strip anything for a key the schema doesn't recognize; validation only enforces type/shape constraints on keys the schema *does* declare.

**`x-*` vendor keywords and Ajv strict mode:** Ajv's `strict` mode (default `true`) throws on **unknown schema keywords** at compile time — this is a schema-authoring safety net, and it is a *different axis* from `additionalProperties` (which governs *data*, not schema authoring). Passing `strict: false` globally would silence this protection for the whole schema, including genuine typos elsewhere. The narrower, recommended fix is to explicitly register each vendor keyword as a known no-op keyword:

```typescript
// packages/config-io/src/validate.ts
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

const VENDOR_KEYWORDS = ['x-category', 'x-description', 'x-provenance', 'x-options', 'x-dynamic-key-hint'];

export function createValidator(schema: object) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  for (const kw of VENDOR_KEYWORDS) {
    ajv.addKeyword({ keyword: kw }); // metadata-only: no validate/compile fn → always passes, just silences strict-mode
  }
  const validate = ajv.compile(schema);
  return (data: unknown) => ({ valid: validate(data) as boolean, errors: validate.errors ?? [] });
}
```

**`x-*` extension shape** (designed now per D-01 so per-option prose can slot in later without a structural change):

```json
{
  "workflow.tdd_mode": {
    "type": "boolean",
    "default": false,
    "title": "TDD Mode",
    "x-category": "Workflow",
    "x-description": "When enabled, debug sessions require a failing test to be written and verified before any fix is applied.",
    "x-provenance": "capability-registry",
    "x-options": {}
  },
  "workflow.code_review_depth": {
    "type": "string",
    "enum": ["quick", "standard", "deep"],
    "default": "standard",
    "title": "Code Review Depth",
    "x-category": "Workflow",
    "x-description": "Default depth for code review when no --depth override is supplied.",
    "x-provenance": "capability-registry",
    "x-options": {
      "quick": { "x-description": "" },
      "standard": { "x-description": "" },
      "deep": { "x-description": "" }
    }
  },
  "model_overrides": {
    "type": "object",
    "patternProperties": { "^[a-zA-Z0-9_-]+$": { "type": "string" } },
    "title": "Model Overrides",
    "x-category": "Model & Routing",
    "x-description": "Per-agent model tier or fully-qualified model ID overrides.",
    "x-provenance": "dynamicKeyPattern:model_overrides",
    "x-dynamic-key-hint": "agent-id"
  }
}
```
`x-provenance` here records *which reconciled source* justified the key's inclusion (`manifest`, `capability-registry`, `config-defaults`, or `fixture-observed`) — useful for maintainers auditing schema completeness later, distinct from the runtime `Provenance` type used for effective-value layers.

## Critical Finding: Manifest `validKeys` Undercounts Real Keys

This session wrote and ran a small reconciliation script (flatten every real fixture's leaf key-paths, classify each against `validKeys` ∪ `dynamicKeyPatterns` ∪ `runtimeStateKeys`) against all three available real fixtures. Results [VERIFIED: reproduced directly this session against the installed manifest and installed real files]:

| Fixture | Leaf paths | Unknown-to-manifest paths |
|---|---|---|
| `.planning/config.json` (this project) | 148 | 33 |
| `~/.gsd/defaults.json` (global) | 147 | 31 |
| `~/.gsd/defaults - claude api.json` | 180 | 30 |

The unknown paths are **consistent across all three fixtures** (nearly identical sets), which rules out "one-off hand-edit typo" and confirms these are real, structurally-supported chapters:

```
gates.confirm_project, gates.confirm_phases, gates.confirm_roadmap, gates.confirm_breakdown,
gates.confirm_plan, gates.execute_next_plan, gates.issues_review, gates.confirm_transition,
safety.always_confirm_destructive, safety.always_confirm_external_services,
workflow.research, workflow.nyquist_validation, workflow.ui_phase, workflow.ui_safety_gate,
workflow.ui_review, workflow.tdd_mode, workflow.code_review, workflow.code_review_depth,
workflow.pattern_mapper, workflow.post_planning_gaps, workflow.plan_drift_precheck,
workflow.ai_integration_phase, workflow.security_enforcement, workflow.security_asvs_level,
workflow.security_block_on,
review.models, intel.enabled, graphify.enabled,
agent_skills (bare container), model_overrides (bare container, when null/empty),
model_profile_overrides (bare container), dynamic_routing (bare container),
granularities (bare container), model_policy.runtime_tiers (bare container)
```

**Follow-up finding — a third schema source resolves most of this gap:** `capability-registry.cjs` (in the same installed gsd-core directory) exports its own `configSchema` object — **32 keys**, each already carrying `type`, `default`, and a full `description` string — queried by `isValidConfigKey()` via `isCapabilityConfigKey()` **in parallel with** the central manifest (`isCentralConfigKey()`). This single source resolves **all 13 of the `workflow.*` unknowns** listed above (`research`, `nyquist_validation`, `ui_phase`, `ui_safety_gate`, `ui_review`, `tdd_mode`, `code_review`, `code_review_depth`, `pattern_mapper`, `post_planning_gaps`, `ai_integration_phase`, `security_enforcement`, `security_asvs_level`, `security_block_on`) plus `graphify.enabled` and `intel.enabled` [VERIFIED: read directly from `capability-registry.cjs`, confirmed the exact 32-key list this session]. This is genuinely useful for SCHEMA-01 beyond just completeness — **its `description` fields are already-authored, real prose**, a head start on D-01's "one-line description per key" requirement that neither `validKeys` nor a from-scratch write-up would give for free.

**What remains genuinely unresolved even after all three sources (manifest + capability-registry + config-defaults):**
- **`gates.*`** (8 keys) and **`safety.*`** (2 keys) — present, consistent, and clearly consumed at runtime (confirmed via `grep` for `'gates'` usage across `bin/lib/`, which surfaced real consumers, e.g. `loop-resolver.cjs`) but declared in **none** of the three schema sources read this session. This is the strongest, most concrete evidence available of the "documented drift" CONTEXT.md's canonical refs warn about — not a hypothetical, a directly-reproduced gap in the *installed* gsd-core version. **Recommendation: model `gates.*` and `safety.*` in the bundled schema from the real fixture shape (all boolean leaves, per the consistent 3-fixture sample) and flag both namespaces with `"x-provenance": "fixture-observed"` rather than any of the three schema-source labels**, so a future live-reconcile (Phase 6) can specifically re-verify them against whatever gsd-core ships next.
- **Bare dynamic-map containers** (`model_overrides`, `dynamic_routing`, `model_profile_overrides`, `granularities`, `model_policy.runtime_tiers`, `agent_skills`, `review.models`) when the container itself is `{}` or `null` in the file. No schema source declares "the container key itself, with no sub-keys, is a recognized key" — `dynamicKeyPatterns` only recognizes `model_overrides.<agent-id>`, never bare `model_overrides`. This is not a gap in *our* schema design (JSON Schema naturally handles this: declare the container as `{"type": "object", "patternProperties": {...}}`, which matches an empty `{}` or is nullable via `"type": ["object", "null"]` — both validate fine against zero sub-keys), but it is worth flagging explicitly: gsd-core's own `config-set` key-path validator (`isValidConfigKey`) would itself reject `config-set model_overrides '{}'` as an "unknown config key" even though the file legitimately contains that exact shape — a real, minor inconsistency in gsd-core's own tooling, not something this project needs to replicate or work around beyond declaring the container correctly in its own schema.

### Also Reconciled This Session: Two of PITFALLS.md's "Known Schema Ambiguities" Are Resolved, Not Ambiguous

Reading `configuration.cjs` (the actual normalization/defaults-merge module, required by `config-schema.cjs`) directly resolves two items PITFALLS.md/STATE.md flagged as needing "deeper research during planning":

1. **`commit_docs` / `search_gitignored` top-level vs. `planning.*`-nested — NOT drift, both are real, distinct, valid keys.** `normalizeLegacyKeys()` in `configuration.cjs` only migrates four specific legacy shapes: top-level `branching_strategy` → `git.branching_strategy`, top-level `sub_repos` → `planning.sub_repos`, `multiRepo: true` → a filesystem-detection marker, and top-level `depth` → `granularity`. **`commit_docs` and `search_gitignored` are not in this migration list** — both `validKeys` (which lists `commit_docs`, `search_gitignored`, `planning.commit_docs`, `planning.search_gitignored` as four separate entries) and `CONFIG_DEFAULTS` (which declares defaults for both the top-level and nested forms independently) confirm these are **two intentionally-parallel settings**, not an alias pair. [VERIFIED: read directly from `configuration.cjs` and both manifests this session.] The bundled schema should model both as independent keys with distinct `x-description` text, not collapse them.

2. **`granularities` (plural, map) — purpose confirmed, but its own schema placement is internally inconsistent.** `config-defaults.manifest.json`'s `CONFIG_DEFAULTS.planning.granularity` (singular, default `"standard"`) exists as a *nested* default, but the schema manifest's `validKeys` only lists a bare top-level `"granularity"` — **`planning.granularity` itself is not in `validKeys` at all**, meaning gsd-core's own `CONFIG_DEFAULTS` declares a default for a key its own `validKeys` list doesn't recognize. This is a second, independently-found piece of concrete evidence of internal schema drift (distinct from the `gates`/`safety` finding above). The plural `granularities` (top-level, dynamic-map pattern `granularities.<planning|discuss|research|execution|verification|completion>`) is confirmed via the `dynamicKeyPatterns` entry to be **per-phase-type granularity overrides**, mirroring the `models.<phase-type>` pattern exactly — this part is unambiguous and matches FEATURES.md's earlier guess.

**Still genuinely unresolved (flagged, not guessed):** `model_overrides` vs. `model_profile_overrides` remain **two distinct, both-real concepts**, not a naming collision — confirmed by `dynamicKeyPatterns`: `model_overrides.<agent-id>` (any agent name → tier-or-model-ID string) is a flat per-agent override map, while `model_profile_overrides.<runtime>.<opus|sonnet|haiku>` (present as `{}` in the real fixture) is a per-*runtime*, per-*tier* override — a materially different shape (keyed by runtime+tier, not by agent). The bundled schema must model these as two separate top-level dynamic-map keys with distinctly worded `x-description` text; do not merge or treat one as a typo of the other.

## Verified: Global Defaults Discovery Algorithm (DISC-06)

Read directly from `config-loader.cjs` this session:

```typescript
// Exact algorithm gsd-core itself uses (config-loader.cjs, loadConfigResolved, branch D/E):
const home = process.env['GSD_HOME'] || os.homedir();
const globalDefaultsPath = path.join(home, '.gsd', 'defaults.json');
```

[VERIFIED: read directly from the installed `config-loader.cjs` source, line-cited during this session's investigation.] This is the exact path-resolution algorithm the Config I/O module's `discovery.ts` should replicate for DISC-06 — no search/probe logic is needed, it is a single fixed path relative to the home directory (or `GSD_HOME` override), read once per load.

### Finding: gsd-core's Own Runtime Only Uses Global Defaults as a Bootstrap Fallback — A UX-Honesty Nuance for Provenance Display

Reading the surrounding code in `config-loader.cjs` surfaces something worth flagging explicitly rather than silently assuming away: gsd-core's own `loadConfigResolved()` only reads `~/.gsd/defaults.json` in **branches D/E — when no `.planning/` directory exists at all** (i.e., a brand-new, not-yet-initialized project). For a project that already has a `.planning/config.json` (this tool's primary, everyday use case), gsd-core's live runtime resolution is **canonical built-in defaults ← project config.json only** — it does **not** re-read `~/.gsd/defaults.json` as a perpetual third layer once the project file exists.

This means the product's own locked design (REQUIREMENTS.md DISC-06, CONTEXT.md success criterion #5: "resolves effective values by merging canonical schema defaults with the global `~/.gsd/defaults.json` layer and the project's `config.json`") is an intentional, always-computed **teaching/reference display** the tool provides as a value-add — genuinely useful ("here's what your personal global default is, for comparison") — but it is **not** a faithful mirror of gsd-core's own live behavior for a field that already has an explicit value in `config.json`. Changing `~/.gsd/defaults.json` will **not** retroactively change an already-materialized project field the way "provenance: global" might visually imply to a user unfamiliar with this nuance.

**Recommendation (not a re-litigation of the locked decision, a copy/labeling note for whoever builds the Phase 3/4 UI on top of this phase's contract):** keep the 3-layer `EffectiveTree` exactly as designed above (it is correct, useful, and matches the locked requirement) — but the `from: 'global'` provenance tag should be understood internally as "this project config doesn't set it, and here is what your global defaults file currently says," not "gsd-core is live-reading this from your global defaults right now." This phase's data contract already supports either UI framing without changes; it is purely a documentation/labeling concern for later phases, recorded here so it isn't rediscovered as a surprise during Phase 3/4 UX writing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Atomic file write | A custom temp-file-then-rename implementation from raw `fs` calls | `write-file-atomic@7.0.1` | It already correctly handles same-directory temp placement, fsync, and unlink-on-failure cleanup — re-implementing loses those edge cases for no benefit; the only gap (Windows retry) is additive on top, not a replacement |
| JSON Schema validation | A hand-rolled recursive type/enum checker | `ajv` (`ajv/dist/2020`) + `ajv-formats` | JIT-compiled, spec-complete 2020-12 support, and already the project's locked single source of truth for both server and (later) client validation — a hand-rolled checker would need to be reinvented a second time for client-side reuse in Phase 3 |
| Concurrent-writer protection | A custom PID-file or mutex scheme | `proper-lockfile` | Mkdir-based locking is a well-understood, portable primitive; a custom scheme would need to solve stale-lock detection and cross-platform atomicity itself, which `proper-lockfile` already does |
| Deep object patch-by-path | Reaching for full `lodash` for one function | A ~15-line hand-rolled `safeSet()` with an explicit `__proto__`/`constructor`/`prototype` denylist (shown above) | Keeps the security-relevant guard visible and auditable in this project's own code; avoids a full dependency for one utility function |

**Key insight:** every "don't hand-roll" item above is already locked in `.claude/CLAUDE.md` — this phase's job is to use them *correctly* (right Ajv import, right retry wrapper around write-file-atomic's known gap, right lock/write/unlock ordering), not to pick new tools.

## Common Pitfalls

### Pitfall 1: Reconstructing the write payload from schema/form state instead of patching the original object
**What goes wrong:** Any key present in the real file that the bundled schema doesn't yet recognize gets silently dropped on save.
**Why it happens:** It's the natural implementation path once a schema exists — schema defines the form model, form model becomes the write payload.
**How to avoid:** `load()` returns the original parsed `raw.project` object unmodified; all edits call `safeSet()` on a copy of that same object at specific paths; `save()` writes the patched object, never a schema-derived reconstruction. Already the resolved design above (Decision: Effective-Value / Provenance Contract).
**Warning signs:** The round-trip-identity test (see Validation Architecture) is the automated gate — any diff in `unknown[]` count/content across a no-op load→save cycle is a hard failure.

### Pitfall 2: Ajv's default export silently validating against the wrong JSON Schema draft
**What goes wrong:** Using `new Ajv()` (the default, draft-07-only export) with a schema whose `$schema` says `2020-12` does not error loudly — Ajv either ignores 2020-12-only keywords or behaves subtly differently, producing confusing false-negative/false-positive validation results that look like a schema-content bug but are actually an import-path bug.
**Why it happens:** `require('ajv')` "just works" for most schemas that don't use 2020-12-only features, so the bug is invisible until a `prefixItems`/`unevaluatedProperties`-style keyword is used.
**How to avoid:** always `import Ajv2020 from 'ajv/dist/2020'`, confirmed this session as the documented, correct approach.
**Warning signs:** validation passing/failing in ways that don't match the schema as written; any use of `unevaluatedProperties`, `prefixItems`, or `$dynamicRef` silently no-op'ing.

### Pitfall 3: Windows crash-mid-write corrupting `config.json` because `write-file-atomic` doesn't retry
**What goes wrong:** confirmed this session as a *currently open, unpatched* gap (GitHub issue #227) — a transient antivirus/indexer lock on the rename target causes an immediate `EPERM` with no library-level retry.
**How to avoid:** the outer retry wrapper shown in "Decision: Atomic-Write Mechanics" above — not optional.
**Warning signs:** intermittent save failures specifically on Windows that don't reproduce on macOS/Linux dev machines.

### Pitfall 4: Ajv strict mode rejecting the bundled schema's own `x-*` vendor extensions at compile time
**What goes wrong:** the schema fails to even *compile* (`ajv.compile()` throws at startup, not at validation time) because strict mode treats `x-category`/`x-description`/etc. as unknown keywords.
**How to avoid:** register each vendor keyword via `ajv.addKeyword({ keyword })` (shown above) rather than reaching for `strict: false`, which would also silence genuine-typo protection elsewhere in the schema.
**Warning signs:** a hard crash on the very first `ajv.compile(schema)` call in tests, before any validation logic is even exercised.

### Pitfall 5: `additionalProperties: false` anywhere in the enforcement schema
**What goes wrong:** blocks saving any config with a field newer than the bundled schema snapshot — the exact failure mode SCHEMA-01/SAVE-03 exist to prevent.
**How to avoid:** never set it at object nodes used for save-blocking validation; already the resolved design above.
**Warning signs:** a user/test report of "valid config, tool won't let me save."

### Pitfall 6 (new this session): Treating gsd-core's own `config-set` per-key validator as equivalent to "what's a valid config file"
**What goes wrong:** `config.cjs`'s `cmdConfigSet()` / `isValidConfigKey()` is a narrow, single-key-path CLI validator used only by `gsd config-set`; it is **not** run recursively against a whole file on every load. Direct-file-edit configs (which is exactly what this tool produces) are validated far more loosely by gsd-core itself — confirmed by reading `config.cjs` this session. Assuming "if `isValidConfigKey` would reject it, our tool should reject it too" would make this tool *stricter* than gsd-core's own direct-file-edit tolerance, actively contradicting SAVE-03/Pitfall 5.
**How to avoid:** this tool's own Ajv schema is the sole validation authority; do not attempt to shell out to or mirror gsd-core's `config-set` validation semantics.
**Warning signs:** none yet observed in this codebase (greenfield) — flagging preemptively since it would be an easy, plausible-looking mistake for an implementer who reads `config.cjs` and assumes its validator is the canonical "correctness" bar.

## Code Examples

### Layered Merge (canonical → global → project, with provenance)

```typescript
// packages/config-io/src/merge.ts
import type { EffectiveNode, EffectiveLeaf, Provenance } from './types';

function getAtPath(obj: unknown, dotPath: string): { found: boolean; value: unknown } {
  const segments = dotPath.split('.');
  let cursor: any = obj;
  for (const seg of segments) {
    if (cursor == null || typeof cursor !== 'object' || !(seg in cursor)) return { found: false, value: undefined };
    cursor = cursor[seg];
  }
  return { found: true, value: cursor };
}

export function resolveLeaf(
  path: string,
  layers: { project: unknown; global: unknown; canonical: unknown }
): EffectiveLeaf {
  for (const from of ['project', 'global', 'canonical'] as const) {
    const { found, value } = getAtPath(layers[from], path);
    if (found) return { path, value, from: from as Provenance };
  }
  throw new Error(`No layer supplies a value for ${path} — schema default is missing`);
}
```

### Round-Trip-Identity Test Shape (the automated gate for success criterion #1)

```typescript
// test/config-io/round-trip-identity.test.ts
import { describe, it, expect } from 'vitest';
import { load } from '../../packages/config-io/src/load';
import { saveConfig } from '../../packages/config-io/src/atomic-write';
import fs from 'node:fs/promises';

describe('round-trip identity', () => {
  it('preserves every unknown key, including fabricated future keys, across a no-op save', async () => {
    const fixturePath = 'test/fixtures/project-config-with-fabricated-unknown-keys.json';
    const before = await load(fixturePath);
    expect(before.unknown.length).toBeGreaterThan(0); // sanity: fixture actually has unknowns

    // no-op save: patch nothing, write the original raw object back unchanged
    await saveConfig(fixturePath, before.raw.project);

    const after = await load(fixturePath);
    expect(after.unknown).toEqual(before.unknown);
    expect(after.raw.project).toEqual(before.raw.project);
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| `write-file-atomic` relying on `graceful-fs` for Windows retry | `write-file-atomic@3.0.0+` dropped the `graceful-fs` dependency; no replacement retry added | 3.0.0 (per issue #227 history) | Callers on Windows must supply their own retry wrapper — this project's design already accounts for this |
| Ajv draft-07 as "the" JSON Schema version | Ajv 2020-12 support via a separate `ajv/dist/2020` export, non-interchangeable with the default export | Ongoing since Ajv 7/8 | Must be deliberate about which class is imported; a plain upgrade of the `ajv` package version does not retroactively fix a draft-07 import |

**Deprecated/outdated:** none specific to this phase's stack beyond the above — all four core packages are current, actively maintained majors per this session's registry checks.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `gates.*` and `safety.*` should be modeled directly from the observed 3-fixture shape (all-boolean leaves) rather than from any authoritative schema source, since none of the three checked sources declare them | Critical Finding: Manifest Undercounts Real Keys | If gsd-core's true (unread, e.g. TypeScript SDK source) schema for these differs in type/shape from the observed boolean-only pattern, the bundled schema could encode a wrong constraint — mitigated by `additionalProperties` staying open and validation never blocking on shape mismatches for these specific namespaces until Phase 6's live reconcile confirms them |
| A2 | The `open-gsd/gsd-core` GitHub repo's *current* schema sources (not fetched this session — no live network fetch of the repo was performed; this session relied on the *installed* local gsd-core copy plus this project's own prior FEATURES.md/PITFALLS.md research, which did fetch the repo in a prior session) match the installed local copy closely enough that the reconciliation above is still valid | Critical Finding section, D-02 compliance | If the installed local `gsd-core` version is meaningfully older/newer than the current `next` branch, some of the "unresolved" gaps (`gates.*`, `safety.*`) might already be resolved upstream, or new gaps may exist that this session's local-file reading could not surface — the planner should budget a lightweight confirmation step (fetch `docs/CONFIGURATION.md` fresh, or diff `package.json`/version markers) rather than treating this session's findings as permanently final |
| A3 | `.claude/gsd-core` (the locally installed copy read this session) is a representative, current gsd-core install and not a stale/forked copy | All source-reading throughout this document | If the local install is significantly behind or ahead of what a typical end-user's gsd-core install looks like, the reconciled key list may not generalize — mitigated by the "reconcile from multiple real fixtures" design already baked into D-02, and by keeping `additionalProperties` open so any mismatch degrades gracefully (unknown-key passthrough) rather than breaking |

**If this table is empty:** N/A — see entries above; none of them are training-data guesses, all are reasoning built on directly-read local source this session, but the *generalizability* of "this local install" to "gsd-core in general" carries residual risk worth flagging.

## Open Questions

1. **Does the real, current `open-gsd/gsd-core` repo (fetched live, not the locally-installed copy) confirm `gates.*`/`safety.*` belong exactly where observed, or do they live under a different canonical path (e.g. a TypeScript SDK source with a different shape)?**
   - What we know: both namespaces are present, structurally consistent, and clearly consumed (real `grep` hits in `bin/lib/`) across all three local real fixtures and the locally-installed gsd-core copy.
   - What's unclear: whether the *authoritative* upstream TypeScript source (`sdk/src/config-schema.ts`, mentioned in CONTEXT.md's own drift note but not read this session, since it lives in the separate `open-gsd/gsd-core` repo rather than the locally-installed package) declares a richer shape (e.g. per-gate override reasons, or additional keys within `safety.*`) than the flat-boolean pattern observed locally.
   - Recommendation: model from the observed shape now (per Assumption A1), tag `x-provenance: fixture-observed`, and treat a live-repo confirmation as Phase 6 (SCHEMA-05) work rather than blocking Phase 1 on a repo fetch this research session did not perform.

2. **Should the bundled schema encode `planning.granularity` (found as a `CONFIG_DEFAULTS` nested default but absent from `validKeys`) at all, given it appears to be dead/vestigial in the installed manifest?**
   - What we know: `CONFIG_DEFAULTS.planning.granularity` exists with default `"standard"`; no real fixture (including this project's own `config.json`) actually sets `planning.granularity` — all three fixtures only set the bare top-level `granularity`.
   - What's unclear: whether this is truly dead code in the installed gsd-core version, or a forward-looking field not yet wired up.
   - Recommendation: omit `planning.granularity` from the bundled schema's *known-keys* list for now (don't manufacture a key with zero real-world evidence of use), but ensure it would land in the `unknown[]` bucket (not silently dropped) if a future gsd-core version ever writes it — the open-`additionalProperties` design already guarantees this without extra work.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Runtime for the entire Config I/O module and its test suite | ✓ | v24.6.0 (Active LTS, exceeds CLAUDE.md's `>=20.19` floor) | — |
| npm | Package install/publish tooling | ✓ | 11.14.1 | — |
| git | Version control (already an active repo) | ✓ | 2.46.0.windows.1 | — |
| `package.json` / existing Node project scaffold | Phase 1 build tooling | ✗ (repo is greenfield — only `.claude/` and `.planning/` exist) | — | Phase 1's first task must scaffold `package.json`, `tsconfig.json`, and install the four core + dev dependencies listed above — this is expected for a first code phase, not a blocker |

**Missing dependencies with no fallback:** none — the only "missing" item (`package.json` scaffold) is expected first-phase setup work, not an external constraint.
**Missing dependencies with fallback:** none applicable this phase.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (locked by CLAUDE.md; not yet installed — Wave 0 gap) |
| Config file | none yet — `vitest.config.ts` must be created in Wave 0 |
| Quick run command | `npx vitest run test/config-io --reporter=dot` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| SCHEMA-01 | Bundled schema recognizes every real fixture leaf key (zero missing, after reconciling all 4 sources) | unit (schema-completeness diff script) | `npx vitest run test/schema-data/completeness.test.ts` | ❌ Wave 0 |
| DISC-06 | `load()` locates `~/.gsd/defaults.json` via `GSD_HOME \|\| os.homedir()` and merges it as the `'global'` layer | unit | `npx vitest run test/config-io/discovery.test.ts` | ❌ Wave 0 |
| SAVE-01 | `validate()` blocks a structurally-invalid document with field-level Ajv errors, and `saveConfig()` never calls `writeFileAtomic` when validation fails | unit | `npx vitest run test/config-io/validate.test.ts` | ❌ Wave 0 |
| SAVE-02 | Repeated kill-mid-save (simulated via injected `EPERM`/`EBUSY` faults on a mocked `writeFileAtomic`, plus a slower real spawn+`SIGKILL` stress harness) never leaves a truncated/corrupt file | unit (mocked fault injection) + stress/integration (real process kill loop) | `npx vitest run test/config-io/atomic-write.test.ts` (unit) / `node test/stress/kill-mid-save.mjs` (manual/CI-nightly tier) | ❌ Wave 0 (both) |
| SAVE-03 | No-op load→save round-trip preserves every key (including fabricated unknown ones) and key order, byte-identical except for whitespace normalization | integration | `npx vitest run test/config-io/round-trip-identity.test.ts` | ❌ Wave 0 |
| SAVE-03 (provenance) | `EffectiveTree` correctly tags `from: 'canonical' \| 'global' \| 'project'` per the 3-layer precedence, for keys present at each combination of layers | unit | `npx vitest run test/config-io/merge.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run test/config-io --reporter=dot` (fast unit tier, excludes the real-process kill-loop stress test)
- **Per wave merge:** `npx vitest run` (full suite, including the round-trip-identity and schema-completeness tests; the real-process kill-loop stress test should be its own opt-in script, not part of the default `vitest run`, since spawning+killing child processes repeatedly is slow and platform-sensitive)
- **Phase gate:** full suite green, **plus** at least one manual/scripted run of the kill-mid-save stress harness on the actual Windows target platform before `/gsd-verify-work`, per PITFALLS.md's "Looks Done But Isn't" checklist item for atomic writes

### Wave 0 Gaps

- [ ] `package.json` + `tsconfig.json` + `vitest.config.ts` — no Node project scaffold exists yet in this repo
- [ ] `test/fixtures/*.json` — copies of the three real files read this session (`.planning/config.json`, `~/.gsd/defaults.json`, `~/.gsd/defaults - claude api.json`), plus a fourth fixture derived from one of them with deliberately fabricated unknown keys injected (see the two-part fixture strategy note below)
- [ ] `test/schema-data/completeness.test.ts` — the flatten-and-diff completeness check prototyped ad hoc this session (see "Critical Finding" section) should become a permanent, checked-in test, not a one-off research script
- [ ] `test/stress/kill-mid-save.mjs` — a small standalone script (not part of the default vitest run) that spawns a child process performing repeated saves and `SIGKILL`s it mid-write N times, asserting the file is always fully-parseable old-or-new content after each kill
- [ ] Framework install: `npm install -D vitest @types/node @types/proper-lockfile`

**Note on the SAVE-03 fixture strategy — a clarification worth making explicit for whoever builds the fixtures:** CONTEXT.md's canonical refs point at `~/.gsd/defaults - claude api.json` as "the SAVE-03 unknown-key-preservation fixture" because gsd-core's *own* validator flags `gates`/`safety`/etc. as unknown in that file. But since this tool bundles its *own*, more complete schema (built by reconciling 4 sources, closing most of that exact gap per the Critical Finding above), those particular keys will be **known** to this tool's schema once SCHEMA-01 is done — they will not exercise the unknown-key passthrough path at all. Recommend a **two-part fixture strategy**: (a) use the real file as-is as the primary round-trip-identity fixture (proves general fidelity on a real, messy, hand-edited file), **and** (b) create a derived copy with 1-2 deliberately fabricated, structurally-novel keys injected (e.g. `"x_gsdcm_test_future_key": {"nested": true}` at top level, and `workflow.x_test_unknown_toggle: false` nested) specifically to exercise the "genuinely unrecognized by this tool's own schema" code path — this is what success criterion #1's wording ("fabricated unknown keys") actually asks for, and (a) alone would not stress it once SCHEMA-01 closes the real gap.

## Security Domain

`workflow.security_enforcement` is `true` and `workflow.security_asvs_level` is `3` in this project's own `.planning/config.json` — Nyquist/security enforcement is active for this project's own phases. Phase 1 has no server, no network surface, and no auth boundary (those arrive in Phase 2), so the applicable ASVS surface is narrower than a typical phase, but not zero.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | no | No auth surface exists until Phase 2's loopback server |
| V3 Session Management | no | Same as above |
| V4 Access Control | no | Same as above |
| V5 Input Validation | yes | Ajv (`ajv/dist/2020` + `ajv-formats`), `additionalProperties` open, per "Decision: Ajv Setup" |
| V6 Cryptography | no | Phase 1 does not encrypt/hash anything; secret-shaped fields (`brave_search`, `firecrawl`, etc.) pass through unmodified as part of the raw object — masking them in a UI is Phase 4's SEC-03, out of scope here, but see the logging note below |
| V12 File and Resources (informal mapping — closest ASVS category to this phase's actual risk surface: safe file I/O) | yes | Atomic write + advisory locking (`write-file-atomic` + `proper-lockfile`), path handling deferred to caller (Discovery is Phase 3's job; Config I/O's own functions accept an already-resolved absolute path and must not themselves attempt to normalize/trust arbitrary relative input) |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Prototype pollution via a dot-path key patch (`__proto__`, `constructor.prototype`) | Tampering | Explicit denylist in `safeSet()`, shown above — reject `__proto__`/`constructor`/`prototype` as any path segment |
| Non-atomic / interrupted write corrupting `config.json` | Tampering / Denial of Service (against the user's own GSD workflow, since every `gsd` command reads this file) | `write-file-atomic` + outer Windows retry wrapper, per "Decision: Atomic-Write Mechanics" — this is SAVE-02's entire purpose |
| Sensitive values (API-key-shaped top-level fields: `brave_search`, `firecrawl`, `exa_search`, etc.) appearing in error logs or thrown-exception messages during load/validate/save | Information Disclosure | Phase 1's own error paths (Ajv validation errors, atomic-write failures) must never `JSON.stringify`/log the *entire* raw config object in an error message — log only the offending key path (`instancePath`) and error keyword, never the value, for any path outside a small explicit allowlist. UI-level masking is Phase 4's SEC-03, but this phase's own internal logging hygiene should not leak the values in the meantime |
| ReDoS via a schema `patternProperties` regex (e.g. an incautiously-written dynamic-key pattern) | Denial of Service | Reuse the manifest's own `dynamicKeyPatterns` regex sources where possible (all simple bracket-character classes, e.g. `^model_overrides\.[a-zA-Z0-9_-]+$` — no nested quantifiers, no catastrophic-backtracking shape) rather than authoring new, more complex patterns from scratch |

## Sources

### Primary (HIGH confidence)
- `~/.claude/gsd-core/bin/shared/config-schema.manifest.json` — read directly this session; `validKeys`, `dynamicKeyPatterns`, `runtimeStateKeys` all enumerated and cross-checked programmatically against 3 real fixtures
- `~/.claude/gsd-core/bin/lib/config-schema.cjs`, `configuration.cjs`, `config-loader.cjs`, `config.cjs`, `capability-registry.cjs` — read directly this session; source of the legacy-key normalization findings, the global-defaults discovery algorithm, the `config-set` narrow-validator finding, and the capability-registry `configSchema` third-source discovery
- `~/.claude/gsd-core/bin/shared/config-defaults.manifest.json` — read directly this session; `CONFIG_DEFAULTS` nested shape, source of the `planning.granularity` internal-inconsistency finding
- `~/.gsd/defaults.json`, `~/.gsd/defaults - claude api.json`, `~/.gsd/defaults - non claude.json`, `.planning/config.json` — all read/flattened/diffed directly this session
- `registry.npmjs.org` direct queries this session — `ajv`, `ajv-formats`, `write-file-atomic`, `proper-lockfile`, `typescript`, `vitest` versions and engines fields
- `gsd-tools query package-legitimacy check` seam — run this session against all four core packages, all `OK`

### Secondary (MEDIUM confidence)
- ajv.js.org official docs (`api.html`, `json-schema.html`, `strict-mode`) — fetched via web search this session, confirms the `ajv/dist/2020` import requirement and strict-mode/`additionalProperties` distinction
- `github.com/npm/write-file-atomic/issues/227` and `pull/228` — confirms the currently-open Windows retry gap on the exact pinned version
- `github.com/ajv-validator/ajv/issues/2335` — corroborates the 2020-12 import requirement with a real, reproduced user bug

### Tertiary (LOW confidence)
- None — this research relied on directly-read local source files and directly-queried registries/seams rather than unverified secondary summaries.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version verified directly against the npm registry this session, matches CLAUDE.md's locked stack with zero drift
- Architecture (contracts/decisions): HIGH — the `EffectiveTree`/`unknown[]`/atomic-write designs are directly derived from this project's own already-vetted ARCHITECTURE.md patterns, refined with concretely-verified library behavior (Ajv import, write-file-atomic gap) rather than assumed
- Schema completeness: MEDIUM-HIGH — the 4-source reconciliation method and the exact unknown-key lists are HIGH confidence (directly reproduced this session); the *generalizability* of the locally-installed gsd-core copy to "gsd-core in general" and the true shape of `gates.*`/`safety.*` in the authoritative upstream TypeScript source are MEDIUM (see Assumptions A1-A3, Open Questions)
- Pitfalls: HIGH — grounded in this project's own prior PITFALLS.md plus newly-verified live evidence (the write-file-atomic GitHub issue, the config.cjs narrow-validator reading) rather than restating unverified claims

**Research date:** 2026-07-12
**Valid until:** 30 days for the stack/library-mechanics findings (stable, slow-moving); re-verify the `gates.*`/`safety.*` schema-drift findings whenever Phase 6's live-reconcile work fetches the actual current `open-gsd/gsd-core` repo, since this session's schema findings come from a locally-installed copy, not a live repo fetch.
