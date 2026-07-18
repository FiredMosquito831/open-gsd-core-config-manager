# Phase 4: Pool Editors & Model Profile Specialization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-18
**Phase:** 4-Pool Editors & Model Profile Specialization
**Areas discussed:** Pool workspace, Profiles, Layers & secrets, Entry safeguards

---

## Pool workspace

| Decision | Options considered | Selected |
|---|---|---|
| Where guided editors open | Dedicated panel; inline expansion; modal dialog | **Dedicated panel** |
| Entry presentation | Selectable list + detail; expandable cards; compact table | **Selectable list + detail** |
| Array reordering | Buttons + drag; buttons only; drag only | **Buttons + drag** |
| New-entry initialization | Guided blank entry; choose template; clone selected | **Guided blank entry** |

**Notes:** Focused editors replace the main surface temporarily and return to the originating chapter. Add uses schema defaults where available; templates and cloning are intentionally excluded.

---

## Profiles

| Decision | Options considered | Selected |
|---|---|---|
| Profile location | Dedicated Profiles chapter; Models chapter; tools menu | **Dedicated Profiles chapter** |
| Profile overview | Cards with assignments; simple list; comparison matrix | **Cards with assignments** |
| Custom-profile start | Copy existing profile; empty guided profile; either choice | **Copy existing profile** |
| Runtime-baked follow-up | Persistent save notice; inline warning only; blocking confirmation | **Persistent save notice** |

**Notes:** Profile cards summarize per-agent/per-role tier assignments. The durable notice names the setting and required `gsd install` command.

---

## Layers & secrets

| Decision | Options considered | Selected |
|---|---|---|
| Complex-value resolution display | Always-visible layer summary; source badge only; comparison side panel | **Always-visible layer summary** |
| Editing inherited pools | Create project copy; require explicit override; edit effective value | **Create project copy** |
| Default sensitive-value behavior | Masked, click-to-reveal; masked, no reveal; plaintext in focused mode | **Masked, click-to-reveal** |
| After sensitive reveal | Hide on blur/timeout; stay visible; reveal once only | **Hide on blur/timeout** |

**Notes:** All source layers stay inspectable. Sensitive values are never included in UI logs, diagnostics, or ordinary copy paths.

---

## Entry safeguards

| Decision | Options considered | Selected |
|---|---|---|
| Agent-map key safety | Picker excludes used agents; picker allows duplicates; free-text key field | **Picker excludes used agents** |
| Removing an entry | Confirm removal; remove + undo toast; immediate removal | **Confirm destructive removal** |
| Invalid entries | Inline errors + save block; prevent leaving entry; validate on save only | **Inline errors + save block** |
| Entry duplication | No duplication; duplicate simple entries; duplicate any entry | **No duplication** |

**Notes:** Invalid entries remain in the draft, are marked in the entry list, and block config save until corrected.

---

## Claude's Discretion

- Exact responsive layout, DnD implementation, confirmation copy, secret reveal timeout, runtime-baked-setting detection, and additive schema/API state shapes.

## Deferred Ideas

None — discussion stayed within phase scope.
