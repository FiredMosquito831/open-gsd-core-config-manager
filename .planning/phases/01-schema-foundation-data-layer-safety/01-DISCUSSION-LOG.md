# Phase 1: Schema Foundation & Data-Layer Safety - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 1-Schema Foundation & Data-Layer Safety
**Areas discussed:** Docs depth, Schema source, Save fidelity, Unknown keys

---

## Docs depth (beginner documentation carried by the Phase 1 schema)

| Option | Description | Selected |
|--------|-------------|----------|
| Full prose now | Per-key AND per-enum-option plain-language prose authored in schema `x-*` now | |
| Structure now, prose in P3 | Structural skeleton + `x-*` placeholders; all prose in Phase 3 | |
| Structure + stub key docs | Full structure + one-line description per key; per-option prose deferred to P3 | ✓ |

**User's choice:** Structure + stub key docs
**Notes:** `x-*` extension shape must be designed to hold per-key and per-option prose later without a structural change.

---

## Schema source (authority for building/verifying the canonical schema)

| Option | Description | Selected |
|--------|-------------|----------|
| My installed gsd-core | Build/verify against installed `.claude/gsd-core` | ✓ (part) |
| Latest open-gsd/gsd-core | Target latest published repo schema | ✓ (part) |
| You decide / research it | Let researcher pick source/version, flag drift | ✓ (part) |

**User's choice:** "My installed source + latest open gsd core + my defaults.json + you decide/research all those options. I have a 70-80% canonical config but incomplete."
**Notes:** User pointed to their partial hand-curated config at `~/.gsd/defaults - claude api.json` (~40 namespaces, incomplete). Discovery during discussion: the installed gsd-core ships a machine-readable `config-schema.manifest.json` (`validKeys` / `dynamicKeyPatterns` / `runtimeStateKeys`) + `config-schema.cjs` — captured as the PRIMARY completeness authority, with the repo for breadth and the user's file for realistic values.

---

## Save fidelity (byte-level formatting preservation on save)

| Option | Description | Selected |
|--------|-------------|----------|
| Keys+order, normalize format | Preserve keys + order, standard pretty-print, comments lost | |
| Full byte-faithful (JSONC/CST) | Preserve comments/whitespace/trailing commas via CST | |
| You decide / research it | Determine minimum fidelity from real gsd-core files | ✓ |

**User's choice:** You decide / research it
**Notes:** Default expectation is patch-in-place + 2-space pretty-print unless real config files are shown to carry comments/JSONC worth preserving. Do not over-engineer.

---

## Unknown keys (how the data layer exposes unknown/future keys)

| Option | Description | Selected |
|--------|-------------|----------|
| Separate 'unknown' bucket | Distinct list of unknown keys with paths + values | |
| Inline-tagged in tree | Every node carries `isKnown`; unknowns in place | |
| You decide / research it | Pick representation fitting the provenance data shape | ✓ |

**User's choice:** You decide / research it
**Notes:** Whatever is chosen must let Phase 3 surface unknown keys, never hide/drop them. `~/.gsd/defaults - claude api.json` (contains validator-flagged unknown keys like `gates`, `safety`) is the canonical unknown-key round-trip fixture.

## Claude's Discretion

- Save formatting fidelity (SAVE-03)
- Unknown-key representation in the load API
- Effective-value / provenance data shape

## Deferred Ideas

- Live schema reconcile against gsd-core → Phase 6 (SCHEMA-05)
- Per-enum-option beginner prose → Phase 3 (SCHEMA-03)
- Snapshot-on-save / revert-as-write → Phase 2 (SAVE-04) / Phase 5
