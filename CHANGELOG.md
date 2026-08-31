# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-24

### Added
- Full UX redesign driven by a 12-area deep audit (35 critical/high findings verified):
  - Dark-first OLED token system with full light theme, persisted via `data-theme`
  - Persistent workspace header: active project identity + Editor / History / Schema / API-keys tabs (`aria-current`, polite mode-change announcement)
  - Project-first sidebar naming (folder-name primary, short path secondary, full path tooltip, dirty dots for unsaved drafts)
  - Explain-then-edit field cards: human label, one-line summary, provenance chips (Effective / Source / Default), control, then expandable depth
  - Truthful 5-state save bar (clean / dirty / saving / saved / blocked) with `Ctrl+S` keybinding and jump-to-field validation summary
  - Searchable accessible combobox for enums with >8 options (filters key + meaning, listbox semantics, two-line results)
  - Boolean Off/On radiogroup; numeric inputs read min/max/step from the schema
  - Pool safety: unified confirm-gated removal across maps/arrays, taught empty states with direct CTAs
  - API keys workspace rework: selectable provider rows, channel explainer (file vs env), confirm-gated Remove with focus trap
  - Inline **Search providers** card at the top of the editor: see/toggle every search provider key without leaving the page
  - Toast system + toast call-sites for every silent async path (create/scan failures, save failures, key cleared, schema refresh, restore)
  - Modal focus-trap contract applied to all three sidebar dialogs (initial focus, focus restore, Tab cycle, Escape dismiss, inert background)
  - Responsive single-drawer shell: ≤1100px chapter pane auto-collapses; ≤960px sidebar + chapter are mutually exclusive overlay drawers (backdrop click / Escape close, body scroll-lock, focus return)
  - One global `:focus-visible` ring, reduced-motion kill switch, cursor-pointer on clickables, cursor-not-allowed on disabled
  - Token-only contract: every component rule uses semantic tokens; no raw hex
- Canonical schema reference at `docs/canonical-schema.json` — 201 gsd-core v1.11.0 keys, 192 with canonical defaults, 26 enums with per-option meanings, plus `defaultNote` on the 9 structural map keys
- Schema maintenance workspace: check gsd-core releases, review proposed changes in plain language, activate
- Configuration management: track `.planning/config.json` files across projects, scan folders to discover configs, add by absolute path, create new
- Two-channel API key storage for GSD's optional search providers: environment variable (`<PREFIX>_API_KEY`) **or** key file (`~/.gsd/<prefix>_api_key`), file mode `0600`, masked in UI, never logged
- Version history & structural diff: every successful save snapshots the previous file; restore any snapshot
- Atomic writes via `write-file-atomic`; stale-write protection on 409 conflict
- Theme toggle (dark default; persisted in `localStorage`)
- `start-all.ps1` Windows launcher: build-if-stale then `npm run cli:start`

### Security
- Loopback-only: binds strictly to `127.0.0.1` — never a network interface
- Host allowlist (DNS-rebinding defense) + exact-string Origin guard on every API route

### Removed
- Per-launch token guard and `?t=` URL parameter — owner decision: this is a loopback-only local tool, the token handshake was ceremony. The app always renders connected; Host allowlist + Origin guard remain the boundary
- `x-gsd-token` request header
- `getLaunchToken` / `consumeLaunchToken` helpers
- `web/src/bootstrap/token.ts` and `packages/server/src/plugins/token-guard.ts` (deleted)
- `--token <uuid>` CLI flag
- `connected: boolean` prop on `<App>` (the token gate is gone, so the prop is meaningless)

### Changed
- npm package **renamed** from `gsd-config-manager` to `open-gsd-core-config-manager` to match the GitHub repository name
- User data directory renamed accordingly: `envPaths('open-gsd-core-config-manager', …)` and `os.tmpdir()/open-gsd-core-config-manager-save-locks`
- CLI program name (Commander `.name('open-gsd-core-config-manager')`) and banner

### Tests
- **410 unit + 24 e2e** green at tag time (vitest 4.1.10, Playwright 1.61.1)
- Test files updated for token removal, search-by-meaning enum UI, project-first sidebar, save-bar state machine, search-providers inline form
- New extracted-tarball smoke run (Playwright + Node child_process) verifies the *built* CLI actually resolves and starts, not just dry-run file listing
