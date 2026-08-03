# Phase 1: Schema Foundation & Data-Layer Safety - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the **bundled canonical schema** plus a **corruption-proof read/write data layer** — no server, no CLI, no UI (those are Phases 2–3).

Concretely, Phase 1 produces:
1. A curated canonical schema (JSON Schema 2020-12 + `x-*` vendor extensions for category/prose/provenance) covering every gsd-core config chapter/key, verifiable against real gsd-core sources with zero missing keys.
2. A discovery + config-I/O module that loads a project `config.json`, locates and loads the applicable `~/.gsd/defaults.json`, and resolves **layered effective values** (canonical defaults → global defaults → project config) with per-value provenance.
3. Ajv validation with `additionalProperties` **open** at the enforcement/save-blocking layer (never strict), producing clear field-level errors that block invalid writes with no partial write.
4. An **atomic write** (temp-in-same-dir → fsync → rename, with Windows `EPERM`/`EBUSY`/`EACCES` retry-with-backoff) that patches the **original parsed JSON object in place** — never a schema-reconstructed rebuild — so unknown/future keys and key order survive round-trips.
5. A round-trip-identity test (load → no-op save → load) using real fixtures with genuine unknown keys as an automated gate.

**Requirements:** SCHEMA-01, DISC-06, SAVE-01, SAVE-02, SAVE-03.
</domain>

<decisions>
## Implementation Decisions

### Documentation depth in the Phase 1 schema
- **D-01:** Ship the **full structural schema now** (keys, types, enums, defaults, category groupings) **plus a one-line description per key**. Per-enum-option beginner prose is **deferred to Phase 3** when the UI surfaces it. The schema's `x-*` extension shape must be designed now to hold per-key and per-option prose later without a structural change. (Chosen: "Structure + stub key docs".)

### Canonical schema source & completeness verification
- **D-02:** Build and verify the canonical schema by **reconciling multiple sources**, not a single one. The researcher must cross-reference all of:
  1. The **installed** machine-readable schema — `~/.claude/gsd-core/bin/shared/config-schema.manifest.json` (`validKeys`, `dynamicKeyPatterns`, `runtimeStateKeys`) and `~/.claude/gsd-core/bin/lib/config-schema.cjs` (runtime source of truth).
  2. The **latest `open-gsd/gsd-core` repo** schema sources (breadth + future/changed/deprecated keys) — noting the documented drift between `gsd-tools.cjs` and `sdk/src/config-schema.ts`.
  3. The user's **partial (70–80%) hand-curated config** at `~/.gsd/defaults - claude api.json` — a rich ~40-namespace real example, incomplete but a strong reference for realistic values.
  4. The user's **global defaults** `~/.gsd/defaults.json` and this project's `.planning/config.json` as real fixtures.
