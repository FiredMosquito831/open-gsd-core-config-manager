# GSD Config Manager

## What This Is

A beautiful, zero-config-friendly desktop-grade tool for viewing, understanding, and safely editing GSD (open-gsd/gsd-core) configuration files across all of a developer's projects. It ships as a public npm package launched with a single `npx` command, which starts a small local (loopback) helper and opens a rich browser UI. Every config key is organized into category tabs and documented in plain language — what each field does, and what each possible option means — so even a beginner can confidently configure GSD. It manages multiple config files at once through a left sidebar, protects against corruption and data loss with validation and full version history, and provides first-class editing and creation of GSD model profiles.

## Core Value

A user can open any GSD `config.json`, understand exactly what every setting and option means, and change it correctly and safely — without ever reading the gsd-core source or docs.

## Requirements

### Validated

- [x] Saving is corruption-safe: schema validation before write, atomic write (temp file + rename). — *Validated in Phase 1: Schema Foundation & Data-Layer Safety (SAVE-01, SAVE-02, SAVE-03)*
- [x] User can install and launch the tool with a single command (`npx <package>`) with no separate server setup — a local loopback helper serves the UI and performs file I/O. — *Validated in Phase 2: Local Loopback Server, CLI & Security Hardening (DIST-01, DIST-02, DIST-03, DIST-04). The server binds 127.0.0.1 only and is guarded by a Host allowlist, an Origin check, and a per-launch token — loopback binding alone is not treated as a trust boundary (SEC-01, SEC-02).*

### Active

- [ ] UI presents all GSD config keys organized into category tabs ("chapters") derived from the canonical gsd-core config structure.
- [ ] Every field shows a full plain-language explanation of what it does; every option/enum value shows what that specific choice means and its implications — written for beginners.
- [ ] The tool bundles a curated canonical schema (keys, types, options, descriptions, defaults) derived from gsd-core docs + `defaults.json`, and can also refresh/reconcile it against the live open-gsd/gsd-core repository to construct an up-to-date canonical config.
- [ ] Coverage is exhaustive — no config key is omitted; unknown/new keys found in a file are surfaced rather than dropped.
- [ ] User can add existing config files manually (path or file picker); the app remembers them in a persistent sidebar list.
- [ ] An optional helper can scan a user-chosen folder for `.planning/config.json` files to quickly populate the sidebar (respecting boundaries like `node_modules`/`.git`).
- [ ] The tool discovers and loads both a project's `config.json` and the applicable `defaults.json`, showing effective values (default vs. overridden).
- [ ] Left sidebar lists all tracked config files; clicking one loads its data into the editor for viewing/modifying.
- [ ] User can create a brand-new config file from defaults.
- [ ] Array-valued keys are edited as "pools": user can add, configure, reorder, and remove individual entries through guided controls rather than raw JSON.
- [x] Every save is snapshotted into a browsable version history per config, with diff view and one-click revert. — *Validated in Phase 5: Version History UI (SAVE-05, SAVE-06), building on Phase 2's SAVE-04 snapshot store. History browsing, redacted structural diff, responsive timeline, guarded restore review, pre-restore recovery snapshot, and focus-safe restore outcomes are delivered.*
- [ ] User can view, edit, and create custom GSD model profiles per gsd-core docs, including per-agent/role overrides.
- [ ] UI is visually rich, polished, and user-friendly (clear typography, category navigation, inline help).

### Out of Scope

- Hosted/multi-user server or cloud sync — the tool is local-only by design ("no server needed").
- Editing arbitrary non-GSD JSON files — scope is GSD config/defaults/model profiles.
- Running or orchestrating GSD workflows themselves — this manages configuration, it does not execute phases.
- Automatic filesystem-wide crawling on launch — discovery is explicit (manual add + optional chosen-folder scan) to stay predictable and safe.

## Context

- Target ecosystem: open-gsd/gsd-core (https://github.com/open-gsd/gsd-core). Config lives at `.planning/config.json` per project, with `defaults.json` supplying defaults.
- Distribution goal: a public npm package that is trivial to install and share (`npx`-runnable), cross-platform.
- "No server" constraint is satisfied by a CLI-launched local loopback process that serves the browser UI and performs disk I/O — not a hosted backend.
- Schema strategy is hybrid: a bundled curated canonical schema (works offline, carries the beginner-friendly explanations) that can be refreshed/reconciled against the live gsd-core repo so it stays current across gsd-core versions.
- The real gsd-core `config.json` is large and deeply nested (modes, granularity, model profiles, per-agent effort routing, workflow toggles, ship/PR sections, plan-review, safety/gates, etc.) — comprehensiveness and "omit nothing" are hard requirements.

## Constraints

- **Tech stack**: React + Vite + TypeScript frontend; Node-based CLI/local helper for launch and file I/O — Assumed for a rich, maintainable, `npx`-friendly UI.
- **Architecture**: No hosted server; local loopback helper only — Explicit user requirement ("no server needed").
- **Distribution**: Published as a public npm package, single-command launch — Explicit requirement (easy to share and use).
- **Data safety**: Validate → atomic write → snapshot history/revert — Explicit requirement (prevent corruption/data loss).
- **Completeness**: Every canonical config key must be representable and documented — Explicit requirement (omit absolutely nothing).
- **Compatibility**: Must track evolving gsd-core config schema across versions — Follows from bundled + repo-refresh schema strategy.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| CLI-launched local web app (loopback helper serves UI + does file I/O) | Satisfies "no server" while enabling real disk read/write and easy `npx` install across platforms | ✓ Delivered in Phase 2 — Fastify on 127.0.0.1 with an ephemeral port, browser auto-opened at a tokenized URL |
| Loopback binding is NOT treated as a trust boundary | Any page in the user's browser can `fetch()` 127.0.0.1 — the classic local-server CSRF/DNS-rebinding class that has bitten other local tools | ✓ Delivered in Phase 2 — Host allowlist (root scope) + `/api`-scoped Origin guard + CORS lock + per-launch `x-gsd-token`. Static assets are deliberately token-free so the page can load and *then* present its token. |
| Hybrid schema: bundled curated canonical schema + refresh from gsd-core repo | Offline-reliable beginner docs, yet stays current with gsd-core changes | Bundled half delivered in Phase 1; live reconcile is Phase 6 |
| Discovery via manual add + remembered list, plus optional chosen-folder scan | Predictable and safe; avoids surprising machine-wide crawling | — Pending (Phase 3) |
| Full version-history snapshots with diff + one-click revert | Strongest protection against corruption/data loss | ✓ Delivered in Phase 5 — complete per-config timeline, redacted structural diff, safe restore through the normal save pipeline, pre-restore recovery snapshots, retryable outcomes, and responsive keyboard-accessible review UI |
| React + Vite + TypeScript frontend, public npm package | Rich UI, maintainable, trivially shareable | npm package delivered in Phase 2 (`npm pack` → 3 files, 21.3 KB, UI bundled inside). The React/Vite frontend replaces Phase 2's placeholder page in Phase 3. |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-20 after Phase 5 (Version History UI) completed*
