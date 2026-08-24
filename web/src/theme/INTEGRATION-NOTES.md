# Feedback Infrastructure — Integration Notes

The feedback infrastructure is implemented wire-free in this phase:
- `state/toastStore.ts` — zustand store + pause/resume helpers (cap 4, crypto.randomUUID with counter fallback)
- `components/common/ToastHost.tsx` — portal host (role=status polite / role=alert assertive), pause on hover/focus
- `theme/toasts.css` + `theme/feedback-infra.css` — token-based dark-first styling

To activate, the integrator must:
1. Import the aggregate stylesheet in `styles.css` head alongside other theme sheets:
   `@import './theme/feedback-infra.css';`
2. Mount `<ToastHost />` once at the app root (e.g. in `App.tsx`, next to the app shell).
3. Wire the call sites below by importing `useToastStore` and calling `push(kind, message, detail?)`.

Suggested toast call sites (read-only locations — do NOT edit these from this area):

| Flow | File | Location | Kind / Copy |
|------|------|----------|-------------|
| Create config success | `components/sidebar/CreateConfigDialog.tsx` | `handleCreate`, after `await createConfig(...)` (line ~51), before `onClose()` | `success` — "Config created" + detail: target path |
| Create config failure | `components/sidebar/CreateConfigDialog.tsx` | `handleCreate` — add a `catch` (currently none) | `error` — "Couldn't create config" + error message |
| Track by path | `components/sidebar/PathEntryDialog.tsx` | `onSubmit` → `handleTrack` in `AddConfigMenu.tsx` (~line 21) | `success` — "Config added" |
| Scan outcomes | `components/sidebar/ScanReviewDialog.tsx` + `AddConfigMenu.tsx` | `handleConfirm` bulk loop (AddConfigMenu ~line 105); partial success needs aggregation | `success`/`warning` — "Added N configs" / "Added N of M (some already tracked)" |
| Track failure | `components/sidebar/AddConfigMenu.tsx` | `handleTrack`/`handleScan` — wrap in `try/catch` (none today) | `error` — "Couldn't add this config" |
| Remove tracked config | `components/sidebar/TrackedConfigSidebar.tsx` | `handleRemove` (~line 32); consider confirm first | `info`/`success` — "Config removed" + detail: "The file on disk was not deleted" |
| Missing-config remove | `components/sidebar/TrackedConfigSidebar.tsx` | `handleRemove` via `MissingConfigActions` (~line 32) | `info`/`success` — "Config removed" + "The file on disk was not deleted" |
| Key saved | `components/keys/ApiKeysWorkspace.tsx` | `handleSave` success (~line 99) | `success` — "Key saved for {title}" (replace local `setNotice`) |
| Key cleared | `components/keys/ApiKeysWorkspace.tsx` | `handleClear` success (~line 116) | `info`/`warning` — "Key removed for {title}" (replace local `setNotice`) |
| Schema refresh result | `components/schema/SchemaWorkspace.tsx` | `check` (~line 143) no-op branch and (~line 149) catch | `success` — "Schema is up to date"; `error` — "Couldn't prepare a schema update" |
| Schema activate | `components/schema/SchemaWorkspace.tsx` | `activate` success (~line 164) + catch (~line 168) | `success` — "Schema version … is now active"; `error` — "Couldn't activate this schema update" |
| Schema cancel | `components/schema/SchemaWorkspace.tsx` | `cancel` success (~line 184) + catch | `info` — "Schema update review cancelled"; `error` — "Couldn't cancel this review" |
| Schema reset | `components/schema/SchemaWorkspace.tsx` | `reset` success (~line 197) + catch | `success` — "Bundled schema is now active"; `error` — "Couldn't reset to bundled schema" |
| Save failure | `editor/useConfigDraft.ts` | `saveDraft` catch (~line 127) | `error` — "Couldn't save your changes" + error message (and clear stale-flag path) |
| Restore success | `components/history/HistoryWorkspace.tsx` | `confirmRestore` success (~line 99) after `showRestoreNotice` | `success` — "Snapshot restored" (complements existing RestoreNotice banner) |
| Restore failure | `components/history/HistoryWorkspace.tsx` | `confirmRestore` catch (~line 107) and `restoreError` branch | `error` — "Couldn't restore this snapshot" + reason |

Note: `ToastHost` must be mounted for any of these to appear. The store is workspace-agnostic — any component can call `useToastStore.getState().push(...)` without hooks if preferred.