- **D-03:** The **manifest `validKeys` list is the primary authority** for "which keys exist" (success criterion #2, zero missing keys), because it is machine-readable and authoritative. Prose docs are secondary. `dynamicKeyPatterns` must be treated as the source of truth for the pool/agent-map key shapes (e.g. `model_overrides`, `effort.agent_overrides`).

### Claude's Discretion (user said "you decide / research it")
- **Save formatting fidelity (SAVE-03):** Decide the minimum fidelity that satisfies "comments-tolerant formatting, key order where feasible." First determine empirically whether real gsd-core `config.json` files actually contain comments/JSONC (standard `config.json` is plain JSON; note the manifest itself uses a `_comment` key convention rather than JS comments). Default expectation: **patch-in-place preserving all keys + key order, standard pretty-print (2-space)**; only escalate to a CST/JSONC byte-faithful approach if real files are shown to carry comments/trailing-commas worth preserving. **Do not over-engineer.**
- **Unknown-key representation in the load API:** Decide the data shape (separate "unknown" bucket vs. inline `isKnown`-tagged tree nodes) as part of designing the effective-value/provenance contract. Whatever is chosen must let Phase 3 **surface** unknown keys rather than hide/drop them (SCHEMA-06 downstream).
- **Effective-value / provenance data shape:** Design the merge output so each resolved value is traceable to the layer that supplied it (canonical default → global defaults → project config), per success criterion #5.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative schema sources (reconcile all — see D-02/D-03)
- `~/.claude/gsd-core/bin/shared/config-schema.manifest.json` — **PRIMARY authority** for valid key paths: `validKeys`, `dynamicKeyPatterns` (pool/agent-map shapes), `runtimeStateKeys`. Machine-readable, the CJS single source of truth.
- `~/.claude/gsd-core/bin/lib/config-schema.cjs` — runtime schema implementation; recompiles `dynamicKeyPatterns` to RegExp. Read to understand validation semantics and key-pattern behavior.
- `open-gsd/gsd-core` (latest published repo) — breadth check for new/changed/deprecated keys; reconcile against installed manifest. Note documented drift `gsd-tools.cjs` vs `sdk/src/config-schema.ts`.

### Real fixtures (for round-trip, merge, and unknown-key tests)
- `~/.gsd/defaults - claude api.json` — user's partial (70–80%) hand-curated canonical config, ~40 namespaces (`model_overrides`, `dynamic_routing`, `agent_skills`, `models`, etc.). Reference for realistic values; **incomplete — do not treat as complete key coverage.**
- `~/.gsd/defaults.json` — the global defaults **layer** the loader must locate and merge (DISC-06).
- `.planning/config.json` (this project) — a real project config; primary round-trip-identity fixture.
- **Unknown-key fixture note:** `~/.gsd/defaults - claude api.json` contains keys gsd-core's own validator flags as unknown (e.g. `gates`, `safety`, `security`, `statusline`, `features`, `learnings`, `intel`, `graphify`). Use it as the SAVE-03 unknown-key-preservation round-trip fixture.

### Project research (already produced — read before planning)
- `.planning/research/SUMMARY.md` — stack + backend-first build order + top pitfalls.
- `.planning/research/PITFALLS.md` §Pitfall 1 (silent unknown-key drop → patch-in-place), §Pitfall 2 (non-atomic write → temp+fsync+rename + Windows retry), §Pitfall 5 (never `additionalProperties:false` at enforcement layer).
- `.planning/research/ARCHITECTURE.md`, `.planning/research/STACK.md`, `.planning/research/FEATURES.md`.
- `.planning/REQUIREMENTS.md` — SCHEMA-01, DISC-06, SAVE-01, SAVE-02, SAVE-03.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Greenfield** — no `src/` yet. First code phase. No existing modules to reuse.
- Installed `config-schema.cjs` / manifest can be **read as data/reference**, but the tool bundles its **own** curated schema (do not depend on gsd-core internals at runtime).

### Established Patterns
- Stack is locked by `.claude/CLAUDE.md` / research: TypeScript 5.9.3, Ajv 8.20 (+ `ajv-formats`), `write-file-atomic@7` (pinned, not @8), `proper-lockfile`. Node ≥20.19.
- Schema descriptor format: JSON Schema 2020-12 + `x-*` vendor extensions (`x-category`, `x-description`/prose, `x-provenance`) — the single source driving both Ajv validation and (later) the UI renderer.

### Integration Points
- This phase's **schema shape** and the **load-result / effective-value contract** become the frozen API that Phase 2 (server) and Phase 3 (UI) build against. Design these contracts deliberately — they are the hardest things to change later.

</code_context>

<specifics>
## Specific Ideas

- User explicitly wants the schema reconciled from **their installed gsd-core + latest open-gsd/gsd-core + their own defaults**, acknowledging their hand-curated config is only ~70–80% complete — so completeness must come from the machine-readable manifest, not their file.
- User is comfortable letting research decide save-fidelity, unknown-key representation, and provenance data shape — capture the *rationale* in RESEARCH.md so the decision is auditable.

</specifics>

<deferred>
## Deferred Ideas

- **Live schema reconcile against gsd-core** (fetch/AST-parse latest repo, diff added/changed/deprecated, preserve curated prose) → **Phase 6** (SCHEMA-05). Phase 1 only needs the schema *format* to be forward-compatible with a later reconcile, not the reconcile feature itself.
- **Per-enum-option beginner prose** → **Phase 3** (SCHEMA-03), when the UI renders it. Phase 1 designs the `x-*` slot for it.
- **Snapshot/version history on save** → **Phase 2** (SAVE-04) / **Phase 5**. Phase 1's atomic-write pipeline should be shaped so snapshot-on-write and revert-as-write can hook in without a special-case path.

None of the above are in Phase 1 scope — discussion stayed within phase boundary.

</deferred>

---

*Phase: 1-Schema Foundation & Data-Layer Safety*
*Context gathered: 2026-07-12*
