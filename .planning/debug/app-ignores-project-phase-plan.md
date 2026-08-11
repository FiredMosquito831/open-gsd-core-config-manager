---
slug: app-ignores-project-phase-plan
status: investigating
trigger: |
  Reported by user (verbatim, treated as data):
  "our app doesn't seem to respect the project and phase and plan files and context iles it feels like it ignored many of the instructions and preefrences investigate and fix properly to be 100% representative of initial plans and discussions and context ,d files from .planning"
created: 2026-08-11
goal: find_and_fix
tdd: false
---

# Debug Session: App not representative of `.planning` artifacts (project / phase / plan / context files)

## Symptoms

- **Symptom A — App does not respect PROJECT.md:** The delivered app diverges from what `.planning/PROJECT.md` specifies (core value, validated/active requirements, key decisions, constraints).
- **Symptom B — App does not respect phase files:** Phase `*-CONTEXT.md`, `*-DISCUSSION-LOG.md`, `*-RESEARCH.md`, `*-UI-SPEC.md`, `*-VERIFICATION.md` capture intended behavior; the implementation diverges from them.
- **Symptom C — App does not respect plan files:** `*-PLAN.md` files define task-level deliverables and decisions; `*-SUMMARY.md` claims and the actual code may not match the plans.
- **Symptom D — "Ignored many instructions and preferences":** User-perceived non-conformance to locked-stack preferences and prior decisions, still present after the 2026-08-03 `phases-ignored-user-preferences` session that claimed resolution ("confirmed fixed").
- **Goal (user-stated):** Fix the app so it is **100% representative** of the initial plans, discussions, and context `.md` files under `.planning`.

## Hypotheses (initial)

- **Audit gap:** Some requirement/decision captured in a planning artifact has no corresponding code path or UI surface in `packages/**` / `web/src/**`.
- **Verification gap:** Prior sessions verified against unit tests rather than the shipped artifact, so divergences persisted undetected.
- **Preference substitution:** A locked-stack or UX preference was recorded in CONTEXT/DISCUSSION but a weaker implementation was substituted — the recurring failure layer identified in the knowledge base.
- **Docs staleness:** PROJECT.md / ROADMAP.md / REQUIREMENTS.md may be out of date relative to what actually shipped, so some "app vs docs" mismatches are a documentation problem rather than a code problem.

## Open questions for the debugger

1. Enumerate every planning artifact (PROJECT.md, ROADMAP.md, REQUIREMENTS.md, each phase's CONTEXT/DISCUSSION/PLAN/UI-SPEC/VERIFICATION, codebase docs) and extract checkable requirements, decisions, and preferences.
2. For each extracted item, locate the corresponding implementation (or its absence) in `packages/**` and `web/src/**`.
3. Classify divergences: missing feature / weaker substitution / stale docs / test gap.
4. Fix with priority to the core value and locked-stack constraints (per `.claude/CLAUDE.md`).
5. Re-verify against the shipped artifact (build + smoke/E2E), not unit tests alone.
