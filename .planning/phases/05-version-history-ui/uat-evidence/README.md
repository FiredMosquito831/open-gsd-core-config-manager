# Phase 5 automated UAT evidence

Verified on 2026-07-20 against the packaged CLI (`node dist/cli.js --no-open --port 48173`) in cached Linux Chromium driven through `chrome-devtools-mcp` CLI.

## Setup

- Opened the tokenized launch URL printed by the CLI.
- Selected the tracked fixture config.
- Created three successful saves with long values to exercise wrapping and structural comparison.
- Restored the fixture bytes from a temporary backup after verification.
- Stopped the packaged server and browser after verification.

## Responsive layout

- `history-desktop.png` / `history-desktop-layout.json`: 1280×900 desktop layout; all three snapshot rows and the restore action are visible; document and body widths equal the viewport; no horizontal overflow.
- `history-compact.png` / `history-compact-layout.json`: 900×800 compact layout; timeline remains visible; no document-level horizontal overflow.
- `history-stacked.png` / `history-stacked-layout.json`: 768×800 mobile/touch stacked layout; content remains within the viewport; no document-level horizontal overflow.
- The screenshots use a long path and long field values. No clipped essential action or document-level horizontal overflow was observed.

## Keyboard restore dialog

- `restore-dialog.png`: rendered restore-review dialog.
- `dialog-initial-focus.json`: initial focus is `Cancel`; background app root is inert.
- `dialog-shift-tab.json`: Shift+Tab from Cancel wraps to `Restore snapshot`.
- `dialog-tab.json`: Tab wraps back to `Cancel`.
- `dialog-escape-restore.json`: Escape closes the dialog and restores focus to `Restore this snapshot`.
- `dialog-cancel-restore.json`: Cancel closes the dialog and restores focus to `Restore this snapshot`.

## Non-color-only structural diff

The browser accessibility snapshot for Snapshot #1 exposed visible textual summary and state labels, including `Added: 1`, `Removed: 0`, `Changed: 1`, `↔ Changed`, and `+ Added`. Meaning is therefore represented by text/icons as well as color.

## Supporting automated checks

- Full test suite: 44 ordinary files / 279 tests and 4 integration files / 15 tests passed.
- Production build: CLI and client builds passed.
- Typecheck currently has a pre-existing Phase 4 test configuration error: `test/web/phase4-catalog-evidence.test.ts` is included in the web TypeScript project without Node types. This did not affect Phase 5 runtime UAT or the production build.
